/**
 * Real-socket integration tests for the outbound adapters (STT, web search, sandbox, SSE streaming).
 * Each test starts a genuine local HTTP server and drives the real adapter over a TCP socket, so request
 * construction (multipart bodies, auth headers, URL rewriting), response parsing, status handling and
 * timeouts are exercised for real. The *providers* are local stand-ins: this does NOT verify any
 * third-party service (Whisper/Brave/sandbox/LLM) — only our client side of the protocol.
 */
import { describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { WhisperHttpProvider, transcribe } from "../server/home-chat/stt";
import { BraveSearchProvider, searchWeb } from "../server/home-chat/web-search";
import { HttpSandboxRunner, runCode } from "../server/home-chat/code-run";
import { streamChatCompletion, StreamError } from "../server/ai-core/sse";

type Handler = (req: http.IncomingMessage, body: Buffer, res: http.ServerResponse) => void;
async function withServer<T>(handler: Handler, fn: (base: string, seen: { req: http.IncomingMessage; body: Buffer }[]) => Promise<T>): Promise<T> {
  const seen: { req: http.IncomingMessage; body: Buffer }[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => { const body = Buffer.concat(chunks); seen.push({ req, body }); handler(req, body, res); });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try { return await fn(base, seen); } finally { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
}
const json = (res: http.ServerResponse, status: number, obj: unknown) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
const audio = Buffer.concat([Buffer.from("OggS"), Buffer.alloc(2000, 7)]); // >= minBytes; content is opaque to the adapter

describe("STT over a real socket", () => {
  it("posts multipart with bearer auth, model and the exact audio bytes, and parses verbose_json", async () => {
    await withServer((req, _b, res) => json(res, 200, { text: " hello   world ", language: "en", duration: 1.5, segments: [{ no_speech_prob: 0.01, avg_logprob: -0.2 }] }), async (base, seen) => {
      const out = await transcribe(new WhisperHttpProvider({ baseUrl: base, apiKey: "k-123", model: "whisper-1" }), { audioBase64: audio.toString("base64"), mimeType: "audio/ogg;codecs=opus", language: "en-US" });
      expect(out).toMatchObject({ status: "ok", text: "hello world", language: "en", uncertain: false });
      const { req, body } = seen[0];
      expect(req.method).toBe("POST"); expect(req.url).toBe("/v1/audio/transcriptions");
      expect(req.headers.authorization).toBe("Bearer k-123");
      expect(String(req.headers["content-type"])).toContain("multipart/form-data");
      const text = body.toString("latin1");
      expect(text).toContain('name="model"'); expect(text).toContain("whisper-1");
      expect(text).toContain('name="language"'); expect(text).toContain('filename="audio.ogg"');
      expect(body.includes(audio)).toBe(true); // the exact uploaded bytes arrived
    });
  });
  it("maps 401, 429, 500 and invalid JSON to truthful outcomes", async () => {
    for (const [status, retryable, frag] of [[401, false, "rejected"], [429, true, "rate limited"], [503, true, "problems"]] as const) {
      await withServer((_r, _b, res) => json(res, status, {}), async (base) => {
        const out = await transcribe(new WhisperHttpProvider({ baseUrl: base, apiKey: "k", model: "m" }), { audioBase64: audio.toString("base64"), mimeType: "audio/ogg" });
        expect(out).toMatchObject({ status: "failed", retryable }); expect((out as { reason: string }).reason).toContain(frag);
      });
    }
    await withServer((_r, _b, res) => json(res, 200, { nope: 1 }), async (base) => {
      expect((await transcribe(new WhisperHttpProvider({ baseUrl: base, apiKey: "k", model: "m" }), { audioBase64: audio.toString("base64"), mimeType: "audio/ogg" })).status).toBe("failed");
    });
  });
  it("reports empty speech and an unreachable provider as failures, never as success", async () => {
    await withServer((_r, _b, res) => json(res, 200, { text: "   " }), async (base) => {
      expect((await transcribe(new WhisperHttpProvider({ baseUrl: base, apiKey: "k", model: "m" }), { audioBase64: audio.toString("base64"), mimeType: "audio/ogg" })).status).toBe("empty");
    });
    const out = await transcribe(new WhisperHttpProvider({ baseUrl: "http://127.0.0.1:1", apiKey: "k", model: "m" }), { audioBase64: audio.toString("base64"), mimeType: "audio/ogg" });
    expect(out).toMatchObject({ status: "failed", retryable: true });
  });
});

describe("web search over a real socket", () => {
  const rewrite = (base: string): typeof fetch => ((url: string, init?: RequestInit) => fetch(String(url).replace("https://api.search.brave.com", base), init)) as typeof fetch;
  it("sends the subscription token, normalizes, drops unsafe URLs and de-duplicates", async () => {
    await withServer((_r, _b, res) => json(res, 200, { web: { results: [
      { title: "A <b>One</b>", url: "https://www.example.com/a", description: "snip" },
      { title: "dup", url: "https://example.com/a", description: "dup" },
      { title: "bad", url: "javascript:alert(1)", description: "x" },
      { title: "B", url: "https://news.example.org/b", description: "b" },
    ] } }), async (base, seen) => {
      const out = await searchWeb(new BraveSearchProvider("tok", rewrite(base)), "latest tech news");
      expect(out.status).toBe("ok");
      if (out.status === "ok") { expect(out.sources.map((s) => s.host)).toEqual(["example.com", "news.example.org"]); expect(out.sources[0].title).toBe("A One"); }
      expect(seen[0].req.headers["x-subscription-token"]).toBe("tok");
      expect(seen[0].req.url).toContain("q=latest%20tech%20news");
    });
  });
  it("reports 429 as retryable, 401 as not, and a hung provider as a timeout", async () => {
    await withServer((_r, _b, res) => json(res, 429, {}), async (base) => { expect(await searchWeb(new BraveSearchProvider("t", rewrite(base)), "q")).toMatchObject({ status: "failed", retryable: true }); });
    await withServer((_r, _b, res) => json(res, 401, {}), async (base) => { expect(await searchWeb(new BraveSearchProvider("t", rewrite(base)), "q")).toMatchObject({ status: "failed", retryable: false }); });
    await withServer(() => { /* never respond */ }, async (base) => {
      const out = await searchWeb(new BraveSearchProvider("t", rewrite(base)), "q", { timeoutMs: 150 });
      expect(out).toMatchObject({ status: "failed", retryable: true }); expect((out as { reason: string }).reason).toContain("timed out");
    });
  });
});

describe("sandbox client over a real socket", () => {
  it("sends network:false, bearer key and the code; redacts secrets in output", async () => {
    await withServer((_r, _b, res) => json(res, 200, { stdout: "ok\napi_key=abcdefghijk\n", stderr: "", exitCode: 0, timedOut: false, durationMs: 12 }), async (base, seen) => {
      const out = await runCode(new HttpSandboxRunner({ url: base, key: "sk" }), { language: "python", code: "print(1)" });
      expect(out).toMatchObject({ status: "ok", exitCode: 0 });
      if (out.status === "ok") expect(out.stdout).toContain("[redacted]");
      const sent = JSON.parse(seen[0].body.toString());
      expect(sent).toMatchObject({ language: "python", code: "print(1)", network: false });
      expect(seen[0].req.headers.authorization).toBe("Bearer sk");
    });
  });
  it("treats 401 and invalid payloads as failures", async () => {
    await withServer((_r, _b, res) => json(res, 401, {}), async (base) => { expect(await runCode(new HttpSandboxRunner({ url: base, key: "k" }), { language: "js", code: "1" })).toMatchObject({ status: "failed", retryable: false }); });
    await withServer((_r, _b, res) => json(res, 200, { hello: 1 }), async (base) => { expect((await runCode(new HttpSandboxRunner({ url: base, key: "k" }), { language: "js", code: "1" })).status).toBe("failed"); });
  });
});

describe("SSE streaming over a real socket", () => {
  const sse = (res: http.ServerResponse, frames: string[], delay = 0) => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    let i = 0; const tick = () => { if (i >= frames.length) return res.end(); res.write(frames[i++]); setTimeout(tick, delay); }; tick();
  };
  const d = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;
  it("delivers deltas incrementally across split frames and reports the final result", async () => {
    await withServer((_r, _b, res) => sse(res, [d({ choices: [{ delta: { content: "Hel" } }] }), 'data: {"choices":[{"delta":{"content":"lo"}', '}]}\n\n', d({ choices: [{ delta: {}, finish_reason: "stop" }], usage: { total_tokens: 3 } }), "data: [DONE]\n\n"], 5), async (base) => {
      const deltas: string[] = [];
      const r = await streamChatCompletion({ url: `${base}/v1/chat/completions`, headers: { authorization: "Bearer x" }, payload: { model: "m" }, onText: (t) => deltas.push(t) });
      expect(deltas.join("")).toBe("Hello"); expect(r.content).toBe("Hello"); expect(r.finishReason).toBe("stop");
    });
  });
  it("aborts mid-stream on cancel and surfaces provider HTTP errors as StreamError", async () => {
    await withServer((_r, _b, res) => sse(res, Array.from({ length: 200 }, () => d({ choices: [{ delta: { content: "x" } }] })), 10), async (base) => {
      const ctrl = new AbortController(); let n = 0;
      const p = streamChatCompletion({ url: `${base}/v1/chat/completions`, headers: {}, payload: {}, onText: () => { if (++n === 3) ctrl.abort(); }, signal: ctrl.signal });
      await expect(p).rejects.toBeDefined(); expect(n).toBeLessThan(50);
    });
    await withServer((_r, _b, res) => json(res, 503, { error: "down" }), async (base) => {
      await expect(streamChatCompletion({ url: `${base}/v1/chat/completions`, headers: {}, payload: {}, onText: () => {} })).rejects.toBeInstanceOf(StreamError);
    });
  });
});

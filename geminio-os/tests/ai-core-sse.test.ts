import { describe, expect, it } from "vitest";
import { iterateSse, makeThrottledProgress, streamChatCompletion, StreamError } from "../server/ai-core/sse";

const enc = new TextEncoder();
const bodyOf = (chunks: string[]) => new ReadableStream<Uint8Array>({ start(c) { chunks.forEach((x) => c.enqueue(enc.encode(x))); c.close(); } });
const collect = async (chunks: string[]) => { const out: string[] = []; for await (const d of iterateSse(bodyOf(chunks))) out.push(d); return out; };
const ev = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;
const resp = (chunks: string[], init: ResponseInit = { status: 200 }) => new Response(bodyOf(chunks), init);

describe("SSE parser", () => {
  it("splits events and handles chunk boundaries inside events, CRLF and comments", async () => {
    expect(await collect(["data: a\n\nda", "ta: b\r\n\r\n", ": keepalive\n\ndata: [DONE]\n\n"])).toEqual(["a", "b", "[DONE]"]);
  });
  it("handles multi-byte characters split across chunks", async () => {
    const bytes = enc.encode("data: héllo €\n\n"); const mid = 9;
    const s = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes.slice(0, mid)); c.enqueue(bytes.slice(mid)); c.close(); } });
    const out: string[] = []; for await (const d of iterateSse(s)) out.push(d);
    expect(out).toEqual(["héllo €"]);
  });
  it("yields a final event without a trailing blank line", async () => { expect(await collect(["data: last"])).toEqual(["last"]); });
});

describe("streamChatCompletion", () => {
  const delta = (t: string, extra: object = {}) => ev({ model: "m1", choices: [{ delta: { content: t }, ...extra }] });
  it("aggregates deltas, reports them live, and captures model/finish reason/usage", async () => {
    const seen: string[] = [];
    const f = (async () => resp([delta("Hel"), delta("lo"), ev({ choices: [{ delta: {}, finish_reason: "stop" }], usage: { total_tokens: 7 } }), "data: [DONE]\n\n"])) as unknown as typeof fetch;
    const r = await streamChatCompletion({ url: "https://x.test", headers: {}, payload: { messages: [] }, onText: (d) => seen.push(d), fetchImpl: f });
    expect(seen).toEqual(["Hel", "lo"]); expect(r).toMatchObject({ content: "Hello", model: "m1", finishReason: "stop", usage: { total_tokens: 7 } });
  });
  it("sets stream:true and event-stream accept without mutating the caller's payload", async () => {
    let init: RequestInit | undefined; const payload = { messages: [] as unknown[] };
    const f = (async (_u: string, i: RequestInit) => { init = i; return resp([delta("x"), "data: [DONE]\n\n"]); }) as unknown as typeof fetch;
    await streamChatCompletion({ url: "https://x.test", headers: { authorization: "Bearer k" }, payload, onText: () => {}, fetchImpl: f });
    expect(JSON.parse(String(init!.body)).stream).toBe(true); expect((init!.headers as any).accept).toBe("text/event-stream"); expect((payload as any).stream).toBeUndefined();
  });
  it("tolerates garbage lines and keeps going", async () => {
    const f = (async () => resp(["data: not-json\n\n", delta("ok"), "data: [DONE]\n\n"])) as unknown as typeof fetch;
    expect((await streamChatCompletion({ url: "u", headers: {}, payload: {}, onText: () => {}, fetchImpl: f })).content).toBe("ok");
  });
  it("classifies HTTP failures (429/5xx retryable, 4xx not) and never leaks the key", async () => {
    const mk = (status: number) => (async () => new Response("denied Bearer SECRETKEY", { status })) as unknown as typeof fetch;
    const e429 = await streamChatCompletion({ url: "u", headers: { authorization: "Bearer SECRETKEY" }, payload: {}, onText: () => {}, fetchImpl: mk(429) }).catch((e) => e);
    expect(e429).toBeInstanceOf(StreamError); expect(e429.retryable).toBe(true);
    const e401 = await streamChatCompletion({ url: "u", headers: {}, payload: {}, onText: () => {}, fetchImpl: mk(401) }).catch((e) => e);
    expect(e401.retryable).toBe(false);
  });
  it("fails when the stream carries an error event or ends empty", async () => {
    const err = (async () => resp([ev({ error: { message: "quota" } })])) as unknown as typeof fetch;
    await expect(streamChatCompletion({ url: "u", headers: {}, payload: {}, onText: () => {}, fetchImpl: err })).rejects.toThrow("quota");
    const empty = (async () => resp(["data: [DONE]\n\n"])) as unknown as typeof fetch;
    await expect(streamChatCompletion({ url: "u", headers: {}, payload: {}, onText: () => {}, fetchImpl: empty })).rejects.toThrow("without any content");
  });
  it("propagates abort (user cancel mid-stream)", async () => {
    const ac = new AbortController();
    const f = (async (_u: string, i: RequestInit) => { if (i.signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" }); return new Response(new ReadableStream<Uint8Array>({ pull(c) { c.enqueue(enc.encode(delta("x"))); ac.abort(); throw Object.assign(new Error("aborted"), { name: "AbortError" }); } })); }) as unknown as typeof fetch;
    await expect(streamChatCompletion({ url: "u", headers: {}, payload: {}, onText: () => {}, signal: ac.signal, fetchImpl: f })).rejects.toThrow("aborted");
  });
});

describe("throttled progress", () => {
  it("flushes at most once per interval and only with enough new text; done() waits for pending writes", async () => {
    let t = 0; const flushed: string[] = [];
    const p = makeThrottledProgress(async (s) => { flushed.push(s); }, { intervalMs: 800, minChars: 10, now: () => t });
    t = 1000; p.push("12345"); expect(flushed).toHaveLength(0);
    p.push("67890"); await p.done(); expect(flushed).toEqual(["1234567890"]);
    t = 1100; p.push("x".repeat(50)); await p.done(); expect(flushed).toHaveLength(1);
    t = 2000; p.push("y"); expect((await p.done()).length).toBe(61); expect(flushed).toHaveLength(2);
  });
});

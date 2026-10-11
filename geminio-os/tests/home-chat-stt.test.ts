import { describe, expect, it } from "vitest";
import { WhisperHttpProvider, decodeAudio, isUncertain, resolveSttProvider, transcribe, STT_LIMITS, type SttProvider } from "../server/home-chat/stt";

const audio = (n = 2000) => Buffer.alloc(n, 7).toString("base64");
const prov = (impl: SttProvider["transcribe"]): SttProvider => ({ name: "fake", transcribe: impl });
const ok = (text = "hello world") => prov(async () => ({ text, language: "en", durationSec: 2, segments: [] }));

describe("STT outcomes", () => {
  it("is truthfully unavailable with no provider", async () => {
    const r = await transcribe(null, { audioBase64: audio(), mimeType: "audio/webm" });
    expect(r.status).toBe("unavailable");
  });
  it("returns trimmed text on success", async () => {
    const r = await transcribe(ok("  hello \n world  "), { audioBase64: audio(), mimeType: "audio/webm;codecs=opus" });
    expect(r).toMatchObject({ status: "ok", text: "hello world", provider: "fake", uncertain: false });
  });
  it("reports empty transcripts instead of sending blanks", async () => {
    expect((await transcribe(ok("   "), { audioBase64: audio(), mimeType: "audio/webm" })).status).toBe("empty");
  });
  it("rejects unsupported formats, bad base64, too small and too large without calling the provider", async () => {
    let calls = 0; const p = prov(async () => { calls++; return { text: "x", language: null, durationSec: null, segments: [] }; });
    expect(await transcribe(p, { audioBase64: audio(), mimeType: "video/mp4" })).toMatchObject({ status: "invalid", code: "UNSUPPORTED_FORMAT" });
    expect(await transcribe(p, { audioBase64: "not base64!!", mimeType: "audio/webm" })).toMatchObject({ status: "invalid", code: "BAD_ENCODING" });
    expect(await transcribe(p, { audioBase64: audio(10), mimeType: "audio/webm" })).toMatchObject({ status: "invalid", code: "TOO_SMALL" });
    expect(await transcribe(p, { audioBase64: audio(STT_LIMITS.maxBytes + 4), mimeType: "audio/webm" })).toMatchObject({ status: "invalid", code: "TOO_LARGE" });
    expect(calls).toBe(0);
  });
  it("maps provider failures to truthful, actionable messages", async () => {
    const mk = (status?: number) => prov(async () => { throw Object.assign(new Error("x"), status ? { status } : {}); });
    expect(await transcribe(mk(401), { audioBase64: audio(), mimeType: "audio/webm" })).toMatchObject({ status: "failed", retryable: false });
    expect(await transcribe(mk(429), { audioBase64: audio(), mimeType: "audio/webm" })).toMatchObject({ status: "failed", retryable: true });
    expect(await transcribe(mk(503), { audioBase64: audio(), mimeType: "audio/webm" })).toMatchObject({ status: "failed", retryable: true });
    const net = await transcribe(mk(), { audioBase64: audio(), mimeType: "audio/webm" });
    expect(net).toMatchObject({ status: "failed", retryable: true });
  });
  it("flags uncertain transcripts for review", async () => {
    const p = prov(async () => ({ text: "mumble", language: "en", durationSec: 1, segments: [{ noSpeechProb: 0.9 }] }));
    expect(await transcribe(p, { audioBase64: audio(), mimeType: "audio/webm" })).toMatchObject({ status: "ok", uncertain: true });
    expect(isUncertain([{ avgLogprob: -1.5 }])).toBe(true);
    expect(isUncertain([{ avgLogprob: -0.2, noSpeechProb: 0.01 }])).toBe(false);
  });
});

describe("Whisper-compatible adapter", () => {
  it("posts multipart audio with bearer auth to /v1/audio/transcriptions and parses verbose_json", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fakeFetch = (async (url: string, init: RequestInit) => { seen = { url, init }; return new Response(JSON.stringify({ text: "hi", language: "en", duration: 1.5, segments: [{ no_speech_prob: 0.1, avg_logprob: -0.3 }] }), { status: 200 }); }) as unknown as typeof fetch;
    const p = new WhisperHttpProvider({ baseUrl: "https://stt.test/api", apiKey: "k", model: "whisper-1" }, fakeFetch);
    const r = await p.transcribe(new Uint8Array(2000), "audio/webm", { language: "fr-CA" });
    expect(seen!.url).toBe("https://stt.test/api/v1/audio/transcriptions");
    expect((seen!.init.headers as Record<string, string>).authorization).toBe("Bearer k");
    const form = seen!.init.body as FormData;
    expect(form.get("model")).toBe("whisper-1"); expect(form.get("language")).toBe("fr"); expect(form.get("response_format")).toBe("verbose_json");
    expect(r).toMatchObject({ text: "hi", language: "en", durationSec: 1.5 });
  });
  it("throws with HTTP status on error responses and on malformed JSON bodies", async () => {
    const bad = new WhisperHttpProvider({ baseUrl: "https://s.test", apiKey: "k", model: "m" }, (async () => new Response("no", { status: 500 })) as unknown as typeof fetch);
    await expect(bad.transcribe(new Uint8Array(10), "audio/webm", {})).rejects.toThrow("HTTP 500");
    const weird = new WhisperHttpProvider({ baseUrl: "https://s.test", apiKey: "k", model: "m" }, (async () => new Response(JSON.stringify({ nope: 1 }), { status: 200 })) as unknown as typeof fetch);
    await expect(weird.transcribe(new Uint8Array(10), "audio/webm", {})).rejects.toThrow("invalid response");
  });
  it("never leaks the API key into errors", async () => {
    const p = new WhisperHttpProvider({ baseUrl: "https://s.test", apiKey: "SUPERSECRET", model: "m" }, (async () => new Response("x", { status: 401 })) as unknown as typeof fetch);
    const r = await transcribe(p, { audioBase64: audio(), mimeType: "audio/webm" });
    expect(JSON.stringify(r)).not.toContain("SUPERSECRET");
  });
});

describe("provider resolution", () => {
  it("needs both URL and key; STT_* overrides the platform pair", () => {
    expect(resolveSttProvider({})).toBeNull();
    expect(resolveSttProvider({ STT_API_URL: "https://x" })).toBeNull();
    expect(resolveSttProvider({ BUILT_IN_FORGE_API_URL: "https://x", BUILT_IN_FORGE_API_KEY: "k" })).not.toBeNull();
    expect(decodeAudio("AAAA")).not.toBeNull();
    expect(decodeAudio("AAA")).toBeNull();
  });
});

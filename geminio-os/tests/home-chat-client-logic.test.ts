import { describe, expect, it } from "vitest";
import { chunkForSpeech, codeBlocks, isSafeHref, parseInline, parseMarkdown, toSpeechText } from "../lib/home-chat/markdown";
import { eventFromOutcome, initialVoice, isTooShort, voiceReducer, type VoiceEvent, type VoiceState } from "../lib/home-chat/recorder-machine";
import { initialSpeech, speechFor, speechReducer } from "../lib/home-chat/speech-machine";
import { isBusy, statusLabel, turnReducer, type TurnState } from "../lib/home-chat/turn-machine";

const run = (s: VoiceState, ...evs: VoiceEvent[]) => evs.reduce(voiceReducer, s);

describe("markdown", () => {
  it("parses headings, lists, quotes, hr, paragraphs", () => {
    const b = parseMarkdown("# Title\n\nHello **bold** and `code`.\n\n- a\n- b\n\n1. x\n2. y\n\n> quote\n\n---");
    expect(b.map((x) => x.t)).toEqual(["h", "p", "ul", "ol", "quote", "hr"]);
  });
  it("keeps code blocks verbatim with language and tolerates an unclosed fence", () => {
    const b = parseMarkdown("```ts\nconst a = 1;\n\nconst b = '**not bold**';\n```");
    expect(b[0]).toEqual({ t: "code", lang: "ts", code: "const a = 1;\n\nconst b = '**not bold**';" });
    expect(parseMarkdown("```py\nprint(1)")[0]).toEqual({ t: "code", lang: "py", code: "print(1)" });
  });
  it("parses tables", () => {
    const b = parseMarkdown("| a | b |\n|---|:-:|\n| 1 | 2 |\n| 3 | 4 |");
    expect(b[0].t).toBe("table");
    expect((b[0] as any).rows).toHaveLength(2);
  });
  it("extracts only code for copy-code", () => {
    expect(codeBlocks("text\n```js\nlet x\n```\nmore\n```\ny\n```").map((c) => c.code)).toEqual(["let x", "y"]);
  });
  it("blocks unsafe link schemes and never emits html", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html,x")).toBe(false);
    expect(isSafeHref("https://ok.test/a")).toBe(true);
    expect(parseInline("[x](javascript:alert(1))")).toEqual([{ t: "text", v: "x" }]);
    expect(parseInline("<script>alert(1)</script>")).toEqual([{ t: "text", v: "<script>alert(1)</script>" }]);
  });
  it("recognises [n] citations", () => { expect(parseInline("fact [1][2].").filter((x) => x.t === "cite")).toHaveLength(2); });
  it("speech text drops code, tables, urls and citation markers", () => {
    const t = toSpeechText("Use this [1].\n\n```js\nsecret()\n```\n\nSee [docs](https://x.test).");
    expect(t).toContain("Use this"); expect(t).toContain("docs"); expect(t).not.toContain("secret()"); expect(t).not.toContain("https"); expect(t).not.toContain("[1]");
  });
  it("chunks long text for TTS without losing content", () => {
    const text = Array.from({ length: 200 }, (_, i) => `Sentence number ${i}.`).join(" ");
    const chunks = chunkForSpeech(text, 500);
    expect(chunks.every((c) => c.length <= 500)).toBe(true);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(text);
    expect(chunkForSpeech("x".repeat(1200), 500)).toHaveLength(3);
  });
});

describe("voice recorder machine", () => {
  it("happy path: record -> pause -> resume -> stop -> transcript (draft, not sent)", () => {
    const s = run(initialVoice, { type: "PRESS_MIC" }, { type: "PERMISSION_GRANTED", now: 1000 }, { type: "PAUSE", now: 3000 }, { type: "RESUME", now: 10_000 }, { type: "STOP" }, { type: "TRANSCRIPT", text: "hello", uncertain: false });
    expect(s).toEqual({ s: "review", text: "hello", uncertain: false });
  });
  it("preserves elapsed time across pause/resume", () => {
    const paused = run(initialVoice, { type: "PRESS_MIC" }, { type: "PERMISSION_GRANTED", now: 1000 }, { type: "PAUSE", now: 3000 });
    expect(paused).toEqual({ s: "paused", elapsedMs: 2000 });
    expect(voiceReducer(paused, { type: "RESUME", now: 50_000 })).toEqual({ s: "recording", startedAt: 48_000 });
  });
  it("permission denied and mic unavailable become truthful errors", () => {
    expect(run(initialVoice, { type: "PRESS_MIC" }, { type: "PERMISSION_DENIED" })).toMatchObject({ s: "error", error: "permission_denied" });
    expect(run(initialVoice, { type: "PRESS_MIC" }, { type: "MIC_UNAVAILABLE" })).toMatchObject({ s: "error", error: "mic_unavailable" });
    expect(run(initialVoice, { type: "UNSUPPORTED" })).toMatchObject({ s: "error", error: "unsupported", retryable: false });
  });
  it("cancel discards from any active state", () => {
    for (const evs of [[{ type: "PRESS_MIC" }], [{ type: "PRESS_MIC" }, { type: "PERMISSION_GRANTED", now: 1 }], [{ type: "PRESS_MIC" }, { type: "PERMISSION_GRANTED", now: 1 }, { type: "STOP" }]] as VoiceEvent[][])
      expect(run(initialVoice, ...evs, { type: "CANCEL" })).toEqual({ s: "idle" });
  });
  it("ignores impossible transitions", () => {
    expect(voiceReducer(initialVoice, { type: "PAUSE", now: 1 })).toEqual(initialVoice);
    expect(voiceReducer(initialVoice, { type: "TRANSCRIPT", text: "x", uncertain: false })).toEqual(initialVoice);
    expect(voiceReducer({ s: "recording", startedAt: 1 }, { type: "PRESS_MIC" })).toEqual({ s: "recording", startedAt: 1 });
  });
  it("maps server outcomes", () => {
    expect(eventFromOutcome({ status: "ok", text: "hi", uncertain: true })).toEqual({ type: "TRANSCRIPT", text: "hi", uncertain: true });
    expect(eventFromOutcome({ status: "empty", reason: "none" })).toMatchObject({ error: "empty" });
    expect(eventFromOutcome({ status: "unavailable" })).toMatchObject({ error: "provider_unavailable", retryable: false });
    expect(eventFromOutcome({ status: "invalid", code: "TOO_SMALL" })).toMatchObject({ error: "too_short" });
    expect(eventFromOutcome({ status: "failed", retryable: false })).toMatchObject({ error: "provider_failed", retryable: false });
  });
  it("recording error mid-capture surfaces", () => {
    expect(run(initialVoice, { type: "PRESS_MIC" }, { type: "PERMISSION_GRANTED", now: 1 }, { type: "RECORDING_ERROR", message: "disk full" })).toMatchObject({ s: "error", error: "recording_failed" });
    expect(isTooShort(100)).toBe(true);
  });
});

describe("speech machine", () => {
  it("play -> pause -> resume -> chunks -> idle; stop at any time", () => {
    let s = speechReducer(initialSpeech, { type: "PLAY", messageId: "m1", total: 2 });
    expect(speechFor(s, "m1")).toBe("speaking"); expect(speechFor(s, "m2")).toBe("idle");
    s = speechReducer(s, { type: "PAUSE" }); expect(speechFor(s, "m1")).toBe("paused");
    s = speechReducer(s, { type: "RESUME" }); s = speechReducer(s, { type: "CHUNK_DONE" }); expect(s).toMatchObject({ chunk: 1 });
    expect(speechReducer(s, { type: "CHUNK_DONE" })).toEqual({ s: "idle" });
    expect(speechReducer(s, { type: "STOP" })).toEqual({ s: "idle" });
  });
  it("starting another message replaces the current one; empty text is an error", () => {
    const s = speechReducer(speechReducer(initialSpeech, { type: "PLAY", messageId: "a", total: 1 }), { type: "PLAY", messageId: "b", total: 1 });
    expect(speechFor(s, "a")).toBe("idle"); expect(speechFor(s, "b")).toBe("speaking");
    expect(speechReducer(initialSpeech, { type: "PLAY", messageId: "x", total: 0 })).toMatchObject({ s: "error" });
  });
});

describe("turn machine & status labels", () => {
  it("send -> accepted -> polls -> done", () => {
    let s: TurnState = turnReducer({ s: "idle" }, { type: "SEND", predictedSearch: false });
    expect(statusLabel(s)).toBe("Sending…");
    s = turnReducer(s, { type: "ACCEPTED", runId: "r1", search: { attempted: false } });
    s = turnReducer(s, { type: "POLL", status: "executing", steps: [{ key: "step_started", label: "Generating response", state: "active" }], error: null });
    expect(statusLabel(s)).toBe("Generating response…");
    expect(turnReducer(s, { type: "POLL", status: "completed", steps: [], error: null })).toEqual({ s: "done", runId: "r1" });
  });
  it("only mentions the web while the send that may search is in flight", () => {
    expect(statusLabel(turnReducer({ s: "idle" }, { type: "SEND", predictedSearch: true }))).toContain("web");
    const running = turnReducer(turnReducer({ s: "idle" }, { type: "SEND", predictedSearch: true }), { type: "ACCEPTED", runId: "r", search: { attempted: true, status: "unavailable" } });
    expect(statusLabel(running)).not.toContain("web");
  });
  it("stop flow and cancelled poll", () => {
    let s: TurnState = { s: "running", runId: "r", search: { attempted: false }, steps: [] };
    s = turnReducer(s, { type: "STOP" }); expect(isBusy(s)).toBe(true);
    expect(turnReducer(s, { type: "STOPPED" })).toEqual({ s: "stopped", runId: "r" });
    expect(turnReducer(s, { type: "POLL", status: "cancelled", steps: [], error: null })).toEqual({ s: "stopped", runId: "r" });
  });
  it("failure keeps retryability; insufficient credits is not retryable", () => {
    expect(turnReducer({ s: "running", runId: "r", search: { attempted: false }, steps: [] }, { type: "POLL", status: "failed", steps: [], error: { message: "down", retryable: true } })).toMatchObject({ s: "failed", retryable: true });
    expect(turnReducer({ s: "sending", predictedSearch: false }, { type: "SEND_FAILED", message: "no credits", code: "INSUFFICIENT_CREDITS" })).toMatchObject({ s: "failed", retryable: false, code: "INSUFFICIENT_CREDITS" });
  });
  it("cannot send twice concurrently", () => {
    const sending = turnReducer({ s: "idle" }, { type: "SEND", predictedSearch: false });
    expect(turnReducer(sending, { type: "SEND", predictedSearch: true })).toEqual(sending);
  });
});

describe("pause / resume in the turn machine", () => {
  const running: TurnState = { s: "running", runId: "r", search: { attempted: false }, steps: [] };
  it("a paused poll pauses; resume/accepted poll returns to running; still busy while paused", () => {
    const paused = turnReducer(running, { type: "POLL", status: "paused", steps: [], error: null });
    expect(paused).toEqual({ s: "paused", runId: "r" }); expect(isBusy(paused)).toBe(true); expect(statusLabel(paused)).toContain("Paused");
    expect(turnReducer(paused, { type: "RESUMED" }).s).toBe("running");
    expect(turnReducer(paused, { type: "POLL", status: "executing", steps: [], error: null }).s).toBe("running");
  });
  it("stop works from paused; a paused run can still end as cancelled/failed", () => {
    const paused: TurnState = { s: "paused", runId: "r" };
    expect(turnReducer(paused, { type: "STOP" })).toEqual({ s: "stopping", runId: "r" });
    expect(turnReducer(paused, { type: "POLL", status: "cancelled", steps: [], error: null })).toEqual({ s: "stopped", runId: "r" });
    expect(turnReducer(paused, { type: "SEND", predictedSearch: false })).toEqual(paused);
  });
});

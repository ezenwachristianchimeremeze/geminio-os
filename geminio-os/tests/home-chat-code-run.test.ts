import { describe, expect, it } from "vitest";
import { CODE_LIMITS, HttpSandboxRunner, normalizeLanguage, resolveSandbox, runCode, type SandboxRunner } from "../server/home-chat/code-run";

const ok = (over: object = {}): SandboxRunner => ({ name: "fake", run: async () => ({ stdout: "hi\n", stderr: "", exitCode: 0, timedOut: false, durationMs: 12, ...over }) });
describe("code run policy", () => {
  it("is truthfully unavailable with no sandbox and never pretends to run", async () => {
    expect(await runCode(null, { language: "python", code: "print(1)" })).toMatchObject({ status: "unavailable", reason: expect.stringContaining("was not run") });
    expect(resolveSandbox({})).toBeNull(); expect(resolveSandbox({ GEMINIO_SANDBOX_URL: "https://s.test" })).toBeNull(); expect(resolveSandbox({ GEMINIO_SANDBOX_URL: "https://s.test", GEMINIO_SANDBOX_KEY: "k" })).not.toBeNull();
  });
  it("normalises languages and refuses everything else (no shell)", async () => {
    expect(normalizeLanguage("TS")).toBe("typescript"); expect(normalizeLanguage("python3")).toBe("python"); expect(normalizeLanguage("bash")).toBeNull();
    expect(await runCode(ok(), { language: "bash", code: "rm -rf /" })).toMatchObject({ status: "invalid" });
  });
  it("validates code before calling the sandbox", async () => {
    let called = 0; const r: SandboxRunner = { name: "x", run: async () => { called++; return { stdout: "", stderr: "", exitCode: 0, timedOut: false, durationMs: 0 }; } };
    expect((await runCode(r, { language: "js", code: "  " })).status).toBe("invalid");
    expect((await runCode(r, { language: "js", code: "x".repeat(CODE_LIMITS.maxCodeChars + 1) })).status).toBe("invalid");
    expect(called).toBe(0);
  });
  it("returns output, truncates huge output and redacts secret-looking strings", async () => {
    expect(await runCode(ok(), { language: "js", code: "console.log('hi')" })).toMatchObject({ status: "ok", stdout: "hi\n", exitCode: 0 });
    const big = await runCode(ok({ stdout: "a".repeat(CODE_LIMITS.maxOutputChars + 50) }), { language: "js", code: "x" });
    expect(big).toMatchObject({ status: "ok", truncated: true });
    const sec = await runCode(ok({ stdout: "key sk-abcdefghijklmnopqrstuv and password=hunter22222" }), { language: "js", code: "x" });
    expect((sec as any).stdout).not.toContain("sk-abcdef"); expect((sec as any).stdout).not.toContain("hunter2");
  });
  it("reports non-zero exit and timeouts as results (not as success of the program)", async () => {
    expect(await runCode(ok({ exitCode: 1, stderr: "Traceback..." }), { language: "py", code: "1/0" })).toMatchObject({ status: "ok", exitCode: 1 });
    expect(await runCode(ok({ timedOut: true, exitCode: 137 }), { language: "py", code: "while True: pass" })).toMatchObject({ timedOut: true });
  });
  it("maps provider failures honestly", async () => {
    const boom = (status?: number): SandboxRunner => ({ name: "b", run: async () => { throw Object.assign(new Error("x"), status ? { status } : {}); } });
    expect(await runCode(boom(401), { language: "js", code: "1" })).toMatchObject({ status: "failed", retryable: false });
    expect(await runCode(boom(503), { language: "js", code: "1" })).toMatchObject({ status: "failed", retryable: true });
  });
});
describe("HTTP sandbox adapter", () => {
  it("posts the documented contract with network disabled and bearer auth", async () => {
    let seen: any;
    const f = (async (url: string, init: RequestInit) => { seen = { url, init }; return new Response(JSON.stringify({ stdout: "1", stderr: "", exitCode: 0, timedOut: false, durationMs: 5 }), { status: 200 }); }) as unknown as typeof fetch;
    const r = await new HttpSandboxRunner({ url: "https://sb.test/api", key: "K" }, f).run({ language: "python", code: "print(1)", timeoutMs: 10000 });
    expect(seen.url).toBe("https://sb.test/api/run"); expect((seen.init.headers as any).authorization).toBe("Bearer K");
    expect(JSON.parse(seen.init.body)).toEqual({ language: "python", code: "print(1)", timeoutMs: 10000, network: false }); expect(r.stdout).toBe("1");
  });
  it("rejects malformed responses and HTTP errors", async () => {
    const bad = new HttpSandboxRunner({ url: "https://s.test", key: "k" }, (async () => new Response(JSON.stringify({ nope: 1 }), { status: 200 })) as unknown as typeof fetch);
    await expect(bad.run({ language: "js", code: "1", timeoutMs: 1 })).rejects.toThrow("invalid response");
    const err = new HttpSandboxRunner({ url: "https://s.test", key: "k" }, (async () => new Response("", { status: 500 })) as unknown as typeof fetch);
    await expect(err.run({ language: "js", code: "1", timeoutMs: 1 })).rejects.toThrow("HTTP 500");
  });
});

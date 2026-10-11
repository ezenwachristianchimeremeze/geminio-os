/**
 * Sandboxed code execution from Home chat. NEVER runs code in this process or on the app server.
 * Execution is delegated to an isolated sandbox service over HTTP (contract below). With no sandbox configured every run
 * returns a truthful "unavailable" outcome; nothing is simulated.
 *
 * Sandbox service contract (to be implemented by infrastructure; NOT provided by this repo):
 *   POST {GEMINIO_SANDBOX_URL}/run   Authorization: Bearer {GEMINIO_SANDBOX_KEY}
 *   body    { language: "javascript"|"typescript"|"python", code: string, timeoutMs: number, network: false }
 *   200     { stdout: string, stderr: string, exitCode: number, timedOut: boolean, durationMs: number }
 *   The service MUST isolate (container/microVM), disable network, cap CPU/memory/disk, and destroy the environment after the run.
 */
export const CODE_LIMITS = { maxCodeChars: 20_000, timeoutMs: 10_000, maxOutputChars: 20_000, requestTimeoutMs: 20_000 } as const;
export const LANGUAGES = { javascript: ["js", "javascript", "node", "mjs"], typescript: ["ts", "typescript"], python: ["py", "python", "python3"] } as const;
export type Language = keyof typeof LANGUAGES;

export function normalizeLanguage(raw: string | null | undefined): Language | null {
  const l = (raw ?? "").trim().toLowerCase();
  for (const [name, aliases] of Object.entries(LANGUAGES)) if ((aliases as readonly string[]).includes(l)) return name as Language;
  return null;
}

export type RunOutcome =
  | { status: "ok"; stdout: string; stderr: string; exitCode: number; timedOut: boolean; durationMs: number; truncated: boolean }
  | { status: "unavailable"; reason: string }
  | { status: "invalid"; reason: string }
  | { status: "failed"; reason: string; retryable: boolean };

export interface SandboxRunner { readonly name: string; run(input: { language: Language; code: string; timeoutMs: number; signal?: AbortSignal }): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean; durationMs: number }>; }

export class HttpSandboxRunner implements SandboxRunner {
  readonly name = "http-sandbox";
  constructor(private cfg: { url: string; key: string }, private fetchImpl: typeof fetch = fetch) {}
  async run(input: { language: Language; code: string; timeoutMs: number; signal?: AbortSignal }) {
    const base = this.cfg.url.endsWith("/") ? this.cfg.url : `${this.cfg.url}/`;
    const res = await this.fetchImpl(new URL("run", base).toString(), { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${this.cfg.key}` }, body: JSON.stringify({ language: input.language, code: input.code, timeoutMs: input.timeoutMs, network: false }), signal: input.signal });
    if (!res.ok) throw Object.assign(new Error(`Sandbox returned HTTP ${res.status}`), { status: res.status });
    const j = (await res.json()) as Record<string, unknown>;
    if (typeof j.stdout !== "string" || typeof j.stderr !== "string" || typeof j.exitCode !== "number") throw new Error("Sandbox returned an invalid response.");
    return { stdout: j.stdout, stderr: j.stderr, exitCode: j.exitCode, timedOut: Boolean(j.timedOut), durationMs: typeof j.durationMs === "number" ? j.durationMs : 0 };
  }
}

export function resolveSandbox(env: Record<string, string | undefined>, fetchImpl?: typeof fetch): SandboxRunner | null {
  return env.GEMINIO_SANDBOX_URL && env.GEMINIO_SANDBOX_KEY ? new HttpSandboxRunner({ url: env.GEMINIO_SANDBOX_URL, key: env.GEMINIO_SANDBOX_KEY }, fetchImpl) : null;
}

const clip = (s: string) => (s.length > CODE_LIMITS.maxOutputChars ? { text: `${s.slice(0, CODE_LIMITS.maxOutputChars)}\n…[output truncated]`, cut: true } : { text: s, cut: false });
const SECRET_OUT = /(sk-[A-Za-z0-9]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:password|secret|token|api[_-]?key)\s*[=:]\s*\S{6,})/gi;

export async function runCode(runner: SandboxRunner | null, input: { language: string; code: string }): Promise<RunOutcome> {
  const language = normalizeLanguage(input.language);
  if (!language) return { status: "invalid", reason: `Running ${input.language || "this language"} isn't supported. Supported: JavaScript, TypeScript, Python.` };
  const code = input.code.replace(/\u0000/g, "");
  if (!code.trim()) return { status: "invalid", reason: "There is no code to run." };
  if (code.length > CODE_LIMITS.maxCodeChars) return { status: "invalid", reason: `The code is longer than ${CODE_LIMITS.maxCodeChars} characters.` };
  if (!runner) return { status: "unavailable", reason: "Code execution isn't available: no isolated sandbox is configured on this server. Your code was not run." };
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), CODE_LIMITS.requestTimeoutMs);
  try {
    const r = await runner.run({ language, code, timeoutMs: CODE_LIMITS.timeoutMs, signal: ctrl.signal });
    const out = clip(r.stdout.replace(SECRET_OUT, "[redacted]")); const err = clip(r.stderr.replace(SECRET_OUT, "[redacted]"));
    return { status: "ok", stdout: out.text, stderr: err.text, exitCode: r.exitCode, timedOut: r.timedOut, durationMs: r.durationMs, truncated: out.cut || err.cut };
  } catch (e) {
    const status = (e as { status?: number }).status; const aborted = e instanceof Error && e.name === "AbortError";
    return { status: "failed", reason: aborted ? "The sandbox didn't respond in time." : status === 401 || status === 403 ? "The sandbox rejected our credentials." : "The sandbox request failed.", retryable: aborted || status === undefined || status >= 500 || status === 429 };
  } finally { clearTimeout(timer); }
}

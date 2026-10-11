import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EventEmitter } from "node:events";
import { diagnoseFailure, OutputBuffer, parseOutputLine, redact, toPreviewState } from "../server/dev-preview/states";
import { bar, CANONICAL_STATUSES, computeProgress, parseMatrix } from "../server/dev-preview/progress";
import { appendActivity, readActivity } from "../server/dev-preview/activity";
import { DevPreviewSupervisor, LocalProcessProvider, PREVIEW_COMMANDS, type ChildLike, type SpawnFn } from "../server/dev-preview/supervisor";

class FakeChild extends EventEmitter implements ChildLike {
  pid = undefined;
  stdout = new EventEmitter() as unknown as ChildLike["stdout"];
  stderr = new EventEmitter() as unknown as ChildLike["stderr"];
  killed = false;
  out(text: string) { (this.stdout as unknown as EventEmitter).emit("data", Buffer.from(text)); }
  err(text: string) { (this.stderr as unknown as EventEmitter).emit("data", Buffer.from(text)); }
  kill() { this.killed = true; setTimeout(() => this.emit("exit", null, "SIGTERM"), 0); return true; }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => boolean, ms = 2000) { const end = Date.now() + ms; while (!cond() && Date.now() < end) await sleep(5); }

function tmpRepo(withModules: boolean) {
  const dir = mkdtempSync(join(tmpdir(), "geminio-preview-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x", version: "9.9.9" }));
  if (withModules) mkdirSync(join(dir, "node_modules"));
  return dir;
}
const DEV_ENV = { GEMINIO_DEV_PREVIEW: "1", NODE_ENV: "development", EXPO_PORT: "18081" } as NodeJS.ProcessEnv;

describe("state mapping", () => {
  it("maps runner job states to the preview states the UI shows", () => {
    expect(toPreviewState(null)).toBe("stopped");
    expect(toPreviewState("queued")).toBe("starting");
    expect(toPreviewState("preparing")).toBe("installing");
    expect(toPreviewState("building")).toBe("building");
    expect(toPreviewState("running")).toBe("running");
    expect(toPreviewState("ready")).toBe("ready");
    expect(toPreviewState("failed")).toBe("failed");
    expect(toPreviewState("timeout")).toBe("failed");
    expect(toPreviewState("cleaned")).toBe("stopped");
  });
});

describe("failure diagnosis (uses real output text only)", () => {
  it("recognises this sandbox's actual registry denial", () => {
    const d = diagnoseFailure("install", "curl: HTTP/2 403 x-deny-reason: host_not_allowed", 1);
    expect(d.kind).toBe("dependency_registry_blocked");
    expect(d.title).toBe("Dependency installation blocked");
  });
  it("does not guess: unknown install error stays generic", () => {
    expect(diagnoseFailure("install", "something odd", 7).kind).toBe("dependency_install_failed");
    expect(diagnoseFailure("run", "weird", null).kind).toBe("unknown");
  });
  it("detects port and database problems at run time", () => {
    expect(diagnoseFailure("run", "Error: listen EADDRINUSE :::3000", 1).kind).toBe("port_in_use");
    expect(diagnoseFailure("run", "Access denied for user 'x'@'localhost'", 1).kind).toBe("database_unavailable");
  });
});

describe("redaction and output parsing", () => {
  it("redacts secrets before they reach the UI or the log", () => {
    expect(redact("DATABASE_URL=mysql://u:pw@host/db")).toBe("DATABASE_URL=[redacted]");
    expect(redact("OPENAI_API_KEY: sk-abc123456789")).toContain("[redacted]");
    expect(redact("Authorization: Bearer abcdefghijklmnop")).toContain("Bearer [redacted]");
    expect(redact("connect mysql://root:hunter2@db:3306/x")).toContain("mysql://[redacted]@");
    expect(redact("plain line")).toBe("plain line");
  });
  it("parses the server listening line and bundle signals", () => {
    expect(parseOutputLine("[api] server listening on port 3001")).toEqual({ type: "server_listening", port: 3001 });
    expect(parseOutputLine("Web Bundled 800ms entry.js")).toEqual({ type: "web_bundled" });
    expect(parseOutputLine("Unable to resolve module foo")?.type).toBe("bundle_error");
    expect(parseOutputLine("nothing")).toBeNull();
  });
  it("bounds buffered output", () => {
    const b = new OutputBuffer(5, 20);
    b.push(Array.from({ length: 50 }, (_, i) => `line ${i} ${"x".repeat(100)}`).join("\n"));
    expect(b.tail(100)).toHaveLength(5);
    expect(b.tail(1)[0].length).toBe(20);
  });
});

const MATRIX = `
| ID | Area | Requirement | Status | Runtime verified | Evidence |
|---|---|---|---|---|---|
| GO-FND-001 | Foundation | Auth | IMPLEMENTED | No | code |
| GO-FND-002 | Foundation | MFA | MISSING | No | none |
| GO-FND-003 | Foundation | Sessions | VERIFIED | Yes | test run |
| GO-AIB-001 | AI Builder | Plan | IN PROGRESS | No | x |
| GO-AIB-002 | AI Builder | Runner | BLOCKED BY EXTERNAL INFRASTRUCTURE | No | repo-side complete: needs runner |
| GO-AIB-003 | AI Builder | Credits | IN PROGRESS | No | DEFECT: race |
| GO-OLD-001 | Legacy | n/a thing | N/A | No | not applicable |
`;
describe("matrix-derived progress", () => {
  it("derives every number from row states only", () => {
    const r = computeProgress(MATRIX);
    expect(r.rows).toBe(7);
    const f = r.areas.find((a) => a.area === "Foundation")!;
    expect(f.total).toBe(3);
    expect(f.counts).toEqual({ missing: 1, in_progress: 0, implemented: 1, verified: 1, blocked: 0 });
    expect(f.builtPercent).toBe(67);
    expect(f.verifiedPercent).toBe(33);
    const a = r.areas.find((x) => x.area === "AI Builder")!;
    expect(a.counts.in_progress).toBe(2);
    expect(a.broken).toBe(1);
    expect(a.counts.blocked).toBe(1);
    expect(a.builtPercent).toBe(33); // blocked counts as repository-side built
    expect(a.verifiedPercent).toBe(0);
    expect(r.areas.find((x) => x.area === "Legacy")!.total).toBe(0); // N/A excluded
    expect(r.overall.total).toBe(6);
  });
  it("rejects dishonest rows instead of counting them silently", () => {
    const rows = parseMatrix("| GO-X-001 | A | r | VERIFIED | No | none |\n| GO-X-002 | A | r | BOGUS | No | x |\n| GO-X-002 | A | r | MISSING | No | dup |");
    const problems = rows.flatMap((r) => r.problems).join("|");
    expect(problems).toContain("VERIFIED requires Runtime verified = Yes");
    expect(problems).toContain("unknown status");
    expect(problems).toContain("duplicate row id");
  });
  it("refuses BLOCKED rows that do not claim a finished repository side", () => {
    const bad = parseMatrix("| GO-B-001 | A | r | BLOCKED BY EXTERNAL INFRASTRUCTURE | No | needs provider |");
    expect(bad[0].problems.join("|")).toContain("BLOCKED requires");
    const good = parseMatrix("| GO-B-002 | A | r | BLOCKED BY EXTERNAL INFRASTRUCTURE | No | repo-side complete: adapter + tests; needs provider credentials |");
    expect(good[0].problems).toEqual([]);
  });
  it("renders text bars", () => {
    expect(bar(0)).toBe("░░░░░░░░░░");
    expect(bar(100)).toBe("██████████");
    expect(bar(80)).toBe("████████░░");
  });
  it("accepts the canonical vocabulary and maps IN PROGRESS / VERIFIED / BLOCKED BY EXTERNAL INFRASTRUCTURE", () => {
    const r = computeProgress("| GO-N-001 | A | r | IN PROGRESS | No | defect: broken thing |\n| GO-N-002 | A | r | VERIFIED | Yes | run 1 |\n| GO-N-003 | A | r | BLOCKED BY EXTERNAL INFRASTRUCTURE | No | repo-side complete: adapter done |\n| GO-N-004 | A | r | IMPLEMENTED | No | code |");
    expect(r.problems).toEqual([]);
    expect(r.overall.counts).toEqual({ missing: 0, in_progress: 1, implemented: 1, verified: 1, blocked: 1 });
    expect(r.overall.broken).toBe(1);
    expect(parseMatrix("| GO-N-005 | A | r | VERIFIED | No | claimed |")[0].problems.join()).toContain("requires Runtime verified");
  });
  it("the repository matrix uses only the canonical status vocabulary", () => {
    const rows = parseMatrix(readFileSync(join(process.cwd(), "BLUEPRINT_IMPLEMENTATION_MATRIX.md"), "utf8"));
    expect(rows.filter((r) => !(CANONICAL_STATUSES as readonly string[]).includes(r.status)).map((r) => `${r.id}:${r.status}`)).toEqual([]);
  });
  it("the repository's real matrix parses cleanly with no integrity problems", () => {
    const md = readFileSync(join(process.cwd(), "BLUEPRINT_IMPLEMENTATION_MATRIX.md"), "utf8");
    const r = computeProgress(md);
    expect(r.rows).toBeGreaterThan(40);
    expect(r.problems).toEqual([]);
    expect(r.overall.counts.verified).toBe(0); // nothing may be verified without a real toolchain run
  });
});

describe("activity log", () => {
  it("round-trips, redacts, skips torn lines, newest first", () => {
    const dir = mkdtempSync(join(tmpdir(), "geminio-act-"));
    const file = join(dir, "nested", "a.jsonl");
    appendActivity(file, { source: "agent", level: "info", message: "Editing server/ai-builder/service.ts" });
    appendActivity(file, { source: "supervisor", level: "error", message: "failed DATABASE_URL=mysql://u:p@h/d" });
    writeFileSync(file, readFileSync(file, "utf8") + "{torn json\n");
    const entries = readActivity(file);
    expect(entries).toHaveLength(2);
    expect(entries[0].source).toBe("supervisor");
    expect(entries[0].message).toContain("[redacted]");
    expect(entries[1].message).toBe("Editing server/ai-builder/service.ts");
    expect(readActivity(join(dir, "missing.jsonl"))).toEqual([]);
  });
});

describe("DevPreviewSupervisor", () => {
  it("is disabled unless explicitly enabled outside production and refuses to start", async () => {
    const dir = tmpRepo(true);
    const sup = new DevPreviewSupervisor({ cwd: dir, env: { NODE_ENV: "development" } as NodeJS.ProcessEnv, activityFile: join(dir, "a.jsonl") });
    expect(sup.status().enabled).toBe(false);
    expect(sup.status().disabledReason).toContain("GEMINIO_DEV_PREVIEW=1");
    await expect(sup.start(1)).rejects.toThrow("disabled");
    const prod = new LocalProcessProvider({ NODE_ENV: "production", GEMINIO_DEV_PREVIEW: "1" } as NodeJS.ProcessEnv);
    expect(prod.configured).toBe(false);
  });

  it("only ever executes the three fixed commands", async () => {
    const dir = tmpRepo(false);
    const seen: string[] = [];
    const spawn: SpawnFn = (cmd, args) => { seen.push([cmd, ...args].join(" ")); const c = new FakeChild(); setTimeout(() => c.emit("exit", 1, null), 0); return c; };
    const sup = new DevPreviewSupervisor({ cwd: dir, env: DEV_ENV, spawn, activityFile: join(dir, "a.jsonl") });
    await sup.start(1);
    await until(() => sup.status().state === "failed");
    expect(seen).toEqual([PREVIEW_COMMANDS.install.join(" ")]);
  });

  it("reports 'Dependency installation blocked' with the real error when the registry is denied", async () => {
    const dir = tmpRepo(false);
    const spawn: SpawnFn = () => {
      const c = new FakeChild();
      setTimeout(() => { c.err("ERR_PNPM_META_FETCH_FAIL GET https://registry.npmjs.org/zod: 403 x-deny-reason: host_not_allowed\n"); c.emit("exit", 1, null); }, 0);
      return c;
    };
    const sup = new DevPreviewSupervisor({ cwd: dir, env: DEV_ENV, spawn, activityFile: join(dir, "a.jsonl") });
    await sup.start(1);
    await until(() => sup.status().state === "failed");
    const st = sup.status();
    expect(st.state).toBe("failed");
    expect(st.error?.title).toBe("Dependency installation blocked");
    expect(st.error?.phase).toBe("install");
    expect(st.outputTail.join("\n")).toContain("host_not_allowed");
    expect(st.previewUrl).toBeNull();
  });

  it("goes install → build → run → ready only after real health probes pass, then reloads on rebuild", async () => {
    const dir = tmpRepo(false);
    const children: FakeChild[] = [];
    const states: string[] = [];
    let sup!: DevPreviewSupervisor;
    const spawn: SpawnFn = (cmd, args) => {
      const c = new FakeChild(); children.push(c);
      const key = args.join(" ");
      states.push(sup.status().state);
      if (key.startsWith("install") || key === "build") setTimeout(() => c.emit("exit", 0, null), 5);
      else setTimeout(() => c.out("[api] server listening on port 3001\n"), 5); // dev server stays alive
      return c;
    };
    let dbUp = false;
    const probe = async (url: string) => {
      if (url.endsWith(":18081/")) return { ok: true, status: 200 };
      if (url.endsWith("/api/health/ready")) return dbUp ? { ok: true, status: 200, json: { ok: true, db: { ok: true } } } : { ok: false, status: 503, json: { ok: false, db: { ok: false, reason: "DATABASE_URL is not configured." } } };
      return { ok: false, status: 0 };
    };
    sup = new DevPreviewSupervisor({ cwd: dir, env: DEV_ENV, spawn, probe, probeIntervalMs: 5, activityFile: join(dir, "a.jsonl") });
    await sup.start(1);
    expect(sup.status().state === "starting" || sup.status().state === "installing").toBe(true);
    await until(() => sup.status().state === "running");
    await until(() => sup.status().dependencies.database === "unavailable");
    // API + Metro up but database down: must NOT claim ready, must say why.
    const degraded = sup.status();
    expect(degraded.state).toBe("running");
    expect(degraded.warnings).toContain("Database unavailable");
    expect(degraded.dependencies.databaseDetail).toContain("DATABASE_URL");
    expect(degraded.previewUrl).toBe("http://localhost:18081");
    dbUp = true;
    await until(() => sup.status().state === "ready");
    const ready = sup.status();
    expect(ready.state).toBe("ready");
    expect(ready.apiPort).toBe(3001);
    expect(ready.version.packageVersion).toBe("9.9.9");
    expect(ready.warnings).toEqual([]);
    expect(states[0]).toBeDefined();
    // rebuild signals bump revision
    const rev0 = ready.revision;
    children[children.length - 1].out("Web Bundled 900ms entry.js (100 modules)\n");
    await until(() => sup.status().revision === rev0 + 1);
    expect(sup.status().revision).toBe(rev0 + 1);
    expect(sup.status().lastRebuildAt).not.toBeNull();
    sup.refresh();
    expect(sup.status().revision).toBe(rev0 + 2);
    // idempotent start
    const again = await sup.start(1);
    expect(again.jobId).toBe(ready.jobId);
    expect(children.length).toBe(3);
    // stop
    const stopped = await sup.stop();
    expect(stopped.state).toBe("stopped");
    expect(stopped.previewUrl).toBeNull();
    expect(children[children.length - 1].killed).toBe(true);
  });

  it("marks failed with the real exit code when the dev server dies, and can restart", async () => {
    const dir = tmpRepo(true);
    let runs = 0;
    const spawn: SpawnFn = (_c, args) => {
      const c = new FakeChild();
      if (args.join(" ") === "build") setTimeout(() => c.emit("exit", 0, null), 2);
      else { runs += 1; setTimeout(() => { c.err("Error: listen EADDRINUSE :::3000\n"); c.emit("exit", 1, null); }, 5); }
      return c;
    };
    const sup = new DevPreviewSupervisor({ cwd: dir, env: DEV_ENV, spawn, probe: async () => ({ ok: false, status: 0 }), probeIntervalMs: 5, readyTimeoutMs: 100, activityFile: join(dir, "a.jsonl") });
    await sup.start(1);
    await until(() => sup.status().state === "failed");
    expect(sup.status().error?.kind).toBe("port_in_use");
    expect(sup.status().error?.exitCode).toBe(1);
    await sup.restart(1); // frees the concurrency slot of the failed job, then starts again
    await until(() => runs === 2);
    expect(runs).toBe(2);
    await until(() => sup.status().state === "failed");
    await sup.stop();
  });

  it("times out a hung install and says so", async () => {
    const dir = tmpRepo(false);
    const spawn: SpawnFn = () => new FakeChild(); // never exits on its own; kill() emits exit
    const sup = new DevPreviewSupervisor({ cwd: dir, env: DEV_ENV, spawn, installTimeoutMs: 30, killGraceMs: 20, activityFile: join(dir, "a.jsonl") });
    await sup.start(1);
    await until(() => sup.status().state === "failed", 3000);
    expect(sup.status().error?.kind).toBe("timeout");
  });
});

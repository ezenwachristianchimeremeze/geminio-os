import { spawn as nodeSpawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RunnerControlPlane,
  type ExecutionPolicy,
  type ExecutionProvider,
  type RunnerJob,
  type RunnerJobState,
  SAFE_DEFAULT_EXECUTION_POLICY,
} from "../live-builder/control-plane";
import { appendActivity } from "./activity";
import { diagnoseFailure, OutputBuffer, parseOutputLine, redact, toPreviewState, type Diagnosis, type PreviewState } from "./states";

/**
 * Development preview supervisor.
 *
 * Runs the repository's OWN dev server (`pnpm dev`) so the developer can see the
 * real application. It is built on the existing runner control plane
 * (job states, leases, logs, concurrency) and the `ExecutionProvider` interface.
 * It is NOT a general command runner: the three commands below are the only
 * things it can ever execute, and no request input reaches a command line.
 */
export const PREVIEW_COMMANDS = {
  install: ["pnpm", "install", "--frozen-lockfile"],
  build: ["pnpm", "build"],
  run: ["pnpm", "dev"],
} as const;

export type ChildLike = {
  pid?: number;
  stdout: { on(event: "data", cb: (chunk: Buffer | string) => void): unknown } | null;
  stderr: { on(event: "data", cb: (chunk: Buffer | string) => void): unknown } | null;
  on(event: "exit", cb: (code: number | null, signal: string | null) => void): unknown;
  on(event: "error", cb: (err: Error) => void): unknown;
  kill(signal?: string): boolean;
};
export type SpawnFn = (command: string, args: readonly string[], options: { cwd: string; env: Record<string, string | undefined>; detached: boolean }) => ChildLike;
export type ProbeFn = (url: string) => Promise<{ ok: boolean; status: number; json?: unknown }>;

export type PreviewDependencies = { database: "ok" | "unavailable" | "unknown"; databaseDetail: string | null };

export type PreviewStatus = {
  enabled: boolean;
  disabledReason: string | null;
  state: PreviewState;
  jobId: string | null;
  runnerState: RunnerJobState | null;
  phase: "idle" | "install" | "build" | "run";
  startedAt: string | null;
  updatedAt: string | null;
  previewUrl: string | null;
  apiPort: number | null;
  metroPort: number;
  revision: number;
  lastRebuildAt: string | null;
  version: { packageVersion: string | null; gitCommit: string | null; gitDirty: boolean | null };
  error: (Diagnosis & { phase: string; exitCode: number | null }) | null;
  warnings: string[];
  dependencies: PreviewDependencies;
  outputTail: string[];
  runner: { provider: "local-process"; policy: ExecutionPolicy; metrics: ReturnType<RunnerControlPlane["metrics"]> };
};

export type SupervisorOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  spawn?: SpawnFn;
  probe?: ProbeFn;
  activityFile?: string;
  installTimeoutMs?: number;
  buildTimeoutMs?: number;
  readyTimeoutMs?: number;
  probeIntervalMs?: number;
  killGraceMs?: number;
};

/** Gate + kill hook for the control plane. Only usable in a non-production developer environment. */
export class LocalProcessProvider implements ExecutionProvider {
  readonly name = "local-process" as const;
  private readonly killers = new Map<string, () => Promise<void>>();
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}
  get configured(): boolean { return this.disabledReason() === null; }
  disabledReason(): string | null {
    if (this.env.NODE_ENV === "production") return "Development preview is disabled when NODE_ENV=production.";
    if (this.env.GEMINIO_DEV_PREVIEW !== "1") return "Development preview is disabled. Set GEMINIO_DEV_PREVIEW=1 in a development environment to enable it.";
    return null;
  }
  async start(_job: RunnerJob, _policy: ExecutionPolicy) {
    const reason = this.disabledReason();
    return reason ? { status: "unavailable" as const, message: reason } : { status: "ready" as const, message: "Local development process provider is enabled." };
  }
  register(jobId: string, killer: () => Promise<void>) { this.killers.set(jobId, killer); }
  async stop(job: RunnerJob) {
    const k = this.killers.get(job.id);
    this.killers.delete(job.id);
    if (k) await k();
  }
}

const ACTIVE: RunnerJobState[] = ["created", "queued", "starting", "preparing", "building", "running", "ready", "retrying"];

const DEV_POLICY: ExecutionPolicy = { ...SAFE_DEFAULT_EXECUTION_POLICY, timeoutMs: 30 * 60_000, concurrentJobs: 1, processCount: 64, memoryMb: 4096, allowedNetworkHosts: ["127.0.0.1", "localhost"] };

function defaultSpawn(command: string, args: readonly string[], options: { cwd: string; env: Record<string, string | undefined>; detached: boolean }): ChildLike {
  return nodeSpawn(command, [...args], { cwd: options.cwd, env: options.env, detached: options.detached, shell: false, stdio: ["ignore", "pipe", "pipe"] }) as unknown as ChildLike;
}

const defaultProbe: ProbeFn = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    let json: unknown;
    if ((res.headers.get("content-type") ?? "").includes("json")) json = await res.json().catch(() => undefined);
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
};

export class DevPreviewSupervisor {
  readonly provider: LocalProcessProvider;
  readonly controlPlane: RunnerControlPlane;
  private readonly opts: Required<Omit<SupervisorOptions, "spawn" | "probe" | "env">> & { spawn: SpawnFn; probe: ProbeFn; env: NodeJS.ProcessEnv };
  private job: RunnerJob | null = null;
  private phase: PreviewStatus["phase"] = "idle";
  private child: ChildLike | null = null;
  private stopRequested = false;
  private output = new OutputBuffer();
  private startedAt: string | null = null;
  private apiPort: number | null = null;
  private revision = 0;
  private lastRebuildAt: string | null = null;
  private error: PreviewStatus["error"] = null;
  private warnings = new Set<string>();
  private dependencies: PreviewDependencies = { database: "unknown", databaseDetail: null };
  private version: PreviewStatus["version"] = { packageVersion: null, gitCommit: null, gitDirty: null };
  private seenServerListening = false;
  private runToken = 0;

  constructor(options: SupervisorOptions = {}) {
    const cwd = options.cwd ?? process.cwd();
    const env = options.env ?? process.env;
    this.provider = new LocalProcessProvider(env);
    this.controlPlane = new RunnerControlPlane(DEV_POLICY, [this.provider]);
    this.opts = {
      cwd,
      env,
      spawn: options.spawn ?? defaultSpawn,
      probe: options.probe ?? defaultProbe,
      activityFile: options.activityFile ?? join(cwd, ".geminio", "dev-activity.jsonl"),
      installTimeoutMs: options.installTimeoutMs ?? 10 * 60_000,
      buildTimeoutMs: options.buildTimeoutMs ?? 5 * 60_000,
      readyTimeoutMs: options.readyTimeoutMs ?? 3 * 60_000,
      probeIntervalMs: options.probeIntervalMs ?? 1000,
      killGraceMs: options.killGraceMs ?? 5000,
    };
  }

  private get metroPort(): number {
    const n = Number(this.opts.env.EXPO_PORT ?? 8081);
    return Number.isInteger(n) && n > 0 && n < 65536 ? n : 8081;
  }

  private log(level: "info" | "warning" | "error", message: string, detail?: string) {
    try { appendActivity(this.opts.activityFile, { source: "supervisor", level, message, detail }); } catch { /* logging must never break the supervisor */ }
  }

  private previewUrl(): string | null {
    if (!this.job || !["running", "ready"].includes(this.job.state)) return null;
    const override = this.opts.env.GEMINIO_DEV_PREVIEW_PUBLIC_URL;
    if (override) {
      try {
        const u = new URL(override);
        if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
      } catch { /* fall through to localhost */ }
    }
    return `http://localhost:${this.metroPort}`;
  }

  private readVersion() {
    let packageVersion: string | null = null;
    try { packageVersion = (JSON.parse(readFileSync(join(this.opts.cwd, "package.json"), "utf8")) as { version?: string }).version ?? null; } catch { /* no package.json */ }
    let gitCommit: string | null = null;
    let gitDirty: boolean | null = null;
    if (existsSync(join(this.opts.cwd, ".git"))) {
      const rev = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: this.opts.cwd, encoding: "utf8" });
      if (rev.status === 0) gitCommit = rev.stdout.trim();
      const st = spawnSync("git", ["status", "--porcelain"], { cwd: this.opts.cwd, encoding: "utf8" });
      if (st.status === 0) gitDirty = st.stdout.trim().length > 0;
    }
    this.version = { packageVersion, gitCommit, gitDirty };
  }

  status(): PreviewStatus {
    const disabledReason = this.provider.disabledReason();
    return {
      enabled: disabledReason === null,
      disabledReason,
      state: toPreviewState(this.job?.state ?? null),
      jobId: this.job?.id ?? null,
      runnerState: this.job?.state ?? null,
      phase: this.phase,
      startedAt: this.startedAt,
      updatedAt: this.job?.updatedAt ?? null,
      previewUrl: this.previewUrl(),
      apiPort: this.apiPort,
      metroPort: this.metroPort,
      revision: this.revision,
      lastRebuildAt: this.lastRebuildAt,
      version: this.version,
      error: this.error,
      warnings: [...this.warnings],
      dependencies: this.dependencies,
      outputTail: this.output.tail(60),
      runner: { provider: "local-process", policy: this.controlPlane.policySnapshot(), metrics: this.controlPlane.metrics() },
    };
  }

  /** Idempotent: returns the existing session if one is active. */
  async start(userId: number): Promise<PreviewStatus> {
    const gate = await this.provider.start({} as RunnerJob, DEV_POLICY);
    if (gate.status !== "ready") throw new Error(gate.message);
    if (this.job && ACTIVE.includes(this.job.state)) return this.status();
    this.releaseTerminal();

    this.output.clear();
    this.error = null;
    this.warnings.clear();
    this.apiPort = null;
    this.seenServerListening = false;
    this.dependencies = { database: "unknown", databaseDetail: null };
    this.stopRequested = false;
    this.startedAt = new Date().toISOString();
    this.readVersion();
    const token = ++this.runToken;

    const created = this.controlPlane.createJob({ userId, projectId: "geminio-os-dev-preview", maxAttempts: 1 });
    this.controlPlane.queue(created.id);
    this.job = this.controlPlane.start(created.id, "local-process", "dev-preview-supervisor");
    this.provider.register(created.id, () => this.killChild());
    this.log("info", "Preview requested", `commit=${this.version.gitCommit ?? "n/a"} dirty=${this.version.gitDirty ?? "n/a"}`);
    void this.pipeline(token).catch((error) => this.fail(token, "run", error instanceof Error ? error.message : String(error), null));
    return this.status();
  }

  async stop(): Promise<PreviewStatus> {
    this.stopRequested = true;
    this.runToken += 1; // invalidates any in-flight pipeline continuation
    const job = this.job;
    if (job && ACTIVE.includes(job.state)) {
      this.log("info", "Stopping preview");
      try {
        this.job = job.state === "ready" || job.state === "running" ? this.controlPlane.mark(job.id, "stopping") : this.controlPlane.cancel(job.id);
        if (this.job.state === "cancel_requested") this.job = this.controlPlane.mark(job.id, "stopping");
      } catch { /* already terminal */ }
      await this.provider.stop(job);
      this.child = null;
      try {
        this.job = this.controlPlane.mark(job.id, job.state === "ready" || job.state === "running" ? "completed" : "cancelled");
        this.job = this.controlPlane.cleanup(job.id);
      } catch { /* ignore */ }
      this.phase = "idle";
      this.log("info", "Preview stopped");
    }
    return this.status();
  }

  async restart(userId: number): Promise<PreviewStatus> {
    await this.stop();
    return this.start(userId);
  }

  /** Manual refresh: bumps the revision so clients reload the preview frame. */
  refresh(): PreviewStatus {
    if (this.job && ["running", "ready"].includes(this.job.state)) {
      this.revision += 1;
      this.lastRebuildAt = new Date().toISOString();
      this.log("info", "Manual preview refresh", `revision=${this.revision}`);
    }
    return this.status();
  }

  // ---- internals ---------------------------------------------------------

  /** Release the control-plane lease of a finished job so the user's concurrency slot is freed. */
  private releaseTerminal() {
    if (this.job && !ACTIVE.includes(this.job.state) && this.job.state !== "cleaned") {
      try { this.job = this.controlPlane.cleanup(this.job.id); } catch { /* not cleanable from this state */ }
    }
  }

  private async pipeline(token: number) {
    const job = this.job!;
    const needsInstall = !existsSync(join(this.opts.cwd, "node_modules"));
    if (needsInstall) {
      this.phase = "install";
      this.job = this.controlPlane.prepare(job.id);
      this.log("info", "Installing dependencies", PREVIEW_COMMANDS.install.join(" "));
      const r = await this.runToCompletion(PREVIEW_COMMANDS.install, this.opts.installTimeoutMs, token);
      if (token !== this.runToken) return;
      if (r.exitCode !== 0) return this.fail(token, "install", this.output.text(), r.exitCode, r.timedOut);
      this.job = this.controlPlane.build(job.id);
    } else {
      this.job = this.controlPlane.prepare(job.id);
      this.job = this.controlPlane.build(job.id);
      this.log("info", "node_modules present; skipping install");
    }
    this.phase = "build";
    this.log("info", "Building", PREVIEW_COMMANDS.build.join(" "));
    const b = await this.runToCompletion(PREVIEW_COMMANDS.build, this.opts.buildTimeoutMs, token);
    if (token !== this.runToken) return;
    if (b.exitCode !== 0) return this.fail(token, "build", this.output.text(), b.exitCode, b.timedOut);

    this.phase = "run";
    this.job = this.controlPlane.mark(job.id, "running");
    this.log("info", "Starting development server", PREVIEW_COMMANDS.run.join(" "));
    this.launchDevServer(token);
    await this.waitUntilReady(token);
  }

  private runToCompletion(cmd: readonly string[], timeoutMs: number, token: number): Promise<{ exitCode: number | null; timedOut: boolean }> {
    return new Promise((resolve) => {
      const child = this.opts.spawn(cmd[0], cmd.slice(1), { cwd: this.opts.cwd, env: { ...this.opts.env, CI: "1" }, detached: true });
      this.child = child;
      let timedOut = false;
      let done = false;
      const finish = (exitCode: number | null) => { if (done) return; done = true; clearTimeout(timer); this.child = null; resolve({ exitCode, timedOut }); };
      const timer = setTimeout(() => { timedOut = true; void this.killChild(); }, timeoutMs);
      const onData = (chunk: Buffer | string) => { if (token === this.runToken) this.output.push(chunk.toString()); };
      child.stdout?.on("data", onData);
      child.stderr?.on("data", onData);
      child.on("error", (err) => { this.output.push(`spawn error: ${err.message}`); finish(null); });
      child.on("exit", (code) => finish(code));
    });
  }

  private launchDevServer(token: number) {
    const child = this.opts.spawn(PREVIEW_COMMANDS.run[0], PREVIEW_COMMANDS.run.slice(1), { cwd: this.opts.cwd, env: { ...this.opts.env, NODE_ENV: "development", CI: "1" }, detached: true });
    this.child = child;
    const onData = (chunk: Buffer | string) => {
      if (token !== this.runToken) return;
      for (const line of this.output.push(chunk.toString())) {
        const sig = parseOutputLine(line);
        if (!sig) continue;
        if (sig.type === "server_listening") {
          if (this.seenServerListening) this.bump("API server restarted after a source change");
          this.seenServerListening = true;
          this.apiPort = sig.port;
        } else if (sig.type === "web_bundled") {
          if (this.job && this.job.state === "ready") this.bump("Web bundle rebuilt");
        } else if (sig.type === "bundle_error") {
          this.warnings.add(`Bundle error: ${sig.message}`);
          this.log("error", "Bundle error", sig.message);
        }
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", (err) => this.fail(token, "run", `spawn error: ${err.message}`, null));
    child.on("exit", (code, signal) => {
      if (token !== this.runToken || this.stopRequested) return;
      this.fail(token, "run", this.output.text(), code, false, signal);
    });
  }

  private bump(message: string) {
    this.revision += 1;
    this.lastRebuildAt = new Date().toISOString();
    this.warnings.clear(); // a successful rebuild supersedes earlier bundle errors
    this.log("info", message, `revision=${this.revision}`);
  }

  private async waitUntilReady(token: number) {
    const deadline = Date.now() + this.opts.readyTimeoutMs;
    while (token === this.runToken && Date.now() < deadline) {
      const metro = await this.opts.probe(`http://127.0.0.1:${this.metroPort}/`).catch(() => ({ ok: false, status: 0 }));
      let apiOk = false;
      if (this.apiPort) {
        const api = await this.opts.probe(`http://127.0.0.1:${this.apiPort}/api/health/ready`).catch(() => ({ ok: false, status: 0, json: undefined as unknown }));
        const body = (api.json ?? {}) as { db?: { ok?: boolean; reason?: string } };
        apiOk = api.status === 200 || api.status === 503; // 503 = API up, a dependency is down
        if (body.db) {
          this.dependencies = body.db.ok ? { database: "ok", databaseDetail: null } : { database: "unavailable", databaseDetail: body.db.reason ?? "Database check failed." };
        }
      }
      if (token !== this.runToken) return;
      if (this.dependencies.database === "unavailable") this.warnings.add("Database unavailable");
      else this.warnings.delete("Database unavailable");
      if (metro.ok && apiOk && this.job && this.job.state === "running" && this.dependencies.database === "ok") {
        this.job = this.controlPlane.ready(this.job.id);
        this.log("info", "Preview ready", `metro=${this.metroPort} api=${this.apiPort}`);
        return;
      }
      await new Promise((r) => setTimeout(r, this.opts.probeIntervalMs));
    }
    if (token === this.runToken && this.job && this.job.state === "running") {
      // Still running but never fully healthy: say so instead of claiming ready.
      this.warnings.add(`Not ready after ${Math.round(this.opts.readyTimeoutMs / 1000)}s (metro/API/database health not all confirmed).`);
      this.log("warning", "Preview did not reach ready", [...this.warnings].join("; "));
    }
  }

  private fail(token: number, phase: "install" | "build" | "run", output: string, exitCode: number | null, timedOut = false, signal: string | null = null) {
    if (token !== this.runToken || !this.job || !ACTIVE.includes(this.job.state)) return;
    const diagnosis: Diagnosis = timedOut
      ? { kind: "timeout", title: `${phase} timed out`, hint: `The ${phase} step exceeded its time limit and was terminated.` }
      : diagnoseFailure(phase, output, exitCode);
    const text = signal ? `${diagnosis.hint} (signal ${signal})` : diagnosis.hint;
    this.error = { ...diagnosis, hint: text, phase, exitCode };
    try { this.job = this.controlPlane.mark(this.job.id, timedOut ? "timeout" : "failed", `${diagnosis.title}: ${text}`.slice(0, 500)); } catch { /* terminal */ }
    void this.killChild();
    this.log("error", diagnosis.title, redact(output).split("\n").slice(-8).join("\n"));
  }

  private async killChild(): Promise<void> {
    const child = this.child;
    this.child = null;
    if (!child) return;
    const send = (sig: "SIGTERM" | "SIGKILL") => {
      try { if (child.pid && process.platform !== "win32") process.kill(-child.pid, sig); else child.kill(sig); } catch { try { child.kill(sig); } catch { /* gone */ } }
    };
    send("SIGTERM");
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => { send("SIGKILL"); resolve(); }, this.opts.killGraceMs);
      child.on("exit", () => { clearTimeout(t); resolve(); });
    });
  }
}

let singleton: DevPreviewSupervisor | null = null;
export function getDevPreviewSupervisor(): DevPreviewSupervisor {
  if (!singleton) singleton = new DevPreviewSupervisor();
  return singleton;
}

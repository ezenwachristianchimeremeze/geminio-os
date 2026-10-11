import { randomUUID } from "node:crypto";

export const RUNNER_JOB_STATES = [
  "created", "queued", "starting", "preparing", "building", "running", "ready",
  "stopping", "completed", "failed", "retrying", "cancel_requested", "cancelled",
  "timeout", "forced_stop", "cleaned",
] as const;
export type RunnerJobState = (typeof RUNNER_JOB_STATES)[number];

export type RunnerJob = {
  id: string;
  userId: number;
  projectId: string;
  versionId: string | null;
  runtimeSessionId: string | null;
  state: RunnerJobState;
  attempt: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  leaseExpiresAt: string | null;
  workerId: string | null;
  lastError: string | null;
};

export type ExecutionPolicy = {
  cpuMillis: number;
  memoryMb: number;
  diskMb: number;
  timeoutMs: number;
  processCount: number;
  outputBytes: number;
  concurrentJobs: number;
  allowedNetworkHosts: string[];
};

export const SAFE_DEFAULT_EXECUTION_POLICY: ExecutionPolicy = {
  cpuMillis: 500,
  memoryMb: 512,
  diskMb: 1024,
  timeoutMs: 120_000,
  processCount: 32,
  outputBytes: 1_000_000,
  concurrentJobs: 2,
  allowedNetworkHosts: [],
};

export type ExecutionLog = {
  id: string;
  jobId: string;
  projectId: string;
  versionId: string | null;
  phase: RunnerJobState;
  severity: "info" | "warning" | "error";
  workerId: string | null;
  message: string;
  errorCode: string | null;
  diagnostics: Record<string, unknown>;
  createdAt: string;
};

export type WorkerLease = {
  workerId: string;
  jobId: string;
  expiresAt: string;
};

export interface ExecutionProvider {
  readonly name: "development" | "container" | "microvm" | "local-process";
  readonly configured: boolean;
  start(job: RunnerJob, policy: ExecutionPolicy): Promise<{ status: "ready" | "unavailable" | "failed"; message: string }>;
  stop(job: RunnerJob): Promise<void>;
}

export class DevelopmentProvider implements ExecutionProvider {
  readonly name = "development" as const;
  readonly configured = true;
  async start(_job: RunnerJob, _policy: ExecutionPolicy) {
    return { status: "ready" as const, message: "Controlled declarative development provider is ready; generated source was not executed." };
  }
  async stop(_job: RunnerJob) { return undefined; }
}

export class ContainerProvider implements ExecutionProvider {
  readonly name = "container" as const;
  readonly configured: boolean;
  constructor(configured = Boolean(process.env.GEMINIO_CONTAINER_RUNNER_URL)) { this.configured = configured; }
  async start(_job: RunnerJob, _policy: ExecutionPolicy) {
    if (!this.configured) return { status: "unavailable" as const, message: "An isolated executable runner is not configured in this environment." };
    return { status: "unavailable" as const, message: "Container control-plane integration is configured but no provider adapter is enabled in this environment." };
  }
  async stop(_job: RunnerJob) { return undefined; }
}

export class MicroVMProvider implements ExecutionProvider {
  readonly name = "microvm" as const;
  readonly configured: boolean;
  constructor(configured = Boolean(process.env.GEMINIO_MICROVM_RUNNER_URL)) { this.configured = configured; }
  async start(_job: RunnerJob, _policy: ExecutionPolicy) {
    if (!this.configured) return { status: "unavailable" as const, message: "An isolated executable runner is not configured in this environment." };
    return { status: "unavailable" as const, message: "MicroVM control-plane integration is configured but no provider adapter is enabled in this environment." };
  }
  async stop(_job: RunnerJob) { return undefined; }
}

const TRANSITIONS: Record<RunnerJobState, RunnerJobState[]> = {
  created: ["queued", "cancel_requested"],
  queued: ["starting", "cancel_requested", "cancelled"],
  starting: ["preparing", "failed", "cancel_requested", "timeout"],
  preparing: ["building", "failed", "cancel_requested", "timeout"],
  building: ["running", "ready", "failed", "cancel_requested", "timeout"],
  running: ["ready", "stopping", "failed", "cancel_requested", "timeout"],
  ready: ["running", "stopping", "completed", "failed", "cancel_requested"],
  stopping: ["completed", "cancelled", "forced_stop", "failed"],
  completed: ["cleaned"],
  failed: ["retrying", "cleaned"],
  retrying: ["preparing", "queued", "failed", "cleaned"],
  cancel_requested: ["stopping", "cancelled", "forced_stop"],
  cancelled: ["cleaned"],
  timeout: ["forced_stop", "cleaned"],
  forced_stop: ["cleaned", "failed"],
  cleaned: [],
};

export function canTransitionRunnerJob(from: RunnerJobState, to: RunnerJobState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transitionRunnerJob(job: RunnerJob, next: RunnerJobState, error: string | null = null): RunnerJob {
  if (!canTransitionRunnerJob(job.state, next)) throw new Error(`Invalid runner job transition: ${job.state} -> ${next}`);
  const now = new Date().toISOString();
  return { ...job, state: next, updatedAt: now, lastError: error ?? job.lastError };
}

export class WorkerRegistry {
  private readonly leases = new Map<string, WorkerLease>();
  register(workerId: string, jobId: string, leaseMs: number): WorkerLease {
    const lease = { workerId, jobId, expiresAt: new Date(Date.now() + leaseMs).toISOString() };
    this.leases.set(jobId, lease);
    return lease;
  }
  heartbeat(jobId: string, leaseMs: number): WorkerLease | null {
    const current = this.leases.get(jobId);
    if (!current) return null;
    const lease = { ...current, expiresAt: new Date(Date.now() + leaseMs).toISOString() };
    this.leases.set(jobId, lease);
    return lease;
  }
  release(jobId: string) { this.leases.delete(jobId); }
  expired(now = Date.now()): WorkerLease[] {
    return [...this.leases.values()].filter((lease) => Date.parse(lease.expiresAt) <= now);
  }
}

export class RunnerControlPlane {
  private readonly jobs = new Map<string, RunnerJob>();
  private readonly logs = new Map<string, ExecutionLog[]>();
  private readonly registry = new WorkerRegistry();
  private readonly activeByUser = new Map<number, number>();
  constructor(
    private readonly policy: ExecutionPolicy = SAFE_DEFAULT_EXECUTION_POLICY,
    private readonly providers: ExecutionProvider[] = [new DevelopmentProvider(), new ContainerProvider(), new MicroVMProvider()],
  ) {}

  createJob(input: { userId: number; projectId: string; versionId?: string | null; runtimeSessionId?: string | null; maxAttempts?: number }): RunnerJob {
    const job: RunnerJob = { id: `runner_job_${randomUUID()}`, userId: input.userId, projectId: input.projectId, versionId: input.versionId ?? null, runtimeSessionId: input.runtimeSessionId ?? null, state: "created", attempt: 0, maxAttempts: input.maxAttempts ?? 3, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), leaseExpiresAt: null, workerId: null, lastError: null };
    this.jobs.set(job.id, job);
    this.log(job, "info", "created", "Runner job created behind the control-plane boundary.");
    return job;
  }

  queue(jobId: string): RunnerJob { return this.update(jobId, "queued"); }
  start(jobId: string, providerName: ExecutionProvider["name"] = "development", workerId = "development-worker"): RunnerJob {
    let job = this.update(jobId, "starting");
    const active = this.activeByUser.get(job.userId) ?? 0;
    if (active >= this.policy.concurrentJobs) throw new Error("Runner concurrency quota exceeded.");
    this.activeByUser.set(job.userId, active + 1);
    job = { ...job, attempt: job.attempt + 1, workerId, leaseExpiresAt: new Date(Date.now() + this.policy.timeoutMs).toISOString() };
    this.jobs.set(job.id, job);
    this.registry.register(workerId, job.id, this.policy.timeoutMs);
    this.log(job, "info", "starting", `Runner worker ${workerId} leased job using ${providerName} provider.`);
    return job;
  }
  prepare(jobId: string): RunnerJob { return this.update(jobId, "preparing"); }
  build(jobId: string): RunnerJob { return this.update(jobId, "building"); }
  ready(jobId: string): RunnerJob { return this.update(jobId, "ready"); }
  mark(jobId: string, next: RunnerJobState, error: string | null = null): RunnerJob { return this.update(jobId, next, error); }
  cancel(jobId: string): RunnerJob {
    const job = this.get(jobId);
    if (["created", "queued"].includes(job.state)) return this.update(jobId, "cancelled");
    return this.update(jobId, "cancel_requested");
  }
  retry(jobId: string): RunnerJob {
    const job = this.get(jobId);
    if (job.state !== "failed" || job.attempt >= job.maxAttempts) throw new Error("Runner job cannot be retried.");
    return this.update(jobId, "retrying");
  }
  timeout(jobId: string): RunnerJob {
    const job = this.get(jobId);
    const timedOut = this.update(jobId, "timeout", "Runner execution exceeded its configured timeout.");
    this.log(timedOut, "error", "timeout", timedOut.lastError ?? "Runner timeout");
    return timedOut;
  }
  cleanup(jobId: string): RunnerJob {
    const job = this.get(jobId);
    this.registry.release(jobId);
    this.activeByUser.set(job.userId, Math.max(0, (this.activeByUser.get(job.userId) ?? 1) - 1));
    return this.update(jobId, "cleaned");
  }
  recoverExpiredLeases(now = Date.now()): RunnerJob[] {
    return this.registry.expired(now).map((lease) => {
      const job = this.get(lease.jobId);
      const crashed = this.update(job.id, "failed", "Worker lease expired; execution was marked failed without changing project files.");
      this.registry.release(job.id);
      return crashed;
    });
  }
  get(jobId: string): RunnerJob { const job = this.jobs.get(jobId); if (!job) throw new Error("Runner job not found"); return job; }
  getLogs(jobId: string): ExecutionLog[] { return this.logs.get(jobId) ?? []; }
  metrics() { const jobs = [...this.jobs.values()]; return { queueDepth: jobs.filter((job) => job.state === "queued").length, activeJobs: jobs.filter((job) => ["starting", "preparing", "building", "running", "ready"].includes(job.state)).length, failures: jobs.filter((job) => job.state === "failed").length, timeouts: jobs.filter((job) => job.state === "timeout").length, cleaned: jobs.filter((job) => job.state === "cleaned").length }; }
  assertNetworkAllowed(host: string): boolean { return this.policy.allowedNetworkHosts.includes(host); }
  policySnapshot(): ExecutionPolicy { return { ...this.policy, allowedNetworkHosts: [...this.policy.allowedNetworkHosts] }; }
  issueScopedSecret(scope: string, ttlMs = 60_000) { return { token: `scoped_${randomUUID()}`, scope, expiresAt: new Date(Date.now() + ttlMs).toISOString(), exposedTo: "isolated-runner-only" as const }; }

  private update(jobId: string, next: RunnerJobState, error: string | null = null): RunnerJob {
    const current = this.get(jobId);
    const updated = transitionRunnerJob(current, next, error);
    this.jobs.set(jobId, updated);
    this.log(updated, next === "failed" || next === "timeout" ? "error" : "info", next, error ?? `Runner job entered ${next}.`);
    return updated;
  }
  private log(job: RunnerJob, severity: ExecutionLog["severity"], phase: RunnerJobState, message: string, errorCode: string | null = null) {
    const log: ExecutionLog = { id: `exec_log_${randomUUID()}`, jobId: job.id, projectId: job.projectId, versionId: job.versionId, phase, severity, workerId: job.workerId, message, errorCode, diagnostics: {}, createdAt: new Date().toISOString() };
    this.logs.set(job.id, [...(this.logs.get(job.id) ?? []), log]);
  }
}

/** Shared process-local control-plane facade. Durable job records are persisted
 * by the database schema; this facade owns scheduling decisions and leases. */
export const defaultRunnerControlPlane = new RunnerControlPlane();

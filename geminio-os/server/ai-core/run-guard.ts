/**
 * Stale-worker protection for run execution: compare-and-set transitions + a FENCING TOKEN.
 *
 * Problem 1 (TOCTOU): a worker reads a run, the user cancels/pauses it, and the worker then writes "executing"/"completed"
 * unconditionally, resurrecting a cancelled run. Every worker transition is a compare-and-set on the expected status.
 *
 * Problem 2 (zombie worker): a worker's job lease expires (slow provider call, GC pause, network partition), the job is
 * re-queued and a second worker claims it. The first worker is still alive and would later overwrite the newer worker's
 * progress/result. Each claim therefore increments `orchestrationRuns.fence` in the same statement that moves the run to
 * "executing" and returns the new value; every later write by that worker must include `AND fence = <mine>`. A superseded
 * worker's writes match zero rows, it learns it is stale, and stops WITHOUT answering, charging or notifying.
 *
 * Pure logic over a port, so the interleavings are testable; the MySQL port is `UPDATE ... WHERE id=? AND status IN (...) [AND fence=?]`
 * and reports affectedRows === 1.
 */
export type RunStatus = "accepted" | "planning" | "executing" | "waiting_for_approval" | "paused" | "verifying" | "completed" | "failed" | "cancelled";
export type JobStatus = "queued" | "leased" | "running" | "succeeded" | "cancelled" | "failed" | "dead_letter";

export interface RunGuardPort {
  /** Atomically: if status in `from`, set status "executing", fence = fence + 1 and return the NEW fence; otherwise null. */
  claimRun(from: RunStatus[]): Promise<number | null>;
  /** Atomically move the run to `patch.status` only if status in `from` AND (fence === undefined || fence matches). True if THIS call changed it. */
  casRun(from: RunStatus[], fence: number | undefined, patch: { status?: RunStatus } & Record<string, unknown>): Promise<boolean>;
  casJob(from: JobStatus[], patch: { status: JobStatus } & Record<string, unknown>): Promise<boolean>;
  readRunStatus(): Promise<RunStatus | null>;
}

/** A user-triggered run control (cancel/pause/resume/retry) that is invalid for the run's current state. Mapped to NOT_FOUND / PRECONDITION_FAILED by the API layer, never to a 500. */
export class RunStateError extends Error {
  constructor(readonly code: "NOT_FOUND" | "INVALID_STATE" | "UNAVAILABLE", message: string) { super(message); this.name = "RunStateError"; }
}

/** Pure mapping used by every router that exposes run controls. */
export function runStateErrorToTrpcCode(e: unknown): "NOT_FOUND" | "PRECONDITION_FAILED" | "SERVICE_UNAVAILABLE" | null {
  if (!(e instanceof RunStateError)) return null;
  return e.code === "NOT_FOUND" ? "NOT_FOUND" : e.code === "UNAVAILABLE" ? "SERVICE_UNAVAILABLE" : "PRECONDITION_FAILED";
}

export class StaleWorkerError extends Error {
  readonly retryable = false;
  constructor() { super("This worker no longer owns the run (it was cancelled, paused or taken over)."); this.name = "StaleWorkerError"; }
}

export type ClaimResult = { claimed: true; fence: number } | { claimed: false; reason: "cancelled" | "paused" | "finished" | "missing" };

export const STARTABLE_RUN: RunStatus[] = ["accepted", "planning", "executing"];
export const APPROVED_RESUME_RUN: RunStatus[] = ["waiting_for_approval"];
const STARTABLE_JOB: JobStatus[] = ["queued", "leased", "running"];

/** Claim the right to execute. Never overwrites cancelled/paused/terminal state. Returns the fencing token on success. */
export async function claimForExecution(port: RunGuardPort, opts: { jobPatch?: Record<string, unknown>; from?: RunStatus[] } = {}): Promise<ClaimResult> {
  const fence = await port.claimRun(opts.from ?? STARTABLE_RUN);
  if (fence === null) return { claimed: false, reason: await whyNotClaimable(port) };
  if (!(await port.casJob(STARTABLE_JOB, { status: "running", ...(opts.jobPatch ?? {}) }))) {
    // The job was cancelled/finished between the two writes: give the run back (only if we still own it).
    await port.casRun(["executing"], fence, { status: "cancelled" }).catch(() => false);
    return { claimed: false, reason: "cancelled" };
  }
  return { claimed: true, fence };
}

async function whyNotClaimable(port: RunGuardPort): Promise<"cancelled" | "paused" | "finished" | "missing"> {
  const s = await port.readRunStatus();
  if (s === null) return "missing";
  if (s === "cancelled") return "cancelled";
  if (s === "paused") return "paused";
  return "finished";
}

/** A fenced write that must succeed or the worker is stale: throws StaleWorkerError so the step loop unwinds. */
export async function fencedWrite(port: RunGuardPort, fence: number, patch: Record<string, unknown>, from: RunStatus[] = ["executing"]): Promise<void> {
  if (!(await port.casRun(from, fence, patch))) throw new StaleWorkerError();
}

export type FinishResult = { applied: true } | { applied: false; currentStatus: RunStatus | null };

/** Finish only if this worker still owns a run that is executing/verifying. Otherwise do NOT overwrite and do NOT settle/notify. */
export async function finishIfStillRunning(port: RunGuardPort, fence: number, patch: { status: "completed" | "failed" } & Record<string, unknown>): Promise<FinishResult> {
  if (await port.casRun(["executing", "verifying"], fence, patch)) return { applied: true };
  return { applied: false, currentStatus: await port.readRunStatus() };
}

/**
 * Idempotent submit: the same (user, requestId) must never create a second conversation, message, task or job.
 * "replay" returns the original run; "conflict" means the id was reused for a different message.
 */
export function classifyDuplicateSubmit(existing: { input: string } | null, message: string): "new" | "replay" | "conflict" {
  if (!existing) return "new";
  return existing.input === message ? "replay" : "conflict";
}

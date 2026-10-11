/**
 * Approval and agent-task writes with ownership enforced BY THE WRITE (a conditional UPDATE), never by a check before or after it.
 * The port is implemented by Drizzle/MySQL in server/geminio-data.ts and by SQLite in tests/helpers/sqlite-approval-store.ts.
 */
export type ApprovalDecision = "approved" | "rejected";
export type ApprovalRow = { id: string; taskId: string; userId: number; action: string; summary: string; status: "pending" | "approved" | "rejected" | "expired"; requestedAt: Date; resolvedAt: Date | null };

export interface ApprovalStore {
  /** `UPDATE taskApprovals SET status=?, resolvedAt=? WHERE id=? AND userId=? AND status='pending'`; returns the number of rows changed (0 or 1). */
  resolvePending(userId: number, id: string, status: ApprovalDecision, at: Date): Promise<number>;
  /** Owner-scoped read. */
  get(userId: number, id: string): Promise<ApprovalRow | null>;
}

export type ResolveOutcome =
  | { kind: "resolved"; approval: ApprovalRow }   // this call made the decision: the ONLY outcome that may trigger side effects
  | { kind: "already"; approval: ApprovalRow }    // same decision was already recorded (idempotent retry): no side effects
  | { kind: "conflict"; approval: ApprovalRow }   // a different decision was already recorded: unchanged
  | { kind: "not_found" };                        // unknown id, or someone else's: indistinguishable on purpose

export async function resolveApprovalOnce(store: ApprovalStore, userId: number, id: string, decision: ApprovalDecision, now: Date = new Date()): Promise<ResolveOutcome> {
  const changed = await store.resolvePending(userId, id, decision, now);
  const row = await store.get(userId, id);
  if (!row) return { kind: "not_found" };
  if (changed === 1) return { kind: "resolved", approval: row };
  return row.status === decision ? { kind: "already", approval: row } : { kind: "conflict", approval: row };
}

export type TaskPatch = Partial<{ state: string; progress: number; currentApprovalId: string | null; lastError: string | null; checkpoint: string | null }>;
export interface AgentTaskStore {
  /** `UPDATE agentTasks SET ... WHERE id=? AND userId=?`. Success is judged by an owner-scoped read afterwards, not by affectedRows (MySQL reports 0 for a no-op change). */
  updateOwned(userId: number, id: string, patch: TaskPatch, at: Date): Promise<void>;
  /** `UPDATE agentTasks SET ... WHERE id=? AND userId=? AND state=?` (compare-and-set on the state the caller validated); returns rows changed. A state change always changes the row, so 0 means "not yours or the state moved". */
  casState(userId: number, id: string, from: string, patch: TaskPatch & { state: string }, at: Date): Promise<number>;
  getOwned(userId: number, id: string): Promise<{ id: string; userId: number; state: string; progress: number; currentApprovalId: string | null; lastError: string | null; checkpoint: string | null } | null>;
}

export async function updateOwnedTask(store: AgentTaskStore, userId: number, id: string, patch: TaskPatch, now: Date = new Date()) {
  await store.updateOwned(userId, id, patch, now);
  return store.getOwned(userId, id);
}

/** Maps a non-success outcome to the API error the router must raise (code names match tRPC). */
export function approvalOutcomeError(o: ResolveOutcome): { code: "NOT_FOUND" | "CONFLICT"; message: string } | null {
  if (o.kind === "not_found") return { code: "NOT_FOUND", message: "Approval not found." };
  if (o.kind === "conflict") return { code: "CONFLICT", message: `This approval was already ${o.approval.status}.` };
  return null;
}

/**
 * Resolve an approval and, ONLY if this call made an "approved" decision, run `resume` (downstream task execution).
 * Denied (not_found), conflicting and repeated requests never reach `resume`.
 */
export async function resolveAndResume<T>(store: ApprovalStore, userId: number, id: string, decision: ApprovalDecision, resume: (approval: ApprovalRow) => Promise<T>, now: Date = new Date()): Promise<{ outcome: ResolveOutcome; resumed: T | null }> {
  const outcome = await resolveApprovalOnce(store, userId, id, decision, now);
  const resumed = outcome.kind === "resolved" && decision === "approved" ? await resume(outcome.approval) : null;
  return { outcome, resumed };
}

/** A validated state transition applied only if the task is still in the state that was validated (two clients cannot both win). */
export async function transitionOwnedTask(store: AgentTaskStore, userId: number, id: string, from: string, patch: TaskPatch & { state: string }, now: Date = new Date()): Promise<{ applied: true; task: NonNullable<Awaited<ReturnType<AgentTaskStore["getOwned"]>>> } | { applied: false }> {
  const changed = await store.casState(userId, id, from, patch, now);
  if (changed !== 1) return { applied: false };
  const task = await store.getOwned(userId, id);
  return task ? { applied: true, task } : { applied: false };
}

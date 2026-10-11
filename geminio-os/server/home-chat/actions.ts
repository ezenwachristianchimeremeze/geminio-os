/**
 * Approval-gated actions from Home chat. A consequential action is never executed by the request that proposes it:
 *   propose (server validates ownership + builds the card text) -> user Approve/Reject/Cancel -> CAS pending->approved -> execute -> result.
 * The card content (what happens, resource, consequences, credits) comes from the server-side registry, never from the client.
 * Every transition is audited. A proposal expires; a proposal can be executed at most once.
 */
export type ActionStatus = "pending" | "approved" | "rejected" | "cancelled" | "expired" | "executing" | "executed" | "failed";
export type ActionRow = { id: string; userId: number; type: string; resourceId: string; resourceLabel: string; summary: string; consequences: string[]; estimatedCredits: number; reversible: boolean; reversalNote: string; status: ActionStatus; result: unknown; error: string | null; params: Record<string, unknown>; expiresAt: Date; createdAt: Date; updatedAt: Date };

export type ActionDefinition = {
  type: string; label: string; estimatedCredits: number;
  reversible: boolean; reversalNote: string;
  /** Validates ownership/existence and returns the resource description. Throws ActionError("NOT_FOUND"|"INVALID"). */
  describe(userId: number, params: Record<string, unknown>): Promise<{ resourceId: string; resourceLabel: string; summary: string; consequences: string[]; params: Record<string, unknown> }>;
  /** Performs the action. Must re-check ownership itself. Absent => the action type cannot be executed at all. */
  execute?(userId: number, params: Record<string, unknown>): Promise<{ summary: string; data?: unknown }>;
  unavailableReason?: string;
};
export class ActionError extends Error { constructor(readonly code: "NOT_FOUND" | "INVALID" | "UNAVAILABLE" | "CONFLICT" | "EXPIRED", message: string) { super(message); this.name = "ActionError"; } }

export interface ActionStore {
  insert(row: ActionRow): Promise<void>;
  get(userId: number, id: string): Promise<ActionRow | null>;
  list(userId: number, limit: number): Promise<ActionRow[]>;
  countPending(userId: number): Promise<number>;
  /** CAS: update only if the current status equals `from`. */
  transition(userId: number, id: string, from: ActionStatus, to: ActionStatus, patch: Partial<Pick<ActionRow, "result" | "error">>, now: Date): Promise<boolean>;
}
export type AuditFn = (e: { userId: number; action: string; status: "success" | "error" | "warning"; details: Record<string, unknown> }) => Promise<void>;
export type ActionDeps = { store: ActionStore; registry: Record<string, ActionDefinition>; now: () => Date; newId: () => string; audit?: AuditFn; ttlMs?: number };
export const ACTION_TTL_MS = 15 * 60_000; export const MAX_PENDING = 5;

export async function proposeAction(d: ActionDeps, userId: number, input: { type: string; params: Record<string, unknown> }): Promise<ActionRow> {
  const def = d.registry[input.type];
  if (!def) throw new ActionError("INVALID", "Unknown action type.");
  if (!def.execute) throw new ActionError("UNAVAILABLE", def.unavailableReason ?? "This action isn't supported yet, so it can't be proposed.");
  if ((await d.store.countPending(userId)) >= MAX_PENDING) throw new ActionError("CONFLICT", "You have several actions waiting for a decision. Approve, reject or cancel them first.");
  const desc = await def.describe(userId, input.params); // throws NOT_FOUND for foreign/missing resources
  const now = d.now();
  const row: ActionRow = { id: d.newId(), userId, type: def.type, resourceId: desc.resourceId, resourceLabel: desc.resourceLabel.slice(0, 120), summary: desc.summary.slice(0, 300), consequences: desc.consequences.slice(0, 6).map((c) => c.slice(0, 200)), estimatedCredits: def.estimatedCredits, reversible: def.reversible, reversalNote: def.reversalNote, status: "pending", result: null, error: null, params: desc.params, expiresAt: new Date(+now + (d.ttlMs ?? ACTION_TTL_MS)), createdAt: now, updatedAt: now };
  await d.store.insert(row);
  await d.audit?.({ userId, action: "home.action.proposed", status: "success", details: { actionId: row.id, type: row.type, resource: row.resourceId } });
  return row;
}

async function load(d: ActionDeps, userId: number, id: string) {
  const row = await d.store.get(userId, id); if (!row) throw new ActionError("NOT_FOUND", "Action not found.");
  if (row.status === "pending" && row.expiresAt <= d.now()) { await d.store.transition(userId, id, "pending", "expired", {}, d.now()); await d.audit?.({ userId, action: "home.action.expired", status: "warning", details: { actionId: id } }); throw new ActionError("EXPIRED", "This approval request expired. Ask again if you still want it."); }
  return row;
}

export async function decideAction(d: ActionDeps, userId: number, id: string, decision: "approve" | "reject" | "cancel"): Promise<ActionRow> {
  const row = await load(d, userId, id);
  if (row.status !== "pending") throw new ActionError("CONFLICT", `This action is already ${row.status}.`);
  if (decision !== "approve") {
    const to = decision === "reject" ? "rejected" : "cancelled";
    if (!(await d.store.transition(userId, id, "pending", to, {}, d.now()))) throw new ActionError("CONFLICT", "This action was already decided.");
    await d.audit?.({ userId, action: `home.action.${to}`, status: "success", details: { actionId: id, type: row.type } });
    return (await d.store.get(userId, id))!;
  }
  // Approve: exactly one caller wins pending->executing; that caller executes. Re-approving can never execute twice.
  if (!(await d.store.transition(userId, id, "pending", "executing", {}, d.now()))) throw new ActionError("CONFLICT", "This action was already decided.");
  await d.audit?.({ userId, action: "home.action.approved", status: "success", details: { actionId: id, type: row.type, resource: row.resourceId } });
  const def = d.registry[row.type];
  try {
    if (!def?.execute) throw new ActionError("UNAVAILABLE", "This action can no longer be executed.");
    const out = await def.execute(userId, row.params);
    await d.store.transition(userId, id, "executing", "executed", { result: { summary: out.summary, data: out.data ?? null } }, d.now());
    await d.audit?.({ userId, action: "home.action.executed", status: "success", details: { actionId: id, type: row.type } });
  } catch (e) {
    const msg = (e instanceof Error ? e.message : "Execution failed.").slice(0, 300);
    await d.store.transition(userId, id, "executing", "failed", { error: msg }, d.now());
    await d.audit?.({ userId, action: "home.action.failed", status: "error", details: { actionId: id, type: row.type, message: msg } });
  }
  return (await d.store.get(userId, id))!;
}

/** Marks stale 'executing' rows (crash mid-execution) as failed so they can't be mistaken for done or silently re-run. */
export const EXECUTING_STALE_MS = 10 * 60_000;
export const clientView = (r: ActionRow) => ({ id: r.id, type: r.type, resourceLabel: r.resourceLabel, summary: r.summary, consequences: r.consequences, estimatedCredits: r.estimatedCredits, reversible: r.reversible, reversalNote: r.reversalNote, status: r.status, result: r.result, error: r.error, expiresAt: r.expiresAt, createdAt: r.createdAt });

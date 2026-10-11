/**
 * Execute-once AI operations. One authorized operation (user + idempotency key) runs the provider AT MOST ONCE successfully:
 *   - a persisted record is created first (unique per user+key), carrying an input hash;
 *   - a replay of a completed operation returns the persisted result: no provider call, no charge;
 *   - a concurrent duplicate gets IN_PROGRESS while the first attempt holds its lease;
 *   - a failed or crashed (lease-expired) attempt may be retried; each attempt has its own credit reservation;
 *   - the result is persisted INSIDE the metered call, so a persistence failure releases the credits instead of charging for lost work.
 */
import { createHash } from "node:crypto";
import { runMetered } from "./metered-llm";
import type { CreditStore } from "./ledger";

export type OpStatus = "running" | "completed" | "failed";
export type OperationRow = { id: string; userId: number; key: string; capability: string; inputHash: string; status: OpStatus; attempt: number; result: unknown; error: string | null; leaseUntil: Date; createdAt: Date; updatedAt: Date };
export const LEASE_MS = 3 * 60_000;

export interface OperationStore {
  /** Inserts the row; returns false if (userId, key) already exists. */
  insertIfAbsent(row: OperationRow): Promise<boolean>;
  get(userId: number, key: string): Promise<OperationRow | null>;
  getById(userId: number, id: string): Promise<OperationRow | null>;
  /** CAS: move failed/lease-expired running -> running with attempt+1 and a fresh lease. Returns the new attempt or null. */
  startAttempt(userId: number, key: string, expectedAttempt: number, now: Date): Promise<number | null>;
  /** CAS on (id, attempt, status=running). */
  complete(id: string, attempt: number, result: unknown, now: Date): Promise<boolean>;
  fail(id: string, attempt: number, error: string, now: Date): Promise<boolean>;
}

export class OperationError extends Error {
  constructor(readonly code: "IN_PROGRESS" | "KEY_REUSED" | "INVALID_KEY", message: string) { super(message); this.name = "OperationError"; }
}
export const KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;
export const hashInput = (v: unknown) => createHash("sha256").update(JSON.stringify(v) ?? "null").digest("hex");

export type OnceResult<T> = { replayed: boolean; operationId: string; result: T };

export async function executeOnce<T>(deps: { ops: OperationStore; credits: CreditStore; env: Record<string, string | undefined>; newId: () => string; now?: () => Date }, input: { userId: number; capability: string; key: string; inputHash: string }, fn: () => Promise<T>): Promise<OnceResult<T>> {
  if (!KEY_RE.test(input.key)) throw new OperationError("INVALID_KEY", "The idempotency key must be 8-64 letters, digits, '-' or '_'.");
  const now = deps.now ?? (() => new Date());
  const t0 = now();
  const fresh: OperationRow = { id: deps.newId(), userId: input.userId, key: input.key, capability: input.capability, inputHash: input.inputHash, status: "running", attempt: 1, result: null, error: null, leaseUntil: new Date(+t0 + LEASE_MS), createdAt: t0, updatedAt: t0 };
  let row = fresh; let attempt = 1;
  if (!(await deps.ops.insertIfAbsent(fresh))) {
    const existing = await deps.ops.get(input.userId, input.key);
    if (!existing) throw new OperationError("IN_PROGRESS", "Another request with this key is being processed. Try again shortly.");
    if (existing.inputHash !== input.inputHash || existing.capability !== input.capability) throw new OperationError("KEY_REUSED", "This idempotency key was already used for a different request.");
    if (existing.status === "completed") return { replayed: true, operationId: existing.id, result: existing.result as T };
    if (existing.status === "running" && existing.leaseUntil > t0) throw new OperationError("IN_PROGRESS", "This operation is already running. Fetch its result when it completes; you will not be charged twice.");
    const next = await deps.ops.startAttempt(input.userId, input.key, existing.attempt, t0);
    if (next === null) throw new OperationError("IN_PROGRESS", "Another request is retrying this operation.");
    row = existing; attempt = next;
  }
  try {
    const result = await runMetered(deps.credits, deps.env, { userId: input.userId, capability: input.capability, requestId: `op:${row.id}:${attempt}`.slice(0, 64) }, async () => {
      const r = await fn();
      if (!(await deps.ops.complete(row.id, attempt, r, now()))) throw new Error("The operation record changed during execution; result discarded and credits released.");
      return r;
    });
    return { replayed: false, operationId: row.id, result };
  } catch (e) {
    await deps.ops.fail(row.id, attempt, (e instanceof Error ? e.message : "failed").slice(0, 300), now()).catch(() => undefined);
    throw e;
  }
}

/** Retrieve a persisted operation without executing or charging anything. Ownership-scoped. */
export async function getOperation(ops: OperationStore, userId: number, id: string) {
  const r = await ops.getById(userId, id);
  if (!r) return null;
  return { id: r.id, capability: r.capability, status: r.status, attempt: r.attempt, result: r.status === "completed" ? r.result : null, error: r.status === "failed" ? r.error : null, createdAt: r.createdAt, updatedAt: r.updatedAt };
}

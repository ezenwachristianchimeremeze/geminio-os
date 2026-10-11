import { and, eq, lte, or, sql } from "drizzle-orm";
import { aiOperations } from "../../drizzle/schema";
import { getDb } from "../db";
import { LEASE_MS, type OperationRow, type OperationStore } from "./operations";

/** MySQL adapter. Uniqueness comes from the (userId,key) unique index; state moves with compare-and-set UPDATEs. NOT VERIFIED AT RUNTIME. */
const toRow = (r: typeof aiOperations.$inferSelect): OperationRow => ({ id: r.id, userId: r.userId, key: r.key, capability: r.capability, inputHash: r.inputHash, status: r.status, attempt: r.attempt, result: r.result, error: r.error, leaseUntil: r.leaseUntil, createdAt: r.createdAt, updatedAt: r.updatedAt });
const affected = (res: unknown): number => Number(((Array.isArray(res) ? res[0] : res) as { affectedRows?: number } | undefined)?.affectedRows ?? 0);

export async function getMysqlOperationStore(): Promise<OperationStore> {
  const db = await getDb();
  if (!db) throw new Error("Operation storage is unavailable.");
  return {
    async insertIfAbsent(r) { try { await db.insert(aiOperations).values({ ...r, result: null }); return true; } catch (e) { if (/duplicate|ER_DUP_ENTRY/i.test(e instanceof Error ? `${e.message} ${(e as { code?: string }).code ?? ""}` : "")) return false; throw e; } },
    async get(userId, key) { const r = (await db.select().from(aiOperations).where(and(eq(aiOperations.userId, userId), eq(aiOperations.key, key))).limit(1))[0]; return r ? toRow(r) : null; },
    async getById(userId, id) { const r = (await db.select().from(aiOperations).where(and(eq(aiOperations.userId, userId), eq(aiOperations.id, id))).limit(1))[0]; return r ? toRow(r) : null; },
    async startAttempt(userId, key, expected, now) {
      const n = affected(await db.update(aiOperations).set({ status: "running", attempt: sql`${aiOperations.attempt} + 1`, leaseUntil: new Date(+now + LEASE_MS), updatedAt: now }).where(and(eq(aiOperations.userId, userId), eq(aiOperations.key, key), eq(aiOperations.attempt, expected), or(eq(aiOperations.status, "failed"), and(eq(aiOperations.status, "running"), lte(aiOperations.leaseUntil, now))))));
      return n === 1 ? expected + 1 : null;
    },
    async complete(id, attempt, result, now) { return affected(await db.update(aiOperations).set({ status: "completed", result: result as never, error: null, updatedAt: now }).where(and(eq(aiOperations.id, id), eq(aiOperations.attempt, attempt), eq(aiOperations.status, "running")))) === 1; },
    async fail(id, attempt, error, now) { return affected(await db.update(aiOperations).set({ status: "failed", error, updatedAt: now }).where(and(eq(aiOperations.id, id), eq(aiOperations.attempt, attempt), eq(aiOperations.status, "running")))) === 1; },
  };
}

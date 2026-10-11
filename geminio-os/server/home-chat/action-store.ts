import { and, count, desc, eq } from "drizzle-orm";
import { homeChatActions } from "../../drizzle/schema";
import { getDb } from "../db";
import type { ActionRow, ActionStore } from "./actions";

/** MySQL adapter; transitions are compare-and-set UPDATEs (WHERE status = from). NOT VERIFIED AT RUNTIME. */
const toRow = (r: typeof homeChatActions.$inferSelect): ActionRow => ({ id: r.id, userId: r.userId, type: r.type, resourceId: r.resourceId, resourceLabel: r.resourceLabel, summary: r.summary, consequences: (r.consequences as string[]) ?? [], estimatedCredits: r.estimatedCredits, reversible: r.reversible, reversalNote: r.reversalNote, status: r.status, result: r.result, error: r.error, params: (r.params as Record<string, unknown>) ?? {}, expiresAt: r.expiresAt, createdAt: r.createdAt, updatedAt: r.updatedAt });
const affected = (res: unknown): number => Number(((Array.isArray(res) ? res[0] : res) as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
export async function getMysqlActionStore(): Promise<ActionStore> {
  const db = await getDb();
  if (!db) throw new Error("Action storage is unavailable.");
  return {
    async insert(r) { await db.insert(homeChatActions).values({ ...r, result: null }); },
    async get(userId, id) { const r = (await db.select().from(homeChatActions).where(and(eq(homeChatActions.userId, userId), eq(homeChatActions.id, id))).limit(1))[0]; return r ? toRow(r) : null; },
    async list(userId, limit) { return (await db.select().from(homeChatActions).where(eq(homeChatActions.userId, userId)).orderBy(desc(homeChatActions.createdAt)).limit(limit)).map(toRow); },
    async countPending(userId) { return Number((await db.select({ n: count() }).from(homeChatActions).where(and(eq(homeChatActions.userId, userId), eq(homeChatActions.status, "pending"))))[0]?.n ?? 0); },
    async transition(userId, id, from, to, patch, now) { return affected(await db.update(homeChatActions).set({ status: to, updatedAt: now, ...(patch.result !== undefined ? { result: patch.result as never } : {}), ...(patch.error !== undefined ? { error: patch.error } : {}) }).where(and(eq(homeChatActions.userId, userId), eq(homeChatActions.id, id), eq(homeChatActions.status, from)))) === 1; },
  };
}

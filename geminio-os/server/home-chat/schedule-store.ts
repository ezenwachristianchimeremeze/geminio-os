import { and, asc, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { homeChatScheduleRuns, homeChatSchedules } from "../../drizzle/schema";
import { getDb } from "../db";
import type { Recurrence, RunRecord, RunStatus, ScheduleRow, ScheduleStore } from "./schedule";

/** MySQL adapter. The claim is a compare-and-set UPDATE (WHERE nextRunAt = expected), so only one worker can win an occurrence. NOT VERIFIED AT RUNTIME. */
const toRow = (r: typeof homeChatSchedules.$inferSelect): ScheduleRow => ({ id: r.id, userId: r.userId, kind: r.kind, title: r.title, prompt: r.prompt, recurrence: r.recurrence as Recurrence, timezone: r.timezone, timeOfDay: r.timeOfDay, nextRunAt: r.nextRunAt, lastRunAt: r.lastRunAt, status: r.status, failures: r.failures, createdAt: r.createdAt });
const affected = (res: unknown): number => Number(((Array.isArray(res) ? res[0] : res) as { affectedRows?: number } | undefined)?.affectedRows ?? 0);

export async function getMysqlScheduleStore(): Promise<ScheduleStore> {
  const db = await getDb();
  if (!db) throw new Error("Schedule storage is unavailable.");
  return {
    async countActive(userId) { return (await db.select({ id: homeChatSchedules.id }).from(homeChatSchedules).where(and(eq(homeChatSchedules.userId, userId), eq(homeChatSchedules.status, "active")))).length; },
    async insert(r) { await db.insert(homeChatSchedules).values({ ...r }); },
    async list(userId) { return (await db.select().from(homeChatSchedules).where(eq(homeChatSchedules.userId, userId)).orderBy(asc(homeChatSchedules.nextRunAt)).limit(100)).map(toRow); },
    async get(userId, id) { const r = (await db.select().from(homeChatSchedules).where(and(eq(homeChatSchedules.id, id), eq(homeChatSchedules.userId, userId))).limit(1))[0]; return r ? toRow(r) : null; },
    async update(userId, id, patch) { if (Object.keys(patch).length) await db.update(homeChatSchedules).set(patch).where(and(eq(homeChatSchedules.id, id), eq(homeChatSchedules.userId, userId))); return true; },
    async remove(userId, id) { return affected(await db.delete(homeChatSchedules).where(and(eq(homeChatSchedules.id, id), eq(homeChatSchedules.userId, userId)))) === 1; },
    async due(now, limit) { return (await db.select().from(homeChatSchedules).where(and(eq(homeChatSchedules.status, "active"), isNotNull(homeChatSchedules.nextRunAt), lte(homeChatSchedules.nextRunAt, now))).orderBy(asc(homeChatSchedules.nextRunAt)).limit(limit)).map(toRow); },
    async getById(id) { const r = (await db.select().from(homeChatSchedules).where(eq(homeChatSchedules.id, id)).limit(1))[0]; return r ? toRow(r) : null; },
    async insertRun(r: RunRecord) { try { await db.insert(homeChatScheduleRuns).values({ ...r }); return true; } catch (e) { if (/duplicate|ER_DUP_ENTRY/i.test(e instanceof Error ? `${e.message} ${(e as { code?: string }).code ?? ""}` : "")) return false; throw e; } },
    async acquireRun(scheduleId, occurrence, expected, now, leaseUntil) {
      const n = affected(await db.update(homeChatScheduleRuns).set({ attempts: expected + 1, status: "firing", leaseUntil, updatedAt: now }).where(and(eq(homeChatScheduleRuns.scheduleId, scheduleId), eq(homeChatScheduleRuns.occurrence, occurrence), eq(homeChatScheduleRuns.attempts, expected), inArray(homeChatScheduleRuns.status, ["firing", "retry"]), lte(homeChatScheduleRuns.leaseUntil, now))));
      return n === 1 ? expected + 1 : null;
    },
    async finishRun(scheduleId, occurrence, status: RunStatus, error, now, leaseUntil) { await db.update(homeChatScheduleRuns).set({ status, lastError: error, updatedAt: now, ...(leaseUntil ? { leaseUntil } : {}) }).where(and(eq(homeChatScheduleRuns.scheduleId, scheduleId), eq(homeChatScheduleRuns.occurrence, occurrence))); },
    async expiredRuns(now, limit) { return (await db.select().from(homeChatScheduleRuns).where(and(inArray(homeChatScheduleRuns.status, ["firing", "retry"]), lte(homeChatScheduleRuns.leaseUntil, now))).orderBy(asc(homeChatScheduleRuns.occurrence)).limit(limit)).map((r) => ({ scheduleId: r.scheduleId, occurrence: r.occurrence, userId: r.userId, status: r.status, attempts: r.attempts, leaseUntil: r.leaseUntil, lastError: r.lastError })); },
    async claim(id, expected, patch) { return affected(await db.update(homeChatSchedules).set(patch).where(and(eq(homeChatSchedules.id, id), eq(homeChatSchedules.status, "active"), eq(homeChatSchedules.nextRunAt, expected)))) === 1; },
  };
}

import { and, asc, desc, eq, inArray, lt, lte, sql } from "drizzle-orm";
import {
  agentTasks,
  aiQueueJobs,
  conversations,
  messages,
  orchestrationRuns,
  projects,
  providerAttempts,
  taskCheckpoints,
  taskEvents,
  type InsertAiQueueJobRecord,
  type InsertConversationRecord,
  type InsertOrchestrationRunRecord,
  type InsertProviderAttemptRecord,
  type InsertTaskCheckpointRecord,
  type InsertTaskEventRecord,
} from "../../drizzle/schema";
import { getDb } from "../db";

export async function getConversation(userId: number, conversationId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId))).limit(1);
  return rows[0] ?? null;
}

export async function createConversation(input: InsertConversationRecord) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(conversations).values(input);
  const rows = await db.select().from(conversations).where(eq(conversations.id, input.id)).limit(1);
  return rows[0] ?? null;
}

export async function appendConversationMessage(input: { id: string; userId: number; conversationId: string; role: "user" | "assistant"; content: string; runId?: string | null; sources?: unknown; attachments?: unknown }) {
  const db = await getDb();
  if (!db) return null;
  // An assistant reply is linked to the latest active user message so regenerated replies form a variant group.
  let variantOf: string | null = null;
  if (input.role === "assistant") {
    const lastUser = (await db.select({ id: messages.id }).from(messages).where(and(eq(messages.conversationId, input.conversationId), eq(messages.userId, input.userId), eq(messages.role, "user"), eq(messages.active, true))).orderBy(desc(messages.createdAt)).limit(1))[0];
    variantOf = lastUser?.id ?? null;
  }
  await db.insert(messages).values({ ...input, runId: input.runId ?? null, sources: input.sources ?? null, attachments: input.attachments ?? null, variantOf, active: true });
  await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, input.conversationId));
  const rows = await db.select().from(messages).where(eq(messages.id, input.id)).limit(1);
  return rows[0] ?? null;
}

export async function listConversationMessages(userId: number, conversationId: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages).where(and(eq(messages.userId, userId), eq(messages.conversationId, conversationId), eq(messages.active, true))).orderBy(desc(messages.createdAt)).limit(limit);
}

export async function createOrchestrationRun(input: InsertOrchestrationRunRecord) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(orchestrationRuns).where(and(eq(orchestrationRuns.userId, input.userId), eq(orchestrationRuns.requestId, input.requestId))).limit(1);
  if (existing[0]) return existing[0];
  try {
    await db.insert(orchestrationRuns).values(input);
  } catch (error) {
    // Concurrent duplicate submit: the (userId, requestId) unique index rejected us; the winner's row is the answer.
    const winner = (await db.select().from(orchestrationRuns).where(and(eq(orchestrationRuns.userId, input.userId), eq(orchestrationRuns.requestId, input.requestId))).limit(1))[0];
    if (winner) return winner;
    throw error;
  }
  const rows = await db.select().from(orchestrationRuns).where(eq(orchestrationRuns.id, input.id)).limit(1);
  return rows[0] ?? null;
}

export async function updateOrchestrationRun(runId: string, userId: number, patch: Partial<typeof orchestrationRuns.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(orchestrationRuns).set({ ...patch, updatedAt: new Date() }).where(and(eq(orchestrationRuns.id, runId), eq(orchestrationRuns.userId, userId)));
  const rows = await db.select().from(orchestrationRuns).where(and(eq(orchestrationRuns.id, runId), eq(orchestrationRuns.userId, userId))).limit(1);
  return rows[0] ?? null;
}

/** True when the project exists and belongs to the user. Client-supplied project ids must pass this before they are stored on a run, conversation or task. */
export async function userOwnsProject(userId: number, projectId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1);
  return rows.length === 1;
}

export async function getOrchestrationRunByRequest(userId: number, requestId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(orchestrationRuns).where(and(eq(orchestrationRuns.userId, userId), eq(orchestrationRuns.requestId, requestId))).limit(1);
  return rows[0] ?? null;
}

export async function getOrchestrationRunByTaskId(userId: number, taskId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(orchestrationRuns).where(and(eq(orchestrationRuns.userId, userId), eq(orchestrationRuns.taskId, taskId))).orderBy(desc(orchestrationRuns.createdAt)).limit(1);
  return rows[0] ?? null;
}

export async function getOrchestrationRunById(runId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(orchestrationRuns).where(eq(orchestrationRuns.id, runId)).limit(1);
  return rows[0] ?? null;
}

export async function getOrchestrationRun(userId: number, runId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(orchestrationRuns).where(and(eq(orchestrationRuns.id, runId), eq(orchestrationRuns.userId, userId))).limit(1);
  return rows[0] ?? null;
}

export async function listOrchestrationRuns(userId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(orchestrationRuns)
    .where(eq(orchestrationRuns.userId, userId))
    .orderBy(desc(orchestrationRuns.updatedAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}

export async function enqueueAiJob(input: InsertAiQueueJobRecord) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(aiQueueJobs).values(input);
  const rows = await db.select().from(aiQueueJobs).where(eq(aiQueueJobs.id, input.id)).limit(1);
  return rows[0] ?? null;
}

export async function claimNextAiJob(leaseMs = 60_000) {
  const db = await getDb();
  if (!db) return null;
  const now = new Date();
  const available = await db.select().from(aiQueueJobs).where(and(eq(aiQueueJobs.status, "queued"), lte(aiQueueJobs.availableAt, now))).orderBy(asc(aiQueueJobs.availableAt)).limit(1);
  const job = available[0];
  if (!job) return null;
  const leasedUntil = new Date(Date.now() + leaseMs);
  const claim = await db.update(aiQueueJobs).set({ status: "leased", leasedUntil, updatedAt: now }).where(and(eq(aiQueueJobs.id, job.id), eq(aiQueueJobs.status, "queued")));
  if (Number(claim[0]?.affectedRows ?? 0) !== 1) return null;
  const rows = await db.select().from(aiQueueJobs).where(eq(aiQueueJobs.id, job.id)).limit(1);
  return rows[0] ?? null;
}

export async function recoverExpiredAiJobLeases() {
  const db = await getDb();
  if (!db) return 0;
  const now = new Date();
  const result = await db
    .update(aiQueueJobs)
    .set({
      status: "queued",
      leasedUntil: null,
      lastError: "Worker lease expired; the job was returned to the durable queue.",
      availableAt: now,
      updatedAt: now,
    })
    .where(and(inArray(aiQueueJobs.status, ["leased", "running"]), lte(aiQueueJobs.leasedUntil, now)));
  return Number(result[0]?.affectedRows ?? 0);
}

export async function getAiJob(jobId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(aiQueueJobs).where(eq(aiQueueJobs.id, jobId)).limit(1);
  return rows[0] ?? null;
}

export async function updateAiJob(jobId: string, patch: Partial<typeof aiQueueJobs.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(aiQueueJobs).set({ ...patch, updatedAt: new Date() }).where(eq(aiQueueJobs.id, jobId));
  const rows = await db.select().from(aiQueueJobs).where(eq(aiQueueJobs.id, jobId)).limit(1);
  return rows[0] ?? null;
}

export async function listAiJobsForRun(userId: number, runId: string) {
  const ownedRun = await getOrchestrationRun(userId, runId);
  if (!ownedRun) return [];
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiQueueJobs).where(eq(aiQueueJobs.runId, runId)).orderBy(desc(aiQueueJobs.createdAt));
}

export async function cancelOpenAiJobs(runId: string) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .update(aiQueueJobs)
    .set({ status: "cancelled", leasedUntil: null, updatedAt: new Date() })
    .where(and(eq(aiQueueJobs.runId, runId), inArray(aiQueueJobs.status, ["queued", "leased", "running"])));
  return Number(result[0]?.affectedRows ?? 0);
}

export async function appendTaskEvent(input: InsertTaskEventRecord) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(taskEvents).values(input);
  return input;
}

export async function nextTaskEventSequence(taskId: string) {
  const db = await getDb();
  if (!db) return 1;
  const rows = await db.select({ maxSequence: sql<number>`coalesce(max(${taskEvents.sequence}), 0)` }).from(taskEvents).where(eq(taskEvents.taskId, taskId));
  return Number(rows[0]?.maxSequence ?? 0) + 1;
}

export async function listTaskEvents(taskId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(taskEvents).where(eq(taskEvents.taskId, taskId)).orderBy(asc(taskEvents.sequence));
}

export async function saveTaskCheckpoint(input: InsertTaskCheckpointRecord) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(taskCheckpoints).values(input);
  return input;
}

export async function latestTaskCheckpoint(taskId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(taskCheckpoints).where(eq(taskCheckpoints.taskId, taskId)).orderBy(desc(taskCheckpoints.version)).limit(1);
  return rows[0] ?? null;
}

export async function listTaskCheckpointsForRun(userId: number, runId: string) {
  const ownedRun = await getOrchestrationRun(userId, runId);
  if (!ownedRun) return [];
  const db = await getDb();
  if (!db) return [];
  return db.select().from(taskCheckpoints).where(eq(taskCheckpoints.runId, runId)).orderBy(desc(taskCheckpoints.version));
}

export async function recordProviderAttempt(input: InsertProviderAttemptRecord) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(providerAttempts).values(input);
  return input;
}

export async function countProviderAttempts(runId: string) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ count: sql<number>`count(*)` }).from(providerAttempts).where(eq(providerAttempts.runId, runId));
  return Number(rows[0]?.count ?? 0);
}

export async function listProviderAttemptsForRun(userId: number, runId: string) {
  const ownedRun = await getOrchestrationRun(userId, runId);
  if (!ownedRun) return [];
  const db = await getDb();
  if (!db) return [];
  return db.select().from(providerAttempts).where(eq(providerAttempts.runId, runId)).orderBy(desc(providerAttempts.createdAt));
}

export async function getTaskForUser(userId: number, taskId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(agentTasks).where(and(eq(agentTasks.userId, userId), eq(agentTasks.id, taskId))).limit(1);
  return rows[0] ?? null;
}

export async function listStalePausedRuns(olderThan: Date, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orchestrationRuns).where(and(eq(orchestrationRuns.status, "paused"), lt(orchestrationRuns.updatedAt, olderThan))).limit(limit);
}

/** Compare-and-set transitions used by run-guard.ts (stale-worker protection + fencing token). True only if THIS call changed the row. */
export async function casOrchestrationRun(runId: string, userId: number, from: string[], patch: Partial<typeof orchestrationRuns.$inferInsert>, fence?: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const res = await db.update(orchestrationRuns).set({ ...patch, updatedAt: new Date() })
    .where(and(eq(orchestrationRuns.id, runId), eq(orchestrationRuns.userId, userId), inArray(orchestrationRuns.status, from as (typeof orchestrationRuns.$inferSelect)["status"][]), ...(fence === undefined ? [] : [eq(orchestrationRuns.fence, fence)])));
  return Number(res[0]?.affectedRows ?? 0) === 1;
}

/** Claim: status -> executing and fence = fence + 1 in ONE statement; the new fence is read back inside the same transaction (the row is locked by our UPDATE). */
export async function claimOrchestrationRun(runId: string, userId: number, from: string[]): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async (tx) => {
    const res = await tx.update(orchestrationRuns).set({ status: "executing", fence: sql`${orchestrationRuns.fence} + 1`, updatedAt: new Date() })
      .where(and(eq(orchestrationRuns.id, runId), eq(orchestrationRuns.userId, userId), inArray(orchestrationRuns.status, from as (typeof orchestrationRuns.$inferSelect)["status"][])));
    if (Number(res[0]?.affectedRows ?? 0) !== 1) return null;
    const row = (await tx.select({ fence: orchestrationRuns.fence }).from(orchestrationRuns).where(eq(orchestrationRuns.id, runId)).limit(1))[0];
    return row?.fence ?? null;
  });
}

export async function casAiJob(jobId: string, from: string[], patch: Partial<typeof aiQueueJobs.$inferInsert>): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const res = await db.update(aiQueueJobs).set({ ...patch, updatedAt: new Date() })
    .where(and(eq(aiQueueJobs.id, jobId), inArray(aiQueueJobs.status, from as (typeof aiQueueJobs.$inferSelect)["status"][])));
  return Number(res[0]?.affectedRows ?? 0) === 1;
}

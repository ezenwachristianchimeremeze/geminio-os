import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import {
  agentTasks,
  aiQueueJobs,
  conversations,
  messages,
  orchestrationRuns,
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

export async function appendConversationMessage(input: { id: string; userId: number; conversationId: string; role: "user" | "assistant"; content: string }) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(messages).values(input);
  const rows = await db.select().from(messages).where(eq(messages.id, input.id)).limit(1);
  return rows[0] ?? null;
}

export async function listConversationMessages(userId: number, conversationId: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages).where(and(eq(messages.userId, userId), eq(messages.conversationId, conversationId))).orderBy(desc(messages.createdAt)).limit(limit);
}

export async function createOrchestrationRun(input: InsertOrchestrationRunRecord) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(orchestrationRuns).where(and(eq(orchestrationRuns.userId, input.userId), eq(orchestrationRuns.requestId, input.requestId))).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(orchestrationRuns).values(input);
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

import { and, desc, eq } from "drizzle-orm";
import { resolveAndResume, transitionOwnedTask, updateOwnedTask, type AgentTaskStore, type ApprovalDecision, type ApprovalRow, type ApprovalStore, type TaskPatch } from "./task-approvals";
import {
  agentTasks,
  creditLedger,
  entitlements,
  notifications,
  taskApprovals,
  usageRecords,
  type InsertAgentTaskRecord,
  type InsertCreditLedgerRecord,
  type InsertEntitlementRecord,
  type InsertNotification,
  type InsertTaskApprovalRecord,
  type InsertUsageRecord,
} from "../drizzle/schema";
import { getDb } from "./db";

export async function insertAgentTask(input: InsertAgentTaskRecord) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(agentTasks).values(input);
  const rows = await db.select().from(agentTasks).where(eq(agentTasks.id, input.id)).limit(1);
  return rows[0] ?? null;
}

export async function listAgentTasks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentTasks).where(eq(agentTasks.userId, userId)).orderBy(desc(agentTasks.updatedAt));
}

function drizzleAgentTaskStore(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): AgentTaskStore {
  return {
    async updateOwned(userId, id, patch, at) { await db.update(agentTasks).set({ ...patch, updatedAt: at } as never).where(and(eq(agentTasks.id, id), eq(agentTasks.userId, userId))); },
    async casState(userId, id, from, patch, at) {
      const res = (await db.update(agentTasks).set({ ...patch, updatedAt: at } as never).where(and(eq(agentTasks.id, id), eq(agentTasks.userId, userId), eq(agentTasks.state, from as never)))) as unknown as [{ affectedRows?: number }];
      return Number(res?.[0]?.affectedRows ?? 0);
    },
    async getOwned(userId, id) { return (await db.select().from(agentTasks).where(and(eq(agentTasks.id, id), eq(agentTasks.userId, userId))).limit(1))[0] ?? null; },
  };
}

export async function updateAgentTask(taskId: string, userId: number, patch: Partial<Pick<typeof agentTasks.$inferInsert, "state" | "progress" | "currentApprovalId" | "lastError" | "checkpoint">>) {
  const db = await getDb();
  if (!db) return null;
  return updateOwnedTask(drizzleAgentTaskStore(db), userId, taskId, patch as TaskPatch);
}

/** Compare-and-set transition for the user-facing task API. */
export async function transitionAgentTask(taskId: string, userId: number, from: string, patch: TaskPatch & { state: string }) {
  const db = await getDb();
  if (!db) return null;
  return transitionOwnedTask(drizzleAgentTaskStore(db), userId, taskId, from, patch);
}

export async function insertTaskApproval(input: InsertTaskApprovalRecord) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(taskApprovals).values(input);
  const rows = await db.select().from(taskApprovals).where(eq(taskApprovals.id, input.id)).limit(1);
  return rows[0] ?? null;
}

function drizzleApprovalStore(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): ApprovalStore {
  return {
    async resolvePending(userId, id, status, at) {
      const res = (await db.update(taskApprovals).set({ status, resolvedAt: at }).where(and(eq(taskApprovals.id, id), eq(taskApprovals.userId, userId), eq(taskApprovals.status, "pending")))) as unknown as [{ affectedRows?: number }];
      return Number(res?.[0]?.affectedRows ?? 0);
    },
    async get(userId, id) { return ((await db.select().from(taskApprovals).where(and(eq(taskApprovals.id, id), eq(taskApprovals.userId, userId))).limit(1))[0] as ApprovalRow | undefined) ?? null; },
  };
}

/** Owner-scoped, resolve-once; `resume` runs only for the call that made an "approved" decision. See server/task-approvals.ts. */
export async function resolveTaskApproval<T>(approvalId: string, userId: number, status: ApprovalDecision, resume: (approval: ApprovalRow) => Promise<T>) {
  const db = await getDb();
  if (!db) return null;
  return resolveAndResume(drizzleApprovalStore(db), userId, approvalId, status, resume);
}

export async function insertCreditLedgerEntry(input: InsertCreditLedgerRecord) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(creditLedger).values(input);
  return input;
}

export async function listCreditLedger(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(creditLedger).where(eq(creditLedger.userId, userId)).orderBy(desc(creditLedger.createdAt));
}

export async function listEntitlements(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(entitlements).where(eq(entitlements.userId, userId)).orderBy(desc(entitlements.updatedAt));
}

export async function insertEntitlement(input: InsertEntitlementRecord) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(entitlements).values(input);
  return input;
}

export async function insertNotification(input: InsertNotification) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(notifications).values(input);
  const rows = await db.select().from(notifications).where(eq(notifications.id, input.id)).limit(1);
  return rows[0] ?? null;
}

export async function listNotifications(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(Math.min(limit, 100));
}

export async function markNotificationRead(userId: number, notificationId: string) {
  const db = await getDb();
  if (!db) return null;
  await db.update(notifications).set({ read: true }).where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  const rows = await db.select().from(notifications).where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId))).limit(1);
  return rows[0] ?? null;
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
  return 1;
}

export async function findUsageRecord(userId: number, requestId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(usageRecords).where(and(eq(usageRecords.userId, userId), eq(usageRecords.requestId, requestId))).limit(1);
  return rows[0] ?? null;
}

export async function insertUsageRecord(input: InsertUsageRecord) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(usageRecords).values(input);
  return input;
}

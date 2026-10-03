import { and, desc, eq } from "drizzle-orm";
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

export async function updateAgentTask(taskId: string, userId: number, patch: Partial<Pick<typeof agentTasks.$inferInsert, "state" | "progress" | "currentApprovalId" | "lastError" | "checkpoint">>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(agentTasks).set({ ...patch, updatedAt: new Date() }).where(eq(agentTasks.id, taskId));
  const rows = await db.select().from(agentTasks).where(eq(agentTasks.id, taskId)).limit(1);
  const task = rows[0];
  return task && task.userId === userId ? task : null;
}

export async function insertTaskApproval(input: InsertTaskApprovalRecord) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(taskApprovals).values(input);
  const rows = await db.select().from(taskApprovals).where(eq(taskApprovals.id, input.id)).limit(1);
  return rows[0] ?? null;
}

export async function resolveTaskApproval(approvalId: string, userId: number, status: "approved" | "rejected") {
  const db = await getDb();
  if (!db) return null;
  await db.update(taskApprovals).set({ status, resolvedAt: new Date() }).where(eq(taskApprovals.id, approvalId));
  const rows = await db.select().from(taskApprovals).where(eq(taskApprovals.id, approvalId)).limit(1);
  const approval = rows[0];
  return approval && approval.userId === userId ? approval : null;
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

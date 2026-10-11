import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { auditLogs, liveBuilderChangeSets, liveBuilderFiles, liveBuilderVersions, liveBuilderWorkspaces } from "../../drizzle/schema";
import { getDb } from "../db";
import type { ApplyStore, ApplyTx, AuditEvent, ChangeStatus, FileKind, StoredChange, StoredFile, StoredVersion, StoredWorkspace } from "./atomic-apply";

/**
 * Production storage adapter: MySQL/InnoDB via drizzle. `transaction()` is a real
 * database transaction; `lockWorkspace` issues SELECT ... FOR UPDATE.
 *
 * NOT VERIFIED AT RUNTIME: written without drizzle-orm installed or a MySQL
 * server. The logic that uses it is covered by tests against a SQLite store with
 * the same port (tests/helpers/sqlite-apply-store.ts); this file's SQL has never run.
 */
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const toFile = (r: typeof liveBuilderFiles.$inferSelect): StoredFile => ({ id: r.id, path: r.path, kind: r.kind as FileKind, content: r.content, contentHash: r.contentHash, isSecret: r.isSecret, status: r.status });
const toVersion = (r: typeof liveBuilderVersions.$inferSelect): StoredVersion => ({ id: r.id, number: r.number, changeSetId: r.changeSetId, label: r.label, manifest: r.manifest, previewDocument: r.previewDocument });
const affected = (result: unknown): number => {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
};

function auditRow(e: AuditEvent) {
  return { id: `audit_${crypto.randomUUID()}`, userId: e.userId, action: e.action, resource: e.resource.slice(0, 100), status: e.status, details: JSON.stringify(e.details), createdAt: new Date() };
}

function txPort(tx: Tx): ApplyTx {
  return {
    async lockWorkspace(id): Promise<StoredWorkspace | null> {
      const r = (await tx.select().from(liveBuilderWorkspaces).where(eq(liveBuilderWorkspaces.id, id)).limit(1).for("update"))[0];
      return r ? { id: r.id, userId: r.userId, previewDocument: r.previewDocument } : null;
    },
    async getChange(workspaceId, id): Promise<StoredChange | null> {
      const r = (await tx.select().from(liveBuilderChangeSets).where(and(eq(liveBuilderChangeSets.id, id), eq(liveBuilderChangeSets.workspaceId, workspaceId))).limit(1))[0];
      return r ? { id: r.id, workspaceId: r.workspaceId, sequence: r.sequence, summary: r.summary, patches: r.patches, status: r.status as ChangeStatus, requiresApproval: r.requiresApproval } : null;
    },
    async getVersionForChange(workspaceId, id) {
      const r = (await tx.select().from(liveBuilderVersions).where(and(eq(liveBuilderVersions.workspaceId, workspaceId), eq(liveBuilderVersions.changeSetId, id))).limit(1))[0];
      return r ? toVersion(r) : null;
    },
    async listFiles(workspaceId) {
      return (await tx.select().from(liveBuilderFiles).where(eq(liveBuilderFiles.workspaceId, workspaceId))).map(toFile);
    },
    async listVersions(workspaceId) {
      return (await tx.select().from(liveBuilderVersions).where(eq(liveBuilderVersions.workspaceId, workspaceId)).orderBy(desc(liveBuilderVersions.number))).map(toVersion);
    },
    async insertFile(workspaceId, f) {
      await tx.insert(liveBuilderFiles).values({ id: f.id, workspaceId, path: f.path, kind: f.kind, content: f.content, contentHash: f.contentHash, isSecret: f.isSecret, status: f.status });
    },
    async updateFile(id, patch) {
      await tx.update(liveBuilderFiles).set({ ...patch, updatedAt: new Date() }).where(eq(liveBuilderFiles.id, id));
    },
    async transitionChange(id, from, to) {
      const res = await tx.update(liveBuilderChangeSets).set({ status: to, updatedAt: new Date() }).where(and(eq(liveBuilderChangeSets.id, id), inArray(liveBuilderChangeSets.status, from)));
      return affected(res) === 1;
    },
    async setWorkspacePreview(id, preview) {
      await tx.update(liveBuilderWorkspaces).set({ previewDocument: preview as never, selectedElement: null, updatedAt: new Date() }).where(eq(liveBuilderWorkspaces.id, id));
    },
    async nextVersionNumber(workspaceId) {
      // Safe: the workspace row is locked FOR UPDATE for the whole transaction, so no other
      // transaction can compute or insert a version number for this workspace concurrently.
      const r = (await tx.select({ m: sql<number | null>`max(${liveBuilderVersions.number})` }).from(liveBuilderVersions).where(eq(liveBuilderVersions.workspaceId, workspaceId)))[0];
      return Number(r?.m ?? 0) + 1;
    },
    async insertVersion(workspaceId, v) {
      await tx.insert(liveBuilderVersions).values({ id: v.id, workspaceId, changeSetId: v.changeSetId, number: v.number, label: v.label.slice(0, 255), manifest: v.manifest as never, previewDocument: v.previewDocument as never });
    },
    async insertAudit(e) {
      await tx.insert(auditLogs).values(auditRow(e));
    },
  };
}

export async function getMysqlApplyStore(): Promise<ApplyStore> {
  const db = await getDb();
  if (!db) throw new Error("Persistent project storage is temporarily unavailable.");
  return {
    transaction: (fn) => db.transaction((tx) => fn(txPort(tx))),
    async transitionChange(id, from, to) {
      const res = await db.update(liveBuilderChangeSets).set({ status: to, updatedAt: new Date() }).where(and(eq(liveBuilderChangeSets.id, id), inArray(liveBuilderChangeSets.status, from)));
      return affected(res) === 1;
    },
    async recordAudit(e) {
      await db.insert(auditLogs).values(auditRow(e));
    },
  };
}

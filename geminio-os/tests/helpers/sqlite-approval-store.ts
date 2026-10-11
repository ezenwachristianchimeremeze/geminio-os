import { DatabaseSync } from "./sqlite";
import type { AgentTaskStore, ApprovalDecision, ApprovalRow, ApprovalStore, TaskPatch } from "../../server/task-approvals";

/**
 * TEST-ONLY. SQL-engine (SQLite, NOT MySQL/InnoDB) implementation of ApprovalStore/AgentTaskStore. The statements are the ones in
 * server/geminio-data.ts (drizzleApprovalStore / drizzleAgentTaskStore), written out by hand; nothing proves Drizzle emits identical SQL.
 * Each instance is its own connection to the same file = a separate session.
 */
export const APPROVAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS agentTasks (id TEXT PRIMARY KEY, userId INTEGER NOT NULL, title TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'queued', progress INTEGER NOT NULL DEFAULT 0, currentApprovalId TEXT, lastError TEXT, checkpoint TEXT, updatedAt INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS taskApprovals (id TEXT PRIMARY KEY, taskId TEXT NOT NULL, userId INTEGER NOT NULL, action TEXT NOT NULL, summary TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')), requestedAt INTEGER NOT NULL DEFAULT 0, resolvedAt INTEGER);
`;
export const RESOLVE_SQL = "UPDATE taskApprovals SET status=?, resolvedAt=? WHERE id=? AND userId=? AND status='pending'";

type ApprovalDbRow = { id: string; taskId: string; userId: number; action: string; summary: string; status: ApprovalRow["status"]; requestedAt: number; resolvedAt: number | null };
const toRow = (r: ApprovalDbRow): ApprovalRow => ({ ...r, requestedAt: new Date(r.requestedAt), resolvedAt: r.resolvedAt === null ? null : new Date(r.resolvedAt) });

export class SqliteApprovalConnection implements ApprovalStore, AgentTaskStore {
  readonly db: DatabaseSync;
  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    this.db.exec(APPROVAL_SCHEMA);
  }
  seedTask(id: string, userId: number, title = "t") { this.db.prepare("INSERT OR REPLACE INTO agentTasks (id,userId,title) VALUES (?,?,?)").run(id, userId, title); }
  seedApproval(id: string, taskId: string, userId: number, status: ApprovalRow["status"] = "pending") { this.db.prepare("INSERT OR REPLACE INTO taskApprovals (id,taskId,userId,action,summary,status) VALUES (?,?,?,?,?,?)").run(id, taskId, userId, "deploy_production", "s", status); }
  /** Raw, unscoped read for assertions on the true stored state. */
  rawApproval(id: string) { return this.db.prepare("SELECT * FROM taskApprovals WHERE id=?").get(id) as ApprovalDbRow | undefined; }
  rawTask(id: string) { return this.db.prepare("SELECT * FROM agentTasks WHERE id=?").get(id) as Record<string, unknown> | undefined; }
  count(table: "taskApprovals" | "agentTasks") { return Number((this.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n); }

  async resolvePending(userId: number, id: string, status: ApprovalDecision, at: Date) {
    return Number(this.db.prepare(RESOLVE_SQL).run(status, at.getTime(), id, userId).changes);
  }
  async get(userId: number, id: string) {
    const r = this.db.prepare("SELECT * FROM taskApprovals WHERE id=? AND userId=?").get(id, userId) as ApprovalDbRow | undefined;
    return r ? toRow(r) : null;
  }
  async updateOwned(userId: number, id: string, patch: TaskPatch, at: Date) {
    const keys = Object.keys(patch).filter((k) => ["state", "progress", "currentApprovalId", "lastError", "checkpoint"].includes(k));
    this.db.prepare(`UPDATE agentTasks SET ${keys.map((k) => `${k}=?`).join(",")}${keys.length ? "," : ""}updatedAt=? WHERE id=? AND userId=?`).run(...keys.map((k) => (patch as Record<string, never>)[k] ?? null), at.getTime(), id, userId);
  }
  async casState(userId: number, id: string, from: string, patch: TaskPatch & { state: string }, at: Date) {
    const keys = Object.keys(patch).filter((k) => ["state", "progress", "currentApprovalId", "lastError", "checkpoint"].includes(k));
    return Number(this.db.prepare(`UPDATE agentTasks SET ${keys.map((k) => `${k}=?`).join(",")},updatedAt=? WHERE id=? AND userId=? AND state=?`).run(...keys.map((k) => (patch as Record<string, never>)[k] ?? null), at.getTime(), id, userId, from).changes);
  }
  async getOwned(userId: number, id: string) {
    return (this.db.prepare("SELECT id,userId,state,progress,currentApprovalId,lastError,checkpoint FROM agentTasks WHERE id=? AND userId=?").get(id, userId) as never) ?? null;
  }
}

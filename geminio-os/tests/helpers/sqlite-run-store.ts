import { DatabaseSync } from "./sqlite";
import type { JobStatus, RunGuardPort, RunStatus } from "../../server/ai-core/run-guard";

/**
 * TEST-ONLY. A SQL-engine (SQLite, NOT MySQL) store whose statements mirror the production Drizzle ones in
 * server/ai-core/persistence.ts: casOrchestrationRun, claimOrchestrationRun (status+fence in ONE UPDATE), casAiJob,
 * claimNextAiJob, recoverExpiredAiJobLeases. Each `connect()` opens a separate connection to the same database file, i.e. a
 * separate session, so interleavings across "workers" and the "user" hit real SQL write serialization. Row-lock/isolation
 * behaviour of InnoDB is NOT reproduced; that needs MySQL.
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, userId INTEGER NOT NULL, status TEXT NOT NULL, fence INTEGER NOT NULL DEFAULT 0, plan TEXT, result TEXT, error TEXT, updatedAt INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, runId TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, leasedUntil INTEGER, availableAt INTEGER NOT NULL DEFAULT 0, lastError TEXT);
`;
const q = (xs: string[]) => xs.map(() => "?").join(",");

export class RunStoreConnection {
  readonly db: DatabaseSync;
  constructor(readonly file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    this.db.exec(SCHEMA);
  }
  seedRun(id: string, userId: number, status: RunStatus, fence = 0) { this.db.prepare("INSERT OR REPLACE INTO runs (id,userId,status,fence) VALUES (?,?,?,?)").run(id, userId, status, fence); }
  seedJob(id: string, runId: string, status: JobStatus, leasedUntil: number | null = null) { this.db.prepare("INSERT OR REPLACE INTO jobs (id,runId,status,leasedUntil) VALUES (?,?,?,?)").run(id, runId, status, leasedUntil); }
  run(id: string) { return this.db.prepare("SELECT * FROM runs WHERE id=?").get(id) as { id: string; status: RunStatus; fence: number; plan: string | null; result: string | null; error: string | null }; }
  job(id: string) { return this.db.prepare("SELECT * FROM jobs WHERE id=?").get(id) as { id: string; status: JobStatus; attempts: number; leasedUntil: number | null; lastError: string | null }; }

  private setClause(patch: Record<string, unknown>) {
    const keys = Object.keys(patch).filter((k) => ["status", "plan", "result", "error", "attempts", "lastError", "leasedUntil", "availableAt"].includes(k));
    return { sql: keys.map((k) => `${k}=?`).join(","), vals: keys.map((k) => { const v = patch[k]; return v !== null && typeof v === "object" ? JSON.stringify(v) : (v as never); }) };
  }

  /** casOrchestrationRun */
  casRun(runId: string, userId: number, from: string[], patch: Record<string, unknown>, fence?: number): boolean {
    const { sql, vals } = this.setClause(patch);
    const res = this.db.prepare(`UPDATE runs SET ${sql},updatedAt=? WHERE id=? AND userId=? AND status IN (${q(from)})${fence === undefined ? "" : " AND fence=?"}`).run(...vals, Date.now(), runId, userId, ...from, ...(fence === undefined ? [] : [fence]));
    return Number(res.changes) === 1;
  }
  /** claimOrchestrationRun: status->executing and fence+1 in ONE statement, then read the new fence. */
  claimRun(runId: string, userId: number, from: string[]): number | null {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const res = this.db.prepare(`UPDATE runs SET status='executing', fence=fence+1, updatedAt=? WHERE id=? AND userId=? AND status IN (${q(from)})`).run(Date.now(), runId, userId, ...from);
      if (Number(res.changes) !== 1) { this.db.exec("COMMIT"); return null; }
      const row = this.db.prepare("SELECT fence FROM runs WHERE id=?").get(runId) as { fence: number };
      this.db.exec("COMMIT");
      return row.fence;
    } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }
  /** casAiJob */
  casJob(jobId: string, from: string[], patch: Record<string, unknown>): boolean {
    const { sql, vals } = this.setClause(patch);
    const res = this.db.prepare(`UPDATE jobs SET ${sql} WHERE id=? AND status IN (${q(from)})`).run(...vals, jobId, ...from);
    return Number(res.changes) === 1;
  }
  /** claimNextAiJob: SELECT a queued job, then UPDATE ... WHERE status='queued' and require exactly one affected row. */
  claimNextJob(now: number, leaseMs: number): string | null {
    const job = this.db.prepare("SELECT id FROM jobs WHERE status='queued' AND availableAt<=? ORDER BY availableAt LIMIT 1").get(now) as { id: string } | undefined;
    if (!job) return null;
    const res = this.db.prepare("UPDATE jobs SET status='leased', leasedUntil=? WHERE id=? AND status='queued'").run(now + leaseMs, job.id);
    return Number(res.changes) === 1 ? job.id : null;
  }
  /** recoverExpiredAiJobLeases */
  recoverExpired(now: number): number {
    return Number(this.db.prepare("UPDATE jobs SET status='queued', leasedUntil=NULL, availableAt=?, lastError='Worker lease expired; the job was returned to the durable queue.' WHERE status IN ('leased','running') AND leasedUntil<=?").run(now, now).changes);
  }
  /** Port bound to one (run, job, user) over this connection. */
  port(runId: string, jobId: string, userId = 1): RunGuardPort {
    return {
      claimRun: async (from) => this.claimRun(runId, userId, from),
      casRun: async (from, fence, patch) => this.casRun(runId, userId, from, patch, fence),
      casJob: async (from, patch) => this.casJob(jobId, from, patch),
      readRunStatus: async () => this.run(runId)?.status ?? null,
    };
  }
  close() { this.db.close(); }
}

import { DatabaseSync } from "./sqlite";
import type { OperationRow, OperationStore } from "../../server/credits/operations";

/** TEST-ONLY SQLite adapter (unique(userId,key), CAS updates). Not the production adapter. */
export class SqliteOperationStore implements OperationStore {
  readonly db = new DatabaseSync(":memory:"); failCompleteOnce = false;
  constructor() { this.db.exec("CREATE TABLE ops (id TEXT PRIMARY KEY, userId INTEGER NOT NULL, key TEXT NOT NULL, capability TEXT NOT NULL, inputHash TEXT NOT NULL, status TEXT NOT NULL, attempt INTEGER NOT NULL, result TEXT, error TEXT, leaseUntil INTEGER NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, UNIQUE(userId,key))"); }
  private row = (r: any): OperationRow => ({ ...r, result: r.result ? JSON.parse(r.result) : null, leaseUntil: new Date(r.leaseUntil), createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) });
  async insertIfAbsent(r: OperationRow) { try { this.db.prepare("INSERT INTO ops VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(r.id, r.userId, r.key, r.capability, r.inputHash, r.status, r.attempt, null, null, +r.leaseUntil, +r.createdAt, +r.updatedAt); return true; } catch { return false; } }
  async get(u: number, k: string) { const r = this.db.prepare("SELECT * FROM ops WHERE userId=? AND key=?").get(u, k); return r ? this.row(r) : null; }
  async getById(u: number, id: string) { const r = this.db.prepare("SELECT * FROM ops WHERE userId=? AND id=?").get(u, id); return r ? this.row(r) : null; }
  async startAttempt(u: number, k: string, exp: number, now: Date) { const res = this.db.prepare("UPDATE ops SET status='running', attempt=attempt+1, leaseUntil=?, updatedAt=? WHERE userId=? AND key=? AND attempt=? AND (status='failed' OR (status='running' AND leaseUntil<=?))").run(+now + 180000, +now, u, k, exp, +now); return Number(res.changes) === 1 ? exp + 1 : null; }
  async complete(id: string, attempt: number, result: unknown, now: Date) { if (this.failCompleteOnce) { this.failCompleteOnce = false; throw new Error("db down"); } return Number(this.db.prepare("UPDATE ops SET status='completed', result=?, error=NULL, updatedAt=? WHERE id=? AND attempt=? AND status='running'").run(JSON.stringify(result), +now, id, attempt).changes) === 1; }
  async fail(id: string, attempt: number, error: string, now: Date) { return Number(this.db.prepare("UPDATE ops SET status='failed', error=?, updatedAt=? WHERE id=? AND attempt=? AND status='running'").run(error, +now, id, attempt).changes) === 1; }
}

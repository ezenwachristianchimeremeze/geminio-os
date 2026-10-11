import { DatabaseSync } from "./sqlite";
import type { ApplyStore, ApplyTx, AuditEvent, ChangeStatus, StoredChange, StoredFile, StoredVersion, StoredWorkspace } from "../../server/live-builder/atomic-apply";

/**
 * TEST-ONLY storage adapter backed by node:sqlite (a real SQL engine with real
 * BEGIN/COMMIT/ROLLBACK). It lets the atomic-apply tests observe genuine
 * rollback, not a hand-written simulation. It is NOT the production adapter
 * (that is server/live-builder/apply-store.ts on MySQL/InnoDB) and SQLite
 * differs from MySQL in locking, so concurrency here is serialised by a
 * transaction mutex that stands in for SELECT ... FOR UPDATE.
 */
export class SqliteApplyStore implements ApplyStore {
  readonly db = new DatabaseSync(":memory:");
  /** Writes performed per transaction attempt (to prove failures happen before any write). */
  writes = 0;
  private queue: Promise<unknown> = Promise.resolve();
  /** Test hook: throw on the Nth write inside a transaction (1-based). */
  failOnWrite: number | null = null;
  /** Test hook: runs after the Nth write; may be async (used for abort/crash simulation). */
  afterWrite: ((n: number) => void | Promise<void>) | null = null;

  constructor() {
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE workspaces (id TEXT PRIMARY KEY, userId INTEGER NOT NULL, previewDocument TEXT);
      -- NOCASE mirrors MySQL's default case-insensitive unique index on (workspaceId, path)
      CREATE TABLE files (id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id), path TEXT NOT NULL COLLATE NOCASE, kind TEXT NOT NULL, content TEXT, contentHash TEXT, isSecret INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', UNIQUE (workspaceId, path));
      CREATE TABLE changes (id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id), sequence INTEGER NOT NULL, summary TEXT NOT NULL, patches TEXT NOT NULL, status TEXT NOT NULL, requiresApproval INTEGER NOT NULL DEFAULT 1, UNIQUE (workspaceId, sequence));
      CREATE TABLE versions (id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id), changeSetId TEXT, number INTEGER NOT NULL, label TEXT NOT NULL, manifest TEXT NOT NULL, previewDocument TEXT, UNIQUE (workspaceId, number));
      CREATE TABLE audit (seq INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER, action TEXT NOT NULL, resource TEXT NOT NULL, status TEXT NOT NULL, details TEXT NOT NULL);
    `);
  }

  // ---- seeding (not part of the port) ----
  seedWorkspace(id: string, userId: number, preview: unknown = { route: "/", nodes: [] }) {
    this.db.prepare("INSERT INTO workspaces VALUES (?,?,?)").run(id, userId, JSON.stringify(preview));
  }
  seedFile(workspaceId: string, f: { id: string; path: string; kind?: string; content: string | null; hash: string | null; isSecret?: boolean; status?: string }) {
    this.db.prepare("INSERT INTO files VALUES (?,?,?,?,?,?,?,?)").run(f.id, workspaceId, f.path, f.kind ?? "page", f.content, f.hash, f.isSecret ? 1 : 0, f.status ?? "active");
  }
  seedChange(workspaceId: string, c: { id: string; sequence: number; summary?: string; patches: unknown; status?: ChangeStatus; requiresApproval?: boolean }) {
    this.db.prepare("INSERT INTO changes VALUES (?,?,?,?,?,?,?)").run(c.id, workspaceId, c.sequence, c.summary ?? `change ${c.sequence}`, JSON.stringify(c.patches), c.status ?? "awaiting_approval", c.requiresApproval === false ? 0 : 1);
  }
  seedVersion(workspaceId: string, v: { id: string; number: number; changeSetId?: string | null; manifest: unknown; preview?: unknown }) {
    this.db.prepare("INSERT INTO versions VALUES (?,?,?,?,?,?,?)").run(v.id, workspaceId, v.changeSetId ?? null, v.number, `v${v.number}`, JSON.stringify(v.manifest), JSON.stringify(v.preview ?? { route: "/", nodes: [] }));
  }

  // ---- inspection ----
  snapshot() {
    const q = (sql: string) => this.db.prepare(sql).all();
    return JSON.stringify({ workspaces: q("SELECT * FROM workspaces ORDER BY id"), files: q("SELECT * FROM files ORDER BY id"), changes: q("SELECT * FROM changes ORDER BY id"), versions: q("SELECT * FROM versions ORDER BY id") });
  }
  activeFiles(workspaceId: string) { return this.db.prepare("SELECT path, content FROM files WHERE workspaceId=? AND status='active' ORDER BY path").all(workspaceId) as { path: string; content: string }[]; }
  changeStatus(id: string) { return (this.db.prepare("SELECT status FROM changes WHERE id=?").get(id) as { status: string } | undefined)?.status; }
  versionCount(workspaceId: string) { return (this.db.prepare("SELECT COUNT(*) c FROM versions WHERE workspaceId=?").get(workspaceId) as { c: number }).c; }
  audit(action?: string) { const rows = this.db.prepare("SELECT action, resource, status, details FROM audit ORDER BY seq").all() as { action: string; resource: string; status: string; details: string }[]; return rows.filter((r) => !action || r.action === action).map((r) => ({ ...r, details: JSON.parse(r.details) as Record<string, unknown> })); }

  // ---- port ----
  async transaction<T>(fn: (tx: ApplyTx) => Promise<T>): Promise<T> {
    const run = async () => {
      this.db.exec("BEGIN IMMEDIATE");
      this.writes = 0;
      try {
        const result = await fn(this.tx());
        this.db.exec("COMMIT");
        return result;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    };
    const next = this.queue.then(run, run); // serialise: stands in for the workspace row lock
    this.queue = next.catch(() => undefined);
    return next;
  }

  async transitionChange(id: string, from: ChangeStatus[], to: ChangeStatus) {
    const r = this.db.prepare(`UPDATE changes SET status=? WHERE id=? AND status IN (${from.map(() => "?").join(",")})`).run(to, id, ...from);
    return Number(r.changes) === 1;
  }
  async recordAudit(e: AuditEvent) {
    this.db.prepare("INSERT INTO audit (userId, action, resource, status, details) VALUES (?,?,?,?,?)").run(e.userId, e.action, e.resource, e.status, JSON.stringify(e.details));
  }

  private async w<T>(fn: () => T): Promise<T> {
    this.writes += 1;
    if (this.failOnWrite !== null && this.writes === this.failOnWrite) throw new Error(`injected failure on write #${this.writes}`);
    const out = fn();
    if (this.afterWrite) await this.afterWrite(this.writes);
    return out;
  }

  private tx(): ApplyTx {
    const file = (r: Record<string, unknown>): StoredFile => ({ id: r.id as string, path: r.path as string, kind: r.kind as StoredFile["kind"], content: r.content as string | null, contentHash: r.contentHash as string | null, isSecret: r.isSecret === 1, status: r.status as StoredFile["status"] });
    const version = (r: Record<string, unknown>): StoredVersion => ({ id: r.id as string, number: r.number as number, changeSetId: r.changeSetId as string | null, label: r.label as string, manifest: JSON.parse(r.manifest as string), previewDocument: JSON.parse((r.previewDocument as string) ?? "null") });
    return {
      lockWorkspace: async (id): Promise<StoredWorkspace | null> => { const r = this.db.prepare("SELECT * FROM workspaces WHERE id=?").get(id) as Record<string, unknown> | undefined; return r ? { id: r.id as string, userId: r.userId as number, previewDocument: JSON.parse((r.previewDocument as string) ?? "null") } : null; },
      getChange: async (workspaceId, id): Promise<StoredChange | null> => { const r = this.db.prepare("SELECT * FROM changes WHERE id=? AND workspaceId=?").get(id, workspaceId) as Record<string, unknown> | undefined; return r ? { id: r.id as string, workspaceId, sequence: r.sequence as number, summary: r.summary as string, patches: JSON.parse(r.patches as string), status: r.status as ChangeStatus, requiresApproval: r.requiresApproval === 1 } : null; },
      getVersionForChange: async (workspaceId, id) => { const r = this.db.prepare("SELECT * FROM versions WHERE workspaceId=? AND changeSetId=?").get(workspaceId, id) as Record<string, unknown> | undefined; return r ? version(r) : null; },
      listFiles: async (workspaceId) => (this.db.prepare("SELECT * FROM files WHERE workspaceId=?").all(workspaceId) as Record<string, unknown>[]).map(file),
      listVersions: async (workspaceId) => (this.db.prepare("SELECT * FROM versions WHERE workspaceId=? ORDER BY number DESC").all(workspaceId) as Record<string, unknown>[]).map(version),
      insertFile: (workspaceId, f) => this.w(() => { this.db.prepare("INSERT INTO files VALUES (?,?,?,?,?,?,?,?)").run(f.id, workspaceId, f.path, f.kind, f.content, f.contentHash, f.isSecret ? 1 : 0, f.status); }),
      updateFile: (id, p) => this.w(() => {
        const sets: string[] = []; const vals: (string | number | null)[] = [];
        for (const [k, v] of Object.entries(p)) { sets.push(`${k}=?`); vals.push(typeof v === "boolean" ? (v ? 1 : 0) : (v as string | null)); }
        this.db.prepare(`UPDATE files SET ${sets.join(",")} WHERE id=?`).run(...vals, id);
      }),
      transitionChange: (id, from, to) => this.w(() => { const r = this.db.prepare(`UPDATE changes SET status=? WHERE id=? AND status IN (${from.map(() => "?").join(",")})`).run(to, id, ...from); return Number(r.changes) === 1; }),
      setWorkspacePreview: (id, preview) => this.w(() => { this.db.prepare("UPDATE workspaces SET previewDocument=? WHERE id=?").run(JSON.stringify(preview), id); }),
      nextVersionNumber: async (workspaceId) => ((this.db.prepare("SELECT MAX(number) m FROM versions WHERE workspaceId=?").get(workspaceId) as { m: number | null }).m ?? 0) + 1,
      insertVersion: (workspaceId, v) => this.w(() => { this.db.prepare("INSERT INTO versions VALUES (?,?,?,?,?,?,?)").run(v.id, workspaceId, v.changeSetId, v.number, v.label, JSON.stringify(v.manifest), JSON.stringify(v.previewDocument)); }),
      insertAudit: (e) => this.w(() => { this.db.prepare("INSERT INTO audit (userId, action, resource, status, details) VALUES (?,?,?,?,?)").run(e.userId, e.action, e.resource, e.status, JSON.stringify(e.details)); }),
    };
  }
}

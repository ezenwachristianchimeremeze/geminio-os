import { DatabaseSync } from "./sqlite";
import type { ConversationStore, ConvRow, MsgRow } from "../../server/home-chat/conversations";

/** TEST-ONLY SQLite adapter for ConversationStore. Not the production adapter (server/home-chat/mysql-store.ts). */
export class SqliteConversationStore implements ConversationStore {
  readonly db = new DatabaseSync(":memory:");
  constructor() {
    this.db.exec(`
      CREATE TABLE conversations (id TEXT PRIMARY KEY, userId INTEGER NOT NULL, title TEXT NOT NULL, summary TEXT, status TEXT NOT NULL DEFAULT 'active', pinned INTEGER NOT NULL DEFAULT 0, temporary INTEGER NOT NULL DEFAULT 0, shareToken TEXT UNIQUE, sharedAt INTEGER, lastMessageAt INTEGER NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
      CREATE TABLE messages (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, userId INTEGER NOT NULL, conversationId TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, runId TEXT, feedback TEXT, feedbackNote TEXT, status TEXT NOT NULL DEFAULT 'complete', sources TEXT, attachments TEXT, editedAt INTEGER, active INTEGER NOT NULL DEFAULT 1, variantOf TEXT, createdAt INTEGER NOT NULL);
    `);
  }
  seedConversation(c: Partial<ConvRow> & { id: string; userId: number; title: string }) {
    const t = (c.createdAt ?? new Date()).getTime();
    this.db.prepare("INSERT INTO conversations (id,userId,title,summary,status,pinned,temporary,shareToken,sharedAt,lastMessageAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(c.id, c.userId, c.title, c.summary ?? null, c.status ?? "active", c.pinned ? 1 : 0, c.temporary ? 1 : 0, c.shareToken ?? null, null, (c.lastMessageAt ?? new Date(t)).getTime(), t, t);
  }
  seedMessage(m: { id: string; userId: number; conversationId: string; role: "user" | "assistant"; content: string; sources?: unknown; at?: number }) {
    this.db.prepare("INSERT INTO messages (id,userId,conversationId,role,content,sources,createdAt) VALUES (?,?,?,?,?,?,?)").run(m.id, m.userId, m.conversationId, m.role, m.content, m.sources ? JSON.stringify(m.sources) : null, m.at ?? Date.now());
  }
  private conv = (r: any): ConvRow => ({ id: r.id, userId: r.userId, title: r.title, summary: r.summary, status: r.status, pinned: !!r.pinned, temporary: !!r.temporary, shareToken: r.shareToken, sharedAt: r.sharedAt ? new Date(r.sharedAt) : null, lastMessageAt: new Date(r.lastMessageAt), createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) });
  private msg = (r: any): MsgRow => ({ id: r.id, userId: r.userId, conversationId: r.conversationId, role: r.role, content: r.content, runId: r.runId, feedback: r.feedback, feedbackNote: r.feedbackNote, status: r.status, sources: r.sources ? JSON.parse(r.sources) : null, attachments: r.attachments ? JSON.parse(r.attachments) : null, editedAt: r.editedAt ? new Date(r.editedAt) : null, active: !!r.active, variantOf: r.variantOf, createdAt: new Date(r.createdAt) });

  async list(userId: number, f: { archived: boolean; query?: string; limit: number }) {
    const q = f.query ? `%${f.query.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
    const rows = this.db.prepare(`SELECT * FROM conversations c WHERE userId=? AND temporary=0 AND status=? ${q ? "AND (title LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM messages m WHERE m.conversationId=c.id AND m.userId=c.userId AND m.content LIKE ? ESCAPE '\\'))" : ""} ORDER BY pinned DESC, lastMessageAt DESC LIMIT ?`).all(...([userId, f.archived ? "archived" : "active", ...(q ? [q, q] : []), f.limit] as any[]));
    return rows.map(this.conv);
  }
  async get(userId: number, id: string) { const r = this.db.prepare("SELECT * FROM conversations WHERE id=? AND userId=?").get(id, userId); return r ? this.conv(r) : null; }
  async update(userId: number, id: string, p: Record<string, unknown>) {
    const map: Record<string, (v: any) => unknown> = { pinned: (v) => (v ? 1 : 0), sharedAt: (v) => (v ? v.getTime() : null) };
    const keys = Object.keys(p); if (!keys.length) return false;
    const res = this.db.prepare(`UPDATE conversations SET ${keys.map((k) => `${k}=?`).join(",")}, updatedAt=? WHERE id=? AND userId=?`).run(...(keys.map((k) => (map[k] ? map[k](p[k]) : p[k])) as any[]), Date.now(), id, userId);
    return Number(res.changes) === 1;
  }
  async deleteCascade(userId: number, id: string) {
    this.db.exec("BEGIN");
    try {
      this.db.prepare("DELETE FROM messages WHERE conversationId=? AND userId=?").run(id, userId);
      const r = this.db.prepare("DELETE FROM conversations WHERE id=? AND userId=?").run(id, userId);
      this.db.exec("COMMIT"); return Number(r.changes) === 1;
    } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }
  async messages(userId: number, conversationId: string) { return this.db.prepare("SELECT * FROM messages WHERE conversationId=? AND userId=? ORDER BY createdAt, seq").all(conversationId, userId).map(this.msg); }
  async getMessage(userId: number, id: string) { const r = this.db.prepare("SELECT * FROM messages WHERE id=? AND userId=?").get(id, userId); return r ? this.msg(r) : null; }
  async updateMessage(userId: number, id: string, p: Record<string, unknown>) {
    const keys = Object.keys(p); if (!keys.length) return false;
    const res = this.db.prepare(`UPDATE messages SET ${keys.map((k) => `${k}=?`).join(",")} WHERE id=? AND userId=?`).run(...(keys.map((k) => (p[k] instanceof Date ? (p[k] as Date).getTime() : p[k])) as any[]), id, userId);
    return Number(res.changes) === 1;
  }
  async deleteMessagesAfter(userId: number, conversationId: string, messageId: string) {
    const m = this.db.prepare("SELECT seq FROM messages WHERE id=? AND userId=?").get(messageId, userId) as { seq: number } | undefined;
    if (!m) return 0;
    return Number(this.db.prepare("DELETE FROM messages WHERE conversationId=? AND userId=? AND seq>?").run(conversationId, userId, m.seq).changes);
  }
  async deactivateAfter(userId: number, conversationId: string, messageId: string) {
    const m = this.db.prepare("SELECT seq FROM messages WHERE id=? AND userId=?").get(messageId, userId) as { seq: number } | undefined;
    if (!m) return 0;
    return Number(this.db.prepare("UPDATE messages SET active=0, variantOf=COALESCE(variantOf, ?) WHERE conversationId=? AND userId=? AND seq>? AND role='assistant' AND active=1").run(messageId, conversationId, userId, m.seq).changes);
  }
  async activateVariant(userId: number, messageId: string) {
    const m = this.db.prepare("SELECT * FROM messages WHERE id=? AND userId=?").get(messageId, userId) as any;
    if (!m || !m.variantOf) return !!m && true;
    this.db.exec("BEGIN");
    try {
      this.db.prepare("UPDATE messages SET active=0 WHERE conversationId=? AND userId=? AND variantOf=?").run(m.conversationId, userId, m.variantOf);
      this.db.prepare("UPDATE messages SET active=1 WHERE id=? AND userId=?").run(messageId, userId);
      this.db.exec("COMMIT"); return true;
    } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }
  /** test helper: simulate the orchestrator appending a new active reply linked to a user message */
  seedReply(m: { id: string; userId: number; conversationId: string; content: string; variantOf: string; at?: number }) {
    this.db.prepare("INSERT INTO messages (id,userId,conversationId,role,content,variantOf,active,createdAt) VALUES (?,?,?,?,?,?,1,?)").run(m.id, m.userId, m.conversationId, "assistant", m.content, m.variantOf, m.at ?? Date.now());
  }
  async getByShareToken(token: string) { const r = this.db.prepare("SELECT * FROM conversations WHERE shareToken=?").get(token); return r ? this.conv(r) : null; }
  async messagesForShared(conversationId: string) { return this.db.prepare("SELECT * FROM messages WHERE conversationId=? ORDER BY createdAt, seq").all(conversationId).map(this.msg); }
  async deleteTemporaryOlderThan(cutoff: Date) {
    const ids = this.db.prepare("SELECT id FROM conversations WHERE temporary=1 AND createdAt<?").all(cutoff.getTime()) as { id: string }[];
    for (const { id } of ids) { this.db.prepare("DELETE FROM messages WHERE conversationId=?").run(id); this.db.prepare("DELETE FROM conversations WHERE id=?").run(id); }
    return ids.length;
  }
}

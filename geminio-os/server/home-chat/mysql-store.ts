import { and, asc, desc, eq, gt, like, lt, or, sql } from "drizzle-orm";
import { conversations, messages } from "../../drizzle/schema";
import { getDb } from "../db";
import type { ConversationStore, ConvRow, MsgRow } from "./conversations";

/**
 * Production ConversationStore (MySQL via drizzle). Every query is scoped by userId.
 * NOT VERIFIED AT RUNTIME (no MySQL / drizzle-orm in the build sandbox); the logic on top of the port is tested against SQLite.
 */
const escapeLike = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);
const toConv = (r: typeof conversations.$inferSelect): ConvRow => ({ id: r.id, userId: r.userId, title: r.title, summary: r.summary, status: r.status, pinned: r.pinned, temporary: r.temporary, shareToken: r.shareToken, sharedAt: r.sharedAt, lastMessageAt: r.lastMessageAt, createdAt: r.createdAt, updatedAt: r.updatedAt });
const toMsg = (r: typeof messages.$inferSelect): MsgRow => ({ id: r.id, userId: r.userId, conversationId: r.conversationId ?? "", role: r.role, content: r.content, runId: r.runId, feedback: r.feedback, feedbackNote: r.feedbackNote, status: r.status, sources: r.sources, attachments: r.attachments, editedAt: r.editedAt, active: r.active, variantOf: r.variantOf, createdAt: r.createdAt });
const affected = (result: unknown): number => Number(((Array.isArray(result) ? result[0] : result) as { affectedRows?: number } | undefined)?.affectedRows ?? 0);

export async function getMysqlConversationStore(): Promise<ConversationStore> {
  const db = await getDb();
  if (!db) throw new Error("Conversation storage is unavailable.");
  return {
    async list(userId, f) {
      const q = f.query ? `%${escapeLike(f.query)}%` : null;
      const base = and(eq(conversations.userId, userId), eq(conversations.temporary, false), eq(conversations.status, f.archived ? "archived" : "active"));
      const where = q
        ? and(base, or(like(conversations.title, q), sql`exists (select 1 from ${messages} where ${messages.conversationId} = ${conversations.id} and ${messages.userId} = ${conversations.userId} and ${messages.content} like ${q})`))
        : base;
      return (await db.select().from(conversations).where(where).orderBy(desc(conversations.pinned), desc(conversations.lastMessageAt)).limit(f.limit)).map(toConv);
    },
    async get(userId, id) { const r = (await db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId))).limit(1))[0]; return r ? toConv(r) : null; },
    async update(userId, id, patch) { await db.update(conversations).set(patch).where(and(eq(conversations.id, id), eq(conversations.userId, userId))); return true; }, // MySQL reports 0 affected rows for no-op updates, so existence is checked by the service first
    async deleteCascade(userId, id) {
      return db.transaction(async (tx) => {
        await tx.delete(messages).where(and(eq(messages.conversationId, id), eq(messages.userId, userId)));
        return affected(await tx.delete(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId)))) === 1;
      });
    },
    async messages(userId, conversationId) { return (await db.select().from(messages).where(and(eq(messages.conversationId, conversationId), eq(messages.userId, userId))).orderBy(asc(messages.createdAt), asc(messages.id))).map(toMsg); },
    async getMessage(userId, id) { const r = (await db.select().from(messages).where(and(eq(messages.id, id), eq(messages.userId, userId))).limit(1))[0]; return r ? toMsg(r) : null; },
    async updateMessage(userId, id, patch) { await db.update(messages).set(patch).where(and(eq(messages.id, id), eq(messages.userId, userId))); return true; },
    async deleteMessagesAfter(userId, conversationId, messageId) {
      const m = (await db.select().from(messages).where(and(eq(messages.id, messageId), eq(messages.userId, userId))).limit(1))[0];
      if (!m) return 0;
      return affected(await db.delete(messages).where(and(eq(messages.conversationId, conversationId), eq(messages.userId, userId), gt(messages.createdAt, m.createdAt))));
    },
    async deactivateAfter(userId, conversationId, messageId) {
      const m = (await db.select().from(messages).where(and(eq(messages.id, messageId), eq(messages.userId, userId))).limit(1))[0];
      if (!m) return 0;
      return affected(await db.update(messages).set({ active: false, variantOf: sql`COALESCE(${messages.variantOf}, ${messageId})` }).where(and(eq(messages.conversationId, conversationId), eq(messages.userId, userId), gt(messages.createdAt, m.createdAt), eq(messages.role, "assistant"), eq(messages.active, true))));
    },
    async activateVariant(userId, messageId) {
      const m = (await db.select().from(messages).where(and(eq(messages.id, messageId), eq(messages.userId, userId))).limit(1))[0];
      if (!m) return false;
      if (!m.variantOf || !m.conversationId) return true;
      await db.transaction(async (tx) => {
        await tx.update(messages).set({ active: false }).where(and(eq(messages.conversationId, m.conversationId!), eq(messages.userId, userId), eq(messages.variantOf, m.variantOf!)));
        await tx.update(messages).set({ active: true }).where(and(eq(messages.id, messageId), eq(messages.userId, userId)));
      });
      return true;
    },
    async getByShareToken(token) { const r = (await db.select().from(conversations).where(eq(conversations.shareToken, token)).limit(1))[0]; return r ? toConv(r) : null; },
    async messagesForShared(conversationId) { return (await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.createdAt), asc(messages.id))).map(toMsg); },
    async deleteTemporaryOlderThan(cutoff) {
      const old = await db.select({ id: conversations.id }).from(conversations).where(and(eq(conversations.temporary, true), lt(conversations.createdAt, cutoff))).limit(500);
      for (const { id } of old) await db.transaction(async (tx) => { await tx.delete(messages).where(eq(messages.conversationId, id)); await tx.delete(conversations).where(eq(conversations.id, id)); });
      return old.length;
    },
  };
}

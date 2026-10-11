/**
 * Conversation management for Home chat. Pure logic over a store port; every operation is scoped by userId
 * so a user can never read or mutate another user's conversation (ownership is enforced here, not by callers).
 */
import { randomBytes } from "node:crypto";

export type ConvRow = { id: string; userId: number; title: string; summary: string | null; status: "active" | "archived"; pinned: boolean; temporary: boolean; shareToken: string | null; sharedAt: Date | null; lastMessageAt: Date; createdAt: Date; updatedAt: Date };
export type MsgRow = { id: string; userId: number; conversationId: string; role: "user" | "assistant"; content: string; runId: string | null; feedback: "up" | "down" | null; feedbackNote: string | null; status: "complete" | "stopped" | "failed"; sources: unknown; attachments: unknown; editedAt: Date | null; active: boolean; variantOf: string | null; createdAt: Date };

export interface ConversationStore {
  list(userId: number, f: { archived: boolean; query?: string; limit: number }): Promise<ConvRow[]>;
  get(userId: number, id: string): Promise<ConvRow | null>;
  update(userId: number, id: string, patch: Partial<Pick<ConvRow, "title" | "status" | "pinned" | "shareToken" | "sharedAt">>): Promise<boolean>;
  /** Deletes the conversation and ALL its messages atomically. Returns false if not found/owned. */
  deleteCascade(userId: number, id: string): Promise<boolean>;
  messages(userId: number, conversationId: string): Promise<MsgRow[]>;
  getMessage(userId: number, messageId: string): Promise<MsgRow | null>;
  updateMessage(userId: number, messageId: string, patch: Partial<Pick<MsgRow, "feedback" | "feedbackNote" | "content" | "editedAt" | "status">>): Promise<boolean>;
  /** Marks assistant messages after the given user message inactive (kept as alternates). Returns count. */
  deactivateAfter(userId: number, conversationId: string, messageId: string): Promise<number>;
  /** Makes one assistant message the active variant and deactivates its siblings atomically. */
  activateVariant(userId: number, messageId: string): Promise<boolean>;
  /** Removes messages created after the given message (edit-and-resubmit truncation). Returns count. */
  deleteMessagesAfter(userId: number, conversationId: string, messageId: string): Promise<number>;
  getByShareToken(token: string): Promise<ConvRow | null>;
  messagesForShared(conversationId: string): Promise<MsgRow[]>;
  deleteTemporaryOlderThan(cutoff: Date): Promise<number>;
}

export class ConversationError extends Error {
  constructor(readonly code: "NOT_FOUND" | "INVALID" | "CONFLICT", message: string) { super(message); this.name = "ConversationError"; }
}

export const TITLE_MAX = 120;
export function cleanTitle(raw: string): string {
  const t = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) throw new ConversationError("INVALID", "Title cannot be empty.");
  return t.slice(0, TITLE_MAX);
}

async function owned(store: ConversationStore, userId: number, id: string) {
  const c = await store.get(userId, id);
  if (!c) throw new ConversationError("NOT_FOUND", "Conversation not found.");
  return c;
}

export const listConversations = (s: ConversationStore, userId: number, f: { archived?: boolean; query?: string; limit?: number } = {}) =>
  s.list(userId, { archived: f.archived ?? false, query: f.query?.trim().slice(0, 100) || undefined, limit: Math.min(Math.max(f.limit ?? 50, 1), 100) });

export async function getConversationWithMessages(s: ConversationStore, userId: number, id: string) {
  const conversation = await owned(s, userId, id);
  return { conversation, messages: await s.messages(userId, id) };
}
export async function renameConversation(s: ConversationStore, userId: number, id: string, title: string) { await owned(s, userId, id); await s.update(userId, id, { title: cleanTitle(title) }); return owned(s, userId, id); }
export async function pinConversation(s: ConversationStore, userId: number, id: string, pinned: boolean) { await owned(s, userId, id); await s.update(userId, id, { pinned }); return owned(s, userId, id); }
export async function archiveConversation(s: ConversationStore, userId: number, id: string, archived: boolean) { await owned(s, userId, id); await s.update(userId, id, { status: archived ? "archived" : "active" }); return owned(s, userId, id); }
export async function deleteConversation(s: ConversationStore, userId: number, id: string) {
  await owned(s, userId, id);
  if (!(await s.deleteCascade(userId, id))) throw new ConversationError("NOT_FOUND", "Conversation not found.");
  return { deleted: true as const };
}

export async function shareConversation(s: ConversationStore, userId: number, id: string, enabled: boolean) {
  const c = await owned(s, userId, id);
  if (c.temporary && enabled) throw new ConversationError("CONFLICT", "Temporary chats cannot be shared.");
  if (!enabled) { await s.update(userId, id, { shareToken: null, sharedAt: null }); return { shared: false as const, token: null }; }
  if (c.shareToken) return { shared: true as const, token: c.shareToken };
  const token = randomBytes(24).toString("base64url");
  await s.update(userId, id, { shareToken: token, sharedAt: new Date() });
  return { shared: true as const, token };
}

/** Public, read-only snapshot by unguessable token. Exposes only role/content/sources/time: no user ids, run ids or feedback. */
export async function getSharedConversation(s: ConversationStore, token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new ConversationError("NOT_FOUND", "This shared conversation is unavailable.");
  const c = await s.getByShareToken(token);
  if (!c || c.temporary) throw new ConversationError("NOT_FOUND", "This shared conversation is unavailable.");
  const messages = activeOnly(await s.messagesForShared(c.id));
  return { title: c.title, sharedAt: c.sharedAt, messages: messages.map((m) => ({ id: m.id, role: m.role, content: m.content, sources: m.sources ?? null, createdAt: m.createdAt })) };
}

export async function setFeedback(s: ConversationStore, userId: number, messageId: string, feedback: "up" | "down" | null, note?: string | null) {
  const m = await s.getMessage(userId, messageId);
  if (!m) throw new ConversationError("NOT_FOUND", "Message not found.");
  if (m.role !== "assistant") throw new ConversationError("INVALID", "Feedback applies to assistant responses only.");
  await s.updateMessage(userId, messageId, { feedback, feedbackNote: feedback === "down" && note ? note.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 500) || null : null });
  return { messageId, feedback };
}

/** Edit a USER message: replaces its text and deletes every later message (there is no branching, so this is destructive; the UI must confirm). */
export async function editUserMessage(s: ConversationStore, userId: number, messageId: string, content: string) {
  const m = await s.getMessage(userId, messageId);
  if (!m) throw new ConversationError("NOT_FOUND", "Message not found.");
  if (m.role !== "user") throw new ConversationError("INVALID", "Only your own messages can be edited.");
  const text = content.trim();
  if (!text) throw new ConversationError("INVALID", "Message cannot be empty.");
  const removed = await s.deleteMessagesAfter(userId, m.conversationId, messageId);
  await s.updateMessage(userId, messageId, { content: text.slice(0, 50_000), editedAt: new Date() });
  return { messageId, removedMessages: removed, conversationId: m.conversationId };
}

export type ExportFormat = "markdown" | "json";
export async function exportConversation(s: ConversationStore, userId: number, id: string, format: ExportFormat) {
  const { conversation, messages: all } = await getConversationWithMessages(s, userId, id);
  const messages = activeOnly(all);
  const safe = conversation.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "conversation";
  if (format === "json") {
    return { filename: `${safe}.json`, mimeType: "application/json", content: JSON.stringify({ title: conversation.title, exportedAt: new Date().toISOString(), messages: messages.map((m) => ({ role: m.role, content: m.content, createdAt: m.createdAt.toISOString(), sources: m.sources ?? undefined })) }, null, 2) };
  }
  const lines = [`# ${conversation.title}`, "", `_Exported ${new Date().toISOString()}_`, ""];
  for (const m of messages) {
    lines.push(`## ${m.role === "user" ? "You" : "Geminio"} — ${m.createdAt.toISOString()}`, "", m.content, "");
    const src = Array.isArray(m.sources) ? (m.sources as { index?: number; title?: string; url?: string }[]) : [];
    if (src.length) { lines.push("Sources:"); for (const x of src) lines.push(`- [${x.index ?? ""}] ${x.title ?? x.url ?? ""} ${x.url ?? ""}`.trim()); lines.push(""); }
  }
  return { filename: `${safe}.md`, mimeType: "text/markdown", content: lines.join("\n") };
}

/** Retention sweep for temporary chats. Returns the number deleted. */
export const TEMPORARY_RETENTION_HOURS = 24;
export const sweepTemporaryConversations = (s: ConversationStore, now = new Date()) => s.deleteTemporaryOlderThan(new Date(now.getTime() - TEMPORARY_RETENTION_HOURS * 3_600_000));

/**
 * Regenerate the last answer: the previous answer(s) become inactive alternates (not deleted) and the last user text is
 * returned so the pipeline can run it again WITHOUT re-appending it. The new reply becomes the active variant.
 */
export async function prepareRegenerate(s: ConversationStore, userId: number, conversationId: string) {
  const { messages } = await getConversationWithMessages(s, userId, conversationId);
  const lastUserIdx = [...messages].map((m) => m.role).lastIndexOf("user");
  if (lastUserIdx < 0) throw new ConversationError("INVALID", "There is no message to regenerate a reply for.");
  const lastUser = messages[lastUserIdx];
  const kept = await s.deactivateAfter(userId, conversationId, lastUser.id);
  return { message: lastUser.content, userMessageId: lastUser.id, keptAsAlternates: kept };
}

export async function selectVariant(s: ConversationStore, userId: number, messageId: string) {
  const m = await s.getMessage(userId, messageId);
  if (!m) throw new ConversationError("NOT_FOUND", "Message not found.");
  if (m.role !== "assistant") throw new ConversationError("INVALID", "Only responses have variants.");
  if (!(await s.activateVariant(userId, messageId))) throw new ConversationError("NOT_FOUND", "Message not found.");
  return { messageId, conversationId: m.conversationId };
}
/** Only active messages are shown, exported, shared and sent to the model as context. */
export const activeOnly = <T extends { active: boolean }>(ms: T[]) => ms.filter((m) => m.active);

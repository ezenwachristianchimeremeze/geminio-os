import { describe, expect, it } from "vitest";
import * as C from "../server/home-chat/conversations";
import { SqliteConversationStore } from "./helpers/sqlite-conversation-store";

const world = () => {
  const s = new SqliteConversationStore();
  s.seedConversation({ id: "c1", userId: 1, title: "Trip planning" });
  s.seedConversation({ id: "c2", userId: 1, title: "Python help", lastMessageAt: new Date(Date.now() - 5000) });
  s.seedConversation({ id: "cx", userId: 2, title: "Other user's secret" });
  s.seedMessage({ id: "m1", userId: 1, conversationId: "c1", role: "user", content: "Where should I go in Lisbon?", at: 1 });
  s.seedMessage({ id: "m2", userId: 1, conversationId: "c1", role: "assistant", content: "Try Alfama.", sources: [{ index: 1, title: "Guide", url: "https://x.test/a" }], at: 2 });
  s.seedMessage({ id: "m3", userId: 1, conversationId: "c1", role: "user", content: "And food?", at: 3 });
  s.seedMessage({ id: "m4", userId: 1, conversationId: "c1", role: "assistant", content: "Pasteis de nata.", at: 4 });
  s.seedMessage({ id: "mx", userId: 2, conversationId: "cx", role: "user", content: "private lisbon note", at: 1 });
  return s;
};
const code = async (p: Promise<unknown>) => { try { await p; } catch (e) { return (e as C.ConversationError).code; } return "none"; };

describe("conversation list & search", () => {
  it("lists only the caller's active conversations, pinned first then newest", async () => {
    const s = world();
    await C.pinConversation(s, 1, "c2", true);
    const list = await C.listConversations(s, 1);
    expect(list.map((c) => c.id)).toEqual(["c2", "c1"]);
  });
  it("searches titles and message bodies, only within the caller's data", async () => {
    const s = world();
    expect((await C.listConversations(s, 1, { query: "lisbon" })).map((c) => c.id)).toEqual(["c1"]);
    expect((await C.listConversations(s, 1, { query: "python" })).map((c) => c.id)).toEqual(["c2"]);
    expect(await C.listConversations(s, 1, { query: "secret" })).toHaveLength(0);
  });
  it("treats % and _ in queries literally", async () => {
    const s = world();
    expect(await C.listConversations(s, 1, { query: "%" })).toHaveLength(0);
  });
  it("hides archived from the default list and shows them on request", async () => {
    const s = world();
    await C.archiveConversation(s, 1, "c1", true);
    expect((await C.listConversations(s, 1)).map((c) => c.id)).toEqual(["c2"]);
    expect((await C.listConversations(s, 1, { archived: true })).map((c) => c.id)).toEqual(["c1"]);
    await C.archiveConversation(s, 1, "c1", false);
    expect(await C.listConversations(s, 1, { archived: true })).toHaveLength(0);
  });
  it("never lists temporary chats", async () => {
    const s = world(); s.seedConversation({ id: "t1", userId: 1, title: "temp", temporary: true });
    expect((await C.listConversations(s, 1)).map((c) => c.id)).not.toContain("t1");
  });
});

describe("rename / pin / authorization", () => {
  it("renames with cleaned title", async () => {
    const s = world();
    expect((await C.renameConversation(s, 1, "c1", "  New\n name\t ")).title).toBe("New name");
  });
  it("rejects empty and truncates long titles", async () => {
    const s = world();
    expect(await code(C.renameConversation(s, 1, "c1", "   "))).toBe("INVALID");
    expect((await C.renameConversation(s, 1, "c1", "x".repeat(500))).title).toHaveLength(C.TITLE_MAX);
  });
  it("cannot touch another user's conversation in any operation", async () => {
    const s = world();
    for (const op of [
      () => C.renameConversation(s, 1, "cx", "hacked"), () => C.pinConversation(s, 1, "cx", true), () => C.archiveConversation(s, 1, "cx", true),
      () => C.deleteConversation(s, 1, "cx"), () => C.shareConversation(s, 1, "cx", true), () => C.exportConversation(s, 1, "cx", "json"), () => C.getConversationWithMessages(s, 1, "cx"),
    ]) expect(await code(op())).toBe("NOT_FOUND");
    expect((await s.get(2, "cx"))?.title).toBe("Other user's secret");
    expect(await s.messages(2, "cx")).toHaveLength(1);
  });
});

describe("delete", () => {
  it("removes the conversation and every message", async () => {
    const s = world();
    await C.deleteConversation(s, 1, "c1");
    expect(await s.get(1, "c1")).toBeNull();
    expect((s.db.prepare("SELECT COUNT(*) c FROM messages WHERE conversationId='c1'").get() as { c: number }).c).toBe(0);
    expect((s.db.prepare("SELECT COUNT(*) c FROM messages WHERE conversationId='cx'").get() as { c: number }).c).toBe(1);
  });
  it("a deleted conversation's share link stops working", async () => {
    const s = world();
    const { token } = await C.shareConversation(s, 1, "c1", true);
    await C.deleteConversation(s, 1, "c1");
    expect(await code(C.getSharedConversation(s, token!))).toBe("NOT_FOUND");
  });
  it("second delete is NOT_FOUND", async () => {
    const s = world(); await C.deleteConversation(s, 1, "c1");
    expect(await code(C.deleteConversation(s, 1, "c1"))).toBe("NOT_FOUND");
  });
});

describe("share", () => {
  it("creates a stable token, exposes a safe read-only snapshot, and can be revoked", async () => {
    const s = world();
    const a = await C.shareConversation(s, 1, "c1", true);
    const b = await C.shareConversation(s, 1, "c1", true);
    expect(a.token).toBe(b.token);
    expect(a.token!.length).toBeGreaterThanOrEqual(20);
    const shared = await C.getSharedConversation(s, a.token!);
    expect(shared.messages).toHaveLength(4);
    expect(JSON.stringify(shared)).not.toMatch(/userId|runId|feedback/);
    await C.shareConversation(s, 1, "c1", false);
    expect(await code(C.getSharedConversation(s, a.token!))).toBe("NOT_FOUND");
  });
  it("rejects malformed tokens without touching the store", async () => {
    const s = world();
    expect(await code(C.getSharedConversation(s, "short"))).toBe("NOT_FOUND");
    expect(await code(C.getSharedConversation(s, "a".repeat(30) + "'; DROP TABLE"))).toBe("NOT_FOUND");
  });
  it("temporary chats cannot be shared", async () => {
    const s = world(); s.seedConversation({ id: "t1", userId: 1, title: "t", temporary: true });
    expect(await code(C.shareConversation(s, 1, "t1", true))).toBe("CONFLICT");
  });
});

describe("feedback", () => {
  it("stores, changes, and clears feedback on assistant messages", async () => {
    const s = world();
    await C.setFeedback(s, 1, "m2", "up");
    expect((await s.getMessage(1, "m2"))?.feedback).toBe("up");
    await C.setFeedback(s, 1, "m2", "down", "wrong\nfact");
    const m = await s.getMessage(1, "m2");
    expect(m?.feedback).toBe("down"); expect(m?.feedbackNote).toBe("wrong fact");
    await C.setFeedback(s, 1, "m2", null);
    expect((await s.getMessage(1, "m2"))?.feedback).toBeNull();
  });
  it("rejects user messages and other users' messages", async () => {
    const s = world();
    expect(await code(C.setFeedback(s, 1, "m1", "up"))).toBe("INVALID");
    expect(await code(C.setFeedback(s, 1, "mx", "up"))).toBe("NOT_FOUND");
  });
});

describe("edit user message", () => {
  it("updates text and removes later messages", async () => {
    const s = world();
    const r = await C.editUserMessage(s, 1, "m1", "Where in Porto?");
    expect(r.removedMessages).toBe(3);
    const msgs = await s.messages(1, "c1");
    expect(msgs.map((m) => m.id)).toEqual(["m1"]);
    expect(msgs[0].content).toBe("Where in Porto?"); expect(msgs[0].editedAt).not.toBeNull();
  });
  it("rejects assistant messages, blank text, foreign messages", async () => {
    const s = world();
    expect(await code(C.editUserMessage(s, 1, "m2", "x"))).toBe("INVALID");
    expect(await code(C.editUserMessage(s, 1, "m1", " "))).toBe("INVALID");
    expect(await code(C.editUserMessage(s, 1, "mx", "x"))).toBe("NOT_FOUND");
    expect(await s.messages(1, "c1")).toHaveLength(4);
  });
});

describe("export", () => {
  it("exports markdown with sources and JSON round-trips", async () => {
    const s = world();
    const md = await C.exportConversation(s, 1, "c1", "markdown");
    expect(md.filename.endsWith(".md")).toBe(true);
    expect(md.content).toContain("Try Alfama.");
    expect(md.content).toContain("https://x.test/a");
    const js = await C.exportConversation(s, 1, "c1", "json");
    expect(JSON.parse(js.content).messages).toHaveLength(4);
  });
  it("sanitises the filename", async () => {
    const s = world(); await C.renameConversation(s, 1, "c1", "../../etc/passwd:*?");
    expect((await C.exportConversation(s, 1, "c1", "json")).filename).not.toMatch(/[\\/:*?]/);
  });
});

describe("temporary chat retention", () => {
  it("sweeps only old temporary conversations and their messages", async () => {
    const s = world();
    const old = new Date(Date.now() - 48 * 3_600_000);
    s.seedConversation({ id: "t_old", userId: 1, title: "old", temporary: true, createdAt: old });
    s.seedConversation({ id: "t_new", userId: 1, title: "new", temporary: true });
    s.seedMessage({ id: "tm", userId: 1, conversationId: "t_old", role: "user", content: "x" });
    expect(await C.sweepTemporaryConversations(s)).toBe(1);
    expect(await s.get(1, "t_old")).toBeNull();
    expect(await s.get(1, "t_new")).not.toBeNull();
    expect(await s.get(1, "c1")).not.toBeNull();
    expect((s.db.prepare("SELECT COUNT(*) c FROM messages WHERE conversationId='t_old'").get() as { c: number }).c).toBe(0);
  });
});

describe("response variants (branching of answers)", () => {
  it("regenerate keeps the old answer as an inactive alternate; the new reply is the active variant", async () => {
    const s = world();
    const prep = await C.prepareRegenerate(s, 1, "c1");
    expect(prep).toMatchObject({ message: "And food?", userMessageId: "m3", keptAsAlternates: 1 });
    expect((await s.getMessage(1, "m4"))).toMatchObject({ active: false, variantOf: "m3" });
    s.seedReply({ id: "m5", userId: 1, conversationId: "c1", content: "Try a tasca.", variantOf: "m3", at: Date.now() + 10 });
    const all = await s.messages(1, "c1");
    expect(all.filter((m) => m.active).map((m) => m.id)).toEqual(["m1", "m2", "m3", "m5"]);
    expect(all.filter((m) => m.variantOf === "m3").map((m) => m.id)).toEqual(["m4", "m5"]);
  });
  it("switching variants activates exactly one sibling and leaves earlier turns alone", async () => {
    const s = world();
    await C.prepareRegenerate(s, 1, "c1");
    s.seedReply({ id: "m5", userId: 1, conversationId: "c1", content: "Try a tasca.", variantOf: "m3", at: Date.now() + 10 });
    await C.selectVariant(s, 1, "m4");
    const all = await s.messages(1, "c1");
    expect(all.filter((m) => m.active && m.role === "assistant").map((m) => m.id).sort()).toEqual(["m2", "m4"]);
    await C.selectVariant(s, 1, "m5");
    expect((await s.messages(1, "c1")).find((m) => m.id === "m4")?.active).toBe(false);
  });
  it("repeated regeneration accumulates alternates; activeOnly drives export and share", async () => {
    const s = world();
    await C.prepareRegenerate(s, 1, "c1");
    s.seedReply({ id: "m5", userId: 1, conversationId: "c1", content: "ALT-B", variantOf: "m3", at: Date.now() + 10 });
    await C.prepareRegenerate(s, 1, "c1");
    s.seedReply({ id: "m6", userId: 1, conversationId: "c1", content: "ALT-C", variantOf: "m3", at: Date.now() + 20 });
    expect((await s.messages(1, "c1")).filter((m) => m.variantOf === "m3")).toHaveLength(3);
    const md = await C.exportConversation(s, 1, "c1", "markdown");
    expect(md.content).toContain("ALT-C"); expect(md.content).not.toContain("ALT-B"); expect(md.content).not.toContain("Pasteis de nata.");
    const { token } = await C.shareConversation(s, 1, "c1", true);
    expect((await C.getSharedConversation(s, token!)).messages.map((m) => m.content)).not.toContain("ALT-B");
  });
  it("cannot switch another user's or a user message", async () => {
    const s = world();
    expect(await code(C.selectVariant(s, 1, "mx"))).toBe("NOT_FOUND");
    expect(await code(C.selectVariant(s, 1, "m1"))).toBe("INVALID");
  });
});

/**
 * Cross-module Home Chat flow on REAL SQL transactions (node:sqlite stand-in for MySQL):
 * send -> reserve -> (stand-in AI Core persists the turn) -> terminal run -> settle -> read back,
 * then export / share / delete and cross-user isolation. The AI Core step is a stand-in; MySQL adapters,
 * tRPC and the orchestrator glue are NOT exercised here.
 */
import { describe, expect, it } from "vitest";
import { getRunView, sendHomeMessage, type PipelineDeps, type RunDeps, type RunRecord, type SubmitFn } from "../server/home-chat/pipeline";
import { getBalance, toMicro, type Reservation } from "../server/credits/ledger";
import { deleteConversation, exportConversation, getConversationWithMessages, getSharedConversation, listConversations, shareConversation, setFeedback } from "../server/home-chat/conversations";
import { SqliteCreditStore } from "./helpers/sqlite-credit-store";
import { SqliteConversationStore } from "./helpers/sqlite-conversation-store";

let n = 0;
function world(credits = 10) {
  const credit = new SqliteCreditStore(); credit.seed(1, toMicro(credits)); credit.seed(2, toMicro(credits));
  const convs = new SqliteConversationStore();
  const runs = new Map<string, RunRecord & { userId: number }>();
  const submit: SubmitFn = async (userId, input) => {
    const convId = input.conversationId ?? `conv_${++n}`;
    if (!input.conversationId) convs.seedConversation({ id: convId, userId, title: input.message.slice(0, 40) });
    convs.seedMessage({ id: `u_${++n}`, userId, conversationId: convId, role: "user", content: input.message });
    const runId = `run_${++n}`;
    runs.set(runId, { id: runId, userId, requestId: input.requestId, status: "executing", result: null, error: null, capability: "conversation.reply", conversationId: convId, taskId: `t_${runId}` });
    return { runId, taskId: `t_${runId}`, conversationId: convId, status: "accepted", error: null };
  };
  const pipeline: PipelineDeps = { credits: credit, searchProvider: null, submit, kickWorker: () => {}, env: {}, newId: (p) => `${p}_${++n}`, audit: async () => {} };
  const runDeps: RunDeps = {
    credits: credit, env: {},
    getRun: async (u, id) => { const r = runs.get(id); return r && r.userId === u ? r : null; },
    getEvents: async () => [],
    findReservation: async (u, r) => credit.db.prepare("SELECT * FROM reservations WHERE userId=? AND requestId=?").get(u, r) as unknown as Reservation | null,
  };
  const complete = (runId: string, text: string) => { const r = runs.get(runId)!; r.status = "completed"; r.result = { output: { text } }; convs.seedMessage({ id: `a_${++n}`, userId: r.userId, conversationId: r.conversationId!, role: "assistant", content: text }); };
  return { credit, convs, pipeline, runDeps, runs, complete };
}
const input = { message: "Summarise the plan", conversationId: null, webSearch: "off" as const, temporary: false };

describe("Home chat end to end (SQL stand-in)", () => {
  it("reserves on send, charges exactly once on completion, persists the turn", async () => {
    const w = world();
    const sent = await sendHomeMessage(w.pipeline, 1, input);
    expect(sent.ok).toBe(true); if (!sent.ok) return;
    expect(await getBalance(w.credit, 1)).toEqual({ balance: 10, reserved: 1, available: 9 });
    w.complete(sent.runId, "Here is the summary.");
    const views = await Promise.all([getRunView(w.runDeps, 1, sent.runId), getRunView(w.runDeps, 1, sent.runId), getRunView(w.runDeps, 1, sent.runId)]);
    expect(views.every((v) => v?.terminal)).toBe(true);
    expect(await getBalance(w.credit, 1)).toEqual({ balance: 9, reserved: 0, available: 9 });
    expect(w.credit.ledger(1)).toHaveLength(1);
    const conv = await getConversationWithMessages(w.convs, 1, sent.conversationId);
    expect(conv.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  });
  it("a retried send with the same client id does not double-reserve; a failed run is never charged", async () => {
    const w = world();
    const a = await sendHomeMessage(w.pipeline, 1, { ...input, clientRequestId: "same-req-0001" });
    await sendHomeMessage(w.pipeline, 1, { ...input, clientRequestId: "same-req-0001" });
    expect((await getBalance(w.credit, 1)).reserved).toBe(1);
    if (!a.ok) throw new Error("send failed");
    const r = w.runs.get(a.runId)!; r.status = "failed"; r.error = { message: "provider down", retryable: true };
    await getRunView(w.runDeps, 1, a.runId);
    expect(await getBalance(w.credit, 1)).toEqual({ balance: 10, reserved: 0, available: 10 });
  });
  it("insufficient credits starts nothing and writes no conversation", async () => {
    const w = world(0);
    const sent = await sendHomeMessage(w.pipeline, 1, input);
    expect(sent).toMatchObject({ ok: false, code: "INSUFFICIENT_CREDITS" });
    expect(await listConversations(w.convs, 1)).toHaveLength(0); expect(w.runs.size).toBe(0);
  });
  it("another user can neither read the run, the conversation, nor give feedback on its messages", async () => {
    const w = world();
    const sent = await sendHomeMessage(w.pipeline, 1, input); if (!sent.ok) throw new Error("send failed");
    w.complete(sent.runId, "private answer");
    expect(await getRunView(w.runDeps, 2, sent.runId)).toBeNull();
    await expect(getConversationWithMessages(w.convs, 2, sent.conversationId)).rejects.toBeDefined();
    const msgs = (await getConversationWithMessages(w.convs, 1, sent.conversationId)).messages;
    await expect(setFeedback(w.convs, 2, msgs[1].id, "up")).rejects.toBeDefined();
    expect(await listConversations(w.convs, 2)).toHaveLength(0);
  });
  it("export, share (public read by token) and delete behave and delete removes messages", async () => {
    const w = world();
    const sent = await sendHomeMessage(w.pipeline, 1, input); if (!sent.ok) throw new Error("send failed");
    w.complete(sent.runId, "Shareable answer");
    const exp = await exportConversation(w.convs, 1, sent.conversationId, "markdown");
    expect(exp.content).toContain("Shareable answer");
    const shared = await shareConversation(w.convs, 1, sent.conversationId, true);
    const token = (shared as { shareToken?: string }).shareToken ?? (shared as { token?: string }).token;
    expect(typeof token).toBe("string");
    const pub = await getSharedConversation(w.convs, String(token));
    expect(JSON.stringify(pub)).toContain("Shareable answer");
    await deleteConversation(w.convs, 1, sent.conversationId);
    expect(await listConversations(w.convs, 1)).toHaveLength(0);
    expect(await w.convs.messages(1, sent.conversationId)).toHaveLength(0);
  });
  it("concurrent sends can never reserve more than the balance", async () => {
    const w = world(3);
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => sendHomeMessage(w.pipeline, 1, { ...input, clientRequestId: `client-req-${i}-xx` })));
    const ok = results.filter((r) => r.ok).length;
    expect(ok).toBeLessThanOrEqual(3);
    const bal = await getBalance(w.credit, 1);
    expect(bal.reserved).toBeLessThanOrEqual(3); expect(bal.available).toBeGreaterThanOrEqual(0);
  });
});

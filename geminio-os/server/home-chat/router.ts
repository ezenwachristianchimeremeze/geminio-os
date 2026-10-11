import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { cancelGatewayRun } from "../ai-core/gateway";
import { runControlCall } from "../ai-core/run-control";
import { CreditError, finalizeReservation, getBalance, priceFor, releaseReservation, reserveCredits } from "../credits/ledger";
import { getMysqlCreditStore } from "../credits/mysql-store";
import * as C from "./conversations";
import { listPlanTypes } from "../ai-core/multistep";
import { pauseAiRun, resumePausedRun } from "../ai-core/orchestrator";
import { listOrchestrationRuns } from "../ai-core/persistence";
import { buildPreview, summarizeRun, getRunView, sendHomeMessage } from "./pipeline";
import { conversationStore, loadPreferences, newId, pipelineDeps, runDeps, savePreferences } from "./service";
import { MAX_INSTRUCTIONS, STYLES } from "./preferences";
import { resolveSttProvider, transcribe } from "./stt";
import { resolveSearchProvider } from "./web-search";
import { describeAttachmentIntent } from "./intents";
import { FileGenError, generateFile, verifyStored } from "./files";
import { storageGetSignedUrl, storagePut } from "../storage";
import { createSchedule, deleteSchedule, ScheduleError, setScheduleStatus } from "./schedule";
import { getMysqlScheduleStore } from "./schedule-store";
import { resolveSandbox, runCode } from "./code-run";
import { runMetered } from "../credits/metered-llm";
import { ActionError, clientView, decideAction, proposeAction } from "./actions";
import { actionDeps } from "./service";
import { AttachmentError } from "./attachments";
import { uploadAttachment } from "./attachment-service";

const planSelectionInput = z.object({ type: z.string().min(1).max(40), roleIds: z.array(z.string().min(1).max(32)).max(8).optional() });
const convId = z.string().min(1).max(64);
const msgId = z.string().min(1).max(64);

function mapError<T>(run: () => Promise<T>): Promise<T> {
  return run().catch((e) => {
    if (e instanceof TRPCError) throw e;
    if (e instanceof C.ConversationError) throw new TRPCError({ code: e.code === "NOT_FOUND" ? "NOT_FOUND" : e.code === "CONFLICT" ? "CONFLICT" : "BAD_REQUEST", message: e.message });
    if (e instanceof CreditError) throw new TRPCError({ code: e.code === "INSUFFICIENT_CREDITS" ? "PRECONDITION_FAILED" : "BAD_REQUEST", message: e.message });
    throw e;
  });
}

function mapScheduleError<T>(run: () => Promise<T>): Promise<T> {
  return run().catch((e) => { if (e instanceof ScheduleError) throw new TRPCError({ code: e.code === "NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST", message: e.message }); throw e; });
}

function mapActionError<T>(run: () => Promise<T>): Promise<T> {
  return run().catch((e) => { if (e instanceof ActionError) throw new TRPCError({ code: e.code === "NOT_FOUND" ? "NOT_FOUND" : e.code === "CONFLICT" || e.code === "EXPIRED" ? "CONFLICT" : e.code === "UNAVAILABLE" ? "PRECONDITION_FAILED" : "BAD_REQUEST", message: e.message }); throw e; });
}

// Per-user sliding window for transcription (AI Core rate-limits chat itself).
const sttHits = new Map<number, number[]>();
function sttAllowed(userId: number, now = Date.now()) {
  const hits = (sttHits.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (hits.length >= 10) { sttHits.set(userId, hits); return false; }
  hits.push(now); sttHits.set(userId, hits); return true;
}

export const homeChatRouter = router({
  /** What this server can truthfully do right now (drives which controls the UI enables). */
  config: protectedProcedure.query(() => ({
    webSearch: resolveSearchProvider(process.env) !== null,
    speechToText: resolveSttProvider(process.env) !== null,
    // Incremental text only on the built-in OpenAI-compatible endpoint; other providers answer all at once.
    streaming: Boolean(process.env.BUILT_IN_FORGE_API_KEY),
    codeExecution: resolveSandbox(process.env) !== null,
    maxMessageChars: 20_000,
    temporaryRetentionHours: C.TEMPORARY_RETENTION_HOURS,
  })),

  preferences: router({
    get: protectedProcedure.query(({ ctx }) => loadPreferences(ctx.user.id)),
    set: protectedProcedure.input(z.object({ customInstructions: z.string().max(MAX_INSTRUCTIONS).default(""), responseStyle: z.enum(STYLES).default("balanced"), language: z.string().max(16).nullable().default(null), aiLevel: z.string().max(32).default("standard") })).mutation(({ input, ctx }) => savePreferences(ctx.user.id, input)),
  }),

  planTypes: protectedProcedure.query(() => listPlanTypes()),

  balance: protectedProcedure.query(async ({ ctx }) => mapError(async () => getBalance(await getMysqlCreditStore(), ctx.user.id))),

  send: protectedProcedure
    .input(z.object({
      message: z.string().max(20_100),
      conversationId: convId.nullable().default(null),
      webSearch: z.enum(["auto", "on", "off"]).default("auto"),
      temporary: z.boolean().default(false),
      plan: planSelectionInput.nullable().optional(),
      context: z.object({ historyMode: z.enum(["conversation", "message_only"]).default("conversation"), conversationIds: z.array(z.string().max(64)).max(3).default([]), workspaceId: z.string().max(64).nullable().default(null) }).nullable().optional(),
      clientRequestId: z.string().max(64).nullable().optional(),
      language: z.string().max(16).nullable().optional(),
      attachmentIds: z.array(z.string().max(64)).max(5).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.conversationId) await mapError(async () => C.getConversationWithMessages(await conversationStore(), ctx.user.id, input.conversationId!));
      const result = await sendHomeMessage(await pipelineDeps(), ctx.user.id, input);
      if (!result.ok) throw new TRPCError({ code: result.code === "INSUFFICIENT_CREDITS" ? "PRECONDITION_FAILED" : result.code === "INVALID" ? "BAD_REQUEST" : result.code === "RATE_LIMITED" ? "TOO_MANY_REQUESTS" : "SERVICE_UNAVAILABLE", message: result.message });
      return result;
    }),

  /** AI action preview: what will run and what it will cost, from server pricing and the server-side balance. Runs nothing. */
  preview: protectedProcedure.input(z.object({ message: z.string().min(1).max(20_100), plan: planSelectionInput.nullable().optional(), webSearch: z.enum(["auto", "on", "off"]).default("auto") })).query(async ({ input, ctx }) => {
    let available: number | null = null;
    try { available = (await getBalance(await getMysqlCreditStore(), ctx.user.id)).available; } catch { available = null; }
    return buildPreview(input, process.env, available);
  }),

  /** Re-run the last user message and replace the previous answer. */
  regenerate: protectedProcedure.input(z.object({ conversationId: convId, webSearch: z.enum(["auto", "on", "off"]).default("auto") })).mutation(async ({ input, ctx }) => {
    const store = await conversationStore();
    const prep = await mapError(() => C.prepareRegenerate(store, ctx.user.id, input.conversationId));
    const result = await sendHomeMessage(await pipelineDeps(), ctx.user.id, { message: prep.message, conversationId: input.conversationId, webSearch: input.webSearch, temporary: false, skipUserMessage: true });
    if (!result.ok) throw new TRPCError({ code: result.code === "INSUFFICIENT_CREDITS" ? "PRECONDITION_FAILED" : "SERVICE_UNAVAILABLE", message: result.message });
    return result;
  }),

  /** Poll a run: real status, real step events, final text/sources, and settlement of its credit reservation. */
  run: protectedProcedure.input(z.object({ runId: z.string().min(1).max(64) })).query(async ({ input, ctx }) => {
    const view = await getRunView(await runDeps(), ctx.user.id, input.runId);
    if (!view) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found." });
    return view;
  }),

  actions: router({
    types: protectedProcedure.query(async () => { const { ACTION_REGISTRY } = await import("./service"); return Object.values(ACTION_REGISTRY).map((d) => ({ type: d.type, label: d.label, available: Boolean(d.execute), unavailableReason: d.execute ? null : d.unavailableReason ?? null })); }),
    list: protectedProcedure.query(async ({ ctx }) => (await (await actionDeps()).store.list(ctx.user.id, 10)).map(clientView)),
    propose: protectedProcedure.input(z.object({ type: z.string().min(1).max(40), workspaceId: z.string().max(64).optional() })).mutation(({ input, ctx }) => mapActionError(async () => clientView(await proposeAction(await actionDeps(), ctx.user.id, { type: input.type, params: { workspaceId: input.workspaceId } })))),
    decide: protectedProcedure.input(z.object({ id: z.string().min(1).max(64), decision: z.enum(["approve", "reject", "cancel"]) })).mutation(({ input, ctx }) => mapActionError(async () => clientView(await decideAction(await actionDeps(), ctx.user.id, input.id, input.decision)))),
  }),

  schedules: router({
    list: protectedProcedure.query(async ({ ctx }) => (await (await getMysqlScheduleStore()).list(ctx.user.id)).map((r) => ({ id: r.id, kind: r.kind, title: r.title, prompt: r.prompt, recurrence: r.recurrence, timezone: r.timezone, timeOfDay: r.timeOfDay, nextRunAt: r.nextRunAt, lastRunAt: r.lastRunAt, status: r.status }))),
    create: protectedProcedure.input(z.object({ kind: z.enum(["reminder", "prompt"]), title: z.string().min(1).max(200), prompt: z.string().max(2100).nullable().optional(), recurrence: z.discriminatedUnion("kind", [z.object({ kind: z.literal("once") }), z.object({ kind: z.literal("daily") }), z.object({ kind: z.literal("weekly"), days: z.array(z.number().int().min(0).max(6)).min(1).max(7) })]), timezone: z.string().min(1).max(64), timeOfDay: z.string().max(5), onceDate: z.string().max(10).optional() })).mutation(({ input, ctx }) => mapScheduleError(async () => { const r = await createSchedule(await getMysqlScheduleStore(), ctx.user.id, input, { now: new Date(), id: newId("sched") }); return { id: r.id, nextRunAt: r.nextRunAt }; })),
    setStatus: protectedProcedure.input(z.object({ id: z.string().min(1).max(64), status: z.enum(["active", "paused"]) })).mutation(({ input, ctx }) => mapScheduleError(async () => { await setScheduleStatus(await getMysqlScheduleStore(), ctx.user.id, input.id, input.status, new Date()); return { ok: true as const }; })),
    delete: protectedProcedure.input(z.object({ id: z.string().min(1).max(64) })).mutation(({ input, ctx }) => mapScheduleError(async () => { await deleteSchedule(await getMysqlScheduleStore(), ctx.user.id, input.id); return { ok: true as const }; })),
  }),

  tasks: router({
    list: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).default({ limit: 20 })).query(async ({ input, ctx }) => (await listOrchestrationRuns(ctx.user.id, input.limit)).filter((r) => r.capability === "conversation.reply" || r.requestId.startsWith("home_")).map((r) => summarizeRun(r))),
    pause: protectedProcedure.input(z.object({ runId: z.string().min(1).max(64) })).mutation(async ({ input, ctx }) => { return runControlCall(() => pauseAiRun(ctx.user.id, input.runId)); }),
    resume: protectedProcedure.input(z.object({ runId: z.string().min(1).max(64) })).mutation(async ({ input, ctx }) => { const r = await runControlCall(() => resumePausedRun(ctx.user.id, input.runId)); const { runAiWorkerOnce } = await import("../ai-core/orchestrator"); void runAiWorkerOnce().catch(() => undefined); return r; }),
  }),

  /** Stop generation: cancels the durable run and releases the credit hold. */
  stop: protectedProcedure.input(z.object({ runId: z.string().min(1).max(64) })).mutation(async ({ input, ctx }) => {
    const result = await runControlCall(() => cancelGatewayRun(ctx.user.id, input.runId));
    const deps = await runDeps();
    const view = await getRunView(deps, ctx.user.id, input.runId);
    return { status: result.status, creditsCharged: view?.creditsCharged ?? null };
  }),

  transcribe: protectedProcedure
    .input(z.object({ audioBase64: z.string().min(8).max(17_500_000), mimeType: z.string().min(3).max(100), language: z.string().max(16).nullable().optional() }))
    .mutation(async ({ input, ctx }) => {
      if (!sttAllowed(ctx.user.id)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many recordings in a short time. Wait a moment and try again." });
      const provider = resolveSttProvider(process.env);
      if (!provider) return { status: "unavailable" as const, reason: "Speech recognition is not configured on this server. You can type your message instead." };
      const credits = await getMysqlCreditStore();
      const price = priceFor("voice.transcribe", process.env).credits;
      const reservation = await mapError(() => reserveCredits(credits, { userId: ctx.user.id, requestId: newId("stt"), capability: "voice.transcribe", credits: price, id: newId("reservation") }));
      const outcome = await transcribe(provider, input);
      // Only a successful transcription is charged; every other outcome releases the hold.
      if (outcome.status === "ok") await finalizeReservation(credits, reservation.id, price); else await releaseReservation(credits, reservation.id);
      return outcome;
    }),

  uploadAttachment: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(255), mimeType: z.string().max(100).default(""), dataBase64: z.string().min(4).max(14_500_000) }))
    .mutation(async ({ input, ctx }) => {
      if (!sttAllowed(ctx.user.id + 0.5)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many uploads in a short time. Wait a moment and try again." });
      try { return await uploadAttachment(ctx.user.id, input); }
      catch (e) {
        if (e instanceof AttachmentError) throw new TRPCError({ code: e.code === "TOO_LARGE" ? "PAYLOAD_TOO_LARGE" : "BAD_REQUEST", message: e.message });
        throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "The file could not be stored. Try again shortly." });
      }
    }),

  /** Turn a response into a real file. Success is reported only after the stored bytes are read back and match. */
  generateFile: protectedProcedure.input(z.object({ messageId: msgId, format: z.enum(["md", "txt", "csv", "pdf", "docx", "xlsx"]) })).mutation(async ({ input, ctx }) => {
    if (!sttAllowed(ctx.user.id + 0.25)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many files in a short time. Wait a moment and try again." });
    const store = await conversationStore();
    const m = await store.getMessage(ctx.user.id, input.messageId);
    if (!m || m.role !== "assistant") throw new TRPCError({ code: "NOT_FOUND", message: "Response not found." });
    const conv = await store.get(ctx.user.id, m.conversationId);
    let g;
    try { g = generateFile({ content: m.content, format: input.format, title: conv?.title ?? "geminio" }); }
    catch (e) { if (e instanceof FileGenError) throw new TRPCError({ code: "BAD_REQUEST", message: e.message }); throw e; }
    try {
      const key = `home-chat/${ctx.user.id}/exports/${newId("file")}-${g.filename}`;
      const stored = await storagePut(key, g.bytes, g.mimeType);
      const url = await storageGetSignedUrl(stored.key);
      const back = new Uint8Array(await (await fetch(url)).arrayBuffer());
      if (!verifyStored(g, back)) throw new Error("verification failed");
      return { filename: g.filename, mimeType: g.mimeType, sizeBytes: g.sizeBytes, url };
    } catch { throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "The file could not be stored and verified, so no file was created. Try again shortly." }); }
  }),

  /** Run a code block in the isolated sandbox service. Never executes anything on this server. Charged only when the sandbox actually ran it. */
  runCode: protectedProcedure.input(z.object({ language: z.string().max(20), code: z.string().max(25_000) })).mutation(async ({ input, ctx }) => {
    if (!sttAllowed(ctx.user.id + 0.75)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many runs in a short time. Wait a moment and try again." });
    const runner = resolveSandbox(process.env);
    if (!runner) return runCode(null, input); // truthful "unavailable": nothing reserved, nothing run
    try {
      return await runMetered(await getMysqlCreditStore(), process.env, { userId: ctx.user.id, capability: "code.run" }, async () => {
        const out = await runCode(runner, input);
        if (out.status !== "ok") throw Object.assign(new Error(out.status === "invalid" || out.status === "unavailable" || out.status === "failed" ? out.reason : "failed"), { outcome: out });
        return out;
      });
    } catch (e) {
      const outcome = (e as { outcome?: unknown }).outcome; // not charged: runMetered released the reservation
      if (outcome) return outcome as Awaited<ReturnType<typeof runCode>>;
      if (e instanceof Error && e.name === "InsufficientCreditsError") throw new TRPCError({ code: "PRECONDITION_FAILED", message: e.message });
      throw e;
    }
  }),

  attachmentGuidance: protectedProcedure.input(z.object({ kind: z.enum(["image", "pdf", "text", "code", "other"]) })).query(({ input }) => ({ instruction: describeAttachmentIntent(input.kind) })),

  conversations: router({
    list: protectedProcedure.input(z.object({ archived: z.boolean().default(false), query: z.string().max(100).optional(), limit: z.number().int().min(1).max(100).default(50) }).default({ archived: false, limit: 50 })).query(async ({ input, ctx }) =>
      (await C.listConversations(await conversationStore(), ctx.user.id, input)).map((c) => ({ id: c.id, title: c.title, pinned: c.pinned, status: c.status, shared: c.shareToken !== null, lastMessageAt: c.lastMessageAt, createdAt: c.createdAt }))),
    get: protectedProcedure.input(z.object({ id: convId })).query(({ input, ctx }) => mapError(async () => {
      const { conversation, messages } = await C.getConversationWithMessages(await conversationStore(), ctx.user.id, input.id);
      return {
        conversation: { id: conversation.id, title: conversation.title, pinned: conversation.pinned, status: conversation.status, temporary: conversation.temporary, shared: conversation.shareToken !== null, lastMessageAt: conversation.lastMessageAt },
        messages: messages.map((m) => ({ id: m.id, role: m.role, content: m.content, runId: m.runId, feedback: m.feedback, status: m.status, sources: m.sources, attachments: m.attachments, editedAt: m.editedAt, active: m.active, variantOf: m.variantOf, createdAt: m.createdAt })),
      };
    })),
    rename: protectedProcedure.input(z.object({ id: convId, title: z.string().min(1).max(500) })).mutation(({ input, ctx }) => mapError(async () => { const c = await C.renameConversation(await conversationStore(), ctx.user.id, input.id, input.title); return { id: c.id, title: c.title }; })),
    pin: protectedProcedure.input(z.object({ id: convId, pinned: z.boolean() })).mutation(({ input, ctx }) => mapError(async () => { const c = await C.pinConversation(await conversationStore(), ctx.user.id, input.id, input.pinned); return { id: c.id, pinned: c.pinned }; })),
    archive: protectedProcedure.input(z.object({ id: convId, archived: z.boolean() })).mutation(({ input, ctx }) => mapError(async () => { const c = await C.archiveConversation(await conversationStore(), ctx.user.id, input.id, input.archived); return { id: c.id, status: c.status }; })),
    delete: protectedProcedure.input(z.object({ id: convId })).mutation(({ input, ctx }) => mapError(async () => C.deleteConversation(await conversationStore(), ctx.user.id, input.id))),
    share: protectedProcedure.input(z.object({ id: convId, enabled: z.boolean() })).mutation(({ input, ctx }) => mapError(async () => C.shareConversation(await conversationStore(), ctx.user.id, input.id, input.enabled))),
    export: protectedProcedure.input(z.object({ id: convId, format: z.enum(["markdown", "json"]) })).mutation(({ input, ctx }) => mapError(async () => C.exportConversation(await conversationStore(), ctx.user.id, input.id, input.format))),
  }),

  messages: router({
    feedback: protectedProcedure.input(z.object({ messageId: msgId, feedback: z.enum(["up", "down"]).nullable(), note: z.string().max(500).nullable().optional() })).mutation(({ input, ctx }) => mapError(async () => C.setFeedback(await conversationStore(), ctx.user.id, input.messageId, input.feedback, input.note))),
    selectVariant: protectedProcedure.input(z.object({ messageId: msgId })).mutation(({ input, ctx }) => mapError(async () => C.selectVariant(await conversationStore(), ctx.user.id, input.messageId))),
    edit: protectedProcedure.input(z.object({ messageId: msgId, content: z.string().min(1).max(20_000), webSearch: z.enum(["auto", "on", "off"]).default("auto") })).mutation(async ({ input, ctx }) => {
      const store = await conversationStore();
      const edited = await mapError(() => C.editUserMessage(store, ctx.user.id, input.messageId, input.content));
      const result = await sendHomeMessage(await pipelineDeps(), ctx.user.id, { message: input.content, conversationId: edited.conversationId, webSearch: input.webSearch, temporary: false, skipUserMessage: true });
      if (!result.ok) throw new TRPCError({ code: result.code === "INSUFFICIENT_CREDITS" ? "PRECONDITION_FAILED" : "SERVICE_UNAVAILABLE", message: result.message });
      return { ...result, removedMessages: edited.removedMessages };
    }),
  }),

  /** Public, read-only, token-addressed. Returns role/content/sources only. */
  shared: publicProcedure.input(z.object({ token: z.string().min(20).max(64) })).query(({ input }) => mapError(async () => C.getSharedConversation(await conversationStore(), input.token))),
});

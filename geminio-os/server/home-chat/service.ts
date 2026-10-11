/** Wires the pure Home chat modules to the real server dependencies (MySQL stores, AI Core, provider env). */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { creditReservations, homeChatPreferences } from "../../drizzle/schema";
import { DEFAULT_PREFERENCES, normalizePreferences, type Preferences } from "./preferences";
import { runAiWorkerOnce } from "../ai-core/orchestrator";
import { submitGatewayRequest } from "../ai-core/gateway";
import { getOrchestrationRun, listTaskEvents } from "../ai-core/persistence";
import { recordAiAudit } from "../ai-core/security";
import { getMysqlCreditStore } from "../credits/mysql-store";
import { getDb } from "../db";
import type { Reservation } from "../credits/ledger";
import { readLiveBuilderStoredFiles } from "../live-builder/service";
import type { ContextSelection, LoadedContext } from "./context";
import { loadAttachments } from "./attachment-service";
import { getMysqlConversationStore } from "./mysql-store";
import type { PipelineDeps, RunDeps } from "./pipeline";
import { resolveSearchProvider } from "./web-search";

export const newId = (prefix: string) => `${prefix}_${randomUUID()}`.slice(0, 64);
export const conversationStore = () => getMysqlConversationStore();

export async function pipelineDeps(): Promise<PipelineDeps> {
  return {
    credits: await getMysqlCreditStore(),
    searchProvider: resolveSearchProvider(process.env),
    submit: (userId, input, options) => submitGatewayRequest(userId, input, options),
    kickWorker: () => { void runAiWorkerOnce().catch((e) => console.error("[home-chat] worker kick failed:", e instanceof Error ? e.message : e)); },
    env: process.env,
    newId,
    loadAttachments,
    loadContext,
    loadPreferences,
    audit: async (e) => { await recordAiAudit({ userId: e.userId, action: e.action, status: e.status, details: e.details }); },
  };
}

export async function runDeps(): Promise<RunDeps> {
  const db = await getDb();
  if (!db) throw new Error("Storage is unavailable.");
  return {
    credits: await getMysqlCreditStore(),
    env: process.env,
    getRun: async (userId, runId) => {
      const r = await getOrchestrationRun(userId, runId);
      return r ? { id: r.id, requestId: r.requestId, status: r.status, result: r.result, error: r.error, capability: r.capability, conversationId: r.conversationId, taskId: r.taskId, plan: r.plan } : null;
    },
    getEvents: async (taskId) => (await listTaskEvents(taskId)).map((e) => ({ type: e.type, createdAt: e.createdAt, payload: e.payload })),
    findReservation: async (userId, requestId) => {
      const r = (await db.select().from(creditReservations).where(and(eq(creditReservations.userId, userId), eq(creditReservations.requestId, requestId))).limit(1))[0];
      return r ? ({ id: r.id, userId: r.userId, requestId: r.requestId, capability: r.capability, amount: r.amount, charged: r.charged, status: r.status } satisfies Reservation) : null;
    },
  };
}

export async function loadPreferences(userId: number): Promise<Preferences> {
  const db = await getDb();
  if (!db) return DEFAULT_PREFERENCES;
  const r = (await db.select().from(homeChatPreferences).where(eq(homeChatPreferences.userId, userId)).limit(1))[0];
  return r ? normalizePreferences(r) : DEFAULT_PREFERENCES;
}
export async function savePreferences(userId: number, raw: Partial<Preferences>): Promise<Preferences> {
  const db = await getDb();
  if (!db) throw new Error("Preference storage is unavailable.");
  const p = normalizePreferences(raw);
  await db.insert(homeChatPreferences).values({ userId, ...p }).onDuplicateKeyUpdate({ set: { ...p } });
  return p;
}

/** Loads ONLY the caller's own conversations and workspace. Any missing/foreign id fails the whole selection (no partial leak or silent drop). */
export async function loadContext(userId: number, sel: ContextSelection): Promise<LoadedContext> {
  const store = await getMysqlConversationStore();
  const conversations: LoadedContext["conversations"] = [];
  for (const id of sel.conversationIds) {
    const c = await store.get(userId, id);
    if (!c) throw new Error("Conversation not found.");
    const msgs = (await store.messages(userId, id)).filter((m) => m.active);
    conversations.push({ id: c.id, title: c.title, messages: msgs.map((m) => ({ role: m.role, content: m.content })) });
  }
  let workspace: LoadedContext["workspace"] = null;
  if (sel.workspaceId) {
    const files = await readLiveBuilderStoredFiles(userId, sel.workspaceId);
    workspace = { id: sel.workspaceId, files: files.filter((f) => f.status === "active").map((f) => ({ path: f.path, content: f.content, isSecret: f.isSecret })) };
  }
  return { conversations, workspace };
}

import { createHash } from "node:crypto";
import { insertNotification } from "../geminio-data";
import { getMysqlScheduleStore } from "./schedule-store";
import { runDueSchedules, type FireResult, type ScheduleRow } from "./schedule";
import { sendHomeMessage } from "./pipeline";

async function fireSchedule(row: ScheduleRow, occurrence: Date): Promise<FireResult> {
  if (row.kind === "reminder") {
    // Deterministic id: a recovered re-fire of the same occurrence hits the primary key and is treated as already delivered.
    const noteId = `note_${createHash("sha256").update(`${row.id}:${occurrence.toISOString()}`).digest("hex").slice(0, 40)}`;
    try { await insertNotification({ id: noteId, userId: row.userId, title: `Reminder: ${row.title}`, message: row.prompt?.trim() || row.title, type: "info", read: false, createdAt: new Date() }); }
    catch (e) { if (!/duplicate|ER_DUP_ENTRY/i.test(e instanceof Error ? `${e.message} ${(e as { code?: string }).code ?? ""}` : "")) throw e; }
    return { ok: true };
  }
  // A scheduled prompt is a normal metered Home chat send (idempotent per schedule + occurrence).
  const key = createHash("sha256").update(`${row.id}:${occurrence.toISOString()}`).digest("hex").slice(0, 32);
  const r = await sendHomeMessage(await pipelineDeps(), row.userId, { message: row.prompt ?? row.title, conversationId: null, webSearch: "auto", temporary: false, clientRequestId: `sched-${key}` });
  if (r.ok) {
    await insertNotification({ id: `note_${key}`, userId: row.userId, title: `Scheduled task started: ${row.title}`, message: "Open Home to see the result when it finishes.", type: "info", read: false, createdAt: new Date() }).catch((e) => { if (!/duplicate|ER_DUP_ENTRY/i.test(e instanceof Error ? e.message : "")) throw e; });
    return { ok: true };
  }
  return { ok: false, reason: r.message, retryable: r.code !== "INSUFFICIENT_CREDITS" && r.code !== "INVALID" };
}

/** One worker tick: fire every due schedule. Safe to run on several instances (atomic claim). */
export async function runScheduleTick() {
  return runDueSchedules({
    store: await getMysqlScheduleStore(), fire: fireSchedule, now: () => new Date(),
    notify: async (row, title, message, type) => { await insertNotification({ id: newId("note"), userId: row.userId, title, message, type, read: false, createdAt: new Date() }); },
  });
}

import { ActionError, type ActionDefinition, type ActionDeps } from "./actions";
import { getMysqlActionStore } from "./action-store";
import { describeLiveBuilderForDeploy, requestLiveBuilderDeployment } from "../live-builder/service";

/** Registry of Home actions. Only actions that can REALLY be performed have an execute(); others are refused at proposal time. */
export const ACTION_REGISTRY: Record<string, ActionDefinition> = {
  deploy_request: {
    type: "deploy_request", label: "Request a deployment review", estimatedCredits: 0, reversible: false,
    reversalNote: "Withdrawing a deployment review isn't supported from Home yet; nothing is published by this action.",
    async describe(userId, params) {
      const id = typeof params.workspaceId === "string" ? params.workspaceId : "";
      const w = id ? await describeLiveBuilderForDeploy(userId, id) : null;
      if (!w) throw new ActionError("NOT_FOUND", "That project wasn't found in your account.");
      if (!w.versionId) throw new ActionError("INVALID", "This project has no saved version to deploy yet.");
      return { resourceId: w.workspaceId, resourceLabel: w.name, summary: `Create a deployment review for "${w.name}" (${w.versionLabel ?? "latest version"}).`, consequences: ["A deployment review record is created and waits for a further approval.", "Nothing is published or changed on any external service.", "No credits are charged."], params: { workspaceId: w.workspaceId, versionId: w.versionId } };
    },
    async execute(userId, params) {
      const r = await requestLiveBuilderDeployment(userId, String(params.workspaceId), String(params.versionId), "Requested from Home chat");
      return { summary: r.message, data: { reviewId: r.id, status: r.status } };
    },
  },
  delete_project: { type: "delete_project", label: "Delete a project", estimatedCredits: 0, reversible: false, reversalNote: "", describe: async () => { throw new ActionError("UNAVAILABLE", "Project deletion isn't implemented."); }, unavailableReason: "Deleting a project from Home isn't supported yet (no safe project-deletion operation exists). Nothing was proposed." },
};
export async function actionDeps(): Promise<ActionDeps> {
  return { store: await getMysqlActionStore(), registry: ACTION_REGISTRY, now: () => new Date(), newId: () => newId("act"), audit: async (e) => { await recordAiAudit({ userId: e.userId, action: e.action, status: e.status, details: e.details }); } };
}

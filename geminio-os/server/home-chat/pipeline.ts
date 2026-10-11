/**
 * Home chat send pipeline (dependency-injected so it is testable without a database or provider):
 *   validate -> route hint -> price -> RESERVE credits -> (real) web search -> AI Core submit -> kick worker
 * and, separately, run settlement: completed -> finalize actual charge, failed/cancelled -> release.
 * Nothing here trusts the client for credits, ownership or run state.
 */
import { completedStepsOf as completedStepsShared, settleTerminalRun } from "../credits/metering";
import { validatePlanSelection, type PlanSelection, type RoleDef } from "../ai-core/multistep";
import { CreditError, finalizeReservation, priceFor, releaseReservation, reserveCredits, type CreditStore, type Reservation } from "../credits/ledger";
import { buildAttachmentParts, type AttachmentKind, type LoadedAttachment } from "./attachments";
import { buildContextBlock, normalizeContext, type ContextSelection, type ContextSummary, type LoadedContext } from "./context";
import { preferenceSystemMessage, type Preferences } from "./preferences";
import { suggestModule, type ModuleHint } from "./intents";
import { needsWebSearch, searchWeb, webContextMessage, type SearchProvider, type SearchSource } from "./web-search";

export const MAX_MESSAGE_CHARS = 20_000;
export type WebSearchMode = "auto" | "on" | "off";
export type AttachmentRef = { id: string; name: string; mimeType: string; sizeBytes: number; kind: AttachmentKind };

export type SendInput = {
  message: string;
  conversationId: string | null;
  webSearch: WebSearchMode;
  temporary: boolean;
  clientRequestId?: string | null;
  /** Ids only. Ownership, type and content are re-read from the server; client-supplied metadata is never trusted. */
  attachmentIds?: string[];
  language?: string | null;
  skipUserMessage?: boolean;
  /** A registered multi-step plan, optionally edited by the user. Re-validated by server policy before anything is reserved. */
  plan?: PlanSelection | null;
  /** What the user chose to share with the model beyond this message. Ownership is enforced by the loader. */
  context?: Partial<ContextSelection> | null;
};

export type SubmitFn = (userId: number, input: { message: string; requestId: string; conversationId: string | null; projectId: null; mode: "plan"; metadata: Record<string, unknown> }, options: { reservationManagedByCaller?: boolean; planSelection?: PlanSelection; forcedCapability: string; trustedParameters: Record<string, unknown>; skipUserMessage?: boolean; temporary?: boolean; conversationContext?: Record<string, unknown>; attachments?: unknown }) => Promise<{ runId: string; taskId: string | null; conversationId: string; status: string; error: { message: string; retryable?: boolean } | null }>;

export type PipelineDeps = {
  credits: CreditStore;
  searchProvider: SearchProvider | null;
  submit: SubmitFn;
  /** Starts the durable worker without blocking the request. */
  kickWorker: () => void;
  env: Record<string, string | undefined>;
  newId: (prefix: string) => string;
  /** Loads the caller's OWN attachments (null entries = missing/not owned). */
  loadAttachments?: (userId: number, ids: string[]) => Promise<(LoadedAttachment & { sizeBytes: number })[]>;
  loadContext?: (userId: number, selection: ContextSelection) => Promise<LoadedContext>;
  loadPreferences?: (userId: number) => Promise<Preferences>;
  now?: () => Date;
  audit?: (e: { userId: number; action: string; status: "success" | "error" | "warning"; details: Record<string, unknown> }) => Promise<void>;
};

export type SearchReport =
  | { attempted: false }
  | { attempted: true; status: "ok"; provider: string; sources: SearchSource[] }
  | { attempted: true; status: "unavailable"; reason: string }
  | { attempted: true; status: "failed"; reason: string; retryable: boolean };

export type SendResult =
  | { ok: true; contextSummary: ContextSummary; attachmentNotes: string[]; runId: string; taskId: string | null; conversationId: string; reservationId: string; creditsReserved: number; search: SearchReport; moduleHint: ModuleHint | null }
  | { ok: false; code: "INSUFFICIENT_CREDITS"; message: string; required: number; available: number }
  | { ok: false; code: "INVALID" | "UNAVAILABLE" | "RATE_LIMITED"; message: string };

export class PipelineInputError extends Error {}

export function validateSend(input: SendInput): SendInput {
  const message = input.message.replace(/\u0000/g, "").trim();
  if (!message) throw new PipelineInputError("Message cannot be empty.");
  if (message.length > MAX_MESSAGE_CHARS) throw new PipelineInputError(`Message is too long (max ${MAX_MESSAGE_CHARS} characters).`);
  const attachmentIds = [...new Set((input.attachmentIds ?? []).filter((x) => /^[\w-]{1,64}$/.test(x)))].slice(0, 5);
  return { ...input, message, attachmentIds, language: input.language && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(input.language) ? input.language : null };
}

export async function sendHomeMessage(deps: PipelineDeps, userId: number, raw: SendInput): Promise<SendResult> {
  let input: SendInput;
  try { input = validateSend(raw); } catch (e) { return { ok: false, code: "INVALID", message: e instanceof Error ? e.message : "Invalid message." }; }

  const wantSearch = needsWebSearch(input.message, input.webSearch);
  const requestId = input.clientRequestId && /^[\w-]{8,64}$/.test(input.clientRequestId) ? `home_${input.clientRequestId}`.slice(0, 64) : deps.newId("home");
  let planRoles: RoleDef[] | null = null;
  if (input.plan) {
    const v = validatePlanSelection(input.plan);
    if (!v.ok) return { ok: false, code: "INVALID", message: `That plan isn't allowed: ${v.problems.join(" ")} Nothing was run or charged.` };
    planRoles = v.roles;
  }
  const stepCount = planRoles ? planRoles.length : 1;
  const unit = priceFor("conversation.reply", deps.env, {});
  const maxPrice = { capability: unit.capability, credits: unit.credits * stepCount + (wantSearch ? priceFor("conversation.reply", deps.env, { webSearch: true }).credits - unit.credits : 0) };

  let reservation: Reservation;
  const ownReservationId = deps.newId("reservation");
  try {
    reservation = await reserveCredits(deps.credits, { userId, requestId, capability: "conversation.reply", credits: maxPrice.credits, id: ownReservationId });
  } catch (e) {
    if (e instanceof CreditError && e.code === "INSUFFICIENT_CREDITS") {
      await deps.audit?.({ userId, action: "home.send.insufficient_credits", status: "warning", details: { required: e.details.required, available: e.details.available } });
      return { ok: false, code: "INSUFFICIENT_CREDITS", message: "You don't have enough credits for this request. Nothing was run and nothing was charged.", required: e.details.required ?? maxPrice.credits, available: e.details.available ?? 0 };
    }
    return { ok: false, code: "UNAVAILABLE", message: "Credit service is unavailable, so the request was not started." };
  }

  // A retry with the same clientRequestId gets the ORIGINAL reservation back. Only the call that created a reservation may release it:
  // a failed duplicate must never release the hold that a concurrently running original request is relying on.
  const releaseIfOurs = async () => { if (reservation.id === ownReservationId) await releaseReservation(deps.credits, reservation.id).catch(() => undefined); };

  // Real search only when wanted. The outcome is reported exactly as it happened.
  let search: SearchReport = { attempted: false };
  let webContext: string | undefined;
  let webSources: SearchSource[] | undefined;
  if (wantSearch) {
    const outcome = await searchWeb(deps.searchProvider, input.message);
    if (outcome.status === "ok" && outcome.sources.length > 0) {
      search = { attempted: true, status: "ok", provider: outcome.provider, sources: outcome.sources };
      webSources = outcome.sources;
      webContext = webContextMessage(outcome.sources, (deps.now ?? (() => new Date()))());
    } else if (outcome.status === "ok") {
      search = { attempted: true, status: "failed", reason: "The search returned no usable results.", retryable: true };
    } else if (outcome.status === "unavailable") {
      search = { attempted: true, status: "unavailable", reason: outcome.reason };
    } else {
      search = { attempted: true, status: "failed", reason: outcome.reason, retryable: outcome.retryable };
    }
    await deps.audit?.({ userId, action: "home.web_search", status: search.status === "ok" ? "success" : "warning", details: { status: search.status, sources: webSources?.length ?? 0 } });
  }

  let attachmentParts: unknown; let attachmentRefs: AttachmentRef[] | undefined; const attachmentNotes: string[] = [];
  if (input.attachmentIds && input.attachmentIds.length > 0) {
    let loaded: (LoadedAttachment & { sizeBytes: number })[] = [];
    try { loaded = deps.loadAttachments ? await deps.loadAttachments(userId, input.attachmentIds) : []; } catch { loaded = []; }
    if (loaded.length !== input.attachmentIds.length) {
      await releaseIfOurs();
      return { ok: false, code: "INVALID", message: "One or more attachments are unavailable (not found, not yours, or storage is down). Nothing was sent or charged." };
    }
    const built = buildAttachmentParts(input.message, loaded);
    attachmentParts = built.parts; attachmentNotes.push(...built.notes);
    attachmentRefs = loaded.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, sizeBytes: f.sizeBytes, kind: f.kind }));
  }

  const ctxSel = normalizeContext(input.context, input.conversationId);
  let contextText: string | null = null; let contextSummary: ContextSummary = { historyMode: ctxSel.historyMode, conversations: [], workspaceFiles: [], omittedFiles: 0, secretFilesExcluded: 0, chars: 0 };
  if (ctxSel.conversationIds.length > 0 || ctxSel.workspaceId) {
    let loaded: LoadedContext | null = null;
    try { loaded = deps.loadContext ? await deps.loadContext(userId, ctxSel) : null; } catch { loaded = null; }
    if (!loaded) {
      await releaseIfOurs();
      return { ok: false, code: "INVALID", message: "The context you selected is unavailable (not found, not yours, or storage is down). Nothing was sent or charged." };
    }
    const built = buildContextBlock(loaded); contextText = built.text; contextSummary = { historyMode: ctxSel.historyMode, ...built.summary };
  }

  let prefs: Preferences | null = null;
  try { prefs = deps.loadPreferences ? await deps.loadPreferences(userId) : null; } catch { prefs = null; } // personalization is optional: failure must not block the chat
  const prefMessage = prefs ? preferenceSystemMessage(prefs) : null;
  const language = input.language ?? prefs?.language ?? null;

  const moduleHint = suggestModule(input.message);
  const unsearched = wantSearch && !webContext
    ? "Live web search was requested but is unavailable or failed; answer from general knowledge only and say clearly that the answer is not based on current web results."
    : undefined;

  try {
    const run = await deps.submit(userId, {
      message: input.message, requestId, conversationId: input.conversationId, projectId: null, mode: "plan",
      metadata: { source: "home-chat" },
    }, {
      planSelection: input.plan ? { type: input.plan.type, roleIds: planRoles!.map((r) => r.id) } : undefined,
      reservationManagedByCaller: true,
      forcedCapability: "conversation.reply",
      trustedParameters: { ...(webContext ? { webContext, webSources } : {}), ...(unsearched ? { webContext: unsearched } : {}), ...(language ? { responseLanguage: language } : {}), ...(prefMessage ? { personalization: prefMessage } : {}), ...(prefs ? { aiLevel: prefs.aiLevel } : {}), ...(attachmentParts ? { attachmentParts } : {}), ...(contextText ? { contextBlock: contextText } : {}), historyMode: ctxSel.historyMode },
      skipUserMessage: input.skipUserMessage,
      temporary: input.temporary,
      conversationContext: input.temporary ? { temporary: true } : {},
      attachments: attachmentRefs,
    });
    deps.kickWorker();
    await deps.audit?.({ userId, action: "home.send.accepted", status: "success", details: { runId: run.runId, conversationId: run.conversationId, searched: search.attempted && search.status === "ok", attachments: attachmentRefs?.length ?? 0 } });
    return { ok: true, contextSummary, attachmentNotes, runId: run.runId, taskId: run.taskId, conversationId: run.conversationId, reservationId: reservation.id, creditsReserved: maxPrice.credits, search, moduleHint };
  } catch (e) {
    await releaseIfOurs();
    const message = e instanceof Error ? e.message : "The request could not be started.";
    await deps.audit?.({ userId, action: "home.send.failed", status: "error", details: { message: message.slice(0, 200) } });
    return /rate limit/i.test(message) ? { ok: false, code: "RATE_LIMITED", message } : { ok: false, code: "UNAVAILABLE", message: `The request could not be started: ${message}` };
  }
}

// ---------- run view + settlement ----------

export type RunRecord = { id: string; requestId: string; status: string; result: unknown; error: unknown; capability: string | null; conversationId: string | null; taskId: string | null; plan?: unknown };
export type RunEvent = { type: string; createdAt: Date; payload?: unknown };
export type RunDeps = {
  credits: CreditStore;
  getRun(userId: number, runId: string): Promise<RunRecord | null>;
  getEvents(taskId: string): Promise<RunEvent[]>;
  findReservation(userId: number, requestId: string): Promise<Reservation | null>;
  env: Record<string, string | undefined>;
};

export type RunStep = { key: string; label: string; at: string; state: "done" | "active" | "failed" };
export type RunView = {
  runId: string; conversationId: string | null; status: string; terminal: boolean;
  text: string | null; streaming: boolean; sources: SearchSource[] | null;
  error: { message: string; retryable: boolean } | null;
  steps: RunStep[]; stepsTotal: number; creditsCharged: number | null;
};

const STEP_LABELS: Record<string, string> = {
  accepted: "Request received", intent_resolved: "Understanding request", plan_created: "Planning",
  step_started: "Generating response", approval_requested: "Waiting for your approval", retry_scheduled: "Retrying after a temporary failure",
  verification_completed: "Validating result", completed: "Completed", failed: "Failed", cancelled: "Cancelled",
};
const TERMINAL = new Set(["completed", "failed", "cancelled"]);

/** Progress comes ONLY from persisted task events. Unknown event types are ignored; nothing is invented. */
export function stepsFromEvents(events: RunEvent[], status: string): RunStep[] {
  const steps: RunStep[] = [];
  const titleOf = (e: RunEvent) => { const t = (e.payload as { title?: unknown } | undefined)?.title; return typeof t === "string" ? t : null; };
  for (const e of events) {
    const title = titleOf(e);
    if (e.type === "step_started" && title) { steps.push({ key: `step:${title}`, label: title, at: e.createdAt.toISOString(), state: "active" }); continue; }
    if ((e.type === "step_completed" || e.type === "step_failed") && title) {
      const i = steps.map((x) => x.key).lastIndexOf(`step:${title}`);
      const state = e.type === "step_failed" ? "failed" : "done";
      if (i >= 0) steps[i] = { ...steps[i], state }; else steps.push({ key: `step:${title}`, label: title, at: e.createdAt.toISOString(), state });
      continue;
    }
    const label = STEP_LABELS[e.type];
    if (!label || e.type === "step_completed") continue; // un-titled step_started (single-step runs) shows "Generating response"; un-titled completion adds no row
    steps.push({ key: e.type, label, at: e.createdAt.toISOString(), state: e.type === "failed" ? "failed" : "done" });
  }
  const terminal = TERMINAL.has(status);
  for (let i = 0; i < steps.length; i++) if (terminal && steps[i].state === "active") steps[i] = { ...steps[i], state: status === "completed" ? "done" : "failed" };
  if (!terminal && steps.length && !steps.some((x) => x.state === "active")) steps[steps.length - 1] = { ...steps[steps.length - 1], state: "active" };
  return steps;
}

/** Settlement policy lives in server/credits/metering.ts (shared by every AI path). */
export const completedStepsOf = completedStepsShared;
export async function settleRun(deps: RunDeps, userId: number, run: RunRecord): Promise<number | null> {
  return settleTerminalRun(deps.credits, deps.env, userId, run, deps.findReservation);
}

export async function getRunView(deps: RunDeps, userId: number, runId: string): Promise<RunView | null> {
  const run = await deps.getRun(userId, runId);
  if (!run) return null;
  const events = run.taskId ? await deps.getEvents(run.taskId) : [];
  const creditsCharged = await settleRun(deps, userId, run);
  const output = (run.result as { output?: { text?: unknown; sources?: unknown; streaming?: unknown } } | null)?.output;
  const err = run.error as { message?: string; retryable?: boolean } | null;
  return {
    runId: run.id, conversationId: run.conversationId, status: run.status, terminal: TERMINAL.has(run.status),
    text: typeof output?.text === "string" ? output.text : null,
    streaming: !TERMINAL.has(run.status) && output?.streaming === true,
    sources: Array.isArray(output?.sources) ? (output!.sources as SearchSource[]) : null,
    error: err ? { message: String(err.message ?? "The request failed."), retryable: Boolean(err.retryable) } : run.status === "failed" ? { message: "The request failed.", retryable: false } : null,
    steps: stepsFromEvents(events, run.status),
    stepsTotal: (((run.plan as { steps?: unknown[] } | null)?.steps) ?? []).length,
    creditsCharged,
  };
}

// ---------- AI action preview (read-only; nothing is reserved or run) ----------
export type PlanPreview = { ok: true; understood: string; planType: string | null; steps: { title: string; role: string }[]; usesWebSearch: boolean; estimatedCredits: number; available: number | null; canAfford: boolean | null } | { ok: false; problems: string[] };
export function buildPreview(input: { message: string; plan?: PlanSelection | null; webSearch: WebSearchMode }, env: Record<string, string | undefined>, available: number | null): PlanPreview {
  const web = needsWebSearch(input.message, input.webSearch);
  let steps: { title: string; role: string }[] = [{ title: "Answer", role: "assistant" }];
  let planType: string | null = null;
  if (input.plan) {
    const v = validatePlanSelection(input.plan);
    if (!v.ok) return { ok: false, problems: v.problems };
    steps = v.roles.map((r) => ({ title: r.title, role: r.id })); planType = v.type;
  }
  const unit = priceFor("conversation.reply", env, {}).credits;
  const estimatedCredits = unit * steps.length + (web ? priceFor("conversation.reply", env, { webSearch: true }).credits - unit : 0);
  return { ok: true, understood: input.message.replace(/\s+/g, " ").trim().slice(0, 200), planType, steps, usesWebSearch: web, estimatedCredits, available, canAfford: available === null ? null : available >= estimatedCredits };
}

// ---------- task queue view ----------
export type TaskSummary = { runId: string; conversationId: string | null; status: string; title: string; stepsTotal: number; stepsCompleted: number; currentStep: string | null; error: string | null; updatedAt: Date; canPause: boolean; canResume: boolean; canCancel: boolean };
const ACTIVE = new Set(["accepted", "planning", "executing", "waiting_for_approval", "paused", "verifying"]);
/** Client-safe summary of an orchestration run. Never exposes the plan's inputs, results or provider details. */
export function summarizeRun(run: { id: string; status: string; input: string; conversationId: string | null; plan?: unknown; error?: unknown; updatedAt: Date }): TaskSummary {
  const steps = (((run.plan as { steps?: { status?: string; title?: string }[] } | null)?.steps) ?? []).filter(Boolean);
  const current = steps.find((x) => x.status === "running" || x.status === "waiting_for_approval") ?? steps.find((x) => x.status === "pending");
  const err = (run.error as { message?: unknown } | null)?.message;
  return {
    runId: run.id, conversationId: run.conversationId, status: run.status, title: run.input.replace(/\s+/g, " ").trim().slice(0, 80),
    stepsTotal: steps.length, stepsCompleted: steps.filter((x) => x.status === "completed").length, currentStep: ACTIVE.has(run.status) ? (current?.title ?? null) : null,
    error: run.status === "failed" ? String(typeof err === "string" ? err : "The task failed.").slice(0, 200) : null, updatedAt: run.updatedAt,
    canPause: ["accepted", "planning", "executing"].includes(run.status) && steps.length > 1, canResume: run.status === "paused", canCancel: ACTIVE.has(run.status),
  };
}

import {
  aiCoreRequestSchema,
  aiCoreResponseSchema,
  orchestrationPlanSchema,
  type AiCoreRequest,
  type AiCoreResponse,
  type ExecutionStep,
  type VerifiedResult,
  type TaskEventType,
} from "../../shared/geminio-contracts";
import { getOrchestrationRunById, listStalePausedRuns } from "./persistence";
import { insertAgentTask, insertNotification, insertTaskApproval, updateAgentTask } from "../geminio-data";
import { appendConversationMessage, cancelOpenAiJobs, createConversation, createOrchestrationRun, enqueueAiJob, getAiJob, getConversation, getOrchestrationRun, getOrchestrationRunByRequest, getOrchestrationRunByTaskId, userOwnsProject, listAiJobsForRun, listConversationMessages, recordProviderAttempt, saveTaskCheckpoint, updateAiJob, updateOrchestrationRun, appendTaskEvent, nextTaskEventSequence, claimNextAiJob, recoverExpiredAiJobLeases, casOrchestrationRun, casAiJob, claimOrchestrationRun } from "./persistence";
import { APPROVED_RESUME_RUN, RunStateError, classifyDuplicateSubmit, StaleWorkerError, claimForExecution, fencedWrite, finishIfStillRunning, type RunGuardPort, type RunStatus } from "./run-guard";
import { getCapability, type CapabilityExecutionInstruction } from "./capabilities";
import { normalizeProviderError, resolveProvider } from "./providers";
import { deterministicDecision, forcedRoute, routeIntent } from "./router";
import { runMetered } from "../credits/metered-llm";
import { resolveAiLevel, resolveModel } from "./models";
import { buildPlanFromRoles, planForRetry, runPlan, validatePlanSelection, type Plan, type PlanSelection, type StepContext } from "./multistep";
import { InsufficientCreditsError, reserveForRun, settleTerminalRun } from "../credits/metering";
import { findReservationByRequest, getMysqlCreditStore } from "../credits/mysql-store";
import { releaseReservation } from "../credits/ledger";
import { makeThrottledProgress } from "./sse";
import { notificationFor, type NotifyEvent, type RunFacts } from "./notify-policy";
import { consumeRateLimit, recordAiAudit, authorizeCapability, safeErrorDetails } from "./security";

const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

/**
 * Intent classification is itself a provider call, so it is metered ("ai.route"). If it cannot be paid for (or was already
 * processed for this requestId) the deterministic router is used instead; no provider call is made and nothing is charged.
 */
async function routeMetered(userId: number, requestId: string, message: string) {
  try {
    return await runMetered(await getMysqlCreditStore(), process.env, { userId, capability: "ai.route", requestId: `route:${requestId}`.slice(0, 64) }, () => routeIntent(message));
  } catch (error) {
    if (error instanceof InsufficientCreditsError || (error instanceof Error && error.message === "This request was already processed.")) return deterministicDecision(message);
    throw error;
  }
}

async function notifyRun(userId: number, event: NotifyEvent, facts: RunFacts, detail?: string) {
  const n = notificationFor(event, facts, detail);
  if (!n) return;
  await insertNotification({ id: id("notification"), userId, title: n.title, message: n.message, type: n.type === "info" ? "info" : n.type, read: false, createdAt: new Date() }).catch((e) => console.error("[ai-core] notification failed", e instanceof Error ? e.message : e));
}

/** Settles the run's credit reservation. Never throws: a settlement failure is audited loudly and retried by reconcileUnsettledReservations. */
async function settleCredits(userId: number, runId: string) {
  try {
    const run = await getOrchestrationRun(userId, runId);
    if (!run) return;
    await settleTerminalRun(await getMysqlCreditStore(), process.env, userId, { requestId: run.requestId, status: run.status, capability: run.capability, plan: run.plan, result: run.result }, findReservationByRequest);
  } catch (error) {
    console.error("[credits] settlement failed; reconciliation will retry", error instanceof Error ? error.message : error);
    await recordAiAudit({ userId, action: "credits.settlement_failed", status: "error", details: { runId, message: error instanceof Error ? error.message.slice(0, 200) : "unknown" } }).catch(() => undefined);
  }
}

function textContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => (typeof part === "object" && part && "text" in part ? String((part as { text: unknown }).text) : "")).join("\n");
  return "";
}

function approvalActionForCapability(capability: string): "deploy_production" | "delete_project" | "connect_provider" | null {
  if (capability === "project.deploy") return "deploy_production";
  if (capability === "project.delete") return "delete_project";
  if (capability === "connect.provider") return "connect_provider";
  return null;
}

async function emit(taskId: string, runId: string, type: TaskEventType, payload: Record<string, unknown>) {
  const sequence = await nextTaskEventSequence(taskId);
  await appendTaskEvent({ id: id("event"), taskId, runId, sequence, type, payload, createdAt: new Date() });
}

function buildPlan(intent: Awaited<ReturnType<typeof routeIntent>>["intent"]): ReturnType<typeof orchestrationPlanSchema.parse> {
  const descriptor = getCapability(intent.capability);
  const step: ExecutionStep = {
    id: "step_1",
    capability: intent.capability,
    title: descriptor?.descriptor.displayName ?? intent.name,
    input: intent.parameters,
    risk: intent.risk,
    requiresApproval: intent.requiresApproval,
    status: "pending",
    output: null,
    error: null,
  };
  return orchestrationPlanSchema.parse({
    version: 1,
    intent,
    steps: [step],
    verification: ["The selected capability returned a structured output.", "No external side effect is reported as successful without a connected provider."]
  });
}

/** Server-only options (not part of the client-reachable request schema). */
export type SubmitOptions = {
  forcedCapability?: string;
  /** Merged into the routed intent's parameters (e.g. retrieved web sources). Never client-supplied. */
  trustedParameters?: Record<string, unknown>;
  /** Regenerate: the user's message is already stored, do not append it again. */
  skipUserMessage?: boolean;
  /** Initial context for a NEW conversation (e.g. { temporary: true }). */
  conversationContext?: Record<string, unknown>;
  /** NEW conversation only: mark it temporary (hidden from history, swept by retention, not shareable). */
  temporary?: boolean;
  /** The caller already reserved credits for this requestId (Home chat reserves before web search). Skips central reservation. */
  reservationManagedByCaller?: boolean;
  /** Registered multi-step plan (trusted server code only). Validated again here against the registry policy. */
  planSelection?: PlanSelection;
  /** Attachment metadata stored with the user's message (already validated and ownership-checked by the caller). */
  attachments?: unknown;
};

export async function submitAiRequest(userId: number, rawInput: AiCoreRequest, options: SubmitOptions = {}): Promise<AiCoreResponse> {
  const input = aiCoreRequestSchema.parse(rawInput);
  // Idempotency FIRST: a retried request (same requestId) must not create another conversation, user message, task or job, and must not
  // be rate-limited or re-charged. createOrchestrationRun used to return the existing row while this function carried on with fresh ids.
  const prior = await getOrchestrationRunByRequest(userId, input.requestId);
  const duplicate = classifyDuplicateSubmit(prior, input.message);
  if (duplicate === "conflict") throw new Error("This request id was already used for a different message.");
  if (duplicate === "replay" && prior) {
    const priorPlan = orchestrationPlanSchema.safeParse(prior.plan);
    if (priorPlan.success && prior.conversationId) {
      return aiCoreResponseSchema.parse({ runId: prior.id, taskId: prior.taskId, conversationId: prior.conversationId, status: prior.status, intent: priorPlan.data.intent, plan: priorPlan.data, result: null, error: null });
    }
  }
  // A client-supplied project id must belong to the caller before anything is created that references it.
  if (input.projectId && !(await userOwnsProject(userId, input.projectId))) throw new Error("The referenced project was not found in this account.");
  if (!consumeRateLimit(userId)) {
    await recordAiAudit({ userId, action: "ai.request.rate_limited", status: "warning", details: { requestId: input.requestId } });
    throw new Error("AI request rate limit exceeded. Please retry shortly.");
  }
  const conversation = input.conversationId
    ? await getConversation(userId, input.conversationId)
    : await createConversation({ id: id("conversation"), userId, projectId: input.projectId, title: input.message.slice(0, 80), summary: null, context: options.conversationContext ?? {}, status: "active", temporary: options.temporary ?? false, createdAt: new Date(), updatedAt: new Date() });
  if (!conversation) throw new Error("Conversation storage is unavailable.");

  const route = options.forcedCapability
    ? forcedRoute(options.forcedCapability, { message: input.message, ...(options.trustedParameters ?? {}) })
    : await routeMetered(userId, input.requestId, input.message);
  if (options.trustedParameters) route.intent = { ...route.intent, parameters: { ...route.intent.parameters, ...options.trustedParameters } };
  const authorization = authorizeCapability({ userId, capability: route.intent.capability, approved: false });
  if (!authorization.allowed && authorization.risk === null) {
    await recordAiAudit({ userId, action: "ai.capability.denied", resource: route.intent.capability, status: "error", details: { requestId: input.requestId, reason: authorization.reason } });
    throw new Error(authorization.reason);
  }
  const selection = options.planSelection ? validatePlanSelection(options.planSelection) : null;
  if (selection && !selection.ok) throw new Error(`Plan rejected by server policy: ${selection.problems.join(" ")}`);
  const plan = selection?.ok ? orchestrationPlanSchema.parse(buildPlanFromRoles(selection.roles, { intent: route.intent, capability: route.intent.capability, risk: route.intent.risk, input: route.intent.parameters, verification: ["Each step returned a provider result.", "The final step produced the answer shown to the user."] })) : buildPlan(route.intent);
  await recordAiAudit({ userId, action: "ai.request.accepted", resource: route.intent.capability, status: "success", details: { requestId: input.requestId, fallbackUsed: route.fallbackUsed } });
  let reservationId: string | null = null;
  if (!options.reservationManagedByCaller) {
    try {
      const r = await reserveForRun(await getMysqlCreditStore(), process.env, { userId, requestId: input.requestId, capability: route.intent.capability, steps: plan.steps.length, id: id("reservation").slice(0, 64) });
      reservationId = r?.id ?? null;
    } catch (error) {
      if (error instanceof InsufficientCreditsError) await recordAiAudit({ userId, action: "ai.request.insufficient_credits", resource: route.intent.capability, status: "warning", details: { requestId: input.requestId, required: error.required, available: error.available } });
      throw error;
    }
  }
  const taskId = id("task");
  const runId = id("run");
  const createdTask = await insertAgentTask({
    id: taskId,
    userId,
    projectId: input.projectId,
    title: route.intent.name,
    state: "planning",
    progress: 5,
    requiresApproval: route.intent.requiresApproval,
    currentApprovalId: null,
    lastError: null,
    checkpoint: "intent_resolved",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const run = await createOrchestrationRun({
    id: runId,
    userId,
    conversationId: conversation.id,
    projectId: input.projectId,
    taskId,
    requestId: input.requestId,
    input: input.message,
    intent: route.intent.name,
    capability: route.intent.capability,
    plan,
    status: "planning",
    result: null,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  if (run && run.id !== runId) {
    // Lost a race with a concurrent identical request: that request owns the run, the reservation and the messages. Retire our orphan task.
    if (createdTask) await updateAgentTask(taskId, userId, { state: "cancelled", checkpoint: "duplicate_request", lastError: null }).catch(() => undefined);
    const winnerPlan = orchestrationPlanSchema.safeParse(run.plan);
    if (!winnerPlan.success || !run.conversationId) throw new Error("A concurrent identical request is still being set up. Retry shortly.");
    return aiCoreResponseSchema.parse({ runId: run.id, taskId: run.taskId, conversationId: run.conversationId, status: run.status, intent: winnerPlan.data.intent, plan: winnerPlan.data, result: null, error: null });
  }
  if (!createdTask || !run) {
    if (reservationId) await releaseReservation(await getMysqlCreditStore(), reservationId).catch(() => undefined);
    throw new Error("AI Core durable storage is unavailable.");
  }
  if (!options.skipUserMessage) await appendConversationMessage({ id: id("message"), userId, conversationId: conversation.id, role: "user", content: input.message, attachments: options.attachments ?? null });
  await emit(taskId, runId, "accepted", { requestId: input.requestId });
  await emit(taskId, runId, "intent_resolved", { capability: route.intent.capability, confidence: route.intent.confidence, fallbackUsed: route.fallbackUsed });
  await emit(taskId, runId, "plan_created", { stepCount: plan.steps.length });
  await updateOrchestrationRun(runId, userId, { status: "accepted", plan });
  await updateAgentTask(taskId, userId, { state: "queued", progress: 10, checkpoint: "plan_created" });
  const job = await enqueueAiJob({ id: id("job"), runId, taskId, kind: "execute_plan", status: input.mode === "execute" ? "leased" : "queued", attempts: 0, maxAttempts: 3, availableAt: new Date(), leasedUntil: input.mode === "execute" ? new Date(Date.now() + 60_000) : null, lastError: null, payload: { input, plan }, createdAt: new Date(), updatedAt: new Date() });
  if (!job) throw new Error("AI Core queue storage is unavailable.");

  if (input.mode === "execute") {
    return executeQueuedJob(userId, job.id, runId, taskId, conversation.id, plan);
  }
  return aiCoreResponseSchema.parse({ runId, taskId, conversationId: conversation.id, status: "accepted", intent: route.intent, plan, result: null, error: null });
}

const STEP_TIMEOUT_MS = Math.max(5_000, Number(process.env.AI_STEP_TIMEOUT_MS ?? 120_000) || 120_000);
const boundedJson = (v: unknown, max: number) => { const t = JSON.stringify(v); return t.length > max ? `${t.slice(0, max)}…[truncated]` : t; };

/** Executes ONE plan step against the provider. Throws (with .retryable) on failure; approvals are handled by the plan engine. */
async function executeStep(userId: number, runId: string, taskId: string, conversationId: string, input: AiCoreRequest, step: ExecutionStep, ctx: StepContext, fence: number): Promise<Record<string, unknown>> {
  const provider = resolveProvider();
  const modelName = resolveModel(process.env, { capability: step.capability, level: typeof step.input?.aiLevel === "string" ? resolveAiLevel(process.env, step.input.aiLevel) : undefined });
  const capability = getCapability(step.capability);
  const authorization = authorizeCapability({ userId, capability: step.capability, approved: true });
  if (!authorization.allowed && authorization.risk === null) throw new Error(authorization.reason);
  if (step.risk === "external_side_effect") {
    throw new Error("This operation is approved but cannot execute because no dedicated external execution provider is configured.");
  }
  const attempt = Date.now();
  await recordProviderAttempt({ id: id("provider_attempt"), runId, provider: provider.provider, model: modelName, attempt: 1, status: "started", latencyMs: null, errorCode: null, errorMessage: null, usage: null, createdAt: new Date() });

  const conversationMessages = (await listConversationMessages(userId, conversationId, 20))
    .reverse()
    .map((message) => ({ role: message.role, content: message.content } as const));
  const parameters = ctx.previous.length > 0 ? { ...step.input, previousOutputs: ctx.previous.map((p) => ({ title: p.title, text: typeof p.output.text === "string" ? p.output.text.slice(0, 12_000) : boundedJson(p.output, 4_000) })) } : step.input;
  const instruction: CapabilityExecutionInstruction = capability?.handler
    ? capability.handler({ userId, runId, taskId, projectId: input.projectId, requestMessage: input.message, parameters, conversationMessages })
    : {
        messages: [
          { role: "system", content: "You are a Geminio OS execution worker. Return a reviewable result and never claim an external side effect succeeded without a connected execution provider." },
          { role: "user", content: `Capability: ${step.capability}\nRequest: ${input.message}\nParameters: ${JSON.stringify(step.input)}` },
        ],
        maxTokens: 4000,
        outputKind: "plan",
        verificationCheck: "The configured AI provider returned a reviewable response.",
      };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Stream only the user-visible answer (single-step reply or the final step). Partial text is persisted (throttled) so clients
    // polling the run see it grow; a user cancellation observed while streaming aborts the provider request.
    const streamThis = step.capability === "conversation.reply" && (step.input?.finalStep === true || ctx.total === 1);
    const abort = new AbortController();
    const progress = streamThis ? makeThrottledProgress(async (text) => {
      const current = await getOrchestrationRun(userId, runId);
      if (current?.status === "cancelled") { abort.abort(); return; }
      await casOrchestrationRun(runId, userId, ["executing"], { result: { status: "unverified", summary: "Generating response.", output: { text, streaming: true }, checks: [] } }, fence); // fenced; a stale worker's partial text is dropped
    }) : null;
    const response = await Promise.race([
      provider.invoke({ messages: instruction.messages, model: modelName, maxTokens: instruction.maxTokens, ...(progress ? { onText: (d: string) => progress.push(d), signal: abort.signal } : {}) }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error(`The AI provider did not answer within ${Math.round(STEP_TIMEOUT_MS / 1000)} seconds.`), { retryable: true, timeout: true })), STEP_TIMEOUT_MS); }),
    ]);
    if (progress) await progress.done();
    const outputText = textContent(response.result.choices[0]?.message?.content);
    await recordProviderAttempt({ id: id("provider_attempt"), runId, provider: provider.provider, model: response.model, attempt: 1, status: "succeeded", latencyMs: response.latencyMs, errorCode: null, errorMessage: null, usage: response.result.usage ?? null, createdAt: new Date() });
    const sources = Array.isArray(step.input?.webSources) ? step.input.webSources : undefined;
    return { text: outputText, capability: step.capability, provider: provider.provider, kind: instruction.outputKind, verificationCheck: instruction.verificationCheck, ...(sources ? { sources } : {}) };
  } catch (error) {
    if ((error as { timeout?: boolean })?.timeout) {
      await recordProviderAttempt({ id: id("provider_attempt"), runId, provider: provider.provider, model: modelName, attempt: 1, status: "timed_out", latencyMs: Date.now() - attempt, errorCode: "timeout", errorMessage: (error as Error).message, usage: null, createdAt: new Date() });
      throw error;
    }
    const failure = normalizeProviderError(error, provider.provider);
    await recordProviderAttempt({ id: id("provider_attempt"), runId, provider: provider.provider, model: modelName, attempt: 1, status: failure.retryable ? "timed_out" : "failed", latencyMs: Date.now() - attempt, errorCode: failure.code, errorMessage: failure.message, usage: null, createdAt: new Date() });
    throw Object.assign(new Error(failure.message), { retryable: failure.retryable, failure });
  } finally { if (timer) clearTimeout(timer); }
}

export async function executeQueuedJob(userId: number, jobId: string, runId: string, taskId: string, conversationId: string, plan: ReturnType<typeof orchestrationPlanSchema.parse>, approved = false): Promise<AiCoreResponse> {
  const run = await getOrchestrationRun(userId, runId);
  if (!run) throw new Error("Orchestration run not found.");
  const currentJob = await getAiJob(jobId);
  if (run.status === "cancelled" || currentJob?.status === "cancelled") {
    return aiCoreResponseSchema.parse({ runId, taskId, conversationId, status: "cancelled", intent: plan.intent, plan, result: null, error: null });
  }
  if (run.status === "paused") {
    // Pause was requested before this job started: do not run anything. Resume enqueues a fresh job.
    await updateAiJob(jobId, { status: "succeeded" });
    return aiCoreResponseSchema.parse({ runId, taskId, conversationId, status: "paused", intent: plan.intent, plan, result: null, error: null });
  }
  const input = aiCoreRequestSchema.parse({ message: run.input, requestId: run.requestId, conversationId, projectId: run.projectId ?? null, mode: "execute", metadata: {} });
  const currentAttempt = currentJob?.attempts ?? 0;
  // Compare-and-set claim with a fencing token (run-guard.ts): a cancel/pause that lands after the reads above wins, and a
  // worker that is later superseded (expired lease) can no longer write.
  const guard: RunGuardPort = {
    claimRun: (from) => claimOrchestrationRun(runId, userId, from),
    casRun: (from, fence, patch) => casOrchestrationRun(runId, userId, from, patch as never, fence),
    casJob: (from, patch) => casAiJob(jobId, from, patch as never),
    readRunStatus: async () => ((await getOrchestrationRun(userId, runId))?.status ?? null) as RunStatus | null,
  };
  const claim = await claimForExecution(guard, { jobPatch: { attempts: currentAttempt + 1 }, from: approved ? APPROVED_RESUME_RUN : undefined });
  if (!claim.claimed) {
    if (claim.reason === "finished" || claim.reason === "missing") throw new Error("This run has already finished.");
    return aiCoreResponseSchema.parse({ runId, taskId, conversationId, status: claim.reason === "paused" ? "paused" : "cancelled", intent: plan.intent, plan, result: null, error: null });
  }
  const fence = claim.fence;
  await updateAgentTask(taskId, userId, { state: "running", progress: 35, checkpoint: "execution_started" });
  try {
    // Resume from the DURABLE plan (it carries per-step progress), not from the job's original payload.
    const stored = orchestrationPlanSchema.safeParse(run.plan);
    const resumePlan = planForRetry((stored.success ? stored.data : plan) as Plan<ExecutionStep>);
    const approvedStepIds = new Set<string>(approved ? resumePlan.steps.filter((s) => s.status === "waiting_for_approval").map((s) => s.id) : []);
    const total = resumePlan.steps.length;
    const outcome = await runPlan<ExecutionStep>(resumePlan, {
      runStep: (step, ctx) => executeStep(userId, runId, taskId, conversationId, input, step, ctx, fence),
      isCancelled: async () => (await getOrchestrationRun(userId, runId))?.status === "cancelled" || (await getAiJob(jobId))?.status === "cancelled",
      shouldPause: async () => (await getOrchestrationRun(userId, runId))?.status === "paused",
      persist: async (p) => { await fencedWrite(guard, fence, { plan: p }); },
      emit: async (type, payload) => {
        await emit(taskId, runId, type as TaskEventType, payload);
        if (type === "step_completed") await updateAgentTask(taskId, userId, { progress: Math.min(95, 10 + Math.round((85 * ((payload.index as number) + 1)) / total)), checkpoint: `step_${(payload.index as number) + 1}_of_${total}` });
      },
      approvedStepIds,
    });
    if (outcome.kind === "cancelled" || (outcome.kind === "completed" && (await getOrchestrationRun(userId, runId))?.status === "cancelled")) {
      return aiCoreResponseSchema.parse({ runId, taskId, conversationId, status: "cancelled", intent: plan.intent, plan: outcome.plan, result: null, error: null });
    }
    if (outcome.kind === "paused") {
      await updateAiJob(jobId, { status: "succeeded" });
      await updateAgentTask(taskId, userId, { state: "waiting_for_user", progress: Math.min(95, 10 + Math.round((85 * outcome.completedSteps) / total)), checkpoint: "paused" });
      await recordAiAudit({ userId, action: "ai.run.paused", resource: run.capability ?? undefined, status: "success", details: { runId, completedSteps: outcome.completedSteps } });
      return aiCoreResponseSchema.parse({ runId, taskId, conversationId, status: "paused", intent: plan.intent, plan: outcome.plan, result: null, error: null });
    }
    if (outcome.kind === "failed") throw Object.assign(new Error(outcome.error.message), { retryable: outcome.error.retryable });
    if (outcome.kind === "waiting_for_approval") {
      const waiting = outcome.plan.steps.find((s) => s.id === outcome.stepId)!;
      const action = approvalActionForCapability(waiting.capability);
      if (!action) throw new Error(`Step "${waiting.title}" requires approval but has no approvable action.`);
      const approvalId = id("approval");
      await insertTaskApproval({ id: approvalId, taskId, userId, action, summary: `Approval required for ${waiting.title}.`, status: "pending", requestedAt: new Date(), resolvedAt: null });
      await updateAgentTask(taskId, userId, { state: "waiting_for_user", progress: 35, currentApprovalId: approvalId, checkpoint: "approval_requested" });
      await notifyRun(userId, "approval_required", { steps: outcome.plan.steps.length, durationMs: 0, capabilityLabel: waiting.title });
      await fencedWrite(guard, fence, { status: "waiting_for_approval", plan: outcome.plan });
      const pending: VerifiedResult = { status: "unverified", summary: "Waiting for explicit user approval before any external side effect.", output: { approvalId, capability: waiting.capability }, checks: [{ name: "approval_gate", passed: false, details: "The requested operation is paused until approval is granted." }] };
      await updateAiJob(jobId, { status: "succeeded" });
      return aiCoreResponseSchema.parse({ runId, taskId, conversationId, status: "waiting_for_approval", intent: null, plan: outcome.plan, result: pending, error: null });
    }
    const finalStep = [...outcome.plan.steps].reverse().find((s) => s.status === "completed");
    const result: VerifiedResult = {
      status: "verified",
      summary: `${outcome.completedSteps} of ${outcome.plan.steps.length} step(s) completed with provider results.`,
      output: outcome.finalOutput as VerifiedResult["output"],
      checks: outcome.plan.steps.filter((s) => s.status === "completed").map((s) => ({ name: `step:${s.id}`, passed: true, details: String(s.output?.verificationCheck ?? "Provider returned a result.") })),
    };
    void finalStep;
    // Take the finish under a compare-and-set BEFORE any visible side effect, so a run cancelled/paused in the meantime
    // is neither answered, charged nor reported as completed by this (now stale) worker.
    if (!(await guard.casRun(["executing"], fence, { status: "verifying" }))) {
      const now = (await getOrchestrationRun(userId, runId))?.status;
      await updateAiJob(jobId, { status: "succeeded" });
      return aiCoreResponseSchema.parse({ runId, taskId, conversationId, status: now === "paused" ? "paused" : "cancelled", intent: plan.intent, plan, result: null, error: null });
    }
    if (result.output.text && run.capability === "conversation.reply") {
      await appendConversationMessage({ id: id("message"), userId, conversationId, role: "assistant", content: String(result.output.text), runId, sources: Array.isArray(result.output.sources) ? result.output.sources : null });
    }
    await saveTaskCheckpoint({ id: id("checkpoint"), taskId, runId, name: "verified_result", version: 1, state: result, createdAt: new Date() });
    await updateAiJob(jobId, { status: "succeeded" });
    await updateAgentTask(taskId, userId, { state: "completed", progress: 100, checkpoint: "verified_result", lastError: null });
    const finished = await finishIfStillRunning(guard, fence, { status: "completed", result });
    if (!finished.applied) return aiCoreResponseSchema.parse({ runId, taskId, conversationId, status: finished.currentStatus === "paused" ? "paused" : "cancelled", intent: plan.intent, plan, result: null, error: null });
    await settleCredits(userId, runId);
    await notifyRun(userId, "completed", { steps: outcome.plan.steps.length, durationMs: Date.now() - new Date(run.createdAt).getTime(), capabilityLabel: run.capability === "conversation.reply" ? "Your reply" : run.capability });
    await emit(taskId, runId, "verification_completed", { status: result.status });
    await emit(taskId, runId, "completed", { status: result.status });
    return aiCoreResponseSchema.parse({ runId, taskId, conversationId, status: "completed", intent: plan.intent, plan, result, error: null });
  } catch (error) {
    if (error instanceof StaleWorkerError) {
      // Superseded (lease expired and another worker took over) or cancelled/paused underneath us: touch nothing, charge nothing.
      const now = (await getOrchestrationRun(userId, runId))?.status;
      return aiCoreResponseSchema.parse({ runId, taskId, conversationId, status: now === "paused" ? "paused" : now === "cancelled" ? "cancelled" : "executing", intent: plan.intent, plan, result: null, error: null });
    }
    const afterFailureJob = await getAiJob(jobId);
    if (afterFailureJob?.status === "cancelled") {
      return aiCoreResponseSchema.parse({ runId, taskId, conversationId, status: "cancelled", intent: plan.intent, plan, result: null, error: null });
    }
    const retryable = Boolean(error && typeof error === "object" && "retryable" in error && (error as { retryable?: unknown }).retryable);
    const message = error instanceof Error ? error.message : "Execution failed.";
    const retryAllowed = retryable && currentJob !== null && currentAttempt + 1 < currentJob.maxAttempts;
    await recordAiAudit({ userId, action: "ai.execution.failed", resource: run.capability ?? undefined, status: "error", details: { ...safeErrorDetails(error), retryAllowed, attempt: currentAttempt + 1 } });
    // Compare-and-set: a run the user cancelled/paused while the provider call was failing must stay cancelled/paused.
    const failedApplied = await casOrchestrationRun(runId, userId, ["executing", "verifying"], { status: retryAllowed ? "executing" : "failed", error: { code: retryAllowed ? "retry_scheduled" : "execution_failed", message, retryable: retryAllowed, requestId: run.requestId } }, fence);
    if (!failedApplied) {
      const now = (await getOrchestrationRun(userId, runId))?.status;
      return aiCoreResponseSchema.parse({ runId, taskId, conversationId, status: now === "paused" ? "paused" : "cancelled", intent: plan.intent, plan, result: null, error: null });
    }
    // CAS: never turn a job the user cancelled back into a queued (re-runnable) one.
    await casAiJob(jobId, ["queued", "leased", "running"], { status: retryAllowed ? "queued" : "dead_letter", attempts: currentAttempt + 1, lastError: message, availableAt: new Date(Date.now() + 1500) });
    await updateAgentTask(taskId, userId, { state: retryAllowed ? "retrying" : "failed", progress: 35, lastError: message, checkpoint: "execution_failed" });
    if (!retryAllowed) await settleCredits(userId, runId);
    await notifyRun(userId, "failed", { steps: 1, durationMs: 0, retryScheduled: retryAllowed }, message);
    await emit(taskId, runId, retryAllowed ? "retry_scheduled" : "failed", { message, retryable: retryAllowed, attempt: currentAttempt + 1 });
    return aiCoreResponseSchema.parse({ runId, taskId, conversationId, status: retryAllowed ? "executing" : "failed", intent: plan.intent, plan, result: null, error: { code: retryAllowed ? "retry_scheduled" : "execution_failed", message, retryable: retryAllowed, requestId: run.requestId } });
  }
}

function responseForStoredRun(run: NonNullable<Awaited<ReturnType<typeof getOrchestrationRun>>>, plan: ReturnType<typeof orchestrationPlanSchema.parse>, status: "accepted" | "cancelled"): AiCoreResponse {
  if (!run.conversationId) throw new Error("The orchestration run cannot be controlled without a conversation.");
  return aiCoreResponseSchema.parse({
    runId: run.id,
    taskId: run.taskId,
    conversationId: run.conversationId,
    status,
    intent: plan.intent,
    plan,
    result: null,
    error: null,
  });
}

export async function cancelAiRun(userId: number, runId: string): Promise<AiCoreResponse> {
  const run = await getOrchestrationRun(userId, runId);
  if (!run) throw new RunStateError("NOT_FOUND", "Orchestration run not found.");
  const parsedPlan = orchestrationPlanSchema.safeParse(run.plan);
  if (!parsedPlan.success) throw new RunStateError("INVALID_STATE", "Stored plan cannot be cancelled safely.");
  if (run.status === "completed" || run.status === "failed") throw new RunStateError("INVALID_STATE", "Only active orchestration runs can be cancelled.");
  if (run.status === "cancelled") return responseForStoredRun(run, parsedPlan.data, "cancelled");

  const cancelledJobs = await cancelOpenAiJobs(run.id);
  // CAS from the non-terminal states: a run that completed in the meantime must not flip to cancelled after it was charged.
  const cancelled = await casOrchestrationRun(run.id, userId, ["accepted", "planning", "executing", "waiting_for_approval", "paused", "verifying"], { status: "cancelled", error: null });
  if (!cancelled) {
    const now = await getOrchestrationRun(userId, runId);
    if (now?.status === "cancelled") return responseForStoredRun(now, parsedPlan.data, "cancelled");
    throw new RunStateError("INVALID_STATE", "Only active orchestration runs can be cancelled.");
  }
  await settleCredits(userId, run.id);
  if (run.taskId) {
    await updateAgentTask(run.taskId, userId, { state: "cancelled", progress: 0, checkpoint: "cancelled", lastError: null });
    await emit(run.taskId, run.id, "cancelled", { cancelledJobs, reason: "user_requested" });
  }
  await recordAiAudit({ userId, action: "ai.run.cancelled", resource: run.capability ?? undefined, status: "success", details: { runId: run.id, cancelledJobs } });
  return responseForStoredRun(run, parsedPlan.data, "cancelled");
}

export async function retryAiRun(userId: number, runId: string): Promise<AiCoreResponse> {
  const run = await getOrchestrationRun(userId, runId);
  if (!run || !run.taskId) throw new RunStateError("NOT_FOUND", "Orchestration run not found.");
  if (!run.conversationId) throw new RunStateError("INVALID_STATE", "The orchestration run cannot be retried without a conversation.");
  if (run.status !== "failed") throw new RunStateError("INVALID_STATE", "Only failed orchestration runs can be retried.");
  // A failed run's credit hold is already settled. Retrying it in place would be unmetered, so ask for a fresh (metered) submission instead.
  const closed = await findReservationByRequest(userId, run.requestId);
  if (closed && closed.status !== "reserved") throw new RunStateError("INVALID_STATE", "This run was already settled. Send the request again to retry it; you are only charged for steps that complete.");
  const parsedPlan = orchestrationPlanSchema.safeParse(run.plan);
  if (!parsedPlan.success) throw new RunStateError("INVALID_STATE", "Stored plan cannot be retried safely.");
  const existingJobs = await listAiJobsForRun(userId, runId);
  if (existingJobs.some((job) => ["queued", "leased", "running"].includes(job.status))) {
    return responseForStoredRun(run, parsedPlan.data, "accepted");
  }

  // Flip failed -> accepted BEFORE enqueueing (see resumePausedRun): a worker must never see a job for a still-"failed" run.
  if (!(await casOrchestrationRun(run.id, userId, ["failed"], { status: "accepted", result: null, error: null }))) throw new RunStateError("INVALID_STATE", "Only failed orchestration runs can be retried.");
  const job = await enqueueAiJob({ id: id("job"), runId: run.id, taskId: run.taskId, kind: "manual_retry", status: "queued", attempts: 0, maxAttempts: 3, availableAt: new Date(), leasedUntil: null, lastError: null, payload: { plan: parsedPlan.data }, createdAt: new Date(), updatedAt: new Date() });
  if (!job) { await casOrchestrationRun(run.id, userId, ["accepted"], { status: "failed" }); throw new RunStateError("UNAVAILABLE", "Retry queue is unavailable."); }
  await updateAgentTask(run.taskId, userId, { state: "retrying", progress: 10, checkpoint: "manual_retry_requested", lastError: null });
  await emit(run.taskId, run.id, "retry_scheduled", { jobId: job.id, reason: "user_requested" });
  await recordAiAudit({ userId, action: "ai.run.retry_scheduled", resource: run.capability ?? undefined, status: "success", details: { runId: run.id, jobId: job.id } });
  return responseForStoredRun({ ...run, status: "accepted" }, parsedPlan.data, "accepted");
}

const PAUSE_MAX_HOURS = Math.max(1, Number(process.env.AI_PAUSE_MAX_HOURS ?? 24) || 24);

/** Pause is honoured between steps: the step in flight finishes, then the run stops with its plan saved. Credits stay reserved while paused. */
export async function pauseAiRun(userId: number, runId: string): Promise<{ status: string }> {
  const run = await getOrchestrationRun(userId, runId);
  if (!run) throw new RunStateError("NOT_FOUND", "Orchestration run not found.");
  if (run.status === "paused") return { status: "paused" };
  if (!["accepted", "planning", "executing"].includes(run.status)) throw new RunStateError("INVALID_STATE", "Only a running task can be paused.");
  const steps = (run.plan as { steps?: unknown[] } | null)?.steps;
  if (!Array.isArray(steps) || steps.length < 2) throw new RunStateError("INVALID_STATE", "A single-step task can't be paused; stop it instead.");
  if (!(await casOrchestrationRun(run.id, userId, ["accepted", "planning", "executing"], { status: "paused" }))) {
    const now = await getOrchestrationRun(userId, runId);
    if (now?.status === "paused") return { status: "paused" };
    throw new RunStateError("INVALID_STATE", "The task finished or changed state before it could be paused.");
  }
  if (run.taskId) await emit(run.taskId, run.id, "checkpoint_saved", { pauseRequested: true });
  await recordAiAudit({ userId, action: "ai.run.pause_requested", resource: run.capability ?? undefined, status: "success", details: { runId } });
  return { status: "paused" };
}

export async function resumePausedRun(userId: number, runId: string): Promise<{ status: string }> {
  const run = await getOrchestrationRun(userId, runId);
  if (!run || !run.taskId) throw new RunStateError("NOT_FOUND", "Orchestration run not found.");
  if (run.status !== "paused") throw new RunStateError("INVALID_STATE", "Only a paused task can be resumed.");
  const plan = orchestrationPlanSchema.safeParse(run.plan);
  if (!plan.success) throw new RunStateError("INVALID_STATE", "Stored plan cannot be resumed safely.");
  // Order matters: flip paused -> accepted BEFORE enqueueing. The other order lets a worker claim the new job while the run is
  // still "paused", consume the job as a no-op, and leave an "accepted" run with no job (stuck until manual retry).
  if (!(await casOrchestrationRun(run.id, userId, ["paused"], { status: "accepted" }))) throw new RunStateError("INVALID_STATE", "Only a paused task can be resumed.");
  const open = (await listAiJobsForRun(userId, runId)).some((j) => ["queued", "leased", "running"].includes(j.status));
  if (!open) {
    const job = await enqueueAiJob({ id: id("job"), runId: run.id, taskId: run.taskId, kind: "pause_resume", status: "queued", attempts: 0, maxAttempts: 3, availableAt: new Date(), leasedUntil: null, lastError: null, payload: { plan: plan.data }, createdAt: new Date(), updatedAt: new Date() });
    if (!job) {
      await casOrchestrationRun(run.id, userId, ["accepted"], { status: "paused" }); // put it back so it can be resumed again / expired
      throw new RunStateError("UNAVAILABLE", "Resume queue is unavailable.");
    }
  }
  await updateAgentTask(run.taskId, userId, { state: "queued", checkpoint: "resumed" });
  await emit(run.taskId, run.id, "checkpoint_saved", { resumed: true });
  await recordAiAudit({ userId, action: "ai.run.resumed", resource: run.capability ?? undefined, status: "success", details: { runId } });
  return { status: "accepted" };
}

/** Paused runs hold a credit reservation; cancel (and thereby settle/release) any paused longer than AI_PAUSE_MAX_HOURS. */
export async function expirePausedRuns(): Promise<number> {
  const stale = await listStalePausedRuns(new Date(Date.now() - PAUSE_MAX_HOURS * 3_600_000));
  for (const r of stale) { try { await cancelAiRun(r.userId, r.id); await notifyRun(r.userId, "paused_expired", { steps: 2, durationMs: 0, capabilityLabel: "A paused task" }); } catch (e) { console.error("[ai-core] expire paused run failed", e instanceof Error ? e.message : e); } }
  return stale.length;
}

export async function resumeApprovedTask(userId: number, taskId: string): Promise<AiCoreResponse | null> {
  const run = await getOrchestrationRunByTaskId(userId, taskId);
  if (!run || !run.conversationId) return null;
  if (run.status !== "waiting_for_approval") return null;
  const plan = orchestrationPlanSchema.safeParse(run.plan);
  if (!plan.success) throw new Error("Stored plan cannot be resumed safely.");
  const job = await enqueueAiJob({ id: id("job"), runId: run.id, taskId, kind: "approved_resume", status: "leased", attempts: 0, maxAttempts: 1, availableAt: new Date(), leasedUntil: new Date(Date.now() + 60_000), lastError: null, payload: { plan: plan.data, approved: true }, createdAt: new Date(), updatedAt: new Date() });
  if (!job) throw new Error("Approval resume queue is unavailable.");
  await updateAgentTask(taskId, userId, { state: "queued", progress: 45, currentApprovalId: null, checkpoint: "approval_granted" });
  return executeQueuedJob(userId, job.id, run.id, taskId, run.conversationId, plan.data, true);
}

export async function runAiWorkerOnce(): Promise<boolean> {
  await recoverExpiredAiJobLeases();
  const job = await claimNextAiJob();
  if (!job || !job.taskId) return false;
  const run = await getOrchestrationRunById(job.runId);
  if (!run || !run.conversationId) {
    await updateAiJob(job.id, { status: "dead_letter", lastError: "Orchestration run or conversation is missing." });
    return false;
  }
  const storedPlan = orchestrationPlanSchema.safeParse((job.payload as { plan?: unknown } | null)?.plan);
  if (!storedPlan.success) {
    await updateAiJob(job.id, { status: "dead_letter", lastError: "Stored orchestration plan failed validation." });
    await updateOrchestrationRun(run.id, run.userId, { status: "failed", error: { code: "invalid_plan", message: "Stored orchestration plan failed validation.", retryable: false, requestId: run.requestId } });
    return false;
  }
  await executeQueuedJob(run.userId, job.id, run.id, job.taskId, run.conversationId, storedPlan.data, Boolean((job.payload as { approved?: unknown } | null)?.approved));
  return true;
}

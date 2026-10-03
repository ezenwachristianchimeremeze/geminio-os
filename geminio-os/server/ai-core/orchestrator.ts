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
import { getOrchestrationRunById } from "./persistence";
import { insertAgentTask, insertNotification, insertTaskApproval, updateAgentTask } from "../geminio-data";
import { appendConversationMessage, cancelOpenAiJobs, createConversation, createOrchestrationRun, enqueueAiJob, getAiJob, getConversation, getOrchestrationRun, getOrchestrationRunByTaskId, listAiJobsForRun, listConversationMessages, recordProviderAttempt, saveTaskCheckpoint, updateAiJob, updateOrchestrationRun, appendTaskEvent, nextTaskEventSequence, claimNextAiJob, recoverExpiredAiJobLeases } from "./persistence";
import { getCapability, type CapabilityExecutionInstruction } from "./capabilities";
import { normalizeProviderError, resolveProvider } from "./providers";
import { routeIntent } from "./router";
import { consumeRateLimit, recordAiAudit, authorizeCapability, safeErrorDetails } from "./security";

const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

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

export async function submitAiRequest(userId: number, rawInput: AiCoreRequest): Promise<AiCoreResponse> {
  const input = aiCoreRequestSchema.parse(rawInput);
  if (!consumeRateLimit(userId)) {
    await recordAiAudit({ userId, action: "ai.request.rate_limited", status: "warning", details: { requestId: input.requestId } });
    throw new Error("AI request rate limit exceeded. Please retry shortly.");
  }
  const conversation = input.conversationId
    ? await getConversation(userId, input.conversationId)
    : await createConversation({ id: id("conversation"), userId, projectId: input.projectId, title: input.message.slice(0, 80), summary: null, context: {}, status: "active", createdAt: new Date(), updatedAt: new Date() });
  if (!conversation) throw new Error("Conversation storage is unavailable.");

  const route = await routeIntent(input.message);
  const authorization = authorizeCapability({ userId, capability: route.intent.capability, approved: false });
  if (!authorization.allowed && authorization.risk === null) {
    await recordAiAudit({ userId, action: "ai.capability.denied", resource: route.intent.capability, status: "error", details: { requestId: input.requestId, reason: authorization.reason } });
    throw new Error(authorization.reason);
  }
  const plan = buildPlan(route.intent);
  await recordAiAudit({ userId, action: "ai.request.accepted", resource: route.intent.capability, status: "success", details: { requestId: input.requestId, fallbackUsed: route.fallbackUsed } });
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
  if (!createdTask || !run) throw new Error("AI Core durable storage is unavailable.");
  await appendConversationMessage({ id: id("message"), userId, conversationId: conversation.id, role: "user", content: input.message });
  await emit(taskId, runId, "accepted", { requestId: input.requestId });
  await emit(taskId, runId, "intent_resolved", { capability: route.intent.capability, confidence: route.intent.confidence, fallbackUsed: route.fallbackUsed });
  await emit(taskId, runId, "plan_created", { stepCount: plan.steps.length });
  await updateOrchestrationRun(runId, userId, { status: "accepted", plan });
  await updateAgentTask(taskId, userId, { state: "queued", progress: 10, checkpoint: "plan_created" });
  const job = await enqueueAiJob({ id: id("job"), runId, taskId, kind: "execute_plan", status: "queued", attempts: 0, maxAttempts: 3, availableAt: new Date(), leasedUntil: null, lastError: null, payload: { input, plan }, createdAt: new Date(), updatedAt: new Date() });
  if (!job) throw new Error("AI Core queue storage is unavailable.");

  if (input.mode === "execute") {
    return executeQueuedJob(userId, job.id, runId, taskId, conversation.id, plan);
  }
  return aiCoreResponseSchema.parse({ runId, taskId, conversationId: conversation.id, status: "accepted", intent: route.intent, plan, result: null, error: null });
}

async function executeCapability(userId: number, runId: string, taskId: string, conversationId: string, input: AiCoreRequest, plan: ReturnType<typeof orchestrationPlanSchema.parse>, approved = false): Promise<VerifiedResult> {
  const step = plan.steps[0];
  const provider = resolveProvider();
  const capability = getCapability(step.capability);
  const authorization = authorizeCapability({ userId, capability: step.capability, approved });
  if (!authorization.allowed && authorization.risk === null) throw new Error(authorization.reason);
  const attempt = Date.now();
  await recordProviderAttempt({ id: id("provider_attempt"), runId, provider: provider.provider, model: "gpt-5-mini", attempt: 1, status: "started", latencyMs: null, errorCode: null, errorMessage: null, usage: null, createdAt: new Date() });
  await emit(taskId, runId, "step_started", { capability: step.capability });

  if (step.requiresApproval && !approved) {
    const action = approvalActionForCapability(step.capability);
    if (action) {
      const approvalId = id("approval");
      await insertTaskApproval({ id: approvalId, taskId, userId, action, summary: `Approval required for ${step.title}.`, status: "pending", requestedAt: new Date(), resolvedAt: null });
      await updateAgentTask(taskId, userId, { state: "waiting_for_user", progress: 35, currentApprovalId: approvalId, checkpoint: "approval_requested" });
      await updateOrchestrationRun(runId, userId, { status: "waiting_for_approval" });
      await emit(taskId, runId, "approval_requested", { approvalId, action });
      return { status: "unverified", summary: "Waiting for explicit user approval before any external side effect.", output: { approvalId, capability: step.capability }, checks: [{ name: "approval_gate", passed: false, details: "The requested operation is paused until approval is granted." }] };
    }
  }

  if (step.risk === "external_side_effect") {
    throw new Error("This operation is approved but cannot execute because no dedicated external execution provider is configured.");
  }

  const conversationMessages = (await listConversationMessages(userId, conversationId, 20))
    .reverse()
    .map((message) => ({ role: message.role, content: message.content } as const));
  const instruction: CapabilityExecutionInstruction = capability?.handler
    ? capability.handler({ userId, runId, taskId, projectId: input.projectId, requestMessage: input.message, parameters: step.input, conversationMessages })
    : {
        messages: [
          { role: "system", content: "You are a Geminio OS execution worker. Return a reviewable result and never claim an external side effect succeeded without a connected execution provider." },
          { role: "user", content: `Capability: ${step.capability}\nRequest: ${input.message}\nParameters: ${JSON.stringify(step.input)}` },
        ],
        maxTokens: 4000,
        outputKind: "plan",
        verificationCheck: "The configured AI provider returned a reviewable response.",
      };
  try {
    const response = await provider.invoke({ messages: instruction.messages, model: "gpt-5-mini", maxTokens: instruction.maxTokens });
    const outputText = textContent(response.result.choices[0]?.message?.content);
    await recordProviderAttempt({ id: id("provider_attempt"), runId, provider: provider.provider, model: response.model, attempt: 1, status: "succeeded", latencyMs: response.latencyMs, errorCode: null, errorMessage: null, usage: response.result.usage ?? null, createdAt: new Date() });
    const output = { text: outputText, capability: step.capability, provider: provider.provider, kind: instruction.outputKind };
    return { status: "verified", summary: "The capability-specific execution handler completed with a provider result.", output, checks: [{ name: "provider_response", passed: true, details: instruction.verificationCheck }] };
  } catch (error) {
    const failure = normalizeProviderError(error, provider.provider);
    await recordProviderAttempt({ id: id("provider_attempt"), runId, provider: provider.provider, model: "gpt-5-mini", attempt: 1, status: failure.retryable ? "timed_out" : "failed", latencyMs: Date.now() - attempt, errorCode: failure.code, errorMessage: failure.message, usage: null, createdAt: new Date() });
    throw Object.assign(new Error(failure.message), { retryable: failure.retryable, failure });
  }
}

export async function executeQueuedJob(userId: number, jobId: string, runId: string, taskId: string, conversationId: string, plan: ReturnType<typeof orchestrationPlanSchema.parse>, approved = false): Promise<AiCoreResponse> {
  const run = await getOrchestrationRun(userId, runId);
  if (!run) throw new Error("Orchestration run not found.");
  const currentJob = await getAiJob(jobId);
  if (run.status === "cancelled" || currentJob?.status === "cancelled") {
    return aiCoreResponseSchema.parse({ runId, taskId, conversationId, status: "cancelled", intent: plan.intent, plan, result: null, error: null });
  }
  const input = aiCoreRequestSchema.parse({ message: run.input, requestId: run.requestId, conversationId, projectId: run.projectId ?? null, mode: "execute", metadata: {} });
  const currentAttempt = currentJob?.attempts ?? 0;
  await updateAiJob(jobId, { status: "running", attempts: currentAttempt + 1 });
  await updateOrchestrationRun(runId, userId, { status: "executing" });
  await updateAgentTask(taskId, userId, { state: "running", progress: 35, checkpoint: "execution_started" });
  try {
    const result = await executeCapability(userId, runId, taskId, conversationId, input, plan, approved);
    if (result.output.text && run.capability === "conversation.reply") {
      await appendConversationMessage({ id: id("message"), userId, conversationId, role: "assistant", content: String(result.output.text) });
    }
    await saveTaskCheckpoint({ id: id("checkpoint"), taskId, runId, name: "verified_result", version: 1, state: result, createdAt: new Date() });
    if (result.status === "unverified") {
      await updateAiJob(jobId, { status: "succeeded" });
      return aiCoreResponseSchema.parse({ runId, taskId, conversationId, status: "waiting_for_approval", intent: null, plan, result, error: null });
    }
    await updateAiJob(jobId, { status: "succeeded" });
    await updateAgentTask(taskId, userId, { state: "completed", progress: 100, checkpoint: "verified_result", lastError: null });
    await updateOrchestrationRun(runId, userId, { status: "completed", result });
    await insertNotification({ id: id("notification"), userId, title: "AI task completed", message: `${run.capability ?? "Your requested task"} returned a verified result.`, type: "success", read: false, createdAt: new Date() });
    await emit(taskId, runId, "verification_completed", { status: result.status });
    await emit(taskId, runId, "completed", { status: result.status });
    return aiCoreResponseSchema.parse({ runId, taskId, conversationId, status: "completed", intent: plan.intent, plan, result, error: null });
  } catch (error) {
    const afterFailureJob = await getAiJob(jobId);
    if (afterFailureJob?.status === "cancelled") {
      return aiCoreResponseSchema.parse({ runId, taskId, conversationId, status: "cancelled", intent: plan.intent, plan, result: null, error: null });
    }
    const retryable = Boolean(error && typeof error === "object" && "retryable" in error && (error as { retryable?: unknown }).retryable);
    const message = error instanceof Error ? error.message : "Execution failed.";
    const retryAllowed = retryable && currentJob !== null && currentAttempt + 1 < currentJob.maxAttempts;
    await recordAiAudit({ userId, action: "ai.execution.failed", resource: run.capability ?? undefined, status: "error", details: { ...safeErrorDetails(error), retryAllowed, attempt: currentAttempt + 1 } });
    await updateAiJob(jobId, { status: retryAllowed ? "queued" : "dead_letter", attempts: currentAttempt + 1, lastError: message, availableAt: new Date(Date.now() + 1500) });
    await updateAgentTask(taskId, userId, { state: retryAllowed ? "retrying" : "failed", progress: 35, lastError: message, checkpoint: "execution_failed" });
    await updateOrchestrationRun(runId, userId, { status: retryAllowed ? "executing" : "failed", error: { code: retryAllowed ? "retry_scheduled" : "execution_failed", message, retryable: retryAllowed, requestId: run.requestId } });
    await insertNotification({ id: id("notification"), userId, title: retryAllowed ? "AI task retry scheduled" : "AI task failed", message: retryAllowed ? "Geminio will retry the task within the durable worker queue." : message, type: retryAllowed ? "warning" : "error", read: false, createdAt: new Date() });
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
  if (!run) throw new Error("Orchestration run not found.");
  const parsedPlan = orchestrationPlanSchema.safeParse(run.plan);
  if (!parsedPlan.success) throw new Error("Stored plan cannot be cancelled safely.");
  if (run.status === "completed" || run.status === "failed") throw new Error("Only active orchestration runs can be cancelled.");
  if (run.status === "cancelled") return responseForStoredRun(run, parsedPlan.data, "cancelled");

  const cancelledJobs = await cancelOpenAiJobs(run.id);
  await updateOrchestrationRun(run.id, userId, { status: "cancelled", error: null });
  if (run.taskId) {
    await updateAgentTask(run.taskId, userId, { state: "cancelled", progress: 0, checkpoint: "cancelled", lastError: null });
    await emit(run.taskId, run.id, "cancelled", { cancelledJobs, reason: "user_requested" });
  }
  await recordAiAudit({ userId, action: "ai.run.cancelled", resource: run.capability ?? undefined, status: "success", details: { runId: run.id, cancelledJobs } });
  return responseForStoredRun(run, parsedPlan.data, "cancelled");
}

export async function retryAiRun(userId: number, runId: string): Promise<AiCoreResponse> {
  const run = await getOrchestrationRun(userId, runId);
  if (!run || !run.taskId) throw new Error("Orchestration run not found.");
  if (!run.conversationId) throw new Error("The orchestration run cannot be retried without a conversation.");
  if (run.status !== "failed") throw new Error("Only failed orchestration runs can be retried.");
  const parsedPlan = orchestrationPlanSchema.safeParse(run.plan);
  if (!parsedPlan.success) throw new Error("Stored plan cannot be retried safely.");
  const existingJobs = await listAiJobsForRun(userId, runId);
  if (existingJobs.some((job) => ["queued", "leased", "running"].includes(job.status))) {
    return responseForStoredRun(run, parsedPlan.data, "accepted");
  }

  const job = await enqueueAiJob({ id: id("job"), runId: run.id, taskId: run.taskId, kind: "manual_retry", status: "queued", attempts: 0, maxAttempts: 3, availableAt: new Date(), leasedUntil: null, lastError: null, payload: { plan: parsedPlan.data }, createdAt: new Date(), updatedAt: new Date() });
  if (!job) throw new Error("Retry queue is unavailable.");
  await updateOrchestrationRun(run.id, userId, { status: "accepted", result: null, error: null });
  await updateAgentTask(run.taskId, userId, { state: "retrying", progress: 10, checkpoint: "manual_retry_requested", lastError: null });
  await emit(run.taskId, run.id, "retry_scheduled", { jobId: job.id, reason: "user_requested" });
  await recordAiAudit({ userId, action: "ai.run.retry_scheduled", resource: run.capability ?? undefined, status: "success", details: { runId: run.id, jobId: job.id } });
  return responseForStoredRun({ ...run, status: "accepted" }, parsedPlan.data, "accepted");
}

export async function resumeApprovedTask(userId: number, taskId: string): Promise<AiCoreResponse | null> {
  const run = await getOrchestrationRunByTaskId(userId, taskId);
  if (!run || !run.conversationId) return null;
  if (run.status !== "waiting_for_approval") return null;
  const plan = orchestrationPlanSchema.safeParse(run.plan);
  if (!plan.success) throw new Error("Stored plan cannot be resumed safely.");
  const job = await enqueueAiJob({ id: id("job"), runId: run.id, taskId, kind: "approved_resume", status: "queued", attempts: 0, maxAttempts: 1, availableAt: new Date(), leasedUntil: null, lastError: null, payload: { plan: plan.data, approved: true }, createdAt: new Date(), updatedAt: new Date() });
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

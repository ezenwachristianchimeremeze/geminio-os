import { z } from "zod";

export const TASK_STATES = [
  "queued",
  "planning",
  "running",
  "waiting_for_user",
  "testing",
  "completed",
  "cancelled",
  "failed",
  "retrying",
] as const;

export type TaskState = (typeof TASK_STATES)[number];

export const taskStateSchema = z.enum(TASK_STATES);

export const TASK_TRANSITIONS: Record<TaskState, readonly TaskState[]> = {
  queued: ["planning", "cancelled", "failed"],
  planning: ["running", "waiting_for_user", "cancelled", "failed"],
  running: ["waiting_for_user", "testing", "cancelled", "failed"],
  waiting_for_user: ["running", "cancelled", "failed"],
  testing: ["completed", "cancelled", "failed", "retrying"],
  completed: [],
  cancelled: [],
  failed: ["retrying"],
  retrying: ["planning", "running", "cancelled", "failed"],
};

export const approvalActionSchema = z.enum([
  "deploy_production",
  "send_money",
  "purchase_credits",
  "delete_project",
  "connect_provider",
  "publish_marketplace_item",
]);

export type ApprovalAction = z.infer<typeof approvalActionSchema>;

export const taskApprovalSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  action: approvalActionSchema,
  summary: z.string().min(1),
  status: z.enum(["pending", "approved", "rejected", "expired"]),
  requestedAt: z.coerce.date(),
  resolvedAt: z.coerce.date().nullable(),
});

export type TaskApproval = z.infer<typeof taskApprovalSchema>;

export const agentTaskSchema = z.object({
  id: z.string().min(1),
  ownerId: z.number().int().positive(),
  projectId: z.string().nullable(),
  title: z.string().min(1),
  state: taskStateSchema,
  progress: z.number().min(0).max(100),
  requiresApproval: z.boolean(),
  currentApprovalId: z.string().nullable(),
  lastError: z.string().nullable(),
  checkpoint: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type AgentTask = z.infer<typeof agentTaskSchema>;

export const creditLedgerEntrySchema = z.object({
  id: z.string().min(1),
  ownerId: z.number().int().positive(),
  kind: z.enum(["grant", "usage", "purchase", "refund", "expiration", "adjustment"]),
  amount: z.number().finite(),
  balanceAfter: z.number().nonnegative(),
  capability: z.string().nullable(),
  referenceId: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export type CreditLedgerEntry = z.infer<typeof creditLedgerEntrySchema>;

export const entitlementSchema = z.object({
  productId: z.string().min(1),
  status: z.enum(["active", "trial", "grace_period", "expired", "revoked"]),
  source: z.enum(["free", "subscription", "purchase", "promotional"]),
  expiresAt: z.coerce.date().nullable(),
  limits: z.record(z.string(), z.number().nonnegative()),
});

export type Entitlement = z.infer<typeof entitlementSchema>;

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  requestId: z.string().min(1),
  retryable: z.boolean(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const apiEnvelopeSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), requestId: z.string().min(1), data: z.unknown() }),
  z.object({ ok: z.literal(false), requestId: z.string().min(1), error: apiErrorSchema }),
]);

export type ApiEnvelope<T> =
  | { ok: true; requestId: string; data: T }
  | { ok: false; requestId: string; error: z.infer<typeof apiErrorSchema> };

export function canTransitionTask(from: TaskState, to: TaskState): boolean {
  return TASK_TRANSITIONS[from].includes(to);
}

export function transitionTask(task: AgentTask, nextState: TaskState, patch: Partial<Pick<AgentTask, "progress" | "currentApprovalId" | "lastError" | "checkpoint">> = {}): AgentTask {
  if (!canTransitionTask(task.state, nextState)) {
    throw new Error(`Invalid task transition: ${task.state} -> ${nextState}`);
  }

  const updated: AgentTask = {
    ...task,
    ...patch,
    state: nextState,
    updatedAt: new Date(),
  };
  return agentTaskSchema.parse(updated);
}

export function applyCreditDelta(balance: number, delta: number): number {
  if (!Number.isFinite(balance) || balance < 0) throw new Error("Invalid credit balance");
  if (!Number.isFinite(delta)) throw new Error("Invalid credit delta");
  const next = balance + delta;
  if (next < 0) throw new Error("Insufficient credits");
  return Number(next.toFixed(6));
}

export function requiresExplicitApproval(action: ApprovalAction): boolean {
  return ["deploy_production", "send_money", "purchase_credits", "delete_project", "connect_provider", "publish_marketplace_item"].includes(action);
}


export const aiStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start"), requestId: z.string().min(1), model: z.string().min(1) }),
  z.object({ type: z.literal("delta"), requestId: z.string().min(1), text: z.string().max(32_000) }),
  z.object({ type: z.literal("tool_call"), requestId: z.string().min(1), name: z.string().min(1), input: z.record(z.string(), z.unknown()) }),
  z.object({ type: z.literal("usage"), requestId: z.string().min(1), inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative() }),
  z.object({ type: z.literal("complete"), requestId: z.string().min(1), finishReason: z.enum(["stop", "length", "tool_call", "error"]) }),
  z.object({ type: z.literal("error"), requestId: z.string().min(1), error: apiErrorSchema }),
]);

export type AiStreamEvent = z.infer<typeof aiStreamEventSchema>;

export const uploadDescriptorSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().regex(/^[\w.+-]+\/[\w.+-]+$/),
  sizeBytes: z.number().int().positive().max(50 * 1024 * 1024),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

export type UploadDescriptor = z.infer<typeof uploadDescriptorSchema>;

export function parseAiStreamEvent(input: unknown): AiStreamEvent {
  return aiStreamEventSchema.parse(input);
}

export function validateUploadDescriptor(input: unknown): UploadDescriptor {
  return uploadDescriptorSchema.parse(input);
}


export const aiProviderSchema = z.enum(["builtin-llm", "anthropic", "openrouter", "unavailable"]);
export type AiProvider = z.infer<typeof aiProviderSchema>;

export const capabilityRiskSchema = z.enum(["read", "write", "external_side_effect"]);
export type CapabilityRisk = z.infer<typeof capabilityRiskSchema>;

export const capabilityIdSchema = z.string().regex(/^[a-z][a-z0-9._-]{2,100}$/);
export type CapabilityId = z.infer<typeof capabilityIdSchema>;

export const aiIntentSchema = z.object({
  name: z.string().min(1).max(120),
  capability: capabilityIdSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(2000),
  requiresApproval: z.boolean(),
  risk: capabilityRiskSchema,
  parameters: z.record(z.string(), z.unknown()),
});
export type AiIntent = z.infer<typeof aiIntentSchema>;

export const orchestrationStatusSchema = z.enum([
  "accepted",
  "planning",
  "executing",
  "waiting_for_approval",
  "verifying",
  "completed",
  "failed",
  "cancelled",
]);
export type OrchestrationStatus = z.infer<typeof orchestrationStatusSchema>;

export const executionStepSchema = z.object({
  id: z.string().min(1).max(120),
  capability: capabilityIdSchema,
  title: z.string().min(1).max(255),
  input: z.record(z.string(), z.unknown()),
  risk: capabilityRiskSchema,
  requiresApproval: z.boolean(),
  status: z.enum(["pending", "running", "waiting_for_approval", "completed", "failed", "skipped"]),
  output: z.record(z.string(), z.unknown()).nullable(),
  error: apiErrorSchema.nullable(),
});
export type ExecutionStep = z.infer<typeof executionStepSchema>;

export const orchestrationPlanSchema = z.object({
  version: z.literal(1),
  intent: aiIntentSchema,
  steps: z.array(executionStepSchema).min(1).max(50),
  verification: z.array(z.string().min(1).max(500)).max(20),
});
export type OrchestrationPlan = z.infer<typeof orchestrationPlanSchema>;

export const capabilityDescriptorSchema = z.object({
  id: capabilityIdSchema,
  displayName: z.string().min(1).max(120),
  description: z.string().min(1).max(1000),
  inputSchema: z.record(z.string(), z.unknown()),
  risk: capabilityRiskSchema,
  supportedProviders: z.array(aiProviderSchema).min(1),
  requiresApproval: z.boolean(),
  enabled: z.boolean(),
});
export type CapabilityDescriptor = z.infer<typeof capabilityDescriptorSchema>;

export const providerFailureSchema = z.object({
  provider: aiProviderSchema,
  code: z.string().min(1).max(120),
  message: z.string().min(1).max(2000),
  retryable: z.boolean(),
  retryAfterMs: z.number().int().nonnegative().nullable(),
});
export type ProviderFailure = z.infer<typeof providerFailureSchema>;

export const verifiedResultSchema = z.object({
  status: z.enum(["verified", "partially_verified", "unverified"]),
  summary: z.string().max(4000),
  output: z.record(z.string(), z.unknown()),
  checks: z.array(z.object({
    name: z.string().min(1).max(255),
    passed: z.boolean(),
    details: z.string().max(2000),
  })).max(50),
});
export type VerifiedResult = z.infer<typeof verifiedResultSchema>;

export const taskEventTypeSchema = z.enum([
  "accepted",
  "intent_resolved",
  "plan_created",
  "step_started",
  "tool_called",
  "approval_requested",
  "checkpoint_saved",
  "retry_scheduled",
  "step_completed",
  "verification_started",
  "verification_completed",
  "completed",
  "cancelled",
  "failed",
]);
export type TaskEventType = z.infer<typeof taskEventTypeSchema>;

export const aiCoreRequestSchema = z.object({
  message: z.string().min(1).max(50_000),
  requestId: z.string().min(1).max(128),
  conversationId: z.string().min(1).max(64).nullable().default(null),
  projectId: z.string().min(1).max(64).nullable().default(null),
  mode: z.enum(["chat", "plan", "execute"]).default("execute"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type AiCoreRequest = z.infer<typeof aiCoreRequestSchema>;

export const aiCoreResponseSchema = z.object({
  runId: z.string().min(1),
  taskId: z.string().min(1).nullable(),
  conversationId: z.string().min(1),
  status: orchestrationStatusSchema,
  intent: aiIntentSchema.nullable(),
  plan: orchestrationPlanSchema.nullable(),
  result: verifiedResultSchema.nullable(),
  error: apiErrorSchema.nullable(),
});
export type AiCoreResponse = z.infer<typeof aiCoreResponseSchema>;

export function redactSensitiveMetadata(input: Record<string, unknown>): Record<string, unknown> {
  const sensitive = /token|secret|password|authorization|api[-_]?key|cookie/i;
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, sensitive.test(key) ? "[REDACTED]" : value]));
}

export const liveBuilderProjectKindSchema = z.enum(["website", "mobile_app", "workflow", "api"]);
export type LiveBuilderProjectKind = z.infer<typeof liveBuilderProjectKindSchema>;

export const liveBuilderWorkspaceStatusSchema = z.enum(["active", "archived"]);
export type LiveBuilderWorkspaceStatus = z.infer<typeof liveBuilderWorkspaceStatusSchema>;

export const livePreviewEngineSchema = z.enum(["controlled_canvas", "external_runner", "unavailable"]);
export type LivePreviewEngine = z.infer<typeof livePreviewEngineSchema>;

export const livePreviewTargetSchema = z.enum(["phone", "tablet", "laptop", "desktop"]);
export type LivePreviewTarget = z.infer<typeof livePreviewTargetSchema>;

export const liveBuilderFileKindSchema = z.enum(["page", "component", "asset", "api", "database", "config", "environment", "manifest"]);
export type LiveBuilderFileKind = z.infer<typeof liveBuilderFileKindSchema>;

export const liveBuilderFileOperationSchema = z.enum(["add", "modify", "delete"]);
export type LiveBuilderFileOperation = z.infer<typeof liveBuilderFileOperationSchema>;

export const liveBuilderChangeStatusSchema = z.enum(["proposed", "awaiting_approval", "applied", "reverted", "rejected", "failed"]);
export type LiveBuilderChangeStatus = z.infer<typeof liveBuilderChangeStatusSchema>;

export const liveBuilderValidationStatusSchema = z.enum(["pending", "running", "passed", "failed", "blocked"]);
export type LiveBuilderValidationStatus = z.infer<typeof liveBuilderValidationStatusSchema>;

export const liveBuilderDeploymentStatusSchema = z.enum(["draft", "awaiting_approval", "approved", "rejected", "submitted", "blocked"]);
export type LiveBuilderDeploymentStatus = z.infer<typeof liveBuilderDeploymentStatusSchema>;

export const liveBuilderPreviewNodeSchema = z.object({
  id: z.string().min(1).max(128),
  type: z.enum(["heading", "text", "button", "card", "image", "input", "list", "navigation"]),
  label: z.string().min(1).max(255),
  text: z.string().max(4_000).nullable().default(null),
  filePath: z.string().min(1).max(512),
  componentName: z.string().max(255).nullable().default(null),
  properties: z.record(z.string(), z.unknown()).default({}),
});
export type LiveBuilderPreviewNode = z.infer<typeof liveBuilderPreviewNodeSchema>;

/**
 * Sandboxed declarative preview description. It is intentionally not executable source code:
 * arbitrary code execution must be delegated to a configured isolated preview runner.
 */
export const liveBuilderPreviewDocumentSchema = z.object({
  route: z.string().min(1).max(512).default("/"),
  background: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#F7F7FA"),
  nodes: z.array(liveBuilderPreviewNodeSchema).max(100).default([]),
});
export type LiveBuilderPreviewDocument = z.infer<typeof liveBuilderPreviewDocumentSchema>;

export const liveBuilderSelectionSchema = z.object({
  elementId: z.string().min(1).max(128),
  label: z.string().min(1).max(255),
  filePath: z.string().min(1).max(512),
  componentName: z.string().max(255).nullable().default(null),
  properties: z.record(z.string(), z.unknown()).default({}),
});
export type LiveBuilderSelection = z.infer<typeof liveBuilderSelectionSchema>;

export const liveBuilderFilePatchSchema = z.object({
  path: z.string().min(1).max(512),
  operation: liveBuilderFileOperationSchema,
  kind: liveBuilderFileKindSchema,
  content: z.string().max(250_000).nullable(),
  summary: z.string().min(1).max(1_000),
});
export type LiveBuilderFilePatch = z.infer<typeof liveBuilderFilePatchSchema>;

export const liveBuilderChangeSetSchema = z.object({
  id: z.string().min(1).max(64),
  workspaceId: z.string().min(1).max(64),
  runId: z.string().min(1).max(64).nullable(),
  prompt: z.string().min(1).max(50_000),
  selectedElement: liveBuilderSelectionSchema.nullable(),
  summary: z.string().min(1).max(4_000),
  rationale: z.string().max(4_000).nullable(),
  patches: z.array(liveBuilderFilePatchSchema).min(1).max(50),
  status: liveBuilderChangeStatusSchema,
  requiresApproval: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type LiveBuilderChangeSet = z.infer<typeof liveBuilderChangeSetSchema>;

export const liveBuilderValidationCheckSchema = z.object({
  name: z.string().min(1).max(255),
  status: z.enum(["passed", "failed", "skipped", "blocked"]),
  details: z.string().max(4_000),
});
export type LiveBuilderValidationCheck = z.infer<typeof liveBuilderValidationCheckSchema>;

export const liveBuilderValidationRunSchema = z.object({
  id: z.string().min(1).max(64),
  workspaceId: z.string().min(1).max(64),
  changeSetId: z.string().min(1).max(64).nullable(),
  target: livePreviewTargetSchema,
  status: liveBuilderValidationStatusSchema,
  checks: z.array(liveBuilderValidationCheckSchema).max(50),
  logSummary: z.string().max(8_000).nullable(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});
export type LiveBuilderValidationRun = z.infer<typeof liveBuilderValidationRunSchema>;

export const liveBuilderVersionSchema = z.object({
  id: z.string().min(1).max(64),
  workspaceId: z.string().min(1).max(64),
  number: z.number().int().positive(),
  label: z.string().min(1).max(255),
  changeSetId: z.string().min(1).max(64).nullable(),
  preview: liveBuilderPreviewDocumentSchema,
  createdAt: z.string().datetime(),
});
export type LiveBuilderVersion = z.infer<typeof liveBuilderVersionSchema>;


export const liveBuilderRuntimeStatusSchema = z.enum(["starting", "ready", "stopping", "stopped", "failed", "timed_out", "crashed"]);
export type LiveBuilderRuntimeStatus = z.infer<typeof liveBuilderRuntimeStatusSchema>;

export const liveBuilderRuntimeEventTypeSchema = z.enum(["starting", "build_started", "build_output", "build_succeeded", "build_failed", "runtime_ready", "runtime_output", "runtime_error", "health_check", "stopping", "stopped", "crashed", "timed_out", "recovered"]);
export type LiveBuilderRuntimeEventType = z.infer<typeof liveBuilderRuntimeEventTypeSchema>;

export const liveBuilderRuntimeDiagnosticSchema = z.object({
  severity: z.enum(["info", "warning", "error"]),
  source: z.enum(["sandbox", "build", "runtime", "preview"]),
  message: z.string().min(1).max(8_000),
  code: z.string().max(120).nullable().default(null),
  filePath: z.string().max(512).nullable().default(null),
  line: z.number().int().positive().nullable().default(null),
  column: z.number().int().positive().nullable().default(null),
});
export type LiveBuilderRuntimeDiagnostic = z.infer<typeof liveBuilderRuntimeDiagnosticSchema>;

export const liveBuilderRuntimeEventSchema = z.object({
  id: z.string().min(1).max(64),
  sessionId: z.string().min(1).max(64),
  sequence: z.number().int().positive(),
  type: liveBuilderRuntimeEventTypeSchema,
  message: z.string().max(8_000),
  diagnostics: z.array(liveBuilderRuntimeDiagnosticSchema).max(50).default([]),
  createdAt: z.string().datetime(),
});
export type LiveBuilderRuntimeEvent = z.infer<typeof liveBuilderRuntimeEventSchema>;

export const liveBuilderRuntimeSessionSchema = z.object({
  id: z.string().min(1).max(64),
  workspaceId: z.string().min(1).max(64),
  versionId: z.string().max(64).nullable(),
  target: livePreviewTargetSchema,
  engine: livePreviewEngineSchema,
  status: liveBuilderRuntimeStatusSchema,
  url: z.string().url().nullable(),
  isolation: z.enum(["controlled_canvas", "external_sandbox", "unavailable"]),
  outputMode: z.enum(["declarative", "executable", "unavailable"]),
  lastError: z.string().max(8_000).nullable(),
  updatedAt: z.string().datetime(),
});
export type LiveBuilderRuntimeSession = z.infer<typeof liveBuilderRuntimeSessionSchema>;

export const liveBuilderRuntimeStartInputSchema = z.object({
  workspaceId: z.string().min(1).max(64),
  target: livePreviewTargetSchema,
  engine: z.enum(["controlled_canvas", "external_runner"]).default("external_runner"),
  versionId: z.string().max(64).nullable().optional(),
});
export type LiveBuilderRuntimeStartInput = z.infer<typeof liveBuilderRuntimeStartInputSchema>;

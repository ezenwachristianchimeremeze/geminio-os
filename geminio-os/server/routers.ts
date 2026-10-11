import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { redactForClient } from "./ai-core/redact";
import { getOperation } from "./credits/operations";
import { getMysqlOperationStore } from "./credits/operation-store";
import { homeChatRouter } from "./home-chat/router";
import { CreditError, finalizeReservation, grantCredits, reserveCredits } from "./credits/ledger";
import { getMysqlCreditStore } from "./credits/mysql-store";
import { adminProcedure, mergeRouters, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { chatExtrasRouter } from "./routers/chat";
import { aiBuilderRouter } from "./ai-builder/router";
import { devPreviewRouter } from "./dev-preview/router";
import { changeSetErrorCode, ChangeSetError } from "./live-builder/atomic-apply";
import { jobsRouter } from "./routers/jobs";
import { featuresRouter } from "./routers/features";
import { advisorRouter } from "./routers/advisor";
import { TRPCError } from "@trpc/server";
import { findUsageRecord, insertAgentTask, insertCreditLedgerEntry, insertEntitlement, insertTaskApproval, insertUsageRecord, listAgentTasks, listCreditLedger, listEntitlements, listNotifications, markAllNotificationsRead, markNotificationRead, resolveTaskApproval, transitionAgentTask, updateAgentTask } from "./geminio-data";
import { agentTaskSchema, approvalActionSchema, canTransitionTask, transitionTask, applyCreditDelta, taskStateSchema } from "../shared/geminio-contracts";
import { aiCoreRequestSchema } from "../shared/geminio-contracts";
import { cancelGatewayRun, getGatewayCapabilities, getGatewayEvents, getGatewayRun, getGatewayRunDetails, listGatewayDeadLetters, listGatewayRuns, recoverGatewayExpiredLeases, retryGatewayRun, submitGatewayRequest } from "./ai-core/gateway";
import { approvalOutcomeError } from "./task-approvals";
import { userOwnsProject } from "./ai-core/persistence";
import { runControlCall } from "./ai-core/run-control";
import { resumeApprovedTask } from "./ai-core/orchestrator";
import { applyLiveBuilderChangeSet, createLiveBuilderWorkspace, getLiveBuilderWorkspace, listLiveBuilderWorkspaces, proposeLiveBuilderFileChange, proposeLiveBuilderPromptChange, requestLiveBuilderDeployment, restoreLiveBuilderVersion, setLiveBuilderSelection, startLiveBuilderPreview, validateLiveBuilderWorkspace , rejectLiveBuilderChangeSet, verifyLiveBuilderIntegrity, recoverLiveBuilderWorkspace} from "./live-builder/service";
import { getLiveBuilderRuntime, listLiveBuilderRuntimes, listRuntimeEvents, rebuildLiveBuilderRuntime, restartLiveBuilderRuntime, startLiveBuilderRuntime, stopLiveBuilderRuntime } from "./live-builder/runtime";
import { defaultRunnerControlPlane, ContainerProvider, MicroVMProvider } from "./live-builder/control-plane";
import { defaultPreviewGateway, PreviewOwnershipError } from "./live-builder/preview-gateway";
import { destinationForCapability } from "./ai-core/destinations";
import {
  appBuilderRouter,
  websiteBuilderRouter,
  workflowBuilderRouter,
  databaseBuilderRouter,
  aiAgentBuilderRouter,
  projectManagementRouter,
} from "./builders";

const requestId = () => `req_${crypto.randomUUID()}`;


/** Translate Live Builder domain errors into proper API status codes (structured problems are returned in the message). */
async function liveBuilderCall<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    const code = changeSetErrorCode(error);
    if (code === "INTERNAL_SERVER_ERROR" && !(error instanceof ChangeSetError)) throw error;
    const problems = error instanceof ChangeSetError && error.problems.length ? ` ${error.problems.slice(0, 5).join("; ")}` : "";
    throw new TRPCError({ code, message: `${(error as Error).message}${problems}`.slice(0, 1000), cause: error });
  }
}

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // AI Chat Router
  chat: mergeRouters(router({
    // Send a message to the AI and get a response
    sendMessage: publicProcedure
      .input(
        z.object({
          message: z.string().min(1, "Message cannot be empty").max(20_000),
          conversationId: z.string().min(1).nullable().default(null),
          conversationHistory: z
            .array(
              z.object({
                role: z.enum(["user", "assistant", "system"]),
                content: z.string().max(20_000),
              })
            )
            .max(50)
            .default([]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          if (ctx.user) {
            const result = await submitGatewayRequest(ctx.user.id, {
              message: input.message,
              requestId: requestId(),
              conversationId: input.conversationId,
              projectId: null,
              mode: "execute",
              metadata: { conversationHistory: input.conversationHistory },
            });
            return {
              success: result.status !== "failed",
              response: result.result?.output?.text ?? result.result?.summary ?? "Your request was accepted by Geminio OS.",
              timestamp: new Date(),
              runId: result.runId,
              taskId: result.taskId,
              conversationId: result.conversationId,
              status: result.status,
              error: result.error,
              destination: destinationForCapability(result.intent?.capability),
            };
          }

          // Unauthenticated callers are refused: the old raw-LLM fallback was unmetered and used a hard-coded model.
          return {
            success: false,
            response: "Please sign in to chat with Geminio.",
            timestamp: new Date(),
            runId: null,
            taskId: null,
            conversationId: null,
            status: "failed" as const,
            error: { message: "Authentication required." },
            destination: null,
          };
        } catch (error) {
          console.error("Chat error:", error);
          return {
            success: false,
            response: "Sorry, I encountered an error. Please try again.",
            timestamp: new Date(),
            runId: null,
            taskId: null,
            conversationId: null,
            status: "failed" as const,
            error: { message: error instanceof Error ? error.message : "Unknown chat error" },
            destination: null,
          };
        }
      }),
  }), chatExtrasRouter),

  jobs: jobsRouter,
  features: featuresRouter,
  advisor: advisorRouter,

  notifications: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).default({ limit: 50 }))
      .query(({ input, ctx }) => listNotifications(ctx.user.id, input.limit)),
    markRead: protectedProcedure
      .input(z.object({ notificationId: z.string().min(1).max(64) }))
      .mutation(({ input, ctx }) => markNotificationRead(ctx.user.id, input.notificationId)),
    markAllRead: protectedProcedure
      .mutation(({ ctx }) => markAllNotificationsRead(ctx.user.id)),
  }),

  homeChat: homeChatRouter,

  /** Read-only retrieval of persisted AI operation results. Never executes or charges. */
  operations: router({
    get: protectedProcedure.input(z.object({ id: z.string().min(1).max(64) })).query(async ({ input, ctx }) => {
      const r = await getOperation(await getMysqlOperationStore(), ctx.user.id, input.id);
      if (!r) throw new TRPCError({ code: "NOT_FOUND", message: "Operation not found." });
      return redactForClient(r);
    }),
  }),

  aiCore: router({
    capabilities: protectedProcedure.query(() => ({ ok: true as const, requestId: requestId(), data: getGatewayCapabilities() })),
    submit: protectedProcedure
      .input(aiCoreRequestSchema)
      .mutation(async ({ input, ctx }) => redactForClient(await submitGatewayRequest(ctx.user.id, input))),
    getRun: protectedProcedure
      .input(z.object({ runId: z.string().min(1) }))
      .query(async ({ input, ctx }) => redactForClient(await getGatewayRun(ctx.user.id, input.runId))),
    listRuns: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(30) }).default({ limit: 30 }))
      .query(async ({ input, ctx }) => redactForClient(await listGatewayRuns(ctx.user.id, input.limit))),
    getRunDetails: protectedProcedure
      .input(z.object({ runId: z.string().min(1) }))
      .query(async ({ input, ctx }) => redactForClient(await getGatewayRunDetails(ctx.user.id, input.runId))),
    events: protectedProcedure
      .input(z.object({ runId: z.string().min(1) }))
      .query(({ input, ctx }) => getGatewayEvents(ctx.user.id, input.runId)),
    cancel: protectedProcedure
      .input(z.object({ runId: z.string().min(1) }))
      .mutation(({ input, ctx }) => runControlCall(() => cancelGatewayRun(ctx.user.id, input.runId))),
    retry: protectedProcedure
      .input(z.object({ runId: z.string().min(1) }))
      .mutation(({ input, ctx }) => runControlCall(() => retryGatewayRun(ctx.user.id, input.runId))),
    deadLetters: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(30) }).default({ limit: 30 }))
      .query(({ input, ctx }) => listGatewayDeadLetters(ctx.user.id, input.limit)),
    recoverExpiredLeases: protectedProcedure
      .mutation(({ ctx }) => recoverGatewayExpiredLeases(ctx.user.id)),
  }),

  liveBuilder: router({
    list: protectedProcedure.query(async ({ ctx }) => ({
      ok: true as const,
      requestId: requestId(),
      data: await listLiveBuilderWorkspaces(ctx.user.id),
    })),
    create: protectedProcedure
      .input(z.object({
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(4_000).nullable().optional(),
        kind: z.enum(["website", "mobile_app", "workflow", "api"]),
        existingProjectId: z.string().min(1).nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => ({
        ok: true as const,
        requestId: requestId(),
        data: await createLiveBuilderWorkspace(ctx.user.id, input),
      })),
    get: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid() }))
      .query(async ({ input, ctx }) => ({
        ok: true as const,
        requestId: requestId(),
        data: await getLiveBuilderWorkspace(ctx.user.id, input.workspaceId),
      })),
    selectElement: protectedProcedure
      .input(z.object({
        workspaceId: z.string().uuid(),
        selection: z.object({
          elementId: z.string().min(1).max(160),
          label: z.string().min(1).max(160),
          filePath: z.string().min(1).max(500),
          componentName: z.string().max(160).nullable().default(null),
          properties: z.record(z.string(), z.unknown()).default({}),
        }).nullable(),
      }))
      .mutation(async ({ input, ctx }) => ({
        ok: true as const,
        requestId: requestId(),
        data: await liveBuilderCall(() => setLiveBuilderSelection(ctx.user.id, input.workspaceId, input.selection)),
      })),
    proposeChange: protectedProcedure
      .input(z.object({
        workspaceId: z.string().uuid(),
        prompt: z.string().trim().min(3).max(8_000),
        selectedElement: z.object({
          elementId: z.string().min(1).max(160),
          label: z.string().min(1).max(160),
          filePath: z.string().min(1).max(500),
          componentName: z.string().max(160).nullable().default(null),
          properties: z.record(z.string(), z.unknown()).default({}),
        }).nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => ({
        ok: true as const,
        requestId: requestId(),
        data: await liveBuilderCall(() => proposeLiveBuilderPromptChange(ctx.user.id, input)),
      })),
    applyChange: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid(), changeSetId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => ({
        ok: true as const,
        requestId: requestId(),
        data: await liveBuilderCall(() => applyLiveBuilderChangeSet(ctx.user.id, input.workspaceId, input.changeSetId)),
      })),
    rejectChange: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid(), changeSetId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => ({
        ok: true as const,
        requestId: requestId(),
        data: await liveBuilderCall(() => rejectLiveBuilderChangeSet(ctx.user.id, input.workspaceId, input.changeSetId)),
      })),
    integrity: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid() }))
      .query(async ({ input, ctx }) => ({ ok: true as const, requestId: requestId(), data: await liveBuilderCall(() => verifyLiveBuilderIntegrity(ctx.user.id, input.workspaceId)) })),
    recover: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => ({ ok: true as const, requestId: requestId(), data: await liveBuilderCall(() => recoverLiveBuilderWorkspace(ctx.user.id, input.workspaceId)) })),
    proposeFileChange: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid(), filePath: z.string().min(1).max(500), content: z.string().max(500_000), summary: z.string().trim().max(500).nullable().optional() }))
      .mutation(async ({ input, ctx }) => ({
        ok: true as const,
        requestId: requestId(),
        data: await liveBuilderCall(() => proposeLiveBuilderFileChange(ctx.user.id, input)),
      })),
    restoreVersion: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid(), versionId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => ({
        ok: true as const,
        requestId: requestId(),
        data: await liveBuilderCall(() => restoreLiveBuilderVersion(ctx.user.id, input.workspaceId, input.versionId)),
      })),
    startPreview: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid(), target: z.enum(["phone", "tablet", "laptop", "desktop"]), engine: z.enum(["controlled_canvas", "external_runner"]).default("controlled_canvas") }))
      .mutation(async ({ input, ctx }) => ({
        ok: true as const,
        requestId: requestId(),
        data: await liveBuilderCall(() => startLiveBuilderPreview(ctx.user.id, input.workspaceId, input.target, input.engine)),
      })),
    startRuntime: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid(), target: z.enum(["phone", "tablet", "laptop", "desktop"]), engine: z.enum(["controlled_canvas", "external_runner"]).default("external_runner"), versionId: z.string().uuid().nullable().optional() }))
      .mutation(async ({ input, ctx }) => ({ ok: true as const, requestId: requestId(), data: await liveBuilderCall(() => startLiveBuilderRuntime(ctx.user.id, input)) })),
    stopRuntime: protectedProcedure
      .input(z.object({ sessionId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => ({ ok: true as const, requestId: requestId(), data: await liveBuilderCall(() => stopLiveBuilderRuntime(ctx.user.id, input.sessionId)) })),
    restartRuntime: protectedProcedure
      .input(z.object({ sessionId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => ({ ok: true as const, requestId: requestId(), data: await liveBuilderCall(() => restartLiveBuilderRuntime(ctx.user.id, input.sessionId)) })),
    rebuildRuntime: protectedProcedure
      .input(z.object({ sessionId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => ({ ok: true as const, requestId: requestId(), data: await liveBuilderCall(() => rebuildLiveBuilderRuntime(ctx.user.id, input.sessionId)) })),
    getRuntime: protectedProcedure
      .input(z.object({ sessionId: z.string().uuid() }))
      .query(async ({ input, ctx }) => ({ ok: true as const, requestId: requestId(), data: await liveBuilderCall(() => getLiveBuilderRuntime(ctx.user.id, input.sessionId)) })),
    listRuntimes: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid() }))
      .query(async ({ input, ctx }) => ({ ok: true as const, requestId: requestId(), data: await liveBuilderCall(() => listLiveBuilderRuntimes(ctx.user.id, input.workspaceId)) })),
    runtimeEvents: protectedProcedure
      .input(z.object({ sessionId: z.string().uuid() }))
      .query(async ({ input, ctx }) => ({ ok: true as const, requestId: requestId(), data: await liveBuilderCall(() => listRuntimeEvents(ctx.user.id, input.sessionId)) })),
    runnerStatus: protectedProcedure.query(() => ({
      ok: true as const,
      requestId: requestId(),
      data: {
        metrics: defaultRunnerControlPlane.metrics(),
        providers: {
          development: { configured: true, mode: "controlled_canvas" as const },
          container: { configured: new ContainerProvider().configured, mode: "external_sandbox" as const },
          microvm: { configured: new MicroVMProvider().configured, mode: "external_sandbox" as const },
        },
        policy: defaultRunnerControlPlane.policySnapshot(),
      },
    })),
    createPreviewSession: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid(), versionId: z.string().uuid().nullable().optional(), runtimeSessionId: z.string().uuid().nullable().optional(), ttlMs: z.number().int().min(30_000).max(3_600_000).optional() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const data = await defaultPreviewGateway.createVerified({ userId: ctx.user.id, ...input }, {
            workspaceOwned: async (userId, workspaceId) => (await getLiveBuilderWorkspace(userId, workspaceId)) !== null,
            // Newest 50 versions (what getLiveBuilderWorkspace returns); older versions must be restored first.
            versionInWorkspace: async (userId, workspaceId, versionId) => Boolean((await getLiveBuilderWorkspace(userId, workspaceId))?.versions.some((v) => v.id === versionId)),
            runtimeInWorkspace: async (userId, workspaceId, sessionId) => { try { return (await getLiveBuilderRuntime(userId, sessionId)).session.workspaceId === workspaceId; } catch { return false; } },
          });
          return { ok: true as const, requestId: requestId(), data };
        } catch (e) {
          if (e instanceof PreviewOwnershipError) throw new TRPCError({ code: "NOT_FOUND", message: e.message });
          throw e;
        }
      }),
    revokePreviewSession: protectedProcedure
      .input(z.object({ sessionId: z.string().min(1) }))
      .mutation(({ input, ctx }) => {
        try { return { ok: true as const, requestId: requestId(), data: defaultPreviewGateway.revoke(ctx.user.id, input.sessionId) }; }
        catch (e) { throw new TRPCError({ code: "NOT_FOUND", message: e instanceof Error ? e.message : "Preview session not found" }); }
      }),
    validate: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid(), target: z.enum(["phone", "tablet", "laptop", "desktop"]), changeSetId: z.string().uuid().nullable().optional() }))
      .mutation(async ({ input, ctx }) => ({
        ok: true as const,
        requestId: requestId(),
        data: await liveBuilderCall(() => validateLiveBuilderWorkspace(ctx.user.id, input.workspaceId, input.target, input.changeSetId)),
      })),
    requestDeployment: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid(), versionId: z.string().uuid(), releaseNotes: z.string().trim().max(4_000).nullable().optional() }))
      .mutation(async ({ input, ctx }) => ({
        ok: true as const,
        requestId: requestId(),
        data: await liveBuilderCall(() => requestLiveBuilderDeployment(ctx.user.id, input.workspaceId, input.versionId, input.releaseNotes)),
      })),
  }),

  assistant: router({
    createTask: protectedProcedure
      .input(z.object({ title: z.string().min(1).max(255), projectId: z.string().min(1).nullable().default(null), requiresApproval: z.boolean().default(false) }))
      .mutation(async ({ input, ctx }) => {
        if (input.projectId && !(await userOwnsProject(ctx.user.id, input.projectId))) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
        const id = `task_${crypto.randomUUID()}`;
        const created = await insertAgentTask({ id, userId: ctx.user.id, projectId: input.projectId, title: input.title, state: "queued", progress: 0, requiresApproval: input.requiresApproval, currentApprovalId: null, lastError: null, checkpoint: null });
        if (!created) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Task storage is unavailable." });
        return { ok: true as const, requestId: requestId(), data: created };
      }),
    listTasks: protectedProcedure.query(async ({ ctx }) => ({ ok: true as const, requestId: requestId(), data: await listAgentTasks(ctx.user.id) })),
    transition: protectedProcedure
      .input(z.object({ taskId: z.string().min(1), nextState: taskStateSchema, progress: z.number().min(0).max(100).optional(), checkpoint: z.string().nullable().optional(), lastError: z.string().nullable().optional() }))
      .mutation(async ({ input, ctx }) => {
        const existing = (await listAgentTasks(ctx.user.id)).find((task) => task.id === input.taskId);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
        if (!canTransitionTask(existing.state, input.nextState)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Invalid task transition: ${existing.state} -> ${input.nextState}` });
        const converted = agentTaskSchema.parse({ id: existing.id, ownerId: existing.userId, projectId: existing.projectId ?? null, title: existing.title, state: existing.state, progress: existing.progress, requiresApproval: existing.requiresApproval, currentApprovalId: existing.currentApprovalId ?? null, lastError: existing.lastError ?? null, checkpoint: existing.checkpoint ?? null, createdAt: existing.createdAt, updatedAt: existing.updatedAt });
        const next = transitionTask(converted, input.nextState, { progress: input.progress, checkpoint: input.checkpoint, lastError: input.lastError });
        // Compare-and-set on the state validated above: a concurrent transition from another client makes this one a conflict, not a blind overwrite.
        const result = await transitionAgentTask(input.taskId, ctx.user.id, existing.state, { state: next.state, progress: next.progress, checkpoint: next.checkpoint, lastError: next.lastError });
        if (!result) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Task storage is unavailable." });
        if (!result.applied) throw new TRPCError({ code: "CONFLICT", message: "The task changed state while you were updating it. Refresh and try again." });
        return { ok: true as const, requestId: requestId(), data: result.task };
      }),
    requestApproval: protectedProcedure
      .input(z.object({ taskId: z.string().min(1), action: approvalActionSchema, summary: z.string().min(1).max(2000) }))
      .mutation(async ({ input, ctx }) => {
        const task = (await listAgentTasks(ctx.user.id)).find((item) => item.id === input.taskId);
        if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
        const approvalId = `approval_${crypto.randomUUID()}`;
        const approval = await insertTaskApproval({ id: approvalId, taskId: input.taskId, userId: ctx.user.id, action: input.action, summary: input.summary, status: "pending", requestedAt: new Date(), resolvedAt: null });
        if (!approval) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Approval storage is unavailable." });
        await updateAgentTask(input.taskId, ctx.user.id, { state: "waiting_for_user", currentApprovalId: approvalId });
        return { ok: true as const, requestId: requestId(), data: approval };
      }),
    resolveApproval: protectedProcedure
      .input(z.object({ approvalId: z.string().min(1), decision: z.enum(["approved", "rejected"]) }))
      .mutation(async ({ input, ctx }) => {
        const result = await resolveTaskApproval(input.approvalId, ctx.user.id, input.decision, (a) => resumeApprovedTask(ctx.user.id, a.taskId));
        if (!result) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Approval storage is unavailable." });
        // Foreign and unknown ids are indistinguishable; a different already-recorded decision is a conflict; neither changes anything or starts work.
        const failure = approvalOutcomeError(result.outcome);
        if (failure) throw new TRPCError(failure);
        const approval = (result.outcome as { approval: unknown }).approval;
        const resumed = result.resumed;
        return { ok: true as const, requestId: requestId(), data: { approval, resumed } };
      }),
  }),
  credits: router({
    ledger: protectedProcedure.query(async ({ ctx }) => ({ ok: true as const, requestId: requestId(), data: await listCreditLedger(ctx.user.id) })),
    entitlements: protectedProcedure.query(async ({ ctx }) => ({ ok: true as const, requestId: requestId(), data: await listEntitlements(ctx.user.id) })),
    // Operator-only: usage must be metered by the server, never reported by a client.
    // (Server-side metering inside AI Core + an atomic ledger is still on the roadmap: GO-AIC-006/007.)
    recordUsage: adminProcedure
      .input(z.object({ capability: z.string().min(1).max(100), units: z.number().positive(), creditsCharged: z.number().positive(), requestId: z.string().min(1).max(64) }))
      .mutation(async ({ input, ctx }) => {
        const store = await getMysqlCreditStore();
        try {
          const r = await reserveCredits(store, { userId: ctx.user.id, requestId: `usage:${input.requestId}`.slice(0, 64), capability: input.capability, credits: input.creditsCharged, id: `res_${crypto.randomUUID()}`.slice(0, 64) });
          const done = await finalizeReservation(store, r.id, input.creditsCharged);
          return { ok: true as const, requestId: requestId(), data: { charged: done.charged / 1_000_000, status: done.status } };
        } catch (e) {
          if (e instanceof CreditError && e.code === "INSUFFICIENT_CREDITS") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Insufficient credits." });
          throw e;
        }
      }),
    grant: protectedProcedure
      .input(z.object({ amount: z.number().positive(), kind: z.enum(["grant", "purchase", "refund", "adjustment"]), referenceId: z.string().max(64).nullable().default(null) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Credit grants require an administrator or trusted billing callback." });
        }
        const out = await grantCredits(await getMysqlCreditStore(), { userId: ctx.user.id, credits: input.amount, kind: input.kind, referenceId: input.referenceId ?? `admin_${crypto.randomUUID()}`.slice(0, 60) });
        return { ok: true as const, requestId: requestId(), data: out };
      }),
  }),

  // AI Builder Routers
  aiBuilder: aiBuilderRouter,
  devPreview: devPreviewRouter,
  appBuilder: appBuilderRouter,
  websiteBuilder: websiteBuilderRouter,
  workflowBuilder: workflowBuilderRouter,
  databaseBuilder: databaseBuilderRouter,
  aiAgentBuilder: aiAgentBuilderRouter,
  projectManagement: projectManagementRouter,
});

export type AppRouter = typeof appRouter;

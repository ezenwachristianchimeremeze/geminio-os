import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { findUsageRecord, insertAgentTask, insertCreditLedgerEntry, insertEntitlement, insertTaskApproval, insertUsageRecord, listAgentTasks, listCreditLedger, listEntitlements, listNotifications, markAllNotificationsRead, markNotificationRead, resolveTaskApproval, updateAgentTask } from "./geminio-data";
import { agentTaskSchema, approvalActionSchema, canTransitionTask, transitionTask, applyCreditDelta, taskStateSchema } from "../shared/geminio-contracts";
import { invokeLLM } from "./_core/llm";
import { aiCoreRequestSchema } from "../shared/geminio-contracts";
import { cancelGatewayRun, getGatewayCapabilities, getGatewayEvents, getGatewayRun, getGatewayRunDetails, listGatewayDeadLetters, listGatewayRuns, recoverGatewayExpiredLeases, retryGatewayRun, submitGatewayRequest } from "./ai-core/gateway";
import { resumeApprovedTask } from "./ai-core/orchestrator";
import { applyLiveBuilderChangeSet, createLiveBuilderWorkspace, getLiveBuilderWorkspace, listLiveBuilderWorkspaces, proposeLiveBuilderFileChange, proposeLiveBuilderPromptChange, requestLiveBuilderDeployment, restoreLiveBuilderVersion, setLiveBuilderSelection, startLiveBuilderPreview, validateLiveBuilderWorkspace } from "./live-builder/service";
import { getLiveBuilderRuntime, listLiveBuilderRuntimes, listRuntimeEvents, rebuildLiveBuilderRuntime, restartLiveBuilderRuntime, startLiveBuilderRuntime, stopLiveBuilderRuntime } from "./live-builder/runtime";
import { defaultRunnerControlPlane, ContainerProvider, MicroVMProvider } from "./live-builder/control-plane";
import { defaultPreviewGateway } from "./live-builder/preview-gateway";
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
  chat: router({
    // Send a message to the AI and get a response
    sendMessage: publicProcedure
      .input(
        z.object({
          message: z.string().min(1, "Message cannot be empty"),
          conversationId: z.string().min(1).nullable().default(null),
          conversationHistory: z
            .array(
              z.object({
                role: z.enum(["user", "assistant", "system"]),
                content: z.string(),
              })
            )
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

          const response = await invokeLLM({
            messages: [
              { role: "system", content: "You are Geminio, a helpful AI personal assistant. Be concise, friendly, and truthful about unavailable actions." },
              ...input.conversationHistory,
              { role: "user", content: input.message },
            ],
            model: "gpt-5-mini",
          });
          return {
            success: true,
            response: response.choices[0]?.message?.content || "I couldn't process that request.",
            timestamp: new Date(),
            runId: null,
            taskId: null,
            conversationId: null,
            status: "completed" as const,
            error: null,
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
  }),

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

  aiCore: router({
    capabilities: protectedProcedure.query(() => ({ ok: true as const, requestId: requestId(), data: getGatewayCapabilities() })),
    submit: protectedProcedure
      .input(aiCoreRequestSchema)
      .mutation(({ input, ctx }) => submitGatewayRequest(ctx.user.id, input)),
    getRun: protectedProcedure
      .input(z.object({ runId: z.string().min(1) }))
      .query(({ input, ctx }) => getGatewayRun(ctx.user.id, input.runId)),
    listRuns: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(30) }).default({ limit: 30 }))
      .query(({ input, ctx }) => listGatewayRuns(ctx.user.id, input.limit)),
    getRunDetails: protectedProcedure
      .input(z.object({ runId: z.string().min(1) }))
      .query(({ input, ctx }) => getGatewayRunDetails(ctx.user.id, input.runId)),
    events: protectedProcedure
      .input(z.object({ runId: z.string().min(1) }))
      .query(({ input, ctx }) => getGatewayEvents(ctx.user.id, input.runId)),
    cancel: protectedProcedure
      .input(z.object({ runId: z.string().min(1) }))
      .mutation(({ input, ctx }) => cancelGatewayRun(ctx.user.id, input.runId)),
    retry: protectedProcedure
      .input(z.object({ runId: z.string().min(1) }))
      .mutation(({ input, ctx }) => retryGatewayRun(ctx.user.id, input.runId)),
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
        data: await setLiveBuilderSelection(ctx.user.id, input.workspaceId, input.selection),
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
        data: await proposeLiveBuilderPromptChange(ctx.user.id, input),
      })),
    applyChange: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid(), changeSetId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => ({
        ok: true as const,
        requestId: requestId(),
        data: await applyLiveBuilderChangeSet(ctx.user.id, input.workspaceId, input.changeSetId),
      })),
    proposeFileChange: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid(), filePath: z.string().min(1).max(500), content: z.string().max(500_000), summary: z.string().trim().max(500).nullable().optional() }))
      .mutation(async ({ input, ctx }) => ({
        ok: true as const,
        requestId: requestId(),
        data: await proposeLiveBuilderFileChange(ctx.user.id, input),
      })),
    restoreVersion: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid(), versionId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => ({
        ok: true as const,
        requestId: requestId(),
        data: await restoreLiveBuilderVersion(ctx.user.id, input.workspaceId, input.versionId),
      })),
    startPreview: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid(), target: z.enum(["phone", "tablet", "laptop", "desktop"]), engine: z.enum(["controlled_canvas", "external_runner"]).default("controlled_canvas") }))
      .mutation(async ({ input, ctx }) => ({
        ok: true as const,
        requestId: requestId(),
        data: await startLiveBuilderPreview(ctx.user.id, input.workspaceId, input.target, input.engine),
      })),
    startRuntime: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid(), target: z.enum(["phone", "tablet", "laptop", "desktop"]), engine: z.enum(["controlled_canvas", "external_runner"]).default("external_runner"), versionId: z.string().uuid().nullable().optional() }))
      .mutation(async ({ input, ctx }) => ({ ok: true as const, requestId: requestId(), data: await startLiveBuilderRuntime(ctx.user.id, input) })),
    stopRuntime: protectedProcedure
      .input(z.object({ sessionId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => ({ ok: true as const, requestId: requestId(), data: await stopLiveBuilderRuntime(ctx.user.id, input.sessionId) })),
    restartRuntime: protectedProcedure
      .input(z.object({ sessionId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => ({ ok: true as const, requestId: requestId(), data: await restartLiveBuilderRuntime(ctx.user.id, input.sessionId) })),
    rebuildRuntime: protectedProcedure
      .input(z.object({ sessionId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => ({ ok: true as const, requestId: requestId(), data: await rebuildLiveBuilderRuntime(ctx.user.id, input.sessionId) })),
    getRuntime: protectedProcedure
      .input(z.object({ sessionId: z.string().uuid() }))
      .query(async ({ input, ctx }) => ({ ok: true as const, requestId: requestId(), data: await getLiveBuilderRuntime(ctx.user.id, input.sessionId) })),
    listRuntimes: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid() }))
      .query(async ({ input, ctx }) => ({ ok: true as const, requestId: requestId(), data: await listLiveBuilderRuntimes(ctx.user.id, input.workspaceId) })),
    runtimeEvents: protectedProcedure
      .input(z.object({ sessionId: z.string().uuid() }))
      .query(async ({ input, ctx }) => ({ ok: true as const, requestId: requestId(), data: await listRuntimeEvents(ctx.user.id, input.sessionId) })),
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
      .mutation(({ input, ctx }) => ({ ok: true as const, requestId: requestId(), data: defaultPreviewGateway.create({ userId: ctx.user.id, ...input }) })),
    revokePreviewSession: protectedProcedure
      .input(z.object({ sessionId: z.string().min(1) }))
      .mutation(({ input, ctx }) => ({ ok: true as const, requestId: requestId(), data: defaultPreviewGateway.revoke(ctx.user.id, input.sessionId) })),
    validate: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid(), target: z.enum(["phone", "tablet", "laptop", "desktop"]), changeSetId: z.string().uuid().nullable().optional() }))
      .mutation(async ({ input, ctx }) => ({
        ok: true as const,
        requestId: requestId(),
        data: await validateLiveBuilderWorkspace(ctx.user.id, input.workspaceId, input.target, input.changeSetId),
      })),
    requestDeployment: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid(), versionId: z.string().uuid(), releaseNotes: z.string().trim().max(4_000).nullable().optional() }))
      .mutation(async ({ input, ctx }) => ({
        ok: true as const,
        requestId: requestId(),
        data: await requestLiveBuilderDeployment(ctx.user.id, input.workspaceId, input.versionId, input.releaseNotes),
      })),
  }),

  assistant: router({
    createTask: protectedProcedure
      .input(z.object({ title: z.string().min(1).max(255), projectId: z.string().min(1).nullable().default(null), requiresApproval: z.boolean().default(false) }))
      .mutation(async ({ input, ctx }) => {
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
        const updated = await updateAgentTask(input.taskId, ctx.user.id, { state: next.state, progress: next.progress, checkpoint: next.checkpoint, lastError: next.lastError });
        if (!updated) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Task storage is unavailable." });
        return { ok: true as const, requestId: requestId(), data: updated };
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
        const approval = await resolveTaskApproval(input.approvalId, ctx.user.id, input.decision);
        if (!approval) throw new TRPCError({ code: "NOT_FOUND", message: "Approval not found." });
        const resumed = input.decision === "approved" ? await resumeApprovedTask(ctx.user.id, approval.taskId) : null;
        return { ok: true as const, requestId: requestId(), data: { approval, resumed } };
      }),
  }),
  credits: router({
    ledger: protectedProcedure.query(async ({ ctx }) => ({ ok: true as const, requestId: requestId(), data: await listCreditLedger(ctx.user.id) })),
    entitlements: protectedProcedure.query(async ({ ctx }) => ({ ok: true as const, requestId: requestId(), data: await listEntitlements(ctx.user.id) })),
    recordUsage: protectedProcedure
      .input(z.object({ capability: z.string().min(1).max(100), units: z.number().positive(), creditsCharged: z.number().positive(), requestId: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const existingUsage = await findUsageRecord(ctx.user.id, input.requestId);
        if (existingUsage) {
          return { ok: true as const, requestId: requestId(), data: { ledgerEntry: null, usage: existingUsage, replayed: true as const } };
        }
        const ledger = await listCreditLedger(ctx.user.id);
        const currentBalance = ledger[0] ? Number(ledger[0].balanceAfter) : 0;
        let nextBalance: number;
        try { nextBalance = applyCreditDelta(currentBalance, -input.creditsCharged); } catch { throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Insufficient credits." }); }
        const ledgerEntry = await insertCreditLedgerEntry({ id: `credit_${crypto.randomUUID()}`, userId: ctx.user.id, kind: "usage", amount: (-input.creditsCharged).toFixed(6), balanceAfter: nextBalance.toFixed(6), capability: input.capability, referenceId: input.requestId, createdAt: new Date() });
        const usage = await insertUsageRecord({ id: `usage_${crypto.randomUUID()}`, userId: ctx.user.id, capability: input.capability, units: input.units.toFixed(6), creditsCharged: input.creditsCharged.toFixed(6), requestId: input.requestId, createdAt: new Date() });
        if (!ledgerEntry || !usage) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Usage storage is unavailable." });
        return { ok: true as const, requestId: requestId(), data: { ledgerEntry, usage } };
      }),
    grant: protectedProcedure
      .input(z.object({ amount: z.number().positive(), kind: z.enum(["grant", "purchase", "refund", "adjustment"]), referenceId: z.string().nullable().default(null) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Credit grants require an administrator or trusted billing callback." });
        }
        const ledger = await listCreditLedger(ctx.user.id);
        const currentBalance = ledger[0] ? Number(ledger[0].balanceAfter) : 0;
        const nextBalance = applyCreditDelta(currentBalance, input.amount);
        const entry = await insertCreditLedgerEntry({ id: `credit_${crypto.randomUUID()}`, userId: ctx.user.id, kind: input.kind, amount: input.amount.toFixed(6), balanceAfter: nextBalance.toFixed(6), capability: null, referenceId: input.referenceId, createdAt: new Date() });
        if (!entry) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Credit storage is unavailable." });
        return { ok: true as const, requestId: requestId(), data: entry };
      }),
  }),

  // AI Builder Routers
  appBuilder: appBuilderRouter,
  websiteBuilder: websiteBuilderRouter,
  workflowBuilder: workflowBuilderRouter,
  databaseBuilder: databaseBuilderRouter,
  aiAgentBuilder: aiAgentBuilderRouter,
  projectManagement: projectManagementRouter,
});

export type AppRouter = typeof appRouter;

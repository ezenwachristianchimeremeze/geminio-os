import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  analyzeBuilderWorkspace,
  BuilderConflictError,
  cancelBuilderOperation,
  confirmCodeApplied,
  createBuilderProject,
  generateCode,
  generatePlan,
  generateRequirements,
  getBuilderProject,
  listBuilderProjects,
  recoverStaleBuilderOperations,
  requestBuilderDeployment,
  runBuilderValidation,
} from "./service";

const id = z.string().min(1).max(64);

function map<T>(run: () => Promise<T>) {
  return run().catch((error: unknown) => {
    if (error instanceof BuilderConflictError) throw new TRPCError({ code: "CONFLICT", message: error.message });
    if (error instanceof TRPCError) throw error;
    const message = error instanceof Error ? error.message : "AI Builder operation failed.";
    // Ownership failures and validation failures are user-facing; provider outages are 503.
    const code = /unavailable|not configured|No AI provider|No configured AI provider/i.test(message) ? "SERVICE_UNAVAILABLE" : /rate limit/i.test(message) ? "TOO_MANY_REQUESTS" : /does not belong|not available at stage|Invalid AI Builder transition|Generate .* before|only be requested/i.test(message) ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR";
    throw new TRPCError({ code, message });
  });
}

export const aiBuilderRouter = router({
  list: protectedProcedure.query(({ ctx }) => map(() => listBuilderProjects(ctx.user.id))),
  get: protectedProcedure.input(z.object({ id })).query(({ ctx, input }) => map(() => getBuilderProject(ctx.user.id, input.id))),
  create: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(120), prompt: z.string().trim().min(10).max(20_000), kind: z.enum(["website", "mobile_app", "workflow", "api"]) }))
    .mutation(({ ctx, input }) => map(() => createBuilderProject(ctx.user.id, input))),
  generateRequirements: protectedProcedure.input(z.object({ id })).mutation(({ ctx, input }) => map(() => generateRequirements(ctx.user.id, input.id))),
  generatePlan: protectedProcedure.input(z.object({ id })).mutation(({ ctx, input }) => map(() => generatePlan(ctx.user.id, input.id))),
  generateCode: protectedProcedure.input(z.object({ id })).mutation(({ ctx, input }) => map(() => generateCode(ctx.user.id, input.id))),
  confirmCodeApplied: protectedProcedure.input(z.object({ id, changeSetId: id })).mutation(({ ctx, input }) => map(() => confirmCodeApplied(ctx.user.id, input.id, input.changeSetId))),
  analyze: protectedProcedure.input(z.object({ id })).mutation(({ ctx, input }) => map(() => analyzeBuilderWorkspace(ctx.user.id, input.id))),
  validate: protectedProcedure.input(z.object({ id, target: z.enum(["phone", "tablet", "laptop", "desktop"]).default("phone") })).mutation(({ ctx, input }) => map(() => runBuilderValidation(ctx.user.id, input.id, input.target))),
  requestDeployment: protectedProcedure.input(z.object({ id, versionId: id, releaseNotes: z.string().max(4000).nullable().default(null) })).mutation(({ ctx, input }) => map(() => requestBuilderDeployment(ctx.user.id, input.id, input.versionId, input.releaseNotes))),
  cancel: protectedProcedure.input(z.object({ id })).mutation(({ ctx, input }) => map(() => cancelBuilderOperation(ctx.user.id, input.id))),
  recover: protectedProcedure.mutation(({ ctx }) => map(() => recoverStaleBuilderOperations(ctx.user.id))),
});

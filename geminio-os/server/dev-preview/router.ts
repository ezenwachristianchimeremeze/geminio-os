import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../_core/trpc";
import { readActivity } from "./activity";
import { computeProgress } from "./progress";
import { getDevPreviewSupervisor } from "./supervisor";

/**
 * Developer preview controls. Admin only, and only operational when
 * GEMINIO_DEV_PREVIEW=1 outside production. No input reaches a command line.
 */
const ACTIVITY_FILE = () => join(process.cwd(), ".geminio", "dev-activity.jsonl");
const MATRIX_FILE = () => join(process.cwd(), "BLUEPRINT_IMPLEMENTATION_MATRIX.md");

function wrap<T>(run: () => Promise<T> | T): Promise<T> {
  return Promise.resolve()
    .then(run)
    .catch((error: unknown) => {
      if (error instanceof TRPCError) throw error;
      const message = error instanceof Error ? error.message : "Preview operation failed.";
      throw new TRPCError({ code: /disabled/i.test(message) ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR", message });
    });
}

export const devPreviewRouter = router({
  status: adminProcedure.query(() => getDevPreviewSupervisor().status()),
  start: adminProcedure.mutation(({ ctx }) => wrap(() => getDevPreviewSupervisor().start(ctx.user.id))),
  restart: adminProcedure.mutation(({ ctx }) => wrap(() => getDevPreviewSupervisor().restart(ctx.user.id))),
  stop: adminProcedure.mutation(() => wrap(() => getDevPreviewSupervisor().stop())),
  refresh: adminProcedure.mutation(() => wrap(() => getDevPreviewSupervisor().refresh())),
  activity: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).default({ limit: 50 })).query(({ input }) => ({ entries: readActivity(ACTIVITY_FILE(), input.limit) })),
  /** Progress is computed on every call from the matrix file; nothing is cached or stored. */
  progress: adminProcedure.query(() => {
    const file = MATRIX_FILE();
    if (!existsSync(file)) return { available: false as const, reason: "BLUEPRINT_IMPLEMENTATION_MATRIX.md was not found in the server working directory." };
    return { available: true as const, ...computeProgress(readFileSync(file, "utf8")) };
  }),
});

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { liveBuilderPreviewGatewaySessions, runnerExecutionLogs, runnerJobs } from "../../drizzle/schema";
import { getDb } from "../db";
import { SAFE_DEFAULT_EXECUTION_POLICY, type RunnerJobState } from "./control-plane";

type RuntimeEngine = "controlled_canvas" | "external_runner";

function providerFor(engine: RuntimeEngine): "development" | "container" | "microvm" {
  if (engine === "controlled_canvas") return "development";
  return process.env.GEMINIO_RUNNER_PROVIDER === "microvm" ? "microvm" : "container";
}

export async function createPersistedRunnerJob(input: { userId: number; workspaceId: string; projectId: string; versionId: string | null; runtimeSessionId: string; engine: RuntimeEngine }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const id = randomUUID();
  await db.insert(runnerJobs).values({ id, userId: input.userId, workspaceId: input.workspaceId, projectId: input.projectId, versionId: input.versionId, runtimeSessionId: input.runtimeSessionId, provider: providerFor(input.engine), state: "created", attempt: 0, maxAttempts: 3, workerId: null, leaseExpiresAt: null, policy: SAFE_DEFAULT_EXECUTION_POLICY, lastError: null });
  return id;
}

export async function updatePersistedRunnerJob(jobId: string, state: RunnerJobState, patch: { workerId?: string | null; leaseExpiresAt?: Date | null; lastError?: string | null; attempt?: number } = {}) {
  const db = await getDb();
  if (!db) return;
  await db.update(runnerJobs).set({ state, ...patch, updatedAt: new Date() }).where(eq(runnerJobs.id, jobId));
}

export async function appendPersistedRunnerLog(input: { jobId: string; projectId: string; versionId: string | null; phase: RunnerJobState; severity: "info" | "warning" | "error"; workerId?: string | null; message: string; errorCode?: string | null; diagnostics?: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(runnerExecutionLogs).values({ id: randomUUID(), jobId: input.jobId, projectId: input.projectId, versionId: input.versionId, phase: input.phase, severity: input.severity, workerId: input.workerId ?? null, message: input.message, errorCode: input.errorCode ?? null, diagnostics: input.diagnostics ?? {} });
}

export async function createPersistedPreviewGatewaySession(input: { userId: number; workspaceId: string; versionId: string | null; runtimeSessionId: string; ttlMs?: number }) {
  const db = await getDb();
  if (!db) return null;
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? 15 * 60_000));
  await db.insert(liveBuilderPreviewGatewaySessions).values({ id, userId: input.userId, workspaceId: input.workspaceId, versionId: input.versionId, runtimeSessionId: input.runtimeSessionId, authState: "authenticated", expiresAt });
  return { id, expiresAt: expiresAt.toISOString() };
}

export async function revokePersistedPreviewGatewaySession(userId: number, sessionId: string) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(liveBuilderPreviewGatewaySessions).set({ authState: "revoked", updatedAt: new Date() }).where(and(eq(liveBuilderPreviewGatewaySessions.id, sessionId), eq(liveBuilderPreviewGatewaySessions.userId, userId)));
  return result[0]?.affectedRows > 0;
}

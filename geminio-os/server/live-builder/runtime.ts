import { and, desc, eq, inArray } from "drizzle-orm";
import {
  liveBuilderRuntimeEvents,
  liveBuilderRuntimeSessions,
  liveBuilderWorkspaces,
} from "../../drizzle/schema";
import {
  liveBuilderRuntimeDiagnosticSchema,
  liveBuilderRuntimeEventSchema,
  liveBuilderRuntimeSessionSchema,
  type LiveBuilderRuntimeEvent,
  type LiveBuilderRuntimeSession,
  type LiveBuilderRuntimeStartInput,
} from "../../shared/geminio-contracts";
import { getDb } from "../db";
import { getLiveBuilderWorkspace } from "./service";
import { createProjectRunner, startRunnerSafely } from "./runner";
import { assertVersionInWorkspace } from "./runtime-guard";
import { ChangeSetError } from "./atomic-apply";
import { appendPersistedRunnerLog, createPersistedPreviewGatewaySession, createPersistedRunnerJob, updatePersistedRunnerJob } from "./persistence";
import { randomUUID } from "node:crypto";
import { insertNotification } from "../geminio-data";

type RuntimeUserId = number;

type RuntimeRecord = typeof liveBuilderRuntimeSessions.$inferSelect;

function iso(date: Date | null): string {
  return (date ?? new Date()).toISOString();
}

function asSession(record: RuntimeRecord): LiveBuilderRuntimeSession {
  return liveBuilderRuntimeSessionSchema.parse({
    id: record.id,
    workspaceId: record.workspaceId,
    versionId: record.versionId,
    target: record.target,
    engine: record.engine,
    status: record.status,
    url: record.url,
    isolation: record.isolation,
    outputMode: record.outputMode,
    lastError: record.lastError,
    updatedAt: iso(record.updatedAt),
  });
}

async function ownedSession(userId: RuntimeUserId, sessionId: string): Promise<RuntimeRecord> {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const rows = await db
    .select({ session: liveBuilderRuntimeSessions })
    .from(liveBuilderRuntimeSessions)
    .innerJoin(liveBuilderWorkspaces, eq(liveBuilderRuntimeSessions.workspaceId, liveBuilderWorkspaces.id))
    .where(and(eq(liveBuilderRuntimeSessions.id, sessionId), eq(liveBuilderWorkspaces.userId, userId)))
    .limit(1);
  const session = rows[0]?.session;
  if (!session) throw new ChangeSetError("WORKSPACE_UNAVAILABLE", "Runtime session not found");
  return session;
}

async function appendEvent(sessionId: string, type: string, message: string, diagnostics: unknown[] = []): Promise<LiveBuilderRuntimeEvent> {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const previous = await db.select({ sequence: liveBuilderRuntimeEvents.sequence }).from(liveBuilderRuntimeEvents).where(eq(liveBuilderRuntimeEvents.sessionId, sessionId)).orderBy(desc(liveBuilderRuntimeEvents.sequence)).limit(1);
  const event = {
    id: randomUUID(),
    sessionId,
    sequence: (previous[0]?.sequence ?? 0) + 1,
    type,
    message,
    diagnostics: diagnostics.map((item) => liveBuilderRuntimeDiagnosticSchema.parse(item)),
    createdAt: new Date(),
  };
  await db.insert(liveBuilderRuntimeEvents).values(event);
  return liveBuilderRuntimeEventSchema.parse({ ...event, createdAt: event.createdAt.toISOString() });
}

/** `onlyIfStatus` makes the write a compare-and-set: a slow start must not overwrite a session the user stopped (or that already failed) in the meantime. */
async function updateSession(sessionId: string, patch: Partial<typeof liveBuilderRuntimeSessions.$inferInsert>, onlyIfStatus?: Array<typeof liveBuilderRuntimeSessions.$inferSelect["status"]>): Promise<LiveBuilderRuntimeSession> {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(liveBuilderRuntimeSessions).set({ ...patch, updatedAt: new Date() }).where(onlyIfStatus ? and(eq(liveBuilderRuntimeSessions.id, sessionId), inArray(liveBuilderRuntimeSessions.status, onlyIfStatus)) : eq(liveBuilderRuntimeSessions.id, sessionId));
  const record = (await db.select().from(liveBuilderRuntimeSessions).where(eq(liveBuilderRuntimeSessions.id, sessionId)).limit(1))[0];
  if (!record) throw new Error("Runtime session disappeared during update");
  return asSession(record);
}

export async function startLiveBuilderRuntime(userId: RuntimeUserId, input: LiveBuilderRuntimeStartInput) {
  const workspace = await getLiveBuilderWorkspace(userId, input.workspaceId);
  if (!workspace) throw new ChangeSetError("WORKSPACE_UNAVAILABLE", "Live Builder workspace not found");
  assertVersionInWorkspace(workspace.versions, input.versionId);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");

  const versionId = input.versionId ?? workspace.versions[0]?.id ?? null;
  const sessionId = randomUUID();
  await db.insert(liveBuilderRuntimeSessions).values({
    id: sessionId,
    workspaceId: input.workspaceId,
    versionId,
    target: input.target,
    engine: input.engine,
    status: "starting",
    isolation: input.engine === "external_runner" ? "unavailable" : "controlled_canvas",
    outputMode: input.engine === "external_runner" ? "unavailable" : "declarative",
    url: null,
    lastError: null,
    startedAt: new Date(),
  });
  const runnerJobId = await createPersistedRunnerJob({ userId, workspaceId: input.workspaceId, projectId: workspace.projectId, versionId, runtimeSessionId: sessionId, engine: input.engine });
  await updatePersistedRunnerJob(runnerJobId, "queued");
  await appendPersistedRunnerLog({ jobId: runnerJobId, projectId: workspace.projectId, versionId, phase: "queued", severity: "info", message: "Runner job queued behind the control-plane boundary." });
  await appendEvent(sessionId, "starting", "Runtime session is initializing in an isolated preview boundary.");

  await appendEvent(sessionId, "build_started", "Preparing the declarative preview document; no project source is executed in the main application process.");
  const runnerResult = await startRunnerSafely(createProjectRunner(input.engine), input);
  const unavailable = runnerResult.status !== "ready";
  await updatePersistedRunnerJob(runnerJobId, unavailable ? "failed" : runnerResult.status === "ready" ? "completed" : "failed", { lastError: unavailable ? runnerResult.message : null });
  await appendPersistedRunnerLog({ jobId: runnerJobId, projectId: workspace.projectId, versionId, phase: unavailable ? "failed" : "completed", severity: unavailable ? "warning" : "info", message: runnerResult.message, errorCode: runnerResult.diagnostics[0]?.code ?? null, diagnostics: { diagnostics: runnerResult.diagnostics } });
  const session = await updateSession(sessionId, {
    status: unavailable ? "failed" : runnerResult.status === "ready" ? "ready" : "failed",
    isolation: runnerResult.isolation,
    outputMode: runnerResult.outputMode,
    url: runnerResult.url,
    lastError: unavailable ? runnerResult.message : null,
    stoppedAt: unavailable ? new Date() : null,
  }, ["starting"]);
  const intended = unavailable ? "failed" : "ready";
  if (session.status !== intended) {
    // The session left "starting" while the runner was working (user stop/restart). The stop wins: no ready events, no gateway session, no notification.
    await appendEvent(sessionId, "start_superseded", `The runner finished but this session was already ${session.status}; its result was discarded.`);
    return { session, events: await listRuntimeEvents(userId, sessionId), fallback: workspace.preview, runner: runnerResult, runnerJobId, previewSession: null };
  }
  await appendEvent(sessionId, unavailable ? "build_failed" : "build_succeeded", runnerResult.message, runnerResult.diagnostics);
  await appendEvent(sessionId, unavailable ? "runtime_error" : "runtime_ready", runnerResult.message, runnerResult.diagnostics);
  const previewSession = runnerResult.status === "ready" ? await createPersistedPreviewGatewaySession({ userId, workspaceId: input.workspaceId, versionId, runtimeSessionId: sessionId }) : null;
  await insertNotification({
    id: randomUUID(),
    userId,
    title: unavailable ? "Runner unavailable" : "Build completed",
    message: unavailable ? "The configured external runner is unavailable. Your project, logs, and retry path were preserved." : `The ${input.target} preview runtime is ready behind the authenticated gateway.`,
    type: unavailable ? "warning" : "success",
    read: false,
    createdAt: new Date(),
  });
  return { session, events: await listRuntimeEvents(userId, sessionId), fallback: workspace.preview, runner: runnerResult, runnerJobId, previewSession };
}

export async function stopLiveBuilderRuntime(userId: RuntimeUserId, sessionId: string) {
  const session = await ownedSession(userId, sessionId);
  await appendEvent(session.id, "stopping", "Stopping the isolated preview session.");
  const stopped = await updateSession(session.id, { status: "stopped", stoppedAt: new Date() });
  await appendEvent(session.id, "stopped", "Preview session stopped; project files and versions remain unchanged.");
  return { session: stopped, events: await listRuntimeEvents(userId, sessionId) };
}

export async function restartLiveBuilderRuntime(userId: RuntimeUserId, sessionId: string) {
  const session = await ownedSession(userId, sessionId);
  await updateSession(session.id, { status: "stopped", stoppedAt: new Date() });
  return startLiveBuilderRuntime(userId, { workspaceId: session.workspaceId, target: session.target, engine: session.engine === "unavailable" ? "controlled_canvas" : session.engine, versionId: session.versionId });
}

export async function rebuildLiveBuilderRuntime(userId: RuntimeUserId, sessionId: string) {
  const session = await ownedSession(userId, sessionId);
  await appendEvent(session.id, "build_started", "Rebuild requested for the current persisted project version.");
  await updateSession(session.id, { status: "stopped", stoppedAt: new Date(), lastError: null });
  const result = await startLiveBuilderRuntime(userId, {
    workspaceId: session.workspaceId,
    target: session.target,
    engine: session.engine === "unavailable" ? "external_runner" : session.engine,
    versionId: session.versionId,
  });
  if (result.session.status === "ready") {
    await appendEvent(result.session.id, "recovered", "Rebuild completed and the latest persisted version is ready for preview.");
    await insertNotification({ id: randomUUID(), userId, title: "Recovery completed", message: "The latest persisted project version is ready after rebuild recovery.", type: "success", read: false, createdAt: new Date() });
  }
  return { ...result, events: await listRuntimeEvents(userId, result.session.id) };
}

export async function getLiveBuilderRuntime(userId: RuntimeUserId, sessionId: string) {
  const session = await ownedSession(userId, sessionId);
  return { session: asSession(session), events: await listRuntimeEvents(userId, sessionId) };
}

export async function listRuntimeEvents(userId: RuntimeUserId, sessionId: string): Promise<LiveBuilderRuntimeEvent[]> {
  await ownedSession(userId, sessionId);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const rows = await db.select().from(liveBuilderRuntimeEvents).where(eq(liveBuilderRuntimeEvents.sessionId, sessionId)).orderBy(liveBuilderRuntimeEvents.sequence);
  return rows.map((row) => liveBuilderRuntimeEventSchema.parse({ ...row, diagnostics: row.diagnostics, createdAt: row.createdAt.toISOString() }));
}

export async function listLiveBuilderRuntimes(userId: RuntimeUserId, workspaceId: string) {
  const workspace = await getLiveBuilderWorkspace(userId, workspaceId);
  if (!workspace) throw new Error("Live Builder workspace not found");
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const rows = await db.select().from(liveBuilderRuntimeSessions).where(eq(liveBuilderRuntimeSessions.workspaceId, workspaceId)).orderBy(desc(liveBuilderRuntimeSessions.updatedAt)).limit(20);
  return rows.map(asSession);
}

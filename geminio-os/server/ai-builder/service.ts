import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { aiBuilderEvents, aiBuilderProjects, liveBuilderChangeSets, type AiBuilderProjectRecord } from "../../drizzle/schema";
import { getDb } from "../db";
import { insertNotification } from "../geminio-data";
import { recordAiAudit } from "../ai-core/security";
import { ProjectMemory } from "../../lib/ai-builder/project-memory";
import { RequirementsGatheringEngine } from "../../lib/ai-builder/requirements-engine";
import { getAiBuilderLlm, parseModelJson } from "../../lib/ai-builder/llm-port";
import {
  createLiveBuilderWorkspace,
  getLiveBuilderWorkspace,
  proposeLiveBuilderGeneratedChange,
  readLiveBuilderFilesForAnalysis,
  readLiveBuilderStoredFiles,
  requestLiveBuilderDeployment,
  validateLiveBuilderWorkspace,
} from "../live-builder/service";
import { registerAiBuilderLlm, withBuilderContext } from "./llm-adapter";
import { buildGeneratedPatches, type GeneratedFile } from "./generated-files";
import { assertAdvance, type BuilderStage } from "./stages";
import { analyzeWorkspace } from "./workspace-analyzer";

registerAiBuilderLlm();

type Kind = "website" | "mobile_app" | "workflow" | "api";
type Target = "phone" | "tablet" | "laptop" | "desktop";

export class BuilderConflictError extends Error {
  constructor(message = "This AI Builder project changed or is busy. Reload and retry.") { super(message); this.name = "BuilderConflictError"; }
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Persistent project storage is temporarily unavailable.");
  return db;
}

async function loadOwned(userId: number, id: string): Promise<AiBuilderProjectRecord> {
  const db = await requireDb();
  const row = (await db.select().from(aiBuilderProjects).where(and(eq(aiBuilderProjects.id, id), eq(aiBuilderProjects.userId, userId))).limit(1))[0];
  if (!row) throw new Error("The AI Builder project is unavailable or does not belong to this account.");
  return row;
}

async function appendEvent(userId: number, builderProjectId: string, type: string, payload: Record<string, unknown>) {
  const db = await requireDb();
  // sequence collisions are caught by the (builderProjectId, sequence) unique index; retry once.
  for (let i = 0; i < 3; i += 1) {
    const last = (await db.select({ s: aiBuilderEvents.sequence }).from(aiBuilderEvents).where(eq(aiBuilderEvents.builderProjectId, builderProjectId)).orderBy(desc(aiBuilderEvents.sequence)).limit(1))[0];
    try {
      await db.insert(aiBuilderEvents).values({ id: randomUUID(), builderProjectId, userId, sequence: (last?.s ?? 0) + 1, type, payload });
      return;
    } catch (error) {
      if (i === 2) throw error;
    }
  }
}

/** Compare-and-set update. Throws BuilderConflictError when the version moved. */
async function cas(row: AiBuilderProjectRecord, patch: Partial<typeof aiBuilderProjects.$inferInsert>) {
  const db = await requireDb();
  const [result] = (await db
    .update(aiBuilderProjects)
    .set({ ...patch, version: row.version + 1 })
    .where(and(eq(aiBuilderProjects.id, row.id), eq(aiBuilderProjects.userId, row.userId), eq(aiBuilderProjects.version, row.version)))) as unknown as [{ affectedRows: number }];
  if (!result || result.affectedRows !== 1) throw new BuilderConflictError();
  return { ...row, ...patch, version: row.version + 1 } as AiBuilderProjectRecord;
}

/** Acquire the per-project "running" lock via CAS. */
async function begin(userId: number, id: string, allowedFrom: BuilderStage[]) {
  const row = await loadOwned(userId, id);
  if (row.status === "running") throw new BuilderConflictError("Another AI Builder operation is already running for this project.");
  if (!allowedFrom.includes(row.stage as BuilderStage)) throw new Error(`This operation is not available at stage "${row.stage}".`);
  return cas(row, { status: "running", lastError: null });
}

async function fail(userId: number, locked: AiBuilderProjectRecord, operation: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Operation failed.";
  try {
    const current = await loadOwned(userId, locked.id);
    await cas(current, { status: "failed", lastError: message.slice(0, 2000) });
  } catch { /* lost the race; the newer state wins */ }
  await appendEvent(userId, locked.id, `${operation}.failed`, { message });
  await recordAiAudit({ userId, action: `ai_builder.${operation}.failed`, resource: locked.id, status: "error", details: { message } });
  await insertNotification({ id: randomUUID(), userId, title: "AI Builder step failed", message: `${locked.name}: ${message}`.slice(0, 500), type: "error", read: false, createdAt: new Date() });
}

function memoryFor(row: AiBuilderProjectRecord) {
  return new ProjectMemory(row.id as never);
}

export async function createBuilderProject(userId: number, input: { name: string; prompt: string; kind: Kind }) {
  const db = await requireDb();
  const workspace = await createLiveBuilderWorkspace(userId, { name: input.name, description: input.prompt.slice(0, 500), kind: input.kind });
  if (!workspace) throw new Error("The Live Builder workspace could not be created.");
  const id = randomUUID();
  await db.insert(aiBuilderProjects).values({ id, userId, workspaceId: workspace.id, name: input.name, prompt: input.prompt, stage: "prompt", status: "idle" });
  await appendEvent(userId, id, "project.created", { workspaceId: workspace.id, kind: input.kind });
  await recordAiAudit({ userId, action: "ai_builder.project.created", resource: id, status: "success", details: { workspaceId: workspace.id } });
  return loadOwned(userId, id);
}

export async function listBuilderProjects(userId: number) {
  const db = await requireDb();
  return db.select().from(aiBuilderProjects).where(eq(aiBuilderProjects.userId, userId)).orderBy(desc(aiBuilderProjects.updatedAt)).limit(100);
}

export async function getBuilderProject(userId: number, id: string) {
  const row = await loadOwned(userId, id);
  const db = await requireDb();
  const events = await db.select().from(aiBuilderEvents).where(eq(aiBuilderEvents.builderProjectId, id)).orderBy(asc(aiBuilderEvents.sequence)).limit(500);
  return { project: row, events };
}

export async function generateRequirements(userId: number, id: string) {
  const locked = await begin(userId, id, ["prompt", "requirements"]);
  try {
    const result = await withBuilderContext({ userId, builderProjectId: id }, async () => {
      const engine = new RequirementsGatheringEngine(memoryFor(locked), { id } as never);
      const requirements = await engine.extractRequirements(locked.prompt);
      if (!Array.isArray(requirements) || requirements.length === 0) throw new Error("The AI provider returned no requirements.");
      return requirements;
    });
    const current = await loadOwned(userId, id);
    if (current.status === "cancelled") return current; // cancelled while the provider call was in flight
    if (current.stage !== "requirements") assertAdvance(current.stage as BuilderStage, "requirements");
    const next = await cas(current, { stage: "requirements", status: "idle", requirements: result });
    await appendEvent(userId, id, "requirements.generated", { count: result.length });
    return next;
  } catch (error) {
    await fail(userId, locked, "requirements", error);
    throw error;
  }
}

export async function generatePlan(userId: number, id: string) {
  const locked = await begin(userId, id, ["requirements", "plan"]);
  try {
    if (!Array.isArray(locked.requirements) || locked.requirements.length === 0) throw new Error("Generate requirements before planning.");
    const plan = await withBuilderContext({ userId, builderProjectId: id }, async () => {
      const engine = new RequirementsGatheringEngine(memoryFor(locked), { id } as never);
      const p = await engine.generateImplementationPlan(locked.requirements as never);
      if (!p || !Array.isArray((p as { phases?: unknown }).phases) || (p as { phases: unknown[] }).phases.length === 0) throw new Error("The AI provider returned an empty implementation plan.");
      return p;
    });
    const current = await loadOwned(userId, id);
    if (current.status === "cancelled") return current;
    if (current.stage !== "plan") assertAdvance(current.stage as BuilderStage, "plan");
    const next = await cas(current, { stage: "plan", status: "idle", plan });
    await appendEvent(userId, id, "plan.generated", { phases: (plan as { phases: unknown[] }).phases.length });
    return next;
  } catch (error) {
    await fail(userId, locked, "plan", error);
    throw error;
  }
}

const CODE_SYSTEM = "You generate source files for a project. Respond ONLY with JSON: {\"files\":[{\"path\":\"relative/path.ext\",\"content\":\"...\",\"summary\":\"...\"}]}. Use relative paths, no .env files, never include real credentials; reference secrets by environment variable name only.";

export async function generateCode(userId: number, id: string) {
  const locked = await begin(userId, id, ["plan", "code"]);
  try {
    if (!locked.plan) throw new Error("Generate a plan before generating code.");
    const stored = await readLiveBuilderStoredFiles(userId, locked.workspaceId);
    const files = await withBuilderContext({ userId, builderProjectId: id }, async () => {
      const out = await getAiBuilderLlm()({
        operation: "code.generate",
        system: CODE_SYSTEM,
        maxTokens: 8000,
        prompt: `Project: ${locked.name}\nRequest: ${locked.prompt}\nRequirements: ${JSON.stringify(locked.requirements)}\nPlan: ${JSON.stringify(locked.plan)}\nExisting files: ${JSON.stringify(stored.map((f) => f.path))}`,
      });
      const parsed = parseModelJson<{ files?: GeneratedFile[] }>(out.text);
      return parsed.files ?? [];
    });
    const patches = buildGeneratedPatches(files, stored); // dry-runs the real apply validator
    const current = await loadOwned(userId, id);
    if (current.status === "cancelled") return { project: current, changeSet: null };
    const changeSet = await proposeLiveBuilderGeneratedChange(userId, {
      workspaceId: locked.workspaceId,
      prompt: locked.prompt,
      summary: `AI Builder: generate ${patches.length} file(s) for ${locked.name}`,
      patches,
    });
    // Stage "code": waiting for the user to review/apply the change set in Live Builder.
    const next = await cas(current, { stage: "code", status: "waiting_for_user" });
    await appendEvent(userId, id, "code.proposed", { changeSetId: changeSet.id, files: patches.map((p) => p.path) });
    await insertNotification({ id: randomUUID(), userId, title: "Generated code needs review", message: `${locked.name}: ${patches.length} file(s) are waiting for your approval in Live Builder.`, type: "info", read: false, createdAt: new Date() });
    return { project: next, changeSet };
  } catch (error) {
    await fail(userId, locked, "code", error);
    throw error;
  }
}

/** After the user applies the change set through Live Builder, move code → preview. */
export async function confirmCodeApplied(userId: number, id: string, changeSetId: string) {
  const row = await loadOwned(userId, id);
  const db = await requireDb();
  const change = (await db.select().from(liveBuilderChangeSets).where(and(eq(liveBuilderChangeSets.id, changeSetId), eq(liveBuilderChangeSets.workspaceId, row.workspaceId))).limit(1))[0];
  if (!change) throw new Error("The change set does not belong to this project.");
  if (change.status !== "applied") throw new Error("The change set has not been applied yet.");
  assertAdvance(row.stage as BuilderStage, "preview");
  const next = await cas(row, { stage: "preview", status: "idle" });
  await appendEvent(userId, id, "code.applied", { changeSetId });
  return next;
}

export async function analyzeBuilderWorkspace(userId: number, id: string) {
  const row = await loadOwned(userId, id);
  const files = await readLiveBuilderFilesForAnalysis(userId, row.workspaceId);
  const analysis = analyzeWorkspace(files);
  await appendEvent(userId, id, "workspace.analyzed", { fileCount: analysis.fileCount, findings: analysis.findings.length });
  return analysis;
}

/**
 * Run Live Builder validation. A "blocked" status (no sandboxed runner configured)
 * is reported truthfully and does NOT advance the project to "validate".
 */
export async function runBuilderValidation(userId: number, id: string, target: Target) {
  const row = await loadOwned(userId, id);
  if (!["preview", "edit", "rebuild", "test", "debug"].includes(row.stage)) throw new Error(`Validation is not available at stage "${row.stage}".`);
  const run = await validateLiveBuilderWorkspace(userId, row.workspaceId, target);
  let current = row;
  if (row.stage !== "test" && (row.stage === "preview" || row.stage === "rebuild" || row.stage === "debug")) {
    current = await cas(row, { stage: "test" });
  }
  await appendEvent(userId, id, "validation.completed", { validationRunId: run.id, status: run.status, blocked: run.checks.filter((c) => c.status === "blocked").map((c) => c.name) });
  if (run.status === "passed") {
    assertAdvance("test", "validate");
    current = await cas(current, { stage: "validate", status: "idle" });
  } else if (run.status === "failed") {
    current = await cas(current, { stage: "debug", status: "idle" });
  } else {
    current = await cas(current, { status: "waiting_for_user", lastError: "Validation is blocked: a sandboxed project runner is not configured." });
  }
  return { project: current, validation: run };
}

/** Deployment only creates a review that requires approval; it never claims a deploy happened. */
export async function requestBuilderDeployment(userId: number, id: string, versionId: string, releaseNotes?: string | null) {
  const row = await loadOwned(userId, id);
  if (row.stage !== "validate") throw new Error("Deployment can only be requested after validation has passed.");
  const review = await requestLiveBuilderDeployment(userId, row.workspaceId, versionId, releaseNotes ?? null);
  const next = await cas(row, { stage: "deploy", status: "waiting_for_user" });
  await appendEvent(userId, id, "deployment.requested", { versionId });
  await recordAiAudit({ userId, action: "ai_builder.deploy.requested", resource: id, status: "success", details: { versionId } });
  return { project: next, review };
}

export async function cancelBuilderOperation(userId: number, id: string) {
  const row = await loadOwned(userId, id);
  if (row.status !== "running") return row;
  const next = await cas(row, { status: "cancelled", lastError: "Cancelled by user." });
  await appendEvent(userId, id, "operation.cancelled", {});
  return next;
}

/** Restart recovery: projects stuck "running" past the lease are marked failed so they can be retried. */
export async function recoverStaleBuilderOperations(userId: number, olderThanMs = 10 * 60_000) {
  const db = await requireDb();
  const rows = await db.select().from(aiBuilderProjects).where(and(eq(aiBuilderProjects.userId, userId), eq(aiBuilderProjects.status, "running")));
  let recovered = 0;
  for (const row of rows) {
    if (Date.now() - new Date(row.updatedAt).getTime() < olderThanMs) continue;
    try { await cas(row, { status: "failed", lastError: "The operation was interrupted (server restart or timeout). Retry it." }); recovered += 1; } catch { /* concurrent update */ }
  }
  return { recovered };
}

export { getLiveBuilderWorkspace };

import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  liveBuilderChangeSets,
  liveBuilderDeploymentReviews,
  liveBuilderFiles,
  liveBuilderPreviewSessions,
  liveBuilderValidationRuns,
  liveBuilderVersions,
  liveBuilderWorkspaces,
  projects,
  type LiveBuilderFileRecord,
} from "../../drizzle/schema";
import {
  liveBuilderChangeSetSchema,
  liveBuilderFilePatchSchema,
  liveBuilderPreviewDocumentSchema,
  liveBuilderSelectionSchema,
  type LiveBuilderFileKind,
  type LiveBuilderFilePatch,
  type LiveBuilderPreviewDocument,
  type LiveBuilderSelection,
  type LiveBuilderVersion,
} from "../../shared/geminio-contracts";
import { getDb } from "../db";
import { submitGatewayRequest } from "../ai-core/gateway";
import { recordAiAudit } from "../ai-core/security";
import { insertNotification } from "../geminio-data";
import { applyChangeSet, ChangeSetError, planChangeSet, rejectChangeSet, restoreWorkspaceVersion, verifyWorkspaceIntegrity, type FileKind as StoredFileKind } from "./atomic-apply";
import { getMysqlApplyStore } from "./apply-store";
import { buildEditContext, buildEditMessages, parseEditProposal } from "./ai-edit";

type WorkspaceKind = "website" | "mobile_app" | "workflow" | "api";
type PreviewTarget = "phone" | "tablet" | "laptop" | "desktop";
type ManifestFile = Pick<LiveBuilderFileRecord, "path" | "kind" | "content" | "contentHash" | "isSecret" | "status">;
type WorkspaceManifest = { files: ManifestFile[] };

const PREVIEW_FILE_PATH = ".geminio/live-preview.json";
const PREVIEW_DIMENSIONS: Record<PreviewTarget, { width: number; height: number }> = {
  phone: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
  laptop: { width: 1280, height: 800 },
  desktop: { width: 1440, height: 960 },
};

function hash(content: string | null) {
  return createHash("sha256").update(content ?? "").digest("hex");
}

function asPreviewDocument(value: unknown, fallback: LiveBuilderPreviewDocument) {
  const parsed = liveBuilderPreviewDocumentSchema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

function asSelection(value: unknown) {
  const parsed = liveBuilderSelectionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function toDateString(value: Date | null | undefined) {
  return (value ?? new Date()).toISOString();
}

function publicFile(file: LiveBuilderFileRecord) {
  return {
    id: file.id,
    path: file.path,
    kind: file.kind,
    content: file.isSecret ? null : file.content,
    contentHash: file.contentHash,
    isSecret: file.isSecret,
    status: file.status,
    createdAt: toDateString(file.createdAt),
    updatedAt: toDateString(file.updatedAt),
  };
}

function safePath(path: string) {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("../") || normalized === ".." || normalized.includes("\0")) {
    throw new ChangeSetError("UNSAFE_PATH", "The selected file path is not permitted in a Live Builder workspace.");
  }
  return normalized;
}

function assertSafePatch(patch: LiveBuilderFilePatch) {
  const path = safePath(patch.path);
  const lowerPath = path.toLowerCase();
  if (lowerPath.includes(".env") || patch.kind === "environment") {
    throw new ChangeSetError("UNSAFE_PATH", "Environment values are managed through secure project settings and cannot be edited in the Live Builder file workspace.");
  }
  if (patch.operation !== "delete" && patch.content === null) {
    throw new ChangeSetError("INVALID_CONTENT", `The ${patch.operation} operation requires content for ${path}.`);
  }
  if (patch.content && /(?:api[-_]?key|secret|password|access[-_]?token)\s*[:=]\s*["'][^"'$]{8,}/i.test(patch.content)) {
    throw new ChangeSetError("INVALID_CONTENT", "The proposed change appears to contain a raw credential. Store credentials through secure project settings instead.");
  }
  return { ...patch, path };
}


/** Record which file content each modify/delete patch was proposed against (checked again at apply time). */
function withBaseHashes<T extends { path: string; operation: string }>(patches: T[], activeFiles: { path: string; contentHash: string | null; content: string | null }[]): (T & { baseHash: string | null })[] {
  const byPath = new Map(activeFiles.map((f) => [f.path, f]));
  return patches.map((patch) => {
    const file = byPath.get(patch.path);
    const baseHash = patch.operation === "add" || !file ? null : file.contentHash ?? hash(file.content);
    return { ...patch, baseHash };
  });
}

function defaultPreview(name: string, description: string | null): LiveBuilderPreviewDocument {
  return {
    route: "/",
    background: "#F7F7FA",
    nodes: [
      {
        id: "hero-title",
        type: "heading",
        label: name,
        text: name,
        filePath: "app/index.tsx",
        componentName: "HomeScreen",
        properties: { alignment: "left", responsive: true },
      },
      {
        id: "hero-copy",
        type: "text",
        label: "Project introduction",
        text: description || "Describe what you would like to build, then review the proposed change before it is applied.",
        filePath: "app/index.tsx",
        componentName: "HomeScreen",
        properties: { maxWidth: "readable", responsive: true },
      },
      {
        id: "primary-action",
        type: "button",
        label: "Primary action",
        text: "Get started",
        filePath: "app/index.tsx",
        componentName: "HomeScreen",
        properties: { variant: "primary", responsive: true },
      },
    ],
  };
}

function starterFiles(kind: WorkspaceKind, preview: LiveBuilderPreviewDocument): Array<{ path: string; kind: LiveBuilderFileKind; content: string }> {
  const config = kind === "mobile_app" ? "app.config.ts" : kind === "website" ? "vite.config.ts" : "geminio.config.json";
  return [
    {
      path: "app/index.tsx",
      kind: "page",
      content: `// Live Builder source mirror\nexport default function HomeScreen() {\n  return null;\n}\n`,
    },
    {
      path: PREVIEW_FILE_PATH,
      kind: "manifest",
      content: JSON.stringify(preview, null, 2),
    },
    {
      path: config,
      kind: "config",
      content: `// ${kind} configuration is represented here.\n`,
    },
  ];
}

function asManifest(value: unknown): WorkspaceManifest {
  if (!value || typeof value !== "object" || !Array.isArray((value as WorkspaceManifest).files)) return { files: [] };
  return {
    files: (value as WorkspaceManifest).files.filter((file): file is ManifestFile => Boolean(file && typeof file.path === "string")),
  };
}

function requiresChangeApproval(patches: LiveBuilderFilePatch[]) {
  return patches.some((patch) => patch.operation === "delete" || ["api", "database", "config", "manifest"].includes(patch.kind));
}

async function getOwnedWorkspace(userId: number, workspaceId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(liveBuilderWorkspaces).where(and(eq(liveBuilderWorkspaces.id, workspaceId), eq(liveBuilderWorkspaces.userId, userId))).limit(1);
  return rows[0] ?? null;
}

async function listActiveFiles(workspaceId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(liveBuilderFiles).where(and(eq(liveBuilderFiles.workspaceId, workspaceId), eq(liveBuilderFiles.status, "active"))).orderBy(asc(liveBuilderFiles.path));
}

async function nextChangeSequence(workspaceId: string) {
  const db = await getDb();
  if (!db) return 1;
  const rows = await db.select({ sequence: liveBuilderChangeSets.sequence }).from(liveBuilderChangeSets).where(eq(liveBuilderChangeSets.workspaceId, workspaceId)).orderBy(desc(liveBuilderChangeSets.sequence)).limit(1);
  return (rows[0]?.sequence ?? 0) + 1;
}

async function nextVersionNumber(workspaceId: string) {
  const db = await getDb();
  if (!db) return 1;
  const rows = await db.select({ number: liveBuilderVersions.number }).from(liveBuilderVersions).where(eq(liveBuilderVersions.workspaceId, workspaceId)).orderBy(desc(liveBuilderVersions.number)).limit(1);
  return (rows[0]?.number ?? 0) + 1;
}

async function createVersion(workspaceId: string, label: string, changeSetId: string | null, preview: LiveBuilderPreviewDocument) {
  const db = await getDb();
  if (!db) return null;
  const files = await listActiveFiles(workspaceId);
  const number = await nextVersionNumber(workspaceId);
  const id = randomUUID();
  const manifest: WorkspaceManifest = {
    files: files.map((file) => ({
      path: file.path,
      kind: file.kind,
      content: file.isSecret ? null : file.content,
      contentHash: file.contentHash,
      isSecret: file.isSecret,
      status: file.status,
    })),
  };
  await db.insert(liveBuilderVersions).values({ id, workspaceId, changeSetId, number, label, manifest, previewDocument: preview });
  const row = (await db.select().from(liveBuilderVersions).where(eq(liveBuilderVersions.id, id)).limit(1))[0];
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    number: row.number,
    label: row.label,
    changeSetId: row.changeSetId,
    preview: asPreviewDocument(row.previewDocument, preview),
    createdAt: toDateString(row.createdAt),
  } satisfies LiveBuilderVersion;
}

export async function createLiveBuilderWorkspace(userId: number, input: { name: string; description?: string | null; kind: WorkspaceKind; existingProjectId?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Persistent project storage is temporarily unavailable.");
  let projectId = input.existingProjectId ?? null;
  if (projectId) {
    const existing = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1);
    if (!existing[0]) throw new ChangeSetError("WORKSPACE_UNAVAILABLE", "The requested project is unavailable or does not belong to this account.");
    const workspace = await db.select().from(liveBuilderWorkspaces).where(eq(liveBuilderWorkspaces.projectId, projectId)).limit(1);
    if (workspace[0]) return getLiveBuilderWorkspace(userId, workspace[0].id);
  } else {
    projectId = randomUUID();
    const projectType = input.kind === "mobile_app" ? "app" : input.kind === "api" ? "agent" : input.kind;
    await db.insert(projects).values({ id: projectId, userId, name: input.name, type: projectType, description: input.description ?? null, data: null, status: "draft" });
  }
  const preview = defaultPreview(input.name, input.description ?? null);
  const workspaceId = randomUUID();
  await db.insert(liveBuilderWorkspaces).values({ id: workspaceId, projectId, userId, kind: input.kind, previewEngine: "controlled_canvas", previewDocument: preview, selectedElement: null, status: "active" });
  for (const file of starterFiles(input.kind, preview)) {
    await db.insert(liveBuilderFiles).values({ id: randomUUID(), workspaceId, path: file.path, kind: file.kind, content: file.content, contentHash: hash(file.content), isSecret: false, status: "active" });
  }
  await createVersion(workspaceId, "Initial workspace", null, preview);
  await insertNotification({ id: randomUUID(), userId, title: "Project created", message: `${input.name} is ready in AI Builder with an initial recoverable version.`, type: "success", read: false, createdAt: new Date() });
  return getLiveBuilderWorkspace(userId, workspaceId);
}

export async function listLiveBuilderWorkspaces(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(liveBuilderWorkspaces).where(eq(liveBuilderWorkspaces.userId, userId)).orderBy(desc(liveBuilderWorkspaces.updatedAt));
  return rows.map((workspace) => ({
    id: workspace.id,
    projectId: workspace.projectId,
    kind: workspace.kind,
    previewEngine: workspace.previewEngine,
    status: workspace.status,
    preview: asPreviewDocument(workspace.previewDocument, defaultPreview("Untitled project", null)),
    selectedElement: asSelection(workspace.selectedElement),
    updatedAt: toDateString(workspace.updatedAt),
  }));
}

export async function getLiveBuilderWorkspace(userId: number, workspaceId: string) {
  const workspace = await getOwnedWorkspace(userId, workspaceId);
  if (!workspace) return null;
  const db = await getDb();
  if (!db) return null;
  const [files, changes, versions, validations, sessions, deployments] = await Promise.all([
    listActiveFiles(workspaceId),
    db.select().from(liveBuilderChangeSets).where(eq(liveBuilderChangeSets.workspaceId, workspaceId)).orderBy(desc(liveBuilderChangeSets.sequence)).limit(50),
    db.select().from(liveBuilderVersions).where(eq(liveBuilderVersions.workspaceId, workspaceId)).orderBy(desc(liveBuilderVersions.number)).limit(50),
    db.select().from(liveBuilderValidationRuns).where(eq(liveBuilderValidationRuns.workspaceId, workspaceId)).orderBy(desc(liveBuilderValidationRuns.createdAt)).limit(50),
    db.select().from(liveBuilderPreviewSessions).where(eq(liveBuilderPreviewSessions.workspaceId, workspaceId)).orderBy(desc(liveBuilderPreviewSessions.updatedAt)).limit(10),
    db.select().from(liveBuilderDeploymentReviews).where(eq(liveBuilderDeploymentReviews.workspaceId, workspaceId)).orderBy(desc(liveBuilderDeploymentReviews.updatedAt)).limit(10),
  ]);
  const preview = asPreviewDocument(workspace.previewDocument, defaultPreview("Untitled project", null));
  return {
    id: workspace.id,
    projectId: workspace.projectId,
    kind: workspace.kind,
    previewEngine: workspace.previewEngine,
    status: workspace.status,
    preview,
    selectedElement: asSelection(workspace.selectedElement),
    files: files.map(publicFile),
    changes: changes.map((change) => liveBuilderChangeSetSchema.parse({
      id: change.id,
      workspaceId: change.workspaceId,
      runId: change.runId,
      prompt: change.prompt,
      selectedElement: asSelection(change.selectedElement),
      summary: change.summary,
      rationale: change.rationale,
      patches: change.patches,
      status: change.status,
      requiresApproval: change.requiresApproval,
      createdAt: toDateString(change.createdAt),
      updatedAt: toDateString(change.updatedAt),
    })),
    versions: versions.map((version) => ({ id: version.id, workspaceId: version.workspaceId, number: version.number, label: version.label, changeSetId: version.changeSetId, preview: asPreviewDocument(version.previewDocument, preview), createdAt: toDateString(version.createdAt) })),
    validations: validations.map((validation) => ({ id: validation.id, workspaceId: validation.workspaceId, changeSetId: validation.changeSetId, target: validation.target, status: validation.status, checks: validation.checks, logSummary: validation.logSummary, createdAt: toDateString(validation.createdAt), completedAt: validation.completedAt?.toISOString() ?? null })),
    previewSessions: sessions.map((session) => ({ id: session.id, target: session.target, engine: session.engine, status: session.status, url: session.url, error: session.error, updatedAt: toDateString(session.updatedAt) })),
    deployments: deployments.map((deployment) => ({ id: deployment.id, versionId: deployment.versionId, status: deployment.status, provider: deployment.provider, releaseNotes: deployment.releaseNotes, updatedAt: toDateString(deployment.updatedAt) })),
    previewDimensions: PREVIEW_DIMENSIONS,
  };
}

export async function setLiveBuilderSelection(userId: number, workspaceId: string, selection: LiveBuilderSelection | null) {
  const workspace = await getOwnedWorkspace(userId, workspaceId);
  if (!workspace) return null;
  const db = await getDb();
  if (!db) return null;
  if (selection) {
    const preview = asPreviewDocument(workspace.previewDocument, defaultPreview("Untitled project", null));
    if (!preview.nodes.some((node) => node.id === selection.elementId)) throw new ChangeSetError("INVALID", "The selected element is not part of the current preview.");
  }
  await db.update(liveBuilderWorkspaces).set({ selectedElement: selection, updatedAt: new Date() }).where(and(eq(liveBuilderWorkspaces.id, workspaceId), eq(liveBuilderWorkspaces.userId, userId)));
  return selection;
}

/**
 * AI-generated Live Builder edit. The model output is untrusted: it is parsed, validated against the REAL workspace
 * files and dry-run through the atomic-apply planner before anything is persisted. The proposal is always held for
 * explicit approval; nothing is applied here.
 */
export async function proposeLiveBuilderPromptChange(userId: number, input: { workspaceId: string; prompt: string; selectedElement?: LiveBuilderSelection | null }) {
  const workspace = await getOwnedWorkspace(userId, input.workspaceId);
  if (!workspace) throw new ChangeSetError("WORKSPACE_UNAVAILABLE", "The requested workspace is unavailable or does not belong to this account.");
  const selection = input.selectedElement ?? asSelection(workspace.selectedElement);
  const preview = asPreviewDocument(workspace.previewDocument, defaultPreview("Untitled project", null));
  const files = (await listActiveFiles(input.workspaceId)).map(toStoredFile);
  const context = buildEditContext({ prompt: input.prompt, selection, preview, files });
  const aiRun = await submitGatewayRequest(userId, {
    message: `Live Builder edit request: ${input.prompt}`.slice(0, 50_000),
    requestId: `live_builder_${randomUUID()}`,
    conversationId: null,
    projectId: workspace.projectId,
    mode: "execute",
    metadata: { workspaceId: input.workspaceId },
  }, {
    forcedCapability: "builder.live.edit",
    skipUserMessage: true,
    trustedParameters: { workspaceId: input.workspaceId, trustedEditJson: true, trustedEditMessages: buildEditMessages(context) },
  });
  if (aiRun.status === "cancelled") throw new Error("The AI edit was cancelled before it produced a proposal.");
  if (aiRun.status !== "completed") {
    const retry = aiRun.error?.retryable ? " It will be retried automatically; check again shortly." : "";
    throw new Error(`${aiRun.error?.message ?? "The AI provider did not return a result."}${retry}`);
  }
  const text = typeof aiRun.result?.output?.text === "string" ? aiRun.result.output.text : "";
  if (!text.trim()) throw new Error("The AI provider returned an empty response; no change was proposed.");
  const proposal = parseEditProposal(text, files, selection, (content) => liveBuilderPreviewDocumentSchema.parse(JSON.parse(content)));
  return proposeLiveBuilderGeneratedChange(userId, {
    workspaceId: input.workspaceId,
    prompt: input.prompt,
    summary: proposal.summary,
    rationale: proposal.rationale || (selection ? `Scoped to ${selection.filePath} and the selected ${selection.label}.` : null),
    runId: aiRun.runId,
    taskId: aiRun.taskId,
    selectedElement: selection,
    patches: proposal.patches,
  });
}

export async function proposeLiveBuilderFileChange(userId: number, input: { workspaceId: string; filePath: string; content: string; summary?: string | null }) {
  const workspace = await getOwnedWorkspace(userId, input.workspaceId);
  if (!workspace) throw new ChangeSetError("WORKSPACE_UNAVAILABLE", "The requested workspace is unavailable or does not belong to this account.");
  const db = await getDb();
  if (!db) throw new Error("Persistent project storage is temporarily unavailable.");
  const activeFiles = await listActiveFiles(input.workspaceId);
  const file = activeFiles.find((candidate) => candidate.path === input.filePath);
  if (!file) throw new ChangeSetError("CHANGE_NOT_FOUND", "The requested file is not part of this workspace.");
  const patch = assertSafePatch(liveBuilderFilePatchSchema.parse({
    path: file.path,
    operation: "modify",
    kind: file.kind,
    content: input.content,
    summary: input.summary?.trim() || `Update ${file.path}`,
  }));
  // A user-authored edit involves no AI work, so it must not reserve or charge credits and does not create an AI run.
  // The proposal is still auditable: it is stored as a change set (patch + base hashes) and recorded in the audit log.
  await recordAiAudit({ userId, action: "live_builder.file_change.proposed", resource: file.path, status: "success", details: { workspaceId: input.workspaceId, contentHash: hash(input.content), existingContentHash: file.contentHash, authoredBy: "user" } });
  const id = randomUUID();
  const change = {
    id,
    workspaceId: input.workspaceId,
    runId: null,
    taskId: null,
    sequence: await nextChangeSequence(input.workspaceId),
    prompt: `Edit ${file.path}`,
    selectedElement: asSelection(workspace.selectedElement),
    summary: patch.summary,
    rationale: "The file edit is isolated to an existing workspace file and remains reviewable before application.",
    patches: withBaseHashes([patch], activeFiles),
    status: "awaiting_approval" as const,
    requiresApproval: true,
  };
  await db.insert(liveBuilderChangeSets).values(change);
  const row = (await db.select().from(liveBuilderChangeSets).where(eq(liveBuilderChangeSets.id, id)).limit(1))[0];
  if (!row) throw new Error("The file edit proposal could not be persisted.");
  return liveBuilderChangeSetSchema.parse({ ...change, createdAt: toDateString(row.createdAt), updatedAt: toDateString(row.updatedAt) });
}

/**
 * Atomic apply. All validation happens before any write, and every write (files,
 * change-set status, preview, version, audit event) happens in ONE InnoDB
 * transaction behind a workspace row lock. See server/live-builder/atomic-apply.ts.
 * Idempotent: re-applying an applied change set returns its original version.
 */
export async function applyLiveBuilderChangeSet(userId: number, workspaceId: string, changeSetId: string, signal?: AbortSignal) {
  const store = await getMysqlApplyStore();
  const result = await applyChangeSet(store, {
    userId,
    workspaceId,
    changeSetId,
    signal,
    parsePreview: (content) => liveBuilderPreviewDocumentSchema.parse(JSON.parse(content)),
  });
  return { changeSetId: result.changeSetId, version: result.version, preview: asPreviewDocument(result.preview, defaultPreview("Untitled project", null)), alreadyApplied: result.alreadyApplied, filesChanged: result.filesChanged, staleCheck: result.staleCheck };
}

/** Reject (cancel) a pending change set. Loses cleanly to a concurrent apply. */
export async function rejectLiveBuilderChangeSet(userId: number, workspaceId: string, changeSetId: string) {
  return rejectChangeSet(await getMysqlApplyStore(), { userId, workspaceId, changeSetId });
}

/** Read-only consistency check: applied change sets without versions, and files that differ from the newest version. */
export async function verifyLiveBuilderIntegrity(userId: number, workspaceId: string) {
  const db = await getDb();
  if (!db) throw new Error("Persistent project storage is temporarily unavailable.");
  const applied = await db.select({ id: liveBuilderChangeSets.id }).from(liveBuilderChangeSets).where(and(eq(liveBuilderChangeSets.workspaceId, workspaceId), eq(liveBuilderChangeSets.status, "applied")));
  return verifyWorkspaceIntegrity(await getMysqlApplyStore(), { userId, workspaceId, appliedChangeIds: applied.map((r) => r.id) });
}

/** Recovery action: atomically make the workspace equal its newest stored version. */
export async function recoverLiveBuilderWorkspace(userId: number, workspaceId: string) {
  return restoreWorkspaceVersion(await getMysqlApplyStore(), { userId, workspaceId, reason: "Recovered to the latest saved version" });
}

export async function restoreLiveBuilderVersion(userId: number, workspaceId: string, versionId: string) {
  const result = await restoreWorkspaceVersion(await getMysqlApplyStore(), { userId, workspaceId, versionId });
  return { restoredVersionId: result.restoredVersionId, preview: asPreviewDocument(result.preview, defaultPreview("Untitled project", null)), version: result.version };
}

export async function startLiveBuilderPreview(userId: number, workspaceId: string, target: PreviewTarget, requestedEngine: "controlled_canvas" | "external_runner" = "controlled_canvas") {
  const workspace = await getOwnedWorkspace(userId, workspaceId);
  if (!workspace) throw new ChangeSetError("WORKSPACE_UNAVAILABLE", "The requested workspace is unavailable or does not belong to this account.");
  const db = await getDb();
  if (!db) throw new Error("Persistent project storage is temporarily unavailable.");
  const id = randomUUID();
  const externalUnavailable = requestedEngine === "external_runner";
  await db.insert(liveBuilderPreviewSessions).values({
    id,
    workspaceId,
    versionId: null,
    target,
    engine: externalUnavailable ? "unavailable" : "controlled_canvas",
    status: externalUnavailable ? "failed" : "ready",
    url: null,
    error: externalUnavailable ? "An isolated external preview runner is not configured for this workspace. The safe controlled-canvas preview remains available." : null,
  });
  return { id, target, engine: externalUnavailable ? "unavailable" as const : "controlled_canvas" as const, status: externalUnavailable ? "failed" as const : "ready" as const, dimensions: PREVIEW_DIMENSIONS[target], error: externalUnavailable ? "An isolated external preview runner is not configured." : null };
}

export async function validateLiveBuilderWorkspace(userId: number, workspaceId: string, target: PreviewTarget, changeSetId?: string | null) {
  const workspace = await getOwnedWorkspace(userId, workspaceId);
  if (!workspace) throw new ChangeSetError("WORKSPACE_UNAVAILABLE", "The requested workspace is unavailable or does not belong to this account.");
  const db = await getDb();
  if (!db) throw new Error("Persistent project storage is temporarily unavailable.");
  const files = await listActiveFiles(workspaceId);
  const preview = asPreviewDocument(workspace.previewDocument, defaultPreview("Untitled project", null));
  const checks = [
    { name: "Workspace path policy", status: files.every((file) => !file.path.includes("../")) ? "passed" as const : "failed" as const, details: "All persisted virtual file paths were checked for traversal sequences." },
    { name: "Credential boundary", status: files.every((file) => !file.isSecret || file.content === null) ? "passed" as const : "failed" as const, details: "Secret-managed files do not expose their values through the workspace." },
    { name: "Controlled preview document", status: preview.nodes.length > 0 ? "passed" as const : "failed" as const, details: "The controlled preview has a parsable document with selectable content." },
    { name: `${target} responsive review`, status: preview.nodes.every((node) => node.properties.responsive !== false) ? "passed" as const : "failed" as const, details: `Checked the declarative preview against the ${target} review target (${PREVIEW_DIMENSIONS[target].width}×${PREVIEW_DIMENSIONS[target].height}).` },
    { name: "Lint", status: "blocked" as const, details: "A sandboxed project runner is not configured; no lint command was executed against generated source." },
    { name: "Typecheck", status: "blocked" as const, details: "A sandboxed project runner is not configured; no typecheck command was executed against generated source." },
    { name: "Tests", status: "blocked" as const, details: "A sandboxed project runner is not configured; no project test command was executed against generated source." },
    { name: "Build", status: "blocked" as const, details: "A sandboxed project runner is not configured; no generated-project build was executed." },
    { name: "Runtime error scan", status: "blocked" as const, details: "A sandboxed preview runtime is not configured; no generated source was executed or inspected for runtime errors." },
  ];
  const status = checks.some((check) => check.status === "failed") ? "failed" : checks.some((check) => check.status === "blocked") ? "blocked" : "passed";
  const id = randomUUID();
  const logSummary = checks.map((check) => `${check.name}: ${check.status}`).join("; ");
  await db.insert(liveBuilderValidationRuns).values({ id, workspaceId, changeSetId: changeSetId ?? null, target, status, checks, logSummary, completedAt: new Date() });
  return { id, workspaceId, changeSetId: changeSetId ?? null, target, status, checks, logSummary, createdAt: new Date().toISOString(), completedAt: new Date().toISOString() };
}

/** Ownership-checked lookup of a workspace's display name and newest version (for approval cards). */
export async function describeLiveBuilderForDeploy(userId: number, workspaceId: string) {
  const workspace = await getOwnedWorkspace(userId, workspaceId);
  if (!workspace) return null;
  const db = await getDb();
  if (!db) throw new Error("Persistent project storage is temporarily unavailable.");
  const version = (await db.select().from(liveBuilderVersions).where(eq(liveBuilderVersions.workspaceId, workspaceId)).orderBy(desc(liveBuilderVersions.number)).limit(1))[0];
  return { workspaceId, name: String((workspace as { name?: string; title?: string }).name ?? (workspace as { title?: string }).title ?? workspaceId), versionId: version?.id ?? null, versionLabel: version?.label ?? null };
}

export async function requestLiveBuilderDeployment(userId: number, workspaceId: string, versionId: string, releaseNotes?: string | null) {
  const workspace = await getOwnedWorkspace(userId, workspaceId);
  if (!workspace) throw new ChangeSetError("WORKSPACE_UNAVAILABLE", "The requested workspace is unavailable or does not belong to this account.");
  const db = await getDb();
  if (!db) throw new Error("Persistent project storage is temporarily unavailable.");
  const version = (await db.select().from(liveBuilderVersions).where(and(eq(liveBuilderVersions.id, versionId), eq(liveBuilderVersions.workspaceId, workspaceId))).limit(1))[0];
  if (!version) throw new ChangeSetError("CHANGE_NOT_FOUND", "Choose a valid workspace version before requesting deployment.");
  const id = randomUUID();
  await db.insert(liveBuilderDeploymentReviews).values({ id, workspaceId, versionId, taskId: null, provider: null, status: "awaiting_approval", releaseNotes: releaseNotes ?? null });
  return { id, workspaceId, versionId, status: "awaiting_approval" as const, provider: null, message: "Deployment requires user approval and a configured deployment provider. No external deployment has been started." };
}

export const LIVE_BUILDER_PREVIEW_DIMENSIONS = PREVIEW_DIMENSIONS;

/**
 * Propose a multi-file change set produced by the AI Builder or an AI edit. It is ALWAYS
 * `awaiting_approval` (AI-generated changes are never auto-applied), carries base hashes for
 * stale detection, and was dry-run through the same planChangeSet the apply step uses.
 */
export async function proposeLiveBuilderGeneratedChange(userId: number, input: {
  workspaceId: string;
  prompt: string;
  summary: string;
  rationale?: string | null;
  runId?: string | null;
  taskId?: string | null;
  selectedElement?: LiveBuilderSelection | null;
  patches: (Omit<LiveBuilderFilePatch, "baseHash"> & { baseHash?: string | null })[];
}) {
  const workspace = await getOwnedWorkspace(userId, input.workspaceId);
  if (!workspace) throw new ChangeSetError("WORKSPACE_UNAVAILABLE", "The requested workspace is unavailable or does not belong to this account.");
  const db = await getDb();
  if (!db) throw new Error("Persistent project storage is temporarily unavailable.");
  const patches = input.patches.map((patch) => liveBuilderFilePatchSchema.parse(assertSafePatch(liveBuilderFilePatchSchema.parse(patch))));
  const files = await listActiveFiles(input.workspaceId);
  planChangeSet(patches, { files: files.map(toStoredFile), parsePreview: (content) => liveBuilderPreviewDocumentSchema.parse(JSON.parse(content)) });
  const id = randomUUID();
  const change = {
    id,
    workspaceId: input.workspaceId,
    runId: input.runId ?? null,
    taskId: input.taskId ?? null,
    sequence: await nextChangeSequence(input.workspaceId),
    prompt: input.prompt.trim().slice(0, 50_000),
    selectedElement: input.selectedElement ?? null,
    summary: input.summary.slice(0, 4_000),
    rationale: input.rationale ?? "Generated by AI and held for review before application.",
    patches,
    status: "awaiting_approval" as const,
    requiresApproval: true,
  };
  await db.insert(liveBuilderChangeSets).values(change);
  const row = (await db.select().from(liveBuilderChangeSets).where(eq(liveBuilderChangeSets.id, id)).limit(1))[0];
  if (!row) throw new Error("The generated change could not be persisted.");
  return liveBuilderChangeSetSchema.parse({ ...change, createdAt: toDateString(row.createdAt), updatedAt: toDateString(row.updatedAt) });
}

/** Active workspace files in the shape the atomic-apply planner expects (ownership already checked by callers). */
export async function readLiveBuilderStoredFiles(userId: number, workspaceId: string) {
  const workspace = await getOwnedWorkspace(userId, workspaceId);
  if (!workspace) throw new ChangeSetError("WORKSPACE_UNAVAILABLE", "The requested workspace is unavailable or does not belong to this account.");
  return (await listActiveFiles(workspaceId)).map(toStoredFile);
}

function toStoredFile(file: { id: string; path: string; kind: string; content: string | null; contentHash: string | null; isSecret: boolean; status?: string | null }) {
  return { id: file.id, path: file.path, kind: file.kind as StoredFileKind, content: file.content, contentHash: file.contentHash, isSecret: file.isSecret, status: (file.status === "deleted" ? "deleted" : "active") as "active" | "deleted" };
}

/** Read-only view of a workspace's active files for analysis (ownership-checked). */
export async function readLiveBuilderFilesForAnalysis(userId: number, workspaceId: string) {
  const workspace = await getOwnedWorkspace(userId, workspaceId);
  if (!workspace) throw new ChangeSetError("WORKSPACE_UNAVAILABLE", "The requested workspace is unavailable or does not belong to this account.");
  const files = await listActiveFiles(workspaceId);
  return files.map((file) => ({ path: file.path, content: file.isSecret ? null : file.content, isSecret: file.isSecret }));
}

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
import { insertNotification } from "../geminio-data";

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
    throw new Error("The selected file path is not permitted in a Live Builder workspace.");
  }
  return normalized;
}

function assertSafePatch(patch: LiveBuilderFilePatch) {
  const path = safePath(patch.path);
  const lowerPath = path.toLowerCase();
  if (lowerPath.includes(".env") || patch.kind === "environment") {
    throw new Error("Environment values are managed through secure project settings and cannot be edited in the Live Builder file workspace.");
  }
  if (patch.operation !== "delete" && patch.content === null) {
    throw new Error(`The ${patch.operation} operation requires content for ${path}.`);
  }
  if (patch.content && /(?:api[-_]?key|secret|password|access[-_]?token)\s*[:=]\s*["'][^"'$]{8,}/i.test(patch.content)) {
    throw new Error("The proposed change appears to contain a raw credential. Store credentials through secure project settings instead.");
  }
  return { ...patch, path };
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

function previewPatch(document: LiveBuilderPreviewDocument, prompt: string, selection: LiveBuilderSelection | null) {
  const normalizedPrompt = prompt.trim();
  const lower = normalizedPrompt.toLowerCase();
  const next = structuredClone(document);
  let summary: string;

  if (selection && /(remove|delete)\b/.test(lower)) {
    next.nodes = next.nodes.filter((node) => node.id !== selection.elementId);
    summary = `Remove the selected ${selection.label} from the controlled preview.`;
  } else if (/(add|create|insert)\b/.test(lower)) {
    const id = `node-${randomUUID().slice(0, 8)}`;
    const type = /button|cta/.test(lower) ? "button" : /card/.test(lower) ? "card" : /image|photo/.test(lower) ? "image" : "text";
    const label = normalizedPrompt.replace(/^(add|create|insert)\s+/i, "").slice(0, 100) || "New content";
    next.nodes.push({
      id,
      type,
      label,
      text: type === "button" ? "Continue" : label,
      filePath: selection?.filePath ?? "app/index.tsx",
      componentName: selection?.componentName ?? "HomeScreen",
      properties: { responsive: true, generatedFromPrompt: true },
    });
    summary = `Add a responsive ${type} to the preview.`;
  } else if (selection) {
    const index = next.nodes.findIndex((node) => node.id === selection.elementId);
    if (index < 0) throw new Error("The selected preview element no longer exists. Select an element again before requesting a change.");
    const quoted = normalizedPrompt.match(/["“]([^"”]{1,255})["”]/)?.[1];
    const current = next.nodes[index];
    next.nodes[index] = {
      ...current,
      label: quoted ?? current.label,
      text: quoted ?? `${current.text ?? current.label}\n\n${normalizedPrompt}`.slice(0, 4_000),
      properties: { ...current.properties, responsive: /(responsive|mobile|tablet|desktop)/.test(lower) ? true : current.properties.responsive },
    };
    summary = `Update the selected ${selection.label} while preserving the surrounding project structure.`;
  } else {
    const heading = next.nodes.find((node) => node.type === "heading");
    if (heading) heading.text = normalizedPrompt.slice(0, 255);
    summary = "Update the project’s primary preview content from the requested build brief.";
  }

  return { document: liveBuilderPreviewDocumentSchema.parse(next), summary };
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
    if (!existing[0]) throw new Error("The requested project is unavailable or does not belong to this account.");
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
    if (!preview.nodes.some((node) => node.id === selection.elementId)) throw new Error("The selected element is not part of the current preview.");
  }
  await db.update(liveBuilderWorkspaces).set({ selectedElement: selection, updatedAt: new Date() }).where(eq(liveBuilderWorkspaces.id, workspaceId));
  return selection;
}

export async function proposeLiveBuilderPromptChange(userId: number, input: { workspaceId: string; prompt: string; selectedElement?: LiveBuilderSelection | null }) {
  const workspace = await getOwnedWorkspace(userId, input.workspaceId);
  if (!workspace) throw new Error("The requested workspace is unavailable or does not belong to this account.");
  const db = await getDb();
  if (!db) throw new Error("Persistent project storage is temporarily unavailable.");
  const selection = input.selectedElement ?? asSelection(workspace.selectedElement);
  const preview = asPreviewDocument(workspace.previewDocument, defaultPreview("Untitled project", null));
  const activeFiles = await listActiveFiles(input.workspaceId);
  const aiRun = await submitGatewayRequest(userId, {
    message: `Live Builder edit request: ${input.prompt}`,
    requestId: `live_builder_${randomUUID()}`,
    conversationId: null,
    projectId: workspace.projectId,
    mode: "plan",
    metadata: {
      workspaceId: input.workspaceId,
      selectedElement: selection,
      preview,
      files: activeFiles.map((file) => ({ path: file.path, kind: file.kind, contentHash: file.contentHash, isSecret: file.isSecret })),
    },
  });
  const planned = previewPatch(preview, input.prompt, selection);
  const patches = [liveBuilderFilePatchSchema.parse({
    path: PREVIEW_FILE_PATH,
    operation: "modify",
    kind: "manifest",
    content: JSON.stringify(planned.document, null, 2),
    summary: planned.summary,
  })];
  const id = randomUUID();
  const requiresApproval = requiresChangeApproval(patches);
  const change = {
    id,
    workspaceId: input.workspaceId,
    runId: aiRun.runId,
    taskId: aiRun.taskId,
    sequence: await nextChangeSequence(input.workspaceId),
    prompt: input.prompt.trim(),
    selectedElement: selection,
    summary: planned.summary,
    rationale: selection ? `The proposal is scoped to ${selection.filePath} and the selected ${selection.label}.` : "The proposal only updates the controlled preview manifest and does not execute generated source code.",
    patches,
    status: requiresApproval ? "awaiting_approval" as const : "proposed" as const,
    requiresApproval,
  };
  await db.insert(liveBuilderChangeSets).values(change);
  const row = (await db.select().from(liveBuilderChangeSets).where(eq(liveBuilderChangeSets.id, id)).limit(1))[0];
  if (!row) throw new Error("The proposed change could not be persisted.");
  return liveBuilderChangeSetSchema.parse({ ...change, createdAt: toDateString(row.createdAt), updatedAt: toDateString(row.updatedAt) });
}

export async function proposeLiveBuilderFileChange(userId: number, input: { workspaceId: string; filePath: string; content: string; summary?: string | null }) {
  const workspace = await getOwnedWorkspace(userId, input.workspaceId);
  if (!workspace) throw new Error("The requested workspace is unavailable or does not belong to this account.");
  const db = await getDb();
  if (!db) throw new Error("Persistent project storage is temporarily unavailable.");
  const activeFiles = await listActiveFiles(input.workspaceId);
  const file = activeFiles.find((candidate) => candidate.path === input.filePath);
  if (!file) throw new Error("The requested file is not part of this workspace.");
  const patch = assertSafePatch(liveBuilderFilePatchSchema.parse({
    path: file.path,
    operation: "modify",
    kind: file.kind,
    content: input.content,
    summary: input.summary?.trim() || `Update ${file.path}`,
  }));
  const aiRun = await submitGatewayRequest(userId, {
    message: `Live Builder file edit proposal for ${file.path}`,
    requestId: `live_builder_file_${randomUUID()}`,
    conversationId: null,
    projectId: workspace.projectId,
    mode: "plan",
    metadata: {
      workspaceId: input.workspaceId,
      filePath: file.path,
      contentHash: hash(input.content),
      existingContentHash: file.contentHash,
    },
  });
  const id = randomUUID();
  const change = {
    id,
    workspaceId: input.workspaceId,
    runId: aiRun.runId,
    taskId: aiRun.taskId,
    sequence: await nextChangeSequence(input.workspaceId),
    prompt: `Edit ${file.path}`,
    selectedElement: asSelection(workspace.selectedElement),
    summary: patch.summary,
    rationale: "The file edit is isolated to an existing workspace file and remains reviewable before application.",
    patches: [patch],
    status: "awaiting_approval" as const,
    requiresApproval: true,
  };
  await db.insert(liveBuilderChangeSets).values(change);
  const row = (await db.select().from(liveBuilderChangeSets).where(eq(liveBuilderChangeSets.id, id)).limit(1))[0];
  if (!row) throw new Error("The file edit proposal could not be persisted.");
  return liveBuilderChangeSetSchema.parse({ ...change, createdAt: toDateString(row.createdAt), updatedAt: toDateString(row.updatedAt) });
}

export async function applyLiveBuilderChangeSet(userId: number, workspaceId: string, changeSetId: string) {
  const workspace = await getOwnedWorkspace(userId, workspaceId);
  if (!workspace) throw new Error("The requested workspace is unavailable or does not belong to this account.");
  const db = await getDb();
  if (!db) throw new Error("Persistent project storage is temporarily unavailable.");
  const change = (await db.select().from(liveBuilderChangeSets).where(and(eq(liveBuilderChangeSets.id, changeSetId), eq(liveBuilderChangeSets.workspaceId, workspaceId))).limit(1))[0];
  if (!change) throw new Error("The proposed change no longer exists.");
  if (!["proposed", "awaiting_approval"].includes(change.status)) throw new Error("Only a pending Live Builder change can be applied.");
  const patches = (Array.isArray(change.patches) ? change.patches : []).map((patch) => assertSafePatch(liveBuilderFilePatchSchema.parse(patch)));
  let nextPreview = asPreviewDocument(workspace.previewDocument, defaultPreview("Untitled project", null));
  for (const patch of patches) {
    if (patch.path === PREVIEW_FILE_PATH && patch.content) nextPreview = liveBuilderPreviewDocumentSchema.parse(JSON.parse(patch.content));
    const existing = (await db.select().from(liveBuilderFiles).where(and(eq(liveBuilderFiles.workspaceId, workspaceId), eq(liveBuilderFiles.path, patch.path))).limit(1))[0];
    if (patch.operation === "delete") {
      if (existing) await db.update(liveBuilderFiles).set({ status: "deleted", updatedAt: new Date() }).where(eq(liveBuilderFiles.id, existing.id));
      continue;
    }
    if (existing) {
      await db.update(liveBuilderFiles).set({ kind: patch.kind, content: patch.content, contentHash: hash(patch.content), isSecret: false, status: "active", updatedAt: new Date() }).where(eq(liveBuilderFiles.id, existing.id));
    } else {
      await db.insert(liveBuilderFiles).values({ id: randomUUID(), workspaceId, path: patch.path, kind: patch.kind, content: patch.content, contentHash: hash(patch.content), isSecret: false, status: "active" });
    }
  }
  await db.update(liveBuilderChangeSets).set({ status: "applied", updatedAt: new Date() }).where(eq(liveBuilderChangeSets.id, changeSetId));
  await db.update(liveBuilderWorkspaces).set({ previewDocument: nextPreview, selectedElement: null, updatedAt: new Date() }).where(eq(liveBuilderWorkspaces.id, workspaceId));
  const version = await createVersion(workspaceId, `Change ${change.sequence}: ${change.summary.slice(0, 180)}`, changeSetId, nextPreview);
  return { changeSetId, version, preview: nextPreview };
}

export async function restoreLiveBuilderVersion(userId: number, workspaceId: string, versionId: string) {
  const workspace = await getOwnedWorkspace(userId, workspaceId);
  if (!workspace) throw new Error("The requested workspace is unavailable or does not belong to this account.");
  const db = await getDb();
  if (!db) throw new Error("Persistent project storage is temporarily unavailable.");
  const version = (await db.select().from(liveBuilderVersions).where(and(eq(liveBuilderVersions.id, versionId), eq(liveBuilderVersions.workspaceId, workspaceId))).limit(1))[0];
  if (!version) throw new Error("The requested project version is unavailable.");
  const manifest = asManifest(version.manifest);
  const current = await listActiveFiles(workspaceId);
  const wanted = new Set(manifest.files.filter((file) => file.status === "active").map((file) => file.path));
  for (const file of current) {
    if (!wanted.has(file.path)) await db.update(liveBuilderFiles).set({ status: "deleted", updatedAt: new Date() }).where(eq(liveBuilderFiles.id, file.id));
  }
  for (const file of manifest.files) {
    if (file.status !== "active") continue;
    const existing = (await db.select().from(liveBuilderFiles).where(and(eq(liveBuilderFiles.workspaceId, workspaceId), eq(liveBuilderFiles.path, file.path))).limit(1))[0];
    if (existing) {
      await db.update(liveBuilderFiles).set({ kind: file.kind, content: file.isSecret ? null : file.content, contentHash: file.contentHash, isSecret: file.isSecret, status: "active", updatedAt: new Date() }).where(eq(liveBuilderFiles.id, existing.id));
    } else {
      await db.insert(liveBuilderFiles).values({ id: randomUUID(), workspaceId, path: file.path, kind: file.kind, content: file.isSecret ? null : file.content, contentHash: file.contentHash, isSecret: file.isSecret, status: "active" });
    }
  }
  const preview = asPreviewDocument(version.previewDocument, defaultPreview("Untitled project", null));
  await db.update(liveBuilderWorkspaces).set({ previewDocument: preview, selectedElement: null, updatedAt: new Date() }).where(eq(liveBuilderWorkspaces.id, workspaceId));
  await createVersion(workspaceId, `Restored version ${version.number}`, null, preview);
  return { restoredVersionId: version.id, preview };
}

export async function startLiveBuilderPreview(userId: number, workspaceId: string, target: PreviewTarget, requestedEngine: "controlled_canvas" | "external_runner" = "controlled_canvas") {
  const workspace = await getOwnedWorkspace(userId, workspaceId);
  if (!workspace) throw new Error("The requested workspace is unavailable or does not belong to this account.");
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
  if (!workspace) throw new Error("The requested workspace is unavailable or does not belong to this account.");
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

export async function requestLiveBuilderDeployment(userId: number, workspaceId: string, versionId: string, releaseNotes?: string | null) {
  const workspace = await getOwnedWorkspace(userId, workspaceId);
  if (!workspace) throw new Error("The requested workspace is unavailable or does not belong to this account.");
  const db = await getDb();
  if (!db) throw new Error("Persistent project storage is temporarily unavailable.");
  const version = (await db.select().from(liveBuilderVersions).where(and(eq(liveBuilderVersions.id, versionId), eq(liveBuilderVersions.workspaceId, workspaceId))).limit(1))[0];
  if (!version) throw new Error("Choose a valid workspace version before requesting deployment.");
  const id = randomUUID();
  await db.insert(liveBuilderDeploymentReviews).values({ id, workspaceId, versionId, taskId: null, provider: null, status: "awaiting_approval", releaseNotes: releaseNotes ?? null });
  return { id, workspaceId, versionId, status: "awaiting_approval" as const, provider: null, message: "Deployment requires user approval and a configured deployment provider. No external deployment has been started." };
}

export const LIVE_BUILDER_PREVIEW_DIMENSIONS = PREVIEW_DIMENSIONS;

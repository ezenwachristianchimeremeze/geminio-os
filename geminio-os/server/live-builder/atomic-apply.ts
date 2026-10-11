import { createHash, randomUUID } from "node:crypto";

/**
 * Atomic change-set application for Live Builder.
 *
 * WHAT IS ATOMIC, AND WHY
 * A Live Builder workspace is NOT a directory on the server's disk. Its files,
 * versions, preview document and change-set status are all rows in one MySQL
 * database (liveBuilderFiles / liveBuilderVersions / liveBuilderWorkspaces /
 * liveBuilderChangeSets). So a single InnoDB transaction covers every mutation,
 * and "all or nothing" is a property of the database, not something emulated.
 * If a future feature mirrors workspace files onto a filesystem or an external
 * runner, that mirror is NOT covered by this transaction and must be driven
 * from the committed state (outbox/reconciliation) — never from inside it.
 *
 * ORDER OF OPERATIONS
 *   1. Inside the transaction, lock the workspace row (SELECT ... FOR UPDATE):
 *      applies to one workspace are serialised, so there is no read-modify-write race.
 *   2. Re-verify ownership under the lock, load the change set, check its state.
 *   3. Validate EVERYTHING (paths, content, operations against current files,
 *      base hashes) and build the complete plan. Nothing is written yet.
 *   4. Write the files, compare-and-set the change set to "applied", update the
 *      preview, create the version, write the success audit event.
 *   5. Commit. Any exception (including an AbortSignal) rolls everything back.
 *   6. Only AFTER a rollback, outside the transaction, record the failure and
 *      (for permanent failures) mark the change set "failed". The change set
 *      row, its patches and the audit trail are never deleted.
 */

// ---------------------------------------------------------------- types ----

export const FILE_KINDS = ["page", "component", "asset", "api", "database", "config", "environment", "manifest"] as const;
export type FileKind = (typeof FILE_KINDS)[number];
export type FileOperation = "add" | "modify" | "delete";
export type ChangeStatus = "proposed" | "awaiting_approval" | "applied" | "reverted" | "rejected" | "failed";

export type StoredFile = { id: string; path: string; kind: FileKind; content: string | null; contentHash: string | null; isSecret: boolean; status: "active" | "deleted" };
export type StoredChange = { id: string; workspaceId: string; sequence: number; summary: string; patches: unknown; status: ChangeStatus; requiresApproval: boolean };
export type StoredWorkspace = { id: string; userId: number; previewDocument: unknown };
export type StoredVersion = { id: string; number: number; changeSetId: string | null; label: string; manifest: unknown; previewDocument: unknown };

export type AuditEvent = { userId: number | null; action: string; resource: string; status: "success" | "warning" | "error"; details: Record<string, unknown> };

/** Everything the apply logic may do inside a transaction. */
export interface ApplyTx {
  /** SELECT ... FOR UPDATE on the workspace row. */
  lockWorkspace(workspaceId: string): Promise<StoredWorkspace | null>;
  getChange(workspaceId: string, changeSetId: string): Promise<StoredChange | null>;
  getVersionForChange(workspaceId: string, changeSetId: string): Promise<StoredVersion | null>;
  listFiles(workspaceId: string): Promise<StoredFile[]>; // active AND deleted
  listVersions(workspaceId: string): Promise<StoredVersion[]>; // newest first
  insertFile(workspaceId: string, file: Omit<StoredFile, "status"> & { status: "active" }): Promise<void>;
  updateFile(fileId: string, patch: Partial<Pick<StoredFile, "kind" | "content" | "contentHash" | "isSecret" | "status">>): Promise<void>;
  /** Compare-and-set. Returns true only if the row was in one of `from` and is now `to`. */
  transitionChange(changeSetId: string, from: ChangeStatus[], to: ChangeStatus): Promise<boolean>;
  setWorkspacePreview(workspaceId: string, preview: unknown): Promise<void>;
  nextVersionNumber(workspaceId: string): Promise<number>;
  insertVersion(workspaceId: string, version: StoredVersion): Promise<void>;
  insertAudit(event: AuditEvent): Promise<void>;
}

export interface ApplyStore {
  /** Runs `fn` in one database transaction: commit if it resolves, roll back if it throws. */
  transaction<T>(fn: (tx: ApplyTx) => Promise<T>): Promise<T>;
  /** Outside any transaction (used after a rollback). */
  transitionChange(changeSetId: string, from: ChangeStatus[], to: ChangeStatus): Promise<boolean>;
  recordAudit(event: AuditEvent): Promise<void>;
}

// --------------------------------------------------------------- errors ----

export type ApplyErrorCode =
  | "WORKSPACE_UNAVAILABLE" | "CHANGE_NOT_FOUND" | "NOT_APPLICABLE" | "EMPTY" | "INVALID" | "UNSAFE_PATH"
  | "INVALID_CONTENT" | "LIMIT_EXCEEDED" | "STALE" | "CONFLICT" | "CANCELLED";

export class ChangeSetError extends Error {
  /** Permanent failures can never succeed on retry; the change set is marked "failed". */
  constructor(readonly code: ApplyErrorCode, message: string, readonly problems: string[] = [], readonly permanent = false) {
    super(message);
    this.name = "ChangeSetError";
  }
}

// --------------------------------------------------------------- limits ----

export const LIMITS = { maxPatches: 200, maxFileBytes: 250_000, maxTotalBytes: 2_000_000, maxPathLength: 512, maxSegmentLength: 255 } as const;
export const PREVIEW_FILE_PATH = ".geminio/live-preview.json";

const RAW_CREDENTIAL = /(?:api[-_]?key|secret|password|access[-_]?token)\s*[:=]\s*["'][^"'$]{8,}/i;

export function sha256(content: string | null): string {
  return createHash("sha256").update(content ?? "").digest("hex");
}

// ----------------------------------------------------------- validation ----

/** Canonical form of a workspace path. Throws ChangeSetError(UNSAFE_PATH). */
export function normalizeWorkspacePath(raw: unknown): string {
  if (typeof raw !== "string") throw new ChangeSetError("UNSAFE_PATH", "A file path must be a string.", [], true);
  if (raw.length === 0 || raw.length > LIMITS.maxPathLength) throw new ChangeSetError("UNSAFE_PATH", `A file path must be 1-${LIMITS.maxPathLength} characters.`, [], true);
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) throw new ChangeSetError("UNSAFE_PATH", "File paths may not contain control characters.", [raw.slice(0, 80)], true);
  const p = raw.replace(/\\/g, "/");
  if (p.startsWith("/") || /^[a-zA-Z]:/.test(p)) throw new ChangeSetError("UNSAFE_PATH", `Absolute paths are not allowed: ${raw}`, [], true);
  const segments = p.split("/");
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") throw new ChangeSetError("UNSAFE_PATH", `Path traversal or empty segments are not allowed: ${raw}`, [], true);
    if (seg.length > LIMITS.maxSegmentLength) throw new ChangeSetError("UNSAFE_PATH", `A path segment is too long: ${raw.slice(0, 80)}`, [], true);
    if (/^\.env(\.|$)/i.test(seg)) throw new ChangeSetError("UNSAFE_PATH", `Environment files are managed through secure project settings: ${raw}`, [], true);
    if (seg.toLowerCase() === ".git" || seg.toLowerCase() === "node_modules") throw new ChangeSetError("UNSAFE_PATH", `Path is not allowed in a workspace: ${raw}`, [], true);
  }
  return segments.join("/");
}

export type PreparedOp =
  | { op: "add"; path: string; kind: FileKind; content: string; contentHash: string; existingId: string | null }
  | { op: "modify"; path: string; kind: FileKind; content: string; contentHash: string; existingId: string }
  | { op: "delete"; path: string; existingId: string };

export type ValidationContext = {
  files: StoredFile[];
  /** Validates and returns the parsed preview document for PREVIEW_FILE_PATH content, or throws. */
  parsePreview?: (content: string) => unknown;
};
export type Plan = { ops: PreparedOp[]; preview: { document: unknown } | null; totalBytes: number; staleCheck: "verified" | "partial" };

const bytes = (s: string) => Buffer.byteLength(s, "utf8");

/**
 * Pure and side-effect free. Throws ChangeSetError listing EVERY problem found
 * (not just the first) so the user can fix a proposal in one pass.
 */
export function planChangeSet(rawPatches: unknown, ctx: ValidationContext): Plan {
  if (!Array.isArray(rawPatches)) throw new ChangeSetError("INVALID", "The change set has no valid list of file operations.", [], true);
  if (rawPatches.length === 0) throw new ChangeSetError("EMPTY", "The change set contains no file operations.", [], true);
  if (rawPatches.length > LIMITS.maxPatches) throw new ChangeSetError("LIMIT_EXCEEDED", `A change set may contain at most ${LIMITS.maxPatches} operations.`, [], true);

  const byLowerPath = new Map<string, StoredFile>();
  for (const f of ctx.files) {
    const k = f.path.toLowerCase();
    const prior = byLowerPath.get(k);
    if (!prior || (prior.status === "deleted" && f.status === "active")) byLowerPath.set(k, f);
  }

  const problems: string[] = [];
  const fatal: ChangeSetError[] = [];
  const seen = new Set<string>();
  const ops: PreparedOp[] = [];
  let total = 0;
  let previewDoc: { document: unknown } | null = null;
  let staleVerified = true;
  let stale = false;

  rawPatches.forEach((raw, index) => {
    const label = `operation ${index + 1}`;
    if (!raw || typeof raw !== "object") { problems.push(`${label}: not an object`); return; }
    const p = raw as Record<string, unknown>;
    const operation = p.operation;
    if (operation !== "add" && operation !== "modify" && operation !== "delete") { problems.push(`${label}: unknown operation "${String(operation)}"`); return; }
    if (typeof p.kind !== "string" || !(FILE_KINDS as readonly string[]).includes(p.kind)) { problems.push(`${label}: unknown file kind "${String(p.kind)}"`); return; }
    const kind = p.kind as FileKind;
    if (kind === "environment") { problems.push(`${label}: environment values cannot be edited in the workspace`); return; }

    let path: string;
    try { path = normalizeWorkspacePath(p.path); } catch (e) {
      if (e instanceof ChangeSetError) { fatal.push(e); problems.push(`${label}: ${e.message}`); } else problems.push(`${label}: invalid path`);
      return;
    }
    const lower = path.toLowerCase();
    if (seen.has(lower)) { problems.push(`${label}: duplicate path (case-insensitive) ${path}`); return; }
    seen.add(lower);

    const existing = byLowerPath.get(lower);
    const active = existing && existing.status === "active" ? existing : null;
    if (existing && existing.path !== path && existing.status === "active") {
      problems.push(`${label}: ${path} differs only by letter case from existing ${existing.path}`);
      return;
    }
    if (active?.isSecret) { problems.push(`${label}: ${path} is a secret file and cannot be changed here`); return; }

    // Base-hash check = the change set's version check against the workspace it was proposed from.
    const baseHash = p.baseHash;
    if (baseHash !== undefined && baseHash !== null && typeof baseHash !== "string") { problems.push(`${label}: baseHash must be a string`); return; }

    if (operation === "delete") {
      if (!active) { problems.push(`${label}: cannot delete ${path}; it does not exist`); stale = true; return; }
      if (typeof baseHash === "string") { if (baseHash !== (active.contentHash ?? sha256(active.content))) { problems.push(`${label}: ${path} changed after this proposal was made`); stale = true; return; } } else staleVerified = false;
      ops.push({ op: "delete", path, existingId: active.id });
      return;
    }

    const content = p.content;
    if (typeof content !== "string") { problems.push(`${label}: ${operation} requires string content for ${path}`); return; }
    // eslint-disable-next-line no-control-regex
    if (/\u0000/.test(content)) { problems.push(`${label}: ${path} contains a NUL byte`); return; }
    const size = bytes(content);
    if (size > LIMITS.maxFileBytes) { problems.push(`${label}: ${path} is ${size} bytes; the limit is ${LIMITS.maxFileBytes}`); return; }
    if (RAW_CREDENTIAL.test(content)) { problems.push(`${label}: ${path} appears to contain a raw credential`); return; }
    total += size;

    if (path === PREVIEW_FILE_PATH) {
      try {
        previewDoc = { document: ctx.parsePreview ? ctx.parsePreview(content) : JSON.parse(content) };
      } catch (e) {
        problems.push(`${label}: ${path} is not a valid preview document (${e instanceof Error ? e.message.slice(0, 120) : "parse error"})`);
        return;
      }
    }

    if (operation === "add") {
      if (active) { problems.push(`${label}: cannot add ${path}; it already exists`); stale = true; return; }
      if (typeof baseHash === "string") { problems.push(`${label}: an add operation cannot have a base hash`); return; }
      ops.push({ op: "add", path, kind, content, contentHash: sha256(content), existingId: existing?.id ?? null });
      return;
    }
    // modify
    if (!active) { problems.push(`${label}: cannot modify ${path}; it does not exist`); stale = true; return; }
    if (typeof baseHash === "string") { if (baseHash !== (active.contentHash ?? sha256(active.content))) { problems.push(`${label}: ${path} changed after this proposal was made`); stale = true; return; } } else staleVerified = false;
    ops.push({ op: "modify", path, kind, content, contentHash: sha256(content), existingId: active.id });
  });

  if (total > LIMITS.maxTotalBytes) problems.push(`total content is ${total} bytes; the limit is ${LIMITS.maxTotalBytes}`);

  if (problems.length > 0) {
    if (fatal.length > 0) throw new ChangeSetError(fatal[0].code, `The change set was rejected: ${fatal[0].message}`, problems, true);
    if (stale) throw new ChangeSetError("STALE", "The workspace changed after this change was proposed. Propose the change again from the current files.", problems, true);
    throw new ChangeSetError("INVALID", `The change set failed validation (${problems.length} problem${problems.length === 1 ? "" : "s"}).`, problems, true);
  }
  return { ops, preview: previewDoc, totalBytes: total, staleCheck: staleVerified ? "verified" : "partial" };
}

// ---------------------------------------------------------------- apply ----

export type ApplyInput = { userId: number; workspaceId: string; changeSetId: string; signal?: AbortSignal; parsePreview?: ValidationContext["parsePreview"]; newId?: () => string };
export type ApplyResult = {
  changeSetId: string;
  alreadyApplied: boolean;
  version: { id: string; number: number } | null;
  preview: unknown;
  filesChanged: { added: number; modified: number; deleted: number };
  staleCheck: Plan["staleCheck"] | "not_repeated";
};

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new ChangeSetError("CANCELLED", "The apply operation was cancelled before it was committed. No files were changed.");
}

function buildManifest(files: StoredFile[]) {
  return { files: files.filter((f) => f.status === "active").map((f) => ({ path: f.path, kind: f.kind, content: f.isSecret ? null : f.content, contentHash: f.contentHash, isSecret: f.isSecret, status: f.status })) };
}

export async function applyChangeSet(store: ApplyStore, input: ApplyInput): Promise<ApplyResult> {
  const newId = input.newId ?? randomUUID;
  try {
    return await store.transaction(async (tx) => {
      const ws = await tx.lockWorkspace(input.workspaceId);
      // Ownership is re-verified UNDER the lock so it cannot change between check and use.
      if (!ws || ws.userId !== input.userId) throw new ChangeSetError("WORKSPACE_UNAVAILABLE", "The requested workspace is unavailable or does not belong to this account.");
      const change = await tx.getChange(input.workspaceId, input.changeSetId);
      if (!change) throw new ChangeSetError("CHANGE_NOT_FOUND", "The proposed change no longer exists.");

      if (change.status === "applied") {
        // Idempotent: a retry (or the loser of a race) gets the original result and writes nothing.
        const version = await tx.getVersionForChange(input.workspaceId, input.changeSetId);
        return { changeSetId: change.id, alreadyApplied: true, version: version ? { id: version.id, number: version.number } : null, preview: ws.previewDocument, filesChanged: { added: 0, modified: 0, deleted: 0 }, staleCheck: "not_repeated" as const };
      }
      // Approval state: an approval-gated change must be awaiting_approval; "proposed" is only
      // appliable when it never required approval.
      const appliable = change.status === "awaiting_approval" || (change.status === "proposed" && change.requiresApproval === false);
      if (!appliable) throw new ChangeSetError("NOT_APPLICABLE", `A change in state "${change.status}" cannot be applied.`);

      const files = await tx.listFiles(input.workspaceId);
      const plan = planChangeSet(change.patches, { files, parsePreview: input.parsePreview }); // throws before any write
      throwIfAborted(input.signal);

      const counts = { added: 0, modified: 0, deleted: 0 };
      for (const op of plan.ops) {
        if (op.op === "delete") { await tx.updateFile(op.existingId, { status: "deleted" }); counts.deleted += 1; }
        else if (op.op === "modify") { await tx.updateFile(op.existingId, { kind: op.kind, content: op.content, contentHash: op.contentHash, isSecret: false, status: "active" }); counts.modified += 1; }
        else if (op.existingId) { await tx.updateFile(op.existingId, { kind: op.kind, content: op.content, contentHash: op.contentHash, isSecret: false, status: "active" }); counts.added += 1; }
        else { await tx.insertFile(input.workspaceId, { id: newId(), path: op.path, kind: op.kind, content: op.content, contentHash: op.contentHash, isSecret: false, status: "active" }); counts.added += 1; }
      }

      const won = await tx.transitionChange(change.id, ["awaiting_approval", "proposed"], "applied");
      if (!won) throw new ChangeSetError("CONFLICT", "This change was applied, rejected or modified by another request. Nothing was changed.");

      const nextPreview = plan.preview ? plan.preview.document : ws.previewDocument;
      if (plan.preview) await tx.setWorkspacePreview(input.workspaceId, nextPreview);

      const after = await tx.listFiles(input.workspaceId);
      const number = await tx.nextVersionNumber(input.workspaceId);
      const version = { id: newId(), number, changeSetId: change.id, label: `Change ${change.sequence}: ${change.summary.slice(0, 180)}`, manifest: buildManifest(after), previewDocument: nextPreview };
      await tx.insertVersion(input.workspaceId, version);
      await tx.insertAudit({ userId: input.userId, action: "live_builder.change_set.applied", resource: change.id, status: "success", details: { workspaceId: input.workspaceId, versionId: version.id, versionNumber: number, ...counts, totalBytes: plan.totalBytes, staleCheck: plan.staleCheck } });

      throwIfAborted(input.signal); // last chance to abort: throwing here rolls the whole transaction back
      return { changeSetId: change.id, alreadyApplied: false, version: { id: version.id, number }, preview: nextPreview, filesChanged: counts, staleCheck: plan.staleCheck };
    });
  } catch (error) {
    await recordApplyFailure(store, input, error);
    throw error;
  }
}

/** Runs AFTER the transaction has rolled back. Never throws (a logging failure must not mask the real error). */
async function recordApplyFailure(store: ApplyStore, input: ApplyInput, error: unknown) {
  const err = error instanceof ChangeSetError ? error : null;
  try {
    if (err?.permanent && err.code !== "WORKSPACE_UNAVAILABLE" && err.code !== "CHANGE_NOT_FOUND") {
      // Permanent: retrying can never succeed (invalid or stale). Preserve the row, mark it failed.
      await store.transitionChange(input.changeSetId, ["awaiting_approval", "proposed"], "failed");
    }
    await store.recordAudit({
      userId: input.userId,
      action: "live_builder.change_set.apply_failed",
      resource: input.changeSetId,
      status: err?.code === "CANCELLED" || err?.code === "CONFLICT" ? "warning" : "error",
      details: { workspaceId: input.workspaceId, code: err?.code ?? "INTERNAL", message: (error instanceof Error ? error.message : String(error)).slice(0, 500), problems: (err?.problems ?? []).slice(0, 20), permanent: err?.permanent ?? false, workspaceModified: false },
    });
  } catch { /* swallow: see doc comment */ }
}

// --------------------------------------------------------------- reject ----

/** Cancel a pending change set before it is applied. Loses cleanly to a concurrent apply. */
export async function rejectChangeSet(store: ApplyStore, input: { userId: number; workspaceId: string; changeSetId: string }) {
  return store.transaction(async (tx) => {
    const ws = await tx.lockWorkspace(input.workspaceId);
    if (!ws || ws.userId !== input.userId) throw new ChangeSetError("WORKSPACE_UNAVAILABLE", "The requested workspace is unavailable or does not belong to this account.");
    const change = await tx.getChange(input.workspaceId, input.changeSetId);
    if (!change) throw new ChangeSetError("CHANGE_NOT_FOUND", "The proposed change no longer exists.");
    if (change.status === "rejected") return { changeSetId: change.id, status: "rejected" as const, alreadyRejected: true };
    if (change.status === "applied") throw new ChangeSetError("CONFLICT", "This change has already been applied. Restore a previous version to undo it.");
    const ok = await tx.transitionChange(change.id, ["awaiting_approval", "proposed", "failed"], "rejected");
    if (!ok) throw new ChangeSetError("CONFLICT", "This change can no longer be rejected.");
    await tx.insertAudit({ userId: input.userId, action: "live_builder.change_set.rejected", resource: change.id, status: "success", details: { workspaceId: input.workspaceId, previousStatus: change.status } });
    return { changeSetId: change.id, status: "rejected" as const, alreadyRejected: false };
  });
}

// ------------------------------------------------- restore and recovery ----

export type Drift = { path: string; reason: "missing" | "unexpected" | "content_differs" | "kind_differs" };
export type IntegrityReport = {
  workspaceId: string;
  latestVersion: { id: string; number: number } | null;
  appliedWithoutVersion: string[]; // applied change sets with no version row (only possible from pre-atomic partial failures)
  drift: Drift[];
  consistent: boolean;
};

function manifestFiles(manifest: unknown): { path: string; kind: FileKind; content: string | null; contentHash: string | null; isSecret: boolean }[] {
  const files = (manifest as { files?: unknown })?.files;
  if (!Array.isArray(files)) return [];
  return files.filter((f) => f && f.status !== "deleted") as never;
}

export function diffAgainstManifest(current: StoredFile[], manifest: unknown): Drift[] {
  const want = new Map(manifestFiles(manifest).map((f) => [f.path, f]));
  const have = new Map(current.filter((f) => f.status === "active").map((f) => [f.path, f]));
  const drift: Drift[] = [];
  for (const [path, w] of want) {
    const h = have.get(path);
    if (!h) { drift.push({ path, reason: "missing" }); continue; }
    if (h.kind !== w.kind) drift.push({ path, reason: "kind_differs" });
    else if (!h.isSecret && (h.contentHash ?? sha256(h.content)) !== (w.contentHash ?? sha256(w.content))) drift.push({ path, reason: "content_differs" });
  }
  for (const path of have.keys()) if (!want.has(path)) drift.push({ path, reason: "unexpected" });
  return drift.sort((a, b) => a.path.localeCompare(b.path));
}

/** Read-only. Detects state that an interrupted or pre-atomic apply could have left behind. */
export async function verifyWorkspaceIntegrity(store: ApplyStore, input: { userId: number; workspaceId: string; appliedChangeIds: string[] }): Promise<IntegrityReport> {
  return store.transaction(async (tx) => {
    const ws = await tx.lockWorkspace(input.workspaceId);
    if (!ws || ws.userId !== input.userId) throw new ChangeSetError("WORKSPACE_UNAVAILABLE", "The requested workspace is unavailable or does not belong to this account.");
    const versions = await tx.listVersions(input.workspaceId);
    const latest = versions[0] ?? null;
    const covered = new Set(versions.map((v) => v.changeSetId).filter(Boolean));
    const appliedWithoutVersion = input.appliedChangeIds.filter((id) => !covered.has(id));
    const drift = latest ? diffAgainstManifest(await tx.listFiles(input.workspaceId), latest.manifest) : [];
    return { workspaceId: input.workspaceId, latestVersion: latest ? { id: latest.id, number: latest.number } : null, appliedWithoutVersion, drift, consistent: appliedWithoutVersion.length === 0 && drift.length === 0 };
  });
}

/** Make the workspace files exactly equal a version manifest. Used by restore and recovery. */
async function restoreManifestInTx(tx: ApplyTx, workspaceId: string, manifest: unknown, newId: () => string) {
  const current = await tx.listFiles(workspaceId);
  const wanted = manifestFiles(manifest);
  const wantedPaths = new Set(wanted.map((f) => f.path));
  let restored = 0, removed = 0;
  for (const f of current) if (f.status === "active" && !wantedPaths.has(f.path)) { await tx.updateFile(f.id, { status: "deleted" }); removed += 1; }
  const byPath = new Map(current.map((f) => [f.path, f]));
  for (const w of wanted) {
    const existing = byPath.get(w.path);
    const content = w.isSecret ? null : w.content;
    if (existing) { await tx.updateFile(existing.id, { kind: w.kind, content, contentHash: w.contentHash, isSecret: w.isSecret, status: "active" }); }
    else { await tx.insertFile(workspaceId, { id: newId(), path: w.path, kind: w.kind, content, contentHash: w.contentHash, isSecret: w.isSecret, status: "active" }); }
    restored += 1;
  }
  return { restored, removed };
}

/**
 * Atomic restore of a stored version (also the recovery action).
 * `mode: "version"` restores the given version; `"latest"` re-asserts the newest version
 * (repairs drift left by an interrupted/pre-atomic operation).
 */
export async function restoreWorkspaceVersion(store: ApplyStore, input: { userId: number; workspaceId: string; versionId?: string; reason?: string; signal?: AbortSignal; newId?: () => string }) {
  const newId = input.newId ?? randomUUID;
  try {
    return await store.transaction(async (tx) => {
      const ws = await tx.lockWorkspace(input.workspaceId);
      if (!ws || ws.userId !== input.userId) throw new ChangeSetError("WORKSPACE_UNAVAILABLE", "The requested workspace is unavailable or does not belong to this account.");
      const versions = await tx.listVersions(input.workspaceId);
      const target = input.versionId ? versions.find((v) => v.id === input.versionId) : versions[0];
      if (!target) throw new ChangeSetError("CHANGE_NOT_FOUND", "The requested project version is unavailable.");
      const counts = await restoreManifestInTx(tx, input.workspaceId, target.manifest, newId);
      throwIfAborted(input.signal);
      await tx.setWorkspacePreview(input.workspaceId, target.previewDocument);
      const after = await tx.listFiles(input.workspaceId);
      const number = await tx.nextVersionNumber(input.workspaceId);
      const version = { id: newId(), number, changeSetId: null, label: input.reason ?? `Restored version ${target.number}`, manifest: buildManifest(after), previewDocument: target.previewDocument };
      await tx.insertVersion(input.workspaceId, version);
      await tx.insertAudit({ userId: input.userId, action: "live_builder.version.restored", resource: target.id, status: "success", details: { workspaceId: input.workspaceId, restoredVersionNumber: target.number, newVersionNumber: number, ...counts, reason: input.reason ?? null } });
      return { restoredVersionId: target.id, version: { id: version.id, number }, preview: target.previewDocument, ...counts };
    });
  } catch (error) {
    try { await store.recordAudit({ userId: input.userId, action: "live_builder.version.restore_failed", resource: input.versionId ?? input.workspaceId, status: "error", details: { workspaceId: input.workspaceId, message: (error instanceof Error ? error.message : String(error)).slice(0, 500), workspaceModified: false } }); } catch { /* ignore */ }
    throw error;
  }
}

// ------------------------------------------------------ error mapping ----

export type TrpcLikeCode = "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "BAD_REQUEST" | "PRECONDITION_FAILED" | "CLIENT_CLOSED_REQUEST" | "INTERNAL_SERVER_ERROR";

/** Pure mapping so the router stays thin and this is testable without tRPC installed. */
export function changeSetErrorCode(error: unknown): TrpcLikeCode {
  if (!(error instanceof ChangeSetError)) return "INTERNAL_SERVER_ERROR";
  switch (error.code) {
    case "WORKSPACE_UNAVAILABLE": return "NOT_FOUND"; // do not reveal whether another tenant's workspace exists
    case "CHANGE_NOT_FOUND": return "NOT_FOUND";
    case "STALE":
    case "CONFLICT": return "CONFLICT";
    case "NOT_APPLICABLE": return "PRECONDITION_FAILED";
    case "CANCELLED": return "CLIENT_CLOSED_REQUEST";
    default: return "BAD_REQUEST"; // EMPTY, INVALID, UNSAFE_PATH, INVALID_CONTENT, LIMIT_EXCEEDED
  }
}

/**
 * AI-generated Live Builder edits: context building, prompt, and strict validation of the
 * model's proposal. Pure (no I/O). Everything the model returns is untrusted: it is parsed,
 * checked against the workspace's real files, scoped to the selection, and dry-run through the
 * same planChangeSet that the atomic apply uses. Nothing here falls back to a heuristic.
 */
import type { Message } from "../_core/llm";
import { parseModelJson } from "../../lib/ai-builder/llm-port";
import { ChangeSetError, PREVIEW_FILE_PATH, normalizeWorkspacePath, planChangeSet, sha256, type FileKind, type StoredFile } from "./atomic-apply";
import { inferKind } from "../ai-builder/generated-files";

export const EDIT_LIMITS = { contextBytes: 60_000, perFileBytes: 12_000, maxOperations: 25 } as const;

export type EditSelection = { elementId: string; label: string; filePath: string; componentName: string | null; properties: Record<string, unknown> };

export type EditContext = {
  prompt: string;
  selection: EditSelection | null;
  preview: unknown;
  files: { path: string; kind: string; contentHash: string | null; isSecret: boolean; content: string | null; truncated: boolean }[];
  omittedFiles: number;
};

const bytes = (s: string) => Buffer.byteLength(s, "utf8");

/** Bounded context. Secret-managed files are listed but their contents are NEVER included. */
export function buildEditContext(input: { prompt: string; selection: EditSelection | null; preview: unknown; files: StoredFile[] }): EditContext {
  const active = input.files.filter((f) => f.status === "active");
  const priority = (f: StoredFile) => (input.selection && f.path === input.selection.filePath ? 0 : f.path === PREVIEW_FILE_PATH ? 1 : 2);
  const ordered = [...active].sort((a, b) => priority(a) - priority(b) || a.path.localeCompare(b.path));
  let used = bytes(JSON.stringify(input.preview ?? null)) + bytes(input.prompt);
  let omitted = 0;
  const files = ordered.map((f) => {
    const meta = { path: f.path, kind: f.kind as string, contentHash: f.contentHash, isSecret: f.isSecret };
    if (f.isSecret || f.content === null) return { ...meta, content: null, truncated: false };
    const size = bytes(f.content);
    const allowed = Math.min(size, EDIT_LIMITS.perFileBytes);
    if (used + allowed > EDIT_LIMITS.contextBytes) { omitted += 1; return { ...meta, content: null, truncated: false }; }
    used += allowed;
    const truncated = size > EDIT_LIMITS.perFileBytes;
    return { ...meta, content: truncated ? f.content.slice(0, EDIT_LIMITS.perFileBytes) : f.content, truncated };
  });
  return { prompt: input.prompt, selection: input.selection, preview: input.preview, files, omittedFiles: omitted };
}

export const EDIT_SYSTEM_PROMPT = [
  "You are the Geminio OS Live Builder coding agent. You propose a minimal, reviewable change to ONE workspace.",
  "Respond with ONLY a JSON object (no prose, no markdown fences) of this exact shape:",
  '{"summary":"<=200 chars, imperative","rationale":"why this is the smallest correct change","operations":[{"operation":"add|modify|delete","path":"relative/path","content":"FULL new file content for add/modify, omit for delete","summary":"one line"}]}',
  "Rules: use only relative paths from the provided file list for modify/delete; modify must return the complete new file, not a diff;",
  "never touch .env files, never include credentials (reference environment variable names only);",
  "if a selected element is given, modify/delete ONLY its file (and the preview manifest if the visible preview must change);",
  "preserve unrelated code; if the request cannot be done safely, return an empty operations array and explain in rationale.",
  "Files marked isSecret have hidden contents and cannot be changed.",
].join("\n");

export function buildEditMessages(ctx: EditContext): Message[] {
  return [
    { role: "system", content: EDIT_SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({ request: ctx.prompt, selectedElement: ctx.selection, preview: ctx.preview, files: ctx.files, omittedFiles: ctx.omittedFiles }),
    },
  ];
}

export type ProposedPatch = {
  path: string;
  operation: "add" | "modify" | "delete";
  kind: Exclude<FileKind, "environment">;
  content: string | null;
  summary: string;
  baseHash: string | null;
};
export type EditProposal = { summary: string; rationale: string; patches: ProposedPatch[] };

type RawOp = { operation?: unknown; path?: unknown; content?: unknown; summary?: unknown };

/**
 * Validates the model output against reality. Throws ChangeSetError (permanent) listing every
 * problem. `parsePreview` lets the service plug in the real zod preview-document schema.
 */
export function parseEditProposal(text: string, files: StoredFile[], selection: EditSelection | null, parsePreview?: (content: string) => unknown): EditProposal {
  let raw: { summary?: unknown; rationale?: unknown; operations?: unknown };
  try { raw = parseModelJson(text); } catch (e) { throw new ChangeSetError("INVALID", e instanceof Error ? e.message : "The AI provider returned invalid output.", [], true); }
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.operations)) throw new ChangeSetError("INVALID", "The AI proposal has no operations list.", [], true);
  const summary = typeof raw.summary === "string" && raw.summary.trim() ? raw.summary.trim().slice(0, 4000) : "";
  const rationale = typeof raw.rationale === "string" ? raw.rationale.trim().slice(0, 4000) : "";
  if (raw.operations.length === 0) throw new ChangeSetError("EMPTY", rationale ? `The AI made no change: ${rationale.slice(0, 300)}` : "The AI proposed no change for this request.", [], true);
  if (raw.operations.length > EDIT_LIMITS.maxOperations) throw new ChangeSetError("LIMIT_EXCEEDED", `The AI proposed ${raw.operations.length} operations; the limit is ${EDIT_LIMITS.maxOperations}.`, [], true);
  if (!summary) throw new ChangeSetError("INVALID", "The AI proposal has no summary.", [], true);

  const active = new Map(files.filter((f) => f.status === "active").map((f) => [f.path.toLowerCase(), f]));
  const problems: string[] = [];
  const patches: ProposedPatch[] = [];
  (raw.operations as RawOp[]).forEach((op, i) => {
    const label = `operation ${i + 1}`;
    if (!op || typeof op !== "object") { problems.push(`${label}: not an object`); return; }
    if (op.operation !== "add" && op.operation !== "modify" && op.operation !== "delete") { problems.push(`${label}: unknown operation "${String(op.operation)}"`); return; }
    let path: string;
    try { path = normalizeWorkspacePath(op.path); } catch (e) { problems.push(`${label}: ${e instanceof Error ? e.message : "invalid path"}`); return; }
    const existing = active.get(path.toLowerCase());
    if (op.operation === "add" && existing) { problems.push(`${label}: cannot add ${path}; it already exists (use modify)`); return; }
    if (op.operation !== "add" && !existing) { problems.push(`${label}: cannot ${op.operation} ${path}; no such file in the workspace`); return; }
    if (existing && op.operation !== "add" && selection && existing.path !== selection.filePath && existing.path !== PREVIEW_FILE_PATH) {
      problems.push(`${label}: ${existing.path} is outside the selected element's scope (${selection.filePath})`);
      return;
    }
    if (op.operation !== "delete" && (typeof op.content !== "string" || op.content.trim() === "")) { problems.push(`${label}: ${op.operation} ${path} needs non-empty content`); return; }
    const kind = (existing ? existing.kind : path === PREVIEW_FILE_PATH ? "manifest" : inferKind(path)) as ProposedPatch["kind"];
    patches.push({
      path: existing ? existing.path : path,
      operation: op.operation,
      kind,
      content: op.operation === "delete" ? null : (op.content as string),
      summary: (typeof op.summary === "string" && op.summary.trim() ? op.summary.trim() : `${op.operation} ${path}`).slice(0, 1000),
      baseHash: existing ? existing.contentHash ?? sha256(existing.content) : null,
    });
  });
  if (problems.length) throw new ChangeSetError("INVALID", `The AI proposal failed validation (${problems.length} problem${problems.length === 1 ? "" : "s"}).`, problems, true);
  planChangeSet(patches, { files, parsePreview }); // the real apply validator, run now and again at apply time
  return { summary, rationale, patches };
}

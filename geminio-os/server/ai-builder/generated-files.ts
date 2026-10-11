/**
 * Turns AI-generated files into Live Builder patches.
 *
 * There is exactly ONE definition of "a safe workspace change": server/live-builder/atomic-apply.ts
 * (path policy, size/credential limits, base hashes, existence rules). This module does not
 * re-implement it; it only adapts model output to the patch shape and then dry-runs the real
 * `planChangeSet` so an invalid proposal is rejected (with every problem listed) BEFORE it is
 * stored — and is validated again, under the workspace lock, when it is applied.
 */
import { ChangeSetError, planChangeSet, sha256, normalizeWorkspacePath, type FileKind, type StoredFile } from "../live-builder/atomic-apply";

export type GeneratedFile = { path: string; content: string; summary?: string };

export type GeneratedPatch = {
  path: string;
  operation: "add" | "modify";
  kind: Exclude<FileKind, "environment">;
  content: string;
  summary: string;
  baseHash: string | null;
};

export const MAX_GENERATED_FILES = 50;

export function stripCodeFences(text: string): string {
  const m = /^\s*```[a-zA-Z0-9_+-]*\n([\s\S]*?)\n```\s*$/.exec(text);
  return m ? m[1] : text;
}

/** Maps a path to one of the Live Builder's file kinds (page | component | asset | api | database | config | manifest). */
export function inferKind(path: string): GeneratedPatch["kind"] {
  const p = path.toLowerCase();
  if (/(^|\/)(server|api|routers?)\//.test(p)) return "api";
  if (/(^|\/)(drizzle|migrations?)\//.test(p) || /(^|\/)schema\.[tj]s$/.test(p) || p.endsWith(".sql")) return "database";
  if (/(^|\/)(package\.json|tsconfig[^/]*\.json|app\.config\.[cm]?[tj]s|[^/]+\.config\.[cm]?[jt]s|\.eslintrc[^/]*)$/.test(p)) return "config";
  if (p === ".geminio/live-preview.json") return "manifest";
  if (/\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf)$/.test(p)) return "asset";
  if (/^app\/.+\.(tsx|jsx)$/.test(p) || /(^|\/)pages\//.test(p)) return "page";
  return "component";
}

/**
 * existingFiles: the workspace's CURRENT files (so modify/add and base hashes are exact).
 * Throws ChangeSetError listing every problem; never returns an unvalidated patch.
 */
export function buildGeneratedPatches(files: GeneratedFile[], existingFiles: StoredFile[]): GeneratedPatch[] {
  if (!Array.isArray(files) || files.length === 0) throw new ChangeSetError("EMPTY", "The AI provider produced no files.", [], true);
  if (files.length > MAX_GENERATED_FILES) throw new ChangeSetError("LIMIT_EXCEEDED", `The AI provider produced ${files.length} files; the limit is ${MAX_GENERATED_FILES} per change set.`, [], true);
  const active = new Map(existingFiles.filter((f) => f.status === "active").map((f) => [f.path.toLowerCase(), f]));
  const patches: GeneratedPatch[] = files.map((f, i) => {
    if (!f || typeof f !== "object" || typeof f.path !== "string" || typeof f.content !== "string") {
      throw new ChangeSetError("INVALID", `Generated file ${i + 1} must have a string path and string content.`, [], true);
    }
    const path = normalizeWorkspacePath(f.path); // throws UNSAFE_PATH
    const content = stripCodeFences(f.content);
    // A blank file from a model is almost always a generation failure (the planner itself allows empty files).
    if (!content.trim()) throw new ChangeSetError("INVALID", `The AI provider produced an empty file for ${path}.`, [], true);
    const current = active.get(path.toLowerCase());
    return {
      path: current ? current.path : path,
      operation: current ? "modify" : "add",
      kind: inferKind(path),
      content,
      summary: (f.summary?.trim() || `${current ? "Update" : "Create"} ${path}`).slice(0, 1000),
      baseHash: current ? current.contentHash ?? sha256(current.content) : null,
    };
  });
  planChangeSet(patches, { files: existingFiles }); // the real validator; throws with all problems
  return patches;
}

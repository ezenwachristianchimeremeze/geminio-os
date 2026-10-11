import { ChangeSetError } from "./atomic-apply";

/** A runtime/preview may only reference a version that belongs to the workspace being started (ids come from the client). */
export function assertVersionInWorkspace(versions: ReadonlyArray<{ id: string }>, versionId: string | null | undefined): void {
  if (!versionId) return;
  if (!versions.some((v) => v.id === versionId)) throw new ChangeSetError("CHANGE_NOT_FOUND", "Version not found in this workspace.");
}

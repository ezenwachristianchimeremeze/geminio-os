/**
 * Principal policy (OPEN-004).
 *
 * `sdk.authenticateRequest` can return a synthetic scheduled-task ("cron") principal with
 * `id = -1`. It is NOT a row in `users`, owns no data, and no procedure is written for it.
 * Before this guard it passed `protectedProcedure`, so a cron token could call every
 * user-facing procedure as user -1 (orphan writes, credit/quota paths keyed on -1, and the
 * token could even be turned into a 1-year browser cookie via /api/auth/session).
 *
 * Cron principals are therefore refused on every user-facing surface. A future cron-only
 * endpoint must opt in explicitly by calling `sdk.authenticateRequest` itself.
 */
export type MaybeCronPrincipal = { id: number; isCron?: boolean; taskUid?: string };

export function isCronPrincipal(u: MaybeCronPrincipal | null | undefined): boolean {
  return !!u && (u.isCron === true || typeof u.taskUid === "string" || !(Number.isInteger(u.id) && u.id > 0));
}

/** Returns the user only if it is a real, persisted interactive user; otherwise null. */
export function interactiveUserOrNull<T extends MaybeCronPrincipal>(u: T | null | undefined): T | null {
  return u && !isCronPrincipal(u) ? u : null;
}

export class CronPrincipalForbiddenError extends Error {
  constructor() {
    super("Scheduled-task credentials cannot be used on this endpoint.");
    this.name = "CronPrincipalForbiddenError";
  }
}

export function assertInteractiveUser<T extends MaybeCronPrincipal>(u: T): T {
  if (isCronPrincipal(u)) throw new CronPrincipalForbiddenError();
  return u;
}

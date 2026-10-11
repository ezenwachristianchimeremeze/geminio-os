/**
 * Central metering used by the AI Core orchestrator, so EVERY AI path (Home chat, Live Builder, AI Builder, legacy chat,
 * aiCore router) reserves before it runs and settles when the run ends. Pure over the CreditStore port.
 */
import { CreditError, finalizeReservation, priceFor, releaseReservation, reserveCredits, type CreditStore, type Reservation } from "./ledger";

type Env = Record<string, string | undefined>;
/** Enforcement can only be switched off outside production (dev/preview convenience); never in production. */
export function creditsEnforced(env: Env): boolean {
  return !(env.CREDITS_ENFORCEMENT === "off" && env.NODE_ENV !== "production");
}

export class InsufficientCreditsError extends Error {
  readonly code = "INSUFFICIENT_CREDITS" as const;
  constructor(readonly required: number, readonly available: number) { super("You don't have enough credits for this request. Nothing was run and nothing was charged."); this.name = "InsufficientCreditsError"; }
}

export type TerminalRun = { requestId: string; status: string; capability: string | null; plan?: unknown; result?: unknown };

export function completedStepsOf(run: Pick<TerminalRun, "status" | "plan">): number {
  const steps = (run.plan as { steps?: { status?: string }[] } | null | undefined)?.steps;
  if (!Array.isArray(steps)) return run.status === "completed" ? 1 : 0;
  return steps.filter((s) => s?.status === "completed").length;
}
const hasSources = (v: unknown) => Array.isArray((v as { sources?: unknown } | null | undefined)?.sources) && ((v as { sources: unknown[] }).sources.length > 0);

/** Reserve the full price of a plan up front. Idempotent per (user, requestId). Throws InsufficientCreditsError before anything runs. */
export async function reserveForRun(store: CreditStore, env: Env, input: { userId: number; requestId: string; capability: string; steps: number; id: string }): Promise<Reservation | null> {
  if (!creditsEnforced(env)) return null;
  const credits = priceFor(input.capability, env, {}).credits * Math.max(1, input.steps);
  try { return await reserveCredits(store, { userId: input.userId, requestId: input.requestId, capability: input.capability, credits, id: input.id }); }
  catch (e) { if (e instanceof CreditError && e.code === "INSUFFICIENT_CREDITS") throw new InsufficientCreditsError(e.details.required ?? credits, e.details.available ?? 0); throw e; }
}

/**
 * Settle a TERMINAL run: pay for completed steps only (+ web surcharge when sources were used), release the rest.
 * Idempotent; safe to call from the worker, from cancel, and from a polling read.
 */
export async function settleTerminalRun(store: CreditStore, env: Env, userId: number, run: TerminalRun, findReservation: (userId: number, requestId: string) => Promise<Reservation | null>): Promise<number | null> {
  if (!["completed", "failed", "cancelled"].includes(run.status)) return null;
  const reservation = await findReservation(userId, run.requestId);
  if (!reservation) return null;
  if (reservation.status === "finalized") return reservation.charged / 1_000_000;
  if (reservation.status === "released") return 0;
  const done = completedStepsOf(run);
  if (done === 0) { await releaseReservation(store, reservation.id); return 0; }
  const capability = run.capability ?? reservation.capability;
  const planSources = ((run.plan as { steps?: { status?: string; output?: unknown }[] } | null)?.steps ?? []).some((s) => s.status === "completed" && hasSources(s.output));
  const searched = hasSources((run.result as { output?: unknown } | null)?.output) || planSources;
  const unit = priceFor(capability, env, {}).credits;
  const surcharge = searched ? priceFor(capability, env, { webSearch: true }).credits - unit : 0;
  const charge = Math.min(unit * done + surcharge, reservation.amount / 1_000_000);
  return (await finalizeReservation(store, reservation.id, charge)).charged / 1_000_000;
}

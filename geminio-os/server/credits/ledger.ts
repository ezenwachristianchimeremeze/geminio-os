/**
 * Server-authoritative credit accounting: authorize -> price -> reserve -> execute -> finalize/release -> ledger.
 * Pure logic over a transactional port (same pattern as live-builder/atomic-apply). Amounts are integer
 * micro-credits internally so no floating-point drift can create or destroy credits.
 * The account row is locked (SELECT ... FOR UPDATE in the MySQL adapter) so concurrent requests serialize.
 */
export const MICRO = 1_000_000;
export const toMicro = (credits: number): number => {
  if (!Number.isFinite(credits) || credits < 0) throw new CreditError("INVALID_AMOUNT", "Credit amount must be a non-negative number.");
  return Math.round(credits * MICRO);
};
export const fromMicro = (micro: number): number => micro / MICRO;

export type CreditErrorCode = "INSUFFICIENT_CREDITS" | "INVALID_AMOUNT" | "RESERVATION_NOT_FOUND" | "RESERVATION_CLOSED" | "FORBIDDEN";
export class CreditError extends Error {
  constructor(readonly code: CreditErrorCode, message: string, readonly details: { available?: number; required?: number } = {}) { super(message); this.name = "CreditError"; }
}

export type Account = { userId: number; balance: number; reserved: number }; // micro-credits
export type ReservationStatus = "reserved" | "finalized" | "released";
export type Reservation = { id: string; userId: number; requestId: string; capability: string; amount: number; charged: number; status: ReservationStatus };
export type LedgerKind = "usage" | "refund" | "grant" | "purchase" | "adjustment";
export type LedgerEntry = { userId: number; kind: LedgerKind; amount: number; balanceAfter: number; capability: string | null; referenceId: string };

export interface CreditTx {
  /** Lock (creating from the existing ledger balance if absent) the user's account row. */
  lockAccount(userId: number): Promise<Account>;
  saveAccount(account: Account): Promise<void>;
  getReservationByRequest(userId: number, requestId: string): Promise<Reservation | null>;
  getReservation(id: string): Promise<Reservation | null>;
  insertReservation(r: Reservation): Promise<void>;
  updateReservation(r: Reservation): Promise<void>;
  insertLedger(e: LedgerEntry): Promise<void>;
}
export interface CreditStore { transaction<T>(fn: (tx: CreditTx) => Promise<T>): Promise<T>; }

export type Quote = { capability: string; credits: number };

/** Reserve credits for a request. Idempotent per (user, requestId). Throws INSUFFICIENT_CREDITS before any side effect. */
export async function reserveCredits(store: CreditStore, input: { userId: number; requestId: string; capability: string; credits: number; id: string }): Promise<Reservation> {
  const amount = toMicro(input.credits);
  return store.transaction(async (tx) => {
    const account = await tx.lockAccount(input.userId);
    const existing = await tx.getReservationByRequest(input.userId, input.requestId);
    if (existing) return existing;
    if (amount === 0) {
      const free: Reservation = { id: input.id, userId: input.userId, requestId: input.requestId, capability: input.capability, amount: 0, charged: 0, status: "reserved" };
      await tx.insertReservation(free);
      return free;
    }
    const available = account.balance - account.reserved;
    if (available < amount) throw new CreditError("INSUFFICIENT_CREDITS", "Not enough credits to start this operation.", { available: fromMicro(Math.max(0, available)), required: fromMicro(amount) });
    const r: Reservation = { id: input.id, userId: input.userId, requestId: input.requestId, capability: input.capability, amount, charged: 0, status: "reserved" };
    await tx.saveAccount({ ...account, reserved: account.reserved + amount });
    await tx.insertReservation(r);
    return r;
  });
}

/** Charge up to the reserved amount (never more) and release the remainder. Idempotent: a closed reservation is returned as-is. */
export async function finalizeReservation(store: CreditStore, reservationId: string, actualCredits?: number): Promise<Reservation> {
  return store.transaction(async (tx) => {
    const r = await tx.getReservation(reservationId);
    if (!r) throw new CreditError("RESERVATION_NOT_FOUND", "Credit reservation not found.");
    if (r.status !== "reserved") return r;
    const charge = actualCredits === undefined ? r.amount : Math.min(r.amount, toMicro(actualCredits));
    const account = await tx.lockAccount(r.userId);
    const next: Account = { userId: r.userId, balance: account.balance - charge, reserved: account.reserved - r.amount };
    if (next.balance < 0 || next.reserved < 0) throw new CreditError("INVALID_AMOUNT", "Ledger invariant violated; refusing to finalize.");
    await tx.saveAccount(next);
    const done: Reservation = { ...r, charged: charge, status: "finalized" };
    await tx.updateReservation(done);
    if (charge > 0) await tx.insertLedger({ userId: r.userId, kind: "usage", amount: -charge, balanceAfter: next.balance, capability: r.capability, referenceId: r.requestId });
    return done;
  });
}

/** Add credits (grant/purchase/refund/adjustment). Idempotent per (kind, referenceId) when a referenceId is given. */
export async function grantCredits(store: CreditStore, input: { userId: number; credits: number; kind: "grant" | "purchase" | "refund" | "adjustment"; referenceId: string }): Promise<{ balance: number; replayed: boolean }> {
  const amount = toMicro(input.credits);
  if (amount <= 0) throw new CreditError("INVALID_AMOUNT", "Grant amount must be greater than zero.");
  return store.transaction(async (tx) => {
    const key = `grant:${input.kind}:${input.referenceId}`.slice(0, 64);
    const prior = await tx.getReservationByRequest(input.userId, key);
    const account = await tx.lockAccount(input.userId);
    if (prior) return { balance: fromMicro(account.balance), replayed: true };
    const next = { ...account, balance: account.balance + amount };
    await tx.saveAccount(next);
    await tx.insertReservation({ id: `${key}`.slice(0, 64), userId: input.userId, requestId: key, capability: `grant.${input.kind}`, amount, charged: amount, status: "finalized" });
    await tx.insertLedger({ userId: input.userId, kind: input.kind, amount, balanceAfter: next.balance, capability: null, referenceId: input.referenceId });
    return { balance: fromMicro(next.balance), replayed: false };
  });
}

/** Release without charging (failure, cancellation, provider error). Idempotent. */
export async function releaseReservation(store: CreditStore, reservationId: string): Promise<Reservation> {
  return store.transaction(async (tx) => {
    const r = await tx.getReservation(reservationId);
    if (!r) throw new CreditError("RESERVATION_NOT_FOUND", "Credit reservation not found.");
    if (r.status !== "reserved") return r;
    const account = await tx.lockAccount(r.userId);
    await tx.saveAccount({ ...account, reserved: Math.max(0, account.reserved - r.amount) });
    const done: Reservation = { ...r, status: "released" };
    await tx.updateReservation(done);
    return done;
  });
}

export async function getBalance(store: CreditStore, userId: number): Promise<{ balance: number; reserved: number; available: number }> {
  return store.transaction(async (tx) => {
    const a = await tx.lockAccount(userId);
    return { balance: fromMicro(a.balance), reserved: fromMicro(a.reserved), available: fromMicro(a.balance - a.reserved) };
  });
}

/** Server-side price list (credits). Never taken from the client. Override per capability via CREDIT_PRICE_<CAPABILITY> env. */
const DEFAULT_PRICES: Record<string, number> = {
  "conversation.reply": 1,
  "builder.live.edit": 5,
  "builder.app.generate": 25,
  "builder.website.generate": 20,
  "builder.workflow.generate": 15,
  "builder.database.generate": 15,
  "builder.agent.test": 5,
  "media.video.create": 40,
  "career.opportunity.search": 3,
  "learning.tutor.ask": 2,
  "assistant.tasks.organize": 2,
  "wallet.overview": 0,
  "voice.transcribe": 1,
  "ai.route": 0.2,
  "code.run": 2,
  "ai_builder.requirements": 3,
  "ai_builder.plan": 3,
  "ai_builder.code": 10,
};
export const WEB_SEARCH_SURCHARGE = 1;
export function priceFor(capability: string, env: Record<string, string | undefined> = process.env, options: { webSearch?: boolean } = {}): Quote {
  const override = env[`CREDIT_PRICE_${capability.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`];
  let credits = DEFAULT_PRICES[capability] ?? 5;
  if (override !== undefined && override !== "" && Number.isFinite(Number(override)) && Number(override) >= 0) credits = Number(override);
  if (options.webSearch) credits += WEB_SEARCH_SURCHARGE;
  return { capability, credits };
}

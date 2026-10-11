import { and, desc, eq, lt } from "drizzle-orm";
import { aiOperations, creditAccounts, creditLedger, creditReservations, orchestrationRuns } from "../../drizzle/schema";
import { getDb } from "../db";
import { settleTerminalRun } from "./metering";
import { MICRO, toMicro, type Account, type CreditStore, type CreditTx, type LedgerEntry, type Reservation } from "./ledger";

/**
 * Production adapter (MySQL/InnoDB via drizzle). lockAccount issues SELECT ... FOR UPDATE so concurrent
 * requests for one user serialize. NOT VERIFIED AT RUNTIME: written without drizzle-orm or a MySQL server;
 * the logic on top of it is tested through the same port against SQLite (tests/helpers/sqlite-credit-store.ts).
 */
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const toReservation = (r: typeof creditReservations.$inferSelect): Reservation => ({ id: r.id, userId: r.userId, requestId: r.requestId, capability: r.capability, amount: r.amount, charged: r.charged, status: r.status });

function txPort(tx: Tx): CreditTx {
  return {
    async lockAccount(userId): Promise<Account> {
      let row = (await tx.select().from(creditAccounts).where(eq(creditAccounts.userId, userId)).limit(1).for("update"))[0];
      if (!row) {
        // First touch: seed from the legacy ledger's latest balance (decimal credits -> micro-credits).
        const last = (await tx.select().from(creditLedger).where(eq(creditLedger.userId, userId)).orderBy(desc(creditLedger.createdAt)).limit(1))[0];
        const seed = last ? toMicro(Math.max(0, Number(last.balanceAfter))) : 0;
        await tx.insert(creditAccounts).values({ userId, balance: seed, reserved: 0 }).onDuplicateKeyUpdate({ set: { userId } });
        row = (await tx.select().from(creditAccounts).where(eq(creditAccounts.userId, userId)).limit(1).for("update"))[0];
      }
      if (!row) throw new Error("Credit account could not be created.");
      return { userId: row.userId, balance: row.balance, reserved: row.reserved };
    },
    async saveAccount(a) { await tx.update(creditAccounts).set({ balance: a.balance, reserved: a.reserved }).where(eq(creditAccounts.userId, a.userId)); },
    async getReservationByRequest(userId, requestId) {
      const r = (await tx.select().from(creditReservations).where(and(eq(creditReservations.userId, userId), eq(creditReservations.requestId, requestId))).limit(1))[0];
      return r ? toReservation(r) : null;
    },
    async getReservation(id) {
      const r = (await tx.select().from(creditReservations).where(eq(creditReservations.id, id)).limit(1).for("update"))[0];
      return r ? toReservation(r) : null;
    },
    async insertReservation(r) { await tx.insert(creditReservations).values({ ...r }); },
    async updateReservation(r) { await tx.update(creditReservations).set({ charged: r.charged, status: r.status }).where(eq(creditReservations.id, r.id)); },
    async insertLedger(e: LedgerEntry) {
      // The legacy ledger stores decimal credits; the micro-credit account row above is the source of truth for balance.
      await tx.insert(creditLedger).values({ id: `credit_${crypto.randomUUID()}`, userId: e.userId, kind: e.kind, amount: (e.amount / MICRO).toFixed(6), balanceAfter: (e.balanceAfter / MICRO).toFixed(6), capability: e.capability, referenceId: e.referenceId.slice(0, 64), createdAt: new Date() });
    },
  };
}

export async function getMysqlCreditStore(): Promise<CreditStore> {
  const db = await getDb();
  if (!db) throw new Error("Credit storage is unavailable.");
  return { transaction: (fn) => db.transaction((tx) => fn(txPort(tx))) };
}

export async function findReservationByRequest(userId: number, requestId: string): Promise<Reservation | null> {
  const db = await getDb();
  if (!db) return null;
  const r = (await db.select().from(creditReservations).where(and(eq(creditReservations.userId, userId), eq(creditReservations.requestId, requestId))).limit(1))[0];
  return r ? toReservation(r) : null;
}

/**
 * Safety net: reservations still "reserved" after 2 minutes whose run already ended (worker crash, settlement error)
 * are settled; reservations whose run no longer exists are released. Idempotent. Returns how many were handled.
 */
export async function reconcileUnsettledReservations(env: Record<string, string | undefined> = process.env): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const store = await getMysqlCreditStore();
  const stale = await db.select().from(creditReservations).where(and(eq(creditReservations.status, "reserved"), lt(creditReservations.createdAt, new Date(Date.now() - 120_000)))).limit(100);
  let handled = 0;
  for (const r of stale) {
    if (r.capability.startsWith("grant.") || r.capability === "voice.transcribe") continue; // not run-backed
    if (r.requestId.startsWith("op:")) {
      // execute-once operation: finalize if its result was persisted for this attempt, release if failed/abandoned, skip while the lease is live
      const [, opId, att] = r.requestId.split(":");
      const op = (await db.select().from(aiOperations).where(and(eq(aiOperations.userId, r.userId), eq(aiOperations.id, opId))).limit(1))[0];
      const { finalizeReservation, releaseReservation } = await import("./ledger");
      if (op && op.status === "completed" && String(op.attempt) === att) { await finalizeReservation(store, r.id); handled++; }
      else if (!op || op.status === "failed" || String(op.attempt) !== att || (op.status === "running" && op.leaseUntil <= new Date())) { await releaseReservation(store, r.id); handled++; }
      continue;
    }
    const run = (await db.select().from(orchestrationRuns).where(and(eq(orchestrationRuns.userId, r.userId), eq(orchestrationRuns.requestId, r.requestId))).limit(1))[0];
    if (!run) { const { releaseReservation } = await import("./ledger"); await releaseReservation(store, r.id); handled++; continue; }
    const out = await settleTerminalRun(store, env, r.userId, { requestId: run.requestId, status: run.status, capability: run.capability, plan: run.plan, result: run.result }, findReservationByRequest);
    if (out !== null) handled++;
  }
  return handled;
}

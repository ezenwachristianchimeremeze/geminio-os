import { describe, expect, it } from "vitest";
import { CreditError, finalizeReservation, grantCredits, getBalance, priceFor, releaseReservation, reserveCredits, toMicro } from "../server/credits/ledger";
import { SqliteCreditStore } from "./helpers/sqlite-credit-store";

const setup = (credits: number) => { const s = new SqliteCreditStore(); s.seed(1, toMicro(credits)); return s; };
let n = 0;
const reserve = (s: SqliteCreditStore, credits: number, requestId = `r${++n}`, userId = 1) => reserveCredits(s, { userId, requestId, capability: "conversation.reply", credits, id: `res_${requestId}` });

describe("credit reservations", () => {
  it("reserves, then finalizes and writes one ledger entry", async () => {
    const s = setup(10);
    const r = await reserve(s, 3);
    expect(await getBalance(s, 1)).toEqual({ balance: 10, reserved: 3, available: 7 });
    await finalizeReservation(s, r.id);
    expect(await getBalance(s, 1)).toEqual({ balance: 7, reserved: 0, available: 7 });
    expect(s.ledger(1)).toHaveLength(1);
    expect(s.ledger(1)[0].amount).toBe(-toMicro(3));
  });
  it("refuses insufficient credits with no side effects", async () => {
    const s = setup(2);
    await expect(reserve(s, 5)).rejects.toMatchObject({ code: "INSUFFICIENT_CREDITS" });
    expect(await getBalance(s, 1)).toEqual({ balance: 2, reserved: 0, available: 2 });
    expect((s.db.prepare("SELECT COUNT(*) c FROM reservations").get() as { c: number }).c).toBe(0);
  });
  it("reservations count against availability", async () => {
    const s = setup(5);
    await reserve(s, 4);
    await expect(reserve(s, 2)).rejects.toBeInstanceOf(CreditError);
  });
  it("release returns the hold without charging", async () => {
    const s = setup(5);
    const r = await reserve(s, 4);
    await releaseReservation(s, r.id);
    expect(await getBalance(s, 1)).toEqual({ balance: 5, reserved: 0, available: 5 });
    expect(s.ledger(1)).toHaveLength(0);
  });
  it("is idempotent per requestId", async () => {
    const s = setup(5);
    const a = await reserve(s, 2, "same");
    const b = await reserve(s, 2, "same");
    expect(b.id).toBe(a.id);
    expect((await getBalance(s, 1)).reserved).toBe(2);
  });
  it("finalize and release are idempotent and cannot double-charge", async () => {
    const s = setup(5);
    const r = await reserve(s, 2);
    await finalizeReservation(s, r.id);
    await finalizeReservation(s, r.id);
    await releaseReservation(s, r.id);
    expect(await getBalance(s, 1)).toEqual({ balance: 3, reserved: 0, available: 3 });
    expect(s.ledger(1)).toHaveLength(1);
  });
  it("never charges more than reserved; refunds the unused part", async () => {
    const s = setup(10);
    const r = await reserve(s, 4);
    const done = await finalizeReservation(s, r.id, 99);
    expect(done.charged).toBe(toMicro(4));
    const r2 = await reserve(s, 4);
    await finalizeReservation(s, r2.id, 1);
    expect(await getBalance(s, 1)).toEqual({ balance: 5, reserved: 0, available: 5 });
  });
  it("20 concurrent reservations of 1 credit against 5 credits succeed exactly 5 times", async () => {
    const s = setup(5);
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => reserve(s, 1, `c${i}`)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    expect((await getBalance(s, 1)).available).toBe(0);
  });
  it("rolls back finalize atomically if the ledger write fails", async () => {
    const s = setup(5);
    const r = await reserve(s, 2);
    s.failOnLedgerInsert = true;
    await expect(finalizeReservation(s, r.id)).rejects.toThrow("ledger write failed");
    s.failOnLedgerInsert = false;
    expect(await getBalance(s, 1)).toEqual({ balance: 5, reserved: 2, available: 3 });
    await finalizeReservation(s, r.id);
    expect(await getBalance(s, 1)).toEqual({ balance: 3, reserved: 0, available: 3 });
  });
  it("users are isolated", async () => {
    const s = setup(5); s.seed(2, toMicro(1));
    await expect(reserve(s, 2, "x", 2)).rejects.toMatchObject({ code: "INSUFFICIENT_CREDITS" });
    expect((await getBalance(s, 1)).available).toBe(5);
  });
  it("no float drift over many small charges", async () => {
    const s = setup(1);
    for (let i = 0; i < 10; i++) { const r = await reserve(s, 0.1, `d${i}`); await finalizeReservation(s, r.id); }
    expect((await getBalance(s, 1)).balance).toBe(0);
  });
  it("rejects negative and NaN amounts", async () => {
    const s = setup(1);
    await expect(reserve(s, -1)).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(reserve(s, Number.NaN)).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
  });
  it("zero-cost operations reserve without touching balance", async () => {
    const s = setup(0);
    const r = await reserve(s, 0);
    await finalizeReservation(s, r.id);
    expect(s.ledger(1)).toHaveLength(0);
  });
});

describe("grants", () => {
  it("adds credits atomically, writes a ledger row, and is idempotent per reference", async () => {
    const s = setup(1);
    expect(await grantCredits(s, { userId: 1, credits: 5, kind: "grant", referenceId: "ref1" })).toEqual({ balance: 6, replayed: false });
    expect(await grantCredits(s, { userId: 1, credits: 5, kind: "grant", referenceId: "ref1" })).toEqual({ balance: 6, replayed: true });
    expect((await getBalance(s, 1)).balance).toBe(6);
    expect(s.ledger(1).filter((e) => e.kind === "grant")).toHaveLength(1);
  });
  it("granted credits become spendable and rejects non-positive grants", async () => {
    const s = setup(0);
    await expect(reserve(s, 2)).rejects.toMatchObject({ code: "INSUFFICIENT_CREDITS" });
    await grantCredits(s, { userId: 1, credits: 3, kind: "purchase", referenceId: "p1" });
    await reserve(s, 2);
    await expect(grantCredits(s, { userId: 1, credits: 0, kind: "grant", referenceId: "z" })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
  });
});

describe("server-side pricing", () => {
  it("uses the server price list and honours env overrides", () => {
    expect(priceFor("conversation.reply", {}).credits).toBe(1);
    expect(priceFor("conversation.reply", { CREDIT_PRICE_CONVERSATION_REPLY: "3" }).credits).toBe(3);
    expect(priceFor("conversation.reply", {}, { webSearch: true }).credits).toBe(2);
    expect(priceFor("unknown.cap", {}).credits).toBe(5);
    expect(priceFor("conversation.reply", { CREDIT_PRICE_CONVERSATION_REPLY: "-1" }).credits).toBe(1);
  });
});

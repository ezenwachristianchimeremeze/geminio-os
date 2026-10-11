import { describe, expect, it } from "vitest";
import { reserveForRun, settleTerminalRun } from "../server/credits/metering";
import { getBalance, toMicro, type Reservation } from "../server/credits/ledger";
import { SqliteCreditStore } from "./helpers/sqlite-credit-store";

/** Credit state across every task lifecycle path. Invariant after any terminal state: reserved == 0 (nothing is held forever). */
const world = () => { const s = new SqliteCreditStore(); s.seed(1, toMicro(100)); const find = async (u: number, r: string) => s.db.prepare("SELECT * FROM reservations WHERE userId=? AND requestId=?").get(u, r) as unknown as Reservation | null; return { s, find }; };
const steps = (...st: string[]) => ({ steps: st.map((status) => ({ status })) });
const reserve = (w: ReturnType<typeof world>, n = 3) => reserveForRun(w.s, {}, { userId: 1, requestId: "req", capability: "conversation.reply", steps: n, id: "res" });
const settle = (w: ReturnType<typeof world>, status: string, plan?: unknown) => settleTerminalRun(w.s, {}, 1, { requestId: "req", status, capability: "conversation.reply", plan }, w.find);

describe("task lifecycle x credits", () => {
  it("queued -> cancelled: full release, nothing charged", async () => {
    const w = world(); await reserve(w); expect(await settle(w, "cancelled", steps("pending", "pending", "pending"))).toBe(0);
    expect(await getBalance(w.s, 1)).toEqual({ balance: 100, reserved: 0, available: 100 });
  });
  it("running -> paused: the hold stays (not terminal) -> resumed -> completed: pay for all completed steps once", async () => {
    const w = world(); await reserve(w);
    expect(await settle(w, "paused", steps("completed", "pending", "pending"))).toBeNull(); expect((await getBalance(w.s, 1)).reserved).toBe(3);
    expect(await settle(w, "executing", steps("completed", "running", "pending"))).toBeNull();
    expect(await settle(w, "completed", steps("completed", "completed", "completed"))).toBe(3);
    expect(await getBalance(w.s, 1)).toEqual({ balance: 97, reserved: 0, available: 97 });
  });
  it("queued -> running -> paused -> resumed -> cancelled: pay for the finished steps, release the rest", async () => {
    const w = world(); await reserve(w); expect(await settle(w, "cancelled", steps("completed", "completed", "pending"))).toBe(2);
    expect(await getBalance(w.s, 1)).toEqual({ balance: 98, reserved: 0, available: 98 });
  });
  it("paused too long -> server-side expiry cancels the run -> held credits are released/settled", async () => {
    const w = world(); await reserve(w); expect(await settle(w, "cancelled", steps("completed", "pending", "pending"))).toBe(1);
    expect((await getBalance(w.s, 1)).reserved).toBe(0);
  });
  it("running -> failed: only completed steps are charged; a retry is a NEW request (new reservation), never free", async () => {
    const w = world(); await reserve(w); expect(await settle(w, "failed", steps("completed", "failed", "pending"))).toBe(1);
    const again = await reserveForRun(w.s, {}, { userId: 1, requestId: "req-2", capability: "conversation.reply", steps: 3, id: "res2" });
    expect(again?.status).toBe("reserved"); expect((await getBalance(w.s, 1)).reserved).toBe(3);
  });
  it("running -> worker crash -> job re-queued -> completes: exactly one settlement, no double charge", async () => {
    const w = world(); await reserve(w);
    expect(await settle(w, "executing", steps("completed", "running", "pending"))).toBeNull(); // crash happens; reservation untouched
    const done = steps("completed", "completed", "completed");
    await Promise.all([settle(w, "completed", done), settle(w, "completed", done), settle(w, "completed", done)]); // worker + poll + reconciler racing
    expect(await getBalance(w.s, 1)).toEqual({ balance: 97, reserved: 0, available: 97 }); expect(w.s.ledger(1)).toHaveLength(1);
  });
  it("run that vanished before settling (orphan) is releasable by reconciliation without charge", async () => {
    const w = world(); await reserve(w); const { releaseReservation } = await import("../server/credits/ledger");
    await releaseReservation(w.s, "res"); expect(await getBalance(w.s, 1)).toEqual({ balance: 100, reserved: 0, available: 100 });
  });
});

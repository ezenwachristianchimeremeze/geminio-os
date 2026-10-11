import { describe, expect, it } from "vitest";
import { creditsEnforced, InsufficientCreditsError, reserveForRun, settleTerminalRun } from "../server/credits/metering";
import { getBalance, toMicro, type Reservation } from "../server/credits/ledger";
import { SqliteCreditStore } from "./helpers/sqlite-credit-store";

const world = (credits: number) => { const s = new SqliteCreditStore(); s.seed(1, toMicro(credits)); const find = async (u: number, r: string) => s.db.prepare("SELECT * FROM reservations WHERE userId=? AND requestId=?").get(u, r) as unknown as Reservation | null; return { s, find }; };
const steps = (...st: string[]) => ({ steps: st.map((status) => ({ status })) });

describe("enforcement policy", () => {
  it("is on by default and can be disabled only outside production", () => {
    expect(creditsEnforced({})).toBe(true);
    expect(creditsEnforced({ CREDITS_ENFORCEMENT: "off", NODE_ENV: "development" })).toBe(false);
    expect(creditsEnforced({ CREDITS_ENFORCEMENT: "off", NODE_ENV: "production" })).toBe(true);
  });
});

describe("reserveForRun (every AI path)", () => {
  it("prices by capability x steps from server config and reserves", async () => {
    const { s } = world(100);
    await reserveForRun(s, {}, { userId: 1, requestId: "r1", capability: "builder.app.generate", steps: 2, id: "res1" });
    expect(await getBalance(s, 1)).toEqual({ balance: 100, reserved: 50, available: 50 });
  });
  it("throws InsufficientCreditsError with amounts and reserves nothing", async () => {
    const { s } = world(3);
    await expect(reserveForRun(s, {}, { userId: 1, requestId: "r1", capability: "builder.live.edit", steps: 1, id: "x" })).rejects.toBeInstanceOf(InsufficientCreditsError);
    expect((await getBalance(s, 1)).reserved).toBe(0);
  });
  it("is a no-op when enforcement is disabled for dev", async () => {
    const { s } = world(0);
    expect(await reserveForRun(s, { CREDITS_ENFORCEMENT: "off" }, { userId: 1, requestId: "r1", capability: "builder.app.generate", steps: 1, id: "x" })).toBeNull();
  });
  it("a replayed request does not reserve twice", async () => {
    const { s } = world(10);
    await reserveForRun(s, {}, { userId: 1, requestId: "r1", capability: "builder.live.edit", steps: 1, id: "a" });
    await reserveForRun(s, {}, { userId: 1, requestId: "r1", capability: "builder.live.edit", steps: 1, id: "b" });
    expect((await getBalance(s, 1)).reserved).toBe(5);
  });
});

describe("settleTerminalRun", () => {
  it("charges the capability's own price per completed step (not conversation.reply's)", async () => {
    const { s, find } = world(100);
    await reserveForRun(s, {}, { userId: 1, requestId: "r1", capability: "builder.app.generate", steps: 1, id: "a" });
    const charged = await settleTerminalRun(s, {}, 1, { requestId: "r1", status: "completed", capability: "builder.app.generate", plan: steps("completed") }, find);
    expect(charged).toBe(25);
    expect(await getBalance(s, 1)).toEqual({ balance: 75, reserved: 0, available: 75 });
  });
  it("releases when nothing completed and ignores non-terminal runs", async () => {
    const { s, find } = world(10);
    await reserveForRun(s, {}, { userId: 1, requestId: "r1", capability: "builder.live.edit", steps: 1, id: "a" });
    expect(await settleTerminalRun(s, {}, 1, { requestId: "r1", status: "executing", capability: "builder.live.edit" }, find)).toBeNull();
    expect(await settleTerminalRun(s, {}, 1, { requestId: "r1", status: "failed", capability: "builder.live.edit", plan: steps("failed") }, find)).toBe(0);
    expect(await getBalance(s, 1)).toEqual({ balance: 10, reserved: 0, available: 10 });
  });
  it("never charges more than was reserved and is idempotent", async () => {
    const { s, find } = world(10);
    await reserveForRun(s, {}, { userId: 1, requestId: "r1", capability: "conversation.reply", steps: 1, id: "a" });
    const run = { requestId: "r1", status: "completed", capability: "conversation.reply", plan: steps("completed", "completed", "completed") };
    expect(await settleTerminalRun(s, {}, 1, run, find)).toBe(1);
    expect(await settleTerminalRun(s, {}, 1, run, find)).toBe(1);
    expect((await getBalance(s, 1)).balance).toBe(9);
  });
  it("a run with no reservation (credits were disabled) settles to null without error", async () => {
    const { s, find } = world(10);
    expect(await settleTerminalRun(s, {}, 1, { requestId: "none", status: "completed", capability: "conversation.reply" }, find)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { runMetered } from "../server/credits/metered-llm";
import { InsufficientCreditsError } from "../server/credits/metering";
import { getBalance, toMicro } from "../server/credits/ledger";
import { SqliteCreditStore } from "./helpers/sqlite-credit-store";

const world = (c: number) => { const s = new SqliteCreditStore(); s.seed(1, toMicro(c)); return s; };

describe("runMetered", () => {
  it("charges once on success", async () => {
    const s = world(10);
    expect(await runMetered(s, {}, { userId: 1, capability: "legacy.jobs.generateResume" }, async () => "ok")).toBe("ok");
    expect(await getBalance(s, 1)).toEqual({ balance: 5, reserved: 0, available: 5 }); // default price 5
  });
  it("never charges and rethrows when the call fails", async () => {
    const s = world(10);
    await expect(runMetered(s, {}, { userId: 1, capability: "legacy.x" }, async () => { throw new Error("provider down"); })).rejects.toThrow("provider down");
    expect(await getBalance(s, 1)).toEqual({ balance: 10, reserved: 0, available: 10 });
  });
  it("does not call the provider at all when credits are insufficient", async () => {
    const s = world(1); let called = 0;
    await expect(runMetered(s, {}, { userId: 1, capability: "legacy.x" }, async () => { called++; return 1; })).rejects.toBeInstanceOf(InsufficientCreditsError);
    expect(called).toBe(0);
  });
  it("concurrent calls cannot overspend (balance 10, price 5 -> exactly 2 succeed)", async () => {
    const s = world(10);
    const r = await Promise.allSettled(Array.from({ length: 6 }, () => runMetered(s, {}, { userId: 1, capability: "legacy.x" }, async () => { await new Promise((x) => setTimeout(x, 5)); return 1; })));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(2);
    expect((await getBalance(s, 1)).balance).toBe(0);
  });
  it("a duplicate requestId is not charged twice", async () => {
    const s = world(10);
    let calls = 0;
    await runMetered(s, {}, { userId: 1, capability: "legacy.x", requestId: "same" }, async () => { calls++; return 1; });
    await expect(runMetered(s, {}, { userId: 1, capability: "legacy.x", requestId: "same" }, async () => { calls++; return 1; })).rejects.toThrow("already processed");
    expect(calls).toBe(1);
    expect((await getBalance(s, 1)).balance).toBe(5);
  });
});

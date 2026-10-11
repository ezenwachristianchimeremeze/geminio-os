import { describe, expect, it } from "vitest";
import { executeOnce, getOperation, hashInput, LEASE_MS, OperationError } from "../server/credits/operations";
import { getBalance, toMicro } from "../server/credits/ledger";
import { SqliteCreditStore } from "./helpers/sqlite-credit-store";
import { SqliteOperationStore } from "./helpers/sqlite-operation-store";

let n = 0;
function world(credits = 20) {
  const credit = new SqliteCreditStore(); credit.seed(1, toMicro(credits)); credit.seed(2, toMicro(credits)); const ops = new SqliteOperationStore(); let clock = new Date("2026-10-07T12:00:00Z");
  const deps = { ops, credits: credit, env: {}, newId: () => `op_${++n}`, now: () => clock };
  const run = <T,>(fn: () => Promise<T>, o: { key?: string; user?: number; input?: unknown; cap?: string } = {}) => executeOnce(deps, { userId: o.user ?? 1, capability: o.cap ?? "legacy.jobs.searchJobs", key: o.key ?? "key-00000001", inputHash: hashInput(o.input ?? { q: 1 }) }, fn);
  return { credit, ops, run, advance: (ms: number) => { clock = new Date(+clock + ms); } };
}

describe("execute-once operations", () => {
  it("first call executes and charges once; a replay returns the persisted result without executing or charging", async () => {
    const w = world(); let calls = 0;
    const a = await w.run(async () => { calls++; return { text: "answer" }; });
    const b = await w.run(async () => { calls++; return { text: "DIFFERENT" }; });
    expect(calls).toBe(1); expect(a).toMatchObject({ replayed: false, result: { text: "answer" } }); expect(b).toMatchObject({ replayed: true, operationId: a.operationId, result: { text: "answer" } });
    expect((await getBalance(w.credit, 1)).balance).toBe(15); // default price 5, charged once
  });
  it("many replays (e.g. a client auto-refetching) never charge again", async () => {
    const w = world(); await w.run(async () => 1);
    for (let i = 0; i < 20; i++) await w.run(async () => { throw new Error("must not run"); });
    expect((await getBalance(w.credit, 1)).balance).toBe(15);
  });
  it("concurrent identical requests execute once; the loser gets IN_PROGRESS and is not charged", async () => {
    const w = world(); let calls = 0;
    const slow = async () => { calls++; await new Promise((r) => setTimeout(r, 20)); return "x"; };
    const r = await Promise.allSettled([w.run(slow), w.run(slow), w.run(slow)]);
    expect(calls).toBe(1); expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    for (const x of r) if (x.status === "rejected") expect((x.reason as OperationError).code).toBe("IN_PROGRESS");
    expect((await getBalance(w.credit, 1)).balance).toBe(15);
  });
  it("retry after failure runs again, was never charged for the failure, and charges once on success", async () => {
    const w = world(); await expect(w.run(async () => { throw new Error("provider down"); })).rejects.toThrow("provider down");
    expect((await getBalance(w.credit, 1))).toEqual({ balance: 20, reserved: 0, available: 20 });
    expect((await w.run(async () => "ok")).replayed).toBe(false);
    expect((await getBalance(w.credit, 1)).balance).toBe(15);
    expect(await w.run(async () => "never")).toMatchObject({ replayed: true, result: "ok" });
  });
  it("a crashed attempt (lease expired) can be retried; before expiry it is still IN_PROGRESS", async () => {
    const w = world();
    w.ops.db.prepare("INSERT INTO ops VALUES ('op_crash',1,'key-00000001','legacy.jobs.searchJobs',?, 'running',1,NULL,NULL,?,?,?)").run(hashInput({ q: 1 }), +new Date("2026-10-07T12:03:00Z"), +new Date("2026-10-07T12:00:00Z"), +new Date("2026-10-07T12:00:00Z"));
    await expect(w.run(async () => "x")).rejects.toMatchObject({ code: "IN_PROGRESS" });
    w.advance(LEASE_MS + 1000);
    expect(await w.run(async () => "recovered")).toMatchObject({ replayed: false, result: "recovered" });
    expect((await getBalance(w.credit, 1)).balance).toBe(15);
  });
  it("the same key with different input or capability is refused (no result swapping)", async () => {
    const w = world(); await w.run(async () => "a", { input: { q: 1 } });
    await expect(w.run(async () => "b", { input: { q: 2 } })).rejects.toMatchObject({ code: "KEY_REUSED" });
    await expect(w.run(async () => "b", { cap: "legacy.jobs.prepareInterview" })).rejects.toMatchObject({ code: "KEY_REUSED" });
  });
  it("keys are per user: another user's identical key neither sees nor blocks it", async () => {
    const w = world(); const a = await w.run(async () => "mine", { user: 1 }); const b = await w.run(async () => "theirs", { user: 2 });
    expect(b).toMatchObject({ replayed: false, result: "theirs" }); expect(a.operationId).not.toBe(b.operationId);
  });
  it("insufficient credits: provider never called, operation marked failed and retryable after top-up", async () => {
    const w = world(2); let calls = 0;
    await expect(w.run(async () => { calls++; return 1; })).rejects.toMatchObject({ name: "InsufficientCreditsError" });
    expect(calls).toBe(0);
    w.credit.seed(1, toMicro(20));
    expect(await w.run(async () => { calls++; return "ok"; })).toMatchObject({ replayed: false }); expect(calls).toBe(1);
  });
  it("if persisting the result fails, credits are released (no charge for lost work) and a retry works", async () => {
    const w = world(); w.ops.failCompleteOnce = true;
    await expect(w.run(async () => "x")).rejects.toThrow("db down");
    expect(await getBalance(w.credit, 1)).toEqual({ balance: 20, reserved: 0, available: 20 });
    expect((await w.run(async () => "y")).result).toBe("y");
  });
  it("rejects malformed keys", async () => { const w = world(); await expect(w.run(async () => 1, { key: "short" })).rejects.toMatchObject({ code: "INVALID_KEY" }); await expect(w.run(async () => 1, { key: "has space in key!" })).rejects.toMatchObject({ code: "INVALID_KEY" }); });
});

describe("result retrieval (no execution, no charge)", () => {
  it("returns the persisted result to the owner only", async () => {
    const w = world(); const r = await w.run(async () => ({ v: 1 }));
    expect(await getOperation(w.ops, 1, r.operationId)).toMatchObject({ status: "completed", result: { v: 1 } });
    expect(await getOperation(w.ops, 2, r.operationId)).toBeNull(); expect(await getOperation(w.ops, 1, "nope")).toBeNull();
    expect((await getBalance(w.credit, 1)).balance).toBe(15);
  });
  it("shows failures without a result, and running operations without one", async () => {
    const w = world(); await w.run(async () => { throw new Error("boom"); }).catch(() => undefined);
    const row = await w.ops.get(1, "key-00000001");
    expect(await getOperation(w.ops, 1, row!.id)).toMatchObject({ status: "failed", result: null, error: "boom" });
  });
});

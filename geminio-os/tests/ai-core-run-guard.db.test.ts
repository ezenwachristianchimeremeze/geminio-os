/**
 * Concurrency tests for the run guard on a REAL SQL engine with SEPARATE CONNECTIONS (SQLite file in WAL mode; one connection
 * per "worker"/"user"). This is database-backed but it is NOT MySQL: statements mirror the production Drizzle code, InnoDB
 * row-lock/isolation behaviour is not exercised. Treat as "SQL-engine tested"; MySQL verification is still pending (docs/VERIFICATION.md).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { APPROVED_RESUME_RUN, StaleWorkerError, claimForExecution, fencedWrite, finishIfStillRunning } from "../server/ai-core/run-guard";
import { RunStoreConnection } from "./helpers/sqlite-run-store";
import { reserveForRun, settleTerminalRun } from "../server/credits/metering";
import { getBalance, toMicro, type Reservation } from "../server/credits/ledger";
import { SqliteCreditStore } from "./helpers/sqlite-credit-store";

let dir = ""; let file = ""; const conns: RunStoreConnection[] = [];
const open = () => { const c = new RunStoreConnection(file); conns.push(c); return c; };
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), "runguard-")); file = path.join(dir, "t.db"); });
afterEach(() => { for (const c of conns.splice(0)) { try { c.close(); } catch { /* closed */ } } rmSync(dir, { recursive: true, force: true }); });

const NON_TERMINAL = ["accepted", "planning", "executing", "waiting_for_approval", "paused", "verifying"];
/** What the orchestrator does after a successful finish. Counting calls = counting charges. */
const settlements: string[] = [];
const settle = (runId: string) => { settlements.push(runId); };

describe("cancellation vs claim", () => {
  it("cancel first: the worker cannot claim, run and job stay cancelled", async () => {
    const worker = open(), user = open(); worker.seedRun("r1", 1, "accepted"); worker.seedJob("j1", "r1", "leased");
    expect(user.casRun("r1", 1, NON_TERMINAL, { status: "cancelled" })).toBe(true);
    user.casJob("j1", ["queued", "leased", "running"], { status: "cancelled" });
    expect(await claimForExecution(worker.port("r1", "j1"))).toEqual({ claimed: false, reason: "cancelled" });
    expect(worker.run("r1")).toMatchObject({ status: "cancelled", fence: 0 }); expect(worker.job("j1").status).toBe("cancelled");
  });
  it("claim first, then cancel: the cancel wins and the worker's finish is rejected (no charge)", async () => {
    const worker = open(), user = open(); worker.seedRun("r1", 1, "accepted"); worker.seedJob("j1", "r1", "leased");
    const c = await claimForExecution(worker.port("r1", "j1")); expect(c).toMatchObject({ claimed: true, fence: 1 });
    expect(user.casRun("r1", 1, NON_TERMINAL, { status: "cancelled" })).toBe(true);
    const fin = await finishIfStillRunning(worker.port("r1", "j1"), 1, { status: "completed", result: { ok: true } });
    expect(fin).toEqual({ applied: false, currentStatus: "cancelled" }); if (fin.applied) settle("r1");
    expect(worker.run("r1").status).toBe("cancelled"); expect(settlements).toHaveLength(0);
  });
  it("cancelling an already completed run is refused (cannot flip a charged run)", () => {
    const a = open(), b = open(); a.seedRun("r1", 1, "completed");
    expect(b.casRun("r1", 1, NON_TERMINAL, { status: "cancelled" })).toBe(false); expect(a.run("r1").status).toBe("completed");
  });
});

describe("pause vs completion, and resume", () => {
  it("a pause that lands before the finish is kept; resume + re-claim then completes with a NEW fence", async () => {
    const worker = open(), user = open(); worker.seedRun("r1", 1, "accepted"); worker.seedJob("j1", "r1", "leased");
    const c = await claimForExecution(worker.port("r1", "j1")); if (!c.claimed) throw new Error("claim");
    expect(user.casRun("r1", 1, ["accepted", "planning", "executing"], { status: "paused" })).toBe(true);
    expect(await finishIfStillRunning(worker.port("r1", "j1"), c.fence, { status: "completed" })).toMatchObject({ applied: false, currentStatus: "paused" });
    // resume: flip paused->accepted BEFORE enqueueing, then a worker claims the new job
    expect(user.casRun("r1", 1, ["paused"], { status: "accepted" })).toBe(true);
    user.seedJob("j2", "r1", "queued");
    const jid = worker.claimNextJob(Date.now(), 60_000); expect(jid).toBe("j2");
    const c2 = await claimForExecution(worker.port("r1", "j2")); expect(c2).toMatchObject({ claimed: true, fence: 2 });
    if (!c2.claimed) return;
    const fin = await finishIfStillRunning(worker.port("r1", "j2"), c2.fence, { status: "completed" }); expect(fin.applied).toBe(true); if (fin.applied) settle("r1");
    expect(settlements).toEqual(["r1"]);
  });
  it("the WRONG order (enqueue before flipping) strands the run: documents why resume flips first", async () => {
    const worker = open(), user = open(); worker.seedRun("r1", 1, "paused"); user.seedJob("j2", "r1", "queued");
    const jid = worker.claimNextJob(Date.now(), 60_000); expect(jid).toBe("j2");
    expect(await claimForExecution(worker.port("r1", "j2"))).toEqual({ claimed: false, reason: "paused" }); // job consumed, nothing runs
    expect(worker.job("j2").status).toBe("leased"); // (the old code marked it succeeded) -> run would sit "accepted" with no job
  });
});

describe("failure vs requeue", () => {
  it("a failure after the user cancelled neither requeues the job nor overwrites the run", async () => {
    const worker = open(), user = open(); worker.seedRun("r1", 1, "accepted"); worker.seedJob("j1", "r1", "leased");
    const c = await claimForExecution(worker.port("r1", "j1")); if (!c.claimed) throw new Error("claim");
    user.casRun("r1", 1, NON_TERMINAL, { status: "cancelled" }); user.casJob("j1", ["queued", "leased", "running"], { status: "cancelled" });
    // orchestrator failure path: run CAS first, and only if it applied touch the job
    const applied = worker.casRun("r1", 1, ["executing", "verifying"], { status: "executing", error: { code: "retry_scheduled" } }, c.fence);
    expect(applied).toBe(false);
    if (applied) worker.casJob("j1", ["queued", "leased", "running"], { status: "queued" });
    expect(worker.run("r1").status).toBe("cancelled"); expect(worker.job("j1").status).toBe("cancelled");
  });
  it("a retryable failure by the current owner requeues the job and keeps the run executing for the next claim", async () => {
    const worker = open(); worker.seedRun("r1", 1, "accepted"); worker.seedJob("j1", "r1", "leased");
    const c = await claimForExecution(worker.port("r1", "j1")); if (!c.claimed) throw new Error("claim");
    expect(worker.casRun("r1", 1, ["executing", "verifying"], { status: "executing", error: { code: "retry_scheduled" } }, c.fence)).toBe(true);
    expect(worker.casJob("j1", ["queued", "leased", "running"], { status: "queued", attempts: 1 })).toBe(true);
    const next = await claimForExecution(worker.port("r1", "j1")); expect(next).toMatchObject({ claimed: true, fence: 2 });
  });
});

describe("expired leases, duplicate workers and fencing", () => {
  it("a zombie worker cannot write or finish after another worker took over", async () => {
    const a = open(), b = open(), reaper = open(); a.seedRun("r1", 1, "accepted"); a.seedJob("j1", "r1", "leased", Date.now() + 100);
    const ca = await claimForExecution(a.port("r1", "j1")); if (!ca.claimed) throw new Error("A claim");
    expect(ca.fence).toBe(1);
    // A's lease expires while it is still running; the reaper requeues the job and B claims it
    expect(reaper.recoverExpired(Date.now() + 1_000)).toBe(1);
    expect(b.claimNextJob(Date.now() + 1_000, 60_000)).toBe("j1");
    const cb = await claimForExecution(b.port("r1", "j1")); if (!cb.claimed) throw new Error("B claim");
    expect(cb.fence).toBe(2);
    // A wakes up: every write is fenced out
    await expect(fencedWrite(a.port("r1", "j1"), ca.fence, { plan: { stale: true } })).rejects.toBeInstanceOf(StaleWorkerError);
    expect(await finishIfStillRunning(a.port("r1", "j1"), ca.fence, { status: "completed", result: { from: "A" } })).toMatchObject({ applied: false });
    // B proceeds and its result is the one that stands
    await fencedWrite(b.port("r1", "j1"), cb.fence, { plan: { by: "B" } });
    const fin = await finishIfStillRunning(b.port("r1", "j1"), cb.fence, { status: "completed", result: { from: "B" } }); expect(fin.applied).toBe(true); if (fin.applied) settle("rZ");
    expect(JSON.parse(a.run("r1").result as string)).toEqual({ from: "B" }); expect(JSON.parse(a.run("r1").plan as string)).toEqual({ by: "B" });
    expect(settlements.filter((x) => x === "rZ")).toHaveLength(1);
  });
  it("two claims of the same queued job: only one worker gets it", () => {
    const a = open(), b = open(); a.seedJob("j1", "r1", "queued");
    const got = [a.claimNextJob(Date.now(), 60_000), b.claimNextJob(Date.now(), 60_000)];
    expect(got.filter(Boolean)).toEqual(["j1"]);
  });
  it("a terminal run cannot be claimed or completed again", async () => {
    const w = open(); w.seedRun("r1", 1, "completed", 3); w.seedJob("j1", "r1", "queued");
    expect(await claimForExecution(w.port("r1", "j1"))).toEqual({ claimed: false, reason: "finished" });
    expect(await finishIfStillRunning(w.port("r1", "j1"), 3, { status: "completed" })).toMatchObject({ applied: false });
    expect(w.run("r1").fence).toBe(3);
  });
  it("approved resume claims only from waiting_for_approval; two concurrent approvals -> one wins", async () => {
    const a = open(), b = open(); a.seedRun("r1", 1, "waiting_for_approval"); a.seedJob("j1", "r1", "leased"); a.seedJob("j2", "r1", "leased");
    const c1 = await claimForExecution(a.port("r1", "j1"), { from: APPROVED_RESUME_RUN });
    const c2 = await claimForExecution(b.port("r1", "j2"), { from: APPROVED_RESUME_RUN });
    expect([c1.claimed, c2.claimed]).toEqual([true, false]);
  });
});

describe("retry recovery", () => {
  it("failed -> accepted is a CAS: two concurrent retries create one job; a worker never sees a job for a failed run", () => {
    const a = open(), b = open(); a.seedRun("r1", 1, "failed");
    const first = a.casRun("r1", 1, ["failed"], { status: "accepted", error: null }); const second = b.casRun("r1", 1, ["failed"], { status: "accepted", error: null });
    expect([first, second]).toEqual([true, false]);
    if (first) a.seedJob("j9", "r1", "queued");
    expect(a.run("r1").status).toBe("accepted");
  });
});

describe("parallel threads (real parallelism, each with its own connection)", () => {
  it("N workers claim and try to finish the same run: exactly one completion", async () => {
    const seed = open(); seed.seedRun("r1", 1, "accepted"); seed.seedJob("j1", "r1", "leased");
    const code = `
      const { parentPort, workerData } = require("node:worker_threads"); const { DatabaseSync } = require("node:sqlite");
      const db = new DatabaseSync(workerData.file); db.exec("PRAGMA busy_timeout=10000;");
      let fence = null, completed = 0;
      for (let i = 0; i < 20 && fence === null; i++) {
        db.exec("BEGIN IMMEDIATE");
        const r = db.prepare("UPDATE runs SET status='executing', fence=fence+1 WHERE id='r1' AND status IN ('accepted','planning','executing')").run();
        if (Number(r.changes) === 1) fence = db.prepare("SELECT fence FROM runs WHERE id='r1'").get().fence;
        db.exec("COMMIT"); break;
      }
      if (fence !== null) { const f = db.prepare("UPDATE runs SET status='completed' WHERE id='r1' AND status IN ('executing','verifying') AND fence=?").run(fence); completed = Number(f.changes); }
      parentPort.postMessage({ fence, completed });`;
    const results = await Promise.all(Array.from({ length: 6 }, () => new Promise<{ fence: number | null; completed: number }>((res, rej) => { const w = new Worker(code, { eval: true, workerData: { file } }); w.once("message", res); w.once("error", rej); })));
    expect(results.reduce((n, r) => n + r.completed, 0)).toBe(1);
    expect(seed.run("r1").status).toBe("completed");
    const fences = results.map((r) => r.fence).filter((f): f is number => f !== null); expect(new Set(fences).size).toBe(fences.length); // fences are unique
  }, 30_000);
});

describe("cancel-vs-finish decides the charge (run store + credit ledger together)", () => {
  async function race(cancelFirst: boolean) {
    const credit = new SqliteCreditStore(); credit.seed(1, toMicro(10));
    const find = async (u: number, r: string) => credit.db.prepare("SELECT * FROM reservations WHERE userId=? AND requestId=?").get(u, r) as unknown as Reservation | null;
    await reserveForRun(credit, {}, { userId: 1, requestId: "req", capability: "conversation.reply", steps: 2, id: "res" });
    const worker = open(), user = open(); worker.seedRun("r1", 1, "accepted"); worker.seedJob("j1", "r1", "leased");
    const c = await claimForExecution(worker.port("r1", "j1")); if (!c.claimed) throw new Error("claim");
    const plan = { steps: [{ status: "completed" }, { status: "completed" }] };
    const cancel = async () => { if (user.casRun("r1", 1, NON_TERMINAL, { status: "cancelled" })) await settleTerminalRun(credit, {}, 1, { requestId: "req", status: "cancelled", capability: "conversation.reply", plan }, find); };
    const finish = async () => { const f = await finishIfStillRunning(worker.port("r1", "j1"), c.fence, { status: "completed" }); if (f.applied) await settleTerminalRun(credit, {}, 1, { requestId: "req", status: "completed", capability: "conversation.reply", plan }, find); };
    if (cancelFirst) { await cancel(); await finish(); } else { await finish(); await cancel(); }
    return { status: worker.run("r1").status, bal: await getBalance(credit, 1), ledger: credit.ledger(1).length };
  }
  it("finish wins: charged once, run completed, a late cancel is a no-op", async () => {
    const r = await race(false); expect(r.status).toBe("completed"); expect(r.bal).toEqual({ balance: 8, reserved: 0, available: 8 }); expect(r.ledger).toBe(1);
  });
  it("cancel wins: run stays cancelled and the finish neither answers nor charges a second time", async () => {
    const r = await race(true); expect(r.status).toBe("cancelled"); expect(r.bal.reserved).toBe(0); expect(r.bal.balance + 0).toBeGreaterThanOrEqual(8); expect(r.ledger).toBeLessThanOrEqual(1);
  });
});

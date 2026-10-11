import { describe, expect, it } from "vitest";
import { StaleWorkerError, claimForExecution, fencedWrite, finishIfStillRunning, type JobStatus, type RunGuardPort, type RunStatus } from "../server/ai-core/run-guard";

/** In-memory port; `before` interleaves a user action between a worker's steps (single-process; the SQL-backed suite is ai-core-run-guard.db.test.ts). */
function world(run: RunStatus, job: JobStatus = "leased") {
  const s = { run, job, fence: 0 };
  let hook: (() => void) | null = null;
  const fire = () => { const h = hook; hook = null; h?.(); };
  const port: RunGuardPort = {
    async claimRun(from) { fire(); if (!from.includes(s.run)) return null; s.run = "executing"; return ++s.fence; },
    async casRun(from, fence, patch) { fire(); if (!from.includes(s.run) || (fence !== undefined && fence !== s.fence)) return false; if (patch.status) s.run = patch.status; return true; },
    async casJob(from, patch) { if (!from.includes(s.job)) return false; s.job = patch.status; return true; },
    async readRunStatus() { return s.run; },
  };
  return { s, port, before: (fn: () => void) => { hook = fn; } };
}

describe("claimForExecution", () => {
  it("claims an accepted run and returns a fencing token", async () => {
    const w = world("accepted");
    expect(await claimForExecution(w.port)).toEqual({ claimed: true, fence: 1 });
    expect(w.s).toMatchObject({ run: "executing", job: "running" });
  });
  it("does not resurrect a run cancelled just before the claim", async () => {
    const w = world("accepted"); w.before(() => { w.s.run = "cancelled"; w.s.job = "cancelled"; });
    expect(await claimForExecution(w.port)).toEqual({ claimed: false, reason: "cancelled" });
    expect(w.s).toMatchObject({ run: "cancelled", job: "cancelled", fence: 0 });
  });
  it("does not run a paused or terminal run", async () => {
    expect(await claimForExecution(world("paused", "queued").port)).toEqual({ claimed: false, reason: "paused" });
    for (const r of ["completed", "failed"] as const) expect(await claimForExecution(world(r).port)).toEqual({ claimed: false, reason: "finished" });
  });
  it("if only the job was cancelled in between, the run is handed back as cancelled", async () => {
    const w = world("accepted", "leased"); const orig = w.port.claimRun; w.port.claimRun = async (f) => { const x = await orig(f); w.s.job = "cancelled"; return x; };
    expect(await claimForExecution(w.port)).toEqual({ claimed: false, reason: "cancelled" });
    expect(w.s.run).toBe("cancelled");
  });
  it("each claim increments the fence", async () => {
    const w = world("accepted"); const a = await claimForExecution(w.port); w.s.job = "leased"; const b = await claimForExecution(w.port);
    expect([a, b]).toEqual([{ claimed: true, fence: 1 }, { claimed: true, fence: 2 }]);
  });
});

describe("finish and fenced writes", () => {
  it("completes a run the worker still owns", async () => {
    const w = world("accepted"); const c = await claimForExecution(w.port); if (!c.claimed) throw new Error("claim");
    expect(await finishIfStillRunning(w.port, c.fence, { status: "completed" })).toEqual({ applied: true });
  });
  it("does not overwrite a run cancelled or paused while the worker was finishing", async () => {
    for (const status of ["cancelled", "paused"] as const) {
      const w = world("accepted"); const c = await claimForExecution(w.port); if (!c.claimed) throw new Error("claim");
      w.before(() => { w.s.run = status; });
      expect(await finishIfStillRunning(w.port, c.fence, { status: "completed" })).toEqual({ applied: false, currentStatus: status });
      expect(w.s.run).toBe(status);
    }
  });
  it("a superseded worker's write throws StaleWorkerError", async () => {
    const w = world("accepted"); const c = await claimForExecution(w.port); if (!c.claimed) throw new Error("claim");
    w.s.fence = c.fence + 1; // another worker took over
    await expect(fencedWrite(w.port, c.fence, { plan: {} })).rejects.toBeInstanceOf(StaleWorkerError);
    expect(await finishIfStillRunning(w.port, c.fence, { status: "completed" })).toMatchObject({ applied: false });
  });
});

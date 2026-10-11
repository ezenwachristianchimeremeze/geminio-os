/**
 * DEF-011 verification against a real SQL engine. ENGINE = SQLite (node:sqlite) as a STAND-IN for MySQL/InnoDB: it exercises the
 * conditional UPDATEs and multi-session concurrency, NOT InnoDB locking/affectedRows semantics and NOT the Drizzle query builder.
 * The final DEF-011 verification still requires the same scenarios on MySQL through the real tRPC API (docs/VERIFICATION.md).
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { describe, expect, it } from "vitest";
import { approvalOutcomeError, resolveAndResume, resolveApprovalOnce, transitionOwnedTask, updateOwnedTask } from "@/server/task-approvals";
import { RESOLVE_SQL, SqliteApprovalConnection } from "./helpers/sqlite-approval-store";

const A = 1, B = 2;
function fixture() {
  const file = join(mkdtempSync(join(tmpdir(), "appr-")), "db.sqlite");
  const db = new SqliteApprovalConnection(file);
  db.seedTask("task-A", A, "A's task"); db.seedTask("task-B", B, "B's task");
  db.seedApproval("appr-A", "task-A", A); db.seedApproval("appr-B", "task-B", B);
  return { file, db };
}
const snapshot = (db: SqliteApprovalConnection) => JSON.stringify({ a: db.rawApproval("appr-A"), b: db.rawApproval("appr-B"), ta: db.rawTask("task-A"), tb: db.rawTask("task-B") });

describe("DEF-011 (SQLite stand-in) cross-user approval attempts", () => {
  it("1+3: user A cannot approve or reject user B's approval, and B's row is byte-for-byte unchanged", async () => {
    const { db } = fixture();
    const before = snapshot(db);
    for (const decision of ["approved", "rejected"] as const) {
      const o = await resolveApprovalOnce(db, A, "appr-B", decision);
      expect(o.kind).toBe("not_found");
      expect(approvalOutcomeError(o)).toEqual({ code: "NOT_FOUND", message: "Approval not found." });
    }
    expect(snapshot(db)).toBe(before);
    expect(db.rawApproval("appr-B")).toMatchObject({ status: "pending", resolvedAt: null });
  });
  it("an unknown id is indistinguishable from someone else's id", async () => {
    const { db } = fixture();
    expect(await resolveApprovalOnce(db, A, "appr-nope", "approved")).toEqual({ kind: "not_found" });
  });
  it("2+3: user A cannot update user B's agent task; B's row (incl. updatedAt) is unchanged and the call reports no task", async () => {
    const { db } = fixture();
    const before = JSON.stringify(db.rawTask("task-B"));
    const r = await updateOwnedTask(db, A, "task-B", { state: "failed", progress: 100, lastError: "pwned", checkpoint: "x", currentApprovalId: "appr-A" });
    expect(r).toBeNull();
    expect(JSON.stringify(db.rawTask("task-B"))).toBe(before);
  });
  it("7: the owner can still resolve their own approval and update their own task", async () => {
    const { db } = fixture();
    const o = await resolveApprovalOnce(db, A, "appr-A", "approved", new Date(5000));
    expect(o.kind).toBe("resolved");
    expect(db.rawApproval("appr-A")).toMatchObject({ status: "approved", resolvedAt: 5000 });
    const t = await updateOwnedTask(db, A, "task-A", { state: "running", progress: 40, checkpoint: "c" }, new Date(7000));
    expect(t).toMatchObject({ state: "running", progress: 40, checkpoint: "c" });
    expect(db.rawTask("task-A")).toMatchObject({ updatedAt: 7000 });
  });
  it("the owner can reject too (and approve is then a conflict)", async () => {
    const { db } = fixture();
    expect((await resolveApprovalOnce(db, A, "appr-A", "rejected")).kind).toBe("resolved");
    expect((await resolveApprovalOnce(db, A, "appr-A", "approved")).kind).toBe("conflict");
  });
});

describe("DEF-011 (SQLite stand-in) resolve-once semantics", () => {
  it("4: an approval can be resolved only once; the repeat is idempotent and does not touch resolvedAt", async () => {
    const { db } = fixture();
    expect((await resolveApprovalOnce(db, A, "appr-A", "approved", new Date(1000))).kind).toBe("resolved");
    const again = await resolveApprovalOnce(db, A, "appr-A", "approved", new Date(9999));
    expect(again.kind).toBe("already");
    expect(db.rawApproval("appr-A")).toMatchObject({ status: "approved", resolvedAt: 1000 });
  });
  it("5: a conflicting second decision returns the conflict response and leaves the original decision untouched", async () => {
    const { db } = fixture();
    await resolveApprovalOnce(db, A, "appr-A", "approved", new Date(1000));
    const before = JSON.stringify(db.rawApproval("appr-A"));
    const o = await resolveApprovalOnce(db, A, "appr-A", "rejected", new Date(9999));
    expect(o.kind).toBe("conflict");
    expect(approvalOutcomeError(o)).toEqual({ code: "CONFLICT", message: "This approval was already approved." });
    expect(JSON.stringify(db.rawApproval("appr-A"))).toBe(before);
  });
  it("an expired approval cannot be resolved", async () => {
    const { db } = fixture();
    db.seedApproval("appr-exp", "task-A", A, "expired");
    const o = await resolveApprovalOnce(db, A, "appr-exp", "approved");
    expect(o.kind).toBe("conflict");
    expect(db.rawApproval("appr-exp")?.status).toBe("expired");
  });
});

describe("DEF-011 (SQLite stand-in) downstream side effects", () => {
  it("resume runs exactly once for the first approval and never for denied, conflicting or repeated requests", async () => {
    const { db } = fixture();
    const resumed: string[] = [];
    const resume = async (a: { taskId: string }) => { resumed.push(a.taskId); return "started"; };
    expect((await resolveAndResume(db, A, "appr-B", "approved", resume)).resumed).toBeNull();         // denied (B's)
    expect(resumed).toEqual([]);
    expect((await resolveAndResume(db, A, "appr-A", "approved", resume)).resumed).toBe("started");    // legitimate
    expect((await resolveAndResume(db, A, "appr-A", "approved", resume)).resumed).toBeNull();          // repeat
    expect((await resolveAndResume(db, A, "appr-A", "rejected", resume)).resumed).toBeNull();          // conflict
    expect(resumed).toEqual(["task-A"]);
  });
  it("a rejection never resumes", async () => {
    const { db } = fixture();
    let n = 0;
    await resolveAndResume(db, A, "appr-A", "rejected", async () => { n++; });
    expect(n).toBe(0);
  });
});

describe("DEF-011 (SQLite stand-in) concurrency: 8 sessions racing on one pending approval", () => {
  const workerCode = `
    const { parentPort, workerData } = require("node:worker_threads"); const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(workerData.file); db.exec("PRAGMA busy_timeout=5000;");
    const changes = Number(db.prepare(workerData.sql).run(workerData.decision, Date.now(), "appr-A", 1).changes);
    parentPort.postMessage({ decision: workerData.decision, changes });`;
  it("6: exactly one UPDATE changes the row, and the stored decision is the winner's", async () => {
    const { file, db } = fixture();
    const decisions = ["approved", "rejected", "approved", "rejected", "approved", "rejected", "approved", "rejected"];
    const results = await Promise.all(decisions.map((decision) => new Promise<{ decision: string; changes: number }>((res, rej) => { const w = new Worker(workerCode, { eval: true, workerData: { file, sql: RESOLVE_SQL, decision } }); w.once("message", res); w.once("error", rej); })));
    const winners = results.filter((r) => r.changes === 1);
    expect(winners).toHaveLength(1);
    expect(results.filter((r) => r.changes === 0)).toHaveLength(7);
    expect(db.rawApproval("appr-A")?.status).toBe(winners[0].decision);
  });
  it("6b: racing the full resolve+resume path across separate connections starts work at most once", async () => {
    const { file } = fixture();
    const conns = Array.from({ length: 8 }, () => new SqliteApprovalConnection(file));
    let resumes = 0;
    const out = await Promise.all(conns.map((c) => resolveAndResume(c, A, "appr-A", "approved", async () => { resumes++; })));
    expect(out.filter((o) => o.outcome.kind === "resolved")).toHaveLength(1);
    expect(out.filter((o) => o.outcome.kind === "already")).toHaveLength(7);
    expect(resumes).toBe(1);
  });
});

describe("DEF-011 follow-up (SQLite stand-in): task state transitions are compare-and-set and owner-scoped", () => {
  it("applies when the state still matches; a stale `from` is refused and changes nothing", async () => {
    const { db } = fixture();
    expect((await transitionOwnedTask(db, A, "task-A", "queued", { state: "planning", progress: 10 })).applied).toBe(true);
    const before = JSON.stringify(db.rawTask("task-A"));
    expect((await transitionOwnedTask(db, A, "task-A", "queued", { state: "cancelled" })).applied).toBe(false);
    expect(JSON.stringify(db.rawTask("task-A"))).toBe(before);
  });
  it("user A cannot transition user B's task, even with the right `from`; row unchanged", async () => {
    const { db } = fixture();
    const before = JSON.stringify(db.rawTask("task-B"));
    expect((await transitionOwnedTask(db, A, "task-B", "queued", { state: "cancelled" })).applied).toBe(false);
    expect(JSON.stringify(db.rawTask("task-B"))).toBe(before);
  });
  it("8 sessions racing queued->cancelled / queued->failed: exactly one wins", async () => {
    const { file, db } = fixture();
    const conns = Array.from({ length: 8 }, () => new SqliteApprovalConnection(file));
    const out = await Promise.all(conns.map((c, i) => transitionOwnedTask(c, A, "task-A", "queued", { state: i % 2 ? "cancelled" : "failed" })));
    expect(out.filter((o) => o.applied)).toHaveLength(1);
    expect(["cancelled", "failed"]).toContain(db.rawTask("task-A")?.state);
  });
});

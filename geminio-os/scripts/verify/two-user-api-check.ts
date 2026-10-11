/**
 * Two-user authorization check against a RUNNING server and a REAL MySQL database. NOT RUN in the authoring sandbox
 * (no MySQL, no registry, no running server) - it exists so the first real machine can produce the evidence DEF-011 still needs.
 *
 * Usage (disposable database only; it inserts rows and never deletes anything it did not create):
 *   pnpm dev                       # server on API_BASE
 *   API_BASE=http://localhost:3000 DATABASE_URL=mysql://user:pw@localhost:3306/geminio_verify_tmp JWT_SECRET=<same as server, >=32 chars> VITE_APP_ID=<same as server> \
 *     VERIFY_CONFIRM=i-understand-this-inserts-rows pnpm tsx scripts/verify/two-user-api-check.ts
 * Safety guard (scripts/verify/safety-guard.ts): refuses NODE_ENV=production, DB names without test|verify|tmp|scratch|disposable|ci, non-local DB/API hosts (override VERIFY_ALLOW_REMOTE=yes), short JWT_SECRET.
 * Output: one JSON document with every assertion, the observed HTTP status and the before/after database snapshots. Exit code 1 on any failure.
 */
import { SignJWT } from "jose";
import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { evaluateSafety } from "./safety-guard";

const BASE = process.env.API_BASE ?? "http://localhost:3000";
const { DATABASE_URL, JWT_SECRET, VITE_APP_ID } = process.env;
const safety = evaluateSafety(process.env);
if (!safety.ok) { console.error("Refusing to run:\n - " + safety.reasons.join("\n - ")); process.exit(2); }

type Check = { name: string; pass: boolean; observed: unknown };
const checks: Check[] = [];
const check = (name: string, pass: boolean, observed: unknown) => { checks.push({ name, pass, observed }); };

async function token(openId: string, name: string) {
  return new SignJWT({ openId, appId: VITE_APP_ID, name }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(Math.floor(Date.now() / 1000) + 3600).sign(new TextEncoder().encode(JWT_SECRET));
}
async function trpc(path: string, tok: string, input: unknown, kind: "mutation" | "query" = "mutation") {
  const url = `${BASE}/api/trpc/${path}` + (kind === "query" ? `?input=${encodeURIComponent(JSON.stringify({ json: input }))}` : "");
  const res = await fetch(url, { method: kind === "query" ? "GET" : "POST", headers: { "content-type": "application/json", authorization: `Bearer ${tok}` }, body: kind === "query" ? undefined : JSON.stringify({ json: input }) });
  const body = await res.json().catch(() => null) as { error?: { json?: { data?: { code?: string } } } } | null;
  return { status: res.status, code: body?.error?.json?.data?.code ?? null, body };
}

async function main() {
  const db = await mysql.createConnection(DATABASE_URL!);
  const run = randomUUID().slice(0, 8);
  const mk = async (tag: string) => { const openId = `verify-${tag}-${run}`; await db.execute("INSERT INTO users (openId, name, role) VALUES (?, ?, 'user')", [openId, openId]); const [r] = await db.execute("SELECT id FROM users WHERE openId=?", [openId]) as [{ id: number }[], unknown]; return { id: r[0].id, tok: await token(openId, openId) }; };
  const A = await mk("a"), B = await mk("b");
  const snap = async (sql: string, p: unknown[] = []) => JSON.stringify((await db.execute(sql, p))[0]);

  // Seed one task + one pending approval each (direct SQL: independent of the code under test).
  const seed = async (u: { id: number }, tag: string) => {
    const task = `task_${tag}_${run}`, appr = `approval_${tag}_${run}`;
    await db.execute("INSERT INTO agentTasks (id, userId, title, state, progress, requiresApproval) VALUES (?, ?, ?, 'queued', 0, 1)", [task, u.id, `${tag} task`]);
    await db.execute("INSERT INTO taskApprovals (id, taskId, userId, action, summary, status) VALUES (?, ?, ?, 'deploy_production', 's', 'pending')", [appr, task, u.id]);
    return { task, appr };
  };
  const a = await seed(A, "a"), b = await seed(B, "b");
  const sideEffects = async () => snap("SELECT (SELECT COUNT(*) FROM notifications WHERE userId IN (?,?)) AS notifications, (SELECT COUNT(*) FROM aiQueueJobs) AS jobs, (SELECT COUNT(*) FROM orchestrationRuns WHERE userId IN (?,?)) AS runs, (SELECT COUNT(*) FROM creditLedger WHERE userId IN (?,?)) AS ledger, (SELECT COALESCE(SUM(balance+reserved),0) FROM creditAccounts WHERE userId IN (?,?)) AS credits", [A.id, B.id, A.id, B.id, A.id, B.id, A.id, B.id]);
  const rowB = () => snap("SELECT * FROM taskApprovals WHERE id=?", [b.appr]) ;
  const taskB = () => snap("SELECT * FROM agentTasks WHERE id=?", [b.task]);

  // 1+3. A tries to approve / reject B's approval.
  const beforeB = { appr: await rowB(), task: await taskB(), fx: await sideEffects() };
  for (const decision of ["approved", "rejected"]) {
    const r = await trpc("assistant.resolveApproval", A.tok, { approvalId: b.appr, decision });
    check(`A ${decision} B's approval -> NOT_FOUND`, r.code === "NOT_FOUND" && r.status === 404, r);
  }
  check("B's approval row unchanged after denied requests", (await rowB()) === beforeB.appr, { before: beforeB.appr, after: await rowB() });
  check("no notification/job/run/credit side effects from denied approvals", (await sideEffects()) === beforeB.fx, { before: beforeB.fx, after: await sideEffects() });

  // 2+3. A tries to transition B's task.
  const t = await trpc("assistant.transition", A.tok, { taskId: b.task, nextState: "cancelled" });
  check("A transitions B's task -> NOT_FOUND", t.code === "NOT_FOUND", t);
  check("B's task row unchanged", (await taskB()) === beforeB.task, { before: beforeB.task, after: await taskB() });

  // 7. Owner works.
  const own = await trpc("assistant.resolveApproval", A.tok, { approvalId: a.appr, decision: "approved" });
  check("A approves A's own approval", own.status === 200, own);
  const [ownRow] = await db.execute("SELECT status, resolvedAt FROM taskApprovals WHERE id=?", [a.appr]) as [{ status: string; resolvedAt: unknown }[], unknown];
  check("stored decision is approved with resolvedAt set", ownRow[0]?.status === "approved" && ownRow[0]?.resolvedAt !== null, ownRow[0]);

  // 4+5. Resolve-once and conflict.
  const keep = await snap("SELECT * FROM taskApprovals WHERE id=?", [a.appr]);
  const again = await trpc("assistant.resolveApproval", A.tok, { approvalId: a.appr, decision: "approved" });
  check("repeat of the same decision is idempotent (200) and changes nothing", again.status === 200 && (await snap("SELECT * FROM taskApprovals WHERE id=?", [a.appr])) === keep, again);
  const conflict = await trpc("assistant.resolveApproval", A.tok, { approvalId: a.appr, decision: "rejected" });
  check("opposite decision -> CONFLICT (409) and original decision untouched", conflict.code === "CONFLICT" && conflict.status === 409 && (await snap("SELECT * FROM taskApprovals WHERE id=?", [a.appr])) === keep, conflict);

  // 6. Concurrency on a fresh pending approval.
  const race = await seed(A, "race");
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => trpc("assistant.resolveApproval", A.tok, { approvalId: race.appr, decision: i % 2 ? "rejected" : "approved" })));
  const [raceRow] = await db.execute("SELECT status FROM taskApprovals WHERE id=?", [race.appr]) as [{ status: string }[], unknown];
  const ok = results.filter((r) => r.status === 200).length, conflicts = results.filter((r) => r.code === "CONFLICT").length;
  // 200s: the winner plus any repeats of the SAME decision (idempotent); every opposite decision must be CONFLICT.
  check("8 concurrent decisions: stored status is one decision, every opposite request got CONFLICT", ["approved", "rejected"].includes(raceRow[0].status) && ok + conflicts === 8 && conflicts === results.filter((_, i) => (i % 2 ? "rejected" : "approved") !== raceRow[0].status).length, { stored: raceRow[0].status, statuses: results.map((r) => r.status) });

  // Preview/runtime isolation (workspace created through the API by B).
  const ws = await trpc("liveBuilder.create", B.tok, { name: `ws-${run}`, kind: "website" });
  const wsId = (ws.body as { result?: { data?: { json?: { data?: { id?: string } } } } } | null)?.result?.data?.json?.data?.id;
  if (wsId) {
    const fx = await sideEffects();
    const p = await trpc("liveBuilder.createPreviewSession", A.tok, { workspaceId: wsId });
    check("A creates a preview session for B's workspace -> NOT_FOUND", p.code === "NOT_FOUND", p);
    const rt = await trpc("liveBuilder.startRuntime", A.tok, { workspaceId: wsId, target: "phone", engine: "controlled_canvas" });
    check("A starts a runtime on B's workspace -> NOT_FOUND", rt.code === "NOT_FOUND", rt);
    const [sessions] = await db.execute("SELECT COUNT(*) AS n FROM liveBuilderRuntimeSessions WHERE workspaceId=?", [wsId]) as [{ n: number }[], unknown];
    check("no runtime session row was created for B's workspace", Number(sessions[0].n) === 0, sessions[0]);
    check("no side effects from denied preview/runtime requests", (await sideEffects()) === fx, { before: fx, after: await sideEffects() });
  } else check("B can create a workspace (precondition)", false, ws);

  console.log(JSON.stringify({ base: BASE, run, passed: checks.every((c) => c.pass), checks }, null, 2));
  await db.end();
  process.exit(checks.every((c) => c.pass) ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });

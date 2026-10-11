import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PreviewGateway, PreviewOwnershipError, type PreviewOwnershipCheck } from "@/server/live-builder/preview-gateway";
import { RunStateError, runStateErrorToTrpcCode } from "@/server/ai-core/run-guard";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// Fixture: user 1 owns ws-1/ver-1/rt-1; user 2 owns ws-2.
const owned: PreviewOwnershipCheck = {
  workspaceOwned: async (u, w) => (u === 1 && w === "ws-1") || (u === 2 && w === "ws-2"),
  versionInWorkspace: async (_u, w, v) => w === "ws-1" && v === "ver-1",
  runtimeInWorkspace: async (_u, w, s) => w === "ws-1" && s === "rt-1",
};

describe("VER-DEF-001 preview sessions require ownership of everything they reference", () => {
  it("creates a session for the owner's own workspace/version/runtime", async () => {
    const g = new PreviewGateway();
    const s = await g.createVerified({ userId: 1, workspaceId: "ws-1", versionId: "ver-1", runtimeSessionId: "rt-1" }, owned);
    expect(s.userId).toBe(1);
    expect(g.authorize(1, s.id).workspaceId).toBe("ws-1");
  });
  it("refuses another tenant's workspace and creates nothing", async () => {
    const g = new PreviewGateway();
    await expect(g.createVerified({ userId: 1, workspaceId: "ws-2" }, owned)).rejects.toBeInstanceOf(PreviewOwnershipError);
    expect(g.listOwned(1)).toHaveLength(0);
  });
  it("refuses a version or runtime session that is not part of the workspace", async () => {
    const g = new PreviewGateway();
    await expect(g.createVerified({ userId: 1, workspaceId: "ws-1", versionId: "ver-X" }, owned)).rejects.toBeInstanceOf(PreviewOwnershipError);
    await expect(g.createVerified({ userId: 1, workspaceId: "ws-1", runtimeSessionId: "rt-X" }, owned)).rejects.toBeInstanceOf(PreviewOwnershipError);
    expect(g.listOwned(1)).toHaveLength(0);
  });
  it("the router uses createVerified, never the unchecked create", () => {
    const src = read("server/routers.ts");
    expect(src).toContain("defaultPreviewGateway.createVerified(");
    expect(src).not.toMatch(/defaultPreviewGateway\.create\(/);
  });
});

describe("VER-DEF-002 run controls on an invalid state are 4xx, not INTERNAL_SERVER_ERROR", () => {
  it("maps RunStateError codes and leaves other errors alone", () => {
    expect(runStateErrorToTrpcCode(new RunStateError("NOT_FOUND", "x"))).toBe("NOT_FOUND");
    expect(runStateErrorToTrpcCode(new RunStateError("INVALID_STATE", "x"))).toBe("PRECONDITION_FAILED");
    expect(runStateErrorToTrpcCode(new RunStateError("UNAVAILABLE", "x"))).toBe("SERVICE_UNAVAILABLE");
    expect(runStateErrorToTrpcCode(new Error("db down"))).toBeNull();
  });
  it("orchestrator control functions throw RunStateError, not bare Error, for state problems", () => {
    const src = read("server/ai-core/orchestrator.ts");
    const a = src.indexOf("export async function cancelAiRun");
    const b = src.indexOf("/** Paused runs hold a credit reservation");
    const region = src.slice(a, b);
    expect(region).not.toMatch(/throw new Error\(/);
    expect(region.match(/throw new RunStateError\(/g)!.length).toBeGreaterThanOrEqual(10);
  });
  it("every router exposing cancel/retry/pause/resume/stop goes through runControlCall", () => {
    const home = read("server/home-chat/router.ts");
    const root = read("server/routers.ts");
    for (const call of ["pauseAiRun(", "resumePausedRun(", "cancelGatewayRun("]) expect(home).toMatch(new RegExp(`runControlCall\\(\\(\\) => ${call.replace("(", "\\(")}`));
    for (const call of ["cancelGatewayRun(", "retryGatewayRun("]) expect(root).toMatch(new RegExp(`runControlCall\\(\\(\\) => ${call.replace("(", "\\(")}`));
  });
});

describe("VER-DEF-003 Live Builder domain errors are mapped, and public chat input is bounded", () => {
  it("proposal/selection/preview/validate/deployment calls are wrapped in liveBuilderCall", () => {
    const src = read("server/routers.ts");
    for (const fn of ["proposeLiveBuilderFileChange(", "proposeLiveBuilderPromptChange(", "setLiveBuilderSelection(", "startLiveBuilderPreview(", "validateLiveBuilderWorkspace(", "requestLiveBuilderDeployment("]) {
      expect(src).toContain(`liveBuilderCall(() => ${fn}`);
    }
  });
  it("legacy chat.sendMessage bounds message, history length and history entries", () => {
    const src = read("server/routers.ts");
    const i = src.indexOf("sendMessage: publicProcedure");
    const region = src.slice(i, i + 900);
    expect(region).toMatch(/\.max\(20_000\)/);
    expect(region).toMatch(/\.max\(50\)/);
  });
});

import { resolveSessionSecret, SessionSecretError } from "@/server/_core/session-secret";

describe("VER-DEF-004 session secret fails closed", () => {
  it("rejects a missing or blank secret in every environment", () => {
    for (const raw of [undefined, null, "", "   "]) {
      expect(() => resolveSessionSecret(raw, false)).toThrow(SessionSecretError);
      expect(() => resolveSessionSecret(raw, true)).toThrow(SessionSecretError);
    }
  });
  it("in production rejects short secrets and the documented placeholders", () => {
    expect(() => resolveSessionSecret("short", true)).toThrow(/32/);
    expect(() => resolveSessionSecret("replace-with-a-long-random-development-secret", true)).toThrow(/placeholder/);
    expect(() => resolveSessionSecret("your-secret-key-change-in-production-xxxxxxxxxxxx", true)).toThrow(SessionSecretError);
  });
  it("accepts a real secret and a short development secret outside production", () => {
    expect(resolveSessionSecret("x".repeat(40), true).length).toBe(40);
    expect(resolveSessionSecret("dev-secret", false).length).toBe(10);
  });
  it("sdk reads the secret only through resolveSessionSecret", () => {
    const src = read("server/_core/sdk.ts");
    expect(src).toContain("resolveSessionSecret(ENV.cookieSecret, ENV.isProduction)");
    expect(src).not.toMatch(/new TextEncoder\(\)\.encode\(secret\)/);
  });
});

import { assertVersionInWorkspace } from "@/server/live-builder/runtime-guard";
import { ChangeSetError, changeSetErrorCode } from "@/server/live-builder/atomic-apply";
import { startRunnerSafely, ControlPlaneProjectRunner, type IsolatedProjectRunner } from "@/server/live-builder/runner";

describe("VER-DEF-005 Live Builder runtime: version ownership and honest failure", () => {
  const input = { workspaceId: "ws-1", target: "phone", engine: "external_runner", versionId: null } as never;
  it("rejects a version id that is not part of the workspace (NOT_FOUND, no tenant probing)", () => {
    expect(() => assertVersionInWorkspace([{ id: "v1" }], "v-other")).toThrow(ChangeSetError);
    try { assertVersionInWorkspace([{ id: "v1" }], "v-other"); } catch (e) { expect(changeSetErrorCode(e)).toBe("NOT_FOUND"); }
    expect(() => assertVersionInWorkspace([{ id: "v1" }], "v1")).not.toThrow();
    expect(() => assertVersionInWorkspace([{ id: "v1" }], null)).not.toThrow();
  });
  it("a runner that throws becomes an honest failed result, never an exception and never 'ready'", async () => {
    const boom: IsolatedProjectRunner = { start: async () => { throw new Error("connect ECONNREFUSED 10.0.0.5:443"); } };
    const r = await startRunnerSafely(boom, input);
    expect(r.status).toBe("failed");
    expect(r.outputMode).toBe("unavailable");
    expect(r.url).toBeNull();
    expect(r.message).toMatch(/No project source was executed/);
    expect(r.diagnostics[0]?.code).toBe("RUNNER_START_FAILED");
  });
  it("with no external runner configured the real control-plane runner reports unavailable and executes nothing", async () => {
    delete process.env.GEMINIO_CONTAINER_RUNNER_URL; delete process.env.GEMINIO_MICROVM_RUNNER_URL; delete process.env.GEMINIO_RUNNER_PROVIDER;
    const r = await startRunnerSafely(new ControlPlaneProjectRunner(), input);
    expect(r.status).toBe("unavailable");
    expect(r.isolation).toBe("unavailable");
    expect(r.outputMode).toBe("unavailable");
    expect(r.diagnostics[0]?.code).toBe("EXTERNAL_RUNNER_UNAVAILABLE");
    expect(r.message).toMatch(/No project source was executed/);
  });
  it("even if a runner is 'configured', the microvm/container adapters never claim success without an adapter", async () => {
    process.env.GEMINIO_CONTAINER_RUNNER_URL = "https://runner.invalid"; process.env.GEMINIO_RUNNER_PROVIDER = "container";
    try { expect((await startRunnerSafely(new ControlPlaneProjectRunner(), input)).status).toBe("unavailable"); }
    finally { delete process.env.GEMINIO_CONTAINER_RUNNER_URL; delete process.env.GEMINIO_RUNNER_PROVIDER; }
  });
  it("runtime.ts wires the guards; any non-ready runner result is treated as failure", () => {
    const rt = read("server/live-builder/runtime.ts");
    expect(rt).toContain("assertVersionInWorkspace(workspace.versions, input.versionId)");
    expect(rt).toContain("startRunnerSafely(createProjectRunner(input.engine), input)");
    expect(rt).toContain('const unavailable = runnerResult.status !== "ready"');
    const routers = read("server/routers.ts");
    for (const fn of ["startLiveBuilderRuntime(", "stopLiveBuilderRuntime(", "restartLiveBuilderRuntime(", "rebuildLiveBuilderRuntime(", "getLiveBuilderRuntime(", "listLiveBuilderRuntimes(", "listRuntimeEvents("]) expect(routers).toContain(`liveBuilderCall(() => ${fn}`);
  });
});

describe("VER-DEF-006 Live Builder user-facing validation failures are ChangeSetError (4xx), not bare Error (500)", () => {
  const svc = read("server/live-builder/service.ts");
  it("workspace/file/version/path/credential validation use ChangeSetError", () => {
    for (const m of ["does not belong to this account.", "is not part of this workspace.", "Choose a valid workspace version", "is not permitted in a Live Builder workspace.", "appears to contain a raw credential", "is not part of the current preview."]) {
      const line = svc.split("\n").find((l) => l.includes(m) && l.includes("throw"))!;
      expect(line, m).toBeDefined();
      expect(line, m).toContain("new ChangeSetError(");
    }
  });
  it("maps each code to the expected HTTP-class code", () => {
    expect(changeSetErrorCode(new ChangeSetError("WORKSPACE_UNAVAILABLE", "x"))).toBe("NOT_FOUND");
    expect(changeSetErrorCode(new ChangeSetError("UNSAFE_PATH", "x"))).toBe("BAD_REQUEST");
    expect(changeSetErrorCode(new ChangeSetError("INVALID_CONTENT", "x"))).toBe("BAD_REQUEST");
    expect(changeSetErrorCode(new Error("db"))).toBe("INTERNAL_SERVER_ERROR");
  });
});

import { sendHomeMessage, type PipelineDeps, type SubmitFn } from "@/server/home-chat/pipeline";
import { getBalance, toMicro } from "@/server/credits/ledger";
import { SqliteCreditStore } from "./helpers/sqlite-credit-store";
import { classifyDuplicateSubmit } from "@/server/ai-core/run-guard";

describe("VER-DEF-007 idempotent submit: same requestId never creates a second run", () => {
  it("classifies new / replay / conflict", () => {
    expect(classifyDuplicateSubmit(null, "hi")).toBe("new");
    expect(classifyDuplicateSubmit({ input: "hi" }, "hi")).toBe("replay");
    expect(classifyDuplicateSubmit({ input: "hi" }, "different")).toBe("conflict");
  });
  it("orchestrator checks for a prior run before it creates a conversation, message, task or job", () => {
    const src = read("server/ai-core/orchestrator.ts");
    const fn = src.slice(src.indexOf("export async function submitAiRequest"));
    const idx = (needle: string) => fn.indexOf(needle);
    const prior = idx("getOrchestrationRunByRequest(userId, input.requestId)");
    expect(prior).toBeGreaterThan(0);
    for (const later of ["consumeRateLimit(userId)", "createConversation(", "insertAgentTask(", "appendConversationMessage(", "enqueueAiJob("]) expect(idx(later), later).toBeGreaterThan(prior);
    // and it handles losing the unique-index race instead of carrying on with fresh ids
    expect(fn).toContain("run.id !== runId");
    expect(read("server/ai-core/persistence.ts")).toMatch(/Concurrent duplicate submit/);
  });
});

describe("VER-DEF-008 a duplicate send must not release the original request's credit hold", () => {
  let n = 0;
  const make = (submit: SubmitFn) => {
    const store = new SqliteCreditStore(); store.seed(1, toMicro(10));
    const deps: PipelineDeps = { credits: store, searchProvider: null, submit, kickWorker: () => undefined, env: {}, newId: (p) => `${p}_${++n}` };
    return { store, deps };
  };
  const ok: SubmitFn = async () => ({ runId: "run-1", taskId: "t-1", conversationId: "c-1", status: "accepted", error: null });
  const input = { message: "hello there", conversationId: null, webSearch: "off" as const, temporary: false, clientRequestId: "client-req-0001" };

  it("same clientRequestId twice holds credits once", async () => {
    const w = make(ok);
    await sendHomeMessage(w.deps, 1, input);
    await sendHomeMessage(w.deps, 1, input);
    expect(await getBalance(w.store, 1)).toEqual({ balance: 10, reserved: 1, available: 9 });
  });
  it("if the duplicate's submit fails, the original's reservation stays held", async () => {
    let calls = 0;
    const w = make(async (...a) => { calls++; if (calls === 2) throw new Error("AI Core durable storage is unavailable."); return ok(...a); });
    const first = await sendHomeMessage(w.deps, 1, input);
    expect(first.ok).toBe(true);
    const second = await sendHomeMessage(w.deps, 1, input);
    expect(second.ok).toBe(false);
    expect(await getBalance(w.store, 1)).toEqual({ balance: 10, reserved: 1, available: 9 }); // before the fix this dropped to reserved 0 (original ran free)
  });
  it("a first-time failure still releases its own hold", async () => {
    const w = make(async () => { throw new Error("AI Core durable storage is unavailable."); });
    expect((await sendHomeMessage(w.deps, 1, input)).ok).toBe(false);
    expect(await getBalance(w.store, 1)).toEqual({ balance: 10, reserved: 0, available: 10 });
  });
});

describe("VER-DEF-009 revoking an unknown preview session is NOT_FOUND, not a 500", () => {
  it("revokePreviewSession converts the gateway's not-found error", () => {
    const src = read("server/routers.ts");
    const i = src.indexOf("revokePreviewSession:");
    const region = src.slice(i, i + 700);
    expect(region).toContain('code: "NOT_FOUND"');
    const g = new PreviewGateway();
    expect(() => g.revoke(1, "preview_missing")).toThrow(/not found/i);
  });
  it("a session is only revocable by its owner", async () => {
    const g = new PreviewGateway();
    const s = g.create({ userId: 1, workspaceId: "ws-1" });
    expect(() => g.revoke(2, s.id)).toThrow(/not found/i);
    expect(g.revoke(1, s.id).authState).toBe("revoked");
    expect(() => g.authorize(1, s.id)).toThrow(/revoked/);
  });
});

describe("VER-DEF-010 user-data writes are scoped to the owner (approvals could be resolved across tenants)", () => {
  const data = read("server/geminio-data.ts");
  const updates = [...data.matchAll(/db\.update\((\w+)\)[^;]*?;/g)].map((m) => m[0]);
  it("every UPDATE in geminio-data.ts carries a userId predicate", () => {
    expect(updates.length).toBeGreaterThanOrEqual(4);
    for (const u of updates) expect(u, u.slice(0, 80)).toMatch(/\.userId, userId\)/);
  });
  it("wiring: geminio-data builds the owner+pending UPDATE and the router uses resolveAndResume results (behaviour: tests/task-approvals.db.test.ts)", () => {
    const i = data.indexOf("function drizzleApprovalStore");
    const body = data.slice(i, i + 900);
    expect(body).toMatch(/taskApprovals\.userId, userId/);
    expect(body).toMatch(/taskApprovals\.status, "pending"/);
    const router = read("server/routers.ts");
    expect(router).toContain("approvalOutcomeError(result.outcome)");
    expect(router).not.toMatch(/resumeApprovedTask\(ctx\.user\.id, approval\.taskId\)/); // resume only via the resolve-once callback
  });
});

describe("VER-DEF-011 client-supplied project ids must belong to the caller (static check; no DB available for a behavioural one)", () => {
  it("submitAiRequest and assistant.createTask verify project ownership before any write", () => {
    const orch = read("server/ai-core/orchestrator.ts");
    const fn = orch.slice(orch.indexOf("export async function submitAiRequest"));
    const own = fn.indexOf("userOwnsProject(userId, input.projectId)");
    expect(own).toBeGreaterThan(0);
    for (const later of ["createConversation(", "insertAgentTask(", "enqueueAiJob("]) expect(fn.indexOf(later), later).toBeGreaterThan(own);
    const routers = read("server/routers.ts");
    const create = routers.slice(routers.indexOf("createTask: protectedProcedure"));
    expect(create.indexOf("userOwnsProject(ctx.user.id, input.projectId)")).toBeGreaterThan(0);
    expect(create.indexOf("userOwnsProject(")).toBeLessThan(create.indexOf("insertAgentTask("));
    expect(read("server/ai-core/persistence.ts")).toMatch(/projects\.userId, userId/);
  });
});

describe("VER-DEF-012 every Live Builder workspace UPDATE in the service carries the owner predicate", () => {
  it("static scan of db.update(liveBuilderWorkspaces) in service.ts", () => {
    const svc = read("server/live-builder/service.ts");
    const updates = [...svc.matchAll(/db\.update\(liveBuilderWorkspaces\)[^;]*;/g)].map((m) => m[0]);
    expect(updates.length).toBeGreaterThanOrEqual(1);
    for (const u of updates) expect(u).toMatch(/liveBuilderWorkspaces\.userId, userId/);
  });
});

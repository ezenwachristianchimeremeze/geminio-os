import { describe, expect, it } from "vitest";
import { buildPlanFromRoles, buildTemplatePlan, completedCount, estimateSteps, listPlanTypes, planForRetry, runPlan, validatePlanSelection, type EngineDeps, type Plan, type PlanStep } from "../server/ai-core/multistep";

const step = (id: string, extra: Partial<PlanStep> = {}): PlanStep => ({ id, capability: "conversation.reply", title: id, input: {}, risk: "read_only", requiresApproval: false, status: "pending", output: null, error: null, ...extra });
const mkPlan = (...steps: PlanStep[]): Plan => ({ version: 1, intent: {}, steps, verification: [] });
function harness(over: Partial<EngineDeps<PlanStep>> = {}) {
  const events: string[] = []; const persisted: Plan[] = []; const ran: string[] = []; const seenPrev: string[][] = [];
  const deps: EngineDeps<PlanStep> = {
    runStep: async (s, ctx) => { ran.push(s.id); seenPrev.push(ctx.previous.map((p) => p.id)); return { text: `out:${s.id}` }; },
    isCancelled: async () => false, persist: async (p) => { persisted.push(structuredClone(p)); }, emit: async (t) => { events.push(t); },
    approvedStepIds: new Set(), ...over,
  };
  return { deps, events, persisted, ran, seenPrev };
}

describe("multi-step engine", () => {
  it("runs steps in order, passes previous outputs, returns the last output", async () => {
    const h = harness();
    const r = await runPlan(mkPlan(step("a"), step("b"), step("c")), h.deps);
    expect(r.kind).toBe("completed");
    expect(h.ran).toEqual(["a", "b", "c"]);
    expect(h.seenPrev).toEqual([[], ["a"], ["a", "b"]]);
    expect(r.kind === "completed" && r.finalOutput).toEqual({ text: "out:c" });
    expect(h.events.filter((e) => e === "step_completed")).toHaveLength(3);
  });
  it("persists status BEFORE each effect (running is durable while a step executes)", async () => {
    const h = harness();
    await runPlan(mkPlan(step("a")), h.deps);
    expect(h.persisted.map((p) => p.steps[0].status)).toEqual(["running", "completed"]);
  });
  it("stops at a failed step, records the error, never runs later steps", async () => {
    const h = harness({ runStep: async (s) => { if (s.id === "b") throw Object.assign(new Error("provider down"), { retryable: true }); return { text: s.id }; } });
    const r = await runPlan(mkPlan(step("a"), step("b"), step("c")), h.deps);
    expect(r).toMatchObject({ kind: "failed", stepId: "b", completedSteps: 1, error: { message: "provider down", retryable: true } });
    expect(r.plan.steps.map((s) => s.status)).toEqual(["completed", "failed", "pending"]);
  });
  it("retry resumes at the failed step without re-running completed ones", async () => {
    let fail = true; const ran: string[] = [];
    const deps = harness({ runStep: async (s) => { ran.push(s.id); if (s.id === "b" && fail) throw new Error("x"); return { text: s.id }; } }).deps;
    const first = await runPlan(mkPlan(step("a"), step("b"), step("c")), deps);
    fail = false;
    const second = await runPlan(planForRetry(first.plan), deps);
    expect(second.kind).toBe("completed");
    expect(ran).toEqual(["a", "b", "b", "c"]);
  });
  it("is idempotent: a fully completed plan runs nothing", async () => {
    const h = harness();
    const done = await runPlan(mkPlan(step("a"), step("b")), h.deps);
    const h2 = harness();
    const again = await runPlan(done.plan, h2.deps);
    expect(h2.ran).toEqual([]); expect(again.kind).toBe("completed");
  });
  it("cancellation is honoured between steps", async () => {
    let calls = 0;
    const h = harness({ isCancelled: async () => ++calls > 1 });
    const r = await runPlan(mkPlan(step("a"), step("b"), step("c")), h.deps);
    expect(r).toMatchObject({ kind: "cancelled", completedSteps: 1 });
    expect(h.ran).toEqual(["a"]);
  });
  it("pauses at an approval-gated step and approval unlocks ONLY that step", async () => {
    const plan = mkPlan(step("a"), step("g1", { requiresApproval: true }), step("g2", { requiresApproval: true }));
    const h = harness();
    const w1 = await runPlan(plan, h.deps);
    expect(w1).toMatchObject({ kind: "waiting_for_approval", stepId: "g1" });
    expect(h.ran).toEqual(["a"]);
    const h2 = harness({ approvedStepIds: new Set(["g1"]) });
    const w2 = await runPlan(w1.plan, h2.deps);
    expect(w2).toMatchObject({ kind: "waiting_for_approval", stepId: "g2" });
    expect(h2.ran).toEqual(["g1"]);
  });
  it("a crash mid-step leaves 'running', and retry reruns only that step", async () => {
    const crashed = mkPlan(step("a", { status: "completed", output: { text: "a" } }), step("b", { status: "running" }), step("c"));
    const h = harness();
    const r = await runPlan(planForRetry(crashed), h.deps);
    expect(h.ran).toEqual(["b", "c"]); expect(r.kind).toBe("completed");
  });
  it("does not mutate the caller's plan object", async () => {
    const plan = mkPlan(step("a")); await runPlan(plan, harness().deps);
    expect(plan.steps[0].status).toBe("pending");
  });
});

describe("templates", () => {
  it("builds deterministic role steps with a single final step", () => {
    const p = buildTemplatePlan("deep_research", { intent: {}, capability: "conversation.reply", risk: "read_only", input: { webContext: "w" }, verification: [] });
    expect(p.steps.map((s) => s.title)).toEqual(["Research", "Analysis", "Final answer"]);
    expect(p.steps.map((s) => s.input.finalStep)).toEqual([false, false, true]);
    expect(p.steps.every((s) => s.status === "pending" && s.input.webContext === "w")).toBe(true);
    expect(estimateSteps("code_review")).toBe(3); expect(completedCount(p)).toBe(0);
  });
});

describe("plan registry & policy", () => {
  const ok = (r: any) => r.ok === true;
  it("accepts defaults and valid edits (reorder / drop / add allowed roles)", () => {
    expect(ok(validatePlanSelection({ type: "deep_research" }))).toBe(true);
    const v = validatePlanSelection({ type: "deep_research", roleIds: ["researcher", "critic", "analyst", "writer"] });
    expect(v.ok && v.roles.map((r) => r.title)).toEqual(["Research", "Critique", "Analysis", "Final answer"]);
    expect(ok(validatePlanSelection({ type: "code_review", roleIds: ["developer", "documenter"] }))).toBe(true);
  });
  it("rejects unknown types and unknown/foreign roles (the model or client cannot invent steps)", () => {
    expect(validatePlanSelection({ type: "run_shell" })).toMatchObject({ ok: false });
    const r = validatePlanSelection({ type: "deep_research", roleIds: ["researcher", "shell_exec", "writer"] }) as any;
    expect(r.ok).toBe(false); expect(r.problems.join(" ")).toContain("unknown step");
    expect((validatePlanSelection({ type: "deep_research", roleIds: ["developer", "writer"] }) as any).problems.join(" ")).toContain("not allowed");
  });
  it("enforces length, duplicates, and a single final role placed last", () => {
    expect(ok(validatePlanSelection({ type: "deep_research", roleIds: ["writer"] }))).toBe(false);
    expect(ok(validatePlanSelection({ type: "deep_research", roleIds: ["researcher", "analyst", "critic", "researcher", "analyst", "writer"] }))).toBe(false);
    expect((validatePlanSelection({ type: "deep_research", roleIds: ["researcher", "researcher", "writer"] }) as any).problems.join(" ")).toContain("twice");
    expect(ok(validatePlanSelection({ type: "deep_research", roleIds: ["writer", "researcher"] }))).toBe(false);
    expect(ok(validatePlanSelection({ type: "deep_research", roleIds: ["researcher", "analyst"] }))).toBe(false);
  });
  it("estimates from the validated selection and exposes plan types for the UI", () => {
    expect(estimateSteps("deep_research")).toBe(3); expect(estimateSteps("deep_research", ["researcher", "writer"])).toBe(2); expect(estimateSteps("nope")).toBe(0);
    expect(listPlanTypes().map((t) => t.id)).toEqual(["deep_research", "code_review"]);
  });
  it("builds a plan from validated roles only", () => {
    const v = validatePlanSelection({ type: "code_review" }); if (!v.ok) throw new Error("x");
    const p = buildPlanFromRoles(v.roles, { intent: {}, capability: "conversation.reply", risk: "read_only", input: {}, verification: [] });
    expect(p.steps.map((s) => s.input.stepRoleId)).toEqual(["developer", "tester", "documenter"]);
  });
});

describe("pause between steps", () => {
  it("stops before the next step with the plan saved, and resume continues without re-running completed steps", async () => {
    let paused = false;
    const h = harness({ shouldPause: async () => paused, runStep: async (s) => { if (s.id === "a") paused = true; return { text: s.id }; } });
    const first = await runPlan(mkPlan(step("a"), step("b"), step("c")), h.deps);
    expect(first).toMatchObject({ kind: "paused", completedSteps: 1 });
    expect(first.plan.steps.map((x) => x.status)).toEqual(["completed", "pending", "pending"]);
    expect(h.events).toContain("paused");
    paused = false;
    const h2 = harness();
    const second = await runPlan(first.plan, h2.deps);
    expect(second.kind).toBe("completed"); expect(h2.ran).toEqual(["b", "c"]);
  });
  it("a pause requested during the last step does not discard its result", async () => {
    let paused = false;
    const h = harness({ shouldPause: async () => paused, runStep: async (s) => { if (s.id === "b") paused = true; return { text: s.id }; } });
    expect((await runPlan(mkPlan(step("a"), step("b")), h.deps)).kind).toBe("completed");
  });
  it("cancel wins over pause", async () => {
    const h = harness({ isCancelled: async () => true, shouldPause: async () => true });
    expect((await runPlan(mkPlan(step("a"), step("b")), h.deps)).kind).toBe("cancelled");
  });
});

/**
 * Multi-step plan engine (pure; all effects are injected). Properties:
 *  - progress lives IN the plan (step.status/output/error), so a stored plan is a durable resume point;
 *  - completed steps are never re-run on resume (no duplicate side effects or duplicate charges);
 *  - approval is per step: approving resumes only the step that is waiting, later gated steps pause again;
 *  - cancellation is checked before every step; a failed step stops the run (no later step sees a missing input);
 *  - every status change is persisted BEFORE the next effect, so a crash leaves an accurate plan.
 */
export type StepStatus = "pending" | "running" | "waiting_for_approval" | "completed" | "failed" | "skipped";
export type PlanStep = { id: string; capability: string; title: string; input: Record<string, unknown>; risk: string; requiresApproval: boolean; status: StepStatus; output: Record<string, unknown> | null; error: { code: string; message: string; retryable: boolean; requestId?: string } | null };
export type Plan<S extends PlanStep = PlanStep> = { version: 1; intent: unknown; steps: S[]; verification: string[] };

export type StepContext = { index: number; total: number; previous: { id: string; title: string; output: Record<string, unknown> }[] };
export type EngineDeps<S extends PlanStep> = {
  runStep(step: S, ctx: StepContext): Promise<Record<string, unknown>>;
  isCancelled(): Promise<boolean>;
  /** Pause is honoured between steps (a provider call in flight cannot be interrupted). Optional. */
  shouldPause?(): Promise<boolean>;
  persist(plan: Plan<S>): Promise<void>;
  emit(type: string, payload: Record<string, unknown>): Promise<void>;
  /** True only for the step that the user approved (the one currently waiting). */
  approvedStepIds: ReadonlySet<string>;
  now?: () => number;
};

export type Outcome<S extends PlanStep> =
  | { kind: "completed"; plan: Plan<S>; finalOutput: Record<string, unknown>; completedSteps: number }
  | { kind: "waiting_for_approval"; plan: Plan<S>; stepId: string }
  | { kind: "failed"; plan: Plan<S>; stepId: string; error: NonNullable<PlanStep["error"]>; completedSteps: number }
  | { kind: "paused"; plan: Plan<S>; completedSteps: number }
  | { kind: "cancelled"; plan: Plan<S>; completedSteps: number };

const clone = <T,>(v: T): T => structuredClone(v);
export const completedCount = (p: { steps: { status: StepStatus }[] }) => p.steps.filter((s) => s.status === "completed").length;

export async function runPlan<S extends PlanStep>(input: Plan<S>, deps: EngineDeps<S>): Promise<Outcome<S>> {
  const plan = clone(input);
  const total = plan.steps.length;
  for (let i = 0; i < total; i++) {
    const step = plan.steps[i];
    if (step.status === "completed" || step.status === "skipped") continue;
    if (await deps.isCancelled()) return { kind: "cancelled", plan, completedSteps: completedCount(plan) };
    if (deps.shouldPause && (await deps.shouldPause())) { await deps.persist(plan); await deps.emit("paused", { atStep: i, total }); return { kind: "paused", plan, completedSteps: completedCount(plan) }; }

    if (step.requiresApproval && !deps.approvedStepIds.has(step.id)) {
      step.status = "waiting_for_approval";
      await deps.persist(plan);
      await deps.emit("approval_requested", { stepId: step.id, title: step.title });
      return { kind: "waiting_for_approval", plan, stepId: step.id };
    }

    step.status = "running"; step.error = null;
    await deps.persist(plan);
    await deps.emit("step_started", { stepId: step.id, title: step.title, index: i, total });
    const previous = plan.steps.slice(0, i).filter((s) => s.status === "completed" && s.output).map((s) => ({ id: s.id, title: s.title, output: s.output as Record<string, unknown> }));
    try {
      const output = await deps.runStep(step, { index: i, total, previous });
      step.status = "completed"; step.output = output; step.error = null;
      await deps.persist(plan);
      await deps.emit("step_completed", { stepId: step.id, title: step.title, index: i, total });
    } catch (e) {
      const error = { code: "step_failed", message: e instanceof Error ? e.message : "Step failed.", retryable: Boolean((e as { retryable?: unknown })?.retryable) };
      step.status = "failed"; step.error = error;
      await deps.persist(plan);
      await deps.emit("step_failed", { stepId: step.id, title: step.title, message: error.message, retryable: error.retryable });
      return { kind: "failed", plan, stepId: step.id, error, completedSteps: completedCount(plan) };
    }
  }
  const last = [...plan.steps].reverse().find((s) => s.status === "completed" && s.output);
  return { kind: "completed", plan, finalOutput: (last?.output ?? {}) as Record<string, unknown>, completedSteps: completedCount(plan) };
}

/** Resets the failed step (and only it) so a retry resumes exactly where the run stopped. */
export function planForRetry<S extends PlanStep>(plan: Plan<S>): Plan<S> {
  const p = clone(plan);
  for (const s of p.steps) if (s.status === "failed" || s.status === "running") { s.status = "pending"; s.error = null; }
  return p;
}

// ---------- plan registry (the model never invents steps; only registered roles/plan types can run) ----------
export type RoleDef = { id: string; title: string; instruction: string; final?: boolean };
export const ROLE_REGISTRY: Record<string, RoleDef> = {
  researcher: { id: "researcher", title: "Research", instruction: "You are the Research agent. Gather the key facts, considerations and uncertainties relevant to the request. Use any web context provided and cite it as [n]. Output concise structured notes, not a final answer." },
  analyst: { id: "analyst", title: "Analysis", instruction: "You are the Analysis agent. Using the earlier notes, identify the strongest conclusions, gaps, risks and counter-arguments. Flag anything unsupported. Output structured analysis, not a final answer." },
  critic: { id: "critic", title: "Critique", instruction: "You are the Critic agent. Challenge the earlier work: find errors, weak assumptions and missing cases. Output a concise list of concrete problems, not a final answer." },
  developer: { id: "developer", title: "Implementation plan", instruction: "You are the Developer agent. Propose a concrete implementation or fix with code. Do not claim it was run." },
  tester: { id: "tester", title: "Test review", instruction: "You are the Testing agent. Review the proposed code for bugs, edge cases and missing tests, and list concrete test cases. Do not claim anything was executed." },
  writer: { id: "writer", title: "Final answer", final: true, instruction: "You are the Writer agent. Produce the single final answer for the user using the earlier work. Be clear and well structured. Do not mention internal agents or steps." },
  documenter: { id: "documenter", title: "Final answer", final: true, instruction: "You are the Documentation agent. Produce the single final answer: the corrected code, the key tests, and brief notes. Do not mention internal agents." },
};
export type PlanTypeDef = { id: string; label: string; description: string; defaultRoles: string[]; allowedRoles: string[]; minSteps: number; maxSteps: number };
export const PLAN_TYPES: Record<string, PlanTypeDef> = {
  deep_research: { id: "deep_research", label: "Deep research", description: "Research, analyse, then write one final answer.", defaultRoles: ["researcher", "analyst", "writer"], allowedRoles: ["researcher", "analyst", "critic", "writer"], minSteps: 2, maxSteps: 5 },
  code_review: { id: "code_review", label: "Code review", description: "Propose a fix, review it for bugs and tests, then document the result.", defaultRoles: ["developer", "tester", "documenter"], allowedRoles: ["developer", "tester", "critic", "documenter"], minSteps: 2, maxSteps: 5 },
};
export type TemplateName = string;
export const listPlanTypes = () => Object.values(PLAN_TYPES).map((t) => ({ id: t.id, label: t.label, description: t.description, defaultRoles: t.defaultRoles, allowedRoles: t.allowedRoles.map((r) => ({ id: r, title: ROLE_REGISTRY[r].title, final: Boolean(ROLE_REGISTRY[r].final) })), minSteps: t.minSteps, maxSteps: t.maxSteps }));

export type PlanSelection = { type: string; roleIds?: string[] };
export type ValidatedSelection = { ok: true; type: string; roles: RoleDef[] } | { ok: false; problems: string[] };
/** Server policy for any plan, default or user-edited: registered type, registered+allowed roles, bounded length, exactly one final role and it is last. */
export function validatePlanSelection(sel: PlanSelection): ValidatedSelection {
  const def = PLAN_TYPES[sel.type];
  if (!def) return { ok: false, problems: [`Unknown plan type "${String(sel.type).slice(0, 40)}".`] };
  const ids = sel.roleIds && sel.roleIds.length > 0 ? sel.roleIds : def.defaultRoles;
  const problems: string[] = [];
  if (ids.length < def.minSteps) problems.push(`A ${def.label} plan needs at least ${def.minSteps} steps.`);
  if (ids.length > def.maxSteps) problems.push(`A ${def.label} plan allows at most ${def.maxSteps} steps.`);
  const seen = new Set<string>();
  ids.forEach((r, i) => {
    const role = ROLE_REGISTRY[r];
    if (!role) { problems.push(`Step ${i + 1}: unknown step "${String(r).slice(0, 40)}".`); return; }
    if (!def.allowedRoles.includes(r)) problems.push(`Step ${i + 1}: "${role.title}" is not allowed in a ${def.label} plan.`);
    if (seen.has(r)) problems.push(`Step ${i + 1}: "${role.title}" is used twice.`);
    seen.add(r);
    const last = i === ids.length - 1;
    if (role.final && !last) problems.push(`Step ${i + 1}: "${role.title}" must be the last step.`);
    if (!role.final && last) problems.push("The last step must produce the final answer.");
  });
  return problems.length ? { ok: false, problems } : { ok: true, type: def.id, roles: ids.map((r) => ROLE_REGISTRY[r]) };
}

export function buildPlanFromRoles(roles: RoleDef[], base: { intent: unknown; capability: string; risk: string; input: Record<string, unknown>; verification: string[] }): Plan {
  return {
    version: 1, intent: base.intent, verification: base.verification,
    steps: roles.map((r, i) => ({ id: `step_${i + 1}_${r.id}`, capability: base.capability, title: r.title, input: { ...base.input, stepRole: r.instruction, stepRoleId: r.id, finalStep: i === roles.length - 1 }, risk: base.risk, requiresApproval: false, status: "pending" as const, output: null, error: null })),
  };
}
/** Back-compat: default roles of a plan type. */
export function buildTemplatePlan(template: string, base: { intent: unknown; capability: string; risk: string; input: Record<string, unknown>; verification: string[] }): Plan {
  const v = validatePlanSelection({ type: template });
  if (!v.ok) throw new Error(v.problems.join(" "));
  return buildPlanFromRoles(v.roles, base);
}
export const estimateSteps = (template: string, roleIds?: string[]) => { const v = validatePlanSelection({ type: template, roleIds }); return v.ok ? v.roles.length : 0; };
export const TEMPLATES = Object.fromEntries(Object.values(PLAN_TYPES).map((t) => [t.id, t.defaultRoles.map((r) => ROLE_REGISTRY[r])])) as Record<string, RoleDef[]>;

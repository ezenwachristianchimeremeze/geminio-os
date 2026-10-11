/**
 * AI Builder stage machine (pure, no I/O).
 * Prompt → Requirements → Plan → Code → Preview → Edit → Test → Debug → Rebuild → Validate → Deploy
 */
export const STAGES = [
  "prompt",
  "requirements",
  "plan",
  "code",
  "preview",
  "edit",
  "test",
  "debug",
  "rebuild",
  "validate",
  "deploy",
] as const;
export type BuilderStage = (typeof STAGES)[number];

export type BuilderStatus = "idle" | "running" | "waiting_for_user" | "failed" | "completed" | "cancelled";

const FORWARD: Record<BuilderStage, BuilderStage[]> = {
  prompt: ["requirements"],
  requirements: ["plan", "requirements"],
  plan: ["code", "requirements"],
  code: ["preview", "code"],
  preview: ["edit", "test"],
  edit: ["rebuild", "preview", "edit"],
  test: ["validate", "debug"],
  debug: ["edit", "rebuild", "test"],
  rebuild: ["preview", "test"],
  validate: ["deploy", "debug", "edit"],
  deploy: [],
};

export function canAdvance(from: BuilderStage, to: BuilderStage): boolean {
  return FORWARD[from].includes(to);
}

export function assertAdvance(from: BuilderStage, to: BuilderStage): void {
  if (!canAdvance(from, to)) {
    throw new Error(`Invalid AI Builder transition: ${from} → ${to}.`);
  }
}

/** Deployment is irreversible/high impact: always needs explicit approval. */
export function stageRequiresApproval(stage: BuilderStage): boolean {
  return stage === "deploy";
}

export function stageProgress(stage: BuilderStage): number {
  return Math.round((STAGES.indexOf(stage) / (STAGES.length - 1)) * 100);
}

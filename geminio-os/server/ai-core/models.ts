/**
 * Model selection. No model name is hard-coded in AI Core.
 *
 * Resolution order (first defined wins):
 *   1. AI_MODEL_<CAPABILITY>   e.g. AI_MODEL_BUILDER_LIVE_EDIT   (capability id upper-cased, non-alphanumerics -> _)
 *   2. AI_MODEL_LEVEL_<LEVEL>  e.g. AI_MODEL_LEVEL_ADVANCED
 *   3. AI_MODEL_DEFAULT
 *   4. undefined -> the provider's own default model
 *
 * "AI level" is a deployment-defined tier name (the blueprint names the concept of AI levels but
 * does not define them), selected with AI_DEFAULT_LEVEL or per request; it only chooses a model.
 */
export type ModelEnv = Record<string, string | undefined>;

const LEVEL = /^[a-z][a-z0-9_]{0,31}$/;

export function envKeyForCapability(capability: string): string {
  return `AI_MODEL_${capability.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;
}

export function resolveAiLevel(env: ModelEnv, requested?: string | null): string {
  const candidate = (requested ?? env.AI_DEFAULT_LEVEL ?? "standard").toLowerCase();
  return LEVEL.test(candidate) ? candidate : "standard";
}

export function resolveModel(env: ModelEnv, input: { capability?: string | null; level?: string | null } = {}): string | undefined {
  const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);
  if (input.capability) {
    const byCapability = clean(env[envKeyForCapability(input.capability)]);
    if (byCapability) return byCapability;
  }
  const level = resolveAiLevel(env, input.level);
  return clean(env[`AI_MODEL_LEVEL_${level.toUpperCase()}`]) ?? clean(env.AI_MODEL_DEFAULT);
}

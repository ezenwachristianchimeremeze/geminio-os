import { runMetered } from "../credits/metered-llm";
import { AsyncLocalStorage } from "node:async_hooks";
import { setAiBuilderLlm, type AiBuilderLlm } from "../../lib/ai-builder/llm-port";
import { normalizeProviderError, resolveProvider } from "../ai-core/providers";
import { consumeRateLimit, recordAiAudit } from "../ai-core/security";

/**
 * Binds the AI Builder LLM port to the AI Core provider layer.
 * - user context via AsyncLocalStorage (concurrency-safe, no globals)
 * - per-user rate limiting shared with AI Core
 * - timeout + bounded retry for retryable provider failures
 * - audit record for every call (success and failure)
 */
const userContext = new AsyncLocalStorage<{ userId: number; builderProjectId: string }>();

export function withBuilderContext<T>(ctx: { userId: number; builderProjectId: string }, fn: () => Promise<T>): Promise<T> {
  return userContext.run(ctx, fn);
}

const TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 3;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("AI provider timeout"), { retryable: true })), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

export const aiCoreBackedLlm: AiBuilderLlm = async (request) => {
  const ctxForMeter = userContext.getStore();
  if (!ctxForMeter) throw new Error("AI Builder LLM calls require an authenticated builder context.");
  // One reservation per logical call (covers its retries): charged only if a result is produced, released otherwise.
  const { getMysqlCreditStore } = await import("../credits/mysql-store");
  return runMetered(await getMysqlCreditStore(), process.env, { userId: ctxForMeter.userId, capability: `ai_builder.${request.operation}` }, () => unmeteredAiCoreBackedLlm(request));
};

const unmeteredAiCoreBackedLlm: AiBuilderLlm = async (request) => {
  const ctx = userContext.getStore();
  if (!ctx) throw new Error("AI Builder LLM calls require an authenticated builder context.");
  if (!consumeRateLimit(ctx.userId)) {
    await recordAiAudit({ userId: ctx.userId, action: "ai_builder.llm.rate_limited", resource: request.operation, status: "warning", details: { builderProjectId: ctx.builderProjectId } });
    throw new Error("AI request rate limit exceeded. Please retry shortly.");
  }
  const provider = resolveProvider(); // throws ProviderUnavailableError when nothing is configured
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await withTimeout(
        provider.invoke({
          messages: [
            ...(request.system ? [{ role: "system" as const, content: request.system }] : []),
            { role: "user" as const, content: request.prompt },
          ],
          maxTokens: request.maxTokens,
        }),
        TIMEOUT_MS,
      );
      const content = response.result.choices[0]?.message?.content;
      const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((p) => ("text" in p ? String(p.text) : "")).join("\n") : "";
      await recordAiAudit({ userId: ctx.userId, action: "ai_builder.llm.call", resource: request.operation, status: "success", details: { builderProjectId: ctx.builderProjectId, provider: provider.provider, model: response.model, attempt, latencyMs: response.latencyMs, usage: response.result.usage ?? null } });
      return { text, model: response.model };
    } catch (error) {
      lastError = error;
      const failure = normalizeProviderError(error, provider.provider);
      const retryable = failure.retryable || Boolean((error as { retryable?: boolean })?.retryable);
      await recordAiAudit({ userId: ctx.userId, action: "ai_builder.llm.call", resource: request.operation, status: "error", details: { builderProjectId: ctx.builderProjectId, provider: provider.provider, attempt, code: failure.code, retryable } });
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("AI provider request failed.");
};

let registered = false;
export function registerAiBuilderLlm() {
  if (registered) return;
  setAiBuilderLlm(aiCoreBackedLlm);
  registered = true;
}

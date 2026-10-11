/**
 * Metered wrapper for direct LLM calls made by legacy routers (features, chat extras, jobs, builders).
 * authenticate (caller) -> reserve -> call -> finalize on success / release on ANY failure. Never charges for a failed call.
 * The model is chosen by server configuration; a model name hard-coded at the call site is ignored.
 */
import { randomUUID } from "node:crypto";
import { finalizeReservation, releaseReservation, type CreditStore } from "./ledger";
import { reserveForRun } from "./metering";

export async function runMetered<T>(store: CreditStore, env: Record<string, string | undefined>, input: { userId: number; capability: string; requestId?: string }, fn: () => Promise<T>): Promise<T> {
  const requestId = input.requestId ?? `llm_${randomUUID()}`.slice(0, 64);
  const reservation = await reserveForRun(store, env, { userId: input.userId, requestId, capability: input.capability, steps: 1, id: `res_${randomUUID()}`.slice(0, 64) });
  // A replay of an already-settled request must not run (and be paid for) twice.
  if (reservation && reservation.status !== "reserved") throw new Error("This request was already processed.");
  try {
    const out = await fn();
    if (reservation) await finalizeReservation(store, reservation.id);
    return out;
  } catch (error) {
    if (reservation) await releaseReservation(store, reservation.id).catch((e) => console.error("[credits] release failed; reconciliation will retry", e instanceof Error ? e.message : e));
    throw error;
  }
}

type LlmParams = { model?: string } & Record<string, unknown>;
/** Drop-in replacement for invokeLLM(params) with a user and a capability name for pricing/audit. */
export async function meteredLLM<P extends LlmParams>(userId: number, capability: string, params: P) {
  const [{ invokeLLM }, { getMysqlCreditStore }, { resolveModel }] = await Promise.all([import("../_core/llm"), import("./mysql-store"), import("../ai-core/models")]);
  const model = resolveModel(process.env, { capability });
  const { model: _ignored, ...rest } = params;
  void _ignored;
  return runMetered(await getMysqlCreditStore(), process.env, { userId, capability }, () => invokeLLM({ ...(rest as Record<string, unknown>), ...(model ? { model } : {}) } as Parameters<typeof invokeLLM>[0]));
}

/**
 * Execute-once LLM call for legacy routers. With an idempotency key the SAME authorized operation can never run (or be charged)
 * twice; without one every call is its own operation (a distinct, explicit user action). Returns the provider response.
 */
export async function onceLLM<P extends LlmParams>(userId: number, capability: string, idempotencyKey: string | undefined, params: P) {
  const [{ invokeLLM }, { getMysqlCreditStore }, { resolveModel }, { getMysqlOperationStore }, ops] = await Promise.all([import("../_core/llm"), import("./mysql-store"), import("../ai-core/models"), import("./operation-store"), import("./operations")]);
  const model = resolveModel(process.env, { capability });
  const { model: _ignored, ...rest } = params; void _ignored;
  const payload = { ...(rest as Record<string, unknown>), ...(model ? { model } : {}) } as Parameters<typeof invokeLLM>[0];
  const key = idempotencyKey ?? `auto_${randomUUID()}`.slice(0, 64);
  const out = await ops.executeOnce({ ops: await getMysqlOperationStore(), credits: await getMysqlCreditStore(), env: process.env, newId: () => `op_${randomUUID()}`.slice(0, 64) }, { userId, capability, key, inputHash: ops.hashInput(payload) }, () => invokeLLM(payload));
  return out.result as Awaited<ReturnType<typeof invokeLLM>>;
}

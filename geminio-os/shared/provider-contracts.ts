import { z } from "zod";

export const authProviderSchema = z.enum(["builtin-oauth", "clerk", "replit-auth"]);
export type AuthProvider = z.infer<typeof authProviderSchema>;

export const sessionStateSchema = z.object({
  provider: authProviderSchema,
  status: z.enum(["signed-out", "signed-in", "reauth-required", "revoked", "unsupported"]),
  userId: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  canRefresh: z.boolean(),
});
export type SessionState = z.infer<typeof sessionStateSchema>;

export function canUseSession(session: SessionState, now = Date.now()): boolean {
  if (session.status !== "signed-in" || !session.userId) return false;
  if (!session.expiresAt) return true;
  return new Date(session.expiresAt).getTime() > now;
}

export const aiProviderSchema = z.enum(["builtin-llm", "anthropic", "openrouter"]);
export type AiProvider = z.infer<typeof aiProviderSchema>;

export type ProviderReadiness = {
  provider: AiProvider;
  status: "ready" | "credentials-required" | "unsupported";
  model: string | null;
  reason: string | null;
};

export function resolveAiProviderReadiness(provider: AiProvider, credentialsConfigured: boolean): ProviderReadiness {
  if (provider === "builtin-llm") return { provider, status: "ready", model: "builtin", reason: null };
  if (!credentialsConfigured) return { provider, status: "credentials-required", model: null, reason: "Provider credentials are required before execution." };
  return { provider, status: "ready", model: provider === "anthropic" ? "claude" : "openrouter-default", reason: null };
}

export type AdapterResult<T> = { ok: true; data: T } | { ok: false; code: "credentials-required" | "unsupported" | "rate-limited" | "provider-error"; message: string; retryAfterMs?: number };

export function providerFailure(code: Extract<AdapterResult<never>, { ok: false }>["code"], message: string, retryAfterMs?: number): AdapterResult<never> {
  return { ok: false, code, message, ...(retryAfterMs === undefined ? {} : { retryAfterMs }) };
}

import { describe, expect, it } from "vitest";
import { canUseSession, resolveAiProviderReadiness, sessionStateSchema } from "@/shared/provider-contracts";

describe("provider contracts", () => {
  it("accepts a live signed-in session and rejects expired sessions", () => {
    const live = sessionStateSchema.parse({ provider: "builtin-oauth", status: "signed-in", userId: "user-1", expiresAt: new Date(Date.now() + 60_000).toISOString(), canRefresh: true });
    const expired = sessionStateSchema.parse({ ...live, expiresAt: new Date(Date.now() - 60_000).toISOString() });
    expect(canUseSession(live)).toBe(true);
    expect(canUseSession(expired)).toBe(false);
  });

  it("requires credentials for external AI providers", () => {
    expect(resolveAiProviderReadiness("builtin-llm", false).status).toBe("ready");
    expect(resolveAiProviderReadiness("anthropic", false).status).toBe("credentials-required");
    expect(resolveAiProviderReadiness("openrouter", true).status).toBe("ready");
  });
});

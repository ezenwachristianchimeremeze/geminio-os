import { describe, expect, it } from "vitest";
import { canUseProvider, getProviderDefinition, providerActionFailure } from "@/lib/provider-registry";

describe("Provider registry", () => {
  it("contains the required connector families", () => {
    expect(getProviderDefinition("github")?.kind).toBe("oauth");
    expect(getProviderDefinition("twilio")?.requiredSecrets).toContain("TWILIO_AUTH_TOKEN");
    expect(getProviderDefinition("data-warehouse")?.supportsNative).toBe(false);
  });

  it("only enables actions for ready providers on supported platforms", () => {
    const ready = { providerId: "github", state: "ready" as const };
    expect(canUseProvider("github", ready, "web")).toBe(true);
    expect(canUseProvider("github", { ...ready, state: "syncing" }, "web")).toBe(false);
    expect(canUseProvider("data-warehouse", ready, "native")).toBe(false);
  });

  it("returns actionable boundary messages for non-ready providers", () => {
    expect(providerActionFailure(null)).toContain("Connect");
    expect(providerActionFailure({ providerId: "github", state: "reauth-required" })).toContain("Reconnect");
    expect(providerActionFailure({ providerId: "github", state: "error", lastError: "Rate limited" })).toBe("Rate limited");
    expect(providerActionFailure({ providerId: "github", state: "ready" })).toBeNull();
  });
});

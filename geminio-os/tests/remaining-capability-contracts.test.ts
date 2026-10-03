import { describe, expect, it } from "vitest";
import { accountLinkSchema, aiStreamEventSchema, canStartSpeech, canUnlinkAccount, hasEntitlement, resolvePurchaseState, validateEmbedding } from "@/shared/remaining-capability-contracts";

describe("remaining capability contracts", () => {
  it("only permits unlinking when another linked account remains", () => {
    const base = { userId: "u1", providerAccountId: "a1", status: "linked" as const, linkedAt: new Date().toISOString() };
    const first = accountLinkSchema.parse({ ...base, provider: "builtin-oauth" });
    const second = accountLinkSchema.parse({ ...base, provider: "clerk", providerAccountId: "a2" });
    expect(canUnlinkAccount([first], first)).toBe(false);
    expect(canUnlinkAccount([first, second], first)).toBe(true);
  });

  it("validates streaming event envelopes and embedding dimensions", () => {
    expect(aiStreamEventSchema.parse({ type: "delta", requestId: "r1", text: "hello" }).type).toBe("delta");
    expect(validateEmbedding([0, 1, 0.5], 3)).toBe(true);
    expect(validateEmbedding([0, Number.NaN], 2)).toBe(false);
  });

  it("controls TTS start state and entitlement expiry", () => {
    expect(canStartSpeech("idle")).toBe(true);
    expect(canStartSpeech("playing")).toBe(false);
    const entitlement = { userId: "u1", productId: "p1", entitlement: "pro", status: "active" as const, expiresAt: new Date(Date.now() + 30_000).toISOString(), source: "stripe" as const };
    expect(hasEntitlement(entitlement)).toBe(true);
    expect(resolvePurchaseState({ providerConfigured: true, receiptValidated: false })).toBe("receipt-validation-required");
  });
});

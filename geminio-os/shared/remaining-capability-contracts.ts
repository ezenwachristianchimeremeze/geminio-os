import { z } from "zod";

export const accountLinkSchema = z.object({
  userId: z.string().min(1),
  provider: z.enum(["builtin-oauth", "clerk", "replit-auth"]),
  providerAccountId: z.string().min(1),
  status: z.enum(["pending", "linked", "unlink-pending", "unlinked"]),
  linkedAt: z.string().datetime().nullable(),
});
export type AccountLink = z.infer<typeof accountLinkSchema>;

export function canUnlinkAccount(links: AccountLink[], target: AccountLink): boolean {
  return links.filter((link) => link.status === "linked").length > 1 && target.status === "linked";
}

export const aiStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start"), requestId: z.string() }),
  z.object({ type: z.literal("delta"), requestId: z.string(), text: z.string().max(16_000) }),
  z.object({ type: z.literal("complete"), requestId: z.string(), usage: z.object({ inputTokens: z.number().nonnegative(), outputTokens: z.number().nonnegative() }) }),
  z.object({ type: z.literal("error"), requestId: z.string(), code: z.string(), message: z.string() }),
]);
export type AiStreamEvent = z.infer<typeof aiStreamEventSchema>;

export type EmbeddingIndexEntry = { id: string; textHash: string; vector: number[]; updatedAt: string };
export function validateEmbedding(vector: number[], dimensions: number): boolean {
  return vector.length === dimensions && vector.every((value) => Number.isFinite(value));
}

export type SpeechPlaybackState = "idle" | "loading" | "playing" | "paused" | "completed" | "error" | "unsupported";
export function canStartSpeech(state: SpeechPlaybackState): boolean {
  return state === "idle" || state === "completed" || state === "error";
}

export const entitlementSchema = z.object({
  userId: z.string().min(1),
  productId: z.string().min(1),
  entitlement: z.string().min(1),
  status: z.enum(["active", "trial", "expired", "revoked", "pending-validation"]),
  expiresAt: z.string().datetime().nullable(),
  source: z.enum(["revenuecat", "stripe", "admin", "promotion"]),
});
export type Entitlement = z.infer<typeof entitlementSchema>;

export function hasEntitlement(entitlement: Entitlement | null, now = Date.now()): boolean {
  if (!entitlement || !["active", "trial"].includes(entitlement.status)) return false;
  return !entitlement.expiresAt || new Date(entitlement.expiresAt).getTime() > now;
}

export type PurchaseState = "idle" | "checkout-required" | "pending" | "succeeded" | "failed" | "cancelled" | "receipt-validation-required";
export function resolvePurchaseState(input: { providerConfigured: boolean; receiptValidated: boolean }): PurchaseState {
  if (!input.providerConfigured) return "checkout-required";
  if (!input.receiptValidated) return "receipt-validation-required";
  return "succeeded";
}

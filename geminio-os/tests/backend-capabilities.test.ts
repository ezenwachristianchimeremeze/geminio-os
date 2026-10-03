import { describe, expect, it } from "vitest";
import { isVisible, markDeleted, resolveCachePolicy, restoreDeleted, searchQuerySchema } from "@/shared/backend-capabilities";
import { signWebhook, verifyWebhook } from "@/server/webhook-security";

describe("backend capability contracts", () => {
  it("validates search input and bounded pagination", () => {
    expect(searchQuerySchema.parse({ query: "wallet" }).limit).toBe(20);
    expect(() => searchQuerySchema.parse({ query: "" })).toThrow();
    expect(() => searchQuerySchema.parse({ query: "x", limit: 101 })).toThrow();
  });

  it("supports soft delete, visibility, and restore", () => {
    const original = { id: "1", deletedAt: null as Date | null };
    const deleted = markDeleted(original, new Date(1000));
    expect(isVisible(original)).toBe(true);
    expect(isVisible(deleted)).toBe(false);
    expect(restoreDeleted(deleted)).toEqual(original);
  });

  it("uses stricter cache policies for private data", () => {
    expect(resolveCachePolicy({ privateData: true, mutable: true }).maxAgeSeconds).toBe(0);
    expect(resolveCachePolicy({ privateData: false, mutable: false }).compressed).toBe(true);
  });

  it("verifies signatures and rejects replayed events", () => {
    const now = 1_000_000;
    const payload = JSON.stringify({ kind: "credit.granted" });
    const timestamp = now - 1000;
    const signature = signWebhook(payload, "secret", timestamp);
    expect(verifyWebhook({ payload, secret: "secret", signature, timestamp, eventId: "evt-1", now })).toEqual({ ok: true, eventId: "evt-1" });
    expect(verifyWebhook({ payload, secret: "secret", signature, timestamp, eventId: "evt-1", now })).toMatchObject({ ok: false, code: "replay" });
    expect(verifyWebhook({ payload, secret: "secret", signature, timestamp: now - 999_999, eventId: "evt-2", now })).toMatchObject({ ok: false, code: "stale" });
  });
});

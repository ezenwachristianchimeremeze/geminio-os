import { createHmac, timingSafeEqual } from "node:crypto";

export type WebhookVerification = { ok: true; eventId: string } | { ok: false; code: "missing-signature" | "invalid-signature" | "stale" | "replay"; message: string };

const seenEvents = new Map<string, number>();

export function signWebhook(payload: string, secret: string, timestamp: number): string {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
}

export function verifyWebhook(input: { payload: string; secret: string; signature?: string; timestamp?: number; eventId: string; now?: number; toleranceMs?: number }): WebhookVerification {
  const now = input.now ?? Date.now();
  const toleranceMs = input.toleranceMs ?? 5 * 60 * 1000;
  if (!input.signature || input.timestamp === undefined) return { ok: false, code: "missing-signature", message: "Webhook signature and timestamp are required." };
  if (Math.abs(now - input.timestamp) > toleranceMs) return { ok: false, code: "stale", message: "Webhook timestamp is outside the replay tolerance window." };
  const expected = signWebhook(input.payload, input.secret, input.timestamp);
  const actual = Buffer.from(input.signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (actual.length !== expectedBuffer.length || !timingSafeEqual(actual, expectedBuffer)) return { ok: false, code: "invalid-signature", message: "Webhook signature is invalid." };
  const previous = seenEvents.get(input.eventId);
  if (previous !== undefined && now - previous <= toleranceMs) return { ok: false, code: "replay", message: "Webhook event has already been processed." };
  seenEvents.set(input.eventId, now);
  for (const [eventId, seenAt] of seenEvents) if (now - seenAt > toleranceMs) seenEvents.delete(eventId);
  return { ok: true, eventId: input.eventId };
}

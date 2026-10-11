/**
 * Removes server-only material from AI Core runs/plans before they reach a client: signed storage URLs, attachment
 * parts, web/personalization context injected by trusted code, and any secret-looking key. Pure and deep.
 */
const DROP_KEYS = new Set(["attachmentParts", "webContext", "personalization", "trustedEditMessages", "trustedEditJson", "previousOutputs", "stepRole"]);
const SECRETISH = /token|secret|password|authorization|api[-_]?key|cookie|signature/i;
const SIGNED_URL = /https?:\/\/[^\s"']*(?:X-Amz-Signature|Signature=|token=|sig=)[^\s"']*/gi;

export function redactForClient<T>(value: T, depth = 0): T {
  if (depth > 12) return "[truncated]" as unknown as T;
  if (typeof value === "string") return value.replace(SIGNED_URL, "[signed-url-removed]") as unknown as T;
  if (Array.isArray(value)) return value.map((v) => redactForClient(v, depth + 1)) as unknown as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (DROP_KEYS.has(k)) continue;
      out[k] = SECRETISH.test(k) ? "[REDACTED]" : redactForClient(v, depth + 1);
    }
    return out as T;
  }
  return value;
}

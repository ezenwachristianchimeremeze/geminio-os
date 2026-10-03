import { auditLogs } from "../../drizzle/schema";
import { getDb } from "../db";
import { getCapability } from "./capabilities";
import { redactSensitiveMetadata, type CapabilityRisk } from "../../shared/geminio-contracts";

const requestWindows = new Map<number, { startedAt: number; count: number }>();

export type AuthorizationDecision = { allowed: boolean; reason: string; risk: CapabilityRisk | null };

export function authorizeCapability(input: { userId: number; capability: string; approved: boolean }): AuthorizationDecision {
  const capability = getCapability(input.capability);
  if (!capability || !capability.descriptor.enabled) return { allowed: false, reason: "Capability is not enabled or registered.", risk: null };
  if (capability.descriptor.risk === "external_side_effect" && !input.approved) {
    return { allowed: false, reason: "Explicit user approval is required before this external side effect.", risk: capability.descriptor.risk };
  }
  return { allowed: true, reason: "Capability is registered and authorized for execution.", risk: capability.descriptor.risk };
}

export function consumeRateLimit(userId: number, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const current = requestWindows.get(userId);
  if (!current || now - current.startedAt >= windowMs) {
    requestWindows.set(userId, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export async function recordAiAudit(input: {
  userId: number | null;
  action: string;
  resource?: string;
  status: "success" | "warning" | "error";
  details?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return null;
  const record = {
    id: `audit_${crypto.randomUUID()}`,
    userId: input.userId,
    action: input.action,
    resource: input.resource ?? null,
    status: input.status,
    details: JSON.stringify(redactSensitiveMetadata(input.details ?? {})),
    createdAt: new Date(),
  };
  await db.insert(auditLogs).values(record);
  return record;
}

export function safeErrorDetails(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return redactSensitiveMetadata({ message: message.slice(0, 2000) });
}

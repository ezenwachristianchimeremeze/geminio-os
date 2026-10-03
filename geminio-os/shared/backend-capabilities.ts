import { z } from "zod";

export const searchQuerySchema = z.object({
  query: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().max(256).nullable().default(null),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export type SoftDeletable = { deletedAt: Date | null };

export function markDeleted<T extends SoftDeletable>(record: T, at = new Date()): T {
  return { ...record, deletedAt: at };
}

export function restoreDeleted<T extends SoftDeletable>(record: T): T {
  return { ...record, deletedAt: null };
}

export function isVisible<T extends SoftDeletable>(record: T): boolean {
  return record.deletedAt === null;
}

export type CachePolicy = { maxAgeSeconds: number; staleWhileRevalidateSeconds: number; compressed: boolean };

export function resolveCachePolicy(input: { privateData: boolean; mutable: boolean }): CachePolicy {
  if (input.privateData) return { maxAgeSeconds: 0, staleWhileRevalidateSeconds: 0, compressed: true };
  if (input.mutable) return { maxAgeSeconds: 30, staleWhileRevalidateSeconds: 60, compressed: true };
  return { maxAgeSeconds: 300, staleWhileRevalidateSeconds: 600, compressed: true };
}

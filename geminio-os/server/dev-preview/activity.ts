import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { redact } from "./states";

/**
 * Append-only activity log (JSON lines). Every entry is written by a real
 * operation: the preview supervisor, or the agent via scripts/dev-activity.mjs.
 * Nothing here simulates progress.
 */
export type ActivitySource = "supervisor" | "agent" | "system";
export type ActivityEntry = { ts: string; source: ActivitySource; message: string; level: "info" | "warning" | "error"; detail?: string };

const MAX_BYTES = 1_000_000;

export function formatEntry(entry: Omit<ActivityEntry, "ts"> & { ts?: string }): string {
  const e: ActivityEntry = {
    ts: entry.ts ?? new Date().toISOString(),
    source: entry.source,
    level: entry.level,
    message: redact(entry.message).slice(0, 500),
    ...(entry.detail ? { detail: redact(entry.detail).slice(0, 2000) } : {}),
  };
  return JSON.stringify(e);
}

export function appendActivity(file: string, entry: Omit<ActivityEntry, "ts"> & { ts?: string }): void {
  const dir = dirname(file);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (existsSync(file) && statSync(file).size > MAX_BYTES) renameSync(file, `${file}.1`); // single rotation, bounded
  appendFileSync(file, formatEntry(entry) + "\n", "utf8");
}

export function readActivity(file: string, limit = 100): ActivityEntry[] {
  if (!existsSync(file)) return [];
  const out: ActivityEntry[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as ActivityEntry;
      if (e && typeof e.ts === "string" && typeof e.message === "string" && ["supervisor", "agent", "system"].includes(e.source)) out.push(e);
    } catch { /* skip a torn/corrupt line instead of failing the whole panel */ }
  }
  return out.slice(-limit).reverse();
}

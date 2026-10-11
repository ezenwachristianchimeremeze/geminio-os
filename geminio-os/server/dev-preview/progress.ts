/**
 * Build progress derived ONLY from BLUEPRINT_IMPLEMENTATION_MATRIX.md.
 * No percentage is stored or invented anywhere else.
 *
 * Matrix row:  | ID | Area | Requirement | Status | Runtime verified | Evidence / blocker |
 * Status vocabulary (exactly these, case-insensitive):
 *   MISSING | IN PROGRESS | IMPLEMENTED | VERIFIED | BLOCKED BY EXTERNAL INFRASTRUCTURE | N/A
 *   IMPLEMENTED = repository-side done, NOT runtime verified
 *   VERIFIED    = only valid with Runtime verified = Yes (real run evidence)
 *   BLOCKED...  = repository side complete (evidence must start "repo-side complete:")
 *   An IN PROGRESS row whose evidence starts "DEFECT:" is counted as broken (code exists but is defective).
 *   N/A is excluded from totals.
 */
export const PROGRESS_STATES = ["missing", "in_progress", "implemented", "verified", "blocked"] as const;
export type ProgressState = (typeof PROGRESS_STATES)[number];

export type MatrixRow = { id: string; area: string; requirement: string; status: string; state: ProgressState | null; runtimeVerified: boolean; note: string; problems: string[] };

export type AreaProgress = {
  area: string;
  total: number;
  counts: Record<ProgressState, number>;
  broken: number;
  /** repository-side done: implemented + verified + blocked (blocked = repo side complete). */
  builtPercent: number;
  /** runtime verified only. */
  verifiedPercent: number;
};

export type ProgressReport = {
  overall: AreaProgress;
  areas: AreaProgress[];
  rows: number;
  problems: string[];
};

/** The only statuses the matrix may use. */
export const CANONICAL_STATUSES = ["MISSING", "IN PROGRESS", "IMPLEMENTED", "VERIFIED", "BLOCKED BY EXTERNAL INFRASTRUCTURE", "N/A"] as const;

const STATUS_TO_STATE: Record<string, ProgressState | "na"> = {
  MISSING: "missing",
  "IN PROGRESS": "in_progress",
  IMPLEMENTED: "implemented",
  VERIFIED: "verified",
  "BLOCKED BY EXTERNAL INFRASTRUCTURE": "blocked",
  "N/A": "na",
  // legacy spellings, still parsed so old matrices keep working; the repository's matrix test forbids them
  PARTIAL: "in_progress",
  BROKEN: "in_progress",
  COMPLETE: "verified",
  BLOCKED: "blocked",
};
const isVerifiedStatus = (s: string) => s === "VERIFIED" || s === "COMPLETE";
const isBlockedStatus = (s: string) => s === "BLOCKED BY EXTERNAL INFRASTRUCTURE" || s === "BLOCKED";

function emptyCounts(): Record<ProgressState, number> {
  return { missing: 0, in_progress: 0, implemented: 0, verified: 0, blocked: 0 };
}

export function parseMatrix(markdown: string): MatrixRow[] {
  const rows: MatrixRow[] = [];
  const seen = new Set<string>();
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith("|")) continue;
    const cells = line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (cells.length < 6) continue;
    const [id, area, requirement, statusRaw, verifiedRaw, ...rest] = cells;
    if (!/^GO-[A-Z0-9]+-\d{3}$/.test(id)) continue; // header / separator / prose rows
    const problems: string[] = [];
    const status = statusRaw.toUpperCase();
    const mapped = STATUS_TO_STATE[status];
    if (!mapped) problems.push(`${id}: unknown status "${statusRaw}"`);
    if (seen.has(id)) problems.push(`${id}: duplicate row id`);
    seen.add(id);
    const runtimeVerified = /^yes$/i.test(verifiedRaw);
    if (isVerifiedStatus(status) && !runtimeVerified) problems.push(`${id}: VERIFIED requires Runtime verified = Yes`);
    if (isBlockedStatus(status) && !/^repo-side complete\b/i.test(rest.join(" | ").trim())) problems.push(`${id}: BLOCKED requires the evidence to start with "repo-side complete:" (blocked is only valid when the repository side is finished)`);
    if (runtimeVerified && !isVerifiedStatus(status) && status !== "N/A") problems.push(`${id}: Runtime verified = Yes but status is ${status}`);
    rows.push({ id, area, requirement, status, state: mapped && mapped !== "na" ? mapped : null, runtimeVerified, note: rest.join(" | "), problems });
  }
  return rows;
}

function summarize(area: string, rows: MatrixRow[]): AreaProgress {
  const counts = emptyCounts();
  let broken = 0;
  for (const r of rows) {
    if (!r.state) continue;
    counts[r.state] += 1;
    if (r.status === "BROKEN" || /^defect:/i.test(r.note.trim())) broken += 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  return { area, total, counts, broken, builtPercent: pct(counts.implemented + counts.verified + counts.blocked), verifiedPercent: pct(counts.verified) };
}

export function computeProgress(markdown: string): ProgressReport {
  const rows = parseMatrix(markdown);
  const byArea = new Map<string, MatrixRow[]>();
  for (const r of rows) byArea.set(r.area, [...(byArea.get(r.area) ?? []), r]);
  const areas = [...byArea.entries()].map(([area, list]) => summarize(area, list));
  return { overall: summarize("Overall", rows), areas, rows: rows.length, problems: rows.flatMap((r) => r.problems) };
}

/** Text bar for logs/CLI; the UI draws real bars from the same numbers. */
export function bar(percent: number, width = 10): string {
  const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

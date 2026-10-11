/**
 * Durable scheduling for Home chat: reminders (a notification at a time) and recurring prompts (an AI task on a schedule).
 * Pure logic over a store port. A due schedule is CLAIMED with a compare-and-set on nextRunAt, so two workers can never fire the
 * same occurrence. No natural-language parsing: the user picks the time explicitly.
 */
export type Recurrence = { kind: "once" } | { kind: "daily" } | { kind: "weekly"; days: number[] }; // days: 0=Sun..6=Sat
export type ScheduleKind = "reminder" | "prompt";
export type ScheduleRow = { id: string; userId: number; kind: ScheduleKind; title: string; prompt: string | null; recurrence: Recurrence; timezone: string; timeOfDay: string; nextRunAt: Date | null; lastRunAt: Date | null; status: "active" | "paused" | "completed"; failures: number; createdAt: Date };

export const RUN_POLICY = { leaseMs: 5 * 60_000, maxAttempts: 3, staleAfterMs: 6 * 3_600_000 } as const;
export type RunStatus = "firing" | "retry" | "done" | "failed" | "skipped";
export type RunRecord = { scheduleId: string; occurrence: Date; userId: number; status: RunStatus; attempts: number; leaseUntil: Date; lastError: string | null };
export const SCHEDULE_LIMITS = { maxActivePerUser: 20, minPromptIntervalHours: 24, maxTitle: 120, maxPrompt: 2000, maxConsecutiveFailures: 5 } as const;
export class ScheduleError extends Error { constructor(readonly code: "INVALID" | "LIMIT" | "NOT_FOUND", message: string) { super(message); this.name = "ScheduleError"; } }

// ---------- timezone-correct time math (Intl only; no dependencies) ----------
export function isValidTimezone(tz: string): boolean { try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; } }
function parts(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", weekday: "short" });
  const o: Record<string, string> = {}; for (const p of f.formatToParts(date)) o[p.type] = p.value;
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(o.weekday);
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, min: +o.minute, s: +o.second, wd };
}
/** Local wall-clock time in `tz` -> UTC instant. Spring-forward gaps move forward to the next valid minute; fall-back overlaps pick the first occurrence. */
export function zonedToUtc(y: number, m: number, d: number, h: number, min: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, h, min);
  let t = guess;
  for (let i = 0; i < 3; i++) { const p = parts(new Date(t), tz); const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min); t += guess - asUtc; }
  // verify; if the wall time doesn't exist (gap) the result lands after it, which is the intended "next valid" behaviour
  return new Date(t);
}
export function parseTimeOfDay(t: string): { h: number; min: number } | null { const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t); return m ? { h: +m[1], min: +m[2] } : null; }

/** The first occurrence strictly after `after`. Returns null when a one-off has no future occurrence. */
export function nextOccurrence(spec: { recurrence: Recurrence; timezone: string; timeOfDay: string; onceDate?: string }, after: Date): Date | null {
  const tod = parseTimeOfDay(spec.timeOfDay); if (!tod) return null;
  if (spec.recurrence.kind === "once") {
    if (!spec.onceDate) return null; const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(spec.onceDate); if (!m) return null;
    const t = zonedToUtc(+m[1], +m[2], +m[3], tod.h, tod.min, spec.timezone); return t > after ? t : null;
  }
  const start = parts(after, spec.timezone);
  for (let add = 0; add <= 8; add++) {
    const day = new Date(Date.UTC(start.y, start.m - 1, start.d + add));
    const y = day.getUTCFullYear(), mo = day.getUTCMonth() + 1, d = day.getUTCDate(), wd = day.getUTCDay();
    if (spec.recurrence.kind === "weekly" && !spec.recurrence.days.includes(wd)) continue;
    const t = zonedToUtc(y, mo, d, tod.h, tod.min, spec.timezone);
    if (t > after) return t;
  }
  return null;
}

// ---------- validation ----------
export type CreateInput = { kind: ScheduleKind; title: string; prompt?: string | null; recurrence: Recurrence; timezone: string; timeOfDay: string; onceDate?: string };
export function validateCreate(input: CreateInput, now: Date): { ok: true; value: Required<Pick<CreateInput, "title" | "timezone" | "timeOfDay">> & { prompt: string | null; recurrence: Recurrence; nextRunAt: Date } } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const title = input.title.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!title) problems.push("Give the schedule a title."); if (title.length > SCHEDULE_LIMITS.maxTitle) problems.push("The title is too long.");
  if (!isValidTimezone(input.timezone)) problems.push("Unknown timezone.");
  if (!parseTimeOfDay(input.timeOfDay)) problems.push("Time must be HH:MM (24-hour).");
  const r = input.recurrence;
  if (r.kind === "weekly" && (!Array.isArray(r.days) || r.days.length === 0 || r.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6))) problems.push("Pick at least one weekday.");
  const prompt = input.kind === "prompt" ? (input.prompt ?? "").replace(/\u0000/g, "").trim() : null;
  if (input.kind === "prompt" && !prompt) problems.push("A recurring task needs a prompt.");
  if (prompt && prompt.length > SCHEDULE_LIMITS.maxPrompt) problems.push("The prompt is too long.");
  if (problems.length) return { ok: false, problems };
  const recurrence: Recurrence = r.kind === "weekly" ? { kind: "weekly", days: [...new Set(r.days)].sort() } : r;
  const next = nextOccurrence({ recurrence, timezone: input.timezone, timeOfDay: input.timeOfDay, onceDate: input.onceDate }, now);
  if (!next) return { ok: false, problems: [recurrence.kind === "once" ? "Pick a date and time in the future." : "Couldn't compute the next run."] };
  return { ok: true, value: { title, prompt, recurrence, timezone: input.timezone, timeOfDay: input.timeOfDay, nextRunAt: next } };
}

// ---------- store port + service ----------
export interface ScheduleStore {
  countActive(userId: number): Promise<number>;
  insert(row: ScheduleRow): Promise<void>;
  list(userId: number): Promise<ScheduleRow[]>;
  get(userId: number, id: string): Promise<ScheduleRow | null>;
  update(userId: number, id: string, patch: Partial<Pick<ScheduleRow, "status" | "nextRunAt" | "title">>): Promise<boolean>;
  remove(userId: number, id: string): Promise<boolean>;
  /** Rows with status=active and nextRunAt <= now (oldest first). */
  due(now: Date, limit: number): Promise<ScheduleRow[]>;
  /** Atomic claim: succeeds for exactly one caller per (id, expectedNextRunAt). */
  claim(id: string, expectedNextRunAt: Date, patch: { nextRunAt: Date | null; lastRunAt: Date; status: ScheduleRow["status"]; failures: number }): Promise<boolean>;
  /** Execution records: one per (scheduleId, occurrence). insertRun returns false if it already exists. */
  insertRun(r: RunRecord): Promise<boolean>;
  /** CAS: take over a run whose lease expired (firing/retry) with attempts+1 and a fresh lease. Returns the new attempt count or null. */
  acquireRun(scheduleId: string, occurrence: Date, expectedAttempts: number, now: Date, leaseUntil: Date): Promise<number | null>;
  finishRun(scheduleId: string, occurrence: Date, status: RunStatus, error: string | null, now: Date, leaseUntil?: Date): Promise<void>;
  /** Runs in firing/retry whose lease has expired (crash or scheduled retry), oldest first. */
  expiredRuns(now: Date, limit: number): Promise<RunRecord[]>;
  getById(id: string): Promise<ScheduleRow | null>;
}

export async function createSchedule(store: ScheduleStore, userId: number, input: CreateInput, deps: { now: Date; id: string }): Promise<ScheduleRow> {
  const v = validateCreate(input, deps.now);
  if (!v.ok) throw new ScheduleError("INVALID", v.problems.join(" "));
  if ((await store.countActive(userId)) >= SCHEDULE_LIMITS.maxActivePerUser) throw new ScheduleError("LIMIT", `You can have at most ${SCHEDULE_LIMITS.maxActivePerUser} active schedules.`);
  if (input.kind === "prompt") {
    if (v.value.recurrence.kind === "once") { /* a single scheduled prompt is fine */ }
    else if (v.value.recurrence.kind === "weekly" && v.value.recurrence.days.length > 1 && SCHEDULE_LIMITS.minPromptIntervalHours >= 24) throw new ScheduleError("INVALID", "To control cost, a recurring task can run at most once a day. Choose one weekday (or daily).");
  }
  const row: ScheduleRow = { id: deps.id, userId, kind: input.kind, title: v.value.title, prompt: v.value.prompt, recurrence: v.value.recurrence, timezone: v.value.timezone, timeOfDay: v.value.timeOfDay, nextRunAt: v.value.nextRunAt, lastRunAt: null, status: "active", failures: 0, createdAt: deps.now };
  await store.insert(row); return row;
}
export async function setScheduleStatus(store: ScheduleStore, userId: number, id: string, status: "active" | "paused", now: Date) {
  const r = await store.get(userId, id); if (!r) throw new ScheduleError("NOT_FOUND", "Schedule not found.");
  if (r.status === "completed") throw new ScheduleError("INVALID", "That schedule has finished.");
  if (status === "active") {
    if ((await store.countActive(userId)) >= SCHEDULE_LIMITS.maxActivePerUser && r.status !== "active") throw new ScheduleError("LIMIT", "Too many active schedules.");
    const next = nextOccurrence({ recurrence: r.recurrence, timezone: r.timezone, timeOfDay: r.timeOfDay }, now); // resume never fires missed occurrences
    await store.update(userId, id, { status: "active", nextRunAt: next }); return;
  }
  await store.update(userId, id, { status: "paused" });
}
export async function deleteSchedule(store: ScheduleStore, userId: number, id: string) { if (!(await store.remove(userId, id))) throw new ScheduleError("NOT_FOUND", "Schedule not found."); }

export type FireResult = { ok: true } | { ok: false; reason: string; retryable: boolean };
export type TickDeps = { store: ScheduleStore; fire(row: ScheduleRow, occurrence: Date): Promise<FireResult>; notify(row: ScheduleRow, title: string, message: string, type: "info" | "warning" | "error"): Promise<void>; now: () => Date };
export type TickResult = { fired: number; skipped: number; failed: number; recovered: number; retried: number };

async function execute(deps: TickDeps, row: ScheduleRow, occurrence: Date, attempts: number, out: TickResult) {
  const now = deps.now();
  let res: FireResult;
  try { res = await deps.fire(row, occurrence); } catch (e) { res = { ok: false, reason: e instanceof Error ? e.message : "Unexpected error.", retryable: true }; }
  if (res.ok) { await deps.store.finishRun(row.id, occurrence, "done", null, deps.now()); out.fired++; return; }
  if (res.retryable && attempts < RUN_POLICY.maxAttempts) { await deps.store.finishRun(row.id, occurrence, "retry", res.reason.slice(0, 300), now, new Date(+now + 60_000 * attempts)); out.retried++; return; }
  await deps.store.finishRun(row.id, occurrence, "failed", res.reason.slice(0, 300), now);
  out.failed++;
  const failures = row.failures + 1; const disable = failures >= SCHEDULE_LIMITS.maxConsecutiveFailures;
  await deps.store.update(row.userId, row.id, disable ? { status: "paused" } : {}).catch(() => undefined);
  await deps.notify(row, `Scheduled task didn't run: ${row.title}`, `${res.reason}${disable ? " It was paused after repeated failures." : ""}`, "warning").catch(() => undefined);
}

/**
 * Reliability model (at-least-once with idempotent execution):
 *  1. claim the occurrence (CAS on nextRunAt) so exactly one worker owns it, and advance the schedule;
 *  2. write an execution record (scheduleId, occurrence) with a lease;
 *  3. fire; success -> done, retryable failure -> retry (bounded), permanent failure -> failed + notify;
 *  4. every tick also RECOVERS runs whose lease expired (worker crashed after claiming): they are re-fired, up to maxAttempts.
 * Re-firing is safe because execute uses idempotency keys derived from (schedule, occurrence): the chat send is idempotent per
 * request id, reminders use a deterministic notification id. Occurrences older than staleAfterMs are SKIPPED (with a notice), not replayed.
 */
export async function runDueSchedules(deps: TickDeps, limit = 25): Promise<TickResult> {
  const out: TickResult = { fired: 0, skipped: 0, failed: 0, recovered: 0, retried: 0 };
  // 1) recovery of interrupted / retry-due runs
  for (const run of await deps.store.expiredRuns(deps.now(), limit)) {
    const row = await deps.store.getById(run.scheduleId);
    if (!row) { await deps.store.finishRun(run.scheduleId, run.occurrence, "failed", "Schedule was deleted.", deps.now()); continue; }
    if (+deps.now() - +run.occurrence > RUN_POLICY.staleAfterMs) {
      await deps.store.finishRun(run.scheduleId, run.occurrence, "skipped", "Too old to run safely.", deps.now()); out.skipped++;
      await deps.notify(row, `Scheduled task skipped: ${row.title}`, "It couldn't be run in time and was skipped rather than run late.", "info").catch(() => undefined); continue;
    }
    if (run.attempts >= RUN_POLICY.maxAttempts) {
      await deps.store.finishRun(run.scheduleId, run.occurrence, "failed", run.lastError ?? "Gave up after repeated attempts.", deps.now()); out.failed++;
      await deps.notify(row, `Scheduled task didn't run: ${row.title}`, run.lastError ?? "It was interrupted repeatedly.", "warning").catch(() => undefined); continue;
    }
    const attempt = await deps.store.acquireRun(run.scheduleId, run.occurrence, run.attempts, deps.now(), new Date(+deps.now() + RUN_POLICY.leaseMs));
    if (attempt === null) continue; // another worker took it
    out.recovered++;
    await execute(deps, row, run.occurrence, attempt, out);
  }
  // 2) new occurrences
  for (const row of await deps.store.due(deps.now(), limit)) {
    if (!row.nextRunAt) continue;
    const occurrence = row.nextRunAt; const now = deps.now();
    if (+now - +occurrence > RUN_POLICY.staleAfterMs) {
      // downtime longer than the grace window: advance without running (no stale AI work)
      const next = row.recurrence.kind === "once" ? null : nextOccurrence({ recurrence: row.recurrence, timezone: row.timezone, timeOfDay: row.timeOfDay }, now);
      if (await deps.store.claim(row.id, occurrence, { nextRunAt: next, lastRunAt: row.lastRunAt ?? now, status: next ? "active" : "completed", failures: row.failures })) { out.skipped++; await deps.notify(row, `Scheduled task skipped: ${row.title}`, "Geminio was unavailable at the scheduled time, so this run was skipped.", "info").catch(() => undefined); }
      continue;
    }
    const next = row.recurrence.kind === "once" ? null : nextOccurrence({ recurrence: row.recurrence, timezone: row.timezone, timeOfDay: row.timeOfDay }, now);
    if (!(await deps.store.claim(row.id, occurrence, { nextRunAt: next, lastRunAt: now, status: next ? "active" : "completed", failures: row.failures }))) { out.skipped++; continue; }
    if (!(await deps.store.insertRun({ scheduleId: row.id, occurrence, userId: row.userId, status: "firing", attempts: 1, leaseUntil: new Date(+now + RUN_POLICY.leaseMs), lastError: null }))) { out.skipped++; continue; }
    await execute(deps, row, occurrence, 1, out);
  }
  return out;
}

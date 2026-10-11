import { describe, expect, it } from "vitest";
import { createSchedule, deleteSchedule, isValidTimezone, nextOccurrence, RUN_POLICY, runDueSchedules, ScheduleError, SCHEDULE_LIMITS, setScheduleStatus, validateCreate, zonedToUtc, type RunRecord, type RunStatus, type ScheduleRow, type ScheduleStore } from "../server/home-chat/schedule";

class MemStore implements ScheduleStore {
  rows = new Map<string, ScheduleRow>();
  async countActive(u: number) { return [...this.rows.values()].filter((r) => r.userId === u && r.status === "active").length; }
  async insert(r: ScheduleRow) { this.rows.set(r.id, structuredClone(r)); }
  async list(u: number) { return [...this.rows.values()].filter((r) => r.userId === u); }
  async get(u: number, id: string) { const r = this.rows.get(id); return r && r.userId === u ? structuredClone(r) : null; }
  async update(u: number, id: string, p: any) { const r = this.rows.get(id); if (!r || r.userId !== u) return false; Object.assign(r, p); return true; }
  async remove(u: number, id: string) { const r = this.rows.get(id); if (!r || r.userId !== u) return false; this.rows.delete(id); return true; }
  async due(now: Date, limit: number) { return [...this.rows.values()].filter((r) => r.status === "active" && r.nextRunAt && r.nextRunAt <= now).sort((a, b) => +a.nextRunAt! - +b.nextRunAt!).slice(0, limit).map((r) => structuredClone(r)); }
  runs = new Map<string, RunRecord & { status: RunStatus }>();
  private k = (id: string, o: Date) => `${id}|${+o}`;
  async insertRun(r: RunRecord) { if (this.runs.has(this.k(r.scheduleId, r.occurrence))) return false; this.runs.set(this.k(r.scheduleId, r.occurrence), structuredClone(r)); return true; }
  async acquireRun(id: string, o: Date, exp: number, now: Date, lease: Date) { const r = this.runs.get(this.k(id, o)); if (!r || r.attempts !== exp || !["firing", "retry"].includes(r.status) || r.leaseUntil > now) return null; r.attempts++; r.status = "firing"; r.leaseUntil = lease; return r.attempts; }
  async finishRun(id: string, o: Date, status: RunStatus, error: string | null, now: Date, lease?: Date) { const r = this.runs.get(this.k(id, o)); if (r) { r.status = status; r.lastError = error; if (lease) r.leaseUntil = lease; } }
  async expiredRuns(now: Date, limit: number) { return [...this.runs.values()].filter((r) => ["firing", "retry"].includes(r.status) && r.leaseUntil <= now).sort((a, b) => +a.occurrence - +b.occurrence).slice(0, limit).map((r) => structuredClone(r)); }
  async getById(id: string) { const r = this.rows.get(id); return r ? structuredClone(r) : null; }
  async claim(id: string, exp: Date, patch: any) { const r = this.rows.get(id); if (!r || r.status !== "active" || !r.nextRunAt || +r.nextRunAt !== +exp) return false; Object.assign(r, patch); return true; }
}
const D = (s: string) => new Date(s);

describe("timezone math", () => {
  it("converts wall time to UTC across DST (New York)", () => {
    expect(zonedToUtc(2026, 1, 15, 9, 0, "America/New_York").toISOString()).toBe("2026-01-15T14:00:00.000Z"); // EST -5
    expect(zonedToUtc(2026, 7, 15, 9, 0, "America/New_York").toISOString()).toBe("2026-07-15T13:00:00.000Z"); // EDT -4
    expect(zonedToUtc(2026, 6, 1, 9, 0, "Asia/Kolkata").toISOString()).toBe("2026-06-01T03:30:00.000Z");
  });
  it("the same 09:00 local daily schedule keeps local time across the spring-forward change", () => {
    const spec = { recurrence: { kind: "daily" } as const, timezone: "America/New_York", timeOfDay: "09:00" };
    expect(nextOccurrence(spec, D("2026-03-07T20:00:00Z"))!.toISOString()).toBe("2026-03-08T13:00:00.000Z"); // Mar 8 2026 is DST start: 09:00 EDT = 13:00Z
    expect(nextOccurrence(spec, D("2026-03-08T13:00:00Z"))!.toISOString()).toBe("2026-03-09T13:00:00.000Z");
  });
  it("weekly picks the next selected weekday in the user's timezone", () => {
    const spec = { recurrence: { kind: "weekly", days: [1] } as const, timezone: "Pacific/Auckland", timeOfDay: "08:30" };
    const n = nextOccurrence(spec, D("2026-10-06T00:00:00Z"))!; // Tue in UTC; Auckland already Tue 13:00
    expect(new Intl.DateTimeFormat("en-US", { timeZone: "Pacific/Auckland", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).format(n).replace(",", "")).toBe("Mon 08:30");
    expect(+n).toBeGreaterThan(+D("2026-10-06T00:00:00Z"));
  });
  it("once returns null for the past and rejects bad input", () => {
    expect(nextOccurrence({ recurrence: { kind: "once" }, timezone: "UTC", timeOfDay: "09:00", onceDate: "2020-01-01" }, D("2026-01-01T00:00:00Z"))).toBeNull();
    expect(nextOccurrence({ recurrence: { kind: "daily" }, timezone: "UTC", timeOfDay: "25:99" }, new Date())).toBeNull();
    expect(isValidTimezone("Mars/Base")).toBe(false); expect(isValidTimezone("Europe/Lisbon")).toBe(true);
  });
});

describe("validation and limits", () => {
  const now = D("2026-10-06T12:00:00Z");
  it("validates every field and reports all problems", () => {
    const r = validateCreate({ kind: "prompt", title: " ", prompt: " ", recurrence: { kind: "weekly", days: [] }, timezone: "Nope/Zone", timeOfDay: "9am" }, now) as any;
    expect(r.ok).toBe(false); expect(r.problems.length).toBeGreaterThanOrEqual(5);
  });
  it("normalises weekdays and title", () => {
    const r = validateCreate({ kind: "reminder", title: " Drink\twater ", recurrence: { kind: "weekly", days: [3, 1, 3] }, timezone: "UTC", timeOfDay: "10:00" }, now) as any;
    expect(r.ok).toBe(true); expect(r.value.title).toBe("Drink water"); expect(r.value.recurrence).toEqual({ kind: "weekly", days: [1, 3] });
  });
  it("caps active schedules per user and limits prompts to once a day", async () => {
    const s = new MemStore();
    for (let i = 0; i < SCHEDULE_LIMITS.maxActivePerUser; i++) await createSchedule(s, 1, { kind: "reminder", title: `r${i}`, recurrence: { kind: "daily" }, timezone: "UTC", timeOfDay: "10:00" }, { now, id: `s${i}` });
    await expect(createSchedule(s, 1, { kind: "reminder", title: "x", recurrence: { kind: "daily" }, timezone: "UTC", timeOfDay: "10:00" }, { now, id: "over" })).rejects.toThrow("at most");
    await expect(createSchedule(new MemStore(), 1, { kind: "prompt", title: "x", prompt: "p", recurrence: { kind: "weekly", days: [1, 3] }, timezone: "UTC", timeOfDay: "10:00" }, { now, id: "p" })).rejects.toThrow("once a day");
  });
  it("users cannot touch each other's schedules", async () => {
    const s = new MemStore(); await createSchedule(s, 1, { kind: "reminder", title: "mine", recurrence: { kind: "daily" }, timezone: "UTC", timeOfDay: "10:00" }, { now, id: "a" });
    await expect(setScheduleStatus(s, 2, "a", "paused", now)).rejects.toBeInstanceOf(ScheduleError); await expect(deleteSchedule(s, 2, "a")).rejects.toBeInstanceOf(ScheduleError);
    expect((await s.get(1, "a"))?.status).toBe("active");
  });
});

describe("tick", () => {
  const mk = async (rec: any = { kind: "daily" }, extra: any = {}) => { const s = new MemStore(); await createSchedule(s, 1, { kind: "reminder", title: "T", recurrence: rec, timezone: "UTC", timeOfDay: "09:00", ...extra }, { now: D("2026-10-06T08:00:00Z"), id: "s1" }); return s; };
  it("fires a due daily schedule once and advances to the next day", async () => {
    const s = await mk(); const fired: string[] = [];
    const deps = { store: s, fire: async (r: ScheduleRow, o: Date) => { fired.push(o.toISOString()); return { ok: true } as const; }, notify: async () => {}, now: () => D("2026-10-06T09:00:30Z") };
    expect(await runDueSchedules(deps)).toMatchObject({ fired: 1, skipped: 0, failed: 0 });
    expect(fired).toEqual(["2026-10-06T09:00:00.000Z"]); expect((await s.get(1, "s1"))?.nextRunAt?.toISOString()).toBe("2026-10-07T09:00:00.000Z");
    expect(await runDueSchedules(deps)).toMatchObject({ fired: 0, skipped: 0, failed: 0 });
  });
  it("two workers racing for the same occurrence fire exactly once", async () => {
    const s = await mk(); let fires = 0;
    const deps = { store: s, fire: async () => { fires++; await new Promise((r) => setTimeout(r, 5)); return { ok: true } as const; }, notify: async () => {}, now: () => D("2026-10-06T09:01:00Z") };
    const [a, b] = await Promise.all([runDueSchedules(deps), runDueSchedules(deps)]);
    expect(fires).toBe(1); expect(a.fired + b.fired).toBe(1);
  });
  it("one-off completes after firing", async () => {
    const s = await mk({ kind: "once" }, { onceDate: "2026-10-06" }); let fires = 0;
    await runDueSchedules({ store: s, fire: async () => { fires++; return { ok: true } as const; }, notify: async () => {}, now: () => D("2026-10-06T09:00:10Z") });
    expect(fires).toBe(1); expect((await s.get(1, "s1"))).toMatchObject({ status: "completed", nextRunAt: null });
  });
  it("after downtime longer than the grace window the occurrence is SKIPPED with a notice, not run late; the schedule moves on", async () => {
    const s = await mk(); let fires = 0; const notes: string[] = [];
    const r = await runDueSchedules({ store: s, fire: async () => { fires++; return { ok: true } as const; }, notify: async (_r, t) => { notes.push(t); }, now: () => D("2026-10-09T10:00:00Z") });
    expect(fires).toBe(0); expect(r.skipped).toBe(1); expect(notes[0]).toContain("skipped"); expect((await s.get(1, "s1"))?.nextRunAt?.toISOString()).toBe("2026-10-10T09:00:00.000Z");
  });
  it("failures notify; repeated failures pause the schedule", async () => {
    const s = await mk(); const notes: string[] = []; let t = D("2026-10-06T09:00:10Z");
    const deps = { store: s, fire: async () => ({ ok: false, reason: "no credits", retryable: false }) as const, notify: async (_r: ScheduleRow, title: string, m: string) => { notes.push(title + "|" + m); }, now: () => t };
    await runDueSchedules(deps); expect(notes[0]).toContain("didn't run"); expect(notes[0]).toContain("no credits");
    s.rows.get("s1")!.failures = SCHEDULE_LIMITS.maxConsecutiveFailures - 1; t = D("2026-10-07T09:00:10Z");
    await runDueSchedules(deps); expect((await s.get(1, "s1"))?.status).toBe("paused"); expect(notes.at(-1)).toContain("paused");
  });
  it("a thrown fire() is treated as a failed run, not a crash", async () => {
    const s = await mk(); const deps = { store: s, fire: async () => { throw new Error("boom"); }, notify: async () => {}, now: () => D("2026-10-06T09:00:10Z") };
    expect(await runDueSchedules(deps)).toMatchObject({ retried: 1, failed: 0 });
  });
  it("resume skips missed occurrences", async () => {
    const s = await mk(); await setScheduleStatus(s, 1, "s1", "paused", D("2026-10-06T08:30:00Z"));
    await setScheduleStatus(s, 1, "s1", "active", D("2026-10-20T10:00:00Z"));
    expect((await s.get(1, "s1"))?.nextRunAt?.toISOString()).toBe("2026-10-21T09:00:00.000Z");
  });
});

describe("crash recovery and retry (at-least-once with idempotent execution)", () => {
  const mk = async () => { const s = new MemStore(); await createSchedule(s, 1, { kind: "prompt", title: "Weekly summary", prompt: "Summarise", recurrence: { kind: "daily" }, timezone: "UTC", timeOfDay: "09:00" }, { now: D("2026-10-06T08:00:00Z"), id: "s1" }); return s; };
  it("a worker that crashed after claiming does not lose the run: it is recovered after the lease expires and fired exactly once more", async () => {
    const s = await mk(); const occurrences: string[] = [];
    const crashing = { store: s, fire: async () => { throw Object.assign(new Error("process killed"), { crash: true }); }, notify: async () => {}, now: () => D("2026-10-06T09:00:10Z") };
    // simulate the crash: claim + run record exist but fire never finished (we mark by inserting the state directly)
    const occ = (await s.get(1, "s1"))!.nextRunAt!;
    await s.claim("s1", occ, { nextRunAt: D("2026-10-07T09:00:00Z"), lastRunAt: D("2026-10-06T09:00:10Z"), status: "active", failures: 0 });
    await s.insertRun({ scheduleId: "s1", occurrence: occ, userId: 1, status: "firing", attempts: 1, leaseUntil: new Date(+D("2026-10-06T09:00:10Z") + RUN_POLICY.leaseMs), lastError: null });
    void crashing;
    const before = await runDueSchedules({ store: s, fire: async (_r, o) => { occurrences.push(o.toISOString()); return { ok: true } as const; }, notify: async () => {}, now: () => D("2026-10-06T09:02:00Z") });
    expect(before.recovered).toBe(0); expect(occurrences).toHaveLength(0);
    const after = await runDueSchedules({ store: s, fire: async (_r, o) => { occurrences.push(o.toISOString()); return { ok: true } as const; }, notify: async () => {}, now: () => D("2026-10-06T09:06:00Z") });
    expect(after).toMatchObject({ recovered: 1, fired: 1 }); expect(occurrences).toEqual(["2026-10-06T09:00:00.000Z"]);
    expect([...s.runs.values()][0].status).toBe("done");
    const again = await runDueSchedules({ store: s, fire: async () => { occurrences.push("dup"); return { ok: true } as const; }, notify: async () => {}, now: () => D("2026-10-06T09:30:00Z") });
    expect(again.recovered).toBe(0); expect(occurrences).toHaveLength(1);
  });
  it("two workers racing to recover the same interrupted run: exactly one re-fires it", async () => {
    const s = await mk(); const occ = (await s.get(1, "s1"))!.nextRunAt!; let fires = 0;
    await s.claim("s1", occ, { nextRunAt: D("2026-10-07T09:00:00Z"), lastRunAt: D("2026-10-06T09:00:10Z"), status: "active", failures: 0 });
    await s.insertRun({ scheduleId: "s1", occurrence: occ, userId: 1, status: "firing", attempts: 1, leaseUntil: D("2026-10-06T09:05:00Z"), lastError: null });
    const deps = { store: s, fire: async () => { fires++; await new Promise((r) => setTimeout(r, 5)); return { ok: true } as const; }, notify: async () => {}, now: () => D("2026-10-06T09:10:00Z") };
    await Promise.all([runDueSchedules(deps), runDueSchedules(deps)]); expect(fires).toBe(1);
  });
  it("retryable failures retry with backoff up to maxAttempts, then fail with a notification", async () => {
    const s = await mk(); const notes: string[] = []; let t = D("2026-10-06T09:00:10Z"); let fires = 0;
    const deps = { store: s, fire: async () => { fires++; return { ok: false, reason: "provider down", retryable: true } as const; }, notify: async (_r: ScheduleRow, title: string) => { notes.push(title); }, now: () => t };
    await runDueSchedules(deps); expect(fires).toBe(1);
    for (let i = 0; i < 6; i++) { t = new Date(+t + 10 * 60_000); await runDueSchedules(deps); }
    expect(fires).toBe(RUN_POLICY.maxAttempts); expect([...s.runs.values()][0]).toMatchObject({ status: "failed", lastError: "provider down" }); expect(notes.filter((n) => n.includes("didn't run"))).toHaveLength(1);
  });
  it("a permanent failure (e.g. insufficient credits) does not retry", async () => {
    const s = await mk(); let fires = 0; let t = D("2026-10-06T09:00:10Z");
    const deps = { store: s, fire: async () => { fires++; return { ok: false, reason: "no credits", retryable: false } as const; }, notify: async () => {}, now: () => t };
    await runDueSchedules(deps); t = new Date(+t + 3_600_000); await runDueSchedules(deps); expect(fires).toBe(1);
  });
  it("an interrupted run that is too old is skipped, not replayed late", async () => {
    const s = await mk(); const occ = (await s.get(1, "s1"))!.nextRunAt!; let fires = 0;
    await s.claim("s1", occ, { nextRunAt: D("2026-10-08T09:00:00Z"), lastRunAt: D("2026-10-06T09:00:10Z"), status: "active", failures: 0 });
    await s.insertRun({ scheduleId: "s1", occurrence: occ, userId: 1, status: "firing", attempts: 1, leaseUntil: D("2026-10-06T09:05:00Z"), lastError: null });
    const r = await runDueSchedules({ store: s, fire: async () => { fires++; return { ok: true } as const; }, notify: async () => {}, now: () => D("2026-10-07T09:00:00Z") });
    expect(fires).toBe(0); expect(r.skipped).toBeGreaterThanOrEqual(1);
  });
  it("deleting a schedule abandons its interrupted runs instead of firing them", async () => {
    const s = await mk(); const occ = (await s.get(1, "s1"))!.nextRunAt!; let fires = 0;
    await s.insertRun({ scheduleId: "s1", occurrence: occ, userId: 1, status: "firing", attempts: 1, leaseUntil: D("2026-10-06T09:05:00Z"), lastError: null });
    await deleteSchedule(s, 1, "s1");
    await runDueSchedules({ store: s, fire: async () => { fires++; return { ok: true } as const; }, notify: async () => {}, now: () => D("2026-10-06T09:10:00Z") });
    expect(fires).toBe(0);
  });
});

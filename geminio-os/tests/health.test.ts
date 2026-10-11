import { describe, expect, it } from "vitest";
import { evaluateDatabaseHealth } from "../server/_core/health";

describe("evaluateDatabaseHealth", () => {
  it("reports unavailable when DATABASE_URL is missing (and says why outside production)", async () => {
    const r = await evaluateDatabaseHealth({ databaseUrl: undefined, getClient: async () => ({}), ping: async () => undefined, nodeEnv: "development" });
    expect(r).toEqual({ ok: false, reason: "DATABASE_URL is not configured." });
  });
  it("hides the reason in production", async () => {
    const r = await evaluateDatabaseHealth({ databaseUrl: undefined, getClient: async () => ({}), ping: async () => undefined, nodeEnv: "production" });
    expect(r).toEqual({ ok: false, reason: "Database check failed." });
  });
  it("ok only when the ping succeeds", async () => {
    let pinged = 0;
    const r = await evaluateDatabaseHealth({ databaseUrl: "mysql://x", getClient: async () => ({ id: 1 }), ping: async () => { pinged += 1; }, nodeEnv: "development" });
    expect(r).toEqual({ ok: true });
    expect(pinged).toBe(1);
  });
  it("never echoes connection strings from driver errors", async () => {
    const r = await evaluateDatabaseHealth({ databaseUrl: "mysql://x", getClient: async () => ({}), ping: async () => { throw new Error("connect ECONNREFUSED mysql://root:hunter2@db:3306/app"); }, nodeEnv: "development" });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("[redacted-url]");
    expect(r.reason).not.toContain("hunter2");
  });
  it("times out a hung database", async () => {
    const r = await evaluateDatabaseHealth({ databaseUrl: "mysql://x", getClient: async () => ({}), ping: () => new Promise(() => undefined), nodeEnv: "development", timeoutMs: 20 });
    expect(r).toEqual({ ok: false, reason: "Database check timed out." });
  });
  it("fails when no client can be created", async () => {
    const r = await evaluateDatabaseHealth({ databaseUrl: "mysql://x", getClient: async () => null, ping: async () => undefined, nodeEnv: "development" });
    expect(r.ok).toBe(false);
  });
});

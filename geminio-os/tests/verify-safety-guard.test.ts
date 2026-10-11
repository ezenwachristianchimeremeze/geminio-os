import { describe, expect, it } from "vitest";
import { CONFIRM_VALUE, evaluateSafety } from "../scripts/verify/safety-guard";

const good = { DATABASE_URL: "mysql://u:p@localhost:3306/geminio_verify_tmp", JWT_SECRET: "x".repeat(40), VITE_APP_ID: "app", VERIFY_CONFIRM: CONFIRM_VALUE };
const reasons = (e: Record<string, string | undefined>) => { const r = evaluateSafety(e); return r.ok ? [] : r.reasons.join("|"); };

describe("two-user check safety guard", () => {
  it("accepts a disposable local database with explicit confirmation", () => expect(evaluateSafety(good)).toEqual({ ok: true }));
  it("refuses without confirmation, production, short secret, missing vars", () => {
    expect(reasons({ ...good, VERIFY_CONFIRM: undefined })).toContain("VERIFY_CONFIRM");
    expect(reasons({ ...good, NODE_ENV: "production" })).toContain("production");
    expect(reasons({ ...good, JWT_SECRET: "short" })).toContain("32");
    expect(reasons({ VERIFY_CONFIRM: CONFIRM_VALUE })).toContain("required");
  });
  it("refuses a database whose name is not disposable-looking", () => expect(reasons({ ...good, DATABASE_URL: "mysql://u:p@localhost/geminio" })).toContain("must contain"));
  it("refuses remote DB/API hosts unless explicitly overridden", () => {
    expect(reasons({ ...good, DATABASE_URL: "mysql://u:p@prod.example.com/app_test" })).toContain("not local");
    expect(reasons({ ...good, API_BASE: "https://app.example.com" })).toContain("API_BASE");
    expect(evaluateSafety({ ...good, DATABASE_URL: "mysql://u:p@db.example.com/app_test", VERIFY_ALLOW_REMOTE: "yes", API_BASE: "https://t.example.com" })).toEqual({ ok: true });
  });
  it("rejects malformed URLs", () => expect(reasons({ ...good, DATABASE_URL: "not a url" })).toContain("valid URL"));
});

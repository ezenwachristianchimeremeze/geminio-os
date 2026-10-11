import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertInteractiveUser, CronPrincipalForbiddenError, interactiveUserOrNull, isCronPrincipal } from "../server/_core/principal";

// Shape produced by buildCronUser() in server/_core/sdk.ts
const cron = { id: -1, openId: "cron_abc", role: "user", isCron: true, taskUid: "t-1" };
const real = { id: 42, openId: "u-42", role: "user" };
const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("OPEN-004 cron principal (id -1) is refused on user-facing surfaces", () => {
  it("the synthetic cron user is not an interactive user", () => {
    expect(isCronPrincipal(cron)).toBe(true);
    expect(interactiveUserOrNull(cron)).toBeNull(); // tRPC ctx.user -> protectedProcedure UNAUTHORIZED
    expect(() => assertInteractiveUser(cron)).toThrow(CronPrincipalForbiddenError);
  });
  it("fails closed on id -1 / 0 / non-integer even without the isCron flag", () => {
    for (const id of [-1, 0, 1.5, Number.NaN]) expect(interactiveUserOrNull({ id })).toBeNull();
    expect(interactiveUserOrNull({ id: 7, taskUid: "x" })).toBeNull();
  });
  it("real persisted users are unaffected", () => {
    expect(interactiveUserOrNull(real)).toBe(real);
    expect(assertInteractiveUser(real)).toBe(real);
    expect(interactiveUserOrNull(null)).toBeNull();
  });
  it("tRPC context and both cookie/session endpoints apply the guard (wiring)", () => {
    expect(src("server/_core/context.ts")).toMatch(/interactiveUserOrNull\(\s*await sdk\.authenticateRequest/);
    const oauth = src("server/_core/oauth.ts");
    expect(oauth.match(/assertInteractiveUser\(await sdk\.authenticateRequest\(req\)\)/g)?.length).toBe(2);
    expect(oauth).not.toMatch(/=\s*await sdk\.authenticateRequest\(req\)/);
  });
  it("no other caller of authenticateRequest bypasses the guard", () => {
    const files = ["server/_core/context.ts", "server/_core/oauth.ts"];
    for (const f of files) for (const line of src(f).split("\n")) if (/authenticateRequest\(/.test(line)) expect(line).toMatch(/interactiveUserOrNull|assertInteractiveUser/);
  });
});

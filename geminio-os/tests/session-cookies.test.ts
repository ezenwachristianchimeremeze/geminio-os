import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { getSessionCookieOptions } from "../server/_core/cookies";

const req = (o: Partial<{ protocol: string; hostname: string; headers: Record<string, string> }>) => ({ protocol: "http", hostname: "localhost", headers: {}, ...o }) as unknown as Request;

describe("session cookie options (used by auth.logout and login)", () => {
  it("is httpOnly, path=/ and SameSite=None in every case", () => {
    expect(getSessionCookieOptions(req({}))).toMatchObject({ httpOnly: true, path: "/", sameSite: "none" });
  });
  it("is secure over https and behind an https proxy, not over plain http", () => {
    expect(getSessionCookieOptions(req({ protocol: "https" })).secure).toBe(true);
    expect(getSessionCookieOptions(req({ headers: { "x-forwarded-proto": "http, https" } })).secure).toBe(true);
    expect(getSessionCookieOptions(req({})).secure).toBe(false);
  });
  it("sets no cookie domain for localhost and IP hosts, a parent domain for subdomains", () => {
    expect(getSessionCookieOptions(req({ hostname: "localhost" })).domain).toBeUndefined();
    expect(getSessionCookieOptions(req({ hostname: "10.0.0.5" })).domain).toBeUndefined();
    expect(getSessionCookieOptions(req({ hostname: "example.com" })).domain).toBeUndefined();
    expect(getSessionCookieOptions(req({ hostname: "api.example.com" })).domain).toBe(".example.com");
  });
});

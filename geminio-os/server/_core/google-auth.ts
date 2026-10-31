import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Express, Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { upsertSupabaseGoogleUser } from "../supabase-auth-store";

const STATE_COOKIE = "geminio_google_oauth_state";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

function config() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || "http://localhost:3000/api/auth/callback";
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured");
  return { clientId, clientSecret, redirectUri };
}
function secure(req: Request) { return req.secure || req.headers["x-forwarded-proto"] === "https"; }
function stateCookieOptions(req: Request) {
  return { httpOnly: true, secure: secure(req), sameSite: "lax" as const, path: "/api/auth", maxAge: 10 * 60 * 1000 };
}
function safeEqual(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function registerGoogleAuthRoutes(app: Express) {
  app.get("/api/auth/google", (_req: Request, res: Response) => {
    try {
      const { clientId, redirectUri } = config();
      const state = randomBytes(32).toString("base64url");
      res.cookie(STATE_COOKIE, state, stateCookieOptions(_req));
      const url = new URL(GOOGLE_AUTH_URL);
      url.search = new URLSearchParams({
        client_id: clientId, redirect_uri: redirectUri, response_type: "code",
        scope: "openid email profile", state, prompt: "select_account",
      }).toString();
      res.redirect(302, url.toString());
    } catch (error) {
      console.error("[Google OAuth] Start failed:", error);
      res.status(503).json({ ok: false, error: "Google sign-in is not configured." });
    }
  });

  app.get("/api/auth/callback", async (req: Request, res: Response) => {
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const savedState = req.cookies?.[STATE_COOKIE] || "";
    res.clearCookie(STATE_COOKIE, stateCookieOptions(req));
    if (!code || !state || !savedState || !safeEqual(state, savedState)) {
      res.status(400).json({ ok: false, error: "Google sign-in state is invalid or expired. Please try again." });
      return;
    }
    if (req.query.error) {
      res.status(400).json({ ok: false, error: "Google sign-in was cancelled or denied." });
      return;
    }
    try {
      const { clientId, clientSecret, redirectUri } = config();
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
      });
      if (!tokenResponse.ok) throw new Error("Google rejected the authorization code");
      const tokens = await tokenResponse.json() as { id_token?: string };
      if (!tokens.id_token) throw new Error("Google did not return an ID token");
      const verified = await jwtVerify(tokens.id_token, GOOGLE_JWKS, {
        audience: clientId, issuer: ["https://accounts.google.com", "accounts.google.com"],
      });
      const claims = verified.payload;
      const subject = typeof claims.sub === "string" ? claims.sub : "";
      const email = typeof claims.email === "string" ? claims.email.toLowerCase() : "";
      const name = typeof claims.name === "string" ? claims.name : email;
      if (!subject || !email || claims.email_verified !== true) {
        res.status(403).json({ ok: false, error: "A verified Google email address is required." });
        return;
      }
      const openId = "google:" + subject;
      await upsertSupabaseGoogleUser({ openId, email, name });
      const session = await sdk.createSessionToken(openId, { name, expiresInMs: ONE_YEAR_MS });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, session, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      const frontend = process.env.EXPO_WEB_PREVIEW_URL || process.env.EXPO_PACKAGER_PROXY_URL || "http://localhost:8081";
      res.redirect(302, frontend);
    } catch (error) {
      console.error("[Google OAuth] Callback failed:", error);
      res.status(503).json({ ok: false, error: "Google sign-in could not be completed. Check server configuration and try again." });
    }
  });
}

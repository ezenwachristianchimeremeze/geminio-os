import type { Express, Request, Response } from "express";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import mysql from "mysql2/promise";
import { sdk } from "./sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { getSessionCookieOptions } from "./cookies";

const scrypt = promisify(scryptCallback);
const pool = mysql.createPool(process.env.DATABASE_URL || "mysql://invalid:invalid@127.0.0.1:3306/invalid");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
const token = () => randomBytes(32).toString("base64url");
const normalizeEmail = (v: string) => v.trim().toLowerCase();
const jsonError = (res: Response, status: number, message: string) => res.status(status).json({ ok: false, error: message });
const limiter = new Map<string, { count: number; until: number }>();
function rateLimit(req: Request, res: Response, bucket: string, max = 8) {
  const key = bucket + ":" + (req.ip || req.socket.remoteAddress || "unknown");
  const now = Date.now(); const current = limiter.get(key);
  if (!current || current.until < now) { limiter.set(key, { count: 1, until: now + 15 * 60_000 }); return false; }
  current.count += 1;
  if (current.count > max) { res.setHeader("Retry-After", String(Math.ceil((current.until-now)/1000))); jsonError(res,429,"Too many attempts. Please try again later."); return true; }
  return false;
}
async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return salt + ":" + derived.toString("hex");
}
async function passwordMatches(password: string, stored: string) {
  const [salt, digest] = stored.split(":"); if (!salt || !digest) return false;
  const actual = await scrypt(password, salt, 64) as Buffer; const expected = Buffer.from(digest,"hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
async function sendAuthEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM || "Geminio OS <onboarding@resend.dev>";
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  const response = await fetch("https://api.resend.com/emails", { method:"POST", headers:{ Authorization:"Bearer "+key, "Content-Type":"application/json" }, body:JSON.stringify({ from, to:[to], subject, html }) });
  if (!response.ok) { const body = await response.text(); console.error("[auth-email] provider rejected message", response.status, body.slice(0,300)); throw new Error("Email delivery failed"); }
}
async function createSession(res: Response, req: Request, openId: string, name: string) {
  const jwt = await sdk.createSessionToken(openId,{ name, expiresInMs: ONE_YEAR_MS });
  const options = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME,jwt,{...options,maxAge:ONE_YEAR_MS});
  return jwt;
}
export function registerEmailAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req,res) => {
    if (rateLimit(req,res,"register",5)) return;
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (name.length < 2 || name.length > 120 || !emailPattern.test(email) || password.length < 10 || password.length > 128 || req.body?.acceptedTerms !== true) return jsonError(res,400,"Check your name, email, password (at least 10 characters), and consent.");
    try {
      const [existing] = await pool.execute<mysql.RowDataPacket[]>("SELECT id FROM auth_credentials WHERE email=? LIMIT 1",[email]);
      if (existing.length) return res.status(202).json({ok:true,message:"If this address can be registered, a verification email will be sent."});
      const openId = "local_" + randomBytes(18).toString("hex");
      const [userResult] = await pool.execute<mysql.ResultSetHeader>("INSERT INTO users (openId,name,email,loginMethod,role,lastSignedIn) VALUES (?,?,?,'email','user',NOW())",[openId,name,email]);
      const userId = userResult.insertId;
      const digest = await passwordHash(password);
      await pool.execute("INSERT INTO auth_credentials (userId,email,passwordHash,emailVerified) VALUES (?,?,?,0)",[userId,email,digest]);
      const code = randomBytes(4).toString("hex").slice(0,6).toUpperCase();
      await pool.execute("INSERT INTO auth_action_tokens (tokenHash,userId,purpose,expiresAt) VALUES (?,?, 'verify', DATE_ADD(NOW(), INTERVAL 30 MINUTE))",[hash(code),userId]);
      try { await sendAuthEmail(email,"Verify your Geminio OS email","<p>Your verification code is:</p><h1 style='letter-spacing:8px'>"+code+"</h1><p>It expires in 30 minutes.</p>"); }
      catch { return res.status(202).json({ok:true,message:"Your account was created. Email delivery is temporarily unavailable; request a new verification code when email is configured."}); }
      return res.status(201).json({ok:true,message:"Account created. Check your email for the verification code.",requiresVerification:true});
    } catch(e) { console.error("[auth] registration failed",e); return jsonError(res,503,"Registration is temporarily unavailable. Check database and email configuration."); }
  });
  app.post("/api/auth/sign-in", async (req,res) => {
    if (rateLimit(req,res,"signin",8)) return;
    const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!emailPattern.test(email) || !password) return jsonError(res,400,"Enter a valid email and password.");
    try {
      const [rows] = await pool.execute<mysql.RowDataPacket[]>("SELECT c.userId,c.email,c.passwordHash,c.emailVerified,u.openId,u.name FROM auth_credentials c JOIN users u ON u.id=c.userId WHERE c.email=? LIMIT 1",[email]);
      const account = rows[0];
      if (!account || !(await passwordMatches(password,account.passwordHash))) return jsonError(res,401,"Email or password is incorrect.");
      if (!account.emailVerified) return res.status(403).json({ok:false,code:"EMAIL_NOT_VERIFIED",error:"Verify your email before signing in."});
      await pool.execute("UPDATE users SET lastSignedIn=NOW() WHERE id=?",[account.userId]);
      await createSession(res,req,account.openId,account.name || "");
      return res.json({ok:true,user:{id:account.userId,name:account.name,email:account.email}});
    } catch(e) { console.error("[auth] sign-in failed",e); return jsonError(res,503,"Sign-in is temporarily unavailable."); }
  });
  app.post("/api/auth/email/verify", async (req,res) => {
    if (rateLimit(req,res,"verify",10)) return;
    const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    const code = typeof req.body?.code === "string" ? req.body.code.trim().toUpperCase() : "";
    if (!emailPattern.test(email) || !/^[A-Z0-9]{6}$/.test(code)) return jsonError(res,400,"Enter your email and 6-character verification code.");
    try {
      const [rows] = await pool.execute<mysql.RowDataPacket[]>("SELECT t.id,t.userId,u.openId,u.name FROM auth_action_tokens t JOIN auth_credentials c ON c.userId=t.userId JOIN users u ON u.id=t.userId WHERE c.email=? AND t.tokenHash=? AND t.purpose='verify' AND t.consumedAt IS NULL AND t.expiresAt>NOW() ORDER BY t.id DESC LIMIT 1",[email,hash(code)]);
      const item=rows[0]; if(!item) return jsonError(res,400,"The code is invalid or expired.");
      await pool.execute("UPDATE auth_action_tokens SET consumedAt=NOW() WHERE id=? AND consumedAt IS NULL",[item.id]);
      await pool.execute("UPDATE auth_credentials SET emailVerified=1 WHERE userId=?",[item.userId]);
      await createSession(res,req,item.openId,item.name || "");
      return res.json({ok:true,message:"Email verified.",user:{name:item.name,email}});
    } catch(e) { console.error("[auth] verification failed",e); return jsonError(res,503,"Verification is temporarily unavailable."); }
  });
  app.post("/api/auth/email/resend", async (req,res) => {
    if (rateLimit(req,res,"resend",4)) return;
    const email=typeof req.body?.email==="string"?normalizeEmail(req.body.email):"";
    if (!emailPattern.test(email)) return jsonError(res,400,"Enter a valid email address.");
    try {
      const [rows]=await pool.execute<mysql.RowDataPacket[]>("SELECT c.userId,c.emailVerified FROM auth_credentials c WHERE c.email=? LIMIT 1",[email]);
      if(rows[0] && !rows[0].emailVerified) {
        await pool.execute("UPDATE auth_action_tokens SET consumedAt=NOW() WHERE userId=? AND purpose='verify' AND consumedAt IS NULL",[rows[0].userId]);
        const code=randomBytes(4).toString("hex").slice(0,6).toUpperCase();
        await pool.execute("INSERT INTO auth_action_tokens (tokenHash,userId,purpose,expiresAt) VALUES (?,?, 'verify', DATE_ADD(NOW(), INTERVAL 30 MINUTE))",[hash(code),rows[0].userId]);
        await sendAuthEmail(email,"Verify your Geminio OS email","<p>Your verification code is:</p><h1>"+code+"</h1><p>Expires in 30 minutes.</p>");
      }
      return res.status(202).json({ok:true,message:"If the account needs verification, a new code will be sent."});
    } catch(e) { console.error("[auth] resend failed",e); return res.status(202).json({ok:true,message:"If the account needs verification, a new code will be sent."}); }
  });
  app.post("/api/auth/password/forgot", async (req,res) => {
    if (rateLimit(req,res,"forgot",5)) return;
    const email=typeof req.body?.email==="string"?normalizeEmail(req.body.email):"";
    if (!emailPattern.test(email)) return jsonError(res,400,"Enter a valid email address.");
    try {
      const [rows]=await pool.execute<mysql.RowDataPacket[]>("SELECT userId FROM auth_credentials WHERE email=? AND emailVerified=1 LIMIT 1",[email]);
      if(rows[0]) {
        await pool.execute("UPDATE auth_action_tokens SET consumedAt=NOW() WHERE userId=? AND purpose='reset' AND consumedAt IS NULL",[rows[0].userId]);
        const raw=token(); await pool.execute("INSERT INTO auth_action_tokens (tokenHash,userId,purpose,expiresAt) VALUES (?,?, 'reset', DATE_ADD(NOW(), INTERVAL 15 MINUTE))",[hash(raw),rows[0].userId]);
        const base=(process.env.AUTH_PUBLIC_URL||process.env.EXPO_PUBLIC_APP_URL||"").replace(/\/$/,"");
        await sendAuthEmail(email,"Reset your Geminio OS password","<p><a href='"+base+"/auth/reset-password?token="+encodeURIComponent(raw)+"'>Reset your password</a></p><p>Link expires in 15 minutes.</p>");
      }
    } catch(e) { console.error("[auth] recovery request failed",e); }
    return res.status(202).json({ok:true,message:"If an account exists for that address, password reset instructions will be sent."});
  });
  app.post("/api/auth/password/reset", async (req,res) => {
    if (rateLimit(req,res,"reset",6)) return;
    const raw=typeof req.body?.token==="string"?req.body.token:"";
    const password=typeof req.body?.password==="string"?req.body.password:"";
    if(raw.length<30 || password.length<10 || password.length>128) return jsonError(res,400,"The reset link or new password is invalid.");
    try {
      const [rows]=await pool.execute<mysql.RowDataPacket[]>("SELECT id,userId FROM auth_action_tokens WHERE tokenHash=? AND purpose='reset' AND consumedAt IS NULL AND expiresAt>NOW() LIMIT 1",[hash(raw)]);
      const item=rows[0]; if(!item) return jsonError(res,400,"The reset link is invalid or expired.");
      const digest=await passwordHash(password);
      await pool.execute("UPDATE auth_action_tokens SET consumedAt=NOW() WHERE id=? AND consumedAt IS NULL",[item.id]);
      await pool.execute("UPDATE auth_credentials SET passwordHash=? WHERE userId=?",[digest,item.userId]);
      return res.json({ok:true,message:"Password updated. Sign in with your new password."});
    } catch(e) { console.error("[auth] password reset failed",e); return jsonError(res,503,"Password reset is temporarily unavailable."); }
  });
  app.get("/api/auth/email/status", async (_req,res) => {
    res.json({ok:true,configured:Boolean(process.env.RESEND_API_KEY),senderConfigured:Boolean(process.env.AUTH_EMAIL_FROM),publicUrlConfigured:Boolean(process.env.AUTH_PUBLIC_URL)});
  });
}

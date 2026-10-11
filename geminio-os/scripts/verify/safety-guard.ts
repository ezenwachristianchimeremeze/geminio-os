/** Refuses to run the two-user check against anything that does not look disposable. Pure; unit-tested. */
export type GuardEnv = Record<string, string | undefined>;
export const CONFIRM_VALUE = "i-understand-this-inserts-rows";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "mysql", "db"]);

export function evaluateSafety(env: GuardEnv): { ok: true } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];
  const { DATABASE_URL, JWT_SECRET, VITE_APP_ID } = env;
  if (!DATABASE_URL || !JWT_SECRET || !VITE_APP_ID) reasons.push("DATABASE_URL, JWT_SECRET and VITE_APP_ID are required.");
  if (env.NODE_ENV === "production") reasons.push("NODE_ENV=production is refused.");
  if (env.VERIFY_CONFIRM !== CONFIRM_VALUE) reasons.push(`Set VERIFY_CONFIRM=${CONFIRM_VALUE} to acknowledge that rows are inserted.`);
  const override = env.VERIFY_ALLOW_REMOTE === "yes";
  if (DATABASE_URL) {
    try {
      const u = new URL(DATABASE_URL);
      const dbName = decodeURIComponent(u.pathname.replace(/^\//, ""));
      if (!/(test|verify|tmp|scratch|disposable|ci)/i.test(dbName)) reasons.push(`Database name "${dbName}" must contain test|verify|tmp|scratch|disposable|ci.`);
      if (!LOCAL_HOSTS.has(u.hostname) && !override) reasons.push(`Database host "${u.hostname}" is not local (set VERIFY_ALLOW_REMOTE=yes only for a disposable remote database).`);
    } catch { reasons.push("DATABASE_URL is not a valid URL."); }
  }
  try {
    const b = new URL(env.API_BASE ?? "http://localhost:3000");
    if (!LOCAL_HOSTS.has(b.hostname) && !override) reasons.push(`API_BASE host "${b.hostname}" is not local.`);
  } catch { reasons.push("API_BASE is not a valid URL."); }
  if (JWT_SECRET && JWT_SECRET.length < 32) reasons.push("JWT_SECRET must be at least 32 characters (same value the server runs with).");
  return reasons.length ? { ok: false, reasons } : { ok: true };
}

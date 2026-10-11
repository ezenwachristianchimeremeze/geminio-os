/**
 * Session-signing secret policy. Fail closed: a missing, too-short or placeholder secret must never sign or verify a session.
 * (With the pinned jose 6 an empty HMAC key is rejected by WebCrypto, but older/other runtimes accept it, so we do not rely on that.)
 */
export class SessionSecretError extends Error {
  constructor(message: string) { super(message); this.name = "SessionSecretError"; }
}

const KNOWN_PLACEHOLDERS = [/^replace-with/i, /^your[_-]?(jwt[_-]?)?secret/i, /^changeme/i, /^change-me/i, /^secret$/i, /^your-secret-key-change-in-production$/i];

export function resolveSessionSecret(raw: string | undefined | null, isProduction: boolean): Uint8Array {
  const secret = (raw ?? "").trim();
  if (!secret) throw new SessionSecretError("JWT_SECRET is not configured; sessions cannot be signed or verified.");
  if (isProduction) {
    if (secret.length < 32) throw new SessionSecretError("JWT_SECRET must be at least 32 characters in production.");
    if (KNOWN_PLACEHOLDERS.some((re) => re.test(secret))) throw new SessionSecretError("JWT_SECRET is still a placeholder value; set a random secret.");
  }
  return new TextEncoder().encode(secret);
}

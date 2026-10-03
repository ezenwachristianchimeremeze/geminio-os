/**
 * Security Features Module
 * Implements MFA, rate limiting, CSP, and security auditing
 */

import crypto from 'crypto';

/**
 * Multi-Factor Authentication (MFA)
 */
export interface MFAMethod {
  type: 'totp' | 'sms' | 'email' | 'biometric';
  enabled: boolean;
  verified: boolean;
  createdAt: Date;
}

export interface TOTPSecret {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export class MFAManager {
  /**
   * Generate TOTP secret for authenticator apps
   */
  static generateTOTPSecret(userEmail: string): TOTPSecret {
    const secret = crypto.randomBytes(32).toString('base64');
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // In a real implementation, generate QR code using a library like qrcode
    const qrCode = `otpauth://totp/Geminio%20OS:${userEmail}?secret=${secret}&issuer=Geminio`;

    return { secret, qrCode, backupCodes };
  }

  /**
   * Verify TOTP token
   */
  static verifyTOTP(secret: string, token: string): boolean {
    // In a real implementation, use a library like speakeasy
    // This is a simplified version
    return token.length === 6 && /^\d+$/.test(token);
  }

  /**
   * Generate SMS code
   */
  static generateSMSCode(): string {
    return Math.random().toString().slice(2, 8);
  }

  /**
   * Verify SMS code
   */
  static verifySMSCode(code: string, expectedCode: string, expiryMinutes: number = 5): boolean {
    return code === expectedCode; // In real impl, check expiry too
  }

  /**
   * Generate backup codes
   */
  static generateBackupCodes(count: number = 10): string[] {
    return Array.from({ length: count }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );
  }
}

/**
 * Rate Limiting
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: any) => string; // Function to generate rate limit key
}

export class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const record = this.requests.get(key);

    if (!record || now > record.resetTime) {
      this.requests.set(key, { count: 1, resetTime: now + this.config.windowMs });
      return true;
    }

    if (record.count < this.config.maxRequests) {
      record.count++;
      return true;
    }

    return false;
  }

  getRemainingRequests(key: string): number {
    const record = this.requests.get(key);
    if (!record) return this.config.maxRequests;
    return Math.max(0, this.config.maxRequests - record.count);
  }

  getResetTime(key: string): Date | null {
    const record = this.requests.get(key);
    if (!record) return null;
    return new Date(record.resetTime);
  }

  reset(key: string): void {
    this.requests.delete(key);
  }

  clear(): void {
    this.requests.clear();
  }
}

/**
 * Content Security Policy (CSP)
 */
export interface CSPDirective {
  [key: string]: string[];
}

export interface CSPConfig {
  directives: CSPDirective;
  reportUri?: string;
  blockAllMixedContent?: boolean;
  upgradeInsecureRequests?: boolean;
}

export class CSPBuilder {
  private config: CSPConfig;

  constructor() {
    this.config = {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'https:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
      },
    };
  }

  addDirective(name: string, sources: string[]): this {
    this.config.directives[name] = sources;
    return this;
  }

  setReportUri(uri: string): this {
    this.config.reportUri = uri;
    return this;
  }

  blockMixedContent(): this {
    this.config.blockAllMixedContent = true;
    return this;
  }

  upgradeInsecureRequests(): this {
    this.config.upgradeInsecureRequests = true;
    return this;
  }

  build(): string {
    let csp = '';

    for (const [directive, sources] of Object.entries(this.config.directives)) {
      csp += `${directive} ${sources.join(' ')}; `;
    }

    if (this.config.blockAllMixedContent) {
      csp += 'block-all-mixed-content; ';
    }

    if (this.config.upgradeInsecureRequests) {
      csp += 'upgrade-insecure-requests; ';
    }

    if (this.config.reportUri) {
      csp += `report-uri ${this.config.reportUri}`;
    }

    return csp.trim();
  }
}

/**
 * Security Audit Logging
 */
export interface SecurityAuditLog {
  id: string;
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  result: 'success' | 'failure';
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export class SecurityAuditLogger {
  private logs: SecurityAuditLog[] = [];

  log(entry: Omit<SecurityAuditLog, 'id' | 'timestamp'>): void {
    this.logs.push({
      ...entry,
      id: `audit-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
    });

    // Keep only last 10000 logs in memory
    if (this.logs.length > 10000) {
      this.logs = this.logs.slice(-10000);
    }
  }

  getLogs(limit: number = 100): SecurityAuditLog[] {
    return this.logs.slice(-limit);
  }

  getLogsByUser(userId: string, limit: number = 100): SecurityAuditLog[] {
    return this.logs.filter((log) => log.userId === userId).slice(-limit);
  }

  getFailedAttempts(limit: number = 100): SecurityAuditLog[] {
    return this.logs.filter((log) => log.result === 'failure').slice(-limit);
  }

  clear(): void {
    this.logs = [];
  }
}

/**
 * Password Security
 */
export class PasswordSecurity {
  private static readonly SCRYPT_KEY_LENGTH = 64;

  private static deriveKey(password: string, salt: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      crypto.scrypt(password, salt, PasswordSecurity.SCRYPT_KEY_LENGTH, { N: 16_384, r: 8, p: 1 }, (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      });
    });
  }

  /**
   * Hash a password with a per-password salt and memory-hard scrypt.
   */
  static async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString("base64url");
    const digest = await PasswordSecurity.deriveKey(password, salt);
    return `$scrypt$${salt}$${digest.toString("base64url")}`;
  }

  /**
   * Verify password
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    const parts = hash.split("$");
    if (parts.length === 4 && parts[1] === "scrypt") {
      const [, , salt, encodedDigest] = parts;
      const expected = Buffer.from(encodedDigest, "base64url");
      const actual = await PasswordSecurity.deriveKey(password, salt);
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    }

    // Legacy SHA-256 hashes remain verifiable so existing accounts can migrate
    // on their next password change; new hashes always use scrypt above.
    const legacyDigest = crypto.createHash("sha256").update(password).digest("hex");
    const supplied = Buffer.from(hash);
    return supplied.length === legacyDigest.length && crypto.timingSafeEqual(Buffer.from(legacyDigest), supplied);
  }

  /**
   * Check password strength
   */
  static checkPasswordStrength(password: string): {
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 8) score++;
    else feedback.push('Password should be at least 8 characters');

    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    else feedback.push('Password should contain lowercase letters');

    if (/[A-Z]/.test(password)) score++;
    else feedback.push('Password should contain uppercase letters');

    if (/\d/.test(password)) score++;
    else feedback.push('Password should contain numbers');

    if (/[^a-zA-Z\d]/.test(password)) score++;
    else feedback.push('Password should contain special characters');

    return { score, feedback };
  }
}

/**
 * CORS Configuration
 */
export interface CORSConfig {
  origin: string | string[] | RegExp;
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  maxAge: number;
}

export function createCORSConfig(options?: Partial<CORSConfig>): CORSConfig {
  return {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400,
    ...options,
  };
}

/**
 * API Key Management
 */
export class APIKeyManager {
  private keys: Map<string, { key: string; createdAt: Date; expiresAt?: Date }> = new Map();

  generateKey(userId: string, expiryDays?: number): string {
    const key = crypto.randomBytes(32).toString('hex');
    const expiresAt = expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : undefined;

    this.keys.set(key, {
      key,
      createdAt: new Date(),
      expiresAt,
    });

    return key;
  }

  validateKey(key: string): boolean {
    const record = this.keys.get(key);
    if (!record) return false;

    if (record.expiresAt && new Date() > record.expiresAt) {
      this.keys.delete(key);
      return false;
    }

    return true;
  }

  revokeKey(key: string): void {
    this.keys.delete(key);
  }
}

/**
 * Encryption Utilities
 */
export class EncryptionUtils {
  private algorithm = 'aes-256-gcm';

  encrypt(text: string, key: string): { encrypted: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(key, 'hex'), iv) as any;

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  decrypt(
    encrypted: string,
    key: string,
    iv: string,
    authTag: string
  ): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      Buffer.from(key, 'hex'),
      Buffer.from(iv, 'hex')
    ) as any;

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

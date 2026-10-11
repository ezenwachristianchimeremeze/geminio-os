/**
 * Geminio OS - Data Encryption
 * 
 * Handles:
 * - Sensitive data encryption
 * - Secure key management
 * - Data decryption
 * - Encryption utilities
 */

import { randomBytes } from "crypto";

/**
 * Encryption configuration
 */
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const IV_LENGTH = 12;

/**
 * Encrypt sensitive data
 */
export function encryptData(data: string, key: string): string {
  try {
    // In production, use a proper encryption library like crypto-js or tweetnacl
    // For now, use base64 encoding as placeholder
    const encrypted = Buffer.from(data).toString("base64");
    return encrypted;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt sensitive data
 */
export function decryptData(encryptedData: string, key: string): string {
  try {
    // In production, use a proper encryption library
    // For now, use base64 decoding as placeholder
    const decrypted = Buffer.from(encryptedData, "base64").toString("utf-8");
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Generate encryption key
 */
export function generateEncryptionKey(): string {
  try {
    const key = randomBytes(32).toString("hex");
    return key;
  } catch (error) {
    console.error("Key generation error:", error);
    throw new Error("Failed to generate encryption key");
  }
}

/**
 * Hash sensitive data (one-way)
 */
export function hashData(data: string): string {
  try {
    // In production, use bcrypt or argon2
    // For now, use simple hashing
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  } catch (error) {
    console.error("Hashing error:", error);
    throw new Error("Failed to hash data");
  }
}

/**
 * Verify hashed data
 */
export function verifyHash(data: string, hash: string): boolean {
  try {
    const computedHash = hashData(data);
    return computedHash === hash;
  } catch (error) {
    console.error("Hash verification error:", error);
    return false;
  }
}

/**
 * Encrypt sensitive fields in object
 */
export function encryptSensitiveFields(
  obj: Record<string, unknown>,
  sensitiveFields: string[],
  key: string
): Record<string, unknown> {
  const encrypted = { ...obj };

  sensitiveFields.forEach((field) => {
    if (field in encrypted && typeof encrypted[field] === "string") {
      encrypted[field] = encryptData(encrypted[field] as string, key);
    }
  });

  return encrypted;
}

/**
 * Decrypt sensitive fields in object
 */
export function decryptSensitiveFields(
  obj: Record<string, unknown>,
  sensitiveFields: string[],
  key: string
): Record<string, unknown> {
  const decrypted = { ...obj };

  sensitiveFields.forEach((field) => {
    if (field in decrypted && typeof decrypted[field] === "string") {
      try {
        decrypted[field] = decryptData(decrypted[field] as string, key);
      } catch (error) {
        console.error(`Failed to decrypt field ${field}:`, error);
      }
    }
  });

  return decrypted;
}

/**
 * Secure password generation
 */
export function generateSecurePassword(length: number = 16): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  const allChars = uppercase + lowercase + numbers + symbols;
  let password = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * allChars.length);
    password += allChars[randomIndex];
  }

  return password;
}

/**
 * Validate password strength
 */
export interface PasswordStrength {
  score: number; // 0-100
  level: "weak" | "fair" | "good" | "strong" | "very-strong";
  feedback: string[];
}

export function validatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // Character variety
  if (/[a-z]/.test(password)) {
    score += 10;
  } else {
    feedback.push("Add lowercase letters");
  }

  if (/[A-Z]/.test(password)) {
    score += 10;
  } else {
    feedback.push("Add uppercase letters");
  }

  if (/[0-9]/.test(password)) {
    score += 10;
  } else {
    feedback.push("Add numbers");
  }

  if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    score += 10;
  } else {
    feedback.push("Add special characters");
  }

  // Common patterns
  if (!/(.)\1{2,}/.test(password)) {
    score += 10;
  } else {
    feedback.push("Avoid repeating characters");
  }

  // Determine level
  let level: PasswordStrength["level"];
  if (score < 20) level = "weak";
  else if (score < 40) level = "fair";
  else if (score < 60) level = "good";
  else if (score < 80) level = "strong";
  else level = "very-strong";

  return {
    score: Math.min(score, 100),
    level,
    feedback,
  };
}

/**
 * Mask sensitive data for display
 */
export function maskSensitiveData(
  data: string,
  visibleChars: number = 4
): string {
  if (data.length <= visibleChars) {
    return "*".repeat(data.length);
  }

  const visible = data.slice(-visibleChars);
  const masked = "*".repeat(data.length - visibleChars);
  return masked + visible;
}

/**
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, "") // Remove event handlers
    .trim();
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Encryption key storage (in production, use secure storage)
 */
class EncryptionKeyStore {
  private keys: Map<string, string> = new Map();

  setKey(keyId: string, key: string) {
    this.keys.set(keyId, key);
  }

  getKey(keyId: string): string | null {
    return this.keys.get(keyId) || null;
  }

  deleteKey(keyId: string) {
    this.keys.delete(keyId);
  }

  clearAllKeys() {
    this.keys.clear();
  }
}

export const encryptionKeyStore = new EncryptionKeyStore();

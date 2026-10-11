/**
 * Geminio OS - Authentication Middleware
 * 
 * Handles:
 * - Session management
 * - Token validation
 * - User authentication
 * - Permission checks
 */

import { Request, Response, NextFunction } from "express";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-in-production"
);

interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

/**
 * Verify JWT token
 */
export async function verifyToken(token: string) {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

/**
 * Authentication middleware
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token =
      req.headers.authorization?.replace("Bearer ", "") ||
      req.cookies?.token;

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.userId = payload.sub as string;
    req.user = {
      id: payload.sub as string,
      email: payload.email as string,
      name: payload.name as string,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}

/**
 * Optional authentication middleware
 */
export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token =
      req.headers.authorization?.replace("Bearer ", "") ||
      req.cookies?.token;

    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        req.userId = payload.sub as string;
        req.user = {
          id: payload.sub as string,
          email: payload.email as string,
          name: payload.name as string,
        };
      }
    }

    next();
  } catch (error) {
    console.error("Optional auth middleware error:", error);
    next();
  }
}

/**
 * Permission check middleware
 */
export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check user permissions (implement based on your permission system)
    // For now, just verify user is authenticated
    next();
  };
}

/**
 * Rate limiting middleware
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(maxRequests: number = 100, windowMs: number = 60000) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const key = req.userId || req.ip || "anonymous";
    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (record && now < record.resetTime) {
      if (record.count >= maxRequests) {
        return res.status(429).json({
          error: "Too many requests",
          retryAfter: Math.ceil((record.resetTime - now) / 1000),
        });
      }
      record.count++;
    } else {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
    }

    res.set("X-RateLimit-Limit", maxRequests.toString());
    res.set(
      "X-RateLimit-Remaining",
      (maxRequests - (record?.count || 1)).toString()
    );

    next();
  };
}

/**
 * Audit logging middleware
 */
export function auditLog(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const log = {
      timestamp: new Date(),
      userId: req.userId || "anonymous",
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
    };

    // Log to console for now, can be extended to database
    if (res.statusCode >= 400) {
      console.warn("Audit log:", log);
    }
  });

  next();
}

/**
 * CSRF protection middleware
 */
const csrfTokens = new Set<string>();

export function generateCSRFToken(): string {
  const token = Math.random().toString(36).substring(2, 15);
  csrfTokens.add(token);
  return token;
}

export function csrfProtection(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const token = req.headers["x-csrf-token"] as string;
  if (!token || !csrfTokens.has(token)) {
    return res.status(403).json({ error: "CSRF token invalid" });
  }

  csrfTokens.delete(token);
  next();
}

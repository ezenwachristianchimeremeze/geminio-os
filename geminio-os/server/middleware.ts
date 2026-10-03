import { Request, Response, NextFunction } from 'express';

/**
 * Backend Middleware Module
 * Provides rate limiting, compression, error handling, and request logging
 */

interface RateLimitConfig {
  windowMs?: number;
  maxRequests?: number;
  message?: string;
}

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

/**
 * Rate Limiting Middleware
 */
export function createRateLimiter(config: RateLimitConfig = {}) {
  const windowMs = config.windowMs || 60 * 1000;
  const maxRequests = config.maxRequests || 100;
  const message = config.message || 'Too many requests, please try again later';

  const store: RateLimitStore = {};

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();

    if (!store[key]) {
      store[key] = { count: 0, resetTime: now + windowMs };
    }

    const record = store[key];

    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }

    record.count++;

    res.set('X-RateLimit-Limit', maxRequests.toString());
    res.set('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count).toString());
    res.set('X-RateLimit-Reset', record.resetTime.toString());

    if (record.count > maxRequests) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message,
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    next();
  };
}

/**
 * Request Logging Middleware
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const method = req.method;
  const path = req.path;

  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - startTime;
    const status = res.statusCode;

    console.log(`[${new Date().toISOString()}] ${method} ${path} - ${status} (${duration}ms)`);

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Error Handling Middleware
 */
export function errorHandlingMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error:', err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    error: {
      status,
      message,
      timestamp: new Date().toISOString(),
      path: req.path,
    },
  });
}

/**
 * CORS Configuration Middleware
 */
export function corsMiddleware(allowedOrigins: string[] = ['*']) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin || '';

    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  };
}

/**
 * Request Validation Middleware
 */
export function requestValidationMiddleware(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error: any) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors || error.message,
      });
    }
  };
}

/**
 * Response Validation Middleware
 */
export function responseValidationMiddleware(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;

    res.json = function (data: any) {
      try {
        const validated = schema.parse(data);
        return originalJson.call(this, validated);
      } catch (error: any) {
        console.error('Response validation error:', error);
        return originalJson.call(this, {
          error: 'Internal Server Error',
          message: 'Response validation failed',
        });
      }
    };

    next();
  };
}

/**
 * Webhook Receiver Middleware
 */
export function webhookReceiverMiddleware(
  verifySignature?: (req: Request, signature: string) => boolean
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const signature = req.headers['x-webhook-signature'] as string;

    if (verifySignature && !verifySignature(req, signature)) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid webhook signature',
      });
    }

    (req as any).webhookData = req.body;
    (req as any).webhookSignature = signature;

    next();
  };
}

/**
 * Health Check Endpoint
 */
export function healthCheckEndpoint(req: Request, res: Response) {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

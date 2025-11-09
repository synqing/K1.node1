import RateLimiter from './rate-limiter';
import { Request } from 'express';

// Global rate limiter: 1000 requests per 15 minutes per IP
export const globalRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 1000,
});

// API rate limiter: 300 requests per 5 minutes per IP
export const apiRateLimiter = new RateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 300,
  keyGenerator: (req) => `api:${req.ip}`,
});

// Error recovery endpoints: 100 requests per minute per IP
export const errorRecoveryRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
  keyGenerator: (req) => `error-recovery:${req.ip}`,
});

// Scheduler endpoints: 200 requests per minute per IP
export const schedulerRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 200,
  keyGenerator: (req) => `scheduler:${req.ip}`,
});

// Webhook endpoints: 500 requests per minute per IP
export const webhookRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 500,
  keyGenerator: (req) => `webhook:${req.ip}`,
});

// Batch operations: 50 requests per minute per IP (stricter for batch)
export const batchRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 50,
  keyGenerator: (req) => `batch:${req.ip}`,
});

// Login/auth endpoints: 10 attempts per 15 minutes per IP (strict)
export const authRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyGenerator: (req) => `auth:${req.ip}`,
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Create user-based rate limiter (for authenticated endpoints)
export function createUserRateLimiter(windowMs: number, maxRequests: number) {
  return new RateLimiter({
    windowMs,
    maxRequests,
    keyGenerator: (req) => {
      const userId = (req as any).user?.id || req.ip;
      return `user:${userId}`;
    },
  });
}

// Create role-based rate limiter
export function createRoleBasedRateLimiter(
  windowMs: number,
  baseLimit: number,
  roleMultipliers: Record<string, number> = {}
) {
  return new RateLimiter({
    windowMs,
    maxRequests: baseLimit,
    keyGenerator: (req) => {
      const user = (req as any).user;
      if (!user) return `anon:${req.ip}`;
      const role = user.role || 'user';
      const multiplier = roleMultipliers[role] || 1;
      return `role:${role}:${user.id}`;
    },
  });
}

// Service-level rate limiter (per service endpoint)
export const createServiceRateLimiter = (service: string) =>
  new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyGenerator: (req) => `service:${service}:${req.ip}`,
  });

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import RateLimiter from '../middleware/rate-limiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      windowMs: 1000,
      maxRequests: 3,
    });

    mockReq = {
      ip: '127.0.0.1',
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      statusCode: 200,
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic rate limiting', () => {
    it('should allow requests within limit', async () => {
      const middleware = rateLimiter.middleware();

      // First 3 requests should pass
      for (let i = 0; i < 3; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests exceeding limit', async () => {
      const middleware = rateLimiter.middleware();

      // Make 4 requests (limit is 3)
      for (let i = 0; i < 4; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      // Fourth request should be rejected
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should return 429 Too Many Requests status', async () => {
      const middleware = rateLimiter.middleware();

      for (let i = 0; i < 4; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      const statusCall = (mockRes.status as any).mock.calls[0];
      expect(statusCall[0]).toBe(429);
    });

    it('should include retryAfter in response', async () => {
      const middleware = rateLimiter.middleware();

      for (let i = 0; i < 4; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      const jsonCall = (mockRes.json as any).mock.calls[0];
      expect(jsonCall[0]).toHaveProperty('retryAfter');
    });
  });

  describe('Custom key generator', () => {
    it('should use custom key generator', async () => {
      const customLimiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 2,
        keyGenerator: (req) => `user:${(req as any).userId}`,
      });

      const middleware = customLimiter.middleware();

      mockReq.userId = 'user123';

      for (let i = 0; i < 2; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      // Third request should fail
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should separate limits by key', async () => {
      const customLimiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 2,
        keyGenerator: (req) => `user:${(req as any).userId}`,
      });

      const middleware = customLimiter.middleware();

      // User 1 makes 2 requests (at limit)
      mockReq.userId = 'user1';
      for (let i = 0; i < 2; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      // User 2 should have fresh limit
      mockReq.userId = 'user2';
      mockRes.status = vi.fn().mockReturnThis();
      mockRes.json = vi.fn().mockReturnThis();

      await middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).not.toHaveBeenCalledWith(429);
    });
  });

  describe('Skip options', () => {
    it('should skip successful requests when configured', async () => {
      const limiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 2,
        skipSuccessfulRequests: true,
      });

      const middleware = limiter.middleware();
      mockRes.statusCode = 200; // Success

      // Make 5 requests, all successful - should not hit limit
      for (let i = 0; i < 5; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockRes.status).not.toHaveBeenCalledWith(429);
    });

    it('should skip failed requests when configured', async () => {
      const limiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 2,
        skipFailedRequests: true,
      });

      const middleware = limiter.middleware();
      mockRes.statusCode = 500; // Error

      // Make 5 requests, all failing - should not hit limit
      for (let i = 0; i < 5; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockRes.status).not.toHaveBeenCalledWith(429);
    });
  });

  describe('Custom handler', () => {
    it('should use custom handler when provided', async () => {
      const customHandler = vi.fn();
      const limiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 1,
        handler: customHandler,
      });

      const middleware = limiter.middleware();

      // Make 2 requests (limit is 1)
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(customHandler).toHaveBeenCalled();
    });
  });

  describe('Reset and status', () => {
    it('should reset rate limit for a key', async () => {
      const limiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 2,
      });

      await limiter.reset('127.0.0.1');

      const status = await limiter.getStatus('127.0.0.1');
      expect(status.count).toBe(0);
      expect(status.remaining).toBe(2);
    });

    it('should return accurate status', async () => {
      const limiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 5,
      });

      const middleware = limiter.middleware();

      // Make 2 requests
      for (let i = 0; i < 2; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      const status = await limiter.getStatus('127.0.0.1');
      expect(status.count).toBe(2);
      expect(status.remaining).toBe(3);
    });
  });

  describe('Time window reset', () => {
    it('should reset count after window expires', async () => {
      const limiter = new RateLimiter({
        windowMs: 100, // 100ms window
        maxRequests: 2,
      });

      const middleware = limiter.middleware();

      // Make 2 requests
      for (let i = 0; i < 2; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next request should succeed
      mockRes.status = vi.fn().mockReturnThis();
      mockRes.json = vi.fn().mockReturnThis();

      await middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).not.toHaveBeenCalledWith(429);
    });
  });

  describe('Multiple IP addresses', () => {
    it('should track separate limits per IP', async () => {
      const limiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 2,
      });

      const middleware = limiter.middleware();

      // IP 1 makes 2 requests
      mockReq.ip = '192.168.1.1';
      for (let i = 0; i < 2; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      // IP 2 should have fresh limit
      mockReq.ip = '192.168.1.2';
      mockRes.status = vi.fn().mockReturnThis();
      mockRes.json = vi.fn().mockReturnThis();

      for (let i = 0; i < 2; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockRes.status).not.toHaveBeenCalledWith(429);
    });
  });

  describe('Error handling', () => {
    it('should handle missing IP gracefully', async () => {
      const limiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 2,
      });

      const middleware = limiter.middleware();
      delete mockReq.ip;

      // Should not throw
      expect(async () => {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();
    });
  });
});

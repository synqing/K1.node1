/**
 * Authentication & Authorization Middleware (v2)
 * V2-specific implementation with enhanced validation and error handling
 * Task T3: API v2 Router Scaffolding
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * V2 Authentication scopes
 * Extended scope list for v2 API with additional granularity
 */
export const SCOPES_V2 = {
  // Error Recovery scopes
  ERROR_RECOVERY_READ: 'v2:error-recovery:read',
  ERROR_RECOVERY_WRITE: 'v2:error-recovery:write',
  ERROR_RECOVERY_ADMIN: 'v2:error-recovery:admin',

  // Scheduler scopes
  SCHEDULER_READ: 'v2:scheduler:read',
  SCHEDULER_WRITE: 'v2:scheduler:write',
  SCHEDULER_ADMIN: 'v2:scheduler:admin',

  // Task management scopes
  TASK_WRITE: 'v2:task:write',
  TASK_ADMIN: 'v2:task:admin',

  // Admin scope (super-permission)
  ADMIN: 'v2:admin',
} as const;

export type ScopeV2 = typeof SCOPES_V2[keyof typeof SCOPES_V2];

/**
 * Authenticated request with user/client context (v2)
 */
export interface AuthenticatedRequest extends Request {
  client?: {
    id: string;
    name: string;
    type: 'api-key' | 'oauth' | 'jwt';
    scopes: ScopeV2[];
  };
  user?: {
    id: string;
    email: string;
    name: string;
    scopes: ScopeV2[];
  };
  authToken?: string;
  requestId?: string;
}

/**
 * Authentication error class
 */
export class AuthErrorV2 extends Error {
  constructor(
    public code: string,
    public status: number = 401,
    message: string = 'Authentication failed'
  ) {
    super(message);
    this.name = 'AuthErrorV2';
  }
}

/**
 * Extract authentication token from request
 * Supports: Authorization: Bearer <token>
 */
export const extractTokenV2 = (req: AuthenticatedRequest): string | null => {
  const authHeader = req.get('Authorization');
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return null;

  return token || null;
};

/**
 * API Key validation (v2)
 * Format: Bearer sk-{env}-{random}
 */
export const validateApiKeyV2 = (
  token: string
): { clientId: string; scopes: ScopeV2[] } | null => {
  // In production, validate against API key database
  if (!token.startsWith('sk-')) {
    return null;
  }

  // Mock API key database (replace with real DB in production)
  const mockApiKeys: Record<string, { clientId: string; scopes: ScopeV2[] }> = {
    'sk-prod-dashboard': {
      clientId: 'dashboard-app',
      scopes: [
        SCOPES_V2.SCHEDULER_READ,
        SCOPES_V2.SCHEDULER_WRITE,
        SCOPES_V2.ERROR_RECOVERY_READ,
        SCOPES_V2.ERROR_RECOVERY_WRITE,
        SCOPES_V2.TASK_WRITE,
      ],
    },
    'sk-prod-backend': {
      clientId: 'backend-service',
      scopes: [SCOPES_V2.ADMIN],
    },
    'sk-test-client': {
      clientId: 'test-client',
      scopes: [
        SCOPES_V2.SCHEDULER_READ,
        SCOPES_V2.ERROR_RECOVERY_READ,
      ],
    },
  };

  return mockApiKeys[token] || null;
};

/**
 * JWT token validation (v2)
 * Validates structure and expiration
 */
interface JWTPayloadV2 {
  sub: string; // subject (user/client ID)
  scopes: ScopeV2[];
  iat: number; // issued at
  exp: number; // expiration
  aud?: string; // audience
  iss?: string; // issuer
  email?: string;
  name?: string;
}

export const validateJWTV2 = (token: string): JWTPayloadV2 | null => {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Decode payload (base64url)
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Token expired
    }

    // Validate required fields
    if (!payload.sub || !payload.scopes || !Array.isArray(payload.scopes)) {
      return null;
    }

    // In production, verify signature using issuer's public key
    // For now, just validate structure
    return payload;
  } catch (error) {
    return null;
  }
};

/**
 * Get effective scopes for request
 */
export const getEffectiveScopesV2 = (req: AuthenticatedRequest): ScopeV2[] => {
  // Admin scope overrides everything
  if (req.client?.scopes.includes(SCOPES_V2.ADMIN)) {
    return [SCOPES_V2.ADMIN];
  }
  if (req.user?.scopes.includes(SCOPES_V2.ADMIN)) {
    return [SCOPES_V2.ADMIN];
  }

  // Return client or user scopes
  return req.client?.scopes || req.user?.scopes || [];
};

/**
 * Check if request has required scopes
 */
export const hasScopeV2 = (req: AuthenticatedRequest, ...requiredScopes: ScopeV2[]): boolean => {
  const scopes = getEffectiveScopesV2(req);

  // Admin scope grants all permissions
  if (scopes.includes(SCOPES_V2.ADMIN)) {
    return true;
  }

  // Check if any required scope is present
  return requiredScopes.some((required) => scopes.includes(required));
};

/**
 * Main authentication middleware (v2)
 * Validates tokens and populates user/client context
 */
export const authMiddlewareV2 = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const token = extractTokenV2(req);

  if (!token) {
    // No authentication provided
    // Allow public endpoints, will check authorization later
    req.client = undefined;
    req.user = undefined;
    return next();
  }

  // Try API Key authentication
  const apiKeyValidation = validateApiKeyV2(token);
  if (apiKeyValidation) {
    req.client = {
      id: apiKeyValidation.clientId,
      name: apiKeyValidation.clientId,
      type: 'api-key',
      scopes: apiKeyValidation.scopes,
    };
    return next();
  }

  // Try JWT authentication
  const jwtValidation = validateJWTV2(token);
  if (jwtValidation) {
    req.user = {
      id: jwtValidation.sub,
      email: jwtValidation.email || '',
      name: jwtValidation.name || '',
      scopes: jwtValidation.scopes,
    };
    return next();
  }

  // Invalid token
  return res.status(401).json({
    status: 'error',
    error: {
      code: 'INVALID_TOKEN',
      message: 'Invalid or expired authentication token',
      status: 401,
      timestamp: new Date().toISOString(),
    },
  });
};

/**
 * Scope validation middleware factory (v2)
 */
export const requireScopesV2 = (...scopes: ScopeV2[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!hasScopeV2(req, ...scopes)) {
      const effectiveScopes = getEffectiveScopesV2(req);
      return res.status(403).json({
        status: 'error',
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Insufficient permissions. Required: ${scopes.join(', ')}`,
          status: 403,
          timestamp: new Date().toISOString(),
          details: {
            required_scopes: scopes,
            your_scopes: effectiveScopes,
          },
        },
      });
    }
    next();
  };
};

/**
 * Authentication required middleware (v2)
 */
export const requireAuthV2 = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.client && !req.user) {
    return res.status(401).json({
      status: 'error',
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required for this endpoint',
        status: 401,
        timestamp: new Date().toISOString(),
        details: {
          field: 'Authorization',
          suggestion: 'Provide a valid API key or JWT token via Authorization header',
        },
      },
    });
  }
  next();
};

/**
 * Rate limiting information
 */
export interface RateLimitInfoV2 {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number; // seconds
}

/**
 * Set rate limit headers in response
 */
export const setRateLimitHeadersV2 = (res: Response, info: RateLimitInfoV2) => {
  res.set('X-RateLimit-Limit', String(info.limit));
  res.set('X-RateLimit-Remaining', String(info.remaining));
  res.set('X-RateLimit-Reset', info.reset.toISOString());

  if (info.retryAfter) {
    res.set('Retry-After', String(info.retryAfter));
  }
};

/**
 * Generate access token (v2)
 * In production, use a proper JWT library like jsonwebtoken
 */
export const generateAccessTokenV2 = (payload: JWTPayloadV2): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
    'base64url'
  );
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'secret')
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
};

/**
 * Webhook signature verification for v2 endpoints
 */
export interface WebhookVerificationOptionsV2 {
  secret: string;
  tolerance?: number; // Time tolerance in seconds (default: 300 = 5 minutes)
}

export const verifyWebhookSignatureV2 = (
  payload: string,
  signature: string,
  options: WebhookVerificationOptionsV2
): boolean => {
  try {
    // Signature format: sha256=hex_encoded_hash
    const [algorithm, providedHash] = signature.split('=');
    if (algorithm !== 'sha256') return false;

    // Compute HMAC-SHA256
    const computed = crypto
      .createHmac('sha256', options.secret)
      .update(payload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(providedHash),
      Buffer.from(computed)
    );
  } catch (error) {
    return false;
  }
};

/**
 * Webhook signature verification middleware (v2)
 */
export const verifyWebhookV2 = (secret: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const signature = req.get('X-Conductor-Signature');
    if (!signature) {
      return res.status(401).json({
        status: 'error',
        error: {
          code: 'MISSING_SIGNATURE',
          message: 'Webhook signature is required',
          status: 401,
          timestamp: new Date().toISOString(),
        },
      });
    }

    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const isValid = verifyWebhookSignatureV2(rawBody, signature, { secret });

    if (!isValid) {
      return res.status(401).json({
        status: 'error',
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Webhook signature verification failed',
          status: 401,
          timestamp: new Date().toISOString(),
        },
      });
    }

    next();
  };
};

export default authMiddlewareV2;

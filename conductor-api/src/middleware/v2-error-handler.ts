/**
 * V2 Error Handler Middleware
 * Centralized error handling for API v2 with consistent error formatting
 * Task T8: API Versioning Middleware
 *
 * Features:
 * - Catches and formats all errors consistently
 * - Includes request ID for tracing
 * - Appropriate HTTP status code mapping
 * - Hides sensitive information
 * - Logs errors with context
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Custom error types for API
 */
export class APIError extends Error {
  constructor(
    public code: string,
    public status: number = 500,
    message: string = 'Internal Server Error',
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

export class ValidationError extends APIError {
  constructor(message: string = 'Validation failed', details?: Record<string, any>) {
    super('VALIDATION_ERROR', 400, message, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends APIError {
  constructor(message: string = 'Resource not found', details?: Record<string, any>) {
    super('NOT_FOUND', 404, message, details);
    this.name = 'NotFoundError';
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string = 'Authentication required', details?: Record<string, any>) {
    super('AUTHENTICATION_ERROR', 401, message, details);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends APIError {
  constructor(message: string = 'Insufficient permissions', details?: Record<string, any>) {
    super('AUTHORIZATION_ERROR', 403, message, details);
    this.name = 'AuthorizationError';
  }
}

export class ConflictError extends APIError {
  constructor(message: string = 'Resource conflict', details?: Record<string, any>) {
    super('CONFLICT_ERROR', 409, message, details);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends APIError {
  constructor(
    message: string = 'Rate limit exceeded',
    public retryAfter?: number,
    details?: Record<string, any>
  ) {
    super('RATE_LIMIT_EXCEEDED', 429, message, details);
    this.name = 'RateLimitError';
  }
}

export class ServerError extends APIError {
  constructor(message: string = 'Internal server error', details?: Record<string, any>) {
    super('INTERNAL_SERVER_ERROR', 500, message, details);
    this.name = 'ServerError';
  }
}

/**
 * Error response interface
 */
export interface ErrorResponse {
  status: 'error';
  error: {
    code: string;
    message: string;
    status: number;
    timestamp: string;
    requestId?: string;
    details?: Record<string, any>;
    hint?: string;
  };
}

/**
 * Request with error context
 */
export interface ErrorRequest extends Request {
  requestId?: string;
  userId?: string;
  correlationId?: string;
}

/**
 * Determine HTTP status code from error
 */
const getStatusCode = (error: any): number => {
  if (error instanceof APIError) {
    return error.status;
  }

  // Handle specific error types
  if (error.name === 'ValidationError') return 400;
  if (error.name === 'NotFoundError') return 404;
  if (error.name === 'CastError') return 400; // MongoDB CastError
  if (error.name === 'MongoValidationError') return 400;
  if (error.statusCode) return error.statusCode;
  if (error.status) return error.status;

  return 500;
};

/**
 * Determine error code from error
 */
const getErrorCode = (error: any): string => {
  if (error instanceof APIError) {
    return error.code;
  }

  if (error.code) return error.code;
  if (error.name) return error.name.toUpperCase().replace(/ERROR$/i, '').replace(/([A-Z])/g, '_$1').substring(1);

  return 'INTERNAL_SERVER_ERROR';
};

/**
 * Sanitize error message (hide sensitive info)
 */
const sanitizeMessage = (message: string | undefined, isDevelopment: boolean): string => {
  if (!message) return 'An error occurred';

  // In production, hide implementation details
  if (!isDevelopment && message.includes('SQL')) {
    return 'Database error occurred';
  }

  // Remove file paths and stack traces from public errors
  const sanitized = message
    .replace(/\/[a-zA-Z0-9_\-\.\/]+\.js:\d+:\d+/g, '[file]')
    .replace(/\\/g, '/');

  return sanitized;
};

/**
 * Generate helpful error hint based on error code
 */
const getHint = (code: string, status: number): string | undefined => {
  const hints: Record<string, string> = {
    VALIDATION_ERROR: 'Check the request body and required fields',
    NOT_FOUND: 'The requested resource does not exist',
    AUTHENTICATION_ERROR: 'Provide valid credentials via Authorization header',
    AUTHORIZATION_ERROR: 'Your credentials do not have permission for this action',
    RATE_LIMIT_EXCEEDED: 'Wait before making additional requests',
    INTERNAL_SERVER_ERROR: 'Contact support if the issue persists',
    BAD_REQUEST: 'Review the request format and parameters',
    UNSUPPORTED_VERSION: 'Use a supported API version',
  };

  return hints[code];
};

/**
 * Format error response
 */
const formatErrorResponse = (
  error: any,
  requestId?: string,
  isDevelopment: boolean = false
): ErrorResponse => {
  const status = getStatusCode(error);
  const code = getErrorCode(error);
  const message = sanitizeMessage(error.message, isDevelopment);
  const hint = getHint(code, status);

  return {
    status: 'error',
    error: {
      code,
      message,
      status,
      timestamp: new Date().toISOString(),
      ...(requestId && { requestId }),
      ...(isDevelopment && error.details && { details: error.details }),
      ...(isDevelopment && error.stack && { stack: error.stack }),
      ...(hint && { hint }),
    },
  };
};

/**
 * Log error with context
 */
const logError = (error: any, req: ErrorRequest, statusCode: number) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const logLevel = statusCode >= 500 ? 'error' : 'warn';

  const logContext = {
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    correlationId: req.correlationId,
    userId: req.userId,
    method: req.method,
    path: req.path,
    status: statusCode,
    error: {
      name: error.name,
      code: error.code,
      message: error.message,
      ...(isDevelopment && error.stack && { stack: error.stack }),
    },
  };

  if (logLevel === 'error') {
    console.error('[API Error]', JSON.stringify(logContext));
  } else {
    console.warn('[API Warning]', JSON.stringify(logContext));
  }
};

/**
 * Main error handler middleware
 * Must be registered last in middleware chain
 */
export const v2ErrorHandler = (isDevelopment: boolean = process.env.NODE_ENV !== 'production') => {
  return (error: any, req: ErrorRequest, res: Response, next: NextFunction) => {
    // Ensure response not already sent
    if (res.headersSent) {
      return next(error);
    }

    const requestId = req.requestId || `err-${Date.now()}`;
    const statusCode = getStatusCode(error);

    // Log the error
    logError(error, req, statusCode);

    // Format and send error response
    const errorResponse = formatErrorResponse(error, requestId, isDevelopment);

    // Set appropriate headers
    res.set('X-Request-ID', requestId);
    res.set('Content-Type', 'application/json; charset=utf-8');

    // Rate limit headers if applicable
    if (error instanceof RateLimitError && error.retryAfter) {
      res.set('Retry-After', String(error.retryAfter));
      res.set('X-RateLimit-Retry-After', String(error.retryAfter));
    }

    // Cache control for error responses
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    res.status(statusCode).json(errorResponse);
  };
};

/**
 * Async error wrapper middleware
 * Wraps async route handlers to catch promise rejections
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Error boundary middleware for specific routes
 * Catches errors in sub-routers
 */
export const errorBoundary = (router: any) => {
  return (error: any, req: ErrorRequest, res: Response, next: NextFunction) => {
    // Only handle errors from this router
    error._handled = true;
    next(error);
  };
};

/**
 * Validation error handler
 * Formats validation errors from schema validators like Zod
 */
export const handleValidationError = (validationError: any): ValidationError => {
  let details: Record<string, any> = {};
  let message = 'Validation failed';

  // Handle Zod validation errors
  if (validationError.errors && Array.isArray(validationError.errors)) {
    details.fields = validationError.errors.map((error: any) => ({
      path: error.path.join('.'),
      message: error.message,
      code: error.code,
    }));
    message = `Validation failed: ${validationError.errors.length} field(s)`;
  }
  // Handle JOI validation errors
  else if (validationError.details && Array.isArray(validationError.details)) {
    details.fields = validationError.details.map((detail: any) => ({
      path: detail.path,
      message: detail.message,
      type: detail.type,
    }));
    message = `Validation failed: ${validationError.details.length} field(s)`;
  }

  return new ValidationError(message, details);
};

/**
 * Not found handler middleware
 * Should be registered after all routes
 */
export const notFoundHandler = (req: ErrorRequest, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Endpoint not found: ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    suggestion: 'Check the API documentation for available endpoints',
  });

  next(error);
};

export default v2ErrorHandler;

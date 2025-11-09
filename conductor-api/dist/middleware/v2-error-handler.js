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
/**
 * Custom error types for API
 */
export class APIError extends Error {
    constructor(code, status = 500, message = 'Internal Server Error', details) {
        super(message);
        this.code = code;
        this.status = status;
        this.details = details;
        this.name = 'APIError';
        Object.setPrototypeOf(this, APIError.prototype);
    }
}
export class ValidationError extends APIError {
    constructor(message = 'Validation failed', details) {
        super('VALIDATION_ERROR', 400, message, details);
        this.name = 'ValidationError';
    }
}
export class NotFoundError extends APIError {
    constructor(message = 'Resource not found', details) {
        super('NOT_FOUND', 404, message, details);
        this.name = 'NotFoundError';
    }
}
export class AuthenticationError extends APIError {
    constructor(message = 'Authentication required', details) {
        super('AUTHENTICATION_ERROR', 401, message, details);
        this.name = 'AuthenticationError';
    }
}
export class AuthorizationError extends APIError {
    constructor(message = 'Insufficient permissions', details) {
        super('AUTHORIZATION_ERROR', 403, message, details);
        this.name = 'AuthorizationError';
    }
}
export class ConflictError extends APIError {
    constructor(message = 'Resource conflict', details) {
        super('CONFLICT_ERROR', 409, message, details);
        this.name = 'ConflictError';
    }
}
export class RateLimitError extends APIError {
    constructor(message = 'Rate limit exceeded', retryAfter, details) {
        super('RATE_LIMIT_EXCEEDED', 429, message, details);
        this.retryAfter = retryAfter;
        this.name = 'RateLimitError';
    }
}
export class ServerError extends APIError {
    constructor(message = 'Internal server error', details) {
        super('INTERNAL_SERVER_ERROR', 500, message, details);
        this.name = 'ServerError';
    }
}
/**
 * Determine HTTP status code from error
 */
const getStatusCode = (error) => {
    if (error instanceof APIError) {
        return error.status;
    }
    // Handle specific error types
    if (error.name === 'ValidationError')
        return 400;
    if (error.name === 'NotFoundError')
        return 404;
    if (error.name === 'CastError')
        return 400; // MongoDB CastError
    if (error.name === 'MongoValidationError')
        return 400;
    if (error.statusCode)
        return error.statusCode;
    if (error.status)
        return error.status;
    return 500;
};
/**
 * Determine error code from error
 */
const getErrorCode = (error) => {
    if (error instanceof APIError) {
        return error.code;
    }
    if (error.code)
        return error.code;
    if (error.name)
        return error.name.toUpperCase().replace(/ERROR$/i, '').replace(/([A-Z])/g, '_$1').substring(1);
    return 'INTERNAL_SERVER_ERROR';
};
/**
 * Sanitize error message (hide sensitive info)
 */
const sanitizeMessage = (message, isDevelopment) => {
    if (!message)
        return 'An error occurred';
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
const getHint = (code, status) => {
    const hints = {
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
const formatErrorResponse = (error, requestId, isDevelopment = false) => {
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
const logError = (error, req, statusCode) => {
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
    }
    else {
        console.warn('[API Warning]', JSON.stringify(logContext));
    }
};
/**
 * Main error handler middleware
 * Must be registered last in middleware chain
 */
export const v2ErrorHandler = (isDevelopment = process.env.NODE_ENV !== 'production') => {
    return (error, req, res, next) => {
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
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
/**
 * Error boundary middleware for specific routes
 * Catches errors in sub-routers
 */
export const errorBoundary = (router) => {
    return (error, req, res, next) => {
        // Only handle errors from this router
        error._handled = true;
        next(error);
    };
};
/**
 * Validation error handler
 * Formats validation errors from schema validators like Zod
 */
export const handleValidationError = (validationError) => {
    let details = {};
    let message = 'Validation failed';
    // Handle Zod validation errors
    if (validationError.errors && Array.isArray(validationError.errors)) {
        details.fields = validationError.errors.map((error) => ({
            path: error.path.join('.'),
            message: error.message,
            code: error.code,
        }));
        message = `Validation failed: ${validationError.errors.length} field(s)`;
    }
    // Handle JOI validation errors
    else if (validationError.details && Array.isArray(validationError.details)) {
        details.fields = validationError.details.map((detail) => ({
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
export const notFoundHandler = (req, res, next) => {
    const error = new NotFoundError(`Endpoint not found: ${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        suggestion: 'Check the API documentation for available endpoints',
    });
    next(error);
};
export default v2ErrorHandler;
//# sourceMappingURL=v2-error-handler.js.map
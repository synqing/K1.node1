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
export declare class APIError extends Error {
    code: string;
    status: number;
    details?: Record<string, any> | undefined;
    constructor(code: string, status?: number, message?: string, details?: Record<string, any> | undefined);
}
export declare class ValidationError extends APIError {
    constructor(message?: string, details?: Record<string, any>);
}
export declare class NotFoundError extends APIError {
    constructor(message?: string, details?: Record<string, any>);
}
export declare class AuthenticationError extends APIError {
    constructor(message?: string, details?: Record<string, any>);
}
export declare class AuthorizationError extends APIError {
    constructor(message?: string, details?: Record<string, any>);
}
export declare class ConflictError extends APIError {
    constructor(message?: string, details?: Record<string, any>);
}
export declare class RateLimitError extends APIError {
    retryAfter?: number | undefined;
    constructor(message?: string, retryAfter?: number | undefined, details?: Record<string, any>);
}
export declare class ServerError extends APIError {
    constructor(message?: string, details?: Record<string, any>);
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
 * Main error handler middleware
 * Must be registered last in middleware chain
 */
export declare const v2ErrorHandler: (isDevelopment?: boolean) => (error: any, req: ErrorRequest, res: Response, next: NextFunction) => void;
/**
 * Async error wrapper middleware
 * Wraps async route handlers to catch promise rejections
 */
export declare const asyncHandler: (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => void;
/**
 * Error boundary middleware for specific routes
 * Catches errors in sub-routers
 */
export declare const errorBoundary: (router: any) => (error: any, req: ErrorRequest, res: Response, next: NextFunction) => void;
/**
 * Validation error handler
 * Formats validation errors from schema validators like Zod
 */
export declare const handleValidationError: (validationError: any) => ValidationError;
/**
 * Not found handler middleware
 * Should be registered after all routes
 */
export declare const notFoundHandler: (req: ErrorRequest, res: Response, next: NextFunction) => void;
export default v2ErrorHandler;
//# sourceMappingURL=v2-error-handler.d.ts.map
/**
 * Error Recovery Endpoints (v2)
 * Implements error recovery, retry management, circuit breaker control, and DLQ operations
 */
import type { Request, Response, NextFunction } from 'express';
import { RetryEngine, type RetryDatabase } from '../../services/retry-engine.js';
import { CircuitBreaker, type CircuitBreakerStorage } from '../../services/circuit-breaker.js';
import { DeadLetterQueue, type DLQStorage } from '../../services/dlq.js';
/**
 * Error Recovery Controller
 * Handles all error recovery related HTTP endpoints
 */
export declare class ErrorRecoveryController {
    private retryEngine;
    private circuitBreaker;
    private dlq;
    constructor(retryDb: RetryDatabase, circuitBreakerStorage: CircuitBreakerStorage, dlqStorage: DLQStorage, circuitBreakerConfig: {
        failureThreshold: number;
        successThreshold: number;
        timeoutMs: number;
        monitoringWindowMs: number;
    });
    /**
     * POST /v2/errors/retry
     * Create a retry attempt for a failed task
     */
    createRetry(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /v2/errors/retry/:id
     * Get retry details and history
     */
    getRetry(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /v2/errors/resolve
     * Mark an error as resolved
     */
    resolveError(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /v2/errors/stats
     * Get error recovery statistics
     */
    getStats(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /v2/errors/circuit-breaker/:service
     * Update circuit breaker state
     */
    updateCircuitBreaker(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Validate retry policy structure
     */
    private isValidRetryPolicy;
}
/**
 * Create error recovery router
 */
export declare function createErrorRecoveryRouter(retryDb: RetryDatabase, circuitBreakerStorage: CircuitBreakerStorage, dlqStorage: DLQStorage, circuitBreakerConfig: {
    failureThreshold: number;
    successThreshold: number;
    timeoutMs: number;
    monitoringWindowMs: number;
}): {
    'POST /v2/errors/retry': (req: Request, res: Response, next: NextFunction) => Promise<void>;
    'GET /v2/errors/retry/:id': (req: Request, res: Response, next: NextFunction) => Promise<void>;
    'POST /v2/errors/resolve': (req: Request, res: Response, next: NextFunction) => Promise<void>;
    'GET /v2/errors/stats': (req: Request, res: Response, next: NextFunction) => Promise<void>;
    'POST /v2/errors/circuit-breaker/:service': (req: Request, res: Response, next: NextFunction) => Promise<void>;
};
export { CircuitBreaker, DeadLetterQueue, RetryEngine };
export type { RetryDatabase, CircuitBreakerStorage, DLQStorage };
//# sourceMappingURL=error-recovery.d.ts.map
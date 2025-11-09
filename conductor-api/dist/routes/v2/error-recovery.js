/**
 * Error Recovery Endpoints (v2)
 * Implements error recovery, retry management, circuit breaker control, and DLQ operations
 */
import { RetryEngine } from '../../services/retry-engine.js';
import { CircuitBreaker } from '../../services/circuit-breaker.js';
import { DeadLetterQueue } from '../../services/dlq.js';
/**
 * Error Recovery Controller
 * Handles all error recovery related HTTP endpoints
 */
export class ErrorRecoveryController {
    constructor(retryDb, circuitBreakerStorage, dlqStorage, circuitBreakerConfig) {
        this.retryEngine = new RetryEngine(retryDb);
        this.circuitBreaker = new CircuitBreaker(circuitBreakerStorage, circuitBreakerConfig);
        this.dlq = new DeadLetterQueue(dlqStorage);
    }
    /**
     * POST /v2/errors/retry
     * Create a retry attempt for a failed task
     */
    async createRetry(req, res, next) {
        try {
            const { taskId, retryPolicy, attemptNumber = 0, errorMessage = 'Unknown error' } = req.body;
            // Validate required fields
            if (!taskId) {
                res.status(400).json({
                    success: false,
                    error: 'taskId is required',
                    code: 'INVALID_REQUEST',
                    timestamp: new Date(),
                });
                return;
            }
            if (!retryPolicy) {
                res.status(400).json({
                    success: false,
                    error: 'retryPolicy is required',
                    code: 'INVALID_REQUEST',
                    timestamp: new Date(),
                });
                return;
            }
            // Validate retry policy
            if (!this.isValidRetryPolicy(retryPolicy)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid retry policy configuration',
                    code: 'INVALID_POLICY',
                    timestamp: new Date(),
                });
                return;
            }
            // Check if we can retry
            if (!this.retryEngine.canRetry(attemptNumber, retryPolicy)) {
                res.status(409).json({
                    success: false,
                    error: 'Maximum retry attempts exceeded',
                    code: 'MAX_RETRIES_EXCEEDED',
                    timestamp: new Date(),
                });
                return;
            }
            // Check if error is retryable
            if (!this.retryEngine.isRetryableError(errorMessage, retryPolicy)) {
                res.status(400).json({
                    success: false,
                    error: 'Error is not retryable based on policy',
                    code: 'NON_RETRYABLE_ERROR',
                    timestamp: new Date(),
                });
                return;
            }
            // Create retry attempt
            const retryAttempt = await this.retryEngine.createRetryAttempt(taskId, attemptNumber, errorMessage, retryPolicy);
            res.status(201).json({
                success: true,
                data: retryAttempt,
                timestamp: new Date(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /v2/errors/retry/:id
     * Get retry details and history
     */
    async getRetry(req, res, next) {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({
                    success: false,
                    error: 'Retry ID is required',
                    code: 'INVALID_REQUEST',
                    timestamp: new Date(),
                });
                return;
            }
            // In a real implementation, this would fetch from database
            // For now, we'll return a structured response
            res.status(200).json({
                success: true,
                data: {
                    id,
                    message: 'Retry details would be fetched from database',
                    status: 'pending',
                    createdAt: new Date(),
                },
                timestamp: new Date(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /v2/errors/resolve
     * Mark an error as resolved
     */
    async resolveError(req, res, next) {
        try {
            const { taskId, reason } = req.body;
            if (!taskId) {
                res.status(400).json({
                    success: false,
                    error: 'taskId is required',
                    code: 'INVALID_REQUEST',
                    timestamp: new Date(),
                });
                return;
            }
            if (!reason) {
                res.status(400).json({
                    success: false,
                    error: 'reason is required',
                    code: 'INVALID_REQUEST',
                    timestamp: new Date(),
                });
                return;
            }
            // Resolve entries in DLQ for this task
            const entries = await this.dlq.getEntriesByTaskId(taskId);
            for (const entry of entries) {
                if (!entry.resolvedAt) {
                    await this.dlq.resolveEntry(entry.id, reason);
                }
            }
            res.status(200).json({
                success: true,
                data: {
                    taskId,
                    resolvedCount: entries.filter((e) => !e.resolvedAt).length,
                    reason,
                    timestamp: new Date(),
                },
                timestamp: new Date(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /v2/errors/stats
     * Get error recovery statistics
     */
    async getStats(req, res, next) {
        try {
            // Get DLQ stats
            const dlqStats = await this.dlq.getStats();
            // Get circuit breaker states
            const cbStates = await this.circuitBreaker.getAllStates();
            // Calculate active retries count (would be from database in real implementation)
            const pendingRetries = 0; // Placeholder
            res.status(200).json({
                success: true,
                data: {
                    activeRetries: pendingRetries,
                    dlqStats: {
                        totalEntries: dlqStats.totalEntries,
                        unresolvedEntries: dlqStats.unresolvedEntries,
                        resolvedEntries: dlqStats.resolvedEntries,
                        oldestEntryAgeMs: dlqStats.oldestEntryAge,
                        averageRetryCount: dlqStats.averageRetryCount,
                    },
                    circuitBreakers: {
                        total: cbStates.length,
                        open: cbStates.filter((s) => s.state === 'open').length,
                        halfOpen: cbStates.filter((s) => s.state === 'half_open').length,
                        closed: cbStates.filter((s) => s.state === 'closed').length,
                        states: cbStates.map((s) => ({
                            serviceName: s.serviceName,
                            state: s.state,
                            failureCount: s.failureCount,
                            lastFailureAt: s.lastFailureAt,
                        })),
                    },
                },
                timestamp: new Date(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /v2/errors/circuit-breaker/:service
     * Update circuit breaker state
     */
    async updateCircuitBreaker(req, res, next) {
        try {
            const { service } = req.params;
            const { action } = req.body;
            if (!service) {
                res.status(400).json({
                    success: false,
                    error: 'Service name is required',
                    code: 'INVALID_REQUEST',
                    timestamp: new Date(),
                });
                return;
            }
            if (!action || !['reset', 'open', 'close'].includes(action)) {
                res.status(400).json({
                    success: false,
                    error: 'Action must be one of: reset, open, close',
                    code: 'INVALID_ACTION',
                    timestamp: new Date(),
                });
                return;
            }
            let result = null;
            switch (action) {
                case 'reset':
                    await this.circuitBreaker.reset(service);
                    result = await this.circuitBreaker.getState(service);
                    break;
                case 'open':
                    await this.circuitBreaker.open(service);
                    result = await this.circuitBreaker.getState(service);
                    break;
                case 'close':
                    await this.circuitBreaker.close(service);
                    result = await this.circuitBreaker.getState(service);
                    break;
            }
            res.status(200).json({
                success: true,
                data: {
                    serviceName: service,
                    action,
                    state: result,
                    timestamp: new Date(),
                },
                timestamp: new Date(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Validate retry policy structure
     */
    isValidRetryPolicy(policy) {
        if (typeof policy.maxRetries !== 'number' || policy.maxRetries < 0) {
            return false;
        }
        if (typeof policy.initialDelayMs !== 'number' || policy.initialDelayMs < 0) {
            return false;
        }
        if (typeof policy.maxDelayMs !== 'number' || policy.maxDelayMs < 0) {
            return false;
        }
        if (!['exponential', 'linear', 'fixed'].includes(policy.strategy)) {
            return false;
        }
        return true;
    }
}
/**
 * Create error recovery router
 */
export function createErrorRecoveryRouter(retryDb, circuitBreakerStorage, dlqStorage, circuitBreakerConfig) {
    const controller = new ErrorRecoveryController(retryDb, circuitBreakerStorage, dlqStorage, circuitBreakerConfig);
    return {
        // POST /v2/errors/retry - Create retry attempt
        'POST /v2/errors/retry': (req, res, next) => controller.createRetry(req, res, next),
        // GET /v2/errors/retry/:id - Get retry details
        'GET /v2/errors/retry/:id': (req, res, next) => controller.getRetry(req, res, next),
        // POST /v2/errors/resolve - Mark error resolved
        'POST /v2/errors/resolve': (req, res, next) => controller.resolveError(req, res, next),
        // GET /v2/errors/stats - Get statistics
        'GET /v2/errors/stats': (req, res, next) => controller.getStats(req, res, next),
        // POST /v2/errors/circuit-breaker/:service - Update circuit breaker
        'POST /v2/errors/circuit-breaker/:service': (req, res, next) => controller.updateCircuitBreaker(req, res, next),
    };
}
// Export service classes and types for standalone usage
export { CircuitBreaker, DeadLetterQueue, RetryEngine };
//# sourceMappingURL=error-recovery.js.map
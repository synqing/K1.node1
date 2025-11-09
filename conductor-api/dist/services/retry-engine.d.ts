/**
 * Retry Engine Service
 * Implements exponential, linear, and fixed backoff strategies with jitter
 * and database tracking of retry attempts
 */
import { RetryPolicy, RetryAttempt } from '../types/retry-policy.types.js';
/**
 * Interface for database operations (abstraction)
 * In production, this would interface with actual DB
 */
export interface RetryDatabase {
    saveAttempt(attempt: RetryAttempt): Promise<RetryAttempt>;
    getAttempt(id: string): Promise<RetryAttempt | null>;
    listPendingRetries(limit: number): Promise<RetryAttempt[]>;
    updateAttemptStatus(id: string, status: 'pending' | 'success' | 'failed'): Promise<void>;
    getDueRetries(now: Date): Promise<RetryAttempt[]>;
}
/**
 * Configuration for retry calculation
 */
export interface RetryCalculationResult {
    nextRetryAt: Date;
    delayMs: number;
    jitteredDelayMs: number;
    attempt: number;
}
/**
 * Retry Engine Service
 * Handles calculation and tracking of retry attempts
 */
export declare class RetryEngine {
    private db;
    constructor(database: RetryDatabase);
    /**
     * Calculate exponential backoff delay
     * Formula: min(2^attempt * baseDelay, maxDelayMs)
     * @param attempt - attempt number (0-indexed)
     * @param baseDelayMs - initial delay in milliseconds
     * @param maxDelayMs - maximum delay cap
     * @returns delay in milliseconds
     */
    calculateExponentialBackoff(attempt: number, baseDelayMs: number, maxDelayMs: number): number;
    /**
     * Calculate linear backoff delay
     * Formula: min(baseDelay * (attempt + 1), maxDelayMs)
     * @param attempt - attempt number (0-indexed)
     * @param baseDelayMs - initial delay in milliseconds
     * @param maxDelayMs - maximum delay cap
     * @returns delay in milliseconds
     */
    calculateLinearBackoff(attempt: number, baseDelayMs: number, maxDelayMs: number): number;
    /**
     * Calculate fixed backoff delay
     * Formula: fixed baseDelayMs (capped at maxDelayMs)
     * @param baseDelayMs - delay in milliseconds
     * @param maxDelayMs - maximum delay cap
     * @returns delay in milliseconds
     */
    calculateFixedBackoff(baseDelayMs: number, maxDelayMs: number): number;
    /**
     * Apply jitter to prevent thundering herd
     * Uses ±10% random variance on the delay
     * @param delayMs - base delay in milliseconds
     * @param jitterFactor - jitter factor (0.1 for ±10%)
     * @returns jittered delay in milliseconds
     */
    applyJitter(delayMs: number, jitterFactor?: number): number;
    /**
     * Calculate the next retry time based on strategy
     * @param attempt - current attempt number (0-indexed)
     * @param policy - retry policy configuration
     * @param baseTime - base time to calculate from (usually now)
     * @returns retry calculation result
     */
    calculateNextRetry(attempt: number, policy: RetryPolicy, baseTime?: Date): RetryCalculationResult;
    /**
     * Create and save a new retry attempt
     * @param taskId - ID of the task being retried
     * @param attemptNumber - current attempt number
     * @param errorMessage - error message from the failed attempt
     * @param policy - retry policy configuration
     * @returns the created retry attempt
     */
    createRetryAttempt(taskId: string, attemptNumber: number, errorMessage: string, policy: RetryPolicy): Promise<RetryAttempt>;
    /**
     * Get all pending retries that are due for execution
     * @returns array of due retry attempts
     */
    getDueRetries(): Promise<RetryAttempt[]>;
    /**
     * Mark a retry attempt as successful
     * @param attemptId - ID of the attempt to mark as success
     */
    markSuccess(attemptId: string): Promise<void>;
    /**
     * Mark a retry attempt as failed
     * @param attemptId - ID of the attempt to mark as failed
     */
    markFailed(attemptId: string): Promise<void>;
    /**
     * Check if a task should be retried based on max retries limit
     * @param attemptNumber - current attempt number
     * @param policy - retry policy configuration
     * @returns true if retry should be attempted, false if max retries exceeded
     */
    canRetry(attemptNumber: number, policy: RetryPolicy): boolean;
    /**
     * Determine if an error is retryable
     * @param errorMessage - error message to evaluate
     * @param policy - retry policy configuration
     * @returns true if error is retryable, false otherwise
     */
    isRetryableError(errorMessage: string, policy: RetryPolicy): boolean;
}
//# sourceMappingURL=retry-engine.d.ts.map
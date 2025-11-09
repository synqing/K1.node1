/**
 * Retry Engine Service
 * Implements exponential, linear, and fixed backoff strategies with jitter
 * and database tracking of retry attempts
 */
/**
 * Retry Engine Service
 * Handles calculation and tracking of retry attempts
 */
export class RetryEngine {
    constructor(database) {
        this.db = database;
    }
    /**
     * Calculate exponential backoff delay
     * Formula: min(2^attempt * baseDelay, maxDelayMs)
     * @param attempt - attempt number (0-indexed)
     * @param baseDelayMs - initial delay in milliseconds
     * @param maxDelayMs - maximum delay cap
     * @returns delay in milliseconds
     */
    calculateExponentialBackoff(attempt, baseDelayMs, maxDelayMs) {
        const exponentialDelay = Math.pow(2, attempt) * baseDelayMs;
        return Math.min(exponentialDelay, maxDelayMs);
    }
    /**
     * Calculate linear backoff delay
     * Formula: min(baseDelay * (attempt + 1), maxDelayMs)
     * @param attempt - attempt number (0-indexed)
     * @param baseDelayMs - initial delay in milliseconds
     * @param maxDelayMs - maximum delay cap
     * @returns delay in milliseconds
     */
    calculateLinearBackoff(attempt, baseDelayMs, maxDelayMs) {
        const linearDelay = baseDelayMs * (attempt + 1);
        return Math.min(linearDelay, maxDelayMs);
    }
    /**
     * Calculate fixed backoff delay
     * Formula: fixed baseDelayMs (capped at maxDelayMs)
     * @param baseDelayMs - delay in milliseconds
     * @param maxDelayMs - maximum delay cap
     * @returns delay in milliseconds
     */
    calculateFixedBackoff(baseDelayMs, maxDelayMs) {
        return Math.min(baseDelayMs, maxDelayMs);
    }
    /**
     * Apply jitter to prevent thundering herd
     * Uses ±10% random variance on the delay
     * @param delayMs - base delay in milliseconds
     * @param jitterFactor - jitter factor (0.1 for ±10%)
     * @returns jittered delay in milliseconds
     */
    applyJitter(delayMs, jitterFactor = 0.1) {
        const jitterRange = delayMs * jitterFactor;
        const randomVariance = Math.random() * (2 * jitterRange) - jitterRange;
        return Math.max(0, delayMs + randomVariance);
    }
    /**
     * Calculate the next retry time based on strategy
     * @param attempt - current attempt number (0-indexed)
     * @param policy - retry policy configuration
     * @param baseTime - base time to calculate from (usually now)
     * @returns retry calculation result
     */
    calculateNextRetry(attempt, policy, baseTime = new Date()) {
        let delayMs;
        switch (policy.strategy) {
            case 'exponential':
                delayMs = this.calculateExponentialBackoff(attempt, policy.initialDelayMs, policy.maxDelayMs);
                break;
            case 'linear':
                delayMs = this.calculateLinearBackoff(attempt, policy.initialDelayMs, policy.maxDelayMs);
                break;
            case 'fixed':
                delayMs = this.calculateFixedBackoff(policy.initialDelayMs, policy.maxDelayMs);
                break;
            default:
                throw new Error(`Unknown retry strategy: ${policy.strategy}`);
        }
        const jitteredDelayMs = this.applyJitter(delayMs);
        const nextRetryAt = new Date(baseTime.getTime() + jitteredDelayMs);
        return {
            nextRetryAt,
            delayMs,
            jitteredDelayMs,
            attempt: attempt + 1,
        };
    }
    /**
     * Create and save a new retry attempt
     * @param taskId - ID of the task being retried
     * @param attemptNumber - current attempt number
     * @param errorMessage - error message from the failed attempt
     * @param policy - retry policy configuration
     * @returns the created retry attempt
     */
    async createRetryAttempt(taskId, attemptNumber, errorMessage, policy) {
        const calculation = this.calculateNextRetry(attemptNumber, policy);
        const attempt = {
            id: `retry_${taskId}_${attemptNumber}_${Date.now()}`,
            taskId,
            attemptNumber: calculation.attempt,
            errorMessage,
            retryAt: calculation.nextRetryAt,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        return this.db.saveAttempt(attempt);
    }
    /**
     * Get all pending retries that are due for execution
     * @returns array of due retry attempts
     */
    async getDueRetries() {
        return this.db.getDueRetries(new Date());
    }
    /**
     * Mark a retry attempt as successful
     * @param attemptId - ID of the attempt to mark as success
     */
    async markSuccess(attemptId) {
        return this.db.updateAttemptStatus(attemptId, 'success');
    }
    /**
     * Mark a retry attempt as failed
     * @param attemptId - ID of the attempt to mark as failed
     */
    async markFailed(attemptId) {
        return this.db.updateAttemptStatus(attemptId, 'failed');
    }
    /**
     * Check if a task should be retried based on max retries limit
     * @param attemptNumber - current attempt number
     * @param policy - retry policy configuration
     * @returns true if retry should be attempted, false if max retries exceeded
     */
    canRetry(attemptNumber, policy) {
        return attemptNumber < policy.maxRetries;
    }
    /**
     * Determine if an error is retryable
     * @param errorMessage - error message to evaluate
     * @param policy - retry policy configuration
     * @returns true if error is retryable, false otherwise
     */
    isRetryableError(errorMessage, policy) {
        // If nonRetryableErrors is specified, check if error matches any
        if (policy.nonRetryableErrors && policy.nonRetryableErrors.length > 0) {
            return !policy.nonRetryableErrors.some((pattern) => errorMessage.includes(pattern));
        }
        // If retryableErrors is specified, check if error matches any
        if (policy.retryableErrors && policy.retryableErrors.length > 0) {
            return policy.retryableErrors.some((pattern) => errorMessage.includes(pattern));
        }
        // Default: all errors are retryable
        return true;
    }
}
//# sourceMappingURL=retry-engine.js.map
/**
 * Retry Policy Types
 * Defines types for retry configuration and tracking retry attempts
 */
export type RetryStrategy = 'exponential' | 'linear' | 'fixed';
export interface RetryPolicy {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    strategy: RetryStrategy;
    backoffMultiplier?: number;
    retryableErrors?: string[];
    nonRetryableErrors?: string[];
}
export interface RetryAttempt {
    id: string;
    taskId: string;
    attemptNumber: number;
    errorMessage: string;
    retryAt: Date;
    status: 'pending' | 'success' | 'failed';
    createdAt: Date;
    updatedAt: Date;
}
export interface RetryConfiguration {
    taskId: string;
    policy: RetryPolicy;
    currentAttempt: number;
    nextRetryAt: Date | null;
    lastError: string | null;
}
//# sourceMappingURL=retry-policy.types.d.ts.map
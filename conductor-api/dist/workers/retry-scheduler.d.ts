/**
 * Retry Scheduler Worker
 * Background worker that polls database for pending retries and executes them
 * Runs on a 30-second interval
 */
import { RetryDatabase } from '../services/retry-engine';
import { RetryPolicy } from '../types/retry-policy.types';
/**
 * Interface for task execution
 * In production, this would execute the actual task
 */
export interface TaskExecutor {
    execute(taskId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
}
/**
 * Retry Scheduler Configuration
 */
export interface RetrySchedulerConfig {
    pollIntervalMs?: number;
    batchSize?: number;
    maxConcurrentRetries?: number;
    taskRetryPolicies: Map<string, RetryPolicy>;
}
/**
 * Retry Scheduler Worker
 * Handles polling, scheduling, and execution of retries
 */
export declare class RetryScheduler {
    private retryEngine;
    private taskExecutor;
    private config;
    private intervalId;
    private isRunning;
    private activeRetries;
    constructor(database: RetryDatabase, taskExecutor: TaskExecutor, config?: Partial<RetrySchedulerConfig>);
    /**
     * Start the retry scheduler
     * Begins polling database on configured interval
     */
    start(): void;
    /**
     * Stop the retry scheduler
     * Clears the polling interval
     */
    stop(): void;
    /**
     * Poll database for due retries and execute them
     * Uses concurrency control to avoid overwhelming the system
     */
    private poll;
    /**
     * Process a batch of retry attempts
     * @param batch - array of retry attempts to process
     */
    private processBatch;
    /**
     * Execute a single retry attempt
     * @param attempt - the retry attempt to execute
     */
    private executeRetry;
    /**
     * Get the current number of active retries
     * @returns number of active retries
     */
    getActiveRetryCount(): number;
    /**
     * Check if the scheduler is running
     * @returns true if running, false otherwise
     */
    getIsRunning(): boolean;
    /**
     * Register a task retry policy
     * @param taskId - ID of the task
     * @param policy - retry policy for the task
     */
    registerTaskPolicy(taskId: string, policy: RetryPolicy): void;
    /**
     * Unregister a task retry policy
     * @param taskId - ID of the task
     */
    unregisterTaskPolicy(taskId: string): void;
}
//# sourceMappingURL=retry-scheduler.d.ts.map
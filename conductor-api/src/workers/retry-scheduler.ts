/**
 * Retry Scheduler Worker
 * Background worker that polls database for pending retries and executes them
 * Runs on a 30-second interval
 */

import { RetryEngine, RetryDatabase } from '../services/retry-engine.js';
import { RetryAttempt, RetryPolicy } from '../types/retry-policy.types.js';

/**
 * Interface for task execution
 * In production, this would execute the actual task
 */
export interface TaskExecutor {
  execute(taskId: string): Promise<{ success: boolean; error?: string }>;
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
export class RetryScheduler {
  private retryEngine: RetryEngine;
  private taskExecutor: TaskExecutor;
  private config: RetrySchedulerConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private activeRetries = 0;

  constructor(
    database: RetryDatabase,
    taskExecutor: TaskExecutor,
    config: Partial<RetrySchedulerConfig> = {}
  ) {
    this.retryEngine = new RetryEngine(database);
    this.taskExecutor = taskExecutor;
    this.config = {
      pollIntervalMs: 30000, // 30 seconds
      batchSize: 100,
      maxConcurrentRetries: 10,
      taskRetryPolicies: config.taskRetryPolicies || new Map(),
      ...config,
    };
  }

  /**
   * Start the retry scheduler
   * Begins polling database on configured interval
   */
  start(): void {
    if (this.isRunning) {
      console.warn('Retry scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log(
      `Starting retry scheduler with ${this.config.pollIntervalMs}ms poll interval`
    );

    // Execute immediately, then on interval
    this.poll();
    this.intervalId = setInterval(() => {
      this.poll();
    }, this.config.pollIntervalMs);
  }

  /**
   * Stop the retry scheduler
   * Clears the polling interval
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn('Retry scheduler is not running');
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('Retry scheduler stopped');
  }

  /**
   * Poll database for due retries and execute them
   * Uses concurrency control to avoid overwhelming the system
   */
  private async poll(): Promise<void> {
    if (this.activeRetries >= this.config.maxConcurrentRetries!) {
      console.debug('Max concurrent retries reached, skipping poll');
      return;
    }

    try {
      const dueRetries = await this.retryEngine.getDueRetries();

      if (dueRetries.length === 0) {
        console.debug('No due retries found');
        return;
      }

      console.log(`Found ${dueRetries.length} due retries`);

      // Process retries in batches with concurrency control
      const batchSize = Math.min(
        this.config.batchSize!,
        this.config.maxConcurrentRetries! - this.activeRetries
      );

      for (let i = 0; i < dueRetries.length; i += batchSize) {
        const batch = dueRetries.slice(
          i,
          Math.min(i + batchSize, dueRetries.length)
        );
        await this.processBatch(batch);
      }
    } catch (error) {
      console.error('Error during retry poll:', error);
    }
  }

  /**
   * Process a batch of retry attempts
   * @param batch - array of retry attempts to process
   */
  private async processBatch(batch: RetryAttempt[]): Promise<void> {
    const promises = batch.map((attempt) => this.executeRetry(attempt));
    await Promise.allSettled(promises);
  }

  /**
   * Execute a single retry attempt
   * @param attempt - the retry attempt to execute
   */
  private async executeRetry(attempt: RetryAttempt): Promise<void> {
    this.activeRetries++;

    try {
      console.log(
        `Executing retry for task ${attempt.taskId}, attempt ${attempt.attemptNumber}`
      );

      // Execute the task
      const result = await this.taskExecutor.execute(attempt.taskId);

      if (result.success) {
        console.log(`Retry succeeded for task ${attempt.taskId}`);
        await this.retryEngine.markSuccess(attempt.id);
      } else {
        console.warn(
          `Retry failed for task ${attempt.taskId}: ${result.error}`
        );

        // Check if we should retry again
        const policy = this.config.taskRetryPolicies.get(attempt.taskId);
        if (policy && this.retryEngine.canRetry(attempt.attemptNumber, policy)) {
          console.log(
            `Scheduling next retry for task ${attempt.taskId}, attempt ${attempt.attemptNumber + 1}`
          );
          await this.retryEngine.createRetryAttempt(
            attempt.taskId,
            attempt.attemptNumber,
            result.error || 'Unknown error',
            policy
          );
        } else {
          console.warn(
            `Max retries exceeded for task ${attempt.taskId} (attempt ${attempt.attemptNumber})`
          );
        }

        await this.retryEngine.markFailed(attempt.id);
      }
    } catch (error) {
      console.error(`Error executing retry for task ${attempt.taskId}:`, error);
      await this.retryEngine.markFailed(attempt.id);
    } finally {
      this.activeRetries--;
    }
  }

  /**
   * Get the current number of active retries
   * @returns number of active retries
   */
  getActiveRetryCount(): number {
    return this.activeRetries;
  }

  /**
   * Check if the scheduler is running
   * @returns true if running, false otherwise
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Register a task retry policy
   * @param taskId - ID of the task
   * @param policy - retry policy for the task
   */
  registerTaskPolicy(taskId: string, policy: RetryPolicy): void {
    this.config.taskRetryPolicies.set(taskId, policy);
    console.log(`Registered retry policy for task ${taskId}`);
  }

  /**
   * Unregister a task retry policy
   * @param taskId - ID of the task
   */
  unregisterTaskPolicy(taskId: string): void {
    this.config.taskRetryPolicies.delete(taskId);
    console.log(`Unregistered retry policy for task ${taskId}`);
  }
}

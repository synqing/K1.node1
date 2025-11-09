/**
 * Retry Engine Unit Tests
 * Tests for exponential/linear/fixed backoff, jitter, max delay, attempt tracking
 */

import { RetryEngine, RetryDatabase } from '../services/retry-engine';
import { RetryPolicy, RetryAttempt } from '../types/retry-policy.types';
import { RetryScheduler } from '../workers/retry-scheduler';

/**
 * Mock Database Implementation for Testing
 */
class MockRetryDatabase implements RetryDatabase {
  private attempts: Map<string, RetryAttempt> = new Map();
  private allAttempts: RetryAttempt[] = [];

  async saveAttempt(attempt: RetryAttempt): Promise<RetryAttempt> {
    this.attempts.set(attempt.id, attempt);
    this.allAttempts.push(attempt);
    return attempt;
  }

  async getAttempt(id: string): Promise<RetryAttempt | null> {
    return this.attempts.get(id) || null;
  }

  async listPendingRetries(limit: number): Promise<RetryAttempt[]> {
    return this.allAttempts
      .filter((a) => a.status === 'pending')
      .slice(0, limit);
  }

  async updateAttemptStatus(
    id: string,
    status: 'pending' | 'success' | 'failed'
  ): Promise<void> {
    const attempt = this.attempts.get(id);
    if (attempt) {
      attempt.status = status;
      attempt.updatedAt = new Date();
    }
  }

  async getDueRetries(now: Date): Promise<RetryAttempt[]> {
    return this.allAttempts.filter(
      (a) => a.status === 'pending' && a.retryAt <= now
    );
  }

  // Test helper to clear data
  clear(): void {
    this.attempts.clear();
    this.allAttempts = [];
  }

  // Test helper to get all attempts
  getAllAttempts(): RetryAttempt[] {
    return this.allAttempts;
  }
}

/**
 * Test Suite: Exponential Backoff Calculation
 */
describe('RetryEngine - Exponential Backoff', () => {
  let engine: RetryEngine;
  let db: MockRetryDatabase;

  beforeEach(() => {
    db = new MockRetryDatabase();
    engine = new RetryEngine(db);
  });

  test('should calculate exponential backoff for attempt 0', () => {
    const delay = engine.calculateExponentialBackoff(0, 100, 32000);
    // 2^0 * 100 = 1 * 100 = 100ms
    expect(delay).toBe(100);
  });

  test('should calculate exponential backoff for attempt 1', () => {
    const delay = engine.calculateExponentialBackoff(1, 100, 32000);
    // 2^1 * 100 = 2 * 100 = 200ms
    expect(delay).toBe(200);
  });

  test('should calculate exponential backoff for attempt 2', () => {
    const delay = engine.calculateExponentialBackoff(2, 100, 32000);
    // 2^2 * 100 = 4 * 100 = 400ms
    expect(delay).toBe(400);
  });

  test('should calculate exponential backoff for attempt 3', () => {
    const delay = engine.calculateExponentialBackoff(3, 100, 32000);
    // 2^3 * 100 = 8 * 100 = 800ms
    expect(delay).toBe(800);
  });

  test('should calculate exponential backoff for attempt 8', () => {
    const delay = engine.calculateExponentialBackoff(8, 100, 32000);
    // 2^8 * 100 = 256 * 100 = 25600ms
    expect(delay).toBe(25600);
  });

  test('should cap exponential backoff at maxDelayMs', () => {
    const delay = engine.calculateExponentialBackoff(10, 100, 5000);
    // 2^10 * 100 = 102400, but capped at 5000
    expect(delay).toBe(5000);
  });

  test('should handle exponential backoff with different baseDelay', () => {
    const delay = engine.calculateExponentialBackoff(3, 50, 10000);
    // 2^3 * 50 = 8 * 50 = 400ms
    expect(delay).toBe(400);
  });
});

/**
 * Test Suite: Linear Backoff Calculation
 */
describe('RetryEngine - Linear Backoff', () => {
  let engine: RetryEngine;
  let db: MockRetryDatabase;

  beforeEach(() => {
    db = new MockRetryDatabase();
    engine = new RetryEngine(db);
  });

  test('should calculate linear backoff for attempt 0', () => {
    const delay = engine.calculateLinearBackoff(0, 100, 10000);
    // 100 * (0 + 1) = 100ms
    expect(delay).toBe(100);
  });

  test('should calculate linear backoff for attempt 1', () => {
    const delay = engine.calculateLinearBackoff(1, 100, 10000);
    // 100 * (1 + 1) = 200ms
    expect(delay).toBe(200);
  });

  test('should calculate linear backoff for attempt 2', () => {
    const delay = engine.calculateLinearBackoff(2, 100, 10000);
    // 100 * (2 + 1) = 300ms
    expect(delay).toBe(300);
  });

  test('should calculate linear backoff for attempt 5', () => {
    const delay = engine.calculateLinearBackoff(5, 100, 10000);
    // 100 * (5 + 1) = 600ms
    expect(delay).toBe(600);
  });

  test('should cap linear backoff at maxDelayMs', () => {
    const delay = engine.calculateLinearBackoff(50, 100, 3000);
    // 100 * (50 + 1) = 5100, but capped at 3000
    expect(delay).toBe(3000);
  });

  test('should handle linear backoff with different baseDelay', () => {
    const delay = engine.calculateLinearBackoff(3, 200, 10000);
    // 200 * (3 + 1) = 800ms
    expect(delay).toBe(800);
  });
});

/**
 * Test Suite: Fixed Backoff Calculation
 */
describe('RetryEngine - Fixed Backoff', () => {
  let engine: RetryEngine;
  let db: MockRetryDatabase;

  beforeEach(() => {
    db = new MockRetryDatabase();
    engine = new RetryEngine(db);
  });

  test('should return fixed delay regardless of attempt', () => {
    const delay0 = engine.calculateFixedBackoff(500, 10000);
    const delay5 = engine.calculateFixedBackoff(500, 10000);
    expect(delay0).toBe(500);
    expect(delay5).toBe(500);
  });

  test('should cap fixed backoff at maxDelayMs', () => {
    const delay = engine.calculateFixedBackoff(8000, 3000);
    expect(delay).toBe(3000);
  });

  test('should use maxDelayMs if less than baseDelay', () => {
    const delay = engine.calculateFixedBackoff(5000, 2000);
    expect(delay).toBe(2000);
  });

  test('should return baseDelay when no cap is needed', () => {
    const delay = engine.calculateFixedBackoff(1000, 10000);
    expect(delay).toBe(1000);
  });
});

/**
 * Test Suite: Jitter Application
 */
describe('RetryEngine - Jitter', () => {
  let engine: RetryEngine;
  let db: MockRetryDatabase;

  beforeEach(() => {
    db = new MockRetryDatabase();
    engine = new RetryEngine(db);
  });

  test('should apply jitter within expected range', () => {
    const baseDelay = 1000;
    const jitterFactor = 0.1; // ±10%
    const samples = 100;

    const jitteredDelays = Array.from({ length: samples }, () =>
      engine.applyJitter(baseDelay, jitterFactor)
    );

    // Check all values are within ±10% of base delay
    jitteredDelays.forEach((delay) => {
      const minExpected = baseDelay * (1 - jitterFactor);
      const maxExpected = baseDelay * (1 + jitterFactor);
      expect(delay).toBeGreaterThanOrEqual(minExpected);
      expect(delay).toBeLessThanOrEqual(maxExpected);
    });
  });

  test('should have variation in jittered values', () => {
    const baseDelay = 1000;
    const jitterFactor = 0.1;
    const samples = 50;

    const jitteredDelays = Array.from({ length: samples }, () =>
      engine.applyJitter(baseDelay, jitterFactor)
    );

    // Ensure we have different values (not all the same)
    const uniqueValues = new Set(jitteredDelays);
    expect(uniqueValues.size).toBeGreaterThan(1);
  });

  test('should handle zero jitter factor', () => {
    const baseDelay = 1000;
    const delay = engine.applyJitter(baseDelay, 0);
    expect(delay).toBe(baseDelay);
  });

  test('should never return negative values', () => {
    const baseDelay = 100;
    const jitterFactor = 0.5; // ±50%
    const samples = 100;

    const jitteredDelays = Array.from({ length: samples }, () =>
      engine.applyJitter(baseDelay, jitterFactor)
    );

    jitteredDelays.forEach((delay) => {
      expect(delay).toBeGreaterThanOrEqual(0);
    });
  });
});

/**
 * Test Suite: Next Retry Calculation
 */
describe('RetryEngine - Calculate Next Retry', () => {
  let engine: RetryEngine;
  let db: MockRetryDatabase;

  beforeEach(() => {
    db = new MockRetryDatabase();
    engine = new RetryEngine(db);
  });

  test('should calculate exponential next retry time', () => {
    const policy: RetryPolicy = {
      maxRetries: 5,
      initialDelayMs: 100,
      maxDelayMs: 32000,
      strategy: 'exponential',
    };

    const baseTime = new Date();
    const result = engine.calculateNextRetry(0, policy, baseTime);

    expect(result.attempt).toBe(1);
    expect(result.delayMs).toBe(100);
    expect(result.nextRetryAt.getTime()).toBeGreaterThan(baseTime.getTime());
  });

  test('should calculate linear next retry time', () => {
    const policy: RetryPolicy = {
      maxRetries: 5,
      initialDelayMs: 100,
      maxDelayMs: 10000,
      strategy: 'linear',
    };

    const baseTime = new Date();
    const result = engine.calculateNextRetry(1, policy, baseTime);

    expect(result.attempt).toBe(2);
    expect(result.delayMs).toBe(200);
  });

  test('should calculate fixed next retry time', () => {
    const policy: RetryPolicy = {
      maxRetries: 5,
      initialDelayMs: 500,
      maxDelayMs: 10000,
      strategy: 'fixed',
    };

    const baseTime = new Date();
    const result = engine.calculateNextRetry(10, policy, baseTime);

    expect(result.attempt).toBe(11);
    expect(result.delayMs).toBe(500);
  });

  test('should throw on unknown strategy', () => {
    const policy: RetryPolicy = {
      maxRetries: 5,
      initialDelayMs: 100,
      maxDelayMs: 10000,
      strategy: 'unknown' as any,
    };

    expect(() => engine.calculateNextRetry(0, policy)).toThrow();
  });
});

/**
 * Test Suite: Retry Attempt Tracking
 */
describe('RetryEngine - Attempt Tracking', () => {
  let engine: RetryEngine;
  let db: MockRetryDatabase;

  beforeEach(() => {
    db = new MockRetryDatabase();
    engine = new RetryEngine(db);
  });

  test('should create and save retry attempt', async () => {
    const policy: RetryPolicy = {
      maxRetries: 5,
      initialDelayMs: 100,
      maxDelayMs: 10000,
      strategy: 'exponential',
    };

    const attempt = await engine.createRetryAttempt(
      'task-123',
      0,
      'Connection timeout',
      policy
    );

    expect(attempt.id).toBeDefined();
    expect(attempt.taskId).toBe('task-123');
    expect(attempt.attemptNumber).toBe(1);
    expect(attempt.errorMessage).toBe('Connection timeout');
    expect(attempt.status).toBe('pending');
  });

  test('should increment attempt number correctly', async () => {
    const policy: RetryPolicy = {
      maxRetries: 5,
      initialDelayMs: 100,
      maxDelayMs: 10000,
      strategy: 'exponential',
    };

    const attempt1 = await engine.createRetryAttempt(
      'task-456',
      0,
      'Error 1',
      policy
    );
    const attempt2 = await engine.createRetryAttempt(
      'task-456',
      1,
      'Error 2',
      policy
    );

    expect(attempt1.attemptNumber).toBe(1);
    expect(attempt2.attemptNumber).toBe(2);
  });

  test('should mark attempt as success', async () => {
    const policy: RetryPolicy = {
      maxRetries: 5,
      initialDelayMs: 100,
      maxDelayMs: 10000,
      strategy: 'exponential',
    };

    const attempt = await engine.createRetryAttempt(
      'task-789',
      0,
      'Error',
      policy
    );

    await engine.markSuccess(attempt.id);

    const updated = await db.getAttempt(attempt.id);
    expect(updated?.status).toBe('success');
  });

  test('should mark attempt as failed', async () => {
    const policy: RetryPolicy = {
      maxRetries: 5,
      initialDelayMs: 100,
      maxDelayMs: 10000,
      strategy: 'exponential',
    };

    const attempt = await engine.createRetryAttempt(
      'task-999',
      0,
      'Error',
      policy
    );

    await engine.markFailed(attempt.id);

    const updated = await db.getAttempt(attempt.id);
    expect(updated?.status).toBe('failed');
  });
});

/**
 * Test Suite: Max Delay Capping
 */
describe('RetryEngine - Max Delay Capping', () => {
  let engine: RetryEngine;
  let db: MockRetryDatabase;

  beforeEach(() => {
    db = new MockRetryDatabase();
    engine = new RetryEngine(db);
  });

  test('exponential backoff should not exceed maxDelayMs', () => {
    const maxDelay = 5000;
    for (let attempt = 0; attempt < 20; attempt++) {
      const delay = engine.calculateExponentialBackoff(attempt, 100, maxDelay);
      expect(delay).toBeLessThanOrEqual(maxDelay);
    }
  });

  test('linear backoff should not exceed maxDelayMs', () => {
    const maxDelay = 3000;
    for (let attempt = 0; attempt < 100; attempt++) {
      const delay = engine.calculateLinearBackoff(attempt, 100, maxDelay);
      expect(delay).toBeLessThanOrEqual(maxDelay);
    }
  });

  test('fixed backoff should not exceed maxDelayMs', () => {
    const delay = engine.calculateFixedBackoff(10000, 2000);
    expect(delay).toBeLessThanOrEqual(2000);
  });
});

/**
 * Test Suite: Database Updates
 */
describe('RetryEngine - Database Updates', () => {
  let engine: RetryEngine;
  let db: MockRetryDatabase;

  beforeEach(() => {
    db = new MockRetryDatabase();
    engine = new RetryEngine(db);
  });

  test('should get due retries from database', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 5000); // 5 seconds ago

    const attempt: RetryAttempt = {
      id: 'retry_test_1',
      taskId: 'task-1',
      attemptNumber: 1,
      errorMessage: 'Test error',
      retryAt: past,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await db.saveAttempt(attempt);

    const dueRetries = await engine.getDueRetries();
    expect(dueRetries.length).toBe(1);
    expect(dueRetries[0].taskId).toBe('task-1');
  });

  test('should not return future retries as due', async () => {
    const now = new Date();
    const future = new Date(now.getTime() + 5000); // 5 seconds in future

    const attempt: RetryAttempt = {
      id: 'retry_test_2',
      taskId: 'task-2',
      attemptNumber: 1,
      errorMessage: 'Test error',
      retryAt: future,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await db.saveAttempt(attempt);

    const dueRetries = await engine.getDueRetries();
    expect(dueRetries.length).toBe(0);
  });
});

/**
 * Test Suite: Can Retry Validation
 */
describe('RetryEngine - Can Retry Validation', () => {
  let engine: RetryEngine;
  let db: MockRetryDatabase;

  beforeEach(() => {
    db = new MockRetryDatabase();
    engine = new RetryEngine(db);
  });

  test('should allow retry when under maxRetries', () => {
    const policy: RetryPolicy = {
      maxRetries: 5,
      initialDelayMs: 100,
      maxDelayMs: 10000,
      strategy: 'exponential',
    };

    expect(engine.canRetry(0, policy)).toBe(true);
    expect(engine.canRetry(3, policy)).toBe(true);
    expect(engine.canRetry(4, policy)).toBe(true);
  });

  test('should prevent retry when maxRetries exceeded', () => {
    const policy: RetryPolicy = {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 10000,
      strategy: 'exponential',
    };

    expect(engine.canRetry(3, policy)).toBe(false);
    expect(engine.canRetry(4, policy)).toBe(false);
  });

  test('should handle maxRetries of 1', () => {
    const policy: RetryPolicy = {
      maxRetries: 1,
      initialDelayMs: 100,
      maxDelayMs: 10000,
      strategy: 'exponential',
    };

    expect(engine.canRetry(0, policy)).toBe(true);
    expect(engine.canRetry(1, policy)).toBe(false);
  });
});

/**
 * Test Suite: Worker Scheduling
 */
describe('RetryScheduler - Polling and Execution', () => {
  let scheduler: RetryScheduler;
  let db: MockRetryDatabase;
  let taskExecutor: any;

  beforeEach(() => {
    db = new MockRetryDatabase();
    taskExecutor = {
      execute: jest.fn().mockResolvedValue({ success: true }),
    };

    scheduler = new RetryScheduler(db, taskExecutor, {
      pollIntervalMs: 100,
      batchSize: 10,
      maxConcurrentRetries: 5,
      taskRetryPolicies: new Map(),
    });
  });

  test('should start and stop scheduler', () => {
    expect(scheduler.getIsRunning()).toBe(false);
    scheduler.start();
    expect(scheduler.getIsRunning()).toBe(true);
    scheduler.stop();
    expect(scheduler.getIsRunning()).toBe(false);
  });

  test('should prevent double start', () => {
    scheduler.start();
    scheduler.start(); // Should warn but not error
    expect(scheduler.getIsRunning()).toBe(true);
    scheduler.stop();
  });

  test('should track active retry count', () => {
    expect(scheduler.getActiveRetryCount()).toBe(0);
  });

  test('should register and unregister task policies', () => {
    const policy: RetryPolicy = {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 5000,
      strategy: 'exponential',
    };

    scheduler.registerTaskPolicy('task-1', policy);
    scheduler.registerTaskPolicy('task-2', policy);

    scheduler.unregisterTaskPolicy('task-1');
    expect(scheduler.getIsRunning()).toBe(false);
  });
});

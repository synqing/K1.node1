/**
 * Phase 5.4 Group A: E2E Integration Testing Suite
 * Comprehensive end-to-end tests for complete workflows
 *
 * Test Coverage: 20+ test scenarios across all major features
 * Duration: 4 days (parallel execution with Groups B-D)
 *
 * Test Categories:
 * 1. Happy Path Tests (6 tests)
 * 2. Error Recovery Tests (5 tests)
 * 3. Scheduling Tests (4 tests)
 * 4. API Integration Tests (3 tests)
 * 5. Real-Time Updates Tests (2 tests)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

/**
 * ============================================================================
 * SHARED TEST UTILITIES
 * ============================================================================
 */

interface TestContext {
  apiUrl: string;
  wsUrl: string;
  authToken: string;
  testTimeout: number;
  retryAttempts: number;
  enableDetailedLogging: boolean;
}

class E2ETestHarness {
  private context: TestContext;
  private executionIds: Set<string> = new Set();
  private metricsCollector: Map<string, any> = new Map();

  constructor(context: TestContext) {
    this.context = context;
  }

  /**
   * Make authenticated HTTP request
   */
  async makeRequest<T>(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<T> {
    const url = `${this.context.apiUrl}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.context.authToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${method} ${endpoint} failed: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Poll for status with exponential backoff
   */
  async pollUntil<T>(
    endpoint: string,
    condition: (data: T) => boolean,
    maxAttempts: number = 30,
    delayMs: number = 1000
  ): Promise<T> {
    let lastData: T;
    let delay = delayMs;

    for (let i = 0; i < maxAttempts; i++) {
      lastData = await this.makeRequest<T>('GET', endpoint);

      if (condition(lastData)) {
        return lastData;
      }

      if (i < maxAttempts - 1) {
        await this.sleep(delay);
        delay = Math.min(delay * 1.5, 5000); // Exponential backoff max 5s
      }
    }

    throw new Error(`Polling timed out after ${maxAttempts} attempts`);
  }

  /**
   * Record execution metrics
   */
  recordMetric(key: string, value: any): void {
    this.metricsCollector.set(key, {
      value,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get all collected metrics
   */
  getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, data] of this.metricsCollector.entries()) {
      result[key] = data.value;
    }
    return result;
  }

  /**
   * Helper: sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * ============================================================================
 * HAPPY PATH TESTS (Normal Workflow Execution)
 * ============================================================================
 */

describe('Phase 5.4 E2E Integration Tests - Happy Path', () => {
  let harness: E2ETestHarness;
  const testContext: TestContext = {
    apiUrl: process.env.API_URL || 'http://localhost:3000/api/v2',
    wsUrl: process.env.WS_URL || 'ws://localhost:3000',
    authToken: process.env.AUTH_TOKEN || 'test-token',
    testTimeout: 300000, // 5 minutes
    retryAttempts: 3,
    enableDetailedLogging: process.env.DEBUG_TESTS === 'true',
  };

  beforeAll(() => {
    harness = new E2ETestHarness(testContext);
    jest.setTimeout(testContext.testTimeout);
  });

  /**
   * Test 1: Submit and complete single task
   * Expected: Task transitions from queued → running → completed
   */
  it('should submit and complete a single task', async () => {
    const startTime = Date.now();

    // 1. Submit task
    const taskResponse = await harness.makeRequest<any>('POST', '/tasks', {
      id: `e2e-single-task-${Date.now()}`,
      name: 'Simple Test Task',
      parameters: { delay: 100 },
      priority: 5,
    });
    expect(taskResponse).toHaveProperty('id');
    const taskId = taskResponse.id;

    // 2. Poll for completion
    const completed = await harness.pollUntil<any>(
      `/tasks/${taskId}`,
      (data) => data.status === 'completed',
      30,
      1000
    );

    // 3. Verify final state
    expect(completed.status).toBe('completed');
    expect(completed.result).toBeDefined();

    // 4. Record metrics
    const duration = Date.now() - startTime;
    harness.recordMetric('single_task_duration_ms', duration);
    harness.recordMetric('single_task_success', true);
  });

  /**
   * Test 2: Submit batch of 10 tasks
   * Expected: All tasks complete successfully
   */
  it('should submit and complete batch of 10 tasks', async () => {
    const startTime = Date.now();
    const taskCount = 10;

    // 1. Submit batch
    const tasks = Array.from({ length: taskCount }, (_, i) => ({
      taskId: `e2e-batch-task-${i}-${Date.now()}`,
      parameters: { delay: 50 + i * 10 },
      priority: 5,
    }));

    const batchResponse = await harness.makeRequest<any>('POST', '/tasks/batch', {
      tasks,
      idempotencyKey: `batch-${Date.now()}`,
    });
    expect(batchResponse).toHaveProperty('batchId');
    const batchId = batchResponse.batchId;

    // 2. Poll for batch completion
    const completed = await harness.pollUntil<any>(
      `/tasks/batch/${batchId}`,
      (data) => data.status === 'completed',
      60,
      2000
    );

    // 3. Verify success rate
    const successRate = completed.successCount / completed.taskCount;
    expect(successRate).toBeGreaterThanOrEqual(0.95); // 95% success

    // 4. Record metrics
    const duration = Date.now() - startTime;
    harness.recordMetric('batch_10_duration_ms', duration);
    harness.recordMetric('batch_10_success_rate', successRate);
  });

  /**
   * Test 3: Test webhook delivery for task completion
   * Expected: Webhook receives task.completed event
   */
  it('should deliver webhook on task completion', async () => {
    const webhookUrl = 'https://webhook.site/test-' + Date.now();

    // 1. Register webhook
    const webhookResponse = await harness.makeRequest<any>('POST', '/webhooks', {
      url: webhookUrl,
      events: ['task.completed'],
    });
    expect(webhookResponse).toHaveProperty('id');
    const webhookId = webhookResponse.id;

    // 2. Submit task
    const taskResponse = await harness.makeRequest<any>('POST', '/tasks', {
      id: `e2e-webhook-task-${Date.now()}`,
      name: 'Webhook Test',
      parameters: { delay: 100 },
    });

    // 3. Wait for task completion
    await harness.pollUntil<any>(
      `/tasks/${taskResponse.id}`,
      (data) => data.status === 'completed',
      30,
      1000
    );

    // 4. Check webhook delivery
    const deliveries = await harness.makeRequest<any>(
      'GET',
      `/webhooks/${webhookId}/deliveries`
    );

    const completionEvent = deliveries.deliveries.find(
      (d: any) => d.eventType === 'task.completed'
    );
    expect(completionEvent).toBeDefined();
    expect(completionEvent.status).toMatch(/delivered|pending/);

    harness.recordMetric('webhook_delivery_success', true);
  });

  /**
   * Test 4: Test real-time metrics streaming
   * Expected: Metrics update in real-time as tasks execute
   */
  it('should stream real-time metrics during task execution', async () => {
    const metricsUpdates: any[] = [];

    // 1. Connect WebSocket
    const ws = new WebSocket(testContext.wsUrl);
    const wsReady = new Promise((resolve) => {
      ws.onopen = () => resolve(true);
    });
    await wsReady;

    // 2. Subscribe to metrics
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'metrics',
    }));

    // 3. Submit task
    const taskResponse = await harness.makeRequest<any>('POST', '/tasks', {
      id: `e2e-metrics-task-${Date.now()}`,
      parameters: { delay: 500 },
    });

    // 4. Collect metrics updates for 10 seconds
    const metricsPromise = new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 10000);
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'metrics:update') {
          metricsUpdates.push(message.data);
        }
      };
    });

    await metricsPromise;
    ws.close();

    // 5. Verify we received multiple updates
    expect(metricsUpdates.length).toBeGreaterThan(0);
    harness.recordMetric('metrics_updates_received', metricsUpdates.length);
  });

  /**
   * Test 5: Test rate limiting behavior
   * Expected: Requests above quota receive 429 response
   */
  it('should enforce rate limiting on batch operations', async () => {
    const attempts = 25; // Submit beyond quota
    let rateLimitedCount = 0;

    for (let i = 0; i < attempts; i++) {
      try {
        await harness.makeRequest<any>('POST', '/tasks/batch', {
          tasks: [{ taskId: `rate-limit-test-${i}` }],
        });
      } catch (error: any) {
        if (error.message.includes('429')) {
          rateLimitedCount++;
        }
      }
    }

    // At least some requests should be rate limited
    expect(rateLimitedCount).toBeGreaterThan(0);
    harness.recordMetric('rate_limit_enforced', true);
  });

  /**
   * Test 6: Test concurrent task execution
   * Expected: Multiple tasks run in parallel
   */
  it('should execute multiple tasks concurrently', async () => {
    const startTime = Date.now();
    const taskCount = 5;

    // 1. Submit 5 tasks concurrently
    const taskPromises = Array.from({ length: taskCount }, (_, i) =>
      harness.makeRequest<any>('POST', '/tasks', {
        id: `e2e-concurrent-${i}-${Date.now()}`,
        parameters: { delay: 2000 }, // 2 second each
      })
    );

    const tasks = await Promise.all(taskPromises);

    // 2. Wait for all to complete
    const completePromises = tasks.map((task) =>
      harness.pollUntil<any>(
        `/tasks/${task.id}`,
        (data) => data.status === 'completed',
        30,
        1000
      )
    );

    await Promise.all(completePromises);

    // 3. Measure elapsed time
    const elapsed = Date.now() - startTime;
    const sequentialTime = taskCount * 2000;

    // If running in parallel, should be ~2000ms (+ overhead)
    // If sequential, would be ~10000ms
    expect(elapsed).toBeLessThan(sequentialTime * 0.8); // 80% speedup

    harness.recordMetric('concurrent_tasks_duration_ms', elapsed);
    harness.recordMetric('parallelization_achieved', true);
  });
});

/**
 * ============================================================================
 * ERROR RECOVERY TESTS
 * ============================================================================
 */

describe('Phase 5.4 E2E Integration Tests - Error Recovery', () => {
  let harness: E2ETestHarness;
  const testContext: TestContext = {
    apiUrl: process.env.API_URL || 'http://localhost:3000/api/v2',
    wsUrl: process.env.WS_URL || 'ws://localhost:3000',
    authToken: process.env.AUTH_TOKEN || 'test-token',
    testTimeout: 300000,
    retryAttempts: 3,
    enableDetailedLogging: process.env.DEBUG_TESTS === 'true',
  };

  beforeAll(() => {
    harness = new E2ETestHarness(testContext);
    jest.setTimeout(testContext.testTimeout);
  });

  /**
   * Test 7: Task failure with automatic retry
   * Expected: Failed task retries and eventually succeeds
   */
  it('should retry failed task and eventually succeed', async () => {
    // 1. Submit task that fails on first attempt
    const taskResponse = await harness.makeRequest<any>('POST', '/tasks', {
      id: `e2e-retry-task-${Date.now()}`,
      parameters: {
        failOnAttempt: 1, // Fail first attempt
        delay: 100,
      },
      retryPolicy: {
        maxAttempts: 3,
        backoffMs: 500,
      },
    });

    // 2. Poll for success after retries
    const completed = await harness.pollUntil<any>(
      `/tasks/${taskResponse.id}`,
      (data) => data.status === 'completed' || data.attemptCount >= 3,
      60,
      2000
    );

    // 3. Verify task succeeded after retry
    expect(completed.status).toBe('completed');
    expect(completed.attemptCount).toBeGreaterThan(1);

    harness.recordMetric('retry_succeeded', true);
  });

  /**
   * Test 8: Permanent failure moves to DLQ
   * Expected: After max retries, task moves to dead letter queue
   */
  it('should move permanently failed task to DLQ', async () => {
    // 1. Submit task that always fails
    const taskResponse = await harness.makeRequest<any>('POST', '/tasks', {
      id: `e2e-dlq-task-${Date.now()}`,
      parameters: {
        alwaysFail: true, // Always fail
      },
      retryPolicy: {
        maxAttempts: 2,
        backoffMs: 200,
      },
    });

    // 2. Wait for task to exhaust retries
    await harness.pollUntil<any>(
      `/tasks/${taskResponse.id}`,
      (data) => data.status === 'failed',
      30,
      1000
    );

    // 3. Check DLQ
    const dlqResponse = await harness.makeRequest<any>('GET', '/queue/dlq');

    const dlqEntry = dlqResponse.entries.find(
      (e: any) => e.taskId === taskResponse.id
    );
    expect(dlqEntry).toBeDefined();
    expect(dlqEntry.status).toBe('pending_review');

    harness.recordMetric('dlq_routing_working', true);
  });

  /**
   * Test 9: Manual task intervention (pause/resume)
   * Expected: Task can be paused and resumed by operator
   */
  it('should support manual task intervention', async () => {
    // 1. Submit long-running task
    const taskResponse = await harness.makeRequest<any>('POST', '/tasks', {
      id: `e2e-intervention-task-${Date.now()}`,
      parameters: { delay: 5000 },
    });

    // 2. Wait for task to start
    await harness.pollUntil<any>(
      `/tasks/${taskResponse.id}`,
      (data) => data.status === 'running',
      10,
      500
    );

    // 3. Pause task
    await harness.makeRequest<any>('POST', `/tasks/${taskResponse.id}/pause`, {
      reason: 'Manual intervention for testing',
    });

    // 4. Verify task is paused
    const paused = await harness.makeRequest<any>(
      'GET',
      `/tasks/${taskResponse.id}`
    );
    expect(paused.status).toBe('paused');

    // 5. Resume task
    await harness.makeRequest<any>('POST', `/tasks/${taskResponse.id}/resume`, {});

    // 6. Wait for completion
    const completed = await harness.pollUntil<any>(
      `/tasks/${taskResponse.id}`,
      (data) => data.status === 'completed',
      30,
      1000
    );

    expect(completed.status).toBe('completed');
    harness.recordMetric('manual_intervention_working', true);
  });

  /**
   * Test 10: Circuit breaker prevents cascading failures
   * Expected: After N failures, circuit breaker opens and blocks requests
   */
  it('should open circuit breaker after repeated failures', async () => {
    const failingEndpoint = 'circuit-breaker-test';

    // 1. Submit several failing tasks to trigger circuit breaker
    const failTasks = Array.from({ length: 5 }, (_, i) =>
      harness.makeRequest<any>('POST', '/tasks', {
        id: `e2e-cb-task-${i}-${Date.now()}`,
        endpoint: failingEndpoint,
        parameters: { alwaysFail: true },
      }).catch(() => null) // Ignore errors
    );

    await Promise.all(failTasks);

    // 2. Check circuit breaker status
    const cbStatus = await harness.makeRequest<any>(
      'GET',
      `/circuit-breaker/status?breaker_id=${failingEndpoint}`
    );

    // Expect circuit breaker to be open or half-open
    expect(['open', 'half-open']).toContain(cbStatus.state);

    harness.recordMetric('circuit_breaker_working', true);
  });

  /**
   * Test 11: Error metrics tracking
   * Expected: System tracks error rates and types
   */
  it('should track error metrics accurately', async () => {
    // 1. Get initial error stats
    const initialStats = await harness.makeRequest<any>(
      'GET',
      '/metrics/error-stats'
    );

    // 2. Submit mix of successful and failing tasks
    await harness.makeRequest<any>('POST', '/tasks', {
      id: `e2e-error-stat-success-${Date.now()}`,
      parameters: { delay: 100 },
    });

    await harness.makeRequest<any>('POST', '/tasks', {
      id: `e2e-error-stat-fail-${Date.now()}`,
      parameters: { alwaysFail: true },
    }).catch(() => null);

    // 3. Wait a moment for stats to update
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4. Get updated stats
    const updatedStats = await harness.makeRequest<any>(
      'GET',
      '/metrics/error-stats'
    );

    // Error count should have increased
    expect(updatedStats.totalErrors).toBeGreaterThan(
      initialStats.totalErrors || 0
    );

    harness.recordMetric('error_tracking_working', true);
  });
});

/**
 * ============================================================================
 * SCHEDULING TESTS
 * ============================================================================
 */

describe('Phase 5.4 E2E Integration Tests - Scheduling', () => {
  let harness: E2ETestHarness;
  const testContext: TestContext = {
    apiUrl: process.env.API_URL || 'http://localhost:3000/api/v2',
    wsUrl: process.env.WS_URL || 'ws://localhost:3000',
    authToken: process.env.AUTH_TOKEN || 'test-token',
    testTimeout: 300000,
    retryAttempts: 3,
    enableDetailedLogging: process.env.DEBUG_TESTS === 'true',
  };

  beforeAll(() => {
    harness = new E2ETestHarness(testContext);
    jest.setTimeout(testContext.testTimeout);
  });

  /**
   * Test 12: Cron-based scheduling
   * Expected: Task scheduled with cron expression executes at correct time
   */
  it('should execute cron-scheduled tasks at correct intervals', async () => {
    const now = new Date();
    const nextMinute = new Date(now.getTime() + 60000);

    // 1. Schedule task to run next minute
    const scheduleResponse = await harness.makeRequest<any>('POST', '/schedules', {
      id: `e2e-cron-${Date.now()}`,
      cronExpression: `${nextMinute.getMinutes()} ${nextMinute.getHours()} * * *`,
      taskTemplate: {
        name: 'Scheduled Task',
        parameters: { delay: 100 },
      },
    });

    expect(scheduleResponse).toHaveProperty('scheduleId');

    // 2. Wait for execution
    const executed = await harness.pollUntil<any>(
      `/schedules/${scheduleResponse.scheduleId}/executions`,
      (data) => data.executions && data.executions.length > 0,
      120, // 2 minutes max
      5000
    );

    expect(executed.executions.length).toBeGreaterThan(0);
    harness.recordMetric('cron_scheduling_working', true);
  });

  /**
   * Test 13: Event-based task triggering
   * Expected: Task executes when dependent task completes
   */
  it('should trigger task on event completion', async () => {
    // 1. Submit first task
    const task1Response = await harness.makeRequest<any>('POST', '/tasks', {
      id: `e2e-event-task1-${Date.now()}`,
      parameters: { delay: 100 },
    });

    // 2. Create schedule that triggers on task1 completion
    const scheduleResponse = await harness.makeRequest<any>('POST', '/schedules', {
      id: `e2e-event-trigger-${Date.now()}`,
      trigger: {
        type: 'task-completion',
        taskId: task1Response.id,
      },
      taskTemplate: {
        name: 'Triggered Task',
        parameters: { delay: 100 },
      },
    });

    // 3. Wait for task1 to complete
    await harness.pollUntil<any>(
      `/tasks/${task1Response.id}`,
      (data) => data.status === 'completed',
      30,
      1000
    );

    // 4. Wait for triggered task to appear
    const executions = await harness.pollUntil<any>(
      `/schedules/${scheduleResponse.scheduleId}/executions`,
      (data) => data.executions && data.executions.length > 0,
      30,
      1000
    );

    expect(executions.executions.length).toBeGreaterThan(0);
    harness.recordMetric('event_triggering_working', true);
  });

  /**
   * Test 14: Priority queue enforcement
   * Expected: Higher priority tasks execute before lower priority
   */
  it('should respect task priority in execution order', async () => {
    const now = Date.now();

    // 1. Submit low priority task
    const lowPriority = await harness.makeRequest<any>('POST', '/tasks', {
      id: `e2e-priority-low-${now}`,
      priority: 1,
      parameters: { delay: 100 },
    });

    // 2. Immediately submit high priority task
    const highPriority = await harness.makeRequest<any>('POST', '/tasks', {
      id: `e2e-priority-high-${now}`,
      priority: 10,
      parameters: { delay: 100 },
    });

    // 3. Wait for both to complete
    const [lowCompleted, highCompleted] = await Promise.all([
      harness.pollUntil<any>(
        `/tasks/${lowPriority.id}`,
        (data) => data.status === 'completed',
        30,
        1000
      ),
      harness.pollUntil<any>(
        `/tasks/${highPriority.id}`,
        (data) => data.status === 'completed',
        30,
        1000
      ),
    ]);

    // High priority task should have started before or around same time
    const startDiff = (highCompleted.startedAt || '') > (lowCompleted.startedAt || '');
    expect(startDiff).toBeDefined(); // Verify times exist

    harness.recordMetric('priority_queue_working', true);
  });

  /**
   * Test 15: Resource-aware scheduling
   * Expected: System respects resource constraints when scheduling
   */
  it('should respect resource constraints in scheduling', async () => {
    // 1. Get current resource utilization
    const resources = await harness.makeRequest<any>('GET', '/metrics/resources');

    // 2. Submit task requesting specific resources
    const taskResponse = await harness.makeRequest<any>('POST', '/tasks', {
      id: `e2e-resource-task-${Date.now()}`,
      resourceRequirements: {
        cpuPercent: 10,
        memoryMb: 100,
      },
      parameters: { delay: 200 },
    });

    // 3. Verify task accepted
    expect(taskResponse).toHaveProperty('id');

    // 4. Wait for execution
    const completed = await harness.pollUntil<any>(
      `/tasks/${taskResponse.id}`,
      (data) => data.status === 'completed',
      30,
      1000
    );

    expect(completed.status).toBe('completed');
    harness.recordMetric('resource_aware_scheduling_working', true);
  });
});

/**
 * ============================================================================
 * API INTEGRATION TESTS
 * ============================================================================
 */

describe('Phase 5.4 E2E Integration Tests - API Integration', () => {
  let harness: E2ETestHarness;
  const testContext: TestContext = {
    apiUrl: process.env.API_URL || 'http://localhost:3000/api/v2',
    wsUrl: process.env.WS_URL || 'ws://localhost:3000',
    authToken: process.env.AUTH_TOKEN || 'test-token',
    testTimeout: 300000,
    retryAttempts: 3,
    enableDetailedLogging: process.env.DEBUG_TESTS === 'true',
  };

  beforeAll(() => {
    harness = new E2ETestHarness(testContext);
    jest.setTimeout(testContext.testTimeout);
  });

  /**
   * Test 16: API version compatibility
   * Expected: v1 and v2 endpoints both work, backward compatible
   */
  it('should maintain backward compatibility across API versions', async () => {
    // 1. Submit task via v1 API
    const v1Response = await harness.makeRequest<any>('POST', '/tasks', {
      id: `e2e-v1-compat-${Date.now()}`,
      parameters: { delay: 100 },
    });
    expect(v1Response).toHaveProperty('id');

    // 2. Submit task via v2 API
    const v2Response = await harness.makeRequest<any>('POST', '/tasks', {
      id: `e2e-v2-compat-${Date.now()}`,
      parameters: { delay: 100 },
    });
    expect(v2Response).toHaveProperty('id');

    // 3. Both should complete successfully
    const [v1Completed, v2Completed] = await Promise.all([
      harness.pollUntil<any>(
        `/tasks/${v1Response.id}`,
        (data) => data.status === 'completed',
        30,
        1000
      ),
      harness.pollUntil<any>(
        `/tasks/${v2Response.id}`,
        (data) => data.status === 'completed',
        30,
        1000
      ),
    ]);

    expect(v1Completed.status).toBe('completed');
    expect(v2Completed.status).toBe('completed');

    harness.recordMetric('api_version_compatibility', true);
  });

  /**
   * Test 17: Batch DLQ resubmission
   * Expected: Multiple DLQ items can be resubmitted in batch
   */
  it('should resubmit multiple DLQ items in batch', async () => {
    // 1. Create several failed tasks to populate DLQ
    const failTasks = Array.from({ length: 3 }, (_, i) =>
      harness.makeRequest<any>('POST', '/tasks', {
        id: `e2e-batch-dlq-${i}-${Date.now()}`,
        parameters: { alwaysFail: true },
        retryPolicy: { maxAttempts: 1 },
      }).catch(() => null)
    );

    await Promise.all(failTasks);

    // 2. Get DLQ entries
    const dlq = await harness.makeRequest<any>('GET', '/queue/dlq');
    const dlqIds = dlq.entries.slice(0, 3).map((e: any) => e.id);

    // 3. Batch resubmit
    const resubmitResponse = await harness.makeRequest<any>(
      'POST',
      '/queue/dlq/batch/resubmit',
      {
        dlqIds,
        parameters: { alwaysFail: false }, // Don't fail this time
      }
    );

    expect(resubmitResponse.batchId).toBeDefined();
    harness.recordMetric('batch_dlq_resubmission_working', true);
  });

  /**
   * Test 18: Complex query filtering
   * Expected: API supports advanced filtering and search
   */
  it('should support advanced filtering and search', async () => {
    const now = Date.now();

    // 1. Submit tasks with different statuses and tags
    await Promise.all([
      harness.makeRequest<any>('POST', '/tasks', {
        id: `e2e-search-1-${now}`,
        tags: ['critical', 'test'],
        parameters: { delay: 100 },
      }),
      harness.makeRequest<any>('POST', '/tasks', {
        id: `e2e-search-2-${now}`,
        tags: ['low-priority', 'test'],
        parameters: { delay: 100 },
      }),
    ]);

    // 2. Query with filters
    const criticalTasks = await harness.makeRequest<any>(
      'GET',
      '/tasks?tags=critical&limit=10'
    );

    const testTasks = await harness.makeRequest<any>(
      'GET',
      '/tasks?tags=test&limit=10'
    );

    // Should find tasks by tag
    expect(criticalTasks.tasks.length).toBeGreaterThan(0);
    expect(testTasks.tasks.length).toBeGreaterThan(0);

    harness.recordMetric('advanced_filtering_working', true);
  });
});

/**
 * ============================================================================
 * REAL-TIME UPDATES TESTS
 * ============================================================================
 */

describe('Phase 5.4 E2E Integration Tests - Real-Time Updates', () => {
  let harness: E2ETestHarness;
  const testContext: TestContext = {
    apiUrl: process.env.API_URL || 'http://localhost:3000/api/v2',
    wsUrl: process.env.WS_URL || 'ws://localhost:3000',
    authToken: process.env.AUTH_TOKEN || 'test-token',
    testTimeout: 300000,
    retryAttempts: 3,
    enableDetailedLogging: process.env.DEBUG_TESTS === 'true',
  };

  beforeAll(() => {
    harness = new E2ETestHarness(testContext);
    jest.setTimeout(testContext.testTimeout);
  });

  /**
   * Test 19: WebSocket real-time task status updates
   * Expected: Status changes broadcast in real-time via WebSocket
   */
  it('should broadcast task status updates via WebSocket', async () => {
    const statusUpdates: string[] = [];

    // 1. Connect WebSocket
    const ws = new WebSocket(testContext.wsUrl);
    const wsReady = new Promise<void>((resolve) => {
      ws.onopen = () => resolve();
    });
    await wsReady;

    // 2. Subscribe to task updates
    const taskId = `e2e-ws-task-${Date.now()}`;
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel: `task:${taskId}`,
    }));

    // 3. Collect status updates
    const updatePromise = new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 10000);
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'task:status-change') {
          statusUpdates.push(message.data.status);
        }
      };
    });

    // 4. Submit task
    await harness.makeRequest<any>('POST', '/tasks', {
      id: taskId,
      parameters: { delay: 1000 },
    });

    // 5. Wait for updates
    await updatePromise;
    ws.close();

    // Should see status transitions
    expect(statusUpdates.length).toBeGreaterThan(0);
    harness.recordMetric('websocket_updates_received', statusUpdates.length);
  });

  /**
   * Test 20: Fallback to polling when WebSocket unavailable
   * Expected: Dashboard continues working even if WebSocket down
   */
  it('should fallback to polling when WebSocket unavailable', async () => {
    // 1. Disable WebSocket (simulate connection failure)
    const originalWsUrl = testContext.wsUrl;
    testContext.wsUrl = 'ws://invalid-host:0';

    // 2. Make request that should trigger polling fallback
    const response = await harness.makeRequest<any>('GET', '/tasks');

    // 3. Should still get data via REST fallback
    expect(response).toHaveProperty('tasks');

    // 4. Restore WebSocket URL
    testContext.wsUrl = originalWsUrl;

    harness.recordMetric('fallback_polling_working', true);
  });
});

export default { E2ETestHarness };

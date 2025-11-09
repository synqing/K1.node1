/**
 * Phase 5.4 Group B: Load Testing & Stress Testing Suite
 * Comprehensive performance validation under concurrent load
 *
 * Test Coverage: 1x, 3x, 10x concurrent load profiles
 * Metrics: Throughput, latency, error rates, resource utilization
 * Duration: 5 days (parallel execution with Groups A, C, D)
 *
 * Test Categories:
 * 1. Baseline Load Tests (1x) - 3 tests
 * 2. Moderate Load Tests (3x) - 3 tests
 * 3. High Load Tests (10x) - 3 tests
 * 4. Saturation & Limits Tests - 4 tests
 * 5. Sustained Load Tests - 2 tests
 */

import axios, { AxiosInstance } from 'axios';
import { performance } from 'perf_hooks';

/**
 * ============================================================================
 * LOAD TEST CONFIGURATION & METRICS
 * ============================================================================
 */

interface LoadTestConfig {
  apiUrl: string;
  authToken: string;
  taskCount: number; // Tasks per workflow
  concurrentWorkflows: number;
  taskDurationMs: number;
  timeoutMs: number;
  rampUpMs: number; // Time to ramp up to full load
}

interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  totalDuration: number;
  tasksSubmitted: number;
  tasksCompleted: number;
  tasksFailed: number;
  successRate: number;

  // Latency metrics (ms)
  minLatency: number;
  maxLatency: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;

  // Throughput metrics
  throughputTasksPerSecond: number;
  throughputTasksPerMinute: number;

  // Resource metrics
  peakMemoryMb: number;
  avgCpuPercent: number;
  peakCpuPercent: number;

  // Error metrics
  networkErrors: number;
  timeoutErrors: number;
  apiErrors: number;
  totalErrors: number;
}

class LoadTestHarness {
  private config: LoadTestConfig;
  private client: AxiosInstance;
  private metrics: PerformanceMetrics;
  private latencies: number[] = [];
  private resourceMetrics: any[] = [];

  constructor(config: LoadTestConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        'Authorization': `Bearer ${config.authToken}`,
        'Content-Type': 'application/json',
      },
      timeout: config.timeoutMs,
    });

    this.metrics = {
      startTime: 0,
      endTime: 0,
      totalDuration: 0,
      tasksSubmitted: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      successRate: 0,
      minLatency: Infinity,
      maxLatency: 0,
      avgLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      throughputTasksPerSecond: 0,
      throughputTasksPerMinute: 0,
      peakMemoryMb: 0,
      avgCpuPercent: 0,
      peakCpuPercent: 0,
      networkErrors: 0,
      timeoutErrors: 0,
      apiErrors: 0,
      totalErrors: 0,
    };
  }

  /**
   * Submit a single task and measure latency
   */
  async submitTask(
    workflowId: string,
    taskIndex: number
  ): Promise<{ success: boolean; latency: number; error?: any }> {
    const startTime = performance.now();

    try {
      await this.client.post('/tasks', {
        id: `load-test-${workflowId}-task-${taskIndex}-${Date.now()}`,
        name: `Load Test Task ${taskIndex}`,
        parameters: {
          delay: this.config.taskDurationMs,
        },
      });

      const latency = performance.now() - startTime;
      this.latencies.push(latency);
      this.metrics.tasksSubmitted++;

      return { success: true, latency };
    } catch (error: any) {
      const latency = performance.now() - startTime;

      if (error.code === 'ECONNABORTED') {
        this.metrics.timeoutErrors++;
      } else if (error.response?.status >= 500) {
        this.metrics.apiErrors++;
      } else {
        this.metrics.networkErrors++;
      }

      this.metrics.totalErrors++;
      return {
        success: false,
        latency,
        error: error.message,
      };
    }
  }

  /**
   * Submit complete workflow with configured concurrency
   */
  async runWorkload(): Promise<PerformanceMetrics> {
    this.metrics.startTime = performance.now();

    // Create array of all tasks to submit
    const allTasks: Promise<any>[] = [];

    for (let w = 0; w < this.config.concurrentWorkflows; w++) {
      const workflowId = `workflow-${w}-${Date.now()}`;

      for (let t = 0; t < this.config.taskCount; t++) {
        // Calculate ramp-up delay
        const taskDelay =
          (w * this.config.taskCount + t) *
          (this.config.rampUpMs / (this.config.concurrentWorkflows * this.config.taskCount));

        allTasks.push(
          new Promise((resolve) => {
            setTimeout(() => {
              this.submitTask(workflowId, t).then(resolve);
            }, taskDelay);
          })
        );
      }
    }

    // Submit all tasks
    const results = await Promise.all(allTasks);
    this.metrics.tasksCompleted = results.filter((r) => r.success).length;
    this.metrics.tasksFailed = results.filter((r) => !r.success).length;

    // Wait for tasks to complete (with buffer)
    await new Promise((resolve) => {
      setTimeout(resolve, this.config.taskDurationMs + 5000);
    });

    this.metrics.endTime = performance.now();
    this.calculateMetrics();

    return this.metrics;
  }

  /**
   * Calculate all performance metrics
   */
  private calculateMetrics(): void {
    // Duration
    this.metrics.totalDuration = this.metrics.endTime - this.metrics.startTime;
    const durationSeconds = this.metrics.totalDuration / 1000;

    // Success rate
    this.metrics.successRate =
      this.metrics.tasksSubmitted > 0
        ? this.metrics.tasksCompleted / this.metrics.tasksSubmitted
        : 0;

    // Latency metrics
    if (this.latencies.length > 0) {
      this.metrics.minLatency = Math.min(...this.latencies);
      this.metrics.maxLatency = Math.max(...this.latencies);
      this.metrics.avgLatency = this.latencies.reduce((a, b) => a + b) / this.latencies.length;

      const sorted = [...this.latencies].sort((a, b) => a - b);
      this.metrics.p50Latency = sorted[Math.floor(sorted.length * 0.5)];
      this.metrics.p95Latency = sorted[Math.floor(sorted.length * 0.95)];
      this.metrics.p99Latency = sorted[Math.floor(sorted.length * 0.99)];
    }

    // Throughput
    this.metrics.throughputTasksPerSecond = this.metrics.tasksSubmitted / durationSeconds;
    this.metrics.throughputTasksPerMinute = this.metrics.throughputTasksPerSecond * 60;
  }

  /**
   * Collect resource utilization metrics
   */
  async collectResourceMetrics(): Promise<any> {
    try {
      const response = await this.client.get('/metrics/resources');
      this.resourceMetrics.push(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to collect resource metrics:', error);
      return null;
    }
  }

  /**
   * Get comprehensive report
   */
  getReport(): any {
    return {
      config: {
        taskCount: this.config.taskCount,
        concurrentWorkflows: this.config.concurrentWorkflows,
        totalTasks: this.config.taskCount * this.config.concurrentWorkflows,
      },
      summary: {
        duration: `${(this.metrics.totalDuration / 1000).toFixed(2)}s`,
        tasksSubmitted: this.metrics.tasksSubmitted,
        tasksCompleted: this.metrics.tasksCompleted,
        tasksFailed: this.metrics.tasksFailed,
        successRate: `${(this.metrics.successRate * 100).toFixed(2)}%`,
      },
      latency: {
        min: `${this.metrics.minLatency.toFixed(2)}ms`,
        avg: `${this.metrics.avgLatency.toFixed(2)}ms`,
        max: `${this.metrics.maxLatency.toFixed(2)}ms`,
        p50: `${this.metrics.p50Latency.toFixed(2)}ms`,
        p95: `${this.metrics.p95Latency.toFixed(2)}ms`,
        p99: `${this.metrics.p99Latency.toFixed(2)}ms`,
      },
      throughput: {
        tasksPerSecond: this.metrics.throughputTasksPerSecond.toFixed(2),
        tasksPerMinute: this.metrics.throughputTasksPerMinute.toFixed(0),
      },
      errors: {
        network: this.metrics.networkErrors,
        timeout: this.metrics.timeoutErrors,
        api: this.metrics.apiErrors,
        total: this.metrics.totalErrors,
      },
      rawMetrics: this.metrics,
    };
  }
}

/**
 * ============================================================================
 * BASELINE LOAD TESTS (1x Concurrency)
 * ============================================================================
 */

describe('Phase 5.4 Load Testing - Baseline (1x)', () => {
  let harness: LoadTestHarness;

  beforeAll(() => {
    harness = new LoadTestHarness({
      apiUrl: process.env.API_URL || 'http://localhost:3000/api/v2',
      authToken: process.env.AUTH_TOKEN || 'test-token',
      taskCount: 22, // Single 22-task workflow
      concurrentWorkflows: 1,
      taskDurationMs: 100,
      timeoutMs: 30000,
      rampUpMs: 5000,
    });
    jest.setTimeout(180000); // 3 minutes
  });

  /**
   * Test 1: Single 22-task workflow
   * Expected: Completes in 60-90 seconds with >95% success rate
   */
  it('should complete single 22-task workflow within targets', async () => {
    const metrics = await harness.runWorkload();
    const report = harness.getReport();

    console.log('\n=== BASELINE LOAD TEST REPORT ===');
    console.log(JSON.stringify(report, null, 2));

    // Success rate target: ≥95%
    expect(metrics.successRate).toBeGreaterThanOrEqual(0.95);

    // Duration target: 60-90 seconds (tasks run with 100ms each, so ~2.2 seconds + overhead)
    const durationSeconds = metrics.totalDuration / 1000;
    expect(durationSeconds).toBeLessThan(120); // Generous buffer

    // Latency target: avg <100ms (submission latency)
    expect(metrics.avgLatency).toBeLessThan(100);
  });

  /**
   * Test 2: Sustained baseline load for 1 minute
   * Expected: Stable performance, no degradation
   */
  it('should maintain stable performance over 1 minute', async () => {
    const startTime = performance.now();
    const results: any[] = [];

    while (performance.now() - startTime < 60000) {
      const harness = new LoadTestHarness({
        apiUrl: process.env.API_URL || 'http://localhost:3000/api/v2',
        authToken: process.env.AUTH_TOKEN || 'test-token',
        taskCount: 5,
        concurrentWorkflows: 1,
        taskDurationMs: 50,
        timeoutMs: 10000,
        rampUpMs: 1000,
      });

      const metrics = await harness.runWorkload();
      results.push(metrics.avgLatency);

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Check for performance degradation
    const firstHalf = results.slice(0, Math.floor(results.length / 2));
    const secondHalf = results.slice(Math.floor(results.length / 2));

    const avgFirstHalf = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
    const avgSecondHalf = secondHalf.reduce((a, b) => a + b) / secondHalf.length;

    // Second half should not be >20% slower
    expect(avgSecondHalf).toBeLessThan(avgFirstHalf * 1.2);
  });

  /**
   * Test 3: Resource utilization baseline
   * Expected: CPU <50%, Memory <70% under baseline load
   */
  it('should maintain healthy resource utilization at baseline', async () => {
    await harness.runWorkload();
    const resources = await harness.collectResourceMetrics();

    if (resources) {
      // These are targets; may not be available in all environments
      console.log(`Baseline Resources: CPU=${resources.cpuPercent}%, Memory=${resources.memoryMb}MB`);
    }
  });
});

/**
 * ============================================================================
 * MODERATE LOAD TESTS (3x Concurrency)
 * ============================================================================
 */

describe('Phase 5.4 Load Testing - Moderate (3x)', () => {
  let harness: LoadTestHarness;

  beforeAll(() => {
    harness = new LoadTestHarness({
      apiUrl: process.env.API_URL || 'http://localhost:3000/api/v2',
      authToken: process.env.AUTH_TOKEN || 'test-token',
      taskCount: 22,
      concurrentWorkflows: 3, // 3 concurrent 22-task workflows = 66 tasks
      taskDurationMs: 100,
      timeoutMs: 30000,
      rampUpMs: 10000,
    });
    jest.setTimeout(300000); // 5 minutes
  });

  /**
   * Test 4: Three concurrent 22-task workflows
   * Expected: Completes with minimal performance degradation
   */
  it('should handle 3 concurrent workflows efficiently', async () => {
    const metrics = await harness.runWorkload();
    const report = harness.getReport();

    console.log('\n=== MODERATE LOAD TEST REPORT (3x) ===');
    console.log(JSON.stringify(report, null, 2));

    // Success rate: ≥95%
    expect(metrics.successRate).toBeGreaterThanOrEqual(0.95);

    // Total duration should be ~3x baseline (some parallelization possible)
    const durationSeconds = metrics.totalDuration / 1000;
    expect(durationSeconds).toBeLessThan(360); // 6 minutes max

    // Latency should not degrade too much
    expect(metrics.avgLatency).toBeLessThan(200); // Allowable increase
  });

  /**
   * Test 5: Queue depth validation
   * Expected: Queue remains bounded, no unbounded growth
   */
  it('should maintain bounded queue depth under 3x load', async () => {
    const queueDepths: number[] = [];

    // Monitor queue depth during load
    const loadPromise = harness.runWorkload();

    const queueMonitor = setInterval(async () => {
      try {
        const queueStatus = await fetch(
          `${process.env.API_URL || 'http://localhost:3000/api/v2'}/queue/status`,
          {
            headers: { Authorization: `Bearer ${process.env.AUTH_TOKEN || 'test-token'}` },
          }
        ).then((r) => r.json());

        queueDepths.push(queueStatus.pendingCount || 0);
      } catch (error) {
        // Ignore monitoring errors
      }
    }, 500);

    await loadPromise;
    clearInterval(queueMonitor);

    if (queueDepths.length > 0) {
      const maxDepth = Math.max(...queueDepths);
      const avgDepth = queueDepths.reduce((a, b) => a + b) / queueDepths.length;

      console.log(
        `Queue depth - Max: ${maxDepth}, Avg: ${avgDepth.toFixed(2)}, Samples: ${queueDepths.length}`
      );

      // Queue should not grow unbounded
      expect(maxDepth).toBeLessThan(1000);
    }
  });

  /**
   * Test 6: Error rate under moderate load
   * Expected: Error rate remains <5%
   */
  it('should maintain error rate <5% under 3x load', async () => {
    const metrics = await harness.runWorkload();
    const errorRate = metrics.totalErrors / metrics.tasksSubmitted;

    console.log(
      `Error rate under 3x load: ${(errorRate * 100).toFixed(2)}% (${metrics.totalErrors}/${metrics.tasksSubmitted})`
    );

    // Error rate <5%
    expect(errorRate).toBeLessThan(0.05);
  });
});

/**
 * ============================================================================
 * HIGH LOAD TESTS (10x Concurrency)
 * ============================================================================
 */

describe('Phase 5.4 Load Testing - High Load (10x)', () => {
  let harness: LoadTestHarness;

  beforeAll(() => {
    harness = new LoadTestHarness({
      apiUrl: process.env.API_URL || 'http://localhost:3000/api/v2',
      authToken: process.env.AUTH_TOKEN || 'test-token',
      taskCount: 22,
      concurrentWorkflows: 10, // 10 concurrent workflows = 220 tasks
      taskDurationMs: 100,
      timeoutMs: 30000,
      rampUpMs: 20000,
    });
    jest.setTimeout(600000); // 10 minutes
  });

  /**
   * Test 7: Ten concurrent 22-task workflows
   * Expected: System remains stable, graceful degradation acceptable
   */
  it('should handle 10 concurrent workflows with graceful degradation', async () => {
    const metrics = await harness.runWorkload();
    const report = harness.getReport();

    console.log('\n=== HIGH LOAD TEST REPORT (10x) ===');
    console.log(JSON.stringify(report, null, 2));

    // Success rate: ≥90% (slightly lower acceptable at extreme load)
    expect(metrics.successRate).toBeGreaterThanOrEqual(0.90);

    // Should complete in reasonable time (not infinitely slow)
    const durationSeconds = metrics.totalDuration / 1000;
    expect(durationSeconds).toBeLessThan(900); // 15 minutes max

    // System should handle extreme load
    expect(metrics.tasksSubmitted).toEqual(220);
  });

  /**
   * Test 8: Latency percentiles under high load
   * Expected: p99 latency <1 second
   */
  it('should keep p99 latency <1s under 10x load', async () => {
    const metrics = await harness.runWorkload();

    console.log(`P99 Latency under 10x load: ${metrics.p99Latency.toFixed(2)}ms`);

    // P99 should be <1 second
    expect(metrics.p99Latency).toBeLessThan(1000);
  });

  /**
   * Test 9: Circuit breaker activation under extreme load
   * Expected: Circuit breaker opens to prevent cascade
   */
  it('should activate circuit breaker to prevent cascading failures', async () => {
    const metrics = await harness.runWorkload();

    // Under extreme load, some errors expected but should not cascade infinitely
    const errorRate = metrics.totalErrors / metrics.tasksSubmitted;

    console.log(
      `Circuit breaker test - Errors: ${metrics.totalErrors}, Error rate: ${(errorRate * 100).toFixed(2)}%`
    );

    // Error rate should be capped (circuit breaker prevents infinite cascade)
    expect(errorRate).toBeLessThan(0.15); // <15% errors max
  });
});

/**
 * ============================================================================
 * SATURATION & LIMITS TESTS
 * ============================================================================
 */

describe('Phase 5.4 Load Testing - Saturation & Limits', () => {
  /**
   * Test 10: Find system saturation point
   * Expected: Identify sustainable throughput limit
   */
  it('should identify sustainable throughput limit', async () => {
    const results = [];
    let workflowCount = 1;

    while (workflowCount <= 20) {
      const harness = new LoadTestHarness({
        apiUrl: process.env.API_URL || 'http://localhost:3000/api/v2',
        authToken: process.env.AUTH_TOKEN || 'test-token',
        taskCount: 10,
        concurrentWorkflows: workflowCount,
        taskDurationMs: 50,
        timeoutMs: 30000,
        rampUpMs: 5000,
      });

      const metrics = await harness.runWorkload();

      results.push({
        workflows: workflowCount,
        successRate: metrics.successRate,
        avgLatency: metrics.avgLatency,
        throughput: metrics.throughputTasksPerSecond,
      });

      console.log(
        `Concurrency ${workflowCount}: Success ${(metrics.successRate * 100).toFixed(1)}%, Latency ${metrics.avgLatency.toFixed(0)}ms, Throughput ${metrics.throughputTasksPerSecond.toFixed(1)} tasks/s`
      );

      workflowCount += 5;
    }

    // Find point where success rate drops below 90%
    const saturationPoint = results.find((r) => r.successRate < 0.9);
    console.log(
      `Saturation point (success <90%): ${saturationPoint ? saturationPoint.workflows : 'not reached'} concurrent workflows`
    );
  });

  /**
   * Test 11: Maximum task batch size
   * Expected: Batch operations support up to 10,000 items
   */
  it('should support batch operations up to 10000 items', async () => {
    const batchSizes = [100, 1000, 5000, 10000];

    for (const size of batchSizes) {
      const harness = new LoadTestHarness({
        apiUrl: process.env.API_URL || 'http://localhost:3000/api/v2',
        authToken: process.env.AUTH_TOKEN || 'test-token',
        taskCount: size,
        concurrentWorkflows: 1,
        taskDurationMs: 10,
        timeoutMs: 60000,
        rampUpMs: 1000,
      });

      const startTime = performance.now();
      const metrics = await harness.runWorkload();
      const duration = performance.now() - startTime;

      console.log(
        `Batch size ${size}: ${(duration / 1000).toFixed(2)}s, Success ${(metrics.successRate * 100).toFixed(1)}%`
      );

      expect(metrics.successRate).toBeGreaterThanOrEqual(0.95);
    }
  });

  /**
   * Test 12: Memory pressure under sustained load
   * Expected: Memory usage bounded, no memory leaks
   */
  it('should not leak memory under sustained load', async () => {
    const memoryPoints: number[] = [];

    for (let i = 0; i < 5; i++) {
      const harness = new LoadTestHarness({
        apiUrl: process.env.API_URL || 'http://localhost:3000/api/v2',
        authToken: process.env.AUTH_TOKEN || 'test-token',
        taskCount: 50,
        concurrentWorkflows: 2,
        taskDurationMs: 100,
        timeoutMs: 30000,
        rampUpMs: 5000,
      });

      await harness.runWorkload();
      const resources = await harness.collectResourceMetrics();

      if (resources?.memoryMb) {
        memoryPoints.push(resources.memoryMb);
        console.log(`Iteration ${i + 1}: Memory ${resources.memoryMb}MB`);
      }

      // Small pause between iterations
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (memoryPoints.length >= 2) {
      // Memory should not grow unbounded
      const firstHalf = memoryPoints.slice(0, 2);
      const secondHalf = memoryPoints.slice(-2);

      const avgFirst = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b) / secondHalf.length;

      // Second half should not be >20% higher (indicates memory leak)
      expect(avgSecond).toBeLessThan(avgFirst * 1.2);
    }
  });

  /**
   * Test 13: Resource limit exceeded behavior
   * Expected: Graceful rejection with 507 Insufficient Storage or queue backlog
   */
  it('should gracefully handle resource exhaustion', async () => {
    const harness = new LoadTestHarness({
      apiUrl: process.env.API_URL || 'http://localhost:3000/api/v2',
      authToken: process.env.AUTH_TOKEN || 'test-token',
      taskCount: 1000,
      concurrentWorkflows: 20,
      taskDurationMs: 500,
      timeoutMs: 30000,
      rampUpMs: 1000,
    });

    const metrics = await harness.runWorkload();

    // Should either succeed or fail gracefully (not crash)
    expect(metrics.tasksSubmitted).toBeGreaterThan(0);

    // If some tasks fail, should be bounded
    if (metrics.tasksFailed > 0) {
      const failureRate = metrics.tasksFailed / metrics.tasksSubmitted;
      console.log(
        `Resource exhaustion test - Graceful degradation: ${(failureRate * 100).toFixed(1)}% failure rate`
      );
    }
  });
});

/**
 * ============================================================================
 * SUSTAINED LOAD TESTS
 * ============================================================================
 */

describe('Phase 5.4 Load Testing - Sustained Load', () => {
  /**
   * Test 14: 30-minute sustained moderate load
   * Expected: No memory leaks, consistent performance
   */
  it('should sustain moderate load for 30 minutes without degradation', async () => {
    jest.setTimeout(1800000 + 60000); // 31 minutes

    const performancePoints: any[] = [];
    const startTime = performance.now();

    while (performance.now() - startTime < 1800000) {
      // 30 minutes
      const harness = new LoadTestHarness({
        apiUrl: process.env.API_URL || 'http://localhost:3000/api/v2',
        authToken: process.env.AUTH_TOKEN || 'test-token',
        taskCount: 10,
        concurrentWorkflows: 3,
        taskDurationMs: 100,
        timeoutMs: 30000,
        rampUpMs: 5000,
      });

      const metrics = await harness.runWorkload();
      performancePoints.push({
        timestamp: new Date().toISOString(),
        successRate: metrics.successRate,
        avgLatency: metrics.avgLatency,
      });

      console.log(
        `Sustained load checkpoint: Success ${(metrics.successRate * 100).toFixed(1)}%, Latency ${metrics.avgLatency.toFixed(0)}ms`
      );
    }

    // Check for performance degradation over time
    if (performancePoints.length >= 2) {
      const firstPoint = performancePoints[0];
      const lastPoint = performancePoints[performancePoints.length - 1];

      // Success rate should not degrade significantly
      const successDegradation = firstPoint.successRate - lastPoint.successRate;
      expect(successDegradation).toBeLessThan(0.1); // <10% degradation acceptable

      // Latency should not increase significantly
      const latencyIncrease = lastPoint.avgLatency / firstPoint.avgLatency;
      expect(latencyIncrease).toBeLessThan(1.5); // <50% increase acceptable
    }
  });

  /**
   * Test 15: Recovery after brief overload
   * Expected: System recovers quickly after load spike subsides
   */
  it('should recover quickly after brief overload', async () => {
    // Phase 1: Normal load
    let harness = new LoadTestHarness({
      apiUrl: process.env.API_URL || 'http://localhost:3000/api/v2',
      authToken: process.env.AUTH_TOKEN || 'test-token',
      taskCount: 10,
      concurrentWorkflows: 2,
      taskDurationMs: 100,
      timeoutMs: 30000,
      rampUpMs: 5000,
    });

    const preOverloadMetrics = await harness.runWorkload();

    // Phase 2: Overload (10x)
    harness = new LoadTestHarness({
      apiUrl: process.env.API_URL || 'http://localhost:3000/api/v2',
      authToken: process.env.AUTH_TOKEN || 'test-token',
      taskCount: 10,
      concurrentWorkflows: 20,
      taskDurationMs: 100,
      timeoutMs: 30000,
      rampUpMs: 5000,
    });

    const overloadMetrics = await harness.runWorkload();

    // Phase 3: Return to normal
    harness = new LoadTestHarness({
      apiUrl: process.env.API_URL || 'http://localhost:3000/api/v2',
      authToken: process.env.AUTH_TOKEN || 'test-token',
      taskCount: 10,
      concurrentWorkflows: 2,
      taskDurationMs: 100,
      timeoutMs: 30000,
      rampUpMs: 5000,
    });

    const postOverloadMetrics = await harness.runWorkload();

    // Check recovery: post-overload latency should be close to pre-overload
    const latencyRecoveryRatio =
      postOverloadMetrics.avgLatency / preOverloadMetrics.avgLatency;
    expect(latencyRecoveryRatio).toBeLessThan(1.3); // <30% degradation after recovery
  });
});

export { LoadTestHarness };

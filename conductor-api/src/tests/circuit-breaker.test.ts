/**
 * Circuit Breaker Service Tests
 * Comprehensive test suite covering state transitions, metrics, and event emissions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CircuitBreakerService } from '../services/circuit-breaker';
import type { CircuitBreakerConfig } from '../types/circuit-breaker.types';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;
  const testServiceName = 'test-service';
  const defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 3,
    successThreshold: 2,
    timeoutMs: 100, // Short timeout for testing
    monitoringWindowMs: 300000,
  };

  beforeEach(() => {
    service = new CircuitBreakerService();
  });

  afterEach(() => {
    service.removeAllListeners();
  });

  // Test 1: Initialize circuit breaker
  it('should initialize a circuit breaker in closed state', async () => {
    const result = await service.initializeCircuitBreaker(testServiceName, defaultConfig);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.state).toBe('closed');
    expect(result.data?.failureCount).toBe(0);
  });

  // Test 2: Prevent duplicate initialization
  it('should not allow duplicate initialization of same service', async () => {
    await service.initializeCircuitBreaker(testServiceName, defaultConfig);
    const result = await service.initializeCircuitBreaker(testServiceName, defaultConfig);

    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  // Test 3: Record failure and track count
  it('should record failures and increment failure count', async () => {
    await service.initializeCircuitBreaker(testServiceName, defaultConfig);

    const result = await service.recordFailure(testServiceName, new Error('Test error'));

    expect(result.success).toBe(true);
    expect(result.data?.failureCount).toBe(1);
  });

  // Test 4: Transition to OPEN when threshold reached
  it('should transition to OPEN state when failure threshold is exceeded', async () => {
    await service.initializeCircuitBreaker(testServiceName, defaultConfig);

    // Record failures up to threshold
    for (let i = 0; i < defaultConfig.failureThreshold; i++) {
      await service.recordFailure(testServiceName);
    }

    const result = await service.getCircuitBreakerState(testServiceName);

    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('open');
  });

  // Test 5: Record success in CLOSED state
  it('should record success and reset failure count in CLOSED state', async () => {
    await service.initializeCircuitBreaker(testServiceName, defaultConfig);

    // Record a failure
    await service.recordFailure(testServiceName);
    let state = await service.getCircuitBreakerState(testServiceName);
    expect(state.data?.failureCount).toBe(1);

    // Record success
    await service.recordSuccess(testServiceName);
    state = await service.getCircuitBreakerState(testServiceName);

    expect(state.data?.state).toBe('closed');
    expect(state.data?.failureCount).toBe(0);
  });

  // Test 6: Transition from OPEN to HALF_OPEN after timeout
  it('should transition from OPEN to HALF_OPEN after timeout expires', async () => {
    await service.initializeCircuitBreaker(testServiceName, defaultConfig);

    // Open the circuit
    for (let i = 0; i < defaultConfig.failureThreshold; i++) {
      await service.recordFailure(testServiceName);
    }

    let state = await service.getCircuitBreakerState(testServiceName);
    expect(state.data?.state).toBe('open');

    // Wait for timeout
    await new Promise((resolve) => setTimeout(resolve, defaultConfig.timeoutMs + 50));

    // Check state again
    state = await service.getCircuitBreakerState(testServiceName);
    expect(state.data?.state).toBe('half_open');
  });

  // Test 7: Transition from HALF_OPEN to CLOSED on success
  it('should transition from HALF_OPEN to CLOSED when success threshold is met', async () => {
    await service.initializeCircuitBreaker(testServiceName, defaultConfig);

    // Open the circuit
    for (let i = 0; i < defaultConfig.failureThreshold; i++) {
      await service.recordFailure(testServiceName);
    }

    // Wait for timeout to transition to HALF_OPEN
    await new Promise((resolve) => setTimeout(resolve, defaultConfig.timeoutMs + 50));
    let state = await service.getCircuitBreakerState(testServiceName);
    expect(state.data?.state).toBe('half_open');

    // Record successes
    for (let i = 0; i < defaultConfig.successThreshold; i++) {
      await service.recordSuccess(testServiceName);
    }

    state = await service.getCircuitBreakerState(testServiceName);
    expect(state.data?.state).toBe('closed');
  });

  // Test 8: Transition from HALF_OPEN back to OPEN on failure
  it('should transition back to OPEN from HALF_OPEN on any failure', async () => {
    await service.initializeCircuitBreaker(testServiceName, defaultConfig);

    // Open the circuit
    for (let i = 0; i < defaultConfig.failureThreshold; i++) {
      await service.recordFailure(testServiceName);
    }

    // Wait for timeout
    await new Promise((resolve) => setTimeout(resolve, defaultConfig.timeoutMs + 50));
    let state = await service.getCircuitBreakerState(testServiceName);
    expect(state.data?.state).toBe('half_open');

    // Record one failure
    await service.recordFailure(testServiceName);

    state = await service.getCircuitBreakerState(testServiceName);
    expect(state.data?.state).toBe('open');
  });

  // Test 9: Reset circuit breaker
  it('should reset circuit breaker to closed state', async () => {
    await service.initializeCircuitBreaker(testServiceName, defaultConfig);

    // Open the circuit
    for (let i = 0; i < defaultConfig.failureThreshold; i++) {
      await service.recordFailure(testServiceName);
    }

    let state = await service.getCircuitBreakerState(testServiceName);
    expect(state.data?.state).toBe('open');

    // Reset
    const resetResult = await service.resetCircuitBreaker(testServiceName);
    expect(resetResult.success).toBe(true);

    state = await service.getCircuitBreakerState(testServiceName);
    expect(state.data?.state).toBe('closed');
    expect(state.data?.failureCount).toBe(0);
  });

  // Test 10: Update configuration
  it('should update circuit breaker configuration', async () => {
    await service.initializeCircuitBreaker(testServiceName, defaultConfig);

    const newConfig = {
      failureThreshold: 10,
      successThreshold: 5,
    };

    const result = await service.updateCircuitBreakerConfig(testServiceName, newConfig);
    expect(result.success).toBe(true);

    // Verify new threshold is applied
    for (let i = 0; i < 9; i++) {
      await service.recordFailure(testServiceName);
    }

    let state = await service.getCircuitBreakerState(testServiceName);
    expect(state.data?.state).toBe('closed'); // Should still be closed with old threshold

    await service.recordFailure(testServiceName);
    state = await service.getCircuitBreakerState(testServiceName);
    expect(state.data?.state).toBe('open'); // Now open with new threshold
  });

  // Test 11: Auto-initialize on first failure
  it('should auto-initialize circuit breaker on first failure', async () => {
    // Don't explicitly initialize
    const result = await service.recordFailure(testServiceName);

    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('closed');
    expect(result.data?.failureCount).toBe(1);
  });

  // Test 12: Metrics collection
  it('should collect accurate metrics', async () => {
    await service.initializeCircuitBreaker(testServiceName, defaultConfig);

    // Record some activities
    await service.recordSuccess(testServiceName);
    await service.recordSuccess(testServiceName);
    await service.recordFailure(testServiceName);

    const metrics = service.getMetrics(testServiceName);

    expect(metrics).toBeDefined();
    expect(metrics?.totalRequests).toBe(3);
    expect(metrics?.successfulRequests).toBe(2);
    expect(metrics?.failedRequests).toBe(1);
    expect(metrics?.failureRate).toBeCloseTo(1 / 3, 5);
  });

  // Test 13: Get all metrics
  it('should return all circuit breaker metrics', async () => {
    const service2 = 'test-service-2';

    await service.initializeCircuitBreaker(testServiceName, defaultConfig);
    await service.initializeCircuitBreaker(service2, defaultConfig);

    await service.recordSuccess(testServiceName);
    await service.recordFailure(service2);

    const allMetrics = service.getAllMetrics();

    expect(allMetrics.length).toBe(2);
    expect(allMetrics.some((m) => m.serviceName === testServiceName)).toBe(true);
    expect(allMetrics.some((m) => m.serviceName === service2)).toBe(true);
  });

  // Test 14: Service availability check
  it('should report service availability correctly', async () => {
    await service.initializeCircuitBreaker(testServiceName, defaultConfig);

    // Closed = available
    let available = await service.isServiceAvailable(testServiceName);
    expect(available).toBe(true);

    // Open = not available
    for (let i = 0; i < defaultConfig.failureThreshold; i++) {
      await service.recordFailure(testServiceName);
    }
    available = await service.isServiceAvailable(testServiceName);
    expect(available).toBe(false);

    // Half-open = available
    await new Promise((resolve) => setTimeout(resolve, defaultConfig.timeoutMs + 50));
    available = await service.isServiceAvailable(testServiceName);
    expect(available).toBe(true);
  });

  // Test 15: Event emission on state change
  it('should emit events on state transitions', async () => {
    const events: string[] = [];

    service.on('event', (event) => {
      events.push(event.eventType);
    });

    await service.initializeCircuitBreaker(testServiceName, defaultConfig);

    // Should emit 'closed' on init
    expect(events).toContain('closed');

    // Record failures to trigger 'opened'
    for (let i = 0; i < defaultConfig.failureThreshold; i++) {
      await service.recordFailure(testServiceName);
    }

    expect(events).toContain('opened');
    expect(events).toContain('failure');
  });

  // Test 16: Get all circuit breaker states
  it('should return all circuit breaker states', async () => {
    const service2 = 'test-service-2';

    await service.initializeCircuitBreaker(testServiceName, defaultConfig);
    await service.initializeCircuitBreaker(service2, defaultConfig);

    await service.recordFailure(service2);

    const allStates = await service.getAllCircuitBreakerStates();

    expect(allStates.success).toBe(true);
    expect(allStates.data?.length).toBe(2);
    expect(allStates.data?.some((s) => s.serviceName === testServiceName)).toBe(true);
    expect(allStates.data?.some((s) => s.serviceName === service2)).toBe(true);
  });

  // Test 17: Next retry time is set on OPEN
  it('should set nextRetryAt when transitioning to OPEN', async () => {
    await service.initializeCircuitBreaker(testServiceName, defaultConfig);

    for (let i = 0; i < defaultConfig.failureThreshold; i++) {
      await service.recordFailure(testServiceName);
    }

    const state = await service.getCircuitBreakerState(testServiceName);

    expect(state.data?.nextRetryAt).toBeDefined();
    expect(state.data?.nextRetryAt).toBeInstanceOf(Date);
  });

  // Test 18: Failure count reset on state transition
  it('should reset failure count when transitioning to HALF_OPEN', async () => {
    await service.initializeCircuitBreaker(testServiceName, defaultConfig);

    // Open the circuit
    for (let i = 0; i < defaultConfig.failureThreshold; i++) {
      await service.recordFailure(testServiceName);
    }

    let state = await service.getCircuitBreakerState(testServiceName);
    expect(state.data?.failureCount).toBe(defaultConfig.failureThreshold);

    // Transition to HALF_OPEN
    await new Promise((resolve) => setTimeout(resolve, defaultConfig.timeoutMs + 50));
    state = await service.getCircuitBreakerState(testServiceName);

    expect(state.data?.state).toBe('half_open');
    expect(state.data?.failureCount).toBe(0);
  });

  // Test 19: Detailed state information
  it('should track last failure and success timestamps', async () => {
    await service.initializeCircuitBreaker(testServiceName, defaultConfig);

    const beforeFailure = new Date();
    await service.recordFailure(testServiceName);
    const afterFailure = new Date();

    let state = await service.getCircuitBreakerState(testServiceName);

    expect(state.data?.lastFailureAt).toBeDefined();
    expect(state.data?.lastFailureAt!.getTime()).toBeGreaterThanOrEqual(beforeFailure.getTime());
    expect(state.data?.lastFailureAt!.getTime()).toBeLessThanOrEqual(afterFailure.getTime());

    const beforeSuccess = new Date();
    await service.recordSuccess(testServiceName);
    const afterSuccess = new Date();

    const metrics = service.getMetrics(testServiceName);
    expect(metrics?.successfulRequests).toBe(1);
  });

  // Test 20: Non-existent service handling
  it('should handle queries for non-existent services gracefully', async () => {
    const result = await service.getCircuitBreakerState('non-existent');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

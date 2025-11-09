/**
 * Metrics Collector Unit Tests
 * Tests for metrics collection, aggregation, and retrieval across all systems
 */

import { MetricsCollector, createMetricsCollector, getMetricsCollector } from '../services/metrics-collector.js';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = createMetricsCollector();
  });

  describe('Error Recovery Metrics', () => {
    it('should track retry attempts correctly', () => {
      collector.recordRetryAttempt(100, true);
      collector.recordRetryAttempt(150, true);
      collector.recordRetryAttempt(200, false);

      const metrics = collector.getErrorRecoveryOnly();

      expect(metrics.totalRetries.value).toBe(3);
      expect(metrics.successfulRetries.value).toBe(2);
      expect(metrics.failedRetries.value).toBe(1);
    });

    it('should calculate retry duration histogram statistics', () => {
      const durations = [50, 100, 150, 200, 250];
      durations.forEach(d => collector.recordRetryAttempt(d, true));

      const metrics = collector.getErrorRecoveryOnly();
      const histogram = metrics.averageRetryDuration;

      expect(histogram.count).toBe(5);
      expect(histogram.min).toBe(50);
      expect(histogram.max).toBe(250);
      expect(histogram.sum).toBe(750);
      expect(histogram.average).toBe(150);
      expect(histogram.p50).toBe(150);
    });

    it('should track circuit breaker states', () => {
      collector.recordCircuitBreakerState('cb1', 'closed');
      collector.recordCircuitBreakerState('cb2', 'open');
      collector.recordCircuitBreakerState('cb3', 'halfOpen');
      collector.recordCircuitBreakerState('cb1', 'open');

      const metrics = collector.getErrorRecoveryOnly();

      expect(metrics.circuitBreakerStates.closed.value).toBe(0);
      expect(metrics.circuitBreakerStates.open.value).toBe(2);
      expect(metrics.circuitBreakerStates.halfOpen.value).toBe(1);
    });
  });

  describe('Scheduler Metrics', () => {
    it('should track schedule creation', () => {
      collector.recordScheduleCreated();
      collector.recordScheduleCreated();

      const metrics = collector.getSchedulerOnly();
      expect(metrics.totalSchedules.value).toBe(2);
    });

    it('should track schedule execution', () => {
      collector.recordScheduleExecution(100, true);
      collector.recordScheduleExecution(150, true);
      collector.recordScheduleExecution(200, false);

      const metrics = collector.getSchedulerOnly();

      expect(metrics.totalExecutions.value).toBe(3);
      expect(metrics.successfulExecutions.value).toBe(2);
      expect(metrics.failedExecutions.value).toBe(1);
    });

    it('should calculate execution duration distribution', () => {
      const durations = [100, 200, 300, 400, 500];
      durations.forEach(d => collector.recordScheduleExecution(d, true));

      const metrics = collector.getSchedulerOnly();
      const histogram = metrics.averageExecutionDuration;

      expect(histogram.count).toBe(5);
      expect(histogram.min).toBe(100);
      expect(histogram.max).toBe(500);
      expect(histogram.average).toBe(300);
    });

    it('should track next execution time distribution', () => {
      const times = [1000, 2000, 3000, 4000, 5000];
      times.forEach(t => collector.recordNextExecutionTime(t));

      const metrics = collector.getSchedulerOnly();
      const histogram = metrics.nextExecutionTimeDistribution;

      expect(histogram.count).toBe(5);
      expect(histogram.min).toBe(1000);
      expect(histogram.max).toBe(5000);
      expect(histogram.average).toBe(3000);
    });
  });

  describe('Webhook Metrics', () => {
    it('should track webhook creation', () => {
      collector.recordWebhookCreated();
      collector.recordWebhookCreated();

      const metrics = collector.getWebhooksOnly();
      expect(metrics.totalWebhooks.value).toBe(2);
    });

    it('should track webhook deliveries', () => {
      collector.recordWebhookDelivery(100, true, 0);
      collector.recordWebhookDelivery(150, true, 1);
      collector.recordWebhookDelivery(200, false, 3);

      const metrics = collector.getWebhooksOnly();

      expect(metrics.totalDeliveries.value).toBe(3);
      expect(metrics.successfulDeliveries.value).toBe(2);
      expect(metrics.failedDeliveries.value).toBe(1);
    });

    it('should track delivery duration distribution', () => {
      const durations = [50, 100, 150, 200, 250];
      durations.forEach(d => collector.recordWebhookDelivery(d, true, 0));

      const metrics = collector.getWebhooksOnly();
      const histogram = metrics.averageDeliveryDuration;

      expect(histogram.count).toBe(5);
      expect(histogram.min).toBe(50);
      expect(histogram.max).toBe(250);
      expect(histogram.average).toBe(150);
    });

    it('should track retry count distribution', () => {
      collector.recordWebhookDelivery(100, true, 0);
      collector.recordWebhookDelivery(150, false, 1);
      collector.recordWebhookDelivery(200, false, 3);
      collector.recordWebhookDelivery(250, false, 5);

      const metrics = collector.getWebhooksOnly();
      const histogram = metrics.retryCountDistribution;

      expect(histogram.count).toBe(4);
      expect(histogram.min).toBe(0);
      expect(histogram.max).toBe(5);
      expect(histogram.average).toBe(2.25);
    });
  });

  describe('System Metrics', () => {
    it('should track request metrics', () => {
      collector.recordRequest(100, 200);
      collector.recordRequest(150, 200);
      collector.recordRequest(200, 500);

      const metrics = collector.getSystemOnly();

      expect(metrics.requestRate.value).toBe(3);
      expect(metrics.errorRate.value).toBeCloseTo(33.33, 1);
    });

    it('should track response time distribution', () => {
      const durations = [50, 100, 150, 200, 250];
      durations.forEach((d, i) => collector.recordRequest(d, i % 2 === 0 ? 200 : 500));

      const metrics = collector.getSystemOnly();
      const histogram = metrics.averageResponseTime;

      expect(histogram.count).toBe(5);
      expect(histogram.min).toBe(50);
      expect(histogram.max).toBe(250);
      expect(histogram.average).toBe(150);
    });

    it('should track active connections', () => {
      collector.recordConnectionChange(5);
      expect(collector.getSystemOnly().activeConnections.value).toBe(5);

      collector.recordConnectionChange(3);
      expect(collector.getSystemOnly().activeConnections.value).toBe(8);

      collector.recordConnectionChange(-2);
      expect(collector.getSystemOnly().activeConnections.value).toBe(6);
    });

    it('should not allow negative connection count', () => {
      collector.recordConnectionChange(-10);
      expect(collector.getSystemOnly().activeConnections.value).toBe(0);
    });
  });

  describe('Aggregation Window', () => {
    it('should set aggregation window to 1 minute', () => {
      collector.setAggregationWindow('1m');
      const metrics = collector.getAggregatedMetrics();

      expect(metrics.window.window).toBe('1m');
      expect(metrics.window.startTime instanceof Date).toBe(true);
      expect(metrics.window.endTime instanceof Date).toBe(true);
    });

    it('should set aggregation window to 5 minutes', () => {
      collector.setAggregationWindow('5m');
      const metrics = collector.getAggregatedMetrics();

      expect(metrics.window.window).toBe('5m');
    });

    it('should set aggregation window to 1 hour', () => {
      collector.setAggregationWindow('1h');
      const metrics = collector.getAggregatedMetrics();

      expect(metrics.window.window).toBe('1h');
    });
  });

  describe('Aggregated Metrics', () => {
    it('should return complete aggregated metrics', () => {
      // Record some metrics
      collector.recordRetryAttempt(100, true);
      collector.recordScheduleCreated();
      collector.recordScheduleExecution(200, true);
      collector.recordWebhookCreated();
      collector.recordWebhookDelivery(150, true, 0);
      collector.recordRequest(100, 200);

      const metrics = collector.getAggregatedMetrics();

      expect(metrics.timestamp instanceof Date).toBe(true);
      expect(metrics.errorRecovery).toBeDefined();
      expect(metrics.scheduler).toBeDefined();
      expect(metrics.webhooks).toBeDefined();
      expect(metrics.system).toBeDefined();
    });

    it('should include window information in aggregated metrics', () => {
      collector.setAggregationWindow('5m');
      const metrics = collector.getAggregatedMetrics();

      expect(metrics.window.window).toBe('5m');
      expect(metrics.window.startTime instanceof Date).toBe(true);
      expect(metrics.window.endTime instanceof Date).toBe(true);
    });
  });

  describe('Metrics Reset', () => {
    it('should reset all metrics', () => {
      collector.recordRetryAttempt(100, true);
      collector.recordScheduleCreated();
      collector.recordWebhookCreated();
      collector.recordRequest(100, 200);

      let metrics = collector.getAggregatedMetrics();
      expect(metrics.errorRecovery.totalRetries.value).toBe(1);
      expect(metrics.scheduler.totalSchedules.value).toBe(1);
      expect(metrics.webhooks.totalWebhooks.value).toBe(1);
      expect(metrics.system.requestRate.value).toBe(1);

      collector.resetMetrics();

      metrics = collector.getAggregatedMetrics();
      expect(metrics.errorRecovery.totalRetries.value).toBe(0);
      expect(metrics.scheduler.totalSchedules.value).toBe(0);
      expect(metrics.webhooks.totalWebhooks.value).toBe(0);
      expect(metrics.system.requestRate.value).toBe(0);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance for getMetricsCollector', () => {
      const instance1 = getMetricsCollector();
      const instance2 = getMetricsCollector();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance with createMetricsCollector', () => {
      const instance1 = createMetricsCollector();
      const instance2 = createMetricsCollector();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Events', () => {
    it('should emit retry attempt event', (done) => {
      collector.on('metric:retry-attempt', (data) => {
        expect(data.duration).toBe(100);
        expect(data.success).toBe(true);
        done();
      });

      collector.recordRetryAttempt(100, true);
    });

    it('should emit schedule execution event', (done) => {
      collector.on('metric:schedule-execution', (data) => {
        expect(data.duration).toBe(200);
        expect(data.success).toBe(true);
        done();
      });

      collector.recordScheduleExecution(200, true);
    });

    it('should emit webhook delivery event', (done) => {
      collector.on('metric:webhook-delivery', (data) => {
        expect(data.duration).toBe(150);
        expect(data.success).toBe(true);
        expect(data.retryCount).toBe(1);
        done();
      });

      collector.recordWebhookDelivery(150, true, 1);
    });

    it('should emit request event', (done) => {
      collector.on('metric:request', (data) => {
        expect(data.duration).toBe(100);
        expect(data.statusCode).toBe(200);
        done();
      });

      collector.recordRequest(100, 200);
    });

    it('should emit metrics reset event', (done) => {
      collector.on('metrics:reset', () => {
        done();
      });

      collector.resetMetrics();
    });
  });

  describe('Histogram Percentiles', () => {
    it('should calculate percentiles correctly', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      values.forEach(v => collector.recordRequest(v, 200));

      const metrics = collector.getSystemOnly();
      const histogram = metrics.averageResponseTime;

      expect(histogram.p50).toBeLessThanOrEqual(50);
      expect(histogram.p95).toBeLessThanOrEqual(100);
      expect(histogram.p99).toBeLessThanOrEqual(100);
    });

    it('should handle empty histogram', () => {
      const metrics = collector.getSystemOnly();
      const histogram = metrics.averageResponseTime;

      expect(histogram.count).toBe(0);
      expect(histogram.average).toBe(0);
      expect(histogram.p50).toBe(0);
    });

    it('should handle single value histogram', () => {
      collector.recordRequest(100, 200);

      const metrics = collector.getSystemOnly();
      const histogram = metrics.averageResponseTime;

      expect(histogram.count).toBe(1);
      expect(histogram.min).toBe(100);
      expect(histogram.max).toBe(100);
      expect(histogram.average).toBe(100);
      expect(histogram.p50).toBe(100);
    });
  });
});

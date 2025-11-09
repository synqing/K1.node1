/**
 * Metrics Collector Service
 * Collects and aggregates metrics for error recovery, scheduler, webhooks, and system
 */

import { EventEmitter } from 'events';

export interface Counter {
  value: number;
  lastUpdated: Date;
}

export interface Histogram {
  values: number[];
  min: number;
  max: number;
  sum: number;
  count: number;
  average: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface Gauge {
  value: number;
  lastUpdated: Date;
}

export interface TimeWindow {
  window: '1m' | '5m' | '1h';
  startTime: Date;
  endTime: Date;
}

export interface ErrorRecoveryMetrics {
  totalRetries: Counter;
  successfulRetries: Counter;
  failedRetries: Counter;
  averageRetryDuration: Histogram;
  circuitBreakerStates: {
    closed: Gauge;
    open: Gauge;
    halfOpen: Gauge;
  };
}

export interface SchedulerMetrics {
  totalSchedules: Counter;
  totalExecutions: Counter;
  successfulExecutions: Counter;
  failedExecutions: Counter;
  averageExecutionDuration: Histogram;
  nextExecutionTimeDistribution: Histogram;
}

export interface WebhookMetrics {
  totalWebhooks: Counter;
  totalDeliveries: Counter;
  successfulDeliveries: Counter;
  failedDeliveries: Counter;
  retryCountDistribution: Histogram;
  averageDeliveryDuration: Histogram;
}

export interface SystemMetrics {
  activeConnections: Gauge;
  requestRate: Gauge;
  errorRate: Gauge;
  averageResponseTime: Histogram;
}

export interface AggregatedMetrics {
  timestamp: Date;
  window: TimeWindow;
  errorRecovery: ErrorRecoveryMetrics;
  scheduler: SchedulerMetrics;
  webhooks: WebhookMetrics;
  system: SystemMetrics;
}

/**
 * Helper function to calculate histogram statistics
 */
function calculateHistogramStats(values: number[]): Omit<Histogram, 'values'> {
  if (values.length === 0) {
    return {
      min: 0,
      max: 0,
      sum: 0,
      count: 0,
      average: 0,
      p50: 0,
      p95: 0,
      p99: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const average = sum / sorted.length;

  const percentile = (p: number): number => {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  };

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    sum,
    count: sorted.length,
    average,
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
  };
}

/**
 * Metrics Collector Service
 * Collects, aggregates, and manages metrics across multiple systems
 */
export class MetricsCollector extends EventEmitter {
  private errorRecoveryMetrics: {
    retries: number[] = [];
    successfulRetries: number = 0;
    failedRetries: number = 0;
    retryDurations: number[] = [];
    circuitBreakerStates: Map<string, 'closed' | 'open' | 'halfOpen'> = new Map();
  };

  private schedulerMetrics: {
    schedules: number = 0;
    executions: number = 0;
    successfulExecutions: number = 0;
    failedExecutions: number = 0;
    executionDurations: number[] = [];
    nextExecutionTimes: number[] = [];
  };

  private webhookMetrics: {
    webhooks: number = 0;
    deliveries: number = 0;
    successfulDeliveries: number = 0;
    failedDeliveries: number = 0;
    retryCounts: number[] = [];
    deliveryDurations: number[] = [];
  };

  private systemMetrics: {
    activeConnections: number = 0;
    requests: number = 0;
    errors: number = 0;
    responseTimes: number[] = [];
    lastMinuteRequests: number = 0;
  };

  private aggregationWindow: TimeWindow = {
    window: '1m',
    startTime: new Date(),
    endTime: new Date(Date.now() + 60000),
  };

  constructor() {
    super();
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    this.errorRecoveryMetrics = {
      retries: [],
      successfulRetries: 0,
      failedRetries: 0,
      retryDurations: [],
      circuitBreakerStates: new Map(),
    };

    this.schedulerMetrics = {
      schedules: 0,
      executions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      executionDurations: [],
      nextExecutionTimes: [],
    };

    this.webhookMetrics = {
      webhooks: 0,
      deliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      retryCounts: [],
      deliveryDurations: [],
    };

    this.systemMetrics = {
      activeConnections: 0,
      requests: 0,
      errors: 0,
      responseTimes: [],
      lastMinuteRequests: 0,
    };
  }

  /**
   * Record a retry attempt
   */
  recordRetryAttempt(duration: number, success: boolean): void {
    this.errorRecoveryMetrics.retries.push(1);
    this.errorRecoveryMetrics.retryDurations.push(duration);

    if (success) {
      this.errorRecoveryMetrics.successfulRetries++;
    } else {
      this.errorRecoveryMetrics.failedRetries++;
    }

    this.emit('metric:retry-attempt', { duration, success });
  }

  /**
   * Record circuit breaker state
   */
  recordCircuitBreakerState(id: string, state: 'closed' | 'open' | 'halfOpen'): void {
    this.errorRecoveryMetrics.circuitBreakerStates.set(id, state);
    this.emit('metric:circuit-breaker-state', { id, state });
  }

  /**
   * Record schedule creation
   */
  recordScheduleCreated(): void {
    this.schedulerMetrics.schedules++;
    this.emit('metric:schedule-created');
  }

  /**
   * Record schedule execution
   */
  recordScheduleExecution(duration: number, success: boolean): void {
    this.schedulerMetrics.executions++;
    this.schedulerMetrics.executionDurations.push(duration);

    if (success) {
      this.schedulerMetrics.successfulExecutions++;
    } else {
      this.schedulerMetrics.failedExecutions++;
    }

    this.emit('metric:schedule-execution', { duration, success });
  }

  /**
   * Record next execution time (in ms from now)
   */
  recordNextExecutionTime(timeUntilExecution: number): void {
    this.schedulerMetrics.nextExecutionTimes.push(timeUntilExecution);
    this.emit('metric:next-execution-time', { timeUntilExecution });
  }

  /**
   * Record webhook creation
   */
  recordWebhookCreated(): void {
    this.webhookMetrics.webhooks++;
    this.emit('metric:webhook-created');
  }

  /**
   * Record webhook delivery
   */
  recordWebhookDelivery(duration: number, success: boolean, retryCount: number): void {
    this.webhookMetrics.deliveries++;
    this.webhookMetrics.deliveryDurations.push(duration);
    this.webhookMetrics.retryCounts.push(retryCount);

    if (success) {
      this.webhookMetrics.successfulDeliveries++;
    } else {
      this.webhookMetrics.failedDeliveries++;
    }

    this.emit('metric:webhook-delivery', { duration, success, retryCount });
  }

  /**
   * Record HTTP request
   */
  recordRequest(duration: number, statusCode: number): void {
    this.systemMetrics.requests++;
    this.systemMetrics.responseTimes.push(duration);
    this.systemMetrics.lastMinuteRequests++;

    if (statusCode >= 400) {
      this.systemMetrics.errors++;
    }

    this.emit('metric:request', { duration, statusCode });
  }

  /**
   * Record active connection change
   */
  recordConnectionChange(delta: number): void {
    this.systemMetrics.activeConnections = Math.max(0, this.systemMetrics.activeConnections + delta);
    this.emit('metric:connection-change', { activeConnections: this.systemMetrics.activeConnections });
  }

  /**
   * Set aggregation window
   */
  setAggregationWindow(window: '1m' | '5m' | '1h'): void {
    const now = new Date();
    const windowMs = window === '1m' ? 60000 : window === '5m' ? 300000 : 3600000;

    this.aggregationWindow = {
      window,
      startTime: new Date(now.getTime() - windowMs),
      endTime: now,
    };
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(): AggregatedMetrics {
    return {
      timestamp: new Date(),
      window: this.aggregationWindow,
      errorRecovery: this.getErrorRecoveryMetrics(),
      scheduler: this.getSchedulerMetrics(),
      webhooks: this.getWebhookMetrics(),
      system: this.getSystemMetrics(),
    };
  }

  /**
   * Get error recovery metrics
   */
  private getErrorRecoveryMetrics(): ErrorRecoveryMetrics {
    const totalRetries = this.errorRecoveryMetrics.retries.length;
    const cbStates = this.errorRecoveryMetrics.circuitBreakerStates;

    return {
      totalRetries: {
        value: totalRetries,
        lastUpdated: new Date(),
      },
      successfulRetries: {
        value: this.errorRecoveryMetrics.successfulRetries,
        lastUpdated: new Date(),
      },
      failedRetries: {
        value: this.errorRecoveryMetrics.failedRetries,
        lastUpdated: new Date(),
      },
      averageRetryDuration: {
        values: this.errorRecoveryMetrics.retryDurations,
        ...calculateHistogramStats(this.errorRecoveryMetrics.retryDurations),
      },
      circuitBreakerStates: {
        closed: {
          value: Array.from(cbStates.values()).filter(s => s === 'closed').length,
          lastUpdated: new Date(),
        },
        open: {
          value: Array.from(cbStates.values()).filter(s => s === 'open').length,
          lastUpdated: new Date(),
        },
        halfOpen: {
          value: Array.from(cbStates.values()).filter(s => s === 'halfOpen').length,
          lastUpdated: new Date(),
        },
      },
    };
  }

  /**
   * Get scheduler metrics
   */
  private getSchedulerMetrics(): SchedulerMetrics {
    return {
      totalSchedules: {
        value: this.schedulerMetrics.schedules,
        lastUpdated: new Date(),
      },
      totalExecutions: {
        value: this.schedulerMetrics.executions,
        lastUpdated: new Date(),
      },
      successfulExecutions: {
        value: this.schedulerMetrics.successfulExecutions,
        lastUpdated: new Date(),
      },
      failedExecutions: {
        value: this.schedulerMetrics.failedExecutions,
        lastUpdated: new Date(),
      },
      averageExecutionDuration: {
        values: this.schedulerMetrics.executionDurations,
        ...calculateHistogramStats(this.schedulerMetrics.executionDurations),
      },
      nextExecutionTimeDistribution: {
        values: this.schedulerMetrics.nextExecutionTimes,
        ...calculateHistogramStats(this.schedulerMetrics.nextExecutionTimes),
      },
    };
  }

  /**
   * Get webhook metrics
   */
  private getWebhookMetrics(): WebhookMetrics {
    return {
      totalWebhooks: {
        value: this.webhookMetrics.webhooks,
        lastUpdated: new Date(),
      },
      totalDeliveries: {
        value: this.webhookMetrics.deliveries,
        lastUpdated: new Date(),
      },
      successfulDeliveries: {
        value: this.webhookMetrics.successfulDeliveries,
        lastUpdated: new Date(),
      },
      failedDeliveries: {
        value: this.webhookMetrics.failedDeliveries,
        lastUpdated: new Date(),
      },
      retryCountDistribution: {
        values: this.webhookMetrics.retryCounts,
        ...calculateHistogramStats(this.webhookMetrics.retryCounts),
      },
      averageDeliveryDuration: {
        values: this.webhookMetrics.deliveryDurations,
        ...calculateHistogramStats(this.webhookMetrics.deliveryDurations),
      },
    };
  }

  /**
   * Get system metrics
   */
  private getSystemMetrics(): SystemMetrics {
    const totalRequests = this.systemMetrics.requests;
    const totalErrors = this.systemMetrics.errors;
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    return {
      activeConnections: {
        value: this.systemMetrics.activeConnections,
        lastUpdated: new Date(),
      },
      requestRate: {
        value: this.systemMetrics.lastMinuteRequests,
        lastUpdated: new Date(),
      },
      errorRate: {
        value: errorRate,
        lastUpdated: new Date(),
      },
      averageResponseTime: {
        values: this.systemMetrics.responseTimes,
        ...calculateHistogramStats(this.systemMetrics.responseTimes),
      },
    };
  }

  /**
   * Reset metrics for a new aggregation period
   */
  resetMetrics(): void {
    this.initializeMetrics();
    this.emit('metrics:reset');
  }

  /**
   * Get only error recovery metrics
   */
  getErrorRecoveryOnly(): ErrorRecoveryMetrics {
    return this.getErrorRecoveryMetrics();
  }

  /**
   * Get only scheduler metrics
   */
  getSchedulerOnly(): SchedulerMetrics {
    return this.getSchedulerMetrics();
  }

  /**
   * Get only webhook metrics
   */
  getWebhooksOnly(): WebhookMetrics {
    return this.getWebhookMetrics();
  }

  /**
   * Get only system metrics
   */
  getSystemOnly(): SystemMetrics {
    return this.getSystemMetrics();
  }
}

/**
 * Create a singleton instance of the metrics collector
 */
let collectorInstance: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!collectorInstance) {
    collectorInstance = new MetricsCollector();
  }
  return collectorInstance;
}

export function createMetricsCollector(): MetricsCollector {
  return new MetricsCollector();
}

/**
 * Task 3.3.3: Data Collection Service
 * Metrics aggregation service bridging Phase 5.3.1-2 backend to React dashboard
 *
 * This service:
 * 1. Defines metrics interfaces consumed by dashboard components
 * 2. Provides HTTP endpoints for fetching metrics from backend
 * 3. Exports mock data generators for development/testing
 * 4. Handles metrics aggregation and transformation
 * 5. Integrates with Redux store via custom hooks
 */

import { ApiClient } from './api';
import {
  RetryMetrics,
  CircuitBreakerState,
  DLQEntry,
  QueueStatus,
  ResourceMetrics,
  ResourceLimits,
  Schedule,
  TaskState,
} from '../types/dashboard';

/**
 * ============================================================================
 * INTERFACE DEFINITIONS (contracts for Tasks 3.3.4 & 3.3.5)
 * ============================================================================
 */

/**
 * Aggregated scheduling metrics
 * Used by: Task 3.3.4 (Gantt Chart), Task 3.3.5 (Analytics Panels)
 */
export interface ScheduleMetricsData {
  schedules: Schedule[];
  queueStatus: QueueStatus;
  resourceUsage: ResourceMetrics;
  resourceLimits: ResourceLimits;
  topPrioritySched: Schedule | null;
  failureRate: number; // 0-100
  averageExecutionTime: number; // ms
  tasksExecutedToday: number;
  tasksFailedToday: number;
}

/**
 * Aggregated error recovery metrics
 * Used by: Task 3.3.5 (Analytics Panels)
 */
export interface ErrorRecoveryMetricsData {
  retryMetrics: RetryMetrics;
  circuitBreakers: CircuitBreakerState[];
  dlqStats: {
    total: number;
    pending: number;
    deadLettered: number;
    successRate: number; // 0-100
  };
  interventions: Array<{
    taskId: string;
    type: 'pause' | 'resume' | 'skip' | 'retry';
    timestamp: string;
    reason: string;
  }>;
  topFailingTasks: Array<{
    taskId: string;
    failureCount: number;
    lastFailure: string;
  }>;
}

/**
 * ============================================================================
 * MOCK DATA GENERATORS (for Tasks 3.3.4 & 3.3.5 to use during development)
 * ============================================================================
 */

export const MOCK_SCHEDULES: Schedule[] = [
  {
    id: 'backup-daily',
    name: 'Daily Backup',
    type: 'cron',
    pattern: '0 2 * * *',
    enabled: true,
    priority: 8,
    nextRun: new Date(Date.now() + 3600000).toISOString(),
    lastRun: new Date(Date.now() - 86400000).toISOString(),
    lastStatus: 'success',
    averageDurationMs: 45000,
  },
  {
    id: 'sync-external-api',
    name: 'Sync External API',
    type: 'event',
    pattern: 'api.sync.requested',
    enabled: true,
    priority: 6,
    nextRun: new Date(Date.now() + 600000).toISOString(),
    lastRun: new Date(Date.now() - 1800000).toISOString(),
    lastStatus: 'success',
    averageDurationMs: 12000,
  },
  {
    id: 'cache-invalidation',
    name: 'Cache Invalidation',
    type: 'cron',
    pattern: '*/30 * * * *',
    enabled: true,
    priority: 3,
    nextRun: new Date(Date.now() + 300000).toISOString(),
    lastRun: new Date(Date.now() - 600000).toISOString(),
    lastStatus: 'success',
    averageDurationMs: 2000,
  },
  {
    id: 'report-generation',
    name: 'Report Generation',
    type: 'cron',
    pattern: '0 6 * * MON',
    enabled: true,
    priority: 5,
    nextRun: new Date(Date.now() + 432000000).toISOString(), // Next Monday
    lastRun: new Date(Date.now() - 604800000).toISOString(), // Last Monday
    lastStatus: 'success',
    averageDurationMs: 120000,
  },
];

export const MOCK_QUEUE_STATUS: QueueStatus = {
  totalPending: 7,
  totalRunning: 2,
  totalScheduled: 12,
  pendingTasks: [
    { taskId: 'backup-daily', priority: 8, queuedAt: new Date(Date.now() - 300000).toISOString() },
    { taskId: 'sync-external-api', priority: 6, queuedAt: new Date(Date.now() - 180000).toISOString() },
    { taskId: 'cache-invalidation', priority: 3, queuedAt: new Date(Date.now() - 120000).toISOString() },
  ],
};

export const MOCK_RESOURCE_LIMITS: ResourceLimits = {
  maxConcurrent: 4,
  maxCpuPercent: 80,
  maxMemoryPercent: 85,
  maxQueueSize: 1000,
};

export const MOCK_RESOURCE_USAGE: ResourceMetrics = {
  cpuUsage: 42.3,
  memoryUsage: 61.5,
  concurrentTasks: 2,
  queueLength: 7,
};

export const MOCK_RETRY_METRICS: RetryMetrics = {
  totalRetries: 1247,
  successfulRetries: 1089,
  failedRetries: 158,
  averageAttemptsPerTask: 2.3,
  retrySuccessRate: 87.3,
  averageRetryDelayMs: 5000,
};

export const MOCK_CIRCUIT_BREAKERS: CircuitBreakerState[] = [
  {
    id: 'external-api-breaker',
    serviceName: 'External API',
    state: 'closed',
    failureCount: 0,
    lastFailure: new Date(Date.now() - 3600000).toISOString(),
    successCount: 524,
    failureThreshold: 5,
    successThreshold: 100,
    nextAttemptAt: null,
  },
  {
    id: 'database-breaker',
    serviceName: 'Database',
    state: 'closed',
    failureCount: 1,
    lastFailure: new Date(Date.now() - 7200000).toISOString(),
    successCount: 891,
    failureThreshold: 5,
    successThreshold: 100,
    nextAttemptAt: null,
  },
  {
    id: 'cache-breaker',
    serviceName: 'Cache Layer',
    state: 'half-open',
    failureCount: 3,
    lastFailure: new Date(Date.now() - 300000).toISOString(),
    successCount: 245,
    failureThreshold: 5,
    successThreshold: 100,
    nextAttemptAt: new Date(Date.now() + 60000).toISOString(),
  },
];

export const MOCK_DLQ_STATS = {
  total: 34,
  pending: 12,
  deadLettered: 22,
  successRate: 64.7,
};

export const MOCK_INTERVENTIONS = [
  {
    taskId: 'sync-external-api',
    type: 'pause' as const,
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    reason: 'Circuit breaker half-open',
  },
  {
    taskId: 'backup-daily',
    type: 'skip' as const,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    reason: 'Maintenance window',
  },
];

export const MOCK_TOP_FAILING_TASKS = [
  {
    taskId: 'sync-external-api',
    failureCount: 23,
    lastFailure: new Date(Date.now() - 300000).toISOString(),
  },
  {
    taskId: 'report-generation',
    failureCount: 8,
    lastFailure: new Date(Date.now() - 86400000).toISOString(),
  },
];

/**
 * Generate complete scheduling metrics data
 */
export const generateMockScheduleMetrics = (): ScheduleMetricsData => {
  const failed = MOCK_SCHEDULES.filter(s => s.lastStatus === 'failed').length;
  const failureRate = (failed / MOCK_SCHEDULES.length) * 100;

  return {
    schedules: MOCK_SCHEDULES,
    queueStatus: MOCK_QUEUE_STATUS,
    resourceUsage: MOCK_RESOURCE_USAGE,
    resourceLimits: MOCK_RESOURCE_LIMITS,
    topPrioritySched: MOCK_SCHEDULES.reduce((prev, curr) =>
      curr.priority > prev.priority ? curr : prev
    ),
    failureRate,
    averageExecutionTime: MOCK_SCHEDULES.reduce((sum, s) => sum + s.averageDurationMs, 0) /
      MOCK_SCHEDULES.length,
    tasksExecutedToday: 47,
    tasksFailedToday: 3,
  };
};

/**
 * Generate complete error recovery metrics data
 */
export const generateMockErrorRecoveryMetrics = (): ErrorRecoveryMetricsData => {
  return {
    retryMetrics: MOCK_RETRY_METRICS,
    circuitBreakers: MOCK_CIRCUIT_BREAKERS,
    dlqStats: MOCK_DLQ_STATS,
    interventions: MOCK_INTERVENTIONS,
    topFailingTasks: MOCK_TOP_FAILING_TASKS,
  };
};

/**
 * ============================================================================
 * METRICS SERVICE CLASS (aggregation + HTTP endpoints)
 * ============================================================================
 */

export class MetricsService {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = new ApiClient();
  }

  /**
   * Fetch scheduling metrics from backend
   * Falls back to mock data if backend unavailable
   */
  async getScheduleMetrics(): Promise<ScheduleMetricsData> {
    try {
      // Attempt to fetch from backend
      const response = await this.apiClient.request<ScheduleMetricsData>(
        '/api/v2/metrics/scheduling',
        {
          method: 'GET',
        }
      );
      return response;
    } catch (error) {
      console.warn('Failed to fetch scheduling metrics, using mock data:', error);
      // Fallback to mock data
      return generateMockScheduleMetrics();
    }
  }

  /**
   * Fetch error recovery metrics from backend
   * Falls back to mock data if backend unavailable
   */
  async getErrorRecoveryMetrics(): Promise<ErrorRecoveryMetricsData> {
    try {
      // Attempt to fetch from backend
      const response = await this.apiClient.request<ErrorRecoveryMetricsData>(
        '/api/v2/metrics/error-recovery',
        {
          method: 'GET',
        }
      );
      return response;
    } catch (error) {
      console.warn('Failed to fetch error recovery metrics, using mock data:', error);
      // Fallback to mock data
      return generateMockErrorRecoveryMetrics();
    }
  }

  /**
   * Fetch combined metrics (scheduling + error recovery)
   * Useful for dashboard initialization
   */
  async getCombinedMetrics(): Promise<{
    scheduling: ScheduleMetricsData;
    errorRecovery: ErrorRecoveryMetricsData;
  }> {
    const [scheduling, errorRecovery] = await Promise.all([
      this.getScheduleMetrics(),
      this.getErrorRecoveryMetrics(),
    ]);

    return { scheduling, errorRecovery };
  }

  /**
   * Fetch individual schedule details
   */
  async getScheduleDetails(scheduleId: string): Promise<Schedule> {
    try {
      return await this.apiClient.request<Schedule>(
        `/api/v2/scheduler/schedules/${scheduleId}`,
        {
          method: 'GET',
        }
      );
    } catch (error) {
      // Fallback to mock
      const schedule = MOCK_SCHEDULES.find(s => s.id === scheduleId);
      if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);
      return schedule;
    }
  }

  /**
   * Compute scheduling statistics
   */
  computeSchedulingStats(schedules: Schedule[]): {
    avgDuration: number;
    totalSchedules: number;
    enabledSchedules: number;
    upcomingCount: number;
  } {
    const now = new Date();
    return {
      avgDuration: schedules.reduce((sum, s) => sum + s.averageDurationMs, 0) / schedules.length,
      totalSchedules: schedules.length,
      enabledSchedules: schedules.filter(s => s.enabled).length,
      upcomingCount: schedules.filter(s => new Date(s.nextRun) < new Date(now.getTime() + 3600000))
        .length,
    };
  }

  /**
   * Identify problematic schedules based on metrics
   */
  getProblematicSchedules(
    schedules: Schedule[],
    circuitBreakers: CircuitBreakerState[]
  ): Array<{
    scheduleId: string;
    issues: string[];
  }> {
    const breakers = new Map(circuitBreakers.map(cb => [cb.id, cb]));

    return schedules
      .map(schedule => {
        const issues: string[] = [];

        // Check if recently failed
        if (schedule.lastStatus === 'failed') {
          issues.push('Last execution failed');
        }

        // Check if associated circuit breaker is open
        const breakerId = `${schedule.id}-breaker`;
        const breaker = breakers.get(breakerId);
        if (breaker && breaker.state === 'open') {
          issues.push('Associated circuit breaker is open');
        }

        return { scheduleId: schedule.id, issues };
      })
      .filter(item => item.issues.length > 0);
  }

  /**
   * Calculate health score (0-100)
   */
  calculateHealthScore(metrics: ErrorRecoveryMetricsData & ScheduleMetricsData): number {
    let score = 100;

    // Deduct for circuit breaker states
    const openBreakers = metrics.circuitBreakers.filter(cb => cb.state === 'open').length;
    score -= openBreakers * 15;

    // Deduct for retry failures
    const retryFailureRate = 100 - metrics.retryMetrics.retrySuccessRate;
    score -= retryFailureRate * 0.2;

    // Deduct for DLQ backlog
    const dlqPercentage = (metrics.dlqStats.pending / metrics.dlqStats.total) * 100;
    score -= dlqPercentage * 0.1;

    // Deduct for resource utilization
    const resourceUsage = Math.max(metrics.resourceUsage.cpuUsage, metrics.resourceUsage.memoryUsage);
    if (resourceUsage > 80) {
      score -= (resourceUsage - 80) * 0.5;
    }

    // Deduct for task failures today
    const failurePercentage = (metrics.tasksFailedToday / (metrics.tasksExecutedToday || 1)) * 100;
    score -= failurePercentage * 0.3;

    return Math.max(0, Math.min(100, Math.round(score)));
  }
}

/**
 * ============================================================================
 * SINGLETON INSTANCE
 * ============================================================================
 */

export const metricsService = new MetricsService();

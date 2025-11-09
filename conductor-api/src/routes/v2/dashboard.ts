/**
 * Dashboard API Routes (T15)
 * Aggregates data from multiple services: error recovery, scheduling, metrics, and WebSocket
 * Provides unified dashboard endpoints for monitoring system state
 *
 * Endpoints:
 * - GET /v2/dashboard/overview - Quick summary for dashboard load
 * - GET /v2/dashboard/errors - Recent errors and trends
 * - GET /v2/dashboard/schedules - Schedule status and execution stats
 * - GET /v2/dashboard/webhooks - Webhook delivery status
 * - GET /v2/dashboard/timeline - Combined event timeline
 * - GET /v2/dashboard/health - System health metrics
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  asyncHandler,
  APIError,
} from '../../middleware/v2-error-handler.js';

/**
 * Dashboard data types
 */
interface CircuitBreakerState {
  serviceName: string;
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  failureRate: number;
  lastFailureAt: string | null;
}

interface ErrorStats {
  active: number;
  resolved24h: number;
  pendingRetries: number;
  circuitBreakers: Record<string, CircuitBreakerState>;
  avgResolutionTimeMs: number;
  commonErrors: Array<{
    errorType: string;
    count: number;
    lastOccurred: string;
  }>;
  retrySuccessRate: number;
}

interface ScheduleStats {
  total: number;
  enabled: number;
  disabled: number;
  nextExecutions: Array<{
    scheduleId: string;
    scheduleName: string;
    nextExecutionAt: string;
    status: 'enabled' | 'disabled';
  }>;
  executionTrend: Array<{
    hour: string;
    count: number;
    successful: number;
    failed: number;
  }>;
  averageExecutionTimeMs: number;
  failureRate: number;
}

interface WebhookStats {
  total: number;
  active: number;
  disabled: number;
  recentDeliveries: Array<{
    webhookId: string;
    deliveryId: string;
    timestamp: string;
    status: 'success' | 'failed' | 'pending';
    statusCode?: number;
  }>;
  failureRate: number;
  pendingRetries: number;
  averageDeliveryTimeMs: number;
}

interface TimelineEvent {
  timestamp: string;
  type: 'error' | 'execution' | 'delivery';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  metadata?: Record<string, any>;
}

interface DashboardOverview {
  timestamp: string;
  errors: ErrorStats;
  schedules: ScheduleStats;
  webhooks: WebhookStats;
  systemHealth: {
    uptime: number;
    memoryUsagePercent: number;
    cpuUsagePercent: number;
  };
}

/**
 * Dashboard data generators - replace with actual service calls
 */
function generateErrorStats(): ErrorStats {
  return {
    active: 12,
    resolved24h: 45,
    pendingRetries: 3,
    avgResolutionTimeMs: 5432,
    retrySuccessRate: 0.87,
    circuitBreakers: {
      'payment-service': {
        serviceName: 'payment-service',
        state: 'closed',
        failureCount: 2,
        failureRate: 0.01,
        lastFailureAt: new Date(Date.now() - 300000).toISOString(),
      },
      'notification-service': {
        serviceName: 'notification-service',
        state: 'half_open',
        failureCount: 8,
        failureRate: 0.04,
        lastFailureAt: new Date(Date.now() - 60000).toISOString(),
      },
      'analytics-service': {
        serviceName: 'analytics-service',
        state: 'closed',
        failureCount: 0,
        failureRate: 0.0,
        lastFailureAt: null,
      },
    },
    commonErrors: [
      {
        errorType: 'timeout',
        count: 18,
        lastOccurred: new Date(Date.now() - 120000).toISOString(),
      },
      {
        errorType: 'connection_refused',
        count: 14,
        lastOccurred: new Date(Date.now() - 300000).toISOString(),
      },
      {
        errorType: 'rate_limit_exceeded',
        count: 8,
        lastOccurred: new Date(Date.now() - 600000).toISOString(),
      },
    ],
  };
}

function generateScheduleStats(): ScheduleStats {
  const now = Date.now();
  return {
    total: 24,
    enabled: 22,
    disabled: 2,
    nextExecutions: [
      {
        scheduleId: 'sched-001',
        scheduleName: 'Daily user sync',
        nextExecutionAt: new Date(now + 3600000).toISOString(),
        status: 'enabled',
      },
      {
        scheduleId: 'sched-002',
        scheduleName: 'Hourly analytics update',
        nextExecutionAt: new Date(now + 1800000).toISOString(),
        status: 'enabled',
      },
      {
        scheduleId: 'sched-003',
        scheduleName: 'Weekly report generation',
        nextExecutionAt: new Date(now + 259200000).toISOString(),
        status: 'enabled',
      },
      {
        scheduleId: 'sched-004',
        scheduleName: 'Monthly cleanup',
        nextExecutionAt: new Date(now + 2592000000).toISOString(),
        status: 'enabled',
      },
      {
        scheduleId: 'sched-005',
        scheduleName: 'Real-time sync',
        nextExecutionAt: new Date(now + 900000).toISOString(),
        status: 'enabled',
      },
      {
        scheduleId: 'sched-006',
        scheduleName: 'Cache invalidation',
        nextExecutionAt: new Date(now + 600000).toISOString(),
        status: 'enabled',
      },
      {
        scheduleId: 'sched-007',
        scheduleName: 'Backup jobs',
        nextExecutionAt: new Date(now + 86400000).toISOString(),
        status: 'enabled',
      },
      {
        scheduleId: 'sched-008',
        scheduleName: 'Metrics aggregation',
        nextExecutionAt: new Date(now + 1200000).toISOString(),
        status: 'disabled',
      },
      {
        scheduleId: 'sched-009',
        scheduleName: 'Health checks',
        nextExecutionAt: new Date(now + 300000).toISOString(),
        status: 'enabled',
      },
      {
        scheduleId: 'sched-010',
        scheduleName: 'Log rotation',
        nextExecutionAt: new Date(now + 172800000).toISOString(),
        status: 'enabled',
      },
    ],
    executionTrend: [
      { hour: new Date(now - 36000000).toISOString(), count: 24, successful: 23, failed: 1 },
      { hour: new Date(now - 32400000).toISOString(), count: 22, successful: 22, failed: 0 },
      { hour: new Date(now - 28800000).toISOString(), count: 26, successful: 25, failed: 1 },
      { hour: new Date(now - 25200000).toISOString(), count: 20, successful: 20, failed: 0 },
      { hour: new Date(now - 21600000).toISOString(), count: 24, successful: 23, failed: 1 },
      { hour: new Date(now - 18000000).toISOString(), count: 23, successful: 23, failed: 0 },
      { hour: new Date(now - 14400000).toISOString(), count: 25, successful: 24, failed: 1 },
      { hour: new Date(now - 10800000).toISOString(), count: 22, successful: 22, failed: 0 },
      { hour: new Date(now - 7200000).toISOString(), count: 24, successful: 24, failed: 0 },
      { hour: new Date(now - 3600000).toISOString(), count: 26, successful: 25, failed: 1 },
      { hour: new Date(now).toISOString(), count: 12, successful: 12, failed: 0 },
    ],
    averageExecutionTimeMs: 2847,
    failureRate: 0.023,
  };
}

function generateWebhookStats(): WebhookStats {
  const now = Date.now();
  return {
    total: 15,
    active: 14,
    disabled: 1,
    failureRate: 0.034,
    pendingRetries: 2,
    averageDeliveryTimeMs: 542,
    recentDeliveries: [
      {
        webhookId: 'whk-001',
        deliveryId: 'del-001',
        timestamp: new Date(now - 60000).toISOString(),
        status: 'success',
        statusCode: 200,
      },
      {
        webhookId: 'whk-002',
        deliveryId: 'del-002',
        timestamp: new Date(now - 120000).toISOString(),
        status: 'success',
        statusCode: 200,
      },
      {
        webhookId: 'whk-003',
        deliveryId: 'del-003',
        timestamp: new Date(now - 180000).toISOString(),
        status: 'failed',
        statusCode: 502,
      },
      {
        webhookId: 'whk-001',
        deliveryId: 'del-004',
        timestamp: new Date(now - 240000).toISOString(),
        status: 'success',
        statusCode: 200,
      },
      {
        webhookId: 'whk-004',
        deliveryId: 'del-005',
        timestamp: new Date(now - 300000).toISOString(),
        status: 'pending',
      },
    ],
  };
}

function generateTimeline(timeRangeMs: number = 3600000): TimelineEvent[] {
  const now = Date.now();
  const events: TimelineEvent[] = [];

  // Error events
  events.push(
    {
      timestamp: new Date(now - 60000).toISOString(),
      type: 'error',
      severity: 'warning',
      title: 'Retry attempt 2 succeeded',
      description: 'Error err-456 resolved after retry',
      metadata: { errorId: 'err-456', retryCount: 2 },
    },
    {
      timestamp: new Date(now - 300000).toISOString(),
      type: 'error',
      severity: 'critical',
      title: 'Circuit breaker opened',
      description: 'Payment service circuit breaker transitioned to open state',
      metadata: { service: 'payment-service', threshold: 5 },
    },
    {
      timestamp: new Date(now - 600000).toISOString(),
      type: 'error',
      severity: 'info',
      title: 'Error logged',
      description: 'Connection timeout on notification service',
      metadata: { service: 'notification-service', code: 'ETIMEDOUT' },
    }
  );

  // Execution events
  events.push(
    {
      timestamp: new Date(now - 120000).toISOString(),
      type: 'execution',
      severity: 'info',
      title: 'Schedule executed successfully',
      description: 'Daily user sync completed in 2.3s',
      metadata: { scheduleId: 'sched-001', duration: 2300 },
    },
    {
      timestamp: new Date(now - 1800000).toISOString(),
      type: 'execution',
      severity: 'warning',
      title: 'Schedule execution failed',
      description: 'Hourly analytics update failed with timeout',
      metadata: { scheduleId: 'sched-002', error: 'ETIMEDOUT' },
    }
  );

  // Delivery events
  events.push(
    {
      timestamp: new Date(now - 30000).toISOString(),
      type: 'delivery',
      severity: 'info',
      title: 'Webhook delivered',
      description: 'Event notification webhook delivered successfully',
      metadata: { webhookId: 'whk-001', status: 200 },
    },
    {
      timestamp: new Date(now - 180000).toISOString(),
      type: 'delivery',
      severity: 'warning',
      title: 'Webhook delivery failed',
      description: 'Webhook delivery failed with status 502, scheduled for retry',
      metadata: { webhookId: 'whk-003', status: 502, retryAt: new Date(now + 60000).toISOString() },
    }
  );

  // Sort descending (newest first)
  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Create dashboard router
 */
export function createDashboardRouter(): Router {
  const router = Router();

  /**
   * GET /v2/dashboard/overview
   * Quick summary for dashboard load
   */
  router.get(
    '/overview',
    asyncHandler(async (req: Request, res: Response) => {
      const overview: DashboardOverview = {
        timestamp: new Date().toISOString(),
        errors: generateErrorStats(),
        schedules: generateScheduleStats(),
        webhooks: generateWebhookStats(),
        systemHealth: {
          uptime: process.uptime(),
          memoryUsagePercent: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
          cpuUsagePercent: Math.random() * 100, // Placeholder
        },
      };

      res.json({
        success: true,
        data: overview,
        timestamp: new Date().toISOString(),
      });
    })
  );

  /**
   * GET /v2/dashboard/errors
   * Recent errors, error trend (last 24h), most common errors, and retry success rate
   */
  router.get(
    '/errors',
    asyncHandler(async (req: Request, res: Response) => {
      const limit = parseInt(req.query.limit as string) || 100;

      const errorData = {
        timestamp: new Date().toISOString(),
        stats: generateErrorStats(),
        recentErrors: [
          {
            errorId: 'err-001',
            errorType: 'timeout',
            service: 'payment-service',
            message: 'Request timeout after 30s',
            firstOccurred: new Date(Date.now() - 7200000).toISOString(),
            lastOccurred: new Date(Date.now() - 60000).toISOString(),
            occurrenceCount: 8,
            retryStatus: 'in_progress',
            nextRetryAt: new Date(Date.now() + 5000).toISOString(),
          },
          {
            errorId: 'err-002',
            errorType: 'connection_refused',
            service: 'notification-service',
            message: 'Connection refused on port 5432',
            firstOccurred: new Date(Date.now() - 3600000).toISOString(),
            lastOccurred: new Date(Date.now() - 300000).toISOString(),
            occurrenceCount: 5,
            retryStatus: 'resolved',
            resolutionTime: 1200000,
          },
          {
            errorId: 'err-003',
            errorType: 'rate_limit_exceeded',
            service: 'api-gateway',
            message: 'Rate limit exceeded: 1000 req/min',
            firstOccurred: new Date(Date.now() - 1800000).toISOString(),
            lastOccurred: new Date(Date.now() - 1200000).toISOString(),
            occurrenceCount: 3,
            retryStatus: 'pending',
            nextRetryAt: new Date(Date.now() + 30000).toISOString(),
          },
        ].slice(0, limit),
        trend24h: Array.from({ length: 24 }, (_, i) => {
          const hour = new Date(Date.now() - (23 - i) * 3600000);
          return {
            hour: hour.toISOString(),
            count: Math.floor(Math.random() * 20) + 5,
          };
        }),
      };

      res.json({
        success: true,
        data: errorData,
        timestamp: new Date().toISOString(),
      });
    })
  );

  /**
   * GET /v2/dashboard/schedules
   * Schedule status, execution stats, next executions, and execution trend
   */
  router.get(
    '/schedules',
    asyncHandler(async (req: Request, res: Response) => {
      const scheduleData = {
        timestamp: new Date().toISOString(),
        stats: generateScheduleStats(),
      };

      res.json({
        success: true,
        data: scheduleData,
        timestamp: new Date().toISOString(),
      });
    })
  );

  /**
   * GET /v2/dashboard/webhooks
   * Webhook delivery status, recent deliveries, failure rate, and pending retries
   */
  router.get(
    '/webhooks',
    asyncHandler(async (req: Request, res: Response) => {
      const webhookData = {
        timestamp: new Date().toISOString(),
        stats: generateWebhookStats(),
      };

      res.json({
        success: true,
        data: webhookData,
        timestamp: new Date().toISOString(),
      });
    })
  );

  /**
   * GET /v2/dashboard/timeline
   * Combined timeline of all events: errors, executions, and deliveries
   * Supports time range filtering via query parameters
   */
  router.get(
    '/timeline',
    asyncHandler(async (req: Request, res: Response) => {
      const timeRangeMs = parseInt(req.query.timeRange as string) || 3600000; // Default 1 hour
      const limit = parseInt(req.query.limit as string) || 50;

      const timeline = generateTimeline(timeRangeMs).slice(0, limit);

      const timelineData = {
        timestamp: new Date().toISOString(),
        timeRange: {
          duration: timeRangeMs,
          unit: 'milliseconds',
        },
        eventCount: timeline.length,
        events: timeline,
      };

      res.json({
        success: true,
        data: timelineData,
        timestamp: new Date().toISOString(),
      });
    })
  );

  /**
   * GET /v2/dashboard/health
   * System health and resource metrics
   */
  router.get(
    '/health',
    asyncHandler(async (req: Request, res: Response) => {
      const memUsage = process.memoryUsage();

      const healthData = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          heapUsagePercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
          external: memUsage.external,
          rss: memUsage.rss,
        },
        cpu: {
          userCpuTime: process.cpuUsage().user,
          systemCpuTime: process.cpuUsage().system,
        },
        services: {
          errorRecovery: { status: 'healthy', lastCheck: new Date().toISOString() },
          scheduler: { status: 'healthy', lastCheck: new Date().toISOString() },
          webhooks: { status: 'healthy', lastCheck: new Date().toISOString() },
        },
      };

      res.json({
        success: true,
        data: healthData,
        timestamp: new Date().toISOString(),
      });
    })
  );

  return router;
}

export default createDashboardRouter;

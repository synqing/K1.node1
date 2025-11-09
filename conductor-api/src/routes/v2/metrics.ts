/**
 * Metrics Endpoints (v2)
 * Provides access to metrics for error recovery, scheduler, webhooks, and system
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import {
  MetricsCollector,
  getMetricsCollector,
  type AggregatedMetrics,
} from '../../services/metrics-collector.js';

/**
 * Metrics Controller
 * Handles all metrics-related HTTP endpoints
 */
export class MetricsController {
  private collector: MetricsCollector;

  constructor(collector?: MetricsCollector) {
    this.collector = collector || getMetricsCollector();
  }

  /**
   * GET /v2/metrics
   * Get all aggregated metrics
   */
  async getAllMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const window = (req.query.window as '1m' | '5m' | '1h') || '1m';

      // Validate window parameter
      if (!['1m', '5m', '1h'].includes(window)) {
        res.status(400).json({
          success: false,
          error: 'Invalid window parameter. Must be one of: 1m, 5m, 1h',
          code: 'INVALID_PARAMETER',
          timestamp: new Date(),
        });
        return;
      }

      this.collector.setAggregationWindow(window);
      const metrics = this.collector.getAggregatedMetrics();

      res.status(200).json({
        success: true,
        data: this.formatMetrics(metrics),
        timestamp: new Date(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /v2/metrics/errors
   * Get error recovery metrics only
   */
  async getErrorMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const window = (req.query.window as '1m' | '5m' | '1h') || '1m';

      // Validate window parameter
      if (!['1m', '5m', '1h'].includes(window)) {
        res.status(400).json({
          success: false,
          error: 'Invalid window parameter. Must be one of: 1m, 5m, 1h',
          code: 'INVALID_PARAMETER',
          timestamp: new Date(),
        });
        return;
      }

      this.collector.setAggregationWindow(window);
      const metrics = this.collector.getErrorRecoveryOnly();

      res.status(200).json({
        success: true,
        data: {
          timestamp: new Date(),
          window,
          errorRecovery: this.formatErrorRecoveryMetrics(metrics),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /v2/metrics/scheduler
   * Get scheduler metrics only
   */
  async getSchedulerMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const window = (req.query.window as '1m' | '5m' | '1h') || '1m';

      // Validate window parameter
      if (!['1m', '5m', '1h'].includes(window)) {
        res.status(400).json({
          success: false,
          error: 'Invalid window parameter. Must be one of: 1m, 5m, 1h',
          code: 'INVALID_PARAMETER',
          timestamp: new Date(),
        });
        return;
      }

      this.collector.setAggregationWindow(window);
      const metrics = this.collector.getSchedulerOnly();

      res.status(200).json({
        success: true,
        data: {
          timestamp: new Date(),
          window,
          scheduler: this.formatSchedulerMetrics(metrics),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /v2/metrics/webhooks
   * Get webhook metrics only
   */
  async getWebhookMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const window = (req.query.window as '1m' | '5m' | '1h') || '1m';

      // Validate window parameter
      if (!['1m', '5m', '1h'].includes(window)) {
        res.status(400).json({
          success: false,
          error: 'Invalid window parameter. Must be one of: 1m, 5m, 1h',
          code: 'INVALID_PARAMETER',
          timestamp: new Date(),
        });
        return;
      }

      this.collector.setAggregationWindow(window);
      const metrics = this.collector.getWebhooksOnly();

      res.status(200).json({
        success: true,
        data: {
          timestamp: new Date(),
          window,
          webhooks: this.formatWebhookMetrics(metrics),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /v2/metrics/system
   * Get system metrics only
   */
  async getSystemMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const window = (req.query.window as '1m' | '5m' | '1h') || '1m';

      // Validate window parameter
      if (!['1m', '5m', '1h'].includes(window)) {
        res.status(400).json({
          success: false,
          error: 'Invalid window parameter. Must be one of: 1m, 5m, 1h',
          code: 'INVALID_PARAMETER',
          timestamp: new Date(),
        });
        return;
      }

      this.collector.setAggregationWindow(window);
      const metrics = this.collector.getSystemOnly();

      res.status(200).json({
        success: true,
        data: {
          timestamp: new Date(),
          window,
          system: this.formatSystemMetrics(metrics),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Format complete metrics response
   */
  private formatMetrics(metrics: AggregatedMetrics) {
    return {
      timestamp: metrics.timestamp,
      window: metrics.window.window,
      errorRecovery: this.formatErrorRecoveryMetrics(metrics.errorRecovery),
      scheduler: this.formatSchedulerMetrics(metrics.scheduler),
      webhooks: this.formatWebhookMetrics(metrics.webhooks),
      system: this.formatSystemMetrics(metrics.system),
    };
  }

  /**
   * Format error recovery metrics
   */
  private formatErrorRecoveryMetrics(metrics: any) {
    return {
      totalRetries: metrics.totalRetries.value,
      successfulRetries: metrics.successfulRetries.value,
      failedRetries: metrics.failedRetries.value,
      averageRetryDuration: {
        value: Math.round(metrics.averageRetryDuration.average),
        min: metrics.averageRetryDuration.min,
        max: metrics.averageRetryDuration.max,
        p50: Math.round(metrics.averageRetryDuration.p50),
        p95: Math.round(metrics.averageRetryDuration.p95),
        p99: Math.round(metrics.averageRetryDuration.p99),
        count: metrics.averageRetryDuration.count,
      },
      circuitBreakerStates: {
        closed: metrics.circuitBreakerStates.closed.value,
        open: metrics.circuitBreakerStates.open.value,
        halfOpen: metrics.circuitBreakerStates.halfOpen.value,
      },
    };
  }

  /**
   * Format scheduler metrics
   */
  private formatSchedulerMetrics(metrics: any) {
    return {
      totalSchedules: metrics.totalSchedules.value,
      totalExecutions: metrics.totalExecutions.value,
      successfulExecutions: metrics.successfulExecutions.value,
      failedExecutions: metrics.failedExecutions.value,
      successRate: metrics.totalExecutions.value > 0
        ? ((metrics.successfulExecutions.value / metrics.totalExecutions.value) * 100).toFixed(2)
        : '0.00',
      averageExecutionDuration: {
        value: Math.round(metrics.averageExecutionDuration.average),
        min: metrics.averageExecutionDuration.min,
        max: metrics.averageExecutionDuration.max,
        p50: Math.round(metrics.averageExecutionDuration.p50),
        p95: Math.round(metrics.averageExecutionDuration.p95),
        p99: Math.round(metrics.averageExecutionDuration.p99),
        count: metrics.averageExecutionDuration.count,
      },
      nextExecutionTimeDistribution: {
        value: Math.round(metrics.nextExecutionTimeDistribution.average),
        min: metrics.nextExecutionTimeDistribution.min,
        max: metrics.nextExecutionTimeDistribution.max,
        p50: Math.round(metrics.nextExecutionTimeDistribution.p50),
        p95: Math.round(metrics.nextExecutionTimeDistribution.p95),
        p99: Math.round(metrics.nextExecutionTimeDistribution.p99),
        count: metrics.nextExecutionTimeDistribution.count,
      },
    };
  }

  /**
   * Format webhook metrics
   */
  private formatWebhookMetrics(metrics: any) {
    return {
      totalWebhooks: metrics.totalWebhooks.value,
      totalDeliveries: metrics.totalDeliveries.value,
      successfulDeliveries: metrics.successfulDeliveries.value,
      failedDeliveries: metrics.failedDeliveries.value,
      successRate: metrics.totalDeliveries.value > 0
        ? ((metrics.successfulDeliveries.value / metrics.totalDeliveries.value) * 100).toFixed(2)
        : '0.00',
      averageDeliveryDuration: {
        value: Math.round(metrics.averageDeliveryDuration.average),
        min: metrics.averageDeliveryDuration.min,
        max: metrics.averageDeliveryDuration.max,
        p50: Math.round(metrics.averageDeliveryDuration.p50),
        p95: Math.round(metrics.averageDeliveryDuration.p95),
        p99: Math.round(metrics.averageDeliveryDuration.p99),
        count: metrics.averageDeliveryDuration.count,
      },
      retryCountDistribution: {
        value: Math.round(metrics.retryCountDistribution.average),
        min: metrics.retryCountDistribution.min,
        max: metrics.retryCountDistribution.max,
        p50: Math.round(metrics.retryCountDistribution.p50),
        p95: Math.round(metrics.retryCountDistribution.p95),
        p99: Math.round(metrics.retryCountDistribution.p99),
        count: metrics.retryCountDistribution.count,
      },
    };
  }

  /**
   * Format system metrics
   */
  private formatSystemMetrics(metrics: any) {
    return {
      activeConnections: metrics.activeConnections.value,
      requestRate: metrics.requestRate.value,
      errorRate: metrics.errorRate.value.toFixed(2),
      averageResponseTime: {
        value: Math.round(metrics.averageResponseTime.average),
        min: metrics.averageResponseTime.min,
        max: metrics.averageResponseTime.max,
        p50: Math.round(metrics.averageResponseTime.p50),
        p95: Math.round(metrics.averageResponseTime.p95),
        p99: Math.round(metrics.averageResponseTime.p99),
        count: metrics.averageResponseTime.count,
      },
    };
  }
}

/**
 * Create metrics router
 */
export function createMetricsRouter(collector?: MetricsCollector): Router {
  const router = Router();
  const controller = new MetricsController(collector);

  // GET /v2/metrics - All metrics
  router.get('/', (req, res, next) => controller.getAllMetrics(req, res, next));

  // GET /v2/metrics/errors - Error recovery metrics only
  router.get('/errors', (req, res, next) => controller.getErrorMetrics(req, res, next));

  // GET /v2/metrics/scheduler - Scheduler metrics only
  router.get('/scheduler', (req, res, next) => controller.getSchedulerMetrics(req, res, next));

  // GET /v2/metrics/webhooks - Webhook metrics only
  router.get('/webhooks', (req, res, next) => controller.getWebhookMetrics(req, res, next));

  // GET /v2/metrics/system - System metrics only
  router.get('/system', (req, res, next) => controller.getSystemMetrics(req, res, next));

  return router;
}

export default createMetricsRouter;

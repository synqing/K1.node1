/**
 * API v2 Routes Index
 * Central export point for all v2 endpoints
 */

export { createBatchRouter, batchRetryErrors, batchResolveErrors, batchExecuteSchedules, batchResolveDLQ, BATCH_CONFIG } from './batch.js';
export type { BatchResponse, BatchItemResult } from './batch.js';

export { createWebhookRouter } from './webhooks.js';

export { createMetricsRouter, MetricsController } from './metrics.js';

export { createDashboardRouter } from './dashboard.js';

// Rate limiting middleware
export {
  globalRateLimiter,
  apiRateLimiter,
  errorRecoveryRateLimiter,
  schedulerRateLimiter,
  webhookRateLimiter,
  batchRateLimiter,
  authRateLimiter,
  createUserRateLimiter,
  createRoleBasedRateLimiter,
  createServiceRateLimiter,
} from '../middleware/rate-limit-strategies.js';
export { default as RateLimiter } from '../middleware/rate-limiter.js';

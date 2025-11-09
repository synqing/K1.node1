/**
 * Conductor API - Scheduler and Core Services
 * Central export point for types, schemas, services, and workers
 */

// Export scheduler types
export * from './types/scheduler.types.js';

// Export retry policy types
export * from './types/retry-policy.types.js';

// Export scheduler utilities
export { CronParser, validateCronExpression, getNextExecutionTime, getPreviousExecutionTime } from './utils/cron-parser.js';

// Export scheduler services
export { SchedulerCoreService, createSchedulerService } from './services/scheduler-core.js';

// Export retry engine service
export {
  RetryEngine,
  type RetryDatabase,
  type RetryCalculationResult,
} from './services/retry-engine.js';

// Export scheduler workers
export { ScheduleExecutor, createScheduleExecutor } from './workers/schedule-executor.js';

// Export retry scheduler worker
export {
  RetryScheduler,
  type RetrySchedulerConfig,
  type TaskExecutor,
} from './workers/retry-scheduler.js';

// Export middleware
export {
  apiVersionMiddleware,
  createVersionRouter,
  requireVersions,
  extractAPIVersion,
  isVersionSupported,
  isVersionDeprecated,
  getDeprecationInfo,
  DEFAULT_VERSION_CONFIG,
  SUPPORTED_VERSIONS,
  type VersionedRequest,
  type VersionConfig,
  type APIVersion,
} from './middleware/api-version.js';

export {
  v2ErrorHandler,
  asyncHandler,
  errorBoundary,
  handleValidationError,
  notFoundHandler,
  APIError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  RateLimitError,
  ServerError,
  type ErrorResponse,
  type ErrorRequest,
} from './middleware/v2-error-handler.js';

// Export scheduler routes
export { createSchedulingRouter, default as schedulingRouter } from './routes/v2-scheduling.js';

// Export batch operations routes (T12)
export { createBatchRouter, batchRetryErrors, batchResolveErrors, batchExecuteSchedules, batchResolveDLQ, BATCH_CONFIG } from './routes/v2/batch.js';
export type { BatchResponse, BatchItemResult } from './routes/v2/batch.js';

/**
 * Conductor API - Scheduler and Core Services
 * Central export point for types, schemas, services, and workers
 */

// Export scheduler types
export * from './types/scheduler.types.js';

// Export retry policy types
export * from './types/retry-policy.types.js';

// Export circuit breaker types
export * from './types/circuit-breaker.types.js';

// Export DLQ types
export * from './types/dlq.types.js';

// Export webhook types
export * from './types/webhook.types.js';

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

// Export circuit breaker service
export {
  CircuitBreaker,
  type CircuitBreakerStorage,
} from './services/circuit-breaker.js';

// Export DLQ service
export {
  DeadLetterQueue,
  type DLQStorage,
} from './services/dlq.js';

// Export webhook service
export {
  WebhookService,
  createWebhookService,
} from './services/webhook-service.js';

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

// Export webhook routes (T11)
export { createWebhookRouter } from './routes/v2/webhooks.js';

// Export error recovery routes (T9)
export {
  createErrorRecoveryRouter,
  ErrorRecoveryController,
} from './routes/v2/error-recovery.js';
export type { RetryDatabase, CircuitBreakerStorage, DLQStorage } from './routes/v2/error-recovery.js';

// Export metrics service (T14)
export {
  MetricsCollector,
  getMetricsCollector,
  createMetricsCollector,
} from './services/metrics-collector.js';
export type {
  Counter,
  Histogram,
  Gauge,
  TimeWindow,
  ErrorRecoveryMetrics,
  SchedulerMetrics,
  WebhookMetrics,
  SystemMetrics,
  AggregatedMetrics,
} from './services/metrics-collector.js';

// Export metrics routes (T14)
export {
  createMetricsRouter,
  MetricsController,
} from './routes/v2/metrics.js';

// Export WebSocket event streaming (T13)
export {
  WebSocketEventStreamer,
  eventStreamer,
  WebSocketConfig,
  initializeWebSocketServer,
  connectErrorRecoveryEvents,
  connectSchedulerEvents,
  connectWebhookEvents,
  connectDLQEvents,
  createWebSocketDiagnosticsEndpoint,
  shutdownWebSocketServer,
  broadcastCustomEvent,
} from './websocket/index.js';
export type {
  EventCategory,
  EventType,
  EventData,
  WebSocketEventMessage,
  SubscriptionMessage,
  UnsubscriptionMessage,
  ErrorRecoveryEventType,
  SchedulerEventType,
  WebhookEventType,
  DLQEventType,
  RetryStartedEvent,
  RetryCompletedEvent,
  ErrorResolvedEvent,
  CircuitBreakerStateChangedEvent,
  ScheduleExecutedEvent,
  ExecutionCompletedEvent,
  ScheduleCreatedEvent,
  ScheduleDeletedEvent,
  WebhookDeliveredEvent,
  WebhookFailedEvent,
  WebhookRegisteredEvent,
  DLQEntryAddedEvent,
  DLQEntryResolvedEvent,
  DLQEntryResubmittedEvent,
} from './websocket/events.js';

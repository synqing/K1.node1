/**
 * WebSocket Event Types and Definitions
 * Type definitions for all event types streamed over WebSocket connections
 * Task T13: WebSocket Event Streaming
 */

export type EventCategory = 'error-recovery' | 'scheduler' | 'webhook' | 'dlq';

export type ErrorRecoveryEventType =
  | 'retry-started'
  | 'retry-completed'
  | 'error-resolved'
  | 'circuit-breaker-state-changed';

export type SchedulerEventType =
  | 'schedule-executed'
  | 'execution-completed'
  | 'schedule-created'
  | 'schedule-deleted';

export type WebhookEventType =
  | 'webhook-delivered'
  | 'webhook-failed'
  | 'webhook-registered';

export type DLQEventType = 'entry-added' | 'entry-resolved' | 'entry-resubmitted';

export type EventType = ErrorRecoveryEventType | SchedulerEventType | WebhookEventType | DLQEventType;

/**
 * Error Recovery Events
 */
export interface RetryStartedEvent {
  retryId: string;
  attemptNumber: number;
  errorMessage: string;
  nextRetryAt: Date;
}

export interface RetryCompletedEvent {
  retryId: string;
  success: boolean;
  attemptCount: number;
  result?: unknown;
  error?: string;
}

export interface ErrorResolvedEvent {
  errorId: string;
  resolution: string;
  resolvedAt: Date;
}

export interface CircuitBreakerStateChangedEvent {
  circuitBreakerId: string;
  previousState: string;
  newState: string;
  reason: string;
}

/**
 * Scheduler Events
 */
export interface ScheduleExecutedEvent {
  scheduleId: string;
  scheduleName: string;
  executionId: string;
  executedAt: Date;
  nextScheduledAt: Date;
}

export interface ExecutionCompletedEvent {
  executionId: string;
  scheduleId: string;
  status: 'success' | 'failed';
  duration: number;
  result?: unknown;
  error?: string;
}

export interface ScheduleCreatedEvent {
  scheduleId: string;
  name: string;
  cronExpression: string;
  createdAt: Date;
}

export interface ScheduleDeletedEvent {
  scheduleId: string;
  name: string;
  deletedAt: Date;
}

/**
 * Webhook Events
 */
export interface WebhookDeliveredEvent {
  webhookId: string;
  url: string;
  deliveryId: string;
  statusCode: number;
  deliveredAt: Date;
}

export interface WebhookFailedEvent {
  webhookId: string;
  url: string;
  deliveryId: string;
  error: string;
  failedAt: Date;
  retryCount: number;
}

export interface WebhookRegisteredEvent {
  webhookId: string;
  url: string;
  events: string[];
  registeredAt: Date;
}

/**
 * DLQ Events
 */
export interface DLQEntryAddedEvent {
  entryId: string;
  originalMessageId: string;
  reason: string;
  addedAt: Date;
  expiresAt: Date;
}

export interface DLQEntryResolvedEvent {
  entryId: string;
  resolution: string;
  resolvedAt: Date;
}

export interface DLQEntryResubmittedEvent {
  entryId: string;
  targetQueue: string;
  resubmittedAt: Date;
  newMessageId: string;
}

/**
 * Union of all event data
 */
export type EventData =
  | RetryStartedEvent
  | RetryCompletedEvent
  | ErrorResolvedEvent
  | CircuitBreakerStateChangedEvent
  | ScheduleExecutedEvent
  | ExecutionCompletedEvent
  | ScheduleCreatedEvent
  | ScheduleDeletedEvent
  | WebhookDeliveredEvent
  | WebhookFailedEvent
  | WebhookRegisteredEvent
  | DLQEntryAddedEvent
  | DLQEntryResolvedEvent
  | DLQEntryResubmittedEvent;

/**
 * WebSocket Message Format
 */
export interface WebSocketEventMessage {
  type: 'event' | 'ping' | 'pong' | 'subscription-ack' | 'error';
  event?: EventType;
  category?: EventCategory;
  data?: EventData;
  timestamp: Date;
  clientId?: string;
}

/**
 * Subscription Request Message
 */
export interface SubscriptionMessage {
  type: 'subscribe';
  categories: EventCategory[];
  clientId: string;
}

/**
 * Unsubscription Request Message
 */
export interface UnsubscriptionMessage {
  type: 'unsubscribe';
  categories: EventCategory[];
  clientId: string;
}

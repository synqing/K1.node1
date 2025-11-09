/**
 * WebSocket Handlers
 * Handlers for connecting WebSocket server and integrating with event emitters
 * Task T13: WebSocket Event Streaming
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { Application } from 'express';
import { createServer } from 'http';
import { eventStreamer, WebSocketEventStreamer } from './event-streamer';
import {
  EventCategory,
  EventType,
  EventData,
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
} from './events';

/**
 * WebSocket server configuration
 */
export interface WebSocketConfig {
  path?: string;
  port?: number;
  perMessageDeflate?: boolean;
  clientTracking?: boolean;
  debug?: boolean;
}

/**
 * Initialize WebSocket server with Express
 */
export function initializeWebSocketServer(
  app: Application,
  config: WebSocketConfig = {}
): { wss: WebSocket.Server; server: any } {
  const path = config.path ?? '/ws';
  const port = config.port ?? 8080;
  const debug = config.debug ?? false;

  // Create HTTP server if needed
  const httpServer = createServer(app);

  // Create WebSocket server
  const wss = new WebSocket.Server({
    server: httpServer,
    path,
    perMessageDeflate: config.perMessageDeflate ?? false,
    clientTracking: config.clientTracking ?? true,
  });

  // Initialize event streamer
  eventStreamer.initialize(wss);

  if (debug) {
    console.log(`[WebSocket] Server initialized on ${path}`);
  }

  // Return both for flexibility
  return {
    wss,
    server: httpServer,
  };
}

/**
 * Connect error recovery events to WebSocket streamer
 */
export function connectErrorRecoveryEvents(
  errorRecoveryEmitter: EventEmitter
): void {
  // Retry started
  errorRecoveryEmitter.on('retry-started', (data: RetryStartedEvent) => {
    eventStreamer.broadcastEvent('error-recovery', 'retry-started', data);
  });

  // Retry completed
  errorRecoveryEmitter.on('retry-completed', (data: RetryCompletedEvent) => {
    eventStreamer.broadcastEvent('error-recovery', 'retry-completed', data);
  });

  // Error resolved
  errorRecoveryEmitter.on('error-resolved', (data: ErrorResolvedEvent) => {
    eventStreamer.broadcastEvent('error-recovery', 'error-resolved', data);
  });

  // Circuit breaker state changed
  errorRecoveryEmitter.on('circuit-breaker-state-changed', (data: CircuitBreakerStateChangedEvent) => {
    eventStreamer.broadcastEvent('error-recovery', 'circuit-breaker-state-changed', data);
  });
}

/**
 * Connect scheduler events to WebSocket streamer
 */
export function connectSchedulerEvents(
  schedulerEmitter: EventEmitter
): void {
  // Schedule executed
  schedulerEmitter.on('schedule-executed', (data: ScheduleExecutedEvent) => {
    eventStreamer.broadcastEvent('scheduler', 'schedule-executed', data);
  });

  // Execution completed
  schedulerEmitter.on('execution-completed', (data: ExecutionCompletedEvent) => {
    eventStreamer.broadcastEvent('scheduler', 'execution-completed', data);
  });

  // Schedule created
  schedulerEmitter.on('schedule-created', (data: ScheduleCreatedEvent) => {
    eventStreamer.broadcastEvent('scheduler', 'schedule-created', data);
  });

  // Schedule deleted
  schedulerEmitter.on('schedule-deleted', (data: ScheduleDeletedEvent) => {
    eventStreamer.broadcastEvent('scheduler', 'schedule-deleted', data);
  });
}

/**
 * Connect webhook events to WebSocket streamer
 */
export function connectWebhookEvents(
  webhookEmitter: EventEmitter
): void {
  // Webhook delivered
  webhookEmitter.on('webhook-delivered', (data: WebhookDeliveredEvent) => {
    eventStreamer.broadcastEvent('webhook', 'webhook-delivered', data);
  });

  // Webhook failed
  webhookEmitter.on('webhook-failed', (data: WebhookFailedEvent) => {
    eventStreamer.broadcastEvent('webhook', 'webhook-failed', data);
  });

  // Webhook registered
  webhookEmitter.on('webhook-registered', (data: WebhookRegisteredEvent) => {
    eventStreamer.broadcastEvent('webhook', 'webhook-registered', data);
  });
}

/**
 * Connect DLQ events to WebSocket streamer
 */
export function connectDLQEvents(
  dlqEmitter: EventEmitter
): void {
  // Entry added
  dlqEmitter.on('entry-added', (data: DLQEntryAddedEvent) => {
    eventStreamer.broadcastEvent('dlq', 'entry-added', data);
  });

  // Entry resolved
  dlqEmitter.on('entry-resolved', (data: DLQEntryResolvedEvent) => {
    eventStreamer.broadcastEvent('dlq', 'entry-resolved', data);
  });

  // Entry resubmitted
  dlqEmitter.on('entry-resubmitted', (data: DLQEntryResubmittedEvent) => {
    eventStreamer.broadcastEvent('dlq', 'entry-resubmitted', data);
  });
}

/**
 * Create a diagnostics endpoint for WebSocket status
 */
export function createWebSocketDiagnosticsEndpoint(): (req: any, res: any) => void {
  return (req: any, res: any) => {
    res.json({
      status: 'operational',
      connectedClients: eventStreamer.getClientCount(),
      subscriptions: {
        'error-recovery': eventStreamer.getSubscriberCount('error-recovery'),
        scheduler: eventStreamer.getSubscriberCount('scheduler'),
        webhook: eventStreamer.getSubscriberCount('webhook'),
        dlq: eventStreamer.getSubscriberCount('dlq'),
      },
      clientDetails: eventStreamer.getSubscriptions(),
      timestamp: new Date().toISOString(),
    });
  };
}

/**
 * Gracefully shutdown WebSocket server
 */
export function shutdownWebSocketServer(wss: WebSocket.Server): Promise<void> {
  return new Promise((resolve) => {
    eventStreamer.disconnectAll();

    wss.close(() => {
      console.log('[WebSocket] Server closed');
      resolve();
    });
  });
}

/**
 * Broadcast custom event (for testing or advanced use)
 */
export function broadcastCustomEvent(
  category: EventCategory,
  event: EventType,
  data: EventData
): number {
  return eventStreamer.broadcastEvent(category, event, data);
}

/**
 * Export event streamer for direct access
 */
export { eventStreamer, WebSocketEventStreamer };

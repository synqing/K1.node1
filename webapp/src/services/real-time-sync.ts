/**
 * Task 19: Real-time Sync Service
 * Event distribution and state synchronization for live UI updates
 *
 * Features:
 * - WebSocket event distribution to subscribed components
 * - Event queue during disconnect
 * - Missed event replay on reconnect
 * - Debouncing of rapid updates
 * - Data validation
 * - Integration with Redux store
 */

import { Store } from '@reduxjs/toolkit';
import { WebSocketEvent, WebSocketEventType } from '../hooks/useWebSocket';

/**
 * Sync event handler callback
 */
export type SyncEventHandler<T = any> = (data: T, event: WebSocketEvent<T>) => void | Promise<void>;

/**
 * State update with debouncing
 */
interface DebouncedUpdate {
  timer: NodeJS.Timeout | null;
  lastUpdateTime: number;
  handler: SyncEventHandler;
  eventData: any;
  event: WebSocketEvent;
}

/**
 * Real-time sync service for state distribution
 */
export class RealTimeSyncService {
  private static instance: RealTimeSyncService | null = null;
  private store: Store | null = null;
  private eventHandlers: Map<WebSocketEventType, Set<SyncEventHandler>> = new Map();
  private eventQueue: WebSocketEvent[] = [];
  private isConnected: boolean = false;
  private debouncedUpdates: Map<string, DebouncedUpdate> = new Map();
  private debounceInterval: number = 100; // 100ms
  private processedEventIds: Set<string> = new Set();
  private eventWindow: number = 60000; // 1 minute event history
  private maxQueueSize: number = 1000; // Max events in queue during disconnect
  private debug: boolean = false;

  private constructor() {
    this.initializeEventHandlers();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RealTimeSyncService {
    if (!RealTimeSyncService.instance) {
      RealTimeSyncService.instance = new RealTimeSyncService();
    }
    return RealTimeSyncService.instance;
  }

  /**
   * Initialize Redux store reference
   */
  setStore(store: Store): void {
    this.store = store;
    this.log('Store initialized');
  }

  /**
   * Initialize event handlers map
   */
  private initializeEventHandlers(): void {
    const eventTypes: WebSocketEventType[] = [
      'error-recovery:retry-started',
      'error-recovery:retry-completed',
      'scheduler:schedule-executed',
      'scheduler:execution-completed',
      'webhook:webhook-delivered',
      'webhook:webhook-failed',
      'metrics:metrics-updated',
    ];

    eventTypes.forEach((type) => {
      this.eventHandlers.set(type, new Set());
    });
  }

  /**
   * Subscribe to event type
   */
  subscribe<T = any>(eventType: WebSocketEventType, handler: SyncEventHandler<T>): () => void {
    const handlers = this.eventHandlers.get(eventType);
    if (!handlers) {
      this.log(`Unknown event type: ${eventType}`);
      return () => {};
    }

    handlers.add(handler);
    this.log(`Subscribed to ${eventType} (${handlers.size} handlers)`);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler);
      this.log(`Unsubscribed from ${eventType} (${handlers.size} handlers)`);
    };
  }

  /**
   * Handle incoming WebSocket event
   */
  async handleEvent(event: WebSocketEvent): Promise<void> {
    // Deduplication check
    if (event.messageId && this.processedEventIds.has(event.messageId)) {
      this.log(`Duplicate event skipped: ${event.messageId}`);
      return;
    }

    if (event.messageId) {
      this.processedEventIds.add(event.messageId);
      // Clean up old event IDs
      setTimeout(() => {
        this.processedEventIds.delete(event.messageId!);
      }, this.eventWindow);
    }

    // Validate event
    if (!this.isValidEvent(event)) {
      this.log('Invalid event:', event);
      return;
    }

    // Queue event if disconnected
    if (!this.isConnected) {
      this.queueEvent(event);
      return;
    }

    // Distribute event
    await this.distributeEvent(event);
  }

  /**
   * Distribute event to subscribers
   */
  private async distributeEvent(event: WebSocketEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.type);
    if (!handlers || handlers.size === 0) {
      return;
    }

    this.log(`Distributing event: ${event.type}`);

    for (const handler of handlers) {
      try {
        await handler(event.data, event);
      } catch (error) {
        this.log(`Error in event handler for ${event.type}:`, error);
      }
    }
  }

  /**
   * Distribute event with debouncing (for rapid updates)
   */
  async distributeEventDebounced(event: WebSocketEvent, debounceKey: string): Promise<void> {
    const handlers = this.eventHandlers.get(event.type);
    if (!handlers || handlers.size === 0) {
      return;
    }

    for (const handler of handlers) {
      const debouncedKey = `${debounceKey}-${Array.from(handlers).indexOf(handler)}`;

      // Clear previous debounce timer
      const previous = this.debouncedUpdates.get(debouncedKey);
      if (previous?.timer) {
        clearTimeout(previous.timer);
      }

      // Set new debounce timer
      const timer = setTimeout(async () => {
        try {
          const update = this.debouncedUpdates.get(debouncedKey);
          if (update) {
            await update.handler(update.eventData, update.event);
            this.debouncedUpdates.delete(debouncedKey);
          }
        } catch (error) {
          this.log(`Error in debounced handler:`, error);
        }
      }, this.debounceInterval);

      this.debouncedUpdates.set(debouncedKey, {
        timer,
        lastUpdateTime: Date.now(),
        handler,
        eventData: event.data,
        event,
      });
    }
  }

  /**
   * Queue event when disconnected
   */
  private queueEvent(event: WebSocketEvent): void {
    if (this.eventQueue.length >= this.maxQueueSize) {
      // Remove oldest event
      this.eventQueue.shift();
    }
    this.eventQueue.push(event);
    this.log(`Event queued (${this.eventQueue.length}/${this.maxQueueSize})`);
  }

  /**
   * Replay queued events on reconnect
   */
  async replayQueuedEvents(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    this.log(`Replaying ${this.eventQueue.length} queued events`);

    const events = [...this.eventQueue];
    this.eventQueue = [];

    for (const event of events) {
      await this.distributeEvent(event);
    }
  }

  /**
   * Mark connection as connected
   */
  setConnected(connected: boolean): void {
    const wasConnected = this.isConnected;
    this.isConnected = connected;

    if (connected && !wasConnected) {
      this.log('Connection established, replaying queued events');
      this.replayQueuedEvents().catch((error) => {
        this.log('Error replaying queued events:', error);
      });
    }

    if (!connected && wasConnected) {
      this.log('Connection lost, starting event queue');
    }
  }

  /**
   * Validate event structure
   */
  private isValidEvent(event: any): boolean {
    return (
      event &&
      typeof event === 'object' &&
      typeof event.type === 'string' &&
      typeof event.timestamp === 'string' &&
      event.data !== undefined
    );
  }

  /**
   * Get queued event count
   */
  getQueuedEventCount(): number {
    return this.eventQueue.length;
  }

  /**
   * Get subscription count for event type
   */
  getSubscriptionCount(eventType: WebSocketEventType): number {
    const handlers = this.eventHandlers.get(eventType);
    return handlers ? handlers.size : 0;
  }

  /**
   * Get total subscription count
   */
  getTotalSubscriptionCount(): number {
    let count = 0;
    this.eventHandlers.forEach((handlers) => {
      count += handlers.size;
    });
    return count;
  }

  /**
   * Clear all queued events
   */
  clearQueue(): void {
    this.eventQueue = [];
    this.log('Event queue cleared');
  }

  /**
   * Debug logging
   */
  private log(...args: any[]): void {
    if (this.debug) {
      console.log('[RealTimeSyncService]', ...args);
    }
  }

  /**
   * Enable/disable debug logging
   */
  setDebug(debug: boolean): void {
    this.debug = debug;
  }
}

/**
 * Helper hook integration utilities
 */
export function initializeRealTimeSync(store: Store): RealTimeSyncService {
  const service = RealTimeSyncService.getInstance();
  service.setStore(store);
  return service;
}

export function getRealTimeSync(): RealTimeSyncService {
  return RealTimeSyncService.getInstance();
}

export default RealTimeSyncService;

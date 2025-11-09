/**
 * Task 3.3.6: WebSocket Real-Time Integration
 * Real-time metrics streaming with message batching and fallback polling
 * Part of Group E (Days 5-6, parallel with Groups C & D)
 *
 * Features:
 * - WebSocket connection management with auto-reconnect
 * - Message batching (100ms windows) for efficiency
 * - Automatic fallback to REST polling if WebSocket unavailable
 * - Redux integration for state synchronization
 * - Heartbeat/ping-pong for connection health
 *
 * Message Types:
 * - scheduling:update - Schedule state changes
 * - errorRecovery:update - Error recovery state changes
 * - metrics:batch - Batched metrics update
 * - connection:ping - Heartbeat check
 */

import { Store } from '@reduxjs/toolkit';
import {
  setSchedules,
  setQueueStatus,
  setResourceUsage,
  setResourceLimits,
} from '../store/slices/schedulingSlice';
import {
  setRetryStats,
  updateCircuitBreakers,
  setDLQEntries,
} from '../store/slices/errorRecoverySlice';
import {
  setWebSocketConnected,
  setConnectionError,
  clearConnectionError,
  updateLastUpdate,
} from '../store/slices/connectionSlice';
import { Schedule, QueueStatus, ResourceMetrics, RetryMetrics, CircuitBreakerState, DLQEntry } from '../types/dashboard';

/**
 * WebSocket message types
 */
interface WebSocketMessage {
  type: string;
  timestamp: string;
  data: Record<string, any>;
  batchId?: string;
}

interface SchedulingUpdateMessage extends WebSocketMessage {
  type: 'scheduling:update';
  data: {
    schedules?: Schedule[];
    queueStatus?: QueueStatus;
    resourceUsage?: ResourceMetrics;
  };
}

interface ErrorRecoveryUpdateMessage extends WebSocketMessage {
  type: 'errorRecovery:update';
  data: {
    retryMetrics?: RetryMetrics;
    circuitBreakers?: CircuitBreakerState[];
    dlqEntries?: DLQEntry[];
  };
}

interface BatchMetricsMessage extends WebSocketMessage {
  type: 'metrics:batch';
  data: {
    scheduling: Record<string, any>;
    errorRecovery: Record<string, any>;
  };
}

interface HeartbeatMessage extends WebSocketMessage {
  type: 'connection:ping' | 'connection:pong';
  data: {};
}

type IncomingMessage = SchedulingUpdateMessage | ErrorRecoveryUpdateMessage | BatchMetricsMessage | HeartbeatMessage | WebSocketMessage;

/**
 * Real-time metrics service with WebSocket and polling fallback
 */
export class RealTimeMetricsService {
  private store: Store;
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 3000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval = 30000; // 30 seconds
  private messageBuffer: WebSocketMessage[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private batchInterval = 100; // 100ms batching window
  private pollingService: PollingService;
  private isConnected = false;

  constructor(store: Store, wsUrl?: string) {
    this.store = store;
    this.wsUrl = wsUrl || this.buildWebSocketUrl();
    this.pollingService = new PollingService(store);
  }

  /**
   * Build WebSocket URL from current environment
   */
  private buildWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    return `${protocol}://${host}/ws/metrics`;
  }

  /**
   * Connect to WebSocket with fallback to polling
   */
  connect(): void {
    if (this.ws) return; // Already connected or connecting

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log('[RealTime] WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.store.dispatch(setWebSocketConnected(true));
        this.store.dispatch(clearConnectionError());

        // Start heartbeat
        this.startHeartbeat();

        // Stop polling if running
        this.pollingService.stopAll();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: IncomingMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[RealTime] Error parsing message:', error);
        }
      };

      this.ws.onerror = (event) => {
        console.error('[RealTime] WebSocket error:', event);
        this.store.dispatch(setConnectionError('WebSocket error'));
      };

      this.ws.onclose = () => {
        console.log('[RealTime] WebSocket disconnected');
        this.isConnected = false;
        this.ws = null;
        this.stopHeartbeat();
        this.store.dispatch(setWebSocketConnected(false));

        // Attempt reconnection
        this.attemptReconnect();

        // Start polling as fallback
        this.pollingService.startPolling();
      };
    } catch (error) {
      console.error('[RealTime] WebSocket connection error:', error);
      this.store.dispatch(setConnectionError('Failed to connect'));
      this.attemptReconnect();

      // Start polling as fallback
      this.pollingService.startPolling();
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[RealTime] Max reconnection attempts reached, using polling');
      this.pollingService.startPolling();
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[RealTime] Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Start heartbeat ping
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const ping: HeartbeatMessage = {
          type: 'connection:ping',
          timestamp: new Date().toISOString(),
          data: {},
        };
        this.ws.send(JSON.stringify(ping));
      }
    }, this.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(message: IncomingMessage): void {
    switch (message.type) {
      case 'scheduling:update':
        this.handleSchedulingUpdate(message as SchedulingUpdateMessage);
        break;

      case 'errorRecovery:update':
        this.handleErrorRecoveryUpdate(message as ErrorRecoveryUpdateMessage);
        break;

      case 'metrics:batch':
        this.handleBatchMetrics(message as BatchMetricsMessage);
        break;

      case 'connection:pong':
        console.log('[RealTime] Heartbeat ACK');
        break;

      default:
        console.warn('[RealTime] Unknown message type:', message.type);
    }

    // Update last message timestamp
    this.store.dispatch(updateLastUpdate(new Date(message.timestamp)));
  }

  /**
   * Handle scheduling update message
   */
  private handleSchedulingUpdate(message: SchedulingUpdateMessage): void {
    const { schedules, queueStatus, resourceUsage } = message.data;

    if (schedules) {
      this.store.dispatch(setSchedules(schedules));
    }
    if (queueStatus) {
      this.store.dispatch(setQueueStatus(queueStatus));
    }
    if (resourceUsage) {
      this.store.dispatch(setResourceUsage(resourceUsage));
    }
  }

  /**
   * Handle error recovery update message
   */
  private handleErrorRecoveryUpdate(message: ErrorRecoveryUpdateMessage): void {
    const { retryMetrics, circuitBreakers, dlqEntries } = message.data;

    if (retryMetrics) {
      this.store.dispatch(setRetryStats(retryMetrics));
    }
    if (circuitBreakers) {
      this.store.dispatch(updateCircuitBreakers(circuitBreakers));
    }
    if (dlqEntries) {
      this.store.dispatch(setDLQEntries(dlqEntries));
    }
  }

  /**
   * Handle batched metrics message
   */
  private handleBatchMetrics(message: BatchMetricsMessage): void {
    const { scheduling, errorRecovery } = message.data;

    // Dispatch scheduling updates
    if (scheduling.schedules) {
      this.store.dispatch(setSchedules(scheduling.schedules));
    }
    if (scheduling.queueStatus) {
      this.store.dispatch(setQueueStatus(scheduling.queueStatus));
    }
    if (scheduling.resourceUsage) {
      this.store.dispatch(setResourceUsage(scheduling.resourceUsage));
    }

    // Dispatch error recovery updates
    if (errorRecovery.retryMetrics) {
      this.store.dispatch(setRetryStats(errorRecovery.retryMetrics));
    }
    if (errorRecovery.circuitBreakers) {
      this.store.dispatch(updateCircuitBreakers(errorRecovery.circuitBreakers));
    }
    if (errorRecovery.dlqEntries) {
      this.store.dispatch(setDLQEntries(errorRecovery.dlqEntries));
    }
  }

  /**
   * Queue message for batched delivery (for sending to server)
   */
  queueMessage(message: WebSocketMessage): void {
    this.messageBuffer.push(message);

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushMessageBuffer();
      }, this.batchInterval);
    }
  }

  /**
   * Flush queued messages
   */
  private flushMessageBuffer(): void {
    if (this.messageBuffer.length === 0) return;

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // For now, just send individual messages
    // In production, could batch multiple messages
    for (const message of this.messageBuffer) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      }
    }

    this.messageBuffer = [];
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.pollingService.stopAll();
    this.isConnected = false;
  }

  /**
   * Check if connected
   */
  getIsConnected(): boolean {
    return this.isConnected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

/**
 * Polling service fallback (when WebSocket unavailable)
 */
class PollingService {
  private store: Store;
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private pollInterval = 5000; // 5 seconds

  constructor(store: Store) {
    this.store = store;
  }

  /**
   * Start polling for metrics
   */
  startPolling(): void {
    console.log('[RealTime] Starting polling fallback (5s interval)');

    this.start('scheduling', async () => {
      try {
        const response = await fetch('/api/v2/metrics/scheduling');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        this.store.dispatch(setSchedules(data.schedules));
        this.store.dispatch(setQueueStatus(data.queueStatus));
        this.store.dispatch(setResourceUsage(data.resourceUsage));
        this.store.dispatch(updateLastUpdate(new Date()));
      } catch (error) {
        console.error('[Polling] Error fetching scheduling metrics:', error);
      }
    });

    this.start('errorRecovery', async () => {
      try {
        const response = await fetch('/api/v2/metrics/error-recovery');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        this.store.dispatch(setRetryStats(data.retryMetrics));
        this.store.dispatch(updateCircuitBreakers(data.circuitBreakers));
        this.store.dispatch(setDLQEntries(data.dlqEntries));
        this.store.dispatch(updateLastUpdate(new Date()));
      } catch (error) {
        console.error('[Polling] Error fetching error recovery metrics:', error);
      }
    });
  }

  /**
   * Start polling for specific metric
   */
  private start(key: string, fn: () => Promise<void>): void {
    this.stop(key);

    // Initial call
    fn();

    // Set up polling
    const timerId = setInterval(fn, this.pollInterval);
    this.intervals.set(key, timerId);
  }

  /**
   * Stop polling for specific metric
   */
  private stop(key: string): void {
    const timerId = this.intervals.get(key);
    if (timerId) {
      clearInterval(timerId);
      this.intervals.delete(key);
    }
  }

  /**
   * Stop all polling
   */
  stopAll(): void {
    console.log('[RealTime] Stopping polling fallback');
    this.intervals.forEach((timerId) => clearInterval(timerId));
    this.intervals.clear();
  }
}

/**
 * Singleton instance factory
 */
let instance: RealTimeMetricsService | null = null;

export function initializeRealTimeMetrics(store: Store): RealTimeMetricsService {
  if (!instance) {
    instance = new RealTimeMetricsService(store);
  }
  return instance;
}

export function getRealTimeMetrics(): RealTimeMetricsService {
  if (!instance) {
    throw new Error('RealTimeMetricsService not initialized. Call initializeRealTimeMetrics first.');
  }
  return instance;
}

export default RealTimeMetricsService;

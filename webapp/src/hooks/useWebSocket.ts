/**
 * Task 19: Real-time WebSocket Integration Hook
 * Connection management and event distribution for live UI updates
 *
 * Features:
 * - Automatic connection management (mount/unmount)
 * - Event subscription system
 * - Connection status tracking
 * - Reconnection with exponential backoff
 * - Network error recovery
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * WebSocket event types
 */
export type WebSocketEventType =
  | 'error-recovery:retry-started'
  | 'error-recovery:retry-completed'
  | 'scheduler:schedule-executed'
  | 'scheduler:execution-completed'
  | 'webhook:webhook-delivered'
  | 'webhook:webhook-failed'
  | 'metrics:metrics-updated'
  | 'connection:connected'
  | 'connection:disconnected';

/**
 * WebSocket event data
 */
export interface WebSocketEvent<T = any> {
  type: WebSocketEventType;
  timestamp: string;
  data: T;
  messageId?: string;
}

/**
 * Hook configuration options
 */
export interface UseWebSocketOptions {
  url?: string;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  initialReconnectDelay?: number;
  debug?: boolean;
}

/**
 * Event listener callback type
 */
type EventListener<T = any> = (event: WebSocketEvent<T>) => void;

/**
 * Event subscription
 */
interface EventSubscription {
  id: string;
  eventType: WebSocketEventType;
  listener: EventListener;
}

/**
 * Manages WebSocket connections and event distribution
 */
class WebSocketManager {
  private static instance: WebSocketManager | null = null;
  private ws: WebSocket | null = null;
  private url: string;
  private reconnect: boolean = true;
  private maxReconnectAttempts: number = 10;
  private initialReconnectDelay: number = 1000;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval: number = 30000;
  private isConnected: boolean = false;
  private subscriptions: Map<string, EventSubscription> = new Map();
  private messageBuffer: WebSocketEvent[] = [];
  private processedMessageIds: Set<string> = new Set();
  private deduplicationWindow: number = 5000; // 5 seconds
  private debug: boolean = false;

  constructor(url?: string, options: Partial<UseWebSocketOptions> = {}) {
    this.url = url || this.buildWebSocketUrl();
    this.reconnect = options.reconnect !== false;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.initialReconnectDelay = options.initialReconnectDelay || 1000;
    this.debug = options.debug || false;
  }

  /**
   * Get singleton instance
   */
  static getInstance(url?: string, options?: Partial<UseWebSocketOptions>): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager(url, options);
    }
    return WebSocketManager.instance;
  }

  /**
   * Build WebSocket URL from current environment
   */
  private buildWebSocketUrl(): string {
    if (typeof window === 'undefined') {
      return 'ws://localhost:3000/ws';
    }
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    return `${protocol}://${host}/ws`;
  }

  /**
   * Connect to WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      try {
        this.log('Connecting to WebSocket:', this.url);
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.log('WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.flushMessageBuffer();
          this.broadcastEvent({
            type: 'connection:connected',
            timestamp: new Date().toISOString(),
            data: {},
          });
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketEvent = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            this.log('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onerror = (event) => {
          this.log('WebSocket error:', event);
          reject(new Error('WebSocket connection error'));
        };

        this.ws.onclose = () => {
          this.log('WebSocket disconnected');
          this.isConnected = false;
          this.stopHeartbeat();
          this.broadcastEvent({
            type: 'connection:disconnected',
            timestamp: new Date().toISOString(),
            data: {},
          });

          if (this.reconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
          }
        };
      } catch (error) {
        this.log('WebSocket connection error:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.log('Disconnecting WebSocket');
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
  }

  /**
   * Subscribe to events
   */
  subscribe(eventType: WebSocketEventType, listener: EventListener): () => void {
    const id = `${eventType}-${Math.random().toString(36).substr(2, 9)}`;
    const subscription: EventSubscription = { id, eventType, listener };
    this.subscriptions.set(id, subscription);

    this.log('Subscribed to event type:', eventType);

    // Return unsubscribe function
    return () => {
      this.subscriptions.delete(id);
      this.log('Unsubscribed from event type:', eventType);
    };
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: WebSocketEvent): void {
    // Deduplication: skip if we've seen this message recently
    if (message.messageId && this.processedMessageIds.has(message.messageId)) {
      this.log('Duplicate message skipped:', message.messageId);
      return;
    }

    if (message.messageId) {
      this.processedMessageIds.add(message.messageId);
      // Clean up old message IDs from deduplication window
      setTimeout(() => {
        this.processedMessageIds.delete(message.messageId!);
      }, this.deduplicationWindow);
    }

    this.broadcastEvent(message);
  }

  /**
   * Broadcast event to all subscribers
   */
  private broadcastEvent(event: WebSocketEvent): void {
    this.subscriptions.forEach((subscription) => {
      if (subscription.eventType === event.type) {
        try {
          subscription.listener(event);
        } catch (error) {
          this.log('Error in event listener:', error);
        }
      }
    });
  }

  /**
   * Start heartbeat (ping/pong)
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({
          type: 'connection:ping',
          timestamp: new Date().toISOString(),
          data: {},
        });
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
   * Send message to server
   */
  sendMessage(message: WebSocketEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageBuffer.push(message);
    }
  }

  /**
   * Flush buffered messages when reconnected
   */
  private flushMessageBuffer(): void {
    while (this.messageBuffer.length > 0) {
      const message = this.messageBuffer.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.initialReconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        this.log('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Get connection status
   */
  getIsConnected(): boolean {
    return this.isConnected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Debug logging
   */
  private log(...args: any[]): void {
    if (this.debug) {
      console.log('[WebSocketManager]', ...args);
    }
  }
}

/**
 * Hook for WebSocket integration in React components
 */
export function useWebSocket<T = any>(
  eventTypes: WebSocketEventType | WebSocketEventType[],
  options: UseWebSocketOptions = {}
): {
  data: T | null;
  isConnected: boolean;
  error: Error | null;
  send: (event: WebSocketEvent<T>) => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const managerRef = useRef<WebSocketManager | null>(null);
  const unsubscribeRef = useRef<Array<() => void>>([]);

  // Normalize eventTypes to array
  const eventTypesArray = Array.isArray(eventTypes) ? eventTypes : [eventTypes];

  // Initialize manager and setup connection
  useEffect(() => {
    const manager = WebSocketManager.getInstance(options.url, options);
    managerRef.current = manager;

    // Subscribe to connection status
    const unsubConnection = manager.subscribe('connection:connected', () => {
      setIsConnected(true);
      setError(null);
    });

    const unsubDisconnection = manager.subscribe('connection:disconnected', () => {
      setIsConnected(false);
    });

    // Subscribe to requested event types
    const unsubscriptions = eventTypesArray.map((eventType) =>
      manager.subscribe(eventType, (event) => {
        setData(event.data as T);
      })
    );

    unsubscribeRef.current = [unsubConnection, unsubDisconnection, ...unsubscriptions];

    // Connect
    manager
      .connect()
      .catch((err) => {
        setError(err);
        console.error('WebSocket connection error:', err);
      });

    // Cleanup on unmount
    return () => {
      unsubscribeRef.current.forEach((unsub) => unsub());
      // Don't disconnect manager, it may be used by other hooks
    };
  }, [options.url, options.debug]);

  // Send function
  const send = useCallback((event: WebSocketEvent<T>) => {
    if (managerRef.current) {
      managerRef.current.sendMessage(event);
    }
  }, []);

  return {
    data,
    isConnected,
    error,
    send,
  };
}

/**
 * Hook to get WebSocket connection status across the app
 */
export function useWebSocketStatus(): boolean {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const manager = WebSocketManager.getInstance();

    const unsubConnect = manager.subscribe('connection:connected', () => {
      setIsConnected(true);
    });

    const unsubDisconnect = manager.subscribe('connection:disconnected', () => {
      setIsConnected(false);
    });

    setIsConnected(manager.getIsConnected());

    return () => {
      unsubConnect();
      unsubDisconnect();
    };
  }, []);

  return isConnected;
}

export default useWebSocket;

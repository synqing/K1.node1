/**
 * WebSocket Event Streamer
 * Manages WebSocket connections and broadcasts events to subscribed clients
 * Task T13: WebSocket Event Streaming
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import {
  EventCategory,
  EventType,
  EventData,
  WebSocketEventMessage,
  SubscriptionMessage,
  UnsubscriptionMessage,
} from './events';

/**
 * Client subscription state
 */
interface ClientSubscription {
  clientId: string;
  ws: WebSocket;
  categories: Set<EventCategory>;
  connectedAt: Date;
  lastHeartbeat: Date;
}

/**
 * Event streamer configuration
 */
interface EventStreamerConfig {
  heartbeatIntervalMs?: number;
  maxClientsPerServer?: number;
  messageQueueSize?: number;
  debug?: boolean;
}

/**
 * WebSocket Event Streamer
 * Handles client connections, subscriptions, and event broadcasting
 */
export class WebSocketEventStreamer extends EventEmitter {
  private clients: Map<string, ClientSubscription> = new Map();
  private heartbeatIntervalMs: number;
  private maxClientsPerServer: number;
  private messageQueueSize: number;
  private debug: boolean;
  private heartbeatTimer?: NodeJS.Timeout;
  private wss?: WebSocket.Server;

  constructor(config: EventStreamerConfig = {}) {
    super();
    this.heartbeatIntervalMs = config.heartbeatIntervalMs ?? 30000;
    this.maxClientsPerServer = config.maxClientsPerServer ?? 1000;
    this.messageQueueSize = config.messageQueueSize ?? 100;
    this.debug = config.debug ?? false;
  }

  /**
   * Initialize WebSocket server
   */
  public initialize(wss: WebSocket.Server): void {
    this.wss = wss;
    this.startHeartbeat();

    wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    if (this.debug) {
      console.log('[WebSocket] Event streamer initialized');
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    if (this.clients.size >= this.maxClientsPerServer) {
      this.sendErrorMessage(ws, 'Server capacity exceeded');
      ws.close(1008, 'Server capacity exceeded');
      return;
    }

    const clientId = this.generateClientId();
    const subscription: ClientSubscription = {
      clientId,
      ws,
      categories: new Set(),
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
    };

    this.clients.set(clientId, subscription);

    if (this.debug) {
      console.log(`[WebSocket] Client connected: ${clientId} (total: ${this.clients.size})`);
    }

    // Send initial message with client ID
    this.sendMessage(ws, {
      type: 'event',
      timestamp: new Date(),
      clientId,
      data: { connectedAt: subscription.connectedAt },
    } as any);

    // Set up event handlers
    ws.on('message', (data: WebSocket.Data) => {
      try {
        this.handleMessage(clientId, data);
      } catch (error) {
        console.error(`[WebSocket] Error handling message from ${clientId}:`, error);
        this.sendErrorMessage(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(clientId);
    });

    ws.on('error', (error: Error) => {
      console.error(`[WebSocket] Error on client ${clientId}:`, error);
      this.handleDisconnect(clientId);
    });

    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.lastHeartbeat = new Date();
      }
    });
  }

  /**
   * Handle incoming messages from client
   */
  private handleMessage(clientId: string, data: WebSocket.Data): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, message as SubscriptionMessage);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message as UnsubscriptionMessage);
          break;
        case 'ping':
          this.sendMessage(client.ws, {
            type: 'pong',
            timestamp: new Date(),
          } as any);
          break;
        default:
          if (this.debug) {
            console.log(`[WebSocket] Unknown message type from ${clientId}: ${message.type}`);
          }
      }
    } catch (error) {
      console.error(`[WebSocket] Failed to parse message from ${clientId}:`, error);
      this.sendErrorMessage(client.ws, 'Failed to parse message');
    }
  }

  /**
   * Handle subscription request
   */
  private handleSubscribe(clientId: string, message: SubscriptionMessage): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    if (!Array.isArray(message.categories)) {
      this.sendErrorMessage(client.ws, 'Invalid subscription format');
      return;
    }

    for (const category of message.categories) {
      if (this.isValidCategory(category)) {
        client.categories.add(category);
      }
    }

    if (this.debug) {
      console.log(
        `[WebSocket] Client ${clientId} subscribed to: ${Array.from(client.categories).join(', ')}`
      );
    }

    this.sendMessage(client.ws, {
      type: 'subscription-ack',
      timestamp: new Date(),
      data: { categories: Array.from(client.categories) },
    } as any);
  }

  /**
   * Handle unsubscription request
   */
  private handleUnsubscribe(clientId: string, message: UnsubscriptionMessage): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    if (!Array.isArray(message.categories)) {
      this.sendErrorMessage(client.ws, 'Invalid unsubscription format');
      return;
    }

    for (const category of message.categories) {
      client.categories.delete(category);
    }

    if (this.debug) {
      console.log(
        `[WebSocket] Client ${clientId} unsubscribed. Remaining: ${Array.from(client.categories).join(', ')}`
      );
    }

    this.sendMessage(client.ws, {
      type: 'subscription-ack',
      timestamp: new Date(),
      data: { categories: Array.from(client.categories) },
    } as any);
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(clientId: string): void {
    this.clients.delete(clientId);

    if (this.debug) {
      console.log(`[WebSocket] Client disconnected: ${clientId} (remaining: ${this.clients.size})`);
    }

    this.emit('client-disconnected', clientId);
  }

  /**
   * Broadcast event to subscribed clients
   */
  public broadcastEvent(
    category: EventCategory,
    event: EventType,
    data: EventData
  ): number {
    let broadcastCount = 0;

    for (const [clientId, client] of this.clients) {
      if (client.categories.has(category) && client.ws.readyState === WebSocket.OPEN) {
        try {
          this.sendMessage(client.ws, {
            type: 'event',
            event,
            category,
            data,
            timestamp: new Date(),
            clientId,
          });
          broadcastCount++;
        } catch (error) {
          console.error(
            `[WebSocket] Failed to send event to ${clientId}:`,
            error
          );
          this.handleDisconnect(clientId);
        }
      }
    }

    if (this.debug && broadcastCount > 0) {
      console.log(`[WebSocket] Broadcasted ${event} to ${broadcastCount} clients`);
    }

    return broadcastCount;
  }

  /**
   * Send message to specific WebSocket client
   */
  private sendMessage(ws: WebSocket, message: WebSocketEventMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      // Serialize dates to ISO strings
      const serialized = JSON.stringify(message, (key, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      });

      ws.send(serialized);
    }
  }

  /**
   * Send error message to client
   */
  private sendErrorMessage(ws: WebSocket, errorMessage: string): void {
    try {
      this.sendMessage(ws, {
        type: 'error',
        timestamp: new Date(),
        data: { error: errorMessage } as any,
      });
    } catch (error) {
      console.error('[WebSocket] Failed to send error message:', error);
    }
  }

  /**
   * Start heartbeat to keep connections alive
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = new Date();

      for (const [clientId, client] of this.clients) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();

          // Check for stale connections (no heartbeat response in 2 intervals)
          const timeSinceLastHeartbeat = now.getTime() - client.lastHeartbeat.getTime();
          if (timeSinceLastHeartbeat > this.heartbeatIntervalMs * 2) {
            if (this.debug) {
              console.log(`[WebSocket] Closing stale connection: ${clientId}`);
            }
            client.ws.close(1000, 'Heartbeat timeout');
            this.handleDisconnect(clientId);
          }
        } else if (client.ws.readyState !== WebSocket.CONNECTING) {
          this.handleDisconnect(clientId);
        }
      }
    }, this.heartbeatIntervalMs);
  }

  /**
   * Stop heartbeat
   */
  public stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * Get connected clients count
   */
  public getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get clients subscribed to a category
   */
  public getSubscriberCount(category: EventCategory): number {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.categories.has(category)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get all subscriptions
   */
  public getSubscriptions(): Record<string, string[]> {
    const subscriptions: Record<string, string[]> = {};
    for (const [clientId, client] of this.clients) {
      subscriptions[clientId] = Array.from(client.categories);
    }
    return subscriptions;
  }

  /**
   * Disconnect all clients
   */
  public disconnectAll(): void {
    for (const [clientId, client] of this.clients) {
      try {
        client.ws.close(1000, 'Server shutdown');
      } catch (error) {
        console.error(`[WebSocket] Error closing client ${clientId}:`, error);
      }
    }
    this.clients.clear();
    this.stopHeartbeat();
  }

  /**
   * Validate event category
   */
  private isValidCategory(category: string): boolean {
    return ['error-recovery', 'scheduler', 'webhook', 'dlq'].includes(category);
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const eventStreamer = new WebSocketEventStreamer({
  debug: process.env.DEBUG_WEBSOCKET === 'true',
});

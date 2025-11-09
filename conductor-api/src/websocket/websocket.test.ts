/**
 * WebSocket Event Streamer Tests
 * Unit tests for WebSocket event streaming functionality
 * Task T13: WebSocket Event Streaming
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { WebSocketEventStreamer } from './event-streamer';
import {
  connectErrorRecoveryEvents,
  connectSchedulerEvents,
  connectWebhookEvents,
  connectDLQEvents,
  broadcastCustomEvent,
} from './handlers';
import {
  RetryStartedEvent,
  ScheduleExecutedEvent,
  WebhookDeliveredEvent,
  DLQEntryAddedEvent,
} from './events';

describe('WebSocketEventStreamer', () => {
  let streamer: WebSocketEventStreamer;

  beforeEach(() => {
    streamer = new WebSocketEventStreamer({
      debug: false,
      heartbeatIntervalMs: 5000,
    });
  });

  afterEach(() => {
    streamer.disconnectAll();
  });

  describe('Client Management', () => {
    test('should track connected clients', () => {
      expect(streamer.getClientCount()).toBe(0);
    });

    test('should generate unique client IDs', () => {
      const id1 = (streamer as any).generateClientId();
      const id2 = (streamer as any).generateClientId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^client-\d+-[a-z0-9]+$/);
    });

    test('should validate event categories', () => {
      expect((streamer as any).isValidCategory('error-recovery')).toBe(true);
      expect((streamer as any).isValidCategory('scheduler')).toBe(true);
      expect((streamer as any).isValidCategory('webhook')).toBe(true);
      expect((streamer as any).isValidCategory('dlq')).toBe(true);
      expect((streamer as any).isValidCategory('invalid')).toBe(false);
    });
  });

  describe('Event Broadcasting', () => {
    test('should broadcast error-recovery events', (done) => {
      const mockWs = new EventEmitter() as any;
      mockWs.readyState = WebSocket.OPEN;
      mockWs.send = jest.fn();

      const client = {
        clientId: 'test-client',
        ws: mockWs,
        categories: new Set(['error-recovery']),
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
      };

      (streamer as any).clients.set('test-client', client);

      const event: RetryStartedEvent = {
        retryId: 'retry-1',
        attemptNumber: 1,
        errorMessage: 'Test error',
        nextRetryAt: new Date(),
      };

      const count = streamer.broadcastEvent('error-recovery', 'retry-started', event);

      expect(count).toBe(1);
      expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('retry-started'));
      done();
    });

    test('should broadcast scheduler events', (done) => {
      const mockWs = new EventEmitter() as any;
      mockWs.readyState = WebSocket.OPEN;
      mockWs.send = jest.fn();

      const client = {
        clientId: 'test-client',
        ws: mockWs,
        categories: new Set(['scheduler']),
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
      };

      (streamer as any).clients.set('test-client', client);

      const event: ScheduleExecutedEvent = {
        scheduleId: 'sched-1',
        scheduleName: 'Test Schedule',
        executionId: 'exec-1',
        executedAt: new Date(),
        nextScheduledAt: new Date(),
      };

      const count = streamer.broadcastEvent('scheduler', 'schedule-executed', event);

      expect(count).toBe(1);
      expect(mockWs.send).toHaveBeenCalled();
      done();
    });

    test('should only broadcast to subscribed clients', () => {
      const mockWs1 = new EventEmitter() as any;
      mockWs1.readyState = WebSocket.OPEN;
      mockWs1.send = jest.fn();

      const mockWs2 = new EventEmitter() as any;
      mockWs2.readyState = WebSocket.OPEN;
      mockWs2.send = jest.fn();

      // Client 1: subscribed to error-recovery
      (streamer as any).clients.set('client-1', {
        clientId: 'client-1',
        ws: mockWs1,
        categories: new Set(['error-recovery']),
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
      });

      // Client 2: subscribed to scheduler
      (streamer as any).clients.set('client-2', {
        clientId: 'client-2',
        ws: mockWs2,
        categories: new Set(['scheduler']),
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
      });

      const event: RetryStartedEvent = {
        retryId: 'retry-1',
        attemptNumber: 1,
        errorMessage: 'Test error',
        nextRetryAt: new Date(),
      };

      const count = streamer.broadcastEvent('error-recovery', 'retry-started', event);

      expect(count).toBe(1);
      expect(mockWs1.send).toHaveBeenCalled();
      expect(mockWs2.send).not.toHaveBeenCalled();
    });

    test('should not broadcast to disconnected clients', () => {
      const mockWs = new EventEmitter() as any;
      mockWs.readyState = WebSocket.CLOSED;
      mockWs.send = jest.fn();

      (streamer as any).clients.set('test-client', {
        clientId: 'test-client',
        ws: mockWs,
        categories: new Set(['error-recovery']),
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
      });

      const event: RetryStartedEvent = {
        retryId: 'retry-1',
        attemptNumber: 1,
        errorMessage: 'Test error',
        nextRetryAt: new Date(),
      };

      const count = streamer.broadcastEvent('error-recovery', 'retry-started', event);

      expect(count).toBe(0);
      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  describe('Subscription Management', () => {
    test('should handle subscription requests', (done) => {
      const mockWs = new EventEmitter() as any;
      mockWs.readyState = WebSocket.OPEN;
      mockWs.send = jest.fn();

      (streamer as any).clients.set('test-client', {
        clientId: 'test-client',
        ws: mockWs,
        categories: new Set(),
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
      });

      (streamer as any).handleSubscribe('test-client', {
        type: 'subscribe',
        categories: ['error-recovery', 'scheduler'],
        clientId: 'test-client',
      });

      const client = (streamer as any).clients.get('test-client');
      expect(client.categories.has('error-recovery')).toBe(true);
      expect(client.categories.has('scheduler')).toBe(true);
      expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('subscription-ack'));
      done();
    });

    test('should handle unsubscription requests', (done) => {
      const mockWs = new EventEmitter() as any;
      mockWs.readyState = WebSocket.OPEN;
      mockWs.send = jest.fn();

      (streamer as any).clients.set('test-client', {
        clientId: 'test-client',
        ws: mockWs,
        categories: new Set(['error-recovery', 'scheduler']),
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
      });

      (streamer as any).handleUnsubscribe('test-client', {
        type: 'unsubscribe',
        categories: ['error-recovery'],
        clientId: 'test-client',
      });

      const client = (streamer as any).clients.get('test-client');
      expect(client.categories.has('error-recovery')).toBe(false);
      expect(client.categories.has('scheduler')).toBe(true);
      done();
    });

    test('should track subscriber counts by category', (done) => {
      const mockWs1 = new EventEmitter() as any;
      mockWs1.readyState = WebSocket.OPEN;

      const mockWs2 = new EventEmitter() as any;
      mockWs2.readyState = WebSocket.OPEN;

      (streamer as any).clients.set('client-1', {
        clientId: 'client-1',
        ws: mockWs1,
        categories: new Set(['error-recovery', 'scheduler']),
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
      });

      (streamer as any).clients.set('client-2', {
        clientId: 'client-2',
        ws: mockWs2,
        categories: new Set(['error-recovery']),
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
      });

      expect(streamer.getSubscriberCount('error-recovery')).toBe(2);
      expect(streamer.getSubscriberCount('scheduler')).toBe(1);
      expect(streamer.getSubscriberCount('webhook')).toBe(0);
      done();
    });
  });

  describe('Heartbeat', () => {
    test('should start and stop heartbeat', (done) => {
      expect((streamer as any).heartbeatTimer).toBeDefined();

      streamer.stopHeartbeat();
      expect((streamer as any).heartbeatTimer).toBeUndefined();

      done();
    });
  });

  describe('Graceful Shutdown', () => {
    test('should disconnect all clients on shutdown', (done) => {
      const mockWs1 = new EventEmitter() as any;
      mockWs1.readyState = WebSocket.OPEN;
      mockWs1.close = jest.fn();

      const mockWs2 = new EventEmitter() as any;
      mockWs2.readyState = WebSocket.OPEN;
      mockWs2.close = jest.fn();

      (streamer as any).clients.set('client-1', {
        clientId: 'client-1',
        ws: mockWs1,
        categories: new Set(),
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
      });

      (streamer as any).clients.set('client-2', {
        clientId: 'client-2',
        ws: mockWs2,
        categories: new Set(),
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
      });

      streamer.disconnectAll();

      expect(streamer.getClientCount()).toBe(0);
      expect(mockWs1.close).toHaveBeenCalled();
      expect(mockWs2.close).toHaveBeenCalled();
      done();
    });
  });
});

describe('Event Handlers Integration', () => {
  let streamer: WebSocketEventStreamer;

  beforeEach(() => {
    streamer = new WebSocketEventStreamer({ debug: false });
  });

  afterEach(() => {
    streamer.disconnectAll();
  });

  test('should connect error-recovery events', (done) => {
    const mockWs = new EventEmitter() as any;
    mockWs.readyState = WebSocket.OPEN;
    mockWs.send = jest.fn();

    (streamer as any).clients.set('test-client', {
      clientId: 'test-client',
      ws: mockWs,
      categories: new Set(['error-recovery']),
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
    });

    const errorRecoveryEmitter = new EventEmitter();
    connectErrorRecoveryEvents(errorRecoveryEmitter);

    const event: RetryStartedEvent = {
      retryId: 'retry-1',
      attemptNumber: 1,
      errorMessage: 'Test error',
      nextRetryAt: new Date(),
    };

    errorRecoveryEmitter.emit('retry-started', event);

    // Give time for async processing
    setImmediate(() => {
      expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('retry-started'));
      done();
    });
  });

  test('should serialize dates in messages', (done) => {
    const mockWs = new EventEmitter() as any;
    mockWs.readyState = WebSocket.OPEN;
    let capturedMessage: string | undefined;
    mockWs.send = jest.fn((msg: string) => {
      capturedMessage = msg;
    });

    (streamer as any).clients.set('test-client', {
      clientId: 'test-client',
      ws: mockWs,
      categories: new Set(['error-recovery']),
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
    });

    const event: RetryStartedEvent = {
      retryId: 'retry-1',
      attemptNumber: 1,
      errorMessage: 'Test error',
      nextRetryAt: new Date(),
    };

    streamer.broadcastEvent('error-recovery', 'retry-started', event);

    expect(mockWs.send).toHaveBeenCalled();
    expect(capturedMessage).toContain('2024');
    expect(capturedMessage).toContain('Z'); // ISO format date string
    done();
  });
});

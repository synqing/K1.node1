/**
 * Tests for RealTimeSyncService
 */

import { RealTimeSyncService, initializeRealTimeSync } from '../real-time-sync';
import { WebSocketEvent } from '../../hooks/useWebSocket';
import { configureStore } from '@reduxjs/toolkit';

describe('RealTimeSyncService', () => {
  let service: RealTimeSyncService;
  let store: any;

  beforeEach(() => {
    // Reset singleton
    RealTimeSyncService.getInstance();
    service = RealTimeSyncService.getInstance();

    // Create minimal mock store
    store = configureStore({
      reducer: {
        test: () => ({}),
      },
    });

    service.setStore(store);
    service.setDebug(false);
  });

  it('should be singleton', () => {
    const service1 = RealTimeSyncService.getInstance();
    const service2 = RealTimeSyncService.getInstance();

    expect(service1).toBe(service2);
  });

  it('should subscribe and unsubscribe from events', () => {
    const handler = jest.fn();
    const unsub = service.subscribe('metrics:metrics-updated', handler);

    expect(service.getSubscriptionCount('metrics:metrics-updated')).toBe(1);

    unsub();

    expect(service.getSubscriptionCount('metrics:metrics-updated')).toBe(0);
  });

  it('should handle valid events', async () => {
    const handler = jest.fn();
    service.subscribe('metrics:metrics-updated', handler);

    const event: WebSocketEvent = {
      type: 'metrics:metrics-updated',
      timestamp: new Date().toISOString(),
      data: { value: 42 },
      messageId: 'test-123',
    };

    service.setConnected(true);
    await service.handleEvent(event);

    expect(handler).toHaveBeenCalledWith(event.data, event);
  });

  it('should reject invalid events', async () => {
    const handler = jest.fn();
    service.subscribe('metrics:metrics-updated', handler);

    const invalidEvent = {
      type: 'metrics:metrics-updated',
      // missing timestamp
      data: { value: 42 },
    };

    service.setConnected(true);
    await service.handleEvent(invalidEvent as any);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should queue events when disconnected', async () => {
    const event: WebSocketEvent = {
      type: 'metrics:metrics-updated',
      timestamp: new Date().toISOString(),
      data: { value: 42 },
      messageId: 'test-123',
    };

    service.setConnected(false);
    await service.handleEvent(event);

    expect(service.getQueuedEventCount()).toBe(1);
  });

  it('should replay queued events on reconnect', async () => {
    const handler = jest.fn();
    service.subscribe('metrics:metrics-updated', handler);

    const event: WebSocketEvent = {
      type: 'metrics:metrics-updated',
      timestamp: new Date().toISOString(),
      data: { value: 42 },
      messageId: 'test-123',
    };

    // Queue event while disconnected
    service.setConnected(false);
    await service.handleEvent(event);

    expect(service.getQueuedEventCount()).toBe(1);
    expect(handler).not.toHaveBeenCalled();

    // Reconnect
    service.setConnected(true);

    // Wait for queue replay
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(handler).toHaveBeenCalledWith(event.data, event);
    expect(service.getQueuedEventCount()).toBe(0);
  });

  it('should deduplicate messages', async () => {
    const handler = jest.fn();
    service.subscribe('metrics:metrics-updated', handler);

    const event: WebSocketEvent = {
      type: 'metrics:metrics-updated',
      timestamp: new Date().toISOString(),
      data: { value: 42 },
      messageId: 'duplicate-123',
    };

    service.setConnected(true);

    // Send same message twice
    await service.handleEvent(event);
    await service.handleEvent(event);

    // Should only call handler once
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should track subscription counts', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    service.subscribe('metrics:metrics-updated', handler1);
    service.subscribe('metrics:metrics-updated', handler2);
    service.subscribe('scheduler:schedule-executed', handler1);

    expect(service.getSubscriptionCount('metrics:metrics-updated')).toBe(2);
    expect(service.getSubscriptionCount('scheduler:schedule-executed')).toBe(1);
    expect(service.getTotalSubscriptionCount()).toBe(3);
  });

  it('should clear event queue', async () => {
    const event: WebSocketEvent = {
      type: 'metrics:metrics-updated',
      timestamp: new Date().toISOString(),
      data: { value: 42 },
    };

    service.setConnected(false);
    await service.handleEvent(event);

    expect(service.getQueuedEventCount()).toBe(1);

    service.clearQueue();

    expect(service.getQueuedEventCount()).toBe(0);
  });

  it('should initialize with store', () => {
    const mockStore = {
      getState: () => ({}),
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    };

    const service2 = initializeRealTimeSync(mockStore as any);

    expect(service2).toBeDefined();
  });

  it('should handle event distribution errors gracefully', async () => {
    const errorHandler = jest.fn(() => {
      throw new Error('Handler error');
    });
    const normalHandler = jest.fn();

    service.subscribe('metrics:metrics-updated', errorHandler);
    service.subscribe('metrics:metrics-updated', normalHandler);

    const event: WebSocketEvent = {
      type: 'metrics:metrics-updated',
      timestamp: new Date().toISOString(),
      data: { value: 42 },
    };

    service.setConnected(true);
    service.setDebug(false); // Suppress logs in test

    await service.handleEvent(event);

    // Both handlers should be called despite error
    expect(errorHandler).toHaveBeenCalled();
    expect(normalHandler).toHaveBeenCalled();
  });

  it('should handle debounced event distribution', async () => {
    const handler = jest.fn();
    service.subscribe('metrics:metrics-updated', handler);

    const event1: WebSocketEvent = {
      type: 'metrics:metrics-updated',
      timestamp: new Date().toISOString(),
      data: { value: 1 },
    };

    const event2: WebSocketEvent = {
      type: 'metrics:metrics-updated',
      timestamp: new Date().toISOString(),
      data: { value: 2 },
    };

    service.setConnected(true);

    // Send multiple events quickly
    await service.distributeEventDebounced(event1, 'debounce-test');
    await service.distributeEventDebounced(event2, 'debounce-test');

    // Wait for debounce window
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Should eventually call handler with latest event
    expect(handler).toHaveBeenCalled();
  });
});

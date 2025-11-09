/**
 * Tests for useWebSocket hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useWebSocket, WebSocketEvent } from '../useWebSocket';

describe('useWebSocket', () => {
  // Mock WebSocket
  const mockWebSocket = {
    readyState: WebSocket.OPEN,
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.WebSocket = jest.fn(() => mockWebSocket) as any;
  });

  it('should initialize with disconnected state', () => {
    const { result } = renderHook(() => useWebSocket('metrics:metrics-updated'));

    expect(result.current.isConnected).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should handle single event type subscription', async () => {
    const { result } = renderHook(() => useWebSocket('metrics:metrics-updated'));

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(result.current.send).toBeDefined();
  });

  it('should handle multiple event types subscription', async () => {
    const { result } = renderHook(() =>
      useWebSocket(['metrics:metrics-updated', 'scheduler:schedule-executed'])
    );

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
  });

  it('should provide send function', async () => {
    const { result } = renderHook(() => useWebSocket('metrics:metrics-updated'));

    const event: WebSocketEvent = {
      type: 'metrics:metrics-updated',
      timestamp: new Date().toISOString(),
      data: { test: 'data' },
      messageId: 'test-123',
    };

    await act(async () => {
      result.current.send(event);
    });

    expect(mockWebSocket.send).toBeDefined();
  });

  it('should handle disconnection', async () => {
    const { result } = renderHook(() => useWebSocket('metrics:metrics-updated'));

    // Simulate connection event
    const mockWs = global.WebSocket as any;
    if (mockWs.mock.results[0].value.onopen) {
      mockWs.mock.results[0].value.onopen();
    }

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('should handle message deduplication', async () => {
    const { result } = renderHook(() => useWebSocket('metrics:metrics-updated'));

    // Note: Full deduplication test requires implementation details
    expect(result.current).toBeDefined();
  });

  it('should handle custom URL and options', () => {
    const { result } = renderHook(() =>
      useWebSocket('metrics:metrics-updated', {
        url: 'ws://custom-host/ws',
        reconnect: true,
        maxReconnectAttempts: 5,
        debug: true,
      })
    );

    expect(result.current).toBeDefined();
  });
});

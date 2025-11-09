/**
 * Task 19: Real-time Dashboard Integration Hook
 * Simplifies real-time updates for T16 Dashboard, T17 Gantt, T18 Analytics
 *
 * Usage in components:
 * ```tsx
 * const { schedules, metrics, isLive } = useRealtimeDashboard();
 * ```
 */

import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useWebSocket, WebSocketEventType } from './useWebSocket';
import { getRealTimeSync } from '../services/real-time-sync';
import {
  Schedule,
  RetryMetrics,
  CircuitBreakerState,
  QueueStatus,
  ResourceMetrics,
} from '../types/dashboard';

/**
 * Real-time dashboard data
 */
export interface RealTimeDashboardData {
  schedules: Schedule[];
  queueStatus: QueueStatus | null;
  retryMetrics: RetryMetrics | null;
  circuitBreakers: CircuitBreakerState[];
  resourceMetrics: ResourceMetrics | null;
  isLive: boolean;
  lastUpdate: Date | null;
}

/**
 * Hook for real-time dashboard data
 */
export function useRealtimeDashboard(): RealTimeDashboardData {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [retryMetrics, setRetryMetrics] = useState<RetryMetrics | null>(null);
  const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreakerState[]>([]);
  const [resourceMetrics, setResourceMetrics] = useState<ResourceMetrics | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Get Redux state for fallback
  const reduxSchedules = useSelector((state: any) => state.scheduling?.schedules || []);
  const reduxQueueStatus = useSelector((state: any) => state.scheduling?.queueStatus || null);
  const reduxRetryMetrics = useSelector((state: any) => state.errorRecovery?.retryMetrics || null);
  const reduxCircuitBreakers = useSelector(
    (state: any) => state.errorRecovery?.circuitBreakers || []
  );
  const reduxResourceMetrics = useSelector(
    (state: any) => state.scheduling?.resourceMetrics || null
  );

  // Connect to WebSocket for real-time updates
  const { isConnected: isLive } = useWebSocket(
    [
      'scheduler:schedule-executed',
      'scheduler:execution-completed',
      'metrics:metrics-updated',
      'error-recovery:retry-completed',
    ]
  );

  // Subscribe to sync service events
  useEffect(() => {
    const syncService = getRealTimeSync();

    const unsubSchedule = syncService.subscribe('scheduler:schedule-executed', (data) => {
      if (Array.isArray(data.schedules)) {
        setSchedules(data.schedules);
        setLastUpdate(new Date());
      }
    });

    const unsubQueueStatus = syncService.subscribe('scheduler:execution-completed', (data) => {
      if (data.queueStatus) {
        setQueueStatus(data.queueStatus);
        setLastUpdate(new Date());
      }
    });

    const unsubMetrics = syncService.subscribe(
      'metrics:metrics-updated',
      async (data, event) => {
        // Debounce rapid metric updates
        await syncService.distributeEventDebounced(event, 'metrics-debounce');

        if (data.retryMetrics) {
          setRetryMetrics(data.retryMetrics);
        }
        if (data.circuitBreakers) {
          setCircuitBreakers(data.circuitBreakers);
        }
        if (data.resourceMetrics) {
          setResourceMetrics(data.resourceMetrics);
        }
        setLastUpdate(new Date());
      }
    );

    return () => {
      unsubSchedule();
      unsubQueueStatus();
      unsubMetrics();
    };
  }, []);

  // Use Redux state as fallback when not live
  const finalSchedules = schedules.length > 0 ? schedules : reduxSchedules;
  const finalQueueStatus = queueStatus || reduxQueueStatus;
  const finalRetryMetrics = retryMetrics || reduxRetryMetrics;
  const finalCircuitBreakers = circuitBreakers.length > 0 ? circuitBreakers : reduxCircuitBreakers;
  const finalResourceMetrics = resourceMetrics || reduxResourceMetrics;

  return {
    schedules: finalSchedules,
    queueStatus: finalQueueStatus,
    retryMetrics: finalRetryMetrics,
    circuitBreakers: finalCircuitBreakers,
    resourceMetrics: finalResourceMetrics,
    isLive,
    lastUpdate,
  };
}

/**
 * Hook for real-time schedule updates (for Gantt chart)
 */
export function useRealtimeSchedules(): {
  schedules: Schedule[];
  isLive: boolean;
  lastUpdate: Date | null;
} {
  const data = useRealtimeDashboard();

  return {
    schedules: data.schedules,
    isLive: data.isLive,
    lastUpdate: data.lastUpdate,
  };
}

/**
 * Hook for real-time error recovery metrics (for Analytics)
 */
export function useRealtimeMetrics(): {
  retryMetrics: RetryMetrics | null;
  circuitBreakers: CircuitBreakerState[];
  isLive: boolean;
  lastUpdate: Date | null;
} {
  const data = useRealtimeDashboard();

  return {
    retryMetrics: data.retryMetrics,
    circuitBreakers: data.circuitBreakers,
    isLive: data.isLive,
    lastUpdate: data.lastUpdate,
  };
}

export default useRealtimeDashboard;

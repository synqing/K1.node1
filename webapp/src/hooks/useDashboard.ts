/**
 * Custom React Hooks for Dashboard
 * Provides hooks for state management, API calls, and WebSocket integration
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import {
  setRetryStats,
  setCircuitBreakers,
  setDLQEntries,
  setInterventionHistory,
  updateErrorRecoveryMetrics,
} from '../store/slices/errorRecoverySlice';
import {
  setSchedules,
  setQueueStatus,
  setResourceUsage,
  updateSchedulingMetrics,
} from '../store/slices/schedulingSlice';
import {
  setWebSocketConnected,
  setConnectionError,
  clearConnectionError,
} from '../store/slices/connectionSlice';
import {
  errorRecoveryAPI,
  schedulingAPI,
  DashboardWebSocket,
  pollingService,
  ApiError,
} from '../services/api';

// ==================== Hook: useWebSocket ====================

export const useWebSocket = (enabled = true) => {
  const dispatch = useDispatch<AppDispatch>();
  const wsRef = useRef<DashboardWebSocket | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const ws = new DashboardWebSocket({
      onConnect: () => {
        dispatch(setWebSocketConnected(true));
        dispatch(clearConnectionError());
      },
      onDisconnect: () => {
        dispatch(setWebSocketConnected(false));
      },
      onMessage: (message) => {
        // Route messages to appropriate reducers
        if (message.source === 'error_recovery') {
          handleErrorRecoveryMessage(message.data);
        } else if (message.source === 'scheduling') {
          handleSchedulingMessage(message.data);
        }
      },
      onError: (error) => {
        dispatch(setConnectionError(error.message));
      },
    });

    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
    };
  }, [enabled, dispatch]);

  const handleErrorRecoveryMessage = useCallback(
    (data: any) => {
      dispatch(updateErrorRecoveryMetrics(data));
    },
    [dispatch]
  );

  const handleSchedulingMessage = useCallback(
    (data: any) => {
      dispatch(updateSchedulingMetrics(data));
    },
    [dispatch]
  );

  return {
    connected: useSelector((state: RootState) => state.connection.websocketConnected),
    error: useSelector((state: RootState) => state.connection.lastError),
  };
};

// ==================== Hook: useErrorRecoveryMetrics ====================

export const useErrorRecoveryMetrics = (autoRefresh = true, interval = 5000) => {
  const dispatch = useDispatch<AppDispatch>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [retryStats, circuitBreakers, dlqEntries, interventionHistory] = await Promise.all([
        errorRecoveryAPI.getRetryStats('24h'),
        errorRecoveryAPI.getCircuitBreakerStatus(),
        errorRecoveryAPI.getDLQEntries(1, 100),
        Promise.resolve([]), // Placeholder for intervention history
      ]);

      dispatch(
        updateErrorRecoveryMetrics({
          retryStats,
          circuitBreakers: circuitBreakers.breakers,
          dlqEntries: dlqEntries.items,
          interventions: interventionHistory,
        })
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch metrics';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    if (autoRefresh) {
      pollingService.start('errorRecovery', fetchMetrics, interval);
      return () => pollingService.stop('errorRecovery');
    }
  }, [autoRefresh, fetchMetrics, interval]);

  return {
    retryStats: useSelector((state: RootState) => state.errorRecovery.retryStats),
    circuitBreakers: useSelector((state: RootState) => state.errorRecovery.circuitBreakers),
    dlqEntries: useSelector((state: RootState) => state.errorRecovery.dlqEntries),
    loading,
    error,
    refetch: fetchMetrics,
  };
};

// ==================== Hook: useSchedulingMetrics ====================

export const useSchedulingMetrics = (autoRefresh = true, interval = 5000) => {
  const dispatch = useDispatch<AppDispatch>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [schedules, queueStatus] = await Promise.all([
        schedulingAPI.listSchedules(),
        schedulingAPI.getQueueStatus(),
      ]);

      dispatch(
        updateSchedulingMetrics({
          schedules: schedules.items,
          queue: queueStatus,
        })
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch metrics';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    if (autoRefresh) {
      pollingService.start('scheduling', fetchMetrics, interval);
      return () => pollingService.stop('scheduling');
    }
  }, [autoRefresh, fetchMetrics, interval]);

  return {
    schedules: useSelector((state: RootState) => state.scheduling.schedules),
    queue: useSelector((state: RootState) => state.scheduling.priorityQueue),
    resourceUsage: useSelector((state: RootState) => state.scheduling.resourceUsage),
    loading,
    error,
    refetch: fetchMetrics,
  };
};

// ==================== Hook: useTaskIntervention ====================

export const useTaskIntervention = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pause = useCallback(async (taskId: string) => {
    setLoading(true);
    setError(null);
    try {
      await errorRecoveryAPI.pauseTask(taskId);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to pause task';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const resume = useCallback(async (taskId: string) => {
    setLoading(true);
    setError(null);
    try {
      await errorRecoveryAPI.resumeTask(taskId);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to resume task';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const skip = useCallback(async (taskId: string, reason?: string) => {
    setLoading(true);
    setError(null);
    try {
      await errorRecoveryAPI.skipTask(taskId, reason);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to skip task';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const retry = useCallback(async (taskId: string, parameters?: Record<string, any>) => {
    setLoading(true);
    setError(null);
    try {
      await errorRecoveryAPI.retryTask(taskId, parameters);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to retry task';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    pause,
    resume,
    skip,
    retry,
    loading,
    error,
  };
};

// ==================== Hook: useDLQOperations ====================

export const useDLQOperations = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resubmit = useCallback(async (dlqId: string, parameters?: Record<string, any>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await errorRecoveryAPI.resubmitDLQEntry(dlqId, parameters);
      return result;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to resubmit task';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    resubmit,
    loading,
    error,
  };
};

// ==================== Hook: useScheduleOperations ====================

export const useScheduleOperations = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (data: any) => {
    setLoading(true);
    setError(null);
    try {
      const result = await schedulingAPI.createSchedule(data);
      return result;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create schedule';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(async (scheduleId: string, data: Partial<any>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await schedulingAPI.updateSchedule(scheduleId, data);
      return result;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update schedule';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const delete_ = useCallback(async (scheduleId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await schedulingAPI.deleteSchedule(scheduleId);
      return result;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete schedule';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const trigger = useCallback(async (event: string, metadata?: Record<string, any>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await schedulingAPI.triggerEvent(event, metadata);
      return result;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to trigger event';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    create,
    update,
    delete: delete_,
    trigger,
    loading,
    error,
  };
};

// ==================== Hook: usePaginatedTable ====================

export const usePaginatedTable<T>(
  data: T[],
  defaultPageSize = 20
) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const totalPages = Math.ceil(data.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = data.slice(startIndex, endIndex);

  const goToPage = useCallback((newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, totalPages)));
  }, [totalPages]);

  return {
    page,
    pageSize,
    setPageSize,
    goToPage,
    totalPages,
    paginatedData,
    startIndex,
    endIndex,
  };
};

// ==================== Hook: useFilteredAndSortedData ====================

export const useFilteredAndSortedData<T extends Record<string, any>>(
  data: T[],
  filters?: Record<string, any>,
  sortField?: keyof T,
  sortDirection: 'asc' | 'desc' = 'asc'
) {
  return data
    .filter((item) => {
      if (!filters) return true;
      return Object.entries(filters).every(([key, value]) => {
        if (value === undefined || value === '') return true;
        const itemValue = item[key];
        if (typeof itemValue === 'string') {
          return itemValue.toLowerCase().includes(String(value).toLowerCase());
        }
        return itemValue === value;
      });
    })
    .sort((a, b) => {
      if (!sortField) return 0;
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
}

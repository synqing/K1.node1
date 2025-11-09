/**
 * Error Recovery Redux Slice
 * Manages retry, circuit breaker, DLQ, and intervention state
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  RetryMetrics,
  CircuitBreakerState,
  DLQEntry,
  Intervention,
  TaskState,
} from '../../types/dashboard';

interface ErrorRecoveryState {
  retryStats: RetryMetrics | null;
  circuitBreakers: Record<string, CircuitBreakerState>;
  dlqEntries: DLQEntry[];
  interventionHistory: Intervention[];
  taskStates: Record<string, TaskState>;
  loading: boolean;
  error: string | null;
  lastUpdate: string | null;
}

const initialState: ErrorRecoveryState = {
  retryStats: null,
  circuitBreakers: {},
  dlqEntries: [],
  interventionHistory: [],
  taskStates: {},
  loading: false,
  error: null,
  lastUpdate: null,
};

const errorRecoverySlice = createSlice({
  name: 'errorRecovery',
  initialState,
  reducers: {
    // Retry metrics actions
    setRetryStats: (state, action: PayloadAction<RetryMetrics>) => {
      state.retryStats = action.payload;
      state.lastUpdate = new Date().toISOString();
      state.error = null;
    },

    // Circuit breaker actions
    updateCircuitBreaker: (
      state,
      action: PayloadAction<CircuitBreakerState>
    ) => {
      state.circuitBreakers[action.payload.breaker_id] = action.payload;
      state.lastUpdate = new Date().toISOString();
      state.error = null;
    },

    setCircuitBreakers: (
      state,
      action: PayloadAction<CircuitBreakerState[]>
    ) => {
      state.circuitBreakers = {};
      action.payload.forEach((breaker) => {
        state.circuitBreakers[breaker.breaker_id] = breaker;
      });
      state.lastUpdate = new Date().toISOString();
      state.error = null;
    },

    // DLQ actions
    setDLQEntries: (state, action: PayloadAction<DLQEntry[]>) => {
      state.dlqEntries = action.payload;
      state.lastUpdate = new Date().toISOString();
      state.error = null;
    },

    addDLQEntry: (state, action: PayloadAction<DLQEntry>) => {
      state.dlqEntries.unshift(action.payload);
      state.lastUpdate = new Date().toISOString();
      state.error = null;
    },

    updateDLQEntry: (
      state,
      action: PayloadAction<{ dlqId: string; updates: Partial<DLQEntry> }>
    ) => {
      const entry = state.dlqEntries.find(
        (e) => e.dlq_id === action.payload.dlqId
      );
      if (entry) {
        Object.assign(entry, action.payload.updates);
        state.lastUpdate = new Date().toISOString();
      }
    },

    removeDLQEntry: (state, action: PayloadAction<string>) => {
      state.dlqEntries = state.dlqEntries.filter(
        (e) => e.dlq_id !== action.payload
      );
      state.lastUpdate = new Date().toISOString();
    },

    // Intervention actions
    setInterventionHistory: (state, action: PayloadAction<Intervention[]>) => {
      state.interventionHistory = action.payload;
      state.lastUpdate = new Date().toISOString();
      state.error = null;
    },

    addIntervention: (state, action: PayloadAction<Intervention>) => {
      state.interventionHistory.unshift(action.payload);
      state.lastUpdate = new Date().toISOString();
      state.error = null;
    },

    // Task state actions
    setTaskState: (state, action: PayloadAction<TaskState>) => {
      state.taskStates[action.payload.task_id] = action.payload;
      state.lastUpdate = new Date().toISOString();
      state.error = null;
    },

    updateTaskState: (
      state,
      action: PayloadAction<{ taskId: string; updates: Partial<TaskState> }>
    ) => {
      const task = state.taskStates[action.payload.taskId];
      if (task) {
        Object.assign(task, action.payload.updates);
        state.lastUpdate = new Date().toISOString();
      }
    },

    // Loading and error actions
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },

    clearError: (state) => {
      state.error = null;
    },

    // Batch update actions
    updateErrorRecoveryMetrics: (
      state,
      action: PayloadAction<{
        retryStats?: RetryMetrics;
        circuitBreakers?: CircuitBreakerState[];
        dlqEntries?: DLQEntry[];
        interventions?: Intervention[];
      }>
    ) => {
      if (action.payload.retryStats) {
        state.retryStats = action.payload.retryStats;
      }
      if (action.payload.circuitBreakers) {
        state.circuitBreakers = {};
        action.payload.circuitBreakers.forEach((breaker) => {
          state.circuitBreakers[breaker.breaker_id] = breaker;
        });
      }
      if (action.payload.dlqEntries) {
        state.dlqEntries = action.payload.dlqEntries;
      }
      if (action.payload.interventions) {
        state.interventionHistory = action.payload.interventions;
      }
      state.lastUpdate = new Date().toISOString();
      state.error = null;
      state.loading = false;
    },

    reset: () => initialState,
  },
});

export const {
  setRetryStats,
  updateCircuitBreaker,
  setCircuitBreakers,
  setDLQEntries,
  addDLQEntry,
  updateDLQEntry,
  removeDLQEntry,
  setInterventionHistory,
  addIntervention,
  setTaskState,
  updateTaskState,
  setLoading,
  setError,
  clearError,
  updateErrorRecoveryMetrics,
  reset,
} = errorRecoverySlice.actions;

export default errorRecoverySlice.reducer;

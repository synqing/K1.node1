/**
 * Scheduling Redux Slice
 * Manages schedules, priority queue, and resource utilization state
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  Schedule,
  QueueStatus,
  ResourceMetrics,
  ResourceLimits,
} from '../../types/dashboard';

interface SchedulingState {
  schedules: Schedule[];
  priorityQueue: QueueStatus | null;
  resourceUsage: ResourceMetrics | null;
  resourceLimits: ResourceLimits;
  loading: boolean;
  error: string | null;
  lastUpdate: string | null;
}

const initialResourceLimits: ResourceLimits = {
  max_concurrent_tasks: 4,
  max_cpu_percent: 80,
  max_memory_percent: 85,
};

const initialState: SchedulingState = {
  schedules: [],
  priorityQueue: null,
  resourceUsage: null,
  resourceLimits: initialResourceLimits,
  loading: false,
  error: null,
  lastUpdate: null,
};

const schedulingSlice = createSlice({
  name: 'scheduling',
  initialState,
  reducers: {
    // Schedule actions
    setSchedules: (state, action: PayloadAction<Schedule[]>) => {
      state.schedules = action.payload;
      state.lastUpdate = new Date().toISOString();
      state.error = null;
      state.loading = false;
    },

    addSchedule: (state, action: PayloadAction<Schedule>) => {
      state.schedules.push(action.payload);
      state.lastUpdate = new Date().toISOString();
      state.error = null;
    },

    updateSchedule: (
      state,
      action: PayloadAction<{ taskId: string; updates: Partial<Schedule> }>
    ) => {
      const schedule = state.schedules.find(
        (s) => s.task_id === action.payload.taskId
      );
      if (schedule) {
        Object.assign(schedule, action.payload.updates);
        state.lastUpdate = new Date().toISOString();
      }
    },

    removeSchedule: (state, action: PayloadAction<string>) => {
      state.schedules = state.schedules.filter(
        (s) => s.task_id !== action.payload
      );
      state.lastUpdate = new Date().toISOString();
    },

    toggleScheduleEnabled: (state, action: PayloadAction<string>) => {
      const schedule = state.schedules.find(
        (s) => s.task_id === action.payload
      );
      if (schedule) {
        schedule.enabled = !schedule.enabled;
        state.lastUpdate = new Date().toISOString();
      }
    },

    // Priority queue actions
    setQueueStatus: (state, action: PayloadAction<QueueStatus>) => {
      state.priorityQueue = action.payload;
      state.lastUpdate = new Date().toISOString();
      state.error = null;
    },

    updateQueueEntry: (
      state,
      action: PayloadAction<{
        taskId: string;
        updates: Partial<QueueStatus>;
      }>
    ) => {
      if (state.priorityQueue) {
        const entry = state.priorityQueue.pending_tasks.find(
          (e) => e.task_id === action.payload.taskId
        );
        if (entry) {
          Object.assign(entry, action.payload.updates);
          state.lastUpdate = new Date().toISOString();
        }
      }
    },

    // Resource usage actions
    setResourceUsage: (state, action: PayloadAction<ResourceMetrics>) => {
      state.resourceUsage = action.payload;
      state.lastUpdate = new Date().toISOString();
      state.error = null;
    },

    updateResourceLimits: (
      state,
      action: PayloadAction<Partial<ResourceLimits>>
    ) => {
      state.resourceLimits = {
        ...state.resourceLimits,
        ...action.payload,
      };
      state.lastUpdate = new Date().toISOString();
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

    // Batch update action
    updateSchedulingMetrics: (
      state,
      action: PayloadAction<{
        schedules?: Schedule[];
        queue?: QueueStatus;
        resourceUsage?: ResourceMetrics;
      }>
    ) => {
      if (action.payload.schedules) {
        state.schedules = action.payload.schedules;
      }
      if (action.payload.queue) {
        state.priorityQueue = action.payload.queue;
      }
      if (action.payload.resourceUsage) {
        state.resourceUsage = action.payload.resourceUsage;
      }
      state.lastUpdate = new Date().toISOString();
      state.error = null;
      state.loading = false;
    },

    reset: () => initialState,
  },
});

export const {
  setSchedules,
  addSchedule,
  updateSchedule,
  removeSchedule,
  toggleScheduleEnabled,
  setQueueStatus,
  updateQueueEntry,
  setResourceUsage,
  updateResourceLimits,
  setLoading,
  setError,
  clearError,
  updateSchedulingMetrics,
  reset,
} = schedulingSlice.actions;

export default schedulingSlice.reducer;

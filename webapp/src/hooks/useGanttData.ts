/**
 * Gantt Chart Data Hook
 *
 * Task T17: Fetch and transform execution history into Gantt format
 * - Fetches from T15 dashboard API (execution history)
 * - Transforms to GanttTask format
 * - Groups by schedule
 * - Calculates timeline bounds
 * - Handles loading/error states
 * - Auto-refetches on interval
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface GanttTask {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number; // 0-100
  dependsOn?: string[]; // task IDs
  duration: number; // ms
}

export interface GanttTimeline {
  minTime: Date;
  maxTime: Date;
  totalDuration: number; // ms
}

export interface GanttData {
  tasks: GanttTask[];
  timeline: GanttTimeline;
  groupedBySchedule: Record<string, GanttTask[]>;
}

export interface UseGanttDataOptions {
  refetchInterval?: number; // ms, default 5000
  apiUrl?: string;
  scheduleId?: string; // Filter by specific schedule
}

interface ExecutionRecord {
  id: string;
  taskId: string;
  taskName: string;
  scheduleId: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  dependencies?: string[];
}

/**
 * Transform execution records to Gantt tasks
 */
function transformToGanttTasks(records: ExecutionRecord[]): GanttTask[] {
  return records.map((record) => {
    const startTime = new Date(record.startTime);
    const endTime = new Date(record.endTime);
    const duration = endTime.getTime() - startTime.getTime();

    return {
      id: record.id,
      title: record.taskName,
      startTime,
      endTime,
      status: record.status,
      progress: record.progress,
      dependsOn: record.dependencies,
      duration: Math.max(duration, 0), // Ensure non-negative
    };
  });
}

/**
 * Calculate timeline bounds from tasks
 */
function calculateTimeline(tasks: GanttTask[]): GanttTimeline {
  if (tasks.length === 0) {
    const now = new Date();
    return {
      minTime: now,
      maxTime: new Date(now.getTime() + 3600000), // 1 hour default span
      totalDuration: 3600000,
    };
  }

  const startTimes = tasks.map((t) => t.startTime.getTime());
  const endTimes = tasks.map((t) => t.endTime.getTime());

  const minTime = new Date(Math.min(...startTimes));
  const maxTime = new Date(Math.max(...endTimes));
  const totalDuration = maxTime.getTime() - minTime.getTime();

  return { minTime, maxTime, totalDuration };
}

/**
 * Group tasks by schedule
 */
function groupBySchedule(tasks: GanttTask[], records: ExecutionRecord[]): Record<string, GanttTask[]> {
  const scheduleMap: Record<string, string[]> = {}; // scheduleId -> taskIds

  records.forEach((record) => {
    if (!scheduleMap[record.scheduleId]) {
      scheduleMap[record.scheduleId] = [];
    }
    scheduleMap[record.scheduleId].push(record.id);
  });

  const grouped: Record<string, GanttTask[]> = {};
  Object.entries(scheduleMap).forEach(([scheduleId, taskIds]) => {
    grouped[scheduleId] = tasks.filter((t) => taskIds.includes(t.id));
  });

  return grouped;
}

/**
 * Hook to fetch and manage Gantt chart data
 */
export function useGanttData({
  refetchInterval = 5000,
  apiUrl = '/api/execution-history',
  scheduleId,
}: UseGanttDataOptions = {}): {
  data: GanttData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<GanttData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Fetch execution history from API
   */
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (scheduleId) {
        params.append('scheduleId', scheduleId);
      }

      const response = await fetch(
        `${apiUrl}${params.toString() ? '?' + params.toString() : ''}`,
        {
          headers: { 'Accept': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const records: ExecutionRecord[] = await response.json();

      if (!isMountedRef.current) return;

      const tasks = transformToGanttTasks(records);
      const timeline = calculateTimeline(tasks);
      const groupedBySchedule = groupBySchedule(tasks, records);

      setData({
        tasks,
        timeline,
        groupedBySchedule,
      });
    } catch (err) {
      if (!isMountedRef.current) return;

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error('Failed to fetch Gantt data:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [apiUrl, scheduleId]);

  /**
   * Setup auto-refetch interval
   */
  useEffect(() => {
    // Initial fetch
    fetchData();

    // Setup interval
    intervalRef.current = setInterval(() => {
      fetchData();
    }, refetchInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, refetchInterval]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}

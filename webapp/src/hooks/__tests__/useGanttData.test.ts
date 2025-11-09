/**
 * Tests for useGanttData hook
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGanttData, type GanttTask, type GanttData } from '../useGanttData';

// Mock fetch globally
global.fetch = vi.fn();

describe('useGanttData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with loading state', () => {
    (global.fetch as any).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { result } = renderHook(() => useGanttData());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should fetch and transform execution data', async () => {
    const mockData = [
      {
        id: 'task-1',
        taskId: 'task-1',
        taskName: 'Task 1',
        scheduleId: 'sched-1',
        startTime: '2024-11-10T10:00:00Z',
        endTime: '2024-11-10T10:05:00Z',
        status: 'completed' as const,
        progress: 100,
      },
      {
        id: 'task-2',
        taskId: 'task-2',
        taskName: 'Task 2',
        scheduleId: 'sched-1',
        startTime: '2024-11-10T10:05:00Z',
        endTime: '2024-11-10T10:10:00Z',
        status: 'running' as const,
        progress: 50,
        dependencies: ['task-1'],
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() => useGanttData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(null);
    expect(result.current.data).toBeDefined();

    const data = result.current.data as GanttData;

    expect(data.tasks).toHaveLength(2);
    expect(data.tasks[0]).toEqual(
      expect.objectContaining({
        id: 'task-1',
        title: 'Task 1',
        status: 'completed',
        progress: 100,
      })
    );

    expect(data.tasks[1]).toEqual(
      expect.objectContaining({
        id: 'task-2',
        title: 'Task 2',
        status: 'running',
        progress: 50,
        dependsOn: ['task-1'],
      })
    );
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const { result } = renderHook(() => useGanttData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toContain('500');
    expect(result.current.data).toBe(null);
  });

  it('should calculate correct timeline bounds', async () => {
    const mockData = [
      {
        id: 'task-1',
        taskId: 'task-1',
        taskName: 'Task 1',
        scheduleId: 'sched-1',
        startTime: '2024-11-10T10:00:00Z',
        endTime: '2024-11-10T10:30:00Z',
        status: 'completed' as const,
      },
      {
        id: 'task-2',
        taskId: 'task-2',
        taskName: 'Task 2',
        scheduleId: 'sched-1',
        startTime: '2024-11-10T10:20:00Z',
        endTime: '2024-11-10T11:00:00Z',
        status: 'completed' as const,
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() => useGanttData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const data = result.current.data as GanttData;

    expect(data.timeline.minTime).toEqual(
      new Date('2024-11-10T10:00:00Z')
    );
    expect(data.timeline.maxTime).toEqual(
      new Date('2024-11-10T11:00:00Z')
    );
    expect(data.timeline.totalDuration).toBe(3600000); // 1 hour in ms
  });

  it('should group tasks by schedule', async () => {
    const mockData = [
      {
        id: 'task-1',
        taskId: 'task-1',
        taskName: 'Task 1',
        scheduleId: 'sched-1',
        startTime: '2024-11-10T10:00:00Z',
        endTime: '2024-11-10T10:05:00Z',
        status: 'completed' as const,
      },
      {
        id: 'task-2',
        taskId: 'task-2',
        taskName: 'Task 2',
        scheduleId: 'sched-2',
        startTime: '2024-11-10T10:05:00Z',
        endTime: '2024-11-10T10:10:00Z',
        status: 'completed' as const,
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() => useGanttData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const data = result.current.data as GanttData;

    expect(Object.keys(data.groupedBySchedule)).toEqual(['sched-1', 'sched-2']);
    expect(data.groupedBySchedule['sched-1']).toHaveLength(1);
    expect(data.groupedBySchedule['sched-2']).toHaveLength(1);
  });

  it('should support schedule ID filtering', async () => {
    const mockData = [
      {
        id: 'task-1',
        taskId: 'task-1',
        taskName: 'Filtered Task',
        scheduleId: 'sched-1',
        startTime: '2024-11-10T10:00:00Z',
        endTime: '2024-11-10T10:05:00Z',
        status: 'completed' as const,
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    renderHook(() => useGanttData({ scheduleId: 'sched-1' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('scheduleId=sched-1'),
        expect.any(Object)
      );
    });
  });

  it('should calculate task durations correctly', async () => {
    const mockData = [
      {
        id: 'task-1',
        taskId: 'task-1',
        taskName: 'Task 1',
        scheduleId: 'sched-1',
        startTime: '2024-11-10T10:00:00Z',
        endTime: '2024-11-10T10:05:30Z',
        status: 'completed' as const,
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() => useGanttData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const data = result.current.data as GanttData;
    const task = data.tasks[0];

    expect(task.duration).toBe(330000); // 5m 30s in ms
  });

  it('should support custom API URL', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    renderHook(() => useGanttData({ apiUrl: '/custom/api/path' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/custom/api/path'),
        expect.any(Object)
      );
    });
  });

  it('should support refetch function', async () => {
    const mockData = [
      {
        id: 'task-1',
        taskId: 'task-1',
        taskName: 'Task 1',
        scheduleId: 'sched-1',
        startTime: '2024-11-10T10:00:00Z',
        endTime: '2024-11-10T10:05:00Z',
        status: 'completed' as const,
      },
    ];

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() => useGanttData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const initialCallCount = (global.fetch as any).mock.calls.length;

    // Call refetch
    await result.current.refetch();

    expect((global.fetch as any).mock.calls.length).toBeGreaterThan(
      initialCallCount
    );
  });

  it('should handle empty task list', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() => useGanttData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const data = result.current.data as GanttData;

    expect(data.tasks).toHaveLength(0);
    expect(data.groupedBySchedule).toEqual({});
    // Should have default timeline
    expect(data.timeline.totalDuration).toBe(3600000);
  });

  it('should cleanup on unmount', () => {
    (global.fetch as any).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { unmount } = renderHook(() => useGanttData());

    // Should not throw
    expect(() => {
      unmount();
    }).not.toThrow();
  });
});

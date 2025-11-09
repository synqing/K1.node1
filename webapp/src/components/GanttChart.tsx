/**
 * Gantt Chart Component
 *
 * Task T17: Production React component for execution timeline visualization
 * - Display tasks/schedules as horizontal bars on timeline
 * - Show start/end times and duration
 * - Color code by status (pending, running, completed, failed)
 * - Show dependencies between tasks
 * - Responsive layout (desktop, tablet, mobile)
 * - Interactive: hover for details, click for full view
 * - Zoom/pan controls for timeline
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useGanttData, type GanttTask, type GanttData } from '../hooks/useGanttData';
import '../styles/gantt-chart.css';

// Status color mapping
const STATUS_COLORS: Record<string, string> = {
  pending: '#e0e0e0',
  running: '#1f7adb',
  completed: '#4caf50',
  failed: '#f44336',
};

const STATUS_COLORS_HOVER: Record<string, string> = {
  pending: '#d0d0d0',
  running: '#165db3',
  completed: '#45a049',
  failed: '#da190b',
};

interface GanttChartProps {
  scheduleId?: string;
  height?: number; // px
  width?: string | number;
  showGrid?: boolean;
  showDependencies?: boolean;
  zoomLevel?: number; // 0.5 to 2
  onTaskClick?: (task: GanttTask) => void;
  apiUrl?: string;
  refetchInterval?: number; // ms
}

interface GanttChartTooltip {
  task: GanttTask;
  x: number;
  y: number;
}

interface SVGDimensions {
  width: number;
  height: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
}

/**
 * Format time for display
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format duration for display
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Calculate task bar position and width
 */
function calculateTaskPosition(
  task: GanttTask,
  timeline: GanttData['timeline'],
  contentWidth: number
): { x: number; width: number } {
  const timelineStart = timeline.minTime.getTime();
  const timelineEnd = timeline.maxTime.getTime();
  const totalTime = timelineEnd - timelineStart;

  if (totalTime === 0) {
    return { x: 0, width: 10 };
  }

  const taskStart = task.startTime.getTime();
  const taskEnd = task.endTime.getTime();

  const x = ((taskStart - timelineStart) / totalTime) * contentWidth;
  const width = Math.max(((taskEnd - taskStart) / totalTime) * contentWidth, 2);

  return { x, width };
}

/**
 * GanttChart Component
 */
export const GanttChart: React.FC<GanttChartProps> = ({
  scheduleId,
  height = 400,
  width = '100%',
  showGrid = true,
  showDependencies = true,
  zoomLevel: initialZoom = 1,
  onTaskClick,
  apiUrl = '/api/execution-history',
  refetchInterval = 5000,
}) => {
  const { data, isLoading, error, refetch } = useGanttData({
    scheduleId,
    apiUrl,
    refetchInterval,
  });

  const [tooltip, setTooltip] = useState<GanttChartTooltip | null>(null);
  const [zoomLevel, setZoomLevel] = useState(initialZoom);
  const [panX, setPanX] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // SVG dimensions
  const svgDims: SVGDimensions = useMemo(() => {
    return {
      width: typeof width === 'number' ? width : 800,
      height,
      marginLeft: 200,
      marginRight: 20,
      marginTop: 30,
      marginBottom: 30,
    };
  }, [width, height]);

  const contentWidth = svgDims.width - svgDims.marginLeft - svgDims.marginRight;
  const contentHeight = svgDims.height - svgDims.marginTop - svgDims.marginBottom;

  if (error) {
    return (
      <div className="gantt-error">
        <p>Error loading Gantt chart: {error.message}</p>
        <button onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="gantt-loading">
        <div className="gantt-spinner" />
        <p>Loading execution timeline...</p>
      </div>
    );
  }

  const tasks = data.tasks;
  const timeline = data.timeline;

  if (tasks.length === 0) {
    return (
      <div className="gantt-empty">
        <p>No execution history available</p>
      </div>
    );
  }

  // Time axis grid generation
  const timeSteps: Date[] = [];
  const intervalMs = timeline.totalDuration / 5; // 5 grid lines
  for (let i = 0; i <= 5; i++) {
    timeSteps.push(new Date(timeline.minTime.getTime() + i * intervalMs));
  }

  /**
   * Handle mouse move for tooltip
   */
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - svgDims.marginLeft;
    const mouseY = e.clientY - rect.top - svgDims.marginTop;

    // Find hovered task
    const taskRowHeight = contentHeight / tasks.length;
    const hoveredTaskIdx = Math.floor(mouseY / taskRowHeight);

    if (hoveredTaskIdx >= 0 && hoveredTaskIdx < tasks.length) {
      const task = tasks[hoveredTaskIdx];
      const taskPos = calculateTaskPosition(task, timeline, contentWidth);

      if (mouseX >= taskPos.x && mouseX <= taskPos.x + taskPos.width) {
        setTooltip({
          task,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        return;
      }
    }

    setTooltip(null);
  };

  /**
   * Handle task click
   */
  const handleTaskClick = (task: GanttTask) => {
    onTaskClick?.(task);
  };

  /**
   * Handle zoom
   */
  const handleZoom = (direction: 'in' | 'out') => {
    setZoomLevel((prev) => {
      const newZoom = direction === 'in' ? prev * 1.2 : prev / 1.2;
      return Math.min(Math.max(newZoom, 0.5), 2);
    });
  };

  return (
    <div className="gantt-container" ref={containerRef}>
      {/* Controls */}
      <div className="gantt-controls">
        <div className="gantt-zoom">
          <button
            onClick={() => handleZoom('out')}
            title="Zoom out"
            disabled={zoomLevel <= 0.5}
          >
            -
          </button>
          <span>{Math.round(zoomLevel * 100)}%</span>
          <button
            onClick={() => handleZoom('in')}
            title="Zoom in"
            disabled={zoomLevel >= 2}
          >
            +
          </button>
        </div>
        <button onClick={() => refetch()} title="Refresh data" className="gantt-refresh">
          Refresh
        </button>
      </div>

      {/* Gantt Chart SVG */}
      <div className="gantt-chart-wrapper">
        <svg
          ref={svgRef}
          width={svgDims.width}
          height={svgDims.height}
          className="gantt-chart"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Axis Labels - Left */}
          <g className="gantt-axis-left">
            {tasks.map((task, idx) => (
              <text
                key={`label-${task.id}`}
                x={svgDims.marginLeft - 10}
                y={
                  svgDims.marginTop +
                  (contentHeight / tasks.length) * (idx + 0.5) +
                  5
                }
                textAnchor="end"
                className="gantt-label"
              >
                {task.title.substring(0, 20)}
              </text>
            ))}
          </g>

          {/* Time Axis - Top */}
          <g className="gantt-axis-top">
            {timeSteps.map((time, idx) => {
              const x =
                svgDims.marginLeft +
                ((time.getTime() - timeline.minTime.getTime()) /
                  timeline.totalDuration) *
                  contentWidth;

              return (
                <g key={`time-${idx}`}>
                  {showGrid && (
                    <line
                      x1={x}
                      y1={svgDims.marginTop}
                      x2={x}
                      y2={svgDims.height - svgDims.marginBottom}
                      className="gantt-grid-line"
                    />
                  )}
                  <text
                    x={x}
                    y={svgDims.marginTop - 5}
                    textAnchor="middle"
                    className="gantt-time-label"
                  >
                    {formatTime(time)}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Dependency Lines */}
          {showDependencies &&
            tasks.map((task) => {
              if (!task.dependsOn || task.dependsOn.length === 0) {
                return null;
              }

              return task.dependsOn.map((depId) => {
                const depTask = tasks.find((t) => t.id === depId);
                if (!depTask) return null;

                const depIdx = tasks.indexOf(depTask);
                const taskIdx = tasks.indexOf(task);

                const depPos = calculateTaskPosition(depTask, timeline, contentWidth);
                const taskPos = calculateTaskPosition(task, timeline, contentWidth);

                const depY =
                  svgDims.marginTop +
                  (contentHeight / tasks.length) * (depIdx + 0.5);
                const taskY =
                  svgDims.marginTop +
                  (contentHeight / tasks.length) * (taskIdx + 0.5);

                const depX1 =
                  svgDims.marginLeft + depPos.x + depPos.width;
                const depX2 = svgDims.marginLeft + taskPos.x;

                return (
                  <path
                    key={`dep-${task.id}-${depId}`}
                    d={`M ${depX1} ${depY} L ${depX2} ${taskY}`}
                    className="gantt-dependency"
                  />
                );
              });
            })}

          {/* Task Bars */}
          {tasks.map((task, idx) => {
            const pos = calculateTaskPosition(task, timeline, contentWidth);
            const y = svgDims.marginTop + (contentHeight / tasks.length) * idx;
            const barHeight = Math.max(contentHeight / tasks.length - 4, 12);

            return (
              <g key={`task-${task.id}`}>
                {/* Task Bar */}
                <rect
                  x={svgDims.marginLeft + pos.x}
                  y={y + (contentHeight / tasks.length - barHeight) / 2}
                  width={pos.width}
                  height={barHeight}
                  fill={STATUS_COLORS[task.status]}
                  className="gantt-task-bar"
                  onClick={() => handleTaskClick(task)}
                  onMouseEnter={(e) => {
                    const rect = (e.target as SVGElement).getBoundingClientRect();
                    setTooltip({
                      task,
                      x: rect.left,
                      y: rect.top,
                    });
                  }}
                  onMouseLeave={() => {
                    setTooltip(null);
                  }}
                  style={{
                    cursor: 'pointer',
                  }}
                />

                {/* Progress Indicator */}
                {task.progress !== undefined && task.progress > 0 && (
                  <rect
                    x={svgDims.marginLeft + pos.x}
                    y={y + (contentHeight / tasks.length - barHeight) / 2}
                    width={(pos.width * task.progress) / 100}
                    height={barHeight}
                    fill={STATUS_COLORS[task.status]}
                    opacity={0.6}
                    className="gantt-progress"
                  />
                )}

                {/* Task Label (if bar is wide enough) */}
                {pos.width > 50 && (
                  <text
                    x={svgDims.marginLeft + pos.x + pos.width / 2}
                    y={y + contentHeight / tasks.length / 2 + 4}
                    textAnchor="middle"
                    className="gantt-task-label"
                    pointerEvents="none"
                  >
                    {task.title.substring(0, 10)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="gantt-tooltip"
          style={{
            left: `${tooltip.x + 10}px`,
            top: `${tooltip.y + 10}px`,
          }}
        >
          <div className="gantt-tooltip-title">{tooltip.task.title}</div>
          <div className="gantt-tooltip-info">
            <span className="gantt-tooltip-label">Status:</span>
            <span
              className="gantt-tooltip-status"
              style={{
                color: STATUS_COLORS[tooltip.task.status],
              }}
            >
              {tooltip.task.status}
            </span>
          </div>
          <div className="gantt-tooltip-info">
            <span className="gantt-tooltip-label">Start:</span>
            <span>{formatTime(tooltip.task.startTime)}</span>
          </div>
          <div className="gantt-tooltip-info">
            <span className="gantt-tooltip-label">End:</span>
            <span>{formatTime(tooltip.task.endTime)}</span>
          </div>
          <div className="gantt-tooltip-info">
            <span className="gantt-tooltip-label">Duration:</span>
            <span>{formatDuration(tooltip.task.duration)}</span>
          </div>
          {tooltip.task.progress !== undefined && (
            <div className="gantt-tooltip-info">
              <span className="gantt-tooltip-label">Progress:</span>
              <span>{tooltip.task.progress}%</span>
            </div>
          )}
        </div>
      )}

      {/* Status Legend */}
      <div className="gantt-legend">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="gantt-legend-item">
            <div
              className="gantt-legend-color"
              style={{ backgroundColor: color }}
            />
            <span>{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GanttChart;

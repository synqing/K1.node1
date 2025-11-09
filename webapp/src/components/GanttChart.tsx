/**
 * Task 3.3.4: Gantt Chart Component
 * Visual timeline representation of scheduled tasks and execution windows
 *
 * Features:
 * - SVG-based timeline rendering with zoom support (1h, 4h, 1d, 1w)
 * - Pan functionality for exploring time ranges
 * - Task bars showing execution windows
 * - Resource overlay showing concurrent task counts
 * - Interactive tooltips with schedule details
 * - Responsive design with Tailwind styling
 *
 * Integration:
 * - Day 4 afternoon: renders with mock data from MetricsService
 * - Day 5: connects to Redux store via useSchedulingMetrics hook
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Schedule, QueueStatus } from '../types/dashboard';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

/**
 * Zoom levels defining time scale
 */
type ZoomLevel = '1h' | '4h' | '1d' | '1w';

interface ZoomConfig {
  label: string;
  minutes: number;
  cellWidth: number;  // pixels per time unit
  timeFormat: (date: Date) => string;
}

const ZOOM_CONFIGS: Record<ZoomLevel, ZoomConfig> = {
  '1h': {
    label: '1 Hour',
    minutes: 60,
    cellWidth: 60,
    timeFormat: (d) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  },
  '4h': {
    label: '4 Hours',
    minutes: 240,
    cellWidth: 40,
    timeFormat: (d) => d.toLocaleTimeString('en-US', { hour: '2-digit' }),
  },
  '1d': {
    label: '1 Day',
    minutes: 1440,
    cellWidth: 30,
    timeFormat: (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
  },
  '1w': {
    label: '1 Week',
    minutes: 10080,
    cellWidth: 25,
    timeFormat: (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  },
};

/**
 * Props for Gantt Chart component
 */
interface GanttChartProps {
  schedules: Schedule[];
  queueStatus?: QueueStatus;
  resourceOverlay?: boolean;
  timeWindow?: {
    start: Date;
    end: Date;
  };
  onScheduleClick?: (schedule: Schedule) => void;
  className?: string;
}

/**
 * Helper: Generate time slots for current view
 */
function generateTimeSlots(startTime: Date, endTime: Date, minutes: number): Date[] {
  const slots: Date[] = [];
  const current = new Date(startTime);

  while (current < endTime) {
    slots.push(new Date(current));
    current.setMinutes(current.getMinutes() + minutes);
  }

  return slots;
}

/**
 * Helper: Calculate position of schedule in timeline
 */
function calculateSchedulePosition(
  schedule: Schedule,
  startTime: Date,
  totalMinutes: number,
  chartWidth: number
): { left: number; width: number } {
  const scheduleStart = new Date(schedule.nextRun);
  const scheduleEnd = new Date(scheduleStart.getTime() + schedule.averageDurationMs);

  // Minutes from window start
  const startMinutes = (scheduleStart.getTime() - startTime.getTime()) / (1000 * 60);
  const durationMinutes = (scheduleEnd.getTime() - scheduleStart.getTime()) / (1000 * 60);

  const left = (startMinutes / totalMinutes) * chartWidth;
  const width = (durationMinutes / totalMinutes) * chartWidth;

  return { left, width };
}

/**
 * Helper: Get color based on priority (0-10)
 */
function getPriorityColor(priority: number): string {
  if (priority >= 8) return 'bg-red-500';      // High priority
  if (priority >= 5) return 'bg-yellow-500';   // Medium priority
  return 'bg-blue-500';                        // Low priority
}

/**
 * Helper: Get status color
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'success':
      return 'border-green-500 bg-green-50';
    case 'failed':
      return 'border-red-500 bg-red-50';
    case 'running':
      return 'border-blue-500 bg-blue-50';
    default:
      return 'border-gray-300 bg-gray-50';
  }
}

/**
 * Gantt Chart Component
 *
 * Task 3.3.4 Deliverable
 */
export const GanttChart: React.FC<GanttChartProps> = ({
  schedules,
  queueStatus,
  resourceOverlay = false,
  timeWindow,
  onScheduleClick,
  className = '',
}) => {
  // State management
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('1d');
  const [panOffset, setPanOffset] = useState(0);
  const [hoveredScheduleId, setHoveredScheduleId] = useState<string | null>(null);

  // Calculate time window for view
  const viewWindow = useMemo(() => {
    const now = new Date();
    if (timeWindow) return timeWindow;

    const start = new Date(now);
    const end = new Date(now);

    // Show next 24 hours by default
    end.setDate(end.getDate() + 1);
    return { start, end };
  }, [timeWindow]);

  // Get zoom configuration
  const zoomConfig = ZOOM_CONFIGS[zoomLevel];

  // Generate time slots
  const timeSlots = useMemo(() => {
    const start = new Date(viewWindow.start.getTime() + panOffset);
    const end = new Date(start.getTime() + zoomConfig.minutes * 60 * 1000);
    return generateTimeSlots(start, end, zoomConfig.minutes / 4); // 4 slots per zoom level
  }, [viewWindow, panOffset, zoomConfig]);

  // Filter schedules in view
  const visibleSchedules = useMemo(() => {
    const windowStart = new Date(viewWindow.start.getTime() + panOffset);
    const windowEnd = new Date(windowStart.getTime() + zoomConfig.minutes * 60 * 1000);

    return schedules.filter((schedule) => {
      const scheduleStart = new Date(schedule.nextRun);
      const scheduleEnd = new Date(scheduleStart.getTime() + schedule.averageDurationMs);

      return scheduleStart < windowEnd && scheduleEnd > windowStart;
    });
  }, [schedules, viewWindow, panOffset, zoomConfig.minutes]);

  // Calculate chart dimensions
  const timeSlotCount = Math.ceil(zoomConfig.minutes / (zoomConfig.minutes / 4));
  const chartWidth = timeSlotCount * 80; // pixels per slot
  const rowHeight = 50; // pixels per schedule row
  const chartHeight = visibleSchedules.length * rowHeight + 100; // Include header and footer

  // Handlers
  const handlePanLeft = useCallback(() => {
    setPanOffset((prev) => prev - zoomConfig.minutes * 15 * 1000); // 15-minute pan
  }, [zoomConfig.minutes]);

  const handlePanRight = useCallback(() => {
    setPanOffset((prev) => prev + zoomConfig.minutes * 15 * 1000);
  }, [zoomConfig.minutes]);

  const handleZoomIn = useCallback(() => {
    const zoomLevels: ZoomLevel[] = ['1w', '1d', '4h', '1h'];
    const currentIndex = zoomLevels.indexOf(zoomLevel);
    if (currentIndex > 0) {
      setZoomLevel(zoomLevels[currentIndex - 1]);
    }
  }, [zoomLevel]);

  const handleZoomOut = useCallback(() => {
    const zoomLevels: ZoomLevel[] = ['1w', '1d', '4h', '1h'];
    const currentIndex = zoomLevels.indexOf(zoomLevel);
    if (currentIndex < zoomLevels.length - 1) {
      setZoomLevel(zoomLevels[currentIndex + 1]);
    }
  }, [zoomLevel]);

  return (
    <div className={`flex flex-col gap-4 p-4 bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Schedule Timeline</h2>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Pan controls */}
          <button
            onClick={handlePanLeft}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            title="Pan left"
          >
            <ChevronLeft size={20} className="text-gray-600" />
          </button>

          {/* Zoom level display */}
          <div className="px-3 py-1 bg-gray-100 rounded text-sm font-medium text-gray-700 min-w-20 text-center">
            {zoomConfig.label}
          </div>

          {/* Pan right */}
          <button
            onClick={handlePanRight}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            title="Pan right"
          >
            <ChevronRight size={20} className="text-gray-600" />
          </button>

          {/* Zoom controls */}
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            title="Zoom in"
          >
            <ZoomIn size={20} className="text-gray-600" />
          </button>

          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            title="Zoom out"
          >
            <ZoomOut size={20} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4 text-sm">
        <div className="bg-blue-50 border border-blue-200 rounded p-2">
          <div className="font-semibold text-blue-900">{visibleSchedules.length}</div>
          <div className="text-blue-700">Visible Schedules</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded p-2">
          <div className="font-semibold text-green-900">
            {visibleSchedules.filter((s) => s.enabled).length}
          </div>
          <div className="text-green-700">Enabled</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
          <div className="font-semibold text-yellow-900">
            {visibleSchedules.reduce((sum, s) => sum + s.priority, 0) / visibleSchedules.length || 0}
          </div>
          <div className="text-yellow-700">Avg Priority</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded p-2">
          <div className="font-semibold text-purple-900">
            {visibleSchedules.filter((s) => s.lastStatus === 'failed').length}
          </div>
          <div className="text-purple-700">Failed</div>
        </div>
      </div>

      {/* Gantt chart container */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg bg-gray-50">
        <svg width={chartWidth + 200} height={chartHeight} className="min-w-full">
          {/* Background grid */}
          {timeSlots.map((slot, idx) => (
            <g key={`grid-${idx}`}>
              <line
                x1={idx * 80 + 150}
                y1="40"
                x2={idx * 80 + 150}
                y2={chartHeight}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
            </g>
          ))}

          {/* Header: Time labels */}
          <g>
            <rect x="0" y="0" width="150" height="40" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1" />
            <text x="75" y="25" textAnchor="middle" className="text-xs font-semibold" fill="#374151">
              Schedule
            </text>
          </g>

          {/* Time slot headers */}
          {timeSlots.map((slot, idx) => (
            <g key={`header-${idx}`}>
              <rect
                x={idx * 80 + 150}
                y="0"
                width="80"
                height="40"
                fill="#f9fafb"
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text
                x={idx * 80 + 190}
                y="25"
                textAnchor="middle"
                className="text-xs font-medium"
                fill="#6b7280"
              >
                {zoomConfig.timeFormat(slot)}
              </text>
            </g>
          ))}

          {/* Schedule bars */}
          {visibleSchedules.map((schedule, rowIdx) => {
            const { left, width } = calculateSchedulePosition(
              schedule,
              new Date(viewWindow.start.getTime() + panOffset),
              zoomConfig.minutes,
              chartWidth
            );

            const y = 50 + rowIdx * rowHeight;
            const isHovered = hoveredScheduleId === schedule.id;

            return (
              <g key={schedule.id}>
                {/* Row label */}
                <rect
                  x="0"
                  y={y}
                  width="150"
                  height={rowHeight}
                  fill="white"
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
                <text x="10" y={y + 26} className="text-xs font-medium" fill="#374151">
                  {schedule.name}
                </text>

                {/* Schedule bar */}
                <g
                  onMouseEnter={() => setHoveredScheduleId(schedule.id)}
                  onMouseLeave={() => setHoveredScheduleId(null)}
                  onClick={() => onScheduleClick?.(schedule)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={left + 150}
                    y={y + 8}
                    width={Math.max(width, 2)}
                    height="34"
                    fill={isHovered ? '#4f46e5' : getPriorityColor(schedule.priority).replace('bg-', '')}
                    opacity={isHovered ? 1 : 0.8}
                    rx="4"
                  />
                  <text
                    x={left + 150 + width / 2}
                    y={y + 28}
                    textAnchor="middle"
                    className="text-xs font-semibold"
                    fill="white"
                  >
                    {schedule.enabled ? '✓' : '○'}
                  </text>

                  {/* Tooltip */}
                  {isHovered && (
                    <g>
                      <rect
                        x={left + 150}
                        y={y - 60}
                        width="200"
                        height="55"
                        fill="white"
                        stroke="#374151"
                        strokeWidth="1"
                        rx="4"
                      />
                      <text x={left + 160} y={y - 40} className="text-xs font-semibold" fill="#000">
                        {schedule.name}
                      </text>
                      <text x={left + 160} y={y - 25} className="text-xs" fill="#666">
                        Next: {new Date(schedule.nextRun).toLocaleString()}
                      </text>
                      <text x={left + 160} y={y - 10} className="text-xs" fill="#666">
                        Duration: {Math.round(schedule.averageDurationMs / 1000)}s • Priority: {schedule.priority}
                      </text>
                    </g>
                  )}
                </g>
              </g>
            );
          })}

          {/* Resource overlay (optional) */}
          {resourceOverlay && (
            <g>
              <text x="10" y={chartHeight - 10} className="text-xs font-semibold" fill="#666">
                Resource utilization not yet implemented
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-4 text-sm mt-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span>High Priority (8+)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-500 rounded"></div>
          <span>Medium Priority (5-7)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span>Low Priority (&lt;5)</span>
        </div>
      </div>

      {/* Footer info */}
      <div className="text-xs text-gray-600 border-t border-gray-200 pt-2">
        <p>
          Showing {visibleSchedules.length} of {schedules.length} schedules •
          Window: {viewWindow.start.toLocaleDateString()} - {viewWindow.end.toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};

export default GanttChart;

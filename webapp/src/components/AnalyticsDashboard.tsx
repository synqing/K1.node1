/**
 * Task 3.3.5: Analytics Dashboard
 * 7 specialized panels for monitoring error recovery and scheduling metrics
 *
 * Panels:
 * 1. RetryAnalyticsPanel     - Retry success rate gauge
 * 2. CircuitBreakerPanel     - Circuit breaker state monitor
 * 3. DLQPanel                - Dead Letter Queue status
 * 4. TaskInterventionPanel   - Manual task interventions log
 * 5. PriorityQueuePanel      - Queue distribution by priority
 * 6. ScheduleManagementPanel - Active schedules statistics
 * 7. ResourceUtilizationPanel- CPU/Memory usage charts
 *
 * Integration:
 * - Day 4 afternoon: renders with mock data from MetricsService
 * - Day 5: connects to Redux store via useErrorRecoveryMetrics & useSchedulingMetrics hooks
 */

import React, { useMemo } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Activity,
  Zap,
  BarChart3,
} from 'lucide-react';
import {
  RetryMetrics,
  CircuitBreakerState,
  DLQEntry,
  Schedule,
  QueueStatus,
  ResourceMetrics,
} from '../types/dashboard';

/**
 * ============================================================================
 * Panel 1: Retry Analytics Panel
 * ============================================================================
 * Displays retry success rate as a gauge chart
 */
interface RetryAnalyticsPanelProps {
  retryMetrics: RetryMetrics;
}

export const RetryAnalyticsPanel: React.FC<RetryAnalyticsPanelProps> = ({ retryMetrics }) => {
  const successRate = retryMetrics.retrySuccessRate || 0;
  const gaugeFill = successRate / 100;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Retry Success Rate</h3>
        <CheckCircle size={24} className="text-green-600" />
      </div>

      {/* Gauge chart */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-48 h-24 relative">
          <svg viewBox="0 0 200 100" className="w-full h-full">
            {/* Background arc */}
            <path
              d="M 20 80 A 60 60 0 0 1 180 80"
              stroke="#e5e7eb"
              strokeWidth="8"
              fill="none"
            />
            {/* Filled arc */}
            <path
              d="M 20 80 A 60 60 0 0 1 180 80"
              stroke={successRate >= 90 ? '#10b981' : successRate >= 70 ? '#f59e0b' : '#ef4444'}
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${Math.PI * 60 * gaugeFill} ${Math.PI * 60}`}
              strokeLinecap="round"
            />
            {/* Center text */}
            <text x="100" y="55" textAnchor="middle" className="text-4xl font-bold fill-gray-900">
              {successRate.toFixed(1)}%
            </text>
          </svg>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 w-full text-sm">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {retryMetrics.totalRetries.toLocaleString()}
            </div>
            <div className="text-gray-600">Total Retries</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-green-600">
              {retryMetrics.successfulRetries.toLocaleString()}
            </div>
            <div className="text-gray-600">Successful</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-red-600">
              {retryMetrics.failedRetries.toLocaleString()}
            </div>
            <div className="text-gray-600">Failed</div>
          </div>
        </div>

        {/* Average attempts */}
        <div className="w-full bg-blue-50 border border-blue-200 rounded p-3 text-sm">
          <div className="text-blue-900 font-semibold">Avg Attempts: {retryMetrics.averageAttemptsPerTask.toFixed(1)}</div>
          <div className="text-blue-700 text-xs">Avg Delay: {(retryMetrics.averageRetryDelayMs / 1000).toFixed(1)}s</div>
        </div>
      </div>
    </div>
  );
};

/**
 * ============================================================================
 * Panel 2: Circuit Breaker Panel
 * ============================================================================
 * Monitors circuit breaker states
 */
interface CircuitBreakerPanelProps {
  circuitBreakers: CircuitBreakerState[];
}

export const CircuitBreakerPanel: React.FC<CircuitBreakerPanelProps> = ({ circuitBreakers }) => {
  const stats = useMemo(() => {
    const closed = circuitBreakers.filter((cb) => cb.state === 'closed').length;
    const open = circuitBreakers.filter((cb) => cb.state === 'open').length;
    const halfOpen = circuitBreakers.filter((cb) => cb.state === 'half-open').length;

    return { closed, open, halfOpen };
  }, [circuitBreakers]);

  const getStatusColor = (state: 'open' | 'closed' | 'half-open') => {
    switch (state) {
      case 'closed':
        return 'bg-green-50 border-green-200 text-green-900';
      case 'open':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'half-open':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Circuit Breakers</h3>
        <Zap size={24} className="text-yellow-600" />
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-green-50 border border-green-200 rounded p-3 text-center">
          <div className="text-2xl font-bold text-green-900">{stats.closed}</div>
          <div className="text-sm text-green-700">Closed</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-center">
          <div className="text-2xl font-bold text-yellow-900">{stats.halfOpen}</div>
          <div className="text-sm text-yellow-700">Half-Open</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded p-3 text-center">
          <div className="text-2xl font-bold text-red-900">{stats.open}</div>
          <div className="text-sm text-red-700">Open</div>
        </div>
      </div>

      {/* Breaker list */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {circuitBreakers.map((breaker) => (
          <div key={breaker.id} className={`border rounded p-3 ${getStatusColor(breaker.state)}`}>
            <div className="flex items-center justify-between">
              <div className="font-medium">{breaker.serviceName}</div>
              <span className="px-2 py-1 rounded text-xs font-semibold bg-opacity-20 bg-current">
                {breaker.state.toUpperCase()}
              </span>
            </div>
            <div className="text-xs mt-1 opacity-75">
              Failures: {breaker.failureCount} / {breaker.failureThreshold}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * ============================================================================
 * Panel 3: DLQ Panel
 * ============================================================================
 * Dead Letter Queue status and resubmission tracking
 */
interface DLQPanelProps {
  dlqStats: {
    total: number;
    pending: number;
    deadLettered: number;
    successRate: number;
  };
}

export const DLQPanel: React.FC<DLQPanelProps> = ({ dlqStats }) => {
  const pendingPercent = (dlqStats.pending / dlqStats.total) * 100;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Dead Letter Queue</h3>
        <AlertCircle size={24} className="text-red-600" />
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-3xl font-bold text-gray-900">{dlqStats.total}</div>
          <div className="text-sm text-gray-600">Total Entries</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-orange-600">{dlqStats.pending}</div>
          <div className="text-sm text-gray-600">Pending</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs font-medium text-gray-700 mb-1">
          <span>Pending / Total</span>
          <span>{pendingPercent.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-orange-500 h-2 rounded-full transition-all"
            style={{ width: `${pendingPercent}%` }}
          ></div>
        </div>
      </div>

      {/* Historical success rate */}
      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
        <div className="text-blue-900 font-semibold">Historical Success Rate</div>
        <div className="text-2xl font-bold text-blue-600">{dlqStats.successRate.toFixed(1)}%</div>
      </div>

      {/* Dead lettered info */}
      <div className="mt-3 text-xs text-gray-600">
        <p className="font-medium mb-1">Dead Lettered: {dlqStats.deadLettered}</p>
        <p>Tasks that permanently failed after retries</p>
      </div>
    </div>
  );
};

/**
 * ============================================================================
 * Panel 4: Task Intervention Panel
 * ============================================================================
 * Manual task interventions log
 */
interface TaskInterventionPanelProps {
  interventions: Array<{
    taskId: string;
    type: 'pause' | 'resume' | 'skip' | 'retry';
    timestamp: string;
    reason: string;
  }>;
}

export const TaskInterventionPanel: React.FC<TaskInterventionPanelProps> = ({ interventions }) => {
  const getInterventionColor = (type: string) => {
    switch (type) {
      case 'pause':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'resume':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'skip':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'retry':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Task Interventions</h3>
        <Activity size={24} className="text-blue-600" />
      </div>

      {interventions.length > 0 ? (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {interventions.map((intervention, idx) => (
            <div key={idx} className={`border rounded p-3 ${getInterventionColor(intervention.type)}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold text-sm">{intervention.taskId}</div>
                <span className="text-xs font-bold uppercase opacity-75">{intervention.type}</span>
              </div>
              <div className="text-xs opacity-75 mb-1">{intervention.reason}</div>
              <div className="text-xs opacity-50">{new Date(intervention.timestamp).toLocaleString()}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500">
          <p>No interventions recorded</p>
        </div>
      )}
    </div>
  );
};

/**
 * ============================================================================
 * Panel 5: Priority Queue Panel
 * ============================================================================
 * Queue distribution by priority level
 */
interface PriorityQueuePanelProps {
  queueStatus: QueueStatus;
}

export const PriorityQueuePanel: React.FC<PriorityQueuePanelProps> = ({ queueStatus }) => {
  const priorityBuckets = useMemo(() => {
    const buckets = {
      critical: queueStatus.pendingTasks?.filter((t) => t.priority >= 8).length || 0,
      high: queueStatus.pendingTasks?.filter((t) => t.priority >= 5 && t.priority < 8).length || 0,
      medium: queueStatus.pendingTasks?.filter((t) => t.priority >= 3 && t.priority < 5).length || 0,
      low: queueStatus.pendingTasks?.filter((t) => t.priority < 3).length || 0,
    };
    return buckets;
  }, [queueStatus]);

  const total = queueStatus.totalPending || 1;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Priority Queue</h3>
        <TrendingUp size={24} className="text-purple-600" />
      </div>

      {/* Queue distribution */}
      <div className="space-y-3 mb-4">
        {[
          { label: 'Critical (8+)', count: priorityBuckets.critical, color: 'bg-red-500' },
          { label: 'High (5-7)', count: priorityBuckets.high, color: 'bg-orange-500' },
          { label: 'Medium (3-4)', count: priorityBuckets.medium, color: 'bg-yellow-500' },
          { label: 'Low (<3)', count: priorityBuckets.low, color: 'bg-blue-500' },
        ].map(({ label, count, color }) => (
          <div key={label}>
            <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
              <span>{label}</span>
              <span>{count}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`${color} h-2 rounded-full transition-all`}
                style={{ width: `${(count / total) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* Queue stats */}
      <div className="border-t border-gray-200 pt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="font-semibold text-gray-900">{queueStatus.totalPending}</div>
          <div className="text-gray-600">Pending</div>
        </div>
        <div>
          <div className="font-semibold text-gray-900">{queueStatus.totalRunning}</div>
          <div className="text-gray-600">Running</div>
        </div>
      </div>
    </div>
  );
};

/**
 * ============================================================================
 * Panel 6: Schedule Management Panel
 * ============================================================================
 * Active schedules statistics
 */
interface ScheduleManagementPanelProps {
  schedules: Schedule[];
}

export const ScheduleManagementPanel: React.FC<ScheduleManagementPanelProps> = ({ schedules }) => {
  const stats = useMemo(() => {
    return {
      total: schedules.length,
      enabled: schedules.filter((s) => s.enabled).length,
      cron: schedules.filter((s) => s.type === 'cron').length,
      event: schedules.filter((s) => s.type === 'event').length,
      failed: schedules.filter((s) => s.lastStatus === 'failed').length,
    };
  }, [schedules]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Schedule Management</h3>
        <Clock size={24} className="text-cyan-600" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-purple-50 border border-purple-200 rounded p-3 text-center">
          <div className="text-2xl font-bold text-purple-900">{stats.total}</div>
          <div className="text-sm text-purple-700">Total</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded p-3 text-center">
          <div className="text-2xl font-bold text-green-900">{stats.enabled}</div>
          <div className="text-sm text-green-700">Enabled</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-center">
          <div className="text-2xl font-bold text-blue-900">{stats.cron}</div>
          <div className="text-sm text-blue-700">Cron</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded p-3 text-center">
          <div className="text-2xl font-bold text-orange-900">{stats.event}</div>
          <div className="text-sm text-orange-700">Event</div>
        </div>
      </div>

      {/* Failed schedules warning */}
      {stats.failed > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm">
          <div className="text-red-900 font-semibold">⚠ {stats.failed} Failed</div>
          <div className="text-red-700">Schedules with recent failures</div>
        </div>
      )}
    </div>
  );
};

/**
 * ============================================================================
 * Panel 7: Resource Utilization Panel
 * ============================================================================
 * CPU and memory usage visualization
 */
interface ResourceUtilizationPanelProps {
  resourceUsage: ResourceMetrics;
  resourceLimits?: {
    maxCpuPercent: number;
    maxMemoryPercent: number;
    maxConcurrent: number;
  };
}

export const ResourceUtilizationPanel: React.FC<ResourceUtilizationPanelProps> = ({
  resourceUsage,
  resourceLimits,
}) => {
  const cpuPercent = resourceUsage.cpuUsage || 0;
  const memoryPercent = resourceUsage.memoryUsage || 0;

  const getUtilizationColor = (percent: number) => {
    if (percent > 85) return 'text-red-600';
    if (percent > 70) return 'text-orange-600';
    return 'text-green-600';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Resource Utilization</h3>
        <BarChart3 size={24} className="text-indigo-600" />
      </div>

      {/* CPU gauge */}
      <div className="mb-6">
        <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
          <span>CPU Usage</span>
          <span className={getUtilizationColor(cpuPercent)}>
            {cpuPercent.toFixed(1)}% {resourceLimits && `/ ${resourceLimits.maxCpuPercent}%`}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`${
              cpuPercent > 85
                ? 'bg-red-500'
                : cpuPercent > 70
                  ? 'bg-orange-500'
                  : 'bg-green-500'
            } h-3 rounded-full transition-all`}
            style={{ width: `${Math.min(cpuPercent, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Memory gauge */}
      <div className="mb-6">
        <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
          <span>Memory Usage</span>
          <span className={getUtilizationColor(memoryPercent)}>
            {memoryPercent.toFixed(1)}% {resourceLimits && `/ ${resourceLimits.maxMemoryPercent}%`}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`${
              memoryPercent > 85
                ? 'bg-red-500'
                : memoryPercent > 70
                  ? 'bg-orange-500'
                  : 'bg-green-500'
            } h-3 rounded-full transition-all`}
            style={{ width: `${Math.min(memoryPercent, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Concurrent tasks */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex justify-between text-sm font-medium text-gray-700">
          <span>Concurrent Tasks</span>
          <span className="text-gray-900">
            {resourceUsage.concurrentTasks} {resourceLimits && `/ ${resourceLimits.maxConcurrent}`}
          </span>
        </div>
      </div>

      {/* Queue depth */}
      <div className="mt-2">
        <div className="flex justify-between text-sm font-medium text-gray-700">
          <span>Queue Depth</span>
          <span className="text-gray-900">{resourceUsage.queueLength}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * ============================================================================
 * Analytics Dashboard Container
 * ============================================================================
 * Composite component assembling all 7 panels
 */
interface AnalyticsDashboardProps {
  retryMetrics: RetryMetrics;
  circuitBreakers: CircuitBreakerState[];
  dlqStats: {
    total: number;
    pending: number;
    deadLettered: number;
    successRate: number;
  };
  interventions: Array<{
    taskId: string;
    type: 'pause' | 'resume' | 'skip' | 'retry';
    timestamp: string;
    reason: string;
  }>;
  queueStatus: QueueStatus;
  schedules: Schedule[];
  resourceUsage: ResourceMetrics;
  resourceLimits?: {
    maxCpuPercent: number;
    maxMemoryPercent: number;
    maxConcurrent: number;
  };
  className?: string;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  retryMetrics,
  circuitBreakers,
  dlqStats,
  interventions,
  queueStatus,
  schedules,
  resourceUsage,
  resourceLimits,
  className = '',
}) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {/* Row 1 */}
      <div className="lg:col-span-2">
        <RetryAnalyticsPanel retryMetrics={retryMetrics} />
      </div>
      <CircuitBreakerPanel circuitBreakers={circuitBreakers} />
      <DLQPanel dlqStats={dlqStats} />

      {/* Row 2 */}
      <div className="lg:col-span-2">
        <TaskInterventionPanel interventions={interventions} />
      </div>
      <PriorityQueuePanel queueStatus={queueStatus} />
      <ScheduleManagementPanel schedules={schedules} />

      {/* Row 3 */}
      <div className="lg:col-span-2">
        <ResourceUtilizationPanel resourceUsage={resourceUsage} resourceLimits={resourceLimits} />
      </div>
    </div>
  );
};

export default AnalyticsDashboard;

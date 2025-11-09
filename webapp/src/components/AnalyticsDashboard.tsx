import { lazy, Suspense, useState } from 'react';
import { Download, RotateCcw, Calendar } from 'lucide-react';
import { useAnalytics, useAnalyticsExport, TimeRange } from '../hooks/useAnalytics';
import { Button } from './ui/button';

// Lazy load recharts components to optimize bundle
const LineChart = lazy(() => import('recharts').then((m) => ({ default: m.LineChart })));
const BarChart = lazy(() => import('recharts').then((m) => ({ default: m.BarChart })));
const PieChart = lazy(() => import('recharts').then((m) => ({ default: m.PieChart })));
const AreaChart = lazy(() => import('recharts').then((m) => ({ default: m.AreaChart })));
const Line = lazy(() => import('recharts').then((m) => ({ default: m.Line })));
const Bar = lazy(() => import('recharts').then((m) => ({ default: m.Bar })));
const Pie = lazy(() => import('recharts').then((m) => ({ default: m.Pie })));
const Area = lazy(() => import('recharts').then((m) => ({ default: m.Area })));
const XAxis = lazy(() => import('recharts').then((m) => ({ default: m.XAxis })));
const YAxis = lazy(() => import('recharts').then((m) => ({ default: m.YAxis })));
const CartesianGrid = lazy(() => import('recharts').then((m) => ({ default: m.CartesianGrid })));
const Tooltip = lazy(() => import('recharts').then((m) => ({ default: m.Tooltip })));
const Legend = lazy(() => import('recharts').then((m) => ({ default: m.Legend })));
const ResponsiveContainer = lazy(() =>
  import('recharts').then((m) => ({ default: m.ResponsiveContainer }))
);
const Cell = lazy(() => import('recharts').then((m) => ({ default: m.Cell })));

const chartFallback = <div className="h-64 w-full rounded bg-[var(--prism-bg-elevated)]/50" />;

const COLORS = [
  'var(--prism-info)',
  'var(--prism-success)',
  'var(--prism-warning)',
  'var(--prism-error)',
  'var(--prism-gold)',
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string | number;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--prism-bg-elevated)] border border-[var(--prism-bg-canvas)] rounded-lg p-3 shadow-lg">
        {payload.map((entry, index) => (
          <p
            key={index}
            className="text-xs font-jetbrains"
            style={{ color: entry.color }}
          >
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const analyticsData = useAnalytics(timeRange);
  const { exportAsCSV, exportAsJSON } = useAnalyticsExport(analyticsData);

  const timeRangeOptions: TimeRange[] = ['24h', '7d', '30d'];

  if (analyticsData.loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[var(--prism-bg-elevated)] border-t-[var(--prism-info)] mb-4" />
          <p className="text-[var(--prism-text-secondary)]">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (analyticsData.error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-[var(--prism-error)] mb-4">{analyticsData.error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--prism-bg-canvas)]">
      {/* Header */}
      <div className="border-b border-[var(--prism-bg-elevated)] bg-[var(--prism-bg-surface)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-[var(--prism-text-primary)]">Analytics Dashboard</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportAsCSV} className="gap-2">
              <Download className="w-4 h-4" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportAsJSON} className="gap-2">
              <Download className="w-4 h-4" />
              JSON
            </Button>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[var(--prism-text-secondary)]" />
          <div className="flex gap-2">
            {timeRangeOptions.map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-[var(--prism-info)] text-[var(--prism-bg-surface)]'
                    : 'bg-[var(--prism-bg-elevated)] text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)]'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* Error Recovery Analytics */}
          {analyticsData.error && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Total Retries */}
              <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-6">
                <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-2">
                  Error Recovery
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-3xl font-bold text-[var(--prism-info)]">
                      {analyticsData.error.totalRetries}
                    </div>
                    <p className="text-xs text-[var(--prism-text-secondary)]">Total Retries</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-[var(--prism-success)]">
                      {analyticsData.error.successRate.toFixed(1)}%
                    </div>
                    <p className="text-xs text-[var(--prism-text-secondary)]">Success Rate</p>
                  </div>
                </div>
              </div>

              {/* Success Rate Chart */}
              <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-6">
                <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-4">
                  Success Rate Trend
                </h3>
                <Suspense fallback={chartFallback}>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={analyticsData.error.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--prism-bg-elevated)" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(ts) => new Date(ts).toLocaleDateString()}
                        stroke="var(--prism-text-secondary)"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        domain={[80, 100]}
                        stroke="var(--prism-text-secondary)"
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="rate"
                        stroke="var(--prism-info)"
                        strokeWidth={2}
                        dot={false}
                        name="Success Rate %"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Suspense>
              </div>

              {/* Retry Distribution */}
              <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-6">
                <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-4">
                  Retry Distribution by Strategy
                </h3>
                <Suspense fallback={chartFallback}>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={analyticsData.error.distribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name} ${value}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {analyticsData.error.distribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </Suspense>
              </div>

              {/* Top Errors */}
              <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-6">
                <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-4">
                  Most Common Errors
                </h3>
                <Suspense fallback={chartFallback}>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={analyticsData.error.topErrors}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--prism-bg-elevated)" />
                      <XAxis
                        dataKey="error"
                        stroke="var(--prism-text-secondary)"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis stroke="var(--prism-text-secondary)" tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" fill="var(--prism-warning)" name="Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </Suspense>
              </div>
            </div>
          )}

          {/* Scheduler Analytics */}
          {analyticsData.scheduler && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Total Executions */}
              <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-6">
                <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-2">
                  Scheduler Overview
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-3xl font-bold text-[var(--prism-success)]">
                      {analyticsData.scheduler.totalExecutions}
                    </div>
                    <p className="text-xs text-[var(--prism-text-secondary)]">Total Executions</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-[var(--prism-success)]">
                      {analyticsData.scheduler.successRate.toFixed(1)}%
                    </div>
                    <p className="text-xs text-[var(--prism-text-secondary)]">Success Rate</p>
                  </div>
                </div>
              </div>

              {/* Execution Duration Trend */}
              <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-6">
                <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-4">
                  Execution Duration Trend
                </h3>
                <Suspense fallback={chartFallback}>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={analyticsData.scheduler.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--prism-bg-elevated)" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(ts) => new Date(ts).toLocaleDateString()}
                        stroke="var(--prism-text-secondary)"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis stroke="var(--prism-text-secondary)" tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="duration"
                        stroke="var(--prism-success)"
                        fill="var(--prism-success)"
                        fillOpacity={0.1}
                        name="Duration (ms)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Suspense>
              </div>

              {/* Schedule Frequency */}
              <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-6 lg:col-span-2">
                <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-4">
                  Schedule Execution Frequency
                </h3>
                <Suspense fallback={chartFallback}>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={analyticsData.scheduler.frequency}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--prism-bg-elevated)" />
                      <XAxis
                        dataKey="schedule"
                        stroke="var(--prism-text-secondary)"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis stroke="var(--prism-text-secondary)" tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" fill="var(--prism-success)" name="Executions" />
                    </BarChart>
                  </ResponsiveContainer>
                </Suspense>
              </div>
            </div>
          )}

          {/* Webhook Analytics */}
          {analyticsData.webhook && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Delivery Success Rate */}
              <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-6">
                <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-2">
                  Webhook Delivery
                </h3>
                <div>
                  <div className="text-3xl font-bold text-[var(--prism-success)]">
                    {analyticsData.webhook.successRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-[var(--prism-text-secondary)]">Success Rate</p>
                </div>
              </div>

              {/* Delivery Attempts */}
              <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-6">
                <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-4">
                  Delivery Attempts Distribution
                </h3>
                <Suspense fallback={chartFallback}>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={analyticsData.webhook.attempts}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--prism-bg-elevated)" />
                      <XAxis
                        dataKey="attempt"
                        stroke="var(--prism-text-secondary)"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis stroke="var(--prism-text-secondary)" tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" fill="var(--prism-gold)" name="Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </Suspense>
              </div>

              {/* Event Type Distribution */}
              <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-6">
                <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-4">
                  Event Type Distribution
                </h3>
                <Suspense fallback={chartFallback}>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={analyticsData.webhook.events}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ type, count }) => `${type} ${count}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {analyticsData.webhook.events.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </Suspense>
              </div>

              {/* Response Time Distribution */}
              <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-6">
                <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-4">
                  Response Time Distribution
                </h3>
                <Suspense fallback={chartFallback}>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={analyticsData.webhook.responseTime}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--prism-bg-elevated)" />
                      <XAxis
                        dataKey="ms"
                        stroke="var(--prism-text-secondary)"
                        tick={{ fontSize: 10 }}
                        label={{ value: 'ms', position: 'insideBottomRight', offset: -5 }}
                      />
                      <YAxis stroke="var(--prism-text-secondary)" tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" fill="var(--prism-info)" name="Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </Suspense>
              </div>
            </div>
          )}

          {/* System Analytics */}
          {analyticsData.system && (
            <div className="grid grid-cols-1 gap-6">
              {/* Request Rate */}
              <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-6">
                <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-4">
                  Request Rate (req/s)
                </h3>
                <Suspense fallback={chartFallback}>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={analyticsData.system.requestRate}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--prism-bg-elevated)" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                        stroke="var(--prism-text-secondary)"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis stroke="var(--prism-text-secondary)" tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="rate"
                        stroke="var(--prism-info)"
                        strokeWidth={2}
                        dot={false}
                        name="Request Rate"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Suspense>
              </div>

              {/* Error Rate */}
              <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-6">
                <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-4">
                  Error Rate (%)
                </h3>
                <Suspense fallback={chartFallback}>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={analyticsData.system.errorRate}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--prism-bg-elevated)" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                        stroke="var(--prism-text-secondary)"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis stroke="var(--prism-text-secondary)" tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="rate"
                        stroke="var(--prism-error)"
                        strokeWidth={2}
                        dot={false}
                        name="Error Rate"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Suspense>
              </div>

              {/* Response Time Percentiles */}
              <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-6">
                <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-4">
                  Response Time Percentiles (ms)
                </h3>
                <Suspense fallback={chartFallback}>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={analyticsData.system.responseTime}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--prism-bg-elevated)" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                        stroke="var(--prism-text-secondary)"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis stroke="var(--prism-text-secondary)" tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="p50"
                        stroke="var(--prism-success)"
                        strokeWidth={2}
                        dot={false}
                        name="p50"
                      />
                      <Line
                        type="monotone"
                        dataKey="p95"
                        stroke="var(--prism-warning)"
                        strokeWidth={2}
                        dot={false}
                        name="p95"
                      />
                      <Line
                        type="monotone"
                        dataKey="p99"
                        stroke="var(--prism-error)"
                        strokeWidth={2}
                        dot={false}
                        name="p99"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Suspense>
              </div>

              {/* Circuit Breaker State Changes */}
              <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-6">
                <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-4">
                  Circuit Breaker State Changes
                </h3>
                <Suspense fallback={chartFallback}>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={analyticsData.system.circuitBreaker}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--prism-bg-elevated)" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                        stroke="var(--prism-text-secondary)"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis stroke="var(--prism-text-secondary)" tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="changes" fill="var(--prism-warning)" name="State Changes" />
                    </BarChart>
                  </ResponsiveContainer>
                </Suspense>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

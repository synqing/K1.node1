import { useEffect, useState, useCallback } from 'react';

export type TimeRange = '24h' | '7d' | '30d' | 'custom';

export interface ErrorAnalytics {
  totalRetries: number;
  successRate: number;
  data: Array<{ timestamp: number; rate: number }>;
  distribution: Array<{ name: string; value: number }>;
  topErrors: Array<{ error: string; count: number }>;
}

export interface SchedulerAnalytics {
  totalExecutions: number;
  successRate: number;
  data: Array<{ timestamp: number; duration: number }>;
  frequency: Array<{ schedule: string; count: number }>;
}

export interface WebhookAnalytics {
  successRate: number;
  attempts: Array<{ attempt: number; count: number }>;
  events: Array<{ type: string; count: number }>;
  responseTime: Array<{ ms: number; count: number }>;
}

export interface SystemAnalytics {
  requestRate: Array<{ timestamp: number; rate: number }>;
  errorRate: Array<{ timestamp: number; rate: number }>;
  responseTime: Array<{ timestamp: number; p50: number; p95: number; p99: number }>;
  circuitBreaker: Array<{ timestamp: number; changes: number }>;
}

export interface AnalyticsData {
  error: ErrorAnalytics | null;
  scheduler: SchedulerAnalytics | null;
  webhook: WebhookAnalytics | null;
  system: SystemAnalytics | null;
  loading: boolean;
  error: string | null;
}

// Mock data generators for development
const generateErrorAnalytics = (): ErrorAnalytics => {
  const data = Array.from({ length: 24 }, (_, i) => ({
    timestamp: Date.now() - (24 - i) * 3600000,
    rate: 85 + Math.random() * 10,
  }));

  return {
    totalRetries: 1247,
    successRate: 92.5,
    data,
    distribution: [
      { name: 'Exponential', value: 45 },
      { name: 'Linear', value: 30 },
      { name: 'Fixed', value: 25 },
    ],
    topErrors: [
      { error: 'TIMEOUT', count: 234 },
      { error: 'CONNECTION_FAILED', count: 178 },
      { error: 'INVALID_RESPONSE', count: 145 },
      { error: 'RATE_LIMITED', count: 98 },
    ],
  };
};

const generateSchedulerAnalytics = (): SchedulerAnalytics => {
  const data = Array.from({ length: 30 }, (_, i) => ({
    timestamp: Date.now() - (30 - i) * 86400000,
    duration: 150 + Math.random() * 100,
  }));

  return {
    totalExecutions: 4562,
    successRate: 98.3,
    data,
    frequency: [
      { schedule: 'Every 5m', count: 1200 },
      { schedule: 'Every 30m', count: 800 },
      { schedule: 'Daily', count: 600 },
      { schedule: 'Hourly', count: 1962 },
    ],
  };
};

const generateWebhookAnalytics = (): WebhookAnalytics => {
  return {
    successRate: 96.8,
    attempts: [
      { attempt: 1, count: 8500 },
      { attempt: 2, count: 280 },
      { attempt: 3, count: 145 },
      { attempt: 4, count: 45 },
      { attempt: 5, count: 30 },
    ],
    events: [
      { type: 'workflow_completed', count: 3200 },
      { type: 'task_updated', count: 2800 },
      { type: 'error_occurred', count: 1500 },
      { type: 'status_changed', count: 1255 },
    ],
    responseTime: [
      { ms: 100, count: 4200 },
      { ms: 250, count: 2800 },
      { ms: 500, count: 1200 },
      { ms: 1000, count: 555 },
    ],
  };
};

const generateSystemAnalytics = (): SystemAnalytics => {
  const data = Array.from({ length: 60 }, (_, i) => ({
    timestamp: Date.now() - (60 - i) * 600000, // 10 minute intervals
  }));

  return {
    requestRate: data.map((d) => ({
      ...d,
      rate: 500 + Math.random() * 300,
    })),
    errorRate: data.map((d) => ({
      ...d,
      rate: 2 + Math.random() * 3,
    })),
    responseTime: data.map((d) => ({
      ...d,
      p50: 50 + Math.random() * 30,
      p95: 200 + Math.random() * 100,
      p99: 500 + Math.random() * 300,
    })),
    circuitBreaker: Array.from({ length: 20 }, (_, i) => ({
      timestamp: Date.now() - (20 - i) * 3600000,
      changes: Math.floor(Math.random() * 5),
    })),
  };
};

export function useAnalytics(timeRange: TimeRange = '24h') {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    error: null,
    scheduler: null,
    webhook: null,
    system: null,
    loading: true,
    error: null,
  });

  const fetchAnalytics = useCallback(async () => {
    try {
      setAnalyticsData((prev) => ({ ...prev, loading: true, error: null }));

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // For now, use mock data. In production, fetch from T14 metrics API
      // const response = await fetch(`/api/metrics?timeRange=${timeRange}`);
      // const data = await response.json();

      setAnalyticsData({
        error: generateErrorAnalytics(),
        scheduler: generateSchedulerAnalytics(),
        webhook: generateWebhookAnalytics(),
        system: generateSystemAnalytics(),
        loading: false,
        error: null,
      });
    } catch (err) {
      setAnalyticsData((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch analytics',
      }));
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalytics();

    // Simulate real-time updates via WebSocket (T13)
    const interval = setInterval(() => {
      setAnalyticsData((prev) => {
        if (!prev.error || !prev.system) return prev;
        return {
          ...prev,
          system: {
            ...prev.system,
            requestRate: prev.system.requestRate.slice(1).concat([
              {
                timestamp: Date.now(),
                rate: 500 + Math.random() * 300,
              },
            ]),
            errorRate: prev.system.errorRate.slice(1).concat([
              {
                timestamp: Date.now(),
                rate: 2 + Math.random() * 3,
              },
            ]),
            responseTime: prev.system.responseTime.slice(1).concat([
              {
                timestamp: Date.now(),
                p50: 50 + Math.random() * 30,
                p95: 200 + Math.random() * 100,
                p99: 500 + Math.random() * 300,
              },
            ]),
          },
        };
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  return analyticsData;
}

export function useAnalyticsExport(analyticsData: AnalyticsData) {
  const exportAsCSV = useCallback(() => {
    if (!analyticsData.system) return;

    const data = analyticsData.system.requestRate.map((item) => ({
      timestamp: new Date(item.timestamp).toISOString(),
      requestRate: item.rate.toFixed(2),
    }));

    const csv = [
      ['Timestamp', 'Request Rate'].join(','),
      ...data.map((row) => [row.timestamp, row.requestRate].join(',')),
    ].join('\n');

    downloadFile(csv, 'analytics.csv', 'text/csv');
  }, [analyticsData]);

  const exportAsJSON = useCallback(() => {
    if (!analyticsData) return;

    const json = JSON.stringify(analyticsData, null, 2);
    downloadFile(json, 'analytics.json', 'application/json');
  }, [analyticsData]);

  return { exportAsCSV, exportAsJSON };
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

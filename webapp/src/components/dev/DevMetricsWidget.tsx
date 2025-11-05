import { useEffect, useState } from 'react';
import { Activity, Cpu, HardDrive, Gauge } from 'lucide-react';
import type { ConnectionState } from '../../lib/types';
import { getPerformanceMetrics, type FirmwarePerformanceMetrics } from '../../lib/api';
import { isDevEnabled } from '../../lib/env';
import { DEV_WIDGET_AND_METRICS } from '../../lib/env-flags';

interface DevMetricsWidgetProps {
  connectionState: ConnectionState;
}

type TransportStats = {
  averageLatency: number;
  successRate: number;
  backingOff: boolean;
  backoffMs: number;
};

type CoalescingStats = {
  totalScheduled: number;
  totalSent: number;
  averageCoalescingRatio?: number;
  averageSendInterval?: number;
  lastSendTime?: number;
};

export function DevMetricsWidget({ connectionState }: DevMetricsWidgetProps) {
  const devOnly = isDevEnabled([...DEV_WIDGET_AND_METRICS]);
  const [transportStats, setTransportStats] = useState<TransportStats>({
    averageLatency: 0,
    successRate: 1,
    backingOff: false,
    backoffMs: 0,
  });
  const [coalescingStats, setCoalescingStats] = useState<CoalescingStats>({
    totalScheduled: 0,
    totalSent: 0,
    averageCoalescingRatio: 0,
    averageSendInterval: 0,
    lastSendTime: 0,
  });
  const [fwMetrics, setFwMetrics] = useState<FirmwarePerformanceMetrics | null>(null);

  useEffect(() => {
    if (!devOnly) return;
    const onTransport = (e: Event) => {
      const detail = (e as CustomEvent).detail as TransportStats;
      if (detail && typeof detail === 'object') {
        setTransportStats(detail);
      }
    };
    const onCoalescing = (e: Event) => {
      const detail = (e as CustomEvent).detail as CoalescingStats;
      if (detail && typeof detail === 'object') {
        setCoalescingStats(detail);
      }
    };
    window.addEventListener('dev:transportStats', onTransport as EventListener);
    window.addEventListener('dev:coalescingStats', onCoalescing as EventListener);
    return () => {
      window.removeEventListener('dev:transportStats', onTransport as EventListener);
      window.removeEventListener('dev:coalescingStats', onCoalescing as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!devOnly) return;
    const isConnected = !!connectionState?.connected && !!connectionState?.deviceIp;
    if (!isConnected) {
      setFwMetrics(null);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const ip = connectionState.deviceIp;
        if (!ip) return;
        const m = await getPerformanceMetrics(ip);
        if (!cancelled) setFwMetrics(m);
      } catch {
        // ignore transient errors
      }
    };
    const id = window.setInterval(poll, 500);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [connectionState]);

  if (!devOnly) return null;

  const fps = fwMetrics?.fps ?? 0;
  const cpu = fwMetrics?.cpu_percent ?? 0;
  const mem = fwMetrics?.memory_percent ?? 0;
  const frameUs = fwMetrics?.frame_time_us ?? 0;

  return (
    <div className="p-3 border border-[var(--prism-bg-elevated)] rounded-lg bg-[var(--prism-bg-canvas)]">
      <div className="flex items-center gap-2 mb-2">
        <Gauge className="w-4 h-4 text-[var(--prism-gold)]" />
        <span className="text-xs font-medium text-[var(--prism-text-secondary)]">Dev Metrics</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px] font-jetbrains">
        <div className="flex items-center gap-1">
          <Activity className="w-3 h-3" />
          <span className="text-[var(--prism-text-secondary)]">FPS</span>
          <span className="ml-auto text-[var(--prism-text-primary)]">{fps.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Cpu className="w-3 h-3" />
          <span className="text-[var(--prism-text-secondary)]">CPU</span>
          <span className="ml-auto text-[var(--prism-text-primary)]">{cpu.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <HardDrive className="w-3 h-3" />
          <span className="text-[var(--prism-text-secondary)]">Mem</span>
          <span className="ml-auto text-[var(--prism-text-primary)]">{mem.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[var(--prism-text-secondary)]">Frame</span>
          <span className="ml-auto text-[var(--prism-text-primary)]">{(frameUs / 1000).toFixed(2)}ms</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-jetbrains">
        <div className="flex items-center gap-1">
          <span className="text-[var(--prism-text-secondary)]">Latency</span>
          <span className="ml-auto text-[var(--prism-text-primary)]">{Math.round(transportStats.averageLatency)}ms</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[var(--prism-text-secondary)]">Success</span>
          <span className="ml-auto text-[var(--prism-text-primary)]">{Math.round(transportStats.successRate * 100)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[var(--prism-text-secondary)]">Backoff</span>
          <span className="ml-auto text-[var(--prism-text-primary)]">{transportStats.backingOff ? `${transportStats.backoffMs}ms` : '—'}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[var(--prism-text-secondary)]">Coalesce</span>
          <span className="ml-auto text-[var(--prism-text-primary)]">{coalescingStats.totalSent}/{coalescingStats.totalScheduled}</span>
        </div>
      </div>
    </div>
  );
}

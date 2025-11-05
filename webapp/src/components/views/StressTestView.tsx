import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ConnectionState } from '../../lib/types';
import { useParameterTransport } from '../../hooks/useParameterTransport';
import { useCoalescedParams, useCoalescingStats } from '../../hooks/useCoalescedParams';
import { type UIParams, PARAM_ORDER } from '../../lib/parameters';
import { getEffectiveRtpConfig, useRtpOverrides } from '../../config/overrides';
import { isDevEnabled } from '../../lib/env';
import { FLAG_ENABLE_DEV_METRICS } from '../../lib/env-flags';

interface StressTestViewProps {
  connectionState: ConnectionState;
}

type TestKind = 'idle' | 'burst' | 'sustain';

export function StressTestView({ connectionState }: StressTestViewProps) {
  const [overrides] = useRtpOverrides();
  const effective = getEffectiveRtpConfig(overrides);

  const [kind, setKind] = useState<TestKind>('idle');
  const timerRef = useRef<number | null>(null);
  const countRef = useRef<number>(0);

  const transport = useParameterTransport({
    connectionState,
    retryAttempts: 2,
    retryDelay: 1000,
    timeout: 5000,
  });

  const { stats, recordSchedule, recordSend, reset } = useCoalescingStats();
  const coalescer = useCoalescedParams({
    onSend: async (params) => {
      await transport.sendParameters(params);
      recordSend();
      // Emit dev-only telemetry events when explicitly enabled
      if (isDevEnabled([FLAG_ENABLE_DEV_METRICS])) {
        try {
          window.dispatchEvent(new CustomEvent('dev:coalescingStats', { detail: { ...stats } }));
          window.dispatchEvent(new CustomEvent('dev:transportStats', { detail: transport.getTransportStats() }));
        } catch {}
      }
    },
    delay: effective.coalesceDelayMs,
    leadingEdge: effective.leadingEdge,
    maxWait: effective.coalesceMaxWaitMs,
  });

  const isConnected = connectionState.connected;

  const randomUpdate = useCallback(() => {
    const key = PARAM_ORDER[Math.floor(Math.random() * PARAM_ORDER.length)] as keyof UIParams;
    const value = Math.floor(Math.random() * 100);
    coalescer.scheduleSend(key, value);
    recordSchedule();
  }, [coalescer, recordSchedule]);

  const startBurst = useCallback(() => {
    if (!isConnected) return;
    setKind('burst');
    reset();
    countRef.current = 0;
    const run = () => {
      randomUpdate();
      countRef.current++;
      if (countRef.current >= 20) {
        stop();
        return;
      }
      timerRef.current = window.setTimeout(run, 10);
    };
    run();
  }, [isConnected, reset, randomUpdate]);

  const startSustain = useCallback(() => {
    if (!isConnected) return;
    setKind('sustain');
    reset();
    const endAt = performance.now() + 5000; // 5 seconds
    const run = () => {
      randomUpdate();
      if (performance.now() >= endAt) {
        stop();
        return;
      }
      timerRef.current = window.setTimeout(run, 1000 / 60);
    };
    run();
  }, [isConnected, reset, randomUpdate]);

  const stop = useCallback(() => {
    setKind('idle');
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    coalescer.flush();
  }, [coalescer]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      coalescer.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Stress Test</h2>
          <p className="text-sm text-[var(--prism-text-secondary)]">Drive rapid parameter updates to observe transport and coalescing.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {isConnected ? (
            <Badge variant="outline" className="border-[var(--prism-success)] text-[var(--prism-success)]">Connected</Badge>
          ) : (
            <Badge variant="destructive">Disconnected</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Button onClick={startBurst} disabled={!isConnected || kind !== 'idle'} variant="outline">Burst x20</Button>
        <Button onClick={startSustain} disabled={!isConnected || kind !== 'idle'} variant="outline">Sustain 5s @60Hz</Button>
        <Button onClick={stop} disabled={kind === 'idle'} variant="default">Stop</Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 text-xs font-jetbrains">
        <div className="p-3 bg-[var(--prism-bg-surface)] border border-[var(--prism-bg-elevated)] rounded">
          <div className="font-medium mb-2">Transport</div>
          <div className="space-y-1">
            <div className="flex justify-between"><span>Latency</span><span>{Math.round(transport.getTransportStats().averageLatency)}ms</span></div>
            <div className="flex justify-between"><span>Success</span><span>{Math.round(transport.getTransportStats().successRate * 100)}%</span></div>
            <div className="flex justify-between"><span>Backoff</span><span>{transport.getTransportStats().backingOff ? `${transport.getTransportStats().backoffMs}ms` : '—'}</span></div>
          </div>
        </div>
        <div className="p-3 bg-[var(--prism-bg-surface)] border border-[var(--prism-bg-elevated)] rounded">
          <div className="font-medium mb-2">Coalescing</div>
          <div className="space-y-1">
            <div className="flex justify-between"><span>Scheduled</span><span>{stats.totalScheduled}</span></div>
            <div className="flex justify-between"><span>Sent</span><span>{stats.totalSent}</span></div>
            <div className="flex justify-between"><span>Avg Interval</span><span>{Math.round((stats.averageSendInterval || 0))}ms</span></div>
            <div className="flex justify-between"><span>Ratio</span><span>{(stats.averageCoalescingRatio || 0).toFixed(2)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StressTestView;

import { useMemo } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import type { ConnectionState } from '../../lib/types';
import type { EnvLike } from '../../lib/env';
import { getEnvSafe } from '../../lib/env';
import { useRtpOverrides, getEffectiveRtpConfig } from '../../config/overrides';
import { k1ApiClient } from '../../lib/analysisClient';
import { toast } from 'sonner';

interface DiagnosticsViewProps {
  connectionState: ConnectionState;
}

export function DiagnosticsView({ connectionState }: DiagnosticsViewProps) {
  const env = getEnvSafe() || {};
  const [overrides] = useRtpOverrides();
  const effective = useMemo(() => getEffectiveRtpConfig(overrides), [overrides]);
  const baseUrl = k1ApiClient.getBaseUrl();

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Diagnostics</h2>
          <p className="text-sm text-[var(--prism-text-secondary)]">Environment, transport config, and connection state.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {connectionState.connected ? (
            <Badge variant="outline" className="border-[var(--prism-success)] text-[var(--prism-success)]">Connected</Badge>
          ) : (
            <Badge variant="destructive">Disconnected</Badge>
          )}
          <Button
            variant="outline"
            className="text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)]"
            onClick={async () => {
              const report = buildDiagnosticsReport(connectionState, env, baseUrl, effective);
              try {
                await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
                toast.success('Copied diagnostics report');
              } catch {
                toast.error('Failed to copy diagnostics report');
              }
            }}
          >
            Copy Report
          </Button>
          <Button
            variant="outline"
            className="text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)]"
            onClick={() => {
              const report = buildDiagnosticsReport(connectionState, env, baseUrl, effective);
              try {
                const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                a.href = url;
                a.download = `diagnostics-report-${ts}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                toast.success('Downloaded diagnostics report');
              } catch {
                toast.error('Failed to download diagnostics report');
              }
            }}
          >
            Download Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs font-jetbrains">
        <div className="p-3 bg-[var(--prism-bg-surface)] border border-[var(--prism-bg-elevated)] rounded">
          <div className="font-medium mb-2">Environment</div>
          <div className="space-y-1">
            <div className="flex justify-between"><span>MODE</span><span>{String(env.MODE || '')}</span></div>
            <div className="flex justify-between"><span>DEV</span><span>{String(env.DEV ?? '')}</span></div>
            <div className="flex justify-between"><span>PROD</span><span>{String(env.PROD ?? '')}</span></div>
            <div className="flex justify-between"><span>NODE_ENV</span><span>{String(env.NODE_ENV || '')}</span></div>
            <div className="flex justify-between"><span>VITE_SHOW_DEV_WIDGET</span><span>{String(env.VITE_SHOW_DEV_WIDGET ?? '')}</span></div>
            <div className="flex justify-between"><span>VITE_ENABLE_DEV_METRICS</span><span>{String(env.VITE_ENABLE_DEV_METRICS ?? '')}</span></div>
            <div className="flex justify-between"><span>VITE_ENABLE_TIMING_OVERRIDES</span><span>{String(env.VITE_ENABLE_TIMING_OVERRIDES ?? '')}</span></div>
            <div className="flex justify-between"><span>VITE_SHOW_PREVIEW_LINK</span><span>{String(env.VITE_SHOW_PREVIEW_LINK ?? '')}</span></div>
            <div className="flex justify-between"><span>ANALYSIS API</span><span>{baseUrl}</span></div>
          </div>
        </div>
        <div className="p-3 bg-[var(--prism-bg-surface)] border border-[var(--prism-bg-elevated)] rounded">
          <div className="font-medium mb-2">Real-Time Parameters (Effective)</div>
          <div className="space-y-1">
            <div className="flex justify-between"><span>Coalesce Delay</span><span>{String(effective.coalesceDelayMs)} ms</span></div>
            <div className="flex justify-between"><span>Max Wait</span><span>{String(effective.coalesceMaxWaitMs)} ms</span></div>
            <div className="flex justify-between"><span>Leading Edge</span><span>{String(effective.leadingEdge)}</span></div>
            <div className="flex justify-between"><span>Autosave Delay</span><span>{String(effective.persistSaveDelayMs)} ms</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiagnosticsView;

export function buildDiagnosticsReport(
  connectionState: ConnectionState,
  env: EnvLike | Record<string, unknown>,
  analysisApiBaseUrl: string,
  rtpEffective: unknown,
) {
  return {
    environment: env,
    analysisApiBaseUrl,
    connectionState,
    rtpEffective,
    generatedAt: new Date().toISOString(),
  };
}

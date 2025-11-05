import { useMemo, useState } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { useRtpOverrides, getEffectiveRtpConfig, writeOverrides, clearOverrides } from '../../config/overrides';
import { isDevEnabled } from '../../lib/env';
import { FLAG_ENABLE_TIMING_OVERRIDES } from '../../lib/env-flags';

export function TimingOverridesPanel() {
  const [overrides, setOverrides] = useRtpOverrides();
  const effective = useMemo(() => getEffectiveRtpConfig(overrides), [overrides]);
  const [local, setLocal] = useState({
    coalesceDelayMs: overrides.coalesceDelayMs ?? effective.coalesceDelayMs,
    coalesceMaxWaitMs: overrides.coalesceMaxWaitMs ?? effective.coalesceMaxWaitMs,
    leadingEdge: overrides.leadingEdge ?? effective.leadingEdge,
    persistSaveDelayMs: overrides.persistSaveDelayMs ?? effective.persistSaveDelayMs,
  });

  const isDev = isDevEnabled([FLAG_ENABLE_TIMING_OVERRIDES]);
  if (!isDev) return null;

  const apply = () => {
    setOverrides({
      coalesceDelayMs: local.coalesceDelayMs,
      coalesceMaxWaitMs: local.coalesceMaxWaitMs,
      leadingEdge: local.leadingEdge,
      persistSaveDelayMs: local.persistSaveDelayMs,
    });
  };

  const reset = () => {
    clearOverrides();
  };

  return (
    <div className="pt-4 border-t border-[var(--prism-bg-elevated)] space-y-3" aria-label="Timing Overrides Panel">
      <h4 className="text-xs font-medium text-[var(--prism-text-secondary)]">Timing Overrides (Dev)</h4>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="coalesce-delay" className="text-xs text-[var(--prism-text-secondary)]">Coalesce Delay (ms)</Label>
          <Input
            id="coalesce-delay"
            type="number"
            min={0}
            max={2000}
            value={local.coalesceDelayMs}
            onChange={(e) => setLocal({ ...local, coalesceDelayMs: Number(e.target.value) })}
          />
          <div className="text-[10px] text-[var(--prism-text-secondary)]">Effective: {effective.coalesceDelayMs}</div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="max-wait" className="text-xs text-[var(--prism-text-secondary)]">Max Wait (ms)</Label>
          <Input
            id="max-wait"
            type="number"
            min={0}
            max={5000}
            value={local.coalesceMaxWaitMs}
            onChange={(e) => setLocal({ ...local, coalesceMaxWaitMs: Number(e.target.value) })}
          />
          <div className="text-[10px] text-[var(--prism-text-secondary)]">Effective: {effective.coalesceMaxWaitMs}</div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="leading-edge" className="text-xs text-[var(--prism-text-secondary)]">Leading Edge</Label>
          <div className="flex items-center gap-2">
            <Switch
              id="leading-edge"
              checked={local.leadingEdge}
              onCheckedChange={(v) => setLocal({ ...local, leadingEdge: v })}
            />
            <span className="text-xs text-[var(--prism-text-secondary)]">Send first change immediately</span>
          </div>
          <div className="text-[10px] text-[var(--prism-text-secondary)]">Effective: {String(effective.leadingEdge)}</div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="persist-delay" className="text-xs text-[var(--prism-text-secondary)]">Autosave Delay (ms)</Label>
          <Input
            id="persist-delay"
            type="number"
            min={0}
            max={5000}
            value={local.persistSaveDelayMs}
            onChange={(e) => setLocal({ ...local, persistSaveDelayMs: Number(e.target.value) })}
          />
          <div className="text-[10px] text-[var(--prism-text-secondary)]">Effective: {effective.persistSaveDelayMs}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={apply}>Apply Overrides</Button>
        <Button size="sm" variant="ghost" onClick={reset}>Reset to Defaults</Button>
      </div>
    </div>
  );
}

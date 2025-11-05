import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '../ui/alert-dialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { getParams, postParams, postSelect, type FirmwareParams } from '../../lib/api';
import { useDeviceRecommendedState, applyRecommendedStateToDevice } from '@backend/device-state-hooks';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceIp?: string;
  connected?: boolean;
};

export function ApplyRecommendationsModal({ open, onOpenChange, deviceIp, connected }: Props) {
  const { data: rec } = useDeviceRecommendedState(deviceIp, { enabled: !!deviceIp && !!connected });
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [prevParams, setPrevParams] = useState<FirmwareParams | null>(null);
  const [prevPatternIndex, setPrevPatternIndex] = useState<number | undefined>(undefined);
  const didApplyRef = useRef(false);

  useEffect(() => {
    let aborted = false;
    async function snapshotCurrent() {
      if (!open || !deviceIp || !connected) return;
      try {
        const paramsResp = await getParams(deviceIp);
        if (!aborted && paramsResp) setPrevParams(paramsResp as FirmwareParams);
        // Try to infer current pattern index via params-derived hint if available later; leave undefined if unknown
      } catch (e) {
        console.warn('Failed to snapshot current params', e);
      }
    }
    snapshotCurrent();
    return () => { aborted = true; };
  }, [open, deviceIp, connected]);

  const hasRec = !!rec && (!!rec.pattern || !!rec.params || typeof rec.palette_id === 'number');
  const recParams = (rec?.params ?? {}) as Partial<FirmwareParams>;

  const diffList = useMemo(() => {
    const diffs: string[] = [];
    const current = prevParams;
    const maybeAdd = (key: keyof FirmwareParams, label?: string) => {
      const sent = recParams[key];
      if (typeof sent === 'undefined') return;
      const got = current?.[key];
      const name = label || String(key);
      if (typeof sent === 'number' && typeof got === 'number') {
        const s = Math.round(Number(sent) * 100) / 100;
        const g = Math.round(Number(got) * 100) / 100;
        if (g !== s) diffs.push(`${name}: ${g} → ${s}`);
        else diffs.push(`${name}: ${s}`);
      } else if (typeof sent !== 'undefined') {
        diffs.push(`${name}: ${String(got)} → ${String(sent)}`);
      }
    };
    maybeAdd('speed');
    maybeAdd('scale');
    maybeAdd('intensity');
    maybeAdd('warmth');
    maybeAdd('contrast');
    maybeAdd('palette_id', 'palette');
    return diffs;
  }, [prevParams, recParams]);

  async function handleApply(baseOpts?: { verify?: boolean }) {
    if (!deviceIp || !connected || !hasRec || !rec) return;
    setLoading(true);
    didApplyRef.current = false;
    try {
      const result = await applyRecommendedStateToDevice(deviceIp, rec);
      didApplyRef.current = true;
      if (!result.selectConfirmed || !result.paramsConfirmed) {
        toast.info('Applied with unconfirmed transport', {
          description: 'Opaque send used due to firmware/CORS; verify on device.',
        });
      } else {
        toast.success('Applied analysis recommendations');
      }
      if (baseOpts?.verify) {
        setVerifying(true);
        try {
          const after = await getParams(deviceIp);
          const adjusted: string[] = [];
          const keys = Object.keys(recParams) as (keyof FirmwareParams)[];
          keys.forEach((k) => {
            const sent = recParams[k];
            const got = (after as FirmwareParams | null)?.[k];
            if (typeof sent === 'number' && typeof got === 'number') {
              const delta = Math.abs(Number(sent) - Number(got));
              if (delta > 0.001) {
                adjusted.push(k === 'palette_id' ? `palette → ${got}` : `${String(k)} ${sent} → ${got}`);
              }
            }
          });
          if (adjusted.length) {
            toast.info('Firmware applied safe bounds', { description: adjusted.join(', ') });
          } else {
            toast.success('Verification successful', { description: 'Device parameters match recommendations' });
          }
        } catch (e) {
          console.warn('Verify failed', e);
          toast.warning('Verification could not confirm device state', { description: 'Check connectivity and try again' });
        } finally {
          setVerifying(false);
        }
      }
      onOpenChange(false);
    } catch (e: any) {
      console.warn('Apply recommendations failed', e);
      const msg = e?.message || 'Device did not accept recommended state';
      toast.error('Failed to apply recommendations', { description: msg });
    } finally {
      setLoading(false);
    }
  }

  async function handleUndo() {
    if (!deviceIp || !connected || !prevParams) return;
    setLoading(true);
    try {
      const r = await postParams(deviceIp, prevParams);
      if (!r.confirmed) {
        toast.info('Undo sent via unconfirmed transport', { description: 'Verify on device if needed' });
      } else {
        toast.success('Restored previous parameters');
      }
      if (typeof prevPatternIndex === 'number') {
        try {
          await new Promise(res => setTimeout(res, 350));
          await postSelect(deviceIp, { index: prevPatternIndex });
        } catch {}
      }
      onOpenChange(false);
    } catch (e) {
      console.warn('Undo failed', e);
      toast.error('Failed to restore previous state');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent style={{ backgroundColor: 'var(--color-prism-bg-surface)', borderColor: 'var(--color-border)' }}>
        <AlertDialogHeader>
          <AlertDialogTitle style={{ color: 'var(--color-prism-text-primary)' }}>Preview Analysis Recommendations</AlertDialogTitle>
          <AlertDialogDescription>
            Review changes before applying to the connected device.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!hasRec && (
          <div className="text-sm" style={{ color: 'var(--color-prism-text-secondary)' }}>No recommendations available.</div>
        )}

        {hasRec && (
          <div className="space-y-3">
            {rec?.pattern && (
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--color-prism-text-secondary)' }}>Pattern</span>
                <Badge variant="outline">{String(rec.pattern)}</Badge>
              </div>
            )}
            {typeof rec?.palette_id === 'number' && (
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--color-prism-text-secondary)' }}>Palette</span>
                <Badge variant="outline">#{rec.palette_id}</Badge>
              </div>
            )}
            {diffList.length > 0 && (
              <div className="space-y-2">
                <div className="border-t" style={{ borderColor: 'var(--color-border)' }} />
                <div className="text-sm font-medium" style={{ color: 'var(--color-prism-text-primary)' }}>Parameter changes</div>
                <div className="flex flex-wrap gap-2">
                  {diffList.map((d) => (
                    <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
                  ))}
                </div>
              </div>
            )}
            {typeof rec?.confidence === 'number' && (
              <div className="text-xs" style={{ color: 'var(--color-prism-text-secondary)' }}>Confidence {Math.round(rec.confidence * 100)}%</div>
            )}
            {rec?.timestamp && (
              <div className="text-xs" style={{ color: 'var(--color-prism-text-secondary)' }}>Generated {new Date(rec.timestamp).toLocaleString()}</div>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading || verifying}>Cancel</AlertDialogCancel>
          <Button variant="outline" disabled={!hasRec || !connected || loading || verifying} onClick={handleUndo} aria-label="Undo previous state">Undo</Button>
          <AlertDialogAction disabled={!hasRec || !connected || loading || verifying} onClick={() => handleApply({ verify: true })} aria-label="Apply and verify">Apply & Verify</AlertDialogAction>
          <Button variant="secondary" disabled={!hasRec || !connected || loading || verifying} onClick={() => handleApply()} aria-label="Apply recommendations">Apply</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

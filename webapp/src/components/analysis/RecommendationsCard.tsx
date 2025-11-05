import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { type FirmwareParams } from '../../lib/api';
import { useDeviceRecommendedState } from '@backend/device-state-hooks';

type Props = {
  deviceIp?: string;
  connected?: boolean;
  onViewDetails: () => void;
};

export function RecommendationsCard({ deviceIp, connected, onViewDetails }: Props) {
  const { data: rec } = useDeviceRecommendedState(deviceIp, { enabled: !!connected && !!deviceIp });

  const hasData = !!rec && (!!rec.pattern || !!rec.params || typeof rec.palette_id === 'number');
  return (
    <Card className="p-4 space-y-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-prism-bg-surface)' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold" style={{ color: 'var(--color-prism-text-primary)' }}>Device Recommendations</h3>
        {typeof rec?.confidence === 'number' && (
          <Badge variant="outline" className="text-xs" style={{ borderColor: 'var(--color-prism-info)', color: 'var(--color-prism-info)' }}>
            Confidence {Math.round(rec.confidence * 100)}%
          </Badge>
        )}
      </div>

      {!connected && (
        <p className="text-sm" style={{ color: 'var(--color-prism-text-secondary)' }}>Connect to a device to view recommendations.</p>
      )}

      {connected && !hasData && (
        <p className="text-sm" style={{ color: 'var(--color-prism-text-secondary)' }}>No recommendations available yet. Run analysis or publish from backend.</p>
      )}

      {connected && hasData && (
        <div className="space-y-2">
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
          {rec?.params && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(rec.params as Partial<FirmwareParams>).slice(0, 6).map(([k, v]) => (
                <Badge key={k} variant="outline" className="text-xs">{k}: {typeof v === 'number' ? Math.round(Number(v) * 100) / 100 : String(v)}</Badge>
              ))}
              {Object.entries(rec.params as Partial<FirmwareParams>).length > 6 && (
                <Badge variant="outline" className="text-xs">+ more</Badge>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="secondary" disabled={!connected || !hasData} onClick={onViewDetails}>View details</Button>
      </div>
    </Card>
  );
}


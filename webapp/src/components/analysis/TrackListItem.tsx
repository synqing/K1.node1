import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

type TrackStatus = 'selected' | 'processing' | 'ready' | 'warning' | 'failed';

export interface TrackListItemProps {
  id: string;
  title: string;
  artist: string;
  duration?: string;
  bpm?: number;
  fMeasure?: number;
  status: TrackStatus;
  selected?: boolean;
  onSelect?: () => void;
}

const statusLabel: Record<TrackStatus, string> = {
  selected: 'Selected',
  processing: 'Processing',
  ready: 'Ready',
  warning: 'Review',
  failed: 'Failed',
};

const statusColor: Record<TrackStatus, string> = {
  selected: 'var(--color-prism-info)',
  processing: 'var(--color-prism-info)',
  ready: 'var(--color-prism-success)',
  warning: 'var(--color-prism-warning)',
  failed: 'var(--color-prism-error)',
};

export function TrackListItem({
  title,
  artist,
  duration,
  bpm,
  fMeasure,
  status,
  selected,
  onSelect,
}: TrackListItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.();
        }
      }}
      className={cn(
        'w-full rounded-lg border px-4 py-3 text-left transition-colors',
        selected
          ? 'border-[var(--color-primary)]'
          : 'border-transparent hover:border-[var(--color-border)]',
      )}
      style={{
        backgroundColor: selected
          ? 'var(--color-prism-bg-elevated)'
          : 'var(--color-prism-bg-surface)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p
            className="font-medium"
            style={{ color: 'var(--color-prism-text-primary)' }}
          >
            {title}
          </p>
          <p
            className="text-sm"
            style={{ color: 'var(--color-prism-text-secondary)' }}
          >
            {artist}
            {duration ? ` · ${duration}` : null}
            {bpm ? ` · ${bpm} BPM` : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {typeof fMeasure === 'number' ? (
            <Badge
              variant="outline"
              className="text-xs"
              style={{
                borderColor: statusColor[status],
                color: statusColor[status],
              }}
            >
              F {fMeasure.toFixed(3)}
            </Badge>
          ) : null}
          <Badge
            variant="outline"
            className="text-xs"
            style={{
              borderColor: statusColor[status],
              color: statusColor[status],
            }}
          >
            {statusLabel[status]}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            className="hidden md:inline-flex"
            onClick={(e) => {
              // prevent bubbling to outer container selection
              e.stopPropagation();
            }}
          >
            Deploy
          </Button>
        </div>
      </div>
    </div>
  );
}

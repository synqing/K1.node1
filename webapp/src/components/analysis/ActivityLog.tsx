import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';

export type ActivityLogSeverity = 'info' | 'warning' | 'error';

export interface ActivityLogItem {
  id: string;
  message: string;
  severity: ActivityLogSeverity;
  timestamp: string;
}

interface ActivityLogProps {
  items: ActivityLogItem[];
  pinned?: boolean;
  onTogglePin?: () => void;
}

const severityColor: Record<ActivityLogSeverity, string> = {
  info: 'var(--color-prism-info)',
  warning: 'var(--color-prism-warning)',
  error: 'var(--color-prism-error)',
};

export function ActivityLog({ items, pinned, onTogglePin }: ActivityLogProps) {
  return (
    <div
      className={cn('border-t px-4 py-2', pinned ? 'sticky bottom-0' : 'relative')}
      style={{
        backgroundColor: 'var(--color-prism-bg-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4
            className="font-['Bebas_Neue',sans-serif] uppercase tracking-wide"
            style={{ color: 'var(--color-prism-text-primary)' }}
          >
            Activity
          </h4>
          <Badge
            variant="outline"
            className="cursor-pointer text-xs"
            onClick={onTogglePin}
            style={{
              borderColor: pinned ? 'var(--color-prism-gold)' : 'var(--color-border)',
              color: pinned ? 'var(--color-prism-gold)' : 'var(--color-prism-text-secondary)',
            }}
          >
            {pinned ? 'Pinned' : 'Pin logs'}
          </Badge>
        </div>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        {!items.length ? (
          <div
            className="rounded px-3 py-2 text-center text-xs text-muted-foreground"
            style={{ backgroundColor: 'var(--color-prism-bg-elevated)' }}
          >
            No recent activity
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded px-3 py-2"
              style={{
                backgroundColor: 'var(--color-prism-bg-elevated)',
                color: 'var(--color-prism-text-primary)',
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex h-2 w-2 rounded-full"
                  style={{ backgroundColor: severityColor[item.severity] }}
                />
                <span>{item.message}</span>
              </div>
              <span
                className="font-mono text-xs"
                style={{ color: 'var(--color-prism-text-secondary)' }}
              >
                {item.timestamp}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

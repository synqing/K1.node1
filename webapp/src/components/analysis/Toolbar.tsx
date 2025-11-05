import { UploadCloud, Play, Search, Gauge, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import { HelpShortcuts } from './HelpShortcuts';

interface ToolbarProps {
  onUploadClick: () => void;
  onAnalyseClick: () => void;
  onDeployClick: () => void;
  onApplyRecommendationsClick?: () => void;
  isDeviceConnected?: boolean;
}

export function Toolbar({
  onUploadClick,
  onAnalyseClick,
  onDeployClick,
  onApplyRecommendationsClick,
  isDeviceConnected,
}: ToolbarProps) {
  return (
    <div
      className="border-b px-4 py-3"
      style={{
        backgroundColor: 'var(--color-prism-bg-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Button onClick={onUploadClick} className="gap-2">
            <UploadCloud className="h-4 w-4" />
            Upload
          </Button>
          <Button variant="secondary" onClick={onAnalyseClick} className="gap-2">
            <Play className="h-4 w-4" />
            Analyse
          </Button>
          <Button variant="outline" onClick={onDeployClick}>
            Deploy
          </Button>
          {onApplyRecommendationsClick && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={onApplyRecommendationsClick}
              disabled={!isDeviceConnected}
              aria-label="Apply analysis recommendations"
            >
              <Sparkles className="h-4 w-4" />
              Apply Recs
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {['EDM', 'Rock', 'Orchestral'].map((preset) => (
            <Badge
              key={preset}
              variant="outline"
              className={cn(
                'cursor-pointer',
                'hover:bg-[var(--color-prism-bg-elevated)] transition-colors'
              )}
            >
              {preset}
            </Badge>
          ))}
        </div>

        <div className="flex-1 min-w-[160px] max-w-xs">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--color-prism-text-secondary)' }}
            />
            <Input
              placeholder="Search tracks..."
              className="pl-9"
              style={{
                backgroundColor: 'var(--color-prism-bg-canvas)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-prism-text-primary)',
              }}
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4" style={{ color: 'var(--color-prism-success)' }} />
            <div className="flex items-center gap-1">
              <Badge
                variant="outline"
                className="text-xs"
                style={{
                  borderColor: 'var(--color-prism-success)',
                  color: 'var(--color-prism-success)',
                }}
              >
                Workers: 4/4
              </Badge>
              <Badge
                variant="outline"
                className="text-xs"
                style={{
                  borderColor: 'var(--color-prism-info)',
                  color: 'var(--color-prism-info)',
                }}
              >
                Queue: 2
              </Badge>
            </div>
          </div>

          <Badge
            className="gap-1.5"
            style={{
              backgroundColor: 'var(--color-prism-info)',
              color: 'var(--color-prism-bg-canvas)',
            }}
          >
            <span className="relative flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                style={{ backgroundColor: 'var(--color-prism-bg-canvas)' }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ backgroundColor: 'var(--color-prism-bg-canvas)' }}
              />
            </span>
            2 In Progress
          </Badge>

          <HelpShortcuts />
        </div>
      </div>
    </div>
  );
}

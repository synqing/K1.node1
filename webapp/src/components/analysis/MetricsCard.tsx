import { HelpCircle, TrendingDown, TrendingUp } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

export type MetricTone = 'positive' | 'neutral' | 'warning' | 'negative';

interface MetricsCardProps {
  title: string;
  value: string;
  delta?: string;
  tone?: MetricTone;
  tooltip?: string;
}

const toneColor: Record<MetricTone, string> = {
  positive: 'var(--color-prism-success)',
  neutral: 'var(--color-prism-gold)',
  warning: 'var(--color-prism-warning)',
  negative: 'var(--color-prism-error)',
};

export function MetricsCard({
  title,
  value,
  delta,
  tone = 'neutral',
  tooltip,
}: MetricsCardProps) {
  const color = toneColor[tone];
  const isPositive = tone === 'positive';
  const isNegative = tone === 'negative';

  return (
    <div
      className="rounded-lg border p-4 transition-all hover:shadow-lg"
      style={{
        backgroundColor: 'var(--color-prism-bg-surface)',
        borderColor: tone === 'neutral' ? 'var(--color-border)' : color,
      }}
    >
      <div className="mb-3 flex items-start justify-between">
        <span
          className="text-xs uppercase tracking-wider"
          style={{ color: 'var(--color-prism-text-secondary)' }}
        >
          {title}
        </span>
        {tooltip ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-xs text-muted-foreground">
                  <HelpCircle
                    className="h-3.5 w-3.5"
                    style={{ color: 'var(--color-prism-text-secondary)' }}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>

      <div className="flex items-end justify-between">
        <span
          className="font-mono text-2xl"
          style={{ color: 'var(--color-prism-text-primary)' }}
        >
          {value}
        </span>
        {delta ? (
          <span
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-mono"
            style={{
              backgroundColor: 'var(--color-prism-bg-canvas)',
              color,
            }}
          >
            {isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : isNegative ? (
              <TrendingDown className="h-3 w-3" />
            ) : null}
            {delta}
          </span>
        ) : null}
      </div>
    </div>
  );
}

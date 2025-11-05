import {
  Cell,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../ui/card';
import { cn } from '../ui/utils';

const SAMPLE_BEATS = Array.from({ length: 32 }).map((_, index) => ({
  time: (index * 0.5).toFixed(1),
  intensity: index % 4 === 0 ? 1 : 0.5,
  downbeat: index % 4 === 0,
}));

interface BeatGridChartProps {
  className?: string;
}

export function BeatGridChart({ className }: BeatGridChartProps) {
  return (
    <Card
      className={cn('h-56 border', className)}
      style={{
        backgroundColor: 'var(--color-prism-bg-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h4
            className="font-['Bebas_Neue',sans-serif] uppercase tracking-wide"
            style={{ color: 'var(--color-prism-text-primary)' }}
          >
            Beat Grid
          </h4>
          <span
            className="text-xs"
            style={{ color: 'var(--color-prism-text-secondary)' }}
          >
            Downbeats highlighted in gold
          </span>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={SAMPLE_BEATS}>
              <XAxis dataKey="time" hide />
              <YAxis hide domain={[0, 1]} />
              <RechartsTooltip
                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const beat = payload[0].payload as (typeof SAMPLE_BEATS)[0];
                  return (
                    <div
                      className="rounded border px-3 py-2 text-xs"
                      style={{
                        backgroundColor: 'var(--color-prism-bg-canvas)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-prism-text-primary)',
                      }}
                    >
                      <div>Time: {beat.time}s</div>
                      <div>
                        Type: {beat.downbeat ? 'Downbeat' : 'Beat'}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="intensity"
                radius={[6, 6, 0, 0]}
                fill="#1F2937"
                animationDuration={300}
              >
                {SAMPLE_BEATS.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.downbeat
                        ? 'var(--color-prism-gold)'
                        : 'var(--color-prism-text-secondary)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

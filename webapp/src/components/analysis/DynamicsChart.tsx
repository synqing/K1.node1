import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../ui/card';

const SAMPLE_DYNAMICS = Array.from({ length: 48 }).map((_, idx) => ({
  time: idx,
  rms: Math.max(0.05, Math.sin(idx / 8) * 0.3 + 0.4 + Math.random() * 0.05),
}));

export function DynamicsChart() {
  return (
    <Card
      className="h-56 border"
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
            Dynamics
          </h4>
          <span
            className="text-xs"
            style={{ color: 'var(--color-prism-text-secondary)' }}
          >
            RMS window 50ms
          </span>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={SAMPLE_DYNAMICS}>
              <XAxis hide dataKey="time" />
              <YAxis hide domain={[0, 1]} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: 'var(--color-prism-bg-canvas)',
                  color: 'var(--color-prism-text-primary)',
                  border: '1px solid var(--color-border)',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="rms"
                stroke="var(--color-chart-4)"
                fill="var(--color-chart-4)"
                fillOpacity={0.4}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../ui/card';

const SAMPLE_FREQUENCY = Array.from({ length: 32 }).map((_, index) => ({
  time: index,
  low: Math.max(0.1, Math.sin(index / 4) + 0.6),
  mid: Math.max(0.1, Math.cos(index / 5) + 0.4),
  high: Math.max(0.1, Math.sin(index / 6 + 1) + 0.3),
}));

export function FrequencyChart() {
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
            Frequency Bands
          </h4>
          <span
            className="text-xs"
            style={{ color: 'var(--color-prism-text-secondary)' }}
          >
            Low (20–250 Hz) · Mid (250–4k) · High (4k–20k)
          </span>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={SAMPLE_FREQUENCY}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" />
              <XAxis hide dataKey="time" />
              <YAxis hide domain={[0, 2]} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: 'var(--color-prism-bg-canvas)',
                  color: 'var(--color-prism-text-primary)',
                  border: '1px solid var(--color-border)',
                  fontSize: '12px',
                }}
              />
              <Legend
                formatter={(value) => (
                  <span style={{ color: 'var(--color-prism-text-secondary)' }}>{value}</span>
                )}
              />
              <Area
                type="monotone"
                dataKey="low"
                stackId="1"
                stroke="var(--color-chart-1)"
                fill="var(--color-chart-1)"
                fillOpacity={0.45}
              />
              <Area
                type="monotone"
                dataKey="mid"
                stackId="1"
                stroke="var(--color-chart-2)"
                fill="var(--color-chart-2)"
                fillOpacity={0.45}
              />
              <Area
                type="monotone"
                dataKey="high"
                stackId="1"
                stroke="var(--color-chart-3)"
                fill="var(--color-chart-3)"
                fillOpacity={0.45}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

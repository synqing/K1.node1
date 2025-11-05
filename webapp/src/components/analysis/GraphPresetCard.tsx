import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';

const SAMPLE_DIFF = {
  added: ['BeatPulse → AudioReactive', 'IntensityNormalizer'],
  removed: ['LegacyVisualizer'],
  changed: ['ColorMapper (gain 1.2 → 1.4)'],
};

export function GraphPresetCard() {
  return (
    <Card
      className="space-y-4 border p-4"
      style={{
        backgroundColor: 'var(--color-prism-bg-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h4
            className="font-['Bebas_Neue',sans-serif] uppercase tracking-wide"
            style={{ color: 'var(--color-prism-text-primary)' }}
          >
            Recommended Graph Template
          </h4>
          <p
            className="text-sm"
            style={{ color: 'var(--color-prism-text-secondary)' }}
          >
            Optimised for EDM · est. runtime 7.3 ms (confidence 0.82)
          </p>
        </div>
        <Badge
          style={{
            backgroundColor: 'var(--color-prism-success)',
            color: 'var(--color-prism-bg-canvas)',
          }}
        >
          Firmware ≥ 2.5.0
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {['BeatPulse', 'TempoTracker', 'SpectrumFan', 'ColorMapper'].map((node) => (
          <Badge
            key={node}
            variant="outline"
            className="text-xs"
            style={{ borderColor: 'var(--color-prism-field)', color: 'var(--color-prism-field)' }}
          >
            {node}
          </Badge>
        ))}
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <DiffList title="Added" items={SAMPLE_DIFF.added} color="var(--color-prism-success)" />
        <DiffList title="Removed" items={SAMPLE_DIFF.removed} color="var(--color-prism-error)" />
        <DiffList title="Changed" items={SAMPLE_DIFF.changed} color="var(--color-prism-warning)" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm">Apply template</Button>
        <Button size="sm" variant="secondary">
          Customise in graph editor
        </Button>
        <Button size="sm" variant="outline">
          Simulate improvements
        </Button>
      </div>
    </Card>
  );
}

interface DiffListProps {
  title: string;
  items: string[];
  color: string;
}

function DiffList({ title, items, color }: DiffListProps) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{
        backgroundColor: 'var(--color-prism-bg-elevated)',
        borderColor: color,
      }}
    >
      <p
        className="mb-2 text-xs uppercase tracking-wide"
        style={{ color }}
      >
        {title}
      </p>
      <ul className="space-y-1 text-xs" style={{ color: 'var(--color-prism-text-primary)' }}>
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

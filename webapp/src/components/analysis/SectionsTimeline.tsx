import { Button } from '../ui/button';
import { Card } from '../ui/card';

const SAMPLE_SECTIONS = [
  { name: 'Intro', start: 0, end: 15, color: 'var(--color-prism-gold)' },
  { name: 'Verse', start: 15, end: 45, color: 'var(--color-chart-1)' },
  { name: 'Chorus', start: 45, end: 75, color: 'var(--color-chart-2)' },
  { name: 'Drop', start: 75, end: 100, color: 'var(--color-chart-3)' },
];

export function SectionsTimeline() {
  return (
    <Card
      className="border"
      style={{
        backgroundColor: 'var(--color-prism-bg-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <h4
            className="font-['Bebas_Neue',sans-serif] uppercase tracking-wide"
            style={{ color: 'var(--color-prism-text-primary)' }}
          >
            Sections
          </h4>
          <div className="flex items-center gap-2">
            {SAMPLE_SECTIONS.map((section) => (
              <Button key={section.name} size="sm" variant="outline">
                {section.name}
              </Button>
            ))}
          </div>
        </div>

        <div className="h-14 rounded-lg border"
          style={{
            backgroundColor: 'var(--color-prism-bg-canvas)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="flex h-full w-full overflow-hidden rounded-lg">
            {SAMPLE_SECTIONS.map((section) => (
              <div
                key={section.name}
                className="flex items-center justify-center text-xs font-medium"
                style={{
                  width: `${(section.end - section.start)}%`,
                  background: section.color,
                  color: 'var(--color-prism-bg-canvas)',
                }}
              >
                {section.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

import { HelpCircle } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';

const SHORTCUTS = [
  { key: 'U', description: 'Open Upload Modal' },
  { key: 'A', description: 'Analyse selected track' },
  { key: 'D', description: 'Deploy bundle' },
  { key: 'L', description: 'Toggle activity logs' },
  { key: '?', description: 'Show shortcuts overlay' },
  { key: 'Esc', description: 'Close dialogs' },
  { key: '↑ / ↓', description: 'Navigate track list' },
  { key: 'Enter', description: 'Select track' },
];

export function HelpShortcuts() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0"
          title="Keyboard shortcuts"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 space-y-3 border"
        style={{
          backgroundColor: 'var(--color-prism-bg-elevated)',
          borderColor: 'var(--color-border)',
        }}
      >
        <h4
          className="font-['Bebas_Neue',sans-serif] uppercase tracking-wide"
          style={{ color: 'var(--color-prism-text-primary)' }}
        >
          Keyboard Shortcuts
        </h4>
        <div className="space-y-2">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.key}
              className="flex items-center justify-between rounded px-3 py-2"
              style={{ backgroundColor: 'var(--color-prism-bg-surface)' }}
            >
              <span
                className="text-sm"
                style={{ color: 'var(--color-prism-text-primary)' }}
              >
                {shortcut.description}
              </span>
              <kbd
                className="rounded border px-2 py-1 text-xs font-mono"
                style={{
                  backgroundColor: 'var(--color-prism-bg-canvas)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-prism-text-secondary)',
                }}
              >
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
        <p
          className="text-xs"
          style={{ color: 'var(--color-prism-text-secondary)' }}
        >
          Press <kbd className="font-mono">?</kbd> anytime to view shortcuts.
        </p>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Boolean Parameter Control
 *
 * Toggle switch for boolean parameters
 */

import { Label } from '../../ui/label';

interface BooleanControlProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  error?: string;
}

export function BooleanControl({
  label,
  description,
  value,
  onChange,
  error,
}: BooleanControlProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-[var(--prism-text-secondary)] cursor-pointer">
          {label}
        </Label>
        <button
          onClick={() => onChange(!value)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            value
              ? 'bg-[var(--prism-success)]'
              : 'bg-[var(--prism-bg-elevated)]'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              value ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {description && (
        <p className="text-xs text-[var(--prism-text-secondary)]">{description}</p>
      )}

      {error && (
        <p className="text-xs text-[var(--prism-error)]">{error}</p>
      )}
    </div>
  );
}

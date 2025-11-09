/**
 * Select Parameter Control
 *
 * Dropdown control for select parameters
 */

import { Label } from '../../ui/label';
import { SelectParameterConfig } from '../types';

interface SelectControlProps {
  label: string;
  description?: string;
  value: any;
  config: SelectParameterConfig;
  onChange: (value: any) => void;
  error?: string;
}

export function SelectControl({
  label,
  description,
  value,
  config,
  onChange,
  error,
}: SelectControlProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label className="text-xs text-[var(--prism-text-secondary)]">
          {label}
        </Label>
      </div>

      {description && (
        <p className="text-xs text-[var(--prism-text-secondary)]">{description}</p>
      )}

      <select
        value={value}
        onChange={(e) => {
          const selected = config.options.find(opt => opt.value === e.target.value);
          onChange(selected?.value ?? e.target.value);
        }}
        className={`w-full px-2 py-1.5 text-xs bg-[var(--prism-bg-elevated)] border rounded text-[var(--prism-text-primary)] focus:outline-none focus:border-[var(--prism-info)] ${
          error ? 'border-[var(--prism-error)]' : 'border-[var(--prism-bg-elevated)]'
        }`}
      >
        {config.options.map((option) => (
          <option key={String(option.value)} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {error && (
        <p className="text-xs text-[var(--prism-error)]">{error}</p>
      )}
    </div>
  );
}

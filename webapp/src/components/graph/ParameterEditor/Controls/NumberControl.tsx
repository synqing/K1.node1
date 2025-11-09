/**
 * Number Parameter Control
 *
 * Input control for numeric parameters with optional range slider
 */

import { useState } from 'react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { NumberParameterConfig } from '../types';

interface NumberControlProps {
  label: string;
  description?: string;
  value: number;
  config: NumberParameterConfig;
  onChange: (value: number) => void;
  error?: string;
}

export function NumberControl({
  label,
  description,
  value,
  config,
  onChange,
  error,
}: NumberControlProps) {
  const [inputValue, setInputValue] = useState(String(value));

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseFloat(e.target.value);
    setInputValue(String(num));
    onChange(num);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputValue(text);

    if (text === '' || text === '-') return;

    const num = parseFloat(text);
    if (!isNaN(num)) {
      const min = config.min ?? -Infinity;
      const max = config.max ?? Infinity;
      const clamped = Math.max(min, Math.min(max, num));
      onChange(clamped);
    }
  };

  const min = config.min ?? 0;
  const max = config.max ?? 100;
  const step = config.step ?? 1;
  const hasRange = config.min !== undefined && config.max !== undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label className="text-xs text-[var(--prism-text-secondary)]">
          {label}
          {config.unit && <span className="text-xs ml-1">({config.unit})</span>}
        </Label>
        <span className="text-xs font-mono text-[var(--prism-text-primary)]">
          {value.toFixed(String(step).includes('.') ? 2 : 0)}
        </span>
      </div>

      {description && (
        <p className="text-xs text-[var(--prism-text-secondary)]">{description}</p>
      )}

      {hasRange && (
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleSliderChange}
          className="w-full h-2 bg-[var(--prism-bg-elevated)] rounded-lg appearance-none cursor-pointer accent-[var(--prism-info)]"
        />
      )}

      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={inputValue}
        onChange={handleInputChange}
        className={`h-7 text-xs bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-elevated)] text-[var(--prism-text-primary)] ${
          error ? 'border-[var(--prism-error)]' : ''
        }`}
      />

      {error && (
        <p className="text-xs text-[var(--prism-error)]">{error}</p>
      )}

      {hasRange && (
        <div className="flex justify-between text-xs text-[var(--prism-text-secondary)]">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  );
}

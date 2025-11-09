/**
 * Color Parameter Control
 *
 * Color picker for color parameters with RGB/HSV/Hex support
 */

import { useState } from 'react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { ColorParameterConfig } from '../types';

interface ColorControlProps {
  label: string;
  description?: string;
  value: string | { r: number; g: number; b: number };
  config: ColorParameterConfig;
  onChange: (value: string) => void;
  error?: string;
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
      .toUpperCase()
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function getRgbValue(
  value: string | { r: number; g: number; b: number }
): { r: number; g: number; b: number } {
  if (typeof value === 'string') {
    return hexToRgb(value) || { r: 255, g: 0, b: 0 };
  }
  return value;
}

function getHexValue(
  value: string | { r: number; g: number; b: number }
): string {
  if (typeof value === 'string' && value.startsWith('#')) {
    return value;
  }
  const rgb = getRgbValue(value);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

export function ColorControl({
  label,
  description,
  value,
  config,
  onChange,
  error,
}: ColorControlProps) {
  const hexValue = getHexValue(value);
  const rgb = getRgbValue(value);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    if (hex.length === 7 && hex.startsWith('#')) {
      onChange(hex);
    }
  };

  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

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

      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <Input
            type="text"
            value={hexValue}
            onChange={handleHexChange}
            placeholder="#000000"
            className="h-7 text-xs bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-elevated)] text-[var(--prism-text-primary)] font-mono"
          />
        </div>

        <div className="flex gap-2">
          <input
            type="color"
            value={hexValue}
            onChange={handleColorPickerChange}
            className="w-8 h-8 rounded cursor-pointer"
          />

          <div
            className="w-8 h-8 rounded border border-[var(--prism-bg-elevated)]"
            style={{
              backgroundColor: hexValue,
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs pt-2">
        <div>
          <Label className="text-xs text-[var(--prism-text-secondary)]">R</Label>
          <div className="font-mono text-[var(--prism-text-primary)]">{rgb.r}</div>
        </div>
        <div>
          <Label className="text-xs text-[var(--prism-text-secondary)]">G</Label>
          <div className="font-mono text-[var(--prism-text-primary)]">{rgb.g}</div>
        </div>
        <div>
          <Label className="text-xs text-[var(--prism-text-secondary)]">B</Label>
          <div className="font-mono text-[var(--prism-text-primary)]">{rgb.b}</div>
        </div>
      </div>

      {error && (
        <p className="text-xs text-[var(--prism-error)]">{error}</p>
      )}
    </div>
  );
}

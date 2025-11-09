/**
 * Array Parameter Control
 *
 * Control for array-type parameters with add/remove functionality
 */

import { Plus, X } from 'lucide-react';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { ArrayParameterConfig } from '../types';

interface ArrayControlProps {
  label: string;
  description?: string;
  value: any[];
  config: ArrayParameterConfig;
  onChange: (value: any[]) => void;
  error?: string;
}

export function ArrayControl({
  label,
  description,
  value,
  config,
  onChange,
  error,
}: ArrayControlProps) {
  const maxLength = config.maxLength ?? 10;
  const minLength = config.minLength ?? 0;
  const canAdd = value.length < maxLength;
  const canRemove = value.length > minLength;

  const handleAdd = () => {
    if (canAdd) {
      const newValue = [...value, null];
      onChange(newValue);
    }
  };

  const handleRemove = (index: number) => {
    if (canRemove) {
      const newValue = value.filter((_, i) => i !== index);
      onChange(newValue);
    }
  };

  const handleChange = (index: number, itemValue: any) => {
    const newValue = [...value];
    newValue[index] = itemValue;
    onChange(newValue);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label className="text-xs text-[var(--prism-text-secondary)]">
          {label}
          <span className="text-xs text-[var(--prism-text-secondary)]">
            {' '}
            ({value.length}/{maxLength})
          </span>
        </Label>
      </div>

      {description && (
        <p className="text-xs text-[var(--prism-text-secondary)]">{description}</p>
      )}

      <div className="space-y-2">
        {value.map((item, index) => (
          <div key={index} className="flex gap-2">
            {config.itemType === 'number' ? (
              <Input
                type="number"
                value={item ?? ''}
                onChange={(e) =>
                  handleChange(index, parseFloat(e.target.value) || 0)
                }
                className="flex-1 h-7 text-xs bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-elevated)] text-[var(--prism-text-primary)]"
                placeholder={`Item ${index + 1}`}
              />
            ) : (
              <Input
                type="text"
                value={item ?? ''}
                onChange={(e) => handleChange(index, e.target.value)}
                className="flex-1 h-7 text-xs bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-elevated)] text-[var(--prism-text-primary)]"
                placeholder={`Item ${index + 1}`}
              />
            )}
            {canRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(index)}
                className="h-7 w-7 p-0 text-[var(--prism-error)] hover:text-[var(--prism-error)]"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {canAdd && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAdd}
          className="w-full h-7 text-xs text-[var(--prism-info)] hover:bg-[var(--prism-bg-elevated)]"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Item
        </Button>
      )}

      {error && (
        <p className="text-xs text-[var(--prism-error)]">{error}</p>
      )}
    </div>
  );
}

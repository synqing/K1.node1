import { useEffect, useState } from 'react';
import { Effect, EffectParameter } from '../../lib/types';
import { Slider } from '../ui/slider';
import { Label } from '../ui/label';

interface EffectParametersProps {
  effect: Effect;
  onParameterChange: (paramName: string, value: number) => void;
}

export function EffectParameters({ effect, onParameterChange }: EffectParametersProps) {
  const [localValues, setLocalValues] = useState<Record<string, number>>({});
  
  useEffect(() => {
    const values: Record<string, number> = {};
    effect.parameters.forEach(param => {
      values[param.name] = param.value;
    });
    setLocalValues(values);
  }, [effect]);
  
  const handleChange = (param: EffectParameter, value: number[]) => {
    const newValue = value[0];
    setLocalValues(prev => ({ ...prev, [param.name]: newValue }));
    onParameterChange(param.name, newValue);
  };
  
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'scalar': return 'var(--prism-scalar)';
      case 'field': return 'var(--prism-field)';
      case 'color': return 'var(--prism-color)';
      case 'output': return 'var(--prism-output)';
      default: return 'var(--prism-text-primary)';
    }
  };
  
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-1">
          Effect Parameters
        </h3>
        <p className="text-xs text-[var(--prism-text-secondary)]">
          {effect.description}
        </p>
      </div>

      <div className="space-y-5">
        {effect.parameters.length === 0 && (
          <div className="text-xs text-[var(--prism-text-secondary)] bg-[var(--prism-bg-elevated)]/40 border border-[var(--prism-bg-elevated)] rounded p-3">
            No parameters available for this effect yet. Controls will appear here once they are mapped to meaningful device behaviors.
          </div>
        )}
        {effect.parameters.map((param) => (
          <div key={param.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label 
                htmlFor={`param-${param.name}`}
                className="text-xs"
                style={{ color: getTypeColor(param.type) }}
              >
                {param.name}
              </Label>
              <span className="text-xs font-jetbrains text-[var(--prism-text-primary)]">
                {localValues[param.name] ?? param.value}
                {param.unit && <span className="text-[var(--prism-text-secondary)] ml-0.5">{param.unit}</span>}
              </span>
            </div>
            <Slider
              id={`param-${param.name}`}
              min={param.min}
              max={param.max}
              step={param.step}
              value={[localValues[param.name] ?? param.value]}
              onValueChange={(value) => handleChange(param, value)}
              className="[&_[role=slider]]:border-2"
              style={{
                // @ts-ignore
                '--slider-color': getTypeColor(param.type),
              }}
            />
            <div className="flex justify-between text-xs text-[var(--prism-text-secondary)] font-jetbrains">
              <span>{param.min}{param.unit}</span>
              <span>{param.max}{param.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

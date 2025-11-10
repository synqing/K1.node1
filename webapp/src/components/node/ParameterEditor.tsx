import React from 'react';
import { Node, NodeParameter } from '../../lib/types';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface ParameterEditorProps {
  node: Node;
  onParameterChange: (nodeId: string, parameterName: string, value: any) => void;
}

export function ParameterEditor({ node, onParameterChange }: ParameterEditorProps) {
  if (!node.parameters || node.parameters.length === 0) {
    return null;
  }

  const handleNumberChange = (paramName: string, value: string) => {
    const numberValue = parseFloat(value);
    if (!isNaN(numberValue)) {
      onParameterChange(node.id, paramName, numberValue);
    }
  };

  return (
    <div className="p-4 border-t border-gray-700">
      <h4 className="text-sm font-semibold mb-2">Parameters</h4>
      <div className="space-y-4">
        {node.parameters.map((param) => (
          <div key={param.name}>
            <Label htmlFor={`${node.id}-${param.name}`} className="text-xs">
              {param.name}
            </Label>
            {param.type === 'number' && (
              <div className="flex items-center space-x-2">
                <Input
                  type="range"
                  id={`${node.id}-${param.name}`}
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  value={param.value as number}
                  onChange={(e) => handleNumberChange(param.name, e.target.value)}
                  className="w-full"
                />
                <Input
                  type="number"
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  value={param.value as number}
                  onChange={(e) => handleNumberChange(param.name, e.target.value)}
                  className="w-24"
                />
              </div>
            )}
            {param.type === 'color' && (
              <Input
                type="color"
                id={`${node.id}-${param.name}`}
                value={param.value as string}
                onChange={(e) => onParameterChange(node.id, param.name, e.target.value)}
                className="w-full"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

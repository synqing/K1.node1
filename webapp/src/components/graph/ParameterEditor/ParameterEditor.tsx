/**
 * Parameter Editor Component
 *
 * Main component for editing node parameters with support for:
 * - Dynamic form generation based on node type
 * - Type-aware input controls
 * - Real-time validation
 * - Parameter presets
 * - Randomization and reset
 */

import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, Shuffle, Download, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { toast } from 'sonner';

import { ParameterDefinition, ParameterPreset } from './types';
import { getParameterSchema } from './schemas';
import {
  NumberControl,
  ColorControl,
  SelectControl,
  BooleanControl,
  ArrayControl,
} from './Controls';
import { PresetManager } from './PresetManager';
import {
  validateParameters,
  hasValidationErrors,
} from './validation';
import {
  getDefaultValues,
  randomizeParameters,
  cloneParameters,
} from './utils';

interface ParameterEditorProps {
  nodeId: string;
  nodeType: string;
  initialValues?: Record<string, any>;
  onParametersChange: (nodeId: string, parameters: Record<string, any>) => void;
  onClose?: () => void;
  showPresets?: boolean;
  showRandomize?: boolean;
  showReset?: boolean;
  showExport?: boolean;
  livePreview?: boolean;
}

export function ParameterEditor({
  nodeId,
  nodeType,
  initialValues = {},
  onParametersChange,
  onClose,
  showPresets = true,
  showRandomize = true,
  showReset = true,
  showExport = true,
  livePreview = true,
}: ParameterEditorProps) {
  const schema = getParameterSchema(nodeType);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [history, setHistory] = useState<Record<string, any>[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Initialize values
  useEffect(() => {
    if (schema) {
      const defaults = getDefaultValues(schema.parameters);
      const initial = { ...defaults, ...initialValues };
      setValues(initial);
      setHistory([initial]);
      setHistoryIndex(0);
      setIsDirty(false);
    }
  }, [nodeType, initialValues, schema]);

  // Validate on change
  const handleParameterChange = useCallback(
    (paramName: string, value: any) => {
      if (!schema) return;

      const newValues = { ...values, [paramName]: value };
      setValues(newValues);
      setIsDirty(true);

      // Validate
      const newErrors = validateParameters(schema.parameters, newValues);
      setErrors(newErrors);

      // Add to history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(cloneParameters(newValues));
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);

      // Live preview
      if (livePreview && !hasValidationErrors(newErrors)) {
        onParametersChange(nodeId, newValues);
      }
    },
    [schema, values, history, historyIndex, nodeId, onParametersChange, livePreview]
  );

  const handleReset = () => {
    if (!schema) return;

    const defaults = getDefaultValues(schema.parameters);
    setValues(defaults);
    setErrors({});
    setIsDirty(false);

    const newHistory = [defaults];
    setHistory(newHistory);
    setHistoryIndex(0);

    onParametersChange(nodeId, defaults);
    toast.success('Parameters reset to defaults');
  };

  const handleRandomize = () => {
    if (!schema) return;

    const randomized = randomizeParameters(schema.parameters);
    setValues(randomized);

    // Validate
    const newErrors = validateParameters(schema.parameters, randomized);
    setErrors(newErrors);
    setIsDirty(true);

    // Add to history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(cloneParameters(randomized));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    if (!hasValidationErrors(newErrors)) {
      onParametersChange(nodeId, randomized);
      toast.success('Parameters randomized');
    }
  };

  const handleExport = () => {
    const data = {
      nodeType,
      parameters: values,
      timestamp: new Date().toISOString(),
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${nodeType}-params-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('Parameters exported');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.nodeType !== nodeType) {
        toast.error('Parameter type mismatch');
        return;
      }

      setValues(data.parameters);
      setIsDirty(true);

      // Add to history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(cloneParameters(data.parameters));
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);

      onParametersChange(nodeId, data.parameters);
      toast.success('Parameters imported');
    } catch (error) {
      console.error('Import failed:', error);
      toast.error('Failed to import parameters');
    }

    // Reset file input
    e.target.value = '';
  };

  const handleLoadPreset = (preset: ParameterPreset) => {
    const presetValues = cloneParameters(preset.values);
    setValues(presetValues);
    setIsDirty(true);

    // Add to history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(presetValues);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    onParametersChange(nodeId, presetValues);
  };

  if (!schema) {
    return (
      <div className="h-full bg-[var(--prism-bg-surface)] border-l border-[var(--prism-bg-elevated)] p-4 flex items-center justify-center">
        <p className="text-xs text-[var(--prism-text-secondary)]">
          No parameters available for this node type
        </p>
      </div>
    );
  }

  const visibleParams = schema.parameters.filter((p) => !p.hidden);

  return (
    <div className="h-full flex flex-col bg-[var(--prism-bg-surface)] border-l border-[var(--prism-bg-elevated)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--prism-bg-elevated)]">
        <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-1">
          Parameter Editor
        </h3>
        <p className="text-xs text-[var(--prism-text-secondary)]">
          {nodeType} parameters
        </p>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-3 border-b border-[var(--prism-bg-elevated)]">
        <div className="flex gap-2 flex-wrap">
          {showReset && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleReset}
              className="h-7 text-xs text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)]"
              title="Reset to default values"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
          )}

          {showRandomize && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRandomize}
              className="h-7 text-xs text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)]"
              title="Generate random values"
            >
              <Shuffle className="w-3 h-3 mr-1" />
              Randomize
            </Button>
          )}

          {showExport && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleExport}
                className="h-7 text-xs text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)]"
                title="Export parameters as JSON"
              >
                <Download className="w-3 h-3 mr-1" />
                Export
              </Button>

              <label className="h-7 px-3 rounded flex items-center gap-1 text-xs cursor-pointer text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)] hover:bg-[var(--prism-bg-elevated)] transition-colors">
                <Upload className="w-3 h-3" />
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </>
          )}
        </div>
      </div>

      {/* Parameters */}
      <div className="flex-1 overflow-y-auto">
        {visibleParams.length > 0 && (
          <div className="px-4 py-3 space-y-4">
            {visibleParams.map((param) => (
              <div key={param.name} className="space-y-2">
                {param.config.type === 'number' && (
                  <NumberControl
                    label={param.label}
                    description={param.description}
                    value={values[param.name] ?? 0}
                    config={param.config as any}
                    onChange={(val) => handleParameterChange(param.name, val)}
                    error={errors[param.name]}
                  />
                )}

                {param.config.type === 'color' && (
                  <ColorControl
                    label={param.label}
                    description={param.description}
                    value={values[param.name] ?? '#FF0000'}
                    config={param.config as any}
                    onChange={(val) => handleParameterChange(param.name, val)}
                    error={errors[param.name]}
                  />
                )}

                {param.config.type === 'select' && (
                  <SelectControl
                    label={param.label}
                    description={param.description}
                    value={values[param.name]}
                    config={param.config as any}
                    onChange={(val) => handleParameterChange(param.name, val)}
                    error={errors[param.name]}
                  />
                )}

                {param.config.type === 'boolean' && (
                  <BooleanControl
                    label={param.label}
                    description={param.description}
                    value={values[param.name] ?? false}
                    onChange={(val) => handleParameterChange(param.name, val)}
                    error={errors[param.name]}
                  />
                )}

                {param.config.type === 'array' && (
                  <ArrayControl
                    label={param.label}
                    description={param.description}
                    value={values[param.name] ?? []}
                    config={param.config as any}
                    onChange={(val) => handleParameterChange(param.name, val)}
                    error={errors[param.name]}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Presets */}
      {showPresets && (
        <PresetManager
          nodeType={nodeType}
          currentValues={values}
          onLoadPreset={handleLoadPreset}
        />
      )}
    </div>
  );
}

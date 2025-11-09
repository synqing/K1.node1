/**
 * Parameter Editor Hook
 *
 * Custom hook for managing parameter editor state and operations
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ParameterPreset } from '../components/graph/ParameterEditor/types';
import {
  getDefaultValues,
  randomizeParameters,
  cloneParameters,
  areParametersEqual,
} from '../components/graph/ParameterEditor/utils';
import {
  validateParameters,
  hasValidationErrors,
  getFirstError,
} from '../components/graph/ParameterEditor/validation';
import { getParameterSchema } from '../components/graph/ParameterEditor/schemas';

export interface UseParameterEditorOptions {
  nodeType: string;
  initialValues?: Record<string, any>;
  onParametersChange?: (parameters: Record<string, any>) => void;
  maxHistorySize?: number;
}

export interface UseParameterEditorResult {
  // State
  values: Record<string, any>;
  errors: Record<string, string>;
  isDirty: boolean;
  isSaving: boolean;
  hasChanges: boolean;

  // History
  canUndo: boolean;
  canRedo: boolean;
  historySize: number;

  // Operations
  updateParameter: (name: string, value: any) => void;
  updateParameters: (values: Record<string, any>) => void;
  reset: () => void;
  randomize: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;

  // Validation
  validate: () => boolean;
  getValidationError: () => string | null;

  // Import/Export
  export: () => string;
  import: (json: string) => boolean;

  // Presets
  savePreset: (name: string, description?: string) => ParameterPreset;
  loadPreset: (preset: ParameterPreset) => void;
}

export function useParameterEditor({
  nodeType,
  initialValues = {},
  onParametersChange,
  maxHistorySize = 50,
}: UseParameterEditorOptions): UseParameterEditorResult {
  const schema = getParameterSchema(nodeType);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // History management
  const historyRef = useRef<Record<string, any>[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const originalValuesRef = useRef<Record<string, any>>({});

  // Initialize
  useEffect(() => {
    if (schema) {
      const defaults = getDefaultValues(schema.parameters);
      const initial = { ...defaults, ...initialValues };
      setValues(initial);
      originalValuesRef.current = cloneParameters(initial);
      historyRef.current = [cloneParameters(initial)];
      historyIndexRef.current = 0;
      setIsDirty(false);
    }
  }, [nodeType, schema]);

  const updateParameter = useCallback(
    (name: string, value: any) => {
      if (!schema) return;

      const newValues = { ...values, [name]: value };
      setValues(newValues);
      setIsDirty(!areParametersEqual(newValues, originalValuesRef.current));

      // Validate
      const newErrors = validateParameters(schema.parameters, newValues);
      setErrors(newErrors);

      // Add to history
      const currentHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      currentHistory.push(cloneParameters(newValues));
      if (currentHistory.length > maxHistorySize) {
        currentHistory.shift();
      }
      historyRef.current = currentHistory;
      historyIndexRef.current = currentHistory.length - 1;

      // Callback
      if (onParametersChange && !hasValidationErrors(newErrors)) {
        onParametersChange(newValues);
      }
    },
    [schema, values, onParametersChange, maxHistorySize]
  );

  const updateParameters = useCallback(
    (newValues: Record<string, any>) => {
      if (!schema) return;

      setValues(newValues);
      setIsDirty(!areParametersEqual(newValues, originalValuesRef.current));

      // Validate
      const newErrors = validateParameters(schema.parameters, newValues);
      setErrors(newErrors);

      // Add to history
      const currentHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      currentHistory.push(cloneParameters(newValues));
      if (currentHistory.length > maxHistorySize) {
        currentHistory.shift();
      }
      historyRef.current = currentHistory;
      historyIndexRef.current = currentHistory.length - 1;

      // Callback
      if (onParametersChange && !hasValidationErrors(newErrors)) {
        onParametersChange(newValues);
      }
    },
    [schema, onParametersChange, maxHistorySize]
  );

  const reset = useCallback(() => {
    if (!schema) return;

    const defaults = getDefaultValues(schema.parameters);
    updateParameters(defaults);
  }, [schema, updateParameters]);

  const randomize = useCallback(() => {
    if (!schema) return;

    const randomized = randomizeParameters(schema.parameters);
    updateParameters(randomized);
  }, [schema, updateParameters]);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const previous = historyRef.current[historyIndexRef.current];
      setValues(cloneParameters(previous));
      setIsDirty(!areParametersEqual(previous, originalValuesRef.current));

      // Validate
      if (schema) {
        const newErrors = validateParameters(schema.parameters, previous);
        setErrors(newErrors);
      }

      if (onParametersChange) {
        onParametersChange(previous);
      }
    }
  }, [schema, onParametersChange]);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const next = historyRef.current[historyIndexRef.current];
      setValues(cloneParameters(next));
      setIsDirty(!areParametersEqual(next, originalValuesRef.current));

      // Validate
      if (schema) {
        const newErrors = validateParameters(schema.parameters, next);
        setErrors(newErrors);
      }

      if (onParametersChange) {
        onParametersChange(next);
      }
    }
  }, [schema, onParametersChange]);

  const clearHistory = useCallback(() => {
    historyRef.current = [cloneParameters(values)];
    historyIndexRef.current = 0;
  }, [values]);

  const validate = useCallback((): boolean => {
    if (!schema) return true;

    const newErrors = validateParameters(schema.parameters, values);
    setErrors(newErrors);
    return !hasValidationErrors(newErrors);
  }, [schema, values]);

  const getValidationError = useCallback((): string | null => {
    return getFirstError(errors);
  }, [errors]);

  const exportJson = useCallback((): string => {
    const data = {
      nodeType,
      parameters: values,
      timestamp: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }, [nodeType, values]);

  const importJson = useCallback(
    (json: string): boolean => {
      try {
        const data = JSON.parse(json);

        if (data.nodeType !== nodeType) {
          console.error('Parameter type mismatch');
          return false;
        }

        updateParameters(data.parameters);
        return true;
      } catch (error) {
        console.error('Import failed:', error);
        return false;
      }
    },
    [nodeType, updateParameters]
  );

  const savePreset = useCallback(
    (name: string, description?: string): ParameterPreset => {
      const preset: ParameterPreset = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        description,
        nodeType,
        values: cloneParameters(values),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Persist to storage
      try {
        const key = `parameter-presets-${nodeType}`;
        const stored = localStorage.getItem(key) || '[]';
        const presets = JSON.parse(stored) as ParameterPreset[];
        presets.push(preset);
        localStorage.setItem(key, JSON.stringify(presets));
      } catch (error) {
        console.error('Failed to save preset:', error);
      }

      return preset;
    },
    [nodeType, values]
  );

  const loadPreset = useCallback(
    (preset: ParameterPreset) => {
      if (preset.nodeType === nodeType) {
        updateParameters(preset.values);
      }
    },
    [nodeType, updateParameters]
  );

  return {
    // State
    values,
    errors,
    isDirty,
    isSaving,
    hasChanges: isDirty,

    // History
    canUndo: historyIndexRef.current > 0,
    canRedo: historyIndexRef.current < historyRef.current.length - 1,
    historySize: historyRef.current.length,

    // Operations
    updateParameter,
    updateParameters,
    reset,
    randomize,
    undo,
    redo,
    clearHistory,

    // Validation
    validate,
    getValidationError,

    // Import/Export
    export: exportJson,
    import: importJson,

    // Presets
    savePreset,
    loadPreset,
  };
}

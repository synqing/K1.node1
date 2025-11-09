/**
 * Parameter Editor Type Definitions
 *
 * Defines parameter schema and metadata for dynamic form generation
 */

export type ParameterType = 'number' | 'color' | 'select' | 'boolean' | 'array' | 'object' | 'string';

export interface NumberParameterConfig {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  defaultValue?: number;
}

export interface ColorParameterConfig {
  type: 'color';
  format?: 'rgb' | 'hex' | 'hsv';
  defaultValue?: string | { r: number; g: number; b: number };
}

export interface SelectParameterConfig {
  type: 'select';
  options: { label: string; value: any }[];
  defaultValue?: any;
}

export interface BooleanParameterConfig {
  type: 'boolean';
  defaultValue?: boolean;
}

export interface ArrayParameterConfig {
  type: 'array';
  itemType: ParameterType;
  minLength?: number;
  maxLength?: number;
  defaultValue?: any[];
}

export interface ObjectParameterConfig {
  type: 'object';
  properties: Record<string, ParameterConfig>;
  defaultValue?: Record<string, any>;
}

export interface StringParameterConfig {
  type: 'string';
  defaultValue?: string;
  pattern?: string;
  maxLength?: number;
}

export type ParameterConfig =
  | NumberParameterConfig
  | ColorParameterConfig
  | SelectParameterConfig
  | BooleanParameterConfig
  | ArrayParameterConfig
  | ObjectParameterConfig
  | StringParameterConfig;

export interface ParameterDefinition {
  name: string;
  label: string;
  description?: string;
  config: ParameterConfig;
  required?: boolean;
  hidden?: boolean;
}

export interface ParameterSchema {
  nodeType: string;
  version: string;
  parameters: ParameterDefinition[];
}

export interface ParameterValidationError {
  field: string;
  message: string;
}

export interface ParameterEditorState {
  values: Record<string, any>;
  errors: Record<string, string>;
  isDirty: boolean;
  isSaving: boolean;
}

export interface ParameterPreset {
  id: string;
  name: string;
  description?: string;
  nodeType: string;
  values: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
}

export interface ParameterEditorConfig {
  showPresets?: boolean;
  showRandomize?: boolean;
  showReset?: boolean;
  showExport?: boolean;
  livePreview?: boolean;
  validationMode?: 'strict' | 'relaxed';
}

/**
 * Parameter Editor Component Export
 *
 * Main export for all parameter editor functionality
 */

export { ParameterEditor } from './ParameterEditor';
export { PresetManager } from './PresetManager';

// Controls
export { NumberControl } from './Controls/NumberControl';
export { ColorControl } from './Controls/ColorControl';
export { SelectControl } from './Controls/SelectControl';
export { BooleanControl } from './Controls/BooleanControl';
export { ArrayControl } from './Controls/ArrayControl';

// Types
export type {
  ParameterType,
  ParameterConfig,
  ParameterDefinition,
  ParameterSchema,
  ParameterValidationError,
  ParameterEditorState,
  ParameterPreset,
  ParameterEditorConfig,
  NumberParameterConfig,
  ColorParameterConfig,
  SelectParameterConfig,
  BooleanParameterConfig,
  ArrayParameterConfig,
  ObjectParameterConfig,
  StringParameterConfig,
} from './types';

// Schemas
export { parameterSchemas, getParameterSchema, getAllSchemas, hasParameters } from './schemas';

// Validation
export {
  validateParameter,
  validateParameters,
  hasValidationErrors,
  getFirstError,
} from './validation';

// Utilities
export {
  getDefaultValues,
  resetToDefaults,
  randomizeParameters,
  cloneParameters,
  areParametersEqual,
  getChangedFields,
  mergeParameters,
} from './utils';

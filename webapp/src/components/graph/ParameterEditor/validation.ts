/**
 * Parameter Validation Utilities
 *
 * Validates parameter values against their schemas
 */

import { ParameterConfig, ParameterValidationError, ParameterDefinition } from './types';

/**
 * Validate a single parameter value
 */
export function validateParameter(
  definition: ParameterDefinition,
  value: any
): ParameterValidationError | null {
  const { name, config, required } = definition;

  // Check required
  if (required && (value === null || value === undefined || value === '')) {
    return {
      field: name,
      message: `${definition.label} is required`,
    };
  }

  if (value === null || value === undefined) {
    return null;
  }

  // Type-specific validation
  switch (config.type) {
    case 'number': {
      if (typeof value !== 'number') {
        return { field: name, message: 'Must be a number' };
      }
      const min = (config as any).min;
      const max = (config as any).max;
      if (min !== undefined && value < min) {
        return { field: name, message: `Must be >= ${min}` };
      }
      if (max !== undefined && value > max) {
        return { field: name, message: `Must be <= ${max}` };
      }
      return null;
    }

    case 'color': {
      if (typeof value !== 'string') {
        return { field: name, message: 'Must be a color string' };
      }
      const hexMatch = /^#[0-9A-F]{6}$/i.test(value);
      if (!hexMatch) {
        return { field: name, message: 'Must be a valid hex color (#RRGGBB)' };
      }
      return null;
    }

    case 'select': {
      const options = (config as any).options || [];
      const validValues = options.map((opt: any) => opt.value);
      if (!validValues.includes(value)) {
        return {
          field: name,
          message: 'Must be one of: ' + validValues.join(', '),
        };
      }
      return null;
    }

    case 'boolean': {
      if (typeof value !== 'boolean') {
        return { field: name, message: 'Must be true or false' };
      }
      return null;
    }

    case 'array': {
      if (!Array.isArray(value)) {
        return { field: name, message: 'Must be an array' };
      }
      const minLen = (config as any).minLength;
      const maxLen = (config as any).maxLength;
      if (minLen !== undefined && value.length < minLen) {
        return {
          field: name,
          message: `Must have at least ${minLen} items`,
        };
      }
      if (maxLen !== undefined && value.length > maxLen) {
        return {
          field: name,
          message: `Must have at most ${maxLen} items`,
        };
      }
      return null;
    }

    case 'string': {
      if (typeof value !== 'string') {
        return { field: name, message: 'Must be a string' };
      }
      const pattern = (config as any).pattern;
      const maxLen = (config as any).maxLength;
      if (pattern && !new RegExp(pattern).test(value)) {
        return { field: name, message: 'Invalid format' };
      }
      if (maxLen && value.length > maxLen) {
        return {
          field: name,
          message: `Must be at most ${maxLen} characters`,
        };
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Validate all parameters at once
 */
export function validateParameters(
  definitions: ParameterDefinition[],
  values: Record<string, any>
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const def of definitions) {
    const error = validateParameter(def, values[def.name]);
    if (error) {
      errors[def.name] = error.message;
    }
  }

  return errors;
}

/**
 * Check if there are any validation errors
 */
export function hasValidationErrors(errors: Record<string, string>): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Get the first validation error
 */
export function getFirstError(errors: Record<string, string>): string | null {
  for (const message of Object.values(errors)) {
    if (message) return message;
  }
  return null;
}

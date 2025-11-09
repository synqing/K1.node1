/**
 * Parameter Editor Utilities
 *
 * Helpers for parameter manipulation, randomization, defaults, etc.
 */

import { ParameterDefinition, ParameterConfig } from './types';

/**
 * Generate default values for parameters
 */
export function getDefaultValues(definitions: ParameterDefinition[]): Record<string, any> {
  const defaults: Record<string, any> = {};

  for (const def of definitions) {
    if (def.hidden) continue;

    const config = def.config;
    const defaultValue = (config as any).defaultValue;

    if (defaultValue !== undefined) {
      defaults[def.name] = defaultValue;
    } else {
      // Generate sensible defaults
      switch (config.type) {
        case 'number':
          defaults[def.name] = (config as any).min ?? 0;
          break;
        case 'color':
          defaults[def.name] = '#FF0000';
          break;
        case 'select':
          const options = (config as any).options || [];
          defaults[def.name] = options.length > 0 ? options[0].value : null;
          break;
        case 'boolean':
          defaults[def.name] = false;
          break;
        case 'array':
          defaults[def.name] = [];
          break;
        case 'string':
          defaults[def.name] = '';
          break;
        default:
          defaults[def.name] = null;
      }
    }
  }

  return defaults;
}

/**
 * Reset parameters to their default values
 */
export function resetToDefaults(definitions: ParameterDefinition[]): Record<string, any> {
  return getDefaultValues(definitions);
}

/**
 * Generate random valid values for parameters
 */
export function randomizeParameters(
  definitions: ParameterDefinition[]
): Record<string, any> {
  const randomized: Record<string, any> = {};

  for (const def of definitions) {
    if (def.hidden) continue;

    const config = def.config;
    randomized[def.name] = generateRandomValue(config);
  }

  return randomized;
}

/**
 * Generate a single random value for a parameter type
 */
function generateRandomValue(config: ParameterConfig): any {
  switch (config.type) {
    case 'number': {
      const min = (config as any).min ?? 0;
      const max = (config as any).max ?? 100;
      const step = (config as any).step ?? 1;
      const range = max - min;
      const steps = Math.floor(range / step);
      return min + Math.floor(Math.random() * steps) * step;
    }

    case 'color': {
      const r = Math.floor(Math.random() * 256);
      const g = Math.floor(Math.random() * 256);
      const b = Math.floor(Math.random() * 256);
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

    case 'select': {
      const options = (config as any).options || [];
      if (options.length === 0) return null;
      return options[Math.floor(Math.random() * options.length)].value;
    }

    case 'boolean': {
      return Math.random() > 0.5;
    }

    case 'array': {
      const minLen = (config as any).minLength ?? 0;
      const maxLen = (config as any).maxLength ?? 3;
      const length = minLen + Math.floor(Math.random() * (maxLen - minLen + 1));
      const array: any[] = [];
      for (let i = 0; i < length; i++) {
        array.push(generateRandomValue({ type: (config as any).itemType } as ParameterConfig));
      }
      return array;
    }

    case 'string': {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      const length = Math.floor(Math.random() * 10) + 5;
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    }

    case 'object':
    default:
      return null;
  }
}

/**
 * Deep clone parameter values
 */
export function cloneParameters(values: Record<string, any>): Record<string, any> {
  const cloned: Record<string, any> = {};

  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      cloned[key] = [...value];
    } else if (value !== null && typeof value === 'object') {
      cloned[key] = { ...value };
    } else {
      cloned[key] = value;
    }
  }

  return cloned;
}

/**
 * Check if two parameter sets are equal
 */
export function areParametersEqual(
  a: Record<string, any>,
  b: Record<string, any>
): boolean {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();

  if (keysA.length !== keysB.length) return false;
  if (!keysA.every((key, i) => key === keysB[i])) return false;

  for (const key of keysA) {
    if (Array.isArray(a[key]) && Array.isArray(b[key])) {
      if (a[key].length !== b[key].length) return false;
      if (!a[key].every((val: any, i: number) => val === b[key][i])) return false;
    } else if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Get changed fields between two parameter sets
 */
export function getChangedFields(
  original: Record<string, any>,
  current: Record<string, any>
): string[] {
  const changed: string[] = [];

  for (const key of Object.keys(current)) {
    if (!areParametersEqual({ [key]: original[key] }, { [key]: current[key] })) {
      changed.push(key);
    }
  }

  return changed;
}

/**
 * Merge parameter sets (current overwrites base)
 */
export function mergeParameters(
  base: Record<string, any>,
  current: Record<string, any>
): Record<string, any> {
  return { ...base, ...current };
}

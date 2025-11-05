/**
 * Real-time Parameter Controls - Types and Utilities
 * 
 * Task 5.1: Define Params schema/types and defaults (0–100%) for six controls
 * - Typed Params interface for brightness, speed, saturation, warmth, softness, background
 * - DEFAULT_PARAMS with 0–100 values and safe defaults
 * - Clamp helpers and formatting utilities for numeric readouts
 * - mergeParams for coalescing partials with validation
 */

// Parameter interface for UI (0-100 range)
export interface UIParams {
  brightness: number;    // 0-100%
  speed: number;         // 0-100%
  saturation: number;    // 0-100%
  warmth: number;        // 0-100%
  softness: number;      // 0-100%
  background: number;    // 0-100%
}

// Parameter metadata for UI rendering
export interface ParamMetadata {
  key: keyof UIParams;
  label: string;
  description: string;
  icon: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  defaultValue: number;
}

// Default parameter values (0-100 range)
export const DEFAULT_PARAMS: UIParams = {
  brightness: 75,    // 75% - bright but not overwhelming
  speed: 50,         // 50% - moderate animation speed
  saturation: 80,    // 80% - vibrant colors
  warmth: 50,        // 50% - neutral color temperature
  softness: 30,      // 30% - slight softening
  background: 0      // 0% - no background illumination (clean visual separation)
};

// Parameter metadata for UI rendering
export const PARAM_METADATA: Record<keyof UIParams, ParamMetadata> = {
  brightness: {
    key: 'brightness',
    label: 'Brightness',
    description: 'Overall LED brightness level',
    icon: '💡',
    min: 0,
    max: 100,
    step: 1,
    unit: '%',
    defaultValue: DEFAULT_PARAMS.brightness
  },
  speed: {
    key: 'speed',
    label: 'Speed',
    description: 'Animation and transition speed',
    icon: '⚡',
    min: 0,
    max: 100,
    step: 1,
    unit: '%',
    defaultValue: DEFAULT_PARAMS.speed
  },
  saturation: {
    key: 'saturation',
    label: 'Saturation',
    description: 'Color intensity and vibrancy',
    icon: '🎨',
    min: 0,
    max: 100,
    step: 1,
    unit: '%',
    defaultValue: DEFAULT_PARAMS.saturation
  },
  warmth: {
    key: 'warmth',
    label: 'Warmth',
    description: 'Color temperature (cool to warm)',
    icon: '🌡️',
    min: 0,
    max: 100,
    step: 1,
    unit: '%',
    defaultValue: DEFAULT_PARAMS.warmth
  },
  softness: {
    key: 'softness',
    label: 'Softness',
    description: 'Edge softening and blur amount',
    icon: '🌫️',
    min: 0,
    max: 100,
    step: 1,
    unit: '%',
    defaultValue: DEFAULT_PARAMS.softness
  },
  background: {
    key: 'background',
    label: 'Background',
    description: 'Background illumination level',
    icon: '🌌',
    min: 0,
    max: 100,
    step: 1,
    unit: '%',
    defaultValue: DEFAULT_PARAMS.background
  }
};

// Get ordered parameter keys for consistent UI rendering
export const PARAM_ORDER: (keyof UIParams)[] = [
  'brightness',
  'speed', 
  'saturation',
  'warmth',
  'softness',
  'background'
];

/**
 * Clamp a value to the valid 0-100 range
 */
export function clampParam(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Clamp all parameters in a params object
 */
export function clampParams(params: Partial<UIParams>): Partial<UIParams> {
  const clamped: Partial<UIParams> = {};
  
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'number' && key in DEFAULT_PARAMS) {
      clamped[key as keyof UIParams] = clampParam(value);
    }
  }
  
  return clamped;
}

/**
 * Merge current parameters with pending updates
 * Ensures all values are clamped and valid
 */
export function mergeParams(current: UIParams, pending: Partial<UIParams>): UIParams {
  const merged = { ...current };
  
  for (const [key, value] of Object.entries(pending)) {
    if (typeof value === 'number' && key in DEFAULT_PARAMS) {
      merged[key as keyof UIParams] = clampParam(value);
    }
  }
  
  return merged;
}

/**
 * Convert UI params (0-100) to firmware params (0.0-1.0)
 */
export function uiToFirmwareParams(uiParams: Partial<UIParams>): Record<string, number> {
  const firmwareParams: Record<string, number> = {};
  
  for (const [key, value] of Object.entries(uiParams)) {
    if (typeof value === 'number' && key in DEFAULT_PARAMS) {
      firmwareParams[key] = clampParam(value) / 100;
    }
  }
  
  return firmwareParams;
}

/**
 * Convert firmware params (0.0-1.0) to UI params (0-100)
 */
export function firmwareToUIParams(firmwareParams: Record<string, number>): Partial<UIParams> {
  const uiParams: Partial<UIParams> = {};
  
  for (const [key, value] of Object.entries(firmwareParams)) {
    if (typeof value === 'number' && key in DEFAULT_PARAMS) {
      uiParams[key as keyof UIParams] = clampParam(value * 100);
    }
  }
  
  return uiParams;
}

/**
 * Format parameter value for display
 */
export function formatParamValue(value: number, metadata: ParamMetadata): string {
  const clamped = clampParam(value);
  return `${clamped}${metadata.unit}`;
}

/**
 * Get parameter metadata by key
 */
export function getParamMetadata(key: keyof UIParams): ParamMetadata {
  return PARAM_METADATA[key];
}

/**
 * Validate that a params object contains only valid parameters
 */
export function validateParams(params: any): params is Partial<UIParams> {
  if (!params || typeof params !== 'object') {
    return false;
  }
  
  for (const [key, value] of Object.entries(params)) {
    if (!(key in DEFAULT_PARAMS)) {
      return false;
    }
    if (typeof value !== 'number' || isNaN(value)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Create a safe params object with defaults for missing values
 */
export function createSafeParams(input?: Partial<UIParams>): UIParams {
  if (!input || !validateParams(input)) {
    return { ...DEFAULT_PARAMS };
  }
  
  return mergeParams(DEFAULT_PARAMS, input);
}

/**
 * Calculate the difference between two param sets
 * Returns only the changed parameters
 */
export function getParamDiff(current: UIParams, updated: UIParams): Partial<UIParams> {
  const diff: Partial<UIParams> = {};
  
  for (const key of PARAM_ORDER) {
    if (current[key] !== updated[key]) {
      diff[key] = updated[key];
    }
  }
  
  return diff;
}

/**
 * Check if two param sets are equal
 */
export function areParamsEqual(a: UIParams, b: UIParams): boolean {
  return PARAM_ORDER.every(key => a[key] === b[key]);
}

/**
 * Get parameter statistics for debugging
 */
export function getParamStats(params: UIParams) {
  const values = PARAM_ORDER.map(key => params[key]);
  
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((sum, val) => sum + val, 0) / values.length,
    total: values.reduce((sum, val) => sum + val, 0),
    nonZero: values.filter(val => val > 0).length,
    atDefault: PARAM_ORDER.filter(key => params[key] === DEFAULT_PARAMS[key]).length
  };
}
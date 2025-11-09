/**
 * Parameter Editor Tests
 *
 * Test suite for parameter editor functionality
 */

import {
  validateParameter,
  validateParameters,
  hasValidationErrors,
} from '../validation';
import {
  getDefaultValues,
  randomizeParameters,
  cloneParameters,
  areParametersEqual,
} from '../utils';
import { getParameterSchema } from '../schemas';
import { ParameterDefinition } from '../types';

describe('Parameter Validation', () => {
  it('should validate number parameters within range', () => {
    const def: ParameterDefinition = {
      name: 'frequency',
      label: 'Frequency',
      config: { type: 'number', min: 0, max: 10, step: 0.1, defaultValue: 1 },
    };

    expect(validateParameter(def, 5)).toBeNull();
    expect(validateParameter(def, -1)?.message).toContain('>=');
    expect(validateParameter(def, 11)?.message).toContain('<=');
  });

  it('should validate color parameters', () => {
    const def: ParameterDefinition = {
      name: 'color',
      label: 'Color',
      config: { type: 'color', format: 'hex', defaultValue: '#FF0000' },
    };

    expect(validateParameter(def, '#FF0000')).toBeNull();
    expect(validateParameter(def, '#GGGGGG')?.message).toBeTruthy();
    expect(validateParameter(def, 'red')?.message).toBeTruthy();
  });

  it('should validate select parameters', () => {
    const def: ParameterDefinition = {
      name: 'easing',
      label: 'Easing',
      config: {
        type: 'select',
        options: [
          { label: 'Linear', value: 'linear' },
          { label: 'Ease In', value: 'easeIn' },
        ],
        defaultValue: 'linear',
      },
    };

    expect(validateParameter(def, 'linear')).toBeNull();
    expect(validateParameter(def, 'invalid')?.message).toBeTruthy();
  });

  it('should validate boolean parameters', () => {
    const def: ParameterDefinition = {
      name: 'loop',
      label: 'Loop',
      config: { type: 'boolean', defaultValue: true },
    };

    expect(validateParameter(def, true)).toBeNull();
    expect(validateParameter(def, false)).toBeNull();
    expect(validateParameter(def, 'true')?.message).toBeTruthy();
  });

  it('should validate array parameters', () => {
    const def: ParameterDefinition = {
      name: 'values',
      label: 'Values',
      config: {
        type: 'array',
        itemType: 'number',
        minLength: 1,
        maxLength: 5,
        defaultValue: [],
      },
    };

    expect(validateParameter(def, [1, 2, 3])).toBeNull();
    expect(validateParameter(def, [])?.message).toContain('at least 1');
    expect(validateParameter(def, [1, 2, 3, 4, 5, 6])?.message).toContain('at most 5');
  });

  it('should check for validation errors in multiple parameters', () => {
    const definitions: ParameterDefinition[] = [
      {
        name: 'freq',
        label: 'Frequency',
        config: { type: 'number', min: 0, max: 10 },
      },
      {
        name: 'color',
        label: 'Color',
        config: { type: 'color' },
      },
    ];

    const errors = validateParameters(definitions, { freq: 5, color: '#FF0000' });
    expect(hasValidationErrors(errors)).toBe(false);

    const errorsCases = validateParameters(definitions, { freq: 15, color: 'invalid' });
    expect(hasValidationErrors(errorsCases)).toBe(true);
  });
});

describe('Parameter Utilities', () => {
  it('should generate default values', () => {
    const schema = getParameterSchema('sine_wave');
    if (schema) {
      const defaults = getDefaultValues(schema.parameters);
      expect(defaults['frequency']).toBeDefined();
      expect(defaults['amplitude']).toBeDefined();
      expect(defaults['phase']).toBeDefined();
    }
  });

  it('should randomize parameters', () => {
    const schema = getParameterSchema('sine_wave');
    if (schema) {
      const random1 = randomizeParameters(schema.parameters);
      const random2 = randomizeParameters(schema.parameters);

      expect(random1['frequency']).toBeDefined();
      expect(random1['amplitude']).toBeGreaterThanOrEqual(0);
      expect(random1['amplitude']).toBeLessThanOrEqual(1);
      // Probability of getting exact same random values is extremely low
      expect(random1['frequency']).not.toEqual(random2['frequency']);
    }
  });

  it('should clone parameters deeply', () => {
    const original = {
      num: 5,
      array: [1, 2, 3],
      nested: { a: 1 },
    };

    const cloned = cloneParameters(original);
    cloned.array.push(4);
    cloned.nested.a = 2;

    expect(original.array).toEqual([1, 2, 3]);
    expect(original.nested.a).toBe(1);
    expect(cloned.array).toEqual([1, 2, 3, 4]);
    expect(cloned.nested.a).toBe(2);
  });

  it('should compare parameter sets', () => {
    const params1 = { a: 1, b: [1, 2], c: '#FF0000' };
    const params2 = { a: 1, b: [1, 2], c: '#FF0000' };
    const params3 = { a: 1, b: [1, 2], c: '#00FF00' };

    expect(areParametersEqual(params1, params2)).toBe(true);
    expect(areParametersEqual(params1, params3)).toBe(false);
  });
});

describe('Parameter Schemas', () => {
  it('should load gradient schema', () => {
    const schema = getParameterSchema('gradient');
    expect(schema).toBeDefined();
    expect(schema?.parameters.length).toBeGreaterThan(0);
    expect(schema?.parameters.some((p) => p.name === 'color1')).toBe(true);
  });

  it('should load audio_reactive schema', () => {
    const schema = getParameterSchema('audio_reactive');
    expect(schema).toBeDefined();
    const bandParam = schema?.parameters.find((p) => p.name === 'band');
    expect(bandParam?.config.type).toBe('select');
  });

  it('should return undefined for unknown schema', () => {
    const schema = getParameterSchema('unknown_node_type');
    expect(schema).toBeUndefined();
  });
});

describe('Parameter Editor Integration', () => {
  it('should track changes between original and current values', () => {
    const defaults = { freq: 1, amp: 0.5 };
    const current = { freq: 2, amp: 0.5 };

    expect(areParametersEqual(defaults, current)).toBe(false);
  });

  it('should export and import JSON', () => {
    const params = { frequency: 5, amplitude: 0.7, phase: 1.57 };
    const data = {
      nodeType: 'sine_wave',
      parameters: params,
      timestamp: new Date().toISOString(),
    };

    const json = JSON.stringify(data);
    const parsed = JSON.parse(json);

    expect(parsed.nodeType).toBe('sine_wave');
    expect(parsed.parameters.frequency).toBe(5);
  });

  it('should handle empty parameter sets', () => {
    const empty = {};
    const cloned = cloneParameters(empty);

    expect(Object.keys(cloned).length).toBe(0);
    expect(areParametersEqual(empty, cloned)).toBe(true);
  });
});

describe('Control Type Validation', () => {
  it('should validate range constraints on numbers', () => {
    const def: ParameterDefinition = {
      name: 'rate',
      label: 'Rate',
      config: { type: 'number', min: 0.5, max: 20, step: 0.5 },
    };

    expect(validateParameter(def, 0.5)).toBeNull();
    expect(validateParameter(def, 20)).toBeNull();
    expect(validateParameter(def, 0.4)?.message).toBeTruthy();
    expect(validateParameter(def, 20.1)?.message).toBeTruthy();
  });

  it('should require fields when marked required', () => {
    const def: ParameterDefinition = {
      name: 'required_field',
      label: 'Required Field',
      config: { type: 'string' },
      required: true,
    };

    expect(validateParameter(def, 'value')).toBeNull();
    expect(validateParameter(def, '')?.message).toContain('required');
    expect(validateParameter(def, null)?.message).toContain('required');
  });

  it('should validate string patterns', () => {
    const def: ParameterDefinition = {
      name: 'email',
      label: 'Email',
      config: {
        type: 'string',
        pattern: '^[^@]+@[^@]+\\.[^@]+$',
      },
    };

    expect(validateParameter(def, 'user@example.com')).toBeNull();
    expect(validateParameter(def, 'invalid-email')?.message).toBeTruthy();
  });
});

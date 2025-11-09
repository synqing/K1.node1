/**
 * Parameter Schema Registry
 *
 * Defines parameter schemas for different node types
 */

import { ParameterSchema } from './types';

export const parameterSchemas: Record<string, ParameterSchema> = {
  // Color nodes
  gradient: {
    nodeType: 'gradient',
    version: '1.0.0',
    parameters: [
      {
        name: 'color1',
        label: 'Start Color',
        description: 'Starting color of the gradient',
        config: {
          type: 'color',
          format: 'hex',
          defaultValue: '#FF0000',
        },
        required: true,
      },
      {
        name: 'color2',
        label: 'End Color',
        description: 'Ending color of the gradient',
        config: {
          type: 'color',
          format: 'hex',
          defaultValue: '#0000FF',
        },
        required: true,
      },
      {
        name: 'smoothness',
        label: 'Smoothness',
        description: 'Gradient smoothness factor',
        config: {
          type: 'number',
          min: 0,
          max: 1,
          step: 0.01,
          defaultValue: 0.5,
        },
      },
    ],
  },

  // Math nodes
  sine_wave: {
    nodeType: 'sine_wave',
    version: '1.0.0',
    parameters: [
      {
        name: 'frequency',
        label: 'Frequency',
        description: 'Wave frequency in Hz',
        config: {
          type: 'number',
          min: 0.1,
          max: 10,
          step: 0.1,
          unit: 'Hz',
          defaultValue: 1,
        },
      },
      {
        name: 'amplitude',
        label: 'Amplitude',
        description: 'Wave amplitude (0-1)',
        config: {
          type: 'number',
          min: 0,
          max: 1,
          step: 0.01,
          defaultValue: 1,
        },
      },
      {
        name: 'phase',
        label: 'Phase',
        description: 'Phase offset in radians',
        config: {
          type: 'number',
          min: 0,
          max: Math.PI * 2,
          step: 0.1,
          unit: 'rad',
          defaultValue: 0,
        },
      },
    ],
  },

  // Effect nodes
  pulse: {
    nodeType: 'pulse',
    version: '1.0.0',
    parameters: [
      {
        name: 'rate',
        label: 'Pulse Rate',
        description: 'Pulsing frequency',
        config: {
          type: 'number',
          min: 0.5,
          max: 20,
          step: 0.5,
          unit: 'Hz',
          defaultValue: 2,
        },
      },
      {
        name: 'width',
        label: 'Pulse Width',
        description: 'Width of each pulse (0-1)',
        config: {
          type: 'number',
          min: 0,
          max: 1,
          step: 0.05,
          defaultValue: 0.5,
        },
      },
      {
        name: 'easing',
        label: 'Easing',
        description: 'Easing function for pulse',
        config: {
          type: 'select',
          options: [
            { label: 'Linear', value: 'linear' },
            { label: 'Ease In', value: 'easeIn' },
            { label: 'Ease Out', value: 'easeOut' },
            { label: 'Ease In-Out', value: 'easeInOut' },
          ],
          defaultValue: 'linear',
        },
      },
    ],
  },

  // Audio reactive nodes
  audio_reactive: {
    nodeType: 'audio_reactive',
    version: '1.0.0',
    parameters: [
      {
        name: 'band',
        label: 'Frequency Band',
        description: 'Which frequency band to react to',
        config: {
          type: 'select',
          options: [
            { label: 'Bass (0-250Hz)', value: 'bass' },
            { label: 'Mid (250-2kHz)', value: 'mid' },
            { label: 'Treble (2kHz+)', value: 'treble' },
            { label: 'All', value: 'all' },
          ],
          defaultValue: 'all',
        },
      },
      {
        name: 'sensitivity',
        label: 'Sensitivity',
        description: 'How sensitive to audio input',
        config: {
          type: 'number',
          min: 0.1,
          max: 2,
          step: 0.1,
          defaultValue: 1,
        },
      },
      {
        name: 'smoothing',
        label: 'Smoothing',
        description: 'Audio response smoothing',
        config: {
          type: 'number',
          min: 0,
          max: 1,
          step: 0.05,
          defaultValue: 0.3,
        },
      },
      {
        name: 'decay',
        label: 'Decay Time',
        description: 'How quickly response decays',
        config: {
          type: 'number',
          min: 0,
          max: 1,
          step: 0.05,
          unit: 's',
          defaultValue: 0.5,
        },
      },
    ],
  },

  // Noise node
  perlin_noise: {
    nodeType: 'perlin_noise',
    version: '1.0.0',
    parameters: [
      {
        name: 'scale',
        label: 'Scale',
        description: 'Noise scale factor',
        config: {
          type: 'number',
          min: 0.1,
          max: 10,
          step: 0.1,
          defaultValue: 1,
        },
      },
      {
        name: 'octaves',
        label: 'Octaves',
        description: 'Number of noise octaves',
        config: {
          type: 'select',
          options: [
            { label: '1', value: 1 },
            { label: '2', value: 2 },
            { label: '3', value: 3 },
            { label: '4', value: 4 },
          ],
          defaultValue: 2,
        },
      },
      {
        name: 'persistence',
        label: 'Persistence',
        description: 'Amplitude reduction per octave',
        config: {
          type: 'number',
          min: 0,
          max: 1,
          step: 0.1,
          defaultValue: 0.5,
        },
      },
    ],
  },

  // Animation nodes
  keyframe_animation: {
    nodeType: 'keyframe_animation',
    version: '1.0.0',
    parameters: [
      {
        name: 'duration',
        label: 'Duration',
        description: 'Animation duration in seconds',
        config: {
          type: 'number',
          min: 0.1,
          max: 60,
          step: 0.1,
          unit: 's',
          defaultValue: 2,
        },
      },
      {
        name: 'loop',
        label: 'Loop',
        description: 'Loop animation',
        config: {
          type: 'boolean',
          defaultValue: true,
        },
      },
      {
        name: 'reverse',
        label: 'Reverse on Loop',
        description: 'Reverse animation on each loop',
        config: {
          type: 'boolean',
          defaultValue: false,
        },
      },
    ],
  },
};

/**
 * Get parameter schema for a node type
 */
export function getParameterSchema(nodeType: string): ParameterSchema | undefined {
  return parameterSchemas[nodeType];
}

/**
 * Get all available schemas
 */
export function getAllSchemas(): ParameterSchema[] {
  return Object.values(parameterSchemas);
}

/**
 * Check if a node type has parameters
 */
export function hasParameters(nodeType: string): boolean {
  return nodeType in parameterSchemas;
}

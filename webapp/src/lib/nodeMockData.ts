// Node Editor Mock Data

import { Node } from './types';

// Node Editor Node Templates
export const NODE_TEMPLATES: Omit<Node, 'id' | 'position'>[] = [
  // Input Nodes
  {
    type: 'AudioInput',
    category: 'input',
    name: 'Audio Input',
    inputs: [],
    outputs: [
      { id: 'amplitude', name: 'Amplitude', type: 'scalar', connected: false },
      { id: 'frequency', name: 'Frequency', type: 'field', connected: false },
    ],
    computeCost: 'low',
  },
  {
    type: 'TimeInput',
    category: 'input',
    name: 'Time',
    inputs: [],
    outputs: [
      { id: 'time', name: 'Time', type: 'scalar', connected: false },
      { id: 'deltaTime', name: 'Delta', type: 'scalar', connected: false },
    ],
    computeCost: 'low',
  },
  {
    type: 'ConstantScalar',
    category: 'input',
    name: 'Constant',
    inputs: [],
    outputs: [
      { id: 'value', name: 'Value', type: 'scalar', connected: false },
    ],
    computeCost: 'low',
    parameters: [
      { name: 'value', type: 'number', value: 1.0, min: 0, max: 10, step: 0.1 },
    ],
  },
  
  // Effect Nodes
  {
    type: 'SpectrumAnalyzer',
    category: 'effect',
    name: 'Spectrum Analyzer',
    inputs: [
      { id: 'audio', name: 'Audio', type: 'scalar', connected: false },
    ],
    outputs: [
      { id: 'spectrum', name: 'Spectrum', type: 'field', connected: false },
    ],
    computeCost: 'high',
    parameters: [
      { name: 'bins', type: 'number', value: 32, min: 8, max: 128, step: 1 },
      { name: 'smoothing', type: 'number', value: 0.3, min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    type: 'BeatDetector',
    category: 'effect',
    name: 'Beat Detector',
    inputs: [
      { id: 'audio', name: 'Audio', type: 'scalar', connected: false },
    ],
    outputs: [
      { id: 'beat', name: 'Beat', type: 'scalar', connected: false },
      { id: 'bpm', name: 'BPM', type: 'scalar', connected: false },
    ],
    computeCost: 'medium',
    parameters: [
      { name: 'threshold', type: 'number', value: 0.8, min: 0, max: 1, step: 0.05 },
      { name: 'cooldown', type: 'number', value: 100, min: 10, max: 1000, step: 10 },
    ],
  },
  {
    type: 'WaveGenerator',
    category: 'effect',
    name: 'Wave Generator',
    inputs: [
      { id: 'frequency', name: 'Frequency', type: 'scalar', connected: false },
      { id: 'phase', name: 'Phase', type: 'scalar', connected: false },
    ],
    outputs: [
      { id: 'wave', name: 'Wave', type: 'field', connected: false },
    ],
    computeCost: 'medium',
    parameters: [
      { name: 'waveType', type: 'number', value: 0, min: 0, max: 2, step: 1 }, // 0: sine, 1: square, 2: saw
      { name: 'amplitude', type: 'number', value: 1.0, min: 0, max: 1, step: 0.05 },
    ],
  },
  
  // Math Nodes
  {
    type: 'Add',
    category: 'math',
    name: 'Add',
    inputs: [
      { id: 'a', name: 'A', type: 'scalar', connected: false },
      { id: 'b', name: 'B', type: 'scalar', connected: false },
    ],
    outputs: [
      { id: 'result', name: 'Result', type: 'scalar', connected: false },
    ],
    computeCost: 'low',
  },
  {
    type: 'Multiply',
    category: 'math',
    name: 'Multiply',
    inputs: [
      { id: 'a', name: 'A', type: 'scalar', connected: false },
      { id: 'b', name: 'B', type: 'scalar', connected: false },
    ],
    outputs: [
      { id: 'result', name: 'Result', type: 'scalar', connected: false },
    ],
    computeCost: 'low',
  },
  {
    type: 'Clamp',
    category: 'math',
    name: 'Clamp',
    inputs: [
      { id: 'value', name: 'Value', type: 'scalar', connected: false },
      { id: 'min', name: 'Min', type: 'scalar', connected: false },
      { id: 'max', name: 'Max', type: 'scalar', connected: false },
    ],
    outputs: [
      { id: 'result', name: 'Result', type: 'scalar', connected: false },
    ],
    computeCost: 'low',
    parameters: [
      { name: 'min', type: 'number', value: 0, min: 0, max: 1, step: 0.05 },
      { name: 'max', type: 'number', value: 1, min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    type: 'Smoothing',
    category: 'math',
    name: 'Smooth',
    inputs: [
      { id: 'value', name: 'Value', type: 'scalar', connected: false },
    ],
    outputs: [
      { id: 'result', name: 'Result', type: 'scalar', connected: false },
    ],
    computeCost: 'low',
    parameters: [
      { name: 'amount', type: 'number', value: 0.5, min: 0, max: 1, step: 0.05 },
    ],
  },
  
  // Color Nodes
  {
    type: 'HSVColor',
    category: 'color',
    name: 'HSV Color',
    inputs: [
      { id: 'hue', name: 'Hue', type: 'scalar', connected: false },
      { id: 'saturation', name: 'Saturation', type: 'scalar', connected: false },
      { id: 'value', name: 'Value', type: 'scalar', connected: false },
    ],
    outputs: [
      { id: 'color', name: 'Color', type: 'color', connected: false },
    ],
    computeCost: 'low',
    parameters: [
      { name: 'h', type: 'number', value: 180, min: 0, max: 360, step: 1 },
      { name: 's', type: 'number', value: 80, min: 0, max: 100, step: 1 },
      { name: 'v', type: 'number', value: 100, min: 0, max: 100, step: 1 },
    ],
  },
  {
    type: 'Gradient',
    category: 'color',
    name: 'Gradient',
    inputs: [
      { id: 'position', name: 'Position', type: 'field', connected: false },
      { id: 'colorA', name: 'Color A', type: 'color', connected: false },
      { id: 'colorB', name: 'Color B', type: 'color', connected: false },
    ],
    outputs: [
      { id: 'colors', name: 'Colors', type: 'field', connected: false },
    ],
    computeCost: 'medium',
  },
  {
    type: 'Palette',
    category: 'color',
    name: 'Palette',
    inputs: [
      { id: 'index', name: 'Index', type: 'field', connected: false },
    ],
    outputs: [
      { id: 'colors', name: 'Colors', type: 'field', connected: false },
    ],
    computeCost: 'low',
    parameters: [
      { name: 'paletteId', type: 'number', value: 1, min: 1, max: 12, step: 1 },
    ],
  },
  
  // Output Nodes
  {
    type: 'LEDOutput',
    category: 'output',
    name: 'LED Output',
    inputs: [
      { id: 'colors', name: 'Colors', type: 'field', connected: false },
      { id: 'brightness', name: 'Brightness', type: 'scalar', connected: false },
    ],
    outputs: [],
    computeCost: 'medium',
    parameters: [
      { name: 'numLEDs', type: 'number', value: 300, min: 1, max: 1000, step: 1 },
    ],
  },
  {
    type: 'Preview',
    category: 'output',
    name: 'Preview',
    inputs: [
      { id: 'value', name: 'Value', type: 'scalar', connected: false },
    ],
    outputs: [],
    computeCost: 'low',
  },
];

export const GRAPH_TEMPLATES = {
  beginner: {
    name: 'Beginner: Audio Reactive',
    difficulty: 'beginner' as const,
    description: 'Simple audio-reactive pattern with color',
    nodes: [
      {
        ...NODE_TEMPLATES.find(t => t.type === 'AudioInput')!,
        id: 'audio1',
        position: { x: 100, y: 200 },
      },
      {
        ...NODE_TEMPLATES.find(t => t.type === 'HSVColor')!,
        id: 'color1',
        position: { x: 400, y: 200 },
      },
      {
        ...NODE_TEMPLATES.find(t => t.type === 'LEDOutput')!,
        id: 'output1',
        position: { x: 700, y: 200 },
      },
    ],
  },
  intermediate: {
    name: 'Intermediate: Spectrum Analyzer',
    difficulty: 'intermediate' as const,
    description: 'Frequency spectrum with gradient colors',
    nodes: [
      {
        ...NODE_TEMPLATES.find(t => t.type === 'AudioInput')!,
        id: 'audio1',
        position: { x: 100, y: 150 },
      },
      {
        ...NODE_TEMPLATES.find(t => t.type === 'SpectrumAnalyzer')!,
        id: 'spectrum1',
        position: { x: 350, y: 150 },
      },
      {
        ...NODE_TEMPLATES.find(t => t.type === 'Gradient')!,
        id: 'gradient1',
        position: { x: 600, y: 200 },
      },
      {
        ...NODE_TEMPLATES.find(t => t.type === 'LEDOutput')!,
        id: 'output1',
        position: { x: 850, y: 180 },
      },
    ],
  },
};

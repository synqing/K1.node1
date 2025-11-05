// Graph Editor Mock Data

import { GraphNode } from './types';

// Graph Editor Node Templates
export const NODE_TEMPLATES: Omit<GraphNode, 'id' | 'position'>[] = [
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
    parameters: { value: 1.0 },
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
    parameters: { bins: 32, smoothing: 0.3 },
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
    parameters: { threshold: 0.8, cooldown: 100 },
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
    parameters: { waveType: 'sine', amplitude: 1.0 },
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
    parameters: { min: 0, max: 1 },
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
    parameters: { amount: 0.5 },
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
    parameters: { h: 180, s: 80, v: 100 },
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
    parameters: { paletteId: 1 },
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
    parameters: { numLEDs: 300 },
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

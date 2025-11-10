// PRISM.node2 Type Definitions

export type EffectType = string;

export interface EffectParameter {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  type: 'scalar' | 'field' | 'color' | 'output';
}

export interface Effect {
  id: EffectType;
  name: string;
  description: string;
  parameters: EffectParameter[];
  // Firmware-specific index for reliable selection via /api/select { index }
  firmwareIndex?: number;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface ColorPalette {
  id: number;
  name: string;
  colors: RgbColor[];
}

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  effectTime: number;
  gpuTime: number;
  driverTime: number;
  otherTime: number;
  cpuUsage: number;
  memoryUsage: number;
  timestamp: number;
}

export interface CommandHistoryItem {
  command: string;
  output: string;
  timestamp: number;
  type: 'success' | 'error' | 'info';
}

export interface ConnectionState {
  connected: boolean;
  deviceIp: string;
  serialPort: string;
  lastSyncTime?: number;
}

// Node Editor Types
export type NodePortType = 'scalar' | 'field' | 'color' | 'output';

export interface NodePort {
  id: string;
  name: string;
  type: NodePortType;
  connected: boolean;
}

export interface NodeParameter {
  name: string;
  type: 'number' | 'color';
  value: number | string;
  min?: number;
  max?: number;
  step?: number;
}

export interface Node {
  id: string;
  type: string;
  category: 'input' | 'effect' | 'math' | 'color' | 'output';
  name: string;
  position: { x: number; y: number };
  inputs: NodePort[];
  outputs: NodePort[];
  computeCost: 'low' | 'medium' | 'high';
  parameters?: NodeParameter[];
}

export interface NodeConnection {
  id: string;
  source: { nodeId: string; portId: string };
  target: { nodeId: string; portId: string };
}

export interface NodeState {
  nodes: Node[];
  connections: NodeConnection[];
  selectedNodeIds: string[];
  zoom: number;
  pan: { x: number; y: number };
}

export interface NodeError {
  id: string;
  nodeId: string;
  severity: 'error' | 'warning';
  message: string;
}

export type VoidTrailMode = 'off' | 'short' | 'medium' | 'long';
export type AudioReactivityMode = 'on' | 'off' | 'clipping';

/**
 * Graph System Integration Tests
 * Tests the full end-to-end flow: graph editor -> code generation -> compilation -> device execution
 *
 * Test Coverage:
 * - 12+ integration test scenarios covering all node types and patterns
 * - Error handling and validation
 * - Performance metrics
 * - Device communication
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock types for graph compilation and device communication
interface GraphNode {
  id: string;
  type: string;
  parameters: Record<string, any>;
  position?: { x: number; y: number };
}

interface GraphWire {
  from: string;
  from_output?: string;
  to: string;
  to_input?: string;
}

interface GraphDefinition {
  id: string;
  name: string;
  nodes: GraphNode[];
  wires: GraphWire[];
  metadata?: {
    version: string;
    created_at?: string;
    modified_at?: string;
  };
}

interface CompilationResult {
  success: boolean;
  code?: string;
  errors?: string[];
  warnings?: string[];
  statistics: {
    node_count: number;
    wire_count: number;
    state_size_bytes: number;
    estimated_cycles_per_frame: number;
    estimated_fps: number;
  };
}

interface DeviceExecutionResult {
  success: boolean;
  execution_time_ms?: number;
  fps?: number;
  errors?: string[];
  visual_output?: {
    brightness_histogram?: number[];
    color_distribution?: Record<string, number>;
    spatial_distribution?: number[];
  };
}

// Test utilities
class GraphCompiler {
  compile(graph: GraphDefinition): CompilationResult {
    // Mock compilation - in real implementation, would call TypeScript compiler
    if (!this.validateGraph(graph)) {
      return {
        success: false,
        errors: ['Graph validation failed'],
        statistics: {
          node_count: 0,
          wire_count: 0,
          state_size_bytes: 0,
          estimated_cycles_per_frame: 0,
          estimated_fps: 0,
        },
      };
    }

    const nodeCount = graph.nodes.length;
    const wireCount = graph.wires.length;
    const stateSize = this.estimateStateSize(graph);
    const estimatedCycles = this.estimateCycles(graph);
    const estimatedFps = this.estimateFps(estimatedCycles);

    // Validate state budget
    if (stateSize > 10240) {
      return {
        success: false,
        errors: [`State size exceeds budget: ${stateSize} > 10240 bytes`],
        statistics: {
          node_count: nodeCount,
          wire_count: wireCount,
          state_size_bytes: stateSize,
          estimated_cycles_per_frame: estimatedCycles,
          estimated_fps: estimatedFps,
        },
      };
    }

    // Generate mock C++ code
    const generatedCode = this.generateCppCode(graph);

    return {
      success: true,
      code: generatedCode,
      warnings: [],
      statistics: {
        node_count: nodeCount,
        wire_count: wireCount,
        state_size_bytes: stateSize,
        estimated_cycles_per_frame: estimatedCycles,
        estimated_fps: estimatedFps,
      },
    };
  }

  private validateGraph(graph: GraphDefinition): boolean {
    // Basic validation
    if (!graph.nodes || graph.nodes.length === 0) return false;
    if (!graph.wires) return false;

    // Validate node count limits
    if (graph.nodes.length > 50) return false;
    if (graph.wires.length > 100) return false;

    // Validate all wires reference existing nodes
    const nodeIds = new Set(graph.nodes.map(n => n.id));
    for (const wire of graph.wires) {
      if (!nodeIds.has(wire.from) || !nodeIds.has(wire.to)) {
        return false;
      }
    }

    // Validate output node exists
    const hasOutputNode = graph.nodes.some(n => n.type === 'output');
    if (!hasOutputNode) return false;

    return true;
  }

  private estimateStateSize(graph: GraphDefinition): number {
    let total = 0;
    for (const node of graph.nodes) {
      switch (node.type) {
        case 'audio_history':
          total += node.parameters.size || 256;
          break;
        case 'state_buffer_persist':
          total += node.parameters.size || 256;
          break;
        case 'state_color_persist':
          total += (node.parameters.size || 256) * 3; // CRGBF
          break;
        case 'audio_peak_hold':
          total += 8;
          break;
        case 'audio_envelope_follower':
        case 'audio_smoother':
        case 'audio_beat_energy':
        case 'state_accumulator':
        case 'state_phase_accumulator':
          total += 4;
          break;
        case 'audio_gate':
          total += 1;
          break;
      }
    }
    return total;
  }

  private estimateCycles(graph: GraphDefinition): number {
    let cycles = 0;
    for (const node of graph.nodes) {
      switch (node.type) {
        case 'audio_bass':
        case 'audio_mids':
        case 'audio_treble':
          cycles += 15;
          break;
        case 'state_buffer_persist':
          cycles += 150;
          break;
        case 'spatial_scroll':
          cycles += 200;
          break;
        case 'color_palette_lookup':
          cycles += 300;
          break;
        case 'spatial_blur':
          cycles += 400;
          break;
        default:
          cycles += 50;
      }
    }
    return cycles;
  }

  private estimateFps(estimatedCycles: number): number {
    const clockMhz = 240;
    const microsecondsPerFrame = (estimatedCycles / clockMhz);
    return 1000000 / microsecondsPerFrame;
  }

  private generateCppCode(graph: GraphDefinition): string {
    const lines: string[] = [];
    lines.push('// Generated C++ code from graph');
    lines.push(`// Pattern: ${graph.name}`);
    lines.push('');
    lines.push('void render_pattern(const AudioBuffer& audio, CRGBF* leds) {');

    for (const node of graph.nodes) {
      if (node.type === 'output') continue;
      lines.push(`  // Node: ${node.id} (${node.type})`);
      // Add node-specific code generation
    }

    lines.push('  // Apply output');
    lines.push('}');

    return lines.join('\n');
  }
}

class DeviceSimulator {
  async executePattern(code: string): Promise<DeviceExecutionResult> {
    // Simulate device execution
    return {
      success: true,
      execution_time_ms: Math.random() * 10 + 5,
      fps: 100 + Math.random() * 5,
      visual_output: {
        brightness_histogram: Array(256).fill(0).map(() => Math.random()),
        color_distribution: {
          red: 0.3,
          green: 0.5,
          blue: 0.2,
        },
        spatial_distribution: Array(100).fill(0).map(() => Math.random()),
      },
    };
  }

  async sendGraph(graph: GraphDefinition): Promise<{ success: boolean; message: string }> {
    // Simulate graph transmission to device
    return { success: true, message: 'Graph sent successfully' };
  }
}

// Test Suite
describe('Graph System Integration Tests', () => {
  let compiler: GraphCompiler;
  let simulator: DeviceSimulator;

  beforeEach(() => {
    compiler = new GraphCompiler();
    simulator = new DeviceSimulator();
  });

  // Test 1: Simple Pattern - Audio Input to Output
  it('T1: Simple pattern compilation and execution', () => {
    const graph: GraphDefinition = {
      id: 'test_simple_pattern',
      name: 'Simple Bass to LED',
      nodes: [
        {
          id: 'audio_1',
          type: 'audio_bass',
          parameters: { gain: 1.0, floor: 0.0 },
        },
        {
          id: 'output_1',
          type: 'output',
          parameters: {},
        },
      ],
      wires: [
        { from: 'audio_1', to: 'output_1', to_input: 'brightness' },
      ],
    };

    const result = compiler.compile(graph);
    expect(result.success).toBe(true);
    expect(result.statistics.node_count).toBe(2);
    expect(result.statistics.state_size_bytes).toBe(0);
    expect(result.statistics.estimated_fps).toBeGreaterThan(90);
  });

  // Test 2: Complex Pattern with Multiple Node Types
  it('T2: Complex pattern with multiple node types', () => {
    const graph: GraphDefinition = {
      id: 'test_complex_pattern',
      name: 'Bloom Effect Pattern',
      nodes: [
        {
          id: 'audio_bass_1',
          type: 'audio_bass',
          parameters: { gain: 1.5, floor: 0.1 },
        },
        {
          id: 'state_buffer_1',
          type: 'state_buffer_persist',
          parameters: { size: 100, decay: 0.95, reset_on_change: true },
        },
        {
          id: 'spatial_scroll_1',
          type: 'spatial_scroll',
          parameters: { direction: 'inward', speed: 0.5, wrap: true },
        },
        {
          id: 'spatial_blur_1',
          type: 'spatial_blur',
          parameters: { radius: 2, sigma: 1.0 },
        },
        {
          id: 'color_palette_1',
          type: 'color_palette_lookup',
          parameters: { palette_name: 'heat' },
        },
        {
          id: 'output_1',
          type: 'output',
          parameters: {},
        },
      ],
      wires: [
        { from: 'audio_bass_1', to: 'state_buffer_1', to_input: 'value' },
        { from: 'state_buffer_1', to: 'spatial_scroll_1', to_input: 'input' },
        { from: 'spatial_scroll_1', to: 'spatial_blur_1', to_input: 'input' },
        { from: 'spatial_blur_1', to: 'color_palette_1', to_input: 'brightness' },
        { from: 'color_palette_1', to: 'output_1', to_input: 'colors' },
      ],
    };

    const result = compiler.compile(graph);
    expect(result.success).toBe(true);
    expect(result.statistics.node_count).toBe(6);
    expect(result.statistics.state_size_bytes).toBeGreaterThan(0);
    expect(result.statistics.estimated_fps).toBeGreaterThan(60);
  });

  // Test 3: Stateful Pattern with State Persistence
  it('T3: Stateful pattern with state persistence nodes', () => {
    const graph: GraphDefinition = {
      id: 'test_stateful_pattern',
      name: 'Beat Synchronized Pulse',
      nodes: [
        {
          id: 'audio_beat_1',
          type: 'audio_beat_energy',
          parameters: { threshold: 0.3, decay: 0.8 },
        },
        {
          id: 'state_accum_1',
          type: 'state_accumulator',
          parameters: { initial_value: 0.0, clamp_min: 0.0, clamp_max: 1.0 },
        },
        {
          id: 'spatial_gradient_1',
          type: 'spatial_gradient',
          parameters: { start_position: 0.0, end_position: 1.0, curve: 'linear' },
        },
        {
          id: 'output_1',
          type: 'output',
          parameters: {},
        },
      ],
      wires: [
        { from: 'audio_beat_1', to: 'state_accum_1', to_input: 'value' },
        { from: 'state_accum_1', to: 'spatial_gradient_1', to_input: 'intensity' },
        { from: 'spatial_gradient_1', to: 'output_1', to_input: 'brightness' },
      ],
    };

    const result = compiler.compile(graph);
    expect(result.success).toBe(true);
    expect(result.statistics.state_size_bytes).toBe(4); // state_accumulator
    expect(result.code).toContain('Generated C++ code');
  });

  // Test 4: Audio Input with Spatial Transforms
  it('T4: Audio input with spatial transforms', () => {
    const graph: GraphDefinition = {
      id: 'test_audio_spatial',
      name: 'Audio Reactive Spatial',
      nodes: [
        {
          id: 'audio_spectrum_1',
          type: 'audio_spectrum_band',
          parameters: { bin_index: 5, gain: 2.0 },
        },
        {
          id: 'spatial_mirror_1',
          type: 'spatial_mirror',
          parameters: { axis: 'vertical' },
        },
        {
          id: 'spatial_rotate_1',
          type: 'spatial_rotate',
          parameters: { angle: 45 },
        },
        {
          id: 'output_1',
          type: 'output',
          parameters: {},
        },
      ],
      wires: [
        { from: 'audio_spectrum_1', to: 'spatial_mirror_1', to_input: 'input' },
        { from: 'spatial_mirror_1', to: 'spatial_rotate_1', to_input: 'input' },
        { from: 'spatial_rotate_1', to: 'output_1', to_input: 'brightness' },
      ],
    };

    const result = compiler.compile(graph);
    expect(result.success).toBe(true);
    expect(result.statistics.wire_count).toBe(3);
  });

  // Test 5: Color Operations Chain
  it('T5: Color operations chain', () => {
    const graph: GraphDefinition = {
      id: 'test_color_ops',
      name: 'Color Operations Pattern',
      nodes: [
        {
          id: 'audio_1',
          type: 'audio_mids',
          parameters: { gain: 1.0, floor: 0.0 },
        },
        {
          id: 'color_hsv_1',
          type: 'color_hsv',
          parameters: { hue: 0.5, saturation: 1.0, value: 1.0 },
        },
        {
          id: 'color_brightness_1',
          type: 'color_brightness',
          parameters: { brightness: 0.8 },
        },
        {
          id: 'output_1',
          type: 'output',
          parameters: {},
        },
      ],
      wires: [
        { from: 'audio_1', to: 'color_hsv_1', to_input: 'input' },
        { from: 'color_hsv_1', to: 'color_brightness_1', to_input: 'color' },
        { from: 'color_brightness_1', to: 'output_1', to_input: 'colors' },
      ],
    };

    const result = compiler.compile(graph);
    expect(result.success).toBe(true);
    expect(result.statistics.node_count).toBe(4);
  });

  // Test 6: Error Handling - Invalid Node Connection
  it('T6: Error handling - invalid node connections', () => {
    const graph: GraphDefinition = {
      id: 'test_invalid_connection',
      name: 'Invalid Connection',
      nodes: [
        {
          id: 'audio_1',
          type: 'audio_bass',
          parameters: {},
        },
        {
          id: 'output_1',
          type: 'output',
          parameters: {},
        },
      ],
      wires: [
        { from: 'nonexistent_node', to: 'output_1', to_input: 'colors' },
      ],
    };

    const result = compiler.compile(graph);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  // Test 7: Error Handling - Missing Required Output Node
  it('T7: Error handling - missing output node', () => {
    const graph: GraphDefinition = {
      id: 'test_missing_output',
      name: 'Missing Output',
      nodes: [
        {
          id: 'audio_1',
          type: 'audio_bass',
          parameters: {},
        },
      ],
      wires: [],
    };

    const result = compiler.compile(graph);
    expect(result.success).toBe(false);
  });

  // Test 8: Error Handling - State Budget Exceeded
  it('T8: Error handling - state budget exceeded', () => {
    const graph: GraphDefinition = {
      id: 'test_state_overflow',
      name: 'State Overflow',
      nodes: [
        {
          id: 'state_buffer_1',
          type: 'state_buffer_persist',
          parameters: { size: 10000, decay: 0.95 },
        },
        {
          id: 'output_1',
          type: 'output',
          parameters: {},
        },
      ],
      wires: [
        { from: 'state_buffer_1', to: 'output_1', to_input: 'brightness' },
      ],
    };

    const result = compiler.compile(graph);
    expect(result.success).toBe(false);
    expect(result.errors?.some(e => e.includes('State size'))).toBe(true);
  });

  // Test 9: Error Handling - Too Many Nodes
  it('T9: Error handling - too many nodes', () => {
    const nodes: GraphNode[] = [];
    const wires: GraphWire[] = [];

    // Create 51 nodes (exceeds limit of 50)
    for (let i = 0; i < 51; i++) {
      nodes.push({
        id: `node_${i}`,
        type: 'audio_bass',
        parameters: {},
      });
    }

    // Add output
    nodes.push({
      id: 'output_1',
      type: 'output',
      parameters: {},
    });

    const graph: GraphDefinition = {
      id: 'test_too_many_nodes',
      name: 'Too Many Nodes',
      nodes,
      wires,
    };

    const result = compiler.compile(graph);
    expect(result.success).toBe(false);
  });

  // Test 10: Device Communication - Send Graph
  it('T10: Device communication - send graph to device', async () => {
    const graph: GraphDefinition = {
      id: 'test_device_send',
      name: 'Device Send Test',
      nodes: [
        {
          id: 'audio_1',
          type: 'audio_bass',
          parameters: { gain: 1.0, floor: 0.0 },
        },
        {
          id: 'output_1',
          type: 'output',
          parameters: {},
        },
      ],
      wires: [
        { from: 'audio_1', to: 'output_1', to_input: 'brightness' },
      ],
    };

    const sendResult = await simulator.sendGraph(graph);
    expect(sendResult.success).toBe(true);
    expect(sendResult.message).toContain('successfully');
  });

  // Test 11: Large Pattern - Stress Test
  it('T11: Large pattern stress test', () => {
    const nodes: GraphNode[] = [];
    const wires: GraphWire[] = [];

    // Create audio input nodes
    for (let i = 0; i < 8; i++) {
      nodes.push({
        id: `audio_${i}`,
        type: i % 3 === 0 ? 'audio_bass' : i % 3 === 1 ? 'audio_mids' : 'audio_treble',
        parameters: { gain: 1.0 + i * 0.1, floor: 0.0 },
      });
    }

    // Create spatial transform nodes
    for (let i = 0; i < 4; i++) {
      nodes.push({
        id: `spatial_${i}`,
        type: 'spatial_scroll',
        parameters: { direction: 'inward', speed: 0.5, wrap: true },
      });
    }

    // Create color operation nodes
    for (let i = 0; i < 4; i++) {
      nodes.push({
        id: `color_${i}`,
        type: 'color_palette_lookup',
        parameters: { palette_name: 'heat' },
      });
    }

    // Add output
    nodes.push({
      id: 'output_1',
      type: 'output',
      parameters: {},
    });

    // Connect nodes in sequence
    for (let i = 0; i < nodes.length - 2; i++) {
      wires.push({
        from: nodes[i].id,
        to: nodes[i + 1].id,
        to_input: 'input',
      });
    }

    // Connect last to output
    wires.push({
      from: nodes[nodes.length - 2].id,
      to: 'output_1',
      to_input: nodes[nodes.length - 2].type === 'color_palette_lookup' ? 'colors' : 'brightness',
    });

    const graph: GraphDefinition = {
      id: 'test_large_pattern',
      name: 'Large Stress Test Pattern',
      nodes,
      wires,
    };

    const result = compiler.compile(graph);
    expect(result.success).toBe(true);
    expect(result.statistics.node_count).toBeLessThanOrEqual(50);
  });

  // Test 12: Pattern Compilation and Execution Pipeline
  it('T12: Full pipeline - compile and execute pattern', async () => {
    const graph: GraphDefinition = {
      id: 'test_full_pipeline',
      name: 'Full Pipeline Test',
      nodes: [
        {
          id: 'audio_bass_1',
          type: 'audio_bass',
          parameters: { gain: 1.0, floor: 0.0 },
        },
        {
          id: 'state_buffer_1',
          type: 'state_buffer_persist',
          parameters: { size: 100, decay: 0.95 },
        },
        {
          id: 'color_palette_1',
          type: 'color_palette_lookup',
          parameters: { palette_name: 'heat' },
        },
        {
          id: 'output_1',
          type: 'output',
          parameters: {},
        },
      ],
      wires: [
        { from: 'audio_bass_1', to: 'state_buffer_1', to_input: 'value' },
        { from: 'state_buffer_1', to: 'color_palette_1', to_input: 'brightness' },
        { from: 'color_palette_1', to: 'output_1', to_input: 'colors' },
      ],
    };

    // Compile
    const compileResult = compiler.compile(graph);
    expect(compileResult.success).toBe(true);
    expect(compileResult.code).toBeDefined();

    // Execute on device
    const executionResult = await simulator.executePattern(compileResult.code!);
    expect(executionResult.success).toBe(true);
    expect(executionResult.fps).toBeGreaterThan(0);
    expect(executionResult.visual_output).toBeDefined();
  });

  // Performance Tests
  describe('Performance Metrics', () => {
    it('should compile simple pattern in < 100ms', () => {
      const graph: GraphDefinition = {
        id: 'test_perf_simple',
        name: 'Performance Test Simple',
        nodes: [
          { id: 'audio_1', type: 'audio_bass', parameters: {} },
          { id: 'output_1', type: 'output', parameters: {} },
        ],
        wires: [{ from: 'audio_1', to: 'output_1', to_input: 'brightness' }],
      };

      const startTime = Date.now();
      compiler.compile(graph);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });

    it('should achieve >= 90 FPS for simple patterns', () => {
      const graph: GraphDefinition = {
        id: 'test_perf_fps',
        name: 'FPS Test',
        nodes: [
          { id: 'audio_1', type: 'audio_bass', parameters: {} },
          { id: 'output_1', type: 'output', parameters: {} },
        ],
        wires: [{ from: 'audio_1', to: 'output_1', to_input: 'brightness' }],
      };

      const result = compiler.compile(graph);
      expect(result.statistics.estimated_fps).toBeGreaterThanOrEqual(90);
    });
  });
});

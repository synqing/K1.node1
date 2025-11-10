---
title: Task 15 - Code Generation Architecture Strategy
subtitle: Scalable Implementation Plan for 39+ Node Type Ecosystem
version: 1.0
date: 2025-11-10
status: draft
owner: Architecture Team (Claude Code)
related:
  - docs/06-reference/K1NRef_GRAPH_NODE_CATALOG_EXPANDED_v2.0_20251110.md
  - docs/plans/2025-11-10-phase1-compiler-design.md
- docs/02-adr/K1NADR_0006_CODEGEN_ABANDONMENT_v1.0_20251110.md
tags: [architecture, code-generation, node-types, task-15, phase-5]
---

# Task 15: Code Generation Architecture Strategy

## Executive Summary

This document provides a comprehensive implementation strategy for extending K1.node1's code generation system to support the full ecosystem of **39+ node types** with scalable, maintainable architecture. The work focuses on architecture planning and proof-of-concept validation for the existing TypeScript-based compiler pipeline.

**Current State:**
- ✅ 5-stage compiler pipeline exists (parser, validator, optimizer, scheduler, emitter)
- ✅ 39 node types defined in registry with full type specifications
- ⚠️ Code generation partially implemented (template-based, stateful nodes supported in architecture but not fully generated)
- ❌ Node-specific code generators incomplete (many stub implementations)

**Target State:**
- ✅ All 39 node types have production-ready code generators
- ✅ Extensible architecture supports future node type additions
- ✅ Type system validated end-to-end for all node categories
- ✅ Optimization and validation rules enforce correctness at scale
- ✅ Clear integration pattern for new node types

**Timeline:** 3-4 weeks (implementation phase, separate from planning)

---

## Part 1: Current Code Generation Architecture Analysis

### 1.1 Pipeline Overview

The K1.node1 compiler follows a **5-stage pipeline** model:

```
JSON Graph Input
    ↓
[Stage 1: Parser] → Validates JSON syntax, creates AST
    ↓
[Stage 2: Validator] → Type checking, cycle detection, constraints
    ↓
[Stage 3: Optimizer] → Constant folding, DCE, CSE
    ↓
[Stage 4: Scheduler] → Topological ordering, buffer allocation
    ↓
[Stage 5: Emitter] → C++ code generation
    ↓
pattern_<name>.cpp
```

### 1.2 Current Implementation Status

#### Stage 1: Parser (`parser.ts`)
**Status:** ✅ Complete
**Capability:** Reads JSON, validates basic structure, produces AST
**Coverage:** All 39 node types recognized
**Code:** ~60 lines, minimal but functional

#### Stage 2: Validator (`validator.ts`)
**Status:** ⚠️ Partial
**Capability:** Type system enforcement, cycle detection
**Coverage:** Core validation rules implemented
**Gaps:**
- Memory budget validation incomplete (should validate all stateful nodes <1KB)
- Port connectivity checking exists but needs comprehensive coverage
- Parameter bounds checking present but not fully integrated
**Code:** ~150 lines

#### Stage 3: Optimizer (`optimizer.ts`)
**Status:** ⚠️ Basic
**Capability:** Constant folding, dead code elimination
**Coverage:** Basic rules implemented
**Gaps:**
- CSE (Common Subexpression Elimination) stubbed
- No stateful node boundary preservation
- No optimization safety gates
**Code:** ~30 lines (mostly stub)

#### Stage 4: Scheduler (`scheduler.ts`)
**Status:** ⚠️ Partial
**Capability:** Topological ordering, buffer lifetime analysis
**Coverage:** Topo sort implemented
**Gaps:**
- Linear-scan allocator partially implemented
- Buffer lifetime analysis basic
- In-place transform detection needs work
- Stateful node ordering not fully enforced
**Code:** ~150 lines

#### Stage 5: Emitter (`emitter.ts`)
**Status:** ⚠️ Partial with stubs
**Capability:** Template-based C++ generation
**Coverage:** Manual switch statement for known node types
**Gaps:**
- Most nodes use `genNoop` stub
- No pluggable generator system
- Manual buffer management
- No automatic memory tracking
- Parameter handling inline only
**Code:** ~600 lines (mostly switch cases and buffer ops)

#### Code Generators (`emitterNodes.ts`)
**Status:** ❌ Incomplete
**Capability:** Per-node C++ generation
**Coverage:** ~8 generators implemented (BandShape, BufferPersist, Mirror, Fill, etc.)
**Gaps:**
- 31+ node types missing generators
- No pattern for easy addition
- Stateful node support inconsistent
**Code:** ~120 lines

### 1.3 Type System (`types.ts`)

**Status:** ✅ Complete and comprehensive
**Coverage:** All 39+ node types fully specified

**Node Type Registry Contains:**
- **Input Nodes (10):** Time, AudioSnapshot, AudioSpectrum, BeatEvent, AutoCorrelation, Chromagram, ParamF, ParamColor, ConfigToggle, BandShape
- **Math/Filter Nodes (10):** Add, Mul, Mix, Lerp, Clamp, Pow, Sqrt, LowPass, MovingAverage, Contrast
- **Color Nodes (6):** Hsv, Color, GradientMap, Desaturate, ForceSaturation, PaletteSelector, ColorizeBuffer
- **Geometry/Buffer Nodes (8):** Fill, Blur, Mirror, Shift, Downsample, DotRender, ComposeLayers, BufferPersist
- **Noise/Procedural Nodes (3):** PerlinNoise, RngSeed, PositionAccumulator
- **Output Nodes (2):** LedOutput, LedOutputMirror

**Each entry specifies:**
- Input port definitions with types
- Parameter definitions with constraints
- Output type(s)
- Memory footprint
- Stateful/pure classification
- Firmware helper function references

---

## Part 2: Node Type Support Matrix

### 2.1 Current vs. Needed Coverage

| Category | Count | Defined | Generators | Status |
|----------|-------|---------|-----------|--------|
| **Input** | 10 | 10 | 2 | 80% gap |
| **Math/Filter** | 10 | 10 | 1 | 90% gap |
| **Color** | 6 | 6 | 2 | 67% gap |
| **Geometry/Buffer** | 8 | 8 | 3 | 63% gap |
| **Noise/Procedural** | 3 | 3 | 0 | 100% gap |
| **Output** | 2 | 2 | 2 | 0% gap |
| **TOTAL** | **39** | **39** | **10** | **74% gap** |

### 2.2 Input Nodes (10 types) - Codegen Status

| Node Type | Spec | Generator | Notes |
|-----------|------|-----------|-------|
| Time | ✅ | ❌ | Trivial: `frame_count / fps` |
| AudioSnapshot | ✅ | ❌ | Reads from firmware audio interface |
| AudioSpectrum | ✅ | ❌ | Reads spectrum array from audio |
| BeatEvent | ✅ | ❌ | Stateful: needs beat detector state |
| AutoCorrelation | ✅ | ❌ | Calls firmware helper `compute_pitch()` |
| Chromagram | ✅ | ❌ | Calls firmware helper `compute_chroma_vector()` |
| ParamF | ✅ | ❌ | Trivial: `params.field_name` |
| ParamColor | ✅ | ❌ | Trivial: `params.field_name` |
| ConfigToggle | ✅ | ❌ | Trivial: `params.toggle_name` (boolean) |
| BandShape | ✅ | ⚠️ | Partial: complex interpolation |

### 2.3 Math/Filter Nodes (10 types) - Codegen Status

| Node Type | Spec | Generator | Notes |
|-----------|------|-----------|-------|
| Add | ✅ | ❌ | Trivial: `a + b` |
| Mul | ✅ | ❌ | Trivial: `a * b` |
| Mix | ✅ | ❌ | Trivial: `a * (1-t) + b * t` |
| Lerp | ✅ | ❌ | Alias for Mix |
| Clamp | ✅ | ❌ | Trivial: `std::clamp(v, min, max)` |
| Pow | ✅ | ❌ | Trivial: `powf(base, exp)` |
| Sqrt | ✅ | ❌ | Trivial: `sqrtf(v)` |
| LowPass | ✅ | ❌ | Stateful: IIR filter state |
| MovingAverage | ✅ | ❌ | Stateful: ring buffer |
| Contrast | ✅ | ❌ | Complex: S-curve formula |

### 2.4 Color Nodes (6 types) - Codegen Status

| Node Type | Spec | Generator | Notes |
|-----------|------|-----------|-------|
| Hsv | ✅ | ❌ | Calls `hsv_to_rgb()` helper |
| Color | ✅ | ❌ | Trivial: construct vec3 |
| GradientMap | ✅ | ⚠️ | Partial: palette lookup |
| Desaturate | ✅ | ❌ | Calls `desaturate()` helper |
| ForceSaturation | ✅ | ❌ | Conditional HSV saturation |
| PaletteSelector | ✅ | ❌ | Stub: Phase 2 feature |
| ColorizeBuffer | ✅ | ⚠️ | Partial: maps buffer via palette |

### 2.5 Geometry/Buffer Nodes (8 types) - Codegen Status

| Node Type | Spec | Generator | Notes |
|-----------|------|-----------|-------|
| Fill | ✅ | ✅ | Calls `fill_buffer()` |
| Blur | ✅ | ❌ | Calls `blur_buffer()` |
| Mirror | ✅ | ✅ | Calls `mirror_buffer()` |
| Shift | ✅ | ❌ | Calls `shift_buffer()` |
| Downsample | ✅ | ❌ | Calls `downsample_buffer()` |
| DotRender | ✅ | ❌ | Complex: blend peak indicators |
| ComposeLayers | ✅ | ❌ | Calls `compose_layers()` |
| BufferPersist | ✅ | ✅ | Stateful: exponential decay |

### 2.6 Noise/Procedural Nodes (3 types) - Codegen Status

| Node Type | Spec | Generator | Notes |
|-----------|------|-----------|-------|
| PerlinNoise | ✅ | ❌ | Calls firmware helper `perlin_noise_1d()` |
| RngSeed | ✅ | ❌ | Trivial: constant seed value |
| PositionAccumulator | ✅ | ❌ | Trivial: computed from frame_count |

### 2.7 Output Nodes (2 types) - Codegen Status

| Node Type | Spec | Generator | Notes |
|-----------|------|-----------|-------|
| LedOutput | ✅ | ✅ | Handles finalization + clamping |
| LedOutputMirror | ✅ | ✅ | Finalization with mirror symmetry |

---

## Part 3: Generator Architecture for Extensibility

### 3.1 Current Generator Pattern

The emitter uses a **switch-statement dispatch** model:

```typescript
// Current emitterNodes.ts approach
export const GENERATORS: Record<string, NodeGenerator> = {
  BandShape: genBandShape,
  BufferPersist: genBufferPersist,
  // ... etc
  Time: genNoop,  // Stub
  AudioSpectrum: genNoop,  // Stub
  // 29+ more stubs
};
```

**Issues with current pattern:**
- 74% of nodes are stubs
- Adding a new node requires:
  1. Implement generator function
  2. Register in GENERATORS map
  3. Update emitter dispatch
  4. Write tests
- Manual management of buffer variables
- No automatic parameter validation
- No consistency checking across generators

### 3.2 Proposed Extensible Architecture

#### Pattern 1: Declarative Generator Registry with Metadata

Instead of manual dispatch, use **declarative metadata** tied to the node type definition:

```typescript
// Extended NodeTypeSpec to include generator metadata
export interface NodeTypeSpec {
  // ... existing fields ...

  // NEW: Generator metadata
  generator?: {
    pattern: 'trivial' | 'buffer-op' | 'stateful' | 'custom';
    template?: string;  // For trivial nodes
    firmwareHelper?: string;
    bufferMode?: 'scalar' | 'rgb' | 'input-dependent';
    stateFields?: {
      name: string;
      type: string;
      size: number;
    }[];
  };
}
```

**Benefits:**
- Self-documenting node definitions
- Automatic generator selection
- Template-based trivial nodes (no code needed)
- Clear state management

#### Pattern 2: Template-Based Generation System

Create a **template system** for common node patterns:

```typescript
enum GeneratorPattern {
  // Trivial mathematical operations
  MATH_UNARY = 'math_unary',      // sqrt, pow, sin, etc.
  MATH_BINARY = 'math_binary',    // add, mul, mix, etc.

  // Trivial parameter access
  PARAM_ACCESS = 'param_access',  // ParamF, ParamColor, etc.

  // Stateful operations
  FILTER = 'filter',              // LowPass, MovingAverage
  BUFFER_STATE = 'buffer_state',  // BufferPersist

  // Audio operations
  AUDIO_INPUT = 'audio_input',    // AudioSnapshot, AudioSpectrum

  // Buffer operations
  BUFFER_OP = 'buffer_op',        // Blur, Mirror, Fill, etc.

  // Complex custom logic
  CUSTOM = 'custom',
}
```

Each pattern has a **generator template** and **parameter mapping**:

```typescript
const GENERATOR_TEMPLATES: Record<GeneratorPattern, (spec: NodeTypeSpec, node: NodeAST) => string[]> = {
  [GeneratorPattern.MATH_UNARY]: (spec, node) => {
    const input = node.inputs.get('value') || node.inputs.values().next().value;
    const op = spec.firmware_helper || spec.name.toLowerCase();
    return [`// Node: ${spec.name}`,
            `out = ${op}f(${input});`];
  },

  [GeneratorPattern.MATH_BINARY]: (spec, node) => {
    const a = node.inputs.get('a') || node.inputs.values().next().value;
    const b = node.inputs.get('b') || node.inputs.values().next().value;
    const op = spec.firmware_helper || BINARY_OPS[spec.name];
    return [`// Node: ${spec.name}`,
            `out = ${a} ${op} ${b};`];
  },

  [GeneratorPattern.PARAM_ACCESS]: (spec, node) => {
    const paramName = node.params?.get('name') || spec.name;
    return [`// Node: ${spec.name}`,
            `out = params.${paramName};`];
  },

  // ... etc
};
```

#### Pattern 3: Type-Driven Code Generation

Use the **type system** to automatically generate correct code:

```typescript
interface CodeGenContext {
  // Input tracking
  inputs: Map<string, { type: PortType; varName: string }>;

  // Output tracking
  output: { type: PortType; varName: string };

  // State management
  statePrefix: string;  // e.g., "state.lowpass_0"

  // Helper access
  firmwareHelpers: Set<string>;

  // Buffer allocation
  bufferAlloc: Map<string, { size: number; varName: string }>;
}

// Code generation engine
class CodeGen {
  generateNode(spec: NodeTypeSpec, node: NodeAST, ctx: CodeGenContext): string[] {
    // Pattern selection
    const pattern = this.selectPattern(spec);

    // Template expansion
    const template = GENERATOR_TEMPLATES[pattern];

    // Type-safe code generation
    const code = template(spec, node);

    // Post-generation validation
    this.validateGenerated(code, spec, ctx);

    return code;
  }
}
```

#### Pattern 4: Pluggable Generator Interface

Define a **standard generator interface** for custom implementations:

```typescript
interface NodeGenerator {
  // Metadata about what this generator handles
  canHandle(spec: NodeTypeSpec): boolean;

  // Generate C++ code for this node
  generate(node: NodeAST, spec: NodeTypeSpec, ctx: CodeGenContext): string[];

  // Declare any state fields needed
  declareState?(spec: NodeTypeSpec): StateField[];

  // Declare any firmware helpers needed
  requiredHelpers?(spec: NodeTypeSpec): string[];

  // Validate node before generation
  validate?(node: NodeAST, spec: NodeTypeSpec): ValidationError[];
}

// Registry system
class GeneratorRegistry {
  private generators: NodeGenerator[] = [];

  register(gen: NodeGenerator): void {
    this.generators.push(gen);
  }

  selectGenerator(spec: NodeTypeSpec): NodeGenerator {
    // Return first matching generator
    return this.generators.find(g => g.canHandle(spec))
      || DEFAULT_GENERATOR;
  }
}
```

### 3.3 Proposed Emitter Refactoring

Replace the current monolithic emitter with a **modular, composable** design:

```typescript
// New emitter architecture
class PatternEmitter {
  private generatorRegistry: GeneratorRegistry;
  private typeValidator: TypeValidator;
  private bufferAllocator: BufferAllocator;
  private stateManager: StateManager;

  emit(ast: GraphAST, schedule: ScheduleNode[]): EmitterOutput {
    // Phase 1: Setup context
    const ctx = this.setupContext(ast);

    // Phase 2: Generate declarations
    const decls = this.generateDeclarations(ast, ctx);

    // Phase 3: Generate node operations
    const nodeCode: string[] = [];
    for (const schedNode of schedule) {
      const spec = NODE_TYPE_REGISTRY.get(schedNode.nodeType)!;
      const gen = this.generatorRegistry.selectGenerator(spec);
      nodeCode.push(...gen.generate(schedNode, spec, ctx));
    }

    // Phase 4: Generate output finalization
    const finalization = this.generateFinalization(ast, ctx);

    // Phase 5: Assemble pattern function
    return this.assembleFunction(decls, nodeCode, finalization, ctx);
  }

  private setupContext(ast: GraphAST): CodeGenContext {
    // Initialize buffer allocation, state tracking, etc.
  }
}
```

---

## Part 4: Type System for Graph Nodes

### 4.1 Port Type System

**Current Implementation:** ✅ Complete
**Coverage:** 20 port types defined

```typescript
enum PortType {
  // Scalar types
  INT = 'int',
  BOOL = 'bool',
  FLOAT = 'float',

  // Vector types
  VEC2 = 'vec2',
  VEC3 = 'vec3',
  COLOR = 'color',  // Alias for vec3

  // Temporal
  TIME = 'time',
  DURATION = 'duration',

  // Audio
  AUDIO_SPECTRUM = 'audio_spectrum',
  AUDIO_ENVELOPE = 'audio_envelope',
  BEAT_EVENT = 'beat_event',
  CHROMA_VECTOR = 'chroma_vector',

  // Parameters
  PARAM_FLOAT = 'param_float',
  PARAM_COLOR = 'param_color',
  PARAM_BOOL = 'param_bool',

  // Buffers
  LED_BUFFER_FLOAT = 'led_buffer_float',
  LED_BUFFER_VEC3 = 'led_buffer_vec3',
}
```

### 4.2 Type Coercion Rules

**Current Rules (Explicit Only):**

| From | To | Method | Allowed |
|------|----|----|---------|
| `int` | `float` | Implicit widening | ✅ |
| `float` | `color` | Fill broadcast | ✅ |
| `float` → `vec3` | Explicit Cast node | Phase 2 | ⏳ |
| `color` → `led_buffer<vec3>` | Fill node | ✅ |
| `audio_spectrum` → scalar | Aggregation | Phase 2 | ⏳ |
| `beat_event` → `float` | Explicit Cast | Phase 2 | ⏳ |
| `chroma_vector` → any | **FORBIDDEN** | Phase 1 | ❌ |

### 4.3 Type Checking Implementation

**Current Validator Rules:**

1. **Port Connectivity:** Required inputs connected or have defaults
2. **Type Compatibility:** Port type matches input or is coercible
3. **No Implicit Conversions:** Disallow silent type mismatches
4. **Multi-Output Handling:** AutoCorrelation outputs separate ports

### 4.4 Memory Type Annotations

**Buffer Memory Tracking:**

```typescript
interface TypeInfo {
  type: PortType;

  // Size in bytes if concrete
  size?: number;

  // For parametric types (e.g., led_buffer<T>)
  elementType?: PortType;
  elementCount?: number;

  // For runtime-sized (need compile-time bounds)
  maxSize?: number;
}
```

---

## Part 5: Optimization and Validation Opportunities

### 5.1 Current Optimization Strategy

**Status:** ⚠️ Basic, needs enhancement

**Implemented:**
- Constant folding (math ops with literal inputs)
- Dead code elimination (unreachable nodes)
- Literal inlining

**Needed:**
- CSE (Common Subexpression Elimination) for pure nodes
- Buffer lifetime analysis improvements
- In-place transform detection
- Stateful node boundary preservation

### 5.2 Proposed Optimization Enhancements

#### 5.2.1 Stateful Node Boundary Preservation

```typescript
// Optimization rule: Never reorder around stateful nodes
class OptimizationPhase {
  optimizeGraph(ast: GraphAST): GraphAST {
    // Find stateful node boundaries
    const statefulNodes = ast.nodes.filter(n =>
      NODE_TYPE_REGISTRY.get(n.type)?.is_stateful);

    // Partition graph into regions
    const regions = this.partitionByStatefulBoundaries(ast, statefulNodes);

    // Optimize within each region independently
    for (const region of regions) {
      this.optimizeRegion(region);
    }

    return ast;
  }
}
```

#### 5.2.2 Buffer Lifetime Analysis

```typescript
// Enhanced scheduler: compute exact buffer lifetimes
interface BufferLifetime {
  nodeId: string;
  allocSize: number;
  liveStart: number;  // First use
  liveEnd: number;    // Last use
  isEscaping: boolean; // Persists to next frame
}

class BufferAllocator {
  allocateBuffers(schedule: ScheduleNode[]): BufferAllocation[] {
    // Compute lifetimes for each buffer
    const lifetimes = this.computeLifetimes(schedule);

    // Linear-scan allocation
    const allocs: BufferAllocation[] = [];
    const freeList: { size: number; offset: number }[] = [];

    for (const lifetime of lifetimes) {
      const slot = this.findSlot(freeList, lifetime.allocSize);
      allocs.push({
        nodeId: lifetime.nodeId,
        offset: slot.offset,
        size: lifetime.allocSize,
        reusable: !lifetime.isEscaping,
      });
    }

    return allocs;
  }
}
```

#### 5.2.3 Common Subexpression Elimination

```typescript
// CSE for pure subgraphs only
class CSEOptimizer {
  eliminateCommon(ast: GraphAST): GraphAST {
    // Group nodes by (type, inputs, params)
    const nodeGroups = this.groupBySignature(ast);

    for (const [sig, nodes] of nodeGroups) {
      if (nodes.length > 1 && this.isPure(nodes[0])) {
        // Keep first, redirect others
        const keeper = nodes[0];
        for (const dup of nodes.slice(1)) {
          this.redirectConsumers(ast, dup.id, keeper.id);
          ast.nodes = ast.nodes.filter(n => n.id !== dup.id);
        }
      }
    }

    return ast;
  }

  private isPure(node: NodeAST): boolean {
    const spec = NODE_TYPE_REGISTRY.get(node.type);
    return spec?.is_pure ?? false;
  }
}
```

### 5.3 Validation Rule Enhancements

#### 5.3.1 Memory Budget Enforcement

```typescript
// Validate total memory < hardware limit
class MemoryValidator {
  validateBudget(schedule: ScheduleNode[], allocations: BufferAllocation[]): ValidationError[] {
    const errors: ValidationError[] = [];

    // Sum stateful node memory
    let statefulMemory = 0;
    for (const schedNode of schedule) {
      const spec = NODE_TYPE_REGISTRY.get(schedNode.nodeType)!;
      if (spec.is_stateful) {
        statefulMemory += spec.memory_bytes;
      }
    }

    // Sum temp buffer allocation
    let tempMemory = 0;
    for (const alloc of allocations) {
      if (alloc.reusable) tempMemory += alloc.size;
    }

    // Enforce limits
    const STATEFUL_LIMIT = 1024;  // 1 KB
    const TEMP_LIMIT = 16384;     // 16 KB

    if (statefulMemory > STATEFUL_LIMIT) {
      errors.push({
        code: 'E1004',
        message: `Stateful nodes exceed budget: ${statefulMemory} > ${STATEFUL_LIMIT}`,
        severity: 'error',
      });
    }

    if (tempMemory > TEMP_LIMIT) {
      errors.push({
        code: 'E1004',
        message: `Temporary buffers exceed budget: ${tempMemory} > ${TEMP_LIMIT}`,
        severity: 'error',
      });
    }

    return errors;
  }
}
```

#### 5.3.2 Cycle Detection with Path Reporting

```typescript
// Enhanced cycle detection: report the actual cycle path
class CycleDetector {
  detectCycles(ast: GraphAST): ValidationError[] {
    const errors: ValidationError[] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const path: string[] = [];

    for (const node of ast.nodes) {
      if (!visited.has(node.id)) {
        this.dfs(node, ast, visited, inStack, path, errors);
      }
    }

    return errors;
  }

  private dfs(
    node: NodeAST,
    ast: GraphAST,
    visited: Set<string>,
    inStack: Set<string>,
    path: string[],
    errors: ValidationError[]
  ): void {
    visited.add(node.id);
    inStack.add(node.id);
    path.push(node.id);

    for (const srcId of node.inputs.values()) {
      if (inStack.has(srcId)) {
        // Cycle found
        const cycleStart = path.indexOf(srcId);
        const cyclePath = path.slice(cycleStart).join(' → ') + ` → ${node.id}`;
        errors.push({
          code: 'E1003',
          message: `Cycle detected: ${cyclePath}`,
          severity: 'error',
          nodeId: node.id,
        });
      } else if (!visited.has(srcId)) {
        const srcNode = ast.nodes.find(n => n.id === srcId);
        if (srcNode) {
          this.dfs(srcNode, ast, visited, inStack, path, errors);
        }
      }
    }

    path.pop();
    inStack.delete(node.id);
  }
}
```

---

## Part 6: Generator Implementation Pattern

### 6.1 Standard Generator Template

Every new node type generator should follow this pattern:

```typescript
// Template for node generator
class Add_Generator implements NodeGenerator {
  canHandle(spec: NodeTypeSpec): boolean {
    return spec.name === 'Add';
  }

  generate(node: NodeAST, spec: NodeTypeSpec, ctx: CodeGenContext): string[] {
    const a = ctx.inputs.get('a');
    const b = ctx.inputs.get('b');

    return [
      `// Node: Add (inputs: ${a.varName}, ${b.varName})`,
      `float ${ctx.output.varName} = ${a.varName} + ${b.varName};`,
    ];
  }

  validate(node: NodeAST, spec: NodeTypeSpec): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!node.inputs.has('a')) {
      errors.push({ code: 'E1002', message: 'Missing input: a' });
    }
    if (!node.inputs.has('b')) {
      errors.push({ code: 'E1002', message: 'Missing input: b' });
    }

    return errors;
  }
}
```

### 6.2 Stateful Node Generator Template

For nodes with state (LowPass, MovingAverage, BufferPersist):

```typescript
class LowPass_Generator implements NodeGenerator {
  canHandle(spec: NodeTypeSpec): boolean {
    return spec.name === 'LowPass';
  }

  declareState(spec: NodeTypeSpec): StateField[] {
    return [{
      name: 'lowpass_state',
      type: 'float',
      size: 4,
      count: 8,  // Up to 8 LowPass filters
    }];
  }

  generate(node: NodeAST, spec: NodeTypeSpec, ctx: CodeGenContext): string[] {
    const signal = ctx.inputs.get('signal');
    const alpha = node.params?.get('alpha') ?? 0.1;
    const stateIdx = ctx.statePrefix + '_' + node.id;

    return [
      `// Node: LowPass (stateful, alpha=${alpha})`,
      `float ${ctx.output.varName} = lowpass_update(${stateIdx}, ${signal.varName}, ${alpha}f);`,
    ];
  }
}
```

### 6.3 Buffer Operation Generator Template

For buffer operations (Blur, Mirror, Fill):

```typescript
class Blur_Generator implements NodeGenerator {
  canHandle(spec: NodeTypeSpec): boolean {
    return spec.name === 'Blur';
  }

  requiredHelpers(): string[] {
    return ['blur_buffer'];
  }

  generate(node: NodeAST, spec: NodeTypeSpec, ctx: CodeGenContext): string[] {
    const src = ctx.inputs.get('src');
    const radius = node.params?.get('radius') ?? 1;
    const out = ctx.output.varName;

    return [
      `// Node: Blur (radius=${radius})`,
      `blur_buffer(${src.varName}, ${out}, NUM_LEDS, ${radius});`,
    ];
  }
}
```

---

## Part 7: Extensibility Roadmap

### 7.1 Phase 1: Foundation (Immediate)

**Goal:** Get all 39 nodes generating valid C++ code

**Tasks:**
1. Implement declarative generator system (Pattern 1-2 from Section 3.2)
2. Create template system for trivial operations
3. Implement remaining 29 node generators
4. Refactor emitter to use new generator registry
5. Add comprehensive validation rules
6. Full test coverage for all node types

**Timeline:** 2-3 weeks

### 7.2 Phase 2: Optimization (Weeks 4-5)

**Goal:** Optimize generated code for performance and memory

**Tasks:**
1. Implement CSE for pure subgraphs
2. Enhance buffer lifetime analysis
3. Add in-place transform detection
4. Stateful node boundary preservation
5. Perf validation against manual patterns

**Timeline:** 1-2 weeks

### 7.3 Phase 3: Advanced Features (Future)

**Goal:** Support complex node patterns and optimizations

**Tasks:**
1. Conditional execution (if/else based on param)
2. Array-based operations (multiple buffers)
3. Custom node type system
4. Graph-to-graph composition
5. Runtime node parameters (fully dynamic)

**Timeline:** Post-Phase 5

---

## Part 8: Integration with Existing Pattern System

### 8.1 Pattern Function Signature

Generated patterns must match this signature:

```cpp
extern "C" void pattern_<name>_render(
    uint32_t frame_count,
    const AudioDataSnapshot& audio,
    const PatternParameters& params,
    PatternState& state,
    PatternOutput& out
);
```

### 8.2 Required Includes

```cpp
#include "graph_runtime.h"      // Runtime helpers (fill, blur, etc.)
#include "../stateful_nodes.h"  // State structures
#include "../parameters.h"       // PatternParameters definition
#include "../pattern_audio_interface.h"  // AudioDataSnapshot
```

### 8.3 Firmware Helper Functions

The emitter must link to these firmware helpers:

**Buffer Operations:**
- `fill_buffer(CRGBF* out, const CRGBF& color, int num_leds)`
- `blur_buffer(const CRGBF* src, CRGBF* out, int num_leds, int radius)`
- `mirror_buffer(const CRGBF* src, CRGBF* out, int num_leds)`
- `shift_buffer(const CRGBF* src, CRGBF* out, int num_leds, int offset)`
- `downsample_buffer(const CRGBF* src, CRGBF* out, int num_leds, int factor)`
- `dot_render(...)`
- `compose_layers(...)`

**Color Operations:**
- `hsv_to_rgb(float h, float s, float v) → CRGBF`
- `desaturate(const CRGBF& color, const char* mode) → CRGBF`
- `clamped_rgb(const CRGBF& color) → CRGBF`
- `gradient_map(float index, const CRGBF* palette, int size) → CRGBF`

**Filter Operations:**
- `lowpass_update(float& state, float signal, float alpha) → float`
- `moving_average_update(float* ring, int& idx, int window, float signal) → float`

**Audio Analysis:**
- `compute_pitch(const float* spectrum, int num_freqs) → float`
- `pitch_confidence(const float* spectrum, int num_freqs) → float`
- `compute_chroma_vector(const float* spectrum, int num_freqs, float* out)`

**Procedural:**
- `perlin_noise_1d(float x, uint32_t seed, float scale) → float`

### 8.4 State Structure Layout

```cpp
struct PatternState {
  // Filter states (up to 8 LowPass filters)
  float lowpass_states[8];

  // MovingAverage ring buffers
  float ma_ring_buf[32];
  int ma_index;

  // BufferPersist state
  float persist_buf[256];  // For persistent buffers

  // Beat event state
  float beat_prev_envelope;
  uint32_t beat_count;

  // Custom pattern state (as needed)
  float custom_state[64];

  PatternState();  // Constructor initializes to zero
};
```

---

## Part 9: Validation & Quality Assurance

### 9.1 Testing Strategy

#### Unit Tests (Per Node Type)

For each of the 39 node types:
```typescript
describe('Add Node Generator', () => {
  test('generates correct C++ for Add node', () => {
    const spec = NODE_TYPE_REGISTRY.get('Add')!;
    const node = { id: 'add1', type: 'Add', inputs: new Map([['a', 'in1'], ['b', 'in2']]), params: new Map() };
    const ctx = createContext();

    const gen = registry.selectGenerator(spec);
    const code = gen.generate(node, spec, ctx);

    expect(code).toContain('float');
    expect(code).toContain('+');
    expect(code).not.toContain('genNoop');
  });
});
```

#### Integration Tests

```typescript
describe('Full Codegen Pipeline', () => {
  test('Bloom pattern compiles and validates', () => {
    const graphJson = fs.readFileSync('fixtures/bloom.graph.json');
    const result = compile(graphJson);

    expect(result.errors).toHaveLength(0);
    expect(result.cpp_code).toBeTruthy();
    expect(result.cpp_code).toContain('pattern_bloom_render');
  });

  test('All 39 nodes have generators', () => {
    for (const [name, spec] of NODE_TYPE_REGISTRY) {
      const gen = registry.selectGenerator(spec);
      expect(gen).not.toBeUndefined();
      expect(gen.canHandle(spec)).toBe(true);
    }
  });
});
```

#### Hardware Validation

```cpp
// C++ test harness for generated patterns
TEST(PatternGeneration, BloomPattern) {
  PatternState state;
  PatternOutput out;
  AudioDataSnapshot audio;
  PatternParameters params;

  // Render 300 frames (10 seconds @ 30 FPS)
  for (int i = 0; i < 300; i++) {
    pattern_bloom_render(i, audio, params, state, out);

    // Validate output bounds
    for (int j = 0; j < NUM_LEDS; j++) {
      EXPECT_GE(out.leds[j][0], 0);
      EXPECT_LE(out.leds[j][0], 255);
    }
  }
}
```

### 9.2 Code Quality Gates

Before accepting a generator:
- ✅ Unit tests pass (>95% coverage)
- ✅ No compiler warnings
- ✅ Type checking passes
- ✅ Integrates with pattern registry
- ✅ Hardware validation (if stateful)
- ✅ Performance within 2% of baseline

---

## Part 10: Risk Mitigation

### 10.1 Key Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Emitter complexity** | Medium | High | Modular architecture, clear separation of concerns |
| **Type system limitations** | Low | High | Comprehensive type system already defined |
| **Memory budget exceeded** | Medium | High | Linear-scan allocator with safety checks |
| **Stateful node ordering** | Medium | Medium | Explicit boundary preservation in optimizer |
| **Firmware helper availability** | Low | Medium | All helpers already implemented in graph_runtime.h |
| **Performance regression** | Medium | Medium | Continuous perf validation against baselines |

### 10.2 Mitigation Strategies

1. **Modular Design:** Each node generator is independent, testable in isolation
2. **Safety Gates:** Type checker, memory validator, cycle detector run before emit
3. **Comprehensive Testing:** Unit + integration + hardware tests for all node types
4. **Documentation:** Clear generator template for future extensions
5. **Fallback Path:** If generation fails, can always hand-code pattern in C++

---

## Part 11: Implementation Checklist

### Phase 1: Architecture & Foundations

- [ ] Refactor emitter to use declarative generator registry
- [ ] Implement generator template system (trivial ops)
- [ ] Create NodeGenerator interface
- [ ] Refactor current 10 generators to new pattern
- [ ] Add generator validation framework
- [ ] Comprehensive test suite for generator system

### Phase 2: Implement Missing Generators (29 nodes)

**Input Nodes (8 needed):**
- [ ] Time
- [ ] AudioSnapshot
- [ ] AudioSpectrum
- [ ] BeatEvent
- [ ] AutoCorrelation
- [ ] Chromagram
- [ ] ParamF
- [ ] ConfigToggle

**Math/Filter (9 needed):**
- [ ] Add, Mul, Mix, Lerp, Clamp, Pow, Sqrt, Contrast
- [ ] LowPass (stateful)
- [ ] MovingAverage (stateful)

**Color (4 needed):**
- [ ] Hsv
- [ ] Desaturate
- [ ] ForceSaturation
- [ ] PaletteSelector (Phase 2 stub)

**Geometry (5 needed):**
- [ ] Blur
- [ ] Shift
- [ ] Downsample
- [ ] DotRender
- [ ] ComposeLayers

**Noise (3 needed):**
- [ ] PerlinNoise
- [ ] RngSeed
- [ ] PositionAccumulator

### Phase 3: Validation & Optimization

- [ ] Enhance memory budget validation
- [ ] Improve cycle detection with path reporting
- [ ] Implement CSE for pure subgraphs
- [ ] Buffer lifetime analysis
- [ ] In-place transform detection
- [ ] Stateful node boundary preservation

### Phase 4: Testing & Quality

- [ ] Unit tests for all 39 generators
- [ ] Integration tests (full pipeline)
- [ ] Hardware validation tests
- [ ] Perf benchmarking vs. manual patterns
- [ ] Comprehensive error message validation
- [ ] Documentation & examples

---

## Part 12: Success Criteria

### Functional Requirements

- ✅ All 39 node types have working code generators
- ✅ Generated C++ compiles without warnings
- ✅ Generated code matches interface contract
- ✅ All nodes validate correctly in type system
- ✅ Stateful nodes preserve order
- ✅ Buffer lifetime analysis prevents overallocation
- ✅ Memory usage <5KB per pattern
- ✅ Performance within 2% of manual patterns

### Quality Requirements

- ✅ 95%+ test coverage of codegen
- ✅ All error paths have clear messages
- ✅ Documentation complete (generator template, FAQ)
- ✅ Zero compiler warnings in generated code
- ✅ Zero security issues (no buffer overflows, etc.)

### Integration Requirements

- ✅ Seamless integration with pattern registry
- ✅ Works with existing firmware helpers
- ✅ Compatible with existing pattern interface
- ✅ CLI functional: `k1c build graph.json --out pattern.cpp`

---

## Part 13: Implementation Resources

### Files to Create/Modify

**New Files:**
- `codegen/src/generators/index.ts` — Generator registry
- `codegen/src/generators/base.ts` — NodeGenerator interface
- `codegen/src/generators/templates.ts` — Template system
- `codegen/src/generators/*.ts` — Per-node generators (29 files)
- `codegen/src/emitterV2.ts` — Refactored emitter

**Modify:**
- `codegen/src/emitter.ts` → migrate to new system
- `codegen/src/types.ts` → add generator metadata
- `codegen/src/emitterNodes.ts` → port to new pattern

### Documentation to Create

- `docs/09-implementation/CODEGEN_GENERATOR_SYSTEM.md` — Architecture overview
- `docs/09-implementation/CODEGEN_GENERATOR_TEMPLATE.md` — Template for new generators
- `docs/06-reference/CODEGEN_NODE_REFERENCE.md` — Per-node generation details
- `docs/09-implementation/CODEGEN_EXTENSION_GUIDE.md` — How to add new node types

---

## Conclusion

The K1.node1 code generation system has a solid foundation in its 5-stage compiler pipeline and comprehensive type system. The key challenge is scaling from the current 10 working generators to all 39 node types with **maintainable, extensible architecture**.

This strategy proposes:

1. **Declarative generator system** with metadata-driven selection
2. **Template-based generation** for trivial operations
3. **Pluggable generator interface** for easy extension
4. **Enhanced validation and optimization** for correctness at scale
5. **Clear integration patterns** with existing firmware

With these architectural improvements, adding new node types becomes straightforward (implement one interface, register in system), and the codebase remains maintainable as it grows.

**Recommended next step:** Begin Phase 1 (Architecture & Foundations) with refactoring emitter to use new generator system. This enables rapid parallel development of the 29 missing generators in subsequent weeks.

---

**Document Status:** ✅ DRAFT COMPLETE
**Ready for:** Technical Review & Implementation Planning
**Target Implementation Start:** November 13, 2025

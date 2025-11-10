---
title: Code Generator Implementation Pattern Template
subtitle: Standard Template for Adding New Node Type Generators
version: 1.0
date: 2025-11-10
status: reference
owner: Engineering Team
related:
  - docs/04-planning/K1NPlan_TASK15_CODE_GENERATION_STRATEGY_v1.0_20251110.md
  - docs/06-reference/K1NRef_CODEGEN_NODE_SUPPORT_MATRIX_v1.0_20251110.md
tags: [code-generation, implementation-pattern, template, developer-guide]
---

# Code Generator Implementation Pattern

This document provides the standard template and patterns for implementing new node type generators in the K1.node1 code generation system.

---

## Overview

Each node type requires a **generator class** that implements the `NodeGenerator` interface:

```typescript
interface NodeGenerator {
  // Check if this generator handles the given node spec
  canHandle(spec: NodeTypeSpec): boolean;

  // Generate C++ code for the node
  generate(node: NodeAST, spec: NodeTypeSpec, ctx: CodeGenContext): string[];

  // Optional: Declare state fields for stateful nodes
  declareState?(spec: NodeTypeSpec): StateField[];

  // Optional: List firmware helpers this generator uses
  requiredHelpers?(spec: NodeTypeSpec): string[];

  // Optional: Validate node before generation
  validate?(node: NodeAST, spec: NodeTypeSpec): ValidationError[];
}
```

---

## Pattern 1: Trivial Operations (Zero Custom Code)

### Example: Add Node

```typescript
/**
 * Generator for Add node: a + b
 * Template-based: automatic generation from math operation pattern
 */
export class AddGenerator implements NodeGenerator {
  canHandle(spec: NodeTypeSpec): boolean {
    return spec.name === 'Add';
  }

  generate(node: NodeAST, spec: NodeTypeSpec, ctx: CodeGenContext): string[] {
    // Input port names from spec
    const aPort = spec.inputs[0];  // Should be 'a'
    const bPort = spec.inputs[1];  // Should be 'b'

    // Get variable names from context
    const aVar = ctx.inputs.get('a')?.varName;
    const bVar = ctx.inputs.get('b')?.varName;

    if (!aVar || !bVar) {
      throw new Error(`Add node missing inputs`);
    }

    // Output variable name (allocated by scheduler)
    const outVar = ctx.output.varName;

    return [
      `// Node: Add`,
      `float ${outVar} = ${aVar} + ${bVar};`,
    ];
  }
}
```

### When to Use
- Simple binary operations: Add, Mul, Mix, Pow, etc.
- Parameter access: ParamF, ParamColor, ConfigToggle
- Simple unary operations: Sqrt, Time computation
- **Total effort:** ~20-30 lines of code

### Key Points
1. Extract input variable names from context
2. Generate output variable declaration
3. Emit simple C++ expression
4. Include comment with node name
5. Return array of code lines

---

## Pattern 2: Helper Function Calls

### Example: Hsv Node

```typescript
/**
 * Generator for Hsv node: HSV to RGB conversion
 * Delegates to firmware helper function
 */
export class HsvGenerator implements NodeGenerator {
  canHandle(spec: NodeTypeSpec): boolean {
    return spec.name === 'Hsv';
  }

  generate(node: NodeAST, spec: NodeTypeSpec, ctx: CodeGenContext): string[] {
    // Get input variable names
    const hVar = ctx.inputs.get('h')?.varName;
    const sVar = ctx.inputs.get('s')?.varName;
    const vVar = ctx.inputs.get('v')?.varName;

    if (!hVar || !sVar || !vVar) {
      throw new Error(`Hsv node missing inputs: h=${hVar}, s=${sVar}, v=${vVar}`);
    }

    const outVar = ctx.output.varName;

    return [
      `// Node: Hsv (HSV to RGB conversion)`,
      `CRGBF ${outVar} = hsv_to_rgb(${hVar}, ${sVar}, ${vVar});`,
    ];
  }

  requiredHelpers(): string[] {
    return ['hsv_to_rgb'];
  }

  validate(node: NodeAST, spec: NodeTypeSpec): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!node.inputs.has('h')) {
      errors.push({
        code: 'E1002',
        message: 'Hsv node: missing required input h',
        nodeId: node.id,
      });
    }
    // Check s, v similarly

    return errors;
  }
}
```

### When to Use
- Nodes that call existing firmware helpers
- Examples: Desaturate, Blur, Mirror, Shift, etc.
- **Total effort:** ~30-40 lines of code

### Key Points
1. Get input variable names
2. Call firmware helper with inputs
3. Store result in output variable
4. Declare required helpers in `requiredHelpers()`
5. Implement `validate()` to check required inputs

---

## Pattern 3: Stateful Operations

### Example: LowPass Filter Node

```typescript
/**
 * Generator for LowPass node: 1-pole IIR filter
 * Maintains state across frames
 */
export class LowPassGenerator implements NodeGenerator {
  canHandle(spec: NodeTypeSpec): boolean {
    return spec.name === 'LowPass';
  }

  generate(node: NodeAST, spec: NodeTypeSpec, ctx: CodeGenContext): string[] {
    const signal = ctx.inputs.get('signal')?.varName;
    const alpha = node.params?.get('alpha') ?? 0.1;

    if (!signal) {
      throw new Error(`LowPass node missing signal input`);
    }

    const outVar = ctx.output.varName;

    // State variable allocated by scheduler (e.g., state.lowpass_0)
    const stateVar = ctx.statePrefix + '_' + node.id;

    return [
      `// Node: LowPass (stateful, alpha=${alpha.toFixed(3)}f)`,
      `float ${outVar} = lowpass_update(${stateVar}, ${signal}, ${alpha.toFixed(3)}f);`,
    ];
  }

  declareState(spec: NodeTypeSpec): StateField[] {
    return [{
      name: 'lowpass_state',
      type: 'float',
      size: 4,
      count: 8,  // Support up to 8 LowPass filters per pattern
    }];
  }

  requiredHelpers(): string[] {
    return ['lowpass_update'];
  }

  validate(node: NodeAST, spec: NodeTypeSpec): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate state availability
    if (!node.params?.has('alpha')) {
      // Alpha has default, not an error
    } else {
      const alpha = node.params.get('alpha');
      if (typeof alpha !== 'number' || alpha < 0 || alpha > 1) {
        errors.push({
          code: 'E1006',
          message: `LowPass: alpha must be 0.0-1.0, got ${alpha}`,
          nodeId: node.id,
        });
      }
    }

    return errors;
  }
}
```

### When to Use
- Stateful nodes that maintain state across frames
- Examples: LowPass, MovingAverage, BufferPersist, BeatEvent
- **Total effort:** ~50-60 lines of code

### Key Points
1. Implement `declareState()` to specify state fields
2. Use `ctx.statePrefix` to get state variable name
3. State should be pre-allocated by scheduler
4. Validate parameter ranges in `validate()`
5. Document state requirements clearly

---

## Pattern 4: Buffer Operations

### Example: Blur Node

```typescript
/**
 * Generator for Blur node: spatial box filter convolution
 * Operates on LED buffers
 */
export class BlurGenerator implements NodeGenerator {
  canHandle(spec: NodeTypeSpec): boolean {
    return spec.name === 'Blur';
  }

  generate(node: NodeAST, spec: NodeTypeSpec, ctx: CodeGenContext): string[] {
    const src = ctx.inputs.get('src')?.varName;
    const radius = node.params?.get('radius') ?? 1;
    const out = ctx.output.varName;

    if (!src) {
      throw new Error(`Blur node missing src input`);
    }

    return [
      `// Node: Blur (radius=${radius})`,
      `blur_buffer(${src}, ${out}, NUM_LEDS, ${radius});`,
    ];
  }

  requiredHelpers(): string[] {
    return ['blur_buffer'];
  }

  validate(node: NodeAST, spec: NodeTypeSpec): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!node.inputs.has('src')) {
      errors.push({
        code: 'E1002',
        message: 'Blur node: missing required input src',
        nodeId: node.id,
      });
    }

    // Validate radius parameter
    const radius = node.params?.get('radius');
    if (radius !== undefined) {
      if (typeof radius !== 'number' || radius < 1 || radius > 5) {
        errors.push({
          code: 'E1006',
          message: `Blur: radius must be 1-5, got ${radius}`,
          nodeId: node.id,
        });
      }
    }

    return errors;
  }
}
```

### When to Use
- Buffer operations: Blur, Shift, Downsample, Mirror, Fill, etc.
- Typically call a single firmware helper
- **Total effort:** ~30-40 lines of code

### Key Points
1. Get input buffer from context
2. Get output buffer variable
3. Call firmware helper with parameters
4. Validate parameter ranges
5. Handle optional parameters with defaults

---

## Pattern 5: Complex Operations (Custom Logic)

### Example: DotRender Node

```typescript
/**
 * Generator for DotRender node: Render peak indicators on buffer
 * Complex: parameter arrays, blend modes, multiple inputs
 */
export class DotRenderGenerator implements NodeGenerator {
  canHandle(spec: NodeTypeSpec): boolean {
    return spec.name === 'DotRender';
  }

  generate(node: NodeAST, spec: NodeTypeSpec, ctx: CodeGenContext): string[] {
    const baseOpt = ctx.inputs.get('base_buf');
    const peaksOpt = ctx.inputs.get('peak_indices');
    const colorsOpt = ctx.inputs.get('peak_colors');

    if (!peaksOpt) {
      throw new Error(`DotRender node missing peak_indices input`);
    }

    const mode = node.params?.get('blend_mode') ?? 'add';
    const width = node.params?.get('peak_width') ?? 1;
    const out = ctx.output.varName;

    const code: string[] = [
      `// Node: DotRender (mode=${mode}, width=${width})`,
    ];

    // If no base buffer provided, start with black
    if (!baseOpt) {
      code.push(`CRGBF ${out}[NUM_LEDS];`);
      code.push(`for (int i = 0; i < NUM_LEDS; i++) ${out}[i] = {0.0f, 0.0f, 0.0f};`);
    } else {
      code.push(`memcpy(${out}, ${baseOpt.varName}, sizeof(CRGBF) * NUM_LEDS);`);
    }

    // Render dots
    code.push(`// Render ${width} dots at peak indices`);
    code.push(`for (int peak_idx = 0; peak_idx < NUM_PEAKS; peak_idx++) {`);
    code.push(`  int pos = peak_indices[peak_idx];`);
    code.push(`  if (pos >= 0 && pos < NUM_LEDS) {`);

    if (colorsOpt) {
      code.push(`    CRGBF dot_color = peak_colors[peak_idx];`);
    } else {
      code.push(`    CRGBF dot_color = {1.0f, 1.0f, 1.0f};  // Default: white`);
    }

    // Blend mode dispatch
    switch (mode) {
      case 'replace':
        code.push(`    ${out}[pos] = dot_color;`);
        break;
      case 'add':
        code.push(`    ${out}[pos].r = std::min(1.0f, ${out}[pos].r + dot_color.r);`);
        code.push(`    ${out}[pos].g = std::min(1.0f, ${out}[pos].g + dot_color.g);`);
        code.push(`    ${out}[pos].b = std::min(1.0f, ${out}[pos].b + dot_color.b);`);
        break;
      case 'multiply':
        code.push(`    ${out}[pos].r *= dot_color.r;`);
        code.push(`    ${out}[pos].g *= dot_color.g;`);
        code.push(`    ${out}[pos].b *= dot_color.b;`);
        break;
    }

    code.push(`  }`);
    code.push(`}`);

    return code;
  }

  requiredHelpers(): string[] {
    return ['memcpy'];  // Standard C++ library
  }

  validate(node: NodeAST, spec: NodeTypeSpec): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!node.inputs.has('peak_indices')) {
      errors.push({
        code: 'E1002',
        message: 'DotRender: missing required input peak_indices',
        nodeId: node.id,
      });
    }

    const mode = node.params?.get('blend_mode');
    if (mode && !['add', 'replace', 'multiply'].includes(mode)) {
      errors.push({
        code: 'E1006',
        message: `DotRender: unknown blend_mode ${mode}`,
        nodeId: node.id,
      });
    }

    return errors;
  }
}
```

### When to Use
- Complex operations with multiple code paths
- Conditional logic based on parameters
- Array handling and loops
- Custom blend modes, multiple inputs
- **Total effort:** ~80-100 lines of code

### Key Points
1. Build code array incrementally
2. Handle optional inputs gracefully
3. Use parameter values to dispatch logic
4. Generate efficient inline code
5. Clear validation of parameters

---

## Pattern 6: Template-Based Auto-Generation

For very common patterns, generators can be auto-generated from templates:

```typescript
/**
 * Template system for trivial operations
 * Eliminates boilerplate for common patterns
 */

enum GeneratorTemplate {
  // Scalar operations
  BINARY_OP = 'binary_op',        // a OP b (Add, Mul, etc.)
  UNARY_OP = 'unary_op',          // OP(a) (Sqrt, Sin, etc.)
  TERNARY_OP = 'ternary_op',      // a OP1 b OP2 c (Mix, etc.)

  // Parameter access
  PARAM_ACCESS = 'param_access',  // params.field

  // Helper calls
  HELPER_CALL = 'helper_call',    // helper(a, b, c)
}

interface GeneratorTemplateSpec {
  name: string;
  template: GeneratorTemplate;
  binaryOp?: string;              // '+', '*', etc. for BINARY_OP
  helperName?: string;            // For HELPER_CALL
  paramField?: string;            // For PARAM_ACCESS
}

// Usage: Register template-based generator
const Add_Template: GeneratorTemplateSpec = {
  name: 'Add',
  template: GeneratorTemplate.BINARY_OP,
  binaryOp: '+',
};

// Auto-generates:
class Add_Generator {
  generate(node: NodeAST, spec: NodeTypeSpec, ctx: CodeGenContext): string[] {
    const a = ctx.inputs.get('a')?.varName;
    const b = ctx.inputs.get('b')?.varName;
    const out = ctx.output.varName;
    return [
      `// Node: Add`,
      `float ${out} = ${a} + ${b};`,
    ];
  }
}
```

### Usage
- Reduces code duplication for common patterns
- Automatically generates 10-15 nodes with zero custom code
- **Saves:** ~200-300 lines of generator code

---

## Code Style Guidelines

### 1. Comments
```typescript
// Always comment node name and key parameters
`// Node: LowPass (stateful, alpha=${alpha.toFixed(3)}f)`,
```

### 2. Variable Names
```typescript
// Use descriptive names from context
const signal = ctx.inputs.get('signal')?.varName;
const state = ctx.statePrefix + '_' + node.id;
```

### 3. Type Safety
```typescript
// Check inputs before using
if (!signal) {
  throw new Error(`LowPass node missing signal input`);
}

// Validate parameters
if (typeof alpha !== 'number' || alpha < 0 || alpha > 1) {
  errors.push({...});
}
```

### 4. Memory Safety
```typescript
// Use memcpy for buffer operations, not direct loops
// Use sizeof to ensure correct sizes
memcpy(out, src, sizeof(CRGBF) * NUM_LEDS);
```

### 5. Error Messages
```typescript
// Include code, node ID, and clear description
{
  code: 'E1006',
  message: `${spec.name}: parameter ${name} out of range [${min}, ${max}]`,
  nodeId: node.id,
  severity: 'error',
}
```

---

## Testing Template

```typescript
describe('Add Generator', () => {
  const spec = NODE_TYPE_REGISTRY.get('Add')!;
  const gen = new AddGenerator();

  test('canHandle returns true for Add', () => {
    expect(gen.canHandle(spec)).toBe(true);
  });

  test('generates correct C++ for simple Add', () => {
    const node = {
      id: 'add1',
      type: 'Add',
      inputs: new Map([['a', 'var_a'], ['b', 'var_b']]),
      params: new Map(),
    };
    const ctx = createContext({
      inputs: new Map([
        ['a', { varName: 'var_a', type: PortType.FLOAT }],
        ['b', { varName: 'var_b', type: PortType.FLOAT }],
      ]),
      output: { varName: 'out_add1', type: PortType.FLOAT },
    });

    const code = gen.generate(node, spec, ctx);

    expect(code.length).toBeGreaterThan(0);
    expect(code.join('\n')).toContain('var_a');
    expect(code.join('\n')).toContain('var_b');
    expect(code.join('\n')).toContain('+');
  });

  test('validate reports missing inputs', () => {
    const node = {
      id: 'add2',
      type: 'Add',
      inputs: new Map([['a', 'var_a']]),  // Missing 'b'
      params: new Map(),
    };

    const errors = gen.validate?.(node, spec) || [];

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].code).toBe('E1002');
  });
});
```

---

## Quick Reference Checklist

When implementing a new generator:

- [ ] Class implements `NodeGenerator` interface
- [ ] `canHandle()` checks node name correctly
- [ ] `generate()` returns string[] of C++ lines
- [ ] Input validation in `validate()` method
- [ ] Parameter type checking and bounds validation
- [ ] State fields declared in `declareState()` if stateful
- [ ] Required helpers listed in `requiredHelpers()`
- [ ] Comments explain node purpose and key params
- [ ] Proper error codes (E1001-E1008) used
- [ ] Unit tests written (>95% coverage)
- [ ] No compiler warnings in generated code
- [ ] Generator registered in registry
- [ ] Documentation updated

---

## Common Pitfalls to Avoid

### 1. Forgetting Input Validation
```typescript
// ❌ BAD: Assumes inputs exist
const a = ctx.inputs.get('a')!.varName;

// ✅ GOOD: Checks and throws
const a = ctx.inputs.get('a')?.varName;
if (!a) throw new Error(`Missing input a`);
```

### 2. Not Handling Optional Parameters
```typescript
// ❌ BAD: Crashes on undefined
const radius = node.params.get('radius');
code.push(`blur(src, out, ${radius})`);

// ✅ GOOD: Uses defaults
const radius = node.params?.get('radius') ?? 1;
code.push(`blur(src, out, ${radius})`);
```

### 3. Buffer Size Mismatches
```typescript
// ❌ BAD: Assumes NUM_LEDS
memcpy(out, src, 256 * sizeof(CRGBF));

// ✅ GOOD: Uses constant
memcpy(out, src, NUM_LEDS * sizeof(CRGBF));
```

### 4. Missing State Declaration
```typescript
// ❌ BAD: Uses state without declaring
code.push(`state.filter_state[0] = ...`);

// ✅ GOOD: Declares in declareState()
declareState(): StateField[] {
  return [{ name: 'filter_state', type: 'float', size: 4, count: 8 }];
}
```

### 5. Forgetting Required Helpers
```typescript
// ❌ BAD: Calls helper without declaring
code.push(`blur_buffer(...)`);

// ✅ GOOD: Lists in requiredHelpers()
requiredHelpers(): string[] {
  return ['blur_buffer'];
}
```

---

## Resources

- **Type System:** `codegen/src/types.ts` - NodeTypeSpec definitions
- **Runtime Helpers:** `firmware/src/graph_codegen/graph_runtime.h` - Available helper functions
- **Pattern State:** `firmware/src/stateful_nodes.h` - State struct definitions
- **Examples:** `codegen/src/emitterNodes.ts` - Existing generators

---

**Document Status:** ✅ REFERENCE
**Target Audience:** Engineers implementing new node generators
**Last Updated:** November 10, 2025

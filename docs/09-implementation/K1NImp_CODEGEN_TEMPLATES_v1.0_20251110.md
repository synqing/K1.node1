---
title: Code Generation Template Developer Guide
author: Code Generation Architect
date: 2025-11-10
status: published
scope: Developer reference for creating and extending node type templates
version: 1.0
related:
  - docs/06-reference/K1NRef_ALL_NODE_TYPES_v1.0_20251110.md
  - firmware/src/graph_codegen/full_codegen.cpp
  - ADR-0014-code-generation-strategy.md
---

# Code Generation Template Developer Guide

## Overview

This guide provides practical instructions for creating, testing, and integrating new node type templates into the K1.node1 code generation system. It's intended for engineers extending the system with new node types or modifying existing templates.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Template System](#template-system)
3. [Creating a New Node Type](#creating-a-new-node-type)
4. [Testing Templates](#testing-templates)
5. [Performance Considerations](#performance-considerations)
6. [Common Patterns](#common-patterns)
7. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Code Generation Pipeline

```
JSON Graph Definition
         ↓
[Full Code Generator]
  - Parse and validate
  - Resolve dependencies
  - Apply templates
         ↓
[Template Engine]
  - Handlebars templates
  - Variable substitution
  - State declarations
         ↓
Generated C++ Code
         ↓
[Compiler (GCC -O2)]
         ↓
Native Machine Code (zero-overhead execution)
```

### File Structure

```
firmware/src/graph_codegen/
├── full_codegen.cpp          # Main generator (entry point)
├── node_templates/
│   ├── audio_input.hbs       # Audio input node templates
│   ├── audio_processing.hbs  # Audio processing node templates
│   ├── spatial_transform.hbs # Spatial transform node templates
│   ├── color_operation.hbs   # Color operation node templates
│   ├── state_management.hbs  # State management node templates
│   ├── math_logic.hbs        # Math/logic node templates
│   ├── utility.hbs           # Utility node templates
│   └── output.hbs            # Output node templates
├── README.md                  # Quick start guide
└── test/
    ├── test_all_node_types.cpp    # Comprehensive test suite
    ├── graphs/
    │   ├── spectrum_graph.json     # Example graph
    │   └── bloom_graph.json        # Example graph
    └── expected/
        ├── spectrum_expected.h     # Validation reference
        └── bloom_expected.h        # Validation reference
```

---

## Template System

### Handlebars Template Syntax

The code generator uses **Handlebars** templating for code generation. Key syntax:

```handlebars
// Variables
{{variable_name}}

// Conditionals
{{#if condition}}
  // Code if true
{{else}}
  // Code if false
{{/if}}

// Loops
{{#each array}}
  {{this}}
{{/each}}

// Nested property access
{{parent.child}}

// Comments
{{! This is a comment }}
```

### Node Definition Structure (JSON)

```json
{
  "id": "unique_node_id",
  "type": "node_type_id",
  "name": "Human-readable name",
  "description": "What this node does",
  "inputs": ["input1", "input2"],
  "outputs": ["output1", "output2"],
  "parameters": {
    "param1": "default_value",
    "param2": {
      "default": "value",
      "type": "string|float|int|bool",
      "range": [0, 1]
    }
  }
}
```

### Template File Structure

Each template file contains Handlebars templates for all node types in a category:

```handlebars
{{! ============================================================ }}
{{! Audio Input Nodes }}
{{! ============================================================ }}

{{#defineBlock 'audio_microphone'}}
  // Microphone template code
  float {{output}} = AUDIO_SAMPLE_RAW[0];
{{/defineBlock}}

{{#defineBlock 'audio_fft'}}
  // FFT template code
  // Complex implementation
{{/defineBlock}}
```

---

## Creating a New Node Type

### Step 1: Define the Node Type

Add the node type to the registry in `full_codegen.cpp`:

```cpp
NodeTypeDefinition new_node = {
    .type_id = "category_node_name",          // e.g., "spatial_translate"
    .category = NodeCategory::SPATIAL_TRANSFORM,
    .description = "What the node does",
    .inputs = {"input1", "input2"},           // Input variable names
    .outputs = {"output"},                    // Output variable names
    .memory_bytes = 256,                      // Pre-allocated state (0 if stateless)
    .template_name = "spatial_translate",
    .has_state = false                        // true if stateful
};

// Add to NODE_REGISTRY
NODE_REGISTRY.push_back(new_node);
```

### Step 2: Create the Node Template

Create or edit the appropriate template file in `firmware/src/graph_codegen/node_templates/`:

**Example: Spatial Translate (stateless)**

```handlebars
{{#defineBlock 'spatial_translate'}}
// Spatial node: Translation (offset)
{{translated}}[0] = {{position}}[0] + {{offset_x}};
{{translated}}[1] = {{position}}[1] + {{offset_y}};

// Clamp to bounds if requested
if ({{clamp_enabled}}) {
    {{translated}}[0] = fmaxf(0.0f, fminf(1.0f, {{translated}}[0]));
    {{translated}}[1] = fmaxf(0.0f, fminf(1.0f, {{translated}}[1]));
}
{{/defineBlock}}
```

**Example: State Buffer Persist (stateful)**

```handlebars
{{#defineBlock 'state_buffer_persist'}}
// State node: Float Buffer Persistence with decay
static float {{node_id}}_state[{{buffer_size}}] = {0.0f};

// Decay existing state
for (int i = 0; i < {{buffer_size}}; i++) {
    {{node_id}}_state[i] *= {{decay}};
}

// Accumulate input (find maximum per position)
for (int i = 0; i < {{buffer_size}}; i++) {
    {{node_id}}_state[i] = fmaxf({{node_id}}_state[i], {{input}}[i]);
}

// Output state
for (int i = 0; i < {{buffer_size}}; i++) {
    {{state}}[i] = {{node_id}}_state[i];
}
{{/defineBlock}}
```

### Step 3: Add Validation Rules

Update the `validate_data_flow()` method to check node-specific constraints:

```cpp
bool validate_node_specific(const json& node) {
    std::string type_id = node["type"].get<std::string>();

    if (type_id == "spatial_translate") {
        // Check that position input exists
        if (!node.contains("inputs") || node["inputs"].size() < 1) {
            std::cerr << "spatial_translate requires 'position' input\n";
            return false;
        }

        // Check that parameters are valid
        if (node.contains("parameters")) {
            auto params = node["parameters"];
            if (params.contains("offset_x")) {
                float offset = params["offset_x"].get<float>();
                if (offset < -2.0f || offset > 2.0f) {
                    std::cerr << "offset_x must be in range [-2.0, 2.0]\n";
                    return false;
                }
            }
        }
    }

    return true;
}
```

### Step 4: Write Unit Tests

Create test cases in `firmware/test/test_full_codegen/test_all_node_types.cpp`:

```cpp
TestResult test_spatial_translate_custom() {
    TestResult result("SpatialTranslateCustom");
    try {
        float pos[2] = {0.5f, 0.5f};
        float offset[2] = {0.1f, 0.2f};

        // Apply translation
        float result_pos[2] = {
            pos[0] + offset[0],
            pos[1] + offset[1]
        };

        // Expected: {0.6, 0.7}
        assert(std::fabs(result_pos[0] - 0.6f) < 0.0001f);
        assert(std::fabs(result_pos[1] - 0.7f) < 0.0001f);

    } catch (...) {
        result.fail("Custom translation test failed");
    }
    return result;
}
```

### Step 5: Test Code Generation

Create a JSON graph that uses your new node type:

```json
{
  "pattern": {
    "name": "test_pattern",
    "version": "1.0"
  },
  "nodes": [
    {
      "id": "translate1",
      "type": "spatial_translate",
      "inputs": "position",
      "parameters": {
        "offset_x": 0.1,
        "offset_y": 0.2
      },
      "outputs": "translated_pos"
    }
  ]
}
```

Run the generator:

```bash
cd firmware/src/graph_codegen
g++ -std=c++17 full_codegen.cpp -o full_codegen
./full_codegen test_pattern.json > generated.h
```

### Step 6: Validate Generated Code

Check the generated output for correctness:

```cpp
// Look for expected patterns in generated.h:
// - Correct function signature
// - State declarations (if stateful)
// - All input references resolved
// - All outputs declared
```

---

## Testing Templates

### Unit Test Structure

```cpp
TestResult test_node_type_custom() {
    TestResult result("NodeTypeCustom");
    try {
        // 1. Setup: Initialize inputs and state
        float input_value = 0.5f;

        // 2. Execute: Run node logic
        float output_value = process_node(input_value);

        // 3. Verify: Check results match expectations
        assert(output_value >= 0.0f && output_value <= 1.0f);

        // 4. Additional checks
        assert(std::fabs(output_value - expected) < tolerance);

    } catch (...) {
        result.fail("Custom test description");
    }
    return result;
}
```

### Integration Test Pattern

```cpp
TestResult test_node_in_pattern_context() {
    TestResult result("NodeInPatternContext");
    try {
        // Set up realistic pattern execution
        PatternParameters params = {...};
        current_audio.available = true;
        current_audio.fresh = true;

        // Execute multiple nodes together
        float audio_in = 0.8f;
        float filtered = apply_filter(audio_in);
        CRGBF color = get_color(filtered);
        leds[45] = color;

        // Verify end-to-end result
        assert(leds[45].r >= 0.0f);

    } catch (...) {
        result.fail("Pattern context test failed");
    }
    return result;
}
```

### Performance Testing

```cpp
// Add to test suite
TestResult test_node_performance_benchmark() {
    TestResult result("NodePerformanceBenchmark");
    try {
        // Simulate 1000 frames
        auto start = std::chrono::high_resolution_clock::now();

        for (int frame = 0; frame < 1000; frame++) {
            // Execute node operation
            process_node(0.5f);
        }

        auto end = std::chrono::high_resolution_clock::now();
        double elapsed_ms = std::chrono::duration<double, std::milli>(
            end - start).count();

        // Expect: <1.0 ms for 1000 frames (1 µs per execution)
        assert(elapsed_ms < 1.0);

    } catch (...) {
        result.fail("Performance target not met");
    }
    return result;
}
```

---

## Performance Considerations

### Memory Guidelines

**Node Memory Categories:**

1. **Stateless nodes (0 bytes):** Math, conditionals, simple transforms
   - Example: `math_add`, `spatial_rotate`, `color_multiply`
   - No state allocation needed

2. **Light state (4-64 bytes):** Simple accumulators, phase tracking
   - Example: `state_counter`, `audio_rms`, `state_gate`
   - Single float or small struct

3. **Medium state (128-512 bytes):** Lookup tables, filter coefficients
   - Example: `audio_filter`, `color_gradient`, `math_lookup`
   - Moderate buffer allocation

4. **Heavy state (512+ bytes):** Full audio buffers, color arrays
   - Example: `state_buffer_persist`, `audio_delay`, `audio_fft`
   - Pre-allocated, never dynamically allocated

**System Constraint:** Total per-pattern state ≤ 12 KB

### Performance Optimization Checklist

- [ ] No dynamic memory allocation (malloc/new)
- [ ] No floating-point exceptions or NaN checks in hot path
- [ ] Use `static` arrays, not function-local or heap
- [ ] Prefer `float` over `double` (32-bit is faster on microcontroller)
- [ ] Avoid branches in inner loops (use SIMD-friendly math)
- [ ] Pre-compute constants, don't calculate in loop
- [ ] Use `std::fmin`, `std::fmax` instead of ternary operators

### Code Generation Output Size

**Target:** <2% overhead vs. hand-written equivalent

**Measurement:**
```bash
# Compile generated code
g++ -std=c++17 -O2 -c generated_pattern.h

# Check object file size
ls -lh generated_pattern.o  # Should be <5KB for typical pattern

# Compare with hand-written
g++ -std=c++17 -O2 -c hand_written.h
# Similar size indicates good optimization
```

---

## Common Patterns

### Pattern 1: Buffer with Decay

**Use Case:** Bloom trails, persistence effects, velocity tracking

**Template:**
```cpp
static float {{node_id}}_buffer[{{size}}] = {0.0f};

// Decay and inject
for (int i = 0; i < {{size}}; i++) {
    {{node_id}}_buffer[i] *= {{decay}};
}

// Inject input energy at specific locations
for (int i = 0; i < {{input_size}}; i++) {
    {{node_id}}_buffer[i] = fmaxf({{node_id}}_buffer[i], {{input}}[i]);
}

// Output decayed buffer
for (int i = 0; i < {{size}}; i++) {
    {{output}}[i] = {{node_id}}_buffer[i];
}
```

### Pattern 2: Exponential Moving Average

**Use Case:** Smoothing, envelope detection, beat tracking

**Template:**
```cpp
static float {{node_id}}_smoothed = 0.0f;
float {{smoothing_factor}} = {{alpha}};

{{node_id}}_smoothed = {{node_id}}_smoothed * {{smoothing_factor}} +
                       {{input}} * (1.0f - {{smoothing_factor}});

{{output}} = {{node_id}}_smoothed;
```

### Pattern 3: Threshold-based Gate

**Use Case:** Energy gating, beat detection, attack detection

**Template:**
```cpp
static bool {{node_id}}_state = false;

if ({{input}} > {{threshold}}) {
    {{node_id}}_state = true;
} else if ({{input}} < {{threshold}} * {{hysteresis}}) {
    {{node_id}}_state = false;
}

{{output}} = {{node_id}}_state;
```

### Pattern 4: Circular Buffer

**Use Case:** Delay lines, history buffers, phase accumulation

**Template:**
```cpp
static float {{node_id}}_buffer[{{size}}] = {0.0f};
static int {{node_id}}_write_pos = 0;

int delay_samples = {{delay_samples}};
int read_pos = ({{node_id}}_write_pos - delay_samples + {{size}}) % {{size}};

{{output}} = {{node_id}}_buffer[read_pos];

{{node_id}}_buffer[{{node_id}}_write_pos] = {{input}};
{{node_id}}_write_pos = ({{node_id}}_write_pos + 1) % {{size}};
```

### Pattern 5: Gradient Interpolation

**Use Case:** Color mapping, response curves, frequency-to-position mapping

**Template:**
```cpp
static CRGBF {{node_id}}_gradient[] = {
    {{#each gradient_colors}}
    CRGBF({{this.r}}, {{this.g}}, {{this.b}}),
    {{/each}}
};

int idx = (int)({{position}} * ({{gradient_size}} - 1));
idx = fmaxf(0, fminf({{gradient_size}} - 2, idx));
float frac = {{position}} * ({{gradient_size}} - 1) - idx;

CRGBF c1 = {{node_id}}_gradient[idx];
CRGBF c2 = {{node_id}}_gradient[idx + 1];

{{output}}.r = c1.r * (1.0f - frac) + c2.r * frac;
{{output}}.g = c1.g * (1.0f - frac) + c2.g * frac;
{{output}}.b = c1.b * (1.0f - frac) + c2.b * frac;
```

---

## Troubleshooting

### Issue: Generated Code Doesn't Compile

**Symptom:** Compiler errors in generated code

**Diagnosis Steps:**
1. Check node type is registered in `NODE_REGISTRY`
2. Verify template syntax (Handlebars `{{ }}` vs. `{{{ }}}`)
3. Look for missing headers in `generate_includes()`
4. Verify variable names match between template and node definition

**Fix:**
```cpp
// Ensure required includes are present
out << "#include <cmath>\n";
out << "#include <algorithm>\n";

// Verify function signatures
assert(graph_["nodes"].size() > 0);
```

### Issue: Generated Code Runs But Produces Wrong Output

**Symptom:** Logic error in generated code

**Diagnosis Steps:**
1. Compare generated code with hand-written reference
2. Check parameter values are substituted correctly
3. Verify input/output variable names are resolved
4. Test template in isolation before integration

**Fix:**
```cpp
// Add debug output to generated code
std::cout << "// DEBUG: node variable = " << var << "\n";

// Manually trace through template logic
// Check buffer boundaries and array indices
```

### Issue: State Initialization Doesn't Reset on Pattern Change

**Symptom:** State persists when switching patterns

**Diagnosis Steps:**
1. Verify `reset_on_pattern_change` parameter
2. Check pattern registry is correctly detecting pattern changes
3. Ensure `get_current_pattern_id()` is available

**Fix:**
```cpp
// Add pattern change guard to stateful nodes
static uint8_t {{node_id}}_last_pattern_id = 255;

if (get_current_pattern_id() != {{node_id}}_last_pattern_id) {
    // Reset state
    memset({{node_id}}_buffer, 0, sizeof({{node_id}}_buffer));
    {{node_id}}_last_pattern_id = get_current_pattern_id();
}
```

### Issue: Template Variables Not Substituting

**Symptom:** Generated code contains `{{variable}}` literals

**Diagnosis Steps:**
1. Check variable name matches node definition
2. Verify Handlebars syntax (no spaces: `{{var}}` not `{{ var }}`)
3. Check parameter names in JSON are lowercase

**Fix:**
```json
{
  "id": "node1",
  "type": "audio_filter",
  "parameters": {
    "cutoff_hz": 1000,     // lowercase
    "resonance": 1.0       // lowercase
  }
}
```

### Issue: Performance Regression After Template Change

**Symptom:** Generated code slower than expected

**Diagnosis Steps:**
1. Compile with `-O2` optimization enabled
2. Compare instruction count with original
3. Check for loop unrolling issues
4. Profile with `perf` or `gprof`

**Fix:**
```cpp
// Use compiler pragmas to force optimization
#pragma GCC optimize("O3")

// Inline small functions
inline float fast_lerp(float a, float b, float t) {
    return a + (b - a) * t;
}
```

---

## Best Practices

### Documentation

1. **Every node type needs:**
   - Clear input/output contracts
   - Parameter descriptions with ranges
   - Example JSON usage
   - Performance characteristics

2. **Generated code should include comments:**
   ```cpp
   // Node: audio_filter
   // Type: IIR Butterworth lowpass
   // Cutoff: 1000 Hz, Resonance: 1.0
   ```

### Validation

1. **Always validate:**
   - Node type is registered
   - Inputs reference valid outputs
   - Parameters are within safe ranges
   - Buffer sizes are consistent
   - No circular dependencies

2. **Use assertions:**
   ```cpp
   assert(buffer_size > 0);
   assert(decay >= 0.0f && decay <= 1.0f);
   ```

### Testing

1. **Test in isolation:**
   - Unit test each node type
   - Mock dependencies

2. **Test in context:**
   - Integration tests with multiple nodes
   - Real pattern execution

3. **Benchmark:**
   - Performance per node type
   - Total pattern overhead
   - Memory footprint

---

## References

- **Node Type Reference:** `docs/06-reference/K1NRef_ALL_NODE_TYPES_v1.0_20251110.md`
- **Code Generator Source:** `firmware/src/graph_codegen/full_codegen.cpp`
- **Test Suite:** `firmware/test/test_full_codegen/test_all_node_types.cpp`
- **Architecture Decision:** `docs/02-adr/ADR-0014-code-generation-strategy.md`
- **Handlebars Documentation:** https://handlebarsjs.com/guide/

---

**Document Status:** Published (ready for development)
**Last Updated:** 2025-11-10
**Version:** 1.0


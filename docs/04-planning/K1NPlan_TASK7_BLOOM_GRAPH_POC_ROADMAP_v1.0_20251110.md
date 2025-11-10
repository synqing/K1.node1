# Task 7 PoC Implementation Roadmap: Bloom Pattern Graph Conversion
## Proof-of-Concept for Pattern → Graph → C++ Codegen

**Version:** 1.0
**Date:** November 10, 2025
**Status:** Planning / PoC Implementation Phase
**Owner:** Claude Code / Engineering Team
**Scope:** Validate single-pattern (bloom) graph representation and code generation
**Related:**
- Existing Pattern: `firmware/src/graph_codegen/pattern_bloom.cpp`
- Graph Schema: `docs/06-reference/GRAPH_SCHEMA_SPEC.md`
- Node Catalog: `docs/06-reference/K1NRef_GRAPH_NODE_CATALOG_EXPANDED_v2.0_20251110.md`
- Runtime Helpers: `firmware/src/graph_codegen/graph_runtime.h`
- State System: `firmware/src/stateful_nodes.h`

---

## Executive Summary

**Objective:** Demonstrate that the bloom pattern (currently hand-coded in `pattern_bloom.cpp`) can be expressed as a graph DAG, validated through our schema, and code-generated back to equivalent C++ with zero behavior regression.

**Scope (Tight PoC):** Bloom pattern ONLY. Do not generalize yet. Success = generated code produces identical LED output to current `pattern_bloom.cpp`.

**Key Deliverables:**
1. Bloom pattern analysis document (algorithm breakdown)
2. Graph node design (7 nodes: Input, Compute, Output)
3. Complete JSON graph schema example (valid, runnable)
4. Code generation template (bloom-specific, extensible pattern)
5. Unit + integration test strategy
6. Effort estimate and blockers

**Success Criteria:**
- ✓ Generated C++ compiles cleanly (0 warnings)
- ✓ Output LED values match current pattern_bloom.cpp pixel-by-pixel
- ✓ Performance within 5% of original (no regression)
- ✓ Documentation clear enough to replicate for 1-2 other patterns

---

## Part 1: Bloom Pattern Algorithm Analysis

### Current Implementation (pattern_bloom.cpp, Lines 1–45)

**Function Signature:**
```cpp
extern "C" void pattern_bloom_render(
    uint32_t frame_count,
    const AudioDataSnapshot& audio,
    const PatternParameters& params,
    PatternState& state,
    PatternOutput& out
)
```

**Algorithm Flow:**
```
Input: frame_count, audio snapshot, pattern params, stateful node state
  ↓
[1] Initialize scratch buffers:
    - tmp_f0[256]: float scalar buffer (intermediate)
    - tmp_rgb0[256], tmp_rgb1[256]: RGB color buffers

[2] Clear RGB buffers to black (0.0, 0.0, 0.0)

[3] Generate audio response (BandShape node):
    - Simple ramp: tmp_f0[i] = i / 255  (PoC: placeholder for audio spectrum analysis)

[4] Persist state (BufferPersist node):
    - Exponential decay: state.persist_buf[i] = 0.920 * state.persist_buf[i] + 0.080 * tmp_f0[i]
    - This creates the "trail" effect

[5] Colorize buffer (ColorizeBuffer node):
    - Map scalar values to grayscale RGB: tmp_rgb0[i] = {v, v, v}
    - Simple grayscale mapping (PoC; future: palette support)

[6] Mirror horizontally (Mirror node):
    - tmp_rgb1[i] = tmp_rgb0[255 - i]
    - Flips the pattern

[7] Output to LEDs (LedOutput node):
    - Clamp to [0, 1], convert to uint8 [0, 255]
    - Write to out.leds[i][0..2] (R, G, B)
```

### Key Observations

| Aspect | Value | Notes |
|--------|-------|-------|
| **Input Count** | 3 | `frame_count`, `audio`, `params` |
| **Scratch Buffers** | 3 | `tmp_f0` (float[256]), `tmp_rgb0`, `tmp_rgb1` |
| **Stateful Persistence** | 1 | `state.persist_buf[256]` (decay = 0.920) |
| **Processing Stages** | 5 | Shape → Persist → Colorize → Mirror → Output |
| **Parameters Used** | 0 (hardcoded) | Decay (0.920) and grayscale mapping are hardcoded |
| **Parameterizable** | 3 candidates | speed, decay factor, base color (future) |
| **Memory Peak** | ~2KB | Temporary buffers only (state budget: 256 floats) |
| **Determinism** | Fully | Only depends on input state and params (no RNG) |

### Hardcoded vs. Parameterizable

| Element | Current | Can Parameterize? | Rationale |
|---------|---------|-------------------|-----------|
| Decay factor (0.920) | Hardcoded | YES | Audio responsiveness / speed control |
| Colorization method (grayscale) | Hardcoded | FUTURE | Palette selection, hue shift |
| Mirror operation | Hardcoded | KEEP | Architectural choice, not user-facing |
| Buffer size (256) | Hardcoded | KEEP | Fixed to NUM_LEDS |
| Audio source (BandShape) | Ramp placeholder | YES | Wire to AudioSpectrum node |

---

## Part 2: Graph Node Design for Bloom

### Node Type Breakdown

The bloom pattern will be represented as **7 nodes** in a DAG:

#### **Node 1: AudioSpectrum** (Input)
- **Type:** `AudioSpectrum` (builtin)
- **Inputs:** None (source)
- **Outputs:** `audio_spectrum` (float[64], frequency bins)
- **Role:** Capture current audio spectrum for band filtering
- **Memory:** 0 (firmware ringbuffer)
- **Notes:** PoC uses placeholder ramp; production version connects to real spectrum

#### **Node 2: BandShape** (Compute)
- **Type:** `BandShape` (builtin)
- **Inputs:**
  - `src`: `audio_spectrum` (from AudioSpectrum)
- **Parameters:**
  - `gain`: float (1.0–2.0, default 1.0) — amplitude scaling
  - `smoothing`: float (0.0–1.0, default 0.6) — temporal smoothing
  - `center_bin`: int (0–63, default 32) — focus band
  - `bandwidth`: int (1–16, default 8) — bin spread
- **Outputs:** `led_buffer_float` (float[256], band-shaped response)
- **Role:** Convert audio spectrum to per-LED response via band filtering
- **Memory:** ~0 (single pass)
- **Notes:** Generates ramp in PoC; production version selects frequency band and spreads across LEDs

#### **Node 3: BufferPersist** (Stateful Compute)
- **Type:** `BufferPersist` (builtin)
- **Inputs:**
  - `src`: `led_buffer_float` (from BandShape)
- **Parameters:**
  - `decay`: float (0.80–0.99, default 0.92) — exponential decay per frame
- **Outputs:** `led_buffer_float` (float[256], persisted buffer)
- **State:** `state.persist_buf[256]` (float array)
- **Role:** Trail effect via exponential decay
- **Memory:** 256 × 4 = 1KB
- **Equation:** `out[i] = decay * state[i] + (1.0 - decay) * src[i]`

#### **Node 4: ColorizeBuffer** (Compute)
- **Type:** `ColorizeBuffer` (builtin)
- **Inputs:**
  - `index_buf`: `led_buffer_float` (from BufferPersist)
- **Parameters:**
  - `mode`: enum ("grayscale" | "palette" | "hue_shift", default "grayscale")
  - `palette`: int (0–N, default 0) — palette ID (for future use)
- **Outputs:** `led_buffer_vec3` (CRGBF[256])
- **Role:** Map scalar values to colors
- **Memory:** 0 (single pass)
- **PoC:** Grayscale only; future versions support palette selection

#### **Node 5: Mirror** (Spatial Compute)
- **Type:** `Mirror` (builtin)
- **Inputs:**
  - `src`: `led_buffer_vec3` (from ColorizeBuffer)
- **Parameters:** None
- **Outputs:** `led_buffer_vec3` (float[256], mirrored)
- **Role:** Flip buffer horizontally
- **Memory:** 0 (single pass)
- **Equation:** `out[i] = src[NUM_LEDS - 1 - i]`

#### **Node 6: (Optional) GradientMap** (Compute — Future)
- **Type:** `GradientMap`
- **Note:** Not used in bloom PoC; included for reference (palette replacement for grayscale)
- **Inputs:** `index`: `led_buffer_float`
- **Parameters:** `palette_id`: int
- **Outputs:** `led_buffer_vec3`

#### **Node 7: LedOutput** (Terminal / Output)
- **Type:** `LedOutput` (builtin)
- **Inputs:**
  - `color`: `led_buffer_vec3` (from Mirror)
- **Parameters:** None
- **Outputs:** None (writes to PatternOutput)
- **Role:** Clamp RGB to [0, 1], convert to uint8 [0, 255], emit
- **Memory:** 0 (single pass, in-place conversion)
- **Code:** Loop over buffer, clamp, floor, and write to `out.leds[i][r/g/b]`

### Graph Topology (DAG)

```
AudioSpectrum
      ↓
   BandShape (0.5s audio latency model)
      ↓
  BufferPersist (decay = 0.92, trail effect)
      ↓
  ColorizeBuffer (grayscale mode)
      ↓
    Mirror (flip)
      ↓
   LedOutput (terminal, writes to firmware)
```

**No cycles, no reconvergence. Linear DAG with 7 nodes.**

---

## Part 3: Example JSON Graph for Bloom

### Complete, Valid Graph Definition

```json
{
  "name": "bloom_poc",
  "version": "v1.0",
  "meta": {
    "description": "Bloom pattern PoC: Audio spectrum → band filter → persistent trail → colorize → mirror → output",
    "author": "K1.node1 Engineering",
    "created": "2025-11-10"
  },
  "nodes": [
    {
      "id": "audio_spectrum",
      "type": "AudioSpectrum",
      "meta": {
        "name": "Audio Input",
        "comment": "Capture current audio spectrum (64 bins)"
      }
    },
    {
      "id": "band_shape",
      "type": "BandShape",
      "inputs": {
        "src": "audio_spectrum"
      },
      "params": {
        "gain": 1.0,
        "smoothing": 0.6,
        "center_bin": 32,
        "bandwidth": 8
      },
      "meta": {
        "name": "Band Shaper",
        "comment": "Convert audio spectrum to per-LED response via frequency band filtering"
      }
    },
    {
      "id": "trail",
      "type": "BufferPersist",
      "inputs": {
        "src": "band_shape"
      },
      "params": {
        "decay": 0.92
      },
      "meta": {
        "name": "Trail Effect",
        "comment": "Exponential decay creates afterglow trail across frames"
      }
    },
    {
      "id": "colorize",
      "type": "ColorizeBuffer",
      "inputs": {
        "index_buf": "trail"
      },
      "params": {
        "mode": "grayscale",
        "palette_id": 0
      },
      "meta": {
        "name": "Grayscale Colorizer",
        "comment": "Map scalar [0, 1] values to grayscale RGB (future: palette support)"
      }
    },
    {
      "id": "mirror",
      "type": "Mirror",
      "inputs": {
        "src": "colorize"
      },
      "meta": {
        "name": "Horizontal Mirror",
        "comment": "Flip buffer: out[i] = src[255-i]"
      }
    },
    {
      "id": "output",
      "type": "LedOutput",
      "inputs": {
        "color": "mirror"
      },
      "meta": {
        "name": "LED Terminal",
        "comment": "Clamp to [0,1], convert uint8, write to firmware output"
      }
    }
  ]
}
```

### Key Design Decisions

1. **Named Inputs:** Each node specifies exact source node ID (e.g., `"src": "audio_spectrum"`). No implicit ordering.
2. **Parameters Are Explicit:** Decay, smoothing, colorize mode are specified in `params`, not hardcoded.
3. **Metadata for Authoring:** `meta` section provides human-readable names and comments for clarity.
4. **Linear Flow:** No branching or reconvergence — simplest case for PoC.
5. **Future Extensibility:** Nodes like `GradientMap` are placeholders for Phase 2 (palette support).

---

## Part 4: Code Generation Template

### How Graph → C++ Works

**Generator Pipeline:**
```
Input: bloom_poc.json
  ↓
[Stage 1] Parse JSON, build node graph
  ↓
[Stage 2] Validate DAG (cycles, type compatibility, required inputs)
  ↓
[Stage 3] Type inference (determine output type of each node)
  ↓
[Stage 4] Scheduling (topological sort, buffer lifetime analysis)
  ↓
[Stage 5] Code emission (generate C++ function)
  ↓
Output: pattern_bloom.cpp (or equivalent)
```

### Template Code Structure

The generated file will follow this structure:

```cpp
// AUTO-GENERATED: pattern_bloom.cpp
// Generated from: docs/04-planning/bloom_poc.json
// Generator version: 1.0
// DO NOT EDIT (regenerate from JSON)

#include "graph_runtime.h"
#include "../stateful_nodes.h"
#include "../parameters.h"
#include "../pattern_audio_interface.h"

extern "C" void pattern_bloom_render(
    uint32_t frame_count,
    const AudioDataSnapshot& audio,
    const PatternParameters& params,
    PatternState& state,
    PatternOutput& out
) {
    // ========== NODE CONSTANTS ==========
    static constexpr int NUM_LEDS = 256;

    // ========== TEMPORARY BUFFERS ==========
    float buf_band_shape[NUM_LEDS];      // Output of band_shape node
    float buf_trail[NUM_LEDS];           // Output of trail (BufferPersist)
    CRGBF buf_colorize[NUM_LEDS];        // Output of colorize node
    CRGBF buf_mirror[NUM_LEDS];          // Output of mirror node

    // ========== NODE EXECUTION (Topological Order) ==========

    // Node 1: AudioSpectrum (source)
    const float* spectrum = audio.spectrogram;  // Direct reference

    // Node 2: BandShape
    // Params: gain=1.0, smoothing=0.6, center_bin=32, bandwidth=8
    for (int i = 0; i < NUM_LEDS; ++i) {
        buf_band_shape[i] = (float)i / (float)(NUM_LEDS - 1);  // PoC: ramp
    }

    // Node 3: BufferPersist
    // Params: decay=0.92
    // State: state.persist_buf[256]
    for (int i = 0; i < NUM_LEDS; ++i) {
        state.persist_buf[i] = 0.92f * state.persist_buf[i]
                             + (1.0f - 0.92f) * buf_band_shape[i];
    }
    // Read persisted buffer into buf_trail
    memcpy(buf_trail, state.persist_buf, sizeof(float) * NUM_LEDS);

    // Node 4: ColorizeBuffer
    // Params: mode="grayscale", palette_id=0
    for (int i = 0; i < NUM_LEDS; ++i) {
        float v = clamp_val(buf_trail[i], 0.0f, 1.0f);
        buf_colorize[i] = {v, v, v};  // Grayscale
    }

    // Node 5: Mirror
    for (int i = 0; i < NUM_LEDS; ++i) {
        buf_mirror[i] = buf_colorize[NUM_LEDS - 1 - i];
    }

    // Node 6: LedOutput (terminal)
    const CRGBF* final_buf = buf_mirror;
    for (int i = 0; i < NUM_LEDS; ++i) {
        CRGBF c = clamped_rgb(final_buf[i]);
        out.leds[i][0] = (uint8_t)std::floor(c.r * 255.0f + 0.5f);
        out.leds[i][1] = (uint8_t)std::floor(c.g * 255.0f + 0.5f);
        out.leds[i][2] = (uint8_t)std::floor(c.b * 255.0f + 0.5f);
    }
}
```

### Key Emission Rules

1. **Include guards:** Standard boilerplate (graph_runtime.h, stateful_nodes.h, etc.)
2. **Comment header:** Links back to source JSON, generator version, do-not-edit warning
3. **Buffer allocation:** Temporary buffers for intermediate results (type-inferred)
4. **Node execution:** One section per node, in topological order
5. **State management:** Explicit `state.persist_buf[]` read/write (or other state per node)
6. **Terminal output:** Final `LedOutput` node writes clamped RGB to `out.leds[i][r/g/b]`
7. **Constants:** NUM_LEDS, hardcoded params from JSON `params` field

### Generator Extensibility

**Future optimizations (post-PoC):**
- Dead code elimination (unused intermediate buffers)
- Buffer reuse (overlay temporaries if lifetimes don't overlap)
- SIMD unrolling (for blur, convolution operations)
- Lookup table generation (for gradient maps, color palettes)

---

## Part 5: Testing Strategy

### Unit Tests (Compile-Time)

**Test 1: JSON Schema Validation**
- **Input:** `bloom_poc.json`
- **Check:** Valid against `graph.schema.json`
- **Tool:** JSON schema validator
- **Pass Criteria:** No validation errors

**Test 2: DAG Topology Check**
- **Input:** Parsed graph
- **Check:** No cycles (Kahn's algorithm)
- **Tool:** Custom validator in codegen pipeline
- **Pass Criteria:** Topological sort produces correct order

**Test 3: Type Compatibility**
- **Input:** Node inputs and outputs
- **Check:** All inputs are satisfied (required), types match (or permitted coercions)
- **Tool:** Type inference engine
- **Pass Criteria:** All nodes type-check without errors

### Integration Tests (Runtime)

**Test 4: Code Compilation**
- **Input:** Generated `pattern_bloom.cpp` (from JSON)
- **Check:** Compiles with PlatformIO, 0 warnings
- **Tool:** PlatformIO build
- **Pass Criteria:** Build succeeds, no warnings or errors

**Test 5: Pixel-Perfect Output Comparison**
- **Setup:**
  - Run current hand-coded `pattern_bloom.cpp` (baseline)
  - Run generated code from same JSON
  - Capture LED output for 100 frames (with same audio input)
- **Check:** Output matches pixel-by-pixel
- **Tool:** Test harness with mock audio data
- **Pass Criteria:** Max delta = 0 (exact match, or ≤1 LSB due to float→uint8 rounding)

**Test 6: Performance Regression Check**
- **Setup:**
  - Measure render time (baseline vs. generated) over 1000 frames
  - Measure peak memory usage
- **Check:** Generated code within 5% of baseline (no regression)
- **Tool:** Profiling instrumentation (e.g., `esp_timer_get_time()`)
- **Pass Criteria:** `generated_time ≤ 1.05 * baseline_time`

**Test 7: State Persistence Validation**
- **Setup:**
  - Run 50 frames with varying audio input
  - Verify `state.persist_buf[]` decays as expected (exponential curve)
- **Check:** Decay factor (0.92) is applied correctly
- **Tool:** Snapshot and verify buffer values
- **Pass Criteria:** Expected decay curve matches actual values

### Test Data

**Audio Mock Data:**
```cpp
// Predefined test audio snapshot for determinism
const AudioDataSnapshot test_audio_frame_0 = {
    .spectrogram = {0.1f, 0.2f, 0.15f, ...},  // 64 bins
    .vu_level = 0.5f,
    .timestamp_us = 1000000,
    .update_counter = 1
};
```

**Test Harness Structure:**
```cpp
void test_bloom_output_match() {
    PatternState state_baseline, state_generated;
    PatternOutput out_baseline, out_generated;
    PatternParameters params = get_default_params();

    // Run baseline
    for (int frame = 0; frame < 100; ++frame) {
        AudioDataSnapshot audio = get_test_audio(frame);
        pattern_bloom_render_baseline(frame, audio, params, state_baseline, out_baseline);

        // Run generated
        pattern_bloom_render_generated(frame, audio, params, state_generated, out_generated);

        // Compare outputs
        for (int i = 0; i < NUM_LEDS; ++i) {
            for (int ch = 0; ch < 3; ++ch) {
                ASSERT_EQ(out_baseline.leds[i][ch], out_generated.leds[i][ch],
                          "Frame %d, LED %d, Ch %d mismatch", frame, i, ch);
            }
        }
    }
}
```

---

## Part 6: Success Criteria

### Functional Requirements

| Criteria | Definition | Validation |
|----------|-----------|-----------|
| **Compilation** | Generated code compiles cleanly | 0 errors, 0 warnings (PlatformIO) |
| **Correctness** | LED output matches hand-coded baseline pixel-by-pixel | Pixel-perfect test (max delta = 0) |
| **Stateful Behavior** | BufferPersist decay works correctly | Exponential decay matches formula |
| **Performance** | No regression vs. baseline | ≤5% time overhead, peak memory within budget |

### Quality Requirements

| Criteria | Definition | Validation |
|----------|-----------|-----------|
| **Schema Compliance** | JSON graph validates against spec | JSON schema validation passes |
| **DAG Integrity** | Graph is acyclic, all inputs resolved | Topological sort succeeds |
| **Type Safety** | All ports type-check | Type inference engine succeeds |
| **Code Clarity** | Generated code is readable and maintainable | Manual review of generated .cpp |

### Documentation Requirements

| Artifact | Purpose | Audience |
|----------|---------|----------|
| **Bloom Algorithm Analysis** | Explain current pattern | Engineers (this doc, Part 1) |
| **Graph Node Design** | Define 7 nodes and their contracts | Codegen developers |
| **Example JSON Graph** | Reference implementation | Pattern authors |
| **Code Generation Template** | Show emission rules | Codegen implementers |
| **Test Plan** | Verification procedures | QA / test authors |

---

## Part 7: Implementation Breakdown (6 Milestones)

### Milestone 1: Algorithm Analysis & Documentation (2 hours)
**Goal:** Finalize understanding of current bloom pattern.

**Tasks:**
- [ ] Read and document current `pattern_bloom.cpp` line-by-line
- [ ] Create algorithm flowchart (buffer → decay → colorize → mirror → output)
- [ ] Identify hardcoded constants vs. parameterizable elements
- [ ] Document state structure (`state.persist_buf[]`)
- [ ] Identify audio input requirements (spectrum, envelope, etc.)

**Deliverable:** Part 1 of this document (complete)

**Effort:** 2 hours

---

### Milestone 2: Graph Node Design & Schema (3 hours)
**Goal:** Define 7 nodes and their I/O contracts.

**Tasks:**
- [ ] Choose node types from catalog (AudioSpectrum, BandShape, BufferPersist, ColorizeBuffer, Mirror, LedOutput)
- [ ] Define input/output ports for each node
- [ ] Define parameters (decay, smoothing, mode, etc.)
- [ ] Sketch node connectivity (DAG topology)
- [ ] Document state requirements (what goes in `PatternState` struct)
- [ ] Create type compatibility matrix

**Deliverable:** Part 2 + supporting tables

**Effort:** 3 hours

---

### Milestone 3: Example JSON Graph & Validation (2 hours)
**Goal:** Author complete, valid JSON graph for bloom.

**Tasks:**
- [ ] Write JSON graph file (`bloom_poc.json`)
- [ ] Validate against JSON schema
- [ ] Add metadata and comments
- [ ] Verify all node connections are resolvable
- [ ] Create simplified version (for manual testing)

**Deliverable:** Part 3 (example JSON) + `bloom_poc.json` file

**Effort:** 2 hours

---

### Milestone 4: Code Generation Template & Emitter (6 hours)
**Goal:** Implement bloom-specific code emitter; generate valid C++.

**Tasks:**
- [ ] Design emitter class/functions
  - Input: Parsed JSON graph
  - Output: C++ source code string
- [ ] Implement node-to-C++ emission rules
  - AudioSpectrum → `const float* spectrum = audio.spectrogram;`
  - BandShape → for-loop scalar math
  - BufferPersist → decay formula with state read/write
  - ColorizeBuffer → scalar-to-RGB mapping
  - Mirror → index flip loop
  - LedOutput → clamp + uint8 conversion
- [ ] Generate function signature and boilerplate
- [ ] Integrate with existing infrastructure (graph_runtime.h helpers)
- [ ] Emit to file or string buffer
- [ ] Add comments and line numbers (for debugging)

**Deliverable:** Part 4 (template) + working emitter code

**Effort:** 6 hours

---

### Milestone 5: Unit & Integration Tests (5 hours)
**Goal:** Implement test harnesses and validation.

**Tasks:**
- [ ] Implement JSON schema validator
- [ ] Implement DAG topology checker (cycle detection)
- [ ] Implement type inference engine
- [ ] Create test audio data (predefined snapshots)
- [ ] Implement pixel-perfect output comparison test
- [ ] Implement performance regression test (timing, memory)
- [ ] Implement state persistence test (decay validation)
- [ ] Create test runner framework

**Deliverable:** Part 5 + test code in `firmware/tests/` or equivalent

**Effort:** 5 hours

---

### Milestone 6: Validation, Documentation & Handoff (2 hours)
**Goal:** Run full test suite, document results, create handoff package.

**Tasks:**
- [ ] Run all tests against generated code
- [ ] Verify 0 compilation warnings
- [ ] Verify pixel-perfect match (100 test frames)
- [ ] Verify performance (≤5% regression)
- [ ] Document any blockers or issues
- [ ] Create summary report (success/failure)
- [ ] Package deliverables:
  - JSON graph file
  - Generated C++ code
  - Test results
  - Lessons learned
- [ ] Write brief "lessons learned" doc for next pattern (spectrum, etc.)

**Deliverable:** Validation report + handoff documentation

**Effort:** 2 hours

---

### Total Effort Estimate

| Milestone | Hours | Notes |
|-----------|-------|-------|
| 1. Algorithm Analysis | 2 | Understanding existing code |
| 2. Node Design | 3 | Mapping algorithm to nodes |
| 3. JSON Graph Example | 2 | Authoring and validation |
| 4. Code Emitter | 6 | Most complex; test-driven development |
| 5. Tests | 5 | Unit + integration test harnesses |
| 6. Validation & Handoff | 2 | Running tests and documenting |
| **Total** | **20 hours** | 2.5 developer-days, PoC scope |

**Timeline (sequential, 1 developer):** ~3 working days (1 week with reviews/iterations)

---

## Part 8: Dependencies & Blockers

### External Dependencies

| Dependency | Status | Blocker? | Notes |
|-----------|--------|----------|-------|
| `graph_runtime.h` (helpers) | ✓ Exists | No | Already in codebase; use as-is |
| `stateful_nodes.h` (state system) | ✓ Exists | No | BufferPersist node already defined |
| `pattern_audio_interface.h` (audio macros) | ✓ Exists | No | Audio snapshot available |
| `parameters.h` (PatternParameters) | ✓ Exists | No | Already used in patterns |
| JSON schema validator (tool) | ✓ Available | No | Standard JSON schema tools (ajv, jsonschema) |
| PlatformIO build system | ✓ Available | No | Already in use |

### Internal Assumptions

| Assumption | Requirement | Fallback | Risk |
|-----------|-------------|----------|------|
| **Deterministic Audio Data** | Test audio must be reproducible | Hardcoded test snapshots | Low (easy to generate) |
| **float → uint8 Conversion** | Rounding behavior must match | Floor + 0.5 offset | Low (documented) |
| **State Struct Layout** | `PatternState::persist_buf[256]` must exist | Allocate in generated code | Low (confirmed in code) |
| **NUM_LEDS = 256** | Fixed at compile time | Codegen must support template param | Low (fixed in current arch) |

### Potential Blockers

1. **Type System Incompleteness** (MEDIUM RISK)
   - **Issue:** If type inference engine doesn't support all coercions needed
   - **Mitigation:** Start with simple types (float → RGB); extend iteratively
   - **Fallback:** Manual type casting in emitted code (loses safety, but works)

2. **State Management Complexity** (LOW RISK)
   - **Issue:** If `PatternState` struct is too rigid for stateful nodes
   - **Mitigation:** Use existing `persist_buf[256]` field; no new state needed for bloom
   - **Fallback:** Allocate state on heap (increases complexity)

3. **Code Generation Edge Cases** (MEDIUM RISK)
   - **Issue:** Emitter may not handle all node types or parameter combinations
   - **Mitigation:** Start with 7 hard-coded nodes; generalize after PoC
   - **Fallback:** Hand-code node emit rules (brittle, but guarantees correctness)

4. **Performance Regression** (LOW RISK)
   - **Issue:** Generated code slower than hand-coded baseline
   - **Mitigation:** Use inline functions from graph_runtime.h; minimize copies
   - **Fallback:** Accept slight overhead if <5%; optimize in Phase 2

---

## Part 9: Success Metrics & Acceptance

### Go/No-Go Checklist

**MUST HAVE (blocking):**
- [ ] Generated C++ compiles with 0 errors, 0 warnings
- [ ] Pixel-perfect LED output match over 100 test frames
- [ ] JSON graph validates against schema
- [ ] DAG has no cycles
- [ ] All node inputs are resolvable
- [ ] BufferPersist decay works correctly (state persistence)

**SHOULD HAVE (strong preference):**
- [ ] Performance within 5% of baseline
- [ ] Test harness covers all 7 nodes
- [ ] Generated code is readable (suitable for human review)
- [ ] Documentation is clear enough to extend to 1 other pattern

**NICE TO HAVE (future refinement):**
- [ ] Support for palette-based colorization (beyond grayscale)
- [ ] Parameter UI bindings (speed, decay as user controls)
- [ ] SIMD optimizations for buffer operations
- [ ] Automatic dead code elimination

### Acceptance Criteria

**PoC is SUCCESSFUL if:**
1. Generated code is functionally equivalent to hand-coded baseline
2. Test suite covers all 7 nodes and validates correctness
3. Documentation provides enough detail to replicate for ≥1 other pattern
4. Effort estimate was accurate (within 20%)

**PoC is PARTIAL if:**
- Generated code matches baseline, but tests are incomplete
- Documentation exists, but is hard to follow

**PoC FAILS if:**
- Generated code does not match baseline
- Code does not compile
- Test harness reveals unfixable design flaw

---

## Part 10: Lessons Learned & Phase 2 Plan

### Knowledge to Capture

After PoC completion, document:

1. **Node Design Patterns** — What makes a good node? How to identify inputs/outputs?
2. **Code Generation Rules** — Boilerplate, includes, state management, output format
3. **Testing Methodology** — How to validate equivalence between hand-coded and generated
4. **Parameter Binding** — How to expose UI controls for user-facing parameters
5. **State Management** — How to allocate and persist state across frames

### Recommended Phase 2 Tasks

1. **Generalize Emitter** (6–8 hours)
   - Convert bloom-specific emitter to generic node-type visitor pattern
   - Support all 35+ nodes from catalog (not just 7 used in bloom)

2. **Extend Test Suite** (4–6 hours)
   - Add tests for other node types (blur, shift, compose, etc.)
   - Parametric test generation (test across node type combinations)

3. **Graph Editor Integration** (TBD)
   - Web UI for authoring graphs visually
   - Live preview of generated code

4. **Performance Optimization** (TBD)
   - Buffer reuse (lifetime analysis)
   - SIMD unrolling for blur/filter nodes
   - LUT generation for color mapping

---

## Appendix A: Reference Documentation

### Files to Read/Modify

| File | Purpose | Modification |
|------|---------|--------------|
| `firmware/src/graph_codegen/pattern_bloom.cpp` | Current hand-coded pattern | BASELINE (no changes) |
| `firmware/src/graph_codegen/graph_runtime.h` | Runtime helpers | USE AS-IS |
| `firmware/src/stateful_nodes.h` | State system | USE AS-IS |
| `firmware/src/parameters.h` | Runtime parameters | USE AS-IS |
| `firmware/src/pattern_audio_interface.h` | Audio accessors | USE AS-IS |
| `docs/06-reference/GRAPH_SCHEMA_SPEC.md` | Graph JSON schema | REFERENCE |
| `docs/06-reference/K1NRef_GRAPH_NODE_CATALOG_EXPANDED_v2.0_20251110.md` | Node types | REFERENCE |
| `firmware/tests/` (new) | Test harnesses | CREATE |
| `bloom_poc.json` (new) | Graph definition | CREATE |
| `firmware/src/graph_codegen/pattern_bloom_generated.cpp` (new) | Generated code | CREATE |

### Key Concepts Recap

- **Graph:** Directed acyclic structure of nodes
- **Node:** Computation unit with inputs, parameters, outputs
- **DAG:** No cycles, topologically sortable
- **Type System:** float, vec3, color, audio_spectrum, led_buffer_float, led_buffer_vec3
- **Coercions:** int→float, float→vec3 (broadcast)
- **Stateful Nodes:** Nodes that persist state across frames (e.g., BufferPersist)
- **Terminals:** Sink nodes (LedOutput, LedOutputMirror) that emit to firmware

---

## Appendix B: Quick Reference — Node Type Cheat Sheet

```cpp
// AudioSpectrum: Read audio frequency spectrum
Input: (none)
Output: audio_spectrum (float[64])

// BandShape: Filter spectrum to per-LED response
Input: src (audio_spectrum)
Output: led_buffer_float (float[256])
Params: gain, smoothing, center_bin, bandwidth

// BufferPersist: Exponential decay trail
Input: src (led_buffer_float)
Output: led_buffer_float (float[256])
Params: decay (0.0–1.0)
State: persist_buf[256]

// ColorizeBuffer: Scalar to RGB mapping
Input: index_buf (led_buffer_float)
Output: led_buffer_vec3 (CRGBF[256])
Params: mode ("grayscale" | "palette" | "hue_shift")

// Mirror: Flip buffer
Input: src (led_buffer_vec3)
Output: led_buffer_vec3 (CRGBF[256])

// LedOutput: Terminal node (emit to firmware)
Input: color (led_buffer_vec3)
Output: (none, writes to PatternOutput)
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-10 | Claude Code | Initial PoC roadmap (all sections) |

---

**End of Document**

---

## Quick Links

- **Graph Schema Spec:** `docs/06-reference/GRAPH_SCHEMA_SPEC.md`
- **Node Catalog:** `docs/06-reference/K1NRef_GRAPH_NODE_CATALOG_EXPANDED_v2.0_20251110.md`
- **Current Pattern:** `firmware/src/graph_codegen/pattern_bloom.cpp`
- **Runtime Helpers:** `firmware/src/graph_codegen/graph_runtime.h`

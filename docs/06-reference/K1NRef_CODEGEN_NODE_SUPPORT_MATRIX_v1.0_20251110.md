---
title: K1.node1 Code Generation - Node Support Matrix
subtitle: Current vs. Needed Coverage for 39+ Node Types
version: 1.0
date: 2025-11-10
status: reference
owner: Architecture Team
related:
  - docs/04-planning/K1NPlan_TASK15_CODE_GENERATION_STRATEGY_v1.0_20251110.md
  - docs/06-reference/K1NRef_GRAPH_NODE_CATALOG_EXPANDED_v2.0_20251110.md
tags: [code-generation, node-types, support-matrix, reference]
---

# Node Type Support Matrix

**Overview:** This document tracks the current implementation status of code generators for all 39 node types in the K1.node1 graph system.

**Key Metrics:**
- **Total Nodes:** 39
- **Fully Implemented:** 10 (26%)
- **Partially Implemented:** 4 (10%)
- **Not Implemented (Stubs):** 25 (64%)

---

## Summary by Category

### Input Nodes (10 types)

| Node | Spec | Generator | Tests | Status | Priority |
|------|------|-----------|-------|--------|----------|
| Time | ✅ | ⚠️ Stub | ❌ | Trivial op | HIGH |
| AudioSnapshot | ✅ | ❌ | ❌ | Simple read | HIGH |
| AudioSpectrum | ✅ | ❌ | ❌ | Simple read | HIGH |
| BeatEvent | ✅ | ❌ | ❌ | Stateful | HIGH |
| AutoCorrelation | ✅ | ❌ | ❌ | Call helper | HIGH |
| Chromagram | ✅ | ❌ | ❌ | Call helper | MEDIUM |
| ParamF | ✅ | ❌ | ❌ | Trivial param | HIGH |
| ParamColor | ✅ | ❌ | ❌ | Trivial param | HIGH |
| ConfigToggle | ✅ | ❌ | ❌ | Trivial param | MEDIUM |
| BandShape | ✅ | ⚠️ Partial | ⚠️ | Complex | MEDIUM |

**Category Summary:** 90% gap (only stubs)

### Math/Filter Nodes (10 types)

| Node | Spec | Generator | Tests | Status | Priority |
|------|------|-----------|-------|--------|----------|
| Add | ✅ | ❌ | ❌ | Trivial | HIGH |
| Mul | ✅ | ❌ | ❌ | Trivial | HIGH |
| Mix | ✅ | ❌ | ❌ | Trivial | HIGH |
| Lerp | ✅ | ❌ | ❌ | Trivial | MEDIUM |
| Clamp | ✅ | ❌ | ❌ | Trivial | HIGH |
| Pow | ✅ | ❌ | ❌ | Function call | HIGH |
| Sqrt | ✅ | ❌ | ❌ | Function call | MEDIUM |
| LowPass | ✅ | ❌ | ❌ | Stateful filter | HIGH |
| MovingAverage | ✅ | ❌ | ❌ | Stateful buffer | HIGH |
| Contrast | ✅ | ❌ | ❌ | S-curve formula | MEDIUM |

**Category Summary:** 90% gap (only stubs)

### Color Nodes (6 types) - Note: Extended from original 6

| Node | Spec | Generator | Tests | Status | Priority |
|------|------|-----------|-------|--------|----------|
| Hsv | ✅ | ❌ | ❌ | Call helper | HIGH |
| Color | ✅ | ❌ | ❌ | Trivial construct | HIGH |
| GradientMap | ✅ | ⚠️ Partial | ⚠️ | Palette lookup | HIGH |
| Desaturate | ✅ | ❌ | ❌ | Call helper | MEDIUM |
| ForceSaturation | ✅ | ❌ | ❌ | Conditional HSV | MEDIUM |
| PaletteSelector | ✅ | ❌ | ❌ | Phase 2 stub | LOW |
| ColorizeBuffer | ✅ | ⚠️ Partial | ⚠️ | Buffer → palette | HIGH |

**Category Summary:** 67% gap

### Geometry/Buffer Nodes (8 types)

| Node | Spec | Generator | Tests | Status | Priority |
|------|------|-----------|-------|--------|----------|
| Fill | ✅ | ✅ | ✅ | Complete | BASELINE |
| Blur | ✅ | ❌ | ❌ | Call helper | HIGH |
| Mirror | ✅ | ✅ | ✅ | Complete | BASELINE |
| Shift | ✅ | ❌ | ❌ | Call helper | MEDIUM |
| Downsample | ✅ | ❌ | ❌ | Call helper | MEDIUM |
| DotRender | ✅ | ❌ | ❌ | Complex blend | MEDIUM |
| ComposeLayers | ✅ | ❌ | ❌ | Call helper | MEDIUM |
| BufferPersist | ✅ | ✅ | ✅ | Complete (stateful) | BASELINE |

**Category Summary:** 63% gap

### Noise/Procedural Nodes (3 types)

| Node | Spec | Generator | Tests | Status | Priority |
|------|------|-----------|-------|--------|----------|
| PerlinNoise | ✅ | ❌ | ❌ | Call helper | MEDIUM |
| RngSeed | ✅ | ❌ | ❌ | Trivial constant | MEDIUM |
| PositionAccumulator | ✅ | ❌ | ❌ | Trivial computed | MEDIUM |

**Category Summary:** 100% gap

### Output Nodes (2 types)

| Node | Spec | Generator | Tests | Status | Priority |
|------|------|-----------|-------|--------|----------|
| LedOutput | ✅ | ✅ | ✅ | Complete | BASELINE |
| LedOutputMirror | ✅ | ✅ | ✅ | Complete | BASELINE |

**Category Summary:** 0% gap (complete)

---

## Detailed Implementation Status

### Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully implemented |
| ⚠️ | Partially implemented |
| ❌ | Not implemented (stub) |
| 🔧 | In progress |

### Input Nodes Details

#### Time
- **Specification:** ✅ Complete
- **Generator:** ⚠️ Stub (trivial template candidate)
- **Implementation:** `frame_count / frame_rate`
- **Complexity:** Trivial (1 line)
- **Priority:** HIGH
- **Notes:** Candidate for automatic template generation

#### AudioSnapshot
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Read from firmware `audio.envelope`
- **Complexity:** Simple (1 line)
- **Priority:** HIGH
- **Dependencies:** AudioDataSnapshot struct
- **Test Case:** Verify reads current envelope value

#### AudioSpectrum
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Read from firmware `audio.spectrum` array
- **Complexity:** Simple (1 line reference)
- **Priority:** HIGH
- **Dependencies:** AudioDataSnapshot.spectrum
- **Test Case:** Verify spectrum reference is valid

#### BeatEvent
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Stateful beat detector with hysteresis
- **Complexity:** Medium (threshold crossing with state)
- **Priority:** HIGH
- **Dependencies:** PatternState.beat_* fields
- **Test Case:** Beat detection on rising edge with hysteresis

#### AutoCorrelation
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Call firmware helper `compute_pitch()`, `pitch_confidence()`
- **Complexity:** Simple (2 helper calls)
- **Priority:** HIGH
- **Dependencies:** graph_runtime.h helpers
- **Test Case:** Verify pitch is 0-8000 Hz range
- **Notes:** Multi-output node (pitch_hz + confidence)

#### Chromagram
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Call firmware helper `compute_chroma_vector()`
- **Complexity:** Simple (1 helper call)
- **Priority:** MEDIUM
- **Dependencies:** graph_runtime.h helpers
- **Test Case:** Verify 12 output bins sum to ~1.0
- **Notes:** Multi-output node (12 chroma bins), Phase 1 unpack forbidden

#### ParamF
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Read from `params.<field_name>`
- **Complexity:** Trivial (1 line)
- **Priority:** HIGH
- **Dependencies:** PatternParameters struct definition
- **Test Case:** Parameter value matches what was set

#### ParamColor
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Read from `params.<field_name>`
- **Complexity:** Trivial (1 line)
- **Priority:** HIGH
- **Dependencies:** PatternParameters struct definition
- **Test Case:** Color value matches what was set

#### ConfigToggle
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Read from `params.<field_name>` (bool)
- **Complexity:** Trivial (1 line)
- **Priority:** MEDIUM
- **Dependencies:** PatternParameters struct definition
- **Test Case:** Toggle returns true/false correctly

#### BandShape
- **Specification:** ✅ Complete
- **Generator:** ⚠️ Partial (in emitterNodes.ts)
- **Implementation:** Interpolate spectrum to LED positions
- **Complexity:** Medium (interpolation with gain)
- **Priority:** MEDIUM
- **Dependencies:** Interpolation helper
- **Test Case:** Spectrum mapped to LED buffer correctly
- **Notes:** Currently uses inline interpolation, not fully modular

---

### Math/Filter Nodes Details

#### Add
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** `a + b`
- **Complexity:** Trivial (1 line)
- **Priority:** HIGH
- **Notes:** Template candidate

#### Mul
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** `a * b`
- **Complexity:** Trivial (1 line)
- **Priority:** HIGH
- **Notes:** Template candidate

#### Mix
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** `a * (1-t) + b * t`
- **Complexity:** Trivial (1 line)
- **Priority:** HIGH
- **Notes:** Supports overload for float/vec3

#### Lerp
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Alias for Mix
- **Complexity:** Trivial (1 line)
- **Priority:** MEDIUM
- **Notes:** Type polymorphic, template candidate

#### Clamp
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** `std::clamp(value, min, max)`
- **Complexity:** Trivial (1 line)
- **Priority:** HIGH
- **Notes:** Template candidate, has default inputs

#### Pow
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** `powf(base, exponent)`
- **Complexity:** Trivial (1 line)
- **Priority:** HIGH
- **Notes:** Template candidate (math function)

#### Sqrt
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** `sqrtf(value)`
- **Complexity:** Trivial (1 line)
- **Priority:** MEDIUM
- **Notes:** Template candidate (math function)

#### LowPass
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Stateful IIR filter: `state = alpha * signal + (1-alpha) * state`
- **Complexity:** Medium (stateful)
- **Priority:** HIGH
- **Dependencies:** lowpass_update() helper, PatternState.lowpass_states
- **Test Case:** Filter has correct time constant, state persists across frames

#### MovingAverage
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Stateful ring buffer average
- **Complexity:** Medium (stateful, ring buffer management)
- **Priority:** HIGH
- **Dependencies:** moving_average_update() helper, PatternState.ma_ring_buf
- **Test Case:** Moving window correctly averages last N samples

#### Contrast
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** S-curve: `(x - 0.5) * contrast + 0.5` (clamped 0-1)
- **Complexity:** Low (formula, but with clamping)
- **Priority:** MEDIUM
- **Notes:** Parameter modulates contrast strength

---

### Color Nodes Details

#### Hsv
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Call firmware helper `hsv_to_rgb(h, s, v)`
- **Complexity:** Simple (1 helper call)
- **Priority:** HIGH
- **Dependencies:** hsv_to_rgb() in graph_runtime.h
- **Test Case:** HSV (0.5, 1.0, 1.0) = Cyan

#### Color
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Construct vec3: `{r, g, b}`
- **Complexity:** Trivial (1 line)
- **Priority:** HIGH
- **Notes:** Template candidate

#### GradientMap
- **Specification:** ✅ Complete
- **Generator:** ⚠️ Partial (in emitterNodes.ts)
- **Implementation:** Palette lookup via `gradient_map(index, palette, palette_size)`
- **Complexity:** Simple (1 helper call)
- **Priority:** HIGH
- **Dependencies:** gradient_map() helper, palette tables
- **Test Case:** Index 0.0 = palette[0], 1.0 = palette[255]
- **Notes:** Palette selection handled by parameter

#### Desaturate
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Call firmware helper `desaturate(color, mode)`
- **Complexity:** Simple (1 helper call)
- **Priority:** MEDIUM
- **Dependencies:** desaturate() with luma/average/max modes
- **Test Case:** (0.5, 0.5, 0.5) → desaturate → (0.5, 0.5, 0.5)

#### ForceSaturation
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Conditional HSV saturation modification
- **Complexity:** Low (if branch with helper call)
- **Priority:** MEDIUM
- **Dependencies:** HSV conversion
- **Test Case:** Saturate pure red → pure red, desaturate → gray

#### PaletteSelector
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Stub (Phase 2: select palette by index)
- **Complexity:** Trivial (stub)
- **Priority:** LOW
- **Notes:** Phase 1 doesn't use this; Phase 2 planning

#### ColorizeBuffer
- **Specification:** ✅ Complete
- **Generator:** ⚠️ Partial (in emitterNodes.ts)
- **Implementation:** Loop over buffer, apply `gradient_map()` to each element
- **Complexity:** Medium (buffer operation + palette lookup)
- **Priority:** HIGH
- **Dependencies:** gradient_map() helper, buffer allocation
- **Test Case:** Scalar buffer [0.0, 0.5, 1.0] → RGB gradient

---

### Geometry/Buffer Nodes Details

#### Fill
- **Specification:** ✅ Complete
- **Generator:** ✅ Complete
- **Implementation:** Call firmware helper `fill_buffer(buf, color, num_leds)`
- **Complexity:** Simple (1 helper call)
- **Priority:** BASELINE (done)
- **Test Case:** All LEDs = input color

#### Blur
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Call firmware helper `blur_buffer(src, out, num_leds, radius)`
- **Complexity:** Simple (1 helper call)
- **Priority:** HIGH
- **Dependencies:** blur_buffer() with configurable radius
- **Test Case:** [R, G, B, R, G, B] with radius=1 → smoothed

#### Mirror
- **Specification:** ✅ Complete
- **Generator:** ✅ Complete
- **Implementation:** Call firmware helper `mirror_buffer(src, out, num_leds)`
- **Complexity:** Simple (1 helper call)
- **Priority:** BASELINE (done)
- **Test Case:** [A, B, C] → [C, B, A]

#### Shift
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Call firmware helper `shift_buffer(src, out, num_leds, offset)`
- **Complexity:** Simple (1 helper call)
- **Priority:** MEDIUM
- **Dependencies:** shift_buffer() with circular rotation
- **Test Case:** [A, B, C] with offset=1 → [C, A, B]

#### Downsample
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Call firmware helper `downsample_buffer(src, out, num_leds, factor)`
- **Complexity:** Simple (1 helper call)
- **Priority:** MEDIUM
- **Dependencies:** downsample_buffer(), fills gaps with black
- **Test Case:** [A, B, C] with factor=2 → [A, black, C, black]

#### DotRender
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Call firmware helper `dot_render(buf, peaks, colors, num_peaks, num_leds, blend_mode)`
- **Complexity:** Medium (parameter-array handling)
- **Priority:** MEDIUM
- **Dependencies:** dot_render() with blend modes (add, replace, multiply)
- **Test Case:** Peak at position 128, white color → LED 128 = white
- **Notes:** Handles parameter arrays (peak_indices, peak_colors)

#### ComposeLayers
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Call firmware helper `compose_layers(base, overlay, out, num_leds, mode, opacity)`
- **Complexity:** Medium (parameter-driven blend modes)
- **Priority:** MEDIUM
- **Dependencies:** compose_layers() with add/multiply/screen/overlay modes
- **Test Case:** Base [0.5, 0.5, 0.5] + overlay [0.5, 0.5, 0.5] with add → [1.0, 1.0, 1.0] (clamped)

#### BufferPersist
- **Specification:** ✅ Complete
- **Generator:** ✅ Complete
- **Implementation:** Stateful exponential decay: `out[i] = decay * prev[i] + (1-decay) * in[i]`
- **Complexity:** Medium (stateful, buffer state management)
- **Priority:** BASELINE (done)
- **Dependencies:** PatternState.persist_buf
- **Test Case:** Constant input → exponential approach to input value

---

### Noise/Procedural Nodes Details

#### PerlinNoise
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Call firmware helper `perlin_noise_1d(x, seed, scale)`
- **Complexity:** Simple (1 helper call)
- **Priority:** MEDIUM
- **Dependencies:** perlin_noise_1d() helper with seed control
- **Test Case:** Same seed → same output; different seed → different output
- **Notes:** Deterministic, pure function

#### RngSeed
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Constant seed value
- **Complexity:** Trivial (constant output)
- **Priority:** MEDIUM
- **Notes:** Phase 1 stub for seed; Phase 2 full RNG system

#### PositionAccumulator
- **Specification:** ✅ Complete
- **Generator:** ❌ Missing
- **Implementation:** Computed from frame count: `fmodf(frame_count / cycle_length, 1.0f)`
- **Complexity:** Simple (1 calculation)
- **Priority:** MEDIUM
- **Dependencies:** frame_count parameter, cycle_length
- **Test Case:** Repeats pattern every N frames

---

### Output Nodes Details

#### LedOutput
- **Specification:** ✅ Complete
- **Generator:** ✅ Complete
- **Implementation:** Clamp RGB [0, 1] to uint8 [0, 255] and write to hardware buffer
- **Complexity:** Simple (clamping + conversion)
- **Priority:** BASELINE (done)
- **Test Case:** RGB (1.0, 0.5, 0.0) → (255, 127, 0)

#### LedOutputMirror
- **Specification:** ✅ Complete
- **Generator:** ✅ Complete
- **Implementation:** Mirror first half, then output to hardware
- **Complexity:** Medium (mirror + finalization)
- **Priority:** BASELINE (done)
- **Test Case:** First half [A, B, C] → [A, B, C, C, B, A]

---

## Implementation Priority Ranking

### Tier 1: Critical (HIGH Priority) - Must implement first
1. Time - Trivial template
2. AudioSnapshot - Simple read
3. AudioSpectrum - Simple read
4. BeatEvent - Stateful, core feature
5. ParamF - Trivial template
6. ParamColor - Trivial template
7. Add - Trivial template
8. Mul - Trivial template
9. Mix - Trivial template
10. Clamp - Trivial template
11. Pow - Template (math)
12. Hsv - Call helper
13. Color - Trivial construct
14. Blur - Call helper
15. LowPass - Stateful filter (complex)
16. MovingAverage - Stateful (complex)
17. GradientMap - (Partial, needs completion)
18. ColorizeBuffer - (Partial, needs completion)

**Count:** 18 nodes
**Complexity:** 10 trivial + 5 simple helpers + 3 stateful
**Estimated Effort:** 2-3 days

### Tier 2: Important (MEDIUM Priority) - Implement after Tier 1
1. AutoCorrelation - Call helper
2. Chromagram - Call helper
3. Contrast - Formula with clamping
4. Desaturate - Call helper
5. ForceSaturation - Conditional HSV
6. BandShape - (Partial, complex interpolation)
7. Shift - Call helper
8. Downsample - Call helper
9. DotRender - Parameter arrays
10. ComposeLayers - Blend modes
11. PerlinNoise - Call helper
12. Sqrt - Template (math)
13. Lerp - Alias for Mix
14. ConfigToggle - Trivial template
15. RngSeed - Trivial constant
16. PositionAccumulator - Simple computation

**Count:** 16 nodes
**Complexity:** 2 trivial + 6 helpers + 2 complex
**Estimated Effort:** 2-3 days

### Tier 3: Future (LOW Priority) - Can defer or combine with other work
1. PaletteSelector - Phase 2 stub

**Count:** 1 node
**Estimated Effort:** Deferred

---

## Template Candidates

The following nodes are candidates for **automatic template generation** (zero custom code needed):

### Trivial Operations (1 line, no state)
- Time: `frame_count / FRAME_RATE`
- ParamF: `params.{param_name}`
- ParamColor: `params.{param_name}`
- ConfigToggle: `params.{param_name}`
- Add: `a + b`
- Mul: `a * b`
- Clamp: `std::clamp(value, min, max)`
- Pow: `powf(base, exponent)`
- Sqrt: `sqrtf(value)`
- Color: `{r, g, b}`

**Total: 10 nodes** - Can be handled by template system with zero per-node implementation.

### Helper Calls (1-2 lines, delegate to firmware)
- AudioSnapshot: `audio.envelope`
- AudioSpectrum: `audio.spectrum`
- Hsv: `hsv_to_rgb(h, s, v)`
- Desaturate: `desaturate(color, mode)`
- PerlinNoise: `perlin_noise_1d(x, seed, scale)`

**Total: 5 nodes** - Template with firmware helper dispatch.

---

## Gap Analysis Summary

| Category | Total | Done | Gaps | % Gap | Priority |
|----------|-------|------|------|-------|----------|
| Input | 10 | 1 | 9 | 90% | HIGH |
| Math/Filter | 10 | 0 | 10 | 100% | HIGH |
| Color | 7 | 2 | 5 | 71% | HIGH |
| Geometry/Buffer | 8 | 3 | 5 | 63% | HIGH |
| Noise/Procedural | 3 | 0 | 3 | 100% | MEDIUM |
| Output | 2 | 2 | 0 | 0% | BASELINE |
| **TOTAL** | **40** | **8** | **32** | **80%** | **CRITICAL** |

---

## Next Steps

1. **Week 1:** Implement Tier 1 (18 nodes) using template system
2. **Week 2:** Implement Tier 2 (16 nodes) with helpers
3. **Week 3:** Polish, testing, optimization
4. **Week 4:** Integration with hardware, performance validation

---

**Document Status:** ✅ REFERENCE
**Last Updated:** November 10, 2025
**Next Review:** When implementation begins

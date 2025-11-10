---
title: "Task 6: Pattern Migration Guide - Legacy C++ to Graph Nodes"
type: "Planning"
project: "K1.node1"
project_code: "K1N"
version: "v1.0"
date: "2025-11-10"
status: "active"
intent: "Concrete guidance for converting legacy C++ patterns into node graphs"
doc_id: "K1NPlan_TASK6_PATTERN_MIGRATION_GUIDE_v1.0_20251110"
tags: ["planning","task6","migration","patterns","graphs"]
related: ["K1NPlan_TASK_ROADMAP_CORRECTED_v1.0_20251110","K1NRef_GRAPH_NODE_CATALOG_EXPANDED_v2.0_20251110"]
---

# Pattern Migration Guide: Legacy C++ to Graph Nodes

**Document Status:** Active Planning Document (Task 6)
**Updated:** November 10, 2025
**Owner:** Architect + Mid Engineer
**Estimated Effort:** 16-20 hours

---

## Executive Summary

This guide provides **concrete, actionable mapping** from legacy C++ pattern implementations (Bloom, Spectrum, etc.) to the 39-node graph system. Each section shows:
- Which C++ operations map to which graph nodes
- Example node graphs (JSON snippets)
- Connection patterns and data flow
- Common pitfalls and anti-patterns

**Target audience:** Engineers migrating existing patterns or creating new ones using the graph system.

---

## Part 1: Bloom Pattern Migration

### Legacy C++ Implementation Analysis

**File:** `firmware/src/generated_patterns.h::draw_bloom()` (lines 519-568)

**Key Operations:**
1. **Persistent trail buffer** with exponential decay (`trail_decay = 0.92 + 0.06 * softness`)
2. **Audio-reactive injection** at LED[0] using bass/mids/treble with sqrt response
3. **Spatial diffusion** (spread) via `draw_sprite_float()` across NUM_LEDS
4. **Palette-based coloring** using position (0-1) and brightness
5. **Mirror symmetry** rendering (left/right from center)

---

### Node Graph Mapping (Bloom)

#### Step 1: Audio Input & Filtering

**C++ Code:**
```cpp
float energy_gate = fminf(1.0f, (AUDIO_VU * 0.9f) + (AUDIO_NOVELTY * 0.5f));
float inject_base = response_sqrt(AUDIO_BASS_ABS()) * 0.6f
    + response_sqrt(AUDIO_MIDS_ABS()) * 0.3f
    + response_sqrt(AUDIO_TREBLE_ABS()) * 0.2f;
```

**Graph Nodes:**
```json
{
  "nodes": [
    {"id": "audio_env", "type": "AudioSnapshot", "inputs": {}, "params": {}},
    {"id": "spectrum", "type": "AudioSpectrum", "inputs": {}, "params": {}},
    {"id": "bass_sqrt", "type": "Sqrt", "inputs": {"value": "spectrum[0..15]"}, "params": {}},
    {"id": "mids_sqrt", "type": "Sqrt", "inputs": {"value": "spectrum[16..31]"}, "params": {}},
    {"id": "treble_sqrt", "type": "Sqrt", "inputs": {"value": "spectrum[32..63]"}, "params": {}},
    {"id": "bass_scaled", "type": "Mul", "inputs": {"a": "bass_sqrt", "b": 0.6}, "params": {}},
    {"id": "mids_scaled", "type": "Mul", "inputs": {"a": "mids_sqrt", "b": 0.3}, "params": {}},
    {"id": "treble_scaled", "type": "Mul", "inputs": {"a": "treble_sqrt", "b": 0.2}, "params": {}},
    {"id": "inject_sum1", "type": "Add", "inputs": {"a": "bass_scaled", "b": "mids_scaled"}, "params": {}},
    {"id": "inject_base", "type": "Add", "inputs": {"a": "inject_sum1", "b": "treble_scaled"}, "params": {}}
  ]
}
```

**Notes:**
- `AudioSpectrum` returns full 64-bin spectrum; band aggregation requires future "BandSum" node (Phase 2)
- For Phase 1: use simplified approach with `AudioSnapshot` (single VU scalar) or `Mul + Add` chains
- `response_sqrt()` maps to `Sqrt` node

---

#### Step 2: Persistence & Decay

**C++ Code:**
```cpp
static float bloom_trail[NUM_LEDS] = {0.0f};
static float bloom_trail_prev[NUM_LEDS] = {0.0f};
float trail_decay = 0.92f + 0.06f * clip_float(params.softness);
dsps_mulc_f32_inplace(bloom_trail_prev, NUM_LEDS, trail_decay);
draw_sprite_float(bloom_trail, bloom_trail_prev, NUM_LEDS, NUM_LEDS, spread_speed, 1.0f);
bloom_trail[0] = fmaxf(bloom_trail[0], inject);
```

**Graph Nodes:**
```json
{
  "nodes": [
    {"id": "softness_param", "type": "ParamF", "inputs": {}, "params": {"name": "softness", "min": 0.0, "max": 1.0, "default": 0.5}},
    {"id": "decay_scaled", "type": "Mul", "inputs": {"a": "softness_param", "b": 0.06}, "params": {}},
    {"id": "decay_base", "type": "Add", "inputs": {"a": 0.92, "b": "decay_scaled"}, "params": {}},
    {"id": "inject_color", "type": "Hsv", "inputs": {"h": "time_node", "s": 1.0, "v": "inject_base"}, "params": {}},
    {"id": "inject_fill", "type": "Fill", "inputs": {"color": "inject_color"}, "params": {}},
    {"id": "persist", "type": "BufferPersist", "inputs": {"src": "inject_fill", "decay": "decay_base"}, "params": {}}
  ]
}
```

**Notes:**
- `BufferPersist` maintains stateful trail buffer across frames (replaces static C++ arrays)
- `decay` parameter (0.92-0.98) controls trail length
- Injection at LED[0] is handled by layering (see Step 4)

---

#### Step 3: Palette-Based Coloring

**C++ Code:**
```cpp
for (int i = 0; i < half_leds; ++i) {
    float brightness = clip_float(bloom_trail[i]);
    CRGBF color = color_from_palette(params.palette_id, (float)i / half_leds, brightness);
    color.r *= params.brightness;
}
```

**Graph Nodes:**
```json
{
  "nodes": [
    {"id": "position_gen", "type": "PositionAccumulator", "inputs": {}, "params": {"mode": "scanline", "cycle_length": 256}},
    {"id": "gradient", "type": "GradientMap", "inputs": {"index": "position_gen"}, "params": {"palette": "viridis"}},
    {"id": "brightness_param", "type": "ParamF", "inputs": {}, "params": {"name": "brightness", "min": 0.0, "max": 1.0, "default": 0.8}},
    {"id": "colored_buf", "type": "Fill", "inputs": {"color": "gradient"}, "params": {}},
    {"id": "bright_scaled", "type": "Mul", "inputs": {"a": "colored_buf", "b": "brightness_param"}, "params": {}}
  ]
}
```

**Notes:**
- `GradientMap` replaces `color_from_palette()` C++ helper
- Position (0-1) fed into gradient to get per-LED hue variation
- Global brightness applied via `Mul` node (element-wise multiplication)

---

#### Step 4: Mirror Symmetry

**C++ Code:**
```cpp
int half_leds = NUM_LEDS >> 1;
for (int i = 0; i < half_leds; ++i) {
    int left_index = (half_leds - 1) - i;
    int right_index = half_leds + i;
    leds[left_index] = color;
    leds[right_index] = color;
}
```

**Graph Nodes:**
```json
{
  "nodes": [
    {"id": "final_output", "type": "LedOutputMirror", "inputs": {"color": "persist"}, "params": {}}
  ]
}
```

**Notes:**
- `LedOutputMirror` terminal node automatically handles center-origin mirroring
- No explicit loop needed; firmware handles symmetry
- Assumes `NUM_LEDS` is even (compile-time validation required)

---

### Complete Bloom Graph (Simplified)

```json
{
  "version": 1,
  "name": "bloom_simplified",
  "nodes": [
    {"id": "time_node", "type": "Time", "inputs": {}, "params": {}},
    {"id": "audio", "type": "AudioSnapshot", "inputs": {}, "params": {}},
    {"id": "audio_sqrt", "type": "Sqrt", "inputs": {"value": "audio"}, "params": {}},
    {"id": "softness", "type": "ParamF", "inputs": {}, "params": {"name": "softness", "min": 0.0, "max": 1.0, "default": 0.5}},
    {"id": "decay_offset", "type": "Mul", "inputs": {"a": "softness", "b": 0.06}, "params": {}},
    {"id": "decay", "type": "Add", "inputs": {"a": 0.92, "b": "decay_offset"}, "params": {}},
    {"id": "hue_base", "type": "Mul", "inputs": {"a": "time_node", "b": 0.1}, "params": {}},
    {"id": "inject_color", "type": "Hsv", "inputs": {"h": "hue_base", "s": 1.0, "v": "audio_sqrt"}, "params": {}},
    {"id": "inject_fill", "type": "Fill", "inputs": {"color": "inject_color"}, "params": {}},
    {"id": "persist", "type": "BufferPersist", "inputs": {"src": "inject_fill", "decay": "decay"}, "params": {}},
    {"id": "output", "type": "LedOutputMirror", "inputs": {"color": "persist"}, "params": {}}
  ]
}
```

**Expected Behavior:**
- Audio-reactive VU drives brightness injection at center
- Trail persists with exponential decay (0.92-0.98 based on softness)
- Hue cycles slowly with time (rainbow effect)
- Mirrored output from center outward

---

## Part 2: Spectrum Pattern Migration

### Legacy C++ Implementation Analysis

**File:** `firmware/src/generated_patterns.h::draw_spectrum()` (lines 381-440)

**Key Operations:**
1. **FFT spectrum input** (64 bins) with interpolation
2. **Gradient mapping** (position → color via palette)
3. **Brightness scaling** via `response_sqrt()` (nonlinear curve)
4. **Mirror rendering** (center-origin visualization)
5. **Age-based decay** for smooth silence handling

---

### Node Graph Mapping (Spectrum)

#### Step 1: Spectrum Input & Smoothing

**C++ Code:**
```cpp
float smooth_mix = clip_float(params.custom_param_3); // 0.0 = raw, 1.0 = smoothed
float raw_mag = clip_float(interpolate(progress, AUDIO_SPECTRUM, NUM_FREQS));
float smooth_mag = clip_float(AUDIO_SPECTRUM_INTERP(progress));
float magnitude = (raw_mag * (1.0f - smooth_mix) + smooth_mag * smooth_mix);
magnitude = response_sqrt(magnitude) * age_factor;
```

**Graph Nodes:**
```json
{
  "nodes": [
    {"id": "spectrum", "type": "AudioSpectrum", "inputs": {}, "params": {}},
    {"id": "smooth_param", "type": "ParamF", "inputs": {}, "params": {"name": "smoothness", "min": 0.0, "max": 1.0, "default": 0.3}},
    {"id": "lowpass", "type": "LowPass", "inputs": {"signal": "spectrum_bin_interp", "alpha": "smooth_param"}, "params": {}},
    {"id": "mag_sqrt", "type": "Sqrt", "inputs": {"value": "lowpass"}, "params": {}},
    {"id": "age_decay", "type": "Mul", "inputs": {"a": "mag_sqrt", "b": "age_factor_computed"}, "params": {}}
  ]
}
```

**Notes:**
- `AudioSpectrum` provides 64 frequency bins (0-8 kHz)
- `LowPass` smooths magnitude over time (replaces manual mix)
- `Sqrt` applies nonlinear response curve
- Age-based decay requires time tracking (see below)

---

#### Step 2: Per-LED Gradient Mapping

**C++ Code:**
```cpp
for (int i = 0; i < half_leds; i++) {
    float progress = (float)i / half_leds;
    float magnitude = /* from spectrum */;
    CRGBF color = color_from_palette(params.palette_id, progress, magnitude);
    color.r *= params.brightness;
}
```

**Graph Nodes:**
```json
{
  "nodes": [
    {"id": "position_i", "type": "PositionAccumulator", "inputs": {}, "params": {"mode": "scanline", "cycle_length": 128}},
    {"id": "gradient", "type": "GradientMap", "inputs": {"index": "position_i"}, "params": {"palette": "plasma"}},
    {"id": "brightness_param", "type": "ParamF", "inputs": {}, "params": {"name": "brightness", "min": 0.0, "max": 1.0, "default": 0.8}},
    {"id": "scaled_color", "type": "Mul", "inputs": {"a": "gradient", "b": "brightness_param"}, "params": {}},
    {"id": "fill_spectrum", "type": "Fill", "inputs": {"color": "scaled_color"}, "params": {}}
  ]
}
```

**Notes:**
- `PositionAccumulator` generates per-LED position (0-1) for gradient lookup
- `GradientMap` maps position → color (replaces `color_from_palette`)
- `Fill` broadcasts color to all LEDs (simplified; Phase 2: per-LED mapping)

---

#### Step 3: Peak Markers (Dots)

**C++ Code (implicit in SensoryBridge reference):**
```cpp
// Dot overlays for spectral peaks (not in legacy draw_spectrum, but in Emotiscope)
// Example: mark top 5 frequency peaks with white dots
```

**Graph Nodes:**
```json
{
  "nodes": [
    {"id": "dots", "type": "DotRender", "inputs": {"base_buf": "fill_spectrum", "peak_indices": "peak_detector_output"}, "params": {"blend_mode": "add", "peak_width": 2}}
  ]
}
```

**Notes:**
- `DotRender` overlays point markers on base buffer
- Requires peak detection (Phase 2: add PeakDetector node)
- Phase 1: manual peak indices via params

---

#### Step 4: Mirror Output

**C++ Code:**
```cpp
int left_index = (NUM_LEDS / 2) - 1 - i;
int right_index = (NUM_LEDS / 2) + i;
leds[left_index] = color;
leds[right_index] = color;
```

**Graph Nodes:**
```json
{
  "nodes": [
    {"id": "output", "type": "LedOutputMirror", "inputs": {"color": "fill_spectrum"}, "params": {}}
  ]
}
```

---

### Complete Spectrum Graph (Simplified)

```json
{
  "version": 1,
  "name": "spectrum_simplified",
  "nodes": [
    {"id": "spectrum", "type": "AudioSpectrum", "inputs": {}, "params": {}},
    {"id": "smooth_param", "type": "ParamF", "inputs": {}, "params": {"name": "smoothness", "min": 0.0, "max": 1.0, "default": 0.3}},
    {"id": "lowpass", "type": "LowPass", "inputs": {"signal": "spectrum[32]", "alpha": "smooth_param"}, "params": {}},
    {"id": "mag_sqrt", "type": "Sqrt", "inputs": {"value": "lowpass"}, "params": {}},
    {"id": "position", "type": "PositionAccumulator", "inputs": {}, "params": {"mode": "scanline", "cycle_length": 128}},
    {"id": "gradient", "type": "GradientMap", "inputs": {"index": "position"}, "params": {"palette": "plasma"}},
    {"id": "brightness_scaled", "type": "Mul", "inputs": {"a": "gradient", "b": "mag_sqrt"}, "params": {}},
    {"id": "fill", "type": "Fill", "inputs": {"color": "brightness_scaled"}, "params": {}},
    {"id": "output", "type": "LedOutputMirror", "inputs": {"color": "fill"}, "params": {}}
  ]
}
```

**Expected Behavior:**
- FFT spectrum drives gradient brightness (audio-reactive)
- Smoothness parameter controls responsiveness
- Plasma palette provides vibrant color
- Mirror output from center (Emotiscope style)

---

## Part 3: General Migration Patterns

### Pattern 1: Audio-Reactive Injection (Bloom-style)

**When to use:** Patterns that inject energy at a single point and let it diffuse/decay.

**Node Sequence:**
1. `AudioSnapshot` → `Sqrt` (nonlinear response)
2. `Hsv` (map to color)
3. `Fill` (broadcast to buffer)
4. `BufferPersist` (apply decay and accumulation)
5. `LedOutput` or `LedOutputMirror`

**Example:** Bloom, Comet, Pulse, Glow

---

### Pattern 2: Spectrum Visualization (Spectrum-style)

**When to use:** Patterns that map frequency bins to spatial positions.

**Node Sequence:**
1. `AudioSpectrum` → `LowPass` (smooth over time)
2. `PositionAccumulator` (per-LED position)
3. `GradientMap` (position → color)
4. `Mul` (brightness scaling)
5. `Fill` (create LED buffer)
6. `DotRender` (optional peak markers)
7. `LedOutputMirror`

**Example:** Spectrum, Octave, Waveform

---

### Pattern 3: Layered Effects (Bloom + Dots)

**When to use:** Patterns with multiple visual layers (base gradient + overlay effects).

**Node Sequence:**
1. **Base Layer:**
   - `AudioSnapshot` → `GradientMap` → `Fill` → `BufferPersist` (trail)
2. **Overlay Layer:**
   - `BeatEvent` → `DotRender` (beat markers)
3. **Composition:**
   - `ComposeLayers` (blend base + overlay with "add" mode)
4. **Output:**
   - `LedOutput`

**Example:** Bloom with beat pulses, Spectrum with sparkle overlay

---

### Pattern 4: Procedural Noise (Organic Patterns)

**When to use:** Patterns with non-audio-driven variation (shimmer, texture).

**Node Sequence:**
1. `Time` → `Mul` (scale time for speed)
2. `RngSeed` (provide seed)
3. `PerlinNoise` (generate noise field)
4. `Hsv` (noise → hue)
5. `Fill` → `LedOutput`

**Example:** Lava Lamp, Cloud Shimmer, Organic Glow

---

## Part 4: Connection Rules & Type Compatibility

### Valid Port Connections

| From Type | To Type | Connection Rule | Notes |
|-----------|---------|-----------------|-------|
| `float` | `float` | Direct | No coercion needed |
| `int` | `float` | Implicit widening | Safe (automatic cast) |
| `float` | `int` | **FORBIDDEN (Phase 1)** | Precision loss; Phase 2: explicit Cast node |
| `audio_envelope` | `float` | Direct | Alias (same type) |
| `audio_spectrum` | `float` | Index access | `spectrum[i]` for single bin |
| `color` (vec3) | `led_buffer<vec3>` | Via `Fill` node | Broadcast to all LEDs |
| `led_buffer<vec3>` | `LedOutput` | Direct | Terminal node input |
| `bool` | `float` | **FORBIDDEN (Phase 1)** | Phase 2: explicit Cast node |
| `param<float>` | `float` | Direct | Read-only from UI |
| `rng_seed` | `PerlinNoise` | Direct | Determinism guarantee |

---

### Common Subgraph Patterns

#### 1. Audio Energy Extraction

```
AudioSnapshot → Sqrt → Clamp → [brightness output]
```

**Use case:** Convert VU to usable brightness (nonlinear response).

---

#### 2. Trail/Persistence with Decay

```
[input buffer] → BufferPersist(decay=0.95) → [output buffer]
```

**Use case:** Comet tails, bloom trails, glow effects.

---

#### 3. Spectrum → Gradient Mapping

```
AudioSpectrum → LowPass → GradientMap → Fill → [LED buffer]
```

**Use case:** FFT visualization with smoothing.

---

#### 4. Beat-Triggered Flash

```
AudioSnapshot → BeatEvent(threshold=0.5) → [bool pulse] → (Phase 2: trigger node)
```

**Use case:** Beat-synchronized effects.

---

#### 5. Layer Composition (Base + Overlay)

```
[base_buffer] → ComposeLayers(overlay=[dots_buffer], mode="add") → [final_buffer]
```

**Use case:** Multi-effect blending (gradient + sparkle).

---

## Part 5: Anti-Patterns (What NOT to Do)

### ❌ Anti-Pattern 1: Cycle in RNG/Stateful Nodes

**Problem:**
```json
{"id": "noise1", "type": "PerlinNoise", "inputs": {"x": "noise2"}, ...}
{"id": "noise2", "type": "PerlinNoise", "inputs": {"x": "noise1"}, ...}
```

**Why it fails:** Cycle detection forbids feedback loops; topological sort fails.

**Solution:** Use separate seeds or time-driven position accumulators.

---

### ❌ Anti-Pattern 2: Implicit Buffer Conversion

**Problem:**
```json
{"id": "fill", "type": "Fill", "inputs": {"color": "spectrum"}, ...}
```

**Why it fails:** `audio_spectrum` (float[64]) cannot implicitly convert to `color` (vec3).

**Solution:** Extract single bin via index (`spectrum[32]`) or use aggregation node (Phase 2).

---

### ❌ Anti-Pattern 3: Unbounded Parameter Ranges

**Problem:**
```json
{"id": "param", "type": "ParamF", "params": {"name": "speed", "min": -1000.0, "max": 1000.0, ...}}
```

**Why it fails:** Large ranges cause UX issues; no semantic bounds.

**Solution:** Use tight, meaningful ranges (e.g., `[0.0, 2.0]` for speed multipliers).

---

### ❌ Anti-Pattern 4: Hot-Path Logging in Nodes

**Problem:**
```cpp
// Inside node emitter:
Serial.printf("DEBUG: inject=%f\n", inject);
```

**Why it fails:** Logging in render loop destroys FPS (5-10 FPS vs. 30 FPS target).

**Solution:** Use atomic counters or DEBUG compile-time gates only.

---

### ❌ Anti-Pattern 5: Redundant Clears in BufferPersist

**Problem:**
```json
{"id": "clear", "type": "Fill", "inputs": {"color": [0,0,0]}, ...}
{"id": "persist", "type": "BufferPersist", "inputs": {"src": "clear", ...}, ...}
```

**Why it fails:** Zeroing buffer before persistence wastes cycles; decay handles fading.

**Solution:** Feed active content directly into `BufferPersist`; decay handles cleanup.

---

## Part 6: Migration Checklist (Per-Pattern)

Use this checklist when converting any legacy C++ pattern to graph nodes:

### Pre-Migration Analysis
- [ ] Identify all audio inputs (VU, spectrum, chromagram, beat)
- [ ] List all stateful buffers (trails, accumulators, ring buffers)
- [ ] Map all color operations (palette lookups, HSV conversions)
- [ ] Identify spatial operations (mirror, shift, blur)
- [ ] Note all user parameters (speed, brightness, custom params)

### Node Mapping
- [ ] Create input nodes for all audio/time/param sources
- [ ] Map stateful operations to `BufferPersist`, `LowPass`, `MovingAverage`
- [ ] Map color operations to `Hsv`, `GradientMap`, `Color`
- [ ] Map spatial operations to `Mirror`, `Shift`, `Blur`, `Fill`
- [ ] Map output to `LedOutput` or `LedOutputMirror`

### Validation
- [ ] Verify no cycles in graph (topological sort must succeed)
- [ ] Check all required inputs are connected
- [ ] Validate parameter ranges (0-1 for normalized values)
- [ ] Ensure type compatibility on all connections
- [ ] Confirm memory budget (<16 KB temp buffers, <1 KB per stateful node)

### Testing
- [ ] CPU simulation: CRC match vs. legacy implementation (±5% tolerance)
- [ ] Hardware validation: FPS delta <2% vs. hand-written code
- [ ] Visual comparison: side-by-side with same audio input
- [ ] Parameter sweep: test min/max/default for all params
- [ ] Stress test: 60 FPS continuous for 60 seconds

---

## Summary: Migration Quick Reference

| Legacy C++ Operation | Graph Node(s) | Notes |
|---------------------|---------------|-------|
| `AUDIO_VU` | `AudioSnapshot` | Single scalar (VU/envelope) |
| `AUDIO_SPECTRUM` | `AudioSpectrum` | 64-bin FFT array |
| `AUDIO_CHROMAGRAM` | `Chromagram` | 12-point chroma vector (Phase 2: unpack node) |
| `response_sqrt(x)` | `Sqrt` | Nonlinear brightness curve |
| `color_from_palette(id, pos, bright)` | `GradientMap` | Position → color mapping |
| `hsv2rgb(h, s, v)` | `Hsv` | HSV → RGB conversion |
| `static float trail[NUM_LEDS]` | `BufferPersist` | Stateful persistence with decay |
| `draw_sprite_float(...)` | `BufferPersist` + `Shift` | Diffusion/spread (Phase 2: dedicated node) |
| `for (i=0; i<NUM_LEDS; i++) leds[i] = color;` | `Fill` | Broadcast color to buffer |
| `leds[left] = leds[right] = color;` | `LedOutputMirror` | Mirror symmetry output |
| `blend(base, overlay, mode)` | `ComposeLayers` | Multi-layer blending |
| `perlin_noise(x, seed)` | `PerlinNoise` | Procedural noise generation |
| `params.speed` | `ParamF` | User-configurable float parameter |
| `beat_detector(vu, thresh)` | `BeatEvent` | Threshold crossing with hysteresis |
| `lowpass_filter(signal, alpha)` | `LowPass` | 1-pole IIR smoothing |

---

**Document Version:** 1.0
**Status:** Active Planning (Task 6)
**Last Updated:** November 10, 2025
**Next Review:** November 18, 2025 (post Task 5 completion)

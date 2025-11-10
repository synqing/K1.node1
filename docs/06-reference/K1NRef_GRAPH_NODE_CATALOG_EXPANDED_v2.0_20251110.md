# K1.node1 Expanded Graph Node Catalog (35-40 Types, Emotiscope/SensoryBridge Parity)

**Version:** 2.0 (EXPANDED)
**Date:** November 10, 2025
**Status:** Reference (Phase 1 Implementation — Authoritative Scope)
**Scope:** 35-40 node types with Emotiscope/SensoryBridge feature parity
**Related:** `docs/plans/2025-11-10-phase1-implementation-plan-v2-expanded-scope.md`, `codegen/schemas/graph.schema.json`

---

## Overview

This catalog defines **35-40 node types** available in the K1.node1 graph system (Phase 1, expanded scope per authoritative roadmap). These nodes enable production-grade pattern composition with audio analysis, procedural effects, spatial transformations, and multi-buffer composition.

Each node entry specifies:
- **Node Type** — identifier used in JSON (e.g., `"type": "PerlinNoise"`)
- **Inputs** — required/optional port connections
- **Parameters** — compile-time configuration
- **Output** — result type(s)
- **Memory Cost** — RAM/state requirements
- **Constraints** — special rules (stateful, side-effects, determinism)
- **C++ Integration** — firmware helper usage (or embedded algorithm)

---

## Part 1: Input Nodes (8-10 Types)

### Time
Provides absolute elapsed time since pattern start.

| Property | Value |
|----------|-------|
| **Node Type** | `Time` |
| **Inputs** | *(none)* |
| **Parameters** | *(none)* |
| **Output** | `time` (seconds, float) |
| **Memory** | 0 bytes (pure) |
| **C++ Code** | `float time_val = frame_count / 30.0f;` |
| **Constraints** | Pure, deterministic, no state |

---

### AudioSnapshot
Captures current audio VU/envelope as a single scalar per frame.

| Property | Value |
|----------|-------|
| **Node Type** | `AudioSnapshot` |
| **Inputs** | *(none)* |
| **Parameters** | *(none)* |
| **Output** | `audio_envelope` (float, 0–1, VU/energy) |
| **Memory** | 0 bytes (reads from firmware ringbuffer) |
| **C++ Code** | `float envelope = audio.envelope;` |
| **Constraints** | Called once per frame; may block on I2S timeout (fallback: silence) |

---

### AudioSpectrum
**NEW:** Provides full FFT spectrum from audio analysis.

| Property | Value |
|----------|-------|
| **Node Type** | `AudioSpectrum` |
| **Inputs** | *(none)* |
| **Parameters** | *(none)* |
| **Output** | `audio_spectrum` (float[NUM_FREQS], typically 64 bins) |
| **Memory** | 0 bytes (reads from firmware ringbuffer) |
| **C++ Code** | `auto& spectrum = audio.spectrum;` (reference) |
| **Constraints** | Called once per frame; frequency bins are linearly spaced (0–8 kHz typical) |
| **Usage** | Input to filters, gradients, DotRender, band aggregators |

---

### BeatEvent
Detects beat pulses from audio envelope with threshold crossing.

| Property | Value |
|----------|-------|
| **Node Type** | `BeatEvent` |
| **Inputs** | `envelope: audio_envelope` (required) |
| **Parameters** | `threshold: float` (0.0–1.0, default 0.5), `hysteresis: float` (0.0–0.2, debounce) |
| **Output** | `beat_event` (bool, pulse lasting 1 frame) |
| **Memory** | ~16 bytes (last_beat_time, prev_envelope) |
| **C++ Code** | `bool beat = (envelope > threshold) && (prev_envelope <= (threshold - hysteresis));` |
| **Constraints** | Stateful; emits discrete pulse on threshold cross; requires hysteresis to prevent jitter |
| **Usage** | Trigger effects, synchronize LowPass refresh, feed into fills |

---

### AutoCorrelation
**NEW:** Pitch detection via autocorrelation analysis (Emotiscope feature).

| Property | Value |
|----------|-------|
| **Node Type** | `AutoCorrelation` |
| **Inputs** | `spectrum: audio_spectrum` (required) |
| **Parameters** | `confidence_threshold: float` (0.0–1.0, default 0.3) |
| **Outputs** | `pitch_hz: float` (0–8000), `confidence: float` (0–1) |
| **Memory** | 0 bytes (pure analysis) |
| **C++ Code** | `float pitch = compute_pitch(spectrum); float conf = pitch_confidence(spectrum);` (firmware helper) |
| **Constraints** | Multi-output node; outputs available on separate ports; confidence indicates reliability |
| **Usage** | Chromatic visualization, pitch-synced effects (Phase 2) |

---

### Chromagram
**NEW:** 12-point chroma (pitch class) vector from spectrum (SensoryBridge chromatic mode).

| Property | Value |
|----------|-------|
| **Node Type** | `Chromagram` |
| **Inputs** | `spectrum: audio_spectrum` (required) |
| **Parameters** | `mode: enum` ("equal_tempered", "just", default "equal_tempered") |
| **Output** | `chroma_vector` (float[12], energy per semitone: C, C#, D, ..., B) |
| **Memory** | 0 bytes (pure analysis) |
| **C++ Code** | `auto chroma = compute_chroma_vector(spectrum, mode);` (firmware helper) |
| **Constraints** | Multi-output port (12 channels); cannot pass directly to output (Phase 1: forbid; Phase 2: unpack node) |
| **Usage** | Chromatic mode selection, future melodic sync |

---

### ParamF
Float parameter exposed to UI for user control.

| Property | Value |
|----------|-------|
| **Node Type** | `ParamF` |
| **Inputs** | *(none)* |
| **Parameters** | `name: string` (UI label), `min: float`, `max: float`, `default: float` |
| **Output** | `param<float>` |
| **Memory** | 0 bytes (reads from PatternParameters struct) |
| **C++ Code** | `float speed = params.speed;` (auto-generated accessor) |
| **Constraints** | Read-only; value set by firmware/UI at frame time; bounds enforced |
| **Usage** | User-configurable speed, decay, saturation, brightness, threshold |

---

### ParamColor
Color parameter exposed to UI.

| Property | Value |
|----------|-------|
| **Node Type** | `ParamColor` |
| **Inputs** | *(none)* |
| **Parameters** | `name: string` (UI label), `default: [r, g, b]` (0–1 each) |
| **Output** | `param<color>` (alias: `param<vec3>`) |
| **Memory** | 0 bytes (reads from PatternParameters struct) |
| **C++ Code** | `CRGBF color = params.base_color;` |
| **Constraints** | Read-only; clamped to [0, 1] at runtime |
| **Usage** | User-selectable base color, tint, mood color |

---

### ConfigToggle
**NEW:** Boolean parameter for mode selection (e.g., chromatic on/off, mirror enabled).

| Property | Value |
|----------|-------|
| **Node Type** | `ConfigToggle` |
| **Inputs** | *(none)* |
| **Parameters** | `name: string` (UI label), `default: bool` (false or true) |
| **Output** | `param<bool>` |
| **Memory** | 0 bytes |
| **C++ Code** | `bool use_chromatic = params.chromatic_mode;` |
| **Constraints** | Read-only; binary (true/false) |
| **Usage** | Feature toggles (mirror, chromatic mode, presets), conditional branches (Phase 2) |

---

## Part 2: Math & Filter Nodes (8-10 Types)

### Add
Scalar addition.

| Property | Value |
|----------|-------|
| **Node Type** | `Add` |
| **Inputs** | `a: float`, `b: float` |
| **Parameters** | *(none)* |
| **Output** | `float` (a + b) |
| **Memory** | 0 bytes (pure) |
| **C++ Code** | `float sum = a + b;` |
| **Constraints** | Pure, no clamping; downstream consumers clamp as needed |

---

### Mul
Scalar multiplication.

| Property | Value |
|----------|-------|
| **Node Type** | `Mul` |
| **Inputs** | `a: float`, `b: float` |
| **Parameters** | *(none)* |
| **Output** | `float` (a × b) |
| **Memory** | 0 bytes (pure) |
| **C++ Code** | `float product = a * b;` |
| **Constraints** | Pure, no saturation |

---

### Mix
Weighted blend of two scalars.

| Property | Value |
|----------|-------|
| **Node Type** | `Mix` |
| **Inputs** | `a: float`, `b: float`, `t: float` (blend factor, 0–1) |
| **Parameters** | *(none)* |
| **Output** | `float` (a × (1 − t) + b × t) |
| **Memory** | 0 bytes (pure) |
| **C++ Code** | `float mixed = a * (1.0f - t) + b * t;` |
| **Constraints** | Pure; no clamping of t |

---

### Lerp
Linear interpolation (alias for Mix; supports both scalar and vector).

| Property | Value |
|----------|-------|
| **Node Type** | `Lerp` |
| **Inputs** | `a: float or vec3`, `b: float or vec3`, `t: float` |
| **Parameters** | *(none)* |
| **Output** | same as input type |
| **Memory** | 0 bytes (pure) |
| **C++ Code** | `float lerped = a + t * (b - a);` (or vector variant) |
| **Constraints** | Pure; overloaded for float/vec3 |

---

### Clamp
Bound value to range.

| Property | Value |
|----------|-------|
| **Node Type** | `Clamp` |
| **Inputs** | `value: float`, `min: float` (default 0.0), `max: float` (default 1.0) |
| **Parameters** | *(none)* |
| **Output** | `float` (std::clamp(value, min, max)) |
| **Memory** | 0 bytes (pure) |
| **C++ Code** | `float clamped = std::clamp(value, min_val, max_val);` |
| **Constraints** | Pure; useful for safety bounds on user params |

---

### Pow
Nonlinear power curve.

| Property | Value |
|----------|-------|
| **Node Type** | `Pow` |
| **Inputs** | `base: float`, `exponent: float` (default 2.0) |
| **Parameters** | *(none)* |
| **Output** | `float` (base ^ exponent) |
| **Memory** | 0 bytes (pure) |
| **C++ Code** | `float powered = powf(base, exponent);` |
| **Constraints** | Pure; useful for brightness/contrast curves |

---

### Sqrt
Square root.

| Property | Value |
|----------|-------|
| **Node Type** | `Sqrt` |
| **Inputs** | `value: float` |
| **Parameters** | *(none)* |
| **Output** | `float` (√value) |
| **Memory** | 0 bytes (pure) |
| **C++ Code** | `float rooted = sqrtf(value);` |
| **Constraints** | Pure; clamps negative input to 0 |

---

### LowPass
**NEW:** 1-pole IIR filter for smoothing envelope/spectrum (Emotiscope feature for decay).

| Property | Value |
|----------|-------|
| **Node Type** | `LowPass` |
| **Inputs** | `signal: float`, `alpha: float` (0.0–1.0, blend factor, default 0.1) |
| **Parameters** | *(none)* |
| **Output** | `float` (filtered value) |
| **Memory** | 4 bytes (last_filtered_value) |
| **C++ Code** | `state.last = state.last * (1.0f - alpha) + signal * alpha;` |
| **Constraints** | **Stateful:** maintains last value between frames |
| **Usage** | Smooth audio envelope, decay trails, reduce jitter in parameter following |
| **Formula** | Output = α × Input + (1 − α) × PriorOutput |

---

### MovingAverage
**NEW:** Rolling window average filter (SensoryBridge for spectrum smoothing).

| Property | Value |
|----------|-------|
| **Node Type** | `MovingAverage` |
| **Inputs** | `signal: float` |
| **Parameters** | `window_size: int` (1–32, default 4) |
| **Output** | `float` (average of last N samples) |
| **Memory** | 4 × window_size bytes (ring buffer) |
| **C++ Code** | `state.ring[state.idx] = signal; float avg = (sum of ring) / window_size; state.idx = (state.idx + 1) % window_size;` |
| **Constraints** | **Stateful:** maintains ring buffer across frames; window_size is compile-time constant |
| **Usage** | Smooth spectrum bands, spectral centroid calculation, multi-frame averaging |

---

### Contrast
**NEW:** S-curve contrast adjustment (similar to GIMP Curves; Emotiscope saturation control).

| Property | Value |
|----------|-------|
| **Node Type** | `Contrast` |
| **Inputs** | `value: float` (0–1), `contrast: float` (0.5–2.0, 1.0 = linear) |
| **Parameters** | *(none)* |
| **Output** | `float` (S-curve adjusted, clamped 0–1) |
| **Memory** | 0 bytes (pure) |
| **C++ Code** | Sigmoid curve: `float s = (value - 0.5) * contrast + 0.5; float adjusted = std::clamp(s, 0.0f, 1.0f);` (simplified) |
| **Constraints** | Pure; contrast < 1.0 → flatten (less contrast), > 1.0 → increase contrast |
| **Usage** | Saturation control, dynamic range compression |

---

## Part 3: Color Nodes (5-6 Types)

### Hsv
Convert HSV (hue, saturation, value) to RGB.

| Property | Value |
|----------|-------|
| **Node Type** | `Hsv` |
| **Inputs** | `h: float` (0–1, wrapping), `s: float` (0–1), `v: float` (0–1) |
| **Parameters** | *(none)* |
| **Output** | `color` (vec3, RGB 0–1 each) |
| **Memory** | 0 bytes (pure) |
| **C++ Code** | `CRGBF rgb = hsv2rgb(h, s, v);` (firmware helper) |
| **Constraints** | Pure; hue wraps modulo 1.0 |

---

### Color
Construct RGB color from explicit R, G, B channels.

| Property | Value |
|----------|-------|
| **Node Type** | `Color` |
| **Inputs** | `r: float`, `g: float`, `b: float` |
| **Parameters** | *(none)* |
| **Output** | `color` (vec3) |
| **Memory** | 0 bytes (pure) |
| **C++ Code** | `CRGBF rgb = {r, g, b};` |
| **Constraints** | Pure; no clamping (deferred to output stage) |

---

### GradientMap
**NEW:** Palette lookup table to map scalar (0–1) to color (Emotiscope/SensoryBridge gradient mode).

| Property | Value |
|----------|-------|
| **Node Type** | `GradientMap` |
| **Inputs** | `index: float` (0–1, palette position) |
| **Parameters** | `palette: enum` ("viridis", "plasma", "hot", "cool", "rainbow", "custom", default "viridis") |
| **Output** | `color` (vec3, RGB 0–1) |
| **Memory** | 0 bytes (palette embedded in code) |
| **C++ Code** | `CRGBF color = gradient_palette[std::clamp((int)(index * 255), 0, 255)];` |
| **Constraints** | Pure; index clamped to [0, 1] |
| **Usage** | Spectrum visualization (map frequency bin energy → color), audio-reactive gradients |
| **Palettes** | Viridis (perceptually uniform), Plasma (high contrast), Hot (warm), Cool (cold), Rainbow (chromatic), Custom (user-defined) |

---

### Desaturate
**NEW:** Grayscale conversion (SensoryBridge monochrome mode).

| Property | Value |
|----------|-------|
| **Node Type** | `Desaturate` |
| **Inputs** | `color: color` (vec3, RGB) |
| **Parameters** | `mode: enum` ("luma", "average", "max", default "luma") |
| **Output** | `color` (vec3, grayscale: [gray, gray, gray]) |
| **Memory** | 0 bytes (pure) |
| **C++ Code** | `float gray = 0.299f * rgb.r + 0.587f * rgb.g + 0.114f * rgb.b; result = {gray, gray, gray};` (luma) |
| **Constraints** | Pure; mode selects different desaturation methods |
| **Usage** | Monochrome mode, brightness extraction |

---

### ForceSaturation
**NEW:** Saturate or desaturate color depending on mode (Emotiscope mood control).

| Property | Value |
|----------|-------|
| **Node Type** | `ForceSaturation` |
| **Inputs** | `color: color` (vec3), `mode: param<bool>` (saturate yes/no) |
| **Parameters** | `strength: float` (0.0–1.0, amount of saturation change, default 1.0) |
| **Output** | `color` (vec3, modified saturation) |
| **Memory** | 0 bytes (pure) |
| **C++ Code** | `if (mode) { HSV hsv = rgb_to_hsv(color); hsv.s = std::clamp(hsv.s + strength, 0.0f, 1.0f); color = hsv_to_rgb(hsv); }` |
| **Constraints** | Pure; controlled by boolean parameter (mood/mood toggle) |
| **Usage** | Mood-driven saturation (happy → saturated, sad → desaturated) |

---

### PaletteSelector
**NEW:** Choose palette by index/enum (future: preset switching).

| Property | Value |
|----------|-------|
| **Node Type** | `PaletteSelector` |
| **Inputs** | `index: float` (0–1) |
| **Parameters** | `palette_set: enum` ("gradients_a", "gradients_b", "moods", default "gradients_a") |
| **Output** | `palette_id` (opaque reference to palette) |
| **Memory** | 0 bytes (pure) |
| **C++ Code** | (Returns palette metadata; used by GradientMap in Phase 2) |
| **Constraints** | Pure; Phase 1 stub; Phase 2 integrates with GradientMap |
| **Usage** | Future: runtime palette switching |

---

## Part 4: Geometry & Buffer Operations (7-8 Types)

### Fill
Create uniform LED buffer with single color.

| Property | Value |
|----------|-------|
| **Node Type** | `Fill` |
| **Inputs** | `color: color` (broadcast to all LEDs) |
| **Parameters** | *(none)* |
| **Output** | `led_buffer<vec3>` (NUM_LEDS × RGB) |
| **Memory** | ~1.2 KB (NUM_LEDS × 4 bytes, 256 LEDs) |
| **C++ Code** | `for (int i = 0; i < NUM_LEDS; i++) buf[i] = color;` |
| **Constraints** | Temporary buffer; lifetime ends at consumer or output |

---

### Blur
Spatial box filter convolution on LED buffer.

| Property | Value |
|----------|-------|
| **Node Type** | `Blur` |
| **Inputs** | `src: led_buffer<vec3>` |
| **Parameters** | `radius: int` (1–5, default 1) |
| **Output** | `led_buffer<vec3>` |
| **Memory** | ~1.2 KB (output buffer) |
| **C++ Code** | `blur_3x(src, out, NUM_LEDS, radius);` (firmware helper) |
| **Constraints** | Pure convolution; wraps at boundaries |

---

### Mirror
**NEW:** Vertical or horizontal mirror/flip of LED buffer (SensoryBridge spatial symmetry).

| Property | Value |
|----------|-------|
| **Node Type** | `Mirror` |
| **Inputs** | `src: led_buffer<vec3>` |
| **Parameters** | `axis: enum` ("vertical", "horizontal", default "vertical") |
| **Output** | `led_buffer<vec3>` (mirrored view or copy) |
| **Memory** | 0 bytes if view; ~1.2 KB if copy (allocator decides) |
| **C++ Code** | `for (int i = 0; i < NUM_LEDS; i++) { out[i] = src[(NUM_LEDS - 1 - i)]; }` (vertical) |
| **Constraints** | Pure function; assumes NUM_LEDS is even for perfect symmetry |
| **Usage** | Spatial symmetry, mirror modes |

---

### Shift
**NEW:** Rotate buffer by offset (circular shift/barrel rotation; Emotiscope spatial effect).

| Property | Value |
|----------|-------|
| **Node Type** | `Shift` |
| **Inputs** | `src: led_buffer<vec3>` |
| **Parameters** | `offset: int` (0–NUM_LEDS, rotation amount, default 0) |
| **Output** | `led_buffer<vec3>` |
| **Memory** | ~1.2 KB (output buffer) |
| **C++ Code** | `for (int i = 0; i < NUM_LEDS; i++) out[i] = src[(i + offset) % NUM_LEDS];` |
| **Constraints** | Pure function; wraps at boundaries |
| **Usage** | Rotating patterns, animation sweep |

---

### Downsample
**NEW:** Reduce LED resolution by taking every Nth pixel (SensoryBridge sparse visualization).

| Property | Value |
|----------|-------|
| **Node Type** | `Downsample` |
| **Inputs** | `src: led_buffer<vec3>` |
| **Parameters** | `factor: int` (2–16, reduction factor, default 2) |
| **Output** | `led_buffer<vec3>` (same size, sparse pixels) |
| **Memory** | ~1.2 KB (output buffer, padded) |
| **C++ Code** | `for (int i = 0; i < NUM_LEDS; i++) { out[i] = (i % factor == 0) ? src[i] : black; }` |
| **Constraints** | Pure; unused pixels set to black (0, 0, 0) |
| **Usage** | Sparse LED visualization, focused regions of interest |

---

### DotRender
**NEW:** Rasterize peak indicators / point markers onto LED buffer (SensoryBridge spectrum peaks, beat pulses).

| Property | Value |
|----------|-------|
| **Node Type** | `DotRender` |
| **Inputs** | `base_buf: led_buffer<vec3>` (optional background), `peak_indices: param<int[]>` (array of positions), `peak_colors: param<color[]>` (array of colors, optional) |
| **Parameters** | `blend_mode: enum` ("add", "replace", "multiply", default "add"), `peak_width: int` (1–3, marker width, default 1) |
| **Output** | `led_buffer<vec3>` |
| **Memory** | ~1.2 KB (output buffer) |
| **C++ Code** | `memcpy(out, base_buf, ...); for (auto idx : peak_indices) { out[idx] = blend(out[idx], dot_color, mode); }` |
| **Constraints** | Semi-stateful (depends on input arrays); blend modes affect appearance |
| **Usage** | Spectrum peak visualization, beat pulse indicators, frequency bands |

---

### ComposeLayers
**NEW:** Blend multiple LED buffers (base + overlay + ...) with blend modes (Emotiscope layering, SensoryBridge effect composition).

| Property | Value |
|----------|-------|
| **Node Type** | `ComposeLayers` |
| **Inputs** | `base: led_buffer<vec3>` (required), `overlay: led_buffer<vec3>` (required), `[additional overlays: optional]` |
| **Parameters** | `blend_mode: enum` ("add", "multiply", "screen", "overlay", default "add"), `opacity: float` (0–1, overlay alpha, default 1.0) |
| **Output** | `led_buffer<vec3>` |
| **Memory** | ~1.2 KB (output buffer) |
| **C++ Code** | `for (int i = 0; i < NUM_LEDS; i++) { out[i] = blend(base[i], overlay[i], mode, opacity); }` |
| **Constraints** | Pure function; blend modes: add (linear sum), multiply (component-wise product), screen (inverse multiply), overlay (context-dependent) |
| **Usage** | Multi-effect layering (base + dots, gradient + sparkle), visual mixing |
| **Blend Formulas** |
| | Add: `out = base + overlay` |
| | Multiply: `out = base × overlay` |
| | Screen: `out = 1 − (1 − base) × (1 − overlay)` |
| | Overlay: `out = (base < 0.5) ? (2 × base × overlay) : (1 − 2 × (1 − base) × (1 − overlay))` |

---

### BufferPersist
Maintain persistent LED buffer across frames with exponential decay (trail/glow effect).

| Property | Value |
|----------|-------|
| **Node Type** | `BufferPersist` |
| **Inputs** | `src: led_buffer<vec3>` (new frame), `decay: float` (0.0–1.0, blend factor) |
| **Parameters** | *(none)* |
| **Output** | `led_buffer<vec3>` (persistent buffer) |
| **Memory** | ~1.2 KB (persistent state buffer) |
| **C++ Code** | `for (int i = 0; i < NUM_LEDS; i++) { state.buf[i] = decay * state.buf[i] + (1 − decay) * src[i]; }` |
| **Constraints** | **Stateful:** allocates once at pattern start; reused every frame |
| **Formula** | Output[i] = decay × PriorOutput[i] + (1 − decay) × Input[i] |
| **Usage** | Bloom/glow trails, comet tails, long decay effects |

---

## Part 5: Noise & Procedural Nodes (3 Types)

### PerlinNoise
**NEW:** Perlin noise generator for procedural effects (Emotiscope organic patterns, SensoryBridge texture).

| Property | Value |
|----------|-------|
| **Node Type** | `PerlinNoise` |
| **Inputs** | `x: float` (0–1 for single-dimensional noise) or `[x, y]: vec2` (2D coordinate) |
| **Parameters** | `seed: uint32` (default 0), `scale: float` (0.01–10.0, frequency, default 1.0), `octaves: int` (1–4, detail, default 1) |
| **Output** | `float` (−1.0–1.0, Perlin noise value) |
| **Memory** | 0 bytes (deterministic; no state needed) |
| **C++ Code** | `float noise = perlin_noise_1d(x * scale, seed) * 0.5f + 0.5f;` (normalize to 0–1) (firmware helper) |
| **Constraints** | Pure but seed-deterministic; NOT eligible for constant folding; RNG cannot feed back into PerlinNoise (no cycles) |
| **Usage** | Organic shimmer, procedural color variation, animated noise texture |
| **Note** | Seed ensures reproducibility; different seeds produce different noise landscapes |

---

### RngSeed
**NEW:** Random number seed node (source for procedural RNG; Phase 2: expand to full RNG range).

| Property | Value |
|----------|-------|
| **Node Type** | `RngSeed` |
| **Inputs** | *(none)* |
| **Parameters** | `seed_value: uint32` (default 0) |
| **Output** | `rng_seed` (uint32, opaque seed reference) |
| **Memory** | 0 bytes |
| **C++ Code** | `uint32_t rng = seed_value;` (read-only constant) |
| **Constraints** | Pure; output cannot feed back to RNG input (cycle detection forbids) |
| **Usage** | Feed seed into PerlinNoise, future random value generation |
| **Phase 1 Note** | Stub; Phase 2 adds full RNG node with range parameters |

---

### PositionAccumulator
**NEW:** Scanline/spiral position generator for geometric patterns (SensoryBridge spatial effects).

| Property | Value |
|----------|-------|
| **Node Type** | `PositionAccumulator` |
| **Inputs** | *(none)* |
| **Parameters** | `mode: enum` ("scanline", "spiral", "radial", default "scanline"), `cycle_length: int` (frames per full cycle, default 60) |
| **Output** | `float` (position scalar, 0–1, wrapping) |
| **Memory** | 0 bytes (computed from frame_count) |
| **C++ Code** | `float pos = fmodf(frame_count / (float)cycle_length, 1.0f);` |
| **Constraints** | Pure, deterministic |
| **Usage** | Animated sweep direction, rotating gradient base, cyclic spatial effect |

---

## Part 6: Output Nodes (2 Types)

### LedOutput
Write buffer to hardware LED strip.

| Property | Value |
|----------|-------|
| **Node Type** | `LedOutput` |
| **Inputs** | `color: led_buffer<vec3>` (required) |
| **Parameters** | *(none)* |
| **Output** | void (writes to global `leds[NUM_LEDS]`) |
| **Memory** | 0 bytes (no local state) |
| **C++ Code** | `for (int i = 0; i < NUM_LEDS; i++) { out.leds[i] = clamped_rgb(color[i]); }` |
| **Constraints** | **Terminal node:** no further processing. Colors **clamped to [0, 1]** before write |

---

### LedOutputMirror
Write buffer to hardware LED strip with vertical mirror symmetry.

| Property | Value |
|----------|-------|
| **Node Type** | `LedOutputMirror` |
| **Inputs** | `color: led_buffer<vec3>` (required) |
| **Parameters** | *(none)* |
| **Output** | void (writes to global `leds[NUM_LEDS]` with mirror) |
| **Memory** | 0 bytes (no local state) |
| **C++ Code** | `for (int i = 0; i < NUM_LEDS/2; i++) { out.leds[i] = clamped_rgb(color[i]); out.leds[NUM_LEDS-1-i] = out.leds[i]; }` |
| **Constraints** | **Terminal node.** Assumes NUM_LEDS is even; mirrors first half to second half. Colors **clamped to [0, 1]** before write |

---

## Summary: Node Categories & Counts

| Category | Count | Examples | Phase 1 Priority |
|----------|-------|----------|------------------|
| **Input Nodes** | 10 | Time, AudioSnapshot, AudioSpectrum, BeatEvent, AutoCorrelation, Chromagram, ParamF, ParamColor, ConfigToggle | ✅ All 10 |
| **Math/Filter** | 10 | Add, Mul, Lerp, Clamp, Pow, Sqrt, LowPass, MovingAverage, Mix, Contrast | ✅ All 10 |
| **Color** | 6 | Hsv, Color, GradientMap, Desaturate, ForceSaturation, PaletteSelector | ✅ All 6 |
| **Geometry/Buffer** | 8 | Fill, Blur, Mirror, Shift, Downsample, DotRender, ComposeLayers, BufferPersist | ✅ All 8 |
| **Noise/Procedural** | 3 | PerlinNoise, RngSeed, PositionAccumulator | ✅ All 3 (stubs OK) |
| **Output** | 2 | LedOutput, LedOutputMirror | ✅ Both |
| **TOTAL** | **39** | — | **✅ All 39 in Phase 1** |

---

## Type System Reference

| Type | C++ Equivalent | Size | Notes |
|------|---|---|---|
| `int` | `int32_t` | 4 bytes | Indices, counts, window sizes |
| `bool` | `bool` | 1 byte | Toggles, mode flags |
| `float` | `float` | 4 bytes | Scalars (0–1 typical) |
| `vec2` | `CRGBF[2]` or custom | 8 bytes | 2D coordinates (future) |
| `vec3` | `CRGBF` or similar | 12 bytes | RGB colors, 3D vectors |
| `color` | alias for `vec3` | 12 bytes | RGB 0–1 per channel |
| `time` | `float` | 4 bytes | Seconds |
| `duration` | `float` | 4 bytes | Delta time |
| `rng_seed` | `uint32_t` | 4 bytes | Random seed |
| `audio_spectrum` | `float[NUM_FREQS]` | ~256 bytes | FFT bins (64 bins default) |
| `audio_envelope` | `float` | 4 bytes | VU/energy scalar |
| `beat_event` | `bool` | 1 byte | Pulse on beat |
| `chroma_vector` | `float[12]` | 48 bytes | 12-point chroma vector |
| `param<float>` | `float` | 4 bytes | Float parameter from UI |
| `param<color>` | `CRGBF` | 12 bytes | Color parameter from UI |
| `param<bool>` | `bool` | 1 byte | Boolean parameter from UI |
| `led_buffer<float>` | `float[NUM_LEDS]` | ~1 KB | Per-LED scalar |
| `led_buffer<vec3>` | `CRGBF[NUM_LEDS]` | ~1.2 KB | Per-LED RGB |

---

## Coercion Rules (Explicit Only)

**No implicit buffer conversions allowed.**

| From | To | Method | Notes |
|------|----|----|---|
| `int` | `float` | Implicit widening | Safe |
| `float` | `int` | Explicit Cast node (Phase 2) | Potential precision loss |
| `float` → `color` | Fill node (broadcast) | Broadcast to all channels |
| `color` → `led_buffer<vec3>` | Fill node | Broadcast to all LEDs |
| `vec3` ↔ `color` | Alias | Bidirectional (same type) |
| `audio_spectrum` → scalar | Aggregation node (Phase 2) | Sum, mean, max, centroid |
| `audio_spectrum` → `led_buffer<vec3>` | GradientMap + Fill | Map frequency bin to color |
| `beat_event` → `float` | Explicit Cast (Phase 2) | 1.0 on pulse, 0.0 otherwise |
| `chroma_vector` → any | **FORBIDDEN (Phase 1)** | Phase 2: explicit unpack node |

---

## Node Constraints & Execution Order

### Pure Nodes (No State, Reorderable)
- Time, AudioSnapshot, AudioSpectrum, Add, Mul, Mix, Lerp, Clamp, Pow, Sqrt, Contrast, Hsv, Color, GradientMap, Desaturate, ForceSaturation, PaletteSelector, Fill, Blur, Mirror, Shift, Downsample, DotRender, ComposeLayers, PerlinNoise, PositionAccumulator
- **Properties:** Deterministic, idempotent, side-effect-free
- **Optimization:** Eligible for constant folding, CSE, reordering

### Stateful Nodes (Maintain State, NOT Reorderable)
- BeatEvent (hysteresis tracking), LowPass (filter state), MovingAverage (ring buffer), BufferPersist (persistent LED buffer)
- **Properties:** Maintain internal state between frames; order matters
- **Constraints:** Memory <1 KB per node (ADR-0007); state initialized once at pattern start
- **Optimization:** NOT eligible for CSE or reordering; preserve execution order

### Terminal Nodes (No Output, Pattern Root)
- LedOutput, LedOutputMirror
- **Properties:** Write to hardware; one or more must be in graph
- **Constraints:** Cannot be reordered; must execute last

### Special Constraints
- **Cycle-free:** DAG only; topological sort required
- **Port connectivity:** Required inputs must be connected OR have declared defaults
- **Type compatibility:** Port types must match or be coercible
- **Memory budget:** All stateful buffers <1 KB per node; temp buffers <16 KB total (pooled)
- **Color range:** All color outputs automatically clamped to [0, 1] at final write
- **RNG safety:** RNG outputs cannot feed back to RNG inputs (cycle detection forbids)

---

## Example Graphs

### Bloom + Mirror (Emotiscope-style)
```json
{
  "version": 1,
  "name": "bloom_mirror",
  "nodes": [
    {"id": "audio", "type": "AudioSnapshot", "inputs": {}, "params": {}},
    {"id": "lowpass", "type": "LowPass", "inputs": {"signal": "audio"}, "params": {"alpha": 0.1}},
    {"id": "persist", "type": "BufferPersist", "inputs": {"src": "fill1", "decay": "lowpass"}, "params": {}},
    {"id": "color", "type": "Hsv", "inputs": {"h": "time_node", "s": "param_sat", "v": "audio"}, "params": {}},
    {"id": "fill1", "type": "Fill", "inputs": {"color": "color"}, "params": {}},
    {"id": "mirror", "type": "LedOutputMirror", "inputs": {"color": "persist"}, "params": {}}
  ]
}
```

### Spectrum + GradientMap (SensoryBridge-style)
```json
{
  "version": 1,
  "name": "spectrum_gradient",
  "nodes": [
    {"id": "spectrum", "type": "AudioSpectrum", "inputs": {}, "params": {}},
    {"id": "grad0", "type": "GradientMap", "inputs": {"index": "spectrum[0]"}, "params": {"palette": "viridis"}},
    {"id": "fill_spectrum", "type": "Fill", "inputs": {"color": "grad0"}, "params": {}},
    {"id": "dots", "type": "DotRender", "inputs": {"base_buf": "fill_spectrum"}, "params": {"peak_width": 2}},
    {"id": "out", "type": "LedOutput", "inputs": {"color": "dots"}, "params": {}}
  ]
}
```

**Note:** These examples use simplified syntax. Full graph JSON must follow `graph.schema.json` validation rules.

---

## Integration Checklist (for Compiler Implementation)

- [ ] Parse `graph.schema.json` to validate all 39 node types
- [ ] For each node type (39 total), implement:
  - [ ] Parser recognition
  - [ ] Type validation (inputs/outputs)
  - [ ] Optimizer rules (pure vs. stateful, CSE eligibility)
  - [ ] Scheduler allocation (memory footprint, lifetime)
  - [ ] C++ code generation (node-specific emitter)
- [ ] Create fixtures with Bloom, Spectrum, beat_pulse, filter_chain examples
- [ ] E2E test: graph → C++ → compile → simulate → CRC validation

---

## Phase 1 vs. Phase 2 Roadmap

### Phase 1 (Complete, Nodes 1-39)
- ✅ All 39 core node types
- ✅ 5-stage compiler pipeline
- ✅ Bloom + Spectrum PoCs validated on hardware
- ✅ Stateful node integration

### Phase 2 (Future: Additional Features & Nodes)
- Chromagram unpacking (explicit node to unpack 12 chroma bins)
- Expanded color operations (palette switching, color space conversions)
- Frequency band aggregation nodes (sum 5-10 spectrum bins)
- Advanced blend modes, fractional shifts
- User-defined node types / script-based patterns
- Conditional branches (if/else based on param toggle)
- **Stretch:** Real-time node editing UI, pattern presets

---

**Document Version:** 2.0 (Expanded Scope)
**Status:** Reference (Phase 1 Implementation)
**Last Updated:** November 10, 2025


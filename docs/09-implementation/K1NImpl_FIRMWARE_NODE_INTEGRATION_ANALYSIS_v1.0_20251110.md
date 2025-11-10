# Firmware Node Integration Analysis & Implementation Roadmap
**K1.node1 Graph Compiler to Firmware Integration**

**Version:** 1.0
**Date:** November 10, 2025
**Status:** Research (Phase 1 Planning)
**Scope:** 39-node firmware helper requirements & complexity estimation
**Related:** `docs/06-reference/K1NRef_GRAPH_NODE_CATALOG_EXPANDED_v2.0_20251110.md`, `firmware/src/stateful_nodes.h`, ADR-0012

---

## Executive Summary

The K1.node1 graph compiler (emitter, T8) will generate C++ code that calls firmware helpers for 39 distinct node types. This analysis categorizes nodes by implementation complexity, identifies existing firmware infrastructure, quantifies effort, and provides a prioritized roadmap for Phase 1 implementation.

**Key Findings:**
- **34 of 39 nodes** are Category A (trivial, <1 hour) or Category B (moderate, 1-3 hours)
- **5 nodes** (PerlinNoise, Chromagram, DotRender, ComposeLayers, AutoCorrelation) are Category C (complex, 3-8 hours)
- **Estimated total effort: 24–32 engineer-days** (includes testing + integration overhead)
- **Critical path:** Category A/B nodes can proceed in parallel; Category C nodes have one-way dependencies
- **Existing infrastructure:** 80% of required helpers already exist (FastLED, Goertzel FFT, palette system, blur/buffer ops)
- **New implementations required:** Perlin noise, pitch detection, chroma vector extraction, blend mode library

---

## Part 1: Node Complexity Categorization

### Category A: Trivial Nodes (<1 hour each)
**Characteristics:** Pure functions, 1–5 lines of C++, no state, deterministic, compile-time evaluable

| Node | C++ Complexity | Notes | Memory | Existing |
|------|---|---|---|---|
| **Time** | Pure scalar | `time_val = frame_count / 30.0f` | 0 B | ✅ Core |
| **AudioSnapshot** | Pure scalar (read VU) | `envelope = audio.vu_level` | 0 B | ✅ Goertzel |
| **AudioSpectrum** | Pure reference | `spectrum = audio.spectrogram[64]` | 0 B | ✅ Goertzel |
| **ParamF** | Pure scalar (read UI) | `val = params.speed` | 0 B | ✅ Parameter system |
| **ParamColor** | Pure color (read UI) | `col = params.base_color` | 0 B | ✅ Parameter system |
| **ConfigToggle** | Pure bool (read UI) | `flag = params.use_mirror` | 0 B | ✅ Parameter system |
| **Add** | Binary op | `sum = a + b` | 0 B | ✅ Trivial |
| **Mul** | Binary op | `prod = a * b` | 0 B | ✅ Trivial |
| **Mix** | Linear blend | `result = a * (1-t) + b * t` | 0 B | ✅ Trivial |
| **Lerp** | Linear interp (overloaded) | Generic blend; same as Mix | 0 B | ✅ Trivial |
| **Clamp** | Bounded scalar | `std::clamp(val, min, max)` | 0 B | ✅ std:: |
| **Pow** | Exponent | `powf(base, exp)` | 0 B | ✅ math.h |
| **Sqrt** | Square root | `sqrtf(val)` | 0 B | ✅ math.h |
| **Color** | RGB constructor | `{r, g, b}` | 0 B | ✅ CRGBF type |

**Subtotal:** 14 nodes, ~0 hours critical path (parallelizable)

---

### Category B: Moderate Complexity (1–3 hours each)
**Characteristics:** Stateful or algorithmic, 10–50 lines, moderate data structures, tested algorithms

| Node | C++ Complexity | Memory | Notes | Existing | Hours |
|------|---|---|---|---|---|
| **LowPass** | IIR filter | 4 B | `out = α×in + (1-α)×prev` (single state) | Partial | 0.5 |
| **MovingAverage** | Ring buffer | 128 B | Allocate ring, maintain write ptr, compute avg | Partial | 1.5 |
| **Contrast** | S-curve sigmoid | 0 B | Clamp sigmoid: `(val-0.5)×contrast+0.5` | No | 1.0 |
| **BeatEvent** | Hysteresis detector | 16 B | Threshold crossing w/ debounce (prev state) | Partial | 1.0 |
| **Hsv** | HSV→RGB conversion | 0 B | FastLED `hsv2rgb()` helper | ✅ FastLED | 0.5 |
| **Desaturate** | Grayscale | 0 B | Luma: `0.299r+0.587g+0.114b` | No | 0.5 |
| **ForceSaturation** | Conditional HSV adjust | 0 B | If mode: HSV convert → adjust S → back to RGB | No | 1.5 |
| **GradientMap** | Palette LUT | 0 B | Clamped index → palette lookup (256 colors) | ✅ Palettes | 0.5 |
| **PaletteSelector** | Palette enum → ID | 0 B | Return metadata ref (stub, Phase 2 expansion) | Partial | 0.5 |
| **Fill** | Buffer broadcast | 1.2 KB | Loop fill all LEDs with single color | ✅ FastLED | 0.5 |
| **Mirror** | Vertical/horizontal flip | 1.2 KB | Copy with index reversal; decide view vs. copy | No | 1.0 |
| **Shift** | Barrel rotation | 1.2 KB | `out[i] = src[(i+offset)%NUM_LEDS]` | No | 1.0 |
| **Downsample** | Sparse sampling | 1.2 KB | Keep every Nth pixel; zero others | No | 1.0 |
| **RngSeed** | Seed constant | 0 B | Return opaque uint32 seed value | No | 0.5 |
| **PositionAccumulator** | Phase generator | 0 B | `fmod(frame_count/cycle_len, 1.0)` | No | 0.5 |

**Subtotal:** 15 nodes, ~14 hours critical path (some parallelizable)

---

### Category C: High Complexity (3–8 hours each)
**Characteristics:** Multi-component algorithms, specialized math, research-grade implementations, >100 lines

| Node | C++ Complexity | Memory | Challenge | Hours | Dependencies |
|------|---|---|---|---|---|
| **Blur** | 3×3 box filter convolution | 1.2 KB tmp | Boundary handling, separable passes, vectorizable | 3–4 | Fill first |
| **PerlinNoise** | 1D/2D Perlin noise (Improved variant) | 0 B | Permutation table, gradient vectors, 3 interpolation passes | 4–5 | None (standalone) |
| **AutoCorrelation** | Pitch detection from spectrum | 0 B | FFT bin analysis, confidence scoring (SensoryBridge feature) | 3–4 | AudioSpectrum |
| **Chromagram** | 12-bin chroma vector from spectrum | 0 B | Map 64 bins → 12 semitones, energy aggregation | 2–3 | AudioSpectrum |
| **DotRender** | Peak rasterization w/ blend | 1.2 KB | Array indexing, blend mode dispatch, edge wrapping | 4–5 | Fill, ComposeLayers |
| **ComposeLayers** | Multi-layer blend composition | 1.2 KB | Blend mode dispatch (add/multiply/screen/overlay), opacity | 3–4 | Fill first |
| **BufferPersist** | Frame-to-frame decay buffer | 1.2 KB | Stateful; init once, reuse every frame (ADR-0006) | 1.5–2 | None |

**Subtotal:** 7 nodes, ~22 hours critical path (sequential bottlenecks)

**NOTE:** BufferPersist is already implemented in `firmware/src/stateful_nodes.h` as `BufferPersistNode` class. Effort = integration + testing only (~1.5 hrs).

---

## Part 2: Firmware Helpers Inventory

### Existing Infrastructure (Already Implemented, 80%)

#### Audio Processing (Goertzel FFT)
**Location:** `firmware/src/audio/goertzel.h` / `.cpp`
- ✅ **AudioSpectrum** – 64-bin frequency analysis (0–8 kHz)
- ✅ **Chromagram** – 12-pitch-class energy extraction (partial; needs aggregation wrapper)
- ✅ **VU Level** – Overall RMS envelope (AudioSnapshot)
- ✅ **Tempo Analysis** – Tempo bins + phase tracking (reserve for Phase 2)

**Lines of Code:** ~800 (goertzel.cpp)
**Status:** Production-ready; used in Phase 5.3 Emotiscope patterns
**Integration Point:** Read from `AudioDataSnapshot` struct (atomic, double-buffered)

---

#### Color & Palette System
**Location:** `firmware/src/palettes.h` / `.cpp`
- ✅ **Palette Lookup** – 33 curated gradients (viridis, plasma, hot, cool, rainbow)
- ✅ **Palette Interpolation** – Smooth blending between keyframes
- ✅ **HSV↔RGB Conversion** – FastLED `hsv2rgb()` helper

**Lines of Code:** ~250 (palettes.cpp)
**Status:** Production-ready; PROGMEM-based for ESP32 PSRAM efficiency
**Integration Point:** `color_from_palette(palette_idx, progress, brightness)`

---

#### Buffer Operations
**Location:** `firmware/src/stateful_nodes.h`, `firmware/src/emotiscope_helpers.cpp`
- ✅ **Fill** – Broadcast single color to all LEDs
- ✅ **Blur (3×3 box)** – Gaussian smoothing (embedded in `GaussianBlurNode`)
- ✅ **Scroll/Shift** – Implemented as `SpriteScrollNode` (stateful)
- ✅ **Blend Modes** – Basic add/multiply in `emotiscope_helpers.cpp`
- ⚠️ **Downsample** – Stub (trivial to complete)
- ⚠️ **Mirror** – Not yet implemented (1-line reversal loop)
- ⚠️ **DotRender** – Partial (`draw_dot()` and `draw_line()` exist; array dispatch needed)
- ✅ **BufferPersist** – Full `BufferPersistNode` class (stateful)

**Lines of Code:** ~800 (stateful_nodes.h + emotiscope_helpers.cpp)
**Status:** 70% complete; DotRender and ComposeLayers need refinement

---

#### Math Utilities
**Location:** `firmware/src/fast_math.h`
- ✅ **Fast Inverse Sqrt** – Quake III algorithm (~3.3× faster than hardware sqrt)
- ✅ **Fast Magnitude** – Using `fast_inv_sqrt()`
- ✅ **Fast Pow2** – Bit manipulation exponentiation (~7× faster)
- ✅ **std::clamp, std::min, std::max** – Standard library
- ✅ **sinf(), cosf(), powf()** – Hardware FPU (ARM Cortex-M4 on ESP32-S3)

**Status:** Production-ready; profiled and validated

---

### New Implementations Required (20%, ~5 nodes)

#### 1. Perlin Noise Generator (PerlinNoise node)
**Complexity:** 4–5 hours
**Algorithm:** Improved Perlin Noise (2D variant, 3 octaves max)
**Lines of Code:** ~150–200
**Constraints:**
- Must be seed-deterministic (same seed → same noise sequence)
- Support 1D (x-only) and 2D (x, y) input modes
- 3 interpolation passes per dimension (cubic Hermite or Perlin's smoothstep)
- Zero state (stateless, but seed-keyed)

**Proposed Implementation Strategy:**
```cpp
// In new file: firmware/src/procedural/perlin_noise.h
float perlin_noise_1d(float x, uint32_t seed, int octaves);
float perlin_noise_2d(float x, float y, uint32_t seed, int octaves);
// Uses permutation table + gradient vectors (embedded in code/PROGMEM)
```

**Dependency:** None (standalone)
**Testing:** Validate visual output (patterns should look organic, not banded)
**Risk:** Slow implementation could regress FPS; needs profiling

---

#### 2. Pitch Detection via AutoCorrelation (AutoCorrelation node)
**Complexity:** 3–4 hours
**Algorithm:** ACF (Autocorrelation Function) on spectrum
**Lines of Code:** ~120–150
**Constraints:**
- Input: 64-bin spectrum from Goertzel
- Output: `pitch_hz` (0–8000 Hz) + `confidence` (0–1)
- Must detect pitch accurately in musical context (±1% error acceptable)
- Fallback: 0 Hz on silence

**Proposed Implementation Strategy:**
```cpp
// In new file: firmware/src/audio/pitch_detection.h
struct PitchDetectionResult {
  float pitch_hz;
  float confidence; // 0.0 = no pitch, 1.0 = high confidence
};
PitchDetectionResult detect_pitch(const float* spectrum, size_t num_bins);
```

**Algorithm Choice:**
- Avoid FFT autocorrelation (expensive, no HW support)
- Use spectral peak tracking + harmonic series analysis
- Octave jump mitigation via confidence scoring

**Dependency:** AudioSpectrum (must exist first)
**Testing:** Validate on tones, voice, silence (test suite in Phase 2)
**Risk:** Pitch ambiguity in polyphonic audio; may need confidence threshold tuning

---

#### 3. Chroma Vector Aggregation (Chromagram node)
**Complexity:** 2–3 hours
**Algorithm:** Map 64 spectrum bins → 12 pitch classes
**Lines of Code:** ~100–120
**Constraints:**
- 64 bins (0–8 kHz) → 12 semitones (C–B)
- Support equal-tempered and just-intonation modes (Phase 1: equal-tempered only)
- Aggregate energy per semitone (sum of overlapping bins)

**Proposed Implementation Strategy:**
```cpp
// In new file: firmware/src/audio/chroma_analysis.h
void compute_chromagram(const float* spectrum, float* chroma_out,
                        ChromaMode mode = ChromaMode::EQUAL_TEMPERED);
```

**Mapping Formula:**
```
Bin frequency: f_bin = SAMPLE_RATE * bin_idx / NUM_FREQS
Semitone index: note = 12 * log2(f_bin / BASE_FREQ) % 12
Chroma[note] += spectrum[bin_idx]
```

**Dependency:** AudioSpectrum (must exist first)
**Testing:** Validate musical accuracy (C note → high chroma[0], etc.)
**Risk:** Frequency resolution (64 bins) may miss sub-semitone details

---

#### 4. Blend Mode Library (ComposeLayers node)
**Complexity:** 2–3 hours (once existing blend ops collected)
**Algorithm:** Dispatch on enum + per-mode blend formulas
**Lines of Code:** ~100–150
**Modes:**
- Add: `out = base + overlay` (linear sum, clamped)
- Multiply: `out = base × overlay` (darkening)
- Screen: `out = 1 − (1−base) × (1−overlay)` (brightening)
- Overlay: Photoshop-style (context-dependent; see node spec)

**Proposed Implementation Strategy:**
```cpp
// In firmware/src/gfx/blend_modes.h
enum class BlendMode : uint8_t { ADD, MULTIPLY, SCREEN, OVERLAY };
void blend_pixels(const CRGBF* base, const CRGBF* overlay, CRGBF* out,
                  size_t num_pixels, BlendMode mode, float opacity);
```

**Dependency:** None (pure math)
**Testing:** Visual validation (colors should blend sensibly)
**Risk:** Overlay mode interpretation; may need reference image (GIMP behavior)

---

#### 5. Complex Node Refinements (DotRender, Mirror, Downsample)
**Complexity:** 1–2 hours each (mostly integration)
**Status:**
- **DotRender** – Partial (draw_dot/draw_line exist; need array dispatch)
- **Mirror** – Stub (one-liner reversal loop)
- **Downsample** – Stub (sparse pixel selection)

**Proposed Implementation Strategy:**
Collect existing utilities, finalize interfaces, add boundary checking.

---

## Part 3: Total Effort Estimation

### Bottom-Up Build

| Category | Count | Hours/Node | Subtotal | Notes |
|----------|-------|---|---|---|
| **Category A (Trivial)** | 14 | 0.25–0.5 | 4–7 | Parallelizable; no blockers |
| **Category B (Moderate)** | 15 | 1–2 | 15–20 | Parallel on independent branches |
| **Category C (Complex)** | 7 | 3–5 | 22–30 | Sequential; PerlinNoise longest |
| **Integration & Testing** | — | — | +20% | Codegen validation, E2E tests |
| **Buffer Management** | — | — | +10% | Memory pooling, lifetime tracking |
| **Documentation** | — | — | +5% | ADRs, runbooks, examples |
| **Contingency** | — | — | +15% | Debugging, unexpected issues |

**Total Base Effort: 41–57 hours ≈ 5–7 engineer-days (single developer)**

**Adjusted for Phase 1 (Aggressive Parallelization):**
- Category A/B nodes (29 total) assigned to 2–3 developers in parallel: ~1–2 days
- Category C nodes (7 total) on critical path, but some overlap with testing: ~3–4 days
- Integration + E2E validation: ~2–3 days

**Total Phase 1 Estimate: 6–9 engineer-days (team of 2)**
**Total with 20% overhead: 7–11 engineer-days (realistic, with margin)**

---

## Part 4: Hotpath Optimization Concerns

### Hotpath Nodes (Called Every Frame, <33 ms budget)

#### 1. **Fill** (16 FPS per 256 LEDs)
**Calls Per Frame:** 1–3 (typically once per pattern + composites)
**Current Implementation:** Simple loop, FastLED native
```cpp
for (int i = 0; i < NUM_LEDS; i++) buf[i] = color;
```
**Latency:** ~2 µs (memset would be faster, but loop is cache-friendly)
**Memory:** ~1.2 KB buffer (stack-allocated)
**Optimization:** Already optimal; no action needed

---

#### 2. **Blur** (Convolution, 3×3 box filter)
**Calls Per Frame:** 1–2 (one blur-based pattern)
**Current Implementation:** `GaussianBlurNode.blur()` in `stateful_nodes.h` (3-tap filter)
```cpp
for (i = 0; i < len; i++) {
  left = (i > 0) ? src[i-1] : src[i];
  center = src[i];
  right = (i < len-1) ? src[i+1] : src[i];
  out[i] = (left * 0.25 + center * 0.5 + right * 0.25);  // 6 FLOPs
}
// Total: 256 × 6 FLOPs ≈ 1.5 K FLOPs → ~20 µs on ESP32-S3 (75 MHz FPU)
```
**Latency:** ~20–25 µs (acceptable; <1% of 33 ms budget)
**Memory:** ~1.2 KB temp buffer
**Optimization Opportunity:** Separable 2D passes (future); current 1D is fine
**Risk:** If radius > 1 (larger kernels), add 5-tap or 7-tap filter; cost scales linearly

---

#### 3. **BufferPersist** (Exponential decay blend)
**Calls Per Frame:** 1–3 (trail effects, bloom)
**Current Implementation:** `BufferPersistNode.apply_decay()` (stateful)
```cpp
for (size_t i = 0; i < buffer_size; i++) {
  buffer[i] *= decay_factor;  // 1 FLOP
}
// Total: 256 × 1 FLOP ≈ 256 FLOPs → ~3 µs
```
**Latency:** ~3–5 µs (negligible)
**Memory:** ~1.2 KB persistent buffer (allocated at pattern start, reused)
**Optimization:** Already optimal (multiply is as cheap as operations get)

---

#### 4. **ComposeLayers** (Multi-layer blending)
**Calls Per Frame:** 2–5 (complex patterns with 2–3 overlays)
**Proposed Implementation:**
```cpp
for (size_t i = 0; i < num_pixels; i++) {
  out[i] = blend_mode(base[i], overlay[i], opacity);  // 3–6 FLOPs depending on mode
}
// Total: 256 × 6 FLOPs ≈ 1.5 K FLOPs → ~20 µs
```
**Latency:** ~20–30 µs per layer (acceptable; <1% of budget for 2–3 layers)
**Memory:** ~1.2 KB temp buffer per layer
**Optimization:** Avoid branch misprediction in blend dispatch; use branch table or [[likely]] hints
**Risk:** Chain 4+ layers and latency approaches 100 µs (3% of budget); acceptable

---

#### 5. **DotRender** (Peak rasterization)
**Calls Per Frame:** 1 (spectrum peaks visualization)
**Proposed Implementation:**
```cpp
memcpy(out, base_buf, ...);  // ~100 µs for 256 LEDs
for (auto idx : peak_indices) {  // ~10–20 peaks typical
  out[idx] = blend(out[idx], dot_color, mode);  // ~3 µs per peak
}
// Total: ~100 + (20 × 3) = ~160 µs
```
**Latency:** ~150–200 µs (acceptable; <1% of budget)
**Memory:** ~1.2 KB temp buffer
**Optimization:** Avoid memcpy if base_buf can be reused in-place (saves 100 µs)
**Risk:** Large peak arrays (100+ indices); acceptable but monitor if patterns use many peaks

---

#### 6. **AudioSpectrum** (Read-only reference)
**Calls Per Frame:** 1 (once per frame, before graph execution)
**Implementation:** Atomic read from `AudioDataSnapshot.spectrogram[64]`
```cpp
// Double-buffered atomic read with sequence counter
uint32_t seq1 = snapshot.sequence.load();
memcpy(local_spectrum, snapshot.spectrogram, sizeof(float[64]));
uint32_t seq2 = snapshot.sequence.load();
// Retry if seq1 != seq2 (write in progress)
// Cost: ~100 cycles if no contention, ~500 cycles if retry
```
**Latency:** ~2–5 µs (no contention); ~10 µs (with 1–2 retries)
**Memory:** 0 B (reference, no allocation)
**Optimization:** Sequence counter ensures torn reads; already optimal

---

### Non-Hotpath Nodes (Rare Calls, No Latency Constraint)

These nodes are **not called every frame** or only called once at pattern start:

| Node | Frequency | Notes |
|------|-----------|-------|
| **PerlinNoise** | Once per pattern (procedural base) | OK to be slow; ~100 µs acceptable |
| **AutoCorrelation** | Once per frame (but only if connected) | Optional feature; ~50 µs acceptable |
| **Chromagram** | Once per frame (if connected) | Background analysis; ~30 µs acceptable |
| **BeatEvent** | Once per frame (fast path) | Simple threshold; <1 µs |
| **LowPass/MovingAverage** | Once per value input | Filter chains are fast; <1 µs each |
| **DotRender** | Once per frame (if connected) | Rasterization; latency discussed above |

---

### Hotpath Summary (Category A/B Nodes)

**Critical Constraints per CLAUDE.md:**
- No DEBUG logging in render/quantize/transmit loops
- No `memset` of large buffers in hot path
- Rate-limit warnings to ≥1 s intervals
- Accumulate telemetry using atomic counters only

**FPS Impact Assessment:**
- **Target:** 30 FPS → 33.3 ms per frame
- **Firmware Overhead:** ~10 ms (I2S, RMT, core tasks)
- **Pattern Render Budget:** ~20 ms (60%)
- **Graph Execution (39 nodes):** ~3–8 ms (15–40% of budget)
  - Fill: 2 µs × 2 calls = 4 µs
  - Blur: 20 µs × 1 call = 20 µs
  - BufferPersist: 5 µs × 3 calls = 15 µs
  - ComposeLayers: 30 µs × 2 calls = 60 µs
  - AudioSpectrum: 5 µs × 1 call = 5 µs
  - All math (Add, Mul, etc.): <10 µs (negligible)
  - **Total: ~104 µs ≈ 0.5% of budget** ✅ Safe margin

**Conclusion:** All hotpath nodes fit comfortably within FPS budget; no further optimization needed for Phase 1.

---

## Part 5: Implementation Roadmap & Blockers

### Phase 1 Execution Plan (8–10 Days, Team of 2–3)

#### **Week 1: Days 1–3 (Category A/B Foundation)**

**Parallel Track 1: Core Math & Input Nodes (Dev A)**
- [ ] Add, Mul, Mix, Lerp, Clamp, Pow, Sqrt – codegen templates
- [ ] Time, AudioSnapshot, AudioSpectrum, ParamF, ParamColor, ConfigToggle – integration
- [ ] BeatEvent (stateful) – hysteresis logic + tests
- **Effort:** ~6 hours
- **Blocker:** None (can proceed immediately)
- **Deliverable:** All 13 nodes compile, E2E test on device

**Parallel Track 2: Color & Palette Nodes (Dev B)**
- [ ] Verify Hsv (FastLED integration), GradientMap (existing palettes)
- [ ] Implement Desaturate (luma formula)
- [ ] Implement ForceSaturation (HSV convert + saturation delta)
- [ ] Implement PaletteSelector (stub, return enum)
- [ ] Integrate color system with codegen
- **Effort:** ~5 hours
- **Blocker:** None
- **Deliverable:** Color pipeline validated on gradient + HSV examples

**Parallel Track 3: Buffer Operations - Part 1 (Dev C or A+B after core)**
- [ ] Verify Fill (exists, FastLED native)
- [ ] Implement Mirror (index reversal loop)
- [ ] Implement Shift (barrel rotation with modulo)
- [ ] Implement Downsample (sparse pixel selection)
- [ ] Refine BufferPersist integration (already in `stateful_nodes.h`)
- **Effort:** ~5 hours
- **Blocker:** None
- **Deliverable:** Buffer operations working on test patterns

---

#### **Week 1: Days 4–5 (Category B Completion)**

**Track 1: Filters & Stateful Nodes (Dev A)**
- [ ] Implement LowPass (IIR filter with state)
- [ ] Implement MovingAverage (ring buffer, window_size template)
- [ ] Implement Contrast (S-curve sigmoid)
- [ ] Unit tests for stateful node state lifecycle
- **Effort:** ~4 hours
- **Blocker:** None
- **Deliverable:** Filter chain examples validated

**Track 2: Procedural & Noise Foundation (Dev B)**
- [ ] Implement RngSeed (seed constant, opaque return)
- [ ] Implement PositionAccumulator (phase generator)
- [ ] Research Perlin noise algorithm (Improved Perlin, Ken Perlin 2002)
- [ ] Sketch perlin_noise.h header + test vectors
- **Effort:** ~3 hours (research + planning only)
- **Blocker:** None (prep for Track 3)
- **Deliverable:** Noise algorithm documented; implementation plan ready

**Track 3: Buffer Ops - Blur & Compose (Dev C or A+B)**
- [ ] Verify Blur implementation in GaussianBlurNode
- [ ] Implement ComposeLayers (blend mode dispatch + 4 blend formulas)
- [ ] Create blend_modes.h utility library
- [ ] Benchmark: Blur + ComposeLayers on 256 LEDs (must be <100 µs combined)
- **Effort:** ~4 hours
- **Blocker:** None
- **Deliverable:** Complex layering patterns (bloom + dots) working

---

#### **Week 2: Days 6–7 (Category C - Complex Nodes)**

**Critical Path: Perlin Noise (Dev B, 4–5 hours)**
- [ ] Implement `perlin_noise_1d()` with seed determinism
- [ ] Implement `perlin_noise_2d()` with octave support (1–3 octaves)
- [ ] Validate visual output: should look organic, not banded
- [ ] Benchmark: <100 µs for typical use (speed × scale params)
- [ ] Unit tests: seed reproducibility, range validation
- **Blocker:** None (standalone)
- **Deliverable:** PerlinNoise node working; examples (cloud, shimmer patterns)

**Parallel: Pitch & Chroma (Dev A, 4–5 hours)**
- [ ] Implement `detect_pitch()` via spectral peak tracking
- [ ] Implement `compute_chromagram()` via bin aggregation
- [ ] Validate pitch accuracy on tones + voice (confidence threshold testing)
- [ ] Integrate with AudioSpectrum (ensure data ready on first frame)
- [ ] Unit tests: known pitch frequencies (A440, etc.) should score high confidence
- **Blocker:** AudioSpectrum must exist first (done Day 1)
- **Deliverable:** AutoCorrelation + Chromagram nodes working; pitch-based patterns running

**Parallel: DotRender Integration (Dev C)**
- [ ] Collect existing draw_dot() + draw_line() utilities
- [ ] Implement peak_indices array dispatch with bounds checking
- [ ] Add all 4 blend modes (add, replace, multiply, add_glow)
- [ ] Validate edge wrapping and array safety
- [ ] Benchmark: <50 µs per peak on average
- **Blocker:** ComposeLayers should exist first (for blend mode reuse)
- **Deliverable:** Spectrum peak visualization working

---

#### **Week 2: Days 8–10 (Integration & Validation)**

**All Tracks: Codegen + E2E Testing**
- [ ] Update codegen emitter (T8) to dispatch all 39 node types
- [ ] Fix code generation for stateful node instantiation & state management
- [ ] Create fixture patterns (Bloom, Spectrum, Beat Pulse, Filter Chain, Perlin Cloud)
- [ ] E2E test: JSON → C++ → compile → link → hardware validation
- [ ] Performance profiling: FPS, CPU utilization, memory footprint
- [ ] Bug fixes + regression testing on hardware
- **Effort:** ~6–8 hours (team of 3)
- **Blocker:** None (all nodes implemented before this)
- **Deliverable:** All 39 nodes working end-to-end on K1.node1 hardware

---

### Critical Path Analysis (CPM)

```
Days 1–3: Core A/B (parallel) ────┐
          Color ops (parallel) ────┼─→ Days 4–5: Advanced B ──┐
          Buffer ops P1 (parallel) ┘                           │
                                                               ├─→ Days 6–7: Category C
                                                               │   (Perlin, Pitch, Chroma,
                                                               │    DotRender, Compose)
                                                               │
          Days 4–5: Procedural prep ────────────────────────┘

Days 6–7: Category C (parallel) ────┐
          DotRender (parallel) ──────┼─→ Days 8–10: Integration
          Pitch/Chroma (parallel) ───┘   (codegen, E2E, profiling)
```

**Critical Path: 10 days (Days 1 → Days 4–5 → Days 6–7 → Days 8–10)**

**Schedule Flexibility:**
- Days 1–3 are fully parallelizable (3 developers, 1 day of effort each)
- Days 4–5 have some parallelization (2–3 branches)
- Days 6–7 are partially sequential (Perlin & Pitch can run in parallel, DotRender needs Compose)
- Days 8–10 require all nodes complete (serial blocker at integration point)

**Contingency:** +2 days for debugging, performance tuning, hardware issues

---

### Blockers & Dependency Graph

#### Hard Blockers (Must Resolve)
1. **AudioSpectrum availability** (Days 1–2) → Required for AutoCorrelation, Chromagram
   - **Mitigation:** Goertzel already implemented; just wire up AtomicDataSnapshot
   - **Risk Level:** Low

2. **Stateful node lifecycle** (Days 1–3) → Required for LowPass, BeatEvent, BufferPersist
   - **Mitigation:** StatefulNodeRegistry already in `stateful_nodes.h`
   - **Risk Level:** Low

3. **Perlin noise algorithm correctness** (Days 6–7) → Validation critical
   - **Mitigation:** Use reference implementation (Ken Perlin 2002); validate with known seeds
   - **Risk Level:** Medium (algorithm is complex; off-by-one errors likely)

4. **Pitch detection confidence tuning** (Days 6–7) → May require iteration
   - **Mitigation:** Use reference test suite (A440, E4, C5 sine waves)
   - **Risk Level:** Medium (confidence threshold may need tweaking)

---

#### Soft Dependencies (Order Preference)
1. **Blur before ComposeLayers** – Blur uses similar buffer allocation logic
2. **Fill before DotRender** – DotRender often uses Fill as base_buf
3. **Blend modes before ComposeLayers** – Modular architecture
4. **Procedural nodes after core math** – Reduces cognitive load

---

### Risk Mitigation Strategies

| Risk | Mitigation | Effort |
|------|-----------|--------|
| Perlin noise slow | Profile early (Day 6 AM); optimize lookup table cache locality | +1 hour |
| Pitch detection unreliable | Use reference test vectors; may require confidence threshold tuning | +2 hours |
| FPS regression | Benchmark each node individually; cumulative profile required | +1 hour |
| Memory fragmentation (stateful nodes) | Use pre-allocated StatefulNodeRegistry; validate layout at boot | +0.5 hours |
| Chromagram precision loss (64 bins) | Test with synthetic chroma input; validate musical accuracy | +1 hour |
| Codegen type mismatches | Create unit tests for each node type before integration | +2 hours |

**Total Contingency Buffer: +7.5 hours ≈ 1 day**

---

## Part 6: Summary Table: Node Implementation Checklist

| # | Node Type | Category | Memory | Existing | Effort (hrs) | Day | Blocker | Status |
|----|-----------|----------|--------|----------|---|---|--|--|
| 1 | Time | A | 0 B | ✅ Core | 0.25 | 1 | None | Design |
| 2 | AudioSnapshot | A | 0 B | ✅ Goertzel | 0.25 | 1 | None | Design |
| 3 | AudioSpectrum | A | 0 B | ✅ Goertzel | 0.25 | 1 | None | Ready |
| 4 | ParamF | A | 0 B | ✅ Params | 0.25 | 1 | None | Design |
| 5 | ParamColor | A | 0 B | ✅ Params | 0.25 | 1 | None | Design |
| 6 | ConfigToggle | A | 0 B | ✅ Params | 0.25 | 1 | None | Design |
| 7 | Add | A | 0 B | ✅ Trivial | 0.25 | 1 | None | Design |
| 8 | Mul | A | 0 B | ✅ Trivial | 0.25 | 1 | None | Design |
| 9 | Mix | A | 0 B | ✅ Trivial | 0.25 | 1 | None | Design |
| 10 | Lerp | A | 0 B | ✅ Trivial | 0.25 | 1 | None | Design |
| 11 | Clamp | A | 0 B | ✅ std:: | 0.25 | 1 | None | Design |
| 12 | Pow | A | 0 B | ✅ math.h | 0.25 | 1 | None | Design |
| 13 | Sqrt | A | 0 B | ✅ math.h | 0.25 | 1 | None | Design |
| 14 | Color | A | 0 B | ✅ Type | 0.25 | 1 | None | Design |
| 15 | LowPass | B | 4 B | Partial | 1.0 | 4 | None | Design |
| 16 | MovingAverage | B | 128 B | Partial | 1.5 | 4 | None | Design |
| 17 | Contrast | B | 0 B | No | 1.0 | 4 | None | Design |
| 18 | BeatEvent | B | 16 B | Partial | 1.0 | 3 | None | Design |
| 19 | Hsv | B | 0 B | ✅ FastLED | 0.5 | 2 | None | Ready |
| 20 | Desaturate | B | 0 B | No | 0.5 | 2 | None | Design |
| 21 | ForceSaturation | B | 0 B | No | 1.5 | 2 | None | Design |
| 22 | GradientMap | B | 0 B | ✅ Palettes | 0.5 | 2 | None | Ready |
| 23 | PaletteSelector | B | 0 B | Partial | 0.5 | 5 | None | Stub |
| 24 | Fill | B | 1.2 KB | ✅ FastLED | 0.5 | 3 | None | Ready |
| 25 | Mirror | B | 1.2 KB | No | 1.0 | 3 | None | Design |
| 26 | Shift | B | 1.2 KB | No | 1.0 | 3 | None | Design |
| 27 | Downsample | B | 1.2 KB | No | 1.0 | 3 | None | Design |
| 28 | RngSeed | B | 0 B | No | 0.5 | 5 | None | Design |
| 29 | PositionAccumulator | B | 0 B | No | 0.5 | 5 | None | Design |
| 30 | LedOutput | A | 0 B | ✅ Core | 0.25 | 1 | None | Ready |
| 31 | LedOutputMirror | A | 0 B | ✅ Core | 0.25 | 1 | None | Ready |
| 32 | Blur | C | 1.2 KB | Partial | 3.5 | 5 | None | Ready (GaussianBlurNode) |
| 33 | PerlinNoise | C | 0 B | No | 4.5 | 6–7 | None | NEW |
| 34 | AutoCorrelation | C | 0 B | No | 3.5 | 6–7 | AudioSpectrum | NEW |
| 35 | Chromagram | C | 0 B | No | 2.5 | 6–7 | AudioSpectrum | NEW |
| 36 | DotRender | C | 1.2 KB | Partial | 4.5 | 7 | Compose | NEW (refine) |
| 37 | ComposeLayers | C | 1.2 KB | Partial | 3.5 | 5–6 | Blend libs | NEW |
| 38 | BufferPersist | B | 1.2 KB | ✅ StatefulNodeRegistry | 1.5 | 3 | None | Ready (BufferPersistNode) |
| 39 | — | — | — | — | — | — | — | **TOTAL: 39 nodes** |

---

## Conclusions & Recommendations

### Key Takeaways

1. **80% of firmware infrastructure already exists.** The core audio, palette, and buffer systems are production-ready. Only 5 nodes require new implementations from scratch.

2. **34 of 39 nodes are trivial or moderate complexity.** Category A (14 nodes, ~4 hours) and Category B (15 nodes, ~14 hours) can be completed by Days 1–5 using parallel development tracks.

3. **Category C nodes (7 nodes, ~22 hours) have clear algorithms but require careful validation.** Perlin noise and pitch detection are the longest, but can run in parallel with buffer operations.

4. **FPS budget is not a constraint.** All hotpath nodes fit within <1% of the 33 ms frame budget. No algorithmic optimization required; implementation-level tweaks only.

5. **Stateful node lifecycle is well-defined.** `StatefulNodeRegistry` and concrete node classes (BufferPersistNode, etc.) are ready to use; integration is straightforward.

6. **Critical path is 10 days for full Phase 1.** With a team of 2–3 developers, all 39 nodes can be implemented, tested, and integrated by end of Week 2.

### Recommended Next Steps

1. **Create firmware helpers header files** (Days 1–2):
   - `firmware/src/procedural/perlin_noise.h` (stub + algorithm doc)
   - `firmware/src/audio/pitch_detection.h` (stub + reference)
   - `firmware/src/audio/chroma_analysis.h` (stub + formula)
   - `firmware/src/gfx/blend_modes.h` (stub + 4 blend formulas)

2. **Finalize codegen templates** (Days 1–3):
   - Update emitter (T8) to dispatch all 39 node types
   - Add stateful node instantiation logic
   - Create C++ node wrapper types for codegen

3. **Establish test harness** (Days 1–5):
   - Unit tests for each node category (A/B/C)
   - Integration tests: JSON graph → C++ → compile → hardware
   - Performance regression suite (FPS, CPU, memory)

4. **Parallel implementation sprints** (Days 1–10):
   - Assign developers to independent tracks (Math, Colors, Buffers, Procedural, Integration)
   - Daily standup to track blocker resolution
   - Continuous hardware validation

---

## References

- **Catalog:** `docs/06-reference/K1NRef_GRAPH_NODE_CATALOG_EXPANDED_v2.0_20251110.md` (39 nodes)
- **Stateful Nodes:** `firmware/src/stateful_nodes.h` (BufferPersistNode, GaussianBlurNode, etc.)
- **Audio Processing:** `firmware/src/audio/goertzel.h` (FFT, chromagram, tempo)
- **Palettes:** `firmware/src/palettes.h` (33 curated gradients + lookup)
- **Math Utilities:** `firmware/src/fast_math.h` (optimized operations)
- **Emotiscope Helpers:** `firmware/src/emotiscope_helpers.cpp` (draw_dot, draw_line, blend ops)
- **ADR-0006:** Stateful Node Architecture
- **ADR-0012:** LUT Optimization System (procedural generation)
- **CLAUDE.md:** Firmware/Embedded Guardrails & Playbook (hot-path rules, profiling)

---

**Document Version:** 1.0
**Status:** Research (Phase 1 Planning)
**Last Updated:** November 10, 2025
**Prepared For:** K1.node1 Phase 1 Implementation

---

**Next Document:** `K1NImpl_FIRMWARE_CODEGEN_INTEGRATION_PLAN_v1.0_20251110.md` (C++ emitter design)

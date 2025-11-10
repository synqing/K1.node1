# Node Implementation Checklist
**K1.node1 Graph Compiler – 39 Node Firmware Helper Implementation Tracking**

**Version:** 1.0
**Date:** November 10, 2025
**Status:** Operational (Phase 1 Execution)
**Use:** Daily standup, sprint planning, progress tracking

---

## Category A: Trivial Nodes (14 nodes, Days 1–2)

Use this section to track trivial node implementations. Most are codegen-only; no new firmware helpers needed.

### Input Nodes (6)

- [ ] **Time** – `time_val = frame_count / 30.0f` | Est: 0.25 hr | Day: 1
- [ ] **AudioSnapshot** – `envelope = audio.vu_level` | Est: 0.25 hr | Day: 1
- [ ] **AudioSpectrum** – Reference to `audio.spectrogram[64]` | Est: 0.25 hr | Day: 1
- [ ] **ParamF** – `val = params.speed` (auto-generated accessor) | Est: 0.25 hr | Day: 1
- [ ] **ParamColor** – `col = params.base_color` | Est: 0.25 hr | Day: 1
- [ ] **ConfigToggle** – `flag = params.use_mirror` | Est: 0.25 hr | Day: 1

**Subtotal:** 1.5 hours | **Status:** ⬜ Not Started | **Assigned:** — | **Blocker:** None

---

### Math Nodes (7)

- [ ] **Add** – `sum = a + b` | Est: 0.25 hr | Day: 1
- [ ] **Mul** – `prod = a * b` | Est: 0.25 hr | Day: 1
- [ ] **Mix** – `result = a * (1-t) + b * t` | Est: 0.25 hr | Day: 1
- [ ] **Lerp** – Generic blend (overloaded for float/vec3) | Est: 0.25 hr | Day: 1
- [ ] **Clamp** – `std::clamp(val, min, max)` | Est: 0.25 hr | Day: 1
- [ ] **Pow** – `powf(base, exp)` | Est: 0.25 hr | Day: 1
- [ ] **Sqrt** – `sqrtf(val)` | Est: 0.25 hr | Day: 1

**Subtotal:** 1.75 hours | **Status:** ⬜ Not Started | **Assigned:** — | **Blocker:** None

---

### Output Nodes (2)

- [ ] **LedOutput** – Write buffer to `leds[NUM_LEDS]` with clamping | Est: 0.25 hr | Day: 1
- [ ] **LedOutputMirror** – Write with vertical mirror symmetry | Est: 0.25 hr | Day: 1

**Subtotal:** 0.5 hours | **Status:** ⬜ Not Started | **Assigned:** — | **Blocker:** None

---

**Category A Summary:**
- **Total Nodes:** 14
- **Total Effort:** 3.75 hours
- **Critical Path:** Days 1–2
- **Deliverable:** All 14 nodes compiling; simple pattern (Time+Add+Fill+LedOutput) running on hardware
- **Status:** ⬜ Not Started

---

## Category B: Moderate Complexity (15 nodes, Days 2–5)

Track moderate-complexity nodes. Mix of pure and stateful; leverage existing infrastructure where available.

### Filters & Stateful Nodes (3)

- [ ] **LowPass** – IIR filter | `out = α×in + (1-α)×prev` | Est: 1.0 hr | Day: 4
  - [ ] Verify state storage (single `float last_value`)
  - [ ] Test hysteresis behavior
  - [ ] Benchmark: should be <1 µs per call
  - **Blocker:** None | **Infrastructure:** Partial (exists in theory, integrate into codegen)

- [ ] **MovingAverage** – Ring buffer filter | Est: 1.5 hrs | Day: 4
  - [ ] Allocate ring buffer (4 × window_size bytes)
  - [ ] Implement write/read with modulo wraparound
  - [ ] Test window_size parameter (1–32)
  - **Blocker:** None | **Infrastructure:** Partial

- [ ] **BeatEvent** – Hysteresis threshold detector | Est: 1.0 hr | Day: 3
  - [ ] Implement threshold crossing with hysteresis
  - [ ] Track `prev_envelope` state
  - [ ] Emit 1-frame pulse on crossing
  - **Blocker:** AudioSnapshot | **Infrastructure:** Partial

**Subtotal:** 3.5 hours | **Status:** ⬜ Not Started | **Assigned:** — | **Blocker:** AudioSnapshot (ready Day 1)

---

### Color & Palette Nodes (5)

- [ ] **Hsv** – HSV to RGB conversion | Est: 0.5 hr | Day: 2
  - [x] Verify FastLED `hsv2rgb()` integration
  - [ ] Test on color sweep (h: 0→1, s=1, v=1)
  - **Blocker:** None | **Infrastructure:** ✅ Ready (FastLED)

- [ ] **Desaturate** – Grayscale conversion (luma mode) | Est: 0.5 hr | Day: 2
  - [ ] Implement `0.299r + 0.587g + 0.114b` formula
  - [ ] Test on known colors (red, green, blue)
  - **Blocker:** None | **Infrastructure:** No

- [ ] **ForceSaturation** – Conditional HSV saturation adjust | Est: 1.5 hrs | Day: 2
  - [ ] Implement HSV convert → adjust S → back to RGB
  - [ ] Support saturate & desaturate modes
  - [ ] Test strength parameter (0.0–1.0)
  - **Blocker:** None | **Infrastructure:** No

- [ ] **GradientMap** – Palette LUT with clamped index | Est: 0.5 hr | Day: 2
  - [x] Verify 33-palette system integration
  - [ ] Test color sweep (index: 0→1)
  - **Blocker:** None | **Infrastructure:** ✅ Ready (palettes.h)

- [ ] **PaletteSelector** – Palette enum → metadata (stub) | Est: 0.5 hr | Day: 5
  - [ ] Return opaque palette ID reference
  - [ ] Phase 2: expand to dynamic palette switching
  - **Blocker:** None | **Infrastructure:** Partial (stub)

**Subtotal:** 3.5 hours | **Status:** ⬜ Not Started | **Assigned:** — | **Blocker:** None

---

### Buffer Operations (5)

- [ ] **Fill** – Broadcast color to all LEDs | Est: 0.5 hr | Day: 3
  - [x] Verify FastLED native implementation
  - [ ] Benchmark: <2 µs for 256 LEDs
  - **Blocker:** None | **Infrastructure:** ✅ Ready

- [ ] **Mirror** – Vertical/horizontal flip | Est: 1.0 hr | Day: 3
  - [ ] Implement index reversal: `out[i] = src[(NUM_LEDS-1-i)]`
  - [ ] Support both vertical & horizontal modes
  - [ ] Test boundary conditions
  - **Blocker:** None | **Infrastructure:** No

- [ ] **Shift** – Barrel rotation | Est: 1.0 hr | Day: 3
  - [ ] Implement `out[i] = src[(i+offset)%NUM_LEDS]`
  - [ ] Test modulo wraparound
  - [ ] Support negative offsets
  - **Blocker:** None | **Infrastructure:** No

- [ ] **Downsample** – Sparse pixel selection | Est: 1.0 hr | Day: 3
  - [ ] Keep every Nth pixel; zero others
  - [ ] Test factor parameter (2–16)
  - [ ] Benchmark: <10 µs for 256 LEDs
  - **Blocker:** None | **Infrastructure:** No

- [ ] **BufferPersist** – Frame-to-frame decay buffer | Est: 1.5 hrs | Day: 3
  - [x] Verify `BufferPersistNode` class exists in stateful_nodes.h
  - [ ] Integrate into codegen state management
  - [ ] Test decay factor (0.0–1.0)
  - [ ] Validate memory lifecycle (init → update → reset)
  - **Blocker:** None | **Infrastructure:** ✅ Ready (BufferPersistNode)

**Subtotal:** 5.0 hours | **Status:** ⬜ Not Started | **Assigned:** — | **Blocker:** None

---

### Procedural Nodes (2)

- [ ] **RngSeed** – Seed constant (opaque uint32) | Est: 0.5 hr | Day: 5
  - [ ] Return seed_value as-is (no RNG computation in Phase 1)
  - [ ] Validate seed reproducibility
  - **Blocker:** None | **Infrastructure:** No

- [ ] **PositionAccumulator** – Phase generator | Est: 0.5 hr | Day: 5
  - [ ] Implement `fmod(frame_count / cycle_len, 1.0)`
  - [ ] Support scanline/spiral/radial modes (stub in Phase 1)
  - [ ] Test cycle_length parameter
  - **Blocker:** None | **Infrastructure:** No

**Subtotal:** 1.0 hour | **Status:** ⬜ Not Started | **Assigned:** — | **Blocker:** None

---

**Category B Summary:**
- **Total Nodes:** 15
- **Total Effort:** 12.5 hours
- **Critical Path:** Days 2–5
- **Deliverable:** All 15 Category B nodes compiling; Bloom pattern (Fill+BufferPersist+ComposeLayers) running
- **Status:** ⬜ Not Started
- **Parallel Opportunity:** 3 independent tracks (Filters, Colors, Buffers, Procedural)

---

## Category C: High Complexity (7 nodes, Days 6–7)

Track complex algorithmic nodes. These require careful testing and validation.

### Algorithmic Nodes (5)

- [ ] **Blur** – 3×3 box filter convolution | Est: 3–4 hrs | Day: 5–6
  - [x] Verify `GaussianBlurNode.blur()` in stateful_nodes.h
  - [ ] Test radius parameter (1–5)
  - [ ] Benchmark: <25 µs for 256 LEDs
  - [ ] Validate boundary handling (edge pixels)
  - **Blocker:** None | **Infrastructure:** ✅ Partial (GaussianBlurNode ready)

- [ ] **PerlinNoise** – 1D/2D Perlin noise (seed-deterministic) | Est: 4–5 hrs | Day: 6
  - [ ] Implement `perlin_noise_1d(x, seed, octaves)` in `firmware/src/procedural/perlin_noise.h`
  - [ ] Implement `perlin_noise_2d(x, y, seed, octaves)`
  - [ ] Validate seed determinism: same seed → identical sequence
  - [ ] Support octaves 1–3 (detail/frequency control)
  - [ ] Test range: output should be 0–1 (or -1 to 1, normalize as needed)
  - [ ] Benchmark: <100 µs per call (acceptable, called once per pattern or per procedural pass)
  - [ ] Visual validation: output should look organic (clouds, not banded)
  - **Blocker:** None | **Infrastructure:** No (NEW)

- [ ] **AutoCorrelation** – Pitch detection via spectral ACF | Est: 3–4 hrs | Day: 6–7
  - [ ] Implement `detect_pitch(spectrum, num_bins)` in `firmware/src/audio/pitch_detection.h`
  - [ ] Output: `{pitch_hz: float, confidence: float}`
  - [ ] Use spectral peak tracking + harmonic series analysis
  - [ ] Test on A440 sine wave: should return ~440 Hz with high confidence
  - [ ] Test on E4 (330 Hz), C5 (523 Hz)
  - [ ] Fallback to 0 Hz on silence
  - [ ] Confidence threshold tuning (may require iteration)
  - **Blocker:** AudioSpectrum (ready Day 1) | **Infrastructure:** No (NEW)

- [ ] **Chromagram** – Spectrum → 12-bin chroma vector | Est: 2–3 hrs | Day: 6–7
  - [ ] Implement `compute_chromagram(spectrum, chroma_out, mode)` in `firmware/src/audio/chroma_analysis.h`
  - [ ] Map 64 spectrum bins → 12 semitones (C, C#, D, ..., B)
  - [ ] Output: `chroma_out[12]` (energy per pitch class)
  - [ ] Support equal-tempered mode (Phase 1 only)
  - [ ] Test on C note: chroma[0] should be highest
  - [ ] Validate frequency-to-semitone mapping: `note = 12 * log2(f / BASE_FREQ) % 12`
  - [ ] Benchmark: <30 µs (called once per frame if connected)
  - **Blocker:** AudioSpectrum (ready Day 1) | **Infrastructure:** No (NEW)

- [ ] **ComposeLayers** – Multi-layer blend composition | Est: 3–4 hrs | Day: 5–6
  - [ ] Implement blend mode dispatch in `firmware/src/gfx/blend_modes.h`
  - [ ] Implement 4 blend formulas:
    - [ ] Add: `out = base + overlay` (linear sum, clamped)
    - [ ] Multiply: `out = base × overlay` (darkening)
    - [ ] Screen: `out = 1 − (1−base) × (1−overlay)` (brightening)
    - [ ] Overlay: Photoshop-style (context-dependent)
  - [ ] Support opacity parameter (0.0–1.0)
  - [ ] Test 2–3 layer stacking
  - [ ] Benchmark: <30 µs per layer (acceptable; 2–3 layers = 60–90 µs total)
  - [ ] Visual validation: colors should blend sensibly
  - **Blocker:** None (but useful before DotRender) | **Infrastructure:** Partial

---

### Refinement Nodes (2)

- [ ] **DotRender** – Peak rasterization with blend modes | Est: 4–5 hrs | Day: 7
  - [ ] Collect existing `draw_dot()` + `draw_line()` from emotiscope_helpers.cpp
  - [ ] Implement array dispatch for peak_indices[]
  - [ ] Support all 4 blend modes (add, replace, multiply, glow)
  - [ ] Bounds checking: ensure indices < NUM_LEDS
  - [ ] Support peak_width parameter (1–3 pixels)
  - [ ] Benchmark: <50 µs per peak on average; typical 10–20 peaks = 100–200 µs
  - [ ] Test edge wrapping (indices near NUM_LEDS)
  - **Blocker:** ComposeLayers (for blend mode reuse) | **Infrastructure:** Partial

---

**Category C Summary:**
- **Total Nodes:** 7
- **Total Effort:** 22–28 hours
- **Critical Path:** Days 6–7
- **Deliverable:** All 7 Category C nodes implemented; PerlinNoise patterns running; pitch visualization working
- **Status:** ⬜ Not Started
- **Parallel Opportunity:** PerlinNoise (Dev 1), Pitch+Chroma (Dev 2), DotRender (Dev 3) can run in parallel

---

## Integration & Validation (Days 8–10)

Final phase: codegen integration, E2E testing, profiling.

### Codegen & Emitter (T8)

- [ ] **Update codegen emitter** – Dispatch all 39 node types (Est: 2 hrs | Day: 8)
  - [ ] Add case for each node type in emitter switch statement
  - [ ] Generate correct C++ code for each node's logic
  - [ ] Test on 5 fixture patterns (Bloom, Spectrum, Beat, Filter, Perlin)

- [ ] **Stateful node instantiation** – Integrate with StatefulNodeRegistry (Est: 1 hr | Day: 8)
  - [ ] Auto-instantiate stateful nodes at pattern start
  - [ ] Manage state lifecycle (init, update, reset)
  - [ ] Validate memory allocation (<5 KB per node)

---

### Fixture Patterns & E2E Tests

- [ ] **Bloom** – Fill + BufferPersist + ComposeLayers (Est: 0.5 hr | Day: 8)
  - [ ] JSON graph → C++ code → compile → hardware
  - [ ] Verify visual output: sustained glow effect

- [ ] **Spectrum** – AudioSpectrum + GradientMap + Fill (Est: 0.5 hr | Day: 8)
  - [ ] JSON graph → hardware execution
  - [ ] Verify frequency visualization

- [ ] **Beat Pulse** – BeatEvent + Fill + BufferPersist (Est: 0.5 hr | Day: 8)
  - [ ] JSON graph → hardware execution
  - [ ] Verify beat detection + pulse animation

- [ ] **Filter Chain** – Contrast + LowPass + Mix (Est: 0.5 hr | Day: 9)
  - [ ] JSON graph → hardware execution
  - [ ] Verify filter smoothing

- [ ] **Perlin Cloud** – PerlinNoise + HSV + Fill (Est: 0.5 hr | Day: 9)
  - [ ] JSON graph → hardware execution
  - [ ] Verify organic texture appearance

---

### Performance & Profiling

- [ ] **FPS Baseline** – Measure on each fixture pattern (Est: 1 hr | Day: 9)
  - [ ] Target: ≥28 FPS (30 FPS nominal, 2 FPS margin)
  - [ ] Measure CPU% utilization
  - [ ] Identify any regressions vs. Day 5 baseline

- [ ] **Memory Footprint** – Validate heap usage (Est: 0.5 hr | Day: 9)
  - [ ] Per-pattern memory: should be <5 KB for stateful nodes
  - [ ] Total heap: <50 KB
  - [ ] No memory leaks (Valgrind clean)

- [ ] **Latency per Node** – Benchmark critical nodes (Est: 1 hr | Day: 9)
  - [ ] Blur: <25 µs
  - [ ] BufferPersist: <5 µs
  - [ ] ComposeLayers: <30 µs per layer
  - [ ] PerlinNoise: <100 µs
  - [ ] AudioSpectrum: <5 µs (atomic read)

---

### Bug Fixes & Regression Testing

- [ ] **Hardware Validation** – Run all 39 nodes on K1.node1 (Est: 2 hrs | Day: 9–10)
  - [ ] Compile without warnings
  - [ ] Link without errors
  - [ ] All 5 fixture patterns execute
  - [ ] Visual output matches expectations

- [ ] **Regression Tests** – Validate vs. prior patterns (Est: 1 hr | Day: 10)
  - [ ] Emotiscope baseline patterns still work
  - [ ] No FPS degradation vs. hardcoded patterns
  - [ ] Audio I2S system unaffected

- [ ] **Final Sign-Off** – Go/no-go for Phase 2 (Est: 0.5 hr | Day: 10)
  - [ ] All success criteria met
  - [ ] Documentation up to date
  - [ ] Code review passed

---

**Integration & Validation Summary:**
- **Total Effort:** 12–14 hours
- **Critical Path:** Days 8–10
- **Deliverable:** All 39 nodes integrated; hardware validated; FPS ≥28; zero memory leaks
- **Status:** ⬜ Not Started

---

## Overall Summary

| Phase | Days | Nodes | Hours | Status |
|-------|------|-------|-------|--------|
| **Category A & B** | 1–5 | 29 | 16–18 | ⬜ Not Started |
| **Category C** | 6–7 | 7 | 22–28 | ⬜ Not Started |
| **Integration & Test** | 8–10 | All 39 | 12–14 | ⬜ Not Started |
| **TOTAL** | 1–10 | **39** | **50–60** | ⬜ Not Started |

**Team Effort:** 6–9 engineer-days (team of 2–3)
**Calendar Time:** 10 working days (2 weeks)

---

## Daily Standup Template

```
Date: [Day X]
Assigned Dev: [Name]
Track: [A / B / C / Integration]

COMPLETED TODAY:
- [ ] Node 1: Spec review | Codegen | Testing
- [ ] Node 2: Implementation | Benchmark | Validated

BLOCKERS:
- [Blocker A]: Impact, ETA for resolution

PLAN FOR TOMORROW:
- [ ] Node X: Implementation
- [ ] Node Y: Testing + benchmark
- [ ] Risk mitigation: [if needed]

FPS/Memory Update:
- FPS: [measured value] (target: 28+)
- Heap: [KB used] (budget: <50 KB)
```

---

## Success Criteria Checklist

- [ ] All 39 nodes compile without warnings
- [ ] All 39 nodes generate correct C++ code
- [ ] FPS ≥ 28 on all 5 fixture patterns
- [ ] All hotpath nodes <1% of frame budget
- [ ] Stateful node lifecycle validated (init→reset→cleanup)
- [ ] E2E test: JSON → C++ → compile → hardware ✓
- [ ] Zero memory leaks (Valgrind clean)
- [ ] Zero regressions vs. hardcoded baseline patterns
- [ ] Performance parity with Emotiscope patterns
- [ ] Code review: zero high/critical lint warnings

---

**Version:** 1.0
**Status:** Operational (Phase 1 Execution)
**Last Updated:** November 10, 2025
**Use:** Daily standup, sprint planning, progress tracking

**Print this checklist and check off daily. Share updates in team standup.**

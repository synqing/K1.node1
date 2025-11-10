# Node Complexity Quick Reference
**K1.node1 Graph Compiler – Firmware Implementation Scope**

**Version:** 1.0
**Date:** November 10, 2025
**Status:** Reference
**Related:** `K1NImpl_FIRMWARE_NODE_INTEGRATION_ANALYSIS_v1.0_20251110.md`

---

## Category A: Trivial Nodes (14 nodes, ~0.25 hr each)

All pure functions, deterministic, zero state, compile-time evaluable.

```
Time, AudioSnapshot, AudioSpectrum, ParamF, ParamColor, ConfigToggle
Add, Mul, Mix, Lerp, Clamp, Pow, Sqrt, Color
LedOutput, LedOutputMirror
```

**Effort:** 4–7 hours (parallelizable)
**Status:** Ready to codegen; most exist as-is
**Integration:** Direct emitter templates; no new implementations

---

## Category B: Moderate Complexity (15 nodes, 0.5–2 hrs each)

Mix of pure and stateful; 10–50 lines C++; tested algorithms.

```
LowPass (IIR), MovingAverage (ring buffer)
Contrast (S-curve), BeatEvent (hysteresis)
Hsv, Desaturate, ForceSaturation, GradientMap, PaletteSelector
Fill, Mirror, Shift, Downsample, BufferPersist (stateful)
RngSeed, PositionAccumulator
```

**Effort:** 14–20 hours (parallel on independent branches)
**Status:** 60% ready (Fill, Hsv, GradientMap, BufferPersist exist; others need implementation)
**Integration:** Straightforward; leverage existing buffer/color infrastructure

---

## Category C: High Complexity (7 nodes, 3–5 hrs each)

Algorithmic; >100 lines; specialized math; research-grade.

```
Blur (3×3 convolution, spatial filtering)
PerlinNoise (1D/2D, seed-deterministic)
AutoCorrelation (pitch detection via spectral ACF)
Chromagram (spectrum → 12-bin chroma vector)
DotRender (peak rasterization, blend modes)
ComposeLayers (multi-layer composition)
```

**Effort:** 22–30 hours (sequential bottlenecks; critical path = 10 days)
**Status:** 40% ready (Blur partial; others from scratch)
**Blockers:** AudioSpectrum (for Pitch, Chroma); ComposeLayers (for DotRender)

---

## Effort Rollup

| Category | Count | Hours/Node | Total | Critical Path | Effort (Team) |
|----------|-------|---|---|---|---|
| A | 14 | 0.25–0.5 | 4–7 | Day 1–2 | 1 day (1 dev) |
| B | 15 | 1–2 | 14–20 | Day 2–5 | 2 days (2 devs) |
| C | 7 | 3–5 | 22–30 | Day 6–7 | 3 days (parallel) |
| Integration | — | — | +20% | Day 8–10 | 2 days (team) |
| **Total** | **39** | — | **60–77 hrs** | **10 days** | **6–9 days (team of 2–3)** |

---

## Hotpath Concerns (Category A/B Nodes Only)

**All Category A/B nodes are <1% of FPS budget:**

- **Fill:** 2 µs × 2 calls = 4 µs ✅
- **Blur:** 20 µs × 1 call = 20 µs ✅
- **BufferPersist:** 5 µs × 3 calls = 15 µs ✅
- **ComposeLayers:** 30 µs × 2 calls = 60 µs ✅
- **AudioSpectrum:** 5 µs (atomic read) ✅
- **All math (Add, Mul, etc.):** <10 µs ✅
- **Total graph execution: ~104 µs ≈ 0.5% of 33 ms budget** ✅

**No optimization required; safe margin for expansion.**

---

## Existing Infrastructure (80% Ready)

| Subsystem | Coverage | Status | Location |
|-----------|----------|--------|----------|
| **Audio (Goertzel FFT)** | AudioSpectrum, Chromagram (partial), VU | ✅ Production | `audio/goertzel.h` |
| **Color System** | Hsv, GradientMap, Palette LUT | ✅ Production | `palettes.h` |
| **Buffer Ops** | Fill, Blur (partial), BufferPersist, Scroll | ✅ 70% Complete | `stateful_nodes.h` |
| **Math Utils** | Fast ops, Clamp, Pow, Sqrt | ✅ Production | `fast_math.h` |
| **Stateful Lifecycle** | Node init/reset, state tracking | ✅ Production | `stateful_nodes.h` |

---

## New Implementations (20% New Work)

| Node | Algorithm | Lines | Hours | Blocker |
|------|-----------|-------|-------|---------|
| **PerlinNoise** | Improved Perlin (seed, octaves) | 150–200 | 4–5 | None |
| **AutoCorrelation** | Spectral ACF pitch detection | 120–150 | 3–4 | AudioSpectrum |
| **Chromagram** | Bin aggregation to 12 chroma | 100–120 | 2–3 | AudioSpectrum |
| **Blend Modes** | 4 blend formulas (add/mul/screen/overlay) | 100–150 | 2–3 | None |
| **Misc. Refinements** | Mirror, Downsample, DotRender finalization | 80–120 | 2–3 | None |

---

## Implementation Priority (Phase 1 Sequence)

```
Days 1–3: Category A (all 14 nodes) + Category B foundation
          ├─ Math & input nodes (Track A)
          ├─ Color & palette nodes (Track B)
          └─ Buffer ops Phase 1 (Track C)

Days 4–5: Category B completion + Procedural prep
          ├─ Filters & stateful nodes (Track A)
          ├─ Noise research & planning (Track B)
          └─ Blur & blend modes (Track C)

Days 6–7: Category C (all 7 complex nodes)
          ├─ PerlinNoise (Track B, 4–5 hrs)
          ├─ Pitch & Chroma (Track A, 4–5 hrs)
          └─ DotRender refinement (Track C, 3 hrs)

Days 8–10: Integration & E2E validation
          ├─ Codegen emitter (all 39 nodes)
          ├─ Fixture patterns (Bloom, Spectrum, etc.)
          └─ Hardware validation + profiling
```

---

## Validation Checkpoints

### Day 2 (After Category A)
- [ ] All 14 trivial nodes compile
- [ ] Example: Time + Add + Color + Fill + LedOutput (simple pattern)
- [ ] FPS measured; baseline established

### Day 5 (After Category B)
- [ ] All 29 Category A/B nodes compile
- [ ] Example: Bloom (Fill + BufferPersist + ComposeLayers)
- [ ] Example: Spectrum (AudioSpectrum + GradientMap + Fill)
- [ ] Stateful node lifecycle tested
- [ ] Hotpath profiling complete

### Day 7 (After Category C)
- [ ] All 39 nodes compile
- [ ] PerlinNoise patterns (cloud, shimmer)
- [ ] Pitch-based pattern (if confidence threshold tuned)
- [ ] Complex layering example (3+ overlays)
- [ ] Regression testing vs. Day 5 baseline

### Day 10 (Full Integration)
- [ ] Codegen emitter dispatches all 39 types
- [ ] E2E test: JSON → C++ → compile → hardware
- [ ] Performance report: FPS, CPU%, memory footprint
- [ ] Go/no-go for Phase 2

---

## Risk Flags

| Flag | Severity | Mitigation |
|------|----------|-----------|
| Perlin noise slow | Medium | Profile Day 6 AM; cache lookup table |
| Pitch detection unreliable | Medium | Use reference test vectors (A440, E4, C5) |
| FPS regression | Low | Cumulative profiling; benchmark each node |
| Codegen type mismatches | Low | Unit tests for each node type pre-integration |
| Memory fragmentation (stateful) | Low | Pre-allocated StatefulNodeRegistry |
| Chromagram precision (64 bins) | Low | Test vs. synthetic chroma; musical accuracy validation |

---

## Success Criteria

- ✅ All 39 nodes compile without warnings
- ✅ FPS ≥ 28 on hardware (30 FPS target; 2 FPS margin)
- ✅ All hotpath nodes <1% of frame budget
- ✅ Stateful node state lifecycle validated
- ✅ E2E test: JSON graph → hardware execution
- ✅ Zero memory leaks (Valgrind clean)
- ✅ Performance parity with hardcoded patterns (Emotiscope baseline)

---

## Recommended Team Composition

- **Dev A (Filters & Procedural):** LowPass, MovingAverage, Contrast, PerlinNoise, AutoCorrelation, Chromagram
- **Dev B (Colors & Math):** Hsv, Desaturate, ForceSaturation, GradientMap, Color, all trivial math
- **Dev C (Buffers & Integration):** Fill, Mirror, Shift, Downsample, Blur, DotRender, ComposeLayers, integration lead
- **All:** Codegen templates, E2E tests, hardware validation

**Scrum:** Daily 15-min standup; blockers, risks, deliverables

---

**Version:** 1.0
**Status:** Reference
**Last Updated:** November 10, 2025

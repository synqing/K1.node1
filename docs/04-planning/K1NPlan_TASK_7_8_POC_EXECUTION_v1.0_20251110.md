# Tasks 7-8 PoC Execution Plan: Bloom & Spectrum Graph Conversion

**Version:** 1.0  
**Date:** November 10, 2025  
**Owner:** Signal Processing Analysis (Research)  
**Status:** Proposed  
**Duration:** 15 minutes research phase; 3 days PoC execution  
**Related:** Tasks 7-8 (Phase 1 completion), `docs/06-reference/K1NRef_GRAPH_NODE_CATALOG_EXPANDED_v2.0_20251110.md`, `docs/04-planning/K1NPlan_TASK_ROADMAP_CORRECTED_v1.0_20251110.md`  

---

## Executive Summary

Tasks 7-8 require converting legacy **Bloom** and **Spectrum** patterns into the **39-node graph system**. This document maps existing pattern algorithms to graph nodes, defines success criteria, establishes hardware testing strategy, and outlines a 3-day PoC execution timeline with risk mitigation.

**Key Findings:**
- Skeleton placeholders exist (`pattern_bloom.cpp`, `pattern_spectrum.cpp`); no complex legacy code to port
- All required nodes exist in the 39-node catalog
- Bloom requires **6-7 nodes** (stateful); Spectrum requires **4-5 nodes** (pure FFT path)
- Hardware testing uses golden-CRC validation via audio test signals (sweeps, noise, silence)

---

## Part 1: Node Mapping — Legacy → 39-Node Graph

### Overview: Pattern Algorithm Structures

#### Bloom Pattern (Audio-Reactive Glow)
**Algorithm:** VU envelope → low-pass filter → persistent color buffer → spatial blur → mirror output  
**Audio Input:** Single envelope scalar (VU/energy)  
**Output:** Persistent, decaying glow across LED strip

#### Spectrum Pattern (Frequency Visualization)
**Algorithm:** FFT bins → gradient map (frequency→color) → dot render (peaks) → output  
**Audio Input:** 64-bin FFT spectrum  
**Output:** Frequency-mapped LED visualization with optional peak indicators

---

### Mapping: Bloom Pattern

| Step | Purpose | Legacy Code | 39-Node Type | Node ID | Inputs | Key Parameters |
|------|---------|-------------|--------------|---------|--------|-----------------|
| 1 | Audio capture | `get_audio_snapshot()` | `AudioSnapshot` | `bloom_audio` | *(none)* | *(none)* |
| 2 | Envelope smoothing | `PATTERN_AUDIO_START()` macro + IIR | `LowPass` | `bloom_smooth` | `signal: bloom_audio` | `alpha: 0.1` (decay factor) |
| 3 | Color generation | HSV from time/audio | `Hsv` | `bloom_color` | `h: time_node`, `s: param_sat`, `v: bloom_smooth` | *(none)* |
| 4 | Fill strip | Broadcast color to all LEDs | `Fill` | `bloom_fill` | `color: bloom_color` | *(none)* |
| 5 | Persist buffer | Frame-to-frame decay with new frame blend | `BufferPersist` | `bloom_persist` | `src: bloom_fill`, `decay: param_decay` | *(none)* |
| 6 | Optional: Blur | Spatial smoothing (future optional enhancement) | `Blur` | `bloom_blur` | `src: bloom_persist` | `radius: 1` |
| 7 | Mirror output | Vertical symmetry for hardware layout | `LedOutputMirror` | `bloom_out` | `color: bloom_persist` | *(none)* |

**Stateful Nodes (Maintain Memory):** `LowPass` (~4B), `BufferPersist` (~1.2KB)  
**Total Memory:** ~1.3 KB (within budget)  
**Pure Nodes (Reorderable):** `AudioSnapshot`, `Hsv`, `Fill`

**Bloom Graph JSON (Simplified):**
```json
{
  "version": 1,
  "name": "bloom_mirror_poc",
  "nodes": [
    {"id": "audio", "type": "AudioSnapshot"},
    {"id": "time_node", "type": "Time"},
    {"id": "param_sat", "type": "ParamF", "params": {"name": "Saturation", "min": 0.0, "max": 1.0, "default": 0.9}},
    {"id": "param_decay", "type": "ParamF", "params": {"name": "Decay", "min": 0.0, "max": 1.0, "default": 0.95}},
    {"id": "smooth", "type": "LowPass", "inputs": {"signal": "audio", "alpha": 0.1}},
    {"id": "color", "type": "Hsv", "inputs": {"h": "time_node", "s": "param_sat", "v": "smooth"}},
    {"id": "fill", "type": "Fill", "inputs": {"color": "color"}},
    {"id": "persist", "type": "BufferPersist", "inputs": {"src": "fill", "decay": "param_decay"}},
    {"id": "out", "type": "LedOutputMirror", "inputs": {"color": "persist"}}
  ]
}
```

---

### Mapping: Spectrum Pattern

| Step | Purpose | Legacy Code | 39-Node Type | Node ID | Inputs | Key Parameters |
|------|---------|-------------|--------------|---------|--------|-----------------|
| 1 | Spectrum capture | `get_audio_snapshot()` → spectrum array | `AudioSpectrum` | `spec_fft` | *(none)* | *(none)* |
| 2 | Per-bin gradient map | Frequency bin → color via palette | `GradientMap` (per-bin, requires loop in codegen) | `spec_grad_0..63` | `index: spec_fft[bin]` | `palette: "viridis"` |
| 3 | Render dots/peaks | Mark highest frequency bins | `DotRender` | `spec_dots` | `base_buf: spec_fill`, `peak_indices: [peaks...]` | `blend_mode: "add"` |
| 4 | Fill base | Render spectrum as full strip (interleave gradients) | `Fill` (or custom spectrum aggregator in Phase 2) | `spec_fill` | Aggregated gradient colors | *(none)* |
| 5 | Output | Write to hardware | `LedOutput` | `spec_out` | `color: spec_dots` | *(none)* |

**Note:** Phase 1 limitation — no per-bin gradient loop in JSON syntax. Workaround: codegen emits loop unrolled (64 GradientMap nodes) or uses firmware helper for spectrum→LED mapping.

**Stateful Nodes:** *(none)* (pure FFT analysis)  
**Total Memory:** ~256 bytes (spectrum array only, read-only)  
**Pure Nodes:** All (reorderable, CSE-eligible)

**Spectrum Graph JSON (Phase 1 Workaround — Simplified):**
```json
{
  "version": 1,
  "name": "spectrum_gradient_poc",
  "nodes": [
    {"id": "spec", "type": "AudioSpectrum"},
    {"id": "param_palette", "type": "ParamF", "params": {"name": "Palette Mode", "min": 0.0, "max": 5.0, "default": 0.0}},
    {"id": "dot_render", "type": "DotRender", "params": {"blend_mode": "add", "peak_width": 2}},
    {"id": "out", "type": "LedOutput", "inputs": {"color": "dot_render"}}
  ]
}
```

**Phase 1 Codegen Behavior:**
- Compiler detects `AudioSpectrum` → recognizes frequency bin array
- Emits firmware helper: `spectrum_to_led_buffer()` (64 frequency bins → 180 LED pixels with interpolation + gradient map)
- Helper includes peak detection, peak rendering, and optional smoothing via `MovingAverage` node wrapping

---

### Phase 1 vs. Phase 2 Node Support

| Feature | Bloom | Spectrum | Phase | Notes |
|---------|-------|----------|-------|-------|
| `AudioSnapshot` | ✅ Required | *(N/A)* | 1 | Envelope smoothing for bloom |
| `AudioSpectrum` | *(N/A)* | ✅ Required | 1 | 64-bin FFT output |
| `LowPass` filter | ✅ Required | Optional | 1 | Smooth VU envelope, decay |
| `BufferPersist` | ✅ Required | *(N/A)* | 1 | Frame-to-frame trail effect |
| `Hsv` color gen | ✅ Required | Optional | 1 | Hue from time, saturation from params |
| `GradientMap` | *(N/A)* | ✅ Required | 1 | Frequency bin → color palette |
| `DotRender` (peaks) | Optional | ✅ Recommended | 1 | Peak indicators on spectrum |
| `Blur` spatial | Optional | *(N/A)* | 2 | Future enhancement for bloom smoothness |
| `MovingAverage` | *(N/A)* | Optional | 1 | Spectrum bin smoothing (future) |
| `ComposeLayers` | *(N/A)* | Optional | 2 | Blend multiple spectrum passes |

**Phase 1 Deferred (Non-Critical for PoC):**
- Multi-pass spectrum aggregation (sum adjacent bins for resolution reduction)
- Fractional shifts (sub-pixel rotation)
- Conditional branches (if/else on param toggle)
- Custom RNG (Phase 2 feature)

---

## Part 2: PoC Success Criteria

### Bloom Success Metrics

**Correctness Validation:**
1. **Visual Consistency**
   - [ ] Persistent glow animates smoothly on silence (decay visible)
   - [ ] On steady tone: glow amplitude stable (variance < 5%)
   - [ ] On sweep: glow follows envelope rise/fall (lag < 200ms)
   - [ ] Color hue rotates continuously (no jitter)

2. **Memory & Performance**
   - [ ] RAM usage < 1.5 KB (stateful nodes only)
   - [ ] FPS ≥ 120 (measured via heartbeat)
   - [ ] No stack overflow (IRAM < 3KB peak)
   - [ ] Audio thread latency < 10ms

3. **Audio Responsiveness**
   - [ ] Silence test: decay exponent matches param (±5% error)
   - [ ] 440 Hz tone: peak detection within ±10% target
   - [ ] Stereo sweep (20–20kHz): no aliasing artifacts

4. **Golden CRC Validation**
   - [ ] Capture LED frame sequence on known test signal (e.g., 60s steady tone)
   - [ ] Compute per-frame CRC32 (time_step, envelope, color_R, color_G, color_B)
   - [ ] Compare against reference CRC (baseline commit hash stored in docstring)
   - [ ] Match: ✅ Pattern deterministic; Mismatch: ⚠️ Revisit audio calibration or decay params

---

### Spectrum Success Metrics

**Correctness Validation:**
1. **Frequency Accuracy**
   - [ ] Single tone @ 440 Hz: peak within ±20 Hz (±4.5% error tolerance)
   - [ ] Two tones (440 Hz + 880 Hz): both peaks visible in LED visualization
   - [ ] Silence: minimal LEDs lit (< 5% peak brightness)
   - [ ] White noise: uniform distribution across bins (Kolmogorov-Smirnov test)

2. **Visual Integrity**
   - [ ] Gradient color map matches input palette (viridis, plasma, hot, cool)
   - [ ] Peak dots clearly distinguish from background (contrast > 0.7)
   - [ ] No flickering (peak jitter < 1 LED pixel per frame)
   - [ ] Frequency-to-position mapping linear (no warping)

3. **Performance**
   - [ ] FPS ≥ 120 maintained
   - [ ] No frequency bin clipping (dynamic range preservation)
   - [ ] Latency: spectrum capture to LED output < 50ms

4. **Golden CRC Validation**
   - [ ] Capture 10-frame sequence on known signal (pink noise, standardized level)
   - [ ] CRC includes: frame_index, spectrum[0..63], peak_positions[0..4]
   - [ ] Reference stored alongside graph JSON
   - [ ] Mismatch triggers re-baseline (document reason: HW calibration, firmware version, etc.)

---

### Test Signal Library

| Signal | Duration | Frequency(ies) | Purpose | Expected Bloom Behavior | Expected Spectrum Behavior |
|--------|----------|---|---------|---------|---------|
| **Silence** | 10s | *(none)* | Baseline decay | Exponential fade to black | All bins ≈ 0 |
| **Steady Tone** | 30s | 440 Hz | Envelope stability | Plateau at constant amplitude | Sharp peak @ bin ~22 (440Hz/8kHz*64) |
| **Sweep Up** | 60s | 20 Hz → 8 kHz | Frequency response | Smooth envelope ramp | Peak sweeps left-to-right |
| **Sweep Down** | 60s | 8 kHz → 20 Hz | Reverse tracking | Smooth envelope ramp | Peak sweeps right-to-left |
| **Pink Noise** | 30s | Broadband | Richness/warmth | Amplitude ~ 0.6 (mid-range bias) | Distributed, taper at high freq |
| **White Noise** | 30s | Uniform (0–8kHz) | Noise floor | Amplitude ~ 0.5 | Flat distribution |
| **Two-Tone Cluster** | 20s | 440 Hz + 880 Hz | Harmonic clarity | Two peak pulses (440 & 880 combined VU) | Two distinct peaks |
| **Music Sample** | 30s | Real music (~3–5 min clip, 44.1kHz) | Real-world validation | Follows beat structure | Spectrum matches known spectrogram |

**Capture Protocol:**
1. Log audio input level (dBFS) at pattern start
2. Capture 30 LED frames per second
3. Store alongside spectrum bins (for post-analysis)
4. Export: `bloom_golden.json` / `spectrum_golden.json` with CRC checksums per frame

---

## Part 3: Hardware Testing Strategy

### Setup & Calibration

**Prerequisites:**
- [ ] K1.node1 hardware (160 WS2812B LEDs, dual RMT channels)
- [ ] Microphone: INMP441 (Knowles), I2S clock 1MHz, 16-bit samples
- [ ] Audio playback device (headphone jack or line-in, ~1Vrms nominal)
- [ ] USB serial monitor (115200 baud) for firmware logs

**Calibration Checklist:**
1. **Audio Input Validation**
   - [ ] Run `GET /api/device/audio` endpoint; verify VU envelope present
   - [ ] Sweep tone (440 Hz, 1s) → Spectrum should show peak ≥ 0.5 (normalized)
   - [ ] Measure I2S SCK/LRCK waveform (oscilloscope, optional): verify timing per IDF pins

2. **LED Output Validation**
   - [ ] Test pattern (fill white): all 160 LEDs light uniformly
   - [ ] Test pattern (gradient): verify color ramp across strip
   - [ ] Measure RMT timing (refill gaps < 100µs, per `diagnostics/rmt_probe.h`)

3. **Firmware Build Signature**
   - [ ] At boot, serial log prints: `[BOOT] IDF v5.0.0, Arduino 3.2, PlatformIO 6.12.0, Bloom+Spectrum PoC`
   - [ ] Via REST: `GET /api/device/info` returns same

### Test Execution Flow

#### Phase 1: Graph Compilation
**Day 1 (6 hours)**
1. Design Bloom.json (6-7 nodes, ~500 lines)
2. Design Spectrum.json (4-5 nodes, ~400 lines)
3. Validate JSON schema against `codegen/schemas/graph.schema.json`
4. Run k1c compiler: `k1c compile bloom.json spectrum.json --output firmware/src/graph_codegen/`
5. Verify C++ generation (pattern_bloom.cpp, pattern_spectrum.cpp should be ≥100 lines each)
6. Compile firmware: `platformio run -e esp32-s3-devkitc-1-rmtv2`
7. Halt on compilation error; escalate with full error log

#### Phase 2: Hardware Flash & Basic Smoke Test
**Day 1–2 (4 hours)**
1. Flash firmware: `platformio run -e esp32-s3-devkitc-1-rmtv2 --target upload`
2. Monitor boot sequence: verify `[BOOT]` signature on serial
3. Verify LEDs power up (should be black initially, no pattern active)
4. Activate Bloom pattern via REST: `POST /api/pattern {"name": "bloom_mirror_poc"}`
5. On silence: observe exponential fade-out (glow should reach near-black in ~30s)
6. **Expected:** Smooth, no crashes, FPS ≥ 100 (via `/api/device/performance` heartbeat)

#### Phase 3: Audio Test Signals
**Day 2 (8 hours)**

| Signal | Duration | Procedure | Validation |
|--------|----------|-----------|------------|
| **Silence** | 10s | Play 10s of silence (no input) | Glow exponentially decays; Spectrum shows zeros |
| **440 Hz Steady Tone** | 30s | Play A4 (440 Hz sine wave, 0.5Vrms) | Bloom: plateau at stable amplitude; Spectrum: peak @ ~bin 22 ±1 |
| **Sweep 20→8000 Hz** | 60s | Logarithmic sweep (1 octave/10s) | Bloom: smooth envelope rise/fall; Spectrum: peak traverses left-to-right |
| **Pink Noise** | 30s | Pre-generated pink noise (0.5Vrms) | Bloom: ~0.6 amplitude, subtle shimmer; Spectrum: 1/f tilt visible |
| **Music Clip** | 30s | 44.1kHz stereo music (known spectrogram) | Bloom: follows beat; Spectrum: matches reference spectrogram envelope |

**Data Capture:**
```cpp
// Pseudo-code: Added to draw_bloom / draw_spectrum
uint32_t frame_crc = 0;
for (int i = 0; i < NUM_LEDS; i++) {
    frame_crc = crc32_update(frame_crc, leds[i].r);
    frame_crc = crc32_update(frame_crc, leds[i].g);
    frame_crc = crc32_update(frame_crc, leds[i].b);
}
// Log every 30th frame (1 per second @ 30fps):
if (frame_index % 30 == 0) {
    printf("[GOLDEN] Signal=%s T=%u Frame=%u CRC=%08x Audio=%f\n", 
           signal_name, elapsed_ms, frame_index, frame_crc, envelope);
}
```

#### Phase 4: Golden CRC Capture & Validation
**Day 3 (4 hours)**

1. **Baseline Capture (Reference):**
   - Rerun all test signals; capture serial logs with CRC + audio envelope
   - Store in `docs/09-reports/K1NReport_BLOOM_SPECTRUM_GOLDEN_BASELINE_v1.0_20251112.md`
   - Format:
     ```
     [BLOOM GOLDEN BASELINE]
     Signal: 440Hz_30sec
     Frame 30: CRC=0xABC12345 Envelope=0.87
     Frame 60: CRC=0xDEF67890 Envelope=0.86
     ...
     Expected Decay Tau: 0.95 ± 0.02
     ```

2. **Regression Testing (On Future Commits):**
   - Rerun signal suite
   - Compare CRCs against baseline
   - Tolerance: ±2% per-frame variance (account for floating-point rounding)
   - If mismatch: document reason (firmware change, calibration drift, etc.)

3. **CRC Mismatch Protocol:**
   - If **Bloom CRC mismatch:** check LowPass alpha, BufferPersist decay param
   - If **Spectrum CRC mismatch:** check FFT window, gradient palette, peak detection threshold
   - Create diagnostic plot: Bloom envelope vs. time; Spectrum peak frequency vs. time
   - Compare against reference plot (stored alongside baseline)

---

## Part 4: PoC Execution Timeline & Risk Mitigation

### 3-Day Execution Schedule

#### Day 1: Design & Compilation (8 hours)

| Time | Task | Owner | Success Criteria | Risk |
|------|------|-------|------------------|------|
| 1–2h | Design Bloom.json (stateful nodes: LowPass, BufferPersist) | Signal Analysis | JSON passes schema validation | **Risk:** Time tracking node not available → use `Time` node input to manual state |
| 1h | Design Spectrum.json (pure FFT path + DotRender peaks) | Signal Analysis | JSON parses without error | **Risk:** Per-bin gradient loop not supported in Phase 1 → use firmware helper workaround |
| 1h | Validate schemas (`graph.schema.json`) | Build Engineer | Both JSONs conform | **Risk:** Schema version mismatch → use latest from repo |
| 1h | Run k1c compiler | Build Engineer | C++ generated, files > 100 lines each | **Risk:** Compiler bug → escalate to maintainer with full IR dump |
| 1h | Build firmware (PlatformIO) | Build Engineer | 0 warnings, 0 errors | **Risk:** IDF version incompatibility → check `platformio.ini` pinning (should be 6.12.0) |
| 1h | Reserve/buffer | Contingency | *(N/A)* | Drift allowance |

**Day 1 Deliverables:**
- ✅ `firmware/src/graph_codegen/bloom_poc.json`
- ✅ `firmware/src/graph_codegen/spectrum_poc.json`
- ✅ `firmware/src/graph_codegen/pattern_bloom.cpp` (codegen output)
- ✅ `firmware/src/graph_codegen/pattern_spectrum.cpp` (codegen output)
- ✅ `firmware/main` binary (flashing-ready)

---

#### Day 2: Hardware Smoke & Audio Testing (8 hours)

| Time | Task | Owner | Validation | Risk |
|------|------|-------|------------|------|
| 1h | Flash + boot validation | Test Engineer | Serial log: `[BOOT]` signature, no crashes | **Risk:** USB port issue → try different cable/port |
| 1h | LED smoke test (silence, fill white, gradient) | Test Engineer | All 160 LEDs respond, no flicker | **Risk:** RMT timing: max gap > 100µs → reduce pattern complexity or increase RMT buffer |
| 2h | Audio test suite (440 Hz, sweeps, noise, music) | Test Engineer | 6/6 test signals complete, serial logs captured | **Risk:** Microphone saturation (dBFS > 0) → reduce input level or adjust INMP441 gain |
| 2h | Capture golden CRC baselines | Test Engineer | 30-frame sequences logged per signal | **Risk:** Frame drop (jitter) → verify I2S DMA not starved (check CPU monitor) |
| 1h | Preliminary analysis & anomaly log | Signal Analysis | CRC stability, decay rates, peak frequencies documented | **Risk:** Unexpected behavior → create GitHub issue with logs |
| 1h | Buffer/Reserve | Contingency | *(N/A)* | Drift allowance |

**Day 2 Deliverables:**
- ✅ Serial logs (raw CRC captures)
- ✅ Preliminary analysis document
- ✅ Anomaly list (if any)

---

#### Day 3: Golden Baseline & Report (4 hours)

| Time | Task | Owner | Output | Risk |
|------|------|-------|--------|------|
| 2h | Finalize golden CRC baselines; compute decay tau & peak accuracy | Analysis | `K1NReport_BLOOM_SPECTRUM_GOLDEN_BASELINE_v1.0.md` | **Risk:** CRC variance > 2% → investigate firmware float rounding or audio clock drift |
| 1h | Regression validation (re-run one signal, compare CRCs) | Test Engineer | Validation report | **Risk:** CRC mismatch → trace to specific node diff (check git commit) |
| 1h | Archive logs + create PoC summary for docs/ | Documentation | Link docs to analysis, store reference CRC in code comment | **Risk:** Missing links → tag maintainer for index update |

**Day 3 Deliverables:**
- ✅ `docs/09-reports/K1NReport_BLOOM_SPECTRUM_GOLDEN_BASELINE_v1.0_20251112.md`
- ✅ `docs/09-reports/K1NReport_POC_EXECUTION_SUMMARY_v1.0_20251112.md` (this report + results)
- ✅ Reference CRC values embedded in code (comments in pattern_*.cpp)

---

### Risk Mitigation Matrix

| Risk | Probability | Impact | Mitigation | Fallback |
|------|-------------|--------|------------|----------|
| **Compilation fails** (codegen bug) | Medium | Critical | Validate k1c on simple test graph first (e.g., Fill→LedOutput) | Escalate to maintainer; generate C++ manually for PoC |
| **FPS drops < 120** | Medium | High | Profile hot path (LowPass, BufferPersist overhead); measure per-node cost | Defer spatial blur (Phase 2); strip non-essential nodes |
| **Audio I2S timeout** | Low | High | Monitor I2S ringbuffer depth; add `/api/device/audio` health check | Fallback to silence; skip pattern or inject placeholder envelope |
| **Stack overflow** (IRAM exhausted) | Low | Critical | Add `-Wstack-usage=3000` compile flag; reduce local array sizes | Move BufferPersist to PSRAM (slower) or eliminate phase 1 |
| **CRC mismatch on reference** | Medium | Medium | Document calibration drift; re-baseline after firmware change | Mark baseline as stale; re-capture with new build signature |
| **LED timing jitter (RMT refill gaps)** | Low | High | Monitor `/diagnostics/rmt_probe.h` data; verify mem_block_symbols ≥ 256 | Reduce NUM_LEDS or add safety margin to timeout |
| **Microphone saturation** | Medium | Medium | Reduce input level; measure dBFS before test | Use quieter reference signal; repeat with adjusted gain |
| **USB flashing timeout** | Low | Low | Retry with different cable; clear `.pio` cache | Use manual bootloader mode (GPIO0→GND) |

---

### Rollback Plan (If Day 1–2 Fails)

**If compilation fails (Day 1):**
1. Revert k1c to prior known-good version
2. Manually write pattern_bloom.cpp / pattern_spectrum.cpp using firmware helpers
3. Validate CRC on manual implementation to establish baseline
4. Escalate compiler issue to maintainer with IR dump

**If FPS < 120 (Day 2):**
1. Profile per-node cost using `profiler.h` instrumentation
2. Disable non-critical nodes (e.g., Blur for Bloom; DotRender for Spectrum)
3. Re-test; if FPS recovers, note as Phase 2 deferral
4. Document performance budget in ADR

**If I2S timeout (Day 2):**
1. Verify I2S ringbuffer not full: check `pattern_audio_interface.cpp` for stale snapshot detection
2. Reduce audio sample rate (16kHz instead of 48kHz) if configurable
3. Inject mock audio envelope for pattern validation (decouple audio from pattern)

**If CRC diverges (Day 3):**
1. Git bisect between working commit and current; identify breaking change
2. If firmware-related: revert and re-run (don't force match)
3. If parameter drift: re-baseline with documented reason
4. Create issue for stabilization (e.g., "LowPass alpha should be ±0.01 tolerance")

---

## Part 5: Success Criteria Summary (Checklist)

### Bloom PoC

- [ ] **Compilation:** Bloom.json → pattern_bloom.cpp, 0 warnings, <2min build
- [ ] **Visual Validation:** Persistent glow visible on 440Hz test, fade-out in 30s (±5% decay tau)
- [ ] **Audio Responsiveness:** Envelope peak within ±10% of reference (440 Hz tone)
- [ ] **CRC Golden Baseline:** 10 frames captured, CRC stable ±2%
- [ ] **Performance:** FPS ≥ 120, RAM < 1.5 KB, stack < 3 KB peak
- [ ] **Documentation:** Node mapping table, CRC baseline logged, decay analysis included

### Spectrum PoC

- [ ] **Compilation:** Spectrum.json → pattern_spectrum.cpp, 0 warnings, <2min build
- [ ] **Frequency Accuracy:** 440 Hz tone peak within ±20 Hz (±4.5%)
- [ ] **Visual Integrity:** Gradient colors match palette, peaks distinct, no flicker
- [ ] **CRC Golden Baseline:** 10 frames captured per signal, peak positions logged
- [ ] **Performance:** FPS ≥ 120, latency < 50ms (capture to LED output)
- [ ] **Documentation:** Frequency-to-LED mapping table, CRC baseline, peak accuracy analysis

### Shared Requirements

- [ ] **Build Signature Visible:** Boot message includes IDF/Arduino/PlatformIO versions
- [ ] **No Regressions:** Existing patterns (beat_pulse, color_chase, etc.) still run at ≥120 FPS
- [ ] **Test Coverage:** 6 audio signals tested (silence, 440 Hz, sweep, pink, white, music)
- [ ] **Golden CRC Stored:** Reference values in docs + code comments for regression detection
- [ ] **Artifacts Filed:** All reports, logs, and CRC baselines in `docs/09-reports/`

---

## Part 6: Post-PoC Deliverables (Phase 1 Readiness)

### Documents to Create/Update

1. **`docs/06-reference/K1NRef_BLOOM_SPECTRUM_NODE_MAPPING_v1.0.md`**
   - Finalized node mappings (Tables from Part 1)
   - Rationale for node selection (Why LowPass + BufferPersist for Bloom?)
   - Performance footnotes (memory cost, FPS impact)

2. **`docs/09-reports/K1NReport_BLOOM_SPECTRUM_GOLDEN_BASELINE_v1.0_20251112.md`**
   - CRC values per test signal and frame (30-frame sequences)
   - Decay tau calculations (τ from exponential fit)
   - Peak frequency accuracy (±Hz error per signal)
   - Audio calibration notes (input level, dBFS, date/time)

3. **`docs/09-reports/K1NReport_POC_EXECUTION_SUMMARY_v1.0_20251112.md`**
   - 3-day timeline recap (what went well, blockers, solutions)
   - Performance profile: per-node cost breakdown (LowPass, BufferPersist, FFT)
   - Risk retrospective (which risks materialized? How handled?)
   - Recommendation: Ready for Phase 1 → Yes/No/Conditional

4. **Update `docs/04-planning/K1NPlan_TASK_ROADMAP_CORRECTED_v1.0_20251110.md`**
   - Mark Tasks 7-8 as Complete ✅
   - Link to PoC reports
   - Note any deferred items (Blur, MovingAverage for Phase 2)

5. **Code Comments in `firmware/src/graph_codegen/pattern_{bloom,spectrum}.cpp`**
   - Docstring with golden CRC reference (sample frame)
   - Link to phase requirements ADR
   - Audio test signal description

---

## Conclusion

Tasks 7-8 PoC is **achievable in 3 days** with the current 39-node catalog and skeleton placeholders. The mapping is straightforward:
- **Bloom:** 7 nodes, 1.3 KB memory, depends on LowPass + BufferPersist stateful behaviors
- **Spectrum:** 5 nodes, 256 bytes memory, pure FFT path with firmware helper for per-bin gradient mapping

**Critical Path:**
1. Day 1: Design JSON, compile, build
2. Day 2: Flash, smoke test, audio validation
3. Day 3: Golden CRC baseline, regression validation, reporting

**Go/No-Go Decision Point:** End of Day 1 (compilation success). If k1c compiler produces valid C++, hardware testing proceeds; if compilation fails, fallback to manual C++ implementation.

---

**Status:** Ready for execution  
**Next Steps:** Assign Day 1 compiler validation to build engineer; proceed with timeline above


# Quick Reference: Bloom & Spectrum Node Mapping

**Document:** K1NRef_BLOOM_SPECTRUM_NODE_MAPPING_QUICK_v1.0  
**Date:** November 10, 2025  
**Status:** Reference (Phase 1)  
**Related:** `K1NPlan_TASK_7_8_POC_EXECUTION_v1.0_20251110.md`

---

## Bloom Pattern: 7-Node Graph

### Algorithm Flow
```
Audio Input (VU Envelope)
        ↓
   LowPass Filter (smooth jitter, α=0.1)
        ↓
    Hsv Color Gen (hue from time, saturation param, value from envelope)
        ↓
   Fill (broadcast color to all 180 LEDs)
        ↓
  BufferPersist (frame-to-frame blend with decay, τ=0.95)
        ↓
 LedOutputMirror (write to hardware with vertical symmetry)
```

### Node Breakdown

| ID | Type | Input(s) | Output | Memory | Stateful? | Purpose |
|----|------|----------|--------|--------|-----------|---------|
| `audio` | `AudioSnapshot` | *(none)* | `float` (VU 0–1) | 0B | No | Capture current audio envelope |
| `time_node` | `Time` | *(none)* | `float` (seconds) | 0B | No | Elapsed time for hue rotation |
| `param_sat` | `ParamF` | *(none)* | `float` (0–1) | 0B | No | Saturation control (UI) |
| `param_decay` | `ParamF` | *(none)* | `float` (0–1) | 0B | No | Decay factor (UI), e.g., 0.95 |
| `smooth` | `LowPass` | `signal: audio`, `alpha: 0.1` | `float` | 4B | **Yes** | IIR smooth (1-pole filter) |
| `color` | `Hsv` | `h: time_node`, `s: param_sat`, `v: smooth` | `color` (vec3) | 0B | No | HSV → RGB conversion |
| `fill` | `Fill` | `color: color` | `led_buffer<vec3>` | ~1.2K | No | Broadcast to all LEDs |
| `persist` | `BufferPersist` | `src: fill`, `decay: param_decay` | `led_buffer<vec3>` | ~1.2K | **Yes** | Persistent decay buffer |
| `out` | `LedOutputMirror` | `color: persist` | *(terminal)* | 0B | No | Write to hardware (mirror) |

**Total Stateful Memory:** 4B + 1.2KB = ~1.3 KB ✅ (within budget)  
**Total Temp Buffers:** ~1.2 KB (reused per frame)  
**Pure Nodes (Reorderable):** 6 of 9  

---

## Spectrum Pattern: 5-Node Graph

### Algorithm Flow
```
Audio Input (64-bin FFT spectrum)
        ↓
GradientMap (frequency bin → color palette, e.g., "viridis")
        ↓
  DotRender (optional peak markers, blend_mode="add")
        ↓
  LedOutput (write to hardware)
```

### Node Breakdown

| ID | Type | Input(s) | Output | Memory | Stateful? | Purpose |
|----|------|----------|--------|--------|-----------|---------|
| `spec` | `AudioSpectrum` | *(none)* | `float[64]` | 0B (read-only) | No | FFT bins (64-point, 0–8kHz) |
| `param_palette` | `ParamF` | *(none)* | `float` (0–5) | 0B | No | Palette mode selector (UI) |
| `grad_fft` | `GradientMap` | `index: spec[*]` (per-bin loop via codegen) | `color` (vec3) | 0B | No | Frequency → color mapping |
| `dots` | `DotRender` | `base_buf: fill_spectrum`, `peak_indices: [peaks...]` | `led_buffer<vec3>` | ~1.2K | No | Peak indicators on top |
| `out` | `LedOutput` | `color: dots` | *(terminal)* | 0B | No | Write to hardware |

**Total Stateful Memory:** 0B ✅ (pure analysis, no state)  
**Total Temp Buffers:** ~1.2 KB (gradient map result + dot render output, reused per frame)  
**Pure Nodes:** All 5 (CSE-eligible)  

**Phase 1 Codegen Limitation:** GradientMap requires loop over 64 spectrum bins → compiler emits firmware helper or loop-unrolled nodes. See note below.

---

## Node Selection Rationale

### Bloom: Why These Nodes?

| Node | Why | Alternative | Why Not |
|------|-----|-------------|---------|
| `AudioSnapshot` | Single VU scalar needed | `AudioSpectrum` | Overkill for bloom; not frequency-dependent |
| `LowPass` | Smooth envelope jitter, implement decay formula | `MovingAverage` | Stateful but slower (ring buffer); LowPass more natural for audio |
| `Hsv` | Perceptually smooth hue rotation + saturation control | `Color` | No hue rotation; would require external param driver |
| `Fill` | Broadcast single color to all LEDs | `Gradient Map` (with constant) | Unnecessary indirection |
| `BufferPersist` | Frame-to-frame decay/trail essential for bloom feel | `ComposeLayers` (previous frame overlay) | More complex; BufferPersist designed exactly for this |
| `LedOutputMirror` | Hardware is symmetric (180 LEDs, mirrored physically) | `LedOutput` + manual mirror node | Uses hardware layout directly; cleaner |

### Spectrum: Why These Nodes?

| Node | Why | Alternative | Why Not |
|------|-----|-------------|---------|
| `AudioSpectrum` | FFT required for frequency visualization | `AudioSnapshot` | No frequency info |
| `GradientMap` | Palette-based frequency→color is standard | `Hsv` per-bin | Would require loop; GradientMap + palette is cleaner |
| `DotRender` | Peak indicators add clarity; common in spectrum vis | `ComposeLayers` with separate peak buffer | DotRender is purpose-built; simpler |
| `LedOutput` | Hardware write | `LedOutputMirror` | Spectrum doesn't use symmetry (full strip) |

---

## JSON Schema Examples

### Bloom (Minimal)
```json
{
  "version": 1,
  "name": "bloom_mirror_poc",
  "nodes": [
    {"id": "audio", "type": "AudioSnapshot"},
    {"id": "time_node", "type": "Time"},
    {"id": "param_sat", "type": "ParamF", "params": {"name": "Saturation", "min": 0.0, "max": 1.0, "default": 0.9}},
    {"id": "param_decay", "type": "ParamF", "params": {"name": "Decay", "min": 0.0, "max": 1.0, "default": 0.95}},
    {"id": "smooth", "type": "LowPass", "inputs": {"signal": "audio"}, "params": {"alpha": 0.1}},
    {"id": "color", "type": "Hsv", "inputs": {"h": "time_node", "s": "param_sat", "v": "smooth"}},
    {"id": "fill", "type": "Fill", "inputs": {"color": "color"}},
    {"id": "persist", "type": "BufferPersist", "inputs": {"src": "fill", "decay": "param_decay"}},
    {"id": "out", "type": "LedOutputMirror", "inputs": {"color": "persist"}}
  ]
}
```

### Spectrum (Minimal with Codegen Workaround)
```json
{
  "version": 1,
  "name": "spectrum_gradient_poc",
  "nodes": [
    {"id": "spec", "type": "AudioSpectrum"},
    {"id": "param_palette", "type": "ParamF", "params": {"name": "Palette", "min": 0.0, "max": 5.0, "default": 0.0}},
    {"id": "dots", "type": "DotRender", "inputs": {}, "params": {"blend_mode": "add", "peak_width": 2}},
    {"id": "out", "type": "LedOutput", "inputs": {"color": "dots"}}
  ]
}
```

**Note on Spectrum JSON:**
- `AudioSpectrum` → `DotRender` mapping is handled by firmware helper `spectrum_to_led_buffer()` during code generation
- Compiler detects spectrum input and emits appropriate interpolation + gradient mapping

---

## Performance Targets (Phase 1)

| Metric | Bloom | Spectrum | Target | Notes |
|--------|-------|----------|--------|-------|
| **FPS** | ≥120 | ≥120 | ≥120 | Hardware SPI/RMT limited; target is not bottleneck |
| **Render Time** | <5ms | <5ms | <8ms | Per-frame CPU time (both patterns) |
| **RAM (Stateful)** | 1.3 KB | 0 KB | <2 KB | Bloom uses 2 stateful nodes; Spectrum is pure |
| **Latency (A→L)** | <50ms | <50ms | <100ms | Audio capture to LED output |
| **Stack Peak** | <3 KB | <2 KB | <4 KB | Temporary buffer allocations |

---

## Test Signals & Expected Behavior

### Bloom Test Signals

| Signal | Duration | Audio Characteristic | Expected LED Behavior | Success Criterion |
|--------|----------|--------|--------|--------|
| **Silence** | 10s | 0 dBFS (no input) | Exponential fade to black | Tau = 0.95 ± 5%, reaches <1% brightness in 30s |
| **440 Hz Tone** | 30s | 0.5Vrms sine (steady) | Plateau at constant amplitude | Amplitude stable ±5%, no flicker |
| **Sweep 20→8000** | 60s | Log ramp (1 oct/10s) | Envelope follows sweep | Peak follows within 200ms lag |
| **Pink Noise** | 30s | 0.5Vrms, 1/f spectrum | Mid-range emphasis (~0.6 amplitude) | Consistent with noise spectral density |

### Spectrum Test Signals

| Signal | Duration | Audio Characteristic | Expected LED Behavior | Success Criterion |
|--------|----------|--------|--------|--------|
| **440 Hz Tone** | 30s | Pure sine, 440 Hz | Peak @ bin ~22 (64-bin FFT) | Peak within ±20 Hz (±4.5% error) |
| **Sweep 20→8000** | 60s | Log ramp | Peak sweeps left-to-right | Linear frequency-to-position mapping |
| **Two-Tone (440+880)** | 20s | 440 Hz + 880 Hz mix | Two distinct peaks | Both peaks visible & separate |
| **White Noise** | 30s | Broadband uniform | Flat distribution across LEDs | Kolmogorov-Smirnov test (H0: uniform) |

---

## Golden CRC Baseline (After PoC)

### Bloom Reference (440 Hz steady tone, 30 seconds)
```
Frame 30 (T=1s):   CRC=0xABC12345 Envelope=0.87
Frame 60 (T=2s):   CRC=0xDEF67890 Envelope=0.86
Frame 900 (T=30s): CRC=0xABCD1234 Envelope=0.01
```

### Spectrum Reference (440 Hz, 30 seconds)
```
Frame 30 (T=1s):   CRC=0x12345678 Spectrum[22]=0.92 Peaks=[22]
Frame 60 (T=2s):   CRC=0x87654321 Spectrum[22]=0.91 Peaks=[22]
```

**Baseline Capture Date:** TBD (after Day 3 PoC execution)  
**Tolerance:** ±2% per-frame variance (floating-point rounding)  
**Regression Protocol:** If CRC mismatch on future commits, investigate firmware changes and re-baseline with documented reason

---

## Quick Decision Tree

### Choosing Bloom or Spectrum

```
├─ Is pattern audio-driven by single energy/VU value?
│  └─ YES → Use BLOOM (7 nodes)
│  └─ NO → Use SPECTRUM (5 nodes)
│
├─ Does pattern require persistent trail/decay?
│  └─ YES → Use BLOOM (BufferPersist)
│  └─ NO → Use SPECTRUM (pure FFT)
│
├─ Do you need frequency-specific visualization?
│  └─ YES → Use SPECTRUM (GradientMap + FFT)
│  └─ NO → Use BLOOM (HSV color generation)
```

---

## Compilation & Integration

### Day 1 Compiler Workflow
```bash
# 1. Design JSON files
$ cat > bloom_poc.json  # (9 nodes, 500 lines from example above)
$ cat > spectrum_poc.json  # (5 nodes, 400 lines)

# 2. Validate schema
$ k1c validate bloom_poc.json spectrum_poc.json --schema codegen/schemas/graph.schema.json

# 3. Compile to C++
$ k1c compile bloom_poc.json spectrum_poc.json --output firmware/src/graph_codegen/

# 4. Check generated code
$ wc -l firmware/src/graph_codegen/pattern_bloom.cpp  # Expect ≥100 lines
$ wc -l firmware/src/graph_codegen/pattern_spectrum.cpp  # Expect ≥100 lines

# 5. Build firmware
$ cd firmware && platformio run -e esp32-s3-devkitc-1-rmtv2
```

### Success Indicators
- ✅ `pattern_bloom.cpp` contains explicit nodes: AudioSnapshot, LowPass, Hsv, Fill, BufferPersist, LedOutputMirror
- ✅ `pattern_spectrum.cpp` contains nodes: AudioSpectrum, GradientMap (or firmware helper), DotRender, LedOutput
- ✅ Zero compiler warnings
- ✅ Build time <2 minutes
- ✅ Binary size change <5% (relative to baseline)

---

## Common Gotchas & Fixes

| Issue | Cause | Solution |
|-------|-------|----------|
| "LowPass alpha parameter not recognized" | Schema version mismatch | Use `k1c --version` to confirm; update graph.schema.json if needed |
| "GradientMap needs palette enum" | Phase 1 limitation: enum not in JSON | Use default palette ("viridis"); Phase 2 adds palette selector nodes |
| "BufferPersist buffer overflow" | NUM_LEDS > STATEFUL_NODE_BUFFER_SIZE | Check stateful_nodes.h: STATEFUL_NODE_BUFFER_SIZE = 180 (matches NUM_LEDS) |
| "FPS drops to <100 after BufferPersist add" | Memory access pattern thrashing | Profile with `profiler.h`; may need to defer Phase 2 optimizations |
| "Spectrum FFT outputs garbage" | I2S audio thread stalled | Monitor `pattern_audio_interface.cpp` ringbuffer depth; check CPU load |
| "CRC mismatch on rerun" | Floating-point rounding from firmware change | Document baseline date + commit hash; re-capture with new build signature |

---

## Reference Links

- **39-Node Catalog:** `docs/06-reference/K1NRef_GRAPH_NODE_CATALOG_EXPANDED_v2.0_20251110.md`
- **PoC Execution Plan:** `docs/04-planning/K1NPlan_TASK_7_8_POC_EXECUTION_v1.0_20251110.md`
- **Stateful Nodes API:** `firmware/src/stateful_nodes.h`
- **Pattern Audio Interface:** `firmware/src/pattern_audio_interface.h`
- **Tasks 7-8 Roadmap:** `docs/04-planning/K1NPlan_TASK_ROADMAP_CORRECTED_v1.0_20251110.md`

---

**Document Status:** Reference (Phase 1)  
**Last Updated:** November 10, 2025  
**Maintainer:** Signal Processing Research Team


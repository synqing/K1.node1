# Real-Time Audio Feature Extraction on ESP32-S3: Comprehensive Analysis

**Date:** 2025-11-07
**Status:** `accepted`
**Owner:** Research Analyst
**Scope:** Efficient algorithms, resource constraints, implementations, validation
**Related:** [K1 Architecture](../01-architecture/), [ADR audio processing decisions](../02-adr/), [Audio Reactive LED Guide](../07-resources/)
**Tags:** `audio-dsp`, `esp32s3`, `embedded-dsp`, `led-reactivity`, `real-time`, `feature-extraction`

---

## Executive Summary

ESP32-S3 (240MHz dual-core) can sustain real-time audio feature extraction for audio-reactive LED visualization using:

1. **FFT-based spectral analysis** (4096-sample buffers, 16kHz sampling) with ~15-25ms latency
2. **Goertzel for targeted frequency bands** (50–150Hz kick, 100–300Hz bass, 1–4kHz highs) with minimal CPU overhead
3. **Onset detection** via spectral flux + adaptive thresholding for beat tracking with <10ms additional latency
4. **Circular buffers + IRAM optimization** to fit all hot-path code within 128KB IRAM budget

**Critical constraint:** 50ms end-to-end latency is acceptable for LED sync; <30ms preferred for beat-phase accuracy.

---

## 1. Algorithm Trade-Offs (16kHz, 16-bit, 4096-sample buffers)

### 1.1 FFT vs Goertzel vs STFT

| Metric | FFT-512 | FFT-1024 | FFT-4096 | Goertzel (4 bins) | STFT-1024 |
|--------|---------|----------|----------|-------------------|-----------|
| **CPU Cycles (ESP32-S3, 240MHz)** | ~2500–3500 | ~5000–7000 | ~15000–20000 | ~300–500 | ~6000–8000 |
| **Latency (ms)** | 5.3 | 10.7 | 42.7 | 0.65 | 10.7 |
| **Frequency Resolution** | 31.25Hz | 15.6Hz | 3.9Hz | Custom | 15.6Hz |
| **Memory (DRAM)** | 2KB | 4KB | 16KB | <1KB | 8KB + overlap |
| **IRAM Overhead** | 3KB | 6KB | 20KB | <1KB | 8KB + |
| **Best Use Case** | Bass/kick detection | General spectral | Full analysis + harmonics | Targeted beat frequencies | Continuous spectral |
| **ESP-DSP Optimized** | Yes (ANSI + asm) | Yes (ANSI + asm) | Yes (ANSI + asm) | — | Via FFT |

**Recommendation:** Hybrid approach:
- **Goertzel for beat detection:** 4 custom frequencies (60Hz kick sub, 100Hz kick, 150Hz bass, 3kHz attack)
- **FFT-512 for general visualization:** 31.25Hz bins, update every 256 samples (5.3ms), smooth via EMA
- **Optional HPSS:** Median-filtered spectrogram if separating harmonic/percussive needed (high CPU, skip for LED-only)

---

### 1.2 Median Filtering (HPSS) vs Simpler Alternatives

**HPSS via Median (Harmonic-Percussive Separation):**
- Process: Filter spectrogram horizontally (harmonic) and vertically (percussive), apply masks to ISTFT
- **CPU Cost:** ~20–30% of FFT cost per frame (expensive for 16kHz streaming)
- **Memory:** Requires full spectrogram buffer (FFT bins × history frames)
- **Embedded Verdict:** **Not practical for LED-only systems.** Stick to energy-based band separation.

**Simpler LED-Optimized Alternatives:**
1. **Band-pass energy detection:**
   - Filter audio into 3–4 frequency bands (Butterworth or simple recursive IIR)
   - Compute RMS per band, smooth with EMA
   - **CPU:** ~0.5ms per frame | **Memory:** Minimal | **Best for:** Bass/mid/treble reactivity

2. **Spectral centroid + flux:**
   - Compute weighted average frequency + magnitude change per frame
   - Indicates brightness and activity without full spectrum
   - **CPU:** ~2ms (post-FFT) | **Memory:** O(FFT bins) | **Best for:** Adaptive patterns

3. **Zero-crossing rate + energy:**
   - Cheap feature for percussive vs harmonic detection (don't use for frequency analysis)
   - **CPU:** <0.5ms | **Memory:** Minimal | **Best for:** Quick onset hints

**Recommendation:** Use **band-pass RMS** (simplest) + **spectral flux** (more sophisticated) for dual-scale reactivity.

---

### 1.3 Onset Detection & Beat Tracking

**Onset Detection Function (ODF):**

1. **Spectral Flux (Recommended for embedded):**
   ```
   flux(t) = sum over bins of max(0, magnitude(t,bin) - magnitude(t-1,bin))
   ```
   - Detects note onsets by measuring magnitude increase per bin
   - **Latency:** ~10ms after onset (frame-dependent)
   - **CPU:** ~1–2ms (post-FFT)
   - **Tuning:** Apply pre-emphasis on high-frequency bins (attack sounds)

2. **Spectral Centroid Shift:**
   - Sudden upward shift in weighted frequency indicates onset
   - **Latency:** ~10–15ms
   - **CPU:** ~0.5ms (post-FFT)
   - **Tuning:** Threshold on delta centroid, smooth with low-pass

3. **Energy Envelope (Simplest):**
   - RMS energy change, apply adaptive threshold
   - **Latency:** Frame-based (~5ms at 16kHz)
   - **CPU:** <0.5ms
   - **Caveat:** Many false positives (vibrato, subtle dynamics)

**Adaptive Threshold:**
```
threshold = running_mean(ODF) + k * running_std(ODF)
k = 0.5–1.5 (tune by music genre)
```

**Peak Picking (for beat triggers):**
- Wait for ODF to exceed threshold and return to baseline (avoids double-triggers)
- Feedback peak times to tempo estimation (moving average BPM)
- **Latency:** +5–10ms for confirmation

**Recommended Flow:**
1. Compute spectral flux after each FFT (10ms window)
2. Apply adaptive threshold with 1–2s running statistics
3. Peak-pick with 100–200ms refractory period (minimum beat interval)
4. Track tempo via inter-beat intervals (exponential moving average, tau=2–5s)
5. Predict next beat via tempo model (lookahead for LED sync, up to 50ms)

**Real-World Example (OBTAIN algorithm):**
- Achieves beat tracking at 16–20ms latency using Onset Strength Signal + dynamic programming
- Suitable for embedded port (online variant without full DP)

---

### 1.4 Spectral Features (Centroid, Flux, Rolloff)

| Feature | Formula | Latency | CPU | Use Case |
|---------|---------|---------|-----|----------|
| **Spectral Centroid** | `sum(f * mag(f)) / sum(mag(f))` | <1ms | 0.5ms | Brightness indicator |
| **Spectral Flux** | `sum(max(0, mag(t) - mag(t-1)))` | <1ms | 1–2ms | Onset detection |
| **Spectral Rolloff** | `f where cumsum(mag) = 0.85 * total` | <1ms | 2–3ms | High-frequency activity |
| **Zero-Crossing Rate** | Avg bin transitions per frame | <1ms | <0.5ms | Quickly distinguish pitched/percussive |

**Optimization:**
- Pre-compute bin frequencies and weights at boot
- Use fixed-point arithmetic if FPU not available
- Accumulate results per frame, smooth with EMA before visualization

---

## 2. Resource Constraints & Optimization

### 2.1 ESP32-S3 Memory Map

| Region | Size | Use Case | Notes |
|--------|------|----------|-------|
| **IRAM0 (128KB)** | Hot path code | FFT kernel, circular buffer mgmt, I2S ISR | Critical bottleneck |
| **DRAM (Main, 320KB)** | Audio buffers, stack, heap | I2S buffers, spectrogram, app state | Shared with OS |
| **PSRAM (optional, 4–8MB)** | Large buffers, history | Long-term spectrograms (not needed for LED) | Slow (60–70ns latency vs 10ns DRAM) |
| **Flash (4–8MB)** | Code, LUT | FFT twiddle factors, window functions | Read-only, cached by HW |

**Strategy:**
- Fit FFT (4096) + window + twiddles + workspace in IRAM (~20KB)
- Keep circular I2S buffer and quantization workspace in fast DRAM
- Use PSRAM only for diagnostic logging (slow, not real-time)

### 2.2 Optimal Window Size & Buffer Dimensioning

**Given:** 16kHz sampling, 240MHz CPU, 50ms max latency

| Window Size | Frame Time | FFT Cycles | Latency (ms) | Freq Resolution | Notes |
|-------------|-----------|-----------|--------------|-----------------|-------|
| **256 samples** | 16ms | 1500–2000 | 16 | 62.5Hz | Tight latency; noisy spectrum |
| **512 samples** | 32ms | 3000–4000 | 32 | 31.25Hz | **RECOMMENDED for LED** |
| **1024 samples** | 64ms | 6000–8000 | 64 | 15.6Hz | Better freq res; exceeds latency budget |
| **4096 samples** | 256ms | 20000–25000 | 256 | 3.9Hz | Too slow for real-time response |

**Recommendation:** **512-sample FFT** with 50% overlap (256-sample hop)
- Update spectral features every 5.3ms (256 samples @ 16kHz)
- Total processing per 256 samples: ~3ms (FFT every 2 hops = ~6ms total)
- Allow 40–45ms for visualization pipeline (comfortable headroom)

**Circular Buffer Layout:**
```
I2S input (stereo, 32-bit pairs) → 256-sample mono accumulator
→ 512-sample FFT window (overlapping)
→ FFT output spectrum (256 complex bins or 512 reals)
→ Feature extraction (spectral properties, energy bands)
→ EMA smoothing (1–2 frame history)
→ LED color/intensity update
```

---

### 2.3 IRAM vs DRAM Trade-Offs

**IRAM Placement (Critical Path):**
```cpp
// Move to IRAM with IRAM_ATTR macro
IRAM_ATTR void fft_rfft_512(int32_t *input, complex_t *output) { ... }

// Pre-computed twiddle factors (read-only, flash-resident)
const float FFT_TWIDDLES_512[] PROGMEM = { ... };  // <3KB
const float WINDOW_HANN_512[] PROGMEM = { ... };   // <2KB
```

**DRAM for Buffers:**
- I2S DMA double-buffer: 2 × 256 samples × 4 bytes = 2KB (pinned by driver)
- Working FFT buffer (in-place): 512 samples × 8 bytes = 4KB
- Spectral history (last 2 frames for flux): 512 bins × 8 bytes × 2 = 8KB
- Feature accumulators (centroid, flux, rolloff): <1KB
- **Total:** ~15–20KB DRAM for hot path

**Benchmark (from Espressif ESP-DSP docs):**
- FFT-512 real (ANSI): ~4000 cycles ≈ 16.7ms @ 240MHz (unoptimized)
- FFT-512 real (optimized asm): ~2500 cycles ≈ 10.4ms @ 240MHz
- Window multiply: ~500 cycles ≈ 2ms
- Feature extraction: ~1000 cycles ≈ 4.2ms
- **Total per frame:** ~16.6ms (tight, but acceptable at 50% duty cycle with overlapped hops)

---

### 2.4 Cache-Friendly Processing Patterns

1. **Single-pass FFT + features:**
   - Compute FFT → immediately extract centroid, flux, bins for visualization
   - Avoid re-loading FFT output from memory

2. **Staggered processing (recommended):**
   - Core 0: Audio input (I2S ISR) + basic windowing
   - Core 1: FFT + feature extraction (runs asynchronously)
   - Synchronize via ring buffer, minimal lock overhead

3. **Circular buffer indexing:**
   ```cpp
   // Avoid modulo; use bitwise AND for power-of-two sizes
   idx_next = (idx + 1) & (BUFFER_SIZE - 1);  // Fast, cache-friendly
   ```

4. **Prefetching:** Window function applied *during* data load, not after

---

## 3. Real-World Implementations & Benchmarks

### 3.1 Espressif ESP-DSP Library

**Status:** Official, maintained, optimized for ESP32/S3
**Website:** https://docs.espressif.com/projects/esp-dsp/en/latest/esp32/

**Implementations:**
- FFT (radix-2, radix-4): Real/complex, 64–4096 points
- Window functions: Hann, Hamming, Blackman
- FIR/IIR filters
- Vector math (dot product, magnitude, normalize)

**Benchmarks (from docs):**
```
FFT-512 real (ESP32-S3, 240MHz, optimized):
  - ANSI C: 4500 cycles
  - Optimized (ESP-IDF): 2800 cycles

FFT-1024 real (ESP32-S3):
  - ANSI C: 10000 cycles
  - Optimized: 6000 cycles
```

**Integration:** Copy `components/esp-dsp` or fetch via ESP Component Registry.
**Example:** See `examples/fft/fft_real_s16_ansi.c` for simple usage.

---

### 3.2 Teensy Audio Library (ARM Cortex-M4 Reference)

**Status:** Mature, ARM DSP-accelerated
**Website:** https://www.pjrc.com/teensy/td_libs_AudioAnalyzeFFT.html

**Key Facts:**
- 512-bin FFT updates at 86Hz (11.6ms per frame, 128-sample blocks @ 44.1kHz)
- 1024-point FFT + inverse FFT with full DSP chains at 96ksps = 60–70% CPU load
- ARM CMSIS DSP library integration: **4–5x faster** than generic C (FFT-specific)

**Latency:** 2.9ms per 128-sample block (minimal for interactivity)

**Lesson for ESP32-S3:** Use Xtensa-specific optimizations (ESP-DSP) similarly to ARM CMSIS.

---

### 3.3 Audio-Reactive LED Strip Implementations

**Common Pattern (GitHub implementations: scottlawsonbc, Aircoookie, others):**
1. ADC sampling at 16–44.1kHz (often SPI/I2S on ESP8266/ESP32)
2. FFT-1024 or FFT-512 every 10–20ms
3. Extract 8–16 frequency bins (bass, low-mids, mids, highs, ultra-high)
4. Smooth with low-pass IIR or EMA (alpha = 0.1–0.3)
5. Map energy to LED color, apply temporal effects

**Performance Reality:**
- ESP8266 (160MHz, 1-core): Achieves ~30 FPS visualization with 1024-point FFT + smoothing
- ESP32 (240MHz, 2-core): Achieves 50–60 FPS without optimization; 100+ FPS with proper staggering
- Critical bottleneck: **SPI LED output** (WS2812, APA102), not audio processing

---

### 3.4 Alternative Embedded Audio Libraries

| Library | Platform | Language | Strengths | Weaknesses |
|---------|----------|----------|-----------|-----------|
| **ESP-DSP** | ESP32/S3/P4 | C, asm | Native opt., official, well-benchmarked | Limited features outside DSP core |
| **Kiss FFT** | Generic | C | Portable, real FFT, small | No ARM/Xtensa opt., slower |
| **CMSIS-DSP** | ARM Cortex | C, asm | Highly optimized, mature | ARM-only; not for ESP32 |
| **Faust** | Generic → ESP32 | Domain-specific | Great for audio filters/effects | Slower to compile, more memory |
| **librosa** | Python | Python/NumPy | High-level, feature-rich | Not embeddable; too slow |
| **Essentia** | Cross-platform | C++ + Python | Comprehensive MIR features | Heavy dependencies, not embedded-friendly |

**Embedded Verdict:** **Use ESP-DSP + custom C for feature extraction.** Port simple librosa recipes as needed.

---

## 4. Audio-Reactive LED Visualization Specifics

### 4.1 Feature Selection for LED Patterns

**Frequency-Band Strategy (for diverse music genres):**
```
Sub-Bass   (20–60Hz):   Deep kick fundamentals        → RGB.B intensity (blues)
Kick       (60–150Hz):  Kick punch, bass guitar       → RGB.R intensity (reds)
Low-Mid    (150–400Hz): Bass body, body punch        → RGB.G + R blend
Mid        (400–2kHz):  Vocal presence, instrument   → RGB.G intensity (greens)
High-Mid   (2–6kHz):    Clarity, snare, cymbal attack → RGB.G + B blend
High       (6–20kHz):   Brightness, hi-hats           → RGB.R + G blend (yellow/cyan)
```

**Multi-Scale Features:**
1. **Fast (per-frame, 5–10ms):** Spectral flux, energy in 3–4 key bands
2. **Medium (0.5–1s smoothing):** Spectral centroid, rolloff
3. **Slow (2–5s):** Tempo/BPM via beat detection (phase control, not intensity)

**LED Pattern Ideas:**
- **Bass-reactive:** Map RMS(20–150Hz) to LED hue/saturation
- **Treble-reactive:** Map RMS(2–6kHz) + spectral centroid to brightness/speed
- **Beat-phase:** Sync animation phase to detected beat onset (lookahead by 20–50ms to hide latency)
- **Rhythmic:** Use tempo estimate to phase multi-frame animations

---

### 4.2 Latency Budget

**Total End-to-End Latency Breakdown (worst case):**
```
I2S DMA capture:     5–10ms  (buffer fill)
Audio processing:    10–15ms (FFT + features)
LED rendering:       3–5ms   (color update)
LED transmission:    5–10ms  (WS2812 shift, ~1–2µs per LED, 300 LEDs typical)
—————————————————————
TOTAL:               23–50ms
```

**Perceptual Thresholds:**
- <30ms: Feels instantaneous to human ear/eye
- 30–50ms: Acceptable (most observers don't notice)
- 50–100ms: Noticeable but tolerable for music sync
- >100ms: Clearly out of sync with beat

**For Beat Phase Accuracy:**
- Lookahead beat prediction: Predict next beat 30–50ms in advance
- Apply to animation phase offset before visible display
- **Result:** Subjective sync feels tight even with actual 50ms latency

---

### 4.3 Smoothing & Filtering for Stability

**EMA (Exponential Moving Average) for feature smoothing:**
```cpp
filtered = alpha * new_value + (1 - alpha) * filtered_prev
```

**Recommended alpha values:**
- **Fast reaction (50ms smoothing):** alpha = 0.2–0.3 → responsive but jittery
- **Balanced (200ms smoothing):** alpha = 0.05–0.1 → smooth + responsive
- **Slow (1s smoothing):** alpha = 0.01–0.02 → stable, good for tempo tracking

**Multi-scale approach:**
```
band_energy[i] = smooth_fast(raw_energy[i], alpha=0.1)
display_scale = smooth_slow(max(band_energy), alpha=0.02)
led_intensity = band_energy[i] * display_scale
```

This separates fast reactions (energy spikes) from overall amplitude normalization (prevents LED saturation).

---

## 5. Phase 0 Validation Methodology

### 5.1 Test Audio Suite

**Standard Validation Set (open-source, must-have):**

1. **Metronome (synthetic):**
   - 120 BPM, 4/4, click at 1kHz + 50ms tone
   - Validates beat phase accuracy (should sync within ±50ms)
   - Use: `ffmpeg -f lavfi -i "sine=1000:d=0.05,atrim=0:1" -r 1 -f s16le -acodec pcm_s16le test_click.wav`

2. **Drum Loops (licensed or permissive):**
   - Kick + hi-hat at 100, 120, 140 BPM
   - Complex drums (multiple onsets per bar)
   - Use: Free loops from Freesound.org or Zenodo

3. **Music Tracks (diverse genres):**
   - EDM/House (clear beat, percussive)
   - Hip-hop (syncopated, complex rhythm)
   - Pop (vocals, mid-range dominant)
   - Acoustic (sparse, dynamic range extremes)

4. **Challenge Cases:**
   - Swing/triplet timing (non-binary beat)
   - Tempo changes (acceleration/deceleration)
   - Rubato (expressive, no strict beat)
   - Silence + sudden onsets (threshold tuning)

### 5.2 Beat Phase Accuracy Metrics

**Experiment Setup:**
1. Record metronome click (1kHz, 50ms duration) at 120 BPM
2. Run beat detection, extract detected beat times
3. Compare to ground-truth click times

**Metrics:**
```
Absolute Error (AE) = |detected_beat_time - true_beat_time| [ms]
Tolerance Threshold  = 50ms (acceptable) or 100ms (barely tolerable)

Continuity Error = max inter-beat interval variation
  → Should not exceed ±5% of expected BPM period

Phase Coherence = correlation of detected beats with expected phase
  → Expect >0.95 for well-defined beats
```

**Automated Test (pseudocode):**
```python
def validate_beat_tracking(audio_path, expected_bpm):
    signal = load_audio(audio_path, sr=16000)

    # Extract beat times
    beats = beat_track(signal)

    # Calculate inter-beat intervals
    ibi = np.diff(beats)
    expected_ibi = 60 / expected_bpm

    # Metrics
    mean_error = np.mean(np.abs(ibi - expected_ibi))
    std_error = np.std(ibi - expected_ibi)
    phase_drift = np.cumsum(ibi - expected_ibi)

    assert mean_error < 0.010, f"Mean beat error {mean_error*1000}ms exceeds 10ms"
    assert max(phase_drift) < 0.100, f"Phase drift exceeds 100ms"
```

### 5.3 Onset Detection Evaluation

**Metrics:**
- **Precision:** % of detected onsets that are true onsets
- **Recall:** % of ground-truth onsets that are detected
- **F-measure:** Harmonic mean of precision/recall (target: >0.8)

**Test Protocol:**
1. Annotate 10–20 clips with true onset times (manual or use MIREX dataset)
2. Run onset detector with various thresholds
3. Measure precision/recall/F-measure at each threshold
4. Select threshold that maximizes F-measure for target music genre

**Embedded-Specific Test:**
- Run on device with varying CPU load (render + audio DSP simultaneously)
- Ensure latency remains <20ms even under peak load

### 5.4 Spectral Feature Stability

**Test:** Extract features from 30s of continuous music, plot time-series

**Expected patterns:**
- **Centroid:** Smooth curves, tracks frequency content changes
- **Flux:** Spikes at onsets, baseline near zero during sustained notes
- **Energy bands:** Low autocorrelation (no repetitive patterns from windowing artifacts)

**Red flags:**
- Sudden jumps in centroid (window/FFT artifacts)
- Constant flux baseline with no clear peaks (threshold too high or low)
- Quantization noise visible in plots (use higher bit depth or dithering)

---

## 6. Optimization Checklist for ESP32-S3

### 6.1 Pre-Implementation Verification

- [ ] Espressif esp-dsp library version pinned (`components/esp-dsp@^1.2.0`)
- [ ] IDF version confirmed compatible with RMT v2 + I2S std APIs
- [ ] Compiler flags optimized: `-O3`, `-march=esp32s3`, frame pointer omitted
- [ ] IRAM budget audited: FFT + window + workspace ≤ 20KB

### 6.2 Audio Input Setup

- [ ] I2S configured for stereo, 16-bit, 16kHz (or 32kHz for better freq resolution)
- [ ] DMA double-buffer: 256 samples × 2 channels × 2 bytes = 2KB each
- [ ] I2S ISR minimal: copy DMA buffer to circular queue, signal worker task
- [ ] No logging in ISR; use atomic counters for diagnostics

### 6.3 FFT + Windowing

- [ ] Window function pre-computed at boot, stored in Flash/PROGMEM
- [ ] FFT called via esp-dsp (optimized kernel)
- [ ] Workspace reused between frames (no malloc in loop)
- [ ] Real FFT variant (`rfft`) used if input is real (saves 50% computation)

### 6.4 Feature Extraction

- [ ] Spectral flux computed single-pass (no re-loading FFT output)
- [ ] Frequency bands pre-mapped to bin indices at boot
- [ ] RMS per band calculated during bin accumulation
- [ ] Centroid, rolloff computed post-FFT, not repeated

### 6.5 Smoothing & EMA

- [ ] EMA coefficients pre-computed (avoid division per frame)
- [ ] Separate fast/slow smoothing paths for different features
- [ ] No exponential function calls per frame; use fixed-point or precomputed LUTs

### 6.6 Onset Detection

- [ ] Spectral flux history stored in fixed-size circular buffer (2 frames)
- [ ] Adaptive threshold updated asynchronously (every 1–2s, not per frame)
- [ ] Peak picking refractory period enforced in firmware (100–200ms)
- [ ] Tempo estimation runs at slower cadence (e.g., every 10 beats)

### 6.7 LED Output Integration

- [ ] RMT (or SPI) LED command generation on separate core/task
- [ ] LED color updates synchronized with spectral feature updates
- [ ] No blocking I/O in audio path (queue commands, render async)

### 6.8 Diagnostics & Telemetry

- [ ] Heartbeat endpoint exposes: FPS, avg FFT cycles, RMT refill gaps, feature values
- [ ] DEBUG macros gate all per-frame logging (disabled in production)
- [ ] Per-subsystem timing probes: I2S ISR, FFT, feature extraction, LED render
- [ ] Oscilloscope-friendly output: GPIO toggles on beat detect, feature threshold crossing

### 6.9 Testing & Validation

- [ ] Metronome test: beat detection accuracy ±50ms on synthetic 120 BPM click
- [ ] Genre test: validated on kick drum, hi-hat, snare, vocal material
- [ ] Load test: features extracted while rendering full-strip animation (300+ LEDs)
- [ ] Regression test: baseline performance metrics stored, CI checks for >5% deviation

---

## 7. Resource Optimization Summary Table

| Concern | Solution | Memory Impact | CPU Impact | Trade-off |
|---------|----------|----------------|-----------|-----------|
| **FFT latency** | Use FFT-512 + 50% overlap | +4KB DRAM | ~10ms per frame | Freq res = 31.25Hz (acceptable) |
| **IRAM pressure** | Move FFT to IRAM, twiddles to Flash | +20KB IRAM | -2ms FFT | Larger flash; cache-friendly |
| **Feature extraction** | Single-pass, skip unused bins | Minimal | ~3ms | Manual bin mapping needed |
| **Onset latency** | Spectral flux + fast peak-pick | <1KB | ~2ms | Tuning per music genre |
| **Smoothing jitter** | Dual-rate EMA (fast + slow) | <1KB state | <0.5ms | Complexity; handles dynamics |
| **Beat phase sync** | Lookahead + phase prediction | <1KB | ~0.5ms | Requires tempo model |
| **HPSS separation** | Disable for LED-only | Save 20KB | Save 20% CPU | Trade accuracy for speed |
| **Memory circling** | Avoid modulo; use bitwise AND | — | +5% performance | Requires power-of-two sizes |

---

## 8. Recommended Implementation Stack

### 8.1 Core Architecture

```
┌─ Core 0: I2S Input + Quantization ────────┐
│ I2S ISR → circular buffer (DMA-safe)      │
│ Wake Core 1 every 256 samples (5.3ms)     │
└───────────────────────────────────────────┘
         ↓ (queue via ring buffer)
┌─ Core 1: DSP + Feature Extraction ────────┐
│ Window + FFT-512 (esp-dsp)                │
│ Spectral flux, energy bands, centroid     │
│ EMA smoothing (parallel to LED render)    │
└───────────────────────────────────────────┘
         ↓ (queue features)
┌─ LED Render (Core 0 or async task) ───────┐
│ Map features → color                       │
│ RMT/SPI output (non-blocking)             │
└───────────────────────────────────────────┘
         ↓
┌─ REST API + Telemetry ────────────────────┐
│ /api/audio/features (current spectrum)    │
│ /api/audio/tempo (BPM estimate)           │
│ /api/device/performance (timing stats)    │
└───────────────────────────────────────────┘
```

### 8.2 Feature Set (Phase 0)

**Minimum Viable:**
- [ ] 3 frequency bands (kick, mid, high) via RMS
- [ ] Spectral flux for beat detection
- [ ] Adaptive threshold + tempo tracking (movavg)
- [ ] EMA smoothing (alpha=0.1 fast, 0.02 slow)
- [ ] Beat lookahead to LED phase offset

**Extended (Phase 1):**
- [ ] Full FFT spectrum for visualization
- [ ] Spectral centroid + rolloff as pattern parameters
- [ ] Harmonic-percussive hints (via zero-crossing rate + flux ratio)
- [ ] Multi-genre threshold presets
- [ ] Automatic gain control (normalize input by 30s moving RMS)

---

## 9. References & Resources

### 9.1 Authoritative Docs
- **Espressif ESP-DSP:** https://docs.espressif.com/projects/esp-dsp/en/latest/esp32/
- **ESP-IDF I2S:** https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/peripherals/i2s.html
- **Essentia (reference):** https://essentia.upf.edu/

### 9.2 Research Papers
- Ellis, D.P.W. (2007). "Beat Tracking by Dynamic Programming" (Columbia DSP Lab)
- Fitzgerald, D. (2010). "Harmonic/Percussive Sound Separation Using Median Filtering"
- Böck, S. et al. (2016). "OBTAIN: Real-Time Beat Tracking in Audio Signals" (ISMIR)

### 9.3 GitHub References
- **Audio-Reactive LED Strip (Python/ESP8266):** github.com/scottlawsonbc/audio-reactive-led-strip
- **Beat Detection (C, embedded):** github.com/michaelkrzyzaniak/Beat-and-Tempo-Tracking
- **Real-Time HPSS:** github.com/sevagh/Real-Time-HPSS

### 9.4 Audio Test Datasets
- **MIREX Beat Annotation:** www.music-ir.org/mirex/abstracts/2024/
- **Freesound.org:** Creative Commons loops, 16kHz/44.1kHz available
- **Zenodo Audio Collections:** Large open-source music datasets

---

## 10. Decision Constraints & Open Questions

### Known Constraints
1. **240MHz dual-core clock:** Sufficient for real-time FFT + features, but tight if rendering full animations simultaneously
2. **128KB IRAM cap:** Requires careful code/data placement; twiddle factors must stay in Flash
3. **16kHz sample rate (assumed):** Implies 8kHz max measurable frequency; acceptable for bass-focused visualizations but limits hi-hat/cymbal detail
4. **50ms latency budget:** Achievable but leaves little headroom for OS jitter or app-layer delays

### Open Questions for Phase 0 Validation
1. **Actual tempo tracking accuracy on diverse music:** Recommend test on MIREX dataset; expect 5–10% BPM error initially
2. **Threshold tuning generalization:** Can single adaptive threshold work across genres, or need per-preset tuning?
3. **HPSS necessity:** Is harmonic-percussive separation needed for LED patterns, or is energy-band approach sufficient?
4. **Multi-rate processing:** Should we resample to 8kHz for onset detection (cheaper) or stick with 16kHz full bandwidth?

### Recommended Next Steps
- [ ] Port Goertzel detector for 4 target frequencies (kick, bass, mid, high attack)
- [ ] Benchmark FFT-512 + feature extraction on real ESP32-S3 hardware
- [ ] Validate beat tracking on 10 representative clips (diverse genres)
- [ ] Measure actual E2E latency with mock LED strip rendering
- [ ] Create preset templates for different music genres (EDM, acoustic, spoken word)

---

## 11. Appendix: Code Snippets & Pseudo-Implementation

### 11.1 Spectral Flux Onset Detection

```c
// Pseudo-code for spectral flux onset detection
typedef struct {
    float prev_mag[FFT_BINS];  // Previous frame magnitudes
    float odf_history[ODF_HISTORY_LEN];  // Onset function history
    int odf_idx;
    float threshold_mean, threshold_std;
    uint32_t last_peak_time_ms;  // Refractory period
} OnsetDetector;

float compute_spectral_flux(const float *mag, OnsetDetector *od) {
    float flux = 0.0f;
    for (int i = 0; i < FFT_BINS; ++i) {
        float delta = mag[i] - od->prev_mag[i];
        flux += fmaxf(0.0f, delta);  // Only positive changes
        od->prev_mag[i] = mag[i];
    }
    return flux;
}

bool detect_onset(float flux, OnsetDetector *od, uint32_t now_ms) {
    // Update running statistics
    od->odf_history[od->odf_idx] = flux;
    od->odf_idx = (od->odf_idx + 1) % ODF_HISTORY_LEN;

    // Compute adaptive threshold from recent history
    float mean = 0, std = 0;
    for (int i = 0; i < ODF_HISTORY_LEN; ++i) {
        mean += od->odf_history[i];
    }
    mean /= ODF_HISTORY_LEN;
    for (int i = 0; i < ODF_HISTORY_LEN; ++i) {
        float d = od->odf_history[i] - mean;
        std += d * d;
    }
    std = sqrtf(std / ODF_HISTORY_LEN);

    float threshold = mean + 0.75f * std;  // Tunable: 0.5–1.5

    // Peak picking with refractory period
    if (flux > threshold && (now_ms - od->last_peak_time_ms) > 100) {
        od->last_peak_time_ms = now_ms;
        return true;
    }
    return false;
}
```

### 11.2 EMA Smoothing for Feature Stability

```c
typedef struct {
    float value_fast;  // Quick response (alpha=0.1)
    float value_slow;  // Smooth trend (alpha=0.02)
    float alpha_fast, alpha_1m_alpha_fast;  // Precomputed
    float alpha_slow, alpha_1m_alpha_slow;
} FeatureSmoother;

void init_smoother(FeatureSmoother *sm, float alpha_fast, float alpha_slow) {
    sm->value_fast = sm->value_slow = 0.0f;
    sm->alpha_fast = alpha_fast;
    sm->alpha_1m_alpha_fast = 1.0f - alpha_fast;
    sm->alpha_slow = alpha_slow;
    sm->alpha_1m_alpha_slow = 1.0f - alpha_slow;
}

void update_smoother(FeatureSmoother *sm, float raw_value) {
    sm->value_fast = sm->alpha_fast * raw_value +
                     sm->alpha_1m_alpha_fast * sm->value_fast;
    sm->value_slow = sm->alpha_slow * raw_value +
                     sm->alpha_1m_alpha_slow * sm->value_slow;
}

// Use for LED intensity:
// led_intensity = (sm->value_fast / sm->value_slow) * base_brightness
// This normalizes fast changes by slow trend, preventing saturation
```

### 11.3 Window Function Pre-Computation

```c
// At boot
void init_window_hann_512(float *window) {
    for (int n = 0; n < 512; ++n) {
        float pi_n = M_PI * n / 512.0f;
        window[n] = 0.5f * (1.0f - cosf(2.0f * pi_n));
    }
}

// In FFT processing
void apply_window(float *signal, const float *window, int len) {
    for (int i = 0; i < len; ++i) {
        signal[i] *= window[i];  // Single-pass; cache-friendly
    }
}
```

---

**Document Status:** Accepted for Phase 0 implementation.
**Next Review:** After initial hardware validation (2–3 week timeline).
**Owner:** Research Analyst | Embedded Firmware Engineer
**Related PRs/ADRs:** [To be created during Phase 0 execution]

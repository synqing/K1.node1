# Audio Feature Extraction: Phase 0 Validation & Test Suite

**Date:** 2025-11-07
**Status:** `proposed`
**Owner:** Test & Validation
**Scope:** Beat detection accuracy, onset detection, spectral feature stability, end-to-end latency
**Related:** [Audio Feature Analysis](../05-analysis/audio_feature_extraction_esp32s3_analysis.md)
**Tags:** `testing`, `validation`, `audio-dsp`, `beat-tracking`, `phase-0`

---

## 1. Test Suite Overview

This document defines automated and manual tests for validating real-time audio feature extraction on ESP32-S3.

### 1.1 Test Categories

| Category | Purpose | Automated | Manual | Duration |
|----------|---------|-----------|--------|----------|
| **Unit** | FFT, feature functions | ✓ | — | <1min |
| **Integration** | DSP pipeline end-to-end | ✓ | — | <5min |
| **Validation** | Accuracy on ground-truth audio | ✓ | ✓ | 10–30min |
| **Benchmark** | Performance on device | ✓ | — | 5–10min |
| **Regression** | Ensure no perf degradation | ✓ | — | <2min (CI) |
| **Psychoacoustic** | Subjective LED sync perception | — | ✓ | 30–60min |

---

## 2. Unit Tests (Host/Firmware)

### 2.1 FFT Correctness Test

**Goal:** Verify FFT implementation against known good output.

**Test Case: FFT-512 Real Input**

```python
# Host-side Python test
import numpy as np
from scipy.fft import rfft

def test_esp32_fft_512():
    """Test FFT-512 against scipy reference."""
    # Generate test signal: 1kHz sine @ 16kHz Fs
    sr = 16000
    freq = 1000
    duration = 512 / sr  # One FFT frame
    t = np.arange(512) / sr
    x = np.sin(2 * np.pi * freq * t).astype(np.float32)

    # Expected output (scipy)
    expected = rfft(x)
    expected_mag = np.abs(expected)

    # Call firmware FFT via mock or device
    actual_mag = call_firmware_fft(x)

    # Verify magnitude spectrum
    error = np.max(np.abs(expected_mag - actual_mag) / (np.max(expected_mag) + 1e-9))
    assert error < 0.01, f"FFT error {error:.4f} exceeds 1% threshold"
```

**Acceptance Criteria:**
- [ ] Magnitude error < 1% vs scipy `rfft()`
- [ ] Peak bin matches within ±1 bin
- [ ] DC component (bin 0) < -80dB (floating-point noise)

---

### 2.2 Window Function Test

**Goal:** Verify Hann window is correctly applied.

```python
def test_hann_window():
    """Test Hann window application."""
    from scipy.signal import windows

    # Generate Hann window
    N = 512
    scipy_window = windows.hann(N)

    # Get firmware window
    fw_window = call_firmware_get_window(N)

    # Compare
    error = np.max(np.abs(scipy_window - fw_window))
    assert error < 1e-5, f"Window error {error} exceeds tolerance"
```

**Acceptance Criteria:**
- [ ] Match scipy Hann to <1e-5 per sample
- [ ] Sum of window ≈ 0.5 (for 50% overlap)

---

### 2.3 Feature Computation Tests

**Spectral Flux:**

```python
def test_spectral_flux():
    """Test spectral flux against manual computation."""
    # Frame 1: magnitude spectrum
    mag1 = np.array([1.0, 2.0, 3.0, 1.5, 0.5], dtype=np.float32)

    # Frame 2: increased in bins 1, 2
    mag2 = np.array([1.0, 3.0, 4.0, 1.5, 0.5], dtype=np.float32)

    # Expected flux: max(0, mag2 - mag1) summed
    expected_flux = 0 + 1.0 + 1.0 + 0 + 0  # = 2.0

    actual_flux = call_firmware_spectral_flux(mag1, mag2)
    assert abs(actual_flux - expected_flux) < 1e-5
```

**Centroid:**

```python
def test_spectral_centroid():
    """Test centroid = sum(f_i * mag_i) / sum(mag_i)."""
    # Uniform spectrum (centroid = middle freq)
    mag = np.ones(512, dtype=np.float32)
    expected_centroid = 256 * 31.25  # Middle bin * Hz-per-bin @ 16kHz, 512 FFT

    actual_centroid = call_firmware_spectral_centroid(mag, sr=16000, fft_size=512)
    assert abs(actual_centroid - expected_centroid) < 1.0  # ±1Hz tolerance
```

**Acceptance Criteria:**
- [ ] All feature computations match expected values to <0.1% error
- [ ] No NaN/Inf outputs on edge cases (zero spectrum, etc.)

---

## 3. Integration Tests (Full Pipeline)

### 3.1 Real-Time Audio Processing Loop

**Goal:** Verify DSP pipeline runs on device without dropouts or crashes.

**Test Setup:**
- Feed 16kHz, 16-bit PCM test audio via I2S
- Measure FFT computation time, feature extraction time, output update rate
- Check for buffer overflows, DMA errors

**Pseudocode (Firmware):**

```c
// In main app
uint32_t test_frame_count = 0;
uint32_t missed_frames = 0;
uint32_t total_fft_cycles = 0;

void on_dsp_frame_ready(void) {
    uint32_t t_start = esp_timer_get_time();

    // Run full pipeline
    window_and_fft(audio_buffer, fft_output);
    compute_spectral_flux(fft_output, &flux);
    compute_energy_bands(fft_output, energy);
    ema_smooth(energy, &smoothed_energy);

    uint32_t t_end = esp_timer_get_time();
    uint32_t elapsed_us = t_end - t_start;

    if (elapsed_us > 5000) {  // Exceeds 5ms budget
        missed_frames++;
    }

    total_fft_cycles += elapsed_us;
    test_frame_count++;

    if (test_frame_count % 100 == 0) {
        float avg_ms = total_fft_cycles / (test_frame_count * 1000.0f);
        printf("Avg DSP time: %.2f ms/frame\n", avg_ms);
    }
}
```

**Acceptance Criteria:**
- [ ] No missed frames (elapsed_us < 5.3ms for 256-sample FFT-512 @ 16kHz)
- [ ] Avg DSP time < 3ms
- [ ] Zero I2S DMA buffer overruns (log via I2S ISR)
- [ ] No assert/exception crashes over 60s test duration

---

### 3.2 Feature Stability Over Time

**Goal:** Verify features remain stable and realistic over 1-minute audio stream.

**Test:** Process 60s of music, plot all features.

```python
def test_feature_stability():
    """Run DSP pipeline, record features, check for artifacts."""
    # Use first 60s of diverse test track
    signal, sr = librosa.load('test_music.wav', sr=16000, duration=60)

    # Simulate pipeline
    features = {
        'flux': [],
        'centroid': [],
        'energy_kick': [],
        'energy_mid': [],
        'energy_high': []
    }

    for i in range(0, len(signal) - 512, 256):
        frame = signal[i:i+512]

        # Window + FFT
        windowed = frame * window_hann(512)
        spectrum = np.abs(np.fft.rfft(windowed))

        # Accumulate features
        if i > 512:  # Skip first frame
            flux = np.sum(np.maximum(0, spectrum - prev_spectrum))
            centroid = np.sum(np.arange(len(spectrum)) * spectrum) / np.sum(spectrum)

            features['flux'].append(flux)
            features['centroid'].append(centroid)

        prev_spectrum = spectrum

    # Check for anomalies
    for name, vals in features.items():
        vals = np.array(vals)
        mean = np.mean(vals)
        std = np.std(vals)

        # Check for outliers (>5 std deviations)
        outliers = np.sum(np.abs(vals - mean) > 5 * std)
        assert outliers == 0, f"{name} has {outliers} outliers (possible artifacts)"

        # Check for NaN/Inf
        assert np.all(np.isfinite(vals)), f"{name} contains NaN or Inf"

        print(f"{name}: mean={mean:.3f}, std={std:.3f}, range=[{min(vals):.3f}, {max(vals):.3f}]")
```

**Acceptance Criteria:**
- [ ] No NaN or Inf values in any feature
- [ ] <5 outliers (>5σ deviation) in 60s of music
- [ ] Centroid stays within 100–6000 Hz (reasonable for typical music)
- [ ] Flux has clear peaks at onsets, near-zero during sustained notes

---

## 4. Validation Tests (Ground-Truth Audio)

### 4.1 Beat Detection Accuracy (Metronome Test)

**Goal:** Measure beat detection accuracy on synthetic metronome.

**Test Audio Generation:**

```python
def generate_metronome_test(bpm=120, duration_s=30):
    """Generate click metronome with ground-truth beat times."""
    sr = 16000
    samples = int(duration_s * sr)
    signal = np.zeros(samples, dtype=np.int16)

    # Metronome parameters
    beat_period_samples = int(sr * 60 / bpm)  # Samples per beat
    click_freq = 1000  # Hz
    click_duration_samples = int(0.050 * sr)  # 50ms click

    # Generate clicks at beat times
    beat_times = []
    for beat_idx in range(int(duration_s * bpm / 60)):
        beat_sample = beat_idx * beat_period_samples
        if beat_sample + click_duration_samples > samples:
            break

        # Generate sine tone for this beat
        t = np.arange(click_duration_samples) / sr
        click = (32767 * np.sin(2 * np.pi * click_freq * t)).astype(np.int16)
        signal[beat_sample:beat_sample+click_duration_samples] = click

        beat_times.append(beat_sample / sr)  # Ground truth in seconds

    return signal, beat_times
```

**Test Execution:**

```python
def test_beat_detection_metronome():
    """Test beat tracking on synthetic 120 BPM metronome."""
    # Generate test audio
    signal, ground_truth_times = generate_metronome_test(bpm=120, duration_s=30)

    # Run beat detection
    detected_beats = call_beat_detector(signal, sr=16000)

    # Compute accuracy metrics
    metrics = compute_beat_accuracy(ground_truth_times, detected_beats)

    # Assertions
    assert metrics['mean_error_ms'] < 50, f"Mean error {metrics['mean_error_ms']:.1f}ms exceeds 50ms"
    assert metrics['f_measure'] > 0.85, f"F-measure {metrics['f_measure']:.3f} < 0.85"
    assert metrics['mean_ibi_error_pct'] < 5.0, f"IBI error {metrics['mean_ibi_error_pct']:.1f}% > 5%"

    print(f"Beat Detection Results (120 BPM):")
    print(f"  Mean Error: {metrics['mean_error_ms']:.1f} ms")
    print(f"  Std Error: {metrics['std_error_ms']:.1f} ms")
    print(f"  F-Measure: {metrics['f_measure']:.3f}")
    print(f"  Phase Drift: {metrics['max_phase_drift_ms']:.1f} ms")
```

**Accuracy Metrics:**

```python
def compute_beat_accuracy(ground_truth, detected, tolerance_ms=50):
    """Compute precision, recall, F-measure for beat detection."""
    tolerance = tolerance_ms / 1000.0  # Convert to seconds

    # Match detected beats to ground truth
    gt_matched = [False] * len(ground_truth)
    det_matched = [False] * len(detected)

    for i, det_time in enumerate(detected):
        for j, gt_time in enumerate(ground_truth):
            if abs(det_time - gt_time) < tolerance and not gt_matched[j]:
                gt_matched[j] = True
                det_matched[i] = True
                break

    # Metrics
    tp = sum(gt_matched)
    fn = len(ground_truth) - tp
    fp = len(detected) - tp

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f_measure = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

    # Inter-beat interval (IBI) analysis
    gt_ibi = np.diff(ground_truth)
    det_ibi = np.diff(detected)

    # Align IBIs
    mean_gt_ibi = np.mean(gt_ibi)
    mean_det_ibi = np.mean(det_ibi)
    ibi_error_pct = abs(mean_det_ibi - mean_gt_ibi) / mean_gt_ibi * 100

    # Phase drift
    phase_drift = np.cumsum(det_ibi) - np.cumsum(gt_ibi)
    max_phase_drift_ms = max(abs(phase_drift)) * 1000

    # Error stats
    error_ms = np.abs((detected[:min(len(detected), len(ground_truth))] -
                       ground_truth[:min(len(detected), len(ground_truth))]) * 1000)

    return {
        'precision': precision,
        'recall': recall,
        'f_measure': f_measure,
        'mean_error_ms': np.mean(error_ms),
        'std_error_ms': np.std(error_ms),
        'mean_ibi_error_pct': ibi_error_pct,
        'max_phase_drift_ms': max_phase_drift_ms
    }
```

**Test Cases:**

| BPM | Genre Hint | Expected Accuracy |
|-----|-----------|-------------------|
| **80** | Slow ballad | F > 0.90 (steady) |
| **120** | Standard pop | F > 0.90 (baseline) |
| **140** | Fast dance | F > 0.85 (faster = harder) |
| **180** | Drum & Bass | F > 0.80 (very fast) |

**Acceptance Criteria:**
- [ ] Metronome 120 BPM: Mean error < 50ms, F-measure > 0.85
- [ ] No phase drift >100ms over 30s test
- [ ] IBI error <5% for all BPMs

---

### 4.2 Onset Detection Evaluation

**Goal:** Evaluate onset detection accuracy on annotated music.

**Test Audio:** Use publicly available beat-annotated datasets
- MIREX (Music Information Retrieval Evaluation eXchange) beat tracking datasets
- GTzan (genre classification, has beat times)

**Annotation Format:** Tab-separated file
```
time_seconds is_beat
0.000 1
0.500 0
1.000 1
...
```

**Test Code:**

```python
def test_onset_detection():
    """Test onset detection on beat-annotated MIREX tracks."""
    mirex_dir = 'test_data/mirex_beats/'

    for audio_file in os.listdir(mirex_dir):
        if not audio_file.endswith('.wav'):
            continue

        # Load audio and annotations
        signal, sr = librosa.load(f'{mirex_dir}/{audio_file}', sr=16000)
        annotation_file = audio_file.replace('.wav', '.txt')
        annotations = load_beat_annotations(f'{mirex_dir}/{annotation_file}')

        # Run onset detector
        detected_onsets = call_onset_detector(signal, sr=16000)

        # Compute accuracy
        metrics = compute_beat_accuracy(annotations, detected_onsets, tolerance_ms=70)

        # Log results
        print(f"{audio_file}: F={metrics['f_measure']:.3f}, Prec={metrics['precision']:.3f}, Rec={metrics['recall']:.3f}")

        # Soft assertion (report failures, don't fail test)
        if metrics['f_measure'] < 0.75:
            print(f"  WARNING: Low F-measure on {audio_file}")
```

**Acceptance Criteria:**
- [ ] Average F-measure across MIREX test set > 0.75
- [ ] <10% of tracks fall below F-measure 0.70
- [ ] No crashes or timeouts on any track

---

### 4.3 Spectral Feature Validation

**Goal:** Verify spectral features match expected properties of music.

**Test Cases:**

| Feature | Test Signal | Expected Behavior | Tolerance |
|---------|------------|-------------------|-----------|
| **Centroid** | Pink noise | ~2500Hz | ±500Hz |
| **Centroid** | Bass synth (100Hz) | ~150Hz | ±100Hz |
| **Centroid** | Bright cymbal | >4000Hz | >3000Hz |
| **Flux** | Silence | ~0 | <0.1 |
| **Flux** | Note onset | Peak >0.5 * max | See data |
| **Rolloff** | Bass-heavy music | <5000Hz | <10000Hz |
| **Rolloff** | High-heavy music | >5000Hz | >3000Hz |

**Test Execution:**

```python
def test_spectral_features():
    """Validate spectral features on synthetic test signals."""
    sr = 16000
    tests = [
        ('silence', np.zeros(sr), {'centroid': (0, 100), 'flux': (0, 0.1)}),
        ('1khz_sine', np.sin(2*np.pi*1000*np.arange(sr)/sr), {'centroid': (800, 1200)}),
        ('pink_noise', generate_pink_noise(sr), {'centroid': (2000, 3500)}),
    ]

    for test_name, signal, expected in tests:
        # Compute spectral features
        features = compute_features(signal, sr=16000)

        # Validate
        for feature_name, (lower, upper) in expected.items():
            actual = features[feature_name]
            assert lower <= actual <= upper, \
                f"{test_name}: {feature_name}={actual} outside [{lower}, {upper}]"
            print(f"✓ {test_name}: {feature_name}={actual:.1f}")
```

**Acceptance Criteria:**
- [ ] All synthetic test cases pass (feature within expected range)
- [ ] Real music features remain stable (no outliers over 1-min clip)

---

## 5. Benchmark Tests (Hardware)

### 5.1 Real-Time Performance Measurement

**Goal:** Measure actual DSP performance on ESP32-S3 device.

**Firmware Instrumentation:**

```c
// In DSP loop
#define BENCHMARK 1  // Set to 0 for production

#ifdef BENCHMARK
static struct {
    uint32_t frame_count;
    uint32_t total_fft_cycles;
    uint32_t max_fft_cycles;
    uint32_t total_feature_cycles;
    uint32_t max_feature_cycles;
    uint32_t i2s_underruns;
} bench = {0};
#endif

void dsp_frame_process(void) {
#ifdef BENCHMARK
    uint32_t t0 = esp_timer_get_time();
#endif

    // FFT
    window_and_fft(input_frame, fft_output);

#ifdef BENCHMARK
    uint32_t t1 = esp_timer_get_time();
    uint32_t fft_us = t1 - t0;
    bench.total_fft_cycles += fft_us;
    if (fft_us > bench.max_fft_cycles) bench.max_fft_cycles = fft_us;
#endif

    // Features
    compute_features(fft_output, &features);

#ifdef BENCHMARK
    uint32_t t2 = esp_timer_get_time();
    uint32_t feature_us = t2 - t1;
    bench.total_feature_cycles += feature_us;
    if (feature_us > bench.max_feature_cycles) bench.max_feature_cycles = feature_us;
    bench.frame_count++;
#endif
}

// Expose via REST endpoint
void benchmark_report(void) {
    printf("Benchmark Report (frames=%u):\n", bench.frame_count);
    printf("  FFT: avg=%.2f ms, max=%.2f ms\n",
           (float)bench.total_fft_cycles / bench.frame_count / 1000,
           (float)bench.max_fft_cycles / 1000);
    printf("  Features: avg=%.2f ms, max=%.2f ms\n",
           (float)bench.total_feature_cycles / bench.frame_count / 1000,
           (float)bench.max_feature_cycles / 1000);
    printf("  I2S underruns: %u\n", bench.i2s_underruns);
}
```

**Test Protocol:**
1. Boot device with 60s of test audio playing via I2S
2. Record timing stats
3. Report via `/api/device/benchmark` endpoint
4. Verify all metrics meet targets

**Expected Performance (ESP32-S3 @ 240MHz):**
| Operation | Target | Acceptable | Fail |
|-----------|--------|-----------|------|
| FFT-512 | <10ms | <12ms | >15ms |
| Feature extraction | <3ms | <4ms | >5ms |
| Total per frame | <13ms | <16ms | >20ms |
| I2S underruns (60s) | 0 | 0 | >0 |

**Test Assertion (Firmware):**

```c
void test_performance_targets(void) {
    assert(bench.max_fft_cycles < 15000, "FFT exceeds 15ms max");
    assert(bench.max_feature_cycles < 5000, "Features exceed 5ms max");
    assert(bench.i2s_underruns == 0, "I2S underruns detected");
    printf("✓ All performance targets met\n");
}
```

---

### 5.2 End-to-End Latency Measurement

**Goal:** Measure total latency from audio input to LED output.

**Method:** Audio -> Feature extraction -> LED color change

**Hardware Setup:**
- Audio input (tone burst)
- Oscilloscope/logic analyzer on LED output
- Measure time between onset tone and LED color change

**Pseudocode:**

```c
// Firmware: Toggle GPIO on beat detect
void on_beat_detected(void) {
    gpio_set_level(LATENCY_GPIO, 1);  // Rising edge
    update_led_color();
    gpio_set_level(LATENCY_GPIO, 0);  // Falling edge
}
```

**Host Test:**
1. Play test tone (1kHz sine, 100ms duration) via I2S line input
2. Capture falling edge time on LATENCY_GPIO
3. Calculate: latency = LED_edge_time - tone_end_time
4. Repeat 10 times, report mean ± std

**Acceptance Criteria:**
- [ ] Mean latency < 50ms
- [ ] Max latency < 100ms (2x mean acceptable for occasional peaks)
- [ ] Std dev < 10ms (consistent timing)

---

## 6. Regression Tests (CI/CD)

### 6.1 Performance Regression Check

**Goal:** Prevent accidental performance degradation in builds.

**CI Script (GitHub Actions / local):**

```yaml
name: Audio DSP Performance Regression

on: [push, pull_request]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build firmware
        run: |
          cd firmware
          idf.py build

      - name: Flash and run benchmark (device/emulator)
        run: |
          # Simulate or run on actual device
          python3 scripts/run_benchmark.py

      - name: Compare against baseline
        run: |
          python3 scripts/compare_benchmarks.py \
            current_results.json \
            baseline_results.json \
            --tolerance 5  # Allow 5% degradation

      - name: Comment on PR if regression detected
        if: failure()
        run: |
          echo "Performance regression detected. See benchmark report."
```

**Baseline Storage:**
```json
{
  "date": "2025-11-07",
  "esp32s3_240mhz": {
    "fft_512_avg_ms": 10.4,
    "features_avg_ms": 2.1,
    "total_avg_ms": 12.5,
    "i2s_underruns": 0
  }
}
```

---

### 6.2 Feature Stability Regression

**Goal:** Detect if feature outputs become biased or unstable.

```python
def test_feature_stability_regression():
    """Compare feature distributions against baseline."""
    import pickle

    # Load baseline (from previous run)
    with open('baseline_feature_stats.pkl', 'rb') as f:
        baseline = pickle.load(f)

    # Run DSP on test audio
    signal, sr = librosa.load('test_track.wav', sr=16000, duration=60)
    features = run_dsp_pipeline(signal, sr)

    # Compare distributions
    for feature_name in ['centroid', 'flux', 'energy']:
        baseline_mean = baseline[feature_name]['mean']
        baseline_std = baseline[feature_name]['std']

        current_mean = np.mean(features[feature_name])
        current_std = np.std(features[feature_name])

        # KL divergence or simple mean shift check
        mean_shift = abs(current_mean - baseline_mean) / (baseline_std + 1e-9)

        assert mean_shift < 0.5, \
            f"{feature_name} mean shifted by {mean_shift:.2f} std (regression)"
```

---

## 7. Manual / Psychoacoustic Tests

### 7.1 LED Sync Perception Test

**Goal:** Evaluate subjective quality of LED synchronization to music.

**Test Setup:**
1. Connect ESP32-S3 to WS2812B LED strip (10–100 LEDs)
2. Play 5 test tracks (diverse genres)
3. Evaluate LED response subjectively
4. Document latency feel, false triggers, missed beats

**Evaluation Criteria (per-track):**

| Aspect | Rating | Notes |
|--------|--------|-------|
| **Beat Sync** | 1–5 | 5=tight, 1=loose or off |
| **False Triggers** | 1–5 | 5=none, 1=many spurious |
| **Missed Beats** | 1–5 | 5=none, 1=many missed |
| **Feature Smoothing** | 1–5 | 5=smooth/natural, 1=jittery |
| **Overall Vibe** | 1–5 | Subjective feel |

**Test Tracks:**
1. 120 BPM electronic (steady beat)
2. Acoustic guitar (sparse onsets)
3. Drum kit (fast hits)
4. Vocal track (complex rhythm)
5. Ambient (minimal rhythm)

**Pass Criteria:**
- Average rating >3.5 across all aspects
- No track rated <3 on any aspect
- Documented observations for failure modes

---

### 7.2 Genre Preset Tuning

**Goal:** Develop and validate preset thresholds for different music genres.

**Thresholds to Tune:**
- Spectral flux adaptive threshold multiplier (0.5–1.5)
- Peak-picking refractory period (50–200ms)
- EMA smoothing alpha (0.02–0.3)
- Frequency band bin ranges (for kick/mid/high)

**Process:**
1. Select 5 representative tracks per genre
2. Manually tune parameters for best beat detection
3. Document final preset values
4. Validate on held-out test tracks

**Genres to Cover:**
- [ ] EDM/House
- [ ] Hip-hop/Rap
- [ ] Pop/Rock
- [ ] Acoustic/Folk
- [ ] Ambient/Experimental

---

## 8. Checklist: Full Validation Suite

### Pre-Validation
- [ ] Unit tests compile and pass (host)
- [ ] Integration tests pass (firmware simulator)
- [ ] Metronome test audio generated

### Device Validation
- [ ] Firmware builds without warnings
- [ ] Device boots, I2S starts, audio flows
- [ ] Beat detection finds >90% of synthetic beats (120 BPM)
- [ ] FFT and features update every 5.3ms (observed via telemetry)
- [ ] No I2S underruns over 60s test duration

### Accuracy Validation
- [ ] Metronome 120 BPM: mean error <50ms, F-measure >0.85
- [ ] Onset detection on MIREX: average F-measure >0.75
- [ ] Spectral features stable (no NaN/Inf, realistic ranges)
- [ ] Beat phase drift <100ms over 5-minute track

### Performance Validation
- [ ] FFT cycles: avg <10ms, max <15ms
- [ ] Feature cycles: avg <3ms, max <5ms
- [ ] End-to-end latency: mean <50ms, max <100ms
- [ ] All CI benchmarks pass vs baseline (5% tolerance)

### Subjective Validation
- [ ] LED sync feels tight on electronic music (rating ≥4)
- [ ] No obvious false triggers on acoustic material
- [ ] Genre presets documented for at least 3 genres

---

## 9. Test Data References

**Audio Sources:**
- **MIREX Beat Annotations:** www.music-ir.org/mirex/
- **Freesound.org Loops:** Diverse CCO loops, 16kHz available
- **Zenodo Audio:** Large collections, cite correctly
- **Synthetic:** Use scipy/numpy to generate test tones

**Required Test Files:**
```
test_audio/
  synthetic/
    metronome_120bpm_30s.wav
    sine_1khz_5s.wav
    pink_noise_5s.wav
  mirex_beats/
    [genre]_[track_id].wav
    [genre]_[track_id].txt (beat annotations)
```

---

**Status:** Proposed for Phase 0 validation
**Owner:** Test & Validation
**Next:** Implement test suite, run against prototype firmware

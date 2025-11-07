# Audio Feature Extraction Algorithms: Reference Manual
## Comprehensive Guide to Real-Time Music Analysis for LED Visualization

**Date:** 2025-11-07
**Status:** Reference
**Owner:** Research Analyst
**Scope:** Algorithmic specifications for extracting audio features on ESP32-S3
**Related:** Advanced Audio Visualization Techniques, LED Visualization Patterns Guide
**Tags:** audio-analysis, DSP, real-time, algorithms, feature-extraction

---

## 1. Time-Frequency Analysis Foundation

### 1.1 Short-Time Fourier Transform (STFT)

**Purpose**: Decompose audio into frequency components over sliding time windows.

**Parameters**:
```
Window size (N):           1024 samples @ 16 kHz audio = 64 ms
Hop size (H):              512 samples @ 16 kHz = 32 ms
                           (50% overlap for smooth transitions)
Window function:           Hann or Hamming
                           Reduces spectral leakage at bin boundaries
Output:                    Complex STFT matrix: [freq_bins × time_frames]
```

**Algorithm** (Pseudocode):
```
for each time_frame:
    1. Extract N samples from circular audio buffer
    2. Apply Hann window: windowed[n] = sample[n] * hann(n)
    3. Compute FFT: X[k] = sum(windowed[n] * exp(-j*2*pi*k*n/N)) for n=0..N-1
    4. Compute magnitude: |X[k]| = sqrt(real(X[k])² + imag(X[k])²)
    5. Compute phase: angle(X[k]) = atan2(imag(X[k]), real(X[k]))
    6. Store magnitude and phase for next processing steps
```

**Output Interpretation**:
- **Bin k** represents frequency: f_k = k × (sample_rate / N)
- For 16 kHz audio and 1024-sample window: each bin = 15.6 Hz spacing
- Bins 0–512 cover 0–8 kHz (human hearing is ~20 Hz–20 kHz, but music focus is lower)

**Computational Cost**: O(N log N) per frame (~1.5 ms for 1024-point FFT on ESP32-S3).

---

### 1.2 Mel-Frequency Spectrogram

**Purpose**: Map STFT bins to perceptually-relevant frequency scale; compress data.

**Why**: Human ears perceive frequency logarithmically. A 100 Hz–200 Hz difference is perceptually larger than a 10 kHz–10.1 kHz difference.

**Algorithm**:
```
1. Create Mel filterbank:
   - Design 40–128 triangular filters (typically 128 for music)
   - Linearly space filters on Mel scale (not Hz)

   Mel(f) = 2595 * log10(1 + f/700)  # Hz → Mel
   f = 700 * (10^(m/2595) - 1)        # Mel → Hz

   for each mel_bin i:
       a) Compute center frequency f_center[i]
       b) Create triangular response: peak at f_center[i],
          zero at neighboring bin centers
       c) Matrix row = [0, 0, ..., 0, rise, 1.0, fall, ..., 0, 0]

2. Apply filterbank to STFT magnitude:
   mel_spectrogram[i, t] = sum(|STFT[k, t]| * mel_filter[i, k])

3. Apply log scaling (optional, improves SNR):
   log_mel[i, t] = 10 * log10(1 + mel_spectrogram[i, t])
```

**Output**: 128×T matrix (128 mel-frequency bins × T time frames).

**For K1 (simplification)**:
- Use 32 mel bins instead of 128 to reduce memory
- Skip log scaling; keep linear magnitude
- Update every 32ms (slower but sufficient for visualization)

---

## 2. Spectral Features

### 2.1 Spectral Centroid

**Definition**: Center of gravity of the magnitude spectrum.

**Formula**:
```
SC = sum(f_k * |X[k]|) / sum(|X[k]|)

where:
  f_k = frequency of bin k
  |X[k]| = magnitude of bin k
```

**Interpretation**:
- Low SC (< 2 kHz): "dark" timbre (bass, cello, trombone)
- Mid SC (2–4 kHz): neutral
- High SC (> 4 kHz): "bright" timbre (trumpet, cymbal, presence peaks)

**Real-time implementation**:
```cpp
float compute_spectral_centroid(const float* magnitude, int num_bins, int sample_rate) {
    float sum_mag = 0, sum_weighted = 0;

    for (int k = 0; k < num_bins; k++) {
        float freq = k * (sample_rate / (float)(2 * num_bins));
        sum_mag += magnitude[k];
        sum_weighted += freq * magnitude[k];
    }

    if (sum_mag < 1e-6) return 0;  // Silence
    return sum_weighted / sum_mag;
}
```

**Computational Cost**: O(N) = ~30 µs for 1024 bins.

**For LED Use**: Map to color temperature (low → warm reds, high → cool blues).

---

### 2.2 Spectral Flux

**Definition**: Euclidean distance between consecutive frames' magnitude spectra.

**Formula**:
```
SF[t] = sqrt(sum((|X[k, t]| - |X[k, t-1]|)²))

Normalized (better for adaptive thresholding):
SF_norm[t] = SF[t] / (avg_SF[t] + ε)
```

**Interpretation**:
- High flux: Sudden change in spectral content (onset, note attack)
- Low flux: Stable spectral content (sustained notes)

**Real-time implementation**:
```cpp
float compute_spectral_flux(const float* current_mag, const float* prev_mag, int num_bins) {
    float sum_sq = 0;

    for (int k = 0; k < num_bins; k++) {
        float diff = current_mag[k] - prev_mag[k];
        sum_sq += diff * diff;
    }

    return sqrtf(sum_sq);
}

// Adaptive normalization (keep running mean)
static float mean_flux = 0;
float normalized_flux = compute_spectral_flux(current, previous, num_bins);
mean_flux = 0.95 * mean_flux + 0.05 * normalized_flux;
float adaptive_flux = normalized_flux / (mean_flux + 0.01);
```

**Computational Cost**: O(N) = ~40 µs per frame.

**For LED Use**: Trigger particle spawning; modulate brightness changes.

---

### 2.3 Spectral Flatness

**Definition**: Ratio of geometric to arithmetic mean of magnitude spectrum.

**Formula**:
```
SF = (product(|X[k]|))^(1/N) / (mean(|X[k]|))

Where:
  Geometric mean = exp(mean(log(|X[k]|)))
  Arithmetic mean = mean(|X[k]|)

Range: [0, 1]
  0 = pure tone (single dominant frequency)
  1 = white noise (all frequencies equally represented)
```

**Interpretation**:
- Low flatness (< 0.2): Tonal, harmonic content (singing, violin, piano)
- High flatness (> 0.5): Noisy, percussive content (hi-hat, crash, breath noise)

**Real-time implementation**:
```cpp
float compute_spectral_flatness(const float* magnitude, int num_bins) {
    float log_sum = 0, linear_sum = 0;
    int nonzero_count = 0;

    for (int k = 0; k < num_bins; k++) {
        if (magnitude[k] > 1e-6) {  // Skip near-zero bins
            log_sum += logf(magnitude[k]);
            linear_sum += magnitude[k];
            nonzero_count++;
        }
    }

    if (nonzero_count == 0) return 0;

    float geometric_mean = expf(log_sum / nonzero_count);
    float arithmetic_mean = linear_sum / nonzero_count;

    if (arithmetic_mean < 1e-6) return 0;
    return geometric_mean / arithmetic_mean;
}
```

**Computational Cost**: O(N) = ~50 µs.

**For LED Use**: Modulate saturation (tonal → saturated colors; noisy → desaturated).

---

## 3. Harmonic-Percussive Source Separation (HPSS)

### 3.1 Median Filtering Method

**Concept**: In a spectrogram, harmonic components form horizontal ridges (sustained notes), while percussive components form vertical spikes (transients).

**Algorithm**:
```
1. Compute STFT magnitude spectrogram: S[f, t] where f=frequency, t=time

2. Harmonic-enhanced spectrogram (median filter over time axis):
   H[f, t] = median(S[f, t-1], S[f, t], S[f, t+1])

   Purpose: Blur vertical spikes; enhance horizontal continuity

3. Percussive-enhanced spectrogram (median filter over frequency axis):
   P[f, t] = median(S[f-1, t], S[f, t], S[f+1, t])

   Purpose: Blur horizontal ridges; enhance vertical spikes

4. Create soft masks (normalized):
   H_mask[f, t] = H[f, t] / (H[f, t] + P[f, t] + ε)
   P_mask[f, t] = P[f, t] / (H[f, t] + P[f, t] + ε)

   (Sum of masks = 1 per time-frequency bin)

5. Apply masks:
   Harmonic output[f, t] = H_mask[f, t] × S[f, t]
   Percussive output[f, t] = P_mask[f, t] × S[f, t]
```

**Memory & Performance**:
- Requires 3 STFT frames in memory (current, ±1 neighbors)
- Median filtering: O(N×3 log 3) ≈ O(N) cost
- Total overhead: ~100 µs per frame for 1024-bin STFT

**For K1**:
```cpp
// Simplified HPSS (2-frame memory, less accurate but faster)
void decompose_hpss(const float* current_spec, const float* prev_spec,
                    float* harmonic, float* percussive, int num_bins) {
    for (int f = 0; f < num_bins; f++) {
        // Simple harmonic boost: blend with previous frame
        harmonic[f] = 0.7 * current_spec[f] + 0.3 * prev_spec[f];

        // Percussive: difference from harmonic trend
        percussive[f] = fmaxf(0, current_spec[f] - harmonic[f]);

        // Normalize
        float total = harmonic[f] + percussive[f];
        if (total > 1e-6) {
            harmonic[f] /= total;
            percussive[f] /= total;
        }
    }

    // Compute energies
    float harmonic_energy = 0, percussive_energy = 0;
    for (int f = 0; f < num_bins; f++) {
        harmonic_energy += harmonic[f];
        percussive_energy += percussive[f];
    }
    // Return normalized energies [0, 1]
}
```

---

## 4. Chroma Features (Pitch Content)

### 4.1 Chroma Extraction from STFT

**Purpose**: Capture pitch/harmony independent of octave and timbre.

**Algorithm**:
```
1. Start with STFT magnitude spectrogram |X[f, t]|

2. Define 12 pitch classes (semitones):
   C, C#/Db, D, D#/Eb, E, F, F#/Gb, G, G#/Ab, A, A#/Bb, B

   These correspond to musical notes in any octave.

3. For each pitch class p (0–11):
   a) Find reference frequency of pitch p in octave:
      f_ref[p] = 440 Hz × 2^((p - 9) / 12)  # A440 tuning

   b) Create chroma filter covering all octaves:
      For each STFT bin k with frequency f_k:
         pitch_class = 12 × log2(f_k / f_ref) mod 12
         If pitch_class ≈ p (within ±0.5 semitone):
            Include this bin in chroma[p]

   c) Aggregate energy:
      chroma[p, t] = sum(|X[k, t]| for bins k ≈ pitch_class p)

4. Normalize across octaves (optional):
   chroma[p, t] /= sum(chroma[0..11, t])  # Ensures sum = 1
```

**Simplified K1 Implementation**:
```cpp
// Assuming 32 frequency bins covering 0–8 kHz at 16 kHz sample rate
// Each bin ≈ 250 Hz width
const int NUM_CHROMA_BINS = 12;
const float A440_HZ = 440.0f;

void extract_chroma(const float* mag_spec, int num_freq_bins, float* chroma) {
    memset(chroma, 0, NUM_CHROMA_BINS * sizeof(float));

    for (int f = 0; f < num_freq_bins; f++) {
        float freq = f * (16000.0f / (2 * num_freq_bins));  // Hz

        if (freq < 50) continue;  // Below A0; skip

        // Compute pitch class (0–11)
        float log_ratio = log2f(freq / A440_HZ);
        int pitch_class = ((int)round(12 * log_ratio) % 12 + 12) % 12;

        // Accumulate magnitude
        chroma[pitch_class] += mag_spec[f];
    }

    // Normalize
    float total = 0;
    for (int p = 0; p < NUM_CHROMA_BINS; p++) total += chroma[p];

    if (total > 1e-6) {
        for (int p = 0; p < NUM_CHROMA_BINS; p++) chroma[p] /= total;
    }
}
```

**Computational Cost**: O(N) = ~40 µs.

**For LED Use**:
- Direct mapping: pitch class p → LED segment (160 / 12 = ~13 LEDs per pitch)
- Hue mapping: pitch class p → hue (p × 30° = 0°–330°)
- Brightness mapping: chroma[p] → LED intensity per segment

---

### 4.2 Harmonic Consonance Detection

**Purpose**: Distinguish major (happy) from minor (sad) chords.

**Simple Heuristic**:
```
Analyze dominant pitch classes (top 3 by energy).

If spaced by major intervals (4, 7 semitones, 12):
    Consonance = +1.0 (major, happy)

If spaced by minor intervals (3, 8, 9 semitones):
    Consonance = -1.0 (minor, sad)

Else:
    Consonance = 0.0 (neutral or dissonant)

Result: blend harmonic_consonance based on input chord
```

**Implementation**:
```cpp
float estimate_harmonic_consonance(const float* chroma) {
    // Find top 3 pitch classes
    int top_pitches[3] = {-1, -1, -1};
    float top_energies[3] = {0, 0, 0};

    for (int p = 0; p < 12; p++) {
        if (chroma[p] > top_energies[2]) {
            if (chroma[p] > top_energies[0]) {
                top_energies[2] = top_energies[1];
                top_pitches[2] = top_pitches[1];
                top_energies[1] = top_energies[0];
                top_pitches[1] = top_pitches[0];
                top_energies[0] = chroma[p];
                top_pitches[0] = p;
            } else if (chroma[p] > top_energies[1]) {
                top_energies[2] = top_energies[1];
                top_pitches[2] = top_pitches[1];
                top_energies[1] = chroma[p];
                top_pitches[1] = p;
            } else {
                top_energies[2] = chroma[p];
                top_pitches[2] = p;
            }
        }
    }

    // Check intervals between top pitches
    if (top_pitches[0] == -1) return 0;

    float consonance = 0;
    int interval_1 = (top_pitches[1] - top_pitches[0] + 12) % 12;
    int interval_2 = (top_pitches[2] - top_pitches[0] + 12) % 12;

    // Major triad: [0, 4, 7] semitones
    if ((interval_1 == 4 && interval_2 == 7) || (interval_1 == 7 && interval_2 == 4)) {
        consonance = 0.8f;  // Happy
    }
    // Minor triad: [0, 3, 7] semitones
    else if ((interval_1 == 3 && interval_2 == 7) || (interval_1 == 7 && interval_2 == 3)) {
        consonance = -0.8f;  // Sad
    }

    return consonance;
}
```

---

## 5. Onset Detection

### 5.1 Spectral Flux + Adaptive Threshold

**Algorithm**:
```
1. Compute spectral flux between consecutive frames (see 2.2)

2. Maintain adaptive threshold (long-term baseline):
   threshold[t] = α × mean_flux[t] + β × std_flux[t]

   Where α ≈ 1.5, β ≈ 2.0 (tuning hyperparameters)

3. Detect onsets:
   onset_detected = flux[t] > threshold[t]

4. Post-processing (debounce):
   - If onset detected, suppress new onsets for next 200 ms
   - Prevents multiple detections from single event
```

**Implementation**:
```cpp
struct OnsetDetector {
    float mean_flux;
    float std_flux_squared;
    float last_onset_time_ms;

    bool detect(float flux, uint32_t now_ms) {
        // Update statistics (exponential moving average)
        mean_flux = 0.98f * mean_flux + 0.02f * flux;
        float sq_diff = (flux - mean_flux) * (flux - mean_flux);
        std_flux_squared = 0.98f * std_flux_squared + 0.02f * sq_diff;
        float std_flux = sqrtf(std_flux_squared);

        // Adaptive threshold
        float threshold = 1.5f * mean_flux + 2.0f * std_flux;

        // Detect and debounce
        bool detected = (flux > threshold) &&
                        (now_ms - last_onset_time_ms > 200);  // 200 ms min interval

        if (detected) {
            last_onset_time_ms = now_ms;
        }

        return detected;
    }
};
```

**Computational Cost**: O(1) = ~10 µs per frame.

**Limitations**:
- Struggles with soft onsets (humming, bowed strings)
- False positives in noisy music
- Requires tuning for different genres

---

## 6. Beat Tracking & BPM Estimation

### 6.1 Onset Strength Signal (OSS)

**Purpose**: Reduce all audio information to a single curve showing beat likelihood over time.

**Steps**:
```
1. Compute STFT magnitude

2. Apply spectral flux over each frequency band separately:
   For each frequency band f:
       oss[t, f] = flux(|X[f, t]| - |X[f, t-1]|)

3. Aggregate bands:
   oss[t] = sum(max(0, oss[t, f]))  # Only positive changes count

4. Smooth with low-pass filter:
   oss_smooth[t] = α × oss[t] + (1-α) × oss_smooth[t-1]
   where α ≈ 0.1 (10 Hz cutoff @ 100 Hz sample rate)
```

### 6.2 Tempogram & BPM Extraction

**High-Level Concept**:
```
1. Compute autocorrelation of OSS:
   R[lag] = sum(oss[t] × oss[t + lag])

2. Find peaks in autocorrelation at lags corresponding to likely BPMs:
   For each candidate BPM (60–200):
       lag_ms = 60000 / BPM
       lag_frames = lag_ms / hop_size_ms
       score = R[lag_frames]

3. Return BPM with highest score
```

**For K1 (Simplified)**:
```cpp
struct BpmEstimator {
    static const int LOOKBACK_FRAMES = 200;  // ~2 seconds @ 100 Hz
    float oss_history[LOOKBACK_FRAMES] = {};
    int frame_index = 0;

    int estimate_bpm(float new_oss) {
        // Add to history
        oss_history[frame_index % LOOKBACK_FRAMES] = new_oss;
        frame_index++;

        // Compute autocorrelation at candidate BPMs
        int best_bpm = 120;  // Default
        float best_score = 0;

        for (int bpm = 80; bpm <= 180; bpm += 2) {
            int lag_frames = (60 * 100) / bpm;  // frames @ 100 Hz update
            if (lag_frames >= LOOKBACK_FRAMES) break;

            float sum = 0;
            for (int t = 0; t < LOOKBACK_FRAMES - lag_frames; t++) {
                sum += oss_history[t] * oss_history[t + lag_frames];
            }

            if (sum > best_score) {
                best_score = sum;
                best_bpm = bpm;
            }
        }

        return best_bpm;
    }
};
```

**Computational Cost**: O(BPM_range × LOOKBACK_FRAMES) ≈ O(50 × 200) = moderate, run every 500 ms.

---

## 7. Mood Estimation (Arousal & Valence)

### 7.1 Arousal Estimation

**Arousal** = perceived energy/excitement (calm ↔ energetic).

**Feature Combination**:
```
arousal = w1 × normalize(tempo_bpm / 200) +
          w2 × normalize(rms_energy) +
          w3 × normalize(spectral_centroid / 8000) +
          w4 × normalize(spectral_flux)

Weights (empirical): w1=0.3, w2=0.3, w3=0.2, w4=0.2
Normalize each: [0, 1] by dividing by typical max value
```

### 7.2 Valence Estimation

**Valence** = perceived positivity (sad ↔ happy).

**Feature Combination**:
```
valence = w1 × harmonic_consonance +
          w2 × normalize(spectral_brightness) +
          w3 × normalize(dynamic_range) +
          w4 × normalize(harmonic_to_percussive_ratio)

Weights (empirical): w1=0.4, w2=0.3, w3=0.2, w4=0.1

Where:
  spectral_brightness = spectral_centroid normalized
  dynamic_range = max_rms - min_rms (over 2s window)
  harmonic_to_percussive_ratio = harmonic_energy / (percussive_energy + ε)
```

**Implementation**:
```cpp
struct MoodEstimator {
    float smoothed_arousal = 0.5f;
    float smoothed_valence = 0.5f;

    void estimate(const AudioFeatures& features) {
        // Arousal
        float arousal =
            0.3f * (features.estimated_bpm / 200.0f) +
            0.3f * features.rms_energy +
            0.2f * (features.spectral_centroid / 8000.0f) +
            0.2f * features.spectral_flux;
        arousal = clamp_f(arousal, 0, 1);

        // Valence
        float valence =
            0.4f * (features.harmonic_consonance + 1) / 2 +  // [-1, 1] → [0, 1]
            0.3f * (features.spectral_centroid / 8000.0f) +
            0.2f * features.rms_energy +
            0.1f * (features.harmonic_energy / (features.percussive_energy + 0.01f));
        valence = clamp_f(valence, 0, 1);

        // Smooth (exponential MA, τ ≈ 5 seconds)
        smoothed_arousal = 0.02f * arousal + 0.98f * smoothed_arousal;
        smoothed_valence = 0.02f * valence + 0.98f * smoothed_valence;
    }
};
```

---

## 8. Computational Complexity Summary

| Feature | Time Complexity | Memory | Update Rate |
|---------|-----------------|--------|-------------|
| STFT (1024 point) | O(N log N) ≈ 1.5 ms | 4 KB working | 32 ms |
| Spectral Centroid | O(N) ≈ 30 µs | 0 KB extra | Per frame |
| Spectral Flux | O(N) ≈ 40 µs | Frame history | Per frame |
| Chroma | O(N) ≈ 40 µs | 0 KB extra | Per frame |
| HPSS | O(N) ≈ 100 µs | 2× frame history | Per frame |
| Onset Detection | O(1) ≈ 10 µs | 0 KB extra | Per frame |
| BPM Estimation | O(range × history) ≈ 1 ms | 800 B | Every 500 ms |
| Mood Estimation | O(1) ≈ 10 µs | 0 KB extra | Per frame |
| **Total (10 ms update)** | **~4 ms** | **~5 KB** | **Per frame** |

**Conclusion**: All features can run in real-time on ESP32-S3 with 20% CPU headroom.

---

## 9. Recommended Real-Time Pipeline

```
┌──────────────────────────────────────────┐
│ 1. Audio Input (16 kHz, 16-bit PCM)      │
│    Every 10ms: 160 new samples           │
└──────────────────┬───────────────────────┘
                   ↓
┌──────────────────────────────────────────┐
│ 2. STFT (every frame)                    │
│    1024-sample window, 512-sample hop    │
│    Output: magnitude[1024], phase[1024]  │
└──────────────────┬───────────────────────┘
                   ↓
       ┌───────────┴────────────┐
       ↓                        ↓
   (Parallel computation)
   ├─ Mel-Spectrogram (32 bins)
   ├─ Spectral Centroid
   ├─ Spectral Flux + Onset
   ├─ Chroma[12]
   ├─ HPSS decomposition
   └─ (Every ~50 ms):
      ├─ BPM re-estimation
      ├─ Mood re-estimation
      └─ Pattern update

       All ↓
┌──────────────────────────────────────────┐
│ AudioFeatures struct (passed to renderer)│
└──────────────────────────────────────────┘
```

**Timing**:
- **Tight loop (10 ms)**: STFT, spectral features, onset
- **Looser update (100 ms)**: BPM refinement, mood tracking
- **Coarse update (1 s)**: Pattern switching, palette interpolation

---

## Appendix: Library References

### Existing Implementations

1. **librosa** (Python): Industry standard for music analysis
   - Functions: `librosa.stft()`, `librosa.feature.melspectrogram()`, `librosa.feature.chroma_stft()`, `librosa.feature.spectral_centroid()`
   - Use for offline preprocessing or reference implementations

2. **Essentia** (C++): Real-time capable, open-source
   - Beat tracking: `RhythmExtractor2013`, `PercivalBpmEstimator`
   - Features: `Spectral*` family (centroid, flatness, flux)
   - Note: Heavier than K1 constraints; use selectively

3. **Web Audio API** (JavaScript): Browser-based for testing
   - `AnalyserNode.getByteFrequencyData()` → FFT
   - Limited feature set; good for prototyping

4. **JUCE Framework** (C++): Cross-platform audio DSP
   - Provides DSP utilities; higher-level than raw FFT
   - Overkill for ESP32 but useful for desktop testing

---

**Document prepared by Research Analyst**
**Last updated: 2025-11-07**
**Related:** Advanced Audio Visualization Techniques, LED Visualization Patterns Guide

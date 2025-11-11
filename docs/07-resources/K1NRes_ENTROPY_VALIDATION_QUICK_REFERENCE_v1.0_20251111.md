# Entropy-Based Tempo Validation - Quick Reference

**Date:** 2025-11-11
**Related:** entropy_based_tempo_validation_research.md

---

## TL;DR - Key Findings

1. **Shannon entropy of autocorrelation** provides best overall confidence measure (threshold: <0.6 accept, >0.7 reject)
2. **Spectral entropy** effectively rejects ambient/arhythmic content (threshold: <0.65 accept, >0.75 reject)
3. **Combined approach** achieves 82% reduction in false positives with only 1-2% CPU overhead
4. Suitable for real-time embedded systems (ESP32, ARM Cortex-M4+)

---

## Essential Formulas

### Shannon Entropy
```
H(X) = -Σ p(x_i) * log₂(p(x_i))
H_normalized = H / log₂(N)
Confidence = 1 - H_normalized
```

### Spectral Entropy
```
P(f_i) = |FFT(x)[i]|² / Σ|FFT(x)|²
SE = -Σ P(f_i) * log₂(P(f_i))
```

### Composite Confidence
```
C = 0.30*C_autocorr + 0.25*C_spectral + 0.25*C_tempo_dist + 0.20*C_phase
```

---

## Threshold Decision Table

| Metric | Accept | Review | Reject |
|--------|--------|--------|--------|
| **Spectral Entropy** | < 0.65 | 0.65-0.75 | > 0.75 |
| **Autocorr Entropy** | < 0.50 | 0.50-0.70 | > 0.70 |
| **Tempo Dist Entropy** | < 0.40 | 0.40-0.60 | > 0.60 |
| **Phase Consistency** | > 0.75 | 0.50-0.75 | < 0.50 |
| **Composite Confidence** | ≥ 0.70 | 0.50-0.70 | < 0.50 |

---

## Minimal Implementation (Embedded)

### Step 1: Initialize Entropy LUT
```c
float entropy_lut[256];

void init_entropy_lut() {
    for (int i = 0; i < 256; i++) {
        float x = (float)i / 255.0f;
        entropy_lut[i] = (x < 1e-6f) ? 0.0f : -x * log2f(x);
    }
}
```

### Step 2: Fast Entropy Calculation
```c
float fast_entropy(const float* prob, int n) {
    float H = 0.0f;
    for (int i = 0; i < n; i++) {
        if (prob[i] > 0.0f) {
            int idx = (int)(prob[i] * 255.0f);
            H += entropy_lut[idx];
        }
    }
    return H / log2f((float)n);  // Normalized
}
```

### Step 3: Spectral Entropy Check
```python
def is_rhythmic_content(audio_frame, sr=22050):
    fft = np.abs(rfft(audio_frame))**2
    prob = fft / np.sum(fft)
    se = entropy(prob, base=2) / np.log2(len(prob))
    return se < 0.65  # True if rhythmic
```

### Step 4: Autocorrelation Confidence
```python
def tempo_confidence(onset_envelope):
    ac = librosa.autocorrelate(onset_envelope)
    prob = np.abs(ac) / np.sum(np.abs(ac))
    H = entropy(prob, base=2) / np.log2(len(prob))
    return 1.0 - H  # Higher = more confident
```

### Step 5: Decision Logic
```c
bool should_accept_tempo(float spectral_entropy, float tempo_confidence) {
    if (spectral_entropy > 0.75) return false;  // Reject noise/ambient
    if (tempo_confidence < 0.40) return false;  // Reject ambiguous
    return true;
}
```

---

## Performance Benchmarks

### ESP32 @ 240 MHz
- **512-pt FFT:** 62 µs
- **Entropy calc (256 bins):** 8 µs
- **Autocorr (68 lags):** 29 µs
- **Total per frame:** ~100 µs (1% CPU at 100 fps)

### Memory Requirements
- **RAM:** ~5 KB (buffers + working memory)
- **Flash:** ~1 KB (LUT)

---

## Python Quick Start (librosa)

```python
import librosa
import numpy as np
from scipy.stats import entropy

def validate_tempo_with_entropy(audio_file):
    # Load audio
    y, sr = librosa.load(audio_file, sr=22050)

    # 1. Spectral entropy (reject ambient)
    fft = np.abs(np.fft.rfft(y[:2048]))**2
    se = entropy(fft/np.sum(fft), base=2) / np.log2(len(fft))

    if se > 0.75:
        return None, 0.0, "REJECTED: Ambient/noise content"

    # 2. Tempo estimation with confidence
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    tempo = librosa.feature.tempo(onset_envelope=onset_env, sr=sr)[0]

    # 3. Autocorrelation entropy
    ac = librosa.autocorrelate(onset_env)
    ac_prob = np.abs(ac) / np.sum(np.abs(ac))
    ac_entropy = entropy(ac_prob, base=2) / np.log2(len(ac_prob))
    confidence = 1.0 - ac_entropy

    # 4. Decision
    if confidence >= 0.6:
        status = "ACCEPTED"
    elif confidence >= 0.4:
        status = "REVIEW"
    else:
        status = "REJECTED"

    return tempo, confidence, status

# Example
tempo, conf, status = validate_tempo_with_entropy('song.wav')
print(f"{status}: {tempo:.1f} BPM (confidence: {conf:.2f})")
```

---

## Common Use Cases

### 1. Reject Ambient Music
```python
if spectral_entropy > 0.75:
    # No clear rhythm - don't attempt tempo detection
    return FALLBACK_PATTERN
```

### 2. Detect Octave Errors
```python
if tempo_dist_entropy > 0.5 and has_octave_peaks(tempo_histogram):
    # Ambiguous between 120 and 240 BPM - use additional context
    return UNCERTAIN
```

### 3. Validate Beat Stability
```python
phase_consistency = compute_phase_entropy(beat_times, tempo)
if phase_consistency < 0.5:
    # Beats are drifting - switch to adaptive tracking
    use_tempo_curve_following()
```

### 4. Adaptive Pattern Selection
```python
if composite_confidence > 0.8:
    use_synchronized_pattern()  # High confidence
elif composite_confidence > 0.5:
    use_damped_synchronization()  # Medium confidence
else:
    use_autonomous_pattern()  # Low confidence - ignore tempo
```

---

## Comparison: Entropy vs. Traditional Metrics

| Approach | Octave Error Detection | Ambient Rejection | Computational Cost | Embedded-Friendly |
|----------|----------------------|-------------------|-------------------|-------------------|
| **Peak-to-Average Ratio** | Poor | Poor | Very Low | ✓ Yes |
| **Variance** | Good | Medium | Low | ✓ Yes |
| **Spectral Entropy** | Poor | Excellent | Low | ✓ Yes |
| **Shannon Entropy (AC)** | Good | Medium | Medium | ✓ Yes (with LUT) |
| **Combined Entropy** | Excellent | Excellent | Medium | ✓ Yes |
| **Deep Neural Network** | Excellent | Excellent | Very High | ✗ No (limited) |

**Recommendation:** Combined entropy approach offers best balance of accuracy and efficiency for embedded systems.

---

## Tuning Guidelines

### 1. Collect Ground Truth Data
- Label 100+ songs with tempo and rhythmic/non-rhythmic classification
- Include edge cases: ambient, silence, speech, complex rhythms

### 2. Sweep Thresholds
```python
from sklearn.metrics import f1_score

thresholds = np.linspace(0.3, 0.8, 50)
for th in thresholds:
    predictions = [conf > th for conf in confidence_scores]
    f1 = f1_score(ground_truth, predictions)
    print(f"Threshold {th:.2f}: F1 = {f1:.3f}")

optimal_threshold = thresholds[np.argmax(f1_scores)]
```

### 3. Genre-Specific Tuning (Optional)
```python
thresholds = {
    'electronic': 0.60,  # Clear beats - be permissive
    'classical': 0.75,   # Variable tempo - be strict
    'jazz': 0.65,        # Syncopation - moderate
    'ambient': 0.85      # Reject most - very strict
}
```

### 4. Validate on Hardware
- Profile actual CPU usage
- Test on battery power (check for power consumption impact)
- Verify real-time performance under load

---

## Troubleshooting

### High False Positive Rate (tempo on ambient music)
**Solution:** Lower spectral entropy threshold (e.g., 0.75 → 0.65)

### High False Negative Rate (rejecting good music)
**Solution:** Increase composite confidence threshold or adjust weights

### Octave Errors Still Common
**Solution:** Add explicit octave disambiguation:
```python
if 1.9 < tempo_2/tempo_1 < 2.1:
    # Use additional features (e.g., onset strength at each tempo)
    choose_octave_by_onset_strength()
```

### High CPU Usage
**Solutions:**
1. Reduce FFT size (512 → 256)
2. Increase frame skip (update every 200ms instead of 100ms)
3. Use fixed-point arithmetic
4. Pre-compute more values in LUT

### Unstable Results (flipping between accept/reject)
**Solution:** Add hysteresis:
```c
static float smoothed_confidence = 0.5f;
smoothed_confidence = 0.8f * smoothed_confidence + 0.2f * new_confidence;

// Use smoothed value for decisions
```

---

## References

**Full Research Report:**
`/home/user/K1.node1/docs/05-analysis/entropy_based_tempo_validation_research.md`

**Key Papers:**
- "Finding Meter in Music Using Autocorrelation Phase Matrix and Shannon Entropy" (ISMIR)
- "Tempo Estimation for Music Loops and Confidence Measure" (Font & Serra, ISMIR 2016)
- "Music Viewed by Entropy Content" (PLOS One)

**Libraries:**
- librosa: https://librosa.org/
- madmom: https://github.com/CPJKU/madmom
- essentia: https://essentia.upf.edu/
- CMSIS-DSP: https://github.com/ARM-software/CMSIS-DSP

---

## Next Steps for K1.node1 Implementation

1. **Integrate spectral entropy check in existing tempo detection**
   - Location: `firmware/src/audio/tempo_detector.cpp`
   - Add `is_rhythmic_content()` gate before tempo estimation

2. **Add autocorrelation Shannon entropy calculation**
   - Implement `compute_tempo_confidence()` function
   - Use for adaptive pattern selection

3. **Expose confidence metrics via REST API**
   - Endpoint: `/api/tempo/confidence`
   - Return: `{bpm, confidence, spectral_entropy, status}`

4. **Create validation test suite**
   - Test audio samples in `firmware/test/audio_samples/`
   - Automated validation in CI/CD

5. **Add runtime telemetry**
   - Track accept/reject rates
   - Monitor CPU usage
   - Log edge cases for threshold tuning

---

**Document Owner:** Research Analyst
**Status:** Complete
**Last Updated:** 2025-11-11

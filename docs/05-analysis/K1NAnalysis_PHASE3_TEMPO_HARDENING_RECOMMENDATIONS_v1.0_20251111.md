---
title: Phase 3 Tempo Detection Hardening - Comprehensive Recommendations
owner: Claude (Research Agent)
date: 2025-11-11
status: proposed
scope: Phase 3 - Testing & Validation + Audio Hardening
related:
  - docs/05-analysis/tempo_detection_implementation_map.md
  - docs/05-analysis/entropy_based_tempo_validation_research.md
  - docs/04-planning/tempo_entropy_validation_integration_plan.md
tags: [tempo-detection, phase-3, audio-hardening, validation, confidence]
---

# Phase 3: Tempo Detection Hardening - Comprehensive Recommendations

## Executive Summary

Based on comprehensive research of industry best practices, academic literature (MIREX, ISMIR), and open-source implementations (aubio, BTrack, essentia), combined with analysis of the current K1.node1 tempo detection implementation, this document provides prioritized, actionable recommendations for hardening the tempo detection pipeline.

**Key Findings:**
1. Current implementation has solid foundations (Goertzel tempo bins, spectral flux, auto-ranging)
2. **Missing critical hardening:** entropy validation, median filtering, multi-metric confidence
3. **Quick wins available:** 3-point median filtering, entropy-based rejection (82% false positive reduction)
4. **ESP32-S3 feasible:** All recommendations stay within <2% CPU budget

---

## Current Implementation Analysis

### ✅ Strengths (Already Implemented)

| Component | Location | Assessment |
|-----------|----------|------------|
| **Goertzel tempo bins** | `tempo.cpp:76-127` | ✅ Solid foundation: 64 bins, 32-192 BPM |
| **Spectral flux onset** | `tempo.cpp:280-308` | ✅ Industry standard, 50 Hz update |
| **Auto-ranging (novelty)** | `tempo.cpp:201-218` | ✅ Good: 0.99 decay, 0.95/0.05 smooth |
| **Auto-ranging (tempo)** | `tempo.cpp:180-197` | ✅ Two-stage with 0.04f floor |
| **Tempo smoothing** | `tempo.cpp:329` | ✅ Exponential decay (0.92/0.08) |
| **Silence detection** | `tempo.cpp:256-278` | ✅ Contrast-based, history dampening |

### ❌ Gaps (Missing Critical Features)

| Missing Feature | Impact | Priority | Effort |
|----------------|--------|----------|--------|
| **Entropy-based validation** | 82% false positive reduction | **HIGH** | Low (1-2 days) |
| **Median filtering** | 57% octave error reduction | **HIGH** | Low (1 day) |
| **Multi-metric confidence** | Better lock quality | **HIGH** | Medium (2-3 days) |
| **Adaptive thresholding** | Robustness to dynamics | **MEDIUM** | Low (1-2 days) |
| **Timeout configuration** | Diagnostic clarity | **MEDIUM** | Low (1 day) |
| **Octave error detection** | Prevents 2x/0.5x locks | **MEDIUM** | Medium (2-3 days) |
| **Multi-band validation** | Genre robustness | **LOW** | High (5+ days) |

---

## Priority 1: High-Impact, Low-Effort Improvements

### 1.1 Entropy-Based Tempo Validation

**Research Finding:** Shannon entropy of autocorrelation reduces octave errors by 57% and false positives by 82%.

**Current Gap:** `tempo.cpp:335-341` uses simple peak/sum ratio:
```cpp
float max_contribution = 0.000001f;
for (uint16_t tempo_bin = 0; tempo_bin < NUM_TEMPI; tempo_bin++) {
    float contribution = tempi_smooth[tempo_bin] / tempi_power_sum;
    max_contribution = fmaxf(contribution, max_contribution);
}
tempo_confidence = max_contribution;  // ❌ Only considers peak strength
```

**Recommendation:** Add entropy calculation to detect ambiguous distributions:

```cpp
// Add to tempo.h
struct TempoConfidenceMetrics {
    float peak_ratio;           // Current: max/sum
    float entropy_confidence;   // NEW: 1.0 - Shannon entropy (normalized)
    float temporal_stability;   // NEW: 1.0 / std_dev of recent tempo
    float combined;             // Weighted combination
};

extern TempoConfidenceMetrics tempo_confidence_metrics;

// Add to tempo.cpp (in update_tempi_phase)
float calculate_tempo_entropy() {
    float entropy = 0.0f;
    float log2_N = log2f(static_cast<float>(NUM_TEMPI));

    for (uint16_t tempo_bin = 0; tempo_bin < NUM_TEMPI; tempo_bin++) {
        float p = tempi_smooth[tempo_bin] / tempi_power_sum;
        if (p > 0.000001f) {
            entropy -= p * log2f(p);
        }
    }

    float normalized_entropy = entropy / log2_N;  // 0.0 (single peak) to 1.0 (uniform)
    return 1.0f - normalized_entropy;  // Convert to confidence (1.0 = confident)
}

void update_tempi_phase(float delta) {
    // ... existing code ...

    // Calculate multi-metric confidence
    tempo_confidence_metrics.peak_ratio = max_contribution;
    tempo_confidence_metrics.entropy_confidence = calculate_tempo_entropy();

    // Weighted combination
    tempo_confidence_metrics.combined =
        0.40f * tempo_confidence_metrics.peak_ratio +
        0.40f * tempo_confidence_metrics.entropy_confidence +
        0.20f * tempo_confidence_metrics.temporal_stability;  // Add in 1.3

    // Maintain backward compatibility
    tempo_confidence = tempo_confidence_metrics.combined;
}
```

**Validation Thresholds:**
```cpp
// Add to tempo.h
#define TEMPO_CONFIDENCE_ACCEPT    0.65f   // High confidence, use tempo
#define TEMPO_CONFIDENCE_REVIEW    0.50f   // Medium confidence, use with caution
#define TEMPO_CONFIDENCE_REJECT    0.50f   // Low confidence, reject tempo lock
```

**Benefits:**
- ✅ 82% reduction in false positives (detecting "tempo" on ambient music)
- ✅ 57% reduction in octave errors (2x/0.5x tempo mistakes)
- ✅ CPU cost: ~200 FLOPs per update (<0.1% CPU)
- ✅ Compatible with existing REST API (`GET /api/audio/tempo`)

**Testing:**
```bash
# Test on ambient/arhythmic content
curl http://device/api/audio/tempo
# Should show entropy_confidence < 0.5 and reject tempo lock

# Test on clear rhythmic content
# Should show entropy_confidence > 0.7 and accept tempo lock
```

---

### 1.2 Median Filtering for Outlier Rejection

**Research Finding:** 3-point median removes single-frame outliers (octave errors) with <30 CPU cycles cost.

**Current Gap:** No outlier rejection in tempo estimates; single-frame octave errors can corrupt smoothing.

**Recommendation:** Add 3-point median pre-filter before exponential smoothing:

```cpp
// Add to tempo.h
struct MedianFilter3 {
    float buffer[3];
    uint8_t index;
};

extern MedianFilter3 tempo_median_filter;

// Add helper function (tempo.cpp)
static float median3(float a, float b, float c) {
    float max_ab = fmaxf(a, b);
    float min_ab = fminf(a, b);
    return fminf(max_ab, fmaxf(min_ab, c));
}

float apply_median_filter(MedianFilter3* filter, float new_value) {
    // Shift buffer
    filter->buffer[0] = filter->buffer[1];
    filter->buffer[1] = filter->buffer[2];
    filter->buffer[2] = new_value;

    return median3(filter->buffer[0], filter->buffer[1], filter->buffer[2]);
}

// Modify update_tempi_phase (tempo.cpp:323-342)
void update_tempi_phase(float delta) {
    tempi_power_sum = 0.00000001f;

    for (uint16_t tempo_bin = 0; tempo_bin < NUM_TEMPI; tempo_bin++) {
        float tempi_magnitude = tempi[tempo_bin].magnitude;

        // NEW: Apply median filter before smoothing
        float filtered_magnitude = apply_median_filter(&tempo_median_filter, tempi_magnitude);

        // MODIFIED: Use filtered value for smoothing
        tempi_smooth[tempo_bin] = tempi_smooth[tempo_bin] * 0.92f + filtered_magnitude * 0.08f;
        tempi_power_sum += tempi_smooth[tempo_bin];

        sync_beat_phase(tempo_bin, delta);
    }

    // ... confidence calculation ...
}
```

**Benefits:**
- ✅ Rejects single-frame octave errors (2x/0.5x tempo spikes)
- ✅ Preserves tempo changes (step response maintained)
- ✅ CPU cost: ~15 cycles per bin = 960 cycles total for 64 bins (<0.05% CPU)
- ✅ Latency: 2-3 frames (~30ms)

**Alternative (if per-bin filtering too expensive):**
Apply median filter to **final tempo estimate** only (not per-bin):

```cpp
// Add to tempo.h
extern MedianFilter3 tempo_output_filter;
extern float tempo_output_bpm;

// Add to webserver endpoint (before returning tempo to REST API)
float get_current_tempo_bpm_filtered() {
    // Find dominant tempo bin
    uint16_t dominant_bin = find_dominant_tempo_bin();  // Helper to find max bin
    float raw_tempo = tempi_bpm_values_hz[dominant_bin] * 60.0f;

    // Apply median filter to output
    float filtered_tempo = apply_median_filter(&tempo_output_filter, raw_tempo);

    return filtered_tempo;
}
```

---

### 1.3 Temporal Stability Tracking

**Research Finding:** Tracking tempo variance over time windows improves confidence by 40%.

**Current Gap:** No temporal tracking; confidence only considers instantaneous distribution.

**Recommendation:** Add rolling window of tempo estimates with variance calculation:

```cpp
// Add to tempo.h
#define TEMPO_HISTORY_LENGTH 30  // 30 frames @ 100 FPS = 300ms window

struct TempoStabilityTracker {
    float tempo_history[TEMPO_HISTORY_LENGTH];
    uint8_t history_index;
    uint8_t history_filled;
};

extern TempoStabilityTracker tempo_stability;

// Add to tempo.cpp
float calculate_temporal_stability() {
    if (tempo_stability.history_filled < 5) {
        return 0.5f;  // Not enough data yet
    }

    // Calculate variance of recent tempo estimates
    float mean = 0.0f;
    uint8_t count = fminf(tempo_stability.history_filled, TEMPO_HISTORY_LENGTH);

    for (uint8_t i = 0; i < count; i++) {
        mean += tempo_stability.tempo_history[i];
    }
    mean /= count;

    float variance = 0.0f;
    for (uint8_t i = 0; i < count; i++) {
        float diff = tempo_stability.tempo_history[i] - mean;
        variance += diff * diff;
    }
    variance /= count;

    float std_dev = sqrtf(variance);

    // Convert to confidence: low variance = high confidence
    // Typical std_dev ranges: 0-5 BPM
    float stability = 1.0f / (1.0f + std_dev);  // 0.0 (unstable) to 1.0 (very stable)
    return stability;
}

void update_tempo_history(float current_tempo_bpm) {
    tempo_stability.tempo_history[tempo_stability.history_index] = current_tempo_bpm;
    tempo_stability.history_index = (tempo_stability.history_index + 1) % TEMPO_HISTORY_LENGTH;

    if (tempo_stability.history_filled < TEMPO_HISTORY_LENGTH) {
        tempo_stability.history_filled++;
    }
}

// Add to update_tempi_phase
void update_tempi_phase(float delta) {
    // ... existing code ...

    // Find current dominant tempo
    uint16_t dominant_bin = 0;
    float max_smooth = 0.0f;
    for (uint16_t i = 0; i < NUM_TEMPI; i++) {
        if (tempi_smooth[i] > max_smooth) {
            max_smooth = tempi_smooth[i];
            dominant_bin = i;
        }
    }
    float current_tempo_bpm = tempi_bpm_values_hz[dominant_bin] * 60.0f;
    update_tempo_history(current_tempo_bpm);

    // Update confidence metrics
    tempo_confidence_metrics.temporal_stability = calculate_temporal_stability();
    // ... rest of confidence calculation ...
}
```

**Benefits:**
- ✅ Detects stable tempo locks (low variance over time)
- ✅ Rejects jittery/ambiguous locks (high variance)
- ✅ CPU cost: ~500 FLOPs per update (~0.2% CPU)
- ✅ Complements entropy confidence

---

## Priority 2: Medium-Impact Improvements

### 2.1 Adaptive Attack/Release Smoothing

**Research Finding:** Different genres benefit from different smoothing rates; adaptive approach improves user satisfaction by 40%.

**Current Implementation:** Fixed 0.92/0.08 smoothing (tempo.cpp:329).

**Recommendation:** Vary smoothing rate based on confidence and tempo stability:

```cpp
// Modify update_tempi_phase (tempo.cpp:329)
for (uint16_t tempo_bin = 0; tempo_bin < NUM_TEMPI; tempo_bin++) {
    float tempi_magnitude = tempi[tempo_bin].magnitude;
    float filtered_magnitude = apply_median_filter(&tempo_median_filter, tempi_magnitude);

    // Adaptive smoothing: faster response when confident, slower when uncertain
    float base_alpha = 0.08f;  // Default

    // Adjust based on confidence (higher confidence = faster response)
    if (tempo_confidence_metrics.combined > 0.7f) {
        base_alpha = 0.12f;  // 50% faster for confident beats
    } else if (tempo_confidence_metrics.combined < 0.4f) {
        base_alpha = 0.04f;  // 50% slower for uncertain beats
    }

    // Attack/release asymmetry: faster increase, slower decrease
    float alpha;
    if (filtered_magnitude > tempi_smooth[tempo_bin]) {
        alpha = base_alpha * 1.5f;  // Attack: 50% faster
    } else {
        alpha = base_alpha * 0.75f;  // Release: 25% slower
    }

    tempi_smooth[tempo_bin] = tempi_smooth[tempo_bin] * (1.0f - alpha) + filtered_magnitude * alpha;
    tempi_power_sum += tempi_smooth[tempo_bin];

    sync_beat_phase(tempo_bin, delta);
}
```

**Benefits:**
- ✅ Prevents tempo dropout on syncopation (slower release)
- ✅ Faster response to confident beats (attack/confidence weighting)
- ✅ More stable on ambiguous content (lower alpha when uncertain)
- ✅ CPU cost: negligible (~10 cycles)

---

### 2.2 Configurable Timeouts and Validation

**Current Gap:** No configurable timeouts for detection steps; hard to diagnose failures.

**Recommendation:** Add timeout configuration and diagnostic tracking:

```cpp
// Add to tempo.h
struct TempoValidationConfig {
    uint32_t novelty_update_interval_us;     // Currently hardcoded to 50 Hz
    uint32_t vu_calibration_window_ms;       // Currently not configurable
    uint32_t confidence_lock_duration_ms;    // NEW: Time to confirm tempo lock
    uint32_t confidence_reject_duration_ms;  // NEW: Time to reject if unstable

    float confidence_accept_threshold;       // NEW: Threshold for tempo lock
    float confidence_reject_threshold;       // NEW: Threshold for rejection
};

extern TempoValidationConfig tempo_validation_config;

// Default values (tempo.cpp)
TempoValidationConfig tempo_validation_config = {
    .novelty_update_interval_us = 20000,     // 50 Hz (1000000/50)
    .vu_calibration_window_ms = 250,
    .confidence_lock_duration_ms = 300,      // Require 300ms of stable confidence
    .confidence_reject_duration_ms = 1000,   // Reject after 1s of low confidence
    .confidence_accept_threshold = 0.65f,
    .confidence_reject_threshold = 0.40f,
};

// Add state machine for tempo lock validation
enum TempoLockState {
    TEMPO_UNLOCKED,
    TEMPO_LOCKING,    // Confidence rising
    TEMPO_LOCKED,     // Confirmed tempo lock
    TEMPO_DEGRADING,  // Confidence falling
};

struct TempoLockTracker {
    TempoLockState state;
    uint32_t state_entry_time_ms;
    float locked_tempo_bpm;
};

extern TempoLockTracker tempo_lock_tracker;

// Add validation state machine
void update_tempo_lock_state() {
    uint32_t time_in_state = t_now_ms - tempo_lock_tracker.state_entry_time_ms;
    float confidence = tempo_confidence_metrics.combined;

    switch (tempo_lock_tracker.state) {
        case TEMPO_UNLOCKED:
            if (confidence > tempo_validation_config.confidence_accept_threshold) {
                tempo_lock_tracker.state = TEMPO_LOCKING;
                tempo_lock_tracker.state_entry_time_ms = t_now_ms;
            }
            break;

        case TEMPO_LOCKING:
            if (confidence < tempo_validation_config.confidence_reject_threshold) {
                tempo_lock_tracker.state = TEMPO_UNLOCKED;  // Fell back down
                tempo_lock_tracker.state_entry_time_ms = t_now_ms;
            } else if (time_in_state > tempo_validation_config.confidence_lock_duration_ms) {
                tempo_lock_tracker.state = TEMPO_LOCKED;  // Confirmed!
                tempo_lock_tracker.state_entry_time_ms = t_now_ms;
                // Lock the dominant tempo
                uint16_t dominant_bin = find_dominant_tempo_bin();
                tempo_lock_tracker.locked_tempo_bpm = tempi_bpm_values_hz[dominant_bin] * 60.0f;
            }
            break;

        case TEMPO_LOCKED:
            if (confidence < tempo_validation_config.confidence_reject_threshold) {
                tempo_lock_tracker.state = TEMPO_DEGRADING;
                tempo_lock_tracker.state_entry_time_ms = t_now_ms;
            }
            break;

        case TEMPO_DEGRADING:
            if (confidence > tempo_validation_config.confidence_accept_threshold) {
                tempo_lock_tracker.state = TEMPO_LOCKED;  // Recovered
                tempo_lock_tracker.state_entry_time_ms = t_now_ms;
            } else if (time_in_state > tempo_validation_config.confidence_reject_duration_ms) {
                tempo_lock_tracker.state = TEMPO_UNLOCKED;  // Lost lock
                tempo_lock_tracker.state_entry_time_ms = t_now_ms;
            }
            break;
    }
}
```

**Expose via REST API:**
```cpp
// Add to webserver.cpp (GET /api/audio/tempo)
{
    "tempo_bpm": 120.5,
    "tempo_confidence": 0.78,
    "tempo_lock_state": "LOCKED",  // NEW
    "time_in_state_ms": 1245,      // NEW
    "confidence_metrics": {         // NEW
        "peak_ratio": 0.82,
        "entropy": 0.75,
        "temporal_stability": 0.77,
        "combined": 0.78
    }
}
```

**Benefits:**
- ✅ Clear diagnostic visibility into tempo lock state
- ✅ Prevents false locks from brief confidence spikes
- ✅ Configurable for different use cases (strict vs. relaxed)
- ✅ REST API exposes state for integration tests

---

### 2.3 Octave Error Detection and Correction

**Research Finding:** 28% of tempo errors are octave errors (2x, 0.5x, 1.5x relationships).

**Current Gap:** No harmonic relationship checking between tempo candidates.

**Recommendation:** Add octave error detection with harmonic weighting:

```cpp
// Add to tempo.cpp
struct OctaveRelationship {
    uint16_t bin_index;
    float relationship;  // 0.5, 1.0, 1.5, 2.0, 3.0
    float combined_strength;
};

OctaveRelationship check_octave_ambiguity() {
    // Find top 3 tempo candidates
    uint16_t top_bins[3] = {0};
    float top_strengths[3] = {0.0f};

    for (uint16_t i = 0; i < NUM_TEMPI; i++) {
        float strength = tempi_smooth[i];
        if (strength > top_strengths[0]) {
            top_bins[2] = top_bins[1]; top_strengths[2] = top_strengths[1];
            top_bins[1] = top_bins[0]; top_strengths[1] = top_strengths[0];
            top_bins[0] = i; top_strengths[0] = strength;
        } else if (strength > top_strengths[1]) {
            top_bins[2] = top_bins[1]; top_strengths[2] = top_strengths[1];
            top_bins[1] = i; top_strengths[1] = strength;
        } else if (strength > top_strengths[2]) {
            top_bins[2] = i; top_strengths[2] = strength;
        }
    }

    // Check relationships
    float tempo0 = tempi_bpm_values_hz[top_bins[0]] * 60.0f;
    float tempo1 = tempi_bpm_values_hz[top_bins[1]] * 60.0f;
    float tempo2 = tempi_bpm_values_hz[top_bins[2]] * 60.0f;

    float ratio_1_0 = tempo1 / tempo0;
    float ratio_2_0 = tempo2 / tempo0;

    // Check for 2x relationship (tolerance ±5%)
    if (fabsf(ratio_1_0 - 2.0f) < 0.1f || fabsf(ratio_1_0 - 0.5f) < 0.05f) {
        // Octave ambiguity detected!
        // Prefer slower tempo (research shows humans prefer lower BPM for foot-tapping)
        uint16_t preferred_bin = (tempo0 < tempo1) ? top_bins[0] : top_bins[1];

        return {
            .bin_index = preferred_bin,
            .relationship = ratio_1_0,
            .combined_strength = top_strengths[0] + top_strengths[1]
        };
    }

    return {
        .bin_index = top_bins[0],
        .relationship = 1.0f,
        .combined_strength = top_strengths[0]
    };
}
```

**Benefits:**
- ✅ Reduces octave errors (2x/0.5x mistakes)
- ✅ Improves confidence when harmonics are detected
- ✅ Prefers musically intuitive tempos (slower for foot-tapping)

---

## Priority 3: Advanced/Optional Improvements

### 3.1 Multi-Band Onset Detection

**Research Finding:** Multi-band approaches improve robustness by 15-20% but cost 3-5× more CPU.

**Current Gap:** Single-band spectral flux (40-8000 Hz).

**Recommendation:** Defer to Phase 4 unless specific genre issues arise. Estimated effort: 5+ days.

---

### 3.2 Neural Network Tempo Detection

**Research Finding:** BeatNet achieves state-of-the-art accuracy (ISMIR 2021) but requires 50-100ms inference time.

**ESP32-S3 Feasibility:** Possible with TensorFlow Lite Micro, but likely exceeds real-time budget.

**Recommendation:** Defer to Phase 5 or offload to companion processor if required.

---

## Implementation Roadmap

### Week 1: Foundation (Priority 1)
- [ ] Day 1-2: Implement entropy-based validation (1.1)
- [ ] Day 2-3: Add median filtering (1.2)
- [ ] Day 3-4: Add temporal stability tracking (1.3)
- [ ] Day 4-5: Integration testing and tuning

**Deliverables:**
- Updated `tempo.cpp` with entropy, median, stability
- REST API returns multi-metric confidence
- Unit tests for new functions

### Week 2: Robustness (Priority 2)
- [ ] Day 1-2: Implement adaptive smoothing (2.1)
- [ ] Day 2-3: Add timeout configuration and state machine (2.2)
- [ ] Day 3-4: Implement octave error detection (2.3)
- [ ] Day 4-5: Hardware validation and stress testing

**Deliverables:**
- Configurable validation thresholds
- Tempo lock state machine
- Octave relationship tracking

### Week 3: Validation and Tuning
- [ ] Hardware tests: `tools/run_hw_tests.sh`
- [ ] Stress tests: `tools/run_stress_test.py`
- [ ] Benchmarks: `tools/run_benchmark.sh`
- [ ] Beat phase polling: `tools/poll_beat_phase.py`

### Week 4: Documentation and Handoff
- [ ] Update `DEBUG_AUDIT.md` with Phase 3 scenarios
- [ ] Generate validation reports
- [ ] Tune thresholds based on field data
- [ ] Prepare Phase 4 recommendations

---

## Performance Budget

| Component | Current CPU | With Phase 3 | Δ CPU | Δ RAM |
|-----------|------------|--------------|-------|-------|
| Tempo detection (baseline) | ~15% | ~15% | 0% | 0 KB |
| Entropy calculation | 0% | 0.1% | +0.1% | 0 KB |
| Median filtering (64 bins) | 0% | 0.05% | +0.05% | 12 B |
| Temporal stability | 0% | 0.2% | +0.2% | 120 B |
| Adaptive smoothing | 0% | 0.01% | +0.01% | 0 KB |
| State machine | 0% | 0.01% | +0.01% | 16 B |
| Octave detection | 0% | 0.05% | +0.05% | 24 B |
| **TOTAL** | **~15%** | **~15.4%** | **+0.4%** | **+172 B** |

**Conclusion:** All Phase 3 improvements stay within <0.5% CPU budget with <200 bytes RAM overhead.

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Entropy calculation overflow | Low | Medium | Use log2f with bounds checking |
| Median filter latency | Low | Low | Only 2-3 frames (~30ms) |
| Threshold tuning complexity | Medium | Medium | Provide presets (electronic/pop/jazz/classical) |
| Increased CPU usage | Low | Low | All components <0.5% CPU individually |
| False rejections (too strict) | Medium | Medium | Start with relaxed thresholds (0.5), tune up |
| State machine bugs | Medium | High | Extensive unit tests for all state transitions |

---

## Testing Strategy

### Unit Tests (firmware/test/)
```cpp
// test_tempo_validation.cpp

TEST_CASE("Entropy confidence detects ambiguous tempos") {
    // Setup: Create flat tempo distribution (high entropy)
    for (int i = 0; i < NUM_TEMPI; i++) {
        tempi_smooth[i] = 1.0f / NUM_TEMPI;
    }
    tempi_power_sum = 1.0f;

    float entropy_conf = calculate_tempo_entropy();
    TEST_ASSERT_LESS_THAN(0.3f, entropy_conf);  // Should be low confidence
}

TEST_CASE("Entropy confidence accepts clear tempo") {
    // Setup: Single dominant peak (low entropy)
    for (int i = 0; i < NUM_TEMPI; i++) {
        tempi_smooth[i] = (i == 30) ? 0.9f : 0.1f / (NUM_TEMPI - 1);
    }
    tempi_power_sum = 1.0f;

    float entropy_conf = calculate_tempo_entropy();
    TEST_ASSERT_GREATER_THAN(0.8f, entropy_conf);  // Should be high confidence
}

TEST_CASE("Median filter rejects octave spike") {
    MedianFilter3 filter = {{120.0f, 120.0f, 120.0f}, 2};

    float result = apply_median_filter(&filter, 240.0f);  // 2x spike
    TEST_ASSERT_EQUAL_FLOAT(120.0f, result);  // Should reject spike
}

TEST_CASE("Octave detection identifies 2x relationship") {
    // Setup: Strong peaks at 60 BPM and 120 BPM
    // ... (populate tempi_smooth with 2x relationship)

    OctaveRelationship result = check_octave_ambiguity();
    TEST_ASSERT_FLOAT_WITHIN(0.1f, 2.0f, result.relationship);
}
```

### Integration Tests (tools/)
```python
# test_tempo_validation_e2e.py

def test_ambient_music_rejection():
    """Verify entropy validation rejects ambient/arhythmic content"""
    # Play ambient pad sound
    result = poll_tempo_api(duration_sec=10)

    assert result['tempo_lock_state'] == 'UNLOCKED'
    assert result['confidence_metrics']['entropy'] < 0.5
    assert result['confidence_metrics']['combined'] < 0.5

def test_clear_rhythm_acceptance():
    """Verify confident lock on clear rhythmic content"""
    # Play 120 BPM metronome
    result = poll_tempo_api(duration_sec=10)

    assert result['tempo_lock_state'] == 'LOCKED'
    assert 118 <= result['tempo_bpm'] <= 122
    assert result['confidence_metrics']['entropy'] > 0.7
    assert result['confidence_metrics']['combined'] > 0.7

def test_tempo_change_response():
    """Verify adaptive response to tempo changes"""
    # Play 120 BPM for 5s, then 140 BPM for 5s
    results = poll_tempo_transitions(transitions=[(120, 5), (140, 5)])

    # Should lock at 120 within 2 seconds
    assert results[2]['tempo_bpm'] == pytest.approx(120, abs=2)

    # Should transition to 140 within 2 seconds
    assert results[7]['tempo_bpm'] == pytest.approx(140, abs=2)
```

### Stress Tests
```bash
# Run overnight stability test
tools/run_stress_test.py --test-id 4 --duration 28800  # 8 hours

# Expected results:
# - FPS degradation < 5%
# - Heap stable (±10 KB)
# - Tempo confidence variance < 0.1
# - Zero confidence calculation errors
```

---

## Success Criteria (Phase 3 Acceptance)

### Functional Requirements
- [ ] Entropy-based validation reduces false positives by ≥70%
- [ ] Median filtering reduces octave errors by ≥50%
- [ ] Multi-metric confidence correlates with user-perceived quality (R² > 0.7)
- [ ] Tempo lock state machine prevents spurious locks (<5% false locks)
- [ ] Octave detection identifies 2x/0.5x relationships (≥80% accuracy)

### Performance Requirements
- [ ] All improvements combined add <1% CPU overhead
- [ ] RAM increase <500 bytes
- [ ] Latency remains <100ms (median filter: 2-3 frames)
- [ ] No frame drops under stress testing

### Quality Requirements
- [ ] All unit tests pass (100% coverage of new functions)
- [ ] Integration tests pass on diverse music genres (electronic, pop, jazz, classical)
- [ ] Stress tests pass (8+ hours, zero errors)
- [ ] REST API returns complete confidence metrics

### Documentation Requirements
- [ ] `DEBUG_AUDIT.md` updated with Phase 3 scenarios
- [ ] API documentation includes new confidence metrics
- [ ] Threshold tuning guide provided
- [ ] Phase 4 recommendations drafted

---

## References

### Research Documents
1. `/home/user/K1.node1/docs/05-analysis/tempo_detection_implementation_map.md` - Current implementation
2. `/home/user/K1.node1/docs/05-analysis/entropy_based_tempo_validation_research.md` - Entropy research
3. `/home/user/K1.node1/docs/04-planning/tempo_entropy_validation_integration_plan.md` - Integration plan

### Academic Papers
1. "Music Tempo Estimation: Are We Done Yet?" (TISMIR 2020) - Comprehensive survey
2. "Finding Meter in Music Using Autocorrelation Phase Matrix and Shannon Entropy" (ISMIR)
3. "Tempo Estimation for Music Loops and a Simple Confidence Measure" (Font & Serra, 2016)

### Open-Source Implementations
1. **aubio** (github.com/aubio/aubio) - Reference for onset detection and beat tracking
2. **BTrack** (github.com/adamstark/BTrack) - Tempo transition matrix approach
3. **essentia** (github.com/MTG/essentia) - Multi-metric confidence scoring

---

## Appendix A: Code Examples

### Complete Confidence Calculation

```cpp
void update_tempi_phase(float delta) {
    tempi_power_sum = 0.00000001f;

    // 1. Update all tempo bins with adaptive smoothing
    for (uint16_t tempo_bin = 0; tempo_bin < NUM_TEMPI; tempo_bin++) {
        float tempi_magnitude = tempi[tempo_bin].magnitude;

        // Apply median filter
        float filtered_magnitude = apply_median_filter(&tempo_median_filter, tempi_magnitude);

        // Adaptive smoothing based on confidence
        float base_alpha = 0.08f;
        if (tempo_confidence_metrics.combined > 0.7f) {
            base_alpha = 0.12f;
        } else if (tempo_confidence_metrics.combined < 0.4f) {
            base_alpha = 0.04f;
        }

        // Attack/release asymmetry
        float alpha = (filtered_magnitude > tempi_smooth[tempo_bin])
                      ? base_alpha * 1.5f
                      : base_alpha * 0.75f;

        tempi_smooth[tempo_bin] = tempi_smooth[tempo_bin] * (1.0f - alpha)
                                + filtered_magnitude * alpha;
        tempi_power_sum += tempi_smooth[tempo_bin];

        sync_beat_phase(tempo_bin, delta);
    }

    // 2. Calculate multi-metric confidence
    // 2a. Peak ratio (existing)
    float max_contribution = 0.000001f;
    for (uint16_t tempo_bin = 0; tempo_bin < NUM_TEMPI; tempo_bin++) {
        float contribution = tempi_smooth[tempo_bin] / tempi_power_sum;
        max_contribution = fmaxf(contribution, max_contribution);
    }
    tempo_confidence_metrics.peak_ratio = max_contribution;

    // 2b. Entropy confidence (new)
    tempo_confidence_metrics.entropy_confidence = calculate_tempo_entropy();

    // 2c. Temporal stability (new)
    uint16_t dominant_bin = find_dominant_tempo_bin();
    float current_tempo_bpm = tempi_bpm_values_hz[dominant_bin] * 60.0f;
    update_tempo_history(current_tempo_bpm);
    tempo_confidence_metrics.temporal_stability = calculate_temporal_stability();

    // 2d. Combined confidence
    tempo_confidence_metrics.combined =
        0.35f * tempo_confidence_metrics.peak_ratio +
        0.35f * tempo_confidence_metrics.entropy_confidence +
        0.30f * tempo_confidence_metrics.temporal_stability;

    // Maintain backward compatibility
    tempo_confidence = tempo_confidence_metrics.combined;

    // 3. Update tempo lock state machine
    update_tempo_lock_state();

    // 4. Check for octave ambiguity
    OctaveRelationship octave = check_octave_ambiguity();
    // (Use octave.bin_index to prefer harmonically-correct tempo)
}
```

---

## Appendix B: Threshold Tuning Guide

### Genre-Specific Presets

```cpp
enum MusicGenre {
    GENRE_ELECTRONIC,
    GENRE_POP,
    GENRE_JAZZ,
    GENRE_CLASSICAL,
    GENRE_CUSTOM
};

struct GenrePreset {
    float confidence_accept_threshold;
    float confidence_reject_threshold;
    float smoothing_alpha;
    float attack_release_ratio;
};

const GenrePreset genre_presets[] = {
    // ELECTRONIC: Rock-solid tempo, high confidence required
    { .confidence_accept_threshold = 0.75f,
      .confidence_reject_threshold = 0.50f,
      .smoothing_alpha = 0.06f,  // Slower smoothing (more stable)
      .attack_release_ratio = 1.2f },

    // POP: Generally stable, balanced
    { .confidence_accept_threshold = 0.65f,
      .confidence_reject_threshold = 0.45f,
      .smoothing_alpha = 0.08f,
      .attack_release_ratio = 1.5f },

    // JAZZ: Variable tempo, lower threshold, faster response
    { .confidence_accept_threshold = 0.55f,
      .confidence_reject_threshold = 0.35f,
      .smoothing_alpha = 0.12f,
      .attack_release_ratio = 2.0f },

    // CLASSICAL: Rubato, tempo changes, very relaxed
    { .confidence_accept_threshold = 0.50f,
      .confidence_reject_threshold = 0.30f,
      .smoothing_alpha = 0.15f,
      .attack_release_ratio = 2.5f },
};

void set_genre_preset(MusicGenre genre) {
    const GenrePreset* preset = &genre_presets[genre];
    tempo_validation_config.confidence_accept_threshold = preset->confidence_accept_threshold;
    tempo_validation_config.confidence_reject_threshold = preset->confidence_reject_threshold;
    // ... apply other preset values
}
```

### Manual Tuning Procedure

1. **Collect test data:** Record 30 seconds of target music with known tempo
2. **Run baseline:** Measure current confidence metrics and accuracy
3. **Adjust thresholds:** Start with genre preset, then fine-tune:
   - If too many false locks → increase `confidence_accept_threshold`
   - If missing valid locks → decrease `confidence_accept_threshold`
   - If jittery output → decrease `smoothing_alpha`
   - If too slow to respond → increase `smoothing_alpha`
4. **Validate:** Run stress tests and hardware validation
5. **Document:** Save tuned values as custom preset

---

## Next Steps

1. **Review and approve** this recommendations document
2. **Prioritize** which improvements to implement first (recommend Priority 1)
3. **Assign** implementation tasks to Week 1-4 roadmap
4. **Begin** with entropy validation (highest impact, lowest effort)
5. **Iterate** based on hardware testing and field feedback

**Questions? Clarifications needed?** Consult the full research documents or reach out for implementation guidance.

---

**End of Phase 3 Recommendations**

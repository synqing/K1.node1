---
Title: Tempo Migration Failure Analysis - Emotiscope to K1.node1
Owner: Claude (Comparative Analysis)
Date: 2025-11-14
Status: completed
Scope: Root cause analysis of tempo detection failure after migration from Emotiscope
Related:
  - docs/05-analysis/K1NAnalysis_INVESTIGATION_BEAT_DETECTION_RATE_LIMITING_v1.0_20251114.md
  - docs/05-analysis/K1NAnalysis_ANALYSIS_TEMPO_DETECTION_FORENSIC_v1.0_20251108.md
  - docs/05-analysis/K1NAnalysis_FORENSIC_EMOTISCOPE_SENSORYBRIDGE_ANALYSIS_v1.0_20251110.md
  - firmware/src/audio/tempo.cpp
  - firmware/src/audio/validation/tempo_validation.cpp
Tags: tempo-detection, migration-failure, emotiscope, phase-3-validation, root-cause-analysis
---

# Tempo Migration Failure Analysis: Emotiscope → K1.node1

## Executive Summary

The tempo detection system was migrated from Emotiscope 2.0 (working, validated) to K1.node1 (broken, disabled in commit 5e5101d). The migration introduced **multiple subtle changes** that collectively caused the confidence metric to oscillate between 0.13-0.17 (random walk) instead of providing meaningful beat detection.

### Root Cause

**The migration was NOT verbatim.** Three critical changes were made:

1. **NUM_TEMPI reduced**: 96 bins → 64 bins (33% reduction)
2. **Magnitude scaling weakened**: x³ (cubic) → x² (quadratic) for "better sensitivity"
3. **Phase 3 validation added**: Multi-metric confidence with **temporal_stability false floor**

**Result:** Phase 3's temporal_stability (initialized to 0.5 neutral) contributes a constant **0.15 baseline** to combined confidence via 30% weighting, masking the true peak_ratio of ~0.0156. This creates the observed 0.13-0.17 oscillation instead of revealing that tempo detection is fundamentally failing to discriminate beats.

---

## 1. Comparison: Emotiscope (Working) vs K1.node1 (Broken)

### 1.1 Configuration Differences

| Parameter | Emotiscope | K1.node1 | Impact |
|-----------|------------|----------|--------|
| **NUM_TEMPI** | 96 bins | 64 bins | Fewer bins = coarser resolution |
| **Tempo Range** | 60-156 BPM | 32-192 BPM | Wider range in K1.node1 |
| **Magnitude Scaling** | x³ (cubic) | x² (quadratic) | Weaker dynamic range compression |
| **Smoothing Alpha** | 0.975 (2.5% new) | 0.08-0.15 adaptive | K1.node1 much faster attack |
| **Stride Processing** | 2 bins/frame | 8 bins/frame | K1.node1 4× faster sweep |
| **Confidence Calc** | Single metric (max_contribution) | **Multi-metric Phase 3** | Added complexity |

### 1.2 Algorithm Comparison

**EMOTISCOPE (tempo.h:417-446):**
```cpp
void update_tempi_phase(float delta) {
    tempi_power_sum = 0.00000001;

    // Smooth and accumulate
    for (uint16_t tempo_bin = 0; tempo_bin < NUM_TEMPI; tempo_bin++) {
        float tempi_magnitude = tempi[tempo_bin].magnitude;

        // CUBIC SCALING APPLIED HERE (line 225)
        tempi_smooth[tempo_bin] = tempi_smooth[tempo_bin] * 0.975 + (tempi_magnitude) * 0.025;
        tempi_power_sum += tempi_smooth[tempo_bin];

        sync_beat_phase(tempo_bin, delta);
    }

    // Calculate confidence (max contribution)
    float max_contribution = 0.000001;
    for (uint16_t tempo_bin = 0; tempo_bin < NUM_TEMPI; tempo_bin++) {
        max_contribution = max(
            tempi_smooth[tempo_bin] / tempi_power_sum,
            max_contribution
        );
    }

    tempo_confidence = max_contribution;  // SIMPLE ASSIGNMENT
}
```

**K1.NODE1 (tempo.cpp:347-391 + tempo_validation.cpp:191-212):**
```cpp
void update_tempi_phase(float delta) {
    tempi_power_sum = 0.00000001f;

    for (uint16_t tempo_bin = 0; tempo_bin < NUM_TEMPI; tempo_bin++) {
        float tempi_magnitude = tempi[tempo_bin].magnitude;  // QUADRATIC SCALING (line 216)

        // PHASE 3: Median filter + adaptive smoothing
        float filtered_magnitude = apply_median_filter(&tempo_median_filter, tempi_magnitude);
        float confidence = tempo_confidence_metrics.combined;
        float alpha = calculate_adaptive_alpha(filtered_magnitude, tempi_smooth[tempo_bin], confidence);

        tempi_smooth[tempo_bin] = tempi_smooth[tempo_bin] * (1.0f - alpha) + filtered_magnitude * alpha;
        tempi_power_sum += tempi_smooth[tempo_bin];

        sync_beat_phase(tempo_bin, delta);
    }

    // PHASE 3: Multi-metric confidence
    update_confidence_metrics(tempi_smooth, NUM_TEMPI, tempi_power_sum);

    // Uses complex weighted average (see below)
    tempo_confidence = tempo_confidence_metrics.combined;
}
```

**K1.NODE1 PHASE 3 CONFIDENCE (tempo_validation.cpp:191-212):**
```cpp
void update_confidence_metrics(const float* tempi_smooth, uint16_t num_tempi, float tempi_power_sum) {
    // 1. Peak ratio (ORIGINAL EMOTISCOPE METRIC)
    float max_contribution = 0.000001f;
    for (uint16_t i = 0; i < num_tempi; i++) {
        float contribution = tempi_smooth[i] / tempi_power_sum;
        max_contribution = fmaxf(contribution, max_contribution);
    }
    tempo_confidence_metrics.peak_ratio = max_contribution;  // ~0.0156 with 64 uniform bins

    // 2. Entropy confidence (NEW - Phase 3)
    tempo_confidence_metrics.entropy_confidence = calculate_tempo_entropy(tempi_smooth, num_tempi, tempi_power_sum);

    // 3. Temporal stability (NEW - Phase 3)
    tempo_confidence_metrics.temporal_stability = calculate_temporal_stability();  // STARTS AT 0.5!

    // 4. WEIGHTED AVERAGE (THE PROBLEM)
    tempo_confidence_metrics.combined =
        0.35f * tempo_confidence_metrics.peak_ratio +         // ~0.0055 contribution
        0.35f * tempo_confidence_metrics.entropy_confidence + // ~0.0 for uniform
        0.30f * tempo_confidence_metrics.temporal_stability;  // ~0.15 FALSE FLOOR ⚠️
}
```

---

## 2. The False Floor Problem

### 2.1 Confidence Breakdown (Uniform Distribution Case)

When all 64 tempo bins are roughly equal (the identified failure mode):

| Metric | Value | Calculation | Contribution to Combined |
|--------|-------|-------------|--------------------------|
| **peak_ratio** | 0.0156 | 1/64 = 0.0156 | 0.35 × 0.0156 = **0.0055** |
| **entropy_confidence** | 0.0 | 1.0 - (6.0/6.0) = 0.0 (uniform) | 0.35 × 0.0 = **0.0** |
| **temporal_stability** | 0.5 | Neutral start (not enough data) | 0.30 × 0.5 = **0.15** ⚠️ |
| **COMBINED** | **0.155** | Sum of contributions | **0.13-0.17 range** |

**Observed Behavior (from forensic analysis):**
> "Tempo confidence oscillates between 0.13-0.17 (random walk), indicating the Goertzel beat detection is not reliably identifying coherent beat patterns."

**Root Cause Identified:**
The 0.13-0.17 range is NOT random - it's the **0.15 false floor from temporal_stability** plus noise from the tiny peak_ratio contribution (~0.005-0.020 depending on which bin happens to be slightly higher).

### 2.2 Why Emotiscope Worked

**Emotiscope's Single Metric:**
```cpp
tempo_confidence = max_contribution;  // Direct assignment
```

**With 96 bins (uniform distribution):**
- tempo_confidence = 1/96 = **0.0104** (1.04%)

**With real music (one dominant tempo):**
- Example: Bin 42 has 60% of power, rest distributed
- tempo_confidence = 0.60 = **60%** (clear signal!)

**Dynamic Range:** 0.0104 (noise floor) to 0.60+ (strong beat) = **58× range**

**K1.node1's Multi-Metric (uniform distribution):**
- combined = 0.155 (false floor from temporal_stability)

**K1.node1's Multi-Metric (strong beat):**
- peak_ratio = 0.60
- entropy_confidence = 0.95 (low entropy = good)
- temporal_stability = 0.85 (stable over time)
- combined = 0.35 × 0.60 + 0.35 × 0.95 + 0.30 × 0.85 = 0.21 + 0.33 + 0.26 = **0.80**

**Dynamic Range:** 0.155 (false floor) to 0.80 (strong beat) = **5.2× range**

**Impact:** K1.node1's Phase 3 validation **reduces dynamic range by 11×** (58× → 5.2×) by introducing a false floor!

---

## 3. Critical Migration Changes (Non-Verbatim)

### 3.1 Change #1: NUM_TEMPI Reduction (96 → 64)

**File:** `firmware/src/audio/goertzel.h:53`

**Emotiscope:**
```cpp
#define NUM_TEMPI (96)  // global_defines.h:31
```

**K1.node1:**
```cpp
#define NUM_TEMPI 64
```

**Rationale (Inferred):** Memory savings (96 × 56 bytes = 5.4 KB → 64 × 56 bytes = 3.6 KB saved)

**Impact:**
- **Resolution**: 96 bins over 60-156 BPM = 1 BPM/bin → 64 bins over 32-192 BPM = 2.5 BPM/bin
- **Noise Floor**: 1/96 = 1.04% → 1/64 = 1.56% (50% higher baseline)
- **Tempo Range**: Wider (32-192 vs 60-156) but coarser binning

**Verdict:** This change ALONE would not break tempo detection, but it raises the noise floor.

---

### 3.2 Change #2: Magnitude Scaling Weakened (x³ → x²)

**File:** `firmware/src/audio/tempo.cpp:216-217`

**Emotiscope (light_modes/active/hype.h confirms original used cubic):**
```cpp
// After normalization (0.0-1.0), apply cubic compression
tempi[i].magnitude = scaled_magnitude * scaled_magnitude * scaled_magnitude;  // x³
```

**K1.node1:**
```cpp
// Comment at line 216: "Reduced from cubic (x³) to quadratic (x²) for better sensitivity at low levels"
float squared = scaled_magnitude * scaled_magnitude;  // x²
tempi[i].magnitude = squared;
```

**Mathematical Impact:**

| Input (normalized) | x² (K1.node1) | x³ (Emotiscope) | Ratio (x²/x³) |
|-------------------|---------------|-----------------|---------------|
| 0.1 | 0.01 | 0.001 | **10× stronger** |
| 0.3 | 0.09 | 0.027 | **3.3× stronger** |
| 0.5 | 0.25 | 0.125 | **2× stronger** |
| 0.7 | 0.49 | 0.343 | 1.4× stronger |
| 1.0 | 1.00 | 1.000 | 1× (same) |

**Effect:** K1.node1 amplifies weak signals (0.1-0.5 range) **2-10× more** than Emotiscope. This was intended to improve "sensitivity at low levels" but has unintended consequences:

1. **Reduces dynamic range** between strong and weak bins
2. **All bins become more similar** in magnitude after scaling
3. **Harder to discriminate** dominant tempo from noise

**Verdict:** This change contributes to the uniform distribution problem by compressing dynamic range.

---

### 3.3 Change #3: Phase 3 Validation Added

**Files:**
- `firmware/src/audio/validation/tempo_validation.h` (NEW - 194 lines)
- `firmware/src/audio/validation/tempo_validation.cpp` (NEW - 400+ lines)

**Components Added:**
1. **Median Filter (3-point)**: Outlier rejection on tempo magnitudes
2. **Adaptive Smoothing**: Alpha varies based on confidence (0.06-0.15 range)
3. **Entropy Confidence**: Shannon entropy calculation (mathematically correct)
4. **Temporal Stability**: Tracks BPM variance over last 16 samples
5. **Tempo Lock State Machine**: UNLOCKED → LOCKING → LOCKED → DEGRADING transitions
6. **Genre Presets**: Electronic/Pop/Jazz/Classical with different thresholds

**Problem Component: Temporal Stability (tempo_validation.cpp:155-185)**

```cpp
float calculate_temporal_stability() {
    if (tempo_stability.history_filled < 5) {
        return 0.5f;  // ⚠️ NOT ENOUGH DATA YET, RETURN NEUTRAL
    }

    // Calculate variance of last N BPM estimates
    float mean = ...; // Average BPM
    float variance = ...; // Variance calculation
    float std_dev = sqrtf(variance);

    // Convert to confidence: low variance = high stability
    // Typical std_dev ranges: 0-5 BPM
    // Formula: stability = 1.0 / (1.0 + std_dev)
    float stability = 1.0f / (1.0f + std_dev);

    return stability;  // Range: ~0.17 (std_dev=5) to ~0.91 (std_dev=0.1)
}
```

**Initialization (tempo_validation.cpp:51-75):**
```cpp
void init_tempo_validation() {
    // ...
    tempo_confidence_metrics.temporal_stability = 0.5f;  // ⚠️ NEUTRAL START
    // ...
}
```

**The False Floor:**
- Temporal stability starts at **0.5** (neutral)
- Weighted at **30%** in combined confidence
- Contributes **0.30 × 0.5 = 0.15** to combined confidence
- Even when peak_ratio = 0.0156 (uniform bins), combined ≈ 0.15
- **This masks the true failure!**

**Why This is Wrong:**

In Emotiscope, `tempo_confidence = 0.01` clearly signals "no beat detected."
In K1.node1, `tempo_confidence = 0.15` looks like "weak but plausible beat" when it's actually "complete failure + false floor."

---

## 4. Additional Divergences (Minor)

### 4.1 Smoothing Alpha

**Emotiscope:** Fixed `alpha = 0.025` (2.5% new, 97.5% history)

**K1.node1:** Adaptive alpha based on confidence
```cpp
// tempo_validation.cpp:270-285 (inferred from code structure)
float calculate_adaptive_alpha(float new_magnitude, float smooth_magnitude, float confidence) {
    float base_alpha = tempo_validation_config.smoothing_alpha_base;  // 0.06-0.15 depending on genre

    if (new_magnitude > smooth_magnitude) {
        // Attack: faster response when magnitude rising
        return base_alpha * tempo_validation_config.attack_multiplier;  // 1.2-2.5×
    } else {
        // Release: slower response when magnitude falling
        return base_alpha * tempo_validation_config.release_multiplier;  // 0.4-1.0×
    }
}
```

**Impact:**
- K1.node1 responds **2-6× faster** to changes (0.06-0.15 vs 0.025)
- Adaptive attack/release adds complexity
- **Faster response amplifies noise** in the uniform distribution case

---

### 4.2 Stride Processing

**Emotiscope:** 2 bins per frame (alternating)
```cpp
if(iter % 2 == 0){
    calculate_tempi_magnitudes(calc_bin+0);
} else{
    calculate_tempi_magnitudes(calc_bin+1);
}
calc_bin+=2;
```

**K1.node1:** 8 bins per frame (parallel)
```cpp
const uint16_t stride = 8;  // bins per frame
for (uint16_t k = 0; k < stride; ++k) {
    uint16_t bin = calc_bin + k;
    if (bin >= max_bin) break;
    calculate_tempi_magnitudes((int16_t)bin);
}
calc_bin = (uint16_t)(calc_bin + stride);
```

**Impact:**
- K1.node1 sweeps full 64 bins in **8 frames** (80ms @ 100Hz)
- Emotiscope sweeps full 96 bins in **48 frames** (480ms @ 100Hz)
- K1.node1 is **6× faster** but updates each bin **less frequently**

---

## 5. The Sqrt(Sqrt()) Misconception

### 5.1 Forensic Analysis Claim

From `K1NAnalysis_FORENSIC_EMOTISCOPE_SENSORYBRIDGE_ANALYSIS_v1.0_20251110.md:64`:

> "Tracks tempo confidence as sqrt(sqrt(tempo_power_sum)) - perceptual weighting"

**This is INCORRECT.** The `sqrt(sqrt())` pattern is used in **patterns**, not in tempo calculation.

### 5.2 Actual Usage

**Emotiscope Hype Pattern (light_modes/active/hype.h:23-26):**
```cpp
float beat_color_odd  = beat_sum_odd;
float beat_color_even = beat_sum_even;
beat_sum_odd  = sqrt(sqrt(beat_color_odd));   // PERCEPTUAL SCALING FOR VISUALS
beat_sum_even = sqrt(sqrt(beat_color_even));

float strength = sqrt(tempo_confidence);  // ALSO VISUAL SCALING (line 26)
```

**Purpose:** Fourth-root (x^0.25) compresses dynamic range for human visual perception.

**Emotiscope Spectronome Pattern (light_modes/active/spectronome.h:6):**
```cpp
scale_CRGBF_array_by_constant(leds, (1.0 - sqrt(sqrt(tempo_confidence)))*0.85 + 0.15, NUM_LEDS);
```

**Clarity:** `sqrt(sqrt())` is a **pattern-level visual transform**, not part of the core tempo detection algorithm.

---

## 6. Corrected Migration Path

### 6.1 What Should Have Been Migrated (Verbatim)

```cpp
// VERBATIM EMOTISCOPE TEMPO CONFIDENCE (tempo.h:417-446)
void update_tempi_phase(float delta) {
    tempi_power_sum = 0.00000001;

    for (uint16_t tempo_bin = 0; tempo_bin < NUM_TEMPI; tempo_bin++) {
        float tempi_magnitude = tempi[tempo_bin].magnitude;  // PRE-SCALED WITH CUBIC
        tempi_smooth[tempo_bin] = tempi_smooth[tempo_bin] * 0.975 + (tempi_magnitude) * 0.025;
        tempi_power_sum += tempi_smooth[tempo_bin];
        sync_beat_phase(tempo_bin, delta);
    }

    // Simple max contribution metric
    float max_contribution = 0.000001;
    for (uint16_t tempo_bin = 0; tempo_bin < NUM_TEMPI; tempo_bin++) {
        max_contribution = max(
            tempi_smooth[tempo_bin] / tempi_power_sum,
            max_contribution
        );
    }

    tempo_confidence = max_contribution;  // DIRECT ASSIGNMENT, NO MULTI-METRIC
}
```

**Key Requirements:**
1. ✅ NUM_TEMPI = 96 (original resolution)
2. ✅ Cubic magnitude scaling (x³, not x²)
3. ✅ Fixed smoothing alpha = 0.025 (slow, stable)
4. ✅ Simple max_contribution confidence (no multi-metric)
5. ✅ 2-bin stride processing (original cadence)

---

### 6.2 What Was Actually Migrated (Broken)

```cpp
// K1.NODE1 ACTUAL IMPLEMENTATION (BROKEN)
void update_tempi_phase(float delta) {
    tempi_power_sum = 0.00000001f;

    for (uint16_t tempo_bin = 0; tempo_bin < NUM_TEMPI; tempo_bin++) {  // ⚠️ 64 bins, not 96
        float tempi_magnitude = tempi[tempo_bin].magnitude;  // ⚠️ QUADRATIC scaled, not cubic

        // ⚠️ PHASE 3 ADDITIONS (NON-VERBATIM)
        float filtered_magnitude = apply_median_filter(&tempo_median_filter, tempi_magnitude);
        float alpha = calculate_adaptive_alpha(...);  // ⚠️ ADAPTIVE, not fixed 0.025

        tempi_smooth[tempo_bin] = tempi_smooth[tempo_bin] * (1.0f - alpha) + filtered_magnitude * alpha;
        tempi_power_sum += tempi_smooth[tempo_bin];
        sync_beat_phase(tempo_bin, delta);
    }

    // ⚠️ MULTI-METRIC CONFIDENCE (NON-VERBATIM)
    update_confidence_metrics(tempi_smooth, NUM_TEMPI, tempi_power_sum);
    tempo_confidence = tempo_confidence_metrics.combined;  // ⚠️ NOT max_contribution
}
```

**Deviations from Verbatim Migration:**
1. ❌ NUM_TEMPI = 64 (should be 96)
2. ❌ Quadratic magnitude scaling (should be cubic)
3. ❌ Adaptive smoothing alpha (should be fixed 0.025)
4. ❌ Multi-metric confidence with false floor (should be simple max_contribution)
5. ⚠️ 8-bin stride (debatable optimization, but changes behavior)

---

## 7. Recommended Fixes

### 7.1 Option 1: Pure Verbatim Migration (Safest)

**Objective:** Restore exact Emotiscope behavior to prove it works in K1.node1.

**Changes:**
1. Restore NUM_TEMPI = 96
2. Restore cubic magnitude scaling (x³)
3. Restore fixed smoothing alpha = 0.025 (remove adaptive)
4. Remove Phase 3 validation entirely
5. Restore tempo_confidence = max_contribution (direct assignment)
6. Restore 2-bin stride processing

**Expected Result:** tempo_confidence behaves identically to Emotiscope (0.01-0.60 range).

**Validation:**
- Run against known test audio (electronic music @ 120 BPM)
- Compare confidence values to Emotiscope logs
- Verify patterns (hype, spectronome) work as in Emotiscope

**Risk:** Low. This is a known-good configuration.

---

### 7.2 Option 2: Fix Phase 3 False Floor (Moderate)

**Objective:** Keep Phase 3 enhancements but remove the false floor.

**Changes:**
1. Change temporal_stability initialization from 0.5 to **0.0** (no data = no confidence)
2. OR remove temporal_stability from combined confidence calculation
3. Adjust weights: 50% peak_ratio, 50% entropy_confidence (no temporal component)

**Modified Calculation:**
```cpp
tempo_confidence_metrics.combined =
    0.50f * tempo_confidence_metrics.peak_ratio +
    0.50f * tempo_confidence_metrics.entropy_confidence;
// Removed: 0.30f * tempo_confidence_metrics.temporal_stability
```

**Expected Result:**
- Uniform distribution: combined = 0.5 × 0.0156 + 0.5 × 0.0 = **0.0078** (true noise floor)
- Strong beat: combined = 0.5 × 0.60 + 0.5 × 0.95 = **0.775** (strong signal)
- Dynamic range: 100× (vs 58× in Emotiscope, 5.2× current broken)

**Risk:** Medium. Phase 3 logic is complex; removing one component may have side effects.

---

### 7.3 Option 3: Hybrid (Best of Both)

**Objective:** Keep Emotiscope's proven core, add Phase 3 as optional enhancement.

**Changes:**
1. Restore NUM_TEMPI = 96 (memory allows it)
2. Restore cubic magnitude scaling (x³)
3. Keep adaptive smoothing BUT lower base alpha to 0.025-0.050 range
4. Keep entropy_confidence (it's mathematically sound)
5. **Remove temporal_stability** from combined (false floor source)
6. Use two-metric confidence: `combined = 0.6 * peak_ratio + 0.4 * entropy_confidence`

**Expected Result:**
- Preserves Emotiscope's strong dynamic range (cubic scaling + 96 bins)
- Entropy adds validation (rejects ambiguous signals)
- No false floor (temporal_stability removed)
- Adaptive smoothing provides genre flexibility

**Risk:** Low-Medium. Conservative changes to proven baseline.

---

## 8. Testing Protocol

### 8.1 Test Audio Corpus

**Required Test Cases:**
1. **Electronic (120 BPM, rock-solid beat)** - Expect confidence >0.6
2. **Jazz (Variable 80-180 BPM)** - Expect confidence 0.3-0.5 with variance
3. **Classical (Rubato, no steady beat)** - Expect confidence <0.2
4. **Silence** - Expect confidence ~0.01 (noise floor)
5. **White Noise** - Expect confidence ~0.01 (uniform distribution)

### 8.2 Success Criteria

**For Option 1 (Verbatim Migration):**
- Electronic: confidence >0.50 and stable (σ < 0.05)
- Jazz: confidence >0.30 with natural variance (σ 0.05-0.15)
- Classical: confidence <0.25 (recognizes absence of steady beat)
- Silence/Noise: confidence <0.05 (clear noise floor)

**For Option 2/3 (Fixed Phase 3):**
- Same criteria as Option 1
- PLUS: tempo lock state machine transitions correctly (UNLOCKED → LOCKING → LOCKED)

### 8.3 Regression Prevention

**Document Exact Configuration:**
```cpp
// In tempo.h or configuration file
#define TEMPO_CONFIG_VALIDATED 1
#define NUM_TEMPI 96  // DO NOT CHANGE - validated with Emotiscope corpus
#define TEMPO_MAGNITUDE_POWER 3  // Cubic scaling - DO NOT CHANGE
#define TEMPO_SMOOTHING_ALPHA 0.025f  // DO NOT CHANGE without full test suite
```

**Add Unit Tests:**
1. Test uniform distribution → expect confidence ~0.01
2. Test single strong bin → expect confidence >0.60
3. Test two equal bins → expect confidence ~0.50
4. Test gradual transitions → expect smooth confidence curve

---

## 9. Conclusion

### 9.1 Migration Failure Summary

The Emotiscope → K1.node1 tempo migration failed due to **three compounding non-verbatim changes**:

1. **Reduced bins** (96 → 64): 50% higher noise floor
2. **Weakened scaling** (x³ → x²): Compressed dynamic range by 2-10× at low levels
3. **Phase 3 false floor**: temporal_stability contributes constant 0.15 baseline

**Combined Effect:** Masked the true confidence failure (0.0156) with false floor (0.13-0.17), preventing detection of the underlying problem.

### 9.2 Root Cause

**The migration was NOT verbatim.** Well-intentioned "improvements" (better sensitivity, multi-metric validation) introduced subtle bugs that broke a working system.

**Lesson Learned:** When migrating validated code:
1. **First**: Migrate verbatim and prove it works
2. **Then**: Add enhancements one at a time with validation
3. **Never**: Bundle multiple changes without regression testing

### 9.3 Recommended Path Forward

**Immediate (Week 1):**
1. Implement Option 1 (Pure Verbatim Migration) on a feature branch
2. Run full test corpus and compare to Emotiscope logs
3. Document exact matching behavior

**Short-term (Week 2-3):**
4. Once verbatim works, selectively re-add Phase 3 components
5. Start with entropy_confidence (mathematically sound)
6. Validate each addition against test corpus before proceeding

**Long-term:**
7. Document configuration as "validated" with DO NOT CHANGE warnings
8. Add unit tests for confidence calculation edge cases
9. Create regression test suite with real audio files

---

## 10. Appendices

### Appendix A: Code Location Reference

| Component | Emotiscope | K1.node1 |
|-----------|------------|----------|
| NUM_TEMPI | global_defines.h:31 | goertzel.h:53 |
| Tempo Range | global_defines.h | tempo.h:27-28 |
| Magnitude Scaling | tempo.h:225 | tempo.cpp:216-217 |
| Smoothing Alpha | tempo.h:430 | tempo_validation.cpp:270+ |
| Confidence Calc | tempo.h:437-445 | tempo_validation.cpp:191-212 |
| Phase Sync | tempo.h:385-414 | tempo.cpp:334-345 |

### Appendix B: Numerical Examples

**Emotiscope Confidence (96 bins, cubic scaling, uniform):**
```
max_contribution = 1/96 = 0.0104
tempo_confidence = 0.0104  (direct assignment)
```

**Emotiscope Confidence (96 bins, cubic scaling, 60% dominant):**
```
max_contribution = 0.60
tempo_confidence = 0.60  (direct assignment)
```

**K1.node1 Confidence (64 bins, quadratic scaling, uniform):**
```
peak_ratio = 1/64 = 0.0156
entropy_confidence = 0.0 (uniform distribution)
temporal_stability = 0.5 (neutral start)
combined = 0.35*0.0156 + 0.35*0.0 + 0.30*0.5 = 0.155
```

**K1.node1 Confidence (64 bins, quadratic scaling, 60% dominant):**
```
peak_ratio = 0.60
entropy_confidence = 0.95 (low entropy)
temporal_stability = 0.85 (stable)
combined = 0.35*0.60 + 0.35*0.95 + 0.30*0.85 = 0.80
```

**Dynamic Range Comparison:**
- Emotiscope: 0.0104 to 0.60 = **58× range**
- K1.node1: 0.155 to 0.80 = **5.2× range** (11× worse)

---

**Document Status:** ✅ COMPLETED
**Validation:** Cross-referenced with Emotiscope source (emotiscope_src.bak) and K1.node1 implementation
**Next Steps:** Implement Option 1 (Verbatim Migration) for validation
**Last Updated:** 2025-11-14

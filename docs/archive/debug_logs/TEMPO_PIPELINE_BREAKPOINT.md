# Tempo Detection Pipeline - Breakpoint Summary

## THE EXACT BREAK POINT

`tempo_confidence` stays at 0.0 because `tempi[].magnitude` never becomes non-zero.

### Why?

The Goertzel beat detection filter in `calculate_magnitude_of_tempo()` (tempo.cpp:135-167) is **receiving valid input** but there is **strong evidence of zero-magnitude output**.

---

## STEP-BY-STEP TRACE (WHAT SHOULD HAPPEN vs WHAT IS)

### ✓ STAGE 1: Audio Acquisition (WORKING)
**Location:** `acquire_sample_chunk()` → fills `sample_history[4096]`

**Status:** Works
- VU meter responds → audio flowing
- Spectrum visible → Goertzel producing frequency data
- Evidence: All downstream steps see valid data from here

---

### ✓ STAGE 2: Frequency Goertzel (WORKING)
**Location:** `calculate_magnitudes()` (goertzel.cpp:403)

**Result:** `spectrogram[64]` populated with 0.0-1.0 values per frequency bin

**Status:** Works
- VU uses this data ✓
- Chromagram uses this data ✓
- Patterns can see spectrum ✓

---

### ✓ STAGE 3: Novelty Calculation (LIKELY WORKING)
**Location:** `update_novelty()` (tempo.cpp:286-314)

**Result:** `novelty_curve[1024]` populated with log-scaled onset values

```cpp
float novelty = fmaxf(0.0f, new_mag - frequencies_musical[i].magnitude_last);
log_novelty(logf(1.0f + current_novelty));
```

**Status:** Should work (same pattern as frequency Goertzel)
- Called every 20ms ✓
- Array populated ✓
- Log prevents neg values ✓

---

### ✓ STAGE 4: Novelty Normalization (LIKELY WORKING)
**Location:** `normalize_novelty_curve()` (tempo.cpp:207-224)

**Result:** `novelty_curve_normalized[1024]` scaled to auto-ranged values

**Status:** Should work
- Decay + peak tracking ✓
- Auto-scale calculation ✓
- Range: 0.0-1.0 ✓

---

### ⚠️ STAGE 5: TEMPO GOERTZEL FILTER (SUSPECTED BROKEN)
**Location:** `calculate_magnitude_of_tempo()` (tempo.cpp:135-167)

**What happens:**
```cpp
// Input: novelty_curve_normalized[block_size samples]
for (uint32_t i = 0; i < block_size; i++) {
    float sample_novelty = novelty_curve_normalized[((NOVELTY_HISTORY_LENGTH - 1) - block_size) + i];

    // Goertzel IIR filter
    float q0 = tempi[tempo_bin].coeff * q1 - q2 + (sample_novelty * window_lookup[...]);
    q2 = q1;
    q1 = q0;
}

// Output calculation
float magnitude_squared = (q1 * q1) + (q2 * q2) - q1 * q2 * tempi[tempo_bin].coeff;
float magnitude = sqrtf(fmaxf(magnitude_squared, 0.0f));
normalized_magnitude = magnitude / (block_size / 2.0f);
tempi[tempo_bin].magnitude_full_scale = normalized_magnitude;
```

**Expected Result:** Non-zero magnitude values for each tempo bin

**Actual Result:** Apparently all zeros or near-zero

**Reason Unknown (Needs Instrumentation):** One of:
1. `novelty_curve_normalized[]` is all zeros → input to Goertzel is zero
2. Goertzel window function `window_lookup[]` is all zeros → windowing kills signal
3. Goertzel coefficient calculation error → filter produces zero output
4. Window indexing error → reading wrong part of array

---

### ✗ STAGE 6: Auto-Ranging (FAILS AS CONSEQUENCE)
**Location:** `calculate_tempi_magnitudes()` (tempo.cpp:169-205)

**What happens:**
```cpp
if (max_val < 0.04f) {
    max_val = 0.04f;  // Floor prevents division by zero
}
float autoranger_scale = 1.0f / max_val;  // Might be 1.0 / 0.04 = 25.0

for (uint16_t i = 0; i < NUM_TEMPI; i++) {
    float scaled_magnitude = tempi[i].magnitude_full_scale * autoranger_scale;
    // If magnitude_full_scale is 0.0:
    // scaled_magnitude = 0.0 * 25.0 = 0.0

    float squared = scaled_magnitude * scaled_magnitude;
    tempi[i].magnitude = squared;  // Still 0.0
}
```

**Result:** `tempi[].magnitude` stays at 0.0

---

### ✗ STAGE 7: Smoothing & Confidence (FAILS AS CONSEQUENCE)
**Location:** `update_tempi_phase()` (tempo.cpp:329-348)

**What happens:**
```cpp
for (uint16_t tempo_bin = 0; tempo_bin < NUM_TEMPI; tempo_bin++) {
    float tempi_magnitude = tempi[tempo_bin].magnitude;  // 0.0

    tempi_smooth[tempo_bin] = tempi_smooth[tempo_bin] * 0.92f + tempi_magnitude * 0.08f;
    //                        = tempi_smooth[tempo_bin] * 0.92f + 0.0 * 0.08f
    //                        = tempi_smooth[tempo_bin] * 0.92f
    // Exponential decay toward 0!

    tempi_power_sum += tempi_smooth[tempo_bin];
}

float max_contribution = 0.000001f;
for (uint16_t tempo_bin = 0; tempo_bin < NUM_TEMPI; tempo_bin++) {
    float contribution = tempi_smooth[tempo_bin] / tempi_power_sum;
    max_contribution = fmaxf(contribution, max_contribution);
}

tempo_confidence = max_contribution;  // ≈ 0.0000001
```

**Result:** `tempo_confidence` → 0.0 (exactly what we observe!)

---

## ROOT CAUSE: STAGE 5 FAILURE

The Goertzel beat detection filter (`calculate_magnitude_of_tempo`) is producing zero (or near-zero) magnitudes.

### Most Likely Cause: Zero Input

If `novelty_curve_normalized[i]` contains all zeros or very small values, then:
- Goertzel receives zero signal
- q1 and q2 stay near zero
- magnitude = sqrt(0) = 0
- Result: `tempo_confidence = 0.0`

### Why Would novelty_curve_normalized Be Zero?

**Hypothesis 1: Initialization Issue**
- `novelty_curve[]` starts as {0}
- First frames: current_novelty might be very small
- Normalization uses floating-point decay
- Possible: Never accumulates enough signal

**Hypothesis 2: Array Index Error**
- Line in calculate_magnitude_of_tempo (tempo.cpp:146):
  ```cpp
  float sample_novelty = novelty_curve_normalized[((NOVELTY_HISTORY_LENGTH - 1) - block_size) + i];
  ```
- If `block_size` is very large → reads early part of array (old data)
- Or: Index calculation off-by-one → reads uninitialized memory

**Hypothesis 3: Novelty Calculation Error**
- In update_novelty() (tempo.cpp:298-305):
  ```cpp
  for (uint16_t i = 0; i < NUM_FREQS; i++) {
      float new_mag = spectrogram_smooth[i];
      float novelty = fmaxf(0.0f, new_mag - frequencies_musical[i].magnitude_last);
      frequencies_musical[i].novelty = novelty;
      frequencies_musical[i].magnitude_last = new_mag;
      current_novelty += novelty;
  }
  current_novelty /= static_cast<float>(NUM_FREQS);
  ```
- If novelty values are very small → current_novelty might be 0.0
- Then `logf(1.0f + 0.0f) = logf(1.0f) = 0.0`
- No onset detected → no novelty signal

---

## VERIFICATION NEEDED

To confirm which stage breaks, add logging:

### Test 1: Is novelty_curve populated?
```cpp
// In update_novelty(), after log_novelty():
if (t_now_ms % 500 == 0) {
    float last_novelty = novelty_curve[NOVELTY_HISTORY_LENGTH - 1];
    LOG_INFO(TAG_TEMPO, "Novelty curve[1023]=%f", last_novelty);
}
```

### Test 2: Is novelty_curve_normalized populated?
```cpp
// In update_tempo(), before calculate_tempi_magnitudes():
static uint32_t log_count = 0;
if (++log_count % 50 == 0) {
    float last_norm = novelty_curve_normalized[NOVELTY_HISTORY_LENGTH - 1];
    LOG_INFO(TAG_TEMPO, "Normalized novelty[1023]=%f", last_norm);
}
```

### Test 3: Do Goertzel filters produce non-zero output?
```cpp
// In calculate_magnitude_of_tempo(), after magnitude calculation:
if (tempo_bin % 8 == 0) {
    LOG_DEBUG(TAG_TEMPO, "Goertzel bin %d: mag_full_scale=%f",
              tempo_bin, normalized_magnitude);
}
```

### Test 4: Are tempo bin magnitudes auto-scaled?
```cpp
// In calculate_tempi_magnitudes(), after loop:
LOG_INFO(TAG_TEMPO, "Max magnitude: full_scale=%f, scaled=%f",
         max_val, (max_val < 0.04f) ? 0.04f : max_val);
```

---

## INITIALIZATION CALLS (ALL PRESENT ✓)

In `main.cpp` setup():
- Line 612: `init_window_lookup()` ✓
- Line 613: `init_goertzel_constants_musical()` ✓
- Line 620: `init_tempo_goertzel_constants()` ✓

All required data structures are initialized before audio processing starts.

---

## EXECUTION CALLS (ALL PRESENT ✓)

In audio task (`audio_task_core1`, lines 237-274):
- Line 258: `run_vu()` ✓
- Line 261: `update_novelty()` ✓ (logs novelty → novelty_curve)
- Line 265: `update_tempo()` ✓ (calls calculate_tempi_magnitudes)
- Line 274: `update_tempi_phase(delta)` ✓ (computes confidence)

All pipeline functions are called in correct order at correct frequency.

---

## CONCLUSION

**The pipeline is complete and properly initialized.**

**The break point is at Stage 5: Tempo Goertzel Filter producing zero magnitudes.**

**Most likely cause: Either**
1. `novelty_curve_normalized[]` never populates with meaningful values, OR
2. Goertzel coefficient initialization or windowing is broken

**Next step: Add logging at Stage 5 to confirm zero output and identify which sub-stage fails.**

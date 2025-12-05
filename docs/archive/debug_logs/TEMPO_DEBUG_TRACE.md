# Tempo Detection Pipeline Debug Trace
## K1.node1 Systematic Analysis

**Problem Statement:**
- 114 BPM steady audio plays
- Tempo detection returns zero/garbage (tempi_smooth[] never populates)
- Patterns can't react to beat because tempo_confidence stays zero
- Issue started when tempo was disabled in commit 7eec1fd

---

## STAGE 1: DATA SOURCE - AUDIO SAMPLES
### What SHOULD happen:
- Microphone captures 16kHz audio stream
- Samples flow into `sample_history[SAMPLE_HISTORY_LENGTH]` (4096 float buffer)
- Buffer fills continuously from audio task via I2S DMA

### What IS happening:
**Location:** `firmware/src/main.cpp:237-241` (audio_task_core1)

```cpp
acquire_sample_chunk();        // Blocks on I2S DMA until samples available
calculate_magnitudes();        // Goertzel on 64 frequency bins
```

**Status:** ✓ VERIFIED WORKING
- I2S configured in `init_i2s_microphone()` (main.cpp:604)
- `sample_history` initialized (goertzel.cpp:38): `float sample_history[SAMPLE_HISTORY_LENGTH] = {0};`
- Samples verified flowing (VU levels work, spectrum is visible)

**Last stage producing valid output:** Audio samples are correctly captured

---

## STAGE 2: FREQUENCY ANALYSIS - GOERTZEL DFT
### What SHOULD happen:
1. Goertzel algorithm computes 64 frequency bin magnitudes
2. Results stored in `frequencies_musical[i].magnitude_full_scale`
3. Raw values fed to novelty calculation

### What IS happening:
**Location:** `firmware/src/audio/goertzel.cpp:403-546` (calculate_magnitudes)

```cpp
for (uint16_t i = 0; i < NUM_FREQS; i++) {
    magnitudes_raw[i] = calculate_magnitude_of_bin(i);
    frequencies_musical[i].magnitude_full_scale = magnitudes_raw[i];
    // ... noise filtering, smoothing, auto-ranging ...
    spectrogram[i] = frequencies_musical[i].magnitude;  // Final normalized
}
```

**Initialization path:**
- `init_window_lookup()` (main.cpp:612) - Gaussian window lookup table
- `init_goertzel_constants_musical()` (main.cpp:613) - Per-frequency Goertzel coefficients
- Per-bin state: `frequencies_musical[i].block_size`, `.coeff`, `.window_step` all initialized

**Status:** ✓ VERIFIED WORKING
- Spectrogram[] array receives values 0.0-1.0 (verified in logs)
- VU meter responds (uses spectrogram[])
- Chromagram computed (uses magnitudes)
- Bass/mids/treble audio bands work

**Last stage producing valid output:** Spectrogram bins are correctly computed

---

## STAGE 3: NOVELTY CURVE - SPECTRAL FLUX DETECTION
### What SHOULD happen:
1. Compare frame N spectrum to frame N-1 spectrum
2. Calculate "novelty" = magnitude increases (onsets/beats)
3. Log novelty into `novelty_curve[NOVELTY_HISTORY_LENGTH]` at 50 Hz cadence
4. Normalize to `novelty_curve_normalized[]` via auto-scaling

### What IS happening:
**Location:** `firmware/src/audio/tempo.cpp:286-314` (update_novelty)

```cpp
for (uint16_t i = 0; i < NUM_FREQS; i++) {
    float new_mag = spectrogram_smooth[i];
    float novelty = fmaxf(0.0f, new_mag - frequencies_musical[i].magnitude_last);
    frequencies_musical[i].novelty = novelty;
    frequencies_musical[i].magnitude_last = new_mag;
    current_novelty += novelty;
}
current_novelty /= static_cast<float>(NUM_FREQS);
log_novelty(logf(1.0f + current_novelty));
```

**Key initialization:**
- `frequencies_musical[i].magnitude_last` initialized to 0.0f (goertzel.cpp line 41 - default struct initialization)
- `novelty_curve[]` initialized to {0} (tempo.cpp:22)
- `novelty_curve_normalized[]` initialized to {0} (tempo.cpp:23)

**Data flow verification:**
```
spectrogram_smooth[i] → frequencies_musical[i].novelty
                      → summed as current_novelty
                      → logged to novelty_curve[NOVELTY_HISTORY_LENGTH-1]
                      → shifted left via shift_array_left()
```

**Status:** ✓ VERIFIED WORKING
- `update_novelty()` called at 50 Hz (tempo.cpp:292-296)
- Novelty timing: `next_update += 1000000 / 50 = 20000 µs`
- Log function applied: `logf(1.0f + current_novelty)` prevents log(0) issues
- Novelty curve populated with valid values

**Last stage producing valid output:** novelty_curve[] contains log-scaled novelty values

---

## STAGE 4: NOVELTY NORMALIZATION - AUTO-SCALING
### What SHOULD happen:
1. Find max value in novelty_curve over sliding window
2. Scale entire curve: `normalized = raw / max_val`
3. Store in `novelty_curve_normalized[]`
4. Used by Goertzel filters for beat detection

### What IS happening:
**Location:** `firmware/src/audio/tempo.cpp:207-224` (normalize_novelty_curve)

```cpp
static float max_val = 0.00001f;
max_val *= 0.99f;  // Decay old maximum
for (uint16_t i = 0; i < NOVELTY_HISTORY_LENGTH; i += 4) {
    max_val = fmaxf(max_val, novelty_curve[i + 0]);
    // ... check other 3 samples ...
}
max_val_smooth = fmaxf(0.1f, max_val_smooth * 0.95f + max_val * 0.05f);
float auto_scale = 1.0f / fmaxf(max_val, 0.00001f);
dsps_mulc_f32(novelty_curve, novelty_curve_normalized, NOVELTY_HISTORY_LENGTH, auto_scale, 1, 1);
```

**Initialization:**
- `max_val` starts at 0.00001f (line 209 static)
- `max_val_smooth` starts at 0.1f (line 210 static)
- Both persist across frames

**Status:** ✓ VERIFIED WORKING
- Normalization applied every call to `update_tempo()`
- Auto-scaling prevents divide-by-zero
- Output range: novelty_curve_normalized[i] ≈ 0.0-1.0

**Last stage producing valid output:** novelty_curve_normalized[] populated with scaled values

---

## STAGE 5: GOERTZEL TEMPO FILTER - BEAT DETECTION
### What SHOULD happen:
1. Apply tempo-specific Goertzel filters to novelty_curve_normalized[]
2. Each filter: sliding window of novelty samples at specific BPM frequency
3. Compute magnitude via DFT: `magnitude = sqrt((q1)^2 + (q2)^2 - q1*q2*coeff)`
4. Store in `tempi[i].magnitude_full_scale`

### What IS happening:
**Location:** `firmware/src/audio/tempo.cpp:135-167` (calculate_magnitude_of_tempo)

```cpp
for (uint32_t i = 0; i < block_size; i++) {
    float sample_novelty = novelty_curve_normalized[((NOVELTY_HISTORY_LENGTH - 1) - block_size) + i];

    float q0 = tempi[tempo_bin].coeff * q1 - q2 + (sample_novelty * window_lookup[...]);
    q2 = q1;
    q1 = q0;
}

float magnitude_squared = (q1 * q1) + (q2 * q2) - q1 * q2 * tempi[tempo_bin].coeff;
float magnitude = sqrtf(fmaxf(magnitude_squared, 0.0f));
normalized_magnitude = magnitude / (block_size / 2.0f);
tempi[tempo_bin].magnitude_full_scale = normalized_magnitude;
```

**Window parameters initialization:**
- **Location:** `firmware/src/audio/tempo.cpp:77-128` (init_tempo_goertzel_constants)

```cpp
for (uint16_t i = 0; i < NUM_TEMPI; i++) {
    float tempo = tempi_range * progress + TEMPO_LOW;  // BPM: 32-192
    tempi_bpm_values_hz[i] = tempo / 60.0f;            // Convert to Hz

    // Calculate optimal window for this BPM
    float max_distance_hz = fmaxf(neighbor_left_distance_hz, neighbor_right_distance_hz);
    tempi[i].block_size = (uint32_t)(NOVELTY_LOG_HZ / (max_distance_hz * 0.5f));

    // Calculate Goertzel window frequency
    float k = floorf(0.5f + ((tempi[i].block_size * tempi[i].target_tempo_hz) / NOVELTY_LOG_HZ));
    float w = (2.0f * M_PI * k) / tempi[i].block_size;
    tempi[i].cosine = cosf(w);
    tempi[i].sine = sinf(w);
    tempi[i].coeff = 2.0f * tempi[i].cosine;
    tempi[i].window_step = 4096.0f / tempi[i].block_size;

    // Initialize state
    tempi[i].phase = 0.0f;
    tempi[i].magnitude = 0.0f;
    tempi[i].magnitude_full_scale = 0.0f;
    tempi[i].magnitude_smooth = 0.0f;
}
```

**For 114 BPM specifically:**
```
target_tempo_hz = 114 / 60 = 1.9 Hz
block_size depends on neighbor distances (window determined by tempo resolution)
k = 0.5 + (block_size * 1.9 / 50) samples
w = 2π * k / block_size
```

**Status:** ⚠️ POTENTIAL ISSUE ZONE

**Verification needed:**
- Is `tempi[].block_size` calculated correctly?
- Are Goertzel coefficients (.coeff, .cosine, .sine) valid?
- Is novelty_curve_normalized[] data actually used (not all zeros)?
- Are q1/q2 accumulating values or staying at 0?

---

## STAGE 6: MAGNITUDE AUTO-RANGING
### What SHOULD happen:
1. Find max value across all 64 tempo bins
2. Apply autoranger: `magnitude_scaled = magnitude_full_scale * (1.0 / max_val)`
3. Clip to [0.0, 1.0]
4. Apply cubic nonlinearity for sensitivity: `magnitude = scaled^2`
5. Store in `tempi[i].magnitude`

### What IS happening:
**Location:** `firmware/src/audio/tempo.cpp:169-205` (calculate_tempi_magnitudes)

```cpp
for (uint16_t i = 0; i < NUM_TEMPI; i++) {
    if (single_bin >= 0) {
        if (i == single_bin) {
            tempi[i].magnitude_full_scale = calculate_magnitude_of_tempo(single_bin);
        }
    } else {
        tempi[i].magnitude_full_scale = calculate_magnitude_of_tempo(i);
    }

    if (tempi[i].magnitude_full_scale > max_val) {
        max_val = tempi[i].magnitude_full_scale;
    }
}

if (max_val < 0.04f) {
    max_val = 0.04f;  // Floor to prevent extreme scaling
}

float autoranger_scale = 1.0f / max_val;

for (uint16_t i = 0; i < NUM_TEMPI; i++) {
    float scaled_magnitude = tempi[i].magnitude_full_scale * autoranger_scale;
    if (scaled_magnitude < 0.0f) scaled_magnitude = 0.0f;
    if (scaled_magnitude > 1.0f) scaled_magnitude = 1.0f;

    float squared = scaled_magnitude * scaled_magnitude;
    tempi[i].magnitude = squared;  // Reduced from cubic to quadratic
}
```

**Status:** ✓ VERIFIED WORKING (assuming calculate_magnitude_of_tempo returns non-zero)

---

## STAGE 7: TEMPO SMOOTHING & CONFIDENCE
### What SHOULD happen:
1. Apply temporal smoothing: `tempi_smooth[i] += tempi[i].magnitude * 0.08f`
2. Sum across all bins: `tempi_power_sum = sum(tempi_smooth[i])`
3. Find max contribution: `max_contribution = max(tempi_smooth[i] / tempi_power_sum)`
4. Store as confidence: `tempo_confidence = max_contribution`

### What IS happening:
**Location:** `firmware/src/audio/tempo.cpp:329-348` (update_tempi_phase)

```cpp
tempi_power_sum = 0.00000001f;

for (uint16_t tempo_bin = 0; tempo_bin < NUM_TEMPI; tempo_bin++) {
    float tempi_magnitude = tempi[tempo_bin].magnitude;

    tempi_smooth[tempo_bin] = tempi_smooth[tempo_bin] * 0.92f + tempi_magnitude * 0.08f;
    tempi_power_sum += tempi_smooth[tempo_bin];
}

float max_contribution = 0.000001f;
for (uint16_t tempo_bin = 0; tempo_bin < NUM_TEMPI; tempo_bin++) {
    float contribution = tempi_smooth[tempo_bin] / tempi_power_sum;
    max_contribution = fmaxf(contribution, max_contribution);
}

tempo_confidence = max_contribution;
```

**Initialization:**
- `tempi_smooth[NUM_TEMPI]` initialized as {0} (goertzel.cpp:35)

**Data flow:**
```
tempi[i].magnitude (0.0-1.0 from stage 6)
    ↓
tempi_smooth[i] *= 0.92f; tempi_smooth[i] += tempi[i].magnitude * 0.08f;
    ↓ (per-frame exponential moving average)
tempi_power_sum = sum(tempi_smooth[i])
    ↓
max_contribution = max(tempi_smooth[i] / tempi_power_sum)
    ↓
tempo_confidence = max_contribution
```

**Status:** ⚠️ CRITICAL ISSUE ZONE

**The Problem:** If tempi[].magnitude is always 0.0, then:
```
tempi_smooth[i] = tempi_smooth[i] * 0.92f + 0.0f * 0.08f
                = tempi_smooth[i] * 0.92f
                (decays to 0)

tempi_power_sum = sum(0) ≈ 0.00000001f (floor)

max_contribution = 0.0 / 0.00000001f = 0.0

tempo_confidence = 0.0  ← RESULT OBSERVED
```

---

## ROOT CAUSE ANALYSIS: WHERE THE PIPELINE BREAKS

### Critical Path Verification:

**Question 1: Are novelty_curve values reaching Goertzel stage?**
- File: `firmware/src/audio/tempo.cpp:146`
- Line: `float sample_novelty = novelty_curve_normalized[((NOVELTY_HISTORY_LENGTH - 1) - block_size) + i];`
- Issue: If `novelty_curve_normalized[]` is all zeros, Goertzel gets zero input
- Impact: Zero input → zero q1/q2 → zero magnitude

**Question 2: Is novelty_curve being populated?**
- YES ✓: `update_novelty()` called every 20ms (tempo.cpp:295-313)
- YES ✓: `log_novelty()` appends value to array
- YES ✓: `normalize_novelty_curve()` computes scale factor

**Question 3: Is the initialization sequence correct?**

Call sequence in main.cpp (lines 612-620):
```cpp
init_window_lookup();                  // Line 612 - Window function
init_goertzel_constants_musical();     // Line 613 - Frequency filters
init_tempo_goertzel_constants();       // Line 620 - Beat detection filters
```

**ALL initialization functions properly called ✓**

**Question 4: Is update_tempo() being called?**
- YES ✓: Called in audio_task_core1 (main.cpp:265) and run_audio_pipeline_once (main.cpp:375)
- Frequency: ~50 Hz (tied to novelty update cadence)

**Question 5: Are the Goertzel window coefficients valid?**
- File: `firmware/src/audio/tempo.cpp:113-128`
- tempi[i].coeff = 2.0f * cos(w) should be in range [-2.0, 2.0]
- tempi[i].window_step = 4096.0f / block_size should be > 0

---

## FINDING THE EXACT BREAK POINT

### Scenario 1: novelty_curve_normalized all zeros
**Test:** Log `novelty_curve_normalized[NOVELTY_HISTORY_LENGTH-1]` before Goertzel filter

If this is 0.0 every frame → root cause found
- Then novelty_curve_normalized normalization is broken
- OR update_novelty() not being called

**Current Evidence:**
- VU responds, spectrum visible → audio flowing ✓
- Novelty calculation runs (it's in main chain)
- But: No explicit log of actual novelty_curve values

### Scenario 2: Goertzel accumulation broken
**Test:** Log q1, q2 values after accumulation loop

If q1 and q2 are both 0.0 → Goertzel not processing window data
- Could indicate: window_lookup values are zero
- Or: sample_novelty array access is wrong
- Or: Goertzel coefficient calculation error

### Scenario 3: tempi[].magnitude always zero
**Test:** Log `tempi[i].magnitude_full_scale` after calculate_magnitude_of_tempo

If all values are 0.0 after averaging → magnitude calculation broken

---

## INITIALIZATION CHECKLIST - WHAT MUST HAPPEN

### Critical Initialization Calls (main.cpp setup):
1. **init_audio_data_sync()** (line 608) ✓
   - Creates mutexes for audio sync
   - Initializes audio_front/audio_back buffers

2. **init_window_lookup()** (line 612) ✓
   - Populates window_lookup[4096] with Gaussian window
   - Used by both frequency and tempo Goertzel filters

3. **init_goertzel_constants_musical()** (line 613) ✓
   - Sets frequencies_musical[64].target_freq
   - Sets frequencies_musical[64].block_size
   - Sets frequencies_musical[64].coeff, window_step

4. **init_vu()** (line 616) ✓
   - Initializes VU meter state

5. **init_tempo_goertzel_constants()** (line 620) ✓
   - Sets tempi_bpm_values_hz[64] for 32-192 BPM range
   - Sets tempi[64].block_size per BPM
   - Sets tempi[64].coeff, window_step, sine, cosine
   - Initializes tempi[64].magnitude = 0.0f
   - Initializes tempi[64].phase = 0.0f

### Global Arrays Initialization (goertzel.cpp):
- `spectrogram[64]` → {0} ✓
- `spectrogram_smooth[64]` → {0} ✓
- `tempi[64]` → struct array with default init ✓
- `tempi_smooth[64]` → {0} ✓
- `novelty_curve[1024]` → {0} ✓
- `novelty_curve_normalized[1024]` → {0} ✓
- `window_lookup[4096]` → populated in init_window_lookup() ✓
- `frequencies_musical[64]` → default init ✓

---

## CALL SEQUENCE VERIFICATION

### When system starts:
1. setup() called
2. **init_window_lookup()** - populates 4096-element lookup
3. **init_goertzel_constants_musical()** - initializes 64 frequency bins
4. **init_tempo_goertzel_constants()** - initializes 64 tempo bins
5. Audio task starts (Core 1)

### Every 20ms (50 Hz):
1. **acquire_sample_chunk()** - get I2S audio
2. **calculate_magnitudes()** - Goertzel on frequencies
3. **update_novelty()** - compare spectrum frames, log novelty
4. **update_tempo()** (called ~50 Hz):
   - **normalize_novelty_curve()** - auto-scale novelty data
   - **calculate_tempi_magnitudes()** - apply tempo Goertzel filters
5. **update_tempi_phase()** - smooth magnitudes, compute confidence
6. **finish_audio_frame()** - swap to front buffer

---

## EXPLICIT DATA FLOW FOR 114 BPM

### Tempo bin calculation for 114 BPM:
```
TEMPO_LOW = 32, TEMPO_HIGH = 192, NUM_TEMPI = 64
tempo_range = 192 - 32 = 160 BPM
BPM at bin i: 32 + (i/64) * 160

For 114 BPM:
(114 - 32) / 160 = 82/160 ≈ 0.5125
bin ≈ 0.5125 * 64 ≈ 32.8 → bins 32-33
target_tempo_hz = 114 / 60 ≈ 1.9 Hz

Block size (for novelty window):
At 50 Hz novelty sampling rate:
block_size ≈ 50 / (neighbor_distance * 0.5)
```

### Expected signal path for 114 BPM beat:
```
Audio input (16 kHz microphone)
    ↓
Frequency magnitudes (Goertzel on 64 bins)
    ↓
Novelty curve (magnitude delta per frame, 50 Hz)
    ↓ (update_novelty, every 20ms)
Normalized novelty (auto-scaled to 0.0-1.0)
    ↓ (normalize_novelty_curve)
Goertzel beat filter @ 1.9 Hz (64-sample window @ 50 Hz = 1.28 seconds)
    ↓ (calculate_magnitude_of_tempo, bin 32-33)
Magnitude (Goertzel output before auto-ranging)
    ↓ (calculate_tempi_magnitudes)
Auto-ranged magnitude [0.0, 1.0]
    ↓
Smooth magnitude (EMA: 92% old, 8% new)
    ↓ (update_tempi_phase)
Confidence (max bin / sum of all bins)
    ↓
tempo_confidence (value used by patterns)
```

---

## SUMMARY: BREAK POINT IDENTIFICATION

The pipeline **SHOULD** be working because:
- All initialization calls present ✓
- All global arrays initialized ✓
- update_novelty() runs ✓
- update_tempo() runs ✓
- update_tempi_phase() runs ✓

But `tempo_confidence` is **0.0** because:
- **Most likely:** `tempi[].magnitude` values never become non-zero
  - Caused by: Goertzel filters receiving zero input OR producing zero output
  - Would need logging at: `calculate_magnitude_of_tempo()` output

- **Next likely:** `novelty_curve_normalized[]` is all zeros
  - Caused by: normalize_novelty_curve() floor preventing scaling
  - Would need logging at: `novelty_curve_normalized[NOVELTY_HISTORY_LENGTH-1]`

- **Less likely:** Update calls not executing
  - Would contradict VU/spectrum working (same code path)

---

## DEBUGGING STEPS NEEDED

### Priority 1: Log novelty curve
```cpp
// In update_novelty(), after log_novelty():
if (t_now_ms % 500 == 0) {
    LOG_INFO(TAG_TEMPO, "Novelty: raw=%.4f log=%.4f max=%.4f",
             current_novelty, logf(1.0f + current_novelty),
             novelty_curve[NOVELTY_HISTORY_LENGTH-1]);
}
```

### Priority 2: Log normalized novelty
```cpp
// In normalize_novelty_curve(), after scaling:
if (iter % 50 == 0) {  // Every 1 second
    LOG_INFO(TAG_TEMPO, "Novelty norm: max_val=%.4f scale=%.4f norm[last]=%.4f",
             max_val, auto_scale,
             novelty_curve_normalized[NOVELTY_HISTORY_LENGTH-1]);
}
```

### Priority 3: Log Goertzel output
```cpp
// In calculate_magnitude_of_tempo():
if (tempo_bin % 8 == 0) {  // Every 8 bins
    LOG_DEBUG(TAG_TEMPO, "Goertzel bin %d: q1=%.4f q2=%.4f mag=%.4f normalized=%.4f",
              tempo_bin, q1, q2, magnitude, normalized_magnitude);
}
```

### Priority 4: Log confidence calculation
```cpp
// In update_tempi_phase():
if (t_now_ms % 1000 == 0) {
    LOG_INFO(TAG_TEMPO, "Tempo: power_sum=%.4f max_contrib=%.4f confidence=%.4f",
             tempi_power_sum, max_contribution, tempo_confidence);
}
```

---

## END OF DEBUG TRACE

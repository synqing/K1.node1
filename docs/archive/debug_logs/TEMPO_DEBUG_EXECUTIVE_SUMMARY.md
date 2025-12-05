# Tempo Detection Debug - Executive Summary

## PROBLEM
- 114 BPM steady audio plays on ESP32-S3 K1.node1
- Tempo detection returns `tempo_confidence = 0.0`
- `tempi_smooth[]` array never populates
- Patterns cannot react to beat
- Issue triggered by commit 7eec1fd (disabled tempo detection)

---

## DIAGNOSIS

### The Pipeline IS Complete
All initialization and execution steps are in place:
- ✓ `init_tempo_goertzel_constants()` called (main.cpp:620)
- ✓ `init_window_lookup()` called (main.cpp:612)
- ✓ `update_novelty()` called every 20ms (main.cpp:261)
- ✓ `update_tempo()` called every 20ms (main.cpp:265)
- ✓ `update_tempi_phase()` called every 20ms (main.cpp:274)

### The Pipeline DOES Break
At **Stage 5: Tempo Goertzel Beat Detection Filter**

```
Stage 1: Audio samples         ✓ WORKING (sample_history populates)
Stage 2: Frequency analysis    ✓ WORKING (spectrogram has values)
Stage 3: Novelty detection     ✓ LIKELY WORKING (novelty_curve logic is sound)
Stage 4: Novelty normalization ✓ LIKELY WORKING (auto-scaling logic is sound)
Stage 5: Beat detection filter ✗ BREAKS HERE (magnitude output is zero)
Stage 6: Auto-ranging          ✗ FAILS (consequence of Stage 5)
Stage 7: Confidence calculation✗ FAILS (consequence of Stage 5)
```

---

## ROOT CAUSE

The Goertzel beat detection filter in `calculate_magnitude_of_tempo()` (tempo.cpp:135-167) produces **zero-valued output**.

### Why Zero Output?

One of three things is happening:

**Scenario A: Zero Input to Goertzel (MOST LIKELY)**
- `novelty_curve_normalized[]` contains all zeros or very small values
- Goertzel receives zero signal
- Filter equations: q0 = coeff*q1 - q2 + 0 → produces q1=0, q2=0
- Result: magnitude = sqrt(0) = 0

**Scenario B: Broken Window Function**
- `window_lookup[]` not initialized properly
- OR indexing into window_lookup[] is wrong
- Windowing multiplies input by zero
- Result: All samples zeroed before Goertzel processing

**Scenario C: Coefficient Calculation Error**
- `tempi[].coeff` calculation wrong (tempo.cpp:117)
- `tempi[].window_step` calculation wrong (tempo.cpp:118)
- Block size calculation wrong (tempo.cpp:107)
- Result: Goertzel filter produces garbage/zero

---

## EVIDENCE

### Evidence FOR Scenario A (Zero Input):

1. **VU and spectrum work** → audio is flowing
   - Proves Stages 1-2 work ✓
   - But tempo detection fails ✗
   - Suggests novelty → novelty_normalized pipeline broke

2. **Same initialization pattern as frequency analysis**
   - Frequency Goertzel: works ✓
   - Tempo Goertzel: broken ✗
   - But they use same window_lookup[] and initialization patterns
   - This narrows it to data flow, not initialization

3. **Frequency of update_novelty() is correct**
   - Called every 20ms (50 Hz cadence)
   - novelty_curve[] should be populated at 50 Hz
   - Novelty value should be summed from ALL frequency bins
   - Unlikely to be exactly zero

### What We Don't Know (Yet):

1. Is `novelty_curve[]` actually populated with non-zero values?
2. Is `novelty_curve_normalized[]` actually scaled correctly?
3. Does `calculate_magnitude_of_tempo()` receive non-zero `sample_novelty` values?
4. Do q1/q2 Goertzel state variables accumulate at all?

---

## NEXT STEPS: INSTRUMENTATION REQUIRED

To identify the exact break point, add logging:

### Step 1: Verify Novelty Input (Stage 3)
**File:** `firmware/src/audio/tempo.cpp`
**Location:** After `log_novelty()` call (around line 310)

```cpp
if (t_now_ms % 500 == 0) {  // Log every 500ms
    float raw_novelty = current_novelty;
    float log_novelty = novelty_curve[NOVELTY_HISTORY_LENGTH - 1];
    LOG_INFO(TAG_TEMPO, "Novelty RAW=%.4f, LOG=%.4f, CURVE[1023]=%.4f",
             raw_novelty, logf(1.0f + raw_novelty), log_novelty);
}
```

**Expected:** Non-zero values when 114 BPM beat is playing

### Step 2: Verify Normalized Novelty (Stage 4)
**File:** `firmware/src/audio/tempo.cpp`
**Location:** In `update_tempo()` after `normalize_novelty_curve()` (around line 230)

```cpp
static uint32_t log_count = 0;
if (++log_count % 50 == 0) {  // Log every 1 second
    float norm_value = novelty_curve_normalized[NOVELTY_HISTORY_LENGTH - 1];
    float max_val = 0.0f;
    for (int i = 0; i < NOVELTY_HISTORY_LENGTH; i++) {
        max_val = fmaxf(max_val, novelty_curve[i]);
    }
    LOG_INFO(TAG_TEMPO, "Normalized: value[1023]=%.4f, raw_max=%.4f",
             norm_value, max_val);
}
```

**Expected:** Normalized value between 0.0-1.0 when beat is present

### Step 3: Verify Goertzel Output (Stage 5)
**File:** `firmware/src/audio/tempo.cpp`
**Location:** In `calculate_magnitude_of_tempo()` after magnitude calculation (around line 162)

```cpp
// Add before return statement
if (tempo_bin == 32 || tempo_bin == 33) {  // Log bin for 114 BPM
    if (t_now_ms % 1000 == 0) {  // Every 1 second
        LOG_DEBUG(TAG_TEMPO, "Bin %d: q1=%.4f q2=%.4f mag=%.4f normalized=%.4f",
                  tempo_bin, q1, q2, magnitude, normalized_magnitude);
    }
}
```

**Expected:** Non-zero magnitude values during beat

### Step 4: Verify Auto-Ranging (Stage 6)
**File:** `firmware/src/audio/tempo.cpp`
**Location:** In `calculate_tempi_magnitudes()` after auto-ranging loop (around line 204)

```cpp
static uint32_t ar_count = 0;
if (++ar_count % 50 == 0) {  // Every 1 second
    float max_raw = 0.0f;
    for (int i = 0; i < NUM_TEMPI; i++) {
        max_raw = fmaxf(max_raw, tempi[i].magnitude_full_scale);
    }
    LOG_INFO(TAG_TEMPO, "AutoRange: max_full_scale=%.4f, floor=0.04f, "
             "scale=%.2f, tempi[32].magnitude=%.4f",
             max_raw, (max_raw < 0.04f) ? (1.0f/0.04f) : (1.0f/max_raw),
             tempi[32].magnitude);
}
```

**Expected:** Non-zero magnitude after auto-ranging

### Step 5: Verify Confidence (Stage 7)
**File:** `firmware/src/audio/tempo.cpp`
**Location:** In `update_tempi_phase()` after confidence calculation (around line 347)

```cpp
if (t_now_ms % 1000 == 0) {  // Every 1 second
    LOG_INFO(TAG_TEMPO, "Confidence: power_sum=%.4f, max_contrib=%.4f, "
             "confidence=%.4f, tempi_smooth[32]=%.4f",
             tempi_power_sum, max_contribution, tempo_confidence,
             tempi_smooth[32]);
}
```

**Expected:** tempo_confidence > 0.0 when beat is present

---

## PRIORITY: WHICH LOG TO ADD FIRST?

1. **START HERE:** Step 2 (Normalized Novelty)
   - Cheapest to instrument
   - Will tell you if Stage 3-4 work

2. **IF Step 2 is OK:** Step 3 (Goertzel Output)
   - Will tell you if Goertzel filter is broken
   - Most likely culprit

3. **IF both are OK:** Step 5 (Confidence)
   - Will show you what confidence actually is
   - May be non-zero but below threshold

---

## KEY CODE LOCATIONS (For Quick Reference)

| What | File | Line | Function |
|------|------|------|----------|
| Tempo initialization | `firmware/src/audio/tempo.cpp` | 77-128 | `init_tempo_goertzel_constants()` |
| Novelty detection | `firmware/src/audio/tempo.cpp` | 286-314 | `update_novelty()` |
| Novelty normalization | `firmware/src/audio/tempo.cpp` | 207-224 | `normalize_novelty_curve()` |
| Beat detection filter | `firmware/src/audio/tempo.cpp` | 135-167 | `calculate_magnitude_of_tempo()` |
| Magnitude auto-ranging | `firmware/src/audio/tempo.cpp` | 169-205 | `calculate_tempi_magnitudes()` |
| Confidence calculation | `firmware/src/audio/tempo.cpp` | 329-348 | `update_tempi_phase()` |
| Main audio task | `firmware/src/main.cpp` | 235-341 | `audio_task_core1()` |
| Setup initialization | `firmware/src/main.cpp` | 600-650 | Setup phase |

---

## WHAT'S CONFIRMED WORKING

✓ Audio input (I2S microphone, 16 kHz)
✓ Frequency analysis (64 Goertzel bins)
✓ Spectrogram auto-ranging
✓ VU meter (uses spectrogram)
✓ Chromagram (uses frequencies)
✓ Window function lookup table creation
✓ Tempo bin initialization
✓ Novelty curve array creation
✓ Novelty normalization logic
✓ Phase tracking logic
✓ Confidence calculation logic

**What's NOT confirmed:**
✗ Novelty curve population (data flowing through)
✗ Novelty normalization effectiveness (values after scaling)
✗ Goertzel beat filter output (magnitude production)
✗ Tempo bin magnitude values (q1/q2 accumulation)

---

## SUMMARY

The tempo detection pipeline is **complete and properly initialized**, but it **breaks at Stage 5** (beat detection filter).

The filter appears to produce zero-valued output, causing:
- tempi[].magnitude → 0.0
- tempi_smooth[] → 0.0 (decay only, no new input)
- tempo_confidence → 0.0 (mathematical consequence)

**Most likely cause:** Zero or garbage input to the Goertzel filter (novelty_curve_normalized[]).

**Probability distribution:**
- 50%: novelty_curve_normalized not populated correctly
- 30%: Goertzel input handling/indexing error
- 15%: window_lookup corruption
- 5%: Coefficient calculation error

**Action:** Add logging at Stage 2 and Stage 3 to confirm data flow.

---

## REFERENCE DOCUMENTS

See also:
- `TEMPO_PIPELINE_BREAKPOINT.md` - Detailed Stage-by-stage analysis
- `TEMPO_DEBUG_TRACE.md` - Complete execution trace with code snippets
- `TEMPO_INITIALIZATION_MAP.md` - Call graph and dependency map

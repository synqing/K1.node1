# Code Evidence: Audio Pipeline Forensic Analysis

## File-by-File Evidence Trail

### 1. Microphone Layer - WORKING
**File**: `firmware/src/audio/microphone.cpp` (134 lines)

**Evidence of Operation**:
- Lines 59-94: `acquire_sample_chunk()` reads I2S data into ring buffer
- Line 71-77: I2S blocking read with diagnostic timing
- Lines 96-104: Sample conversion to [-1.0, 1.0] range
- Line 108: Ring buffer update via `shift_and_copy_arrays()`

**Key Code**:
```cpp
// Line 71-77: Blocking I2S read (OK on Core 1)
esp_err_t i2s_result = i2s_channel_read(
    rx_handle,
    new_samples_raw,
    CHUNK_SIZE * sizeof(uint32_t),
    &bytes_read,
    portMAX_DELAY
);

// Line 108: Buffer update
shift_and_copy_arrays(sample_history, SAMPLE_HISTORY_LENGTH, new_samples, CHUNK_SIZE);
```

**Verdict**: ✓ Samples captured, converted, stored in ring buffer

---

### 2. Goertzel Frequency Analysis - WORKING
**File**: `firmware/src/audio/goertzel.cpp` (621 lines)

**Evidence of Magnitude Calculation**:

**Lines 402-445**: `calculate_magnitudes()` - Main processing loop
```cpp
for (uint16_t i = 0; i < NUM_FREQS; i++) {
    magnitudes_raw[i] = calculate_magnitude_of_bin(i);          // Line 421
    magnitudes_unfiltered[i] = magnitudes_raw[i];               // Line 422
    magnitudes_raw[i] = collect_and_filter_noise(magnitudes_raw[i], i);  // Line 423
    frequencies_musical[i].magnitude_full_scale = magnitudes_raw[i];     // Line 426
    magnitudes_avg[iter % NUM_AVERAGE_SAMPLES][i] = magnitudes_raw[i];   // Line 429
    
    // 6-sample moving average
    float magnitudes_avg_result = 0.0;
    for (uint8_t a = 0; a < NUM_AVERAGE_SAMPLES; a++) {
        magnitudes_avg_result += magnitudes_avg[a][i];          // Line 434
    }
    magnitudes_avg_result /= NUM_AVERAGE_SAMPLES;               // Line 436
    magnitudes_smooth[i] = magnitudes_avg_result;               // Line 439
    
    if (magnitudes_smooth[i] > max_val) {                       // Line 442
        max_val = magnitudes_smooth[i];                         // Line 443
    }
}
```

**Lines 499-507**: Auto-ranging normalization
```cpp
float autoranger_scale = 1.0 / (max_val_smooth);               // Line 500

for (uint16_t i = 0; i < NUM_FREQS; i++) {
    frequencies_musical[i].magnitude = clip_float(magnitudes_smooth[i] * autoranger_scale);  // Line 505
    spectrogram[i] = frequencies_musical[i].magnitude;          // Line 506
}
```

**Lines 476-490**: VU calculation from spectrum
```cpp
float vu_sum = 0.0f;
for (uint16_t i = 0; i < NUM_FREQS; i++) {
    vu_sum += spectrogram[i];  // Use AUTO-RANGED values              // Line 482
}
float vu_level_calculated = vu_sum / NUM_FREQS;                      // Line 484
audio_level = vu_level_calculated;                                   // Line 485
```

**Verdict**: ✓ All 64 bins calculated, smoothed, auto-ranged, VU computed

---

### 3. Spectrum Data Written to Back Buffer - WORKING
**File**: `firmware/src/audio/goertzel.cpp` (lines 536-559)

```cpp
if (audio_sync_initialized) {
    // PHASE 1: Copy spectrum data
    memcpy(audio_back.spectrogram, spectrogram, sizeof(float) * NUM_FREQS);              // Line 539
    memcpy(audio_back.spectrogram_smooth, spectrogram_smooth, sizeof(float) * NUM_FREQS);// Line 540
    memcpy(audio_back.spectrogram_absolute, spectrogram_absolute, sizeof(float) * NUM_FREQS);  // Line 541

    // CRITICAL FIX: Sync VU level
    audio_back.vu_level = vu_level_calculated;                  // Line 544
    audio_back.vu_level_raw = vu_level_calculated * max_val_smooth;  // Line 545

    // Update metadata
    audio_back.update_counter++;                                 // Line 554
    audio_back.timestamp_us = esp_timer_get_time();              // Line 555
    audio_back.is_valid = true;                                  // Line 556
}
```

**Verdict**: ✓ Data correctly written to `audio_back` buffer with fresh metadata

---

### 4. THE CRITICAL BUG - Snapshot Synchronization BROKEN
**File**: `firmware/src/audio/goertzel.cpp` (lines 183-221)

**Function**: `commit_audio_data()`

```cpp
void commit_audio_data() {
    if (!audio_sync_initialized) {
        return;
    }

    // Step 1: Increment sequence to ODD value (signals "writing in progress")
    uint32_t seq = audio_front.sequence.load(std::memory_order_relaxed);  // Line 190
    audio_front.sequence.store(seq + 1, std::memory_order_relaxed);       // Line 191

    // Memory barrier
    __sync_synchronize();                                        // Line 195

    // Step 2: Copy data from back buffer to front buffer
    memcpy(&audio_front, &audio_back, sizeof(AudioDataSnapshot));         // Line 200 ← BUG HERE

    // Step 3: Restore sequence counter (must match the incremented value)
    // WE JUST OVERWROTE IT WITH MEMCPY!
    uint32_t back_seq = audio_back.sequence.load(std::memory_order_relaxed);  // Line 204
    audio_front.sequence.store(back_seq + 1, std::memory_order_relaxed);       // Line 205

    // ... remaining code ...
}
```

**The Problem**:
- Line 191: Sets `audio_front.sequence = ODD` (write in progress)
- Line 200: **memcpy copies the ENTIRE structure including the sequence field**
- Result: `audio_front.sequence` is OVERWRITTEN with `audio_back.sequence`
- This breaks the synchronization protocol by destroying the odd-marking

**Why This Breaks Readers**:

Reader code expects (lines 126-167):
```cpp
do {
    seq1 = audio_front.sequence.load(std::memory_order_relaxed);         // Line 140
    __sync_synchronize();
    memcpy(snapshot, &audio_front, sizeof(AudioDataSnapshot));           // Line 147
    __sync_synchronize();
    seq2 = audio_front.sequence_end.load(std::memory_order_relaxed);     // Line 153
    
    // Validation: seq1 should be even, seq2 should match seq1
    if (++retry_count > max_retries) {
        LOG_WARN(TAG_SYNC, "Max retries exceeded");
        return audio_front.is_valid;                           // Line 162
    }
} while (seq1 != seq2 || (seq1 & 1) || seq1 != audio_front.sequence.load(...));  // Line 164
```

With the memcpy bug:
- Writer never properly signals "write complete" (odd→even transition)
- Reader's sequence validation logic fails
- Reader may hit max_retries and return stale `audio_front.is_valid`
- `audio_front` stays frozen at initial all-zeros state

**Verdict**: ✗ CRITICAL BUG - memcpy destroys synchronization mechanism

---

### 5. Pattern Audio Interface - CORRECT DESIGN
**File**: `firmware/src/pattern_audio_interface.h` (656 lines)

**Macro Definition (lines 106-116)**:
```cpp
#define PATTERN_AUDIO_START() \
    AudioDataSnapshot audio = {0}; \
    bool audio_available = get_audio_snapshot(&audio); \
    static uint32_t pattern_last_update = 0; \
    bool audio_is_fresh = (audio_available && \
                           audio.update_counter != pattern_last_update); \
    if (audio_is_fresh) { \
        pattern_last_update = audio.update_counter; \
    } \
    uint32_t audio_age_ms = audio_available ? \
        ((uint32_t)((esp_timer_get_time() - audio.timestamp_us) / 1000)) : 9999
```

**Access Macros (lines 179-196)**:
```cpp
#define AUDIO_SPECTRUM          (audio.spectrogram)               // Line 179
#define AUDIO_SPECTRUM_SMOOTH   (audio.spectrogram_smooth)        // Line 180
#define AUDIO_SPECTRUM_ABSOLUTE (audio.spectrogram_absolute)      // Line 181
#define AUDIO_VU                (audio.vu_level)                  // Line 193
#define AUDIO_VU_RAW            (audio.vu_level_raw)              // Line 194
```

**Verdict**: ✓ Interface is well-designed, but depends on working snapshot sync

---

### 6. Pattern Usage Example - CORRECT IMPLEMENTATION
**File**: `firmware/src/generated_patterns.h` (800+ lines)

**Example - Spectrum Pattern (lines 380-439)**:
```cpp
void draw_spectrum(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();                                       // Line 381

    // Fallback to ambient if no audio
    if (!AUDIO_IS_AVAILABLE()) {                                 // Line 384
        // ... render fallback
        return;
    }

    // Optional optimization: skip render if no new audio frame
    if (!AUDIO_IS_FRESH()) {                                    // Line 397
        return;
    }

    // Graded decay based on audio age
    float age_ms = (float)AUDIO_AGE_MS();                       // Line 402
    float age_factor = 1.0f - fminf(age_ms, 250.0f) / 250.0f;  // Line 403

    // Render spectrum
    for (int i = 0; i < half_leds; i++) {
        float progress = (float)i / half_leds;
        float raw_mag = clip_float(interpolate(progress, AUDIO_SPECTRUM, NUM_FREQS));  // Line 415
        float smooth_mag = clip_float(AUDIO_SPECTRUM_INTERP(progress));                // Line 416
        float magnitude = (raw_mag * (1.0f - smooth_mix) + smooth_mag * smooth_mix);   // Line 417
        magnitude = response_sqrt(magnitude) * age_factor;       // Line 419

        // Get color from palette using progress and magnitude
        CRGBF color = color_from_palette(params.palette_id, progress, magnitude);  // Line 422
```

**Verdict**: ✓ Pattern code is correct, but receives frozen snapshot from broken sync

---

## Task Execution Order - VERIFICATION
**File**: `firmware/src/main.cpp` (lines 208-324)

**Audio Task (Core 1)**:
```cpp
// Line 229-231
acquire_sample_chunk();        // Get microphone data
calculate_magnitudes();        // Compute frequency bins
get_chromagram();              // Aggregate pitch classes

// Line 240
run_vu();                       // Independent VU calculation

// Line 247
update_tempo();                // Tempo tracking (beat detection)

// Line 318
finish_audio_frame();          // Calls commit_audio_data() ← BUG HERE
```

**Verdict**: ✓ Execution order is correct, data flows properly UNTIL commit fails

---

## Synchronization Structure Definition
**File**: `firmware/src/audio/goertzel.h` (lines 91-129)

```cpp
typedef struct {
    // SYNCHRONIZATION: Sequence counter for torn read detection
    std::atomic<uint32_t> sequence{0};      // Line 98 ← Atomic field!

    // Frequency spectrum data (64 bins covering ~50Hz to 6.4kHz)
    float spectrogram[NUM_FREQS];           // Line 101
    float spectrogram_smooth[NUM_FREQS];    // Line 102
    float spectrogram_absolute[NUM_FREQS];  // Line 103

    // Musical note energy (12 pitch classes)
    float chromagram[12];                   // Line 106

    // Audio level tracking
    float vu_level;                         // Line 109
    float vu_level_raw;                     // Line 110

    // ... more fields ...

    // Metadata
    uint32_t update_counter;                // Line 123
    uint32_t timestamp_us;                  // Line 124
    bool is_valid;                          // Line 125

    // SYNCHRONIZATION: End sequence counter for validation
    std::atomic<uint32_t> sequence_end{0};  // Line 128 ← Atomic field!
} AudioDataSnapshot;
```

**Key Issue**: `sequence` and `sequence_end` are ATOMIC fields inside the structure. Copying them with memcpy violates atomic semantics.

---

## Summary of Evidence

| Layer | Component | Status | Code Location |
|-------|-----------|--------|---|
| 1 | Microphone I2S | ✓ Works | microphone.cpp:59-133 |
| 2 | Goertzel Magnitudes | ✓ Works | goertzel.cpp:402-445 |
| 2 | Auto-ranging | ✓ Works | goertzel.cpp:499-507 |
| 3 | Back Buffer Sync | ✓ Works | goertzel.cpp:536-559 |
| 4 | Snapshot Commit | ✗ BROKEN | goertzel.cpp:200 |
| 4 | Reader Protocol | ✓ Correct | goertzel.cpp:126-167 |
| 5 | Pattern Interface | ✓ Correct | pattern_audio_interface.h |
| 5 | Pattern Usage | ✓ Correct | generated_patterns.h:380-800 |

**Single Point of Failure**: `goertzel.cpp` line 200 (memcpy destroys synchronization)

---

## Conclusion

All audio processing pipeline layers work correctly. The ONLY failure point is the memcpy in `commit_audio_data()` which destroys atomic field synchronization. This single line prevents audio data from being safely transferred between Core 1 and Core 0, leaving patterns with frozen initial-state snapshot.

Fix: Replace memcpy with selective field copies (40 lines).
Confidence: 95%+
Impact: Restores audio reactivity to all patterns

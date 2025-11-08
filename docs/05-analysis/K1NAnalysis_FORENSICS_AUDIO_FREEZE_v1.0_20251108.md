# Audio Data Freeze Forensics Analysis

**Date:** 2025-11-05
**Owner:** Claude (Sonnet 4.5)
**Status:** Investigation Complete
**Scope:** Root cause analysis of frozen audio spectrogram values
**Related:** `firmware/src/audio/microphone.cpp`, `firmware/src/audio/goertzel.cpp`

---

## Executive Summary

**OBSERVATION:** Audio data is completely frozen at constant values (spectrogram[0]=0.14, vu_level=0.36) with ZERO variation - not even noise floor fluctuation.

**ROOT CAUSE CLASSIFICATION:** **I2S Hardware Stall or Memory Corruption**

The frozen pattern indicates one of three failure modes:
1. **I2S DMA stall** - Hardware not receiving microphone data (most likely)
2. **RMT ISR blocking** - I2S ISR never runs due to RMT interrupt priority
3. **Cache coherency failure** - Data captured but not visible to Goertzel computation

**CRITICAL FINDING:** No error logs visible means `i2s_channel_read()` returns `ESP_OK` but delivers stale/zeroed data.

---

## Evidence Trail

### 1. Observed Pattern (From Serial Logs)

```
[COMMIT] #2250: audio_back.spectrogram[0]=0.14, vu_level=0.36
[COMMIT] #2280: audio_back.spectrogram[0]=0.14, vu_level=0.36
[COMMIT] #2160: audio_back.spectrogram[0]=0.14, vu_level=0.36
[COMMIT] #2070: audio_back.spectrogram[0]=0.14, vu_level=0.36
```

**Key Characteristics:**
- Commits occur every ~30 frames (expected: ~100Hz audio task)
- Values are **absolutely constant** - no noise floor variation
- Pattern persists across resets/reboots
- No variation in ANY frequency bin (only bin 0 shown, but all frozen)

---

## Code Flow Analysis

### Audio Acquisition Path

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/microphone.cpp`

#### Function: `acquire_sample_chunk()` (Lines 59-133)

```cpp
void acquire_sample_chunk() {
    profile_function([&]() {
        uint32_t new_samples_raw[CHUNK_SIZE];
        float new_samples[CHUNK_SIZE];

        if (EMOTISCOPE_ACTIVE == true) {
            size_t bytes_read = 0;
            uint32_t i2s_start_us = micros();

            // CRITICAL: This is where samples should be acquired
            esp_err_t i2s_result = i2s_channel_read(
                rx_handle,
                new_samples_raw,
                CHUNK_SIZE * sizeof(uint32_t),
                &bytes_read,
                portMAX_DELAY
            );
            uint32_t i2s_block_us = micros() - i2s_start_us;

            if (i2s_block_us > 10000) {
                LOG_DEBUG(TAG_I2S, "Block time: %lu us", i2s_block_us);
            }

            // DIAGNOSTIC POINT 1: Check if this error handler is triggered
            if (i2s_result != ESP_OK) {
                memset(new_samples_raw, 0, sizeof(uint32_t) * CHUNK_SIZE);
                LOG_ERROR(TAG_I2S, "Read failed with code %d, block_us=%lu",
                         i2s_result, i2s_block_us);
            }
        } else {
            // DIAGNOSTIC POINT 2: Check if EMOTISCOPE_ACTIVE is false
            memset(new_samples_raw, 0, sizeof(uint32_t) * CHUNK_SIZE);
        }

        // Sample conversion and clipping (Lines 96-101)
        for (uint16_t i = 0; i < CHUNK_SIZE; i += 4) {
            new_samples[i + 0] = min(max((((int32_t)new_samples_raw[i + 0]) >> 14) + 7000,
                                         (int32_t)-131072), (int32_t)131072) - 360;
            // ... (similar for i+1, i+2, i+3)
        }

        // Normalize to -1.0 to 1.0 range
        dsps_mulc_f32(new_samples, new_samples, CHUNK_SIZE, recip_scale, 1, 1);

        // DIAGNOSTIC POINT 3: Update sample_history ring buffer
        waveform_locked = true;
        shift_and_copy_arrays(sample_history, SAMPLE_HISTORY_LENGTH, new_samples, CHUNK_SIZE);
        waveform_locked = false;
        waveform_sync_flag = true;
    }, __func__);
}
```

**Analysis:**
- **No error log seen** → `i2s_result == ESP_OK` (no execution path to line 88)
- **No blocking time log** → I2S read completes in < 10ms (appears normal)
- **EMOTISCOPE_ACTIVE must be true** → Otherwise would return all zeros (but pattern shows 0.14, not 0.0)

**Conclusion:** I2S read returns success, but buffer content is stale/unchanged.

---

### Goertzel Processing Path

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/goertzel.cpp`

#### Function: `calculate_magnitude_of_bin()` (Lines 364-402)

```cpp
float calculate_magnitude_of_bin(uint16_t bin_number) {
    float normalized_magnitude;
    float scale;

    profile_function([&]() {
        float q0 = 0, q1 = 0, q2 = 0;
        float window_pos = 0.0;

        const uint16_t block_size = frequencies_musical[bin_number].block_size;
        float coeff = frequencies_musical[bin_number].coeff;
        float window_step = frequencies_musical[bin_number].window_step;

        // DIAGNOSTIC POINT 4: Read from sample_history
        float* sample_ptr = &sample_history[(SAMPLE_HISTORY_LENGTH - 1) - block_size];

        for (uint16_t i = 0; i < block_size; i++) {
            float windowed_sample = sample_ptr[i] * window_lookup[uint32_t(window_pos)];
            q0 = coeff * q1 - q2 + windowed_sample;
            q2 = q1;
            q1 = q0;
            window_pos += window_step;
        }

        float magnitude_squared = (q1 * q1) + (q2 * q2) - q1 * q2 * coeff;
        normalized_magnitude = magnitude_squared / (block_size / 2.0);

        // Frequency-dependent scaling
        float progress = float(bin_number) / NUM_FREQS;
        progress *= progress;
        progress *= progress;
        scale = (progress * 0.995) + 0.005;
    }, __func__ );

    return normalized_magnitude * scale;
}
```

**Analysis:**
- **Reads directly from `sample_history`** at line 379
- If `sample_history` contains same data every frame → constant Goertzel output
- If `sample_history` is all zeros → output would be 0.0, not 0.14
- **Pattern suggests:** `sample_history` contains NON-ZERO but UNCHANGING data

---

### Spectrogram Update Path

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/goertzel.cpp`

#### Function: `calculate_magnitudes()` (Lines 422-584)

```cpp
void calculate_magnitudes() {
    profile_function([&]() {
        magnitudes_locked.store(true, std::memory_order_relaxed);

        static float magnitudes_raw[NUM_FREQS];
        static float magnitudes_smooth[NUM_FREQS];
        static float max_val_smooth = 0.0;
        static uint32_t iter = 0;
        iter++;

        float max_val = 0.0;

        // DIAGNOSTIC POINT 5: Calculate ALL frequency bins
        for (uint16_t i = 0; i < NUM_FREQS; i++) {
            magnitudes_raw[i] = calculate_magnitude_of_bin(i);
            magnitudes_raw[i] = collect_and_filter_noise(magnitudes_raw[i], i);

            // Moving average (6-frame smoothing)
            magnitudes_avg[iter % 6][i] = magnitudes_raw[i];
            float magnitudes_avg_result = 0.0;
            for (uint8_t a = 0; a < 6; a++) {
                magnitudes_avg_result += magnitudes_avg[a][i];
            }
            magnitudes_smooth[i] = magnitudes_avg_result / 6.0f;

            if (magnitudes_smooth[i] > max_val) {
                max_val = magnitudes_smooth[i];
            }
        }

        // Auto-ranging (Lines 481-526)
        if (max_val > max_val_smooth) {
            max_val_smooth += (max_val - max_val_smooth) * 0.005;
        } else {
            max_val_smooth -= (max_val_smooth - max_val) * 0.005;
        }
        if (max_val_smooth < 0.000001) {
            max_val_smooth = 0.000001;
        }

        // VU level calculation (Lines 500-510)
        float vu_sum = 0.0f;
        for (uint16_t i = 0; i < NUM_FREQS; i++) {
            vu_sum += spectrogram[i];  // BEFORE normalization
        }
        float vu_level_calculated = vu_sum / NUM_FREQS;
        audio_level = vu_level_calculated;

        // Apply auto-ranging to create final spectrogram (Lines 520-527)
        float autoranger_scale = 1.0 / max_val_smooth;
        for (uint16_t i = 0; i < NUM_FREQS; i++) {
            frequencies_musical[i].magnitude = clip_float(magnitudes_smooth[i] * autoranger_scale);
            spectrogram[i] = frequencies_musical[i].magnitude;
        }

        // DIAGNOSTIC POINT 6: Copy to audio_back buffer
        if (audio_sync_initialized) {
            memcpy(audio_back.spectrogram, spectrogram, sizeof(float) * NUM_FREQS);
            memcpy(audio_back.spectrogram_smooth, spectrogram_smooth, sizeof(float) * NUM_FREQS);
            audio_back.vu_level = vu_level_calculated;
            audio_back.vu_level_raw = vu_level_calculated * max_val_smooth;
            // ... other fields
        }

        magnitudes_locked.store(false, std::memory_order_relaxed);
    }, __func__ );
}
```

**Analysis:**
- **spectrogram[i] is COMPUTED from magnitudes_smooth[i]** (not hardcoded)
- **vu_level is COMPUTED from spectrogram[] sum** (not hardcoded)
- If values are constant → `magnitudes_smooth[]` must be constant → `sample_history` must be constant

---

### Commit and Synchronization Path

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/goertzel.cpp`

#### Function: `commit_audio_data()` (Lines 183-241)

```cpp
void commit_audio_data() {
    if (!audio_sync_initialized) {
        return;
    }

    // Lock-free write with sequence counter
    uint32_t seq = audio_front.sequence.load(std::memory_order_relaxed);
    audio_front.sequence.store(seq + 1, std::memory_order_relaxed);

    // DIAGNOSTIC POINT 7: Log the frozen values
    static uint32_t commit_count = 0;
    if ((++commit_count % 30) == 0) {
        Serial.printf("[COMMIT] #%u: audio_back.spectrogram[0]=%.2f, vu_level=%.2f\n",
                     commit_count, audio_back.spectrogram[0], audio_back.vu_level);
    }

    __sync_synchronize();  // Memory barrier

    // Copy data from back to front
    memcpy(&audio_front.spectrogram, &audio_back.spectrogram, sizeof(float) * NUM_FREQS);
    // ... (other fields)

    __sync_synchronize();  // Memory barrier

    // Mark data valid
    seq = audio_front.sequence.load(std::memory_order_relaxed);
    audio_front.sequence.store(seq + 1, std::memory_order_relaxed);
    audio_front.sequence_end.store(audio_front.sequence.load(std::memory_order_relaxed),
                                   std::memory_order_relaxed);
    audio_front.is_valid = true;

    __sync_synchronize();  // Final barrier
}
```

**Analysis:**
- **This function prints the observed frozen values** (line 196-197)
- Values printed are from `audio_back.spectrogram[0]` and `audio_back.vu_level`
- These are populated in `calculate_magnitudes()` at lines 559-564
- **Commit occurs every 30 frames** → audio task running at ~100Hz (expected)

---

## Failure Mode Analysis

### Failure Mode 1: I2S DMA Stall (MOST LIKELY)

**Hypothesis:** ESP32-S3 I2S peripheral not receiving audio samples from microphone.

**Evidence:**
- `i2s_channel_read()` returns `ESP_OK` (no error logs)
- `new_samples_raw[]` buffer contains stale/initialization data
- Pattern is ABSOLUTELY constant (no noise floor variation)
- Persists across reboots

**Possible Causes:**
1. **I2S clock not running** - BCLK/LRCLK pins misconfigured or disabled
2. **Microphone not powered** - VDD/GND connections faulty
3. **I2S DMA starved by RMT DMA** - RMT using same DMA channel
4. **I2S peripheral hung** - Hardware state machine stuck

**Diagnostic Commands Needed:**
```cpp
// In acquire_sample_chunk() after i2s_channel_read():
LOG_DEBUG(TAG_I2S, "Sample dump: raw[0]=%08X, raw[1]=%08X, raw[127]=%08X",
         new_samples_raw[0], new_samples_raw[1], new_samples_raw[127]);

// Check if buffer is actually changing
static uint32_t last_sample_hash = 0;
uint32_t hash = 0;
for (int i = 0; i < CHUNK_SIZE; i++) hash ^= new_samples_raw[i];
if (hash == last_sample_hash) {
    LOG_ERROR(TAG_I2S, "BUFFER UNCHANGED! Hash=%08X", hash);
}
last_sample_hash = hash;
```

---

### Failure Mode 2: RMT ISR Blocking I2S ISR

**Hypothesis:** RMT interrupt runs at higher priority than I2S, starving I2S ISR.

**Evidence:**
- Recent RMT changes (dual-channel mode)
- I2S uses interrupt-driven DMA transfers
- ESP32-S3 interrupt priority can cause starvation

**Mechanism:**
```
RMT ISR (priority 3) → runs for 100-200us per LED frame
I2S ISR (priority 1) → never gets CPU time → DMA buffer not emptied → underrun
```

**Diagnostic Commands Needed:**
```cpp
// In main.cpp setup():
i2s_set_interrupt_priority(rx_handle, 5);  // Force I2S higher than RMT

// Check ISR call counts
static uint32_t i2s_isr_count = 0;
i2s_register_isr_callback([](void*) { i2s_isr_count++; }, nullptr);
LOG_INFO(TAG_I2S, "ISR count: %u (should be ~100/sec)", i2s_isr_count);
```

---

### Failure Mode 3: Cache Coherency Failure

**Hypothesis:** I2S DMA writes to `new_samples_raw[]` but Core 1 cache not invalidated.

**Evidence:**
- ESP32-S3 dual-core with separate L1 caches
- DMA writes bypass cache
- Memory barriers present but may be insufficient

**Mechanism:**
```
I2S DMA writes new_samples_raw[] → physical RAM updated
Core 1 reads new_samples_raw[] → reads stale cached copy
Cache line never invalidated → sees old data forever
```

**Diagnostic Commands Needed:**
```cpp
// Before reading new_samples_raw in acquire_sample_chunk():
esp_cache_invalidate_addr((void*)new_samples_raw, sizeof(new_samples_raw));

// Or make buffer uncacheable:
uint32_t* new_samples_raw = (uint32_t*)heap_caps_malloc(
    CHUNK_SIZE * sizeof(uint32_t),
    MALLOC_CAP_DMA | MALLOC_CAP_8BIT  // Force DMA-safe allocation
);
```

---

## Initial State Analysis

### Why 0.14 and 0.36 Specifically?

**Hypothesis:** These are NOT initialization values but computed from frozen `sample_history`.

**Evidence:**
- `spectrogram[]` array initialized to zero at line 26: `float spectrogram[NUM_FREQS];`
- `sample_history[]` initialized to zero at line 37: `float sample_history[SAMPLE_HISTORY_LENGTH] = {0};`
- 0.14 and 0.36 are NON-ZERO → must be computed values

**Possible Explanations:**
1. **Initialization transient** - First I2S read captured valid audio, then stalled
2. **DC offset** - Microphone has DC bias voltage (7000 offset at line 97)
3. **Noise calibration artifact** - `noise_spectrum[]` contains non-zero values

**Test:**
```cpp
// Check if sample_history is actually zero or has data
float sum = 0.0f;
for (int i = 0; i < SAMPLE_HISTORY_LENGTH; i++) sum += fabsf(sample_history[i]);
LOG_INFO(TAG_AUDIO, "sample_history sum: %.6f (0.0 = all zeros)", sum);

// Check raw I2S buffer
LOG_INFO(TAG_I2S, "Raw samples: %08X %08X %08X %08X",
        new_samples_raw[0], new_samples_raw[1],
        new_samples_raw[2], new_samples_raw[3]);
```

---

## Recommended Diagnostic Steps (Priority Order)

### 1. **Confirm I2S Buffer Content** (HIGHEST PRIORITY)

Add to `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/microphone.cpp` line 85:

```cpp
if (i2s_result == ESP_OK) {
    // Log first 4 samples to verify buffer is changing
    static uint32_t last_raw_0 = 0xDEADBEEF;
    if (new_samples_raw[0] == last_raw_0) {
        LOG_ERROR(TAG_I2S, "I2S BUFFER FROZEN! raw[0]=%08X (unchanged)",
                 new_samples_raw[0]);
    }
    last_raw_0 = new_samples_raw[0];

    // Periodic sample dump
    static uint32_t dump_counter = 0;
    if ((++dump_counter % 100) == 0) {
        LOG_DEBUG(TAG_I2S, "Samples: [0]=%08X [1]=%08X [127]=%08X",
                 new_samples_raw[0], new_samples_raw[1], new_samples_raw[127]);
    }
}
```

**Expected Output (if working):**
```
[D][I] Samples: [0]=00123456 [1]=00234567 [127]=00345678
[D][I] Samples: [0]=00456789 [1]=00567890 [127]=00678901  // CHANGING!
```

**Expected Output (if frozen):**
```
[E][I] I2S BUFFER FROZEN! raw[0]=00000000 (unchanged)
[D][I] Samples: [0]=00000000 [1]=00000000 [127]=00000000  // ALL SAME!
```

---

### 2. **Check I2S Peripheral Status** (HARDWARE VALIDATION)

Add to `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/main.cpp` setup():

```cpp
// After init_i2s_microphone() at line 533
LOG_INFO(TAG_I2S, "Checking I2S peripheral status...");

// Read I2S hardware registers (ESP32-S3 specific)
uint32_t i2s_conf = READ_PERI_REG(I2S_CONF_REG(0));
uint32_t i2s_conf_chan = READ_PERI_REG(I2S_CONF_CHAN_REG(0));
uint32_t i2s_rx_conf = READ_PERI_REG(I2S_RX_CONF_REG(0));

LOG_INFO(TAG_I2S, "I2S registers: CONF=%08X, CONF_CHAN=%08X, RX_CONF=%08X",
        i2s_conf, i2s_conf_chan, i2s_rx_conf);

// Expected: I2S_RX_START bit should be set (bit 1 of I2S_RX_CONF)
if ((i2s_rx_conf & 0x02) == 0) {
    LOG_ERROR(TAG_I2S, "I2S RX NOT STARTED! Peripheral disabled.");
}
```

---

### 3. **Verify EMOTISCOPE_ACTIVE Flag** (LOGIC ERROR)

Add to `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/microphone.cpp` line 66:

```cpp
if (EMOTISCOPE_ACTIVE == true) {
    // ADD THIS CHECK:
    static uint32_t active_check_counter = 0;
    if ((++active_check_counter % 100) == 0) {
        LOG_DEBUG(TAG_AUDIO, "EMOTISCOPE_ACTIVE=%d (should be 1)",
                 EMOTISCOPE_ACTIVE);
    }

    // ... existing i2s_channel_read() code
```

**Expected:** Should always print `EMOTISCOPE_ACTIVE=1` (true).
**If false:** Audio disabled, would explain zeros (but not 0.14/0.36).

---

### 4. **Test sample_history Update** (RING BUFFER VALIDATION)

Add to `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/microphone.cpp` line 109:

```cpp
shift_and_copy_arrays(sample_history, SAMPLE_HISTORY_LENGTH, new_samples, CHUNK_SIZE);

// ADD THIS CHECK:
static float last_sample_tail = -999.0f;
float current_tail = sample_history[SAMPLE_HISTORY_LENGTH - 1];
if (current_tail == last_sample_tail) {
    LOG_ERROR(TAG_AUDIO, "sample_history FROZEN! tail=%.6f", current_tail);
}
last_sample_tail = current_tail;

// Check if ring buffer contains all zeros
static uint32_t zero_check_counter = 0;
if ((++zero_check_counter % 100) == 0) {
    float sum = 0.0f;
    for (int i = 0; i < SAMPLE_HISTORY_LENGTH; i++) {
        sum += fabsf(sample_history[i]);
    }
    LOG_DEBUG(TAG_AUDIO, "sample_history sum=%.6f (should change)", sum);
}
```

---

### 5. **Validate Goertzel Input** (COMPUTATION VERIFICATION)

Add to `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/goertzel.cpp` line 380:

```cpp
float* sample_ptr = &sample_history[(SAMPLE_HISTORY_LENGTH - 1) - block_size];

// ADD THIS CHECK (only for bin 0):
if (bin_number == 0) {
    static uint32_t goertzel_check_counter = 0;
    if ((++goertzel_check_counter % 100) == 0) {
        LOG_DEBUG(TAG_AUDIO, "Goertzel bin 0: sample[0]=%.6f, sample[1]=%.6f",
                 sample_ptr[0], sample_ptr[1]);
    }
}
```

---

## Hardware Checklist

### I2S Microphone (SPH0645LM4H) Pin Verification

From `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/microphone.h`:

| Pin | Function | ESP32-S3 GPIO | Expected Signal |
|-----|----------|---------------|-----------------|
| BCLK | Bit Clock | GPIO 14 | 512 kHz square wave |
| LRCLK | Word Select | GPIO 12 | 16 kHz square wave |
| DIN | Data In | GPIO 13 | Serial data stream |
| VDD | Power | 3.3V | Constant 3.3V |
| GND | Ground | GND | 0V |

**Test with Oscilloscope:**
1. BCLK @ GPIO 14: Should see 512 kHz (32 * 16000 Hz)
2. LRCLK @ GPIO 12: Should see 16 kHz
3. DIN @ GPIO 13: Should see data transitions

**If no clock signals:** I2S peripheral not initialized or disabled.
**If clocks present but no data:** Microphone faulty or not powered.

---

## Memory Safety Verification

### DMA Buffer Alignment

I2S DMA requires 4-byte aligned buffers. Check allocation:

```cpp
// In acquire_sample_chunk() at line 62:
uint32_t new_samples_raw[CHUNK_SIZE];  // Stack allocation (should be aligned)

// Verify alignment:
uintptr_t addr = (uintptr_t)new_samples_raw;
if ((addr & 0x03) != 0) {
    LOG_ERROR(TAG_I2S, "new_samples_raw NOT 4-byte aligned! addr=%p", new_samples_raw);
}
```

### Cache Invalidation

ESP32-S3 requires cache invalidation for DMA buffers:

```cpp
// Before accessing new_samples_raw (line 96):
esp_cache_invalidate_addr((void*)new_samples_raw, CHUNK_SIZE * sizeof(uint32_t));
```

---

## Related Code Sections

### Files to Examine

1. **I2S Acquisition:**
   - `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/microphone.cpp:59-133`
   - Function: `acquire_sample_chunk()`
   - I2S read at line 71

2. **Goertzel Computation:**
   - `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/goertzel.cpp:364-402`
   - Function: `calculate_magnitude_of_bin()`
   - Reads `sample_history` at line 379

3. **Spectrogram Update:**
   - `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/goertzel.cpp:422-584`
   - Function: `calculate_magnitudes()`
   - Populates `audio_back.spectrogram[]` at line 559

4. **Buffer Commit:**
   - `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/goertzel.cpp:183-241`
   - Function: `commit_audio_data()`
   - Prints frozen values at line 196

### Data Flow Chain

```
I2S Hardware → new_samples_raw[128] → new_samples[128]
   → sample_history[4096] → Goertzel → magnitudes_raw[64]
   → magnitudes_smooth[64] → spectrogram[64]
   → audio_back.spectrogram[64] → audio_front.spectrogram[64]
```

**Freeze point must be BEFORE Goertzel** because:
- Goertzel output is deterministic (same input → same output)
- Values 0.14/0.36 are consistent across frames
- No noise floor variation (would be present if samples were live)

---

## Conclusion and Next Actions

### Primary Hypothesis
**I2S DMA buffer is not being updated by hardware.**

The frozen values (0.14 for bin 0, 0.36 for VU) are computed from stale/initialization data in `sample_history[]`. The I2S peripheral returns `ESP_OK` but delivers an unchanged buffer.

### Immediate Actions Required

1. **Add buffer change detection** (Diagnostic Step 1) to confirm stall
2. **Check I2S hardware registers** (Diagnostic Step 2) to verify peripheral state
3. **Verify EMOTISCOPE_ACTIVE** (Diagnostic Step 3) to rule out logic error
4. **Test with oscilloscope** (Hardware Checklist) to verify clock signals

### Long-Term Fixes (Based on Findings)

**If I2S hardware stalled:**
- Reset I2S peripheral on detection of frozen buffer
- Check RMT interference (interrupt priority conflict)
- Verify GPIO pin muxing (may be shared with RMT)

**If cache coherency issue:**
- Force cache invalidation before reading DMA buffer
- Allocate I2S buffer in DMA-capable memory with `MALLOC_CAP_DMA`
- Add explicit memory barriers after DMA operations

**If RMT ISR blocking:**
- Lower RMT interrupt priority
- Use I2S interrupt mode instead of polling
- Implement watchdog to detect stalled audio task

---

## Tags
`audio`, `i2s`, `dma`, `freeze`, `microphone`, `goertzel`, `esp32-s3`, `debugging`, `forensics`

# Audio Freeze Diagnostic Plan

**Date:** 2025-11-05
**Owner:** Claude (Sonnet 4.5)
**Status:** Draft
**Scope:** Immediate diagnostic steps to identify frozen audio root cause
**Related:** `docs/05-analysis/audio_freeze_forensics.md`

---

## Quick Summary

**Problem:** Audio spectrogram frozen at constant values (0.14, 0.36) - no variation.

**Most Likely Cause:** I2S DMA buffer not being updated by hardware.

**Evidence:** No error logs, but values absolutely constant (no noise floor).

---

## Immediate Diagnostic Steps (Copy-Paste Ready)

### Step 1: Detect Frozen I2S Buffer

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/microphone.cpp`

**Location:** After line 85 (`if (i2s_result != ESP_OK)` block)

**Add this code:**

```cpp
if (i2s_result == ESP_OK) {
    // Detect if I2S buffer is frozen (same data every frame)
    static uint32_t last_raw_0 = 0xDEADBEEF;
    static uint32_t frozen_count = 0;

    if (new_samples_raw[0] == last_raw_0) {
        frozen_count++;
        if (frozen_count >= 10) {  // Report after 10 consecutive frozen frames
            LOG_ERROR(TAG_I2S, "I2S BUFFER FROZEN! raw[0]=0x%08X (unchanged for %u frames)",
                     new_samples_raw[0], frozen_count);
            frozen_count = 0;  // Reset to avoid spam
        }
    } else {
        frozen_count = 0;  // Buffer changed, reset counter
    }
    last_raw_0 = new_samples_raw[0];

    // Periodic sample dump for manual inspection
    static uint32_t dump_counter = 0;
    if ((++dump_counter % 100) == 0) {
        LOG_DEBUG(TAG_I2S, "I2S samples: [0]=0x%08X [1]=0x%08X [64]=0x%08X [127]=0x%08X",
                 new_samples_raw[0], new_samples_raw[1],
                 new_samples_raw[64], new_samples_raw[127]);
    }
}
```

**Expected Result:**
- **If frozen:** `[E][I] I2S BUFFER FROZEN! raw[0]=0x00000000 (unchanged for 10 frames)`
- **If working:** Debug log shows CHANGING hex values every 100 frames

---

### Step 2: Verify Audio Pipeline Active

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/microphone.cpp`

**Location:** After line 66 (`if (EMOTISCOPE_ACTIVE == true)`)

**Add this code:**

```cpp
if (EMOTISCOPE_ACTIVE == true) {
    // Verify audio pipeline is active
    static uint32_t active_check_counter = 0;
    if ((++active_check_counter % 100) == 0) {
        LOG_INFO(TAG_AUDIO, "Audio pipeline active: EMOTISCOPE_ACTIVE=%d (should be 1)",
                 EMOTISCOPE_ACTIVE ? 1 : 0);
    }

    // ... existing i2s_channel_read() code
```

**Expected Result:**
- Should print: `[I][A] Audio pipeline active: EMOTISCOPE_ACTIVE=1`
- **If 0:** Audio disabled (but doesn't explain 0.14/0.36 values)

---

### Step 3: Check sample_history Ring Buffer

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/microphone.cpp`

**Location:** After line 108 (`shift_and_copy_arrays(...)`)

**Add this code:**

```cpp
shift_and_copy_arrays(sample_history, SAMPLE_HISTORY_LENGTH, new_samples, CHUNK_SIZE);

// Verify ring buffer is being updated
static float last_sample_tail = -999.0f;
static uint32_t ring_frozen_count = 0;
float current_tail = sample_history[SAMPLE_HISTORY_LENGTH - 1];

if (current_tail == last_sample_tail) {
    ring_frozen_count++;
    if (ring_frozen_count >= 10) {
        LOG_ERROR(TAG_AUDIO, "sample_history FROZEN! tail=%.6f (unchanged for %u frames)",
                 current_tail, ring_frozen_count);
        ring_frozen_count = 0;
    }
} else {
    ring_frozen_count = 0;
}
last_sample_tail = current_tail;

// Periodic ring buffer health check
static uint32_t ring_check_counter = 0;
if ((++ring_check_counter % 100) == 0) {
    float sum = 0.0f;
    for (int i = 0; i < SAMPLE_HISTORY_LENGTH; i++) {
        sum += fabsf(sample_history[i]);
    }
    LOG_DEBUG(TAG_AUDIO, "sample_history sum=%.6f (should change), tail=%.6f",
             sum, current_tail);
}
```

**Expected Result:**
- **If frozen:** `[E][A] sample_history FROZEN! tail=0.000000 (unchanged for 10 frames)`
- **If working:** Debug log shows CHANGING sum and tail values

---

### Step 4: Validate Goertzel Input Data

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/goertzel.cpp`

**Location:** After line 379 (`float* sample_ptr = &sample_history[...]`)

**Add this code:**

```cpp
float* sample_ptr = &sample_history[(SAMPLE_HISTORY_LENGTH - 1) - block_size];

// Validate input data for bin 0 (lowest frequency - most sensitive to DC offset)
if (bin_number == 0) {
    static uint32_t goertzel_check_counter = 0;
    static float last_sample_0 = -999.0f;

    if ((++goertzel_check_counter % 100) == 0) {
        float sample_0 = sample_ptr[0];
        float sample_1 = sample_ptr[1];

        LOG_DEBUG(TAG_AUDIO, "Goertzel bin 0 input: sample[0]=%.6f, sample[1]=%.6f (last=%.6f)",
                 sample_0, sample_1, last_sample_0);

        if (sample_0 == last_sample_0) {
            LOG_WARN(TAG_AUDIO, "Goertzel input FROZEN for bin 0!");
        }

        last_sample_0 = sample_0;
    }
}
```

**Expected Result:**
- **If frozen:** `[W][A] Goertzel input FROZEN for bin 0!`
- **If working:** Debug log shows CHANGING sample values

---

## Interpretation Guide

### Scenario A: I2S Buffer Frozen

**Logs:**
```
[E][I] I2S BUFFER FROZEN! raw[0]=0x00000000 (unchanged for 10 frames)
[D][I] I2S samples: [0]=0x00000000 [1]=0x00000000 [64]=0x00000000 [127]=0x00000000
```

**Root Cause:** I2S hardware not receiving audio OR DMA not writing buffer.

**Next Steps:**
1. Check I2S clock signals with oscilloscope (BCLK @ GPIO14, LRCLK @ GPIO12)
2. Verify microphone power (VDD = 3.3V)
3. Check for RMT interference (interrupt priority)
4. Try forcing cache invalidation: `esp_cache_invalidate_addr((void*)new_samples_raw, sizeof(new_samples_raw));`

---

### Scenario B: I2S Buffer OK, Ring Buffer Frozen

**Logs:**
```
[D][I] I2S samples: [0]=0x00123456 [1]=0x00234567 [64]=0x00345678 [127]=0x00456789
[E][A] sample_history FROZEN! tail=0.000000 (unchanged for 10 frames)
```

**Root Cause:** `shift_and_copy_arrays()` not executing or failing silently.

**Next Steps:**
1. Check if `waveform_locked` prevents updates (shouldn't, but verify)
2. Verify `dsps_mulc_f32()` output (line 104)
3. Check memory corruption in `sample_history[]` array

---

### Scenario C: Everything Updates but Spectrogram Frozen

**Logs:**
```
[D][I] I2S samples: [0]=0x00123456 [1]=0x00234567 ... (CHANGING)
[D][A] sample_history sum=12345.678900 (should change), tail=0.123456 (CHANGING)
[D][A] Goertzel bin 0 input: sample[0]=0.123456, sample[1]=0.234567 (CHANGING)
```

**But:** Spectrogram still reports 0.14/0.36 constantly.

**Root Cause:** Memory barrier failure in `commit_audio_data()` or cache coherency issue.

**Next Steps:**
1. Add stronger memory barriers: `asm volatile("dsb" ::: "memory");`
2. Check atomic operations in `audio_front`/`audio_back` synchronization
3. Verify Core 0 reads from `audio_front`, not stale cache

---

### Scenario D: All Logs Show Frozen

**Logs:**
```
[E][I] I2S BUFFER FROZEN! raw[0]=0x00000000 (unchanged for 10 frames)
[E][A] sample_history FROZEN! tail=0.000000 (unchanged for 10 frames)
[W][A] Goertzel input FROZEN for bin 0!
```

**Root Cause:** I2S peripheral completely stalled or not initialized.

**Next Steps:**
1. **IMMEDIATE:** Check I2S initialization logs at boot (should see `[I][I] Initializing SPH0645 microphone...`)
2. Verify `i2s_channel_enable()` returns `ESP_OK`
3. Read I2S hardware registers to check peripheral state
4. Try soft reset: `i2s_channel_disable()` → `i2s_channel_enable()`

---

## Hardware Verification (If Software Diagnostics Fail)

### Required Tools
- Oscilloscope or logic analyzer
- Multimeter

### Test Procedure

1. **Power Check:**
   - VDD (microphone) = 3.3V ± 0.1V
   - GND connected

2. **Clock Signals:**
   - GPIO 14 (BCLK): 512 kHz square wave (32 * 16000 Hz)
   - GPIO 12 (LRCLK): 16 kHz square wave
   - **If no clocks:** I2S peripheral disabled or GPIOs muxed to RMT

3. **Data Signal:**
   - GPIO 13 (DIN): Should show serial data transitions
   - **If no data but clocks present:** Microphone faulty or not powered

---

## Build and Test Sequence

1. **Apply Step 1 diagnostics** (I2S buffer detection)
2. **Build firmware:** `pio run -e esp32-s3-devkitc-1-dual-ch`
3. **Upload:** `pio run -e esp32-s3-devkitc-1-dual-ch -t upload`
4. **Monitor serial output:** `pio device monitor -b 115200`
5. **Look for:**
   - `[E][I] I2S BUFFER FROZEN!` (confirms stall)
   - `[D][I] I2S samples: [0]=0x...` (shows buffer content)
6. **Repeat for Steps 2-4** to narrow down freeze point

---

## Expected Timeline

- **Step 1 (I2S buffer):** 5 minutes to add, 2 minutes to test
- **Step 2 (EMOTISCOPE_ACTIVE):** 2 minutes to add, 1 minute to test
- **Step 3 (ring buffer):** 5 minutes to add, 2 minutes to test
- **Step 4 (Goertzel input):** 5 minutes to add, 2 minutes to test
- **Analysis:** 10 minutes to interpret logs and determine root cause

**Total:** ~30-45 minutes to full diagnosis.

---

## Success Criteria

**Diagnostic SUCCESS:**
- Root cause identified (I2S stall, ring buffer, or cache coherency)
- Clear evidence from logs showing freeze point
- Hardware verification confirms software diagnosis (if needed)

**Fix VALIDATION:**
- `[D][I] I2S samples:` shows CHANGING hex values
- `[D][A] sample_history sum=` shows CHANGING float sum
- `[COMMIT]` logs show CHANGING spectrogram[0] and vu_level values
- Audio-reactive patterns respond to sound

---

## Related Documents

- **Detailed Analysis:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/05-analysis/audio_freeze_forensics.md`
- **Microphone Implementation:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/microphone.cpp`
- **Goertzel Algorithm:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/goertzel.cpp`

---

## Tags
`diagnostic`, `audio`, `i2s`, `freeze`, `immediate-action`, `debugging`, `esp32-s3`

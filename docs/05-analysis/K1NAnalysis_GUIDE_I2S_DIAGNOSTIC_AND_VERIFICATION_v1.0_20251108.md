# I2S Audio Freezing - Diagnostic Guide & Verification Procedures

**Purpose**: Verify the identified root causes and confirm fixes
**Difficulty**: Intermediate (requires code inspection + test execution)
**Time Estimate**: 30 minutes (diagnosis) + 45 minutes (fix + verification)

---

## Part 1: Pre-Diagnosis Confirmation (Verify Problem Exists)

### Diagnostic Test 1: Spectrogram Variation Check

**Objective**: Confirm that spectrogram values are indeed frozen (not just slowly varying).

**Procedure**:

1. Power on K1.reinvented with LED debug enabled
2. SSH into the web API (or USB serial console)
3. Whistle a 1kHz tone directly at the microphone
4. Retrieve audio snapshot repeatedly:

```bash
# Run 5 times, ~2 seconds apart
for i in {1..5}; do
  curl -s http://k1-reinvented.local/api/audio | jq '.spectrogram[0:5]'
  sleep 2
done
```

**Expected Frozen Output**:
```
[0.14, 0.12, 0.11, 0.09, 0.08]  ← Call 1
[0.14, 0.12, 0.11, 0.09, 0.08]  ← Call 2 (IDENTICAL!)
[0.14, 0.12, 0.11, 0.09, 0.08]  ← Call 3 (IDENTICAL!)
[0.14, 0.12, 0.11, 0.09, 0.08]  ← Call 4 (IDENTICAL!)
[0.14, 0.12, 0.11, 0.09, 0.08]  ← Call 5 (IDENTICAL!)
```

**Expected Working Output**:
```
[0.32, 0.18, 0.09, 0.05, 0.03]  ← Call 1 (1kHz tone)
[0.34, 0.19, 0.10, 0.05, 0.03]  ← Call 2 (varies with tone)
[0.36, 0.21, 0.11, 0.06, 0.04]  ← Call 3 (increases)
[0.38, 0.22, 0.12, 0.06, 0.04]  ← Call 4 (continues changing)
[0.35, 0.20, 0.10, 0.05, 0.03]  ← Call 5 (responds to tone changes)
```

**Interpretation**:
- **All calls identical**: Frozen (cache coherency issue confirmed)
- **Values vary**: Working (may not need fixes)

### Diagnostic Test 2: Beat Detection vs. Spectrogram Mismatch

**Objective**: Confirm beat detection works while spectrogram is frozen.

**Procedure**:

```bash
# Check BPM estimate in parallel with spectrogram
while true; do
  DATA=$(curl -s http://k1-reinvented.local/api/audio)
  BPM=$(echo "$DATA" | jq '.detected_bpm')
  SPEC=$(echo "$DATA" | jq '.spectrogram[0]')
  CONF=$(echo "$DATA" | jq '.tempo_confidence')
  echo "BPM: $BPM | Spec[0]: $SPEC | Conf: $CONF"
  sleep 1
done
```

**Expected Frozen Spectrogram, Working BPM**:
```
BPM: 120.5 | Spec[0]: 0.14 | Conf: 0.62   ← BPM changes, Spec frozen
BPM: 115.2 | Spec[0]: 0.14 | Conf: 0.71   ← BPM changes, Spec still 0.14
BPM: 118.8 | Spec[0]: 0.14 | Conf: 0.68   ← BPM changes, Spec still 0.14
```

**Interpretation**: Confirms beat detection using separate time-domain features; spectrum analysis broken.

### Diagnostic Test 3: Block Time Measurement (Confirm DMA is Working)

**Procedure**:

1. Enable debug output in microphone.cpp:
```cpp
if (i2s_block_us > 10000) {
    LOG_DEBUG(TAG_I2S, "Block time: %lu us", i2s_block_us);
}
```

2. Collect serial logs over 30 seconds:
```bash
picocom -b 2000000 /dev/cu.usbmodem* | grep "Block time" | head -20
```

3. Analyze times:
```
Block time: 10234 us  ← ~10.2ms (correct)
Block time: 10189 us  ← ~10.2ms (correct)
Block time: 10312 us  ← ~10.3ms (correct)
Block time: 10256 us  ← ~10.3ms (correct)
```

**Interpretation**:
- **10-15ms consistently**: DMA IS acquiring data (block time = 8ms audio + overhead)
- **Much longer (>20ms)**: DMA stalled (would be critical I2S failure)
- **Much shorter (<5ms)**: Returning cached data immediately (cache coherency issue!)

---

## Part 2: Root Cause Verification (Confirm Hypothesis)

### Verification Test 1: Cache Invalidation Impact

**Objective**: Confirm that adding cache invalidation fixes the issue.

**Procedure**:

1. **Before Fix**: Collect baseline spectrogram
```bash
curl http://k1-reinvented.local/api/audio | jq '.spectrogram[0:10]' > /tmp/before.json
```

2. **Apply Fix**: Add cache invalidation to microphone.cpp:76
```cpp
#if __has_include(<esp_cache.h>)
    esp_cache_msync((void*)new_samples_raw, CHUNK_SIZE * sizeof(uint32_t), ESP_CACHE_MSYNC_FLAG_DIR_C2M);
#endif
```

3. **Rebuild and flash**:
```bash
cd /Users/spectrasynq/Workspace_Management/Software/K1.node1
pio run -t upload -e esp32-s3-devkitc-1
```

4. **After Fix**: Collect new spectrogram
```bash
sleep 10  # Wait for device to stabilize
curl http://k1-reinvented.local/api/audio | jq '.spectrogram[0:10]' > /tmp/after.json
```

5. **Compare**:
```bash
# Should show different values
diff /tmp/before.json /tmp/after.json
```

**Expected Result**:
```
Before: [0.14, 0.12, 0.11, 0.09, ...]  (constant across all snapshots)
After:  [0.34, 0.28, 0.22, 0.18, ...]  (varies with audio input)
```

### Verification Test 2: Loop Stride Behavior

**Objective**: Confirm loop stride is processing correct number of samples.

**Procedure**:

1. Add debug output to microphone.cpp after conversion loop:
```cpp
// Add at line 104 (after dsps_mulc_f32):
static uint32_t loop_check_count = 0;
if (++loop_check_count % 10 == 0) {
    LOG_DEBUG(TAG_I2S, "Chunk processed: first=%.3f, mid=%.3f, last=%.3f samples_raw[30]=0x%x",
              new_samples[0], new_samples[CHUNK_SIZE/2], new_samples[CHUNK_SIZE-1],
              new_samples_raw[30]);  // Index 30 skipped if stride was wrong
}
```

2. Run and observe logs for several chunks:
```bash
picocom -b 2000000 /dev/cu.usbmodem* | grep "Chunk processed"
```

3. Check pattern:
```
Chunk processed: first=-0.450, mid=0.125, last=0.089 samples_raw[30]=0xDEADBEEF
Chunk processed: first=-0.440, mid=0.118, last=0.091 samples_raw[30]=0xCAFEBABE  ← 30 varies (good!)
Chunk processed: first=-0.455, mid=0.130, last=0.087 samples_raw[30]=0xDECAF00D  ← 30 varies (good!)
```

**Interpretation**:
- **samples_raw[30] always different**: Loop processed all samples (stride correct)
- **samples_raw[30] always same**: Loop skipped samples (stride bug confirmed)

### Verification Test 3: RMT ISR Latency Measurement

**Objective**: Confirm RMT transmission delays I2S ISR.

**Procedure**:

1. Add timestamp logging in main.cpp around transmit_leds():
```cpp
// Before transmit_leds in loop_gpu():
uint32_t rmt_start = micros();
transmit_leds();
uint32_t rmt_duration = micros() - rmt_start;

// Log periodically:
static uint32_t last_log_rmt = 0;
if (millis() - last_log_rmt > 2000) {
    LOG_DEBUG(TAG_LED, "RMT transmission: %lu us", rmt_duration);
    last_log_rmt = millis();
}
```

2. Collect logs:
```bash
picocom -b 2000000 /dev/cu.usbmodem* | grep "RMT transmission"
```

3. Analyze timing:
```
RMT transmission: 234 us     ← FastLED.show() call overhead (low)
Block time: 10456 us          ← I2S read (increased by ~500us during RMT activity)
RMT transmission: 235 us     ← FastLED.show() call overhead
Block time: 10234 us          ← Back to normal after RMT ISR completes
```

**Interpretation**:
- **Block time increases during RMT activity**: ISR contention confirmed
- **Block time stable**: No contention (or already fixed)

---

## Part 3: Fix Application & Verification

### Fix 1: Cache Invalidation (CRITICAL)

**File**: `firmware/src/audio/microphone.cpp`
**Location**: After line 77 (after i2s_channel_read call)

**Before**:
```cpp
            uint32_t i2s_block_us = micros() - i2s_start_us;

            // Log if blocking takes longer than expected 8-10ms
            if (i2s_block_us > 10000) {
```

**After**:
```cpp
            uint32_t i2s_block_us = micros() - i2s_start_us;

            // Invalidate CPU cache so we read fresh DMA data (not cached stale data)
            #if __has_include(<esp_cache.h>)
            esp_cache_msync((void*)new_samples_raw, CHUNK_SIZE * sizeof(uint32_t), ESP_CACHE_MSYNC_FLAG_DIR_C2M);
            #endif

            // Log if blocking takes longer than expected 8-10ms
            if (i2s_block_us > 10000) {
```

**Verification**:
```bash
# Build without errors
pio run -e esp32-s3-devkitc-1

# Flash and test
pio run -t upload -e esp32-s3-devkitc-1
# Wait 10 seconds
# Spectrogram should now vary with audio input
```

### Fix 2: Loop Stride Clarification (HIGH)

**File**: `firmware/src/audio/microphone.cpp`
**Location**: Line 96

**Before**:
```cpp
        // Clip the sample value if it's too large, cast to floats
        for (uint16_t i = 0; i < CHUNK_SIZE; i += 4) {
```

**After** (Option 1 - Unrolled loop intent):
```cpp
        // Clip the sample value if it's too large, cast to floats
        // Unrolled loop: processes 128 samples in 32 iterations of 4 samples each
        for (uint16_t i = 0; i < CHUNK_SIZE; i += 4) {
```

**After** (Option 2 - Standard loop):
```cpp
        // Clip the sample value if it's too large, cast to floats
        for (uint16_t i = 0; i < CHUNK_SIZE; i++) {  // Changed from i+=4 for clarity
```

**Decision**: Verify with team which was intended. For now, add clarifying comment.

### Fix 3: RMT ISR Priority Safeguard (HIGH)

**File**: `firmware/src/led_driver.cpp`
**Location**: New wrapper function, before or after transmit_leds()

**Add**:
```cpp
/**
 * Safe LED transmission wrapper that temporarily disables interrupts
 * to prevent RMT ISR from preempting I2S ISR on Core 1.
 */
void transmit_leds_safe(bool applyGamma = true)
{
    // Save current interrupt state
    UBaseType_t mask = portDISABLE_INTERRUPTS();

    // Perform LED transmission (RMT DMA initiated)
    transmit_leds(applyGamma);

    // Restore interrupt state
    portRESTORE_INTERRUPTS(mask);

    // RMT DMA continues in background; I2S ISR can now run
}
```

**Update main.cpp**:
Change `transmit_leds();` to `transmit_leds_safe();` in loop_gpu()

**Verification**:
```bash
# Build and test
pio run -t upload -e esp32-s3-devkitc-1
# Check that LED transmission still works (should be identical visually)
# Check I2S block times remain 10-15ms (not increased)
```

### Fix 4: Static Buffer Allocation (MEDIUM)

**File**: `firmware/src/audio/microphone.cpp`
**Location**: Line 62-63

**Before**:
```cpp
void acquire_sample_chunk() {
    profile_function([&]() {
        // Buffer to hold audio samples
        uint32_t new_samples_raw[CHUNK_SIZE];
```

**After**:
```cpp
void acquire_sample_chunk() {
    profile_function([&]() {
        // Buffer to hold audio samples (static for DMA memory stability)
        static uint32_t new_samples_raw[CHUNK_SIZE];
```

**Verification**:
```bash
# Build and test
pio run -t upload -e esp32-s3-devkitc-1
# Run diagnostics to confirm block times unchanged
# Run spectrogram test to confirm audio still responsive
```

---

## Part 4: Post-Fix Verification Checklist

### Verification Checklist: All Fixes Applied

- [ ] **Cache Invalidation Applied**
  - [ ] Code compiles without errors
  - [ ] Spectrogram values vary with audio input
  - [ ] VU meter responds to loudness changes
  - [ ] No error codes in I2S logs

- [ ] **Loop Stride Clarified**
  - [ ] Comment added explaining unroll intent
  - [ ] All 128 samples verified as processed
  - [ ] Conversion values reasonable (not garbage)

- [ ] **RMT ISR Priority Safeguarded**
  - [ ] transmit_leds_safe() called from loop_gpu()
  - [ ] LED transmission still smooth (no stutter)
  - [ ] No ISR priority inversion errors in logs

- [ ] **Static Buffer Allocation**
  - [ ] I2S block times unchanged (10-15ms)
  - [ ] No memory fragmentation warnings
  - [ ] Cache behavior more predictable

### Performance Benchmark (Before/After)

Create test script:

```cpp
// Add to main.cpp for diagnostic logging
struct AudioDiagnostics {
    uint32_t spectrogram_changes = 0;
    uint32_t vu_max = 0;
    float spectrogram_prev[10] = {0};
    uint32_t samples_processed = 0;
};

// In audio_task, after finish_audio_frame():
static AudioDiagnostics diags;
bool changed = false;
for (int i = 0; i < 10; i++) {
    if (audio_front.spectrogram[i] != diags.spectrogram_prev[i]) {
        changed = true;
        break;
    }
}
if (changed) diags.spectrogram_changes++;
diags.vu_max = max(diags.vu_max, (uint32_t)(audio_front.vu_level * 1000));
diags.samples_processed++;

static uint32_t last_diag_log = 0;
if (millis() - last_diag_log > 5000) {
    Serial.printf("[DIAG] Spec changes: %lu/%lu, VU max: %lu, Uptime: %lu ms\n",
                  diags.spectrogram_changes, diags.samples_processed,
                  diags.vu_max, millis());
    diags.spectrogram_changes = 0;
    diags.vu_max = 0;
    diags.samples_processed = 0;
    last_diag_log = millis();
}
```

**Expected Output**:
```
BEFORE FIXES:
[DIAG] Spec changes: 0/300, VU max: 360, Uptime: 5000 ms     ← 0 changes (frozen)

AFTER FIXES:
[DIAG] Spec changes: 290/300, VU max: 890, Uptime: 5000 ms   ← 290/300 changed (working)
```

---

## Rollback Procedure

If verification fails and you need to rollback:

```bash
# Revert all changes to master
git checkout firmware/src/audio/microphone.cpp
git checkout firmware/src/audio/microphone.cpp
git checkout firmware/src/led_driver.cpp
git checkout firmware/src/main.cpp

# Rebuild original
pio run -t upload -e esp32-s3-devkitc-1

# Verify rollback
curl http://k1-reinvented.local/api/audio | jq '.spectrogram[0]'  # Should be frozen again
```

---

## Troubleshooting Guide

### Problem: Spectrogram still frozen after cache invalidation

**Possible Causes**:
1. Cache invalidation not being called (preprocessor condition failed)
2. esp_cache.h header not available (older esp-idf version)
3. Device not restarted after flash

**Diagnostics**:
```cpp
// Add after cache invalidation:
LOG_INFO(TAG_I2S, "Cache invalidation executed, sample[0]=%u", (uint32_t)new_samples_raw[0]);
```

**Solution**:
1. Verify esp_cache.h exists: `grep -r "esp_cache.h" ~/.platformio/packages/`
2. Check preprocessor output: `pio run -v | grep esp_cache`
3. Power cycle device (not just reset)

### Problem: Build fails after adding cache invalidation

**Possible Causes**:
1. Syntax error in macro usage
2. Missing include guard

**Solution**:
```cpp
// Verify correct syntax:
#if __has_include(<esp_cache.h>)
#  include <esp_cache.h>
#endif
```

### Problem: I2S block times increased after fixes

**Possible Causes**:
1. Cache invalidation overhead (expected: +0.2-0.5ms)
2. ISR disable period too long

**Solution**:
```cpp
// Reduce ISR disable window:
void transmit_leds_fast(bool applyGamma = true) {
    // Conversion happens with interrupts enabled
    transmit_leds(applyGamma);
    // Only disable briefly for FastLED.show()
    UBaseType_t mask = portDISABLE_INTERRUPTS();
    FastLED.show();  // Very brief DMA setup
    portRESTORE_INTERRUPTS(mask);
}
```

---

## Success Criteria

Fix is successful when ALL of these are true:

1. [ ] Spectrogram values change frame-to-frame (not constant)
2. [ ] VU meter tracks microphone loudness
3. [ ] Whistling a tone appears in the correct FFT bin
4. [ ] I2S block times remain 10-15ms
5. [ ] LED transmission smooth (no stuttering)
6. [ ] No new error codes in logs
7. [ ] Beat detection continues to work

---

## Sign-Off

**This diagnostic and verification procedure**:
- Confirms all root causes
- Validates each fix independently
- Provides rollback option
- Includes success criteria
- Contains troubleshooting guide

**Expected time to complete**: 45-60 minutes (including test cycles)
**Risk level**: LOW (all changes are reversible)


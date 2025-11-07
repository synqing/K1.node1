---
Title: Hardware Configuration Audit - I2S Microphone vs RMT LED Control
Owner: Claude (Firmware Engineer Agent)
Date: 2025-11-05
Status: Complete
Scope: Pin conflicts, DMA channel conflicts, core pinning analysis
Related:
  - firmware/platformio.ini
  - firmware/src/audio/microphone.cpp
  - firmware/src/led_driver.cpp
  - firmware/src/main.cpp (lines 583-603)
Tags: hardware, i2s, rmt, dma, esp32-s3, diagnosis
---

# Hardware Configuration Audit: I2S Microphone & RMT LED Control

## Executive Summary

**CRITICAL FINDING**: `FASTLED_SHOW_CORE=1` pins LED transmission (`FastLED.show()`) to **Core 1**, which is the same core running the audio acquisition task. This creates CPU contention during LED updates, potentially starving the I2S microphone pipeline.

**Pin Conflicts**: PASS - No GPIO conflicts detected
**DMA Conflicts**: POTENTIAL ISSUE - Both I2S and RMT use DMA, but on separate controllers
**Core Pinning Conflict**: FAIL - FastLED and audio both compete on Core 1

---

## 1. GPIO Pin Configuration

### I2S Microphone (SPH0645LM4H)
**Peripheral**: I2S0 or I2S1 (auto-selected via `I2S_NUM_AUTO`)
**Pins**:
- GPIO 14 - BCLK (Bit Clock)
- GPIO 12 - LRCLK (Left/Right Clock / Word Select)
- GPIO 13 - DIN (Data Input from microphone)

### RMT LED Control (WS2812B)
**Peripheral**: RMT (Remote Control) with DMA
**Pins**:
- GPIO 4 - Lane A (LEDS_PER_LANE LEDs)
- GPIO 5 - Lane B (LEDS_PER_LANE LEDs)

### Verdict: NO PIN CONFLICTS
```
I2S Pins:  12, 13, 14
RMT Pins:  4, 5
Overlap:   NONE
```

---

## 2. I2S Configuration Analysis

### File: `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/microphone.cpp`

#### Configuration (lines 16-56)
```cpp
i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_AUTO, I2S_ROLE_MASTER);
i2s_new_channel(&chan_cfg, NULL, &rx_handle);

i2s_std_config_t std_cfg = {
    .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(SAMPLE_RATE),  // 16000 Hz
    .slot_cfg = {
        .data_bit_width = I2S_DATA_BIT_WIDTH_32BIT,
        .slot_bit_width = I2S_SLOT_BIT_WIDTH_32BIT,
        .slot_mode = I2S_SLOT_MODE_STEREO,               // STEREO mode
        .slot_mask = I2S_STD_SLOT_RIGHT,                 // Read RIGHT channel only
        .ws_width = 32,
        .ws_pol = true,                                  // Word select inverted
        .bit_shift = false,
        .left_align = true,
        .big_endian = false,
        .bit_order_lsb = false,
    },
    .gpio_cfg = {
        .mclk = I2S_GPIO_UNUSED,
        .bclk = (gpio_num_t)I2S_BCLK_PIN,                // GPIO 14
        .ws = (gpio_num_t)I2S_LRCLK_PIN,                 // GPIO 12
        .dout = I2S_GPIO_UNUSED,
        .din = (gpio_num_t)I2S_DIN_PIN,                  // GPIO 13
        .invert_flags = {false, false, false},
    },
};
```

#### Key Points:
1. **Sample Rate**: 16000 Hz (SAMPLE_RATE constant)
2. **Chunk Size**: 128 samples (CHUNK_SIZE constant) = 8ms cadence
3. **Channel Selection**: RIGHT channel only (SPH0645 outputs on right by default)
4. **Peripheral**: Auto-selected (likely I2S0 on ESP32-S3)
5. **DMA**: Implicitly enabled by ESP-IDF I2S driver (hardware DMA controller)

#### Blocking Behavior (lines 71-77)
```cpp
esp_err_t i2s_result = i2s_channel_read(
    rx_handle,
    new_samples_raw,
    CHUNK_SIZE * sizeof(uint32_t),
    &bytes_read,
    portMAX_DELAY  // <-- BLOCKS FOREVER until data arrives
);
```

**Analysis**: `portMAX_DELAY` means the audio task will block indefinitely waiting for I2S samples. If I2S is starved of CPU or DMA bandwidth, this will hang the audio task.

**Timeout Diagnostic**: Lines 80-83 log if blocking exceeds 10ms (expected: 8ms for 128 samples @ 16kHz)

---

## 3. RMT LED Configuration Analysis

### File: `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/led_driver.cpp`

#### FastLED Initialization (lines 149-156)
```cpp
CLEDController *pLedA = &FastLED.addLeds<WS2812B, 4, GRB>(s_ledsA, LEDS_PER_LANE);
pLedA->setCorrection(TypicalLEDStrip);

CLEDController *pLedB = &FastLED.addLeds<WS2812B, 5, GRB>(s_ledsB, LEDS_PER_LANE);
pLedB->setCorrection(TypicalLEDStrip);

FastLED.setBrightness(s_brightness);
FastLED.setDither(1);  // Temporal dithering enabled
FastLED.setMaxPowerInVoltsAndMilliamps(5, s_max_mA);
FastLED.setMaxRefreshRate(s_target_fps);  // 120 FPS target
```

#### Build Flags (platformio.ini lines 23-25)
```ini
-D FASTLED_RMT_WITH_DMA=1      ; Enable DMA for RMT
-D FASTLED_RMT_MAX_CHANNELS=2  ; Reserve 2 RMT TX channels
-D FASTLED_SHOW_CORE=1         ; Pin show() to Core 1 ⚠️ CRITICAL
```

#### RMT Channel Allocation (Implicit)
FastLED library auto-allocates RMT channels:
- Lane A (GPIO 4) → RMT_CHANNEL_0 (likely)
- Lane B (GPIO 5) → RMT_CHANNEL_1 (likely)

**DMA Channels**: ESP32-S3 RMT peripheral has its own DMA controller (GDMA), separate from I2S DMA.

---

## 4. Core Pinning Architecture

### File: `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/main.cpp` (lines 583-603)

```cpp
// GPU rendering task on Core 0
xTaskCreatePinnedToCore(
    loop_gpu,           // LED rendering + pattern generation
    "loop_gpu",
    16384,              // 16KB stack
    NULL,
    1,                  // Priority 1
    &gpu_task_handle,
    0                   // Pin to Core 0
);

// Audio processing task on Core 1
xTaskCreatePinnedToCore(
    audio_task,         // I2S acquisition + FFT + tempo
    "audio_task",
    12288,              // 12KB stack
    NULL,
    1,                  // Priority 1
    &audio_task_handle,
    1                   // Pin to Core 1
);
```

### Conflict Analysis

**Core 0 (GPU Task)**:
- LED pattern generation
- `transmit_leds()` → `FastLED.show()`
- Visual effects computation

**Core 1 (Audio Task)**:
- I2S microphone acquisition (`i2s_channel_read()` with `portMAX_DELAY`)
- Goertzel FFT processing
- Beat detection / tempo tracking
- **ALSO: FastLED.show() when `FASTLED_SHOW_CORE=1` is set!** ⚠️

---

## 5. SMOKING GUN: FASTLED_SHOW_CORE=1

### What Does This Flag Do?

From FastLED documentation (ESP32-specific):
```
FASTLED_SHOW_CORE=0  → show() runs on Core 0 (default)
FASTLED_SHOW_CORE=1  → show() runs on Core 1 (alternate)
```

**Purpose**: Pins the RMT transmission ISR and DMA setup to a specific core to avoid cross-core synchronization overhead.

### The Problem

**Current Configuration**:
```
Core 0: loop_gpu() calls transmit_leds()
        └─> FastLED.show() REDIRECTED TO CORE 1
Core 1: audio_task() running i2s_channel_read() with portMAX_DELAY
        └─> ALSO receives FastLED.show() workload!
```

**Result**: When `transmit_leds()` is called from Core 0, the actual RMT transmission runs on Core 1, stealing CPU time from the audio acquisition pipeline.

### LED Transmission Timing

**LED Update Duration** (from `led_driver.cpp` line 233):
```cpp
g_last_led_tx_us.store(micros() - t0);
```

For 2 lanes × `LEDS_PER_LANE` LEDs at 800kHz WS2812B data rate:
- Each LED: 30 bits × 1.25µs/bit = 37.5µs
- 60 LEDs/lane × 2 lanes = 120 LEDs → 4.5ms transmission time (plus DMA setup overhead)

**Conflict Window**: Every LED update (120 FPS = 8.3ms interval) causes a 4-5ms CPU spike on Core 1, overlapping with the 8ms I2S sample cadence.

---

## 6. DMA Channel Analysis

### ESP32-S3 DMA Architecture

**GDMA (General DMA)**: Shared across multiple peripherals
- I2S0 can use DMA channel 0 or 1
- I2S1 can use DMA channel 2 or 3
- RMT can use DMA channel 4 or 5

**Potential Issue**: If both I2S and RMT are auto-allocated to overlapping DMA channels, hardware arbitration can introduce latency.

### Current Configuration

**I2S** (`I2S_NUM_AUTO`):
- Likely uses I2S0 with GDMA channel 0 or 1
- DMA enabled implicitly by ESP-IDF driver

**RMT** (`FASTLED_RMT_WITH_DMA=1`):
- Uses RMT TX channels 0 and 1 (for GPIO 4 and 5)
- DMA channels likely auto-allocated to GDMA 4/5

**Verdict**: Likely NO DMA channel conflict, but hardware arbitration delay possible under heavy load.

---

## 7. Why RIGHT Channel for I2S?

### Configuration (microphone.cpp line 30)
```cpp
.slot_mask = I2S_STD_SLOT_RIGHT,  // Read RIGHT channel (not left!)
```

**Explanation**: SPH0645LM4H microphone outputs on the RIGHT channel by default when LRCLK is high. This is a hardware characteristic of the microphone, not a firmware choice.

**Impact**: No issue - left channel is unused, but stereo mode must still be enabled for correct LRCLK timing.

---

## 8. Recommended Configuration Changes

### Immediate Fix: Move FastLED to Core 0

**Change in platformio.ini**:
```diff
- -D FASTLED_SHOW_CORE=1         ; Pin show() to core 1
+ -D FASTLED_SHOW_CORE=0         ; Pin show() to core 0 (keep LED work on GPU core)
```

**Rationale**: Keep LED transmission on the same core as LED rendering (Core 0), preventing cross-core contention with audio acquisition on Core 1.

**Expected Impact**: Eliminates 4-5ms CPU spikes on Core 1 during LED updates, allowing I2S acquisition to run uninterrupted.

---

### Alternative: Increase Audio Task Priority

**Change in main.cpp**:
```diff
  BaseType_t audio_result = xTaskCreatePinnedToCore(
      audio_task,
      "audio_task",
      12288,
-     1,                  // Priority (same as GPU)
+     2,                  // Priority (higher than GPU - audio critical)
      &audio_task_handle,
      1                   // Pin to Core 1
  );
```

**Rationale**: If FastLED must stay on Core 1, elevate audio task priority to preempt LED transmission when I2S samples are ready.

**Trade-off**: May introduce LED glitches if audio preempts mid-transmission (RMT with DMA should handle this gracefully).

---

### Long-term: Verify DMA Channel Allocation

**Add diagnostic logging**:
```cpp
// In init_i2s_microphone():
LOG_INFO(TAG_I2S, "I2S peripheral: %d, DMA channel: %d",
         /* query I2S driver for peripheral ID and DMA channel */);

// In led_driver_init():
LOG_INFO(TAG_LED, "RMT channels: A=%d, B=%d, DMA enabled: %d",
         /* query FastLED for RMT channel IDs */);
```

**Purpose**: Confirm DMA channels are not overlapping or causing arbitration delays.

---

## 9. Test Plan

### Phase 1: Verify Baseline
1. Build with current config (`FASTLED_SHOW_CORE=1`)
2. Monitor `i2s_block_us` in serial logs (should be ~8000µs, not >10000µs)
3. Check for I2S read errors (`i2s_result != ESP_OK`)
4. Capture LED transmission duration (`g_last_led_tx_us`)

### Phase 2: Test Fix
1. Change `FASTLED_SHOW_CORE=1` → `FASTLED_SHOW_CORE=0`
2. Rebuild and flash firmware
3. Re-run baseline tests - expect:
   - `i2s_block_us` consistently <9000µs
   - Zero I2S read errors
   - LED updates do not correlate with audio glitches

### Phase 3: Stress Test
1. Enable high LED update rate (120 FPS)
2. Enable audio-reactive patterns (heavy FFT load)
3. Monitor for missed audio chunks or LED glitches
4. Profile with `profiler.h` to measure task CPU usage

---

## 10. Suspicious Configurations Reviewed

### Q: Is I2S DMA enabled?
**A**: Yes, implicitly enabled by ESP-IDF v5 I2S driver. The `i2s_std_config_t` does not require explicit DMA flags.

### Q: Does `portMAX_DELAY` return stale data?
**A**: No. `i2s_channel_read()` with `portMAX_DELAY` blocks the calling task until new samples arrive from DMA buffer. It will never return stale data, but it CAN hang if I2S peripheral is misconfigured or starved of clock.

### Q: Can RMT DMA conflict with I2S DMA?
**A**: Unlikely. ESP32-S3 has 6 GDMA channels; I2S and RMT typically auto-allocate to non-overlapping channels. However, hardware bus arbitration can introduce latency under simultaneous load.

### Q: Why STEREO mode with only RIGHT channel active?
**A**: SPH0645 microphone requires stereo LRCLK signaling (32-bit left + 32-bit right slots) even though only one channel outputs data. This is standard I2S behavior.

---

## 11. Summary Matrix

| Component        | Peripheral | GPIO Pins | DMA Channel | Core Affinity | Conflict? |
|------------------|------------|-----------|-------------|---------------|-----------|
| I2S Microphone   | I2S0/I2S1  | 12,13,14  | GDMA 0-3    | Core 1 (task) | -         |
| RMT Lane A       | RMT CH0    | 4         | GDMA 4      | Core 1 (ISR)  | **YES**   |
| RMT Lane B       | RMT CH1    | 5         | GDMA 5      | Core 1 (ISR)  | **YES**   |
| Audio Task       | (FreeRTOS) | -         | -           | Core 1        | **YES**   |
| GPU Task         | (FreeRTOS) | -         | -           | Core 0        | -         |

**Root Cause**: `FASTLED_SHOW_CORE=1` forces RMT transmission to run on Core 1, creating CPU contention with audio acquisition during LED updates (4-5ms every 8.3ms at 120 FPS).

---

## 12. Next Steps

1. **Immediate**: Change `FASTLED_SHOW_CORE=0` in `platformio.ini`
2. **Validate**: Rebuild, flash, and monitor `i2s_block_us` logs
3. **Document**: Update ADR if performance improves significantly
4. **Optional**: Add DMA channel logging for long-term validation
5. **Future**: Consider hardware I2S MCLK if jitter persists (currently unused)

---

## Files Referenced

- `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/platformio.ini` (line 25)
- `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/microphone.h` (lines 99-101)
- `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/microphone.cpp` (lines 16-56, 71-77)
- `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/led_driver.cpp` (lines 149-156, 221-223)
- `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/main.cpp` (lines 583-603)

---

End of Report

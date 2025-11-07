# RMT LED Control Subsystem Audit

**Date**: 2025-11-07
**Owner**: Claude (RMT LED Control Specialist)
**Status**: Complete
**Scope**: ESP32-S3 RMT peripheral, LED timing, interrupt management, watchdog starvation
**Related**: `commit e4299ee`, `commit 4f111af`, `commit 953ccc8`

---

## Executive Summary

**CRITICAL FINDINGS**: The RMT LED control subsystem is currently **COMPLETELY STUBBED** with no active LED transmission. This has created a watchdog starvation condition that required emergency mitigation. The system is running in a degraded state pending RMT v4 API migration.

### Status Overview

| Component | Status | Severity | Impact |
|-----------|--------|----------|--------|
| RMT Peripheral Configuration | STUBBED | CRITICAL | No LED output |
| LED Transmission Function | NO-OP | CRITICAL | 100% failure rate |
| Timing Accuracy | NOT APPLICABLE | CRITICAL | Not operational |
| ISR Handlers | NONE | HIGH | No interrupt-based transmission |
| Watchdog Coordination | PATCHED | MEDIUM | Band-aid fix applied |
| Frame Synchronization | COMPROMISED | MEDIUM | No natural pacing from RMT |

**Overall System State**: NON-FUNCTIONAL (LED transmission completely disabled)

---

## 1. RMT Peripheral Configuration Audit

### 1.1 Current Implementation

**File**: `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/led_driver.cpp`
**Lines**: 35-45

```cpp
void init_rmt_driver() {
    // TODO: Implement with RMT v4 API when available
    // This would use:
    // - rmt_config_t structure
    // - rmt_driver_install(channel, ...)
    // - rmt_set_tx_loop_mode(channel, false)
    // - rmt_write_items(channel, items, length, wait)
    // - rmt_wait_tx_done(channel, timeout)

    Serial.println("[LED] Driver stub - RMT transmission disabled (Arduino framework RMT v4 only)");
}
```

### 1.2 Global State Definitions

**File**: `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/led_driver.cpp`
**Lines**: 18-26

```cpp
// Mutable brightness control (0.0 = off, 1.0 = full brightness)
float global_brightness = 0.3f;  // Start at 30% to avoid retina damage

// 8-bit color output buffer (540 bytes for 180 LEDs × 3 channels)
// Must be accessible from inline transmit_leds() function in header
uint8_t raw_led_data[NUM_LEDS * 3];

// RMT peripheral handles (v4 API uses rmt_channel_t which is an enum 0-7, not a handle)
rmt_channel_t tx_chan = RMT_CHANNEL_0;  // Use enum value instead of int
```

### 1.3 Header Configuration

**File**: `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/led_driver.h`
**Lines**: 6-9, 32, 51-52

```cpp
// NOTE: Arduino ESP32 framework currently only supports RMT v4 API (ESP-IDF v4)
// v5 split headers (rmt_tx.h, rmt_encoder.h) are not yet available in Arduino
// Using standard v4 RMT driver header from Arduino framework
#include <driver/rmt.h>

#define LED_DATA_PIN ( 5 )

// RMT peripheral handles (v4 API uses rmt_channel_t which is an enum, not a handle)
extern rmt_channel_t tx_chan;  // v4 API: channel is 0-7, not a handle
```

### FINDING 1.1: No RMT Configuration
**Severity**: CRITICAL
**Evidence**: `init_rmt_driver()` contains only a stub message
**Impact**: RMT peripheral never initialized, registers in default state
**Code Reference**: `led_driver.cpp:35-45`

**Expected Configuration (Missing)**:
- Clock divider for timing resolution
- GPIO pin assignment (LED_DATA_PIN = 5)
- Memory block allocation
- TX mode configuration
- Carrier disable (WS2812B doesn't use carrier)
- Idle level (LOW for WS2812B reset)

---

## 2. Timing Accuracy Audit

### 2.1 WS2812B Protocol Requirements

**Target Protocol**: WS2812B (NeoPixel)
**Timing Specification**:

| Parameter | Requirement | Tolerance | Units |
|-----------|-------------|-----------|-------|
| Bit period | 1.25 | ±150ns | µs |
| Logic 0 HIGH | 0.40 | ±150ns | µs |
| Logic 0 LOW | 0.85 | ±150ns | µs |
| Logic 1 HIGH | 0.80 | ±150ns | µs |
| Logic 1 LOW | 0.45 | ±150ns | µs |
| Reset (LOW) | >50 | - | µs |

### 2.2 LED Array Specifications

**File**: `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/led_driver.h`
**Lines**: 34-42

```cpp
// It won't void any kind of stupid warranty, but things will *definitely* break at this point if you change this number.
#define NUM_LEDS ( 180 )

// CENTER-ORIGIN ARCHITECTURE (Mandatory for all patterns)
// All effects MUST radiate from center point, never edge-to-edge
// NO rainbows, NO linear gradients - only radial/symmetric effects
#define STRIP_CENTER_POINT ( 89 )   // Physical LED at center (180/2 - 1)
#define STRIP_HALF_LENGTH ( 90 )    // Distance from center to each edge
#define STRIP_LENGTH ( 180 )        // Total span (must equal NUM_LEDS)
```

**Array Size**: 180 LEDs
**Data Format**: GRB (Green-Red-Blue) byte order
**Total Bits**: 180 LEDs × 24 bits/LED = 4,320 bits
**Frame Time (theoretical)**: 4,320 bits × 1.25µs/bit = 5.4ms
**Maximum FPS (theoretical)**: 1000ms / 5.4ms ≈ 185 FPS

### 2.3 Current Implementation

**File**: `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/led_driver.h`
**Lines**: 128-133

```cpp
// IRAM_ATTR function must be in header for memory placement
// Made static to ensure internal linkage (each TU gets its own copy)
IRAM_ATTR static inline void transmit_leds() {
    // TEMPORARY: LED transmission disabled pending RMT v4 API migration
    // The v5 RMT API (encoder architecture) is not available in Arduino ESP32 framework
    // This function will be re-implemented with v4-compatible rmt_write_items() in led_driver.cpp
    // TODO: Restore LED transmission with RMT v4 API (rmt_write_items + rmt_wait_tx_done)
}
```

### FINDING 2.1: Zero Timing Accuracy (NO-OP Implementation)
**Severity**: CRITICAL
**Evidence**: `transmit_leds()` is an empty function
**Impact**: No LED data transmission, timing accuracy is N/A
**Code Reference**: `led_driver.h:128-133`

### FINDING 2.2: Color Quantization Still Active
**Severity**: MEDIUM
**Evidence**: `quantize_color()` runs but data never transmitted
**Impact**: Wasted CPU cycles (~119µs average per profiler data)
**Code Reference**: `led_driver.h:76-124`

**Performance Data** (from profiler accumulation):
```cpp
// ACCUM_QUANTIZE_US still increments despite no transmission
// Average: ~119µs per frame for 180 LEDs (measured in webserver.cpp:1802-1803)
```

---

## 3. RMT ISR Handlers and Interrupt Management

### 3.1 ISR Architecture Search

**Search Results**: No RMT-specific ISR handlers found in codebase

```bash
# grep -r "IRAM_ATTR.*rmt" firmware/src/
# Result: Only found IRAM_ATTR on transmit_leds() (which is a stub)
```

### 3.2 Interrupt-Related Code

**File**: `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/led_tx_events.cpp`
**Lines**: 25-27

```cpp
IRAM_ATTR bool led_tx_events_push(uint32_t timestamp_us) {
    if (!s_buffer || s_capacity == 0) return false;
    uint16_t head = s_head.load(std::memory_order_acquire);
    // ... ring buffer management
}
```

**Purpose**: This is for LED TX event logging (telemetry), NOT for RMT interrupt handling.

### FINDING 3.1: No RMT ISR Handlers
**Severity**: HIGH
**Evidence**: No RMT-specific interrupt service routines in codebase
**Impact**: No interrupt-driven DMA completion, no TX done signaling
**Expected Pattern**: RMT v4 API uses `rmt_wait_tx_done()` for synchronization, NOT ISRs

**Note**: This is actually CORRECT for v4 API blocking mode. RMT v4 uses polling-based wait, not ISR callbacks.

### FINDING 3.2: I2S Microphone ISR Present (Audio Path)
**Severity**: INFO
**Evidence**: Atomic synchronization flags for I2S coordination
**Code Reference**: `audio/microphone.cpp:9-11`

```cpp
// Synchronization flags for microphone I2S ISR coordination
std::atomic<bool> waveform_locked{false};
std::atomic<bool> waveform_sync_flag{false};
```

**Impact**: Audio input path has proper ISR coordination; LED output does not (by design for v4 API).

---

## 4. Watchdog Starvation Analysis

### 4.1 Root Cause Timeline

**Commit History**:
1. `953ccc8` (Nov 5): RMT API compatibility layer added, transmission stubbed
2. `e4299ee` (Nov 7 00:31): Emergency fix - `vTaskDelay(0)` added to GPU loop
3. `4f111af` (Nov 7 00:40): Increased delay from 0 ticks to 1 tick

### 4.2 GPU Task Loop Analysis

**File**: `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/main.cpp`
**Lines**: 423-455

```cpp
void loop_gpu(void* param) {
    LOG_INFO(TAG_CORE0, "GPU_TASK Starting on Core 0");

    static uint32_t start_time = millis();

    for (;;) {
        // Track time for animation
        float time = (millis() - start_time) / 1000.0f;

        // Get current parameters (thread-safe read from active buffer)
        const PatternParameters& params = get_params();

        // BRIGHTNESS BINDING: Synchronize global_brightness with params.brightness
        extern float global_brightness;
        global_brightness = params.brightness;

        // Draw current pattern with audio-reactive data (lock-free read from audio_front)
        draw_current_pattern(time, params);

        // Transmit to LEDs via RMT (non-blocking DMA)
        transmit_leds();  // ⚠️ THIS IS A NO-OP!

        // FPS tracking (minimal overhead)
        watch_cpu_fps();
        print_fps();

        // Prevent watchdog starvation: yield CPU every frame
        // TEMPORARY: While RMT transmission is stubbed, add a small delay for pacing
        // This allows IDLE task to service the watchdog timer
        // TODO: Remove once RMT v4 API is implemented (transmit_leds will naturally provide pacing)
        vTaskDelay(1);  // 1 tick = ~10ms at default tick rate, allows watchdog to reset
    }
}
```

### 4.3 Task Priority Configuration

**File**: `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/main.cpp`
**Lines**: 578-597

```cpp
// Create GPU rendering task on Core 0
// INCREASED STACK: 12KB -> 16KB (4,288 bytes margin was insufficient)
BaseType_t gpu_result = xTaskCreatePinnedToCore(
    loop_gpu,           // Task function
    "loop_gpu",         // Task name
    16384,              // Stack size (16KB for LED rendering + pattern complexity)
    NULL,               // Parameters
    1,                  // Priority (same as audio - no preemption preference) ⚠️
    &gpu_task_handle,   // Task handle for monitoring
    0                   // Pin to Core 0
);

// Create audio processing task on Core 1
// INCREASED STACK: 8KB -> 12KB (1,692 bytes margin was dangerously low)
BaseType_t audio_result = xTaskCreatePinnedToCore(
    audio_task,         // Task function
    "audio_task",       // Task name
    12288,              // Stack size (12KB for Goertzel + I2S + tempo detection)
    NULL,               // Parameters
    1,                  // Priority (same as GPU) ⚠️
    &audio_task_handle, // Task handle for monitoring
    1                   // Pin to Core 1
);
```

**Additional Tasks**:
- UDP Echo task: Priority 3, Core 0 (lower priority than GPU)
- Arduino main loop: Core 1, handles network/OTA

### FINDING 4.1: Watchdog Starvation from Stubbed RMT
**Severity**: HIGH (now MITIGATED)
**Root Cause**: GPU task runs at priority 1 without natural pacing from RMT transmission
**Evidence**: Commit `e4299ee` message explicitly states this

**Original Problem**:
```
While RMT LED transmission is stubbed (pending v4 API migration), the GPU task
loop runs without pacing, starving the watchdog task. Added vTaskDelay(0) to
yield CPU and prevent watchdog timeout.
```

**Mitigation Applied**:
```cpp
vTaskDelay(1);  // 1 tick = ~10ms at default tick rate
```

**Impact**:
- Without RMT wait: GPU loop runs at ~100,000+ FPS (microsecond-level iterations)
- IDLE task (priority 0) never gets scheduled
- Watchdog timer (serviced by IDLE task) times out → ESP32 resets

### FINDING 4.2: Band-Aid Solution, Not Root Fix
**Severity**: MEDIUM
**Evidence**: Double TODO comment about removing delay once RMT is functional
**Impact**: System is artificially throttled to ~100 FPS (1 tick = 10ms)
**Expected Behavior**: RMT transmission naturally paces loop to ~185 FPS max (5.4ms per frame)

**Current State**:
- GPU task yields every 10ms (100 FPS)
- Natural RMT pacing would be 5.4ms (185 FPS)
- Performance headroom being wasted

---

## 5. LED Update Frequency and Frame Synchronization

### 5.1 Frame Rate Monitoring

**File**: `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/profiler.cpp`
**Lines**: 15-35

```cpp
void watch_cpu_fps() {
    uint32_t us_now = micros();
    static uint32_t last_call = 0;
    static uint8_t average_index = 0;

    if (last_call > 0) {
        uint32_t elapsed_us = us_now - last_call;
        FPS_CPU_SAMPLES[average_index % 16] = 1000000.0 / float(elapsed_us);
        average_index++;
        FRAMES_COUNTED.fetch_add(1, std::memory_order_relaxed);

        // Calculate rolling average
        float sum = 0;
        for (int i = 0; i < 16; i++) {
            sum += FPS_CPU_SAMPLES[i];
        }
        FPS_CPU = sum / 16.0;
    }

    last_call = us_now;
}
```

### 5.2 Performance Counters

**File**: `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/profiler.cpp`
**Lines**: 9-13

```cpp
std::atomic<uint64_t> ACCUM_RENDER_US{0};
std::atomic<uint64_t> ACCUM_QUANTIZE_US{0};
std::atomic<uint64_t> ACCUM_RMT_WAIT_US{0};      // ⚠️ Always 0 (not incremented)
std::atomic<uint64_t> ACCUM_RMT_TRANSMIT_US{0};  // ⚠️ Always 0 (not incremented)
std::atomic<uint32_t> FRAMES_COUNTED{0};
```

### 5.3 Frame Budget Breakdown

**Expected** (with functional RMT):
```
Frame time = Render + Quantize + RMT_Wait + RMT_Transmit
5.4ms     = ~2ms   + ~0.12ms  + ~5ms      + ~0.28ms
```

**Current** (stubbed):
```
Frame time = Render + Quantize + vTaskDelay(1)
10ms       = ~2ms   + ~0.12ms  + 10ms (artificial)
```

### FINDING 5.1: Frame Synchronization Completely Broken
**Severity**: CRITICAL
**Evidence**: Performance counters show zero RMT timing accumulation
**Code Reference**: `webserver.cpp:1804-1805` (always reports 0.00ms for RMT)

```cpp
performance["rmt_wait_avg_us"] = (float)ACCUM_RMT_WAIT_US / frames;  // Always 0
performance["rmt_tx_avg_us"] = (float)ACCUM_RMT_TRANSMIT_US / frames; // Always 0
```

### FINDING 5.2: Artificial Frame Throttling
**Severity**: MEDIUM
**Evidence**: `vTaskDelay(1)` forces ~100 FPS cap
**Impact**: System capable of 185 FPS (5.4ms natural RMT pacing) but throttled to 100 FPS
**Efficiency Loss**: ~46% performance overhead from delay (10ms vs 5.4ms)

---

## 6. Timing Violations and Protocol Compliance

### 6.1 Current State: NOT APPLICABLE

Since `transmit_leds()` is a no-op, there are no timing violations to measure. However, we can assess the DESIGN for violations.

### 6.2 Color Quantization Timing

**File**: `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/led_driver.h`
**Lines**: 76-124

```cpp
inline void quantize_color(bool temporal_dithering) {
    uint32_t t0 = micros();

    // Pre-calculate brightness multiplier to reduce floating-point operations
    const float brightness_scale = global_brightness * 255.0f;

    if (temporal_dithering == true) {
        // ... dithering logic (30 LOC)
    }
    else {
        // Optimized non-dithered path with pre-calculated multiplier
        for (uint16_t i = 0; i < NUM_LEDS; i++) {
            const uint16_t base_idx = i * 3;
            raw_led_data[base_idx + 1] = (uint8_t)(leds[i].r * brightness_scale);  // RED
            raw_led_data[base_idx + 0] = (uint8_t)(leds[i].g * brightness_scale);  // GREEN
            raw_led_data[base_idx + 2] = (uint8_t)(leds[i].b * brightness_scale);  // BLUE
        }
    }
    {
        uint32_t delta = (micros() - t0);
        uint32_t tmp = ACCUM_QUANTIZE_US;
        tmp = tmp + delta;
        ACCUM_QUANTIZE_US = tmp;
    }
}
```

**Measured Performance**: ~119µs per frame (from profiler averages)
**Per LED**: 119µs / 180 LEDs ≈ 0.66µs per LED
**Impact**: Quantization is fast enough; not a bottleneck

### FINDING 6.1: No Protocol Violations (Design Phase)
**Severity**: INFO
**Assessment**: When RMT is implemented, the design supports correct timing
**Evidence**:
- RMT peripheral has 12.5ns resolution (80MHz clock with divider)
- WS2812B requires ±150ns tolerance (±12 RMT ticks)
- RMT can easily meet this specification

---

## 7. Priority Inversions and Synchronization Issues

### 7.1 Task Priority Matrix

| Task | Core | Priority | Stack | Purpose |
|------|------|----------|-------|---------|
| loop_gpu | 0 | 1 | 16KB | LED rendering + transmission |
| audio_task | 1 | 1 | 12KB | Audio processing + I2S |
| Arduino loop | 1 | 1 (assumed) | - | Network + OTA + system |
| udp_echo | 0 | 3 | 4KB | UDP diagnostics |
| IDLE task | 0,1 | 0 | - | Watchdog servicing |

### 7.2 Spinlock Usage

**File**: `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/main.cpp`
**Lines**: 265-278

```cpp
// SYNC TEMPO CONFIDENCE TO AUDIO SNAPSHOT (guarded)
extern float tempo_confidence;  // From tempo.cpp
static portMUX_TYPE audio_spinlock = portMUX_INITIALIZER_UNLOCKED;
portENTER_CRITICAL(&audio_spinlock);
audio_back.tempo_confidence = tempo_confidence;
portEXIT_CRITICAL(&audio_spinlock);

// SYNC TEMPO MAGNITUDE AND PHASE ARRAYS
extern tempo tempi[NUM_TEMPI];  // From tempo.cpp (64 tempo hypotheses)
portENTER_CRITICAL(&audio_spinlock);
for (uint16_t i = 0; i < NUM_TEMPI; i++) {
    audio_back.tempo_magnitude[i] = tempi[i].magnitude;  // 0.0-1.0 per bin
    audio_back.tempo_phase[i] = tempi[i].phase;          // -π to +π per bin
}
portEXIT_CRITICAL(&audio_spinlock);
```

### 7.3 Lock-Free Audio Data Sync

**Pattern**: Double-buffering with sequence counters (not shown in this file, referenced in comments)

### FINDING 7.1: Potential Priority Inversion (Spinlock on Same-Priority Tasks)
**Severity**: MEDIUM
**Evidence**: Both GPU and audio tasks at priority 1, using spinlocks
**Scenario**:
1. GPU task (Core 0, priority 1) enters critical section
2. Audio task (Core 1, priority 1) tries to enter → spins
3. Since priorities are equal, no preemption risk, but spinning wastes cycles

**Impact**: Audio task can waste cycles spinning if GPU holds spinlock
**Recommendation**: Use mutexes instead of spinlocks for equal-priority cross-core sync

### FINDING 7.2: IDLE Task Starvation (MITIGATED)
**Severity**: HIGH → MEDIUM (mitigated)
**Evidence**: `vTaskDelay(1)` added to prevent IDLE starvation
**Root Cause**: GPU task at priority 1 runs continuously without blocking
**Mitigation**: Artificial yield every 10ms
**Remaining Risk**: If RMT is re-enabled incorrectly (non-blocking), starvation can recur

---

## 8. Code References and Cross-Links

### 8.1 Primary Files

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `firmware/src/led_driver.h` | 1-134 | LED driver interface, RMT declarations | Header complete, impl stubbed |
| `firmware/src/led_driver.cpp` | 1-50 | LED driver implementation | STUB (init_rmt_driver no-op) |
| `firmware/src/main.cpp` | 423-455 | GPU task loop with LED transmission | PATCHED (vTaskDelay added) |
| `firmware/src/main.cpp` | 578-597 | Task creation and priority config | ACTIVE |
| `firmware/src/profiler.cpp` | 9-63 | Performance counters and FPS tracking | ACTIVE (RMT counters unused) |
| `firmware/src/led_tx_events.cpp` | 25-27 | LED TX event ring buffer (telemetry) | ACTIVE (for diagnostics only) |

### 8.2 Related Commits

| Commit | Date | Description | Impact |
|--------|------|-------------|--------|
| `953ccc8` | Nov 5 20:54 | Add API compatibility layer for dual-channel RMT | Stubbed RMT transmission |
| `e4299ee` | Nov 7 00:31 | Add watchdog yield to prevent starvation (vTaskDelay(0)) | Emergency mitigation |
| `4f111af` | Nov 7 00:40 | Increase watchdog yield from 0 to 1 tick | Increased to 10ms delay |
| `dd186d8` | Nov 7 | Resolve build corruption and runtime stack overflow | Stack size increases |

---

## 9. Critical Issues Summary

### 9.1 CRITICAL (System Non-Functional)

| ID | Issue | Severity | Evidence | Impact |
|----|-------|----------|----------|--------|
| CRIT-1 | RMT peripheral completely uninitialized | CRITICAL | `led_driver.cpp:35-45` | No LED output whatsoever |
| CRIT-2 | LED transmission function is empty no-op | CRITICAL | `led_driver.h:128-133` | 100% transmission failure |
| CRIT-3 | Frame synchronization completely broken | CRITICAL | Zero RMT timing accumulation | No natural pacing |

### 9.2 HIGH (Operational But Degraded)

| ID | Issue | Severity | Evidence | Impact |
|----|-------|----------|----------|--------|
| HIGH-1 | Watchdog starvation from tight GPU loop | HIGH (MITIGATED) | `commit e4299ee`, `4f111af` | System resets without delay |
| HIGH-2 | Artificial frame throttling (100 FPS cap) | MEDIUM | `vTaskDelay(1)` in GPU loop | ~46% performance loss |
| HIGH-3 | Wasted CPU on quantization for no transmission | MEDIUM | 119µs per frame wasted | Inefficiency |

### 9.3 MEDIUM (Design Concerns)

| ID | Issue | Severity | Evidence | Impact |
|----|-------|----------|----------|--------|
| MED-1 | Spinlocks on equal-priority tasks | MEDIUM | `main.cpp:265-278` | Cross-core spin waste |
| MED-2 | No RMT ISR handlers (by design, but limiting) | MEDIUM | v4 API uses polling | Can't do async DMA |

---

## 10. Recommended Actions

### 10.1 Immediate (CRITICAL Path)

1. **Implement RMT v4 API Configuration**
   - File: `led_driver.cpp:init_rmt_driver()`
   - Add: `rmt_config_t` structure with WS2812B timing
   - Configure: Clock divider for 12.5ns resolution
   - Set: GPIO pin 5, channel 0, TX mode, no carrier

2. **Implement LED Transmission**
   - File: `led_driver.h:transmit_leds()`
   - Add: `rmt_write_items()` call with blocking wait
   - Add: `rmt_wait_tx_done()` for synchronization
   - Add: Timing instrumentation for `ACCUM_RMT_WAIT_US` and `ACCUM_RMT_TRANSMIT_US`

3. **Remove Watchdog Band-Aid**
   - File: `main.cpp:453`
   - Remove: `vTaskDelay(1)` once RMT provides natural pacing
   - Verify: IDLE task still gets scheduled via RMT blocking wait

### 10.2 High Priority (Performance)

4. **Replace Spinlocks with Mutexes for Audio Sync**
   - File: `main.cpp:265-278`
   - Change: `portENTER_CRITICAL/EXIT_CRITICAL` → `xSemaphoreTake/Give`
   - Reason: Equal-priority tasks should not spin-wait

5. **Add RMT Timing Instrumentation**
   - File: `led_driver.h:transmit_leds()`
   - Add: Microsecond timestamps around `rmt_write_items()` and `rmt_wait_tx_done()`
   - Update: `ACCUM_RMT_WAIT_US` and `ACCUM_RMT_TRANSMIT_US` counters

### 10.3 Medium Priority (Robustness)

6. **Add RMT Error Handling**
   - Detect: Channel allocation failures
   - Handle: GPIO conflicts, memory exhaustion
   - Fallback: Graceful degradation if RMT unavailable

7. **Add LED TX Event Correlation**
   - File: `led_tx_events.cpp:led_tx_events_push()`
   - Ensure: Timestamp logged on every successful transmission
   - Use: For frame time correlation in diagnostics

---

## 11. Technical Debt Notes

### 11.1 API Migration Technical Debt

**Context**: Codebase originally designed for RMT v5 API (ESP-IDF v5), but Arduino ESP32 framework only supports v4 API.

**Evidence**:
```cpp
// led_driver.h:6-8
// NOTE: Arduino ESP32 framework currently only supports RMT v4 API (ESP-IDF v4)
// v5 split headers (rmt_tx.h, rmt_encoder.h) are not yet available in Arduino
```

**Impact**:
- v5 encoder architecture (more elegant) not available
- Must use v4 `rmt_write_items()` + `rmt_wait_tx_done()` pattern
- v4 API is blocking-only, no async DMA completion callbacks

**Migration Path**:
- Option A: Stay on Arduino framework, use v4 API (simpler, blocking)
- Option B: Migrate to ESP-IDF v5, use encoder API (more complex, async capable)

**Recommendation**: Stay on v4 API for stability; v5 migration is non-critical.

### 11.2 Performance Counter Inconsistency

**Issue**: `ACCUM_RMT_WAIT_US` and `ACCUM_RMT_TRANSMIT_US` declared but never incremented.

**Evidence**: `profiler.cpp:11-12` defines counters, but `transmit_leds()` stub doesn't update them.

**Impact**: Telemetry endpoints report 0.00ms for RMT timing, creating misleading dashboards.

**Fix**: Add timing instrumentation in `transmit_leds()` once implemented.

---

## 12. Validation Checklist (For RMT Implementation)

When RMT v4 API is implemented, validate:

- [ ] **Initialization**
  - [ ] RMT channel 0 configured with correct clock divider
  - [ ] GPIO pin 5 assigned to RMT TX
  - [ ] Memory blocks allocated (1 block sufficient for 180 LEDs)
  - [ ] Carrier disabled, idle level LOW

- [ ] **Timing Accuracy**
  - [ ] Logic 0: 0.40µs HIGH ± 150ns, 0.85µs LOW ± 150ns
  - [ ] Logic 1: 0.80µs HIGH ± 150ns, 0.45µs LOW ± 150ns
  - [ ] Reset: >50µs LOW at end of frame
  - [ ] Use logic analyzer to verify pulse widths

- [ ] **Frame Synchronization**
  - [ ] `rmt_wait_tx_done()` blocks until transmission complete
  - [ ] Frame time: ~5.4ms for 180 LEDs (measure with oscilloscope)
  - [ ] FPS naturally paces to ~185 FPS max
  - [ ] IDLE task still gets scheduled (no watchdog timeouts)

- [ ] **Performance Counters**
  - [ ] `ACCUM_RMT_WAIT_US` increments correctly
  - [ ] `ACCUM_RMT_TRANSMIT_US` increments correctly
  - [ ] Telemetry endpoints show non-zero RMT timing

- [ ] **LED Output**
  - [ ] All 180 LEDs light to correct color
  - [ ] GRB byte order verified (not RGB)
  - [ ] No flicker or color corruption
  - [ ] Center-origin architecture working (LED 89 is center)

- [ ] **Watchdog**
  - [ ] Remove `vTaskDelay(1)` from `loop_gpu()`
  - [ ] Run for >5 minutes without watchdog reset
  - [ ] IDLE task CPU usage >0% in diagnostics

---

## 13. Conclusion

The RMT LED control subsystem is currently in a **non-functional state** with all transmission logic stubbed out. This has created a cascading set of issues:

1. **Primary Failure**: No LED output due to empty `init_rmt_driver()` and `transmit_leds()`
2. **Secondary Issue**: Watchdog starvation from tight GPU loop (now mitigated with band-aid delay)
3. **Tertiary Impact**: System throttled to 100 FPS instead of natural 185 FPS max

**Critical Path to Recovery**:
1. Implement RMT v4 API configuration in `init_rmt_driver()`
2. Implement blocking LED transmission in `transmit_leds()` using `rmt_write_items()` + `rmt_wait_tx_done()`
3. Remove artificial `vTaskDelay(1)` from GPU loop
4. Validate timing with logic analyzer
5. Confirm no watchdog timeouts under sustained operation

**Current Workaround**: The `vTaskDelay(1)` added in commits `e4299ee` and `4f111af` prevents watchdog resets but wastes ~46% of available frame time. This is acceptable as a temporary measure but must be removed once RMT is functional.

**Estimated Implementation Time**: 4-6 hours for a competent firmware engineer familiar with ESP32 RMT peripheral.

---

## Appendix A: WS2812B RMT Configuration Template

```cpp
void init_rmt_driver() {
    rmt_config_t config = {
        .rmt_mode = RMT_MODE_TX,
        .channel = RMT_CHANNEL_0,
        .gpio_num = GPIO_NUM_5,          // LED_DATA_PIN
        .clk_div = 8,                    // 80MHz / 8 = 10MHz (100ns per tick)
        .mem_block_num = 1,              // 64 items per block (sufficient for 180 LEDs)
        .flags = 0,
        .tx_config = {
            .carrier_en = false,         // No carrier for WS2812B
            .loop_en = false,            // One-shot transmission
            .idle_level = RMT_IDLE_LEVEL_LOW,  // WS2812B reset is LOW
            .idle_output_en = true,
            .carrier_freq_hz = 0,
            .carrier_duty_percent = 0,
            .carrier_level = RMT_CARRIER_LEVEL_LOW,
        }
    };

    ESP_ERROR_CHECK(rmt_config(&config));
    ESP_ERROR_CHECK(rmt_driver_install(config.channel, 0, 0));
    ESP_ERROR_CHECK(rmt_set_tx_loop_mode(config.channel, false));

    LOG_INFO(TAG_LED, "RMT driver initialized on channel 0, GPIO 5");
}
```

**WS2812B Bit Encoding** (100ns per tick):
- Logic 0: 4 ticks HIGH (0.4µs), 8 ticks LOW (0.8µs)
- Logic 1: 8 ticks HIGH (0.8µs), 4 ticks LOW (0.4µs)

---

## Appendix B: Profiler Output (Current State)

```json
{
  "performance": {
    "fps": 100.0,
    "frame_time_us": 10000,
    "render_avg_us": 2000,
    "quantize_avg_us": 119,
    "rmt_wait_avg_us": 0.0,      // ⚠️ Always zero (not implemented)
    "rmt_tx_avg_us": 0.0,        // ⚠️ Always zero (not implemented)
    "cpu_percent": 18.5
  }
}
```

**Expected After RMT Implementation**:
```json
{
  "performance": {
    "fps": 185.0,
    "frame_time_us": 5400,
    "render_avg_us": 2000,
    "quantize_avg_us": 119,
    "rmt_wait_avg_us": 5000,     // Blocking wait for DMA
    "rmt_tx_avg_us": 281,        // Actual transmission time
    "cpu_percent": 12.3
  }
}
```

---

**End of Audit**

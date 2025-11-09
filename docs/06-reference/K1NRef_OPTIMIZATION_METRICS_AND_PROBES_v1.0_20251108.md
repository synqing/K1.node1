<!-- markdownlint-disable MD013 -->

# K1.node1 Optimization Metrics & Telemetry Probes Reference
**Exact Code Locations and Implementation Details for Each Option**

**Status:** REFERENCE - Implementation Guide
**Date:** 2025-11-08
**Related:** K1NAnalysis_ARCHITECTURAL_OPTIMIZATION_OPTIONS_FORENSIC_v1.0_20251108.md

---

## OPTION A: MEMORY OPTIMIZATION - SPECIFIC METRICS

### Probe 1: RMT Refill Counter (Zero-Cost ISR Callback)

**Location:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/led_driver.h`

**Current Code:** Lines 164-197 show stub for `on_mem_empty_cb()` callback (commented). Enable and extend:

```cpp
// Add to profiler.h (new)
extern std::atomic<uint32_t> RMT_REFILL_COUNT;       // Total refills since boot
extern std::atomic<uint32_t> RMT_MAX_GAP_US;         // Max µs between refills
extern std::atomic<uint32_t> RMT_LAST_REFILL_US;     // Timestamp of last refill
extern std::atomic<uint16_t> RMT_SYMBOL_DEPTH_PEAK;  // Peak queue depth this interval

// Add to profiler.cpp (new)
std::atomic<uint32_t> RMT_REFILL_COUNT{0};
std::atomic<uint32_t> RMT_MAX_GAP_US{0};
std::atomic<uint32_t> RMT_LAST_REFILL_US{0};
std::atomic<uint16_t> RMT_SYMBOL_DEPTH_PEAK{0};

// ISR callback (in led_driver.h, expand lines 164-197)
static bool IRAM_ATTR on_mem_empty_cb(
    rmt_channel_handle_t chan,
    const rmt_tx_done_event_data_t* edata,
    void* user_data) {

    // ZERO-COST probe: timestamp-based gap measurement
    uint64_t now_us = esp_timer_get_time();
    static uint64_t last_refill_us = 0;

    // Increment refill counter (relaxed ordering)
    RMT_REFILL_COUNT.fetch_add(1, std::memory_order_relaxed);

    // Measure gap since last refill
    if (last_refill_us > 0) {
        uint32_t gap_us = (uint32_t)(now_us - last_refill_us);

        // Update peak gap (compare-and-swap to avoid locking)
        uint32_t current_max = RMT_MAX_GAP_US.load(std::memory_order_relaxed);
        while (gap_us > current_max &&
               !RMT_MAX_GAP_US.compare_exchange_weak(
                   current_max, gap_us,
                   std::memory_order_relaxed, std::memory_order_relaxed)) {
            current_max = RMT_MAX_GAP_US.load(std::memory_order_relaxed);
        }
    }

    last_refill_us = now_us;
    RMT_LAST_REFILL_US.store((uint32_t)now_us, std::memory_order_relaxed);

    // Call original user callback if provided
    if (user_data) {
        // ... user-defined logic
    }

    return true;
}
```

**Expected Baseline (Current):**
- RMT_REFILL_COUNT: ~1500 per second (160 LEDs × 24 bits / 256 symbols × 100 FPS)
- RMT_MAX_GAP_US: 5000-15000 µs (5-15ms, within soft timeout of 20ms)
- RMT_SYMBOL_DEPTH_PEAK: 100-150 (out of 256 capacity)

**After Option A:**
- RMT_MAX_GAP_US: Should trend toward 1000-5000 µs (1-5ms, safer margin)

---

### Probe 2: Pattern Buffer Reuse Analysis

**Location:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/pattern_registry.h`

**Current Code:** Pattern registry just stores metadata. Extend to track buffer usage:

```cpp
// Add to pattern_registry.h (new)
typedef struct {
    uint16_t pattern_id;
    const char* name;
    // ... existing fields

    // NEW: Buffer pooling metadata
    uint8_t buffer_class;           // 0=none, 1=single, 2=dual, 3=complex
    bool uses_bloom_buffer;         // Reuses bloom_buffer[2][NUM_LEDS]?
    bool uses_tunnel_buffer;        // Reuses beat_tunnel_image[2][NUM_LEDS]?
    bool uses_intro_buffer;         // Reuses startup_intro_image[NUM_LEDS]?
    size_t estimated_heap_bytes;    // Additional heap allocation (if any)
} PatternInfo;

// Declare global pattern list with buffer metadata
extern PatternInfo g_pattern_registry[NUM_PATTERNS];

// In pattern_registry.cpp, populate metadata for each pattern:
PatternInfo g_pattern_registry[NUM_PATTERNS] = {
    {
        .pattern_id = 0,
        .name = "startup_intro",
        .buffer_class = 1,
        .uses_bloom_buffer = false,
        .uses_tunnel_buffer = false,
        .uses_intro_buffer = true,
        .estimated_heap_bytes = 0
    },
    {
        .pattern_id = 1,
        .name = "beat_tunnel",
        .buffer_class = 2,
        .uses_bloom_buffer = false,
        .uses_tunnel_buffer = true,
        .uses_intro_buffer = false,
        .estimated_heap_bytes = 0
    },
    // ... more patterns
};

// Analyze overlap: compile a map of which buffers are shared
// Example: startup_intro and beat_tunnel DON'T share buffers → pooling can't help
// Example: beat_tunnel and bloom_radiate both use beat_tunnel_image → can alias
```

**Usage in Heartbeat:**
```cpp
// In heartbeat_logger.cpp or diagnostics.cpp (new)
void log_pattern_memory_usage(uint8_t pattern_index) {
    const PatternInfo& info = g_pattern_registry[pattern_index];
    LOG_INFO(TAG_GPU, "[Pattern %d] %s: buffer_class=%d, heap=%d bytes",
             pattern_index, info.name, info.buffer_class, info.estimated_heap_bytes);
}
```

---

## OPTION B: ISR TUNING - SPECIFIC METRICS

### Probe 1: I2S ISR Duration Measurement

**Location:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/microphone.cpp`

**Implementation:**

```cpp
// Add to microphone.h (new)
extern std::atomic<uint32_t> I2S_ISR_DURATION_US;    // Last ISR execution time
extern std::atomic<uint32_t> I2S_ISR_MAX_US;         // Peak ISR duration
extern std::atomic<uint32_t> I2S_ISR_COUNT_PER_SEC;  // Interrupt frequency

// Add to microphone.cpp (new, at top of file)
std::atomic<uint32_t> I2S_ISR_DURATION_US{0};
std::atomic<uint32_t> I2S_ISR_MAX_US{0};
std::atomic<uint32_t> I2S_ISR_COUNT_PER_SEC{0};
static uint32_t i2s_isr_count_this_sec = 0;
static uint32_t i2s_last_count_sec = 0;

// Instrument acquire_sample_chunk() function (microphone.cpp)
void acquire_sample_chunk() {
    uint64_t t0 = esp_timer_get_time();

    // Original blocking I2S read
    size_t bytes_read = 0;
    #if MICROPHONE_USE_NEW_I2S
        i2s_channel_read(rx_chan, mic_buffer, SAMPLE_BUFFER_SIZE, &bytes_read, portMAX_DELAY);
    #else
        i2s_read(I2S_NUM_0, mic_buffer, SAMPLE_BUFFER_SIZE, &bytes_read, portMAX_DELAY);
    #endif

    uint32_t duration_us = (uint32_t)(esp_timer_get_time() - t0);
    I2S_ISR_DURATION_US.store(duration_us, std::memory_order_relaxed);

    // Track peak
    uint32_t current_max = I2S_ISR_MAX_US.load(std::memory_order_relaxed);
    while (duration_us > current_max &&
           !I2S_ISR_MAX_US.compare_exchange_weak(current_max, duration_us,
               std::memory_order_relaxed, std::memory_order_relaxed)) {
        current_max = I2S_ISR_MAX_US.load(std::memory_order_relaxed);
    }

    // Update frequency counter
    i2s_isr_count_this_sec++;
    uint32_t now_sec = millis() / 1000;
    if (now_sec != i2s_last_count_sec) {
        I2S_ISR_COUNT_PER_SEC.store(i2s_isr_count_this_sec, std::memory_order_relaxed);
        i2s_isr_count_this_sec = 0;
        i2s_last_count_sec = now_sec;
    }
}
```

**Expected Baseline (44kHz, 256-sample buffer):**
- I2S_ISR_DURATION_US: 5-20 ms (i2s_read() is blocking, not ISR-driven; measures I/O latency)
- I2S_ISR_MAX_US: 20-30 ms (worst-case, if WiFi or OTA interrupts)
- I2S_ISR_COUNT_PER_SEC: 44000 / 256 = 172 (if driven by ISR)

**Note:** Actually, `i2s_read()` is a blocking call, not an ISR. The above probe measures I/O latency, not ISR overhead. For true ISR duration, instrument at the driver level (requires ESP-IDF inspection).

---

### Probe 2: Microphone Pause/Resume Tracking

**Location:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/microphone.h`

**Implementation:**

```cpp
// Add to microphone.h (new)
extern std::atomic<uint8_t> I2S_PAUSE_STATE;        // 0=running, 1=paused
extern std::atomic<uint32_t> I2S_PAUSE_COUNT;       // Times paused
extern std::atomic<uint32_t> I2S_RESUME_COUNT;      // Times resumed

// Add to microphone.cpp (new)
std::atomic<uint8_t> I2S_PAUSE_STATE{0};
std::atomic<uint32_t> I2S_PAUSE_COUNT{0};
std::atomic<uint32_t> I2S_RESUME_COUNT{0};

// Function to pause I2S (called during intro animation)
void pause_i2s_microphone() {
    if (I2S_PAUSE_STATE.load(std::memory_order_relaxed) == 0) {
        #if MICROPHONE_USE_NEW_I2S
            i2s_channel_disable(rx_chan);
        #else
            i2s_stop(I2S_NUM_0);
        #endif
        I2S_PAUSE_STATE.store(1, std::memory_order_release);
        I2S_PAUSE_COUNT.fetch_add(1, std::memory_order_relaxed);
        LOG_INFO(TAG_I2S, "Microphone paused (pause_count=%d)",
                 (int)I2S_PAUSE_COUNT.load(std::memory_order_relaxed));
    }
}

// Function to resume I2S
void resume_i2s_microphone() {
    if (I2S_PAUSE_STATE.load(std::memory_order_relaxed) == 1) {
        #if MICROPHONE_USE_NEW_I2S
            i2s_channel_enable(rx_chan);
        #else
            i2s_start(I2S_NUM_0);
        #endif
        I2S_PAUSE_STATE.store(0, std::memory_order_release);
        I2S_RESUME_COUNT.fetch_add(1, std::memory_order_relaxed);
        LOG_INFO(TAG_I2S, "Microphone resumed (resume_count=%d)",
                 (int)I2S_RESUME_COUNT.load(std::memory_order_relaxed));
    }
}

// Call pause/resume from main.cpp loop_gpu()
void loop_gpu(void* param) {
    // ... existing code

    // During intro animation (or other non-reactive pattern), pause audio
    const PatternInfo& pattern = g_pattern_registry[g_current_pattern_index];
    if (!pattern.uses_audio_reactivity) {  // NEW: pattern metadata flag
        pause_i2s_microphone();
    } else {
        resume_i2s_microphone();
    }

    // ... rest of loop
}
```

**Expected Behavior:**
- I2S_PAUSE_COUNT: 1-2 per pattern switch to non-reactive (intro, etc.)
- I2S_RESUME_COUNT: 1-2 per pattern switch back to reactive
- I2S_PAUSE_STATE: 0 (running) when playing reactive patterns; 1 (paused) during intro

---

## OPTION D: MONITORING/ADAPTATION - SPECIFIC METRICS

### Probe 1: Stack Watermark Tracking

**Location:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/diagnostics/` (new file)

**Implementation:**

```cpp
// diagnostics/stack_monitor.h (new)
#pragma once

#include <Arduino.h>
#include <atomic>

extern std::atomic<uint32_t> STACK_WATERMARK_AUDIO;   // Bytes free on Core 0 audio task
extern std::atomic<uint32_t> STACK_WATERMARK_GPU;     // Bytes free on Core 1 GPU task
extern std::atomic<uint32_t> STACK_WATERMARK_MAIN;    // Bytes free on Core 1 main loop

void update_stack_watermarks();

// diagnostics/stack_monitor.cpp (new)
#include "stack_monitor.h"
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

std::atomic<uint32_t> STACK_WATERMARK_AUDIO{0};
std::atomic<uint32_t> STACK_WATERMARK_GPU{0};
std::atomic<uint32_t> STACK_WATERMARK_MAIN{0};

void update_stack_watermarks() {
    extern TaskHandle_t audio_task_handle;   // From main.cpp
    extern TaskHandle_t gpu_task_handle;     // From main.cpp

    if (audio_task_handle) {
        uint32_t wm_audio = uxTaskGetStackHighWaterMark(audio_task_handle);
        STACK_WATERMARK_AUDIO.store(wm_audio, std::memory_order_relaxed);
    }

    if (gpu_task_handle) {
        uint32_t wm_gpu = uxTaskGetStackHighWaterMark(gpu_task_handle);
        STACK_WATERMARK_GPU.store(wm_gpu, std::memory_order_relaxed);
    }

    // Main loop watermark (current task)
    uint32_t wm_main = uxTaskGetStackHighWaterMark(NULL);
    STACK_WATERMARK_MAIN.store(wm_main, std::memory_order_relaxed);
}

// Call from main.cpp print_fps() or heartbeat_logger_poll()
void print_fps() {  // (existing function in profiler.cpp, add to it)
    // ... existing FPS printing code

    update_stack_watermarks();
    LOG_DEBUG(TAG_PROFILE, "Stack watermarks: audio=%u gpu=%u main=%u bytes free",
              (unsigned)STACK_WATERMARK_AUDIO.load(std::memory_order_relaxed),
              (unsigned)STACK_WATERMARK_GPU.load(std::memory_order_relaxed),
              (unsigned)STACK_WATERMARK_MAIN.load(std::memory_order_relaxed));
}
```

**Expected Baseline (Current):**
- STACK_WATERMARK_AUDIO: 2000-4000 bytes (12KB stack, some margin)
- STACK_WATERMARK_GPU: 4000-8000 bytes (16KB stack, good margin)
- STACK_WATERMARK_MAIN: 6000-10000 bytes (shared with WiFi, variable)

**Target After Tuning:**
- All watermarks > 2000 bytes (minimum safe margin)

---

### Probe 2: Per-Pattern Complexity Tracking

**Location:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/profiler.h`

**Implementation:**

```cpp
// profiler.h (extend existing file)
#define MAX_PATTERNS 32

extern std::atomic<uint32_t> RENDER_TIME_BY_PATTERN[MAX_PATTERNS];  // µs per pattern
extern std::atomic<uint16_t> RENDER_FRAME_COUNT_BY_PATTERN[MAX_PATTERNS];  // Frames rendered

// profiler.cpp (extend existing file)
std::atomic<uint32_t> RENDER_TIME_BY_PATTERN[MAX_PATTERNS]{};
std::atomic<uint16_t> RENDER_FRAME_COUNT_BY_PATTERN[MAX_PATTERNS]{};

// Instrument draw_current_pattern() call in main.cpp
void loop_gpu(void* param) {
    // ... existing code

    extern uint8_t g_current_pattern_index;

    uint32_t t_render_start = micros();
    draw_current_pattern(time, params);
    uint32_t t_render_delta = micros() - t_render_start;

    // Track per-pattern render time
    if (g_current_pattern_index < MAX_PATTERNS) {
        RENDER_TIME_BY_PATTERN[g_current_pattern_index].store(
            t_render_delta, std::memory_order_relaxed);
        RENDER_FRAME_COUNT_BY_PATTERN[g_current_pattern_index].fetch_add(
            1, std::memory_order_relaxed);
    }

    // ... rest of loop
}

// Print per-pattern stats in print_fps()
void print_fps() {
    // ... existing code

    static uint32_t last_pattern_print = 0;
    uint32_t now = millis();
    if (now - last_pattern_print > 5000) {  // Print every 5 seconds
        LOG_DEBUG(TAG_PROFILE, "Per-pattern render times (µs):");
        for (int i = 0; i < MAX_PATTERNS; i++) {
            uint32_t t = RENDER_TIME_BY_PATTERN[i].load(std::memory_order_relaxed);
            uint16_t count = RENDER_FRAME_COUNT_BY_PATTERN[i].load(std::memory_order_relaxed);
            if (count > 0) {
                LOG_DEBUG(TAG_PROFILE, "  [%d] last=%u µs, frames=%u",
                         i, t, (unsigned)count);
            }
        }
        last_pattern_print = now;
    }
}
```

**Expected Output:**
```
Per-pattern render times (µs):
  [0] last=2450 µs, frames=503 (startup_intro)
  [1] last=4120 µs, frames=250 (beat_tunnel)
  [2] last=3800 µs, frames=180 (bloom_radiate)
  [3] last=5200 µs, frames=50 (complex_pattern)
```

---

### Probe 3: Moving Average Filter (Render Time)

**Location:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/profiler.cpp`

**Implementation:**

```cpp
// profiler.h (extend)
extern std::atomic<uint32_t> RENDER_TIME_MOVING_AVG_US;  // 10-frame average
extern std::atomic<uint32_t> RENDER_TIME_PEAK_US;        // Max in current interval

// profiler.cpp (extend)
std::atomic<uint32_t> RENDER_TIME_MOVING_AVG_US{0};
std::atomic<uint32_t> RENDER_TIME_PEAK_US{0};

static uint32_t render_time_buffer[10] = {0};
static uint8_t render_buffer_index = 0;

// Call from loop_gpu() after measuring render time
void update_render_time_average(uint32_t render_us) {
    render_time_buffer[render_buffer_index % 10] = render_us;
    render_buffer_index++;

    // Update peak
    uint32_t current_peak = RENDER_TIME_PEAK_US.load(std::memory_order_relaxed);
    while (render_us > current_peak &&
           !RENDER_TIME_PEAK_US.compare_exchange_weak(current_peak, render_us,
               std::memory_order_relaxed, std::memory_order_relaxed)) {
        current_peak = RENDER_TIME_PEAK_US.load(std::memory_order_relaxed);
    }

    // Calculate average every 10 frames
    if (render_buffer_index % 10 == 0) {
        uint32_t sum = 0;
        for (int i = 0; i < 10; i++) {
            sum += render_time_buffer[i];
        }
        uint32_t avg = sum / 10;
        RENDER_TIME_MOVING_AVG_US.store(avg, std::memory_order_relaxed);
    }
}

// Adaptive frame pacing: raise frame_min_period_ms if render time exceeds budget
void check_render_budget() {
    uint32_t avg_us = RENDER_TIME_MOVING_AVG_US.load(std::memory_order_relaxed);
    uint32_t budget_us = 5000;  // 5ms render budget for 100+ FPS

    if (avg_us > budget_us) {
        LOG_WARN(TAG_GPU, "Render budget exceeded (avg=%u µs > %u µs); consider raising frame_min_period_ms",
                 avg_us, budget_us);
        // Optionally auto-raise frame period
        // adjust_frame_min_period(get_params().frame_min_period_ms + 1.0f);
    }
}
```

---

## OPTION E: QA/RELIABILITY - SPECIFIC METRICS

### Probe 1: RMT Timeout SLA Tracking

**Location:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/diagnostics/` (new)

**Implementation:**

```cpp
// diagnostics/sla_monitor.h (new)
#pragma once

#include <Arduino.h>
#include <atomic>

typedef struct {
    uint32_t uptime_seconds;              // System uptime
    uint32_t rmt_timeout_count;           // Total RMT timeouts since boot
    uint32_t rmt_timeout_count_per_min;   // Timeouts in last 60s
    uint32_t rmt_recovery_count;          // Successful recoveries
    uint32_t frame_drop_count;            // Frames dropped (recovery failed)
    float availability_percent;           // (uptime - downtime) / uptime
    uint8_t status;                       // 0=OK, 1=WARNING, 2=CRITICAL
} SystemSLA;

extern SystemSLA sla_metrics;

void update_sla_metrics();
void check_sla_thresholds();

// diagnostics/sla_monitor.cpp (new)
#include "sla_monitor.h"
#include "logging/logger.h"

SystemSLA sla_metrics = {
    .uptime_seconds = 0,
    .rmt_timeout_count = 0,
    .rmt_timeout_count_per_min = 0,
    .rmt_recovery_count = 0,
    .frame_drop_count = 0,
    .availability_percent = 100.0f,
    .status = 0
};

static uint32_t sla_update_interval = 1000;  // ms
static uint32_t last_sla_update = 0;
static uint32_t timeout_count_snapshot = 0;  // For per-minute calculation

void update_sla_metrics() {
    extern std::atomic<uint32_t> g_led_rmt_wait_timeouts;

    uint32_t now = millis();
    if (now - last_sla_update < sla_update_interval) {
        return;  // Too soon
    }

    sla_metrics.uptime_seconds = now / 1000;
    sla_metrics.rmt_timeout_count = g_led_rmt_wait_timeouts.load(std::memory_order_relaxed);

    // Per-minute calculation (rolling window)
    static uint32_t timeouts_60s_ago = 0;
    static uint32_t last_minute_check = 0;

    if (now - last_minute_check >= 60000) {
        // Count timeouts in last 60s
        uint32_t current_count = sla_metrics.rmt_timeout_count;
        sla_metrics.rmt_timeout_count_per_min = current_count - timeouts_60s_ago;
        timeouts_60s_ago = current_count;
        last_minute_check = now;
    }

    // Availability calculation (simplified: assume no downtime unless CRITICAL)
    sla_metrics.availability_percent = (sla_metrics.status < 2) ? 100.0f : 95.0f;

    last_sla_update = now;
}

void check_sla_thresholds() {
    update_sla_metrics();

    // SLA thresholds
    const uint32_t TIMEOUT_THRESHOLD_PER_MIN = 5;    // Allow max 5 per minute
    const uint32_t TIMEOUT_THRESHOLD_CRITICAL = 10;  // In 10s window, reboot

    if (sla_metrics.rmt_timeout_count_per_min > TIMEOUT_THRESHOLD_PER_MIN) {
        LOG_WARN(TAG_DIAG, "SLA WARNING: RMT timeouts exceed %d per minute (actual=%d)",
                 TIMEOUT_THRESHOLD_PER_MIN, sla_metrics.rmt_timeout_count_per_min);
        sla_metrics.status = 1;  // WARNING
    } else {
        sla_metrics.status = 0;  // OK
    }

    // CRITICAL: if too many in short window, reboot
    static uint32_t last_critical_check = 0;
    uint32_t now = millis();
    if (now - last_critical_check >= 10000) {
        extern std::atomic<uint32_t> g_led_rmt_wait_timeouts;
        static uint32_t timeout_count_10s_ago = 0;
        uint32_t current = g_led_rmt_wait_timeouts.load(std::memory_order_relaxed);
        uint32_t in_last_10s = current - timeout_count_10s_ago;
        timeout_count_10s_ago = current;

        if (in_last_10s > TIMEOUT_THRESHOLD_CRITICAL) {
            LOG_ERROR(TAG_DIAG, "SLA CRITICAL: %d RMT timeouts in 10s; rebooting", in_last_10s);
            sla_metrics.status = 2;  // CRITICAL
            delay(1000);
            esp_restart();
        }

        last_critical_check = now;
    }
}

// Call from main loop
void loop() {
    // ... existing code

    check_sla_thresholds();

    // ... rest of loop
}
```

**Expected Behavior:**
- At startup: status=0 (OK), availability=100%
- Under normal load (intro animation): timeout_count_per_min < 5, status stays 0
- Under stress (heavy pattern + WiFi): timeout_count_per_min = 2-4, status=0 or 1
- If degraded: status=2 → reboot

---

## VALIDATION CHECKLIST

**Before Implementation:**
- [ ] Baseline all metrics with current code (no changes)
- [ ] Document baseline values in analysis document
- [ ] Create test harness to automate metric collection

**During Implementation:**
- [ ] Verify each probe compiles without warnings
- [ ] Verify atomic operations use correct memory ordering
- [ ] Verify heartbeat logging correctly reads metrics
- [ ] Run unit tests on each component

**After Implementation (Tier 1 Complete):**
- [ ] FPS improvement >= 15% (measured via print_fps())
- [ ] RMT timeout counter decrease or stable
- [ ] Stack watermarks > 2000 bytes on all tasks
- [ ] Stress test runs >= 1 hour without failure
- [ ] SLA metrics show availability > 99%

---

**References:**
- FreeRTOS: https://freertos.org/a00106.html (uxTaskGetStackHighWaterMark)
- ESP-IDF RMT: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/rmt.html
- Atomic Operations: https://en.cppreference.com/w/cpp/atomic/atomic


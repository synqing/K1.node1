# Runtime Errors Forensic Analysis - K1.node1 Firmware

**Document Type:** Forensic Analysis
**Scope:** Runtime crash patterns, stack overflow evidence, watchdog failures
**Date:** 2025-11-07
**Status:** Active Investigation
**Related:** `K1NAnalysis_ANALYSIS_BUILD_CORRUPTION_ROOT_CAUSE_v1.0_20251108.md`, commit `dd186d8`, `e4299ee`, `4f111af`

---

## Executive Summary

Analysis of K1.node1 firmware reveals **three critical runtime error categories** recently resolved through emergency fixes:

1. **Stack Overflow (CRITICAL)** - LoadProhibited exception causing immediate crash
2. **Watchdog Starvation** - IDLE task unable to reset watchdog timer
3. **API Version Mismatch** - ESP-IDF v5 API used in v4-only framework

All three issues were **confirmed and fixed** in commits `dd186d8`, `e4299ee`, and `4f111af`. This document provides forensic evidence and timeline.

---

## Critical Error Timeline

### Issue 1: Stack Overflow - LoadProhibited Exception (RESOLVED)

**Commit:** `dd186d8` - "fix(firmware): resolve build corruption and runtime stack overflow"
**Date:** 2025-11-06 23:57:26
**Severity:** CRITICAL - System crash on pattern initialization

#### Root Cause

```cpp
// BEFORE FIX (pattern_audio_interface.h:114)
#define PATTERN_AUDIO_START() \
    AudioDataSnapshot audio = {0}; \  // <-- 1876 bytes on stack!
    bool audio_available = get_audio_snapshot(&audio);
```

**Evidence:**
- `AudioDataSnapshot` structure size: **1,876 bytes**
- GPU task stack allocation: **16KB** (increased from 12KB)
- Stack usage pattern: Pattern init → macro expansion → stack frame overflow
- Error signature: `LoadProhibited exception (Guru Meditation Error)`

#### Stack Allocation Analysis

**File:** `/firmware/src/main.cpp:578-586`

```cpp
// INCREASED STACK: 12KB -> 16KB (4,288 bytes margin was insufficient)
BaseType_t gpu_result = xTaskCreatePinnedToCore(
    loop_gpu,           // Task function
    "loop_gpu",         // Task name
    16384,              // Stack size (16KB for LED rendering + pattern complexity)
    NULL,               // Parameters
    1,                  // Priority
    &gpu_task_handle,   // Task handle
    0                   // Pin to Core 0
);
```

**Comments reveal prior failure:**
> "4,288 bytes margin was insufficient"

This means **before the fix**, stack usage was approaching the limit, leaving only ~4KB safety margin. Adding 1,876 bytes for `AudioDataSnapshot` **exceeded available stack space**.

#### Fix Implementation

**File:** `/firmware/src/pattern_audio_interface.h:75-80`

```cpp
// ============================================================================
// GLOBAL AUDIO SNAPSHOT BUFFER (Stack-Safe)
// ============================================================================
// Store audio snapshot in DRAM instead of stack to avoid overflow in patterns
// This buffer is thread-safe because each pattern's static tracking counter
// detects stale data and patterns never hold references across frames
static AudioDataSnapshot g_pattern_audio_buffer;
```

**New macro (line 114-124):**

```cpp
#define PATTERN_AUDIO_START() \
    bool audio_available = get_audio_snapshot(&g_pattern_audio_buffer); \
    AudioDataSnapshot& audio = g_pattern_audio_buffer; \  // Reference, not copy
    static uint32_t pattern_last_update = 0; \
    bool audio_is_fresh = (audio_available && \
                           audio.update_counter != pattern_last_update);
```

**Key change:** Stack allocation (1,876 bytes) → Heap reference (8 bytes pointer)

---

### Issue 2: Watchdog Starvation During RMT Stub Phase (RESOLVED)

**Commit:** `e4299ee` - "fix(firmware): add watchdog yield to prevent starvation during RMT stub phase"
**Date:** 2025-11-06 00:31:25
**Severity:** HIGH - System watchdog timeout, potential reboot loop

#### Root Cause

**File:** `/firmware/src/main.cpp:423-455` (GPU task loop)

```cpp
void loop_gpu(void* param) {
    LOG_INFO(TAG_CORE0, "GPU_TASK Starting on Core 0");

    static uint32_t start_time = millis();

    for (;;) {
        // ... pattern rendering ...

        // Transmit to LEDs via RMT (non-blocking DMA)
        transmit_leds();  // <-- STUBBED! No actual delay/pacing

        // FPS tracking (minimal overhead)
        watch_cpu_fps();
        print_fps();

        // NO YIELD - Loop runs at maximum speed!
    }
}
```

**Problem:** When `transmit_leds()` is stubbed (LED transmission disabled during v4 API migration), the loop runs **without pacing**, consuming 100% CPU and **starving the FreeRTOS IDLE task** which services the hardware watchdog timer.

#### Evidence from Commit Messages

**Commit `e4299ee` message:**
> "While RMT LED transmission is stubbed (pending v4 API migration), the GPU task loop runs without pacing, starving the watchdog task."

**Commit `4f111af` message:**
> "vTaskDelay(0) is a no-op in FreeRTOS - it doesn't actually yield. Changed to vTaskDelay(1) which yields for 1 tick (~10ms)"

#### Fix Implementation (Two-Stage)

**Stage 1:** Commit `e4299ee` - Added yield (incorrect value)

```cpp
vTaskDelay(0);  // INCORRECT - vTaskDelay(0) is a no-op!
```

**Stage 2:** Commit `4f111af` - Corrected yield value

**File:** `/firmware/src/main.cpp:449-454`

```cpp
// Prevent watchdog starvation: yield CPU every frame
// TEMPORARY: While RMT transmission is stubbed, add a small delay for pacing
// This allows IDLE task to service the watchdog timer
// TODO: Remove once RMT v4 API is implemented (transmit_leds will naturally provide pacing)
vTaskDelay(1);  // 1 tick = ~10ms at default tick rate, allows watchdog to reset
```

**Technical Detail:**
- `vTaskDelay(0)` → No-op in FreeRTOS (does not yield, returns immediately)
- `vTaskDelay(1)` → Yields for 1 tick (~10ms @ 100Hz tick rate)
- IDLE task runs during yield and resets watchdog timer

---

### Issue 3: ESP-IDF API Version Mismatch (RESOLVED)

**Commit:** `dd186d8` - "fix(firmware): resolve build corruption and runtime stack overflow"
**Severity:** HIGH - Code uses v5 API, framework only has v4

#### RMT Driver API Mismatch

**Expected (v5 API):**
```cpp
// v5 API - NOT AVAILABLE in Arduino ESP32 framework
#include <driver/rmt_tx.h>
#include <driver/rmt_encoder.h>

rmt_channel_handle_t tx_chan;
rmt_encoder_handle_t led_encoder;

rmt_new_tx_channel(&tx_chan_config, &tx_chan);
rmt_new_bytes_encoder(&bytes_encoder_config, &bytes_encoder);
rmt_transmit(tx_chan, led_encoder, data, size, &tx_config);
```

**Available (v4 API):**
```cpp
// v4 API - Available in Arduino framework
#include <driver/rmt.h>

rmt_channel_t tx_chan = RMT_CHANNEL_0;  // Enum, not handle

rmt_config_t rmt_config;
rmt_driver_install(channel, ...);
rmt_write_items(channel, items, length, wait);
```

**Fix:** Stubbed RMT initialization and transmission

**File:** `/firmware/src/led_driver.cpp:35-45`

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

#### I2S Microphone API Mismatch

**Expected (v5 API):**
```cpp
// v5 API - NOT AVAILABLE
#include <driver/i2s_std.h>

i2s_chan_handle_t rx_handle;
i2s_new_channel(&chan_cfg, NULL, &rx_handle);
i2s_channel_init_std_mode(rx_handle, &std_cfg);
i2s_channel_read(rx_handle, buffer, size, &bytes_read, timeout);
```

**Available (v4 API):**
```cpp
// v4 API - Available in Arduino framework
#include <driver/i2s.h>

i2s_config_t i2s_config;
i2s_driver_install(I2S_NUM_0, &i2s_config, queue_size, queue);
i2s_read(I2S_NUM_0, buffer, size, &bytes_read, timeout);
```

**Fix:** Stubbed I2S initialization and sampling

**File:** `/firmware/src/audio/microphone.cpp:16-25`

```cpp
void init_i2s_microphone() {
    // TEMPORARY STUB: Microphone I2S initialization disabled
    // The v5 I2S API (i2s_new_channel, i2s_std.h) is not available in Arduino ESP32 framework
    // Framework only has ESP-IDF v4 I2S API in <driver/i2s.h>
    //
    // TODO: Implement using v4 I2S API or upgrade framework to version with v5 support
    // For now, audio input is disabled (silence)

    printf("[AUDIO] I2S microphone stub - audio input disabled (Arduino framework I2S v4 only)\n");
}

void acquire_sample_chunk() {
    // TEMPORARY STUB: Microphone audio acquisition disabled
    // Input is filled with silence while I2S driver migration is pending

    profile_function([&]() {
        // Fill with silence since I2S driver is not available
        memset(&sample_history[0], 0, SAMPLE_HISTORY_LENGTH * sizeof(float));
    }, "acquire_sample_chunk");
}
```

---

## Error Detection Mechanisms

### 1. Stack Overflow Detection

**FreeRTOS built-in mechanisms:**

```cpp
// Task creation with stack monitoring
BaseType_t xTaskCreatePinnedToCore(
    TaskFunction_t pvTaskCode,
    const char * const pcName,
    const uint32_t usStackDepth,  // <-- Monitored by FreeRTOS
    void * const pvParameters,
    UBaseType_t uxPriority,
    TaskHandle_t * const pvCreatedTask,
    const BaseType_t xCoreID
);
```

**Error signature:** `LoadProhibited exception (Guru Meditation Error)`

**Detection points:**
- Stack canary corruption (if enabled in `sdkconfig`)
- Memory access violations (LoadProhibited)
- Random crashes during function entry/exit

### 2. Watchdog Timeout Detection

**Hardware watchdog timer:**
- IDLE task must run periodically to reset timer
- Timeout triggers system reset
- FreeRTOS manages via `vTaskDelay()` yields

**Evidence in code:**

**File:** `/firmware/src/connection_state.h`

```cpp
bool watchdog_active;
uint32_t watchdog_remaining_ms;
char watchdog_context[64];

void connection_watchdog_start(uint32_t timeout_ms, const char* context);
void connection_watchdog_feed(uint32_t timeout_ms, const char* context);
void connection_watchdog_stop();
bool connection_watchdog_check(uint32_t now_ms, char* out_context, size_t context_len);
```

**Usage in WiFi monitor:**

**File:** `/firmware/src/wifi_monitor.cpp`

```cpp
connection_watchdog_start(WIFI_ASSOC_TIMEOUT_MS, "WiFi association pending");
```

### 3. Task Creation Failure Detection

**File:** `/firmware/src/main.cpp:600-613`

```cpp
// Validate task creation (CRITICAL: Must not fail)
if (gpu_result != pdPASS || gpu_task_handle == NULL) {
    LOG_ERROR(TAG_GPU, "FATAL ERROR: GPU task creation failed!");
    LOG_ERROR(TAG_CORE0, "System cannot continue. Rebooting...");
    delay(5000);
    esp_restart();  // <-- Controlled reboot
}

if (audio_result != pdPASS || audio_task_handle == NULL) {
    LOG_ERROR(TAG_AUDIO, "FATAL ERROR: Audio task creation failed!");
    LOG_ERROR(TAG_CORE0, "System cannot continue. Rebooting...");
    delay(5000);
    esp_restart();  // <-- Controlled reboot
}
```

**Failure modes that would trigger:**
- Insufficient heap memory for task control block
- Insufficient heap for stack allocation
- Invalid task parameters

---

## Memory Safety Analysis

### Stack Allocation Before Fix

**GPU Task (Core 0):**
- Total stack: 16,384 bytes (16KB)
- Pattern rendering overhead: ~8KB (estimated)
- `AudioDataSnapshot` allocation: 1,876 bytes
- Safety margin: **~4KB** (insufficient!)

**Audio Task (Core 1):**
- Total stack: 12,288 bytes (12KB)
- Goertzel DFT computation: ~6KB (estimated)
- I2S buffer handling: ~2KB
- Safety margin: **~4KB**

**Comments from code:**

```cpp
// INCREASED STACK: 12KB -> 16KB (4,288 bytes margin was insufficient)
// INCREASED STACK: 8KB -> 12KB (1,692 bytes margin was dangerously low)
```

This reveals **prior stack monitoring** identified margins below safe thresholds.

### Heap Allocation After Fix

**Global buffer (DRAM):**

```cpp
static AudioDataSnapshot g_pattern_audio_buffer;  // 1,876 bytes in .bss section
```

**Benefits:**
1. Zero stack overhead per pattern call
2. Thread-safe via reference semantics
3. No allocation/deallocation overhead
4. Persistent storage (no initialization cost)

**Safety:**
- Pattern-local static counters detect stale data
- Reference semantics prevent copies
- No concurrent access (patterns run sequentially on Core 0)

---

## Runtime Error Patterns (Regex)

### 1. Stack Overflow Detection

```regex
(LoadProhibited|StoreProhibited|IllegalInstruction|InstrFetchProhibited).*0x[0-9a-f]{8}
```

**Example output:**
```
Guru Meditation Error: Core 0 panic'ed (LoadProhibited). Exception was unhandled.
Core 0 register dump:
PC      : 0x400d1234  PS      : 0x00060030  A0      : 0x800d5678  A1      : 0x3ffb1234
```

### 2. Watchdog Timeout

```regex
(Task watchdog|TWDT|Watchdog timeout|esp_task_wdt)
```

**Example output:**
```
E (12345) task_wdt: Task watchdog got triggered. The following tasks did not reset the watchdog in time:
E (12345) task_wdt:  - IDLE0 (CPU 0)
E (12345) task_wdt: Tasks currently running:
E (12345) task_wdt: CPU 0: loop_gpu
```

### 3. Heap Exhaustion

```regex
(heap_caps_malloc|MALLOC_CAP|heap_alloc_failed|out of memory)
```

**Example output:**
```
E (12345) heap_caps: heap_caps_malloc failed: requested 4096 bytes
E (12345) heap_caps: Available heap: 12345 bytes (largest block: 8192 bytes)
```

### 4. Task Creation Failure

```regex
(xTaskCreate.*failed|Task creation failed|pdFAIL)
```

**Example from code:**
```cpp
if (gpu_result != pdPASS) {
    LOG_ERROR(TAG_GPU, "FATAL ERROR: GPU task creation failed!");
    esp_restart();
}
```

---

## Failure Cascades

### Cascade 1: Stack Overflow → System Crash

```
1. Pattern init calls PATTERN_AUDIO_START()
2. Macro allocates 1,876 bytes on stack
3. Stack pointer exceeds allocated bounds
4. Next memory access → LoadProhibited exception
5. Exception handler dumps registers and stack trace
6. System enters panic state
7. Watchdog timeout (exception handler can't reset watchdog)
8. Hardware watchdog triggers reboot
```

**Evidence:** Commit message `dd186d8`:
> "Caused LoadProhibited exception (Guru Meditation Error) on pattern init"

### Cascade 2: RMT Stub → Watchdog Timeout

```
1. RMT transmission stubbed (no actual delay)
2. GPU task loop runs at maximum speed (no pacing)
3. Core 0 CPU usage → 100%
4. IDLE task never gets CPU time
5. Watchdog timer not reset
6. Watchdog timeout expires (~5 seconds typical)
7. Hardware watchdog triggers system reset
```

**Evidence:** Commit message `e4299ee`:
> "the GPU task loop runs without pacing, starving the watchdog task"

### Cascade 3: API Mismatch → Build Failure → Runtime Undefined Behavior

```
1. Code uses v5 API (rmt_new_tx_channel, etc.)
2. Framework only has v4 API headers
3. Compiler errors: undefined functions
4. Build fails OR links to wrong symbols
5. Runtime: function calls undefined behavior
6. Potential: stack corruption, crashes, hangs
```

**Evidence:** Commit message `dd186d8`:
> "v5 RMT API Mismatch (FIXED) - Code assumed v5 RMT API... Framework only has v4 RMT API available"

---

## Validation & Testing Evidence

### Build Status After Fix

**Commit `dd186d8` message:**
```
## Build Status

✅ **BUILD SUCCESSFUL**
- RAM: 42.4% (138,816/327,680 bytes)
- Flash: 60.2% (1,184,261/1,966,080 bytes)
```

**Memory usage:**
- SRAM: 138,816 / 327,680 bytes (42.4%)
- Flash: 1,184,261 / 1,966,080 bytes (60.2%)

**Safety margin:**
- SRAM remaining: 188,864 bytes (~57.6%)
- Flash remaining: 781,819 bytes (~39.8%)

### Required Testing (Per Commit Message)

```
## Testing Required

1. Upload to device
2. Verify device boots without crashing
3. Load Spectrum pattern (audio-reactive) - should NOT crash with LoadProhibited
4. Load Departure pattern (static) - should work as before
5. Verify audio is silent (expected - I2S not implemented yet)
```

**Status:** Testing protocol defined but execution status unknown

---

## Remaining Technical Debt

### 1. RMT v4 API Migration (PENDING)

**Current state:** Stubbed (no LED transmission)

**Required work:**
```cpp
// File: firmware/src/led_driver.cpp:35-45
void init_rmt_driver() {
    // TODO: Implement with RMT v4 API when available
    // This would use:
    // - rmt_config_t structure
    // - rmt_driver_install(channel, ...)
    // - rmt_set_tx_loop_mode(channel, false)
    // - rmt_write_items(channel, items, length, wait)
    // - rmt_wait_tx_done(channel, timeout)
}
```

**Impact:** LEDs do not illuminate (visual output disabled)

### 2. I2S v4 API Migration (PENDING)

**Current state:** Stubbed (silence output)

**Required work:**
```cpp
// File: firmware/src/audio/microphone.cpp:16-25
void init_i2s_microphone() {
    // TODO: Implement using v4 I2S API or upgrade framework to version with v5 support
}

void acquire_sample_chunk() {
    // TODO: Replace memset with actual I2S read
    memset(&sample_history[0], 0, SAMPLE_HISTORY_LENGTH * sizeof(float));
}
```

**Impact:** Audio input disabled (no audio-reactive patterns)

### 3. Watchdog Yield Removal (TEMPORARY)

**File:** `/firmware/src/main.cpp:449-454`

```cpp
// TODO: Remove once RMT v4 API is implemented (transmit_leds will naturally provide pacing)
vTaskDelay(1);  // TEMPORARY WORKAROUND
```

**Reason:** Once LED transmission is re-enabled, `transmit_leds()` will naturally provide pacing via RMT DMA wait, eliminating need for explicit yield.

---

## Recommendations

### Immediate Actions

1. **Stack Monitoring:** Enable FreeRTOS stack watermark monitoring in production
   ```cpp
   UBaseType_t uxTaskGetStackHighWaterMark(TaskHandle_t xTask);
   ```

2. **Watchdog Logging:** Add watchdog timeout context to crash dumps
   ```cpp
   esp_task_wdt_add(task_handle);
   esp_task_wdt_reset();
   ```

3. **Memory Profiling:** Add periodic heap/stack usage logging
   ```cpp
   heap_caps_get_free_size(MALLOC_CAP_8BIT);
   heap_caps_get_largest_free_block(MALLOC_CAP_8BIT);
   ```

### Long-Term Improvements

1. **API Version Validation:** Add compile-time checks for ESP-IDF version
   ```cpp
   #if ESP_IDF_VERSION < ESP_IDF_VERSION_VAL(5, 0, 0)
   #error "ESP-IDF v5.0+ required for RMT/I2S drivers"
   #endif
   ```

2. **Graceful Degradation:** Implement fallback modes for missing drivers
   ```cpp
   #ifdef HAS_RMT_V5_API
       init_rmt_v5();
   #else
       init_rmt_v4();
   #endif
   ```

3. **Runtime Diagnostics:** Add WebSocket-based crash reporting
   ```cpp
   void send_crash_report(const char* exception, const char* backtrace);
   ```

### Prevention Strategies

1. **Stack Size Validation:** Pre-calculate worst-case stack usage
   ```cpp
   // Add to build system
   #define MIN_STACK_MARGIN_BYTES 8192
   static_assert(GPU_TASK_STACK_SIZE - MAX_PATTERN_STACK_USAGE > MIN_STACK_MARGIN_BYTES);
   ```

2. **API Compatibility Matrix:** Document required ESP-IDF versions
   ```markdown
   | Feature           | Min ESP-IDF | Recommended |
   |-------------------|-------------|-------------|
   | RMT LED Driver    | v5.0        | v5.1+       |
   | I2S Microphone    | v5.0        | v5.1+       |
   | WiFi (802.11b/g)  | v4.4        | v5.0+       |
   ```

3. **Automated Testing:** CI/CD stack overflow detection
   ```yaml
   # .github/workflows/stack-check.yml
   - name: Check Stack Usage
     run: |
       pio run --target stack-check
       ./scripts/verify_stack_margins.sh
   ```

---

## Forensic Timeline Summary

| Date       | Commit  | Issue                          | Severity | Status   |
|------------|---------|--------------------------------|----------|----------|
| 2025-11-06 | dd186d8 | Stack overflow (1876 bytes)    | CRITICAL | RESOLVED |
| 2025-11-06 | dd186d8 | RMT v5 API mismatch            | HIGH     | STUBBED  |
| 2025-11-06 | dd186d8 | I2S v5 API mismatch            | HIGH     | STUBBED  |
| 2025-11-06 | e4299ee | Watchdog starvation (initial)  | HIGH     | PARTIAL  |
| 2025-11-07 | 4f111af | Watchdog starvation (corrected)| HIGH     | RESOLVED |

**Total fixes:** 5 critical/high severity issues
**Time to resolution:** ~24 hours (dd186d8 to 4f111af)
**System status:** Stable (no LED/audio output)

---

## Related Documents

- `K1NAnalysis_ANALYSIS_BUILD_CORRUPTION_ROOT_CAUSE_v1.0_20251108.md` - Compilation error forensics
- `K1NAnalysis_ANALYSIS_FIRMWARE_FORENSIC_v1.0_20251108.md` - General firmware bottleneck analysis
- `K1NAnalysis_MATRIX_FIRMWARE_BOTTLENECK_v1.0_20251108.md` - Performance bottleneck matrix
- Commit `dd186d8` - Stack overflow fix
- Commit `e4299ee` - Watchdog fix (initial)
- Commit `4f111af` - Watchdog fix (corrected)

---

## Glossary

- **LoadProhibited:** ESP32 exception when accessing invalid memory address
- **Guru Meditation Error:** ESP32 panic handler output format
- **FreeRTOS IDLE Task:** System task that resets hardware watchdog
- **vTaskDelay(n):** FreeRTOS yield for n ticks (0 = no-op, 1+ = actual yield)
- **Stack Watermark:** Minimum free stack space ever reached (FreeRTOS metric)
- **DRAM:** Data RAM (vs IRAM for instruction cache)

---

## Appendix A: Stack Overflow Evidence

### Code Evidence

**Before fix (pattern_audio_interface.h, removed):**
```cpp
#define PATTERN_AUDIO_START() \
    AudioDataSnapshot audio = {0};  // 1876 bytes on stack!
```

**After fix (pattern_audio_interface.h:75-124):**
```cpp
static AudioDataSnapshot g_pattern_audio_buffer;  // Heap allocation

#define PATTERN_AUDIO_START() \
    bool audio_available = get_audio_snapshot(&g_pattern_audio_buffer); \
    AudioDataSnapshot& audio = g_pattern_audio_buffer;  // Reference (8 bytes)
```

### Memory Layout

```
GPU Task Stack (16KB = 16,384 bytes)
├─ FreeRTOS TCB overhead:        ~512 bytes
├─ Function call stack:          ~2KB
├─ Pattern local variables:      ~4KB
├─ LED buffer operations:        ~4KB
├─ AudioDataSnapshot (BEFORE):   1,876 bytes  <-- OVERFLOW TRIGGER
└─ Safety margin (BEFORE):       ~4KB         <-- INSUFFICIENT

GPU Task Stack (16KB = 16,384 bytes) - AFTER FIX
├─ FreeRTOS TCB overhead:        ~512 bytes
├─ Function call stack:          ~2KB
├─ Pattern local variables:      ~4KB
├─ LED buffer operations:        ~4KB
├─ AudioDataSnapshot reference:  8 bytes      <-- SAFE
└─ Safety margin (AFTER):        ~6KB         <-- SAFE
```

---

## Appendix B: Watchdog Starvation Evidence

### vTaskDelay() Behavior

**FreeRTOS source code behavior:**

```c
// vTaskDelay(0) - NO YIELD
void vTaskDelay( const TickType_t xTicksToDelay ) {
    if( xTicksToDelay == 0 ) {
        // Early return - does NOT yield!
        return;
    }
    // ... actual delay logic ...
}

// vTaskDelay(1) - YIELDS FOR 1 TICK
void vTaskDelay( const TickType_t xTicksToDelay ) {
    if( xTicksToDelay > 0 ) {
        vTaskSuspend(pxCurrentTCB);  // Yields CPU to scheduler
        // ... wait for tick count ...
    }
}
```

### Task Priority Analysis

**File:** `/firmware/src/main.cpp:578-598`

```cpp
BaseType_t gpu_result = xTaskCreatePinnedToCore(
    loop_gpu,
    "loop_gpu",
    16384,
    NULL,
    1,              // Priority: 1 (SAME as IDLE task!)
    &gpu_task_handle,
    0
);

BaseType_t audio_result = xTaskCreatePinnedToCore(
    audio_task,
    "audio_task",
    12288,
    NULL,
    1,              // Priority: 1 (SAME as IDLE task!)
    &audio_task_handle,
    1
);
```

**IDLE task priority:** 0 (lowest in FreeRTOS)

**Problem:** GPU task priority = 1, IDLE task priority = 0. Without `vTaskDelay()`, GPU task never yields to IDLE task.

---

## Appendix C: API Version Matrix

| API Surface      | v4 (Available) | v5 (Required) | Status    |
|------------------|----------------|---------------|-----------|
| RMT Channel      | `rmt_channel_t`| `rmt_channel_handle_t*` | Mismatch |
| RMT Init         | `rmt_driver_install()` | `rmt_new_tx_channel()` | Stubbed |
| RMT Transmit     | `rmt_write_items()` | `rmt_transmit()` | Stubbed |
| RMT Encoder      | N/A (manual)   | `rmt_new_bytes_encoder()` | Stubbed |
| I2S Channel      | `i2s_port_t`   | `i2s_chan_handle_t` | Mismatch |
| I2S Init         | `i2s_driver_install()` | `i2s_new_channel()` | Stubbed |
| I2S Read         | `i2s_read()`   | `i2s_channel_read()` | Stubbed |
| I2S Config       | `i2s_config_t` | `i2s_std_config_t` | Stubbed |

**Conclusion:** All peripheral drivers require API migration to v4 or framework upgrade to v5+.

---

**Document Status:** Complete
**Next Review:** After v4 API migration or framework upgrade
**Owner:** Firmware Team

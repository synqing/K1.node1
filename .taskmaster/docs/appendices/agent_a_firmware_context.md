---
author: Claude Agent (from Phase 2D1 Master Strategy)
date: 2025-11-05
status: published
intent: Technical context for Agent A (Firmware Security Engineer) executing Phase 2D1 critical fixes
references:
  - ../../PHASE_2_MASTER_PRD.txt (Workstream A)
  - ../../../docs/02-adr/ADR-0001-codegen-abandonment.md
  - ../../../firmware/src/ (target codebase)
---

# Agent A: Firmware Security Engineer Context Appendix

## Role & Responsibilities

**Engineer:** Firmware Security & Optimization Specialist
**Primary Focus:** Phase 2D1 critical fixes, hardware validation, firmware hardening
**Workstreams:** Phase 2D1 Fixes (Workstream A), Graph PoC validation support (Workstream B)
**Timeline:** Weeks 1-2 (Nov 6-20) + parallel optimization Weeks 3-6
**Deliverable Deadline:** Nov 11 (Phase 2D1), Nov 12 (PoC support), Nov 13 (decision gate input)

---

## Task Ownership (Master PRD Tasks)

**Week 1 Phase 2D1 Critical Fixes:**
- **Task 1:** Remove WiFi credentials from source code → certificate-based provisioning
- **Task 2:** Fix I2S audio timeout protection → stable audio pipeline
- **Task 3:** WebServer bounds checking → memory safety hardening
- **Task 4:** Create comprehensive error code registry → telemetry infrastructure
- **Task 5:** ADR for codegen decision (research/documentation, no code)

**Week 1-2 PoC Support:**
- Provide hardware platforms for Agent B's graph PoC testing
- Validate code generation performance on actual ESP32-S3
- Profiling support (FPS measurement, memory analysis)

---

## ESP32-S3 Architecture Constraints

### Hardware Overview
- **Processor:** Dual-core Xtensa LX7 @ 240 MHz
- **RAM:** 512 KB SRAM (internal) + 8 MB PSRAM (external)
- **Flash:** 16 MB QSPI
- **Peripherals:** I2S, SPI, UART, GPIO, ADC, RMT (LED control)

### Critical Memory Management
```
┌─────────────────────────────────────────────────┐
│ SRAM (512 KB total)                             │
├─────────────────────────────────────────────────┤
│ Stack (96 KB) ← CRITICAL: Don't exceed          │
│ Heap (200 KB) ← Dynamic allocation zone         │
│ FreeRTOS (50 KB) ← RTOS kernel                  │
│ WiFi driver (70 KB) ← Can't be freed            │
│ Audio buffers (60 KB) ← I2S DMA                 │
│ Graph state (???) ← MEASURE THIS for PoC        │
└─────────────────────────────────────────────────┘

PSRAM (8 MB):
├─ Pattern data (~2 MB for all 15 patterns)
├─ Framebuffer (~400 KB)
├─ WiFi buffers (~300 KB)
└─ Available for graphs (~5 MB)
```

**Critical Rule:** Stack usage must stay < 90 KB (never exceed 100 KB or heap corruption)

### Dual-Core Execution Model
- **Core 0:** FreeRTOS kernel + system tasks
- **Core 1:** Pattern execution + LED control
- **Affinity:** Keep pattern task on Core 1 for cache locality
- **Synchronization:** Use semaphores/mutexes for WiFi/I2S access (not spinlocks)

### Watchdog Timers
- **Task watchdog:** 15-second timeout per FreeRTOS task
- **Interrupt watchdog:** 5-second timeout for ISRs
- **Impact:** I2S timeout (Fix #2) often triggers task watchdog → must add keep-alive in audio handler

---

## Critical Fix Patterns

### Fix #1: Remove WiFi Credentials

**Current Issue:** Credentials hardcoded in `firmware/src/wifi_provisioning.h`
```cpp
// BEFORE (VULNERABLE)
const char* WIFI_SSID = "SpectraLabs";
const char* WIFI_PASSWORD = "supersecret123";
```

**Solution Pattern:**
1. **Remove hardcoded strings** from all source files and headers
2. **Implement certificate-based provisioning** (ESP32 BLE provisioning)
3. **Runtime discovery** via BLE/QR code scan
4. **Secure storage** using NVS encrypted partition

**Implementation Steps:**
```cpp
// AFTER (SECURE)
// 1. Use ESP32 BLE provisioning protocol
esp_ble_prov_t provisioning_manager = {
    .scheme = BLE_SCHEME,
    .ui_hint = PROV_UI_QRCODE
};

// 2. Store credentials in encrypted NVS
nvs_handle_t nvs_handle;
nvs_open("wifi", NVS_READWRITE, &nvs_handle);
nvs_set_blob(nvs_handle, "ssid", ssid_data, ssid_len);
nvs_set_blob(nvs_handle, "password", pass_data, pass_len);
nvs_commit(nvs_handle);

// 3. Load at runtime
uint8_t ssid[32], password[64];
size_t ssid_len = sizeof(ssid);
nvs_get_blob(nvs_handle, "ssid", ssid, &ssid_len);
```

**Validation:**
- [ ] Grep entire codebase for hardcoded strings: `grep -r "SpectraLabs\|supersecret" firmware/`
- [ ] BLE provisioning flow works (QR code → WiFi connection)
- [ ] Device boots, connects, without stored credentials
- [ ] Security scan passes (no embedded secrets)

**Time Estimate:** 2 hours
**Risk:** Low (well-documented pattern in ESP-IDF)

---

### Fix #2: I2S Timeout Protection

**Current Issue:** I2S audio can hang indefinitely if MCLK fails or buffer stalls
**Symptom:** Device unresponsive, watchdog doesn't fire (I2S ISR blocks interrupt watchdog)

**Root Cause:** I2S driver doesn't timeout on buffer underrun
```cpp
// PROBLEMATIC CODE
void audio_task(void *arg) {
    while (1) {
        i2s_read(I2S_NUM_0, audio_buffer, BUFFER_SIZE, &bytes_read, portMAX_DELAY);
        // If MCLK fails, this blocks forever ← BAD
    }
}
```

**Solution Pattern:**
1. **Add timeout to I2S read** (use `xTaskNotifyWait` for timeout)
2. **Detect underrun condition** (check FIFO levels)
3. **Restart I2S pipeline** if timeout detected
4. **Log error codes** for telemetry

**Implementation:**
```cpp
void audio_task(void *arg) {
    TickType_t timeout = pdMS_TO_TICKS(500);  // 500ms timeout
    uint32_t notification;

    while (1) {
        // Try read with timeout
        esp_err_t ret = i2s_read(I2S_NUM_0, audio_buffer, BUFFER_SIZE,
                                 &bytes_read, timeout);

        if (ret == ESP_ERR_TIMEOUT) {
            // Log error, attempt recovery
            error_registry_record(ERROR_I2S_TIMEOUT, bytes_read);
            i2s_stop(I2S_NUM_0);
            vTaskDelay(pdMS_TO_TICKS(100));
            i2s_start(I2S_NUM_0);
            continue;
        }

        // Process audio...
    }
}
```

**Validation:**
- [ ] Disconnect MCLK wire → device recovers within 1 second
- [ ] Stress test: rapid pattern changes → no hangs
- [ ] Error codes logged to telemetry
- [ ] Task watchdog never fires

**Time Estimate:** 1 hour
**Risk:** Low (localized to I2S driver)

---

### Fix #3: WebServer Bounds Checking

**Current Issue:** HTTP server doesn't validate input sizes, can overflow buffers
**Risk:** Malformed HTTP requests can corrupt heap

**Attack Vector:**
```
POST /api/pattern HTTP/1.1
Content-Length: 999999999
[payload oversized]
```

**Solution Pattern:**
1. **Validate Content-Length** before allocating buffers
2. **Add bounds checks** to all buffer operations
3. **Implement fuzzing tests** for HTTP parser

**Implementation:**
```cpp
#define MAX_REQUEST_SIZE 8192  // 8 KB limit
#define MAX_HEADER_SIZE 512    // 512 byte headers

esp_err_t http_handler(httpd_req_t *req) {
    // 1. Validate content length
    int content_len = httpd_req_get_hdr_value_len(req, "Content-Length");
    if (content_len < 0 || content_len > MAX_REQUEST_SIZE) {
        return httpd_resp_send_500(req);  // Reject
    }

    // 2. Allocate with bounds
    char *buffer = malloc(content_len + 1);
    if (!buffer || content_len > MAX_REQUEST_SIZE) {
        return httpd_resp_send_500(req);
    }

    // 3. Read with size limit
    int read = httpd_req_recv(req, buffer, content_len);
    if (read != content_len) {
        free(buffer);
        return httpd_resp_send_500(req);
    }

    buffer[content_len] = '\0';
    // Process...
    free(buffer);
    return ESP_OK;
}
```

**Validation:**
- [ ] Fuzzing: 1000+ malformed HTTP requests → no crashes
- [ ] Boundary tests: Content-Length at limits (0, 8192, 8193)
- [ ] Memory profiler: no heap corruption detected
- [ ] Static analysis clean (no unsafe functions)

**Time Estimate:** 2 hours
**Risk:** Medium (touches HTTP parser, needs regression testing)

---

### Fix #4: Error Code Registry

**Current Issue:** Error codes scattered across codebase, inconsistent format
**Goal:** Unified error telemetry infrastructure

**Solution Pattern:**
1. **Centralized error enum** in `firmware/src/error_codes.h`
2. **Telemetry struct** with timestamp + context
3. **Circular buffer** (last 100 errors)
4. **API endpoint** to retrieve error history

**Implementation:**
```cpp
// error_codes.h
typedef enum {
    ERROR_NONE = 0x00,
    // WiFi errors
    ERROR_WIFI_CONNECT = 0x10,
    ERROR_WIFI_TIMEOUT = 0x11,
    ERROR_PROVISIONING = 0x12,
    // Audio errors
    ERROR_I2S_TIMEOUT = 0x20,
    ERROR_I2S_OVERFLOW = 0x21,
    ERROR_AUDIO_UNDERRUN = 0x22,
    // HTTP errors
    ERROR_HTTP_PARSE = 0x30,
    ERROR_HTTP_OVERFLOW = 0x31,
    // Pattern errors
    ERROR_PATTERN_INVALID = 0x40,
    ERROR_PATTERN_MEMORY = 0x41,
} error_code_t;

typedef struct {
    error_code_t code;
    uint32_t timestamp;
    uint32_t context;  // Arg-specific context
} error_record_t;

// Circular buffer
#define ERROR_BUFFER_SIZE 100
error_record_t error_buffer[ERROR_BUFFER_SIZE];
uint32_t error_head = 0;

void error_record(error_code_t code, uint32_t context) {
    error_buffer[error_head].code = code;
    error_buffer[error_head].timestamp = xTaskGetTickCount();
    error_buffer[error_head].context = context;
    error_head = (error_head + 1) % ERROR_BUFFER_SIZE;
}

// HTTP API
esp_err_t error_history_handler(httpd_req_t *req) {
    cJSON *root = cJSON_CreateArray();
    for (int i = 0; i < ERROR_BUFFER_SIZE; i++) {
        int idx = (error_head + i) % ERROR_BUFFER_SIZE;
        cJSON_AddItemToArray(root, /* error record */ );
    }
    // Send JSON response
}
```

**Validation:**
- [ ] All error paths use error_record() API
- [ ] Telemetry endpoint returns last 100 errors
- [ ] API documentation complete
- [ ] Coverage: error injection tests for all error codes

**Time Estimate:** 4 hours
**Risk:** Low (new infrastructure, no existing code changes)

---

## Performance Optimization Strategies

### FPS Budget & Memory Management

**Target:** <2% FPS impact from graph system overhead

**Measurement Methodology:**
```cpp
// 1. Baseline FPS (hardcoded patterns)
uint32_t frame_start = xTaskGetTickCount();
// ... render frame ...
uint32_t frame_end = xTaskGetTickCount();
uint32_t baseline_ms = (frame_end - frame_start);  // e.g., 16.7ms for 60 FPS

// 2. Graph system FPS (compiled graphs)
// ... same measurement ...
uint32_t graph_ms = (frame_end - frame_start);

// 3. Calculate overhead
float overhead_pct = ((graph_ms - baseline_ms) / baseline_ms) * 100;
// Must be < 2% (e.g., 16.7ms → 17.0ms acceptable)
```

### Memory Budget

**Per-Pattern Budget:**
- Compiled C++ code: 500-1000 bytes
- State buffers: 500-1500 bytes
- Total: <2 KB per pattern

**Graph System Overhead:**
- Node allocator: 1 KB
- Type registry: 500 bytes
- Total: <2 KB system overhead

---

## Common Pitfalls & Anti-Patterns

### ❌ DON'T: Block I2S ISR
```cpp
// WRONG: Mutex in I2S ISR
void IRAM_ATTR i2s_isr_handler(void *arg) {
    xSemaphoreTakeFromISR(mutex, NULL);  // ← DEADLOCK RISK
    // ...
}
```

### ✅ DO: Use atomic access or queues
```cpp
// RIGHT: Atomic flag in ISR
void IRAM_ATTR i2s_isr_handler(void *arg) {
    atomic_flag_set(&audio_ready);  // ← Safe
}
```

### ❌ DON'T: malloc() in ISR
```cpp
// WRONG: Memory allocation in ISR
void IRAM_ATTR pattern_isr(void *arg) {
    uint8_t *buf = malloc(1024);  // ← Can't malloc in ISR!
}
```

### ✅ DO: Pre-allocate and reuse
```cpp
// RIGHT: Pre-allocated buffers
static uint8_t pattern_buf[1024];  // Global, no malloc in ISR
void IRAM_ATTR pattern_isr(void *arg) {
    memset(pattern_buf, 0, sizeof(pattern_buf));
}
```

---

## Testing Framework Integration

### Hardware Validation Protocol

**Phase 2D1 Hardware Tests:**
```bash
# 1. Boot test (100 cycles)
for i in {1..100}; do
    power_off_device
    sleep 1
    power_on_device
    wait_for_ready_signal  # 30 sec timeout
    [ $? -eq 0 ] || exit 1
done

# 2. WiFi reconnection test (10 cycles)
for i in {1..10}; do
    disconnect_wifi
    wait_for_reconnect  # 5 sec timeout
    [ $? -eq 0 ] || exit 1
done

# 3. I2S stress test (1000 pattern changes)
for i in {1..1000}; do
    send_pattern_change_command
    sleep 0.1  # 100ms between changes
    check_audio_output
    [ $? -eq 0 ] || exit 1
done

# 4. Temperature monitoring (24h run)
nohup ./firmware_stress_test.sh > /tmp/stress_24h.log 2>&1 &
# Periodically sample temp, ensure < 65°C
```

**Success Criteria:**
- ✅ 100 boot cycles: 0 hangs
- ✅ 10 WiFi reconnects: all succeed < 5 sec
- ✅ 1000 pattern changes: 0 crashes, 0 audio glitches
- ✅ 24h temp: <65°C sustained

---

## Key Contacts & Escalation

- **Code Review:** Architecture-Review team (ADR decisions)
- **Blocker Escalation:** Orchestrator → Engineering Lead
- **Hardware Issues:** DevOps (test device provisioning)

---

**Appendix Status:** READY FOR EXECUTION
**First Task:** Task 1 (WiFi credentials) - Nov 6, morning
**Last Sync:** 2025-11-05

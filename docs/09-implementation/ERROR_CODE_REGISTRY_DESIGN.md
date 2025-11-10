# Comprehensive Error Code Registry Design Specification

**Title:** Error Code Registry for K1.node1 System
**Version:** 1.0
**Date:** 2025-11-10
**Status:** Proposed
**Owner:** Task 4 - Error Management
**Scope:** Firmware (ESP32-S3), REST API, WebSocket, Telemetry
**Tags:** error-handling, registry, subsystem-integration, validation

---

## Executive Summary

This design specification establishes a **comprehensive, centralized error code registry** for the K1.node1 system. The registry provides:

1. **130 pre-defined error codes** (0-255) organized by subsystem
2. **Structured metadata** (severity, recovery action, remediation) for each code
3. **Unified error handling** across firmware, REST API, and telemetry
4. **Industry-aligned patterns** based on ESP-IDF, embedded systems standards
5. **Extensible architecture** for future graph nodes and protocol versions

**Current State:** Baseline error_codes.h/cpp exist with 130 codes defined; this spec formalizes taxonomy, integration patterns, and operational procedures.

---

## Table of Contents

1. [Error Code Taxonomy](#error-code-taxonomy)
2. [Detailed Subsystem Breakdown](#detailed-subsystem-breakdown)
3. [Industry Standards Analysis](#industry-standards-analysis)
4. [Registry Structure & Organization](#registry-structure--organization)
5. [Integration Points](#integration-points)
6. [Logging & Telemetry](#logging--telemetry)
7. [Adding New Error Codes](#adding-new-error-codes)
8. [Operational Procedures](#operational-procedures)
9. [Examples & Reference](#examples--reference)
10. [Migration & Rollout](#migration--rollout)

---

## Error Code Taxonomy

### Overview

Error codes are organized by **subsystem** with **range allocation**:

| Range | Subsystem | Count | Codes |
|-------|-----------|-------|-------|
| 0-9 | Core System | 10 | System health, state, build signature |
| 10-19 | WiFi/Network | 10 | Connectivity, provisioning, DHCP |
| 20-29 | I2S/Audio | 10 | Microphone, DMA, I/O errors |
| 30-39 | RMT/LED | 10 | LED driver, dual-channel sync, buffer |
| 40-49 | WebServer/HTTP | 10 | REST API, JSON, WebSocket |
| 50-59 | Parameter/Config | 10 | Registry, persistence, validation |
| 60-69 | Storage (SPIFFS/NVS) | 10 | Filesystem, NVS, corruption |
| 70-79 | OTA/Firmware | 10 | Updates, version control, auth |
| 80-89 | Synchronization | 10 | Mutex, semaphore, queue |
| 90-99 | Resource/Memory | 10 | Malloc, stack, heap, DMA |
| 100-109 | Audio Processing | 10 | DFT, beat detection, novelty |
| 110-119 | Pattern/Rendering | 10 | Pattern, palette, animation |
| 120-129 | Telemetry | 10 | Diagnostics, profiler, heartbeat |
| 130-255 | Reserved/Graph | 126 | Future node types, custom protocols |

**Total Allocated:** 130 codes
**Reserved for Expansion:** 126 codes
**Design Principle:** One code per specific failure mode, no aliases

---

## Detailed Subsystem Breakdown

### 1. Core System (0-9)

Covers fundamental system health and initialization.

| Code | Name | Severity | Recovery | Cause | Remediation |
|------|------|----------|----------|-------|-------------|
| 0 | ERR_OK | INFO | IGNORE | No error | N/A |
| 1 | ERR_UNKNOWN | HIGH | LOG | Unexpected state | Enable debug logging, retry |
| 2 | ERR_GENERIC | MEDIUM | LOG | Insufficient context | Check logs for context |
| 3 | ERR_NOT_IMPLEMENTED | LOW | LOG | Feature stub | Wait for feature release |
| 4 | ERR_INVALID_STATE | HIGH | LOG | State incompatible | Reset state, retry |
| 5 | ERR_TIMEOUT | MEDIUM | RETRY | Operation time limit | Check load, retry |
| 6 | ERR_HARDWARE_FAULT | CRITICAL | LOG | GPIO/sensor failure | Check hardware connections |
| 7 | ERR_FIRMWARE_MISMATCH | HIGH | LOG | Version incompatible | OTA update to match |
| 8 | ERR_BUILD_SIGNATURE_INVALID | HIGH | LOG | Toolchain mismatch | Clean rebuild |
| 9 | ERR_SYSTEM_BUSY | MEDIUM | LOG | Capacity exceeded | Reduce load, retry |

**Entry Points:**
- System boot validation (`main.cpp`)
- Firmware version checks (`firmware/src/profiling.h`)
- Build signature validation (boot logs)

---

### 2. WiFi/Network (10-19)

All network connectivity, provisioning, and configuration errors.

| Code | Name | Severity | Recovery | Trigger | Detection |
|------|------|----------|----------|---------|-----------|
| 10 | ERR_WIFI_NO_CREDENTIALS | HIGH | LOG | WIFI_SSID/WIFI_PASSWORD missing | Boot check in `wifi_monitor.cpp` |
| 11 | ERR_WIFI_SSID_NOT_FOUND | MEDIUM | RETRY | Network not broadcasting | Scan failure in provisioning |
| 12 | ERR_WIFI_AUTH_FAILED | HIGH | LOG | Wrong password | Authentication timeout |
| 13 | ERR_WIFI_CONNECT_TIMEOUT | MEDIUM | RETRY | Connection exceeds 30s | `WIFI_RECONNECT_INTERVAL_MS` timer |
| 14 | ERR_WIFI_PROVISIONING_TIMEOUT | MEDIUM | LOG | No credentials in AP mode | Timeout in provisioning handler |
| 15 | ERR_WIFI_LINK_LOST | MEDIUM | RETRY | Connection dropped unexpectedly | `wl_status_t` changes to disconnected |
| 16 | ERR_NETWORK_UNAVAILABLE | MEDIUM | FALLBACK | No network services | DHCPnot acquired |
| 17 | ERR_DNS_RESOLUTION_FAILED | LOW | RETRY | Hostname→IP fails | `gethostbyname()` returns NULL |
| 18 | ERR_DHCP_FAILED | HIGH | RETRY | DHCP lease denied | DHCP timeout/rejection |
| 19 | ERR_STATIC_IP_CONFIG_INVALID | HIGH | LOG | IP/gateway/subnet invalid | Validation in config load |

**Entry Points:**
- `wifi_monitor.cpp:on_wifi_status_change()` (lines 45-85)
- `wifi_monitor.cpp:provision_mode()` (provisioning timeout)
- `webserver.cpp:setup_wifi()` (credential check)

**Integration Point:**
```cpp
// In wifi_monitor.cpp: map WiFi status to K1 error codes
if (WiFi.status() == WL_CONNECT_FAILED) {
    // Distinguish between:
    // - ERR_WIFI_AUTH_FAILED (wrong password)
    // - ERR_WIFI_SSID_NOT_FOUND (network missing)
    // - ERR_WIFI_CONNECT_TIMEOUT (took too long)
}
```

---

### 3. I2S/Audio (20-29)

Microphone initialization, I/O, DMA, and sample processing.

| Code | Name | Severity | Recovery | Trigger | Location |
|------|------|----------|----------|---------|----------|
| 20 | ERR_I2S_INIT_FAILED | CRITICAL | RESET | Driver init returned error | `microphone.cpp:i2s_new_channel()` |
| 21 | ERR_I2S_CONFIG_INVALID | CRITICAL | LOG | Sample rate/bits/channels invalid | Config validation |
| 22 | ERR_I2S_DMA_ALLOC_FAILED | CRITICAL | REBOOT | Insufficient DMA memory | `dma_alloc_coherent()` returns NULL |
| 23 | ERR_I2S_CLOCK_CONFIG_FAILED | CRITICAL | LOG | MCLK/divider configuration fails | RMT refill probe setup |
| 24 | ERR_I2S_READ_TIMEOUT | HIGH | FALLBACK | No samples for 500ms+ | Timeout protection (`microphone.cpp:156`) |
| 25 | ERR_I2S_READ_OVERRUN | MEDIUM | FALLBACK | DMA buffer overflow (samples lost) | Overrun detection in callback |
| 26 | ERR_I2S_PIN_CONFIG_FAILED | CRITICAL | LOG | GPIO pin mapping fails | `gpio_set_pull_mode()` returns error |
| 27 | ERR_MICROPHONE_INIT_FAILED | CRITICAL | LOG | SPH0645 init failed | I2S channel/encoder creation fails |
| 28 | ERR_AUDIO_BUFFER_EXHAUSTED | MEDIUM | FALLBACK | Ring buffer full | Timestamp desync in pipeline |
| 29 | ERR_AUDIO_PROCESSING_STALLED | HIGH | RESET | Audio task not responding | Heartbeat miss (120ms) |

**Entry Points:**
- `firmware/src/audio/microphone.cpp` (lines 20-200)
- `firmware/src/audio/microphone.h` (state struct, error tracking)
- Telemetry endpoint: `/api/device/performance` (audio frame rate)

**Timeout Protection Pattern:**
```cpp
// In microphone.cpp (lines 156-181)
if (i2s_result == ESP_ERR_TIMEOUT) {
    i2s_timeout_state.last_error_code = ERR_I2S_READ_TIMEOUT;
    // Fallback: use silence/last-good-value
    i2s_timeout_state.consecutive_timeouts++;
    if (i2s_timeout_state.consecutive_timeouts > 10) {
        // Escalate to ERR_AUDIO_PROCESSING_STALLED
        report_error(ERR_AUDIO_PROCESSING_STALLED);
    }
}
```

---

### 4. RMT/LED (30-39)

RMT driver initialization, LED transmission, dual-channel sync, buffer management.

| Code | Name | Severity | Recovery | Trigger | Measurement |
|------|------|----------|----------|---------|-------------|
| 30 | ERR_RMT_INIT_FAILED | CRITICAL | RESET | RMT driver init failed | `rmt_new_tx_channel()` returns error |
| 31 | ERR_RMT_CONFIG_INVALID | CRITICAL | LOG | Clock/channel config incompatible | Config validation at boot |
| 32 | ERR_RMT_ALLOCATE_FAILED | CRITICAL | LOG | No RMT channels available | Channel allocation exhausted |
| 33 | ERR_RMT_DMA_ALLOC_FAILED | CRITICAL | REBOOT | Insufficient DMA for RMT | `dma_alloc_coherent()` fails |
| 34 | ERR_RMT_ENCODER_CONFIG_FAILED | CRITICAL | LOG | LED encoder init fails | WS2812 protocol config error |
| 35 | ERR_RMT_TRANSMIT_TIMEOUT | HIGH | RESET | LED transmission exceeds 200ms | Timeout in `led_driver.h:transmit()` |
| 36 | ERR_RMT_DUAL_CHANNEL_SYNC_FAIL | HIGH | FALLBACK | Cannot sync two channels | Back-to-back `rmt_transmit()` spacing fails |
| 37 | ERR_RMT_MEMORY_BLOCK_EXHAUSTED | HIGH | LOG | `mem_block_symbols < 256` for LED count | Capacity check: `LED_COUNT > 160` |
| 38 | ERR_LED_DATA_INVALID | MEDIUM | FALLBACK | Frame data corrupted | CRC/length validation failure |
| 39 | ERR_LED_OUTPUT_STALLED | MEDIUM | RESET | TX loop unresponsive for 100ms | Transmission heartbeat missed |

**Entry Points:**
- `firmware/src/led_driver.h` (dual-channel RMT config, lines ~50-200)
- `firmware/src/led_driver.cpp` (RMT initialization logs)
- Telemetry probe: `/api/rmt` (refill count, max gap µs)

**Dual-Channel Sync Pattern:**
```cpp
// In led_driver.h (synchronized transmit)
// Wait both channels done (bounded):
(void)rmt_tx_wait_all_done(tx_chan,   pdMS_TO_TICKS(8));
(void)rmt_tx_wait_all_done(tx_chan_2, pdMS_TO_TICKS(8));

// Start back-to-back with <5µs spacing:
uint32_t t0 = micros();
rmt_transmit(tx_chan,   led_encoder,   raw_led_data,      len1, &tx_config);
rmt_transmit(tx_chan_2, led_encoder_2, raw_led_data_ch2,  len2, &tx_config);

// If spacing > 10µs: set ERR_RMT_DUAL_CHANNEL_SYNC_FAIL
```

**Memory Block Capacity:**
```cpp
// Constraint: 160 LEDs per channel × 2 channels = 320 total
// mem_block_symbols = 256 (hardware limit)
// Each LED = ~3 symbols (24-bit GRB)
// Maximum: 256/3 ≈ 85 LEDs per channel safely
// Task 21 overrides to 160/channel with careful buffering

if (LED_COUNT > 256/3) {
    report_error(ERR_RMT_MEMORY_BLOCK_EXHAUSTED);
}
```

---

### 5. WebServer/HTTP (40-49)

REST API, JSON parsing, WebSocket, rate limiting, bounds violations.

| Code | Name | Severity | Recovery | Trigger | Handler |
|------|------|----------|----------|---------|---------|
| 40 | ERR_WEBSERVER_INIT_FAILED | HIGH | LOG | AsyncWebServer init fails | `webserver.cpp:setup_web_server()` |
| 41 | ERR_WEBSERVER_PORT_IN_USE | HIGH | LOG | Port 80/443 already in use | Port bind failure |
| 42 | ERR_WEBSERVER_HANDLER_ERROR | MEDIUM | LOG | Handler throws exception | Catch-all in handler wrapper |
| 43 | ERR_HTTP_REQUEST_INVALID | LOW | IGNORE | Malformed HTTP syntax | Request parser error |
| 44 | ERR_HTTP_BODY_TOO_LARGE | LOW | IGNORE | Body exceeds 64KB limit | `webserver_bounds.h:bounds_check_http_body()` |
| 45 | ERR_HTTP_HEADER_OVERFLOW | LOW | IGNORE | >32 headers in request | Header count validation |
| 46 | ERR_HTTP_QUERY_PARAM_OVERFLOW | LOW | IGNORE | >16 query parameters | Parameter count validation |
| 47 | ERR_JSON_PARSE_FAILED | MEDIUM | LOG | Invalid JSON syntax | ArduinoJson `deserializeJson()` fails |
| 48 | ERR_JSON_BUFFER_OVERFLOW | MEDIUM | IGNORE | JSON doc >1KB | StaticJsonDocument size exceeded |
| 49 | ERR_WEBSOCKET_CONNECTION_LOST | LOW | LOG | Client disconnects unexpectedly | WebSocket event handler |

**Entry Points:**
- `firmware/src/webserver.cpp` (handler registration, lines ~150-300)
- `firmware/src/webserver_request_handler.h` (rate limiting, lines 157-179)
- `firmware/src/webserver_bounds.h` (bounds checking, lines 43-60)

**Rate Limiting Integration:**
```cpp
// In webserver_request_handler.h:handleWithRateLimit()
if (route_is_rate_limited(route_path, route_method, &window_ms, &next_ms)) {
    ctx.sendError(429, "rate_limited", "Too many requests");
    // Not an error code, but HTTP 429 maps to rate_limited string
}
```

**JSON Parsing Error:**
```cpp
// In RequestContext constructor (lines 40-51)
if (err) {
    delete json_doc;
    json_parse_error = true;
    // Later in handleWithRateLimit():
    if (route_method == ROUTE_POST && ctx.json_parse_error) {
        ctx.sendError(400, "invalid_json", "Request body contains invalid JSON");
        // Should map to ERR_JSON_PARSE_FAILED (47)
    }
}
```

---

### 6. Parameter/Config (50-59)

Parameter registry, configuration persistence, validation, environment variables.

| Code | Name | Severity | Recovery | Trigger | Location |
|------|------|----------|----------|---------|----------|
| 50 | ERR_PARAM_INVALID | LOW | LOG | Value out of range | Validation in setter |
| 51 | ERR_PARAM_NOT_FOUND | LOW | LOG | Parameter name not in registry | Lookup fails |
| 52 | ERR_PARAM_READ_FAILED | MEDIUM | FALLBACK | NVS read fails | NVS API returns error |
| 53 | ERR_PARAM_WRITE_FAILED | MEDIUM | RETRY | NVS write fails | NVS API returns error |
| 54 | ERR_PARAM_LOCK_CONTENTION | MEDIUM | RETRY | Mutex timeout on param access | Lock wait >100ms |
| 55 | ERR_CONFIG_LOAD_FAILED | HIGH | FALLBACK | Config file missing/corrupted | SPIFFS open or CRC check fails |
| 56 | ERR_CONFIG_SAVE_FAILED | MEDIUM | LOG | Failed to write config | SPIFFS write error |
| 57 | ERR_CONFIG_CORRUPTION_DETECTED | HIGH | FALLBACK | CRC/version check fails | Config integrity validation |
| 58 | ERR_CONFIG_VERSION_MISMATCH | HIGH | LOG | Config version incompatible | Version number mismatch |
| 59 | ERR_ENV_VAR_MISSING | HIGH | LOG | Required .env var not set | Boot-time validation |

**Integration Points:**
- Parameter system (future; not yet implemented in codebase)
- Config SPIFFS persistence (future)
- Environment variable loading (boot)

---

### 7. Storage/SPIFFS/NVS (60-69)

Filesystem operations, file I/O, NVS (flash), corruption detection.

| Code | Name | Severity | Recovery | Trigger | Remediation |
|------|------|----------|----------|---------|-------------|
| 60 | ERR_SPIFFS_MOUNT_FAILED | HIGH | RESET | Mount operation fails | Format and remount |
| 61 | ERR_SPIFFS_FORMAT_FAILED | CRITICAL | LOG | Format operation fails | Hardware issue; check storage |
| 62 | ERR_SPIFFS_FILE_NOT_FOUND | LOW | FALLBACK | Requested file missing | Upload file or use default |
| 63 | ERR_SPIFFS_FILE_WRITE_FAILED | MEDIUM | LOG | Write operation fails | Check storage space |
| 64 | ERR_SPIFFS_FILE_READ_FAILED | MEDIUM | RETRY | Read operation fails | Retry or check file integrity |
| 65 | ERR_SPIFFS_STORAGE_FULL | HIGH | LOG | No space available | Delete unused files |
| 66 | ERR_SPIFFS_CORRUPTION | HIGH | RESET | Filesystem corrupted | Reformat SPIFFS |
| 67 | ERR_NVS_INIT_FAILED | CRITICAL | LOG | NVS driver init fails | Check partition config |
| 68 | ERR_NVS_READ_FAILED | MEDIUM | FALLBACK | NVS read fails | Use default value |
| 69 | ERR_NVS_WRITE_FAILED | MEDIUM | RETRY | NVS write fails | Retry or check space |

---

### 8. OTA/Firmware (70-79)

Firmware updates, version checking, authentication, compatibility validation.

| Code | Name | Severity | Recovery | Trigger | Detection |
|------|------|----------|----------|---------|-----------|
| 70 | ERR_OTA_NOT_AVAILABLE | LOW | LOG | OTA not enabled | Config check |
| 71 | ERR_OTA_INIT_FAILED | HIGH | LOG | ArduinoOTA init fails | Init call returns error |
| 72 | ERR_OTA_BEGIN_FAILED | HIGH | LOG | Update.begin() fails | Insufficient space or bad config |
| 73 | ERR_OTA_RECEIVE_FAILED | HIGH | RETRY | Data reception fails | Network/timing error |
| 74 | ERR_OTA_WRITE_FAILED | CRITICAL | LOG | Flash write fails | Hardware error, bad sectors |
| 75 | ERR_OTA_END_FAILED | CRITICAL | LOG | Finalization fails | Integrity check fails |
| 76 | ERR_OTA_AUTH_FAILED | HIGH | LOG | Password mismatch | Credential validation fails |
| 77 | ERR_OTA_TIMEOUT | MEDIUM | RETRY | Operation exceeds timeout | Network latency |
| 78 | ERR_OTA_VERSION_DOWNGRADE | HIGH | LOG | Attempt to downgrade | Version guard enabled |
| 79 | ERR_OTA_COMPATIBILITY_CHECK | HIGH | LOG | Hardware incompatible | Chip ID or feature mismatch |

---

### 9. Synchronization (80-89)

Concurrency primitives, queue management, ring buffers, ISR safety.

| Code | Name | Severity | Recovery | Trigger | Example |
|------|------|----------|----------|---------|---------|
| 80 | ERR_MUTEX_ACQUIRE_TIMEOUT | MEDIUM | LOG | Mutex lock wait >100ms | Potential deadlock |
| 81 | ERR_SPINLOCK_ACQUIRE_TIMEOUT | MEDIUM | LOG | Spinlock contention | ISR frequency too high |
| 82 | ERR_SEMAPHORE_ACQUIRE_TIMEOUT | MEDIUM | LOG | Semaphore wait >100ms | Producer blocked |
| 83 | ERR_QUEUE_FULL | LOW | LOG | Message queue capacity hit | Reduce message rate |
| 84 | ERR_QUEUE_EMPTY | LOW | IGNORE | Dequeue from empty queue | Normal condition |
| 85 | ERR_RINGBUFFER_OVERRUN | MEDIUM | FALLBACK | Buffer overwritten | Data loss; increase size |
| 86 | ERR_RINGBUFFER_UNDERRUN | MEDIUM | FALLBACK | Read when empty | Wait for buffering |
| 87 | ERR_TASK_CREATION_FAILED | CRITICAL | REBOOT | Task alloc fails | Out of memory |
| 88 | ERR_ISR_NESTING_LIMIT | CRITICAL | LOG | ISR nesting >4 levels deep | Reduce ISR complexity |
| 89 | ERR_CRITICAL_SECTION_TIMEOUT | MEDIUM | LOG | Critical section >50ms | Lock contention detected |

---

### 10. Resource/Memory (90-99)

Memory allocation, stack/heap exhaustion, PSRAM, DMA.

| Code | Name | Severity | Recovery | Trigger | Free Memory Check |
|------|------|----------|----------|---------|-------------------|
| 90 | ERR_MALLOC_FAILED | CRITICAL | FALLBACK | malloc() returns NULL | <20KB heap free |
| 91 | ERR_STACK_OVERFLOW | CRITICAL | REBOOT | Stack guard violated | Task stack >95% full |
| 92 | ERR_HEAP_EXHAUSTED | CRITICAL | REBOOT | Heap allocation fails repeatedly | <5KB heap free |
| 93 | ERR_PSRAM_INIT_FAILED | HIGH | LOG | PSRAM driver init fails | Check hardware |
| 94 | ERR_DMA_BUFFER_ALLOC_FAILED | CRITICAL | LOG | DMA alloc fails | Insufficient DMA pool |
| 95 | ERR_RESOURCE_NOT_AVAILABLE | MEDIUM | FALLBACK | System resource unavailable | Wait and retry |
| 96 | ERR_INTERRUPT_ALLOC_FAILED | CRITICAL | LOG | Cannot allocate ISR handler | All interrupts in use |
| 97 | ERR_SEMAPHORE_ALLOC_FAILED | CRITICAL | REBOOT | Semaphore creation fails | Heap exhausted |
| 98 | ERR_QUEUE_ALLOC_FAILED | CRITICAL | REBOOT | Queue creation fails | Heap exhausted |
| 99 | ERR_TASK_ALLOC_FAILED | CRITICAL | REBOOT | Task structure alloc fails | Heap exhausted |

**Heap Monitoring:**
```cpp
// Boot: log free heap
uint32_t free_heap = esp_get_free_heap_size();
if (free_heap < 20 * 1024) {
    report_warning(ERR_MALLOC_FAILED, "Boot heap only %u KB", free_heap / 1024);
}
```

---

### 11. Audio Processing (100-109)

Beat detection, FFT, tempo, chromagram, novelty, silence detection.

| Code | Name | Severity | Recovery | Trigger | Subsystem |
|------|------|----------|----------|---------|-----------|
| 100 | ERR_AUDIO_DFT_CONFIG_FAILED | HIGH | LOG | Goertzel init fails | Frequency validation |
| 101 | ERR_AUDIO_WINDOW_INIT_FAILED | HIGH | LOG | Window function init fails | Hann/Hamming config |
| 102 | ERR_AUDIO_VU_METER_FAILED | MEDIUM | LOG | VU calculation error | NaN/Inf in signal |
| 103 | ERR_TEMPO_DETECTION_FAILED | MEDIUM | LOG | Tempo algorithm error | No clear tempo |
| 104 | ERR_CHROMAGRAM_CALC_FAILED | MEDIUM | LOG | Chromagram computation fails | Invalid pitch data |
| 105 | ERR_BEAT_DETECTION_FAILED | MEDIUM | LOG | Beat detection error | Algorithm divergence |
| 106 | ERR_NOVELTY_CALC_FAILED | LOW | LOG | Novelty metric error | Buffer state invalid |
| 107 | ERR_SILENCE_DETECTION_FAILED | LOW | LOG | Silence threshold eval fails | Threshold out of range |
| 108 | ERR_AUDIO_FEATURE_OVERFLOW | MEDIUM | FALLBACK | Feature value exceeds limits | Clamp to range |
| 109 | ERR_AUDIO_PIPELINE_DESYNC | HIGH | RESET | Frames out of sync | Frame counter mismatch |

**Not yet integrated** (reserved for Task 5+ audio node expansion).

---

### 12. Pattern/Rendering (110-119)

Pattern loading, rendering, palette management, animation state.

| Code | Name | Severity | Recovery | Trigger | Location |
|------|------|----------|----------|---------|----------|
| 110 | ERR_PATTERN_NOT_FOUND | LOW | FALLBACK | Pattern ID out of range | Registry lookup fails |
| 111 | ERR_PATTERN_LOAD_FAILED | MEDIUM | FALLBACK | Pattern init fails | Config error |
| 112 | ERR_PATTERN_RENDER_FAILED | MEDIUM | FALLBACK | Render func throws | Parameter out of range |
| 113 | ERR_PATTERN_INVALID_STATE | MEDIUM | RESET | Pattern state corrupted | Consistency check fails |
| 114 | ERR_PATTERN_MEMORY_EXCEEDED | MEDIUM | LOG | Pattern >available memory | Use simpler pattern |
| 115 | ERR_LED_BUFFER_ALLOC_FAILED | CRITICAL | REBOOT | Frame buffer alloc fails | OOM for LED data |
| 116 | ERR_PALETTE_NOT_FOUND | LOW | FALLBACK | Palette ID missing | Use default palette |
| 117 | ERR_PALETTE_LOAD_FAILED | MEDIUM | FALLBACK | Palette init fails | File corrupted |
| 118 | ERR_EASING_FUNCTION_INVALID | LOW | FALLBACK | Easing type unknown | Use linear fallback |
| 119 | ERR_ANIMATION_STATE_CORRUPTED | MEDIUM | RESET | Animation state bad | Reset animation |

**Integration Points:**
- Pattern registry (future; stateful node implementation in Task 9)
- Render pipeline (visual_scheduler.cpp, pattern_audio_interface.cpp)

---

### 13. Telemetry/Diagnostics (120-129)

Profiling, diagnostics endpoints, heartbeat, metrics aggregation.

| Code | Name | Severity | Recovery | Trigger | Endpoint |
|------|------|----------|----------|---------|----------|
| 120 | ERR_TELEMETRY_BUFFER_FULL | LOW | LOG | Ring buffer full | Increase buffer size |
| 121 | ERR_TELEMETRY_WRITE_FAILED | LOW | LOG | Write fails | Retry write |
| 122 | ERR_PROFILER_INIT_FAILED | LOW | LOG | Profiler init fails | Check config |
| 123 | ERR_HEARTBEAT_MISSED | MEDIUM | LOG | Heartbeat not received | System responsiveness check |
| 124 | ERR_DIAGNOSTICS_DISABLED | LOW | LOG | Diagnostics not enabled | Enable in config |
| 125 | ERR_PROBE_OVERHEAD_EXCEEDED | LOW | LOG | Measurement overhead >1% | Reduce probe frequency |
| 126 | ERR_TIMESTAMP_SYNC_FAILED | MEDIUM | LOG | Time sync fails | Resync with NTP |
| 127 | ERR_METRICS_AGGREGATION_ERROR | LOW | LOG | Metric aggregation fails | Check sources |
| 128 | ERR_DIAG_ENDPOINT_UNAVAILABLE | LOW | LOG | Diag REST endpoint missing | Enable diagnostics |
| 129 | ERR_LOG_ROTATION_FAILED | LOW | LOG | Log file rotation fails | Check storage space |

**Integration:**
- `/api/device/performance` (FPS, render times)
- `/api/diag` (system health snapshot)
- `/api/rmt` (refill count, max gap µs)

---

### 14. Reserved/Graph Nodes (130-255)

Future subsystems, custom protocols, graph node errors.

**Allocation Strategy:**
- **130-149:** Graph execution errors (future Task 5+)
- **150-169:** Node type-specific errors (Task 6+)
- **170-189:** Communication protocol errors
- **190-209:** Persistence layer errors
- **210-255:** Custom/vendor extensions

**Naming Convention for Future Codes:**
```
ERR_GRAPH_<type>_<specific>
ERR_NODE_<name>_<failure>
ERR_PROTO_<protocol>_<error>
```

---

## Industry Standards Analysis

### ESP-IDF Error Code Patterns

**ESP-IDF Standard (esp_err_t):**
- Hex format: `0xXX##NNNN`
  - `XX` = module (I2S=0x04, RMT=0x0C, WiFi=0x01)
  - `##` = error number
  - `NNNN` = reserved
- Common codes: `ESP_ERR_TIMEOUT`, `ESP_ERR_NO_MEM`, `ESP_ERR_INVALID_ARG`

**K1.node1 Approach (Selected):**
- Decimal format: `0-255` (fits in `uint8_t`)
- Organized by subsystem with 10-code blocks
- Human-readable with hierarchical taxonomy
- Compatible with REST APIs (JSON/HTTP status codes)
- Easier to log and transmit over serial/WiFi

**Trade-off Analysis:**

| Aspect | ESP-IDF (Hex) | K1 (Decimal) | Decision |
|--------|---------------|-------------|----------|
| Density | High (16-bit range) | Medium (8-bit) | K1: sufficient for 130 codes |
| Readability | Lower (0x80004002) | Higher (24) | K1: operational clarity |
| REST Integration | Awkward | Native (HTTP 4xx codes) | K1: better API contract |
| Extensibility | 65K codes | 256 codes | K1: sufficient with 130 allocated |
| Industry Alignment | Native ESP32 | Pragmatic | Hybrid: K1 codes + esp_err_t mapping |

**Recommendation:** Use K1 decimal codes for application layer; map ESP-IDF errors at driver boundaries.

---

### Embedded Systems Standards (ISO/IEC, MISRA)

**ISO 26262 (Automotive Functional Safety):**
- Error codes categorized by **severity** (ASIL A-D)
- Recovery actions tied to FMEA (Failure Modes & Effects Analysis)
- Traceability from hardware failure to user notification

**K1 Alignment:**
- `ErrorSeverity` enum (INFO, LOW, MEDIUM, HIGH, CRITICAL) ✓
- `ErrorRecoveryAction` enum (IGNORE, LOG, RETRY, FALLBACK, RESET, REBOOT) ✓
- Metadata structure supports traceability ✓

**MISRA C Compliance:**
- Avoid uninitialized variables in error paths ✓
- Explicit return values for error codes ✓
- Bounds checking on array access ✓

---

### REST API Error Standards (RFC 7231, HTTP Status Codes)

**HTTP Status Codes → K1 Error Codes Mapping:**

| HTTP | Meaning | K1 Error Range | Example |
|------|---------|----------------|---------|
| 400 | Bad Request | 40-49 (WebServer) | ERR_JSON_PARSE_FAILED (47) |
| 401 | Unauthorized | 50-59 (Config) | ERR_ENV_VAR_MISSING (59) |
| 404 | Not Found | 50-69 (Config/Storage) | ERR_PARAM_NOT_FOUND (51) |
| 429 | Too Many Requests | - | Rate limiting (non-error) |
| 500 | Internal Server Error | 0-129 (all subsystems) | Varies by cause |
| 503 | Service Unavailable | 80-99 (Resource) | ERR_MALLOC_FAILED (90) |

**REST Response Format:**
```json
{
  "error": {
    "code": 47,
    "name": "ERR_JSON_PARSE_FAILED",
    "message": "JSON parsing failed",
    "severity": "MEDIUM",
    "recovery_action": "LOG",
    "cause": "Invalid JSON syntax or format",
    "remediation": "Verify JSON syntax and format",
    "timestamp": "2025-11-10T14:32:45Z",
    "trace_id": "req_uuid_here"
  }
}
```

---

## Registry Structure & Organization

### Header File Organization

**File:** `firmware/src/error_codes.h`

```cpp
#pragma once

#include <stdint.h>
#include <stddef.h>

// ============================================================================
// SEVERITY & RECOVERY ENUMS
// ============================================================================
typedef enum { ERR_SEV_INFO, ERR_SEV_LOW, ... } ErrorSeverity;
typedef enum { ERR_ACTION_IGNORE, ERR_ACTION_LOG, ... } ErrorRecoveryAction;

// ============================================================================
// ERROR CODE DEFINITIONS (organized by subsystem)
// ============================================================================
// Syntax: #define ERR_<SUBSYSTEM>_<SPECIFIC> <code>

// Core System (0-9)
#define ERR_OK                          0
#define ERR_UNKNOWN                     1
// ... etc

// ============================================================================
// METADATA STRUCTURE & LOOKUP
// ============================================================================
typedef struct {
    uint8_t code;
    const char* name;
    const char* description;
    ErrorSeverity severity;
    ErrorRecoveryAction recovery;
    const char* cause;
    const char* remediation;
} ErrorMetadata;

extern const ErrorMetadata g_error_metadata[];
extern const uint16_t g_error_metadata_count;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
const ErrorMetadata* error_lookup(uint8_t error_code);
const char* error_severity_to_string(ErrorSeverity severity);
const char* error_action_to_string(ErrorRecoveryAction action);
int error_to_json(uint8_t error_code, char* buffer, size_t buffer_size);
```

### Implementation File

**File:** `firmware/src/error_codes.cpp`

```cpp
#include "error_codes.h"
#include <string.h>
#include <stdio.h>

// ============================================================================
// ERROR METADATA REGISTRY (130 entries)
// ============================================================================
const ErrorMetadata g_error_metadata[] = {
    // System/Core Errors (0-9)
    {0, "ERR_OK", "Operation successful", ERR_SEV_INFO, ERR_ACTION_IGNORE,
     "No error", "N/A"},

    {1, "ERR_UNKNOWN", "Unknown error occurred", ERR_SEV_HIGH, ERR_ACTION_LOG,
     "Unexpected state or unhandled exception", "Enable debug logging and retry"},

    // ... 128 more entries ...

    {129, "ERR_LOG_ROTATION_FAILED", "Log rotation failed", ERR_SEV_LOW,
     ERR_ACTION_LOG, "Failed to rotate log files", "Check storage space"},
};

const uint16_t g_error_metadata_count = sizeof(g_error_metadata) /
                                        sizeof(ErrorMetadata);

// Lookup and utility functions
const ErrorMetadata* error_lookup(uint8_t error_code) {
    for (uint16_t i = 0; i < g_error_metadata_count; i++) {
        if (g_error_metadata[i].code == error_code) {
            return &g_error_metadata[i];
        }
    }
    return NULL;
}
```

### Subsystem-Specific Headers

**Pattern:** One header per major subsystem includes local error codes.

**Example: `firmware/src/audio/microphone.h`**
```cpp
#pragma once

#include "../error_codes.h"

typedef struct {
    // ... audio state ...
    uint8_t last_error_code;  // Track most recent error
    uint32_t error_count;      // Cumulative errors
} AudioState;

// Local error handling
inline void audio_report_error(uint8_t error_code) {
    // Log with error metadata
    const ErrorMetadata* meta = error_lookup(error_code);
    if (meta) {
        LOG_ERROR(TAG_AUDIO, "ERR_%d: %s (recovery: %s)",
                  meta->code, meta->description,
                  error_action_to_string(meta->recovery));
    }
}
```

---

## Integration Points

### 1. Logging System

**File:** `firmware/src/logging/logger.h`

```cpp
// Bind error codes to logging
#define LOG_ERROR_CODE(tag, error_code, fmt, ...) \
    do { \
        const ErrorMetadata* meta = error_lookup(error_code); \
        LOG_ERROR(tag, "[%s] " fmt, meta->name, ##__VA_ARGS__); \
    } while(0)

// Example:
// LOG_ERROR_CODE(TAG_I2S, ERR_I2S_READ_TIMEOUT, "samples lost: %d", count);
// Output: "[ERR_I2S_READ_TIMEOUT] samples lost: 42"
```

### 2. REST API Response Builder

**File:** `firmware/src/webserver_response_builders.h`

```cpp
// Create error response with full metadata
AsyncWebServerResponse* create_error_response_with_metadata(
    AsyncWebServerRequest* request,
    int http_status,
    uint8_t error_code) {

    char json_buf[512];
    error_to_json(error_code, json_buf, sizeof(json_buf));

    auto* resp = request->beginResponse(http_status, "application/json", json_buf);
    attach_cors_headers(resp);
    return resp;
}

// Usage in handler:
// ctx.sendError(400, "ERR_JSON_PARSE_FAILED", error_code);
```

### 3. Telemetry Endpoint

**File:** `firmware/src/webserver.cpp` (new endpoint)

```cpp
// GET /api/errors/recent - Last N errors with metadata
void GetRecentErrorsHandler() {
    // Query error history ring buffer
    StaticJsonDocument<2048> doc;
    doc["total_errors"] = g_error_count;

    JsonArray recent = doc.createNestedArray("recent");
    for (int i = 0; i < 10 && i < g_error_history_count; i++) {
        uint8_t code = g_error_history[i].code;
        const ErrorMetadata* meta = error_lookup(code);

        JsonObject err = recent.createNestedObject();
        err["code"] = code;
        err["name"] = meta->name;
        err["severity"] = error_severity_to_string(meta->severity);
        err["timestamp"] = g_error_history[i].timestamp_ms;
    }

    String json;
    serializeJson(doc, json);
    ctx.sendJson(200, json);
}
```

### 4. Heartbeat Telemetry

**File:** `firmware/src/profiling.h` (future)

```cpp
// Heartbeat includes error status
struct HeartbeatSnapshot {
    uint32_t uptime_ms;
    uint8_t fps;
    uint32_t last_error_code;      // Most recent error
    uint32_t error_count_1min;      // Errors in last minute
    uint8_t heap_percent_used;
    uint8_t audio_buffer_percent;
};

// Sent periodically to `/api/heartbeat` for monitoring
```

---

## Logging & Telemetry

### Error Logging Pattern

**Severity Mapping to Log Levels:**

```cpp
ErrorSeverity -> LOG_LEVEL:
ERR_SEV_INFO      -> LOG_INFO
ERR_SEV_LOW       -> LOG_WARN
ERR_SEV_MEDIUM    -> LOG_ERROR (but recoverable)
ERR_SEV_HIGH      -> LOG_ERROR
ERR_SEV_CRITICAL  -> LOG_ERROR + immediate action
```

**Example Log Output:**
```
[I2S] ERR_24 ERR_I2S_READ_TIMEOUT: Microphone not providing samples
      Recovery: FALLBACK | Action: Use silence/interpolate
      Timestamp: 2025-11-10 14:32:45.123 | Heap: 156KB
```

### Error History Ring Buffer

**Structure:** Keep last 100 errors in memory.

```cpp
typedef struct {
    uint8_t error_code;
    uint32_t timestamp_ms;
    const char* subsystem;  // "I2S", "RMT", "WIFI", etc.
} ErrorRecord;

#define ERROR_HISTORY_SIZE 100
static ErrorRecord g_error_history[ERROR_HISTORY_SIZE];
static uint16_t g_error_history_index = 0;
static uint32_t g_error_count = 0;

void record_error(uint8_t error_code) {
    g_error_history[g_error_history_index % ERROR_HISTORY_SIZE] = {
        error_code,
        millis(),
        /* subsystem from context */
    };
    g_error_history_index++;
    g_error_count++;
}
```

### Telemetry Endpoints

| Endpoint | Method | Return | Update Freq |
|----------|--------|--------|-------------|
| `/api/errors/recent` | GET | Last 10 errors + metadata | On-demand |
| `/api/device/health` | GET | Error count (1min/1hr/total) | 1s |
| `/api/device/performance` | GET | FPS, render time, heap, errors | 1s |
| `/api/rmt` | GET | Refill count, max gap µs, errors | 100ms |

---

## Adding New Error Codes

### Step-by-Step Procedure

#### 1. Identify Subsystem & Range

- [ ] Determine subsystem (Core, WiFi, Audio, LED, etc.)
- [ ] Check available codes in range (e.g., 20-29 for I2S)
- [ ] Reserve next available code number

**Example:** Adding audio DFT error → Range 100-109 → Next available: 100

#### 2. Define Error Code

**File:** `firmware/src/error_codes.h`

```cpp
// Audio Processing Errors (100-109)
// ... existing codes ...
#define ERR_AUDIO_DFT_CONFIG_FAILED    100  // Goertzel DFT initialization failed
```

**Naming Convention:** `ERR_<SUBSYSTEM>_<SPECIFIC>`
- SUBSYSTEM: I2S, RMT, WIFI, etc. (max 12 chars)
- SPECIFIC: brief failure reason (max 20 chars)
- Total: <40 chars for consistency

#### 3. Add Metadata Entry

**File:** `firmware/src/error_codes.cpp`

```cpp
{100, "ERR_AUDIO_DFT_CONFIG_FAILED",
 "Goertzel DFT initialization failed",
 ERR_SEV_HIGH,                    // Severity (decision: can't do beat detection)
 ERR_ACTION_LOG,                  // Recovery (log but continue with fallback)
 "Frequency config out of range or invalid sample rate",
 "Verify sample rate matches DFT target frequency; check config"},
```

**Metadata Requirements:**
- `code` (uint8_t): Unique 0-255
- `name` (const char*): Matches #define
- `description` (const char*): User-friendly <60 chars
- `severity` (ErrorSeverity): INFO, LOW, MEDIUM, HIGH, CRITICAL
- `recovery` (ErrorRecoveryAction): IGNORE, LOG, RETRY, FALLBACK, RESET, REBOOT
- `cause` (const char*): Root cause (for diagnostics)
- `remediation` (const char*): User action (for support)

#### 4. Identify Detection Point

**Where will this error be triggered?**

```cpp
// Example: In audio/dft.cpp
if (target_freq < 20 || target_freq > 20000) {
    return ERR_AUDIO_DFT_CONFIG_FAILED;  // Invalid frequency range
}
```

#### 5. Add Error Handling

**File:** Subsystem-specific header or implementation

```cpp
// In audio/dft.h
inline void dft_report_error(uint8_t error_code) {
    const ErrorMetadata* meta = error_lookup(error_code);
    LOG_ERROR_CODE(TAG_AUDIO, error_code, "DFT config issue");

    // Take recovery action
    if (meta->recovery == ERR_ACTION_FALLBACK) {
        use_default_dft_config();
    } else if (meta->recovery == ERR_ACTION_RESET) {
        reset_dft_processor();
    }
}
```

#### 6. Test & Document

```cpp
// Test case: dft_test.cpp
void test_dft_config_invalid_frequency() {
    uint8_t result = dft_init(5);  // 5 Hz → below 20 Hz minimum
    ASSERT_EQUAL(result, ERR_AUDIO_DFT_CONFIG_FAILED);

    // Verify metadata lookup works
    const ErrorMetadata* meta = error_lookup(ERR_AUDIO_DFT_CONFIG_FAILED);
    ASSERT_NOT_NULL(meta);
    ASSERT_EQUAL(meta->severity, ERR_SEV_HIGH);
}
```

#### 7. Update Documentation

- [ ] Add error code to this spec (section 11)
- [ ] Add entry point/location comment
- [ ] Update ADR if architectural change
- [ ] Update related README.md

---

## Operational Procedures

### Monitoring Error Rates

**Dashboard Query (Hypothetical InfluxDB):**
```sql
SELECT error_code, COUNT(*) FROM errors
WHERE timestamp > NOW() - 1h
GROUP BY error_code
ORDER BY COUNT(*) DESC
LIMIT 10;
```

**Alert Thresholds:**
- **Critical (ERR_SEV_CRITICAL):** Immediate notification
- **High (ERR_SEV_HIGH) > 10/hour:** Alert engineering
- **Medium (ERR_SEV_MEDIUM) > 50/hour:** Log for review
- **Low/Info:** Aggregate daily

### Troubleshooting via Error Codes

**Example Scenario:**
```
User reports: "LEDs not lighting up"
Device telemetry shows: ERR_RMT_TRANSMIT_TIMEOUT (35) × 5 times in last 30s

Diagnostic Steps:
1. Check LED power supply (common cause)
2. Verify dual-channel sync timing (ERR_RMT_DUAL_CHANNEL_SYNC_FAIL)
3. Check GPIO pin assignments (physical connection)
4. Enable RMT telemetry: /api/rmt → check refill gaps
5. If gap >10µs: sync error in led_driver.h
6. If gap <10µs: may be LED strip issue (open circuit)

Recovery Actions:
- ERR_RMT_TRANSMIT_TIMEOUT → RESET: restart LED output task
- ERR_RMT_DUAL_CHANNEL_SYNC_FAIL → FALLBACK: disable second channel
```

### Error Code Maintenance

**Quarterly Review:**
- [ ] Check for stale/unused error codes
- [ ] Review error frequency trends (from telemetry)
- [ ] Consolidate duplicate codes if found
- [ ] Prepare ADR for new subsystem ranges (130-255)

**Annual Audit:**
- [ ] Validate all 130 metadata entries
- [ ] Cross-reference with ESP-IDF error codes (if interfacing)
- [ ] Update severity/recovery actions based on production data
- [ ] Plan backward compatibility if restructuring

---

## Examples & Reference

### Example 1: WiFi Connection Error Handling

**Scenario:** Device fails to connect to WiFi.

**Current Code (firmware/src/wifi_monitor.cpp):**
```cpp
void on_wifi_status_change() {
    wl_status_t status = WiFi.status();
    switch (status) {
        case WL_CONNECT_FAILED:
            connection_logf("ERROR", "Failed to connect to SSID '%s'", stored_ssid);
            schedule_reconnect("Failed to connect", WIFI_RECONNECT_INTERVAL_MS);
            break;
        // ... other cases
    }
}
```

**Enhanced with Error Codes:**
```cpp
void on_wifi_status_change() {
    wl_status_t status = WiFi.status();
    uint8_t error_code = ERR_OK;

    switch (status) {
        case WL_CONNECT_FAILED:
            // Distinguish auth vs. timeout vs. SSID not found
            if (last_connect_attempt_ms > 30000) {
                error_code = ERR_WIFI_CONNECT_TIMEOUT;
            } else if (/* password mismatch detected */) {
                error_code = ERR_WIFI_AUTH_FAILED;
            } else {
                error_code = ERR_WIFI_CONNECT_FAILED;  // Generic
            }

            LOG_ERROR_CODE(TAG_WIFI, error_code, "WiFi connection failed");
            record_error(error_code);  // Add to error history

            // Use recovery action from metadata
            const ErrorMetadata* meta = error_lookup(error_code);
            if (meta->recovery == ERR_ACTION_RETRY) {
                schedule_reconnect(..., WIFI_RECONNECT_INTERVAL_MS);
            } else if (meta->recovery == ERR_ACTION_LOG) {
                // Enter provisioning mode if configured
                if (allow_provisioning) {
                    start_ap_fallback();
                }
            }
            break;
    }
}
```

### Example 2: REST API Error Response

**Request:** `POST /api/pattern/select` with invalid JSON

**Response (with error metadata):**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json
X-Error-Code: 47

{
  "error": {
    "code": 47,
    "name": "ERR_JSON_PARSE_FAILED",
    "message": "JSON parsing failed",
    "severity": "MEDIUM",
    "recovery_action": "LOG",
    "cause": "Invalid JSON syntax or format",
    "remediation": "Verify JSON syntax and format",
    "timestamp": "2025-11-10T14:32:45.123Z",
    "request_id": "req_abc123def456"
  }
}
```

**Client handling:**
```typescript
// In webapp/src/services/api.ts
async postPattern(patternId: number) {
    const response = await fetch(`/api/pattern/select`, {
        method: 'POST',
        body: JSON.stringify({ id: patternId })
    });

    if (!response.ok) {
        const error = await response.json();

        // Use error code for specific handling
        if (error.error.code === 47) {  // ERR_JSON_PARSE_FAILED
            console.error("Malformed request sent", error.error.cause);
            // Show user-friendly message
        } else if (error.error.code === 50) {  // ERR_PARAM_INVALID
            console.error("Pattern ID out of range", error.error.remediation);
        }

        throw new ApiError(error.error);
    }
}
```

### Example 3: Heartbeat with Error Context

**GET `/api/heartbeat` Response:**
```json
{
  "uptime_ms": 123456789,
  "fps": 60,
  "timestamp": "2025-11-10T14:32:45.123Z",
  "system": {
    "heap_free_kb": 156,
    "heap_used_pct": 28,
    "uptime_hours": 34.3
  },
  "audio": {
    "active": true,
    "sample_rate": 16000,
    "buffer_usage_pct": 75,
    "last_error_code": 0,
    "error_count_1min": 0
  },
  "led": {
    "active": true,
    "pattern": "beat_reactive",
    "brightness": 200,
    "last_error_code": 0,
    "error_count_1min": 0,
    "rmt_refill_count": 12345,
    "rmt_max_gap_us": 8
  },
  "network": {
    "wifi_connected": true,
    "ssid": "Home-WiFi",
    "signal_strength": -45,
    "last_error_code": 0,
    "error_count_1min": 0
  },
  "errors": {
    "total_count": 3,
    "critical_count": 0,
    "high_count": 0,
    "recent": [
      {
        "code": 25,
        "name": "ERR_I2S_READ_OVERRUN",
        "timestamp": "2025-11-10T14:30:12.456Z",
        "subsystem": "I2S"
      }
    ]
  }
}
```

### Example 4: Telemetry for Long-Term Monitoring

**POST `/api/telemetry/error-report` (Bulk):**
```json
{
  "device_id": "k1-node1-001",
  "report_period": {
    "start": "2025-11-10T00:00:00Z",
    "end": "2025-11-10T23:59:59Z"
  },
  "error_summary": {
    "total": 42,
    "by_severity": {
      "CRITICAL": 0,
      "HIGH": 3,
      "MEDIUM": 12,
      "LOW": 25,
      "INFO": 2
    },
    "by_subsystem": {
      "I2S": 8,
      "RMT": 5,
      "WiFi": 12,
      "WebServer": 8,
      "Other": 9
    }
  },
  "top_errors": [
    {
      "code": 15,
      "name": "ERR_WIFI_LINK_LOST",
      "count": 8,
      "first_occurrence": "2025-11-10T01:23:45Z",
      "last_occurrence": "2025-11-10T19:11:22Z"
    },
    {
      "code": 25,
      "name": "ERR_I2S_READ_OVERRUN",
      "count": 7,
      "avg_interval_hours": 2.4
    }
  ]
}
```

---

## Migration & Rollout

### Phase 1: Validation (1 week)

**Goals:**
- Verify error_codes.h/cpp compile and link correctly
- Validate error metadata (no NULL pointers, valid ranges)
- Test error_lookup() and utility functions

**Tasks:**
```cpp
// Add unit tests: firmware/test/test_error_codes.cpp
TEST_CASE("error_lookup returns valid metadata for all 130 codes", "") {
    for (int code = 0; code < 130; code++) {
        const ErrorMetadata* meta = error_lookup(code);
        TEST_ASSERT_NOT_NULL(meta);
        TEST_ASSERT_EQUAL(meta->code, code);
        TEST_ASSERT_NOT_NULL(meta->name);
        TEST_ASSERT_NOT_NULL(meta->description);
    }
}

TEST_CASE("error_to_json produces valid JSON for sample codes", "") {
    char buf[512];
    int len = error_to_json(ERR_I2S_READ_TIMEOUT, buf, sizeof(buf));
    TEST_ASSERT_GREATER_THAN(0, len);
    TEST_ASSERT(strstr(buf, "ERR_I2S_READ_TIMEOUT") != NULL);
    TEST_ASSERT(strstr(buf, "\"HIGH\"") != NULL);  // Severity
}
```

### Phase 2: Integration (2 weeks)

**Goals:**
- Integrate error codes into existing subsystems
- Add error reporting to critical paths
- Implement error history ring buffer

**Subsystem Order:**
1. WiFi (highest frequency of errors)
2. I2S/Audio (time-sensitive)
3. RMT/LED (dual-channel critical)
4. WebServer (API contracts)

**Example WiFi Integration:**
```cpp
// wifi_monitor.cpp: Replace string-based errors with codes
void on_wifi_status_change() {
    // ... existing code ...

    // OLD: connection_logf("ERROR", "WiFi connection lost");
    // NEW:
    if (status == WL_DISCONNECTED) {
        record_error(ERR_WIFI_LINK_LOST);
        LOG_ERROR_CODE(TAG_WIFI, ERR_WIFI_LINK_LOST, "Reconnecting...");
    }
}
```

### Phase 3: REST API Integration (2 weeks)

**Goals:**
- Add error metadata to REST responses
- Create `/api/errors/recent` endpoint
- Integrate with existing heartbeat telemetry

**Endpoints:**
```cpp
// webserver.cpp: new handler
void GetRecentErrorsHandler() { /* ... */ }
void GetErrorSummaryHandler() { /* ... */ }

// Update existing:
// /api/device/info → add recent_error_code
// /api/device/performance → add error_count_1min
```

### Phase 4: Testing & Validation (1 week)

**Goals:**
- Verify error reporting in all subsystems
- Validate telemetry endpoints
- Performance: ensure <1% overhead

**Test Scenarios:**
1. WiFi disconnect → ERR_WIFI_LINK_LOST logged and reported
2. Audio timeout → ERR_I2S_READ_TIMEOUT triggered, fallback active
3. LED sync fail → ERR_RMT_DUAL_CHANNEL_SYNC_FAIL, secondary channel disabled
4. JSON parse error → ERR_JSON_PARSE_FAILED, 400 response with metadata
5. Heap exhaustion → ERR_MALLOC_FAILED, device reboots gracefully

### Phase 5: Documentation & Rollout (1 week)

**Deliverables:**
- [ ] Error code registry reference (this document)
- [ ] Integration guide for developers
- [ ] Operator runbook (troubleshooting guide)
- [ ] Firmware release notes with error code summary
- [ ] Migration checklist for existing error handling

**Go/No-Go Criteria:**
- [ ] All 130 error codes defined and tested
- [ ] Error reporting in ≥90% of critical paths
- [ ] REST endpoints responding with metadata
- [ ] Zero new compiler warnings
- [ ] <1% measurement overhead on telemetry
- [ ] Documentation complete and reviewed

---

## Appendix: Quick Reference

### Error Code Lookup Table

| Code Range | Subsystem | Count | Status |
|-----------|-----------|-------|--------|
| 0-9 | Core System | 10 | COMPLETE |
| 10-19 | WiFi/Network | 10 | COMPLETE |
| 20-29 | I2S/Audio | 10 | COMPLETE |
| 30-39 | RMT/LED | 10 | COMPLETE |
| 40-49 | WebServer/HTTP | 10 | COMPLETE |
| 50-59 | Parameter/Config | 10 | COMPLETE |
| 60-69 | Storage/SPIFFS | 10 | COMPLETE |
| 70-79 | OTA/Firmware | 10 | COMPLETE |
| 80-89 | Synchronization | 10 | COMPLETE |
| 90-99 | Resource/Memory | 10 | COMPLETE |
| 100-109 | Audio Processing | 10 | RESERVED |
| 110-119 | Pattern/Rendering | 10 | RESERVED |
| 120-129 | Telemetry/Diagnostics | 10 | COMPLETE |
| 130-255 | Reserved/Graph | 126 | RESERVED |

### Common Recovery Actions

| Action | When to Use | Example |
|--------|------------|---------|
| IGNORE | Error is informational, no action needed | ERR_QUEUE_EMPTY |
| LOG | Log but continue; user aware | ERR_PARAM_INVALID |
| RETRY | Automatic retry with backoff | ERR_WIFI_CONNECT_TIMEOUT |
| FALLBACK | Use safe default behavior | ERR_PATTERN_NOT_FOUND → use default pattern |
| RESET | Restart subsystem component | ERR_AUDIO_PROCESSING_STALLED → restart audio task |
| REBOOT | Last resort; reboot entire device | ERR_HEAP_EXHAUSTED |

### Severity to Action Mapping

| Severity | Criteria | Response |
|----------|----------|----------|
| INFO | Operational milestone | Log only |
| LOW | Degraded feature, fallback available | Log + telemetry |
| MEDIUM | Significant impact, recovery possible | Log + telemetry + user notification |
| HIGH | Critical functionality affected | Immediate action (retry/reset) |
| CRITICAL | System instability risk | Emergency action (reboot) |

### ESP-IDF Error Code Mapping (Reference)

For driver-level errors, maintain mapping:

```cpp
// How to convert ESP-IDF errors to K1 codes at boundaries
esp_err_t err = i2s_new_channel(...);
if (err == ESP_ERR_INVALID_ARG) {
    record_error(ERR_I2S_CONFIG_INVALID);
} else if (err == ESP_ERR_NO_MEM) {
    record_error(ERR_I2S_DMA_ALLOC_FAILED);
} else if (err == ESP_OK) {
    record_error(ERR_OK);
} else {
    record_error(ERR_UNKNOWN);  // Fallback
}
```

---

## Document Metadata

| Field | Value |
|-------|-------|
| Specification Version | 1.0 |
| Last Updated | 2025-11-10 |
| Maintainer | Task 4 - Error Management |
| Related Files | `/firmware/src/error_codes.h`, `/firmware/src/error_codes.cpp` |
| Supersedes | None |
| Superseded By | (none yet) |
| Review Status | Proposed |
| Implementation Start | Phase 5.2 (Task 4) |
| Expected Completion | Phase 5.2 + 5 weeks |

---

## Next Steps

1. **Code Review:** Review error code definitions, taxonomy, and recovery actions
2. **Integration Planning:** Map error codes to existing code paths (WiFi → RMT)
3. **Test Plan Creation:** Define unit tests for error handling and telemetry
4. **Documentation:** Update ADRs and developer guides with error code patterns
5. **Rollout:** Execute phased migration (Phase 1-5 above)

---

**Document End**

This specification is a living document. Updates will be tracked in ADRs under `/docs/02-adr/`.

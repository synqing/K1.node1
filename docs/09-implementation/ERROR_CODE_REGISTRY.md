# K1.node1 Error Code Registry

**Status:** Implemented (Phase 0)
**Date:** November 10, 2025
**Task:** Task 4 — Comprehensive Error Code Registry
**Files:**
- `firmware/src/error_codes.h` — Header with definitions
- `firmware/src/error_codes.cpp` — Implementation with metadata

---

## Overview

A centralized error code system (0-255) for the K1.node1 firmware that enables:
- **Consistent error handling** across all subsystems
- **Recoverable vs unrecoverable** error classification
- **Telemetry/diagnostics** via REST APIs and WebSockets
- **Multi-language error messages** (cause, remediation, action)
- **Zero ambiguity** in error reporting

---

## Design Principles

### 1. Unique Error Codes (0-255)

Each error condition has a unique uint8_t code. Range allocations:

| Range | Subsystem | Count |
|-------|-----------|-------|
| 0-9 | System/Core | 10 |
| 10-19 | WiFi/Network | 10 |
| 20-29 | I2S/Audio | 10 |
| 30-39 | RMT/LED | 10 |
| 40-49 | WebServer | 10 |
| 50-59 | Parameters/Config | 10 |
| 60-69 | Storage/SPIFFS | 10 |
| 70-79 | OTA/Firmware | 10 |
| 80-89 | Synchronization | 10 |
| 90-99 | Memory/Resources | 10 |
| 100-109 | Audio Processing | 10 |
| 110-119 | Patterns/Rendering | 10 |
| 120-129 | Telemetry/Diagnostics | 10 |
| 130-255 | Reserved/Future | 126 |

**Total:** 130 defined error codes, 126 reserved

### 2. Metadata per Error

Each error includes:

```cpp
typedef struct {
    uint8_t code;                    // Unique identifier
    const char* name;                // "ERR_SUBSYSTEM_CONDITION"
    const char* description;         // Human-readable brief
    ErrorSeverity severity;          // INFO/LOW/MEDIUM/HIGH/CRITICAL
    ErrorRecoveryAction recovery;    // IGNORE/LOG/RETRY/FALLBACK/RESET/REBOOT
    const char* cause;               // Common root cause
    const char* remediation;         // How to fix
} ErrorMetadata;
```

### 3. Severity Levels

| Level | Value | Meaning |
|-------|-------|---------|
| **INFO** | 0 | Informational - normal operation |
| **LOW** | 1 | Low priority - degraded service |
| **MEDIUM** | 2 | Significant impact |
| **HIGH** | 3 | Critical functionality affected |
| **CRITICAL** | 4 | System may become unstable |

### 4. Recovery Actions

| Action | Value | When Used |
|--------|-------|-----------|
| **IGNORE** | 0 | No action needed, continue normally |
| **LOG** | 1 | Log but continue (with degradation) |
| **RETRY** | 2 | Retry operation (with backoff) |
| **FALLBACK** | 3 | Use default/fallback behavior |
| **RESET** | 4 | Reset subsystem and retry |
| **REBOOT** | 5 | Last resort - reboot device |

---

## Error Code Listing (Summary)

### System/Core (0-9)
- **ERR_OK (0)** — Operation successful
- **ERR_UNKNOWN (1)** — Unexpected state (HIGH, LOG)
- **ERR_GENERIC (2)** — Insufficient context
- **ERR_NOT_IMPLEMENTED (3)** — Feature stub
- **ERR_INVALID_STATE (4)** — Incompatible system state
- **ERR_TIMEOUT (5)** — Operation exceeded time limit (MEDIUM, RETRY)
- **ERR_HARDWARE_FAULT (6)** — Hardware communication failed (CRITICAL)
- **ERR_FIRMWARE_MISMATCH (7)** — Version incompatibility
- **ERR_BUILD_SIGNATURE_INVALID (8)** — Toolchain mismatch
- **ERR_SYSTEM_BUSY (9)** — Processing capacity exceeded

### WiFi/Network (10-19)
- **ERR_WIFI_NO_CREDENTIALS (10)** — WIFI_SSID/PASSWORD not in .env
- **ERR_WIFI_SSID_NOT_FOUND (11)** — Network not broadcasting (MEDIUM, RETRY)
- **ERR_WIFI_AUTH_FAILED (12)** — Wrong password (HIGH, LOG)
- **ERR_WIFI_CONNECT_TIMEOUT (13)** — Connection attempt timed out (MEDIUM, RETRY)
- **ERR_WIFI_PROVISIONING_TIMEOUT (14)** — BLE/AP provisioning timed out
- **ERR_WIFI_LINK_LOST (15)** — Unexpected disconnection (MEDIUM, RETRY)
- **ERR_NETWORK_UNAVAILABLE (16)** — No connectivity (MEDIUM, FALLBACK)
- **ERR_DNS_RESOLUTION_FAILED (17)** — Cannot resolve hostname
- **ERR_DHCP_FAILED (18)** — DHCP lease acquisition failed (HIGH, RETRY)
- **ERR_STATIC_IP_CONFIG_INVALID (19)** — Bad static IP config

### I2S/Audio (20-29)
- **ERR_I2S_INIT_FAILED (20)** — Driver init failed (CRITICAL, RESET)
- **ERR_I2S_CONFIG_INVALID (21)** — Sample rate/channels invalid (CRITICAL)
- **ERR_I2S_DMA_ALLOC_FAILED (22)** — DMA buffer allocation failed (CRITICAL, REBOOT)
- **ERR_I2S_CLOCK_CONFIG_FAILED (23)** — MCLK config failed (CRITICAL)
- **ERR_I2S_READ_TIMEOUT (24)** — Microphone not providing samples (HIGH, FALLBACK)
- **ERR_I2S_READ_OVERRUN (25)** — Samples lost to buffer overflow (MEDIUM, FALLBACK)
- **ERR_I2S_PIN_CONFIG_FAILED (26)** — GPIO pin mapping failed (CRITICAL)
- **ERR_MICROPHONE_INIT_FAILED (27)** — SPH0645 init failed (CRITICAL)
- **ERR_AUDIO_BUFFER_EXHAUSTED (28)** — Ring buffer full (MEDIUM, FALLBACK)
- **ERR_AUDIO_PROCESSING_STALLED (29)** — Audio task not responding (HIGH, RESET)

### RMT/LED (30-39)
- **ERR_RMT_INIT_FAILED (30)** — RMT driver init (CRITICAL, RESET)
- **ERR_RMT_CONFIG_INVALID (31)** — Config incompatible (CRITICAL)
- **ERR_RMT_ALLOCATE_FAILED (32)** — Channel allocation (CRITICAL)
- **ERR_RMT_DMA_ALLOC_FAILED (33)** — DMA allocation (CRITICAL, REBOOT)
- **ERR_RMT_ENCODER_CONFIG_FAILED (34)** — LED encoder init (CRITICAL)
- **ERR_RMT_TRANSMIT_TIMEOUT (35)** — LED transmission stalled (HIGH, RESET)
- **ERR_RMT_DUAL_CHANNEL_SYNC_FAIL (36)** — Sync failed (HIGH, FALLBACK)
- **ERR_RMT_MEMORY_BLOCK_EXHAUSTED (37)** — Insufficient blocks (HIGH)
- **ERR_LED_DATA_INVALID (38)** — Frame data corrupted (MEDIUM, FALLBACK)
- **ERR_LED_OUTPUT_STALLED (39)** — Transmission loop stalled (MEDIUM, RESET)

### WebServer (40-49)
- **ERR_WEBSERVER_INIT_FAILED (40)** — ESPAsyncWebServer init (HIGH)
- **ERR_WEBSERVER_PORT_IN_USE (41)** — Port 80/443 busy (HIGH)
- **ERR_WEBSERVER_HANDLER_ERROR (42)** — Handler exception (MEDIUM)
- **ERR_HTTP_REQUEST_INVALID (43)** — Malformed request (LOW, IGNORE)
- **ERR_HTTP_BODY_TOO_LARGE (44)** — Body exceeds limit (LOW, IGNORE)
- **ERR_HTTP_HEADER_OVERFLOW (45)** — Too many headers (LOW, IGNORE)
- **ERR_HTTP_QUERY_PARAM_OVERFLOW (46)** — Too many params (LOW, IGNORE)
- **ERR_JSON_PARSE_FAILED (47)** — Invalid JSON (MEDIUM)
- **ERR_JSON_BUFFER_OVERFLOW (48)** — Document too large (MEDIUM, IGNORE)
- **ERR_WEBSOCKET_CONNECTION_LOST (49)** — Client disconnected (LOW)

### Parameters/Config (50-59)
- **ERR_PARAM_INVALID (50)** — Out of range (LOW)
- **ERR_PARAM_NOT_FOUND (51)** — Not in registry (LOW)
- **ERR_PARAM_READ_FAILED (52)** — Read from storage failed (MEDIUM, FALLBACK)
- **ERR_PARAM_WRITE_FAILED (53)** — Write to storage failed (MEDIUM, RETRY)
- **ERR_PARAM_LOCK_CONTENTION (54)** — Lock timeout (MEDIUM, RETRY)
- **ERR_CONFIG_LOAD_FAILED (55)** — Config file missing (HIGH, FALLBACK)
- **ERR_CONFIG_SAVE_FAILED (56)** — Save failed (MEDIUM, RETRY)
- **ERR_CONFIG_CORRUPTION_DETECTED (57)** — Integrity check failed (HIGH, FALLBACK)
- **ERR_CONFIG_VERSION_MISMATCH (58)** — Incompatible version (HIGH)
- **ERR_ENV_VAR_MISSING (59)** — Required env var not set (HIGH)

### Storage/SPIFFS (60-69)
- **ERR_SPIFFS_MOUNT_FAILED (60)** — Mount failed (HIGH, RESET)
- **ERR_SPIFFS_FORMAT_FAILED (61)** — Format failed (CRITICAL)
- **ERR_SPIFFS_FILE_NOT_FOUND (62)** — File missing (LOW, FALLBACK)
- **ERR_SPIFFS_FILE_WRITE_FAILED (63)** — Write failed (MEDIUM)
- **ERR_SPIFFS_FILE_READ_FAILED (64)** — Read failed (MEDIUM, RETRY)
- **ERR_SPIFFS_STORAGE_FULL (65)** — No space (HIGH)
- **ERR_SPIFFS_CORRUPTION (66)** — FS corrupted (HIGH, RESET)
- **ERR_NVS_INIT_FAILED (67)** — NVS init (CRITICAL)
- **ERR_NVS_READ_FAILED (68)** — NVS read (MEDIUM, FALLBACK)
- **ERR_NVS_WRITE_FAILED (69)** — NVS write (MEDIUM, RETRY)

### OTA/Firmware (70-79)
- **ERR_OTA_NOT_AVAILABLE (70)** — OTA disabled (LOW)
- **ERR_OTA_INIT_FAILED (71)** — Init failed (HIGH)
- **ERR_OTA_BEGIN_FAILED (72)** — Begin failed (HIGH)
- **ERR_OTA_RECEIVE_FAILED (73)** — Data reception failed (HIGH, RETRY)
- **ERR_OTA_WRITE_FAILED (74)** — Flash write failed (CRITICAL)
- **ERR_OTA_END_FAILED (75)** — Finalization failed (CRITICAL)
- **ERR_OTA_AUTH_FAILED (76)** — Password mismatch (HIGH)
- **ERR_OTA_TIMEOUT (77)** — Timed out (MEDIUM, RETRY)
- **ERR_OTA_VERSION_DOWNGRADE (78)** — Downgrade blocked (HIGH)
- **ERR_OTA_COMPATIBILITY_CHECK (79)** — Incompatible (HIGH)

### Synchronization (80-89)
- **ERR_MUTEX_ACQUIRE_TIMEOUT (80)** — Lock contention (MEDIUM)
- **ERR_SPINLOCK_ACQUIRE_TIMEOUT (81)** — Spinlock contention (MEDIUM)
- **ERR_SEMAPHORE_ACQUIRE_TIMEOUT (82)** — Semaphore timeout (MEDIUM)
- **ERR_QUEUE_FULL (83)** — Queue overflow (LOW)
- **ERR_QUEUE_EMPTY (84)** — Queue underflow (LOW, IGNORE)
- **ERR_RINGBUFFER_OVERRUN (85)** — Data overwritten (MEDIUM, FALLBACK)
- **ERR_RINGBUFFER_UNDERRUN (86)** — No data (MEDIUM, FALLBACK)
- **ERR_TASK_CREATION_FAILED (87)** — Task alloc failed (CRITICAL, REBOOT)
- **ERR_ISR_NESTING_LIMIT (88)** — Too many ISRs (CRITICAL)
- **ERR_CRITICAL_SECTION_TIMEOUT (89)** — Lock exceeded (MEDIUM)

### Memory/Resources (90-99)
- **ERR_MALLOC_FAILED (90)** — Memory alloc failed (CRITICAL, FALLBACK)
- **ERR_STACK_OVERFLOW (91)** — Task stack exceeded (CRITICAL, REBOOT)
- **ERR_HEAP_EXHAUSTED (92)** — All memory consumed (CRITICAL, REBOOT)
- **ERR_PSRAM_INIT_FAILED (93)** — PSRAM init failed (HIGH)
- **ERR_DMA_BUFFER_ALLOC_FAILED (94)** — DMA alloc failed (CRITICAL)
- **ERR_RESOURCE_NOT_AVAILABLE (95)** — Resource locked (MEDIUM, FALLBACK)
- **ERR_INTERRUPT_ALLOC_FAILED (96)** — ISR alloc (CRITICAL)
- **ERR_SEMAPHORE_ALLOC_FAILED (97)** — Semaphore alloc (CRITICAL, REBOOT)
- **ERR_QUEUE_ALLOC_FAILED (98)** — Queue alloc (CRITICAL, REBOOT)
- **ERR_TASK_ALLOC_FAILED (99)** — Task alloc (CRITICAL, REBOOT)

### Audio Processing (100-109)
- **ERR_AUDIO_DFT_CONFIG_FAILED (100)** — Goertzel init (HIGH)
- **ERR_AUDIO_WINDOW_INIT_FAILED (101)** — Window init (HIGH)
- **ERR_AUDIO_VU_METER_FAILED (102)** — VU calculation (MEDIUM)
- **ERR_TEMPO_DETECTION_FAILED (103)** — Tempo algorithm (MEDIUM)
- **ERR_CHROMAGRAM_CALC_FAILED (104)** — Chromagram calc (MEDIUM)
- **ERR_BEAT_DETECTION_FAILED (105)** — Beat algorithm (MEDIUM)
- **ERR_NOVELTY_CALC_FAILED (106)** — Novelty metric (LOW)
- **ERR_SILENCE_DETECTION_FAILED (107)** — Silence threshold (LOW)
- **ERR_AUDIO_FEATURE_OVERFLOW (108)** — Value overflow (MEDIUM, FALLBACK)
- **ERR_AUDIO_PIPELINE_DESYNC (109)** — Frames out of sync (HIGH, RESET)

### Patterns/Rendering (110-119)
- **ERR_PATTERN_NOT_FOUND (110)** — Index out of range (LOW, FALLBACK)
- **ERR_PATTERN_LOAD_FAILED (111)** — Init failed (MEDIUM, FALLBACK)
- **ERR_PATTERN_RENDER_FAILED (112)** — Rendering failed (MEDIUM, FALLBACK)
- **ERR_PATTERN_INVALID_STATE (113)** — State corrupted (MEDIUM, RESET)
- **ERR_PATTERN_MEMORY_EXCEEDED (114)** — Memory limits (MEDIUM)
- **ERR_LED_BUFFER_ALLOC_FAILED (115)** — Frame buffer alloc (CRITICAL, REBOOT)
- **ERR_PALETTE_NOT_FOUND (116)** — Palette missing (LOW, FALLBACK)
- **ERR_PALETTE_LOAD_FAILED (117)** — Init failed (MEDIUM, FALLBACK)
- **ERR_EASING_FUNCTION_INVALID (118)** — Unsupported (LOW, FALLBACK)
- **ERR_ANIMATION_STATE_CORRUPTED (119)** — State invalid (MEDIUM, RESET)

### Telemetry/Diagnostics (120-129)
- **ERR_TELEMETRY_BUFFER_FULL (120)** — Buffer overflow (LOW)
- **ERR_TELEMETRY_WRITE_FAILED (121)** — Write failed (LOW)
- **ERR_PROFILER_INIT_FAILED (122)** — Init failed (LOW)
- **ERR_HEARTBEAT_MISSED (123)** — Not received (MEDIUM)
- **ERR_DIAGNOSTICS_DISABLED (124)** — Not enabled (LOW)
- **ERR_PROBE_OVERHEAD_EXCEEDED (125)** — Overhead high (LOW)
- **ERR_TIMESTAMP_SYNC_FAILED (126)** — Sync failed (MEDIUM)
- **ERR_METRICS_AGGREGATION_ERROR (127)** — Aggregation failed (LOW)
- **ERR_DIAG_ENDPOINT_UNAVAILABLE (128)** — Endpoint not available (LOW)
- **ERR_LOG_ROTATION_FAILED (129)** — Rotation failed (LOW)

---

## Usage Examples

### In C++ Code

```cpp
#include "error_codes.h"

// Check error
if (i2s_init() != ESP_OK) {
    LOG_ERROR("I2S init failed");
    // Report error
    return ERR_I2S_INIT_FAILED;
}

// Look up metadata
const ErrorMetadata* meta = error_lookup(ERR_I2S_READ_TIMEOUT);
if (meta) {
    LOG_ERROR("Error: %s - Cause: %s", meta->description, meta->cause);
}

// Format for REST response
char json_buffer[512];
error_to_json(ERR_WIFI_AUTH_FAILED, json_buffer, sizeof(json_buffer));
// Returns: {"error_code":12,"name":"ERR_WIFI_AUTH_FAILED",...}
```

### In REST API

**GET** `/api/device/info`

Response:
```json
{
    "device": "k1-reinvented",
    "status": "error",
    "error_code": 12,
    "error": {
        "code": 12,
        "name": "ERR_WIFI_AUTH_FAILED",
        "message": "WiFi authentication failed",
        "severity": "HIGH",
        "recovery_action": "LOG",
        "cause": "Wrong password or security mismatch",
        "remediation": "Verify WiFi password matches network config"
    }
}
```

### In WebSocket Diagnostics

```json
{
    "type": "error",
    "timestamp": 1699651200000,
    "error_code": 24,
    "error_name": "ERR_I2S_READ_TIMEOUT",
    "subsystem": "audio",
    "severity": "HIGH",
    "recommended_action": "FALLBACK"
}
```

---

## Telemetry Integration

### REST Endpoints Using Error Codes

- **GET** `/api/device/info` — System status with error code
- **GET** `/api/device/performance` — Performance metrics with error indicators
- **GET** `/api/device/audio` — Audio subsystem status with error codes
- **GET** `/api/device/leds` — LED subsystem status with error codes
- **GET** `/api/errors/recent` — Recent error history (last 100)
- **GET** `/api/errors/summary` — Error statistics

### Heartbeat Telemetry

Every 5 seconds, `/api/device/heartbeat` includes:

```json
{
    "uptime_ms": 45000,
    "fps": 102,
    "cpu_usage": 52.3,
    "heap_free": 127892,
    "last_error_code": 0,
    "error_count": 0
}
```

---

## Migration Strategy

### Phase 0 (Now)
- ✓ Error codes defined and registered
- ✓ Metadata lookup implemented
- ✓ JSON serialization ready

### Phase 1
- [ ] Audit all error throws and map to codes
- [ ] Update all logging to include error codes
- [ ] Update all REST responses with error codes

### Phase 2
- [ ] WebSocket diagnostics include error codes
- [ ] Telemetry aggregation by error code
- [ ] Error trending/analytics

---

## Validation Checklist

- [x] All 130 error codes unique (0-129)
- [x] Metadata complete for all errors
- [x] Ranges allocated by subsystem
- [x] Severity levels appropriate
- [x] Recovery actions sensible
- [x] Causes and remediations detailed
- [x] Lookup functions implemented
- [x] JSON serialization working
- [x] String conversion functions ready
- [x] Code compiles without warnings

---

## Related Documents

- **CLAUDE.md** § Error Handling Patterns — Design principles
- **SECURITY_HARDENING_ENV_VARS.md** — Error codes related to configuration
- **docs/06-reference/** — REST API specification (to be updated)
- **docs/09-implementation/** — Operational runbooks

---

**Next Step:** Integrate error codes into I2S Audio Timeout Protection (Task 2) and WebServer Bounds Checking (Task 3).

# Error Code Quick Reference

**Version:** 1.0
**Date:** 2025-11-10
**Purpose:** Fast lookup for development and troubleshooting

---

## Error Code Ranges

| Range | Subsystem | Examples |
|-------|-----------|----------|
| 0-9 | Core System | ERR_OK (0), ERR_TIMEOUT (5), ERR_UNKNOWN (1) |
| 10-19 | WiFi/Network | ERR_WIFI_NO_CREDENTIALS (10), ERR_WIFI_LINK_LOST (15) |
| 20-29 | I2S/Audio | ERR_I2S_READ_TIMEOUT (24), ERR_MICROPHONE_INIT_FAILED (27) |
| 30-39 | RMT/LED | ERR_RMT_INIT_FAILED (30), ERR_RMT_TRANSMIT_TIMEOUT (35) |
| 40-49 | WebServer/HTTP | ERR_WEBSERVER_INIT_FAILED (40), ERR_JSON_PARSE_FAILED (47) |
| 50-59 | Parameter/Config | ERR_PARAM_INVALID (50), ERR_CONFIG_LOAD_FAILED (55) |
| 60-69 | Storage/SPIFFS | ERR_SPIFFS_MOUNT_FAILED (60), ERR_NVS_WRITE_FAILED (69) |
| 70-79 | OTA/Firmware | ERR_OTA_INIT_FAILED (71), ERR_OTA_WRITE_FAILED (74) |
| 80-89 | Synchronization | ERR_MUTEX_ACQUIRE_TIMEOUT (80), ERR_QUEUE_FULL (83) |
| 90-99 | Resource/Memory | ERR_MALLOC_FAILED (90), ERR_HEAP_EXHAUSTED (92) |
| 100-109 | Audio Processing | ERR_AUDIO_DFT_CONFIG_FAILED (100), ERR_BEAT_DETECTION_FAILED (105) |
| 110-119 | Pattern/Rendering | ERR_PATTERN_NOT_FOUND (110), ERR_PALETTE_LOAD_FAILED (117) |
| 120-129 | Telemetry | ERR_TELEMETRY_BUFFER_FULL (120), ERR_HEARTBEAT_MISSED (123) |
| 130-255 | Reserved/Graph | Future use |

---

## Critical Errors (Immediate Action)

| Code | Name | Action | Contact |
|------|------|--------|---------|
| 6 | ERR_HARDWARE_FAULT | Check hardware connections, power | Hardware team |
| 8 | ERR_BUILD_SIGNATURE_INVALID | Clean rebuild with correct toolchain | Build engineer |
| 22 | ERR_I2S_DMA_ALLOC_FAILED | Reboot device | Firmware team |
| 30 | ERR_RMT_INIT_FAILED | Reset RMT driver, check IDF version | LED driver team |
| 33 | ERR_RMT_DMA_ALLOC_FAILED | Reduce LED count or reboot | LED team |
| 74 | ERR_OTA_WRITE_FAILED | Check flash health, no downgrade | OTA team |
| 87 | ERR_TASK_CREATION_FAILED | Reboot device | OS team |
| 90 | ERR_MALLOC_FAILED | Memory exhaustion; reboot | Memory team |
| 91 | ERR_STACK_OVERFLOW | Task stack too small; reboot | Task team |
| 92 | ERR_HEAP_EXHAUSTED | Memory leak; reboot | Memory team |

---

## Common User-Facing Errors

| Code | User Sees | Remediation |
|------|-----------|-------------|
| 10 | Device won't connect | Add WiFi SSID/password to .env |
| 11 | WiFi network not found | Check SSID spelling, move closer to router |
| 12 | WiFi wrong password | Verify WiFi password is correct |
| 13 | Connection times out | Move closer to router, check signal |
| 15 | WiFi disconnected | Check network stability, reconnect |
| 24 | Audio stopped working | Check microphone connection and power |
| 35 | LEDs not lighting | Check LED power supply, connections |
| 47 | API error | Check JSON format in request |
| 50 | Value out of range | Use valid value for parameter |

---

## Recovery Actions Reference

| Action | Meaning | Auto? | Retry? |
|--------|---------|-------|--------|
| IGNORE | No action needed | Yes | No |
| LOG | Log and continue degraded | Yes | No |
| RETRY | Retry with backoff | Yes | Yes, bounded |
| FALLBACK | Use safe default | Yes | No |
| RESET | Restart subsystem | Yes | No |
| REBOOT | Restart entire device | Yes | No |

---

## Severity Levels

| Level | Priority | Response |
|-------|----------|----------|
| INFO (0) | Informational | Log only |
| LOW (1) | Low priority | Log + telemetry |
| MEDIUM (2) | Significant impact | Log + retry/fallback |
| HIGH (3) | Critical functionality | Log + immediate action |
| CRITICAL (4) | System instability | Log + reboot/reset |

---

## API Response Format

All REST endpoints return errors in this format:

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
    "timestamp": "2025-11-10T14:32:45.123Z"
  }
}
```

HTTP Status → Error Code Mapping:
- 400 Bad Request → ERR_JSON_PARSE_FAILED (47), ERR_HTTP_BODY_TOO_LARGE (44)
- 404 Not Found → ERR_PARAM_NOT_FOUND (51)
- 413 Payload Too Large → ERR_HTTP_BODY_TOO_LARGE (44)
- 429 Too Many Requests → Rate limited (no error code)
- 500 Internal Server Error → Any subsystem error
- 503 Service Unavailable → ERR_MALLOC_FAILED (90), ERR_SYSTEM_BUSY (9)

---

## Telemetry Endpoints

| Endpoint | Method | Returns | Update |
|----------|--------|---------|--------|
| `/api/errors/recent` | GET | Last 10-20 errors with metadata | On-demand |
| `/api/errors/summary` | GET | Error count (time window) | On-demand |
| `/api/device/health` | GET | System health + recent errors | 1s |
| `/api/device/performance` | GET | FPS, render time, error count | 1s |
| `/api/heartbeat` | GET | Full status snapshot | 1s |

---

## Debugging Tips

### WiFi Won't Connect (ERR_10, 11, 12, 13)

```bash
# Check logs for WiFi status
# In device logs, look for: [WiFi] ERR_10 ...

# Remediation:
1. Verify WIFI_SSID in firmware/.env
2. Verify WIFI_PASSWORD correct
3. Try 2.4 GHz network (5 GHz may have issues)
4. Check signal strength: move closer to router
5. Restart WiFi router
```

### Audio Not Working (ERR_20-29)

```bash
# Check I2S status: /api/device/audio-status
# Look for last_error_code in response

# Remediation by error:
24 → ERR_I2S_READ_TIMEOUT: Check microphone power, connections
27 → ERR_MICROPHONE_INIT_FAILED: I2S pins incorrect, check hardware
25 → ERR_I2S_READ_OVERRUN: Audio load too high, increase buffer

# Restart audio:
# POST /api/audio/restart
```

### LEDs Not Lighting (ERR_30-39)

```bash
# Check RMT status: /api/rmt
# Look for: last_error_code, max_channel_spacing_us

# Remediation by error:
30 → ERR_RMT_INIT_FAILED: Check RMT driver, IDF version
35 → ERR_RMT_TRANSMIT_TIMEOUT: LED power supply issue
36 → ERR_RMT_DUAL_CHANNEL_SYNC_FAIL: GPIO timing; disable channel 2

# Restart LEDs:
# POST /api/led/restart
```

### JSON API Errors (ERR_40-49)

```bash
# Error 47: ERR_JSON_PARSE_FAILED
# Check: is your JSON valid?
# Example bad:
{"pattern_id": 5,}  # <-- trailing comma (invalid)

# Example good:
{"pattern_id": 5}

# Validate at: https://jsonlint.com/
```

### Device Out of Memory (ERR_90, 91, 92)

```bash
# Check heap: /api/device/info → heap_free_kb

# Remediation:
- Reboot device (clears all heaps)
- Reduce number of LEDs
- Reduce audio buffer size
- Disable unused patterns

# Prevent:
- Avoid memory leaks in patterns
- Use PSRAM for large buffers
- Monitor heap usage in heartbeat
```

---

## Integration Code Snippets

### Log with Error Metadata (C++)

```cpp
#include "error_codes.h"

uint8_t error_code = ERR_I2S_READ_TIMEOUT;
const ErrorMetadata* meta = error_lookup(error_code);

LOG_ERROR(TAG_I2S, "[%s] %s (recovery: %s)",
          meta->name,
          meta->description,
          error_action_to_string(meta->recovery));
```

### Handle Error in REST (TypeScript)

```typescript
const response = await fetch('/api/pattern/select', {
    method: 'POST',
    body: JSON.stringify({ id: 5 })
});

if (!response.ok) {
    const { error } = await response.json();
    console.error(`Error ${error.code}: ${error.name}`);
    console.error(`Cause: ${error.cause}`);
    console.error(`Action: ${error.remediation}`);
}
```

### Record Error (C++)

```cpp
#include "error_codes.h"
#include "error_tracking.h"

// Record for telemetry
record_error(ERR_WIFI_LINK_LOST);
g_error_history.record(ERR_WIFI_LINK_LOST, "WiFi");

// Later, query: GET /api/errors/recent
```

---

## Tools & Resources

### JSON Validator
https://jsonlint.com/

### Device Telemetry Dashboard
- Local: `http://device.local/dashboard` (future)
- Cloud: Coming soon

### Error Code Search
grep in: `/firmware/src/error_codes.h`

### Offline Reference
This file: `/docs/06-reference/ERROR_CODE_QUICK_REFERENCE.md`

---

## Common Error Sequences

### Scenario: WiFi Keeps Disconnecting

```
Timeline:
  T+0s   : ERR_15 ERR_WIFI_LINK_LOST (recovery: RETRY)
  T+5s   : Attempting reconnect...
  T+8s   : ERR_13 ERR_WIFI_CONNECT_TIMEOUT (recovery: RETRY)
  T+15s  : ERR_17 ERR_DNS_RESOLUTION_FAILED (recovery: RETRY)
  T+20s  : ERR_12 ERR_WIFI_AUTH_FAILED (recovery: LOG)

Diagnosis: WiFi dropping → reconnect fails → auth failure
Root Cause: Router rebooted? WiFi password changed?

Action: Restart device, re-enter WiFi credentials
```

### Scenario: Audio Glitching

```
Timeline:
  T+100s: ERR_25 ERR_I2S_READ_OVERRUN (recovery: FALLBACK) × 5 times
  T+110s: Audio brief silence (using fallback)
  T+120s: Audio resumes

Diagnosis: DMA buffer overflow; samples lost
Root Cause: Microphone data arrival too fast for processing

Action: Increase I2S_DMA_BUFFER_SIZE or reduce other CPU load
```

### Scenario: Device Stability Issues

```
Timeline:
  T+1m   : ERR_9 ERR_SYSTEM_BUSY (recovery: LOG)
  T+5m   : ERR_90 ERR_MALLOC_FAILED (recovery: FALLBACK)
  T+6m   : ERR_92 ERR_HEAP_EXHAUSTED (recovery: REBOOT)
  T+7m   : Device reboots (watchdog triggered)

Diagnosis: Memory leak → heap exhaustion → auto-reboot
Root Cause: Pattern or task not freeing memory

Action: Check recent code changes; enable heap profiling
```

---

## Contact & Escalation

| Issue | Team | Contact |
|-------|------|---------|
| WiFi errors (10-19) | Network team | network@k1.dev |
| Audio errors (20-29) | Audio team | audio@k1.dev |
| LED errors (30-39) | LED team | leds@k1.dev |
| API errors (40-49) | Web team | api@k1.dev |
| Memory errors (90-99) | Firmware team | firmware@k1.dev |
| Critical errors | On-call | emergency@k1.dev |

---

**Last Updated:** 2025-11-10
**Maintained By:** Task 4 - Error Management
**Review Frequency:** Quarterly

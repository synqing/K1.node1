# Error Code System - Quick Start Guide

**For Developers:** Fast reference for using the K1.node1 error code system in firmware.

---

## In 30 Seconds

The error code system provides structured error reporting for all K1.node1 subsystems:

```cpp
#include "error_codes.h"

// Report an error
error_report(ErrorCode::WiFi_AssociationTimeout, "Failed to connect to MyNetwork");

// Get error info
const char* desc = error_code_description(ErrorCode::WiFi_AssociationTimeout);
// Output: "WiFi association timeout (SSID not responding)"
```

---

## Common Error Codes by Subsystem

### WiFi

```cpp
error_report(ErrorCode::WiFi_ConnectionLost);           // Lost connection
error_report(ErrorCode::WiFi_AuthenticationFailed);     // Wrong password
error_report(ErrorCode::WiFi_AssociationTimeout);       // Can't find SSID
error_report(ErrorCode::WiFi_DHCP_Timeout);             // No IP address
```

### I2S/Audio

```cpp
error_report(ErrorCode::I2S_InitFailed);                // Setup failed
error_report(ErrorCode::I2S_ReadTimeout);               // No samples from mic
error_report(ErrorCode::I2S_BufferOverflow);            // Samples dropped
```

### WebServer

```cpp
error_report(ErrorCode::WebServer_BindFailed);          // Port in use
error_report(ErrorCode::WebServer_RequestQueueFull);    // Too many clients
error_report(ErrorCode::WebServer_ParameterValidationFailed);
```

### LED/RMT

```cpp
error_report(ErrorCode::LED_TransmitFailed);            // Signal not sent
error_report(ErrorCode::LED_RMT_MemoryFull);            // Buffer full
error_report(ErrorCode::LED_EncoderInitFailed);         // Init failed
```

### Pattern

```cpp
error_report(ErrorCode::Pattern_LoadFailed);            // Can't load pattern
error_report(ErrorCode::Pattern_RenderTimeout);         // Too slow
error_report(ErrorCode::Pattern_AudioSyncLost);         // Audio input lost
```

### Memory

```cpp
error_report(ErrorCode::Memory_AllocationFailed);       // malloc failed
error_report(ErrorCode::Memory_StackOverflow);          // Stack overflow
error_report(ErrorCode::Memory_CorruptionDetected);     // Heap corrupted
```

### Hardware

```cpp
error_report(ErrorCode::Hardware_CPUOverload);          // CPU > 90%
error_report(ErrorCode::Hardware_WatchdogTimeout);      // Reboot coming
error_report(ErrorCode::Hardware_PowerVoltageError);    // Power problem
```

---

## API Reference

### Report Errors

```cpp
// Simple: no context message
error_report(ErrorCode::WiFi_ConnectionLost);

// With context message
error_report(ErrorCode::I2S_ReadTimeout, "Microphone offline");

// With formatted message (like printf)
error_reportf(ErrorCode::LED_TransmitFailed, "Channel %d failed, errno %d", ch, err);
```

### Query Error Information

```cpp
// Get human-readable description
const char* desc = error_code_description(code);

// Get severity (Info, Warning, Error, Critical)
ErrorSeverity sev = error_code_severity(code);

// Get recovery suggestion
const char* hint = error_code_recovery_suggestion(code);

// Get category name (WiFi, I2S, LED, etc.)
const char* cat = error_code_category(code);
```

### Get Statistics

```cpp
// Total error count
uint32_t total = error_get_report_count();

// Count for specific error
uint32_t count = error_get_code_count(ErrorCode::WiFi_ConnectionLost);

// Get full statistics
ErrorStatistics stats;
error_get_statistics(stats);
Serial.printf("Critical: %u, Errors: %u, Warnings: %u\n",
    stats.critical_errors,
    stats.error_errors,
    stats.warning_errors);

// Clear statistics
error_clear_statistics();
```

### Telemetry

```cpp
// Format error as JSON for transmission
const char* json = error_format_for_telemetry(code, millis());
// {"code":"0x1002","severity":2,"category":"WiFi","desc":"WiFi association timeout","ts":12345}

// Check if error should be reported to telemetry
if (error_should_report_to_telemetry(ErrorCode::Hardware_WatchdogTimeout)) {
    transmit_to_server(json);
}
```

---

## Severity Levels

| Level | Use For | Action |
|-------|---------|--------|
| **Info** | Status messages | Monitor |
| **Warning** | Potential issues | Log if repeated |
| **Error** | Significant failures | Always log to telemetry |
| **Critical** | System threats | Escalate immediately |

---

## Integration Examples

### WiFi Manager

```cpp
// In wifi_monitor_loop()
if (wifi_lost) {
    error_report(ErrorCode::WiFi_ConnectionLost, "Beacon timeout");
    wifi_monitor_reassociate_now("Connection lost");
}
```

### I2S Driver

```cpp
// In i2s_read_task()
if (!dma_transfer_successful()) {
    error_reportf(ErrorCode::I2S_ReadTimeout, "Timeout after %u ms", wait_time);
    reset_i2s();
}
```

### LED Driver

```cpp
// In led_transmit()
if (rmt_transmit_failed(channel)) {
    error_reportf(ErrorCode::LED_TransmitFailed, "Ch=%d status=0x%x", channel, status);
    // Retry or failover
}
```

### Pattern Rendering

```cpp
// In pattern_render()
if (render_time_ms > frame_budget_ms) {
    error_reportf(ErrorCode::Pattern_RenderTimeout, "Took %u ms, budget %u ms",
        render_time_ms, frame_budget_ms);
}
```

---

## Testing & Debugging

### Check Error Statistics

```cpp
void print_error_stats() {
    ErrorStatistics stats;
    error_get_statistics(stats);

    Serial.printf("\n=== Error Statistics ===\n");
    Serial.printf("Total:    %u\n", stats.total_errors);
    Serial.printf("Critical: %u\n", stats.critical_errors);
    Serial.printf("Errors:   %u\n", stats.error_errors);
    Serial.printf("Warnings: %u\n", stats.warning_errors);
    Serial.printf("Info:     %u\n", stats.info_messages);
    Serial.printf("Unique:   %u\n", stats.unique_error_codes);

    if (stats.most_recent_code != ErrorCode::None) {
        Serial.printf("Recent:   0x%04X at %u ms\n",
            (uint16_t)stats.most_recent_code,
            stats.most_recent_timestamp_ms);
    }
}
```

### List Top Errors

```cpp
void print_top_errors() {
    Serial.println("\n=== Top Errors ===");

    struct {
        ErrorCode code;
        uint32_t count;
    } top_errors[10];

    int count = 0;
    for (uint16_t i = 0; i < 256 && count < 10; i++) {
        ErrorCode code = static_cast<ErrorCode>(i << 8 | 0x01);  // Rough sampling
        uint32_t cnt = error_get_code_count(code);
        if (cnt > 0) {
            Serial.printf("  0x%04X: %u times - %s\n",
                (uint16_t)code, cnt, error_code_description(code));
            count++;
        }
    }
}
```

---

## Common Patterns

### Conditional Reporting

```cpp
// Only log if it's a new error type
static ErrorCode last_error = ErrorCode::None;

if (current_error != last_error) {
    error_report(current_error);
    last_error = current_error;
}
```

### Rate-Limited Reporting

```cpp
static uint32_t last_report_ms = 0;

if (error_occurred && (millis() - last_report_ms) > 5000) {  // Max 1 per 5sec
    error_report(ErrorCode::WiFi_WeakSignal, "RSSI < threshold");
    last_report_ms = millis();
}
```

### Error-Triggered Recovery

```cpp
if (!wifi_connected) {
    error_report(ErrorCode::WiFi_ConnectionLost);

    // Attempt recovery based on severity
    ErrorSeverity sev = error_code_severity(ErrorCode::WiFi_ConnectionLost);
    if (sev >= ErrorSeverity::Error) {
        wifi_monitor_reassociate_now("Error recovery");
    }
}
```

---

## Checklist for New Features

When adding error handling to new code:

- [ ] Identify which subsystem (WiFi, I2S, LED, etc.)
- [ ] Find applicable error code in reference (0x1xxx-0xDxxx)
- [ ] Call `error_report()` at failure point
- [ ] Include context message if helpful
- [ ] Test error is logged to Serial
- [ ] Verify statistics increment
- [ ] Check telemetry format if applicable

---

## Key Files

| File | Purpose |
|------|---------|
| `firmware/src/error_codes.h` | Error definitions and API |
| `firmware/src/error_codes.cpp` | Implementation and metadata |
| `docs/06-reference/K1NRef_ERROR_CODES_v1.0_20251110.md` | Complete reference |
| `docs/03-guides/ERROR_CODES_QUICK_START.md` | This file |

---

**Questions?** See the full reference guide or check error code descriptions with `error_code_description()`.

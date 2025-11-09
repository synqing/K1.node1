# K1.node1 Comprehensive Error Code Registry

**Title:** K1.node1 Error Code System Reference
**Owner:** Backend Architecture
**Date:** 2025-11-10
**Status:** Accepted
**Scope:** Complete error code definitions, taxonomy, and telemetry integration
**Related:** `firmware/src/error_codes.h`, `firmware/src/error_codes.cpp`
**Tags:** error-handling, diagnostics, telemetry, firmware

---

## Overview

The K1.node1 Error Code Registry provides a standardized, hierarchical system for reporting, tracking, and diagnosing firmware errors across all major subsystems. This document serves as the authoritative reference for error codes, severity levels, recovery procedures, and telemetry integration.

### Key Features

- **50+ Error Codes**: Comprehensive coverage of WiFi, I2S/Audio, WebServer, LED/RMT, Pattern, Memory, Synchronization, Hardware, Network, Timing, Telemetry, Configuration, and System subsystems
- **Severity Classification**: Info, Warning, Error, and Critical levels for proper alerting and telemetry filtering
- **Recovery Guidance**: Each error code includes specific recovery suggestions and recommended actions
- **Telemetry Integration**: Structured error reporting with JSON formatting and intelligent filtering
- **Thread-Safe Statistics**: Atomic counters for multi-threaded error tracking without locks
- **Hot-Path Friendly**: Minimal overhead logging; designed for performance-critical code

---

## Error Code Taxonomy

Error codes use a hierarchical naming scheme:

```
0xCSSS
 │└─── Category ID (0x1-0xD)
 └──── Specific Error Code (0x001-0xFFF)
```

### Categories

| ID | Category | Range | Count | Subsystems |
|----|----------|-------|-------|-----------|
| 0x1 | WiFi | 0x1001–0x100F | 15 | WiFi connection, credentials, scanning |
| 0x2 | I2S/Audio | 0x2001–0x200C | 12 | Microphone input, DMA, clocking |
| 0x3 | WebServer | 0x3001–0x300D | 13 | HTTP, socket, requests, responses |
| 0x4 | LED/RMT | 0x4001–0x400C | 12 | WS2812, RMT transmission, encoder |
| 0x5 | Pattern | 0x5001–0x500C | 12 | Pattern loading, rendering, audio sync |
| 0x6 | Memory | 0x6001–0x6007 | 7 | Allocation, deallocation, heap |
| 0x7 | Synchronization | 0x7001–0x7006 | 6 | Mutex, deadlock, race conditions |
| 0x8 | Hardware | 0x8001–0x8008 | 8 | CPU, thermal, power, watchdog |
| 0x9 | Network Transport | 0x9001–0x9007 | 7 | UDP, sockets, MTU |
| 0xA | Timing/Beat | 0xA001–0xA006 | 6 | Beat sync, metronome, tempo |
| 0xB | Telemetry | 0xB001–0xB005 | 5 | Recording, transmission, storage |
| 0xC | Configuration | 0xC001–0xC006 | 6 | Load, save, validation |
| 0xD | System | 0xD001–0xD006 | 6 | Init, state, timeouts |
| — | **Total** | — | **113** | — |

---

## Error Severity Levels

Each error is classified by severity for proper alerting and filtering:

| Level | Value | Characteristics | Action |
|-------|-------|-----------------|--------|
| **Info** | 0 | Informational; expected in normal operation | Monitor; no action required |
| **Warning** | 1 | Potential issue; investigation recommended | Log to telemetry if pattern detected |
| **Error** | 2 | Significant failure; recovery initiated | Log to telemetry; alert on repeat |
| **Critical** | 3 | System-threatening failure; immediate action | Always report to telemetry; escalate |

---

## Error Code Reference (Detailed)

### WiFi Subsystem (0x1xxx)

| Code | Name | Severity | Recovery Type | Description | Suggestion |
|------|------|----------|----------------|-------------|-----------|
| 0x1001 | WiFi_InitFailed | CRITICAL | Reset | WiFi initialization failed | Restart device or check WiFi subsystem integrity |
| 0x1002 | WiFi_AssociationTimeout | ERROR | Retry | WiFi association timeout (SSID not responding) | Check SSID is broadcasting, move closer, or try different channel |
| 0x1003 | WiFi_AuthenticationFailed | ERROR | Retry | WiFi authentication failed (wrong password or security mismatch) | Verify password and security type (WPA2/WPA3) |
| 0x1004 | WiFi_ConnectionLost | WARNING | Retry | WiFi connection lost unexpectedly | Reconnecting... check signal strength and router stability |
| 0x1005 | WiFi_DHCP_Timeout | ERROR | Retry | DHCP timeout (no IP address assigned) | Check router DHCP settings or try static IP configuration |
| 0x1006 | WiFi_DNSResolution | WARNING | Retry | DNS resolution failed | Check DNS settings or try alternate DNS server |
| 0x1007 | WiFi_SSIDNotFound | WARNING | Retry | SSID not found in scan results | Verify SSID is spelled correctly and WiFi router is powered on |
| 0x1008 | WiFi_WeakSignal | WARNING | None | WiFi signal strength is weak (RSSI < threshold) | Move device closer to router or reduce interference |
| 0x1009 | WiFi_BeaconTimeout | ERROR | Retry | No WiFi beacon received (AP likely unreachable) | Check router connectivity and WiFi availability |
| 0x100A | WiFi_MaxRetriesExceeded | ERROR | Reset | Maximum WiFi connection retry count exceeded | Check credentials, router logs, or restart router |
| 0x100B | WiFi_CredentialsCooldown | INFO | None | Credentials in cooldown period after repeated failures | Waiting before next connection attempt |
| 0x100C | WiFi_APModeActive | INFO | None | WiFi AP (access point) mode is active | Device is accessible as WiFi hotspot; use web interface to configure station mode |
| 0x100D | WiFi_ScanFailed | WARNING | Retry | WiFi network scan failed | Retry scan or check WiFi module health |
| 0x100E | WiFi_LinkOptionsUpdateFailed | WARNING | Retry | Failed to update WiFi link options | Verify link option parameters and retry |
| 0x100F | WiFi_NVSWriteFailed | ERROR | Reset | Failed to write WiFi settings to NVS (non-volatile storage) | Check NVS space availability or device storage health |

### I2S/Audio Subsystem (0x2xxx)

| Code | Name | Severity | Recovery Type | Description | Suggestion |
|------|------|----------|----------------|-------------|-----------|
| 0x2001 | I2S_InitFailed | CRITICAL | Reset | I2S (audio input) initialization failed | Check microphone hardware and pin configuration; restart device |
| 0x2002 | I2S_ConfigurationError | CRITICAL | Reset | I2S configuration error (invalid parameters) | Verify I2S sample rate, bit width, and channel configuration |
| 0x2003 | I2S_ReadTimeout | ERROR | Retry | I2S read timeout (no audio samples received) | Check microphone connection, power, and I2S bus integrity |
| 0x2004 | I2S_BufferOverflow | ERROR | Retry | I2S DMA buffer overflow (samples dropped) | Increase buffer size or reduce pattern complexity to free CPU |
| 0x2005 | I2S_ClockError | CRITICAL | Reset | I2S clock error or synchronization lost | Check MCLK, BCLK, and LRCK connections; verify pin configuration |
| 0x2006 | I2S_DMA_Error | CRITICAL | Reset | I2S DMA error (data transfer failure) | Check DMA channel allocation and memory availability |
| 0x2007 | I2S_PinConfigError | CRITICAL | Reset | I2S pin configuration error | Verify GPIO pins assigned to I2S (MCLK, BCLK, LRCK, DATA) |
| 0x2008 | I2S_SampleRateError | ERROR | Retry | I2S sample rate unsupported or mismatch | Use standard sample rates (16kHz, 44.1kHz, 48kHz) |
| 0x2009 | I2S_BitWidthError | ERROR | Retry | I2S bit width configuration error | Use supported bit widths (16-bit, 24-bit, 32-bit) |
| 0x200A | I2S_ChannelConfigError | ERROR | Retry | I2S channel configuration error | Verify mono/stereo configuration matches microphone |
| 0x200B | I2S_LossOfSignal | WARNING | Retry | I2S signal loss detected | Check microphone stability and bus connections |
| 0x200C | I2S_DriverNotReady | ERROR | Retry | I2S driver not ready or not initialized | Initialize I2S subsystem before use |

### WebServer Subsystem (0x3xxx)

| Code | Name | Severity | Recovery Type | Description | Suggestion |
|------|------|----------|----------------|-------------|-----------|
| 0x3001 | WebServer_BindFailed | CRITICAL | Reset | WebServer socket bind failed (port may be in use) | Check if another service uses the port; restart device |
| 0x3002 | WebServer_ListenFailed | CRITICAL | Reset | WebServer listen failed | Restart WebServer; check socket and memory state |
| 0x3003 | WebServer_RequestQueueFull | WARNING | None | WebServer request queue is full | Too many concurrent connections; some requests dropped; reduce clients |
| 0x3004 | WebServer_ResponseSendFailed | ERROR | Retry | Failed to send WebServer response | Check socket state and network connectivity |
| 0x3005 | WebServer_ParameterValidationFailed | WARNING | None | WebServer parameter validation failed | Check request parameters match schema; refer to API documentation |
| 0x3006 | WebServer_RateLimitExceeded | INFO | None | WebServer rate limit exceeded (too many requests) | Client is throttled; retry after delay |
| 0x3007 | WebServer_PayloadTooLarge | WARNING | None | Request payload exceeds maximum size | Split request into smaller chunks or reduce data size |
| 0x3008 | WebServer_InvalidJSON | WARNING | None | Invalid JSON in request body | Validate JSON syntax and check for malformed data |
| 0x3009 | WebServer_ResourceNotFound | INFO | None | WebServer resource (endpoint) not found | Check endpoint URL; refer to API documentation |
| 0x300A | WebServer_MethodNotAllowed | INFO | None | HTTP method not allowed for this endpoint | Use correct HTTP method (GET, POST, etc.) |
| 0x300B | WebServer_InternalError | ERROR | Retry | WebServer internal error during request processing | Check logs for details; retry request |
| 0x300C | WebServer_TimeoutOnResponse | WARNING | Retry | WebServer timeout sending response (client disconnected?) | Increase timeout or check client stability |
| 0x300D | WebServer_SocketError | ERROR | Retry | WebServer socket error (connection reset or closed) | Reconnect client; check network health |

### LED/RMT Subsystem (0x4xxx)

| Code | Name | Severity | Recovery Type | Description | Suggestion |
|------|------|----------|----------------|-------------|-----------|
| 0x4001 | LED_TransmitFailed | ERROR | Retry | LED transmission failed (RMT signal not sent) | Check RMT channel configuration and LED pin connection |
| 0x4002 | LED_RMT_ChannelUnavailable | ERROR | Reset | RMT channel unavailable (likely in use by other subsystem) | Check GPIO assignments or stop other RMT users |
| 0x4003 | LED_RMT_MemoryFull | ERROR | Retry | RMT memory buffer full (too many LED symbols) | Reduce LED strip length or simplify pattern |
| 0x4004 | LED_RMT_TimingError | ERROR | Retry | RMT timing error (refill gap exceeded) | Optimize pattern rendering or increase RMT frequency |
| 0x4005 | LED_EncoderInitFailed | CRITICAL | Reset | LED encoder initialization failed | Check WS2812/NeoPixel timing configuration |
| 0x4006 | LED_DataCorruption | ERROR | Retry | LED data corruption detected | Check LED strip connection, termination resistor, and power supply |
| 0x4007 | LED_TransmitTimeout | ERROR | Retry | LED transmission timeout (no completion signal) | Check RMT interrupt or hardware state |
| 0x4008 | LED_BufferAllocationFailed | CRITICAL | Reset | Failed to allocate LED data buffer | Insufficient SRAM; reduce LED count or free memory |
| 0x4009 | LED_DualChannelSyncFailed | ERROR | Retry | Failed to synchronize dual RMT channels | Check RMT channel configuration or reduce update rate |
| 0x400A | LED_HardwareNotReady | ERROR | Retry | LED hardware (RMT/encoder) not ready or not initialized | Initialize LED subsystem before use |
| 0x400B | LED_StripLengthMismatch | WARNING | None | LED strip length configuration mismatch | Update configuration to match physical LED count |
| 0x400C | LED_RefillGapExceeded | WARNING | None | RMT refill gap exceeded (timing precision issue) | Optimize render function or check CPU load |

### Pattern Subsystem (0x5xxx)

| Code | Name | Severity | Recovery Type | Description | Suggestion |
|------|------|----------|----------------|-------------|-----------|
| 0x5001 | Pattern_LoadFailed | ERROR | Retry | Failed to load pattern | Check pattern registry or pattern storage |
| 0x5002 | Pattern_NotFound | WARNING | None | Requested pattern not found | Verify pattern ID or name; check pattern registry |
| 0x5003 | Pattern_InvalidParameters | WARNING | None | Invalid pattern parameters | Check parameter ranges and types |
| 0x5004 | Pattern_RenderTimeout | ERROR | Retry | Pattern render function timeout (exceeded frame time) | Optimize pattern or reduce complexity |
| 0x5005 | Pattern_StackOverflow | CRITICAL | Reset | Pattern rendering caused stack overflow | Reduce local variables or increase stack size |
| 0x5006 | Pattern_MemoryExhausted | CRITICAL | Reset | Pattern rendering exhausted available heap | Reduce pattern complexity or free memory |
| 0x5007 | Pattern_ChannelMismatch | WARNING | None | Channel count mismatch between pattern and output | Configure correct number of channels |
| 0x5008 | Pattern_QuantizationError | WARNING | None | Error during LED color quantization | Check dithering configuration |
| 0x5009 | Pattern_AudioSyncLost | WARNING | Retry | Audio sync lost during reactive pattern playback | Check I2S input or retry pattern |
| 0x500A | Pattern_SnapshotBoundError | WARNING | None | Pattern snapshot bounds error (index out of range) | Check snapshot index within valid range |
| 0x500B | Pattern_InterpolationError | WARNING | None | Error during pattern interpolation between snapshots | Check snapshot data integrity |
| 0x500C | Pattern_PaletteLookupFailed | WARNING | None | Palette color lookup failed | Verify palette configuration |

### Memory/Resource Subsystem (0x6xxx)

| Code | Name | Severity | Recovery Type | Description | Suggestion |
|------|------|----------|----------------|-------------|-----------|
| 0x6001 | Memory_AllocationFailed | ERROR | Reset | Memory allocation failed (malloc/new returned nullptr) | Insufficient free heap memory |
| 0x6002 | Memory_DeallocationError | WARNING | None | Memory deallocation error (double-free or invalid pointer) | Check memory management code |
| 0x6003 | Memory_CorruptionDetected | CRITICAL | Reset | Memory corruption detected | Restart device and investigate heap integrity |
| 0x6004 | Memory_StackLimitExceeded | CRITICAL | Reset | Stack limit exceeded (stack overflow) | Reduce function call depth or local variable usage |
| 0x6005 | Memory_HeapFragmented | WARNING | None | Heap is heavily fragmented | Restart device or optimize memory allocation patterns |
| 0x6006 | Memory_NVSOperationFailed | ERROR | Retry | Non-volatile storage (NVS) operation failed | Check NVS partition and retry |
| 0x6007 | Memory_CacheMissed | INFO | None | Cache miss (expected in performance context) | Monitor cache hit ratio |

### Synchronization Subsystem (0x7xxx)

| Code | Name | Severity | Recovery Type | Description | Suggestion |
|------|------|----------|----------------|-------------|-----------|
| 0x7001 | Sync_MutexTimeout | ERROR | Retry | Mutex lock timeout (possible deadlock) | Check for circular lock acquisition or increase timeout |
| 0x7002 | Sync_DeadlockDetected | CRITICAL | Reset | Deadlock detected in synchronization | Review lock acquisition order and restart device |
| 0x7003 | Sync_RaceCondition | ERROR | Retry | Race condition detected in shared resource access | Add proper synchronization |
| 0x7004 | Sync_LockFreeQueueFull | WARNING | None | Lock-free queue is full | Increase queue size or reduce producer rate |
| 0x7005 | Sync_SequenceLockFailed | ERROR | Retry | Sequence lock failed (data changed during read) | Retry read operation |
| 0x7006 | Sync_BarrierTimeout | ERROR | Retry | Synchronization barrier timeout | Check for stalled tasks or increase timeout |

### Hardware/System Subsystem (0x8xxx)

| Code | Name | Severity | Recovery Type | Description | Suggestion |
|------|------|----------|----------------|-------------|-----------|
| 0x8001 | Hardware_CPUOverload | WARNING | None | CPU is overloaded (>90% utilization) | Reduce task complexity or increase CPU frequency |
| 0x8002 | Hardware_ThermalThrottle | WARNING | None | Thermal throttling active (CPU temperature high) | Improve cooling or reduce load |
| 0x8003 | Hardware_PowerVoltageError | CRITICAL | Reset | Power supply voltage out of range | Check power supply and connections |
| 0x8004 | Hardware_WatchdogTimeout | CRITICAL | Reset | Watchdog timeout (system reboot imminent) | Check for stalled tasks or increase watchdog timeout |
| 0x8005 | Hardware_StackOverflow | CRITICAL | Reset | Hardware stack overflow detected | Reduce task stack usage or increase stack size |
| 0x8006 | Hardware_UncaughtException | CRITICAL | Reset | Uncaught exception or invalid memory access | Check exception logs and restart device |
| 0x8007 | Hardware_PeripheralFailure | ERROR | Reset | Peripheral (GPIO, timer, etc.) failure | Check hardware connections and configuration |
| 0x8008 | Hardware_GPIOConfigError | ERROR | Retry | GPIO configuration error (pin conflict or invalid mode) | Verify GPIO pin assignments |

### Network Transport Subsystem (0x9xxx)

| Code | Name | Severity | Recovery Type | Description | Suggestion |
|------|------|----------|----------------|-------------|-----------|
| 0x9001 | Network_UDPSocketCreationFailed | ERROR | Retry | Failed to create UDP socket | Check available socket resources |
| 0x9002 | Network_UDPSendFailed | WARNING | Retry | UDP send failed (packet dropped) | Check network connectivity and MTU |
| 0x9003 | Network_UDPReceiveFailed | WARNING | Retry | UDP receive failed | Check socket configuration and network |
| 0x9004 | Network_UDPTimeoutOnReceive | INFO | None | UDP receive timeout (no data received in time) | Check sender or increase timeout |
| 0x9005 | Network_UDPBufferFullOnReceive | WARNING | Retry | UDP receive buffer full (datagrams dropped) | Increase buffer size or improve throughput |
| 0x9006 | Network_SocketOptionsError | ERROR | Retry | Failed to set socket options | Check socket configuration parameters |
| 0x9007 | Network_MTUSizeError | WARNING | None | MTU size configuration error | Use standard MTU sizes (576-1500 bytes) |

### Timing/Beat Subsystem (0xAxxx)

| Code | Name | Severity | Recovery Type | Description | Suggestion |
|------|------|----------|----------------|-------------|-----------|
| 0xA001 | Timing_BeatSyncLost | WARNING | Retry | Beat synchronization lost (timing deviation) | Recalibrate timing or check audio source |
| 0xA002 | Timing_MetronomeDelay | INFO | None | Metronome event delayed beyond threshold | CPU load may be high; check system load |
| 0xA003 | Timing_TempoCalculationError | WARNING | None | Tempo calculation error (invalid BPM) | Verify BPM is within valid range (30-300) |
| 0xA004 | Timing_EventQueueFull | WARNING | None | Timing event queue is full | Reduce event generation rate |
| 0xA005 | Timing_EventProcessingTimeout | ERROR | Retry | Event processing timeout (event handler too slow) | Optimize event handler or increase timeout |
| 0xA006 | Timing_PrecisionLimitExceeded | WARNING | None | Timing precision limit exceeded (jitter too high) | Reduce system load or use RTOS priority boosting |

### Telemetry/Diagnostics Subsystem (0xBxxx)

| Code | Name | Severity | Recovery Type | Description | Suggestion |
|------|------|----------|----------------|-------------|-----------|
| 0xB001 | Telemetry_RecordingFailed | WARNING | Retry | Telemetry recording failed | Check telemetry storage and retry |
| 0xB002 | Telemetry_TransmissionFailed | WARNING | Retry | Telemetry transmission failed | Check network connectivity and retry |
| 0xB003 | Telemetry_StorageFull | WARNING | None | Telemetry storage is full | Clear old telemetry data or increase storage |
| 0xB004 | Telemetry_InvalidMetrics | WARNING | None | Invalid telemetry metrics detected | Check metric sources and validation |
| 0xB005 | Telemetry_TimebaseError | WARNING | Retry | Telemetry timebase error (clock sync lost) | Resync system clock |

### Configuration Subsystem (0xCxxx)

| Code | Name | Severity | Recovery Type | Description | Suggestion |
|------|------|----------|----------------|-------------|-----------|
| 0xC001 | Config_LoadFailed | ERROR | Retry | Failed to load configuration | Check configuration storage and format |
| 0xC002 | Config_SaveFailed | ERROR | Retry | Failed to save configuration | Check storage space and permissions |
| 0xC003 | Config_ValidationFailed | WARNING | None | Configuration validation failed | Check configuration against schema |
| 0xC004 | Config_VersionMismatch | WARNING | None | Configuration version mismatch | Update configuration or firmware version |
| 0xC005 | Config_ParameterOutOfRange | WARNING | None | Configuration parameter out of valid range | Adjust parameter within allowed bounds |
| 0xC006 | Config_MissingRequiredField | ERROR | Retry | Configuration missing required field | Add required configuration field |

### System Subsystem (0xDxxx)

| Code | Name | Severity | Recovery Type | Description | Suggestion |
|------|------|----------|----------------|-------------|-----------|
| 0xD001 | System_InitializationFailed | CRITICAL | Reset | System initialization failed | Check boot logs and restart device |
| 0xD002 | System_NotInitialized | ERROR | Retry | Subsystem not initialized before use | Call initialization function first |
| 0xD003 | System_AlreadyInitialized | WARNING | None | Subsystem already initialized | Skip initialization or call shutdown first |
| 0xD004 | System_InvalidState | WARNING | None | Subsystem in invalid state for operation | Check state transitions and initialization |
| 0xD005 | System_UnexpectedBehavior | ERROR | Retry | Unexpected system behavior detected | Check logs and investigate cause |
| 0xD006 | System_TimeoutGeneric | WARNING | None | Generic timeout (operation exceeded time limit) | Increase timeout or optimize operation |

---

## Usage Guide

### Basic Error Reporting

```cpp
#include "error_codes.h"

// Report error without context
error_report(ErrorCode::WiFi_AssociationTimeout);

// Report error with context message
error_report(ErrorCode::I2S_ReadTimeout, "Failed to read samples from microphone");

// Report error with formatted message
error_reportf(ErrorCode::LED_TransmitFailed, "RMT channel=%d, errno=%d", channel_id, errno);
```

### Querying Error Information

```cpp
// Get human-readable description
const char* desc = error_code_description(ErrorCode::WiFi_ConnectionLost);
Serial.println(desc);  // "WiFi connection lost unexpectedly"

// Get severity level
ErrorSeverity sev = error_code_severity(ErrorCode::Hardware_CPUOverload);
if (sev == ErrorSeverity::Critical) {
    // Take immediate action
}

// Get recovery suggestion
const char* suggestion = error_code_recovery_suggestion(ErrorCode::Memory_AllocationFailed);
Serial.println(suggestion);

// Get category name
const char* category = error_code_category(ErrorCode::Pattern_RenderTimeout);
Serial.println(category);  // "Pattern"
```

### Error Statistics and Telemetry

```cpp
// Get overall error statistics
ErrorStatistics stats;
error_get_statistics(stats);
Serial.printf("Total errors: %u, Critical: %u, Errors: %u, Warnings: %u\n",
    stats.total_errors,
    stats.critical_errors,
    stats.error_errors,
    stats.warning_errors);

// Get count for specific error
uint32_t count = error_get_code_count(ErrorCode::WiFi_ConnectionLost);
Serial.printf("WiFi connection lost occurred %u times\n", count);

// Format error for JSON telemetry
const char* json = error_format_for_telemetry(ErrorCode::LED_TransmitFailed, millis());
// Output: {"code":"0x4001","severity":2,"category":"LED/RMT","desc":"LED transmission failed...","ts":12345}

// Check if error should be reported to telemetry (filters out Info/Warning noise)
if (error_should_report_to_telemetry(ErrorCode::Hardware_WatchdogTimeout)) {
    send_to_telemetry(json);
}
```

### Integration with Existing Code

The error system is designed to integrate seamlessly with existing subsystems:

```cpp
// WiFi Manager
if (!wifi_monitor_is_connected()) {
    error_reportf(ErrorCode::WiFi_ConnectionLost, "SSID=%s", current_ssid);
    wifi_monitor_reassociate_now("Connection lost");
}

// I2S Driver
if (i2s_read_failed()) {
    error_report(ErrorCode::I2S_ReadTimeout, "DMA transfer interrupted");
    i2s_reinit();
}

// WebServer
if (request_queue_full()) {
    error_report(ErrorCode::WebServer_RequestQueueFull);
    close_oldest_connection();
}

// LED Driver
if (rmt_transmit_failed()) {
    error_reportf(ErrorCode::LED_TransmitFailed, "Channel=%d, status=%d", ch, status);
    reset_rmt_channel();
}
```

---

## Recovery Type Matrix

The `recovery_type` field in error metadata guides automatic recovery:

| Type | Value | Behavior | Example |
|------|-------|----------|---------|
| **None** | 0 | Monitor only; no automatic action | Weak WiFi signal, rate limit exceeded |
| **Retry** | 1 | Automatic retry with exponential backoff | WiFi association, I2S read timeout |
| **Reset** | 2 | Reset affected subsystem (may break connections) | Initialization failures, memory exhaustion |
| **Manual** | 3 | User/operator intervention required | Incorrect configuration, missing hardware |
| **Auto Failover** | 4 | Switch to alternate subsystem/mode | AP mode fallback, alternate DNS server |

---

## Telemetry Integration

### Filtering Strategy

Only `Error` and `Critical` severity errors are reported to telemetry by default. This reduces noise while capturing meaningful failures:

```cpp
// Configure in your telemetry system
if (error_should_report_to_telemetry(code)) {
    telemetry_send_error(error_format_for_telemetry(code, millis()));
}
```

### JSON Format

Error telemetry follows this structure:

```json
{
  "code": "0x1002",
  "severity": 2,
  "category": "WiFi",
  "desc": "WiFi association timeout",
  "ts": 125431,
  "context": "SSID=MyNetwork, RSSI=-75dBm"
}
```

### Telemetry API Endpoints (Future)

- `GET /api/errors/stats` - Error statistics
- `GET /api/errors/history` - Last N errors
- `POST /api/errors/clear` - Clear error counters
- `GET /api/errors/summary` - Critical errors only

---

## Performance Considerations

### Hot-Path Safety

- Error reporting is designed for use in critical paths
- Statistics use atomic counters (no locks)
- Serial logging can be rate-limited if needed
- Telemetry reporting is asynchronous (non-blocking)

### Memory Footprint

- Error code definitions: ~8 KB (header + metadata table)
- Runtime statistics: ~1 KB
- Context buffers: 256 bytes per thread (if used)
- Total: ~10 KB per instance

### CPU Overhead

- `error_report()`: ~100-200 µs (Serial I/O bound)
- `error_get_code_count()`: ~5 µs (atomic read)
- `error_format_for_telemetry()`: ~50 µs (sprintf)

---

## Troubleshooting Guide

### "Unknown error code" displayed

- Error code not found in metadata table
- Check code value (should be in ranges 0x1001-0xDxxx)
- Verify enum definition in `error_codes.h`

### Error counts not incrementing

- Error system not initialized; call `error_system_init()` first
- Verify error_report() is being called
- Check if statistics were cleared with `error_clear_statistics()`

### Missing errors in telemetry

- Severity level too low; only Error/Critical are transmitted by default
- Check `error_should_report_to_telemetry()` filtering
- Verify telemetry transport is connected

### Performance degradation after errors

- Serial logging overhead; consider enabling buffering
- Disable DEBUG logging in production
- Monitor statistics periodically rather than continuously

---

## Future Enhancements

- [ ] Error history ring buffer (last 100 errors with timestamps)
- [ ] Automatic error escalation (notify operators on Critical)
- [ ] Error pattern detection (repeated errors = likely root cause)
- [ ] Error recovery automation (auto-retry with backoff)
- [ ] Web dashboard for error visualization
- [ ] Machine learning for predictive failure detection

---

## Related Documents

- Architecture: `docs/01-architecture/` - System design overview
- Decision Records: `docs/02-adr/` - Architecture decisions
- Implementation: `firmware/src/error_codes.h`, `firmware/src/error_codes.cpp`
- Analysis: `docs/05-analysis/` - Subsystem analysis

---

**Reviewed By:** Architecture Team
**Last Updated:** 2025-11-10
**Version:** 1.0

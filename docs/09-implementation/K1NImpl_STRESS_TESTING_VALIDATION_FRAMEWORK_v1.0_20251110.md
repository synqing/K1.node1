---
title: "K1.node1 Stress Testing & Stability Validation Framework"
type: "Implementation Specification"
project: "K1.node1"
project_code: "K1N"
version: "v1.0"
date: "2025-11-10"
status: "authoritative"
task: "Task 12 - Stress Testing & Stability Validation"
phase: "Phase 3"
intent: "Define comprehensive stress testing methodology for production readiness"
doc_id: "K1NImpl_STRESS_TESTING_VALIDATION_FRAMEWORK_v1.0_20251110"
tags: ["testing","stress","stability","validation","production","quality"]
related:
  - "K1NPlan_TASK_ROADMAP_CORRECTED_v1.0_20251110.md"
  - "GRAPH_INTEGRATION_TEST_HARNESS_PLAN.md"
  - "ERROR_CODE_REGISTRY.md"
  - "profiling.h"
  - "K1NReport_PHASE4_VALIDATION_STATUS_v2.0_20251109.md"
---

# K1.node1 Stress Testing & Stability Validation Framework

**Document Status:** AUTHORITATIVE - Complete stress testing specification for Task 12
**Updated:** November 10, 2025
**Owner:** QA Engineer + Senior Engineer
**Estimated Effort:** 16-20 hours
**Timeline:** November 25 - December 2, 2025

---

## Executive Summary

This framework defines comprehensive stress testing and stability validation for the K1.node1 graph system before production deployment. Testing validates system behavior under extreme conditions, extended operation, and edge cases to ensure zero crashes, no data corruption, and graceful degradation under load.

**Key Objectives:**
- Validate 24-48 hour continuous operation without crashes or memory leaks
- Stress test rapid pattern switching, state transitions, and parameter changes
- Validate behavior under memory pressure, CPU load, and thermal stress
- Prove graceful degradation and recovery from fault conditions
- Establish production-ready stability metrics and acceptance criteria

**Success Criteria:**
- 8/8 stress scenarios pass without system crashes
- Zero memory leaks detected over 24-hour runs
- FPS degradation <5% under sustained load
- Graceful recovery from all fault injection scenarios
- Complete telemetry coverage of failure modes

---

## 1. Stress Test Categories

### 1.1 Long-Duration Stability Testing

**Objective:** Validate continuous operation without degradation, crashes, or resource leaks.

**Test Cases:**

#### ST-LDS-001: 24-Hour Continuous Operation
- **Duration:** 24 hours
- **Configuration:**
  - Pattern: Bloom (baseline, moderate complexity)
  - Audio input: Continuous low-frequency sine sweep (40-120 Hz)
  - WiFi: Connected to stable network
  - Target FPS: 60 FPS
  - LED count: 320 (dual-channel, 160 per channel)
- **Monitoring:**
  - FPS stability (capture every 5 seconds)
  - Heap free memory (capture every 5 seconds)
  - Stack high-water marks (capture every 60 seconds)
  - WiFi reconnection count
  - Error code occurrences
  - RMT refill gaps (max gap per 5-minute window)
  - Watchdog feed frequency
- **Pass Criteria:**
  - FPS never drops below 55 FPS (92% of target)
  - Heap free memory delta <1% over 24 hours
  - Zero system crashes or reboots
  - Zero CRITICAL error codes
  - RMT max gap <500μs
  - WiFi reconnections ≤3 over 24 hours

#### ST-LDS-002: 48-Hour Multi-Pattern Rotation
- **Duration:** 48 hours
- **Configuration:**
  - Patterns: Rotate Bloom → Spectrum → (8 other patterns) every 15 minutes
  - Audio input: Continuous music playback (moderate energy)
  - WiFi: Connected
  - Target FPS: 60 FPS
- **Monitoring:** Same as ST-LDS-001
- **Pass Criteria:**
  - FPS degradation <2% over 48 hours
  - Heap free memory stable (±2%)
  - Zero pattern load failures (ERR_PATTERN_LOAD_FAILED)
  - Zero state corruption (ERR_PATTERN_INVALID_STATE)
  - All pattern transitions complete within 100ms

#### ST-LDS-003: Extended Silence Mode
- **Duration:** 12 hours
- **Configuration:**
  - Pattern: Spectrum
  - Audio input: Complete silence (no input)
  - Silence detection enabled
  - Target FPS: 60 FPS
- **Monitoring:** Same as ST-LDS-001
- **Pass Criteria:**
  - Silence detection activates within 5 seconds
  - FPS stable at 60 FPS
  - Heap stable (no leaks from silence handling)
  - Zero I2S timeout errors after 100ms grace period

---

### 1.2 Pattern Switching Stress

**Objective:** Validate rapid state transitions, pattern changes, and parameter updates.

**Test Cases:**

#### ST-PSW-001: Rapid Pattern Switching
- **Duration:** 30 minutes
- **Configuration:**
  - Switch pattern every 100ms (10 Hz)
  - Cycle through 11 patterns (Bloom, Spectrum, +9 migrated)
  - Audio input: Moderate music
  - Target FPS: 60 FPS
- **Monitoring:**
  - Pattern load success rate
  - State initialization time (μs per switch)
  - Heap fragmentation (capture every 60 seconds)
  - Error codes
  - FPS jitter
- **Pass Criteria:**
  - 100% pattern load success
  - Average state init time <5ms
  - FPS never drops below 50 FPS during transitions
  - Zero state corruption errors
  - Zero heap allocation failures

#### ST-PSW-002: Concurrent Parameter Updates
- **Duration:** 15 minutes
- **Configuration:**
  - Pattern: Spectrum (parameter-heavy)
  - Update 5 parameters simultaneously every 50ms
  - Parameters: brightness, saturation, mirror, chromatic, preset
  - Audio input: Continuous
  - Target FPS: 60 FPS
- **Monitoring:**
  - Parameter update latency
  - Lock contention (mutex timeout count)
  - FPS stability
  - Visual artifacts (require manual inspection)
- **Pass Criteria:**
  - 100% parameter updates succeed
  - Average update latency <2ms
  - Zero lock timeouts (ERR_MUTEX_ACQUIRE_TIMEOUT)
  - FPS degradation <3%
  - No visual glitches (manual validation)

#### ST-PSW-003: State Transition Edge Cases
- **Duration:** 20 minutes
- **Configuration:**
  - Transition sequence: Pattern A → Pattern B → Pattern A (immediate return)
  - Trigger transitions during beat events
  - Trigger transitions during audio spikes
  - Interleave parameter changes during transitions
- **Monitoring:**
  - State corruption detection
  - Stateful node reset verification
  - Memory leak detection
- **Pass Criteria:**
  - Zero state corruption
  - All stateful nodes reset correctly on pattern change
  - Heap delta ≤100 bytes per transition

---

### 1.3 Memory Pressure Testing

**Objective:** Validate behavior under maximum graph complexity and memory constraints.

**Test Cases:**

#### ST-MEM-001: Maximum Graph Complexity
- **Duration:** 60 minutes
- **Configuration:**
  - Create graph with maximum node count (≥40 nodes)
  - Deep node chains (≥15 nodes in single chain)
  - Maximum stateful node memory (<1 KB total)
  - Scratch buffer near cap (15 KB of 16 KB default)
  - All pattern buffers allocated
- **Monitoring:**
  - Scratch buffer usage (real-time)
  - Stateful node memory consumption
  - Heap fragmentation
  - Compilation warnings/errors
  - Runtime allocation failures
- **Pass Criteria:**
  - Graph compiles successfully
  - Scratch buffer usage reported accurately
  - Zero heap allocation failures at runtime
  - FPS degradation <5% vs. baseline Bloom
  - Memory overhead <5 KB vs. hand-written pattern

#### ST-MEM-002: Heap Fragmentation Stress
- **Duration:** 45 minutes
- **Configuration:**
  - Allocate/deallocate large JSON documents (WebServer)
  - Rapid pattern switching (every 500ms)
  - WiFi disconnect/reconnect cycles
  - OTA firmware check (without applying)
- **Monitoring:**
  - Heap free (absolute)
  - Largest free block size
  - Fragmentation percentage
  - Allocation failure count
- **Pass Criteria:**
  - Largest free block ≥64 KB at all times
  - Zero allocation failures
  - Fragmentation <30%
  - System remains responsive

#### ST-MEM-003: Stack Overflow Protection
- **Duration:** 30 minutes
- **Configuration:**
  - Deep recursion pattern (if graph supports conditional branches)
  - Maximum audio processing depth
  - Concurrent WebServer requests (10+ simultaneous)
- **Monitoring:**
  - Stack high-water marks (all tasks)
  - Stack overflow error count
- **Pass Criteria:**
  - Zero stack overflows (ERR_STACK_OVERFLOW)
  - All task stacks <85% utilized
  - Watchdog never triggers

---

### 1.4 Audio Input Stress

**Objective:** Validate audio processing under extreme input conditions.

**Test Cases:**

#### ST-AUD-001: High-Frequency Content
- **Duration:** 30 minutes
- **Configuration:**
  - Audio input: White noise (full spectrum)
  - Pattern: Spectrum (FFT-heavy)
  - Target FPS: 60 FPS
- **Monitoring:**
  - FFT computation time
  - Audio snapshot acquisition time
  - Beat detection false positives
  - VU meter saturation
- **Pass Criteria:**
  - FPS degradation <3%
  - Zero audio processing errors
  - Beat detection false positive rate <10%
  - VU meter clamps correctly (no overflow)

#### ST-AUD-002: Extreme Volume Levels
- **Duration:** 20 minutes
- **Configuration:**
  - Audio input: Maximum volume (digital clipping)
  - Pattern: Bloom (audio-reactive)
  - Monitor for overflow/saturation handling
- **Monitoring:**
  - Audio clipping detection
  - Brightness limiter activation
  - Color saturation clamping
  - Error codes
- **Pass Criteria:**
  - Zero audio overflow errors
  - Brightness correctly clamped to [0, 1]
  - RGB values clamped to [0, 1]
  - Visual output remains stable (no flickering)

#### ST-AUD-003: I2S Timeout Simulation
- **Duration:** 15 minutes
- **Configuration:**
  - Inject I2S read timeouts (simulated via delay injection)
  - Pattern: Any audio-reactive pattern
  - Verify fallback to silence mode
- **Monitoring:**
  - I2S timeout count (ERR_I2S_READ_TIMEOUT)
  - Fallback activation time
  - Recovery time after timeout clears
  - Watchdog feed during timeout
- **Pass Criteria:**
  - Timeout detected within 100ms
  - Fallback to silence within 200ms
  - Recovery within 500ms after timeout clears
  - Zero system hangs or crashes
  - Watchdog fed continuously (no WDT reset)

#### ST-AUD-004: Audio Processing Desync
- **Duration:** 25 minutes
- **Configuration:**
  - Simulate audio frame drops
  - Inject audio timestamp jumps
  - Trigger audio buffer overruns
- **Monitoring:**
  - Desync detection (ERR_AUDIO_PIPELINE_DESYNC)
  - Frame skipping behavior
  - Synchronization recovery time
- **Pass Criteria:**
  - Desync detected within 3 frames
  - Recovery within 10 frames
  - FPS stability maintained
  - Zero visual artifacts during recovery

---

### 1.5 CPU Load Testing

**Objective:** Validate behavior under sustained high CPU utilization.

**Test Cases:**

#### ST-CPU-001: Maximum Rendering Load
- **Duration:** 40 minutes
- **Configuration:**
  - Pattern: Most complex migrated pattern
  - Audio input: High-energy music (bass + treble)
  - LED updates: 60 FPS target
  - WiFi: Active with periodic requests
  - WebSocket streaming: Enabled (250ms updates)
- **Monitoring:**
  - CPU utilization (core 0 + core 1)
  - Loop timing (render, quantize, transmit)
  - Idle time percentage
  - Watchdog margin
- **Pass Criteria:**
  - CPU utilization <85% average
  - FPS ≥58 FPS (97% of target)
  - Watchdog margin ≥200ms
  - Zero watchdog resets

#### ST-CPU-002: Concurrent Operations
- **Duration:** 30 minutes
- **Configuration:**
  - Rendering: 60 FPS
  - Audio processing: Continuous
  - WebServer: 5 simultaneous requests/second
  - WebSocket: 4 connected clients
  - OTA: Background firmware check
- **Monitoring:**
  - Task starvation (minimum execution rate per task)
  - Inter-task latency
  - Priority inversion count
  - FPS stability
- **Pass Criteria:**
  - Zero task starvation
  - FPS degradation <5%
  - WebServer response time <100ms (p95)
  - WebSocket update jitter <50ms

#### ST-CPU-003: Dual-Core Synchronization
- **Duration:** 35 minutes
- **Configuration:**
  - Audio task: Core 0
  - Render task: Core 1
  - WiFi task: Core 0
  - Pattern switching every 5 seconds
- **Monitoring:**
  - Inter-core communication latency
  - Lock contention between cores
  - Cache coherency issues (manual inspection)
  - Synchronization primitives (mutex, spinlock timeouts)
- **Pass Criteria:**
  - Zero lock timeouts
  - Inter-core latency <50μs (p99)
  - Zero data corruption from race conditions
  - FPS stable

---

### 1.6 Thermal Stress

**Objective:** Validate behavior under elevated ambient temperatures and sustained high CPU load.

**Test Cases:**

#### ST-THM-001: Sustained High CPU with Thermal Monitoring
- **Duration:** 60 minutes
- **Configuration:**
  - CPU load: Maximum (as per ST-CPU-001)
  - LED output: Full brightness (worst-case power draw)
  - Ambient temp: Room temperature (no forced cooling)
  - Monitor ESP32-S3 internal temperature sensor
- **Monitoring:**
  - Internal temperature (°C)
  - CPU throttling activation
  - FPS degradation over time
  - Crash/reboot due to thermal shutdown
- **Pass Criteria:**
  - Internal temp ≤85°C (ESP32-S3 rated max 105°C)
  - Zero thermal throttling events
  - FPS degradation <3% over 60 minutes
  - Zero thermal shutdowns

#### ST-THM-002: Thermal Cycling
- **Duration:** 90 minutes
- **Configuration:**
  - Cycle between high load (10 min) and idle (5 min)
  - Repeat 6 cycles
  - Monitor temperature rise/fall rates
- **Monitoring:**
  - Temperature rise rate (°C/min)
  - Temperature fall rate (°C/min)
  - Performance variation across cycles
- **Pass Criteria:**
  - Temperature stabilizes within 5 minutes of load change
  - FPS consistent across all cycles (±2%)
  - Zero thermal-related errors

---

### 1.7 Edge Case Scenarios

**Objective:** Validate graceful degradation and error handling.

**Test Cases:**

#### ST-EDG-001: Null Input Handling
- **Duration:** 15 minutes
- **Configuration:**
  - Inject null audio snapshots
  - Send malformed WebServer requests
  - Provide invalid parameter values
  - Attempt to load non-existent patterns
- **Monitoring:**
  - Error codes (appropriate vs. crashes)
  - System recovery time
  - Crash count
- **Pass Criteria:**
  - Zero system crashes
  - All errors return appropriate error codes
  - Recovery within 1 second
  - User-facing error messages clear and actionable

#### ST-EDG-002: Buffer Overflow Prevention
- **Duration:** 20 minutes
- **Configuration:**
  - Send oversized HTTP bodies (>64 KB)
  - Send excessive headers (>50)
  - Send excessive query parameters (>100)
  - Inject oversized JSON documents
- **Monitoring:**
  - Bounds check activation count
  - Buffer overflow error codes (ERR_HTTP_BODY_TOO_LARGE, etc.)
  - Crash count
- **Pass Criteria:**
  - Zero crashes
  - All oversized inputs rejected with appropriate error codes
  - System remains responsive
  - No memory corruption detected

#### ST-EDG-003: WiFi Instability
- **Duration:** 30 minutes
- **Configuration:**
  - Disconnect WiFi every 2 minutes
  - Reconnect after 30 seconds
  - Continue pattern rendering during disconnection
  - Monitor reconnection behavior
- **Monitoring:**
  - WiFi reconnection success rate
  - Reconnection time
  - FPS stability during disconnection
  - Error codes
- **Pass Criteria:**
  - Reconnection success rate ≥90%
  - Average reconnection time ≤10 seconds
  - FPS unaffected during WiFi disconnection
  - Zero crashes during WiFi state transitions

#### ST-EDG-004: RMT Synchronization Failures
- **Duration:** 25 minutes
- **Configuration:**
  - Inject RMT transmit delays (simulated via priority inversion)
  - Trigger dual-channel desync scenarios
  - Monitor refill gap spikes
- **Monitoring:**
  - RMT sync failure count (ERR_RMT_DUAL_CHANNEL_SYNC_FAIL)
  - Fallback activation (single-channel mode if implemented)
  - Visual artifacts (manual inspection)
  - Recovery time
- **Pass Criteria:**
  - Sync failures detected within 100ms
  - Fallback activated within 200ms
  - Recovery within 5 seconds
  - Zero LED output corruption (frame tearing, color shifts)

#### ST-EDG-005: Graph Codegen Error Handling
- **Duration:** 10 minutes
- **Configuration:**
  - Compile invalid graphs (cycle detection, type mismatches, memory overruns)
  - Attempt to load graphs with missing nodes
  - Test error message clarity
- **Monitoring:**
  - Compiler error codes (E1001-E1010)
  - Error message clarity (nodeId, type, port, location)
  - Build failure detection
- **Pass Criteria:**
  - All invalid graphs rejected at compile time
  - Error messages include nodeId, type, port, location
  - Zero runtime crashes from malformed graphs
  - Developer can diagnose error within 30 seconds

---

### 1.8 Graceful Degradation

**Objective:** Validate system behavior when resources are exhausted or unavailable.

**Test Cases:**

#### ST-GRD-001: Heap Exhaustion Handling
- **Duration:** 15 minutes
- **Configuration:**
  - Gradually allocate heap until 90% utilized
  - Trigger pattern switches
  - Attempt large JSON document parsing
  - Monitor fallback behavior
- **Monitoring:**
  - Allocation failure count (ERR_MALLOC_FAILED)
  - Fallback activation (simplified rendering, reduced buffers)
  - System stability
- **Pass Criteria:**
  - Zero crashes
  - Fallback activated when heap <10% free
  - System continues basic operation (reduced functionality)
  - Error messages indicate heap pressure

#### ST-GRD-002: I2S Persistent Failure
- **Duration:** 20 minutes
- **Configuration:**
  - Simulate I2S driver failure (persistent timeout)
  - Verify fallback to silence mode
  - Verify pattern continues rendering (non-audio-reactive behavior)
- **Monitoring:**
  - I2S failure detection time
  - Fallback activation time
  - Pattern rendering continuation
  - Error logging rate (rate-limited)
- **Pass Criteria:**
  - Failure detected within 500ms
  - Fallback activated within 1 second
  - Pattern continues rendering at 60 FPS
  - Error logs rate-limited to 1/second

#### ST-GRD-003: RMT Channel Failure
- **Duration:** 15 minutes
- **Configuration:**
  - Simulate RMT channel allocation failure
  - Verify single-channel fallback (if dual-channel configured)
  - Verify LED output continues (reduced capacity)
- **Monitoring:**
  - RMT failure detection
  - Single-channel fallback activation
  - LED output verification (reduced from 320 to 160 LEDs)
- **Pass Criteria:**
  - Failure detected at boot or runtime
  - Fallback to single channel within 100ms
  - 160 LEDs continue operating normally
  - Error logged once (not spammed)

---

## 2. Automated Stress Test Framework

### 2.1 Framework Architecture

**Components:**

1. **Test Orchestrator** (`firmware/test/test_hardware_stress/orchestrator.cpp`)
   - Loads test case definitions from JSON
   - Executes test sequences
   - Coordinates monitoring and data collection
   - Enforces test duration and pass/fail criteria

2. **Monitoring Agent** (`firmware/test/test_hardware_stress/monitor.cpp`)
   - Captures telemetry at specified intervals
   - Reads profiling data from `profiling.h`
   - Queries REST diagnostics endpoints
   - Logs heartbeat data

3. **Data Collector** (`firmware/test/test_hardware_stress/collector.cpp`)
   - Aggregates telemetry into time-series database (SPIFFS CSV)
   - Computes statistics (min, max, avg, p95, p99)
   - Detects anomalies (threshold violations)

4. **Fault Injector** (`firmware/test/test_hardware_stress/fault_injector.cpp`)
   - Simulates I2S timeouts
   - Injects WiFi disconnections
   - Triggers heap pressure
   - Simulates RMT delays

5. **Report Generator** (`firmware/test/test_hardware_stress/report.cpp`)
   - Generates markdown reports
   - Includes time-series charts (ASCII or JSON for external rendering)
   - Summarizes pass/fail per test case
   - Highlights anomalies and errors

**Workflow:**

```
START
  ↓
Load Test Case (JSON)
  ↓
Initialize Monitoring (timers, telemetry)
  ↓
Execute Test Sequence
  │
  ├─ Pattern switches (if configured)
  ├─ Parameter updates (if configured)
  ├─ Fault injection (if configured)
  ├─ Audio input control (if configured)
  │
  ↓
Monitor Telemetry (periodic capture)
  │
  ├─ FPS (every 5s)
  ├─ Heap free (every 5s)
  ├─ Stack high-water (every 60s)
  ├─ Error codes (every 5s)
  ├─ RMT diagnostics (every 5s)
  ├─ Profiling stats (every 60s)
  │
  ↓
Check Pass/Fail Criteria (continuous)
  │
  ├─ FPS threshold
  ├─ Heap delta
  ├─ Error code thresholds
  ├─ Crash detection
  │
  ↓
Generate Report (end of test)
  ↓
PASS or FAIL
```

---

### 2.2 Test Case Definition (JSON Schema)

**Schema:**

```json
{
  "test_id": "ST-LDS-001",
  "name": "24-Hour Continuous Operation",
  "category": "long_duration",
  "duration_ms": 86400000,
  "pattern": "Bloom",
  "audio_config": {
    "type": "sine_sweep",
    "frequency_range": [40, 120],
    "amplitude": 0.5
  },
  "monitoring": {
    "fps_interval_ms": 5000,
    "heap_interval_ms": 5000,
    "stack_interval_ms": 60000,
    "error_interval_ms": 5000,
    "rmt_interval_ms": 5000
  },
  "pass_criteria": {
    "fps_min": 55,
    "fps_target": 60,
    "heap_delta_percent_max": 1,
    "crash_count_max": 0,
    "critical_error_count_max": 0,
    "rmt_max_gap_us_max": 500,
    "wifi_reconnect_count_max": 3
  },
  "fault_injection": null
}
```

**Examples:**

- `ST-LDS-001.json` - 24-hour continuous
- `ST-PSW-001.json` - Rapid pattern switching
- `ST-MEM-001.json` - Maximum graph complexity
- `ST-AUD-003.json` - I2S timeout simulation
- `ST-EDG-001.json` - Null input handling

---

### 2.3 Measurement Points

**Real-Time Metrics (Captured Periodically):**

| Metric | Source | Interval | Units |
|--------|--------|----------|-------|
| FPS | `heartbeat_logger.cpp` | 5s | frames/sec |
| Heap Free | `ESP.getFreeHeap()` | 5s | bytes |
| Heap Largest Block | `ESP.getMaxAllocHeap()` | 5s | bytes |
| Heap Fragmentation | Computed | 5s | % |
| Stack High-Water (all tasks) | `uxTaskGetStackHighWaterMark()` | 60s | bytes |
| CPU Utilization (core 0/1) | `vTaskGetRunTimeStats()` | 10s | % |
| Internal Temperature | `temperatureRead()` | 10s | °C |
| WiFi RSSI | `WiFi.RSSI()` | 30s | dBm |
| WiFi Reconnect Count | `wifi_monitor.cpp` | 5s | count |
| Error Code Count (by code) | Error registry | 5s | count |
| RMT Refill Count (ch1/ch2) | `rmt_probe.h` | 5s | count |
| RMT Max Gap (ch1/ch2) | `rmt_probe.h` | 5s | μs |
| Audio Snapshot Latency | `profiling.h` | 60s | μs (avg) |
| Pattern Render Time | `profiling.h` | 60s | μs (avg) |
| Quantize Time | `profiling.h` | 60s | μs (avg) |
| LED Transmit Time | `profiling.h` | 60s | μs (avg) |
| WebServer Request Count | `/api/device/performance` | 30s | count |
| WebSocket Client Count | `/api/device/info` | 30s | count |

**Aggregated Statistics (Computed at End):**

- Min, Max, Avg, Median, P95, P99 for all time-series metrics
- Error code histogram
- Crash count
- Watchdog reset count
- Test duration (actual vs. expected)

---

### 2.4 Failure Detection Methodology

**What Constitutes Failure vs. Acceptable Variance:**

#### FAILURE (Immediate Test Abort):

1. **System Crash/Reboot**
   - Watchdog reset detected
   - Unexpected reboot (boot count increments)
   - Unrecoverable panic/assert

2. **Critical Error Code Threshold Exceeded**
   - Any CRITICAL severity error (severity=4)
   - More than 5 HIGH severity errors (severity=3) in 60 seconds
   - Persistent error logging (same error >100 times in 60s)

3. **FPS Collapse**
   - FPS drops below minimum threshold for >30 seconds
   - FPS drops to 0 (complete stall)

4. **Memory Exhaustion**
   - Heap free <10% for >60 seconds
   - Allocation failure (ERR_MALLOC_FAILED) during normal operation
   - Stack overflow detected (ERR_STACK_OVERFLOW)

5. **Data Corruption**
   - Invalid error code values (out of 0-255 range)
   - Checksum failures in telemetry data
   - Visual artifacts indicating buffer corruption (manual inspection)

#### ACCEPTABLE VARIANCE (Warning, Not Failure):

1. **Transient FPS Drops**
   - FPS drops to minimum threshold for <10 seconds
   - Caused by legitimate workload spikes (WiFi reconnection, OTA check)
   - Recovers to target within 30 seconds

2. **Low/Medium Severity Errors**
   - INFO (severity=0): Always acceptable
   - LOW (severity=1): Acceptable if <10/minute
   - MEDIUM (severity=2): Acceptable if <5/minute and recoverable

3. **Memory Fluctuations**
   - Heap free varies ±5% due to legitimate allocations (WebServer buffers, etc.)
   - Short-term fragmentation <30%
   - Stack usage spikes to 85% briefly during peak load

4. **WiFi Reconnections**
   - Reconnections due to external network issues
   - Reconnection time ≤15 seconds
   - System continues operating during disconnection

5. **Thermal Fluctuations**
   - Temperature varies ±5°C due to ambient conditions
   - No throttling or performance degradation

---

### 2.5 Recovery Procedure

**Hang/Crash Detection:**

1. **Watchdog Monitoring**
   - Watchdog timeout: 8 seconds (configurable in `main.cpp`)
   - If watchdog fires, test orchestrator detects reboot via boot counter
   - Test marked as FAIL

2. **Heartbeat Timeout**
   - Heartbeat expected every 1 second (configurable)
   - If no heartbeat for 5 seconds, assume hang
   - Test orchestrator attempts serial ping
   - If no response for 10 seconds, trigger manual reset

3. **Remote Monitoring**
   - REST endpoint `/api/device/heartbeat` polled every 10 seconds
   - If HTTP timeout or connection refused, assume crash
   - Test orchestrator logs failure and attempts recovery

**Recovery Actions:**

1. **Automatic Soft Reset**
   - If hang detected, send `ESP.restart()` via serial command
   - Wait 30 seconds for boot
   - Resume monitoring (new test iteration if applicable)

2. **Manual Hard Reset**
   - If soft reset fails, require manual power cycle
   - Test orchestrator pauses and waits for operator intervention
   - Resume after manual confirmation

3. **Data Preservation**
   - All telemetry written to SPIFFS before reset
   - Heartbeat log rotated to `/heartbeat_crash.log`
   - Error logs preserved in `/errors_crash.log`
   - Crash count incremented in NVS

---

## 3. Telemetry Collection

### 3.1 Continuous Monitoring Strategy

**Data Collection:**

- **In-Memory Ring Buffer** (128 entries, circular overwrite)
  - Stores last 128 heartbeat entries
  - Accessible via `/api/telemetry/heartbeat` endpoint
  - Minimal heap impact (16 KB)

- **SPIFFS Log Files** (persistent, rotated)
  - `/heartbeat.log` - Continuous heartbeat log (max 64 KB, rotates)
  - `/errors.log` - Error code log (max 32 KB, rotates)
  - `/profiling.log` - Profiling statistics (max 32 KB, rotates)
  - `/stress_test_summary.json` - Test results (preserved across reboots)

- **Real-Time WebSocket Streaming** (optional, debug builds)
  - Stream telemetry to connected clients every 250ms
  - Disabled in production builds to reduce overhead
  - Enabled via `DEBUG_TELEMETRY=1` build flag

**Data Format (Heartbeat Log):**

```csv
timestamp_ms,frame_total,frame_delta,fps,heap_free,heap_largest,fragmentation,stack_min,cpu_core0,cpu_core1,temp_c,wifi_rssi,error_count,rmt_gap_max_ch1,rmt_gap_max_ch2,pattern_index
1000,60,60,60.0,128000,64000,5.2,4096,45.2,38.7,42.3,-45,0,120,115,0
2000,120,60,60.0,127950,64000,5.3,4096,46.1,39.2,42.5,-45,0,125,118,0
```

**Data Format (Error Log):**

```csv
timestamp_ms,error_code,error_name,severity,count
5432,24,ERR_I2S_READ_TIMEOUT,HIGH,1
12890,10,ERR_WIFI_NO_CREDENTIALS,HIGH,1
```

**Data Format (Profiling Log):**

```csv
timestamp_ms,section,calls,avg_us,max_us,total_ms
60000,pattern_render,3600,1250,2100,4500
60000,audio_snapshot,3600,450,780,1620
60000,led_quantize,3600,680,920,2448
60000,led_transmit,3600,820,1200,2952
```

---

### 3.2 Telemetry Storage

**SPIFFS Allocation:**

- Total SPIFFS: 1.5 MB (typical ESP32-S3 partition)
- Stress test allocation: 256 KB
  - `/heartbeat.log`: 64 KB
  - `/errors.log`: 32 KB
  - `/profiling.log`: 32 KB
  - `/stress_test_summary.json`: 16 KB
  - `/fault_injection_log.json`: 16 KB
  - Buffer: 96 KB

**Rotation Policy:**

- Files rotate when size limit reached
- Old file renamed to `<name>_old.log`
- New file created
- Oldest file deleted if SPIFFS >80% utilized

**Data Retention:**

- In-memory: Last 128 heartbeats (≈2 minutes at 1 Hz)
- SPIFFS: Up to 24 hours (depending on logging rate)
- External: Export via `/api/telemetry/export` endpoint (JSON)

---

### 3.3 Telemetry Analysis

**Post-Test Analysis:**

1. **Statistical Summary**
   - Compute min, max, avg, p95, p99 for all metrics
   - Identify anomalies (values >3σ from mean)
   - Generate histogram for error codes

2. **Trend Detection**
   - Linear regression for heap free (detect leaks)
   - Moving average for FPS (detect degradation)
   - Spike detection for RMT gaps (detect sync issues)

3. **Correlation Analysis**
   - Correlate FPS drops with error codes
   - Correlate heap spikes with pattern switches
   - Correlate RMT gaps with CPU load

4. **Visualization**
   - Generate time-series charts (ASCII art or JSON for external tools)
   - Heatmap for error code distribution
   - Scatter plot for FPS vs. heap free

**Example Analysis Output:**

```
=== STRESS TEST ANALYSIS ===
Test: ST-LDS-001 (24-Hour Continuous Operation)
Duration: 86400000 ms (24.0 hours)
Status: PASS

FPS Statistics:
  Min: 58.2 FPS
  Max: 60.0 FPS
  Avg: 59.8 FPS
  P95: 60.0 FPS
  P99: 60.0 FPS
  Threshold: 55 FPS
  Violations: 0

Heap Statistics:
  Min: 127850 bytes
  Max: 128200 bytes
  Avg: 128025 bytes
  Delta: 350 bytes (0.27%)
  Threshold: 1280 bytes (1%)
  Violations: 0

Error Code Summary:
  ERR_OK (0): 86400 occurrences
  ERR_WIFI_LINK_LOST (15): 2 occurrences
  Total Errors: 2
  Critical Errors: 0

RMT Diagnostics:
  Max Gap (ch1): 245 μs
  Max Gap (ch2): 238 μs
  Threshold: 500 μs
  Violations: 0

PASS CRITERIA EVALUATION:
  ✓ FPS ≥55 (actual: 58.2 min)
  ✓ Heap delta ≤1% (actual: 0.27%)
  ✓ Crash count = 0 (actual: 0)
  ✓ Critical errors = 0 (actual: 0)
  ✓ RMT gap ≤500μs (actual: 245μs)
  ✓ WiFi reconnects ≤3 (actual: 2)

VERDICT: PASS (6/6 criteria met)
```

---

## 4. Pass/Fail Criteria for Production Readiness

### 4.1 Overall Success Criteria

**8/8 Stress Scenarios MUST PASS:**

| Scenario | Pass Criteria Summary |
|----------|----------------------|
| ST-LDS-001 | 24-hour run, FPS ≥55, heap delta ≤1%, 0 crashes |
| ST-LDS-002 | 48-hour run, FPS degradation <2%, 0 state corruption |
| ST-PSW-001 | Rapid switching, 100% success, FPS ≥50 during transitions |
| ST-MEM-001 | Max graph compiles, FPS degradation <5%, 0 alloc failures |
| ST-AUD-001 | High-freq audio, FPS degradation <3%, 0 audio errors |
| ST-CPU-001 | Max rendering, CPU <85%, FPS ≥58, 0 WDT resets |
| ST-THM-001 | Thermal stress, temp ≤85°C, FPS degradation <3% |
| ST-EDG-001 | Null inputs, 0 crashes, appropriate error codes |

**Additional Requirements:**

- **Zero Memory Leaks:** All 24+ hour tests show heap delta ≤1%
- **Zero System Crashes:** No watchdog resets, panics, or unexpected reboots
- **Error Code Coverage:** All error codes tested and validated
- **Graceful Degradation:** All fallback mechanisms activated and verified
- **Telemetry Integrity:** 100% telemetry capture success (no data loss)

---

### 4.2 Per-Category Pass Criteria

#### Long-Duration Stability:
- [ ] 24-hour continuous operation (ST-LDS-001) PASS
- [ ] 48-hour multi-pattern rotation (ST-LDS-002) PASS
- [ ] 12-hour silence mode (ST-LDS-003) PASS

#### Pattern Switching Stress:
- [ ] Rapid pattern switching (ST-PSW-001) PASS
- [ ] Concurrent parameter updates (ST-PSW-002) PASS
- [ ] State transition edge cases (ST-PSW-003) PASS

#### Memory Pressure:
- [ ] Maximum graph complexity (ST-MEM-001) PASS
- [ ] Heap fragmentation stress (ST-MEM-002) PASS
- [ ] Stack overflow protection (ST-MEM-003) PASS

#### Audio Input Stress:
- [ ] High-frequency content (ST-AUD-001) PASS
- [ ] Extreme volume levels (ST-AUD-002) PASS
- [ ] I2S timeout simulation (ST-AUD-003) PASS
- [ ] Audio processing desync (ST-AUD-004) PASS

#### CPU Load:
- [ ] Maximum rendering load (ST-CPU-001) PASS
- [ ] Concurrent operations (ST-CPU-002) PASS
- [ ] Dual-core synchronization (ST-CPU-003) PASS

#### Thermal Stress:
- [ ] Sustained high CPU (ST-THM-001) PASS
- [ ] Thermal cycling (ST-THM-002) PASS

#### Edge Cases:
- [ ] Null input handling (ST-EDG-001) PASS
- [ ] Buffer overflow prevention (ST-EDG-002) PASS
- [ ] WiFi instability (ST-EDG-003) PASS
- [ ] RMT synchronization failures (ST-EDG-004) PASS
- [ ] Graph codegen errors (ST-EDG-005) PASS

#### Graceful Degradation:
- [ ] Heap exhaustion handling (ST-GRD-001) PASS
- [ ] I2S persistent failure (ST-GRD-002) PASS
- [ ] RMT channel failure (ST-GRD-003) PASS

---

### 4.3 Conditional Pass (Escalation Required)

**If 1-2 scenarios FAIL with acceptable justification:**

- **Scenario:** ST-THM-001 or ST-THM-002 (thermal stress)
- **Justification:** ESP32-S3 temperature sensor unreliable, no thermal throttling observed
- **Mitigation:** Manual thermal testing with external sensor
- **Decision:** Project Lead approval required

**If ≥3 scenarios FAIL:**

- **Decision:** Return to Phase 2 (debugging and fixes)
- **Timeline:** Add 1-2 weeks for root cause analysis and remediation
- **Re-test:** Full stress test suite after fixes

---

## 5. Risk Assessment

### 5.1 Identified Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Memory leaks in graph system | Medium | High | Heap monitoring, Valgrind/ASAN if available |
| RMT dual-channel desync | Medium | Medium | Instrumentation, fallback to single channel |
| I2S driver instability | Low | High | Timeout protection, silence fallback |
| WiFi reconnection storms | Medium | Low | Exponential backoff, rate limiting |
| Thermal throttling | Low | Medium | Baseline thermal testing, cooling recommendations |
| Heap fragmentation | High | Medium | Minimize allocations, use fixed buffers |
| Graph codegen bugs | Medium | High | Comprehensive compiler test suite (Task 5) |
| WebSocket flooding | Low | Low | Connection limits, rate limiting |
| SPIFFS corruption | Low | Medium | Filesystem checks, rotation safeguards |
| Watchdog false positives | Low | High | Watchdog feed in all critical loops |

---

### 5.2 Mitigation Strategies

**Proactive:**
- Run stress tests in debug builds with extra instrumentation
- Use external monitoring (serial logging, REST polling)
- Baseline performance metrics before stress testing
- Isolate subsystems (audio, WiFi, rendering) for targeted stress

**Reactive:**
- Automated crash detection and recovery
- Telemetry preservation across reboots
- Incremental test case execution (abort early if critical failure)
- Manual inspection checkpoints (visual output, thermal camera)

---

## 6. Timeline Estimate

### 6.1 Phase Breakdown

| Phase | Duration | Description |
|-------|----------|-------------|
| **Setup** | 4 hours | Implement test framework, orchestrator, monitoring |
| **Test Case Implementation** | 6 hours | Implement 25+ test cases, fault injectors |
| **Baseline Testing** | 2 hours | Establish performance baselines |
| **Short-Duration Tests** | 4 hours | Run tests <1 hour (ST-PSW, ST-MEM, ST-AUD, ST-CPU, ST-EDG, ST-GRD) |
| **Long-Duration Tests** | 48 hours | Run 24-48 hour tests (ST-LDS-001, ST-LDS-002) |
| **Analysis & Reporting** | 4 hours | Analyze results, generate reports, fix issues |
| **Total** | 68 hours | (20 hours active work + 48 hours passive monitoring) |

**Calendar Timeline:**
- **November 25:** Setup + test case implementation (8 hours)
- **November 26:** Baseline + short-duration tests (6 hours)
- **November 27-28:** 48-hour continuous run (passive monitoring)
- **November 29:** Analysis + reporting (4 hours)
- **November 30 - December 2:** Fix issues, re-test failures (if needed)
- **December 2:** Final validation complete

---

### 6.2 Team Allocation

| Role | Allocation | Responsibilities |
|------|-----------|------------------|
| **QA Engineer** | 50% | Test framework, orchestration, monitoring |
| **Senior Engineer** | 30% | Fault injection, telemetry analysis, debugging |
| **Firmware Engineer** | 20% | Instrumentation, profiling, bug fixes |

---

## 7. Continuous Stress Testing Strategy

### 7.1 Nightly Builds Integration

**CI/CD Pipeline:**

1. **Nightly Build Trigger** (midnight UTC)
   - Build firmware with `DEBUG_TELEMETRY=1`
   - Flash to dedicated test device (always-on ESP32-S3)
   - Start orchestrator with subset of stress tests

2. **Short-Duration Stress Suite** (3 hours)
   - ST-PSW-001 (rapid switching, 30 min)
   - ST-MEM-001 (max graph, 60 min)
   - ST-AUD-001 (high-freq audio, 30 min)
   - ST-CPU-001 (max rendering, 40 min)
   - ST-EDG-001, ST-EDG-002, ST-EDG-003 (edge cases, 60 min total)

3. **Telemetry Collection & Reporting**
   - Export telemetry via REST API
   - Upload to CI artifact storage
   - Generate trend reports (compare vs. previous nights)
   - Alert on regressions (FPS drop >2%, heap increase >1%)

4. **Weekly Long-Duration Test** (Sunday night)
   - ST-LDS-001 (24-hour continuous, Monday recovery)
   - Full analysis and regression detection

**Benefits:**
- Catch regressions early (before code review)
- Establish performance baselines over time
- Validate stability across firmware versions
- Reduce risk of production deployment

---

### 7.2 Regression Detection

**Automated Alerts:**

- FPS degradation >2% vs. previous build
- Heap free decrease >1% vs. previous build
- New error codes introduced
- Crash/reboot detected
- Test case transitions from PASS to FAIL

**Trend Analysis:**

- Track FPS, heap, error counts over 30 days
- Detect gradual degradation (memory leaks, performance regressions)
- Correlate with code changes (git blame)

---

## 8. Deliverables

### 8.1 Required Artifacts

- [ ] **Test Framework Implementation** (`firmware/test/test_hardware_stress/`)
  - [ ] `orchestrator.cpp` - Test execution engine
  - [ ] `monitor.cpp` - Telemetry capture
  - [ ] `collector.cpp` - Data aggregation
  - [ ] `fault_injector.cpp` - Fault simulation
  - [ ] `report.cpp` - Report generation

- [ ] **Test Case Definitions** (`firmware/test/test_hardware_stress/test_cases/`)
  - [ ] 25+ JSON test case files (ST-*.json)

- [ ] **Stress Test Specification** (this document)
  - [ ] Test categories, test cases, pass criteria
  - [ ] Measurement points, telemetry collection
  - [ ] Failure detection, recovery procedures

- [ ] **Validation Report** (`docs/09-reports/K1NReport_STRESS_TEST_VALIDATION_v1.0_20251202.md`)
  - [ ] Test execution summary (25+ test cases)
  - [ ] Pass/fail results per category
  - [ ] Anomaly analysis
  - [ ] Production readiness recommendation

- [ ] **CI/CD Integration** (`.github/workflows/stress_test.yml`)
  - [ ] Nightly short-duration stress suite
  - [ ] Weekly long-duration stress suite
  - [ ] Automated regression alerts

---

### 8.2 Success Metrics Summary

| Metric | Target | Actual (To Be Measured) |
|--------|--------|-------------------------|
| Test Cases Executed | 25+ | _TBD_ |
| Test Cases Passed | 100% (25/25) | _TBD_ |
| System Crashes | 0 | _TBD_ |
| Memory Leaks Detected | 0 | _TBD_ |
| Critical Errors | 0 | _TBD_ |
| FPS Stability (24h) | ≥55 FPS | _TBD_ |
| Heap Delta (24h) | ≤1% | _TBD_ |
| RMT Max Gap | ≤500 μs | _TBD_ |
| WiFi Reconnections (24h) | ≤3 | _TBD_ |
| Thermal Max (sustained) | ≤85°C | _TBD_ |

---

## 9. Related Documentation

- **Task Roadmap:** `docs/04-planning/K1NPlan_TASK_ROADMAP_CORRECTED_v1.0_20251110.md`
- **Error Code Registry:** `docs/09-implementation/ERROR_CODE_REGISTRY.md`
- **Profiling Infrastructure:** `firmware/src/profiling.h`
- **Heartbeat Logger:** `firmware/src/diagnostics/heartbeat_logger.cpp`
- **Graph Integration Test Harness:** `docs/09-implementation/GRAPH_INTEGRATION_TEST_HARNESS_PLAN.md`
- **Phase 4 Validation Report:** `docs/09-reports/K1NReport_PHASE4_VALIDATION_STATUS_v2.0_20251109.md`
- **CLAUDE Operations Manual:** `CLAUDE.md` § Firmware/ESP-IDF Guardrails & Playbook

---

## 10. Execution Checklist

### Pre-Test Setup:
- [ ] Flash firmware with `DEBUG_TELEMETRY=1` build
- [ ] Verify SPIFFS mounted (256 KB allocated)
- [ ] Verify WiFi connected (stable network)
- [ ] Verify audio input available (microphone functional)
- [ ] Verify LED output connected (320 LEDs, dual-channel)
- [ ] Establish performance baseline (run ST-LDS-001 for 1 hour)

### Test Execution:
- [ ] Load test case definitions (25+ JSON files)
- [ ] Execute short-duration tests (ST-PSW, ST-MEM, ST-AUD, ST-CPU, ST-EDG, ST-GRD)
- [ ] Execute long-duration tests (ST-LDS-001, ST-LDS-002)
- [ ] Monitor telemetry continuously
- [ ] Capture crash logs (if any)
- [ ] Export telemetry data to external storage

### Post-Test Analysis:
- [ ] Generate statistical summary (min, max, avg, p95, p99)
- [ ] Detect anomalies (threshold violations, trends)
- [ ] Correlate failures with error codes
- [ ] Produce validation report (markdown + charts)
- [ ] Recommend GO/NO-GO for production

### CI/CD Integration:
- [ ] Configure nightly short-duration stress suite
- [ ] Configure weekly long-duration stress suite
- [ ] Set up automated regression alerts
- [ ] Establish performance baseline tracking

---

**End of Document**

**Next Steps:**
1. Review and approve stress test specification
2. Implement test framework (4-6 hours)
3. Define test case JSON files (2-3 hours)
4. Execute short-duration tests (6 hours)
5. Execute long-duration tests (48 hours passive + 4 hours analysis)
6. Generate validation report and production readiness recommendation

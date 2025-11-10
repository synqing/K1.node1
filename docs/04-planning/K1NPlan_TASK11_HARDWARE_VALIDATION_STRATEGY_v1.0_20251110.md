---
title: "K1.node1 Task 11: Hardware Validation Testing Strategy"
type: "Plan"
project: "K1.node1"
project_code: "K1N"
version: "v1.0"
date: "2025-11-10"
status: "proposed"
intent: "Comprehensive hardware validation framework for graph system on ESP32-S3"
doc_id: "K1NPlan_TASK11_HARDWARE_VALIDATION_STRATEGY_v1.0_20251110"
tags: ["planning","testing","hardware","validation","task11"]
related:
  - "GRAPH_INTEGRATION_TEST_HARNESS_PLAN.md"
  - "firmware/test/README.md"
  - "K1NPlan_TASK_ROADMAP_CORRECTED_v1.0_20251110.md"
---

# K1.node1 Task 11: Hardware Validation Testing Strategy

**Document Status:** PROPOSED - Ready for review and implementation
**Task:** Task 11 - Conduct Hardware Validation Testing
**Phase:** Phase 1 (Graph System Integration)
**Owner:** Quality Engineering + Firmware Team
**Priority:** P0 (Critical path blocker for deployment)

---

## Executive Summary

This document defines a comprehensive hardware validation testing framework for the K1.node1 graph system on ESP32-S3 hardware. The framework verifies LED rendering quality, audio processing accuracy, real-time performance, memory constraints, and power behavior under realistic operating conditions.

**Key Deliverables:**
- Automated hardware test harness (PlatformIO + Unity framework)
- 65+ test cases across 8 validation categories
- Telemetry-driven pass/fail criteria with quantitative thresholds
- CI/CD integration strategy for hardware-in-the-loop (HIL) testing
- Failure analysis and recovery procedures

**Timeline:** 5-7 business days (parallel with Tasks 8-10)
**Risk Level:** MEDIUM (requires physical test equipment and devices)

---

## 1. Hardware Test Categories

### 1.1 LED Driver Integration (RMT Dual-Channel)

**Objective:** Validate WS2812 timing accuracy, dual-channel synchronization, color fidelity

**Test Cases:**
- **TC-LED-001:** Single-channel RMT timing validation (800kHz ±10%)
  - Measure T0H, T0L, T1H, T1L with logic analyzer
  - Expected: Within WS2812 spec (±150ns tolerance)

- **TC-LED-002:** Dual-channel synchronization verification
  - Start both RMT channels within 5µs
  - Validate no interleave corruption (refill callbacks)
  - Expected: Max gap < 50µs, zero tearing artifacts

- **TC-LED-003:** Frame rate stability (30-minute continuous)
  - Target: 180-220 FPS sustained (baseline ~200 FPS)
  - Measure: FPS stddev < 10, no frame drops

- **TC-LED-004:** Color accuracy (8-bit quantization)
  - Input: CRGBF test patterns (primaries, grayscale, pastels)
  - Validate: PhotoResistor or spectrophotometer measurements
  - Expected: RGB values within ±2 LSB after gamma correction

- **TC-LED-005:** Buffer geometry validation
  - Verify: `mem_block_symbols >= 256` for 160 LEDs/channel
  - Test: No buffer overrun under max LED count (320 LEDs)

- **TC-LED-006:** RMT refill probe validation
  - Instrument: `rmt_probe.h` callbacks (mem_empty, trans_done)
  - Expected: `max_gap_us < 100`, refill_count matches frame_count

- **TC-LED-007:** Hot-swap LED strip behavior
  - Test: Disconnect/reconnect strip during rendering
  - Expected: No crash, resume within 1 frame

**Equipment Required:**
- Logic analyzer (Saleae, DSLogic, or similar)
- Calibrated RGB photoresistor or spectrophotometer
- 2x WS2812 LED strips (160 LEDs each, 320 total)
- Oscilloscope (optional, for signal quality validation)

**Pass Criteria:**
- All timing measurements within WS2812 spec
- Zero synchronization failures in 30-minute test
- FPS variance < 5% of baseline
- Color accuracy within ±2 LSB

---

### 1.2 Audio Input (I2S Microphone)

**Objective:** Validate I2S capture reliability, FFT accuracy, sample rate consistency

**Test Cases:**
- **TC-AUDIO-001:** I2S initialization and recovery
  - Test: Normal init, timeout simulation, hot-swap mic
  - Expected: Init < 500ms, timeout fallback to silence, recovery < 1s

- **TC-AUDIO-002:** Sample rate accuracy (44.1kHz)
  - Measure: Actual sample rate via timestamp analysis
  - Expected: 44100 Hz ±0.5% (±220 Hz tolerance)

- **TC-AUDIO-003:** FFT bin accuracy (256-point)
  - Input: Pure sine waves (440 Hz, 1 kHz, 4 kHz, 8 kHz)
  - Expected: Peak bin within ±1 bin of calculated frequency

- **TC-AUDIO-004:** Noise floor validation (silence)
  - Input: No audio (muted mic or silent room)
  - Expected: All bins < -40 dB, no false beat detection

- **TC-AUDIO-005:** Dynamic range (quiet → loud)
  - Input: -30 dBFS to 0 dBFS sweep
  - Expected: Linear response in all bins, no clipping artifacts

- **TC-AUDIO-006:** Beat detection accuracy
  - Input: 120 BPM metronome track (5 minutes)
  - Expected: Detected BPM = 120 ±2, >95% beat accuracy

- **TC-AUDIO-007:** I2S timeout protection
  - Simulate: Hung I2S hardware (disconnect SCK/WS)
  - Expected: Timeout after 100ms, log error, fallback to silence

- **TC-AUDIO-008:** Audio latency measurement
  - Method: LED response to audio impulse (timestamp delta)
  - Expected: < 50ms audio-to-visual latency

**Equipment Required:**
- INMP441 I2S microphone module
- Audio signal generator (phone app or hardware)
- Calibrated SPL meter (for dynamic range tests)
- Audio test tracks (sine sweeps, metronome, silence)

**Pass Criteria:**
- FFT accuracy within ±1 bin for pure tones
- Beat detection accuracy > 95%
- Latency < 50ms
- Zero I2S hangs in 1-hour stress test

---

### 1.3 Memory Constraints (Heap Management)

**Objective:** Validate heap limits, detect fragmentation, prevent allocation failures

**Test Cases:**
- **TC-MEM-001:** Boot-time heap baseline
  - Measure: Free heap after WiFi + pattern init
  - Expected: > 100 KB free heap (ESP32-S3 has ~400 KB DRAM)

- **TC-MEM-002:** Pattern switching memory leak detection
  - Test: Switch between 10 patterns, 100 cycles
  - Expected: Heap delta < 1 KB, no fragmentation growth

- **TC-MEM-003:** Scratch buffer cap validation
  - Verify: Graph patterns use ≤ 64 KB scratch buffer
  - Method: Instrument `graph_runtime.h` malloc calls

- **TC-MEM-004:** Stack safety under deep graph execution
  - Test: Deeply nested graph (10+ nodes)
  - Expected: No stack overflow, watermark < 80% stack size

- **TC-MEM-005:** Heap fragmentation analysis
  - Measure: Largest free block after 1-hour runtime
  - Expected: > 50% of total free heap (no severe fragmentation)

- **TC-MEM-006:** OTA update heap headroom
  - Test: Trigger OTA update during pattern rendering
  - Expected: Update succeeds, heap sufficient for temp buffers

**Equipment Required:**
- ESP32-S3 DevKitC-1 (8MB flash, 2MB PSRAM)
- Serial monitor (115200 baud minimum)
- Heap profiling enabled in build (`-DCORE_DEBUG_LEVEL=3`)

**Pass Criteria:**
- Zero memory leaks in 100-cycle pattern switch test
- Heap fragmentation < 50%
- Stack usage < 80% watermark
- OTA updates succeed under load

---

### 1.4 Real-Time Behavior (Timing & Latency)

**Objective:** Validate frame rate consistency, low-jitter rendering, deterministic timing

**Test Cases:**
- **TC-RT-001:** Frame rate stability (baseline patterns)
  - Test: Bloom, Spectrum patterns for 5 minutes each
  - Expected: 180-220 FPS, stddev < 5 FPS

- **TC-RT-002:** Render stage timing breakdown
  - Measure: `quantize_us`, `pack_us`, `tx_us` per frame
  - Expected: quantize < 500µs, pack < 200µs, tx < 500µs

- **TC-RT-003:** Audio snapshot latency
  - Measure: Time from I2S read to pattern draw start
  - Expected: < 20ms (design target from ADR-XXXX)

- **TC-RT-004:** Frame jitter analysis
  - Measure: Inter-frame time variance (1000 frames)
  - Expected: Jitter < 2ms (95th percentile)

- **TC-RT-005:** Concurrent load (WiFi + rendering)
  - Test: HTTP requests + WebSocket updates during rendering
  - Expected: FPS drop < 10%, request latency < 200ms

- **TC-RT-006:** Worst-case timing (complex graph)
  - Test: 20-node graph with blur + mirror + FFT
  - Expected: Frame time < 10ms (100 FPS minimum)

**Equipment Required:**
- High-precision timestamp logging (`esp_timer_get_time()`)
- WebSocket client for concurrent load testing
- Profiling infrastructure (`profiling.h`, heartbeat logger)

**Pass Criteria:**
- FPS variance < 5% across all test patterns
- Frame jitter < 2ms (95th percentile)
- Audio latency < 20ms
- No missed frames under concurrent WiFi load

---

### 1.5 Power Behavior (Current Draw & Thermal)

**Objective:** Validate power consumption, thermal stability, no runaway current

**Test Cases:**
- **TC-PWR-001:** Idle power consumption
  - State: WiFi connected, no LEDs, pattern = "Off"
  - Expected: < 200 mA @ 5V (ESP32-S3 + WiFi baseline)

- **TC-PWR-002:** Active rendering power (full brightness)
  - State: 320 LEDs @ 100% white
  - Expected: < 2.5A @ 5V (worst case: 60 mA/LED × 320 / 8)

- **TC-PWR-003:** Average power (typical pattern)
  - State: Bloom pattern, 50% brightness, audio active
  - Expected: 0.8-1.2A @ 5V

- **TC-PWR-004:** Thermal stability (30-minute stress)
  - Measure: ESP32-S3 die temperature via internal sensor
  - Expected: < 70°C under continuous load

- **TC-PWR-005:** Power supply brownout protection
  - Test: Drop voltage to 4.5V (USB spec minimum)
  - Expected: System continues operation, no reset

- **TC-PWR-006:** Current spike detection (LED updates)
  - Measure: Peak current during simultaneous RMT TX
  - Expected: No spikes > 3A (power supply capacity)

**Equipment Required:**
- USB power meter (Keysight U1242C or similar)
- Thermal camera or IR thermometer
- Variable bench power supply (0-6V, 3A)
- Current clamp or oscilloscope with current probe

**Pass Criteria:**
- No thermal throttling (temp < 70°C)
- Current draw within PSU limits (< 3A peak)
- No brownout resets at USB minimum voltage (4.5V)
- Power consumption matches datasheet expectations

---

### 1.6 Graph System Integration

**Objective:** Validate codegen correctness, runtime constraints, node behavior

**Test Cases:**
- **TC-GRAPH-001:** Baseline graph execution (Bloom, Spectrum)
  - Verify: Patterns compile, load, execute correctly
  - Expected: Visual match to legacy implementation

- **TC-GRAPH-002:** Stateful node persistence
  - Test: Tempo tracker, peak hold, LPF nodes across frames
  - Expected: State persists, values evolve correctly

- **TC-GRAPH-003:** Single audio snapshot invariant
  - Verify: All nodes use same audio frame (no mid-frame updates)
  - Method: Inject test pattern, verify no tearing

- **TC-GRAPH-004:** RGB clamping (0.0-1.0 range)
  - Test: Nodes outputting out-of-range values
  - Expected: Clamp to [0.0, 1.0] before quantization

- **TC-GRAPH-005:** Scratch buffer bounds checking
  - Test: Graph using max scratch allocation (64 KB)
  - Expected: No heap allocation, no buffer overrun

- **TC-GRAPH-006:** Hot pattern switching
  - Test: Switch patterns every 5 seconds (30 cycles)
  - Expected: No crash, seamless transition, FPS stable

- **TC-GRAPH-007:** Parameter update propagation
  - Test: Change graph param via REST API
  - Expected: Update visible within 1 frame (< 50ms)

- **TC-GRAPH-008:** Error handling (invalid graph)
  - Test: Load graph with cycle, type mismatch, missing node
  - Expected: Reject at compile time, log error, fallback pattern

**Equipment Required:**
- Graph compiler (`k1c build`)
- Test graphs (valid and invalid)
- Visual comparison tools (camera + diffing)

**Pass Criteria:**
- All valid graphs execute correctly (visual match)
- All invalid graphs rejected at compile time
- Zero runtime crashes in 100-cycle pattern switching
- Parameter updates propagate within 1 frame

---

### 1.7 Network & REST API Behavior

**Objective:** Validate API responsiveness, WebSocket stability, rate limiting

**Test Cases:**
- **TC-NET-001:** REST API latency (normal load)
  - Test: GET /api/params, /api/device/performance
  - Expected: Response time < 100ms

- **TC-NET-002:** Rate limiting enforcement
  - Test: Burst 100 requests to single endpoint
  - Expected: Rate limiter triggers, 429 responses

- **TC-NET-003:** WebSocket real-time updates
  - Test: Subscribe to /ws, validate FPS + metrics stream
  - Expected: Updates every 250ms, no message loss

- **TC-NET-004:** Concurrent client handling
  - Test: 5 simultaneous clients (HTTP + WebSocket)
  - Expected: All clients served, FPS drop < 10%

- **TC-NET-005:** mDNS discovery
  - Test: Resolve k1-reinvented.local from network
  - Expected: Resolves to device IP within 2 seconds

- **TC-NET-006:** WiFi reconnect behavior
  - Test: Disconnect WiFi AP, reconnect after 30s
  - Expected: Device reconnects, patterns continue rendering

**Equipment Required:**
- Network test client (Postman, curl, or custom script)
- Multiple client devices (laptop, phone, tablet)
- WiFi AP with control (for disconnect testing)

**Pass Criteria:**
- API latency < 100ms under normal load
- Rate limiting prevents DoS
- WebSocket stability for 1-hour continuous connection
- WiFi reconnect successful within 10 seconds

---

### 1.8 End-to-End System Validation

**Objective:** Validate complete system integration (audio → graph → LEDs)

**Test Cases:**
- **TC-E2E-001:** Audio-reactive rendering
  - Input: 440 Hz sine wave (constant amplitude)
  - Expected: Specific LED indices respond, others dim

- **TC-E2E-002:** Beat synchronization
  - Input: 120 BPM kick drum track
  - Expected: Beat events trigger visual effects in sync

- **TC-E2E-003:** User workflow (web UI)
  - Steps: Connect, select pattern, adjust params, observe LEDs
  - Expected: All actions succeed, visual feedback immediate

- **TC-E2E-004:** Multi-pattern playlist
  - Test: Auto-switch between 5 patterns every 30 seconds
  - Expected: Seamless transitions, no artifacts

- **TC-E2E-005:** Factory reset and reconfiguration
  - Test: Reset device, reconfigure WiFi, load patterns
  - Expected: All state cleared, device operational

- **TC-E2E-006:** Long-duration stability (8-hour soak)
  - Test: Continuous operation overnight
  - Expected: No crashes, memory stable, FPS consistent

**Equipment Required:**
- Complete K1.node1 system (ESP32-S3, LEDs, mic, WiFi)
- Test audio tracks (sine waves, beats, music)
- Automated test script (REST API client)
- Video camera for visual validation

**Pass Criteria:**
- All workflows complete successfully
- 8-hour soak test with zero crashes
- Visual quality matches expectations
- User-reported responsiveness (subjective)

---

## 2. Test Harness Architecture

### 2.1 Hardware Test Harness Design

**Structure:**
```
firmware/test/
├── test_hardware_validation/
│   ├── test_hw_led_driver.cpp        # TC-LED-001 to TC-LED-007
│   ├── test_hw_audio_input.cpp       # TC-AUDIO-001 to TC-AUDIO-008
│   ├── test_hw_memory.cpp            # TC-MEM-001 to TC-MEM-006
│   ├── test_hw_realtime.cpp          # TC-RT-001 to TC-RT-006
│   ├── test_hw_power.cpp             # TC-PWR-001 to TC-PWR-006
│   ├── test_hw_graph_system.cpp      # TC-GRAPH-001 to TC-GRAPH-008
│   ├── test_hw_network.cpp           # TC-NET-001 to TC-NET-006
│   ├── test_hw_e2e.cpp               # TC-E2E-001 to TC-E2E-006
│   └── README.md                     # Test execution guide
├── test_utils/
│   ├── hw_test_helpers.h             # Common test utilities
│   ├── telemetry_capture.h           # Snapshot profiling data
│   ├── audio_signal_gen.h            # Generate test tones
│   └── visual_validator.h            # LED color measurement helpers
└── platformio.ini                    # Test environment config
```

**PlatformIO Test Configuration:**
```ini
[env:esp32-s3-hwtest]
extends = env:esp32-s3-devkitc-1
build_flags =
    ${env:esp32-s3-devkitc-1.build_flags}
    -DDEBUG_TELEMETRY=1              # Enable profiling
    -DHW_TEST_MODE=1                 # Hardware test mode
    -DUNITY_INCLUDE_DOUBLE=1         # Float comparisons
test_framework = unity
test_build_src = yes                 # Include src/ in tests
test_filter = test_hardware_validation
```

---

### 2.2 Automated Test Execution Flow

**Phase 1: Pre-Test Setup (Manual)**
1. Connect ESP32-S3 to USB
2. Attach LED strips (2x 160 LEDs) to GPIO channels
3. Connect INMP441 I2S microphone
4. Prepare audio test signals (PC speakers or signal generator)
5. Connect logic analyzer probes (optional)
6. Connect power meter and thermal sensor

**Phase 2: Automated Test Execution**
```bash
# Run all hardware validation tests
pio test -e esp32-s3-hwtest -f test_hardware_validation

# Run specific category
pio test -e esp32-s3-hwtest -f test_hardware_validation/test_hw_led_driver.cpp

# Capture detailed telemetry
pio test -e esp32-s3-hwtest --verbose
```

**Phase 3: Results Collection**
- Unity framework outputs PASS/FAIL per test case
- Telemetry logged to serial (115200 baud, 2Mbps for debug builds)
- Performance metrics captured via `/api/device/performance`
- Logic analyzer traces saved for timing validation
- Power meter readings logged to CSV

**Phase 4: Analysis and Reporting**
- Generate HTML test report (Unity XML → HTML converter)
- Annotate failures with telemetry data
- Compare against baseline metrics (regression detection)
- Update validation status in tracking system

---

### 2.3 Telemetry Collection Infrastructure

**Leverage Existing Diagnostic Systems:**
1. **Heartbeat Logger** (`diagnostics/heartbeat_logger.h`)
   - Periodic snapshots (1 Hz default)
   - FPS, frame timing, audio counter

2. **RMT Probe** (`diagnostics/rmt_probe.h`)
   - Refill gaps, transmission counts
   - Max gap tracking (µs precision)

3. **Profiling System** (`profiling.h`)
   - Per-section timing (quantize, pack, tx)
   - Cumulative stats (avg, max, count)

4. **REST API Endpoints:**
   - `/api/device/info` → Build signature, uptime
   - `/api/device/performance` → FPS, heap, timings
   - `/api/rmt` → RMT probe counters (if implemented)
   - `/api/params` → Current pattern parameters

**New Telemetry Additions for Hardware Tests:**
```cpp
// firmware/src/diagnostics/hw_test_telemetry.h
struct HwTestMetrics {
    // LED driver
    uint32_t rmt_refill_count;
    uint32_t rmt_max_gap_us;
    float    fps_avg;
    float    fps_stddev;

    // Audio
    uint32_t i2s_timeouts;
    uint32_t audio_frame_count;
    float    fft_peak_freq_hz;

    // Memory
    uint32_t heap_free_min;
    uint32_t heap_fragmentation_pct;
    uint32_t stack_watermark;

    // Power
    float    cpu_temp_celsius;
    float    current_ma;

    // Real-time
    uint32_t frame_jitter_us;
    uint32_t audio_latency_ms;
};

void hw_test_telemetry_snapshot(HwTestMetrics* out);
void hw_test_telemetry_reset();
```

---

## 3. Test Case Specifications

### 3.1 Example Test Case: TC-LED-002 (Dual-Channel Sync)

**Test ID:** TC-LED-002
**Category:** LED Driver Integration
**Objective:** Validate dual-channel RMT synchronization
**Priority:** P0 (Critical)

**Preconditions:**
- ESP32-S3 programmed with RMT dual-channel firmware
- 2x WS2812 strips connected (160 LEDs each)
- RMT probe enabled (`rmt_probe_init()` called)
- Pattern: Solid color (simplifies validation)

**Test Steps:**
1. Reset RMT probe counters
2. Render 1000 frames (Bloom pattern, 50% brightness)
3. Query RMT probe via `/api/rmt` or serial log
4. Validate:
   - `ch1_mem_empty_count == ch2_mem_empty_count` (±5 frames)
   - `ch1_max_gap_us < 50` AND `ch2_max_gap_us < 50`
   - `ch1_trans_done_count == 1000` AND `ch2_trans_done_count == 1000`
5. Visual inspection: No tearing or color shift between channels

**Expected Results:**
- Refill counts match within 5 frames (allows for minor timing variance)
- Max gap < 50µs (ensures no buffer underrun)
- Zero visual artifacts (human validation)

**Pass Criteria:**
```cpp
TEST_ASSERT_UINT32_WITHIN(5, ch1_count, ch2_count);
TEST_ASSERT_LESS_THAN_UINT32(50, ch1_max_gap_us);
TEST_ASSERT_LESS_THAN_UINT32(50, ch2_max_gap_us);
```

**Failure Modes:**
- **Symptom:** `max_gap_us > 50`
  **Cause:** CPU overload, insufficient buffer
  **Action:** Increase `mem_block_symbols`, reduce pattern complexity

- **Symptom:** Refill counts diverge (>10 frames)
  **Cause:** One channel stalled or not starting
  **Action:** Check `rmt_transmit()` call order, validate GPIO config

**Automation Level:** Fully automated (Unity test + REST API query)

---

### 3.2 Example Test Case: TC-AUDIO-006 (Beat Detection)

**Test ID:** TC-AUDIO-006
**Category:** Audio Input
**Objective:** Validate beat detection accuracy
**Priority:** P1 (High)

**Preconditions:**
- ESP32-S3 with INMP441 microphone
- Audio test track: 120 BPM metronome (5 minutes, ±0.1 BPM precision)
- Beat detection enabled in pattern

**Test Steps:**
1. Start audio playback (120 BPM metronome)
2. Reset beat event counters
3. Run for 5 minutes (600 expected beats at 120 BPM)
4. Query beat telemetry:
   - Total beats detected
   - Average BPM
   - Beat timing jitter (stddev)
5. Compare against ground truth (600 beats, 120 BPM)

**Expected Results:**
- Detected BPM: 120 ±2 BPM
- Beat accuracy: > 95% (570+ beats detected out of 600)
- Timing jitter: < 50ms stddev

**Pass Criteria:**
```cpp
TEST_ASSERT_UINT32_WITHIN(12, 600, beats_detected);  // 95% = 570 beats
TEST_ASSERT_FLOAT_WITHIN(2.0, 120.0, avg_bpm);
TEST_ASSERT_LESS_THAN_FLOAT(50.0, beat_jitter_ms);
```

**Failure Modes:**
- **Symptom:** BPM detection off by >5 BPM
  **Cause:** Incorrect FFT bin analysis or tempo tracking
  **Action:** Recalibrate tempo algorithm, verify sample rate

- **Symptom:** Beat accuracy < 90%
  **Cause:** Noise floor too high, threshold misconfigured
  **Action:** Adjust beat detection threshold, verify mic gain

**Automation Level:** Semi-automated (requires manual audio playback, automated analysis)

---

## 4. Expected Outputs & Pass/Fail Criteria

### 4.1 Quantitative Metrics Table

| Metric | Baseline | Target | Tolerance | Failure Threshold |
|--------|----------|--------|-----------|-------------------|
| **FPS (Bloom)** | 200 | 180-220 | ±10% | < 170 or > 230 |
| **FPS Stddev** | 3 | < 5 | N/A | > 10 |
| **RMT Max Gap** | 20µs | < 50µs | ±10µs | > 100µs |
| **Audio Latency** | 15ms | < 20ms | ±5ms | > 50ms |
| **Free Heap (min)** | 120 KB | > 100 KB | -10 KB | < 80 KB |
| **CPU Temp** | 55°C | < 70°C | ±5°C | > 80°C |
| **Current Draw** | 1.0A | < 1.5A | ±0.2A | > 2.5A |
| **Beat Accuracy** | 98% | > 95% | -3% | < 90% |
| **FFT Bin Error** | ±0 bins | ±1 bin | ±0.5 bins | > 2 bins |
| **API Latency** | 50ms | < 100ms | ±20ms | > 200ms |

---

### 4.2 Pass/Fail Decision Matrix

**PASS (All conditions met):**
- All quantitative metrics within target range
- Zero crashes in 30-minute stress test
- Zero memory leaks (heap delta < 1 KB)
- All visual validation tests pass (human inspection)
- Logic analyzer traces within WS2812 spec

**CONDITIONAL PASS (Minor issues, requires review):**
- 1-2 metrics outside target but within tolerance
- Non-critical test failures (e.g., mDNS discovery latency)
- Visual artifacts present but rare (< 1% of frames)

**FAIL (Any condition met):**
- Critical metric exceeds failure threshold (e.g., temp > 80°C)
- System crash or hang during testing
- Memory leak detected (heap delta > 5 KB)
- RMT synchronization failure (tearing visible)
- I2S timeout not recovering

---

### 4.3 Test Report Format

**Hardware Validation Test Report**

```
Date: 2025-11-XX
Device: ESP32-S3 DevKitC-1 (SN: XXXX)
Firmware: v1.0.0 (commit: abcd1234)
Test Suite: Hardware Validation v1.0

=== SUMMARY ===
Total Tests: 65
Passed: 63
Failed: 2
Skipped: 0
Duration: 2h 15m

Overall Status: CONDITIONAL PASS

=== CATEGORY RESULTS ===
LED Driver Integration:    7/7   PASS
Audio Input:               7/8   FAIL (TC-AUDIO-003)
Memory Constraints:        6/6   PASS
Real-Time Behavior:        5/6   FAIL (TC-RT-004)
Power Behavior:            6/6   PASS
Graph System Integration:  8/8   PASS
Network & REST API:        6/6   PASS
End-to-End Validation:     6/6   PASS

=== FAILURES ===
[FAIL] TC-AUDIO-003: FFT bin accuracy
  Expected: 1 kHz → bin 11 (±1)
  Actual:   1 kHz → bin 9 (error: -2 bins)
  Action:   Recalibrate FFT bin calculation

[FAIL] TC-RT-004: Frame jitter analysis
  Expected: Jitter < 2ms (95th percentile)
  Actual:   Jitter = 3.2ms (95th percentile)
  Action:   Investigate WiFi interrupt latency

=== TELEMETRY SNAPSHOT ===
FPS (avg): 198.4 ± 4.2
Heap (free): 112 KB (min: 108 KB)
CPU Temp: 62°C (max: 64°C)
Current Draw: 1.05A (avg)
RMT Ch1 Max Gap: 28µs
RMT Ch2 Max Gap: 31µs

=== RECOMMENDATIONS ===
1. Investigate FFT bin calibration (sample rate drift?)
2. Reduce WiFi interrupt priority to lower frame jitter
3. Re-test after firmware fixes
```

---

## 5. Test Environment Requirements

### 5.1 Hardware Equipment Checklist

**Required (Minimum Viable Testing):**
- [x] ESP32-S3 DevKitC-1 (2x for redundancy)
- [x] 2x WS2812 LED strips (160 LEDs each)
- [x] INMP441 I2S microphone module
- [x] USB power meter (Keysight U1242C or equivalent)
- [x] PC with PlatformIO (USB serial connection)
- [x] WiFi AP (2.4 GHz, known SSID/password)
- [x] Audio signal generator (PC speakers, smartphone, or function generator)

**Optional (Enhanced Validation):**
- [ ] Logic analyzer (Saleae Logic 8, DSLogic Plus)
- [ ] Oscilloscope (100 MHz, 2 channels minimum)
- [ ] Spectrophotometer or calibrated RGB sensor
- [ ] SPL meter (for dynamic range tests)
- [ ] Thermal camera or IR thermometer
- [ ] Variable bench power supply (0-6V, 3A)
- [ ] Video camera (for visual regression recording)

---

### 5.2 Software & Tooling Requirements

**Development Environment:**
- PlatformIO Core 6.1.0+ (CLI or VSCode extension)
- ESP-IDF 5.0+ (for RMT v2 API)
- Python 3.8+ (for test automation scripts)
- Unity Test Framework (auto-installed by PlatformIO)

**Test Automation Scripts:**
```
tools/hw_test/
├── run_hw_validation.py          # Orchestrates all tests
├── analyze_telemetry.py          # Parse serial logs, generate reports
├── audio_test_generator.py       # Generate test tones (sine, metronome)
├── visual_diff.py                # Compare LED output videos
└── requirements.txt              # Python dependencies
```

**Analysis Tools:**
- Saleae Logic 2 (for logic analyzer traces)
- Wireshark (for network packet analysis)
- Excel or Python/Pandas (for metrics visualization)

---

### 5.3 Physical Test Setup Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Hardware Test Bench                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐                                                │
│  │ PC (Ubuntu) │                                                │
│  │  - PlatformIO                                                │
│  │  - Serial Monitor                                            │
│  │  - Test Scripts                   ┌──────────────┐           │
│  │  - Logic Analyzer SW              │ WiFi Router  │           │
│  └───────┬─────┘                     │ (2.4 GHz)    │           │
│          │ USB                        └──────┬───────┘           │
│          │                                   │ WiFi              │
│          v                                   v                   │
│  ┌───────────────────────────────────────────────────┐          │
│  │          ESP32-S3 DevKitC-1                       │          │
│  │  ┌─────────────────────────────────────────────┐ │          │
│  │  │ GPIO 8  → RMT CH0 → LED Strip 1 (160 LEDs) │ │          │
│  │  │ GPIO 9  → RMT CH1 → LED Strip 2 (160 LEDs) │ │          │
│  │  │ GPIO 10 → I2S WS  → INMP441 Mic             │ │          │
│  │  │ GPIO 11 → I2S SCK → INMP441 Mic             │ │          │
│  │  │ GPIO 12 → I2S SD  → INMP441 Mic             │ │          │
│  │  └─────────────────────────────────────────────┘ │          │
│  └───────────────────────────────────────────────────┘          │
│          │ Power (5V, 3A)                                       │
│          v                                                       │
│  ┌───────────────┐                                              │
│  │ USB Power     │                                              │
│  │ Meter         │                                              │
│  │ (Keysight)    │                                              │
│  └───────────────┘                                              │
│                                                                  │
│  ┌───────────────┐         ┌──────────────┐                    │
│  │ Audio Signal  │────────>│ Speaker      │                    │
│  │ Generator     │  3.5mm  │ (near mic)   │                    │
│  │ (PC/Phone)    │         └──────────────┘                    │
│  └───────────────┘                                              │
│                                                                  │
│  Optional:                                                       │
│  ┌───────────────┐                                              │
│  │ Logic Analyzer│ → Probes on GPIO 8, 9 (RMT signals)         │
│  │ (Saleae)      │                                              │
│  └───────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Automation Strategy & CI/CD Integration

### 6.1 Hardware-in-the-Loop (HIL) Testing

**Challenge:** CI/CD systems (GitHub Actions, GitLab CI) don't have direct access to physical ESP32-S3 devices.

**Solution: Self-Hosted Runner + Test Bench**

1. **Self-Hosted Runner Setup:**
   - Deploy Raspberry Pi 4 or Linux PC as GitHub Actions runner
   - Connect ESP32-S3 via USB hub (supports multiple devices)
   - Install PlatformIO CLI, USB drivers, serial tools

2. **Automated Test Workflow:**
```yaml
# .github/workflows/hardware-validation.yml
name: Hardware Validation Tests

on:
  push:
    branches: [main, develop]
    paths: ['firmware/**', 'codegen/**']
  pull_request:
    paths: ['firmware/**']

jobs:
  hardware-tests:
    runs-on: [self-hosted, esp32-s3-test-bench]

    steps:
      - uses: actions/checkout@v3

      - name: Setup PlatformIO
        run: pip install platformio

      - name: Build Firmware (HW Test Mode)
        run: |
          cd firmware
          pio run -e esp32-s3-hwtest

      - name: Upload Firmware to Device
        run: |
          pio run -e esp32-s3-hwtest -t upload

      - name: Run Hardware Validation Suite
        run: |
          pio test -e esp32-s3-hwtest -f test_hardware_validation

      - name: Collect Telemetry
        run: |
          python tools/hw_test/analyze_telemetry.py > hw_test_report.txt

      - name: Upload Test Report
        uses: actions/upload-artifact@v3
        with:
          name: hw-test-report
          path: hw_test_report.txt

      - name: Check Test Results
        run: |
          if grep -q "FAIL" hw_test_report.txt; then
            echo "Hardware tests failed!"
            exit 1
          fi
```

---

### 6.2 CI/CD Test Stages

**Stage 1: Build Validation (Fast, no hardware)**
- Compile firmware with graph codegen
- Run unit tests (CPU-only)
- Static analysis (cppcheck, clang-tidy)
- Duration: 2-5 minutes

**Stage 2: Simulation Tests (Moderate, QEMU or native)**
- Graph runtime tests (CPU simulation)
- Memory allocation tests
- Timing analysis (mock peripherals)
- Duration: 5-10 minutes

**Stage 3: Hardware Smoke Tests (Critical path only)**
- LED basic rendering (single pattern)
- Audio capture (single tone)
- REST API health check
- Duration: 5 minutes
- Trigger: On every commit to main/develop

**Stage 4: Full Hardware Validation (Comprehensive)**
- All 65 test cases
- 30-minute stress tests
- Power and thermal measurements
- Duration: 2-3 hours
- Trigger: Nightly builds, pre-release tags

---

### 6.3 Test Failure Handling

**On Test Failure:**
1. CI job fails and blocks PR merge
2. Test report uploaded as artifact (download for analysis)
3. Telemetry logs attached to issue tracker
4. Notification sent to firmware team (Slack, email)

**Developer Workflow:**
1. Download test report and telemetry
2. Reproduce failure locally (connect ESP32-S3)
3. Fix issue, commit changes
4. CI re-runs hardware tests
5. Merge allowed only after all tests pass

**Flaky Test Mitigation:**
- Retry failed tests up to 3 times (detect transient failures)
- Flag tests with >10% failure rate for review
- Quarantine flaky tests (run but don't block CI)

---

## 7. Success Criteria Summary

### 7.1 Test Coverage Requirements

- **Minimum Coverage:** 60/65 tests passing (92%)
- **Critical Path Coverage:** 100% (LED, audio, graph integration)
- **Code Coverage:** Not applicable (hardware validation, not unit tests)

### 7.2 Quality Gates

**Gate 1: LED Rendering Quality**
- [ ] Dual-channel sync validated (no tearing)
- [ ] Color accuracy within ±2 LSB
- [ ] FPS stability (stddev < 5)

**Gate 2: Audio Processing Accuracy**
- [ ] FFT bin accuracy ±1 bin
- [ ] Beat detection > 95% accuracy
- [ ] I2S timeout protection functional

**Gate 3: System Stability**
- [ ] Zero crashes in 30-minute stress test
- [ ] Memory leak-free (heap delta < 1 KB)
- [ ] Thermal stability (< 70°C)

**Gate 4: Graph System Integration**
- [ ] All baseline graphs execute correctly
- [ ] No runtime crashes in 100-cycle pattern switching
- [ ] Parameter updates propagate within 1 frame

---

### 7.3 Deployment Readiness Checklist

- [ ] All critical test cases passing
- [ ] Hardware validation report reviewed and approved
- [ ] Performance metrics meet or exceed targets
- [ ] No known critical bugs in issue tracker
- [ ] Documentation updated (user guide, API reference)
- [ ] Firmware signed and versioned (v1.0.0 release candidate)
- [ ] Rollback procedure tested and documented

---

## 8. Risk Assessment & Mitigation

### 8.1 High-Risk Failure Modes

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| **RMT dual-channel desync** | MEDIUM | CRITICAL | Add strict timing validation; fall back to single-channel if sync fails |
| **I2S hang (no timeout)** | LOW | CRITICAL | Implement bounded waits; watchdog reset after 3 consecutive failures |
| **Thermal runaway** | LOW | HIGH | Add temp monitoring; throttle FPS if temp > 75°C |
| **Memory fragmentation** | MEDIUM | MEDIUM | Use fixed-size buffers; avoid dynamic allocation in hot paths |
| **WiFi interference** | HIGH | LOW | Isolate WiFi task on Core 0; validate FPS drop < 10% under network load |
| **Power supply brownout** | MEDIUM | MEDIUM | Brownout protection enabled; validate 4.5V operation |

---

### 8.2 Hardware-Specific Risks

**Risk: Test Equipment Unavailable**
- **Impact:** Cannot run logic analyzer or power meter tests
- **Mitigation:** Prioritize software-observable metrics (telemetry, REST API)
- **Fallback:** Use oscilloscope or manual multimeter measurements

**Risk: Audio Test Environment Too Noisy**
- **Impact:** FFT accuracy and beat detection tests fail
- **Mitigation:** Use direct line-in connection (bypass mic, inject signal via I2S)
- **Fallback:** Use known-good audio samples (embedded test vectors)

**Risk: LED Strip Hardware Variability**
- **Impact:** Color accuracy tests inconsistent across devices
- **Mitigation:** Use calibrated reference strip; measure relative error, not absolute
- **Fallback:** Visual inspection by human operator (subjective but reliable)

---

### 8.3 Regression Prevention

**Baseline Metrics Tracking:**
- Capture baseline metrics for each firmware version
- Store in version control (JSON format, under `firmware/test/baselines/`)
- CI compares new results against baseline; flag regressions > 10%

**Example Baseline File:**
```json
{
  "firmware_version": "v1.0.0",
  "commit": "abcd1234",
  "date": "2025-11-10",
  "metrics": {
    "fps_bloom_avg": 198.4,
    "fps_bloom_stddev": 4.2,
    "rmt_ch1_max_gap_us": 28,
    "audio_latency_ms": 15,
    "heap_free_min_kb": 112,
    "cpu_temp_max_c": 64
  }
}
```

**Automated Regression Detection:**
```python
# tools/hw_test/check_regression.py
def check_regression(baseline, current):
    for metric, baseline_val in baseline.items():
        current_val = current.get(metric)
        delta_pct = abs(current_val - baseline_val) / baseline_val * 100
        if delta_pct > 10:
            print(f"REGRESSION: {metric} changed by {delta_pct:.1f}%")
            return False
    return True
```

---

## 9. Failure Recovery Procedures

### 9.1 Test Failure Triage Process

**Step 1: Categorize Failure**
- **Transient:** Failure disappears on retry → Flag as flaky
- **Reproducible:** Failure consistent across runs → Critical bug
- **Environmental:** Failure due to test setup (e.g., noisy mic) → Fix test

**Step 2: Root Cause Analysis**
1. Collect telemetry logs (serial output, REST API snapshots)
2. Compare metrics against baseline
3. Identify divergence point (which subsystem failed?)
4. Isolate failure to specific code path (use profiling data)

**Step 3: Fix and Validate**
1. Implement fix in firmware
2. Re-run failed test case locally
3. Run full test suite (ensure no regressions)
4. Update baseline if expected behavior changed

---

### 9.2 Emergency Rollback Procedure

**Trigger:** Critical test failure in production firmware

**Steps:**
1. **Halt Deployment:** Stop firmware distribution immediately
2. **Rollback to Last Known Good (LKG):**
   - Identify LKG version from test history
   - Flash LKG firmware to all deployed devices (OTA)
3. **Root Cause Analysis:**
   - Analyze failed tests and telemetry
   - Reproduce failure in lab environment
4. **Hotfix Development:**
   - Fix critical bug
   - Re-run full hardware validation suite
   - Deploy hotfix only after all tests pass

**Rollback Automation:**
```bash
# tools/hw_test/emergency_rollback.sh
#!/bin/bash
LKG_VERSION="v0.9.5"  # Last known good version
DEVICE_IP="192.168.1.104"

echo "Rolling back to $LKG_VERSION"
pio run -e esp32-s3-devkitc-1-ota -t upload --upload-port $DEVICE_IP

# Validate rollback
curl http://$DEVICE_IP/api/device/info | grep $LKG_VERSION
if [ $? -eq 0 ]; then
    echo "Rollback successful"
else
    echo "Rollback FAILED"
    exit 1
fi
```

---

## 10. Timeline & Resource Allocation

### 10.1 Task Breakdown & Effort Estimates

| Task | Owner | Effort (days) | Dependencies |
|------|-------|---------------|--------------|
| **Hardware test harness development** | QA Engineer | 2 days | Test environment setup |
| **Test case implementation (65 cases)** | QA + Firmware | 3 days | Harness complete |
| **Telemetry enhancements** | Firmware Engineer | 1 day | Parallel with test cases |
| **CI/CD integration (self-hosted runner)** | DevOps | 1 day | Test harness validated |
| **Baseline metrics collection** | QA Engineer | 0.5 days | All tests passing |
| **Test execution (full suite)** | QA Engineer | 0.5 days | Automated |
| **Failure analysis and fixes** | Firmware Team | 1 day | Test results available |
| **Documentation and handoff** | QA + Tech Writer | 0.5 days | All tests passing |

**Total Duration:** 5-7 business days (some tasks parallel)

---

### 10.2 Resource Requirements

**Personnel:**
- 1x QA Engineer (lead, test harness development)
- 1x Firmware Engineer (telemetry, failure fixes)
- 0.5x DevOps Engineer (CI/CD integration)
- 0.25x Tech Writer (documentation)

**Hardware:**
- 2x ESP32-S3 DevKitC-1 ($10 each)
- 2x INMP441 I2S microphone ($5 each)
- 4x WS2812 LED strips (320 LEDs total, $40)
- 1x USB power meter ($100)
- 1x Logic analyzer (optional, $50-200)

**Total Budget:** $200-300 (hardware), ~8 person-days (labor)

---

### 10.3 Milestone Dates (Example Schedule)

**Week 1 (November 11-15, 2025):**
- Day 1-2: Test harness development, environment setup
- Day 3-4: Implement 65 test cases
- Day 5: First full test run, collect baseline metrics

**Week 2 (November 18-22, 2025):**
- Day 1-2: Fix failures, re-run tests
- Day 3: CI/CD integration, automated nightly builds
- Day 4: Documentation, final validation
- Day 5: Handoff to stakeholders, deploy to production

**Milestone Gate:** All critical tests passing by November 20, 2025

---

## 11. Appendices

### 11.1 Glossary

- **HIL:** Hardware-in-the-Loop testing (automated tests on physical devices)
- **RMT:** Remote Control peripheral (ESP32-S3 hardware for WS2812 timing)
- **CRGBF:** Color RGB Float (internal LED color representation)
- **FFT:** Fast Fourier Transform (audio frequency analysis)
- **Unity:** Embedded C unit testing framework (used by PlatformIO)
- **LSB:** Least Significant Bit (8-bit color quantization error unit)

---

### 11.2 References

- **K1.node1 Architecture Spec:** `docs/01-architecture/K1NArch_SPEC_LUT_SYSTEM_ARCHITECTURE_v1.0_20251108.md`
- **Graph Integration Test Plan:** `docs/09-implementation/GRAPH_INTEGRATION_TEST_HARNESS_PLAN.md`
- **Existing Test Suite:** `firmware/test/README.md`
- **RMT Probe Implementation:** `firmware/src/diagnostics/rmt_probe.h`
- **Profiling Infrastructure:** `firmware/src/profiling.h`
- **CLAUDE.md Guidelines:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/CLAUDE.md`

---

### 11.3 Related ADRs

- **ADR-0018:** Dual-Channel LED Architecture (RMT synchronization)
- **ADR-0019:** Conductor Deployment Resilience (OTA + rollback)
- **ADR-00XX:** Hardware Validation Quality Gates (to be created)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v1.0 | 2025-11-10 | QA + Firmware Team | Initial hardware validation strategy |

---

**Next Steps:**
1. Review this plan with stakeholders (firmware, QA, product)
2. Approve hardware equipment purchase ($200-300)
3. Begin test harness development (Week of November 11)
4. Execute first full validation run (November 15)
5. Iterate on failures, achieve 100% critical path coverage (November 20)

**Questions? Contact:** QA Team Lead or Firmware Architect

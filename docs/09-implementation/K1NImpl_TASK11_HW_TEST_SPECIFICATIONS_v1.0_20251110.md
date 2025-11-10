---
title: "K1.node1 Task 11: Hardware Test Case Specifications"
type: "Implementation"
project: "K1.node1"
project_code: "K1N"
version: "v1.0"
date: "2025-11-10"
status: "draft"
intent: "Detailed test case specifications for hardware validation"
doc_id: "K1NImpl_TASK11_HW_TEST_SPECIFICATIONS_v1.0_20251110"
tags: ["implementation","testing","hardware","specifications"]
related:
  - "K1NPlan_TASK11_HARDWARE_VALIDATION_STRATEGY_v1.0_20251110.md"
  - "firmware/test/README.md"
---

# K1.node1 Task 11: Hardware Test Case Specifications

**Document Status:** DRAFT - Implementation reference for test developers
**Companion Document:** K1NPlan_TASK11_HARDWARE_VALIDATION_STRATEGY_v1.0_20251110.md

---

## Quick Reference: Test Case Index

### LED Driver Integration (7 tests)
- TC-LED-001: Single-channel RMT timing validation
- TC-LED-002: Dual-channel synchronization verification
- TC-LED-003: Frame rate stability (30-minute continuous)
- TC-LED-004: Color accuracy (8-bit quantization)
- TC-LED-005: Buffer geometry validation
- TC-LED-006: RMT refill probe validation
- TC-LED-007: Hot-swap LED strip behavior

### Audio Input (8 tests)
- TC-AUDIO-001: I2S initialization and recovery
- TC-AUDIO-002: Sample rate accuracy (44.1kHz)
- TC-AUDIO-003: FFT bin accuracy (256-point)
- TC-AUDIO-004: Noise floor validation (silence)
- TC-AUDIO-005: Dynamic range (quiet → loud)
- TC-AUDIO-006: Beat detection accuracy
- TC-AUDIO-007: I2S timeout protection
- TC-AUDIO-008: Audio latency measurement

### Memory Constraints (6 tests)
- TC-MEM-001: Boot-time heap baseline
- TC-MEM-002: Pattern switching memory leak detection
- TC-MEM-003: Scratch buffer cap validation
- TC-MEM-004: Stack safety under deep graph execution
- TC-MEM-005: Heap fragmentation analysis
- TC-MEM-006: OTA update heap headroom

### Real-Time Behavior (6 tests)
- TC-RT-001: Frame rate stability (baseline patterns)
- TC-RT-002: Render stage timing breakdown
- TC-RT-003: Audio snapshot latency
- TC-RT-004: Frame jitter analysis
- TC-RT-005: Concurrent load (WiFi + rendering)
- TC-RT-006: Worst-case timing (complex graph)

### Power Behavior (6 tests)
- TC-PWR-001: Idle power consumption
- TC-PWR-002: Active rendering power (full brightness)
- TC-PWR-003: Average power (typical pattern)
- TC-PWR-004: Thermal stability (30-minute stress)
- TC-PWR-005: Power supply brownout protection
- TC-PWR-006: Current spike detection (LED updates)

### Graph System Integration (8 tests)
- TC-GRAPH-001: Baseline graph execution (Bloom, Spectrum)
- TC-GRAPH-002: Stateful node persistence
- TC-GRAPH-003: Single audio snapshot invariant
- TC-GRAPH-004: RGB clamping (0.0-1.0 range)
- TC-GRAPH-005: Scratch buffer bounds checking
- TC-GRAPH-006: Hot pattern switching
- TC-GRAPH-007: Parameter update propagation
- TC-GRAPH-008: Error handling (invalid graph)

### Network & REST API (6 tests)
- TC-NET-001: REST API latency (normal load)
- TC-NET-002: Rate limiting enforcement
- TC-NET-003: WebSocket real-time updates
- TC-NET-004: Concurrent client handling
- TC-NET-005: mDNS discovery
- TC-NET-006: WiFi reconnect behavior

### End-to-End Validation (6 tests)
- TC-E2E-001: Audio-reactive rendering
- TC-E2E-002: Beat synchronization
- TC-E2E-003: User workflow (web UI)
- TC-E2E-004: Multi-pattern playlist
- TC-E2E-005: Factory reset and reconfiguration
- TC-E2E-006: Long-duration stability (8-hour soak)

**Total:** 65 test cases

---

## Detailed Test Specifications

### TC-LED-001: Single-Channel RMT Timing Validation

**Category:** LED Driver Integration
**Priority:** P0 (Critical)
**Automation:** Manual (requires logic analyzer)
**Duration:** 10 minutes

**Objective:** Validate WS2812 timing compliance for RMT channel output

**Preconditions:**
- ESP32-S3 programmed with RMT firmware (single-channel mode)
- WS2812 LED strip connected to GPIO 8
- Logic analyzer probes connected to GPIO 8
- Pattern: Solid color (alternating 0x00, 0xFF values for clear waveforms)

**Test Procedure:**
1. Configure logic analyzer:
   - Sample rate: 10 MHz minimum
   - Trigger: Rising edge on GPIO 8
   - Capture: 1000 WS2812 bits (10 LEDs × 24 bits/LED × 4)

2. Start LED rendering (Bloom pattern, 50% brightness)

3. Capture 5 seconds of RMT output

4. Analyze captured waveforms:
   - Measure T0H (0 bit, high time): Expected 400ns ±150ns
   - Measure T0L (0 bit, low time): Expected 850ns ±150ns
   - Measure T1H (1 bit, high time): Expected 800ns ±150ns
   - Measure T1L (1 bit, low time): Expected 450ns ±150ns
   - Measure reset pulse (low time): Expected > 50µs

5. Calculate timing error statistics:
   - Mean error per timing parameter
   - Maximum deviation from spec
   - Percentage of bits outside tolerance

**Expected Results:**
- T0H: 400ns ±150ns (250-550ns)
- T0L: 850ns ±150ns (700-1000ns)
- T1H: 800ns ±150ns (650-950ns)
- T1L: 450ns ±150ns (300-600ns)
- Reset: > 50µs (typically 280µs between frames)
- Error rate: < 1% of bits outside tolerance

**Pass Criteria:**
```
All timing measurements within WS2812 spec
Error rate < 1%
No visual artifacts (color shifts, flickering)
```

**Failure Analysis:**
- **Symptom:** T0H/T0L outside tolerance
  **Cause:** Incorrect RMT clock divider
  **Fix:** Recalculate divider (APB_CLK / target_freq)

- **Symptom:** Reset pulse < 50µs
  **Cause:** Frame rate too high
  **Fix:** Add inter-frame delay

**Implementation Notes:**
```cpp
// firmware/test/test_hardware_validation/test_hw_led_driver.cpp
void test_led_001_single_channel_timing() {
    // Manual test - requires logic analyzer
    TEST_MESSAGE("Connect logic analyzer to GPIO 8");
    TEST_MESSAGE("Capture 5 seconds of RMT output");
    TEST_MESSAGE("Analyze timing parameters vs. WS2812 spec");
    TEST_MESSAGE("Verify T0H, T0L, T1H, T1L within tolerance");

    // This test provides guidance but cannot auto-validate
    // Operator must confirm timing visually or via analyzer export
    TEST_PASS_MESSAGE("Manual validation required");
}
```

---

### TC-LED-002: Dual-Channel Synchronization Verification

**Category:** LED Driver Integration
**Priority:** P0 (Critical)
**Automation:** Full (REST API + telemetry)
**Duration:** 5 minutes

**Objective:** Validate RMT dual-channel synchronization (no tearing)

**Preconditions:**
- ESP32-S3 with dual-channel RMT firmware
- 2x WS2812 strips (160 LEDs each) on GPIO 8, GPIO 9
- RMT probe enabled (`rmt_probe_init()` called)
- Pattern: Bloom (typical workload)

**Test Procedure:**
1. Reset RMT probe counters:
   ```bash
   curl -X POST http://k1-reinvented.local/api/diagnostics/reset
   ```

2. Render 1000 frames (approximately 5 seconds at 200 FPS)

3. Query RMT probe telemetry:
   ```bash
   curl http://k1-reinvented.local/api/rmt
   ```

4. Extract metrics:
   - `ch1_mem_empty_count`: Channel 1 refill count
   - `ch2_mem_empty_count`: Channel 2 refill count
   - `ch1_max_gap_us`: Max gap between refills (channel 1)
   - `ch2_max_gap_us`: Max gap between refills (channel 2)
   - `ch1_trans_done_count`: Channel 1 transmission count
   - `ch2_trans_done_count`: Channel 2 transmission count

5. Visual inspection: Observer watches both LED strips for tearing

**Expected Results:**
- Refill counts match: `abs(ch1_count - ch2_count) <= 5`
- Max gap < 50µs for both channels
- Transmission counts equal: `ch1_trans_done == ch2_trans_done == 1000`
- No visible tearing or color shift between channels

**Pass Criteria:**
```cpp
TEST_ASSERT_UINT32_WITHIN(5, ch1_mem_empty_count, ch2_mem_empty_count);
TEST_ASSERT_LESS_THAN_UINT32(50, ch1_max_gap_us);
TEST_ASSERT_LESS_THAN_UINT32(50, ch2_max_gap_us);
TEST_ASSERT_EQUAL_UINT32(1000, ch1_trans_done_count);
TEST_ASSERT_EQUAL_UINT32(1000, ch2_trans_done_count);
```

**Failure Analysis:**
- **Symptom:** `max_gap_us > 50`
  **Cause:** Insufficient buffer size or CPU overload
  **Fix:** Increase `mem_block_symbols`, reduce pattern complexity

- **Symptom:** Refill counts diverge (>10 frames)
  **Cause:** One channel not starting or stalled
  **Fix:** Verify `rmt_transmit()` calls synchronized

- **Symptom:** Visual tearing
  **Cause:** Channels starting at different times
  **Fix:** Use critical section or hardware sync signal

**Implementation:**
```cpp
// firmware/test/test_hardware_validation/test_hw_led_driver.cpp
void test_led_002_dual_channel_sync() {
    // Reset probe counters
    const RmtProbe *ch1, *ch2;
    rmt_probe_get(&ch1, &ch2);

    // Render 1000 frames
    for (int i = 0; i < 1000; i++) {
        render_frame();  // Triggers dual-channel RMT transmit
        delay(5);        // Approximate 200 FPS
    }

    // Validate synchronization
    TEST_ASSERT_UINT32_WITHIN(5, ch1->mem_empty_count, ch2->mem_empty_count);
    TEST_ASSERT_LESS_THAN_UINT32(50, ch1->max_gap_us);
    TEST_ASSERT_LESS_THAN_UINT32(50, ch2->max_gap_us);

    // Visual validation (manual)
    TEST_MESSAGE("Visually inspect both LED strips for tearing artifacts");
}
```

---

### TC-AUDIO-003: FFT Bin Accuracy (256-point)

**Category:** Audio Input
**Priority:** P1 (High)
**Automation:** Semi-automated (manual audio playback, automated analysis)
**Duration:** 15 minutes

**Objective:** Validate FFT frequency resolution and bin accuracy

**Preconditions:**
- ESP32-S3 with INMP441 I2S microphone
- Audio signal generator (pure sine waves)
- Sample rate: 44.1 kHz
- FFT size: 256 points
- Test frequencies: 440 Hz, 1 kHz, 4 kHz, 8 kHz

**Test Procedure:**
1. For each test frequency:
   - Generate pure sine wave (0 dBFS, 10 seconds)
   - Play audio through speaker near microphone
   - Capture 100 FFT frames
   - Identify peak bin and magnitude

2. Calculate expected bin index:
   ```
   bin_index = round(frequency / (sample_rate / fft_size))
   Example: 1 kHz → round(1000 / (44100 / 256)) = round(5.8) = 6
   ```

3. Compare detected peak bin against expected bin

4. Validate magnitude (should be dominant peak)

**Test Cases:**

| Frequency | Expected Bin | Tolerance | Min Magnitude |
|-----------|--------------|-----------|---------------|
| 440 Hz    | 3            | ±1 bin    | > -10 dB      |
| 1000 Hz   | 6            | ±1 bin    | > -10 dB      |
| 4000 Hz   | 23           | ±1 bin    | > -10 dB      |
| 8000 Hz   | 46           | ±1 bin    | > -10 dB      |

**Expected Results:**
- Peak bin matches expected bin (±1 bin tolerance)
- Magnitude > -10 dB (relative to full scale)
- No spurious peaks > -20 dB

**Pass Criteria:**
```cpp
TEST_ASSERT_INT8_WITHIN(1, expected_bin, detected_bin);
TEST_ASSERT_GREATER_THAN_FLOAT(-10.0, peak_magnitude_db);
```

**Failure Analysis:**
- **Symptom:** Detected bin off by >2 bins
  **Cause:** Sample rate drift or FFT size mismatch
  **Fix:** Calibrate sample rate, verify FFT configuration

- **Symptom:** Peak magnitude < -20 dB
  **Cause:** Microphone gain too low or audio source too quiet
  **Fix:** Increase mic gain or speaker volume

**Implementation:**
```cpp
// firmware/test/test_hardware_validation/test_hw_audio_input.cpp
void test_audio_003_fft_accuracy() {
    struct TestCase {
        uint16_t freq_hz;
        uint8_t expected_bin;
    };

    TestCase cases[] = {
        {440,  3},
        {1000, 6},
        {4000, 23},
        {8000, 46}
    };

    for (auto& tc : cases) {
        TEST_MESSAGE_F("Testing %u Hz (expected bin %u)", tc.freq_hz, tc.expected_bin);

        // Manual step: Play sine wave
        TEST_MESSAGE_F("Play %u Hz sine wave for 10 seconds", tc.freq_hz);
        delay(10000);

        // Capture FFT data
        uint8_t detected_bin = capture_fft_peak_bin();

        // Validate
        TEST_ASSERT_INT8_WITHIN(1, tc.expected_bin, detected_bin);
    }
}
```

---

### TC-MEM-002: Pattern Switching Memory Leak Detection

**Category:** Memory Constraints
**Priority:** P0 (Critical)
**Automation:** Full (automated via REST API)
**Duration:** 10 minutes

**Objective:** Detect memory leaks during pattern switching

**Preconditions:**
- ESP32-S3 with graph system firmware
- 10 test patterns loaded (Bloom, Spectrum, + 8 others)
- Heap monitoring enabled

**Test Procedure:**
1. Record baseline heap:
   ```bash
   HEAP_START=$(curl -s http://k1-reinvented.local/api/device/performance | jq '.heap_free')
   ```

2. Switch patterns 100 times (10 patterns × 10 cycles):
   ```bash
   for i in {1..100}; do
       PATTERN_ID=$((i % 10))
       curl -X POST http://k1-reinvented.local/api/pattern \
            -d "{\"id\": $PATTERN_ID}"
       sleep 2  # Allow pattern to stabilize
   done
   ```

3. Record final heap:
   ```bash
   HEAP_END=$(curl -s http://k1-reinvented.local/api/device/performance | jq '.heap_free')
   ```

4. Calculate heap delta:
   ```bash
   HEAP_DELTA=$((HEAP_START - HEAP_END))
   ```

5. Validate heap delta < 1 KB (1024 bytes)

**Expected Results:**
- Heap delta: -1024 to +1024 bytes
- No heap fragmentation growth
- Largest free block remains > 50% of total free heap

**Pass Criteria:**
```cpp
TEST_ASSERT_INT32_WITHIN(1024, 0, heap_delta_bytes);
TEST_ASSERT_GREATER_THAN_UINT32(total_free_heap / 2, largest_free_block);
```

**Failure Analysis:**
- **Symptom:** Heap delta > 5 KB
  **Cause:** Pattern not freeing resources on unload
  **Fix:** Add destructor or cleanup function to pattern class

- **Symptom:** Largest free block shrinking
  **Cause:** Heap fragmentation
  **Fix:** Use fixed-size memory pools, avoid dynamic allocation

**Implementation:**
```cpp
// firmware/test/test_hardware_validation/test_hw_memory.cpp
void test_mem_002_pattern_switching_leak() {
    uint32_t heap_start = ESP.getFreeHeap();
    uint32_t largest_start = ESP.getMaxAllocHeap();

    // Switch patterns 100 times
    for (int i = 0; i < 100; i++) {
        uint8_t pattern_id = i % 10;
        set_pattern(pattern_id);
        delay(2000);  // Allow pattern to stabilize
    }

    uint32_t heap_end = ESP.getFreeHeap();
    uint32_t largest_end = ESP.getMaxAllocHeap();

    int32_t heap_delta = heap_start - heap_end;

    TEST_ASSERT_INT32_WITHIN(1024, 0, heap_delta);
    TEST_ASSERT_GREATER_THAN_UINT32(heap_end / 2, largest_end);

    Serial.printf("Heap delta: %d bytes\n", heap_delta);
    Serial.printf("Largest block: %u -> %u bytes\n", largest_start, largest_end);
}
```

---

### TC-RT-004: Frame Jitter Analysis

**Category:** Real-Time Behavior
**Priority:** P1 (High)
**Automation:** Full (telemetry-based)
**Duration:** 5 minutes

**Objective:** Measure inter-frame timing variance (jitter)

**Preconditions:**
- ESP32-S3 with profiling enabled (`DEBUG_TELEMETRY=1`)
- Pattern: Bloom (typical workload)
- No concurrent WiFi load

**Test Procedure:**
1. Reset profiling counters:
   ```cpp
   ProfileScope::reset_all();
   ```

2. Capture 1000 frame timestamps:
   ```cpp
   uint64_t timestamps[1000];
   for (int i = 0; i < 1000; i++) {
       timestamps[i] = esp_timer_get_time();
       render_frame();
   }
   ```

3. Calculate inter-frame times:
   ```cpp
   uint32_t deltas[999];
   for (int i = 0; i < 999; i++) {
       deltas[i] = timestamps[i+1] - timestamps[i];
   }
   ```

4. Compute statistics:
   - Mean inter-frame time
   - Standard deviation
   - 95th percentile jitter

5. Validate jitter < 2ms (95th percentile)

**Expected Results:**
- Mean inter-frame time: ~5ms (200 FPS)
- Stddev: < 1ms
- 95th percentile jitter: < 2ms
- No frames > 10ms (dropped frames)

**Pass Criteria:**
```cpp
TEST_ASSERT_LESS_THAN_UINT32(2000, jitter_95th_percentile_us);
TEST_ASSERT_LESS_THAN_FLOAT(1.0, stddev_ms);
```

**Failure Analysis:**
- **Symptom:** Jitter > 5ms
  **Cause:** WiFi interrupts or FreeRTOS task preemption
  **Fix:** Pin render task to Core 1, reduce WiFi interrupt priority

- **Symptom:** Occasional 10ms+ spikes
  **Cause:** Garbage collection or heap fragmentation
  **Fix:** Preallocate buffers, avoid dynamic allocation

**Implementation:**
```cpp
// firmware/test/test_hardware_validation/test_hw_realtime.cpp
void test_rt_004_frame_jitter() {
    const int NUM_FRAMES = 1000;
    uint64_t timestamps[NUM_FRAMES];

    // Capture frame timestamps
    for (int i = 0; i < NUM_FRAMES; i++) {
        timestamps[i] = esp_timer_get_time();
        render_frame();
    }

    // Calculate inter-frame times
    uint32_t deltas[NUM_FRAMES - 1];
    for (int i = 0; i < NUM_FRAMES - 1; i++) {
        deltas[i] = timestamps[i+1] - timestamps[i];
    }

    // Compute statistics
    float mean = compute_mean(deltas, NUM_FRAMES - 1);
    float stddev = compute_stddev(deltas, NUM_FRAMES - 1, mean);
    uint32_t p95 = compute_percentile(deltas, NUM_FRAMES - 1, 0.95);

    TEST_ASSERT_LESS_THAN_FLOAT(1.0, stddev / 1000.0);  // < 1ms
    TEST_ASSERT_LESS_THAN_UINT32(2000, p95);            // < 2ms

    Serial.printf("Jitter: mean=%.2fms, stddev=%.2fms, 95th=%.2fms\n",
                  mean/1000.0, stddev/1000.0, p95/1000.0);
}
```

---

### TC-GRAPH-006: Hot Pattern Switching

**Category:** Graph System Integration
**Priority:** P0 (Critical)
**Automation:** Full (REST API loop)
**Duration:** 5 minutes

**Objective:** Validate seamless pattern transitions without crashes

**Preconditions:**
- ESP32-S3 with graph system firmware
- 6 test patterns loaded (Bloom, Spectrum, 4 others)
- FPS monitoring enabled

**Test Procedure:**
1. Record baseline FPS:
   ```bash
   FPS_START=$(curl -s http://k1-reinvented.local/api/device/performance | jq '.fps')
   ```

2. Switch patterns every 5 seconds (30 cycles):
   ```bash
   for i in {1..30}; do
       PATTERN_ID=$((i % 6))
       curl -X POST http://k1-reinvented.local/api/pattern \
            -d "{\"id\": $PATTERN_ID}"
       sleep 5
   done
   ```

3. Monitor for crashes:
   - Watch serial output for exceptions
   - Ping device every 10 seconds

4. Record final FPS:
   ```bash
   FPS_END=$(curl -s http://k1-reinvented.local/api/device/performance | jq '.fps')
   ```

5. Validate FPS stable (±10% of baseline)

**Expected Results:**
- Zero crashes or exceptions
- FPS variance < 10% (e.g., 180-220 FPS if baseline is 200)
- All pattern transitions complete within 500ms
- No visual artifacts during transition

**Pass Criteria:**
```cpp
TEST_ASSERT_EQUAL_UINT32(0, exception_count);
TEST_ASSERT_FLOAT_WITHIN(fps_baseline * 0.1, fps_baseline, fps_final);
```

**Failure Analysis:**
- **Symptom:** Crash on pattern switch
  **Cause:** Uninitialized state or dangling pointer
  **Fix:** Add initialization guards, validate pattern constructor

- **Symptom:** FPS drops >20%
  **Cause:** Pattern not cleaning up resources
  **Fix:** Add pattern destructor, free buffers on unload

**Implementation:**
```cpp
// firmware/test/test_hardware_validation/test_hw_graph_system.cpp
void test_graph_006_hot_pattern_switching() {
    float fps_baseline = get_current_fps();
    uint32_t exception_count = 0;

    // Switch patterns 30 times
    for (int i = 0; i < 30; i++) {
        uint8_t pattern_id = i % 6;

        // Attempt pattern switch
        bool success = set_pattern(pattern_id);
        TEST_ASSERT_TRUE_MESSAGE(success, "Pattern switch failed");

        // Wait for pattern to stabilize
        delay(5000);

        // Check for exceptions (would be caught by exception handler)
        // This is a placeholder - real implementation would check FreeRTOS task state
        TEST_ASSERT_EQUAL_UINT32(0, exception_count);
    }

    float fps_final = get_current_fps();
    TEST_ASSERT_FLOAT_WITHIN(fps_baseline * 0.1, fps_baseline, fps_final);

    Serial.printf("Pattern switching complete: FPS %.1f -> %.1f\n",
                  fps_baseline, fps_final);
}
```

---

### TC-E2E-006: Long-Duration Stability (8-Hour Soak)

**Category:** End-to-End Validation
**Priority:** P0 (Critical)
**Automation:** Full (automated monitoring script)
**Duration:** 8 hours

**Objective:** Validate system stability over extended operation

**Preconditions:**
- ESP32-S3 with production firmware
- 2x WS2812 strips (320 LEDs total)
- INMP441 microphone
- WiFi connected
- Power supply: 5V, 3A (adequate for continuous operation)

**Test Procedure:**
1. Start automated monitoring script:
   ```bash
   python tools/hw_test/long_duration_test.py --duration 28800  # 8 hours
   ```

2. Monitoring script performs:
   - Health check every 60 seconds (ping device, query `/api/device/info`)
   - Performance snapshot every 5 minutes (FPS, heap, CPU temp)
   - Pattern switch every 30 minutes (rotate through 10 patterns)
   - Log all metrics to CSV file

3. After 8 hours, analyze results:
   - Total uptime vs. expected (should be ~8 hours)
   - Exception count (should be 0)
   - Heap trend (should be flat, no leaks)
   - FPS trend (should be stable, ±10%)
   - Temperature trend (should be stable, < 70°C)

**Expected Results:**
- Uptime: 28800 seconds (8 hours)
- Zero crashes or resets
- Heap delta: < 5 KB from start to end
- FPS variance: < 10% across entire test
- CPU temperature: < 70°C sustained

**Pass Criteria:**
```python
assert uptime_seconds >= 28800, "System crashed or reset"
assert exception_count == 0, "Exceptions detected"
assert abs(heap_end - heap_start) < 5120, "Memory leak detected"
assert fps_stddev < fps_mean * 0.1, "FPS unstable"
assert max_temp_celsius < 70, "Thermal issue"
```

**Failure Analysis:**
- **Symptom:** Crash after 2-3 hours
  **Cause:** Memory leak or heap fragmentation
  **Fix:** Run TC-MEM-002 to isolate leak source

- **Symptom:** Temperature rising over time
  **Cause:** Inadequate cooling or thermal runaway
  **Fix:** Add heatsink, reduce LED brightness

**Implementation (Python monitoring script):**
```python
# tools/hw_test/long_duration_test.py
import requests
import time
import csv
import sys

def run_soak_test(duration_seconds, device_ip):
    start_time = time.time()
    results = []

    while time.time() - start_time < duration_seconds:
        try:
            # Health check
            info = requests.get(f"http://{device_ip}/api/device/info", timeout=5).json()
            perf = requests.get(f"http://{device_ip}/api/device/performance", timeout=5).json()

            # Record metrics
            results.append({
                'timestamp': time.time(),
                'uptime': info['uptime_ms'] / 1000,
                'heap_free': perf['heap_free'],
                'fps': perf['fps'],
                'cpu_temp': perf.get('cpu_temp_celsius', 0)
            })

            # Pattern switch every 30 minutes
            if len(results) % 60 == 0:  # Every 60 samples (30 min at 30s interval)
                pattern_id = (len(results) // 60) % 10
                requests.post(f"http://{device_ip}/api/pattern", json={'id': pattern_id})

            time.sleep(30)  # Sample every 30 seconds

        except Exception as e:
            print(f"ERROR: {e}")
            sys.exit(1)

    # Analyze results
    heap_start = results[0]['heap_free']
    heap_end = results[-1]['heap_free']
    fps_values = [r['fps'] for r in results]
    temps = [r['cpu_temp'] for r in results]

    print(f"Soak test complete: {len(results)} samples")
    print(f"Heap delta: {heap_start - heap_end} bytes")
    print(f"FPS: avg={sum(fps_values)/len(fps_values):.1f}, stddev={np.std(fps_values):.1f}")
    print(f"Temp: max={max(temps):.1f}°C")

    # Save to CSV
    with open('soak_test_results.csv', 'w') as f:
        writer = csv.DictWriter(f, fieldnames=['timestamp', 'uptime', 'heap_free', 'fps', 'cpu_temp'])
        writer.writeheader()
        writer.writerows(results)

if __name__ == '__main__':
    run_soak_test(28800, 'k1-reinvented.local')  # 8 hours
```

---

## Test Execution Quick Start

### Step 1: Build Test Firmware
```bash
cd /Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware
pio run -e esp32-s3-hwtest
```

### Step 2: Upload to Device
```bash
pio run -e esp32-s3-hwtest -t upload
```

### Step 3: Run Tests
```bash
# Run all hardware tests
pio test -e esp32-s3-hwtest -f test_hardware_validation

# Run specific category
pio test -e esp32-s3-hwtest -f test_hardware_validation/test_hw_led_driver.cpp

# Verbose output
pio test -e esp32-s3-hwtest --verbose
```

### Step 4: Collect Results
```bash
# Results in .pio/test/
cat .pio/test/esp32-s3-hwtest/output.txt
```

---

## Appendix: Helper Functions

### Telemetry Capture
```cpp
// firmware/test/test_utils/telemetry_capture.h
struct TelemetrySnapshot {
    float fps;
    uint32_t heap_free;
    uint32_t heap_largest_block;
    uint32_t rmt_ch1_gap_us;
    uint32_t rmt_ch2_gap_us;
    float cpu_temp_celsius;
};

void capture_telemetry(TelemetrySnapshot* out) {
    // Query REST API or profiling infrastructure
    out->fps = get_current_fps();
    out->heap_free = ESP.getFreeHeap();
    out->heap_largest_block = ESP.getMaxAllocHeap();

    const RmtProbe *ch1, *ch2;
    rmt_probe_get(&ch1, &ch2);
    out->rmt_ch1_gap_us = ch1->max_gap_us;
    out->rmt_ch2_gap_us = ch2->max_gap_us;

    out->cpu_temp_celsius = read_cpu_temperature();
}
```

### Audio Signal Generator
```cpp
// firmware/test/test_utils/audio_signal_gen.h
void generate_sine_wave(float freq_hz, float* buffer, size_t size, float sample_rate) {
    for (size_t i = 0; i < size; i++) {
        buffer[i] = sinf(2.0f * M_PI * freq_hz * i / sample_rate);
    }
}
```

### Visual Validator
```cpp
// firmware/test/test_utils/visual_validator.h
bool validate_color_accuracy(const CRGB* leds, int num_leds, CRGB expected, uint8_t tolerance) {
    for (int i = 0; i < num_leds; i++) {
        if (abs(leds[i].r - expected.r) > tolerance) return false;
        if (abs(leds[i].g - expected.g) > tolerance) return false;
        if (abs(leds[i].b - expected.b) > tolerance) return false;
    }
    return true;
}
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v1.0 | 2025-11-10 | QA Team | Initial test specifications |

**Next:** Implement test harness and execute first validation run

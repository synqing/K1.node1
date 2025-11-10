# Hardware Validation Test Suite - K1.node1

## Overview

The hardware validation test suite provides automated verification of core K1.node1 systems on actual ESP32-S3 hardware. All 12 tests are self-contained, executable, and produce clear PASS/FAIL output.

**Total Execution Time:** ~25 minutes (excluding 5-minute stability test)
**Required Hardware:** ESP32-S3 with dual RMT channels and I2S microphone

---

## Test Structure

### LED Driver Tests (4 tests, ~5 min total)

Located: `firmware/test/test_hw_led_driver.cpp`

#### Test 1: RMT Dual-Channel Sync
**Purpose:** Verify both RMT channels transmit back-to-back with minimal skew
**Verification:** 30+ frames complete transmission within 2ms
**Success Metric:** All frames execute without timeout

#### Test 2: LED Color Accuracy
**Purpose:** Verify quantize_color() correctly converts floating-point colors to 8-bit
**Verification:** Full red (1,0,0), full green (0,1,0), full blue (0,0,1), and 50% gray
**Success Metric:** All color channels match expected values within 1 LSB

#### Test 3: Frame Timing Stability
**Purpose:** Measure frame-to-frame interval jitter over 128 frames
**Verification:** Collect frame deltas and calculate average jitter
**Success Metric:** Average jitter < 2ms

#### Test 4: Memory Bounds
**Purpose:** Verify LED driver and pattern state use < 50KB heap
**Verification:** Capture heap before/after 100 frames of animation
**Success Metric:** Total heap delta < 1KB (no leaks)

---

### Audio Input Tests (4 tests, ~10 min total)

Located: `firmware/test/test_hw_audio_input.cpp`

#### Test 1: I2S Initialization
**Purpose:** Verify microphone driver initializes without fatal errors
**Verification:** Check I2S timeout state after init
**Success Metric:** Timeout count < 2 (normal init behavior)

#### Test 2: Audio Capture
**Purpose:** Verify microphone is capturing non-zero samples
**Verification:** Read 100 audio chunks (8ms each), count non-zero spectrum bins
**Success Metric:** Capture ≥ 40 chunks, ≥ 10 non-zero bins across all

#### Test 3: FFT Accuracy
**Purpose:** Verify Goertzel frequency bins are responsive
**Verification:** Build baseline spectrum over 2 seconds, identify peaks
**Success Metric:** ≥ 3 frequency bins above 10% of max (normal ambient noise)

#### Test 4: Audio Latency
**Purpose:** Measure end-to-end latency from capture to snapshot availability
**Verification:** Time from acquire_sample_chunk() to get_audio_snapshot()
**Success Metric:** Average latency < 20ms, max < 40ms

---

### Graph Integration Tests (4 tests, ~15 min total)

Located: `firmware/test/test_hw_graph_integration.cpp`

#### Test 1: Graph Codegen Correctness
**Purpose:** Verify pattern registry initializes and patterns are valid
**Verification:** Attempt to set each registered pattern
**Success Metric:** ≥ 80% of patterns load successfully

#### Test 2: Pattern Execution
**Purpose:** Run 100 frames of a pattern without crash or NaN/Inf
**Verification:** Execute bloom/spectrum pattern, check LED buffer validity
**Success Metric:** 0 crashes, all frames complete, no invalid floats

#### Test 3: Parameter Mutation
**Purpose:** Change parameters mid-pattern, verify smooth transitions
**Verification:** Ramp brightness 0.2→1.0 over 100 frames, toggle dithering
**Success Metric:** No brightness jumps > 0.15 (smooth transitions)

#### Test 4: Long-Duration Stability
**Purpose:** Run single pattern for 5 minutes, verify consistent FPS
**Verification:** Measure FPS every 30 seconds, track min/max
**Success Metric:** Avg FPS > 100, variation < 20%, 0 crashes

---

## Quick Start

### Single Test Execution

```bash
# Run LED driver tests only
cd firmware
pio test -e esp32-s3-devkitc-1 -f test_hw_led_driver

# Run audio input tests only
pio test -e esp32-s3-devkitc-1 -f test_hw_audio_input

# Run graph integration tests only
pio test -e esp32-s3-devkitc-1 -f test_hw_graph_integration
```

### Full Validation Suite

```bash
# Run all hardware validation tests
./tools/run_hw_tests.sh

# Run with custom device
./tools/run_hw_tests.sh --device /dev/ttyUSB0

# Skip compilation (reuse existing binary)
./tools/run_hw_tests.sh --skip-build
```

---

## Test Execution Output Format

Each test produces structured output:

```
=========================================
HARDWARE VALIDATION: LED DRIVER
=========================================

=== TEST 1: RMT Dual-Channel Sync ===
  Valid frames: 31/32
  Avg TX time: 850 us
  RMT wait timeouts: 1
  [PASS] RMT dual-channel sync verified

=== TEST 2: LED Color Accuracy ===
  Color accuracy verified: red, green, blue, mid-level
  [PASS] LED color accuracy validated

[... more tests ...]

=== Test Summary ===
Total: 4
Passed: 4
Failed: 0
Success Rate: 100.0%
```

---

## Success Criteria

### All 12 Tests Must Pass

| Category | Tests | Min. Pass Rate |
|----------|-------|----------------|
| LED Driver | 4 | 100% (all 4) |
| Audio Input | 4 | 100% (all 4) |
| Graph Integration | 4 | 100% (all 4) |
| **Total** | **12** | **100% (all 12)** |

### Performance Targets

| Metric | Requirement | Rationale |
|--------|-------------|-----------|
| Frame jitter | < 2ms | Smooth visual motion |
| Audio latency | < 20ms avg | Real-time responsiveness |
| FPS stability | > 100 FPS, <20% variation | Consistent rendering |
| Memory usage | < 50KB for LED driver | Bounded heap usage |
| No crashes | 0 over 5 minutes | Production stability |

---

## Test Logs and Reports

Test results are automatically saved to:
```
test_logs/YYYYMMDD_HHMMSS/
  - test_hw_led_driver.log
  - test_hw_audio_input.log
  - test_hw_graph_integration.log
```

Each log includes:
- Raw serial output
- Parsed test results (PASS/FAIL)
- Metrics (timings, memory usage)
- Timing statistics

---

## Troubleshooting

### "Device not found" Error

```bash
# List available serial devices
ls -la /dev/tty.*

# Update device path in run_hw_tests.sh or pass via --device flag
./tools/run_hw_tests.sh --device /dev/ttyUSB0
```

### Test Timeout (Hangs)

**Likely cause:** Device not responding or test loop not breaking
**Action:**
1. Check device is powered and connected
2. Manually reset device (press EN button)
3. Verify serial port is not held by IDE or monitor
4. Increase timeout: `--timeout 1200` (20 minutes)

### "RMT wait timeout" in LED Tests

**Likely cause:** RMT peripheral congestion or ISR preemption
**Action:**
1. Verify no other tasks monopolizing core 0
2. Check WiFi is disabled during test
3. Look for high-priority background tasks

### "I2S timeout" in Audio Tests

**Likely cause:** Microphone not connected or I2S pins incorrect
**Action:**
1. Verify SPH0645 microphone wiring (BCLK=14, LRCLK=12, DIN=13)
2. Check 3.3V power supply to microphone
3. Verify no GPIO conflicts with other systems

### "No audio samples" or "Spectrum flat"

**Likely cause:** I2S driver in fallback mode or capturing silence
**Action:**
1. Verify microphone gain setting
2. Test with external audio input to confirm I2S works
3. Check audio preprocessing pipeline

---

## Performance Baseline (Reference)

Expected results on production K1.node1 hardware:

### LED Driver
- Frame TX time: 800-1200 µs
- RMT wait timeouts: 0-5 per 1000 frames
- Frame jitter: < 500 µs average

### Audio Input
- I2S chunk capture: 8ms cadence (16000 Hz, 128 samples)
- Audio latency: 5-15ms (capture to snapshot)
- Spectrum bins active: 10-50 (depends on ambient noise)

### Graph Integration
- Pattern FPS: 160-200 FPS (6-6.25ms per frame)
- FPS variation: < 15% with stable audio
- Heap for patterns: 20-40KB (depends on pattern complexity)

---

## Adding New Tests

To add a new hardware validation test:

1. Create test file: `firmware/test/test_hw_*.cpp`
2. Use `test_helpers.h` utilities (TestTimer, FPSCounter, MemorySnapshot)
3. Follow Unity test framework: `TEST_ASSERT_*` macros
4. Include `[PASS]` / `[FAIL]` markers in output
5. Add to `tools/run_hw_tests.sh` test array

Example:
```cpp
#include <unity.h>
#include "../test_utils/test_helpers.h"

void test_my_subsystem() {
    Serial.println("\n=== TEST: My Subsystem ===");

    // Your test code
    TEST_ASSERT_TRUE(some_condition);

    TestResults::instance().add_pass("My test description");
}

void setup() {
    Serial.begin(2000000);
    delay(2000);
    UNITY_BEGIN();
    RUN_TEST(test_my_subsystem);
    UNITY_END();
}

void loop() { delay(1000); }
```

---

## Related Documentation

- Architecture: `docs/01-architecture/K1NArch_SPEC_LUT_SYSTEM_ARCHITECTURE_v1.0_20251108.md`
 - RMT/LED: `docs/02-adr/K1NADR_0015_LED_DRIVER_HEADER_SPLIT_v1.0_20251110.md`
 - Audio: `docs/02-adr/K1NADR_0013_BACKEND_FRAMEWORK_FASTAPI_v1.0_20251110.md`
- Implementation: `docs/09-implementation/K1NImpl_FIRMWARE_NODE_INTEGRATION_ANALYSIS_v1.0_20251110.md`

---

## Maintenance

Tests should be re-run:
- After any firmware changes to LED, audio, or pattern systems
- Before deployment to production
- After hardware modifications or recalibration
- When investigating performance regressions

**Last Updated:** 2025-11-10

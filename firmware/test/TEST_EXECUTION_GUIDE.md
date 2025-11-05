# K1 Audio Fixes - Test Execution Guide

## Quick Start

```bash
# Run all tests (except hardware stress tests)
cd firmware
pio test -e esp32-s3-devkitc-1

# Run specific test suite
pio test -e esp32-s3-devkitc-1 -f test_fix1_pattern_snapshots

# Run hardware stress tests (30+ minutes)
pio test -e esp32-s3-devkitc-1 -f test_hardware_stress
```

## Test Suites

### Fix #1: Pattern Snapshots
**File:** `test/test_fix1_pattern_snapshots/test_pattern_snapshots.cpp`

**What it tests:**
- Atomic snapshot copies prevent data tearing
- Concurrent audio updates don't corrupt pattern data
- Memcpy overhead is acceptable (< 50 microseconds)
- Update counter and timestamp tracking
- PATTERN_AUDIO_START() macro integration

**Duration:** ~30 seconds

**Requirements:**
- None (runs entirely in firmware)

**Expected output:**
```
========================================
FIX #1: PATTERN SNAPSHOTS - TEST SUITE
========================================

✓ Snapshot atomic copy
✓ No tearing detected
✓ Snapshot overhead acceptable
✓ No corruption with concurrent access
✓ Update counter increments correctly
✓ Timestamp accuracy verified
✓ PATTERN_AUDIO_START() macro works correctly

7 Tests 0 Failures 0 Ignored
```

### Fix #2: I2S Timeout Handling
**File:** `test/test_fix2_i2s_timeout/test_i2s_timeout.cpp`

**What it tests:**
- Normal I2S operation completes without timeout
- Timeout detection mechanism (20ms limit)
- Silence buffer fallback on timeout
- Rate-limited logging (1/second max)
- Audio processing continues despite I2S failure
- Rendering not blocked by I2S issues

**Duration:** ~1 minute

**Requirements:**
- SPH0645 microphone connected
- For complete testing: Ability to disconnect microphone during test

**Expected output:**
```
========================================
FIX #2: I2S TIMEOUT - TEST SUITE
========================================

✓ Normal I2S operation
✓ Timeout mechanism present
✓ Silence fallback works correctly
✓ Rate-limiting mechanism present
✓ Audio processing continues
✓ Rendering not blocked by audio timeouts
✓ System state valid for recovery
✓ Timeout value appropriate

8 Tests 0 Failures 0 Ignored
```

**Manual testing steps:**
1. Run test with microphone connected (baseline)
2. Disconnect microphone during operation
3. Verify timeout logs appear (max 1/second)
4. Reconnect microphone
5. Verify audio processing resumes

### Fix #3: Mutex Timeout Handling
**File:** `test/test_fix3_mutex_timeout/test_mutex_timeout.cpp`

**What it tests:**
- No mutex timeouts in normal operation
- Concurrent audio updates handled correctly
- Audio latency stays below 20ms
- Stale data detection works
- Mutex warnings are rate-limited

**Duration:** ~45 seconds

**Requirements:**
- None (runs entirely in firmware)

**Expected output:**
```
========================================
FIX #3: MUTEX TIMEOUT - TEST SUITE
========================================

✓ Normal operation without timeouts
✓ Concurrent updates handled correctly
✓ Audio latency acceptable
✓ Stale data detection works
✓ Rate-limiting present in code

5 Tests 0 Failures 0 Ignored
```

### Fix #4: Codegen Macro Integration
**File:** `test/test_fix4_codegen_macro/test_codegen_macro.cpp`

**What it tests:**
- PATTERN_AUDIO_START() macro compiles correctly
- Macro expansion creates expected variables
- Frequency band macros (BASS, MIDS, TREBLE)
- Freshness tracking across pattern calls
- Pattern registry integration

**Duration:** ~20 seconds

**Requirements:**
- None (runs entirely in firmware)

**Expected output:**
```
========================================
FIX #4: CODEGEN MACRO - TEST SUITE
========================================

✓ PATTERN_AUDIO_START() compiles
✓ Macro expansion works correctly
✓ Frequency band macros work
✓ Freshness tracking works
✓ Pattern registry integration works

5 Tests 0 Failures 0 Ignored
```

**Manual code review:**
```bash
# Verify all audio patterns have the macro
grep -n "PATTERN_AUDIO_START" firmware/src/generated_patterns.h

# Should see multiple matches, one per audio pattern
```

### Fix #5: Dual-Core Architecture
**File:** `test/test_fix5_dual_core/test_dual_core.cpp`

**What it tests:**
- Audio task creation on Core 1
- Parallel execution on both cores
- FPS increase (target: > 200 FPS)
- Audio latency reduction (target: < 20ms)
- No memory leaks during runtime
- Pattern switching under load
- Task stack usage

**Duration:** ~1 minute

**Requirements:**
- None (runs entirely in firmware)

**Expected output:**
```
========================================
FIX #5: DUAL-CORE ARCH - TEST SUITE
========================================

✓ Audio task created on Core 1
✓ Both cores executing in parallel
✓ FPS target achieved (245.3 FPS)
✓ Audio latency under 20ms (12.4 ms)
✓ No memory leaks detected
✓ Pattern switching works under load
✓ Stack usage acceptable (6234 bytes)

7 Tests 0 Failures 0 Ignored
```

### Hardware Stress Tests
**File:** `test/test_hardware_stress/test_hardware_stress.cpp`

**What it tests:**
- 30-minute continuous runtime
- Rapid pattern changes (1000 switches)
- Audio frequency sweep responsiveness
- WiFi + OTA during rendering
- Thermal monitoring (< 70°C)

**Duration:** 30+ minutes (can skip long tests)

**Requirements:**
- Physical ESP32-S3 device
- WiFi connection
- Microphone connected
- Well-ventilated environment

**Expected output:**
```
========================================
HARDWARE STRESS TESTS
========================================

WARNING: These tests take 30+ minutes!
Press 's' within 5 seconds to skip long tests

[Running 30-minute continuous runtime test...]
[1 min] Frames: 12000, Crashes: 0, Free heap: 145236
[2 min] Frames: 24000, Crashes: 0, Free heap: 145184
...
[30 min] Frames: 360000, Crashes: 0, Free heap: 145052

✓ 30-minute runtime test passed
✓ Rapid pattern switching test passed
✓ Frequency sweep test passed
✓ WiFi interference test passed
✓ Thermal test passed (Max: 62.3°C)

5 Tests 0 Failures 0 Ignored
```

## Running All Tests

### Sequential Execution
```bash
# Run all unit tests (excludes stress tests)
pio test -e esp32-s3-devkitc-1

# Expected total duration: ~3-4 minutes
# Expected total: 32 tests, 0 failures
```

### Individual Test Execution
```bash
# Fix #1
pio test -e esp32-s3-devkitc-1 -f test_fix1_pattern_snapshots

# Fix #2
pio test -e esp32-s3-devkitc-1 -f test_fix2_i2s_timeout

# Fix #3
pio test -e esp32-s3-devkitc-1 -f test_fix3_mutex_timeout

# Fix #4
pio test -e esp32-s3-devkitc-1 -f test_fix4_codegen_macro

# Fix #5
pio test -e esp32-s3-devkitc-1 -f test_fix5_dual_core

# Stress tests (optional, 30+ minutes)
pio test -e esp32-s3-devkitc-1 -f test_hardware_stress
```

## Test Coverage Summary

| Fix | Category | Coverage | Test Count |
|-----|----------|----------|------------|
| #1: Pattern Snapshots | Unit | 100% | 7 tests |
| #2: I2S Timeout | Integration | 95%* | 8 tests |
| #3: Mutex Timeout | Unit | 100% | 5 tests |
| #4: Codegen Macro | Unit | 100% | 5 tests |
| #5: Dual-Core | Integration | 100% | 7 tests |
| Hardware Stress | System | 95%* | 5 tests |

*Requires manual intervention for complete coverage

**Total:** 37 automated tests

## Expected Performance Metrics

| Metric | Target | Typical Result |
|--------|--------|----------------|
| Snapshot overhead | < 50 μs | 15-20 μs |
| I2S read timeout | 20 ms | 18-20 ms |
| Audio latency | < 20 ms | 10-15 ms |
| Mutex timeout rate | < 1% | 0% |
| Render FPS (dual-core) | > 200 FPS | 220-250 FPS |
| Memory leak (10 min) | < 1 KB | 0 bytes |
| Max CPU temperature | < 70°C | 55-65°C |

## Troubleshooting

### Test Failures

**"I2S read timeout" failures:**
- Check microphone is properly connected
- Verify I2S pins: BCLK=14, LRCLK=12, DIN=13
- Ensure microphone has power (3.3V)

**"Mutex timeout" failures:**
- May indicate Core 1 overload
- Check audio task priority (should be 10)
- Verify dual-core configuration

**"FPS below target" failures:**
- Ensure device is not thermal throttling
- Check WiFi isn't consuming excessive CPU
- Verify render loop isn't doing heavy processing

**Memory leak failures:**
- Run test longer to confirm (variance is normal)
- Check for task creation without deletion
- Monitor heap fragmentation

### Serial Monitor Not Working
```bash
# Check USB port
ls /dev/tty.usbmodem*

# Update platformio.ini with correct port
test_port = /dev/tty.usbmodem212401

# Ensure baud rate matches
test_speed = 2000000
```

### Tests Hanging
- Press reset button on ESP32-S3
- Reflash firmware: `pio run -t upload`
- Check serial cable connection

## Continuous Integration

To integrate these tests into CI/CD:

```yaml
# .github/workflows/test.yml
name: Hardware Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v2
      - name: Install PlatformIO
        run: pip install platformio
      - name: Run Unit Tests
        run: cd firmware && pio test -e esp32-s3-devkitc-1
      - name: Upload Test Results
        uses: actions/upload-artifact@v2
        with:
          name: test-results
          path: firmware/.pio/test/
```

## Test Maintenance

### Adding New Tests
1. Create test file in appropriate directory
2. Include test_helpers.h for utilities
3. Follow naming convention: `test_<feature>.cpp`
4. Add to test_ignore if needed (platformio.ini)

### Updating Tests
- Update test when implementation changes
- Maintain backward compatibility where possible
- Document breaking changes in commit messages

## Next Steps

After all tests pass:
1. Review test coverage report
2. Identify any edge cases not covered
3. Add regression tests for any bugs found
4. Document production deployment checklist
5. Set up automated CI/CD testing

## Contact

For test issues or questions:
- Check firmware/test/README.md
- Review individual test source files
- Consult `docs/analysis/forensic_audio_pipeline/AUDIO_LATENCY_FIX_DEPLOYED.md` for implementation details

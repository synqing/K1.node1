# K1 Audio Fixes - Comprehensive Test Suite

This test suite validates all 5 critical audio synchronization fixes implemented for the K1.reinvented firmware.

## Test Structure

```
test/
├── test_fix1_pattern_snapshots/      # Fix #1: Pattern snapshot atomicity
├── test_fix2_i2s_timeout/            # Fix #2: I2S timeout and recovery
├── test_fix3_mutex_timeout/          # Fix #3: Mutex timeout handling
├── test_fix4_codegen_macro/          # Fix #4: PATTERN_AUDIO_START() macro
├── test_fix5_dual_core/              # Fix #5: Dual-core architecture
├── test_hardware_stress/             # Hardware stress tests
└── test_utils/                       # Common test utilities
```

## Running Tests

### All Tests
```bash
pio test -e esp32-s3-devkitc-1
```

### Specific Test
```bash
pio test -e esp32-s3-devkitc-1 -f test_fix1_pattern_snapshots
```

### Hardware Tests (requires physical device)
```bash
pio test -e esp32-s3-devkitc-1 -f test_hardware_stress
```

## Test Coverage

### Fix #1: Pattern Snapshots
- ✓ Atomic snapshot copy verification
- ✓ No tearing between audio updates
- ✓ Memcpy overhead measurement
- ✓ Concurrent update validation

### Fix #2: I2S Timeout
- ✓ Normal operation (no timeout)
- ✓ Microphone disconnect handling
- ✓ Recovery after reconnect
- ✓ Silence pattern verification
- ✓ Rate-limited logging

### Fix #3: Mutex Timeout
- ✓ No timeouts in normal operation
- ✓ Concurrent audio update handling
- ✓ Audio latency < 20ms validation
- ✓ Stale data detection
- ✓ Rate-limited log verification

### Fix #4: Codegen Macro
- ✓ All audio patterns contain PATTERN_AUDIO_START()
- ✓ Pattern compilation success
- ✓ Macro expansion verification
- ✓ Non-audio patterns excluded

### Fix #5: Dual-Core
- ✓ Audio task creation success
- ✓ Core 0 and Core 1 parallel execution
- ✓ FPS increase (target: 200+)
- ✓ Audio latency reduction (target: < 20ms)
- ✓ Memory leak detection (10 min runtime)
- ✓ Pattern switching under load
- ✓ Web API responsiveness

### Hardware Stress Tests
- ✓ 30-minute continuous runtime
- ✓ Rapid pattern changes
- ✓ Audio frequency sweep
- ✓ WiFi + OTA during rendering
- ✓ Thermal monitoring (< 70°C)

## Test Results Format

Each test outputs:
- ✓ PASS: Test name and execution time
- ✗ FAIL: Test name, expected vs actual, stack trace

Summary report:
- Total tests: N
- Passed: N
- Failed: N
- Coverage: N%

## Dependencies

- PlatformIO Unit Testing framework
- ESP32 Arduino framework
- FreeRTOS (included in ESP32)
- Unity test framework (auto-included by PlatformIO)

## Notes

- Hardware tests require physical ESP32-S3 with microphone
- Some tests require external audio input
- Stress tests may take 30+ minutes to complete
- Memory leak tests require heap monitoring enabled

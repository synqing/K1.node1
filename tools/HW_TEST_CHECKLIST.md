# Hardware Validation Test Checklist

## Pre-Test Setup

- [ ] ESP32-S3 device connected via USB
- [ ] Device appears in `/dev/tty.*` (verify: `ls -la /dev/tty.*`)
- [ ] No other terminals are accessing the serial port
- [ ] Microphone is connected (SPH0645: BCLK=14, LRCLK=12, DIN=13)
- [ ] LED strips are connected (GPIO 5 primary, GPIO 4 secondary)
- [ ] 5V power supply confirmed for both microphone and LEDs
- [ ] No active WiFi interference (disable WiFi during tests)
- [ ] Room is reasonably quiet for baseline audio capture

## Running Tests

### Option 1: Automated Full Suite (Recommended)
```bash
cd /Users/spectrasynq/Workspace_Management/Software/K1.node1
./tools/run_hw_tests.sh
```

Expected output:
```
Device: /dev/tty.usbmodem212401
Baud rate: 2000000
Logs: test_logs/YYYYMMDD_HHMMSS

[BUILD & FLASH PHASE]
[RUN PHASE]
TEST: test_hw_led_driver        [PASS/FAIL]
TEST: test_hw_audio_input       [PASS/FAIL]
TEST: test_hw_graph_integration [PASS/FAIL]

All tests PASSED! (or) Some tests FAILED
```

Expected time: **~25 minutes**

### Option 2: Individual Test
```bash
cd /Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware

# LED driver tests only (~5 min)
pio test -e esp32-s3-devkitc-1 -f test_hw_led_driver

# Audio input tests only (~10 min)
pio test -e esp32-s3-devkitc-1 -f test_hw_audio_input

# Graph integration tests only (~15 min)
pio test -e esp32-s3-devkitc-1 -f test_hw_graph_integration
```

### Option 3: Custom Device
```bash
./tools/run_hw_tests.sh --device /dev/ttyUSB0
```

## During Test Execution

### LED Driver Tests
- **Duration:** ~5 minutes
- **Expected:**
  - Frame transmission time 800-1200µs
  - Color values match RGB8 quantization
  - Jitter < 2ms average
  - Heap usage stable

### Audio Input Tests
- **Duration:** ~10 minutes
- **Expected:**
  - I2S driver initializes
  - 40+ audio chunks captured per 2s
  - Frequency bins respond to environment
  - Latency < 20ms average

### Graph Integration Tests
- **Duration:** ~15 minutes (includes 5-min stability test)
- **Expected:**
  - Patterns load and execute
  - Parameter changes are smooth
  - **5-minute continuous run:** FPS > 100, stable

## Test Results

After completion, results are saved to:
```
test_logs/YYYYMMDD_HHMMSS/
├── test_hw_led_driver.log
├── test_hw_audio_input.log
└── test_hw_graph_integration.log
```

View results:
```bash
cat test_logs/*/test_hw_*.log | grep -E "\[PASS\]|\[FAIL\]|\[METRIC\]"
```

## Success Criteria

All tests must return **0 exit code**:

### LED Driver (4 tests)
- [ ] RMT dual-channel sync: 30+ valid frames
- [ ] LED color accuracy: all colors match (R/G/B/gray)
- [ ] Frame timing: jitter < 2ms
- [ ] Memory bounds: heap delta < 1KB

### Audio Input (4 tests)
- [ ] I2S init: timeout count < 2
- [ ] Audio capture: ≥40 chunks, ≥10 non-zero bins
- [ ] FFT accuracy: ≥3 peak bins detected
- [ ] Audio latency: avg < 20ms, max < 40ms

### Graph Integration (4 tests)
- [ ] Pattern registry: ≥80% patterns valid
- [ ] Pattern execution: 100 frames, 0 crashes
- [ ] Parameter mutation: no jumps > 0.15
- [ ] Stability: 5 min at >100 FPS, <20% variation

## Troubleshooting

### Test Won't Start
**Error:** `ERROR: Device /dev/tty.* not found`
```bash
# Find correct device
ls /dev/tty.*

# Update run_hw_tests.sh or use:
./tools/run_hw_tests.sh --device /dev/ttyUSB0
```

### Test Hangs/Timeout
**Error:** `Test did not complete within 600s`
1. Press Ctrl+C to kill
2. Manually reset device (press EN button)
3. Clear stale processes: `sudo lsof | grep tty`
4. Increase timeout: `./tools/run_hw_tests.sh --timeout 1200`

### Build Fails
**Error:** `Compilation failed`
1. Clean build: `cd firmware && pio run -t clean`
2. Check IDF headers: `pio platform list`
3. View full error: `cat test_logs/*/test_hw_*.log`

### RMT Wait Timeouts
**Error:** `RMT wait timeout (ch1=1 ch2=0)`
1. Normal if < 5 per 1000 frames
2. Check: No high-priority tasks on core 0
3. Disable WiFi if active
4. Verify GPIO 4, 5 not used by other subsystems

### Audio Tests Fail
**Error:** `I2S timeout count > 2` or `No audio samples`
1. Verify microphone wiring (BCLK=14, LRCLK=12, DIN=13)
2. Test with known audio input (speaker near mic)
3. Check microphone is powered (3.3V on Vin)
4. Look for GPIO conflicts

## Performance Baselines

Expected ranges for healthy hardware:

| Metric | Min | Typical | Max |
|--------|-----|---------|-----|
| Frame TX time | 500µs | 900µs | 1500µs |
| Frame jitter avg | <100µs | 300µs | 1000µs |
| Audio latency | 5ms | 12ms | 20ms |
| Pattern FPS | 150 | 170 | 200 |
| FPS variation | <5% | 10% | 20% |
| Heap usage | 15KB | 30KB | 50KB |

## Post-Test Actions

### If All Tests Pass ✅
1. Save logs for regression baseline
2. Commit results to documentation
3. Hardware ready for deployment

### If Some Tests Fail ❌
1. Review failed test log in detail
2. Note which test(s) failed
3. Investigate root cause per troubleshooting guide
4. Fix and re-run specific failed test
5. Repeat until all tests pass

## Advanced: Manual Test Run

For detailed diagnostics:

```bash
cd firmware

# Build specific test only (don't upload)
pio test -e esp32-s3-devkitc-1 -f test_hw_led_driver --without-uploading

# Upload manually
pio run -e esp32-s3-devkitc-1 -t upload

# Monitor serial output
pio device monitor -b 2000000

# Capture output to file
pio device monitor -b 2000000 > test_output.log
```

## Reference

- **Full Guide:** `firmware/test/HARDWARE_VALIDATION_GUIDE.md`
- **Test Source:** `firmware/test/test_hw_*.cpp`
- **Test Utilities:** `firmware/test/test_utils/test_helpers.h`
- **Parser:** `tools/parse_test_output.py`

---

**Last Updated:** 2025-11-10

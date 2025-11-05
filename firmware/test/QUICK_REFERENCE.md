# K1 Audio Tests - Quick Reference

## Run All Tests
```bash
cd firmware
pio test -e esp32-s3-devkitc-1
```
**Duration:** 3-4 minutes | **Tests:** 32 | **Expected:** All pass

---

## Run Individual Tests

```bash
# Fix #1: Pattern Snapshots (30 sec, 7 tests)
pio test -e esp32-s3-devkitc-1 -f test_fix1_pattern_snapshots

# Fix #2: I2S Timeout (1 min, 8 tests)
pio test -e esp32-s3-devkitc-1 -f test_fix2_i2s_timeout

# Fix #3: Mutex Timeout (45 sec, 5 tests)
pio test -e esp32-s3-devkitc-1 -f test_fix3_mutex_timeout

# Fix #4: Codegen Macro (20 sec, 5 tests)
pio test -e esp32-s3-devkitc-1 -f test_fix4_codegen_macro

# Fix #5: Dual-Core (1 min, 7 tests)
pio test -e esp32-s3-devkitc-1 -f test_fix5_dual_core

# Hardware Stress (30+ min, 5 tests) - OPTIONAL
pio test -e esp32-s3-devkitc-1 -f test_hardware_stress
```

---

## Expected Metrics

| Metric | Target | Typical |
|--------|--------|---------|
| Snapshot overhead | < 50 μs | 15-20 μs |
| Audio latency | < 20 ms | 10-15 ms |
| Render FPS | > 200 | 220-250 |
| Memory leak | < 1 KB | 0 bytes |
| Temperature | < 70°C | 55-65°C |

---

## Troubleshooting

**Tests won't upload:**
```bash
# Check USB port
ls /dev/tty.usbmodem*

# Update platformio.ini if needed
test_port = /dev/tty.usbmodem212401
```

**I2S timeout failures:**
- Check microphone connected (pins 12, 13, 14)
- Verify power (3.3V)

**Low FPS:**
- Check temperature (thermal throttling)
- Verify WiFi not overloaded

**Memory leaks:**
- Run test longer to confirm
- Check for task cleanup

---

## Manual Tests Required

1. **Microphone Disconnect Test:**
   - Run test with mic connected
   - Disconnect during operation
   - Verify timeout logs (1/second max)
   - Reconnect and verify recovery

2. **Code Review:**
   ```bash
   grep "PATTERN_AUDIO_START" src/generated_patterns.h
   ```

---

## Documentation

- `test/README.md` - Overview
- `test/TEST_EXECUTION_GUIDE.md` - Detailed guide
- `TEST_SUITE_SUMMARY.md` - Complete summary

---

**Ready to test?** Run: `cd firmware && pio test -e esp32-s3-devkitc-1`

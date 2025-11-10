---
title: "K1.node1 Task 11: Hardware Validation - Quick Reference"
type: "Implementation"
project: "K1.node1"
project_code: "K1N"
version: "v1.0"
date: "2025-11-10"
status: "reference"
intent: "Quick lookup guide for hardware validation tests"
doc_id: "K1NImpl_TASK11_QUICK_REFERENCE_v1.0_20251110"
tags: ["reference","quick-guide","task11"]
---

# K1.node1 Task 11: Hardware Validation - Quick Reference

**Last Updated:** November 10, 2025

---

## Command Cheatsheet

### Build & Upload
```bash
# Build hardware test firmware
cd firmware
pio run -e esp32-s3-hwtest

# Upload to device
pio run -e esp32-s3-hwtest -t upload

# Build and upload in one command
pio run -e esp32-s3-hwtest -t upload
```

### Run Tests
```bash
# All hardware tests
pio test -e esp32-s3-hwtest -f test_hardware_validation

# Single category (LED driver)
pio test -e esp32-s3-hwtest -f test_hardware_validation/test_hw_led_driver.cpp

# Verbose output
pio test -e esp32-s3-hwtest --verbose

# View results
cat .pio/test/esp32-s3-hwtest/output.txt
```

### Automation Scripts
```bash
# Full validation suite (5 min stress test)
python tools/hw_test/run_hw_validation.py --device k1-reinvented.local --duration 300

# Analyze results
python tools/hw_test/analyze_telemetry.py hw_test_results.json

# Generate sine wave test audio
python tools/hw_test/audio_test_generator.py --type sine --freq 440 --duration 10 --output test_440hz.wav

# Generate metronome test audio
python tools/hw_test/audio_test_generator.py --type metronome --bpm 120 --duration 300 --output test_120bpm.wav
```

### REST API Queries
```bash
# Device info
curl http://k1-reinvented.local/api/device/info | jq

# Performance metrics
curl http://k1-reinvented.local/api/device/performance | jq

# RMT probe telemetry (if implemented)
curl http://k1-reinvented.local/api/rmt | jq

# Current parameters
curl http://k1-reinvented.local/api/params | jq

# Switch pattern
curl -X POST http://k1-reinvented.local/api/pattern -d '{"id": 1}'
```

---

## Test Categories Quick Lookup

### LED Driver (7 tests)
- **TC-LED-001:** RMT timing (logic analyzer)
- **TC-LED-002:** Dual-channel sync (automated)
- **TC-LED-003:** FPS stability (30 min)
- **TC-LED-004:** Color accuracy (photoresistor)
- **TC-LED-005:** Buffer geometry
- **TC-LED-006:** RMT refill probe
- **TC-LED-007:** Hot-swap behavior

**Key Metrics:** FPS 180-220, RMT gap < 50µs, color ±2 LSB

---

### Audio Input (8 tests)
- **TC-AUDIO-001:** I2S init & recovery
- **TC-AUDIO-002:** Sample rate (44.1kHz ±0.5%)
- **TC-AUDIO-003:** FFT accuracy (±1 bin)
- **TC-AUDIO-004:** Noise floor (< -40 dB)
- **TC-AUDIO-005:** Dynamic range
- **TC-AUDIO-006:** Beat detection (>95%)
- **TC-AUDIO-007:** I2S timeout (100ms)
- **TC-AUDIO-008:** Audio latency (< 50ms)

**Key Metrics:** FFT ±1 bin, beat >95%, latency <50ms

---

### Memory (6 tests)
- **TC-MEM-001:** Boot heap baseline
- **TC-MEM-002:** Pattern switch leak (100 cycles)
- **TC-MEM-003:** Scratch buffer cap (64 KB)
- **TC-MEM-004:** Stack safety
- **TC-MEM-005:** Heap fragmentation
- **TC-MEM-006:** OTA heap headroom

**Key Metrics:** Heap delta < 1 KB, fragmentation < 50%

---

### Real-Time (6 tests)
- **TC-RT-001:** FPS stability
- **TC-RT-002:** Timing breakdown
- **TC-RT-003:** Audio snapshot latency
- **TC-RT-004:** Frame jitter (< 2ms)
- **TC-RT-005:** Concurrent load
- **TC-RT-006:** Worst-case timing

**Key Metrics:** Jitter < 2ms, latency < 20ms

---

### Power (6 tests)
- **TC-PWR-001:** Idle power (< 200 mA)
- **TC-PWR-002:** Full brightness (< 2.5A)
- **TC-PWR-003:** Average power (0.8-1.2A)
- **TC-PWR-004:** Thermal (< 70°C)
- **TC-PWR-005:** Brownout (4.5V)
- **TC-PWR-006:** Current spikes

**Key Metrics:** Temp < 70°C, current < 2.5A

---

### Graph System (8 tests)
- **TC-GRAPH-001:** Baseline execution
- **TC-GRAPH-002:** Stateful nodes
- **TC-GRAPH-003:** Single audio snapshot
- **TC-GRAPH-004:** RGB clamping
- **TC-GRAPH-005:** Scratch buffer bounds
- **TC-GRAPH-006:** Hot pattern switch
- **TC-GRAPH-007:** Param updates
- **TC-GRAPH-008:** Error handling

**Key Metrics:** Zero crashes, seamless transitions

---

### Network (6 tests)
- **TC-NET-001:** API latency (< 100ms)
- **TC-NET-002:** Rate limiting
- **TC-NET-003:** WebSocket updates
- **TC-NET-004:** Concurrent clients
- **TC-NET-005:** mDNS discovery
- **TC-NET-006:** WiFi reconnect

**Key Metrics:** Latency < 100ms, WebSocket stable

---

### End-to-End (6 tests)
- **TC-E2E-001:** Audio-reactive rendering
- **TC-E2E-002:** Beat synchronization
- **TC-E2E-003:** User workflow (web UI)
- **TC-E2E-004:** Multi-pattern playlist
- **TC-E2E-005:** Factory reset
- **TC-E2E-006:** 8-hour soak test

**Key Metrics:** 8 hours uptime, zero crashes

---

## Pass/Fail Thresholds

| Metric | Target | Failure |
|--------|--------|---------|
| FPS | 180-220 | < 170 or > 230 |
| RMT Gap | < 50µs | > 100µs |
| Audio Latency | < 20ms | > 50ms |
| Free Heap | > 100 KB | < 80 KB |
| CPU Temp | < 70°C | > 80°C |
| Current Draw | < 1.5A | > 2.5A |
| Beat Accuracy | > 95% | < 90% |
| FFT Bin Error | ±1 bin | > 2 bins |
| API Latency | < 100ms | > 200ms |
| Frame Jitter | < 2ms | > 5ms |

---

## Troubleshooting

### Device Unreachable
```bash
# Check network connection
ping k1-reinvented.local

# Find IP address
arp -a | grep esp32

# Use IP instead of hostname
curl http://192.168.1.104/api/device/info
```

### Upload Fails
```bash
# List serial ports
pio device list

# Specify port manually
pio run -e esp32-s3-hwtest -t upload --upload-port /dev/ttyUSB0

# Check permissions
sudo usermod -a -G dialout $USER  # Linux
```

### Tests Timeout
```bash
# Increase timeout in test
TEST_TIMEOUT=30000  # 30 seconds (in test code)

# Reduce test duration
python tools/hw_test/run_hw_validation.py --duration 60
```

---

## File Locations

### Documentation
```
docs/04-planning/
  K1NPlan_TASK11_HARDWARE_VALIDATION_STRATEGY_v1.0_20251110.md

docs/09-implementation/
  K1NImpl_TASK11_HW_TEST_SPECIFICATIONS_v1.0_20251110.md
  K1NImpl_TASK11_TEST_AUTOMATION_GUIDE_v1.0_20251110.md
  K1NImpl_TASK11_EXECUTIVE_SUMMARY_v1.0_20251110.md
  K1NImpl_TASK11_QUICK_REFERENCE_v1.0_20251110.md (this file)
```

### Test Code
```
firmware/test/test_hardware_validation/
  test_hw_led_driver.cpp
  test_hw_audio_input.cpp
  test_hw_memory.cpp
  test_hw_realtime.cpp
  test_hw_power.cpp
  test_hw_graph_system.cpp
  test_hw_network.cpp
  test_hw_e2e.cpp

firmware/test/test_utils/
  hw_test_helpers.h
  telemetry_capture.h
  audio_signal_gen.h
  visual_validator.h
```

### Automation Scripts
```
tools/hw_test/
  run_hw_validation.py
  analyze_telemetry.py
  audio_test_generator.py
  check_regression.py
  long_duration_test.py
```

### CI/CD
```
.github/workflows/
  hardware-validation.yml
  nightly-validation.yml
```

---

## Hardware Setup Diagram

```
┌─────────────┐
│ PC (Ubuntu) │
│  - PlatformIO
│  - Serial Monitor
│  - Test Scripts
└─────┬───────┘
      │ USB
      v
┌──────────────────────────────┐
│ ESP32-S3 DevKitC-1           │
│  GPIO 8  → LED Strip 1       │
│  GPIO 9  → LED Strip 2       │
│  GPIO 10 → I2S WS (Mic)      │
│  GPIO 11 → I2S SCK (Mic)     │
│  GPIO 12 → I2S SD (Mic)      │
└──────────────────────────────┘
      │ 5V, 3A
      v
┌───────────────┐
│ USB Power     │
│ Meter         │
└───────────────┘
```

---

## Timeline

**Week 1 (Nov 11-15):**
- Day 1-2: Setup test bench, implement harness
- Day 3-4: Implement 65 test cases
- Day 5: First full test run

**Week 2 (Nov 18-22):**
- Day 1-2: Fix failures, re-run tests
- Day 3: CI/CD integration
- Day 4-5: Documentation, handoff

**Milestone:** All tests passing by November 20, 2025

---

## Success Criteria

- [ ] 60/65 tests passing (92%)
- [ ] All P0 tests passing
- [ ] Zero crashes in 30-min stress test
- [ ] Baseline metrics documented
- [ ] CI/CD pipeline operational

---

## Contact

**Questions:** QA Team (qa-team@k1node1.example.com)
**Support:** Firmware Team (firmware-team@k1node1.example.com)

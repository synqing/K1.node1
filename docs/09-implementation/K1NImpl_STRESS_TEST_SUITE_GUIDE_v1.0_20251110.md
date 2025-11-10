# K1.node1 Stress Test Suite Guide

## Overview

The K1.node1 stress testing suite provides comprehensive long-duration stability validation across 5 critical subsystems:

1. **Pattern Stability** - Single pattern execution for 6 hours, FPS degradation monitoring
2. **Pattern Switching** - Rapid pattern cycling (every 2s) to verify state cleanup
3. **Memory Pressure** - 1000 alloc/dealloc cycles detecting fragmentation and leaks
4. **Audio Input Stress** - I2S microphone simulation at max rate for 1 hour
5. **RMT Transmission** - Maximum complexity LED rendering for 30 minutes

## Files

- **`firmware/test/test_stress_suite.cpp`** (191 lines) - 5 executable stress tests with Unity framework
- **`tools/run_stress_test.py`** (256 lines) - Orchestrator: starts tests, collects REST API telemetry
- **`tools/analyze_stress_results.py`** (287 lines) - Analyzer: validates results against criteria
- **`tools/stress_test.json`** (115 lines) - Configuration: test params, pass criteria, thermal limits

## Quick Start

### Run Unit Tests on Device

```bash
# Build and upload firmware with debug telemetry enabled
pio run -e esp32-s3-devkitc-1-debug --target upload

# Run stress tests via serial (results via Unity framework)
pio test -e esp32-s3-devkitc-1 -f test_stress_suite --test-port /dev/tty.usbmodem*

# Watch console output for PASS/FAIL verdicts
```

### Run Integration Tests (REST API orchestration)

```bash
# 1. Boot device, ensure WiFi connected to 192.168.1.104
# 2. Run orchestrator (collects metrics every 30 seconds)
python3 tools/run_stress_test.py \
  --device http://192.168.1.104 \
  --config tools/stress_test.json \
  --output stress_results \
  --duration 24.0

# 3. Analyze results
python3 tools/analyze_stress_results.py \
  stress_results/stress_results.csv \
  --config tools/stress_test.json
```

## Test Specifications

### TEST 1: Long-Duration Pattern Execution
- **Purpose:** Detect FPS degradation and cumulative memory leaks
- **Duration:** 6 hours (real) / 60 seconds (test)
- **Pattern:** Gradient (44.5 FPS target)
- **Success Criteria:**
  - FPS > 42.3 (42.3 = 44.5 * 0.95, 5% tolerance)
  - Heap leak < 20KB
  - Heap leak < 5%
  - Errors < 3

### TEST 2: Pattern Switching
- **Purpose:** Verify state cleanup during rapid pattern changes
- **Duration:** 2 hours (real) / 120 seconds (test)
- **Switch Interval:** Every 2 seconds
- **Patterns:** 5 patterns cycling
- **Success Criteria:**
  - Minimum 60 switches completed
  - Total heap leak < 100KB
  - Zero allocation failures
  - Error count = 0

### TEST 3: Memory Pressure
- **Purpose:** Detect heap fragmentation from dynamic allocation
- **Cycles:** 1000 alloc/dealloc pairs
- **Alloc Size:** 2048 bytes per cycle
- **Success Criteria:**
  - Zero allocation failures
  - Final heap delta < 10KB
  - Heap delta < 2%

### TEST 4: Audio Input Stress
- **Purpose:** Verify I2S microphone and Goertzel DFT stability
- **Duration:** 1 hour (real) / 60 seconds (test)
- **Sample Rate:** 16000 Hz
- **Chunk Size:** 512 samples (~32ms)
- **Success Criteria:**
  - >95% of chunks processed successfully
  - I2S timeouts < 2
  - Zero DFT computation errors

### TEST 5: RMT LED Transmission
- **Purpose:** Measure RMT refill timing under maximum complexity
- **Duration:** 30 minutes (real) / 30 seconds (test)
- **Pattern:** Bloom (30.1 FPS target, 300 LEDs)
- **Success Criteria:**
  - FPS > 27.1 (30.1 * 0.9, 10% tolerance)
  - RMT max gap < 50ms
  - RMT gap outliers < 5%

## Pass/Fail Criteria

### Overall Verdict
- **PASS** when all 5 tests pass individual criteria
- **FAIL** if any test fails criteria or crashes

### Thermal Safety
- Sustained max: 70°C
- Peak max: 80°C
- Shutdown: 85°C (emergency halt)

### Memory Safety
- Minimum free heap: 200KB
- Allocation failure threshold: 5% of total

### Error Code Limits
```json
{
  "i2s_timeout": 3 max per 1-hour run,
  "rmt_error": 3 max per 30-minute run,
  "heap_alloc_fail": 1 max (hard limit),
  "pattern_error": 3 max per 2-hour run
}
```

## Telemetry Collection

The orchestrator captures metrics every 30 seconds via REST API:

```csv
timestamp,test_name,fps,heap_free_bytes,cpu_percent,error_count,thermal_celsius
2025-11-10T10:00:00,pattern_01,44.5,400000,65.2,0,35
2025-11-10T10:00:30,pattern_01,44.3,399500,65.1,0,36
```

### Metrics Exposed by Firmware

The firmware REST API must implement:

```
GET /api/metrics
  {
    "fps": 44.5,
    "heap_free_bytes": 400000,
    "cpu_percent": 65.2,
    "error_count": 0,
    "thermal_celsius": 35
  }

GET /api/stress/status
  {
    "test_id": 1,
    "running": true,
    "crashed": false,
    "crash_reason": null,
    "timestamp_ms": 1234567890
  }

POST /api/stress/start
  Request: { "test_id": 1 }
  Response: { "status": "OK" }
```

## Analysis Output

The analyzer produces:

1. **Summary Table** (concise metrics per test)
   ```
   Test                      FPS          Heap Delta         Errors     Status
   long_duration_pattern     44.1         -2,000B (-0.5%)    0          PASS
   pattern_switching         40.1         -1,000B (-0.3%)    0          PASS
   ...
   ```

2. **Detailed Report** (per-test diagnostics)
   - Min/max/avg FPS with degradation curve
   - Heap utilization with leak detection
   - Thermal max, CPU avg, error counts
   - Per-criterion pass/fail with reasons

3. **CSV Output** (for plotting/analysis)
   - Raw telemetry samples for trend analysis
   - FPS degradation curve
   - Heap growth curve
   - Thermal profile

4. **Exit Code**
   - `0` = All tests PASS
   - `1` = Any test FAILED

## Running Overnight (24+ Hours)

For production validation:

```bash
# Start device with timestamp
echo "[$(date)] Starting 24-hour stress test..."

# Run orchestrator (--duration 24.0 for full day)
python3 tools/run_stress_test.py \
  --device http://192.168.1.104 \
  --config tools/stress_test.json \
  --output stress_results_$(date +%Y%m%d_%H%M%S) \
  --duration 24.0 &

# Monitor in background
nohup python3 tools/run_stress_test.py ... > stress_test.log 2>&1 &

# Check status periodically
tail -f stress_test.log

# Analyze after completion
python3 tools/analyze_stress_results.py \
  stress_results_*/stress_results.csv \
  --config tools/stress_test.json --verbose
```

## Troubleshooting

### Test Hangs or Device Resets
- Check REST API is responding: `curl http://192.168.1.104/api/device/info`
- Verify WiFi connection stability
- Check thermal limits (may cause watchdog reset)
- Review firmware logs for allocation failures

### High FPS Degradation
- Check CPU load (>85% sustained = stability issue)
- Verify pattern rendering complexity hasn't increased
- Look for memory leaks (negative heap delta over time)

### Memory Leaks Detected
- Analyze CSV heap growth curve (should be flat or slightly negative)
- Check error code logs for allocation failures
- Review recent pattern or audio changes

### Thermal Runaway
- Ensure device has adequate cooling
- Check if thermal sensor is accurate (compare to ambient)
- Verify CPU not stuck at 100%

## Implementation Details

### Unit Test Framework
- Uses PlatformIO Unity framework (`test_framework = unity`)
- Runs on device via serial (`pio test -e esp32-s3-devkitc-1`)
- Tests execute sequentially; each test resets metrics
- Results logged via `LOG_INFO()` macro (visible in serial monitor)

### Orchestrator Architecture
- HTTP client (REST) + telemetry aggregator
- Polls device every 30 seconds
- Handles network timeouts gracefully (retries up to 5x)
- Saves CSV for post-analysis

### Analyzer Architecture
- CSV parser + linear regression for degradation curves
- Per-test metrics aggregation
- Criterion validation with detailed failure reasons
- Supports verbose diagnostics mode

## Success Indicators

After 24-hour run, you should see:

1. **FPS Curves** - Flat or slight upward trend (no degradation)
   - Gradient: 44-45 FPS throughout
   - Spectrum: 33-34 FPS throughout
   - Bloom: 29-31 FPS throughout

2. **Heap Curves** - Stable, no linear growth
   - May fluctuate within 5KB
   - Eventual slight decrease (garbage collection)

3. **Error Counts** - Near zero
   - Expect 0 hard failures (alloc, DFT NaN)
   - <3 soft errors (I2S timeout, RMT gap)

4. **Thermal Profile** - Stable <70°C sustained
   - Initial warm-up to 40-45°C
   - Plateau for duration
   - No sharp spikes (indicates load issue)

5. **Overall Verdict** - **PASS**
   - All 5 tests pass criteria
   - No crashes or watchdog resets
   - Consistent behavior end-to-end

## Related Documentation

- Architecture: `docs/01-architecture/K1NArch_SPEC_*.md`
- Phase reports: `docs/09-reports/K1NReport_*.md`
- Implementation: `docs/09-implementation/GRAPH_TROUBLESHOOTING.md`

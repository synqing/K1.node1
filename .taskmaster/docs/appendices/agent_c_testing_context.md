---
author: Claude Agent (from Phase 2D1 Master Strategy)
date: 2025-11-05
status: published
intent: Technical context for Agent C (QA/Validation Engineer) executing hardware validation and stress testing
references:
  - ../../PHASE_2_MASTER_PRD.txt (Workstream C)
  - ../../../docs/06-resources/testing_standards.md
  - ../../../firmware/test/ (test framework)
---

# Agent C: QA/Validation Engineer Context Appendix

## Role & Responsibilities

**Engineer:** QA & Validation Specialist
**Primary Focus:** Hardware validation, stress testing, regression testing, performance profiling
**Workstreams:** QA & Testing (Workstream C, Weeks 1-2), Continuous validation (Weeks 2-14)
**Timeline:**
- Weeks 1-2: Validation of Phase 2D1 + Graph PoC
- Weeks 3-14: Continuous integration testing + performance monitoring
**Deliverable Deadline:** Nov 13, 8 AM (decision gate evidence package)

---

## Task Ownership (Master PRD Tasks)

**Week 1-2 QA Workstream (Workstream C):**
- **Task 11:** Hardware Validation Testing → device stability, 100 boot cycles
- **Task 12:** Stress Testing & Stability → pattern cycling, WiFi recovery, thermal monitoring
- **Task 13:** Code Quality & Coverage Review → test coverage, static analysis, documentation

**Week 2-3 PoC Support:**
- Performance profiling for Graph PoC (FPS, memory, latency)
- Regression testing to ensure fixes don't break existing functionality
- Hardware compatibility validation (WiFi boards, audio interfaces)

**Week 3-14 Continuous Quality:**
- Daily smoke tests (pattern execution, error codes)
- Weekly regression test suite
- Monthly performance baseline updates

---

## QA Validation Strategy

### Phase 2D1 Fixes: Test Cases

**Fix #1: WiFi Credentials Removal**
- [ ] No hardcoded strings in source: `grep -r "SpectraLabs\|supersecret" firmware/`
- [ ] BLE provisioning flow: device → QR code → phone app → WiFi connection
- [ ] Device boots without stored credentials
- [ ] Security scan: 0 embedded secrets detected

**Fix #2: I2S Timeout Protection**
- [ ] I2S read succeeds normally (200+ iterations)
- [ ] Timeout triggered on MCLK disconnect: device recovers < 1 second
- [ ] Error code logged (ERROR_I2S_TIMEOUT)
- [ ] Pattern continues running after recovery (no artifacts)

**Fix #3: WebServer Bounds Checking**
- [ ] Normal requests (valid Content-Length) processed correctly
- [ ] Oversized requests rejected: Content-Length > 8192 bytes → HTTP 500
- [ ] Malformed requests (negative Content-Length) → HTTP 400
- [ ] Fuzzing: 1000+ random payloads → 0 crashes, 0 heap corruption

**Fix #4: Error Code Registry**
- [ ] All error paths call `error_record()` API
- [ ] Circular buffer wraps correctly (100-error limit)
- [ ] API endpoint `/api/errors` returns last 100 errors
- [ ] Telemetry integration working (errors logged with timestamp)

---

## Hardware Testing Protocols

### Boot Cycle Test (100x)

**Purpose:** Ensure device boots reliably after Phase 2D1 fixes
**Expected:** 0 failures, < 30 seconds per boot

```bash
#!/bin/bash
# test_boot_cycles.sh

ITERATIONS=100
BOOT_TIMEOUT=30

for i in $(seq 1 $ITERATIONS); do
    echo "Boot cycle $i/$ITERATIONS..."

    # Power off
    power_off_device
    sleep 1

    # Power on
    power_on_device

    # Wait for ready signal (device outputs "READY" on UART)
    timeout $BOOT_TIMEOUT bash -c 'while ! grep -q "READY" /dev/ttyUSB0; do sleep 0.1; done'

    if [ $? -ne 0 ]; then
        echo "FAIL: Boot cycle $i timed out after $BOOT_TIMEOUT seconds"
        exit 1
    fi

    echo "OK: Boot $i completed"
done

echo "PASS: All $ITERATIONS boot cycles succeeded"
```

**Success Criteria:**
- ✅ All 100 boots complete without hangs
- ✅ Average boot time < 30 seconds
- ✅ No memory leaks detected between boots

---

### Stress Testing: Pattern Cycling

**Purpose:** Ensure firmware stability under pattern rapid switching
**Expected:** 1000+ pattern changes without crash

```bash
#!/bin/bash
# test_pattern_stress.sh

ITERATIONS=1000
PATTERN_CHANGE_INTERVAL=0.1  # 100ms between changes

for i in $(seq 1 $ITERATIONS); do
    # Send random pattern change
    PATTERN_ID=$((RANDOM % 15))
    curl -s "http://device.local/api/pattern/$PATTERN_ID" > /dev/null

    # Check device still responds
    if ! curl -s "http://device.local/api/status" | grep -q "alive"; then
        echo "FAIL: Device not responding after pattern $i"
        exit 1
    fi

    # Monitor for errors
    ERRORS=$(curl -s "http://device.local/api/errors?limit=1" | jq '.errors | length')
    if [ "$ERRORS" -gt 10 ]; then
        echo "FAIL: Too many errors ($ERRORS) at iteration $i"
        exit 1
    fi

    sleep $PATTERN_CHANGE_INTERVAL

    if [ $((i % 100)) -eq 0 ]; then
        echo "Progress: $i/$ITERATIONS pattern changes"
    fi
done

echo "PASS: All $ITERATIONS pattern changes succeeded"
```

**Success Criteria:**
- ✅ 1000+ pattern changes with 0 crashes
- ✅ No audio glitches (verified by listening + audio spectrum analysis)
- ✅ Memory usage stable (no leaks detected)
- ✅ Error count < 10 over entire test

---

### Hardware Latency Measurement

**Purpose:** Measure device latency for decision gate criterion (<10ms)
**Expected:** p50 < 3ms, p95 < 8ms, p99 < 10ms

```cpp
// firmware/test/test_latency.cpp
#include <gtest/gtest.h>
#include "firmware.h"

TEST(LatencyTest, HTTPResponseTime) {
    std::vector<uint32_t> response_times;

    for (int i = 0; i < 100; i++) {
        uint32_t start = xTaskGetTickCount();

        // Send HTTP request
        http_request_t req = {
            .method = HTTP_GET,
            .path = "/api/status"
        };
        http_response_t resp = handle_http_request(&req);

        uint32_t end = xTaskGetTickCount();
        response_times.push_back(end - start);
    }

    // Calculate percentiles
    std::sort(response_times.begin(), response_times.end());

    uint32_t p50 = response_times[50];
    uint32_t p95 = response_times[95];
    uint32_t p99 = response_times[99];

    printf("Latency p50=%ums p95=%ums p99=%ums\n", p50, p95, p99);

    ASSERT_LT(p50, 3) << "p50 latency exceeded 3ms";
    ASSERT_LT(p95, 8) << "p95 latency exceeded 8ms";
    ASSERT_LT(p99, 10) << "p99 latency exceeded 10ms";
}
```

---

### Temperature Monitoring (24h)

**Purpose:** Ensure firmware doesn't thermal throttle or overheat
**Expected:** Device temperature < 65°C sustained

```bash
#!/bin/bash
# test_temperature_24h.sh

DURATION_SECONDS=$((24 * 60 * 60))  # 24 hours
TEMP_THRESHOLD=65  # Celsius
SAMPLE_INTERVAL=60  # Every 60 seconds

STRESS_SCRIPT="./test_pattern_stress.sh &"
eval $STRESS_SCRIPT
STRESS_PID=$!

start_time=$(date +%s)

while [ $(( $(date +%s) - start_time )) -lt $DURATION_SECONDS ]; do
    # Read temperature from device API
    TEMP=$(curl -s "http://device.local/api/status" | jq '.temperature')
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$TIMESTAMP] Temperature: ${TEMP}°C"

    if (( $(echo "$TEMP > $TEMP_THRESHOLD" | bc -l) )); then
        echo "FAIL: Temperature exceeded threshold: ${TEMP}°C > ${TEMP_THRESHOLD}°C"
        kill $STRESS_PID
        exit 1
    fi

    sleep $SAMPLE_INTERVAL
done

echo "PASS: 24-hour temperature test completed (max < 65°C)"
kill $STRESS_PID
```

---

## Test Pyramid Structure

### Unit Tests (Bottom Layer)
- Test individual functions: error_record(), beat_detector_update()
- Execution environment: host machine (pytest/gtest)
- Coverage target: >= 95%
- Frequency: on every commit (CI/CD)

### Integration Tests (Middle Layer)
- Test subsystems: WiFi + HTTP + Error telemetry
- Execution environment: device simulator or real hardware
- Test matrix: all 15 patterns × all parameters
- Frequency: daily

### Hardware Tests (Top Layer)
- Test end-to-end: device → fixtures → validation
- Execution environment: real ESP32-S3 + test fixtures
- Test matrix: boot cycles, pattern stress, thermal
- Frequency: weekly

**Coverage Targets:**
```
Unit tests:          90+ tests × 2-5 assertions each ≈ 250+ assertions
Integration tests:   15 patterns × 50 scenarios ≈ 750+ assertions
Hardware tests:      100 boots + 1000 patterns + 24h temp ≈ 1100+ assertions
────────────────────────────────────────────────────
Total: 2100+ test assertions
```

---

## Regression Testing Checklist

**Run every time firmware changes:**

```bash
#!/bin/bash
# run_regression_suite.sh

echo "1. Compile check..."
cmake --build . && echo "✓ Compile succeeded" || { echo "✗ Compile failed"; exit 1; }

echo "2. Unit tests..."
./build/firmware_tests && echo "✓ Unit tests passed" || { echo "✗ Unit tests failed"; exit 1; }

echo "3. Boot cycle test..."
./test/test_boot_cycles.sh && echo "✓ Boot cycles passed" || { echo "✗ Boot cycles failed"; exit 1; }

echo "4. Pattern execution..."
./test/test_all_patterns.sh && echo "✓ All patterns work" || { echo "✗ Pattern test failed"; exit 1; }

echo "5. Memory profiling..."
./test/test_memory_usage.sh && echo "✓ Memory OK" || { echo "✗ Memory test failed"; exit 1; }

echo "6. Error handling..."
./test/test_error_codes.sh && echo "✓ Error handling OK" || { echo "✗ Error test failed"; exit 1; }

echo ""
echo "✓✓✓ REGRESSION SUITE PASSED ✓✓✓"
```

---

## Performance Profiling Methodology

### FPS Measurement

```cpp
// In firmware, measure each frame
uint32_t frame_start = xTaskGetTickCount();

// Render 1000 frames
for (int i = 0; i < 1000; i++) {
    pattern_update();
    pattern_render(framebuffer);
}

uint32_t frame_end = xTaskGetTickCount();
float avg_frame_ms = (frame_end - frame_start) / 1000.0f;
float fps = 1000.0f / avg_frame_ms;

printf("FPS: %.1f (%.1f ms/frame)\n", fps, avg_frame_ms);
```

**Acceptance Criteria:**
- Baseline (hardcoded): 60 FPS
- Graph system: >= 58.8 FPS (< 2% overhead)

### Memory Profiling

```bash
# Using esp-idf memory analyzer
valgrind --leak-check=full --show-leak-kinds=all \
    ./firmware_simulator 2>&1 | grep -E "LEAK|LOST|ERROR"

# Device memory check
curl http://device.local/api/memory | jq '.free_heap'
```

**Acceptance Criteria:**
- Heap fragmentation: < 20%
- Free heap: > 100 KB sustained
- No memory leaks detected (valgrind)

---

## Documentation Validation Standards

**For each deliverable, validate:**
- [ ] All code examples compile without error
- [ ] All API docs match implementation
- [ ] All references to line numbers are accurate
- [ ] All file paths exist (no broken references)
- [ ] All technical claims are measurable

**Example validation test:**
```bash
#!/bin/bash
# validate_documentation.sh

echo "Checking file references..."
for ref in $(grep -o '`[^`]*\.cpp:[0-9]*`' *.md); do
    FILE=$(echo $ref | cut -d: -f1)
    LINE=$(echo $ref | cut -d: -f2)
    if [ ! -f "$FILE" ] || [ $(wc -l < "$FILE") -lt "$LINE" ]; then
        echo "BROKEN: $ref"
    fi
done

echo "Checking code examples compile..."
for example in docs/examples/*.cpp; do
    gcc -c "$example" -o /tmp/test.o 2>/dev/null || echo "BROKEN: $example"
done
```

---

## Decision Gate Evidence Package (Nov 13, 8 AM)

**You will deliver:**

1. **test_results_phase2d1.json**
   ```json
   {
     "fixes": {
       "wifi_credentials": { "passed": true, "duration_ms": 45 },
       "i2s_timeout": { "passed": true, "recovery_ms": 850 },
       "webserver_bounds": { "passed": true, "fuzzing_tests": 1000 },
       "error_codes": { "passed": true, "coverage_pct": 98 }
     },
     "summary": {
       "total_tests": 2100,
       "passed": 2100,
       "failed": 0,
       "timestamp": "2025-11-13T08:00:00Z"
     }
   }
   ```

2. **performance_profile_graph_poc.json**
   ```json
   {
     "fps": { "baseline": 60.0, "graph_system": 58.9, "overhead_pct": 1.8 },
     "memory": { "per_node_bytes": 4200, "state_bytes": 3100, "overhead_bytes": 1100 },
     "latency": { "p50_ms": 2.1, "p95_ms": 7.8, "p99_ms": 9.7 },
     "stability": { "24h_crashes": 0, "pattern_changes": 1000 }
   }
   ```

3. **recommendation.md**
   - Clear GO/NO-GO recommendation based on evidence
   - Explanation of any borderline criteria
   - Risk assessment for decision

---

**Appendix Status:** READY FOR EXECUTION
**First Task:** Task 11 (Hardware validation) - Nov 6-7
**Deliverable Deadline:** Nov 13, 8 AM (decision gate package)
**Last Sync:** 2025-11-05

# Audio Testing Quick Reference

**Quick access guide for audio enhancement testing workflows**

---

## 🚀 Quick Start

### Run All Audio Tests
```bash
cd firmware
pio test -e esp32-s3-devkitc-1 -f test_audio_features
pio test -e esp32-s3-devkitc-1 -f test_audio_tempo
```

### Run Specific Test
```bash
pio test -e esp32-s3-devkitc-1 -f test_spectral_centroid
```

### Run Performance Benchmarks
```bash
pio test -e esp32-s3-audio-test -f test_audio_performance
```

---

## 📊 Performance Targets (Quick Reference)

| Phase | CPU Budget | Memory Free | Status |
|-------|-----------|-------------|--------|
| **Baseline** | 2000 µs | 200 KB | ✅ Current |
| **Phase 0** | 2200 µs | 198 KB | 🎯 Target |
| **Phase 1** | 2650 µs | 191 KB | 🎯 Target |
| **Phase 2** | 3550 µs | 181 KB | 🎯 Target |
| **Phase 3** | 4050 µs | 177 KB | 🎯 Target |
| **Phase 4** | 4850 µs | 171 KB | 🎯 Target |
| **Phase 5** | 5050 µs | 163 KB | 🎯 Target |
| **Hard Limits** | < 8333 µs (120 FPS) | > 100 KB | ⚠️ Do Not Exceed |

---

## 🧪 Test Data Generation

### Generate All Test Signals
```bash
python tools/generate_test_signals.py \
  --output-dir firmware/test_data/audio_samples \
  --duration 30
```

### Generate Specific Signal Types
```python
# In Python
from generate_test_signals import *

# Metronome at 120 BPM
signal = generate_metronome(120, duration_s=30)
write_wav("metronome_120bpm.wav", signal)

# Sine wave at 440 Hz
signal = generate_sine(440, duration_s=5)
write_wav("sine_440hz.wav", signal)
```

---

## 📈 Performance Profiling

### Device-Side Profiling
```cpp
#include "diagnostics/audio_profiler.h"

// In audio processing loop
PROFILE_AUDIO_FRAME_START();

PROFILE_SPECTRAL_CENTROID([]() {
    calculate_spectral_centroid();
});

PROFILE_ONSET_DETECTION([]() {
    detect_onsets();
});

PROFILE_AUDIO_FRAME_END();

// Print report after 1000 frames
g_audio_profiler.print_report();
```

### Memory Leak Detection
```cpp
#include "diagnostics/memory_monitor.h"

MemoryMonitor monitor;
monitor.start();

// Run for 10 minutes
for (int i = 0; i < 60000; i++) {
    process_audio_frame();
    monitor.sample();
    delay(10);
}

monitor.print_report();  // Shows leaks if any
```

---

## ✅ Pre-Commit Checklist

Copy-paste into PR description:

```markdown
## Audio Enhancement Pre-Commit Checklist

- [ ] Unit tests pass: `pio test -f test_audio_features`
- [ ] Integration tests pass: `pio test -f test_audio_integration`
- [ ] Performance benchmarks run: `pio test -f test_audio_performance`
- [ ] CPU usage within budget (see report)
- [ ] Memory delta < 5KB
- [ ] FPS ≥ 100 (audio) and ≥ 120 (render)
- [ ] Visual smoke test on device (uploaded & verified)
- [ ] No new compiler warnings
- [ ] Documentation updated (if new feature)
```

---

## 🎵 Test Music Library

### Genre Test Tracks (30s each)

| Genre | File | BPM | Focus |
|-------|------|-----|-------|
| Electronic | `electronic_128bpm.wav` | 128 | Beat sync, tempo |
| Classical | `classical_strings.wav` | N/A | Harmonics, spectral |
| Pop | `pop_vocals.wav` | 120 | Onset, valence |
| Ambient | `ambient_drone.wav` | N/A | Silence, arousal |
| Rock | `rock_backbeat.wav` | 140 | Percussive, snare |

### Download Test Library
```bash
bash tools/download_test_data.sh
```

---

## 🔧 Common Test Patterns

### Test Beat Phase Accuracy
```cpp
void test_beat_phase_120bpm() {
    float signal[16000 * 10];
    SyntheticSignals::generate_metronome(signal, 16000*10, 120.0f, 16000.0f);

    init_tempo_goertzel_constants();

    for (int i = 0; i < 16000*10; i += 256) {
        memcpy(sample_history, signal + i, 256 * sizeof(float));
        update_tempo();
    }

    uint16_t bin = find_closest_tempo_bin(120.0f);
    TEST_ASSERT_IN_RANGE(tempi[bin].phase, -M_PI, M_PI);
    TEST_ASSERT_GREATER_THAN(0.5f, tempo_confidence);
}
```

### Test CPU Performance
```cpp
void test_cpu_within_budget() {
    TestTimer timer;
    const int iterations = 1000;

    timer.start();
    for (int i = 0; i < iterations; i++) {
        process_audio_frame();  // Your audio processing
    }
    timer.stop();

    float avg_us = timer.elapsed_us() / iterations;
    TEST_ASSERT_LESS_THAN(PHASE_X_TARGET_US, avg_us);
}
```

### Test Memory Leak
```cpp
void test_no_memory_leak() {
    MemorySnapshot start = MemorySnapshot::capture();

    for (int i = 0; i < 60000; i++) {  // 10 min @ 100 FPS
        process_audio_frame();
        vTaskDelay(pdMS_TO_TICKS(10));
    }

    MemorySnapshot end = MemorySnapshot::capture();
    TEST_ASSERT_NO_MEMORY_LEAK(start.free_heap, end.free_heap, 1024);
}
```

---

## 📊 Visualization Tools

### Generate Performance Charts
```bash
# Phase comparison
python tools/visualize_performance.py \
  --phase-comparison \
    docs/benchmarks/phase_0.json \
    docs/benchmarks/phase_1.json \
  --output docs/benchmarks/phase_comparison.png

# Feature breakdown
python tools/visualize_performance.py \
  --feature-breakdown docs/benchmarks/phase_1_breakdown.json \
  --output docs/benchmarks/feature_breakdown.png
```

### Track Performance Over Time
```bash
python tools/track_performance.py
# Appends to docs/benchmarks/performance_history.json
# Generates docs/benchmarks/performance_trends.png
```

---

## 🤖 CI/CD Integration

### GitHub Actions Status
Check: `https://github.com/your-org/K1.node1/actions`

### Trigger Manual Test Run
```bash
git commit --allow-empty -m "trigger CI tests"
git push origin feature/your-branch
```

### Check Regression Detection
```bash
python tools/check_performance_regression.py \
  --baseline docs/benchmarks/baseline_phase_X.json \
  --current .pio/test/results.json \
  --tolerance 10
```

Exit code:
- `0` = No regression
- `1` = Regression detected (CI will fail)

---

## 📝 Test Reporting

### Generate Test Report
```bash
python tools/parse_test_results.py \
  .pio/test/ \
  --json docs/reports/test_results_$(date +%Y%m%d).json
```

### Validate Beat Detection
```bash
# After capturing telemetry from device
python tools/validate_beat_detection.py \
  --telemetry /tmp/device_telemetry.json \
  --expected-bpm 120 \
  --duration 30
```

---

## 🎯 Success Criteria

### Quality Gates (Must Pass)

| Gate | Threshold | Command |
|------|-----------|---------|
| Unit tests | ≥ 95% pass | `pio test -f test_audio_*` |
| CPU usage | < 5050 µs/frame | Check benchmark output |
| Memory free | > 163 KB | Check benchmark output |
| Audio FPS | ≥ 100 | Check FPS counter |
| Render FPS | ≥ 120 | Check FPS counter |
| Latency | < 50 ms | Check timestamp delta |
| Stability | 24 hours | Stress test |

### Phase-Specific Goals

**Phase 0 (Beat Tracking)**:
- BPM detection: ≥ 90% accuracy (±5% tolerance, 60-180 BPM)
- Beat confidence on silence: < 0.2
- Beat confidence on metronome: > 0.6

**Phase 1 (Spectral Features)**:
- Spectral centroid accuracy: ≥ 85% (±10% of expected)
- Onset detection recall: ≥ 80%
- Onset detection precision: ≥ 70%

---

## 🚨 Troubleshooting

### Test Fails: "CPU budget exceeded"
```bash
# Profile to find bottleneck
pio run -e esp32-s3-audio-test -t upload
# Connect serial, observe profiling output
# Optimize hot path or adjust budget
```

### Test Fails: "Memory leak detected"
```bash
# Enable heap tracing
# Check for missing free() calls
# Use MemoryMonitor to pinpoint leak location
```

### Test Fails: "Beat detection inaccurate"
```bash
# Tune threshold: edit tempo.h BEAT_THRESHOLD
# Adjust confidence gate: edit pattern_audio_interface.h
# Test with simpler metronome first
```

### CI/CD Fails: "Performance regression"
```bash
# Check regression report in GitHub Actions logs
# Optimize regressed feature
# Or adjust tolerance if intentional increase
```

---

## 📚 Full Documentation

For complete details, see:

1. **Test Strategy**: `/docs/04-planning/audio_enhancement_test_strategy.md`
2. **Code Templates**: `/docs/07-resources/audio_test_code_templates.md`
3. **Delivery Summary**: `/docs/09-reports/audio_test_framework_delivery_summary.md`
4. **Enhancement Proposal**: `/docs/04-planning/audio_visualization_enhancement_proposal.md`

---

## 💡 Tips & Tricks

### Speed Up Test Iteration
```bash
# Run only failed tests
pio test -e esp32-s3-devkitc-1 --list-tests  # Find test name
pio test -e esp32-s3-devkitc-1 -f test_specific_test
```

### Debug Test on Device
```ini
; In platformio.ini
[env:esp32-s3-debug-test]
extends = env:esp32-s3-devkitc-1
build_flags =
    ${env:esp32-s3-devkitc-1.build_flags}
    -DUNITY_VERBOSE_OUTPUT=1
    -DTEST_DEBUG=1
```

### Export Telemetry for Analysis
```cpp
// Add to REST API: GET /api/audio/export-telemetry
// Returns JSON with beat_signal[], tempo_magnitude[], etc.
// Feed to validate_beat_detection.py
```

---

**Last Updated**: 2025-11-07
**Maintained By**: Test Engineering Team

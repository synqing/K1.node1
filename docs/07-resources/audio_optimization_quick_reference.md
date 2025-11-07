# Audio Optimization Quick Reference

**Quick reference card for audio performance optimization tasks.**

---

## Phase 1: Compiler Flags (20-30% speedup)

### Update platformio.ini
```ini
build_flags =
    -O3                    # Speed optimization
    -ffast-math            # Relaxed IEEE 754
    -funroll-loops         # Auto loop unrolling
    -fno-math-errno        # Skip errno on sqrt/log
    -flto                  # Link-time optimization
```

### Expected Impact
- Goertzel: -20%
- Tempo: -15%
- Build time: +10% (one-time cost)

---

## Phase 2: IRAM Placement (13% speedup)

### Mark Hot Functions
```cpp
// goertzel.cpp
IRAM_ATTR float calculate_magnitude_of_bin(uint16_t bin) {
    // ... inner loop runs 96,000×/sec
}

IRAM_ATTR static float calculate_magnitude_of_tempo(uint16_t bin) {
    // ... tempo Goertzel
}
```

### Check IRAM Budget
```bash
pio run -t size | grep .iram
# Target: <200KB (safe headroom for 384KB total)
```

---

## Phase 3: Fast Math (10% speedup)

### Replace sqrt() in Goertzel
```cpp
#include "fast_math.h"

// BEFORE
float magnitude = sqrt(magnitude_squared);

// AFTER
float magnitude = fast_magnitude(magnitude_squared);
// 3× faster, 1% error (acceptable for audio viz)
```

### Validate Accuracy
```cpp
// Debug build: compare outputs
#ifdef DEBUG_TELEMETRY
    float mag_hw = sqrt(mag_sq);
    float mag_fast = fast_magnitude(mag_sq);
    float error = fabsf(mag_hw - mag_fast) / mag_hw;
    if (error > 0.02f) {  // >2% error = warning
        LOG_WARN("fast_math", "High error: %.1f%%", error * 100);
    }
#endif
```

---

## Phase 4: ESP-DSP Integration (3-5× faster normalization)

### Add Dependency
```ini
lib_deps =
    espressif/esp-dsp@^1.4.0
```

### Replace Manual Loops
```cpp
// tempo.cpp:216 - Normalize novelty curve
#if __has_include(<esp_dsp.h>)
    #include <esp_dsp.h>
    dsps_mulc_f32(novelty_curve, novelty_curve_normalized,
                  NOVELTY_HISTORY_LENGTH, auto_scale, 1, 1);
#else
    // Fallback: manual loop
#endif

// tempo.cpp:207 - Max-find
#if __has_include(<esp_dsp.h>)
    float max_val;
    uint16_t max_idx;
    dsps_maxf_f32(novelty_curve, NOVELTY_HISTORY_LENGTH, &max_val, &max_idx);
#else
    // Fallback
#endif
```

---

## Phase 5: Staggering (2× faster tempo response)

### Implement 4-Bin-Per-Frame Schedule
```cpp
// tempo.cpp:update_tempo()
void update_tempo() {
    static uint16_t calc_bin = 0;

    normalize_novelty_curve();  // Every frame

    // Process 4 bins per frame (16-frame cycle = 320ms)
    uint16_t max_bin = (NUM_TEMPI - 1) * MAX_TEMPO_RANGE;
    for (int i = 0; i < 4; i++) {
        if (calc_bin < max_bin) {
            calculate_tempi_magnitudes(calc_bin++);
        }
    }

    if (calc_bin >= max_bin) {
        calc_bin = 0;
    }
}
```

### Trade-offs
- **Before**: 1.8ms/frame, 640ms cycle
- **After**: 3.2ms/frame, 320ms cycle (2× faster response)

---

## Phase 6: Profiling

### Enable Debug Telemetry
```ini
build_flags =
    -DDEBUG_TELEMETRY=1
```

### Add Profiling to Hot Paths
```cpp
#include "profiling.h"

void calculate_magnitudes() {
    PROFILE_FUNCTION();  // Automatic timing

    for (int i = 0; i < NUM_FREQS; i++) {
        PROFILE_SECTION("goertzel_loop");
        // ... Goertzel inner loop
    }
}
```

### View Results
```bash
# Via Serial (115200 baud)
# Call ProfileScope::print_all_stats() periodically

# Via REST API
curl http://192.168.1.104/api/performance | jq .
```

---

## Measurement Workflow

### 1. Capture Baseline
```bash
# Build with DEBUG_TELEMETRY=1
pio run -e esp32-s3-devkitc-1-debug -t upload

# Wait 30s for stats to accumulate
sleep 30

# Capture metrics
curl http://192.168.1.104/api/performance > baseline.json
```

### 2. Apply Optimizations
```bash
# Edit code (e.g., add IRAM_ATTR)
# Rebuild and upload
pio run -e esp32-s3-devkitc-1-debug -t upload
```

### 3. Compare Results
```bash
curl http://192.168.1.104/api/performance > optimized.json
python3 tools/compare_perf.py baseline.json optimized.json
```

### 4. Validate Thresholds
| Metric | Target | Acceptable |
|--------|--------|------------|
| `goertzel_avg_us` | <1200 | <1500 |
| `tempo_avg_us` | <3200 | <4000 |
| `free_heap_kb` | >250 | >200 |
| `audio_age_ms` | <20 | <50 |

**Pass criteria**: ≥80% of metrics meet targets

---

## Debugging Performance Regressions

### High Goertzel Time (>1500μs)
1. Check IRAM placement: `pio run -t size | grep .iram`
2. Verify `-O3 -ffast-math` flags
3. Profile inner loop: `PROFILE_SECTION("goertzel_inner")`

### High Tempo Time (>4000μs)
1. Reduce bins per frame (4 → 2)
2. Check ESP-DSP usage (`dsps_mulc_f32`)
3. Validate novelty buffer alignment

### Low Free Heap (<200KB)
1. Check IRAM overflow (spilling to heap)
2. Reduce spectrogram averaging (8 → 4 frames)
3. Use `heap_caps_print_heap_info(MALLOC_CAP_8BIT)`

### High Audio Latency (>50ms)
1. Check audio sync contention (torn reads)
2. Reduce `max_retries` in `get_audio_snapshot()`
3. Profile `commit_audio_data()` (memory barriers)

---

## Common Pitfalls

### ❌ Don't: Add logging to hot paths
```cpp
// BAD (adds 200μs per call)
for (int i = 0; i < block_size; i++) {
    LOG_DEBUG("sample[%d] = %f", i, sample_ptr[i]);  // ❌
}
```

### ✓ Do: Use profiling instead
```cpp
// GOOD (zero-cost when DEBUG_TELEMETRY=0)
PROFILE_SECTION("goertzel_loop");
for (int i = 0; i < block_size; i++) {
    // ... processing
}
```

### ❌ Don't: Premature optimization
- Always profile BEFORE optimizing
- Measure baseline, then compare

### ✓ Do: Validate improvements
- Capture metrics before/after
- Check for regressions (heap, latency)

---

## Rollback Procedure

### If Optimization Causes Issues
```bash
# Revert code changes
git checkout HEAD -- firmware/src/audio/

# Rebuild baseline
pio run -e esp32-s3-devkitc-1 -t upload

# Verify recovery
curl http://192.168.1.104/api/performance
```

### If IRAM Overflow
```
ld.lld: error: section '.iram0.text' will not fit in region 'iram0_0_seg'
```

**Solution**: Remove `IRAM_ATTR` from least-critical functions
1. Start with `normalize_novelty_curve()`
2. Then `calculate_magnitude_of_tempo()`
3. Keep `calculate_magnitude_of_bin()` in IRAM (highest impact)

---

## Quick Wins (1-2 hours)

1. **Compiler flags**: Edit `platformio.ini`, rebuild → -20% Goertzel time
2. **fast_inv_sqrt()**: Replace `sqrt()` in 1 location → -10% Goertzel time
3. **IRAM placement**: Add `IRAM_ATTR` to 2 functions → -13% Goertzel time

**Total**: ~35% speedup in <2 hours

---

## Related Documents

- [Full Optimization Strategy](../05-analysis/audio_performance_optimization_strategy.md)
- [Profiling Infrastructure](../../firmware/src/profiling.h)
- [Fast Math Library](../../firmware/src/fast_math.h)
- [Performance Comparison Tool](../../tools/compare_perf.py)

---

**EOF**

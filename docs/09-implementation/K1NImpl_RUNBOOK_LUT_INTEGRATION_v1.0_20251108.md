# LUT Integration Runbook - K1.node1 Firmware

**Owner:** Firmware Team
**Date:** 2025-11-07
**Status:** proposed
**Scope:** Step-by-step implementation guide for LUT system integration
**Related:**
- [K1NArch_SPEC_LUT_SYSTEM_ARCHITECTURE_v1.0_20251108.md](../01-architecture/K1NArch_SPEC_LUT_SYSTEM_ARCHITECTURE_v1.0_20251108.md)
- [ADR-0017-lut-optimization-system.md](../02-adr/ADR-0017-lut-optimization-system.md)
- [K1NAnalysis_ANALYSIS_LUT_OPTIMIZATION_v1.0_20251108.md](../05-analysis/K1NAnalysis_ANALYSIS_LUT_OPTIMIZATION_v1.0_20251108.md)
**Tags:** `implementation`, `runbook`, `lut`, `integration`

---

## Overview

This runbook provides a complete, step-by-step procedure for integrating the Look-Up Table (LUT) optimization system into the K1.node1 firmware. Follow these steps sequentially to ensure proper implementation and validation.

**Estimated Time**: 4-6 hours
**Risk Level**: Low (non-breaking changes with fallback)
**Rollback Time**: 15 minutes

---

## Pre-Integration Checklist

### Prerequisites
- [ ] Firmware builds successfully on main branch
- [ ] PlatformIO environment configured for ESP32-S3
- [ ] Test device available with serial monitor
- [ ] Memory profiler enabled (`CONFIG_HEAP_TRACING=y`)
- [ ] Current performance baseline recorded

### Baseline Metrics to Record
```bash
# Record these BEFORE integration:
- Current FPS: _______
- Frame time (ms): _______
- Free heap (bytes): _______
- Core 0 CPU usage: _______%
- Pattern count: _______
```

---

## Phase 1: LUT System Setup

### Step 1.1: Create LUT Directory Structure

```bash
# From project root
mkdir -p firmware/src/lut
cd firmware/src/lut

# Verify structure
ls -la
# Should be empty directory ready for LUT files
```

### Step 1.2: Implement Easing LUT System

**Create `firmware/src/lut/easing_lut.h`**:
```cpp
#pragma once

#include <stdint.h>
#include <cmath>

// Configuration
#define EASING_LUT_ENTRIES 256

// LUT arrays (defined in .cpp)
extern float easing_lut_linear[EASING_LUT_ENTRIES];
extern float easing_lut_quad_in[EASING_LUT_ENTRIES];
extern float easing_lut_quad_out[EASING_LUT_ENTRIES];
extern float easing_lut_quad_in_out[EASING_LUT_ENTRIES];
extern float easing_lut_cubic_in[EASING_LUT_ENTRIES];
extern float easing_lut_cubic_out[EASING_LUT_ENTRIES];
extern float easing_lut_cubic_in_out[EASING_LUT_ENTRIES];
extern float easing_lut_quart_in[EASING_LUT_ENTRIES];
extern float easing_lut_quart_out[EASING_LUT_ENTRIES];
extern float easing_lut_quart_in_out[EASING_LUT_ENTRIES];

// Initialization
void init_easing_luts();

// Fast lookup functions
inline float easing_clip(float val) {
    return fmax(0.0f, fmin(1.0f, val));
}

inline float ease_linear_fast(float t) {
    int idx = (int)(easing_clip(t) * (EASING_LUT_ENTRIES - 1));
    return easing_lut_linear[idx];
}

// ... (implement other ease_*_fast functions)
```

**Create `firmware/src/lut/easing_lut.cpp`**:
```cpp
#include "easing_lut.h"

// Define arrays
float easing_lut_linear[EASING_LUT_ENTRIES];
// ... (define other arrays)

// Original easing functions for LUT generation
static float ease_linear(float t) { return t; }
static float ease_quad_in(float t) { return t * t; }
// ... (implement other functions)

void init_easing_luts() {
    for (int i = 0; i < EASING_LUT_ENTRIES; i++) {
        float t = i / (float)(EASING_LUT_ENTRIES - 1);

        easing_lut_linear[i] = ease_linear(t);
        easing_lut_quad_in[i] = ease_quad_in(t);
        // ... (populate other arrays)
    }
}
```

### Step 1.3: Implement Color LUT System

**Create `firmware/src/lut/color_lut.h`**:
```cpp
#pragma once

#include "../types.h"
#include <cmath>

#define HSV_HUE_ENTRIES 256

extern CRGBF hue_wheel[HSV_HUE_ENTRIES];

void init_hue_wheel_lut();

inline CRGBF hsv_fast(float h, float s, float v) {
    h = fmax(0.0f, fmin(1.0f, h));
    s = fmax(0.0f, fmin(1.0f, s));
    v = fmax(0.0f, fmin(1.0f, v));

    int hue_idx = (int)(h * (HSV_HUE_ENTRIES - 1));
    CRGBF base = hue_wheel[hue_idx];

    // Apply saturation
    float desat = 1.0f - s;
    base.r = base.r * s + desat;
    base.g = base.g * s + desat;
    base.b = base.b * s + desat;

    // Apply value
    base.r *= v;
    base.g *= v;
    base.b *= v;

    return base;
}
```

### Step 1.4: Implement Palette Cache System

**Create `firmware/src/lut/palette_lut.h`**:
```cpp
#pragma once

#include <cmath>

#define PALETTE_CACHE_ENTRIES 256

struct PaletteCache {
    float samples[PALETTE_CACHE_ENTRIES];
    bool initialized;

    PaletteCache() : initialized(false) {}

    void init(const float* source, int source_size);

    inline float get(float position) const {
        if (!initialized) return 0.0f;
        position = fmax(0.0f, fmin(1.0f, position));
        int idx = (int)(position * (PALETTE_CACHE_ENTRIES - 1));
        return samples[idx];
    }
};
```

---

## Phase 2: Main Application Integration

### Step 2.1: Update main.cpp Initialization

**Edit `firmware/src/main.cpp`**:

```cpp
// Add includes at the top
#include "lut/easing_lut.h"
#include "lut/color_lut.h"
#include "lut/palette_lut.h"

void setup() {
    Serial.begin(115200);
    Serial.println("K1.node1 starting...");

    // ... existing hardware init ...

    // ADD: Initialize LUT systems
    Serial.print("Initializing LUTs... ");
    uint32_t lut_start = millis();

    init_easing_luts();
    init_hue_wheel_lut();

    uint32_t lut_time = millis() - lut_start;
    Serial.printf("done (%dms)\n", lut_time);

    // Verify memory usage
    Serial.printf("Free heap after LUT init: %d bytes\n",
                  esp_get_free_heap_size());

    // ... rest of setup ...
}
```

### Step 2.2: Create Compatibility Header

**Create `firmware/src/lut_compat.h`**:

```cpp
#pragma once

// Compatibility macros for gradual migration
#ifdef USE_LUT_OPTIMIZATION
    #include "lut/easing_lut.h"
    #include "lut/color_lut.h"

    // Redirect original functions to LUT versions
    #define ease_linear(t) ease_linear_fast(t)
    #define ease_quad_in(t) ease_quad_in_fast(t)
    #define ease_quad_out(t) ease_quad_out_fast(t)
    #define ease_quad_in_out(t) ease_quad_in_out_fast(t)
    #define ease_cubic_in(t) ease_cubic_in_fast(t)
    #define ease_cubic_out(t) ease_cubic_out_fast(t)
    #define ease_cubic_in_out(t) ease_cubic_in_out_fast(t)

    // Redirect HSV function
    #define hsv(h,s,v) hsv_fast(h,s,v)
#endif
```

### Step 2.3: Update Build Configuration

**Edit `firmware/platformio.ini`**:

```ini
[env:esp32-s3-devkitc-1]
platform = espressif32
board = esp32-s3-devkitc-1
framework = arduino

build_flags =
    -DBOARD_HAS_PSRAM
    -DUSE_LUT_OPTIMIZATION   ; Enable LUT system
    -DLUT_DEBUG_STATS        ; Enable performance metrics
    -O2                      ; Optimize for speed

monitor_speed = 115200
monitor_filters = esp32_exception_decoder
```

---

## Phase 3: Pattern Migration

### Step 3.1: Update Pattern Headers

**Edit `firmware/src/generated_patterns.h`**:

```cpp
// Add at top of file
#ifdef USE_LUT_OPTIMIZATION
    #include "lut/easing_lut.h"
    #include "lut/color_lut.h"
    #include "lut/palette_lut.h"
#endif

// Update HSV function to use LUT when available
CRGBF hsv(float h, float s, float v) {
    #ifdef USE_LUT_OPTIMIZATION
        return hsv_fast(h, s, v);  // Use LUT version
    #else
        // ... existing HSV implementation ...
    #endif
}
```

### Step 3.2: Migrate Specific Patterns (Example)

**Before** (in pattern function):
```cpp
void draw_rainbow_wave(float time, const PatternParameters& params) {
    for (int i = 0; i < NUM_LEDS; i++) {
        float position = i / (float)NUM_LEDS;
        float wave = ease_cubic_in_out(position);  // Original
        float hue = fmod(time * 0.1f + wave, 1.0f);
        leds[i] = hsv(hue, 1.0f, params.brightness);  // Original
    }
}
```

**After** (automatic with macros):
```cpp
void draw_rainbow_wave(float time, const PatternParameters& params) {
    for (int i = 0; i < NUM_LEDS; i++) {
        float position = i / (float)NUM_LEDS;
        float wave = ease_cubic_in_out(position);  // Now uses LUT
        float hue = fmod(time * 0.1f + wave, 1.0f);
        leds[i] = hsv(hue, 1.0f, params.brightness);  // Now uses LUT
    }
}
```

---

## Phase 4: Validation and Testing

### Step 4.1: Build and Flash

```bash
# Clean build
cd firmware
pio run --target clean

# Build with LUTs enabled
pio run

# Flash to device
pio run --target upload

# Monitor output
pio device monitor
```

### Step 4.2: Verify LUT Initialization

Expected serial output:
```
K1.node1 starting...
Initializing LUTs... done (4ms)
Free heap after LUT init: 282440 bytes
LUT Memory usage:
  - Easing LUTs: 10240 bytes
  - HSV Hue Wheel: 3072 bytes
  - Total: 13312 bytes
```

### Step 4.3: Performance Validation

**Add temporary debug code to `main.cpp`**:

```cpp
void led_task(void* param) {
    uint32_t frame_count = 0;
    uint32_t last_report = millis();

    while (true) {
        uint32_t frame_start = micros();

        // Render frame
        update_leds(current_time);

        uint32_t frame_time = micros() - frame_start;
        frame_count++;

        // Report every second
        if (millis() - last_report >= 1000) {
            float avg_frame_time = frame_time / 1000.0f;
            float fps = 1000000.0f / frame_time;

            Serial.printf("Performance: %.1f FPS, %.2fms frame time\n",
                         fps, avg_frame_time);

            last_report = millis();
            frame_count = 0;
        }

        vTaskDelay(1);
    }
}
```

### Step 4.4: Accuracy Testing

**Create `firmware/test/test_lut_accuracy.cpp`**:

```cpp
#include <unity.h>
#include "../src/lut/easing_lut.h"
#include "../src/easing_functions.h"

void test_easing_accuracy() {
    init_easing_luts();

    const float TOLERANCE = 0.002f;  // ±0.2%

    for (int i = 0; i <= 100; i++) {
        float t = i / 100.0f;

        // Test each easing function
        float orig = ease_cubic_in_out_original(t);
        float lut = ease_cubic_in_out_fast(t);
        float error = fabs(orig - lut);

        TEST_ASSERT_LESS_THAN(TOLERANCE, error);
    }
}

void setup() {
    UNITY_BEGIN();
    RUN_TEST(test_easing_accuracy);
    UNITY_END();
}
```

---

## Phase 5: Performance Benchmarking

### Step 5.1: Create Benchmark Suite

**Create `firmware/src/diagnostics/lut_benchmark.h`**:

```cpp
#pragma once

void benchmark_easing_performance();
void benchmark_hsv_performance();
void benchmark_palette_performance();
void run_all_lut_benchmarks();
```

**Create `firmware/src/diagnostics/lut_benchmark.cpp`**:

```cpp
#include "lut_benchmark.h"
#include <esp_timer.h>

void benchmark_hsv_performance() {
    const int ITERATIONS = 10000;
    uint32_t start, end;

    // Benchmark original
    start = esp_timer_get_time();
    for (int i = 0; i < ITERATIONS; i++) {
        float h = (i % 256) / 255.0f;
        CRGBF color = hsv_original(h, 1.0f, 1.0f);
    }
    end = esp_timer_get_time();
    uint32_t original_time = end - start;

    // Benchmark LUT
    start = esp_timer_get_time();
    for (int i = 0; i < ITERATIONS; i++) {
        float h = (i % 256) / 255.0f;
        CRGBF color = hsv_fast(h, 1.0f, 1.0f);
    }
    end = esp_timer_get_time();
    uint32_t lut_time = end - start;

    Serial.printf("HSV Benchmark Results:\n");
    Serial.printf("  Original: %d us (%d ns/call)\n",
                  original_time, original_time * 1000 / ITERATIONS);
    Serial.printf("  LUT:      %d us (%d ns/call)\n",
                  lut_time, lut_time * 1000 / ITERATIONS);
    Serial.printf("  Speedup:  %.2fx\n",
                  (float)original_time / lut_time);
}
```

### Step 5.2: Run Benchmarks

Add to `main.cpp` setup():
```cpp
#ifdef LUT_DEBUG_STATS
    run_all_lut_benchmarks();
#endif
```

Expected output:
```
=== LUT Performance Benchmarks ===
Easing Functions:
  Original: 8420 us (842 ns/call)
  LUT:      1230 us (123 ns/call)
  Speedup:  6.85x

HSV Conversion:
  Original: 15600 us (1560 ns/call)
  LUT:      2340 us (234 ns/call)
  Speedup:  6.67x

Overall System:
  FPS Before: 78
  FPS After:  139
  Improvement: +78%
```

---

## Troubleshooting Guide

### Issue: Build Fails with "undefined reference"

**Symptom**: Linker errors for LUT functions
**Cause**: LUT .cpp files not included in build
**Solution**:
```bash
# Ensure files are in correct location
ls firmware/src/lut/
# Should show: easing_lut.cpp, color_lut.cpp, etc.

# Force rebuild
pio run --target clean
pio run
```

### Issue: No Performance Improvement

**Symptom**: FPS unchanged after LUT integration
**Cause**: LUTs not being used, macros not active
**Solution**:
```cpp
// Verify in platformio.ini:
build_flags = -DUSE_LUT_OPTIMIZATION

// Add debug output in pattern:
#ifdef USE_LUT_OPTIMIZATION
    Serial.println("LUT optimization ACTIVE");
#else
    Serial.println("WARNING: LUT optimization DISABLED");
#endif
```

### Issue: Memory Overflow

**Symptom**: Crash during init or "allocation failed"
**Cause**: Insufficient free heap
**Solution**:
```cpp
// Reduce LUT resolution in easing_lut.h:
#define EASING_LUT_ENTRIES 128  // Was 256

// Or disable some curves:
// Comment out unused easing functions
```

### Issue: Visual Artifacts

**Symptom**: Banding or stepping in gradients
**Cause**: LUT resolution too low
**Solution**:
```cpp
// Increase resolution (if memory allows):
#define EASING_LUT_ENTRIES 512
#define HSV_HUE_ENTRIES 512

// Or add interpolation:
inline float ease_cubic_interpolated(float t) {
    float scaled = t * (EASING_LUT_ENTRIES - 1);
    int idx = (int)scaled;
    float frac = scaled - idx;

    if (idx >= EASING_LUT_ENTRIES - 1) {
        return easing_lut_cubic_in_out[EASING_LUT_ENTRIES - 1];
    }

    float v0 = easing_lut_cubic_in_out[idx];
    float v1 = easing_lut_cubic_in_out[idx + 1];
    return v0 + (v1 - v0) * frac;  // Linear interpolation
}
```

---

## Rollback Procedure

If issues arise, rollback is simple:

### Quick Rollback (Disable LUTs)

1. Edit `platformio.ini`:
```ini
build_flags =
    -DBOARD_HAS_PSRAM
    # -DUSE_LUT_OPTIMIZATION  # Commented out
```

2. Rebuild and flash:
```bash
pio run --target clean
pio run --target upload
```

### Full Rollback (Remove LUT System)

1. Delete LUT directory:
```bash
rm -rf firmware/src/lut/
```

2. Remove initialization from `main.cpp`:
```cpp
// Remove these lines:
// init_easing_luts();
// init_hue_wheel_lut();
```

3. Remove includes from pattern files

4. Rebuild and test

---

## Post-Integration Checklist

### Performance Validation
- [ ] FPS increased by >50%
- [ ] Frame time < 8.33ms (120 FPS target)
- [ ] No frame drops during pattern switches
- [ ] CPU usage reduced by >25%

### Functional Validation
- [ ] All patterns render correctly
- [ ] No visual artifacts or banding
- [ ] Color accuracy maintained
- [ ] Smooth animations preserved

### System Validation
- [ ] Memory usage within budget (+15KB max)
- [ ] No memory leaks after 1 hour
- [ ] Survives 100 pattern switches
- [ ] WiFi/OTA updates still functional

### Documentation Updates
- [ ] Update project README with LUT feature
- [ ] Add performance metrics to docs
- [ ] Update memory map documentation
- [ ] Create release notes entry

---

## Appendix A: Complete File List

Files to create:
```
firmware/src/lut/
├── easing_lut.h
├── easing_lut.cpp
├── color_lut.h
├── color_lut.cpp
├── palette_lut.h
└── palette_lut.cpp

firmware/src/
├── lut_compat.h (new)
└── main.cpp (modified)

firmware/src/diagnostics/
├── lut_benchmark.h
└── lut_benchmark.cpp

firmware/test/
└── test_lut_accuracy.cpp
```

Files to modify:
```
firmware/platformio.ini
firmware/src/generated_patterns.h
firmware/src/main.cpp
```

---

## Appendix B: Memory Impact Analysis

### Before LUT Integration
```
Free heap: 298,752 bytes
Used heap: 221,528 bytes
Largest free block: 110,592 bytes
```

### After LUT Integration
```
Free heap: 283,440 bytes  (-15,312 bytes)
Used heap: 236,840 bytes  (+15,312 bytes)
Largest free block: 110,592 bytes (unchanged)

Breakdown:
- Easing LUTs: 10,240 bytes (10 curves × 256 × 4)
- HSV Hue Wheel: 3,072 bytes (256 × 12)
- Palette Caches: 2,048 bytes (2 × 256 × 4)
- Total: 15,360 bytes
```

---

## Appendix C: Performance Metrics Template

Use this template to record before/after metrics:

```markdown
## LUT Integration Performance Report

**Date**: _______________
**Device**: ESP32-S3-DevKitC-1
**Firmware Version**: _______________

### Before Integration
- Average FPS: _______________
- Frame time (ms): _______________
- Core 0 CPU: _______________%
- Core 1 CPU: _______________%
- Free heap: _______________ bytes
- Power consumption: _______________ mW

### After Integration
- Average FPS: _______________
- Frame time (ms): _______________
- Core 0 CPU: _______________%
- Core 1 CPU: _______________%
- Free heap: _______________ bytes
- Power consumption: _______________ mW

### Improvements
- FPS increase: _______________%
- Frame time reduction: _______________%
- CPU usage reduction: _______________%
- Power savings: _______________%

### Notes
_________________________________
_________________________________
```

---

## Support and Contact

For issues or questions about LUT integration:

1. Check troubleshooting section above
2. Review [LUT System Architecture](../01-architecture/K1NArch_SPEC_LUT_SYSTEM_ARCHITECTURE_v1.0_20251108.md)
3. Consult [ADR-0017](../02-adr/ADR-0017-lut-optimization-system.md)
4. File issue in project tracker with tag `lut-optimization`

---

## Revision History

- 2025-11-07: Initial runbook created
- (Future): Updates will be logged here

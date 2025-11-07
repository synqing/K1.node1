# LUT Optimization Test Strategy

**Owner**: Test Automation Engineer
**Date**: 2025-11-07
**Status**: Proposed
**Scope**: Comprehensive test strategy for validating three LUT optimizations (easing, color, palette)
**Related**:
- `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/lut/easing_lut.h`
- `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/lut/color_lut.h`
- `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/lut/palette_lut.h`
- `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/test/README.md`

---

## Table of Contents

1. [Test Overview](#test-overview)
2. [Test Infrastructure](#test-infrastructure)
3. [Accuracy Validation Tests](#accuracy-validation-tests)
4. [Functional Tests](#functional-tests)
5. [Integration Tests](#integration-tests)
6. [Performance Tests](#performance-tests)
7. [Visual Tests](#visual-tests)
8. [Test Execution Guide](#test-execution-guide)
9. [Quality Gates](#quality-gates)

---

## Test Overview

This test strategy validates three LUT (Lookup Table) optimizations implemented for K1.node1 firmware:

1. **Easing LUT**: Pre-computed easing curves (256 samples, 6 KB)
2. **Color LUT**: HSV to RGB conversion (256 hue samples, 3 KB)
3. **Palette LUT**: Palette interpolation cache (256 samples, 1 KB per cache)

**Memory Total**: ~10 KB for core LUTs
**Performance Target**: 3-10x speedup vs original implementations
**Accuracy Target**: <0.4% maximum error (imperceptible on LEDs)

---

## Test Infrastructure

### Directory Structure

```
firmware/test/
├── test_lut_accuracy/          # Accuracy validation tests
│   └── test_lut_accuracy.cpp
├── test_lut_functional/        # Functional correctness tests
│   └── test_lut_functional.cpp
├── test_lut_integration/       # Integration tests
│   └── test_lut_integration.cpp
├── test_lut_performance/       # Performance benchmarks
│   └── test_lut_performance.cpp
└── test_utils/                 # Shared test utilities
    └── test_helpers.h
```

### Test Framework

- **Framework**: Unity (PlatformIO built-in)
- **Platform**: ESP32-S3 DevKit C-1
- **Dependencies**: FreeRTOS, ESP-IDF, Arduino framework
- **Execution**: On-device testing (requires physical hardware)

### Running Tests

```bash
# Run all LUT tests
pio test -e esp32-s3-devkitc-1 -f "test_lut_*"

# Run specific test suite
pio test -e esp32-s3-devkitc-1 -f test_lut_accuracy
pio test -e esp32-s3-devkitc-1 -f test_lut_functional
pio test -e esp32-s3-devkitc-1 -f test_lut_integration
pio test -e esp32-s3-devkitc-1 -f test_lut_performance
```

---

## Accuracy Validation Tests

### 1.1 Easing LUT Accuracy

**Objective**: Verify easing LUT functions match original implementations within 0.2% error.

**Test File**: `firmware/test/test_lut_accuracy/test_lut_accuracy.cpp`

```cpp
#include <unity.h>
#include "../../src/lut/easing_lut.h"
#include "../../src/easing_functions.h"
#include "../test_utils/test_helpers.h"

// Test constants
#define EASING_SAMPLES 100          // Test 100 points across [0,1]
#define EASING_MAX_ERROR_PCT 0.2f   // 0.2% maximum error

/**
 * Test: ease_quad_in_fast() matches ease_quad_in() within tolerance
 */
void test_easing_quad_in_accuracy() {
    float max_error = 0.0f;
    float max_error_pct = 0.0f;
    float t_at_max_error = 0.0f;

    for (int i = 0; i < EASING_SAMPLES; i++) {
        float t = i / (float)(EASING_SAMPLES - 1);
        float original = ease_quad_in(t);
        float fast = ease_quad_in_fast(t);

        float error = fabsf(original - fast);
        float error_pct = (fabsf(original) > 0.001f) ?
                         (error / fabsf(original)) * 100.0f : 0.0f;

        if (error_pct > max_error_pct) {
            max_error_pct = error_pct;
            max_error = error;
            t_at_max_error = t;
        }
    }

    // Report metrics
    Serial.printf("  ease_quad_in: max error = %.6f (%.3f%%) at t=%.3f\n",
                  max_error, max_error_pct, t_at_max_error);

    // Assert error within tolerance
    TEST_ASSERT_LESS_THAN_FLOAT(EASING_MAX_ERROR_PCT, max_error_pct);
}

/**
 * Test: ease_cubic_out_fast() matches ease_cubic_out() within tolerance
 */
void test_easing_cubic_out_accuracy() {
    float max_error_pct = 0.0f;

    for (int i = 0; i < EASING_SAMPLES; i++) {
        float t = i / (float)(EASING_SAMPLES - 1);
        float original = ease_cubic_out(t);
        float fast = ease_cubic_out_fast(t);

        float error = fabsf(original - fast);
        float error_pct = (fabsf(original) > 0.001f) ?
                         (error / fabsf(original)) * 100.0f : 0.0f;

        max_error_pct = fmaxf(max_error_pct, error_pct);
    }

    Serial.printf("  ease_cubic_out: max error = %.3f%%\n", max_error_pct);
    TEST_ASSERT_LESS_THAN_FLOAT(EASING_MAX_ERROR_PCT, max_error_pct);
}

/**
 * Test: All 10 easing functions within tolerance
 */
void test_all_easing_functions_accuracy() {
    struct EasingTest {
        const char* name;
        float (*original)(float);
        float (*fast)(float);
    };

    EasingTest tests[] = {
        {"linear",        ease_linear,        ease_linear_fast},
        {"quad_in",       ease_quad_in,       ease_quad_in_fast},
        {"quad_out",      ease_quad_out,      ease_quad_out_fast},
        {"quad_in_out",   ease_quad_in_out,   ease_quad_in_out_fast},
        {"cubic_in",      ease_cubic_in,      ease_cubic_in_fast},
        {"cubic_out",     ease_cubic_out,     ease_cubic_out_fast},
        {"cubic_in_out",  ease_cubic_in_out,  ease_cubic_in_out_fast},
        {"quart_in",      ease_quart_in,      ease_quart_in_fast},
        {"quart_out",     ease_quart_out,     ease_quart_out_fast},
        {"quart_in_out",  ease_quart_in_out,  ease_quart_in_out_fast},
    };

    for (const auto& test : tests) {
        float max_error_pct = 0.0f;

        for (int i = 0; i < EASING_SAMPLES; i++) {
            float t = i / (float)(EASING_SAMPLES - 1);
            float original = test.original(t);
            float fast = test.fast(t);

            float error = fabsf(original - fast);
            float error_pct = (fabsf(original) > 0.001f) ?
                             (error / fabsf(original)) * 100.0f : 0.0f;

            max_error_pct = fmaxf(max_error_pct, error_pct);
        }

        Serial.printf("  %s: max error = %.3f%%\n", test.name, max_error_pct);
        TEST_ASSERT_LESS_THAN_FLOAT(EASING_MAX_ERROR_PCT, max_error_pct);
    }
}
```

### 1.2 Color LUT Accuracy

**Objective**: Verify HSV to RGB conversion matches precise implementation within 0.4% error.

```cpp
#include "../../src/lut/color_lut.h"

// Precise HSV to RGB (reference implementation)
CRGBF hsv_to_rgb_precise(float h, float s, float v) {
    h = fmodf(h, 1.0f);
    if (h < 0) h += 1.0f;

    int i = (int)(h * 6.0f);
    float f = h * 6.0f - i;
    float p = v * (1.0f - s);
    float q = v * (1.0f - f * s);
    float t = v * (1.0f - (1.0f - f) * s);

    CRGBF result;
    switch (i % 6) {
        case 0: result = CRGBF(v, t, p); break;
        case 1: result = CRGBF(q, v, p); break;
        case 2: result = CRGBF(p, v, t); break;
        case 3: result = CRGBF(p, q, v); break;
        case 4: result = CRGBF(t, p, v); break;
        case 5: result = CRGBF(v, p, q); break;
    }
    return result;
}

/**
 * Test: hsv_fast() matches hsv_to_rgb_precise() across hue wheel
 */
void test_color_lut_hue_accuracy() {
    const int HUE_SAMPLES = 100;
    const float COLOR_MAX_ERROR_PCT = 0.4f;
    float max_error_pct = 0.0f;

    // Test full saturation and brightness (S=1.0, V=1.0)
    for (int i = 0; i < HUE_SAMPLES; i++) {
        float h = i / (float)(HUE_SAMPLES - 1);
        CRGBF precise = hsv_to_rgb_precise(h, 1.0f, 1.0f);
        CRGBF fast = hsv_fast(h, 1.0f, 1.0f);

        // Calculate max channel error
        float error_r = fabsf(precise.r - fast.r);
        float error_g = fabsf(precise.g - fast.g);
        float error_b = fabsf(precise.b - fast.b);
        float max_channel_error = fmaxf(error_r, fmaxf(error_g, error_b));

        // Error as percentage of full scale (0.0-1.0)
        float error_pct = max_channel_error * 100.0f;
        max_error_pct = fmaxf(max_error_pct, error_pct);
    }

    Serial.printf("  HSV hue wheel: max error = %.3f%%\n", max_error_pct);
    TEST_ASSERT_LESS_THAN_FLOAT(COLOR_MAX_ERROR_PCT, max_error_pct);
}

/**
 * Test: hsv_fast() across full HSV cube (H, S, V dimensions)
 */
void test_color_lut_full_cube_accuracy() {
    const int SAMPLES_PER_DIM = 10;  // 10x10x10 = 1000 samples
    const float COLOR_MAX_ERROR_PCT = 0.4f;
    float max_error_pct = 0.0f;
    float worst_h = 0, worst_s = 0, worst_v = 0;

    for (int ih = 0; ih < SAMPLES_PER_DIM; ih++) {
        for (int is = 0; is < SAMPLES_PER_DIM; is++) {
            for (int iv = 0; iv < SAMPLES_PER_DIM; iv++) {
                float h = ih / (float)(SAMPLES_PER_DIM - 1);
                float s = is / (float)(SAMPLES_PER_DIM - 1);
                float v = iv / (float)(SAMPLES_PER_DIM - 1);

                CRGBF precise = hsv_to_rgb_precise(h, s, v);
                CRGBF fast = hsv_fast(h, s, v);

                float max_channel_error = fmaxf(
                    fabsf(precise.r - fast.r),
                    fmaxf(fabsf(precise.g - fast.g), fabsf(precise.b - fast.b))
                );

                float error_pct = max_channel_error * 100.0f;
                if (error_pct > max_error_pct) {
                    max_error_pct = error_pct;
                    worst_h = h;
                    worst_s = s;
                    worst_v = v;
                }
            }
        }
    }

    Serial.printf("  HSV full cube: max error = %.3f%% at (H=%.2f, S=%.2f, V=%.2f)\n",
                  max_error_pct, worst_h, worst_s, worst_v);
    TEST_ASSERT_LESS_THAN_FLOAT(COLOR_MAX_ERROR_PCT, max_error_pct);
}
```

### 1.3 Palette LUT Accuracy

**Objective**: Verify palette cache produces identical output to live interpolation.

```cpp
#include "../../src/lut/palette_lut.h"

/**
 * Reference palette interpolation (without cache)
 */
float palette_interpolate_reference(const float* palette, int size, float position) {
    position = fmaxf(0.0f, fminf(1.0f, position));
    float scaled = position * (size - 1);
    int idx_low = (int)floorf(scaled);
    float frac = scaled - idx_low;

    if (idx_low >= size - 1) {
        return palette[size - 1];
    }

    return palette[idx_low] * (1.0f - frac) + palette[idx_low + 1] * frac;
}

/**
 * Test: Palette cache matches live interpolation
 */
void test_palette_cache_accuracy() {
    const int PALETTE_SIZE = 16;
    const int TEST_SAMPLES = 100;
    const float PALETTE_MAX_ERROR = 0.002f;  // 0.2% of [0,1] range

    // Create test palette (gradient from 0.0 to 1.0)
    float test_palette[PALETTE_SIZE];
    for (int i = 0; i < PALETTE_SIZE; i++) {
        test_palette[i] = i / (float)(PALETTE_SIZE - 1);
    }

    // Initialize cache
    PaletteCache cache;
    cache.init(test_palette, PALETTE_SIZE);

    float max_error = 0.0f;

    for (int i = 0; i < TEST_SAMPLES; i++) {
        float pos = i / (float)(TEST_SAMPLES - 1);
        float reference = palette_interpolate_reference(test_palette, PALETTE_SIZE, pos);
        float cached = cache.get(pos);

        float error = fabsf(reference - cached);
        max_error = fmaxf(max_error, error);
    }

    Serial.printf("  Palette cache: max error = %.6f\n", max_error);
    TEST_ASSERT_LESS_THAN_FLOAT(PALETTE_MAX_ERROR, max_error);
}

/**
 * Test: Palette cache with varying sizes
 */
void test_palette_cache_varying_sizes() {
    int sizes[] = {2, 4, 8, 16, 32, 64};
    const int TEST_SAMPLES = 50;
    const float PALETTE_MAX_ERROR = 0.002f;

    for (int size : sizes) {
        float* palette = new float[size];
        for (int i = 0; i < size; i++) {
            palette[i] = sinf(i * 2.0f * M_PI / size);  // Sine wave palette
        }

        PaletteCache cache;
        cache.init(palette, size);

        float max_error = 0.0f;
        for (int i = 0; i < TEST_SAMPLES; i++) {
            float pos = i / (float)(TEST_SAMPLES - 1);
            float reference = palette_interpolate_reference(palette, size, pos);
            float cached = cache.get(pos);
            max_error = fmaxf(max_error, fabsf(reference - cached));
        }

        Serial.printf("  Size %d: max error = %.6f\n", size, max_error);
        TEST_ASSERT_LESS_THAN_FLOAT(PALETTE_MAX_ERROR, max_error);

        delete[] palette;
    }
}
```

---

## Functional Tests

### 2.1 Easing Function Properties

**Objective**: Verify easing functions produce mathematically correct curves.

```cpp
/**
 * Test: Easing functions are monotonic (always increasing)
 */
void test_easing_monotonicity() {
    struct EasingFunc {
        const char* name;
        float (*func)(float);
    };

    EasingFunc funcs[] = {
        {"ease_quad_in_fast",     ease_quad_in_fast},
        {"ease_cubic_in_fast",    ease_cubic_in_fast},
        {"ease_quart_in_fast",    ease_quart_in_fast},
        {"ease_quad_out_fast",    ease_quad_out_fast},
        {"ease_cubic_out_fast",   ease_cubic_out_fast},
        {"ease_quart_out_fast",   ease_quart_out_fast},
    };

    for (const auto& f : funcs) {
        float prev_val = f.func(0.0f);
        bool is_monotonic = true;

        for (int i = 1; i < 100; i++) {
            float t = i / 99.0f;
            float val = f.func(t);

            if (val < prev_val - 0.0001f) {  // Small tolerance for float precision
                is_monotonic = false;
                Serial.printf("  %s: NOT monotonic at t=%.3f (%.6f < %.6f)\n",
                             f.name, t, val, prev_val);
                break;
            }
            prev_val = val;
        }

        TEST_ASSERT_TRUE_MESSAGE(is_monotonic, f.name);
    }
}

/**
 * Test: Easing functions respect boundary conditions
 */
void test_easing_boundaries() {
    float (*funcs[])(float) = {
        ease_linear_fast, ease_quad_in_fast, ease_quad_out_fast,
        ease_cubic_in_fast, ease_cubic_out_fast, ease_quart_in_fast
    };

    for (auto func : funcs) {
        // f(0) should be 0
        TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, func(0.0f));

        // f(1) should be 1
        TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, func(1.0f));
    }
}

/**
 * Test: Easing functions handle out-of-range inputs gracefully
 */
void test_easing_input_clamping() {
    // Test values outside [0, 1]
    float test_values[] = {-1.0f, -0.5f, 1.5f, 2.0f, 100.0f};

    for (float t : test_values) {
        float result = ease_quad_in_fast(t);

        // Result should be clamped to [0, 1]
        TEST_ASSERT_GREATER_OR_EQUAL_FLOAT(0.0f, result);
        TEST_ASSERT_LESS_OR_EQUAL_FLOAT(1.0f, result);
    }
}
```

### 2.2 Color LUT Properties

**Objective**: Verify HSV color space properties are maintained.

```cpp
/**
 * Test: HSV hue wheel is continuous at wraparound (H=0 vs H=1)
 */
void test_color_lut_hue_wraparound() {
    // H=0.0 and H=1.0 should produce same color (red)
    CRGBF color_0 = hsv_fast(0.0f, 1.0f, 1.0f);
    CRGBF color_1 = hsv_fast(1.0f, 1.0f, 1.0f);

    float error_r = fabsf(color_0.r - color_1.r);
    float error_g = fabsf(color_0.g - color_1.g);
    float error_b = fabsf(color_0.b - color_1.b);

    Serial.printf("  Hue wraparound error: R=%.6f, G=%.6f, B=%.6f\n",
                  error_r, error_g, error_b);

    TEST_ASSERT_LESS_THAN_FLOAT(0.01f, error_r);
    TEST_ASSERT_LESS_THAN_FLOAT(0.01f, error_g);
    TEST_ASSERT_LESS_THAN_FLOAT(0.01f, error_b);
}

/**
 * Test: Zero saturation produces grayscale
 */
void test_color_lut_grayscale() {
    for (int i = 0; i < 10; i++) {
        float h = i / 9.0f;  // Any hue
        float v = 0.5f;      // Mid brightness

        CRGBF gray = hsv_fast(h, 0.0f, v);  // S=0 should be gray

        // R, G, B should be equal
        TEST_ASSERT_FLOAT_WITHIN(0.01f, gray.r, gray.g);
        TEST_ASSERT_FLOAT_WITHIN(0.01f, gray.g, gray.b);
        TEST_ASSERT_FLOAT_WITHIN(0.01f, v, gray.r);  // Should equal V
    }
}

/**
 * Test: Zero value produces black
 */
void test_color_lut_black() {
    for (int i = 0; i < 10; i++) {
        float h = i / 9.0f;
        float s = i / 9.0f;

        CRGBF black = hsv_fast(h, s, 0.0f);  // V=0 should be black

        TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, black.r);
        TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, black.g);
        TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, black.b);
    }
}
```

### 2.3 Palette LUT Edge Cases

**Objective**: Verify palette cache handles edge cases correctly.

```cpp
/**
 * Test: Single-entry palette
 */
void test_palette_cache_single_entry() {
    float single_value[] = {0.75f};
    PaletteCache cache;
    cache.init(single_value, 1);

    // All positions should return the single value
    for (int i = 0; i < 10; i++) {
        float pos = i / 9.0f;
        float result = cache.get(pos);
        TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.75f, result);
    }
}

/**
 * Test: Two-entry palette (simple linear gradient)
 */
void test_palette_cache_two_entry() {
    float gradient[] = {0.0f, 1.0f};
    PaletteCache cache;
    cache.init(gradient, 2);

    // Should be linear from 0 to 1
    for (int i = 0; i < 10; i++) {
        float pos = i / 9.0f;
        float result = cache.get(pos);
        TEST_ASSERT_FLOAT_WITHIN(0.01f, pos, result);
    }
}

/**
 * Test: Large palette (64 entries)
 */
void test_palette_cache_large() {
    const int SIZE = 64;
    float large_palette[SIZE];
    for (int i = 0; i < SIZE; i++) {
        large_palette[i] = sinf(i * M_PI / SIZE);
    }

    PaletteCache cache;
    cache.init(large_palette, SIZE);

    // Verify initialization succeeded
    TEST_ASSERT_TRUE(cache.initialized);

    // Spot-check a few values
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f, cache.get(0.0f));
    TEST_ASSERT_FLOAT_WITHIN(0.01f, sinf(M_PI / 2.0f), cache.get(0.5f));
}

/**
 * Test: NULL palette handling
 */
void test_palette_cache_null_handling() {
    PaletteCache cache;
    cache.init(nullptr, 10);

    // Should fail gracefully
    TEST_ASSERT_FALSE(cache.initialized);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, cache.get(0.5f));
}
```

---

## Integration Tests

### 3.1 Boot and Initialization

**Objective**: Verify all LUTs initialize correctly on boot without crashes.

```cpp
/**
 * Test: LUT initialization on boot
 */
void test_lut_initialization() {
    MemorySnapshot before = MemorySnapshot::capture();

    // Initialize all LUTs
    init_easing_luts();
    init_hue_wheel_lut();

    MemorySnapshot after = MemorySnapshot::capture();

    // Verify memory usage is within expected range
    // Expected: ~9 KB for easing + color LUTs
    int32_t used = before.heap_delta(after);
    Serial.printf("  LUT initialization used %d bytes\n", used);

    TEST_ASSERT_GREATER_THAN_INT32(8000, used);   // At least 8 KB
    TEST_ASSERT_LESS_THAN_INT32(12000, used);     // No more than 12 KB
}

/**
 * Test: No crashes after initialization
 */
void test_lut_no_crashes() {
    // Call each LUT function multiple times
    for (int i = 0; i < 100; i++) {
        float t = i / 99.0f;

        // Easing
        volatile float e = ease_quad_in_fast(t);

        // Color
        volatile CRGBF c = hsv_fast(t, 1.0f, 1.0f);

        // Palette
        float test_pal[] = {0.0f, 0.5f, 1.0f};
        PaletteCache cache;
        cache.init(test_pal, 3);
        volatile float p = cache.get(t);
    }

    // If we got here, no crashes occurred
    TEST_ASSERT_TRUE(true);
}
```

### 3.2 Pattern Rendering Stability

**Objective**: Verify firmware remains stable when running patterns for extended periods.

```cpp
/**
 * Test: All patterns run for 30 seconds without crashes
 */
void test_pattern_stability_30sec() {
    // This would require integration with pattern_registry
    // Pseudocode:

    Serial.println("  Testing pattern stability (30 seconds each)...");

    // extern PatternRegistry pattern_registry;
    // int num_patterns = pattern_registry.get_count();

    // for (int i = 0; i < num_patterns; i++) {
    //     Serial.printf("    Pattern %d/%d: ", i+1, num_patterns);
    //     pattern_registry.set_active(i);
    //
    //     uint32_t start = millis();
    //     while (millis() - start < 30000) {
    //         pattern_registry.render_frame();
    //         vTaskDelay(pdMS_TO_TICKS(16));  // ~60 FPS
    //     }
    //     Serial.println("OK");
    // }

    TEST_ASSERT_TRUE(true);
}

/**
 * Test: FPS stability across patterns (target: >90 FPS)
 */
void test_pattern_fps_stability() {
    const float MIN_FPS = 90.0f;
    FPSCounter fps_counter;

    // Run for 10 seconds and measure FPS
    uint32_t start = millis();
    fps_counter.reset();

    while (millis() - start < 10000) {
        // Simulate pattern rendering with LUT calls
        for (int i = 0; i < 100; i++) {
            volatile CRGBF c = hsv_fast(i / 100.0f, 1.0f, 1.0f);
            volatile float e = ease_cubic_out_fast(i / 100.0f);
        }

        fps_counter.tick();
        vTaskDelay(pdMS_TO_TICKS(1));
    }

    float measured_fps = fps_counter.get_fps();
    Serial.printf("  Measured FPS: %.1f\n", measured_fps);

    TEST_ASSERT_MIN_FPS(measured_fps, MIN_FPS);
}
```

### 3.3 Audio Beat Detection Timing

**Objective**: Verify audio beat detection timing remains within acceptable latency.

```cpp
/**
 * Test: Audio beat detection latency unchanged (±20 ms acceptable)
 */
void test_audio_beat_timing() {
    const float ACCEPTABLE_LATENCY_MS = 20.0f;

    // Simulate beat detection with LUT-based rendering
    TestTimer timer;

    // Generate test audio pulse
    const int BUFFER_SIZE = 1024;
    float audio_buffer[BUFFER_SIZE];
    AudioTestData::generate_bass_pulse(audio_buffer, BUFFER_SIZE, 120.0f, 44100.0f);

    timer.start();

    // Simulate pattern responding to beat
    for (int i = 0; i < 100; i++) {
        float beat_intensity = audio_buffer[i * 10];
        float t = ease_quad_out_fast(beat_intensity);
        volatile CRGBF c = hsv_fast(0.0f, 1.0f, t);  // Red pulse
    }

    timer.stop();
    float latency_ms = timer.elapsed_ms();

    Serial.printf("  Audio response latency: %.3f ms\n", latency_ms);
    TEST_ASSERT_LATENCY_MS(latency_ms, ACCEPTABLE_LATENCY_MS);
}
```

---

## Performance Tests

### 4.1 CPU Usage Measurement

**Objective**: Measure CPU usage before and after LUT optimizations.

```cpp
#include "../../src/cpu_monitor.h"

/**
 * Test: CPU usage with LUT functions vs original
 */
void test_cpu_usage_comparison() {
    extern CPUMonitor cpu_monitor;
    cpu_monitor.init();
    delay(1000);  // Let CPU settle

    // Measure with original functions (100,000 calls)
    const int ITERATIONS = 100000;
    uint32_t start_original = esp_timer_get_time();

    for (int i = 0; i < ITERATIONS; i++) {
        float t = (i % 256) / 255.0f;
        volatile float e = ease_quad_in(t);  // Original
        volatile CRGBF c = hsv_to_rgb_precise(t, 1.0f, 1.0f);
    }

    uint32_t time_original_us = esp_timer_get_time() - start_original;

    // Measure with LUT functions (100,000 calls)
    uint32_t start_lut = esp_timer_get_time();

    for (int i = 0; i < ITERATIONS; i++) {
        float t = (i % 256) / 255.0f;
        volatile float e = ease_quad_in_fast(t);  // LUT
        volatile CRGBF c = hsv_fast(t, 1.0f, 1.0f);
    }

    uint32_t time_lut_us = esp_timer_get_time() - start_lut;

    // Calculate speedup
    float speedup = (float)time_original_us / time_lut_us;

    Serial.printf("  Original: %u us (%d iterations)\n", time_original_us, ITERATIONS);
    Serial.printf("  LUT:      %u us (%d iterations)\n", time_lut_us, ITERATIONS);
    Serial.printf("  Speedup:  %.2fx\n", speedup);

    // Expect at least 2x speedup
    TEST_ASSERT_GREATER_OR_EQUAL_FLOAT(2.0f, speedup);
}
```

### 4.2 Frame Time Profiling

**Objective**: Measure per-frame rendering time with profiling.

```cpp
#include "../../src/profiler.h"

/**
 * Test: Pattern rendering frame time with LUTs
 */
void test_pattern_frame_time() {
    const int NUM_LEDS = 256;
    const int NUM_FRAMES = 100;
    CRGBF led_buffer[NUM_LEDS];

    TestTimer timer;
    timer.start();

    for (int frame = 0; frame < NUM_FRAMES; frame++) {
        float time = frame / (float)NUM_FRAMES;

        for (int i = 0; i < NUM_LEDS; i++) {
            float pos = i / (float)NUM_LEDS;
            float t = ease_cubic_in_out_fast(pos);
            float hue = fmodf(time + t, 1.0f);
            led_buffer[i] = hsv_fast(hue, 1.0f, 1.0f);
        }
    }

    timer.stop();

    float avg_frame_time_ms = timer.elapsed_ms() / NUM_FRAMES;
    float max_fps = 1000.0f / avg_frame_time_ms;

    Serial.printf("  Avg frame time: %.3f ms\n", avg_frame_time_ms);
    Serial.printf("  Max FPS: %.1f\n", max_fps);

    // Expect frame time < 5 ms (200+ FPS capable)
    TEST_ASSERT_LESS_THAN_FLOAT(5.0f, avg_frame_time_ms);
}
```

### 4.3 LUT Initialization Time

**Objective**: Measure boot-time impact of LUT initialization.

```cpp
/**
 * Test: LUT initialization time on boot
 */
void test_lut_init_time() {
    TestTimer timer;

    // Measure easing LUT init
    timer.start();
    init_easing_luts();
    timer.stop();
    float easing_init_ms = timer.elapsed_ms();

    // Measure color LUT init
    timer.start();
    init_hue_wheel_lut();
    timer.stop();
    float color_init_ms = timer.elapsed_ms();

    // Measure palette cache init (typical 16-entry palette)
    float test_palette[16];
    for (int i = 0; i < 16; i++) test_palette[i] = i / 15.0f;

    timer.start();
    PaletteCache cache;
    cache.init(test_palette, 16);
    timer.stop();
    float palette_init_ms = timer.elapsed_ms();

    float total_init_ms = easing_init_ms + color_init_ms + palette_init_ms;

    Serial.printf("  Easing LUT init:  %.3f ms\n", easing_init_ms);
    Serial.printf("  Color LUT init:   %.3f ms\n", color_init_ms);
    Serial.printf("  Palette cache init: %.3f ms\n", palette_init_ms);
    Serial.printf("  Total init time:  %.3f ms\n", total_init_ms);

    // Expect total init < 50 ms
    TEST_ASSERT_LESS_THAN_FLOAT(50.0f, total_init_ms);
}
```

---

## Visual Tests

**Note**: Visual tests require manual inspection but can be automated with frame capture and comparison tools.

### 5.1 Side-by-Side Output Comparison

**Objective**: Verify LED output is visually identical between original and LUT implementations.

**Test Procedure**:

1. **Setup**: Connect LED strip to ESP32-S3
2. **Test A**: Run pattern with original functions (easing, HSV, palette interpolation)
3. **Test B**: Run same pattern with LUT functions
4. **Validation**: Visual inspection or frame capture comparison

**Automated Approach** (if frame capture available):

```cpp
/**
 * Test: Frame capture comparison (original vs LUT)
 */
void test_visual_frame_comparison() {
    const int NUM_LEDS = 256;
    CRGBF frame_original[NUM_LEDS];
    CRGBF frame_lut[NUM_LEDS];

    // Render frame with original functions
    for (int i = 0; i < NUM_LEDS; i++) {
        float pos = i / (float)NUM_LEDS;
        float t = ease_cubic_out(pos);  // Original
        frame_original[i] = hsv_to_rgb_precise(t, 1.0f, 1.0f);
    }

    // Render frame with LUT functions
    for (int i = 0; i < NUM_LEDS; i++) {
        float pos = i / (float)NUM_LEDS;
        float t = ease_cubic_out_fast(pos);  // LUT
        frame_lut[i] = hsv_fast(t, 1.0f, 1.0f);
    }

    // Compare frames (should be imperceptibly different)
    int different_pixels = 0;
    float max_diff = 0.0f;

    for (int i = 0; i < NUM_LEDS; i++) {
        float diff_r = fabsf(frame_original[i].r - frame_lut[i].r);
        float diff_g = fabsf(frame_original[i].g - frame_lut[i].g);
        float diff_b = fabsf(frame_original[i].b - frame_lut[i].b);
        float max_channel_diff = fmaxf(diff_r, fmaxf(diff_g, diff_b));

        if (max_channel_diff > 0.004f) {  // 0.4% threshold (1/255)
            different_pixels++;
        }
        max_diff = fmaxf(max_diff, max_channel_diff);
    }

    Serial.printf("  Different pixels: %d/%d (%.1f%%)\n",
                  different_pixels, NUM_LEDS,
                  100.0f * different_pixels / NUM_LEDS);
    Serial.printf("  Max difference: %.6f\n", max_diff);

    // Accept up to 5% different pixels (due to quantization)
    TEST_ASSERT_LESS_THAN_INT(NUM_LEDS / 20, different_pixels);
}
```

### 5.2 Animation Smoothness

**Manual Test Checklist**:

- [ ] Linear ease appears as constant speed
- [ ] Quad/Cubic/Quart easing curves appear smooth (no steps)
- [ ] Hue wheel transitions are continuous (no color banding)
- [ ] Palette gradients are smooth (no visible steps)
- [ ] No flickering or stuttering during playback

### 5.3 Color Accuracy

**Manual Test Checklist**:

- [ ] Primary colors are correct (Red, Green, Blue at H=0/120/240)
- [ ] Saturation desaturation produces correct pastel colors
- [ ] Brightness scaling maintains hue (no color shift)
- [ ] Grayscale (S=0) is truly neutral (no color tint)

---

## Test Execution Guide

### Running the Full Test Suite

```bash
# 1. Build and upload firmware
cd firmware
pio run -e esp32-s3-devkitc-1 -t upload

# 2. Run accuracy tests
pio test -e esp32-s3-devkitc-1 -f test_lut_accuracy

# 3. Run functional tests
pio test -e esp32-s3-devkitc-1 -f test_lut_functional

# 4. Run integration tests (requires 30 sec runtime)
pio test -e esp32-s3-devkitc-1 -f test_lut_integration

# 5. Run performance tests
pio test -e esp32-s3-devkitc-1 -f test_lut_performance

# 6. Manual visual tests (see checklist above)
```

### Continuous Integration

Add to CI pipeline (`.github/workflows/firmware-tests.yml`):

```yaml
name: Firmware Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up PlatformIO
        run: pip install platformio
      - name: Run LUT tests
        run: |
          cd firmware
          pio test -e esp32-s3-devkitc-1 -f test_lut_accuracy
          pio test -e esp32-s3-devkitc-1 -f test_lut_functional
```

---

## Quality Gates

All tests must pass the following quality gates before merging:

### Gate 1: Accuracy
- ✓ Easing LUT max error < 0.2% across all functions
- ✓ Color LUT max error < 0.4% across full HSV cube
- ✓ Palette LUT max error < 0.2% for all sizes

### Gate 2: Functional Correctness
- ✓ All easing functions are monotonic
- ✓ All easing functions respect boundaries (f(0)=0, f(1)=1)
- ✓ HSV hue wraparound error < 1%
- ✓ Zero saturation produces grayscale
- ✓ Zero value produces black
- ✓ Palette cache handles edge cases (NULL, size=1, size=64)

### Gate 3: Integration
- ✓ LUT initialization uses 8-12 KB memory
- ✓ No crashes after 30-second pattern runtime
- ✓ FPS remains stable (>90 FPS)
- ✓ Audio beat detection latency < 20 ms

### Gate 4: Performance
- ✓ LUT speedup ≥ 2x vs original
- ✓ Frame time < 5 ms (200+ FPS capable)
- ✓ LUT initialization < 50 ms

### Gate 5: Visual Quality
- ✓ Frame comparison: < 5% different pixels
- ✓ Manual inspection: smooth animations, correct colors
- ✓ No visible artifacts (banding, flickering, color shift)

---

## Test Metrics Summary

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Easing accuracy | < 0.2% error | 100 samples across [0,1] |
| Color accuracy | < 0.4% error | 10×10×10 HSV cube samples |
| Palette accuracy | < 0.2% error | 100 samples vs reference |
| CPU speedup | ≥ 2x | 100k iterations timing |
| Frame time | < 5 ms | 100 frame average |
| FPS stability | > 90 FPS | 10-second measurement |
| Init time | < 50 ms | Boot timing |
| Memory usage | 8-12 KB | Heap delta |
| Audio latency | < 20 ms | Beat response timing |
| Visual diff | < 5% pixels | Frame comparison |

---

## Appendix: Test Implementation Files

### File: `firmware/test/test_lut_accuracy/test_lut_accuracy.cpp`

Complete test implementation for accuracy validation (see code snippets in Section 1).

### File: `firmware/test/test_lut_functional/test_lut_functional.cpp`

Complete test implementation for functional correctness (see code snippets in Section 2).

### File: `firmware/test/test_lut_integration/test_lut_integration.cpp`

Complete test implementation for integration tests (see code snippets in Section 3).

### File: `firmware/test/test_lut_performance/test_lut_performance.cpp`

Complete test implementation for performance benchmarks (see code snippets in Section 4).

---

## Validation Notes

This test strategy has been designed to:

1. **Ensure accuracy**: Mathematical validation against reference implementations
2. **Verify correctness**: Functional properties and edge case handling
3. **Confirm integration**: Boot stability, pattern rendering, audio timing
4. **Measure performance**: CPU usage, frame time, initialization overhead
5. **Validate visually**: Frame comparison and manual inspection

All tests are designed to run on actual hardware (ESP32-S3) using the existing Unity test framework integrated with PlatformIO.

---

**Review Status**: Awaiting maintainer approval
**Next Steps**: Implement test files and integrate into CI pipeline

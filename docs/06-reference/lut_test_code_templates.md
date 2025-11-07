# LUT Test Code Templates

**Purpose**: Ready-to-use test code templates for LUT validation
**Related**:
- `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/09-implementation/lut_optimization_test_strategy.md`
- `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/07-resources/lut_test_checklist.md`
**Date**: 2025-11-07

---

## Template 1: Complete Accuracy Test File

**File**: `firmware/test/test_lut_accuracy/test_lut_accuracy.cpp`

```cpp
/*
 * LUT Accuracy Validation Tests
 *
 * Validates that LUT implementations match original functions within
 * specified tolerance levels:
 * - Easing LUT: < 0.2% error
 * - Color LUT: < 0.4% error
 * - Palette LUT: < 0.2% error
 */

#include <unity.h>
#include <Arduino.h>
#include "../../src/lut/easing_lut.h"
#include "../../src/lut/color_lut.h"
#include "../../src/lut/palette_lut.h"
#include "../../src/easing_functions.h"
#include "../test_utils/test_helpers.h"

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

#define EASING_SAMPLES 100
#define EASING_MAX_ERROR_PCT 0.2f

#define COLOR_SAMPLES_PER_DIM 10
#define COLOR_MAX_ERROR_PCT 0.4f

#define PALETTE_TEST_SAMPLES 100
#define PALETTE_MAX_ERROR 0.002f

// ============================================================================
// REFERENCE IMPLEMENTATIONS
// ============================================================================

/**
 * Precise HSV to RGB conversion (reference implementation)
 */
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

// ============================================================================
// EASING LUT ACCURACY TESTS
// ============================================================================

void test_easing_linear_accuracy() {
    float max_error_pct = 0.0f;

    for (int i = 0; i < EASING_SAMPLES; i++) {
        float t = i / (float)(EASING_SAMPLES - 1);
        float original = ease_linear(t);
        float fast = ease_linear_fast(t);

        float error = fabsf(original - fast);
        float error_pct = (fabsf(original) > 0.001f) ?
                         (error / fabsf(original)) * 100.0f : 0.0f;
        max_error_pct = fmaxf(max_error_pct, error_pct);
    }

    Serial.printf("  ease_linear: max error = %.3f%%\n", max_error_pct);
    TEST_ASSERT_LESS_THAN_FLOAT(EASING_MAX_ERROR_PCT, max_error_pct);
}

void test_easing_quad_in_accuracy() {
    float max_error_pct = 0.0f;

    for (int i = 0; i < EASING_SAMPLES; i++) {
        float t = i / (float)(EASING_SAMPLES - 1);
        float original = ease_quad_in(t);
        float fast = ease_quad_in_fast(t);

        float error = fabsf(original - fast);
        float error_pct = (fabsf(original) > 0.001f) ?
                         (error / fabsf(original)) * 100.0f : 0.0f;
        max_error_pct = fmaxf(max_error_pct, error_pct);
    }

    Serial.printf("  ease_quad_in: max error = %.3f%%\n", max_error_pct);
    TEST_ASSERT_LESS_THAN_FLOAT(EASING_MAX_ERROR_PCT, max_error_pct);
}

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

    int num_tests = sizeof(tests) / sizeof(tests[0]);

    for (int t = 0; t < num_tests; t++) {
        float max_error_pct = 0.0f;

        for (int i = 0; i < EASING_SAMPLES; i++) {
            float input = i / (float)(EASING_SAMPLES - 1);
            float original = tests[t].original(input);
            float fast = tests[t].fast(input);

            float error = fabsf(original - fast);
            float error_pct = (fabsf(original) > 0.001f) ?
                             (error / fabsf(original)) * 100.0f : 0.0f;
            max_error_pct = fmaxf(max_error_pct, error_pct);
        }

        Serial.printf("  %s: max error = %.3f%%\n", tests[t].name, max_error_pct);
        TEST_ASSERT_LESS_THAN_FLOAT(EASING_MAX_ERROR_PCT, max_error_pct);
    }
}

// ============================================================================
// COLOR LUT ACCURACY TESTS
// ============================================================================

void test_color_lut_hue_accuracy() {
    const int HUE_SAMPLES = 100;
    float max_error_pct = 0.0f;

    for (int i = 0; i < HUE_SAMPLES; i++) {
        float h = i / (float)(HUE_SAMPLES - 1);
        CRGBF precise = hsv_to_rgb_precise(h, 1.0f, 1.0f);
        CRGBF fast = hsv_fast(h, 1.0f, 1.0f);

        float error_r = fabsf(precise.r - fast.r);
        float error_g = fabsf(precise.g - fast.g);
        float error_b = fabsf(precise.b - fast.b);
        float max_channel_error = fmaxf(error_r, fmaxf(error_g, error_b));

        float error_pct = max_channel_error * 100.0f;
        max_error_pct = fmaxf(max_error_pct, error_pct);
    }

    Serial.printf("  HSV hue wheel: max error = %.3f%%\n", max_error_pct);
    TEST_ASSERT_LESS_THAN_FLOAT(COLOR_MAX_ERROR_PCT, max_error_pct);
}

void test_color_lut_full_cube_accuracy() {
    float max_error_pct = 0.0f;
    float worst_h = 0, worst_s = 0, worst_v = 0;

    for (int ih = 0; ih < COLOR_SAMPLES_PER_DIM; ih++) {
        for (int is = 0; is < COLOR_SAMPLES_PER_DIM; is++) {
            for (int iv = 0; iv < COLOR_SAMPLES_PER_DIM; iv++) {
                float h = ih / (float)(COLOR_SAMPLES_PER_DIM - 1);
                float s = is / (float)(COLOR_SAMPLES_PER_DIM - 1);
                float v = iv / (float)(COLOR_SAMPLES_PER_DIM - 1);

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

// ============================================================================
// PALETTE LUT ACCURACY TESTS
// ============================================================================

void test_palette_cache_accuracy() {
    const int PALETTE_SIZE = 16;
    float test_palette[PALETTE_SIZE];

    for (int i = 0; i < PALETTE_SIZE; i++) {
        test_palette[i] = i / (float)(PALETTE_SIZE - 1);
    }

    PaletteCache cache;
    cache.init(test_palette, PALETTE_SIZE);

    float max_error = 0.0f;

    for (int i = 0; i < PALETTE_TEST_SAMPLES; i++) {
        float pos = i / (float)(PALETTE_TEST_SAMPLES - 1);
        float reference = palette_interpolate_reference(test_palette, PALETTE_SIZE, pos);
        float cached = cache.get(pos);

        float error = fabsf(reference - cached);
        max_error = fmaxf(max_error, error);
    }

    Serial.printf("  Palette cache: max error = %.6f\n", max_error);
    TEST_ASSERT_LESS_THAN_FLOAT(PALETTE_MAX_ERROR, max_error);
}

void test_palette_cache_varying_sizes() {
    int sizes[] = {2, 4, 8, 16, 32};
    int num_sizes = sizeof(sizes) / sizeof(sizes[0]);

    for (int s = 0; s < num_sizes; s++) {
        int size = sizes[s];
        float* palette = new float[size];

        for (int i = 0; i < size; i++) {
            palette[i] = sinf(i * 2.0f * M_PI / size);
        }

        PaletteCache cache;
        cache.init(palette, size);

        float max_error = 0.0f;
        for (int i = 0; i < PALETTE_TEST_SAMPLES; i++) {
            float pos = i / (float)(PALETTE_TEST_SAMPLES - 1);
            float reference = palette_interpolate_reference(palette, size, pos);
            float cached = cache.get(pos);
            max_error = fmaxf(max_error, fabsf(reference - cached));
        }

        Serial.printf("  Palette size %d: max error = %.6f\n", size, max_error);
        TEST_ASSERT_LESS_THAN_FLOAT(PALETTE_MAX_ERROR, max_error);

        delete[] palette;
    }
}

// ============================================================================
// TEST SETUP AND TEARDOWN
// ============================================================================

void setUp(void) {
    // Initialize LUTs before each test
    init_easing_luts();
    init_hue_wheel_lut();
}

void tearDown(void) {
    // Cleanup after each test (if needed)
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

void setup() {
    delay(2000);  // Wait for serial connection
    Serial.begin(2000000);

    Serial.println("\n=== LUT Accuracy Validation Tests ===\n");

    UNITY_BEGIN();

    // Easing LUT tests
    Serial.println("--- Easing LUT Accuracy ---");
    RUN_TEST(test_easing_linear_accuracy);
    RUN_TEST(test_easing_quad_in_accuracy);
    RUN_TEST(test_all_easing_functions_accuracy);

    // Color LUT tests
    Serial.println("\n--- Color LUT Accuracy ---");
    RUN_TEST(test_color_lut_hue_accuracy);
    RUN_TEST(test_color_lut_full_cube_accuracy);

    // Palette LUT tests
    Serial.println("\n--- Palette LUT Accuracy ---");
    RUN_TEST(test_palette_cache_accuracy);
    RUN_TEST(test_palette_cache_varying_sizes);

    UNITY_END();
}

void loop() {
    // Empty loop - tests run once in setup()
}
```

---

## Template 2: Performance Benchmark File

**File**: `firmware/test/test_lut_performance/test_lut_performance.cpp`

```cpp
/*
 * LUT Performance Benchmark Tests
 *
 * Measures:
 * - CPU speedup (original vs LUT)
 * - Frame rendering time
 * - LUT initialization time
 * - Memory usage
 */

#include <unity.h>
#include <Arduino.h>
#include "../../src/lut/easing_lut.h"
#include "../../src/lut/color_lut.h"
#include "../../src/lut/palette_lut.h"
#include "../../src/easing_functions.h"
#include "../../src/cpu_monitor.h"
#include "../test_utils/test_helpers.h"

// ============================================================================
// BENCHMARK CONFIGURATION
// ============================================================================

#define BENCHMARK_ITERATIONS 100000
#define MIN_SPEEDUP 2.0f
#define MAX_FRAME_TIME_MS 5.0f
#define MAX_INIT_TIME_MS 50.0f

// ============================================================================
// REFERENCE IMPLEMENTATIONS (same as accuracy tests)
// ============================================================================

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

// ============================================================================
// CPU USAGE TESTS
// ============================================================================

void test_easing_cpu_speedup() {
    // Benchmark original easing
    uint32_t start_original = esp_timer_get_time();

    for (int i = 0; i < BENCHMARK_ITERATIONS; i++) {
        float t = (i % 256) / 255.0f;
        volatile float e = ease_cubic_in(t);
    }

    uint32_t time_original_us = esp_timer_get_time() - start_original;

    // Benchmark LUT easing
    uint32_t start_lut = esp_timer_get_time();

    for (int i = 0; i < BENCHMARK_ITERATIONS; i++) {
        float t = (i % 256) / 255.0f;
        volatile float e = ease_cubic_in_fast(t);
    }

    uint32_t time_lut_us = esp_timer_get_time() - start_lut;

    // Calculate speedup
    float speedup = (float)time_original_us / time_lut_us;

    Serial.printf("  Easing benchmark:\n");
    Serial.printf("    Original: %u us (%d iterations)\n", time_original_us, BENCHMARK_ITERATIONS);
    Serial.printf("    LUT:      %u us (%d iterations)\n", time_lut_us, BENCHMARK_ITERATIONS);
    Serial.printf("    Speedup:  %.2fx\n", speedup);

    TEST_ASSERT_GREATER_OR_EQUAL_FLOAT(MIN_SPEEDUP, speedup);
}

void test_color_cpu_speedup() {
    // Benchmark original HSV conversion
    uint32_t start_original = esp_timer_get_time();

    for (int i = 0; i < BENCHMARK_ITERATIONS; i++) {
        float h = (i % 256) / 255.0f;
        volatile CRGBF c = hsv_to_rgb_precise(h, 1.0f, 1.0f);
    }

    uint32_t time_original_us = esp_timer_get_time() - start_original;

    // Benchmark LUT HSV conversion
    uint32_t start_lut = esp_timer_get_time();

    for (int i = 0; i < BENCHMARK_ITERATIONS; i++) {
        float h = (i % 256) / 255.0f;
        volatile CRGBF c = hsv_fast(h, 1.0f, 1.0f);
    }

    uint32_t time_lut_us = esp_timer_get_time() - start_lut;

    // Calculate speedup
    float speedup = (float)time_original_us / time_lut_us;

    Serial.printf("  HSV conversion benchmark:\n");
    Serial.printf("    Original: %u us (%d iterations)\n", time_original_us, BENCHMARK_ITERATIONS);
    Serial.printf("    LUT:      %u us (%d iterations)\n", time_lut_us, BENCHMARK_ITERATIONS);
    Serial.printf("    Speedup:  %.2fx\n", speedup);

    TEST_ASSERT_GREATER_OR_EQUAL_FLOAT(MIN_SPEEDUP, speedup);
}

// ============================================================================
// FRAME TIME TESTS
// ============================================================================

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

    Serial.printf("  Frame rendering:\n");
    Serial.printf("    Avg frame time: %.3f ms\n", avg_frame_time_ms);
    Serial.printf("    Max FPS: %.1f\n", max_fps);

    TEST_ASSERT_LESS_THAN_FLOAT(MAX_FRAME_TIME_MS, avg_frame_time_ms);
}

// ============================================================================
// INITIALIZATION TIME TESTS
// ============================================================================

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

    // Measure palette cache init
    float test_palette[16];
    for (int i = 0; i < 16; i++) test_palette[i] = i / 15.0f;

    timer.start();
    PaletteCache cache;
    cache.init(test_palette, 16);
    timer.stop();
    float palette_init_ms = timer.elapsed_ms();

    float total_init_ms = easing_init_ms + color_init_ms + palette_init_ms;

    Serial.printf("  LUT initialization:\n");
    Serial.printf("    Easing LUT:  %.3f ms\n", easing_init_ms);
    Serial.printf("    Color LUT:   %.3f ms\n", color_init_ms);
    Serial.printf("    Palette cache: %.3f ms\n", palette_init_ms);
    Serial.printf("    Total:       %.3f ms\n", total_init_ms);

    TEST_ASSERT_LESS_THAN_FLOAT(MAX_INIT_TIME_MS, total_init_ms);
}

// ============================================================================
// MEMORY USAGE TESTS
// ============================================================================

void test_lut_memory_usage() {
    MemorySnapshot before = MemorySnapshot::capture();

    // Initialize LUTs
    init_easing_luts();
    init_hue_wheel_lut();

    MemorySnapshot after = MemorySnapshot::capture();

    int32_t used_bytes = before.heap_delta(after);

    Serial.printf("  Memory usage:\n");
    Serial.printf("    LUT memory: %d bytes\n", used_bytes);

    // Expected: 6 KB (easing) + 3 KB (color) = 9 KB
    TEST_ASSERT_GREATER_THAN_INT32(8000, used_bytes);
    TEST_ASSERT_LESS_THAN_INT32(12000, used_bytes);
}

// ============================================================================
// TEST RUNNER
// ============================================================================

void setUp(void) {}
void tearDown(void) {}

void setup() {
    delay(2000);
    Serial.begin(2000000);

    Serial.println("\n=== LUT Performance Benchmark Tests ===\n");

    UNITY_BEGIN();

    Serial.println("--- CPU Speedup ---");
    RUN_TEST(test_easing_cpu_speedup);
    RUN_TEST(test_color_cpu_speedup);

    Serial.println("\n--- Frame Time ---");
    RUN_TEST(test_pattern_frame_time);

    Serial.println("\n--- Initialization ---");
    RUN_TEST(test_lut_init_time);
    RUN_TEST(test_lut_memory_usage);

    UNITY_END();
}

void loop() {}
```

---

## Template 3: Functional Correctness Test File

**File**: `firmware/test/test_lut_functional/test_lut_functional.cpp`

```cpp
/*
 * LUT Functional Correctness Tests
 *
 * Validates mathematical properties and edge case handling:
 * - Easing: monotonicity, boundaries, clamping
 * - Color: wraparound, grayscale, black
 * - Palette: edge cases (NULL, size=1, size=64)
 */

#include <unity.h>
#include <Arduino.h>
#include "../../src/lut/easing_lut.h"
#include "../../src/lut/color_lut.h"
#include "../../src/lut/palette_lut.h"
#include "../test_utils/test_helpers.h"

// ============================================================================
// EASING FUNCTIONAL TESTS
// ============================================================================

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

    int num_funcs = sizeof(funcs) / sizeof(funcs[0]);

    for (int f = 0; f < num_funcs; f++) {
        float prev_val = funcs[f].func(0.0f);
        bool is_monotonic = true;

        for (int i = 1; i < 100; i++) {
            float t = i / 99.0f;
            float val = funcs[f].func(t);

            if (val < prev_val - 0.0001f) {
                is_monotonic = false;
                Serial.printf("  %s: NOT monotonic at t=%.3f (%.6f < %.6f)\n",
                             funcs[f].name, t, val, prev_val);
                break;
            }
            prev_val = val;
        }

        TEST_ASSERT_TRUE_MESSAGE(is_monotonic, funcs[f].name);
    }
}

void test_easing_boundaries() {
    float (*funcs[])(float) = {
        ease_linear_fast, ease_quad_in_fast, ease_quad_out_fast,
        ease_cubic_in_fast, ease_cubic_out_fast, ease_quart_in_fast
    };

    int num_funcs = sizeof(funcs) / sizeof(funcs[0]);

    for (int f = 0; f < num_funcs; f++) {
        TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, funcs[f](0.0f));
        TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, funcs[f](1.0f));
    }
}

void test_easing_input_clamping() {
    float test_values[] = {-1.0f, -0.5f, 1.5f, 2.0f, 100.0f};
    int num_values = sizeof(test_values) / sizeof(test_values[0]);

    for (int v = 0; v < num_values; v++) {
        float result = ease_quad_in_fast(test_values[v]);
        TEST_ASSERT_GREATER_OR_EQUAL_FLOAT(0.0f, result);
        TEST_ASSERT_LESS_OR_EQUAL_FLOAT(1.0f, result);
    }
}

// ============================================================================
// COLOR FUNCTIONAL TESTS
// ============================================================================

void test_color_lut_hue_wraparound() {
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

void test_color_lut_grayscale() {
    for (int i = 0; i < 10; i++) {
        float h = i / 9.0f;
        float v = 0.5f;

        CRGBF gray = hsv_fast(h, 0.0f, v);

        TEST_ASSERT_FLOAT_WITHIN(0.01f, gray.r, gray.g);
        TEST_ASSERT_FLOAT_WITHIN(0.01f, gray.g, gray.b);
        TEST_ASSERT_FLOAT_WITHIN(0.01f, v, gray.r);
    }
}

void test_color_lut_black() {
    for (int i = 0; i < 10; i++) {
        float h = i / 9.0f;
        float s = i / 9.0f;

        CRGBF black = hsv_fast(h, s, 0.0f);

        TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, black.r);
        TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, black.g);
        TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, black.b);
    }
}

// ============================================================================
// PALETTE FUNCTIONAL TESTS
// ============================================================================

void test_palette_cache_single_entry() {
    float single_value[] = {0.75f};
    PaletteCache cache;
    cache.init(single_value, 1);

    for (int i = 0; i < 10; i++) {
        float pos = i / 9.0f;
        float result = cache.get(pos);
        TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.75f, result);
    }
}

void test_palette_cache_two_entry() {
    float gradient[] = {0.0f, 1.0f};
    PaletteCache cache;
    cache.init(gradient, 2);

    for (int i = 0; i < 10; i++) {
        float pos = i / 9.0f;
        float result = cache.get(pos);
        TEST_ASSERT_FLOAT_WITHIN(0.01f, pos, result);
    }
}

void test_palette_cache_null_handling() {
    PaletteCache cache;
    cache.init(nullptr, 10);

    TEST_ASSERT_FALSE(cache.initialized);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, cache.get(0.5f));
}

// ============================================================================
// TEST RUNNER
// ============================================================================

void setUp(void) {
    init_easing_luts();
    init_hue_wheel_lut();
}

void tearDown(void) {}

void setup() {
    delay(2000);
    Serial.begin(2000000);

    Serial.println("\n=== LUT Functional Correctness Tests ===\n");

    UNITY_BEGIN();

    Serial.println("--- Easing Functional Tests ---");
    RUN_TEST(test_easing_monotonicity);
    RUN_TEST(test_easing_boundaries);
    RUN_TEST(test_easing_input_clamping);

    Serial.println("\n--- Color Functional Tests ---");
    RUN_TEST(test_color_lut_hue_wraparound);
    RUN_TEST(test_color_lut_grayscale);
    RUN_TEST(test_color_lut_black);

    Serial.println("\n--- Palette Functional Tests ---");
    RUN_TEST(test_palette_cache_single_entry);
    RUN_TEST(test_palette_cache_two_entry);
    RUN_TEST(test_palette_cache_null_handling);

    UNITY_END();
}

void loop() {}
```

---

## Usage Instructions

### 1. Create Test Directories

```bash
cd firmware/test
mkdir test_lut_accuracy
mkdir test_lut_performance
mkdir test_lut_functional
mkdir test_lut_integration
```

### 2. Copy Templates

Copy the code templates above into the respective test directories.

### 3. Run Tests

```bash
# Run accuracy tests
pio test -e esp32-s3-devkitc-1 -f test_lut_accuracy

# Run performance tests
pio test -e esp32-s3-devkitc-1 -f test_lut_performance

# Run functional tests
pio test -e esp32-s3-devkitc-1 -f test_lut_functional
```

### 4. Interpret Results

Expected output format:
```
=== LUT Accuracy Validation Tests ===

--- Easing LUT Accuracy ---
  ease_linear: max error = 0.000%
test_lut_accuracy.cpp:XX:test_easing_linear_accuracy [PASSED]
  ease_quad_in: max error = 0.156%
test_lut_accuracy.cpp:XX:test_easing_quad_in_accuracy [PASSED]
...

--- Summary ---
Tests: 15
Passed: 15
Failed: 0
```

---

**Last Updated**: 2025-11-07

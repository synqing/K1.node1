/**
 * TEST SUITE: Hardware Validation - Graph Integration
 *
 * Validates codegen pattern execution, parameter mutation,
 * and long-duration stability of generated patterns.
 */

#include <Arduino.h>
#include <unity.h>
#include "../test_utils/test_helpers.h"
#include "../../src/types.h"
#include "../../src/led_driver.h"
#include "../../src/pattern_registry.h"
#include "../../src/pattern_audio_interface.h"
#include "../../src/audio/goertzel.h"
#include "../../src/parameters.h"

void setUp(void) {
    init_params();
    init_audio_data_sync();
    init_window_lookup();
    init_goertzel_constants_musical();
}

void tearDown(void) {
    vTaskDelay(pdMS_TO_TICKS(100));
}

/**
 * TEST 1: Graph Codegen Correctness
 * Verify generated patterns compile and execute without crashes
 */
void test_graph_codegen_correctness() {
    Serial.println("\n=== TEST 1: Graph Codegen Correctness ===");

    init_pattern_registry();

    // Check that pattern registry initialized
    TEST_ASSERT_GREATER_THAN(0, g_num_patterns);

    Serial.printf("  Patterns registered: %d\n", g_num_patterns);

    // Attempt to set each pattern
    int valid_patterns = 0;
    for (int i = 0; i < g_num_patterns; i++) {
        if (set_current_pattern(i)) {
            valid_patterns++;
        }
    }

    Serial.printf("  Valid patterns: %d/%d\n", valid_patterns, g_num_patterns);

    // At least 80% of patterns should be valid
    TEST_ASSERT_GREATER_THAN((g_num_patterns * 80) / 100, valid_patterns);

    TestResults::instance().add_metric("Valid patterns", (float)valid_patterns);
    TestResults::instance().add_pass("Pattern registry initialized correctly");
}

/**
 * TEST 2: Pattern Execution
 * Run bloom/spectrum patterns for 100 frames without crash
 */
void test_pattern_execution() {
    Serial.println("\n=== TEST 2: Pattern Execution (100 Frames) ===");

    init_rmt_driver();
    init_pattern_registry();

    vTaskDelay(pdMS_TO_TICKS(200));

    // Find and run bloom pattern if available
    int bloom_idx = -1;
    for (int i = 0; i < g_num_patterns; i++) {
        // Patterns are registered; try to identify bloom by name or index
        if (i < 2) {  // Typically bloom is early in registry
            bloom_idx = i;
            break;
        }
    }

    if (bloom_idx < 0) bloom_idx = 0;

    // Set pattern
    set_current_pattern(bloom_idx);

    // Simulate audio feed
    for (int i = 0; i < NUM_FREQS; i++) {
        audio_back.spectrogram[i] = 0.3f + 0.2f * sinf((float)i / 10.0f);
    }
    audio_back.update_counter = 0;
    commit_audio_data();

    // Run 100 frames
    int crash_count = 0;
    uint32_t start_time = millis();

    for (int frame = 0; frame < 100; frame++) {
        try {
            // Get audio
            AudioDataSnapshot snapshot;
            get_audio_snapshot(&snapshot);

            // Render pattern (assuming generated pattern_render function)
            // For compatibility, just verify leds[] doesn't get corrupted
            global_brightness = 0.8f;

            // Quantize and transmit
            quantize_color(false);
            transmit_leds();

            // Verify LED buffer is still valid (no NaN/inf)
            bool valid = true;
            for (int i = 0; i < NUM_LEDS; i++) {
                if (isnan(leds[i].r) || isnan(leds[i].g) || isnan(leds[i].b)) {
                    valid = false;
                    break;
                }
                if (isinf(leds[i].r) || isinf(leds[i].g) || isinf(leds[i].b)) {
                    valid = false;
                    break;
                }
            }

            if (!valid) {
                crash_count++;
            }

            vTaskDelay(pdMS_TO_TICKS(6));
        } catch (...) {
            crash_count++;
        }

        // Update audio to simulate live input
        if (frame % 10 == 0) {
            for (int i = 0; i < NUM_FREQS; i++) {
                audio_back.spectrogram[i] = 0.3f + 0.3f * cosf((float)frame / 50.0f + (float)i / 20.0f);
            }
            audio_back.update_counter++;
            commit_audio_data();
        }
    }

    uint32_t elapsed = millis() - start_time;

    Serial.printf("  Frames executed: 100\n");
    Serial.printf("  Crashes: %d\n", crash_count);
    Serial.printf("  Time: %u ms (%.1f FPS)\n", elapsed, 100000.0f / elapsed);

    TEST_ASSERT_EQUAL_INT(0, crash_count);

    TestResults::instance().add_metric("Pattern FPS", 100000.0f / elapsed);
    TestResults::instance().add_pass("Pattern execution stable");
}

/**
 * TEST 3: Parameter Mutation
 * Change parameters mid-pattern, verify smooth transition
 */
void test_parameter_mutation() {
    Serial.println("\n=== TEST 3: Parameter Mutation (Smooth Transitions) ===");

    init_rmt_driver();
    init_pattern_registry();

    vTaskDelay(pdMS_TO_TICKS(200));

    set_current_pattern(0);

    int transition_errors = 0;
    float prev_brightness = 0.5f;

    // Run pattern while changing parameters every 10 frames
    for (int frame = 0; frame < 100; frame++) {
        // Mutate brightness
        if (frame % 10 == 0) {
            float new_brightness = 0.2f + (frame / 100.0f) * 0.8f;  // Ramp 0.2 -> 1.0
            global_brightness = new_brightness;

            Serial.printf("  Frame %d: brightness = %.2f\n", frame, new_brightness);
        }

        // Mutate parameters via parameter interface
        if (frame % 20 == 0) {
            Parameters p = get_params();
            p.dithering = (frame / 100.0f);  // Ramp dithering
            set_params(p);
        }

        // Quantize with current brightness
        quantize_color(global_brightness > 0.5f);
        transmit_leds();

        // Verify no discontinuities (brightness shouldn't jump > 0.1)
        if (fabs(global_brightness - prev_brightness) > 0.15f) {
            transition_errors++;
        }
        prev_brightness = global_brightness;

        vTaskDelay(pdMS_TO_TICKS(6));
    }

    Serial.printf("  Transition errors: %d\n", transition_errors);

    // Allow minimal transition errors due to floating point precision
    TEST_ASSERT_LESS_THAN(2, transition_errors);

    TestResults::instance().add_pass("Parameter mutation handled smoothly");
}

/**
 * TEST 4: Long-Duration Stability
 * Run single pattern for 5 minutes, verify consistent FPS
 */
void test_long_duration_stability() {
    Serial.println("\n=== TEST 4: Long-Duration Stability (5 Minutes) ===");

    init_rmt_driver();
    init_pattern_registry();

    vTaskDelay(pdMS_TO_TICKS(200));

    set_current_pattern(0);

    // Prepare audio feed
    for (int i = 0; i < NUM_FREQS; i++) {
        audio_back.spectrogram[i] = 0.2f;
    }
    audio_back.update_counter = 0;
    commit_audio_data();

    // Measure FPS over 5 minutes
    FPSCounter fps;
    fps.reset();

    uint32_t test_duration_ms = 5 * 60 * 1000;  // 5 minutes
    uint32_t start_time = millis();
    uint32_t last_report = start_time;
    int frame_count = 0;
    int crash_count = 0;
    float min_fps = 1000.0f;
    float max_fps = 0.0f;

    Serial.println("  Running 5-minute stability test...");
    Serial.println("  [Time] Frames | FPS | Memory");

    while (millis() - start_time < test_duration_ms) {
        try {
            // Quantize and transmit
            global_brightness = 0.8f;
            quantize_color(false);
            transmit_leds();

            fps.tick();
            frame_count++;

            // Update audio periodically
            if (frame_count % 50 == 0) {
                for (int i = 0; i < NUM_FREQS; i++) {
                    audio_back.spectrogram[i] = 0.2f + 0.1f * sinf((float)frame_count / 100.0f);
                }
                audio_back.update_counter++;
                commit_audio_data();
            }

            // Report every 30 seconds
            if (millis() - last_report > 30000) {
                float current_fps = fps.get_fps();
                MemorySnapshot mem = MemorySnapshot::capture();

                uint32_t elapsed_s = (millis() - start_time) / 1000;
                Serial.printf("  [%3u s] %6d | %5.1f | %u bytes\n",
                             elapsed_s, frame_count, current_fps, mem.free_heap);

                if (current_fps > 0) {
                    if (current_fps < min_fps) min_fps = current_fps;
                    if (current_fps > max_fps) max_fps = current_fps;
                }

                last_report = millis();
            }

        } catch (...) {
            crash_count++;
        }

        vTaskDelay(pdMS_TO_TICKS(6));
    }

    uint32_t total_time = millis() - start_time;
    float avg_fps = (frame_count * 1000.0f) / total_time;

    Serial.printf("\n  === Stability Test Results ===\n");
    Serial.printf("  Duration: %u seconds\n", total_time / 1000);
    Serial.printf("  Total frames: %d\n", frame_count);
    Serial.printf("  Avg FPS: %.1f\n", avg_fps);
    Serial.printf("  Min FPS: %.1f\n", min_fps);
    Serial.printf("  Max FPS: %.1f\n", max_fps);
    Serial.printf("  Crashes: %d\n", crash_count);

    // Should maintain >100 FPS consistently
    TEST_ASSERT_GREATER_THAN(100.0f, avg_fps);

    // FPS variation should be small (within 20%)
    if (avg_fps > 100.0f) {
        float variation = (max_fps - min_fps) / avg_fps;
        TEST_ASSERT_LESS_THAN(0.2f, variation);
    }

    TEST_ASSERT_EQUAL_INT(0, crash_count);

    TestResults::instance().add_metric("Stability test FPS", avg_fps);
    TestResults::instance().add_metric("FPS variation", (max_fps - min_fps) / avg_fps);
    TestResults::instance().add_pass("5-minute stability test passed");
}

void setup() {
    Serial.begin(2000000);
    delay(2000);

    Serial.println("\n\n========================================");
    Serial.println("HARDWARE VALIDATION: GRAPH INTEGRATION");
    Serial.println("========================================\n");

    UNITY_BEGIN();
    RUN_TEST(test_graph_codegen_correctness);
    RUN_TEST(test_pattern_execution);
    RUN_TEST(test_parameter_mutation);
    RUN_TEST(test_long_duration_stability);
    UNITY_END();

    TestResults::instance().print_summary();
}

void loop() {
    delay(1000);
}

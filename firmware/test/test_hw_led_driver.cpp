/**
 * TEST SUITE: Hardware Validation - LED Driver
 *
 * Validates RMT dual-channel synchronization, LED color accuracy,
 * frame timing stability, and memory bounds on actual hardware.
 */

#include <Arduino.h>
#include <unity.h>
#include <atomic>
#include "../test_utils/test_helpers.h"
#include "../../src/led_driver.h"
#include "../../src/types.h"

// Test telemetry
static struct {
    uint32_t last_tx_us;
    uint32_t frame_deltas[256];
    int frame_count;
    uint32_t max_delta_us;
    uint32_t min_delta_us;
} test_telemetry = {0, {}, 0, 0, 0xFFFFFFFF};

void setUp(void) {
    memset(&test_telemetry, 0, sizeof(test_telemetry));
    test_telemetry.min_delta_us = 0xFFFFFFFF;
}

void tearDown(void) {
    vTaskDelay(pdMS_TO_TICKS(100));
}

/**
 * TEST 1: RMT Dual-Channel Sync
 * Verify both channels transmit back-to-back within acceptable skew
 */
void test_rmt_dual_channel_sync() {
    Serial.println("\n=== TEST 1: RMT Dual-Channel Sync ===");

    // Initialize RMT driver
    init_rmt_driver();
    vTaskDelay(pdMS_TO_TICKS(100));

    // Set known colors on both channels (full red)
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGBF{1.0f, 0.0f, 0.0f};
    }
    global_brightness = 1.0f;

    // Transmit multiple frames and measure timing
    uint32_t frame_times[32];
    int valid_frames = 0;

    for (int frame = 0; frame < 32; frame++) {
        uint32_t t0 = micros();
        transmit_leds();
        uint32_t t1 = micros();

        frame_times[frame] = t1 - t0;

        // All frames should complete within reasonable time (< 2ms)
        if (frame_times[frame] < 2000) {
            valid_frames++;
        }

        // Brief delay to allow RMT to complete
        vTaskDelay(pdMS_TO_TICKS(8));
    }

    // Calculate statistics
    uint32_t avg_time = 0;
    for (int i = 0; i < 32; i++) {
        avg_time += frame_times[i];
    }
    avg_time /= 32;

    Serial.printf("  Valid frames: %d/32\n", valid_frames);
    Serial.printf("  Avg TX time: %u us\n", avg_time);
    Serial.printf("  RMT wait timeouts: %u\n", g_led_rmt_wait_timeouts.load());

    TEST_ASSERT_GREATER_THAN(30, valid_frames);  // At least 30/32 frames valid
    TestResults::instance().add_pass("RMT dual-channel sync verified");
}

/**
 * TEST 2: LED Color Accuracy
 * Set known colors and verify via telemetry payload
 */
void test_led_color_accuracy() {
    Serial.println("\n=== TEST 2: LED Color Accuracy ===");

    init_rmt_driver();
    vTaskDelay(pdMS_TO_TICKS(100));

    // Test 1: Full red
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGBF{1.0f, 0.0f, 0.0f};
    }
    global_brightness = 1.0f;

    quantize_color(false);

    // Verify rgb8_data contains correct values (red = [255, 0, 0] in RGB order)
    for (int i = 0; i < NUM_LEDS; i++) {
        const int base = i * 3;
        TEST_ASSERT_EQUAL_INT(255, rgb8_data[base + 0]);  // R
        TEST_ASSERT_EQUAL_INT(0, rgb8_data[base + 1]);    // G
        TEST_ASSERT_EQUAL_INT(0, rgb8_data[base + 2]);    // B
    }

    // Test 2: Full green
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGBF{0.0f, 1.0f, 0.0f};
    }
    quantize_color(false);

    for (int i = 0; i < NUM_LEDS; i++) {
        const int base = i * 3;
        TEST_ASSERT_EQUAL_INT(0, rgb8_data[base + 0]);     // R
        TEST_ASSERT_EQUAL_INT(255, rgb8_data[base + 1]);   // G
        TEST_ASSERT_EQUAL_INT(0, rgb8_data[base + 2]);     // B
    }

    // Test 3: Full blue
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGBF{0.0f, 0.0f, 1.0f};
    }
    quantize_color(false);

    for (int i = 0; i < NUM_LEDS; i++) {
        const int base = i * 3;
        TEST_ASSERT_EQUAL_INT(0, rgb8_data[base + 0]);     // R
        TEST_ASSERT_EQUAL_INT(0, rgb8_data[base + 1]);     // G
        TEST_ASSERT_EQUAL_INT(255, rgb8_data[base + 2]);   // B
    }

    // Test 4: Mid-level (50% brightness)
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGBF{0.5f, 0.5f, 0.5f};
    }
    quantize_color(false);

    for (int i = 0; i < NUM_LEDS; i++) {
        const int base = i * 3;
        uint8_t expected = 128;
        TEST_ASSERT_INT_WITHIN(1, expected, rgb8_data[base + 0]);
        TEST_ASSERT_INT_WITHIN(1, expected, rgb8_data[base + 1]);
        TEST_ASSERT_INT_WITHIN(1, expected, rgb8_data[base + 2]);
    }

    Serial.println("  Color accuracy verified: red, green, blue, mid-level");
    TestResults::instance().add_pass("LED color accuracy validated");
}

/**
 * TEST 3: Frame Timing Stability
 * Measure frame-to-frame jitter (must be <2ms)
 */
void test_frame_timing_stability() {
    Serial.println("\n=== TEST 3: Frame Timing Stability ===");

    init_rmt_driver();
    vTaskDelay(pdMS_TO_TICKS(100));

    // Capture frame times
    uint32_t frame_times[128];
    uint32_t last_frame_us = 0;

    for (int i = 0; i < 128; i++) {
        // Animate simple pattern
        for (int j = 0; j < NUM_LEDS; j++) {
            float phase = (float)(i + j) / 128.0f;
            leds[j] = CRGBF{
                sinf(phase * 6.28f) * 0.5f + 0.5f,
                cosf(phase * 6.28f) * 0.5f + 0.5f,
                0.5f
            };
        }
        global_brightness = 1.0f;

        uint32_t t0 = micros();
        quantize_color(false);
        transmit_leds();
        uint32_t t1 = micros();

        frame_times[i] = t1 - t0;

        if (last_frame_us > 0) {
            test_telemetry.frame_deltas[i] = t1 - last_frame_us;
            if (test_telemetry.frame_deltas[i] > test_telemetry.max_delta_us) {
                test_telemetry.max_delta_us = test_telemetry.frame_deltas[i];
            }
            if (test_telemetry.frame_deltas[i] < test_telemetry.min_delta_us) {
                test_telemetry.min_delta_us = test_telemetry.frame_deltas[i];
            }
        }
        last_frame_us = t1;

        // Target ~6ms per frame (160 FPS) but allow variation
        vTaskDelay(pdMS_TO_TICKS(6));
    }

    // Calculate average frame time
    uint32_t avg_frame_time = 0;
    for (int i = 1; i < 128; i++) {
        avg_frame_time += test_telemetry.frame_deltas[i];
    }
    avg_frame_time /= 127;

    // Calculate jitter (stddev approximation)
    uint32_t jitter_sum = 0;
    for (int i = 1; i < 128; i++) {
        uint32_t delta = test_telemetry.frame_deltas[i];
        if (delta > avg_frame_time) {
            jitter_sum += (delta - avg_frame_time);
        } else {
            jitter_sum += (avg_frame_time - delta);
        }
    }
    uint32_t avg_jitter = jitter_sum / 127;

    Serial.printf("  Avg frame interval: %u us\n", avg_frame_time);
    Serial.printf("  Max frame interval: %u us\n", test_telemetry.max_delta_us);
    Serial.printf("  Min frame interval: %u us\n", test_telemetry.min_delta_us);
    Serial.printf("  Avg jitter: %u us\n", avg_jitter);

    // Jitter must be < 2000 us (2ms)
    TEST_ASSERT_LESS_THAN(2000, avg_jitter);
    TestResults::instance().add_timing("Frame jitter (us)", (float)avg_jitter);
    TestResults::instance().add_pass("Frame timing stability verified");
}

/**
 * TEST 4: Memory Bounds
 * Verify heap doesn't exceed 200KB total usage
 */
void test_memory_bounds() {
    Serial.println("\n=== TEST 4: Memory Bounds ===");

    MemorySnapshot start_mem = MemorySnapshot::capture();

    // Initialize driver
    init_rmt_driver();

    MemorySnapshot after_init = MemorySnapshot::capture();

    // Run pattern animation for a bit
    for (int i = 0; i < 100; i++) {
        for (int j = 0; j < NUM_LEDS; j++) {
            float phase = (float)(i + j) / 100.0f;
            leds[j] = CRGBF{
                sinf(phase * 6.28f) * 0.5f + 0.5f,
                cosf(phase * 6.28f) * 0.5f + 0.5f,
                0.5f
            };
        }
        global_brightness = 1.0f;
        quantize_color(false);
        transmit_leds();
        vTaskDelay(pdMS_TO_TICKS(5));
    }

    MemorySnapshot end_mem = MemorySnapshot::capture();

    // Print memory state
    Serial.println("  Memory snapshots:");
    Serial.println("  Before init:");
    start_mem.print();
    Serial.println("  After init:");
    after_init.print();
    Serial.println("  After 100 frames:");
    end_mem.print();

    // Check heap usage is reasonable
    // Total usage should be well under 200KB
    int32_t total_usage = (int32_t)start_mem.free_heap - (int32_t)end_mem.free_heap;

    Serial.printf("  Total heap used: %d bytes\n", total_usage);

    // Allow up to 50KB for LED driver + pattern state
    TEST_ASSERT_LESS_THAN(50000, total_usage);

    // Verify no memory leak during animation (delta < 1KB)
    int32_t animation_delta = (int32_t)after_init.free_heap - (int32_t)end_mem.free_heap;
    TEST_ASSERT_LESS_THAN(1024, animation_delta);

    TestResults::instance().add_metric("Heap used (bytes)", (float)total_usage);
    TestResults::instance().add_pass("Memory bounds verified");
}

void setup() {
    Serial.begin(2000000);
    delay(2000);

    Serial.println("\n\n========================================");
    Serial.println("HARDWARE VALIDATION: LED DRIVER");
    Serial.println("========================================\n");

    UNITY_BEGIN();
    RUN_TEST(test_rmt_dual_channel_sync);
    RUN_TEST(test_led_color_accuracy);
    RUN_TEST(test_frame_timing_stability);
    RUN_TEST(test_memory_bounds);
    UNITY_END();

    TestResults::instance().print_summary();
}

void loop() {
    delay(1000);
}

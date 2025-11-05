/**
 * TEST SUITE: Fix #1 - Pattern Snapshots
 *
 * Validates that patterns receive atomic audio snapshots without tearing
 * when audio data is updated by the audio processing thread.
 *
 * CRITICAL BEHAVIORS TESTED:
 * 1. Snapshot copy is atomic (no partial updates visible)
 * 2. All pixels in a frame see the same audio data
 * 3. Memcpy overhead is acceptable (< 50 microseconds)
 * 4. Concurrent audio updates don't corrupt pattern data
 * 5. Update counter increments correctly
 * 6. Timestamp reflects actual audio update time
 */

#include <Arduino.h>
#include <unity.h>
#include "../test_utils/test_helpers.h"
#include "../../src/audio/goertzel.h"
#include "../../src/pattern_audio_interface.h"

// ============================================================================
// TEST SETUP / TEARDOWN
// ============================================================================

void setUp(void) {
    // Initialize audio data sync before each test
    init_audio_data_sync();
}

void tearDown(void) {
    // Cleanup after each test
    vTaskDelay(pdMS_TO_TICKS(100));
}

// ============================================================================
// TEST 1: Atomic Snapshot Copy
// ============================================================================

void test_snapshot_is_atomic() {
    Serial.println("\n=== TEST: Snapshot Is Atomic ===");

    // Populate back buffer with known pattern
    for (int i = 0; i < NUM_FREQS; i++) {
        audio_back.spectrogram[i] = (float)i / NUM_FREQS;
        audio_back.spectrogram_smooth[i] = (float)i / NUM_FREQS * 0.8f;
    }
    audio_back.update_counter = 12345;
    audio_back.timestamp_us = esp_timer_get_time();
    audio_back.is_valid = true;

    // Commit to front buffer
    commit_audio_data();

    // Get snapshot
    AudioDataSnapshot snapshot;
    bool success = get_audio_snapshot(&snapshot);

    // Verify snapshot matches committed data exactly
    TEST_ASSERT_TRUE(success);
    TEST_ASSERT_EQUAL_UINT32(12345, snapshot.update_counter);
    TEST_ASSERT_TRUE(snapshot.is_valid);

    // Verify all array data is consistent
    for (int i = 0; i < NUM_FREQS; i++) {
        TEST_ASSERT_FLOAT_WITHIN(0.0001f, (float)i / NUM_FREQS,
                                 snapshot.spectrogram[i]);
        TEST_ASSERT_FLOAT_WITHIN(0.0001f, (float)i / NUM_FREQS * 0.8f,
                                 snapshot.spectrogram_smooth[i]);
    }

    TestResults::instance().add_pass("Snapshot atomic copy");
}

// ============================================================================
// TEST 2: No Tearing Between Updates
// ============================================================================

volatile bool update_task_running = false;
volatile int tear_count = 0;

void audio_update_task(void* param) {
    update_task_running = true;

    // Rapidly update audio_back buffer with incrementing pattern
    for (int frame = 0; frame < 1000; frame++) {
        // Write pattern: all bins = frame number
        for (int i = 0; i < NUM_FREQS; i++) {
            audio_back.spectrogram[i] = (float)frame;
        }
        audio_back.update_counter = frame;
        audio_back.timestamp_us = esp_timer_get_time();

        // Commit
        commit_audio_data();

        vTaskDelay(pdMS_TO_TICKS(1));
    }

    update_task_running = false;
    vTaskDelete(NULL);
}

void test_no_tearing_during_updates() {
    Serial.println("\n=== TEST: No Tearing During Updates ===");

    tear_count = 0;

    // Create task that rapidly updates audio
    xTaskCreatePinnedToCore(audio_update_task, "AudioUpdate", 4096, NULL, 10, NULL, 1);

    // Wait for task to start
    vTaskDelay(pdMS_TO_TICKS(50));

    // Read snapshots rapidly and check for tearing
    int snapshot_count = 0;
    while (update_task_running) {
        AudioDataSnapshot snapshot;
        if (get_audio_snapshot(&snapshot)) {
            // Check that all bins have the same value (no partial update)
            float first_value = snapshot.spectrogram[0];
            for (int i = 1; i < NUM_FREQS; i++) {
                if (fabsf(snapshot.spectrogram[i] - first_value) > 0.0001f) {
                    tear_count++;
                    Serial.printf("TEAR DETECTED: bin[0]=%.3f, bin[%d]=%.3f\n",
                                 first_value, i, snapshot.spectrogram[i]);
                    break;
                }
            }
            snapshot_count++;
        }
        vTaskDelay(pdMS_TO_TICKS(1));
    }

    Serial.printf("Checked %d snapshots\n", snapshot_count);
    TEST_ASSERT_EQUAL_INT(0, tear_count);
    TEST_ASSERT_GREATER_THAN(100, snapshot_count);  // Should have checked many frames

    TestResults::instance().add_pass("No tearing detected");
}

// ============================================================================
// TEST 3: Memcpy Overhead Measurement
// ============================================================================

void test_snapshot_overhead() {
    Serial.println("\n=== TEST: Snapshot Overhead ===");

    // Populate audio data
    for (int i = 0; i < NUM_FREQS; i++) {
        audio_back.spectrogram[i] = 0.5f;
        audio_back.spectrogram_smooth[i] = 0.5f;
    }
    audio_back.update_counter = 1;
    audio_back.timestamp_us = esp_timer_get_time();
    commit_audio_data();

    // Measure snapshot overhead
    const int NUM_SAMPLES = 1000;
    TestTimer timer;
    uint64_t total_us = 0;

    for (int i = 0; i < NUM_SAMPLES; i++) {
        AudioDataSnapshot snapshot;

        timer.start();
        bool success = get_audio_snapshot(&snapshot);
        timer.stop();

        TEST_ASSERT_TRUE(success);
        total_us += timer.elapsed_us();
    }

    float avg_us = total_us / (float)NUM_SAMPLES;
    Serial.printf("Average snapshot time: %.2f microseconds\n", avg_us);

    // Snapshot should be very fast (< 50 microseconds)
    TEST_ASSERT_LESS_THAN(50, avg_us);

    TestResults::instance().add_timing("Snapshot overhead", avg_us / 1000.0f);
    TestResults::instance().add_pass("Snapshot overhead acceptable");
}

// ============================================================================
// TEST 4: Concurrent Updates Don't Corrupt Data
// ============================================================================

volatile int corruption_count = 0;

void concurrent_writer_task(void* param) {
    for (int i = 0; i < 500; i++) {
        // Write alternating pattern (0.0 or 1.0)
        float value = (i % 2 == 0) ? 0.0f : 1.0f;
        for (int j = 0; j < NUM_FREQS; j++) {
            audio_back.spectrogram[j] = value;
        }
        audio_back.update_counter = i;
        commit_audio_data();

        vTaskDelay(pdMS_TO_TICKS(2));
    }
    vTaskDelete(NULL);
}

void concurrent_reader_task(void* param) {
    for (int i = 0; i < 500; i++) {
        AudioDataSnapshot snapshot;
        if (get_audio_snapshot(&snapshot)) {
            // Verify all bins have same value (0.0 or 1.0)
            float first = snapshot.spectrogram[0];
            if (fabsf(first) > 0.0001f && fabsf(first - 1.0f) > 0.0001f) {
                // Invalid value (should be exactly 0.0 or 1.0)
                corruption_count++;
            }

            // Check all bins match
            for (int j = 1; j < NUM_FREQS; j++) {
                if (fabsf(snapshot.spectrogram[j] - first) > 0.0001f) {
                    corruption_count++;
                    break;
                }
            }
        }
        vTaskDelay(pdMS_TO_TICKS(2));
    }
    vTaskDelete(NULL);
}

void test_concurrent_access() {
    Serial.println("\n=== TEST: Concurrent Access ===");

    corruption_count = 0;

    // Create writer on Core 1, reader on Core 0
    xTaskCreatePinnedToCore(concurrent_writer_task, "Writer", 4096, NULL, 10, NULL, 1);
    xTaskCreatePinnedToCore(concurrent_reader_task, "Reader", 4096, NULL, 10, NULL, 0);

    // Wait for both tasks to complete
    vTaskDelay(pdMS_TO_TICKS(2000));

    TEST_ASSERT_EQUAL_INT(0, corruption_count);
    TestResults::instance().add_pass("No corruption with concurrent access");
}

// ============================================================================
// TEST 5: Update Counter Increments Correctly
// ============================================================================

void test_update_counter() {
    Serial.println("\n=== TEST: Update Counter ===");

    AudioDataSnapshot snap1, snap2, snap3;

    // First update
    audio_back.update_counter = 100;
    commit_audio_data();
    get_audio_snapshot(&snap1);

    // Second update
    audio_back.update_counter = 101;
    commit_audio_data();
    get_audio_snapshot(&snap2);

    // Third update
    audio_back.update_counter = 102;
    commit_audio_data();
    get_audio_snapshot(&snap3);

    TEST_ASSERT_EQUAL_UINT32(100, snap1.update_counter);
    TEST_ASSERT_EQUAL_UINT32(101, snap2.update_counter);
    TEST_ASSERT_EQUAL_UINT32(102, snap3.update_counter);

    TestResults::instance().add_pass("Update counter increments correctly");
}

// ============================================================================
// TEST 6: Timestamp Accuracy
// ============================================================================

void test_timestamp_accuracy() {
    Serial.println("\n=== TEST: Timestamp Accuracy ===");

    // Capture time before update
    uint64_t before_us = esp_timer_get_time();

    // Update with current timestamp
    audio_back.timestamp_us = esp_timer_get_time();
    audio_back.update_counter = 1;
    commit_audio_data();

    // Capture time after update
    uint64_t after_us = esp_timer_get_time();

    // Get snapshot
    AudioDataSnapshot snapshot;
    get_audio_snapshot(&snapshot);

    // Timestamp should be between before and after
    TEST_ASSERT_GREATER_OR_EQUAL(before_us, snapshot.timestamp_us);
    TEST_ASSERT_LESS_OR_EQUAL(after_us, snapshot.timestamp_us);

    // Age should be very small (< 10ms)
    uint64_t age_us = esp_timer_get_time() - snapshot.timestamp_us;
    float age_ms = age_us / 1000.0f;
    Serial.printf("Snapshot age: %.3f ms\n", age_ms);
    TEST_ASSERT_LESS_THAN(10.0f, age_ms);

    TestResults::instance().add_pass("Timestamp accuracy verified");
}

// ============================================================================
// TEST 7: PATTERN_AUDIO_START() Macro Integration
// ============================================================================

void test_macro_integration() {
    Serial.println("\n=== TEST: PATTERN_AUDIO_START() Macro ===");

    // Populate audio data
    for (int i = 0; i < NUM_FREQS; i++) {
        audio_back.spectrogram[i] = (float)i / 100.0f;
    }
    audio_back.update_counter = 42;
    audio_back.timestamp_us = esp_timer_get_time();
    commit_audio_data();

    // Simulate pattern using macro
    {
        PATTERN_AUDIO_START();

        // Check macro created expected variables
        TEST_ASSERT_TRUE(audio_available);
        TEST_ASSERT_TRUE(audio_is_fresh);  // First call should be fresh
        TEST_ASSERT_LESS_THAN(20, audio_age_ms);

        // Verify data accessible via macros
        TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, AUDIO_SPECTRUM[0]);
        TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.63f, AUDIO_SPECTRUM[63]);
    }

    // Call again - should not be fresh
    {
        PATTERN_AUDIO_START();
        TEST_ASSERT_TRUE(audio_available);
        TEST_ASSERT_FALSE(audio_is_fresh);  // Second call with same data
    }

    // Update and call again - should be fresh
    audio_back.update_counter = 43;
    commit_audio_data();
    {
        PATTERN_AUDIO_START();
        TEST_ASSERT_TRUE(audio_available);
        TEST_ASSERT_TRUE(audio_is_fresh);  // New data available
    }

    TestResults::instance().add_pass("PATTERN_AUDIO_START() macro works correctly");
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

void setup() {
    Serial.begin(2000000);
    delay(2000);  // Wait for serial

    Serial.println("\n\n========================================");
    Serial.println("FIX #1: PATTERN SNAPSHOTS - TEST SUITE");
    Serial.println("========================================\n");

    UNITY_BEGIN();

    RUN_TEST(test_snapshot_is_atomic);
    RUN_TEST(test_no_tearing_during_updates);
    RUN_TEST(test_snapshot_overhead);
    RUN_TEST(test_concurrent_access);
    RUN_TEST(test_update_counter);
    RUN_TEST(test_timestamp_accuracy);
    RUN_TEST(test_macro_integration);

    UNITY_END();

    TestResults::instance().print_summary();
}

void loop() {
    // Tests run once in setup()
    delay(1000);
}

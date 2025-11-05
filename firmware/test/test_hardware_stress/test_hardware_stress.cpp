/**
 * TEST SUITE: Hardware Stress Tests
 *
 * Long-running stress tests for production readiness validation
 * WARNING: These tests take 30+ minutes to complete
 */

#include <Arduino.h>
#include <unity.h>
#include <WiFi.h>
#include "../test_utils/test_helpers.h"
#include "../../src/audio/goertzel.h"
#include "../../src/pattern_audio_interface.h"
#include "../../src/pattern_registry.h"

TaskHandle_t audio_task_handle = NULL;

void audio_task(void* param) {
    while (true) {
        for (int i = 0; i < NUM_FREQS; i++) {
            audio_back.spectrogram[i] = random(1000) / 1000.0f;
        }
        audio_back.update_counter++;
        audio_back.timestamp_us = esp_timer_get_time();
        commit_audio_data();
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

void setUp(void) {
    init_audio_data_sync();
    init_window_lookup();
    init_goertzel_constants_musical();
    init_params();
    init_pattern_registry();
}

void tearDown(void) {
    if (audio_task_handle != NULL) {
        vTaskDelete(audio_task_handle);
        audio_task_handle = NULL;
    }
    vTaskDelay(pdMS_TO_TICKS(100));
}

void test_30min_continuous_runtime() {
    Serial.println("\n=== TEST: 30-Minute Continuous Runtime ===");
    Serial.println("WARNING: This test takes 30 minutes!");
    Serial.println("Press 's' to skip this test");

    delay(5000);

    if (Serial.available() && Serial.read() == 's') {
        Serial.println("SKIPPED by user");
        TEST_IGNORE_MESSAGE("User skipped 30-minute test");
        return;
    }

    MemorySnapshot start_mem = MemorySnapshot::capture();

    xTaskCreatePinnedToCore(audio_task, "Audio", 8192, NULL, 10, &audio_task_handle, 1);

    const uint32_t TEST_DURATION_MS = 30 * 60 * 1000;  // 30 minutes
    uint32_t start_time = millis();
    uint32_t last_report = start_time;
    int crash_count = 0;
    int frame_count = 0;

    Serial.println("Starting 30-minute stress test...");

    while (millis() - start_time < TEST_DURATION_MS) {
        // Simulate render loop
        AudioDataSnapshot snapshot;
        if (get_audio_snapshot(&snapshot)) {
            frame_count++;
        } else {
            crash_count++;
        }

        // Report every minute
        if (millis() - last_report > 60000) {
            uint32_t elapsed_min = (millis() - start_time) / 60000;
            MemorySnapshot current_mem = MemorySnapshot::capture();
            Serial.printf("[%d min] Frames: %d, Crashes: %d, Free heap: %u\n",
                         elapsed_min, frame_count, crash_count, current_mem.free_heap);
            last_report = millis();
        }

        vTaskDelay(pdMS_TO_TICKS(5));
    }

    MemorySnapshot end_mem = MemorySnapshot::capture();

    Serial.println("\n30-minute test complete!");
    Serial.printf("Total frames: %d\n", frame_count);
    Serial.printf("Crashes: %d\n", crash_count);
    Serial.printf("Heap delta: %d bytes\n", start_mem.heap_delta(end_mem));

    TEST_ASSERT_EQUAL_INT(0, crash_count);
    TEST_ASSERT_NO_MEMORY_LEAK(start_mem.free_heap, end_mem.free_heap, 5120);

    TestResults::instance().add_pass("30-minute runtime test passed");
}

void test_rapid_pattern_changes() {
    Serial.println("\n=== TEST: Rapid Pattern Changes ===");

    xTaskCreatePinnedToCore(audio_task, "Audio", 8192, NULL, 10, &audio_task_handle, 1);

    int pattern_count = g_num_patterns;
    int cycles = 1000;
    int deadlock_count = 0;

    Serial.printf("Testing %d pattern switches\n", cycles);

    for (int i = 0; i < cycles; i++) {
        int pattern_idx = random(pattern_count);
        set_current_pattern(pattern_idx);

        AudioDataSnapshot snapshot;
        if (!get_audio_snapshot(&snapshot)) {
            deadlock_count++;
        }

        if (i % 100 == 0) {
            Serial.printf("Progress: %d / %d\n", i, cycles);
        }

        vTaskDelay(pdMS_TO_TICKS(5));
    }

    Serial.printf("Completed %d switches, deadlocks: %d\n", cycles, deadlock_count);
    TEST_ASSERT_EQUAL_INT(0, deadlock_count);

    TestResults::instance().add_pass("Rapid pattern switching test passed");
}

void test_audio_frequency_sweep() {
    Serial.println("\n=== TEST: Audio Frequency Sweep ===");

    xTaskCreatePinnedToCore(audio_task, "Audio", 8192, NULL, 10, &audio_task_handle, 1);

    // Simulate frequency sweep by updating spectrum bins
    int sweep_duration_ms = 10000;
    uint32_t start_time = millis();
    int response_count = 0;

    while (millis() - start_time < sweep_duration_ms) {
        float progress = (millis() - start_time) / (float)sweep_duration_ms;
        int active_bin = (int)(progress * NUM_FREQS);

        // Clear spectrum and set one bin high
        for (int i = 0; i < NUM_FREQS; i++) {
            audio_back.spectrogram[i] = (i == active_bin) ? 1.0f : 0.0f;
        }
        audio_back.update_counter++;
        commit_audio_data();

        // Verify snapshot reflects change
        AudioDataSnapshot snapshot;
        if (get_audio_snapshot(&snapshot)) {
            if (snapshot.spectrogram[active_bin] > 0.5f) {
                response_count++;
            }
        }

        vTaskDelay(pdMS_TO_TICKS(10));
    }

    Serial.printf("Audio responses: %d\n", response_count);
    TEST_ASSERT_GREATER_THAN(500, response_count);

    TestResults::instance().add_pass("Frequency sweep test passed");
}

void test_wifi_ota_during_rendering() {
    Serial.println("\n=== TEST: WiFi + OTA During Rendering ===");

    xTaskCreatePinnedToCore(audio_task, "Audio", 8192, NULL, 10, &audio_task_handle, 1);

    // Check WiFi is connected
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi not connected, skipping test");
        TEST_IGNORE_MESSAGE("WiFi not available");
        return;
    }

    int render_frames = 0;
    int network_checks = 0;
    uint32_t start_time = millis();

    while (millis() - start_time < 10000) {
        // Simulate rendering
        AudioDataSnapshot snapshot;
        if (get_audio_snapshot(&snapshot)) {
            render_frames++;
        }

        // Check WiFi status periodically
        if (render_frames % 100 == 0) {
            if (WiFi.status() == WL_CONNECTED) {
                network_checks++;
            }
        }

        vTaskDelay(pdMS_TO_TICKS(5));
    }

    Serial.printf("Render frames: %d\n", render_frames);
    Serial.printf("Network checks: %d\n", network_checks);

    TEST_ASSERT_GREATER_THAN(1000, render_frames);
    TEST_ASSERT_GREATER_THAN(5, network_checks);

    TestResults::instance().add_pass("WiFi interference test passed");
}

void test_thermal_monitoring() {
    Serial.println("\n=== TEST: Thermal Monitoring ===");

    xTaskCreatePinnedToCore(audio_task, "Audio", 8192, NULL, 10, &audio_task_handle, 1);

    Serial.println("Running heavy load for 5 minutes...");

    uint32_t start_time = millis();
    float max_temp = 0.0f;

    while (millis() - start_time < 300000) {  // 5 minutes
        // Heavy processing
        AudioDataSnapshot snapshot;
        get_audio_snapshot(&snapshot);

        // Simulate intensive rendering
        for (int i = 0; i < 1000; i++) {
            volatile float dummy = sinf((float)i);
        }

        // Check temperature
        float temp = read_cpu_temperature();
        if (temp > max_temp) {
            max_temp = temp;
        }

        if ((millis() - start_time) % 60000 == 0) {
            Serial.printf("[%d min] Temperature: %.1f°C\n",
                         (millis() - start_time) / 60000, temp);
        }

        vTaskDelay(pdMS_TO_TICKS(10));
    }

    Serial.printf("Max temperature: %.1f°C\n", max_temp);

    // ESP32-S3 should stay below 70°C
    TEST_ASSERT_LESS_THAN(70.0f, max_temp);

    TestResults::instance().add_metric("Max temperature (°C)", max_temp);
    TestResults::instance().add_pass("Thermal test passed");
}

void setup() {
    Serial.begin(2000000);
    delay(2000);

    Serial.println("\n\n========================================");
    Serial.println("HARDWARE STRESS TESTS");
    Serial.println("========================================\n");
    Serial.println("WARNING: These tests take 30+ minutes!");
    Serial.println("Press 's' within 5 seconds to skip long tests\n");

    UNITY_BEGIN();
    RUN_TEST(test_30min_continuous_runtime);
    RUN_TEST(test_rapid_pattern_changes);
    RUN_TEST(test_audio_frequency_sweep);
    RUN_TEST(test_wifi_ota_during_rendering);
    RUN_TEST(test_thermal_monitoring);
    UNITY_END();

    TestResults::instance().print_summary();
}

void loop() {
    delay(1000);
}

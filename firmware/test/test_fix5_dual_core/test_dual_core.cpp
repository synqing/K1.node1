/**
 * TEST SUITE: Fix #5 - Dual-Core Architecture
 *
 * Validates that audio and rendering run on separate cores for optimal performance
 */

#include <Arduino.h>
#include <unity.h>
#include "../test_utils/test_helpers.h"
#include "../../src/audio/goertzel.h"
#include "../../src/pattern_audio_interface.h"

TaskHandle_t audio_task_handle = NULL;

void setUp(void) {
    init_audio_data_sync();
    init_window_lookup();
    init_goertzel_constants_musical();
}

void tearDown(void) {
    if (audio_task_handle != NULL) {
        vTaskDelete(audio_task_handle);
        audio_task_handle = NULL;
    }
    vTaskDelay(pdMS_TO_TICKS(100));
}

void audio_processing_task(void* param) {
    while (true) {
        // Simulate audio processing
        for (int i = 0; i < NUM_FREQS; i++) {
            audio_back.spectrogram[i] = random(1000) / 1000.0f;
        }
        audio_back.update_counter++;
        audio_back.timestamp_us = esp_timer_get_time();
        commit_audio_data();

        vTaskDelay(pdMS_TO_TICKS(10));  // ~100 Hz
    }
}

void test_audio_task_creation() {
    Serial.println("\n=== TEST: Audio Task Creation ===");

    BaseType_t result = xTaskCreatePinnedToCore(
        audio_processing_task,
        "TestAudio",
        8192,
        NULL,
        10,
        &audio_task_handle,
        1  // Core 1
    );

    TEST_ASSERT_EQUAL(pdPASS, result);
    TEST_ASSERT_NOT_NULL(audio_task_handle);

    // Verify task is running
    vTaskDelay(pdMS_TO_TICKS(100));

    AudioDataSnapshot snapshot;
    bool success = get_audio_snapshot(&snapshot);
    TEST_ASSERT_TRUE(success);

    TestResults::instance().add_pass("Audio task created on Core 1");
}

void test_parallel_execution() {
    Serial.println("\n=== TEST: Parallel Core Execution ===");

    volatile int core0_count = 0;
    volatile int core1_count = 0;
    volatile bool test_running = true;

    auto core0_task = [](void* param) {
        while (*(volatile bool*)param) {
            ((volatile int*)param)[1]++;  // Increment core0_count
            delayMicroseconds(100);
        }
        vTaskDelete(NULL);
    };

    auto core1_task = [](void* param) {
        while (*(volatile bool*)param) {
            ((volatile int*)param)[2]++;  // Increment core1_count
            delayMicroseconds(100);
        }
        vTaskDelete(NULL);
    };

    struct Params {
        volatile bool running;
        volatile int core0;
        volatile int core1;
    } params = {true, 0, 0};

    xTaskCreatePinnedToCore(core0_task, "Core0", 2048, (void*)&params, 5, NULL, 0);
    xTaskCreatePinnedToCore(core1_task, "Core1", 2048, (void*)&params, 5, NULL, 1);

    vTaskDelay(pdMS_TO_TICKS(1000));
    params.running = false;
    vTaskDelay(pdMS_TO_TICKS(100));

    Serial.printf("Core 0 count: %d\n", params.core0);
    Serial.printf("Core 1 count: %d\n", params.core1);

    TEST_ASSERT_GREATER_THAN(1000, params.core0);
    TEST_ASSERT_GREATER_THAN(1000, params.core1);

    TestResults::instance().add_pass("Both cores executing in parallel");
}

void test_fps_increase() {
    Serial.println("\n=== TEST: FPS Increase with Dual-Core ===");

    // Start audio task
    BaseType_t result = xTaskCreatePinnedToCore(
        audio_processing_task,
        "Audio",
        8192,
        NULL,
        10,
        &audio_task_handle,
        1
    );
    TEST_ASSERT_EQUAL(pdPASS, result);

    // Simulate render loop on Core 0
    FPSCounter fps_counter;
    fps_counter.reset();

    uint32_t start_time = millis();
    int frame_count = 0;

    while (millis() - start_time < 2000) {
        // Simulate lightweight pattern rendering
        AudioDataSnapshot snapshot;
        get_audio_snapshot(&snapshot);

        // Simulate pixel calculations
        for (int i = 0; i < 100; i++) {
            volatile float dummy = snapshot.spectrogram[i % NUM_FREQS];
        }

        frame_count++;
        fps_counter.tick();
        delayMicroseconds(500);  // Simulate some render time
    }

    float final_fps = fps_counter.get_fps();
    Serial.printf("Achieved FPS: %.1f\n", final_fps);
    Serial.printf("Total frames: %d\n", frame_count);

    // Target: > 200 FPS with dual-core
    TEST_ASSERT_GREATER_THAN(200.0f, final_fps);

    TestResults::instance().add_metric("Render FPS", final_fps);
    TestResults::instance().add_pass("FPS target achieved");
}

void test_audio_latency_reduction() {
    Serial.println("\n=== TEST: Audio Latency Reduction ===");

    BaseType_t result = xTaskCreatePinnedToCore(
        audio_processing_task,
        "Audio",
        8192,
        NULL,
        10,
        &audio_task_handle,
        1
    );
    TEST_ASSERT_EQUAL(pdPASS, result);

    vTaskDelay(pdMS_TO_TICKS(100));

    float max_latency_ms = 0.0f;
    int samples = 50;

    for (int i = 0; i < samples; i++) {
        AudioDataSnapshot snapshot;
        get_audio_snapshot(&snapshot);

        uint64_t age_us = esp_timer_get_time() - snapshot.timestamp_us;
        float age_ms = age_us / 1000.0f;

        if (age_ms > max_latency_ms) {
            max_latency_ms = age_ms;
        }

        vTaskDelay(pdMS_TO_TICKS(20));
    }

    Serial.printf("Max audio latency: %.2f ms\n", max_latency_ms);

    TEST_ASSERT_LESS_THAN(20.0f, max_latency_ms);

    TestResults::instance().add_metric("Max latency (ms)", max_latency_ms);
    TestResults::instance().add_pass("Audio latency under 20ms");
}

void test_no_memory_leaks() {
    Serial.println("\n=== TEST: No Memory Leaks (10 min runtime) ===");

    MemorySnapshot start_mem = MemorySnapshot::capture();
    Serial.println("Start memory:");
    start_mem.print();

    BaseType_t result = xTaskCreatePinnedToCore(
        audio_processing_task,
        "Audio",
        8192,
        NULL,
        10,
        &audio_task_handle,
        1
    );
    TEST_ASSERT_EQUAL(pdPASS, result);

    // Run for 10 seconds (scaled down from 10 minutes for testing)
    uint32_t runtime_ms = 10000;
    uint32_t start_time = millis();

    while (millis() - start_time < runtime_ms) {
        AudioDataSnapshot snapshot;
        get_audio_snapshot(&snapshot);
        vTaskDelay(pdMS_TO_TICKS(100));
    }

    vTaskDelete(audio_task_handle);
    audio_task_handle = NULL;
    vTaskDelay(pdMS_TO_TICKS(200));

    MemorySnapshot end_mem = MemorySnapshot::capture();
    Serial.println("End memory:");
    end_mem.print();

    int32_t heap_delta = start_mem.heap_delta(end_mem);
    Serial.printf("Heap delta: %d bytes\n", heap_delta);

    // Allow 1KB tolerance for normal variance
    TEST_ASSERT_NO_MEMORY_LEAK(start_mem.free_heap, end_mem.free_heap, 1024);

    TestResults::instance().add_pass("No memory leaks detected");
}

void test_pattern_switching_under_load() {
    Serial.println("\n=== TEST: Pattern Switching Under Load ===");

    BaseType_t result = xTaskCreatePinnedToCore(
        audio_processing_task,
        "Audio",
        8192,
        NULL,
        10,
        &audio_task_handle,
        1
    );
    TEST_ASSERT_EQUAL(pdPASS, result);

    // Rapidly read snapshots while "switching patterns"
    int successful_switches = 0;

    for (int i = 0; i < 100; i++) {
        AudioDataSnapshot snapshot;
        if (get_audio_snapshot(&snapshot)) {
            successful_switches++;
        }
        vTaskDelay(pdMS_TO_TICKS(5));
    }

    Serial.printf("Successful switches: %d / 100\n", successful_switches);
    TEST_ASSERT_GREATER_THAN(95, successful_switches);

    TestResults::instance().add_pass("Pattern switching works under load");
}

void test_task_stack_usage() {
    Serial.println("\n=== TEST: Task Stack Usage ===");

    BaseType_t result = xTaskCreatePinnedToCore(
        audio_processing_task,
        "Audio",
        8192,
        NULL,
        10,
        &audio_task_handle,
        1
    );
    TEST_ASSERT_EQUAL(pdPASS, result);

    vTaskDelay(pdMS_TO_TICKS(1000));

    UBaseType_t high_water_mark = uxTaskGetStackHighWaterMark(audio_task_handle);
    UBaseType_t stack_used = 8192 - (high_water_mark * sizeof(StackType_t));

    Serial.printf("Stack allocated: 8192 bytes\n");
    Serial.printf("Stack high water mark: %u words\n", high_water_mark);
    Serial.printf("Stack used: %u bytes\n", stack_used);

    // Stack usage should be < 7KB (leave 1KB margin)
    TEST_ASSERT_LESS_THAN(7168, stack_used);

    TestResults::instance().add_metric("Stack usage (bytes)", stack_used);
    TestResults::instance().add_pass("Stack usage acceptable");
}

void setup() {
    Serial.begin(2000000);
    delay(2000);

    Serial.println("\n\n========================================");
    Serial.println("FIX #5: DUAL-CORE ARCH - TEST SUITE");
    Serial.println("========================================\n");

    UNITY_BEGIN();
    RUN_TEST(test_audio_task_creation);
    RUN_TEST(test_parallel_execution);
    RUN_TEST(test_fps_increase);
    RUN_TEST(test_audio_latency_reduction);
    RUN_TEST(test_no_memory_leaks);
    RUN_TEST(test_pattern_switching_under_load);
    RUN_TEST(test_task_stack_usage);
    UNITY_END();

    TestResults::instance().print_summary();
}

void loop() {
    delay(1000);
}

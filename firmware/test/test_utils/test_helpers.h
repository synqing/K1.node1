#pragma once

#include <Arduino.h>
#include <unity.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <esp_timer.h>

// ============================================================================
// TEST TIMING UTILITIES
// ============================================================================

/**
 * High-precision timing measurement
 */
class TestTimer {
public:
    TestTimer() : start_us(0), end_us(0) {}

    void start() {
        start_us = esp_timer_get_time();
    }

    void stop() {
        end_us = esp_timer_get_time();
    }

    uint64_t elapsed_us() const {
        return end_us - start_us;
    }

    float elapsed_ms() const {
        return (end_us - start_us) / 1000.0f;
    }

    void reset() {
        start_us = 0;
        end_us = 0;
    }

private:
    uint64_t start_us;
    uint64_t end_us;
};

/**
 * FPS counter for performance testing
 */
class FPSCounter {
public:
    FPSCounter() : frame_count(0), last_report_ms(0), fps(0.0f) {}

    void tick() {
        frame_count++;
        uint32_t now = millis();
        if (now - last_report_ms >= 1000) {
            fps = frame_count / ((now - last_report_ms) / 1000.0f);
            frame_count = 0;
            last_report_ms = now;
        }
    }

    float get_fps() const {
        return fps;
    }

    void reset() {
        frame_count = 0;
        last_report_ms = millis();
        fps = 0.0f;
    }

private:
    uint32_t frame_count;
    uint32_t last_report_ms;
    float fps;
};

// ============================================================================
// TEST ASSERTIONS
// ============================================================================

/**
 * Assert value is within range (inclusive)
 */
#define TEST_ASSERT_IN_RANGE(val, min, max) \
    do { \
        if ((val) < (min) || (val) > (max)) { \
            char msg[128]; \
            snprintf(msg, sizeof(msg), "Value %f not in range [%f, %f]", \
                    (float)(val), (float)(min), (float)(max)); \
            TEST_FAIL_MESSAGE(msg); \
        } \
    } while(0)

/**
 * Assert latency is below threshold
 */
#define TEST_ASSERT_LATENCY_MS(actual_ms, threshold_ms) \
    do { \
        if ((actual_ms) > (threshold_ms)) { \
            char msg[128]; \
            snprintf(msg, sizeof(msg), "Latency %f ms exceeds threshold %f ms", \
                    (float)(actual_ms), (float)(threshold_ms)); \
            TEST_FAIL_MESSAGE(msg); \
        } \
    } while(0)

/**
 * Assert FPS is above minimum
 */
#define TEST_ASSERT_MIN_FPS(actual_fps, min_fps) \
    do { \
        if ((actual_fps) < (min_fps)) { \
            char msg[128]; \
            snprintf(msg, sizeof(msg), "FPS %f below minimum %f", \
                    (float)(actual_fps), (float)(min_fps)); \
            TEST_FAIL_MESSAGE(msg); \
        } \
    } while(0)

/**
 * Assert no memory leak (heap usage delta)
 */
#define TEST_ASSERT_NO_MEMORY_LEAK(start_heap, end_heap, tolerance) \
    do { \
        int32_t delta = (int32_t)(start_heap) - (int32_t)(end_heap); \
        if (delta > (int32_t)(tolerance)) { \
            char msg[128]; \
            snprintf(msg, sizeof(msg), "Memory leak detected: %d bytes lost", delta); \
            TEST_FAIL_MESSAGE(msg); \
        } \
    } while(0)

// ============================================================================
// MEMORY MONITORING
// ============================================================================

/**
 * Memory snapshot for leak detection
 */
struct MemorySnapshot {
    size_t free_heap;
    size_t largest_free_block;
    size_t min_free_heap;

    static MemorySnapshot capture() {
        MemorySnapshot snapshot;
        snapshot.free_heap = esp_get_free_heap_size();
        snapshot.largest_free_block = heap_caps_get_largest_free_block(MALLOC_CAP_8BIT);
        snapshot.min_free_heap = esp_get_minimum_free_heap_size();
        return snapshot;
    }

    void print() const {
        Serial.printf("  Free heap: %u bytes\n", free_heap);
        Serial.printf("  Largest block: %u bytes\n", largest_free_block);
        Serial.printf("  Min free heap: %u bytes\n", min_free_heap);
    }

    int32_t heap_delta(const MemorySnapshot& other) const {
        return (int32_t)other.free_heap - (int32_t)free_heap;
    }
};

// ============================================================================
// TASK MONITORING
// ============================================================================

/**
 * Get current core ID
 */
inline int get_current_core() {
    return xPortGetCoreID();
}

/**
 * Get task count
 */
inline UBaseType_t get_task_count() {
    return uxTaskGetNumberOfTasks();
}

/**
 * Print task list (for debugging)
 */
inline void print_task_list() {
    char buffer[512];
    vTaskList(buffer);
    Serial.println("Task List:");
    Serial.println(buffer);
}

// ============================================================================
// TEST DATA GENERATION
// ============================================================================

/**
 * Generate synthetic audio data for testing
 */
class AudioTestData {
public:
    /**
     * Generate sine wave frequency sweep
     */
    static void generate_frequency_sweep(float* buffer, int length,
                                          float start_freq, float end_freq,
                                          float sample_rate) {
        for (int i = 0; i < length; i++) {
            float t = (float)i / sample_rate;
            float freq = start_freq + (end_freq - start_freq) * t * sample_rate / length;
            buffer[i] = sinf(2.0f * PI * freq * t);
        }
    }

    /**
     * Generate white noise
     */
    static void generate_noise(float* buffer, int length) {
        for (int i = 0; i < length; i++) {
            buffer[i] = (random(10000) / 10000.0f) * 2.0f - 1.0f;
        }
    }

    /**
     * Generate silence
     */
    static void generate_silence(float* buffer, int length) {
        memset(buffer, 0, length * sizeof(float));
    }

    /**
     * Generate bass pulse (for beat detection tests)
     */
    static void generate_bass_pulse(float* buffer, int length, float bpm, float sample_rate) {
        float samples_per_beat = (60.0f / bpm) * sample_rate;
        for (int i = 0; i < length; i++) {
            float beat_phase = fmodf((float)i, samples_per_beat) / samples_per_beat;
            // Sharp attack, exponential decay
            buffer[i] = expf(-beat_phase * 10.0f) * sinf(2.0f * PI * 55.0f * i / sample_rate);
        }
    }
};

// ============================================================================
// TEST SYNCHRONIZATION
// ============================================================================

/**
 * Wait for condition with timeout
 */
template<typename Predicate>
bool wait_for_condition(Predicate pred, uint32_t timeout_ms) {
    uint32_t start = millis();
    while (!pred()) {
        if (millis() - start > timeout_ms) {
            return false;
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
    return true;
}

/**
 * Thread barrier for synchronizing multiple tasks
 */
class ThreadBarrier {
public:
    ThreadBarrier(int num_threads) :
        count(num_threads),
        waiting(0),
        generation(0),
        mutex(xSemaphoreCreateMutex()) {}

    ~ThreadBarrier() {
        vSemaphoreDelete(mutex);
    }

    void wait() {
        xSemaphoreTake(mutex, portMAX_DELAY);
        int gen = generation;
        waiting++;

        if (waiting >= count) {
            // Last thread - reset and wake everyone
            waiting = 0;
            generation++;
            xSemaphoreGive(mutex);
        } else {
            // Not last thread - wait
            xSemaphoreGive(mutex);
            while (generation == gen) {
                vTaskDelay(pdMS_TO_TICKS(1));
            }
        }
    }

private:
    int count;
    int waiting;
    int generation;
    SemaphoreHandle_t mutex;
};

// ============================================================================
// TEST REPORTING
// ============================================================================

/**
 * Test result aggregator
 */
class TestResults {
public:
    static TestResults& instance() {
        static TestResults inst;
        return inst;
    }

    void add_metric(const char* name, float value) {
        Serial.printf("  [METRIC] %s: %.3f\n", name, value);
    }

    void add_timing(const char* name, float ms) {
        Serial.printf("  [TIMING] %s: %.3f ms\n", name, ms);
    }

    void add_pass(const char* name) {
        Serial.printf("  [PASS] %s\n", name);
        pass_count++;
    }

    void add_fail(const char* name, const char* reason) {
        Serial.printf("  [FAIL] %s: %s\n", name, reason);
        fail_count++;
    }

    void print_summary() {
        Serial.println("\n=== Test Summary ===");
        Serial.printf("Total: %d\n", pass_count + fail_count);
        Serial.printf("Passed: %d\n", pass_count);
        Serial.printf("Failed: %d\n", fail_count);
        Serial.printf("Success Rate: %.1f%%\n",
                     100.0f * pass_count / (pass_count + fail_count));
    }

    void reset() {
        pass_count = 0;
        fail_count = 0;
    }

private:
    TestResults() : pass_count(0), fail_count(0) {}
    int pass_count;
    int fail_count;
};

// ============================================================================
// TEMPERATURE MONITORING (for stress tests)
// ============================================================================

/**
 * Read ESP32 internal temperature sensor (if available)
 * Note: ESP32-S3 doesn't have built-in temp sensor, this is a placeholder
 */
inline float read_cpu_temperature() {
    // ESP32-S3 doesn't have temperature sensor
    // Return placeholder value
    return 25.0f;
}

/**
 * Check if temperature is within safe range
 */
inline bool is_temperature_safe(float temp_celsius) {
    return temp_celsius < 70.0f;
}

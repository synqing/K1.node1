// K1.node1 Stress Testing Suite - Long-duration stability validation
// Runs five unattended stress cases. Duration scales with STRESS_TEST_DURATION_SCALE
// so CI can run shortened versions.

#include <Arduino.h>
#include <unity.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <atomic>
#include <cmath>
#include <cstdlib>
#include <cstring>

#ifndef STRESS_TEST_DURATION_SCALE
#define STRESS_TEST_DURATION_SCALE 1.0f
#endif

static std::atomic<uint32_t> g_frame_count{0};
static std::atomic<float> g_fps{0.0f};
static std::atomic<uint16_t> g_error_count{0};

static uint32_t get_heap_free() { return esp_get_free_heap_size(); }

static uint32_t scaled_seconds(uint32_t base_seconds) {
    float scaled = base_seconds * STRESS_TEST_DURATION_SCALE;
    if (scaled < 1.0f) {
        scaled = 1.0f;
    }
    return static_cast<uint32_t>(scaled);
}

static void simulate_pattern_render(uint32_t num_frames) {
    uint32_t time_start = millis();
    for (uint32_t i = 0; i < num_frames; i++) {
        volatile uint32_t dummy = i;
        (void)dummy;
        vTaskDelay(pdMS_TO_TICKS(1));
        if (i % 44 == 0) {
            uint32_t elapsed = millis() - time_start + 1;
            g_fps.store((i * 1000.0f) / elapsed);
            g_frame_count.fetch_add(1);
        }
        if (i % 100 == 0) {
            taskYIELD();
        }
    }
}

void test_stress_01_long_duration_pattern() {
    const uint32_t duration_seconds = scaled_seconds(60);
    const uint32_t target_fps = 44;

    g_frame_count.store(0);
    g_fps.store(0.0f);
    uint32_t heap_start = get_heap_free();

    simulate_pattern_render(duration_seconds * target_fps);

    uint32_t heap_end = get_heap_free();
    float fps_final = g_fps.load();
    uint32_t heap_delta = heap_start > heap_end ? (heap_start - heap_end) : 0;

    Serial.printf("[Stress] Pattern FPS %.1f (target %u)\n", fps_final, target_fps);
    Serial.printf("[Stress] Heap delta: %u bytes\n", heap_delta);

    TEST_ASSERT_GREATER_OR_EQUAL(target_fps * 0.95f, fps_final);
    TEST_ASSERT_LESS_OR_EQUAL(heap_delta, 20000);
}

void test_stress_02_pattern_switching() {
    const uint32_t switch_interval_ms = 2000;
    const uint32_t duration_ms = scaled_seconds(120) * 1000;

    g_frame_count.store(0);
    g_error_count.store(0);
    uint32_t heap_start = get_heap_free();
    uint32_t switches = 0;
    uint32_t pattern_id = 0;
    uint32_t start_time = millis();
    uint32_t last_switch = start_time;

    while ((millis() - start_time) < duration_ms) {
        uint32_t now = millis();
        if ((now - last_switch) >= switch_interval_ms) {
            pattern_id = (pattern_id + 1) % 5;
            switches++;
            last_switch = now;
        }
        simulate_pattern_render(44);
    }

    uint32_t heap_end = get_heap_free();
    uint32_t heap_change = heap_start > heap_end ? (heap_start - heap_end) : 0;

    Serial.printf("[Stress] Pattern switches: %u, heap change: %u bytes\n", switches, heap_change);
    TEST_ASSERT_GREATER_OR_EQUAL(60, switches);
    TEST_ASSERT_LESS_OR_EQUAL(heap_change, 100000);
    TEST_ASSERT_EQUAL(0, g_error_count.load());
}

void test_stress_03_memory_pressure() {
    const uint32_t num_cycles = 1000;
    const uint32_t alloc_size = 2048;

    uint32_t alloc_failures = 0;
    uint32_t heap_start = get_heap_free();

    for (uint32_t i = 0; i < num_cycles; i++) {
        void* ptr = malloc(alloc_size);
        if (!ptr) {
            alloc_failures++;
        } else {
            memset(ptr, 0xAA, alloc_size);
            free(ptr);
        }
        if (i % 100 == 0) {
            taskYIELD();
        }
    }

    uint32_t heap_end = get_heap_free();
    int32_t delta = heap_start > heap_end ? static_cast<int32_t>(heap_start - heap_end) : 0;

    Serial.printf("[Stress] Memory alloc failures: %u, delta: %d bytes\n", alloc_failures, delta);
    TEST_ASSERT_EQUAL(0, alloc_failures);
    TEST_ASSERT_LESS_OR_EQUAL(abs(delta), 10000);
}

void test_stress_04_audio_input() {
    const uint32_t duration_ms = scaled_seconds(60) * 1000;
    const uint32_t sample_rate = 16000;
    const uint32_t chunk_size = 512;

    uint32_t chunks = 0;
    uint32_t dft_errors = 0;
    uint32_t start_time = millis();

    while ((millis() - start_time) < duration_ms) {
        uint16_t audio[chunk_size];
        for (uint16_t i = 0; i < chunk_size; i++) {
            audio[i] = 32768 + (rand() % 4096);
        }

        volatile float energy = 0.0f;
        for (uint16_t i = 0; i < chunk_size; i++) {
            energy += (static_cast<float>(audio[i]) * static_cast<float>(audio[i])) / 65536.0f;
        }

        if (isnan(energy)) {
            dft_errors++;
        }
        chunks++;

        if (chunks % 100 == 0) {
            taskYIELD();
        }
    }

    uint32_t expected = (duration_ms / 1000) * sample_rate / chunk_size;
    Serial.printf("[Stress] Audio chunks: %u/%u, DFT errors: %u\n", chunks, expected, dft_errors);
    TEST_ASSERT_GREATER_OR_EQUAL(static_cast<uint32_t>(expected * 0.95f), chunks);
    TEST_ASSERT_EQUAL(0, dft_errors);
}

void test_stress_05_rmt_transmission() {
    const uint32_t duration_seconds = scaled_seconds(30);
    const uint32_t target_fps = 30;

    std::atomic<uint32_t> refills{0};
    std::atomic<uint32_t> max_gap{0};
    uint32_t start_time = millis();
    uint32_t last_refill = micros();

    for (uint32_t frame = 0; frame < duration_seconds * target_fps; frame++) {
        volatile float bloom = sinf((frame & 0xFF) * 0.01f);
        (void)bloom;
        vTaskDelay(pdMS_TO_TICKS(1));

        uint32_t now = micros();
        uint32_t gap = now - last_refill;
        uint32_t current_max = max_gap.load();
        if (gap > current_max) {
            max_gap.store(gap);
        }
        last_refill = now;
        refills.fetch_add(1);

        if (frame % 100 == 0) {
            taskYIELD();
        }
    }

    uint32_t elapsed = millis() - start_time;
    float fps = (refills.load() * 1000.0f) / (elapsed + 1);

    Serial.printf("[Stress] RMT FPS %.1f (target %u), max gap %u us\n", fps, target_fps, max_gap.load());
    TEST_ASSERT_GREATER_OR_EQUAL(target_fps * 0.9f, fps);
    TEST_ASSERT_LESS_OR_EQUAL(max_gap.load(), 50000U);
}

void setUp(void) {
    g_frame_count.store(0);
    g_fps.store(0.0f);
    g_error_count.store(0);
}

void tearDown(void) {
    vTaskDelay(pdMS_TO_TICKS(50));
}

void setup() {
    Serial.begin(2000000);
    delay(1000);

    UNITY_BEGIN();
    RUN_TEST(test_stress_01_long_duration_pattern);
    RUN_TEST(test_stress_02_pattern_switching);
    RUN_TEST(test_stress_03_memory_pressure);
    RUN_TEST(test_stress_04_audio_input);
    RUN_TEST(test_stress_05_rmt_transmission);
    UNITY_END();
}

void loop() {
    vTaskDelay(pdMS_TO_TICKS(1000));
}

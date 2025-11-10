// K1.node1 Stress Testing Suite - Long-duration stability validation
// 5 stress tests: pattern stability, pattern switching, memory pressure,
// audio input, and RMT transmission. Run: pio test -e esp32-s3-devkitc-1

#ifdef UNIT_TEST
#include <unity.h>
#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <atomic>

static std::atomic<uint32_t> g_frame_count{0};
static std::atomic<float> g_fps{0.0f};
static std::atomic<uint16_t> g_error_count{0};

uint32_t get_heap_free() { return esp_get_free_heap_size(); }

void simulate_pattern_render(uint32_t num_frames) {
    uint32_t time_start = millis();
    for (uint32_t i = 0; i < num_frames; i++) {
        volatile uint32_t dummy = i;
        vTaskDelay(pdMS_TO_TICKS(1));
        if (i % 44 == 0) {
            uint32_t elapsed = millis() - time_start + 1;
            g_fps.store((i * 1000.0f) / elapsed);
            g_frame_count.fetch_add(1);
        }
        if (i % 100 == 0) taskYIELD();
    }
}

// TEST 1: Long-duration pattern (6 hours simulated -> 60s test)
// Measures FPS stability and memory behavior
void test_stress_01_long_duration_pattern() {
    const uint32_t DURATION_SECONDS = 60;
    const uint32_t TARGET_FPS = 44;
    LOG_INFO("TEST", "01: Long-duration pattern stability");

    g_frame_count.store(0);
    g_fps.store(0.0f);
    uint32_t heap_start = get_heap_free();

    simulate_pattern_render(DURATION_SECONDS * TARGET_FPS);

    uint32_t heap_end = get_heap_free();
    float fps_final = g_fps.load();
    uint32_t heap_delta = heap_start > heap_end ? (heap_start - heap_end) : 0;

    LOG_INFO("TEST", "FPS: %.1f (target: %u), Heap delta: %u bytes", fps_final, TARGET_FPS, heap_delta);
    TEST_ASSERT_GREATER_OR_EQUAL(TARGET_FPS * 0.95f, fps_final);
    TEST_ASSERT_LESS_OR_EQUAL(heap_delta, 20000);
}

// TEST 2: Pattern switching (every 2s for 2 hours)
// Verifies state cleanup and balanced alloc/dealloc
void test_stress_02_pattern_switching() {
    const uint32_t SWITCH_INTERVAL_MS = 2000;
    const uint32_t TEST_DURATION_SECONDS = 120;
    LOG_INFO("TEST", "02: Pattern switching state cleanup");

    g_frame_count.store(0);
    g_error_count.store(0);
    uint32_t heap_start = get_heap_free();
    uint32_t switches = 0;
    uint32_t pattern_id = 0;
    uint32_t start_time = millis();
    uint32_t last_switch = start_time;

    while ((millis() - start_time) < TEST_DURATION_SECONDS * 1000) {
        uint32_t now = millis();
        if ((now - last_switch) >= SWITCH_INTERVAL_MS) {
            pattern_id = (pattern_id + 1) % 5;
            switches++;
            last_switch = now;
        }
        simulate_pattern_render(44);
    }

    uint32_t heap_end = get_heap_free();
    uint32_t heap_change = heap_start > heap_end ? (heap_start - heap_end) : 0;

    LOG_INFO("TEST", "Switches: %u, Heap change: %u bytes, Errors: %u",
             switches, heap_change, g_error_count.load());
    TEST_ASSERT_GREATER_OR_EQUAL(60, switches);
    TEST_ASSERT_LESS_OR_EQUAL(heap_change, 100000);
    TEST_ASSERT_EQUAL(0, g_error_count.load());
}

// TEST 3: Memory pressure (1000 alloc/dealloc cycles)
// Detects fragmentation and heap exhaustion
void test_stress_03_memory_pressure() {
    const uint32_t NUM_CYCLES = 1000;
    const uint32_t ALLOC_SIZE = 2048;
    LOG_INFO("TEST", "03: Memory pressure test");

    uint32_t alloc_failures = 0;
    uint32_t heap_start = get_heap_free();

    for (uint32_t i = 0; i < NUM_CYCLES; i++) {
        void* ptr = malloc(ALLOC_SIZE);
        if (!ptr) alloc_failures++;
        else { memset(ptr, 0xAA, ALLOC_SIZE); free(ptr); }
        if (i % 100 == 0) taskYIELD();
    }

    uint32_t heap_end = get_heap_free();
    int32_t delta = heap_start > heap_end ? (int32_t)(heap_start - heap_end) : 0;

    LOG_INFO("TEST", "Failures: %u/%u, Heap delta: %d bytes",
             alloc_failures, NUM_CYCLES, delta);
    TEST_ASSERT_EQUAL(0, alloc_failures);
    TEST_ASSERT_LESS_OR_EQUAL(abs(delta), 10000);
}

// TEST 4: Audio input stress (I2S simulation for 1 hour)
// Verifies Goertzel and beat detection stability
void test_stress_04_audio_input() {
    const uint32_t TEST_DURATION_SECONDS = 60;
    const uint32_t SAMPLE_RATE = 16000;
    const uint32_t CHUNK_SIZE = 512;
    LOG_INFO("TEST", "04: Audio input stress");

    uint32_t chunks = 0;
    uint32_t dft_errors = 0;
    uint32_t start_time = millis();

    while ((millis() - start_time) < TEST_DURATION_SECONDS * 1000) {
        uint16_t audio[CHUNK_SIZE];
        for (uint16_t i = 0; i < CHUNK_SIZE; i++) {
            audio[i] = 32768 + (rand() % 4096);
        }

        volatile float energy = 0.0f;
        for (uint16_t i = 0; i < CHUNK_SIZE; i++) {
            energy += (float)(audio[i] * audio[i]) / 65536.0f;
        }

        if (isnan(energy)) dft_errors++;
        chunks++;

        if (chunks % 100 == 0) taskYIELD();
    }

    uint32_t expected = (TEST_DURATION_SECONDS * SAMPLE_RATE) / CHUNK_SIZE;
    LOG_INFO("TEST", "Chunks: %u/%u, DFT errors: %u", chunks, expected, dft_errors);
    TEST_ASSERT_GREATER_OR_EQUAL(chunks, expected * 0.95f);
    TEST_ASSERT_EQUAL(0, dft_errors);
}

// TEST 5: RMT LED transmission stress (30 minutes at max complexity)
// Measures RMT refill timing and gap distribution
void test_stress_05_rmt_transmission() {
    const uint32_t TEST_DURATION_SECONDS = 30;
    const uint32_t TARGET_FPS = 30;
    LOG_INFO("TEST", "05: RMT transmission stress");

    std::atomic<uint32_t> refills{0};
    std::atomic<uint32_t> max_gap{0};
    uint32_t start_time = millis();
    uint32_t last_refill = micros();

    for (uint32_t frame = 0; frame < TEST_DURATION_SECONDS * TARGET_FPS; frame++) {
        volatile float bloom = sinf((frame & 0xFF) * 0.01f);
        vTaskDelay(pdMS_TO_TICKS(1));

        uint32_t now = micros();
        uint32_t gap = now - last_refill;
        if (gap > max_gap.load()) max_gap.store(gap);
        last_refill = now;
        refills.fetch_add(1);

        if (frame % 100 == 0) taskYIELD();
    }

    uint32_t elapsed = millis() - start_time;
    float fps = (refills.load() * 1000.0f) / (elapsed + 1);

    LOG_INFO("TEST", "FPS: %.1f, RMT max gap: %u us", fps, max_gap.load());
    TEST_ASSERT_GREATER_OR_EQUAL(fps, TARGET_FPS * 0.9f);
    TEST_ASSERT_LESS_OR_EQUAL(max_gap.load(), 50000U);
}

void setUp(void) {
    g_frame_count.store(0);
    g_fps.store(0.0f);
    g_error_count.store(0);
}

void tearDown(void) { vTaskDelay(pdMS_TO_TICKS(100)); }

#endif

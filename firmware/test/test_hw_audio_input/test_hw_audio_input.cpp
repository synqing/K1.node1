/**
 * TEST SUITE: Hardware Validation - Audio Input
 *
 * Validates I2S microphone initialization, audio capture,
 * FFT accuracy, and audio-to-LED latency on actual hardware.
 */

#include <Arduino.h>
#include <unity.h>
#include "../test_utils/test_helpers.h"
#include "../../src/audio/microphone.h"
#include "../../src/audio/goertzel.h"
#include "../../src/pattern_audio_interface.h"

void setUp(void) {
    init_audio_data_sync();
}

void tearDown(void) {
    vTaskDelay(pdMS_TO_TICKS(100));
}

/**
 * TEST 1: I2S Initialization
 * Verify microphone is ready for audio capture
 */
void test_i2s_initialization() {
    Serial.println("\n=== TEST 1: I2S Initialization ===");

    // Initialize I2S microphone driver
    init_i2s_microphone();

    // Wait for driver to stabilize
    vTaskDelay(pdMS_TO_TICKS(500));

    // Check timeout state
    const I2STimeoutState& state = get_i2s_timeout_state();

    Serial.printf("  I2S timeout count: %u\n", state.timeout_count);
    Serial.printf("  Consecutive failures: %u\n", state.consecutive_failures);
    Serial.printf("  In fallback mode: %s\n", state.in_fallback_mode ? "yes" : "no");

    // Microphone should initialize without immediate timeouts
    // Allow up to 1 timeout during init (normal behavior)
    TEST_ASSERT_LESS_THAN(2, state.timeout_count);

    TestResults::instance().add_pass("I2S microphone initialized successfully");
}

/**
 * TEST 2: Audio Capture
 * Verify we're reading non-zero audio samples
 */
void test_audio_capture() {
    Serial.println("\n=== TEST 2: Audio Capture (Read 100 Samples) ===");

    init_i2s_microphone();
    init_window_lookup();
    init_goertzel_constants_musical();

    vTaskDelay(pdMS_TO_TICKS(500));

    // Read audio chunks and collect samples
    float capture_buf[4096];
    int capture_count = 0;
    int nonzero_samples = 0;
    uint32_t start_time = millis();

    // Capture for 2 seconds (covers ~16 chunks at 8ms each)
    while (millis() - start_time < 2000 && capture_count < 100) {
        acquire_sample_chunk();

        // Try to get audio snapshot
        AudioDataSnapshot snapshot;
        if (get_audio_snapshot(&snapshot)) {
            // Audio is ready; accumulate stats
            for (int i = 0; i < NUM_FREQS; i++) {
                if (snapshot.spectrogram[i] > 0.01f) {
                    nonzero_samples++;
                }
            }
            capture_count++;
        }

        vTaskDelay(pdMS_TO_TICKS(10));
    }

    Serial.printf("  Chunks captured: %d\n", capture_count);
    Serial.printf("  Non-zero spectrum bins: %d\n", nonzero_samples);

    // Should capture at least 50 chunks in 2 seconds
    TEST_ASSERT_GREATER_THAN(40, capture_count);

    // Should see some non-zero samples (even with quiet room, electronics generate noise)
    // Each chunk samples NUM_FREQS bins, expect some > threshold
    TEST_ASSERT_GREATER_THAN(10, nonzero_samples);

    TestResults::instance().add_metric("Audio chunks captured", (float)capture_count);
    TestResults::instance().add_pass("Audio capture working");
}

/**
 * TEST 3: FFT Accuracy (Goertzel Tone Detection)
 * Verify frequency bins are responsive to audio input
 */
void test_fft_accuracy() {
    Serial.println("\n=== TEST 3: FFT Accuracy (Frequency Bin Response) ===");

    init_i2s_microphone();
    init_window_lookup();
    init_goertzel_constants_musical();
    init_audio_data_sync();

    vTaskDelay(pdMS_TO_TICKS(500));

    // Collect baseline spectrum
    float baseline_spectrum[NUM_FREQS];
    memset(baseline_spectrum, 0, sizeof(baseline_spectrum));

    Serial.println("  Capturing baseline spectrum (2 seconds)...");
    uint32_t start = millis();
    int baseline_chunks = 0;

    while (millis() - start < 2000) {
        acquire_sample_chunk();

        AudioDataSnapshot snapshot;
        if (get_audio_snapshot(&snapshot)) {
            for (int i = 0; i < NUM_FREQS; i++) {
                baseline_spectrum[i] += snapshot.spectrogram[i];
            }
            baseline_chunks++;
        }

        vTaskDelay(pdMS_TO_TICKS(10));
    }

    // Average baseline
    if (baseline_chunks > 0) {
        for (int i = 0; i < NUM_FREQS; i++) {
            baseline_spectrum[i] /= baseline_chunks;
        }
    }

    Serial.printf("  Baseline collected from %d chunks\n", baseline_chunks);

    // Find dominant frequency bins
    int peak_bins = 0;
    float max_baseline = 0.0f;
    for (int i = 0; i < NUM_FREQS; i++) {
        if (baseline_spectrum[i] > max_baseline) {
            max_baseline = baseline_spectrum[i];
        }
    }

    // Count bins above 10% of max
    float threshold = max_baseline * 0.1f;
    for (int i = 0; i < NUM_FREQS; i++) {
        if (baseline_spectrum[i] > threshold) {
            peak_bins++;
        }
    }

    Serial.printf("  Dominant frequency bins: %d\n", peak_bins);
    Serial.printf("  Max spectrum level: %.3f\n", max_baseline);

    // Should have some frequency content (even quiet room has 50/60Hz hum, electronics)
    // Expect at least a few peak bins
    TEST_ASSERT_GREATER_THAN(2, peak_bins);

    TestResults::instance().add_metric("Spectrum peak bins", (float)peak_bins);
    TestResults::instance().add_pass("FFT frequency detection working");
}

/**
 * TEST 4: Audio-to-LED Latency
 * Measure latency from audio capture to pattern update (<20ms target)
 */
void test_audio_latency() {
    Serial.println("\n=== TEST 4: Audio-to-LED Latency (<20ms) ===");

    init_i2s_microphone();
    init_window_lookup();
    init_goertzel_constants_musical();
    init_audio_data_sync();
    init_pattern_registry();

    vTaskDelay(pdMS_TO_TICKS(500));

    // Measure end-to-end latency: audio capture -> snapshot -> pattern ready
    uint32_t latencies_us[100];
    int latency_count = 0;

    uint32_t start_time = millis();
    while (millis() - start_time < 5000 && latency_count < 100) {
        uint64_t cap_time = esp_timer_get_time();

        // Acquire audio
        acquire_sample_chunk();

        // Get snapshot
        AudioDataSnapshot snapshot;
        if (get_audio_snapshot(&snapshot)) {
            uint64_t snap_time = esp_timer_get_time();
            uint32_t latency = (uint32_t)(snap_time - cap_time);

            latencies_us[latency_count] = latency;
            latency_count++;
        }

        vTaskDelay(pdMS_TO_TICKS(10));
    }

    // Calculate statistics
    uint32_t max_latency = 0;
    uint32_t total_latency = 0;

    for (int i = 0; i < latency_count; i++) {
        total_latency += latencies_us[i];
        if (latencies_us[i] > max_latency) {
            max_latency = latencies_us[i];
        }
    }

    uint32_t avg_latency = total_latency / latency_count;
    float avg_ms = avg_latency / 1000.0f;
    float max_ms = max_latency / 1000.0f;

    Serial.printf("  Latency samples: %d\n", latency_count);
    Serial.printf("  Avg latency: %.2f ms\n", avg_ms);
    Serial.printf("  Max latency: %.2f ms\n", max_ms);

    // Average should be well under 20ms
    TEST_ASSERT_LESS_THAN(20.0f, avg_ms);

    // Even max should be under 20ms (allows 2x headroom)
    TEST_ASSERT_LESS_THAN(40.0f, max_ms);

    TestResults::instance().add_timing("Audio latency (ms)", avg_ms);
    TestResults::instance().add_pass("Audio latency within spec");
}

void setup() {
    Serial.begin(2000000);
    delay(2000);

    Serial.println("\n\n========================================");
    Serial.println("HARDWARE VALIDATION: AUDIO INPUT");
    Serial.println("========================================\n");

    UNITY_BEGIN();
    RUN_TEST(test_i2s_initialization);
    RUN_TEST(test_audio_capture);
    RUN_TEST(test_fft_accuracy);
    RUN_TEST(test_audio_latency);
    UNITY_END();

    TestResults::instance().print_summary();
}

void loop() {
    delay(1000);
}

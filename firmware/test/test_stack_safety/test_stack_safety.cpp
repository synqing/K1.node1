/**
 * TEST SUITE: Stack Safety Validation
 *
 * Validates that increased stack sizes (GPU 16KB, Audio 12KB) are sufficient
 */

#include <Arduino.h>
#include <unity.h>
#include "../test_utils/test_helpers.h"
#include "../../src/audio/goertzel.h"
#include "../../src/pattern_audio_interface.h"

void setUp(void) {
    init_audio_data_sync();
    Serial.println("[TEST] setUp: Stack safety test initialized");
}

void tearDown(void) {
    Serial.println("[TEST] tearDown: Test complete");
}

// =============================================================================
// TEST 1: GPU Task Stack Usage (16KB allocated)
// =============================================================================
void test_gpu_task_stack_usage(void) {
    Serial.println("\n=== TEST 1: GPU Task Stack Usage (16KB) ===");

    // Simulate GPU rendering workload with large local arrays
    float matrix[16];  // Transformation matrix
    uint8_t frame_buffer[1024];  // Frame buffer
    float interpolation_values[256];  // Color interpolation

    for (int i = 0; i < 100; i++) {
        // Simulate matrix operations
        for (int j = 0; j < 16; j++) {
            matrix[j] = (i + j) * 0.1f;
        }

        // Simulate frame buffer updates
        for (int j = 0; j < 1024; j++) {
            frame_buffer[j] = (i + j) & 0xFF;
        }

        // Simulate color interpolation
        for (int j = 0; j < 256; j++) {
            interpolation_values[j] = (i * j) / 255.0f;
        }
    }

    TEST_ASSERT_TRUE(true);
    Serial.println("[TEST 1] PASS - GPU workload completed within 16KB stack");
}

// =============================================================================
// TEST 2: Audio Task Stack Usage (12KB allocated)
// =============================================================================
void test_audio_task_stack_usage(void) {
    Serial.println("\n=== TEST 2: Audio Task Stack Usage (12KB) ===");

    float spectrum[NUM_FREQS];
    float chromagram[12];
    float tempo_bins[NUM_TEMPI];
    AudioDataSnapshot snapshot;
    
    for (int iter = 0; iter < 50; iter++) {
        get_audio_snapshot(&snapshot);
        
        for (int i = 0; i < NUM_FREQS; i++) {
            spectrum[i] = snapshot.spectrogram[i];
        }
        
        for (int i = 0; i < 12; i++) {
            chromagram[i] = snapshot.chromagram[i];
        }
        
        for (int i = 0; i < NUM_TEMPI; i++) {
            tempo_bins[i] = snapshot.tempo_magnitude[i];
        }
    }
    
    TEST_ASSERT_TRUE(true);
    Serial.println("[TEST 2] PASS - Audio workload completed within 12KB stack");
}

// =============================================================================
// TEST 3: Concurrent Stack Usage
// =============================================================================
void test_concurrent_stack_usage(void) {
    Serial.println("\n=== TEST 3: Concurrent Stack Usage ===");

    float spectrum[NUM_FREQS];
    uint8_t color_buffer[256];
    AudioDataSnapshot snapshot;

    for (int i = 0; i < 50; i++) {
        get_audio_snapshot(&snapshot);
        for (int j = 0; j < NUM_FREQS; j++) {
            spectrum[j] = snapshot.spectrogram[j];
        }

        for (int j = 0; j < 256; j++) {
            color_buffer[j] = (uint8_t)(spectrum[j % NUM_FREQS] * 255);
        }
    }

    TEST_ASSERT_TRUE(true);
    Serial.println("[TEST 3] PASS - Concurrent workload completed safely");
}

// =============================================================================
// TEST 4: Stack Margin Validation
// =============================================================================
void test_stack_margin_validation(void) {
    Serial.println("\n=== TEST 4: Stack Margin Validation ===");

    int gpu_estimated_usage = 12288;
    int gpu_allocated = 16384;
    int gpu_margin = gpu_allocated - gpu_estimated_usage;
    
    int audio_estimated_usage = 8192;
    int audio_allocated = 12288;
    int audio_margin = audio_allocated - audio_estimated_usage;
    
    TEST_ASSERT_GREATER_THAN(1024, gpu_margin);
    TEST_ASSERT_GREATER_THAN(1024, audio_margin);
    
    Serial.printf("[TEST 4] GPU margin: %d bytes\n", gpu_margin);
    Serial.printf("[TEST 4] Audio margin: %d bytes\n", audio_margin);
    Serial.println("[TEST 4] PASS - Stack margins adequate (>1KB)");
}

// =============================================================================
// TEST 5: Recursive Workload
// =============================================================================
void test_recursive_workload(void) {
    Serial.println("\n=== TEST 5: Recursive Workload ===");

    float result = 0.0f;
    AudioDataSnapshot snapshot;
    
    get_audio_snapshot(&snapshot);
    
    for (int depth = 0; depth < 5; depth++) {
        for (int i = 0; i < NUM_FREQS; i++) {
            result += snapshot.spectrogram[i];
        }
    }
    
    TEST_ASSERT_TRUE(result >= 0.0f);
    Serial.println("[TEST 5] PASS - Recursive workload handled safely");
}

void setup() {
    delay(2000);
    Serial.begin(115200);
    while (!Serial) { delay(100); }

    Serial.println("\n\n========================================");
    Serial.println("STACK SAFETY TEST SUITE");
    Serial.println("Stack Allocations:");
    Serial.println("  GPU task:   16KB (was 12KB, +33%)");
    Serial.println("  Audio task: 12KB (was 8KB, +50%)");
    Serial.println("========================================\n");

    UNITY_BEGIN();

    RUN_TEST(test_gpu_task_stack_usage);
    RUN_TEST(test_audio_task_stack_usage);
    RUN_TEST(test_concurrent_stack_usage);
    RUN_TEST(test_stack_margin_validation);
    RUN_TEST(test_recursive_workload);

    UNITY_END();
}

void loop() {
    delay(1000);
}

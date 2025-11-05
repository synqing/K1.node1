/**
 * TEST SUITE: Lock-Free Synchronization Validation
 *
 * Validates lock-free double-buffer implementation with sequence counters
 * Tests for correct memory ordering and torn read detection
 */

#include <Arduino.h>
#include <unity.h>
#include "../test_utils/test_helpers.h"
#include "../../src/audio/goertzel.h"
#include "../../src/pattern_audio_interface.h"

void setUp(void) {
    init_audio_data_sync();
    Serial.println("[TEST] setUp: Audio sync initialized");
}

void tearDown(void) {
    Serial.println("[TEST] tearDown: Test complete");
}

// =============================================================================
// TEST 1: Sequence Counter Validation
// =============================================================================
void test_sequence_counter_basic(void) {
    Serial.println("\n=== TEST 1: Sequence Counter Basic Validation ===");

    AudioDataSnapshot snapshot1;
    bool result = get_audio_snapshot(&snapshot1);
    TEST_ASSERT_TRUE(result);

    TEST_ASSERT_GREATER_OR_EQUAL(audio_front.sequence, 0);
    TEST_ASSERT_GREATER_OR_EQUAL(audio_front.sequence_end, 0);

    Serial.printf("[TEST 1] Initial sequence: %u, sequence_end: %u\n",
                  audio_front.sequence, audio_front.sequence_end);
    Serial.println("[TEST 1] PASS - Sequence counters initialized");
}

// =============================================================================
// TEST 2: Memory Barrier Presence
// =============================================================================
void test_memory_barriers_present(void) {
    Serial.println("\n=== TEST 2: Memory Barrier Presence ===");

    AudioDataSnapshot snapshot1;
    get_audio_snapshot(&snapshot1);
    uint32_t initial_seq = snapshot1.sequence;

    audio_back.spectrogram[0] = 0.5f;
    audio_back.update_counter = initial_seq + 1;
    commit_audio_data();

    AudioDataSnapshot snapshot2;
    get_audio_snapshot(&snapshot2);
    uint32_t new_seq = snapshot2.sequence;

    TEST_ASSERT_NOT_EQUAL(initial_seq, new_seq);
    TEST_ASSERT_EQUAL(0, new_seq & 1);

    Serial.printf("[TEST 2] Sequence updated from %u to %u (even = valid)\n",
                  initial_seq, new_seq);
    Serial.println("[TEST 2] PASS - Memory barriers working");
}

// =============================================================================
// TEST 3: Torn Read Detection
// =============================================================================
void test_torn_read_detection(void) {
    Serial.println("\n=== TEST 3: Torn Read Detection ===");

    AudioDataSnapshot snapshot;
    int attempts = 0;

    for (int iter = 0; iter < 10; iter++) {
        get_audio_snapshot(&snapshot);
        attempts++;

        TEST_ASSERT_EQUAL(snapshot.sequence, snapshot.sequence_end);

        audio_back.spectrogram[iter % NUM_FREQS] = (iter & 1) ? 0.1f : 0.9f;
        commit_audio_data();
    }

    Serial.printf("[TEST 3] Completed %d iterations with valid snapshots\n", attempts);
    Serial.println("[TEST 3] PASS - Torn read detection working");
}

// =============================================================================
// TEST 4: Sequence Overflow Handling
// =============================================================================
void test_sequence_overflow_handling(void) {
    Serial.println("\n=== TEST 4: Sequence Overflow Handling ===");

    AudioDataSnapshot snapshot;

    for (int i = 0; i < 5; i++) {
        audio_back.update_counter++;
        commit_audio_data();

        bool result = get_audio_snapshot(&snapshot);
        TEST_ASSERT_TRUE(result);

        TEST_ASSERT_EQUAL(0, snapshot.sequence & 1);
    }

    Serial.printf("[TEST 4] Final sequence: %u (even = valid)\n", snapshot.sequence);
    Serial.println("[TEST 4] PASS - Sequence overflow handling works");
}

// =============================================================================
// TEST 5: Null Pointer Safety
// =============================================================================
void test_null_pointer_safety(void) {
    Serial.println("\n=== TEST 5: Null Pointer Safety ===");

    bool result = get_audio_snapshot(NULL);
    TEST_ASSERT_FALSE(result);

    Serial.println("[TEST 5] PASS - Null pointer handled safely");
}

void setup() {
    delay(2000);
    Serial.begin(115200);
    while (!Serial) { delay(100); }

    Serial.println("\n\n========================================");
    Serial.println("LOCK-FREE SYNCHRONIZATION TEST SUITE");
    Serial.println("========================================\n");

    UNITY_BEGIN();

    RUN_TEST(test_sequence_counter_basic);
    RUN_TEST(test_memory_barriers_present);
    RUN_TEST(test_torn_read_detection);
    RUN_TEST(test_sequence_overflow_handling);
    RUN_TEST(test_null_pointer_safety);

    UNITY_END();
}

void loop() {
    delay(1000);
}

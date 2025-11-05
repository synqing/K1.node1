/**
 * TEST SUITE: Lock-Free Audio Synchronization Validation
 *
 * NOTE: These tests run on a SINGLE CORE (no concurrent access possible in test harness).
 * They validate the basic synchronization mechanisms work correctly, not true race conditions.
 * True race condition testing requires dual-core execution which cannot be reliably tested
 * in the unit test framework - that's what hardware validation proves.
 *
 * What these tests DO validate:
 * - Sequence counter increments correctly
 * - Memory layout is correct
 * - Lock-free read/write functions execute without crashing
 * - Basic data integrity in single-threaded scenario
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
// TEST 1: Sequence Counter Increments
// =============================================================================
void test_sequence_counter_increments(void) {
    Serial.println("\n=== TEST 1: Sequence Counter Increments ===");

    uint32_t seq_before = audio_front.sequence;
    Serial.printf("[TEST 1] Initial sequence: %u\n", seq_before);

    // Commit data (should increment sequence)
    audio_back.update_counter++;
    commit_audio_data();

    uint32_t seq_after = audio_front.sequence;
    Serial.printf("[TEST 1] After commit: %u\n", seq_after);

    // Sequence should have changed
    TEST_ASSERT_NOT_EQUAL(seq_before, seq_after);

    // After commit, sequence must be EVEN (valid data)
    // Odd = write in progress, even = valid
    TEST_ASSERT_EQUAL(0, seq_after & 1);

    Serial.println("[TEST 1] PASS - Sequence counter increments correctly");
}

// =============================================================================
// TEST 2: Snapshot Contains Current Data
// =============================================================================
void test_snapshot_contains_current_data(void) {
    Serial.println("\n=== TEST 2: Snapshot Contains Current Data ===");

    // Write specific value to audio_back
    float test_value = 0.42f;
    audio_back.spectrogram[0] = test_value;
    audio_back.update_counter = 12345;
    commit_audio_data();

    // Read it back
    AudioDataSnapshot snap;
    get_audio_snapshot(&snap);

    // Should contain the value we just wrote
    TEST_ASSERT_EQUAL_FLOAT(test_value, snap.spectrogram[0]);
    TEST_ASSERT_EQUAL(12345, snap.update_counter);

    Serial.printf("[TEST 2] Read back: spectrogram[0]=%f, counter=%u\n",
                  snap.spectrogram[0], snap.update_counter);
    Serial.println("[TEST 2] PASS - Snapshot reflects committed data");
}

// =============================================================================
// TEST 3: Sequence Match (Torn Read Detection)
// =============================================================================
void test_sequence_match(void) {
    Serial.println("\n=== TEST 3: Sequence Start/End Match ===");

    // Do multiple commits
    for (int i = 0; i < 10; i++) {
        audio_back.update_counter = i;
        commit_audio_data();

        AudioDataSnapshot snap;
        get_audio_snapshot(&snap);

        // CRITICAL: Start sequence must match end sequence
        // If they don't match, a torn read occurred
        TEST_ASSERT_EQUAL(snap.sequence, snap.sequence_end);

        bool is_even = (snap.sequence & 1) == 0;
        Serial.printf("[TEST 3 Iter %d] seq=%u, seq_end=%u, even=%s\n",
                      i, snap.sequence, snap.sequence_end, is_even ? "YES" : "NO");
    }

    Serial.println("[TEST 3] PASS - Sequence fields always match");
}

// =============================================================================
// TEST 4: Sequence Counter is Always Even
// =============================================================================
void test_sequence_always_even(void) {
    Serial.println("\n=== TEST 4: Valid Data Always Has Even Sequence ===");

    // In the seqlock pattern:
    // - Odd sequence = writer in progress, readers should retry
    // - Even sequence = valid data available
    // A snapshot should NEVER have odd sequence (readers retry until even)

    for (int i = 0; i < 20; i++) {
        audio_back.update_counter = i;
        commit_audio_data();

        AudioDataSnapshot snap;
        get_audio_snapshot(&snap);

        // Sequence must be even
        uint32_t is_even = (snap.sequence & 1) == 0;
        TEST_ASSERT_TRUE(is_even);

        if (i % 5 == 0) {
            Serial.printf("[TEST 4] After %d commits, sequence=%u (even)\n",
                          i + 1, snap.sequence);
        }
    }

    Serial.println("[TEST 4] PASS - All valid snapshots have even sequence");
}

// =============================================================================
// TEST 5: Null Pointer Handling
// =============================================================================
void test_null_pointer_handling(void) {
    Serial.println("\n=== TEST 5: Null Pointer Safety ===");

    // get_audio_snapshot should handle NULL gracefully
    bool result = get_audio_snapshot(NULL);
    TEST_ASSERT_FALSE(result);

    Serial.println("[TEST 5] PASS - Null pointer handled safely");
}

void setup() {
    delay(2000);
    Serial.begin(115200);
    while (!Serial) { delay(100); }

    Serial.println("\n\n========================================");
    Serial.println("RACE CONDITION DETECTION TEST SUITE");
    Serial.println("NOTE: Single-core test - validates basic");
    Serial.println("synchronization mechanisms only.");
    Serial.println("True concurrency validated on hardware.");
    Serial.println("========================================\n");

    UNITY_BEGIN();

    RUN_TEST(test_sequence_counter_increments);
    RUN_TEST(test_snapshot_contains_current_data);
    RUN_TEST(test_sequence_match);
    RUN_TEST(test_sequence_always_even);
    RUN_TEST(test_null_pointer_handling);

    UNITY_END();
}

void loop() {
    delay(1000);
}

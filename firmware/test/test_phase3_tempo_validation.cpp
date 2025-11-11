// ============================================================================
// PHASE 3: Tempo Validation Unit Tests
// ============================================================================
//
// Tests for entropy-based validation, median filtering, temporal stability,
// multi-metric confidence, and tempo lock state machine.
//
// Run: pio test -e native -f test_phase3_tempo_validation
//
// Research: docs/05-analysis/K1NAnalysis_PHASE3_TEMPO_HARDENING_RECOMMENDATIONS_v1.0_20251111.md

#include <unity.h>
#include <cmath>
#include <cstring>
#include "../src/audio/validation/tempo_validation.h"

// ============================================================================
// TEST HELPERS
// ============================================================================

void setup_flat_tempo_distribution(float* tempi_smooth, uint16_t num_tempi) {
    // Uniform distribution (high entropy, low confidence)
    for (uint16_t i = 0; i < num_tempi; i++) {
        tempi_smooth[i] = 1.0f / num_tempi;
    }
}

void setup_single_peak_distribution(float* tempi_smooth, uint16_t num_tempi, uint16_t peak_bin) {
    // Single dominant peak (low entropy, high confidence)
    for (uint16_t i = 0; i < num_tempi; i++) {
        tempi_smooth[i] = (i == peak_bin) ? 0.9f : 0.1f / (num_tempi - 1);
    }
}

void setup_octave_ambiguity(float* tempi_smooth, uint16_t num_tempi, uint16_t bin1, uint16_t bin2) {
    // Two strong peaks (octave relationship)
    for (uint16_t i = 0; i < num_tempi; i++) {
        if (i == bin1 || i == bin2) {
            tempi_smooth[i] = 0.4f;
        } else {
            tempi_smooth[i] = 0.2f / (num_tempi - 2);
        }
    }
}

// ============================================================================
// ENTROPY CONFIDENCE TESTS
// ============================================================================

void test_entropy_flat_distribution() {
    const uint16_t num_bins = 64;
    float tempi_smooth[num_bins];
    setup_flat_tempo_distribution(tempi_smooth, num_bins);

    float entropy_conf = calculate_tempo_entropy(tempi_smooth, num_bins, 1.0f);

    // Flat distribution should have low confidence (<0.3)
    TEST_ASSERT_LESS_THAN(0.3f, entropy_conf);
    TEST_MESSAGE("Flat distribution correctly identified as low confidence");
}

void test_entropy_single_peak() {
    const uint16_t num_bins = 64;
    float tempi_smooth[num_bins];
    setup_single_peak_distribution(tempi_smooth, num_bins, 30);

    float entropy_conf = calculate_tempo_entropy(tempi_smooth, num_bins, 1.0f);

    // Single clear peak should have high confidence (>0.8)
    TEST_ASSERT_GREATER_THAN(0.8f, entropy_conf);
    TEST_MESSAGE("Single peak correctly identified as high confidence");
}

void test_entropy_zero_signal() {
    const uint16_t num_bins = 64;
    float tempi_smooth[num_bins];
    memset(tempi_smooth, 0, sizeof(tempi_smooth));

    float entropy_conf = calculate_tempo_entropy(tempi_smooth, num_bins, 0.0f);

    // Zero signal should return 0.0 confidence
    TEST_ASSERT_EQUAL_FLOAT(0.0f, entropy_conf);
    TEST_MESSAGE("Zero signal correctly returns 0.0 confidence");
}

// ============================================================================
// MEDIAN FILTER TESTS
// ============================================================================

void test_median_filter_rejects_spike() {
    MedianFilter3 filter = {{120.0f, 120.0f, 120.0f}, 2};

    // Inject a 2x octave spike
    float result = apply_median_filter(&filter, 240.0f);

    // Median should reject the spike, returning 120.0f
    TEST_ASSERT_EQUAL_FLOAT(120.0f, result);
    TEST_MESSAGE("Median filter correctly rejected 2x octave spike");
}

void test_median_filter_accepts_gradual_change() {
    MedianFilter3 filter = {{120.0f, 125.0f, 130.0f}, 2};

    // Gradual tempo change
    float result = apply_median_filter(&filter, 135.0f);

    // Should return middle value (130.0f)
    TEST_ASSERT_EQUAL_FLOAT(130.0f, result);
    TEST_MESSAGE("Median filter correctly handles gradual tempo change");
}

void test_median_filter_symmetric() {
    // Test: median3(a, b, c) should be same regardless of order
    float a = 100.0f, b = 120.0f, c = 110.0f;

    float result1 = median3(a, b, c);
    float result2 = median3(c, a, b);
    float result3 = median3(b, c, a);

    TEST_ASSERT_EQUAL_FLOAT(110.0f, result1);
    TEST_ASSERT_EQUAL_FLOAT(110.0f, result2);
    TEST_ASSERT_EQUAL_FLOAT(110.0f, result3);
    TEST_MESSAGE("median3 is order-independent");
}

// ============================================================================
// TEMPORAL STABILITY TESTS
// ============================================================================

void test_temporal_stability_insufficient_data() {
    // Reset tracker
    tempo_stability.history_filled = 0;
    tempo_stability.history_index = 0;

    // With <5 samples, should return neutral (0.5f)
    float stability = calculate_temporal_stability();
    TEST_ASSERT_EQUAL_FLOAT(0.5f, stability);
    TEST_MESSAGE("Temporal stability returns neutral with insufficient data");
}

void test_temporal_stability_stable_tempo() {
    // Fill history with stable tempo (120 BPM ±0.5 BPM)
    tempo_stability.history_filled = TEMPO_HISTORY_LENGTH;
    for (uint8_t i = 0; i < TEMPO_HISTORY_LENGTH; i++) {
        tempo_stability.tempo_history[i] = 120.0f + (i % 2) * 0.5f;
    }

    float stability = calculate_temporal_stability();

    // Stable tempo should have high stability (>0.8)
    TEST_ASSERT_GREATER_THAN(0.8f, stability);
    TEST_MESSAGE("Stable tempo correctly identified");
}

void test_temporal_stability_unstable_tempo() {
    // Fill history with highly variable tempo (100-140 BPM)
    tempo_stability.history_filled = TEMPO_HISTORY_LENGTH;
    for (uint8_t i = 0; i < TEMPO_HISTORY_LENGTH; i++) {
        tempo_stability.tempo_history[i] = 100.0f + (i % 10) * 4.0f;
    }

    float stability = calculate_temporal_stability();

    // Unstable tempo should have low stability (<0.4)
    TEST_ASSERT_LESS_THAN(0.4f, stability);
    TEST_MESSAGE("Unstable tempo correctly identified");
}

// ============================================================================
// MULTI-METRIC CONFIDENCE TESTS
// ============================================================================

void test_confidence_combined_high() {
    const uint16_t num_bins = 64;
    float tempi_smooth[num_bins];
    setup_single_peak_distribution(tempi_smooth, num_bins, 30);

    // Setup stable tempo history
    tempo_stability.history_filled = TEMPO_HISTORY_LENGTH;
    for (uint8_t i = 0; i < TEMPO_HISTORY_LENGTH; i++) {
        tempo_stability.tempo_history[i] = 120.0f;
    }

    update_confidence_metrics(tempi_smooth, num_bins, 1.0f);

    // All metrics should be high
    TEST_ASSERT_GREATER_THAN(0.8f, tempo_confidence_metrics.peak_ratio);
    TEST_ASSERT_GREATER_THAN(0.8f, tempo_confidence_metrics.entropy_confidence);
    TEST_ASSERT_GREATER_THAN(0.8f, tempo_confidence_metrics.temporal_stability);
    TEST_ASSERT_GREATER_THAN(0.7f, tempo_confidence_metrics.combined);
    TEST_MESSAGE("Combined confidence correctly reflects high confidence");
}

void test_confidence_combined_low() {
    const uint16_t num_bins = 64;
    float tempi_smooth[num_bins];
    setup_flat_tempo_distribution(tempi_smooth, num_bins);

    // Setup unstable tempo history
    tempo_stability.history_filled = TEMPO_HISTORY_LENGTH;
    for (uint8_t i = 0; i < TEMPO_HISTORY_LENGTH; i++) {
        tempo_stability.tempo_history[i] = 100.0f + (i % 10) * 5.0f;
    }

    update_confidence_metrics(tempi_smooth, num_bins, 1.0f);

    // All metrics should be low
    TEST_ASSERT_LESS_THAN(0.4f, tempo_confidence_metrics.peak_ratio);
    TEST_ASSERT_LESS_THAN(0.4f, tempo_confidence_metrics.entropy_confidence);
    TEST_ASSERT_LESS_THAN(0.4f, tempo_confidence_metrics.temporal_stability);
    TEST_ASSERT_LESS_THAN(0.5f, tempo_confidence_metrics.combined);
    TEST_MESSAGE("Combined confidence correctly reflects low confidence");
}

// ============================================================================
// TEMPO LOCK STATE MACHINE TESTS
// ============================================================================

void test_lock_state_unlocked_to_locking() {
    tempo_lock_tracker.state = TEMPO_UNLOCKED;
    tempo_lock_tracker.state_entry_time_ms = 0;
    tempo_confidence_metrics.combined = 0.7f;  // Above accept threshold

    update_tempo_lock_state(100);

    TEST_ASSERT_EQUAL(TEMPO_LOCKING, tempo_lock_tracker.state);
    TEST_MESSAGE("State correctly transitioned from UNLOCKED to LOCKING");
}

void test_lock_state_locking_to_locked() {
    tempo_lock_tracker.state = TEMPO_LOCKING;
    tempo_lock_tracker.state_entry_time_ms = 0;
    tempo_confidence_metrics.combined = 0.7f;

    // Wait for lock duration (300ms default)
    update_tempo_lock_state(350);

    TEST_ASSERT_EQUAL(TEMPO_LOCKED, tempo_lock_tracker.state);
    TEST_MESSAGE("State correctly transitioned from LOCKING to LOCKED");
}

void test_lock_state_locking_falls_back() {
    tempo_lock_tracker.state = TEMPO_LOCKING;
    tempo_lock_tracker.state_entry_time_ms = 0;
    tempo_confidence_metrics.combined = 0.3f;  // Below reject threshold

    update_tempo_lock_state(100);

    TEST_ASSERT_EQUAL(TEMPO_UNLOCKED, tempo_lock_tracker.state);
    TEST_MESSAGE("State correctly fell back from LOCKING to UNLOCKED");
}

void test_lock_state_locked_to_degrading() {
    tempo_lock_tracker.state = TEMPO_LOCKED;
    tempo_lock_tracker.state_entry_time_ms = 0;
    tempo_confidence_metrics.combined = 0.3f;  // Below reject threshold

    update_tempo_lock_state(100);

    TEST_ASSERT_EQUAL(TEMPO_DEGRADING, tempo_lock_tracker.state);
    TEST_MESSAGE("State correctly transitioned from LOCKED to DEGRADING");
}

void test_lock_state_degrading_recovers() {
    tempo_lock_tracker.state = TEMPO_DEGRADING;
    tempo_lock_tracker.state_entry_time_ms = 0;
    tempo_confidence_metrics.combined = 0.7f;  // Above accept threshold

    update_tempo_lock_state(100);

    TEST_ASSERT_EQUAL(TEMPO_LOCKED, tempo_lock_tracker.state);
    TEST_MESSAGE("State correctly recovered from DEGRADING to LOCKED");
}

void test_lock_state_degrading_unlocks() {
    tempo_lock_tracker.state = TEMPO_DEGRADING;
    tempo_lock_tracker.state_entry_time_ms = 0;
    tempo_confidence_metrics.combined = 0.3f;

    // Wait for reject duration (1000ms default)
    update_tempo_lock_state(1100);

    TEST_ASSERT_EQUAL(TEMPO_UNLOCKED, tempo_lock_tracker.state);
    TEST_MESSAGE("State correctly unlocked from DEGRADING");
}

// ============================================================================
// OCTAVE RELATIONSHIP TESTS
// ============================================================================

void test_octave_detection_2x_relationship() {
    const uint16_t num_bins = 64;
    float tempi_smooth[num_bins];
    float tempi_bpm_values_hz[num_bins];

    // Setup bins: 60 BPM at bin 14, 120 BPM at bin 46 (2x relationship)
    // Assuming 32-192 BPM range, 64 bins
    for (uint16_t i = 0; i < num_bins; i++) {
        float bpm = 32.0f + (160.0f * i / num_bins);
        tempi_bpm_values_hz[i] = bpm / 60.0f;
        tempi_smooth[i] = 0.01f;
    }

    // Strong peaks at ~60 BPM and ~120 BPM
    uint16_t bin_60 = 14;   // Approximately 60 BPM
    uint16_t bin_120 = 46;  // Approximately 120 BPM
    tempi_smooth[bin_60] = 0.4f;
    tempi_smooth[bin_120] = 0.4f;

    OctaveRelationship result = check_octave_ambiguity(tempi_smooth, tempi_bpm_values_hz, num_bins);

    // Should detect 2x relationship
    TEST_ASSERT_FLOAT_WITHIN(0.3f, 2.0f, result.relationship);
    TEST_ASSERT_GREATER_THAN(0.5f, result.combined_strength);
    TEST_MESSAGE("Octave detector correctly identified 2x relationship");
}

void test_octave_detection_no_ambiguity() {
    const uint16_t num_bins = 64;
    float tempi_smooth[num_bins];
    float tempi_bpm_values_hz[num_bins];

    for (uint16_t i = 0; i < num_bins; i++) {
        float bpm = 32.0f + (160.0f * i / num_bins);
        tempi_bpm_values_hz[i] = bpm / 60.0f;
        tempi_smooth[i] = (i == 30) ? 0.8f : 0.01f;
    }

    OctaveRelationship result = check_octave_ambiguity(tempi_smooth, tempi_bpm_values_hz, num_bins);

    // Should return 1.0 (no octave relationship)
    TEST_ASSERT_EQUAL_FLOAT(1.0f, result.relationship);
    TEST_MESSAGE("No octave ambiguity correctly detected");
}

// ============================================================================
// ADAPTIVE SMOOTHING TESTS
// ============================================================================

void test_adaptive_alpha_high_confidence() {
    float filtered_mag = 0.5f;
    float current_smooth = 0.4f;
    float confidence = 0.8f;  // High confidence

    float alpha = calculate_adaptive_alpha(filtered_mag, current_smooth, confidence);

    // High confidence should result in higher alpha (faster response)
    TEST_ASSERT_GREATER_THAN(0.10f, alpha);
    TEST_MESSAGE("High confidence correctly increases alpha");
}

void test_adaptive_alpha_low_confidence() {
    float filtered_mag = 0.5f;
    float current_smooth = 0.4f;
    float confidence = 0.3f;  // Low confidence

    float alpha = calculate_adaptive_alpha(filtered_mag, current_smooth, confidence);

    // Low confidence should result in lower alpha (slower response)
    TEST_ASSERT_LESS_THAN(0.08f, alpha);
    TEST_MESSAGE("Low confidence correctly decreases alpha");
}

void test_adaptive_alpha_attack_faster_than_release() {
    float confidence = 0.5f;  // Neutral

    float alpha_attack = calculate_adaptive_alpha(0.5f, 0.4f, confidence);   // Magnitude increasing
    float alpha_release = calculate_adaptive_alpha(0.3f, 0.4f, confidence);  // Magnitude decreasing

    // Attack should be faster than release
    TEST_ASSERT_GREATER_THAN(alpha_release, alpha_attack);
    TEST_MESSAGE("Attack correctly faster than release");
}

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

void test_find_dominant_bin() {
    const uint16_t num_bins = 64;
    float tempi_smooth[num_bins];

    for (uint16_t i = 0; i < num_bins; i++) {
        tempi_smooth[i] = (i == 42) ? 0.9f : 0.1f;
    }

    uint16_t dominant = find_dominant_tempo_bin(tempi_smooth, num_bins);
    TEST_ASSERT_EQUAL(42, dominant);
    TEST_MESSAGE("Dominant bin correctly identified");
}

void test_get_lock_state_string() {
    TEST_ASSERT_EQUAL_STRING("UNLOCKED", get_tempo_lock_state_string(TEMPO_UNLOCKED));
    TEST_ASSERT_EQUAL_STRING("LOCKING", get_tempo_lock_state_string(TEMPO_LOCKING));
    TEST_ASSERT_EQUAL_STRING("LOCKED", get_tempo_lock_state_string(TEMPO_LOCKED));
    TEST_ASSERT_EQUAL_STRING("DEGRADING", get_tempo_lock_state_string(TEMPO_DEGRADING));
    TEST_MESSAGE("Lock state strings correct");
}

// ============================================================================
// TEST RUNNER
// ============================================================================

void setUp(void) {
    // Initialize validation system before each test
    init_tempo_validation();
}

void tearDown(void) {
    // Clean up after each test
}

int main(int argc, char **argv) {
    UNITY_BEGIN();

    // Entropy tests
    RUN_TEST(test_entropy_flat_distribution);
    RUN_TEST(test_entropy_single_peak);
    RUN_TEST(test_entropy_zero_signal);

    // Median filter tests
    RUN_TEST(test_median_filter_rejects_spike);
    RUN_TEST(test_median_filter_accepts_gradual_change);
    RUN_TEST(test_median_filter_symmetric);

    // Temporal stability tests
    RUN_TEST(test_temporal_stability_insufficient_data);
    RUN_TEST(test_temporal_stability_stable_tempo);
    RUN_TEST(test_temporal_stability_unstable_tempo);

    // Multi-metric confidence tests
    RUN_TEST(test_confidence_combined_high);
    RUN_TEST(test_confidence_combined_low);

    // State machine tests
    RUN_TEST(test_lock_state_unlocked_to_locking);
    RUN_TEST(test_lock_state_locking_to_locked);
    RUN_TEST(test_lock_state_locking_falls_back);
    RUN_TEST(test_lock_state_locked_to_degrading);
    RUN_TEST(test_lock_state_degrading_recovers);
    RUN_TEST(test_lock_state_degrading_unlocks);

    // Octave detection tests
    RUN_TEST(test_octave_detection_2x_relationship);
    RUN_TEST(test_octave_detection_no_ambiguity);

    // Adaptive smoothing tests
    RUN_TEST(test_adaptive_alpha_high_confidence);
    RUN_TEST(test_adaptive_alpha_low_confidence);
    RUN_TEST(test_adaptive_alpha_attack_faster_than_release);

    // Utility tests
    RUN_TEST(test_find_dominant_bin);
    RUN_TEST(test_get_lock_state_string);

    return UNITY_END();
}

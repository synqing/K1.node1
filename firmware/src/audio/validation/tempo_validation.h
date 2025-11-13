// -----------------------------------------------------------------
//   _                                                   _  _      _         _    _
//  | |                                                 | |(_)    | |       | |  (_)
//  | |_    ___   _ __ ___    _ __     ___   __   __   | | _   __| |  __ _ | |_  _   ___   _ __
//  | __|  / _ \ | '_ ` _ \  | '_ \   / _ \  \ \ / /   | || | / _` | / _` || __|| | / _ \ | '_ \
//  | |_  |  __/ | | | | | | | |_) | | (_) |  \ V /    | || || (_| || (_| || |_ | || (_) || | | |
//   \__|  \___| |_| |_| |_| | .__/   \___/    \_/     |_||_| \__,_| \__,_| \__||_| \___/ |_| |_|
//                           | |
//                           |_|
//
// Phase 3: Tempo Detection Validation & Hardening
//
// This module provides robust validation for tempo detection including:
// - Entropy-based confidence (Shannon entropy of tempo distribution)
// - Median filtering for outlier rejection
// - Temporal stability tracking
// - Multi-metric confidence scoring
// - Tempo lock state machine with configurable thresholds
// - Adaptive attack/release smoothing
//
// Research: docs/05-analysis/K1NAnalysis_PHASE3_TEMPO_HARDENING_RECOMMENDATIONS_v1.0_20251111.md

#ifndef TEMPO_VALIDATION_H
#define TEMPO_VALIDATION_H

#include <stdint.h>
#include <cmath>

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

// Temporal stability tracking
#define TEMPO_HISTORY_LENGTH 30  // 30 frames @ 100 FPS = 300ms window

// Validation thresholds (configurable per genre)
#define TEMPO_CONFIDENCE_ACCEPT    0.65f   // High confidence, accept tempo lock
#define TEMPO_CONFIDENCE_REVIEW    0.50f   // Medium confidence, use with caution
#define TEMPO_CONFIDENCE_REJECT    0.40f   // Low confidence, reject tempo lock

// Default timeout configurations (milliseconds)
#define DEFAULT_CONFIDENCE_LOCK_DURATION_MS     300   // 300ms stable confidence required
#define DEFAULT_CONFIDENCE_REJECT_DURATION_MS   1000  // 1s low confidence before reject

// ============================================================================
// DATA STRUCTURES
// ============================================================================

// Multi-metric confidence breakdown
struct TempoConfidenceMetrics {
    float peak_ratio;           // Peak bin strength / sum (existing metric)
    float entropy_confidence;   // 1.0 - Shannon entropy (0.0 = ambiguous, 1.0 = clear)
    float temporal_stability;   // 1.0 / (1.0 + std_dev) (0.0 = unstable, 1.0 = stable)
    float combined;             // Weighted combination of all metrics
};

// 3-point median filter state
struct MedianFilter3 {
    float buffer[3];
    uint8_t index;
};

// Temporal stability tracker
struct TempoStabilityTracker {
    float tempo_history[TEMPO_HISTORY_LENGTH];
    uint8_t history_index;
    uint8_t history_filled;
};

// Tempo lock state machine
enum TempoLockState {
    TEMPO_UNLOCKED,     // No tempo lock, confidence too low
    TEMPO_LOCKING,      // Confidence rising, waiting for confirmation
    TEMPO_LOCKED,       // Confirmed tempo lock, confidence high
    TEMPO_DEGRADING     // Confidence falling, may lose lock
};

struct TempoLockTracker {
    TempoLockState state;
    uint32_t state_entry_time_ms;
    float locked_tempo_bpm;
};

// Configurable validation parameters
struct TempoValidationConfig {
    uint32_t novelty_update_interval_us;     // Novelty update rate (default: 50 Hz)
    uint32_t vu_calibration_window_ms;       // VU meter calibration window
    uint32_t confidence_lock_duration_ms;    // Time to confirm tempo lock
    uint32_t confidence_reject_duration_ms;  // Time to reject if unstable

    float confidence_accept_threshold;       // Threshold for tempo lock
    float confidence_reject_threshold;       // Threshold for rejection

    float smoothing_alpha_base;              // Base alpha for EMA smoothing
    float attack_multiplier;                 // Attack speed multiplier (>1.0 = faster)
    float release_multiplier;                // Release speed multiplier (<1.0 = slower)
};

// Octave relationship detection
struct OctaveRelationship {
    uint16_t bin_index;
    float relationship;        // 0.5, 1.0, 1.5, 2.0, 3.0
    float combined_strength;
};

// Genre-specific presets
enum MusicGenre {
    GENRE_ELECTRONIC,
    GENRE_POP,
    GENRE_JAZZ,
    GENRE_CLASSICAL,
    GENRE_CUSTOM
};

struct GenrePreset {
    float confidence_accept_threshold;
    float confidence_reject_threshold;
    float smoothing_alpha;
    float attack_release_ratio;
};

// ============================================================================
// GLOBAL STATE
// ============================================================================

extern TempoConfidenceMetrics tempo_confidence_metrics;
extern MedianFilter3 tempo_median_filter;
extern TempoStabilityTracker tempo_stability;
extern TempoLockTracker tempo_lock_tracker;
extern TempoValidationConfig tempo_validation_config;

// ============================================================================
// PUBLIC API - INITIALIZATION
// ============================================================================

// Initialize all validation components
void init_tempo_validation();

// Set genre preset
void set_genre_preset(MusicGenre genre);

// ============================================================================
// PUBLIC API - VALIDATION FUNCTIONS
// ============================================================================

// Entropy-based confidence calculation
// Returns: 0.0 (ambiguous/uniform distribution) to 1.0 (single clear peak)
float calculate_tempo_entropy(const float* tempi_smooth, uint16_t num_tempi, float tempi_power_sum);

// 3-point median filter (outlier rejection)
// Returns: Median of 3 most recent values
float apply_median_filter(MedianFilter3* filter, float new_value);

// Temporal stability tracking
void update_tempo_history(float current_tempo_bpm);
float calculate_temporal_stability();

// Multi-metric confidence calculation
void update_confidence_metrics(const float* tempi_smooth, uint16_t num_tempi, float tempi_power_sum);

// Tempo lock state machine
void update_tempo_lock_state(uint32_t current_time_ms);

// Octave relationship detection
OctaveRelationship check_octave_ambiguity(const float* tempi_smooth,
                                          const float* tempi_bpm_values_hz,
                                          uint16_t num_tempi);

// Adaptive smoothing alpha calculation
float calculate_adaptive_alpha(float filtered_magnitude, float current_smooth, float confidence);

// ============================================================================
// PUBLIC API - UTILITY FUNCTIONS
// ============================================================================

// Find dominant tempo bin
uint16_t find_dominant_tempo_bin(const float* tempi_smooth, uint16_t num_tempi);

// Get tempo lock state as string (for REST API)
const char* get_tempo_lock_state_string(TempoLockState state);

// ============================================================================
// INLINE HELPERS
// ============================================================================

// Fast 3-value median (no branches, uses min/max)
static inline float median3(float a, float b, float c) {
    float max_ab = fmaxf(a, b);
    float min_ab = fminf(a, b);
    return fminf(max_ab, fmaxf(min_ab, c));
}

#endif  // TEMPO_VALIDATION_H

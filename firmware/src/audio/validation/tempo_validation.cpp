#include "tempo_validation.h"

#include <Arduino.h>
#include <cmath>
#include <cstring>

// ============================================================================
// GLOBAL STATE (defined in header, instantiated here)
// ============================================================================

TempoConfidenceMetrics tempo_confidence_metrics = {0};
MedianFilter3 tempo_median_filter = {{0.0f, 0.0f, 0.0f}, 0};
TempoStabilityTracker tempo_stability = {{0}, 0, 0};
TempoLockTracker tempo_lock_tracker = {TEMPO_UNLOCKED, 0, 0.0f};

TempoValidationConfig tempo_validation_config = {
    .novelty_update_interval_us = 20000,     // 50 Hz (1000000/50)
    .vu_calibration_window_ms = 250,
    .confidence_lock_duration_ms = DEFAULT_CONFIDENCE_LOCK_DURATION_MS,
    .confidence_reject_duration_ms = DEFAULT_CONFIDENCE_REJECT_DURATION_MS,
    .confidence_accept_threshold = TEMPO_CONFIDENCE_ACCEPT,
    .confidence_reject_threshold = TEMPO_CONFIDENCE_REJECT,
    .smoothing_alpha_base = 0.08f,
    .attack_multiplier = 1.5f,
    .release_multiplier = 0.75f,
};

// Genre presets (from research)
static const GenrePreset genre_presets[] = {
    // ELECTRONIC: Rock-solid tempo, high confidence required
    { .confidence_accept_threshold = 0.75f,
      .confidence_reject_threshold = 0.50f,
      .smoothing_alpha = 0.06f,
      .attack_release_ratio = 1.2f },

    // POP: Generally stable, balanced
    { .confidence_accept_threshold = 0.65f,
      .confidence_reject_threshold = 0.45f,
      .smoothing_alpha = 0.08f,
      .attack_release_ratio = 1.5f },

    // JAZZ: Variable tempo, lower threshold, faster response
    { .confidence_accept_threshold = 0.55f,
      .confidence_reject_threshold = 0.35f,
      .smoothing_alpha = 0.12f,
      .attack_release_ratio = 2.0f },

    // CLASSICAL: Rubato, tempo changes, very relaxed
    { .confidence_accept_threshold = 0.50f,
      .confidence_reject_threshold = 0.30f,
      .smoothing_alpha = 0.15f,
      .attack_release_ratio = 2.5f },
};

// ============================================================================
// PUBLIC API - INITIALIZATION
// ============================================================================

void init_tempo_validation() {
    // Initialize confidence metrics
    tempo_confidence_metrics.peak_ratio = 0.0f;
    tempo_confidence_metrics.entropy_confidence = 0.0f;
    tempo_confidence_metrics.temporal_stability = 0.5f;  // Neutral start
    tempo_confidence_metrics.combined = 0.0f;

    // Initialize median filter
    tempo_median_filter.buffer[0] = 0.0f;
    tempo_median_filter.buffer[1] = 0.0f;
    tempo_median_filter.buffer[2] = 0.0f;
    tempo_median_filter.index = 0;

    // Initialize stability tracker
    memset(tempo_stability.tempo_history, 0, sizeof(tempo_stability.tempo_history));
    tempo_stability.history_index = 0;
    tempo_stability.history_filled = 0;

    // Initialize lock tracker
    tempo_lock_tracker.state = TEMPO_UNLOCKED;
    tempo_lock_tracker.state_entry_time_ms = 0;
    tempo_lock_tracker.locked_tempo_bpm = 0.0f;

    Serial.println("[Tempo Validation] Initialized - Phase 3 validation active");
}

void set_genre_preset(MusicGenre genre) {
    if (genre >= GENRE_CUSTOM) {
        Serial.println("[Tempo Validation] Custom genre selected, keeping current config");
        return;
    }

    const GenrePreset* preset = &genre_presets[genre];
    tempo_validation_config.confidence_accept_threshold = preset->confidence_accept_threshold;
    tempo_validation_config.confidence_reject_threshold = preset->confidence_reject_threshold;
    tempo_validation_config.smoothing_alpha_base = preset->smoothing_alpha;

    // Convert ratio to separate attack/release multipliers
    tempo_validation_config.attack_multiplier = preset->attack_release_ratio;
    tempo_validation_config.release_multiplier = 1.0f / preset->attack_release_ratio;

    const char* genre_names[] = {"ELECTRONIC", "POP", "JAZZ", "CLASSICAL"};
    Serial.printf("[Tempo Validation] Genre preset: %s (accept: %.2f, reject: %.2f)\n",
                  genre_names[genre],
                  preset->confidence_accept_threshold,
                  preset->confidence_reject_threshold);
}

// ============================================================================
// ENTROPY-BASED CONFIDENCE
// ============================================================================

float calculate_tempo_entropy(const float* tempi_smooth, uint16_t num_tempi, float tempi_power_sum) {
    if (tempi_power_sum < 0.000001f) {
        return 0.0f;  // No signal, no confidence
    }

    float entropy = 0.0f;
    float log2_N = log2f(static_cast<float>(num_tempi));

    // Calculate Shannon entropy: H = -Σ(p * log2(p))
    for (uint16_t i = 0; i < num_tempi; i++) {
        float p = tempi_smooth[i] / tempi_power_sum;
        if (p > 0.000001f) {
            entropy -= p * log2f(p);
        }
    }

    // Normalize to 0.0-1.0 range
    float normalized_entropy = entropy / log2_N;

    // Convert to confidence (1.0 = single clear peak, 0.0 = uniform/ambiguous)
    float confidence = 1.0f - normalized_entropy;

    return confidence;
}

// ============================================================================
// MEDIAN FILTERING
// ============================================================================

float apply_median_filter(MedianFilter3* filter, float new_value) {
    // Shift buffer
    filter->buffer[0] = filter->buffer[1];
    filter->buffer[1] = filter->buffer[2];
    filter->buffer[2] = new_value;

    // Return median using inline helper
    return median3(filter->buffer[0], filter->buffer[1], filter->buffer[2]);
}

// ============================================================================
// TEMPORAL STABILITY TRACKING
// ============================================================================

void update_tempo_history(float current_tempo_bpm) {
    tempo_stability.tempo_history[tempo_stability.history_index] = current_tempo_bpm;
    tempo_stability.history_index = (tempo_stability.history_index + 1) % TEMPO_HISTORY_LENGTH;

    if (tempo_stability.history_filled < TEMPO_HISTORY_LENGTH) {
        tempo_stability.history_filled++;
    }
}

float calculate_temporal_stability() {
    if (tempo_stability.history_filled < 5) {
        return 0.5f;  // Not enough data yet, return neutral
    }

    // Calculate mean
    float mean = 0.0f;
    uint8_t count = tempo_stability.history_filled;

    for (uint8_t i = 0; i < count; i++) {
        mean += tempo_stability.tempo_history[i];
    }
    mean /= count;

    // Calculate variance
    float variance = 0.0f;
    for (uint8_t i = 0; i < count; i++) {
        float diff = tempo_stability.tempo_history[i] - mean;
        variance += diff * diff;
    }
    variance /= count;

    float std_dev = sqrtf(variance);

    // Convert to confidence: low variance = high stability
    // Typical std_dev ranges: 0-5 BPM
    // Formula: stability = 1.0 / (1.0 + std_dev)
    float stability = 1.0f / (1.0f + std_dev);

    return stability;
}

// ============================================================================
// MULTI-METRIC CONFIDENCE
// ============================================================================

void update_confidence_metrics(const float* tempi_smooth, uint16_t num_tempi, float tempi_power_sum) {
    // 1. Peak ratio (existing metric)
    float max_contribution = 0.000001f;
    for (uint16_t i = 0; i < num_tempi; i++) {
        float contribution = tempi_smooth[i] / tempi_power_sum;
        max_contribution = fmaxf(contribution, max_contribution);
    }
    tempo_confidence_metrics.peak_ratio = max_contribution;

    // 2. Entropy confidence (new)
    tempo_confidence_metrics.entropy_confidence = calculate_tempo_entropy(tempi_smooth, num_tempi, tempi_power_sum);

    // 3. Temporal stability (updated externally via update_tempo_history)
    tempo_confidence_metrics.temporal_stability = calculate_temporal_stability();

    // 4. Combined confidence (weighted average)
    // Weights: 35% peak ratio, 35% entropy, 30% stability
    tempo_confidence_metrics.combined =
        0.35f * tempo_confidence_metrics.peak_ratio +
        0.35f * tempo_confidence_metrics.entropy_confidence +
        0.30f * tempo_confidence_metrics.temporal_stability;
}

// ============================================================================
// TEMPO LOCK STATE MACHINE
// ============================================================================

void update_tempo_lock_state(uint32_t current_time_ms) {
    uint32_t time_in_state = current_time_ms - tempo_lock_tracker.state_entry_time_ms;
    float confidence = tempo_confidence_metrics.combined;

    switch (tempo_lock_tracker.state) {
        case TEMPO_UNLOCKED:
            if (confidence > tempo_validation_config.confidence_accept_threshold) {
                tempo_lock_tracker.state = TEMPO_LOCKING;
                tempo_lock_tracker.state_entry_time_ms = current_time_ms;
            }
            break;

        case TEMPO_LOCKING:
            if (confidence < tempo_validation_config.confidence_reject_threshold) {
                // Fell back down, return to unlocked
                tempo_lock_tracker.state = TEMPO_UNLOCKED;
                tempo_lock_tracker.state_entry_time_ms = current_time_ms;
            } else if (time_in_state > tempo_validation_config.confidence_lock_duration_ms) {
                // Confirmed! Lock the tempo
                tempo_lock_tracker.state = TEMPO_LOCKED;
                tempo_lock_tracker.state_entry_time_ms = current_time_ms;
                Serial.printf("[Tempo Validation] LOCKED at %.1f BPM (confidence: %.2f)\n",
                              tempo_lock_tracker.locked_tempo_bpm, confidence);
            }
            break;

        case TEMPO_LOCKED:
            if (confidence < tempo_validation_config.confidence_reject_threshold) {
                tempo_lock_tracker.state = TEMPO_DEGRADING;
                tempo_lock_tracker.state_entry_time_ms = current_time_ms;
            }
            break;

        case TEMPO_DEGRADING:
            if (confidence > tempo_validation_config.confidence_accept_threshold) {
                // Recovered! Back to locked
                tempo_lock_tracker.state = TEMPO_LOCKED;
                tempo_lock_tracker.state_entry_time_ms = current_time_ms;
            } else if (time_in_state > tempo_validation_config.confidence_reject_duration_ms) {
                // Lost lock
                tempo_lock_tracker.state = TEMPO_UNLOCKED;
                tempo_lock_tracker.state_entry_time_ms = current_time_ms;
                Serial.printf("[Tempo Validation] UNLOCKED (confidence degraded: %.2f)\n", confidence);
            }
            break;
    }
}

// ============================================================================
// OCTAVE RELATIONSHIP DETECTION
// ============================================================================

OctaveRelationship check_octave_ambiguity(const float* tempi_smooth,
                                          const float* tempi_bpm_values_hz,
                                          uint16_t num_tempi) {
    // Find top 3 tempo candidates
    uint16_t top_bins[3] = {0, 0, 0};
    float top_strengths[3] = {0.0f, 0.0f, 0.0f};

    for (uint16_t i = 0; i < num_tempi; i++) {
        float strength = tempi_smooth[i];
        if (strength > top_strengths[0]) {
            top_bins[2] = top_bins[1]; top_strengths[2] = top_strengths[1];
            top_bins[1] = top_bins[0]; top_strengths[1] = top_strengths[0];
            top_bins[0] = i; top_strengths[0] = strength;
        } else if (strength > top_strengths[1]) {
            top_bins[2] = top_bins[1]; top_strengths[2] = top_strengths[1];
            top_bins[1] = i; top_strengths[1] = strength;
        } else if (strength > top_strengths[2]) {
            top_bins[2] = i; top_strengths[2] = strength;
        }
    }

    // Check relationships
    float tempo0 = tempi_bpm_values_hz[top_bins[0]] * 60.0f;
    float tempo1 = tempi_bpm_values_hz[top_bins[1]] * 60.0f;

    float ratio_1_0 = tempo1 / tempo0;

    // Check for 2x relationship (tolerance ±10%)
    if (fabsf(ratio_1_0 - 2.0f) < 0.2f) {
        // Octave ambiguity: 2x relationship detected
        // Prefer slower tempo (research shows humans prefer lower BPM for foot-tapping)
        uint16_t preferred_bin = (tempo0 < tempo1) ? top_bins[0] : top_bins[1];

        return {
            .bin_index = preferred_bin,
            .relationship = ratio_1_0,
            .combined_strength = top_strengths[0] + top_strengths[1]
        };
    }

    // Check for 0.5x relationship (half tempo)
    if (fabsf(ratio_1_0 - 0.5f) < 0.1f) {
        // Half-tempo relationship
        uint16_t preferred_bin = (tempo0 < tempo1) ? top_bins[0] : top_bins[1];

        return {
            .bin_index = preferred_bin,
            .relationship = ratio_1_0,
            .combined_strength = top_strengths[0] + top_strengths[1]
        };
    }

    // No octave ambiguity, return dominant bin
    return {
        .bin_index = top_bins[0],
        .relationship = 1.0f,
        .combined_strength = top_strengths[0]
    };
}

// ============================================================================
// ADAPTIVE SMOOTHING
// ============================================================================

float calculate_adaptive_alpha(float filtered_magnitude, float current_smooth, float confidence) {
    float base_alpha = tempo_validation_config.smoothing_alpha_base;

    // Adjust based on confidence (higher confidence = faster response)
    if (confidence > 0.7f) {
        base_alpha *= 1.5f;  // 50% faster for confident beats
    } else if (confidence < 0.4f) {
        base_alpha *= 0.5f;  // 50% slower for uncertain beats
    }

    // Attack/release asymmetry: faster increase, slower decrease
    float alpha;
    if (filtered_magnitude > current_smooth) {
        alpha = base_alpha * tempo_validation_config.attack_multiplier;  // Attack
    } else {
        alpha = base_alpha * tempo_validation_config.release_multiplier;  // Release
    }

    // Clamp to reasonable range
    if (alpha < 0.02f) alpha = 0.02f;
    if (alpha > 0.25f) alpha = 0.25f;

    return alpha;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

uint16_t find_dominant_tempo_bin(const float* tempi_smooth, uint16_t num_tempi) {
    uint16_t dominant_bin = 0;
    float max_smooth = 0.0f;

    for (uint16_t i = 0; i < num_tempi; i++) {
        if (tempi_smooth[i] > max_smooth) {
            max_smooth = tempi_smooth[i];
            dominant_bin = i;
        }
    }

    return dominant_bin;
}

const char* get_tempo_lock_state_string(TempoLockState state) {
    switch (state) {
        case TEMPO_UNLOCKED:    return "UNLOCKED";
        case TEMPO_LOCKING:     return "LOCKING";
        case TEMPO_LOCKED:      return "LOCKED";
        case TEMPO_DEGRADING:   return "DEGRADING";
        default:                return "UNKNOWN";
    }
}

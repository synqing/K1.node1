#include "tempo.h"

#include <Arduino.h>
#include <cmath>
#include <cstring>

#include "goertzel.h"
#include "vu.h"
#include "validation/tempo_validation.h"

static const char* TAG = "TEMPO";

// ============================================================================ 
// GLOBAL STATE (Emotiscope parity)
// ============================================================================

uint32_t t_now_us = 0;
uint32_t t_now_ms = 0;

float tempi_bpm_values_hz[NUM_TEMPI];
float tempo_confidence = 0.0f;
float MAX_TEMPO_RANGE = 1.0f;

float novelty_curve[NOVELTY_HISTORY_LENGTH];
float novelty_curve_normalized[NOVELTY_HISTORY_LENGTH];
float vu_curve[NOVELTY_HISTORY_LENGTH];
float tempi_power_sum = 0.0f;

bool silence_detected = true;
float silence_level = 1.0f;

// ============================================================================ 
// HELPERS
// ============================================================================

static inline void shift_array_left(float* array, uint32_t length, uint32_t shift) {
    if (shift == 0 || length == 0) {
        return;
    }
    if (shift >= length) {
        std::memset(array, 0, sizeof(float) * length);
        return;
    }
    std::memmove(array, array + shift, sizeof(float) * (length - shift));
    std::memset(array + (length - shift), 0, sizeof(float) * shift);
}

static float unwrap_phase(float phase) {
    while (phase > M_PI) {
        phase -= 2.0f * M_PI;
    }
    while (phase < -M_PI) {
        phase += 2.0f * M_PI;
    }
    return phase;
}

// ============================================================================ 
// PUBLIC API (Emotiscope logic)
// ============================================================================

uint16_t find_closest_tempo_bin(float target_bpm) {
    float target_bpm_hz = target_bpm / 60.0f;

    float smallest_difference = 1e7f;
    uint16_t smallest_difference_index = 0;

    for (uint16_t i = 0; i < NUM_TEMPI; i++) {
        float difference = fabsf(target_bpm_hz - tempi_bpm_values_hz[i]);
        if (difference < smallest_difference) {
            smallest_difference = difference;
            smallest_difference_index = i;
        }
    }

    return smallest_difference_index;
}

void init_tempo_goertzel_constants() {
    // Validate array bounds and initialization
    if (!tempi_bpm_values_hz) {
        ESP_LOGE(TAG, "tempi_bpm_values_hz array not allocated");
        return;
    }
    
    // Initialize tempo frequency values with bounds checking
    for (uint16_t i = 0; i < NUM_TEMPI; i++) {
        float progress = static_cast<float>(i) / static_cast<float>(NUM_TEMPI);
        float tempi_range = TEMPO_HIGH - TEMPO_LOW;
        float tempo = tempi_range * progress + TEMPO_LOW;

        // Validate tempo calculation to prevent invalid values
        if (tempo < TEMPO_LOW || tempo > TEMPO_HIGH) {
            ESP_LOGW(TAG, "Invalid tempo calculation at index %d: %f", i, tempo);
            tempo = TEMPO_LOW + (TEMPO_HIGH - TEMPO_LOW) * 0.5f; // Use middle value
        }
        
        tempi_bpm_values_hz[i] = tempo / 60.0f;
    }

    for (uint16_t i = 0; i < NUM_TEMPI; i++) {
        tempi[i].target_tempo_hz = tempi_bpm_values_hz[i];

        float neighbor_left;
        float neighbor_right;

        if (i == 0) {
            neighbor_left = tempi_bpm_values_hz[i];
            neighbor_right = tempi_bpm_values_hz[i + 1];
        } else if (i == NUM_TEMPI - 1) {
            neighbor_left = tempi_bpm_values_hz[i - 1];
            neighbor_right = tempi_bpm_values_hz[i];
        } else {
            neighbor_left = tempi_bpm_values_hz[i - 1];
            neighbor_right = tempi_bpm_values_hz[i + 1];
        }

        float neighbor_left_distance_hz = fabsf(neighbor_left - tempi[i].target_tempo_hz);
        float neighbor_right_distance_hz = fabsf(neighbor_right - tempi[i].target_tempo_hz);
        float max_distance_hz = fmaxf(neighbor_left_distance_hz, neighbor_right_distance_hz);

        tempi[i].block_size = static_cast<uint32_t>(NOVELTY_LOG_HZ / (max_distance_hz * 0.5f));

        if (tempi[i].block_size > NOVELTY_HISTORY_LENGTH) {
            tempi[i].block_size = NOVELTY_HISTORY_LENGTH;
        }

        float k = floorf(0.5f + ((tempi[i].block_size * tempi[i].target_tempo_hz) / NOVELTY_LOG_HZ));
        float w = (2.0f * static_cast<float>(M_PI) * k) / tempi[i].block_size;
        tempi[i].cosine = cosf(w);
        tempi[i].sine = sinf(w);
        tempi[i].coeff = 2.0f * tempi[i].cosine;
        tempi[i].window_step = 4096.0f / tempi[i].block_size;
        tempi[i].phase = 0.0f;
        tempi[i].phase_target = 0.0f;
        tempi[i].phase_inverted = false;
        tempi[i].phase_radians_per_reference_frame = ((2.0f * static_cast<float>(M_PI) * tempi[i].target_tempo_hz) / REFERENCE_FPS);
        tempi[i].beat = 0.0f;
        tempi[i].magnitude = 0.0f;
        tempi[i].magnitude_full_scale = 0.0f;
        tempi[i].magnitude_smooth = 0.0f;
    }
}

// PHASE 3 DISABLED: Commented out to save ~4KB RAM
/*
void init_tempo_validation_system() {
    init_tempo_validation();
    Serial.println("[Tempo] Phase 3 validation system initialized");
}
*/

static float calculate_magnitude_of_tempo(uint16_t tempo_bin) {
    float normalized_magnitude = 0.0f;

    profile_function([&]() {
        uint32_t block_size = tempi[tempo_bin].block_size;

        float q1 = 0.0f;
        float q2 = 0.0f;
        float window_pos = 0.0f;

        for (uint32_t i = 0; i < block_size; i++) {
            float sample_novelty = novelty_curve_normalized[((NOVELTY_HISTORY_LENGTH - 1) - block_size) + i];

            float q0 = tempi[tempo_bin].coeff * q1 - q2 + (sample_novelty * window_lookup[static_cast<uint32_t>(window_pos)]);
            q2 = q1;
            q1 = q0;

            window_pos += tempi[tempo_bin].window_step;
        }

        float real = (q1 - q2 * tempi[tempo_bin].cosine);
        float imag = (q2 * tempi[tempo_bin].sine);

        tempi[tempo_bin].phase = unwrap_phase(atan2f(imag, real) + (static_cast<float>(M_PI) * BEAT_SHIFT_PERCENT));

        float magnitude_squared = (q1 * q1) + (q2 * q2) - q1 * q2 * tempi[tempo_bin].coeff;
        float magnitude = sqrtf(fmaxf(magnitude_squared, 0.0f));
        normalized_magnitude = magnitude / (block_size / 2.0f);
        tempi[tempo_bin].magnitude_full_scale = normalized_magnitude;
    }, __func__);

    return normalized_magnitude;
}

static void calculate_tempi_magnitudes(int16_t single_bin = -1) {
    profile_function([&]() {
        float max_val = 0.0f;
        for (uint16_t i = 0; i < NUM_TEMPI; i++) {
            if (single_bin >= 0) {
                if (i == static_cast<uint16_t>(single_bin)) {
                    tempi[i].magnitude_full_scale = calculate_magnitude_of_tempo(static_cast<uint16_t>(single_bin));
                }
            } else {
                tempi[i].magnitude_full_scale = calculate_magnitude_of_tempo(i);
            }

            if (tempi[i].magnitude_full_scale > max_val) {
                max_val = tempi[i].magnitude_full_scale;
            }
        }

        if (max_val < 0.04f) {
            max_val = 0.04f;
        }

        float autoranger_scale = 1.0f / max_val;

        for (uint16_t i = 0; i < NUM_TEMPI; i++) {
            float scaled_magnitude = tempi[i].magnitude_full_scale * autoranger_scale;
            if (scaled_magnitude < 0.0f) {
                scaled_magnitude = 0.0f;
            }
            if (scaled_magnitude > 1.0f) {
                scaled_magnitude = 1.0f;
            }

            // EMOTISCOPE VERBATIM: Cubic scaling (x³) for proper dynamic range compression
            float cubed = scaled_magnitude * scaled_magnitude * scaled_magnitude;
            tempi[i].magnitude = cubed;
        }
    }, __func__);
}

static void normalize_novelty_curve() {
    profile_function([&]() {
        static float max_val = 0.00001f;
        static float max_val_smooth = 0.1f;

        max_val *= 0.99f;
        for (uint16_t i = 0; i < NOVELTY_HISTORY_LENGTH; i += 4) {
            max_val = fmaxf(max_val, novelty_curve[i + 0]);
            max_val = fmaxf(max_val, novelty_curve[i + 1]);
            max_val = fmaxf(max_val, novelty_curve[i + 2]);
            max_val = fmaxf(max_val, novelty_curve[i + 3]);
        }
        max_val_smooth = fmaxf(0.1f, max_val_smooth * 0.95f + max_val * 0.05f);  // Increased from 1% to 5% per frame for faster adaptation (0.4s vs 2s)

        float auto_scale = 1.0f / fmaxf(max_val, 0.00001f);
        dsps_mulc_f32(novelty_curve, novelty_curve_normalized, NOVELTY_HISTORY_LENGTH, auto_scale, 1, 1);
    }, __func__);
}

void update_tempo() {
    profile_function([&]() {
        static uint16_t calc_bin = 0;

        normalize_novelty_curve();

        uint16_t max_bin = static_cast<uint16_t>((NUM_TEMPI - 1) * MAX_TEMPO_RANGE);
        // Process multiple bins per call to keep visuals responsive
        const uint16_t stride = 8;  // bins per frame
        for (uint16_t k = 0; k < stride; ++k) {
            uint16_t bin = calc_bin + k;
            if (bin >= max_bin) break;
            calculate_tempi_magnitudes((int16_t)bin);
        }

        calc_bin = (uint16_t)(calc_bin + stride);
        if (calc_bin >= max_bin) calc_bin = 0;
    }, __func__);
}

static void log_novelty(float input) {
    shift_array_left(novelty_curve, NOVELTY_HISTORY_LENGTH, 1);
    novelty_curve[NOVELTY_HISTORY_LENGTH - 1] = input;
}

static void log_vu(float input) {
    shift_array_left(vu_curve, NOVELTY_HISTORY_LENGTH, 1);
    vu_curve[NOVELTY_HISTORY_LENGTH - 1] = input;
}

static void reduce_tempo_history(float reduction_amount) {
    float reduction_amount_inv = 1.0f - reduction_amount;

    for (uint16_t i = 0; i < NOVELTY_HISTORY_LENGTH; i++) {
        novelty_curve[i] = fmaxf(novelty_curve[i] * reduction_amount_inv, 0.00001f);
        vu_curve[i] = fmaxf(vu_curve[i] * reduction_amount_inv, 0.00001f);
    }
}

void check_silence(float current_novelty) {
    float min_val = 1.0f;
    float max_val = 0.0f;
    for (uint16_t i = 0; i < 128; i++) {
        float recent_novelty = novelty_curve_normalized[(NOVELTY_HISTORY_LENGTH - 1 - 128) + i];
        recent_novelty = fminf(0.5f, recent_novelty) * 2.0f;

        float scaled_value = sqrtf(recent_novelty);
        max_val = fmaxf(max_val, scaled_value);
        min_val = fminf(min_val, scaled_value);
    }
    float novelty_contrast = fabsf(max_val - min_val);
    float silence_level_raw = 1.0f - novelty_contrast;

    silence_level = fmaxf(0.0f, silence_level_raw - 0.5f) * 2.0f;
    if (silence_level_raw > 0.5f) {
        silence_detected = true;
        reduce_tempo_history(silence_level * 0.10f);
    } else {
        silence_level = 0.0f;
        silence_detected = false;
    }
}

void update_novelty() {
    static uint32_t next_update = 0;
    if (next_update == 0) {
        next_update = t_now_us;
    }

    const float update_interval_hz = NOVELTY_LOG_HZ;
    const uint32_t update_interval_us = static_cast<uint32_t>(1000000.0f / update_interval_hz);

    if (t_now_us >= next_update) {
        next_update += update_interval_us;

        float current_novelty = 0.0f;
        for (uint16_t i = 0; i < NUM_FREQS; i++) {
            float new_mag = spectrogram_smooth[i];
            float novelty = fmaxf(0.0f, new_mag - frequencies_musical[i].magnitude_last);
            frequencies_musical[i].novelty = novelty;
            frequencies_musical[i].magnitude_last = new_mag;
            current_novelty += novelty;
        }
        current_novelty /= static_cast<float>(NUM_FREQS);

        check_silence(current_novelty);

        log_novelty(logf(1.0f + current_novelty));
        log_vu(vu_max);
        vu_max = 0.000001f;
    }
}

static void sync_beat_phase(uint16_t tempo_bin, float delta) {
    float push = tempi[tempo_bin].phase_radians_per_reference_frame * delta;
    tempi[tempo_bin].phase += push;

    if (tempi[tempo_bin].phase > static_cast<float>(M_PI)) {
        tempi[tempo_bin].phase -= (2.0f * static_cast<float>(M_PI));
    } else if (tempi[tempo_bin].phase < -static_cast<float>(M_PI)) {
        tempi[tempo_bin].phase += (2.0f * static_cast<float>(M_PI));
    }

    tempi[tempo_bin].beat = sinf(tempi[tempo_bin].phase);
}

void update_tempi_phase(float delta) {
    tempi_power_sum = 0.00000001f;

    // ========================================================================
    // EMOTISCOPE VERBATIM: Simple smoothing + max contribution confidence
    // ========================================================================

    for (uint16_t tempo_bin = 0; tempo_bin < NUM_TEMPI; tempo_bin++) {
        float tempi_magnitude = tempi[tempo_bin].magnitude;

        // Fixed smoothing alpha (Emotiscope: 0.025)
        tempi_smooth[tempo_bin] = tempi_smooth[tempo_bin] * 0.975f + tempi_magnitude * 0.025f;
        tempi_power_sum += tempi_smooth[tempo_bin];

        sync_beat_phase(tempo_bin, delta);
    }

    // ========================================================================
    // EMOTISCOPE BASELINE: Simple max contribution confidence
    // ========================================================================

    // Calculate confidence as max contribution (Emotiscope algorithm)
    float max_contribution = 0.000001f;
    for (uint16_t tempo_bin = 0; tempo_bin < NUM_TEMPI; tempo_bin++) {
        max_contribution = fmaxf(
            tempi_smooth[tempo_bin] / tempi_power_sum,
            max_contribution
        );
    }

    // ========================================================================
    // PHASE 1: ENTROPY LAYER - Ambiguity detection
    // ========================================================================
    // Calculate entropy confidence (1.0 = clear peak, 0.0 = ambiguous/uniform)
    float entropy_confidence = calculate_tempo_entropy(tempi_smooth, NUM_TEMPI, tempi_power_sum);
    
    // PHASE 1: Blend peak ratio (legacy) with entropy (ambiguity detection)
    // 60% weight on peak ratio (trust Emotiscope), 40% on entropy (detect ambiguity)
    float phase1_confidence = 0.60f * max_contribution + 0.40f * entropy_confidence;
    
    tempo_confidence = phase1_confidence;

    // ========================================================================
    // PHASE 3 DEFERRED: All other Phase 3 validation commented out
    // Re-enable in subsequent phases
    /*
    // PHASE 2: Temporal stability tracking
    uint16_t dominant_bin = find_dominant_tempo_bin(tempi_smooth, NUM_TEMPI);
    float current_tempo_bpm = tempi_bpm_values_hz[dominant_bin] * 60.0f;
    update_tempo_history(current_tempo_bpm);

    // PHASE 3: Octave detection + state machine
    OctaveRelationship octave_rel = check_octave_ambiguity(tempi_smooth, tempi_bpm_values_hz, NUM_TEMPI);
    update_tempo_lock_state(t_now_ms);

    // PHASE 4: Adaptive smoothing
    float alpha = calculate_adaptive_alpha(filtered_magnitude, tempi_smooth[tempo_bin], tempo_confidence_metrics.combined);
    */
}

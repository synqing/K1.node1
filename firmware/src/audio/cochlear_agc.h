/*----------------------------------------
  K1 LIGHTWAVE COCHLEAR AGC v2.1 (Full Float Version)
  ROBUST, OPTIMIZED, AND ENCAPSULATED
  ----------------------------------------

  Biologically-inspired multi-band Automatic Gain Control.
  Optimized for float-based pipelines (e.g., ESP32-S3 with FPU).
*/

#ifndef COCHLEAR_AGC_H
#define COCHLEAR_AGC_H

#include <cmath>
#include <algorithm>
#include <cstring>
#include <cstdint>

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

#define COCHLEAR_BANDS 6
#define COCHLEAR_HISTORY_LENGTH 16

// Base rates for IIR smoothing (defined as 'rate' i.e., 1-coefficient)
#define COCHLEAR_ATTACK_RATE_BASE 0.05f
#define COCHLEAR_RELEASE_RATE_BASE 0.02f
#define COCHLEAR_ADAPTATION_MAX_SPEEDUP 4.0f

// Compression Ratios (represented as Inverse Ratio 1/R for optimized calculation)
#define COCHLEAR_INV_RATIO_MILD 0.8f      // 1:1.25
#define COCHLEAR_INV_RATIO_MODERATE 0.6f  // 1:1.67
#define COCHLEAR_INV_RATIO_HEAVY 0.4f     // 1:2.5

// Helper macro for optimized IIR smoothing: New = Current + (Target - Current) * Rate
#define IIR_SMOOTH_BY_RATE(current, target, rate) (current) += ((target) - (current)) * (rate)

// ============================================================================
// PROCESSOR CLASS
// ============================================================================

class CochlearAGC {
private:
    // ========================================================================
    // DEFINITIONS AND CONSTANTS
    // ========================================================================

    struct CochlearBand {
        uint16_t start_bin;
        uint16_t end_bin;
        uint16_t bin_count;

        // Dynamic State
        float gain;
        float target_gain;
        float attack_rate;
        float release_rate;
        float inv_compression_ratio; // Using 1/R

        // Compression parameters
        float threshold_amplitude;

        // Energy Tracking (using Mag^2).
        float energy_history[COCHLEAR_HISTORY_LENGTH];
        uint8_t history_index;
        float energy_mean;
        float energy_variance;
    };

    // Constants
    static constexpr float KNEE_WIDTH = 0.1f;
    // Energy threshold for silence detection (e.g., 0.01 VU^2 = 0.0001)
    static constexpr float SILENCE_THRESHOLD_ENERGY = 0.0001f;
    // Scaling factor for variance adaptation
    static constexpr float VARIANCE_ADAPTATION_FACTOR = 20.0f;

    // ========================================================================
    // MEMBER VARIABLES
    // ========================================================================

    bool initialized;
    uint16_t fft_size;
    float processing_fps;
    bool enabled;

    // STAGE 1: Global VU normalization
    float global_gain;
    float target_energy;         // Target energy level (e.g., 0.5^2 = 0.25)
    float max_gain_linear;       // Pre-calculated linear gain
    float current_total_energy;

    // v2.1.1 FIX: RMS Envelope Follower
    float smoothed_input_energy;         // Smoothed energy envelope for stable gain calc
    float energy_smoothing_attack_rate;  // Rate for the envelope attack (fast)
    float energy_smoothing_release_rate; // Rate for the envelope release (fast)

    // Gain application rates (slow)
    float global_attack_rate;
    float global_release_rate;

    // STAGE 2: Per-band processing.
    CochlearBand bands[COCHLEAR_BANDS];

public:
    // ========================================================================
    // PUBLIC INTERFACE
    // ========================================================================

    CochlearAGC() : initialized(false), enabled(false), fft_size(0), processing_fps(0.0f) {}

    /**
     * Initializes the AGC system.
     * @param fft_bins Number of frequency bins (e.g., 64).
     * @param fps Expected frames per second (e.g., 100.0f).
     */
    bool initialize(uint16_t fft_bins, float fps) {
        if (fft_bins == 0 || fps <= 0.0f) return false;

        fft_size = fft_bins;
        processing_fps = fps;

        // STAGE 1: Global Defaults
        global_gain = 1.0f;
        current_total_energy = 0.0f;

        // v2.1.1 FIX: Initialize Envelope Follower State
        smoothed_input_energy = 0.0f;

        // Set configuration and pre-calculate derived values
        set_target_vu(0.5f);        // Target 50% VU
        set_max_boost_db(40.0f);    // +40 dB max

        // v2.1.1 FIX: Configure Leveler Dynamics
        // 1. Envelope Follower Speed (Fast measurement)
        set_energy_smoothing_time(0.10f, 0.15f); // 100ms attack, 150ms release

        // 2. Gain Application Speed (Slow leveling)
        set_global_attack_time(3.0f);  // 3 seconds attack
        set_global_release_time(8.0f); // 8 seconds release

        // STAGE 2: Setup bands
        setup_cochlear_bands();

        initialized = true;
        enabled = true;
        return true;
    }

    /**
     * Main processing function. Modifies the spectrum in place.
     * @param spectrum Input/Output spectrum array (float format). Assumed size = fft_size.
     */
    void process(float* spectrum) {
        if (!enabled || !initialized || spectrum == nullptr) return;

        // STAGE 1: GLOBAL VU NORMALIZATION
        update_global_agc(spectrum);
        apply_global_gain(spectrum);

        // STAGE 2: PER-BAND COCHLEAR ENHANCEMENT
        // Analyze the normalized spectrum
        update_cochlear_bands(spectrum);
        // Apply band gains and compression
        apply_band_processing(spectrum);
    }

    // ========================================================================
    // TUNING INTERFACE (Handles Pre-calculations)
    // ========================================================================

    void enable(bool state) { enabled = state; }

    // Diagnostic access
    float get_global_gain() const { return global_gain; }
    float get_current_energy() const { return current_total_energy; }
    float get_smoothed_energy() const { return smoothed_input_energy; }
    float get_band_gain(uint8_t band_idx) const {
        return (band_idx < COCHLEAR_BANDS) ? bands[band_idx].gain : 0.0f;
    }

    // v2.1.1 FIX: Helper function for envelope follower
    void set_energy_smoothing_time(float attack_s, float release_s) {
        energy_smoothing_attack_rate = time_to_rate(attack_s);
        energy_smoothing_release_rate = time_to_rate(release_s);
    }

    void set_target_vu(float target_vu) {
        target_vu = std::max(0.1f, std::min(target_vu, 0.9f));
        target_energy = target_vu * target_vu;
    }

    void set_max_boost_db(float max_db) {
        float clamped_db = std::max(0.0f, std::min(max_db, 60.0f));
        max_gain_linear = powf(10.0f, clamped_db / 20.0f);
    }

    float time_to_rate(float seconds) {
        if (seconds <= 0.0f || processing_fps <= 0.0f) return 1.0f;
        return 1.0f - expf(-1.0f / (seconds * processing_fps));
    }

    void set_global_attack_time(float seconds) {
        global_attack_rate = time_to_rate(seconds);
    }

    void set_global_release_time(float seconds) {
        global_release_rate = time_to_rate(seconds);
    }

private:
    // ========================================================================
    // INITIALIZATION HELPERS
    // ========================================================================

    void setup_cochlear_bands() {
        // Dynamically maps the original design's 64-bin structure proportionally to the actual FFT size.
        auto map_bin = [&](uint16_t bin_64) {
            return std::min((uint16_t)roundf((float)bin_64 * fft_size / 64.0f), (uint16_t)(fft_size - 1));
        };

        // {Start (Ref 64), End (Ref 64), Threshold (VU Amplitude)}
        const float mappings[COCHLEAR_BANDS][3] = {
            {0, 0, 0.6f}, {1, 2, 0.6f}, {3, 6, 0.6f}, {7, 16, 0.6f}, {17, 40, 0.6f}, {41, 63, 0.6f}
        };

        for (uint8_t b = 0; b < COCHLEAR_BANDS; b++) {
            CochlearBand& band = bands[b];
            band.start_bin = map_bin((uint16_t)mappings[b][0]);
            band.end_bin = map_bin((uint16_t)mappings[b][1]);

            // Handle potential overlaps if FFT size is very small
            if (b > 0 && band.start_bin <= bands[b-1].end_bin) {
                band.start_bin = bands[b-1].end_bin + 1;
            }

            if (band.start_bin > band.end_bin || band.start_bin >= fft_size) {
                 band.bin_count = 0;
            } else {
               band.bin_count = band.end_bin - band.start_bin + 1;
            }

            // Initialize state
            band.gain = 1.0f;
            band.target_gain = 1.0f;
            band.attack_rate = COCHLEAR_ATTACK_RATE_BASE;
            band.release_rate = COCHLEAR_RELEASE_RATE_BASE;
            band.inv_compression_ratio = COCHLEAR_INV_RATIO_MILD;
            band.threshold_amplitude = mappings[b][2];

            band.history_index = 0;
            band.energy_mean = 0.0f;
            band.energy_variance = 0.0f;
            memset(band.energy_history, 0, sizeof(band.energy_history));
        }
    }

    // ========================================================================
    // STAGE 1: GLOBAL VU NORMALIZATION (Adapted for float input)
    // ========================================================================

    // Calculate mean squared energy
    float calculate_total_energy(const float* spectrum) {
        float total_energy = 0.0f;

        // NOTE: This loop is a candidate for ESP-DSP dsps_dotprod_f32 optimization
        for (uint16_t i = 0; i < fft_size; i++) {
            float mag = spectrum[i];
            total_energy += mag * mag;
        }

        return total_energy / fft_size;
    }

    void update_global_agc(const float* spectrum) {
        current_total_energy = calculate_total_energy(spectrum);

        // BOOTSTRAP FIX: On first call with real signal, initialize envelope immediately
        if (smoothed_input_energy < 1e-9f && current_total_energy > SILENCE_THRESHOLD_ENERGY) {
            smoothed_input_energy = current_total_energy;  // Jump-start envelope to prevent silence gate
        }

        // v2.1.1 FIX: Implement RMS Envelope Follower
        // 1. Update the envelope follower (Fast Smoothing)
        // Use asymmetrical attack/release rates for the envelope itself
        if (current_total_energy > smoothed_input_energy) {
            // Attack phase (react quickly to rising energy)
            IIR_SMOOTH_BY_RATE(smoothed_input_energy, current_total_energy, energy_smoothing_attack_rate);
        } else {
            // Release phase (react slightly slower to falling energy)
            IIR_SMOOTH_BY_RATE(smoothed_input_energy, current_total_energy, energy_smoothing_release_rate);
        }

        // 2. Handle silence (Gating) - Operate on smoothed energy
        if (smoothed_input_energy < SILENCE_THRESHOLD_ENERGY) {
            return; // Hold current gain
        }

        // 3. Calculate required gain based on smoothed energy
        float required_gain = sqrtf(target_energy / smoothed_input_energy);

        // Clamping
        required_gain = std::min(required_gain, max_gain_linear);
        // REMOVED: required_gain = std::max(required_gain, 1.0f); // Allows attenuation when needed

        // 4. Smooth gain changes (The actual slow AGC attack/release)
        if (required_gain > global_gain) {
            IIR_SMOOTH_BY_RATE(global_gain, required_gain, global_attack_rate);
        } else {
            IIR_SMOOTH_BY_RATE(global_gain, required_gain, global_release_rate);
        }
    }

    void apply_global_gain(float* spectrum) {
        // NOTE: This loop is a candidate for ESP-DSP dsps_mulc_f32 optimization
        for (uint16_t i = 0; i < fft_size; i++) {
            float result = spectrum[i] * global_gain;

            // Robust Hard Clipping
            if (result > 1.0f) {
                spectrum[i] = 1.0f;
            } else {
                spectrum[i] = result;
            }
        }
    }

    // ========================================================================
    // STAGE 2: ANALYSIS (Adapted for float input)
    // ========================================================================

    void update_cochlear_bands(const float* spectrum) {
        for (uint8_t b = 0; b < COCHLEAR_BANDS; b++) {
            calculate_band_energy(b, spectrum);
            update_band_statistics(b);
            update_band_target_gain(b);
            smooth_band_gain(b);
        }
    }

    void calculate_band_energy(uint8_t band_idx, const float* spectrum) {
        CochlearBand& band = bands[band_idx];
        if (band.bin_count == 0) return;

        float energy = 0.0f;

        // NOTE: This loop is a candidate for ESP-DSP dsps_dotprod_f32 optimization
        for (uint16_t i = band.start_bin; i <= band.end_bin; i++) {
            float mag = spectrum[i];
            energy += mag * mag;
        }

        // Mean energy (Mag^2)
        energy /= band.bin_count;

        // Store in history
        band.energy_history[band.history_index] = energy;
        band.history_index = (band.history_index + 1) % COCHLEAR_HISTORY_LENGTH;
    }

    // ========================================================================
    // STAGE 2: ANALYSIS (Statistics, Gain Calculation)
    // ========================================================================

    void update_band_statistics(uint8_t band_idx) {
        CochlearBand& band = bands[band_idx];

        // 1. Calculate mean energy
        float sum = 0.0f;
        for (uint8_t h = 0; h < COCHLEAR_HISTORY_LENGTH; h++) {
            sum += band.energy_history[h];
        }
        band.energy_mean = sum / COCHLEAR_HISTORY_LENGTH;

        // 2. Calculate variance
        float variance = 0.0f;
        for (uint8_t h = 0; h < COCHLEAR_HISTORY_LENGTH; h++) {
            float diff = band.energy_history[h] - band.energy_mean;
            variance += diff * diff;
        }
        band.energy_variance = variance / COCHLEAR_HISTORY_LENGTH;

        // 3. Adaptive rates (Variance-based adaptation)
        float variance_factor = 1.0f + (band.energy_variance * VARIANCE_ADAPTATION_FACTOR);
        variance_factor = std::min(variance_factor, COCHLEAR_ADAPTATION_MAX_SPEEDUP);

        band.attack_rate = std::min(1.0f, COCHLEAR_ATTACK_RATE_BASE * variance_factor);
        band.release_rate = std::min(1.0f, COCHLEAR_RELEASE_RATE_BASE * variance_factor);

        // 4. Adaptive compression
        // Thresholds based on Energy (0.7 VU^2=0.49, 0.4 VU^2=0.16)
        if (band.energy_mean > 0.49f) {
            band.inv_compression_ratio = COCHLEAR_INV_RATIO_HEAVY;
        } else if (band.energy_mean > 0.16f) {
            band.inv_compression_ratio = COCHLEAR_INV_RATIO_MODERATE;
        } else {
            band.inv_compression_ratio = COCHLEAR_INV_RATIO_MILD;
        }
    }

    void update_band_target_gain(uint8_t band_idx) {
        CochlearBand& band = bands[band_idx];
        const float target_band_energy = target_energy;

        if (band.energy_mean < SILENCE_THRESHOLD_ENERGY) {
            band.target_gain = 1.0f;
        } else {
            // Calculate amplitude gain required (requires sqrtf)
            float target = sqrtf(target_band_energy / band.energy_mean);

            // Limit band-specific gain (±12 dB range: 0.25x to 4.0x)
            band.target_gain = std::max(0.25f, std::min(target, 4.0f));
        }
    }

    void smooth_band_gain(uint8_t band_idx) {
        CochlearBand& band = bands[band_idx];

        if (band.target_gain > band.gain) {
            IIR_SMOOTH_BY_RATE(band.gain, band.target_gain, band.attack_rate);
        } else {
            IIR_SMOOTH_BY_RATE(band.gain, band.target_gain, band.release_rate);
        }
        band.gain = std::max(0.25f, std::min(band.gain, 4.0f));
    }

    // ========================================================================
    // STAGE 2: APPLICATION (Adapted for float output)
    // ========================================================================

    /**
     * Calculates the compressed output level (Quadratic Soft-Knee).
     */
    float calculate_compressed_level(float input, float inv_ratio, float threshold, float knee_width) {
        const float W = std::max(1e-6f, knee_width);
        const float knee_start = threshold - (W * 0.5f);
        const float knee_end = threshold + (W * 0.5f);

        if (input <= knee_start) {
            return input;
        }

        if (input >= knee_end) {
            // Output = T + (Input - T) * (1/R)
            return threshold + (input - threshold) * inv_ratio;
        }

        // In knee: Quadratic interpolation
        // Output = Input + ((1/R) - 1) * (Input - KneeStart)^2 / (2 * W)
        float excess = input - knee_start;
        float knee_factor = (inv_ratio - 1.0f) * (excess * excess) / (2.0f * W);
        return input + knee_factor;
    }

    void apply_band_processing(float* spectrum) {
        for (uint8_t b = 0; b < COCHLEAR_BANDS; b++) {
            const CochlearBand& band = bands[b];
            if (band.bin_count == 0) continue;

            for (uint16_t i = band.start_bin; i <= band.end_bin; i++) {
                float mag = spectrum[i];

                // 1. Apply band gain (Dynamic EQ)
                mag *= band.gain;

                // 2. Apply compression (Limiter)
                mag = calculate_compressed_level(
                    mag,
                    band.inv_compression_ratio,
                    band.threshold_amplitude,
                    KNEE_WIDTH
                );

                // Final safety clip
                if (mag > 1.0f) {
                    spectrum[i] = 1.0f;
                } else {
                    // Ensure magnitude is not negative
                    spectrum[i] = std::max(0.0f, mag);
                }
            }
        }
    }
};

#endif // COCHLEAR_AGC_H

#include "multi_scale_tempogram.h"
#include <cstring>
#include <algorithm>
#include <cmath>
#if __has_include(<esp_log.h>)
#include <esp_log.h>
#endif
#if __has_include(<esp_heap_caps.h>)
#include <esp_heap_caps.h>
#endif
#include <new>

static const char* TAG = "TEMPOGRAM";

// ============================================================================
// Constructor / Destructor
// ============================================================================

MultiScaleTemplogram::MultiScaleTemplogram()
    : num_tempo_bins(0)
    , min_bpm(0.0f)
    , max_bpm(0.0f)
    , tempogram(nullptr)
    , combined_tempogram(nullptr)
    , phase_matrix(nullptr)
    , phase_coherence(nullptr)
    , harmonic_matrix(nullptr) {
    
    for (int i = 0; i < NUM_SCALES; i++) {
        comb_banks[i] = nullptr;
        decimated_signals[i] = nullptr;
        decimated_lengths[i] = 0;
    }
}

MultiScaleTemplogram::~MultiScaleTemplogram() {
    // Clean up tempogram arrays
    if (tempogram) {
        for (int i = 0; i < NUM_SCALES; i++) {
            delete[] tempogram[i];
        }
        delete[] tempogram;
    }
    
    delete[] combined_tempogram;
    
    // Clean up phase arrays
    if (phase_matrix) {
        for (int i = 0; i < NUM_SCALES; i++) {
            delete[] phase_matrix[i];
        }
        delete[] phase_matrix;
    }
    
    delete[] phase_coherence;
    
    // Clean up comb filter banks
    for (int i = 0; i < NUM_SCALES; i++) {
        if (comb_banks[i]) {
            delete[] comb_banks[i]->filters;
            delete[] comb_banks[i]->periods;
            delete[] comb_banks[i]->weights;
            delete comb_banks[i];
        }
        delete[] decimated_signals[i];
    }

    // Clean up harmonic matrix
    if (harmonic_matrix) {
        for (int i = 0; i < num_tempo_bins; i++) {
            delete[] harmonic_matrix[i];
        }
        delete[] harmonic_matrix;
    }
}

// ============================================================================
// Initialization
// ============================================================================

bool MultiScaleTemplogram::init(int num_bins, float bpm_min, float bpm_max) {
    num_tempo_bins = num_bins;
    min_bpm = bpm_min;
    max_bpm = bpm_max;
    
    ESP_LOGI(TAG, "Initializing Multi-Scale Tempogram: %d bins, %.1f-%.1f BPM",
             num_tempo_bins, min_bpm, max_bpm);
    
    // Allocate tempogram arrays
    tempogram = new float*[NUM_SCALES];
    for (int i = 0; i < NUM_SCALES; i++) {
        tempogram[i] = new float[num_tempo_bins]();
    }
    
    combined_tempogram = new float[num_tempo_bins]();
    
    // Allocate phase arrays
    phase_matrix = new float*[NUM_SCALES];
    for (int i = 0; i < NUM_SCALES; i++) {
        phase_matrix[i] = new float[num_tempo_bins]();
    }
    
    phase_coherence = new float[num_tempo_bins]();
    
    // Initialize comb filter banks for each scale
    for (int i = 0; i < NUM_SCALES; i++) {
        comb_banks[i] = new (std::nothrow) CombFilterBank();
        init_comb_filters(i);
    }

    // Allocate all buffers in internal RAM
    for (int i = 0; i < NUM_SCALES; i++) {
        decimated_signals[i] = new (std::nothrow) float[2048]();
        if (!decimated_signals[i]) {
            ESP_LOGE(TAG, "Failed to allocate decimated_signals[%d] in internal RAM", i);
            return false;
        }
        decimated_lengths[i] = 2048;
    }

    // Attempt to allocate harmonic matrix in internal RAM; if it fails, disable harmonics gracefully
    harmonic_matrix = new (std::nothrow) float*[num_tempo_bins];
    if (!harmonic_matrix) {
        ESP_LOGW(TAG, "Insufficient internal RAM for harmonic_matrix pointer array; disabling harmonic boosts");
    } else {
        for (int i = 0; i < num_tempo_bins; i++) {
            harmonic_matrix[i] = new (std::nothrow) float[num_tempo_bins]();
            if (!harmonic_matrix[i]) {
                ESP_LOGW(TAG, "Insufficient internal RAM for harmonic_matrix[%d]; disabling harmonic boosts", i);
                // free any rows allocated so far
                for (int j = 0; j < i; j++) {
                    delete[] harmonic_matrix[j];
                }
                delete[] harmonic_matrix;
                harmonic_matrix = nullptr;
                break;
            }
        }
    }

    calculate_harmonic_relationships();

    ESP_LOGI(TAG, "Multi-Scale Tempogram initialized successfully (Internal RAM)");
    return true;
}

void MultiScaleTemplogram::reset() {
    // Clear all tempograms
    for (int i = 0; i < NUM_SCALES; i++) {
        if (tempogram && tempogram[i]) {
            memset(tempogram[i], 0, num_tempo_bins * sizeof(float));
        }
        if (phase_matrix && phase_matrix[i]) {
            memset(phase_matrix[i], 0, num_tempo_bins * sizeof(float));
        }
        if (decimated_signals[i]) {
            memset(decimated_signals[i], 0, 2048 * sizeof(float));
        }
    }
    
    if (combined_tempogram) {
        memset(combined_tempogram, 0, num_tempo_bins * sizeof(float));
    }
    if (phase_coherence) {
        memset(phase_coherence, 0, num_tempo_bins * sizeof(float));
    }
}

// ============================================================================
// Private Methods
// ============================================================================

void MultiScaleTemplogram::init_comb_filters(int scale_idx) {
    CombFilterBank* bank = comb_banks[scale_idx];
    float scale_ratio = SCALE_RATIOS[scale_idx];
    
    // Allocate arrays
    bank->periods = new int[num_tempo_bins]();
    bank->weights = new float[num_tempo_bins]();
    
    // Initialize each tempo's comb filter
    for (int t = 0; t < num_tempo_bins; t++) {
        float progress = (float)t / (num_tempo_bins - 1);
        float target_bpm = min_bpm + progress * (max_bpm - min_bpm);
        
        // Adjust BPM for this scale
        float scaled_bpm = target_bpm * scale_ratio;
        
        // Calculate period in samples (assuming 50Hz novelty rate)
        float period_seconds = 60.0f / scaled_bpm;
        bank->periods[t] = (int)(period_seconds * 50.0f);  // 50Hz novelty rate
        
        // Initialize adaptive weight
        bank->weights[t] = 1.0f;
    }
    
    ESP_LOGD(TAG, "Initialized comb filters for scale %d (ratio: %.1f)",
             scale_idx, scale_ratio);
}

void MultiScaleTemplogram::decimate_signal(const float* input, int input_length,
                                          float* output, int& output_length, 
                                          float ratio) {
    if (ratio >= 0.99f && ratio <= 1.01f) {
        // No decimation needed
        memcpy(output, input, input_length * sizeof(float));
        output_length = input_length;
        return;
    }
    
    if (ratio < 1.0f) {
        // Upsample (interpolate)
        int factor = (int)(1.0f / ratio);
        output_length = input_length * factor;
        
        for (int i = 0; i < input_length - 1; i++) {
            for (int j = 0; j < factor; j++) {
                float t = (float)j / factor;
                int out_idx = i * factor + j;
                if (out_idx < 4096) {  // Bounds check
                    output[out_idx] = input[i] * (1.0f - t) + input[i + 1] * t;
                }
            }
        }
    } else {
        // Downsample (decimate)
        int factor = (int)ratio;
        output_length = input_length / factor;
        
        for (int i = 0; i < output_length && i < 4096; i++) {
            output[i] = input[i * factor];
        }
    }
}

void MultiScaleTemplogram::apply_comb_filter(const float* signal, int length,
                                            int tempo_idx, int scale_idx,
                                            float& magnitude, float& phase) {
    CombFilterBank* bank = comb_banks[scale_idx];
    int period = bank->periods[tempo_idx];
    
    if (period <= 0 || period >= length) {
        magnitude = 0.0f;
        phase = 0.0f;
        return;
    }
    
    // Apply resonant comb filter
    float energy = 0.0f;
    float phase_sum_x = 0.0f;
    float phase_sum_y = 0.0f;
    
    // Check multiple periods for stronger detection
    int num_periods = std::min(4, length / period);
    
    for (int p = 0; p < num_periods; p++) {
        int idx = p * period;
        if (idx < length) {
            float weight = expf(-0.5f * p);  // Exponential decay
            energy += signal[idx] * weight;
            
            // Track phase using complex representation
            float phase_angle = 2.0f * M_PI * p;
            phase_sum_x += cosf(phase_angle) * signal[idx] * weight;
            phase_sum_y += sinf(phase_angle) * signal[idx] * weight;
        }
    }
    
    magnitude = energy / num_periods;
    phase = atan2f(phase_sum_y, phase_sum_x);
}

void MultiScaleTemplogram::calculate_harmonic_relationships() {
    // Build harmonic relationship matrix (optional)
    if (!harmonic_matrix) {
        ESP_LOGW(TAG, "Harmonic matrix disabled; skipping harmonic relationship precompute");
        return;
    }
    for (int i = 0; i < num_tempo_bins; i++) {
        float progress_i = (float)i / (num_tempo_bins - 1);
        float bpm_i = min_bpm + progress_i * (max_bpm - min_bpm);
        
        for (int j = 0; j < num_tempo_bins; j++) {
            float progress_j = (float)j / (num_tempo_bins - 1);
            float bpm_j = min_bpm + progress_j * (max_bpm - min_bpm);
            
            float ratio = bpm_i / bpm_j;
            
            // Check for harmonic relationships
            float harmonic_score = 0.0f;
            
            // Octave (2:1)
            if (fabsf(ratio - 2.0f) < 0.05f || fabsf(ratio - 0.5f) < 0.05f) {
                harmonic_score = 1.0f;
            }
            // Perfect fifth (3:2)
            else if (fabsf(ratio - 1.5f) < 0.05f || fabsf(ratio - 0.667f) < 0.05f) {
                harmonic_score = 0.8f;
            }
            // Perfect fourth (4:3)
            else if (fabsf(ratio - 1.333f) < 0.05f || fabsf(ratio - 0.75f) < 0.05f) {
                harmonic_score = 0.7f;
            }
            
            harmonic_matrix[i][j] = harmonic_score;
        }
    }
}

void MultiScaleTemplogram::combine_scales_with_coherence() {
    // Clear combined tempogram
    memset(combined_tempogram, 0, num_tempo_bins * sizeof(float));
    
    // For each tempo bin
    for (int t = 0; t < num_tempo_bins; t++) {
        // Calculate phase coherence across scales
        float coherence = calculate_phase_coherence_score(t);
        phase_coherence[t] = coherence;
        
        // Combine tempograms with coherence weighting
        float sum = 0.0f;
        float weight_sum = 0.0f;
        
        for (int s = 0; s < NUM_SCALES; s++) {
            float scale_weight = 1.0f;
            
            // Weight by scale (prefer original scale)
            if (s == 1) {  // Original scale (1.0x)
                scale_weight = 1.2f;
            }
            
            // Weight by coherence
            scale_weight *= (0.5f + 0.5f * coherence);
            
            sum += tempogram[s][t] * scale_weight;
            weight_sum += scale_weight;
        }
        
        combined_tempogram[t] = (weight_sum > 0) ? (sum / weight_sum) : 0.0f;
        
        // Boost tempos with harmonic support (if available)
        if (harmonic_matrix) {
            float harmonic_boost = 0.0f;
            for (int h = 0; h < num_tempo_bins; h++) {
                if (h != t) {
                    harmonic_boost += combined_tempogram[h] * harmonic_matrix[t][h];
                }
            }
            combined_tempogram[t] *= (1.0f + 0.2f * harmonic_boost);
        }
    }
}

float MultiScaleTemplogram::calculate_phase_coherence_score(int tempo_idx) {
    // Calculate phase coherence across scales
    float phase_sum_x = 0.0f;
    float phase_sum_y = 0.0f;
    
    for (int s = 0; s < NUM_SCALES; s++) {
        float phase = phase_matrix[s][tempo_idx];
        phase_sum_x += cosf(phase);
        phase_sum_y += sinf(phase);
    }
    
    // Coherence is the magnitude of the average phasor
    float coherence = sqrtf(phase_sum_x * phase_sum_x + 
                           phase_sum_y * phase_sum_y) / NUM_SCALES;
    
    return coherence;
}

// ============================================================================
// Public Methods
// ============================================================================

void MultiScaleTemplogram::process_novelty_curve(const float* novelty, int length) {
    // Process at each scale
    for (int s = 0; s < NUM_SCALES; s++) {
        // Decimate signal for this scale
        decimate_signal(novelty, length, 
                       decimated_signals[s], decimated_lengths[s],
                       SCALE_RATIOS[s]);
        
        // Apply comb filters at this scale
        for (int t = 0; t < num_tempo_bins; t++) {
            float magnitude, phase;
            apply_comb_filter(decimated_signals[s], decimated_lengths[s],
                            t, s, magnitude, phase);
            
            tempogram[s][t] = magnitude;
            phase_matrix[s][t] = phase;
        }
    }
    
    // Combine scales with phase coherence weighting
    combine_scales_with_coherence();
}

void MultiScaleTemplogram::get_combined_tempogram(float* output) {
    if (combined_tempogram && output) {
        memcpy(output, combined_tempogram, num_tempo_bins * sizeof(float));
    }
}

float MultiScaleTemplogram::get_phase_at_tempo(int tempo_idx) const {
    if (tempo_idx < 0 || tempo_idx >= num_tempo_bins) {
        return 0.0f;
    }
    
    // Return phase from the original scale (scale index 1)
    return phase_matrix[1][tempo_idx];
}

float MultiScaleTemplogram::get_coherence_at_tempo(int tempo_idx) const {
    if (tempo_idx < 0 || tempo_idx >= num_tempo_bins) {
        return 0.0f;
    }
    
    return phase_coherence[tempo_idx];
}

void MultiScaleTemplogram::get_scale_tempogram(int scale_idx, float* output) {
    if (scale_idx >= 0 && scale_idx < NUM_SCALES && tempogram && output) {
        memcpy(output, tempogram[scale_idx], num_tempo_bins * sizeof(float));
    }
}

void MultiScaleTemplogram::find_tempo_peaks(int* peak_indices, float* peak_values, 
                                           int max_peaks) {
    // Simple peak detection
    int peaks_found = 0;
    
    for (int t = 1; t < num_tempo_bins - 1 && peaks_found < max_peaks; t++) {
        // Check if local maximum
        if (combined_tempogram[t] > combined_tempogram[t - 1] &&
            combined_tempogram[t] > combined_tempogram[t + 1]) {
            
            peak_indices[peaks_found] = t;
            peak_values[peaks_found] = combined_tempogram[t];
            peaks_found++;
        }
    }
    
    // Sort peaks by magnitude (descending)
    for (int i = 0; i < peaks_found - 1; i++) {
        for (int j = i + 1; j < peaks_found; j++) {
            if (peak_values[j] > peak_values[i]) {
                // Swap
                std::swap(peak_values[i], peak_values[j]);
                std::swap(peak_indices[i], peak_indices[j]);
            }
        }
    }
}

bool MultiScaleTemplogram::check_harmonic_relation(int tempo_idx1, int tempo_idx2, 
                                                  float tolerance) {
    if (tempo_idx1 < 0 || tempo_idx1 >= num_tempo_bins ||
        tempo_idx2 < 0 || tempo_idx2 >= num_tempo_bins) {
        return false;
    }
    if (harmonic_matrix) {
        float score = harmonic_matrix[tempo_idx1][tempo_idx2];
        return score > (1.0f - tolerance);
    }
    // Fallback: compute simple ratio-based harmonic relation on the fly
    float progress1 = (float)tempo_idx1 / (num_tempo_bins - 1);
    float bpm1 = min_bpm + progress1 * (max_bpm - min_bpm);
    float progress2 = (float)tempo_idx2 / (num_tempo_bins - 1);
    float bpm2 = min_bpm + progress2 * (max_bpm - min_bpm);
    float ratio = bpm1 / bpm2;
    if (fabsf(ratio - 2.0f) < tolerance || fabsf(ratio - 0.5f) < tolerance) return true;
    if (fabsf(ratio - 1.5f) < tolerance || fabsf(ratio - 0.667f) < tolerance) return true;
    if (fabsf(ratio - 1.333f) < tolerance || fabsf(ratio - 0.75f) < tolerance) return true;
    return false;
}

float MultiScaleTemplogram::get_tempo_stability(int tempo_idx, int history_frames) {
    // Placeholder for tempo stability calculation
    // Would need to maintain history of tempogram values
    
    if (tempo_idx < 0 || tempo_idx >= num_tempo_bins) {
        return 0.0f;
    }
    
    // For now, return phase coherence as proxy for stability
    return phase_coherence[tempo_idx];
}

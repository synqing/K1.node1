// ============================================================================
// ONSET DETECTION IMPLEMENTATION
// ============================================================================

#include "onset_detection.h"
#include "logging/logger.h"
#include <cmath>
#include <algorithm>
#include <cstring>

// Global instance
OnsetDetector* g_onset_detector = nullptr;

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

void init_onset_detection(float fps, float nyquist_hz, uint16_t num_spectrum_bins) {
    if (g_onset_detector) delete g_onset_detector;
    g_onset_detector = new OnsetDetector();
    g_onset_detector->init(fps, nyquist_hz, num_spectrum_bins);
}

void update_onset_detection(const float* spectrum, uint32_t num_bins, float vu_level) {
    if (g_onset_detector) {
        g_onset_detector->update(spectrum, num_bins, vu_level);
    }
}

uint32_t get_detected_bpm() {
    return g_onset_detector ? g_onset_detector->get_bpm() : 0;
}

float get_detected_bpm_confidence() {
    return g_onset_detector ? g_onset_detector->get_bpm_confidence() : 0.0f;
}

void log_onset_diagnostics() {
    if (!g_onset_detector) return;
    OnsetDetector::DiagnosticsSnapshot diag;
    if (g_onset_detector->get_diagnostics(&diag)) {
        LOG_INFO(TAG_ONSET, "ONSET DETECTION DIAGNOSTICS:");
        LOG_INFO(TAG_ONSET, "  Spectral Flux: %.6f (normalized: %.6f)", 
                 diag.spectral_flux, diag.spectral_flux_normalized);
        LOG_INFO(TAG_ONSET, "  Adaptive Threshold: %.6f", diag.adaptive_threshold);
        LOG_INFO(TAG_ONSET, "  Detected Onsets: %u", diag.onset_count);
        LOG_INFO(TAG_ONSET, "  Estimated BPM: %u (confidence: %.2f)", 
                 diag.estimated_bpm, diag.correlation_strength);
        LOG_INFO(TAG_ONSET, "  Spectral Peaks: [%.4f, %.4f, %.4f, %.4f]",
                 diag.spectral_peaks[0], diag.spectral_peaks[1],
                 diag.spectral_peaks[2], diag.spectral_peaks[3]);
    }
}

// ============================================================================
// ONSET DETECTOR IMPLEMENTATION
// ============================================================================

OnsetDetector::OnsetDetector()
    : spectrum_current_(nullptr),
      spectrum_prev_frame_(nullptr),
      spectrum_prev_prev_frame_(nullptr),
      spectrum_whitened_(nullptr),
      onset_history_index_(0),
      onset_count_(0),
      spectral_flux_(0.0f),
      spectral_flux_normalized_(0.0f),
      adaptive_threshold_(0.01f),
      onset_strength_(0.0f),
      detected_onset_this_frame_(false),
      frames_since_last_onset_(0),
      last_onset_frame_(0),
      noise_floor_estimate_(0.001f),
      noise_floor_smooth_(0.001f),
      low_energy_frame_count_(0),
      current_bpm_(0),
      bpm_confidence_(0.0f),
      frames_processed_(0),
      diagnostics_enabled_(true) {
    
    memset(&config_, 0, sizeof(config_));
    memset(onset_history_, 0, sizeof(onset_history_));
    memset(spectral_peaks_, 0, sizeof(spectral_peaks_));
    memset(spectral_flux_history_, 0, sizeof(spectral_flux_history_));
}

OnsetDetector::~OnsetDetector() {
    if (spectrum_current_) delete[] spectrum_current_;
    if (spectrum_prev_frame_) delete[] spectrum_prev_frame_;
    if (spectrum_prev_prev_frame_) delete[] spectrum_prev_prev_frame_;
    if (spectrum_whitened_) delete[] spectrum_whitened_;
}

bool OnsetDetector::init(float fps, float nyquist_hz, uint16_t num_spectrum_bins) {
    config_.fps = fps;
    config_.nyquist_hz = nyquist_hz;
    config_.num_spectrum_bins = num_spectrum_bins;
    config_.sensitivity = 0.5f;
    config_.noise_floor = 0.001f;
    config_.bpm_hysteresis = 3;

    spectrum_current_ = new float[num_spectrum_bins];
    spectrum_prev_frame_ = new float[num_spectrum_bins];
    spectrum_prev_prev_frame_ = new float[num_spectrum_bins];
    spectrum_whitened_ = new float[num_spectrum_bins];

    if (!spectrum_current_ || !spectrum_prev_frame_ || !spectrum_prev_prev_frame_ || !spectrum_whitened_) {
        return false;
    }

    memset(spectrum_current_, 0, sizeof(float) * num_spectrum_bins);
    memset(spectrum_prev_frame_, 0, sizeof(float) * num_spectrum_bins);
    memset(spectrum_prev_prev_frame_, 0, sizeof(float) * num_spectrum_bins);
    memset(spectrum_whitened_, 0, sizeof(float) * num_spectrum_bins);

    reset();
    return true;
}

void OnsetDetector::reset() {
    memset(onset_history_, 0, sizeof(onset_history_));
    onset_history_index_ = 0;
    onset_count_ = 0;
    frames_processed_ = 0;
    current_bpm_.store(0, std::memory_order_relaxed);
    bpm_confidence_.store(0.0f, std::memory_order_relaxed);
    spectral_flux_ = 0.0f;
    adaptive_threshold_ = 0.01f;
    frames_since_last_onset_ = 0;
}

void OnsetDetector::set_onset_sensitivity(float sensitivity) {
    config_.sensitivity = fmax(0.0f, fmin(1.0f, sensitivity));
}

void OnsetDetector::set_noise_floor(float floor) {
    config_.noise_floor = fmax(0.0001f, floor);
}

void OnsetDetector::set_bpm_hysteresis(uint32_t bpm_drift) {
    config_.bpm_hysteresis = fmax(1u, bpm_drift);
}

// ============================================================================
// MAIN PROCESSING PIPELINE
// ============================================================================

void OnsetDetector::update(const float* spectrum, uint32_t num_bins, float vu_level) {
    frames_processed_++;
    frames_since_last_onset_++;
    detected_onset_this_frame_ = false;
    onset_strength_ = 0.0f;

    // Stage 1: Copy spectrum and calculate energy
    memcpy(spectrum_current_, spectrum, sizeof(float) * fmin(num_bins, config_.num_spectrum_bins));

    // Stage 2: Spectral peak detection
    stage1_spectral_analysis(spectrum, num_bins);
    stage2_peak_detection();

    // Stage 3: Calculate spectral flux (multi-scale)
    stage3_flux_calculation();

    // Stage 4: Adaptive thresholding
    stage4_adaptive_thresholding(vu_level);

    // Stage 5: Onset detection with hysteresis
    stage5_onset_detection();

    // Stage 6: BPM correlation
    if (onset_count_ >= ONSET_CORRELATION_WINDOW) {
        stage6_bpm_correlation();
    }

    // Shift history
    memcpy(spectrum_prev_prev_frame_, spectrum_prev_frame_, sizeof(float) * config_.num_spectrum_bins);
    memcpy(spectrum_prev_frame_, spectrum_current_, sizeof(float) * config_.num_spectrum_bins);
}

// ============================================================================
// STAGE 1: SPECTRAL ANALYSIS
// ============================================================================

void OnsetDetector::stage1_spectral_analysis(const float* spectrum, uint32_t num_bins) {
    // Apply spectral whitening (emphasis on transients)
    // Flatten energy across frequency to avoid low-freq bias
    for (uint32_t i = 0; i < fmin(num_bins, config_.num_spectrum_bins); i++) {
        float whitening_filter = calculate_spectral_whitening_filter(i);
        spectrum_whitened_[i] = spectrum[i] * whitening_filter;
    }
}

float OnsetDetector::calculate_spectral_whitening_filter(uint32_t bin_idx) {
    // Boost mid-high frequencies where percussion typically lives
    // Attenuate sub-bass (less percussive) and ultra-high (noise)
    
    float normalized_bin = static_cast<float>(bin_idx) / config_.num_spectrum_bins;
    
    // Bell curve centered around 0.4 (low-mids to mids)
    // Suppress < 10% and > 90% of spectrum
    float center = 0.35f;
    float width = 0.25f;
    
    float deviation = fabs(normalized_bin - center);
    float whitening = 1.0f - (deviation / width);
    whitening = fmax(0.2f, fmin(1.0f, whitening));  // Clamp [0.2, 1.0]
    
    return whitening;
}

// ============================================================================
// STAGE 2: SPECTRAL PEAK DETECTION
// ============================================================================

void OnsetDetector::stage2_peak_detection() {
    // Find strongest spectral peaks (for tracking transients)
    for (int p = 0; p < SPECTRAL_PEAK_COUNT; p++) {
        spectral_peaks_[p].magnitude = 0.0f;
        spectral_peaks_[p].bin_index = 0;
    }

    for (uint16_t i = 1; i < config_.num_spectrum_bins - 1; i++) {
        // Local peak detection
        if (spectrum_whitened_[i] > spectrum_whitened_[i - 1] &&
            spectrum_whitened_[i] > spectrum_whitened_[i + 1]) {
            
            // Insert into peak list (sorted)
            for (int p = 0; p < SPECTRAL_PEAK_COUNT; p++) {
                if (spectrum_whitened_[i] > spectral_peaks_[p].magnitude) {
                    // Shift lower peaks down
                    for (int j = SPECTRAL_PEAK_COUNT - 1; j > p; j--) {
                        spectral_peaks_[j] = spectral_peaks_[j - 1];
                    }
                    spectral_peaks_[p].bin_index = i;
                    spectral_peaks_[p].magnitude = spectrum_whitened_[i];
                    break;
                }
            }
        }
    }

    // Calculate peak novelty (how much peaks changed since last frame)
    for (int p = 0; p < SPECTRAL_PEAK_COUNT; p++) {
        float prev_mag = 0.0f;
        if (spectral_peaks_[p].bin_index > 0 && spectral_peaks_[p].bin_index < config_.num_spectrum_bins) {
            prev_mag = spectrum_prev_frame_[spectral_peaks_[p].bin_index];
        }
        
        float delta = spectral_peaks_[p].magnitude - prev_mag;
        spectral_peaks_[p].peak_novelty = fmax(0.0f, delta);
    }
}

// ============================================================================
// STAGE 3: FLUX CALCULATION
// ============================================================================

void OnsetDetector::stage3_flux_calculation() {
    // Multi-scale spectral flux
    // Measure energy increase across spectrum, weighted by peaks
    
    float total_flux = 0.0f;
    float peak_flux = 0.0f;

    // Broad spectral flux (all bins)
    for (uint16_t i = 0; i < config_.num_spectrum_bins; i++) {
        float delta = spectrum_whitened_[i] - spectrum_prev_frame_[i];
        if (delta > 0.0f) {
            total_flux += delta;
        }
    }
    total_flux /= config_.num_spectrum_bins;

    // Peak-weighted flux (peaks contribute more)
    for (int p = 0; p < SPECTRAL_PEAK_COUNT; p++) {
        peak_flux += spectral_peaks_[p].peak_novelty;
    }
    peak_flux /= SPECTRAL_PEAK_COUNT;

    // Combined flux: 70% broad, 30% peaks (peaks catch transients)
    spectral_flux_ = (total_flux * 0.7f) + (peak_flux * 0.3f);

    // Update flux history
    for (int i = 15; i > 0; i--) {
        spectral_flux_history_[i] = spectral_flux_history_[i - 1];
    }
    spectral_flux_history_[0] = spectral_flux_;
}

// ============================================================================
// STAGE 4: ADAPTIVE THRESHOLDING
// ============================================================================

void OnsetDetector::stage4_adaptive_thresholding(float vu_level) {
    update_adaptive_threshold(vu_level);
    
    // Normalize flux against threshold
    spectral_flux_normalized_ = fmax(0.0f, spectral_flux_ - adaptive_threshold_);
    
    // If normalized, map to 0-1 range
    float recent_max = *std::max_element(spectral_flux_history_, spectral_flux_history_ + 16);
    if (recent_max > adaptive_threshold_) {
        spectral_flux_normalized_ /= (recent_max - adaptive_threshold_);
    }
    spectral_flux_normalized_ = fmin(1.0f, spectral_flux_normalized_);
}

void OnsetDetector::update_adaptive_threshold(float vu_level) {
    // Threshold = noise floor + sensitivity offset
    // Adapts to silence vs loud sections
    
    // Update noise floor estimate
    noise_floor_estimate_ = *std::min_element(spectral_flux_history_, spectral_flux_history_ + 16);
    noise_floor_smooth_ = noise_floor_smooth_ * 0.95f + noise_floor_estimate_ * 0.05f;
    
    // Track low-energy periods
    if (vu_level < 0.05f) {
        low_energy_frame_count_++;
    } else {
        low_energy_frame_count_ = 0;
    }

    // Base threshold: noise floor + offset
    float base_threshold = noise_floor_smooth_ + config_.noise_floor;

    // Adjust for sensitivity (0.0 = very sensitive, 1.0 = very strict)
    float sensitivity_offset = (1.0f - config_.sensitivity) * base_threshold * 2.0f;
    
    // Adjust for VU level (louder = higher threshold to avoid false positives)
    float vu_scale = 1.0f + (vu_level * 0.5f);
    
    adaptive_threshold_ = (base_threshold + sensitivity_offset) * vu_scale;
    adaptive_threshold_ = fmax(0.0001f, fmin(0.1f, adaptive_threshold_));
}

// ============================================================================
// STAGE 5: ONSET DETECTION WITH HYSTERESIS
// ============================================================================

void OnsetDetector::stage5_onset_detection() {
    // Onset occurs when:
    // 1. Normalized flux exceeds threshold
    // 2. Minimum interval since last onset (prevents doubles)
    // 3. VU level indicates actual audio
    
    const float onset_trigger_threshold = 0.3f;  // Normalized flux > 0.3 = onset
    const uint32_t min_interval = MIN_ONSET_INTERVAL_FRAMES;
    
    if (spectral_flux_normalized_ > onset_trigger_threshold &&
        frames_since_last_onset_ > min_interval) {
        
        // Record onset
        detected_onset_this_frame_ = true;
        onset_strength_ = spectral_flux_normalized_;
        
        // Add to history
        onset_history_[onset_history_index_] = frames_processed_;
        onset_history_index_ = (onset_history_index_ + 1) % ONSET_HISTORY_SIZE;
        onset_count_ = fmin(onset_count_ + 1, static_cast<uint32_t>(ONSET_HISTORY_SIZE));
        
        frames_since_last_onset_ = 0;
        last_onset_frame_ = frames_processed_;
    }
}

// ============================================================================
// STAGE 6: BPM CORRELATION
// ============================================================================

void OnsetDetector::stage6_bpm_correlation() {
    uint32_t estimated_bpm = find_best_tempo_hypothesis();

    if (estimated_bpm > 0) {
        // Apply hysteresis (don't jump BPM unless significantly different)
        if (current_bpm_.load(std::memory_order_relaxed) == 0) {
            // First detection
            current_bpm_.store(estimated_bpm, std::memory_order_relaxed);
        } else {
            int32_t bpm_diff = abs((int32_t)estimated_bpm - (int32_t)current_bpm_.load(std::memory_order_relaxed));
            if (bpm_diff <= config_.bpm_hysteresis) {
                // Within hysteresis band - update
                current_bpm_.store(estimated_bpm, std::memory_order_relaxed);
            }
            // else: reject change (too large a jump)
        }
    }

    // Calculate confidence
    bpm_confidence_.store(calculate_tempo_confidence(current_bpm_.load(std::memory_order_relaxed)), std::memory_order_relaxed);
}

struct TempoHypothesis {
    uint32_t bpm;
    float score;
};

uint32_t OnsetDetector::find_best_tempo_hypothesis() {
    if (onset_count_ < 4) return 0;  // Need at least 4 onsets

    // Find top 3 tempo candidates
    TempoHypothesis candidates[3];
    candidates[0] = {0, 0.0f};
    candidates[1] = {0, 0.0f};
    candidates[2] = {0, 0.0f};

    // Sweep BPM range and score each candidate
    for (uint32_t bpm = BPM_SEARCH_MIN; bpm <= BPM_SEARCH_MAX; bpm += BPM_SEARCH_RESOLUTION) {
        float score = autocorrelate_tempo(bpm);

        // Insert into top 3 if score is high enough
        if (score > candidates[2].score) {
            if (score > candidates[1].score) {
                if (score > candidates[0].score) {
                    // New #1
                    candidates[2] = candidates[1];
                    candidates[1] = candidates[0];
                    candidates[0] = {bpm, score};
                } else {
                    // New #2
                    candidates[2] = candidates[1];
                    candidates[1] = {bpm, score};
                }
            } else {
                // New #3
                candidates[2] = {bpm, score};
            }
        }

        // Early exit if we find a very strong candidate
        if (score > 0.9f) {
            break;
        }
    }

    // Apply octave error handling
    // Check if any two candidates are in 2:1 ratio (octave relationship)
    for (int i = 0; i < 2; i++) {
        for (int j = i+1; j < 3; j++) {
            if (candidates[i].bpm == 0 || candidates[j].bpm == 0) continue;

            float ratio = (float)candidates[i].bpm / candidates[j].bpm;

            // Check for octave relationship (ratio ≈ 2.0)
            if (fabs(ratio - 2.0f) < 0.08f) {  // Within 8%
                // If scores are similar (within 0.15), prefer higher tempo
                float score_diff = fabs(candidates[i].score - candidates[j].score);
                if (score_diff < 0.15f) {
                    // Boost higher tempo, penalize lower
                    if (candidates[i].bpm > candidates[j].bpm) {
                        candidates[i].score *= 1.25f;  // Boost faster tempo
                        candidates[j].score *= 0.7f;   // Penalize slower
                    } else {
                        candidates[j].score *= 1.25f;
                        candidates[i].score *= 0.7f;
                    }
                }
            }

            // Check for 3:2 relationship (triplet feel vs straight)
            if (fabs(ratio - 1.5f) < 0.08f) {
                // Slightly prefer simpler ratio (straight feel)
                if (candidates[i].bpm > candidates[j].bpm) {
                    candidates[j].score *= 0.95f;
                } else {
                    candidates[i].score *= 0.95f;
                }
            }
        }
    }

    // Re-sort after octave adjustments
    // Simple bubble sort (only 3 elements)
    for (int pass = 0; pass < 2; pass++) {
        for (int i = 0; i < 2; i++) {
            if (candidates[i+1].score > candidates[i].score) {
                TempoHypothesis temp = candidates[i];
                candidates[i] = candidates[i+1];
                candidates[i+1] = temp;
            }
        }
    }

    // Return best candidate
    return candidates[0].bpm;
}

#define ONSET_STRENGTH_WINDOW 256  // 2.56 seconds @ 100 FPS

float OnsetDetector::autocorrelate_tempo(uint32_t candidate_bpm) {
    // Convert BPM to lag in frames
    float bps = candidate_bpm / 60.0f;
    float frames_per_beat = config_.fps / bps;
    int lag = (int)(frames_per_beat + 0.5f);

    // Safety check
    if (lag <= 0 || lag >= ONSET_STRENGTH_WINDOW) {
        return 0.0f;
    }

    // Build onset strength function from recent history
    // This is a sparse binary representation: 1.0 where onsets occurred, 0.0 elsewhere
    float onset_strength[ONSET_STRENGTH_WINDOW];
    memset(onset_strength, 0, sizeof(onset_strength));

    // Mark onset frames with strength 1.0
    // More recent onsets are more reliable
    for (uint32_t i = 0; i < onset_count_; i++) {
        uint32_t onset_frame = onset_history_[i];
        uint32_t frame_age = frames_processed_ - onset_frame;

        if (frame_age < ONSET_STRENGTH_WINDOW) {
            int idx = ONSET_STRENGTH_WINDOW - 1 - frame_age;
            if (idx >= 0 && idx < ONSET_STRENGTH_WINDOW) {
                // Time-weighted: recent onsets count more
                float time_weight = 1.0f - (frame_age / (float)ONSET_STRENGTH_WINDOW * 0.3f);
                onset_strength[idx] = time_weight;
            }
        }
    }

    // Calculate autocorrelation at this lag
    float autocorr = 0.0f;
    int valid_samples = 0;

    for (int t = lag; t < ONSET_STRENGTH_WINDOW; t++) {
        autocorr += onset_strength[t] * onset_strength[t - lag];
        valid_samples++;
    }

    if (valid_samples > 0) {
        autocorr /= valid_samples;
    }

    // Normalize by zero-lag autocorrelation (signal energy)
    // This makes the correlation independent of onset density
    float energy = 0.0f;
    for (int t = 0; t < ONSET_STRENGTH_WINDOW; t++) {
        energy += onset_strength[t] * onset_strength[t];
    }

    if (energy > 0.001f) {
        autocorr /= (energy / ONSET_STRENGTH_WINDOW);
    } else {
        // No energy = no correlation
        return 0.0f;
    }

    // Boost score slightly for tempos in "sweet spot" (100-140 BPM)
    // This reflects human perceptual preferences
    float perceptual_weight = 1.0f;
    if (candidate_bpm >= 100 && candidate_bpm <= 140) {
        perceptual_weight = 1.1f;
    } else if (candidate_bpm >= 80 && candidate_bpm < 100) {
        perceptual_weight = 1.05f;
    } else if (candidate_bpm > 140 && candidate_bpm <= 160) {
        perceptual_weight = 1.05f;
    }

    return autocorr * perceptual_weight;
}

// ============================================================================
// CONFIDENCE CALCULATION
// ============================================================================

float OnsetDetector::calculate_tempo_confidence(uint32_t bpm) {
    if (bpm == 0) return 0.0f;

    // Base confidence on autocorrelation score
    float base_confidence = autocorrelate_tempo(bpm);

    // Boost confidence if we have many onsets (more data = more reliable)
    float data_confidence = fmin(1.0f, onset_count_ / 16.0f);

    // Reduce confidence if we just started tracking (need time to stabilize)
    float time_confidence = fmin(1.0f, frames_since_last_onset_ / 20.0f);

    // Combined confidence
    float confidence = base_confidence * 0.7f + data_confidence * 0.2f + time_confidence * 0.1f;

    return fmin(1.0f, confidence);
}

// ============================================================================
// DIAGNOSTICS
// ============================================================================

bool OnsetDetector::get_diagnostics(DiagnosticsSnapshot* out) {
    if (!out) return false;
    
    out->spectral_flux = spectral_flux_;
    out->spectral_flux_normalized = spectral_flux_normalized_;
    out->adaptive_threshold = adaptive_threshold_;
    out->onset_count = onset_count_;
    out->estimated_bpm = current_bpm_;
    out->correlation_strength = bpm_confidence_;

    for (int i = 0; i < SPECTRAL_PEAK_COUNT; i++) {
        out->spectral_peaks[i] = spectral_peaks_[i].magnitude;
    }

    for (int i = 0; i < ONSET_CORRELATION_WINDOW; i++) {
        int idx = (onset_history_index_ - ONSET_CORRELATION_WINDOW + i + ONSET_HISTORY_SIZE) % ONSET_HISTORY_SIZE;
        out->last_16_onsets[i] = onset_history_[idx];
    }

    return true;
}
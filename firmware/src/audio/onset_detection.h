// ============================================================================
// ONSET DETECTION SYSTEM - Professional Beat Detection for K1 Lightwave
// ============================================================================
// 
// Architecture:
//   1. Spectral Peak Detection: Identify percussive transients across spectrum
//   2. Energy Flux Analysis: Multi-scale spectral change detection
//   3. Adaptive Thresholding: Dynamic floor based on noise floor + history
//   4. Hysteresis Filtering: Prevent double-triggers and noise
//   5. Beat Correlation: Match detected onsets to candidate BPMs
//
// Expected Performance:
//   - Onset detection latency: 20-50ms (1-2 frames @ 50 Hz)
//   - BPM lock-in: 1-3 seconds with 8-16 detected onsets
//   - Accuracy: ±2 BPM on clear beats
//   - Robustness: Handles competing rhythms, percussion layers
//
// Integration:
//   - Call onset_detector.update() every audio frame
//   - Call onset_detector.query_bpm() periodically (every 500ms)
//   - Use onset_detector.is_beat() for visualization triggers
//
// ============================================================================

#pragma once

#include <stdint.h>
#include <cmath>
#include <cstring>
#include <algorithm>
#include <atomic>

#define ONSET_HISTORY_SIZE 32          // Ring buffer for onset frame numbers
#define ONSET_CORRELATION_WINDOW 16    // How many recent onsets to use for BPM
#define MIN_ONSET_INTERVAL_FRAMES 8    // Prevent double-triggers (8 frames @ 50 Hz = 160ms)
#define SPECTRAL_PEAK_COUNT 8          // Number of spectral peaks to track
#define BPM_SEARCH_MIN 50              // Minimum BPM to consider
#define BPM_SEARCH_MAX 150             // Maximum BPM to consider
#define BPM_SEARCH_RESOLUTION 1        // Step size (1 BPM = fine resolution)

// ============================================================================
// ONSET DETECTOR CLASS
// ============================================================================

class OnsetDetector {
public:
    OnsetDetector();
    ~OnsetDetector();

    // Initialization
    bool init(float fps, float nyquist_hz, uint16_t num_spectrum_bins);
    void reset();

    // Main processing pipeline
    void update(const float* spectrum, uint32_t num_bins, float vu_level);

    // Query results (atomic loads for dual-core safety)
    bool is_beat() const { return detected_onset_this_frame_; }
    float get_onset_strength() const { return onset_strength_; }
    uint32_t get_bpm() const { return current_bpm_.load(std::memory_order_relaxed); }
    float get_bpm_confidence() const { return bpm_confidence_.load(std::memory_order_relaxed); }
    uint32_t get_frames_since_last_onset() const { return frames_since_last_onset_; }

    // Tuning parameters
    void set_onset_sensitivity(float sensitivity);  // 0.0-1.0, default 0.5
    void set_noise_floor(float floor);              // Spectral energy floor
    void set_bpm_hysteresis(uint32_t bpm_drift);   // Lock hysteresis (default 3 BPM)

    // Diagnostics
    struct DiagnosticsSnapshot {
        float spectral_flux;
        float spectral_flux_normalized;
        float spectral_peaks[SPECTRAL_PEAK_COUNT];
        float adaptive_threshold;
        uint32_t onset_count;
        uint32_t last_16_onsets[ONSET_CORRELATION_WINDOW];
        uint32_t estimated_bpm;
        float correlation_strength;
    };
    bool get_diagnostics(DiagnosticsSnapshot* out);

private:
    // Detection pipeline stages
    void stage1_spectral_analysis(const float* spectrum, uint32_t num_bins);
    void stage2_peak_detection();
    void stage3_flux_calculation();
    void stage4_adaptive_thresholding(float vu_level);
    void stage5_onset_detection();
    void stage6_bpm_correlation();

    // Helper methods
    float calculate_spectral_whitening_filter(uint32_t bin_idx);
    void update_adaptive_threshold(float vu_level);
    uint32_t find_best_tempo_hypothesis();
    float autocorrelate_tempo(uint32_t candidate_bpm);
    float calculate_tempo_confidence(uint32_t bpm);

    // State
    struct {
        float fps;
        float nyquist_hz;
        uint16_t num_spectrum_bins;
        float sensitivity;              // 0.0-1.0 onset trigger sensitivity
        float noise_floor;              // Spectral energy threshold
        uint32_t bpm_hysteresis;        // Max drift before BPM change (BPM)
    } config_;

    // Spectrum history (for flux calculation)
    float* spectrum_current_;
    float* spectrum_prev_frame_;
    float* spectrum_prev_prev_frame_;
    float* spectrum_whitened_;

    // Spectral peaks
    struct PeakCandidate {
        uint32_t bin_index;
        float magnitude;
        float flux_history[4];          // Track changes in this peak
        float peak_novelty;
    } spectral_peaks_[SPECTRAL_PEAK_COUNT];

    // Onset history (ring buffer)
    uint32_t onset_history_[ONSET_HISTORY_SIZE];
    uint32_t onset_history_index_;
    uint32_t onset_count_;

    // Detection state
    float spectral_flux_;               // Current frame's spectral flux
    float spectral_flux_normalized_;    // After adaptive thresholding
    float spectral_flux_history_[16];   // For noise floor estimation
    float adaptive_threshold_;          // Dynamic threshold based on recent activity
    float onset_strength_;              // 0.0-1.0 confidence in detected onset
    bool detected_onset_this_frame_;
    uint32_t frames_since_last_onset_;
    uint32_t last_onset_frame_;

    // Noise floor tracking
    float noise_floor_estimate_;
    float noise_floor_smooth_;
    uint32_t low_energy_frame_count_;

    // BPM tracking (atomic for dual-core thread safety)
    std::atomic<uint32_t> current_bpm_;
    std::atomic<float> bpm_confidence_;
    uint32_t frames_processed_;

    // Diagnostics
    bool diagnostics_enabled_;
    DiagnosticsSnapshot last_diagnostics_;
};

// ============================================================================
// FACTORY & GLOBAL INSTANCE
// ============================================================================

extern OnsetDetector* g_onset_detector;

// Initialization (call from setup)
void init_onset_detection(float fps, float nyquist_hz, uint16_t num_spectrum_bins);

// Main update (call from audio processing loop)
void update_onset_detection(const float* spectrum, uint32_t num_bins, float vu_level);

// Query current BPM (call periodically)
uint32_t get_detected_bpm();
float get_detected_bpm_confidence();

// Diagnostics output
void log_onset_diagnostics();

// End of onset_detection.h
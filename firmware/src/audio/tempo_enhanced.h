// Enhanced tempo detector public API and lightweight component interfaces
#pragma once

#include <stdint.h>

#ifndef ENHANCED_NUM_TEMPI
#define ENHANCED_NUM_TEMPI 64
#endif

#ifndef ENHANCED_TEMPO_LOW
#define ENHANCED_TEMPO_LOW 32.0f
#endif

#ifndef ENHANCED_TEMPO_HIGH
#define ENHANCED_TEMPO_HIGH 192.0f
#endif

// Forward decl for multi-scale tempogram implementation
class MultiScaleTemplogram;

// Lightweight helper components (implemented in tempo_enhanced_components.cpp)
class ComplexODF {
public:
    bool init();
    void reset();
    float calculate_from_samples(float* samples, uint32_t num_samples);
    float calculate_from_spectrum(const float* spectrum, uint32_t num_bins);
private:
    float prev_energy_ = 0.0f;
    float prev_bins_[128] = {0};
};

class AdaptiveAmplitudeGate {
public:
    void init();
    void reset();
    void set_adaptive_mode(bool enabled);
    float process(float x);
private:
    bool adaptive_ = true;
    float ema_ = 0.0f;
};

struct ConfidenceBreakdown {
    float combined;
    float entropy;
    float periodicity;
    float stability;
    float phase_coherence;
};

class EntropyConfidenceScorer {
public:
    void init();
    void reset();
    ConfidenceBreakdown calculate_confidence(const float* bins, int n,
                                             const float* history, int history_size);
};

class MultiStageSmoother {
public:
    void init();
    void reset();
    float process(float v, int idx);
private:
    float state_[ENHANCED_NUM_TEMPI] = {0};
};

// Public structs for results and state
struct TempoResult {
    float bpm = 0.0f;
    float confidence = 0.0f;
    float phase = 0.0f;
    float strength = 0.0f;
    float secondary_bpm = 0.0f;
    float secondary_confidence = 0.0f;
    float entropy = 0.0f;
    float periodicity = 0.0f;
    float stability = 0.0f;
    float phase_coherence = 0.0f;
    bool timeout_occurred = false;
    uint32_t processing_time_us = 0;
    uint32_t timestamp_us = 0;
    uint8_t quality_score = 0;
};

struct TempoState {
    static constexpr int HISTORY_SIZE = 32;
    float bpm_history[HISTORY_SIZE] = {0};
    float confidence_history[HISTORY_SIZE] = {0};
    int history_index = 0;
    float current_bpm = 120.0f;
    float smoothed_bpm = 120.0f;
    bool is_locked = false;
    uint32_t last_beat_time_us = 0;
    float phase_accumulator = 0.0f;
    uint32_t lock_duration_ms = 0;
};

struct TimeoutConfig {
    uint32_t initial_detection_ms = 2000;
    uint32_t lock_stabilization_ms = 5000;
    uint32_t continuous_validation_ms = 3000;
    uint32_t recovery_delay_ms = 1000;
    uint32_t timeout_count = 0;
    uint32_t last_timeout_ms = 0;
    bool in_timeout_recovery = false;
};

// Main detector class
class EnhancedTempoDetector {
public:
    EnhancedTempoDetector();
    ~EnhancedTempoDetector();

    bool init();
    void reset();

    TempoResult process(float* audio_samples, uint32_t num_samples);
    TempoResult process_spectrum(float* spectrum, uint32_t num_bins);

    void set_confidence_threshold(float threshold);
    void set_adaptive_mode(bool enabled);
    void load_config(const char* yaml_path);
    void handle_silence_frame();

    // Lightweight accessors for integration/mapping
    inline float current_bpm() const { return state.smoothed_bpm; }
    inline float current_confidence() const {
        int idx = (state.history_index - 1 + TempoState::HISTORY_SIZE) % TempoState::HISTORY_SIZE;
        return (state.history_index > 0) ? state.confidence_history[idx] : 0.0f;
    }
    inline bool is_locked() const { return state.is_locked; }
    inline float current_phase() const { return state.phase_accumulator; }

private:
    void update_tempo_state(const TempoResult& result);
    bool validate_tempo_lock(float bpm, float confidence);
    void apply_hysteresis(TempoResult& result);
    void handle_timeout();
    float calculate_phase_advance(float bpm, uint32_t delta_us);

private:
    ComplexODF* odf_processor;
    MultiScaleTemplogram* tempogram;
    AdaptiveAmplitudeGate* amplitude_gate;
    EntropyConfidenceScorer* confidence_scorer;
    MultiStageSmoother* smoother;

    float* novelty_buffer;
    float* gated_spectrum;
    float* tempo_bins;
    float* smoothed_bins;

    bool adaptive_mode_enabled;
    float user_confidence_threshold;

    TempoState state;
    TimeoutConfig timeout_config;

    // Simple perf stats
    uint32_t total_frames_processed = 0;
    uint32_t successful_detections = 0;
    float average_latency_us = 0.0f;

    uint32_t silence_frame_counter_ = 0;
};

// Utility helpers
float tempo_bin_to_bpm(int bin, int num_bins);
void compute_autocorrelation_tempogram(const float* novelty, int length,
                                       float* out_bins, int num_bins,
                                       float bpm_min, float bpm_max,
                                       float novelty_rate_hz);

extern EnhancedTempoDetector* g_enhanced_tempo_detector;

#include "tempo_enhanced.h"

#include <esp_timer.h>
#include <esp_log.h>
#include <cstring>
#include <algorithm>

#if __has_include(<Arduino.h>)
#  include <Arduino.h>
#endif

#if __has_include(<SPIFFS.h>)
#  include <SPIFFS.h>
#endif

static const char* TAG = "TEMPO_ENHANCED";

// Global instance
EnhancedTempoDetector* g_enhanced_tempo_detector = nullptr;

// ============================================================================
// Constructor / Destructor
// ============================================================================

EnhancedTempoDetector::EnhancedTempoDetector() 
    : odf_processor(nullptr)
    , tempogram(nullptr)
    , amplitude_gate(nullptr)
    , confidence_scorer(nullptr)
    , smoother(nullptr)
    , novelty_buffer(nullptr)
    , gated_spectrum(nullptr)
    , tempo_bins(nullptr)
    , smoothed_bins(nullptr)
    , adaptive_mode_enabled(true)
    , user_confidence_threshold(0.7f) {
    
    // Initialize state
    memset(&state, 0, sizeof(TempoState));
    state.current_bpm = 120.0f;  // Default tempo
    state.smoothed_bpm = 120.0f;
    
    // Initialize timeout config with defaults
    timeout_config.initial_detection_ms = 2000;
    timeout_config.lock_stabilization_ms = 5000;
    timeout_config.continuous_validation_ms = 3000;
    timeout_config.recovery_delay_ms = 1000;
    timeout_config.timeout_count = 0;
    timeout_config.last_timeout_ms = 0;
    timeout_config.in_timeout_recovery = false;
}

EnhancedTempoDetector::~EnhancedTempoDetector() {
    // Clean up components
    delete odf_processor;
    delete tempogram;
    delete amplitude_gate;
    delete confidence_scorer;
    delete smoother;
    
    // Clean up buffers
    delete[] novelty_buffer;
    delete[] gated_spectrum;
    delete[] tempo_bins;
    delete[] smoothed_bins;
}

// ============================================================================
// Initialization
// ============================================================================

bool EnhancedTempoDetector::init() {
    ESP_LOGI(TAG, "Initializing Enhanced Tempo Detector...");

    // Allocate buffers in internal RAM
    novelty_buffer = new float[NOVELTY_HISTORY_LENGTH]();
    gated_spectrum = new float[NUM_FREQS]();
    tempo_bins = new float[ENHANCED_NUM_TEMPI]();
    smoothed_bins = new float[ENHANCED_NUM_TEMPI]();

    if (!novelty_buffer || !gated_spectrum || !tempo_bins || !smoothed_bins) {
        ESP_LOGE(TAG, "Failed to allocate critical buffers in internal RAM");
        return false;
    }

    // Initialize components
    odf_processor = new ComplexODF();
    if (!odf_processor->init()) {
        ESP_LOGE(TAG, "Failed to initialize Complex ODF processor");
        return false;
    }

    tempogram = new MultiScaleTemplogram();
    if (!tempogram->init(ENHANCED_NUM_TEMPI, ENHANCED_TEMPO_LOW, ENHANCED_TEMPO_HIGH)) {
        ESP_LOGE(TAG, "Failed to initialize Multi-Scale Tempogram");
        delete tempogram;
        tempogram = nullptr;
        ESP_LOGW(TAG, "Continuing without Multi-Scale Tempogram");
    }

    amplitude_gate = new AdaptiveAmplitudeGate();
    amplitude_gate->init();

    confidence_scorer = new EntropyConfidenceScorer();
    confidence_scorer->init();

    smoother = new MultiStageSmoother();
    smoother->init();

    ESP_LOGI(TAG, "Enhanced Tempo Detector initialized successfully");
    return true;
}

void EnhancedTempoDetector::reset() {
    // Reset state
    memset(&state, 0, sizeof(TempoState));
    state.current_bpm = 120.0f;
    state.smoothed_bpm = 120.0f;
    state.is_locked = false;
    
    // Clear buffers
    memset(novelty_buffer, 0, sizeof(float) * NOVELTY_HISTORY_LENGTH);
    memset(gated_spectrum, 0, sizeof(float) * NUM_FREQS);
    memset(tempo_bins, 0, sizeof(float) * ENHANCED_NUM_TEMPI);
    memset(smoothed_bins, 0, sizeof(float) * ENHANCED_NUM_TEMPI);
    
    // Reset components
    if (odf_processor) odf_processor->reset();
    if (tempogram) tempogram->reset();
    if (amplitude_gate) amplitude_gate->reset();
    if (smoother) smoother->reset();
    
    // Reset timeout state
    timeout_config.timeout_count = 0;
    timeout_config.in_timeout_recovery = false;
    
    ESP_LOGI(TAG, "Tempo detector reset");
}

// ============================================================================
// Main Processing
// ============================================================================

TempoResult EnhancedTempoDetector::process(float* audio_samples, uint32_t num_samples) {
    uint32_t start_time = esp_timer_get_time();
    TempoResult result = {};
    
    // Check for timeout recovery
    if (timeout_config.in_timeout_recovery) {
        uint32_t now_ms = millis();
        if ((now_ms - timeout_config.last_timeout_ms) < timeout_config.recovery_delay_ms) {
            // Still in recovery, return last known state
            result.bpm = state.smoothed_bpm;
            result.confidence = 0.0f;
            result.timeout_occurred = true;
            return result;
        }
        timeout_config.in_timeout_recovery = false;
    }
    
    // Step 1: Apply adaptive amplitude gating to input samples
    for (uint32_t i = 0; i < num_samples; i++) {
        audio_samples[i] = amplitude_gate->process(audio_samples[i]);
    }
    
    // Step 2: Calculate Complex Domain Onset Detection Function
    float novelty = odf_processor->calculate_from_samples(audio_samples, num_samples);
    
    // Update novelty buffer (shift and add new value)
    memmove(novelty_buffer, novelty_buffer + 1, 
            (NOVELTY_HISTORY_LENGTH - 1) * sizeof(float));
    novelty_buffer[NOVELTY_HISTORY_LENGTH - 1] = novelty;
    
    // Step 3: Process with multi-scale tempogram
    if (tempogram) {
        tempogram->process_novelty_curve(novelty_buffer, NOVELTY_HISTORY_LENGTH);
        tempogram->get_combined_tempogram(tempo_bins);
    } else {
        // Fallback: simple autocorrelation if tempogram is disabled
        compute_autocorrelation_tempogram(novelty_buffer, NOVELTY_HISTORY_LENGTH, tempo_bins, ENHANCED_NUM_TEMPI, ENHANCED_TEMPO_LOW, ENHANCED_TEMPO_HIGH, 50.0f);
    }
    
    // Step 4: Apply multi-stage smoothing
    for (int i = 0; i < ENHANCED_NUM_TEMPI; i++) {
        smoothed_bins[i] = smoother->process(tempo_bins[i], i);
    }
    
    // Step 5: Calculate confidence metrics
    auto confidence_metrics = confidence_scorer->calculate_confidence(
        smoothed_bins, ENHANCED_NUM_TEMPI,
        state.confidence_history, TempoState::HISTORY_SIZE
    );
    
    // Step 6: Find primary tempo hypothesis
    int peak_bin = 0;
    float peak_value = 0.0f;
    for (int i = 0; i < ENHANCED_NUM_TEMPI; i++) {
        if (smoothed_bins[i] > peak_value) {
            peak_value = smoothed_bins[i];
            peak_bin = i;
        }
    }
    
    // Convert bin to BPM
    float detected_bpm = tempo_bin_to_bpm(peak_bin, ENHANCED_NUM_TEMPI);
    
    // Step 7: Find secondary tempo (for polyrhythm detection)
    int secondary_bin = -1;
    float secondary_value = 0.0f;
    for (int i = 0; i < ENHANCED_NUM_TEMPI; i++) {
        // Skip bins near primary peak
        if (abs(i - peak_bin) < 5) continue;
        
        if (smoothed_bins[i] > secondary_value) {
            secondary_value = smoothed_bins[i];
            secondary_bin = i;
        }
    }
    
    // Step 8: Calculate phase information
    float phase = tempogram->get_phase_at_tempo(peak_bin);
    
    // Step 9: Apply hysteresis and validation
    result.bpm = detected_bpm;
    result.confidence = confidence_metrics.combined;
    result.phase = phase;
    result.strength = peak_value;
    
    if (secondary_bin >= 0) {
        result.secondary_bpm = tempo_bin_to_bpm(secondary_bin, ENHANCED_NUM_TEMPI);
        result.secondary_confidence = secondary_value / peak_value;
    }
    
    result.entropy = confidence_metrics.entropy;
    result.periodicity = confidence_metrics.periodicity;
    result.stability = confidence_metrics.stability;
    result.phase_coherence = confidence_metrics.phase_coherence;
    
    // Apply hysteresis to smooth transitions
    apply_hysteresis(result);
    
    // Step 10: Validate and update state
    if (validate_tempo_lock(result.bpm, result.confidence)) {
        update_tempo_state(result);
    } else if (!state.is_locked) {
        // Check for initial detection timeout
        static uint32_t detection_start_time = 0;
        if (detection_start_time == 0) {
            detection_start_time = millis();
        }
        
        if ((millis() - detection_start_time) > timeout_config.initial_detection_ms) {
            handle_timeout();
            result.timeout_occurred = true;
        }
    }
    
    // Calculate processing time
    result.processing_time_us = esp_timer_get_time() - start_time;
    result.timestamp_us = esp_timer_get_time();
    
    // Calculate quality score (0-100)
    result.quality_score = static_cast<uint8_t>(
        result.confidence * 100.0f * result.stability
    );
    
    // Update performance metrics
    total_frames_processed++;
    if (result.confidence > user_confidence_threshold) {
        successful_detections++;
    }
    
    // Update average latency (exponential moving average)
    float alpha = 0.1f;
    average_latency_us = average_latency_us * (1.0f - alpha) + 
                         result.processing_time_us * alpha;
    
    return result;
}

TempoResult EnhancedTempoDetector::process_spectrum(float* spectrum, uint32_t num_bins) {
    uint32_t start_time = esp_timer_get_time();
    TempoResult result = {};
    
    // Apply amplitude gating to spectrum
    for (uint32_t i = 0; i < num_bins && i < NUM_FREQS; i++) {
        gated_spectrum[i] = amplitude_gate->process(spectrum[i]);
    }
    
    // Calculate novelty from spectrum
    float novelty = odf_processor->calculate_from_spectrum(gated_spectrum, num_bins);
    
    // Update novelty buffer
    memmove(novelty_buffer, novelty_buffer + 1, 
            (NOVELTY_HISTORY_LENGTH - 1) * sizeof(float));
    novelty_buffer[NOVELTY_HISTORY_LENGTH - 1] = novelty;
    
    // Continue with same processing as process()
    tempogram->process_novelty_curve(novelty_buffer, NOVELTY_HISTORY_LENGTH);
    tempogram->get_combined_tempogram(tempo_bins);
    
    // Apply smoothing and continue...
    // (Same logic as process() from Step 4 onwards)
    
    for (int i = 0; i < ENHANCED_NUM_TEMPI; i++) {
        smoothed_bins[i] = smoother->process(tempo_bins[i], i);
    }
    
    auto confidence_metrics = confidence_scorer->calculate_confidence(
        smoothed_bins, ENHANCED_NUM_TEMPI,
        state.confidence_history, TempoState::HISTORY_SIZE
    );
    
    int peak_bin = 0;
    float peak_value = 0.0f;
    for (int i = 0; i < ENHANCED_NUM_TEMPI; i++) {
        if (smoothed_bins[i] > peak_value) {
            peak_value = smoothed_bins[i];
            peak_bin = i;
        }
    }
    
    float detected_bpm = tempo_bin_to_bpm(peak_bin, ENHANCED_NUM_TEMPI);
    float phase = tempogram->get_phase_at_tempo(peak_bin);
    
    result.bpm = detected_bpm;
    result.confidence = confidence_metrics.combined;
    result.phase = phase;
    result.strength = peak_value;
    result.entropy = confidence_metrics.entropy;
    result.periodicity = confidence_metrics.periodicity;
    result.stability = confidence_metrics.stability;
    result.phase_coherence = confidence_metrics.phase_coherence;
    
    apply_hysteresis(result);
    
    if (validate_tempo_lock(result.bpm, result.confidence)) {
        update_tempo_state(result);
    }
    
    result.processing_time_us = esp_timer_get_time() - start_time;
    result.timestamp_us = esp_timer_get_time();
    result.quality_score = static_cast<uint8_t>(
        result.confidence * 100.0f * result.stability
    );
    
    return result;
}

// ============================================================================
// Private Methods
// ============================================================================

void EnhancedTempoDetector::update_tempo_state(const TempoResult& result) {
    // Update history buffers
    state.bpm_history[state.history_index] = result.bpm;
    state.confidence_history[state.history_index] = result.confidence;
    state.history_index = (state.history_index + 1) % TempoState::HISTORY_SIZE;
    
    // Update current BPM with smoothing
    float alpha = 0.2f;  // Smoothing factor
    state.current_bpm = result.bpm;
    state.smoothed_bpm = state.smoothed_bpm * (1.0f - alpha) + result.bpm * alpha;
    
    // Update phase accumulator
    uint32_t now_us = esp_timer_get_time();
    if (state.last_beat_time_us > 0) {
        float delta_us = now_us - state.last_beat_time_us;
        state.phase_accumulator += calculate_phase_advance(state.smoothed_bpm, delta_us);
        state.phase_accumulator = wrap_phase_enhanced(state.phase_accumulator);
    }
    
    // Check for beat occurrence (phase crosses zero)
    if (state.phase_accumulator > -0.1f && state.phase_accumulator < 0.1f) {
        state.last_beat_time_us = now_us;
    }
    
    // Update lock status
    if (!state.is_locked && result.confidence > user_confidence_threshold) {
        state.is_locked = true;
        state.lock_duration_ms = 0;
        ESP_LOGI(TAG, "Tempo locked at %.1f BPM (confidence: %.2f)", 
                 state.smoothed_bpm, result.confidence);
    } else if (state.is_locked) {
        state.lock_duration_ms += 10;  // Approximate frame time
        
        // Check for lock loss
        if (result.confidence < user_confidence_threshold * 0.7f) {  // Hysteresis
            state.is_locked = false;
            ESP_LOGW(TAG, "Tempo lock lost (confidence dropped to %.2f)", 
                     result.confidence);
        }
    }
}

bool EnhancedTempoDetector::validate_tempo_lock(float bpm, float confidence) {
    // Range validation
    if (bpm < ENHANCED_TEMPO_LOW || bpm > ENHANCED_TEMPO_HIGH) {
        return false;
    }
    
    // Confidence validation
    if (confidence < user_confidence_threshold) {
        return false;
    }
    
    // Stability validation (check variance in history)
    if (state.history_index > 5) {  // Need enough history
        float mean = 0.0f;
        int count = std::min(state.history_index, 10);
        for (int i = 0; i < count; i++) {
            int idx = (state.history_index - 1 - i + TempoState::HISTORY_SIZE) % 
                      TempoState::HISTORY_SIZE;
            mean += state.bpm_history[idx];
        }
        mean /= count;
        
        float variance = 0.0f;
        for (int i = 0; i < count; i++) {
            int idx = (state.history_index - 1 - i + TempoState::HISTORY_SIZE) % 
                      TempoState::HISTORY_SIZE;
            float diff = state.bpm_history[idx] - mean;
            variance += diff * diff;
        }
        variance /= count;
        
        // Reject if variance too high (unstable)
        if (variance > 25.0f) {  // 5 BPM standard deviation
            return false;
        }
    }
    
    return true;
}

void EnhancedTempoDetector::apply_hysteresis(TempoResult& result) {
    if (!state.is_locked) {
        return;  // No hysteresis when not locked
    }
    
    // Apply BPM hysteresis
    float bpm_diff = fabsf(result.bpm - state.smoothed_bpm);
    if (bpm_diff < 2.0f) {
        // Small change - heavily smooth
        result.bpm = state.smoothed_bpm * 0.9f + result.bpm * 0.1f;
    } else if (bpm_diff < 5.0f) {
        // Medium change - moderate smoothing
        result.bpm = state.smoothed_bpm * 0.7f + result.bpm * 0.3f;
    }
    // Large change - accept new value (tempo change detected)
    
    // Apply confidence hysteresis
    float conf_diff = result.confidence - state.confidence_history[
        (state.history_index - 1 + TempoState::HISTORY_SIZE) % TempoState::HISTORY_SIZE
    ];
    
    if (conf_diff < 0 && result.confidence > user_confidence_threshold * 0.8f) {
        // Confidence dropping but still acceptable - smooth it
        result.confidence = result.confidence * 0.7f + 
                           state.confidence_history[
                               (state.history_index - 1 + TempoState::HISTORY_SIZE) % 
                               TempoState::HISTORY_SIZE
                           ] * 0.3f;
    }
}

void EnhancedTempoDetector::handle_timeout() {
    timeout_config.timeout_count++;
    timeout_config.last_timeout_ms = millis();
    timeout_config.in_timeout_recovery = true;
    
    ESP_LOGW(TAG, "Tempo detection timeout #%lu - entering recovery mode", 
             timeout_config.timeout_count);
    
    // Reset to default state
    state.is_locked = false;
    state.current_bpm = 120.0f;
    state.smoothed_bpm = 120.0f;
    
    // Clear history
    memset(state.bpm_history, 0, sizeof(state.bpm_history));
    memset(state.confidence_history, 0, sizeof(state.confidence_history));
    state.history_index = 0;
}

float EnhancedTempoDetector::calculate_phase_advance(float bpm, uint32_t delta_us) {
    float beats_per_second = bpm / 60.0f;
    float radians_per_second = beats_per_second * 2.0f * M_PI;
    float radians_per_microsecond = radians_per_second / 1000000.0f;
    return radians_per_microsecond * delta_us;
}

// ============================================================================
// Configuration Methods
// ============================================================================

void EnhancedTempoDetector::set_confidence_threshold(float threshold) {
    user_confidence_threshold = fmaxf(0.1f, fminf(1.0f, threshold));
    ESP_LOGI(TAG, "Confidence threshold set to %.2f", user_confidence_threshold);
}

void EnhancedTempoDetector::set_adaptive_mode(bool enabled) {
    adaptive_mode_enabled = enabled;
    if (amplitude_gate) {
        amplitude_gate->set_adaptive_mode(enabled);
    }
    ESP_LOGI(TAG, "Adaptive mode %s", enabled ? "enabled" : "disabled");
}

void EnhancedTempoDetector::load_config(const char* yaml_path) {
#if __has_include(<SPIFFS.h>)
    if (!yaml_path) {
        ESP_LOGW(TAG, "Config path is null; using defaults");
        return;
    }

    if (!SPIFFS.exists(yaml_path)) {
        ESP_LOGW(TAG, "Tempo config %s not found; using defaults", yaml_path);
        return;
    }

    File file = SPIFFS.open(yaml_path, "r");
    if (!file) {
        ESP_LOGW(TAG, "Failed to open tempo config %s; using defaults", yaml_path);
        return;
    }

    size_t bytes = file.size();
    file.close();
    ESP_LOGI(TAG, "Tempo config %s loaded (%u bytes). Parser not implemented; defaults remain active.",
             yaml_path, static_cast<unsigned>(bytes));
#else
    (void)yaml_path;
    ESP_LOGW(TAG, "SPIFFS not available; cannot load tempo config");
#endif
}

void EnhancedTempoDetector::set_timeout_config(const TempoTimeoutConfig& config) {
    timeout_config.initial_detection_ms = config.initial_detection_ms;
    timeout_config.lock_stabilization_ms = config.lock_stabilization_ms;
    timeout_config.continuous_validation_ms = config.continuous_validation_ms;
    timeout_config.recovery_delay_ms = config.recovery_delay_ms;
    
    ESP_LOGI(TAG, "Timeout config updated - Initial: %lums, Stabilization: %lums, "
             "Validation: %lums, Recovery: %lums",
             timeout_config.initial_detection_ms,
             timeout_config.lock_stabilization_ms,
             timeout_config.continuous_validation_ms,
             timeout_config.recovery_delay_ms);
}

float EnhancedTempoDetector::get_confidence() const {
    if (state.history_index == 0) return 0.0f;
    
    int idx = (state.history_index - 1 + TempoState::HISTORY_SIZE) % 
              TempoState::HISTORY_SIZE;
    return state.confidence_history[idx];
}

// ============================================================================
// Diagnostics
// ============================================================================

void EnhancedTempoDetector::dump_diagnostics(char* json_buffer, size_t buffer_size) {
    snprintf(json_buffer, buffer_size,
        "{"
        "\"current_bpm\":%.1f,"
        "\"smoothed_bpm\":%.1f,"
        "\"confidence\":%.3f,"
        "\"is_locked\":%s,"
        "\"lock_duration_ms\":%lu,"
        "\"phase\":%.3f,"
        "\"timeout_count\":%lu,"
        "\"in_recovery\":%s,"
        "\"frames_processed\":%lu,"
        "\"success_rate\":%.1f,"
        "\"avg_latency_us\":%.1f"
        "}",
        state.current_bpm,
        state.smoothed_bpm,
        get_confidence(),
        state.is_locked ? "true" : "false",
        state.lock_duration_ms,
        state.phase_accumulator,
        timeout_config.timeout_count,
        timeout_config.in_timeout_recovery ? "true" : "false",
        total_frames_processed.load(),
        (float)successful_detections.load() / (float)total_frames_processed.load() * 100.0f,
        average_latency_us.load()
    );
}

void EnhancedTempoDetector::get_performance_metrics(float& accuracy, 
                                                    float& latency_ms, 
                                                    float& cpu_usage) {
    uint32_t total = total_frames_processed.load();
    uint32_t successful = successful_detections.load();
    
    accuracy = (total > 0) ? ((float)successful / (float)total) : 0.0f;
    latency_ms = average_latency_us.load() / 1000.0f;
    
    // Estimate CPU usage based on processing time vs frame time
    float frame_time_us = 10000.0f;  // Assuming 100Hz processing
    cpu_usage = (average_latency_us.load() / frame_time_us) * 100.0f;
}

// ============================================================================
// Global Functions
// ============================================================================

void init_enhanced_tempo_detection() {
    if (!g_enhanced_tempo_detector) {
        g_enhanced_tempo_detector = new EnhancedTempoDetector();
        g_enhanced_tempo_detector->init();
    }
}

void cleanup_enhanced_tempo_detection() {
    if (g_enhanced_tempo_detector) {
        delete g_enhanced_tempo_detector;
        g_enhanced_tempo_detector = nullptr;
    }
}

TempoResult get_current_tempo() {
    if (g_enhanced_tempo_detector) {
        // Get current state as result
        TempoResult result = {};
        result.bpm = g_enhanced_tempo_detector->get_current_bpm();
        result.confidence = g_enhanced_tempo_detector->get_confidence();
        result.phase = g_enhanced_tempo_detector->get_state().phase_accumulator;
        return result;
    }
    
    // Return default result
    TempoResult result = {};
    result.bpm = 120.0f;
    return result;
}

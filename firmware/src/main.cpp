#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoOTA.h>
#include <SPIFFS.h>
#include <math.h>
#include <atomic>
// Ensure LED driver interface is visible before any usage
#include "led_driver.h"  // declares init_rmt_driver(), transmit_leds(), NUM_LEDS
#include "frame_metrics.h"
#include "color_pipeline.h"
#ifdef DYNAMIC_LED_CHANNELS
#include "render_channel.h"
extern "C" void visual_scheduler(void* param);
#endif
// Forward declaration to satisfy IDE/indexer in case of header parsing issues
void init_rmt_driver();
// Prefer real ESP-IDF UART header; fall back to editor-only stubs if unavailable
#if __has_include(<driver/uart.h>)
#  include <driver/uart.h>
#else
#  include <stddef.h>
#  include <stdint.h>
   typedef int esp_err_t;
   typedef int uart_port_t;
#  ifndef ESP_OK
#    define ESP_OK 0
#  endif
#  ifndef UART_NUM_1
#    define UART_NUM_1 1
#  endif
#  ifndef UART_PIN_NO_CHANGE
#    define UART_PIN_NO_CHANGE (-1)
#  endif
   typedef struct { int dummy; } uart_config_t;
   // Minimal prototypes referenced in gated UART sync code
   esp_err_t uart_driver_install(uart_port_t, int, int, int, void*, int);
   esp_err_t uart_param_config(uart_port_t, const uart_config_t*);
   esp_err_t uart_set_pin(uart_port_t, int, int, int, int);
   int uart_write_bytes(uart_port_t, const char*, size_t);
#endif

// Skip main setup/loop during unit tests (tests provide their own)
#ifndef UNIT_TEST

#include "types.h"
#include "profiler.h"
#include "audio/goertzel.h"  // Audio system globals, struct definitions, initialization, DFT computation
#include "audio/tempo.h"     // Beat detection and tempo tracking pipeline
#include "audio/tempo_enhanced.h"
#include "audio/microphone.h"  // REAL SPH0645 I2S MICROPHONE INPUT
#include "audio/vu.h"
#include "audio/cochlear_agc.h"  // Cochlear AGC v2.1 - Multi-band adaptive gain control
#include "palettes.h"
#include "easing_functions.h"
#include "parameters.h"
#include "pattern_registry.h"
#include "pattern_render_context.h"
#include "pattern_codegen_bridge.h"
#include "generated_patterns.h"
#include "pattern_helpers.h"
#include "shared_pattern_buffers.h"
// #include "pattern_optimizations.h"  // Disabled: legacy optimization header with mismatched signatures
#include "webserver.h"
#include "cpu_monitor.h"
#include "connection_state.h"
#include "wifi_monitor.h"
#include "logging/logger.h"
#include "beat_events.h"
#include "diagnostics.h"
#include "diagnostics/heartbeat_logger.h"
#include "audio/validation/tempo_validation.h"
// (removed duplicate include of audio/goertzel.h)
#include "udp_echo.h"      // UDP echo server for RTT measurements
#include "led_tx_events.h"  // Rolling buffer of LED transmit timestamps
#include "frame_metrics.h"  // Frame-level profiling metrics

// Configuration (environment-based per Phase 0 security hardening)
// WiFi credentials must be supplied via environment variables - see .env.example
#define BEAT_EVENTS_DIAG 0
// NUM_LEDS and LED_DATA_PIN are defined in led_driver.h

// ============================================================================
// UART DAISY CHAIN CONFIGURATION
// ============================================================================
#define UART_NUM UART_NUM_1
#define UART_TX_PIN 38  // GPIO 38 -> Secondary RX (GPIO 44)
#define UART_RX_PIN 37  // GPIO 37 <- Secondary TX (GPIO 43)
#define UART_BAUD 115200

// Global LED buffer
CRGBF leds[NUM_LEDS];

// Global beat event rate limiter (shared across audio paths)
static uint32_t g_last_beat_event_ms = 0;

// Debug mode flags (toggle with keystrokes: 'd' = audio, 't' = tempo)
static bool audio_debug_enabled = false;
bool tempo_debug_enabled = false;  // Non-static for visibility to tempo.cpp

// Forward declaration for single-core audio pipeline helper
static inline void run_audio_pipeline_once();

static bool network_services_started = false;
static bool s_audio_task_running = false;
static bool s_enhanced_tempo_active = false;  // DISABLED: Use classic Emotiscope tempo only
static EnhancedTempoDetector* s_etd = nullptr;
static TempoResult s_last_enhanced_result{};
static bool s_last_enhanced_valid = false;

static inline bool enhanced_locked_trustworthy() {
    return s_enhanced_tempo_active &&
           s_etd &&
           s_etd->is_locked() &&
           s_last_enhanced_valid &&
           (s_last_enhanced_result.confidence >= 0.4f);
}

static inline void reset_classic_tempo_bins() {
    extern tempo tempi[NUM_TEMPI];
    extern float tempi_smooth[NUM_TEMPI];
    for (uint16_t i = 0; i < NUM_TEMPI; ++i) {
        tempi[i].magnitude = 0.0f;
        tempi[i].magnitude_full_scale = 0.0f;
        tempi_smooth[i] = 0.0f;
    }
    tempi_power_sum = 0.0f;
}

// Calculate best BPM estimate from highest tempo bin magnitude
float get_best_bpm() {
    extern float tempi_smooth[NUM_TEMPI];
    extern float tempi_bpm_values_hz[NUM_TEMPI];
    
    // Safety checks to prevent crashes
    if (!tempi_smooth || !tempi_bpm_values_hz) {
        return 120.0f; // Safe default BPM
    }
    
    float max_magnitude = 0.0f;
    uint16_t best_bin = 0;

    for (uint16_t i = 0; i < NUM_TEMPI; i++) {
        if (tempi_smooth[i] > max_magnitude) {
            max_magnitude = tempi_smooth[i];
            best_bin = i;
        }
    }

    // Bounds check to prevent array overflow
    if (best_bin >= NUM_TEMPI) {
        best_bin = NUM_TEMPI - 1;
    }

    // Convert bin index to BPM (32-192 BPM range across NUM_TEMPI bins)
    // tempi_bpm_values_hz[i] stores frequency in Hz, convert to BPM
    return tempi_bpm_values_hz[best_bin] * 60.0f;  // Hz to BPM
}

void handle_wifi_connected() {
    connection_logf("INFO", "WiFi connected callback fired");
#if __has_include(<WiFi.h>) && __has_include(<ArduinoOTA.h>)
    LOG_INFO(TAG_WIFI, "Connected! IP: %s", WiFi.localIP().toString().c_str());

    ArduinoOTA.begin();

    if (!network_services_started) {
        LOG_INFO(TAG_WEB, "Initializing web server...");
        init_webserver();

        // Start UDP echo server for RTT diagnostics (port 9000)
        udp_echo_begin(9000);
        // Start secondary UDP echo for OSC correlation (port 9001)
        udp_echo_begin(9001);

        LOG_INFO(TAG_CORE0, "Initializing CPU monitor...");
        cpu_monitor.init();

        network_services_started = true;
    }

    LOG_INFO(TAG_WEB, "Control UI: http://%s.local", ArduinoOTA.getHostname());
#else
    LOG_INFO(TAG_WIFI, "Connected (WiFi/OTA headers unavailable in this build)");
#endif
}

void handle_wifi_disconnected() {
    connection_logf("WARN", "WiFi disconnected callback");
    LOG_WARN(TAG_WIFI, "WiFi connection lost, attempting recovery...");
}

// ============================================================================
// UART DAISY CHAIN - SYNCHRONIZE SECONDARY DEVICE (s3z)
// ============================================================================
#if ENABLE_UART_SYNC
void init_uart_sync() {
    uart_config_t uart_config = {
        .baud_rate = UART_BAUD,
        .data_bits = UART_DATA_8_BITS,
        .parity = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
        .rx_flow_ctrl_thresh = 0,
        .source_clk = UART_SCLK_DEFAULT,
    };

    uart_param_config(UART_NUM, &uart_config);
    uart_set_pin(UART_NUM, UART_TX_PIN, UART_RX_PIN,
                 UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE);
    uart_driver_install(UART_NUM, 256, 0, 0, NULL, 0);

    LOG_INFO(TAG_SYNC, "UART1 initialized for s3z daisy chain sync");
}
#endif

#if ENABLE_UART_SYNC
void send_uart_sync_frame() {
    static uint32_t last_frame = 0;
    static uint32_t packets_sent = 0;
    uint32_t current_frame = FRAMES_COUNTED;

    // Only send if frame number changed
    if (current_frame == last_frame) {
        return;
    }

    // Build 6-byte packet
    // [0xAA] [FRAME_HI] [FRAME_LO] [PATTERN_ID] [BRIGHTNESS] [CHECKSUM]
    uint8_t packet[6];
    packet[0] = 0xAA;                              // Sync byte
    packet[1] = (current_frame >> 8) & 0xFF;      // Frame HI
    packet[2] = current_frame & 0xFF;             // Frame LO
    packet[3] = g_current_pattern_index;          // Pattern ID (extern from pattern_registry.h)
    packet[4] = (uint8_t)(get_params().brightness * 255);  // Brightness

    // Compute XOR checksum
    uint8_t checksum = packet[0];
    for (int i = 1; i < 5; i++) {
        checksum ^= packet[i];
    }
    packet[5] = checksum;

    // Send via UART1
    int bytes_written = uart_write_bytes(UART_NUM, (const char*)packet, 6);
    packets_sent++;

    // Debug output every 200 packets (~4.7 seconds at 42 FPS)
    if (packets_sent % 200 == 0) {
        LOG_DEBUG(TAG_SYNC, "UART: Sent %lu packets (frame %lu, last write %d bytes)",
                  packets_sent, current_frame, bytes_written);
    }

    last_frame = current_frame;
}
#else
// No-op when UART sync is disabled
static inline void send_uart_sync_frame() {}
#endif

// ============================================================================
// AUDIO TASK - Runs on Core 0 @ ~100 Hz (audio processing only)
// ============================================================================
// This function runs on Core 0 and handles all audio processing
// - Microphone sample acquisition (I2S, blocking - isolated to Core 0)
// - Goertzel frequency analysis (CPU-intensive)
// - Chromagram computation (pitch class analysis)
// - Beat detection and tempo tracking
// - Lock-free buffer synchronization with Core 1
void audio_task(void* param) {
    LOG_INFO(TAG_CORE0, "AUDIO_TASK Starting on Core 0");
    
    while (true) {
        // If audio reactivity is disabled, invalidate snapshot and idle
        if (!EMOTISCOPE_ACTIVE) {
            memset(audio_back.payload.spectrogram, 0, sizeof(float) * NUM_FREQS);
            memset(audio_back.payload.spectrogram_smooth, 0, sizeof(float) * NUM_FREQS);
            memset(audio_back.payload.chromagram, 0, sizeof(float) * 12);
            audio_back.payload.vu_level = 0.0f;
            audio_back.payload.vu_level_raw = 0.0f;
            memset(audio_back.payload.tempo_magnitude, 0, sizeof(float) * NUM_TEMPI);
            memset(audio_back.payload.tempo_phase, 0, sizeof(float) * NUM_TEMPI);
            audio_back.payload.tempo_confidence = 0.0f;
            audio_back.payload.is_valid = false;
            audio_back.payload.timestamp_us = micros();
            commit_audio_data();
            vTaskDelay(pdMS_TO_TICKS(10));
            continue;
        }

        // Process audio chunk (I2S blocking isolated to Core 0)
        acquire_sample_chunk();        // Blocks on I2S if needed (acceptable here)
        calculate_magnitudes();        // ~15-25ms Goertzel computation
        get_chromagram();              // ~1ms pitch aggregation

        // BEAT DETECTION PIPELINE (Emotiscope parity)
        // Maintain time context for novelty logging
        t_now_us = micros();
        t_now_ms = millis();

        // Run VU to update vu_max for novelty logging
        run_vu();

        // Log novelty at fixed cadence and update silence state
        update_novelty();

        bool input_active = audio_input_is_active();
        bool silence_frame = (!input_active);
        static bool prev_silence_frame = true;
        bool resumed_from_silence = (prev_silence_frame && !silence_frame);
        prev_silence_frame = silence_frame;
        if (silence_frame) {
            tempo_confidence = 0.0f;
            reset_classic_tempo_bins();
            if (s_enhanced_tempo_active && s_etd) {
                s_etd->handle_silence_frame();
            }
        } else if (resumed_from_silence) {
            tempo_confidence = 0.0f;
            reset_classic_tempo_bins();
            if (s_enhanced_tempo_active && s_etd) {
                s_etd->reset();
            }
        }

        // Update tempo (enhanced preferred) and advance phases
        bool probe_started = false;
        static uint32_t last_phase_us = 0;
        if (!silence_frame) {
            beat_events_probe_start();
            probe_started = true;
            if (s_enhanced_tempo_active && s_etd) {
                TempoResult tr = s_etd->process_spectrum(spectrogram_smooth, NUM_FREQS);
                s_last_enhanced_result = tr;
                s_last_enhanced_valid = true;

                // Prefer locked, smoothed BPM for mapping to reduce jitter
                float map_bpm = s_etd->is_locked() ? s_etd->current_bpm() : tr.bpm;
                uint16_t best_bin = find_closest_tempo_bin(map_bpm);

                for (uint16_t i = 0; i < NUM_TEMPI; ++i) {
                    tempi[i].magnitude *= 0.90f;
                    tempi_smooth[i] *= 0.92f;
                }
                float conf = s_etd->current_confidence();
                if (!s_etd->is_locked()) conf *= 0.5f; // down-weight pre-lock to avoid whiplash
                tempi[best_bin].magnitude = fmaxf(tempi[best_bin].magnitude, conf);
                tempi_smooth[best_bin] = fmaxf(tempi_smooth[best_bin], conf);
                tempo_confidence = conf;

                // Also update classic distribution to populate all bins for visuals
                // This provides a full-band magnitude profile for patterns (legacy parity)
                update_tempo();
            } else {
                update_tempo();
            }

            if (last_phase_us == 0) last_phase_us = t_now_us;
            uint32_t dt_us = t_now_us - last_phase_us;
            last_phase_us = t_now_us;
            const float ideal_us_per_frame = 1000000.0f / REFERENCE_FPS;
            float delta = dt_us / ideal_us_per_frame;
            if (delta < 0.0f) delta = 0.0f;
            if (delta > 5.0f) delta = 5.0f; // clamp extreme pauses
            update_tempi_phase(delta);
        } else {
            last_phase_us = t_now_us;
        }

        // SYNC TEMPO CONFIDENCE TO AUDIO SNAPSHOT (guarded)
        extern float tempo_confidence;  // From tempo.cpp
        static portMUX_TYPE audio_spinlock = portMUX_INITIALIZER_UNLOCKED;
        portENTER_CRITICAL(&audio_spinlock);
        audio_back.payload.tempo_confidence = tempo_confidence;
        audio_back.payload.is_valid = !silence_frame;
        audio_back.payload.locked_tempo_bpm = tempo_lock_tracker.locked_tempo_bpm;
        audio_back.payload.tempo_lock_state = tempo_lock_tracker.state;
        portEXIT_CRITICAL(&audio_spinlock);

        // SYNC TEMPO MAGNITUDE AND PHASE ARRAYS
        // Copy per-tempo-bin magnitude and phase data from tempo calculation to audio snapshot
        // This enables Tempiscope and Beat_Tunnel patterns to access individual tempo bin data
        extern tempo tempi[NUM_TEMPI];  // From tempo.cpp (96 tempo hypotheses)
        portENTER_CRITICAL(&audio_spinlock);
        for (uint16_t i = 0; i < NUM_TEMPI; i++) {
            // Use smoothed magnitudes for visual stability
            audio_back.payload.tempo_magnitude[i] = tempi_smooth[i];  // 0.0-1.0 per bin (smoothed)
            audio_back.payload.tempo_phase[i] = tempi[i].phase;          // -π to +π per bin
        }
        portEXIT_CRITICAL(&audio_spinlock);

        // Lightweight tempo diagnostics (0.1 Hz / 10s interval)
        static uint32_t last_tempo_log_ms = 0;
        uint32_t now_ms_log = millis();
        if (now_ms_log - last_tempo_log_ms > 10000) {
            last_tempo_log_ms = now_ms_log;
            uint16_t dom = find_dominant_tempo_bin(tempi_smooth, NUM_TEMPI);
            
            // Critical safety check to prevent array bounds violation
            if (dom >= NUM_TEMPI) {
                dom = NUM_TEMPI - 1; // Clamp to valid range
            }
            
            float bpm_now = tempi_bpm_values_hz[dom] * 60.0f;
            const char* lock_state = get_tempo_lock_state_string(tempo_lock_tracker.state);
            float enh_bpm = s_last_enhanced_valid ? s_last_enhanced_result.bpm : 0.0f;
            float enh_conf = s_last_enhanced_valid ? s_last_enhanced_result.confidence : 0.0f;
            bool enh_locked = enhanced_locked_trustworthy();
            
            // Validate enhanced tempo detector state before logging
            if (s_etd && s_enhanced_tempo_active) {
                LOG_INFO(TAG_TEMPO, "tempo classic bpm=%.1f conf=%.2f lock=%s power_sum=%.3f dom_bin=%u | enh bpm=%.1f conf=%.2f lock=%d",
                         bpm_now, tempo_confidence, lock_state, tempi_power_sum, (unsigned)dom,
                         enh_bpm, enh_conf, (int)enh_locked);
            } else {
                LOG_INFO(TAG_TEMPO, "tempo classic bpm=%.1f conf=%.2f lock=%s power_sum=%.3f dom_bin=%u | enh DISABLED",
                         bpm_now, tempo_confidence, lock_state, tempi_power_sum, (unsigned)dom);
            }
        }

        // Beat event emission (enhanced preferred):
        // - If enhanced locked: emit on phase zero-crossing with period guard
        // - Else: fallback to confidence + refractory gating
        if (!silence_frame) {
            // Safety check: ensure tempo arrays are initialized
            extern float tempi_smooth[NUM_TEMPI];
            extern float tempi_bpm_values_hz[NUM_TEMPI];
            if (!tempi_smooth || !tempi_bpm_values_hz) {
                LOG_WARN(TAG_AUDIO, "Tempo arrays not initialized, skipping beat detection");
                return;
            }
            
            uint32_t now_ms = millis();
            extern float tempo_confidence;  // From tempo.cpp
            // Adaptive gating: threshold influenced by silence level and novelty
            extern float silence_level;
            float novelty_recent = novelty_curve_normalized[NOVELTY_HISTORY_LENGTH - 1];
            const float base_threshold = get_params().beat_threshold;
            float adaptive = base_threshold + (0.20f * (1.0f - silence_level)) + (0.10f * fminf(novelty_recent, 1.0f));
            // Hard VU gate: do not emit beats under low energy (tempo.h constant)
            // audio_level is updated by run_vu(); use it directly for gating
            bool vu_ok = (audio_level >= VU_LOCK_GATE);
            bool emitted = false;
            bool enh_locked = enhanced_locked_trustworthy();
            if (vu_ok && enh_locked) {
                // Phase-based beat: detect negative→positive zero-crossing
                static float prev_phase = 0.0f;
                float phase = s_etd->current_phase();
                // Expected period from locked BPM
                float bpm_for_period = fmaxf(30.0f, fminf(200.0f, s_etd->current_bpm()));
                uint32_t expected_period_ms = (uint32_t)(60000.0f / bpm_for_period);
                
                // Smart refractory calculation - check for octave ambiguity
                extern OctaveRelationship get_current_octave_relationship();
                OctaveRelationship octave_rel = get_current_octave_relationship();
                float refractory_multiplier = 0.6f;
                
                // If we detected 2x octave ambiguity (half-tempo bias), use shorter refractory
                if (octave_rel.relationship >= 1.8f && octave_rel.relationship <= 2.2f) {
                    refractory_multiplier = 0.3f; // Use faster tempo for refractory
                    LOG_DEBUG(TAG_AUDIO, "Octave ambiguity detected (%.1fx), using faster tempo for refractory", octave_rel.relationship);
                }
                
                uint32_t refractory_ms = (uint32_t)(expected_period_ms * refractory_multiplier);
                if (refractory_ms < 200) refractory_ms = 200;
                bool zero_cross = (prev_phase < 0.0f && phase >= 0.0f);
                if (zero_cross && input_active && (now_ms - g_last_beat_event_ms) >= refractory_ms && tempo_confidence > adaptive) {
                    uint32_t ts_us = (uint32_t)esp_timer_get_time();
                    // Validate timestamp to prevent zero values
                    if (ts_us == 0) {
                        LOG_WARN(TAG_AUDIO, "Invalid timestamp from esp_timer_get_time() in phase detection");
                        ts_us = 1; // Use minimum valid timestamp
                    }
                    uint16_t conf_u16 = (uint16_t)(fminf(tempo_confidence, 1.0f) * 65535.0f);
                    // Ensure confidence is not zero to prevent invalid events
                    if (conf_u16 == 0) conf_u16 = 1;
                    bool ok = beat_events_push(ts_us, conf_u16);
                    if (ok) {
                        g_last_beat_event_ms = now_ms;
                    } else {
                        LOG_WARN(TAG_AUDIO, "Beat event buffer overwrite (capacity reached) - suppressing beat");
                    }
                    float best_bpm = get_best_bpm();
                    // Rate limit beat detection logging to prevent flooding (thread-safe)
                    static std::atomic<uint32_t> last_beat_log_ms{0};
                    uint32_t now_log_ms = millis();
                    uint32_t last_ms = last_beat_log_ms.load(std::memory_order_acquire);
                    if (now_log_ms - last_ms >= 1000) {  // Max 1 log per second
                        LOG_INFO(TAG_BEAT, "BEAT detected @ %.1f BPM", best_bpm);
                        last_beat_log_ms.store(now_log_ms, std::memory_order_release);
                    }
                    emitted = true;
                }
                prev_phase = phase;
            }
            if (vu_ok && !emitted) {
                // Fallback: confidence + refractory gating
                float bpm_for_period = get_best_bpm();
                bpm_for_period = fmaxf(30.0f, fminf(200.0f, bpm_for_period));
                uint32_t expected_period_ms = (uint32_t)(60000.0f / bpm_for_period);
                
                // Smart refractory calculation - check for octave ambiguity
                extern OctaveRelationship get_current_octave_relationship();
                OctaveRelationship octave_rel = get_current_octave_relationship();
                float refractory_multiplier = 0.6f;
                
                // If we detected 2x octave ambiguity (half-tempo bias), use shorter refractory
                if (octave_rel.relationship >= 1.8f && octave_rel.relationship <= 2.2f) {
                    refractory_multiplier = 0.3f; // Use faster tempo for refractory
                    LOG_DEBUG(TAG_AUDIO, "Fallback: Octave ambiguity detected (%.1fx), using faster tempo for refractory", octave_rel.relationship);
                }
                
                uint32_t refractory_ms = (uint32_t)(expected_period_ms * refractory_multiplier);
                if (refractory_ms < 200) refractory_ms = 200;
                if (input_active && tempo_confidence > adaptive && (now_ms - g_last_beat_event_ms) >= refractory_ms) {
                    uint32_t ts_us = (uint32_t)esp_timer_get_time();
                    // Validate timestamp to prevent zero values
                    if (ts_us == 0) {
                        LOG_WARN(TAG_AUDIO, "Invalid timestamp from esp_timer_get_time()");
                        ts_us = 1; // Use minimum valid timestamp
                    }
                    uint16_t conf_u16 = (uint16_t)(fminf(tempo_confidence, 1.0f) * 65535.0f);
                    // Ensure confidence is not zero to prevent invalid events
                    if (conf_u16 == 0) conf_u16 = 1;
                    bool ok = beat_events_push(ts_us, conf_u16);
                    if (ok) {
                        g_last_beat_event_ms = now_ms;
                    } else {
                        LOG_WARN(TAG_AUDIO, "Beat event buffer overwrite (capacity reached) - suppressing beat");
                    }

                    // Log BEAT_EVENT with detected BPM (rate limited to avoid flooding, thread-safe)
                    float best_bpm = get_best_bpm();
                    static std::atomic<uint32_t> last_beat_log_ms{0};
                    uint32_t now_log_ms = millis();
                    uint32_t last_ms = last_beat_log_ms.load(std::memory_order_acquire);
                    if (now_log_ms - last_ms >= 1000) {  // Rate limit: max 1 log per second
                        LOG_INFO(TAG_BEAT, "BEAT detected @ %.1f BPM", best_bpm);
                        last_beat_log_ms.store(now_log_ms, std::memory_order_release);
                    }
                }
            }
            // Always end probe; latency printing is internally rate-limited and disabled by default
            if (probe_started) beat_events_probe_end("audio_step");
            if (!vu_ok) {
                static uint32_t last_lowvu_ms = 0;
                if ((now_ms - last_lowvu_ms) >= 3000) {
                    LOG_DEBUG(TAG_AUDIO, "Beat gated by VU (%.2f < gate)", audio_level);
                    last_lowvu_ms = now_ms;
                }
            }
            // ================================================================
            // AUDIO DIAGNOSTICS PANEL (every 3 seconds)
            // ================================================================
            static uint32_t last_diag_ms = 0;
            uint32_t diag_interval = 3000;  // 3 second interval
            if ((now_ms - last_diag_ms) >= diag_interval) {
                float best_bpm = get_best_bpm();

                // Basic status line (always shown)
                LOG_INFO(TAG_AUDIO, "BPM: " COLOR_BPM "%.1f" COLOR_RESET " | VU: %.2f", best_bpm, audio_level);

                // Extended diagnostics (toggle with 'd' key)
                if (audio_debug_enabled) {
                    LOG_INFO(TAG_AUDIO, "═══ AUDIO DIAGNOSTICS ═══");

                    // I2S Microphone Status
                    extern float sample_history[];
                    float sample_peak = 0.0f;
                    float sample_rms = 0.0f;
                    for (int i = 0; i < 128; i++) {
                        float s = fabs(sample_history[i]);
                        sample_peak = fmaxf(sample_peak, s);
                        sample_rms += s * s;
                    }
                    sample_rms = sqrtf(sample_rms / 128.0f);
                    LOG_INFO(TAG_AUDIO, "I2S: peak=%.0f rms=%.0f (normalized ±131072)", sample_peak, sample_rms);

                    // Spectrum Energy Distribution
                    extern float spectrogram[NUM_FREQS];
                    float spec_low = 0.0f, spec_mid = 0.0f, spec_high = 0.0f;
                    for (int i = 0; i < 21; i++) spec_low += spectrogram[i];      // 0-21: Low (bass)
                    for (int i = 21; i < 43; i++) spec_mid += spectrogram[i];     // 21-43: Mid
                    for (int i = 43; i < NUM_FREQS; i++) spec_high += spectrogram[i]; // 43-64: High
                    LOG_INFO(TAG_AUDIO, "SPECTRUM: low=%.3f mid=%.3f high=%.3f", spec_low, spec_mid, spec_high);

                    // VU Meter Details
                    extern volatile float vu_max;
                    LOG_INFO(TAG_AUDIO, "VU: level=%.3f peak=%.3f gate=%.2f", audio_level, vu_max, VU_LOCK_GATE);

                    // Novelty & Tempo
                    float novelty_recent = 0.0f;
                    for (int i = 0; i < 10; i++) {
                        novelty_recent += novelty_curve_normalized[(NOVELTY_HISTORY_LENGTH - 10) + i];
                    }
                    novelty_recent /= 10.0f;
                    LOG_INFO(TAG_AUDIO, "NOVELTY: recent_avg=%.4f silence=%.2f", novelty_recent, silence_level);
                    LOG_INFO(TAG_AUDIO, "TEMPO: conf=%.3f power_sum=%.3f", tempo_confidence, tempi_power_sum);

                    // AGC Internal State (v2.1.1: envelope follower shows smoothed energy)
                    extern CochlearAGC* g_cochlear_agc;
                    if (g_cochlear_agc) {
                        LOG_INFO(TAG_AUDIO, "AGC: gain=%.2fx | E_inst=%.6f E_smooth=%.6f | bands[0]=%.2fx [2]=%.2fx",
                                 g_cochlear_agc->get_global_gain(),
                                 g_cochlear_agc->get_current_energy(),
                                 g_cochlear_agc->get_smoothed_energy(),
                                 g_cochlear_agc->get_band_gain(0),
                                 g_cochlear_agc->get_band_gain(2));
                    }

                    LOG_INFO(TAG_AUDIO, "═══════════════════════");
                }

                last_diag_ms = now_ms;
            }
            if (probe_started) {
                beat_events_probe_end("audio_step");
            }
        } else if (probe_started) {
            beat_events_probe_end("audio_step");
        }

        // Lock-free buffer synchronization with Core 1
        finish_audio_frame();          // ~0-5ms buffer swap

        // Yield to prevent CPU starvation
        // 1ms yield allows 40-50 Hz audio processing rate
        vTaskDelay(pdMS_TO_TICKS(1));
    }
}

// ============================================================================
// SINGLE-SHOT AUDIO PIPELINE (fallback when audio_task is unavailable)
// ============================================================================
static inline void run_audio_pipeline_once() {
    // If audio reactivity is disabled, invalidate snapshot and return
    if (!EMOTISCOPE_ACTIVE) {
        memset(audio_back.payload.spectrogram, 0, sizeof(float) * NUM_FREQS);
        memset(audio_back.payload.spectrogram_smooth, 0, sizeof(float) * NUM_FREQS);
        memset(audio_back.payload.chromagram, 0, sizeof(float) * 12);
        audio_back.payload.vu_level = 0.0f;
        audio_back.payload.vu_level_raw = 0.0f;
        memset(audio_back.payload.tempo_magnitude, 0, sizeof(float) * NUM_TEMPI);
        memset(audio_back.payload.tempo_phase, 0, sizeof(float) * NUM_TEMPI);
        audio_back.payload.tempo_confidence = 0.0f;
        audio_back.payload.is_valid = false;
        audio_back.payload.timestamp_us = micros();
        commit_audio_data();
        return;
    }

    // Process audio chunk (I2S blocking isolated to Core 1)
    acquire_sample_chunk();        // Blocks on I2S if needed (acceptable here)
    calculate_magnitudes();        // ~15-25ms Goertzel computation
    get_chromagram();              // ~1ms pitch aggregation

    // BEAT DETECTION PIPELINE (Emotiscope parity)
    t_now_us = micros();
    t_now_ms = millis();
    run_vu();
    update_novelty();
    beat_events_probe_start();
    update_tempo();
    static uint32_t last_phase_us_once = 0;
    if (last_phase_us_once == 0) last_phase_us_once = t_now_us;
    uint32_t dt_us_once = t_now_us - last_phase_us_once;
    last_phase_us_once = t_now_us;
    const float ideal_us_per_frame_once = 1000000.0f / REFERENCE_FPS;
    float delta_once = dt_us_once / ideal_us_per_frame_once;
    if (delta_once < 0.0f) delta_once = 0.0f;
    if (delta_once > 5.0f) delta_once = 5.0f;
    update_tempi_phase(delta_once);

    // SYNC TEMPO CONFIDENCE TO AUDIO SNAPSHOT (guarded)
    extern float tempo_confidence;  // From tempo.cpp
    static portMUX_TYPE audio_spinlock = portMUX_INITIALIZER_UNLOCKED;
    portENTER_CRITICAL(&audio_spinlock);
    audio_back.payload.tempo_confidence = tempo_confidence;
    portEXIT_CRITICAL(&audio_spinlock);

    // SYNC TEMPO MAGNITUDE AND PHASE ARRAYS
    extern tempo tempi[NUM_TEMPI];  // From tempo.cpp (96 tempo hypotheses)
    portENTER_CRITICAL(&audio_spinlock);
    for (uint16_t i = 0; i < NUM_TEMPI; i++) {
        audio_back.payload.tempo_magnitude[i] = tempi[i].magnitude;
        audio_back.payload.tempo_phase[i] = tempi[i].phase;
    }
    portEXIT_CRITICAL(&audio_spinlock);

    // Beat event: gate by confidence AND expected period (derived from BPM)
    {
        uint32_t now_ms = millis();
        extern float tempo_confidence;  // From tempo.cpp
        extern float silence_level;
        // Hard VU gate in single-shot mode as well
        if (audio_level < VU_LOCK_GATE) {
            if (beat_events_probe_active()) beat_events_probe_end("audio_to_event");
            return;
        }
        float novelty_recent = novelty_curve_normalized[NOVELTY_HISTORY_LENGTH - 1];
        const float base_threshold = get_params().beat_threshold;
        float adaptive = base_threshold + (0.20f * (1.0f - silence_level)) + (0.10f * fminf(novelty_recent, 1.0f));
        float bpm_for_period = get_best_bpm();
        if (s_enhanced_tempo_active && s_etd && s_etd->is_locked()) {
            bpm_for_period = s_etd->current_bpm();
        }
        bpm_for_period = fmaxf(30.0f, fminf(200.0f, bpm_for_period));
        uint32_t expected_period_ms = (uint32_t)(60000.0f / bpm_for_period);
        
        // Smart refractory calculation - check for octave ambiguity
        extern OctaveRelationship get_current_octave_relationship();
        OctaveRelationship octave_rel = get_current_octave_relationship();
        float refractory_multiplier = 0.6f;
        
        // If we detected 2x octave ambiguity (half-tempo bias), use shorter refractory
        if (octave_rel.relationship >= 1.8f && octave_rel.relationship <= 2.2f) {
            refractory_multiplier = 0.3f; // Use faster tempo for refractory
            LOG_DEBUG(TAG_AUDIO, "Single-shot: Octave ambiguity detected (%.1fx), using faster tempo for refractory", octave_rel.relationship);
        }
        
        uint32_t refractory_ms = (uint32_t)(expected_period_ms * refractory_multiplier);
        if (refractory_ms < 200) refractory_ms = 200;
        if (tempo_confidence > adaptive && (now_ms - g_last_beat_event_ms) >= refractory_ms) {
            uint32_t ts_us = (uint32_t)esp_timer_get_time();
            uint16_t conf_u16 = (uint16_t)(fminf(tempo_confidence, 1.0f) * 65535.0f);
            bool ok = beat_events_push(ts_us, conf_u16);
            beat_events_probe_end("audio_to_event");
            if (ok) {
                g_last_beat_event_ms = now_ms;
            } else {
                LOG_WARN(TAG_AUDIO, "Beat event buffer overwrite (capacity reached) - suppressing beat");
            }
        }
    }

    // Lock-free buffer synchronization with Core 0
    finish_audio_frame();
    heartbeat_logger_note_audio(audio_back.payload.update_counter);
    heartbeat_logger_note_audio(audio_back.payload.update_counter);
}

// ============================================================================
// GPU TASK - CORE 1 VISUAL RENDERING (NEW)
// ============================================================================
// This function runs on Core 1 and handles all visual rendering
// - Pattern rendering at 100+ FPS
// - LED transmission via RMT
// - FPS tracking and diagnostics
// - Never waits for audio (reads latest available data)
void loop_gpu(void* param) {
    LOG_INFO(TAG_CORE0, "GPU_TASK Starting on Core 1");

    static uint32_t start_time = millis();
#if FRAME_METRICS_ENABLED
    static uint64_t prev_quantize_us = 0;
    static uint64_t prev_wait_us = 0;
    static uint64_t prev_tx_us = 0;
#endif

    for (;;) {
        uint32_t t_frame_start = micros();
        // Track time for animation
        float time = (millis() - start_time) / 1000.0f;

        // Get current parameters (thread-safe read from active buffer)
        const PatternParameters& params = get_params();
        // Phase 0: force channel index 0 for legacy render path
        extern uint8_t g_pattern_channel_index;
        g_pattern_channel_index = 0;

        // Use pattern-level brightness only; keep transport scale at 1.0 to avoid double-scaling
        extern float global_brightness;
        global_brightness = 1.0f;

        // Draw current pattern with audio-reactive data (lock-free read from audio_front)
        uint32_t t_render = micros();

        // Create the render context
        AudioDataSnapshot audio_snapshot;
        get_audio_snapshot(&audio_snapshot);
        PatternRenderContext context(leds, NUM_LEDS, time, params, audio_snapshot);

        draw_current_pattern(context);

        // Apply legacy color post-processing (warmth, white balance, gamma)
        apply_color_pipeline(params);
        uint32_t t_post_render = micros();

        uint32_t render_us = t_post_render - t_frame_start;
        ACCUM_RENDER_US.fetch_add(render_us, std::memory_order_relaxed);

        // Quantize (built into transmit_leds, measured separately)
        uint32_t t_quantize = micros();
        // Transmit to LEDs via RMT (non-blocking DMA)
        transmit_leds();
        uint32_t t_post_tx = micros();
        heartbeat_logger_note_frame();

#if FRAME_METRICS_ENABLED
        uint64_t quant_sum = ACCUM_QUANTIZE_US.load(std::memory_order_relaxed);
        uint64_t wait_sum = ACCUM_RMT_WAIT_US.load(std::memory_order_relaxed);
        uint64_t tx_sum = ACCUM_RMT_TRANSMIT_US.load(std::memory_order_relaxed);

        uint32_t quant_frame = quant_sum > prev_quantize_us ? (uint32_t)(quant_sum - prev_quantize_us) : 0;
        uint32_t wait_frame = wait_sum > prev_wait_us ? (uint32_t)(wait_sum - prev_wait_us) : 0;
        uint32_t tx_frame = tx_sum > prev_tx_us ? (uint32_t)(tx_sum - prev_tx_us) : 0;

        prev_quantize_us = quant_sum;
        prev_wait_us = wait_sum;
        prev_tx_us = tx_sum;

        uint32_t fps_snapshot = (uint32_t)lroundf(fmaxf(FPS_CPU, 0.0f) * 100.0f);
        FrameMetricsBuffer::instance().record_frame(render_us, quant_frame, wait_frame, tx_frame, (uint16_t)fminf(fps_snapshot, 65535.0f));
#endif

        // FPS tracking (minimal overhead)
        watch_cpu_fps();
        print_fps();

        // No delay - run at maximum performance
        // The RMT wait in transmit_leds() provides natural pacing
    }
}

// ============================================================================
// SETUP - Initialize hardware, create tasks
// ============================================================================
void setup() {
    Serial.begin(250000);  // Match serial monitor max baud rate (was 2000000 - 8× too fast!)
    Serial.setRxBufferSize(1024);  // Increase RX buffer from 256 to 1024 bytes
    LOG_INFO(TAG_CORE0, "=== K1.reinvented Starting ===");

    // Print build environment and IDF/Arduino versions up front (so we catch cursed mismatches early)
#ifdef ARDUINO_ESP32_RELEASE_3_0_0
    LOG_INFO(TAG_CORE0, "Build: Arduino core %s", ARDUINO_ESP32_RELEASE_3_0_0);
#endif
#ifdef ARDUINO
    LOG_INFO(TAG_CORE0, "Build: ARDUINO macro %d", ARDUINO);
#endif
#ifdef IDF_VER
    LOG_INFO(TAG_CORE0, "Build: ESP-IDF %s", IDF_VER);
#endif
#ifdef REQUIRE_IDF5_DUAL_RMT
    LOG_INFO(TAG_CORE0, "Build: REQUIRE_IDF5_DUAL_RMT=1 (dual RMT enforced)");
#endif

    // Initialize LED driver
    LOG_INFO(TAG_LED, "Initializing LED driver...");
    init_rmt_driver();  // Initialize RMT driver for LED output
    // Initialize LED TX rolling buffer (retain ~5-10s history)
    led_tx_events_init(256);


    // Print keyboard controls help (menu-driven to minimize unique keys)
    LOG_INFO(TAG_CORE1, "========== KEYBOARD CONTROLS ==========");
    LOG_INFO(TAG_CORE1, "  SPACEBAR  - Cycle to next pattern");
    LOG_INFO(TAG_CORE1, "  a         - Toggle AGC (Cochlear +40dB boost)");
    LOG_INFO(TAG_CORE1, "  d         - Toggle audio diagnostics panel");
    LOG_INFO(TAG_CORE1, "  t         - Toggle tempo debug (spectrum dump)");
    LOG_INFO(TAG_CORE1, "  m         - Open/close Debug Menu");
    LOG_INFO(TAG_CORE1, "=======================================");

    // Initialize UART for s3z daisy chain sync (gated)
#if ENABLE_UART_SYNC
    LOG_INFO(TAG_SYNC, "Initializing UART daisy chain sync...");
    init_uart_sync();
#endif

    // Configure WiFi link options (defaults retain current stable behavior)
    WifiLinkOptions wifi_opts;
    wifi_opts.force_bg_only = true; // default if NVS missing
    wifi_opts.force_ht20 = true;    // default if NVS missing
    wifi_monitor_load_link_options_from_nvs(wifi_opts);
    wifi_monitor_set_link_options(wifi_opts);

    // Initialize WiFi monitor/state machine
    wifi_monitor_on_connect(handle_wifi_connected);
    wifi_monitor_on_disconnect(handle_wifi_disconnected);
    wifi_monitor_init(nullptr, nullptr);  // Load from NVS or enter provisioning mode

    // Initialize OTA
    ArduinoOTA.setHostname("k1-reinvented");
    ArduinoOTA.onStart([]() {
        LOG_INFO(TAG_CORE0, "OTA Update starting...");
    });
    ArduinoOTA.onEnd([]() {
        LOG_INFO(TAG_CORE0, "OTA Update complete!");
    });
    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
        LOG_DEBUG(TAG_CORE0, "Progress: %u%%", (progress / (total / 100)));
    });
    ArduinoOTA.onError([](ota_error_t error) {
        const char* error_msg = "Unknown";
        switch (error) {
            case OTA_AUTH_ERROR:    error_msg = "Auth Failed"; break;
            case OTA_BEGIN_ERROR:   error_msg = "Begin Failed"; break;
            case OTA_CONNECT_ERROR: error_msg = "Connect Failed"; break;
            case OTA_RECEIVE_ERROR: error_msg = "Receive Failed"; break;
            case OTA_END_ERROR:     error_msg = "End Failed"; break;
        }
        LOG_ERROR(TAG_CORE0, "OTA Error[%u]: %s", error, error_msg);
    });

    // SPIFFS enumeration REMOVED - was blocking startup 100-500ms
    // Initialize SPIFFS silently and defer enumeration to background task
    LOG_INFO(TAG_CORE0, "Initializing SPIFFS...");
    if (!SPIFFS.begin(true)) {
        LOG_ERROR(TAG_CORE0, "SPIFFS initialization failed - web UI will not be available");
    } else {
        LOG_INFO(TAG_CORE0, "SPIFFS mounted successfully");
        // Lazy enumeration removed; can be added to status endpoint if needed
        heartbeat_logger_init();
    }

    // Defer web server and diagnostics until Wi-Fi connects (see handle_wifi_connected)

    // Initialize audio stubs (demo audio-reactive globals)
    LOG_INFO(TAG_AUDIO, "Initializing audio-reactive stubs...");
    init_audio_stubs();

    // Initialize SPH0645 microphone I2S input
    LOG_INFO(TAG_I2S, "Initializing SPH0645 microphone...");
    init_i2s_microphone();

    // PHASE 1: Initialize audio data synchronization (double-buffering)
    LOG_INFO(TAG_SYNC, "Initializing audio data sync...");
    init_audio_data_sync();

    // Initialize Goertzel DFT constants and window function
    LOG_INFO(TAG_AUDIO, "Initializing Goertzel DFT...");
    init_window_lookup();
    init_goertzel_constants_musical();

    // Initialize Cochlear AGC (multi-band adaptive gain control)
    LOG_INFO(TAG_AUDIO, "Initializing Cochlear AGC v2.1...");
    extern CochlearAGC* g_cochlear_agc;
    g_cochlear_agc = new CochlearAGC();
    if (g_cochlear_agc && g_cochlear_agc->initialize(NUM_FREQS, 100.0f)) {
        LOG_INFO(TAG_AUDIO, "Cochlear AGC v2.1.1: 64 bins, 100Hz, +40dB max");
        LOG_INFO(TAG_AUDIO, "  RMS envelope: 100ms/150ms | Leveling: 3s/8s");
    } else {
        LOG_WARN(TAG_AUDIO, "Cochlear AGC initialization failed - continuing without AGC");
        delete g_cochlear_agc;
        g_cochlear_agc = nullptr;
    }

    LOG_INFO(TAG_AUDIO, "Initializing VU meter...");
    init_vu();

    // Initialize tempo detection (beat detection pipeline)
    LOG_INFO(TAG_TEMPO, "Initializing tempo detection...");
    init_tempo_goertzel_constants();
    // Enhanced detector DISABLED - using pure Emotiscope tempo only
    // s_etd = new EnhancedTempoDetector();
    // if (s_etd && s_etd->init()) {
    //     LOG_INFO(TAG_TEMPO, "Enhanced tempo detector ENABLED (%d bins)", ENHANCED_NUM_TEMPI);
    //     s_enhanced_tempo_active = true;
    // } else {
    //     LOG_WARN(TAG_TEMPO, "Enhanced tempo detector unavailable; falling back to classic Goertzel");
    //     s_enhanced_tempo_active = false;
    // }
    LOG_INFO(TAG_TEMPO, "Using classic Emotiscope tempo detector only (96 bins)");

    // Initialize beat event ring buffer and latency probes
    // Capacity 128 ≈ 25s history at ~5.3 beats/sec, ~10s at 12Hz (high-frequency content)
    beat_events_init(128);
    // Tone down latency probe logging: print at most every 5 seconds
    beat_events_set_probe_interval_ms(5000);
    
    // Validate beat events initialization
    if (beat_events_capacity() != 128) {
        LOG_WARN(TAG_CORE0, "Beat events buffer initialization failed, capacity=%u", beat_events_capacity());
    } else {
        LOG_INFO(TAG_CORE0, "Beat events buffer initialized successfully");
    }

    // Initialize parameter system
    LOG_INFO(TAG_CORE0, "Initializing parameters...");
    init_params();

    // Initialize pattern registry
    LOG_INFO(TAG_CORE0, "Initializing pattern registry...");
    init_pattern_registry();
    // init_hue_wheel_lut();  // Disabled: hue wheel LUT not required; hsv() uses direct math fallback
    LOG_INFO(TAG_CORE0, "Loaded %d patterns", g_num_patterns);

    // Initialize shared pattern buffers to reduce memory usage
    LOG_INFO(TAG_CORE0, "Initializing shared pattern buffers...");
    init_shared_pattern_buffers();

    // Apply performance optimizations to underperforming patterns
    // apply_pattern_optimizations();
    // LOG_INFO(TAG_CORE0, "Applied pattern optimizations");

    // If codegen flags are enabled, override selected patterns to use generated implementations
    apply_codegen_overrides();

    LOG_INFO(TAG_CORE0, "Starting pattern: %s", get_current_pattern().name);

    // ========================================================================
    // DUAL-CORE ARCHITECTURE ACTIVATION
    // ========================================================================
    // Core 0: Audio processing + network (shares core with Wi-Fi stack)
    // Core 1: GPU rendering task (100+ FPS, never blocks)
    // Synchronization: Lock-free double buffer with sequence counters
    // ========================================================================
    LOG_INFO(TAG_CORE0, "Activating dual-core architecture...");

// Task handles for monitoring
    TaskHandle_t gpu_task_handle = NULL;
    TaskHandle_t audio_task_handle = NULL;

    // Create GPU/Visual task on Core 1
#ifdef DYNAMIC_LED_CHANNELS
    // Phase 0: VisualScheduler parity mode (uses channel A only, falls back to global RMT handles)
    static RenderChannel g_channel_a;
    static RenderChannel g_channel_b;
    static RenderChannel* g_channels[2] = { &g_channel_a, &g_channel_b };
    // Bind per-channel RMT handles and shared encoder
    g_channel_a.tx_handle = tx_chan_a ? tx_chan_a : tx_chan; // alias safe
    g_channel_b.tx_handle = tx_chan_b ? tx_chan_b : tx_chan; // fallback to A if B missing
    g_channel_a.encoder   = led_encoder;
    g_channel_b.encoder   = led_encoder;
    BaseType_t gpu_result = xTaskCreatePinnedToCore(
        visual_scheduler,   // Task function
        "visual_sched",     // Task name
        16384,              // Stack size (16KB for LED rendering + pattern complexity)
        (void*)g_channels,  // Parameters (channel set)
        1,                  // Priority (same as audio - no preemption preference)
        &gpu_task_handle,   // Task handle for monitoring
        1                   // Pin to Core 1 (keeps GPU away from Wi-Fi stack)
    );
#else
    // Legacy single-channel GPU loop
    BaseType_t gpu_result = xTaskCreatePinnedToCore(
        loop_gpu,           // Task function
        "loop_gpu",         // Task name
        16384,              // Stack size (16KB for LED rendering + pattern complexity)
        NULL,               // Parameters
        1,                  // Priority (same as audio - no preemption preference)
        &gpu_task_handle,   // Task handle for monitoring
        1                   // Pin to Core 1 (keeps GPU away from Wi-Fi stack)
    );
#endif

    // Create audio processing task on Core 0
    // INCREASED STACK: 8KB -> 12KB (1,692 bytes margin was dangerously low)
    BaseType_t audio_result = xTaskCreatePinnedToCore(
        audio_task,         // Task function
        "audio_task",       // Task name
        12288,              // Stack size (12KB for Goertzel + I2S + tempo detection)
        NULL,               // Parameters
        1,                  // Priority (same as GPU)
        &audio_task_handle, // Task handle for monitoring
        0                   // Pin to Core 0 (shares core with Wi-Fi/OTA)
    );

    // Validate task creation (CRITICAL: Must not fail)
    if (gpu_result != pdPASS || gpu_task_handle == NULL) {
        LOG_ERROR(TAG_GPU, "FATAL ERROR: GPU task creation failed!");
        LOG_ERROR(TAG_CORE0, "System cannot continue. Rebooting...");
        delay(5000);
        esp_restart();
    }

    if (audio_result != pdPASS || audio_task_handle == NULL) {
        LOG_ERROR(TAG_AUDIO, "FATAL ERROR: Audio task creation failed!");
        LOG_ERROR(TAG_CORE0, "System cannot continue. Rebooting...");
        delay(5000);
        esp_restart();
    } else {
        s_audio_task_running = true;
    }

    LOG_INFO(TAG_CORE0, "Dual-core tasks created successfully:");
    LOG_INFO(TAG_GPU, "Core 1: GPU rendering (100+ FPS target)");
    LOG_DEBUG(TAG_GPU, "Stack: 16KB (was 12KB, increased for safety)");
    LOG_INFO(TAG_AUDIO, "Core 0: Audio processing + network");
    LOG_DEBUG(TAG_AUDIO, "Stack: 12KB (was 8KB, increased for safety)");
    LOG_DEBUG(TAG_SYNC, "Synchronization: Lock-free with sequence counters + memory barriers");
    LOG_INFO(TAG_CORE0, "Ready!");
    LOG_INFO(TAG_CORE0, "Upload new effects with:");
    LOG_INFO(TAG_CORE0, "pio run -t upload --upload-port %s.local", ArduinoOTA.getHostname());
}

// ============================================================================
// MAIN LOOP - Runs on Core 1 (Network + System Management)
// ============================================================================
void loop() {
    // Core 1 main loop: Network services and system management
    // Audio processing now handled by dedicated audio_task on Core 0
    // Visual rendering now handled by dedicated loop_gpu on Core 1

    // Compact debug menu: reduce unique keystrokes using a menu state machine
    static enum { MENU_OFF, MENU_MAIN, MENU_TAGS_PAGE1, MENU_TAGS_PAGE2 } dbg_menu_state = MENU_OFF;
    auto print_menu_main = []() {
        LOG_INFO(TAG_CORE1, "==== DEBUG MENU ====");
        uint8_t lvl = Logger::get_level();
        const char* name = (lvl == LOG_LEVEL_DEBUG) ? "DEBUG" : (lvl == LOG_LEVEL_INFO) ? "INFO" : (lvl == LOG_LEVEL_WARN) ? "WARN" : "ERROR";
        LOG_INFO(TAG_CORE1, "Level: %s", name);
        LOG_INFO(TAG_CORE1, "Audio debug: %s", audio_debug_enabled ? "ON" : "OFF");
        LOG_INFO(TAG_CORE1, "--------------------");
        LOG_INFO(TAG_CORE1, "  1) Cycle log level");
        LOG_INFO(TAG_CORE1, "  2) Toggle audio debug");
        LOG_INFO(TAG_CORE1, "  3) Dump heartbeat logs");
        LOG_INFO(TAG_CORE1, "  4) Toggle log tags...");
        LOG_INFO(TAG_CORE1, "  0) Close menu");
        LOG_INFO(TAG_CORE1, "====================");
    };
    auto print_menu_tags_page1 = []() {
        LOG_INFO(TAG_CORE1, "-- Toggle Tags (1/2) --");
        LOG_INFO(TAG_CORE1, "1) Audio   [%s]",   Logger::get_tag_enabled(TAG_AUDIO)  ? "ON" : "OFF");
        LOG_INFO(TAG_CORE1, "2) GPU     [%s]",   Logger::get_tag_enabled(TAG_GPU)    ? "ON" : "OFF");
        LOG_INFO(TAG_CORE1, "3) I2S     [%s]",   Logger::get_tag_enabled(TAG_I2S)    ? "ON" : "OFF");
        LOG_INFO(TAG_CORE1, "4) LED     [%s]",   Logger::get_tag_enabled(TAG_LED)    ? "ON" : "OFF");
        LOG_INFO(TAG_CORE1, "5) Tempo   [%s]",   Logger::get_tag_enabled(TAG_TEMPO)  ? "ON" : "OFF");
        LOG_INFO(TAG_CORE1, "6) Beat    [%s]",   Logger::get_tag_enabled(TAG_BEAT)   ? "ON" : "OFF");
        LOG_INFO(TAG_CORE1, "7) Sync    [%s]",   Logger::get_tag_enabled(TAG_SYNC)   ? "ON" : "OFF");
        LOG_INFO(TAG_CORE1, "8) WiFi    [%s]",   Logger::get_tag_enabled(TAG_WIFI)   ? "ON" : "OFF");
        LOG_INFO(TAG_CORE1, "9) Web     [%s]",   Logger::get_tag_enabled(TAG_WEB)    ? "ON" : "OFF");
        LOG_INFO(TAG_CORE1, "0) Next page");
    };
    auto print_menu_tags_page2 = []() {
        LOG_INFO(TAG_CORE1, "-- Toggle Tags (2/2) --");
        LOG_INFO(TAG_CORE1, "1) Memory  [%s]",   Logger::get_tag_enabled(TAG_MEMORY) ? "ON" : "OFF");
        LOG_INFO(TAG_CORE1, "2) Profile [%s]",   Logger::get_tag_enabled(TAG_PROFILE)? "ON" : "OFF");
        LOG_INFO(TAG_CORE1, "9) Prev page");
        LOG_INFO(TAG_CORE1, "0) Back to main");
    };

    // Process ALL available characters in serial buffer (not just one)
    while (Serial.available() > 0) {
        char ch = Serial.read();
        if (ch == ' ') {  // SPACEBAR - cycle to next pattern (operational)
            g_current_pattern_index = (g_current_pattern_index + 1) % g_num_patterns;
            const PatternInfo& pattern = g_pattern_registry[g_current_pattern_index];
            LOG_INFO(TAG_CORE1, "PATTERN CHANGED: " COLOR_PATTERN "[%d]" COLOR_RESET " %s - %s", g_current_pattern_index, pattern.name, pattern.description);
            LOG_INFO(TAG_CORE1, "Pattern changed via spacebar to: %s", pattern.name);
        } else if (ch == 'd') { // Toggle audio diagnostics (direct toggle, no menu)
            audio_debug_enabled = !audio_debug_enabled;
            LOG_INFO(TAG_AUDIO, "Audio diagnostics: %s", audio_debug_enabled ? "ON" : "OFF");
        } else if (ch == 't') { // Toggle tempo debug (direct toggle, no menu)
            tempo_debug_enabled = !tempo_debug_enabled;
            LOG_INFO(TAG_TEMPO, "Tempo debug: %s", tempo_debug_enabled ? "ON" : "OFF");
        } else if (ch == 'a') { // Toggle AGC (direct toggle, no menu)
            extern CochlearAGC* g_cochlear_agc;
            if (g_cochlear_agc) {
                static bool agc_enabled = true;
                agc_enabled = !agc_enabled;
                g_cochlear_agc->enable(agc_enabled);
                LOG_INFO(TAG_AUDIO, "Cochlear AGC: %s", agc_enabled ? "ENABLED (+40dB boost)" : "DISABLED (bypassed)");
            } else {
                LOG_WARN(TAG_AUDIO, "AGC not initialized - cannot toggle");
            }
        } else if (ch == 'm') { // Toggle menu (lowercase only)
            if (dbg_menu_state == MENU_OFF) { dbg_menu_state = MENU_MAIN; print_menu_main(); }
            else { dbg_menu_state = MENU_OFF; LOG_DEBUG(TAG_CORE1, "Menu closed"); }
        } else if (dbg_menu_state != MENU_OFF) {
            // Handle menu input using digits only
            switch (dbg_menu_state) {
                case MENU_MAIN:
                    if (ch == '1') {
                        uint8_t lvl = Logger::get_level();
                        uint8_t next = (lvl == LOG_LEVEL_DEBUG) ? LOG_LEVEL_INFO : (lvl == LOG_LEVEL_INFO) ? LOG_LEVEL_WARN : (lvl == LOG_LEVEL_WARN) ? LOG_LEVEL_ERROR : LOG_LEVEL_DEBUG;
                        Logger::set_level(next);
                        const char* name = (next == LOG_LEVEL_DEBUG) ? "DEBUG" : (next == LOG_LEVEL_INFO) ? "INFO" : (next == LOG_LEVEL_WARN) ? "WARN" : "ERROR";
                        LOG_DEBUG(TAG_CORE1, "Log level: %s", name);
                        print_menu_main();
                    } else if (ch == '2') {
                        audio_debug_enabled = !audio_debug_enabled;
                        LOG_DEBUG(TAG_CORE1, "Audio debug: %s", audio_debug_enabled ? "ON" : "OFF");
                        print_menu_main();
                    } else if (ch == '3') {
                        heartbeat_logger_dump_recent(Serial);
                        print_menu_main();
                    } else if (ch == '4') {
                        dbg_menu_state = MENU_TAGS_PAGE1;
                        print_menu_tags_page1();
                    } else if (ch == '0') {
                        dbg_menu_state = MENU_OFF;
                    LOG_DEBUG(TAG_CORE1, "Menu closed");
                    }
                    break;
                case MENU_TAGS_PAGE1:
                    if (ch == '1') { Logger::toggle_tag(TAG_AUDIO);  print_menu_tags_page1(); }
                    else if (ch == '2') { Logger::toggle_tag(TAG_GPU);    print_menu_tags_page1(); }
                    else if (ch == '3') { Logger::toggle_tag(TAG_I2S);    print_menu_tags_page1(); }
                    else if (ch == '4') { Logger::toggle_tag(TAG_LED);    print_menu_tags_page1(); }
                    else if (ch == '5') { Logger::toggle_tag(TAG_TEMPO);  print_menu_tags_page1(); }
                    else if (ch == '6') { Logger::toggle_tag(TAG_BEAT);   print_menu_tags_page1(); }
                    else if (ch == '7') { Logger::toggle_tag(TAG_SYNC);   print_menu_tags_page1(); }
                    else if (ch == '8') { Logger::toggle_tag(TAG_WIFI);   print_menu_tags_page1(); }
                    else if (ch == '9') { Logger::toggle_tag(TAG_WEB);    print_menu_tags_page1(); }
                    else if (ch == '0') { dbg_menu_state = MENU_TAGS_PAGE2; print_menu_tags_page2(); }
                    break;
                case MENU_TAGS_PAGE2:
                    if (ch == '1') { Logger::toggle_tag(TAG_MEMORY); print_menu_tags_page2(); }
                    else if (ch == '2') { Logger::toggle_tag(TAG_PROFILE); print_menu_tags_page2(); }
                    else if (ch == '9') { dbg_menu_state = MENU_TAGS_PAGE1; print_menu_tags_page1(); }
                    else if (ch == '0') { dbg_menu_state = MENU_MAIN; print_menu_main(); }
                    break;
                default: break;
            }
        }
    }

    // Handle OTA updates (non-blocking check)
    ArduinoOTA.handle();

    // Handle web server (includes WebSocket cleanup)
    handle_webserver();

    // Advance WiFi state machine so callbacks fire and reconnection logic runs
    wifi_monitor_loop();

    uint32_t now_ms = millis();

    // Run audio processing inline only if the dedicated task failed to start
    static uint32_t last_audio_ms = 0;
    const uint32_t audio_interval_ms = 20; // ~50 Hz audio processing fallback
    if (!s_audio_task_running && (now_ms - last_audio_ms) >= audio_interval_ms) {
        run_audio_pipeline_once();
        last_audio_ms = now_ms;
    }

    // Broadcast real-time data to WebSocket clients at 10 Hz
    static uint32_t last_broadcast_ms = 0;
    const uint32_t broadcast_interval_ms = 100; // 10 Hz broadcast rate
    if ((now_ms - last_broadcast_ms) >= broadcast_interval_ms) {
        // Update CPU monitor before broadcasting
        cpu_monitor.update();
        broadcast_realtime_data();
        last_broadcast_ms = now_ms;
    }

    // Drain beat event ring buffer and forward over Serial (USB)
            // Limit per-loop drain to avoid starving other services
            for (int drained = 0; drained < 20 && beat_events_count() > 0; ++drained) {
                BeatEvent ev;
                if (beat_events_pop(&ev)) {
                    // Validate beat event data to prevent crashes
                    if (ev.timestamp_us == 0 || ev.confidence == 0) {
                        LOG_WARN(TAG_BEAT, "Invalid beat event data, skipping");
                        continue;
                    }
                    
                    // Rate limit BEAT_EVENT logging to prevent serial flooding (thread-safe)
                    static std::atomic<uint32_t> last_event_log_ms{0};
                    uint32_t now_event_ms = millis();
                    uint32_t last_ms = last_event_log_ms.load(std::memory_order_acquire);
                    if (now_event_ms - last_ms >= 1000) {  // Max 1 log per second
                        LOG_INFO(TAG_BEAT, "BEAT_EVENT ts_us=%lu conf=%u", (unsigned long)ev.timestamp_us, (unsigned)ev.confidence);
                        last_event_log_ms.store(now_event_ms, std::memory_order_release);
                    }
                } else {
                    break;
                }
    }

    // LED rendering is handled exclusively by loop_gpu task on Core 1
    // This loop (Core 1) handles network services plus light audio/bookkeeping helpers
    
    // Send sync packet to s3z secondary device (if enabled)
    send_uart_sync_frame();
    heartbeat_logger_poll();

    // Small delay to prevent this loop from consuming too much CPU
    // Core 1 (loop_gpu) handles all LED rendering at high FPS
    vTaskDelay(pdMS_TO_TICKS(5));
}

#endif  // UNIT_TEST

// All patterns are included from generated_patterns.h
// Audio processing now handled by dedicated audio_task on Core 0
// Gate UART daisy-chain sync behind a feature flag
#ifndef ENABLE_UART_SYNC
#define ENABLE_UART_SYNC 0
#endif

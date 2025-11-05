// -----------------------------------------------------------------
//   _                                            _
//  | |                                          | |
//  | |_    ___   _ __ ___    _ __     ___       | |__
//  | __|  / _ \ | '_ ` _ \  | '_ \   / _ \      | '_ \
//  | |_  |  __/ | | | | | | | |_) | | (_) |  _  | | | |
//   \__|  \___| |_| |_| |_| | .__/   \___/  (_) |_| |_|
//                           | |
//                           |_|
//
// Tempo Detection - Beat Detection and Tempo Hypothesis Tracking
// Interface header: type definitions, extern declarations, configuration

#ifndef TEMPO_H
#define TEMPO_H

#include "goertzel.h"
#include <stdint.h>

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

#define NOVELTY_HISTORY_LENGTH (1024)  // 50 FPS for 20.48 seconds
#define NOVELTY_LOG_HZ (50)

#define TEMPO_LOW (64 - 32)            // BPM range: 32-192 BPM
#define TEMPO_HIGH (192 - 32)

#define BEAT_SHIFT_PERCENT (0.08)
#define REFERENCE_FPS (100.0f)

// ============================================================================
// GLOBAL DATA (stored in goertzel.h - only tempo-specific state here)
// ============================================================================

// Tempo detection state
extern float tempi_bpm_values_hz[NUM_TEMPI];      // BPM center frequencies
extern float tempo_confidence;                     // Beat confidence (0.0-1.0)
extern float MAX_TEMPO_RANGE;

// Tempo tracking curves
extern float novelty_curve[NOVELTY_HISTORY_LENGTH];           // Spectral flux history
extern float novelty_curve_normalized[NOVELTY_HISTORY_LENGTH]; // Normalized novelty
extern float vu_curve[NOVELTY_HISTORY_LENGTH];                // VU level history
extern float tempi_power_sum;                                  // Sum of tempo magnitudes

// Silence detection
extern bool silence_detected;
extern float silence_level;
extern uint32_t t_now_us;
extern uint32_t t_now_ms;

// ============================================================================
// PUBLIC API - INITIALIZATION
// ============================================================================

// Initialize tempo Goertzel constants and tracking state
void init_tempo_goertzel_constants();

// ============================================================================
// PUBLIC API - TEMPO PROCESSING (called by audio task on Core 1)
// ============================================================================

void update_tempo();
void update_novelty();
void update_tempi_phase(float delta);
void check_silence(float current_novelty);

// ============================================================================
// PUBLIC API - UTILITY FUNCTIONS
// ============================================================================

// Find closest tempo bin to target BPM
uint16_t find_closest_tempo_bin(float target_bpm);

#endif  // TEMPO_H

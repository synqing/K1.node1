#pragma once

#include <atomic>
#include <cstring>
#include "tempo.h"
#include "goertzel.h"

/**
 * @brief Unified audio subsystem state
 *
 * Consolidates all global state from tempo.cpp, vu.cpp, and goertzel.cpp
 * into a single coherent structure. Preserves thread-safety properties
 * (atomics for multi-core sync, volatiles for ISR coordination).
 *
 * Thread safety:
 * - tempo_confidence, silence_detected: updated by audio task, read by pattern task
 * - vu_level*, magnitudes_locked: volatile/atomic for ISR sync
 * - novelty curves: written by audio task, read by pattern task (no sync needed)
 */
struct AudioSystemState {
    // ============ Tempo and Beat Detection ============
    float tempo_confidence = 0.0f;              // 0.0-1.0, beat strength
    bool silence_detected = false;              // True if input below floor
    float silence_level = 0.0f;                 // Silence detection threshold
    float max_tempo_range = 1.0f;               // Tempo range scalar
    uint32_t t_now_us = 0;                      // Current time (microseconds)
    uint32_t t_now_ms = 0;                      // Current time (milliseconds)
    float tempi_bpm_values_hz[NUM_TEMPI] = {}; // Tempo center frequencies (Hz)

    // ============ Spectral Analysis ============
    float novelty_curve[NOVELTY_HISTORY_LENGTH] = {};           // Spectral flux history
    float novelty_curve_normalized[NOVELTY_HISTORY_LENGTH] = {}; // Normalized flux
    float vu_curve[NOVELTY_HISTORY_LENGTH] = {};                // VU level history
    float tempi_power_sum = 0.0f;                                // Sum of all tempo magnitudes

    // ============ VU Metering (ISR + Audio Task) ============
    volatile float vu_level_raw = 0.0f;   // Raw amplitude envelope (from ISR)
    volatile float vu_level = 0.0f;       // Smoothed VU level (0-1)
    volatile float vu_max = 0.0f;         // Peak held level
    volatile float vu_floor = 0.0f;       // Noise floor (auto-calibrated)

    // ============ Audio Data Synchronization ============
    std::atomic<bool> magnitudes_locked{false}; // Seqlock for magnitude consistency

    // ============ Initialization State ============
    bool initialized = false;

    // ============ Lifecycle ============
    AudioSystemState() {
        reset();
    }

    void reset() {
        tempo_confidence = 0.0f;
        silence_detected = false;
        vu_level = 0.0f;
        vu_level_raw = 0.0f;
        vu_max = 0.0f;
        magnitudes_locked.store(false, std::memory_order_release);
        std::memset(tempi_bpm_values_hz, 0, sizeof(tempi_bpm_values_hz));
        std::memset(novelty_curve, 0, sizeof(novelty_curve));
        std::memset(novelty_curve_normalized, 0, sizeof(novelty_curve_normalized));
        std::memset(vu_curve, 0, sizeof(vu_curve));
    }
};

extern AudioSystemState g_audio;

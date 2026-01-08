#pragma once

/**
 * @brief Feature flag for gradual global state migration
 *
 * Controls whether code uses unified state structures (g_audio, g_leds, g_profiler)
 * or legacy scattered globals. Enables A/B testing during migration.
 *
 * USE_UNIFIED_STATE = 1: All code uses unified state (new path)
 * USE_UNIFIED_STATE = 0: All code uses legacy globals (old path)
 *
 * Both paths must compile and produce identical results.
 * After validation in production, legacy path will be removed.
 *
 * Migration Progress:
 *  - Profiler state: Ready for migration
 *  - Audio state: Ready for migration
 *  - Pattern state: Ready for migration
 */
#ifndef USE_UNIFIED_STATE
#  define USE_UNIFIED_STATE 0  // Toggle for testing: 0 = legacy, 1 = unified (default legacy)
#endif

#include "audio/audio_system_state.h"
#include "led/led_system_state.h"
#include "profiler/profile_metrics.h"
#include "pattern_render_context.h"

/**
 * @brief Read-only snapshot of all system state
 *
 * Provides a unified view of audio, LED, and profiling state.
 * Used as a single access point for diagnostics, REST APIs,
 * and any subsystem needing to observe system health.
 *
 * All references are const to prevent accidental mutation.
 */
struct SystemStateSnapshot {
    const AudioSystemState& audio;      // Audio metrics and state
    const LEDSystemState& leds;         // LED buffers and hardware state
    const ProfileMetrics& profiler;     // Timing metrics

    /**
     * @brief Create a snapshot of current system state
     * @return SystemStateSnapshot with references to all global state
     */
    static SystemStateSnapshot current() {
        return {g_audio, g_leds, g_profiler};
    }
};

/**
 * @brief Enhanced pattern render context with system state
 *
 * This is the primary argument passed to all pattern render functions.
 * Contains everything needed: LED buffers, user parameters, audio data,
 * timing information, and system health metrics.
 *
 * @see pattern_render_context.h for PatternRenderContext
 */
struct EnhancedPatternRenderContext {
    // Original pattern context fields
    CRGBF* const leds;                          // LED color buffer
    const int num_leds;                         // Number of LEDs
    const float time;                           // Animation time (seconds)
    const PatternParameters& params;            // User-facing controls
    const AudioDataSnapshot& audio_snapshot;    // Audio data (FFT, VU, tempo)

    // NEW: System state snapshot
    const SystemStateSnapshot& sys;             // Audio/LED/profiler state

    /**
     * @brief Convenience accessor for current profiler FPS
     */
    float current_fps() const {
        return sys.profiler.fps_cpu;
    }

    /**
     * @brief Convenience accessor for current VU level
     */
    float current_vu() const {
        return sys.audio.vu_level;
    }

    /**
     * @brief Convenience accessor for current pattern index
     */
    uint8_t current_pattern() const {
        return sys.leds.current_pattern_index;
    }
};

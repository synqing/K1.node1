#pragma once

#include "transition_engine.hpp"
#include "../pattern_execution.h"
#include "../led_driver.h"

/**
 * K1.node1 Transition Adapter
 *
 * Manages transitions between patterns for K1.node1:
 * - Captures source pattern state before transition
 * - Renders target pattern during transition
 * - Blends source → target using TransitionEngine
 * - Writes final output to main LED buffer
 *
 * Memory footprint: ~3 KB RAM (triple buffer + engine state)
 */

class K1TransitionAdapter {
private:
    // Triple buffer for transitions
    CRGBF source[NUM_LEDS];    // Captured source pattern state
    CRGBF target[NUM_LEDS];    // Rendered target pattern
    CRGBF output[NUM_LEDS];    // Blended transition output

    // Transition engine instance
    TransitionEngine engine;

    // Transition state
    bool active = false;

public:
    // Public for REST API access
    uint8_t from_pattern_index = 0;
    uint8_t to_pattern_index = 0;

    // Configuration (public for REST API access)
    TransitionType default_type = TRANSITION_FADE;
    uint32_t default_duration_ms = 1000;
    EasingCurve default_curve = EASE_IN_OUT_QUAD;
    bool transitions_enabled = true;
    K1TransitionAdapter() : engine(NUM_LEDS) {
        // Initialize buffers to black
        for (uint16_t i = 0; i < NUM_LEDS; i++) {
            source[i] = CRGBF(0.0f, 0.0f, 0.0f);
            target[i] = CRGBF(0.0f, 0.0f, 0.0f);
            output[i] = CRGBF(0.0f, 0.0f, 0.0f);
        }
    }

    /**
     * Start a transition to a new pattern
     *
     * @param to_pattern Target pattern index
     * @param type Transition type (or use default if TRANSITION_COUNT)
     * @param duration_ms Transition duration (0 = use default)
     * @return true if transition started, false if already active
     */
    bool beginTransition(
        uint8_t to_pattern,
        TransitionType type = TRANSITION_COUNT,  // TRANSITION_COUNT = use default
        uint32_t duration_ms = 0                 // 0 = use default
    );  // Defined in .cpp file

    /**
     * Update transition state (call every frame)
     *
     * @param context Pattern render context for target pattern
     * @return true if transition is active, false if completed
     */
    bool update(PatternRenderContext& context);  // Defined in .cpp file

    // Query state
    bool isActive() const { return active; }
    float getProgress() const { return engine.getProgress(); }
    uint8_t getFromPattern() const { return from_pattern_index; }
    uint8_t getToPattern() const { return to_pattern_index; }
    TransitionType getCurrentType() const { return engine.getCurrentType(); }
    uint32_t getCurrentDuration() const { return engine.getDuration(); }

    // Configuration setters
    void setDefaultType(TransitionType type) { default_type = type; }
    void setDefaultDuration(uint32_t ms) { default_duration_ms = ms; }
    void setDefaultCurve(EasingCurve curve) { default_curve = curve; }
    void setEnabled(bool enabled) { transitions_enabled = enabled; }

    // Configuration getters
    TransitionType getDefaultType() const { return default_type; }
    uint32_t getDefaultDuration() const { return default_duration_ms; }
    EasingCurve getDefaultCurve() const { return default_curve; }
    bool getEnabled() const { return transitions_enabled; }
};

// Global transition adapter instance
extern K1TransitionAdapter g_transition_adapter;

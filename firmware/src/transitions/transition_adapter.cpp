#include "transition_adapter.hpp"
#include "../pattern_registry.h"

// Global transition adapter instance
K1TransitionAdapter g_transition_adapter;

bool K1TransitionAdapter::beginTransition(
    uint8_t to_pattern,
    TransitionType type,
    uint32_t duration_ms
) {
    // Block if transition already active
    if (active) {
        return false;
    }

    // Validate pattern index
    if (to_pattern >= g_num_patterns) {
        return false;
    }

    // Skip if transitioning to same pattern
    if (to_pattern == g_current_pattern_index) {
        return false;
    }

    // Skip if transitions disabled
    if (!transitions_enabled) {
        // Just do instant switch
        g_current_pattern_index = to_pattern;
        return true;
    }

    // Capture current LED state as source
    memcpy(source, leds, sizeof(source));

    // Store transition parameters
    from_pattern_index = g_current_pattern_index;
    to_pattern_index = to_pattern;

    // Use default values if not specified
    if (type == TRANSITION_COUNT) {
        type = default_type;
    }
    if (duration_ms == 0) {
        duration_ms = default_duration_ms;
    }

    // Start transition
    engine.startTransition(source, target, output, type, duration_ms, default_curve);
    active = true;

    return true;
}

bool K1TransitionAdapter::update(PatternRenderContext& context) {
    if (!active) {
        return false;
    }

    // Render target pattern to target buffer
    // Save current leds[] state
    CRGBF temp_leds[NUM_LEDS];
    memcpy(temp_leds, leds, sizeof(temp_leds));

    // Clear leds[] buffer for target pattern rendering
    for (uint16_t i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGBF(0.0f, 0.0f, 0.0f);
    }

    // Render target pattern (writes to leds[])
    const PatternInfo& pattern = g_pattern_registry[to_pattern_index];
    pattern.draw_fn(context);

    // Copy rendered target pattern to target buffer
    memcpy(target, leds, sizeof(target));

    // Restore original leds[] state
    memcpy(leds, temp_leds, sizeof(leds));

    // Update transition engine
    bool stillActive = engine.update();

    if (!stillActive) {
        // Transition complete
        active = false;

        // Copy final output to main LED buffer
        memcpy(leds, output, sizeof(output));

        // Switch to target pattern
        g_current_pattern_index = to_pattern_index;

        return false;
    }

    // Copy transition output to main LED buffer
    memcpy(leds, output, sizeof(output));

    return true;
}

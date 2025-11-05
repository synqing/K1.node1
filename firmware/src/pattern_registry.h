// Pattern registry for multi-pattern system
// Function pointer array for zero-cost pattern switching

#pragma once
#include "parameters.h"
#include "logging/logger.h"

// Pattern function signature
// All patterns receive time and parameters, write to global leds[] buffer
typedef void (*PatternFunction)(float time, const PatternParameters& params);

// Pattern metadata
struct PatternInfo {
    const char* name;              // Display name (e.g., "Lava Beat")
    const char* id;                // URL-safe ID (e.g., "lava_beat")
    const char* description;       // Short description
    PatternFunction draw_fn;       // Function pointer to draw function
    bool is_audio_reactive;        // Requires audio data
};

// Pattern registry (defined in generated_patterns.h)
extern const PatternInfo g_pattern_registry[];
extern const uint8_t g_num_patterns;

// Current pattern selection
extern uint8_t g_current_pattern_index;

// Initialize pattern system (call once in setup())
inline void init_pattern_registry() {
    // Start with the first audio-reactive pattern, never a static one
    // Fallback to index 0 only if none are audio-reactive
    g_current_pattern_index = 0;  // default
    for (uint8_t i = 0; i < g_num_patterns; i++) {
        if (g_pattern_registry[i].is_audio_reactive) {
            g_current_pattern_index = i;
            break;
        }
    }
}

// Switch to pattern by index (validates bounds)
// Returns true on success, false if index out of range
inline bool select_pattern(uint8_t index) {
    if (index >= g_num_patterns) {
        return false;
    }
    g_current_pattern_index = index;
    return true;
}

// Switch to pattern by ID string (linear search)
// Returns true on success, false if ID not found
inline bool select_pattern_by_id(const char* id) {
    for (uint8_t i = 0; i < g_num_patterns; i++) {
        if (strcmp(g_pattern_registry[i].id, id) == 0) {
            g_current_pattern_index = i;
            LOG_INFO(TAG_GPU, "Pattern changed to: %s (index %d)",
                g_pattern_registry[i].name, i);
            return true;
        }
    }
    LOG_ERROR(TAG_GPU, "Pattern '%s' not found", id);
    return false;
}

// Get current pattern info
inline const PatternInfo& get_current_pattern() {
    return g_pattern_registry[g_current_pattern_index];
}

// Draw current pattern (call from loop())
inline void draw_current_pattern(float time, const PatternParameters& params) {
    PatternFunction draw_fn = g_pattern_registry[g_current_pattern_index].draw_fn;
    draw_fn(time, params);
}

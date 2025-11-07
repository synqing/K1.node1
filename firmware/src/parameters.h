// Runtime pattern parameters with thread-safe double buffering
// Prevents race conditions between web handler (Core 0) and LED loop (Core 1)

#pragma once
#include <Arduino.h>
#include <atomic>

// Runtime parameters for pattern control
// Derived from Emotiscope's proven control set, adapted for K1's centre-origin architecture
// All patterns receive this struct and extract relevant fields
struct PatternParameters {
    // Global visual controls (affect all patterns)
    float brightness;          // 0.0 - 1.0 (global brightness)
    float softness;            // 0.0 - 1.0 (frame blending/decay strength)
    float color;               // 0.0 - 1.0 (hue for palette selection)
    float color_range;         // 0.0 - 1.0 (palette spread/saturation)
    float saturation;          // 0.0 - 1.0 (color intensity)
    float warmth;              // 0.0 - 1.0 (incandescent filter amount)
    float background;          // 0.0 - 1.0 (ambient background level)
    float dithering;           // 0.0 - 1.0 (temporal dithering enable: 0=off, 1=on)

    // Pattern-specific controls
    float speed;               // 0.0 - 1.0 (animation speed multiplier)
    uint8_t palette_id;        // 0-N (discrete palette selection, if used)

    // Pattern-extension parameters (for future use)
    float custom_param_1;      // 0.0 - 1.0 (pattern-specific control)
    float custom_param_2;      // 0.0 - 1.0 (pattern-specific control)
    float custom_param_3;      // 0.0 - 1.0 (pattern-specific control)

    // Beat gating controls (runtime-tunable)
    float beat_threshold;      // 0.0 - 1.0 (minimum confidence to consider beat)
    float beat_squash_power;   // 0.2 - 1.0 (exponent to squash confidence)

    // Audio/Visual Response Parameters (5 high-impact controls)
    float audio_responsiveness; // 0.0-1.0 (0=smooth/fluid, 1=instant/snappy)
    float audio_sensitivity;    // 0.1-4.0 (gain multiplier for quiet vs loud)
    float bass_treble_balance;  // -1.0 to +1.0 (-1=bass only, 0=balanced, +1=treble only)
    float color_reactivity;     // 0.0-1.0 (how much audio affects colors)
    float brightness_floor;     // 0.0-0.3 (minimum brightness, prevents full black)

    // LED transport pacing
    float frame_min_period_ms;  // 4.0 - 20.0 (minimum frame period; 6.0ms ≈ 166 FPS)
};

// Default parameter values (from Emotiscope reference)
inline PatternParameters get_default_params() {
    PatternParameters params;
    // Global visual controls
    params.brightness = 1.0f;      // Emotiscope: DEFAULT_BRIGHTNESS = 1.0
    params.softness = 0.25f;       // Emotiscope: softness default = 0.25
    params.color = 0.33f;          // Emotiscope: color default = 0.33
    params.color_range = 0.0f;     // Emotiscope: color_range default = 0.0
    params.saturation = 0.75f;     // Emotiscope: saturation default = 0.75
    params.warmth = 0.0f;          // Emotiscope: warmth default = 0.0
    params.background = 0.0f;       // No ambient background by default (clean visual separation)
    params.dithering = 1.0f;       // Temporal dithering enabled by default
    // Pattern-specific
    params.speed = 0.5f;           // Emotiscope: speed default = 0.5
    params.palette_id = 0;         // Will be set per-pattern
    // Extensions (available for pattern-specific use)
    params.custom_param_1 = 0.5f;
    params.custom_param_2 = 0.5f;
    params.custom_param_3 = 0.5f;

    // Beat gating defaults
    params.beat_threshold = 0.20f;     // Gate low confidence to reduce flicker
    params.beat_squash_power = 0.50f;  // sqrt-style squash; 1.0 = linear

    // Audio/Visual Response defaults (balanced for most music)
    params.audio_responsiveness = 0.5f;  // Balanced smooth vs snappy
    params.audio_sensitivity = 1.0f;     // Unity gain (no amplification)
    params.bass_treble_balance = 0.0f;   // Equal frequency weighting
    params.color_reactivity = 0.5f;      // Moderate audio-to-color influence
    params.brightness_floor = 0.05f;     // 5% minimum brightness
    // LED transport pacing
    params.frame_min_period_ms = 6.0f;   // Cap ~166 FPS by default
    return params;
}

// Double-buffered parameter storage (prevents torn reads)
// Web handler writes to inactive buffer, then atomically swaps
// LED loop always reads from active buffer
// NOTE: Defined in parameters.cpp to ensure a single shared instance
extern PatternParameters g_params_buffers[2];
extern std::atomic<uint8_t> g_active_buffer;

// Thread-safe parameter update (call from web handler on Core 0)
// Uses release-acquire memory ordering for cache coherency
inline void update_params(const PatternParameters& new_params) {
    uint8_t inactive = 1 - g_active_buffer.load(std::memory_order_acquire);
    g_params_buffers[inactive] = new_params;  // Write to inactive buffer
    g_active_buffer.store(inactive, std::memory_order_release);  // Atomic swap
}

// Thread-safe parameter read (call from LED loop on Core 1)
inline const PatternParameters& get_params() {
    uint8_t active = g_active_buffer.load(std::memory_order_acquire);
    return g_params_buffers[active];
}

// Initialize parameter system (call once in setup())
inline void init_params() {
    PatternParameters defaults = get_default_params();
    g_params_buffers[0] = defaults;
    g_params_buffers[1] = defaults;
    g_active_buffer.store(0, std::memory_order_release);
}

// Validate and update parameters (defined in parameters.cpp)
bool update_params_safe(const PatternParameters& new_params);

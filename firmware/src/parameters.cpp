// Parameter validation and bounds checking
// Prevents crashes from NaN/Inf/overflow in web API inputs

#include "parameters.h"
#include "palettes.h"  // Use central NUM_PALETTES definition from palettes.h
#include "led_driver.h"  // NUM_LEDS for LED offset validation

// Shared parameter buffers and active index
PatternParameters g_params_buffers[2];
std::atomic<uint8_t> g_active_buffer{0};

// Validate and clamp parameters to safe ranges
// Returns true if any parameter was clamped (indicates invalid input)
bool validate_and_clamp(PatternParameters& params) {
    bool clamped = false;

    // Helper lambda for validating 0.0-1.0 range floats
    auto validate_float_0_1 = [&](float& value, float default_val) {
        if (isnan(value) || isinf(value) || value < 0.0f || value > 1.0f) {
            value = constrain(value, 0.0f, 1.0f);
            if (isnan(value) || isinf(value)) {
                value = default_val;
            }
            clamped = true;
        }
    };

    // Global visual controls (0.0 - 1.0 range)
    validate_float_0_1(params.brightness, 1.0f);      // Default: 1.0
    validate_float_0_1(params.softness, 0.25f);       // Default: 0.25
    validate_float_0_1(params.color, 0.33f);          // Default: 0.33
    validate_float_0_1(params.color_range, 0.0f);     // Default: 0.0
    validate_float_0_1(params.saturation, 0.75f);     // Default: 0.75
    validate_float_0_1(params.warmth, 0.0f);          // Default: 0.0
    validate_float_0_1(params.background, 0.25f);     // Default: 0.25
    validate_float_0_1(params.dithering, 1.0f);       // Default: 1.0 (enabled)
    validate_float_0_1(params.mirror_mode, 1.0f);     // Default: enabled

    // Pattern-specific controls
    validate_float_0_1(params.speed, 0.5f);           // Default: 0.5

    // Palette ID: 0 to NUM_PALETTES-1 (prevent buffer overflow)
    if (params.palette_id >= NUM_PALETTES) {
        params.palette_id = 0;
        clamped = true;
    }

    // Custom params: 0.0 - 1.0 (reject NaN/Inf)
    validate_float_0_1(params.custom_param_1, 0.5f);
    validate_float_0_1(params.custom_param_2, 0.5f);
    validate_float_0_1(params.custom_param_3, 0.5f);

    // Beat gating parameters: 0.0 - 1.0
    validate_float_0_1(params.beat_threshold, 0.20f);
    validate_float_0_1(params.beat_squash_power, 0.50f);
    // Enforce lower bound for squash power (prevent extreme flattening)
    if (params.beat_squash_power < 0.20f) {
        params.beat_squash_power = 0.20f;
        clamped = true;
    }

    // Audio/Visual Response parameters (custom ranges)

    // audio_responsiveness: 0.0-1.0 (smooth vs snappy)
    validate_float_0_1(params.audio_responsiveness, 0.5f);

    // audio_sensitivity: 0.1-4.0 (gain multiplier)
    if (isnan(params.audio_sensitivity) || isinf(params.audio_sensitivity) ||
        params.audio_sensitivity < 0.1f || params.audio_sensitivity > 4.0f) {
        params.audio_sensitivity = constrain(params.audio_sensitivity, 0.1f, 4.0f);
        if (isnan(params.audio_sensitivity) || isinf(params.audio_sensitivity)) {
            params.audio_sensitivity = 1.0f;  // Unity gain default
        }
        clamped = true;
    }

    // bass_treble_balance: -1.0 to +1.0 (frequency emphasis)
    if (isnan(params.bass_treble_balance) || isinf(params.bass_treble_balance) ||
        params.bass_treble_balance < -1.0f || params.bass_treble_balance > 1.0f) {
        params.bass_treble_balance = constrain(params.bass_treble_balance, -1.0f, 1.0f);
        if (isnan(params.bass_treble_balance) || isinf(params.bass_treble_balance)) {
            params.bass_treble_balance = 0.0f;  // Balanced default
        }
        clamped = true;
    }

    // color_reactivity: 0.0-1.0 (audio->color influence)
    validate_float_0_1(params.color_reactivity, 0.5f);

    // brightness_floor: 0.0-0.3 (minimum brightness)
    if (isnan(params.brightness_floor) || isinf(params.brightness_floor) ||
        params.brightness_floor < 0.0f || params.brightness_floor > 0.3f) {
        params.brightness_floor = constrain(params.brightness_floor, 0.0f, 0.3f);
        if (isnan(params.brightness_floor) || isinf(params.brightness_floor)) {
            params.brightness_floor = 0.05f;  // 5% default
        }
        clamped = true;
    }

    // frame_min_period_ms: 4.0 - 20.0 ms (maps to ~250-50 FPS)
    if (isnan(params.frame_min_period_ms) || isinf(params.frame_min_period_ms) ||
        params.frame_min_period_ms < 4.0f || params.frame_min_period_ms > 20.0f) {
        params.frame_min_period_ms = constrain(params.frame_min_period_ms, 4.0f, 20.0f);
        if (isnan(params.frame_min_period_ms) || isinf(params.frame_min_period_ms)) {
            params.frame_min_period_ms = 6.0f;  // Default: ~166 FPS
        }
        clamped = true;
    }

    // led_offset: clamp to +/- NUM_LEDS (logical shift)
    const float max_offset = static_cast<float>(NUM_LEDS);
    if (isnan(params.led_offset) || isinf(params.led_offset) ||
        params.led_offset < -max_offset || params.led_offset > max_offset) {
        params.led_offset = constrain(params.led_offset, -max_offset, max_offset);
        if (isnan(params.led_offset) || isinf(params.led_offset)) {
            params.led_offset = 0.0f;
        }
        clamped = true;
    }

    return clamped;
}

// Safe parameter update with validation
// Returns true on success, false if validation failed
bool update_params_safe(const PatternParameters& new_params) {
    PatternParameters validated = new_params;
    bool clamped = validate_and_clamp(validated);

    update_params(validated);  // Always update (with clamped values if needed)

    return !clamped;  // Return false if we had to clamp anything
}

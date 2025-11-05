// Parameter validation and bounds checking
// Prevents crashes from NaN/Inf/overflow in web API inputs

#include "parameters.h"
#include "palettes.h"  // Use central NUM_PALETTES definition from palettes.h

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

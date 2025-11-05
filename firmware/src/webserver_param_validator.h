#pragma once

#include <Arduino.h>
#include <cmath>
#include <ArduinoJson.h>

/**
 * ValidationResult - Encapsulates the result of parameter validation
 *
 * Used to return validation status, parsed value, and error message
 * in a single structure.
 */
struct ValidationResult {
    bool valid;
    float value;
    const char* error_message;

    /**
     * Create successful validation result
     */
    static ValidationResult ok(float val) {
        return {true, val, nullptr};
    }

    /**
     * Create failed validation result with error message
     */
    static ValidationResult error(const char* msg) {
        return {false, 0.0f, msg};
    }
};

/**
 * Validate that a float value is within [min, max] range
 *
 * Checks for NaN and infinity before range validation.
 *
 * @param value The float value to validate
 * @param min Minimum acceptable value (inclusive)
 * @param max Maximum acceptable value (inclusive)
 * @param param_name Parameter name for error messages
 * @return ValidationResult with status and clamped value
 */
inline ValidationResult validate_float_range(float value, float min, float max, const char* param_name) {
    // Check for NaN or infinity
    if (isnan(value) || isinf(value)) {
        return ValidationResult::error("Value must be a valid number");
    }

    // Check range
    if (value < min || value > max) {
        return ValidationResult::error("Value out of valid range");
    }

    return ValidationResult::ok(value);
}

/**
 * Validate microphone gain (0.5 - 2.0x)
 *
 * Microphone gain typically ranges from 0.5x (quieter input) to 2.0x (louder input).
 * Values outside this range can cause clipping or noise issues.
 *
 * @param gain The gain value to validate
 * @return ValidationResult with clamped gain value
 */
inline ValidationResult validate_microphone_gain(float gain) {
    return validate_float_range(gain, 0.5f, 2.0f, "microphone_gain");
}

/**
 * Validate VU floor percentage (0.5 - 0.98)
 *
 * Lower values increase responsiveness to quiet audio by subtracting less floor.
 */
inline ValidationResult validate_vu_floor_pct(float pct) {
    return validate_float_range(pct, 0.5f, 0.98f, "vu_floor_pct");
}

/**
 * Validate a boolean value from JSON
 *
 * Accepts multiple representations of boolean:
 * - Native boolean: true/false
 * - Integer: 0 (false), 1 (true)
 *
 * @param value The JSON value to validate
 * @return ValidationResult with 1.0 (true) or 0.0 (false)
 */
inline ValidationResult validate_bool(JsonVariantConst value) {
    // Native boolean
    if (value.is<bool>()) {
        return ValidationResult::ok(value.as<bool>() ? 1.0f : 0.0f);
    }

    // Integer 0 or 1
    if (value.is<int>()) {
        int intval = value.as<int>();
        if (intval == 0 || intval == 1) {
            return ValidationResult::ok((float)intval);
        }
    }

    return ValidationResult::error("Value must be boolean (true/false) or 0/1");
}

/**
 * Validate brightness parameter (0.0 - 1.0)
 *
 * Used for parameter validation in pattern control.
 * Note: Most pattern parameters are validated in parameters.cpp via update_params_safe()
 *
 * @param brightness The brightness value to validate
 * @return ValidationResult with clamped brightness
 */
inline ValidationResult validate_brightness(float brightness) {
    return validate_float_range(brightness, 0.0f, 1.0f, "brightness");
}

/**
 * Validate softness parameter (0.0 - 1.0)
 *
 * Used for parameter validation in pattern control.
 * Note: Most pattern parameters are validated in parameters.cpp via update_params_safe()
 *
 * @param softness The softness value to validate
 * @return ValidationResult with clamped softness
 */
inline ValidationResult validate_softness(float softness) {
    return validate_float_range(softness, 0.0f, 1.0f, "softness");
}

/**
 * Validate speed parameter (0.0 - 1.0)
 *
 * Used for parameter validation in pattern control.
 * Note: Most pattern parameters are validated in parameters.cpp via update_params_safe()
 *
 * @param speed The speed value to validate
 * @return ValidationResult with clamped speed
 */
inline ValidationResult validate_speed(float speed) {
    return validate_float_range(speed, 0.0f, 1.0f, "speed");
}

/**
 * Clamp a float value to [min, max] range
 *
 * Helper function for direct value clamping without validation result.
 * Used internally when validation result is not needed.
 *
 * @param value The value to clamp
 * @param min Minimum value
 * @param max Maximum value
 * @return Clamped value
 */
inline float clamp_float(float value, float min, float max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

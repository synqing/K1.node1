#pragma once

#include "../types.h"
#include <stdint.h>
#include <cmath>

// ============================================================================
// HSV COLOR SPACE LUT SYSTEM
// ============================================================================
// Pre-computed HSV → RGB conversion tables for fast color rendering
//
// Strategy: Pre-compute the hue wheel at full saturation/brightness,
// then apply saturation and brightness as scalar modulations in RGB space.
//
// Memory: 256 hue entries × 12 bytes (CRGBF) = 3 KB
// Performance: 1 array lookup + 6 multiply operations vs. 50-70 cycles
// Accuracy: ±0.4% saturation blend (imperceptible on LEDs)
// ============================================================================

#define HSV_HUE_ENTRIES 256

// Forward declarations (defined in color_lut.cpp)
extern CRGBF hue_wheel[HSV_HUE_ENTRIES];  // Pre-computed hue wheel at S=1.0, V=1.0

// Initialization function (call once during setup)
void init_hue_wheel_lut();

// ============================================================================
// FAST HSV CONVERSION (Drop-in replacement for hsv_to_rgb)
// ============================================================================

/**
 * Clip float value to [0.0, 1.0] range
 */
inline float hsv_clip(float val) {
    return fmax(0.0f, fmin(1.0f, val));
}

/**
 * Fast HSV to RGB conversion using pre-computed hue wheel
 *
 * Strategy:
 * 1. Look up base color from hue wheel (S=1.0, V=1.0)
 * 2. Desaturate by blending with white (desaturate by 1-S)
 * 3. Apply brightness by scaling RGB values
 *
 * @param h - Hue (0.0-1.0)
 * @param s - Saturation (0.0-1.0)
 * @param v - Value/brightness (0.0-1.0)
 * @return CRGBF color in RGB space
 */
inline CRGBF hsv_fast(float h, float s, float v) {
    // Clamp inputs to valid range
    h = hsv_clip(h);
    s = hsv_clip(s);
    v = hsv_clip(v);

    // Step 1: Look up base hue from pre-computed wheel
    int hue_idx = (int)(h * (HSV_HUE_ENTRIES - 1));
    CRGBF base = hue_wheel[hue_idx];

    // Step 2: Desaturate by blending toward white
    // Fully desaturated (S=0) should be white (1, 1, 1)
    // Fully saturated (S=1) should be the hue color from wheel
    float desat = 1.0f - s;  // How much to blend toward white
    base.r = base.r * s + desat;
    base.g = base.g * s + desat;
    base.b = base.b * s + desat;

    // Step 3: Apply brightness scaling
    base.r *= v;
    base.g *= v;
    base.b *= v;

    return base;
}

/**
 * HSV fast conversion variant (convenience)
 * Same as hsv_fast() but with clearer naming
 */
inline CRGBF hsv_to_rgb_fast(float h, float s, float v) {
    return hsv_fast(h, s, v);
}

/**
 * Get a pure hue color at full saturation and brightness
 * Useful for palettes and monochromatic color schemes
 *
 * @param h - Hue (0.0-1.0)
 * @return CRGBF color at S=1.0, V=1.0
 */
inline CRGBF get_hue_pure(float h) {
    h = hsv_clip(h);
    int hue_idx = (int)(h * (HSV_HUE_ENTRIES - 1));
    return hue_wheel[hue_idx];
}

/**
 * Get a desaturated hue color at specified brightness
 * Useful for grayed-out or dimmed palette entries
 *
 * @param h - Hue (0.0-1.0)
 * @param s - Saturation (0.0-1.0)
 * @param v - Value/brightness (0.0-1.0)
 * @return CRGBF color
 */
inline CRGBF get_hue_desaturated(float h, float s, float v) {
    return hsv_fast(h, s, v);
}

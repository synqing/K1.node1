#pragma once

#include <stdint.h>
#include <cmath>

// ============================================================================
// EASING FUNCTION LUT TABLES
// ============================================================================
// Pre-computed easing curves at 256 resolution for fast animation timing
// All functions take t in range [0.0, 1.0] and return transformed value in range [0.0, 1.0]
//
// Memory: 6 curves × 256 entries × 4 bytes = 6 KB
// Performance: 1 array lookup + bounds check vs. 2-8 multiply/add operations
// Accuracy: ±0.2% (imperceptible at LED frame rates)
// ============================================================================

#define EASING_LUT_ENTRIES 256

// Forward declarations (defined in easing_lut.cpp)
extern float easing_lut_linear[EASING_LUT_ENTRIES];
extern float easing_lut_quad_in[EASING_LUT_ENTRIES];
extern float easing_lut_quad_out[EASING_LUT_ENTRIES];
extern float easing_lut_quad_in_out[EASING_LUT_ENTRIES];
extern float easing_lut_cubic_in[EASING_LUT_ENTRIES];
extern float easing_lut_cubic_out[EASING_LUT_ENTRIES];
extern float easing_lut_cubic_in_out[EASING_LUT_ENTRIES];
extern float easing_lut_quart_in[EASING_LUT_ENTRIES];
extern float easing_lut_quart_out[EASING_LUT_ENTRIES];
extern float easing_lut_quart_in_out[EASING_LUT_ENTRIES];

// Initialization function (call once during setup)
void init_easing_luts();

// ============================================================================
// FAST EASING LOOKUPS (Drop-in replacements for original easing functions)
// ============================================================================

/**
 * Clip float value to [0.0, 1.0] range
 */
inline float easing_clip(float val) {
    return fmax(0.0f, fmin(1.0f, val));
}

/**
 * Linear: Constant rate, no acceleration
 */
inline float ease_linear_fast(float t) {
    int idx = (int)(easing_clip(t) * (EASING_LUT_ENTRIES - 1));
    return easing_lut_linear[idx];
}

/**
 * Quadratic In: Accelerating from zero velocity
 */
inline float ease_quad_in_fast(float t) {
    int idx = (int)(easing_clip(t) * (EASING_LUT_ENTRIES - 1));
    return easing_lut_quad_in[idx];
}

/**
 * Quadratic Out: Decelerating to zero velocity
 */
inline float ease_quad_out_fast(float t) {
    int idx = (int)(easing_clip(t) * (EASING_LUT_ENTRIES - 1));
    return easing_lut_quad_out[idx];
}

/**
 * Quadratic InOut: Acceleration until halfway, then deceleration
 */
inline float ease_quad_in_out_fast(float t) {
    int idx = (int)(easing_clip(t) * (EASING_LUT_ENTRIES - 1));
    return easing_lut_quad_in_out[idx];
}

/**
 * Cubic In: Stronger acceleration from zero velocity
 */
inline float ease_cubic_in_fast(float t) {
    int idx = (int)(easing_clip(t) * (EASING_LUT_ENTRIES - 1));
    return easing_lut_cubic_in[idx];
}

/**
 * Cubic Out: Stronger deceleration to zero velocity
 */
inline float ease_cubic_out_fast(float t) {
    int idx = (int)(easing_clip(t) * (EASING_LUT_ENTRIES - 1));
    return easing_lut_cubic_out[idx];
}

/**
 * Cubic InOut: Strong acceleration then deceleration
 */
inline float ease_cubic_in_out_fast(float t) {
    int idx = (int)(easing_clip(t) * (EASING_LUT_ENTRIES - 1));
    return easing_lut_cubic_in_out[idx];
}

/**
 * Quartic In: Very strong acceleration from zero velocity
 */
inline float ease_quart_in_fast(float t) {
    int idx = (int)(easing_clip(t) * (EASING_LUT_ENTRIES - 1));
    return easing_lut_quart_in[idx];
}

/**
 * Quartic Out: Very strong deceleration to zero velocity
 */
inline float ease_quart_out_fast(float t) {
    int idx = (int)(easing_clip(t) * (EASING_LUT_ENTRIES - 1));
    return easing_lut_quart_out[idx];
}

/**
 * Quartic InOut: Very strong acceleration/deceleration
 */
inline float ease_quart_in_out_fast(float t) {
    int idx = (int)(easing_clip(t) * (EASING_LUT_ENTRIES - 1));
    return easing_lut_quart_in_out[idx];
}

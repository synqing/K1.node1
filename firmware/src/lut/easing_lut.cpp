#include "easing_lut.h"
#include <cmath>

// ============================================================================
// LUT TABLE DEFINITIONS
// ============================================================================

float easing_lut_linear[EASING_LUT_ENTRIES];
float easing_lut_quad_in[EASING_LUT_ENTRIES];
float easing_lut_quad_out[EASING_LUT_ENTRIES];
float easing_lut_quad_in_out[EASING_LUT_ENTRIES];
float easing_lut_cubic_in[EASING_LUT_ENTRIES];
float easing_lut_cubic_out[EASING_LUT_ENTRIES];
float easing_lut_cubic_in_out[EASING_LUT_ENTRIES];
float easing_lut_quart_in[EASING_LUT_ENTRIES];
float easing_lut_quart_out[EASING_LUT_ENTRIES];
float easing_lut_quart_in_out[EASING_LUT_ENTRIES];

// ============================================================================
// EASING FUNCTION IMPLEMENTATIONS (Used for LUT generation)
// ============================================================================

static inline float ease_linear(float t) {
    return t;
}

static inline float ease_quad_in(float t) {
    return t * t;
}

static inline float ease_quad_out(float t) {
    return t * (2.0f - t);
}

static inline float ease_quad_in_out(float t) {
    if (t < 0.5f) {
        return 2.0f * t * t;
    } else {
        return -1.0f + (4.0f - 2.0f * t) * t;
    }
}

static inline float ease_cubic_in(float t) {
    return t * t * t;
}

static inline float ease_cubic_out(float t) {
    float f = t - 1.0f;
    return f * f * f + 1.0f;
}

static inline float ease_cubic_in_out(float t) {
    if (t < 0.5f) {
        return 4.0f * t * t * t;
    } else {
        float f = (2.0f * t - 2.0f);
        return 0.5f * f * f * f + 1.0f;
    }
}

static inline float ease_quart_in(float t) {
    return t * t * t * t;
}

static inline float ease_quart_out(float t) {
    float f = t - 1.0f;
    return 1.0f - (f * f * f * f);
}

static inline float ease_quart_in_out(float t) {
    if (t < 0.5f) {
        return 8.0f * t * t * t * t;
    } else {
        float f = (t - 1.0f);
        return 1.0f - (8.0f * f * f * f * f);
    }
}

// ============================================================================
// LUT INITIALIZATION (Call once during setup)
// ============================================================================

void init_easing_luts() {
    for (int i = 0; i < EASING_LUT_ENTRIES; i++) {
        float t = i / (float)(EASING_LUT_ENTRIES - 1);

        easing_lut_linear[i] = ease_linear(t);
        easing_lut_quad_in[i] = ease_quad_in(t);
        easing_lut_quad_out[i] = ease_quad_out(t);
        easing_lut_quad_in_out[i] = ease_quad_in_out(t);
        easing_lut_cubic_in[i] = ease_cubic_in(t);
        easing_lut_cubic_out[i] = ease_cubic_out(t);
        easing_lut_cubic_in_out[i] = ease_cubic_in_out(t);
        easing_lut_quart_in[i] = ease_quart_in(t);
        easing_lut_quart_out[i] = ease_quart_out(t);
        easing_lut_quart_in_out[i] = ease_quart_in_out(t);
    }
}

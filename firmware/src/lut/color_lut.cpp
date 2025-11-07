#include "color_lut.h"
#include <cmath>

// ============================================================================
// HUE WHEEL LUT DEFINITION
// ============================================================================

CRGBF hue_wheel[HSV_HUE_ENTRIES];

// ============================================================================
// STANDARD HSV TO RGB CONVERSION (High precision, used for LUT generation)
// ============================================================================

static CRGBF hsv_to_rgb_precise(float h, float s, float v) {
    // Clamp inputs
    h = fmax(0.0f, fmin(1.0f, h));
    s = fmax(0.0f, fmin(1.0f, s));
    v = fmax(0.0f, fmin(1.0f, v));

    // Handle achromatic (gray) case
    if (s == 0.0f) {
        return {v, v, v};
    }

    // Convert hue [0,1] to hue [0,6]
    float h_prime = h * 6.0f;
    float c = v * s;  // Chroma
    float x = c * (1.0f - fabsf(fmodf(h_prime, 2.0f) - 1.0f));
    float m = v - c;

    CRGBF rgb = {0.0f, 0.0f, 0.0f};

    if (h_prime < 1.0f) {
        rgb = {c, x, 0.0f};
    } else if (h_prime < 2.0f) {
        rgb = {x, c, 0.0f};
    } else if (h_prime < 3.0f) {
        rgb = {0.0f, c, x};
    } else if (h_prime < 4.0f) {
        rgb = {0.0f, x, c};
    } else if (h_prime < 5.0f) {
        rgb = {x, 0.0f, c};
    } else {
        rgb = {c, 0.0f, x};
    }

    rgb.r += m;
    rgb.g += m;
    rgb.b += m;

    return rgb;
}

// ============================================================================
// HUE WHEEL LUT INITIALIZATION
// ============================================================================

void init_hue_wheel_lut() {
    for (int i = 0; i < HSV_HUE_ENTRIES; i++) {
        float hue = i / (float)(HSV_HUE_ENTRIES - 1);
        // Compute at full saturation (S=1.0) and full brightness (V=1.0)
        hue_wheel[i] = hsv_to_rgb_precise(hue, 1.0f, 1.0f);
    }
}

#include "pattern_helpers.h"

CRGBF hue_wheel[HSV_HUE_ENTRIES];

static inline CRGBF hsv_math(float h, float s, float v) {
    h = fmaxf(0.0f, fminf(1.0f, h));
    s = fmaxf(0.0f, fminf(1.0f, s));
    v = fmaxf(0.0f, fminf(1.0f, v));

    float r = 0, g = 0, b = 0;
    if (s <= 0.0f) {
        r = g = b = v;
    } else {
        float hh = h * 6.0f;
        int i = (int)hh;
        float ff = hh - i;
        float p = v * (1.0f - s);
        float q = v * (1.0f - (s * ff));
        float t = v * (1.0f - (s * (1.0f - ff)));
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }
    }
    return CRGBF(r, g, b);
}

void init_hue_wheel_lut() {
    for (int i = 0; i < HSV_HUE_ENTRIES; ++i) {
        float h = (float)i / (float)(HSV_HUE_ENTRIES - 1);
        hue_wheel[i] = hsv_math(h, 1.0f, 1.0f);
    }
}


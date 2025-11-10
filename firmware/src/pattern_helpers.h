#ifndef PATTERN_HELPERS_H
#define PATTERN_HELPERS_H

#include <math.h>
#include <algorithm>
#include "types.h"
#include "palettes.h" // For color_from_palette
#include "pattern_render_context.h"

/**
 * Apply uniform background glow overlay using current palette and global brightness.
 */
inline void apply_background_overlay(const PatternRenderContext& context) {
    const auto& params = context.params;
    float bg = clip_float(params.background);
    if (bg <= 0.0f) return;
    CRGBF ambient = color_from_palette(
        params.palette_id,
        clip_float(params.color),
        bg * clip_float(params.brightness)
    );

    for (int i = 0; i < context.num_leds; ++i) {
        context.leds[i].r = fminf(1.0f, context.leds[i].r + ambient.r);
        context.leds[i].g = fminf(1.0f, context.leds[i].g + ambient.g);
        context.leds[i].b = fminf(1.0f, context.leds[i].b + ambient.b);
    }
}

#define HSV_HUE_ENTRIES 256
extern CRGBF hue_wheel[HSV_HUE_ENTRIES];
void init_hue_wheel_lut();

inline float hsv_clip(float val) {
    return fmax(0.0f, fmin(1.0f, val));
}

inline CRGBF hsv(float h, float s, float v) {
    // Clamp inputs to valid range
    h = hsv_clip(h);
    s = hsv_clip(s);
    v = hsv_clip(v);

    // Step 1: Look up base hue from pre-computed wheel
    int hue_idx = (int)(h * (HSV_HUE_ENTRIES - 1));
    CRGBF base = hue_wheel[hue_idx];

    // Step 2: Desaturate by blending toward white
    float desat = 1.0f - s;
    base.r = base.r * s + desat;
    base.g = base.g * s + desat;
    base.b = base.b * s + desat;

    // Step 3: Apply brightness scaling
    base.r *= v;
    base.g *= v;
    base.b *= v;

    return base;
}

struct HSVF {
	float h;
	float s;
	float v;
};

static inline HSVF rgb_to_hsv(const CRGBF& rgb) {
	float r = clip_float(rgb.r);
	float g = clip_float(rgb.g);
	float b = clip_float(rgb.b);

	float max_c = std::max({ r, g, b });
	float min_c = std::min({ r, g, b });
	float delta = max_c - min_c;

	HSVF out { 0.0f, 0.0f, max_c };

	if (delta < 1e-6f) {
		out.h = 0.0f;
		out.s = 0.0f;
		return out;
	}

	if (max_c > 0.0f) {
		out.s = delta / max_c;
	} else {
		out.s = 0.0f;
		out.h = 0.0f;
		return out;
	}

	if (r >= max_c) {
		out.h = (g - b) / delta;
	} else if (g >= max_c) {
		out.h = 2.0f + (b - r) / delta;
	} else {
		out.h = 4.0f + (r - g) / delta;
	}

	out.h /= 6.0f;
	if (out.h < 0.0f) {
		out.h += 1.0f;
	}

	return out;
}

static inline CRGBF force_saturation(const CRGBF& input, float saturation_target) {
	HSVF hsv_val = rgb_to_hsv(input);
	hsv_val.s = clip_float(saturation_target);
	return hsv(hsv_val.h, hsv_val.s, hsv_val.v);
}

#endif // PATTERN_HELPERS_H

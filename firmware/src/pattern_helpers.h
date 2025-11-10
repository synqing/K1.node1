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

/**
 * HSV to RGB color conversion
 * Input: h, s, v all in range 0.0-1.0
 * Output: CRGBF with r, g, b in range 0.0-1.0
 *
 * Used by beat/tempo reactive patterns to generate colors from hue values
 */
inline CRGBF hsv(float h, float s, float v) {
	// Normalize hue to 0-1 range
	h = fmodf(h, 1.0f);
	if (h < 0.0f) h += 1.0f;

	// Clamp saturation and value
	s = fmaxf(0.0f, fminf(1.0f, s));
	v = fmaxf(0.0f, fminf(1.0f, v));

	// Handle achromatic (gray) case
	if (s == 0.0f) {
		return CRGBF(v, v, v);
	}

	// Convert HSV to RGB using standard algorithm
	float h_i = h * 6.0f;
	int i = (int)h_i;
	float f = h_i - floorf(h_i);

	float p = v * (1.0f - s);
	float q = v * (1.0f - s * f);
	float t = v * (1.0f - s * (1.0f - f));

	CRGBF result;
	switch (i % 6) {
		case 0: result = CRGBF(v, t, p); break;
		case 1: result = CRGBF(q, v, p); break;
		case 2: result = CRGBF(p, v, t); break;
		case 3: result = CRGBF(p, q, v); break;
		case 4: result = CRGBF(t, p, v); break;
		case 5: result = CRGBF(v, p, q); break;
		default: result = CRGBF(0.0f, 0.0f, 0.0f); break;
	}

	return result;
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

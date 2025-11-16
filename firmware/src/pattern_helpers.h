#pragma once

#include <algorithm>
#include <cmath>
#include "types.h"
#include "pattern_render_context.h"
#include "emotiscope_helpers.h"
#include "palettes.h"
#include "led_driver.h"

/**
 * Apply mirror/split mode to LED array by copying the first half onto the
 * second half in reverse order.
 */
inline void apply_mirror_mode(CRGBF* leds, bool enabled) {
	if (!enabled) return;
	int half = NUM_LEDS / 2;
	for (int i = 0; i < half; i++) {
		leds[NUM_LEDS - 1 - i] = leds[i];
	}
}

/**
 * Alpha-blend sprite data into the destination buffer. Used for persistence
 * effects (tunnels, bloom trails, etc).
 */
inline void blend_sprite(CRGBF* dest, const CRGBF* sprite, uint32_t length, float alpha) {
	alpha = fmaxf(0.0f, fminf(1.0f, alpha));
	float inv_alpha = 1.0f - alpha;
	for (uint32_t i = 0; i < length; i++) {
		dest[i].r = dest[i].r * inv_alpha + sprite[i].r * alpha;
		dest[i].g = dest[i].g * inv_alpha + sprite[i].g * alpha;
		dest[i].b = dest[i].b * inv_alpha + sprite[i].b * alpha;
	}
}

#define LED_PROGRESS(i) ((float)(i) / (float)NUM_LEDS)
#define TEMPO_PROGRESS(i) ((float)(i) / (float)NUM_TEMPI)

inline float perlin_noise_simple(float x, float y) {
	float n = sinf(x * 12.9898f + y * 78.233f) * 43758.5453f;
	return fmodf(n, 1.0f);
}

inline void fill_array_with_perlin(float* array, uint16_t length, float x, float y, float scale) {
	for (uint16_t i = 0; i < length; i++) {
		float t = static_cast<float>(i) / static_cast<float>(length);
		float noise_x = x + t * scale;
		float noise_y = y + scale * 0.5f;
		array[i] = perlin_noise_simple(noise_x, noise_y);
	}
}

inline float get_hue_from_position(float position) {
	return fmodf(position, 1.0f);
}

/**
 * apply_background_overlay() — intentionally a no-op. Historical background
 * washes reduced contrast; we keep the call sites for compatibility but do
 * not modify the LED buffer.
 */
inline void apply_background_overlay(const PatternRenderContext& /*context*/) {}

#define HSV_HUE_ENTRIES 256
extern CRGBF hue_wheel[HSV_HUE_ENTRIES];
void init_hue_wheel_lut();

inline float hsv_clip(float val) {
    return fmax(0.0f, fmin(1.0f, val));
}

inline CRGBF hsv(float h, float s, float v) {
    h = hsv_clip(h);
    s = hsv_clip(s);
    v = hsv_clip(v);

    int hue_idx = (int)(h * (HSV_HUE_ENTRIES - 1));
    CRGBF base = hue_wheel[hue_idx];

    float desat = 1.0f - s;
    base.r = base.r * s + desat;
    base.g = base.g * s + desat;
    base.b = base.b * s + desat;

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

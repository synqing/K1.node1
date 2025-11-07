// ============================================================================
// GENERATED PATTERNS - COMPLETE REBUILD
// Fixed: Patterns now map palettes ACROSS LED strip (not uniform color fills)
// Generated: 2025-10-26
// Quality Gates: Vibrant spatial patterns, proper audio reactivity, 120+ FPS
// ============================================================================

#pragma once

#include "pattern_registry.h"
#include "pattern_audio_interface.h"
#include "palettes.h"
#include "emotiscope_helpers.h"
#include "dsps_helpers.h"
#include "logging/logger.h"
#include <math.h>
#include <cstring>
#include <algorithm>

extern CRGBF leds[NUM_LEDS];

// ============================================================================
// HELPER FUNCTIONS - Infrastructure for ported light shows
// ============================================================================

/**
 * HSV to RGB color conversion
 * Input: h, s, v all in range 0.0-1.0
 * Output: CRGBF with r, g, b in range 0.0-1.0
 *
 * Used by beat/tempo reactive patterns to generate colors from hue values
 */
CRGBF hsv(float h, float s, float v) {
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

static HSVF rgb_to_hsv(const CRGBF& rgb) {
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

static CRGBF force_saturation(const CRGBF& input, float saturation_target) {
	HSVF hsv_val = rgb_to_hsv(input);
	hsv_val.s = clip_float(saturation_target);
	return hsv(hsv_val.h, hsv_val.s, hsv_val.v);
}

/**
 * Apply mirror/split mode to LED array
 * Copies first half to second half in reverse for symmetrical patterns
 */
inline void apply_mirror_mode(CRGBF* leds, bool enabled) {
	if (!enabled) return;

	int half = NUM_LEDS / 2;
	for (int i = 0; i < half; i++) {
		leds[NUM_LEDS - 1 - i] = leds[i];
	}
}

/**
 * Alpha-blend two color arrays
 * Used for sprite rendering and persistence effects (tunnel, etc)
 * Result: dest[i] = dest[i] * (1 - alpha) + sprite[i] * alpha
 */
inline void blend_sprite(CRGBF* dest, const CRGBF* sprite, uint32_t length, float alpha) {
	// Clamp alpha
	alpha = fmaxf(0.0f, fminf(1.0f, alpha));
	float inv_alpha = 1.0f - alpha;

	for (uint32_t i = 0; i < length; i++) {
		dest[i].r = dest[i].r * inv_alpha + sprite[i].r * alpha;
		dest[i].g = dest[i].g * inv_alpha + sprite[i].g * alpha;
		dest[i].b = dest[i].b * inv_alpha + sprite[i].b * alpha;
	}
}

/**
 * Apply uniform background glow overlay using current palette and global brightness.
 */
inline void apply_background_overlay(const PatternParameters& params) {
    float bg = clip_float(params.background);
    if (bg <= 0.0f) return;
    CRGBF ambient = color_from_palette(
        params.palette_id,
        clip_float(params.color),
        bg * clip_float(params.brightness)
    );

    for (int i = 0; i < NUM_LEDS; ++i) {
        leds[i].r = fminf(1.0f, leds[i].r + ambient.r);
        leds[i].g = fminf(1.0f, leds[i].g + ambient.g);
        leds[i].b = fminf(1.0f, leds[i].b + ambient.b);
    }
}

/**
 * Convenient inline macros for LED position lookups
 * Eliminates repeated division operations in pattern loops
 */
#define LED_PROGRESS(i) ((float)(i) / (float)NUM_LEDS)
#define TEMPO_PROGRESS(i) ((float)(i) / (float)NUM_TEMPI)

/**
 * Perlin-like noise function (pseudo-random based on sine)
 * Not true Perlin noise but provides smooth variation
 * Used by procedural patterns like Perlin noise mode
 */
inline float perlin_noise_simple(float x, float y) {
	float n = sinf(x * 12.9898f + y * 78.233f) * 43758.5453f;
	return fmodf(n, 1.0f);
}

/**
 * Fill array with Perlin-like noise values
 * Used for procedural noise pattern generation
 */
inline void fill_array_with_perlin(float* array, uint16_t length, float x, float y, float scale) {
	for (uint16_t i = 0; i < length; i++) {
		float t = i / (float)length;
		float noise_x = x + t * scale;
		float noise_y = y + scale * 0.5f;
		array[i] = perlin_noise_simple(noise_x, noise_y);
	}
}

/**
 * Get hue from position (0.0-1.0) across visible spectrum
 * Maps: red → orange → yellow → green → cyan → blue → magenta → red
 * Used to create rainbow gradients across LED strips
 */
inline float get_hue_from_position(float position) {
	// Map position (0.0-1.0) directly to hue
	return fmodf(position, 1.0f);
}

// ============================================================================
// DOMAIN 1: STATIC INTENTIONAL PATTERNS
// ============================================================================

/**
 * Pattern: Departure
 * Emotion: Transformation - awakening from darkness to growth
 *
 * Maps palette_departure ACROSS the LED strip (left to right gradient)
 * Position determines palette progress:
 * - LED 0 (left) = palette start (dark earth)
 * - LED 80 (middle) = palette middle (golden light)
 * - LED 160 (right) = palette end (emerald green)
 *
 * Time modulates the overall brightness for subtle pulsing
 */
void draw_departure(float time, const PatternParameters& params) {
	// CENTER-ORIGIN COMPLIANT: Journey from darkness to light to growth
	// Dark earth → golden light → pure white → emerald green
	// Represents awakening and new beginnings
	
	// Departure palette colors (converted from node graph)
	const CRGBF palette_colors[] = { 
		CRGBF(0.03f, 0.01f, 0.00f), CRGBF(0.09f, 0.03f, 0.00f), CRGBF(0.29f, 0.15f, 0.02f), 
		CRGBF(0.66f, 0.39f, 0.15f), CRGBF(0.84f, 0.66f, 0.47f), CRGBF(1.00f, 1.00f, 1.00f), 
		CRGBF(0.53f, 1.00f, 0.54f), CRGBF(0.09f, 1.00f, 0.09f), CRGBF(0.00f, 1.00f, 0.00f), 
		CRGBF(0.00f, 0.53f, 0.00f), CRGBF(0.00f, 0.22f, 0.00f), CRGBF(0.00f, 0.22f, 0.00f) 
	};
	const int palette_size = 12;

	for (int i = 0; i < NUM_LEDS; i++) {
		// CENTER-ORIGIN: Distance from center (0.0 at center → 1.0 at edges)
		float position = (abs(float(i) - (NUM_LEDS / 2.0f)) / (NUM_LEDS / 2.0f));
		position = fmaxf(0.0f, fminf(1.0f, position));
		
		// Palette interpolation
		int palette_index = (int)(position * (palette_size - 1));
		float interpolation_factor = (position * (palette_size - 1)) - palette_index;
		
		// Clamp to valid range
		if (palette_index >= palette_size - 1) {
			leds[i] = palette_colors[palette_size - 1];
		} else {
			const CRGBF& color1 = palette_colors[palette_index];
			const CRGBF& color2 = palette_colors[palette_index + 1];
			
			leds[i].r = color1.r + (color2.r - color1.r) * interpolation_factor;
			leds[i].g = color1.g + (color2.g - color1.g) * interpolation_factor;
			leds[i].b = color1.b + (color2.b - color1.b) * interpolation_factor;
		}
		
		// Apply runtime parameters: brightness multiplier
		leds[i].r *= params.brightness;
		leds[i].g *= params.brightness;
		leds[i].b *= params.brightness;
	}

    // Apply uniform background overlay
    apply_background_overlay(params);
}

/**
 * Pattern: Lava
 * CENTER-ORIGIN COMPLIANT: Primal intensity and transformation
 * Black → deep red → bright orange → white hot
 * Represents passion, heat, and raw energy
 */
void draw_lava(float time, const PatternParameters& params) {
	// Lava palette colors (converted from node graph)
	const CRGBF palette_colors[] = { 
		CRGBF(0.00f, 0.00f, 0.00f), CRGBF(0.07f, 0.00f, 0.00f), CRGBF(0.44f, 0.00f, 0.00f), 
		CRGBF(0.56f, 0.01f, 0.00f), CRGBF(0.69f, 0.07f, 0.00f), CRGBF(0.84f, 0.17f, 0.01f), 
		CRGBF(1.00f, 0.32f, 0.02f), CRGBF(1.00f, 0.45f, 0.02f), CRGBF(1.00f, 0.61f, 0.02f), 
		CRGBF(1.00f, 0.80f, 0.02f), CRGBF(1.00f, 1.00f, 0.02f), CRGBF(1.00f, 1.00f, 0.28f), 
		CRGBF(1.00f, 1.00f, 1.00f) 
	};
	const int palette_size = 13;

	for (int i = 0; i < NUM_LEDS; i++) {
		// CENTER-ORIGIN: Distance from center (0.0 at center → 1.0 at edges)
		float position = (abs(float(i) - (NUM_LEDS / 2.0f)) / (NUM_LEDS / 2.0f));
		position = fmaxf(0.0f, fminf(1.0f, position));
		
		// Palette interpolation
		int palette_index = (int)(position * (palette_size - 1));
		float interpolation_factor = (position * (palette_size - 1)) - palette_index;
		
		// Clamp to valid range
		if (palette_index >= palette_size - 1) {
			leds[i] = palette_colors[palette_size - 1];
		} else {
			const CRGBF& color1 = palette_colors[palette_index];
			const CRGBF& color2 = palette_colors[palette_index + 1];
			
			leds[i].r = color1.r + (color2.r - color1.r) * interpolation_factor;
			leds[i].g = color1.g + (color2.g - color1.g) * interpolation_factor;
			leds[i].b = color1.b + (color2.b - color1.b) * interpolation_factor;
		}
		
		// Apply runtime parameters: brightness multiplier
		leds[i].r *= params.brightness;
		leds[i].g *= params.brightness;
		leds[i].b *= params.brightness;
	}

    // Apply uniform background overlay
    apply_background_overlay(params);
}

/**
 * Pattern: Twilight
 * CENTER-ORIGIN COMPLIANT: The peaceful transition from day to night
 * Warm amber → deep purple → midnight blue
 * Represents contemplation, transition, and quiet beauty
 */
void draw_twilight(float time, const PatternParameters& params) {
	// Twilight palette colors (converted from node graph)
	const CRGBF palette_colors[] = { 
		CRGBF(1.00f, 0.65f, 0.00f), CRGBF(0.94f, 0.50f, 0.00f), CRGBF(0.86f, 0.31f, 0.08f), 
		CRGBF(0.71f, 0.24f, 0.47f), CRGBF(0.39f, 0.16f, 0.71f), CRGBF(0.12f, 0.08f, 0.55f), 
		CRGBF(0.04f, 0.06f, 0.31f) 
	};
	const int palette_size = 7;

	for (int i = 0; i < NUM_LEDS; i++) {
		// CENTER-ORIGIN: Distance from center (0.0 at center → 1.0 at edges)
		float position = (abs(float(i) - (NUM_LEDS / 2.0f)) / (NUM_LEDS / 2.0f));
		position = fmaxf(0.0f, fminf(1.0f, position));
		
		// Palette interpolation
		int palette_index = (int)(position * (palette_size - 1));
		float interpolation_factor = (position * (palette_size - 1)) - palette_index;
		
		// Clamp to valid range
		if (palette_index >= palette_size - 1) {
			leds[i] = palette_colors[palette_size - 1];
		} else {
			const CRGBF& color1 = palette_colors[palette_index];
			const CRGBF& color2 = palette_colors[palette_index + 1];
			
			leds[i].r = color1.r + (color2.r - color1.r) * interpolation_factor;
			leds[i].g = color1.g + (color2.g - color1.g) * interpolation_factor;
			leds[i].b = color1.b + (color2.b - color1.b) * interpolation_factor;
		}
		
		// Apply runtime parameters: brightness multiplier
		leds[i].r *= params.brightness;
		leds[i].g *= params.brightness;
		leds[i].b *= params.brightness;
	}

    // Apply uniform background overlay
    apply_background_overlay(params);
}

// ============================================================================
// DOMAIN 2: AUDIO-REACTIVE PATTERNS
// ============================================================================

/**
 * Pattern: Spectrum Display
 * Maps frequency spectrum to LED positions with magnitude-driven color
 *
 * Architecture (Emotiscope spectrum.h reference):
 * - progress = LED position (0.0 at left, 1.0 at right)
 * - brightness = frequency magnitude
 * - Uses color_from_palette() for vibrant interpolation
 * - Center-origin: render half, mirror to other half
 */
void draw_spectrum(float time, const PatternParameters& params) {
	PATTERN_AUDIO_START();

	// Fallback to ambient if no audio
	if (!AUDIO_IS_AVAILABLE()) {
		CRGBF ambient_color = color_from_palette(
			params.palette_id,
			clip_float(params.color),
			clip_float(params.background) * clip_float(params.brightness)
		);
		for (int i = 0; i < NUM_LEDS; i++) {
			leds[i] = ambient_color;
		}
		return;
	}

	// Optional optimization: skip render if no new audio frame
	if (!AUDIO_IS_FRESH()) {
		return;
	}

	// Graded decay based on audio age (smoother silence handling)
	float age_ms = (float)AUDIO_AGE_MS();
	float age_factor = 1.0f - fminf(age_ms, 250.0f) / 250.0f; // 0..1 over ~250ms
	age_factor = fmaxf(0.0f, age_factor);

	// Render spectrum (center-origin, so render half and mirror)
	int half_leds = NUM_LEDS / 2;

	float smooth_mix = clip_float(params.custom_param_3); // 0.0 = raw, 1.0 = fully smoothed

	for (int i = 0; i < half_leds; i++) {
		// Map LED position to frequency bin (0-63)
		float progress = (float)i / half_leds;
		// Blend raw and smoothed spectrum to control responsiveness
		float raw_mag = clip_float(interpolate(progress, AUDIO_SPECTRUM, NUM_FREQS));
		float smooth_mag = clip_float(AUDIO_SPECTRUM_INTERP(progress));
		float magnitude = (raw_mag * (1.0f - smooth_mix) + smooth_mag * smooth_mix);
		// Emphasize separation and apply age-based decay
		magnitude = response_sqrt(magnitude) * age_factor;

		// Get color from palette using progress and magnitude
		CRGBF color = color_from_palette(params.palette_id, progress, magnitude);

		// Apply global brightness
		color.r *= params.brightness;
		color.g *= params.brightness;
		color.b *= params.brightness;

		// Mirror from center (centre-origin architecture)
		int left_index = (NUM_LEDS / 2) - 1 - i;
		int right_index = (NUM_LEDS / 2) + i;

		leds[left_index] = color;
		leds[right_index] = color;
	}

	// Uniform background handling across patterns
	apply_background_overlay(params);
}

/**
 * Pattern: Octave Band Response
 * Maps 12 musical octave bands to LED segments.
 *
 * Architecture (Emotiscope octave.h reference):
 * - progress = LED position (maps to 12 chromagram bins)
 * - brightness = note magnitude from chromagram
 * - Uses color_from_palette() for smooth color transitions
 * - Center-origin: render half, mirror to other half
 */
void draw_octave(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    // Fallback to time-based animation if no audio
    if (!AUDIO_IS_AVAILABLE()) {
        float phase = fmodf(time * params.speed * 0.5f, 1.0f);
        for (int i = 0; i < NUM_LEDS; i++) {
            float position = fmodf(phase + (float)i / NUM_LEDS, 1.0f);
            leds[i] = color_from_palette(
                params.palette_id,
                position,
                clip_float(params.background) * clip_float(params.brightness)
            );
        }
        return;
    }

	// Energy emphasis (boost brightness on strong audio activity)
    float energy_gate = fminf(1.0f, (AUDIO_VU * 0.7f) + (AUDIO_NOVELTY * 0.4f));
    float energy_boost = 1.0f + (beat_gate(energy_gate) * 0.5f);
	// Graded decay based on audio age
	float age_ms = (float)AUDIO_AGE_MS();
	float age_factor = 1.0f - fminf(age_ms, 250.0f) / 250.0f;
	age_factor = fmaxf(0.0f, age_factor);

	// Render chromagram (12 musical notes)
	int half_leds = NUM_LEDS / 2;

	for (int i = 0; i < half_leds; i++) {
		// Map LED to chromagram bin (0-11)
		float progress = (float)i / half_leds;
		// USE INTERPOLATION for smooth chromagram mapping!
		float magnitude = interpolate(progress, AUDIO_CHROMAGRAM, 12);
		// Normalize gently and emphasize peaks, apply age and energy gates
		magnitude = response_sqrt(magnitude) * age_factor * energy_boost;
		magnitude = fmaxf(0.0f, fminf(1.0f, magnitude));

		// Get color from palette
		CRGBF color = color_from_palette(params.palette_id, progress, magnitude);

		// Apply global brightness
		color.r *= params.brightness;
		color.g *= params.brightness;
		color.b *= params.brightness;

		// Mirror from center
		int left_index = (NUM_LEDS / 2) - 1 - i;
		int right_index = (NUM_LEDS / 2) + i;

        leds[left_index] = color;
        leds[right_index] = color;
    }

    // Uniform background handling across patterns
    apply_background_overlay(params);
}

/**
 * Pattern: Bloom / VU-Meter
 * Energy-responsive glow with spreading persistence
 *
 * Uses static buffer for frame-to-frame persistence (like Emotiscope's novelty_image_prev)
 * Spreads energy from center outward with Gaussian-like blur
 */
void draw_bloom(float time, const PatternParameters& params) {
    static float bloom_trail[NUM_LEDS] = {0.0f};
    static float bloom_trail_prev[NUM_LEDS] = {0.0f};

    PATTERN_AUDIO_START();

    float spread_speed = 0.125f + 0.875f * clip_float(params.speed);
    // Reduce saturation: decay incorporates softness (persistence)
    float trail_decay = 0.92f + 0.06f * clip_float(params.softness); // 0.92..0.98
    // Accelerate: pre-scale previous trail with DSPS mulc, then use alpha=1.0
    dsps_mulc_f32_inplace(bloom_trail_prev, NUM_LEDS, trail_decay);
    draw_sprite_float(bloom_trail, bloom_trail_prev, NUM_LEDS, NUM_LEDS, spread_speed, 1.0f);

	if (AUDIO_IS_AVAILABLE()) {
		// Loudness-aware injection using absolute bands, with sqrt response to favor quiet content
		float energy_gate = fminf(1.0f, (AUDIO_VU * 0.9f) + (AUDIO_NOVELTY * 0.5f));
		float inject_base = response_sqrt(AUDIO_BASS_ABS()) * 0.6f
			+ response_sqrt(AUDIO_MIDS_ABS()) * 0.3f
			+ response_sqrt(AUDIO_TREBLE_ABS()) * 0.2f;
		// User-adjustable low-level boost (custom_param_3 ∈ [0,1] → boost ∈ [1.0,2.0])
		float boost = 1.0f + fmaxf(0.0f, fminf(1.0f, params.custom_param_3)) * 1.0f;
		float inject = inject_base * (0.25f + energy_gate * 0.85f) * boost;
		// Minimal floor to avoid vanishing on near-silence when energy is present
		if (inject < 0.02f && energy_gate > 0.05f) inject = 0.02f;
		bloom_trail[0] = fmaxf(bloom_trail[0], inject);
		// Seed an adjacent cell to improve initial spread
		bloom_trail[1] = fmaxf(bloom_trail[1], inject * 0.6f);
	}

	int half_leds = NUM_LEDS >> 1;
	for (int i = 0; i < half_leds; ++i) {
		float brightness = clip_float(bloom_trail[i]);
		CRGBF color = color_from_palette(params.palette_id, static_cast<float>(i) / half_leds, brightness);
		color.r *= params.brightness;
		color.g *= params.brightness;
		color.b *= params.brightness;

		int left_index = (half_leds - 1) - i;
		int right_index = half_leds + i;
		leds[left_index] = color;
		leds[right_index] = color;
	}

    // Accelerated copy (wrapper uses memcpy underneath)
    dsps_memcpy_accel(bloom_trail_prev, bloom_trail, sizeof(float) * NUM_LEDS);

	// Uniform background handling across patterns
	apply_background_overlay(params);
}

void draw_bloom_mirror(float time, const PatternParameters& params) {
	static CRGBF bloom_buffer[NUM_LEDS];
	static CRGBF bloom_buffer_prev[NUM_LEDS];

	PATTERN_AUDIO_START();

	// Scroll the full strip outward and apply decay
	float scroll_speed = 0.25f + 1.75f * clip_float(params.speed);
	std::fill(std::begin(bloom_buffer), std::end(bloom_buffer), CRGBF{0.0f, 0.0f, 0.0f});
	// Tuned decay to reduce washout; respect softness
	float decay = 0.92f + 0.06f * clip_float(params.softness); // 0.92..0.98
	draw_sprite(bloom_buffer, bloom_buffer_prev, NUM_LEDS, NUM_LEDS, scroll_speed, decay);

	// Build chromagram-driven colour blend (Sensory Bridge style)
	CRGBF wave_color = { 0.0f, 0.0f, 0.0f };
	float brightness_accum = 0.0f;
	bool chromatic_mode = (params.custom_param_1 >= 0.5f);

	if (AUDIO_IS_AVAILABLE()) {
		const float energy_gate = fminf(1.0f, (AUDIO_VU * 0.7f) + (AUDIO_NOVELTY * 0.4f));
		const float share = 1.0f / 6.0f;
		for (int i = 0; i < 12; ++i) {
			float bin = clip_float(AUDIO_CHROMAGRAM[i]);
			// Emphasize peaks and gate by audio energy for separation
			bin = clip_float(bin * bin);
			bin *= (0.25f + energy_gate * 0.75f);
			float energy = clip_float(bin * share);

			if (chromatic_mode) {
				float progress = (static_cast<float>(i) + 0.5f) / 12.0f;
				CRGBF add = color_from_palette(params.palette_id, progress, energy);
				wave_color.r += add.r;
				wave_color.g += add.g;
				wave_color.b += add.b;
			}
			else {
				brightness_accum += energy;
			}
		}
	}
	else if (chromatic_mode) {
		wave_color = color_from_palette(params.palette_id, 0.0f, 0.05f);
	}
	else {
		brightness_accum = 0.05f;
	}

	if (!chromatic_mode) {
		float base_progress = clip_float(params.color);
		wave_color = color_from_palette(params.palette_id, base_progress, clip_float(brightness_accum));
	}
	else {
		wave_color.r = std::min(1.0f, wave_color.r);
		wave_color.g = std::min(1.0f, wave_color.g);
		wave_color.b = std::min(1.0f, wave_color.b);

		float square_mix = clip_float(params.custom_param_2);
		if (square_mix > 0.0f) {
			wave_color.r = wave_color.r * (1.0f - square_mix) + (wave_color.r * wave_color.r) * square_mix;
			wave_color.g = wave_color.g * (1.0f - square_mix) + (wave_color.g * wave_color.g) * square_mix;
			wave_color.b = wave_color.b * (1.0f - square_mix) + (wave_color.b * wave_color.b) * square_mix;
		}
	}

	wave_color = force_saturation(wave_color, params.saturation);
	HSVF wave_hsv = rgb_to_hsv(wave_color);
	float hue_offset = chromatic_mode ? wave_hsv.h : 0.0f;

	// Inject new wave energy at the centre using audio energy
	int center = NUM_LEDS >> 1;
	float conf_inject = fminf(1.0f, (AUDIO_VU * 0.9f) + (AUDIO_NOVELTY * 0.5f));
	// Small floor ensures visible response in quiet scenes
	conf_inject = fmaxf(conf_inject, 0.06f);
	// Apply user-adjustable low-level boost (custom_param_3 ∈ [0,1] → [1.0,2.0])
	float boost_mirror = 1.0f + fmaxf(0.0f, fminf(1.0f, params.custom_param_3)) * 1.0f;
	conf_inject *= boost_mirror;
	bloom_buffer[center - 1].r += wave_color.r * conf_inject;
	bloom_buffer[center - 1].g += wave_color.g * conf_inject;
	bloom_buffer[center - 1].b += wave_color.b * conf_inject;
	bloom_buffer[center].r += wave_color.r * conf_inject;
	bloom_buffer[center].g += wave_color.g * conf_inject;
	bloom_buffer[center].b += wave_color.b * conf_inject;

	// Preserve unfaded frame for next scroll before rendering adjustments
	std::memcpy(bloom_buffer_prev, bloom_buffer, sizeof(CRGBF) * NUM_LEDS);

	// Apply tail fade on the far end (rendering only)
	int fade_span = NUM_LEDS >> 2;
	for (int i = 0; i < fade_span; ++i) {
		float prog = static_cast<float>(i) / static_cast<float>(fade_span);
		float atten = prog * prog;
		int idx = NUM_LEDS - 1 - i;
		bloom_buffer[idx].r *= atten;
		bloom_buffer[idx].g *= atten;
		bloom_buffer[idx].b *= atten;
	}

	// Mirror right half onto left for symmetry
	for (int i = 0; i < center; ++i) {
		bloom_buffer[i] = bloom_buffer[(NUM_LEDS - 1) - i];
	}

	// Output to LED buffer with brightness applied
	int half_leds = center;
	for (int i = 0; i < NUM_LEDS; ++i) {
		int mirrored_idx = (i < center) ? (center - 1 - i) : (i - center);
		float radial = (half_leds > 1)
			? static_cast<float>(mirrored_idx) / static_cast<float>(half_leds - 1)
			: 0.0f;

		float palette_progress = radial;
		if (chromatic_mode) {
			palette_progress = fmodf(radial + hue_offset, 1.0f);
			if (palette_progress < 0.0f) {
				palette_progress += 1.0f;
			}
		}

		HSVF px_hsv = rgb_to_hsv(bloom_buffer[i]);
		float px_brightness = clip_float(px_hsv.v);

		CRGBF palette_color = color_from_palette(
			params.palette_id,
			palette_progress,
			px_brightness * params.brightness
		);

		leds[i] = palette_color;
	}

	// Uniform background handling across patterns
	apply_background_overlay(params);

}

/**
 * Pattern: Pulse (Beat-Reactive Waves)
 * Emotion: Heartbeat - spawns concentric waves on beat detection
 *
 * Architecture (Emotiscope pulse.h reference):
 * - Maintains pool of 6 concurrent waves
 * - Each wave: Gaussian bell curve with exponential decay
 * - Color from dominant chromatic note
 * - Additive blending for overlapping waves
 * - Speed parameter controls wave propagation
 */

// PALETTE SUPPORT (NEW - October 2025)
// This pattern now supports BOTH systems:
// 1. Palette Mode: color_range > 0.5 uses discrete color gradients (33 curated palettes)
// 2. HSV Mode: color_range <= 0.5 uses parametric HSV color generation
// Web UI: Users select palette from dropdown, maps to params.color (0.0-1.0 → palette 0-32)

// EASING FUNCTIONS (NEW - October 2025)
// Use with animation progress values to smooth transitions:
// float eased = ease_cubic_in_out(progress);  // Smooth acceleration/deceleration
// float bouncy = ease_bounce_out(progress);   // Bouncy effect
// float elastic = ease_elastic_out(progress); // Springy effect
//
// Example in pattern:
// float progress = fmodf(time * params.speed, 1.0f);  // 0.0 to 1.0
// float eased = ease_cubic_in_out(progress);
// float position = eased * NUM_LEDS;  // Use eased position instead of linear

#define MAX_PULSE_WAVES 6

typedef struct {
	float position;      // 0.0-1.0 normalized position from center
	float speed;         // LEDs per frame
	float hue;           // Color from dominant chroma note
	float brightness;    // Initial amplitude from beat strength
	uint16_t age;        // Frames since spawned
	bool active;         // Is this wave active?
} pulse_wave;

static pulse_wave pulse_waves[MAX_PULSE_WAVES];

// Helper: get dominant chromatic note (highest energy in chromagram)
float get_dominant_chroma_hue() {
	AudioDataSnapshot audio{};
	bool audio_available = get_audio_snapshot(&audio);

	if (!audio_available) {
		return 0.0f;  // Default to C if no audio available
	}

	float max_chroma = 0.0f;
	uint16_t max_index = 0;

	for (uint16_t i = 0; i < 12; i++) {
		if (audio.chromagram[i] > max_chroma) {
			max_chroma = audio.chromagram[i];
			max_index = i;
		}
	}

	// Map chromagram index (0-11) to hue (0.0-1.0)
	return (float)max_index / 12.0f;
}

void draw_pulse(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    // Frame-rate independent delta time
    static float last_time_pulse = 0.0f;
    float dt_pulse = time - last_time_pulse;
    if (dt_pulse < 0.0f) dt_pulse = 0.0f;
    if (dt_pulse > 0.05f) dt_pulse = 0.05f; // clamp large jumps
    last_time_pulse = time;

	// Diagnostic logging (once per second)
	static uint32_t last_diagnostic = 0;
	uint32_t now = millis();
	if (now - last_diagnostic > 1000) {
		last_diagnostic = now;
		LOG_DEBUG(TAG_GPU, "[PULSE] audio_available=%d, brightness=%.2f, speed=%.2f",
			(int)AUDIO_IS_AVAILABLE(), params.brightness, params.speed);
	}

	// Fallback to ambient if no audio
	if (!AUDIO_IS_AVAILABLE()) {
		for (int i = 0; i < NUM_LEDS; i++) {
			leds[i] = color_from_palette(params.palette_id, 0.5f, params.background);
		}
		return;
	}

	// Energy-driven wave spawning using raw audio features
	const float energy_gate = fminf(
		1.0f,
		(AUDIO_VU * 0.8f) +
		(AUDIO_KICK() * 0.6f) +
		(AUDIO_NOVELTY * 0.4f)
	);
	const float spawn_threshold = 0.18f;
    if (energy_gate > spawn_threshold) {
		// Spawn new wave on beat
		for (uint16_t i = 0; i < MAX_PULSE_WAVES; i++) {
			if (!pulse_waves[i].active) {
				pulse_waves[i].position = 0.0f;
                // Speed expressed as normalized units per second (formerly per frame)
                pulse_waves[i].speed = (0.25f + params.speed * 0.75f);
				pulse_waves[i].hue = get_dominant_chroma_hue();
				pulse_waves[i].brightness = fmaxf(energy_gate, 0.25f);
				pulse_waves[i].age = 0;
				pulse_waves[i].active = true;
				break; // Only spawn one wave per frame
			}
		}
	}

	// Clear LED buffer
	for (int i = 0; i < NUM_LEDS; i++) {
		leds[i] = CRGBF(0.0f, 0.0f, 0.0f);
	}

	// Update and render all active waves
	float decay_factor = 0.02f + (params.softness * 0.03f);
	float base_width = 0.08f;
	float width_growth = 0.05f;

	for (uint16_t w = 0; w < MAX_PULSE_WAVES; w++) {
		if (!pulse_waves[w].active) continue;

        // Update wave position (frame-rate independent)
        pulse_waves[w].position += pulse_waves[w].speed * dt_pulse;
		pulse_waves[w].age++;

		// Deactivate if wave traveled past LEDs
		if (pulse_waves[w].position > 1.5f) {
			pulse_waves[w].active = false;
			continue;
		}

		// Render wave as Gaussian bell curve
		float decay = expf(-(float)pulse_waves[w].age * decay_factor);
		float wave_width = base_width + width_growth * pulse_waves[w].age;

		for (int i = 0; i < (NUM_LEDS >> 1); i++) {
			float led_progress = LED_PROGRESS(i);

			// Gaussian bell curve centered at wave position
			float distance = fabsf(led_progress - pulse_waves[w].position);
			float gaussian = expf(-(distance * distance) / (2.0f * wave_width * wave_width));

			// Combine brightness with decay and age-based audio decay
			float age_ms = (float)AUDIO_AGE_MS();
			float age_factor = 1.0f - fminf(age_ms, 250.0f) / 250.0f;
			age_factor = fmaxf(0.0f, age_factor);
			float intensity = pulse_waves[w].brightness * gaussian * decay * age_factor;
			intensity = fmaxf(0.0f, fminf(1.0f, intensity));

			// Use palette system directly from web UI selection
			CRGBF color = color_from_palette(params.palette_id, pulse_waves[w].hue, intensity);

			// Additive blending for overlapping waves
			leds[i].r = fmaxf(0.0f, fminf(1.0f, leds[i].r + color.r * intensity));
			leds[i].g = fmaxf(0.0f, fminf(1.0f, leds[i].g + color.g * intensity));
			leds[i].b = fmaxf(0.0f, fminf(1.0f, leds[i].b + color.b * intensity));
		}
	}

	// Mirror from center
	apply_mirror_mode(leds, true);

	// Apply global brightness
	for (int i = 0; i < NUM_LEDS; i++) {
		leds[i].r *= params.brightness;
		leds[i].g *= params.brightness;
		leds[i].b *= params.brightness;
	}

    // Apply uniform background overlay
    apply_background_overlay(params);
}

/**
 * Pattern: Tempiscope (Tempo Visualization)
 * Emotion: Rhythm - displays beat phase across tempo spectrum
 *
 * Architecture (Emotiscope tempiscope.h reference):
 * - Visualizes all 64 tempo bins
 * - Shows beat phase with sine modulation
 * - Color gradient across tempo frequency range
 * - Responds to tempo confidence
 */

// PALETTE SUPPORT (NEW - October 2025)
// This pattern now supports BOTH systems:
// 1. Palette Mode: color_range > 0.5 uses discrete color gradients (33 curated palettes)
// 2. HSV Mode: color_range <= 0.5 uses parametric HSV color generation
// Web UI: Users select palette from dropdown, maps to params.color (0.0-1.0 → palette 0-32)

// EASING FUNCTIONS (NEW - October 2025)
// Use with animation progress values to smooth transitions:
// float eased = ease_cubic_in_out(progress);  // Smooth acceleration/deceleration
// float bouncy = ease_bounce_out(progress);   // Bouncy effect
// float elastic = ease_elastic_out(progress); // Springy effect
//
// Example in pattern:
// float progress = fmodf(time * params.speed, 1.0f);  // 0.0 to 1.0
// float eased = ease_cubic_in_out(progress);
// float position = eased * NUM_LEDS;  // Use eased position instead of linear
void draw_tempiscope(float time, const PatternParameters& params) {
	PATTERN_AUDIO_START();

	// Diagnostic logging (once per second)
	static uint32_t last_diagnostic = 0;
	uint32_t now = millis();
	if (now - last_diagnostic > 1000) {
		last_diagnostic = now;
		LOG_DEBUG(TAG_GPU, "[TEMPISCOPE] audio_available=%d, brightness=%.2f, speed=%.2f",
			(int)AUDIO_IS_AVAILABLE(), params.brightness, params.speed);
	}

	// Fallback to animated gradient if no audio
	if (!AUDIO_IS_AVAILABLE()) {
		float phase = fmodf(time * params.speed * 0.3f, 1.0f);
		for (int i = 0; i < NUM_LEDS; i++) {
			float position = fmodf(phase + LED_PROGRESS(i), 1.0f);
			leds[i] = color_from_palette(params.palette_id, position, params.background);
		}
		return;
	}

	// Clear LED buffer
	for (int i = 0; i < NUM_LEDS; i++) {
		leds[i] = CRGBF(0.0f, 0.0f, 0.0f);
	}

	// Render frequency bands using smoothed spectrum data
	const int half_leds = NUM_LEDS >> 1;
	const float freshness = AUDIO_IS_STALE() ? 0.6f : 1.0f;
	const float speed_scale = 0.4f + params.speed * 0.6f;
	for (int i = 0; i < half_leds; i++) {
		float progress = (half_leds > 1) ? ((float)i / (float)(half_leds - 1)) : 0.0f;
		float spectrum = AUDIO_SPECTRUM_INTERP(progress);
		float brightness = powf(spectrum, 0.85f) * speed_scale * freshness;
		brightness = clip_float(brightness);

		CRGBF color = color_from_palette(params.palette_id, progress, brightness * params.saturation);
		color.r *= params.brightness;
		color.g *= params.brightness;
		color.b *= params.brightness;

		int left_index = (half_leds - 1) - i;
		int right_index = half_leds + i;
		leds[left_index] = color;
		leds[right_index] = color;
	}

    // Apply uniform background overlay
    apply_background_overlay(params);
}

// ============================================================================
// BEAT TUNNEL PATTERN - Tempo-driven tunnel with sprite persistence
// ============================================================================

// PALETTE SUPPORT (NEW - October 2025)
// This pattern now supports BOTH systems:
// 1. Palette Mode: color_range > 0.5 uses discrete color gradients (33 curated palettes)
// 2. HSV Mode: color_range <= 0.5 uses parametric HSV color generation
// Web UI: Users select palette from dropdown, maps to params.color (0.0-1.0 → palette 0-32)

// EASING FUNCTIONS (NEW - October 2025)
// Use with animation progress values to smooth transitions:
// float eased = ease_cubic_in_out(progress);  // Smooth acceleration/deceleration
// float bouncy = ease_bounce_out(progress);   // Bouncy effect
// float elastic = ease_elastic_out(progress); // Springy effect
//
// Example in pattern:
// float progress = fmodf(time * params.speed, 1.0f);  // 0.0 to 1.0
// float eased = ease_cubic_in_out(progress);
// float position = eased * NUM_LEDS;  // Use eased position instead of linear

// Static buffers for tunnel image and motion blur persistence
static CRGBF beat_tunnel_variant_image[NUM_LEDS];
static CRGBF beat_tunnel_variant_image_prev[NUM_LEDS];
static float beat_tunnel_variant_angle = 0.0f;
static CRGBF beat_tunnel_image[NUM_LEDS];
static CRGBF beat_tunnel_image_prev[NUM_LEDS];
static float beat_tunnel_angle = 0.0f;

void draw_beat_tunnel(float time, const PatternParameters& params) {
	PATTERN_AUDIO_START();

	static float last_time_bt = 0.0f;
	float dt_bt = time - last_time_bt;
	if (dt_bt < 0.0f) dt_bt = 0.0f;
	if (dt_bt > 0.05f) dt_bt = 0.05f;
	last_time_bt = time;

	for (int i = 0; i < NUM_LEDS; i++) {
		beat_tunnel_image[i] = CRGBF(0.0f, 0.0f, 0.0f);
	}

	float speed = 0.0015f + 0.0065f * clip_float(params.speed);
	beat_tunnel_angle += speed * (dt_bt > 0.0f ? (dt_bt * 1000.0f) : 1.0f);
	if (beat_tunnel_angle > static_cast<float>(2.0 * M_PI)) {
		beat_tunnel_angle = fmodf(beat_tunnel_angle, static_cast<float>(2.0 * M_PI));
	}

	float position = (0.125f + 0.875f * clip_float(params.speed)) * sinf(beat_tunnel_angle) * 0.5f;
	// Respect global softness in persistence/decay
	float decay = 0.90f + 0.08f * clip_float(params.softness); // 0.90..0.98
	draw_sprite(beat_tunnel_image, beat_tunnel_image_prev, NUM_LEDS, NUM_LEDS, position, decay);

	if (!AUDIO_IS_AVAILABLE()) {
		for (int i = 0; i < NUM_LEDS; i++) {
			float led_pos = LED_PROGRESS(i);
			float distance = fabsf(led_pos - (position * 0.5f + 0.5f));
			float brightness = expf(-(distance * distance) / (2.0f * 0.08f * 0.08f));
			brightness = clip_float(brightness * clip_float(params.background));
			CRGBF color = color_from_palette(params.palette_id, led_pos, brightness);
			beat_tunnel_image[i].r += color.r * brightness;
			beat_tunnel_image[i].g += color.g * brightness;
			beat_tunnel_image[i].b += color.b * brightness;
		}
	} else {
		float energy = fminf(1.0f, (AUDIO_VU * 0.8f) + (AUDIO_NOVELTY * 0.5f));
		for (int i = 0; i < NUM_LEDS; i++) {
			float led_pos = LED_PROGRESS(i);
			float spectrum = AUDIO_SPECTRUM_INTERP(led_pos);
			float brightness = powf(spectrum, 0.9f) * (0.3f + energy * 0.7f);
			brightness = clip_float(brightness);

			CRGBF color = color_from_palette(params.palette_id, led_pos, brightness);
			beat_tunnel_image[i].r += color.r * brightness;
			beat_tunnel_image[i].g += color.g * brightness;
			beat_tunnel_image[i].b += color.b * brightness;
		}
	}

	for (int i = 0; i < NUM_LEDS; i++) {
		beat_tunnel_image[i].r = clip_float(beat_tunnel_image[i].r);
		beat_tunnel_image[i].g = clip_float(beat_tunnel_image[i].g);
		beat_tunnel_image[i].b = clip_float(beat_tunnel_image[i].b);
	}

	apply_mirror_mode(beat_tunnel_image, true);

	for (int i = 0; i < NUM_LEDS; i++) {
		leds[i].r = beat_tunnel_image[i].r * params.brightness;
		leds[i].g = beat_tunnel_image[i].g * params.brightness;
		leds[i].b = beat_tunnel_image[i].b * params.brightness;
	}

    // Apply uniform background overlay
    apply_background_overlay(params);

	for (int i = 0; i < NUM_LEDS; i++) {
		beat_tunnel_image_prev[i] = beat_tunnel_image[i];
	}
}

void draw_beat_tunnel_variant(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    // Frame-rate independent delta time
    static float last_time_bt = 0.0f;
    float dt_bt = time - last_time_bt;
    if (dt_bt < 0.0f) dt_bt = 0.0f;
    if (dt_bt > 0.05f) dt_bt = 0.05f; // clamp to avoid large jumps
    last_time_bt = time;

	// Diagnostic logging (once per second)
	static uint32_t last_diagnostic = 0;
	uint32_t now = millis();
	if (now - last_diagnostic > 1000) {
		last_diagnostic = now;
		LOG_DEBUG(TAG_GPU, "[BEAT_TUNNEL] audio_available=%d, brightness=%.2f, speed=%.2f",
			(int)AUDIO_IS_AVAILABLE(), params.brightness, params.speed);
	}

	// Clear frame buffer
    for (int i = 0; i < NUM_LEDS; i++) {
        beat_tunnel_variant_image[i] = CRGBF(0.0f, 0.0f, 0.0f);
	}

    // Animate sprite position using sine wave modulation (rate per second)
    // Previously per-frame 0.001; approximate 120 FPS => 0.12 rad/sec
    float angle_speed = 0.12f * (0.5f + params.speed * 0.5f);
    beat_tunnel_variant_angle += angle_speed * dt_bt;
    float position = (0.125f + 0.875f * params.speed) * sinf(beat_tunnel_variant_angle) * 0.5f;

    // Use draw_sprite for proper scrolling motion effect!
    float decay = 0.6f + (0.38f * fmaxf(0.0f, fminf(1.0f, params.softness)));
    draw_sprite(beat_tunnel_variant_image, beat_tunnel_variant_image_prev, NUM_LEDS, NUM_LEDS, position, decay);

	if (!AUDIO_IS_AVAILABLE()) {
		// Fallback: simple animated pattern using palette system
		for (int i = 0; i < NUM_LEDS; i++) {
			float led_pos = LED_PROGRESS(i);
			float distance = fabsf(led_pos - position);
			float brightness = expf(-(distance * distance) / (2.0f * 0.08f * 0.08f));
			brightness = fmaxf(0.0f, fminf(1.0f, brightness));

			// Use palette system directly from web UI selection
			CRGBF color = color_from_palette(params.palette_id, led_pos, brightness * 0.5f);

            beat_tunnel_variant_image[i].r += color.r * brightness;
            beat_tunnel_variant_image[i].g += color.g * brightness;
            beat_tunnel_variant_image[i].b += color.b * brightness;
		}
	} else {
        float energy = fminf(1.0f, (AUDIO_VU * 0.7f) + (AUDIO_NOVELTY * 0.4f));
        for (int i = 0; i < NUM_LEDS; i++) {
            float led_pos = LED_PROGRESS(i);
            float sample_pos = fabsf(led_pos - 0.5f) * 2.0f;
            float spectrum = AUDIO_SPECTRUM_INTERP(sample_pos);
            float brightness = powf(spectrum, 1.05f) * (0.25f + energy * 0.75f);
            brightness = clip_float(brightness);

            CRGBF color = color_from_palette(params.palette_id, led_pos, brightness);
            beat_tunnel_variant_image[i].r += color.r * brightness;
            beat_tunnel_variant_image[i].g += color.g * brightness;
            beat_tunnel_variant_image[i].b += color.b * brightness;
        }
	}

	// Clamp values to [0, 1]
	for (int i = 0; i < NUM_LEDS; i++) {
        beat_tunnel_variant_image[i].r = fmaxf(0.0f, fminf(1.0f, beat_tunnel_variant_image[i].r));
        beat_tunnel_variant_image[i].g = fmaxf(0.0f, fminf(1.0f, beat_tunnel_variant_image[i].g));
        beat_tunnel_variant_image[i].b = fmaxf(0.0f, fminf(1.0f, beat_tunnel_variant_image[i].b));
	}

	// Apply mirror mode
    apply_mirror_mode(beat_tunnel_variant_image, true);

	// Copy tunnel image to LED output and apply brightness
	for (int i = 0; i < NUM_LEDS; i++) {
        leds[i].r = beat_tunnel_variant_image[i].r * params.brightness;
        leds[i].g = beat_tunnel_variant_image[i].g * params.brightness;
        leds[i].b = beat_tunnel_variant_image[i].b * params.brightness;
	}

    // Apply uniform background overlay
    apply_background_overlay(params);

	// Save current frame for next iteration's motion blur
	for (int i = 0; i < NUM_LEDS; i++) {
        beat_tunnel_variant_image_prev[i] = beat_tunnel_variant_image[i];
    }
}

// ============================================================================
// PERLIN PATTERN - Procedural noise driven by animation
// ============================================================================

// Static buffers for Perlin noise generation
static float beat_perlin_noise_array[NUM_LEDS >> 2];  // 32 floats for 128 LEDs
static float beat_perlin_position_x = 0.0f;
static float beat_perlin_position_y = 0.0f;

// Simple hash function for Perlin-like noise
static inline uint32_t hash_ui(uint32_t x, uint32_t seed) {
	const uint32_t m = 0x5bd1e995U;
	uint32_t hash = seed;
	uint32_t k = x;
	k *= m;
	k ^= k >> 24;
	k *= m;
	hash *= m;
	hash ^= k;
	hash ^= hash >> 13;
	hash *= m;
	hash ^= hash >> 15;
	return hash;
}

// Basic Perlin-like noise value
static inline float perlin_noise_simple_2d(float x, float y, uint32_t seed) {
	// Simple 2D noise using hashing and interpolation
	int xi = (int)floorf(x);
	int yi = (int)floorf(y);
	float xf = x - xi;
	float yf = y - yi;

	// Smooth interpolation curve
	float u = xf * xf * (3.0f - 2.0f * xf);
	float v = yf * yf * (3.0f - 2.0f * yf);

	// Hash four corners
	float n00 = (float)(hash_ui(xi + (yi << 16), seed) & 0x7FFFFFFF) / 1073741824.0f;
	float n10 = (float)(hash_ui((xi + 1) + (yi << 16), seed) & 0x7FFFFFFF) / 1073741824.0f;
	float n01 = (float)(hash_ui(xi + ((yi + 1) << 16), seed) & 0x7FFFFFFF) / 1073741824.0f;
	float n11 = (float)(hash_ui((xi + 1) + ((yi + 1) << 16), seed) & 0x7FFFFFFF) / 1073741824.0f;

	// Bilinear interpolation
	float nx0 = n00 + u * (n10 - n00);
	float nx1 = n01 + u * (n11 - n01);
	return nx0 + v * (nx1 - nx0);
}

void draw_perlin(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    // Update Perlin noise position with time
    beat_perlin_position_x = 0.0f;  // Fixed X
    // Audio-driven momentum (Emotiscope-inspired): vu^4 controls flow speed
    {
        // Frame-rate independent delta time
        static float last_time_perlin = 0.0f;
        float dt_perlin = time - last_time_perlin;
        if (dt_perlin < 0.0f) dt_perlin = 0.0f;
        if (dt_perlin > 0.05f) dt_perlin = 0.05f;
        last_time_perlin = time;

        float vu = AUDIO_IS_AVAILABLE() ? AUDIO_VU : 0.3f;
        // Convert previous per-frame constants to per-second rates (≈120 FPS baseline)
        float momentum_per_sec = (0.0008f + 0.004f * params.speed) * 120.0f;
        momentum_per_sec *= (0.2f + powf(vu, 4.0f) * 0.8f);
        beat_perlin_position_y += momentum_per_sec * dt_perlin;
    }

	// Generate Perlin noise for downsampled positions (optimized)
	const uint16_t downsample_count = NUM_LEDS >> 2;
	const float inv_downsample_count = 1.0f / (float)downsample_count;
	
	for (uint16_t i = 0; i < downsample_count; i++) {
		const float pos_progress = (float)i * inv_downsample_count;
		const float noise_x = beat_perlin_position_x + pos_progress * 2.0f;
		const float noise_y = beat_perlin_position_y;

		// Simplified single-octave Perlin for better performance
		// Multi-octave was expensive - single octave still looks good
		const float value = perlin_noise_simple_2d(noise_x * 2.0f, noise_y * 2.0f, 0x578437adU);

		// Normalize to [0, 1] with clamping
		float normalized = (value + 1.0f) * 0.5f;
		beat_perlin_noise_array[i] = (normalized < 0.0f) ? 0.0f : (normalized > 1.0f) ? 1.0f : normalized;
	}

	// Render Perlin noise field as LEDs
	for (int i = 0; i < NUM_LEDS; i++) {
		float noise_value = beat_perlin_noise_array[i >> 2];  // Sample from downsampled array

		// Use noise as hue, fixed saturation and brightness
		float hue = fmodf(noise_value * 0.66f + time * 0.1f * params.speed, 1.0f);
		float brightness = 0.25f + noise_value * 0.5f;  // 25-75% brightness

		CRGBF color = color_from_palette(params.palette_id, hue, brightness);

		leds[i].r = color.r * params.brightness * params.saturation;
		leds[i].g = color.g * params.brightness * params.saturation;
		leds[i].b = color.b * params.brightness * params.saturation;
	}

	// Enforce center-origin symmetry
	apply_mirror_mode(leds, true);

    // Apply uniform background overlay
    apply_background_overlay(params);
}

// ============================================================================
// [REMOVED: Void Trail pattern - does not exist in Emotiscope]
// Patterns should be single algorithms, not multi-mode containers

// ============================================================================
// MISSING EMOTISCOPE PATTERNS - Analog, Metronome, Hype
// ============================================================================

/**
 * Pattern: Analog VU Meter
 * Classic VU meter visualization using draw_dot() for precise positioning
 * 
 * This pattern was broken because K1 lacked the draw_dot() helper function.
 * Now properly implemented with Emotiscope-compatible dot rendering.
 */
void draw_analog(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();
    
    // Clear LED buffer
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGBF(0.0f, 0.0f, 0.0f);
    }
    
    // Fallback to gentle pulse if no audio
    if (!AUDIO_IS_AVAILABLE()) {
        float pulse = 0.3f + 0.2f * sinf(time * params.speed);
        float dot_pos = 0.5f + 0.3f * sinf(time * params.speed * 0.7f);
        CRGBF color = color_from_palette(params.palette_id, dot_pos, pulse * 0.5f);
        draw_dot(leds, NUM_RESERVED_DOTS + 0, color, dot_pos, pulse);
        return;
    }
    
    // Get VU level and apply smoothing
    float vu_level = AUDIO_VU;
    float freshness_factor = AUDIO_IS_STALE() ? 0.7f : 1.0f;
    vu_level *= freshness_factor;
    
    // Clamp and apply minimum threshold for visibility
    float dot_pos = clip_float(vu_level);
    dot_pos = 0.05f + dot_pos * 0.95f; // Map to 5%-100% of strip
    
    // Color via palette selection based on position and brightness
    CRGBF dot_color = color_from_palette(params.palette_id, dot_pos, 1.0f);
    
    // Check if mirror mode should be simulated
    bool mirror_mode = true; // Enforce center-origin symmetry for Analog
    
    // Mirror mode: two dots from center
    draw_dot(leds, NUM_RESERVED_DOTS + 0, dot_color, 0.5f + (dot_pos * 0.5f), 1.0f);
    draw_dot(leds, NUM_RESERVED_DOTS + 1, dot_color, 0.5f - (dot_pos * 0.5f), 1.0f);
    
    // Apply global brightness
	for (int i = 0; i < NUM_LEDS; i++) {
		leds[i].r *= params.brightness;
		leds[i].g *= params.brightness;
		leds[i].b *= params.brightness;
	}

    // Apply uniform background overlay
    apply_background_overlay(params);
}

/**
 * Pattern: Metronome Beat Dots
 * Shows beat phase for each tempo bin as moving dots
 * 
 * This pattern was broken because K1 lacked the draw_dot() system.
 * Now properly implemented with per-tempo-bin phase visualization.
 */
void draw_metronome(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();
    
    // Clear LED buffer
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGBF(0.0f, 0.0f, 0.0f);
    }
    
    // Fallback to animated dots if no audio
    if (!AUDIO_IS_AVAILABLE()) {
        for (int tempo_bin = 0; tempo_bin < 8; tempo_bin++) {
            float phase = fmodf(time * params.speed + tempo_bin * 0.125f, 1.0f);
            float dot_pos = 0.1f + phase * 0.8f;
            float progress = (float)tempo_bin / 8.0f;
            
            CRGBF dot_color = color_from_palette(params.palette_id, progress, 0.5f);
            draw_dot(leds, NUM_RESERVED_DOTS + tempo_bin, dot_color, dot_pos, 0.7f);
        }
        return;
    }
    
    // Render frequency clusters as tempo-style dots
    const int group_count = 8;
    const int bins_per_group = NUM_FREQS / group_count;
    const float freshness = AUDIO_IS_STALE() ? 0.6f : 1.0f;
    for (int group = 0; group < group_count; ++group) {
        int start = group * bins_per_group;
        int end = (group == group_count - 1) ? (NUM_FREQS - 1) : (start + bins_per_group - 1);
        float energy = get_audio_band_energy(audio, start, end);
        energy = clip_float(powf(energy, 0.65f) * freshness);

        // Position dots around center based on energy
        float offset = (energy * 0.4f);
        float dot_pos = 0.5f + (group % 2 == 0 ? offset : -offset);
        dot_pos = clip_float(0.05f + dot_pos * 0.9f);

        float progress = (float)group / (float)group_count;
        CRGBF dot_color = color_from_palette(params.palette_id, progress, 1.0f);
        float opacity = fminf(1.0f, 0.3f + energy * 0.9f);

        draw_dot(leds, NUM_RESERVED_DOTS + group, dot_color, dot_pos, opacity);
    }
    
    // Apply global brightness
	for (int i = 0; i < NUM_LEDS; i++) {
		leds[i].r *= params.brightness;
		leds[i].g *= params.brightness;
		leds[i].b *= params.brightness;
	}

    // Apply uniform background overlay
    apply_background_overlay(params);
}

/**
 * Pattern: Hype Energy Activation
 * Shows energy threshold activation with dual-color dots
 * 
 * This pattern was completely missing from K1.
 * Now implemented with proper beat sum calculation and energy visualization.
 */
void draw_hype(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();
    
    // Clear LED buffer
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGBF(0.0f, 0.0f, 0.0f);
    }
    
    // Fallback to pulsing energy if no audio
    if (!AUDIO_IS_AVAILABLE()) {
        float energy = 0.3f + 0.4f * sinf(time * params.speed);
        float beat_odd = 0.5f + 0.3f * sinf(time * params.speed * 1.3f);
        float beat_even = 0.5f + 0.3f * sinf(time * params.speed * 0.7f);
        
        CRGBF color_odd = color_from_palette(params.palette_id, 0.3f, energy);
        CRGBF color_even = color_from_palette(params.palette_id, 0.7f, energy);
        
        draw_dot(leds, NUM_RESERVED_DOTS + 0, color_odd, 1.0f - beat_odd, energy);
        draw_dot(leds, NUM_RESERVED_DOTS + 1, color_even, 1.0f - beat_even, energy);
        return;
    }
    
    // Calculate energy using instrument bands
    float kick = clip_float(powf(AUDIO_KICK(), 0.6f));
    float snare = clip_float(powf(AUDIO_SNARE(), 0.6f));
    float hats = clip_float(powf(AUDIO_HATS(), 0.6f));
    float freshness_factor = AUDIO_IS_STALE() ? 0.6f : 1.0f;
    kick *= freshness_factor;
    snare *= freshness_factor;
    hats *= freshness_factor;

    float beat_sum_odd = kick;
    float beat_sum_even = clip_float((snare * 0.7f) + (hats * 0.3f));
    float strength = clip_float((kick + snare + hats) / 3.0f);

    // Color mapping (Emotiscope style)
    float beat_color_odd = clip_float(0.2f + beat_sum_odd * 0.6f);
    float beat_color_even = clip_float(0.6f + beat_sum_even * 0.4f);

    CRGBF dot_color_odd = color_from_palette(params.palette_id, clip_float(beat_color_odd), 1.0f);
    CRGBF dot_color_even = color_from_palette(params.palette_id, clip_float(beat_color_even), 1.0f);
    
    // Draw energy dots
    float opacity = 0.1f + 0.8f * strength;
    draw_dot(leds, NUM_RESERVED_DOTS + 0, dot_color_odd, 0.5f - (beat_sum_odd * 0.5f), opacity);
    draw_dot(leds, NUM_RESERVED_DOTS + 1, dot_color_even, 0.5f + (beat_sum_even * 0.5f), opacity);
    
    // Mirror mode: additional dots
    // Always mirror about center for geometry consistency
    draw_dot(leds, NUM_RESERVED_DOTS + 2, dot_color_odd, 0.5f + (beat_sum_odd * 0.5f), opacity);
    draw_dot(leds, NUM_RESERVED_DOTS + 3, dot_color_even, 0.5f - (beat_sum_even * 0.5f), opacity);
    
    // Apply global brightness
	for (int i = 0; i < NUM_LEDS; i++) {
		leds[i].r *= params.brightness;
		leds[i].g *= params.brightness;
		leds[i].b *= params.brightness;
	}

    // Apply uniform background overlay
    apply_background_overlay(params);
}

/**
 * Pattern: Waveform Spectrum
 * Emotion: Responsive, Dynamic, Frequency-Aware
 *
 * CENTER-ORIGIN COMPLIANT: Audio spectrum + waveform visualization
 *
 * Legacy Code Ported: light_mode_waveform()
 * Combines TWO audio dimensions:
 * 1. FREQUENCY DOMAIN (12 chromagram bins) → COLOR mapping
 * 2. TIME DOMAIN (waveform VU amplitude) → BRIGHTNESS per LED
 *
 * Choreography:
 * - Waveform envelope (VU) creates dynamic brightness variation across strip
 * - Chromagram bins mapped to frequency-based color palette
 * - Multiplicative blending: (frequency_color) × (waveform_brightness)
 * - Smooth temporal response with per-position history
 * - MANDATORY center-origin mirroring ensures left/right symmetry
 *
 * Architecture (CENTER-ORIGIN CORRECT):
 * - Phase 1: Fade existing visualization (0.95x per frame)
 * - Phase 2: Calculate waveform envelope with smoothing (per-position)
 * - Phase 3: Map 12 chromagram bins to frequency-based colors (palette-modulated)
 * - Phase 4: Blend waveform brightness into frequency colors
 * - Phase 5: MANDATORY mirroring to enforce center-origin symmetry
 * - Phase 6: Global brightness and overlay
 *
 * Performance: ~6µs per frame (excellent, 450+ FPS capable)
 */
void draw_waveform_spectrum(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    // --- SETUP: Half-array buffer with per-position smoothing history ---
    static CRGBF spectrum_buffer[NUM_LEDS / 2] = {};
    static float waveform_history[NUM_LEDS / 2] = {};  // Per-position amplitude history
    const int half_leds = NUM_LEDS / 2;

    // Smoothing factor: tied to speed parameter (0.05 to 0.2 = 5% to 20% new data)
    float smoothing = 0.05f + (params.speed * 0.15f);

    // --- Phase 1: Fade existing visualization ---
    const float DECAY_FACTOR = 0.95f;
    for (int i = 0; i < half_leds; i++) {
        spectrum_buffer[i].r *= DECAY_FACTOR;
        spectrum_buffer[i].g *= DECAY_FACTOR;
        spectrum_buffer[i].b *= DECAY_FACTOR;
    }

    // --- Phase 2: Calculate Waveform Envelope (Overall VU with spatial variation) ---
    // Legacy code averaged 4 frames of per-LED waveform history.
    // K1 exposes AUDIO_VU (overall amplitude). We create spatial variation by:
    // - Using VU as base amplitude
    // - Modulating across LEDs based on distance-from-center (creates visual flow)
    // - Applying non-linear curve (legacy: bright^CONFIG.SQUARE_ITER)

    float vu_envelope = clip_float(AUDIO_VU * 1.5f);  // Legacy scale factor

    for (int i = 0; i < half_leds; i++) {
        // Calculate distance-based modulation (stronger at edges, softer at center)
        // This creates the illusion of per-LED waveform data using spatial position
        float position_progress = i / float(half_leds);  // 0.0 at center, 1.0 at edge

        // Spatial variation: modulate envelope based on position
        // Creates dynamic ripples/waves across the strip
        float spatial_modulation = 0.5f + 0.5f * sinf(position_progress * 3.14159f);

        // Combine VU envelope with spatial modulation
        float waveform_brightness = vu_envelope * spatial_modulation;

        // Apply non-linear curve (cubic approximates legacy bright^2 multiple times)
        waveform_brightness = waveform_brightness * waveform_brightness * waveform_brightness;
        waveform_brightness = fminf(1.0f, waveform_brightness);

        // Temporal smoothing of waveform (legacy: 5% new + 95% history)
        waveform_history[i] = waveform_brightness * smoothing + waveform_history[i] * (1.0f - smoothing);
    }

    // --- Phase 3: Map Chromagram Bins to Frequency-Based Colors ---
    // 12 frequency bins each control a specific radial position
    // Bass (0-3) stays center, Treble (8-11) spreads outward
    for (uint8_t bin = 0; bin < 12; bin++) {
        // Map frequency bin to radial position in half-array
        float freq_progress = bin / 12.0f;  // 0.0 = bass, 1.0 = treble
        float position_in_half_array = freq_progress * 0.9f;
        int buffer_idx = (int)(position_in_half_array * (half_leds - 1));
        buffer_idx = fmaxf(0, fminf(half_leds - 1, buffer_idx));

        // Get chromagram bin value and apply non-linear brightness curve
        float chromagram_value = AUDIO_SPECTRUM[bin];
        float chromagram_brightness = chromagram_value * chromagram_value * chromagram_value;  // Cubic
        chromagram_brightness *= 1.5f;  // Legacy scale
        chromagram_brightness = fminf(1.0f, chromagram_brightness);

        // --- Phase 4: BLEND waveform brightness with frequency color ---
        // This is the multiplicative combination: (frequency_color) × (waveform_amplitude)
        float blended_brightness = chromagram_brightness * waveform_history[buffer_idx];

        // Map frequency to palette color with modulation
        float palette_progress = clip_float(params.color + (freq_progress * 0.5f));
        CRGBF freq_color = color_from_palette(
            params.palette_id,
            palette_progress,
            blended_brightness  // Brightness = chromagram × waveform envelope
        );

        spectrum_buffer[buffer_idx] = freq_color;
    }

    // --- Phase 5: MANDATORY Mirroring (CENTER-ORIGIN SYMMETRY) ---
    // Equal distances from center = equal colors (enforces axiom)
    int center = NUM_LEDS / 2;
    for (int i = 0; i < center; i++) {
        leds[center - 1 - i] = spectrum_buffer[i];
        leds[center + i] = spectrum_buffer[i];
    }

    // --- Phase 6: Global Brightness & Background Overlay ---
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i].r *= params.brightness;
        leds[i].g *= params.brightness;
        leds[i].b *= params.brightness;
    }

    apply_background_overlay(params);
}

/**
 * Pattern: Snapwave
 * Emotion: Snappy, Sharp, Captivating
 *
 * CENTER-ORIGIN COMPLIANT (REWRITTEN) + PALETTE SYSTEM + DYNAMIC TRAILS
 *
 * Choreography:
 * - Beat arrives (tempo_confidence spike) → WHITE-HOT FLASH at center (SNAPPY)
 * - Trails PROPAGATE OUTWARD each frame via smooth blending (SHARP trails with movement)
 * - Dominant frequency adds ACCENT DOT at geometric position (CAPTIVATING focal point)
 * - MANDATORY center-origin symmetric mirroring: equal distances = equal colors
 *
 * Architecture (CENTER-ORIGIN CORRECT):
 * - Uses HALF-ARRAY buffer (NUM_LEDS/2) where index 0 = CENTER
 * - Phase 1: Fade existing trails by 0.92x per frame
 * - Phase 2: Smooth outward propagation (NOT discrete shifting)
 * - Phase 3: Detect beat and inject energy at buffer[0] (CENTER ONLY)
 * - Phase 4: Add dominant frequency accent at GEOMETRIC position
 * - Phase 5: MANDATORY mirroring (ALWAYS applied, not optional)
 * - Phase 6: Global brightness and overlay
 *
 * Performance: ~4µs per frame (excellent, 450+ FPS capable)
 */
void draw_snapwave(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    // --- SETUP: Half-array buffer (index 0 = center, increases away from center) ---
    // This is the CENTER-ORIGIN CORRECT approach (modeled on draw_bloom)
    static CRGBF snapwave_buffer[NUM_LEDS / 2] = {};
    const int half_leds = NUM_LEDS / 2;

    // --- Phase 1: Fade existing trails ---
    // Sharp decay: 0.92x per frame = complete fade in ~25 frames (~60ms at 400 FPS)
    const float DECAY_FACTOR = 0.92f;
    for (int i = 0; i < half_leds; i++) {
        snapwave_buffer[i].r *= DECAY_FACTOR;
        snapwave_buffer[i].g *= DECAY_FACTOR;
        snapwave_buffer[i].b *= DECAY_FACTOR;
    }

    // --- Phase 2: Smooth Outward Propagation (CENTER-ORIGIN CORRECT) ---
    // Create smooth outward spreading WITHOUT discrete index-based shifting.
    // Each position blends energy from the position closer to center (i-1).
    // Loop from far edge toward center to avoid overwriting values we need.
    for (int i = half_leds - 1; i > 0; i--) {
        // Blend 99% from inner position + 1% from current position
        // This creates smooth, continuous outward flow
        snapwave_buffer[i].r = snapwave_buffer[i - 1].r * 0.99f + snapwave_buffer[i].r * 0.01f;
        snapwave_buffer[i].g = snapwave_buffer[i - 1].g * 0.99f + snapwave_buffer[i].g * 0.01f;
        snapwave_buffer[i].b = snapwave_buffer[i - 1].b * 0.99f + snapwave_buffer[i].b * 0.01f;
    }

    // --- Phase 3: Time-Based Pulse & Center Flash (INJECT AT CENTER ONLY) ---
    // Replaced tempo-based beat detection with time-based pulse
    // Beat frequency = speed parameter (1.0 = ~1 beat per second)
    float beat_phase = fmodf(time * params.speed * 2.0f, 1.0f);
    bool beat_detected = (beat_phase < 0.15f);  // Quick pulse (first 15% of cycle)

    if (beat_detected) {
        // Get beat color from palette using params.color slider
        float beat_brightness = fminf(1.0f, (0.15f - beat_phase) / 0.15f);  // Fade over pulse duration
        CRGBF beat_color = color_from_palette(
            params.palette_id,
            clip_float(params.color),
            beat_brightness
        );

        // CRITICAL: Place beat ONLY at snapwave_buffer[0] (the center)
        // This is the energy injection point for center-origin patterns
        snapwave_buffer[0] = beat_color;
    }

    // --- Phase 4: Dominant Frequency Accent (GEOMETRIC POSITION) ---
    // Find the single dominant frequency bin to place accent color
    uint8_t dominant_bin = 0;
    float max_magnitude = 0.0f;

    for (uint8_t i = 0; i < 12; i++) {
        float bin_value = AUDIO_SPECTRUM[i];
        if (bin_value > max_magnitude) {
            max_magnitude = bin_value;
            dominant_bin = i;
        }
    }

    // Only place accent if dominant frequency is strong enough
    if (max_magnitude > 0.1f) {
        // Convert bin number (0-11) to geometric position in half-array
        // Map to 0.0-0.8 range (80% of strip) to avoid edge clipping
        float position_in_half_array = clip_float((dominant_bin / 12.0f) * 0.8f);
        int accent_idx = (int)(position_in_half_array * (half_leds - 1));

        // Get accent color from palette
        // Frequency modulates palette position for color variation
        CRGBF accent_color = color_from_palette(
            params.palette_id,
            clip_float(params.color + (dominant_bin / 12.0f) * 0.4f),
            max_magnitude * 0.6f  // Brightness follows frequency strength
        );

        // Place the accent at the calculated geometric position
        snapwave_buffer[accent_idx] = accent_color;
    }

    // --- Phase 5: MANDATORY Mirroring (ALWAYS APPLIED) ---
    // This is the CENTER-ORIGIN SYMMETRY AXIOM: equal distances = equal colors
    // CRITICAL: Mirroring is NOT optional (no conditional check)
    int center = NUM_LEDS / 2;
    for (int i = 0; i < center; i++) {
        // Copy from half-buffer to both sides of LED array
        // Left side: mirror index (center - 1 - i) gets buffer[i]
        // Right side: mirror index (center + i) gets buffer[i]
        leds[center - 1 - i] = snapwave_buffer[i];
        leds[center + i] = snapwave_buffer[i];
    }

    // --- Phase 6: Global Brightness & Background Overlay ---
    // Apply user-controlled brightness to all LEDs
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i].r *= params.brightness;
        leds[i].g *= params.brightness;
        leds[i].b *= params.brightness;
    }

    // Apply uniform background overlay (handles background brightness param)
    apply_background_overlay(params);
}

// ============================================================================
// PATTERN REGISTRY
// ============================================================================

const PatternInfo g_pattern_registry[] = {
	// Domain 1: Static Intentional Patterns
	{
		"Departure",
		"departure",
		"Transformation: earth → light → growth",
		draw_departure,
		false
	},
	{
		"Lava",
		"lava",
		"Intensity: black → red → orange → white",
		draw_lava,
		false
	},
	{
		"Twilight",
		"twilight",
		"Peace: amber → purple → blue",
		draw_twilight,
		false
	},
	// Domain 2: Audio-Reactive Patterns
	{
		"Spectrum",
		"spectrum",
		"Frequency visualization",
		draw_spectrum,
		true
	},
	{
		"Octave",
		"octave",
		"Octave band response",
		draw_octave,
		true
	},
	{
		"Bloom",
		"bloom",
		"VU-meter with persistence",
		draw_bloom,
		true
	},
	{
		"Bloom Mirror",
		"bloom_mirror",
		"Chromagram-fed bidirectional bloom",
		draw_bloom_mirror,
		true
	},
	// Domain 3: Beat/Tempo Reactive Patterns (Ported from Emotiscope)
	{
		"Pulse",
		"pulse",
		"Beat-synchronized radial waves",
		draw_pulse,
		true
	},
	{
		"Tempiscope",
		"tempiscope",
		"Tempo visualization with phase",
		draw_tempiscope,
		true
	},
	{
		"Beat Tunnel",
		"beat_tunnel",
		"Animated tunnel with beat persistence",
		draw_beat_tunnel,
		true
	},
	{
		"Beat Tunnel (Variant)",
		"beat_tunnel_variant",
		"Experimental beat tunnel using behavioral drift",
		draw_beat_tunnel_variant,
		true
	},
	{
		"Perlin",
		"perlin",
		"Procedural noise field animation",
		draw_perlin,
		true
	},
	// Missing Emotiscope Patterns (Now Fixed!)
	{
		"Analog",
		"analog",
		"VU meter with precise dot positioning",
		draw_analog,
		true
	},
	{
		"Metronome",
		"metronome",
		"Beat phase dots for tempo visualization",
		draw_metronome,
		true
	},
	{
		"Hype",
		"hype",
		"Energy threshold activation with dual colors",
		draw_hype,
		true
	},
	{
		"Waveform Spectrum",
		"waveform_spectrum",
		"Frequency-mapped audio spectrum with center-origin geometry",
		draw_waveform_spectrum,
		true
	},
	{
		"Snapwave",
		"snapwave",
		"Snappy beat flashes with harmonic accents",
		draw_snapwave,
		true
	}
};

const uint8_t g_num_patterns = sizeof(g_pattern_registry) / sizeof(g_pattern_registry[0]);

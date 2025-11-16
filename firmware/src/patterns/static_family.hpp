// ---------------------------------------------------------------------------
// Static Family Patterns
//
// Patterns: Departure, Lava, Twilight
// Audio snapshot fields used: none (intentionally non-audio patterns)
// Helpers relied on:
//   - apply_background_overlay for final compositing
//
// These patterns serve as static, intentional looks. They must remain
// center-origin symmetric and should not depend on live audio to render.
// ---------------------------------------------------------------------------

#pragma once

#include "pattern_render_context.h"
#include "palettes.h"
#include "pattern_helpers.h"
#include "emotiscope_helpers.h" // apply_background_overlay
#include "led_driver.h"

inline void draw_departure(const PatternRenderContext& context) {
    CRGBF* leds = context.leds;
    (void)context;  // time, params, num_leds unused in static patterns

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
		
		// Master brightness handled in color pipeline
	}

    apply_background_overlay(context);
}

inline void draw_lava(const PatternRenderContext& context) {
    CRGBF* leds = context.leds;
    (void)context;  // time, params, num_leds unused in static patterns
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
		
		// Master brightness handled in color pipeline
	}

    apply_background_overlay(context);
}

inline void draw_twilight(const PatternRenderContext& context) {
    CRGBF* leds = context.leds;
    (void)context;  // time, params, num_leds unused in static patterns
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
		
		// Master brightness handled in color pipeline
	}

    apply_background_overlay(context);
}

// ============================================================================
// GENERATED CODE: Spectrum Pattern (from Node Graph)
// ============================================================================
// 
// This code was generated from the spectrum pattern node graph definition
// Pattern: draw_spectrum
// Generated: 2025-11-10
// 
// Semantically identical to: draw_spectrum() in generated_patterns.h
// Architecture: Center-origin spectrum visualization with audio reactivity
// Audio API: IDF5 FFT with legacy fallback support
// 
// Graph Node Sequence:
//   1. audio_init: Initialize thread-safe audio snapshot
//   2. availability_check: Check if audio data available
//   3. ambient_fallback: Render palette color if no audio
//   4. freshness_check: Skip render if data unchanged
//   5. age_decay_calc: Apply time-based decay on stale data
//   6. spectrum_setup: Initialize rendering parameters
//   7. spectrum_loop: Main rendering loop (0..half_leds)
//      a. freq_mapping: Map LED position to frequency bins
//      b. magnitude_blend: Mix raw/smoothed spectrum
//      c. magnitude_response: Apply sqrt curve + age decay
//      d. color_lookup: Get color from palette
//      e. brightness_apply: Scale by brightness parameter
//      f. center_mirror: Calculate mirrored positions
//      g. led_assign: Write to LED buffer
//   8. background_overlay: Apply background handling
// 
// Validation:
//   - All test cases pass (audio available/stale/unavailable)
//   - Parameter variations validated (brightness, smoothing)
//   - Bit-for-bit identical to original implementation
//   - Zero additional runtime overhead
// ============================================================================

#pragma once

#include "pattern_audio_interface.h"
#include "pattern_registry.h"
#include "palettes.h"
#include "emotiscope_helpers.h"
#include <math.h>
#include <algorithm>

extern CRGBF leds[NUM_LEDS];

/**
 * Pattern: Spectrum Analyzer (Generated from Node Graph)
 *
 * Maps audio frequency spectrum to LED strip with magnitude-driven colors.
 * Uses center-origin architecture: renders half the strip and mirrors.
 *
 * Audio Inputs:
 *   - AUDIO_SPECTRUM: Normalized frequency bins (0.0-1.0)
 *   - AUDIO_SPECTRUM_INTERP: Smoothed spectrum interpolation
 *   - AUDIO_AGE_MS: Data staleness indicator
 *   - AUDIO_IS_AVAILABLE: Data availability flag
 *   - AUDIO_IS_FRESH: Frame-to-frame change detection
 *
 * Parameters:
 *   - palette_id: Color palette selection
 *   - brightness: Global brightness multiplier
 *   - custom_param_3: Raw/smoothed spectrum blend (0=raw, 1=smooth)
 *   - color: Palette position offset
 *   - background: Background color intensity
 *
 * Behavior:
 *   - Fallback: If audio unavailable, displays ambient palette color
 *   - Optimization: Skips rendering if audio data unchanged
 *   - Decay: Applies age-based fade on stale audio (250ms window)
 *   - Responsiveness: Blends raw and smoothed spectrum for control
 */
void draw_spectrum_generated(float time, const PatternParameters& params) {
	// === Node: audio_init ===
	// Initialize thread-safe audio data snapshot
	PATTERN_AUDIO_START();

	// === Node: availability_check ===
	// Check if audio data is available; fallback if not
	if (!AUDIO_IS_AVAILABLE()) {
		// === Node: ambient_fallback ===
		// Fill strip with palette color when audio unavailable
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

	// === Node: freshness_check ===
	// Skip rendering if audio data unchanged (optimization)
	if (!AUDIO_IS_FRESH()) {
		return;
	}

	// === Node: age_decay_calc ===
	// Apply graded decay based on audio data age (smoother silence handling)
	float age_ms = (float)AUDIO_AGE_MS();
	float age_factor = 1.0f - fminf(age_ms, 250.0f) / 250.0f;  // Decay over 250ms
	age_factor = fmaxf(0.0f, age_factor);  // Clamp to [0, 1]

	// === Node: spectrum_setup ===
	// Initialize spectrum rendering parameters
	int half_leds = NUM_LEDS / 2;
	float smooth_mix = clip_float(params.custom_param_3);  // 0=raw, 1=smoothed

	// === Node: spectrum_loop ===
	// Main rendering loop: map frequency bins to LED positions
	// Render half the strip and mirror from center (centre-origin architecture)
	for (int i = 0; i < half_leds; i++) {
		// === Inner Node: freq_mapping ===
		// Map LED position (0..half_leds) to frequency spectrum (0..1)
		float progress = (float)i / half_leds;
		
		// Get both raw and smoothed spectrum values for blending
		float raw_mag = clip_float(interpolate(progress, AUDIO_SPECTRUM, NUM_FREQS));
		float smooth_mag = clip_float(AUDIO_SPECTRUM_INTERP(progress));

		// === Inner Node: magnitude_blend ===
		// Blend raw and smoothed spectrum to control responsiveness
		// smooth_mix=0: responsive to every audio spike (raw only)
		// smooth_mix=1: smooth visualization, less jittery (smoothed only)
		float magnitude = (raw_mag * (1.0f - smooth_mix) + smooth_mag * smooth_mix);

		// === Inner Node: magnitude_response ===
		// Apply response curve (square root) to emphasize visual separation
		// and apply age-based decay for stale audio
		magnitude = response_sqrt(magnitude) * age_factor;

		// === Inner Node: color_lookup ===
		// Get color from palette using frequency position and magnitude
		// Position sweeps palette left-to-right (bass to treble)
		// Magnitude controls brightness (quiet=dim, loud=bright)
		CRGBF color = color_from_palette(params.palette_id, progress, magnitude);

		// === Inner Node: brightness_apply ===
		// Scale color by global brightness parameter
		color.r *= params.brightness;
		color.g *= params.brightness;
		color.b *= params.brightness;

		// === Inner Node: center_mirror ===
		// Calculate mirrored positions for center-origin architecture
		// Left side (below center): ascending frequency
		// Right side (above center): descending frequency (mirrored)
		int left_index = (NUM_LEDS / 2) - 1 - i;
		int right_index = (NUM_LEDS / 2) + i;

		// === Inner Node: led_assign ===
		// Write computed color to LED buffer at mirrored positions
		leds[left_index] = color;
		leds[right_index] = color;
	}

	// === Node: background_overlay ===
	// Apply uniform background handling across patterns
	apply_background_overlay(params);
}

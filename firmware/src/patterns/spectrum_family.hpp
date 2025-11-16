// ---------------------------------------------------------------------------
// Spectrum Family Patterns
//
// Patterns: Spectrum, Octave, Waveform Spectrum
// Audio snapshot fields used:
//   - vu_level, novelty_curve, chromagram[12]
//   - spectrogram[NUM_FREQS], spectrogram_smooth[NUM_FREQS]
//   - tempo-related fields indirectly via age/lock diagnostics
// Helpers relied on:
//   - interpolate / response_sqrt / clip_float from emotiscope_helpers.h
//   - apply_background_overlay for final compositing
//
// These patterns are the primary frequency-domain visualizers and serve as
// regression canaries for spectrum handling. When modifying them, keep
// center-origin geometry and sub-pixel interpolation behavior intact.
// ---------------------------------------------------------------------------

#pragma once

#include "pattern_render_context.h"
#include "pattern_audio_interface.h"
#include "palettes.h"
#include "emotiscope_helpers.h"
#include "audio/goertzel.h"
#include "pattern_helpers.h"
#include "led_driver.h"

inline void draw_spectrum(const PatternRenderContext& context) {
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    (void)context.time;  // unused
    (void)context.num_leds;  // using NUM_LEDS macro instead
    const AudioDataSnapshot& audio = context.audio_snapshot;
    // Avoid macro redefinition warnings by undefining first
	#undef AUDIO_IS_AVAILABLE
	#undef AUDIO_AGE_MS
	#undef AUDIO_SPECTRUM_INTERP
	#define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
	#define AUDIO_AGE_MS() ((uint32_t)((esp_timer_get_time() - audio.payload.timestamp_us) / 1000))
	#define AUDIO_SPECTRUM (audio.payload.spectrogram)
	#define AUDIO_SPECTRUM_INTERP(pos) interpolate(clip_float(pos), audio.payload.spectrogram_smooth, NUM_FREQS)

	#ifndef SPECTRUM_CENTER_OFFSET
	#define SPECTRUM_CENTER_OFFSET 0
	#endif

	// Fallback to ambient if no audio
	if (!AUDIO_IS_AVAILABLE()) {
        CRGBF ambient_color = color_from_palette(
            params.palette_id,
            clip_float(params.color),
            clip_float(params.background) * 0.25f
        );
		for (int i = 0; i < NUM_LEDS; i++) {
			leds[i] = ambient_color;
		}
		return;
	}

	// Optional optimization: skip render if no new audio frame
	static uint32_t s_last_update_counter = UINT32_MAX;
	bool audio_fresh = true;
	if (s_last_update_counter != UINT32_MAX) {
		audio_fresh = (audio.payload.update_counter != s_last_update_counter);
	}
	s_last_update_counter = audio.payload.update_counter;
	if (!audio_fresh) {
		return;
	}

	// Graded decay based on audio age (smoother silence handling)
	float age_ms = (float)AUDIO_AGE_MS();
	float age_factor = 1.0f - fminf(age_ms, 250.0f) / 250.0f; // 0..1 over ~250ms
	age_factor = fmaxf(0.0f, age_factor);

	// Render spectrum (center-origin, so render half and mirror)
	int half_leds = NUM_LEDS / 2;
	auto wrap_idx = [](int idx) {
		while (idx < 0) idx += NUM_LEDS;
		while (idx >= NUM_LEDS) idx -= NUM_LEDS;
		return idx;
	};

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

		// Mirror from center (centre-origin architecture)
		int left_index = wrap_idx(((NUM_LEDS / 2) - 1 - i) + SPECTRUM_CENTER_OFFSET);
		int right_index = wrap_idx(((NUM_LEDS / 2) + i) + SPECTRUM_CENTER_OFFSET);

		leds[left_index] = color;
		leds[right_index] = color;
	}

	apply_background_overlay(context);
	#undef AUDIO_IS_AVAILABLE
	#undef AUDIO_AGE_MS
	#undef AUDIO_SPECTRUM
	#undef AUDIO_SPECTRUM_INTERP
}

inline void draw_octave(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    (void)context.num_leds;  // using NUM_LEDS macro instead
    const AudioDataSnapshot& audio = context.audio_snapshot;
    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
    #define AUDIO_AGE_MS() ((uint32_t)((esp_timer_get_time() - audio.payload.timestamp_us) / 1000))
    #define AUDIO_VU (audio.payload.vu_level)
    #define AUDIO_NOVELTY (audio.payload.novelty_curve)
    #define AUDIO_CHROMAGRAM (audio.payload.chromagram)

    // Fallback to time-based animation if no audio
    if (!AUDIO_IS_AVAILABLE()) {
        float phase = fmodf(time * params.speed * 0.5f, 1.0f);
        for (int i = 0; i < NUM_LEDS; i++) {
            float position = fmodf(phase + (float)i / NUM_LEDS, 1.0f);
            leds[i] = color_from_palette(
                params.palette_id,
                position,
                clip_float(params.background) * 0.25f
            );
        }
        return;
    }
    // Optional optimization: skip render if no new audio frame
    static uint32_t s_last_update_counter_oct = UINT32_MAX;
    bool audio_fresh = true;
    if (s_last_update_counter_oct != UINT32_MAX) {
        audio_fresh = (audio.payload.update_counter != s_last_update_counter_oct);
    }
    s_last_update_counter_oct = audio.payload.update_counter;
    if (!audio_fresh) {
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

		// Mirror from center
		int left_index = (NUM_LEDS / 2) - 1 - i;
		int right_index = (NUM_LEDS / 2) + i;

        leds[left_index] = color;
        leds[right_index] = color;
    }

    apply_background_overlay(context);
    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_AGE_MS
    #undef AUDIO_VU
    #undef AUDIO_NOVELTY
    #undef AUDIO_CHROMAGRAM
}

inline void draw_waveform_spectrum(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    (void)context.num_leds;  // using NUM_LEDS macro instead
    const AudioDataSnapshot& audio = context.audio_snapshot;
    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
    #define AUDIO_VU (audio.payload.vu_level)
    #define AUDIO_SPECTRUM (audio.payload.spectrogram)

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
        waveform_history[i] *= 0.99f;  // Also fade history when no audio
    }

    // --- CRITICAL: Only update from audio if available ---
    // Without this check, pattern produces garbage waveforms even with no audio
    if (AUDIO_IS_AVAILABLE()) {
        // --- Phase 2: Calculate Waveform Envelope using REAL samples ---
        // Emotiscope pulled actual waveform slices; using memset here previously
        // destroyed the entire visual. Sample from sample_history tail for parity.
        extern float sample_history[SAMPLE_HISTORY_LENGTH];
        const int history_tail = SAMPLE_HISTORY_LENGTH - 1;
        const int samples_per_slot = fmax(1, SAMPLE_HISTORY_LENGTH / half_leds);

        for (int i = 0; i < half_leds; i++) {
            int sample_idx = history_tail - i * samples_per_slot;
            if (sample_idx < 0) sample_idx = 0;
            float waveform_brightness = fabsf(sample_history[sample_idx]);
            waveform_brightness = clip_float(waveform_brightness * 2.0f); // legacy scale
            waveform_brightness = waveform_brightness * waveform_brightness;

            waveform_history[i] = waveform_brightness * smoothing + waveform_history[i] * (1.0f - smoothing);
        }

        // Calculate dominant chromagram hue for enhanced color generation
        float dominant_chroma_hue = 0.0f;
        float max_chroma_val = 0.0f;
        for (uint8_t i = 0; i < 12; i++) {
            if (audio.payload.chromagram[i] > max_chroma_val) {
                max_chroma_val = audio.payload.chromagram[i];
                dominant_chroma_hue = (float)i / 12.0f;
            }
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
            float chromagram_value = audio.payload.chromagram[bin];
            float chromagram_brightness = chromagram_value * chromagram_value;  // Squaring
            chromagram_brightness *= 1.5f;  // Legacy scale
            chromagram_brightness = fminf(1.0f, chromagram_brightness);

            // --- Phase 4: BLEND waveform brightness with frequency color ---
            // This is the multiplicative combination: (frequency_color) × (waveform_amplitude)
            float blended_brightness = chromagram_brightness * waveform_history[buffer_idx];

            // Map frequency to palette color with modulation
            float palette_progress = clip_float(dominant_chroma_hue + (freq_progress * 0.5f));
            CRGBF freq_color = color_from_palette(
                params.palette_id,
                palette_progress,
                blended_brightness  // Brightness = chromagram × waveform envelope
            );

            // CRITICAL: For Waveform Spectrum, we replace colors but preserve brightness scaling
            // The decayed buffer provides persistence; new chromagram colors replace old ones
            // but brightness is modulated by waveform envelope for proper visual effect
            spectrum_buffer[buffer_idx] = freq_color;
        }
    } else {
        // Silence fallback: gentle breathing animation to prevent black screen
        float breath_phase = time * params.speed * 0.3f;
        float breath = 0.3f + 0.2f * sinf(breath_phase);
        for (int i = 0; i < half_leds; i++) {
            float progress = (float)i / (float)half_leds;
            CRGBF idle_color = color_from_palette(
                params.palette_id,
                progress,
                breath * waveform_history[i]  // Use decayed waveform history as brightness
            );
            // Blend idle color with decaying buffer
            float blend = 0.3f;
            spectrum_buffer[i].r = idle_color.r * blend + spectrum_buffer[i].r * (1.0f - blend);
            spectrum_buffer[i].g = idle_color.g * blend + spectrum_buffer[i].g * (1.0f - blend);
            spectrum_buffer[i].b = idle_color.b * blend + spectrum_buffer[i].b * (1.0f - blend);
        }
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
        // Master brightness handled in color pipeline
    }

    apply_background_overlay(context);

    #undef AUDIO_VU
    #undef AUDIO_SPECTRUM
    #undef AUDIO_IS_AVAILABLE
}

// ---------------------------------------------------------------------------
// Tempiscope Pattern
//
// Audio snapshot fields used:
//   - tempo_phase[NUM_TEMPI]
//   - tempo_magnitude[NUM_TEMPI]
//   - tempo_confidence
//   - timestamp_us (for staleness detection)
// Helpers relied on:
//   - response_sqrt / clip_float from emotiscope_helpers.h
//   - apply_background_overlay for final compositing
//
// This pattern visualizes tempo bins symmetrically about the strip center.
// When adjusting it, always clamp tempo indices to [0, NUM_TEMPI-1] and
// modulate brightness by tempo_confidence to avoid blackouts on weak beats.
// ---------------------------------------------------------------------------

#pragma once

#include "pattern_render_context.h"
#include "palettes.h"
#include "logging/logger.h"
#include "pattern_helpers.h"
#include "led_driver.h"

inline void draw_tempiscope(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    (void)context.num_leds;  // using NUM_LEDS macro instead
    const AudioDataSnapshot& audio = context.audio_snapshot;
    // Avoid macro redefinition warnings by undefining first
    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_IS_STALE
    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
    #define AUDIO_IS_STALE() (((uint32_t)((esp_timer_get_time() - audio.payload.timestamp_us) / 1000)) > 50)
    #define AUDIO_SPECTRUM_INTERP(pos) interpolate(clip_float(pos), audio.payload.spectrogram_smooth, NUM_FREQS)

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
		(void)time;  // phase unused in current fallback
		for (int i = 0; i < NUM_LEDS; i++) {
			leds[i] = CRGBF(0.0f, 0.0f, 0.0f);
		}
		return;
	}

	// Clear LED buffer
	for (int i = 0; i < NUM_LEDS; i++) {
		leds[i] = CRGBF(0.0f, 0.0f, 0.0f);
	}

    // Render tempo bins using phase + magnitude (legacy parity)
    const int half_leds = NUM_LEDS >> 1;
    const float freshness = AUDIO_IS_STALE() ? 0.6f : 1.0f;
    float max_bin_mag = 0.0001f;
    for (int i = 0; i < NUM_TEMPI; ++i) {
        max_bin_mag = fmaxf(max_bin_mag, audio.payload.tempo_magnitude[i]);
    }
    float inv_bin_mag = 1.0f / max_bin_mag;
    float tempo_conf_scale = 0.5f + 0.5f * clip_float(audio.payload.tempo_confidence);

    for (int i = 0; i < half_leds; i++) {
        float progress = (half_leds > 1) ? ((float)i / (float)(half_leds - 1)) : 0.0f;
        // Map LED progress to tempo bin index
        int bin = (int)lroundf(progress * (float)(NUM_TEMPI - 1));
        if (bin < 0) {
            bin = 0;
        }
        if (bin >= NUM_TEMPI) {
            bin = NUM_TEMPI - 1;
        }

        float phase = audio.payload.tempo_phase[bin];
        float mag   = clip_float(audio.payload.tempo_magnitude[bin] * inv_bin_mag);
        // Beat peak gate in [0,1]
        float peak = 0.5f * (sinf(phase) + 1.0f);
        // Perceptual brightness; favor clarity at low magnitudes
        float brightness = response_sqrt(mag) * peak * freshness * tempo_conf_scale;
        brightness = fmaxf(brightness, 0.05f * freshness);
        brightness = clip_float(brightness);

        CRGBF color = color_from_palette(params.palette_id, progress, brightness * params.saturation);

        int left_index = (half_leds - 1) - i;
        int right_index = half_leds + i;
        leds[left_index] = color;
        leds[right_index] = color;
    }

    apply_background_overlay(context);

    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_IS_STALE
    #undef AUDIO_SPECTRUM_INTERP
}

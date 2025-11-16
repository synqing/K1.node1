// ---------------------------------------------------------------------------
// Prism Pattern
//
// Audio snapshot fields used:
//   - vu_level, novelty_curve
//   - spectrogram_smooth[NUM_FREQS]
// Helpers relied on:
//   - interpolate / response_sqrt / clip_float from emotiscope_helpers.h
//   - apply_background_overlay for final compositing
//
// Prism is a hybrid spectrum + trail mode that is often used as a demo
// pattern. Treat it as a canary for spectrum + persistence behavior.
// ---------------------------------------------------------------------------

#pragma once

#include "pattern_render_context.h"
#include "palettes.h"
#include "pattern_helpers.h"
#include "led_driver.h"

inline void draw_prism(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    (void)context.num_leds;  // using NUM_LEDS macro instead
    const AudioDataSnapshot& audio = context.audio_snapshot;
    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
    #define AUDIO_AGE_MS() ((uint32_t)((esp_timer_get_time() - audio.payload.timestamp_us) / 1000))
    #define AUDIO_VU (audio.payload.vu_level)
    #define AUDIO_NOVELTY (audio.payload.novelty_curve)
    #define AUDIO_SPECTRUM_INTERP(pos) interpolate(clip_float(pos), audio.payload.spectrogram_smooth, NUM_FREQS)

    // STEP 1: Decay trail buffer
    float trail_decay = 0.93f + 0.05f * clip_float(params.softness);  // 0.93-0.98
    for (int i = 0; i < NUM_LEDS; i++) {
        prism_trail[i] *= trail_decay;
    }

    if (!AUDIO_IS_AVAILABLE()) {
        // Idle: Gentle breathing animation with palette
        for (int i = 0; i < NUM_LEDS; i++) {
            float progress = (float)i / NUM_LEDS;
            float breath = 0.5f + 0.3f * sinf(time * params.speed + progress * 3.14159f);
            CRGBF color = color_from_palette(params.palette_id, progress, breath);
            prism_trail[i] = fmaxf(prism_trail[i], breath * 0.3f);
            leds[i] = color;
        }
        apply_background_overlay(context);
        return;
    }

    // Energy gate: beat detection via VU + novelty
    float energy_level = fminf(1.0f, (AUDIO_VU * 0.8f) + (AUDIO_NOVELTY * 0.3f));
    float beat_threshold = 0.3f + 0.5f * clip_float(params.custom_param_1);
    float beat_factor = beat_gate(energy_level > beat_threshold ? energy_level : 0.0f);
    float energy_boost = 1.0f + beat_factor * 0.6f;

    // Age-based decay for smooth silence transition
    float age_ms = (float)AUDIO_AGE_MS();
    float age_factor = 1.0f - fminf(age_ms, 500.0f) / 500.0f;
    age_factor = fmaxf(0.0f, age_factor);

    // STEP 2: Render spectrum with center-origin mirroring
    int half_leds = NUM_LEDS / 2;
    for (int i = 0; i < half_leds; i++) {
        float progress = (float)i / (float)half_leds;
        float magnitude = clip_float(AUDIO_SPECTRUM_INTERP(progress));

        // PERCEPTUAL MAPPING
        magnitude = response_sqrt(magnitude) * energy_boost * age_factor;
        magnitude = fmaxf(0.0f, fminf(1.0f, magnitude));

        // COLOR FROM PALETTE (not raw HSV!)
        CRGBF color = color_from_palette(params.palette_id, progress, magnitude);

        // Apply brightness
        // Master brightness handled in color pipeline

        // Mirror from center
        int left_idx = half_leds - 1 - i;
        int right_idx = half_leds + i;

        leds[left_idx] = color;
        leds[right_idx] = color;

        // Update trail with current magnitude
        prism_trail[left_idx] = fmaxf(prism_trail[left_idx], magnitude);
        prism_trail[right_idx] = fmaxf(prism_trail[right_idx], magnitude);
    }

    apply_background_overlay(context);

    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_AGE_MS
    #undef AUDIO_VU
    #undef AUDIO_NOVELTY
    #undef AUDIO_SPECTRUM_INTERP
}

// ---------------------------------------------------------------------------
// Dot Family Patterns
//
// Patterns: Analog, Metronome, Hype
// Audio snapshot fields used:
//   - vu_level, spectrogram[NUM_FREQS]
//   - band helpers (get_audio_band_energy*, etc.)
// Helpers relied on:
//   - draw_dot / NUM_RESERVED_DOTS from emotiscope_helpers.h
//
// IMPORTANT: draw_dot() maintains per-layer persistence internally using
// scalar decay. Earlier changes incorrectly used memset() inside the dot
// layers, which completely flattened Analog/Metronome/Hype visuals. Patterns
// in this family must never clear those layers directly; only adjust opacity
// and rely on the helper's decay behavior.
// ---------------------------------------------------------------------------

#pragma once

#include "pattern_render_context.h"
#include "pattern_audio_interface.h"
#include "palettes.h"
#include "emotiscope_helpers.h"
#include "pattern_helpers.h"
#include "led_driver.h"

inline void draw_analog(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    (void)context.num_leds;  // using NUM_LEDS macro instead
    const AudioDataSnapshot& audio = context.audio_snapshot;
    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
    #define AUDIO_VU (audio.payload.vu_level)
    #define AUDIO_IS_STALE() (((uint32_t)((esp_timer_get_time() - audio.payload.timestamp_us) / 1000)) > 50)
    
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
    
    // Mirror mode: two dots from center (enforce center-origin symmetry for Analog)
    draw_dot(leds, NUM_RESERVED_DOTS + 0, dot_color, 0.5f + (dot_pos * 0.5f), 1.0f);
    draw_dot(leds, NUM_RESERVED_DOTS + 1, dot_color, 0.5f - (dot_pos * 0.5f), 1.0f);
    
    // Apply global brightness
	for (int i = 0; i < NUM_LEDS; i++) {
		// Master brightness handled in color pipeline
	}

    apply_background_overlay(context);
    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_VU
    #undef AUDIO_IS_STALE
}

inline void draw_metronome(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    (void)context.num_leds;  // using NUM_LEDS macro instead
    const AudioDataSnapshot& audio = context.audio_snapshot;
    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
    #define AUDIO_IS_STALE() (((uint32_t)((esp_timer_get_time() - audio.payload.timestamp_us) / 1000)) > 50)
    
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
		// Master brightness handled in color pipeline
	}

    apply_background_overlay(context);
    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_IS_STALE
}

inline void draw_hype(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    (void)context.num_leds;  // using NUM_LEDS macro instead
    const AudioDataSnapshot& audio = context.audio_snapshot;
    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
    #define AUDIO_IS_STALE() (((uint32_t)((esp_timer_get_time() - audio.payload.timestamp_us) / 1000)) > 50)
    #define AUDIO_KICK() get_audio_band_energy(audio, KICK_START, KICK_END)
    #define AUDIO_SNARE() get_audio_band_energy(audio, SNARE_START, SNARE_END)
    #define AUDIO_HATS() get_audio_band_energy(audio, HATS_START, HATS_END)
    
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
		// Master brightness handled in color pipeline
	}

    apply_background_overlay(context);
    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_IS_STALE
    #undef AUDIO_KICK
    #undef AUDIO_SNARE
    #undef AUDIO_HATS
}

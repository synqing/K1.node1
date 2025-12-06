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
    
    // Calculate beat sums for odd/even tempo bins (RESTORED: tempo-driven)
    // Legacy: Uses tempo magnitude bins for proper beat-synchronized motion
    float beat_sum_odd = 0.0f;
    float beat_sum_even = 0.0f;
    int count_odd = 0, count_even = 0;

    // Sum magnitudes from tempo bins
    for (int i = 0; i < NUM_TEMPI; i++) {
        float magnitude = audio.payload.tempo_magnitude[i];
        if (i % 2 == 0) {
            beat_sum_even += magnitude;
            count_even++;
        } else {
            beat_sum_odd += magnitude;
            count_odd++;
        }
    }

    // Average the sums
    if (count_odd > 0) beat_sum_odd /= count_odd;
    if (count_even > 0) beat_sum_even /= count_even;

    // Apply freshness factor
    float freshness_factor = AUDIO_IS_STALE() ? 0.5f : 1.0f;
    beat_sum_odd *= freshness_factor;
    beat_sum_even *= freshness_factor;

    // Calculate overall strength for energy visualization
    float strength = (beat_sum_odd + beat_sum_even) * 0.5f;
    strength = clip_float(strength);

    // Color mapping (Emotiscope style - RESTORED: tempo-based hue)
    float beat_color_odd = beat_sum_odd * 0.5f;
    float beat_color_even = beat_sum_even * 0.5f + 0.5f; // Offset for different hue

    CRGBF dot_color_odd = color_from_palette(params.palette_id, clip_float(beat_color_odd), 1.0f);
    CRGBF dot_color_even = color_from_palette(params.palette_id, clip_float(beat_color_even), 1.0f);

    // Draw energy dots (RESTORED: legacy positions)
    float opacity = 0.1f + 0.8f * strength;
    draw_dot(leds, NUM_RESERVED_DOTS + 0, dot_color_odd, 1.0f - beat_sum_odd, opacity);
    draw_dot(leds, NUM_RESERVED_DOTS + 1, dot_color_even, 1.0f - beat_sum_even, opacity);

    // Mirror mode: additional dots
    draw_dot(leds, NUM_RESERVED_DOTS + 2, dot_color_odd, beat_sum_odd, opacity);
    draw_dot(leds, NUM_RESERVED_DOTS + 3, dot_color_even, beat_sum_even, opacity);
    
    // Apply global brightness
	for (int i = 0; i < NUM_LEDS; i++) {
		// Master brightness handled in color pipeline
	}

    apply_background_overlay(context);
    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_IS_STALE
}

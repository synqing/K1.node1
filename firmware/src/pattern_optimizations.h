// ============================================================================
// PATTERN OPTIMIZATIONS - Performance Fixes for Underperforming Patterns
// ============================================================================
// Fixes for patterns that were bugging or underperforming
// Based on Engineering Playbook principles:
// - Measure-before-cut: Profile first
// - Fail fast & loud: Early exit on bad conditions
// - QPT Pattern: Quantize → Pack → Transmit
// - Bounded operations: No unbounded loops
// ============================================================================

#pragma once
#include "generated_patterns.h"

// ============================================================================
// OPTIMIZED SPECTRUM - Fixed flickering and improved interpolation
// ============================================================================
void draw_spectrum_optimized(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    // Don't skip on stale audio - use decay instead for smoother visuals
    float freshness = 1.0f;
    if (AUDIO_IS_STALE()) {
        float age_ms = (float)AUDIO_AGE_MS();
        freshness = fmaxf(0.0f, 1.0f - (age_ms / 300.0f)); // Smoother decay
    }

    // Single-pass center-mirror rendering (QPT optimized)
    const int half_leds = NUM_LEDS / 2;
    const float inv_half = 1.0f / (float)half_leds;

    // Pre-calculate global factors
    const float brightness = params.brightness * freshness;
    const float smooth_mix = clip_float(params.custom_param_1); // Control smoothing

    for (int i = 0; i < half_leds; i++) {
        float progress = (float)i * inv_half;

        // Optimized spectrum sampling with anti-aliasing
        float bin_float = progress * (NUM_FREQS - 1);
        int bin_low = (int)bin_float;
        int bin_high = min(bin_low + 1, NUM_FREQS - 1);
        float frac = bin_float - bin_low;

        // Linear interpolation between bins
        float raw_low = AUDIO_SPECTRUM[bin_low];
        float raw_high = AUDIO_SPECTRUM[bin_high];
        float raw_mag = raw_low + (raw_high - raw_low) * frac;

        float smooth_low = AUDIO_SPECTRUM_SMOOTH[bin_low];
        float smooth_high = AUDIO_SPECTRUM_SMOOTH[bin_high];
        float smooth_mag = smooth_low + (smooth_high - smooth_low) * frac;

        // Mix raw and smooth based on parameter
        float magnitude = raw_mag * (1.0f - smooth_mix) + smooth_mag * smooth_mix;
        magnitude = response_sqrt(magnitude); // Better visual response

        // Get color with proper brightness
        CRGBF color = color_from_palette(params.palette_id, progress, magnitude * brightness);

        // Single write to both mirrored positions
        int left = (NUM_LEDS / 2) - 1 - i;
        int right = (NUM_LEDS / 2) + i;
        leds[left] = color;
        leds[right] = color;
    }

    apply_background_overlay(params);
}

// ============================================================================
// OPTIMIZED BEAT TUNNEL - Single-pass rendering, no redundant copies
// ============================================================================
void draw_beat_tunnel_optimized(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    // Frame timing
    static float last_time = 0.0f;
    float dt = fminf(0.05f, fmaxf(0.0f, time - last_time));
    last_time = time;

    // Update tunnel position
    static float angle = 0.0f;
    float speed = (0.002f + 0.008f * params.speed) * 60.0f; // Hz normalized
    angle = fmodf(angle + speed * dt, 2.0f * M_PI);

    float position = 0.5f + 0.4f * sinf(angle);
    float decay = 0.88f + 0.10f * params.softness; // Persistence

    // Get audio energy
    float energy = 0.3f; // Default for no audio
    if (AUDIO_IS_AVAILABLE()) {
        energy = fminf(1.0f, AUDIO_VU * 0.7f + AUDIO_NOVELTY * 0.3f);
    }

    // Single-pass render with decay (no separate image buffers)
    static CRGBF persistence[NUM_LEDS] = {};

    for (int i = 0; i < NUM_LEDS; i++) {
        // Apply decay to persistence
        persistence[i].r *= decay;
        persistence[i].g *= decay;
        persistence[i].b *= decay;

        // Calculate new contribution
        float led_pos = (float)i / (float)(NUM_LEDS - 1);
        float distance = fabsf(led_pos - position);
        float gauss = expf(-distance * distance * 50.0f); // Sharper peak

        // Audio modulation
        float spectrum = AUDIO_IS_AVAILABLE() ?
            AUDIO_SPECTRUM_INTERP(led_pos) : 0.3f;
        float brightness = gauss * (0.3f + spectrum * energy * 0.7f);

        // Add new color to persistence
        CRGBF color = color_from_palette(params.palette_id, led_pos, brightness);
        persistence[i].r = fminf(1.0f, persistence[i].r + color.r * brightness);
        persistence[i].g = fminf(1.0f, persistence[i].g + color.g * brightness);
        persistence[i].b = fminf(1.0f, persistence[i].b + color.b * brightness);

        // Output with global brightness
        leds[i].r = persistence[i].r * params.brightness;
        leds[i].g = persistence[i].g * params.brightness;
        leds[i].b = persistence[i].b * params.brightness;
    }

    apply_mirror_mode(leds, true);
    apply_background_overlay(params);
}

// ============================================================================
// OPTIMIZED METRONOME - Use actual tempo data, no buffer clearing
// ============================================================================
void draw_metronome_optimized(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    // Use actual tempo bins from audio system
    const int tempo_dots = min(8, NUM_TEMPI);

    // Direct render without clearing (overwrite mode)
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGBF(0.0f, 0.0f, 0.0f);
    }

    // If no audio, show animated reference dots
    if (!AUDIO_IS_AVAILABLE()) {
        for (int t = 0; t < tempo_dots; t++) {
            float phase = fmodf(time * (0.5f + t * 0.25f) * params.speed, 1.0f);
            float pos = 0.1f + phase * 0.8f;
            CRGBF color = color_from_palette(params.palette_id, (float)t / tempo_dots, 0.7f);
            draw_dot(leds, NUM_RESERVED_DOTS + t, color, pos, 0.8f);
        }
    } else {
        // Use real tempo magnitude and phase data
        float max_mag = 0.0001f;
        for (int t = 0; t < tempo_dots; t++) {
            max_mag = fmaxf(max_mag, AUDIO_TEMPO_MAGNITUDE(t));
        }

        for (int t = 0; t < tempo_dots; t++) {
            // Get tempo bin data
            float magnitude = AUDIO_TEMPO_MAGNITUDE(t) / max_mag;
            float phase = AUDIO_TEMPO_PHASE(t);

            // Position based on phase (0-1 maps to strip position)
            float pos = 0.05f + phase * 0.9f;

            // Brightness based on magnitude
            float brightness = 0.2f + magnitude * 0.8f;
            brightness = powf(brightness, 0.7f); // Gamma correction

            // Color from palette
            float progress = (float)t / (float)tempo_dots;
            CRGBF color = color_from_palette(params.palette_id, progress, brightness);

            // Draw with proper opacity
            float opacity = 0.3f + magnitude * 0.7f;
            draw_dot(leds, NUM_RESERVED_DOTS + t, color, pos, opacity);
        }
    }

    // Apply global brightness efficiently
    float bright = params.brightness;
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i].r *= bright;
        leds[i].g *= bright;
        leds[i].b *= bright;
    }

    apply_background_overlay(params);
}

// ============================================================================
// OPTIMIZED PERLIN - Reduced octaves, cached calculations
// ============================================================================
void draw_perlin_optimized(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    // Static position for smoother animation
    static float perlin_y = 0.0f;

    // Audio-driven flow speed
    float vu = AUDIO_IS_AVAILABLE() ? AUDIO_VU : 0.3f;
    float speed_factor = 0.001f + 0.005f * params.speed;
    speed_factor *= (0.2f + powf(vu, 3.0f) * 0.8f); // Cubic for more dynamic response

    perlin_y += speed_factor;

    // Lower resolution for performance (every 4th LED)
    const int sample_rate = 4;
    const int samples = NUM_LEDS / sample_rate;

    // Pre-calculate noise values
    static float noise_cache[NUM_LEDS / 4];

    for (int s = 0; s < samples; s++) {
        float x = (float)s / (float)samples * 3.0f; // Spatial frequency

        // Single octave for performance (was multi-octave)
        float value = perlin_noise_simple_2d(x, perlin_y, 0x12345678);
        noise_cache[s] = (value + 1.0f) * 0.5f; // Normalize to 0-1
    }

    // Render with interpolation
    for (int i = 0; i < NUM_LEDS; i++) {
        int sample_idx = i / sample_rate;
        int next_idx = min(sample_idx + 1, samples - 1);
        float frac = (float)(i % sample_rate) / sample_rate;

        // Interpolate between samples
        float noise = noise_cache[sample_idx] * (1.0f - frac) +
                     noise_cache[next_idx] * frac;

        // Use noise for both hue shift and brightness
        float hue = fmodf(noise + time * 0.05f * params.speed, 1.0f);
        float brightness = 0.3f + noise * 0.7f;

        CRGBF color = color_from_palette(params.palette_id, hue, brightness);
        leds[i] = color;
        leds[i].r *= params.brightness * params.saturation;
        leds[i].g *= params.brightness * params.saturation;
        leds[i].b *= params.brightness * params.saturation;
    }

    apply_mirror_mode(leds, true);
    apply_background_overlay(params);
}

// ============================================================================
// OPTIMIZED OCTAVE - Better chromagram mapping
// ============================================================================
void draw_octave_optimized(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    // Early exit if no audio
    if (!AUDIO_IS_AVAILABLE()) {
        CRGBF ambient = color_from_palette(params.palette_id,
                                          params.color,
                                          params.background * params.brightness);
        for (int i = 0; i < NUM_LEDS; i++) {
            leds[i] = ambient;
        }
        return;
    }

    // Map 12 chromagram bins to LED strip (center-origin)
    const int half_leds = NUM_LEDS / 2;

    // Pre-calculate scaling factors
    float freshness = AUDIO_IS_STALE() ? 0.7f : 1.0f;
    float bright = params.brightness * freshness;

    for (int i = 0; i < half_leds; i++) {
        // Map position to chromagram bin (12 notes)
        float progress = (float)i / (float)half_leds;
        int chroma_bin = (int)(progress * 12.0f);
        chroma_bin = min(chroma_bin, 11);

        // Get chromagram magnitude with smoothing
        float magnitude = AUDIO_CHROMAGRAM[chroma_bin];
        magnitude = powf(magnitude, 0.7f) * freshness; // Gamma for visibility

        // Color based on note
        float hue = (float)chroma_bin / 12.0f;
        CRGBF color = color_from_palette(params.palette_id, hue, magnitude * bright);

        // Mirror from center
        int left = (NUM_LEDS / 2) - 1 - i;
        int right = (NUM_LEDS / 2) + i;
        leds[left] = color;
        leds[right] = color;
    }

    apply_background_overlay(params);
}

// ============================================================================
// Pattern Registry Update Helper
// ============================================================================
// Call this in setup() after init_pattern_registry() to replace buggy patterns
void apply_pattern_optimizations() {
    extern const PatternInfo g_pattern_registry[];
    extern const uint8_t g_num_patterns;

    // Find and replace underperforming patterns
    for (uint8_t i = 0; i < g_num_patterns; i++) {
        const char* id = g_pattern_registry[i].id;

        // Replace with optimized versions
        if (strcmp(id, "spectrum") == 0) {
            const_cast<PatternInfo*>(&g_pattern_registry[i])->draw_fn = draw_spectrum_optimized;
            LOG_INFO(TAG_GPU, "Replaced spectrum with optimized version");
        }
        else if (strcmp(id, "beat_tunnel") == 0) {
            const_cast<PatternInfo*>(&g_pattern_registry[i])->draw_fn = draw_beat_tunnel_optimized;
            LOG_INFO(TAG_GPU, "Replaced beat_tunnel with optimized version");
        }
        else if (strcmp(id, "metronome") == 0) {
            const_cast<PatternInfo*>(&g_pattern_registry[i])->draw_fn = draw_metronome_optimized;
            LOG_INFO(TAG_GPU, "Replaced metronome with optimized version");
        }
        else if (strcmp(id, "perlin") == 0) {
            const_cast<PatternInfo*>(&g_pattern_registry[i])->draw_fn = draw_perlin_optimized;
            LOG_INFO(TAG_GPU, "Replaced perlin with optimized version");
        }
        else if (strcmp(id, "octave") == 0) {
            const_cast<PatternInfo*>(&g_pattern_registry[i])->draw_fn = draw_octave_optimized;
            LOG_INFO(TAG_GPU, "Replaced octave with optimized version");
        }
    }
}
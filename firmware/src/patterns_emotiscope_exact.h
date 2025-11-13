// ============================================================================
// EMOTISCOPE PATTERN REWRITES - EXACT SPECIFICATION PORT
// Ported from Emotiscope 2.0 (SensoryBridge) to K1 architecture
// Using new pattern_effects.h and pattern_audio_extended.h infrastructure
// ============================================================================

#pragma once

#include "pattern_effects.h"
#include "pattern_audio_extended.h"
#include "pattern_audio_interface.h"
#include "types.h"
#include <cstring>
#include <math.h>

// ============================================================================
// PATTERN 1: SPECTRUM - Maps frequency spectrum to LED positions
// ============================================================================
/**
 * Exact port from Emotiscope 2.0/SensoryBridge spectrum.h
 * - Maps frequency bins linearly across LED strip
 * - Brightness = magnitude from spectrogram_smooth
 * - Color = progress (hue varies with position)
 * - Uses color_from_palette for smooth color mapping
 */
void draw_spectrum_emotiscope_exact(const PatternRenderContext& context) {
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    int num_leds = context.num_leds;
    const AudioDataSnapshot& audio = context.audio_snapshot;

    if (!audio.is_valid) {
        // Fallback: ambient color
        CRGBF ambient = color_from_palette(params.palette_id, 0.5f, 0.1f);
        for (int i = 0; i < num_leds; i++) leds[i] = ambient;
        return;
    }

    // Calculate first half (apply_split_mirror_mode handles mirroring)
    for (int i = 0; i < (num_leds >> 1); i++) {
        float progress = (float)i / (float)(num_leds >> 1);
        float mag = clip_float(interpolate(progress, audio.spectrogram_smooth, NUM_FREQS));

        CRGBF color = color_from_palette(params.palette_id, progress, mag);
        leds[i] = color;
    }

    // Apply split-mirror mode
    int half = num_leds / 2;
    for (int i = 0; i < half; i++) {
        leds[num_leds - 1 - i] = leds[i];
    }
}

// ============================================================================
// PATTERN 2: OCTAVE - Maps 12-bin chromagram (musical notes) to LEDs
// ============================================================================
/**
 * Exact port from Emotiscope 2.0/SensoryBridge octave.h
 * - Maps 12 chromagram bins (C, C#, D, ..., B) across LED strip
 * - Brightness = energy of that note
 * - Color = progress (hue represents note position)
 */
void draw_octave_emotiscope_exact(const PatternRenderContext& context) {
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    int num_leds = context.num_leds;
    const AudioDataSnapshot& audio = context.audio_snapshot;

    if (!audio.is_valid) {
        // Fallback: time-based animation
        for (int i = 0; i < num_leds; i++) {
            leds[i] = color_from_palette(params.palette_id, 0.5f, 0.1f);
        }
        return;
    }

    // Calculate first half
    for (int i = 0; i < (num_leds >> 1); i++) {
        float progress = (float)i / (float)(num_leds >> 1);
        // Interpolate across 12 chromagram bins for smooth response
        float mag = interpolate(progress, audio.chromagram, 12);
        mag = clip_float(mag);

        CRGBF color = color_from_palette(params.palette_id, progress, mag);
        leds[i] = color;
    }

    // Apply split-mirror mode
    int half = num_leds / 2;
    for (int i = 0; i < half; i++) {
        leds[num_leds - 1 - i] = leds[i];
    }
}

// ============================================================================
// PATTERN 3: BLOOM - Persistence buffer with VU level spreading
// ============================================================================
/**
 * Exact port from Emotiscope 2.0/SensoryBridge bloom.h
 * - Maintains persistent float buffer across frames
 * - Spreads from center using draw_sprite (linear fade)
 * - Injects VU level at center, spreads outward
 * - Applies exponential decay (0.99 per frame)
 */

static float bloom_persist_image[NUM_LEDS] = {0};
static float bloom_persist_prev[NUM_LEDS] = {0};

void draw_bloom_emotiscope_exact(const PatternRenderContext& context) {
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    int num_leds = context.num_leds;
    const AudioDataSnapshot& audio = context.audio_snapshot;

    if (!audio.is_valid) {
        memset(leds, 0, sizeof(CRGBF) * num_leds);
        memset(bloom_persist_image, 0, sizeof(float) * num_leds);
        memset(bloom_persist_prev, 0, sizeof(float) * num_leds);
        return;
    }

    // Speed parameter controls spread (0.125 + 0.875 * speed_slider)
    float spread_speed = 0.125f + 0.875f * clip_float(params.speed);

    // Apply draw_sprite effect: spread persistence buffer
    draw_sprite_float(bloom_persist_image, bloom_persist_prev, num_leds, num_leds,
                     spread_speed, 0.99f);  // 0.99 = 1% decay per frame

    // Inject VU level at center
    bloom_persist_image[0] = audio.vu_level;
    bloom_persist_image[0] = fminf(1.0f, bloom_persist_image[0]);

    // Render to LEDs (first half)
    for (int i = 0; i < (num_leds >> 1); i++) {
        float progress = (float)i / (float)(num_leds >> 1);
        float novelty_pixel = clip_float(bloom_persist_image[i] * 2.0f);

        CRGBF color = color_from_palette(params.palette_id, progress, novelty_pixel);
        leds[i] = color;
    }

    // Copy for next frame
    memcpy(bloom_persist_prev, bloom_persist_image, sizeof(float) * num_leds);

    // Apply split-mirror mode
    int half = num_leds / 2;
    for (int i = 0; i < half; i++) {
        leds[num_leds - 1 - i] = leds[i];
    }
}

// ============================================================================
// PATTERN 4: BLOOM_MIRROR - Chromagram-driven persistence from center
// ============================================================================
/**
 * Bloom variant that:
 * - Uses chromagram energy (12 notes) to determine wave color
 * - Spreads radially from center
 * - Mirrors for symmetrical effect
 */

static CRGBF bloom_mirror_buffer[NUM_LEDS] = {};
static CRGBF bloom_mirror_prev[NUM_LEDS] = {};

void draw_bloom_mirror_emotiscope_exact(const PatternRenderContext& context) {
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    int num_leds = context.num_leds;
    const AudioDataSnapshot& audio = context.audio_snapshot;

    if (!audio.is_valid) {
        memset(leds, 0, sizeof(CRGBF) * num_leds);
        memset(bloom_mirror_buffer, 0, sizeof(CRGBF) * num_leds);
        return;
    }

    // Speed parameter for scrolling
    float scroll_speed = 0.25f + 1.75f * clip_float(params.speed);

    // Clear and apply spray effect
    memset(bloom_mirror_buffer, 0, sizeof(CRGBF) * num_leds);
    draw_sprite(bloom_mirror_buffer, bloom_mirror_prev, num_leds, num_leds,
               scroll_speed, 0.92f);  // 0.92 = 8% decay per frame

    // Build chromagram-driven color blend
    CRGBF wave_color = {0.0f, 0.0f, 0.0f};
    float brightness_accum = 0.0f;

    // Accumulate chromagram energy across 12 bins (musical notes)
    for (int i = 0; i < 12; i++) {
        float bin = clip_float(audio.chromagram[i]);
        bin = bin * bin;  // Square for emphasis

        float progress = ((float)i + 0.5f) / 12.0f;
        CRGBF add = color_from_palette(params.palette_id, progress, bin / 12.0f);

        wave_color.r += add.r;
        wave_color.g += add.g;
        wave_color.b += add.b;
    }

    // Clamp color components
    wave_color.r = fminf(1.0f, wave_color.r);
    wave_color.g = fminf(1.0f, wave_color.g);
    wave_color.b = fminf(1.0f, wave_color.b);

    // Inject wave color at center
    int center = num_leds >> 1;
    float conf_inject = audio.vu_level;  // Use VU level for injection strength

    bloom_mirror_buffer[center - 1].r += wave_color.r * conf_inject;
    bloom_mirror_buffer[center - 1].g += wave_color.g * conf_inject;
    bloom_mirror_buffer[center - 1].b += wave_color.b * conf_inject;
    bloom_mirror_buffer[center].r += wave_color.r * conf_inject;
    bloom_mirror_buffer[center].g += wave_color.g * conf_inject;
    bloom_mirror_buffer[center].b += wave_color.b * conf_inject;

    // Mirror right half onto left for symmetry
    for (int i = 0; i < center; i++) {
        bloom_mirror_buffer[i] = bloom_mirror_buffer[(num_leds - 1) - i];
    }

    // Copy to previous for next frame
    memcpy(bloom_mirror_prev, bloom_mirror_buffer, sizeof(CRGBF) * num_leds);

    // Output to LEDs
    for (int i = 0; i < num_leds; i++) {
        leds[i] = bloom_mirror_buffer[i];
    }
}

// ============================================================================
// PATTERN 5: TEMPISCOPE - Tempo (BPM) visualization
// ============================================================================
/**
 * Exact port from Emotiscope 2.0/SensoryBridge tempiscope.h
 * - Maps 64 tempo bins to LED positions
 * - Each LED = one tempo bin (32-192 BPM range)
 * - Brightness = tempo_smooth[i] * sin(phase) for beat modulation
 * - Color = hue varies with tempo position (low BPM = red, high BPM = magenta)
 */
void draw_tempiscope_emotiscope_exact(const PatternRenderContext& context) {
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    int num_leds = context.num_leds;
    const AudioDataSnapshot& audio = context.audio_snapshot;

    if (!audio.is_valid) {
        memset(leds, 0, sizeof(CRGBF) * num_leds);
        return;
    }

    // Draw the current frame - map each tempo bin to LED
    for (int i = 0; i < NUM_TEMPI && i < num_leds; i++) {
        float progress = (float)i / (float)NUM_TEMPI;

        // Phase-modulate magnitude: sin of phase creates beat pulsing
        float sine = 1.0f - ((audio.tempo_phase[i] + static_cast<float>(M_PI)) / (2.0f * static_cast<float>(M_PI)));
        float mag = clip_float(audio.tempo_magnitude[i] * sine);

        // Only light if energy is above threshold
        if (mag > 0.005f) {
            // Map progress to hue (rainbow across tempos)
            float hue = fmodf(progress, 1.0f);
            CRGBF color = hsv(hue, params.saturation, mag);
            leds[i] = color;
        } else {
            leds[i] = CRGBF{0.0f, 0.0f, 0.0f};
        }
    }
}

// ============================================================================
// PATTERN 6: BEAT_TUNNEL - Tempo-driven tunnel with persistence
// ============================================================================
/**
 * Exact port from Emotiscope 2.0/SensoryBridge beat_tunnel.h
 * - Uses tempo bins as input source
 * - Tempo phase modulates brightness (narrow band at 65% phase)
 * - Persists and scrolls using draw_sprite
 * - Applies mirror mode for symmetry
 */

static CRGBF tunnel_persist[NUM_LEDS] = {};
static CRGBF tunnel_persist_prev[NUM_LEDS] = {};
static float tunnel_angle = 0.0f;

void draw_beat_tunnel_emotiscope_exact(const PatternRenderContext& context) {
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    int num_leds = context.num_leds;
    const AudioDataSnapshot& audio = context.audio_snapshot;

    if (!audio.is_valid) {
        memset(tunnel_persist, 0, sizeof(CRGBF) * num_leds);
        memset(leds, 0, sizeof(CRGBF) * num_leds);
        return;
    }

    // Clear tunnel image
    memset(tunnel_persist, 0, sizeof(CRGBF) * num_leds);

    // Animate angle for position modulation
    tunnel_angle += 0.001f;

    // Compute scroll position (oscillates based on speed parameter)
    float position = (0.125f + 0.875f * clip_float(params.speed)) * sinf(tunnel_angle) * 0.5f;

    // Apply draw_sprite to create scrolling effect
    draw_sprite(tunnel_persist, tunnel_persist_prev, num_leds, num_leds, position, 0.965f);

    // Add tempo data to tunnel image
    // Only light tempo bins that are near phase = 0.65
    for (int i = 0; i < NUM_TEMPI && i < num_leds; i++) {
        float phase = 1.0f - ((audio.tempo_phase[i] + static_cast<float>(M_PI)) / (2.0f * static_cast<float>(M_PI)));

        float mag = 0.0f;
        // Narrow window: only show if phase is near 0.65
        if (fabsf(phase - 0.65f) < 0.02f) {
            mag = clip_float(audio.tempo_magnitude[i]);
        }

        // Color from hue position (tempo to hue mapping)
        float hue = fmodf((float)i / (float)NUM_TEMPI, 1.0f);
        CRGBF tempi_color = hsv(hue, params.saturation, mag);

        tunnel_persist[i].r += tempi_color.r;
        tunnel_persist[i].g += tempi_color.g;
        tunnel_persist[i].b += tempi_color.b;
    }

    // Apply mirror mode
    int half = num_leds >> 1;
    for (int i = 0; i < half; i++) {
        tunnel_persist[half + i] = tunnel_persist[(half - 1) - i];
    }

    // Copy to output
    memcpy(leds, tunnel_persist, sizeof(CRGBF) * num_leds);

    // Copy for next frame
    memcpy(tunnel_persist_prev, tunnel_persist, sizeof(CRGBF) * num_leds);
}

// ============================================================================
// PATTERN 7: BEAT_TUNNEL_VARIANT - Alternative tunnel variant
// ============================================================================
/**
 * Variant of beat_tunnel with different modulation:
 * - Phase modulates position instead of brightness
 * - Creates ripple/wave effect instead of narrow band
 */

void draw_beat_tunnel_variant_emotiscope_exact(const PatternRenderContext& context) {
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    int num_leds = context.num_leds;
    const AudioDataSnapshot& audio = context.audio_snapshot;

    if (!audio.is_valid) {
        memset(leds, 0, sizeof(CRGBF) * num_leds);
        return;
    }

    // Clear
    memset(tunnel_persist, 0, sizeof(CRGBF) * num_leds);

    tunnel_angle += 0.002f;  // Faster rotation
    float position = (0.125f + 0.875f * clip_float(params.speed)) * sinf(tunnel_angle * 2.0f) * 0.4f;

    draw_sprite(tunnel_persist, tunnel_persist_prev, num_leds, num_leds, position, 0.95f);

    // Variant: show wider band with phase-dependent width
    for (int i = 0; i < NUM_TEMPI && i < num_leds; i++) {
        float phase = 1.0f - ((audio.tempo_phase[i] + static_cast<float>(M_PI)) / (2.0f * static_cast<float>(M_PI)));

        // Wider window that changes with phase
        float window_width = 0.04f + 0.02f * sinf(phase * 2.0f * static_cast<float>(M_PI));

        float mag = 0.0f;
        if (fabsf(phase - 0.5f) < window_width) {
            mag = clip_float(audio.tempo_magnitude[i]);
        }

        float hue = fmodf((float)i / (float)NUM_TEMPI, 1.0f);
        CRGBF tempi_color = hsv(hue, params.saturation, mag);

        tunnel_persist[i].r += tempi_color.r;
        tunnel_persist[i].g += tempi_color.g;
        tunnel_persist[i].b += tempi_color.b;
    }

    // Mirror
    int half = num_leds >> 1;
    for (int i = 0; i < half; i++) {
        tunnel_persist[half + i] = tunnel_persist[(half - 1) - i];
    }

    memcpy(leds, tunnel_persist, sizeof(CRGBF) * num_leds);
    memcpy(tunnel_persist_prev, tunnel_persist, sizeof(CRGBF) * num_leds);
}

// ============================================================================
// PATTERN 8: PULSE - Beat-reactive waves from center
// ============================================================================
/**
 * Exact port from Emotiscope 2.0/SensoryBridge pulse.h
 * - Spawns waves from center on beat detection (tempo_confidence threshold)
 * - Each wave: Gaussian bell curve with exponential decay
 * - Color from dominant chromagram note
 * - Additive blending for overlapping waves
 */

// NOTE: pulse_wave struct and MAX_PULSE_WAVES are defined in generated_patterns.h
// pulse_waves static array is declared before this header is included

float get_dominant_chroma_hue_from_audio(const AudioDataSnapshot& audio) {
    float max_chroma = 0.0f;
    uint16_t max_index = 0;

    for (int i = 0; i < 12; i++) {
        if (audio.chromagram[i] > max_chroma) {
            max_chroma = audio.chromagram[i];
            max_index = i;
        }
    }

    // Map chromagram index (0-11) to hue (0.0-1.0)
    return (float)max_index / 12.0f;
}

void draw_pulse_emotiscope_exact(const PatternRenderContext& context) {
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    int num_leds = context.num_leds;
    const AudioDataSnapshot& audio = context.audio_snapshot;

    if (!audio.is_valid) {
        memset(leds, 0, sizeof(CRGBF) * num_leds);
        return;
    }

    // Spawn new wave on beat detection (high tempo_confidence)
    float beat_threshold = 0.3f;
    if (audio.tempo_confidence > beat_threshold) {
        for (int i = 0; i < MAX_PULSE_WAVES; i++) {
            if (!pulse_waves[i].active) {
                pulse_waves[i].position = 0.0f;
                pulse_waves[i].speed = (0.2f + clip_float(params.speed) * 0.4f);
                pulse_waves[i].hue = get_dominant_chroma_hue_from_audio(audio);
                pulse_waves[i].brightness = sqrtf(audio.tempo_confidence);
                pulse_waves[i].age = 0;
                pulse_waves[i].active = true;
                break;  // Only spawn one per frame
            }
        }
    }

    // Clear LED buffer
    memset(leds, 0, sizeof(CRGBF) * num_leds);

    // Update and render all active waves
    for (int w = 0; w < MAX_PULSE_WAVES; w++) {
        if (!pulse_waves[w].active) continue;

        // Update wave position and age
        pulse_waves[w].position += pulse_waves[w].speed;
        pulse_waves[w].age++;

        // Deactivate if past all LEDs
        if (pulse_waves[w].position > 1.5f) {
            pulse_waves[w].active = false;
            continue;
        }

        // Render wave as Gaussian bell curve
        float decay_factor = 0.02f + (clip_float(params.softness) * 0.03f);
        float base_width = 0.08f;
        float width_growth = 0.05f;
        float decay = expf(-pulse_waves[w].age * decay_factor);
        float wave_width = base_width + width_growth * pulse_waves[w].age;

        // Render to first half
        for (int i = 0; i < (num_leds >> 1); i++) {
            float progress = (float)i / (float)(num_leds >> 1);

            // Gaussian bell curve centered at wave position
            float distance = fabsf(progress - pulse_waves[w].position);
            float gaussian = expf(-(distance * distance) / (2.0f * wave_width * wave_width));

            // Intensity = brightness * gaussian * decay
            float intensity = pulse_waves[w].brightness * gaussian * decay;
            intensity = clip_float(intensity);

            // Get color from palette
            CRGBF color = color_from_palette(params.palette_id, pulse_waves[w].hue, intensity);

            // Additive blending
            leds[i].r = clip_float(leds[i].r + color.r * intensity);
            leds[i].g = clip_float(leds[i].g + color.g * intensity);
            leds[i].b = clip_float(leds[i].b + color.b * intensity);
        }
    }

    // Apply mirror for symmetry
    int half = num_leds / 2;
    for (int i = 0; i < half; i++) {
        leds[num_leds - 1 - i] = leds[i];
    }
}

// ============================================================================
// PATTERN 9: PERLIN - Procedural noise with VU momentum
// ============================================================================
/**
 * Exact port from Emotiscope 2.0/SensoryBridge perlin.h
 * - Generates Perlin-like noise field
 * - X varies with sine wave (animation)
 * - Y driven by VU^4 momentum for beat reactivity
 * - Renders noise as hue map across LEDs
 */

static double perlin_x = 0.0;
static double perlin_y = 0.0;
static float perlin_momentum = 0.0f;

void draw_perlin_emotiscope_exact(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    int num_leds = context.num_leds;
    const AudioDataSnapshot& audio = context.audio_snapshot;

    if (!audio.is_valid) {
        memset(leds, 0, sizeof(CRGBF) * num_leds);
        return;
    }

    // Update perlin position with VU momentum
    float push = audio.vu_level * audio.vu_level * audio.vu_level * audio.vu_level
               * clip_float(params.speed) * 0.1f;

    perlin_momentum *= 0.99f;  // Decay momentum
    perlin_momentum = fmaxf(perlin_momentum, push);

    static float angle = 0.0f;
    angle += 0.001f;
    float sine = sinf(angle);

    perlin_x += 0.01f * sine;
    perlin_y += 0.0001f;
    perlin_y += perlin_momentum;

    // Generate Perlin noise for hue and luminance
    static float perlin_hue[NUM_LEDS] = {0};
    static float perlin_lum[NUM_LEDS] = {0};

    fill_array_with_perlin(perlin_hue, num_leds, (float)perlin_x, (float)perlin_y, 0.025f);
    fill_array_with_perlin(perlin_lum, num_leds, (float)perlin_x + 100.0f, (float)perlin_y + 50.0f, 0.0125f);

    // Scale luminance from [0,1] to [0.1, 1.0] using DSPS
    // For now, manual scaling (DSPS would be dsps_mulc_f32 and dsps_addc_f32)
    for (int i = 0; i < num_leds; i++) {
        perlin_lum[i] = perlin_lum[i] * 0.98f + 0.02f;  // Scale to [0.02, 1.0]
        perlin_lum[i] = perlin_lum[i] * perlin_lum[i];  // Square for emphasis
    }

    // Render
    if (params.custom_param_1 < 0.5f) {  // Non-mirror mode
        for (int i = 0; i < num_leds; i++) {
            CRGBF color = hsv(
                fmodf(get_color_range_hue(perlin_hue[i]), 1.0f),
                params.saturation,
                perlin_lum[i]
            );
            leds[i] = color;
        }
    } else {  // Mirror mode
        for (int i = 0; i < (num_leds >> 1); i++) {
            CRGBF color = hsv(
                fmodf(get_color_range_hue(perlin_hue[i << 1]), 1.0f),
                params.saturation,
                perlin_lum[i << 1] * perlin_lum[i << 1]
            );
            leds[i] = color;
            leds[num_leds - 1 - i] = color;
        }
    }
}

// ============================================================================
// END OF EMOTISCOPE EXACT PATTERN PORT
// ============================================================================

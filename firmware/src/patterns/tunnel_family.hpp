// ---------------------------------------------------------------------------
// Tunnel Family Patterns
//
// Patterns: Beat Tunnel, Beat Tunnel (Variant), Tunnel Glow
// Audio snapshot fields used:
//   - tempo_confidence, novelty_curve
//   - vu_level
// Helpers relied on:
//   - LED_PROGRESS, apply_mirror_mode (center-origin symmetry)
//
// IMPORTANT: These patterns depend on persistent in-memory images that decay
// over time. They assume sprite / persistence helpers are additive-only; any
// internal memset() inside draw_sprite* or similar helpers will destroy the
// tunnel history and was the root cause of earlier regressions. See
// emotiscope_helpers.cpp for the detailed memset failure analysis.
// ---------------------------------------------------------------------------

#pragma once

#include "pattern_render_context.h"
#include "pattern_audio_interface.h"
#include "palettes.h"
#include "emotiscope_helpers.h"
#include "pattern_helpers.h"
#include "pattern_channel.h"
#include "shared_pattern_buffers.h"
#include "led_driver.h"
// Debug flags
extern bool audio_debug_enabled;
extern bool tempo_debug_enabled;

// Shared buffers & state (matches Emotiscope/Sensory Bridge baseline)
static float beat_tunnel_variant_angle = 0.0f;
static float beat_tunnel_angle = 0.0f;
static CRGBF tunnel_glow_image[NUM_LEDS];
static CRGBF tunnel_glow_image_prev[NUM_LEDS];
static float tunnel_glow_angle = 0.0f;
static float tunnel_glow_last_time = 0.0f;

// Exact beat tunnel implementation
inline void draw_beat_tunnel(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    (void)context.num_leds;  // using NUM_LEDS macro instead
    const AudioDataSnapshot& audio = context.audio_snapshot;
    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
    #define AUDIO_VU (audio.payload.vu_level)
    #define AUDIO_NOVELTY (audio.payload.novelty_curve)
    #define AUDIO_SPECTRUM_INTERP(pos) interpolate(clip_float(pos), audio.payload.spectrogram_smooth, NUM_FREQS)

	const uint8_t ch_idx = get_pattern_channel_index();
	static int tunnel_buffer_id = -1;
	if (tunnel_buffer_id == -1) {
		acquire_dual_channel_buffer(tunnel_buffer_id);
	}
	CRGBF (&beat_tunnel_image)[2][NUM_LEDS] = shared_pattern_buffers.shared_image_buffer;
	CRGBF (&beat_tunnel_image_prev)[2][NUM_LEDS] = shared_pattern_buffers.shared_image_buffer_prev;

	static float last_time_bt = 0.0f;
	float dt_bt = time - last_time_bt;
	if (dt_bt < 0.0f) dt_bt = 0.0f;
	if (dt_bt > 0.05f) dt_bt = 0.05f;
	last_time_bt = time;

	for (int i = 0; i < NUM_LEDS; i++) {
		beat_tunnel_image[ch_idx][i] = CRGBF(0.0f, 0.0f, 0.0f);
	}

	float speed = 0.0015f + 0.0065f * clip_float(params.speed);
	beat_tunnel_angle += speed * (dt_bt > 0.0f ? (dt_bt * 1000.0f) : 1.0f);
	if (beat_tunnel_angle > static_cast<float>(2.0 * M_PI)) {
		beat_tunnel_angle = fmodf(beat_tunnel_angle, static_cast<float>(2.0 * M_PI));
	}

	float position = (0.125f + 0.875f * clip_float(params.speed)) * sinf(beat_tunnel_angle) * 0.5f;
	float decay = 0.90f + 0.08f * clip_float(params.softness); // 0.90..0.98
	draw_sprite(beat_tunnel_image[ch_idx], beat_tunnel_image_prev[ch_idx], NUM_LEDS, NUM_LEDS, position, decay);

	if (!AUDIO_IS_AVAILABLE()) {
		for (int i = 0; i < NUM_LEDS; i++) {
			float led_pos = LED_PROGRESS(i);
			float distance = fabsf(led_pos - (position * 0.5f + 0.5f));
			float brightness = expf(-(distance * distance) / (2.0f * 0.08f * 0.08f));
			CRGBF color = color_from_palette(params.palette_id, led_pos, brightness);
			beat_tunnel_image[ch_idx][i].r += color.r * brightness;
			beat_tunnel_image[ch_idx][i].g += color.g * brightness;
			beat_tunnel_image[ch_idx][i].b += color.b * brightness;
		}
    } else {
        const int half_leds = NUM_LEDS >> 1;
        const float sigma = 0.02f + 0.06f * clip_float(params.softness);
        float sum_mag = 0.0f; uint16_t max_idx = 0; float max_mag = 0.0f;
        for (int t = 0; t < NUM_TEMPI; ++t) {
            float phase = audio.payload.tempo_phase[t];
            float mag = clip_float(audio.payload.tempo_magnitude[t]);
            sum_mag += mag; if (mag > max_mag) { max_mag = mag; max_idx = (uint16_t)t; }
            float peak = 0.5f * (sinf(phase) + 1.0f);
            float strength = response_square(mag) * peak;
            if (strength < 0.02f) continue;

            float prog = (NUM_TEMPI > 1) ? ((float)t / (float)(NUM_TEMPI - 1)) : 0.0f;
            int i_center = (int)lroundf(prog * (float)(half_leds - 1));
            for (int dx = -3; dx <= 3; ++dx) {
                int i_local = i_center + dx;
                if (i_local < 0 || i_local >= half_leds) continue;
                float p_led = (half_leds > 1) ? ((float)i_local / (float)(half_leds - 1)) : 0.0f;
                float dist = (float)dx / (float)half_leds;
                float gauss = expf(-(dist * dist) / (2.0f * sigma * sigma));
                float b = clip_float(strength * gauss);
                CRGBF c = color_from_palette(params.palette_id, p_led, b);
                int left_index = (half_leds - 1) - i_local;
                int right_index = half_leds + i_local;
                beat_tunnel_image[ch_idx][left_index].r += c.r * b;
                beat_tunnel_image[ch_idx][left_index].g += c.g * b;
                beat_tunnel_image[ch_idx][left_index].b += c.b * b;
                beat_tunnel_image[ch_idx][right_index].r += c.r * b;
                beat_tunnel_image[ch_idx][right_index].g += c.g * b;
                beat_tunnel_image[ch_idx][right_index].b += c.b * b;
            }
        }

        // Throttled debug: tempo energy snapshot
        static uint32_t last_log_ms_bt = 0; uint32_t now_ms_bt = millis();
        if ((audio_debug_enabled || tempo_debug_enabled) && (now_ms_bt - last_log_ms_bt) > 500) {
            last_log_ms_bt = now_ms_bt;
            LOG_DEBUG(TAG_GPU, "[BEAT_TUNNEL] sum_mag=%.3f max=%.3f idx=%u", sum_mag, max_mag, (unsigned)max_idx);
        }
    }

	for (int i = 0; i < NUM_LEDS; i++) {
        leds[i].r = beat_tunnel_image[ch_idx][i].r;
        leds[i].g = beat_tunnel_image[ch_idx][i].g;
        leds[i].b = beat_tunnel_image[ch_idx][i].b;
    }

	apply_mirror_mode(leds, true);
	apply_background_overlay(context);

	for (int i = 0; i < NUM_LEDS; i++) {
        beat_tunnel_image_prev[ch_idx][i] = beat_tunnel_image[ch_idx][i];
    }

    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_VU
    #undef AUDIO_NOVELTY
    #undef AUDIO_SPECTRUM_INTERP
}

// Exact beat tunnel variant implementation
inline void draw_beat_tunnel_variant(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    (void)context.num_leds;  // using NUM_LEDS macro instead
    const AudioDataSnapshot& audio = context.audio_snapshot;
    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
    #define AUDIO_NOVELTY (audio.payload.novelty_curve)

    const uint8_t ch_idx = get_pattern_channel_index();
    static CRGBF beat_tunnel_variant_image[2][NUM_LEDS] = {};
    static CRGBF beat_tunnel_variant_image_prev[2][NUM_LEDS] = {};

    static float last_time_bt = 0.0f;
    float dt_bt = time - last_time_bt;
    if (dt_bt < 0.0f) dt_bt = 0.0f;
    if (dt_bt > 0.05f) dt_bt = 0.05f;
    last_time_bt = time;

    for (int i = 0; i < NUM_LEDS; i++) {
        beat_tunnel_variant_image[ch_idx][i] = CRGBF(0.0f, 0.0f, 0.0f);
	}

    float angle_speed = 0.12f * (0.5f + params.speed * 0.5f);
    beat_tunnel_variant_angle += angle_speed * dt_bt;
    float position = (0.125f + 0.875f * params.speed) * sinf(beat_tunnel_variant_angle) * 0.5f;

    float decay = 0.6f + (0.38f * fmaxf(0.0f, fminf(1.0f, params.softness)));
    draw_sprite(beat_tunnel_variant_image[ch_idx], beat_tunnel_variant_image_prev[ch_idx], NUM_LEDS, NUM_LEDS, position, decay);

	if (!AUDIO_IS_AVAILABLE()) {
		for (int i = 0; i < NUM_LEDS; i++) {
			float led_pos = LED_PROGRESS(i);
			float distance = fabsf(led_pos - position);
			float brightness = expf(-(distance * distance) / (2.0f * 0.08f * 0.08f));
			brightness = fmaxf(0.0f, fminf(1.0f, brightness));

			CRGBF color = color_from_palette(params.palette_id, led_pos, brightness * 0.5f);

            beat_tunnel_variant_image[ch_idx][i].r += color.r * brightness;
            beat_tunnel_variant_image[ch_idx][i].g += color.g * brightness;
            beat_tunnel_variant_image[ch_idx][i].b += color.b * brightness;
		}
    } else {
        const int half_leds = NUM_LEDS >> 1;
        const float sigma = 0.02f + 0.06f * clip_float(params.softness);
        float sum_mag = 0.0f; uint16_t max_idx = 0; float max_mag = 0.0f;
        for (int t = 0; t < NUM_TEMPI; ++t) {
            float phase = audio.payload.tempo_phase[t];
            float mag = clip_float(audio.payload.tempo_magnitude[t]);
            sum_mag += mag; if (mag > max_mag) { max_mag = mag; max_idx = (uint16_t)t; }
            float peak = 0.5f * (sinf(phase) + 1.0f);
            float strength = response_square(mag) * peak;
            if (strength < 0.02f) continue;

            float prog = (NUM_TEMPI > 1) ? ((float)t / (float)(NUM_TEMPI - 1)) : 0.0f;
            int i_center = (int)lroundf(prog * (float)(half_leds - 1));
            for (int dx = -3; dx <= 3; ++dx) {
                int i_local = i_center + dx;
                if (i_local < 0 || i_local >= half_leds) continue;
                float p_led = (half_leds > 1) ? ((float)i_local / (float)(half_leds - 1)) : 0.0f;
                float dist = (float)dx / (float)half_leds;
                float gauss = expf(-(dist * dist) / (2.0f * sigma * sigma));
                float b = clip_float(strength * gauss);
                CRGBF c = color_from_palette(params.palette_id, p_led, b);
                int left_index = (half_leds - 1) - i_local;
                int right_index = half_leds + i_local;
                beat_tunnel_variant_image[ch_idx][left_index].r += c.r * b;
                beat_tunnel_variant_image[ch_idx][left_index].g += c.g * b;
                beat_tunnel_variant_image[ch_idx][left_index].b += c.b * b;
                beat_tunnel_variant_image[ch_idx][right_index].r += c.r * b;
                beat_tunnel_variant_image[ch_idx][right_index].g += c.g * b;
                beat_tunnel_variant_image[ch_idx][right_index].b += c.b * b;
            }
        }

        static uint32_t last_log_ms_btv = 0; uint32_t now_ms_btv = millis();
        if ((audio_debug_enabled || tempo_debug_enabled) && (now_ms_btv - last_log_ms_btv) > 500) {
            last_log_ms_btv = now_ms_btv;
            LOG_DEBUG(TAG_GPU, "[BEAT_TUNNEL_V] sum_mag=%.3f max=%.3f idx=%u", sum_mag, max_mag, (unsigned)max_idx);
        }
    }

	for (int i = 0; i < NUM_LEDS; i++) {
        beat_tunnel_variant_image[ch_idx][i].r = fmaxf(0.0f, fminf(1.0f, beat_tunnel_variant_image[ch_idx][i].r));
        beat_tunnel_variant_image[ch_idx][i].g = fmaxf(0.0f, fminf(1.0f, beat_tunnel_variant_image[ch_idx][i].g));
        beat_tunnel_variant_image[ch_idx][i].b = fmaxf(0.0f, fminf(1.0f, beat_tunnel_variant_image[ch_idx][i].b));
	}

	apply_mirror_mode(beat_tunnel_variant_image[ch_idx], true);

    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = beat_tunnel_variant_image[ch_idx][i];
    }

    apply_background_overlay(context);

	for (int i = 0; i < NUM_LEDS; i++) {
        beat_tunnel_variant_image_prev[ch_idx][i] = beat_tunnel_variant_image[ch_idx][i];
    }

    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_NOVELTY
}

// Exact Tunnel Glow implementation
inline void draw_tunnel_glow(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    (void)context.num_leds;  // using NUM_LEDS macro instead
    const AudioDataSnapshot& audio = context.audio_snapshot;
    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
    #define AUDIO_VU (audio.payload.vu_level)

    float angle_speed = 0.5f + params.speed * 2.0f;
    float dt_tg = time - tunnel_glow_last_time;
    if (dt_tg < 0.0f) dt_tg = 0.0f;
    if (dt_tg > 0.05f) dt_tg = 0.05f;
    tunnel_glow_last_time = time;
    tunnel_glow_angle += angle_speed * dt_tg;
    if (tunnel_glow_angle > static_cast<float>(2.0 * M_PI)) {
        tunnel_glow_angle = fmodf(tunnel_glow_angle, static_cast<float>(2.0 * M_PI));
    }

    float decay = 0.75f + 0.2f * params.softness;
    for (int i = 0; i < NUM_LEDS; i++) {
        tunnel_glow_image_prev[i] = tunnel_glow_image[i] * decay;
    }

    if (AUDIO_IS_AVAILABLE()) {
        float vu = AUDIO_VU;

        float position = 0.5f + 0.5f * sinf(tunnel_glow_angle);
        float width = 0.02f + (1.0f - vu) * 0.15f;

        for (int i = 0; i < NUM_LEDS; i++) {
            float led_pos = LED_PROGRESS(i);
            float dist = fabsf(led_pos - position);
            float brightness = expf(-dist * dist / (2.0f * width * width));

            CRGBF color = color_from_palette(params.palette_id, led_pos, brightness);
            tunnel_glow_image[i] = tunnel_glow_image_prev[i] + color * vu;
        }
    } else {
        float position = 0.5f + 0.5f * sinf(tunnel_glow_angle);
        float width = 0.1f;
        for (int i = 0; i < NUM_LEDS; i++) {
            float led_pos = LED_PROGRESS(i);
            float dist = fabsf(led_pos - position);
            float brightness = expf(-dist * dist / (2.0f * width * width));

            CRGBF color = color_from_palette(params.palette_id, led_pos, brightness);
            tunnel_glow_image[i] = tunnel_glow_image_prev[i] + color * 0.5f;
        }
    }

    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = tunnel_glow_image[i];
    }

    apply_mirror_mode(leds, true);
    apply_background_overlay(context);

    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_VU
}

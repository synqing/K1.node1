// ---------------------------------------------------------------------------
// Bloom Family Patterns
//
// Patterns: Bloom, Bloom Mirror, Snapwave
// Audio snapshot fields used:
//   - vu_level, novelty_curve, tempo_confidence
//   - chromagram[12]
// Helpers relied on:
//   - clip_float / interpolate / response_sqrt from emotiscope_helpers.h
//   - apply_background_overlay for final compositing
//
// IMPORTANT: These patterns rely on persistent trail buffers that are decayed
// by scalar multiplication only. Earlier refactors attempted to "clean up"
// these buffers with memset(), which killed Bloom/Snapwave persistence and
// caused obvious visual regressions. Do not introduce memset() into these
// paths or into draw_sprite_float(); see emotiscope_helpers.cpp for details.
// ---------------------------------------------------------------------------

#pragma once

#include "pattern_render_context.h"
#include "pattern_audio_interface.h"
#include "palettes.h"
#include "emotiscope_helpers.h"
#include "pattern_helpers.h"
#include "pattern_channel.h"
#include "shared_pattern_buffers.h"
#include "dsps_helpers.h"
#include "led_driver.h"
#include "logging/logger.h"

#include <algorithm>
#include <cstring>
#include <cmath>

// Debug flags from main.cpp (audio/tempo debug toggles)
extern bool audio_debug_enabled;
extern bool tempo_debug_enabled;

// Emotiscope 1.0 Bloom – direct port
//
// Reference: zref/Emotiscope.sourcecode/Emotiscope-1.0/src/lightshow_modes/bloom.h
inline void draw_bloom(const PatternRenderContext& context) {
	const PatternParameters& params = context.params;
	CRGBF* leds = context.leds;
	const AudioDataSnapshot& audio = context.audio_snapshot;
	#define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
	#define AUDIO_VU (audio.payload.vu_level)

	// Persistent trail buffer (novelty_image_prev in original Emotiscope code)
	static float novelty_image_prev[NUM_LEDS] = {0.0f};
	static float novelty_image[NUM_LEDS] = {0.0f};
	
	// CRITICAL: draw_sprite_float ADDS to target, so we must start with zeros
	// The decay happens INSIDE draw_sprite_float via the alpha parameter (0.99f)
	// DO NOT pre-decay AND call draw_sprite_float - that would double-add!
	
	// Clear target buffer (draw_sprite_float will ADD scrolled previous with decay)
	for (int i = 0; i < NUM_LEDS; ++i) {
		novelty_image[i] = 0.0f;
	}

	// Spread speed: 0.125 .. 1.0 (Emotiscope 1.0)
	float spread_speed = 0.125f + 0.875f * clip_float(params.speed);
	// Persistence: draw_sprite_float ADDS scrolled previous frame with decay applied
	// The 0.99f alpha parameter provides the decay (99% of previous frame intensity)
	draw_sprite_float(novelty_image, novelty_image_prev, NUM_LEDS, NUM_LEDS, spread_speed, 0.99f);

	// Center injection from VU only (no band/tempo gates)
	float vu = AUDIO_IS_AVAILABLE() ? AUDIO_VU : 0.0f;
	novelty_image[0] = fminf(1.0f, vu);

	bool mirror_mode_enabled = (params.mirror_mode >= 0.5f);
	int half_leds = NUM_LEDS >> 1;

	if (mirror_mode_enabled) {
		// Center-origin mirrored mode
		for (int i = 0; i < half_leds; ++i) {
			float progress = (half_leds > 0) ? (static_cast<float>(i) / static_cast<float>(half_leds)) : 0.0f;
			float novelty_pixel = clip_float(novelty_image[i] * 1.0f);
			float brightness = clip_float(novelty_pixel * novelty_pixel);

			float palette_progress = params.color + progress * params.color_range;
			palette_progress = fmodf(palette_progress, 1.0f);
			if (palette_progress < 0.0f) {
				palette_progress += 1.0f;
			}
			CRGBF col = color_from_palette(params.palette_id, clip_float(palette_progress), brightness);

			int left_index = (half_leds - 1) - i;
			int right_index = half_leds + i;
			if (left_index >= 0 && left_index < NUM_LEDS) {
				leds[left_index] = col;
			}
			if (right_index >= 0 && right_index < NUM_LEDS) {
				leds[right_index] = col;
			}
		}
	} else {
		// Full-strip mode (no mirroring)
		for (int i = 0; i < NUM_LEDS; ++i) {
			float progress = (NUM_LEDS > 0) ? (static_cast<float>(i) / static_cast<float>(NUM_LEDS)) : 0.0f;
			float novelty_pixel = clip_float(novelty_image[i] * 2.0f);
			float brightness = clip_float(novelty_pixel * novelty_pixel);

			float palette_progress = params.color + progress * params.color_range;
			palette_progress = fmodf(palette_progress, 1.0f);
			if (palette_progress < 0.0f) {
				palette_progress += 1.0f;
			}
			CRGBF col = color_from_palette(params.palette_id, clip_float(palette_progress), brightness);
			leds[i] = col;
		}
	}

	// Debug trace: summarize novelty buffer periodically
	static uint32_t last_log_ms = 0;
	uint32_t now_ms = millis();
	bool debug_enabled = audio_debug_enabled || tempo_debug_enabled;
	if (debug_enabled && (now_ms - last_log_ms) > 500) {
		last_log_ms = now_ms;
		float max_novel = 0.0f;
		for (int i = 0; i < half_leds; ++i) {
			max_novel = fmaxf(max_novel, novelty_image[i]);
		}
		LOG_DEBUG(TAG_GPU,
		          "[BLOOM] avail=%d vu=%.3f novel0=%.3f max_novel=%.3f mirror=%d",
		          (int)AUDIO_IS_AVAILABLE(),
		          vu,
		          novelty_image[0],
		          max_novel,
		          (int)mirror_mode_enabled);
	}

	// Persist trail for next frame
	dsps_memcpy_accel(novelty_image_prev, novelty_image, sizeof(float) * NUM_LEDS);
	apply_background_overlay(context);

	#undef AUDIO_IS_AVAILABLE
	#undef AUDIO_VU
}

// Strict SB Bloom parity variant for A/B validation (center-injected chroma-sum,
// high-persistence sprite, tail fade and mirror). This keeps K1 palettes but
// mirrors SB’s summed-HSV brightness shaping and alpha≈0.99 persistence.
inline void draw_bloom_sb(const PatternRenderContext& context) {
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    const AudioDataSnapshot& audio = context.audio_snapshot;
    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
    #define AUDIO_CHROMAGRAM (audio.payload.chromagram)

    static int sb_buffer_id = -1;
    if (sb_buffer_id == -1) {
        acquire_dual_channel_buffer(sb_buffer_id);
    }
    const uint8_t ch_idx = get_pattern_channel_index();
    CRGBF (&img)[2][NUM_LEDS] = shared_pattern_buffers.shared_image_buffer;
    CRGBF (&img_prev)[2][NUM_LEDS] = shared_pattern_buffers.shared_image_buffer_prev;

    // 1) Clear and scroll previous with high persistence (alpha≈0.99)
    for (int i = 0; i < NUM_LEDS; ++i) img[ch_idx][i] = CRGBF{0.0f,0.0f,0.0f};
    float position = 0.250f + 1.750f * clip_float(params.speed);
    float alpha = 0.99f;
    draw_sprite(img[ch_idx], img_prev[ch_idx], NUM_LEDS, NUM_LEDS, position, alpha);

    // 2) Sum 12-bin chromagram in HSV, square once (SB CONFIG.SQUARE_ITER≈1)
    CRGBF sum_color = {0.0f,0.0f,0.0f};
    if (AUDIO_IS_AVAILABLE()) {
        const float share = 1.0f / 6.0f;
        for (int i = 0; i < 12; ++i) {
            float prog = (float)i / 12.0f;
            float v = clip_float(AUDIO_CHROMAGRAM[i]);
            v = clip_float(v * v) * share;
            CRGBF add = hsv_enhanced(prog, 1.0f, v);
            sum_color.r += add.r; sum_color.g += add.g; sum_color.b += add.b;
        }
        sum_color.r = fminf(1.0f, sum_color.r);
        sum_color.g = fminf(1.0f, sum_color.g);
        sum_color.b = fminf(1.0f, sum_color.b);
        sum_color.r *= sum_color.r;
        sum_color.g *= sum_color.g;
        sum_color.b *= sum_color.b;
    }

    // 3) Map to palette using V for brightness (K1 palette system)
    HSVF hsv_sum = rgb_to_hsv(sum_color);
    float brightness = clip_float(hsv_sum.v);
    CRGBF inject = color_from_palette(params.palette_id, clip_float(params.color), brightness);

    int mid_r = NUM_LEDS/2;
    int mid_l = mid_r - 1;
    if (mid_l >= 0) img[ch_idx][mid_l] = inject;
    if (mid_r < NUM_LEDS) img[ch_idx][mid_r] = inject;

    // 4) Copy to prev, tail fade, mirror
    std::memcpy(img_prev[ch_idx], img[ch_idx], sizeof(CRGBF)*NUM_LEDS);
    int half = NUM_LEDS/2;
    for (int i = 0; i < half; ++i) {
        float prog = (half>1) ? (float)i/(float)(half-1) : 0.0f;
        float s = prog*prog;
        int idx = NUM_LEDS-1-i;
        img[ch_idx][idx].r *= s; img[ch_idx][idx].g *= s; img[ch_idx][idx].b *= s;
    }
    for (int i = 0; i < half; ++i) {
        img[ch_idx][i] = img[ch_idx][NUM_LEDS-1-i];
    }

    for (int i = 0; i < NUM_LEDS; ++i) leds[i] = img[ch_idx][i];
    apply_background_overlay(context);

    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_CHROMAGRAM
}
inline void draw_bloom_mirror(const PatternRenderContext& context) {
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    (void)context.time;  // unused
    (void)context.num_leds;  // using NUM_LEDS macro instead
    const AudioDataSnapshot& audio = context.audio_snapshot;
    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
    #define AUDIO_VU (audio.payload.vu_level)
    #define AUDIO_NOVELTY (audio.payload.novelty_curve)
    #define AUDIO_CHROMAGRAM (audio.payload.chromagram)

	static int bloom_buffer_id = -1;
	if (bloom_buffer_id == -1) {
		acquire_dual_channel_buffer(bloom_buffer_id);
	}
	
	const uint8_t ch_idx = get_pattern_channel_index();
	CRGBF (&bloom_buffer)[2][NUM_LEDS] = shared_pattern_buffers.shared_image_buffer;
	CRGBF (&bloom_buffer_prev)[2][NUM_LEDS] = shared_pattern_buffers.shared_image_buffer_prev;

	float scroll_speed = 0.25f + 1.75f * clip_float(params.speed);
	// Sensory Bridge parity: very high persistence via alpha≈0.99
	// Earlier lower decay (0.92..0.98) made Bloom Mirror too faint
	float decay = 0.99f;
	
	// CRITICAL: draw_sprite ADDS to target, so we must start with zeros
	// The decay happens INSIDE draw_sprite via the alpha parameter (decay)
	// The persistence comes from copying target to previous at end of function
	// DO NOT pre-decay AND call draw_sprite - that would double-add!
	
	// Clear target buffer (draw_sprite will ADD scrolled previous with decay)
	for (int i = 0; i < NUM_LEDS; ++i) {
		bloom_buffer[ch_idx][i] = CRGBF{0.0f, 0.0f, 0.0f};
	}
	
	// Sprite scroll ADDS the scrolled previous frame with decay applied
	// The decay parameter (0.92-0.98) controls how much of the previous frame to add
	// This creates the persistence/trail effect as frames accumulate
	draw_sprite(bloom_buffer[ch_idx], bloom_buffer_prev[ch_idx], NUM_LEDS, NUM_LEDS, scroll_speed, decay);

	CRGBF wave_color = { 0.0f, 0.0f, 0.0f };
	float brightness_accum = 0.0f;
	// NOTE: Chromatic mode (chroma-driven wave_color) is intentionally
	// DISABLED for K1.node1. Original Emotiscope/Sensory Bridge logic used
	// params.custom_param_1 >= 0.5f to enable chroma, but on K1 the owner
	// wants the non-chromatic, VU/energy-driven variant only. To re-enable
	// chromatic mode in future, restore the original condition:
	//   bool chromatic_mode = (params.custom_param_1 >= 0.5f);
	// and ensure chromagram-driven behavior is validated on real content.
	bool chromatic_mode = false;

	if (AUDIO_IS_AVAILABLE()) {
		// Sensory Bridge parity path:
		// - Build an HSV-summed color from chromagram^2 scaled by 1/6 share
		// - For non-chromatic mode, derive injection brightness from the resulting V
		const float energy_gate = fminf(1.0f, (AUDIO_VU * 0.7f) + (AUDIO_NOVELTY * 0.4f));
		const float share = 1.0f / 6.0f;
		CRGBF sum_color = {0.0f, 0.0f, 0.0f};
		for (int i = 0; i < 12; ++i) {
			float prog = (float)i / 12.0f;
			float bin = clip_float(AUDIO_CHROMAGRAM[i]);
			bin = clip_float(bin * bin);
			bin *= (0.25f + energy_gate * 0.75f);
			float v = clip_float(bin * share);
			CRGBF add = hsv_enhanced(prog, 1.0f, v);
			sum_color.r += add.r; sum_color.g += add.g; sum_color.b += add.b;
		}
		sum_color.r = fminf(1.0f, sum_color.r);
		sum_color.g = fminf(1.0f, sum_color.g);
		sum_color.b = fminf(1.0f, sum_color.b);
		// Legacy square-iter shaping (approx 1 iteration)
		sum_color.r *= sum_color.r;
		sum_color.g *= sum_color.g;
		sum_color.b *= sum_color.b;

		if (chromatic_mode) {
			wave_color = sum_color;
		} else {
			// Derive brightness from V channel of summed color
			HSVF hsv_sum = rgb_to_hsv(sum_color);
			brightness_accum = clip_float(hsv_sum.v);
		}
	}
	else if (chromatic_mode) {
		wave_color = color_from_palette(params.palette_id, 0.0f, 0.05f);
	}
		else {
			brightness_accum = 0.05f;
		}

	if (!chromatic_mode) {
		float base_progress = clip_float(params.color);
		wave_color = color_from_palette(params.palette_id, base_progress, clip_float(brightness_accum));
	}
	else {
		wave_color.r = std::min(1.0f, wave_color.r);
		wave_color.g = std::min(1.0f, wave_color.g);
		wave_color.b = std::min(1.0f, wave_color.b);

		float square_mix = clip_float(params.custom_param_2);
		if (square_mix > 0.0f) {
			wave_color.r = wave_color.r * (1.0f - square_mix) + (wave_color.r * wave_color.r) * square_mix;
			wave_color.g = wave_color.g * (1.0f - square_mix) + (wave_color.g * wave_color.g) * square_mix;
			wave_color.b = wave_color.b * (1.0f - square_mix) + (wave_color.b * wave_color.b) * square_mix;
		}
	}

	wave_color = force_saturation(wave_color, params.saturation);
	HSVF wave_hsv = rgb_to_hsv(wave_color);
	float hue_offset = chromatic_mode ? wave_hsv.h : 0.0f;

	int center = NUM_LEDS >> 1;
	float conf_inject = fminf(1.0f, (AUDIO_VU * 0.9f) + (AUDIO_NOVELTY * 0.5f));
	conf_inject = fmaxf(conf_inject, 0.06f);
	float boost_mirror = 1.0f + fmaxf(0.0f, fminf(1.0f, params.custom_param_3)) * 1.0f;
	conf_inject *= boost_mirror;
	bloom_buffer[ch_idx][center - 1].r += wave_color.r * conf_inject;
	bloom_buffer[ch_idx][center - 1].g += wave_color.g * conf_inject;
	bloom_buffer[ch_idx][center - 1].b += wave_color.b * conf_inject;
	bloom_buffer[ch_idx][center].r += wave_color.r * conf_inject;
	bloom_buffer[ch_idx][center].g += wave_color.g * conf_inject;
	bloom_buffer[ch_idx][center].b += wave_color.b * conf_inject;

	std::memcpy(bloom_buffer_prev[ch_idx], bloom_buffer[ch_idx], sizeof(CRGBF) * NUM_LEDS);

	int fade_span = NUM_LEDS >> 2;
	for (int i = 0; i < fade_span; ++i) {
		float prog = static_cast<float>(i) / static_cast<float>(fade_span);
		float atten = prog * prog;
		int idx = NUM_LEDS - 1 - i;
		bloom_buffer[ch_idx][idx].r *= atten;
		bloom_buffer[ch_idx][idx].g *= atten;
		bloom_buffer[ch_idx][idx].b *= atten;
	}

	for (int i = 0; i < center; ++i) {
		bloom_buffer[ch_idx][i] = bloom_buffer[ch_idx][(NUM_LEDS - 1) - i];
	}

	int half_leds = center;
	for (int i = 0; i < NUM_LEDS; ++i) {
		int mirrored_idx = (i < center) ? (center - 1 - i) : (i - center);
		float radial = (half_leds > 1)
			? static_cast<float>(mirrored_idx) / static_cast<float>(half_leds - 1)
			: 0.0f;

		float palette_progress = radial;
		if (chromatic_mode) {
			palette_progress = fmodf(radial + hue_offset, 1.0f);
			if (palette_progress < 0.0f) {
				palette_progress += 1.0f;
			}
		}

		HSVF px_hsv = rgb_to_hsv(bloom_buffer[ch_idx][i]);
		float px_brightness = clip_float(px_hsv.v);

		CRGBF palette_color = color_from_palette(
			params.palette_id,
			palette_progress,
			px_brightness
		);

		leds[i] = palette_color;
	}

	// Debug trace: summarize chroma-driven wave energy periodically
	static uint32_t last_log_ms_mirror = 0;
	uint32_t now_ms_mirror = millis();
	bool debug_enabled_mirror = audio_debug_enabled || tempo_debug_enabled;
	if (debug_enabled_mirror && (now_ms_mirror - last_log_ms_mirror) > 500) {
		last_log_ms_mirror = now_ms_mirror;
		LOG_DEBUG(TAG_GPU,
		          "[BLOOM_MIRROR] avail=%d chromatic=%d vu=%.3f nov=%.3f brightness_acc=%.3f",
		          (int)AUDIO_IS_AVAILABLE(),
		          (int)chromatic_mode,
		          AUDIO_VU,
		          AUDIO_NOVELTY,
		          brightness_accum);
	}

	apply_background_overlay(context);

    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_VU
    #undef AUDIO_NOVELTY
    #undef AUDIO_CHROMAGRAM
}

// Exact Snapwave implementation (center-origin correct)
// Ported directly from K1.reinvented generated_patterns.h (half-buffer, tempo
// confidence beat gate, dominant spectrum accent) with brightness handled in
// the global color pipeline rather than per-pixel.
inline void draw_snapwave(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    const AudioDataSnapshot& audio = context.audio_snapshot;

    // Macros aligned with pattern_audio_interface.h semantics
    #define AUDIO_IS_AVAILABLE()     (audio.payload.is_valid)
    #define AUDIO_AGE_MS()           ((uint32_t)((esp_timer_get_time() - audio.payload.timestamp_us) / 1000))
    #define AUDIO_SPECTRUM           (audio.payload.spectrogram)
    #define AUDIO_TEMPO_CONFIDENCE   (audio.payload.tempo_confidence)

    const bool audio_fresh = AUDIO_IS_AVAILABLE() && (AUDIO_AGE_MS() <= 75);

    // --- SETUP: Half-array buffer (index 0 = center, increases away from center)
    static CRGBF snapwave_buffer[NUM_LEDS / 2] = {};
    const int half_leds = NUM_LEDS / 2;

    // --- Phase 1: Fade existing trails ---
    const float DECAY_FACTOR = 0.92f;
    for (int i = 0; i < half_leds; i++) {
        snapwave_buffer[i].r *= DECAY_FACTOR;
        snapwave_buffer[i].g *= DECAY_FACTOR;
        snapwave_buffer[i].b *= DECAY_FACTOR;
    }

    // --- Phase 2: Smooth Outward Propagation (center-origin correct) ---
    for (int i = half_leds - 1; i > 0; i--) {
        snapwave_buffer[i].r = snapwave_buffer[i - 1].r * 0.99f + snapwave_buffer[i].r * 0.01f;
        snapwave_buffer[i].g = snapwave_buffer[i - 1].g * 0.99f + snapwave_buffer[i].g * 0.01f;
        snapwave_buffer[i].b = snapwave_buffer[i - 1].b * 0.99f + snapwave_buffer[i].b * 0.01f;
    }

    static float last_confidence = 0.0f;
    const float BEAT_THRESHOLD = 0.02f;   // lower threshold to fire on modest confidence rises
    const float MIN_CONF = 0.08f;         // minimum absolute confidence to avoid noise
    const float MIN_VU = 0.06f;           // guard against silence/noise triggering beats

    if (audio_fresh) {
        // --- Phase 3: Beat Detection & Center Flash (inject at center only) ---
        float beat_strength = AUDIO_TEMPO_CONFIDENCE - last_confidence;
        bool beat_detected = (beat_strength > BEAT_THRESHOLD) &&
                             (AUDIO_TEMPO_CONFIDENCE > MIN_CONF) &&
                             (audio.payload.vu_level > MIN_VU);
        // Decay confidence memory slightly to keep sensitivity without runaway
        last_confidence = AUDIO_TEMPO_CONFIDENCE * 0.9f;

        if (beat_detected) {
            float beat_brightness = fminf(1.0f, beat_strength * 5.0f);
            CRGBF beat_color = color_from_palette(
                params.palette_id,
                clip_float(params.color),
                beat_brightness
            );

            // Inject beat energy at center only (half-buffer index 0)
            if (half_leds > 0) {
                snapwave_buffer[0] = beat_color;
            }
        }

        // --- Phase 4: Dominant Frequency Accent (geometric position) ---
        // CRITICAL: Use chromagram (12 musical notes) not spectrogram (64 bins)
        // The spectrogram has 64 bins, but we need 12 musical note classes
        uint8_t dominant_bin = 0;
        float max_magnitude = 0.0f;

        // Use chromagram for musical note detection (12 bins: C-B)
        const float* chromagram = audio.payload.chromagram;
        for (uint8_t i = 0; i < 12; i++) {
            float bin_value = chromagram[i];
            if (bin_value > max_magnitude) {
                max_magnitude = bin_value;
                dominant_bin = i;
            }
        }

        if (max_magnitude > 0.1f) {
            float position_in_half_array = clip_float((dominant_bin / 12.0f) * 0.8f);
            int accent_idx = (int)(position_in_half_array * (half_leds - 1));

            CRGBF accent_color = color_from_palette(
                params.palette_id,
                clip_float(params.color + (dominant_bin / 12.0f) * 0.4f),
                max_magnitude * 0.6f
            );

            if (accent_idx >= 0 && accent_idx < half_leds) {
                snapwave_buffer[accent_idx] = accent_color;
            }
        }

        // Debug trace only when fresh audio drives the visuals
        static uint32_t last_log_ms_snap = 0;
        uint32_t now_ms_snap = millis();
        bool debug_enabled_snap = audio_debug_enabled || tempo_debug_enabled;
        if (debug_enabled_snap && (now_ms_snap - last_log_ms_snap) > 500) {
            last_log_ms_snap = now_ms_snap;
            LOG_DEBUG(TAG_GPU,
                      "[SNAPWAVE] conf=%.3f d_conf=%.3f dom_bin=%u dom_mag=%.3f",
                      AUDIO_TEMPO_CONFIDENCE,
                      beat_strength,
                      (unsigned)dominant_bin,
                      max_magnitude);
        }
    } else {
        // Without fresh audio, decay confidence and render a deterministic idle wave.
        // CRITICAL: Blend idle animation with decaying buffer instead of replacing
        // This preserves the trail effect while providing visual feedback
        last_confidence *= 0.90f;
        float idle_phase = time * (0.2f + params.speed * 0.4f);
        float hue_base = clip_float(params.color);
        for (int i = 0; i < half_leds; ++i) {
            float radial = (half_leds > 1) ? ((float)i / (float)(half_leds - 1)) : 0.0f;
            float wave = 0.5f + 0.5f * sinf(idle_phase + radial * 6.28318530718f);
            float brightness = clip_float(0.1f + wave * 0.6f);
            float hue = clip_float(hue_base + radial * params.color_range);
            CRGBF idle_color = color_from_palette(params.palette_id, hue, brightness * params.saturation);
            
            // Blend idle color with decaying buffer (30% idle, 70% decayed trail)
            float blend = 0.3f;
            float blend_inv = 1.0f - blend;
            snapwave_buffer[i].r = idle_color.r * blend + snapwave_buffer[i].r * blend_inv;
            snapwave_buffer[i].g = idle_color.g * blend + snapwave_buffer[i].g * blend_inv;
            snapwave_buffer[i].b = idle_color.b * blend + snapwave_buffer[i].b * blend_inv;
        }
    }

    // --- Phase 5: Mandatory mirroring (center-origin symmetry axiom) ---
    int center = NUM_LEDS / 2;
    for (int i = 0; i < center; i++) {
        leds[center - 1 - i] = snapwave_buffer[i];
        leds[center + i] = snapwave_buffer[i];
    }

    apply_background_overlay(context);

    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_AGE_MS
    #undef AUDIO_SPECTRUM
    #undef AUDIO_TEMPO_CONFIDENCE
}

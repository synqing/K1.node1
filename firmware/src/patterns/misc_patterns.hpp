// ---------------------------------------------------------------------------
// Misc Patterns
//
// Audio snapshot fields used across this module:
//   - vu_level, novelty_curve, chromagram[12], spectrogram_smooth[NUM_FREQS]
// Helpers relied on:
//   - apply_mirror_mode (center-origin symmetry)
//   - interpolate / response_sqrt from emotiscope_helpers.h
//
// IMPORTANT: These patterns must only use the provided AudioDataSnapshot from
// PatternRenderContext. Do not call get_audio_snapshot() here – doing so
// breaks the single-snapshot-per-frame invariant enforced by the audio
// seqlock, and has caused hard-to-reproduce race regressions before.
// ---------------------------------------------------------------------------

#pragma once

#include "pattern_render_context.h"
#include "palettes.h"
#include "emotiscope_helpers.h"
#include "logging/logger.h"
#include "pattern_helpers.h"
#include "led_driver.h"

#define MAX_PULSE_WAVES 6

typedef struct {
	float position;      // 0.0-1.0 normalized position from center
	float speed;         // LEDs per frame (normalized units / sec)
	float hue;           // Color from dominant chroma note
	float brightness;    // Initial amplitude from beat strength
	uint16_t age;        // Frames since spawned
	bool active;         // Is this wave active?
} pulse_wave;

static pulse_wave pulse_waves[MAX_PULSE_WAVES];

// Helper: get dominant chromatic note (highest energy in chromagram)
// NOTE: This helper intentionally operates on the caller's snapshot rather
// than calling get_audio_snapshot() itself. The single-snapshot-per-frame
// rule prevents races between the audio producer and GPU consumer.
inline float get_dominant_chroma_hue(const AudioDataSnapshot& audio) {
	if (!audio.payload.is_valid) {
		return 0.0f;  // Default to C if no audio available
	}

	float max_chroma = 0.0f;
	uint16_t max_index = 0;

	for (uint16_t i = 0; i < 12; i++) {
		if (audio.payload.chromagram[i] > max_chroma) {
			max_chroma = audio.payload.chromagram[i];
			max_index = i;
		}
	}

	// Map chromagram index (0-11) to hue (0.0-1.0)
	return (float)max_index / 12.0f;
}

inline void draw_pulse(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    (void)context.num_leds;  // using NUM_LEDS macro instead
    const AudioDataSnapshot& audio = context.audio_snapshot;
    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
    #define AUDIO_AGE_MS() ((uint32_t)((esp_timer_get_time() - audio.payload.timestamp_us) / 1000))
    #define AUDIO_VU (audio.payload.vu_level)
    #define AUDIO_NOVELTY (audio.payload.novelty_curve)
    #define AUDIO_KICK() get_audio_band_energy(audio, KICK_START, KICK_END)

    // Frame-rate independent delta time
    static float last_time_pulse = 0.0f;
    float dt_pulse = time - last_time_pulse;
    if (dt_pulse < 0.0f) dt_pulse = 0.0f;
    if (dt_pulse > 0.05f) dt_pulse = 0.05f; // clamp large jumps
    last_time_pulse = time;

	// Diagnostic logging (once per second)
	static uint32_t last_diagnostic = 0;
	uint32_t now = millis();
	#define AUDIO_TEMPO_CONFIDENCE (audio.payload.tempo_confidence)
	if (now - last_diagnostic > 1000) {
		last_diagnostic = now;
		LOG_DEBUG(TAG_GPU, "[PULSE] audio_available=%d, tempo_confidence=%.2f, brightness=%.2f, speed=%.2f",
			(int)AUDIO_IS_AVAILABLE(), AUDIO_TEMPO_CONFIDENCE, params.brightness, params.speed);
	}
	#undef AUDIO_TEMPO_CONFIDENCE

	// Fallback to ambient if no audio
	if (!AUDIO_IS_AVAILABLE()) {
		const int half_leds = NUM_LEDS >> 1;
		float idle_phase = time * (0.2f + params.speed * 0.5f);
		float breathe = 0.4f + 0.4f * sinf(idle_phase * 6.28318530718f);
		float width = 0.12f + 0.1f * clip_float(params.softness);
		for (int i = 0; i < half_leds; ++i) {
			float radial = (half_leds > 1) ? ((float)i / (float)(half_leds - 1)) : 0.0f;
			float distance = radial;
			float gaussian = expf(-(distance * distance) / (2.0f * width * width));
			float brightness = clip_float((0.1f + breathe * 0.5f) * gaussian);
			float hue = clip_float(params.color + radial * params.color_range);
			CRGBF color = color_from_palette(params.palette_id, hue, brightness * params.saturation);

			int left_index = (half_leds - 1) - i;
			int right_index = half_leds + i;
			leds[left_index] = color;
			leds[right_index] = color;
		}
		apply_background_overlay(context);
		return;
	}

	// Beat detection and wave spawning (RESTORED: tempo-confidence based)
	// Legacy: Uses AUDIO_TEMPO_CONFIDENCE for proper beat-synchronized waves
	const float beat_threshold = 0.3f;
	#define AUDIO_TEMPO_CONFIDENCE (audio.payload.tempo_confidence)
    if (AUDIO_TEMPO_CONFIDENCE > beat_threshold) {
		// Spawn new wave on beat
		for (uint16_t i = 0; i < MAX_PULSE_WAVES; i++) {
			if (!pulse_waves[i].active) {
				pulse_waves[i].position = 0.0f;
                // Speed expressed as normalized units per second (formerly per frame)
                pulse_waves[i].speed = (0.25f + params.speed * 0.75f);
				pulse_waves[i].hue = get_dominant_chroma_hue(audio);
				pulse_waves[i].brightness = sqrtf(AUDIO_TEMPO_CONFIDENCE);
				pulse_waves[i].age = 0;
				pulse_waves[i].active = true;
				break; // Only spawn one wave per frame
			}
		}
	}

	// Clear LED buffer
	for (int i = 0; i < NUM_LEDS; i++) {
		leds[i] = CRGBF(0.0f, 0.0f, 0.0f);
	}

	// Update and render all active waves
	float decay_factor = 0.02f + (params.softness * 0.03f);
	float base_width = 0.08f;
	float width_growth = 0.05f;

	for (uint16_t w = 0; w < MAX_PULSE_WAVES; w++) {
		if (!pulse_waves[w].active) continue;

        // Update wave position (frame-rate independent)
        pulse_waves[w].position += pulse_waves[w].speed * dt_pulse;
		pulse_waves[w].age++;

		// Deactivate if wave traveled past LEDs
		if (pulse_waves[w].position > 1.5f) {
			pulse_waves[w].active = false;
			continue;
		}

		// Render wave as Gaussian bell curve
		float decay = expf(-(float)pulse_waves[w].age * decay_factor);
		float wave_width = base_width + width_growth * pulse_waves[w].age;

		for (int i = 0; i < (NUM_LEDS >> 1); i++) {
			float led_progress = LED_PROGRESS(i);

			// Gaussian bell curve centered at wave position
			float distance = fabsf(led_progress - pulse_waves[w].position);
			float gaussian = expf(-(distance * distance) / (2.0f * wave_width * wave_width));

			// Combine brightness with decay and age-based audio decay
			float age_ms = (float)AUDIO_AGE_MS();
			float age_factor = 1.0f - fminf(age_ms, 250.0f) / 250.0f;
			age_factor = fmaxf(0.0f, age_factor);
			float intensity = pulse_waves[w].brightness * gaussian * decay * age_factor;
			intensity = fmaxf(0.0f, fminf(1.0f, intensity));

			// Use palette system directly from web UI selection
			CRGBF color = color_from_palette(params.palette_id, pulse_waves[w].hue, intensity);

			// Additive blending for overlapping waves
			leds[i].r = fmaxf(0.0f, fminf(1.0f, leds[i].r + color.r * intensity));
			leds[i].g = fmaxf(0.0f, fminf(1.0f, leds[i].g + color.g * intensity));
			leds[i].b = fmaxf(0.0f, fminf(1.0f, leds[i].b + color.b * intensity));
		}
	}

	apply_mirror_mode(leds, true);

	// Master brightness applied in color pipeline

    apply_background_overlay(context);
    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_AGE_MS
    #undef AUDIO_VU
    #undef AUDIO_NOVELTY
    #undef AUDIO_KICK
    #undef AUDIO_TEMPO_CONFIDENCE
}

// Static buffers for Perlin noise generation
static float beat_perlin_noise_array[NUM_LEDS >> 2];  // 32 floats for 128 LEDs
static float beat_perlin_position_x = 0.0f;
static float beat_perlin_position_y = 0.0f;

// Simple hash function for Perlin-like noise
static inline uint32_t hash_ui(uint32_t x, uint32_t seed) {
	const uint32_t m = 0x5bd1e995U;
	uint32_t hash = seed;
	uint32_t k = x;
	k *= m;
	k ^= k >> 24;
	k *= m;
	hash *= m;
	hash ^= k;
	hash ^= hash >> 13;
	hash *= m;
	hash ^= hash >> 15;
	return hash;
}

// Basic Perlin-like noise value
static inline float perlin_noise_simple_2d(float x, float y, uint32_t seed) {
	// Simple 2D noise using hashing and interpolation
	int xi = (int)floorf(x);
	int yi = (int)floorf(y);
	float xf = x - xi;
	float yf = y - yi;

	// Smooth interpolation curve
	float u = xf * xf * (3.0f - 2.0f * xf);
	float v = yf * yf * (3.0f - 2.0f * yf);

	// Hash four corners
	float n00 = (float)(hash_ui(xi + (yi << 16), seed) & 0x7FFFFFFF) / 1073741824.0f;
	float n10 = (float)(hash_ui((xi + 1) + (yi << 16), seed) & 0x7FFFFFFF) / 1073741824.0f;
	float n01 = (float)(hash_ui(xi + ((yi + 1) << 16), seed) & 0x7FFFFFFF) / 1073741824.0f;
	float n11 = (float)(hash_ui((xi + 1) + ((yi + 1) << 16), seed) & 0x7FFFFFFF) / 1073741824.0f;

	// Bilinear interpolation
	float nx0 = n00 + u * (n10 - n00);
	float nx1 = n01 + u * (n11 - n01);
	return nx0 + v * (nx1 - nx0);
}

inline void draw_perlin(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    (void)context.num_leds;  // using NUM_LEDS macro instead
    const AudioDataSnapshot& audio = context.audio_snapshot;
    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
    #define AUDIO_VU (audio.payload.vu_level)

    // CRITICAL: Only proceed with audio-reactive rendering if audio is available
    if (!AUDIO_IS_AVAILABLE()) {
        // Fallback: gentle time-based flow without audio
        for (int i = 0; i < NUM_LEDS; i++) {
            float hue = fmodf((float)i / NUM_LEDS + time * 0.05f * params.speed, 1.0f);
            CRGBF color = color_from_palette(params.palette_id, hue, 0.4f);
            leds[i] = color * params.saturation;
        }
        apply_mirror_mode(leds, true);
        apply_background_overlay(context);
        return;
    }

    // Update Perlin noise position with time
    beat_perlin_position_x = 0.0f;  // Fixed X
    // Audio-driven momentum (Emotiscope-inspired): vu^4 controls flow speed
    {
        // Frame-rate independent delta time
        static float last_time_perlin = 0.0f;
        float dt_perlin = time - last_time_perlin;
        if (dt_perlin < 0.0f) dt_perlin = 0.0f;
        if (dt_perlin > 0.05f) dt_perlin = 0.05f;
        last_time_perlin = time;

        float vu = AUDIO_VU;
        // Convert previous per-frame constants to per-second rates (≈120 FPS baseline)
        float momentum_per_sec = (0.0008f + 0.004f * params.speed) * 120.0f;
        momentum_per_sec *= (0.2f + powf(vu, 4.0f) * 0.8f);
        beat_perlin_position_y += momentum_per_sec * dt_perlin;
    }

	// Generate Perlin noise for downsampled positions (optimized)
	const uint16_t downsample_count = NUM_LEDS >> 2;
	const float inv_downsample_count = 1.0f / (float)downsample_count;
	
	for (uint16_t i = 0; i < downsample_count; i++) {
		const float pos_progress = (float)i * inv_downsample_count;
		const float noise_x = beat_perlin_position_x + pos_progress * 2.0f;
		const float noise_y = beat_perlin_position_y;

		// Simplified single-octave Perlin for better performance
		// Multi-octave was expensive - single octave still looks good
		const float value = perlin_noise_simple_2d(noise_x * 2.0f, noise_y * 2.0f, 0x578437adU);

		// Normalize to [0, 1] with clamping
		float normalized = (value + 1.0f) * 0.5f;
		beat_perlin_noise_array[i] = (normalized < 0.0f) ? 0.0f : (normalized > 1.0f) ? 1.0f : normalized;
	}

	// Render Perlin noise field as LEDs
	for (int i = 0; i < NUM_LEDS; i++) {
		float noise_value = beat_perlin_noise_array[i >> 2];  // Sample from downsampled array

		// Use noise as hue, fixed saturation and brightness
		float hue = fmodf(noise_value * 0.66f + time * 0.1f * params.speed, 1.0f);
		float brightness = 0.25f + noise_value * 0.5f;  // 25-75% brightness

		CRGBF color = color_from_palette(params.palette_id, hue, brightness);

		leds[i].r = color.r * params.saturation;
		leds[i].g = color.g * params.saturation;
		leds[i].b = color.b * params.saturation;
	}

	apply_mirror_mode(leds, true);

    apply_background_overlay(context);
    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_VU
}

// Static buffers for startup_intro pattern (deterministic, non-audio-reactive)
static CRGBF startup_intro_image[NUM_LEDS];
static CRGBF startup_intro_image_prev[NUM_LEDS];
static float startup_intro_angle = 0.0f;

static inline float fast_gaussian(float exponent) {
    // Clamp to safe range; for large x, result is effectively 0
    if (exponent > 10.0f) return 0.0f;
    // Rational approximation: exp(-x) ≈ 1 / (1 + x + x²/2)
    // Coefficients chosen for accuracy near peak (x=0) and graceful falloff
    float denom = 1.0f + exponent + exponent * exponent * 0.5f;
    return 1.0f / denom;
}

inline void draw_startup_intro(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    (void)context.num_leds;  // using NUM_LEDS macro instead
    // Frame-rate independent delta time
    static float last_time_si = 0.0f;
    float dt_si = time - last_time_si;
    if (dt_si < 0.0f) dt_si = 0.0f;
    if (dt_si > 0.05f) dt_si = 0.05f; // clamp to avoid large jumps
    last_time_si = time;

    // Diagnostic logging (once per second)
    static uint32_t last_diagnostic_si = 0;
    uint32_t now = millis();
    if (now - last_diagnostic_si > 1000) {
        last_diagnostic_si = now;
        LOG_DEBUG(TAG_GPU, "[STARTUP_INTRO] brightness=%.2f, speed=%.2f, flow=%.2f, width=%.2f, trail=%.2f",
            params.brightness, params.speed, params.custom_param_2, params.custom_param_1, params.softness);
    }

    // ========================================================================
    // CLEAR BUFFER (CRITICAL: prevents accumulation/stuttering)
    // ========================================================================
    for (int i = 0; i < NUM_LEDS; i++) {
        startup_intro_image[i] = CRGBF(0.0f, 0.0f, 0.0f);
    }

    // ========================================================================
    // ANIMATION PARAMETERS (EXPANDED RANGES FOR VISUAL IMPACT)
    // ========================================================================
    // angle_speed: controls how fast the dot oscillates (rad/sec)
    // EXPANDED: speed 0.0 => 0.01 rad/s (~10 min period), 1.0 => 2.0 rad/s (~3 sec period)
    // This gives 200x range, making speed slider HIGHLY responsive
    float angle_speed = 0.01f + (1.99f * fmaxf(0.0f, fminf(1.0f, params.speed)));
    startup_intro_angle += angle_speed * dt_si;

    // position: center position of the glowing dot
    // EXPANDED: custom_param_2 (flow): 0.0 = no movement (stuck at center), 1.0 = full strip width swing
    // Range: 0.0 to 1.0 amplitude (was 0.25 to 1.0)
    float position_amplitude = fmaxf(0.0f, fminf(1.0f, params.custom_param_2));
    // FIX: Map sinf output from [-1, +1] to [0, 1] normalized range (prevents negative position causing edge artifacts)
    float position = 0.5f * (1.0f + position_amplitude * sinf(startup_intro_angle));

    // ========================================================================
    // TRAIL PERSISTENCE (Motion Blur Effect) - EXPANDED RANGE
    // ========================================================================
    // softness (Trail): controls how long the trailing glow persists
    // EXPANDED: softness 0.0 => decay=0.30 (sharp, 1-2 frame trail)
    //           softness 1.0 => decay=0.98 (ghosting, 50+ frame trail)
    // This gives 3x range at low end, making trail slider OBVIOUS
    float decay = 0.30f + (0.68f * fmaxf(0.0f, fminf(1.0f, params.softness)));
    draw_sprite(startup_intro_image, startup_intro_image_prev, NUM_LEDS, NUM_LEDS, position, decay);

    // ========================================================================
    // GAUSSIAN BRIGHTNESS (Glowing Dot Effect) - EXPANDED RANGE
    // ========================================================================
    // custom_param_1 (width): controls Gaussian spread
    // EXPANDED: 0.0 => tiny pinpoint (sigma=0.01), 1.0 => wide bloom (sigma=0.25)
    // This gives 25x range, making width slider SIGNIFICANT
    float gaussian_width = 0.01f + (0.24f * fmaxf(0.0f, fminf(1.0f, params.custom_param_1)));

    // Pre-calculate Gaussian denominator to avoid repeated division
    float sigma_sq_2 = 2.0f * gaussian_width * gaussian_width;
    float sigma_inv_sq = 1.0f / sigma_sq_2;

    // ========================================================================
    // FUSED LOOP: Render + Clamp + Output + Save (Single Pass)
    // Replaces 5 separate loops with 1 loop = ~40% CPU savings
    // ========================================================================
    for (int i = 0; i < NUM_LEDS; i++) {
        float led_pos = LED_PROGRESS(i);
        float distance = fabsf(led_pos - position);

        // Gaussian envelope: fast polynomial instead of expf()
        // Argument: (distance²) / (2*sigma²)
        float exponent = (distance * distance) * sigma_inv_sq;
        float brightness = fast_gaussian(exponent);  // ~1-2 cycles vs 50-100 cycles
        brightness = fmaxf(0.0f, fminf(1.0f, brightness));

        // Use palette system for color
        CRGBF color = color_from_palette(params.palette_id, led_pos, brightness * 0.5f);

        // Blend with persistence (from draw_sprite trail)
        float blended_r = startup_intro_image[i].r + color.r * brightness;
        float blended_g = startup_intro_image[i].g + color.g * brightness;
        float blended_b = startup_intro_image[i].b + color.b * brightness;

        // Clamp and output in same pass
        blended_r = fmaxf(0.0f, fminf(1.0f, blended_r));
        blended_g = fmaxf(0.0f, fminf(1.0f, blended_g));
        blended_b = fmaxf(0.0f, fminf(1.0f, blended_b));

        // Write to LED output (master brightness applied in color pipeline)
        leds[i].r = blended_r;
        leds[i].g = blended_g;
        leds[i].b = blended_b;

        // CRITICAL: Save blended output (not raw buffer) for next frame's trail
        // This preserves the visual persistence across frames
        startup_intro_image_prev[i].r = blended_r;
        startup_intro_image_prev[i].g = blended_g;
        startup_intro_image_prev[i].b = blended_b;
    }

    apply_mirror_mode(startup_intro_image_prev, true);
    apply_mirror_mode(leds, true);
    apply_background_overlay(context);
}

// ============================================================================
// EMOTISCOPE HELPER FUNCTIONS - Implementation
// ============================================================================

#include "emotiscope_helpers.h"

#include "audio/goertzel.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstring>

namespace {

constexpr std::size_t kMaxFxDots = 192;

struct FxDotState {
	float position = 0.5f;
	bool initialized = false;
};

std::array<FxDotState, kMaxFxDots> g_fx_dots{};

inline std::size_t resolve_dot_index(uint16_t slot) {
	if (g_fx_dots.empty()) {
		return 0;
	}
	return std::min<std::size_t>(slot, g_fx_dots.size() - 1);
}

inline void draw_line(CRGBF* layer, float start_pos, float end_pos, const CRGBF& color, float opacity) {
	if (layer == nullptr || opacity <= 0.0f) {
		return;
	}

	// Pre-calculate LED positions (avoid repeated multiplication)
	const float led_scale = static_cast<float>(NUM_LEDS - 1);
	float x1 = clip_float(start_pos) * led_scale;
	float x2 = clip_float(end_pos) * led_scale;

	if (x1 > x2) {
		std::swap(x1, x2);
	}

	int ix1 = static_cast<int>(x1);
	int ix2 = static_cast<int>(x2 + 0.999f); // Avoid ceil() call
	
	// Pre-calculate coverage factors
	float start_coverage = 1.0f - (x1 - static_cast<float>(ix1));
	float end_coverage = x2 - static_cast<float>(static_cast<int>(x2));

	// Pre-calculate color components scaled by opacity (avoid per-LED multiplication)
	float color_r = color.r * opacity;
	float color_g = color.g * opacity;
	float color_b = color.b * opacity;
	
	bool lighten = !(color.r == 0.0f && color.g == 0.0f && color.b == 0.0f);

	for (int i = ix1; i <= ix2; ++i) {
		if (i < 0 || i >= NUM_LEDS) {
			continue;
		}

		float mix = 1.0f; // Remove expensive sqrt() - use linear blending
		if (i == ix1) {
			mix = start_coverage;
		} else if (i == ix2) {
			mix = end_coverage;
		}

		// Use pre-calculated color components
		float final_r = color_r * mix;
		float final_g = color_g * mix;
		float final_b = color_b * mix;

		if (lighten) {
			layer[i].r += final_r;
			layer[i].g += final_g;
			layer[i].b += final_b;
		} else {
			float inv_mix = 1.0f - mix;
			layer[i].r = layer[i].r * inv_mix + final_r;
			layer[i].g = layer[i].g * inv_mix + final_g;
			layer[i].b = layer[i].b * inv_mix + final_b;
		}
	}
}

}  // namespace

void draw_dot(CRGBF* leds, uint16_t dot_index, CRGBF color, float position, float opacity) {
	if (leds == nullptr) {
		return;
	}

	float clamped_position = clip_float(position);
	opacity = clip_float(opacity);
	if (opacity <= 0.0f) {
		return;
	}

	// Simplified dot rendering - just render at current position without state tracking
	// This eliminates the expensive per-frame state management and memory access
	// For light show patterns, instantaneous dot positioning is sufficient
	
	// Calculate LED index and sub-pixel position
	float led_pos = clamped_position * static_cast<float>(NUM_LEDS - 1);
	int base_led = static_cast<int>(led_pos);
	float frac = led_pos - static_cast<float>(base_led);
	
	// Apply Gaussian-like distribution across 3 LEDs for smooth dot appearance
	const float dot_width = 1.5f; // Dot spans ~1.5 LEDs for smooth appearance
	
	for (int offset = -1; offset <= 1; offset++) {
		int led_idx = base_led + offset;
		if (led_idx >= 0 && led_idx < NUM_LEDS) {
			float distance = std::abs(static_cast<float>(offset) - frac);
			float intensity = std::max(0.0f, 1.0f - (distance / dot_width));
			intensity *= intensity; // Quadratic falloff for smoother appearance
			
			float final_opacity = opacity * intensity;
			if (final_opacity > 0.001f) {
				leds[led_idx].r += color.r * final_opacity;
				leds[led_idx].g += color.g * final_opacity;
				leds[led_idx].b += color.b * final_opacity;
			}
		}
	}
}

float get_color_range_hue(float progress) {
	progress = clip_float(progress);
	return progress * 0.66f;
}

void draw_sprite(CRGBF* target, CRGBF* source, int target_size,
                 int source_size, float position, float alpha) {
	if (target == nullptr || source == nullptr ||
	    target_size <= 0 || source_size <= 0 || alpha <= 0.0f) {
		return;
	}

	float position_whole_f = std::floor(position);
	int position_whole = static_cast<int>(position_whole_f);
	float position_fract = position - position_whole_f;

	for (int i = 0; i < source_size; ++i) {
		int pos_left = i + position_whole;
		int pos_right = pos_left + 1;

		float mix_right = position_fract;
		float mix_left = 1.0f - mix_right;

		if (pos_left >= 0 && pos_left < target_size) {
			target[pos_left].r += source[i].r * mix_left * alpha;
			target[pos_left].g += source[i].g * mix_left * alpha;
			target[pos_left].b += source[i].b * mix_left * alpha;
		}

		if (pos_right >= 0 && pos_right < target_size) {
			target[pos_right].r += source[i].r * mix_right * alpha;
			target[pos_right].g += source[i].g * mix_right * alpha;
			target[pos_right].b += source[i].b * mix_right * alpha;
		}
	}
}

void draw_sprite_float(float* target, const float* source, int target_size,
                       int source_size, float position, float alpha) {
	if (target == nullptr || source == nullptr ||
	    target_size <= 0 || source_size <= 0 || alpha <= 0.0f) {
		return;
	}

	std::memset(target, 0, static_cast<std::size_t>(target_size) * sizeof(float));

	float position_whole_f = std::floor(position);
	int position_whole = static_cast<int>(position_whole_f);
	float position_fract = position - position_whole_f;

	for (int i = 0; i < source_size; ++i) {
		float sample = source[i] * alpha;
		int dst_idx = i + position_whole;

		if (dst_idx >= 0 && dst_idx < target_size) {
			target[dst_idx] += sample * (1.0f - position_fract);
		}

		int dst_idx_right = dst_idx + 1;
		if (dst_idx_right >= 0 && dst_idx_right < target_size) {
			target[dst_idx_right] += sample * position_fract;
		}
	}
}

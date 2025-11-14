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


// === Added implementations for parity utilities ===

float chroma_centroid(const float chroma[12]) {
    if (!chroma) return 0.0f;
    float wsum = 0.0f, isum = 0.0f;
    for (int pc = 0; pc < 12; ++pc) { float v = clip_float(chroma[pc]); wsum += v; isum += v * pc; }
    float c = (wsum > 1e-6f) ? (isum / wsum) : 0.0f;
    return fmaxf(0.0f, fminf(1.0f, c / 11.0f));
}


CRGBF palette_blend(const CRGBF* palette, int n, float t) {
    if (!palette || n <= 0) return CRGBF(0.0f, 0.0f, 0.0f);
    t = fmaxf(0.0f, fminf(1.0f, t));
    float pos = t * (float)(n - 1);
    int idx = (int)pos;
    int idx2 = (idx + 1 < n) ? idx + 1 : idx;
    float frac = pos - (float)idx;
    const CRGBF& a = palette[idx];
    const CRGBF& b = palette[idx2];
    return CRGBF(a.r + (b.r - a.r) * frac,
                 a.g + (b.g - a.g) * frac,
                 a.b + (b.b - a.b) * frac);
}


CRGBF chroma_weighted_color(const float chroma[12], float saturation) {
    static const CRGBF palette12[12] = {
        CRGBF(1.00f, 0.00f, 0.00f), CRGBF(1.00f, 0.50f, 0.00f), CRGBF(1.00f, 0.80f, 0.00f),
        CRGBF(1.00f, 1.00f, 0.00f), CRGBF(0.60f, 1.00f, 0.00f), CRGBF(0.00f, 1.00f, 0.00f),
        CRGBF(0.00f, 1.00f, 0.60f), CRGBF(0.00f, 1.00f, 1.00f), CRGBF(0.00f, 0.60f, 1.00f),
        CRGBF(0.00f, 0.20f, 1.00f), CRGBF(0.40f, 0.00f, 1.00f), CRGBF(0.80f, 0.00f, 1.00f)
    };
    float t = chroma_centroid(chroma);
    CRGBF c = palette_blend(palette12, 12, t);
    saturation = fmaxf(0.0f, fminf(1.0f, saturation));
    // Simple saturation scaling: pull towards grayscale when low saturation
    float gray = (c.r + c.g + c.b) / 3.0f;
    c.r = gray + (c.r - gray) * saturation;
    c.g = gray + (c.g - gray) * saturation;
    c.b = gray + (c.b - gray) * saturation;
    return c;
}


float compute_onset_pulse(float vu_current, float& vu_prev, float decay, float gain) {
    vu_current = clip_float(vu_current);
    float delta = vu_current - vu_prev;
    vu_prev = vu_current;
    float pulse = (delta > 0.0f) ? (delta * gain) : 0.0f;
    // Decay previous pulse waveform externally by multiplying with decay
    return fmaxf(0.0f, pulse);
}


float band_weight(int bin, float bass_treble_balance) {
    // Normalize bin to [0,1] using NUM_FREQS from goertzel.h
    float norm = fmaxf(0.0f, fminf(1.0f, bin / (float)(NUM_FREQS - 1)));
    float balance = fmaxf(-1.0f, fminf(1.0f, bass_treble_balance));
    // Target: -1 favors bass (low bins), +1 favors treble (high bins)
    float target = (balance >= 0.0f) ? norm : (1.0f - norm);
    float mix = fabsf(balance);
    float w = (1.0f - mix) + mix * target; // 1.0 when neutral, towards target when extreme
    return fmaxf(0.0f, fminf(2.0f, w));
}


void apply_eq_curve(float* spectrum, int len, float balance) {
    if (!spectrum || len <= 0) return;
    for (int i = 0; i < len; ++i) {
        spectrum[i] *= band_weight(i, balance);
        spectrum[i] = clip_float(spectrum[i]);
    }
}


#include "stateful_nodes.h"
void adaptive_band_decay(BufferPersistNode& persist, const float* input, int len,
                         float rise_rate, float fall_rate) {
    if (!input || len <= 0) return;
    persist.apply_decay(); // base decay
    for (int i = 0; i < len; ++i) {
        float current = clip_float(input[i]);
        float decayed = persist.read(i);
        if (current > decayed) {
            float upd = decayed + rise_rate * (current - decayed);
            persist.write(i, clip_float(upd));
        } else {
            persist.write(i, clip_float(decayed * fall_rate));
        }
    }
}


void resample_history_to_leds(const float* history, int hist_len, float* out, int leds) {
    if (!history || !out || hist_len <= 0 || leds <= 0) return;
    for (int i = 0; i < leds; ++i) {
        int idx = (i * hist_len) / leds;
        float v = history[idx];
        out[i] = clip_float(0.5f + 0.5f * v);
    }
}

CRGBF hsv_enhanced(float h, float s, float v) {
    h = std::fmod(h, 1.0f);
    if (h < 0.0f) h += 1.0f;
    s = clip_float(s);
    v = clip_float(v);
    if (s < 0.001f) return CRGBF(v, v, v);
    float h_sector = h * 6.0f;
    int sector = static_cast<int>(h_sector);
    float f = h_sector - static_cast<float>(sector);
    float p = v * (1.0f - s);
    float q = v * (1.0f - s * f);
    float t = v * (1.0f - s * (1.0f - f));
    switch (sector % 6) {
        case 0: return CRGBF(v, t, p);
        case 1: return CRGBF(q, v, p);
        case 2: return CRGBF(p, v, t);
        case 3: return CRGBF(p, q, v);
        case 4: return CRGBF(t, p, v);
        case 5: return CRGBF(v, p, q);
        default: return CRGBF(0.0f, 0.0f, 0.0f);
    }
}

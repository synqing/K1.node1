#pragma once

/**
 * K1.node1 Graph Runtime Helpers
 *
 * Provides helper functions for generated pattern code.
 * Emitter generates calls to these functions for each node type.
 *
 * Generated patterns use this header + stateful_nodes.h + parameters.h
 */

#include <cmath>
#include <algorithm>
#include <cstring>
#include "../types.h"  // For CRGBF definition

// ============================================================================
// TYPE DEFINITIONS (match compiler type system)
// ============================================================================
// Note: CRGBF is defined in types.h, included above

typedef struct {
    float values[256];  // Assume NUM_FREQS = 256 (or variable)
} AudioSpectrumBuffer;

typedef struct {
    float values[12];  // 12-point chroma vector
} ChromaVector;

// ============================================================================
// BUFFER OPERATIONS
// ============================================================================

/**
 * Fill entire LED buffer with single color
 */
inline void fill_buffer(CRGBF* out, const CRGBF& color, int num_leds) {
    for (int i = 0; i < num_leds; i++) {
        out[i] = color;
    }
}

/**
 * Box filter blur with configurable radius
 */
inline void blur_buffer(const CRGBF* src, CRGBF* out, int num_leds, int radius = 1) {
    for (int i = 0; i < num_leds; i++) {
        CRGBF sum = {0.0f, 0.0f, 0.0f};
        int count = 0;

        for (int j = -radius; j <= radius; j++) {
            int idx = (i + j + num_leds) % num_leds;  // Wrap at boundaries
            sum.r += src[idx].r;
            sum.g += src[idx].g;
            sum.b += src[idx].b;
            count++;
        }

        out[i].r = sum.r / count;
        out[i].g = sum.g / count;
        out[i].b = sum.b / count;
    }
}

/**
 * Mirror buffer vertically (flip) - creates symmetric reflection
 * For num_leds=160 with center at 79: mirrors left-right symmetrically
 */
inline void mirror_buffer(const CRGBF* src, CRGBF* out, int num_leds) {
    for (int i = 0; i < num_leds; i++) {
        out[i] = src[num_leds - 1 - i];
    }
}

/**
 * Center-origin symmetric copy: renders left half and mirrors to right
 * Only write to half the buffer, then mirror around center point
 * For 160 LEDs: compute 0-79, mirror to 80-159 symmetrically
 */
inline void mirror_buffer_center_origin(const CRGBF* src, CRGBF* out, int num_leds) {
    const int center = num_leds / 2;
    for (int i = 0; i < center; i++) {
        // Left side (from center, going down)
        out[center - 1 - i] = src[i];
        // Right side (from center, going up)
        out[center + i] = src[i];
    }
    // Center LED itself (if odd count, this handles it)
    if (num_leds % 2 == 1) {
        out[center] = src[center];
    }
}

/**
 * Circular shift/rotate buffer
 */
inline void shift_buffer(const CRGBF* src, CRGBF* out, int num_leds, int offset) {
    for (int i = 0; i < num_leds; i++) {
        out[i] = src[(i + offset + num_leds) % num_leds];
    }
}

/**
 * Downsample buffer (sparse visualization)
 */
inline void downsample_buffer(const CRGBF* src, CRGBF* out, int num_leds, int factor) {
    for (int i = 0; i < num_leds; i++) {
        if (i % factor == 0) {
            out[i] = src[i];
        } else {
            out[i] = {0.0f, 0.0f, 0.0f};
        }
    }
}

/**
 * Rasterize dot/peak indicators onto buffer
 */
inline void dot_render(CRGBF* buf, const int* peak_indices, const CRGBF* peak_colors,
                       int num_peaks, int num_leds, const char* blend_mode = "add") {
    for (int i = 0; i < num_peaks; i++) {
        int idx = peak_indices[i];
        if (idx >= 0 && idx < num_leds) {
            const CRGBF& dot = peak_colors[i];

            if (strcmp(blend_mode, "replace") == 0) {
                buf[idx] = dot;
            } else if (strcmp(blend_mode, "add") == 0) {
                buf[idx].r = std::min(1.0f, buf[idx].r + dot.r);
                buf[idx].g = std::min(1.0f, buf[idx].g + dot.g);
                buf[idx].b = std::min(1.0f, buf[idx].b + dot.b);
            } else if (strcmp(blend_mode, "multiply") == 0) {
                buf[idx].r *= dot.r;
                buf[idx].g *= dot.g;
                buf[idx].b *= dot.b;
            }
        }
    }
}

/**
 * Compose/blend two buffers
 */
inline void compose_layers(const CRGBF* base, const CRGBF* overlay, CRGBF* out,
                           int num_leds, const char* blend_mode = "add", float opacity = 1.0f) {
    for (int i = 0; i < num_leds; i++) {
        const CRGBF& o = overlay[i];
        CRGBF blended;

        if (strcmp(blend_mode, "add") == 0) {
            blended.r = std::min(1.0f, base[i].r + o.r * opacity);
            blended.g = std::min(1.0f, base[i].g + o.g * opacity);
            blended.b = std::min(1.0f, base[i].b + o.b * opacity);
        } else if (strcmp(blend_mode, "multiply") == 0) {
            blended.r = base[i].r * o.r;
            blended.g = base[i].g * o.g;
            blended.b = base[i].b * o.b;
        } else if (strcmp(blend_mode, "screen") == 0) {
            blended.r = 1.0f - (1.0f - base[i].r) * (1.0f - o.r);
            blended.g = 1.0f - (1.0f - base[i].g) * (1.0f - o.g);
            blended.b = 1.0f - (1.0f - base[i].b) * (1.0f - o.b);
        } else {
            blended = base[i];  // Default: no blend
        }

        out[i] = blended;
    }
}

// ============================================================================
// COLOR OPERATIONS
// ============================================================================


/**
 * Desaturate to grayscale
 */
inline CRGBF desaturate(const CRGBF& color, const char* mode = "luma") {
    float gray;
    if (strcmp(mode, "luma") == 0) {
        gray = 0.299f * color.r + 0.587f * color.g + 0.114f * color.b;
    } else if (strcmp(mode, "average") == 0) {
        gray = (color.r + color.g + color.b) / 3.0f;
    } else {  // max
        gray = std::max({color.r, color.g, color.b});
    }
    return {gray, gray, gray};
}

/**
 * Clamp helper (compatibility with C++11)
 */
template <typename T>
inline T clamp_val(T value, T min_val, T max_val) {
    return (value < min_val) ? min_val : (value > max_val) ? max_val : value;
}

/**
 * Clamp RGB values to [0, 1]
 */
inline CRGBF clamped_rgb(const CRGBF& color) {
    return {
        clamp_val(color.r, 0.0f, 1.0f),
        clamp_val(color.g, 0.0f, 1.0f),
        clamp_val(color.b, 0.0f, 1.0f)
    };
}

// ============================================================================
// GRADIENT MAP (lookup table)
// ============================================================================

/**
 * Gradient map - map scalar [0,1] to color via palette
 */
inline CRGBF gradient_map(float index, const CRGBF* palette, int palette_size) {
    index = clamp_val(index, 0.0f, 1.0f);
    int idx = (int)(index * (palette_size - 1));
    return palette[idx];
}

// ============================================================================
// FILTER OPERATIONS (Stateful)
// ============================================================================

/**
 * Low-pass IIR filter state update
 */
inline float lowpass_update(float& state, float signal, float alpha) {
    state = alpha * signal + (1.0f - alpha) * state;
    return state;
}

/**
 * Moving average filter state update
 */
inline float moving_average_update(float* ring_buf, int& index, int window_size,
                                   float signal, int num_leds) {
    ring_buf[index] = signal;
    index = (index + 1) % window_size;

    float sum = 0.0f;
    for (int i = 0; i < window_size; i++) {
        sum += ring_buf[i];
    }
    return sum / window_size;
}

// ============================================================================
// AUDIO ANALYSIS (Stubs - firmware implements)
// ============================================================================

/**
 * Compute pitch via autocorrelation (firmware helper)
 */
extern float compute_pitch(const float* spectrum, int num_freqs);

/**
 * Get pitch confidence level
 */
extern float pitch_confidence(const float* spectrum, int num_freqs);

/**
 * Compute 12-point chroma vector
 */
extern void compute_chroma_vector(const float* spectrum, int num_freqs, float* chroma_out);

/**
 * Perlin noise 1D
 */
extern float perlin_noise_1d(float x, uint32_t seed, float scale);

// ============================================================================
// STATE STRUCTURE (for stateful nodes)
// ============================================================================

struct PatternState {
    // Filter states
    float lowpass_states[8];  // Up to 8 LowPass filters

    // Ring buffers for MovingAverage
    float ma_ring_buf[32];
    int ma_index;

    // BufferPersist state
    float persist_buf[256];  // Persistent LED buffer

    // Beat event state
    float beat_prev_envelope;
    uint32_t beat_count;

    // Custom pattern state (if needed)
    float custom_state[64];

    PatternState() : ma_index(0), beat_prev_envelope(0.0f), beat_count(0) {
        memset(lowpass_states, 0, sizeof(lowpass_states));
        memset(ma_ring_buf, 0, sizeof(ma_ring_buf));
        memset(persist_buf, 0, sizeof(persist_buf));
        memset(custom_state, 0, sizeof(custom_state));
    }
};

struct PatternOutput {
    uint8_t leds[160][3];  // NUM_LEDS × RGB bytes (matches hardware)
};

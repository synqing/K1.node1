// ============================================================================
// EMOTISCOPE HELPER FUNCTIONS - Ported from original Emotiscope
// ============================================================================
// These functions enable proper Analog, Metronome, and Hype pattern rendering
// by providing the missing draw_dot() and color mapping functionality
// ============================================================================

#pragma once

#include "types.h"
#include "audio/goertzel.h"  // For clip_float()
#include "led_driver.h"      // For NUM_LEDS (must be after types.h)
#include <cmath>
#include <cstddef>

// Constants from original Emotiscope
#define NUM_RESERVED_DOTS 8

/**
 * Draw a colored dot at a specific position with opacity blending
 * This is the core function missing from K1 that breaks Analog/Metronome/Hype
 * 
 * @param leds - LED array to draw into
 * @param dot_index - Dot slot index (0-7 for reserved dots)
 * @param color - Color of the dot
 * @param position - Position along strip (0.0 = left, 1.0 = right)
 * @param opacity - Brightness/opacity (0.0 = invisible, 1.0 = full)
 */
void draw_dot(CRGBF* leds, uint16_t dot_index, CRGBF color, float position, float opacity);

/**
 * Map a value (0.0-1.0) to a hue across the visible spectrum
 * This replaces Emotiscope's get_color_range_hue() function
 * 
 * @param progress - Input value (0.0-1.0)
 * @return Hue value (0.0-1.0) for HSV color space
 */
float get_color_range_hue(float progress);

/**
 * HSV to RGB conversion optimized for LED strips
 * Enhanced version of the basic hsv() function in generated_patterns.h
 * 
 * @param h - Hue (0.0-1.0)
 * @param s - Saturation (0.0-1.0) 
 * @param v - Value/brightness (0.0-1.0)
 * @return CRGBF color
 */
CRGBF hsv_enhanced(float h, float s, float v);

/**
 * Clamp float value to 0.0-1.0 range
 * Note: Also defined in goertzel.h
 * Using #ifndef to avoid duplicate definition errors
 */
#ifndef CLIP_FLOAT_DEFINED
#define CLIP_FLOAT_DEFINED
inline float clip_float(float value) {
    return fmaxf(0.0f, fminf(1.0f, value));
}
#endif

/**
 * SUB-PIXEL INTERPOLATION - THE MISSING PIECE!
 * Smoothly interpolates between array values for fluid frequency mapping.
 * This fixes the stepping artifacts in spectrum visualization.
 *
 * @param position - Position (0.0-1.0) to sample
 * @param array - Array to interpolate from
 * @param array_size - Size of the array
 * @return Interpolated value
 */
inline float interpolate(float position, const float* array, int array_size) {
    if (array == nullptr || array_size <= 0) {
        return 0.0f;
    }

    if (array_size == 1) {
        return array[0];
    }

    float clamped_pos = clip_float(position);
    float scaled = clamped_pos * static_cast<float>(array_size - 1);

    int index_low = static_cast<int>(std::floor(scaled));
    float frac = scaled - static_cast<float>(index_low);

    if (index_low < 0) {
        index_low = 0;
        frac = 0.0f;
    } else if (index_low >= array_size - 1) {
        index_low = array_size - 1;
        frac = 0.0f;
    }

    int index_high = index_low + 1;
    if (index_high >= array_size) {
        index_high = index_low;
    }

    float left_val = array[index_low];
    float right_val = array[index_high];

    return left_val * (1.0f - frac) + right_val * frac;
}

/**
 * Draw scrolling sprite effect (critical for beat_tunnel pattern)
 * Creates motion layers by scrolling previous frame with decay
 *
 * @param target - Destination LED array
 * @param source - Source LED array (previous frame)
 * @param target_size - Size of target array
 * @param source_size - Size of source array
 * @param position - Scroll position (0.0-1.0)
 * @param decay - Decay factor per frame (0.95 = 5% fade per frame)
 */
void draw_sprite(CRGBF* target, CRGBF* source, int target_size,
                 int source_size, float position, float decay);

void draw_sprite_float(float* target, const float* source, int target_size,
                       int source_size, float position, float decay);

void draw_sprite_float(float* target, const float* source, int target_size,
                       int source_size, float position, float decay);

/**
 * RESPONSE CURVE FUNCTIONS
 * Different curves emphasize different musical characteristics:
 * - sqrt: Enhances quiet frequencies, smooths loud ones (most musical)
 * - square: Emphasizes loud beats, suppresses quiet noise
 * - cube: Extreme emphasis on peaks only
 */
inline float response_sqrt(float x) {
    return sqrtf(clip_float(x));
}

inline float response_square(float x) {
    x = clip_float(x);
    return x * x;
}

inline float response_cube(float x) {
    x = clip_float(x);
    return x * x * x;
}

/**
 * Smooth exponential response (most natural for human perception)
 * Maps linear input to exponential curve matching human loudness perception
 */
inline float response_exp(float x, float exponent = 2.2f) {
    return powf(clip_float(x), exponent);
}

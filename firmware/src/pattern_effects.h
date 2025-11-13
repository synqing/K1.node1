#ifndef PATTERN_EFFECTS_H
#define PATTERN_EFFECTS_H

#include "types.h"
#include <cmath>

// ============================================================================
// RESPONSE CURVES - Audio-to-visual mapping functions
// ============================================================================

/**
 * @brief Quadratic response - Emphasizes mid-range, compresses extremes
 * Used in: octave patterns, dynamic range compression
 * Effect: x^2 makes small values tiny, large values prominent
 */
inline float response_curve_square(float x) {
    x = clip_float(x);
    return x * x;
}

/**
 * @brief Square root response - Decompresses values, emphasizes lows
 * Used in: spectrum, bloom patterns
 * Effect: Makes quiet sounds more visible
 */
inline float response_curve_sqrt(float x) {
    x = clip_float(x);
    return sqrtf(x);
}

/**
 * @brief Fourth root response - Heavy decompression, logarithmic feel
 * Used in: bloom with extreme compression
 * Effect: Makes even quiet sounds visible, natural to human hearing
 */
inline float response_curve_sqrt4(float x) {
    x = clip_float(x);
    float root2 = sqrtf(x);
    return sqrtf(root2);
}

/**
 * @brief Cubic response - Emphasizes peaks even more than square
 * Used in: beat-synced patterns, pulse effects
 * Effect: Very nonlinear, spiky response
 */
inline float response_curve_cubic(float x) {
    x = clip_float(x);
    return x * x * x;
}

/**
 * @brief Logarithmic response - Like human hearing perception
 * Used in: natural reactive patterns
 * Effect: Even quiet sounds visible, dynamic range natural
 */
inline float response_curve_log(float x) {
    x = clip_float(x);
    if (x < 0.001f) return 0.0f;
    return log1pf(x) / log1pf(1.0f);  // Normalized to [0,1]
}

// ============================================================================
// TEMPORAL SMOOTHING - Frame-to-frame blending for persistence
// ============================================================================

/**
 * @brief Exponential moving average - Smooths rapid changes
 * @param current - Current frame value
 * @param previous - Previous frame value
 * @param alpha - Blend factor (0.0=no change, 1.0=instant update, 0.8=slow)
 * Result: (1-alpha)*previous + alpha*current
 */
inline float temporal_smooth(float current, float previous, float alpha) {
    alpha = clip_float(alpha);
    return (1.0f - alpha) * previous + alpha * current;
}

/**
 * @brief Exponential decay - Fades values over time
 * @param current - Current value
 * @param decay - Decay rate (0.95 = fade 5% per frame, 0.9 = fade 10%)
 * Result: current * decay
 */
inline float exponential_decay(float current, float decay) {
    decay = clip_float(decay);
    return current * decay;
}

/**
 * @brief Gaussian blur - Smooth neighbor averaging
 * Used for spatial smoothing within a frame
 * @param values - Array of values to blur
 * @param result - Output array
 * @param count - Array length
 * @param sigma - Blur strength (1.0 = moderate, 2.0 = strong)
 */
inline void gaussian_blur_1d(const float* values, float* result, uint16_t count, float sigma) {
    if (count < 3) {
        memcpy(result, values, count * sizeof(float));
        return;
    }

    sigma = fmaxf(0.1f, sigma);

    for (uint16_t i = 0; i < count; i++) {
        float sum = 0.0f;
        float weight_sum = 0.0f;

        for (int16_t j = -2; j <= 2; j++) {
            int16_t idx = i + j;
            if (idx < 0 || idx >= count) continue;

            float dist_sq = j * j;
            float weight = expf(-dist_sq / (2.0f * sigma * sigma));
            sum += values[idx] * weight;
            weight_sum += weight;
        }

        result[i] = weight_sum > 0.001f ? sum / weight_sum : values[i];
    }
}

// ============================================================================
// COLOR EFFECTS - HSV and brightness manipulation
// ============================================================================

/**
 * @brief Increase saturation of an HSV color
 * @param hsv - Input HSV color
 * @param amount - Saturation boost (0.0=no change, 1.0=full saturation, >1.0=oversaturate)
 */
inline CHSV increase_saturation(CHSV hsv, float amount) {
    amount = fmaxf(0.0f, amount);
    hsv.sat = clip_uint8(static_cast<uint16_t>(hsv.sat) + static_cast<uint16_t>(amount * 255));
    return hsv;
}

/**
 * @brief Logarithmic brightness curve - More natural perception
 * Maps linear 0..1 to perceptual brightness
 * @param brightness - Input brightness (0..1)
 * @return Logarithmically compressed brightness
 */
inline float distort_logarithmic(float brightness) {
    brightness = clip_float(brightness);
    if (brightness < 0.001f) return 0.0f;
    return log1pf(brightness) / log1pf(2.0f);  // log2 compression
}

/**
 * @brief Fade top half - Vignette effect
 * Darkens the top half of the strip in a smooth falloff
 * @param led_index - LED position (0 = bottom, num_leds = top)
 * @param num_leds - Total number of LEDs
 * @param strength - Vignette strength (0.0=no effect, 1.0=half brightness at top)
 */
inline float fade_top_half(uint16_t led_index, uint16_t num_leds, float strength) {
    if (led_index < num_leds / 2) return 1.0f;  // Bottom half unaffected

    float progress = static_cast<float>(led_index - num_leds / 2) / static_cast<float>(num_leds / 2);
    float fade = 1.0f - (progress * strength);
    return fmaxf(0.0f, fade);
}

/**
 * @brief Invert (mirror) for symmetrical patterns
 * Mirrors a position value around center
 * @param position - Original position
 * @param max_position - Maximum position value
 */
inline float mirror_position(float position, float max_position) {
    if (position > max_position / 2.0f) {
        return max_position - position;
    }
    return position;
}

// ============================================================================
// DRAWING PRIMITIVES - Pixel-level drawing functions
// ============================================================================

/**
 * @brief Draw a single LED dot with optional spread
 * @param leds - LED buffer
 * @param num_leds - Buffer size
 * @param position - Center position (0..num_leds-1)
 * @param brightness - Brightness of dot (0..1)
 * @param color - HSV color
 */
inline void draw_dot(CRGBF* leds, uint16_t num_leds, float position, float brightness, CHSV color) {
    if (position < 0 || position >= num_leds) return;

    uint16_t idx = static_cast<uint16_t>(position);
    if (idx < num_leds) {
        CRGBF hsv_rgb = CRGBF(color);
        leds[idx] += CRGBF(
            hsv_rgb.r * brightness,
            hsv_rgb.g * brightness,
            hsv_rgb.b * brightness
        );
    }
}

/**
 * @brief Draw a sprite with Gaussian falloff (float precision)
 * Spreading effect for blooms, trails
 * @param leds - LED buffer
 * @param num_leds - Buffer size
 * @param center - Center position (0..num_leds-1)
 * @param brightness - Peak brightness
 * @param spread - How far to spread (in LEDs)
 * @param color - HSV color
 */
inline void draw_sprite_float(CRGBF* leds, uint16_t num_leds, float center,
                             float brightness, float spread, CHSV color) {
    brightness = clip_float(brightness);
    spread = fmaxf(0.5f, spread);

    CRGBF hsv_rgb = CRGBF(color);
    int16_t center_int = static_cast<int16_t>(center);

    // Gaussian falloff: exp(-(distance/spread)^2)
    for (int16_t i = -3 * static_cast<int16_t>(spread); i <= 3 * static_cast<int16_t>(spread); i++) {
        int16_t idx = center_int + i;
        if (idx < 0 || idx >= num_leds) continue;

        float distance = fabsf(static_cast<float>(i));
        float falloff = expf(-(distance * distance) / (2.0f * spread * spread));
        float alpha = brightness * falloff;

        leds[idx] += CRGBF(
            hsv_rgb.r * alpha,
            hsv_rgb.g * alpha,
            hsv_rgb.b * alpha
        );
    }
}

/**
 * @brief Clear a region of LEDs
 * @param leds - LED buffer
 * @param num_leds - Total LEDs
 * @param start - Start index
 * @param end - End index (exclusive)
 */
inline void clear_leds(CRGBF* leds, uint16_t num_leds, uint16_t start, uint16_t end) {
    start = fmaxf(0, start);
    end = fminf(end, static_cast<uint16_t>(num_leds));
    for (uint16_t i = start; i < end; i++) {
        leds[i] = CRGBF(0, 0, 0);
    }
}

/**
 * @brief Fade all LEDs by a factor
 * @param leds - LED buffer
 * @param num_leds - Total LEDs
 * @param fade_factor - Multiplication factor (0.95 = 5% fade per frame)
 */
inline void fade_all(CRGBF* leds, uint16_t num_leds, float fade_factor) {
    fade_factor = clip_float(fade_factor);
    for (uint16_t i = 0; i < num_leds; i++) {
        leds[i] *= fade_factor;
    }
}

// ============================================================================
// FREQUENCY MAPPING - Audio frequency to LED position
// ============================================================================

/**
 * @brief Map frequency bin to LED position (linear spectrum)
 * @param bin - Frequency bin (0..NUM_FREQS-1)
 * @param num_leds - Total number of LEDs
 * @return LED position (0..num_leds-1)
 */
inline float bin_to_led_linear(uint16_t bin, uint16_t num_leds) {
    return (static_cast<float>(bin) / NUM_FREQS) * num_leds;
}

/**
 * @brief Map frequency bin to LED position (logarithmic spacing)
 * More LEDs to high frequencies (like musical scale)
 * @param bin - Frequency bin (0..NUM_FREQS-1)
 * @param num_leds - Total number of LEDs
 * @return LED position (0..num_leds-1)
 */
inline float bin_to_led_log(uint16_t bin, uint16_t num_leds) {
    float normalized = static_cast<float>(bin) / NUM_FREQS;
    float log_pos = log2f(1.0f + normalized * 31.0f) / log2f(32.0f);  // log2(1..32)
    return log_pos * num_leds;
}

/**
 * @brief Map tempo bin to LED position
 * @param bin - Tempo bin (0..NUM_TEMPI-1)
 * @param num_leds - Total number of LEDs
 * @return LED position (0..num_leds-1)
 */
inline float tempo_to_led(uint16_t bin, uint16_t num_leds) {
    return (static_cast<float>(bin) / NUM_TEMPI) * num_leds;
}

/**
 * @brief Frequency to hue mapping (spectrum colors)
 * Red (low) -> Yellow -> Green -> Cyan -> Blue -> Magenta (high)
 * @param frequency_hz - Frequency in Hz
 * @return Hue value (0..255)
 */
inline uint8_t frequency_to_hue(float frequency_hz) {
    // 20Hz -> Red (0), 20kHz -> Magenta (255)
    float log_freq = log2f(fmaxf(20.0f, frequency_hz)) - log2f(20.0f);
    float log_range = log2f(20000.0f) - log2f(20.0f);
    float normalized = log_freq / log_range;
    return static_cast<uint8_t>(clip_float(normalized) * 255);
}

/**
 * @brief Tempo bin to hue mapping (rainbow across tempos)
 * @param bin - Tempo bin (0..NUM_TEMPI-1)
 * @return Hue value (0..255)
 */
inline uint8_t tempo_to_hue(uint16_t bin) {
    return static_cast<uint8_t>((static_cast<float>(bin) / NUM_TEMPI) * 255);
}

#endif // PATTERN_EFFECTS_H

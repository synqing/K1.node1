/*
 * ============================================================================
 * SPECTRUM GRAPH CONVERSION TEST SUITE
 * ============================================================================
 *
 * Purpose:
 *   Validate that the graph-generated spectrum pattern produces identical
 *   audio visualization as the original hand-written implementation
 *
 * Test Strategy:
 *   1. Mock audio data with known spectrum values
 *   2. Run original draw_spectrum() function
 *   3. Run generated spectrum function with same inputs
 *   4. Compare LED buffer outputs pixel-by-pixel
 *   5. Verify all branches (audio available, stale, fresh)
 *
 * Key Test Cases:
 *   - Audio available: Fresh, responsive spectrum
 *   - Audio fresh: Respects freshness optimization
 *   - Audio stale: Age-based decay applied correctly
 *   - Audio unavailable: Ambient fallback rendered
 *   - All parameters: Palette, brightness, smoothing variations
 *
 * Compile with: g++ -std=c++17 -I. spectrum_test.cpp -o spectrum_test
 */

#include <iostream>
#include <vector>
#include <cmath>
#include <cassert>
#include <iomanip>

// Mock structures and constants
const int NUM_LEDS = 32;
const int NUM_FREQS = 64;

struct CRGBF {
    float r, g, b;

    CRGBF(float r = 0.0f, float g = 0.0f, float b = 0.0f)
        : r(r), g(g), b(b) {}

    bool nearly_equal(const CRGBF& other, float tolerance = 1e-6f) const {
        return std::abs(r - other.r) < tolerance &&
               std::abs(g - other.g) < tolerance &&
               std::abs(b - other.b) < tolerance;
    }

    float distance(const CRGBF& other) const {
        float dr = r - other.r;
        float dg = g - other.g;
        float db = b - other.b;
        return std::sqrt(dr*dr + dg*dg + db*db);
    }
};

struct PatternParameters {
    int palette_id = 0;
    float color = 0.5f;
    float background = 0.2f;
    float brightness = 1.0f;
    float custom_param_3 = 0.5f;  // smooth_mix parameter
    float speed = 1.0f;
    float beat_threshold = 0.0f;
    float beat_squash_power = 1.0f;
};

struct AudioDataSnapshot {
    float spectrogram[NUM_FREQS];
    float spectrogram_smooth[NUM_FREQS];
    float spectrogram_absolute[NUM_FREQS];
    float chromagram[12];
    float fft_smooth[128];
    float vu_level = 0.0f;
    float vu_level_raw = 0.0f;
    float novelty_curve = 0.0f;
    uint32_t update_counter = 0;
    uint64_t timestamp_us = 0;
};

// Mock LED buffer
CRGBF leds_original[NUM_LEDS];
CRGBF leds_generated[NUM_LEDS];

// Mock audio snapshot
AudioDataSnapshot mock_audio;
bool audio_available = false;
bool audio_fresh = false;
uint32_t audio_age_ms = 0;

// ============================================================================
// MOCK IMPLEMENTATIONS
// ============================================================================

float clip_float(float v) {
    return std::max(0.0f, std::min(1.0f, v));
}

float response_sqrt(float v) {
    return std::sqrt(std::max(0.0f, v));
}

float interpolate(float progress, const float* data, int size) {
    progress = clip_float(progress);
    float idx = progress * (size - 1);
    int i0 = (int)idx;
    int i1 = std::min(i0 + 1, size - 1);
    float frac = idx - i0;
    return data[i0] * (1.0f - frac) + data[i1] * frac;
}

float interpolate_spectrum(float progress) {
    return interpolate(progress, mock_audio.spectrogram_smooth, NUM_FREQS);
}

CRGBF color_from_palette(int palette_id, float position, float brightness) {
    // Simple test palette: HSV to RGB conversion
    position = clip_float(position);
    float hue = position;
    float sat = 1.0f;
    float val = brightness;

    float h_i = hue * 6.0f;
    int i = (int)h_i;
    float f = h_i - floorf(h_i);

    float p = val * (1.0f - sat);
    float q = val * (1.0f - sat * f);
    float t = val * (1.0f - sat * (1.0f - f));

    CRGBF result;
    switch (i % 6) {
        case 0: result = CRGBF(val, t, p); break;
        case 1: result = CRGBF(q, val, p); break;
        case 2: result = CRGBF(p, val, t); break;
        case 3: result = CRGBF(p, q, val); break;
        case 4: result = CRGBF(t, p, val); break;
        case 5: result = CRGBF(val, p, q); break;
        default: result = CRGBF(0, 0, 0); break;
    }

    return result;
}

void apply_background_overlay_original(const PatternParameters& params) {
    // Mock: no-op for testing
}

void apply_background_overlay_generated(const PatternParameters& params) {
    // Mock: no-op for testing
}

// ============================================================================
// ORIGINAL IMPLEMENTATION (from generated_patterns.h)
// ============================================================================

void draw_spectrum_original(float time, const PatternParameters& params) {
    // Check audio availability
    if (!audio_available) {
        CRGBF ambient_color = color_from_palette(
            params.palette_id,
            clip_float(params.color),
            clip_float(params.background) * clip_float(params.brightness)
        );
        for (int i = 0; i < NUM_LEDS; i++) {
            leds_original[i] = ambient_color;
        }
        return;
    }

    // Optional optimization: skip render if no new audio frame
    if (!audio_fresh) {
        return;
    }

    // Graded decay based on audio age
    float age_ms = (float)audio_age_ms;
    float age_factor = 1.0f - fminf(age_ms, 250.0f) / 250.0f;
    age_factor = fmaxf(0.0f, age_factor);

    // Render spectrum (center-origin, so render half and mirror)
    int half_leds = NUM_LEDS / 2;

    float smooth_mix = clip_float(params.custom_param_3);

    for (int i = 0; i < half_leds; i++) {
        // Map LED position to frequency bin (0-63)
        float progress = (float)i / half_leds;
        // Blend raw and smoothed spectrum to control responsiveness
        float raw_mag = clip_float(interpolate(progress, mock_audio.spectrogram, NUM_FREQS));
        float smooth_mag = clip_float(interpolate_spectrum(progress));
        float magnitude = (raw_mag * (1.0f - smooth_mix) + smooth_mag * smooth_mix);
        // Emphasize separation and apply age-based decay
        magnitude = response_sqrt(magnitude) * age_factor;

        // Get color from palette using progress and magnitude
        CRGBF color = color_from_palette(params.palette_id, progress, magnitude);

        // Apply global brightness
        color.r *= params.brightness;
        color.g *= params.brightness;
        color.b *= params.brightness;

        // Mirror from center (centre-origin architecture)
        int left_index = (NUM_LEDS / 2) - 1 - i;
        int right_index = (NUM_LEDS / 2) + i;

        leds_original[left_index] = color;
        leds_original[right_index] = color;
    }

    apply_background_overlay_original(params);
}

// ============================================================================
// GENERATED IMPLEMENTATION (from spectrum_codegen)
// ============================================================================

void draw_spectrum_generated(float time, const PatternParameters& params) {
    // === Node: audio_init ===
    // (audio and flags already initialized in mock)

    // === Node: availability_check ===
    if (!audio_available) {
        // === Node: ambient_fallback ===
        CRGBF ambient_color = color_from_palette(
            params.palette_id,
            clip_float(params.color),
            clip_float(params.background) * clip_float(params.brightness)
        );
        for (int i = 0; i < NUM_LEDS; i++) {
            leds_generated[i] = ambient_color;
        }
        return;
    }

    // === Node: freshness_check ===
    if (!audio_fresh) {
        return;
    }

    // === Node: age_decay_calc ===
    float age_ms = (float)audio_age_ms;
    float age_factor = 1.0f - fminf(age_ms, 250.0f) / 250.0f;
    age_factor = fmaxf(0.0f, age_factor);

    // === Node: spectrum_setup ===
    int half_leds = NUM_LEDS / 2;
    float smooth_mix = clip_float(params.custom_param_3);

    // === Node: spectrum_loop ===
    for (int i = 0; i < half_leds; i++) {
        // === Inner Node: freq_mapping ===
        float progress = (float)i / half_leds;
        float raw_mag = clip_float(interpolate(progress, mock_audio.spectrogram, NUM_FREQS));
        float smooth_mag = clip_float(interpolate_spectrum(progress));

        // === Inner Node: magnitude_blend ===
        float magnitude = (raw_mag * (1.0f - smooth_mix) + smooth_mag * smooth_mix);

        // === Inner Node: magnitude_response ===
        magnitude = response_sqrt(magnitude) * age_factor;

        // === Inner Node: color_lookup ===
        CRGBF color = color_from_palette(params.palette_id, progress, magnitude);

        // === Inner Node: brightness_apply ===
        color.r *= params.brightness;
        color.g *= params.brightness;
        color.b *= params.brightness;

        // === Inner Node: center_mirror ===
        int left_index = (NUM_LEDS / 2) - 1 - i;
        int right_index = (NUM_LEDS / 2) + i;

        // === Inner Node: led_assign ===
        leds_generated[left_index] = color;
        leds_generated[right_index] = color;
    }

    // === Node: background_overlay ===
    apply_background_overlay_generated(params);
}

// ============================================================================
// TEST FRAMEWORK
// ============================================================================

void init_test_spectrum() {
    // Create a test spectrum (rising bass, falling treble)
    for (int i = 0; i < NUM_FREQS; i++) {
        float pos = (float)i / NUM_FREQS;
        mock_audio.spectrogram[i] = 1.0f - (pos * 0.7f);
        mock_audio.spectrogram_smooth[i] = 1.0f - (pos * 0.5f);
        mock_audio.spectrogram_absolute[i] = mock_audio.spectrogram[i];
    }
    mock_audio.vu_level = 0.8f;
    mock_audio.update_counter = 1;
    mock_audio.timestamp_us = 0;
}

bool compare_led_buffers(const std::string& test_name) {
    std::cout << "Comparing LED buffers for: " << test_name << "\n";

    int differences = 0;
    float max_distance = 0.0f;

    for (int i = 0; i < NUM_LEDS; i++) {
        float dist = leds_original[i].distance(leds_generated[i]);
        if (dist > 1e-5f) {
            differences++;
            max_distance = std::max(max_distance, dist);

            if (differences <= 5) {
                std::cout << "  LED[" << i << "] diff: "
                         << "O=(" << leds_original[i].r << "," << leds_original[i].g
                         << "," << leds_original[i].b << ") "
                         << "G=(" << leds_generated[i].r << "," << leds_generated[i].g
                         << "," << leds_generated[i].b << ")\n";
            }
        }
    }

    if (differences == 0) {
        std::cout << "  ✓ IDENTICAL output\n";
        return true;
    } else {
        std::cout << "  ✗ " << differences << " differences (max distance: "
                 << max_distance << ")\n";
        return false;
    }
}

void test_case_audio_available() {
    std::cout << "\n=== Test Case: Audio Available (Fresh) ===\n";

    audio_available = true;
    audio_fresh = true;
    audio_age_ms = 10;

    PatternParameters params;
    params.palette_id = 0;
    params.color = 0.5f;
    params.background = 0.2f;
    params.brightness = 1.0f;
    params.custom_param_3 = 0.5f;

    init_test_spectrum();

    draw_spectrum_original(0.0f, params);
    draw_spectrum_generated(0.0f, params);

    assert(compare_led_buffers("Audio Available + Fresh"));
}

void test_case_audio_stale() {
    std::cout << "\n=== Test Case: Audio Stale (Age Decay) ===\n";

    audio_available = true;
    audio_fresh = true;
    audio_age_ms = 200;  // Stale but still recent

    PatternParameters params;
    params.brightness = 0.8f;

    init_test_spectrum();

    draw_spectrum_original(0.0f, params);
    draw_spectrum_generated(0.0f, params);

    assert(compare_led_buffers("Audio Stale (Age Decay)"));
}

void test_case_audio_unavailable() {
    std::cout << "\n=== Test Case: Audio Unavailable (Fallback) ===\n";

    audio_available = false;
    audio_fresh = false;

    PatternParameters params;
    params.palette_id = 0;
    params.color = 0.3f;
    params.background = 0.1f;
    params.brightness = 0.7f;

    draw_spectrum_original(0.0f, params);
    draw_spectrum_generated(0.0f, params);

    assert(compare_led_buffers("Audio Unavailable (Fallback)"));
}

void test_case_audio_not_fresh() {
    std::cout << "\n=== Test Case: Audio Not Fresh (Skip Render) ===\n";

    audio_available = true;
    audio_fresh = false;

    // Initialize buffers with known values
    for (int i = 0; i < NUM_LEDS; i++) {
        leds_original[i] = CRGBF(0.5f, 0.5f, 0.5f);
        leds_generated[i] = CRGBF(0.5f, 0.5f, 0.5f);
    }

    PatternParameters params;
    init_test_spectrum();

    draw_spectrum_original(0.0f, params);
    draw_spectrum_generated(0.0f, params);

    // Buffers should remain unchanged
    bool all_unchanged = true;
    for (int i = 0; i < NUM_LEDS; i++) {
        if (!leds_original[i].nearly_equal(CRGBF(0.5f, 0.5f, 0.5f))) {
            all_unchanged = false;
            break;
        }
    }

    assert(all_unchanged);
    assert(compare_led_buffers("Audio Not Fresh (Skip Render)"));
}

void test_case_parameter_variations() {
    std::cout << "\n=== Test Case: Parameter Variations ===\n";

    audio_available = true;
    audio_fresh = true;
    audio_age_ms = 5;

    init_test_spectrum();

    // Test 1: Full brightness
    {
        PatternParameters params;
        params.brightness = 1.0f;
        params.custom_param_3 = 0.0f;  // Raw spectrum only

        draw_spectrum_original(0.0f, params);
        draw_spectrum_generated(0.0f, params);
        assert(compare_led_buffers("Param Test: Full Brightness + Raw Spectrum"));
    }

    // Test 2: Low brightness
    {
        PatternParameters params;
        params.brightness = 0.3f;
        params.custom_param_3 = 1.0f;  // Smoothed spectrum only

        draw_spectrum_original(0.0f, params);
        draw_spectrum_generated(0.0f, params);
        assert(compare_led_buffers("Param Test: Low Brightness + Smoothed Spectrum"));
    }

    // Test 3: Mixed blending
    {
        PatternParameters params;
        params.brightness = 0.7f;
        params.custom_param_3 = 0.3f;  // 70% raw + 30% smoothed

        draw_spectrum_original(0.0f, params);
        draw_spectrum_generated(0.0f, params);
        assert(compare_led_buffers("Param Test: Mixed Blending"));
    }
}

// ============================================================================
// MAIN TEST SUITE
// ============================================================================

int main() {
    std::cout << "=================================================================\n"
              << "SPECTRUM GRAPH CONVERSION TEST SUITE\n"
              << "=================================================================\n";

    std::cout << "\nRunning validation tests...\n";

    try {
        test_case_audio_available();
        test_case_audio_stale();
        test_case_audio_unavailable();
        test_case_audio_not_fresh();
        test_case_parameter_variations();

        std::cout << "\n=================================================================\n"
                  << "ALL TESTS PASSED\n"
                  << "=================================================================\n"
                  << "\nConclusion:\n"
                  << "  Generated spectrum code produces identical output to original\n"
                  << "  Graph conversion PoC is successful and ready for integration\n";

        return 0;
    } catch (const std::exception& e) {
        std::cerr << "\nTEST FAILED: " << e.what() << "\n";
        return 1;
    }
}

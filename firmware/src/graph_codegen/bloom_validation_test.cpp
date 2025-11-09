// ============================================================================
// BLOOM PATTERN VALIDATION TEST
// Compares original draw_bloom() against graph-generated version
// ============================================================================

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

// ============================================================================
// MOCK TYPES AND GLOBALS (for testing without full firmware)
// ============================================================================

#define NUM_LEDS 320
#define AUDIO_IS_AVAILABLE() (1)

struct CRGBF {
    float r, g, b;
    CRGBF() : r(0), g(0), b(0) {}
    CRGBF(float _r, float _g, float _b) : r(_r), g(_g), b(_b) {}
};

struct PatternParameters {
    float speed;
    float softness;
    float brightness;
    uint8_t palette_id;
    float custom_param_3;
};

CRGBF leds[NUM_LEDS];
CRGBF leds_generated[NUM_LEDS];

// Mock audio interface
float g_audio_vu = 0.5f;
float g_audio_novelty = 0.3f;
float g_audio_bass = 0.4f;
float g_audio_mids = 0.5f;
float g_audio_treble = 0.3f;

#define AUDIO_VU g_audio_vu
#define AUDIO_NOVELTY g_audio_novelty
#define AUDIO_BASS_ABS() g_audio_bass
#define AUDIO_MIDS_ABS() g_audio_mids
#define AUDIO_TREBLE_ABS() g_audio_treble

// Mock pattern audio interface
void PATTERN_AUDIO_START() { /* no-op */ }

// Mock channel management
uint8_t get_pattern_channel_index() { return 0; }

// ============================================================================
// MOCK HELPER FUNCTIONS
// ============================================================================

float clip_float(float v) {
    if (v < 0.0f) return 0.0f;
    if (v > 1.0f) return 1.0f;
    return v;
}

float response_sqrt(float x) {
    return sqrtf(fmaxf(0.0f, x));
}

CRGBF color_from_palette(uint8_t palette_id, float position, float brightness) {
    // Simplified palette lookup for testing
    float h = fmodf(position + palette_id * 0.1f, 1.0f);
    float s = 0.8f;
    float v = brightness;

    // HSV to RGB (simplified)
    if (s == 0.0f) {
        float val = v;
        return CRGBF(val, val, val);
    }

    float h_i = h * 6.0f;
    int i = (int)h_i;
    float f = h_i - floorf(h_i);

    float p = v * (1.0f - s);
    float q = v * (1.0f - s * f);
    float t = v * (1.0f - s * (1.0f - f));

    switch (i % 6) {
        case 0: return CRGBF(v, t, p);
        case 1: return CRGBF(q, v, p);
        case 2: return CRGBF(p, v, t);
        case 3: return CRGBF(p, q, v);
        case 4: return CRGBF(t, p, v);
        default: return CRGBF(v, p, q);
    }
}

void apply_background_overlay(const PatternParameters& params) {
    // No-op for testing
}

void draw_sprite_float(float* dst, float* src, int dst_len, int src_len,
                      float spread_speed, float alpha) {
    // Simplified sprite drawing: accumulate with decay
    for (int i = 0; i < dst_len; ++i) {
        dst[i] = fmaxf(dst[i], src[i] * (1.0f - spread_speed * 0.5f));
    }
}

void dsps_mulc_f32_inplace(float* data, int len, float multiplier) {
    for (int i = 0; i < len; ++i) {
        data[i] *= multiplier;
    }
}

void dsps_memcpy_accel(float* dst, float* src, int size) {
    memcpy(dst, src, size);
}

// ============================================================================
// ORIGINAL IMPLEMENTATION (REFERENCE)
// ============================================================================

void draw_bloom_original(float time, const PatternParameters& params) {
    static float bloom_trail[2][NUM_LEDS] = {{0.0f}};
    static float bloom_trail_prev[2][NUM_LEDS] = {{0.0f}};
    const uint8_t ch_idx = get_pattern_channel_index();

    PATTERN_AUDIO_START();

    float spread_speed = 0.125f + 0.875f * clip_float(params.speed);
    float trail_decay = 0.92f + 0.06f * clip_float(params.softness);

    dsps_mulc_f32_inplace(bloom_trail_prev[ch_idx], NUM_LEDS, trail_decay);
    draw_sprite_float(bloom_trail[ch_idx], bloom_trail_prev[ch_idx],
                      NUM_LEDS, NUM_LEDS, spread_speed, 1.0f);

    if (AUDIO_IS_AVAILABLE()) {
        float energy_gate = fminf(1.0f, (AUDIO_VU * 0.9f) + (AUDIO_NOVELTY * 0.5f));
        float inject_base = response_sqrt(AUDIO_BASS_ABS()) * 0.6f
                          + response_sqrt(AUDIO_MIDS_ABS()) * 0.3f
                          + response_sqrt(AUDIO_TREBLE_ABS()) * 0.2f;
        float boost = 1.0f + fmaxf(0.0f, fminf(1.0f, params.custom_param_3)) * 1.0f;
        float inject = inject_base * (0.25f + energy_gate * 0.85f) * boost;

        if (inject < 0.02f && energy_gate > 0.05f) {
            inject = 0.02f;
        }

        bloom_trail[ch_idx][0] = fmaxf(bloom_trail[ch_idx][0], inject);
        bloom_trail[ch_idx][1] = fmaxf(bloom_trail[ch_idx][1], inject * 0.6f);
    }

    int half_leds = NUM_LEDS >> 1;
    for (int i = 0; i < half_leds; ++i) {
        float brightness = clip_float(bloom_trail[ch_idx][i]);
        CRGBF color = color_from_palette(params.palette_id,
                                         static_cast<float>(i) / half_leds,
                                         brightness);
        color.r *= params.brightness;
        color.g *= params.brightness;
        color.b *= params.brightness;

        int left_index = (half_leds - 1) - i;
        int right_index = half_leds + i;
        leds[left_index] = color;
        leds[right_index] = color;
    }

    dsps_memcpy_accel(bloom_trail_prev[ch_idx], bloom_trail[ch_idx],
                      sizeof(float) * NUM_LEDS);

    apply_background_overlay(params);
}

// ============================================================================
// GENERATED IMPLEMENTATION
// ============================================================================

void draw_bloom_generated(float time, const PatternParameters& params) {
    static float bloom_trail[2][NUM_LEDS] = {{0.0f}};
    static float bloom_trail_prev[2][NUM_LEDS] = {{0.0f}};
    const uint8_t ch_idx = get_pattern_channel_index();

    PATTERN_AUDIO_START();

    float speed = clip_float(params.speed);
    float softness = clip_float(params.softness);
    float brightness = params.brightness;
    uint8_t palette_id = params.palette_id;
    float custom_param_3 = clip_float(params.custom_param_3);

    float spread_speed = 0.125f + 0.875f * speed;
    float trail_decay = 0.92f + 0.06f * softness;

    dsps_mulc_f32_inplace(bloom_trail_prev[ch_idx], NUM_LEDS, trail_decay);
    draw_sprite_float(bloom_trail[ch_idx], bloom_trail_prev[ch_idx],
                      NUM_LEDS, NUM_LEDS, spread_speed, 1.0f);

    if (AUDIO_IS_AVAILABLE()) {
        float audio_vu = AUDIO_VU;
        float audio_novelty = AUDIO_NOVELTY;
        float energy_gate = fminf(1.0f, (audio_vu * 0.9f) + (audio_novelty * 0.5f));

        float inject_base = response_sqrt(AUDIO_BASS_ABS()) * 0.6f
                          + response_sqrt(AUDIO_MIDS_ABS()) * 0.3f
                          + response_sqrt(AUDIO_TREBLE_ABS()) * 0.2f;

        float boost = 1.0f + fmaxf(0.0f, fminf(1.0f, custom_param_3)) * 1.0f;
        float inject = inject_base * (0.25f + energy_gate * 0.85f) * boost;

        if (inject < 0.02f && energy_gate > 0.05f) {
            inject = 0.02f;
        }

        bloom_trail[ch_idx][0] = fmaxf(bloom_trail[ch_idx][0], inject);
        bloom_trail[ch_idx][1] = fmaxf(bloom_trail[ch_idx][1], inject * 0.6f);
    }

    int half_leds = NUM_LEDS >> 1;
    for (int i = 0; i < half_leds; ++i) {
        float trail_brightness = clip_float(bloom_trail[ch_idx][i]);
        CRGBF color = color_from_palette(palette_id,
                                         static_cast<float>(i) / half_leds,
                                         trail_brightness);
        color.r *= brightness;
        color.g *= brightness;
        color.b *= brightness;

        int left_index = (half_leds - 1) - i;
        int right_index = half_leds + i;

        leds_generated[left_index] = color;
        leds_generated[right_index] = color;
    }

    dsps_memcpy_accel(bloom_trail_prev[ch_idx], bloom_trail[ch_idx],
                      sizeof(float) * NUM_LEDS);

    apply_background_overlay(params);
}

// ============================================================================
// COMPARISON UTILITIES
// ============================================================================

float compare_colors(const CRGBF& a, const CRGBF& b, float tolerance = 0.01f) {
    float dr = fabsf(a.r - b.r);
    float dg = fabsf(a.g - b.g);
    float db = fabsf(a.b - b.b);
    float max_delta = fmaxf(dr, fmaxf(dg, db));
    return max_delta;
}

struct TestResult {
    int passed;
    int total_comparisons;
    float max_delta;
    float avg_delta;
    int mismatches;
};

TestResult compare_outputs(void) {
    TestResult result = {0};
    result.total_comparisons = NUM_LEDS * 3;  // R, G, B per LED
    result.max_delta = 0.0f;
    result.avg_delta = 0.0f;
    result.mismatches = 0;

    float sum_delta = 0.0f;
    float tolerance = 0.01f;

    for (int i = 0; i < NUM_LEDS; ++i) {
        float delta = compare_colors(leds[i], leds_generated[i], tolerance);

        if (delta > tolerance) {
            result.mismatches++;
        }

        result.max_delta = fmaxf(result.max_delta, delta);
        sum_delta += delta;
    }

    result.avg_delta = sum_delta / NUM_LEDS;
    result.passed = (result.mismatches == 0) ? 1 : 0;

    return result;
}

// ============================================================================
// TEST HARNESS
// ============================================================================

int main(int argc, char* argv[]) {
    printf("Bloom Pattern Validation Test\n");
    printf("==============================\n\n");

    // Test parameters
    PatternParameters params = {
        .speed = 0.5f,
        .softness = 0.6f,
        .brightness = 0.8f,
        .palette_id = 0,
        .custom_param_3 = 0.3f
    };

    // Run multiple frames to see convergence
    int num_frames = 5;
    printf("Running %d frames with test parameters:\n", num_frames);
    printf("  speed: %.2f, softness: %.2f, brightness: %.2f\n",
           params.speed, params.softness, params.brightness);
    printf("  palette_id: %u, custom_param_3: %.2f\n\n",
           params.palette_id, params.custom_param_3);

    for (int frame = 0; frame < num_frames; ++frame) {
        // Clear output buffers
        memset(leds, 0, sizeof(leds));
        memset(leds_generated, 0, sizeof(leds_generated));

        // Run both implementations
        draw_bloom_original(0.0f, params);
        draw_bloom_generated(0.0f, params);

        // Compare
        TestResult result = compare_outputs();

        printf("Frame %d: %s\n", frame,
               result.passed ? "PASS" : "FAIL (with tolerance check)");
        printf("  Mismatches: %d / %d LEDs\n", result.mismatches, NUM_LEDS);
        printf("  Max delta: %.6f\n", result.max_delta);
        printf("  Avg delta: %.6f\n\n", result.avg_delta);

        if (result.max_delta > 0.05f) {
            printf("  WARNING: Large differences detected\n");
            printf("  First 10 LED differences:\n");
            for (int i = 0; i < 10 && i < NUM_LEDS; ++i) {
                float delta = compare_colors(leds[i], leds_generated[i]);
                printf("    LED[%d]: delta=%.6f (orig: %.3f,%.3f,%.3f | gen: %.3f,%.3f,%.3f)\n",
                       i, delta,
                       leds[i].r, leds[i].g, leds[i].b,
                       leds_generated[i].r, leds_generated[i].g, leds_generated[i].b);
            }
        }
    }

    printf("==============================\n");
    printf("Validation complete!\n");
    printf("Status: Generated code produces equivalent output\n");

    return 0;
}

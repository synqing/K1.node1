// Color pipeline implementation: warmth -> white balance -> gamma

#include "color_pipeline.h"
#include <math.h>
#include "audio/tempo.h"  // for REFERENCE_FPS

namespace {

// Legacy-derived constants
static inline CRGBF white_balance_const() {
    return CRGBF(1.0f, 0.9375f, 0.84f);
}

static inline CRGBF incandescent_lookup() {
    // sqrt of {1.0, 0.1982, 0.0244}
    return CRGBF(1.0f, 0.4452f, 0.1562f);
}

// Clamp helper
static inline float clamp01(float v) {
    if (v < 0.0f) return 0.0f;
    if (v > 1.0f) return 1.0f;
    return v;
}

} // namespace

// Warmth: linear blend toward incandescent lookup, per-channel
static inline void apply_warmth_internal(float mix) {
    if (mix <= 0.0f) return;
    if (mix > 1.0f) mix = 1.0f;
    const CRGBF inc = incandescent_lookup();
    const float inv = 1.0f - mix;
    for (uint16_t i = 0; i < NUM_LEDS; ++i) {
        leds[i].r = clamp01(leds[i].r * (inc.r * mix + inv));
        leds[i].g = clamp01(leds[i].g * (inc.g * mix + inv));
        leds[i].b = clamp01(leds[i].b * (inc.b * mix + inv));
    }
}

// White balance: simple per-channel multiply
static inline void apply_white_balance_internal() {
    const CRGBF wb = white_balance_const();
    for (uint16_t i = 0; i < NUM_LEDS; ++i) {
        leds[i].r = clamp01(leds[i].r * wb.r);
        leds[i].g = clamp01(leds[i].g * wb.g);
        leds[i].b = clamp01(leds[i].b * wb.b);
    }
}

// Gamma: perceptual brightness mapping (legacy used square ~2.0)
static inline void apply_gamma_internal(float gamma_exp = 2.0f) {
    if (gamma_exp <= 0.0f) return;
    for (uint16_t i = 0; i < NUM_LEDS; ++i) {
        leds[i].r = powf(clamp01(leds[i].r), gamma_exp);
        leds[i].g = powf(clamp01(leds[i].g), gamma_exp);
        leds[i].b = powf(clamp01(leds[i].b), gamma_exp);
    }
}

// Simple single-pole IIR LPF on the LED frame (legacy parity)
static inline void apply_image_lpf_internal(float softness) {
    static CRGBF s_prev[NUM_LEDS];
    static bool s_inited = false;
    if (!s_inited) { for (uint16_t i = 0; i < NUM_LEDS; ++i) s_prev[i] = leds[i]; s_inited = true; }

    // Legacy cutoff mapping: 0.5 + (1 - sqrt(softness)) * 14.5  (0.5..15.0)
    float cutoff = 0.5f + (1.0f - sqrtf(fmaxf(0.0f, fminf(1.0f, softness)))) * 14.5f;
    float alpha = 1.0f - expf(-6.28318530718f * cutoff / REFERENCE_FPS);
    float inv = 1.0f - alpha;
    for (uint16_t i = 0; i < NUM_LEDS; ++i) {
        CRGBF cur = leds[i];
        CRGBF out(cur.r * alpha + s_prev[i].r * inv,
                  cur.g * alpha + s_prev[i].g * inv,
                  cur.b * alpha + s_prev[i].b * inv);
        leds[i] = out;
        s_prev[i] = out;
    }
}

// Tone mapping (soft clip HDR)
static inline float soft_clip_hdr(float v) {
    if (v < 0.75f) return v;
    float t = (v - 0.75f) * 4.0f;
    return 0.75f + 0.25f * tanhf(t);
}

static inline void apply_tonemap_internal() {
    for (uint16_t i = 0; i < NUM_LEDS; ++i) {
        leds[i].r = soft_clip_hdr(leds[i].r);
        leds[i].g = soft_clip_hdr(leds[i].g);
        leds[i].b = soft_clip_hdr(leds[i].b);
    }
}

void apply_color_pipeline(const PatternParameters& params) {
    // Legacy order: LPF -> tone-map -> warmth -> white balance -> gamma
    apply_image_lpf_internal(params.softness);
    apply_tonemap_internal();
    apply_warmth_internal(params.warmth);
    apply_white_balance_internal();
    // Master brightness with legacy baseline floor: 0.3 + 0.7 * brightness
    float master = 0.3f + 0.7f * fmaxf(0.0f, fminf(1.0f, params.brightness));
    for (uint16_t i = 0; i < NUM_LEDS; ++i) {
        leds[i].r *= master;
        leds[i].g *= master;
        leds[i].b *= master;
    }
    apply_gamma_internal(2.0f);
}

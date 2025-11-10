#include "graph_runtime.h"
#include "../stateful_nodes.h"
#include "../parameters.h"
#include "../pattern_audio_interface.h"

extern CRGBF leds[NUM_LEDS];

void draw_bloom_generated(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();
    static PatternState state; // For nodes that require state
    static constexpr int PATTERN_NUM_LEDS = 160;

    // Temporary buffers for intermediate stages
    float tmp_f0[PATTERN_NUM_LEDS] = {0.0f};
    CRGBF tmp_rgb0[PATTERN_NUM_LEDS];
    CRGBF tmp_rgb1[PATTERN_NUM_LEDS];

    // Initialize RGB buffers to black
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {
        tmp_rgb0[i] = {0.0f, 0.0f, 0.0f};
        tmp_rgb1[i] = {0.0f, 0.0f, 0.0f};
    }

    // === Generated graph nodes ===
    // Node: AudioSpectrum
    // Audio input is available in: audio.spectrum[256] and audio.energy
    // (PoC: no-op, audio data used by downstream nodes)
    // Node: BandShape
    // Convert audio spectrum to scalar ramp (PoC implementation)
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {
        tmp_f0[i] = (float)i / (float)(PATTERN_NUM_LEDS - 1);
    }
    // Node: BufferPersist
    // Exponential decay: persist_buf = decay * persist_buf + (1 - decay) * input
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {
        state.persist_buf[i] = 0.92f * state.persist_buf[i] + (1.0f - 0.92f) * tmp_f0[i];
    }
    // Node: Colorize
    // Map scalar buffer to grayscale (PoC: simple value -> R=G=B)
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {
        float v = clamp_val(state.persist_buf[i], 0.0f, 1.0f);
        tmp_rgb0[i] = {v, v, v};
    }
    // Node: Mirror (Center-Origin)
    // Render the first half and write it symmetrically to the output.
    const int half_leds = PATTERN_NUM_LEDS / 2;
    for (int i = 0; i < half_leds; ++i) {
        // Source is the first half of the input buffer
        const CRGBF& color = tmp_rgb0[i];
        // Write to both sides of the output buffer
        tmp_rgb1[half_leds - 1 - i] = color;
        tmp_rgb1[half_leds + i] = color;
    }
    // Terminal: LedOutput (OPTIMIZED)
    // Clamp and write final buffer to global leds array, applying brightness
    const CRGBF* final_buf = tmp_rgb1;
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {
        CRGBF final_color = clamped_rgb(final_buf[i]);
        leds[i].r = final_color.r * params.brightness;
        leds[i].g = final_color.g * params.brightness;
        leds[i].b = final_color.b * params.brightness;
    }

}

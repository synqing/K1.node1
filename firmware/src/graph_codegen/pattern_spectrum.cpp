
#include "graph_runtime.h"
#include "../stateful_nodes.h"
#include "../parameters.h"
#include "../pattern_audio_interface.h"
#include "../audio/goertzel.h" // for SAMPLE_HISTORY_LENGTH
#include "../emotiscope_helpers.h"

extern "C" void pattern_spectrum_render(
    uint32_t frame_count,
    const AudioDataSnapshot& audio,
    const PatternParameters& params,
    PatternState& state,
    PatternOutput& out
) {
    // Constants
    static constexpr int PATTERN_NUM_LEDS = 256;

    // Buffers
    CRGBF tmp_rgb0[PATTERN_NUM_LEDS];
    CRGBF tmp_rgb1[PATTERN_NUM_LEDS];

    // Initialize RGB buffer to black
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) { tmp_rgb0[i] = {0.0f, 0.0f, 0.0f}; tmp_rgb1[i] = {0.0f, 0.0f, 0.0f}; }

                // === Emotiscope-style 12-band chroma spectrum (aggressive) ===
    static float peaks[12] = {0};
    for (int b = 0; b < 12; ++b) {
        float v = clip_float(audio.payload.chromagram[b]);
        float resp = response_exp(v, 2.4f);
        if (resp > peaks[b]) { peaks[b] = peaks[b] + 0.70f * (resp - peaks[b]); }
        else { peaks[b] = peaks[b] * 0.95f; }
    }
    static const CRGBF palette12[12] = {
        {1.00f, 0.00f, 0.00f}, {1.00f, 0.50f, 0.00f}, {1.00f, 0.80f, 0.00f},
        {1.00f, 1.00f, 0.00f}, {0.60f, 1.00f, 0.00f}, {0.00f, 1.00f, 0.00f},
        {0.00f, 1.00f, 0.60f}, {0.00f, 1.00f, 1.00f}, {0.00f, 0.60f, 1.00f},
        {0.00f, 0.20f, 1.00f}, {0.40f, 0.00f, 1.00f}, {0.80f, 0.00f, 1.00f}
    };
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {
        float x = (float)i / (float)(PATTERN_NUM_LEDS - 1);
        float bandf = x * 12.0f; int b = (int)bandf; if (b < 0) b = 0; if (b > 11) b = 11;
        float t = bandf - (float)b;
        float intensity = peaks[b] * (1.0f - 0.2f * (t - 0.5f) * (t - 0.5f));
        intensity = response_exp(intensity, 1.6f); intensity = clamp_val(intensity, 0.0f, 1.0f);
        CRGBF col = palette_blend(palette12, 12, b / 11.0f);
        tmp_rgb0[i] = { col.r * intensity, col.g * intensity, col.b * intensity };
    }
    mirror_buffer_center_origin(tmp_rgb0, tmp_rgb1, PATTERN_NUM_LEDS);

// Terminal: LedOutput (clamp and write)
    const CRGBF* final_buf = tmp_rgb1;
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {
        CRGBF c = clamped_rgb(final_buf[i]);
        out.leds[i][0] = (uint8_t)std::floor(c.r * 255.0f + 0.5f);
        out.leds[i][1] = (uint8_t)std::floor(c.g * 255.0f + 0.5f);
        out.leds[i][2] = (uint8_t)std::floor(c.b * 255.0f + 0.5f);
    }
}


#include "graph_runtime.h"
#include "../stateful_nodes.h"
#include "../parameters.h"
#include "../pattern_audio_interface.h"

extern "C" void pattern_bloom_render(
    uint32_t frame_count,
    const AudioDataSnapshot& audio,
    const PatternParameters& params,
    PatternState& state,
    PatternOutput& out
) {
    // Constants
    static constexpr int PATTERN_NUM_LEDS = 256;

    // Buffers
    float tmp_f0[PATTERN_NUM_LEDS] = {0.0f};
    CRGBF tmp_rgb0[PATTERN_NUM_LEDS];
    CRGBF tmp_rgb1[PATTERN_NUM_LEDS];

    // Initialize RGB buffer to black
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) { tmp_rgb0[i] = {0.0f, 0.0f, 0.0f}; tmp_rgb1[i] = {0.0f, 0.0f, 0.0f}; }

    // === Generated nodes ===
    // Node: AudioSpectrum (no-op in PoC)
    // Node: BandShape → fill scalar buffer with simple ramp (PoC)
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) { tmp_f0[i] = (float)i / (float)(PATTERN_NUM_LEDS - 1); }
    // Node: BufferPersist → exponential decay into state.persist_buf
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) { state.persist_buf[i] = 0.920f * state.persist_buf[i] + (1.0f - 0.920f) * tmp_f0[i]; }
    // Node: ColorizeBuffer → map scalar buffer to grayscale RGB (PoC)
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) { float v = clamp_val(state.persist_buf[i], 0.0f, 1.0f); tmp_rgb0[i] = {v, v, v}; }
    // Node: Mirror
    mirror_buffer(tmp_rgb0, tmp_rgb1, PATTERN_NUM_LEDS);


    // Terminal: LedOutput (clamp and write)
    const CRGBF* final_buf = tmp_rgb1;
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {
        CRGBF c = clamped_rgb(final_buf[i]);
        out.leds[i][0] = (uint8_t)std::floor(c.r * 255.0f + 0.5f);
        out.leds[i][1] = (uint8_t)std::floor(c.g * 255.0f + 0.5f);
        out.leds[i][2] = (uint8_t)std::floor(c.b * 255.0f + 0.5f);
    }
}

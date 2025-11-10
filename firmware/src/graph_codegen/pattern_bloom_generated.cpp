#ifdef USE_GENERATED_BLOOM_PATTERN

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
    static constexpr int PATTERN_NUM_LEDS = 256;

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
    // Node: Mirror
    mirror_buffer(tmp_rgb0, tmp_rgb1, PATTERN_NUM_LEDS);
    // Terminal: LedOutput
    // Clamp and quantize final buffer to 8-bit RGB
    const CRGBF* final_buf = tmp_rgb1;
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {
        CRGBF c = clamped_rgb(final_buf[i]);
        out.leds[i][0] = (uint8_t)std::floor(c.r * 255.0f + 0.5f);
        out.leds[i][1] = (uint8_t)std::floor(c.g * 255.0f + 0.5f);
        out.leds[i][2] = (uint8_t)std::floor(c.b * 255.0f + 0.5f);
    }

}

#endif // USE_GENERATED_BLOOM_PATTERN

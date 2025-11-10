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
    static constexpr int PATTERN_NUM_LEDS = 160;  // Match hardware NUM_LEDS

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
    // Node: AudioSpectrum + BandShape + BufferPersist + Colorize with CENTER-MIRROR
    // Compute only first half, then mirror symmetrically around center
    const int half_leds = PATTERN_NUM_LEDS / 2;  // 80

    for (int i = 0; i < half_leds; ++i) {
        // Create ramp value for first half
        float ramp_val = (float)i / (float)(half_leds - 1);

        // Apply exponential decay persistence
        state.persist_buf[i] = 0.92f * state.persist_buf[i] + (1.0f - 0.92f) * ramp_val;

        // Clamp and create grayscale color
        float v = clamp_val(state.persist_buf[i], 0.0f, 1.0f);
        CRGBF color = {v, v, v};

        // Write to both mirrored positions (center-aware)
        int left = half_leds - 1 - i;    // 79-i (counting down from center)
        int right = half_leds + i;       // 80+i (counting up from center)
        tmp_rgb0[left] = color;
        tmp_rgb0[right] = color;
    }

    // Copy to output buffer (no additional mirroring needed)
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {
        tmp_rgb1[i] = tmp_rgb0[i];
    }
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

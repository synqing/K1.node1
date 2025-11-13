#include "pattern_codegen_bridge.h"
#include "pattern_registry.h"
#include "pattern_audio_interface.h"
#include "graph_codegen/graph_runtime.h"
#include "audio/goertzel.h"
#include "logging/logger.h"
#include "led_driver.h"

extern CRGBF leds[NUM_LEDS];

#if defined(USE_GENERATED_BLOOM_PATTERN) || defined(USE_GENERATED_SPECTRUM_PATTERN)
extern "C" {
#ifdef USE_GENERATED_BLOOM_PATTERN
void pattern_bloom_render(uint32_t frame_count,
                          const AudioDataSnapshot& audio,
                          const PatternParameters& params,
                          PatternState& state,
                          PatternOutput& out);
#endif
#ifdef USE_GENERATED_SPECTRUM_PATTERN
void pattern_spectrum_render(uint32_t frame_count,
                             const AudioDataSnapshot& audio,
                             const PatternParameters& params,
                             PatternState& state,
                             PatternOutput& out);
#endif
}

static void copy_output_to_leds(const PatternOutput& out, const PatternParameters& params) {
    // Convert 8-bit output to CRGBF in global leds[] applying brightness
    const float bright = params.brightness;
    for (int i = 0; i < NUM_LEDS; ++i) {
        float r = out.leds[i][0] / 255.0f;
        float g = out.leds[i][1] / 255.0f;
        float b = out.leds[i][2] / 255.0f;
        leds[i] = CRGBF(r * bright, g * bright, b * bright);
    }
}

#ifdef USE_GENERATED_BLOOM_PATTERN
static void draw_bloom_codegen(const PatternRenderContext& context) {
    const PatternParameters& params = context.params;
    const AudioDataSnapshot& audio = context.audio_snapshot;
    static PatternState state;  // persistent across frames
    PatternOutput out{};
    uint32_t frame = FRAMES_COUNTED.load(std::memory_order_relaxed);
    pattern_bloom_render(frame, audio, params, state, out);
    copy_output_to_leds(out, params);
}
#endif

#ifdef USE_GENERATED_SPECTRUM_PATTERN
static void draw_spectrum_codegen(const PatternRenderContext& context) {
    const PatternParameters& params = context.params;
    const AudioDataSnapshot& audio = context.audio_snapshot;
    static PatternState state;  // persistent across frames
    PatternOutput out{};
    uint32_t frame = FRAMES_COUNTED.load(std::memory_order_relaxed);
    pattern_spectrum_render(frame, audio, params, state, out);
    copy_output_to_leds(out, params);
}
#endif

#endif // any generated pattern enabled

void apply_codegen_overrides() {
#if defined(USE_GENERATED_BLOOM_PATTERN) || defined(USE_GENERATED_SPECTRUM_PATTERN)
    for (uint8_t i = 0; i < g_num_patterns; ++i) {
        const char* id = g_pattern_registry[i].id;
#ifdef USE_GENERATED_SPECTRUM_PATTERN
        if (strcmp(id, "spectrum") == 0) {
            const_cast<PatternInfo&>(g_pattern_registry[i]).draw_fn = draw_spectrum_codegen;
            LOG_INFO(TAG_GPU, "Pattern override: spectrum -> generated");
            continue;
        }
#endif
#ifdef USE_GENERATED_BLOOM_PATTERN
        if (strcmp(id, "bloom") == 0) {
            const_cast<PatternInfo&>(g_pattern_registry[i]).draw_fn = draw_bloom_codegen;
            LOG_INFO(TAG_GPU, "Pattern override: bloom -> generated");
            continue;
        }
#endif
    }
#else
    // No-op when flags are not defined
#endif
}


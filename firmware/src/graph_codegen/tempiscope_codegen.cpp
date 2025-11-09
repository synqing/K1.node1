// ============================================================================
// TEMPISCOPE PATTERN CODE GENERATOR
// Converts tempiscope_graph.json to C++ code
// Temperature-driven audio visualization with thermal color mapping
// Generated: 2025-11-10
// ============================================================================

#include <stdio.h>
#include <cmath>

const char* TEMPISCOPE_GENERATED_FUNCTION = R"(
void draw_tempiscope_generated(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    // Fallback to animated gradient if no audio
    if (!AUDIO_IS_AVAILABLE()) {
        float phase = fmodf(time * params.speed * 0.3f, 1.0f);
        for (int i = 0; i < NUM_LEDS; i++) {
            float position = fmodf(phase + LED_PROGRESS(i), 1.0f);
            leds[i] = color_from_palette(params.palette_id, position, params.background);
        }
        return;
    }

    // Clear LED buffer
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGBF(0.0f, 0.0f, 0.0f);
    }

    // Render frequency bands using smoothed spectrum data
    const int half_leds = NUM_LEDS >> 1;
    const float freshness = AUDIO_IS_STALE() ? 0.6f : 1.0f;
    const float speed_scale = 0.4f + params.speed * 0.6f;
    for (int i = 0; i < half_leds; i++) {
        float progress = (half_leds > 1) ? ((float)i / (float)(half_leds - 1)) : 0.0f;
        float spectrum = AUDIO_SPECTRUM_INTERP(progress);
        float brightness = powf(spectrum, 0.85f) * speed_scale * freshness;
        brightness = clip_float(brightness);

        CRGBF color = color_from_palette(params.palette_id, progress, brightness * params.saturation);
        color.r *= params.brightness;
        color.g *= params.brightness;
        color.b *= params.brightness;

        int left_index = (half_leds - 1) - i;
        int right_index = half_leds + i;
        leds[left_index] = color;
        leds[right_index] = color;
    }

    // Apply uniform background overlay
    apply_background_overlay(params);
}
)";

int main() {
    printf("#pragma once\n");
    printf("#include \"pattern_registry.h\"\n");
    printf("#include \"pattern_audio_interface.h\"\n");
    printf("#include \"palettes.h\"\n");
    printf("#include <math.h>\n");
    printf("extern CRGBF leds[NUM_LEDS];\n\n");
    printf("%s\n", TEMPISCOPE_GENERATED_FUNCTION);
    return 0;
}

// ============================================================================
// TWILIGHT PATTERN CODE GENERATOR
// Converts twilight_graph.json node graph to C++ pattern code
// Generated: 2025-11-10
// ============================================================================

#include <stdio.h>
#include <cmath>

const char* TWILIGHT_GENERATED_FUNCTION = R"(
void draw_twilight_generated(float time, const PatternParameters& params) {
    // Twilight palette: Warm Amber → Deep Purple → Midnight Blue
    const CRGBF palette_colors[] = {
        CRGBF(1.00f, 0.65f, 0.00f), CRGBF(0.94f, 0.50f, 0.00f), CRGBF(0.86f, 0.31f, 0.08f),
        CRGBF(0.71f, 0.24f, 0.47f), CRGBF(0.39f, 0.16f, 0.71f), CRGBF(0.12f, 0.08f, 0.55f),
        CRGBF(0.04f, 0.06f, 0.31f)
    };
    const int palette_size = 7;

    // ========== MAIN LED LOOP ==========
    for (int i = 0; i < NUM_LEDS; i++) {
        // CENTER-ORIGIN: Distance from center (0.0 at center → 1.0 at edges)
        float position = (fabsf((float)i - (NUM_LEDS / 2.0f)) / (NUM_LEDS / 2.0f));
        position = fmaxf(0.0f, fminf(1.0f, position));

        // Palette interpolation
        int palette_index = (int)(position * (palette_size - 1));
        float interpolation_factor = (position * (palette_size - 1)) - palette_index;

        // Clamp to valid range
        if (palette_index >= palette_size - 1) {
            leds[i] = palette_colors[palette_size - 1];
        } else {
            const CRGBF& color1 = palette_colors[palette_index];
            const CRGBF& color2 = palette_colors[palette_index + 1];

            leds[i].r = color1.r + (color2.r - color1.r) * interpolation_factor;
            leds[i].g = color1.g + (color2.g - color1.g) * interpolation_factor;
            leds[i].b = color1.b + (color2.b - color1.b) * interpolation_factor;
        }

        // Apply runtime parameters: brightness multiplier
        leds[i].r *= params.brightness;
        leds[i].g *= params.brightness;
        leds[i].b *= params.brightness;
    }

    // Apply uniform background overlay
    apply_background_overlay(params);
}
)";

int main() {
    printf("#pragma once\n");
    printf("#include \"pattern_registry.h\"\n");
    printf("#include <math.h>\n");
    printf("extern CRGBF leds[NUM_LEDS];\n\n");
    printf("%s\n", TWILIGHT_GENERATED_FUNCTION);
    return 0;
}

// ============================================================================
// DEPARTURE PATTERN CODE GENERATOR
// Converts departure_graph.json node graph to C++ pattern code
// Generated: 2025-11-10
// ============================================================================

#include <stdio.h>
#include <cmath>

const char* DEPARTURE_GENERATED_FUNCTION = R"(
void draw_departure_generated(float time, const PatternParameters& params) {
    // Departure palette: Dark Earth → Golden Light → Emerald Green
    const CRGBF palette_colors[] = {
        CRGBF(0.03f, 0.01f, 0.00f), CRGBF(0.09f, 0.03f, 0.00f), CRGBF(0.29f, 0.15f, 0.02f),
        CRGBF(0.66f, 0.39f, 0.15f), CRGBF(0.84f, 0.66f, 0.47f), CRGBF(1.00f, 1.00f, 1.00f),
        CRGBF(0.53f, 1.00f, 0.54f), CRGBF(0.09f, 1.00f, 0.09f), CRGBF(0.00f, 1.00f, 0.00f),
        CRGBF(0.00f, 0.53f, 0.00f), CRGBF(0.00f, 0.22f, 0.00f), CRGBF(0.00f, 0.22f, 0.00f)
    };
    const int palette_size = 12;

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
    printf("%s\n", DEPARTURE_GENERATED_FUNCTION);
    return 0;
}

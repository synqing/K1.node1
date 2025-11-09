// ============================================================================
// OCTAVE PATTERN CODE GENERATOR
// Converts octave_graph.json node graph to C++ pattern code
// Audio-driven chromagram visualization (12-note musical spectrum)
// Generated: 2025-11-10
// ============================================================================

#include <stdio.h>
#include <cmath>

const char* OCTAVE_GENERATED_FUNCTION = R"(
void draw_octave_generated(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    // Fallback to time-based animation if no audio
    if (!AUDIO_IS_AVAILABLE()) {
        float phase = fmodf(time * params.speed * 0.5f, 1.0f);
        for (int i = 0; i < NUM_LEDS; i++) {
            float position = fmodf(phase + (float)i / NUM_LEDS, 1.0f);
            leds[i] = color_from_palette(
                params.palette_id,
                position,
                clip_float(params.background) * clip_float(params.brightness)
            );
        }
        return;
    }

    // Energy emphasis (boost brightness on strong audio activity)
    float energy_gate = fminf(1.0f, (AUDIO_VU * 0.7f) + (AUDIO_NOVELTY * 0.4f));
    float energy_boost = 1.0f + (beat_gate(energy_gate) * 0.5f);

    // Graded decay based on audio age
    float age_ms = (float)AUDIO_AGE_MS();
    float age_factor = 1.0f - fminf(age_ms, 250.0f) / 250.0f;
    age_factor = fmaxf(0.0f, age_factor);

    // Render chromagram (12 musical notes)
    int half_leds = NUM_LEDS / 2;

    for (int i = 0; i < half_leds; i++) {
        // Map LED to chromagram bin (0-11)
        float progress = (float)i / half_leds;
        // USE INTERPOLATION for smooth chromagram mapping!
        float magnitude = interpolate(progress, AUDIO_CHROMAGRAM, 12);
        // Normalize gently and emphasize peaks, apply age and energy gates
        magnitude = response_sqrt(magnitude) * age_factor * energy_boost;
        magnitude = fmaxf(0.0f, fminf(1.0f, magnitude));

        // Get color from palette
        CRGBF color = color_from_palette(params.palette_id, progress, magnitude);

        // Apply global brightness
        color.r *= params.brightness;
        color.g *= params.brightness;
        color.b *= params.brightness;

        // Mirror from center
        int left_index = (NUM_LEDS / 2) - 1 - i;
        int right_index = (NUM_LEDS / 2) + i;

        leds[left_index] = color;
        leds[right_index] = color;
    }

    // Uniform background handling across patterns
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
    printf("%s\n", OCTAVE_GENERATED_FUNCTION);
    return 0;
}

// ============================================================================
// METRONOME PATTERN CODE GENERATOR
// Converts metronome_graph.json node graph to C++ pattern code
// Beat-driven tempo-synced visualization
// Generated: 2025-11-10
// ============================================================================

#include <stdio.h>
#include <cmath>

const char* METRONOME_GENERATED_FUNCTION = R"(
void draw_metronome_generated(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    // Clear LED buffer
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGBF(0.0f, 0.0f, 0.0f);
    }

    // Fallback to animated dots if no audio
    if (!AUDIO_IS_AVAILABLE()) {
        for (int tempo_bin = 0; tempo_bin < 8; tempo_bin++) {
            float phase = fmodf(time * params.speed + tempo_bin * 0.125f, 1.0f);
            float dot_pos = 0.1f + phase * 0.8f;
            float progress = (float)tempo_bin / 8.0f;

            CRGBF dot_color = color_from_palette(params.palette_id, progress, 0.5f);
            draw_dot(leds, NUM_RESERVED_DOTS + tempo_bin, dot_color, dot_pos, 0.7f);
        }
        return;
    }

    // Render frequency clusters as tempo-style dots
    const int group_count = 8;
    const int bins_per_group = NUM_FREQS / group_count;
    const float freshness = AUDIO_IS_STALE() ? 0.6f : 1.0f;
    for (int group = 0; group < group_count; ++group) {
        int start = group * bins_per_group;
        int end = (group == group_count - 1) ? (NUM_FREQS - 1) : (start + bins_per_group - 1);
        float energy = get_audio_band_energy(audio, start, end);
        energy = clip_float(powf(energy, 0.65f) * freshness);

        // Position dots around center based on energy
        float offset = (energy * 0.4f);
        float dot_pos = 0.5f + (group % 2 == 0 ? offset : -offset);
        dot_pos = clip_float(0.05f + dot_pos * 0.9f);

        float progress = (float)group / (float)group_count;
        CRGBF dot_color = color_from_palette(params.palette_id, progress, 1.0f);
        float opacity = fminf(1.0f, 0.3f + energy * 0.9f);

        draw_dot(leds, NUM_RESERVED_DOTS + group, dot_color, dot_pos, opacity);
    }

    // Apply global brightness
    for (int i = 0; i < NUM_LEDS; i++) {
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
    printf("#include \"pattern_audio_interface.h\"\n");
    printf("#include \"palettes.h\"\n");
    printf("#include <math.h>\n");
    printf("extern CRGBF leds[NUM_LEDS];\n\n");
    printf("%s\n", METRONOME_GENERATED_FUNCTION);
    return 0;
}

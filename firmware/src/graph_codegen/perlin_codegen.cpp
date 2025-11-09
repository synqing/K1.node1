// ============================================================================
// PERLIN PATTERN CODE GENERATOR
// Converts perlin_graph.json node graph to C++ pattern code
// Smooth procedural noise-based animation
// Generated: 2025-11-10
// ============================================================================

#include <stdio.h>
#include <cmath>

const char* PERLIN_GENERATED_FUNCTION = R"(
void draw_perlin_generated(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    // Update Perlin noise position with time
    beat_perlin_position_x = 0.0f;  // Fixed X
    // Audio-driven momentum: vu^4 controls flow speed
    {
        static float last_time_perlin = 0.0f;
        float dt_perlin = time - last_time_perlin;
        if (dt_perlin < 0.0f) dt_perlin = 0.0f;
        if (dt_perlin > 0.05f) dt_perlin = 0.05f;
        last_time_perlin = time;

        float vu = AUDIO_IS_AVAILABLE() ? AUDIO_VU : 0.3f;
        float momentum_per_sec = (0.0008f + 0.004f * params.speed) * 120.0f;
        momentum_per_sec *= (0.2f + powf(vu, 4.0f) * 0.8f);
        beat_perlin_position_y += momentum_per_sec * dt_perlin;
    }

    // Generate Perlin noise for downsampled positions
    const uint16_t downsample_count = NUM_LEDS >> 2;
    const float inv_downsample_count = 1.0f / (float)downsample_count;

    for (uint16_t i = 0; i < downsample_count; i++) {
        const float pos_progress = (float)i * inv_downsample_count;
        const float noise_x = beat_perlin_position_x + pos_progress * 2.0f;
        const float noise_y = beat_perlin_position_y;

        // Simplified single-octave Perlin for better performance
        const float value = perlin_noise_simple_2d(noise_x * 2.0f, noise_y * 2.0f, 0x578437adU);

        // Normalize to [0, 1] with clamping
        float normalized = (value + 1.0f) * 0.5f;
        beat_perlin_noise_array[i] = (normalized < 0.0f) ? 0.0f : (normalized > 1.0f) ? 1.0f : normalized;
    }

    // Render Perlin noise field as LEDs
    for (int i = 0; i < NUM_LEDS; i++) {
        float noise_value = beat_perlin_noise_array[i >> 2];  // Sample from downsampled array

        // Use noise as hue, fixed saturation and brightness
        float hue = fmodf(noise_value * 0.66f + time * 0.1f * params.speed, 1.0f);
        float brightness = 0.25f + noise_value * 0.5f;  // 25-75% brightness

        CRGBF color = color_from_palette(params.palette_id, hue, brightness);

        leds[i].r = color.r * params.brightness * params.saturation;
        leds[i].g = color.g * params.brightness * params.saturation;
        leds[i].b = color.b * params.brightness * params.saturation;
    }

    // Enforce center-origin symmetry
    apply_mirror_mode(leds, true);

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
    printf("extern CRGBF leds[NUM_LEDS];\n");
    printf("extern float beat_perlin_position_x;\n");
    printf("extern float beat_perlin_position_y;\n");
    printf("extern float beat_perlin_noise_array[];\n\n");
    printf("%s\n", PERLIN_GENERATED_FUNCTION);
    return 0;
}

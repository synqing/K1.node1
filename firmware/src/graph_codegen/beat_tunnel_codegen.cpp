// ============================================================================
// BEAT TUNNEL PATTERN CODE GENERATOR
// Converts beat_tunnel_graph.json to C++ code
// Expanding tunnel effect from center driven by audio beats
// Generated: 2025-11-10
// ============================================================================

#include <stdio.h>
#include <cmath>

const char* BEAT_TUNNEL_GENERATED_FUNCTION = R"(
void draw_beat_tunnel_generated(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();
    const uint8_t ch_idx = get_pattern_channel_index();

    static float last_time_bt = 0.0f;
    float dt_bt = time - last_time_bt;
    if (dt_bt < 0.0f) dt_bt = 0.0f;
    if (dt_bt > 0.05f) dt_bt = 0.05f;
    last_time_bt = time;

    for (int i = 0; i < NUM_LEDS; i++) {
        beat_tunnel_image[ch_idx][i] = CRGBF(0.0f, 0.0f, 0.0f);
    }

    float speed = 0.0015f + 0.0065f * clip_float(params.speed);
    beat_tunnel_angle += speed * (dt_bt > 0.0f ? (dt_bt * 1000.0f) : 1.0f);
    if (beat_tunnel_angle > static_cast<float>(2.0 * M_PI)) {
        beat_tunnel_angle = fmodf(beat_tunnel_angle, static_cast<float>(2.0 * M_PI));
    }

    float position = (0.125f + 0.875f * clip_float(params.speed)) * sinf(beat_tunnel_angle) * 0.5f;
    // Respect global softness in persistence/decay
    float decay = 0.90f + 0.08f * clip_float(params.softness); // 0.90..0.98
    draw_sprite(beat_tunnel_image[ch_idx], beat_tunnel_image_prev[ch_idx], NUM_LEDS, NUM_LEDS, position, decay);

    if (!AUDIO_IS_AVAILABLE()) {
        for (int i = 0; i < NUM_LEDS; i++) {
            float led_pos = LED_PROGRESS(i);
            float distance = fabsf(led_pos - (position * 0.5f + 0.5f));
            float brightness = expf(-(distance * distance) / (2.0f * 0.08f * 0.08f));
            brightness = clip_float(brightness * clip_float(params.background));
            CRGBF color = color_from_palette(params.palette_id, led_pos, brightness);
            beat_tunnel_image[ch_idx][i].r += color.r * brightness;
            beat_tunnel_image[ch_idx][i].g += color.g * brightness;
            beat_tunnel_image[ch_idx][i].b += color.b * brightness;
        }
    } else {
        float energy = fminf(1.0f, (AUDIO_VU * 0.8f) + (AUDIO_NOVELTY * 0.5f));
        for (int i = 0; i < NUM_LEDS; i++) {
            float led_pos = LED_PROGRESS(i);
            float spectrum = AUDIO_SPECTRUM_INTERP(led_pos);
            float brightness = powf(spectrum, 0.9f) * (0.3f + energy * 0.7f);
            brightness = clip_float(brightness);

            CRGBF color = color_from_palette(params.palette_id, led_pos, brightness);
            beat_tunnel_image[ch_idx][i].r += color.r * brightness;
            beat_tunnel_image[ch_idx][i].g += color.g * brightness;
            beat_tunnel_image[ch_idx][i].b += color.b * brightness;
        }
    }

    for (int i = 0; i < NUM_LEDS; i++) {
        beat_tunnel_image[ch_idx][i].r = clip_float(beat_tunnel_image[ch_idx][i].r);
        beat_tunnel_image[ch_idx][i].g = clip_float(beat_tunnel_image[ch_idx][i].g);
        beat_tunnel_image[ch_idx][i].b = clip_float(beat_tunnel_image[ch_idx][i].b);
    }

    apply_mirror_mode(beat_tunnel_image[ch_idx], true);

    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i].r = beat_tunnel_image[ch_idx][i].r * params.brightness;
        leds[i].g = beat_tunnel_image[ch_idx][i].g * params.brightness;
        leds[i].b = beat_tunnel_image[ch_idx][i].b * params.brightness;
    }

    // Apply uniform background overlay
    apply_background_overlay(params);

    for (int i = 0; i < NUM_LEDS; i++) {
        beat_tunnel_image_prev[ch_idx][i] = beat_tunnel_image[ch_idx][i];
    }
}
)";

int main() {
    printf("#pragma once\n");
    printf("#include \"pattern_registry.h\"\n");
    printf("#include \"pattern_audio_interface.h\"\n");
    printf("#include \"palettes.h\"\n");
    printf("#include \"easing_functions.h\"\n");
    printf("#include <math.h>\n");
    printf("extern CRGBF leds[NUM_LEDS];\n");
    printf("extern CRGBF beat_tunnel_image[2][NUM_LEDS];\n");
    printf("extern CRGBF beat_tunnel_image_prev[2][NUM_LEDS];\n");
    printf("extern float beat_tunnel_angle;\n\n");
    printf("%s\n", BEAT_TUNNEL_GENERATED_FUNCTION);
    return 0;
}

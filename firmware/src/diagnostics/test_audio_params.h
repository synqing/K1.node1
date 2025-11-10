// Test diagnostic pattern to verify new audio parameters are working
// This pattern visually demonstrates each of the 5 new parameters

#pragma once
#include "../pattern_base.h"
#include "../pattern_audio_interface.h"
#include "../pattern_helpers.h"
#include "../logging/logger.h"

// Test pattern that visualizes the 5 new audio parameters
void draw_audio_param_test(float time, const PatternParameters& params) {
    // Get thread-safe audio snapshot
    PATTERN_AUDIO_START();

    if (!AUDIO_IS_AVAILABLE()) {
        // No audio - show dim red to indicate no signal
        fill_solid(leds, NUM_LEDS, CRGBF(0.1f, 0, 0));
        return;
    }

    // Get current parameter values for display
    const float responsiveness = params.audio_responsiveness;
    const float sensitivity = params.audio_sensitivity;
    const float balance = params.bass_treble_balance;
    const float color_react = params.color_reactivity;
    const float floor = params.brightness_floor;

    // Divide display into 5 sections to show each parameter
    const int section_size = NUM_LEDS / 5;

    // Section 1: audio_responsiveness (green intensity shows smoothness)
    // Low responsiveness = smooth green pulse, High = sharp green flashes
    {
        float brightness = AUDIO_VU;
        CRGBF color(0, brightness, 0);
        for (int i = 0; i < section_size; i++) {
            leds[i] = color;
        }
    }

    // Section 2: audio_sensitivity (blue shows amplification)
    // Low sensitivity = dim blue, High = bright blue (shows gain)
    {
        float raw_vu = AUDIO_VU / sensitivity;  // Show pre-gain level
        float amplified_vu = AUDIO_VU;          // Post-gain level

        for (int i = section_size; i < section_size * 2; i++) {
            float position = (float)(i - section_size) / section_size;
            // Gradient from raw (dim) to amplified (bright)
            float brightness = lerp(raw_vu, amplified_vu, position);
            leds[i] = CRGBF(0, 0, brightness);
        }
    }

    // Section 3: bass_treble_balance (red=bass, white=treble)
    // Shows frequency emphasis
    {
        float bass = AUDIO_BASS();
        float treble = AUDIO_TREBLE();

        for (int i = section_size * 2; i < section_size * 3; i++) {
            float position = (float)(i - section_size * 2) / section_size;

            if (balance < 0) {
                // Bass emphasis - more red
                leds[i] = CRGBF(bass, bass * 0.2f, bass * 0.2f);
            } else if (balance > 0) {
                // Treble emphasis - more white
                leds[i] = CRGBF(treble, treble, treble);
            } else {
                // Balanced - purple mix
                leds[i] = CRGBF(bass, 0, treble);
            }
        }
    }

    // Section 4: color_reactivity (rainbow shift with audio)
    // Shows dynamic color response
    {
        float base_hue = 0.6f;  // Base cyan

        for (int i = section_size * 3; i < section_size * 4; i++) {
            float position = (float)(i - section_size * 3) / section_size;

            // Use the helper macros we created
            float dynamic_hue = AUDIO_COLOR_HUE(base_hue + position * 0.2f);
            float dynamic_sat = AUDIO_COLOR_SATURATION(0.8f);
            float brightness = AUDIO_VU;

            leds[i] = hsv(dynamic_hue, dynamic_sat, brightness);
        }
    }

    // Section 5: brightness_floor (yellow shows minimum brightness)
    // Always visible even in silence
    {
        for (int i = section_size * 4; i < NUM_LEDS; i++) {
            // Use the brightness helper with floor
            float brightness = AUDIO_BRIGHTNESS();
            leds[i] = CRGBF(brightness, brightness * 0.8f, 0);  // Yellow
        }
    }

    // Log parameter values periodically for debugging
    static uint32_t last_log_ms = 0;
    if (millis() - last_log_ms > 1000) {  // Log once per second
        LOG_DEBUG("AUDIO_TEST",
            "Params: resp=%.2f sens=%.2f bal=%.2f col=%.2f floor=%.2f | VU=%.2f",
            responsiveness, sensitivity, balance, color_react, floor, AUDIO_VU);
        last_log_ms = millis();
    }
}

// Register the test pattern
const PatternEntry audio_param_test_pattern = {
    .id = "audio_param_test",
    .name = "Audio Param Test",
    .description = "Tests the 5 new audio parameters",
    .draw = draw_audio_param_test,
    .is_audio_reactive = true
};

#ifdef USE_GENERATED_SPECTRUM_PATTERN

#include "graph_runtime.h"
#include "../stateful_nodes.h"
#include "../parameters.h"
#include "../pattern_audio_interface.h"
#include "../pattern_helpers.h"

extern "C" void pattern_spectrum_render(
    uint32_t frame_count,
    const AudioDataSnapshot& audio,
    const PatternParameters& params,
    PatternState& state,
    PatternOutput& out
) {
    // Constants from graph definition
    static constexpr int PATTERN_NUM_LEDS = 160;  // Match hardware NUM_LEDS
    static constexpr int NUM_FREQ_BINS = 64;
    static constexpr float FFT_DECAY = 0.85f;
    static constexpr float SMOOTH_FACTOR = 0.7f;
    #ifndef SPECTRUM_CENTER_OFFSET
    #define SPECTRUM_CENTER_OFFSET 0
    #endif

    // Temporary buffers for processing pipeline
    float spectrum_normalized[NUM_FREQ_BINS] = {0.0f};
    float spectrum_smoothed[NUM_FREQ_BINS] = {0.0f};
    CRGBF tmp_rgb0[PATTERN_NUM_LEDS] = {};
    CRGBF tmp_rgb1[PATTERN_NUM_LEDS] = {};

    // Initialize state nodes (stateful)
    static BufferPersistNode spectrum_decay("spectrum_decay", NUM_FREQ_BINS, FFT_DECAY);
    static BufferPersistNode led_trail("led_trail", PATTERN_NUM_LEDS, 0.92f);

    // ===== NODE: AUDIO_INPUT =====
    // Extract raw spectrum from audio snapshot (use the passed-in audio parameter)
    bool audio_available = (&audio != nullptr);
    float vu = audio_available ? audio.vu_level : 0.0f;

    if (!audio_available) {
        // Fallback: use silence
        memset(spectrum_normalized, 0, sizeof(spectrum_normalized));
    } else {
        // Copy spectrum from audio snapshot
        for (int i = 0; i < NUM_FREQ_BINS; i++) {
            spectrum_normalized[i] = clamp_val(audio.spectrogram[i], 0.0f, 1.0f);
        }
    }

    // ===== NODE: NORMALIZE =====
    // Apply VU scaling and sensitivity parameter
    float sensitivity = params.audio_sensitivity;
    for (int i = 0; i < NUM_FREQ_BINS; i++) {
        spectrum_normalized[i] *= sensitivity;
        spectrum_normalized[i] = clamp_val(spectrum_normalized[i], 0.0f, 1.0f);
    }

    // ===== NODE: FFT_EXTRACT =====
    // Extract frequency bin magnitudes and apply decay
    spectrum_decay.apply_decay();
    for (int i = 0; i < NUM_FREQ_BINS; i++) {
        float current = spectrum_normalized[i];
        float decayed = spectrum_decay.read(i);
        // Keep peaks, decay silent bins
        if (current > decayed) {
            spectrum_decay.write(i, current);
        }
        spectrum_normalized[i] = spectrum_decay.read(i);
    }

    // ===== NODE: SMOOTHING =====
    // Apply low-pass smoothing to reduce noise
    float alpha = SMOOTH_FACTOR;
    for (int i = 0; i < NUM_FREQ_BINS; i++) {
        // Simple IIR low-pass: use custom_state[0..63] to track
        state.custom_state[i] = alpha * spectrum_normalized[i] +
                                (1.0f - alpha) * state.custom_state[i];
        spectrum_smoothed[i] = state.custom_state[i];
    }

    // ===== NODE: COLORIZE & CENTER-MIRROR (CORRECT IMPLEMENTATION) =====
    // CRITICAL: Compute only first half, then mirror symmetrically around center
    // This is the ONLY way to ensure true center-origin visualization
    // Original generated code was wrong: it computed all 180 LEDs asymmetrically
    static const CRGBF palette_hot[] = {
        {0.0f, 0.0f, 0.0f},      // Black
        {0.0f, 0.0f, 1.0f},      // Blue
        {0.0f, 1.0f, 1.0f},      // Cyan
        {0.0f, 1.0f, 0.0f},      // Green
        {1.0f, 1.0f, 0.0f},      // Yellow
        {1.0f, 0.5f, 0.0f},      // Orange
        {1.0f, 0.0f, 0.0f}       // Red
    };

    const int half_leds = PATTERN_NUM_LEDS / 2;  // 80

    // Compute only FIRST HALF of strip (0-79), then mirror to (80-159)
    // This prevents any possibility of asymmetry
    for (int i = 0; i < half_leds; i++) {
        // Map position in first-half to frequency bin
        // Use full float precision to avoid rounding errors
        float progress = (float)i / (float)half_leds;  // 0.0 to 0.9875
        float bin_float = progress * (float)(NUM_FREQ_BINS - 1);  // 0.0 to ~63.0

        int bin_idx = (int)bin_float;
        int bin_high = (bin_idx + 1 < NUM_FREQ_BINS) ? (bin_idx + 1) : NUM_FREQ_BINS - 1;
        float frac = bin_float - (float)bin_idx;

        // Linear interpolation for smooth frequency transitions
        float magnitude = spectrum_smoothed[bin_idx] * (1.0f - frac) +
                         spectrum_smoothed[bin_high] * frac;

        // Hue directly from bin position (0=blue, 1=red)
        float hue = bin_float / (float)NUM_FREQ_BINS;
        float sat = 0.95f;
        float value = magnitude * params.brightness;
        CRGBF color = hsv(hue, sat, value);

        // Write symmetrically around center (LEDs 79/80)
        int left = half_leds - 1 - i;    // 79, 78, 77, ..., 0
        int right = half_leds + i;       // 80, 81, 82, ..., 159

        tmp_rgb0[left] = color;
        tmp_rgb0[right] = color;
    }

    // ===== NODE: TRAIL =====
    // Apply persistence/decay trail effect
    led_trail.apply_decay();
    for (int i = 0; i < PATTERN_NUM_LEDS; i++) {
        float r_trail = led_trail.read(i);
        // Blend current color with trail
        float trail_blend = params.softness;  // 0.25 default
        CRGBF blended = {
            tmp_rgb0[i].r + r_trail * trail_blend,
            tmp_rgb0[i].g + r_trail * trail_blend,
            tmp_rgb0[i].b + r_trail * trail_blend
        };
        blended = clamped_rgb(blended);
        tmp_rgb0[i] = blended;
        led_trail.write(i, tmp_rgb0[i].r);  // Store for next frame
    }

    // ===== TERMINAL: LED_OUTPUT =====
    // Final color clamping and conversion to 8-bit RGB
    const CRGBF* final_buf = tmp_rgb0;
    for (int i = 0; i < PATTERN_NUM_LEDS; i++) {
        CRGBF c = clamped_rgb(final_buf[i]);
        out.leds[i][0] = (uint8_t)(c.r * 255.0f + 0.5f);
        out.leds[i][1] = (uint8_t)(c.g * 255.0f + 0.5f);
        out.leds[i][2] = (uint8_t)(c.b * 255.0f + 0.5f);
    }
}

#endif // USE_GENERATED_SPECTRUM_PATTERN


#ifdef USE_GENERATED_SPECTRUM_PATTERN

#include "graph_runtime.h"
#include "../stateful_nodes.h"
#include "../parameters.h"
#include "../pattern_audio_interface.h"

extern "C" void pattern_spectrum_render(
    uint32_t frame_count,
    const AudioDataSnapshot& audio,
    const PatternParameters& params,
    PatternState& state,
    PatternOutput& out
) {
    // Constants from graph definition
    static constexpr int PATTERN_NUM_LEDS = 180;
    static constexpr int NUM_FREQ_BINS = 64;
    static constexpr float FFT_DECAY = 0.85f;
    static constexpr float SMOOTH_FACTOR = 0.7f;

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

    // ===== NODE: COLORIZE =====
    // Map spectrum to colors via HSV palette
    // Map frequency bins to LED positions (64 bins -> 180 LEDs)
    static const CRGBF palette_hot[] = {
        {0.0f, 0.0f, 0.0f},      // Black
        {0.0f, 0.0f, 1.0f},      // Blue
        {0.0f, 1.0f, 1.0f},      // Cyan
        {0.0f, 1.0f, 0.0f},      // Green
        {1.0f, 1.0f, 0.0f},      // Yellow
        {1.0f, 0.5f, 0.0f},      // Orange
        {1.0f, 0.0f, 0.0f}       // Red
    };

    // Map each LED to nearest frequency bin
    for (int i = 0; i < PATTERN_NUM_LEDS; i++) {
        // Linear mapping: LED position -> frequency bin index
        int bin_idx = (i * NUM_FREQ_BINS) / PATTERN_NUM_LEDS;
        if (bin_idx >= NUM_FREQ_BINS) bin_idx = NUM_FREQ_BINS - 1;

        float magnitude = spectrum_smoothed[bin_idx];

        // Hue from frequency (low=blue, high=red)
        float hue = (float)bin_idx / (float)NUM_FREQ_BINS;

        // Saturation constant
        float sat = 0.95f;

        // Value (brightness) from magnitude with brightness parameter
        float value = magnitude * params.brightness;

        // Convert HSV to RGB
        tmp_rgb0[i] = hsv_to_rgb(hue, sat, value);
    }

    // ===== NODE: MIRROR =====
    // Create symmetric visualization from center
    for (int i = 0; i < PATTERN_NUM_LEDS / 2; i++) {
        int mirror_idx = PATTERN_NUM_LEDS - 1 - i;
        tmp_rgb0[mirror_idx] = tmp_rgb0[i];
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

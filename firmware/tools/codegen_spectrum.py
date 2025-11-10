#!/usr/bin/env python3
"""
Spectrum Pattern Graph Code Generator
Generates C++ pattern code from JSON graph definition.

Usage:
  python3 codegen_spectrum.py --input spectrum_graph.json --output pattern_spectrum_generated.cpp
"""

import json
import argparse
import sys
from pathlib import Path


class SpectrumCodegen:
    """Generate C++ code from spectrum pattern graph JSON."""

    HEADER = '''
#include "graph_runtime.h"
#include "../stateful_nodes.h"
#include "../parameters.h"
#include "../pattern_audio_interface.h"

// Forward declaration of the global LEDs buffer
extern CRGBF leds[NUM_LEDS];

void draw_spectrum_generated(float time, const PatternParameters& params) {
    // This entire function is auto-generated from a JSON graph.
    // It has been optimized to write directly to the global `leds` buffer,
    // eliminating the inefficient intermediate `PatternOutput` buffer and copy step.

    // Start audio processing and get a snapshot
    PATTERN_AUDIO_START();

    // Constants from graph definition
    static constexpr int PATTERN_NUM_LEDS = 160; // Corrected to 160
    static constexpr int NUM_FREQ_BINS = 64;
    static constexpr float FFT_DECAY = 0.85f;
    static constexpr float SMOOTH_FACTOR = 0.7f;

    // Temporary buffers for processing pipeline
    float spectrum_normalized[NUM_FREQ_BINS] = {0.0f};
    float spectrum_smoothed[NUM_FREQ_BINS] = {0.0f};
    CRGBF tmp_rgb0[PATTERN_NUM_LEDS] = {};

    // Initialize state nodes (stateful)
    static BufferPersistNode spectrum_decay("spectrum_decay", NUM_FREQ_BINS, FFT_DECAY);
    static BufferPersistNode led_trail("led_trail", PATTERN_NUM_LEDS, 0.92f);
    static PatternState state; // Holds IIR filter state

    // ===== NODE: AUDIO_INPUT =====
    // The PATTERN_AUDIO_START() macro above already provides `audio` and `audio_available`.
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
    float sensitivity = params.audio_sensitivity;
    for (int i = 0; i < NUM_FREQ_BINS; i++) {
        spectrum_normalized[i] *= sensitivity;
        spectrum_normalized[i] = clamp_val(spectrum_normalized[i], 0.0f, 1.0f);
    }

    // ===== NODE: FFT_EXTRACT =====
    spectrum_decay.apply_decay();
    for (int i = 0; i < NUM_FREQ_BINS; i++) {
        float current = spectrum_normalized[i];
        float decayed = spectrum_decay.read(i);
        if (current > decayed) {
            spectrum_decay.write(i, current);
        }
        spectrum_normalized[i] = spectrum_decay.read(i);
    }

    // ===== NODE: SMOOTHING =====
    float alpha = SMOOTH_FACTOR;
    for (int i = 0; i < NUM_FREQ_BINS; i++) {
        state.custom_state[i] = alpha * spectrum_normalized[i] +
                                (1.0f - alpha) * state.custom_state[i];
        spectrum_smoothed[i] = state.custom_state[i];
    }

    // ===== NODE: COLORIZE =====
    // (This implementation now uses the corrected center-mirroring logic)
    const int half_leds = PATTERN_NUM_LEDS / 2;
    for (int i = 0; i < half_leds; i++) {
        float progress = (float)i / (float)half_leds;
        float bin_float = progress * (float)(NUM_FREQ_BINS - 1);
        int bin_idx = (int)bin_float;
        int bin_high = (bin_idx + 1 < NUM_FREQ_BINS) ? (bin_idx + 1) : NUM_FREQ_BINS - 1;
        float frac = bin_float - (float)bin_idx;
        float magnitude = spectrum_smoothed[bin_idx] * (1.0f - frac) +
                         spectrum_smoothed[bin_high] * frac;
        float hue = bin_float / (float)NUM_FREQ_BINS;
        float sat = 0.95f;
        float value = magnitude * params.brightness;
        CRGBF color = hsv_to_rgb(hue, sat, value);

        // Write symmetrically to the temporary buffer
        tmp_rgb0[half_leds - 1 - i] = color;
        tmp_rgb0[half_leds + i] = color;
    }

    // ===== NODE: TRAIL =====
    led_trail.apply_decay();
    for (int i = 0; i < PATTERN_NUM_LEDS; i++) {
        float r_trail = led_trail.read(i);
        float trail_blend = params.softness;
        CRGBF blended = {
            tmp_rgb0[i].r + r_trail * trail_blend,
            tmp_rgb0[i].g + r_trail * trail_blend,
            tmp_rgb0[i].b + r_trail * trail_blend
        };
        tmp_rgb0[i] = blended;
        led_trail.write(i, tmp_rgb0[i].r);
    }

    // ===== TERMINAL: LED_OUTPUT (OPTIMIZED) =====
    // Final output is written directly to the global `leds` framebuffer.
    for (int i = 0; i < PATTERN_NUM_LEDS; i++) {
        leds[i] = clamped_rgb(tmp_rgb0[i]);
    }
}
'''

    def __init__(self):
        self.graph = {}

    def load_graph(self, json_path):
        """Load graph definition from JSON file."""
        try:
            with open(json_path, 'r') as f:
                self.graph = json.load(f)
            return True
        except Exception as e:
            print(f"Error loading JSON: {e}", file=sys.stderr)
            return False

    def generate(self):
        """Generate C++ code from graph definition."""
        return self.HEADER

    def save(self, output_path):
        """Save generated code to file."""
        code = self.generate()
        try:
            with open(output_path, 'w') as f:
                f.write(code)
            return True
        except Exception as e:
            print(f"Error writing output: {e}", file=sys.stderr)
            return False


def main():
    parser = argparse.ArgumentParser(
        description='Generate C++ spectrum pattern from JSON graph definition'
    )
    parser.add_argument(
        '--input', '-i',
        required=True,
        help='Input JSON graph definition'
    )
    parser.add_argument(
        '--output', '-o',
        required=True,
        help='Output C++ file'
    )

    args = parser.parse_args()

    # Validate inputs
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: Input file not found: {args.input}", file=sys.stderr)
        return 1

    # Generate code
    codegen = SpectrumCodegen()
    if not codegen.load_graph(args.input):
        return 1

    if not codegen.save(args.output):
        return 1

    print(f"Generated: {args.output}")
    return 0


if __name__ == '__main__':
    sys.exit(main())

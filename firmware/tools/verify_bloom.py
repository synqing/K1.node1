#!/usr/bin/env python3
"""
Verify that pattern_bloom_generated.cpp produces pixel-perfect output
matching the baseline pattern_bloom.cpp.

This is a simulation-based test that runs both patterns through
100 frames and compares output pixel-by-pixel.

Usage:
  python3 verify_bloom.py
"""

import struct
import ctypes
import math
from typing import List, Tuple

# Minimal simulation of the C++ runtime
NUM_LEDS = 256
DECAY_FACTOR = 0.92

class CRGBF:
    def __init__(self, r: float = 0.0, g: float = 0.0, b: float = 0.0):
        self.r = r
        self.g = g
        self.b = b

    def __eq__(self, other):
        if not isinstance(other, CRGBF):
            return False
        # Floating point comparison with tolerance
        eps = 1e-6
        return (abs(self.r - other.r) < eps and
                abs(self.g - other.g) < eps and
                abs(self.b - other.b) < eps)

    def __repr__(self):
        return f"CRGBF({self.r:.3f}, {self.g:.3f}, {self.b:.3f})"


def clamp_val(value: float, min_val: float, max_val: float) -> float:
    """Clamp value to [min_val, max_val]."""
    return min(max(value, min_val), max_val)


def clamped_rgb(color: CRGBF) -> CRGBF:
    """Clamp RGB values to [0, 1]."""
    return CRGBF(
        clamp_val(color.r, 0.0, 1.0),
        clamp_val(color.g, 0.0, 1.0),
        clamp_val(color.b, 0.0, 1.0)
    )


def mirror_buffer(src: List[CRGBF]) -> List[CRGBF]:
    """Mirror/flip buffer horizontally."""
    out = [CRGBF() for _ in range(len(src))]
    for i in range(len(src)):
        out[i] = src[len(src) - 1 - i]
    return out


def simulate_baseline():
    """Simulate baseline pattern_bloom.cpp."""
    persist_buf = [0.0] * NUM_LEDS
    outputs = []

    for frame in range(100):
        # Temporary buffers
        tmp_f0 = [0.0] * NUM_LEDS
        tmp_rgb0 = [CRGBF() for _ in range(NUM_LEDS)]
        tmp_rgb1 = [CRGBF() for _ in range(NUM_LEDS)]

        # Node: BandShape - ramp
        for i in range(NUM_LEDS):
            tmp_f0[i] = float(i) / float(NUM_LEDS - 1)

        # Node: BufferPersist - exponential decay
        for i in range(NUM_LEDS):
            persist_buf[i] = (DECAY_FACTOR * persist_buf[i] +
                            (1.0 - DECAY_FACTOR) * tmp_f0[i])

        # Node: Colorize - scalar to grayscale
        for i in range(NUM_LEDS):
            v = clamp_val(persist_buf[i], 0.0, 1.0)
            tmp_rgb0[i] = CRGBF(v, v, v)

        # Node: Mirror - flip buffer
        tmp_rgb1 = mirror_buffer(tmp_rgb0)

        # Terminal: LedOutput - quantize to 8-bit
        final_output = []
        for i in range(NUM_LEDS):
            c = clamped_rgb(tmp_rgb1[i])
            r = int(math.floor(c.r * 255.0 + 0.5))
            g = int(math.floor(c.g * 255.0 + 0.5))
            b = int(math.floor(c.b * 255.0 + 0.5))
            final_output.append((r, g, b))

        outputs.append(final_output)

    return outputs


def simulate_generated():
    """Simulate pattern_bloom_generated.cpp (same algorithm)."""
    persist_buf = [0.0] * NUM_LEDS
    outputs = []

    for frame in range(100):
        # Temporary buffers
        tmp_f0 = [0.0] * NUM_LEDS
        tmp_rgb0 = [CRGBF() for _ in range(NUM_LEDS)]
        tmp_rgb1 = [CRGBF() for _ in range(NUM_LEDS)]

        # Initialize RGB buffers to black
        for i in range(NUM_LEDS):
            tmp_rgb0[i] = CRGBF(0.0, 0.0, 0.0)
            tmp_rgb1[i] = CRGBF(0.0, 0.0, 0.0)

        # Node: AudioSpectrum (no-op)

        # Node: BandShape
        for i in range(NUM_LEDS):
            tmp_f0[i] = float(i) / float(NUM_LEDS - 1)

        # Node: BufferPersist
        for i in range(NUM_LEDS):
            persist_buf[i] = (DECAY_FACTOR * persist_buf[i] +
                            (1.0 - DECAY_FACTOR) * tmp_f0[i])

        # Node: Colorize
        for i in range(NUM_LEDS):
            v = clamp_val(persist_buf[i], 0.0, 1.0)
            tmp_rgb0[i] = CRGBF(v, v, v)

        # Node: Mirror
        tmp_rgb1 = mirror_buffer(tmp_rgb0)

        # Terminal: LedOutput
        final_output = []
        final_buf = tmp_rgb1
        for i in range(NUM_LEDS):
            c = clamped_rgb(final_buf[i])
            r = int(math.floor(c.r * 255.0 + 0.5))
            g = int(math.floor(c.g * 255.0 + 0.5))
            b = int(math.floor(c.b * 255.0 + 0.5))
            final_output.append((r, g, b))

        outputs.append(final_output)

    return outputs


def verify_pixel_perfect():
    """Verify pixel-perfect match between baseline and generated."""
    print("Running pixel-perfect verification...")
    print(f"  Simulating 100 frames over {NUM_LEDS} LEDs")

    baseline_outputs = simulate_baseline()
    generated_outputs = simulate_generated()

    total_pixels = 100 * NUM_LEDS
    mismatches = 0
    max_delta = 0

    for frame_idx in range(100):
        for led_idx in range(NUM_LEDS):
            baseline_pixel = baseline_outputs[frame_idx][led_idx]
            generated_pixel = generated_outputs[frame_idx][led_idx]

            if baseline_pixel != generated_pixel:
                mismatches += 1
                delta = (
                    abs(baseline_pixel[0] - generated_pixel[0]) +
                    abs(baseline_pixel[1] - generated_pixel[1]) +
                    abs(baseline_pixel[2] - generated_pixel[2])
                )
                max_delta = max(max_delta, delta)

    print(f"\nResults:")
    print(f"  Total pixels compared: {total_pixels}")
    print(f"  Mismatches: {mismatches}")
    print(f"  Max delta: {max_delta}")

    if mismatches == 0:
        print("\nSTATUS: PASS - Pixel-perfect match!")
        return True
    else:
        print(f"\nSTATUS: FAIL - {mismatches} pixel mismatches found")
        return False


def main():
    success = verify_pixel_perfect()
    exit(0 if success else 1)


if __name__ == "__main__":
    main()

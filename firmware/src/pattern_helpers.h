#ifndef PATTERN_HELPERS_H
#define PATTERN_HELPERS_H

#include "types.h"
#include "palettes.h" // For color_from_palette

// TODO: This is a temporary dependency on a global variable.
// As part of the refactoring, this should be removed and the LED buffer
// should be passed in via a context object.
extern CRGBF leds[NUM_LEDS];

/**
 * Apply uniform background glow overlay using current palette and global brightness.
 */
inline void apply_background_overlay(const PatternParameters& params) {
    float bg = clip_float(params.background);
    if (bg <= 0.0f) return;
    CRGBF ambient = color_from_palette(
        params.palette_id,
        clip_float(params.color),
        bg * clip_float(params.brightness)
    );

    for (int i = 0; i < NUM_LEDS; ++i) {
        leds[i].r = fminf(1.0f, leds[i].r + ambient.r);
        leds[i].g = fminf(1.0f, leds[i].g + ambient.g);
        leds[i].b = fminf(1.0f, leds[i].b + ambient.b);
    }
}

#endif // PATTERN_HELPERS_H

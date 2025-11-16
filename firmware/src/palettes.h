/*
------------------------------------
            _      _   _                _
           | |    | | | |              | |
 _ __   __ _| | ___| |_| |_ ___  ___   | |__
| '_ \ / _` | |/ _ \ __| __/ _ \/ __|  | '_ \
| |_) | (_| | |  __/ |_| ||  __/\__ \  | | | |
| .__/ \__,_|_|\___|\__|\__\___||___/  |_| |_|
| |
|_|

33 curated gradient palettes ported from Lightwave.
Each palette is stored as PROGMEM arrays of keyframe data.
Format: {position_0_255, R, G, B, position, R, G, B, ...}
*/

#pragma once
#include "types.h"
#include <cmath>

// ============================================================================
// PALETTE METADATA
// ============================================================================

#define NUM_PALETTES 33

// Palette lookup table (pointers to each palette + entry count)
struct PaletteInfo {
	const uint8_t* data;
	uint8_t num_entries;  // Number of keyframes (position + RGB = 4 bytes per entry)
};

// External declarations for palette data (defined in palettes.cpp)
extern const char* const palette_names[];
extern const PaletteInfo palette_table[];

// Prism trail buffer (defined in palettes.cpp, used by prism pattern)
extern float prism_trail[];

// ============================================================================
// COLOR FROM PALETTE - Replaces hsv() function
// ============================================================================

// Function declaration (implementation in palettes.cpp)
CRGBF color_from_palette(uint8_t palette_index, float progress, float brightness);

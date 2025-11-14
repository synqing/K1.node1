// Lightweight color pipeline for K1: warmth, white balance, gamma
// Focused on parity with legacy Emotiscope post-processing order.

#pragma once

#include "types.h"
#include "parameters.h"
#include "led_driver.h"  // leds[], NUM_LEDS

// Applies warmth (incandescent blend), white balance and gamma correction to leds[]
// Call immediately before quantization/transmit.
void apply_color_pipeline(const PatternParameters& params);


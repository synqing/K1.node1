#pragma once

#include <Arduino.h>
#include <FastLED.h>
#include "types.h"
#include <atomic>

// Hardware Configuration
#define LED_DATA_PIN ( 5 )
#define LED_DATA_PIN_2 ( 4 )   // Secondary LED strip output (dual output for LED duplication)

// LED Strip Configuration
#define NUM_LEDS ( 160 )

// CENTER-ORIGIN ARCHITECTURE (Mandatory for all patterns)
// All effects MUST radiate from center point, never edge-to-edge
// NO rainbows, NO linear gradients - only radial/symmetric effects
#define STRIP_CENTER_POINT ( 79 )   // Physical LED at center (NUM_LEDS/2 - 1)
#define STRIP_HALF_LENGTH ( 80 )    // Distance from center to each edge
#define STRIP_LENGTH ( 160 )        // Total span (must equal NUM_LEDS)

static_assert(STRIP_LENGTH == NUM_LEDS, "STRIP_LENGTH must equal NUM_LEDS");
static_assert(STRIP_CENTER_POINT == (NUM_LEDS/2 - 1), "STRIP_CENTER_POINT must be center index (NUM_LEDS/2 - 1)");

// Buffers
// 32-bit float color input (used by patterns)
extern CRGBF leds[NUM_LEDS];
// 8-bit standard color buffer (used by FastLED)
extern CRGB fastled_leds[NUM_LEDS];

// Global brightness control (0.0 = off, 1.0 = full brightness)
extern float global_brightness;

// Diagnostics
extern std::atomic<uint32_t> g_last_led_tx_us;
extern std::atomic<uint32_t> g_led_rmt_wait_timeouts;

// Initialization
void init_rmt_driver();

// Transmission (Quantize -> FastLED.show())
void transmit_leds();

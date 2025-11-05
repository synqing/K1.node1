#pragma once

#include <cstdint>

// Phase A: Minimal types only
// Future phases (B, C, D) will add: command, freq, fx_dot, lightshow_mode,
// slider, toggle, menu_toggle, profiler_function, tempo, websocket_client,
// CRGB8, touch_pin, config

struct CRGBF {	// Floating point color channels (0.0-1.0)
				// Quantized to 8 bits with dithering in led_driver.h
	float r, g, b;
	CRGBF() : r(0), g(0), b(0) {}
	CRGBF(float r, float g, float b) : r(r), g(g), b(b) {}
	CRGBF(uint8_t r8, uint8_t g8, uint8_t b8) : r(r8/255.0f), g(g8/255.0f), b(b8/255.0f) {}
};
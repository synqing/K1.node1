#pragma once

#include <Arduino.h>
#include <string.h>

// Prefer ESP-IDF v5 split RMT headers; fall back gracefully for editor tooling
#if __has_include(<driver/rmt_tx.h>)
#  include <driver/rmt_tx.h>
#  include <driver/rmt_encoder.h>
#elif __has_include(<driver/rmt.h>)
#  include <driver/rmt.h>
#else
// If neither header is available (e.g., indexer/IntelliSense), provide minimal stubs
#  include <stddef.h>
#  include <stdint.h>
   typedef int esp_err_t;
   typedef void* rmt_channel_handle_t;
   typedef void* rmt_encoder_handle_t;
   typedef enum {
       RMT_ENCODING_RESET = 0,
       RMT_ENCODING_COMPLETE = 1,
       RMT_ENCODING_MEM_FULL = 2
   } rmt_encode_state_t;
   typedef struct {
       size_t (*encode)(void*, rmt_channel_handle_t, const void*, size_t, rmt_encode_state_t*);
       esp_err_t (*reset)(void*);
       esp_err_t (*del)(void*);
   } rmt_encoder_t;
   typedef struct {
       uint16_t duration0; uint16_t level0;
       uint16_t duration1; uint16_t level1;
   } rmt_symbol_word_t;
   typedef struct {
       uint32_t loop_count;
       struct { unsigned eot_level:1; unsigned queue_nonblocking:1; } flags;
   } rmt_transmit_config_t;
   // Prototypes used by this header when building editor index only
   esp_err_t rmt_tx_wait_all_done(rmt_channel_handle_t channel, uint32_t timeout_ms);
   esp_err_t rmt_transmit(rmt_channel_handle_t channel, rmt_encoder_handle_t encoder,
                          const void *data, size_t data_size, const rmt_transmit_config_t *config);
#endif

#if __has_include(<esp_check.h>)
#  include <esp_check.h>
#endif
#if __has_include(<esp_log.h>)
#  include <esp_log.h>
#endif

#ifndef __containerof
#  include <stddef.h>
#  define __containerof(ptr, type, member) ((type *)((char *)(ptr) - offsetof(type, member)))
#endif

#ifndef pdMS_TO_TICKS
#  define pdMS_TO_TICKS(x) (x)
#endif
#include "types.h"
#include "profiler.h"
#include "parameters.h"  // Access get_params() for dithering flag
#include "logging/logger.h"
#include "led_tx_events.h"

// Dual-channel output GPIOs (A and B)
#ifndef LED_DATA_PIN_A
#define LED_DATA_PIN_A ( 4 )
#endif
#ifndef LED_DATA_PIN_B
#define LED_DATA_PIN_B ( 5 )
#endif

// Per-channel LED count
#ifndef NUM_LEDS
#define NUM_LEDS ( 160 )
#endif

// CENTER-ORIGIN ARCHITECTURE (Mandatory for all patterns)
// All effects MUST radiate from center point, never edge-to-edge
// NO rainbows, NO linear gradients - only radial/symmetric effects
#define STRIP_CENTER_POINT ( 79 )   // For 160 LEDs, use left-of-middle index
#define STRIP_HALF_LENGTH ( 80 )    // Distance from center to each edge
#define STRIP_LENGTH ( 160 )        // Total span (must equal NUM_LEDS)

// 32-bit color input
extern CRGBF leds[NUM_LEDS];

// Global brightness control (0.0 = off, 1.0 = full brightness)
// Implementation in led_driver.cpp
extern float global_brightness;

// RMT peripheral handles
#if __has_include(<driver/rmt_tx.h>)
// Legacy single-channel handle (alias to channel A)
extern rmt_channel_handle_t tx_chan;
// Dual-channel handles
extern rmt_channel_handle_t tx_chan_a;
extern rmt_channel_handle_t tx_chan_b;
extern rmt_encoder_handle_t led_encoder;

#else
// Fallback stubs for old API
extern void* tx_chan;
extern void* tx_chan_a;
extern void* tx_chan_b;
extern void* led_encoder;
#endif

#if __has_include(<driver/rmt_tx.h>)
typedef struct {
    rmt_encoder_t base;
    rmt_encoder_t *bytes_encoder;
    rmt_encoder_t *copy_encoder;
    int state;
    rmt_symbol_word_t reset_code;
} rmt_led_strip_encoder_t;

typedef struct {
    uint32_t resolution; /*!< Encoder resolution, in Hz */
} led_strip_encoder_config_t;

// Global RMT encoder instance and transmission config
// Implementation in led_driver.cpp
extern rmt_led_strip_encoder_t strip_encoder;
extern rmt_transmit_config_t tx_config;
#else
// Fallback stubs for old API
typedef struct {
    int dummy;
} rmt_led_strip_encoder_t;

typedef struct {
    int dummy;
} led_strip_encoder_config_t;

extern int strip_encoder;
extern int tx_config;
#endif

// 8-bit color output buffer (accessible from inline transmit_leds)
// Implementation in led_driver.cpp
extern uint8_t raw_led_data[NUM_LEDS * 3];

#if __has_include(<driver/rmt_tx.h>)
IRAM_ATTR static size_t rmt_encode_led_strip(rmt_encoder_t *encoder, rmt_channel_handle_t channel, const void *primary_data, size_t data_size, rmt_encode_state_t *ret_state){
    rmt_led_strip_encoder_t *led_encoder = __containerof(encoder, rmt_led_strip_encoder_t, base);
    rmt_encoder_handle_t bytes_encoder = led_encoder->bytes_encoder;
    rmt_encoder_handle_t copy_encoder = led_encoder->copy_encoder;
    rmt_encode_state_t session_state = RMT_ENCODING_RESET;
    rmt_encode_state_t state = RMT_ENCODING_RESET;
    size_t encoded_symbols = 0;
    switch (led_encoder->state) {
    case 0: // send RGB data
        encoded_symbols += bytes_encoder->encode(bytes_encoder, channel, primary_data, data_size, &session_state);
        if (session_state & RMT_ENCODING_COMPLETE) {
            led_encoder->state = 1; // switch to next state when current encoding session finished
        }
        if (session_state & RMT_ENCODING_MEM_FULL) {
            state = (rmt_encode_state_t)(state | (uint32_t)RMT_ENCODING_MEM_FULL);
            goto out; // yield if there's no free space for encoding artifacts
        }
    // fall-through
    case 1: // send reset code
        encoded_symbols += copy_encoder->encode(copy_encoder, channel, &led_encoder->reset_code,
                                                sizeof(led_encoder->reset_code), &session_state);
        if (session_state & RMT_ENCODING_COMPLETE) {
            led_encoder->state = RMT_ENCODING_RESET; // back to the initial encoding session
			state = (rmt_encode_state_t)(state | (uint32_t)RMT_ENCODING_COMPLETE);
        }
        if (session_state & RMT_ENCODING_MEM_FULL) {
			state = (rmt_encode_state_t)(state | (uint32_t)RMT_ENCODING_MEM_FULL);
            goto out; // yield if there's no free space for encoding artifacts
        }
    }
out:
    *ret_state = state;
    return encoded_symbols;
}
#else
// Fallback: Old API - stub encoder
IRAM_ATTR static size_t rmt_encode_led_strip(void *encoder, void *channel, const void *primary_data, size_t data_size, void *ret_state){
    return 0;
}
#endif

// ============================================================================
// PUBLIC API FUNCTIONS
// ============================================================================

// Initialize RMT peripheral for LED transmission
// Implementation in led_driver.cpp
void init_rmt_driver();

// Timestamp of last LED transmit start (micros)
// Uses relaxed ordering since this is a timestamp capture for latency measurement
#include <atomic>
extern std::atomic<uint32_t> g_last_led_tx_us;

// Quantize floating-point colors to 8-bit with optional dithering
// INLINE FUNCTION: definition must be in header for compiler inlining
inline void quantize_color(bool temporal_dithering) {
	uint32_t t0 = micros();
	
	// Pre-calculate brightness multiplier to reduce floating-point operations
	const float brightness_scale = global_brightness * 255.0f;
	
	if (temporal_dithering == true) {
		const float dither_table[4] = {0.25f, 0.50f, 0.75f, 1.00f};
		static uint8_t dither_step = 0;
		dither_step++;
		const float dither_threshold = dither_table[dither_step & 3];  // Use bitwise AND for modulo
		const float brightness_scale_dither = global_brightness * 254.0f;

		for (uint16_t i = 0; i < NUM_LEDS; i++) {
			// Optimized dithering with fewer operations per channel
			const uint16_t base_idx = i * 3;
			
			// RED channel
			const float decimal_r = leds[i].r * brightness_scale_dither;
			const uint8_t whole_r = (uint8_t)decimal_r;
			raw_led_data[base_idx + 1] = whole_r + ((decimal_r - whole_r) >= dither_threshold);

			// GREEN channel  
			const float decimal_g = leds[i].g * brightness_scale_dither;
			const uint8_t whole_g = (uint8_t)decimal_g;
			raw_led_data[base_idx + 0] = whole_g + ((decimal_g - whole_g) >= dither_threshold);

			// BLUE channel
			const float decimal_b = leds[i].b * brightness_scale_dither;
			const uint8_t whole_b = (uint8_t)decimal_b;
			raw_led_data[base_idx + 2] = whole_b + ((decimal_b - whole_b) >= dither_threshold);
		}
	}
	else {
		// Optimized non-dithered path with pre-calculated multiplier
		for (uint16_t i = 0; i < NUM_LEDS; i++) {
			const uint16_t base_idx = i * 3;
			raw_led_data[base_idx + 1] = (uint8_t)(leds[i].r * brightness_scale);  // RED
			raw_led_data[base_idx + 0] = (uint8_t)(leds[i].g * brightness_scale);  // GREEN
			raw_led_data[base_idx + 2] = (uint8_t)(leds[i].b * brightness_scale);  // BLUE
		}
	}
    {
        uint32_t delta = (micros() - t0);
        uint32_t tmp = ACCUM_QUANTIZE_US;
        tmp = tmp + delta;
        ACCUM_QUANTIZE_US = tmp;
    }
}

#if __has_include(<driver/rmt_tx.h>)
// IRAM_ATTR function must be in header for memory placement (v5 API)
// Made static to ensure internal linkage (each TU gets its own copy)
IRAM_ATTR static inline void transmit_leds() {
    // Wait here if previous frame transmission has not yet completed
    // Reduced timeout for better performance - skip frame if taking too long
    uint32_t t_wait0 = micros();
    // Reduced timeout: 180 LEDs @ ~30us/LED ≈ 5.4ms + reset; 8ms should be sufficient
    esp_err_t wait_result = rmt_tx_wait_all_done(tx_chan, pdMS_TO_TICKS(8));
    {
        uint32_t delta = (micros() - t_wait0);
        uint32_t tmp = ACCUM_RMT_WAIT_US;
        tmp = tmp + delta;
        ACCUM_RMT_WAIT_US = tmp;
    }
    if (wait_result != ESP_OK) {
        // RMT transmission timeout: skip this frame to maintain high FPS
        // Rate-limit warning to avoid log spam
        static uint32_t last_warn_ms = 0;
        uint32_t now_ms = millis();
        if (now_ms - last_warn_ms > 5000) {  // Reduced warning frequency
            LOG_WARN(TAG_LED, "RMT transmission timeout (skipping frame for performance)");
            last_warn_ms = now_ms;
        }
        return;
    }

	// Clear the 8-bit buffer
	memset(raw_led_data, 0, NUM_LEDS*3);

	// Quantize the floating point color to 8-bit with dithering
	//
	// This allows the 8-bit LEDs to emulate the look of a higher bit-depth using persistence of vision tricks
	// The contents of the floating point CRGBF "leds" array are downsampled into alternating ways hundreds of
	// times per second to increase the effective bit depth
	bool temporal_dithering = (get_params().dithering >= 0.5f);
	quantize_color(temporal_dithering);

	// Transmit to LEDs
	uint32_t t_tx0 = micros();
    // Record transmit start timestamp for latency diagnostics
    g_last_led_tx_us = t_tx0;
    // Push into rolling LED TX event buffer for correlation across frames
    led_tx_events_push(t_tx0);
    esp_err_t tx_ret = rmt_transmit(tx_chan, led_encoder, raw_led_data, NUM_LEDS*3, &tx_config);
    if (tx_ret != ESP_OK) {
        static uint32_t last_err_ms = 0;
        uint32_t now_ms = millis();
        if (now_ms - last_err_ms > 1000) {
            LOG_WARN(TAG_LED, "rmt_transmit error: %d", (int)tx_ret);
            last_err_ms = now_ms;
        }
    }
    {
        uint32_t delta = (micros() - t_tx0);
        uint32_t tmp = ACCUM_RMT_TRANSMIT_US;
        tmp = tmp + delta;
        ACCUM_RMT_TRANSMIT_US = tmp;
    }
}
#else
// Fallback: Old API - transmit_leds is a no-op
IRAM_ATTR static inline void transmit_leds() {
    // Old RMT API: not implemented in this stub
}
#endif

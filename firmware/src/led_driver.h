#pragma once

#include <Arduino.h>
#include <string.h>
#include <math.h>

// Prefer ESP-IDF v5 split RMT headers; otherwise provide minimal stubs to allow compilation
#if __has_include(<driver/rmt_tx.h>)
#  include <driver/rmt_tx.h>
#  include <driver/rmt_encoder.h>
#else
// Provide minimal stubs when ESP-IDF v5 RMT v2 is not available
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

// If you must hard-require IDF5 for dual RMT, define REQUIRE_IDF5_DUAL_RMT in build flags.
#ifdef REQUIRE_IDF5_DUAL_RMT
#  if !__has_include(<driver/rmt_tx.h>)
#    error "Dual-RMT build requires IDF5 (driver/rmt_tx.h). Use Arduino core 3.x / espressif32 >= 6.x."
#  endif
#endif

#if !__has_include(<driver/rmt_tx.h>) && __has_include(<driver/rmt.h>)
#  include <driver/rmt.h>
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
#include "audio/goertzel.h"  // for audio_level used by quiet-mode skip

#define LED_DATA_PIN ( 5 )
#define LED_DATA_PIN_2 ( 4 )   // Secondary LED strip output (dual output for LED duplication)

// Soft timeout before considering an RMT frame "late"
#ifndef LED_RMT_WAIT_TIMEOUT_MS
#define LED_RMT_WAIT_TIMEOUT_MS 35
#endif
// Additional window used for graceful recovery when a soft timeout occurs
#ifndef LED_RMT_WAIT_RECOVERY_MS
#define LED_RMT_WAIT_RECOVERY_MS 50
#endif

// It won't void any kind of stupid warranty, but things will *definitely* break at this point if you change this number.
#define NUM_LEDS ( 160 )

// CENTER-ORIGIN ARCHITECTURE (Mandatory for all patterns)
// All effects MUST radiate from center point, never edge-to-edge
// NO rainbows, NO linear gradients - only radial/symmetric effects
#define STRIP_CENTER_POINT ( 79 )   // Physical LED at center (160/2 - 1)
#define STRIP_HALF_LENGTH ( 80 )    // Distance from center to each edge
#define STRIP_LENGTH ( 160 )        // Total span (must equal NUM_LEDS)

static_assert(STRIP_LENGTH == NUM_LEDS, "STRIP_LENGTH must equal NUM_LEDS");
static_assert(STRIP_CENTER_POINT == (NUM_LEDS/2 - 1), "STRIP_CENTER_POINT must be center index (NUM_LEDS/2 - 1)");

// 32-bit color input
extern CRGBF leds[NUM_LEDS];

// Global brightness control (0.0 = off, 1.0 = full brightness)
// Implementation in led_driver.cpp
extern float global_brightness;

// RMT peripheral handles (dual output on GPIO 5 and GPIO 4)
extern rmt_channel_handle_t tx_chan;
extern rmt_channel_handle_t tx_chan_2;
extern rmt_encoder_handle_t led_encoder;
extern rmt_encoder_handle_t led_encoder_2;

// Encoder types only meaningful on ESP-IDF v5; keep declarations compatible with stubs
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

// Global RMT encoder instances and transmission config
// Implementation in led_driver.cpp
extern rmt_led_strip_encoder_t strip_encoder;
extern rmt_led_strip_encoder_t strip_encoder_2;
extern rmt_transmit_config_t tx_config;

// Per-channel mapping/config
typedef struct {
    // Mapping from output byte positions [0,1,2] to source channels: 0=R, 1=G, 2=B
    uint8_t map[3];
    uint16_t length; // number of LEDs driven on this channel (<= NUM_LEDS)
    uint16_t offset; // starting LED offset in logical leds[]
} LedChannelConfig;

// Channel configs (defaults: GRB order, whole strip, no offset)
extern LedChannelConfig g_ch1_config;
extern LedChannelConfig g_ch2_config;

// 8-bit color buffers
// rgb8_data: canonical RGB order for each LED (used to pack into per-channel byte order)
// raw_led_data: channel 1 packed buffer (length = NUM_LEDS*3)
// raw_led_data_ch2: channel 2 packed buffer (may alias raw_led_data if mapping identical)
extern uint8_t rgb8_data[NUM_LEDS * 3];
extern uint8_t raw_led_data[NUM_LEDS * 3];
extern uint8_t raw_led_data_ch2[NUM_LEDS * 3];

// Count of RMT wait timeouts (observed via diagnostics/UI)
extern std::atomic<uint32_t> g_led_rmt_wait_timeouts;

// Legacy RMT v1 transmit buffer and channel (used when only driver/rmt.h is available)
#if !__has_include(<driver/rmt_tx.h>) && __has_include(<driver/rmt.h>)
extern rmt_channel_t v1_rmt_channel;
extern rmt_item32_t v1_items[NUM_LEDS * 24 + 64];
extern rmt_item32_t v1_items_2[NUM_LEDS * 24 + 64];
extern rmt_channel_t v1_rmt_channel_2;
// Reuse v1_items for both channels (items are not modified by driver)
#endif

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

// Secondary channel encoder (identical logic, prevents state collision on concurrent transmits)
IRAM_ATTR static size_t rmt_encode_led_strip_2(rmt_encoder_t *encoder, rmt_channel_handle_t channel, const void *primary_data, size_t data_size, rmt_encode_state_t *ret_state){
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
            goto out2; // yield if there's no free space for encoding artifacts
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
            goto out2; // yield if there's no free space for encoding artifacts
        }
    }
out2:
    *ret_state = state;
    return encoded_symbols;
}
#endif

// ============================================================================
// PUBLIC API FUNCTIONS
// ============================================================================

// Initialize RMT peripheral for LED transmission
// Implementation in led_driver.cpp
void init_rmt_driver();

#ifndef USE_SPI_SECONDARY
#define USE_SPI_SECONDARY 0
#endif
#if USE_SPI_SECONDARY
// SPI LED driver functions for secondary channel (GPIO 4)
// Implementation in spi_led_driver.cpp
esp_err_t init_spi_led_driver();
void spi_transmit_leds(const uint8_t* led_data);
void deinit_spi_led_driver();
#endif

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
			const uint16_t base = i * 3;
			// RED
			const float dec_r = leds[i].r * brightness_scale_dither;
			const uint8_t whole_r = (uint8_t)dec_r;
			rgb8_data[base + 0] = whole_r + ((dec_r - whole_r) >= dither_threshold);
			// GREEN
			const float dec_g = leds[i].g * brightness_scale_dither;
			const uint8_t whole_g = (uint8_t)dec_g;
			rgb8_data[base + 1] = whole_g + ((dec_g - whole_g) >= dither_threshold);
			// BLUE
			const float dec_b = leds[i].b * brightness_scale_dither;
			const uint8_t whole_b = (uint8_t)dec_b;
			rgb8_data[base + 2] = whole_b + ((dec_b - whole_b) >= dither_threshold);
		}
	}
	else {
		for (uint16_t i = 0; i < NUM_LEDS; i++) {
			const uint16_t base = i * 3;
			rgb8_data[base + 0] = (uint8_t)(leds[i].r * brightness_scale);
			rgb8_data[base + 1] = (uint8_t)(leds[i].g * brightness_scale);
			rgb8_data[base + 2] = (uint8_t)(leds[i].b * brightness_scale);
		}
	}
    {
        uint32_t delta = (micros() - t0);
        uint32_t tmp = ACCUM_QUANTIZE_US;
        tmp = tmp + delta;
        ACCUM_QUANTIZE_US = tmp;
    }
}

inline uint16_t remap_led_index(uint16_t logical_index, int16_t offset_px) {
    int32_t idx = static_cast<int32_t>(logical_index) + static_cast<int32_t>(offset_px);
    idx %= NUM_LEDS;
    if (idx < 0) idx += NUM_LEDS;
    return static_cast<uint16_t>(idx);
}

inline void pack_channel_bytes(const uint8_t* rgb, uint8_t* out, const LedChannelConfig& cfg, int16_t led_offset_px) {
    const uint16_t n = cfg.length;
    const uint16_t off = cfg.offset;
    for (uint16_t i = 0; i < n; ++i) {
        const uint16_t logical = static_cast<uint16_t>(i + off);
        const uint16_t src = remap_led_index(logical, led_offset_px);
        const uint16_t base_src = src * 3;
        const uint16_t base_out = i * 3;
        out[base_out + 0] = rgb[base_src + cfg.map[0]];
        out[base_out + 1] = rgb[base_src + cfg.map[1]];
        out[base_out + 2] = rgb[base_src + cfg.map[2]];
    }
}

// IRAM_ATTR function must be in header for memory placement
// Made static to ensure internal linkage (each TU gets its own copy)
IRAM_ATTR static inline void transmit_leds() {
    const PatternParameters& tx_params = get_params();
    int16_t led_offset_px = static_cast<int16_t>(lroundf(tx_params.led_offset));
    if (led_offset_px > NUM_LEDS) led_offset_px = NUM_LEDS;
    if (led_offset_px < -NUM_LEDS) led_offset_px = -NUM_LEDS;
    // If RMT v2 APIs are available, use them; otherwise, skip transmission gracefully
#if __has_include(<driver/rmt_tx.h>)
    // Wait here if previous frame transmission has not yet completed (both channels)
    // Soft-timeout path keeps FPS high, recovery path preserves visual continuity under ISR jitter
    uint32_t t_wait0 = micros();
    esp_err_t wait_result = tx_chan ? rmt_tx_wait_all_done(tx_chan, pdMS_TO_TICKS(LED_RMT_WAIT_TIMEOUT_MS)) : ESP_OK;
    esp_err_t wait_result_2 = tx_chan_2 ? rmt_tx_wait_all_done(tx_chan_2, pdMS_TO_TICKS(LED_RMT_WAIT_TIMEOUT_MS)) : ESP_OK;
    {
        uint32_t delta = (micros() - t_wait0);
        uint32_t tmp = ACCUM_RMT_WAIT_US;
        tmp = tmp + delta;
        ACCUM_RMT_WAIT_US = tmp;
    }
    if (wait_result != ESP_OK || wait_result_2 != ESP_OK) {
        g_led_rmt_wait_timeouts.fetch_add(1, std::memory_order_relaxed);
        static uint32_t last_warn_ms = 0;
        uint32_t now_ms = millis();
        if (now_ms - last_warn_ms > 1000) {
            #if DEBUG_LED_TX
            LOG_WARN(TAG_LED, "RMT wait timeout (ch1=%d ch2=%d) -- entering recovery", (int)wait_result, (int)wait_result_2);
            #endif
            last_warn_ms = now_ms;
        }

        bool recovered = false;
        for (int attempt = 0; attempt < 2 && !recovered; ++attempt) {
            if (attempt == 1) {
                // Give interrupt handlers a moment to drain before retrying
                vTaskDelay(pdMS_TO_TICKS(1));
            }
            esp_err_t recover_1 = tx_chan ? rmt_tx_wait_all_done(tx_chan, pdMS_TO_TICKS(LED_RMT_WAIT_RECOVERY_MS)) : ESP_OK;
            esp_err_t recover_2 = tx_chan_2 ? rmt_tx_wait_all_done(tx_chan_2, pdMS_TO_TICKS(LED_RMT_WAIT_RECOVERY_MS)) : ESP_OK;
            recovered = (recover_1 == ESP_OK && recover_2 == ESP_OK);
            wait_result = recover_1;
            wait_result_2 = recover_2;
        }
        if (!recovered) {
            #if DEBUG_LED_TX
            LOG_WARN(TAG_LED, "RMT recovery failed (ch1=%d ch2=%d) -- dropping frame", (int)wait_result, (int)wait_result_2);
            #endif
            return;
        }
    }
#endif

	// Quantize the floating point color to 8-bit with dithering
	//
	// This allows the 8-bit LEDs to emulate the look of a higher bit-depth using persistence of vision tricks
	// The contents of the floating point CRGBF "leds" array are downsampled into alternating ways hundreds of
	// times per second to increase the effective bit depth
	bool temporal_dithering = (get_params().dithering >= 0.5f);
	quantize_color(temporal_dithering);

    // Optional quiet-mode skip: if audio is below threshold for N frames, skip transmit to reduce EMI
    #ifndef QUIET_SKIP_FRAMES
    #define QUIET_SKIP_FRAMES 10
    #endif
    #ifndef QUIET_VU_THRESH
    #define QUIET_VU_THRESH 0.01f
    #endif
    static uint8_t s_quiet_frames = 0;
    if (audio_level < QUIET_VU_THRESH) {
        if (s_quiet_frames < 0xFF) s_quiet_frames++;
    } else {
        s_quiet_frames = 0;
    }
    if (s_quiet_frames >= QUIET_SKIP_FRAMES) {
        vTaskDelay(pdMS_TO_TICKS(1));
        return;
    }

    // Transmit to LEDs (dual output: GPIO 5 and GPIO 4)
    uint32_t t_tx0 = micros();
    // Record transmit start timestamp for latency diagnostics
    g_last_led_tx_us = t_tx0;
    // Push into rolling LED TX event buffer for correlation across frames
    led_tx_events_push(t_tx0);
#if __has_include(<driver/rmt_tx.h>)
    // Debug: Log transmit attempts every 2 seconds
    static uint32_t last_debug_ms = 0;
    uint32_t now_ms = millis();
    bool should_debug = (now_ms - last_debug_ms > 2000);

    #if DEBUG_LED_TX
    if (should_debug) {
        LOG_WARN(TAG_LED, "=== TRANSMIT DEBUG ===");
        LOG_WARN(TAG_LED, "tx_chan=%p, led_encoder=%p, data=%p, bytes=%d",
                 tx_chan, led_encoder, raw_led_data, NUM_LEDS*3);
        LOG_WARN(TAG_LED, "tx_chan_2=%p, led_encoder_2=%p, data=%p, bytes=%d",
                 tx_chan_2, led_encoder_2, raw_led_data, NUM_LEDS*3);
    }
    #endif

    // Pack per-channel bytes based on mapping (channel 1 always packed)
    pack_channel_bytes(rgb8_data, raw_led_data, g_ch1_config, led_offset_px);
    bool use_ch2_alias = (g_ch2_config.map[0] == g_ch1_config.map[0] &&
                          g_ch2_config.map[1] == g_ch1_config.map[1] &&
                          g_ch2_config.map[2] == g_ch1_config.map[2] &&
                          g_ch2_config.length == g_ch1_config.length &&
                          g_ch2_config.offset == g_ch1_config.offset);
    if (!use_ch2_alias) {
        pack_channel_bytes(rgb8_data, raw_led_data_ch2, g_ch2_config, led_offset_px);
    }

    const uint8_t* ch2_data = use_ch2_alias ? raw_led_data : raw_led_data_ch2;

    // Transmit to both strips with minimal skew via critical section
    // Note: rmt_transmit() returns quickly after queuing; critical section reduces ISR preemption between posts
    static portMUX_TYPE g_rmt_mux = portMUX_INITIALIZER_UNLOCKED;
    esp_err_t tx_ret = ESP_FAIL;
    esp_err_t tx_ret_2 = ESP_FAIL;  // Default to fail
    taskENTER_CRITICAL(&g_rmt_mux);
    do {
        tx_ret = rmt_transmit(tx_chan,   led_encoder,   raw_led_data, g_ch1_config.length*3, &tx_config);
        if (tx_chan_2 && led_encoder_2) {
            tx_ret_2 = rmt_transmit(tx_chan_2, led_encoder_2, ch2_data, g_ch2_config.length*3, &tx_config);
        }
    } while (0);
    taskEXIT_CRITICAL(&g_rmt_mux);

    #if DEBUG_LED_TX
    if (should_debug) {
        LOG_WARN(TAG_LED, "Primary (GPIO5) transmit: %s (0x%x)", esp_err_to_name(tx_ret), tx_ret);
        LOG_WARN(TAG_LED, "Secondary (GPIO4) transmit: %s (0x%x)", esp_err_to_name(tx_ret_2), tx_ret_2);
        last_debug_ms = now_ms;
    }
    #endif

    #if DEBUG_LED_TX
    if (tx_ret != ESP_OK || tx_ret_2 != ESP_OK) {
        static uint32_t last_err_ms = 0;
        if (now_ms - last_err_ms > 1000) {
            if (tx_ret != ESP_OK) LOG_WARN(TAG_LED, "rmt_transmit error (ch1): %d", (int)tx_ret);
            if (tx_ret_2 != ESP_OK) LOG_WARN(TAG_LED, "rmt_transmit error (ch2): %d", (int)tx_ret_2);
            last_err_ms = now_ms;
        }
    }
    #endif
#else
#if __has_include(<driver/rmt.h>)
    // Legacy RMT v1 fallback (ESP-IDF v4, Arduino core 2.x)
    // 1) Pack mapped bytes for each channel
    pack_channel_bytes(rgb8_data, raw_led_data, g_ch1_config, led_offset_px);
    bool use_ch2_alias = (g_ch2_config.map[0] == g_ch1_config.map[0] &&
                          g_ch2_config.map[1] == g_ch1_config.map[1] &&
                          g_ch2_config.map[2] == g_ch1_config.map[2] &&
                          g_ch2_config.length == g_ch1_config.length &&
                          g_ch2_config.offset == g_ch1_config.offset);
    if (!use_ch2_alias) {
        pack_channel_bytes(rgb8_data, raw_led_data_ch2, g_ch2_config, led_offset_px);
    }

    // 2) Encode GRB bytes into RMT items at ~800 kHz timing using clk_div=2 (25 ns ticks)
    const uint16_t T0H = 16;  // ~0.40us high
    const uint16_t T0L = 34;  // ~0.85us low
    const uint16_t T1H = 32;  // ~0.80us high
    const uint16_t T1L = 18;  // ~0.45us low
    // Increase reset low time margin to improve latch stability on some batches
    const uint16_t RESET_TICKS = 2000; // ~50us low per item (two items => ~100us reset)

    size_t idx = 0;
    const size_t nbytes1 = (size_t)g_ch1_config.length * 3;
    for (size_t i = 0; i < nbytes1; ++i) {
        uint8_t b = raw_led_data[i];
        for (int bit = 7; bit >= 0; --bit) {
            bool one = (b >> bit) & 0x1;
            if (one) {
                v1_items[idx].duration0 = T1H; v1_items[idx].level0 = 1;
                v1_items[idx].duration1 = T1L; v1_items[idx].level1 = 0;
            } else {
                v1_items[idx].duration0 = T0H; v1_items[idx].level0 = 1;
                v1_items[idx].duration1 = T0L; v1_items[idx].level1 = 0;
            }
            ++idx;
        }
    }
    v1_items[idx].duration0 = RESET_TICKS; v1_items[idx].level0 = 0;
    v1_items[idx].duration1 = RESET_TICKS; v1_items[idx].level1 = 0;
    ++idx;

    // Secondary channel items
    size_t idx2 = 0;
    const uint8_t* ch2_src = use_ch2_alias ? raw_led_data : raw_led_data_ch2;
    const size_t nbytes2 = (size_t)g_ch2_config.length * 3;
    for (size_t i = 0; i < nbytes2; ++i) {
        uint8_t b = ch2_src[i];
        for (int bit = 7; bit >= 0; --bit) {
            bool one = (b >> bit) & 0x1;
            if (one) {
                v1_items_2[idx2].duration0 = T1H; v1_items_2[idx2].level0 = 1;
                v1_items_2[idx2].duration1 = T1L; v1_items_2[idx2].level1 = 0;
            } else {
                v1_items_2[idx2].duration0 = T0H; v1_items_2[idx2].level0 = 1;
                v1_items_2[idx2].duration1 = T0L; v1_items_2[idx2].level1 = 0;
            }
            ++idx2;
        }
    }
    v1_items_2[idx2].duration0 = RESET_TICKS; v1_items_2[idx2].level0 = 0;
    v1_items_2[idx2].duration1 = RESET_TICKS; v1_items_2[idx2].level1 = 0;
    ++idx2;

    // 3) Ensure previous transmissions are complete; skip frame on timeout to avoid DRIVER/CHANNEL errors
    if (rmt_wait_tx_done(v1_rmt_channel, pdMS_TO_TICKS(8)) != ESP_OK) {
        goto after_v1_tx;
    }
    if (rmt_wait_tx_done(v1_rmt_channel_2, pdMS_TO_TICKS(8)) != ESP_OK) {
        goto after_v1_tx;
    }

    // 4) Transmit to PRIMARY and SECONDARY channels (both via RMT v1)
    rmt_write_items(v1_rmt_channel,    v1_items,    idx,  false);
    rmt_write_items(v1_rmt_channel_2,  v1_items_2,  idx2, false);
after_v1_tx: ;
#else
    // RMT not available at all; yield briefly to allow system tasks to run
    vTaskDelay(pdMS_TO_TICKS(1));
#endif
#endif
    {
        uint32_t delta = (micros() - t_tx0);
        uint32_t tmp = ACCUM_RMT_TRANSMIT_US;
        tmp = tmp + delta;
        ACCUM_RMT_TRANSMIT_US = tmp;
    }

    // Frame pacing to cap FPS and avoid occasional wait_tx_done collisions
    // Target minimum frame period ~6.0ms (~166 FPS) to stay within 150–180 FPS band
    // Convert runtime parameter to microseconds (clamped by validator)
    uint32_t min_period_us = (uint32_t)(get_params().frame_min_period_ms * 1000.0f);
    static uint32_t s_last_frame_start_us = 0;
    uint32_t now_us = micros();
    if (s_last_frame_start_us == 0) s_last_frame_start_us = now_us;
    uint32_t elapsed_us = now_us - s_last_frame_start_us;
    if (elapsed_us < min_period_us) {
        uint32_t remain_us = min_period_us - elapsed_us;
        // Sleep in ms granularity to yield CPU without busy-waiting
        uint32_t remain_ms = (remain_us + 999) / 1000;
        if (remain_ms > 0) vTaskDelay(pdMS_TO_TICKS(remain_ms));
    }
    s_last_frame_start_us = micros();
}

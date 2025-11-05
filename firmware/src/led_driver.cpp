// /firmware/src/led_driver.cpp
// LED Driver Implementation - RMT-based WS2812B LED strip control
// K1.reinvented Phase 2 Refactoring

#include "led_driver.h"
#include <Arduino.h>
#include <cstring>

// ============================================================================
// GLOBAL STATE DEFINITIONS
// ============================================================================

// Mutable brightness control (0.0 = off, 1.0 = full brightness)
float global_brightness = 0.3f;  // Start at 30% to avoid retina damage

// 8-bit color output buffer (540 bytes for 180 LEDs × 3 channels)
// Must be accessible from inline transmit_leds() function in header
uint8_t raw_led_data[NUM_LEDS * 3];

// RMT peripheral handles
rmt_channel_handle_t tx_chan = NULL;   // alias to A for legacy
rmt_channel_handle_t tx_chan_a = NULL;
rmt_channel_handle_t tx_chan_b = NULL;
rmt_encoder_handle_t led_encoder = NULL;

// RMT encoder instance
rmt_led_strip_encoder_t strip_encoder;

// RMT transmission configuration
rmt_transmit_config_t tx_config = {
	.loop_count = 0,  // no transfer loop
	.flags = { .eot_level = 0, .queue_nonblocking = 0 }
};

// Logging tag
static const char *TAG = "led_encoder";

// ============================================================================
// STATIC HELPER FUNCTIONS
// ============================================================================

static esp_err_t rmt_del_led_strip_encoder(rmt_encoder_t *encoder) {
	rmt_led_strip_encoder_t *led_encoder = __containerof(encoder, rmt_led_strip_encoder_t, base);
	rmt_del_encoder(led_encoder->bytes_encoder);
	rmt_del_encoder(led_encoder->copy_encoder);
	free(led_encoder);
	return ESP_OK;
}

static esp_err_t rmt_led_strip_encoder_reset(rmt_encoder_t *encoder) {
	rmt_led_strip_encoder_t *led_encoder = __containerof(encoder, rmt_led_strip_encoder_t, base);
	rmt_encoder_reset(led_encoder->bytes_encoder);
	rmt_encoder_reset(led_encoder->copy_encoder);
	led_encoder->state = RMT_ENCODING_RESET;
	return ESP_OK;
}

// ============================================================================
// RMT ENCODER CREATION
// ============================================================================

esp_err_t rmt_new_led_strip_encoder(const led_strip_encoder_config_t *config, rmt_encoder_handle_t *ret_encoder) {
	esp_err_t ret = ESP_OK;

	strip_encoder.base.encode = rmt_encode_led_strip;
	strip_encoder.base.del    = rmt_del_led_strip_encoder;
	strip_encoder.base.reset  = rmt_led_strip_encoder_reset;

    // WS2812B timing @ 20 MHz resolution (50 ns per tick)
    // Spec target: T0H≈0.35us, T0L≈0.9us, T1H≈0.7us, T1L≈0.55us, period≈1.25us
    // Tick counts (@50ns): T0H=7, T0L=18, T1H=14, T1L=11
    // These values are commonly robust across batches while matching spec closely.
    rmt_bytes_encoder_config_t bytes_encoder_config = {
        .bit0 = { 7, 1, 18, 0 },  // ~0.35us high, ~0.90us low (1.25us total)
        .bit1 = { 14, 1, 11, 0 }, // ~0.70us high, ~0.55us low (1.25us total)
        .flags = { .msb_first = 1 }
    };

	rmt_new_bytes_encoder(&bytes_encoder_config, &strip_encoder.bytes_encoder);
	rmt_copy_encoder_config_t copy_encoder_config = {};
	rmt_new_copy_encoder(&copy_encoder_config, &strip_encoder.copy_encoder);

    // Reset: ≥50us low. At 20 MHz, 50us = 1000 ticks. Double to ensure latch.
    strip_encoder.reset_code = (rmt_symbol_word_t) { 1000, 0, 1000, 0 };

	*ret_encoder = &strip_encoder.base;
	return ESP_OK;
}

// ============================================================================
// RMT DRIVER INITIALIZATION
// ============================================================================

void init_rmt_driver() {
#if __has_include(<driver/rmt_tx.h>)
    // ESP-IDF v5 dual-channel mode with new API
    printf("init_rmt_driver (dual-channel, v5 API)\n");

    // Create encoder once (shared across channels)
    if (!led_encoder) {
        ESP_LOGI(TAG, "Install led strip encoder");
        led_strip_encoder_config_t encoder_config = {
            .resolution = 20000000,
        };
        printf("rmt_new_led_strip_encoder\n");
        ESP_ERROR_CHECK(rmt_new_led_strip_encoder(&encoder_config, &led_encoder));
    }

    // Configure TX channel A (LED_DATA_PIN_A)
    if (!tx_chan_a) {
        rmt_tx_channel_config_t tx_chan_config_a = {
            .gpio_num = (gpio_num_t)LED_DATA_PIN_A,
            .clk_src = RMT_CLK_SRC_DEFAULT,
            .resolution_hz = 20000000,
            .mem_block_symbols = 64,
            .trans_queue_depth = 4,
            .intr_priority = 99,
            .flags = { .with_dma = 1 },
        };
        printf("rmt_new_tx_channel(A)\n");
        ESP_ERROR_CHECK(rmt_new_tx_channel(&tx_chan_config_a, &tx_chan_a));
        printf("rmt_enable(A)\n");
        ESP_ERROR_CHECK(rmt_enable(tx_chan_a));
    }

    // Configure TX channel B (LED_DATA_PIN_B)
    // Fallback to single-channel if second channel unavailable (HW resource exhaustion)
    if (!tx_chan_b) {
        rmt_tx_channel_config_t tx_chan_config_b = {
            .gpio_num = (gpio_num_t)LED_DATA_PIN_B,
            .clk_src = RMT_CLK_SRC_DEFAULT,
            .resolution_hz = 20000000,
            .mem_block_symbols = 64,
            .trans_queue_depth = 4,
            .intr_priority = 99,
            .flags = { .with_dma = 1 },
        };
        printf("rmt_new_tx_channel(B)\n");
        esp_err_t err_b = rmt_new_tx_channel(&tx_chan_config_b, &tx_chan_b);
        if (err_b != ESP_OK) {
            ESP_LOGW(TAG, "Failed to allocate RMT channel B (0x%x): fallback to single-channel", err_b);
            tx_chan_b = NULL;
        } else {
            printf("rmt_enable(B)\n");
            ESP_ERROR_CHECK(rmt_enable(tx_chan_b));
        }
    }

    // Legacy alias
    tx_chan = tx_chan_a;

#else
    // Fallback: Old ESP-IDF API (single-channel, no dual-channel support)
    // The old API has completely different types/functions and is not supported
    // Initialize dummy handles to prevent crashes in transmit_leds()
    printf("init_rmt_driver (old API detected - LED output disabled)\n");
    tx_chan = (rmt_channel_handle_t)(intptr_t)0xDEADBEEF;  // Dummy handle
    tx_chan_a = (rmt_channel_handle_t)(intptr_t)0xDEADBEEF;
    tx_chan_b = NULL;  // No dual-channel on old API
#endif
}

// Note: quantize_color() is defined inline in led_driver.h (required for compiler inlining)
// Timestamp of last LED transmit start (micros)
// Uses relaxed ordering for simple latency measurement timestamp capture
std::atomic<uint32_t> g_last_led_tx_us{0};

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
rmt_channel_handle_t tx_chan = NULL;
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
    printf("init_rmt_driver\n");
    rmt_tx_channel_config_t tx_chan_config = {
        .gpio_num = (gpio_num_t)LED_DATA_PIN,  // GPIO number
        .clk_src = RMT_CLK_SRC_DEFAULT,        // default source clock
        .resolution_hz = 20000000,             // 20 MHz tick resolution (1 tick = 0.05us)
        .mem_block_symbols = 64,               // 64 * 4 = 256 bytes
        .trans_queue_depth = 4,                // pending transactions depth
        .intr_priority = 99,
        .flags = { .with_dma = 1 },            // DMA enabled to reduce ISR pressure
    };

	printf("rmt_new_tx_channel\n");
	ESP_ERROR_CHECK(rmt_new_tx_channel(&tx_chan_config, &tx_chan));

    ESP_LOGI(TAG, "Install led strip encoder");
    led_strip_encoder_config_t encoder_config = {
        .resolution = 20000000,
    };
	printf("rmt_new_led_strip_encoder\n");
	ESP_ERROR_CHECK(rmt_new_led_strip_encoder(&encoder_config, &led_encoder));

	printf("rmt_enable\n");
	ESP_ERROR_CHECK(rmt_enable(tx_chan));
}

// Note: quantize_color() is defined inline in led_driver.h (required for compiler inlining)
// Timestamp of last LED transmit start (micros)
// Uses relaxed ordering for simple latency measurement timestamp capture
std::atomic<uint32_t> g_last_led_tx_us{0};

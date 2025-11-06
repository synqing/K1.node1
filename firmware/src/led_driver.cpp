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

// 8-bit color output buffer (480 bytes for 160 LEDs × 3 channels)
// Must be accessible from inline transmit_leds() function in header
uint8_t raw_led_data[NUM_LEDS * 3];

// Logging tag
static const char *TAG = "led_encoder";

// RMT globals (shared declarations so header externs stay valid)
// Dual output: GPIO 5 (primary) and GPIO 4 (secondary)
rmt_channel_handle_t tx_chan = NULL;
rmt_channel_handle_t tx_chan_2 = NULL;
rmt_encoder_handle_t led_encoder = NULL;
rmt_encoder_handle_t led_encoder_2 = NULL;
rmt_led_strip_encoder_t strip_encoder{};
rmt_led_strip_encoder_t strip_encoder_2{};
rmt_transmit_config_t tx_config = {
    .loop_count = 0,
    .flags = { .eot_level = 0, .queue_nonblocking = 0 }
};

#if __has_include(<driver/rmt_tx.h>)

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
// RMT ENCODER CREATION (Secondary Channel)
// ============================================================================

esp_err_t rmt_new_led_strip_encoder_2(const led_strip_encoder_config_t *config, rmt_encoder_handle_t *ret_encoder) {
	esp_err_t ret = ESP_OK;

	printf("DEBUG: Assigning encoder functions for secondary channel\n");
	printf("  &strip_encoder_2 = %p\n", &strip_encoder_2);
	printf("  &strip_encoder_2.base = %p\n", &strip_encoder_2.base);

	strip_encoder_2.base.encode = rmt_encode_led_strip_2;
	printf("  Assigned encode function = %p\n", (void*)strip_encoder_2.base.encode);
	strip_encoder_2.base.del    = rmt_del_led_strip_encoder;
	strip_encoder_2.base.reset  = rmt_led_strip_encoder_reset;

    // WS2812B timing @ 20 MHz resolution (50 ns per tick)
    // Same timing as primary channel for synchronized output
    rmt_bytes_encoder_config_t bytes_encoder_config = {
        .bit0 = { 7, 1, 18, 0 },  // ~0.35us high, ~0.90us low (1.25us total)
        .bit1 = { 14, 1, 11, 0 }, // ~0.70us high, ~0.55us low (1.25us total)
        .flags = { .msb_first = 1 }
    };

	rmt_new_bytes_encoder(&bytes_encoder_config, &strip_encoder_2.bytes_encoder);
	rmt_copy_encoder_config_t copy_encoder_config = {};
	rmt_new_copy_encoder(&copy_encoder_config, &strip_encoder_2.copy_encoder);

    // Reset: ≥50us low. At 20 MHz, 50us = 1000 ticks. Double to ensure latch.
    strip_encoder_2.reset_code = (rmt_symbol_word_t) { 1000, 0, 1000, 0 };

	*ret_encoder = &strip_encoder_2.base;
	return ESP_OK;
}

// ============================================================================
// RMT DRIVER INITIALIZATION
// ============================================================================

void init_rmt_driver() {
    printf("init_rmt_driver\n");
#if __has_include(<driver/rmt_tx.h>)
    printf("USING RMT V2 API (rmt_tx.h)\n");
#else
    printf("USING LEGACY RMT V1 API\n");
#endif

    // ========== PRIMARY CHANNEL (GPIO 5) ==========
    rmt_tx_channel_config_t tx_chan_config = {
        .gpio_num = (gpio_num_t)LED_DATA_PIN,  // GPIO 5
        .clk_src = RMT_CLK_SRC_DEFAULT,        // default source clock
        .resolution_hz = 20000000,             // 20 MHz tick resolution (1 tick = 0.05us)
        .mem_block_symbols = 64,               // 64 * 4 = 256 bytes
        .trans_queue_depth = 4,                // pending transactions depth
        .intr_priority = 99,
        .flags = { .with_dma = 1 },            // DMA enabled to reduce ISR pressure
    };

	printf("rmt_new_tx_channel (primary)\n");
	ESP_ERROR_CHECK(rmt_new_tx_channel(&tx_chan_config, &tx_chan));

    ESP_LOGI(TAG, "Install led strip encoder (primary)");
    led_strip_encoder_config_t encoder_config = {
        .resolution = 20000000,
    };
	printf("rmt_new_led_strip_encoder (primary)\n");
	ESP_ERROR_CHECK(rmt_new_led_strip_encoder(&encoder_config, &led_encoder));

	printf("rmt_enable (primary)\n");
	ESP_ERROR_CHECK(rmt_enable(tx_chan));

    // ========== SECONDARY CHANNEL (GPIO 4) ==========
    rmt_tx_channel_config_t tx_chan_config_2 = {
        .gpio_num = (gpio_num_t)LED_DATA_PIN_2,  // GPIO 4
        .clk_src = RMT_CLK_SRC_DEFAULT,          // default source clock
        .resolution_hz = 20000000,               // 20 MHz tick resolution (1 tick = 0.05us)
        .mem_block_symbols = 64,                 // 64 * 4 = 256 bytes
        .trans_queue_depth = 4,                  // pending transactions depth
        .intr_priority = 99,
        .flags = { .with_dma = 1 },              // DMA enabled to reduce ISR pressure
    };

	printf("rmt_new_tx_channel (secondary) - GPIO %d\n", LED_DATA_PIN_2);
	esp_err_t ch2_result = rmt_new_tx_channel(&tx_chan_config_2, &tx_chan_2);
	printf("  Secondary channel creation result: %s (0x%x)\n", esp_err_to_name(ch2_result), ch2_result);
	printf("  tx_chan_2 handle = %p\n", tx_chan_2);
	ESP_ERROR_CHECK(ch2_result);

    ESP_LOGI(TAG, "Install led strip encoder (secondary)");
	printf("rmt_new_led_strip_encoder_2 (secondary)\n");
	esp_err_t enc2_result = rmt_new_led_strip_encoder_2(&encoder_config, &led_encoder_2);
	printf("  Secondary encoder creation result: %s (0x%x)\n", esp_err_to_name(enc2_result), enc2_result);
	printf("  led_encoder_2 handle = %p\n", led_encoder_2);
	ESP_ERROR_CHECK(enc2_result);

	printf("rmt_enable (secondary)\n");
	esp_err_t en2_result = rmt_enable(tx_chan_2);
	printf("  Secondary channel enable result: %s (0x%x)\n", esp_err_to_name(en2_result), en2_result);
	ESP_ERROR_CHECK(en2_result);

	printf("SECONDARY CHANNEL FULLY INITIALIZED - GPIO %d READY\n", LED_DATA_PIN_2);

	// Critical debug: Verify global handles
	printf("DEBUG: Global handle verification:\n");
	printf("  tx_chan (primary) = %p\n", tx_chan);
	printf("  tx_chan_2 (secondary) = %p\n", tx_chan_2);
	printf("  led_encoder (primary) = %p\n", led_encoder);
	printf("  led_encoder_2 (secondary) = %p\n", led_encoder_2);
	printf("  &strip_encoder = %p\n", &strip_encoder);
	printf("  &strip_encoder_2 = %p\n", &strip_encoder_2);

	if (tx_chan_2 == NULL || led_encoder_2 == NULL) {
		printf("FATAL ERROR: Secondary channel handles are NULL!\n");
		while(1) { vTaskDelay(1000); }  // Halt if initialization failed
	}
}

#else  // Legacy RMT v1 fallback (ESP-IDF v4.x / Arduino core 2.x)

#if __has_include(<driver/rmt.h>)
rmt_channel_t v1_rmt_channel = RMT_CHANNEL_0;
rmt_item32_t v1_items[NUM_LEDS * 24 + 64];

void init_rmt_driver() {
    rmt_config_t config = {};
    config.rmt_mode = RMT_MODE_TX;
    config.channel = v1_rmt_channel;
    config.gpio_num = (gpio_num_t)LED_DATA_PIN;
    config.mem_block_num = 4;
    config.clk_div = 2;  // 40MHz base clock / 2 = 20MHz tick (0.05us)
    config.tx_config.loop_en = false;
    config.tx_config.carrier_en = false;
    config.tx_config.idle_level = RMT_IDLE_LEVEL_LOW;
    config.tx_config.idle_output_en = true;

    esp_err_t err = rmt_config(&config);
    if (err != ESP_OK) {
        printf("rmt_config failed: %d\n", (int)err);
        return;
    }

    err = rmt_driver_install(config.channel, 0, 0);
    if (err != ESP_OK) {
        printf("rmt_driver_install failed: %d\n", (int)err);
    }
}
#else
void init_rmt_driver() {
    // RMT peripheral unavailable; initialization is a no-op.
}
#endif

#endif  // __has_include(<driver/rmt_tx.h>)

// Note: quantize_color() is defined inline in led_driver.h (required for compiler inlining)
// Timestamp of last LED transmit start (micros)
// Uses relaxed ordering for simple latency measurement timestamp capture
std::atomic<uint32_t> g_last_led_tx_us{0};

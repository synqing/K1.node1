// /firmware/src/led_driver.cpp
// LED Driver Implementation - RMT-based WS2812B LED strip control
// K1.reinvented Phase 2 Refactoring

#include "led_driver.h"
#include <Arduino.h>
#include <cstring>
#include "logging/logger.h"

// ============================================================================
// GLOBAL STATE DEFINITIONS
// ============================================================================

// Mutable brightness control (0.0 = off, 1.0 = full brightness)
float global_brightness = 0.3f;  // Start at 30% to avoid retina damage

// 8-bit color output buffer (480 bytes for 160 LEDs × 3 channels)
// Must be accessible from inline transmit_leds() function in header
uint8_t rgb8_data[NUM_LEDS * 3];
uint8_t raw_led_data[NUM_LEDS * 3];
uint8_t raw_led_data_ch2[NUM_LEDS * 3];

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

// Default channel configs: GRB order (WS2812), full length, no offset
LedChannelConfig g_ch1_config = { {1,0,2}, NUM_LEDS, 0 };
LedChannelConfig g_ch2_config = { {1,0,2}, NUM_LEDS, 0 };

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

    // Create sub-encoders with error propagation and cleanup on failure
	ret = rmt_new_bytes_encoder(&bytes_encoder_config, &strip_encoder.bytes_encoder);
	if (ret != ESP_OK) {
#if __has_include(<esp_log.h>)
		ESP_LOGE(TAG, "Failed to create bytes encoder (primary): 0x%x", ret);
#endif
		return ret;
	}

	rmt_copy_encoder_config_t copy_encoder_config = {};
	ret = rmt_new_copy_encoder(&copy_encoder_config, &strip_encoder.copy_encoder);
	if (ret != ESP_OK) {
#if __has_include(<esp_log.h>)
		ESP_LOGE(TAG, "Failed to create copy encoder (primary): 0x%x", ret);
#endif
		rmt_del_encoder(strip_encoder.bytes_encoder);
		strip_encoder.bytes_encoder = NULL;
		return ret;
	}

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

    LOG_DEBUG(TAG_LED, "Assigning encoder functions for secondary channel");
    LOG_DEBUG(TAG_LED, "  &strip_encoder_2 = %p", &strip_encoder_2);
    LOG_DEBUG(TAG_LED, "  &strip_encoder_2.base = %p", &strip_encoder_2.base);

	strip_encoder_2.base.encode = rmt_encode_led_strip_2;
    LOG_DEBUG(TAG_LED, "  Assigned encode function = %p", (void*)strip_encoder_2.base.encode);
	strip_encoder_2.base.del    = rmt_del_led_strip_encoder;
	strip_encoder_2.base.reset  = rmt_led_strip_encoder_reset;

    // WS2812B timing @ 20 MHz resolution (50 ns per tick)
    // Same timing as primary channel for synchronized output
    rmt_bytes_encoder_config_t bytes_encoder_config = {
        .bit0 = { 7, 1, 18, 0 },  // ~0.35us high, ~0.90us low (1.25us total)
        .bit1 = { 14, 1, 11, 0 }, // ~0.70us high, ~0.55us low (1.25us total)
        .flags = { .msb_first = 1 }
    };

    // Create sub-encoders with error propagation and cleanup on failure
	ret = rmt_new_bytes_encoder(&bytes_encoder_config, &strip_encoder_2.bytes_encoder);
	if (ret != ESP_OK) {
#if __has_include(<esp_log.h>)
		ESP_LOGE(TAG, "Failed to create bytes encoder (secondary): 0x%x", ret);
#endif
		return ret;
	}

	rmt_copy_encoder_config_t copy_encoder_config = {};
	ret = rmt_new_copy_encoder(&copy_encoder_config, &strip_encoder_2.copy_encoder);
	if (ret != ESP_OK) {
#if __has_include(<esp_log.h>)
		ESP_LOGE(TAG, "Failed to create copy encoder (secondary): 0x%x", ret);
#endif
		rmt_del_encoder(strip_encoder_2.bytes_encoder);
		strip_encoder_2.bytes_encoder = NULL;
		return ret;
	}

    // Reset: ≥50us low. At 20 MHz, 50us = 1000 ticks. Double to ensure latch.
    strip_encoder_2.reset_code = (rmt_symbol_word_t) { 1000, 0, 1000, 0 };

	*ret_encoder = &strip_encoder_2.base;
	return ESP_OK;
}

// ============================================================================
// RMT DRIVER INITIALIZATION
// ============================================================================

void init_rmt_driver() {
    LOG_INFO(TAG_LED, "init_rmt_driver");
#if __has_include(<driver/rmt_tx.h>)
    LOG_INFO(TAG_LED, "USING RMT V2 API (rmt_tx.h)");
#else
    LOG_INFO(TAG_LED, "USING LEGACY RMT V1 API");
#endif

    // ========== PRIMARY CHANNEL (GPIO 5) ==========
    rmt_tx_channel_config_t tx_chan_config = {
        .gpio_num = (gpio_num_t)LED_DATA_PIN,  // GPIO 5
        .clk_src = RMT_CLK_SRC_DEFAULT,        // default source clock
        .resolution_hz = 20000000,             // 20 MHz tick resolution (1 tick = 0.05us)
        .mem_block_symbols = 256,              // worst-case headroom for 160 LEDs (reduces refill cadence)
        .trans_queue_depth = 4,                // pending transactions depth
        .intr_priority = 99,
        .flags = { .with_dma = 1 },            // DMA enabled to reduce ISR pressure
    };

LOG_DEBUG(TAG_LED, "rmt_new_tx_channel (primary)");
	ESP_ERROR_CHECK(rmt_new_tx_channel(&tx_chan_config, &tx_chan));

    ESP_LOGI(TAG, "Install led strip encoder (primary)");
    led_strip_encoder_config_t encoder_config = {
        .resolution = 20000000,
    };
LOG_DEBUG(TAG_LED, "rmt_new_led_strip_encoder (primary)");
	ESP_ERROR_CHECK(rmt_new_led_strip_encoder(&encoder_config, &led_encoder));

LOG_DEBUG(TAG_LED, "rmt_enable (primary)");
	ESP_ERROR_CHECK(rmt_enable(tx_chan));

    // ========== SECONDARY CHANNEL (GPIO 4) ==========
    rmt_tx_channel_config_t tx_chan_config_2 = {
        .gpio_num = (gpio_num_t)LED_DATA_PIN_2,  // GPIO 4
        .clk_src = RMT_CLK_SRC_DEFAULT,          // default source clock
        .resolution_hz = 20000000,               // 20 MHz tick resolution (1 tick = 0.05us)
        .mem_block_symbols = 256,                // match primary
        .trans_queue_depth = 4,                  // pending transactions depth
        .intr_priority = 99,
        .flags = { .with_dma = 1 },              // DMA enabled to reduce ISR pressure
    };

LOG_DEBUG(TAG_LED, "rmt_new_tx_channel (secondary) - GPIO %d", LED_DATA_PIN_2);
	esp_err_t ch2_result = rmt_new_tx_channel(&tx_chan_config_2, &tx_chan_2);
LOG_DEBUG(TAG_LED, "  Secondary channel creation result: %s (0x%x)", esp_err_to_name(ch2_result), ch2_result);
LOG_DEBUG(TAG_LED, "  tx_chan_2 handle = %p", tx_chan_2);
	ESP_ERROR_CHECK(ch2_result);

    ESP_LOGI(TAG, "Install led strip encoder (secondary)");
LOG_DEBUG(TAG_LED, "rmt_new_led_strip_encoder_2 (secondary)");
	esp_err_t enc2_result = rmt_new_led_strip_encoder_2(&encoder_config, &led_encoder_2);
LOG_DEBUG(TAG_LED, "  Secondary encoder creation result: %s (0x%x)", esp_err_to_name(enc2_result), enc2_result);
LOG_DEBUG(TAG_LED, "  led_encoder_2 handle = %p", led_encoder_2);
	ESP_ERROR_CHECK(enc2_result);

LOG_DEBUG(TAG_LED, "rmt_enable (secondary)");
	esp_err_t en2_result = rmt_enable(tx_chan_2);
LOG_DEBUG(TAG_LED, "  Secondary channel enable result: %s (0x%x)", esp_err_to_name(en2_result), en2_result);
	ESP_ERROR_CHECK(en2_result);

    // Register RMT probe callbacks for telemetry (measures refill cadence and max gaps)
    extern void rmt_probe_init(rmt_channel_handle_t chan, const char* name);
    rmt_probe_init(tx_chan,   "ch1");
    rmt_probe_init(tx_chan_2, "ch2");

LOG_INFO(TAG_LED, "SECONDARY CHANNEL FULLY INITIALIZED - GPIO %d READY", LED_DATA_PIN_2);

	// Critical debug: Verify global handles
LOG_DEBUG(TAG_LED, "DEBUG: Global handle verification:");
LOG_DEBUG(TAG_LED, "  tx_chan (primary) = %p", tx_chan);
LOG_DEBUG(TAG_LED, "  tx_chan_2 (secondary) = %p", tx_chan_2);
LOG_DEBUG(TAG_LED, "  led_encoder (primary) = %p", led_encoder);
LOG_DEBUG(TAG_LED, "  led_encoder_2 (secondary) = %p", led_encoder_2);
LOG_DEBUG(TAG_LED, "  &strip_encoder = %p", &strip_encoder);
LOG_DEBUG(TAG_LED, "  &strip_encoder_2 = %p", &strip_encoder_2);

	if (tx_chan_2 == NULL || led_encoder_2 == NULL) {
        LOG_ERROR(TAG_LED, "FATAL ERROR: Secondary channel handles are NULL!");
		while(1) { vTaskDelay(1000); }  // Halt if initialization failed
	}
}

#else  // Legacy RMT v1 fallback (ESP-IDF v4.x / Arduino core 2.x)

#if __has_include(<driver/rmt.h>)
rmt_channel_t v1_rmt_channel = RMT_CHANNEL_0;
rmt_item32_t v1_items[NUM_LEDS * 24 + 64];

// Add secondary channel support for RMT v1
// Use channel 1 to avoid potential unsupported indices on some cores
rmt_channel_t v1_rmt_channel_2 = RMT_CHANNEL_1;
rmt_item32_t v1_items_2[NUM_LEDS * 24 + 64];     // Secondary buffer

void init_rmt_driver() {
    LOG_INFO(TAG_LED, "USING LEGACY RMT V1 - ADDING DUAL CHANNEL SUPPORT");

    // PRIMARY CHANNEL (GPIO 5, RMT Channel 0)
    rmt_config_t config = {};
    config.rmt_mode = RMT_MODE_TX;
    config.channel = v1_rmt_channel;
    config.gpio_num = (gpio_num_t)LED_DATA_PIN;
    // Allocate memory blocks per channel; keep within total HW budget
    config.mem_block_num = 4;
    config.clk_div = 2;  // 40MHz base clock / 2 = 20MHz tick (0.05us)
    config.tx_config.loop_en = false;
    config.tx_config.carrier_en = false;
    config.tx_config.idle_level = RMT_IDLE_LEVEL_LOW;
    config.tx_config.idle_output_en = true;

    esp_err_t err = rmt_config(&config);
    if (err != ESP_OK) {
        LOG_ERROR(TAG_LED, "Primary rmt_config failed: %d", (int)err);
        return;
    }

    err = rmt_driver_install(config.channel, 0, 0);
    if (err != ESP_OK) {
        LOG_ERROR(TAG_LED, "Primary rmt_driver_install failed: %d", (int)err);
    } else {
        LOG_INFO(TAG_LED, "Primary channel (GPIO %d) initialized OK", LED_DATA_PIN);
    }

    // SECONDARY CHANNEL (GPIO 4, RMT Channel 1)
    rmt_config_t config2 = {};
    config2.rmt_mode = RMT_MODE_TX;
    config2.channel = v1_rmt_channel_2;
    config2.gpio_num = (gpio_num_t)LED_DATA_PIN_2;
    // Match primary capacity for symmetry (respect total blocks limit)
    config2.mem_block_num = 4;
    config2.clk_div = 2;  // Same timing as primary
    config2.tx_config.loop_en = false;
    config2.tx_config.carrier_en = false;
    config2.tx_config.idle_level = RMT_IDLE_LEVEL_LOW;
    config2.tx_config.idle_output_en = true;

    err = rmt_config(&config2);
    if (err != ESP_OK) {
        LOG_ERROR(TAG_LED, "Secondary rmt_config failed: %d", (int)err);
        return;
    }

    err = rmt_driver_install(config2.channel, 0, 0);
    if (err != ESP_OK) {
        LOG_ERROR(TAG_LED, "Secondary rmt_driver_install failed: %d", (int)err);
    } else {
        LOG_INFO(TAG_LED, "Secondary channel (GPIO %d) initialized OK", LED_DATA_PIN_2);
    }
    LOG_INFO(TAG_LED, "Legacy RMT v1 secondary channel ready on GPIO 4");
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
std::atomic<uint32_t> g_led_rmt_wait_timeouts{0};

#include "led_driver.h"
#if USE_SPI_SECONDARY
// SPI-based LED driver for secondary channel (GPIO 4)
// Uses SPI peripheral to generate WS2812B timing
// Completely independent of RMT - no interference

#include <Arduino.h>
#include <driver/spi_master.h>
#include <driver/gpio.h>
#include "led_driver.h"

// SPI configuration for WS2812B
// Using 6.4 MHz SPI clock, each WS2812B bit = 4 SPI bits
// '0' = 0b1000 (high 156ns, low 469ns)
// '1' = 0b1110 (high 469ns, low 156ns)
#define SPI_CLOCK_HZ 6400000

// ESP32-S3 has SPI2 and SPI3 hosts
// Use SPI2 for LED output
#define SPI_HOST SPI2_HOST

static spi_device_handle_t spi_device = NULL;
static uint8_t* spi_buffer = NULL;
static const size_t spi_buffer_size = NUM_LEDS * 3 * 4 + 64;  // 4 SPI bytes per WS2812 byte + reset

// Initialize SPI for LED output
esp_err_t init_spi_led_driver() {
    Serial.println("Initializing SPI LED driver for GPIO 4...");

    // Allocate DMA-capable buffer
    spi_buffer = (uint8_t*)heap_caps_malloc(spi_buffer_size, MALLOC_CAP_DMA);
    if (!spi_buffer) {
        Serial.println("Failed to allocate SPI buffer!");
        return ESP_ERR_NO_MEM;
    }
    memset(spi_buffer, 0, spi_buffer_size);

    // Configure SPI bus (no MISO or SCLK needed for LEDs)
    spi_bus_config_t bus_config = {};
    bus_config.mosi_io_num = LED_DATA_PIN_2;  // GPIO 4
    bus_config.miso_io_num = -1;              // Not used
    bus_config.sclk_io_num = -1;              // Not used (internal)
    bus_config.quadwp_io_num = -1;
    bus_config.quadhd_io_num = -1;
    bus_config.max_transfer_sz = spi_buffer_size;
    bus_config.flags = SPICOMMON_BUSFLAG_MASTER;

    esp_err_t ret = spi_bus_initialize(SPI_HOST, &bus_config, SPI_DMA_CH_AUTO);
    if (ret != ESP_OK) {
        Serial.printf("SPI bus init failed: %s\n", esp_err_to_name(ret));
        return ret;
    }

    // Configure SPI device
    spi_device_interface_config_t dev_config = {};
    dev_config.mode = 0;                      // SPI mode 0
    dev_config.clock_speed_hz = SPI_CLOCK_HZ; // 6.4 MHz
    dev_config.spics_io_num = -1;             // No CS pin
    dev_config.queue_size = 1;
    dev_config.flags = SPI_DEVICE_NO_DUMMY;

    ret = spi_bus_add_device(SPI_HOST, &dev_config, &spi_device);
    if (ret != ESP_OK) {
        Serial.printf("SPI device add failed: %s\n", esp_err_to_name(ret));
        return ret;
    }

    Serial.println("SPI LED driver initialized for GPIO 4");
    return ESP_OK;
}

// Convert single byte to 4 SPI bytes (32 bits)
static inline uint32_t byte_to_spi(uint8_t byte) {
    uint32_t result = 0;

    for (int bit = 7; bit >= 0; bit--) {
        result <<= 4;
        if (byte & (1 << bit)) {
            result |= 0b1110;  // '1' bit
        } else {
            result |= 0b1000;  // '0' bit
        }
    }

    return result;
}

// Transmit LED data via SPI
void spi_transmit_leds(const uint8_t* led_data) {
    if (!spi_device || !spi_buffer) return;

    size_t spi_idx = 0;

    // Convert each LED byte to SPI format
    for (size_t i = 0; i < NUM_LEDS * 3; i++) {
        uint32_t spi_data = byte_to_spi(led_data[i]);

        // Store as big-endian (MSB first)
        spi_buffer[spi_idx++] = (spi_data >> 24) & 0xFF;
        spi_buffer[spi_idx++] = (spi_data >> 16) & 0xFF;
        spi_buffer[spi_idx++] = (spi_data >> 8) & 0xFF;
        spi_buffer[spi_idx++] = spi_data & 0xFF;
    }

    // Add reset (50+ us of zeros)
    // At 6.4MHz, 1 bit = 156ns, so 50us = ~320 bits = 40 bytes
    for (int i = 0; i < 40; i++) {
        spi_buffer[spi_idx++] = 0;
    }

    // Transmit via SPI
    spi_transaction_t trans = {};
    trans.length = spi_idx * 8;  // Length in bits
    trans.tx_buffer = spi_buffer;
    trans.rx_buffer = NULL;

    esp_err_t ret = spi_device_polling_transmit(spi_device, &trans);
    if (ret != ESP_OK) {
        static uint32_t last_err = 0;
        uint32_t now = millis();
        if (now - last_err > 1000) {
            Serial.printf("SPI transmit error: %s\n", esp_err_to_name(ret));
            last_err = now;
        }
    }
}

// Clean up SPI resources
void deinit_spi_led_driver() {
    if (spi_device) {
        spi_bus_remove_device(spi_device);
        spi_device = NULL;
    }
    spi_bus_free(SPI_HOST);

    if (spi_buffer) {
        heap_caps_free(spi_buffer);
        spi_buffer = NULL;
    }
}
#endif // USE_SPI_SECONDARY

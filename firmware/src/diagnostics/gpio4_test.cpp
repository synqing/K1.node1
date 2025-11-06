// GPIO 4 Direct Test - Bypasses RMT to verify pin functionality

#include <Arduino.h>
#include <driver/gpio.h>

#define TEST_PIN 4

void test_gpio4_direct() {
    // Configure GPIO 4 as output
    gpio_config_t io_conf = {};
    io_conf.intr_type = GPIO_INTR_DISABLE;
    io_conf.mode = GPIO_MODE_OUTPUT;
    io_conf.pin_bit_mask = (1ULL << TEST_PIN);
    io_conf.pull_down_en = GPIO_PULLDOWN_DISABLE;
    io_conf.pull_up_en = GPIO_PULLUP_DISABLE;

    esp_err_t ret = gpio_config(&io_conf);
    Serial.printf("GPIO4 config result: %s\n", esp_err_to_name(ret));

    // Toggle GPIO 4 at 1Hz for 10 seconds
    Serial.println("Starting GPIO4 toggle test (10 seconds)...");
    for(int i = 0; i < 20; i++) {
        gpio_set_level((gpio_num_t)TEST_PIN, i % 2);
        Serial.printf("GPIO4 = %d\n", i % 2);
        delay(500);
    }

    Serial.println("GPIO4 test complete");
}
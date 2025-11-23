# Research References & Citations

## Microphone (Adafruit SPH0645 I2S MEMS)
- Product page: https://www.adafruit.com/product/3421
- Datasheet: https://www.knowles.com/docs/default-source/default-document-library/sph0645lm4h-datasheet-rev-c.pdf
- Technical specifications: I2S interface, 65 dB SNR, -26 dBFS sensitivity

## ESP32‑S3 I2S RX (I2S Audio Interface)
- ESP‑IDF I2S (I2S RX/TX configuration): https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/i2s.html
- ESP32 TRM references (I2S/APLL clocking): http://www.ee.ic.ac.uk/pcheung/teaching/DE1_EE/Labs/esp32_technical_reference_manual_en.pdf
- ESP32‑S3 TRM (overview): https://files.waveshare.com/upload/1/11/Esp32-s3_technical_reference_manual_en.pdf

## LED Driving (WS2812 via RMT, SPI backends)
- RMT peripheral: https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/peripherals/rmt.html
- LED strip driver: https://components.espressif.com/components/espressif/led_strip/
- ESP‑IDF RMT WS2812 example: https://github.com/espressif/esp-idf/blob/master/examples/peripherals/rmt/led_strip/README.md
- Community RMT timing example: https://github.com/JSchaenzle/ESP32-NeoPixel-WS2812-RMT
- ESP FAQ on RMT DMA: https://docs.espressif.com/projects/esp-faq/en/latest/software-framework/peripherals/rmt.html

## APA102 / HD108 (SPI LEDs)
- APA102 protocol and end frame analysis: https://hackaday.com/2014/12/09/digging-into-the-apa102-serial-led-protocol/
- APA102 PWM frequency and practical notes: https://cpldcpu.com/2014/08/27/apa102/
- End frame length: https://cpldcpu.com/2014/11/30/understanding-the-apa102-superled/
- SparkFun guide: https://learn.sparkfun.com/tutorials/apa102-addressable-led-hookup-guide/all
- ESP32 forum APA102 SPI usage: https://www.esp32.com/viewtopic.php?t=16231
- HD108 practitioner notes: https://www.reddit.com/r/FastLED/comments/mod8mn/fastled_branch_with_16bit_support_hd108/

## SPI Master/Slave & Handshake
- SPI master timing considerations: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/spi_master.html
- SPI slave driver (handshake GPIO recommendation): https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/spi_slave.html
- Tutorial with handshake GPIO example: https://esp32tutorials.com/esp32-spi-master-slave-communication-esp-idf/

## CRC16‑CCITT
- Polynomial 0x1021 overview and code: https://srecord.sourceforge.net/crc16-ccitt.html
- Table‑driven example: http://docs.ros.org/en/diamondback/api/clearpath_base/html/group__crc.html

## DSP Algorithms & Spectral Descriptors
- Goertzel algorithm overview: https://en.wikipedia.org/wiki/Goertzel_algorithm
- Embedded Goertzel article: https://www.embedded.com/the-goertzel-algorithm/
- Generalized Goertzel (non‑integer bins): https://asp-eurasipjournals.springeropen.com/articles/10.1186/1687-6180-2012-56
- KissFFT library: https://github.com/mborgerding/kissfft
- Spectral descriptors overview: https://www.mathworks.com/help/audio/ug/spectral-descriptors.html

## FreeRTOS Scheduling & Performance (ESP32‑S3)
- Performance and task priority guidance: https://docs.espressif.com/projects/esp-idf/en/v5.0/esp32s3/api-guides/performance/speed.html
- SMP behavior, pinning and preemption: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/freertos_idf.html
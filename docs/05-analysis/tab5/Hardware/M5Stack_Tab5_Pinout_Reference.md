---
author: Research Agent (Search & Synthesis)
date: 2025-11-05 14:35 UTC+8
status: published
intent: Quick reference guide for M5Stack Tab5 GPIO pinout and internal interface mapping
---

# M5Stack Tab5 Pinout & Interface Reference

## Quick Summary

- **Processor:** ESP32-P4 (RISC-V, 400 MHz dual-core)
- **Wireless Module:** ESP32-C6-MINI-1U (WiFi 6, BLE 5.2) via SDIO
- **Available GPIO:** 55 pins (GPIO0-GPIO54)
- **Strapping Pins:** GPIO34-GPIO38 (boot configuration)
- **USB-JTAG Pins:** GPIO24, GPIO25 (disable to use as GPIO)

---

## Internal Hardware Connections

### Display & Camera (Dedicated Hardware Interfaces)

| Component | Interface | Pins/Details | Notes |
|---|---|---|---|
| **ILI9881C Display Driver** | MIPI DSI-2 (4-lane) | Dedicated interface (not GPIO) | 1280x720 @ 60 Hz |
| **SC2356 Camera Sensor** | MIPI CSI-2 (4-lane) | Dedicated interface (not GPIO) | 1600x1200 2MP |
| **GT911 Touch Controller** | I2C Bus 0 | I2C address: 0x5D | Capacitive, 5-point multi-touch |

### Power Management & Monitoring

| IC | Interface | I2C Address | Function |
|---|---|---|---|
| **INA226** | I2C Bus 0 | 0x40 | Real-time power/voltage/current monitoring |
| **IP2326** | Internal (power IC) | N/A | Battery charging management |
| **MP4560** | Internal (power IC) | N/A | Buck-boost DC-DC converter |
| **RX8130CE (RTC)** | I2C Bus 0 | 0x32 | Real-time clock with interrupt wakeup |

### Audio System

| Component | Interface | Details |
|---|---|---|
| **ES8388 Codec** | I2C control + I2S 0 | 48 kHz, 16-24 bit stereo |
| **ES7210 AEC** | I2S 0 input | Dual-microphone array with echo cancellation |
| **NS4150B** | Speaker driver | Amplifies codec output to speaker |

### Sensor & Wireless

| Component | Interface | Details |
|---|---|---|
| **BMI270 IMU** | I2C Bus 0 (address 0x68/0x69) | 6-axis accelerometer + gyroscope |
| **ESP32-C6-MINI-1U** | SDIO (Secure Digital I/O) | WiFi 6 + BLE 5.2, separate module |

### Storage & Expansion

| Component | Interface | Details |
|---|---|---|
| **MicroSD Card Slot** | SDIO2 (SDIO2_D0-D3, SDIO2_CMD, SDIO2_CK) | SPI or SDIO mode, supports UHS-II |

---

## Peripheral Pin Configuration (Flexible GPIO Mapping)

### I2C Bus Assignments

**I2C Bus 0 (Standard Mode):**
- Used for: GT911 touchscreen, BMI270 IMU, RX8130CE RTC, INA226 power monitor
- GPIO assignment: Configurable, typically GPIO16 (SDA), GPIO17 (SCL)
- Speed: Up to 800 kHz (high-speed mode supported)

**I2C Bus 1 (User Available):**
- GPIO assignment: Configurable per application
- Speed: Up to 800 kHz
- Common assignment: GPIO6 (SDA), GPIO7 (SCL) on Tab5 (verify in firmware)
- Purpose: Expansion (GROVE port, M5-BUS, external sensors)

### UART Assignments

| UART | Typical GPIO (TX/RX) | Function | Max Speed |
|---|---|---|---|
| **UART 0** | GPIO43/GPIO44 (or USB-JTAG) | Serial monitor / firmware download | 5 Mbps |
| **UART 1** | GPIO14/GPIO13 (typical) | RS-485 interface (SIT3088 driver) | 5 Mbps |
| **UART 2** | GPIO2/GPIO1 (typical) | User available | 5 Mbps |
| **LP-UART** | Varies | Low-power core | 1 Mbps |

**Note:** Exact pin assignments depend on firmware configuration; check M5Stack Tab5 factory firmware source for definitive mapping.

### SPI Interfaces

| SPI Port | Common Pins (MOSI/MISO/SCK) | Max Speed | Function |
|---|---|---|---|
| **SPI 0** | Internal (Flash) | 80 MHz | External Flash memory (16 MB) |
| **SPI 1** | GPIO11/GPIO10/GPIO9 (typical) | 80 MHz | User available |
| **SPI 2** | GPIO48/GPIO47/GPIO46 (typical) | 80 MHz | User available |
| **SPI 3** | Varies | 40 MHz | LP-SPI for low-power apps |

**Chip Select (CS):** Each SPI port can use any GPIO for CS; configurable per application.

### ADC Channels

**ADC0 (12-bit SAR):**
- Channels: 0-6 (7 channels)
- GPIO Mapping: Typically GPIO1-GPIO7 (ADC input capable)

**ADC1 (12-bit SAR):**
- Channels: 7-13 (7 channels)
- GPIO Mapping: Typically GPIO8-GPIO14 (ADC input capable)

**Resolution:** 12-bit (0-4095 values)
**Attenuation Options:** 0 dB, 2.5 dB, 6 dB, 11 dB (for range scaling)
**Reference Voltage:** 1.1 V (internal)

### PWM & Timer Outputs

| Controller | Channels | Max Freq | Resolution | GPIO |
|---|---|---|---|---|
| **LED PWM** | 8 channels | 160 kHz | 14-bit | Any GPIO via mux |
| **MCPWM Unit 0** | 6 channels | 160 MHz | 20-bit | Reserved (GPIO specific) |
| **MCPWM Unit 1** | 6 channels | 160 MHz | 20-bit | Reserved (GPIO specific) |
| **RMT** | 8 channels | Programmable | Flexible | Any GPIO via mux |

---

## Expansion Port Pinout Details

### GROVE Port (Standard 4-pin, I2C variant)

```
[1] 5V/3.3V (switched via EXT5V_EN)
[2] GND
[3] SDA (I2C - pulled high)
[4] SCL (I2C - pulled high)
```

**Compatible Devices:** 1000+ M5Stack GROVE modules
**Typical Current Limit:** 500 mA per GROVE device
**Voltage Options:** Selectable 5V or 3.3V (check module compatibility)

### M5-BUS (30-pin Header)

**Pin Assignments (typical - refer to schematic for exact layout):**

```
Row 1: [1] 5V   [2] GND  [3] SDA  [4] SCL
Row 2: [5] TX   [6] RX   [7] GP?  [8] GP?
       [9] GP?  [10] GP? [11] GP? [12] GP?
       [13] GP? [14] GP? [15] GP? [16] GP?
       ...etc (consult official schematic)
```

**Provides:** 5V power (EXT5V_EN controlled), I2C bus, UART, and multiple GPIO

### GPIO_EXT (2.54mm Header, ~10 pins)

Direct access to general-purpose GPIO pins for breakout boards or custom prototyping.
Pin assignments vary by firmware; check Tab5 pinout diagram in M5Stack documentation.

### STAMP Solder Pads

Exposed pads for soldering additional modules:
- UART TX/RX for cellular modules
- 3.3V, 5V, GND power pads
- I2C (SDA/SCL) pads
- GPIO pads (count/assignment varies)

---

## USB Ports

| Port | Type | Location | Function | Notes |
|---|---|---|---|
| **USB-C** | USB 2.0 OTG | Bottom/Front | Power input, firmware upload, data | Primary interface |
| **USB-A** | USB 2.0 Host | Rear | Connect external USB devices | Keyboard, mouse, storage |

---

## Button & Physical Controls (Typical Tab5 Layout)

| Control | Location | Function | GPIO (if defined) |
|---|---|---|---|
| **Power Button** | Side | Enable/disable main power | Hardware switch, not GPIO |
| **Volume +/-** | Side (optional) | Audio volume, or app-defined | GPIO (varies) |
| **Reset Button** | Side/Bottom | Hard reset ESP32-P4 | Hardware, not GPIO |

**Note:** Exact button layout varies by Tab5 hardware revision; check physical device or official manual.

---

## Pin Allocation Summary Table

### High-Priority (Internal Only, Not User-Accessible)

| GPIO | Function | Notes |
|---|---|---|
| GPIO0-GPIO31 | Partial allocation (varies) | Some reserved for wireless/display |
| GPIO24, GPIO25 | USB-JTAG (disable to use as GPIO) | Default programming interface |
| GPIO34-GPIO38 | Strapping pins (boot config) | Must be in correct state during boot |

### Medium-Priority (Expansion/User-Available)

| GPIO | Common Use | Notes |
|---|---|---|
| GPIO1-GPIO8 | ADC channels, general I/O | Flexible routing |
| GPIO9-GPIO11 | SPI 2 (MOSI/MISO/SCK) | Can be overridden for other uses |
| GPIO13-GPIO17 | UART, I2C, general I/O | Flexible routing |
| GPIO42-GPIO46 | General I/O | Available on GPIO_EXT header |

### Reserved/Dedicated

| GPIO Range | Function | Notes |
|---|---|---|
| GPIO0-GPIO55 | Total available | 55 GPIO pins total |
| MIPI pins | Display & camera | Not directly accessible as GPIO |
| I2S pins | Audio codec | Dedicated for ES8388 |

---

## Development Checklist: GPIO Configuration

When setting up a new M5Stack Tab5 project:

- [ ] Verify which GPIO pins are available in your firmware version
- [ ] Check factory firmware pinout to avoid conflicts
- [ ] Remember GPIO24/GPIO25 (USB-JTAG) are used by default for programming
- [ ] Set strapping pins (GPIO34-38) correctly before boot
- [ ] If using both displays (MIPI DSI), no additional GPIO pins needed
- [ ] If adding external sensors, use I2C Bus 1 (less congested than Bus 0)
- [ ] Test MicroSD card access before relying on storage
- [ ] Verify ESP32-C6 SDIO connection is stable (high-speed interface)
- [ ] Calibrate INA226 for accurate power monitoring
- [ ] Confirm touch controller I2C address (0x5D) if customizing calibration

---

## Recommended GPIO Assignments for Common Expansions

### External Sensor via I2C

```c
// I2C Bus 1 (less congested)
#define SENSOR_SDA_PIN 6   // Example: GPIO6
#define SENSOR_SCL_PIN 7   // Example: GPIO7
// Init I2C on bus 1
```

### LED/Indicator Output

```c
#define LED_PIN 47   // Example: GPIO47 (not used internally)
// Configure as output, toggle for status indication
```

### Button Input

```c
#define BUTTON_PIN 48  // Example: GPIO48 (available GPIO)
// Configure as INPUT with internal pull-up
```

### Custom UART Serial

```c
#define CUSTOM_TX_PIN 2   // Example: GPIO2
#define CUSTOM_RX_PIN 1   // Example: GPIO1
// Configure UART 2 or additional UART if available
```

### Analog Input (Temperature Sensor, etc.)

```c
#define ANALOG_PIN 5   // Example: GPIO5 (ADC capable)
// Configure ADC0 channel 4 for 12-bit analog reading
```

---

## Troubleshooting Pin Assignment Issues

| Problem | Likely Cause | Solution |
|---|---|---|
| **GPIO not responding** | Pin is strapping pin or reserved | Check GPIO allocation table, use different GPIO |
| **I2C slave not detected** | Wrong bus, address conflict, or floating lines | Verify bus selection, check pull-ups (4.7kΩ typical) |
| **UART garbage output** | Baud rate mismatch or pin conflict | Verify baud rate matches firmware setting, check pin assignment |
| **Display flickering after GPIO change** | Conflict with MIPI DSI pins | Avoid modifying GPIO used by display system |
| **Camera frame drops** | MIPI CSI contention or low PSRAM bandwidth | Dedicate PSRAM bandwidth, check CSI clock speeds |

---

## Key Resources

| Resource | URL | Purpose |
|---|---|---|
| **ESP32-P4 GPIO Docs** | https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/peripherals/gpio.html | Official GPIO configuration guide |
| **M5Stack Tab5 Docs** | https://docs.m5stack.com/en/core/Tab5 | Official hardware specification |
| **M5Stack GitHub** | https://github.com/m5stack/Tab5 | Factory firmware source (verify pinout) |
| **ESP32-P4 Datasheet** | https://www.espressif.com/sites/default/files/documentation/esp32-p4_datasheet_en.pdf | Pin details, electrical specifications |

---

**Note:** This pinout reference is compiled from official documentation and research. Always verify against the latest M5Stack factory firmware source code and official datasheet for your specific Tab5 hardware revision, as pinout assignments may vary.

---

**Document Version:** 1.0
**Last Updated:** 2025-11-05
**Status:** Published for technical reference

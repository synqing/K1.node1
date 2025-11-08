# ESP-IDF 4.4 to 5.x API Quick Migration Guide

**Quick Reference for ESP-IDF API Changes (I2S, RMT, GPIO)**

**Last Updated:** 2025-11-06

---

## Version Quick Check

```bash
# Check your ESP-IDF version in firmware/platformio.ini:
# platform = espressif32@5.x    -> ESP-IDF 4.4 (legacy)
# platform = espressif32@6.x    -> ESP-IDF 5.x (modern, breaking changes)

# Check Arduino-ESP32 version in platformio.ini:
# framework-arduinoespressif32 @ 2.0.x  -> ESP-IDF 4.4
# framework-arduinoespressif32 @ 3.0.x+ -> ESP-IDF 5.1+ (BREAKING CHANGES)
```

---

## I2S Migration Quick Map

### Old vs New Includes

```c
// ESP-IDF 4.4 (OLD)
#include "driver/i2s.h"

// ESP-IDF 5.0+ (NEW) - Choose ONE:
#include "driver/i2s_std.h"      // Standard I2S (most common)
#include "driver/i2s_pdm.h"      // PDM mode (audio input)
#include "driver/i2s_tdm.h"      // TDM mode (multi-slot)
```

### Old vs New Initialization

```c
// ============= ESP-IDF 4.4 =============
i2s_config_t i2s_config = {
    .mode = I2S_MODE_MASTER | I2S_MODE_TX,
    .sample_rate = 44100,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
    .communication_format = I2S_COMM_FORMAT_I2S | I2S_COMM_FORMAT_I2S_MSB,
    .intr_alloc_flags = 0,
    .dma_buf_count = 8,        // ← CHANGED
    .dma_buf_len = 64,         // ← CHANGED
    .use_apll = false,
    .tx_desc_auto_clear = true,
    .fixed_mclk = 0,
};
i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);

// ============= ESP-IDF 5.0+ (STANDARD I2S) =============
// Step 1: Channel config
i2s_chan_config_t chan_cfg = {
    .id = I2S_NUM_0,
    .role = I2S_ROLE_MASTER,       // NEW: per-channel role
    .dma_desc_num = 8,             // WAS: dma_buf_count
    .dma_frame_num = 64,           // WAS: dma_buf_len
    .auto_clear = true,
    .intr_priority = 0,
};

// Step 2: Allocate channel
i2s_chan_handle_t tx_chan;
i2s_new_channel(&chan_cfg, &tx_chan, NULL);

// Step 3: Mode config (Standard I2S)
i2s_std_config_t std_cfg = I2S_STD_DEFAULT_CONFIG;
std_cfg.clk_cfg.sample_rate_hz = 44100;
std_cfg.slot_cfg.data_bit_width = I2S_DATA_BIT_WIDTH_16BIT;
std_cfg.gpio_cfg.mclk = GPIO_NUM_0;
std_cfg.gpio_cfg.bclk = GPIO_NUM_4;
std_cfg.gpio_cfg.ws = GPIO_NUM_5;
std_cfg.gpio_cfg.dout = GPIO_NUM_18;
std_cfg.gpio_cfg.din = GPIO_NUM_19;

// Step 4: Initialize with mode
i2s_channel_init_std_mode(tx_chan, &std_cfg);

// Step 5: Enable & start
i2s_channel_enable(tx_chan);
```

### Function Mapping

| ESP-IDF 4.4 | ESP-IDF 5.0+ | Replace With |
|---|---|---|
| `i2s_driver_install()` | — | `i2s_new_channel()` + `i2s_channel_init_std_mode()` |
| `i2s_driver_uninstall()` | — | `i2s_del_channel()` |
| `i2s_start()` | — | `i2s_channel_enable()` |
| `i2s_stop()` | — | `i2s_channel_disable()` |
| `i2s_write()` | — | `i2s_channel_write()` |
| `i2s_read()` | — | `i2s_channel_read()` |
| `i2s_set_sample_rates()` | — | Reconfigure via `i2s_std_config_t` |

---

## RMT Migration Quick Map

### Old vs New Includes

```c
// ESP-IDF 4.4 (OLD)
#include "driver/rmt.h"

// ESP-IDF 5.0+ (NEW)
#include "driver/rmt_tx.h"     // TX channel
#include "driver/rmt_rx.h"     // RX channel
#include "driver/rmt_common.h" // Common types
```

### Old vs New Initialization

```c
// ============= ESP-IDF 4.4 =============
rmt_config_t rmt_cfg = {
    .rmt_mode = RMT_MODE_TX,
    .channel = RMT_CHANNEL_0,        // ← User-specified channel
    .gpio_num = GPIO_NUM_18,
    .mem_block_num = 1,
    .clk_div = 80,
    .tx_config.loop_en = false,
};
rmt_config(&rmt_cfg);
rmt_driver_install(RMT_CHANNEL_0, 0, 0);

// ============= ESP-IDF 5.0+ =============
rmt_tx_channel_config_t rmt_cfg = {
    .gpio_num = GPIO_NUM_18,
    .clk_src = RMT_CLK_SRC_DEFAULT,
    .resolution_hz = 1 * 1000 * 1000,     // 1 MHz
    .mem_block_symbols = 64,
    .trans_queue_depth = 4,
    .invert_out = false,
    .with_dma = false,
};
rmt_channel_handle_t tx_channel = NULL;   // ← Driver allocates
rmt_new_tx_channel(&rmt_cfg, &tx_channel);

// Create encoder (minimal example: copy encoder)
rmt_copy_encoder_config_t copy_enc_cfg = {};
rmt_encoder_handle_t encoder = NULL;
rmt_new_copy_encoder(&copy_enc_cfg, &encoder);

// Enable & transmit
rmt_enable(tx_channel);
rmt_symbol_word_t symbols[32];  // ← NOT rmt_item32_t
// ... populate symbols ...
rmt_transmit(tx_channel, encoder, symbols, sizeof(symbols), &(rmt_transmit_config_t){});
```

### Data Structure Mapping

```c
// ============= ESP-IDF 4.4 =============
rmt_item32_t items[10] = {
    {{{100, 1, 50, 0}}},   // 100 cycles high, 50 low (1 symbol = 2 pulses)
};

// ============= ESP-IDF 5.0+ =============
rmt_symbol_word_t symbols[10] = {
    {.duration0 = 100, .level0 = 1, .duration1 = 50, .level1 = 0},
};
// Note: duration units depend on resolution_hz (now in ns or µs)
```

### Function Mapping

| ESP-IDF 4.4 | ESP-IDF 5.0+ | Replace With |
|---|---|---|
| `rmt_config()` | — | `rmt_new_tx_channel()` / `rmt_new_rx_channel()` |
| `rmt_driver_install()` | — | (merged into channel creation) |
| `rmt_driver_uninstall()` | — | `rmt_del_channel()` |
| `rmt_write_items()` | — | `rmt_transmit()` + encoder |
| `rmt_rx_start()` / `rmt_tx_start()` | — | `rmt_enable()` |
| `rmt_rx_stop()` / `rmt_tx_stop()` | — | `rmt_disable()` |
| `rmt_set_clk_div()` | — | Set during `rmt_new_tx_channel()` config |
| `rmt_register_tx_end_callback()` | — | `rmt_tx_register_event_callbacks()` |
| `rmt_wait_tx_done()` | — | `rmt_tx_wait_all_done()` |

---

## GPIO Quick Reference

### Pin Definition Changes

```c
// ============= ESP-IDF 4.4 (may work) =============
int pin_num = 26;
gpio_set_direction(pin_num, GPIO_MODE_OUTPUT);  // Works in C; warning

// ============= ESP-IDF 5.0+ (required) =============
gpio_set_direction(GPIO_NUM_26, GPIO_MODE_OUTPUT);  // Explicit enum
```

### I2S GPIO Config Update

```c
// ============= ESP-IDF 4.4 =============
i2s_pin_config_t pin_config = {
    .bck_io_num = 26,       // int literal
    .ws_io_num = 25,
    .data_out_num = 19,
    .data_in_num = 35,
};
i2s_set_pin(I2S_NUM_0, &pin_config);

// ============= ESP-IDF 5.0+ =============
i2s_std_gpio_config_t gpio_cfg = {
    .bclk = GPIO_NUM_26,    // gpio_num_t enum
    .ws = GPIO_NUM_25,
    .dout = GPIO_NUM_19,
    .din = GPIO_NUM_35,
};
// (This is now part of i2s_std_config_t, not a separate call)
```

### GPIO Enum Values (Partial List)

```c
GPIO_NUM_0, GPIO_NUM_1, GPIO_NUM_2, GPIO_NUM_3, GPIO_NUM_4,
GPIO_NUM_5, GPIO_NUM_6, GPIO_NUM_7, GPIO_NUM_8, GPIO_NUM_9,
GPIO_NUM_10, GPIO_NUM_11, GPIO_NUM_12, GPIO_NUM_13, GPIO_NUM_14,
GPIO_NUM_15, GPIO_NUM_16, GPIO_NUM_17, GPIO_NUM_18, GPIO_NUM_19,
GPIO_NUM_20, GPIO_NUM_21, GPIO_NUM_22, GPIO_NUM_23, GPIO_NUM_24,
GPIO_NUM_25, GPIO_NUM_26, GPIO_NUM_27, GPIO_NUM_28, GPIO_NUM_29, ...
```

---

## Troubleshooting Compilation Errors

### Error: `i2s_chan_config_t has no member named 'role'`

**Cause:** Using old I2S API
**Solution:** Include `driver/i2s_std.h` instead of `driver/i2s.h`, use new `i2s_chan_config_t` structure

### Error: `i2s_driver_install was not declared`

**Cause:** Old function removed in ESP-IDF 5.x
**Solution:** Use `i2s_new_channel()` followed by `i2s_channel_init_std_mode()`

### Error: `rmt_item32_t does not name a type`

**Cause:** Using old RMT API
**Solution:** Use `rmt_symbol_word_t` instead; include `driver/rmt_tx.h`

### Error: `rmt_write_items was not declared`

**Cause:** Old RMT function removed
**Solution:** Use `rmt_transmit()` with an encoder handle

### Error: `invalid conversion from 'int' to 'gpio_num_t'`

**Cause:** GPIO pin as integer instead of enum
**Solution:** Replace `26` with `GPIO_NUM_26`, `25` with `GPIO_NUM_25`, etc.

---

## Platform Version Lock Options

### Option 1: Stay on ESP-IDF 4.4 (Legacy)

```ini
# platformio.ini
[env:esp32-s3-devkitc-1]
platform = espressif32@5.4.1      # Last v5 platform = IDF 4.4
framework = arduino
board = esp32-s3-devkitc-1
board_build.mcu = esp32s3

# Optional: lock Arduino-ESP32 version
# framework-arduinoespressif32 @ 2.0.14
```

**Pros:** No code changes; existing code works
**Cons:** No future updates; legacy frameworks eventually unsupported

### Option 2: Migrate to ESP-IDF 5.x (Recommended)

```ini
# platformio.ini
[env:esp32-s3-devkitc-1]
platform = espressif32@6.x        # Latest platform = IDF 5.x
framework = arduino
board = esp32-s3-devkitc-1
board_build.mcu = esp32s3

# framework-arduinoespressif32 @ 3.0.x (implicit, auto-selected)
```

**Pros:** Future-proof; active security updates; better hardware support
**Cons:** Code refactoring required (estimated: days to weeks)

---

## Testing Checklist

After migration, verify:

- [ ] I2S TX/RX initialization and data flow
- [ ] RMT TX symbol transmission
- [ ] GPIO pin state (HIGH/LOW) for control pins
- [ ] Interrupt handlers and callbacks still fire
- [ ] No stale memory references or use-after-free
- [ ] DMA buffer sizes correct (new calculation)
- [ ] Clock rates match expected audio/RMT timing
- [ ] Power consumption reasonable (no busy-loops)

---

## See Also

- **Full Research:** `/docs/05-analysis/K1NAnalysis_RESEARCH_ESP_IDF_API_BREAKING_CHANGES_v1.0_20251108.md`
- **Official I2S Docs:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/i2s.html
- **Official RMT Docs:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/rmt.html
- **Arduino-ESP32 Migration:** https://docs.espressif.com/projects/arduino-esp32/en/latest/migration_guides/2.x_to_3.0.html
- **GitHub Examples:** https://github.com/espressif/esp-idf/tree/master/examples/peripherals/i2s

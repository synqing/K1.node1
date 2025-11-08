# ESP-IDF & Arduino-ESP32 Framework API Breaking Changes Research

**Title:** ESP-IDF 4.x vs 5.x Peripheral API Changes (I2S, RMT, GPIO)

**Owner:** Research Analyst

**Date:** 2025-11-06

**Status:** Accepted

**Scope:** Framework version boundaries for I2S, RMT, and GPIO peripheral API changes affecting compilation

**Related:**
- [K1.node1 Compilation Errors](#)
- [PlatformIO Firmware Build Issue](#)

**Tags:** firmware, esp-idf, breaking-changes, migration, i2s, rmt, gpio

---

## Executive Summary

The K1.node1 firmware compilation errors stem from **framework version mismatch**: the codebase appears to target **ESP-IDF 4.x API** (or a mixed state) while the current PlatformIO/Arduino-ESP32 environment provides **ESP-IDF 5.x compatible APIs**. Three major peripherals underwent significant refactoring:

1. **I2S Driver:** Complete rewrite; `i2s_chan_config_t` changed structure; `dma_buf_count`/`dma_buf_len` deprecated
2. **RMT Driver:** Handle-based API replaces channel-number-based; `rmt_item32_t` → `rmt_symbol_word_t`
3. **GPIO:** `gpio_num_t` now strictly enforced as enum (not int casts)

**Version Boundary:** **ESP-IDF 5.0.0** (released 2022-12-02) is the inflection point.

---

## Part 1: I2S API Changes

### Version Boundary: ESP-IDF 5.0.0

**Released:** December 2, 2022

**Why?**
Espressif redesigned the I2S driver to improve compatibility with all communication modes and unlock features in ESP32-C3 and ESP32-S3 that required per-channel (TX/RX) control.

### Key Breaking Changes

#### 1. Driver Headers Changed

| Aspect | ESP-IDF 4.4 | ESP-IDF 5.0+ |
|--------|-----------|------------|
| **Main Header** | `#include "driver/i2s.h"` | `#include "driver/i2s_std.h"` (std mode) |
| | | `#include "driver/i2s_pdm.h"` (PDM mode) |
| | | `#include "driver/i2s_tdm.h"` (TDM mode) |
| **Backward Compat** | — | Old API in `driver/deprecated/driver/i2s.h` (with warnings) |

#### 2. Configuration Structure: `i2s_config_t` → Channel + Mode Config

**ESP-IDF 4.4 (Old API):**
```c
i2s_config_t i2s_config = {
    .mode = I2S_MODE_MASTER | I2S_MODE_TX,
    .sample_rate = 44100,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
    .communication_format = I2S_COMM_FORMAT_I2S | I2S_COMM_FORMAT_I2S_MSB,
    .intr_alloc_flags = 0,
    .dma_buf_count = 8,           // DEPRECATED
    .dma_buf_len = 64,            // DEPRECATED
    .use_apll = false,
    .tx_desc_auto_clear = true,
    .fixed_mclk = 0,
};
i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);
```

**ESP-IDF 5.0+ (New API):**
```c
// Step 1: Configure the channel (TX or RX)
i2s_chan_config_t chan_cfg = {
    .id = I2S_NUM_0,
    .role = I2S_ROLE_MASTER,       // NEW: role is channel-level
    .dma_desc_num = 8,             // REPLACED dma_buf_count
    .dma_frame_num = 64,           // REPLACED dma_buf_len
    .auto_clear = true,            // NEW
    .intr_priority = 0,            // NEW
};

// Step 2: Allocate the channel
i2s_chan_handle_t tx_chan;
i2s_new_channel(&chan_cfg, &tx_chan, NULL);  // NULL = no RX

// Step 3: Configure the mode (standard I2S)
i2s_std_config_t std_cfg = {
    .clk_cfg = {
        .sample_rate_hz = 44100,
        .clk_src = I2S_CLK_SRC_DEFAULT,
        .ext_clk_freq_hz = 0,
        .mclk_multiple = I2S_MCLK_MULTIPLE_256,
    },
    .slot_cfg = {
        .data_bit_width = I2S_DATA_BIT_WIDTH_16BIT,
        .left_align = false,
        .big_endian = false,
        .bit_shift = true,
        .msb_right = false,
        .ws_width = I2S_SLOT_BIT_WIDTH_AUTO,
        .ws_pol = false,
        .slot_mode = I2S_SLOT_MODE_STEREO,
        .slot_mask = I2S_STD_SLOT_BOTH,
        .ws_width = I2S_SLOT_BIT_WIDTH_AUTO,
    },
    .gpio_cfg = {
        .mclk = GPIO_NUM_0,   // MCLK pin
        .bclk = GPIO_NUM_4,
        .ws = GPIO_NUM_5,
        .dout = GPIO_NUM_18,
        .din = GPIO_NUM_19,
        .invert_flags.mclk_inv = false,
    },
};

// Step 4: Initialize the channel with mode config
i2s_channel_init_std_mode(tx_chan, &std_cfg);

// Step 5: Enable and start
i2s_channel_enable(tx_chan);
```

#### 3. Channel Handle (`i2s_chan_handle_t`)

**Key Difference:** Control unit changed from I2S controller → I2S channel (TX or RX)

| Feature | ESP-IDF 4.4 | ESP-IDF 5.0+ |
|---------|-----------|------------|
| **Control Unit** | Entire I2S controller (shared TX/RX) | Individual TX/RX channels |
| **TX Control** | `i2s_driver_install(I2S_NUM_0, ...)` | `i2s_new_channel(..., &tx_chan, NULL)` |
| **RX Control** | Both on same controller | `i2s_new_channel(..., NULL, &rx_chan)` |
| **Independent Control?** | Limited; affects both TX/RX | Yes; can start/stop separately |

#### 4. DMA Buffer Configuration

| Parameter | ESP-IDF 4.4 | ESP-IDF 5.0+ | Notes |
|-----------|-----------|------------|-------|
| **Descriptor Count** | `dma_buf_count` | `dma_desc_num` | Number of DMA descriptors |
| **Frame Size** | `dma_buf_len` | `dma_frame_num` | Frames per DMA buffer |
| **Calculation** | `dma_buf_count × dma_buf_len` | `dma_desc_num × dma_frame_num × slot_num × bit_width / 8` | Different math! |
| **24-bit Support** | May have issues | Requires multiple of 3 | ES-IDF 5.0+ enforces this |

**Critical:** DMA buffer size calculation is **completely different**. Old `dma_buf_len` is not directly comparable to new `dma_frame_num`.

#### 5. Functions That Disappeared

| Old (ESP-IDF 4.4) | New (ESP-IDF 5.0+) | Notes |
|------------------|------------------|-------|
| `i2s_driver_install()` | `i2s_new_channel() + i2s_channel_init_std_mode()` | Two-step process now |
| `i2s_driver_uninstall()` | `i2s_del_channel()` | Delete the channel handle |
| `i2s_start()` | `i2s_channel_enable()` | Method changed |
| `i2s_stop()` | `i2s_channel_disable()` | Method changed |
| `i2s_write()` | `i2s_channel_write()` | Same function, takes handle |
| `i2s_read()` | `i2s_channel_read()` | Same function, takes handle |

#### 6. I2S Mode Selection

**ESP-IDF 4.4:** Mode embedded in `i2s_config_t.mode` field:
```c
.mode = I2S_MODE_MASTER | I2S_MODE_TX | I2S_MODE_RX | I2S_MODE_PDM_RX  // All in one
```

**ESP-IDF 5.0+:** Mode selected via separate header and init function:
```c
#include "driver/i2s_std.h"    // Standard I2S
// or
#include "driver/i2s_pdm.h"    // PDM mode
// or
#include "driver/i2s_tdm.h"    // TDM mode

i2s_channel_init_std_mode(handle, &std_cfg);      // Standard
// or
i2s_channel_init_pdm_rx_mode(handle, &pdm_cfg);   // PDM RX
// or
i2s_channel_init_tdm_mode(handle, &tdm_cfg);      // TDM
```

---

## Part 2: RMT API Changes

### Version Boundary: ESP-IDF 5.0.0

**Released:** December 2, 2022

**Why?**
Espressif redesigned RMT to support flexible encoding/decoding and make it compatible with all RMT hardware variants.

### Key Breaking Changes

#### 1. Driver Headers Changed

| Aspect | ESP-IDF 4.4 | ESP-IDF 5.0+ |
|--------|-----------|------------|
| **Header** | `#include "driver/rmt.h"` | `#include "driver/rmt_tx.h"` (TX) |
| | | `#include "driver/rmt_rx.h"` (RX) |
| **Common** | (included in rmt.h) | `#include "driver/rmt_common.h"` |

#### 2. Channel Handle Architecture

**ESP-IDF 4.4:**
```c
// User directly manages channel numbers
rmt_config_t rmt_cfg = {
    .rmt_mode = RMT_MODE_TX,
    .channel = RMT_CHANNEL_0,        // User specifies channel 0-7
    .gpio_num = GPIO_NUM_18,
    .mem_block_num = 1,
    .clk_div = 80,                   // 1 MHz
    .tx_config.loop_en = false,
};
rmt_config(&rmt_cfg);
rmt_driver_install(rmt_cfg.channel, 0, 0);

// Transmit with raw item32 structures
rmt_item32_t items[32];
// ... populate items ...
rmt_write_items(RMT_CHANNEL_0, items, item_num, wait_tx_done);
```

**ESP-IDF 5.0+:**
```c
// Driver allocates channels dynamically via handles
rmt_tx_channel_config_t rmt_cfg = {
    .gpio_num = GPIO_NUM_18,
    .clk_src = RMT_CLK_SRC_DEFAULT,
    .resolution_hz = 1 * 1000 * 1000,  // 1 MHz resolution
    .mem_block_symbols = 64,
    .trans_queue_depth = 4,
};
rmt_channel_handle_t tx_channel = NULL;
rmt_new_tx_channel(&rmt_cfg, &tx_channel);  // Driver allocates

// Transmit with encoder + symbols
rmt_encoder_config_t encoder_cfg = {
    // ... encoder configuration ...
};
rmt_encoder_handle_t encoder = NULL;
rmt_new_copy_encoder(&encoder_cfg, &encoder);

rmt_transmit_config_t tx_config = {
    .loop_count = 0,
};
rmt_transmit(tx_channel, encoder, payload, payload_bytes, &tx_config);
```

#### 3. Data Structure Changes

| Old (ESP-IDF 4.4) | New (ESP-IDF 5.0+) | Notes |
|------------------|------------------|-------|
| `rmt_channel_t` enum (0-7) | `rmt_channel_handle_t` opaque handle | User never specifies channel number |
| `rmt_item32_t` struct with nested union | `rmt_symbol_word_t` flat struct | Cleaner API |
| `rmt_translator_t` callbacks | `rmt_encoder_t` object system | Encoder pattern replaces translator |
| `rmt_mem_t` (direct mem access) | Hidden; not user-accessible | Safety improvement |

#### 4. Item/Symbol Structure Changes

**ESP-IDF 4.4:**
```c
// rmt_item32_t: 32-bit value representing one RMT symbol (duration + level)
typedef union {
    struct {
        uint16_t duration0 : 15;    // Bit length of the pulse
        uint16_t level0 : 1;        // Polarity
        uint16_t duration1 : 15;
        uint16_t level1 : 1;
    };
    uint32_t val;
} rmt_item32_t;

rmt_item32_t items[] = {
    {{{100, 1, 50, 0}}},   // 100 cycles high, 50 low
    {{{200, 1, 100, 0}}},
};
```

**ESP-IDF 5.0+:**
```c
// rmt_symbol_word_t: Cleaner structure for RMT symbols
typedef struct {
    uint16_t duration0;    // Duration in resolution units
    uint16_t level0 : 1;   // Polarity (0 or 1)
    uint16_t duration1;
    uint16_t level1 : 1;
} rmt_symbol_word_t;

rmt_symbol_word_t symbols[] = {
    {.duration0 = 100, .level0 = 1, .duration1 = 50, .level1 = 0},
    {.duration0 = 200, .level0 = 1, .duration1 = 100, .level1 = 0},
};
```

#### 5. API Function Mapping

| Old (ESP-IDF 4.4) | New (ESP-IDF 5.0+) | Change |
|------------------|------------------|--------|
| `rmt_config()` | `rmt_new_tx_channel()` / `rmt_new_rx_channel()` | Two separate functions |
| `rmt_driver_install()` | (built into `rmt_new_*_channel()`) | Merged into allocation |
| `rmt_driver_uninstall()` | `rmt_del_channel()` | Delete handle |
| `rmt_set_clk_div()` | Config during `rmt_new_*_channel()` | No runtime changes |
| `rmt_get_clk_div()` | — | No runtime query |
| `rmt_write_items()` | `rmt_transmit()` + encoder | Encoder-based |
| `rmt_rx_start()` | `rmt_enable()` | Unified enable |
| `rmt_rx_stop()` | `rmt_disable()` | Unified disable |
| `rmt_wait_tx_done()` | `rmt_tx_wait_all_done()` | Wait for completion |
| `rmt_register_tx_end_callback()` | `rmt_tx_register_event_callbacks()` | Event-based callbacks |
| `rmt_translator_init()` | `rmt_new_copy_encoder()` (or custom encoder) | Encoder pattern |

#### 6. Encoder System (New in 5.0)

**Key Concept:** User must provide an **encoder** to translate application data into RMT symbols.

**ESP-IDF 5.0+ Example:**
```c
// Built-in copy encoder (simplest)
rmt_copy_encoder_config_t copy_enc_cfg = {};
rmt_encoder_handle_t copy_encoder = NULL;
rmt_new_copy_encoder(&copy_enc_cfg, &copy_encoder);

// Now transmit pre-formatted RMT symbols
rmt_symbol_word_t symbols[10];  // Pre-built symbols
rmt_transmit_config_t tx_cfg = { .loop_count = 0 };
rmt_transmit(tx_channel, copy_encoder, symbols, sizeof(symbols), &tx_cfg);
```

---

## Part 3: GPIO API Changes

### Version Boundary: Incremental; Stricter in ESP-IDF 5.0+

**Key Finding:** `gpio_num_t` has **always been an enum**. The breaking change is not structural, but **stricter type enforcement**, particularly in C++ code.

#### Type Definition History

| Version | `gpio_num_t` | Impact |
|---------|------------|--------|
| ESP-IDF 3.x–4.4 | `enum` (GPIO_NUM_0, etc.) | Accepted integer literals with warnings in C, errors in C++ |
| ESP-IDF 5.0+ | `enum` (strict) | Strongly enforces enum type; C++ no longer auto-casts int → gpio_num_t |

#### The Problem (Particularly in ESP-IDF 5.0+)

**Old Code (esp-idf 4.4, C):**
```c
int pin = 16;
gpio_set_direction(pin, GPIO_MODE_OUTPUT);  // Warning but works
```

**Modern Code (esp-idf 5.0+, C or C++):**
```c
// This now requires explicit enum:
gpio_set_direction(GPIO_NUM_16, GPIO_MODE_OUTPUT);  // Correct

// Direct integer casting no longer works in C++:
gpio_set_direction((gpio_num_t)16, GPIO_MODE_OUTPUT);  // Required in C++
```

#### Affected APIs

All GPIO functions now require `gpio_num_t`:
- `gpio_set_direction(gpio_num_t gpio_num, ...)`
- `gpio_set_level(gpio_num_t gpio_num, ...)`
- `gpio_get_level(gpio_num_t gpio_num)`
- `gpio_set_pull_mode(gpio_num_t gpio_num, ...)`
- I2S GPIO config fields: `.mclk`, `.bclk`, `.ws`, `.dout`, `.din` (all `gpio_num_t` now)

#### Common Fix Pattern

```c
// BEFORE (esp-idf 4.4 accepted this)
i2s_pin_config_t pin_config = {
    .bck_io_num = 26,        // int literal
    .ws_io_num = 25,
    .data_out_num = 19,
    .data_in_num = 35,
};

// AFTER (esp-idf 5.0+ requires)
i2s_std_gpio_config_t gpio_cfg = {
    .bclk = GPIO_NUM_26,     // enum value
    .ws = GPIO_NUM_25,
    .dout = GPIO_NUM_19,
    .din = GPIO_NUM_35,
};
```

---

## Part 4: Framework Version Mapping

### Arduino-ESP32 Version → ESP-IDF Version Mapping

| Arduino-ESP32 | ESP-IDF | Release Date | Status |
|---|---|---|---|
| 2.0.0 – 2.0.14 | 4.4.x | 2022–2023 Q1 | **Stable (legacy)** |
| **3.0.0+** | **5.1.x** | **2023 Q3+** | **Current; breaking changes** |
| 3.0.0 | 5.1.0 | July 3, 2023 | Major update |
| 3.1.x – 3.3.x | 5.1.x – 5.2.x | 2023 Q3–Q4 | Incremental updates |

### PlatformIO `espressif32` Platform → ESP-IDF Mapping

| PlatformIO Platform | ESP-IDF | Arduino-ESP32 | Notes |
|---|---|---|---|
| v5.x | 4.4.x | 2.0.x | Legacy |
| **v6.0.0+** | **5.0.x–5.2.x** | **3.0.x+** | **Breaking changes** |
| v6.4.0 | 5.1.1 | 3.0.x | Most recent stable |

**Key Point:** PlatformIO v6.x uses ESP-IDF 5.x; if your codebase assumes ESP-IDF 4.4, **compilation will fail** on PlatformIO v6.0+.

---

## Part 5: Compilation Error Diagnosis

### Error Pattern 1: I2S Configuration

**Symptom:**
```
error: 'struct <anonymous>' has no member named 'role'
error: 'i2s_driver_install' was not declared
```

**Root Cause:** Code written for ESP-IDF 4.4 trying to use old `i2s_config_t` and `i2s_driver_install()`.

**ESP-IDF 5.0+ Requires:**
- Use `i2s_chan_config_t` (not `i2s_config_t`)
- Call `i2s_new_channel()` (not `i2s_driver_install()`)
- Include mode-specific header (`i2s_std.h`, `i2s_pdm.h`, or `i2s_tdm.h`)
- Call `i2s_channel_init_std_mode()` (or PDM/TDM variant)

### Error Pattern 2: RMT Data Structures

**Symptom:**
```
error: 'rmt_item32_t' does not name a type
error: 'rmt_write_items' was not declared
```

**Root Cause:** Old RMT API assumes channel numbers and item32 structures.

**ESP-IDF 5.0+ Requires:**
- Use `rmt_channel_handle_t` (allocated by driver)
- Use `rmt_symbol_word_t` (not `rmt_item32_t`)
- Call `rmt_new_tx_channel()` / `rmt_new_rx_channel()`
- Use encoder system (`rmt_transmit()` with encoder)

### Error Pattern 3: GPIO Type Mismatches

**Symptom:**
```
error: invalid conversion from 'int' to 'gpio_num_t' [-fpermissive]
```

**Root Cause:** Direct integer pins where `gpio_num_t` enum expected (esp-idf 5.0+ stricter).

**Fix:**
- Replace `26` with `GPIO_NUM_26`
- Replace `25` with `GPIO_NUM_25`
- Ensure all GPIO config fields use enum constants

---

## Part 6: Migration Decision Matrix

### Decision Tree: Which Version Should K1.node1 Target?

**If you are using PlatformIO with `espressif32` platform v6.x (recent):**
- You **must** use ESP-IDF 5.x APIs
- You **cannot** use old 4.4 I2S or RMT code
- Migration effort: **HIGH** (code rewrite required)

**If you want to target ESP-IDF 4.4 (legacy):**
- Pin PlatformIO `espressif32` to v5.x
- Pin Arduino-ESP32 to 2.0.x
- Update `platformio.ini`: `platform = espressif32@5.4.1` (or similar)
- Migration effort: **LOW** (no code changes, environment config only)

**Recommendation for K1.node1:**
- **Modern Path:** Migrate to ESP-IDF 5.x APIs (recommended)
  - Future-proof
  - Better hardware support
  - Active security updates
  - Effort: Days to weeks of refactoring

- **Pragmatic Path:** Lock to PlatformIO v5.x, Arduino-ESP32 2.0.x
  - Keep existing code
  - Lose future improvements
  - Risk: legacy frameworks eventually unsupported
  - Effort: Minimal (config only)

---

## Part 7: Specific Version References & Links

### ESP-IDF Official Documentation

| Topic | URL | ESP-IDF Version |
|-------|-----|---|
| **I2S Migration** | https://docs.espressif.com/projects/esp-idf/en/stable/esp32/migration-guides/release-5.x/5.0/peripherals.html | 5.0–5.5.1 |
| **RMT Migration** | https://docs.espressif.com/projects/esp-idf/en/stable/esp32/migration-guides/release-5.x/5.0/peripherals.html | 5.0–5.5.1 |
| **GPIO Reference** | https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/gpio.html | Latest |
| **I2S API Ref** | https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/i2s.html | Latest |
| **RMT API Ref** | https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/rmt.html | Latest |

### Arduino-ESP32 Documentation

| Topic | URL |
|-------|-----|
| **Migration 2.x → 3.0** | https://docs.espressif.com/projects/arduino-esp32/en/latest/migration_guides/2.x_to_3.0.html |
| **GitHub Releases** | https://github.com/espressif/arduino-esp32/releases |
| **Quick Start (Random Nerd)** | https://randomnerdtutorials.com/esp32-migrating-version-2-to-3-arduino/ |

### PlatformIO Platform Documentation

| Topic | URL |
|-------|-----|
| **Espressif32 Platform** | https://docs.platformio.org/en/latest/platforms/espressif32.html |
| **GitHub Releases** | https://github.com/platformio/platform-espressif32/releases |
| **Version Mapping Discussion** | https://github.com/platformio/platform-espressif32/issues/1225 |

### ESP-IDF GitHub Repositories

| Resource | URL |
|----------|-----|
| **Release Tags** | https://github.com/espressif/esp-idf/releases |
| **Deprecated I2S Header** | https://github.com/espressif/esp-idf/blob/v5.2.3/components/driver/deprecated/driver/i2s.h |
| **New I2S Headers** | https://github.com/espressif/esp-idf/blob/v5.2.1/components/driver/i2s/include/driver/ |
| **RMT New API** | https://github.com/espressif/esp-idf/blob/master/components/driver/rmt/ |

---

## Conclusions & Recommendations

### Key Findings

1. **Version Boundary:** ESP-IDF 5.0.0 (Dec 2, 2022) is the inflection point for I2S and RMT breaking changes.

2. **I2S:** Complete rewrite with channel-based control, new structures (`i2s_chan_config_t`, `i2s_std_config_t`), and two-step initialization.

3. **RMT:** Shift from channel-number + item32-based to handle + encoder-based API. Much more flexible but requires rewrite.

4. **GPIO:** `gpio_num_t` has always been enum; stricter enforcement in ESP-IDF 5.0+ and C++ code.

5. **Framework Mapping:**
   - Arduino-ESP32 2.0.x → ESP-IDF 4.4 (legacy, stable)
   - Arduino-ESP32 3.0.x → ESP-IDF 5.1+ (modern, breaking changes)
   - PlatformIO v6.x → ESP-IDF 5.x (not compatible with 4.4 code)

### Recommended Next Steps for K1.node1

1. **Audit Codebase:** Identify all I2S, RMT, and GPIO configuration calls.

2. **Choose Path:**
   - **Migration Path (Recommended):** Update to ESP-IDF 5.x APIs
   - **Lock-to-Legacy Path:** Constrain PlatformIO & Arduino-ESP32 versions

3. **If Migrating:**
   - Start with I2S (most complex)
   - Then RMT (encoder system needs learning)
   - Finally GPIO (simpler fixes)
   - Reference the official Espressif migration guides and examples

4. **Testing:** Use PlatformIO examples as reference; validate each peripheral after refactoring.

---

## Document History

- **2025-11-06:** Initial research and analysis compiled. Confirmed version boundaries, API changes, and migration patterns.

---

## Tags & Metadata

**Complexity:** Medium-High
**Audience:** Firmware Engineers, PlatformIO Users
**Actionability:** High (clear version boundaries and migration patterns)
**Confidence:** High (sourced from official Espressif docs and GitHub releases)

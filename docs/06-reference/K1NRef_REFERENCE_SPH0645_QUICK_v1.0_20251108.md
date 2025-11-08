# SPH0645 MEMS Microphone - Quick Reference Guide

**Use this for**: Fast lookups, parameter checklists, troubleshooting flow

---

## Configuration Template (Copy-Paste Ready)

```c
#include "driver/i2s.h"
#include "soc/i2s_reg.h"

#define I2S_PORT I2S_NUM_0
#define I2S_BCK_PIN 26
#define I2S_WS_PIN 25
#define I2S_DIN_PIN 22
#define SAMPLE_RATE 16000

static const i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_RIGHT,
    .communication_format = (i2s_comm_format_t)(I2S_COMM_FORMAT_I2S | I2S_COMM_FORMAT_I2S_MSB),
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,
    .dma_buf_len = 64,
    .use_apll = false
};

static const i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_BCK_PIN,
    .ws_io_num = I2S_WS_PIN,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_DIN_PIN
};

void init_sph0645(void) {
    i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
    i2s_set_pin(I2S_PORT, &pin_config);

    // REQUIRED: Apply SPH0645 timing fixes
    REG_SET_BIT(I2S_TIMING_REG(I2S_PORT), BIT(9));
    REG_SET_BIT(I2S_CONF_REG(I2S_PORT), I2S_RX_MSB_SHIFT);
}
```

---

## Critical Parameters Checklist

```
[ ] bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT  (NOT 16-bit!)
[ ] channel_format = I2S_CHANNEL_FMT_ONLY_RIGHT  (or try ONLY_LEFT)
[ ] communication_format includes I2S_COMM_FORMAT_I2S_MSB
[ ] Register fix: REG_SET_BIT(I2S_TIMING_REG, BIT(9))
[ ] Register fix: REG_SET_BIT(I2S_CONF_REG, I2S_RX_MSB_SHIFT)
[ ] #include "soc/i2s_reg.h" added
[ ] DMA buffer count = 8 (typical)
[ ] DMA buffer length = 64 (typical)
```

---

## Data Extraction

```c
// Read 32-bit samples from I2S
uint8_t buffer[512];
size_t bytes_read = 0;
i2s_read(I2S_PORT, buffer, 512, &bytes_read, portMAX_DELAY);

// Cast to int32_t
int32_t *samples = (int32_t *)buffer;
int num_samples = bytes_read / sizeof(int32_t);

// Extract 18-bit audio (right shift by 14)
for (int i = 0; i < num_samples; i++) {
    int32_t audio = samples[i] >> 14;
    // Process audio...
}
```

---

## DC Offset Removal (Simple)

```c
// Subtract running mean
#define DC_WINDOW 256
int32_t dc_window[DC_WINDOW] = {0};
size_t dc_index = 0;

int32_t remove_dc(int32_t sample) {
    int64_t sum = 0;
    for (int i = 0; i < DC_WINDOW; i++) sum += dc_window[i];
    int32_t mean = (int32_t)(sum / DC_WINDOW);
    dc_window[dc_index] = sample;
    dc_index = (dc_index + 1) % DC_WINDOW;
    return sample - mean;
}
```

---

## Sample Rate & Clock Frequencies

| Sample Rate | BCLK Required | WS Frequency | Notes |
|---|---|---|---|
| 16 kHz | 1.024 MHz | 16 kHz | Common; works with v4.4 |
| 22.05 kHz | 1.411 MHz | 22.05 kHz | Audio CD rate |
| 32 kHz | 2.048 MHz | 32 kHz | Rev C minimum |
| 44.1 kHz | 2.822 MHz | 44.1 kHz | Audio CD |
| 48 kHz | 3.072 MHz | 48 kHz | Professional audio |

Formula: `BCLK = Sample_Rate × 64`

---

## Troubleshooting Quick Fixes

| Problem | First Try | Then Try |
|---------|-----------|----------|
| All zeros | Check pins with oscilloscope | Verify `i2s_driver_install()` return code |
| Random noise | Verify register fixes applied | Try `I2S_CHANNEL_FMT_ONLY_LEFT` instead |
| All negative | Implement DC offset filter | Verify bit shift (try `>> 8` instead of `>> 14`) |
| Dropouts | Increase `dma_buf_count` to 16 | Increase `dma_buf_len` to 128 |
| Audio "underwater" | Verify actual BCLK frequency | Check `sample_rate` matches actual clock |

---

## Pin Configuration (Common)

**Standard ESP32 DevKit**:
```
SPH0645 SCK   → ESP32 GPIO 26 (I2S BCK)
SPH0645 WS    → ESP32 GPIO 25 (I2S WS)
SPH0645 SD    → ESP32 GPIO 22 (I2S DIN)
SPH0645 3V3   → ESP32 3.3V
SPH0645 GND   → ESP32 GND
SPH0645 SEL   → ESP32 GND (use I2S_CHANNEL_FMT_ONLY_LEFT)
                or 3.3V (use I2S_CHANNEL_FMT_ONLY_RIGHT)
```

**Note**: If audio is inverted or missing, try opposite channel format.

---

## Register Fixes Explained

```c
// Fix 1: RX data delay adjustment
// Moves sampling from rising edge to falling edge of BCLK
REG_SET_BIT(I2S_TIMING_REG(I2S_PORT), BIT(9));

// Fix 2: MSB shift in RX path
// Corrects bit alignment issues from non-standard SPH0645 timing
REG_SET_BIT(I2S_CONF_REG(I2S_PORT), I2S_RX_MSB_SHIFT);
```

These **must be applied** after `i2s_set_pin()` and before reading data.

---

## Verification Steps

1. **Hardware**: Connect oscilloscope to BCK, WS, DIN
   - BCK should be 64× WS frequency
   - All signals should be clean squares

2. **First Read**: Log first 10 samples
   ```c
   int32_t samples[10];
   read_sph0645_samples(samples, 10);
   for (int i = 0; i < 10; i++) {
       printf("Sample %d: 0x%08X\n", i, samples[i]);
   }
   ```
   - If all 0x00000000: Clock issue
   - If all 0xFFFFFFFF: Data line stuck low
   - If varying: Register fixes likely applied correctly

3. **Audio Quality**: Record known tone
   - Should see ~10-20 bits of variation
   - DC offset present but not dominant after filtering

---

## Alternative: Use INMP441 Instead

**Why switch**:
- No register fixes needed
- No timing issues
- Better documentation
- Works "out of the box"

**Configuration** (simpler):
```c
.bits_per_sample = I2S_BITS_PER_SAMPLE_24BIT,  // Can use 24-bit
.channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,    // No experimentation needed
// NO register fixes required!
```

---

## DMA Buffer Math

```
Real DMA Buffer Size = dma_buf_len × 1 channel × 32 bits / 8
                    = dma_buf_len × 4 bytes

Interrupt Interval = dma_buf_len / sample_rate
                   = 64 / 16000 = 4 ms (for dma_buf_len=64, 16kHz)

Total DMA Memory = dma_buf_count × buffer_size
                 = 8 × (64 × 4) = 2 KB
```

---

## Compilation Issues

**Missing `I2S_TIMING_REG`**:
```c
#include "soc/i2s_reg.h"  // Add this!
```

**Undefined `REG_SET_BIT`**:
```c
#include "soc/io_mux_common.h"  // May need this
```

**Type errors**:
```c
.mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),  // Cast to i2s_mode_t
```

---

## Quick Blame List

If audio isn't working, check in order:

1. ✓ Hardware connections (use oscilloscope)
2. ✓ Register fixes applied (`REG_SET_BIT` calls)
3. ✓ `bits_per_sample` is 32-bit
4. ✓ `channel_format` matches SEL pin (try opposite if stuck)
5. ✓ Pin numbers correct
6. ✓ DC offset filter implemented
7. ✓ Bit shift amount (try `>> 8`, `>> 14`, `>> 16`)
8. → Consider switching to INMP441

---

## Resources

- Full Analysis: `docs/05-analysis/K1NAnalysis_ANALYSIS_SPH0645_I2S_CONFIGURATION_v1.0_20251108.md`
- GitHub: `github.com/atomic14/esp32_audio` (recommended)
- Issue: `github.com/espressif/esp-idf/issues/7192` (migration help)
- Datasheet: Adafruit CDN (search "SPH0645")

---

**Last Updated**: 2025-11-06

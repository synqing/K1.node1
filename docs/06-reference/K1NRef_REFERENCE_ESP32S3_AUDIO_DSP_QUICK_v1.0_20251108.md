# ESP32-S3 Audio DSP Quick Reference

**Date:** 2025-11-07
**Status:** `proposed`
**Scope:** Code snippets, API quick reference, common patterns
**Related:** [Audio Feature Analysis](../05-analysis/K1NAnalysis_ANALYSIS_AUDIO_FEATURE_EXTRACTION_ESP32S3_v1.0_20251108.md), [Validation Suite](../07-resources/K1NRes_GUIDE_AUDIO_VALIDATION_TEST_SUITE_v1.0_20251108.md)
**Tags:** `reference`, `code-snippets`, `esp32s3`, `audio-dsp`

---

## 1. Project Setup & Configuration

### 1.1 platformio.ini Configuration

```ini
[env:esp32s3-audio]
platform = espressif32@6.12.0          ; Pin platform version
board = esp32-s3-devkitc-1
framework = espidf@5.2.2               ; Pin IDF version
board_build.mcu = esp32s3
board_build.f_cpu = 240000000L         ; 240MHz
board_build.f_flash = 40000000L

build_flags =
    -O3                                ; Optimization level
    -fno-omit-frame-pointer            ; Allow debugging
    -DAUDIO_DSP_PROFILE                ; Build signature

lib_deps =
    espressif/esp-dsp@^1.2.0

monitor_speed = 115200
```

### 1.2 Component.cmake for Audio Module

```cmake
idf_component_register(
    SRC_DIRS "src"
    INCLUDE_DIRS "include"
    REQUIRES esp-dsp esp_timer
)

# Place FFT code in IRAM for speed
target_compile_options(${COMPONENT_LIB} PRIVATE
    -ffunction-sections
    -fdata-sections
)
```

---

## 2. I2S Audio Input (16kHz, 16-bit, Mono)

### 2.1 I2S Initialization

```cpp
#include "driver/i2s_std.h"
#include <atomic>

class AudioInput {
    i2s_chan_handle_t rx_handle = nullptr;
    static constexpr int SR = 16000;
    static constexpr int DMA_FRAME_LEN = 256;  // Samples per DMA interrupt
    static constexpr int DMA_BUF_COUNT = 2;    // Double buffer

public:
    bool init(int clk_pin, int ws_pin, int din_pin) {
        i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(
            I2S_NUM_0, I2S_ROLE_MASTER);
        chan_cfg.dma_desc_num = DMA_BUF_COUNT;
        chan_cfg.dma_frame_num = DMA_FRAME_LEN;

        if (i2s_new_channel(&chan_cfg, nullptr, &rx_handle) != ESP_OK) {
            return false;
        }

        i2s_std_config_t std_cfg = {
            .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(SR),
            .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(
                I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO),
            .gpio_cfg = {
                .mclk = I2S_GPIO_UNUSED,
                .bclk = (gpio_num_t)clk_pin,
                .ws = (gpio_num_t)ws_pin,
                .dout = I2S_GPIO_UNUSED,
                .din = (gpio_num_t)din_pin,
                .invert_flags = {0},
            },
        };

        if (i2s_channel_init_std_mode(rx_handle, &std_cfg) != ESP_OK) {
            return false;
        }

        if (i2s_channel_enable(rx_handle) != ESP_OK) {
            return false;
        }

        return true;
    }

    // Read one DMA frame (256 samples)
    int read_frame(int16_t *buffer, size_t len) {
        size_t bytes_read = 0;
        i2s_channel_read(rx_handle, buffer, len * sizeof(int16_t),
                        &bytes_read, pdMS_TO_TICKS(100));
        return bytes_read / sizeof(int16_t);
    }

    ~AudioInput() {
        if (rx_handle) {
            i2s_channel_disable(rx_handle);
            i2s_del_channel(rx_handle);
        }
    }
};
```

---

## 3. FFT + Windowing (ESP-DSP)

### 3.1 FFT Setup & Execution

```cpp
#include "esp_dsp.h"
#include <cmath>

class FFTProcessor {
    static constexpr int FFT_LEN = 512;
    static constexpr int REAL_FFT_LEN = FFT_LEN / 2 + 1;  // Real FFT output

    float *input;       // FFT input (windowed, float32)
    float *output;      // FFT output (complex, alternating real/imag)
    float window[FFT_LEN];
    esp_dsp_fft_init_fc32_t fft_state = {};

public:
    FFTProcessor() {
        input = (float *)heap_caps_malloc(FFT_LEN * sizeof(float), MALLOC_CAP_INTERNAL);
        output = (float *)heap_caps_malloc(REAL_FFT_LEN * 2 * sizeof(float), MALLOC_CAP_INTERNAL);

        // Pre-compute Hann window
        for (int i = 0; i < FFT_LEN; ++i) {
            window[i] = 0.5f * (1.0f - cosf(2.0f * M_PI * i / FFT_LEN));
        }

        // Initialize FFT
        dsps_fft_init_fc32(&fft_state, FFT_LEN);
    }

    void process_frame(const int16_t *audio_frame) {
        // 1. Convert int16 to float, apply window
        for (int i = 0; i < FFT_LEN; ++i) {
            input[i] = (audio_frame[i] / 32768.0f) * window[i];
        }

        // 2. Execute FFT (in-place, but uses separate output buffer)
        dsps_fft_fc32(input, output, &fft_state);

        // 3. Convert to magnitude spectrum
        float *mag = output;  // Reuse output buffer for magnitude
        for (int i = 0; i < REAL_FFT_LEN; ++i) {
            float re = output[2*i];
            float im = output[2*i + 1];
            mag[i] = sqrtf(re*re + im*im) / (FFT_LEN / 2);  // Normalize
        }
    }

    float *get_magnitude() { return output; }
    int get_num_bins() { return REAL_FFT_LEN; }

    ~FFTProcessor() {
        heap_caps_free(input);
        heap_caps_free(output);
        dsps_fft_free_fc32(&fft_state);
    }
};
```

**Key Notes:**
- `MALLOC_CAP_INTERNAL` allocates from fast DRAM (IRAM/DRAM0)
- FFT output is interleaved: `[re0, im0, re1, im1, ..., reN, 0]` (last imaginary is always 0)
- Normalize by `FFT_LEN / 2` to get correct magnitude
- Call `dsps_fft_init_fc32()` at boot, not per-frame

---

## 4. Spectral Features

### 4.1 Spectral Flux (Onset Detection)

```cpp
class OnsetDetector {
    static constexpr int FFT_BINS = 512 / 2 + 1;
    static constexpr int ODF_HISTORY = 256;

    float prev_mag[FFT_BINS] = {0};
    float odf_history[ODF_HISTORY];
    int odf_idx = 0;

    float threshold_mean = 0, threshold_std = 0;
    uint32_t last_peak_time_us = 0;
    static constexpr uint32_t REFRACTORY_US = 100000;  // 100ms min between beats

public:
    float compute_flux(const float *mag) {
        float flux = 0.0f;
        for (int i = 0; i < FFT_BINS; ++i) {
            float delta = mag[i] - prev_mag[i];
            flux += fmaxf(0.0f, delta);
            prev_mag[i] = mag[i];
        }
        return flux;
    }

    bool detect_onset(float flux, uint32_t now_us) {
        // Update history
        odf_history[odf_idx] = flux;
        odf_idx = (odf_idx + 1) % ODF_HISTORY;

        // Compute running mean/std
        float mean = 0, variance = 0;
        for (int i = 0; i < ODF_HISTORY; ++i) {
            mean += odf_history[i];
        }
        mean /= ODF_HISTORY;

        for (int i = 0; i < ODF_HISTORY; ++i) {
            float d = odf_history[i] - mean;
            variance += d * d;
        }
        variance /= ODF_HISTORY;
        float std = sqrtf(variance);

        // Adaptive threshold
        float threshold = mean + 0.75f * std;  // Tune: 0.5–1.5

        // Peak picking with refractory period
        if (flux > threshold && (now_us - last_peak_time_us) > REFRACTORY_US) {
            last_peak_time_us = now_us;
            return true;
        }
        return false;
    }
};
```

### 4.2 Spectral Centroid

```cpp
float compute_centroid(const float *mag, int num_bins, int sr, int fft_len) {
    // centroid = sum(f_i * mag_i) / sum(mag_i)
    float freq_per_bin = (float)sr / fft_len;
    float weighted_sum = 0, total_mag = 0;

    for (int i = 0; i < num_bins; ++i) {
        float freq = i * freq_per_bin;
        weighted_sum += freq * mag[i];
        total_mag += mag[i];
    }

    return (total_mag > 0) ? (weighted_sum / total_mag) : 0.0f;
}
```

### 4.3 Energy Per Band (Kick, Mid, High)

```cpp
struct FrequencyBands {
    struct Band {
        int start_bin, end_bin;
        float energy;
    } kick, mid, high;
};

void compute_band_energy(const float *mag, int num_bins, int sr, int fft_len,
                        FrequencyBands *out) {
    float freq_per_bin = (float)sr / fft_len;

    // Define bands: kick (60–150Hz), mid (300–2kHz), high (4–10kHz)
    auto get_bin = [&](float freq) { return (int)(freq / freq_per_bin); };

    out->kick = {get_bin(60), get_bin(150), 0};
    out->mid = {get_bin(300), get_bin(2000), 0};
    out->high = {get_bin(4000), get_bin(10000), 0};

    // Accumulate energy per band
    for (int i = out->kick.start_bin; i <= out->kick.end_bin; ++i)
        out->kick.energy += mag[i];
    for (int i = out->mid.start_bin; i <= out->mid.end_bin; ++i)
        out->mid.energy += mag[i];
    for (int i = out->high.start_bin; i <= out->high.end_bin; ++i)
        out->high.energy += mag[i];
}
```

---

## 5. Smoothing & Tempo Tracking

### 5.1 EMA (Exponential Moving Average)

```cpp
class EMAFilter {
    float alpha, one_minus_alpha;
    float value;

public:
    EMAFilter(float alpha_param = 0.1f) : alpha(alpha_param), value(0.0f) {
        one_minus_alpha = 1.0f - alpha;
    }

    void update(float raw) {
        value = alpha * raw + one_minus_alpha * value;
    }

    float get() const { return value; }

    void reset() { value = 0.0f; }
};

// Usage:
EMAFilter kick_fast(0.1f), kick_slow(0.02f);
// In loop:
kick_fast.update(raw_kick_energy);
kick_slow.update(raw_kick_energy);
float normalized_kick = kick_fast.get() / fmaxf(kick_slow.get(), 0.001f);
```

### 5.2 Beat Tempo Tracking (Simple Moving Average)

```cpp
class TempoTracker {
    static constexpr int BEAT_HISTORY = 32;
    uint32_t beat_times_us[BEAT_HISTORY] = {0};
    int beat_idx = 0;
    uint32_t last_beat_us = 0;

public:
    void record_beat(uint32_t now_us) {
        if (now_us - last_beat_us > 200000) {  // Minimum 200ms between beats
            beat_times_us[beat_idx] = now_us;
            beat_idx = (beat_idx + 1) % BEAT_HISTORY;
            last_beat_us = now_us;
        }
    }

    float get_tempo_bpm() {
        // Compute mean inter-beat interval
        uint32_t sum_ibi_us = 0;
        int count = 0;

        for (int i = 1; i < BEAT_HISTORY; ++i) {
            if (beat_times_us[i] > beat_times_us[i-1]) {
                sum_ibi_us += beat_times_us[i] - beat_times_us[i-1];
                count++;
            }
        }

        if (count == 0) return 0;

        float mean_ibi_ms = (sum_ibi_us / (float)count) / 1000.0f;
        return 60000.0f / mean_ibi_ms;  // BPM = 60 / IBI_seconds
    }
};
```

---

## 6. Real-Time Processing Loop (FreeRTOS)

### 6.1 Dual-Core Architecture

```cpp
// Core 0: Main app + I2S input
// Core 1: DSP (FFT + features)

void audio_input_task(void *arg) {
    AudioInput audio;
    audio.init(GPIO_I2S_CLK, GPIO_I2S_WS, GPIO_I2S_DIN);

    int16_t frame_buffer[256];
    while (true) {
        int samples_read = audio.read_frame(frame_buffer, 256);
        if (samples_read > 0) {
            // Queue frame to DSP task (lock-free ring buffer)
            if (!audio_queue.push(frame_buffer, samples_read)) {
                // Buffer overflow; skip frame silently
                stats.dropped_frames++;
            }
        }
    }
}

void dsp_task(void *arg) {
    FFTProcessor fft;
    OnsetDetector onset;
    TempoTracker tempo;
    FrequencyBands bands;

    int16_t fft_input[512];
    float mag[257];

    while (true) {
        // Wait for frame (with 50ms timeout to prevent stalling)
        if (audio_queue.pop(fft_input, 256, pdMS_TO_TICKS(50))) {
            uint32_t t0 = esp_timer_get_time();

            // Process: window + FFT
            fft.process_frame(fft_input);
            memcpy(mag, fft.get_magnitude(), 257 * sizeof(float));

            // Extract features
            float flux = onset.compute_flux(mag);
            float centroid = compute_centroid(mag, 257, 16000, 512);
            compute_band_energy(mag, 257, 16000, 512, &bands);

            // Detect beat
            uint32_t now_us = esp_timer_get_time();
            if (onset.detect_onset(flux, now_us)) {
                tempo.record_beat(now_us);
                led_queue.push_beat_event(now_us);
            }

            // Timing telemetry
            uint32_t elapsed_us = esp_timer_get_time() - t0;
            stats.last_dsp_us = elapsed_us;
            stats.total_dsp_us += elapsed_us;
            stats.frame_count++;
        }
    }
}

void setup_tasks() {
    // Create I2S task on Core 0
    xTaskCreatePinnedToCore(
        audio_input_task, "audio_input", 4096, nullptr, 5,
        nullptr, 0);

    // Create DSP task on Core 1
    xTaskCreatePinnedToCore(
        dsp_task, "dsp", 8192, nullptr, 5,
        nullptr, 1);
}
```

---

## 7. LED Output Integration

### 7.1 Feature → LED Color Mapping

```cpp
struct LEDColor {
    uint8_t r, g, b;
};

LEDColor map_features_to_color(const FrequencyBands &bands,
                               float centroid, float flux) {
    // Normalize band energies (0–255)
    uint8_t kick_intensity = (uint8_t)fminf(255, bands.kick.energy * 100);
    uint8_t mid_intensity = (uint8_t)fminf(255, bands.mid.energy * 100);
    uint8_t high_intensity = (uint8_t)fminf(255, bands.high.energy * 100);

    // Map to RGB
    LEDColor color;
    color.r = kick_intensity + mid_intensity / 2;           // Red: kick + some mid
    color.g = mid_intensity + (centroid > 2000 ? high_intensity/2 : 0);  // Green: mid
    color.b = high_intensity + (flux > 0.3 ? 100 : 0);      // Blue: highs + onsets

    return color;
}
```

### 7.2 RMT LED Output (WS2812B)

```cpp
#include "driver/rmt_tx.h"

class LEDStrip {
    rmt_channel_handle_t channel = nullptr;
    static constexpr int NUM_LEDS = 100;
    struct ws2812_led_t {
        uint8_t green, red, blue;  // GRB format
    } leds[NUM_LEDS];

public:
    bool init(int gpio_pin) {
        rmt_tx_channel_config_t tx_cfg = {
            .gpio_num = (gpio_num_t)gpio_pin,
            .clk_src = RMT_CLK_SRC_DEFAULT,
            .resolution_hz = 10000000,  // 10MHz resolution
            .mem_block_symbols = 64,
            .trans_queue_depth = 4,
        };

        if (rmt_new_tx_channel(&tx_cfg, &channel) != ESP_OK) {
            return false;
        }

        // Configure LED encoder
        rmt_encoder_handle_t encoder;
        rmt_led_strip_encoder_config_t encoder_cfg = {
            .resolution = 10000000,
        };

        if (rmt_new_led_strip_encoder(&encoder_cfg, &encoder) != ESP_OK) {
            return false;
        }

        if (rmt_transmit_config_t tx_config = {
            .loop_count = 0,
        }; rmt_transmitter_init(channel, encoder, &tx_config) != ESP_OK) {
            return false;
        }

        return true;
    }

    void set_led(int idx, uint8_t r, uint8_t g, uint8_t b) {
        if (idx < NUM_LEDS) {
            leds[idx].red = r;
            leds[idx].green = g;
            leds[idx].blue = b;
        }
    }

    void update() {
        rmt_transmit(channel, led_encoder, (const void *)leds,
                    sizeof(leds), nullptr);
    }
};
```

---

## 8. Telemetry & Diagnostics

### 8.1 Performance Monitoring

```cpp
struct TelemetryStats {
    uint32_t frame_count = 0;
    uint32_t last_dsp_us = 0;
    uint32_t total_dsp_us = 0;
    uint32_t dropped_frames = 0;
    uint32_t beats_detected = 0;
    float current_tempo_bpm = 0;
};

TelemetryStats stats;

// Expose via REST (using esp_http_server)
esp_err_t telemetry_handler(httpd_req_t *req) {
    char buffer[256];
    float avg_dsp_ms = (stats.frame_count > 0) ?
        (stats.total_dsp_us / (1000.0f * stats.frame_count)) : 0;

    snprintf(buffer, sizeof(buffer),
        "{"
        "\"frames\":%u,"
        "\"avg_dsp_ms\":%.2f,"
        "\"dropped\":%u,"
        "\"tempo_bpm\":%.1f"
        "}",
        stats.frame_count, avg_dsp_ms,
        stats.dropped_frames, stats.current_tempo_bpm);

    httpd_resp_sendstr(req, buffer);
    return ESP_OK;
}
```

### 8.2 Profiling Macros (DEBUG only)

```cpp
#ifdef CONFIG_DSP_DEBUG
#define PROFILE_START(name) uint32_t t0_##name = esp_timer_get_time()
#define PROFILE_END(name) \
    uint32_t elapsed_##name = esp_timer_get_time() - t0_##name; \
    ESP_LOGI("PROFILE", "%s: %u us", #name, elapsed_##name)
#else
#define PROFILE_START(name)
#define PROFILE_END(name)
#endif

// Usage:
PROFILE_START(fft);
fft.process_frame(input);
PROFILE_END(fft);
```

---

## 9. Memory Optimization Checklist

- [ ] FFT workspace allocated with `MALLOC_CAP_INTERNAL` (fast DRAM)
- [ ] Window function stored in Flash (read-only, `PROGMEM`)
- [ ] Feature buffers sized to power-of-two (for bitwise modulo)
- [ ] Circular buffers use pre-allocated static arrays (no malloc per-frame)
- [ ] No dynamic allocations in ISR or fast path
- [ ] Stack size set conservatively (4KB for audio task, 8KB for DSP)

---

## 10. Compilation & Build

### 10.1 Build with Optimizations

```bash
# Build for ESP32-S3, 240MHz, optimization level 3
idf.py -DCMAKE_BUILD_TYPE=Release build

# Or via platformio
platformio run -e esp32s3-audio --verbose
```

### 10.2 Flash & Monitor

```bash
# Flash and open serial monitor
idf.py -p /dev/ttyUSB0 flash monitor

# Or
platformio run -e esp32s3-audio -t upload --monitor
```

### 10.3 Build Signature at Boot

```cpp
void print_build_info() {
    ESP_LOGI("BOOT", "=== K1 Audio DSP Build Info ===");
    ESP_LOGI("BOOT", "IDF Version: %s", esp_get_idf_version());
    ESP_LOGI("BOOT", "Build Date: %s %s", __DATE__, __TIME__);
    ESP_LOGI("BOOT", "CPU Freq: %u MHz", esp_clk_cpu_freq() / 1000000);
    ESP_LOGI("BOOT", "IRAM: %u bytes free", heap_caps_get_free_size(MALLOC_CAP_IRAM));
    ESP_LOGI("BOOT", "DRAM: %u bytes free", heap_caps_get_free_size(MALLOC_CAP_INTERNAL));
    ESP_LOGI("BOOT", "ESP-DSP version: %s", DSPS_VERSION);
}
```

---

## 11. Common Pitfalls & Solutions

| Problem | Cause | Solution |
|---------|-------|----------|
| **FFT produces garbage** | Input not windowed | Apply Hann window before FFT |
| **Onset peaks too frequent** | Threshold too low | Increase threshold multiplier (0.75 → 1.0) |
| **No beats detected** | Threshold too high | Decrease multiplier or increase refractory period check |
| **I2S underruns** | CPU overload | Reduce FFT size or stagger processing on Core 1 |
| **LED lag behind music** | DSP latency | Reduce buffer size; use lookahead beat prediction |
| **Crashes on startup** | Stack overflow | Increase task stack size (4KB → 8KB) |
| **NaN in features** | Zero spectrum case | Add check: `if (sum > 0) else return default` |

---

## 12. Useful Links

- **ESP-DSP:** https://github.com/espressif/esp-dsp
- **ESP-IDF I2S:** https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/peripherals/i2s.html
- **RMT LED Driver:** https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/peripherals/rmt.html
- **FreeRTOS on ESP32:** https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/system/freertos.html

---

**Version:** 1.0 (Phase 0 reference)
**Last Updated:** 2025-11-07

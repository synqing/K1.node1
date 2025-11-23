// /firmware/src/led_driver.cpp
// LED Driver Implementation - Replaced with standard FastLED
// K1.reinvented Phase 2 Refactoring

#include "led_driver.h"
#include "logging/logger.h"
#include "logging/log_config.h"
#include "led_tx_events.h"
#include "audio/goertzel.h" // for audio_level
#include "profiler.h"       // for ACCUM_QUANTIZE_US, ACCUM_RMT_TRANSMIT_US
#include "parameters.h"     // for get_params(), PatternParameters

// Global buffers
CRGBF leds[NUM_LEDS];
CRGB fastled_leds[NUM_LEDS];
float global_brightness = 0.3f;

// Diagnostics
std::atomic<uint32_t> g_last_led_tx_us{0};
std::atomic<uint32_t> g_led_rmt_wait_timeouts{0};

// Dither error accumulator
CRGBF dither_error[NUM_LEDS];

void init_rmt_driver() {
    LOG_INFO(TAG_LED, "Initializing FastLED (WS2812B via RMT)...");
    
    // Initialize FastLED with parallel output where supported
    // For ESP32-S3, FastLED 3.9+ supports parallel RMT automatically if pins are added
    FastLED.addLeds<WS2812B, LED_DATA_PIN, GRB>(fastled_leds, NUM_LEDS);
    FastLED.addLeds<WS2812B, LED_DATA_PIN_2, GRB>(fastled_leds, NUM_LEDS);
    
    // We handle brightness scaling manually in the float->byte conversion
    // So we set FastLED brightness to max to avoid double scaling
    FastLED.setBrightness(255);
    // Disable FastLED's default warm color correction and dithering to match legacy RMT output
    FastLED.setCorrection(UncorrectedColor);
    FastLED.setDither(false);
    
    // Clear buffers
    memset(leds, 0, sizeof(leds));
    memset(fastled_leds, 0, sizeof(fastled_leds));
    memset(dither_error, 0, sizeof(dither_error));
}

// Local helper to map indices if needed (circular buffer logic)
static inline uint16_t remap_led_index(uint16_t logical_index, int16_t offset_px) {
    int32_t idx = static_cast<int32_t>(logical_index) + static_cast<int32_t>(offset_px);
    // Optimized modulo for power-of-2 or simple bounds check
    // But here we do safe robust modulo for arbitrary offsets
    idx %= NUM_LEDS;
    if (idx < 0) idx += NUM_LEDS;
    return static_cast<uint16_t>(idx);
}

void transmit_leds() {
    // 1. Check quiet skip (EMI reduction)
    #ifndef QUIET_SKIP_FRAMES
    #define QUIET_SKIP_FRAMES 10
    #endif
    #ifndef QUIET_VU_THRESH
    #define QUIET_VU_THRESH 0.01f
    #endif
    static uint8_t s_quiet_frames = 0;
    if (audio_level < QUIET_VU_THRESH) {
        if (s_quiet_frames < 0xFF) s_quiet_frames++;
    } else {
        s_quiet_frames = 0;
    }
    if (s_quiet_frames >= QUIET_SKIP_FRAMES) {
        // Yield to allow other tasks to run if we are skipping
        vTaskDelay(pdMS_TO_TICKS(1));
        return;
    }

    // 2. Quantize and Dither (Float CRGBF -> Byte CRGB)
    // Also applies global brightness and led_offset remapping
    const PatternParameters& params = get_params();
    bool temporal_dithering = (params.dithering >= 0.5f);
    const float brightness_scale = constrain(global_brightness, 0.0f, 1.0f) * 255.0f;
    int16_t offset_px = static_cast<int16_t>(lroundf(params.led_offset));

    uint32_t t_quant_start = micros();

    if (temporal_dithering) {
        const float thresh = 0.055f;
        for (uint16_t i = 0; i < NUM_LEDS; i++) {
            // Determine source index (applying offset)
            uint16_t src_idx = remap_led_index(i, offset_px);
            
            // RED
            const float dec_r = leds[src_idx].r * brightness_scale;
            uint8_t out_r = (uint8_t)dec_r;
            float new_err_r = dec_r - (float)out_r;
            if (new_err_r >= thresh) dither_error[i].r += new_err_r;
            if (dither_error[i].r >= 1.0f) { out_r += 1; dither_error[i].r -= 1.0f; }
            
            // GREEN
            const float dec_g = leds[src_idx].g * brightness_scale;
            uint8_t out_g = (uint8_t)dec_g;
            float new_err_g = dec_g - (float)out_g;
            if (new_err_g >= thresh) dither_error[i].g += new_err_g;
            if (dither_error[i].g >= 1.0f) { out_g += 1; dither_error[i].g -= 1.0f; }
            
            // BLUE
            const float dec_b = leds[src_idx].b * brightness_scale;
            uint8_t out_b = (uint8_t)dec_b;
            float new_err_b = dec_b - (float)out_b;
            if (new_err_b >= thresh) dither_error[i].b += new_err_b;
            if (dither_error[i].b >= 1.0f) { out_b += 1; dither_error[i].b -= 1.0f; }

            fastled_leds[i] = CRGB(out_r, out_g, out_b);
        }
    } else {
        // Fast path: No dithering
        for (uint16_t i = 0; i < NUM_LEDS; i++) {
            uint16_t src_idx = remap_led_index(i, offset_px);
            fastled_leds[i].r = (uint8_t)(leds[src_idx].r * brightness_scale);
            fastled_leds[i].g = (uint8_t)(leds[src_idx].g * brightness_scale);
            fastled_leds[i].b = (uint8_t)(leds[src_idx].b * brightness_scale);
        }
    }
    
    // Record quantization time
    uint32_t t_tx_start = micros();
    {
        uint32_t delta = t_tx_start - t_quant_start;
        uint32_t tmp = ACCUM_QUANTIZE_US; // Relaxed load
        ACCUM_QUANTIZE_US = tmp + delta; // Relaxed store
    }

    // 3. Transmit
    g_last_led_tx_us = t_tx_start;
    led_tx_events_push(t_tx_start);
    
    FastLED.show();
    
    // Record transmit time
    uint32_t t_end = micros();
    {
        uint32_t delta = t_end - t_tx_start;
        uint32_t tmp = ACCUM_RMT_TRANSMIT_US;
        ACCUM_RMT_TRANSMIT_US = tmp + delta;
    }

    // 4. Frame Pacing
    // Target minimum frame period to cap FPS
    uint32_t min_period_us = (uint32_t)(get_params().frame_min_period_ms * 1000.0f);
    static uint32_t s_last_frame_start_us = 0;
    uint32_t now_us = micros();
    if (s_last_frame_start_us == 0) s_last_frame_start_us = now_us;
    uint32_t elapsed_us = now_us - s_last_frame_start_us;
    
    if (elapsed_us < min_period_us) {
        uint32_t remain_us = min_period_us - elapsed_us;
        uint32_t remain_ms = (remain_us + 999) / 1000;
        if (remain_ms > 0) vTaskDelay(pdMS_TO_TICKS(remain_ms));
    }
    s_last_frame_start_us = micros();
}

#pragma once

// Phase 0 scaffolding for dual-channel architecture (no behavior change)
// All contents are compiled only when DYNAMIC_LED_CHANNELS is defined.

#ifdef DYNAMIC_LED_CHANNELS

#include <atomic>
#include "types.h"          // CRGBF
#include "led_driver.h"     // NUM_LEDS, rmt_* forward types (header provides stubs if editor only)

struct RenderChannel {
    // High-precision render buffer (pattern writes floats here)
    CRGBF frame[NUM_LEDS];
    // Quantized 8-bit packed buffer for RMT transmission
    uint8_t packed[NUM_LEDS * 3];

    // Hardware interface (independent per channel)
    rmt_channel_handle_t tx_handle { nullptr };
    rmt_encoder_handle_t encoder   { nullptr };

    // Control plane overlays
    std::atomic<bool> enabled { true };
    std::atomic<uint8_t> brightness { 255 }; // 0-255 scaler applied prior to quantize

    // Per-channel dithering step (prevent synchronized flicker)
    uint8_t dither_step { 0 };

    // Telemetry (last frame timings in microseconds)
    std::atomic<uint32_t> last_render_us { 0 };
    std::atomic<uint32_t> last_quantize_us { 0 };
    std::atomic<uint32_t> last_tx_us { 0 };
};

#endif // DYNAMIC_LED_CHANNELS


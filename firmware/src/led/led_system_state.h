#pragma once

#include <atomic>
#include <FastLED.h>
#include "../types.h"
#include "../led_driver.h"

/**
 * @brief Unified LED subsystem state
 *
 * Consolidates all LED driver, RMT hardware, and diagnostics state
 * from led_driver.cpp and diagnostics/rmt_probe.cpp.
 *
 * Thread safety:
 * - Color buffers: single-writer (Core 1 render), single-reader (Core 0 TX)
 * - RMT hardware state: atomics for Core 0/1 coordination
 * - Probe diagnostics: atomic counters (relaxed ordering acceptable)
 */
struct LEDSystemState {
    // ============ Color Buffers ============
    CRGBF leds[NUM_LEDS] = {};                  // Float working color space
    CRGB fastled_leds[NUM_LEDS] = {};           // 8-bit FastLED output buffer
    CRGBF dither_error[NUM_LEDS] = {};          // Error accumulation for dithering

    // ============ Global LED Controls ============
    float global_brightness = 1.0f;             // Master brightness (0.0-1.0)
    uint8_t pattern_channel_index = 0;          // Active channel (0=left, 1=center, 2=right)
    uint8_t current_pattern_index = 0;          // Currently executing pattern

    // ============ RMT Hardware State ============
    std::atomic<uint32_t> last_led_tx_us{0};    // Timestamp of last LED TX start
    std::atomic<uint32_t> led_rmt_wait_timeouts{0}; // RMT timeout counter

    // ============ RMT Probe Diagnostics ============
    struct RMTProbe {
        std::atomic<uint32_t> mem_empty_count{0};   // Count of memory-empty callbacks
        std::atomic<uint32_t> tx_done_count{0};     // Count of TX-done callbacks
        std::atomic<uint32_t> max_gap_us{0};        // Max gap between callbacks (µs)
        uint64_t last_empty_us = 0;                 // Last callback timestamp
    };

    RMTProbe rmt_probe_ch1;                     // Channel 1 probe
    RMTProbe rmt_probe_ch2;                     // Channel 2 probe

    // ============ Initialization State ============
    bool initialized = false;

    // ============ Lifecycle ============
    LEDSystemState() {
        reset();
    }

    void reset() {
        global_brightness = 1.0f;
        pattern_channel_index = 0;
        current_pattern_index = 0;
        last_led_tx_us.store(0, std::memory_order_release);
        led_rmt_wait_timeouts.store(0, std::memory_order_release);
        rmt_probe_ch1.mem_empty_count.store(0, std::memory_order_release);
        rmt_probe_ch1.tx_done_count.store(0, std::memory_order_release);
        rmt_probe_ch1.max_gap_us.store(0, std::memory_order_release);
        rmt_probe_ch2.mem_empty_count.store(0, std::memory_order_release);
        rmt_probe_ch2.tx_done_count.store(0, std::memory_order_release);
        rmt_probe_ch2.max_gap_us.store(0, std::memory_order_release);
    }
};

extern LEDSystemState g_leds;

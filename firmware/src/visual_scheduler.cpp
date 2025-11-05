// Phase 0 scaffolding for dual-channel VisualScheduler
// Compiles only when DYNAMIC_LED_CHANNELS is defined.

#ifdef DYNAMIC_LED_CHANNELS

#include <Arduino.h>
#include "render_channel.h"
#include "pattern_registry.h"
#include "parameters.h"
#include "led_driver.h"
#include "audio/goertzel.h"  // get_audio_snapshot
#include "logging/logger.h"
#include "pattern_channel.h"
#include "profiler.h"

static const char TAG_SCHED = 'V';  // Visual scheduler tag

// Forward decls for local helpers
static inline void quantize_frame(RenderChannel& ch, const PatternParameters& params) {
    // Local quantize replica using channel-local dither step
    const bool temporal_dithering = (params.dithering >= 0.5f);
    const float brightness_scale = (params.brightness) * 255.0f;
    if (temporal_dithering) {
        const float dither_table[4] = {0.25f, 0.50f, 0.75f, 1.00f};
        ch.dither_step++;
        const float thr = dither_table[ch.dither_step & 3];
        const float bs = params.brightness * 254.0f;
        for (uint16_t i = 0; i < NUM_LEDS; ++i) {
            const uint16_t base = i * 3;
            const float dr = ch.frame[i].r * bs;
            const float dg = ch.frame[i].g * bs;
            const float db = ch.frame[i].b * bs;
            const uint8_t wr = (uint8_t)dr;
            const uint8_t wg = (uint8_t)dg;
            const uint8_t wb = (uint8_t)db;
            ch.packed[base + 1] = wr + ((dr - wr) >= thr); // R
            ch.packed[base + 0] = wg + ((dg - wg) >= thr); // G
            ch.packed[base + 2] = wb + ((db - wb) >= thr); // B
        }
    } else {
        for (uint16_t i = 0; i < NUM_LEDS; ++i) {
            const uint16_t base = i * 3;
            ch.packed[base + 1] = (uint8_t)(ch.frame[i].r * brightness_scale);
            ch.packed[base + 0] = (uint8_t)(ch.frame[i].g * brightness_scale);
            ch.packed[base + 2] = (uint8_t)(ch.frame[i].b * brightness_scale);
        }
    }
}

// Not used in Phase 0 (scaffolding only). When enabled, this replaces loop_gpu.
extern "C" void visual_scheduler(void* param) {
    RenderChannel** channels = reinterpret_cast<RenderChannel**>(param);
    LOG_INFO(TAG_SCHED, "VisualScheduler (Phase 0 scaffold) starting");

    for (;;) {
        // Acquire audio snapshot once per frame
        AudioDataSnapshot audio;
        (void)get_audio_snapshot(&audio);

        // Render and transmit for each available channel (A/B)
        for (uint8_t ci = 0; ci < 2; ++ci) {
            RenderChannel* ch = channels[ci];
            if (ch == nullptr || !ch->enabled.load()) {
                continue;
            }

            const PatternParameters& params = get_params();
            // Ensure patterns use proper per-channel statics
            g_pattern_channel_index = ci;

            // Draw current pattern into global float frame
            uint32_t t0 = micros();
            draw_current_pattern((millis() / 1000.0f), params);
            ch->last_render_us.store(micros() - t0);

            // Copy global frame into channel-local frame for quantization
            for (uint16_t i = 0; i < NUM_LEDS; ++i) {
                ch->frame[i] = leds[i];
            }

            // Quantize to channel-local packed buffer with per-channel dithering
            uint32_t tq0 = micros();
            quantize_frame(*ch, params);
            ch->last_quantize_us.store(micros() - tq0);

            // Queue DMA TX (non-blocking). Use per-channel handle if provided.
            // Mirror legacy telemetry: record TX timestamp and push into rolling buffer
            uint32_t tx0 = micros();
            g_last_led_tx_us = tx0;
            led_tx_events_push(tx0);
            rmt_channel_handle_t h = ch->tx_handle ? ch->tx_handle : tx_chan;
            rmt_encoder_handle_t e = ch->encoder   ? ch->encoder   : led_encoder;
            esp_err_t tx_ret = rmt_transmit(h, e, ch->packed, NUM_LEDS * 3, &tx_config);
            if (tx_ret != ESP_OK) {
                LOG_WARN(TAG_SCHED, "rmt_transmit error(ci=%u): %d", (unsigned)ci, (int)tx_ret);
            }
            ch->last_tx_us.store(micros() - tx0);

            // Wait for completion similar to transmit_leds pacing
            (void)rmt_tx_wait_all_done(h, pdMS_TO_TICKS(8));
        }

        // Match legacy diagnostics (loop_gpu): update FPS counters and print periodically
        watch_cpu_fps();
        print_fps();
    }
}

#endif // DYNAMIC_LED_CHANNELS

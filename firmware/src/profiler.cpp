#include "profiler.h"
#include "system_state.h"  // For USE_UNIFIED_STATE and g_profiler
#include "logging/logger.h"
#include <atomic>

// Optional diagnostics integration (runtime-configurable intervals)
#if __has_include("diagnostics.h")
#  include "diagnostics.h"
#  define DIAG_AVAILABLE 1
#else
#  define DIAG_AVAILABLE 0
#endif

// Legacy global definitions (only when USE_UNIFIED_STATE=0)
#if !USE_UNIFIED_STATE
float FPS_CPU = 0;
float FPS_CPU_SAMPLES[16] = {0};

std::atomic<uint64_t> ACCUM_RENDER_US{0};
std::atomic<uint64_t> ACCUM_QUANTIZE_US{0};
std::atomic<uint64_t> ACCUM_RMT_WAIT_US{0};
std::atomic<uint64_t> ACCUM_RMT_TRANSMIT_US{0};
std::atomic<uint32_t> FRAMES_COUNTED{0};
#endif

void watch_cpu_fps() {
    uint32_t us_now = micros();
    static uint32_t last_call = 0;
    static uint8_t average_index = 0;

    if (last_call > 0) {
        uint32_t elapsed_us = us_now - last_call;

#if USE_UNIFIED_STATE
        // Unified state path: write to g_profiler
        g_profiler.fps_cpu_samples[average_index % 16] = 1000000.0 / float(elapsed_us);
        average_index++;
        g_profiler.frames_counted.fetch_add(1, std::memory_order_relaxed);

        // Calculate rolling average
        float sum = 0;
        for (int i = 0; i < 16; i++) {
            sum += g_profiler.fps_cpu_samples[i];
        }
        g_profiler.fps_cpu = sum / 16.0;
#else
        // Legacy path: write to scattered globals
        FPS_CPU_SAMPLES[average_index % 16] = 1000000.0 / float(elapsed_us);
        average_index++;
        FRAMES_COUNTED.fetch_add(1, std::memory_order_relaxed);

        // Calculate rolling average
        float sum = 0;
        for (int i = 0; i < 16; i++) {
            sum += FPS_CPU_SAMPLES[i];
        }
        FPS_CPU = sum / 16.0;
#endif
    }

    last_call = us_now;
}

void print_fps() {
    static uint32_t last_print = 0;
    uint32_t now = millis();
    // Default interval 15000ms (detailed metrics available via REST API)
    uint32_t interval_ms = 15000;
#if DIAG_AVAILABLE
    if (diag_is_enabled()) {
        uint32_t diag_interval = diag_get_interval_ms();
        interval_ms = diag_interval ? diag_interval : 15000;  // safety fallback
    }
#endif

    if (now - last_print > interval_ms) {  // Rate-limit profiler prints
        // Calculate per-frame averages
        // Use relaxed loads for statistics that don't require synchronization

#if USE_UNIFIED_STATE
        // Unified state path
        uint32_t frames = g_profiler.frames_counted.load(std::memory_order_relaxed);
        frames = frames > 0 ? frames : 1;
        float avg_render_ms = (float)g_profiler.accum_render_us.load(std::memory_order_relaxed) / frames / 1000.0f;
        float avg_quantize_ms = (float)g_profiler.accum_quantize_us.load(std::memory_order_relaxed) / frames / 1000.0f;
        float avg_rmt_wait_ms = (float)g_profiler.accum_rmt_wait_us.load(std::memory_order_relaxed) / frames / 1000.0f;
        float avg_rmt_tx_ms = (float)g_profiler.accum_rmt_transmit_us.load(std::memory_order_relaxed) / frames / 1000.0f;

        LOG_INFO(TAG_PROFILE, "FPS: %.1f", g_profiler.fps_cpu);
        LOG_INFO(TAG_PROFILE, "avg_ms render/quantize/wait/tx: %.2f / %.2f / %.2f / %.2f", avg_render_ms, avg_quantize_ms, avg_rmt_wait_ms, avg_rmt_tx_ms);

        // Reset accumulators with relaxed stores
        g_profiler.accum_render_us.store(0, std::memory_order_relaxed);
        g_profiler.accum_quantize_us.store(0, std::memory_order_relaxed);
        g_profiler.accum_rmt_wait_us.store(0, std::memory_order_relaxed);
        g_profiler.accum_rmt_transmit_us.store(0, std::memory_order_relaxed);
        g_profiler.frames_counted.store(0, std::memory_order_relaxed);
#else
        // Legacy path
        uint32_t frames = FRAMES_COUNTED.load(std::memory_order_relaxed);
        frames = frames > 0 ? frames : 1;
        float avg_render_ms = (float)ACCUM_RENDER_US.load(std::memory_order_relaxed) / frames / 1000.0f;
        float avg_quantize_ms = (float)ACCUM_QUANTIZE_US.load(std::memory_order_relaxed) / frames / 1000.0f;
        float avg_rmt_wait_ms = (float)ACCUM_RMT_WAIT_US.load(std::memory_order_relaxed) / frames / 1000.0f;
        float avg_rmt_tx_ms = (float)ACCUM_RMT_TRANSMIT_US.load(std::memory_order_relaxed) / frames / 1000.0f;

        LOG_INFO(TAG_PROFILE, "FPS: %.1f", FPS_CPU);
        LOG_INFO(TAG_PROFILE, "avg_ms render/quantize/wait/tx: %.2f / %.2f / %.2f / %.2f", avg_render_ms, avg_quantize_ms, avg_rmt_wait_ms, avg_rmt_tx_ms);

        // Reset accumulators with relaxed stores
        ACCUM_RENDER_US.store(0, std::memory_order_relaxed);
        ACCUM_QUANTIZE_US.store(0, std::memory_order_relaxed);
        ACCUM_RMT_WAIT_US.store(0, std::memory_order_relaxed);
        ACCUM_RMT_TRANSMIT_US.store(0, std::memory_order_relaxed);
        FRAMES_COUNTED.store(0, std::memory_order_relaxed);
#endif

        last_print = now;
    }
}

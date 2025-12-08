#pragma once

#include <atomic>
#include <cstring>

/**
 * @brief Unified profiler metrics state
 *
 * Consolidates all performance measurement state from profiler.cpp:
 * - Frame-level timing accumulators
 * - FPS tracking
 * - Computed statistics
 *
 * Thread safety:
 * - Accumulator atomics use relaxed ordering (write from Core 1, read from Core 0)
 * - Statistics computed periodically from accumulated values
 * - No locks needed; atomics sufficient for timing probes
 */
struct ProfileMetrics {
    // ============ Frame-Level Accumulators (µs) ============
    std::atomic<uint64_t> accum_render_us{0};       // Total render phase time
    std::atomic<uint64_t> accum_quantize_us{0};     // Total quantize phase time
    std::atomic<uint64_t> accum_rmt_wait_us{0};     // Total RMT wait time
    std::atomic<uint64_t> accum_rmt_transmit_us{0}; // Total RMT transmit time

    // ============ FPS Tracking ============
    float fps_cpu = 0.0f;                           // Rolling FPS average
    float fps_cpu_samples[16] = {};                 // Per-frame FPS sample ring

    // ============ Frame Counters ============
    std::atomic<uint32_t> frames_counted{0};        // Total frames measured

    // ============ Computed Statistics ============
    struct PerFrameStats {
        float avg_render_us = 0.0f;
        float avg_quantize_us = 0.0f;
        float avg_rmt_wait_us = 0.0f;
        float avg_rmt_transmit_us = 0.0f;
    } current_stats;

    // ============ Initialization State ============
    bool initialized = false;

    // ============ Lifecycle ============
    ProfileMetrics() {
        reset();
    }

    void reset() {
        accum_render_us.store(0, std::memory_order_relaxed);
        accum_quantize_us.store(0, std::memory_order_relaxed);
        accum_rmt_wait_us.store(0, std::memory_order_relaxed);
        accum_rmt_transmit_us.store(0, std::memory_order_relaxed);
        frames_counted.store(0, std::memory_order_relaxed);
        fps_cpu = 0.0f;
        std::memset(fps_cpu_samples, 0, sizeof(fps_cpu_samples));
        std::memset(&current_stats, 0, sizeof(current_stats));
    }

    /**
     * @brief Update computed statistics from accumulators
     *
     * Call periodically (e.g., every 60 frames) to compute per-frame averages
     * from the accumulated totals.
     *
     * @param frame_count Number of frames since last reset
     */
    void update_stats(uint32_t frame_count) {
        if (frame_count == 0) return;

        float count_f = static_cast<float>(frame_count);
        current_stats.avg_render_us = accum_render_us.load(std::memory_order_relaxed) / count_f;
        current_stats.avg_quantize_us = accum_quantize_us.load(std::memory_order_relaxed) / count_f;
        current_stats.avg_rmt_wait_us = accum_rmt_wait_us.load(std::memory_order_relaxed) / count_f;
        current_stats.avg_rmt_transmit_us = accum_rmt_transmit_us.load(std::memory_order_relaxed) / count_f;
    }
};

extern ProfileMetrics g_profiler;

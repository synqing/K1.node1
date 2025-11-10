// Frame-level profiling metrics for graph performance analysis
// Lock-free ring buffer: 64 frame snapshots with render, quantize, wait, transmit timings
// Zero-cost when disabled via compile-time flag

#pragma once

#include <stdint.h>
#include <atomic>

// ============================================================================
// COMPILE-TIME CONFIGURATION
// ============================================================================

// Enable frame metrics collection (disabled by default for zero overhead)
#ifndef FRAME_METRICS_ENABLED
#define FRAME_METRICS_ENABLED 0
#endif

// Ring buffer size: 64 frames (256 bytes overhead)
#define FRAME_METRICS_BUFFER_SIZE 64

// ============================================================================
// FRAME METRICS STRUCTURE
// ============================================================================

struct FrameMetric {
    uint32_t render_us;      // Render time (microseconds)
    uint32_t quantize_us;    // Quantize time (microseconds)
    uint32_t rmt_wait_us;    // RMT wait time (microseconds)
    uint32_t rmt_tx_us;      // RMT transmit time (microseconds)
    uint32_t total_us;       // Total frame time
    uint32_t heap_free;      // Free heap (bytes) at frame end
    uint16_t fps_snapshot;   // FPS (as uint16, divide by 100 for decimal)
};

// ============================================================================
// FRAME METRICS RING BUFFER (ZERO-COST WHEN DISABLED)
// ============================================================================

#if FRAME_METRICS_ENABLED

class FrameMetricsBuffer {
public:
    static FrameMetricsBuffer& instance() {
        static FrameMetricsBuffer buf;
        return buf;
    }

    // Record one frame's metrics (call at end of render loop)
    void record_frame(uint32_t render_us, uint32_t quantize_us,
                      uint32_t rmt_wait_us, uint32_t rmt_tx_us,
                      uint16_t fps_snapshot);

    // Get frame at index (0 = oldest, size-1 = newest)
    FrameMetric get_frame(uint32_t index) const;

    // Get frame count (0..FRAME_METRICS_BUFFER_SIZE)
    uint32_t count() const;

    // Reset buffer (useful for benchmark runs)
    void reset();

    // Copy all frames to output array (caller allocates array[FRAME_METRICS_BUFFER_SIZE])
    uint32_t copy_all_frames(FrameMetric* out) const;

private:
    FrameMetricsBuffer() = default;

    FrameMetric buffer_[FRAME_METRICS_BUFFER_SIZE];
    std::atomic<uint32_t> write_index_{0};  // Next write position
    std::atomic<uint32_t> frame_count_{0};  // Total frames recorded
};

#else

// Null implementation (zero cost when disabled)
class FrameMetricsBuffer {
public:
    static FrameMetricsBuffer& instance() {
        static FrameMetricsBuffer buf;
        return buf;
    }

    inline void record_frame(uint32_t, uint32_t, uint32_t, uint32_t, uint16_t) {}
    inline FrameMetric get_frame(uint32_t) const { return FrameMetric{}; }
    inline uint32_t count() const { return 0; }
    inline void reset() {}
    inline uint32_t copy_all_frames(FrameMetric*) const { return 0; }
};

#endif

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

// Get average metrics from last N frames
struct AverageMetrics {
    float avg_render_us;
    float avg_quantize_us;
    float avg_rmt_wait_us;
    float avg_rmt_tx_us;
    float avg_total_us;
    uint32_t frame_count;
};

#if FRAME_METRICS_ENABLED

inline AverageMetrics frame_metrics_average(uint32_t last_n_frames) {
    auto& buf = FrameMetricsBuffer::instance();
    uint32_t count = buf.count();
    if (count == 0) return AverageMetrics{};

    uint32_t take = (last_n_frames > 0 && last_n_frames < count) ? last_n_frames : count;
    uint32_t start_idx = (count > take) ? (count - take) : 0;

    uint64_t sum_render = 0, sum_quantize = 0, sum_wait = 0, sum_tx = 0, sum_total = 0;

    for (uint32_t i = start_idx; i < count; ++i) {
        FrameMetric fm = buf.get_frame(i);
        sum_render += fm.render_us;
        sum_quantize += fm.quantize_us;
        sum_wait += fm.rmt_wait_us;
        sum_tx += fm.rmt_tx_us;
        sum_total += fm.total_us;
    }

    uint32_t n = count - start_idx;
    return AverageMetrics{
        .avg_render_us = (float)sum_render / n,
        .avg_quantize_us = (float)sum_quantize / n,
        .avg_rmt_wait_us = (float)sum_wait / n,
        .avg_rmt_tx_us = (float)sum_tx / n,
        .avg_total_us = (float)sum_total / n,
        .frame_count = n
    };
}

#else

inline AverageMetrics frame_metrics_average(uint32_t) {
    return AverageMetrics{};
}

#endif // FRAME_METRICS_ENABLED


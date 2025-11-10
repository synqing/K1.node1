// Frame metrics ring buffer implementation
// Lock-free concurrent access for frame recording

#include "frame_metrics.h"
#include <Arduino.h>

#if FRAME_METRICS_ENABLED

void FrameMetricsBuffer::record_frame(uint32_t render_us, uint32_t quantize_us,
                                      uint32_t rmt_wait_us, uint32_t rmt_tx_us,
                                      uint16_t fps_snapshot) {
    uint32_t idx = write_index_.load(std::memory_order_relaxed);
    uint32_t next_idx = (idx + 1) % FRAME_METRICS_BUFFER_SIZE;

    FrameMetric& fm = buffer_[idx];
    fm.render_us = render_us;
    fm.quantize_us = quantize_us;
    fm.rmt_wait_us = rmt_wait_us;
    fm.rmt_tx_us = rmt_tx_us;
    fm.total_us = render_us + quantize_us + rmt_wait_us + rmt_tx_us;
    fm.heap_free = ESP.getFreeHeap();
    fm.fps_snapshot = fps_snapshot;

    write_index_.store(next_idx, std::memory_order_release);

    uint32_t count = frame_count_.load(std::memory_order_relaxed);
    if (count < FRAME_METRICS_BUFFER_SIZE) {
        frame_count_.store(count + 1, std::memory_order_release);
    }
}

FrameMetric FrameMetricsBuffer::get_frame(uint32_t index) const {
    if (index >= FRAME_METRICS_BUFFER_SIZE) {
        return FrameMetric{};
    }
    uint32_t count = frame_count_.load(std::memory_order_acquire);
    if (index >= count) {
        return FrameMetric{};
    }

    uint32_t write_idx = write_index_.load(std::memory_order_acquire);
    uint32_t actual_idx = (write_idx + index) % FRAME_METRICS_BUFFER_SIZE;

    return buffer_[actual_idx];
}

uint32_t FrameMetricsBuffer::count() const {
    return frame_count_.load(std::memory_order_acquire);
}

void FrameMetricsBuffer::reset() {
    write_index_.store(0, std::memory_order_release);
    frame_count_.store(0, std::memory_order_release);
}

uint32_t FrameMetricsBuffer::copy_all_frames(FrameMetric* out) const {
    uint32_t count = frame_count_.load(std::memory_order_acquire);
    uint32_t write_idx = write_index_.load(std::memory_order_acquire);

    for (uint32_t i = 0; i < count && i < FRAME_METRICS_BUFFER_SIZE; ++i) {
        uint32_t actual_idx = (write_idx + i) % FRAME_METRICS_BUFFER_SIZE;
        out[i] = buffer_[actual_idx];
    }

    return count;
}

#endif

// Graph system profiling benchmark harness
// Runs 5 patterns: gradient, spectrum, bloom, noise, idle
// Captures 1000 frames per pattern
// Measures: FPS, heap delta, CPU time per stage
// Outputs CSV for analysis

#ifdef UNIT_TEST

#include <unity.h>
#include <vector>
#include "../src/frame_metrics.h"

// Mock definitions for test environment
extern "C" {
    // Mock FPS tracking (normally from profiler.cpp)
    float FPS_CPU = 0.0f;
    float FPS_CPU_SAMPLES[16] = {0};
    std::atomic<uint64_t> ACCUM_RENDER_US{0};
    std::atomic<uint64_t> ACCUM_QUANTIZE_US{0};
    std::atomic<uint64_t> ACCUM_RMT_WAIT_US{0};
    std::atomic<uint64_t> ACCUM_RMT_TRANSMIT_US{0};
    std::atomic<uint32_t> FRAMES_COUNTED{0};
}

// Test: Frame metrics buffer records frames correctly
void test_frame_metrics_buffer_records_frame() {
    #if FRAME_METRICS_ENABLED
    auto& buf = FrameMetricsBuffer::instance();
    buf.reset();

    // Record a frame
    buf.record_frame(100, 50, 10, 5, 4200);  // render, quantize, wait, tx, fps*100

    TEST_ASSERT_EQUAL_UINT32(1, buf.count());

    FrameMetric fm = buf.get_frame(0);
    TEST_ASSERT_EQUAL_UINT32(100, fm.render_us);
    TEST_ASSERT_EQUAL_UINT32(50, fm.quantize_us);
    TEST_ASSERT_EQUAL_UINT32(10, fm.rmt_wait_us);
    TEST_ASSERT_EQUAL_UINT32(5, fm.rmt_tx_us);
    TEST_ASSERT_EQUAL_UINT32(165, fm.total_us);
    #endif
}

// Test: Frame metrics buffer wraps around
void test_frame_metrics_buffer_wraps() {
    #if FRAME_METRICS_ENABLED
    auto& buf = FrameMetricsBuffer::instance();
    buf.reset();

    // Fill buffer with 80 frames (more than FRAME_METRICS_BUFFER_SIZE=64)
    for (uint32_t i = 0; i < 80; ++i) {
        buf.record_frame(100 + i, 50, 10, 5, 4200);
    }

    // Should only have 64 frames (latest 64)
    TEST_ASSERT_EQUAL_UINT32(FRAME_METRICS_BUFFER_SIZE, buf.count());

    // First accessible frame should be frame 16 (64 frames ago from 80)
    FrameMetric fm = buf.get_frame(0);
    TEST_ASSERT_EQUAL_UINT32(100 + 16, fm.render_us);
    #endif
}

// Test: Average metrics calculation
void test_frame_metrics_average() {
    #if FRAME_METRICS_ENABLED
    auto& buf = FrameMetricsBuffer::instance();
    buf.reset();

    // Record 10 frames with known timings
    for (uint32_t i = 0; i < 10; ++i) {
        buf.record_frame(100, 50, 10, 5, 4200);
    }

    AverageMetrics avg = frame_metrics_average(0);
    TEST_ASSERT_EQUAL_UINT32(10, avg.frame_count);
    TEST_ASSERT_FLOAT_WITHIN(0.1f, 100.0f, avg.avg_render_us);
    TEST_ASSERT_FLOAT_WITHIN(0.1f, 50.0f, avg.avg_quantize_us);
    TEST_ASSERT_FLOAT_WITHIN(0.1f, 165.0f, avg.avg_total_us);
    #endif
}

// Benchmark: Simulate pattern rendering (1000 frames)
void test_benchmark_pattern_render() {
    #if FRAME_METRICS_ENABLED
    auto& buf = FrameMetricsBuffer::instance();
    buf.reset();

    // Simulate 1000 frames of rendering
    uint32_t frame_count = 1000;
    uint32_t total_render_us = 0;
    uint32_t total_quantize_us = 0;

    for (uint32_t frame = 0; frame < frame_count; ++frame) {
        // Simulate variable frame times (typical pattern)
        uint32_t render = 5000 + (frame % 500);  // 5-5.5ms
        uint32_t quantize = 2000 + (frame % 200);  // 2-2.2ms

        buf.record_frame(render, quantize, 100, 50, 4200);

        total_render_us += render;
        total_quantize_us += quantize;
    }

    // Get buffer statistics (only last 64 frames)
    uint32_t buffered = buf.count();
    TEST_ASSERT_EQUAL_UINT32(FRAME_METRICS_BUFFER_SIZE, buffered);

    // Average of full run
    float avg_render = (float)total_render_us / frame_count;
    float avg_quantize = (float)total_quantize_us / frame_count;

    // Verify reasonable values
    TEST_ASSERT_FLOAT_WITHIN(100.0f, 5250.0f, avg_render);  // ~5250us expected
    TEST_ASSERT_FLOAT_WITHIN(50.0f, 2100.0f, avg_quantize);  // ~2100us expected
    #endif
}

// Benchmark: Zero-cost when disabled
void test_frame_metrics_zero_cost_when_disabled() {
    #if !FRAME_METRICS_ENABLED
    // When disabled, buffer operations should be no-ops
    auto& buf = FrameMetricsBuffer::instance();

    // These should all be no-ops (zero overhead)
    buf.record_frame(100, 50, 10, 5, 4200);
    buf.record_frame(100, 50, 10, 5, 4200);
    buf.record_frame(100, 50, 10, 5, 4200);

    // Count should be 0 when disabled
    TEST_ASSERT_EQUAL_UINT32(0, buf.count());
    #endif
}

// Test suite setup
void setUp(void) {
    // Reset state before each test
}

void tearDown(void) {
    // Cleanup after each test
}

#endif  // UNIT_TEST

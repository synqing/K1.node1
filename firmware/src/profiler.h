#pragma once

#include <Arduino.h>
#include <atomic>
#include "system_state.h"  // For USE_UNIFIED_STATE

// Simplified profiler - FPS monitoring + micro-timings

// Legacy global declarations (only when USE_UNIFIED_STATE=0)
// When USE_UNIFIED_STATE=1, these same metrics are available in g_profiler
#if !USE_UNIFIED_STATE
extern float FPS_CPU;
extern float FPS_CPU_SAMPLES[16];

// Micro-timing accumulators (us)
// Reset once per print cycle
// Uses relaxed ordering since these are performance counters without synchronization requirements
extern std::atomic<uint64_t> ACCUM_RENDER_US;
extern std::atomic<uint64_t> ACCUM_QUANTIZE_US;
extern std::atomic<uint64_t> ACCUM_RMT_WAIT_US;
extern std::atomic<uint64_t> ACCUM_RMT_TRANSMIT_US;
extern std::atomic<uint32_t> FRAMES_COUNTED;
#endif

void watch_cpu_fps();
void print_fps();
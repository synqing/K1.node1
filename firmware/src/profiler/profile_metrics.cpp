#include "profile_metrics.h"

/**
 * @brief Global profiler metrics instance
 *
 * Holds all frame-level timing accumulators and statistics.
 * Updated continuously during render/quantize/RMT phases.
 */
ProfileMetrics g_profiler;

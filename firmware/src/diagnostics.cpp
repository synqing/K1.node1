#include "diagnostics.h"
#include <Arduino.h>
#include <atomic>

// Defaults: disabled, 5000ms interval
// Uses relaxed ordering since these are simple configuration flags without synchronization
static std::atomic<bool> s_diag_enabled{false};
static std::atomic<uint32_t> s_diag_interval_ms{5000};

void diag_set_enabled(bool enabled) {
    s_diag_enabled.store(enabled, std::memory_order_relaxed);
}

bool diag_is_enabled() {
    return s_diag_enabled.load(std::memory_order_relaxed);
}

void diag_set_interval_ms(uint32_t interval_ms) {
    s_diag_interval_ms.store(interval_ms ? interval_ms : 5000, std::memory_order_relaxed);
}

uint32_t diag_get_interval_ms() {
    return s_diag_interval_ms.load(std::memory_order_relaxed);
}


#include "diagnostics.h"
#include <Arduino.h>
#include <atomic>
#include <Preferences.h>

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

// Persist diagnostics settings in NVS under namespace "diagnostics"
// Keys: "enabled" (bool), "interval" (uint32_t)
void diag_load_from_nvs() {
    Preferences prefs;
    if (!prefs.begin("diagnostics", true)) {
        // NVS not available or namespace missing; keep defaults
        return;
    }
    bool enabled = prefs.getBool("enabled", s_diag_enabled.load(std::memory_order_relaxed));
    uint32_t interval = prefs.getUInt("interval", s_diag_interval_ms.load(std::memory_order_relaxed));
    prefs.end();
    s_diag_enabled.store(enabled, std::memory_order_relaxed);
    s_diag_interval_ms.store(interval ? interval : 5000, std::memory_order_relaxed);
}

void diag_save_to_nvs() {
    Preferences prefs;
    if (!prefs.begin("diagnostics", false)) {
        // Failed to open NVS for writing; ignore
        return;
    }
    prefs.putBool("enabled", s_diag_enabled.load(std::memory_order_relaxed));
    prefs.putUInt("interval", s_diag_interval_ms.load(std::memory_order_relaxed));
    prefs.end();
}

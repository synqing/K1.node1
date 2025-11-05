#include "beat_events.h"
#include <Arduino.h>
#include <string.h>
#include <atomic>

// Simple ring buffer for beat events
static BeatEvent* s_buffer = nullptr;
static uint16_t s_capacity = 0;
static std::atomic<uint16_t> s_head{0};  // write index (acquire/release for ring buffer sync)
static std::atomic<uint16_t> s_tail{0};  // read index (acquire/release for ring buffer sync)
static std::atomic<uint16_t> s_count{0};  // buffer occupancy counter

// Latency probe
static std::atomic<uint32_t> s_probe_start_us{0};
static std::atomic<bool> s_probe_logging_enabled{false};
static std::atomic<uint32_t> s_probe_last_print_ms{0};
static std::atomic<uint32_t> s_probe_print_interval_ms{5000}; // default: 5s

// Last probe snapshot
static std::atomic<uint32_t> s_last_latency_us{0};
static std::atomic<uint32_t> s_last_probe_timestamp_us{0};
static char s_last_probe_label[32] = {0};

void beat_events_init(uint16_t capacity) {
    if (s_buffer) {
        delete[] s_buffer;
    }
    s_capacity = capacity ? capacity : 64;
    s_buffer = new BeatEvent[s_capacity];
    s_head.store(0, std::memory_order_release);
    s_tail.store(0, std::memory_order_release);
    s_count.store(0, std::memory_order_release);
    s_probe_start_us.store(0, std::memory_order_release);
}

bool beat_events_push(uint32_t timestamp_us, uint16_t confidence) {
    if (!s_buffer || s_capacity == 0) return false;

    // Load head with acquire semantics to ensure we see writes from other cores
    uint16_t head = s_head.load(std::memory_order_acquire);
    BeatEvent ev = { timestamp_us, confidence };
    s_buffer[head] = ev;
    s_head.store((head + 1) % s_capacity, std::memory_order_release);

    uint16_t count = s_count.load(std::memory_order_acquire);
    if (count < s_capacity) {
        s_count.store(count + 1, std::memory_order_release);
        return true;
    } else {
        // Overwrite oldest when full
        uint16_t tail = s_tail.load(std::memory_order_acquire);
        s_tail.store((tail + 1) % s_capacity, std::memory_order_release);
        return false; // indicate overwrite
    }
}

bool beat_events_pop(BeatEvent* out) {
    uint16_t count = s_count.load(std::memory_order_acquire);
    if (!out || count == 0) return false;
    uint16_t tail = s_tail.load(std::memory_order_acquire);
    *out = s_buffer[tail];
    s_tail.store((tail + 1) % s_capacity, std::memory_order_release);
    s_count.store(count - 1, std::memory_order_release);
    return true;
}

uint16_t beat_events_count() {
    return s_count.load(std::memory_order_acquire);
}

uint16_t beat_events_capacity() {
    return s_capacity;
}

uint16_t beat_events_peek(BeatEvent* out, uint16_t max) {
    uint16_t count = s_count.load(std::memory_order_acquire);
    if (!out || max == 0 || count == 0) return 0;
    // Snapshot tail and count to avoid inconsistent traversal
    uint16_t local_tail = s_tail.load(std::memory_order_acquire);
    uint16_t local_count = count;
    uint16_t to_copy = (local_count < max) ? local_count : max;
    for (uint16_t i = 0; i < to_copy; ++i) {
        uint16_t idx = (local_tail + i) % s_capacity;
        out[i] = s_buffer[idx];
    }
    return to_copy;
}

void beat_events_probe_start() {
    s_probe_start_us.store((uint32_t)esp_timer_get_time(), std::memory_order_release);
}

void beat_events_probe_end(const char* label) {
    uint32_t start = s_probe_start_us.load(std::memory_order_acquire);
    if (start == 0) return;
    uint32_t now = (uint32_t)esp_timer_get_time();
    uint32_t delta_us = now - start;
    float delta_ms = delta_us / 1000.0f;
    // Update last probe snapshot
    s_last_latency_us.store(delta_us, std::memory_order_release);
    s_last_probe_timestamp_us.store(now, std::memory_order_release);
    if (label) {
        strncpy(s_last_probe_label, label, sizeof(s_last_probe_label) - 1);
        s_last_probe_label[sizeof(s_last_probe_label) - 1] = '\0';
    } else {
        s_last_probe_label[0] = '\0';
    }
    // Rate-limit probe printing
    bool logging = s_probe_logging_enabled.load(std::memory_order_acquire);
    if (logging) {
        uint32_t now_ms = millis();
        uint32_t last_print = s_probe_last_print_ms.load(std::memory_order_acquire);
        uint32_t interval = s_probe_print_interval_ms.load(std::memory_order_acquire);
        if ((now_ms - last_print) >= interval) {
            Serial.printf("[latency] %s: %.2f ms (events=%u)\n", label ? label : "probe", delta_ms, (unsigned)beat_events_count());
            s_probe_last_print_ms.store(now_ms, std::memory_order_release);
        }
    }
    s_probe_start_us.store(0, std::memory_order_release);
}

void beat_events_set_probe_logging(bool enabled) {
    s_probe_logging_enabled.store(enabled, std::memory_order_release);
}

void beat_events_set_probe_interval_ms(uint32_t interval_ms) {
    s_probe_print_interval_ms.store(interval_ms ? interval_ms : 5000, std::memory_order_release);
}

bool beat_events_probe_active() {
    return s_probe_start_us.load(std::memory_order_acquire) != 0;
}

uint32_t beat_events_last_latency_us() {
    return s_last_latency_us.load(std::memory_order_acquire);
}

uint32_t beat_events_last_probe_timestamp_us() {
    return s_last_probe_timestamp_us.load(std::memory_order_acquire);
}

const char* beat_events_last_probe_label() {
    return s_last_probe_label;
}

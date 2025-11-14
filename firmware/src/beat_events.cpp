#include "beat_events.h"
#include <Arduino.h>
#include "logging/logger.h"
#include <string.h>
#include <atomic>

// Simple ring buffer for beat events
static BeatEvent* s_buffer = nullptr;
static uint16_t s_capacity = 0;
static std::atomic<uint16_t> s_head{0};  // write index (acquire/release for ring buffer sync)
static std::atomic<uint16_t> s_tail{0};  // read index (acquire/release for ring buffer sync)
static std::atomic<uint16_t> s_count{0};  // buffer occupancy counter
static std::atomic<uint32_t> s_overflow_count{0};  // total overflow events

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
    // Critical safety check: ensure buffer is initialized
    if (!s_buffer || s_capacity == 0 || timestamp_us == 0) return false;

    // Load head with acquire semantics to ensure we see writes from other cores
    uint16_t head = s_head.load(std::memory_order_acquire);
    
    // Bounds check to prevent buffer overflow
    if (head >= s_capacity) {
        // Reset head to prevent crash
        head = 0;
        s_head.store(0, std::memory_order_release);
    }
    
    BeatEvent ev = { timestamp_us, confidence };
    s_buffer[head] = ev;
    uint16_t new_head = (head + 1) % s_capacity;
    s_head.store(new_head, std::memory_order_release);

    uint16_t count = s_count.load(std::memory_order_acquire);
    if (count < s_capacity) {
        s_count.store(count + 1, std::memory_order_release);
        return true;
    } else {
        // Overwrite oldest when full
        uint16_t tail = s_tail.load(std::memory_order_acquire);
        uint16_t new_tail = (tail + 1) % s_capacity;
        s_tail.store(new_tail, std::memory_order_release);
        s_overflow_count.fetch_add(1, std::memory_order_relaxed); // Track overflows
        return false; // indicate overwrite
    }
}

bool beat_events_pop(BeatEvent* out) {
    if (!out) return false;
    
    uint16_t count = s_count.load(std::memory_order_acquire);
    if (count == 0) return false;
    
    uint16_t tail = s_tail.load(std::memory_order_acquire);
    
    // Bounds check to prevent buffer overflow
    if (tail >= s_capacity || !s_buffer) {
        return false;
    }
    
    *out = s_buffer[tail];
    uint16_t new_tail = (tail + 1) % s_capacity;
    s_tail.store(new_tail, std::memory_order_release);
    s_count.store(count - 1, std::memory_order_release);
    return true;
}

uint16_t beat_events_count() {
    return s_count.load(std::memory_order_acquire);
}

uint16_t beat_events_capacity() {
    return s_capacity;
}

uint32_t beat_events_overflow_count() {
    return s_overflow_count.load(std::memory_order_acquire);
}

uint16_t beat_events_peek(BeatEvent* out, uint16_t max) {
    if (!out || max == 0) return 0;
    
    uint16_t count = s_count.load(std::memory_order_acquire);
    if (count == 0 || !s_buffer) return 0;
    
    // Snapshot tail and count to avoid inconsistent traversal
    uint16_t local_tail = s_tail.load(std::memory_order_acquire);
    uint16_t local_count = count;
    uint16_t to_copy = (local_count < max) ? local_count : max;
    
    // Bounds check to prevent buffer overflow
    if (local_tail >= s_capacity) return 0;
    
    for (uint16_t i = 0; i < to_copy; ++i) {
        uint16_t idx = (local_tail + i) % s_capacity;
        // Additional bounds check for safety
        if (idx >= s_capacity) break;
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
            LOG_INFO(TAG_BEAT, "Latency %s: %.2f ms (events=%u)",
                     label ? label : "probe", delta_ms, (unsigned)beat_events_count());
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

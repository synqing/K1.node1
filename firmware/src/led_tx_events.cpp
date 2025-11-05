#include "led_tx_events.h"
#include <Arduino.h>
#include <string.h>
#include <atomic>

// Simple ring buffer for LED transmit events
static LedTxEvent* s_buffer = nullptr;
static uint16_t s_capacity = 0;
static std::atomic<uint16_t> s_head{0};  // write index (acquire/release for ring buffer sync)
static std::atomic<uint16_t> s_tail{0};  // read index (acquire/release for ring buffer sync)
static std::atomic<uint16_t> s_count{0};  // buffer occupancy counter

void led_tx_events_init(uint16_t capacity) {
    if (s_buffer) {
        // already initialized
        return;
    }
    s_capacity = capacity > 0 ? capacity : 32;
    s_buffer = (LedTxEvent*)malloc(sizeof(LedTxEvent) * s_capacity);
    s_head.store(0, std::memory_order_release);
    s_tail.store(0, std::memory_order_release);
    s_count.store(0, std::memory_order_release);
}

IRAM_ATTR bool led_tx_events_push(uint32_t timestamp_us) {
    if (!s_buffer || s_capacity == 0) return false;
    uint16_t head = s_head.load(std::memory_order_acquire);
    uint16_t next_head = (head + 1) % s_capacity;
    uint16_t count = s_count.load(std::memory_order_acquire);
    if (count == s_capacity) {
        // overwrite oldest
        uint16_t tail = s_tail.load(std::memory_order_acquire);
        s_tail.store((tail + 1) % s_capacity, std::memory_order_release);
        s_count.store(count - 1, std::memory_order_release);
        count--;
    }
    s_buffer[head].timestamp_us = timestamp_us;
    s_head.store(next_head, std::memory_order_release);
    s_count.store(count + 1, std::memory_order_release);
    return true;
}

uint16_t led_tx_events_count() {
    return s_count.load(std::memory_order_acquire);
}

uint16_t led_tx_events_capacity() {
    return s_capacity;
}

uint16_t led_tx_events_peek(LedTxEvent* out, uint16_t max) {
    if (!s_buffer || s_capacity == 0 || !out || max == 0) return 0;
    uint16_t count = s_count.load(std::memory_order_acquire);
    uint16_t to_copy = count < max ? count : max;
    // Oldest-first traversal
    uint16_t idx = s_tail.load(std::memory_order_acquire);
    for (uint16_t i = 0; i < to_copy; ++i) {
        out[i] = s_buffer[idx];
        idx = (idx + 1) % s_capacity;
    }
    return to_copy;
}


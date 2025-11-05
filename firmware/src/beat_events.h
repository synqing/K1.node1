#ifndef BEAT_EVENTS_H
#define BEAT_EVENTS_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    uint32_t timestamp_us;   // Event timestamp (microseconds)
    uint16_t confidence;     // 0-65535 scaled confidence
} BeatEvent;

// Initialize the ring buffer and latency probe state
void beat_events_init(uint16_t capacity);

// Push a beat event into the ring buffer; returns false if overwrite occurred
bool beat_events_push(uint32_t timestamp_us, uint16_t confidence);

// Pop the oldest beat event; returns false if empty
bool beat_events_pop(BeatEvent* out);

// Current number of queued events
uint16_t beat_events_count();

// Capacity of the ring buffer
uint16_t beat_events_capacity();

// Non-destructive peek of up to max recent events (oldest-first)
// Returns number of events copied into out (<= max)
uint16_t beat_events_peek(BeatEvent* out, uint16_t max);

// Latency probe utilities
void beat_events_probe_start();
void beat_events_probe_end(const char* label);

// Probe state and last snapshot
bool beat_events_probe_active();
uint32_t beat_events_last_latency_us();
uint32_t beat_events_last_probe_timestamp_us();
const char* beat_events_last_probe_label();

// Configure latency probe logging
// Enable/disable printing and set minimum interval between prints (ms)
void beat_events_set_probe_logging(bool enabled);
void beat_events_set_probe_interval_ms(uint32_t interval_ms);

#ifdef __cplusplus
}
#endif

#endif  // BEAT_EVENTS_H

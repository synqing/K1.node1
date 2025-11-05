#ifndef LED_TX_EVENTS_H
#define LED_TX_EVENTS_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    uint32_t timestamp_us;   // LED transmit start timestamp (microseconds)
} LedTxEvent;

// Initialize the ring buffer for LED transmit events
void led_tx_events_init(uint16_t capacity);

// Push a new LED transmit event (timestamp in microseconds)
bool led_tx_events_push(uint32_t timestamp_us);

// Current number of queued LED TX events
uint16_t led_tx_events_count();

// Capacity of the ring buffer
uint16_t led_tx_events_capacity();

// Non-destructive peek of up to max recent events (oldest-first)
// Returns number of events copied into out (<= max)
uint16_t led_tx_events_peek(LedTxEvent* out, uint16_t max);

#ifdef __cplusplus
}
#endif

#endif  // LED_TX_EVENTS_H


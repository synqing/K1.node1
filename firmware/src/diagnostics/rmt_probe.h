#pragma once

#include <stdint.h>
#if __has_include(<driver/rmt_tx.h>)
#include <driver/rmt_tx.h>
#else
#include <driver/rmt.h>
typedef void* rmt_channel_handle_t;
typedef struct rmt_tx_done_event_data_t {} rmt_tx_done_event_data_t;
typedef struct {
  bool (*on_mem_empty)(rmt_channel_handle_t, const rmt_tx_done_event_data_t*, void*);
  bool (*on_trans_done)(rmt_channel_handle_t, const rmt_tx_done_event_data_t*, void*);
} rmt_tx_event_callbacks_t;
static inline int rmt_register_tx_event_callbacks(rmt_channel_handle_t, const rmt_tx_event_callbacks_t*, void*) { return 0; }
#endif

typedef struct {
  const char* name;
  volatile uint32_t mem_empty_count;
  volatile uint32_t trans_done_count;
  volatile uint32_t max_gap_us;
  volatile uint64_t last_empty_us;
} RmtProbe;

// Initialize RMT TX callbacks for a channel and bind probe state
void rmt_probe_init(rmt_channel_handle_t chan, const char* name);

// Snapshot current counters into user variables
void rmt_probe_get(const RmtProbe** ch1, const RmtProbe** ch2);

// Reset counters for both probes (ch1 and ch2)
void rmt_probe_reset();

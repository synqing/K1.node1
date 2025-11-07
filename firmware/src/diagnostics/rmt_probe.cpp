#include "diagnostics/rmt_probe.h"
#include <esp_timer.h>
#include <string.h>

static RmtProbe g_probe_ch1 = {"ch1", 0, 0, 0, 0};
static RmtProbe g_probe_ch2 = {"ch2", 0, 0, 0, 0};

static bool IRAM_ATTR on_mem_empty_cb(rmt_channel_handle_t, const rmt_tx_done_event_data_t*, void* user_data) {
  RmtProbe* p = reinterpret_cast<RmtProbe*>(user_data);
  uint64_t now = esp_timer_get_time();
  uint64_t last = p->last_empty_us;
  p->last_empty_us = now;
  p->mem_empty_count++;
  if (last != 0) {
    uint32_t gap = (uint32_t)(now - last);
    if (gap > p->max_gap_us) p->max_gap_us = gap;
  }
  return true;  // keep feeding
}

static bool IRAM_ATTR on_trans_done_cb(rmt_channel_handle_t, const rmt_tx_done_event_data_t*, void* user_data) {
  RmtProbe* p = reinterpret_cast<RmtProbe*>(user_data);
  p->trans_done_count++;
  return true;
}

void rmt_probe_init(rmt_channel_handle_t chan, const char* name) {
  RmtProbe* target = nullptr;
  if (name && strcmp(name, "ch2") == 0) target = &g_probe_ch2;
  else target = &g_probe_ch1;
  target->name = name ? name : target->name;
  target->mem_empty_count = 0;
  target->trans_done_count = 0;
  target->max_gap_us = 0;
  target->last_empty_us = 0;

  rmt_tx_event_callbacks_t cbs = {};
  cbs.on_mem_empty = on_mem_empty_cb;
  cbs.on_trans_done = on_trans_done_cb;
  (void)rmt_register_tx_event_callbacks(chan, &cbs, target);
}

void rmt_probe_get(const RmtProbe** ch1, const RmtProbe** ch2) {
  if (ch1) *ch1 = &g_probe_ch1;
  if (ch2) *ch2 = &g_probe_ch2;
}


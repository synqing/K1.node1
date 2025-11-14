#include "diagnostics/heartbeat_logger.h"

#include <SPIFFS.h>
#include <esp_timer.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

#include "audio/goertzel.h"
#include "audio/tempo.h"
#include "beat_events.h"
#include "led_driver.h"
#include "logging/logger.h"
#include "pattern_audio_interface.h"
#include "diagnostics/rmt_probe.h"
#include "pattern_registry.h"

namespace {
struct HeartbeatEntry {
  uint32_t timestamp_ms;
  uint32_t frame_total;
  uint32_t frame_delta;
  uint32_t audio_ticks;
  uint32_t audio_delta;
  uint32_t audio_snapshot;
  uint32_t snapshot_delta;
  uint32_t loop_gpu_stall_ms;
  uint32_t audio_stall_ms;
  uint32_t led_idle_ms;
  uint8_t pattern_index;
  float vu_level;
  float vu_level_raw;
  float tempo_confidence;
  bool silence;
  uint16_t beat_queue_depth;
  // RMT diagnostics
  uint32_t rmt_empty_ch1;
  uint32_t rmt_empty_ch2;
  uint32_t rmt_maxgap_ch1;
  uint32_t rmt_maxgap_ch2;
};

constexpr size_t kHistorySize = 64;
HeartbeatEntry g_history[kHistorySize];
size_t g_history_index = 0;
bool g_history_full = false;

SemaphoreHandle_t g_lock = xSemaphoreCreateMutex();
uint32_t g_last_log_ms = 0;
uint32_t g_interval_ms = 1000;

uint32_t g_frame_total = 0;
uint32_t g_audio_total = 0;
uint32_t g_audio_snapshot = 0;
uint32_t g_loop_gpu_last_ms = 0;
uint32_t g_audio_last_ms = 0;

File g_file;
String g_path = "/heartbeat.log";
size_t g_max_bytes = 65536;
size_t g_file_size = 0;

void store_entry(const HeartbeatEntry& entry) {
  g_history[g_history_index] = entry;
  g_history_index = (g_history_index + 1) % kHistorySize;
  if (g_history_index == 0) {
    g_history_full = true;
  }
}

void append_line(const String& line) {
  if (!g_file) return;
  if (g_file_size + line.length() > g_max_bytes) {
    g_file.close();
    SPIFFS.remove(g_path);
    g_file = SPIFFS.open(g_path, FILE_WRITE);
    if (!g_file) return;
    g_file_size = 0;
  }
  size_t written = g_file.print(line);
  if (written == line.length()) {
    g_file_size += written;
  }
}
}  // namespace

void heartbeat_logger_reset() {
  if (g_file) {
    g_file.close();
  }
  SPIFFS.remove(g_path);
  g_file = SPIFFS.open(g_path, FILE_WRITE);
  if (g_file) {
    g_file_size = 0;
    g_file.print("# heartbeat log\n");
  }
  g_history_index = 0;
  g_history_full = false;
  g_frame_total = 0;
  g_audio_total = 0;
  g_audio_snapshot = 0;
  g_loop_gpu_last_ms = millis();
  g_audio_last_ms = millis();
}

void heartbeat_logger_init(const char* path, size_t max_bytes, uint32_t interval_ms) {
  if (path) {
    g_path = path;
  }
  g_max_bytes = max_bytes;
  g_interval_ms = interval_ms;
  heartbeat_logger_reset();
}

void heartbeat_logger_note_frame() {
  uint32_t now = millis();
  if (xSemaphoreTake(g_lock, 1) == pdTRUE) {
    ++g_frame_total;
    g_loop_gpu_last_ms = now;
    xSemaphoreGive(g_lock);
  }
}

void heartbeat_logger_note_audio(uint32_t audio_update_counter) {
  uint32_t now = millis();
  if (xSemaphoreTake(g_lock, 1) == pdTRUE) {
    ++g_audio_total;
    g_audio_snapshot = audio_update_counter;
    g_audio_last_ms = now;
    xSemaphoreGive(g_lock);
  }
}

void heartbeat_logger_poll() {
  uint32_t now_ms = millis();
  if (now_ms - g_last_log_ms < g_interval_ms) {
    return;
  }
  g_last_log_ms = now_ms;

  HeartbeatEntry entry{};
  if (xSemaphoreTake(g_lock, 5) == pdTRUE) {
    static uint32_t prev_frames = 0;
    static uint32_t prev_audio = 0;
    static uint32_t prev_snapshot = 0;

    entry.timestamp_ms = now_ms;
    entry.frame_total = g_frame_total;
    entry.frame_delta = g_frame_total - prev_frames;
    entry.audio_ticks = g_audio_total;
    entry.audio_delta = g_audio_total - prev_audio;
    entry.audio_snapshot = g_audio_snapshot;
    entry.snapshot_delta = g_audio_snapshot - prev_snapshot;
    entry.loop_gpu_stall_ms = now_ms - g_loop_gpu_last_ms;
    entry.audio_stall_ms = now_ms - g_audio_last_ms;

    prev_frames = g_frame_total;
    prev_audio = g_audio_total;
    prev_snapshot = g_audio_snapshot;

    xSemaphoreGive(g_lock);
  }

  uint64_t now_us = esp_timer_get_time();
  if (g_last_led_tx_us.load() != 0) {
    uint64_t led_idle_us = now_us - g_last_led_tx_us.load();
    entry.led_idle_ms = static_cast<uint32_t>(led_idle_us / 1000ULL);
  } else {
    entry.led_idle_ms = 0xFFFFFFFFu;
  }

  entry.pattern_index = g_current_pattern_index;
  entry.vu_level = audio_back.payload.vu_level;
  entry.vu_level_raw = audio_back.payload.vu_level_raw;
  entry.tempo_confidence = audio_back.payload.tempo_confidence;
  entry.silence = silence_detected;
  entry.beat_queue_depth = beat_events_count();

  store_entry(entry);

  String line;
  line.reserve(160);
  line += "ts="; line += entry.timestamp_ms;
  line += " frame_total="; line += entry.frame_total;
  line += " frame_delta="; line += entry.frame_delta;
  line += " audio_ticks="; line += entry.audio_ticks;
  line += " audio_delta="; line += entry.audio_delta;
  line += " snapshot="; line += entry.audio_snapshot;
  line += " snapshot_delta="; line += entry.snapshot_delta;
  line += " loop_stall="; line += entry.loop_gpu_stall_ms;
  line += " audio_stall="; line += entry.audio_stall_ms;
  line += " led_idle="; line += entry.led_idle_ms;
  line += " pattern="; line += entry.pattern_index;
  line += " vu="; line += entry.vu_level;
  line += " raw="; line += entry.vu_level_raw;
  line += " tempo="; line += entry.tempo_confidence;
  line += " silence="; line += (entry.silence ? 1 : 0);
  line += " beat_q="; line += entry.beat_queue_depth;
  #ifdef DEBUG_TELEMETRY
  {
    const RmtProbe* p1 = nullptr; const RmtProbe* p2 = nullptr;
    rmt_probe_get(&p1, &p2);
    if (p1 && p2) {
      line += " rmt_empty_ch1="; line += p1->mem_empty_count;
      line += " rmt_empty_ch2="; line += p2->mem_empty_count;
      line += " rmt_maxgap_us_ch1="; line += p1->max_gap_us;
      line += " rmt_maxgap_us_ch2="; line += p2->max_gap_us;
    }
  }
  #endif
  line += "\n";
  append_line(line);
}

void heartbeat_logger_dump_recent(Stream& out) {
  size_t count = g_history_full ? kHistorySize : g_history_index;
  out.printf("[heartbeat] samples=%u\n", (unsigned)count);
  for (size_t idx = 0; idx < count; ++idx) {
    size_t pos = g_history_full ? (g_history_index + idx) % kHistorySize : idx;
    const auto& e = g_history[pos];
    out.printf("t=%lums frames=%lu (+%lu) audio=%lu (+%lu) snap=%lu (+%lu) loop_stall=%lums audio_stall=%lums led_idle=%lums pattern=%u vu=%.3f raw=%.3f tempo=%.3f silence=%u beat_q=%u\n",
               (unsigned long)e.timestamp_ms,
               (unsigned long)e.frame_total,
               (unsigned long)e.frame_delta,
               (unsigned long)e.audio_ticks,
               (unsigned long)e.audio_delta,
               (unsigned long)e.audio_snapshot,
               (unsigned long)e.snapshot_delta,
               (unsigned long)e.loop_gpu_stall_ms,
               (unsigned long)e.audio_stall_ms,
               (unsigned long)e.led_idle_ms,
               (unsigned)e.pattern_index,
               e.vu_level,
               e.vu_level_raw,
               e.tempo_confidence,
               (unsigned)e.silence,
               (unsigned)e.beat_queue_depth);
  }
  out.flush();
}

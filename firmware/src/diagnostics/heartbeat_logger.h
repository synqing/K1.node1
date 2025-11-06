#pragma once

#include <Arduino.h>

void heartbeat_logger_init(const char* path = "/heartbeat.log",
                           size_t max_bytes = 65536,
                           uint32_t interval_ms = 1000);

void heartbeat_logger_reset();
void heartbeat_logger_note_frame();
void heartbeat_logger_note_audio(uint32_t audio_update_counter);
void heartbeat_logger_poll();
void heartbeat_logger_dump_recent(Stream& out);

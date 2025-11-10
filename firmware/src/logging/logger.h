#pragma once

#include <Arduino.h>
#include <cstdarg>
#include "log_config.h"

// Minimal logger implementation to restore build after file deletion.
// Provides printf-style logging with severity and tag support.

namespace Logger {

void init();
void flush();
const char* get_timestamp();

// Runtime controls
void set_level(uint8_t level);
uint8_t get_level();
void set_tag_enabled(char tag, bool enabled);
bool get_tag_enabled(char tag);
void toggle_tag(char tag);

void log_internal(char tag, uint8_t severity, const char* format, va_list args);
void log_printf(char tag, uint8_t severity, const char* format, ...) __attribute__((format(printf, 3, 4)));

} // namespace Logger

// Logging macros with compile-time severity filtering
#if LOG_LEVEL >= LOG_LEVEL_ERROR
#define LOG_ERROR(tag, fmt, ...) Logger::log_printf(tag, LOG_LEVEL_ERROR, fmt, ##__VA_ARGS__)
#else
#define LOG_ERROR(tag, fmt, ...) do {} while(0)
#endif

#if LOG_LEVEL >= LOG_LEVEL_WARN
#define LOG_WARN(tag, fmt, ...) Logger::log_printf(tag, LOG_LEVEL_WARN, fmt, ##__VA_ARGS__)
#else
#define LOG_WARN(tag, fmt, ...) do {} while(0)
#endif

#if LOG_LEVEL >= LOG_LEVEL_INFO
#define LOG_INFO(tag, fmt, ...) Logger::log_printf(tag, LOG_LEVEL_INFO, fmt, ##__VA_ARGS__)
#else
#define LOG_INFO(tag, fmt, ...) do {} while(0)
#endif

#if LOG_LEVEL >= LOG_LEVEL_DEBUG
#define LOG_DEBUG(tag, fmt, ...) Logger::log_printf(tag, LOG_LEVEL_DEBUG, fmt, ##__VA_ARGS__)
#else
#define LOG_DEBUG(tag, fmt, ...) do {} while(0)
#endif

// Convenience macros (default tag if not specified)
#ifndef TAG_CORE0
#define TAG_CORE0 '0'
#endif

#define LOG_ERR(fmt, ...) LOG_ERROR(TAG_CORE0, fmt, ##__VA_ARGS__)
#define LOG_WRN(fmt, ...) LOG_WARN(TAG_CORE0, fmt, ##__VA_ARGS__)
#define LOG_INF(fmt, ...) LOG_INFO(TAG_CORE0, fmt, ##__VA_ARGS__)
#define LOG_DBG(fmt, ...) LOG_DEBUG(TAG_CORE0, fmt, ##__VA_ARGS__)

// Throttled logging: emit at most once per interval at each call site
#define LOG_EVERY_MS(tag, severity, interval_ms, fmt, ...)                               \
    do {                                                                                 \
        static uint32_t _last_log_ms = 0;                                                \
        uint32_t _now_ms = millis();                                                     \
        if ((_now_ms - _last_log_ms) >= (uint32_t)(interval_ms)) {                       \
            Logger::log_printf(tag, severity, fmt, ##__VA_ARGS__);                       \
            _last_log_ms = _now_ms;                                                      \
        }                                                                                \
    } while (0)

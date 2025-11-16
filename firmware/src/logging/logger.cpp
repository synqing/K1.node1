#include "logger.h"
#include <cstdio>
#include <cstring>
#include <esp_log.h>

namespace Logger {

static char message_buffer[LOG_MESSAGE_BUFFER_SIZE];
static char timestamp_buffer[LOG_MAX_TIMESTAMP_LEN];
// Default runtime level keeps production logs at INFO unless toggled via serial.
static uint8_t s_runtime_level = LOG_LEVEL_INFO;
#if LOG_ENABLE_TAG_FILTERING
static bool s_tag_enabled[128];
static bool s_tag_init = false;
static inline void ensure_tag_defaults() {
    if (!s_tag_init) {
        for (int i = 0; i < 128; ++i) s_tag_enabled[i] = true;  // enable all by default
        s_tag_init = true;
    }
}
#endif

void init() {
    Serial.begin(LOG_SERIAL_BAUD);
    delay(50);
#if defined(ESP_LOG_NONE)
    // Suppress noisy ESP-IDF driver logs that bypass our logger (e.g., RMT)
    // We already surface RMT timeouts via TAG_LED with context and recovery.
    esp_log_level_set("rmt", ESP_LOG_NONE);
#endif
#if LOG_ENABLE_TAG_FILTERING
    ensure_tag_defaults();
#endif
}

const char* get_timestamp() {
    uint32_t ms = millis();
    uint32_t s = ms / 1000u;
    uint32_t h = (s / 3600u) % 24u;
    uint32_t m = (s / 60u) % 60u;
    uint32_t sec = s % 60u;
    uint32_t ms_rem = ms % 1000u;
    // Use %u specifiers for uint32_t and ensure buffer is large enough (LOG_MAX_TIMESTAMP_LEN)
    snprintf(timestamp_buffer, sizeof(timestamp_buffer), "%02u:%02u:%02u.%03u",
             (unsigned)h, (unsigned)m, (unsigned)sec, (unsigned)ms_rem);
    return timestamp_buffer;
}

static const char* severity_to_string(uint8_t severity) {
    switch (severity) {
        case LOG_LEVEL_ERROR: return "ERROR";
        case LOG_LEVEL_WARN:  return "WARN ";
        case LOG_LEVEL_INFO:  return "INFO ";
        case LOG_LEVEL_DEBUG: return "DEBUG";
        default:              return "???? ";
    }
}

void log_internal(char tag, uint8_t severity, const char* format, va_list args) {
    // Compile-time filter already applied by macros; runtime filter applied here.
#if LOG_ENABLE_TAG_FILTERING
    ensure_tag_defaults();
    unsigned int ti = (unsigned char)tag;
    if (!s_tag_enabled[ti]) return;  // tag disabled
#endif
    if (severity > s_runtime_level) return;  // higher verbosity than allowed

    char fmtbuf[LOG_FORMAT_BUFFER_SIZE];
    int n = vsnprintf(fmtbuf, sizeof(fmtbuf), format, args);
    if (n < 0) fmtbuf[0] = '\0';

    const char* ts = get_timestamp();
    const char* sev = severity_to_string(severity);
    const char* sev_color = COLOR_DEBUG;
    switch (severity) {
        case LOG_LEVEL_ERROR: sev_color = COLOR_ERROR; break;
        case LOG_LEVEL_WARN:  sev_color = COLOR_WARN;  break;
        case LOG_LEVEL_INFO:  sev_color = COLOR_INFO;  break;
        case LOG_LEVEL_DEBUG: sev_color = COLOR_DEBUG; break;
        default: break;
    }

    // Compose colored output: time, severity, tag, message
    // Example:  [12:34:56.789] INFO [A] message
    snprintf(message_buffer, sizeof(message_buffer),
             "%s[%s]%s %s%s%s %s[%c]%s %s\n",
             COLOR_TIME, ts, COLOR_RESET,
             sev_color, sev, COLOR_RESET,
             COLOR_TAG, tag, COLOR_RESET,
             fmtbuf);
    Serial.print(message_buffer);
}

void log_printf(char tag, uint8_t severity, const char* format, ...) {
    va_list args;
    va_start(args, format);
    log_internal(tag, severity, format, args);
    va_end(args);
}

void flush() {
    Serial.flush();
}

// Runtime control API
void set_level(uint8_t level) { s_runtime_level = level; }
uint8_t get_level() { return s_runtime_level; }
#if LOG_ENABLE_TAG_FILTERING
void set_tag_enabled(char tag, bool enabled) {
    ensure_tag_defaults();
    s_tag_enabled[(unsigned char)tag] = enabled;
}
bool get_tag_enabled(char tag) {
    ensure_tag_defaults();
    return s_tag_enabled[(unsigned char)tag];
}
void toggle_tag(char tag) {
    ensure_tag_defaults();
    unsigned char ti = (unsigned char)tag;
    s_tag_enabled[ti] = !s_tag_enabled[ti];
}
#else
void set_tag_enabled(char, bool) {}
bool get_tag_enabled(char) { return true; }
void toggle_tag(char) {}
#endif

} // namespace Logger

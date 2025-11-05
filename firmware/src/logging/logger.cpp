#include "logger.h"
#include <cstdio>
#include <cstring>

namespace Logger {

static char message_buffer[LOG_MESSAGE_BUFFER_SIZE];
static char timestamp_buffer[LOG_MAX_TIMESTAMP_LEN];

void init() {
    Serial.begin(LOG_SERIAL_BAUD);
    delay(50);
}

const char* get_timestamp() {
    uint32_t ms = millis();
    uint32_t s = ms / 1000;
    uint32_t h = (s / 3600) % 24;
    uint32_t m = (s / 60) % 60;
    uint32_t sec = s % 60;
    uint32_t ms_rem = ms % 1000;
    snprintf(timestamp_buffer, sizeof(timestamp_buffer), "%02lu:%02lu:%02lu.%03lu", h, m, sec, ms_rem);
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
    // Compile-time filter already applied by macros; runtime filter omitted.
    char fmtbuf[LOG_FORMAT_BUFFER_SIZE];
    int n = vsnprintf(fmtbuf, sizeof(fmtbuf), format, args);
    if (n < 0) fmtbuf[0] = '\0';

    const char* ts = get_timestamp();

    snprintf(message_buffer, sizeof(message_buffer), "[%s] %s [%c] %s\n",
             ts, severity_to_string(severity), tag, fmtbuf);
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

} // namespace Logger


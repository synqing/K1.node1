#pragma once

#include <Arduino.h>

enum class ConnectionState : uint8_t {
    Idle = 0,
    WifiConnecting,
    WifiConnected,
    Recovering,
    Error
};

struct ConnectionDiagnostics {
    ConnectionState current_state;
    uint32_t state_duration_ms;
    uint32_t recovery_count;
    bool watchdog_active;
    uint32_t watchdog_remaining_ms;
    char watchdog_context[64];
};

void connection_state_init();
void connection_state_transition(ConnectionState new_state, const char* reason);
ConnectionState connection_state_current();
const char* connection_state_name(ConnectionState state);

void connection_logf(const char* level, const char* fmt, ...);

void connection_watchdog_start(uint32_t timeout_ms, const char* context);
void connection_watchdog_feed(uint32_t timeout_ms, const char* context);
void connection_watchdog_stop();
bool connection_watchdog_check(uint32_t now_ms, char* out_context, size_t context_len);

void connection_record_recovery();
void connection_get_diagnostics(ConnectionDiagnostics& out_diag);

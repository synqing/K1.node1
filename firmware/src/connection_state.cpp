#include "connection_state.h"

#include <cstdarg>
#include <cstdio>
#include <cstring>

struct ConnectionStateContext {
    ConnectionState state = ConnectionState::Idle;
    uint32_t last_transition_ms = 0;
    uint32_t recovery_count = 0;

    bool watchdog_active = false;
    uint32_t watchdog_deadline_ms = 0;
    char watchdog_context[64] = {0};
};

static ConnectionStateContext& ctx() {
    static ConnectionStateContext instance;
    return instance;
}

static void log_transition(ConnectionState new_state, const char* reason) {
    connection_logf("INFO", "State -> %s%s%s",
        connection_state_name(new_state),
        (reason && reason[0]) ? " | " : "",
        (reason && reason[0]) ? reason : "");
}

void connection_logf(const char* level, const char* fmt, ...) {
    if (level == nullptr) {
        level = "LOG";
    }

    char message[192];
    va_list args;
    va_start(args, fmt);
    vsnprintf(message, sizeof(message), fmt, args);
    va_end(args);

    printf("[CONN][%s] %s\n", level, message);
}

void connection_state_init() {
    ConnectionStateContext& state = ctx();
    state.state = ConnectionState::Idle;
    state.last_transition_ms = millis();
    state.watchdog_active = false;
    memset(state.watchdog_context, 0, sizeof(state.watchdog_context));
    connection_logf("INFO", "Connection state initialised");
}

void connection_state_transition(ConnectionState new_state, const char* reason) {
    ConnectionStateContext& state = ctx();
    if (state.state == new_state) {
        if (reason && reason[0]) {
            connection_logf("DEBUG", "State %s reaffirmed: %s", connection_state_name(new_state), reason);
        }
        return;
    }

    state.state = new_state;
    state.last_transition_ms = millis();
    log_transition(new_state, reason);
}

ConnectionState connection_state_current() {
    return ctx().state;
}

const char* connection_state_name(ConnectionState state) {
    switch (state) {
        case ConnectionState::Idle: return "Idle";
        case ConnectionState::WifiConnecting: return "WiFiConnecting";
        case ConnectionState::WifiConnected: return "WiFiConnected";
        case ConnectionState::Recovering: return "Recovering";
        case ConnectionState::Error: return "Error";
        default: return "Unknown";
    }
}

void connection_watchdog_start(uint32_t timeout_ms, const char* context) {
    ConnectionStateContext& state = ctx();
    state.watchdog_active = true;
    state.watchdog_deadline_ms = millis() + timeout_ms;
    if (context != nullptr) {
        strncpy(state.watchdog_context, context, sizeof(state.watchdog_context) - 1);
        state.watchdog_context[sizeof(state.watchdog_context) - 1] = '\0';
    }
    connection_logf("DEBUG", "Watchdog armed (%lums) - %s", timeout_ms,
        state.watchdog_context[0] ? state.watchdog_context : "no context");
}

void connection_watchdog_feed(uint32_t timeout_ms, const char* context) {
    ConnectionStateContext& state = ctx();
    if (!state.watchdog_active) {
        return;
    }

    state.watchdog_deadline_ms = millis() + timeout_ms;
    if (context != nullptr) {
        strncpy(state.watchdog_context, context, sizeof(state.watchdog_context) - 1);
        state.watchdog_context[sizeof(state.watchdog_context) - 1] = '\0';
    }
}

void connection_watchdog_stop() {
    ConnectionStateContext& state = ctx();
    if (state.watchdog_active) {
        connection_logf("DEBUG", "Watchdog disarmed");
    }
    state.watchdog_active = false;
    memset(state.watchdog_context, 0, sizeof(state.watchdog_context));
}

bool connection_watchdog_check(uint32_t now_ms, char* out_context, size_t context_len) {
    ConnectionStateContext& state = ctx();
    if (!state.watchdog_active) {
        return false;
    }

    if (now_ms < state.watchdog_deadline_ms) {
        return false;
    }

    if (out_context != nullptr && context_len > 0) {
        strncpy(out_context, state.watchdog_context, context_len - 1);
        out_context[context_len - 1] = '\0';
    }
    state.watchdog_active = false;
    return true;
}

void connection_record_recovery() {
    ConnectionStateContext& state = ctx();
    state.recovery_count += 1;
    connection_logf("WARN", "Recovery triggered (%lu total)", (unsigned long)state.recovery_count);
}

void connection_get_diagnostics(ConnectionDiagnostics& out_diag) {
    ConnectionStateContext& state = ctx();
    out_diag.current_state = state.state;
    out_diag.state_duration_ms = millis() - state.last_transition_ms;
    out_diag.recovery_count = state.recovery_count;
    out_diag.watchdog_active = state.watchdog_active;
    if (state.watchdog_active) {
        uint32_t now = millis();
        out_diag.watchdog_remaining_ms = (state.watchdog_deadline_ms > now) ? (state.watchdog_deadline_ms - now) : 0;
        strncpy(out_diag.watchdog_context, state.watchdog_context, sizeof(out_diag.watchdog_context) - 1);
        out_diag.watchdog_context[sizeof(out_diag.watchdog_context) - 1] = '\0';
    } else {
        out_diag.watchdog_remaining_ms = 0;
        out_diag.watchdog_context[0] = '\0';
    }
}

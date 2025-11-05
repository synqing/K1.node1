// ========================================================================================
//
// webserver_rate_limiter.h
//
// Per-route rate limiting for REST API endpoints
// Prevents client-side flooding of control endpoints (brightness, pattern select, etc.)
//
// ========================================================================================

#pragma once

#include <cstring>
#include <cstdint>
#include <freertos/FreeRTOS.h>

// Method-aware rate limiting
enum RouteMethod { ROUTE_GET = 0, ROUTE_POST = 1 };

struct RouteWindow {
    const char* path;
    RouteMethod method;
    uint32_t window_ms;    // Rate limit window in milliseconds
    uint32_t last_ms;      // Last request timestamp for this route
};

// Route key constants (extend here for future endpoints)
static const char* ROUTE_PARAMS = "/api/params";
static const char* ROUTE_WIFI_LINK_OPTIONS = "/api/wifi/link-options";
static const char* ROUTE_SELECT = "/api/select";
static const char* ROUTE_AUDIO_CONFIG = "/api/audio-config";
static const char* ROUTE_RESET = "/api/reset";
static const char* ROUTE_METRICS = "/metrics";
static const char* ROUTE_PATTERNS = "/api/patterns";
static const char* ROUTE_PALETTES = "/api/palettes";
static const char* ROUTE_DEVICE_INFO = "/api/device/info";
static const char* ROUTE_HEALTH = "/api/health";
static const char* ROUTE_TEST_CONNECTION = "/api/test-connection";
static const char* ROUTE_DEVICE_PERFORMANCE = "/api/device/performance";
static const char* ROUTE_CONFIG_BACKUP = "/api/config/backup";
static const char* ROUTE_CONFIG_RESTORE = "/api/config/restore";
static const char* ROUTE_DIAG = "/api/diag";
static const char* ROUTE_BEAT_EVENTS_INFO = "/api/beat-events/info";
static const char* ROUTE_LATENCY_PROBE = "/api/latency/probe";
static const char* ROUTE_BEAT_EVENTS_RECENT = "/api/beat-events/recent";
static const char* ROUTE_BEAT_EVENTS_DUMP = "/api/beat-events/dump";
static const char* ROUTE_LED_TX_INFO = "/api/led-tx/info";
static const char* ROUTE_LED_TX_RECENT = "/api/led-tx/recent";
static const char* ROUTE_LED_TX_DUMP = "/api/led-tx/dump";
static const char* ROUTE_LATENCY_ALIGN = "/api/latency/align";
static const char* ROUTE_AUDIO_TEMPO = "/api/audio/tempo";
static const char* ROUTE_AUDIO_SNAPSHOT = "/api/audio/snapshot";
static const char* ROUTE_AUDIO_ARRAYS = "/api/audio/arrays";
static const char* ROUTE_AUDIO_METRICS = "/api/audio/metrics";
static const char* ROUTE_AUDIO_NOISE_CAL = "/api/audio/noise-calibrate";
static const char* ROUTE_WIFI_STATUS = "/api/wifi/status";
static const char* ROUTE_WIFI_CREDENTIALS = "/api/wifi/credentials";
static const char* ROUTE_WIFI_SCAN = "/api/wifi/scan";
static const char* ROUTE_PATTERN_CURRENT = "/api/pattern/current";
static const char* ROUTE_REALTIME_CONFIG = "/api/realtime/config";
static const char* ROUTE_LED_FRAME = "/api/leds/frame";

// Spinlock for protecting rate limiter state against concurrent access
// Prevents race condition where two requests could both pass the rate limit check
static portMUX_TYPE rate_limiter_spinlock = portMUX_INITIALIZER_UNLOCKED;

// Per-route windows; GET requests are not rate limited by default
static RouteWindow control_windows[] = {
    {ROUTE_PARAMS, ROUTE_POST, 300, 0},
    {ROUTE_WIFI_LINK_OPTIONS, ROUTE_POST, 300, 0},
    {ROUTE_SELECT, ROUTE_POST, 200, 0},
    {ROUTE_AUDIO_CONFIG, ROUTE_POST, 300, 0},
    {ROUTE_RESET, ROUTE_POST, 1000, 0},
    {ROUTE_DIAG, ROUTE_POST, 300, 0},
    {ROUTE_METRICS, ROUTE_GET, 200, 0},
    {ROUTE_PARAMS, ROUTE_GET, 150, 0},
    {ROUTE_AUDIO_CONFIG, ROUTE_GET, 500, 0},
    {ROUTE_DIAG, ROUTE_GET, 200, 0},
    {ROUTE_WIFI_LINK_OPTIONS, ROUTE_GET, 500, 0},
    {ROUTE_WIFI_CREDENTIALS, ROUTE_GET, 500, 0},
    {ROUTE_PATTERNS, ROUTE_GET, 1000, 0},
    {ROUTE_PALETTES, ROUTE_GET, 2000, 0},
    {ROUTE_DEVICE_INFO, ROUTE_GET, 1000, 0},
    {ROUTE_TEST_CONNECTION, ROUTE_GET, 200, 0},
    {ROUTE_HEALTH, ROUTE_GET, 200, 0},
    {ROUTE_DEVICE_PERFORMANCE, ROUTE_GET, 500, 0},
    {ROUTE_CONFIG_BACKUP, ROUTE_GET, 2000, 0},
    {ROUTE_CONFIG_RESTORE, ROUTE_POST, 2000, 0},
{ROUTE_BEAT_EVENTS_INFO, ROUTE_GET, 200, 0},
{ROUTE_LATENCY_PROBE, ROUTE_GET, 200, 0},
{ROUTE_BEAT_EVENTS_RECENT, ROUTE_GET, 300, 0},
{ROUTE_BEAT_EVENTS_DUMP, ROUTE_GET, 500, 0},
{ROUTE_LED_TX_INFO, ROUTE_GET, 200, 0},
{ROUTE_LED_TX_RECENT, ROUTE_GET, 300, 0},
{ROUTE_LED_TX_DUMP, ROUTE_GET, 500, 0},
{ROUTE_LATENCY_ALIGN, ROUTE_GET, 200, 0},
    {ROUTE_AUDIO_TEMPO, ROUTE_GET, 200, 0},
    {ROUTE_AUDIO_SNAPSHOT, ROUTE_GET, 300, 0},
    {ROUTE_AUDIO_ARRAYS, ROUTE_GET, 200, 0},
    {ROUTE_AUDIO_METRICS, ROUTE_GET, 200, 0},
    {ROUTE_WIFI_STATUS, ROUTE_GET, 500, 0},
    {ROUTE_PATTERN_CURRENT, ROUTE_GET, 200, 0},
    {ROUTE_REALTIME_CONFIG, ROUTE_GET, 200, 0},
    {ROUTE_REALTIME_CONFIG, ROUTE_POST, 300, 0},
    {ROUTE_LED_FRAME, ROUTE_GET, 200, 0},
    {ROUTE_WIFI_CREDENTIALS, ROUTE_POST, 1500, 0},
    {ROUTE_WIFI_SCAN, ROUTE_POST, 5000, 0},  // WiFi scanning takes time; 5 second rate limit
    {ROUTE_AUDIO_NOISE_CAL, ROUTE_POST, 1000, 0},
};

/**
 * Check if a route is rate limited and update the rate limiter state
 *
 * Returns true if the route is currently rate limited (should reject with 429)
 * Returns false if the route is allowed (update last_ms and allow request)
 *
 * @param path Route path (e.g., "/api/params")
 * @param method HTTP method (ROUTE_GET or ROUTE_POST)
 * @param out_window_ms Optional: pointer to receive the rate limit window in ms
 * @param out_next_allowed_ms Optional: pointer to receive milliseconds until next allowed request
 * @return true if rate limited, false if allowed
 */
static bool route_is_rate_limited(
    const char* path,
    RouteMethod method,
    uint32_t* out_window_ms = nullptr,
    uint32_t* out_next_allowed_ms = nullptr
) {
    uint32_t now = millis();

    // Search for this route in the control_windows array
    for (size_t i = 0; i < sizeof(control_windows)/sizeof(control_windows[0]); ++i) {
        RouteWindow& w = control_windows[i];
        if (strcmp(w.path, path) == 0 && w.method == method) {
            // Found matching route configuration
            if (w.window_ms == 0) {
                // Rate limiting disabled for this route (0ms = no limit)
                if (out_window_ms) *out_window_ms = 0;
                if (out_next_allowed_ms) *out_next_allowed_ms = 0;
                return false;
            }

            // SECURITY FIX: Critical section to prevent TOCTOU race condition
            // Two concurrent requests must not both pass the rate limit check
            portENTER_CRITICAL(&rate_limiter_spinlock);

            // Check if within rate limit window
            bool is_limited = (w.last_ms != 0 && (now - w.last_ms) < w.window_ms);

            if (is_limited) {
                // RATE LIMITED: too soon since last request
                uint32_t remaining = (w.last_ms + w.window_ms > now) ? (w.last_ms + w.window_ms - now) : 0;
                portEXIT_CRITICAL(&rate_limiter_spinlock);

                if (out_window_ms) *out_window_ms = w.window_ms;
                if (out_next_allowed_ms) *out_next_allowed_ms = remaining;
                return true;  // This request is rate limited
            }

            // Not limited; update last_ms and allow this request
            w.last_ms = now;
            portEXIT_CRITICAL(&rate_limiter_spinlock);

            if (out_window_ms) *out_window_ms = w.window_ms;
            if (out_next_allowed_ms) *out_next_allowed_ms = 0;
            return false;  // This request is allowed
        }
    }

    // Route not found in control_windows array
    // Default: GET requests are unlimited; unknown POST routes treated as unlimited unless configured
    if (method == ROUTE_GET) {
        if (out_window_ms) *out_window_ms = 0;
        if (out_next_allowed_ms) *out_next_allowed_ms = 0;
        return false;
    }

    // Unknown POST route - no rate limiting by default
    if (out_window_ms) *out_window_ms = 0;
    if (out_next_allowed_ms) *out_next_allowed_ms = 0;
    return false;
}

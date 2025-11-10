# Error Code Registry Implementation Guide

**Title:** Integration Checklist & Code Examples
**Version:** 1.0
**Date:** 2025-11-10
**Companion to:** ERROR_CODE_REGISTRY_DESIGN.md

---

## Quick Start

### For Firmware Engineers

1. **Include error codes:**
   ```cpp
   #include "error_codes.h"
   ```

2. **Report an error:**
   ```cpp
   const ErrorMetadata* meta = error_lookup(ERR_I2S_READ_TIMEOUT);
   LOG_ERROR(TAG_I2S, "Error %d: %s", meta->code, meta->name);
   record_error(ERR_I2S_READ_TIMEOUT);
   ```

3. **Send via REST:**
   ```cpp
   char error_json[512];
   error_to_json(ERR_I2S_READ_TIMEOUT, error_json, sizeof(error_json));
   ctx.sendJson(500, error_json);
   ```

### For Web Developers

1. **Handle error responses:**
   ```typescript
   const response = await fetch('/api/pattern/select', {
       method: 'POST',
       body: JSON.stringify({ id: patternId })
   });
   const error = await response.json();
   const errorCode = error.error.code;  // e.g., 47 (ERR_JSON_PARSE_FAILED)
   ```

2. **Map error codes to user messages:**
   ```typescript
   const errorMessages: Record<number, string> = {
       47: "Invalid pattern data. Check JSON syntax.",
       50: "Pattern ID out of valid range.",
       // ... etc
   };
   ```

---

## Detailed Integration Examples

### Example 1: WiFi Subsystem

**File:** `firmware/src/wifi_monitor.cpp`

**Current Implementation (Baseline):**
```cpp
void on_wifi_status_change() {
    wl_status_t status = WiFi.status();
    if (status == last_status) return;

    switch (status) {
        case WL_CONNECTED:
            connection_logf("INFO", "Connected to WiFi");
            break;

        case WL_DISCONNECTED:
            connection_logf("ERROR", "WiFi connection lost");
            schedule_reconnect("Lost connection", WIFI_RECONNECT_INTERVAL_MS);
            break;

        case WL_NO_SSID_AVAIL:
            connection_logf("ERROR", "SSID '%s' not found", stored_ssid);
            schedule_reconnect("SSID not found", WIFI_RECONNECT_INTERVAL_MS);
            break;

        case WL_CONNECT_FAILED:
            connection_logf("ERROR", "Failed to connect to SSID '%s'", stored_ssid);
            schedule_reconnect("Failed to connect", WIFI_RECONNECT_INTERVAL_MS);
            break;

        default:
            connection_logf("ERROR", "Unhandled WiFi status: %d", (int)status);
            break;
    }

    last_status = status;
}
```

**Enhanced with Error Codes:**
```cpp
#include "error_codes.h"

// Track error context for WiFi
static struct {
    uint8_t last_error_code = ERR_OK;
    uint32_t last_error_time_ms = 0;
    uint32_t consecutive_failures = 0;
} wifi_error_state;

void on_wifi_status_change() {
    wl_status_t status = WiFi.status();
    if (status == last_status) return;

    uint8_t error_code = ERR_OK;
    uint32_t now_ms = millis();

    switch (status) {
        case WL_CONNECTED:
            LOG_INFO(TAG_WIFI, "Connected to WiFi");
            error_code = ERR_OK;
            wifi_error_state.consecutive_failures = 0;
            break;

        case WL_DISCONNECTED:
            error_code = ERR_WIFI_LINK_LOST;
            LOG_ERROR_CODE(TAG_WIFI, error_code, "Reconnecting...");
            wifi_error_state.consecutive_failures++;
            schedule_reconnect_with_backoff();
            break;

        case WL_NO_SSID_AVAIL:
            error_code = ERR_WIFI_SSID_NOT_FOUND;
            LOG_ERROR_CODE(TAG_WIFI, error_code, "SSID: %s", stored_ssid);
            // Recovery: user must fix SSID or move closer to router
            break;

        case WL_CONNECT_FAILED:
            // Distinguish auth vs. timeout by duration
            if (now_ms - wifi_connect_start_ms > 30000) {
                error_code = ERR_WIFI_CONNECT_TIMEOUT;
            } else {
                // Could be auth failure or other reason
                // Try password next, then give up
                error_code = ERR_WIFI_AUTH_FAILED;  // Assumption
            }
            LOG_ERROR_CODE(TAG_WIFI, error_code, "Connection failed");
            wifi_error_state.consecutive_failures++;
            break;

        default:
            error_code = ERR_UNKNOWN;
            LOG_ERROR_CODE(TAG_WIFI, error_code, "Unhandled status: %d", (int)status);
            break;
    }

    // Record error in history
    if (error_code != ERR_OK) {
        record_error(error_code);
        wifi_error_state.last_error_code = error_code;
        wifi_error_state.last_error_time_ms = now_ms;

        // Report via telemetry endpoint (will be added in Phase 3)
        // POST to /api/telemetry/error with error metadata
    }

    last_status = status;
}

// Backoff retry strategy based on error type
void schedule_reconnect_with_backoff() {
    const ErrorMetadata* meta = error_lookup(wifi_error_state.last_error_code);

    if (meta->recovery == ERR_ACTION_RETRY) {
        uint32_t backoff_ms = WIFI_RECONNECT_INTERVAL_MS * (1 + wifi_error_state.consecutive_failures);
        backoff_ms = MIN(backoff_ms, 60000);  // Cap at 60 seconds

        LOG_INFO(TAG_WIFI, "Retrying in %lu ms (attempt %u)",
                 backoff_ms, wifi_error_state.consecutive_failures);

        schedule_reconnect("Retry after backoff", backoff_ms);
    } else if (meta->recovery == ERR_ACTION_LOG) {
        // User intervention needed; don't auto-retry
        LOG_WARN(TAG_WIFI, "WiFi error requires manual intervention. Entering AP mode.");
        start_ap_fallback();
    }
}

// Macro helper for cleaner logging
#define LOG_ERROR_CODE(tag, error_code, fmt, ...) \
    do { \
        const ErrorMetadata* _meta = error_lookup(error_code); \
        if (_meta) { \
            LOG_ERROR(tag, "[%s] " fmt, _meta->name, ##__VA_ARGS__); \
        } else { \
            LOG_ERROR(tag, "[ERR_%d] " fmt, (int)(error_code), ##__VA_ARGS__); \
        } \
    } while(0)
```

---

### Example 2: I2S/Audio Timeout Protection

**File:** `firmware/src/audio/microphone.cpp`

**Current Implementation:**
```cpp
// Timeout protection: fallback to silence if no samples received
if (i2s_result == ESP_ERR_TIMEOUT) {
    i2s_timeout_state.last_error_code = ERR_I2S_READ_TIMEOUT;
    i2s_timeout_state.consecutive_timeouts++;

    if (i2s_timeout_state.consecutive_timeouts > CONSECUTIVE_TIMEOUT_LIMIT) {
        i2s_timeout_state.last_error_code = ERR_AUDIO_PROCESSING_STALLED;
        return false;
    }
    return true;  // Use silence as fallback
}
```

**Enhanced Version:**
```cpp
#include "error_codes.h"

// Audio state with error tracking
struct AudioState {
    uint8_t last_error_code;
    uint32_t error_count;
    uint32_t consecutive_timeouts;
    uint32_t last_error_time_ms;
} audio_state = {
    .last_error_code = ERR_OK,
    .error_count = 0,
    .consecutive_timeouts = 0,
    .last_error_time_ms = 0
};

// Constants
#define AUDIO_TIMEOUT_MS 500
#define CONSECUTIVE_TIMEOUT_LIMIT 10
#define AUDIO_ERROR_ESCALATION_TIME_MS 30000

bool read_audio_with_error_handling() {
    esp_err_t i2s_result = i2s_channel_read(rx_handle, samples, sample_bytes, &bytes_read, AUDIO_TIMEOUT_MS);

    if (i2s_result == ESP_OK) {
        // Success: clear error state
        audio_state.last_error_code = ERR_OK;
        audio_state.consecutive_timeouts = 0;
        return true;
    }

    if (i2s_result == ESP_ERR_TIMEOUT) {
        audio_state.last_error_code = ERR_I2S_READ_TIMEOUT;
        audio_state.consecutive_timeouts++;
        audio_state.error_count++;
        audio_state.last_error_time_ms = millis();

        // Log with severity and remediation
        LOG_EVERY_MS(TAG_I2S, LOG_LEVEL_WARN, 5000,
                     "[ERR_%d] I2S read timeout (consecutive: %u)",
                     ERR_I2S_READ_TIMEOUT,
                     audio_state.consecutive_timeouts);

        // Record error for telemetry
        record_error(ERR_I2S_READ_TIMEOUT);

        // Check escalation: if many timeouts over time, escalate to stalled error
        if (audio_state.consecutive_timeouts >= CONSECUTIVE_TIMEOUT_LIMIT) {
            audio_state.last_error_code = ERR_AUDIO_PROCESSING_STALLED;
            LOG_ERROR(TAG_I2S, "[ERR_AUDIO_PROCESSING_STALLED] Too many consecutive timeouts");
            record_error(ERR_AUDIO_PROCESSING_STALLED);

            // Trigger recovery action for STALLED
            const ErrorMetadata* meta = error_lookup(ERR_AUDIO_PROCESSING_STALLED);
            if (meta && meta->recovery == ERR_ACTION_RESET) {
                restart_audio_pipeline();
                return false;
            }
        }

        // Fallback: use silence instead of real audio
        memset(samples, 0, sample_bytes);
        return true;  // Continue with silence
    }

    if (i2s_result == ESP_ERR_INVALID_STATE) {
        audio_state.last_error_code = ERR_I2S_CONFIG_INVALID;
        LOG_ERROR(TAG_I2S, "[ERR_I2S_CONFIG_INVALID] I2S not configured correctly");
        record_error(ERR_I2S_CONFIG_INVALID);
        return false;
    }

    // Other I2S errors
    audio_state.last_error_code = ERR_I2S_INIT_FAILED;  // Generic
    LOG_ERROR(TAG_I2S, "[ERR_I2S_INIT_FAILED] I2S error code: %s (0x%x)",
              esp_err_to_name(i2s_result), i2s_result);
    record_error(ERR_I2S_INIT_FAILED);
    return false;
}

// Function to report audio errors via REST endpoint
void audio_get_error_status(JsonDocument& doc) {
    doc["last_error_code"] = audio_state.last_error_code;
    doc["error_count"] = audio_state.error_count;
    doc["consecutive_timeouts"] = audio_state.consecutive_timeouts;

    const ErrorMetadata* meta = error_lookup(audio_state.last_error_code);
    if (meta) {
        doc["error_name"] = meta->name;
        doc["error_severity"] = error_severity_to_string(meta->severity);
        doc["error_recovery"] = error_action_to_string(meta->recovery);
    }
}
```

**REST Endpoint Handler:**
```cpp
// In webserver.cpp: GET /api/device/audio-status
class GetAudioStatusHandler : public K1RequestHandler {
public:
    GetAudioStatusHandler() : K1RequestHandler("/api/device/audio-status", ROUTE_GET) {}

    void handle(RequestContext& ctx) override {
        StaticJsonDocument<512> doc;

        doc["active"] = is_audio_active();
        doc["sample_rate"] = AUDIO_SAMPLE_RATE;

        audio_get_error_status(doc);

        String json;
        serializeJson(doc, json);
        ctx.sendJson(200, json);
    }
};
```

---

### Example 3: RMT/LED Dual-Channel Error Handling

**File:** `firmware/src/led_driver.h`

**Current Implementation:**
```cpp
// Synchronized dual-RMT transmit
uint32_t t0 = micros();
g_last_led_tx_us.store(t0, std::memory_order_relaxed);

esp_err_t tx_ret = rmt_transmit(tx_chan, led_encoder, raw_led_data, len1, &tx_config);
esp_err_t tx_ret_2 = rmt_transmit(tx_chan_2, led_encoder_2, raw_led_data_ch2, len2, &tx_config);

if (tx_ret != ESP_OK) {
    LOG_WARN(TAG_LED, "rmt_transmit error (ch1): %d", (int)tx_ret);
}
if (tx_ret_2 != ESP_OK) {
    LOG_WARN(TAG_LED, "rmt_transmit error (ch2): %d", (int)tx_ret_2);
}
```

**Enhanced with Error Codes:**
```cpp
#include "../error_codes.h"

struct RmtErrorState {
    uint8_t last_error_code;
    uint32_t last_error_time_ms;
    uint32_t transmit_error_count;
    uint32_t sync_failure_count;
    uint32_t max_channel_spacing_us;  // Measurement for sync quality
};

static RmtErrorState rmt_state = {ERR_OK, 0, 0, 0, 0};

// Synchronized dual-channel transmit with error reporting
bool led_transmit_synchronized(const uint8_t* data_ch1, size_t len1,
                                const uint8_t* data_ch2, size_t len2) {
    uint8_t error_code = ERR_OK;
    uint32_t now_ms = millis();

    // Wait for previous transmissions to complete (bounded timeout)
    esp_err_t wait_ret1 = rmt_tx_wait_all_done(tx_chan, pdMS_TO_TICKS(8));
    esp_err_t wait_ret2 = rmt_tx_wait_all_done(tx_chan_2, pdMS_TO_TICKS(8));

    if (wait_ret1 != ESP_OK || wait_ret2 != ESP_OK) {
        // Previous transmission still pending (timeout)
        error_code = ERR_RMT_TRANSMIT_TIMEOUT;
        LOG_WARN(TAG_LED, "[ERR_RMT_TRANSMIT_TIMEOUT] Previous TX still pending");
        rmt_state.last_error_code = error_code;
        return false;
    }

    // Measure timing of back-to-back starts
    uint32_t t_start = micros();

    // Start both channels back-to-back
    esp_err_t tx_ret1 = rmt_transmit(tx_chan, led_encoder, data_ch1, len1, &tx_config);
    uint32_t t_ch1_start = micros();

    esp_err_t tx_ret2 = rmt_transmit(tx_chan_2, led_encoder_2, data_ch2, len2, &tx_config);
    uint32_t t_ch2_start = micros();

    uint32_t spacing_us = t_ch2_start - t_ch1_start;

    // Record timing for telemetry
    rmt_state.max_channel_spacing_us = MAX(rmt_state.max_channel_spacing_us, spacing_us);

    // Check for transmit errors
    if (tx_ret1 != ESP_OK) {
        error_code = (tx_ret1 == ESP_ERR_NO_MEM) ? ERR_RMT_DMA_ALLOC_FAILED
                                                  : ERR_RMT_TRANSMIT_TIMEOUT;
        LOG_ERROR(TAG_LED, "[%d] Channel 1 transmit failed: %s",
                  error_code, esp_err_to_name(tx_ret1));
        rmt_state.transmit_error_count++;
    }

    if (tx_ret2 != ESP_OK) {
        error_code = (tx_ret2 == ESP_ERR_NO_MEM) ? ERR_RMT_DMA_ALLOC_FAILED
                                                  : ERR_RMT_TRANSMIT_TIMEOUT;
        LOG_ERROR(TAG_LED, "[%d] Channel 2 transmit failed: %s",
                  error_code, esp_err_to_name(tx_ret2));
        rmt_state.transmit_error_count++;
    }

    // Check sync quality: spacing should be <10µs
    if (spacing_us > 10) {
        error_code = ERR_RMT_DUAL_CHANNEL_SYNC_FAIL;
        LOG_WARN(TAG_LED, "[%d] Sync spacing too large: %lu µs (limit: 10)",
                 error_code, spacing_us);
        rmt_state.sync_failure_count++;
    }

    // Record errors in history
    if (error_code != ERR_OK) {
        rmt_state.last_error_code = error_code;
        rmt_state.last_error_time_ms = now_ms;
        record_error(error_code);

        // Take recovery action
        const ErrorMetadata* meta = error_lookup(error_code);
        if (meta && meta->recovery == ERR_ACTION_FALLBACK) {
            // Fallback: transmit channel 1 only
            LOG_INFO(TAG_LED, "Falling back to single-channel mode");
            // ... switch to single-channel configuration
        }
    }

    return (error_code == ERR_OK);
}

// Telemetry endpoint: GET /api/rmt
void rmt_get_status(JsonDocument& doc) {
    doc["last_error_code"] = rmt_state.last_error_code;
    doc["transmit_error_count"] = rmt_state.transmit_error_count;
    doc["sync_failure_count"] = rmt_state.sync_failure_count;
    doc["max_channel_spacing_us"] = rmt_state.max_channel_spacing_us;

    // Reset max spacing counter for trending
    rmt_state.max_channel_spacing_us = 0;

    const ErrorMetadata* meta = error_lookup(rmt_state.last_error_code);
    if (meta) {
        doc["error_name"] = meta->name;
    }
}
```

---

### Example 4: WebServer Request Bounds Checking

**File:** `firmware/src/webserver_bounds.h` + handler integration

**Current Implementation:**
```cpp
#define ERR_HTTP_BODY_TOO_LARGE         44
#define ERR_HTTP_HEADER_OVERFLOW        45
#define ERR_HTTP_QUERY_PARAM_OVERFLOW   46

uint8_t bounds_check_http_body(size_t body_size) {
    if (body_size > MAX_HTTP_REQUEST_BODY_SIZE) {
        return ERR_HTTP_BODY_TOO_LARGE;
    }
    return ERR_OK;
}
```

**Enhanced Handler:**
```cpp
// In webserver.cpp request handler
class K1PostBodyHandler {
private:
    K1RequestHandler* handler;
    size_t accumulated_size = 0;

public:
    void operator()(AsyncWebServerRequest* request, uint8_t* data, size_t len,
                    size_t index, size_t total) {
        accumulated_size += len;

        // Check body size limit
        uint8_t bounds_error = bounds_check_http_body(accumulated_size);
        if (bounds_error != ERR_OK) {
            LOG_ERROR_CODE(TAG_WEB, bounds_error,
                           "Request body exceeds limit: %u > %u",
                           accumulated_size, MAX_HTTP_REQUEST_BODY_SIZE);
            record_error(bounds_error);

            // Return error response
            char error_json[256];
            error_to_json(bounds_error, error_json, sizeof(error_json));

            auto* resp = request->beginResponse(413, "application/json", error_json);
            request->send(resp);
            return;
        }

        // Accumulate body... (rest of handler)
    }
};

// Also check headers and query params
if (request->headers() > MAX_HTTP_HEADER_COUNT) {
    uint8_t error_code = ERR_HTTP_HEADER_OVERFLOW;
    LOG_ERROR_CODE(TAG_WEB, error_code,
                   "Too many headers: %u > %u",
                   request->headers(), MAX_HTTP_HEADER_COUNT);
    record_error(error_code);
    // ... send error response
}
```

---

### Example 5: Global Error History Buffer

**File:** `firmware/src/error_tracking.h` (new file)

```cpp
#pragma once

#include "error_codes.h"
#include <stdint.h>
#include <cstring>

#define ERROR_HISTORY_SIZE 100

typedef struct {
    uint8_t error_code;
    uint32_t timestamp_ms;
    const char* subsystem;  // "WiFi", "I2S", "RMT", etc.
} ErrorRecord;

class ErrorHistory {
private:
    static ErrorRecord history[ERROR_HISTORY_SIZE];
    static uint16_t write_index;
    static uint32_t total_error_count;

public:
    // Record an error
    static void record(uint8_t error_code, const char* subsystem) {
        uint16_t idx = write_index % ERROR_HISTORY_SIZE;

        history[idx].error_code = error_code;
        history[idx].timestamp_ms = millis();
        history[idx].subsystem = subsystem;

        write_index++;
        total_error_count++;
    }

    // Get last N errors
    static void get_recent(uint16_t count, JsonDocument& doc) {
        JsonArray recent = doc.createNestedArray("recent");

        uint16_t start_idx = (write_index > count) ? (write_index - count) : 0;

        for (uint16_t i = start_idx; i < write_index; i++) {
            uint16_t idx = i % ERROR_HISTORY_SIZE;
            const ErrorRecord& rec = history[idx];
            const ErrorMetadata* meta = error_lookup(rec.error_code);

            JsonObject err = recent.createNestedObject();
            err["code"] = rec.error_code;
            err["name"] = meta ? meta->name : "UNKNOWN";
            err["subsystem"] = rec.subsystem;
            err["timestamp_ms"] = rec.timestamp_ms;
            err["age_ms"] = millis() - rec.timestamp_ms;
        }
    }

    // Get summary statistics
    static void get_summary(uint32_t time_window_ms, JsonDocument& doc) {
        uint32_t now = millis();
        uint16_t count_in_window = 0;
        uint16_t critical_count = 0;
        uint16_t high_count = 0;

        for (uint16_t i = 0; i < ERROR_HISTORY_SIZE; i++) {
            uint32_t age = now - history[i].timestamp_ms;
            if (age < time_window_ms) {
                count_in_window++;

                const ErrorMetadata* meta = error_lookup(history[i].error_code);
                if (meta) {
                    if (meta->severity == ERR_SEV_CRITICAL) {
                        critical_count++;
                    } else if (meta->severity == ERR_SEV_HIGH) {
                        high_count++;
                    }
                }
            }
        }

        doc["total_count"] = total_error_count;
        doc["count_" + String(time_window_ms) + "ms"] = count_in_window;
        doc["critical_count"] = critical_count;
        doc["high_count"] = high_count;
    }

    static uint32_t get_total_count() {
        return total_error_count;
    }
};

// Global instance
extern ErrorHistory g_error_history;

// Convenience macro
#define RECORD_ERROR(code, subsystem) \
    do { \
        g_error_history.record(code, subsystem); \
        LOG_ERROR_CODE(TAG_CORE0, code, "[%s]", subsystem); \
    } while(0)
```

**Implementation file:**
```cpp
// error_tracking.cpp
ErrorRecord ErrorHistory::history[ERROR_HISTORY_SIZE] = {};
uint16_t ErrorHistory::write_index = 0;
uint32_t ErrorHistory::total_error_count = 0;

ErrorHistory g_error_history;
```

---

### Example 6: REST Endpoint for Error History

**File:** `firmware/src/webserver.cpp`

```cpp
// GET /api/errors/recent
class GetRecentErrorsHandler : public K1RequestHandler {
public:
    GetRecentErrorsHandler() : K1RequestHandler("/api/errors/recent", ROUTE_GET) {}

    void handle(RequestContext& ctx) override {
        StaticJsonDocument<2048> doc;
        doc["timestamp"] = millis();

        g_error_history.get_recent(20, doc);

        String json;
        serializeJson(doc, json);
        ctx.sendJson(200, json);
    }
};

// GET /api/errors/summary?window_ms=60000
class GetErrorSummaryHandler : public K1RequestHandler {
public:
    GetErrorSummaryHandler() : K1RequestHandler("/api/errors/summary", ROUTE_GET) {}

    void handle(RequestContext& ctx) override {
        // Parse window_ms query parameter (default 60000)
        uint32_t window_ms = 60000;
        if (ctx.request->hasArg("window_ms")) {
            window_ms = ctx.request->arg("window_ms").toInt();
        }

        StaticJsonDocument<512> doc;
        g_error_history.get_summary(window_ms, doc);

        String json;
        serializeJson(doc, json);
        ctx.sendJson(200, json);
    }
};

// Register handlers in setup_web_server()
void setup_web_server() {
    // ... existing handlers ...

    registerGetHandler(server, "/api/errors/recent", new GetRecentErrorsHandler());
    registerGetHandler(server, "/api/errors/summary", new GetErrorSummaryHandler());
}
```

---

## Testing Guide

### Unit Test Template

**File:** `firmware/test/test_error_codes.cpp`

```cpp
#include <unity.h>
#include "error_codes.h"

void setUp(void) {
    // Setup before each test
}

void tearDown(void) {
    // Cleanup after each test
}

void test_error_lookup_all_codes(void) {
    // Verify all 130 codes have valid metadata
    for (int code = 0; code < 130; code++) {
        const ErrorMetadata* meta = error_lookup(code);
        TEST_ASSERT_NOT_NULL_MESSAGE(meta, "Code missing metadata");
        TEST_ASSERT_EQUAL(meta->code, code);
        TEST_ASSERT_NOT_NULL(meta->name);
        TEST_ASSERT_NOT_NULL(meta->description);
        TEST_ASSERT_NOT_NULL(meta->cause);
        TEST_ASSERT_NOT_NULL(meta->remediation);
    }
}

void test_error_to_json_valid_output(void) {
    // Test JSON serialization
    char buf[512];
    int len = error_to_json(ERR_I2S_READ_TIMEOUT, buf, sizeof(buf));

    TEST_ASSERT_GREATER_THAN(0, len);
    TEST_ASSERT(strstr(buf, "\"error_code\":24") != NULL);
    TEST_ASSERT(strstr(buf, "\"name\":\"ERR_I2S_READ_TIMEOUT\"") != NULL);
    TEST_ASSERT(strstr(buf, "\"severity\":\"HIGH\"") != NULL);
}

void test_severity_to_string(void) {
    TEST_ASSERT_EQUAL_STRING("INFO", error_severity_to_string(ERR_SEV_INFO));
    TEST_ASSERT_EQUAL_STRING("LOW", error_severity_to_string(ERR_SEV_LOW));
    TEST_ASSERT_EQUAL_STRING("MEDIUM", error_severity_to_string(ERR_SEV_MEDIUM));
    TEST_ASSERT_EQUAL_STRING("HIGH", error_severity_to_string(ERR_SEV_HIGH));
    TEST_ASSERT_EQUAL_STRING("CRITICAL", error_severity_to_string(ERR_SEV_CRITICAL));
}

void test_error_codes_unique(void) {
    // Verify no duplicate error codes
    for (int i = 0; i < 130; i++) {
        for (int j = i + 1; j < 130; j++) {
            TEST_ASSERT_NOT_EQUAL_MESSAGE(
                g_error_metadata[i].code,
                g_error_metadata[j].code,
                "Duplicate error code found");
        }
    }
}

void test_error_history_recording(void) {
    // Test error history buffer
    for (int i = 0; i < 10; i++) {
        g_error_history.record(ERR_I2S_READ_TIMEOUT, "I2S");
    }

    uint32_t total = g_error_history.get_total_count();
    TEST_ASSERT_EQUAL(10, total);
}
```

### Integration Test Example

**Scenario:** WiFi disconnects → error recorded → endpoint returns history

```cpp
void test_wifi_error_recorded_in_history(void) {
    // Simulate WiFi disconnect
    uint8_t error_code = ERR_WIFI_LINK_LOST;
    g_error_history.record(error_code, "WiFi");

    // Query REST endpoint
    // GET /api/errors/recent
    // Expect: {"recent": [{"code": 15, "name": "ERR_WIFI_LINK_LOST", ...}]}

    StaticJsonDocument<512> doc;
    g_error_history.get_recent(1, doc);

    JsonArray recent = doc["recent"];
    TEST_ASSERT_EQUAL(1, recent.size());
    TEST_ASSERT_EQUAL(15, recent[0]["code"]);
    TEST_ASSERT_EQUAL_STRING("ERR_WIFI_LINK_LOST", recent[0]["name"]);
}
```

---

## Web Client Integration

### TypeScript Error Handling

**File:** `webapp/src/services/api.ts`

```typescript
import { ErrorMetadata } from './types';

// Error code enum (generated from firmware)
enum ErrorCode {
    ERR_OK = 0,
    ERR_UNKNOWN = 1,
    // ... (130 codes)
    ERR_I2S_READ_TIMEOUT = 24,
    ERR_WIFI_LINK_LOST = 15,
    ERR_JSON_PARSE_FAILED = 47,
}

interface ApiErrorResponse {
    error: ErrorMetadata;
}

class ApiError extends Error {
    public code: number;
    public severity: string;
    public recoveryAction: string;

    constructor(meta: ErrorMetadata) {
        super(meta.message);
        this.code = meta.code;
        this.severity = meta.severity;
        this.recoveryAction = meta.recovery_action;
    }
}

// Helper to parse error response
function parseErrorResponse(response: any): ApiError {
    if (response.error) {
        return new ApiError(response.error);
    }
    return new ApiError({
        code: response.status || 500,
        name: 'UNKNOWN_ERROR',
        message: response.statusText || 'Unknown error',
        severity: 'HIGH',
        recovery_action: 'LOG',
        cause: 'Unable to parse error response',
        remediation: 'Check device logs and try again'
    });
}

// API call with error handling
async function postPattern(patternId: number): Promise<void> {
    try {
        const response = await fetch('/api/pattern/select', {
            method: 'POST',
            body: JSON.stringify({ id: patternId }),
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const errorData = await response.json();
            const error = parseErrorResponse(errorData);

            // Handle specific error codes
            switch (error.code) {
                case ErrorCode.ERR_JSON_PARSE_FAILED:
                    console.error('JSON syntax error:', error.remediation);
                    showUserMessage('Invalid pattern data format');
                    break;

                case ErrorCode.ERR_PARAM_INVALID:
                    console.error('Pattern ID out of range:', error.remediation);
                    showUserMessage('Pattern ID not available');
                    break;

                case ErrorCode.ERR_SYSTEM_BUSY:
                    console.warn('Device busy, retrying...');
                    // Retry with backoff
                    await new Promise(r => setTimeout(r, 1000));
                    return postPattern(patternId);

                default:
                    if (error.severity === 'CRITICAL') {
                        showUserMessage('Device error: Please restart');
                    } else {
                        showUserMessage(error.message);
                    }
            }

            throw error;
        }

        const data = await response.json();
        console.log('Pattern selected:', data);

    } catch (error) {
        console.error('Failed to select pattern:', error);
        throw error;
    }
}

// Display error history from telemetry
async function fetchAndDisplayErrorHistory(): Promise<void> {
    try {
        const response = await fetch('/api/errors/recent');
        if (!response.ok) throw new Error('Failed to fetch error history');

        const data = await response.json();

        // Render in UI
        const errorList = data.recent.map((err: any) => ({
            code: err.code,
            name: err.name,
            subsystem: err.subsystem,
            age: formatAge(err.age_ms)
        }));

        renderErrorHistory(errorList);
    } catch (error) {
        console.error('Error fetching history:', error);
    }
}
```

---

## Deployment Checklist

- [ ] Compile firmware with error_codes.h/cpp
- [ ] Run unit tests: all 130 codes metadata valid
- [ ] Integration test: error recording works
- [ ] REST endpoints active: /api/errors/recent, /api/errors/summary
- [ ] Telemetry flowing: heartbeat includes error_code field
- [ ] Logging includes error metadata (name, severity)
- [ ] Web client handles error responses correctly
- [ ] Documentation updated with error code reference
- [ ] Support team trained on error code lookup

---

**End of Integration Guide**

// Async web server implementation
// Provides REST API for runtime parameter control and pattern switching

#include "webserver.h"
#include "led_tx_events.h"
#include "parameters.h"
#include "pattern_registry.h"
#include "audio/goertzel.h"  // For audio configuration (microphone gain)
#include "palettes.h"        // For palette metadata API
#include "wifi_monitor.h"    // For WiFi link options API
#include "connection_state.h" // For connection state reporting
#include <ArduinoJson.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include "profiler.h"        // For performance metrics (FPS, micro-timings)
#include "cpu_monitor.h"     // For CPU usage monitoring
#include "frame_metrics.h"   // For frame-level metrics
#include <AsyncWebSocket.h>  // For WebSocket real-time updates
#include "webserver_rate_limiter.h"        // Per-route rate limiting
#include "webserver_response_builders.h"  // JSON response building utilities
#include "webserver_request_handler.h"    // Request handler base class and context
#include "webserver_param_validator.h"    // Parameter validation utilities
#include <SPIFFS.h>                       // For serving static web files
#include "logging/logger.h"               // Centralized logging
#include "diagnostics.h"                  // Runtime diagnostics control
#include "beat_events.h"                  // Latency probe controls
#include "audio/tempo.h"                   // Tempo telemetry
#include "audio/validation/tempo_validation.h"  // PHASE 3: Tempo validation metrics
#include "diagnostics/rmt_probe.h"        // RMT telemetry
#include "led_driver.h"                    // Access LED raw frame buffer
#include "frame_metrics.h"                // Frame-level profiling history
// Debug telemetry defaults (compile-time overrides)
#ifndef REALTIME_WS_ENABLED_DEFAULT
#define REALTIME_WS_ENABLED_DEFAULT 1
#endif
#ifndef REALTIME_WS_DEFAULT_INTERVAL_MS
#define REALTIME_WS_DEFAULT_INTERVAL_MS 250
#endif

// Forward declaration: WebSocket event handler
static void onWebSocketEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len);

// Global async web server on port 80
static AsyncWebServer server(80);

// Global WebSocket server at /ws endpoint
static AsyncWebSocket ws("/ws");

// ============================================================================
// REQUEST HANDLERS - Phase 2B Refactoring
// ============================================================================

// GET /api/patterns - List all available patterns
class GetPatternsHandler : public K1RequestHandler {
public:
    GetPatternsHandler() : K1RequestHandler(ROUTE_PATTERNS, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        ctx.sendJson(200, build_patterns_json());
    }
};

// GET /api/params - Get current parameters
class GetParamsHandler : public K1RequestHandler {
public:
    GetParamsHandler() : K1RequestHandler(ROUTE_PARAMS, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        ctx.sendJson(200, build_params_json());
    }
};

// GET /api/palettes - List all available palettes
class GetPalettesHandler : public K1RequestHandler {
public:
    GetPalettesHandler() : K1RequestHandler(ROUTE_PALETTES, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        ctx.sendJson(200, build_palettes_json());
    }
};

// GET /api/device/info - Device information snapshot
class GetDeviceInfoHandler : public K1RequestHandler {
public:
    GetDeviceInfoHandler() : K1RequestHandler(ROUTE_DEVICE_INFO, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        StaticJsonDocument<384> doc;
        doc["device"] = "K1.reinvented";
        doc["uptime_ms"] = millis();
        doc["ip"] = WiFi.localIP().toString();
        doc["mac"] = WiFi.macAddress();
        // Build signature / environment fingerprint
        JsonObject build = doc.createNestedObject("build");
        #ifdef ARDUINO
        build["arduino"] = ARDUINO;
        #endif
        #ifdef ARDUINO_ESP32_RELEASE_3_0_0
        build["arduino_release"] = ARDUINO_ESP32_RELEASE_3_0_0;
        #endif
        #ifdef IDF_VER
        build["idf_ver"] = IDF_VER;
        #endif
        build["platformio_platform"] = "espressif32@6.12.0";
        build["framework"] = "arduino@3.20017.241212";

        String output;
        serializeJson(doc, output);
        ctx.sendJson(200, output);
    }
};

// GET /api/device/performance - Performance metrics (FPS, timings, heap)
class GetDevicePerformanceHandler : public K1RequestHandler {
public:
    GetDevicePerformanceHandler() : K1RequestHandler(ROUTE_DEVICE_PERFORMANCE, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        float frames = FRAMES_COUNTED.load(std::memory_order_relaxed) > 0
                         ? static_cast<float>(FRAMES_COUNTED.load(std::memory_order_relaxed))
                         : 1.0f;
        float avg_render_us = static_cast<float>(ACCUM_RENDER_US.load(std::memory_order_relaxed)) / frames;
        float avg_quantize_us = static_cast<float>(ACCUM_QUANTIZE_US.load(std::memory_order_relaxed)) / frames;
        float avg_rmt_wait_us = static_cast<float>(ACCUM_RMT_WAIT_US.load(std::memory_order_relaxed)) / frames;
        float avg_rmt_tx_us = static_cast<float>(ACCUM_RMT_TRANSMIT_US.load(std::memory_order_relaxed)) / frames;
        float frame_time_us = avg_render_us + avg_quantize_us + avg_rmt_wait_us + avg_rmt_tx_us;

        uint32_t heap_free = ESP.getFreeHeap();
        uint32_t heap_total = ESP.getHeapSize();
        float memory_percent = ((float)(heap_total - heap_free) / (float)heap_total) * 100.0f;

        // Ensure CPU monitor has a fresh sample before reporting
        // (safe to call; it internally handles timing windows)
        cpu_monitor.update();
        float cpu_percent = cpu_monitor.getAverageCPUUsage();

        StaticJsonDocument<512> doc;
        doc["fps"] = FPS_CPU;
        doc["frame_time_us"] = frame_time_us;
        // Detailed timings for overlay
        doc["render_avg_us"] = avg_render_us;
        doc["quantize_avg_us"] = avg_quantize_us;
        doc["rmt_wait_avg_us"] = avg_rmt_wait_us;
        doc["rmt_tx_avg_us"] = avg_rmt_tx_us;
        doc["cpu_percent"] = cpu_percent;
        doc["memory_percent"] = memory_percent;
        doc["memory_free_kb"] = heap_free / 1024;
        doc["memory_total_kb"] = heap_total / 1024;

        // Include FPS history samples (length 16)
        JsonArray fps_history = doc.createNestedArray("fps_history");
        for (int i = 0; i < 16; ++i) {
            fps_history.add(FPS_CPU_SAMPLES[i]);
        }

        String output;
        serializeJson(doc, output);
        ctx.sendJson(200, output);
    }
};

// GET /api/frame-metrics - Frame-level profiling metrics
class GetFrameMetricsHandler : public K1RequestHandler {
public:
    GetFrameMetricsHandler() : K1RequestHandler(ROUTE_FRAME_METRICS, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        auto& buffer = FrameMetricsBuffer::instance();
        uint32_t frame_count = buffer.count();

        DynamicJsonDocument doc(16384);
        doc["frame_count"] = frame_count;
        doc["buffer_size"] = FRAME_METRICS_BUFFER_SIZE;

        AverageMetrics avg = frame_metrics_average(0);
        doc["avg_render_us"] = avg.avg_render_us;
        doc["avg_quantize_us"] = avg.avg_quantize_us;
        doc["avg_rmt_wait_us"] = avg.avg_rmt_wait_us;
        doc["avg_rmt_tx_us"] = avg.avg_rmt_tx_us;
        doc["avg_total_us"] = avg.avg_total_us;

        JsonArray frames = doc.createNestedArray("frames");
        for (uint32_t i = 0; i < frame_count && i < FRAME_METRICS_BUFFER_SIZE; ++i) {
            FrameMetric fm = buffer.get_frame(i);
            JsonObject f = frames.createNestedObject();
            f["render_us"] = fm.render_us;
            f["quantize_us"] = fm.quantize_us;
            f["rmt_wait_us"] = fm.rmt_wait_us;
            f["rmt_tx_us"] = fm.rmt_tx_us;
            f["total_us"] = fm.total_us;
            f["heap_free"] = fm.heap_free;
            f["fps"] = fm.fps_snapshot / 100.0f;
        }

        String output;
        serializeJson(doc, output);
        ctx.sendJson(200, output);
    }
};

// GET /api/test-connection - Simple connection check
class GetTestConnectionHandler : public K1RequestHandler {
public:
    GetTestConnectionHandler() : K1RequestHandler(ROUTE_TEST_CONNECTION, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        StaticJsonDocument<64> doc;
        doc["status"] = "ok";
        doc["timestamp"] = millis();
        String output;
        serializeJson(doc, output);
        ctx.sendJson(200, output);
    }
};

// GET /api/health - Lightweight health snapshot for uptime and system state
class GetHealthHandler : public K1RequestHandler {
public:
    GetHealthHandler() : K1RequestHandler(ROUTE_HEALTH, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        // Ensure CPU metrics are fresh
        cpu_monitor.update();

        // Gather memory statistics
        uint32_t heap_free = ESP.getFreeHeap();
        uint32_t heap_total = ESP.getHeapSize();

        // Compose JSON response
        StaticJsonDocument<256> resp;
        resp["status"] = "ok";
        resp["uptime_ms"] = millis();
        resp["fps"] = FPS_CPU;
        resp["cpu_percent"] = cpu_monitor.getAverageCPUUsage();
        resp["memory_free_kb"] = heap_free / 1024;
        resp["memory_total_kb"] = heap_total / 1024;

        // WiFi status
        bool connected = (WiFi.status() == WL_CONNECTED);
        resp["connected"] = connected;
        JsonObject wifi = resp.createNestedObject("wifi");
        wifi["ssid"] = WiFi.SSID();
        wifi["rssi"] = WiFi.RSSI();
        wifi["ip"] = WiFi.localIP().toString();

        String output;
        serializeJson(resp, output);
        ctx.sendJson(200, output);
    }
};

// GET /api/leds/frame - Capture current LED frame (first N LEDs)
class GetLedFrameHandler : public K1RequestHandler {
public:
    GetLedFrameHandler() : K1RequestHandler(ROUTE_LED_FRAME, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        // Optional query params: n (limit), fmt (hex|rgb)
        uint32_t limit = NUM_LEDS;
        const char* fmt = "hex";
        if (ctx.request->hasParam("n")) {
            String v = ctx.request->getParam("n")->value();
            uint32_t req = (uint32_t)strtoul(v.c_str(), nullptr, 10);
            if (req > 0 && req < limit) limit = req;
        }
        if (ctx.request->hasParam("fmt")) {
            String v = ctx.request->getParam("fmt")->value();
            if (v == "rgb" || v == "hex") fmt = v.c_str();
        }

        // Build JSON response
        DynamicJsonDocument doc(8192);
        doc["count"] = NUM_LEDS;
        doc["limit"] = limit;
        doc["format"] = fmt;
        JsonArray data = doc.createNestedArray("data");

        if (strcmp(fmt, "hex") == 0) {
            char hexbuf[7];
            hexbuf[6] = '\0';
            for (uint32_t i = 0; i < limit; ++i) {
                uint8_t r = raw_led_data[i*3 + 0];
                uint8_t g = raw_led_data[i*3 + 1];
                uint8_t b = raw_led_data[i*3 + 2];
                snprintf(hexbuf, sizeof(hexbuf), "%02X%02X%02X", r, g, b);
                data.add(String(hexbuf));
            }
        } else {
            for (uint32_t i = 0; i < limit; ++i) {
                uint8_t r = raw_led_data[i*3 + 0];
                uint8_t g = raw_led_data[i*3 + 1];
                uint8_t b = raw_led_data[i*3 + 2];
                JsonArray rgb = data.createNestedArray();
                rgb.add(r);
                rgb.add(g);
                rgb.add(b);
            }
        }

        String output;
        serializeJson(doc, output);
        ctx.sendJson(200, output);
    }
};

// POST /api/params - Update parameters (partial update supported)
class PostParamsHandler : public K1RequestHandler {
public:
    PostParamsHandler() : K1RequestHandler(ROUTE_PARAMS, ROUTE_POST) {}
    void handle(RequestContext& ctx) override {
        if (!ctx.hasJson()) {
            ctx.sendError(400, "invalid_json", "Request body contains invalid JSON");
            return;
        }

        // Apply partial parameter updates
        apply_params_json(ctx.getJson());

        // Respond with updated params
        ctx.sendJson(200, build_params_json());
    }
};

// POST /api/select - Switch pattern by index or ID
class PostSelectHandler : public K1RequestHandler {
public:
    PostSelectHandler() : K1RequestHandler(ROUTE_SELECT, ROUTE_POST) {}
    void handle(RequestContext& ctx) override {
        if (!ctx.hasJson()) {
            ctx.sendError(400, "invalid_json", "Request body contains invalid JSON");
            return;
        }

        bool success = false;
        JsonObjectConst json = ctx.getJson();

        if (json.containsKey("index")) {
            uint8_t pattern_index = json["index"].as<uint8_t>();
            success = select_pattern(pattern_index);
        } else if (json.containsKey("id")) {
            const char* pattern_id = json["id"].as<const char*>();
            success = select_pattern_by_id(pattern_id);
        } else {
            ctx.sendError(400, "missing_field", "Missing index or id");
            return;
        }

        if (success) {
            StaticJsonDocument<256> response;
            response["current_pattern"] = g_current_pattern_index;
            response["id"] = get_current_pattern().id;
            response["name"] = get_current_pattern().name;

            String output;
            serializeJson(response, output);
            ctx.sendJson(200, output);
        } else {
            ctx.sendError(404, "pattern_not_found", "Invalid pattern index or ID");
        }
    }
};

// POST /api/reset - Reset parameters to defaults
class PostResetHandler : public K1RequestHandler {
public:
    PostResetHandler() : K1RequestHandler(ROUTE_RESET, ROUTE_POST) {}
    void handle(RequestContext& ctx) override {
        PatternParameters defaults = get_default_params();
        update_params(defaults);
        ctx.sendJson(200, build_params_json());
    }
};

// POST /api/audio-config - Update audio configuration
class PostAudioConfigHandler : public K1RequestHandler {
public:
    PostAudioConfigHandler() : K1RequestHandler(ROUTE_AUDIO_CONFIG, ROUTE_POST) {}
    void handle(RequestContext& ctx) override {
        if (!ctx.hasJson()) {
            ctx.sendError(400, "invalid_json", "Request body contains invalid JSON");
            return;
        }

        // Update microphone gain if provided (range: 0.5 - 2.0)
        JsonObjectConst json = ctx.getJson();
        if (json.containsKey("microphone_gain")) {
            float gain = json["microphone_gain"].as<float>();
            ValidationResult result = validate_microphone_gain(gain);
            if (result.valid) {
                configuration.microphone_gain = result.value;
                LOG_INFO(TAG_AUDIO, "Microphone gain updated to %.2fx", result.value);
            } else {
                ctx.sendError(400, "invalid_value", result.error_message);
                return;
            }
        }

        // Update VU floor multiplier if provided (range: 0.5 - 0.98)
        if (json.containsKey("vu_floor_pct")) {
            float pct = json["vu_floor_pct"].as<float>();
            ValidationResult result = validate_vu_floor_pct(pct);
            if (result.valid) {
                configuration.vu_floor_pct = result.value;
                LOG_INFO(TAG_AUDIO, "VU floor multiplier updated to %.2f", result.value);
            } else {
                ctx.sendError(400, "invalid_value", result.error_message);
                return;
            }
        }

        // Update audio active flag if provided
        if (json.containsKey("active")) {
            bool active = json["active"].as<bool>();
            EMOTISCOPE_ACTIVE = active;
            LOG_INFO(TAG_AUDIO, "Audio reactivity %s", active ? "ENABLED" : "DISABLED");

            // Immediately reflect availability by invalidating current snapshot when disabling
            // This ensures UI patterns see AUDIO_IS_AVAILABLE() == false right away
            if (!active) {
                // Zero out and mark back buffer invalid, then commit
                memset(audio_back.spectrogram, 0, sizeof(float) * NUM_FREQS);
                memset(audio_back.spectrogram_smooth, 0, sizeof(float) * NUM_FREQS);
                memset(audio_back.chromagram, 0, sizeof(float) * 12);
                audio_back.vu_level = 0.0f;
                audio_back.vu_level_raw = 0.0f;
                memset(audio_back.tempo_magnitude, 0, sizeof(float) * NUM_TEMPI);
                memset(audio_back.tempo_phase, 0, sizeof(float) * NUM_TEMPI);
                audio_back.is_valid = false;
                audio_back.timestamp_us = esp_timer_get_time();
                commit_audio_data();
            }
        }

        StaticJsonDocument<128> response_doc;
        response_doc["microphone_gain"] = configuration.microphone_gain;
        response_doc["active"] = EMOTISCOPE_ACTIVE;
        String response;
        serializeJson(response_doc, response);
        ctx.sendJson(200, response);
    }
};

// POST /api/wifi/link-options - Update WiFi link options (persist to NVS)
class PostWifiLinkOptionsHandler : public K1RequestHandler {
public:
    PostWifiLinkOptionsHandler() : K1RequestHandler(ROUTE_WIFI_LINK_OPTIONS, ROUTE_POST) {}
    void handle(RequestContext& ctx) override {
        if (!ctx.hasJson()) {
            ctx.sendError(400, "invalid_json", "Request body contains invalid JSON");
            return;
        }

        WifiLinkOptions prev;
        wifi_monitor_get_link_options(prev);
        WifiLinkOptions opts = prev;

        JsonObjectConst json = ctx.getJson();
        if (json.containsKey("force_bg_only")) {
            opts.force_bg_only = json["force_bg_only"].as<bool>();
        }
        if (json.containsKey("force_ht20")) {
            opts.force_ht20 = json["force_ht20"].as<bool>();
        }

        // Apply immediately and persist
        wifi_monitor_update_link_options(opts);
        wifi_monitor_save_link_options_to_nvs(opts);

        // If options changed, trigger a reassociation to apply fully
        if (opts.force_bg_only != prev.force_bg_only || opts.force_ht20 != prev.force_ht20) {
            wifi_monitor_reassociate_now("link options changed");
        }

        StaticJsonDocument<128> respDoc;
        respDoc["success"] = true;
        respDoc["force_bg_only"] = opts.force_bg_only;
        respDoc["force_ht20"] = opts.force_ht20;
        String output;
        serializeJson(respDoc, output);
        ctx.sendJson(200, output);
    }
};

// GET /api/audio-config - Get audio configuration (microphone gain)
class GetAudioConfigHandler : public K1RequestHandler {
public:
    GetAudioConfigHandler() : K1RequestHandler(ROUTE_AUDIO_CONFIG, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        StaticJsonDocument<128> doc;
        doc["microphone_gain"] = configuration.microphone_gain;
        doc["vu_floor_pct"] = configuration.vu_floor_pct;
        doc["active"] = EMOTISCOPE_ACTIVE;
        String response;
        serializeJson(doc, response);
        ctx.sendJson(200, response);
    }
};

// POST /api/audio/noise-calibrate - Trigger background noise calibration
class PostAudioNoiseCalHandler : public K1RequestHandler {
public:
    PostAudioNoiseCalHandler() : K1RequestHandler(ROUTE_AUDIO_NOISE_CAL, ROUTE_POST) {}
    void handle(RequestContext& ctx) override {
        start_noise_calibration();
        StaticJsonDocument<128> resp;
        resp["status"] = "started";
        resp["frames"] = NOISE_CALIBRATION_FRAMES;
        String output;
        serializeJson(resp, output);
        ctx.sendJson(200, output);
    }
};

// GET /api/config/backup - Export current configuration as JSON
class GetConfigBackupHandler : public K1RequestHandler {
public:
    GetConfigBackupHandler() : K1RequestHandler(ROUTE_CONFIG_BACKUP, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        // Create comprehensive configuration backup
        StaticJsonDocument<1024> doc;
        doc["version"] = "1.0";
        doc["device"] = "K1.reinvented";
        doc["timestamp"] = millis();
        doc["uptime_seconds"] = millis() / 1000;

        // Current parameters
        const PatternParameters& params = get_params();
        JsonObject parameters = doc.createNestedObject("parameters");
        parameters["brightness"] = params.brightness;
        parameters["softness"] = params.softness;
        parameters["color"] = params.color;
        parameters["color_range"] = params.color_range;
        parameters["saturation"] = params.saturation;
        parameters["warmth"] = params.warmth;
        parameters["background"] = params.background;
        parameters["speed"] = params.speed;
        parameters["palette_id"] = params.palette_id;
        parameters["custom_param_1"] = params.custom_param_1;
        parameters["custom_param_2"] = params.custom_param_2;
        parameters["custom_param_3"] = params.custom_param_3;

        // Current pattern selection
        doc["current_pattern"] = g_current_pattern_index;

        // Device information
        JsonObject device_info = doc.createNestedObject("device_info");
        device_info["ip"] = WiFi.localIP().toString();
        device_info["mac"] = WiFi.macAddress();
        #ifdef ESP_ARDUINO_VERSION
        device_info["firmware"] = String(ESP.getSdkVersion());
        #else
        device_info["firmware"] = "Unknown";
        #endif

        String output;
        serializeJson(doc, output);

        // Send with attachment header for downloading as file
        ctx.sendJsonWithHeaders(200, output, "Content-Disposition", "attachment; filename=\"k1-config-backup.json\"");
    }
};

// GET /api/wifi/link-options - Get current WiFi link options
class GetWifiLinkOptionsHandler : public K1RequestHandler {
public:
    GetWifiLinkOptionsHandler() : K1RequestHandler(ROUTE_WIFI_LINK_OPTIONS, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        WifiLinkOptions opts;
        wifi_monitor_get_link_options(opts);
        StaticJsonDocument<128> doc;
        doc["force_bg_only"] = opts.force_bg_only;
        doc["force_ht20"] = opts.force_ht20;
        String output;
        serializeJson(doc, output);
        ctx.sendJson(200, output);
    }
};

// POST /api/wifi/credentials - Update SSID/password, persist to NVS, trigger reassociation
class PostWifiCredentialsHandler : public K1RequestHandler {
public:
    PostWifiCredentialsHandler() : K1RequestHandler(ROUTE_WIFI_CREDENTIALS, ROUTE_POST) {}
    void handle(RequestContext& ctx) override {
        if (!ctx.hasJson()) {
            ctx.sendError(400, "invalid_json", "Request body contains invalid JSON");
            return;
        }

        JsonObjectConst body = ctx.getJson();
        if (!body.containsKey("ssid") || !body["ssid"].is<const char*>()) {
            ctx.sendError(400, "invalid_param", "ssid is required and must be string");
            return;
        }
        String ssid = body["ssid"].as<String>();
        String pass;
        if (body.containsKey("password")) {
            if (!body["password"].is<const char*>()) {
                ctx.sendError(400, "invalid_param", "password must be string");
                return;
            }
            pass = body["password"].as<String>();
        } else if (body.containsKey("pass")) {
            if (!body["pass"].is<const char*>()) {
                ctx.sendError(400, "invalid_param", "pass must be string");
                return;
            }
            pass = body["pass"].as<String>();
        } else {
            pass = ""; // Allow open networks
        }

        // Basic validation (lengths per WiFi standards)
        if (ssid.length() == 0 || ssid.length() > 63) {
            ctx.sendError(400, "invalid_param", "ssid length must be 1..63");
            return;
        }
        if (pass.length() > 63) {
            ctx.sendError(400, "invalid_param", "password length must be 0..63");
            return;
        }

        // Proceed without cooldown enforcement to reduce complexity

        // Update and persist; internal call will trigger reassociation
        wifi_monitor_update_credentials(ssid.c_str(), pass.c_str());

        StaticJsonDocument<160> resp;
        resp["success"] = true;
        resp["ssid"] = ssid;
        resp["password_len"] = (uint32_t)pass.length();
        String output;
        serializeJson(resp, output);
        ctx.sendJson(200, output);
    }
};

// GET /api/wifi/credentials - Return current stored credentials (masked)
class GetWifiCredentialsHandler : public K1RequestHandler {
public:
    GetWifiCredentialsHandler() : K1RequestHandler(ROUTE_WIFI_CREDENTIALS, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        char ssid[64] = {0};
        char pass[64] = {0};
        wifi_monitor_get_credentials(ssid, sizeof(ssid), pass, sizeof(pass));

        StaticJsonDocument<160> resp;
        resp["ssid"] = String(ssid);
        resp["password_len"] = (uint32_t)strlen(pass);
        String output;
        serializeJson(resp, output);
        ctx.sendJson(200, output);
    }
};

// POST /api/config/restore - Import configuration from JSON
class PostConfigRestoreHandler : public K1RequestHandler {
public:
    PostConfigRestoreHandler() : K1RequestHandler(ROUTE_CONFIG_RESTORE, ROUTE_POST) {}

    void handle(RequestContext& ctx) override {
        if (!ctx.hasJson()) {
            ctx.sendError(400, "invalid_json", "Failed to parse configuration JSON");
            return;
        }

        JsonObjectConst doc = ctx.getJson();

        // Validate backup format
        if (!doc.containsKey("version") || !doc.containsKey("parameters")) {
            ctx.sendError(400, "invalid_backup_format", "Missing required fields: version, parameters");
            return;
        }

        // Extract and validate parameters
        JsonObjectConst params_obj = doc["parameters"];
        PatternParameters new_params;

        // Load parameters with defaults for missing values
        new_params.brightness = params_obj["brightness"] | 1.0f;
        new_params.softness = params_obj["softness"] | 0.25f;
        new_params.color = params_obj["color"] | 0.33f;
        new_params.color_range = params_obj["color_range"] | 0.0f;
        new_params.saturation = params_obj["saturation"] | 0.75f;
        new_params.warmth = params_obj["warmth"] | 0.0f;
        new_params.background = params_obj["background"] | 0.25f;
        new_params.speed = params_obj["speed"] | 0.5f;
        new_params.palette_id = params_obj["palette_id"] | 0;
        new_params.custom_param_1 = params_obj["custom_param_1"] | 0.5f;
        new_params.custom_param_2 = params_obj["custom_param_2"] | 0.5f;
        new_params.custom_param_3 = params_obj["custom_param_3"] | 0.5f;

        // Validate and apply parameters
        bool params_valid = update_params_safe(new_params);

        // Restore pattern selection if provided and valid
        bool pattern_restored = false;
        if (doc.containsKey("current_pattern")) {
            int pattern_index = doc["current_pattern"];
            if (pattern_index >= 0 && pattern_index < g_num_patterns) {
                g_current_pattern_index = pattern_index;
                pattern_restored = true;
            }
        }

        // Build response
        StaticJsonDocument<256> response_doc;
        response_doc["success"] = true;
        response_doc["parameters_restored"] = params_valid;
        response_doc["pattern_restored"] = pattern_restored;
        response_doc["timestamp"] = millis();

        if (!params_valid) {
            response_doc["warning"] = "Some parameters were clamped to valid ranges";
        }

        String output;
        serializeJson(response_doc, output);
        ctx.sendJson(200, output);
    }
};

// GET /api/diag - Read current diagnostics configuration
class GetDiagHandler : public K1RequestHandler {
public:
    GetDiagHandler() : K1RequestHandler(ROUTE_DIAG, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        StaticJsonDocument<128> resp;
        resp["enabled"] = diag_is_enabled();
        resp["interval_ms"] = diag_get_interval_ms();
        resp["probe_logging"] = diag_is_enabled();
        String output;
        serializeJson(resp, output);
        ctx.sendJson(200, output);
    }
};

// GET /api/beat-events/info - Ring buffer summary
class GetBeatEventsInfoHandler : public K1RequestHandler {
public:
    GetBeatEventsInfoHandler() : K1RequestHandler(ROUTE_BEAT_EVENTS_INFO, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        StaticJsonDocument<128> resp;
        resp["count"] = beat_events_count();
        resp["capacity"] = beat_events_capacity();
        String output;
        serializeJson(resp, output);
        ctx.sendJson(200, output);
    }
};

// GET /api/led-tx/info - LED TX ring buffer summary
class GetLedTxInfoHandler : public K1RequestHandler {
public:
    GetLedTxInfoHandler() : K1RequestHandler(ROUTE_LED_TX_INFO, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        StaticJsonDocument<128> resp;
        resp["count"] = led_tx_events_count();
        resp["capacity"] = led_tx_events_capacity();
        String output;
        serializeJson(resp, output);
        ctx.sendJson(200, output);
    }
};

// GET /api/latency/probe - Last latency probe snapshot
class GetLatencyProbeHandler : public K1RequestHandler {
public:
    GetLatencyProbeHandler() : K1RequestHandler(ROUTE_LATENCY_PROBE, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        StaticJsonDocument<192> resp;
        resp["active"] = beat_events_probe_active();
        resp["last_latency_ms"] = ((float)beat_events_last_latency_us()) / 1000.0f;
        resp["timestamp_us"] = beat_events_last_probe_timestamp_us();
        resp["last_led_tx_us"] = g_last_led_tx_us.load();
        const char* label = beat_events_last_probe_label();
        if (label && label[0] != '\0') {
            resp["label"] = label;
        }
        String output;
        serializeJson(resp, output);
        ctx.sendJson(200, output);
    }
};

// GET /api/latency/align - Find nearest LED TX timestamp to a provided host timestamp
class GetLatencyAlignHandler : public K1RequestHandler {
public:
    GetLatencyAlignHandler() : K1RequestHandler(ROUTE_LATENCY_ALIGN, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        if (!ctx.request->hasParam("t_us")) {
            ctx.sendError(400, "invalid_param", "missing t_us (uint32)");
            return;
        }
        auto p = ctx.request->getParam("t_us");
        uint32_t t_us = (uint32_t)strtoul(p->value().c_str(), nullptr, 10);

        // Optional: max_delta_us threshold to indicate whether a sufficiently close match was found
        uint32_t max_delta_us = 0; // 0 means "no threshold provided"
        if (ctx.request->hasParam("max_delta_us")) {
            auto pmax = ctx.request->getParam("max_delta_us");
            max_delta_us = (uint32_t)strtoul(pmax->value().c_str(), nullptr, 10);
        }

        // Optional: strategy for selection
        // nearest (default), older (<= t_us), newer (>= t_us)
        enum Strategy { NEAREST, OLDER, NEWER };
        Strategy strategy = NEAREST;
        if (ctx.request->hasParam("strategy")) {
            String s = ctx.request->getParam("strategy")->value();
            if (s == "older" || s == "before") strategy = OLDER;
            else if (s == "newer" || s == "after") strategy = NEWER;
        }

        uint16_t count = led_tx_events_count();
        uint16_t cap = led_tx_events_capacity();
        LedTxEvent* all = new LedTxEvent[cap];
        uint16_t copied = led_tx_events_peek(all, count);

        uint32_t best_ts = 0;
        uint32_t best_delta = 0xFFFFFFFFu;
        for (uint16_t i = 0; i < copied; ++i) {
            uint32_t ts = all[i].timestamp_us;
            // Apply direction constraint when requested
            if (strategy == OLDER && ts > t_us) continue;
            if (strategy == NEWER && ts < t_us) continue;
            uint32_t delta = (ts > t_us) ? (ts - t_us) : (t_us - ts);
            if (delta < best_delta) {
                best_delta = delta;
                best_ts = ts;
            }
        }

        bool found = false;
        if (copied > 0) {
            if (max_delta_us > 0) {
                found = (best_delta != 0xFFFFFFFFu) && (best_delta <= max_delta_us);
            } else {
                found = (best_delta != 0xFFFFFFFFu);
            }
        }

        StaticJsonDocument<384> resp;
        resp["count"] = count;
        resp["capacity"] = cap;
        resp["t_us"] = t_us;
        if (max_delta_us > 0) {
            resp["max_delta_us"] = max_delta_us;
        }
        // Echo strategy used when not default
        if (strategy == OLDER) resp["strategy"] = "older";
        else if (strategy == NEWER) resp["strategy"] = "newer";
        resp["nearest_timestamp_us"] = best_ts;
        resp["delta_us"] = (best_delta == 0xFFFFFFFFu) ? 0 : best_delta;
        resp["found"] = found;
        String output;
        serializeJson(resp, output);
        delete[] all;
        ctx.sendJson(200, output);
    }
};
// GET /api/beat-events/recent - Non-destructive recent events snapshot
class GetBeatEventsRecentHandler : public K1RequestHandler {
public:
    GetBeatEventsRecentHandler() : K1RequestHandler(ROUTE_BEAT_EVENTS_RECENT, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        uint16_t limit = 10;
        if (ctx.request->hasParam("limit")) {
            auto p = ctx.request->getParam("limit");
            limit = (uint16_t)strtoul(p->value().c_str(), nullptr, 10);
        }
        if (limit == 0) limit = 10;
        if (limit > 32) limit = 32;
        BeatEvent tmp[32];
        uint16_t copied = beat_events_peek(tmp, limit);

        StaticJsonDocument<768> resp;
        resp["count"] = beat_events_count();
        resp["capacity"] = beat_events_capacity();
        JsonArray events = resp.createNestedArray("events");
        for (uint16_t i = 0; i < copied; ++i) {
            JsonObject ev = events.createNestedObject();
            ev["timestamp_us"] = tmp[i].timestamp_us;
            ev["confidence"] = tmp[i].confidence;
        }
        String output;
        serializeJson(resp, output);
        ctx.sendJson(200, output);
    }
};

// GET /api/led-tx/recent - Non-destructive recent LED TX timestamps
class GetLedTxRecentHandler : public K1RequestHandler {
public:
    GetLedTxRecentHandler() : K1RequestHandler(ROUTE_LED_TX_RECENT, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        uint16_t limit = 16;
        uint32_t since_us = 0;
        uint32_t until_us = 0;
        uint32_t around_us = 0;
        uint32_t max_delta_us = 0;
        bool order_oldest = false;  // default newest-first

        if (ctx.request->hasParam("limit")) {
            auto p = ctx.request->getParam("limit");
            limit = (uint16_t)strtoul(p->value().c_str(), nullptr, 10);
        }
        if (ctx.request->hasParam("since_us")) {
            auto p = ctx.request->getParam("since_us");
            since_us = (uint32_t)strtoul(p->value().c_str(), nullptr, 10);
        }
        if (ctx.request->hasParam("order")) {
            auto p = ctx.request->getParam("order");
            String v = p->value();
            if (v == "oldest" || v == "asc") order_oldest = true;
        }
        if (ctx.request->hasParam("until_us")) {
            auto p = ctx.request->getParam("until_us");
            until_us = (uint32_t)strtoul(p->value().c_str(), nullptr, 10);
        }
        if (ctx.request->hasParam("around_us")) {
            auto p = ctx.request->getParam("around_us");
            around_us = (uint32_t)strtoul(p->value().c_str(), nullptr, 10);
        }
        if (ctx.request->hasParam("max_delta_us")) {
            auto p = ctx.request->getParam("max_delta_us");
            max_delta_us = (uint32_t)strtoul(p->value().c_str(), nullptr, 10);
        }

        if (limit == 0) limit = 16;
        if (limit > 64) limit = 64;

        uint16_t count = led_tx_events_count();
        uint16_t cap = led_tx_events_capacity();
        LedTxEvent* all = new LedTxEvent[cap];
        uint16_t copied = led_tx_events_peek(all, count);

        // Select events according to since_us/until_us and optional window around_us±max_delta_us
        LedTxEvent selected[64];
        uint16_t selected_count = 0;
        for (uint16_t i = 0; i < copied && selected_count < 64; ++i) {
            uint32_t ts = all[i].timestamp_us;
            if (since_us > 0 && ts <= since_us) continue;
            if (until_us > 0 && ts >= until_us) continue;
            if (around_us > 0 && max_delta_us > 0) {
                uint32_t delta = (ts > around_us) ? (ts - around_us) : (around_us - ts);
                if (delta > max_delta_us) continue;
            }
            selected[selected_count++] = all[i];
        }

        uint16_t emit = selected_count < limit ? selected_count : limit;

        StaticJsonDocument<896> resp;
        resp["count"] = count;
        resp["capacity"] = cap;
        if (since_us > 0) resp["since_us"] = since_us;
        if (until_us > 0) resp["until_us"] = until_us;
        if (around_us > 0 && max_delta_us > 0) {
            resp["around_us"] = around_us;
            resp["max_delta_us"] = max_delta_us;
        }
        resp["order"] = order_oldest ? "oldest" : "newest";
        JsonArray events = resp.createNestedArray("events");
        if (order_oldest) {
            for (int i = (int)emit - 1; i >= 0; --i) {
                JsonObject ev = events.createNestedObject();
                ev["timestamp_us"] = selected[i].timestamp_us;
            }
        } else {
            for (uint16_t i = 0; i < emit; ++i) {
                JsonObject ev = events.createNestedObject();
                ev["timestamp_us"] = selected[i].timestamp_us;
            }
        }

        String output;
        serializeJson(resp, output);
        delete[] all;
        ctx.sendJson(200, output);
    }
};

// GET /api/rmt - RMT telemetry (refill counts and max gaps)
class GetRmtDiagHandler : public K1RequestHandler {
public:
    GetRmtDiagHandler() : K1RequestHandler(ROUTE_RMT, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        const RmtProbe* p1 = nullptr; const RmtProbe* p2 = nullptr;
        rmt_probe_get(&p1, &p2);
        StaticJsonDocument<320> doc;
        doc["wait_timeouts"] = g_led_rmt_wait_timeouts.load(std::memory_order_relaxed);
        if (p1) {
            JsonObject ch1 = doc.createNestedObject("ch1");
            ch1["empty"] = p1->mem_empty_count;
            ch1["maxgap_us"] = p1->max_gap_us;
            ch1["trans_done"] = p1->trans_done_count;
            ch1["last_empty_us"] = (uint32_t)(p1->last_empty_us & 0xFFFFFFFF);
        }
        if (p2) {
            JsonObject ch2 = doc.createNestedObject("ch2");
            ch2["empty"] = p2->mem_empty_count;
            ch2["maxgap_us"] = p2->max_gap_us;
            ch2["trans_done"] = p2->trans_done_count;
            ch2["last_empty_us"] = (uint32_t)(p2->last_empty_us & 0xFFFFFFFF);
        }
        String out; serializeJson(doc, out);
        ctx.sendJson(200, out);
    }
};

// POST /api/rmt/reset - Reset RMT probe counters and LED wait timeouts
class PostRmtResetHandler : public K1RequestHandler {
public:
    PostRmtResetHandler() : K1RequestHandler(ROUTE_RMT_RESET, ROUTE_POST) {}
    void handle(RequestContext& ctx) override {
        rmt_probe_reset();
        g_led_rmt_wait_timeouts.store(0, std::memory_order_relaxed);

        const RmtProbe* p1 = nullptr; const RmtProbe* p2 = nullptr;
        rmt_probe_get(&p1, &p2);
        StaticJsonDocument<192> doc;
        doc["wait_timeouts"] = g_led_rmt_wait_timeouts.load(std::memory_order_relaxed);
        if (p1) {
            JsonObject ch1 = doc.createNestedObject("ch1");
            ch1["empty"] = p1->mem_empty_count;
            ch1["maxgap_us"] = p1->max_gap_us;
            ch1["trans_done"] = p1->trans_done_count;
        }
        if (p2) {
            JsonObject ch2 = doc.createNestedObject("ch2");
            ch2["empty"] = p2->mem_empty_count;
            ch2["maxgap_us"] = p2->max_gap_us;
            ch2["trans_done"] = p2->trans_done_count;
        }
        String out; serializeJson(doc, out);
        ctx.sendJson(200, out);
    }
};

// GET /api/audio/tempo - Current tempo/beat telemetry snapshot
class GetAudioTempoHandler : public K1RequestHandler {
public:
    GetAudioTempoHandler() : K1RequestHandler(ROUTE_AUDIO_TEMPO, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        // CRITICAL FIX: Read from synchronized audio_front buffer instead of raw global arrays
        // This ensures tempo data flows through the double-buffered synchronization model
        AudioDataSnapshot snapshot;
        bool audio_valid = get_audio_snapshot(&snapshot);

        const uint8_t K = 5;
        struct Bin { uint16_t idx; float mag; } top[K];
        for (uint8_t i = 0; i < K; ++i) { top[i] = {0, 0.0f}; }

        // Find top 5 tempo bins from SYNCHRONIZED snapshot data
        if (audio_valid) {
            for (uint16_t i = 0; i < NUM_TEMPI; ++i) {
                float mag = snapshot.tempo_magnitude[i];  // READ FROM SNAPSHOT, not tempi_smooth
                for (uint8_t k = 0; k < K; ++k) {
                    if (mag > top[k].mag) {
                        for (int j = K-1; j > k; --j) top[j] = top[j-1];
                        top[k] = {i, mag};
                        break;
                    }
                }
            }
        }

        StaticJsonDocument<768> resp;  // Increased from 512 for Phase 3 metrics
        resp["tempo_confidence"] = tempo_confidence;
        resp["tempi_power_sum"] = tempi_power_sum;
        resp["silence_detected"] = silence_detected;
        resp["silence_level"] = silence_level;
        resp["max_tempo_range"] = MAX_TEMPO_RANGE;
        resp["snapshot_valid"] = audio_valid;  // Diagnostic flag showing if snapshot is valid

        // PHASE 3: Multi-metric confidence breakdown
        JsonObject confidence_metrics = resp.createNestedObject("confidence_metrics");
        confidence_metrics["peak_ratio"] = tempo_confidence_metrics.peak_ratio;
        confidence_metrics["entropy"] = tempo_confidence_metrics.entropy_confidence;
        confidence_metrics["temporal_stability"] = tempo_confidence_metrics.temporal_stability;
        confidence_metrics["combined"] = tempo_confidence_metrics.combined;

        // PHASE 3: Tempo lock state
        resp["tempo_lock_state"] = get_tempo_lock_state_string(tempo_lock_tracker.state);
        resp["time_in_state_ms"] = t_now_ms - tempo_lock_tracker.state_entry_time_ms;
        resp["locked_tempo_bpm"] = tempo_lock_tracker.locked_tempo_bpm;

        JsonArray top_bins = resp.createNestedArray("top_bins");
        for (uint8_t i = 0; i < K; ++i) {
            uint16_t idx = top[i].idx;
            JsonObject b = top_bins.createNestedObject();
            b["idx"] = idx;
            b["bpm"] = tempi_bpm_values_hz[idx] * 60.0f;
            b["magnitude"] = audio_valid ? snapshot.tempo_magnitude[idx] : 0.0f;  // READ FROM SNAPSHOT
            b["phase"] = audio_valid ? snapshot.tempo_phase[idx] : 0.0f;           // READ FROM SNAPSHOT
            b["beat"] = audio_valid ? sinf(snapshot.tempo_phase[idx]) : 0.0f;       // Compute beat from phase
        }
        String output;
        serializeJson(resp, output);
        ctx.sendJson(200, output);
    }
};

// GET /api/audio/arrays - Downsampled spectrogram_smooth and tempi_smooth slices
class GetAudioArraysHandler : public K1RequestHandler {
public:
    GetAudioArraysHandler() : K1RequestHandler(ROUTE_AUDIO_ARRAYS, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        // Query: count (default 16, clamp 4..64), offset (default 0), stride (default auto)
        // Optional spectrogram: history=true, frames=N (clamped to available slots)
        // Optional additions: include_chromagram=1, include_novelty=1, novelty_count=N, order=newest|oldest
        uint16_t count = 16;
        uint16_t offset = 0;
        uint16_t stride = 0; // 0 => auto based on count
        bool history = false;
        uint16_t frames = 0; // 0 => auto (use available)
        bool include_chromagram = false;
        bool include_novelty = false;
        uint16_t novelty_count = 0; // 0 => default
        bool order_newest_first = true; // default newest→oldest

        if (ctx.request->hasParam("count")) {
            auto p = ctx.request->getParam("count");
            count = (uint16_t)strtoul(p->value().c_str(), nullptr, 10);
        }
        if (ctx.request->hasParam("offset")) {
            auto p = ctx.request->getParam("offset");
            offset = (uint16_t)strtoul(p->value().c_str(), nullptr, 10);
        }
        if (ctx.request->hasParam("stride")) {
            auto p = ctx.request->getParam("stride");
            stride = (uint16_t)strtoul(p->value().c_str(), nullptr, 10);
        }
        if (ctx.request->hasParam("history")) {
            auto p = ctx.request->getParam("history");
            String v = p->value();
            history = (v == "1" || v == "true" || v == "True");
        }
        if (ctx.request->hasParam("frames")) {
            auto p = ctx.request->getParam("frames");
            frames = (uint16_t)strtoul(p->value().c_str(), nullptr, 10);
        }
        if (ctx.request->hasParam("include_chromagram")) {
            auto p = ctx.request->getParam("include_chromagram");
            String v = p->value();
            include_chromagram = (v == "1" || v == "true" || v == "True");
        }
        if (ctx.request->hasParam("include_novelty")) {
            auto p = ctx.request->getParam("include_novelty");
            String v = p->value();
            include_novelty = (v == "1" || v == "true" || v == "True");
        }
        if (ctx.request->hasParam("novelty_count")) {
            auto p = ctx.request->getParam("novelty_count");
            novelty_count = (uint16_t)strtoul(p->value().c_str(), nullptr, 10);
        }
        if (ctx.request->hasParam("order")) {
            auto p = ctx.request->getParam("order");
            String v = p->value();
            if (v == "oldest" || v == "asc") order_newest_first = false;
        }

        if (count < 4) count = 4;
        if (count > 64) count = 64;

        uint16_t spec_bins = NUM_FREQS;
        uint16_t tempi_bins = NUM_TEMPI;
        if (offset >= spec_bins) offset = spec_bins - 1;
        if (stride == 0) stride = spec_bins / count;
        if (stride == 0) stride = 1; // fallback
        if (stride > spec_bins) stride = spec_bins;

        StaticJsonDocument<2048> resp;
        if (!history) {
            JsonArray spec_out = resp.createNestedArray("spectrogram");
            for (uint16_t i = offset; i < spec_bins && spec_out.size() < count; i += stride) {
                spec_out.add(spectrogram_smooth[i]);
            }
        } else {
            // History window bounds: conservative 4..NUM_SPECTROGRAM_AVERAGE_SAMPLES
            uint16_t max_slots = NUM_SPECTROGRAM_AVERAGE_SAMPLES;
            if (frames == 0) frames = max_slots; // auto: use all available
            if (frames < 4) frames = 4;
            if (frames > max_slots) frames = max_slots;

            JsonArray spec_hist = resp.createNestedArray("spectrogram_history");
            // Iterate newest→oldest using spectrogram_average ring buffer
            // Assume spectrogram_average_index points to next write slot
            for (uint16_t f = 0; f < frames; ++f) {
                int idx = (int)spectrogram_average_index - 1 - (int)f;
                while (idx < 0) idx += max_slots;
                JsonArray frame_out = spec_hist.createNestedArray();
                for (uint16_t i = offset; i < spec_bins && frame_out.size() < count; i += stride) {
                    frame_out.add(spectrogram_average[idx][i]);
                }
            }
            resp["frames"] = frames;
        }

        // Tempo slice uses same offset/stride concept but clamps to tempi_bins
        if (offset >= tempi_bins) offset = tempi_bins - 1;
        if (stride > tempi_bins) stride = tempi_bins;
        JsonArray tempi_out = resp.createNestedArray("tempi");
        for (uint16_t i = offset; i < tempi_bins && tempi_out.size() < count; i += stride) {
            tempi_out.add(tempi_smooth[i]);
        }

        // Optional: include chromagram (12 pitch classes)
        if (include_chromagram) {
            JsonArray chroma_out = resp.createNestedArray("chromagram");
            for (uint16_t i = 0; i < 12; ++i) {
                chroma_out.add(audio_back.chromagram[i]);
            }
        }

        // Optional: include novelty curve (normalized), newest→oldest or oldest→newest
        if (include_novelty) {
            // Default and clamp novelty_count to safe range for JSON size
            uint16_t max_nov = NOVELTY_HISTORY_LENGTH;
            if (novelty_count == 0) novelty_count = 64; // default window
            if (novelty_count < 16) novelty_count = 16;
            if (novelty_count > 256) novelty_count = 256;

            JsonArray nov_out = resp.createNestedArray("novelty_curve");
            if (order_newest_first) {
                // newest→oldest from the tail of the normalized buffer
                for (int i = 0; i < novelty_count; ++i) {
                    int idx = (int)NOVELTY_HISTORY_LENGTH - 1 - i;
                    if (idx < 0) break;
                    nov_out.add(novelty_curve_normalized[idx]);
                }
            } else {
                // oldest→newest for the last window
                int start = (int)NOVELTY_HISTORY_LENGTH - novelty_count;
                if (start < 0) start = 0;
                for (int i = start; i < (int)NOVELTY_HISTORY_LENGTH && (int)nov_out.size() < (int)novelty_count; ++i) {
                    nov_out.add(novelty_curve_normalized[i]);
                }
            }
            resp["novelty_count"] = novelty_count;
            resp["novelty_total"] = NOVELTY_HISTORY_LENGTH;
            resp["order"] = order_newest_first ? "newest" : "oldest";
        }

        resp["count"] = count;
        resp["offset"] = offset;
        resp["stride"] = stride;
        resp["source_bins"] = spec_bins;
        resp["source_tempi"] = tempi_bins;
        resp["history"] = history;
        resp["include_chromagram"] = include_chromagram;
        resp["include_novelty"] = include_novelty;

        String output;
        serializeJson(resp, output);
        ctx.sendJson(200, output);
    }
};

// GET /api/audio/metrics - JSON audio-related performance metrics
class GetAudioMetricsHandler : public K1RequestHandler {
public:
    GetAudioMetricsHandler() : K1RequestHandler(ROUTE_AUDIO_METRICS, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        // Derive averages from accumulated profiler counters
        float frames = FRAMES_COUNTED.load(std::memory_order_relaxed) > 0
                         ? static_cast<float>(FRAMES_COUNTED.load(std::memory_order_relaxed))
                         : 1.0f;
        float avg_render_us = static_cast<float>(ACCUM_RENDER_US.load(std::memory_order_relaxed)) / frames;
        float avg_quantize_us = static_cast<float>(ACCUM_QUANTIZE_US.load(std::memory_order_relaxed)) / frames;
        float avg_rmt_wait_us = static_cast<float>(ACCUM_RMT_WAIT_US.load(std::memory_order_relaxed)) / frames;
        float avg_rmt_tx_us = static_cast<float>(ACCUM_RMT_TRANSMIT_US.load(std::memory_order_relaxed)) / frames;
        float frame_time_us = avg_render_us + avg_quantize_us + avg_rmt_wait_us + avg_rmt_tx_us;

        StaticJsonDocument<256> resp;
        resp["fps"] = FPS_CPU;
        resp["frame_time_us"] = frame_time_us;
        resp["cpu_percent"] = cpu_monitor.getAverageCPUUsage();
        resp["memory_free_kb"] = (uint32_t)(ESP.getFreeHeap()/1024);
        resp["beat_events_count"] = beat_events_count();
        resp["tempo_confidence"] = tempo_confidence;
        resp["audio_update_counter"] = audio_back.update_counter;
        resp["audio_timestamp_us"] = audio_back.timestamp_us;
        String output;
        serializeJson(resp, output);
        ctx.sendJson(200, output);
    }
};

// GET /api/audio/snapshot - Minimal audio state snapshot for UI
class GetAudioSnapshotHandler : public K1RequestHandler {
public:
    GetAudioSnapshotHandler() : K1RequestHandler(ROUTE_AUDIO_SNAPSHOT, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        StaticJsonDocument<256> resp;
        resp["vu_level"] = audio_back.vu_level;
        resp["vu_level_raw"] = audio_back.vu_level_raw;
        resp["tempo_confidence"] = audio_back.tempo_confidence;
        resp["update_counter"] = audio_back.update_counter;
        resp["timestamp_us"] = audio_back.timestamp_us;
        resp["is_valid"] = audio_back.is_valid;
        String output;
        serializeJson(resp, output);
        ctx.sendJson(200, output);
    }
};

// GET /api/wifi/status - Link status snapshot
class GetWifiStatusHandler : public K1RequestHandler {
public:
    GetWifiStatusHandler() : K1RequestHandler(ROUTE_WIFI_STATUS, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        WifiLinkOptions opts;
        wifi_monitor_get_link_options(opts);
        StaticJsonDocument<256> resp;
        resp["ssid"] = WiFi.SSID();
        resp["rssi"] = WiFi.RSSI();
        resp["ip"] = WiFi.localIP().toString();
        resp["mac"] = WiFi.macAddress();
        #ifdef ESP_ARDUINO_VERSION
        resp["firmware"] = String(ESP.getSdkVersion());
        #endif
        resp["force_bg_only"] = opts.force_bg_only;
        resp["force_ht20"] = opts.force_ht20;
        String output;
        serializeJson(resp, output);
        ctx.sendJson(200, output);
    }
};

// POST /api/wifi/scan - Initiate WiFi network scan for diagnostics
class PostWifiScanHandler : public K1RequestHandler {
public:
    PostWifiScanHandler() : K1RequestHandler(ROUTE_WIFI_SCAN, ROUTE_POST) {}
    void handle(RequestContext& ctx) override {
        // Initiate asynchronous WiFi scan
        wifi_monitor_scan_available_networks();

        StaticJsonDocument<128> resp;
        resp["status"] = "scan_initiated";
        resp["message"] = "WiFi network scan started (async). Check results in 2-3 seconds with GET /api/wifi/scan/results";
        String output;
        serializeJson(resp, output);
        ctx.sendJson(200, output);
    }
};

// GET /api/wifi/scan/results - Get WiFi scan results
class GetWifiScanResultsHandler : public K1RequestHandler {
public:
    GetWifiScanResultsHandler() : K1RequestHandler("/api/wifi/scan/results", ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        // Log the scan results (this will also perform the check internally)
        wifi_monitor_log_scan_results();

        StaticJsonDocument<256> resp;
        resp["status"] = "complete";
        resp["message"] = "WiFi scan results logged to serial output. Check device logs.";
        String output;
        serializeJson(resp, output);
        ctx.sendJson(200, output);
    }
};

// GET /api/pattern/current - Current pattern metadata
class GetPatternCurrentHandler : public K1RequestHandler {
public:
    GetPatternCurrentHandler() : K1RequestHandler(ROUTE_PATTERN_CURRENT, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        const PatternInfo& p = get_current_pattern();
        StaticJsonDocument<192> resp;
        resp["index"] = g_current_pattern_index;
        resp["id"] = p.id;
        resp["name"] = p.name;
        resp["is_audio_reactive"] = p.is_audio_reactive;
        String output;
        serializeJson(resp, output);
        ctx.sendJson(200, output);
    }
};

// GET /metrics - Prometheus-style metrics
class GetMetricsHandler : public K1RequestHandler {
public:
    GetMetricsHandler() : K1RequestHandler(ROUTE_METRICS, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        float frames = FRAMES_COUNTED.load(std::memory_order_relaxed) > 0
                         ? static_cast<float>(FRAMES_COUNTED.load(std::memory_order_relaxed))
                         : 1.0f;
        float avg_render_us = static_cast<float>(ACCUM_RENDER_US.load(std::memory_order_relaxed)) / frames;
        float avg_quantize_us = static_cast<float>(ACCUM_QUANTIZE_US.load(std::memory_order_relaxed)) / frames;
        float avg_rmt_wait_us = static_cast<float>(ACCUM_RMT_WAIT_US.load(std::memory_order_relaxed)) / frames;
        float avg_rmt_tx_us = static_cast<float>(ACCUM_RMT_TRANSMIT_US.load(std::memory_order_relaxed)) / frames;
        float frame_time_us = avg_render_us + avg_quantize_us + avg_rmt_wait_us + avg_rmt_tx_us;

        String m;
        m.reserve(512);
        m += "k1_fps "; m += String(FPS_CPU); m += "\n";
        m += "k1_frame_time_us "; m += String(frame_time_us); m += "\n";
        m += "k1_cpu_percent "; m += String(cpu_monitor.getAverageCPUUsage()); m += "\n";
        m += "k1_memory_free_kb "; m += String(ESP.getFreeHeap()/1024); m += "\n";
        m += "k1_beat_events_count "; m += String(beat_events_count()); m += "\n";
        m += "k1_tempo_confidence "; m += String(tempo_confidence); m += "\n";
        ctx.sendText(200, m);
    }
};

// (Duplicate GetFrameMetricsHandler removed; see single definition above)

// GET /api/beat-events/dump - Ring-buffer snapshot with attachment headers
class GetBeatEventsDumpHandler : public K1RequestHandler {
public:
    GetBeatEventsDumpHandler() : K1RequestHandler(ROUTE_BEAT_EVENTS_DUMP, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        uint16_t count = beat_events_count();
        uint16_t cap = beat_events_capacity();
        BeatEvent* tmp = new BeatEvent[cap];
        uint16_t copied = beat_events_peek(tmp, count);

        StaticJsonDocument<2048> resp;
        resp["count"] = count;
        resp["capacity"] = cap;
        JsonArray events = resp.createNestedArray("events");
        for (uint16_t i = 0; i < copied; ++i) {
            JsonObject ev = events.createNestedObject();
            ev["timestamp_us"] = tmp[i].timestamp_us;
            ev["confidence"] = tmp[i].confidence;
        }
        String output;
        serializeJson(resp, output);
        delete[] tmp;
        ctx.sendJsonWithHeaders(200, output, "Content-Disposition", "attachment; filename=\"beat-events.json\"");
    }
};

// GET /api/led-tx/dump - LED TX ring-buffer snapshot with attachment headers
class GetLedTxDumpHandler : public K1RequestHandler {
public:
    GetLedTxDumpHandler() : K1RequestHandler(ROUTE_LED_TX_DUMP, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        uint16_t count = led_tx_events_count();
        uint16_t cap = led_tx_events_capacity();
        LedTxEvent* all = new LedTxEvent[cap];
        uint16_t copied = led_tx_events_peek(all, count);

        // Parameters: order, since_us, until_us, around_us+max_delta_us
        bool order_oldest = false; // default newest-first
        uint32_t since_us = 0, until_us = 0, around_us = 0, max_delta_us = 0;
        if (ctx.request->hasParam("order")) {
            String v = ctx.request->getParam("order")->value();
            if (v == "oldest" || v == "asc") order_oldest = true;
        }
        if (ctx.request->hasParam("since_us")) {
            since_us = (uint32_t)strtoul(ctx.request->getParam("since_us")->value().c_str(), nullptr, 10);
        }
        if (ctx.request->hasParam("until_us")) {
            until_us = (uint32_t)strtoul(ctx.request->getParam("until_us")->value().c_str(), nullptr, 10);
        }
        if (ctx.request->hasParam("around_us")) {
            around_us = (uint32_t)strtoul(ctx.request->getParam("around_us")->value().c_str(), nullptr, 10);
        }
        if (ctx.request->hasParam("max_delta_us")) {
            max_delta_us = (uint32_t)strtoul(ctx.request->getParam("max_delta_us")->value().c_str(), nullptr, 10);
        }

        // Apply filters, collect into a temporary vector with capacity cap
        LedTxEvent* selected = new LedTxEvent[cap];
        uint16_t selected_count = 0;
        for (uint16_t i = 0; i < copied; ++i) {
            uint32_t ts = all[i].timestamp_us;
            if (since_us > 0 && ts <= since_us) continue;
            if (until_us > 0 && ts >= until_us) continue;
            if (around_us > 0 && max_delta_us > 0) {
                uint32_t delta = (ts > around_us) ? (ts - around_us) : (around_us - ts);
                if (delta > max_delta_us) continue;
            }
            selected[selected_count++] = all[i];
        }

        StaticJsonDocument<1400> resp;
        resp["count"] = count;
        resp["capacity"] = cap;
        if (since_us > 0) resp["since_us"] = since_us;
        if (until_us > 0) resp["until_us"] = until_us;
        if (around_us > 0 && max_delta_us > 0) {
            resp["around_us"] = around_us;
            resp["max_delta_us"] = max_delta_us;
        }
        resp["order"] = order_oldest ? "oldest" : "newest";
        JsonArray events = resp.createNestedArray("events");
        if (order_oldest) {
            for (int i = (int)selected_count - 1; i >= 0; --i) {
                JsonObject ev = events.createNestedObject();
                ev["timestamp_us"] = selected[i].timestamp_us;
            }
        } else {
            for (uint16_t i = 0; i < selected_count; ++i) {
                JsonObject ev = events.createNestedObject();
                ev["timestamp_us"] = selected[i].timestamp_us;
            }
        }
        String output;
        serializeJson(resp, output);
        delete[] selected;
        delete[] all;
        ctx.sendJsonWithHeaders(200, output, "Content-Disposition", "attachment; filename=\"led-tx-events.json\"");
    }
};

// GET /api/realtime/config - WebSocket realtime telemetry configuration
static bool s_realtime_ws_enabled = (REALTIME_WS_ENABLED_DEFAULT != 0);
static uint32_t s_realtime_ws_interval_ms = REALTIME_WS_DEFAULT_INTERVAL_MS;
// NVS persistence for realtime websocket config
static void load_realtime_ws_config_from_nvs() {
    Preferences prefs;
    if (!prefs.begin("realtime_ws", true)) {
        return;
    }
    bool enabled = prefs.getBool("enabled", s_realtime_ws_enabled);
    uint32_t interval = prefs.getUInt("interval_ms", s_realtime_ws_interval_ms);
    prefs.end();
    s_realtime_ws_enabled = enabled;
    if (interval < 100) interval = 100;
    if (interval > 5000) interval = 5000;
    s_realtime_ws_interval_ms = interval;
}

static void save_realtime_ws_config_to_nvs() {
    Preferences prefs;
    if (!prefs.begin("realtime_ws", false)) {
        return;
    }
    prefs.putBool("enabled", s_realtime_ws_enabled);
    prefs.putUInt("interval_ms", s_realtime_ws_interval_ms);
    prefs.end();
}
class GetRealtimeConfigHandler : public K1RequestHandler {
public:
    GetRealtimeConfigHandler() : K1RequestHandler(ROUTE_REALTIME_CONFIG, ROUTE_GET) {}
    void handle(RequestContext& ctx) override {
        StaticJsonDocument<192> resp;
        resp["enabled"] = s_realtime_ws_enabled;
        resp["interval_ms"] = s_realtime_ws_interval_ms;
        String output;
        serializeJson(resp, output);
        ctx.sendJson(200, output);
    }
};

// POST /api/realtime/config - Update WebSocket telemetry config
class PostRealtimeConfigHandler : public K1RequestHandler {
public:
    PostRealtimeConfigHandler() : K1RequestHandler(ROUTE_REALTIME_CONFIG, ROUTE_POST) {}
    void handle(RequestContext& ctx) override {
        if (!ctx.hasJson()) {
            ctx.sendError(400, "invalid_json", "Missing or invalid JSON body");
            return;
        }
        JsonObjectConst body = ctx.getJson();
        bool updated = false;

        // Validate and apply 'enabled' (optional)
        if (body.containsKey("enabled")) {
            if (!body["enabled"].is<bool>()) {
                ctx.sendError(400, "invalid_param", "enabled must be boolean");
                return;
            }
            s_realtime_ws_enabled = body["enabled"].as<bool>();
            updated = true;
        }

        // Validate and apply 'interval_ms' (optional, clamp 100..5000)
        if (body.containsKey("interval_ms")) {
            if (!body["interval_ms"].is<uint32_t>()) {
                ctx.sendError(400, "invalid_param", "interval_ms must be integer");
                return;
            }
            uint32_t v = body["interval_ms"].as<uint32_t>();
            if (v < 100 || v > 5000) {
                ctx.sendError(400, "invalid_param", "interval_ms must be between 100 and 5000");
                return;
            }
            s_realtime_ws_interval_ms = v;
            updated = true;
        }

        if (!updated) {
            ctx.sendError(400, "no_fields", "Provide enabled and/or interval_ms");
            return;
        }

        // Persist changes to NVS
        save_realtime_ws_config_to_nvs();
        StaticJsonDocument<192> resp;
        resp["enabled"] = s_realtime_ws_enabled;
        resp["interval_ms"] = s_realtime_ws_interval_ms;
        String output;
        serializeJson(resp, output);
        ctx.sendJson(200, output);
    }
};

// POST /api/diag - Enable/disable diagnostics and set print interval
class PostDiagHandler : public K1RequestHandler {
public:
    PostDiagHandler() : K1RequestHandler(ROUTE_DIAG, ROUTE_POST) {}
    void handle(RequestContext& ctx) override {
        if (!ctx.hasJson()) {
            ctx.sendError(400, "invalid_json", "Request body contains invalid JSON");
            return;
        }

        JsonObjectConst json = ctx.getJson();

        // Partial updates supported
        if (json.containsKey("enabled")) {
            bool enabled = json["enabled"].as<bool>();
            diag_set_enabled(enabled);
            // Mirror to latency probe logging so host request gates both
            beat_events_set_probe_logging(enabled);
        }

        if (json.containsKey("interval_ms")) {
            uint32_t interval_ms = json["interval_ms"].as<uint32_t>();
            diag_set_interval_ms(interval_ms);
            // Apply same interval to latency probe prints
            beat_events_set_probe_interval_ms(interval_ms);
        }

        // Persist diagnostics settings
        diag_save_to_nvs();
        StaticJsonDocument<128> resp;
        resp["enabled"] = diag_is_enabled();
        resp["interval_ms"] = diag_get_interval_ms();
        resp["probe_logging"] = diag_is_enabled();
        String output;
        serializeJson(resp, output);
        ctx.sendJson(200, output);
    }
};

// ============================================================================
// Handler Memory Management Note
//
// All handlers (14 instances) are allocated with `new` and intentionally never freed.
// This is acceptable because:
// 1. Handlers are singletons (one instance per endpoint, live for device lifetime)
// 2. Total memory: 336 bytes (0.004% of 8MB heap) - negligible
// 3. Device never shuts down handlers - only power cycle resets memory
// 4. Alternative (static allocation) would require changes to registration pattern
//
// If dynamic handler registration is added in future, implement handler_registry
// to track and delete handlers on deregistration.
// ============================================================================
// Initialize web server with REST API endpoints
void init_webserver() {
    // Load persisted diagnostics settings and mirror to latency probe
    diag_load_from_nvs();
    beat_events_set_probe_logging(diag_is_enabled());
    beat_events_set_probe_interval_ms(diag_get_interval_ms());

    // Load persisted realtime websocket configuration
    load_realtime_ws_config_from_nvs();
    // Register GET handlers (with built-in rate limiting)
    registerGetHandler(server, ROUTE_PATTERNS, new GetPatternsHandler());
    registerGetHandler(server, ROUTE_PARAMS, new GetParamsHandler());
    registerGetHandler(server, ROUTE_PALETTES, new GetPalettesHandler());
    registerGetHandler(server, ROUTE_DEVICE_INFO, new GetDeviceInfoHandler());
    registerGetHandler(server, ROUTE_DEVICE_PERFORMANCE, new GetDevicePerformanceHandler());
    registerGetHandler(server, ROUTE_FRAME_METRICS, new GetFrameMetricsHandler());
    registerGetHandler(server, ROUTE_TEST_CONNECTION, new GetTestConnectionHandler());
    registerGetHandler(server, ROUTE_HEALTH, new GetHealthHandler());
    registerGetHandler(server, ROUTE_LED_FRAME, new GetLedFrameHandler());
    registerGetHandler(server, "/api/frame-metrics", new GetFrameMetricsHandler());

    // Register POST handlers (with built-in rate limiting and JSON parsing)
    registerPostHandler(server, ROUTE_PARAMS, new PostParamsHandler());
    registerPostHandler(server, ROUTE_SELECT, new PostSelectHandler());
    registerPostHandler(server, ROUTE_RESET, new PostResetHandler());
    registerPostHandler(server, ROUTE_AUDIO_CONFIG, new PostAudioConfigHandler());
    registerPostHandler(server, ROUTE_WIFI_LINK_OPTIONS, new PostWifiLinkOptionsHandler());
    registerPostHandler(server, ROUTE_WIFI_CREDENTIALS, new PostWifiCredentialsHandler());
    registerPostHandler(server, ROUTE_WIFI_SCAN, new PostWifiScanHandler());
    registerPostHandler(server, ROUTE_CONFIG_RESTORE, new PostConfigRestoreHandler());
    registerPostHandler(server, ROUTE_DIAG, new PostDiagHandler());
    registerPostHandler(server, ROUTE_AUDIO_NOISE_CAL, new PostAudioNoiseCalHandler());

    // Register GET handlers for diagnostics
    registerGetHandler(server, ROUTE_DIAG, new GetDiagHandler());
    registerGetHandler(server, ROUTE_BEAT_EVENTS_INFO, new GetBeatEventsInfoHandler());
    registerGetHandler(server, ROUTE_LED_TX_INFO, new GetLedTxInfoHandler());
    registerGetHandler(server, ROUTE_LATENCY_PROBE, new GetLatencyProbeHandler());
    registerGetHandler(server, ROUTE_LATENCY_ALIGN, new GetLatencyAlignHandler());
    registerGetHandler(server, ROUTE_BEAT_EVENTS_RECENT, new GetBeatEventsRecentHandler());
    registerGetHandler(server, ROUTE_LED_TX_RECENT, new GetLedTxRecentHandler());
    registerGetHandler(server, ROUTE_RMT, new GetRmtDiagHandler());
    registerGetHandler(server, ROUTE_AUDIO_TEMPO, new GetAudioTempoHandler());
    registerGetHandler(server, ROUTE_AUDIO_SNAPSHOT, new GetAudioSnapshotHandler());
    registerGetHandler(server, ROUTE_WIFI_STATUS, new GetWifiStatusHandler());
    registerGetHandler(server, "/api/wifi/scan/results", new GetWifiScanResultsHandler());
    registerGetHandler(server, ROUTE_PATTERN_CURRENT, new GetPatternCurrentHandler());
    registerGetHandler(server, ROUTE_METRICS, new GetMetricsHandler());
    registerGetHandler(server, ROUTE_AUDIO_METRICS, new GetAudioMetricsHandler());
    registerGetHandler(server, ROUTE_BEAT_EVENTS_DUMP, new GetBeatEventsDumpHandler());
    registerGetHandler(server, ROUTE_LED_TX_DUMP, new GetLedTxDumpHandler());
    registerGetHandler(server, ROUTE_AUDIO_ARRAYS, new GetAudioArraysHandler());
    registerGetHandler(server, ROUTE_REALTIME_CONFIG, new GetRealtimeConfigHandler());
    registerPostHandler(server, ROUTE_REALTIME_CONFIG, new PostRealtimeConfigHandler());
    registerPostHandler(server, ROUTE_RMT_RESET, new PostRmtResetHandler());

    // Register remaining GET handlers
    registerGetHandler(server, ROUTE_AUDIO_CONFIG, new GetAudioConfigHandler());
    registerGetHandler(server, ROUTE_CONFIG_BACKUP, new GetConfigBackupHandler());
    registerGetHandler(server, ROUTE_WIFI_LINK_OPTIONS, new GetWifiLinkOptionsHandler());
    registerGetHandler(server, ROUTE_WIFI_CREDENTIALS, new GetWifiCredentialsHandler());

    // GET / - Serve minimal inline HTML dashboard (SPIFFS fallback for Phase 1)
    // Note: Full UI moved to SPIFFS but served inline here until SPIFFS mounting is resolved
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
        String html = R"(<!DOCTYPE html>
<html>
<head>
    <title>K1.reinvented</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #fff; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        h1 { color: #ffd700; }
        .status { background: #222; padding: 10px; border-radius: 5px; margin: 20px 0; }
        .api-test { background: #1a3a3a; padding: 10px; margin: 10px 0; border-left: 3px solid #ffd700; }
        a { color: #ffd700; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .card { background: #1a1a1a; padding: 12px; border-radius: 8px; margin: 16px 0; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .metric { font-size: 14px; color: #ccc; }
        .value { font-size: 24px; color: #fff; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎨 K1.reinvented</h1>
        <p>Light as a Statement</p>

        <div class="status">
            <h2>Status: ✅ Online</h2>
            <p>Web server is running and accepting connections.</p>
            <p>All REST APIs are operational for pattern control and configuration.</p>
        </div>

        <div class="card">
            <h2>Performance</h2>
            <div class="grid">
                <div>
                    <div class="metric">CPU</div>
                    <div class="value"><span id="cpuPercent">—</span>%</div>
                </div>
                <div>
                    <div class="metric">FPS</div>
                    <div class="value"><span id="fps">—</span></div>
                </div>
                <div>
                    <div class="metric">Memory</div>
                    <div class="value"><span id="memoryPercent">—</span>% (<span id="freeKb">—</span> KB free)</div>
                </div>
            </div>
            <small id="perfSource" style="color:#888">Source: detecting…</small>
        </div>

        <h2>Available APIs</h2>
        <div class="api-test">
            <strong>GET /api/patterns</strong> - List all available patterns<br>
            <a href="/api/patterns" target="_blank">Test</a>
        </div>
        <div class="api-test">
            <strong>GET /api/params</strong> - Get current parameters<br>
            <a href="/api/params" target="_blank">Test</a>
        </div>
        <div class="api-test">
            <strong>GET /api/palettes</strong> - List available color palettes<br>
            <a href="/api/palettes" target="_blank">Test</a>
        </div>

        <h2>Next Steps</h2>
        <p>Full web UI with pattern grid and controls available at:</p>
        <code>/ui/index.html</code> (when SPIFFS mounting is fully resolved)

        <p><small>Phase 1: Webserver refactoring complete. Moving to Phase 2: Request handler modularization.</small></p>
    </div>
    <script>
    (function(){
      const els = {
        cpu: document.getElementById('cpuPercent'),
        fps: document.getElementById('fps'),
        memPct: document.getElementById('memoryPercent'),
        freeKb: document.getElementById('freeKb'),
        src: document.getElementById('perfSource'),
      };

      function setValue(el, val, suffix='') {
        if (!el) return;
        if (val === undefined || val === null || Number.isNaN(val)) {
          el.textContent = '—';
        } else {
          const num = typeof val === 'number' ? val.toFixed(1) : val;
          el.textContent = num + (suffix || '');
        }
      }

      function applyPerf(perf) {
        if (!perf) return;
        setValue(els.cpu, perf.cpu_percent);
        setValue(els.fps, perf.fps);
        setValue(els.memPct, perf.memory_percent);
        setValue(els.freeKb, perf.memory_free_kb, '');
      }

      // WebSocket first, REST fallback
      let ws;
      try {
        ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
        ws.onopen = function(){ if (els.src) els.src.textContent = 'Source: WebSocket'; };
        ws.onmessage = function(evt){
          try {
            const msg = JSON.parse(evt.data);
            if (msg && msg.type === 'realtime' && msg.performance) {
              applyPerf(msg.performance);
            }
          } catch (e) {}
        };
        ws.onerror = function(){ startRestFallback(); };
        ws.onclose = function(){ startRestFallback(); };
      } catch(e) { startRestFallback(); }

      let restTimer;
      function startRestFallback(){
        if (els.src) els.src.textContent = 'Source: REST';
        if (restTimer) return;
        restTimer = setInterval(async function(){
          try {
            const res = await fetch('/api/device/performance');
            const json = await res.json();
            applyPerf(json);
          } catch(e) { /* ignore */ }
        }, 2000);
      }
    })();
    </script>
</body>
</html>)";
        request->send(200, "text/html", html);
    });

    // OPTIONS preflight for CORS
    server.onNotFound([](AsyncWebServerRequest *request) {
        if (request->method() == HTTP_OPTIONS) {
            auto *response = request->beginResponse(204);
            attach_cors_headers(response);
            request->send(response);
            return;
        }
        auto *response = request->beginResponse(404, "application/json", "{\"error\":\"Not found\"}");
        attach_cors_headers(response);
        request->send(response);
    });

    // Static file serving is configured below with serveStatic()

    // Initialize WebSocket server
    ws.onEvent(onWebSocketEvent);
    server.addHandler(&ws);

    // Initialize mDNS for device discovery
    if (MDNS.begin("k1-reinvented")) {
        LOG_INFO(TAG_WEB, "mDNS responder started: k1-reinvented.local");

        // Add service advertisement for HTTP server
        MDNS.addService("http", "tcp", 80);
        MDNS.addServiceTxt("http", "tcp", "device", "K1.reinvented");
        MDNS.addServiceTxt("http", "tcp", "version", "2.0");
        MDNS.addServiceTxt("http", "tcp", "api", "/api");

        // Add service advertisement for WebSocket
        MDNS.addService("ws", "tcp", 80);
        MDNS.addServiceTxt("ws", "tcp", "path", "/ws");
        MDNS.addServiceTxt("ws", "tcp", "protocol", "K1RealtimeData");
    } else {
        LOG_ERROR(TAG_WEB, "Error starting mDNS responder");
    }

    // Start server
    server.begin();
    LOG_INFO(TAG_WEB, "Web server started on port 80");
    LOG_INFO(TAG_WEB, "WebSocket server available at /ws");
}

// Handle web server (AsyncWebServer is non-blocking, so this is a no-op)
void handle_webserver() {
    // AsyncWebServer handles requests in the background
    // No action needed in loop()
    
    // Clean up disconnected WebSocket clients periodically
    static uint32_t last_cleanup = 0;
    if (millis() - last_cleanup > 30000) { // Every 30 seconds
        ws.cleanupClients();
        last_cleanup = millis();
    }
}

// WebSocket event handler for real-time updates
static void onWebSocketEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
    switch (type) {
        case WS_EVT_CONNECT:
            LOG_DEBUG(TAG_WEB, "WebSocket client #%u connected from %s", client->id(), client->remoteIP().toString().c_str());
            // Send initial state to new client
            {
                StaticJsonDocument<512> doc;
                doc["type"] = "welcome";
                doc["client_id"] = client->id();
                doc["timestamp"] = millis();
                
                String message;
                serializeJson(doc, message);
                client->text(message);
            }
            break;

        case WS_EVT_DISCONNECT:
            LOG_DEBUG(TAG_WEB, "WebSocket client #%u disconnected", client->id());
            break;
            
        case WS_EVT_DATA:
            {
                AwsFrameInfo *info = (AwsFrameInfo*)arg;
                if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
                    // Handle incoming WebSocket message (for future bidirectional communication)
                    data[len] = 0; // Null terminate
                    LOG_DEBUG(TAG_WEB, "WebSocket message from client #%u: %s", client->id(), (char*)data);
                    
                    // Echo back for now (can be extended for commands)
                    StaticJsonDocument<256> response;
                    response["type"] = "echo";
                    response["message"] = (char*)data;
                    response["timestamp"] = millis();
                    
                    String responseStr;
                    serializeJson(response, responseStr);
                    client->text(responseStr);
                }
            }
            break;
            
        case WS_EVT_PONG:
        case WS_EVT_ERROR:
            break;
    }
}

// Broadcast real-time data to all connected WebSocket clients
void broadcast_realtime_data() {
    if (!s_realtime_ws_enabled || ws.count() == 0) return; // Disabled or no clients

    // Lightweight rate limiting based on current WiFi link options
    // Interval: compile-time default (e.g. 250ms). If forced b/g-only or HT20,
    // apply a minimum floor of 200ms to avoid congesting narrow-band links.
    static uint32_t last_broadcast_ms = 0;
    WifiLinkOptions opts;
    wifi_monitor_get_link_options(opts);
    const uint32_t floor_wifi_ms = (opts.force_bg_only || opts.force_ht20) ? 200u : s_realtime_ws_interval_ms;
    const uint32_t interval_ms = floor_wifi_ms > s_realtime_ws_interval_ms ? floor_wifi_ms : s_realtime_ws_interval_ms;
    uint32_t now = millis();
    if (now - last_broadcast_ms < interval_ms) {
        return;
    }
    last_broadcast_ms = now;
    
    StaticJsonDocument<1024> doc;
    doc["type"] = "realtime";
    doc["timestamp"] = millis();
    
    // Performance data
    JsonObject performance = doc.createNestedObject("performance");
    performance["fps"] = FPS_CPU;
    
    // Calculate frame time and detailed averages from accumulated timings
    float frames = FRAMES_COUNTED.load(std::memory_order_relaxed) > 0
                     ? static_cast<float>(FRAMES_COUNTED.load(std::memory_order_relaxed))
                     : 1.0f;
    uint32_t total_frame_time_us = (ACCUM_RENDER_US + ACCUM_QUANTIZE_US + 
                                   ACCUM_RMT_WAIT_US + ACCUM_RMT_TRANSMIT_US) / frames;
    performance["frame_time_us"] = total_frame_time_us;
    performance["render_avg_us"] = static_cast<float>(ACCUM_RENDER_US.load(std::memory_order_relaxed)) / frames;
    performance["quantize_avg_us"] = static_cast<float>(ACCUM_QUANTIZE_US.load(std::memory_order_relaxed)) / frames;
    performance["rmt_wait_avg_us"] = static_cast<float>(ACCUM_RMT_WAIT_US.load(std::memory_order_relaxed)) / frames;
    performance["rmt_tx_avg_us"] = static_cast<float>(ACCUM_RMT_TRANSMIT_US.load(std::memory_order_relaxed)) / frames;
    performance["cpu_percent"] = cpu_monitor.getAverageCPUUsage();
    
    // Memory statistics
    performance["memory_percent"] = (float)(ESP.getHeapSize() - ESP.getFreeHeap()) / ESP.getHeapSize() * 100.0f;
    performance["memory_free_kb"] = ESP.getFreeHeap() / 1024;
    
    // Audio data
    JsonObject audio = doc.createNestedObject("audio");
    audio["vu_level"] = audio_back.vu_level;
    audio["vu_level_raw"] = audio_back.vu_level_raw;
    audio["tempo_confidence"] = audio_back.tempo_confidence;
    audio["locked_tempo_bpm"] = audio_back.locked_tempo_bpm;
    audio["tempo_lock_state"] = get_tempo_lock_state_string(audio_back.tempo_lock_state);
    
    // Current parameters (full set for real-time updates)
    const PatternParameters& params = get_params();
    JsonObject parameters = doc.createNestedObject("parameters");
    parameters["brightness"] = params.brightness;
    parameters["softness"] = params.softness;
    parameters["color"] = params.color;
    parameters["color_range"] = params.color_range;
    parameters["saturation"] = params.saturation;
    parameters["warmth"] = params.warmth;
    parameters["background"] = params.background;
    parameters["dithering"] = params.dithering;
    parameters["speed"] = params.speed;
    parameters["palette_id"] = params.palette_id;
    parameters["custom_param_1"] = params.custom_param_1;
    parameters["custom_param_2"] = params.custom_param_2;
    parameters["custom_param_3"] = params.custom_param_3;

    // Current pattern selection for UI sync
    doc["current_pattern"] = g_current_pattern_index;
    
    String message;
    serializeJson(doc, message);
    ws.textAll(message);
}

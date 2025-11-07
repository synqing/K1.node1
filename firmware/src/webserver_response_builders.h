// ========================================================================================
//
// webserver_response_builders.h
//
// JSON response building and HTTP utility functions for REST API
// Centralizes response generation to enable consistent formatting and error handling
//
// ========================================================================================

#pragma once

#include <ArduinoJson.h>
#include "parameters.h"
#include "pattern_registry.h"
#include "palettes.h"
#include "logging/logger.h"

// Forward declaration for async web server
class AsyncWebServerResponse;
class AsyncWebServerRequest;

// ========================================================================================
// HTTP Header Utilities
// ========================================================================================

/**
 * Attach CORS headers to response for cross-origin browser requests
 * Allows local dev tools and browsers to interact with the API
 */
static void attach_cors_headers(AsyncWebServerResponse *response) {
    if (!response) return;
    response->addHeader("Access-Control-Allow-Origin", "*");
    response->addHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    response->addHeader("Access-Control-Allow-Headers", "Content-Type");
    response->addHeader("Access-Control-Allow-Credentials", "false");
}

// ========================================================================================
// Error Response Builder
// ========================================================================================

/**
 * Create standardized error response with consistent JSON format
 *
 * @param request The async web request
 * @param status_code HTTP status code (400, 429, 500, etc.)
 * @param error_code Machine-readable error identifier (e.g., "rate_limited", "invalid_json")
 * @param message Optional human-readable error message
 * @return Properly formatted AsyncWebServerResponse with CORS headers
 */
static AsyncWebServerResponse* create_error_response(
    AsyncWebServerRequest *request,
    int status_code,
    const char* error_code,
    const char* message = nullptr
) {
    StaticJsonDocument<256> doc;
    doc["error"] = error_code;
    if (message) {
        doc["message"] = message;
    }
    doc["timestamp"] = millis();
    doc["status"] = status_code;

    String output;
    serializeJson(doc, output);

    AsyncWebServerResponse *response = request->beginResponse(status_code, "application/json", output);
    attach_cors_headers(response);
    return response;
}

// ========================================================================================
// JSON Response Builders
// ========================================================================================

// Function declarations (implementations in webserver_response_builders.cpp)
String build_params_json();
String build_patterns_json();
String build_palettes_json();

// ========================================================================================
// Parameter Update Helpers
// ========================================================================================

/**
 * Apply partial parameter updates from JSON request body
 * Allows clients to update only the fields they provide, leaving others unchanged
 *
 * @param root ArduinoJson JsonObject containing parameter updates
 */
static void apply_params_json(const JsonObjectConst& root) {
    PatternParameters updated = get_params();

    if (root.containsKey("brightness")) {
        float req = root["brightness"].as<float>();
        LOG_DEBUG(TAG_WEB, "Param update: brightness=%.3f", req);
        updated.brightness = req;
    }
    if (root.containsKey("softness")) updated.softness = root["softness"].as<float>();
    if (root.containsKey("color")) updated.color = root["color"].as<float>();
    if (root.containsKey("color_range")) updated.color_range = root["color_range"].as<float>();
    if (root.containsKey("saturation")) updated.saturation = root["saturation"].as<float>();
    if (root.containsKey("warmth")) updated.warmth = root["warmth"].as<float>();
    if (root.containsKey("background")) updated.background = root["background"].as<float>();
    if (root.containsKey("dithering")) updated.dithering = root["dithering"].as<float>();
    if (root.containsKey("speed")) updated.speed = root["speed"].as<float>();
    if (root.containsKey("palette_id")) updated.palette_id = root["palette_id"].as<uint8_t>();
    if (root.containsKey("custom_param_1")) updated.custom_param_1 = root["custom_param_1"].as<float>();
    if (root.containsKey("custom_param_2")) updated.custom_param_2 = root["custom_param_2"].as<float>();
    if (root.containsKey("custom_param_3")) updated.custom_param_3 = root["custom_param_3"].as<float>();

    // Beat gating controls
    if (root.containsKey("beat_threshold")) {
        updated.beat_threshold = root["beat_threshold"].as<float>();
        LOG_DEBUG(TAG_WEB, "Param update: beat_threshold=%.3f", updated.beat_threshold);
    }
    if (root.containsKey("beat_squash_power")) {
        updated.beat_squash_power = root["beat_squash_power"].as<float>();
        LOG_DEBUG(TAG_WEB, "Param update: beat_squash_power=%.3f", updated.beat_squash_power);
    }

    // Audio/Visual Response parameters
    if (root.containsKey("audio_responsiveness")) {
        updated.audio_responsiveness = root["audio_responsiveness"].as<float>();
        LOG_DEBUG(TAG_WEB, "Param update: audio_responsiveness=%.3f", updated.audio_responsiveness);
    }
    if (root.containsKey("audio_sensitivity")) {
        updated.audio_sensitivity = root["audio_sensitivity"].as<float>();
        LOG_DEBUG(TAG_WEB, "Param update: audio_sensitivity=%.3f", updated.audio_sensitivity);
    }
    if (root.containsKey("bass_treble_balance")) {
        updated.bass_treble_balance = root["bass_treble_balance"].as<float>();
        LOG_DEBUG(TAG_WEB, "Param update: bass_treble_balance=%.3f", updated.bass_treble_balance);
    }
    if (root.containsKey("color_reactivity")) {
        updated.color_reactivity = root["color_reactivity"].as<float>();
        LOG_DEBUG(TAG_WEB, "Param update: color_reactivity=%.3f", updated.color_reactivity);
    }
    if (root.containsKey("brightness_floor")) {
        updated.brightness_floor = root["brightness_floor"].as<float>();
        LOG_DEBUG(TAG_WEB, "Param update: brightness_floor=%.3f", updated.brightness_floor);
    }

    // LED transport pacing
    if (root.containsKey("frame_min_period_ms")) {
        updated.frame_min_period_ms = root["frame_min_period_ms"].as<float>();
        LOG_DEBUG(TAG_WEB, "Param update: frame_min_period_ms=%.3f", updated.frame_min_period_ms);
    }

    bool ok = update_params_safe(updated);
    const PatternParameters& applied = get_params();
    LOG_DEBUG(TAG_WEB, "Applied params: brightness=%.3f (valid=%d)", applied.brightness, ok ? 1 : 0);
}

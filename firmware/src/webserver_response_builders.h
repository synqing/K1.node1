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

    auto *response = request->beginResponse(status_code, "application/json", output);
    attach_cors_headers(response);
    return response;
}

// ========================================================================================
// JSON Response Builders
// ========================================================================================

/**
 * Build JSON response for current pattern parameters
 * Used by GET /api/params endpoint
 */
static String build_params_json() {
    const PatternParameters& params = get_params();

    StaticJsonDocument<512> doc;
    // Global visual controls
    doc["brightness"] = params.brightness;
    doc["softness"] = params.softness;
    doc["color"] = params.color;
    doc["color_range"] = params.color_range;
    doc["saturation"] = params.saturation;
    doc["warmth"] = params.warmth;
    doc["background"] = params.background;
    doc["dithering"] = params.dithering;
    // Pattern-specific
    doc["speed"] = params.speed;
    doc["palette_id"] = params.palette_id;
    // Custom parameters (exposed for UI sync)
    doc["custom_param_1"] = params.custom_param_1;
    doc["custom_param_2"] = params.custom_param_2;
    doc["custom_param_3"] = params.custom_param_3;

    // Beat gating controls
    doc["beat_threshold"] = params.beat_threshold;
    doc["beat_squash_power"] = params.beat_squash_power;

    String output;
    serializeJson(doc, output);
    return output;
}

/**
 * Build JSON response for available patterns list
 * Used by GET /api/patterns endpoint
 */
static String build_patterns_json() {
    DynamicJsonDocument doc(2048);
    JsonArray patterns = doc.createNestedArray("patterns");

    for (uint8_t i = 0; i < g_num_patterns; i++) {
        JsonObject pattern = patterns.createNestedObject();
        pattern["index"] = i;
        pattern["id"] = g_pattern_registry[i].id;
        pattern["name"] = g_pattern_registry[i].name;
        pattern["description"] = g_pattern_registry[i].description;
        pattern["is_audio_reactive"] = g_pattern_registry[i].is_audio_reactive;
    }

    doc["current_pattern"] = g_current_pattern_index;

    String output;
    serializeJson(doc, output);
    return output;
}

/**
 * Build JSON response for palette metadata and color previews
 * Used by GET /api/palettes endpoint
 */
static String build_palettes_json() {
    DynamicJsonDocument doc(4096);  // Larger buffer for palette data
    JsonArray palettes = doc.createNestedArray("palettes");

    for (uint8_t i = 0; i < NUM_PALETTES; i++) {
        JsonObject palette = palettes.createNestedObject();
        palette["id"] = i;
        palette["name"] = palette_names[i];

        // Add color preview - sample 5 colors across the palette
        JsonArray colors = palette.createNestedArray("colors");
        for (int j = 0; j < 5; j++) {
            float progress = j / 4.0f;  // 0.0, 0.25, 0.5, 0.75, 1.0
            CRGBF color = color_from_palette(i, progress, 1.0f);
            JsonObject colorObj = colors.createNestedObject();
            colorObj["r"] = (uint8_t)(color.r * 255);
            colorObj["g"] = (uint8_t)(color.g * 255);
            colorObj["b"] = (uint8_t)(color.b * 255);
        }

        // Add metadata
        PaletteInfo info;
        memcpy_P(&info, &palette_table[i], sizeof(PaletteInfo));
        palette["num_keyframes"] = info.num_entries;
    }

    doc["count"] = NUM_PALETTES;

    String output;
    serializeJson(doc, output);
    return output;
}

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

    bool ok = update_params_safe(updated);
    const PatternParameters& applied = get_params();
    LOG_DEBUG(TAG_WEB, "Applied params: brightness=%.3f (valid=%d)", applied.brightness, ok ? 1 : 0);
}

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
/**
 * Build JSON response for current pattern parameters
 *
 * TODO: Serialize all PatternParameters fields to JSON:
 * - brightness, softness, color, color_range, saturation, warmth
 * - background, dithering, speed, palette_id
 * - beat_threshold, beat_squash_power, audio_responsiveness
 * - audio_sensitivity, bass_treble_balance, color_reactivity, brightness_floor
 *
 * @return JSON string with all current pattern parameters
 */
inline String build_params_json() {
    DynamicJsonDocument doc(2048);
    const PatternParameters& params = get_params();

    // TODO: Fill in all parameter fields
    // doc["brightness"] = params.brightness;
    // doc["softness"] = params.softness;
    // doc["color"] = params.color;
    // doc["color_range"] = params.color_range;
    // doc["saturation"] = params.saturation;
    // doc["warmth"] = params.warmth;
    // doc["background"] = params.background;
    // doc["dithering"] = params.dithering;
    // doc["speed"] = params.speed;
    // doc["palette_id"] = params.palette_id;
    // doc["beat_threshold"] = params.beat_threshold;
    // doc["beat_squash_power"] = params.beat_squash_power;
    // doc["audio_responsiveness"] = params.audio_responsiveness;
    // doc["audio_sensitivity"] = params.audio_sensitivity;
    // doc["bass_treble_balance"] = params.bass_treble_balance;
    // doc["color_reactivity"] = params.color_reactivity;
    // doc["brightness_floor"] = params.brightness_floor;

    String output;
    serializeJson(doc, output);
    return output;
}

/**
 * Build JSON response for available patterns
 *
 * TODO: Iterate through pattern_registry and return array of:
 * - pattern name, id, description, is_audio_reactive flag
 *
 * Expected format:
 * {
 *   "patterns": [
 *     {"name": "Spectrum", "id": "spectrum", "description": "...", "audio_reactive": true},
 *     {"name": "Pulse", "id": "pulse", "description": "...", "audio_reactive": true},
 *     ...
 *   ]
 * }
 *
 * @return JSON array of all available patterns with metadata
 */
inline String build_patterns_json() {
    DynamicJsonDocument doc(8192);
    JsonArray patterns = doc.createNestedArray("patterns");

    // TODO: Iterate pattern_registry
    // for (uint16_t i = 0; i < NUM_PATTERNS; i++) {
    //     JsonObject p = patterns.createNestedObject();
    //     p["name"] = pattern_registry[i].name;
    //     p["id"] = pattern_registry[i].id;
    //     p["description"] = pattern_registry[i].description;
    //     p["audio_reactive"] = pattern_registry[i].is_audio_reactive;
    // }

    String output;
    serializeJson(doc, output);
    return output;
}

/**
 * Build JSON response for available color palettes
 *
 * TODO: Iterate through palette_table and return array of:
 * - palette id, name, number of keyframes, color samples
 *
 * Expected format:
 * {
 *   "palettes": [
 *     {"id": 0, "name": "Fire", "keyframes": 5, "colors": [...]},
 *     {"id": 1, "name": "Ocean", "keyframes": 4, "colors": [...]},
 *     ...
 *   ]
 * }
 *
 * @return JSON array of all available palettes with metadata
 */
inline String build_palettes_json() {
    DynamicJsonDocument doc(24576);  // Increased capacity for 33 palettes with colors
    JsonArray palettes = doc.createNestedArray("palettes");

    for (uint8_t i = 0; i < NUM_PALETTES; i++) {
        // Read PaletteInfo from PROGMEM (palette_table is stored in PROGMEM)
        PaletteInfo info;
        memcpy_P(&info, &palette_table[i], sizeof(PaletteInfo));

        // Create palette object with metadata
        JsonObject p = palettes.createNestedObject();
        p["id"] = i;
        p["name"] = palette_names[i];  // palette_names is direct array of const char* pointers
        p["keyframes"] = info.num_entries;

        // Extract color samples from palette data (each entry is 4 bytes: pos, R, G, B)
        JsonArray colors = p.createNestedArray("colors");

        // Allocate buffer for palette data (worst case: 14 keyframes * 4 bytes = 56 bytes)
        // Each palette has a max of ~14 keyframes based on palette_table
        uint8_t palette_data[256];
        size_t palette_bytes = info.num_entries * 4;
        memcpy_P(palette_data, info.data, palette_bytes);

        // Iterate through each keyframe and extract RGB color
        for (uint8_t j = 0; j < info.num_entries; j++) {
            JsonObject color = colors.createNestedObject();
            uint8_t pos = palette_data[j * 4];
            uint8_t r = palette_data[j * 4 + 1];
            uint8_t g = palette_data[j * 4 + 2];
            uint8_t b = palette_data[j * 4 + 3];

            color["position"] = pos;
            color["r"] = r;
            color["g"] = g;
            color["b"] = b;
        }
    }

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

    bool ok = update_params_safe(updated);
    const PatternParameters& applied = get_params();
    LOG_DEBUG(TAG_WEB, "Applied params: brightness=%.3f (valid=%d)", applied.brightness, ok ? 1 : 0);
}

// ========================================================================================
//
// webserver_response_builders.cpp
//
// Implementation of JSON response building functions for REST API
//
// ========================================================================================

#include <ESPAsyncWebServer.h>
#include "webserver_response_builders.h"
#include <ArduinoJson.h>
#include "parameters.h"
#include "pattern_registry.h"
#include "palettes.h"
#include "logging/logger.h"

/**
 * Build JSON response for current pattern parameters
 */
String build_params_json() {
    DynamicJsonDocument doc(2048);
    const PatternParameters& params = get_params();

    doc["brightness"] = params.brightness;
    doc["softness"] = params.softness;
    doc["color"] = params.color;
    doc["color_range"] = params.color_range;
    doc["saturation"] = params.saturation;
    doc["warmth"] = params.warmth;
    doc["background"] = params.background;
    doc["dithering"] = params.dithering;
    doc["mirror_mode"] = (params.mirror_mode >= 0.5f);
    doc["led_offset"] = params.led_offset;
    doc["speed"] = params.speed;
    doc["palette_id"] = params.palette_id;
    doc["beat_threshold"] = params.beat_threshold;
    doc["beat_squash_power"] = params.beat_squash_power;
    doc["audio_responsiveness"] = params.audio_responsiveness;
    doc["audio_sensitivity"] = params.audio_sensitivity;
    doc["bass_treble_balance"] = params.bass_treble_balance;
    doc["color_reactivity"] = params.color_reactivity;
    doc["brightness_floor"] = params.brightness_floor;
    doc["frame_min_period_ms"] = params.frame_min_period_ms;

    String output;
    serializeJson(doc, output);
    return output;
}

/**
 * Build JSON response for available patterns
 */
String build_patterns_json() {
    DynamicJsonDocument doc(8192);
    JsonArray patterns = doc.createNestedArray("patterns");

    for (uint16_t i = 0; i < g_num_patterns; i++) {
        const PatternInfo& info = g_pattern_registry[i];
        JsonObject pattern = patterns.createNestedObject();
        pattern["index"] = i;
        pattern["name"] = info.name;
        pattern["id"] = info.id;
        pattern["description"] = info.description;
        pattern["audio_reactive"] = info.is_audio_reactive;
    }

    doc["current_pattern"] = g_current_pattern_index;

    String output;
    serializeJson(doc, output);
    return output;
}

/**
 * Build JSON response for available color palettes
 */
String build_palettes_json() {
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

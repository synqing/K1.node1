/**
 * @file webserver_bounds.cpp
 * @brief WebServer bounds checking implementation
 */

#include "webserver_bounds.h"
#include <cstring>

// ============================================================================
// BOUNDS CHECKING STATISTICS
// ============================================================================
static BoundsCheckStats g_bounds_stats = {0};

void bounds_init() {
    memset(&g_bounds_stats, 0, sizeof(g_bounds_stats));
}

const BoundsCheckStats& bounds_get_stats() {
    return g_bounds_stats;
}

// ============================================================================
// BOUNDS CHECKING FUNCTIONS (Phase 0)
// ============================================================================

bool bounds_check_strlen(const char* str, size_t max_len) {
    if (!str) return false;
    return strlen(str) <= max_len;
}

uint8_t bounds_safe_strcpy(char* dest, const char* src, size_t dest_size) {
    if (!dest || !src || dest_size == 0) {
        return ERR_HTTP_HEADER_OVERFLOW;
    }

    size_t src_len = strlen(src);
    if (src_len >= dest_size) {
        // Source too long - reject
        g_bounds_stats.string_length_violations++;
        return ERR_HTTP_HEADER_OVERFLOW;
    }

    // Safe: copy with guaranteed null termination
    strncpy(dest, src, dest_size - 1);
    dest[dest_size - 1] = '\0';
    return ERR_OK;
}

uint8_t bounds_check_http_body(size_t body_size) {
    if (body_size > MAX_HTTP_REQUEST_BODY_SIZE) {
        g_bounds_stats.body_size_violations++;
        return ERR_HTTP_BODY_TOO_LARGE;
    }
    return ERR_OK;
}

uint8_t bounds_check_http_headers(uint32_t header_count,
                                   size_t max_single_header_size) {
    // Check header count
    if (header_count > MAX_HTTP_HEADER_COUNT) {
        g_bounds_stats.header_count_violations++;
        return ERR_HTTP_HEADER_OVERFLOW;
    }

    // Check individual header size
    if (max_single_header_size > MAX_HTTP_HEADER_SIZE) {
        g_bounds_stats.header_count_violations++;
        return ERR_HTTP_HEADER_OVERFLOW;
    }

    return ERR_OK;
}

uint8_t bounds_check_query_params(uint32_t param_count) {
    if (param_count > MAX_QUERY_PARAM_COUNT) {
        g_bounds_stats.query_param_violations++;
        return ERR_HTTP_QUERY_PARAM_OVERFLOW;
    }
    return ERR_OK;
}

uint8_t bounds_check_json_size(size_t json_size) {
    if (json_size > MAX_JSON_DOCUMENT_SIZE) {
        g_bounds_stats.json_size_violations++;
        return ERR_JSON_BUFFER_OVERFLOW;
    }
    return ERR_OK;
}

uint8_t bounds_check_json_string(const char* str, size_t max_len) {
    if (!str) {
        return ERR_JSON_PARSE_FAILED;
    }

    size_t str_len = strlen(str);
    if (str_len > max_len) {
        g_bounds_stats.string_length_violations++;
        return ERR_JSON_PARSE_FAILED;
    }

    return ERR_OK;
}

// ============================================================================
// INTEGRATION WITH WEBSERVER
// ============================================================================
// These functions should be called from:
// - AsyncWebServerRequest handlers (check body size)
// - Header parsing (check count and sizes)
// - Query parameter parsing (check count and sizes)
// - JSON parsing (check document and string sizes)
//
// See webserver.cpp for integration points.

/**
 * @file webserver_bounds.h
 * @brief WebServer buffer bounds checking and input validation
 *
 * Defines maximum buffer sizes and provides safe wrapper functions
 * to prevent buffer overflow attacks and malformed request handling.
 *
 * Phase 0 Task 3 - Security Hardening
 */

#ifndef WEBSERVER_BOUNDS_H_
#define WEBSERVER_BOUNDS_H_

#include <stdint.h>
#include <stddef.h>

// ============================================================================
// BUFFER SIZE LIMITS (Phase 0 hardening)
// ============================================================================

// HTTP Request Limits
#define MAX_HTTP_REQUEST_BODY_SIZE      8192    // 8KB max payload
#define MAX_HTTP_HEADER_COUNT           32      // Max headers per request
#define MAX_HTTP_HEADER_SIZE            512     // Max single header size
#define MAX_QUERY_PARAM_COUNT           16      // Max query parameters
#define MAX_QUERY_PARAM_NAME_LEN        64      // Max param name length
#define MAX_QUERY_PARAM_VALUE_LEN       256     // Max param value length

// JSON Processing Limits
#define MAX_JSON_DOCUMENT_SIZE          4096    // Max JSON payload
#define MAX_JSON_KEY_LENGTH             64      // Max JSON key name
#define MAX_JSON_STRING_VALUE_LENGTH    512     // Max JSON string value

// WebSocket Limits
#define MAX_WEBSOCKET_MESSAGE_SIZE      2048    // Max WebSocket message
#define MAX_WEBSOCKET_CONNECTIONS       8       // Max concurrent connections

// String Buffer Limits
#define MAX_API_PATH_LENGTH             256
#define MAX_CONTENT_TYPE_LENGTH         64
#define MAX_HOSTNAME_LENGTH             64

// Error codes for bounds checking (matches error_codes.h)
#define ERR_OK                          0
#define ERR_HTTP_BODY_TOO_LARGE         44
#define ERR_HTTP_HEADER_OVERFLOW        45
#define ERR_HTTP_QUERY_PARAM_OVERFLOW   46
#define ERR_JSON_PARSE_FAILED           47
#define ERR_JSON_BUFFER_OVERFLOW        48

// ============================================================================
// SAFE WRAPPER FUNCTIONS
// ============================================================================

/**
 * Check if string length is within bounds.
 *
 * @param str String pointer
 * @param max_len Maximum allowed length (excluding null terminator)
 * @return true if strlen(str) <= max_len, false otherwise
 */
bool bounds_check_strlen(const char* str, size_t max_len);

/**
 * Safe strncpy with bounds checking and null termination guarantee.
 *
 * @param dest Destination buffer
 * @param src Source string
 * @param dest_size Destination buffer size
 * @return Error code: 0 on success, error code if too long
 */
uint8_t bounds_safe_strcpy(char* dest, const char* src, size_t dest_size);

/**
 * Validate HTTP request body size.
 *
 * @param body_size Size in bytes
 * @return 0 if within limits, ERR_HTTP_BODY_TOO_LARGE if exceeds max
 */
uint8_t bounds_check_http_body(size_t body_size);

/**
 * Validate header count and individual header sizes.
 *
 * @param header_count Number of headers in request
 * @param max_single_header_size Largest single header size
 * @return 0 if valid, ERR_HTTP_HEADER_OVERFLOW if exceeds limits
 */
uint8_t bounds_check_http_headers(uint32_t header_count,
                                   size_t max_single_header_size);

/**
 * Validate query parameter count.
 *
 * @param param_count Number of query parameters
 * @return 0 if valid, ERR_HTTP_QUERY_PARAM_OVERFLOW if too many
 */
uint8_t bounds_check_query_params(uint32_t param_count);

/**
 * Validate JSON document size.
 *
 * @param json_size Size of JSON document in bytes
 * @return 0 if valid, ERR_JSON_BUFFER_OVERFLOW if too large
 */
uint8_t bounds_check_json_size(size_t json_size);

/**
 * Validate individual JSON string value length.
 *
 * @param str JSON string value
 * @param max_len Maximum allowed length
 * @return 0 if valid, ERR_JSON_PARSE_FAILED if too long
 */
uint8_t bounds_check_json_string(const char* str, size_t max_len);

/**
 * Initialize bounds checking system (future: enable statistics).
 */
void bounds_init();

/**
 * Get bounds checking statistics for diagnostics.
 *
 * @return Struct with violation counts
 */
typedef struct {
    uint32_t body_size_violations;
    uint32_t header_count_violations;
    uint32_t query_param_violations;
    uint32_t json_size_violations;
    uint32_t string_length_violations;
} BoundsCheckStats;

const BoundsCheckStats& bounds_get_stats();

#endif  // WEBSERVER_BOUNDS_H_

/**
 * @file error_codes.cpp
 * @brief Error code registry implementation
 *
 * Defines error metadata for all 130 error codes, including:
 * - Error names and descriptions
 * - Severity levels
 * - Recovery actions and remediation steps
 * - Used by telemetry, REST API, and logging systems
 */

#include "error_codes.h"
#include <string.h>
#include <stdio.h>

// ============================================================================
// ERROR METADATA REGISTRY (130 codes)
// ============================================================================
const ErrorMetadata g_error_metadata[] = {
    // System/Core Errors (0-9)
    {0, "ERR_OK", "Operation successful", ERR_SEV_INFO, ERR_ACTION_IGNORE, "No error", "N/A"},
    {1, "ERR_UNKNOWN", "Unknown error occurred", ERR_SEV_HIGH, ERR_ACTION_LOG, "Unexpected state or unhandled exception", "Enable debug logging and retry"},
    {2, "ERR_GENERIC", "Generic error without context", ERR_SEV_MEDIUM, ERR_ACTION_LOG, "Insufficient error information", "Check logs for context"},
    {3, "ERR_NOT_IMPLEMENTED", "Operation not yet implemented", ERR_SEV_LOW, ERR_ACTION_LOG, "Feature stub or incomplete implementation", "Wait for feature release"},
    {4, "ERR_INVALID_STATE", "Invalid state for operation", ERR_SEV_HIGH, ERR_ACTION_LOG, "System state incompatible with operation", "Reset system state or retry after recovery"},
    {5, "ERR_TIMEOUT", "Operation timed out", ERR_SEV_MEDIUM, ERR_ACTION_RETRY, "Operation exceeded time limit", "Check system load and retry"},
    {6, "ERR_HARDWARE_FAULT", "Hardware detection failed", ERR_SEV_CRITICAL, ERR_ACTION_LOG, "GPIO communication or sensor hardware failed", "Check hardware connections and power"},
    {7, "ERR_FIRMWARE_MISMATCH", "Firmware version mismatch", ERR_SEV_HIGH, ERR_ACTION_LOG, "Firmware version incompatible", "Perform OTA update to matching version"},
    {8, "ERR_BUILD_SIGNATURE_INVALID", "Build signature validation failed", ERR_SEV_HIGH, ERR_ACTION_LOG, "Toolchain or build environment mismatch", "Clean rebuild with correct toolchain"},
    {9, "ERR_SYSTEM_BUSY", "System too busy", ERR_SEV_MEDIUM, ERR_ACTION_LOG, "Processing capacity exceeded", "Reduce load or retry later"},

    // WiFi/Network Errors (10-19)
    {10, "ERR_WIFI_NO_CREDENTIALS", "WiFi credentials not configured", ERR_SEV_HIGH, ERR_ACTION_LOG, "WIFI_SSID or WIFI_PASSWORD not set", "Set credentials in .env and redeploy"},
    {11, "ERR_WIFI_SSID_NOT_FOUND", "WiFi network not found", ERR_SEV_MEDIUM, ERR_ACTION_RETRY, "Target network not broadcasting", "Check SSID spelling and network availability"},
    {12, "ERR_WIFI_AUTH_FAILED", "WiFi authentication failed", ERR_SEV_HIGH, ERR_ACTION_LOG, "Wrong password or security mismatch", "Verify WiFi password matches network config"},
    {13, "ERR_WIFI_CONNECT_TIMEOUT", "WiFi connection timed out", ERR_SEV_MEDIUM, ERR_ACTION_RETRY, "Connection attempt exceeded timeout", "Move closer to router or check signal strength"},
    {14, "ERR_WIFI_PROVISIONING_TIMEOUT", "Provisioning mode timed out", ERR_SEV_MEDIUM, ERR_ACTION_LOG, "No credentials supplied during provisioning", "Re-enter provisioning mode and provide credentials"},
    {15, "ERR_WIFI_LINK_LOST", "WiFi connection lost", ERR_SEV_MEDIUM, ERR_ACTION_RETRY, "Network connection dropped unexpectedly", "Reconnection in progress, check network stability"},
    {16, "ERR_NETWORK_UNAVAILABLE", "Network services unavailable", ERR_SEV_MEDIUM, ERR_ACTION_FALLBACK, "No network connectivity", "Check network status and retry"},
    {17, "ERR_DNS_RESOLUTION_FAILED", "DNS name resolution failed", ERR_SEV_LOW, ERR_ACTION_RETRY, "Cannot resolve hostname to IP", "Check DNS configuration and connectivity"},
    {18, "ERR_DHCP_FAILED", "DHCP lease acquisition failed", ERR_SEV_HIGH, ERR_ACTION_RETRY, "DHCP server unavailable or misconfigured", "Check DHCP server or use static IP"},
    {19, "ERR_STATIC_IP_CONFIG_INVALID", "Static IP config invalid", ERR_SEV_HIGH, ERR_ACTION_LOG, "IP address, gateway, or subnet invalid", "Verify static IP configuration in .env"},

    // I2S/Audio Errors (20-29)
    {20, "ERR_I2S_INIT_FAILED", "I2S initialization failed", ERR_SEV_CRITICAL, ERR_ACTION_RESET, "I2S driver init returned error", "Check I2S configuration and IDF version compatibility"},
    {21, "ERR_I2S_CONFIG_INVALID", "I2S configuration invalid", ERR_SEV_CRITICAL, ERR_ACTION_LOG, "Sample rate, bits, or channels invalid", "Verify I2S configuration matches microphone spec"},
    {22, "ERR_I2S_DMA_ALLOC_FAILED", "I2S DMA buffer allocation failed", ERR_SEV_CRITICAL, ERR_ACTION_REBOOT, "Insufficient DMA memory available", "Reduce buffer size or reboot to free memory"},
    {23, "ERR_I2S_CLOCK_CONFIG_FAILED", "I2S clock configuration failed", ERR_SEV_CRITICAL, ERR_ACTION_LOG, "MCLK or clock divider configuration failed", "Check clock source and divider settings"},
    {24, "ERR_I2S_READ_TIMEOUT", "I2S read timed out", ERR_SEV_HIGH, ERR_ACTION_FALLBACK, "Microphone not providing samples", "Check microphone connection and power"},
    {25, "ERR_I2S_READ_OVERRUN", "I2S buffer overrun", ERR_SEV_MEDIUM, ERR_ACTION_FALLBACK, "Samples lost due to buffer overflow", "Increase DMA buffer size or reduce processing load"},
    {26, "ERR_I2S_PIN_CONFIG_FAILED", "I2S pin configuration failed", ERR_SEV_CRITICAL, ERR_ACTION_LOG, "GPIO pin mapping failed", "Check pin definitions in config"},
    {27, "ERR_MICROPHONE_INIT_FAILED", "Microphone initialization failed", ERR_SEV_CRITICAL, ERR_ACTION_LOG, "SPH0645 or microphone init failed", "Check microphone power, SPI/I2S connections"},
    {28, "ERR_AUDIO_BUFFER_EXHAUSTED", "Audio buffer capacity exceeded", ERR_SEV_MEDIUM, ERR_ACTION_FALLBACK, "Audio ring buffer full", "Increase buffer size or reduce sample rate"},
    {29, "ERR_AUDIO_PROCESSING_STALLED", "Audio processing stalled", ERR_SEV_HIGH, ERR_ACTION_RESET, "Audio task not responding", "Restart audio pipeline"},

    // RMT/LED Errors (30-39)
    {30, "ERR_RMT_INIT_FAILED", "RMT initialization failed", ERR_SEV_CRITICAL, ERR_ACTION_RESET, "RMT driver init failed", "Check RMT driver and IDF version"},
    {31, "ERR_RMT_CONFIG_INVALID", "RMT configuration invalid", ERR_SEV_CRITICAL, ERR_ACTION_LOG, "RMT config incompatible with hardware", "Verify RMT clock and channel config"},
    {32, "ERR_RMT_ALLOCATE_FAILED", "RMT channel allocation failed", ERR_SEV_CRITICAL, ERR_ACTION_LOG, "RMT channels exhausted or locked", "Reduce number of concurrent RMT channels"},
    {33, "ERR_RMT_DMA_ALLOC_FAILED", "RMT DMA buffer allocation failed", ERR_SEV_CRITICAL, ERR_ACTION_REBOOT, "Insufficient DMA memory for RMT", "Reduce LED count or reboot"},
    {34, "ERR_RMT_ENCODER_CONFIG_FAILED", "RMT encoder configuration failed", ERR_SEV_CRITICAL, ERR_ACTION_LOG, "LED encoder init failed", "Check encoder configuration for WS2812 protocol"},
    {35, "ERR_RMT_TRANSMIT_TIMEOUT", "RMT transmit timed out", ERR_SEV_HIGH, ERR_ACTION_RESET, "LED transmission exceeded timeout", "Check LED strip connection and power"},
    {36, "ERR_RMT_DUAL_CHANNEL_SYNC_FAIL", "Dual-channel sync failed", ERR_SEV_HIGH, ERR_ACTION_FALLBACK, "Cannot synchronize two RMT channels", "Disable dual-channel mode or check channel timing"},
    {37, "ERR_RMT_MEMORY_BLOCK_EXHAUSTED", "RMT memory blocks exhausted", ERR_SEV_HIGH, ERR_ACTION_LOG, "RMT memory blocks insufficient for LED count", "Reduce LED count below mem_block_symbols limit"},
    {38, "ERR_LED_DATA_INVALID", "LED data invalid", ERR_SEV_MEDIUM, ERR_ACTION_FALLBACK, "LED frame data corrupted or invalid", "Check pattern rendering and buffer integrity"},
    {39, "ERR_LED_OUTPUT_STALLED", "LED output stalled", ERR_SEV_MEDIUM, ERR_ACTION_RESET, "LED transmission loop not responding", "Reset LED driver and pattern"},

    // WebServer Errors (40-49)
    {40, "ERR_WEBSERVER_INIT_FAILED", "WebServer initialization failed", ERR_SEV_HIGH, ERR_ACTION_LOG, "ESPAsyncWebServer init failed", "Check port availability and WiFi status"},
    {41, "ERR_WEBSERVER_PORT_IN_USE", "WebServer port in use", ERR_SEV_HIGH, ERR_ACTION_LOG, "Port 80 or 443 already in use", "Change port or kill conflicting process"},
    {42, "ERR_WEBSERVER_HANDLER_ERROR", "Request handler error", ERR_SEV_MEDIUM, ERR_ACTION_LOG, "Handler threw unhandled exception", "Check logs for handler error details"},
    {43, "ERR_HTTP_REQUEST_INVALID", "Invalid HTTP request", ERR_SEV_LOW, ERR_ACTION_IGNORE, "Malformed HTTP request syntax", "Verify request format and send again"},
    {44, "ERR_HTTP_BODY_TOO_LARGE", "HTTP body too large", ERR_SEV_LOW, ERR_ACTION_IGNORE, "Request body exceeds max size limit", "Reduce request body size"},
    {45, "ERR_HTTP_HEADER_OVERFLOW", "HTTP header overflow", ERR_SEV_LOW, ERR_ACTION_IGNORE, "Too many HTTP headers", "Reduce header count"},
    {46, "ERR_HTTP_QUERY_PARAM_OVERFLOW", "Query param overflow", ERR_SEV_LOW, ERR_ACTION_IGNORE, "Too many query parameters", "Reduce parameter count"},
    {47, "ERR_JSON_PARSE_FAILED", "JSON parsing failed", ERR_SEV_MEDIUM, ERR_ACTION_LOG, "Invalid JSON syntax or format", "Verify JSON syntax and format"},
    {48, "ERR_JSON_BUFFER_OVERFLOW", "JSON buffer overflow", ERR_SEV_MEDIUM, ERR_ACTION_IGNORE, "JSON document too large", "Reduce JSON document size"},
    {49, "ERR_WEBSOCKET_CONNECTION_LOST", "WebSocket connection lost", ERR_SEV_LOW, ERR_ACTION_LOG, "Client disconnected unexpectedly", "Reconnect WebSocket client"},

    // Parameter/Config Errors (50-59)
    {50, "ERR_PARAM_INVALID", "Parameter out of range", ERR_SEV_LOW, ERR_ACTION_LOG, "Parameter value exceeds valid range", "Set value within documented range"},
    {51, "ERR_PARAM_NOT_FOUND", "Parameter not found", ERR_SEV_LOW, ERR_ACTION_LOG, "Parameter name not in registry", "Verify parameter name spelling"},
    {52, "ERR_PARAM_READ_FAILED", "Parameter read failed", ERR_SEV_MEDIUM, ERR_ACTION_FALLBACK, "Failed to read parameter from storage", "Use default value and try again"},
    {53, "ERR_PARAM_WRITE_FAILED", "Parameter write failed", ERR_SEV_MEDIUM, ERR_ACTION_RETRY, "Failed to write parameter to storage", "Retry or restart system"},
    {54, "ERR_PARAM_LOCK_CONTENTION", "Parameter lock timeout", ERR_SEV_MEDIUM, ERR_ACTION_RETRY, "Parameter access lock contention", "Reduce concurrent parameter access"},
    {55, "ERR_CONFIG_LOAD_FAILED", "Config load failed", ERR_SEV_HIGH, ERR_ACTION_FALLBACK, "Configuration file not found or corrupted", "Use default configuration"},
    {56, "ERR_CONFIG_SAVE_FAILED", "Config save failed", ERR_SEV_MEDIUM, ERR_ACTION_LOG, "Failed to save configuration", "Check storage space and retry"},
    {57, "ERR_CONFIG_CORRUPTION_DETECTED", "Config corrupted", ERR_SEV_HIGH, ERR_ACTION_FALLBACK, "Configuration file integrity check failed", "Restore from backup or use defaults"},
    {58, "ERR_CONFIG_VERSION_MISMATCH", "Config version mismatch", ERR_SEV_HIGH, ERR_ACTION_LOG, "Configuration version incompatible", "Migrate configuration or reset to defaults"},
    {59, "ERR_ENV_VAR_MISSING", "Environment variable missing", ERR_SEV_HIGH, ERR_ACTION_LOG, "Required .env variable not set", "Add variable to .env file"},

    // Storage/SPIFFS Errors (60-69)
    {60, "ERR_SPIFFS_MOUNT_FAILED", "SPIFFS mount failed", ERR_SEV_HIGH, ERR_ACTION_RESET, "SPIFFS filesystem not mounted", "Format SPIFFS and retry"},
    {61, "ERR_SPIFFS_FORMAT_FAILED", "SPIFFS format failed", ERR_SEV_CRITICAL, ERR_ACTION_LOG, "SPIFFS format operation failed", "Check storage hardware"},
    {62, "ERR_SPIFFS_FILE_NOT_FOUND", "File not found", ERR_SEV_LOW, ERR_ACTION_FALLBACK, "Requested file not in SPIFFS", "Upload file to device"},
    {63, "ERR_SPIFFS_FILE_WRITE_FAILED", "File write failed", ERR_SEV_MEDIUM, ERR_ACTION_LOG, "SPIFFS write operation failed", "Check storage space and retry"},
    {64, "ERR_SPIFFS_FILE_READ_FAILED", "File read failed", ERR_SEV_MEDIUM, ERR_ACTION_RETRY, "SPIFFS read operation failed", "Retry or check file integrity"},
    {65, "ERR_SPIFFS_STORAGE_FULL", "SPIFFS storage full", ERR_SEV_HIGH, ERR_ACTION_LOG, "No space available in SPIFFS", "Delete unused files"},
    {66, "ERR_SPIFFS_CORRUPTION", "SPIFFS corrupted", ERR_SEV_HIGH, ERR_ACTION_RESET, "SPIFFS filesystem corrupted", "Reformat SPIFFS"},
    {67, "ERR_NVS_INIT_FAILED", "NVS initialization failed", ERR_SEV_CRITICAL, ERR_ACTION_LOG, "NVS driver init failed", "Check NVS partition configuration"},
    {68, "ERR_NVS_READ_FAILED", "NVS read failed", ERR_SEV_MEDIUM, ERR_ACTION_FALLBACK, "NVS read operation failed", "Use default value"},
    {69, "ERR_NVS_WRITE_FAILED", "NVS write failed", ERR_SEV_MEDIUM, ERR_ACTION_RETRY, "NVS write operation failed", "Check storage space and retry"},

    // OTA/Firmware Update Errors (70-79)
    {70, "ERR_OTA_NOT_AVAILABLE", "OTA not available", ERR_SEV_LOW, ERR_ACTION_LOG, "OTA updates not enabled", "Enable OTA in configuration"},
    {71, "ERR_OTA_INIT_FAILED", "OTA initialization failed", ERR_SEV_HIGH, ERR_ACTION_LOG, "OTA driver init failed", "Check WiFi and ArduinoOTA config"},
    {72, "ERR_OTA_BEGIN_FAILED", "OTA begin failed", ERR_SEV_HIGH, ERR_ACTION_LOG, "OTA update begin failed", "Check OTA server and network connectivity"},
    {73, "ERR_OTA_RECEIVE_FAILED", "OTA receive failed", ERR_SEV_HIGH, ERR_ACTION_RETRY, "Failed to receive OTA data", "Retry OTA update"},
    {74, "ERR_OTA_WRITE_FAILED", "OTA write failed", ERR_SEV_CRITICAL, ERR_ACTION_LOG, "Failed to write OTA data to flash", "Check flash integrity"},
    {75, "ERR_OTA_END_FAILED", "OTA finalization failed", ERR_SEV_CRITICAL, ERR_ACTION_LOG, "OTA finalization failed", "Restart OTA process"},
    {76, "ERR_OTA_AUTH_FAILED", "OTA authentication failed", ERR_SEV_HIGH, ERR_ACTION_LOG, "OTA password mismatch", "Verify OTA credentials"},
    {77, "ERR_OTA_TIMEOUT", "OTA timeout", ERR_SEV_MEDIUM, ERR_ACTION_RETRY, "OTA operation exceeded timeout", "Retry with better network connection"},
    {78, "ERR_OTA_VERSION_DOWNGRADE", "Version downgrade attempted", ERR_SEV_HIGH, ERR_ACTION_LOG, "Downgrade not permitted", "Use newer firmware version"},
    {79, "ERR_OTA_COMPATIBILITY_CHECK", "Compatibility check failed", ERR_SEV_HIGH, ERR_ACTION_LOG, "Firmware incompatible with hardware", "Use compatible firmware version"},

    // Synchronization/Concurrency Errors (80-89)
    {80, "ERR_MUTEX_ACQUIRE_TIMEOUT", "Mutex acquire timeout", ERR_SEV_MEDIUM, ERR_ACTION_LOG, "Mutex lock contention or deadlock", "Reduce lock contention or increase timeout"},
    {81, "ERR_SPINLOCK_ACQUIRE_TIMEOUT", "Spinlock acquire timeout", ERR_SEV_MEDIUM, ERR_ACTION_LOG, "Spinlock contention detected", "Reduce concurrent access"},
    {82, "ERR_SEMAPHORE_ACQUIRE_TIMEOUT", "Semaphore timeout", ERR_SEV_MEDIUM, ERR_ACTION_LOG, "Semaphore wait exceeded timeout", "Reduce wait time or increase resources"},
    {83, "ERR_QUEUE_FULL", "Queue full", ERR_SEV_LOW, ERR_ACTION_LOG, "Message queue capacity exceeded", "Increase queue size or reduce message rate"},
    {84, "ERR_QUEUE_EMPTY", "Queue empty", ERR_SEV_LOW, ERR_ACTION_IGNORE, "Attempt to dequeue from empty queue", "Check queue status before dequeue"},
    {85, "ERR_RINGBUFFER_OVERRUN", "Ring buffer overrun", ERR_SEV_MEDIUM, ERR_ACTION_FALLBACK, "Ring buffer data overwritten", "Increase buffer size or reduce write rate"},
    {86, "ERR_RINGBUFFER_UNDERRUN", "Ring buffer underrun", ERR_SEV_MEDIUM, ERR_ACTION_FALLBACK, "Ring buffer read when empty", "Ensure sufficient buffered data"},
    {87, "ERR_TASK_CREATION_FAILED", "Task creation failed", ERR_SEV_CRITICAL, ERR_ACTION_REBOOT, "FreeRTOS task creation failed", "Check memory and reboot"},
    {88, "ERR_ISR_NESTING_LIMIT", "ISR nesting limit exceeded", ERR_SEV_CRITICAL, ERR_ACTION_LOG, "Interrupt nesting too deep", "Reduce ISR complexity"},
    {89, "ERR_CRITICAL_SECTION_TIMEOUT", "Critical section timeout", ERR_SEV_MEDIUM, ERR_ACTION_LOG, "Critical section lock exceeded", "Reduce critical section time"},

    // Resource/Memory Errors (90-99)
    {90, "ERR_MALLOC_FAILED", "Memory allocation failed", ERR_SEV_CRITICAL, ERR_ACTION_FALLBACK, "malloc returned NULL", "Check heap usage and free memory"},
    {91, "ERR_STACK_OVERFLOW", "Stack overflow", ERR_SEV_CRITICAL, ERR_ACTION_REBOOT, "Task stack exceeded limit", "Increase task stack size"},
    {92, "ERR_HEAP_EXHAUSTED", "Heap memory exhausted", ERR_SEV_CRITICAL, ERR_ACTION_REBOOT, "All heap memory consumed", "Free unused memory or increase heap"},
    {93, "ERR_PSRAM_INIT_FAILED", "PSRAM initialization failed", ERR_SEV_HIGH, ERR_ACTION_LOG, "PSRAM driver init failed", "Check PSRAM hardware and connections"},
    {94, "ERR_DMA_BUFFER_ALLOC_FAILED", "DMA buffer alloc failed", ERR_SEV_CRITICAL, ERR_ACTION_LOG, "DMA memory allocation failed", "Reduce DMA buffer size"},
    {95, "ERR_RESOURCE_NOT_AVAILABLE", "Resource unavailable", ERR_SEV_MEDIUM, ERR_ACTION_FALLBACK, "Required system resource not available", "Wait and retry"},
    {96, "ERR_INTERRUPT_ALLOC_FAILED", "Interrupt alloc failed", ERR_SEV_CRITICAL, ERR_ACTION_LOG, "Cannot allocate interrupt handler", "Reduce interrupt usage"},
    {97, "ERR_SEMAPHORE_ALLOC_FAILED", "Semaphore alloc failed", ERR_SEV_CRITICAL, ERR_ACTION_REBOOT, "Cannot allocate semaphore", "Check memory and reboot"},
    {98, "ERR_QUEUE_ALLOC_FAILED", "Queue alloc failed", ERR_SEV_CRITICAL, ERR_ACTION_REBOOT, "Cannot allocate queue", "Check memory and reboot"},
    {99, "ERR_TASK_ALLOC_FAILED", "Task alloc failed", ERR_SEV_CRITICAL, ERR_ACTION_REBOOT, "Cannot allocate task structure", "Check memory and reboot"},

    // Audio Processing Errors (100-109)
    {100, "ERR_AUDIO_DFT_CONFIG_FAILED", "DFT config failed", ERR_SEV_HIGH, ERR_ACTION_LOG, "Goertzel DFT initialization failed", "Check sample rate and frequency config"},
    {101, "ERR_AUDIO_WINDOW_INIT_FAILED", "Window init failed", ERR_SEV_HIGH, ERR_ACTION_LOG, "Audio window function init failed", "Check window configuration"},
    {102, "ERR_AUDIO_VU_METER_FAILED", "VU meter failed", ERR_SEV_MEDIUM, ERR_ACTION_LOG, "VU meter calculation error", "Check audio input signal"},
    {103, "ERR_TEMPO_DETECTION_FAILED", "Tempo detection failed", ERR_SEV_MEDIUM, ERR_ACTION_LOG, "Tempo algorithm error", "Check audio signal characteristics"},
    {104, "ERR_CHROMAGRAM_CALC_FAILED", "Chromagram failed", ERR_SEV_MEDIUM, ERR_ACTION_LOG, "Chromagram calculation error", "Check audio signal"},
    {105, "ERR_BEAT_DETECTION_FAILED", "Beat detection failed", ERR_SEV_MEDIUM, ERR_ACTION_LOG, "Beat detection algorithm error", "Verify beat threshold settings"},
    {106, "ERR_NOVELTY_CALC_FAILED", "Novelty calculation failed", ERR_SEV_LOW, ERR_ACTION_LOG, "Novelty metric computation failed", "Check audio buffer state"},
    {107, "ERR_SILENCE_DETECTION_FAILED", "Silence detection failed", ERR_SEV_LOW, ERR_ACTION_LOG, "Silence threshold evaluation failed", "Adjust silence threshold"},
    {108, "ERR_AUDIO_FEATURE_OVERFLOW", "Audio feature overflow", ERR_SEV_MEDIUM, ERR_ACTION_FALLBACK, "Audio feature value exceeded limits", "Reduce audio gain or clamp values"},
    {109, "ERR_AUDIO_PIPELINE_DESYNC", "Audio pipeline desync", ERR_SEV_HIGH, ERR_ACTION_RESET, "Audio frames out of synchronization", "Restart audio pipeline"},

    // Pattern/Rendering Errors (110-119)
    {110, "ERR_PATTERN_NOT_FOUND", "Pattern not found", ERR_SEV_LOW, ERR_ACTION_FALLBACK, "Pattern index out of range", "Select valid pattern index"},
    {111, "ERR_PATTERN_LOAD_FAILED", "Pattern load failed", ERR_SEV_MEDIUM, ERR_ACTION_FALLBACK, "Pattern initialization failed", "Check pattern configuration"},
    {112, "ERR_PATTERN_RENDER_FAILED", "Pattern render failed", ERR_SEV_MEDIUM, ERR_ACTION_FALLBACK, "Pattern rendering threw error", "Check pattern parameters"},
    {113, "ERR_PATTERN_INVALID_STATE", "Pattern invalid state", ERR_SEV_MEDIUM, ERR_ACTION_RESET, "Pattern in inconsistent state", "Reset pattern"},
    {114, "ERR_PATTERN_MEMORY_EXCEEDED", "Pattern memory exceeded", ERR_SEV_MEDIUM, ERR_ACTION_LOG, "Pattern exceeds memory limits", "Use simpler pattern or increase memory"},
    {115, "ERR_LED_BUFFER_ALLOC_FAILED", "LED buffer alloc failed", ERR_SEV_CRITICAL, ERR_ACTION_REBOOT, "Cannot allocate LED frame buffer", "Reduce LED count or increase memory"},
    {116, "ERR_PALETTE_NOT_FOUND", "Palette not found", ERR_SEV_LOW, ERR_ACTION_FALLBACK, "Color palette not in registry", "Use default palette"},
    {117, "ERR_PALETTE_LOAD_FAILED", "Palette load failed", ERR_SEV_MEDIUM, ERR_ACTION_FALLBACK, "Palette initialization failed", "Check palette configuration"},
    {118, "ERR_EASING_FUNCTION_INVALID", "Invalid easing function", ERR_SEV_LOW, ERR_ACTION_FALLBACK, "Easing function not supported", "Use supported easing function"},
    {119, "ERR_ANIMATION_STATE_CORRUPTED", "Animation state corrupted", ERR_SEV_MEDIUM, ERR_ACTION_RESET, "Animation state invalid", "Reset animation"},

    // Telemetry/Diagnostics Errors (120-129)
    {120, "ERR_TELEMETRY_BUFFER_FULL", "Telemetry buffer full", ERR_SEV_LOW, ERR_ACTION_LOG, "Telemetry ring buffer full", "Increase buffer size or reduce frequency"},
    {121, "ERR_TELEMETRY_WRITE_FAILED", "Telemetry write failed", ERR_SEV_LOW, ERR_ACTION_LOG, "Failed to write telemetry data", "Retry write operation"},
    {122, "ERR_PROFILER_INIT_FAILED", "Profiler init failed", ERR_SEV_LOW, ERR_ACTION_LOG, "Performance profiler init failed", "Check profiler configuration"},
    {123, "ERR_HEARTBEAT_MISSED", "Heartbeat missed", ERR_SEV_MEDIUM, ERR_ACTION_LOG, "Diagnostic heartbeat not received", "Check system responsiveness"},
    {124, "ERR_DIAGNOSTICS_DISABLED", "Diagnostics disabled", ERR_SEV_LOW, ERR_ACTION_LOG, "Diagnostics feature not enabled", "Enable diagnostics in config"},
    {125, "ERR_PROBE_OVERHEAD_EXCEEDED", "Probe overhead exceeded", ERR_SEV_LOW, ERR_ACTION_LOG, "Measurement probe overhead too high", "Reduce probe frequency"},
    {126, "ERR_TIMESTAMP_SYNC_FAILED", "Timestamp sync failed", ERR_SEV_MEDIUM, ERR_ACTION_LOG, "Time synchronization failed", "Resync with time source"},
    {127, "ERR_METRICS_AGGREGATION_ERROR", "Metrics aggregation error", ERR_SEV_LOW, ERR_ACTION_LOG, "Failed to aggregate metrics", "Check metric sources"},
    {128, "ERR_DIAG_ENDPOINT_UNAVAILABLE", "Diag endpoint unavailable", ERR_SEV_LOW, ERR_ACTION_LOG, "Diagnostics REST endpoint not available", "Enable diagnostics endpoint"},
    {129, "ERR_LOG_ROTATION_FAILED", "Log rotation failed", ERR_SEV_LOW, ERR_ACTION_LOG, "Failed to rotate log files", "Check storage space"},
};

// Count of error metadata entries
const uint16_t g_error_metadata_count = sizeof(g_error_metadata) / sizeof(ErrorMetadata);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const ErrorMetadata* error_lookup(uint8_t error_code) {
    for (uint16_t i = 0; i < g_error_metadata_count; i++) {
        if (g_error_metadata[i].code == error_code) {
            return &g_error_metadata[i];
        }
    }
    return NULL;  // Error code not found
}

const char* error_severity_to_string(ErrorSeverity severity) {
    switch (severity) {
        case ERR_SEV_INFO:     return "INFO";
        case ERR_SEV_LOW:      return "LOW";
        case ERR_SEV_MEDIUM:   return "MEDIUM";
        case ERR_SEV_HIGH:     return "HIGH";
        case ERR_SEV_CRITICAL: return "CRITICAL";
        default:               return "UNKNOWN";
    }
}

const char* error_action_to_string(ErrorRecoveryAction action) {
    switch (action) {
        case ERR_ACTION_IGNORE:    return "IGNORE";
        case ERR_ACTION_LOG:       return "LOG";
        case ERR_ACTION_RETRY:     return "RETRY";
        case ERR_ACTION_FALLBACK:  return "FALLBACK";
        case ERR_ACTION_RESET:     return "RESET";
        case ERR_ACTION_REBOOT:    return "REBOOT";
        default:                   return "UNKNOWN";
    }
}

int error_to_json(uint8_t error_code, char* buffer, size_t buffer_size) {
    if (!buffer || buffer_size < 100) {
        return -1;  // Buffer too small
    }

    const ErrorMetadata* meta = error_lookup(error_code);
    if (!meta) {
        snprintf(buffer, buffer_size,
                 "{\"error_code\":%d,\"name\":\"ERR_UNKNOWN\",\"message\":\"Unknown error code\"}",
                 error_code);
        return strlen(buffer);
    }

    int len = snprintf(buffer, buffer_size,
                       "{\"error_code\":%d,"
                       "\"name\":\"%s\","
                       "\"message\":\"%s\","
                       "\"severity\":\"%s\","
                       "\"recovery_action\":\"%s\","
                       "\"cause\":\"%s\","
                       "\"remediation\":\"%s\"}",
                       meta->code,
                       meta->name,
                       meta->description,
                       error_severity_to_string(meta->severity),
                       error_action_to_string(meta->recovery),
                       meta->cause,
                       meta->remediation);

    return (len > 0 && len < (int)buffer_size) ? len : -1;
}

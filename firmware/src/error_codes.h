/**
 * @file error_codes.h
 * @brief Centralized error code registry for K1.node1 firmware
 *
 * All errors in the system are represented by error codes (0-255) with:
 * - Unique identifier
 * - Severity level (CRITICAL, HIGH, MEDIUM, LOW, INFO)
 * - Recovery action (RETRY, FALLBACK, REBOOT, IGNORE)
 * - Human-readable description
 *
 * Error codes are transmitted in:
 * - REST API responses
 * - WebSocket diagnostics
 * - Serial telemetry
 * - Log entries
 *
 * @date 2025-11-10 (Phase 0 - Security Hardening & Error Management)
 */

#ifndef ERROR_CODES_H_
#define ERROR_CODES_H_

#include <stdint.h>
#include <stddef.h>  // for size_t

// ============================================================================
// SEVERITY LEVELS
// ============================================================================
typedef enum {
    ERR_SEV_INFO = 0,       // Informational - no action required
    ERR_SEV_LOW = 1,        // Low priority - degraded functionality
    ERR_SEV_MEDIUM = 2,     // Medium priority - significant impact
    ERR_SEV_HIGH = 3,       // High priority - critical functionality affected
    ERR_SEV_CRITICAL = 4,   // Critical - system may become unstable
} ErrorSeverity;

// ============================================================================
// RECOVERY ACTIONS
// ============================================================================
typedef enum {
    ERR_ACTION_IGNORE = 0,    // No action - continue normally
    ERR_ACTION_LOG = 1,       // Log and continue with degraded service
    ERR_ACTION_RETRY = 2,     // Retry the operation (bounded retries)
    ERR_ACTION_FALLBACK = 3,  // Use fallback/default behavior
    ERR_ACTION_RESET = 4,     // Reset subsystem and retry
    ERR_ACTION_REBOOT = 5,    // Reboot device (last resort)
} ErrorRecoveryAction;

// ============================================================================
// ERROR CODE DEFINITIONS (0-255)
// ============================================================================
// Format: ERR_{SUBSYSTEM}_{SPECIFIC}
// Range allocation:
//   0-9:   System/Core errors
//   10-19: WiFi/Network errors
//   20-29: I2S/Audio errors
//   30-39: RMT/LED errors
//   40-49: WebServer errors
//   50-59: Parameter/Config errors
//   60-69: Storage/SPIFFS errors
//   70-79: OTA/Firmware errors
//   80-89: Synchronization errors
//   90-99: Resource/Memory errors
//   100-109: Audio processing errors
//   110-119: Pattern/Rendering errors
//   120-129: Telemetry/Diagnostics errors
//   130-255: Reserved/Custom

// Core System Errors (0-9)
#define ERR_OK                          0   // No error - operation successful
#define ERR_UNKNOWN                     1   // Unknown error - unexpected state
#define ERR_GENERIC                     2   // Generic error - insufficient context
#define ERR_NOT_IMPLEMENTED             3   // Operation not implemented
#define ERR_INVALID_STATE               4   // Invalid system state for operation
#define ERR_TIMEOUT                     5   // Operation timed out
#define ERR_HARDWARE_FAULT              6   // Hardware detection/communication failed
#define ERR_FIRMWARE_MISMATCH           7   // Firmware version mismatch
#define ERR_BUILD_SIGNATURE_INVALID     8   // Build signature validation failed
#define ERR_SYSTEM_BUSY                 9   // System too busy to process request

// WiFi/Network Errors (10-19)
#define ERR_WIFI_NO_CREDENTIALS        10   // WiFi credentials not configured
#define ERR_WIFI_SSID_NOT_FOUND        11   // Target WiFi network not found
#define ERR_WIFI_AUTH_FAILED           12   // WiFi authentication failed (wrong password)
#define ERR_WIFI_CONNECT_TIMEOUT       13   // WiFi connection attempt timed out
#define ERR_WIFI_PROVISIONING_TIMEOUT  14   // Provisioning mode timed out
#define ERR_WIFI_LINK_LOST             15   // WiFi connection lost unexpectedly
#define ERR_NETWORK_UNAVAILABLE        16   // Network services unavailable
#define ERR_DNS_RESOLUTION_FAILED      17   // DNS name resolution failed
#define ERR_DHCP_FAILED                18   // DHCP lease acquisition failed
#define ERR_STATIC_IP_CONFIG_INVALID   19   // Static IP configuration invalid

// I2S/Audio Errors (20-29)
#define ERR_I2S_INIT_FAILED            20   // I2S driver initialization failed
#define ERR_I2S_CONFIG_INVALID         21   // I2S configuration invalid
#define ERR_I2S_DMA_ALLOC_FAILED       22   // I2S DMA buffer allocation failed
#define ERR_I2S_CLOCK_CONFIG_FAILED    23   // I2S clock configuration failed
#define ERR_I2S_READ_TIMEOUT           24   // I2S read operation timed out
#define ERR_I2S_READ_OVERRUN           25   // I2S DMA buffer overrun (samples lost)
#define ERR_I2S_PIN_CONFIG_FAILED      26   // I2S pin configuration failed
#define ERR_MICROPHONE_INIT_FAILED     27   // Microphone initialization failed
#define ERR_AUDIO_BUFFER_EXHAUSTED     28   // Audio buffer capacity exceeded
#define ERR_AUDIO_PROCESSING_STALLED   29   // Audio processing loop stalled

// RMT/LED Errors (30-39)
#define ERR_RMT_INIT_FAILED            30   // RMT driver initialization failed
#define ERR_RMT_CONFIG_INVALID         31   // RMT configuration invalid
#define ERR_RMT_ALLOCATE_FAILED        32   // RMT channel allocation failed
#define ERR_RMT_DMA_ALLOC_FAILED       33   // RMT DMA buffer allocation failed
#define ERR_RMT_ENCODER_CONFIG_FAILED  34   // RMT LED encoder configuration failed
#define ERR_RMT_TRANSMIT_TIMEOUT       35   // RMT transmit timed out (LED stuck)
#define ERR_RMT_DUAL_CHANNEL_SYNC_FAIL 36   // Dual-channel RMT synchronization failed
#define ERR_RMT_MEMORY_BLOCK_EXHAUSTED 37   // RMT memory block capacity exceeded
#define ERR_LED_DATA_INVALID           38   // LED data invalid or corrupted
#define ERR_LED_OUTPUT_STALLED         39   // LED output loop stalled

// WebServer Errors (40-49)
#define ERR_WEBSERVER_INIT_FAILED      40   // WebServer initialization failed
#define ERR_WEBSERVER_PORT_IN_USE      41   // WebServer port already in use
#define ERR_WEBSERVER_HANDLER_ERROR    42   // Request handler threw exception
#define ERR_HTTP_REQUEST_INVALID       43   // Invalid HTTP request
#define ERR_HTTP_BODY_TOO_LARGE        44   // HTTP request body exceeds max size
#define ERR_HTTP_HEADER_OVERFLOW       45   // HTTP header count exceeds limit
#define ERR_HTTP_QUERY_PARAM_OVERFLOW  46   // Query parameter count exceeds limit
#define ERR_JSON_PARSE_FAILED          47   // JSON parsing failed
#define ERR_JSON_BUFFER_OVERFLOW       48   // JSON buffer size exceeded
#define ERR_WEBSOCKET_CONNECTION_LOST  49   // WebSocket connection dropped

// Parameter/Config Errors (50-59)
#define ERR_PARAM_INVALID              50   // Parameter value out of range
#define ERR_PARAM_NOT_FOUND            51   // Parameter not found in registry
#define ERR_PARAM_READ_FAILED          52   // Failed to read parameter
#define ERR_PARAM_WRITE_FAILED         53   // Failed to write parameter
#define ERR_PARAM_LOCK_CONTENTION      54   // Parameter lock contention timeout
#define ERR_CONFIG_LOAD_FAILED         55   // Configuration load failed
#define ERR_CONFIG_SAVE_FAILED         56   // Configuration save failed
#define ERR_CONFIG_CORRUPTION_DETECTED 57   // Configuration file corrupted
#define ERR_CONFIG_VERSION_MISMATCH    58   // Configuration version incompatible
#define ERR_ENV_VAR_MISSING            59   // Required environment variable missing

// Storage/SPIFFS Errors (60-69)
#define ERR_SPIFFS_MOUNT_FAILED        60   // SPIFFS mount failed
#define ERR_SPIFFS_FORMAT_FAILED       61   // SPIFFS format failed
#define ERR_SPIFFS_FILE_NOT_FOUND      62   // File not found in SPIFFS
#define ERR_SPIFFS_FILE_WRITE_FAILED   63   // File write to SPIFFS failed
#define ERR_SPIFFS_FILE_READ_FAILED    64   // File read from SPIFFS failed
#define ERR_SPIFFS_STORAGE_FULL        65   // SPIFFS storage full
#define ERR_SPIFFS_CORRUPTION          66   // SPIFFS filesystem corrupted
#define ERR_NVS_INIT_FAILED            67   // NVS (Non-Volatile Storage) init failed
#define ERR_NVS_READ_FAILED            68   // NVS read operation failed
#define ERR_NVS_WRITE_FAILED           69   // NVS write operation failed

// OTA/Firmware Update Errors (70-79)
#define ERR_OTA_NOT_AVAILABLE          70   // OTA updates not available
#define ERR_OTA_INIT_FAILED            71   // OTA initialization failed
#define ERR_OTA_BEGIN_FAILED           72   // OTA update begin failed
#define ERR_OTA_RECEIVE_FAILED         73   // OTA data reception failed
#define ERR_OTA_WRITE_FAILED           74   // OTA write to flash failed
#define ERR_OTA_END_FAILED             75   // OTA finalization failed
#define ERR_OTA_AUTH_FAILED            76   // OTA authentication failed
#define ERR_OTA_TIMEOUT                77   // OTA operation timed out
#define ERR_OTA_VERSION_DOWNGRADE      78   // Attempted firmware version downgrade
#define ERR_OTA_COMPATIBILITY_CHECK    79   // Firmware compatibility check failed

// Synchronization/Concurrency Errors (80-89)
#define ERR_MUTEX_ACQUIRE_TIMEOUT      80   // Mutex acquisition timed out
#define ERR_SPINLOCK_ACQUIRE_TIMEOUT   81   // Spinlock acquisition timed out
#define ERR_SEMAPHORE_ACQUIRE_TIMEOUT  82   // Semaphore acquisition timed out
#define ERR_QUEUE_FULL                 83   // Message queue is full
#define ERR_QUEUE_EMPTY                84   // Message queue is empty
#define ERR_RINGBUFFER_OVERRUN         85   // Ring buffer overrun (data lost)
#define ERR_RINGBUFFER_UNDERRUN        86   // Ring buffer underrun (no data available)
#define ERR_TASK_CREATION_FAILED       87   // FreeRTOS task creation failed
#define ERR_ISR_NESTING_LIMIT          88   // ISR nesting limit exceeded
#define ERR_CRITICAL_SECTION_TIMEOUT   89   // Critical section timeout

// Resource/Memory Errors (90-99)
#define ERR_MALLOC_FAILED              90   // Memory allocation failed
#define ERR_STACK_OVERFLOW             91   // Stack overflow detected
#define ERR_HEAP_EXHAUSTED             92   // Heap memory exhausted
#define ERR_PSRAM_INIT_FAILED          93   // PSRAM initialization failed
#define ERR_DMA_BUFFER_ALLOC_FAILED    94   // DMA buffer allocation failed
#define ERR_RESOURCE_NOT_AVAILABLE     95   // Required resource not available
#define ERR_INTERRUPT_ALLOC_FAILED     96   // Interrupt allocation failed
#define ERR_SEMAPHORE_ALLOC_FAILED     97   // Semaphore allocation failed
#define ERR_QUEUE_ALLOC_FAILED         98   // Queue allocation failed
#define ERR_TASK_ALLOC_FAILED          99   // Task structure allocation failed

// Audio Processing Errors (100-109)
#define ERR_AUDIO_DFT_CONFIG_FAILED    100  // Goertzel DFT initialization failed
#define ERR_AUDIO_WINDOW_INIT_FAILED   101  // Audio window function init failed
#define ERR_AUDIO_VU_METER_FAILED      102  // VU meter calculation failed
#define ERR_TEMPO_DETECTION_FAILED     103  // Tempo detection failed
#define ERR_CHROMAGRAM_CALC_FAILED     104  // Chromagram calculation failed
#define ERR_BEAT_DETECTION_FAILED      105  // Beat detection failed
#define ERR_NOVELTY_CALC_FAILED        106  // Novelty calculation failed
#define ERR_SILENCE_DETECTION_FAILED   107  // Silence detection failed
#define ERR_AUDIO_FEATURE_OVERFLOW     108  // Audio feature value overflow
#define ERR_AUDIO_PIPELINE_DESYNC      109  // Audio pipeline frames out of sync

// Pattern/Rendering Errors (110-119)
#define ERR_PATTERN_NOT_FOUND          110  // Pattern not found in registry
#define ERR_PATTERN_LOAD_FAILED        111  // Pattern initialization failed
#define ERR_PATTERN_RENDER_FAILED      112  // Pattern rendering failed
#define ERR_PATTERN_INVALID_STATE      113  // Pattern in invalid state
#define ERR_PATTERN_MEMORY_EXCEEDED    114  // Pattern exceeds memory limits
#define ERR_LED_BUFFER_ALLOC_FAILED    115  // LED frame buffer allocation failed
#define ERR_PALETTE_NOT_FOUND          116  // Color palette not found
#define ERR_PALETTE_LOAD_FAILED        117  // Palette initialization failed
#define ERR_EASING_FUNCTION_INVALID    118  // Invalid easing function
#define ERR_ANIMATION_STATE_CORRUPTED  119  // Animation state corrupted

// Telemetry/Diagnostics Errors (120-129)
#define ERR_TELEMETRY_BUFFER_FULL      120  // Telemetry buffer full
#define ERR_TELEMETRY_WRITE_FAILED     121  // Telemetry write failed
#define ERR_PROFILER_INIT_FAILED       122  // Profiler initialization failed
#define ERR_HEARTBEAT_MISSED           123  // Heartbeat pulse missed
#define ERR_DIAGNOSTICS_DISABLED       124  // Diagnostics feature disabled
#define ERR_PROBE_OVERHEAD_EXCEEDED    125  // Probe measurement overhead too high
#define ERR_TIMESTAMP_SYNC_FAILED      126  // Timestamp synchronization failed
#define ERR_METRICS_AGGREGATION_ERROR  127  // Metrics aggregation error
#define ERR_DIAG_ENDPOINT_UNAVAILABLE  128  // Diagnostics endpoint unavailable
#define ERR_LOG_ROTATION_FAILED        129  // Log rotation failed

// ============================================================================
// ERROR METADATA STRUCTURE
// ============================================================================
typedef struct {
    uint8_t code;                    // Error code (unique identifier)
    const char* name;                // Error name (e.g., "ERR_I2S_TIMEOUT")
    const char* description;         // Human-readable description
    ErrorSeverity severity;          // Severity level
    ErrorRecoveryAction recovery;    // Recommended recovery action
    const char* cause;               // Common cause
    const char* remediation;         // How to fix
} ErrorMetadata;

// ============================================================================
// ERROR CODE LOOKUP TABLE
// ============================================================================
// Map from error code to metadata (used by telemetry/logging)
extern const ErrorMetadata g_error_metadata[];
extern const uint16_t g_error_metadata_count;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get error metadata for a given error code.
 *
 * @param error_code Error code (0-255)
 * @return Pointer to ErrorMetadata struct, or NULL if not found
 */
const ErrorMetadata* error_lookup(uint8_t error_code);

/**
 * Get severity level description as string.
 *
 * @param severity Severity level
 * @return String like "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"
 */
const char* error_severity_to_string(ErrorSeverity severity);

/**
 * Get recovery action description as string.
 *
 * @param action Recovery action
 * @return String like "RETRY", "FALLBACK", "REBOOT"
 */
const char* error_action_to_string(ErrorRecoveryAction action);

/**
 * Format error code into JSON string for REST responses.
 *
 * @param error_code Error code
 * @param buffer Output buffer
 * @param buffer_size Buffer size
 * @return Number of characters written, or -1 on error
 */
int error_to_json(uint8_t error_code, char* buffer, size_t buffer_size);

#endif  // ERROR_CODES_H_

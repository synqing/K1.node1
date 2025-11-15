#pragma once

// K1.reinvented Logging Configuration
// Compile-time configuration for logging verbosity, tags, and output formatting

// ============================================================================
// VERBOSITY LEVEL - Controls which severity messages are compiled in
// ============================================================================
// Set to one of: LOG_LEVEL_DEBUG, LOG_LEVEL_INFO, LOG_LEVEL_WARN, LOG_LEVEL_ERROR
// Messages below this level are compiled out entirely (zero overhead)
#define LOG_LEVEL LOG_LEVEL_DEBUG

#define LOG_LEVEL_ERROR  0
#define LOG_LEVEL_WARN   1
#define LOG_LEVEL_INFO   2
#define LOG_LEVEL_DEBUG  3

// ============================================================================
// TAG DEFINITIONS - Identifies message source subsystem
// ============================================================================
// Each tag gets a unique character for compact output
#define TAG_AUDIO       'A'
#define TAG_I2S         'I'
#define TAG_LED         'L'
#define TAG_GPU         'G'
#define TAG_TEMPO       'T'
#define TAG_BEAT        'B'
#define TAG_SYNC        'S'
#define TAG_WIFI        'W'
#define TAG_WEB         'E'
#define TAG_CORE0       '0'
#define TAG_CORE1       '1'
#define TAG_MEMORY      'M'
#define TAG_PROFILE     'P'
#define TAG_ONSET       'O'
#define TAG_TRACE       'X'  // Diagnostic data flow tracing

// ============================================================================
// TAG ENABLE/DISABLE - Runtime filtering (optional, adds ~100 bytes RAM)
// ============================================================================
// Set to 1 to enable per-tag filtering, 0 for compile-time filtering only
#define LOG_ENABLE_TAG_FILTERING 1

// ============================================================================
// SERIAL CONFIGURATION
// ============================================================================
#define LOG_SERIAL_BAUD 250000  // 250K baud (max supported by most serial monitors)

// ============================================================================
// ANSI COLOR CODES - Optional, can be disabled for raw output
// ============================================================================
#define LOG_USE_COLORS 1

#if LOG_USE_COLORS
  #define COLOR_ERROR   "\033[91m"  // Bright red
  #define COLOR_WARN    "\033[93m"  // Bright yellow
  #define COLOR_INFO    "\033[92m"  // Bright green
  #define COLOR_DEBUG   "\033[94m"  // Bright blue
  #define COLOR_TAG     "\033[96m"  // Bright cyan
  #define COLOR_TIME    "\033[90m"  // Dark gray
  #define COLOR_BPM     "\033[1;33m"  // Bold gold/bright yellow (for BPM highlighting)
  #define COLOR_PATTERN "\033[1;31m"  // Bold RED (for pattern index highlighting - very visible)
  #define COLOR_RESET   "\033[0m"   // Reset
#else
  #define COLOR_ERROR   ""
  #define COLOR_WARN    ""
  #define COLOR_INFO    ""
  #define COLOR_DEBUG   ""
  #define COLOR_TAG     ""
  #define COLOR_TIME    ""
  #define COLOR_BPM     ""
  #define COLOR_PATTERN ""
  #define COLOR_RESET   ""
#endif

// ============================================================================
// BUFFER CONFIGURATION - Static buffers, no dynamic allocation
// ============================================================================
#define LOG_MESSAGE_BUFFER_SIZE 256   // Max message size (formatted output)
#define LOG_FORMAT_BUFFER_SIZE  512   // Temporary buffer for formatting
#define LOG_MUTEX_WAIT_MS       20    // FreeRTOS mutex timeout (increased to reduce edge case timeouts)
#define LOG_MAX_TIMESTAMP_LEN   12    // "HHHMMSS.mmm" + null

// ============================================================================
// PERFORMANCE TUNING
// ============================================================================
#define LOG_FLUSH_INTERVAL_MS  100   // Max milliseconds before forcing flush
#define LOG_BATCH_SIZE         1     // Messages per flush (1 = immediate, >1 = batched)

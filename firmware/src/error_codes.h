#pragma once

#include <cstdint>
#include <cstring>

// K1.node1 Comprehensive Error Code Registry
// Provides standardized error codes for all major subsystems with telemetry support
// Error codes are organized by category and include recovery suggestions
//
// Usage:
//   - ErrorCode code = ErrorCode::WiFi_AssociationTimeout;
//   - const char* desc = error_code_description(code);
//   - error_report(code, "context message");

// Primary error code enumeration - 50+ codes covering all subsystems
enum class ErrorCode : uint16_t {
    // Success (0x0000)
    None = 0x0000,

    // WiFi Errors (0x1xxx)
    WiFi_InitFailed = 0x1001,
    WiFi_AssociationTimeout = 0x1002,
    WiFi_AuthenticationFailed = 0x1003,
    WiFi_ConnectionLost = 0x1004,
    WiFi_DHCP_Timeout = 0x1005,
    WiFi_DNSResolution = 0x1006,
    WiFi_SSIDNotFound = 0x1007,
    WiFi_WeakSignal = 0x1008,
    WiFi_BeaconTimeout = 0x1009,
    WiFi_MaxRetriesExceeded = 0x100A,
    WiFi_CredentialsCooldown = 0x100B,
    WiFi_APModeActive = 0x100C,
    WiFi_ScanFailed = 0x100D,
    WiFi_LinkOptionsUpdateFailed = 0x100E,
    WiFi_NVSWriteFailed = 0x100F,

    // I2S/Audio Errors (0x2xxx)
    I2S_InitFailed = 0x2001,
    I2S_ConfigurationError = 0x2002,
    I2S_ReadTimeout = 0x2003,
    I2S_BufferOverflow = 0x2004,
    I2S_ClockError = 0x2005,
    I2S_DMA_Error = 0x2006,
    I2S_PinConfigError = 0x2007,
    I2S_SampleRateError = 0x2008,
    I2S_BitWidthError = 0x2009,
    I2S_ChannelConfigError = 0x200A,
    I2S_LossOfSignal = 0x200B,
    I2S_DriverNotReady = 0x200C,

    // WebServer Errors (0x3xxx)
    WebServer_BindFailed = 0x3001,
    WebServer_ListenFailed = 0x3002,
    WebServer_RequestQueueFull = 0x3003,
    WebServer_ResponseSendFailed = 0x3004,
    WebServer_ParameterValidationFailed = 0x3005,
    WebServer_RateLimitExceeded = 0x3006,
    WebServer_PayloadTooLarge = 0x3007,
    WebServer_InvalidJSON = 0x3008,
    WebServer_ResourceNotFound = 0x3009,
    WebServer_MethodNotAllowed = 0x300A,
    WebServer_InternalError = 0x300B,
    WebServer_TimeoutOnResponse = 0x300C,
    WebServer_SocketError = 0x300D,

    // LED/RMT Errors (0x4xxx)
    LED_TransmitFailed = 0x4001,
    LED_RMT_ChannelUnavailable = 0x4002,
    LED_RMT_MemoryFull = 0x4003,
    LED_RMT_TimingError = 0x4004,
    LED_EncoderInitFailed = 0x4005,
    LED_DataCorruption = 0x4006,
    LED_TransmitTimeout = 0x4007,
    LED_BufferAllocationFailed = 0x4008,
    LED_DualChannelSyncFailed = 0x4009,
    LED_HardwareNotReady = 0x400A,
    LED_StripLengthMismatch = 0x400B,
    LED_RefillGapExceeded = 0x400C,

    // Pattern Errors (0x5xxx)
    Pattern_LoadFailed = 0x5001,
    Pattern_NotFound = 0x5002,
    Pattern_InvalidParameters = 0x5003,
    Pattern_RenderTimeout = 0x5004,
    Pattern_StackOverflow = 0x5005,
    Pattern_MemoryExhausted = 0x5006,
    Pattern_ChannelMismatch = 0x5007,
    Pattern_QuantizationError = 0x5008,
    Pattern_AudioSyncLost = 0x5009,
    Pattern_SnapshotBoundError = 0x500A,
    Pattern_InterpolationError = 0x500B,
    Pattern_PaletteLookupFailed = 0x500C,

    // Memory/Resource Errors (0x6xxx)
    Memory_AllocationFailed = 0x6001,
    Memory_DeallocationError = 0x6002,
    Memory_CorruptionDetected = 0x6003,
    Memory_StackLimitExceeded = 0x6004,
    Memory_HeapFragmented = 0x6005,
    Memory_NVSOperationFailed = 0x6006,
    Memory_CacheMissed = 0x6007,

    // Synchronization Errors (0x7xxx)
    Sync_MutexTimeout = 0x7001,
    Sync_DeadlockDetected = 0x7002,
    Sync_RaceCondition = 0x7003,
    Sync_LockFreeQueueFull = 0x7004,
    Sync_SequenceLockFailed = 0x7005,
    Sync_BarrierTimeout = 0x7006,

    // Hardware/System Errors (0x8xxx)
    Hardware_CPUOverload = 0x8001,
    Hardware_ThermalThrottle = 0x8002,
    Hardware_PowerVoltageError = 0x8003,
    Hardware_WatchdogTimeout = 0x8004,
    Hardware_StackOverflow = 0x8005,
    Hardware_UncaughtException = 0x8006,
    Hardware_PeripheralFailure = 0x8007,
    Hardware_GPIOConfigError = 0x8008,

    // Network Transport Errors (0x9xxx)
    Network_UDPSocketCreationFailed = 0x9001,
    Network_UDPSendFailed = 0x9002,
    Network_UDPReceiveFailed = 0x9003,
    Network_UDPTimeoutOnReceive = 0x9004,
    Network_UDPBufferFullOnReceive = 0x9005,
    Network_SocketOptionsError = 0x9006,
    Network_MTUSizeError = 0x9007,

    // Timing/Beat Errors (0xAxxx)
    Timing_BeatSyncLost = 0xA001,
    Timing_MetronomeDelay = 0xA002,
    Timing_TempoCalculationError = 0xA003,
    Timing_EventQueueFull = 0xA004,
    Timing_EventProcessingTimeout = 0xA005,
    Timing_PrecisionLimitExceeded = 0xA006,

    // Telemetry/Diagnostics Errors (0xBxxx)
    Telemetry_RecordingFailed = 0xB001,
    Telemetry_TransmissionFailed = 0xB002,
    Telemetry_StorageFull = 0xB003,
    Telemetry_InvalidMetrics = 0xB004,
    Telemetry_TimebaseError = 0xB005,

    // Configuration Errors (0xCxxx)
    Config_LoadFailed = 0xC001,
    Config_SaveFailed = 0xC002,
    Config_ValidationFailed = 0xC003,
    Config_VersionMismatch = 0xC004,
    Config_ParameterOutOfRange = 0xC005,
    Config_MissingRequiredField = 0xC006,

    // Generic System Errors (0xDxxx)
    System_InitializationFailed = 0xD001,
    System_NotInitialized = 0xD002,
    System_AlreadyInitialized = 0xD003,
    System_InvalidState = 0xD004,
    System_UnexpectedBehavior = 0xD005,
    System_TimeoutGeneric = 0xD006,

    // Sentinel
    Invalid = 0xFFFF
};

// Error severity levels for telemetry classification
enum class ErrorSeverity : uint8_t {
    Info = 0,      // Informational, no action required
    Warning = 1,   // Warning, investigation recommended
    Error = 2,     // Error, recovery needed
    Critical = 3   // Critical, immediate action required
};

// Error code metadata structure for telemetry
struct ErrorCodeMetadata {
    ErrorCode code;
    ErrorSeverity severity;
    uint16_t subsystem_id;  // Category identifier
    uint8_t recovery_type;  // 0=none, 1=retry, 2=reset, 3=manual, 4=auto_failover
    const char* description;
    const char* recovery_suggestion;
};

// Get human-readable description of error code
const char* error_code_description(ErrorCode code);

// Get severity level of error code
ErrorSeverity error_code_severity(ErrorCode code);

// Get recovery suggestion for error code
const char* error_code_recovery_suggestion(ErrorCode code);

// Get category name for error code (e.g., "WiFi", "I2S", "LED")
const char* error_code_category(ErrorCode code);

// Get subsystem ID from error code
inline uint16_t error_code_subsystem(ErrorCode code) {
    return (static_cast<uint16_t>(code) >> 12) & 0xF;
}

// Report error with optional context message
// Records to telemetry system and local logging
void error_report(ErrorCode code, const char* context_message = nullptr);

// Report error with formatted context message
void error_reportf(ErrorCode code, const char* format, ...);

// Get count of reported errors since boot
uint32_t error_get_report_count();

// Get count of specific error code
uint32_t error_get_code_count(ErrorCode code);

// Clear error statistics
void error_clear_statistics();

// Get error context (last reported message)
const char* error_get_context(ErrorCode code);

// Initialize error reporting system
void error_system_init();

// Shutdown error reporting system
void error_system_shutdown();

// Error statistics snapshot for telemetry
struct ErrorStatistics {
    uint32_t total_errors;
    uint32_t critical_errors;
    uint32_t error_errors;
    uint32_t warning_errors;
    uint32_t info_messages;
    ErrorCode most_recent_code;
    uint32_t most_recent_timestamp_ms;
    uint16_t unique_error_codes;
    const char* last_context;
};

// Get current error statistics
void error_get_statistics(ErrorStatistics& out_stats);

// Telemetry helper: format error for JSON transmission
// Returns formatted string suitable for inclusion in telemetry payloads
const char* error_format_for_telemetry(ErrorCode code, uint32_t timestamp_ms);

// Telemetry helper: is this error worth reporting (filters routine warnings)
bool error_should_report_to_telemetry(ErrorCode code);

#endif // ERROR_CODES_H

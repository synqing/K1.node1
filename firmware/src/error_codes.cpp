#include "error_codes.h"
#include <Arduino.h>
#include <atomic>
#include <cstdarg>
#include <cstdio>
#include <algorithm>

// Error statistics tracking
struct ErrorStats {
    uint32_t total_reports;
    uint32_t critical_count;
    uint32_t error_count;
    uint32_t warning_count;
    uint32_t info_count;
    ErrorCode most_recent;
    uint32_t most_recent_ms;
    uint16_t unique_codes;
    char last_context[256];
    std::atomic<uint32_t> error_code_counts[256];  // Tracks count per error code

    ErrorStats() : total_reports(0), critical_count(0), error_count(0),
                   warning_count(0), info_count(0), most_recent(ErrorCode::None),
                   most_recent_ms(0), unique_codes(0) {
        last_context[0] = '\0';
        for (int i = 0; i < 256; i++) {
            error_code_counts[i].store(0, std::memory_order_relaxed);
        }
    }
};

static ErrorStats g_error_stats;
static bool g_error_system_initialized = false;

// Complete error code metadata table
// Organized by category for maintainability
static constexpr ErrorCodeMetadata g_error_metadata[] = {
    // WiFi Errors (0x1xxx)
    {ErrorCode::WiFi_InitFailed, ErrorSeverity::Critical, 0x1, 2,
     "WiFi initialization failed", "Restart device or check WiFi subsystem integrity"},
    {ErrorCode::WiFi_AssociationTimeout, ErrorSeverity::Error, 0x1, 1,
     "WiFi association timeout (SSID not responding)", "Check SSID is broadcasting, move closer, or try different channel"},
    {ErrorCode::WiFi_AuthenticationFailed, ErrorSeverity::Error, 0x1, 1,
     "WiFi authentication failed (wrong password or security mismatch)", "Verify password and security type (WPA2/WPA3)"},
    {ErrorCode::WiFi_ConnectionLost, ErrorSeverity::Warning, 0x1, 1,
     "WiFi connection lost unexpectedly", "Reconnecting... check signal strength and router stability"},
    {ErrorCode::WiFi_DHCP_Timeout, ErrorSeverity::Error, 0x1, 1,
     "DHCP timeout (no IP address assigned)", "Check router DHCP settings or try static IP configuration"},
    {ErrorCode::WiFi_DNSResolution, ErrorSeverity::Warning, 0x1, 1,
     "DNS resolution failed", "Check DNS settings or try alternate DNS server"},
    {ErrorCode::WiFi_SSIDNotFound, ErrorSeverity::Warning, 0x1, 1,
     "SSID not found in scan results", "Verify SSID is spelled correctly and WiFi router is powered on"},
    {ErrorCode::WiFi_WeakSignal, ErrorSeverity::Warning, 0x1, 0,
     "WiFi signal strength is weak (RSSI < threshold)", "Move device closer to router or reduce interference"},
    {ErrorCode::WiFi_BeaconTimeout, ErrorSeverity::Error, 0x1, 1,
     "No WiFi beacon received (AP likely unreachable)", "Check router connectivity and WiFi availability"},
    {ErrorCode::WiFi_MaxRetriesExceeded, ErrorSeverity::Error, 0x1, 2,
     "Maximum WiFi connection retry count exceeded", "Check credentials, router logs, or restart router"},
    {ErrorCode::WiFi_CredentialsCooldown, ErrorSeverity::Info, 0x1, 0,
     "Credentials in cooldown period after repeated failures", "Waiting before next connection attempt"},
    {ErrorCode::WiFi_APModeActive, ErrorSeverity::Info, 0x1, 0,
     "WiFi AP (access point) mode is active", "Device is accessible as WiFi hotspot; use web interface to configure station mode"},
    {ErrorCode::WiFi_ScanFailed, ErrorSeverity::Warning, 0x1, 1,
     "WiFi network scan failed", "Retry scan or check WiFi module health"},
    {ErrorCode::WiFi_LinkOptionsUpdateFailed, ErrorSeverity::Warning, 0x1, 1,
     "Failed to update WiFi link options", "Verify link option parameters and retry"},
    {ErrorCode::WiFi_NVSWriteFailed, ErrorSeverity::Error, 0x1, 2,
     "Failed to write WiFi settings to NVS (non-volatile storage)", "Check NVS space availability or device storage health"},

    // I2S/Audio Errors (0x2xxx)
    {ErrorCode::I2S_InitFailed, ErrorSeverity::Critical, 0x2, 2,
     "I2S (audio input) initialization failed", "Check microphone hardware and pin configuration; restart device"},
    {ErrorCode::I2S_ConfigurationError, ErrorSeverity::Critical, 0x2, 2,
     "I2S configuration error (invalid parameters)", "Verify I2S sample rate, bit width, and channel configuration"},
    {ErrorCode::I2S_ReadTimeout, ErrorSeverity::Error, 0x2, 1,
     "I2S read timeout (no audio samples received)", "Check microphone connection, power, and I2S bus integrity"},
    {ErrorCode::I2S_BufferOverflow, ErrorSeverity::Error, 0x2, 1,
     "I2S DMA buffer overflow (samples dropped)", "Increase buffer size or reduce pattern complexity to free CPU"},
    {ErrorCode::I2S_ClockError, ErrorSeverity::Critical, 0x2, 2,
     "I2S clock error or synchronization lost", "Check MCLK, BCLK, and LRCK connections; verify pin configuration"},
    {ErrorCode::I2S_DMA_Error, ErrorSeverity::Critical, 0x2, 2,
     "I2S DMA error (data transfer failure)", "Check DMA channel allocation and memory availability"},
    {ErrorCode::I2S_PinConfigError, ErrorSeverity::Critical, 0x2, 2,
     "I2S pin configuration error", "Verify GPIO pins assigned to I2S (MCLK, BCLK, LRCK, DATA)"},
    {ErrorCode::I2S_SampleRateError, ErrorSeverity::Error, 0x2, 1,
     "I2S sample rate unsupported or mismatch", "Use standard sample rates (16kHz, 44.1kHz, 48kHz)"},
    {ErrorCode::I2S_BitWidthError, ErrorSeverity::Error, 0x2, 1,
     "I2S bit width configuration error", "Use supported bit widths (16-bit, 24-bit, 32-bit)"},
    {ErrorCode::I2S_ChannelConfigError, ErrorSeverity::Error, 0x2, 1,
     "I2S channel configuration error", "Verify mono/stereo configuration matches microphone"},
    {ErrorCode::I2S_LossOfSignal, ErrorSeverity::Warning, 0x2, 1,
     "I2S signal loss detected", "Check microphone stability and bus connections"},
    {ErrorCode::I2S_DriverNotReady, ErrorSeverity::Error, 0x2, 1,
     "I2S driver not ready or not initialized", "Initialize I2S subsystem before use"},

    // WebServer Errors (0x3xxx)
    {ErrorCode::WebServer_BindFailed, ErrorSeverity::Critical, 0x3, 2,
     "WebServer socket bind failed (port may be in use)", "Check if another service uses the port; restart device"},
    {ErrorCode::WebServer_ListenFailed, ErrorSeverity::Critical, 0x3, 2,
     "WebServer listen failed", "Restart WebServer; check socket and memory state"},
    {ErrorCode::WebServer_RequestQueueFull, ErrorSeverity::Warning, 0x3, 0,
     "WebServer request queue is full", "Too many concurrent connections; some requests dropped; reduce clients"},
    {ErrorCode::WebServer_ResponseSendFailed, ErrorSeverity::Error, 0x3, 1,
     "Failed to send WebServer response", "Check socket state and network connectivity"},
    {ErrorCode::WebServer_ParameterValidationFailed, ErrorSeverity::Warning, 0x3, 0,
     "WebServer parameter validation failed", "Check request parameters match schema; refer to API documentation"},
    {ErrorCode::WebServer_RateLimitExceeded, ErrorSeverity::Info, 0x3, 0,
     "WebServer rate limit exceeded (too many requests)", "Client is throttled; retry after delay"},
    {ErrorCode::WebServer_PayloadTooLarge, ErrorSeverity::Warning, 0x3, 0,
     "Request payload exceeds maximum size", "Split request into smaller chunks or reduce data size"},
    {ErrorCode::WebServer_InvalidJSON, ErrorSeverity::Warning, 0x3, 0,
     "Invalid JSON in request body", "Validate JSON syntax and check for malformed data"},
    {ErrorCode::WebServer_ResourceNotFound, ErrorSeverity::Info, 0x3, 0,
     "WebServer resource (endpoint) not found", "Check endpoint URL; refer to API documentation"},
    {ErrorCode::WebServer_MethodNotAllowed, ErrorSeverity::Info, 0x3, 0,
     "HTTP method not allowed for this endpoint", "Use correct HTTP method (GET, POST, etc.)"},
    {ErrorCode::WebServer_InternalError, ErrorSeverity::Error, 0x3, 1,
     "WebServer internal error during request processing", "Check logs for details; retry request"},
    {ErrorCode::WebServer_TimeoutOnResponse, ErrorSeverity::Warning, 0x3, 1,
     "WebServer timeout sending response (client disconnected?)", "Increase timeout or check client stability"},
    {ErrorCode::WebServer_SocketError, ErrorSeverity::Error, 0x3, 1,
     "WebServer socket error (connection reset or closed)", "Reconnect client; check network health"},

    // LED/RMT Errors (0x4xxx)
    {ErrorCode::LED_TransmitFailed, ErrorSeverity::Error, 0x4, 1,
     "LED transmission failed (RMT signal not sent)", "Check RMT channel configuration and LED pin connection"},
    {ErrorCode::LED_RMT_ChannelUnavailable, ErrorSeverity::Error, 0x4, 2,
     "RMT channel unavailable (likely in use by other subsystem)", "Check GPIO assignments or stop other RMT users"},
    {ErrorCode::LED_RMT_MemoryFull, ErrorSeverity::Error, 0x4, 1,
     "RMT memory buffer full (too many LED symbols)", "Reduce LED strip length or simplify pattern"},
    {ErrorCode::LED_RMT_TimingError, ErrorSeverity::Error, 0x4, 1,
     "RMT timing error (refill gap exceeded)", "Optimize pattern rendering or increase RMT frequency"},
    {ErrorCode::LED_EncoderInitFailed, ErrorSeverity::Critical, 0x4, 2,
     "LED encoder initialization failed", "Check WS2812/NeoPixel timing configuration"},
    {ErrorCode::LED_DataCorruption, ErrorSeverity::Error, 0x4, 1,
     "LED data corruption detected", "Check LED strip connection, termination resistor, and power supply"},
    {ErrorCode::LED_TransmitTimeout, ErrorSeverity::Error, 0x4, 1,
     "LED transmission timeout (no completion signal)", "Check RMT interrupt or hardware state"},
    {ErrorCode::LED_BufferAllocationFailed, ErrorSeverity::Critical, 0x4, 2,
     "Failed to allocate LED data buffer", "Insufficient SRAM; reduce LED count or free memory"},
    {ErrorCode::LED_DualChannelSyncFailed, ErrorSeverity::Error, 0x4, 1,
     "Failed to synchronize dual RMT channels", "Check RMT channel configuration or reduce update rate"},
    {ErrorCode::LED_HardwareNotReady, ErrorSeverity::Error, 0x4, 1,
     "LED hardware (RMT/encoder) not ready or not initialized", "Initialize LED subsystem before use"},
    {ErrorCode::LED_StripLengthMismatch, ErrorSeverity::Warning, 0x4, 0,
     "LED strip length configuration mismatch", "Update configuration to match physical LED count"},
    {ErrorCode::LED_RefillGapExceeded, ErrorSeverity::Warning, 0x4, 0,
     "RMT refill gap exceeded (timing precision issue)", "Optimize render function or check CPU load"},

    // Pattern Errors (0x5xxx)
    {ErrorCode::Pattern_LoadFailed, ErrorSeverity::Error, 0x5, 1,
     "Failed to load pattern", "Check pattern registry or pattern storage"},
    {ErrorCode::Pattern_NotFound, ErrorSeverity::Warning, 0x5, 0,
     "Requested pattern not found", "Verify pattern ID or name; check pattern registry"},
    {ErrorCode::Pattern_InvalidParameters, ErrorSeverity::Warning, 0x5, 0,
     "Invalid pattern parameters", "Check parameter ranges and types"},
    {ErrorCode::Pattern_RenderTimeout, ErrorSeverity::Error, 0x5, 1,
     "Pattern render function timeout (exceeded frame time)", "Optimize pattern or reduce complexity"},
    {ErrorCode::Pattern_StackOverflow, ErrorSeverity::Critical, 0x5, 2,
     "Pattern rendering caused stack overflow", "Reduce local variables or increase stack size"},
    {ErrorCode::Pattern_MemoryExhausted, ErrorSeverity::Critical, 0x5, 2,
     "Pattern rendering exhausted available heap", "Reduce pattern complexity or free memory"},
    {ErrorCode::Pattern_ChannelMismatch, ErrorSeverity::Warning, 0x5, 0,
     "Channel count mismatch between pattern and output", "Configure correct number of channels"},
    {ErrorCode::Pattern_QuantizationError, ErrorSeverity::Warning, 0x5, 0,
     "Error during LED color quantization", "Check dithering configuration"},
    {ErrorCode::Pattern_AudioSyncLost, ErrorSeverity::Warning, 0x5, 1,
     "Audio sync lost during reactive pattern playback", "Check I2S input or retry pattern"},
    {ErrorCode::Pattern_SnapshotBoundError, ErrorSeverity::Warning, 0x5, 0,
     "Pattern snapshot bounds error (index out of range)", "Check snapshot index within valid range"},
    {ErrorCode::Pattern_InterpolationError, ErrorSeverity::Warning, 0x5, 0,
     "Error during pattern interpolation between snapshots", "Check snapshot data integrity"},
    {ErrorCode::Pattern_PaletteLookupFailed, ErrorSeverity::Warning, 0x5, 0,
     "Palette color lookup failed", "Verify palette configuration"},

    // Memory/Resource Errors (0x6xxx)
    {ErrorCode::Memory_AllocationFailed, ErrorSeverity::Error, 0x6, 2,
     "Memory allocation failed (malloc/new returned nullptr)", "Insufficient free heap memory"},
    {ErrorCode::Memory_DeallocationError, ErrorSeverity::Warning, 0x6, 0,
     "Memory deallocation error (double-free or invalid pointer)", "Check memory management code"},
    {ErrorCode::Memory_CorruptionDetected, ErrorSeverity::Critical, 0x6, 2,
     "Memory corruption detected", "Restart device and investigate heap integrity"},
    {ErrorCode::Memory_StackLimitExceeded, ErrorSeverity::Critical, 0x6, 2,
     "Stack limit exceeded (stack overflow)", "Reduce function call depth or local variable usage"},
    {ErrorCode::Memory_HeapFragmented, ErrorSeverity::Warning, 0x6, 0,
     "Heap is heavily fragmented", "Restart device or optimize memory allocation patterns"},
    {ErrorCode::Memory_NVSOperationFailed, ErrorSeverity::Error, 0x6, 1,
     "Non-volatile storage (NVS) operation failed", "Check NVS partition and retry"},
    {ErrorCode::Memory_CacheMissed, ErrorSeverity::Info, 0x6, 0,
     "Cache miss (expected in performance context)", "Monitor cache hit ratio"},

    // Synchronization Errors (0x7xxx)
    {ErrorCode::Sync_MutexTimeout, ErrorSeverity::Error, 0x7, 1,
     "Mutex lock timeout (possible deadlock)", "Check for circular lock acquisition or increase timeout"},
    {ErrorCode::Sync_DeadlockDetected, ErrorSeverity::Critical, 0x7, 2,
     "Deadlock detected in synchronization", "Review lock acquisition order and restart device"},
    {ErrorCode::Sync_RaceCondition, ErrorSeverity::Error, 0x7, 1,
     "Race condition detected in shared resource access", "Add proper synchronization"},
    {ErrorCode::Sync_LockFreeQueueFull, ErrorSeverity::Warning, 0x7, 0,
     "Lock-free queue is full", "Increase queue size or reduce producer rate"},
    {ErrorCode::Sync_SequenceLockFailed, ErrorSeverity::Error, 0x7, 1,
     "Sequence lock failed (data changed during read)", "Retry read operation"},
    {ErrorCode::Sync_BarrierTimeout, ErrorSeverity::Error, 0x7, 1,
     "Synchronization barrier timeout", "Check for stalled tasks or increase timeout"},

    // Hardware/System Errors (0x8xxx)
    {ErrorCode::Hardware_CPUOverload, ErrorSeverity::Warning, 0x8, 0,
     "CPU is overloaded (>90% utilization)", "Reduce task complexity or increase CPU frequency"},
    {ErrorCode::Hardware_ThermalThrottle, ErrorSeverity::Warning, 0x8, 0,
     "Thermal throttling active (CPU temperature high)", "Improve cooling or reduce load"},
    {ErrorCode::Hardware_PowerVoltageError, ErrorSeverity::Critical, 0x8, 2,
     "Power supply voltage out of range", "Check power supply and connections"},
    {ErrorCode::Hardware_WatchdogTimeout, ErrorSeverity::Critical, 0x8, 2,
     "Watchdog timeout (system reboot imminent)", "Check for stalled tasks or increase watchdog timeout"},
    {ErrorCode::Hardware_StackOverflow, ErrorSeverity::Critical, 0x8, 2,
     "Hardware stack overflow detected", "Reduce task stack usage or increase stack size"},
    {ErrorCode::Hardware_UncaughtException, ErrorSeverity::Critical, 0x8, 2,
     "Uncaught exception or invalid memory access", "Check exception logs and restart device"},
    {ErrorCode::Hardware_PeripheralFailure, ErrorSeverity::Error, 0x8, 2,
     "Peripheral (GPIO, timer, etc.) failure", "Check hardware connections and configuration"},
    {ErrorCode::Hardware_GPIOConfigError, ErrorSeverity::Error, 0x8, 1,
     "GPIO configuration error (pin conflict or invalid mode)", "Verify GPIO pin assignments"},

    // Network Transport Errors (0x9xxx)
    {ErrorCode::Network_UDPSocketCreationFailed, ErrorSeverity::Error, 0x9, 1,
     "Failed to create UDP socket", "Check available socket resources"},
    {ErrorCode::Network_UDPSendFailed, ErrorSeverity::Warning, 0x9, 1,
     "UDP send failed (packet dropped)", "Check network connectivity and MTU"},
    {ErrorCode::Network_UDPReceiveFailed, ErrorSeverity::Warning, 0x9, 1,
     "UDP receive failed", "Check socket configuration and network"},
    {ErrorCode::Network_UDPTimeoutOnReceive, ErrorSeverity::Info, 0x9, 0,
     "UDP receive timeout (no data received in time)", "Check sender or increase timeout"},
    {ErrorCode::Network_UDPBufferFullOnReceive, ErrorSeverity::Warning, 0x9, 1,
     "UDP receive buffer full (datagrams dropped)", "Increase buffer size or improve throughput"},
    {ErrorCode::Network_SocketOptionsError, ErrorSeverity::Error, 0x9, 1,
     "Failed to set socket options", "Check socket configuration parameters"},
    {ErrorCode::Network_MTUSizeError, ErrorSeverity::Warning, 0x9, 0,
     "MTU size configuration error", "Use standard MTU sizes (576-1500 bytes)"},

    // Timing/Beat Errors (0xAxxx)
    {ErrorCode::Timing_BeatSyncLost, ErrorSeverity::Warning, 0xA, 1,
     "Beat synchronization lost (timing deviation)", "Recalibrate timing or check audio source"},
    {ErrorCode::Timing_MetronomeDelay, ErrorSeverity::Info, 0xA, 0,
     "Metronome event delayed beyond threshold", "CPU load may be high; check system load"},
    {ErrorCode::Timing_TempoCalculationError, ErrorSeverity::Warning, 0xA, 0,
     "Tempo calculation error (invalid BPM)", "Verify BPM is within valid range (30-300)"},
    {ErrorCode::Timing_EventQueueFull, ErrorSeverity::Warning, 0xA, 0,
     "Timing event queue is full", "Reduce event generation rate"},
    {ErrorCode::Timing_EventProcessingTimeout, ErrorSeverity::Error, 0xA, 1,
     "Event processing timeout (event handler too slow)", "Optimize event handler or increase timeout"},
    {ErrorCode::Timing_PrecisionLimitExceeded, ErrorSeverity::Warning, 0xA, 0,
     "Timing precision limit exceeded (jitter too high)", "Reduce system load or use RTOS priority boosting"},

    // Telemetry/Diagnostics Errors (0xBxxx)
    {ErrorCode::Telemetry_RecordingFailed, ErrorSeverity::Warning, 0xB, 1,
     "Telemetry recording failed", "Check telemetry storage and retry"},
    {ErrorCode::Telemetry_TransmissionFailed, ErrorSeverity::Warning, 0xB, 1,
     "Telemetry transmission failed", "Check network connectivity and retry"},
    {ErrorCode::Telemetry_StorageFull, ErrorSeverity::Warning, 0xB, 0,
     "Telemetry storage is full", "Clear old telemetry data or increase storage"},
    {ErrorCode::Telemetry_InvalidMetrics, ErrorSeverity::Warning, 0xB, 0,
     "Invalid telemetry metrics detected", "Check metric sources and validation"},
    {ErrorCode::Telemetry_TimebaseError, ErrorSeverity::Warning, 0xB, 1,
     "Telemetry timebase error (clock sync lost)", "Resync system clock"},

    // Configuration Errors (0xCxxx)
    {ErrorCode::Config_LoadFailed, ErrorSeverity::Error, 0xC, 1,
     "Failed to load configuration", "Check configuration storage and format"},
    {ErrorCode::Config_SaveFailed, ErrorSeverity::Error, 0xC, 1,
     "Failed to save configuration", "Check storage space and permissions"},
    {ErrorCode::Config_ValidationFailed, ErrorSeverity::Warning, 0xC, 0,
     "Configuration validation failed", "Check configuration against schema"},
    {ErrorCode::Config_VersionMismatch, ErrorSeverity::Warning, 0xC, 0,
     "Configuration version mismatch", "Update configuration or firmware version"},
    {ErrorCode::Config_ParameterOutOfRange, ErrorSeverity::Warning, 0xC, 0,
     "Configuration parameter out of valid range", "Adjust parameter within allowed bounds"},
    {ErrorCode::Config_MissingRequiredField, ErrorSeverity::Error, 0xC, 1,
     "Configuration missing required field", "Add required configuration field"},

    // Generic System Errors (0xDxxx)
    {ErrorCode::System_InitializationFailed, ErrorSeverity::Critical, 0xD, 2,
     "System initialization failed", "Check boot logs and restart device"},
    {ErrorCode::System_NotInitialized, ErrorSeverity::Error, 0xD, 1,
     "Subsystem not initialized before use", "Call initialization function first"},
    {ErrorCode::System_AlreadyInitialized, ErrorSeverity::Warning, 0xD, 0,
     "Subsystem already initialized", "Skip initialization or call shutdown first"},
    {ErrorCode::System_InvalidState, ErrorSeverity::Warning, 0xD, 0,
     "Subsystem in invalid state for operation", "Check state transitions and initialization"},
    {ErrorCode::System_UnexpectedBehavior, ErrorSeverity::Error, 0xD, 1,
     "Unexpected system behavior detected", "Check logs and investigate cause"},
    {ErrorCode::System_TimeoutGeneric, ErrorSeverity::Warning, 0xD, 0,
     "Generic timeout (operation exceeded time limit)", "Increase timeout or optimize operation"},
};

// Compile-time assertion to ensure metadata table is complete
static_assert(sizeof(g_error_metadata) / sizeof(g_error_metadata[0]) > 50,
              "Error code metadata must have at least 50 entries");

// Helper to find metadata for error code
static const ErrorCodeMetadata* find_metadata(ErrorCode code) {
    for (const auto& meta : g_error_metadata) {
        if (meta.code == code) {
            return &meta;
        }
    }
    return nullptr;
}

const char* error_code_description(ErrorCode code) {
    const auto* meta = find_metadata(code);
    return meta ? meta->description : "Unknown error code";
}

ErrorSeverity error_code_severity(ErrorCode code) {
    const auto* meta = find_metadata(code);
    return meta ? meta->severity : ErrorSeverity::Error;
}

const char* error_code_recovery_suggestion(ErrorCode code) {
    const auto* meta = find_metadata(code);
    return meta ? meta->recovery_suggestion : "No recovery suggestion available";
}

const char* error_code_category(ErrorCode code) {
    uint16_t subsystem = error_code_subsystem(code);
    switch (subsystem) {
        case 0x1: return "WiFi";
        case 0x2: return "I2S/Audio";
        case 0x3: return "WebServer";
        case 0x4: return "LED/RMT";
        case 0x5: return "Pattern";
        case 0x6: return "Memory";
        case 0x7: return "Synchronization";
        case 0x8: return "Hardware";
        case 0x9: return "Network Transport";
        case 0xA: return "Timing/Beat";
        case 0xB: return "Telemetry";
        case 0xC: return "Configuration";
        case 0xD: return "System";
        default: return "Unknown";
    }
}

void error_report(ErrorCode code, const char* context_message) {
    if (!g_error_system_initialized) {
        error_system_init();
    }

    // Update statistics
    g_error_stats.total_reports++;
    g_error_stats.most_recent = code;
    g_error_stats.most_recent_ms = millis();

    const auto* meta = find_metadata(code);
    if (meta) {
        switch (meta->severity) {
            case ErrorSeverity::Critical:
                g_error_stats.critical_count++;
                break;
            case ErrorSeverity::Error:
                g_error_stats.error_count++;
                break;
            case ErrorSeverity::Warning:
                g_error_stats.warning_count++;
                break;
            case ErrorSeverity::Info:
                g_error_stats.info_count++;
                break;
        }
    }

    // Track code-specific count
    uint16_t code_idx = (static_cast<uint16_t>(code) & 0xFF);
    auto current = g_error_stats.error_code_counts[code_idx].load(std::memory_order_relaxed);
    g_error_stats.error_code_counts[code_idx].store(current + 1, std::memory_order_relaxed);

    // Store context message
    if (context_message) {
        strncpy(g_error_stats.last_context, context_message, sizeof(g_error_stats.last_context) - 1);
        g_error_stats.last_context[sizeof(g_error_stats.last_context) - 1] = '\0';
    } else {
        g_error_stats.last_context[0] = '\0';
    }

    // Log to Serial
    const char* category = error_code_category(code);
    const char* description = error_code_description(code);
    const char* severity_str = "";

    if (meta) {
        switch (meta->severity) {
            case ErrorSeverity::Critical: severity_str = "[CRITICAL]"; break;
            case ErrorSeverity::Error:    severity_str = "[ERROR]"; break;
            case ErrorSeverity::Warning:  severity_str = "[WARNING]"; break;
            case ErrorSeverity::Info:     severity_str = "[INFO]"; break;
        }
    }

    Serial.printf("[%u] %s %s <%s> %s",
        millis(),
        severity_str,
        category,
        meta ? "0x" : "",
        description
    );

    if (context_message) {
        Serial.printf(" -- %s", context_message);
    }
    Serial.println();
}

void error_reportf(ErrorCode code, const char* format, ...) {
    static char buffer[512];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    error_report(code, buffer);
}

uint32_t error_get_report_count() {
    return g_error_stats.total_reports;
}

uint32_t error_get_code_count(ErrorCode code) {
    uint16_t code_idx = (static_cast<uint16_t>(code) & 0xFF);
    return g_error_stats.error_code_counts[code_idx].load(std::memory_order_relaxed);
}

void error_clear_statistics() {
    g_error_stats.total_reports = 0;
    g_error_stats.critical_count = 0;
    g_error_stats.error_count = 0;
    g_error_stats.warning_count = 0;
    g_error_stats.info_count = 0;
    g_error_stats.most_recent = ErrorCode::None;
    g_error_stats.most_recent_ms = 0;
    g_error_stats.last_context[0] = '\0';
    for (int i = 0; i < 256; i++) {
        g_error_stats.error_code_counts[i].store(0, std::memory_order_relaxed);
    }
}

const char* error_get_context(ErrorCode code) {
    if (g_error_stats.most_recent == code) {
        return g_error_stats.last_context;
    }
    return "";
}

void error_system_init() {
    if (g_error_system_initialized) {
        return;
    }
    g_error_system_initialized = true;
    Serial.println("[BOOT] Error reporting system initialized");
}

void error_system_shutdown() {
    g_error_system_initialized = false;
}

void error_get_statistics(ErrorStatistics& out_stats) {
    out_stats.total_errors = g_error_stats.total_reports;
    out_stats.critical_errors = g_error_stats.critical_count;
    out_stats.error_errors = g_error_stats.error_count;
    out_stats.warning_errors = g_error_stats.warning_count;
    out_stats.info_messages = g_error_stats.info_count;
    out_stats.most_recent_code = g_error_stats.most_recent;
    out_stats.most_recent_timestamp_ms = g_error_stats.most_recent_ms;
    out_stats.last_context = g_error_stats.last_context;

    // Count unique error codes
    uint16_t unique = 0;
    for (int i = 0; i < 256; i++) {
        if (g_error_stats.error_code_counts[i].load(std::memory_order_relaxed) > 0) {
            unique++;
        }
    }
    out_stats.unique_error_codes = unique;
}

const char* error_format_for_telemetry(ErrorCode code, uint32_t timestamp_ms) {
    static char buffer[512];
    const auto* meta = find_metadata(code);

    snprintf(buffer, sizeof(buffer),
        "{\"code\":\"0x%04X\",\"severity\":%d,\"category\":\"%s\",\"desc\":\"%s\",\"ts\":%u}",
        static_cast<uint16_t>(code),
        meta ? static_cast<int>(meta->severity) : 2,
        error_code_category(code),
        meta ? meta->description : "Unknown",
        timestamp_ms
    );

    return buffer;
}

bool error_should_report_to_telemetry(ErrorCode code) {
    const auto* meta = find_metadata(code);
    if (!meta) return false;

    // Only report Error and Critical severity to telemetry
    // Filter out Info and Warning to reduce telemetry noise
    return meta->severity >= ErrorSeverity::Error;
}

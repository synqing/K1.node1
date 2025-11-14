// -----------------------------------------------------------------------------------------
//              _                                 _                                  _
//             (_)                               | |                                | |
//  _ __ ___    _    ___   _ __    ___    _ __   | |__     ___    _ __     ___      | |__
// | '_ ` _ \  | |  / __| | '__|  / _ \  | '_ \  | '_ \   / _ \  | '_ \   / _ \     | '_ \ 
// | | | | | | | | | (__  | |    | (_) | | |_) | | | | | | (_) | | | | | |  __/  _  | | | |
// |_| |_| |_| |_|  \___| |_|     \___/  | .__/  |_| |_|  \___/  |_| |_|  \___| (_) |_| |_|
//                                       | |
//                                       |_|
//
// Functions for reading and storing data acquired by the I2S microphone

// Prefer ESP-IDF v5 I2S std driver; fall back to legacy driver if unavailable
#if __has_include(<driver/i2s_std.h>)
#  define MICROPHONE_USE_NEW_I2S 1
#  include <driver/i2s_std.h>
#  include <driver/gpio.h>
#elif __has_include(<driver/i2s.h>)
#  define MICROPHONE_USE_NEW_I2S 0
#  include <driver/i2s.h>
#else
#  error "I2S driver header not found. ESP-IDF headers are required."
#endif

// Task watchdog timer for recovery monitoring (Phase 0)
#if __has_include(<esp_task_wdt.h>)
#  include <esp_task_wdt.h>
#endif

#if MICROPHONE_USE_NEW_I2S
#  ifndef portMAX_DELAY
#    define portMAX_DELAY 0xFFFFFFFFu
#  endif
#else
#  include <freertos/semphr.h>
#  include <driver/periph_ctrl.h>
#endif

#include "../logging/logger.h"
#include <string.h>

// Define I2S pins for SPH0645 microphone (standard I2S, NOT PDM)
#define I2S_BCLK_PIN  14  // BCLK (Bit Clock)
#define I2S_LRCLK_PIN 12  // LRCLK (Left/Right Clock / Word Select) - CRITICAL!
#define I2S_DIN_PIN   13  // DIN (Data In / DOUT from microphone)

// ============================================================================
// AUDIO CONFIGURATION: 16kHz, 128-chunk (8ms cadence)
// ============================================================================
// Chunk duration: 128 samples / 16000 Hz = 8ms
// This aligns with ring buffer and Goertzel FFT processing cadence
#define CHUNK_SIZE 64  // EMOTISCOPE VERBATIM (was 128)
#define SAMPLE_RATE 12800  // EMOTISCOPE VERBATIM (was 16000)

#define SAMPLE_HISTORY_LENGTH 4096

// NOTE: sample_history is declared in goertzel.h - don't duplicate
// float sample_history[SAMPLE_HISTORY_LENGTH];
constexpr float recip_scale = 1.0 / 131072.0; // max 18 bit signed value

// Synchronization flags for microphone I2S ISR coordination
// Uses acquire/release ordering for ISR synchronization
#include <atomic>
#include "../error_codes.h"

// ============================================================================
// I2S TIMEOUT PROTECTION & RECOVERY (Phase 0)
// ============================================================================
typedef struct {
    uint32_t timeout_count;          // Total I2S read timeouts
    uint32_t consecutive_failures;   // Current failure streak
    uint32_t last_failure_time_ms;   // Timestamp of last failure
    uint8_t last_error_code;         // Most recent error code
    bool in_fallback_mode;           // Using silence fallback
    uint32_t fallback_start_time_ms; // When fallback mode began
} I2STimeoutState;

// Globals (defined in microphone.cpp)
extern std::atomic<bool> waveform_locked;
extern std::atomic<bool> waveform_sync_flag;
extern I2STimeoutState i2s_timeout_state;
#if MICROPHONE_USE_NEW_I2S
extern i2s_chan_handle_t rx_handle;
#endif

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Shift array left and copy new data to the end
inline void shift_and_copy_arrays(float* dest, int dest_len, float* src, int src_len) {
    memmove(dest, dest + src_len, (dest_len - src_len) * sizeof(float));
    memcpy(dest + (dest_len - src_len), src, src_len * sizeof(float));
}

// Public API
void init_i2s_microphone();
void acquire_sample_chunk();
const I2STimeoutState& get_i2s_timeout_state();  // Read-only access to timeout stats
bool audio_input_is_active();

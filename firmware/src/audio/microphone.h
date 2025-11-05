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

// Use Arduino/ESP-IDF headers directly to avoid type conflicts
#include <Arduino.h>
#include <driver/gpio.h>
#include <driver/i2s_std.h>

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
#define CHUNK_SIZE 128
#define SAMPLE_RATE 16000

#define SAMPLE_HISTORY_LENGTH 4096

// NOTE: sample_history is declared in goertzel.h - don't duplicate
// float sample_history[SAMPLE_HISTORY_LENGTH];
constexpr float recip_scale = 1.0 / 131072.0; // max 18 bit signed value

// Synchronization flags for microphone I2S ISR coordination
// Uses acquire/release ordering for ISR synchronization
#include <atomic>

// Globals (defined in microphone.cpp)
extern std::atomic<bool> waveform_locked;
extern std::atomic<bool> waveform_sync_flag;
extern i2s_chan_handle_t rx_handle;

// Public API
void init_i2s_microphone();
void acquire_sample_chunk();

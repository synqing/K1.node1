// -----------------------------------------------------------------
//                                 _                  _       _
//                                | |                | |     | |
//    __ _    ___     ___   _ __  | |_   ____   ___  | |     | |__
//   / _` |  / _ \   / _ \ | '__| | __| |_  /  / _ \ | |     | '_ \
//  | (_| | | (_) | |  __/ | |    | |_   / /  |  __/ | |  _  | | | |
//   \__, |  \___/   \___| |_|     \__| /___|  \___| |_| (_) |_| |_|
//    __/ |
//   |___/
//
// Goertzel Algorithm - Frequency Domain Analysis via Constant-Q Transform
// https://en.wikipedia.org/wiki/Goertzel_algorithm
//
// Interface header: struct definitions, extern declarations, configuration

#ifndef GOERTZEL_H
#define GOERTZEL_H

#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <esp_timer.h>
#include <stdint.h>
#include <cstring>
#include <cmath>
#include <atomic>
#include "validation/tempo_validation.h"

// Profiling macro - simplified for now (just execute lambda)
#define profile_function(lambda, name) lambda()
#define ___() do {} while(0)

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

// Audio sample buffer
#define SAMPLE_RATE 16000
#define SAMPLE_HISTORY_LENGTH 4096

#define TWOPI   6.28318530
#define FOURPI 12.56637061
#define SIXPI  18.84955593

#define NOISE_CALIBRATION_FRAMES 512

// Frequency analysis configuration
#define NUM_FREQS 64

#define BOTTOM_NOTE 12	// EMOTISCOPE VERBATIM: Quarter-step 12 = 58.27 Hz (restores low bass 58-116 Hz)
#define NOTE_STEP 2 // Use half-steps anyways

// Tempo detection configuration (50-150 BPM range, 0.78 BPM/bin resolution)
#define NUM_TEMPI 128

// Goertzel processing
#define MAX_AUDIO_RECORDING_SAMPLES 1024

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Goertzel filter state for a single frequency bin
struct freq {
	float target_freq;
	uint16_t block_size;
	float window_step;
	float coeff;
	float magnitude;
	float magnitude_full_scale;
	float magnitude_last;
	float novelty;
};

// Tempo detection structure - represents a single tempo hypothesis
typedef struct {
	float target_tempo_hz;                  // Target tempo frequency (Hz)
	float coeff;                            // Goertzel coefficient (2*cos(ω))
	float sine;                             // Precomputed sin(ω)
	float cosine;                           // Precomputed cos(ω)
	float window_step;                      // Window lookup increment
	float phase;                            // Beat phase (radians, -π to π)
	float phase_target;                     // Target phase for synchronization
	bool  phase_inverted;                   // Phase inversion flag
	float phase_radians_per_reference_frame;// Phase advance per reference frame
	float beat;                             // Beat trigger (-1.0 to 1.0, sin(phase))
	float magnitude;                        // Current beat magnitude (normalized 0.0-1.0)
	float magnitude_full_scale;             // Full-scale magnitude before auto-ranging
	float magnitude_smooth;                 // Smoothed magnitude (tempo_smooth)
	uint32_t block_size;                    // Goertzel block size (samples)
} tempo;

// Audio data payload - non-atomic data only (safe for memcpy)
// Separated from atomic sequence counters to prevent undefined behavior
typedef struct {
	// Frequency spectrum data (64 bins covering ~50Hz to 6.4kHz)
	float spectrogram[NUM_FREQS];           // Raw frequency magnitudes (0.0-1.0)
	float spectrogram_smooth[NUM_FREQS];    // Smoothed spectrum (8-sample average)
	float spectrogram_absolute[NUM_FREQS];   // Pre-normalized spectrum (absolute loudness)

	// Musical note energy (12 pitch classes: C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
	float chromagram[12];                   // Chroma energy distribution

	// Audio level tracking
	float vu_level;                         // Overall audio RMS level (0.0-1.0)
	float vu_level_raw;                     // Unfiltered VU level

	// Tempo/beat detection
	float novelty_curve;                    // Spectral flux (onset detection)
	float tempo_confidence;                 // Beat detection confidence (0.0-1.0)
	float tempo_magnitude[NUM_TEMPI];       // Tempo bin magnitudes (96 bins)
	float tempo_phase[NUM_TEMPI];           // Tempo bin phases (96 bins)
	float locked_tempo_bpm;                 // BPM when tempo is locked and stable
	TempoLockState tempo_lock_state;        // Current state of the tempo lock tracker

	// FFT data (reserved for future full-spectrum analysis)
	// Currently using Goertzel for musical note detection (more efficient)
	float fft_smooth[128];                  // Smoothed FFT bins (placeholder)

	// Metadata
	uint32_t update_counter;                // Increments with each audio frame
	uint32_t timestamp_us;                  // Microsecond timestamp (esp_timer)
	bool is_valid;                          // True if data has been written at least once
} AudioDataPayload;

// Sequenced audio buffer - atomic sequence counters + data payload
// Used for lock-free dual-core synchronization (Core 0 audio writes, Core 1 GPU reads)
// CRITICAL: Atomics are NEVER copied with memcpy (undefined behavior)
typedef struct {
	// SYNCHRONIZATION: Sequence counter for torn read detection
	// Seqlock protocol:
	//   - Writer: Increment to ODD (signal writing), update payload, increment to EVEN (signal complete)
	//   - Reader: Read sequence, copy payload, verify sequence unchanged and EVEN
	// Uses memory_order_acquire/release for ESP32-S3 dual-core cache coherency
	std::atomic<uint32_t> sequence{0};      // Sequence number (even = valid, odd = writing)

	// Data payload (non-atomic, safe for memcpy)
	AudioDataPayload payload;

	// SYNCHRONIZATION: End sequence counter for validation
	std::atomic<uint32_t> sequence_end{0};  // Must match sequence for valid read
} SequencedAudioBuffer;

// Legacy type alias for compatibility
typedef SequencedAudioBuffer AudioDataSnapshot;

// ============================================================================
// GLOBAL AUDIO DATA (DEFINITIONS)
// ============================================================================

// Frequency analysis arrays
extern float spectrogram[NUM_FREQS];              // Raw frequency spectrum
extern float spectrogram_smooth[NUM_FREQS];      // Smoothed spectrum
extern float spectrogram_absolute[NUM_FREQS];   // Pre-normalized spectrum
extern float chromagram[12];                      // 12-pitch-class energy

// Audio level
extern float audio_level;                        // Overall RMS level (0.0-1.0)

// Tempo/beat detection
extern tempo tempi[NUM_TEMPI];                   // Tempo bin detectors
extern float tempi_smooth[NUM_TEMPI];            // Smoothed tempo bins

// Sample history buffer
extern float sample_history[SAMPLE_HISTORY_LENGTH];

// Goertzel state
extern freq frequencies_musical[NUM_FREQS];
extern float window_lookup[4096];
extern uint16_t max_goertzel_block_size;
extern std::atomic<bool> magnitudes_locked;

// Audio processing state
extern uint32_t noise_calibration_active_frames_remaining;
extern float noise_spectrum[64];

typedef struct {
    float vu_floor;           // Reserved: runtime-adjustable floor offset (used by noise cal)
    float microphone_gain;    // 0.5 - 2.0x (0.5 = -6dB, 1.0 = 0dB, 2.0 = +6dB)
    float vu_floor_pct;       // Multiplier for dynamic floor (default 0.90; lower increases sensitivity)
} AudioConfiguration;

extern AudioConfiguration configuration;
extern bool EMOTISCOPE_ACTIVE;
extern bool audio_recording_live;
extern int audio_recording_index;
extern int16_t audio_debug_recording[MAX_AUDIO_RECORDING_SAMPLES];

// Spectrogram averaging
#define NUM_SPECTROGRAM_AVERAGE_SAMPLES 12  // EMOTISCOPE VERBATIM (was 8)
extern float spectrogram_average[NUM_SPECTROGRAM_AVERAGE_SAMPLES][NUM_FREQS];
extern uint8_t spectrogram_average_index;

// Tempo history ring buffer - REMOVED for memory optimization
// #define NUM_TEMPO_HISTORY_FRAMES 64
// extern float tempo_history[NUM_TEMPO_HISTORY_FRAMES][NUM_TEMPI];
// extern uint8_t tempo_history_index;
// extern uint32_t tempo_history_wraps;

// Double-buffering for thread-safe audio sync
extern AudioDataSnapshot audio_front;
extern AudioDataSnapshot audio_back;
extern SemaphoreHandle_t audio_swap_mutex;
extern SemaphoreHandle_t audio_read_mutex;

// ============================================================================
// PUBLIC API - INITIALIZATION & PROCESSING
// ============================================================================

// Initialize audio globals with test data (called in setup())
void init_audio_stubs();

// Initialize Goertzel DFT constants for musical note detection
void init_goertzel_constants_musical();

// Initialize window function lookup table for Goertzel smoothing
void init_window_lookup();

// Initialize audio data synchronization (double-buffering)
void init_audio_data_sync();

// ============================================================================
// PUBLIC API - AUDIO PROCESSING (called by audio task on Core 1)
// ============================================================================

// Acquire sample chunk from microphone I2S buffer
// Blocks on portMAX_DELAY until next chunk is ready (synchronization via I2S DMA)
void acquire_sample_chunk();

// Calculate frequency magnitudes using Goertzel algorithm
void calculate_magnitudes();

// Extract 12-pitch-class chromagram from spectrogram
void get_chromagram();

// Commit audio frame and swap buffers (Core 1 → Core 0)
void finish_audio_frame();

// Start noise floor calibration
void start_noise_calibration();

// ============================================================================
// PUBLIC API - AUDIO DATA ACCESS (thread-safe, called from pattern rendering)
// ============================================================================

// Get snapshot of current audio data (non-blocking)
bool get_audio_snapshot(AudioDataSnapshot* snapshot);

// Commit audio data from back buffer to front buffer (atomic swap)
// Used by test suites to validate lock-free synchronization
void commit_audio_data();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Inline helper: clip float to [0.0, 1.0]
#ifndef CLIP_FLOAT_DEFINED
#define CLIP_FLOAT_DEFINED
inline float clip_float(float val) {
	return fmax(0.0f, fmin(1.0f, val));
}
#endif

// Inline stubs for Emotiscope-specific functions (no-op in K1)
// Note: broadcast is not inlined here to avoid Serial dependency
void broadcast(const char* msg);  // Defined in goertzel.cpp
inline void save_config() {}
inline void save_noise_spectrum() {}
inline void save_audio_debug_recording() {}

// ESP-DSP stubs removed - use proper wrappers from dsps_helpers.h instead

#endif  // GOERTZEL_H

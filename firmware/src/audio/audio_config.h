// Shared audio configuration for microphone + DSP
// NOTE: Runtime baseline is currently 12.8 kHz / 64-sample chunks
// The design target remains 16 kHz / 128-sample chunks (~8 ms).

#ifndef AUDIO_CONFIG_H
#define AUDIO_CONFIG_H

#include <stdint.h>

// Core capture timing (single source of truth)
#define AUDIO_SAMPLE_RATE_HZ 12800
#define AUDIO_CHUNK_SIZE     64

// C++ constants for type-safe usage in code
constexpr uint32_t kAudioSampleRateHz = AUDIO_SAMPLE_RATE_HZ;
constexpr uint16_t kAudioChunkSize    = AUDIO_CHUNK_SIZE;

// Guard against accidental legacy macro redefinition in audio modules
#ifdef SAMPLE_RATE
#error "Do not define SAMPLE_RATE directly; use AUDIO_SAMPLE_RATE_HZ / kAudioSampleRateHz from audio_config.h"
#endif

#ifdef CHUNK_SIZE
#error "Do not define CHUNK_SIZE directly; use AUDIO_CHUNK_SIZE / kAudioChunkSize from audio_config.h"
#endif

#endif // AUDIO_CONFIG_H


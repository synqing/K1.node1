# Audio System Dependencies

This document lists external dependencies required by the ported Emotiscope audio files.

## Critical Calibration Values - VERIFIED

All critical calibration values are intact in the ported files:

### microphone.h
- `SAMPLE_RATE = 12800` (line 22) ✓
- DC offset calculation: `((raw >> 14) + 7000) - 360` (lines 96-99) ✓

### goertzel.h
- `sigma = 0.8` (line 112) ✓
- Musical frequency spacing table (lines 25-26) ✓

### tempo.h
- `NOVELTY_LOG_HZ = 50` (line 16) ✓
- `BEAT_SHIFT_PERCENT = 0.08` (line 21) ✓

## External Dependencies Required

These symbols must be provided by the K1.reinvented firmware:

### Type Definitions
- `freq` struct (frequency bin data structure)
- `tempo` struct (tempo bin data structure)

### Constants
- `NUM_FREQS` - Number of frequency bins (likely 64)
- `REFERENCE_FPS` - Reference frame rate for tempo phase calculation
- `PI` - Pi constant (standard math)

### Functions
- `profile_function(lambda, name)` - Performance profiling wrapper
- `shift_and_copy_arrays(dest, dest_len, src, src_len)` - Array shifting utility
- `shift_array_left(array, length, shift_amount)` - Array shifting utility
- `clip_float(value)` - Clamp float to 0.0-1.0 range
- `dsps_mulc_f32(src, dest, length, multiplier, stride_src, stride_dest)` - ESP-DSP vector multiply

### Global Variables
- `noise_spectrum[NUM_FREQS]` - Noise floor calibration data
- `spectrogram_smooth[NUM_FREQS]` - Smoothed frequency magnitudes
- `vu_max` - VU meter maximum value
- `t_now_us` - Current time in microseconds
- `configuration.vu_floor` - VU floor calibration value
- `EMOTISCOPE_ACTIVE` - Enable/disable audio processing flag
- `audio_recording_live` - Debug recording flag
- `audio_recording_index` - Debug recording index
- `audio_debug_recording[]` - Debug recording buffer
- `MAX_AUDIO_RECORDING_SAMPLES` - Debug recording buffer size

### Optional Functions (for debug/calibration)
- `broadcast(message)` - Send message to UI
- `save_config()` - Save configuration to storage
- `save_noise_spectrum()` - Save noise calibration data
- `save_audio_debug_recording()` - Save debug recording to storage

## Recommended Stub Implementations

For initial compilation without full integration:

```cpp
// Type stubs
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

struct tempo {
    float target_tempo_hz;
    uint16_t block_size;
    float window_step;
    float coeff;
    float cosine;
    float sine;
    float magnitude;
    float magnitude_full_scale;
    float phase;
    float phase_radians_per_reference_frame;
    float beat;
    bool phase_inverted;
};

// Constants
#define NUM_FREQS 64
#define REFERENCE_FPS 450
#define PI 3.14159265359f

// Function stubs
#define profile_function(lambda, name) lambda()
inline void shift_and_copy_arrays(float* dest, int dest_len, float* src, int src_len) {
    memmove(dest, dest + src_len, (dest_len - src_len) * sizeof(float));
    memcpy(dest + (dest_len - src_len), src, src_len * sizeof(float));
}
inline void shift_array_left(float* array, int length, int shift) {
    memmove(array, array + shift, (length - shift) * sizeof(float));
}
inline float clip_float(float val) { return fmax(0.0f, fmin(1.0f, val)); }

// Global stubs
float noise_spectrum[NUM_FREQS] = {0};
float vu_max = 0.0f;
uint32_t t_now_us = 0;
struct { float vu_floor; } configuration = {0.0f};
bool EMOTISCOPE_ACTIVE = true;
bool audio_recording_live = false;
int audio_recording_index = 0;
int16_t audio_debug_recording[1024];
#define MAX_AUDIO_RECORDING_SAMPLES 1024

// Optional function stubs
inline void broadcast(const char* msg) {}
inline void save_config() {}
inline void save_noise_spectrum() {}
inline void save_audio_debug_recording() {}
```

## ESP-IDF Dependencies

The audio system requires these ESP-IDF components:

- `driver/i2s_std.h` - I2S hardware driver
- `driver/gpio.h` - GPIO configuration
- ESP-DSP library for `dsps_mulc_f32`

Add to platformio.ini:
```ini
lib_deps = 
    espressif/esp-dsp@^1.4.0
```

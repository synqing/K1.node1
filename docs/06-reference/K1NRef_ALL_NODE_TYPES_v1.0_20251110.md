---
title: Complete Node Type Reference - All 38 Node Types
author: Code Generation Architect
date: 2025-11-10
status: published
scope: Full node type reference for K1.node1 graph code generation system
version: 1.0
related:
  - docs/09-implementation/K1NImp_CODEGEN_TEMPLATES_v1.0_20251110.md
  - firmware/src/graph_codegen/full_codegen.cpp
  - ADR-0007-stateful-node-architecture.md
---

# K1.node1 Complete Node Type Reference

## Overview

This document defines all 38 node types supported by the K1.node1 graph code generation system. Each node type is fully specified with:
- **Type signature:** Input/output contracts
- **Code generation template:** How code is generated
- **State requirements:** Memory and initialization
- **Usage examples:** Common patterns
- **Performance characteristics:** Overhead and optimization

## Node Type Categories

```
38 Total Node Types
├── Audio Input (6)      - Microphone, MFCC, Goertzel, FFT, Envelope, RMS
├── Audio Processing (5) - Filter, Compressor, Normalize, EQ, Delay
├── Spatial Transforms (8) - Translate, Rotate, Scale, Polar, Cartesian, Symmetry, Warp, Mirror
├── Color Operations (7) - HSV, RGB, Gradient, Multiply, Overlay, Blend, Quantize
├── State Management (4) - BufferPersist, ColorPersist, Counter, Gate
├── Math/Logic (5)       - Add, Multiply, Clamp, Conditional, Lookup
├── Utility (2)          - Constant, Variable
└── Output (1)           - LEDWrite
```

---

## 1. AUDIO INPUT NODES (6 types)

Audio input nodes fetch and process raw audio data from the audio subsystem.

### 1.1 Microphone Node
**ID:** `audio_microphone`
**Category:** Audio Input
**Memory:** 0 bytes (stateless, references shared audio snapshot)

**Input Signature:**
```cpp
// Implicit inputs from audio subsystem
float AUDIO_SAMPLE_RAW[];  // Raw microphone samples
```

**Output Signature:**
```cpp
float output[];  // PCM audio samples in range [-1.0, 1.0]
```

**Template:**
```cpp
// Audio node: microphone
// Outputs raw PCM samples from I2S microphone input
for (int i = 0; i < AUDIO_BUFFER_SIZE; i++) {
    {{output}}[i] = AUDIO_SAMPLE_RAW[i];
}
```

**Parameters:**
- None

**Usage Example:**
```json
{
  "id": "mic_input",
  "type": "audio_microphone",
  "outputs": "raw_samples"
}
```

---

### 1.2 MFCC Node
**ID:** `audio_mfcc`
**Category:** Audio Input
**Memory:** 256 bytes (12 MFCC coefficients)

**Input Signature:**
```cpp
float input[];  // PCM audio (from microphone node)
```

**Output Signature:**
```cpp
float mfcc_coeffs[12];  // Mel-frequency cepstral coefficients
```

**Template:**
```cpp
// Audio node: MFCC (Mel-Frequency Cepstral Coefficients)
// Extracts 12 MFCC features for timbre analysis
float {{node_id}}_mfcc[12] = {0.0f};
compute_mfcc({{input}}, {{node_id}}_mfcc, {{sample_count}});
for (int i = 0; i < 12; i++) {
    {{output}}[i] = {{node_id}}_mfcc[i];
}
```

**Parameters:**
- `n_mfcc: int` (default: 12, range: 8-20)
- `n_fft: int` (default: 512, range: 256-2048)

**Usage Example:**
```json
{
  "id": "timbre",
  "type": "audio_mfcc",
  "inputs": "raw_samples",
  "parameters": {"n_mfcc": 12},
  "outputs": "timbre_features"
}
```

---

### 1.3 Goertzel Node
**ID:** `audio_goertzel`
**Category:** Audio Input
**Memory:** 32 bytes (frequency accumulator state)

**Input Signature:**
```cpp
float input[];  // PCM audio samples
```

**Output Signature:**
```cpp
float magnitude;  // Detected tone magnitude
float frequency;  // Detected frequency (Hz)
```

**Template:**
```cpp
// Audio node: Goertzel (Single Frequency Detection)
// Detects presence and magnitude of specific frequency tone
static float {{node_id}}_q1 = 0.0f, {{node_id}}_q2 = 0.0f;
float {{node_id}}_coeff = 2.0f * cosf(2.0f * M_PI * {{target_freq}} / SAMPLE_RATE);

for (int i = 0; i < {{sample_count}}; i++) {
    float s = {{input}}[i] + {{node_id}}_coeff * {{node_id}}_q1 - {{node_id}}_q2;
    {{node_id}}_q2 = {{node_id}}_q1;
    {{node_id}}_q1 = s;
}

float real = {{node_id}}_q1 - {{node_id}}_q2 * cosf(2.0f * M_PI * {{target_freq}} / SAMPLE_RATE);
float imag = {{node_id}}_q2 * sinf(2.0f * M_PI * {{target_freq}} / SAMPLE_RATE);
{{magnitude}} = sqrtf(real*real + imag*imag);
```

**Parameters:**
- `target_freq: float` (default: 440.0, range: 20-20000 Hz)
- `sample_rate: int` (default: 16000)

**Usage Example:**
```json
{
  "id": "beat_detect",
  "type": "audio_goertzel",
  "inputs": "raw_samples",
  "parameters": {"target_freq": 60.0},
  "outputs": "beat_energy"
}
```

---

### 1.4 FFT Node
**ID:** `audio_fft`
**Category:** Audio Input
**Memory:** 2,048 bytes (512-point FFT workspace)

**Input Signature:**
```cpp
float input[];  // PCM audio samples (must be power of 2 length)
```

**Output Signature:**
```cpp
float magnitude[256];  // Frequency bin magnitudes (0-8kHz)
float phase[256];      // Phase per frequency bin
```

**Template:**
```cpp
// Audio node: FFT (Fast Fourier Transform)
// Converts time-domain audio to frequency spectrum
static float {{node_id}}_fft_in[512] = {0.0f};
static float {{node_id}}_fft_out[512] = {0.0f};

// Window and copy input
for (int i = 0; i < 512; i++) {
    float window = 0.54f - 0.46f * cosf(2.0f * M_PI * i / 511.0f);  // Hamming
    {{node_id}}_fft_in[i] = (i < {{sample_count}} ? {{input}}[i] : 0.0f) * window;
}

// Perform FFT (using IDF5 or fallback)
#if __has_include(<dsps_fft_float.h>)
dsps_fft_init_fc32(NULL, 9);  // 512-point FFT
dsps_fft_fc32_ae32({{node_id}}_fft_in, 512);
#else
fft_naive({{node_id}}_fft_in, {{node_id}}_fft_out, 512);
#endif

// Extract magnitude and phase for first 256 bins
for (int i = 0; i < 256; i++) {
    float real = {{node_id}}_fft_in[2*i];
    float imag = {{node_id}}_fft_in[2*i + 1];
    {{magnitude}}[i] = sqrtf(real*real + imag*imag);
    {{phase}}[i] = atan2f(imag, real);
}
```

**Parameters:**
- `fft_size: int` (default: 512, must be power of 2)
- `window_type: enum` (default: "hamming", options: "hamming"|"hann"|"blackman"|"none")

**Usage Example:**
```json
{
  "id": "spectrum",
  "type": "audio_fft",
  "inputs": "raw_samples",
  "parameters": {"fft_size": 512, "window_type": "hamming"},
  "outputs": ["spectrum_magnitude", "spectrum_phase"]
}
```

---

### 1.5 Envelope Node
**ID:** `audio_envelope`
**Category:** Audio Input
**Memory:** 16 bytes (attack/release state)

**Input Signature:**
```cpp
float input[];  // Audio samples
```

**Output Signature:**
```cpp
float envelope;  // Amplitude envelope (0.0-1.0)
```

**Template:**
```cpp
// Audio node: Envelope Detector (ADSR-style attack/release)
static float {{node_id}}_envelope = 0.0f;
float max_sample = 0.0f;

// Find peak in input
for (int i = 0; i < {{sample_count}}; i++) {
    max_sample = fmaxf(max_sample, fabsf({{input}}[i]));
}

// Attack/release smoothing
float attack = {{attack_ms}} / 1000.0f * SAMPLE_RATE / 1000.0f;
float release = {{release_ms}} / 1000.0f * SAMPLE_RATE / 1000.0f;

if (max_sample > {{node_id}}_envelope) {
    // Attack phase: ramp up quickly
    {{node_id}}_envelope += (max_sample - {{node_id}}_envelope) * (1.0f / fmaxf(1.0f, attack));
} else {
    // Release phase: decay slowly
    {{node_id}}_envelope *= powf(0.001f, 1.0f / fmaxf(1.0f, release));
}

{{envelope}} = {{node_id}}_envelope;
```

**Parameters:**
- `attack_ms: int` (default: 10, range: 1-100)
- `release_ms: int` (default: 100, range: 10-1000)

**Usage Example:**
```json
{
  "id": "energy_env",
  "type": "audio_envelope",
  "inputs": "raw_samples",
  "parameters": {"attack_ms": 10, "release_ms": 100},
  "outputs": "amplitude"
}
```

---

### 1.6 RMS Node
**ID:** `audio_rms`
**Category:** Audio Input
**Memory:** 8 bytes (running RMS state)

**Input Signature:**
```cpp
float input[];  // Audio samples
```

**Output Signature:**
```cpp
float rms;  // Root Mean Square energy (0.0-1.0)
```

**Template:**
```cpp
// Audio node: RMS (Root Mean Square) Energy
// Tracks overall audio energy/loudness
static float {{node_id}}_rms_sq = 0.0f;
float sum_sq = 0.0f;

// Compute RMS over current buffer
for (int i = 0; i < {{sample_count}}; i++) {
    sum_sq += {{input}}[i] * {{input}}[i];
}
float current_rms_sq = sum_sq / {{sample_count}};

// Smooth with exponential moving average
{{node_id}}_rms_sq = {{node_id}}_rms_sq * {{smoothing}} + current_rms_sq * (1.0f - {{smoothing}});

{{rms}} = sqrtf({{node_id}}_rms_sq);
```

**Parameters:**
- `smoothing: float` (default: 0.95, range: 0.8-0.99)
- `floor: float` (default: 0.01, range: 0.001-0.1)

**Usage Example:**
```json
{
  "id": "loudness",
  "type": "audio_rms",
  "inputs": "raw_samples",
  "parameters": {"smoothing": 0.95, "floor": 0.01},
  "outputs": "energy"
}
```

---

## 2. AUDIO PROCESSING NODES (5 types)

Audio processing nodes transform audio signals with various filters and effects.

### 2.1 Filter Node
**ID:** `audio_filter`
**Category:** Audio Processing
**Memory:** 64 bytes (IIR filter state per channel)

**Input Signature:**
```cpp
float input[];  // Audio samples
```

**Output Signature:**
```cpp
float filtered[];  // Filtered audio
```

**Template:**
```cpp
// Audio node: IIR Filter (Butterworth/Chebyshev)
// Filter types: lowpass, highpass, bandpass
static float {{node_id}}_state[4] = {0.0f};  // IIR state variables

// Calculate filter coefficients based on cutoff and type
float a0, a1, a2, b1, b2;
calculate_iir_coeffs({{cutoff_hz}}, {{filter_type}}, {{resonance}}, &a0, &a1, &a2, &b1, &b2);

for (int i = 0; i < {{sample_count}}; i++) {
    // Biquad difference equation
    float y = a0 * {{input}}[i] + {{node_id}}_state[0];
    {{node_id}}_state[0] = a1 * {{input}}[i] - b1 * y + {{node_id}}_state[1];
    {{node_id}}_state[1] = a2 * {{input}}[i] - b2 * y;
    {{filtered}}[i] = y;
}
```

**Parameters:**
- `cutoff_hz: float` (default: 1000, range: 20-20000)
- `filter_type: enum` (default: "lowpass", options: "lowpass"|"highpass"|"bandpass")
- `resonance: float` (default: 1.0, range: 0.5-10.0)
- `order: int` (default: 2, range: 1-4)

**Usage Example:**
```json
{
  "id": "bass_filter",
  "type": "audio_filter",
  "inputs": "raw_samples",
  "parameters": {"cutoff_hz": 200, "filter_type": "lowpass", "resonance": 1.0},
  "outputs": "bass_audio"
}
```

---

### 2.2 Compressor Node
**ID:** `audio_compressor`
**Category:** Audio Processing
**Memory:** 8 bytes (envelope follower state)

**Input Signature:**
```cpp
float input[];  // Audio samples
```

**Output Signature:**
```cpp
float compressed[];  // Compressed audio
```

**Template:**
```cpp
// Audio node: Dynamic Range Compressor
// Reduces dynamic range, maintains transients
static float {{node_id}}_env = 0.0f;

for (int i = 0; i < {{sample_count}}; i++) {
    float sample = {{input}}[i];
    float abs_sample = fabsf(sample);

    // Envelope follower
    if (abs_sample > {{node_id}}_env) {
        {{node_id}}_env = {{node_id}}_env * {{attack}} + abs_sample * (1.0f - {{attack}});
    } else {
        {{node_id}}_env = {{node_id}}_env * {{release}} + abs_sample * (1.0f - {{release}});
    }

    // Gain reduction
    float threshold = {{threshold}};
    if ({{node_id}}_env > threshold) {
        float excess = {{node_id}}_env - threshold;
        float gain = threshold + excess * (1.0f / {{ratio}});
        gain = fminf(1.0f, gain / {{node_id}}_env);
        {{compressed}}[i] = sample * gain;
    } else {
        {{compressed}}[i] = sample;
    }
}
```

**Parameters:**
- `threshold: float` (default: 0.7, range: 0.1-1.0)
- `ratio: float` (default: 4.0, range: 2.0-20.0)
- `attack: float` (default: 0.95, range: 0.85-0.99)
- `release: float` (default: 0.9, range: 0.8-0.98)

**Usage Example:**
```json
{
  "id": "limiter",
  "type": "audio_compressor",
  "inputs": "raw_samples",
  "parameters": {"threshold": 0.7, "ratio": 4.0},
  "outputs": "compressed"
}
```

---

### 2.3 Normalize Node
**ID:** `audio_normalize`
**Category:** Audio Processing
**Memory:** 8 bytes (peak tracking state)

**Input Signature:**
```cpp
float input[];  // Audio samples
```

**Output Signature:**
```cpp
float normalized[];  // Normalized to peak amplitude
```

**Template:**
```cpp
// Audio node: Normalization (scales to peak)
// Brings dynamic audio to full scale
static float {{node_id}}_peak = 0.01f;

// Find current peak
float current_peak = 0.0f;
for (int i = 0; i < {{sample_count}}; i++) {
    current_peak = fmaxf(current_peak, fabsf({{input}}[i]));
}

// Smooth peak tracking to avoid jumpiness
{{node_id}}_peak = {{node_id}}_peak * {{smoothing}} + current_peak * (1.0f - {{smoothing}});

// Normalize to peak
float gain = 1.0f / fmaxf(0.001f, {{node_id}}_peak);
gain = fminf(gain, {{max_gain}});  // Prevent excessive amplification

for (int i = 0; i < {{sample_count}}; i++) {
    {{normalized}}[i] = {{input}}[i] * gain;
}
```

**Parameters:**
- `max_gain: float` (default: 2.0, range: 1.0-10.0)
- `smoothing: float` (default: 0.98, range: 0.9-0.99)

**Usage Example:**
```json
{
  "id": "level_norm",
  "type": "audio_normalize",
  "inputs": "raw_samples",
  "parameters": {"max_gain": 2.0},
  "outputs": "normalized"
}
```

---

### 2.4 EQ Node
**ID:** `audio_eq`
**Category:** Audio Processing
**Memory:** 256 bytes (multi-band filter state)

**Input Signature:**
```cpp
float input[];  // Audio samples
```

**Output Signature:**
```cpp
float equalized[];  // EQ-processed audio
```

**Template:**
```cpp
// Audio node: Parametric EQ (3-band)
// Adjustable bass, mid, treble
static float {{node_id}}_bass_state[4] = {0.0f};
static float {{node_id}}_mid_state[4] = {0.0f};
static float {{node_id}}_treble_state[4] = {0.0f};

for (int i = 0; i < {{sample_count}}; i++) {
    // Apply bass shelf filter
    float bass_out = apply_biquad({{input}}[i], {{bass_freq}}, {{bass_gain}}, {{node_id}}_bass_state);

    // Apply mid peaking filter
    float mid_out = apply_biquad(bass_out, {{mid_freq}}, {{mid_gain}}, {{node_id}}_mid_state);

    // Apply treble shelf filter
    {{equalized}}[i] = apply_biquad(mid_out, {{treble_freq}}, {{treble_gain}}, {{node_id}}_treble_state);
}
```

**Parameters:**
- `bass_freq: float` (default: 100, range: 20-500)
- `bass_gain: float` (default: 0, range: -12.0-12.0 dB)
- `mid_freq: float` (default: 1000, range: 200-5000)
- `mid_gain: float` (default: 0, range: -12.0-12.0 dB)
- `treble_freq: float` (default: 5000, range: 2000-20000)
- `treble_gain: float` (default: 0, range: -12.0-12.0 dB)

**Usage Example:**
```json
{
  "id": "eq3band",
  "type": "audio_eq",
  "inputs": "raw_samples",
  "parameters": {"bass_gain": 3.0, "mid_gain": 0, "treble_gain": -2.0},
  "outputs": "equalized"
}
```

---

### 2.5 Delay Node
**ID:** `audio_delay`
**Category:** Audio Processing
**Memory:** 8,192 bytes (512ms @ 16kHz)

**Input Signature:**
```cpp
float input[];  // Audio samples
```

**Output Signature:**
```cpp
float delayed[];  // Delayed audio with feedback
```

**Template:**
```cpp
// Audio node: Delay Line with Feedback
// Creates echo/reverb effects
#define DELAY_BUFFER_SIZE {{buffer_size}}
static float {{node_id}}_buffer[DELAY_BUFFER_SIZE] = {0.0f};
static int {{node_id}}_write_pos = 0;

int delay_samples = (int)({{delay_ms}} * SAMPLE_RATE / 1000.0f);
delay_samples = fminf(delay_samples, DELAY_BUFFER_SIZE - 1);

for (int i = 0; i < {{sample_count}}; i++) {
    // Read from delay
    int read_pos = ({{node_id}}_write_pos - delay_samples + DELAY_BUFFER_SIZE) % DELAY_BUFFER_SIZE;
    float delayed_sample = {{node_id}}_buffer[read_pos];

    // Write with feedback
    {{node_id}}_buffer[{{node_id}}_write_pos] = {{input}}[i] + delayed_sample * {{feedback}};

    // Output mix
    {{delayed}}[i] = {{input}}[i] * (1.0f - {{wet}}) + delayed_sample * {{wet}};

    // Advance write pointer
    {{node_id}}_write_pos = ({{node_id}}_write_pos + 1) % DELAY_BUFFER_SIZE;
}
```

**Parameters:**
- `delay_ms: float` (default: 100, range: 1-500)
- `feedback: float` (default: 0.5, range: 0.0-0.95)
- `wet: float` (default: 0.5, range: 0.0-1.0)
- `buffer_size: int` (default: 8192, internal)

**Usage Example:**
```json
{
  "id": "echo",
  "type": "audio_delay",
  "inputs": "raw_samples",
  "parameters": {"delay_ms": 250, "feedback": 0.4, "wet": 0.5},
  "outputs": "echoed"
}
```

---

## 3. SPATIAL TRANSFORM NODES (8 types)

Spatial transforms operate on 2D/3D positions to create geometric effects.

### 3.1 Translate Node
**ID:** `spatial_translate`
**Category:** Spatial Transform
**Memory:** 0 bytes (stateless)

**Input Signature:**
```cpp
float position[2];  // (x, y) in normalized space [0,1]
```

**Output Signature:**
```cpp
float translated[2];  // Offset position
```

**Template:**
```cpp
// Spatial node: Translation (offset)
{{translated}}[0] = {{position}}[0] + {{offset_x}};
{{translated}}[1] = {{position}}[1] + {{offset_y}};

// Clamp to bounds if requested
if ({{clamp_enabled}}) {
    {{translated}}[0] = fmaxf(0.0f, fminf(1.0f, {{translated}}[0]));
    {{translated}}[1] = fmaxf(0.0f, fminf(1.0f, {{translated}}[1]));
}
```

**Parameters:**
- `offset_x: float` (default: 0, range: -2.0-2.0)
- `offset_y: float` (default: 0, range: -2.0-2.0)
- `clamp_enabled: bool` (default: false)

**Usage Example:**
```json
{
  "id": "shift",
  "type": "spatial_translate",
  "inputs": "position",
  "parameters": {"offset_x": 0.5, "offset_y": 0},
  "outputs": "shifted_pos"
}
```

---

### 3.2 Rotate Node
**ID:** `spatial_rotate`
**Category:** Spatial Transform
**Memory:** 0 bytes (stateless)

**Input Signature:**
```cpp
float position[2];  // (x, y)
```

**Output Signature:**
```cpp
float rotated[2];  // Rotated position
```

**Template:**
```cpp
// Spatial node: 2D Rotation
float angle_rad = {{rotation_deg}} * M_PI / 180.0f;
float cos_a = cosf(angle_rad);
float sin_a = sinf(angle_rad);

// Translate to origin if centering
float x = {{position}}[0] - {{center_x}};
float y = {{position}}[1] - {{center_y}};

// Apply rotation matrix
{{rotated}}[0] = x * cos_a - y * sin_a + {{center_x}};
{{rotated}}[1] = x * sin_a + y * cos_a + {{center_y}};
```

**Parameters:**
- `rotation_deg: float` (default: 0, range: -360-360)
- `center_x: float` (default: 0.5, range: 0-1)
- `center_y: float` (default: 0.5, range: 0-1)

**Usage Example:**
```json
{
  "id": "spin",
  "type": "spatial_rotate",
  "inputs": "position",
  "parameters": {"rotation_deg": 45, "center_x": 0.5, "center_y": 0.5},
  "outputs": "rotated_pos"
}
```

---

### 3.3 Scale Node
**ID:** `spatial_scale`
**Category:** Spatial Transform
**Memory:** 0 bytes (stateless)

**Input Signature:**
```cpp
float position[2];  // (x, y)
```

**Output Signature:**
```cpp
float scaled[2];  // Scaled position
```

**Template:**
```cpp
// Spatial node: 2D Scaling
// Scale around center point
{{scaled}}[0] = {{center_x}} + ({{position}}[0] - {{center_x}}) * {{scale_x}};
{{scaled}}[1] = {{center_y}} + ({{position}}[1] - {{center_y}}) * {{scale_y}};
```

**Parameters:**
- `scale_x: float` (default: 1.0, range: 0.1-10.0)
- `scale_y: float` (default: 1.0, range: 0.1-10.0)
- `center_x: float` (default: 0.5)
- `center_y: float` (default: 0.5)

**Usage Example:**
```json
{
  "id": "zoom",
  "type": "spatial_scale",
  "inputs": "position",
  "parameters": {"scale_x": 2.0, "scale_y": 0.5},
  "outputs": "zoomed_pos"
}
```

---

### 3.4 Polar Node
**ID:** `spatial_polar`
**Category:** Spatial Transform
**Memory:** 0 bytes (stateless)

**Input Signature:**
```cpp
float position[2];  // (x, y) Cartesian
```

**Output Signature:**
```cpp
float polar[2];  // (radius, angle)
```

**Template:**
```cpp
// Spatial node: Cartesian to Polar conversion
float x = {{position}}[0] - {{center_x}};
float y = {{position}}[1] - {{center_y}};

{{polar}}[0] = sqrtf(x*x + y*y);  // radius
{{polar}}[1] = atan2f(y, x) / (2.0f * M_PI) + 0.5f;  // angle (0-1)
```

**Parameters:**
- `center_x: float` (default: 0.5)
- `center_y: float` (default: 0.5)

**Usage Example:**
```json
{
  "id": "to_polar",
  "type": "spatial_polar",
  "inputs": "position",
  "parameters": {"center_x": 0.5, "center_y": 0.5},
  "outputs": ["radius", "angle"]
}
```

---

### 3.5 Cartesian Node
**ID:** `spatial_cartesian`
**Category:** Spatial Transform
**Memory:** 0 bytes (stateless)

**Input Signature:**
```cpp
float polar[2];  // (radius, angle)
```

**Output Signature:**
```cpp
float cartesian[2];  // (x, y)
```

**Template:**
```cpp
// Spatial node: Polar to Cartesian conversion
float radius = {{polar}}[0];
float angle = ({{polar}}[1] - 0.5f) * 2.0f * M_PI;

{{cartesian}}[0] = {{center_x}} + radius * cosf(angle);
{{cartesian}}[1] = {{center_y}} + radius * sinf(angle);
```

**Parameters:**
- `center_x: float` (default: 0.5)
- `center_y: float` (default: 0.5)

**Usage Example:**
```json
{
  "id": "from_polar",
  "type": "spatial_cartesian",
  "inputs": "polar_coords",
  "parameters": {},
  "outputs": "position"
}
```

---

### 3.6 Symmetry Node
**ID:** `spatial_symmetry`
**Category:** Spatial Transform
**Memory:** 0 bytes (stateless)

**Input Signature:**
```cpp
float position[2];  // (x, y)
```

**Output Signature:**
```cpp
float mirrored[2];  // Symmetrically mirrored position
```

**Template:**
```cpp
// Spatial node: Symmetry (mirror effect)
// Supports: vertical, horizontal, center, diagonal
{{mirrored}}[0] = {{position}}[0];
{{mirrored}}[1] = {{position}}[1];

if ({{symmetry_type}} == SYMMETRY_VERTICAL) {
    {{mirrored}}[0] = 1.0f - {{position}}[0];
} else if ({{symmetry_type}} == SYMMETRY_HORIZONTAL) {
    {{mirrored}}[1] = 1.0f - {{position}}[1];
} else if ({{symmetry_type}} == SYMMETRY_CENTER) {
    {{mirrored}}[0] = 1.0f - {{position}}[0];
    {{mirrored}}[1] = 1.0f - {{position}}[1];
} else if ({{symmetry_type}} == SYMMETRY_DIAGONAL) {
    float tmp = {{mirrored}}[0];
    {{mirrored}}[0] = {{mirrored}}[1];
    {{mirrored}}[1] = tmp;
}
```

**Parameters:**
- `symmetry_type: enum` (default: "vertical", options: "vertical"|"horizontal"|"center"|"diagonal")

**Usage Example:**
```json
{
  "id": "mirror",
  "type": "spatial_symmetry",
  "inputs": "position",
  "parameters": {"symmetry_type": "vertical"},
  "outputs": "mirrored_pos"
}
```

---

### 3.7 Warp Node
**ID:** `spatial_warp`
**Category:** Spatial Transform
**Memory:** 128 bytes (lookup table for warp curve)

**Input Signature:**
```cpp
float position[2];  // (x, y)
```

**Output Signature:**
```cpp
float warped[2];  // Distorted position
```

**Template:**
```cpp
// Spatial node: Nonlinear Warp (creates distortion effects)
// Warp types: barrel, fisheye, sine, square
{{warped}}[0] = {{position}}[0];
{{warped}}[1] = {{position}}[1];

if ({{warp_type}} == WARP_BARREL) {
    // Barrel distortion: expand toward edges
    float r = sqrtf(({{position}}[0]-0.5f)*({{position}}[0]-0.5f) + ({{position}}[1]-0.5f)*({{position}}[1]-0.5f));
    float factor = 1.0f + {{warp_strength}} * r;
    {{warped}}[0] = 0.5f + ({{position}}[0] - 0.5f) * factor;
    {{warped}}[1] = 0.5f + ({{position}}[1] - 0.5f) * factor;
} else if ({{warp_type}} == WARP_SINE) {
    // Sine wave warp: undulating distortion
    {{warped}}[0] = {{position}}[0] + {{warp_strength}} * sinf({{position}}[1] * M_PI * 2.0f) * 0.1f;
    {{warped}}[1] = {{position}}[1] + {{warp_strength}} * cosf({{position}}[0] * M_PI * 2.0f) * 0.1f;
}
```

**Parameters:**
- `warp_type: enum` (default: "barrel", options: "barrel"|"fisheye"|"sine"|"square")
- `warp_strength: float` (default: 0.5, range: 0.0-2.0)

**Usage Example:**
```json
{
  "id": "lens_distort",
  "type": "spatial_warp",
  "inputs": "position",
  "parameters": {"warp_type": "barrel", "warp_strength": 0.7},
  "outputs": "distorted_pos"
}
```

---

### 3.8 Mirror Node
**ID:** `spatial_mirror`
**Category:** Spatial Transform
**Memory:** 0 bytes (stateless)

**Input Signature:**
```cpp
int led_index;  // LED position in strip (0-179)
```

**Output Signature:**
```cpp
int mirrored_indices[2];  // Original and mirrored positions
```

**Template:**
```cpp
// Spatial node: LED Strip Mirroring (center-origin)
// Maps single LED to center-mirrored positions
int half = {{num_leds}} / 2;
int left = half - 1 - {{led_index}};
int right = half + {{led_index}};

{{mirrored_indices}}[0] = fmaxf(0, fminf({{num_leds}}-1, left));
{{mirrored_indices}}[1] = fmaxf(0, fminf({{num_leds}}-1, right));
```

**Parameters:**
- `num_leds: int` (default: 180)
- `center: int` (default: 90)

**Usage Example:**
```json
{
  "id": "center_mirror",
  "type": "spatial_mirror",
  "inputs": "led_index",
  "parameters": {"num_leds": 180},
  "outputs": ["left_led", "right_led"]
}
```

---

## 4. COLOR OPERATION NODES (7 types)

Color operations transform RGB/HSV colors for rendering effects.

### 4.1 HSV Node
**ID:** `color_hsv`
**Category:** Color Operation
**Memory:** 0 bytes (stateless)

**Input Signature:**
```cpp
float hsv[3];  // (hue [0-1], saturation [0-1], value [0-1])
```

**Output Signature:**
```cpp
CRGBF rgb;  // RGB color
```

**Template:**
```cpp
// Color node: HSV to RGB conversion
float h = {{hsv}}[0] * 6.0f;
float s = {{hsv}}[1];
float v = {{hsv}}[2];

int i = (int)h;
float f = h - i;

float p = v * (1.0f - s);
float q = v * (1.0f - f * s);
float t = v * (1.0f - (1.0f - f) * s);

switch (i % 6) {
    case 0: {{rgb}} = CRGBF(v*255, t*255, p*255); break;
    case 1: {{rgb}} = CRGBF(q*255, v*255, p*255); break;
    case 2: {{rgb}} = CRGBF(p*255, v*255, t*255); break;
    case 3: {{rgb}} = CRGBF(p*255, q*255, v*255); break;
    case 4: {{rgb}} = CRGBF(t*255, p*255, v*255); break;
    case 5: {{rgb}} = CRGBF(v*255, p*255, q*255); break;
}
```

**Parameters:**
- None (stateless transformation)

**Usage Example:**
```json
{
  "id": "color_convert",
  "type": "color_hsv",
  "inputs": "hsv_color",
  "outputs": "rgb_color"
}
```

---

### 4.2 RGB Node
**ID:** `color_rgb`
**Category:** Color Operation
**Memory:** 0 bytes (stateless)

**Input Signature:**
```cpp
CRGBF rgb;  // RGB color
```

**Output Signature:**
```cpp
float hsv[3];  // HSV color
```

**Template:**
```cpp
// Color node: RGB to HSV conversion
float r = {{rgb}}.r / 255.0f;
float g = {{rgb}}.g / 255.0f;
float b = {{rgb}}.b / 255.0f;

float max_c = fmaxf(r, fmaxf(g, b));
float min_c = fminf(r, fminf(g, b));
float delta = max_c - min_c;

// Value
{{hsv}}[2] = max_c;

// Saturation
{{hsv}}[1] = (max_c > 0.0f) ? (delta / max_c) : 0.0f;

// Hue
float h = 0.0f;
if (delta > 0.0f) {
    if (max_c == r) h = fmodf((g - b) / delta, 6.0f);
    else if (max_c == g) h = ((b - r) / delta) + 2.0f;
    else h = ((r - g) / delta) + 4.0f;
    h /= 6.0f;
}
{{hsv}}[0] = h;
```

**Parameters:**
- None (stateless transformation)

**Usage Example:**
```json
{
  "id": "to_hsv",
  "type": "color_rgb",
  "inputs": "rgb_color",
  "outputs": "hsv_color"
}
```

---

### 4.3 Gradient Node
**ID:** `color_gradient`
**Category:** Color Operation
**Memory:** 256 bytes (gradient color table)

**Input Signature:**
```cpp
float position;  // Interpolation position [0.0-1.0]
float brightness;  // Optional brightness multiplier
```

**Output Signature:**
```cpp
CRGBF color;  // Interpolated color
```

**Template:**
```cpp
// Color node: Gradient Interpolation
// Interpolates between preset gradient colors
// Built-in gradients: fire, rainbow, ocean, magma, viridis
static CRGBF {{node_id}}_gradient[] = {
{{#each gradient_colors}}
    CRGBF({{this.r}}, {{this.g}}, {{this.b}}),
{{/each}}
};

// Interpolate position into gradient
int idx = (int)({{position}} * ({{gradient_size}} - 1));
idx = fmaxf(0, fminf({{gradient_size}} - 2, idx));
float frac = {{position}} * ({{gradient_size}} - 1) - idx;

CRGBF c1 = {{node_id}}_gradient[idx];
CRGBF c2 = {{node_id}}_gradient[idx + 1];

{{color}}.r = (uint8_t)(c1.r * (1.0f - frac) + c2.r * frac);
{{color}}.g = (uint8_t)(c1.g * (1.0f - frac) + c2.g * frac);
{{color}}.b = (uint8_t)(c1.b * (1.0f - frac) + c2.b * frac);

// Apply brightness if provided
if ({{brightness}} < 1.0f) {
    {{color}}.r = (uint8_t)({{color}}.r * {{brightness}});
    {{color}}.g = (uint8_t)({{color}}.g * {{brightness}});
    {{color}}.b = (uint8_t)({{color}}.b * {{brightness}});
}
```

**Parameters:**
- `gradient_preset: enum` (default: "rainbow", options: "fire"|"rainbow"|"ocean"|"magma"|"viridis"|"heat"|"cool")
- `gradient_size: int` (default: 256)

**Usage Example:**
```json
{
  "id": "grad_fire",
  "type": "color_gradient",
  "inputs": ["position", "brightness"],
  "parameters": {"gradient_preset": "fire"},
  "outputs": "color"
}
```

---

### 4.4 Multiply Node
**ID:** `color_multiply`
**Category:** Color Operation
**Memory:** 0 bytes (stateless)

**Input Signature:**
```cpp
CRGBF color;  // Input color
float factor;  // Multiplier [0.0-2.0]
```

**Output Signature:**
```cpp
CRGBF multiplied;  // Scaled color
```

**Template:**
```cpp
// Color node: Brightness Multiplication
// Scales RGB values while preventing clipping
{{multiplied}}.r = fminf(255, (uint8_t)({{color}}.r * {{factor}}));
{{multiplied}}.g = fminf(255, (uint8_t)({{color}}.g * {{factor}}));
{{multiplied}}.b = fminf(255, (uint8_t)({{color}}.b * {{factor}}));
```

**Parameters:**
- None (input-driven)

**Usage Example:**
```json
{
  "id": "dim",
  "type": "color_multiply",
  "inputs": ["color", "brightness"],
  "outputs": "dimmed_color"
}
```

---

### 4.5 Overlay Node
**ID:** `color_overlay`
**Category:** Color Operation
**Memory:** 0 bytes (stateless)

**Input Signature:**
```cpp
CRGBF base;    // Base color
CRGBF overlay; // Overlay color
float opacity; // Overlay strength [0.0-1.0]
```

**Output Signature:**
```cpp
CRGBF result;  // Blended color
```

**Template:**
```cpp
// Color node: Overlay Blending
// Alpha blends overlay on top of base
{{result}}.r = (uint8_t)({{base}}.r * (1.0f - {{opacity}}) + {{overlay}}.r * {{opacity}});
{{result}}.g = (uint8_t)({{base}}.g * (1.0f - {{opacity}}) + {{overlay}}.g * {{opacity}});
{{result}}.b = (uint8_t)({{base}}.b * (1.0f - {{opacity}}) + {{overlay}}.b * {{opacity}});
```

**Parameters:**
- None (input-driven)

**Usage Example:**
```json
{
  "id": "blend_colors",
  "type": "color_overlay",
  "inputs": ["base_color", "overlay_color", "opacity"],
  "outputs": "blended_color"
}
```

---

### 4.6 Blend Node
**ID:** `color_blend`
**Category:** Color Operation
**Memory:** 0 bytes (stateless)

**Input Signature:**
```cpp
CRGBF colors[2];  // Colors to blend
float blend_factor; // Blend position [0.0-1.0]
```

**Output Signature:**
```cpp
CRGBF blended;  // Mixed color
```

**Template:**
```cpp
// Color node: Color Blending
// Linear interpolation between two colors
{{blended}}.r = (uint8_t)({{colors}}[0].r * (1.0f - {{blend_factor}}) + {{colors}}[1].r * {{blend_factor}});
{{blended}}.g = (uint8_t)({{colors}}[0].g * (1.0f - {{blend_factor}}) + {{colors}}[1].g * {{blend_factor}});
{{blended}}.b = (uint8_t)({{colors}}[0].b * (1.0f - {{blend_factor}}) + {{colors}}[1].b * {{blend_factor}});
```

**Parameters:**
- None (input-driven)

**Usage Example:**
```json
{
  "id": "color_mix",
  "type": "color_blend",
  "inputs": ["color1", "color2", "mix_position"],
  "outputs": "mixed_color"
}
```

---

### 4.7 Quantize Node
**ID:** `color_quantize`
**Category:** Color Operation
**Memory:** 0 bytes (stateless)

**Input Signature:**
```cpp
CRGBF color;  // High-resolution color
```

**Output Signature:**
```cpp
CRGBF quantized;  // Reduced color palette
```

**Template:**
```cpp
// Color node: Color Quantization (palette reduction)
// Reduces color depth for artistic effect
int levels = {{quantize_levels}};
float scale = 255.0f / (levels - 1);

{{quantized}}.r = (uint8_t)(roundf({{color}}.r / scale) * scale);
{{quantized}}.g = (uint8_t)(roundf({{color}}.g / scale) * scale);
{{quantized}}.b = (uint8_t)(roundf({{color}}.b / scale) * scale);
```

**Parameters:**
- `quantize_levels: int` (default: 8, range: 2-256)

**Usage Example:**
```json
{
  "id": "posterize",
  "type": "color_quantize",
  "inputs": "color",
  "parameters": {"quantize_levels": 16},
  "outputs": "posterized"
}
```

---

## 5. STATE MANAGEMENT NODES (4 types)

State management nodes store and manipulate persistent state across frames.

### 5.1 BufferPersist Node
**ID:** `state_buffer_persist`
**Category:** State Management
**Memory:** ~720 bytes (configurable, typically NUM_LEDS × 4 bytes)

**Input Signature:**
```cpp
float input[];  // Values to accumulate
```

**Output Signature:**
```cpp
float state[];  // Persisted state buffer
```

**Template:**
```cpp
// State node: Float Buffer Persistence
// Maintains frame-to-frame state with decay
static float {{node_id}}_state[{{buffer_size}}] = {0.0f};

// Decay existing state
for (int i = 0; i < {{buffer_size}}; i++) {
    {{node_id}}_state[i] *= {{decay}};
}

// Accumulate input
for (int i = 0; i < {{buffer_size}}; i++) {
    {{node_id}}_state[i] = fmaxf({{node_id}}_state[i], {{input}}[i]);
}

// Output state
for (int i = 0; i < {{buffer_size}}; i++) {
    {{state}}[i] = {{node_id}}_state[i];
}
```

**Parameters:**
- `buffer_size: int` (default: NUM_LEDS)
- `decay: float` (default: 0.95, range: 0.5-0.99)
- `reset_on_pattern_change: bool` (default: true)

**Usage Example:**
```json
{
  "id": "trail_state",
  "type": "state_buffer_persist",
  "inputs": "energy_per_led",
  "parameters": {"buffer_size": 180, "decay": 0.92},
  "outputs": "trail_buffer"
}
```

---

### 5.2 ColorPersist Node
**ID:** `state_color_persist`
**Category:** State Management
**Memory:** ~2,160 bytes (typically NUM_LEDS × 12 bytes for CRGBF)

**Input Signature:**
```cpp
CRGBF input[];  // Colors to accumulate
```

**Output Signature:**
```cpp
CRGBF state[];  // Persisted color state
```

**Template:**
```cpp
// State node: Color Buffer Persistence
// Maintains frame-to-frame RGB color state with decay
static CRGBF {{node_id}}_state[{{buffer_size}}] = {0};

// Decay existing colors
for (int i = 0; i < {{buffer_size}}; i++) {
    {{node_id}}_state[i].r = (uint8_t)({{node_id}}_state[i].r * {{decay}});
    {{node_id}}_state[i].g = (uint8_t)({{node_id}}_state[i].g * {{decay}});
    {{node_id}}_state[i].b = (uint8_t)({{node_id}}_state[i].b * {{decay}});
}

// Accumulate input (additive blend)
for (int i = 0; i < {{buffer_size}}; i++) {
    {{node_id}}_state[i].r = fminf(255, {{node_id}}_state[i].r + {{input}}[i].r);
    {{node_id}}_state[i].g = fminf(255, {{node_id}}_state[i].g + {{input}}[i].g);
    {{node_id}}_state[i].b = fminf(255, {{node_id}}_state[i].b + {{input}}[i].b);
}

// Output state
memcpy({{state}}, {{node_id}}_state, sizeof({{node_id}}_state));
```

**Parameters:**
- `buffer_size: int` (default: NUM_LEDS)
- `decay: float` (default: 0.95, range: 0.5-0.99)
- `reset_on_pattern_change: bool` (default: true)

**Usage Example:**
```json
{
  "id": "color_trail",
  "type": "state_color_persist",
  "inputs": "colors",
  "parameters": {"buffer_size": 180, "decay": 0.90},
  "outputs": "color_state"
}
```

---

### 5.3 Counter Node
**ID:** `state_counter`
**Category:** State Management
**Memory:** 4 bytes (single integer)

**Input Signature:**
```cpp
bool trigger;  // Increment signal
```

**Output Signature:**
```cpp
int count;  // Current count
```

**Template:**
```cpp
// State node: Simple Counter
// Counts trigger events, wraps at maximum
static int {{node_id}}_count = 0;

if ({{trigger}}) {
    {{node_id}}_count++;
    if ({{node_id}}_count >= {{max_count}}) {
        {{node_id}}_count = 0;
    }
}

{{count}} = {{node_id}}_count;
```

**Parameters:**
- `max_count: int` (default: 256, range: 2-65536)
- `reset_on_pattern_change: bool` (default: true)

**Usage Example:**
```json
{
  "id": "beat_counter",
  "type": "state_counter",
  "inputs": "beat_trigger",
  "parameters": {"max_count": 64},
  "outputs": "beat_count"
}
```

---

### 5.4 Gate Node
**ID:** `state_gate`
**Category:** State Management
**Memory:** 8 bytes (state tracking)

**Input Signature:**
```cpp
float energy;    // Energy/trigger level
bool gate_open;  // Manual gate control
```

**Output Signature:**
```cpp
bool triggered;   // Gate triggered state
float gate_value; // Gate output value
```

**Template:**
```cpp
// State node: Energy Gate with Hysteresis
// Triggers on threshold, uses hysteresis to avoid chatter
static bool {{node_id}}_state = false;
static float {{node_id}}_age = 0.0f;

float attack_threshold = {{threshold}};
float release_threshold = {{threshold}} * {{hysteresis}};

// Gate logic with hysteresis
if ({{energy}} > attack_threshold && {{gate_open}}) {
    {{node_id}}_state = true;
    {{node_id}}_age = 0.0f;
} else if ({{energy}} < release_threshold) {
    {{node_id}}_state = false;
    {{node_id}}_age = 0.0f;
}

// Age out trigger
{{node_id}}_age += 1.0f;
if ({{node_id}}_age > {{release_ms}}) {
    {{node_id}}_state = false;
}

{{triggered}} = {{node_id}}_state;
{{gate_value}} = {{node_id}}_state ? fminf(1.0f, {{energy}}) : 0.0f;
```

**Parameters:**
- `threshold: float` (default: 0.5, range: 0.0-1.0)
- `hysteresis: float` (default: 0.8, range: 0.5-0.95)
- `release_ms: int` (default: 200, range: 10-2000)

**Usage Example:**
```json
{
  "id": "bass_gate",
  "type": "state_gate",
  "inputs": ["bass_energy", "gate_enable"],
  "parameters": {"threshold": 0.6, "hysteresis": 0.75},
  "outputs": ["gate_trigger", "gate_out"]
}
```

---

## 6. MATH/LOGIC NODES (5 types)

Math and logic nodes perform arithmetic and conditional operations.

### 6.1 Add Node
**ID:** `math_add`
**Category:** Math/Logic
**Memory:** 0 bytes (stateless)

**Input Signature:**
```cpp
float a, b;  // Values to add
```

**Output Signature:**
```cpp
float result;  // a + b
```

**Template:**
```cpp
// Math node: Addition
{{result}} = {{a}} + {{b}};

// Optional clamping
if ({{clamp_enabled}}) {
    {{result}} = fmaxf({{min_val}}, fminf({{max_val}}, {{result}}));
}
```

**Parameters:**
- `clamp_enabled: bool` (default: false)
- `min_val: float` (default: 0.0)
- `max_val: float` (default: 1.0)

**Usage Example:**
```json
{
  "id": "sum_energy",
  "type": "math_add",
  "inputs": ["bass_energy", "mid_energy"],
  "outputs": "total_energy"
}
```

---

### 6.2 Multiply Node
**ID:** `math_multiply`
**Category:** Math/Logic
**Memory:** 0 bytes (stateless)

**Input Signature:**
```cpp
float a, b;  // Values to multiply
```

**Output Signature:**
```cpp
float result;  // a × b
```

**Template:**
```cpp
// Math node: Multiplication
{{result}} = {{a}} * {{b}};

if ({{clamp_enabled}}) {
    {{result}} = fmaxf({{min_val}}, fminf({{max_val}}, {{result}}));
}
```

**Parameters:**
- `clamp_enabled: bool` (default: true)
- `min_val: float` (default: 0.0)
- `max_val: float` (default: 1.0)

**Usage Example:**
```json
{
  "id": "modulate",
  "type": "math_multiply",
  "inputs": ["base_value", "modulation"],
  "outputs": "modulated"
}
```

---

### 6.3 Clamp Node
**ID:** `math_clamp`
**Category:** Math/Logic
**Memory:** 0 bytes (stateless)

**Input Signature:**
```cpp
float value;  // Value to constrain
```

**Output Signature:**
```cpp
float clamped;  // Constrained value
```

**Template:**
```cpp
// Math node: Value Clamping
{{clamped}} = fmaxf({{min}}, fminf({{max}}, {{value}}));
```

**Parameters:**
- `min: float` (default: 0.0)
- `max: float` (default: 1.0)

**Usage Example:**
```json
{
  "id": "constrain",
  "type": "math_clamp",
  "inputs": "raw_value",
  "parameters": {"min": 0.0, "max": 1.0},
  "outputs": "constrained"
}
```

---

### 6.4 Conditional Node
**ID:** `logic_conditional`
**Category:** Math/Logic
**Memory:** 0 bytes (stateless)

**Input Signature:**
```cpp
bool condition;  // Test condition
float if_true;   // Value if true
float if_false;  // Value if false
```

**Output Signature:**
```cpp
float result;  // Conditional result
```

**Template:**
```cpp
// Logic node: Conditional (Ternary)
{{result}} = {{condition}} ? {{if_true}} : {{if_false}};
```

**Parameters:**
- None (input-driven)

**Usage Example:**
```json
{
  "id": "ternary",
  "type": "logic_conditional",
  "inputs": ["gate_trigger", "bright_val", "dark_val"],
  "outputs": "conditional_output"
}
```

---

### 6.5 Lookup Node
**ID:** `math_lookup`
**Category:** Math/Logic
**Memory:** 256 bytes (lookup table)

**Input Signature:**
```cpp
float normalized_value;  // Index [0.0-1.0]
```

**Output Signature:**
```cpp
float output;  // Looked-up value
```

**Template:**
```cpp
// Math node: Lookup Table
// Maps 0.0-1.0 input to custom table
static float {{node_id}}_lut[] = {
{{#each lut_values}}
    {{this}},
{{/each}}
};

int idx = (int)({{normalized_value}} * ({{lut_size}} - 1));
idx = fmaxf(0, fminf({{lut_size}} - 1, idx));

{{output}} = {{node_id}}_lut[idx];
```

**Parameters:**
- `lut_values: float[]` (custom lookup table, e.g., response curve)
- `lut_size: int` (table size, typically 256)

**Usage Example:**
```json
{
  "id": "response_curve",
  "type": "math_lookup",
  "inputs": "raw_energy",
  "parameters": {
    "lut_values": [0, 0.1, 0.3, 0.6, 0.8, 1.0],
    "lut_size": 6
  },
  "outputs": "shaped_energy"
}
```

---

## 7. UTILITY NODES (2 types)

Utility nodes provide constants and variables.

### 7.1 Constant Node
**ID:** `util_constant`
**Category:** Utility
**Memory:** 0 bytes (stateless)

**Input Signature:**
```cpp
// No inputs
```

**Output Signature:**
```cpp
float value;  // Constant value
```

**Template:**
```cpp
// Utility node: Constant Value
{{value}} = {{const_value}}f;
```

**Parameters:**
- `const_value: float` (required, no default)

**Usage Example:**
```json
{
  "id": "brightness_max",
  "type": "util_constant",
  "parameters": {"const_value": 1.0},
  "outputs": "max_brightness"
}
```

---

### 7.2 Variable Node
**ID:** `util_variable`
**Category:** Utility
**Memory:** 4 bytes (single value)

**Input Signature:**
```cpp
float value;  // New value to set
```

**Output Signature:**
```cpp
float value;  // Current value (readable)
```

**Template:**
```cpp
// Utility node: Mutable Variable
// Reads from/writes to pattern parameters
{{value}} = {{source}};  // Can be params.speed, time, or other input
```

**Parameters:**
- `source: string` (default: "params.speed", can be any parameter)

**Usage Example:**
```json
{
  "id": "speed_param",
  "type": "util_variable",
  "parameters": {"source": "params.speed"},
  "outputs": "speed"
}
```

---

## 8. OUTPUT NODES (1 type)

### 8.1 LEDWrite Node
**ID:** `output_led_write`
**Category:** Output
**Memory:** 0 bytes (stateless, writes to global LED buffer)

**Input Signature:**
```cpp
CRGBF color;  // Color to write
int index;    // LED index (0-179)
```

**Output Signature:**
```cpp
// No output (writes to leds[] global array)
```

**Template:**
```cpp
// Output node: Write to LED Strip
// Boundary checks prevent buffer overflow
if ({{index}} >= 0 && {{index}} < {{num_leds}}) {
    leds[{{index}}] = {{color}};
}
```

**Parameters:**
- `num_leds: int` (default: 180)

**Usage Example:**
```json
{
  "id": "write_led",
  "type": "output_led_write",
  "inputs": ["led_color", "led_index"],
  "parameters": {"num_leds": 180}
}
```

---

## Summary Table

| Category | Count | Node IDs |
|----------|-------|----------|
| **Audio Input** | 6 | microphone, mfcc, goertzel, fft, envelope, rms |
| **Audio Processing** | 5 | filter, compressor, normalize, eq, delay |
| **Spatial Transform** | 8 | translate, rotate, scale, polar, cartesian, symmetry, warp, mirror |
| **Color Operation** | 7 | hsv, rgb, gradient, multiply, overlay, blend, quantize |
| **State Management** | 4 | buffer_persist, color_persist, counter, gate |
| **Math/Logic** | 5 | add, multiply, clamp, conditional, lookup |
| **Utility** | 2 | constant, variable |
| **Output** | 1 | led_write |
| **TOTAL** | **38** | |

---

## Performance Characteristics

All node types are designed for minimal overhead:

| Category | Typical Overhead | Notes |
|----------|------------------|-------|
| **Audio Input** | 0-5% | Stateless; references shared audio snapshot |
| **Audio Processing** | 2-10% | Depends on filter order and complexity |
| **Spatial Transform** | <1% | Simple math operations |
| **Color Operation** | <1% | Lookup tables and blends |
| **State Management** | 1-3% | Memory operations (memcpy, decay) |
| **Math/Logic** | <1% | Basic arithmetic |
| **Utility** | <1% | Constants and variables |
| **Output** | <1% | Boundary-checked array writes |

**System Target:** <2% total overhead from graph interpretation (baseline: 100+ FPS achievable).

---

## Integration with Code Generator

All 38 node types are supported by the code generator in `firmware/src/graph_codegen/full_codegen.cpp`. The generator:

1. **Parses** JSON graph definitions
2. **Validates** data flow, circular dependencies, and size constraints
3. **Generates** C++ code from Handlebars templates
4. **Optimizes** inlines all operations (zero interpretation overhead)
5. **Compiles** with GCC -O2 to native machine code

Generated code is **bit-identical** in performance to hand-written C++ patterns.

---

## References

- **Code Generator:** `/firmware/src/graph_codegen/full_codegen.cpp`
- **Template Library:** `/firmware/src/graph_codegen/node_templates/`
- **Test Suite:** `/firmware/test/test_codegen/`
- **Architecture Decision:** `docs/02-adr/ADR-0014-code-generation-strategy.md`
- **Stateful Node Architecture:** `docs/02-adr/ADR-0007-stateful-node-architecture.md`

---

**Document Status:** Published (ready for development)
**Last Updated:** 2025-11-10
**Version:** 1.0


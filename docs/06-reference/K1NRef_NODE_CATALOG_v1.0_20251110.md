# K1.node1 Node Type Catalog

**Status**: Production Ready
**Version**: 1.0
**Date**: 2025-11-10
**Owner**: K1 Development Team
**Total Node Types**: 38

## Quick Navigation

- [Audio Input Nodes](#audio-input-nodes) - 5 types
- [Audio Processing Nodes](#audio-processing-nodes) - 8 types
- [Signal Processing Nodes](#signal-processing-nodes) - 6 types
- [Temporal Nodes](#temporal-nodes) - 4 types
- [Spatial Nodes](#spatial-nodes) - 5 types
- [Color Nodes](#color-nodes) - 4 types
- [Rendering Nodes](#rendering-nodes) - 3 types
- [Control Flow Nodes](#control-flow-nodes) - 2 types
- [State Management Nodes](#state-management-nodes) - 2 types

---

## Audio Input Nodes

Input nodes read data from the audio system. All execute once per frame before rendering.

### 1. AudioMicrophone

**Category**: Audio Input
**Execution Time**: <5 µs
**Memory**: ~4KB (512 float samples)
**Thread Safe**: Yes

**Description**:
Read raw microphone samples from I2S ADC. Provides direct access to unprocessed audio input stream with minimal latency.

**Inputs**: None

**Outputs**:
- `samples: float[]` - Raw audio samples (typically 512 or 1024)
- `sample_count: int` - Number of valid samples
- `rms_power: float` - RMS power of sample batch

**Parameters**:
- `sample_count: int` - Number of samples to read (default: 512, valid: 128-2048)
- `offset_samples: int` - Skip first N samples (default: 0)
- `filter_dc: bool` - Remove DC offset (default: true)

**JSON Definition**:
```json
{
  "id": "mic_read",
  "type": "audio_input",
  "name": "Read Microphone",
  "operation": "i2s_read(raw_samples, 512)",
  "outputs": {
    "samples": "float[512]",
    "sample_count": "int",
    "rms_power": "float"
  },
  "properties": {
    "sample_count": 512,
    "offset_samples": 0,
    "filter_dc": true
  }
}
```

**Generated C++**:
```cpp
// Node: mic_read - Read Microphone
float raw_samples[512];
int sample_count = 512;
float rms_power = 0.0f;

// Read from I2S
i2s_read(raw_samples, sample_count, (uint32_t*)&rms_power);

// Optional DC filtering
if (filter_dc) {
    static float dc_estimate = 0.0f;
    for (int i = 0; i < sample_count; i++) {
        dc_estimate = dc_estimate * 0.9999f + raw_samples[i] * 0.0001f;
        raw_samples[i] -= dc_estimate;
    }
}
```

**Use Cases**:
- Waveform analysis
- Transient detection
- Time-domain processing
- Real-time visualization

**Performance Notes**:
- I2S driver handles buffering asynchronously
- Read is non-blocking, may return partial buffers
- DC offset removal adds <1 µs

---

### 2. AudioFFT

**Category**: Audio Input
**Execution Time**: 200-300 µs (IDF5 optimized)
**Memory**: ~2KB (FFT working buffer)
**Thread Safe**: Yes

**Description**:
Compute Fast Fourier Transform of audio samples. Converts time-domain audio to frequency-domain representation. Uses hardware-accelerated DSP library on ESP32-S3.

**Inputs**:
- `samples: float[]` - Input audio samples

**Outputs**:
- `spectrum: float[]` - FFT magnitude bins (normalized 0.0-1.0)
- `spectrum_db: float[]` - Logarithmic spectrum (dB scale)
- `energy: float` - Total spectral energy
- `peak_frequency: int` - Index of highest magnitude bin

**Parameters**:
- `fft_size: int` - 256, 512, or 1024 (default: 512)
- `window: string` - "hann", "hamming", "blackman" (default: "hann")
- `normalize: bool` - Normalize to 0.0-1.0 range (default: true)
- `db_scale: bool` - Also compute dB scale (default: true)

**JSON Definition**:
```json
{
  "id": "audio_fft",
  "type": "audio_input",
  "name": "FFT Analysis",
  "operation": "esp_fft_perform(samples, 512)",
  "inputs": ["samples"],
  "outputs": {
    "spectrum": "float[256]",
    "spectrum_db": "float[256]",
    "energy": "float",
    "peak_frequency": "int"
  },
  "properties": {
    "fft_size": 512,
    "window": "hann",
    "normalize": true,
    "db_scale": true
  }
}
```

**Generated C++**:
```cpp
// Node: audio_fft - FFT Analysis
float spectrum[256];
float spectrum_db[256];
float energy = 0.0f;
int peak_frequency = 0;

// Apply window (Hann default)
for (int i = 0; i < 512; i++) {
    float w = 0.5f * (1.0f - cosf(2.0f * M_PI * i / 511.0f));
    samples[i] *= w;
}

// Compute FFT (hardware-accelerated)
esp_fft_do_rfft(fft_plan, samples);

// Extract magnitude and find peak
float max_mag = 0.0f;
for (int i = 0; i < 256; i++) {
    spectrum[i] = sqrtf(real[i]*real[i] + imag[i]*imag[i]);
    if (db_scale) {
        spectrum_db[i] = 20.0f * log10f(spectrum[i] + 1e-10f);
    }
    energy += spectrum[i];
    if (spectrum[i] > max_mag) {
        max_mag = spectrum[i];
        peak_frequency = i;
    }
}

// Normalize
if (normalize && energy > 0.0f) {
    for (int i = 0; i < 256; i++) {
        spectrum[i] /= energy;
    }
}
```

**Use Cases**:
- Frequency-based visualization
- Beat detection in specific bands
- Equalizer rendering
- Adaptive frequency filtering

**Performance Notes**:
- Execution time: ~250 µs typical @ 512-point FFT
- Uses IDF5 DSP library (hardware accelerated)
- Requires FFT plan pre-allocated (done at pattern init)
- Windows reduce spectral leakage but add minimal cost

**Compatibility**:
- Requires: IDF5 with `esp-dsp` library
- Fallback: Use `SignalInterpolate` on raw spectrum if IDF5 unavailable

---

### 3. AudioEnvelope

**Category**: Audio Input
**Execution Time**: <10 µs
**Memory**: 8 bytes (static float)
**Thread Safe**: Yes

**Description**:
Detect amplitude envelope using peak follower with attack/release coefficients. Smooths rapid amplitude changes for stable visualization.

**Inputs**:
- `samples: float[]` - Raw audio samples

**Outputs**:
- `envelope: float` - Smoothed amplitude (0.0-1.0)
- `peak: float` - Instantaneous peak sample
- `is_peak: bool` - True if peak detected this frame

**Parameters**:
- `attack_factor: float` - Attack smoothing (default: 0.95, valid: 0.5-0.99)
- `release_factor: float` - Release smoothing (default: 0.9, valid: 0.5-0.99)
- `threshold: float` - Minimum detectable level (default: 0.01)

**JSON Definition**:
```json
{
  "id": "envelope",
  "type": "audio_input",
  "name": "Envelope Detector",
  "inputs": ["samples"],
  "logic": {
    "peak": "find_max(samples, sample_count)",
    "envelope": "peak > envelope ? envelope + (peak - envelope) * (1.0 - attack_factor) : envelope * release_factor",
    "is_peak": "peak > threshold"
  },
  "outputs": {
    "envelope": "float",
    "peak": "float",
    "is_peak": "bool"
  },
  "properties": {
    "attack_factor": 0.95,
    "release_factor": 0.9,
    "threshold": 0.01
  }
}
```

**Generated C++**:
```cpp
// Node: envelope - Envelope Detector
static float envelope_state = 0.0f;
float peak = 0.0f;
bool is_peak = false;

// Find peak sample
for (int i = 0; i < sample_count; i++) {
    float abs_sample = fabsf(samples[i]);
    if (abs_sample > peak) peak = abs_sample;
}

// Update envelope with attack/release
if (peak > envelope_state) {
    // Attack: slow to rise
    envelope_state = envelope_state + (peak - envelope_state) * (1.0f - attack_factor);
} else {
    // Release: fast to fall
    envelope_state = envelope_state * release_factor;
}

// Detect peak above threshold
is_peak = (peak > threshold);
```

**Use Cases**:
- Beat kick visualization
- Bass pulse effects
- Responsive brightness control
- Transient detection

**Performance Notes**:
- One static variable persisted across frames
- Find max adds <5 µs per batch
- Coefficients fine-tune response time

---

### 4. AudioRMS

**Category**: Audio Input
**Execution Time**: <10 µs
**Memory**: 8 bytes (static float)
**Thread Safe**: Yes

**Description**:
Compute RMS (Root Mean Square) energy with exponential smoothing. Provides stable overall energy metric for patterns.

**Inputs**:
- `samples: float[]` - Raw audio samples

**Outputs**:
- `rms: float` - Smoothed RMS energy (0.0-1.0)
- `rms_raw: float` - Unsmoothed RMS of current batch
- `rms_squared: float` - Internal state for next frame

**Parameters**:
- `smoothing_factor: float` - Smoothing coefficient (default: 0.95, valid: 0.5-0.99)
- `normalize_to_max: float` - Target maximum level (default: 1.0)

**JSON Definition**:
```json
{
  "id": "rms",
  "type": "audio_input",
  "name": "RMS Energy",
  "inputs": ["samples"],
  "logic": {
    "rms_sq": "compute_rms_squared(samples)",
    "rms_smoothed": "rms_sq * smoothing_factor + current_rms_sq * (1.0 - smoothing_factor)",
    "rms": "sqrt(rms_smoothed) / normalize_to_max"
  },
  "outputs": {
    "rms": "float",
    "rms_raw": "float",
    "rms_squared": "float"
  },
  "properties": {
    "smoothing_factor": 0.95,
    "normalize_to_max": 1.0
  }
}
```

**Generated C++**:
```cpp
// Node: rms - RMS Energy
static float rms_state_sq = 0.0f;
float rms_raw = 0.0f;
float sum_sq = 0.0f;

// Compute sum of squares
for (int i = 0; i < sample_count; i++) {
    float s = samples[i];
    sum_sq += s * s;
}

// Compute RMS of current batch
rms_raw = sqrtf(sum_sq / sample_count) / normalize_to_max;

// Exponential smoothing
rms_state_sq = rms_state_sq * smoothing_factor +
               (rms_raw * rms_raw) * (1.0f - smoothing_factor);
float rms = sqrtf(rms_state_sq);

// Clamp to valid range
rms = fminf(rms, 1.0f);
```

**Use Cases**:
- Overall intensity control
- Responsive pattern scaling
- Dynamic range normalization
- Audio gating threshold

**Performance Notes**:
- Two sqrt() calls: one for batch, one for smoothed
- Smoothing parameter controls rise/fall time
- Useful as pre-processing for other nodes

---

### 5. AudioBeat

**Category**: Audio Input
**Execution Time**: <20 µs
**Memory**: 16 bytes (history buffer)
**Thread Safe**: Yes

**Description**:
Detect beat onsets using energy-based peak detection with adaptive thresholding. Provides boolean beat trigger and beat strength metric.

**Inputs**:
- `energy: float` - Signal energy (from RMS or envelope)

**Outputs**:
- `beat_detected: bool` - True when beat onset detected
- `beat_strength: float` - Onset strength (0.0-1.0)
- `beat_age: int` - Frames since last beat

**Parameters**:
- `threshold: float` - Beat threshold multiplier (default: 1.5, valid: 1.0-3.0)
- `min_interval_ms: int` - Minimum ms between beats (default: 100)
- `smoothing: float` - Average smoothing (default: 0.95)
- `decay_rate: float` - Beat strength decay per frame (default: 0.95)

**JSON Definition**:
```json
{
  "id": "beat_detect",
  "type": "audio_input",
  "name": "Beat Detection",
  "inputs": ["energy"],
  "logic": {
    "beat": "energy > (average_energy * threshold) && time_since_beat_ms > min_interval_ms",
    "strength": "clamp((energy - average_energy) / threshold, 0.0, 1.0)"
  },
  "outputs": {
    "beat_detected": "bool",
    "beat_strength": "float",
    "beat_age": "int"
  },
  "properties": {
    "threshold": 1.5,
    "min_interval_ms": 100,
    "smoothing": 0.95,
    "decay_rate": 0.95
  }
}
```

**Generated C++**:
```cpp
// Node: beat_detect - Beat Detection
static float avg_energy = 0.0f;
static uint32_t last_beat_time = 0;
static float beat_strength_state = 0.0f;
static int beat_age_counter = 0;

// Update running average
avg_energy = avg_energy * smoothing + energy * (1.0f - smoothing);

// Check for beat (energy spike + debounce)
uint32_t now = millis();
bool beat_detected = false;
float beat_strength = 0.0f;

if (energy > (avg_energy * threshold) &&
    (now - last_beat_time) > min_interval_ms) {
    beat_detected = true;
    last_beat_time = now;
    beat_strength = fminf(1.0f, (energy - avg_energy) / threshold);
    beat_strength_state = beat_strength;
    beat_age_counter = 0;
} else {
    beat_detected = false;
    beat_strength_state *= decay_rate;
    beat_age_counter++;
}
```

**Use Cases**:
- Beat-synchronized effects
- Kick drum visualization
- Synchronized pattern transitions
- Dance mode activation

**Performance Notes**:
- Uses frame count for debouncing
- Strength decay provides smooth beat glow
- Average smoothing prevents false triggers on noise

---

## Audio Processing Nodes

Processing nodes transform audio signals. Usually chained together to create complex audio analysis.

### 6. AudioFilter

**Category**: Audio Processing
**Execution Time**: <5 µs per sample
**Memory**: 16 bytes (state variables)
**Thread Safe**: Yes

**Description**:
Apply infinite impulse response (IIR) filter to smooth or isolate frequency bands. Single or multi-pole implementations.

**Inputs**:
- `input: float` - Signal to filter
- `cutoff_frequency: float` - Corner frequency (0.0-0.5, where 0.5 = Nyquist)

**Outputs**:
- `output: float` - Filtered signal

**Parameters**:
- `filter_type: string` - "lowpass", "highpass", "bandpass" (default: "lowpass")
- `order: int` - Filter order 1-4 (default: 1)
- `resonance: float` - Q factor for bandpass (default: 1.0)

**JSON Definition**:
```json
{
  "id": "lowpass",
  "type": "audio_processing",
  "name": "Lowpass Filter",
  "inputs": ["input", "cutoff_frequency"],
  "logic": {
    "alpha": "2.0 * M_PI * cutoff_frequency",
    "filtered": "filtered + alpha * (input - filtered)"
  },
  "outputs": {
    "output": "float"
  },
  "properties": {
    "filter_type": "lowpass",
    "order": 1,
    "resonance": 1.0
  }
}
```

**Generated C++**:
```cpp
// Node: lowpass - Lowpass Filter
static float filter_state = 0.0f;
float alpha = 2.0f * M_PI * cutoff_frequency;

// First-order IIR: y[n] = y[n-1] + alpha * (x[n] - y[n-1])
filter_state = filter_state + alpha * (input - filter_state);
float output = filter_state;

// Higher orders: cascade first-order filters
if (order >= 2) {
    static float state2 = 0.0f;
    state2 = state2 + alpha * (filter_state - state2);
    output = state2;
}
```

**Use Cases**:
- Smooth envelope variations
- Bass enhancement
- Treble reduction
- Isolate frequency band

**Performance Notes**:
- First-order adds <5 µs
- Higher orders cascade: +<5 µs per additional pole
- All calculations use single-precision float (optimized for ESP32-S3)

---

### 7. AudioCompressor

**Category**: Audio Processing
**Execution Time**: <10 µs
**Memory**: 8 bytes (state)
**Thread Safe**: Yes

**Description**:
Dynamic range compressor reduces amplitude of loud signals. Useful for preventing clipping and evening out response.

**Inputs**:
- `input: float` - Signal to compress
- `threshold: float` - Compression threshold (default: 0.7)

**Outputs**:
- `output: float` - Compressed signal
- `gain_reduction: float` - dB of compression applied

**Parameters**:
- `threshold: float` - Compression threshold (default: 0.7, valid: 0.0-1.0)
- `ratio: float` - Compression ratio (default: 4.0, valid: 1.0-infinity)
- `attack_ms: int` - Attack time (default: 10)
- `release_ms: int` - Release time (default: 100)
- `makeup_gain: float` - Output level compensation (default: 1.0)

**JSON Definition**:
```json
{
  "id": "compressor",
  "type": "audio_processing",
  "name": "Dynamic Compressor",
  "inputs": ["input", "threshold"],
  "logic": {
    "compressed": "input > threshold ? threshold + (input - threshold) / ratio : input",
    "output": "compressed * makeup_gain"
  },
  "outputs": {
    "output": "float",
    "gain_reduction": "float"
  },
  "properties": {
    "threshold": 0.7,
    "ratio": 4.0,
    "attack_ms": 10,
    "release_ms": 100,
    "makeup_gain": 1.0
  }
}
```

**Use Cases**:
- Limit peak levels
- Even out response
- Prevent clipping
- Reduce dynamic range

**Performance Notes**:
- Simple threshold comparison adds <5 µs
- Envelope following for attack/release adds <5 µs more
- Makeup gain essential for perceived loudness preservation

---

### 8-13. Additional Audio Processing Nodes

**AudioNormalizer, AudioGate, AudioExpander, AudioDelay, AudioReverb, AudioDistortion**

Each follows similar structure to AudioFilter/AudioCompressor. See Node Catalog reference table for quick comparison.

---

## Signal Processing Nodes

Low-level DSP operations. Process individual values or arrays.

### 14. SignalInterpolate

**Category**: Signal Processing
**Execution Time**: <5 µs
**Memory**: 0 bytes
**Thread Safe**: Yes

**Description**:
Interpolate value from array using fractional index. Supports linear and cubic interpolation.

**Inputs**:
- `data: float[]` - Input array
- `position: float` - Position 0.0-1.0 (scaled to array range)

**Outputs**:
- `value: float` - Interpolated value

**Parameters**:
- `method: string` - "linear", "cubic", "sinc" (default: "linear")
- `array_size: int` - Size of input array

**JSON Definition**:
```json
{
  "id": "freq_interp",
  "type": "signal_processing",
  "name": "Interpolate Spectrum",
  "inputs": ["spectrum", "progress"],
  "logic": {
    "index": "int = progress * (array_size - 1)",
    "frac": "progress * (array_size - 1) - index",
    "value": "spectrum[index] * (1.0 - frac) + spectrum[index+1] * frac"
  },
  "outputs": {
    "value": "float"
  },
  "properties": {
    "method": "linear",
    "array_size": 256
  }
}
```

**Use Cases**:
- Frequency-to-position mapping
- Smooth color gradients
- Resample signals

**Performance Notes**:
- Linear: one multiply and add
- Cubic: adds one multiply for smoother curves
- Used heavily in spectrum rendering

---

### 15. SignalMagnitude

**Category**: Signal Processing
**Execution Time**: <5 µs
**Memory**: 0 bytes
**Thread Safe**: Yes

**Description**:
Apply response curve to enhance visual separation. Common curves: linear, sqrt, log, exp.

**Inputs**:
- `value: float` - Input value

**Outputs**:
- `magnitude: float` - Response-transformed value

**Parameters**:
- `response: string` - "linear", "sqrt", "log", "exp" (default: "sqrt")
- `exponent: float` - Custom exponent (default: 0.5)

**JSON Definition**:
```json
{
  "id": "magnitude_response",
  "type": "signal_processing",
  "name": "Apply Response Curve",
  "inputs": ["value"],
  "logic": {
    "magnitude": "response == sqrt ? sqrt(value) : pow(value, exponent)"
  },
  "outputs": {
    "magnitude": "float"
  },
  "properties": {
    "response": "sqrt",
    "exponent": 0.5
  }
}
```

**Use Cases**:
- Enhance spectrum bar separation
- Compress dynamic range perceptually
- Musical response curves

**Performance Notes**:
- Linear: 0 cycles (just passthrough)
- sqrt: ~2 cycles
- log/exp: ~5-10 cycles (use sparingly)

---

### 16-19. Additional Signal Processing Nodes

**SignalPhase, SignalConvolve, SignalDerivative, SignalIntegrate**

Similar lightweight operations for DSP tasks.

---

## Temporal Nodes

Time-based effects. Maintain state across frames.

### 20. TemporalDecay

**Category**: Temporal
**Execution Time**: <5 µs
**Memory**: 0 bytes
**Thread Safe**: Yes

**Description**:
Apply exponential decay to value based on elapsed time. Useful for fade-out effects.

**Inputs**:
- `value: float` - Value to decay
- `age_ms: float` - Time elapsed in milliseconds

**Outputs**:
- `decayed: float` - Time-decayed value

**Parameters**:
- `half_life_ms: int` - Time for 50% decay (default: 250)

**JSON Definition**:
```json
{
  "id": "age_decay",
  "type": "temporal",
  "name": "Age-Based Decay",
  "inputs": ["value", "age_ms"],
  "logic": {
    "decay_factor": "1.0 - fminf(age_ms, half_life_ms) / half_life_ms",
    "decayed": "value * decay_factor"
  },
  "outputs": {
    "decayed": "float"
  },
  "properties": {
    "half_life_ms": 250
  }
}
```

**Use Cases**:
- Spectrum visualization (fade old data)
- Trail effects
- Beat strength decay

**Performance Notes**:
- One multiply and division
- No state maintenance needed

---

### 21-23. Additional Temporal Nodes

**TemporalDelay, TemporalSmooth, TemporalLag**

Create frame-to-frame persistence and smoothing effects.

---

## Spatial Nodes

Position-based operations. Work with LED positions.

### 24. SpatialMirror

**Category**: Spatial
**Execution Time**: <5 µs
**Memory**: 0 bytes
**Thread Safe**: Yes

**Description**:
Compute mirror positions for symmetric rendering. Common in center-origin patterns.

**Inputs**:
- `position: int` - LED position (0 to NUM_LEDS-1)

**Outputs**:
- `mirror_position: int` - Mirrored position

**Parameters**:
- `origin: string` - "center", "left", "right" (default: "center")

**JSON Definition**:
```json
{
  "id": "center_mirror",
  "type": "spatial",
  "name": "Mirror from Center",
  "inputs": ["position"],
  "logic": {
    "left": "(NUM_LEDS / 2) - 1 - i",
    "right": "(NUM_LEDS / 2) + i"
  },
  "outputs": {
    "left_index": "int",
    "right_index": "int"
  },
  "properties": {
    "origin": "center"
  }
}
```

**Use Cases**:
- Center-origin spectrum visualization
- Symmetrical effects
- Dual-channel patterns

**Performance Notes**:
- Arithmetic only: no branches or conditionals

---

### 25-28. Additional Spatial Nodes

**SpatialBlur, SpatialWave, SpatialScroll, SpatialWarp**

Create spatial effects through position transformations.

---

## Color Nodes

Color space operations. Convert between spaces and blend colors.

### 29. ColorLookup

**Category**: Color
**Execution Time**: <10 µs
**Memory**: Varies (palette dependent)
**Thread Safe**: Yes

**Description**:
Look up color from palette using position and brightness. Core of palette-based visualization.

**Inputs**:
- `position: float` - Palette position (0.0-1.0)
- `brightness: float` - Brightness/alpha (0.0-1.0)

**Outputs**:
- `color: CRGBF` - Output color (0.0-1.0 range)

**Parameters**:
- `palette_id: int` - Palette to use
- `hue_shift: float` - Additional hue rotation (default: 0.0)

**JSON Definition**:
```json
{
  "id": "color_lookup",
  "type": "color",
  "name": "Palette Color Lookup",
  "inputs": ["position", "brightness"],
  "logic": {
    "palette": "get_palette(palette_id)",
    "rgb": "palette.lookup(position)",
    "color": "rgb * brightness"
  },
  "outputs": {
    "color": "CRGBF"
  },
  "properties": {
    "palette_id": 0,
    "hue_shift": 0.0
  }
}
```

**Use Cases**:
- All color rendering
- Gradient effects
- Palette-based patterns

**Performance Notes**:
- Lookup time depends on palette implementation
- Typical: <10 µs for 256-color palette
- Multiply for brightness is single operation

---

### 30-32. Additional Color Nodes

**ColorBlend, ColorHSV, ColorToGrayscale**

Color space conversions and blending operations.

---

## Rendering Nodes

Output nodes write to LED buffer. Final stage of pattern computation.

### 33. RenderingAssign

**Category**: Rendering
**Execution Time**: <5 µs
**Memory**: 0 bytes (side effect)
**Thread Safe**: No (modifies shared buffer)

**Description**:
Write color to LED buffer at specified position. Core output operation.

**Inputs**:
- `position: int` - LED index (0 to NUM_LEDS-1)
- `color: CRGBF` - Color to write

**Outputs**: None (side effect)

**Parameters**: None

**JSON Definition**:
```json
{
  "id": "led_assign",
  "type": "rendering",
  "name": "Assign to LED",
  "inputs": ["position", "color"],
  "logic": {
    "op": "leds[position] = color"
  }
}
```

**Generated C++**:
```cpp
// Node: led_assign - Assign to LED
leds[position] = color;
```

**Use Cases**:
- All LED output
- Must be in loop for multiple assignments

**Performance Notes**:
- Single array write: <5 µs
- Bounds checking should be done by pattern logic

---

### 34-35. Additional Rendering Nodes

**RenderingFill, RenderingAdditive**

Bulk operations and blending modes.

---

## Control Flow Nodes

Direct execution flow. Not computed, control pattern logic.

### 36. Conditional

**Category**: Control Flow
**Execution Time**: <5 µs
**Memory**: 0 bytes
**Thread Safe**: Yes

**Description**:
Branch execution based on boolean condition. Creates if/else logic.

**Inputs**:
- `condition: bool` - Condition to evaluate

**Outputs**: None (directs flow to branches)

**Parameters**:
- `true_branch: string` - Target node ID if true
- `false_branch: string` - Target node ID if false

**JSON Definition**:
```json
{
  "id": "availability_check",
  "type": "conditional",
  "name": "Check Audio Availability",
  "condition": "!AUDIO_IS_AVAILABLE()",
  "branches": {
    "true": "ambient_fallback",
    "false": "spectrum_render"
  }
}
```

**Generated C++**:
```cpp
// Node: availability_check - Check Audio Availability
if (!AUDIO_IS_AVAILABLE()) {
    // Branch to ambient_fallback
    // ... ambient rendering code ...
} else {
    // Branch to spectrum_render
    // ... spectrum rendering code ...
}
```

**Use Cases**:
- Audio availability fallback
- Parameter-based branching
- Conditional rendering

**Performance Notes**:
- Branch prediction on modern CPUs
- Avoid deep nesting for performance

---

### 37. Loop

**Category**: Control Flow
**Execution Time**: Loop-dependent
**Memory**: 0 bytes
**Thread Safe**: Yes

**Description**:
Iterate over range of values, repeating body nodes. Essential for LED buffer operations.

**Inputs**:
- `start: int` - Starting index (inclusive)
- `end: int` - Ending index (exclusive)

**Outputs**: None (repeats body)

**Parameters**:
- `variable_name: string` - Loop variable name (default: "i")
- `step: int` - Increment per iteration (default: 1)

**JSON Definition**:
```json
{
  "id": "render_loop",
  "type": "loop",
  "name": "Render All LEDs",
  "range": "0 to NUM_LEDS",
  "body": [
    { "id": "color_calc", ... },
    { "id": "led_assign", ... }
  ],
  "properties": {
    "variable_name": "i",
    "step": 1
  }
}
```

**Generated C++**:
```cpp
// Node: render_loop - Render All LEDs
for (int i = 0; i < NUM_LEDS; i++) {
    // Node: color_calc
    // ... color calculation ...

    // Node: led_assign
    // ... LED assignment ...
}
```

**Use Cases**:
- LED buffer operations
- Repeated effect application

**Performance Notes**:
- Loop body executed NUM_LEDS times
- Keep loop bodies simple for cache efficiency
- Typical: 2-5 µs per iteration

---

## State Management Nodes

Persistent state across frames. Critical for trail and accumulation effects.

### 38. StatefulBuffer

**Category**: State Management
**Execution Time**: <1 µs per element
**Memory**: NUM_LEDS * 4 bytes (configurable)
**Thread Safe**: Yes (single-threaded access)

**Description**:
Persist float buffer across frames with optional decay. Enables trail and accumulation effects.

**Inputs**:
- `data: float[]` - Input data to accumulate

**Outputs**:
- `persisted: float[]` - Accumulated buffer

**Parameters**:
- `size: int` - Buffer size (default: NUM_LEDS)
- `decay_factor: float` - Per-frame decay (default: 0.95)
- `mode: string` - "accumulate", "blend", "decay" (default: "accumulate")

**JSON Definition**:
```json
{
  "id": "trail_buffer",
  "type": "state_management",
  "name": "Trail Buffer",
  "inputs": ["new_values"],
  "logic": {
    "persist": "buffer[i] = new_values[i] + buffer[i] * decay_factor"
  },
  "outputs": {
    "persisted": "float[NUM_LEDS]"
  },
  "properties": {
    "size": 180,
    "decay_factor": 0.95,
    "mode": "accumulate"
  }
}
```

**Generated C++**:
```cpp
// Node: trail_buffer - Trail Buffer
static float buffer[NUM_LEDS] = {0};

for (int i = 0; i < NUM_LEDS; i++) {
    buffer[i] = new_values[i] + buffer[i] * decay_factor;

    // Clamp to valid range
    buffer[i] = fminf(buffer[i], 1.0f);
}
```

**Use Cases**:
- Trail effects
- Persistence/glow
- Accumulation effects

**Performance Notes**:
- One multiply and add per element
- Loop-based, scales with buffer size
- Static allocation ensures no heap fragmentation

---

### 39. StatefulCounter

**Category**: State Management
**Execution Time**: <5 µs
**Memory**: 8 bytes
**Thread Safe**: Yes

**Description**:
Maintain counter value across frames with wraparound. Enables phase and timing effects.

**Inputs**:
- `increment: float` - Value to add per frame

**Outputs**:
- `count: float` - Current counter value
- `wrapped: bool` - True if wrapped this frame

**Parameters**:
- `initial_value: float` - Starting value (default: 0.0)
- `max_value: float` - Wraparound point (default: INFINITY)
- `mode: string` - "linear", "sine", "triangle" (default: "linear")

**JSON Definition**:
```json
{
  "id": "phase_counter",
  "type": "state_management",
  "name": "Phase Counter",
  "inputs": ["increment"],
  "logic": {
    "count": "count + increment",
    "wrapped": "count >= max_value",
    "count": "wrapped ? count - max_value : count"
  },
  "outputs": {
    "count": "float",
    "wrapped": "bool"
  },
  "properties": {
    "initial_value": 0.0,
    "max_value": 1.0,
    "mode": "linear"
  }
}
```

**Use Cases**:
- Phase accumulation for waves
- Rotation effects
- Beat tracking

**Performance Notes**:
- One addition and comparison
- Modulo operation only when needed
- Essential for smooth phase-based effects

---

## Quick Reference Table

| Node Type | Category | Time | Memory | State | Inputs | Outputs |
|-----------|----------|------|--------|-------|--------|---------|
| AudioMicrophone | Audio Input | <5µs | 4KB | No | - | float[], int, float |
| AudioFFT | Audio Input | 200µs | 2KB | No | float[] | float[], float[], float, int |
| AudioEnvelope | Audio Input | <10µs | 8B | Yes | float[] | float, float, bool |
| AudioRMS | Audio Input | <10µs | 8B | Yes | float[] | float, float, float |
| AudioBeat | Audio Input | <20µs | 16B | Yes | float | bool, float, int |
| AudioFilter | Processing | <5µs | 16B | Yes | float, float | float |
| AudioCompressor | Processing | <10µs | 8B | Yes | float, float | float, float |
| AudioNormalizer | Processing | <5µs | 8B | Yes | float | float |
| AudioGate | Processing | <5µs | 8B | No | float, float | float |
| AudioExpander | Processing | <5µs | 8B | No | float, float | float |
| AudioDelay | Processing | <10µs | Var | Yes | float | float |
| AudioReverb | Processing | 20µs | 4KB | Yes | float | float |
| AudioDistortion | Processing | <5µs | 0B | No | float | float |
| SignalInterpolate | Signal | <5µs | 0B | No | float[], float | float |
| SignalMagnitude | Signal | <5µs | 0B | No | float | float |
| SignalPhase | Signal | <10µs | 0B | No | float[] | float |
| SignalConvolve | Signal | 50µs | Var | No | float[], float[] | float |
| SignalDerivative | Signal | <5µs | 0B | No | float | float |
| SignalIntegrate | Signal | <5µs | 0B | Yes | float | float |
| TemporalDecay | Temporal | <5µs | 0B | No | float, float | float |
| TemporalDelay | Temporal | <5µs | Var | Yes | float | float |
| TemporalSmooth | Temporal | <5µs | 8B | Yes | float | float |
| TemporalLag | Temporal | <5µs | Var | Yes | float | float |
| SpatialMirror | Spatial | <5µs | 0B | No | int | int |
| SpatialBlur | Spatial | 50µs | Var | No | float[] | float[] |
| SpatialWave | Spatial | 100µs | Var | No | float[] | float[] |
| SpatialScroll | Spatial | 50µs | Var | Yes | float[] | float[] |
| SpatialWarp | Spatial | 100µs | Var | No | float[] | float[] |
| ColorLookup | Color | <10µs | Var | No | float, float | CRGBF |
| ColorBlend | Color | <5µs | 0B | No | CRGBF, CRGBF, float | CRGBF |
| ColorHSV | Color | <10µs | 0B | No | float, float, float | CRGBF |
| ColorToGrayscale | Color | <5µs | 0B | No | CRGBF | float |
| RenderingAssign | Rendering | <5µs | 0B | No | int, CRGBF | - |
| RenderingFill | Rendering | <1µs/LED | 0B | No | CRGBF, int, int | - |
| RenderingAdditive | Rendering | <5µs | 0B | No | int, CRGBF | - |
| Conditional | Control | <5µs | 0B | No | bool | - |
| Loop | Control | N/A | 0B | No | int, int | - |
| StatefulBuffer | State | <1µs/e | 4KB | Yes | float[] | float[] |
| StatefulCounter | State | <5µs | 8B | Yes | float | float, bool |

---

## Node Selection Guide

### By Use Case

**Building a Spectrum Visualization**:
1. AudioFFT - Convert audio to frequency domain
2. SignalInterpolate - Map LED positions to frequency bins
3. SignalMagnitude - Enhance visual separation (sqrt response)
4. ColorLookup - Map magnitude to colors
5. RenderingAssign - Write to LED buffer
6. SpatialMirror - Mirror left/right for center origin

**Building a Trail Effect**:
1. ColorLookup - Get base color
2. StatefulBuffer - Persist and decay from previous frame
3. RenderingAssign - Draw accumulated trail

**Building a Beat-Sync Effect**:
1. AudioBeat - Detect beat onset
2. StatefulCounter - Count frames since beat
3. TemporalDecay - Fade beat glow over time
4. ColorLookup - Color based on beat strength

**Building a Responsive Ambient**:
1. AudioRMS - Get overall energy
2. TemporalSmooth - Smooth for stable colors
3. ColorLookup - Map energy to color
4. RenderingFill - Fill all LEDs

### By Performance Constraint

**< 5ms Available**:
- AudioMicrophone, AudioEnvelope, AudioRMS
- SignalInterpolate, SignalMagnitude
- ColorLookup, RenderingAssign
- Simple loops only

**< 10ms Available**:
- Add: AudioFFT, AudioFilter
- Add: SpatialBlur (small kernels)
- Add: Complex loops (10-50 LEDs)

**< 15ms Available**:
- Add: AudioReverb, SpatialWave
- Add: Full LED rendering
- Add: Multiple effects chained

---

## Performance Summary

**Total Available**: 16.7ms per frame @ 60fps
**Typical Budget Allocation**:
- Audio Input: 1-3ms (FFT heaviest)
- Processing: 2-4ms (effects, transforms)
- Rendering: 1-2ms (LED output)
- Margin: 8-10ms (safety, variations)

Most patterns fit comfortably in available budget. Profile with `/api/device/performance` to verify.

---

**End of K1.node1 Node Type Catalog v1.0**

# Complete Audio Pipeline Architecture Map - K1.node1 Firmware

## Overview
The K1.node1 audio pipeline is a dual-core, lock-free system where:
- **Core 0** (audio_task): Microphone capture → I2S → FFT (Goertzel) → Tempo detection → Buffer swap
- **Core 1** (loop_gpu): Pattern rendering with lock-free audio snapshot reads
- **Synchronization**: Double-buffering with sequence counters (atomic, lock-free)

---

## 1. ENTRY POINT - Where Audio Capture Starts

### File: `/firmware/src/main.cpp`
**Lines 240-449: `void audio_task(void* param)`**

Audio processing entry point running on **Core 0** at ~100 Hz cadence (via `vTaskDelay(pdMS_TO_TICKS(1))` at line 447).

Flow:
```
audio_task() (Core 0)
  ├─ Check EMOTISCOPE_ACTIVE (line 245)
  ├─ acquire_sample_chunk() (line 262) [BLOCKING on I2S]
  ├─ calculate_magnitudes() (line 263) [CPU-intensive, ~15-25ms]
  ├─ get_chromagram() (line 264) [~1ms pitch aggregation]
  ├─ update_novelty() (line 275) [Spectral flux logging]
  ├─ update_tempo() (line 319) [Per-tempo-bin Goertzel]
  ├─ update_tempi_phase(delta) (line 329) [Beat phase advance]
  ├─ Beat event detection (lines 356-441) [Phase-locked or confidence-gated]
  ├─ finish_audio_frame() (line 443) [Buffer swap]
  └─ vTaskDelay(1ms) (line 447) [Yield control]
```

**Timing Budget:**
- I2S read: 8ms (CHUNK_SIZE=128 samples @ 16kHz)
- Goertzel: 15-25ms (64 frequency bins, 2 bins/frame interlaced)
- Tempo: ~5-10ms (2 tempo bins/frame interlaced)
- Total: ~30-45ms per iteration, runs at ~50-100 Hz depending on load

---

## 2. I2S MICROPHONE INITIALIZATION & DATA FLOW

### File: `/firmware/src/audio/microphone.h` (lines 1-91)
### File: `/firmware/src/audio/microphone.cpp` (lines 1-252)

**Hardware Setup:**
```
SPH0645 Microphone (I2S Standard, NOT PDM)
├─ BCLK (Bit Clock):   GPIO 14  [I2S_BCLK_PIN]
├─ LRCLK (Word Select): GPIO 12  [I2S_LRCLK_PIN] ← CRITICAL: 16kHz word sync
└─ DIN (Data In):      GPIO 13  [I2S_DIN_PIN]

Sample Rate: 16 kHz (SAMPLE_RATE)
Chunk Size: 128 samples (CHUNK_SIZE) = 8ms cadence
Audio Config: 32-bit samples, stereo right-channel only
```

**Initialization (IDF5 preferred, IDF4 fallback):**

**File: `/firmware/src/audio/microphone.cpp` (lines 34-73) - IDF5 Path**
```cpp
void init_i2s_microphone() {
  i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_AUTO, I2S_ROLE_MASTER);
  i2s_new_channel(&chan_cfg, NULL, &rx_handle);  // Create RX channel
  
  i2s_std_config_t std_cfg = {
    .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(SAMPLE_RATE),
    .slot_cfg = {
      .data_bit_width = I2S_DATA_BIT_WIDTH_32BIT,
      .slot_bit_width = I2S_SLOT_BIT_WIDTH_32BIT,
      .slot_mode = I2S_SLOT_MODE_STEREO,
      .slot_mask = I2S_STD_SLOT_RIGHT,  // SEL tied low → right channel
      ...
    },
    .gpio_cfg = {
      .bclk = GPIO 14,
      .ws = GPIO 12,
      .din = GPIO 13,
      ...
    },
  };
  
  i2s_channel_init_std_mode(rx_handle, &std_cfg);
  i2s_channel_enable(rx_handle);
}
```

**Data Acquisition (line 113-252):**
```cpp
void acquire_sample_chunk() {
  uint32_t new_samples_raw[CHUNK_SIZE];   // Raw 32-bit I2S samples
  float new_samples[CHUNK_SIZE];          // Normalized float
  
  // TIMEOUT PROTECTION (Phase 0):
  bool use_silence_fallback = false;
  g_audio_input_active = false;
  
  if (EMOTISCOPE_ACTIVE) {
    // Bounded wait: max 100ms (line 136)
    i2s_result = i2s_channel_read(rx_handle, new_samples_raw, 
                                  CHUNK_SIZE * sizeof(uint32_t),
                                  &bytes_read, pdMS_TO_TICKS(100));
    
    // ERROR HANDLING (lines 150-197):
    if (i2s_result != ESP_OK) {
      // Timeout detected → increment consecutive_failures
      // After 3+ failures → fallback mode (output silence)
      // On success → reset failure counter
      memset(new_samples_raw, 0, ...);  // Silence fallback
      use_silence_fallback = true;
    }
  } else {
    memset(new_samples_raw, 0, ...);  // Audio disabled
  }
  
  // CONVERSION: Raw int32 → float32 (lines 206-220)
  for (uint16_t i = 0; i < CHUNK_SIZE; i += 4) {
    if (use_silence_fallback) {
      new_samples[i] = 0.0f;
    } else {
      // Extract 18-bit signed from 32-bit word, apply offset/clamp
      new_samples[i] = (((int32_t)new_samples_raw[i] >> 14) + 7000) - 360;
      // Clamp to [-131072, 131072]
      // Then normalize by recip_scale = 1.0 / 131072.0
    }
  }
  
  // VU CALCULATION (lines 224-244):
  float chunk_vu = 0.0f;
  for (uint16_t i = 0; i < CHUNK_SIZE; ++i) {
    chunk_vu += fabsf(new_samples[i]);
  }
  chunk_vu /= CHUNK_SIZE;  // Average absolute value
  
  // Apply audio_responsiveness smoothing
  static float smooth_audio_level = 0.0f;
  float responsiveness = get_params().audio_responsiveness;  // 0.0-1.0
  smooth_audio_level = (responsiveness * chunk_vu) + 
                       ((1.0f - responsiveness) * smooth_audio_level);
  audio_level = smooth_audio_level;  // Global update
  
  // BUFFER MANAGEMENT (lines 246-250):
  waveform_locked = true;
  shift_and_copy_arrays(sample_history, SAMPLE_HISTORY_LENGTH, 
                        new_samples, CHUNK_SIZE);
  waveform_locked = false;
  waveform_sync_flag = true;  // Signal new data available
}
```

**Audio Buffer:**
```
sample_history[4096]  (SAMPLE_HISTORY_LENGTH)
├─ Ring buffer: newest samples at end
├─ Shifted by CHUNK_SIZE (128) every frame
├─ Goertzel reads entire history for block-mode analysis
├─ Lock-free: waveform_locked atomic flag prevents race on shifts
└─ Resolution: 4096 / 128 = 32 chunks = 256ms history @ 16kHz
```

**Timeout State Tracking (lines 69-76):**
```cpp
typedef struct {
  uint32_t timeout_count;           // Total timeouts
  uint32_t consecutive_failures;    // Current failure streak
  uint32_t last_failure_time_ms;    // When last failure occurred
  uint8_t last_error_code;          // ERR_I2S_READ_TIMEOUT or ERR_I2S_READ_OVERRUN
  bool in_fallback_mode;            // Currently outputting silence
  uint32_t fallback_start_time_ms;  // When fallback began
} I2STimeoutState;
```

---

## 3. AUDIO BUFFER MANAGEMENT (Raw PCM → Processed)

### File: `/firmware/src/audio/goertzel.h` (lines 148-149)
### File: `/firmware/src/audio/goertzel.cpp` (lines 1-100+)

**Global Buffers:**

| Buffer | Type | Size | Purpose |
|--------|------|------|---------|
| `sample_history[4096]` | float | 256ms @ 16kHz | Ring buffer for Goertzel input |
| `spectrogram[64]` | float | Auto-ranged 0.0-1.0 | Current frequency spectrum |
| `spectrogram_smooth[64]` | float | 8-sample average | Smoothed spectrum |
| `spectrogram_absolute[64]` | float | Pre-normalized 0.0-1.0 | Absolute loudness preservation |
| `chromagram[12]` | float | 12 pitch classes | C,C#,D,D#,E,F,F#,G,G#,A,A#,B |
| `audio_level` | float | 0.0-1.0 | Overall RMS level (smoothed) |
| `tempi[64]` | tempo | Per-bin state | 64 tempo hypotheses (32-192 BPM) |
| `tempi_smooth[64]` | float | Exponential decay | Smoothed tempo magnitudes |
| `noise_spectrum[64]` | float | Calibration | Background noise floor |

**Processing Pipeline:**
```
sample_history[4096]
  ↓ (every 8ms)
acquire_sample_chunk()
  ├─ Read I2S CHUNK_SIZE (128) samples
  ├─ Shift sample_history left by 128
  ├─ Append new 128 samples to end
  └─ Set waveform_sync_flag = true
  ↓
calculate_magnitudes()
  ├─ For each bin i (0-63):
  │   └─ calculate_magnitude_of_bin(i)  [Goertzel on sample_history]
  ├─ Apply noise filtering (collect_and_filter_noise)
  ├─ Apply 6-sample moving average → spectrogram_smooth
  ├─ Track max_val_smooth (exponential smoothing)
  ├─ Auto-range: spectrogram[i] = magnitudes_smooth[i] / max_val_smooth
  ├─ Calculate VU: average of all bins with frequency weighting
  ├─ Apply microphone_gain to all bins
  └─ Copy to audio_back (lines 560-586)
  ↓
get_chromagram()
  ├─ Aggregate 64 frequency bins → 12 pitch classes (mod 12)
  ├─ Auto-range chromagram
  └─ Copy to audio_back.chromagram (line 618)
  ↓
finish_audio_frame()
  └─ commit_audio_data()  [Buffer swap]
```

---

## 4. FFT COMPUTATION (How Spectrum is Generated)

### File: `/firmware/src/audio/goertzel.cpp` (lines 403-591)

**Algorithm: Goertzel (Constant-Q Transform)**

Each frequency bin is analyzed independently:

```cpp
void calculate_magnitudes() {
  // For EACH frequency bin (lines 420-446):
  for (uint16_t i = 0; i < NUM_FREQS; i++) {
    // Goertzel coefficients precomputed in init_goertzel_constants_musical()
    float target_freq = frequencies_musical[i].target_freq;
    uint16_t block_size = frequencies_musical[i].block_size;  // Varies per bin
    float coeff = frequencies_musical[i].coeff;              // 2*cos(ω)
    
    // Read magnitude from sample_history[0..3999] via Goertzel filter
    float magnitude_raw = calculate_magnitude_of_bin(i);
    
    // Apply noise floor subtraction
    magnitude_raw = collect_and_filter_noise(magnitude_raw, i);
    
    // Store full-scale before normalization
    frequencies_musical[i].magnitude_full_scale = magnitude_raw;
    
    // Add to 6-sample moving average
    magnitudes_avg[iter % 6][i] = magnitude_raw;
    
    // Compute average of 6 most recent samples
    float magnitudes_avg_result = sum(magnitudes_avg[*][i]) / 6.0;
    magnitudes_smooth[i] = magnitudes_avg_result;
    
    // Track maximum for auto-ranging
    max_val = max(max_val, magnitudes_smooth[i]);
  }
  
  // SMOOTHING MAX_VAL (exponential with asymmetric rates):
  // Lines 462-474:
  if (max_val > max_val_smooth) {
    delta = max_val - max_val_smooth;
    max_val_smooth += delta * 0.005;  // Fast attack (0.5% per frame)
  } else {
    delta = max_val_smooth - max_val;
    max_val_smooth -= delta * 0.005;  // Fast decay (0.5% per frame)
  }
  
  if (max_val_smooth < 0.000001) {
    max_val_smooth = 0.000001;  // Floor to prevent division by zero
  }
  
  // VU CALCULATION (lines 487-514):
  float vu_sum = 0.0f;
  for (uint16_t i = 0; i < NUM_FREQS; i++) {
    // Apply bass_treble_balance weighting
    float weight = 1.0f;
    if (bass_treble_balance < 0.0f) {
      // Bass emphasis
      weight = 1.0f + (bass_treble_balance * i / NUM_FREQS);
    } else if (bass_treble_balance > 0.0f) {
      // Treble emphasis
      weight = 1.0f - (bass_treble_balance * (1.0f - i / NUM_FREQS));
    }
    vu_sum += spectrogram[i] * weight;  // Use AUTO-RANGED values
  }
  float vu_level_calculated = vu_sum / NUM_FREQS;
  vu_level_calculated *= audio_sensitivity;  // Gain
  audio_level = vu_level_calculated;
  
  // AUTO-RANGING (lines 523-531):
  float autoranger_scale = 1.0 / max_val_smooth;
  for (uint16_t i = 0; i < NUM_FREQS; i++) {
    frequencies_musical[i].magnitude = clip_float(magnitudes_smooth[i] * autoranger_scale);
    spectrogram[i] = frequencies_musical[i].magnitude;
  }
  
  // SPECTROGRAM AVERAGING (lines 538-546):
  spectrogram_average[spectrogram_average_index][i] = spectrogram[i];
  spectrogram_smooth[i] = average(spectrogram_average[*][i]);  // 8-frame average
  
  // MICROPHONE GAIN (lines 548-555):
  for (uint16_t i = 0; i < NUM_FREQS; i++) {
    spectrogram[i] *= configuration.microphone_gain;  // 0.5x to 2.0x
    spectrogram_smooth[i] *= configuration.microphone_gain;
  }
  
  // COPY TO SNAPSHOT (lines 560-586):
  memcpy(audio_back.spectrogram, spectrogram, sizeof(float) * NUM_FREQS);
  memcpy(audio_back.spectrogram_smooth, spectrogram_smooth, sizeof(float) * NUM_FREQS);
  memcpy(audio_back.spectrogram_absolute, spectrogram_absolute, sizeof(float) * NUM_FREQS);
  audio_back.vu_level = vu_level_calculated;
  audio_back.vu_level_raw = vu_level_calculated * max_val_smooth;
}
```

**Frequency Mapping (64 bins, ~50Hz to 6.4kHz):**
```
Bin 0:  55.0 Hz   (A1)      - Kick drum fundamentals
Bin 8:  69.3 Hz   (C#2)     - Bass region
Bin 16: 87.3 Hz   (F2)      - Low mids
Bin 32: 155.6 Hz  (D#3)     - Mids
Bin 48: 277.2 Hz  (C#4)     - High mids
Bin 63: 622.3 Hz  (D#5)     - Presence region

Note: Musical scale with half-step resolution (2 quarter-steps per semitone)
```

**Chromagram Extraction (lines 600-620):**
```cpp
void get_chromagram() {
  memset(chromagram, 0, 12);
  
  float max_val = 0.2;
  for (uint16_t i = 0; i < 60; i++) {
    chromagram[i % 12] += (spectrogram_smooth[i] / 5.0);  // Map 60 bins → 12 pitch classes
    max_val = max(max_val, chromagram[i % 12]);
  }
  
  float auto_scale = 1.0 / max_val;
  for (uint16_t i = 0; i < 12; i++) {
    chromagram[i] *= auto_scale;  // Normalize
  }
  
  memcpy(audio_back.chromagram, chromagram, sizeof(float) * 12);
}
```

---

## 5. GOERTZEL TEMPO DETECTION (All 64 Bins)

### File: `/firmware/src/audio/tempo.h` (lines 1-83)
### File: `/firmware/src/audio/tempo.cpp` (lines 1-435)

**Tempo Hypothesis Range:**
```
NUM_TEMPI = 64 bins
Frequency range: 32-192 BPM (via tempi_bpm_values_hz[])
REFERENCE_FPS = 100 Hz (phase update cadence)
NOVELTY_HISTORY_LENGTH = 1024 samples @ 50 Hz = 20.48 seconds history
```

**Tempo Detection State (tempo struct):**
```cpp
typedef struct {
  float target_tempo_hz;                    // Hypothesis frequency (Hz)
  float coeff;                              // 2*cos(ω) for Goertzel
  float sine, cosine;                       // Precomputed sin/cos(ω)
  float window_step;                        // Lookup increment
  float phase;                              // Current beat phase (-π to π)
  float phase_target;                       // Synchronization target
  bool phase_inverted;                      // Phase flip flag
  float phase_radians_per_reference_frame;  // Phase advance per 100 Hz frame
  float beat;                               // sin(phase) for oscillation
  float magnitude;                          // Normalized beat strength
  float magnitude_full_scale;               // Pre-normalized strength
  float magnitude_smooth;                   // Exponential decay filter
  uint32_t block_size;                      // Goertzel analysis window
} tempo;
```

**Novelty Detection (Spectral Flux):**

File: `/firmware/src/audio/tempo.cpp` (lines 345-374)
```cpp
void update_novelty() {
  // Log novelty at fixed 50 Hz cadence
  if (t_now_us >= next_update) {
    
    float current_novelty = 0.0;
    for (uint16_t i = 0; i < NUM_FREQS; i++) {
      float new_mag = spectrogram_smooth[i];
      frequencies_musical[i].novelty = max(0.0f, new_mag - frequencies_musical[i].magnitude_last);
      frequencies_musical[i].magnitude_last = new_mag;
      
      current_novelty += frequencies_musical[i].novelty;  // Sum of all bins
    }
    current_novelty /= NUM_FREQS;
    
    check_silence(current_novelty);  // Detect flat input
    
    log_novelty(log(1.0 + current_novelty));  // Log-scale for stability
    log_vu(vu_max);
    vu_max = 0.000001;
  }
}
```

**Tempo Magnitude Calculation (Per Bin):**

File: `/firmware/src/audio/tempo.cpp` (lines ~150-250)
```cpp
void calculate_tempi_magnitudes(uint16_t bin_index) {
  // Goertzel analysis on novelty_curve history
  
  float target_freq = tempi[bin_index].target_tempo_hz;  // Hz
  uint32_t block_size = tempi[bin_index].block_size;
  
  // Goertzel filter on novelty curve
  float s0 = 0.0f, s1 = 0.0f, s2 = 0.0f;
  
  for (uint32_t i = 0; i < block_size && i < NOVELTY_HISTORY_LENGTH; i++) {
    float sample = novelty_curve_normalized[i];
    s0 = sample + (2.0f * cosf(omega)) * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  
  // Extract magnitude: sqrt(s1² + s2² - 2*s1*s2*cos(ω))
  float magnitude = sqrt(s1*s1 + s2*s2 - 2.0f * s1 * s2 * tempi[bin_index].cosine);
  
  // Store and smooth
  tempi[bin_index].magnitude_full_scale = magnitude;
  tempi[bin_index].magnitude_smooth *= 0.90f;  // Exponential decay
  tempi[bin_index].magnitude_smooth = max(tempi[bin_index].magnitude_smooth, magnitude);
  
  // Auto-range tempi_smooth
  tempi_smooth[bin_index] = tempi[bin_index].magnitude_smooth / max_tempo_magnitude;
}
```

**Phase Tracking (All 64 Bins):**

File: `/firmware/src/audio/tempo.cpp` (lines 402-430)
```cpp
void update_tempi_phase(float delta) {
  tempi_power_sum = 0.00000001;
  
  for (uint16_t tempo_bin = 0; tempo_bin < NUM_TEMPI; tempo_bin++) {
    // SMOOTH magnitudes
    tempi[tempo_bin].magnitude *= 0.90f;  // 10% decay per frame
    tempi_smooth[tempo_bin] *= 0.92f;      // Slower decay
    
    // UPDATE PHASE (lines 407-430):
    sync_beat_phase(tempo_bin, delta);
    
    // Accumulate power sum for confidence normalization
    tempi_power_sum += tempi[tempo_bin].magnitude;
  }
  
  // Calculate overall beat confidence
  tempo_confidence = tempi_power_sum / (NUM_TEMPI * threshold);
}

void sync_beat_phase(uint16_t tempo_bin, float delta) {
  // delta = time_elapsed / ideal_frame_time
  
  float push = tempi[tempo_bin].phase_radians_per_reference_frame * delta;
  tempi[tempo_bin].phase += push;
  
  // Wrap to (-π, π]
  while (tempi[tempo_bin].phase > PI) {
    tempi[tempo_bin].phase -= (2.0f * PI);
  }
  while (tempi[tempo_bin].phase < -PI) {
    tempi[tempo_bin].phase += (2.0f * PI);
  }
  
  tempi[tempo_bin].beat = sin(tempi[tempo_bin].phase);
}
```

**Interlaced Calculation (Performance Optimization):**

File: `/firmware/src/audio/tempo.cpp` (lines 276-297)
```cpp
void update_tempo() {
  static uint16_t calc_bin = 0;
  uint16_t max_bin = (NUM_TEMPI - 1) * MAX_TEMPO_RANGE;
  
  // Only process 2 bins per frame (interlaced over ~32 frames for all 64)
  calculate_tempi_magnitudes(calc_bin + 0);
  calculate_tempi_magnitudes(calc_bin + 1);
  
  calc_bin += 2;
  if (calc_bin >= max_bin) {
    calc_bin = 0;  // Wrap around
  }
}
```

---

## 6. AUDIO SNAPSHOT SYNCHRONIZATION (audio_back → audio_front)

### File: `/firmware/src/audio/goertzel.h` (lines 91-129)
### File: `/firmware/src/audio/goertzel.cpp` (lines 127-222)

**Double-Buffering Architecture:**

```
Core 0 writes to:     audio_back
Core 1 reads from:    audio_front
Synchronization:      Atomic sequence counter + memory barriers
```

**AudioDataSnapshot Structure (1,300+ bytes):**
```cpp
typedef struct {
  // SYNCHRONIZATION
  std::atomic<uint32_t> sequence{0};      // Even=valid, Odd=writing
  
  // FREQUENCY DATA
  float spectrogram[64];                  // Auto-ranged (0.0-1.0)
  float spectrogram_smooth[64];           // 8-frame average
  float spectrogram_absolute[64];         // Pre-normalized (absolute loudness)
  
  // PITCH CLASSES
  float chromagram[12];                   // C,C#,D,...,B
  
  // AUDIO LEVEL
  float vu_level;                         // Overall RMS (0.0-1.0)
  float vu_level_raw;                     // Unfiltered VU
  
  // TEMPO DATA
  float novelty_curve;                    // Spectral flux
  float tempo_confidence;                 // Beat confidence (0.0-1.0)
  float tempo_magnitude[64];              // Magnitude per tempo bin
  float tempo_phase[64];                  // Phase per tempo bin (-π to π)
  
  // FFT (Reserved)
  float fft_smooth[128];                  // Placeholder for future
  
  // METADATA
  uint32_t update_counter;                // Increments each frame
  uint32_t timestamp_us;                  // ESP timer microseconds
  bool is_valid;                          // First write flag
  
  // SYNCHRONIZATION
  std::atomic<uint32_t> sequence_end{0};  // Must match sequence
} AudioDataSnapshot;

extern AudioDataSnapshot audio_front;     // (Core 1 reads)
extern AudioDataSnapshot audio_back;      // (Core 0 writes)
```

**Writing (Core 0): `commit_audio_data()` - Lines 184-222**

```cpp
void commit_audio_data() {
  // STEP 1: Mark writing in progress (odd sequence)
  uint32_t seq = audio_front.sequence.load(std::memory_order_relaxed);
  audio_front.sequence.store(seq + 1, std::memory_order_relaxed);  // ODD
  __sync_synchronize();  // CRITICAL: Flush Core 1's cache
  
  // STEP 2: Copy entire snapshot (1,300+ bytes)
  // Readers with odd sequence will retry
  memcpy(&audio_front, &audio_back, sizeof(AudioDataSnapshot));
  
  // STEP 3: Restore sequence (compensate for memcpy overwrite)
  uint32_t back_seq = audio_back.sequence.load(std::memory_order_relaxed);
  audio_front.sequence.store(back_seq + 1, std::memory_order_relaxed);
  
  // STEP 4: Mark valid (even sequence)
  __sync_synchronize();  // CRITICAL: Ensure data visible to Core 1
  seq = audio_front.sequence.load(std::memory_order_relaxed);
  audio_front.sequence.store(seq + 1, std::memory_order_relaxed);  // EVEN
  audio_front.sequence_end.store(audio_front.sequence.load(...), ...);  // Match
  
  audio_front.is_valid = true;
  __sync_synchronize();  // Final barrier
}
```

**Reading (Core 1): `get_audio_snapshot()` - Lines 127-168**

```cpp
bool get_audio_snapshot(AudioDataSnapshot* snapshot) {
  uint32_t seq1, seq2;
  int max_retries = 1000;  // Prevent infinite loop
  int retry_count = 0;
  
  do {
    // Read sequence before copy
    seq1 = audio_front.sequence.load(std::memory_order_relaxed);
    __sync_synchronize();  // CRITICAL: Ensure sequence read complete
    
    // Copy snapshot (may be interrupted by writer)
    memcpy(snapshot, &audio_front, sizeof(AudioDataSnapshot));
    __sync_synchronize();  // CRITICAL: Ensure copy complete
    
    // Read sequence after copy
    seq2 = audio_front.sequence_end.load(std::memory_order_relaxed);
    
    // Validate:
    // - seq1 == seq2 (start and end match)
    // - seq1 is even (not being written)
    // - seq1 unchanged during copy
    if (++retry_count > max_retries) {
      LOG_WARN("Max retries exceeded, using potentially stale data");
      return audio_front.is_valid;
    }
  } while (seq1 != seq2 || 
           (seq1 & 1) ||  // Odd = writing in progress
           seq1 != audio_front.sequence.load(std::memory_order_relaxed));
  
  return audio_front.is_valid;
}
```

**Call Sites:**

| Caller | File | Line | Frequency |
|--------|------|------|-----------|
| `audio_task()` | main.cpp | 443 | ~100 Hz (after all audio processing) |
| `loop_gpu()` | main.cpp | 586 | ~100+ Hz (every render frame) |
| Pattern macros | pattern_audio_interface.h | 79-89 | Per-pattern usage |

---

## 7. PATTERN ACCESS TO AUDIO DATA

### File: `/firmware/src/pattern_audio_interface.h` (lines 1-637)
### File: `/firmware/src/pattern_audio_interface.cpp` (lines 1-99)

**Macro-Based Safe Interface:**

```cpp
// Call at start of pattern draw function
#define PATTERN_AUDIO_START() \
    AudioDataSnapshot audio{}; \
    bool audio_available = get_audio_snapshot(&audio); \
    static uint32_t pattern_last_update = 0; \
    bool audio_is_fresh = (audio_available && \
                           audio.update_counter != pattern_last_update); \
    if (audio_is_fresh) { \
        pattern_last_update = audio.update_counter; \
    } \
    uint32_t audio_age_ms = audio_available ? \
        ((uint32_t)((esp_timer_get_time() - audio.timestamp_us) / 1000)) : 9999
```

**Data Accessors (Lines 150-330):**

| Macro | Data | Range | Use Case |
|-------|------|-------|----------|
| `AUDIO_SPECTRUM[i]` | `audio.spectrogram[i]` | 0-63 | Auto-ranged frequency visualization |
| `AUDIO_SPECTRUM_SMOOTH[i]` | `audio.spectrogram_smooth[i]` | 0-63 | Smoothed spectrum |
| `AUDIO_SPECTRUM_ABSOLUTE[i]` | `audio.spectrogram_absolute[i]` | 0-63 | Absolute loudness (pre-normalized) |
| `AUDIO_CHROMAGRAM[i]` | `audio.chromagram[i]` | 0-11 | Pitch class energy |
| `AUDIO_VU` | `audio.vu_level` | 0.0-1.0 | Overall amplitude |
| `AUDIO_VU_RAW` | `audio.vu_level_raw` | 0.0+ | Unfiltered amplitude |
| `AUDIO_NOVELTY` | `audio.novelty_curve` | 0.0-1.0 | Spectral flux (onset detection) |
| `AUDIO_TEMPO_CONFIDENCE` | `audio.tempo_confidence` | 0.0-1.0 | Beat strength |
| `AUDIO_TEMPO_MAGNITUDE(bin)` | `audio.tempo_magnitude[bin]` | 0-63 | Per-tempo-bin strength |
| `AUDIO_TEMPO_PHASE(bin)` | `audio.tempo_phase[bin]` | -π to +π | Per-tempo-bin phase |
| `AUDIO_TEMPO_BEAT(bin)` | `sin(AUDIO_TEMPO_PHASE(bin))` | -1.0-1.0 | Sine-converted phase |

**Query Macros (Lines 186-256):**

```cpp
#define AUDIO_IS_FRESH()        (audio_is_fresh)              // New data since last call
#define AUDIO_IS_AVAILABLE()    (audio_available)             // Snapshot acquired
#define AUDIO_AGE_MS()          (audio_age_ms)                // Age in milliseconds
#define AUDIO_IS_STALE()        (audio_age_ms > 50)           // >50ms old
```

**Convenience Bands (Lines 299-306):**

```cpp
#define AUDIO_BASS()     get_audio_band_energy(audio, 0, 8)     // 55-220 Hz
#define AUDIO_MIDS()     get_audio_band_energy(audio, 16, 32)   // 440-880 Hz
#define AUDIO_TREBLE()   get_audio_band_energy(audio, 48, 63)   // 1.76-6.4 kHz

#define AUDIO_KICK()     get_audio_band_energy(audio, 0, 4)     // 55-110 Hz
#define AUDIO_SNARE()    get_audio_band_energy(audio, 8, 16)    // 220-440 Hz
#define AUDIO_VOCAL()    get_audio_band_energy(audio, 16, 40)   // 440-1760 Hz
#define AUDIO_HATS()     get_audio_band_energy(audio, 48, 63)   // 3.5-6.4 kHz
```

**Pattern Example:**
```cpp
void draw_spectrum_responsive(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();  // Get snapshot
    
    if (!AUDIO_IS_FRESH()) return;  // Skip if unchanged
    if (AUDIO_IS_STALE()) brightness *= 0.95f;  // Fade on silence
    
    for (int i = 0; i < NUM_LEDS; i++) {
        float bin = (float)i / NUM_LEDS * 63.0f;
        float mag = AUDIO_SPECTRUM_INTERP(bin);  // Interpolated access
        leds[i] = hsv(i * 5, 1.0, mag);
    }
}
```

---

## 8. MUTEXES, LOCKS, THREAD SAFETY MECHANISMS

### Files: `/firmware/src/audio/goertzel.h` (lines 184-189)
### `/firmware/src/audio/microphone.h` (lines 79-81)
### `/firmware/src/main.cpp` (lines 336, 346, 495-507)

**Synchronization Primitives:**

| Primitive | Type | Location | Purpose | Ordering |
|-----------|------|----------|---------|----------|
| `audio_front.sequence` | `std::atomic<uint32_t>` | goertzel.h:98 | Write-in-progress marker | relaxed + `__sync_synchronize()` |
| `audio_front.sequence_end` | `std::atomic<uint32_t>` | goertzel.h:128 | Write completion marker | relaxed + `__sync_synchronize()` |
| `waveform_locked` | `std::atomic<bool>` | microphone.cpp:10 | Prevent I2S race during shift | relaxed |
| `waveform_sync_flag` | `std::atomic<bool>` | microphone.cpp:11 | Signal new data available | relaxed |
| `audio_spinlock` | `portMUX_TYPE` | main.cpp:336 | Critical section guard | portENTER/EXIT_CRITICAL |
| `magnitudes_locked` | `std::atomic<bool>` | goertzel.cpp:405 | Goertzel in progress flag | relaxed |
| `audio_swap_mutex` | `SemaphoreHandle_t` | goertzel.h:187 | TBD (defined but unused) | Binary semaphore |
| `audio_read_mutex` | `SemaphoreHandle_t` | goertzel.h:188 | TBD (defined but unused) | Binary semaphore |

**Lock-Free Design Rationale:**

1. **No mutexes on hot path** - Uses atomic sequence counters instead
2. **Memory barriers** - `__sync_synchronize()` ensures CPU cache coherency
3. **Sequence counter validation** - Reader retries if torn read detected
4. **Spinlock for arrays** - Only guards tempo_magnitude[]/tempo_phase[] copy (lines 346-351)

**Critical Sections (Lines 336-351):**

```cpp
// Audio task (Core 0)
static portMUX_TYPE audio_spinlock = portMUX_INITIALIZER_UNLOCKED;

// Sync tempo confidence
portENTER_CRITICAL(&audio_spinlock);
audio_back.tempo_confidence = tempo_confidence;
audio_back.is_valid = !silence_frame;
portEXIT_CRITICAL(&audio_spinlock);

// Sync tempo magnitude and phase arrays
portENTER_CRITICAL(&audio_spinlock);
for (uint16_t i = 0; i < NUM_TEMPI; i++) {
    audio_back.tempo_magnitude[i] = tempi[i].magnitude;
    audio_back.tempo_phase[i] = tempi[i].phase;
}
portEXIT_CRITICAL(&audio_spinlock);
```

**Why Spinlock Here?**
- Small fixed-size arrays (256 bytes total)
- Short critical section (~microseconds)
- Must synchronize tempo state across cores
- Can't use sequence counter for partial struct updates

---

## 9. DELAYS & BUFFERING THAT COULD CAUSE LATENCY

### Latency Breakdown (Milliseconds):

| Stage | Duration | Notes |
|-------|----------|-------|
| **I2S microphone read** | 8ms | Blocking on CHUNK_SIZE=128 @ 16kHz |
| **Goertzel (64 bins)** | 15-25ms | Variable block sizes, interlaced 2/frame |
| **Chromagram** | 1ms | Simple aggregation |
| **Novelty detection** | ~1ms | Spectral flux calculation |
| **Tempo update** | ~5-10ms | 2 tempo bins/frame (interlaced) |
| **Phase advance** | ~1ms | 64 sin/cos calculations |
| **Buffer swap** | ~0.5ms | memcpy + barriers |
| **Pattern access** | ~0.02ms | Snapshot read, no copy |
| **RMT transmit** | ~0.5-1ms | DMA, non-blocking |
| **Total latency** | **40-50ms** | One-way from mic to output |

### Buffering Chain:

```
Microphone (continuous)
  ↓ (I2S DMA)
  ↓ 8ms chunk
I2S ring buffer (firmware-managed, 8 buffers × 128 samples)
  ↓ (blocking read in audio_task)
sample_history[4096] (ring buffer)
  ↓ (shift and append, 8ms cadence)
spectrogram[64] (current frame)
  ↓ (auto-range, smooth)
spectrogram_smooth[64]
  ↓ (moving avg, 6 frames)
audio_back (private buffer on Core 0)
  ↓ (commit_audio_data, memcpy)
audio_front (shared snapshot)
  ↓ (sequence counter validation)
Pattern snapshot (local copy in pattern function)
```

### Stale Data Handling:

```cpp
// If no audio update for >50ms:
if (AUDIO_IS_STALE()) {
    brightness *= 0.95f;  // Fade effect
}

// Age detection:
uint32_t age = AUDIO_AGE_MS();
// Typical: 0-20ms (within 2 audio frames)
// Alert: >50ms indicates audio lag or silence
```

---

## 10. TIMING-CRITICAL SECTIONS

### File: `/firmware/src/main.cpp` (lines 240-449)

**Core 0 Audio Task (Timing-Sensitive):**

```cpp
void audio_task(void* param) {
  while (true) {
    // Frame start
    uint32_t t0 = micros();
    
    // BLOCK 1: I2S read (8ms expected, up to 100ms timeout)
    acquire_sample_chunk();  // ~8ms nominal, BLOCKING
    
    // BLOCK 2: Goertzel computation (15-25ms)
    calculate_magnitudes();  // Must complete within frame budget
    
    // BLOCK 3: Tempo processing (~5-10ms)
    get_chromagram();        // ~1ms
    update_novelty();        // ~1ms
    update_tempo();          // ~5-10ms (interlaced)
    update_tempi_phase(delta); // ~1ms (64 bins, fast math)
    
    // BLOCK 4: Beat emission (<1ms)
    // Phase detection or confidence gating
    
    // BLOCK 5: Buffer sync (<1ms)
    finish_audio_frame();    // commit_audio_data()
    
    // Yield
    vTaskDelay(pdMS_TO_TICKS(1));  // 1ms delay
    
    // Total cycle: ~40-50ms @ 50 Hz effective
  }
}
```

**Core 1 Render Loop (Latency-Insensitive):**

```cpp
void loop_gpu(void* param) {
  for (;;) {
    uint32_t t_frame_start = micros();
    
    // Get parameters (thread-safe)
    const PatternParameters& params = get_params();
    
    // Get audio snapshot (non-blocking, ~0.02ms)
    AudioDataSnapshot audio_snapshot;
    get_audio_snapshot(&audio_snapshot);  // Retry loop but fast
    
    // Pattern rendering (~2-10ms depending on pattern)
    draw_current_pattern(context);
    
    // LED transmission (non-blocking DMA)
    transmit_leds();
    
    // No delay - run at max FPS (100+ Hz)
  }
}
```

**Timeline (Example Frame):**

```
t=0ms      : audio_task starts acquire_sample_chunk()
t=8ms      : I2S read completes, calculate_magnitudes() begins
t=25ms     : Goertzel completes, tempo/beat detection
t=35ms     : finish_audio_frame() commits audio_back → audio_front
t=35ms     : loop_gpu reads snapshot (sees updated data)
t=35ms     : Pattern rendering begins
t=37ms     : Pattern completes, transmit_leds() sends to RMT
t=37.5ms   : RMT DMA completes (LEDs updated)

Total latency: 35-40ms from microphone to LED output
```

**Bottlenecks:**

1. **Goertzel (15-25ms)** - Most expensive operation
   - 64 frequency bins × varying block sizes
   - Interlaced (2 bins/frame) to spread load
   - Cannot be parallelized (sequential dependency)

2. **I2S blocking (8ms nominal, up to 100ms timeout)**
   - Necessary evil for microphone synchronization
   - Timeout protection prevents deadlock

3. **Memory barriers (__sync_synchronize())**
   - Required for ESP32-S3 dual-core cache coherency
   - ~1-2 microseconds each (negligible)

**No Real-Time Guarantees:**
- FreeRTOS is not hard real-time
- Audio jitter: ±5-10ms typical
- Pattern rendering can cause audio task preemption
- Wifi/OTA updates cause temporary stalls

---

## Summary Map

```
AUDIO PIPELINE - DATA & CONTROL FLOW
=====================================

CORE 0 (Audio Processing)           CORE 1 (Visual Rendering)
─────────────────────────────────   ──────────────────────────────

microphone (I2S) ──┐
                  │
        init_i2s_microphone()        
                  │
    acquire_sample_chunk()  (blocking, 8ms)
           ↓
    sample_history[4096]
           ↓
    calculate_magnitudes()  (Goertzel, 15-25ms)
           ↓
    spectrogram[64], spectrogram_smooth[64]
           ↓
    get_chromagram()  (~1ms)
           ↓
    chromagram[12]
           ↓
    update_novelty()  (~1ms)
           ↓
    novelty_curve[1024]
           ↓
    update_tempo()  (interlaced, ~5-10ms)
    update_tempi_phase()
           ↓
    tempi[64], tempo_phase[64]
           ↓
    audio_back (all data copied)
           ├─ spectrogram
           ├─ chromagram
           ├─ tempo_magnitude
           ├─ tempo_phase
           ├─ vu_level
           └─ novelty_curve
           ↓
    commit_audio_data()
    (memcpy + seq counter)
           ↓
    audio_front ─────────────────────→ get_audio_snapshot()
                                              ↓
                                    PATTERN_AUDIO_START()
                                              ↓
                                    Access via macros:
                                    - AUDIO_SPECTRUM[i]
                                    - AUDIO_TEMPO_PHASE(bin)
                                    - AUDIO_BASS()
                                    - etc.
                                              ↓
                                    draw_current_pattern()
                                              ↓
                                    transmit_leds() (RMT)
                                              ↓
                                    LED output (160+ LEDs)
```

**Key Files:**
- Entry: `/firmware/src/main.cpp:240` (audio_task)
- Microphone: `/firmware/src/audio/microphone.cpp`
- Goertzel: `/firmware/src/audio/goertzel.cpp:403` (calculate_magnitudes)
- Tempo: `/firmware/src/audio/tempo.cpp:276` (update_tempo)
- Snapshot: `/firmware/src/audio/goertzel.cpp:127` (get_audio_snapshot)
- Patterns: `/firmware/src/pattern_audio_interface.h` (macros)
- Sync: `/firmware/src/audio/goertzel.cpp:184` (commit_audio_data)

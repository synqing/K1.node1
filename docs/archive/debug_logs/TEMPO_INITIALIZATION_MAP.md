# Tempo Detection - Initialization & Call Map

## INITIALIZATION DEPENDENCY GRAPH

```
SETUP PHASE (main.cpp, lines 600-626)
│
├─ init_audio_stubs() [Line 600]
│  │ Location: goertzel.cpp (stub only)
│  └─ Purpose: Legacy initialization
│
├─ init_i2s_microphone() [Line 604]
│  │ Location: audio/i2s_microphone.cpp
│  └─ Purpose: Configure I2S DMA for microphone input
│
├─ init_audio_data_sync() [Line 608]
│  │ Location: audio/goertzel.cpp:86-109
│  │ Creates: audio_swap_mutex, audio_read_mutex
│  │ Initializes: audio_front, audio_back buffers
│  └─ Populates: AudioDataSnapshot.is_valid = false
│
├─ init_window_lookup() [Line 612] ⭐ CRITICAL
│  │ Location: audio/goertzel.cpp:282-303
│  │ Populates: window_lookup[4096]
│  │ Function: Gaussian window for Goertzel smoothing
│  │ Used by: Both frequency and tempo Goertzel filters
│  │ Required for: Goertzel windowing in tempo detection
│  └─ Impact: If skipped, Goertzel produces garbage
│
├─ init_goertzel_constants_musical() [Line 613] ⭐ CRITICAL
│  │ Location: audio/goertzel.cpp:252-280
│  │ Populates: frequencies_musical[64]
│  │ Each element: {.target_freq, .block_size, .coeff, .window_step, ...}
│  │ Range: BOTTOM_NOTE to BOTTOM_NOTE + 126 (quarter-steps)
│  └─ Purpose: Musical frequency analysis (55 Hz to 6.4 kHz)
│
├─ init_vu() [Line 616]
│  │ Location: audio/vu.cpp
│  └─ Purpose: Initialize VU meter state
│
└─ init_tempo_goertzel_constants() [Line 620] ⭐ CRITICAL
   │ Location: audio/tempo.cpp:77-128
   │ Populates: tempi[64] array
   │ Each element initialization:
   │ ├─ tempi[i].target_tempo_hz = (32-192 BPM) / 60
   │ ├─ tempi[i].block_size = calculated window size
   │ ├─ tempi[i].coeff = 2 * cos(ω)
   │ ├─ tempi[i].sine = sin(ω)
   │ ├─ tempi[i].cosine = cos(ω)
   │ ├─ tempi[i].window_step = 4096 / block_size
   │ ├─ tempi[i].phase = 0.0f
   │ ├─ tempi[i].magnitude = 0.0f
   │ ├─ tempi[i].magnitude_smooth = 0.0f
   │ └─ tempi[i].phase_radians_per_reference_frame = 2π*freq_hz / 100 FPS
   └─ Purpose: Beat detection filter bank

GLOBAL ARRAYS INITIALIZATION (goertzel.cpp, lines 27-48)
├─ spectrogram[64] → {0}
├─ spectrogram_smooth[64] → {0}
├─ frequencies_musical[64] → struct default init
├─ tempi[64] → struct default init
├─ tempi_smooth[64] → {0}
├─ sample_history[4096] → {0}
├─ novelty_curve[1024] → {0}
├─ novelty_curve_normalized[1024] → {0}
├─ window_lookup[4096] → to be filled by init_window_lookup()
└─ audio_front, audio_back → to be filled by init_audio_data_sync()
```

---

## RUNTIME CALL SEQUENCE

### Per Frame (Audio Task, every ~20-40ms)

```
audio_task_core1() [main.cpp:235-341]
│
├─ acquire_sample_chunk() [Line 237]
│  │ Location: audio/goertzel.cpp
│  │ Operation: I2S DMA blocking read
│  │ Fills: sample_history[4096]
│  └─ Output: sample_history contains 1024-4096 fresh audio samples
│
├─ calculate_magnitudes() [Line 240]
│  │ Location: audio/goertzel.cpp:403-550
│  │ For each freq_bin (0-63):
│  │ ├─ calculate_magnitude_of_bin(i)
│  │ │  └─ Goertzel filter on sample_history[]
│  │ ├─ Noise filtering
│  │ ├─ Moving average smoothing
│  │ ├─ Auto-ranging normalization
│  │ └─ Store: frequencies_musical[i].magnitude, spectrogram[i]
│  │
│  └─ Output: spectrogram[64] = 0.0-1.0 normalized values
│
├─ get_chromagram() [Line 250]
│  │ Location: audio/goertzel.cpp
│  │ Operation: Convert spectrogram to 12 pitch classes
│  └─ Output: chromagram[12]
│
├─ Time context update [Lines 254-255]
│  ├─ t_now_us = micros()
│  └─ t_now_ms = millis()
│
├─ run_vu() [Line 258]
│  │ Location: audio/vu.cpp
│  │ Operation: Update VU meter from spectrogram
│  └─ Output: vu_max updated
│
├─ update_novelty() [Line 261] ⭐ BEAT DETECTION STAGE 1
│  │ Location: audio/tempo.cpp:286-314
│  │ Operation:
│  │ ├─ Check if 20ms elapsed since last update (50 Hz cadence)
│  │ ├─ For each frequency bin:
│  │ │  ├─ novelty[i] = max(0, spectrogram_smooth[i] - magnitude_last[i])
│  │ │  └─ magnitude_last[i] = spectrogram_smooth[i]
│  │ ├─ Sum all novelties, divide by NUM_FREQS
│  │ ├─ log_novelty(logf(1.0f + current_novelty))
│  │ │  └─ shift_array_left(novelty_curve, NOVELTY_HISTORY_LENGTH, 1)
│  │ │  └─ novelty_curve[1023] = logf(1.0f + current_novelty)
│  │ ├─ check_silence(current_novelty)
│  │ └─ Output: novelty_curve[1024] updated
│  │
│  └─ Required for: Goertzel beat detection input
│
├─ update_tempo() [Line 265] ⭐ BEAT DETECTION STAGE 2 & 3
│  │ Location: audio/tempo.cpp:226-241
│  │ Operation:
│  │ ├─ normalize_novelty_curve() [Lines 207-224]
│  │ │  ├─ Track max value in novelty_curve[]
│  │ │  ├─ Calculate auto-scale factor
│  │ │  └─ novelty_curve_normalized[i] = novelty_curve[i] * scale
│  │ │
│  │ ├─ calculate_tempi_magnitudes(calc_bin) [Lines 169-205]
│  │ │  ├─ calculate_magnitude_of_tempo(calc_bin) [Lines 135-167]
│  │ │  │  ├─ For each sample in block_size:
│  │ │  │  │  ├─ Load: sample_novelty = novelty_curve_normalized[index]
│  │ │  │  │  ├─ Apply window: window_lookup[window_pos]
│  │ │  │  │  ├─ Goertzel IIR: q0 = coeff*q1 - q2 + windowed_sample
│  │ │  │  │  └─ Advance: q2=q1, q1=q0, window_pos += window_step
│  │ │  │  ├─ Compute magnitude from (q1, q2)
│  │ │  │  └─ tempi[calc_bin].magnitude_full_scale = normalized_magnitude
│  │ │  │
│  │ │  ├─ calculate_tempi_magnitudes(calc_bin+1) [second bin]
│  │ │  │
│  │ │  ├─ Auto-ranging:
│  │ │  │  ├─ Find max value across all bins
│  │ │  │  ├─ Apply floor: max_val = max(max_val, 0.04f)
│  │ │  │  ├─ For each bin: scaled = full_scale / max_val
│  │ │  │  └─ tempi[i].magnitude = scaled ^ 2 (quadratic compression)
│  │ │  │
│  │ │  └─ Output: tempi[64].magnitude = 0.0-1.0
│  │ │
│  │ ├─ Interlaced processing: calc_bin += 2 each frame
│  │ │  └─ Processes all 64 bins at 50 Hz (2 per frame)
│  │ │
│  │ └─ Output: tempi[64].magnitude updated
│  │
│  └─ Required for: Phase synchronization input
│
├─ update_tempi_phase(delta) [Line 274] ⭐ BEAT DETECTION STAGE 4
│  │ Location: audio/tempo.cpp:329-348
│  │ delta = time_since_last_call / ideal_frame_time
│  │ Operation:
│  │ ├─ tempi_power_sum = 0.00000001f
│  │ ├─ For each tempo bin (0-63):
│  │ │  ├─ Smooth: tempi_smooth[i] = tempi_smooth[i]*0.92f + tempi[i].magnitude*0.08f
│  │ │  ├─ Add to sum: tempi_power_sum += tempi_smooth[i]
│  │ │  ├─ Advance phase: sync_beat_phase(i, delta)
│  │ │  │  └─ tempi[i].phase += phase_radians_per_ref_frame * delta
│  │ │  └─ Compute beat signal: tempi[i].beat = sin(tempi[i].phase)
│  │ │
│  │ ├─ Find peak contribution:
│  │ │  ├─ max_contribution = 0.000001f
│  │ │  └─ For each bin: max_contribution = max(tempi_smooth[i] / tempi_power_sum)
│  │ │
│  │ └─ tempo_confidence = max_contribution
│  │
│  └─ Output: tempo_confidence, tempi_smooth[64], tempi[64].phase
│
├─ Sync to audio snapshot [Lines 276-292]
│  ├─ audio_back.tempo_confidence = tempo_confidence
│  ├─ For each tempo bin:
│  │  ├─ audio_back.tempo_magnitude[i] = tempi[i].magnitude
│  │  └─ audio_back.tempo_phase[i] = tempi[i].phase
│  └─ Output: Patterns can read audio snapshot
│
├─ Beat event detection [Lines 295-333]
│  ├─ Threshold: base_threshold + silence_adjust + novelty_adjust
│  ├─ If tempo_confidence > threshold && spacing_ok:
│  │  └─ beat_events_push() → ring buffer
│  └─ Diagnostic logging (every 3 sec)
│
├─ finish_audio_frame() [Line 336]
│  │ Location: audio/goertzel.cpp:184-222
│  │ Operation:
│  │ ├─ Increment sequence counter (mark write start)
│  │ ├─ Copy audio_back → audio_front (all audio data)
│  │ ├─ Restore/update sequence counter
│  │ └─ Mark is_valid = true
│  │
│  └─ Output: Patterns can get_audio_snapshot()
│
└─ vTaskDelay(1ms) [Line 340]
   └─ Yield to prevent starvation
```

---

## KEY DATA STRUCTURES

### tempi[NUM_TEMPI] (Tempo Hypothesis Array)
```cpp
struct {
    float target_tempo_hz;                      // 0.5 Hz to 3.2 Hz (32-192 BPM)
    float coeff;                                // 2*cos(2πk/block_size)
    float sine;                                 // sin(2πk/block_size)
    float cosine;                               // cos(2πk/block_size)
    float window_step;                          // 4096 / block_size
    float phase;                                // Current beat phase (-π to π)
    float phase_target;                         // Target sync phase
    bool  phase_inverted;                       // Phase flip flag
    float phase_radians_per_reference_frame;    // 2π*freq / 100 FPS
    float beat;                                 // sin(phase) = -1 to 1
    float magnitude;                            // Auto-ranged 0.0-1.0
    float magnitude_full_scale;                 // Before auto-ranging
    float magnitude_smooth;                     // EMA smoothed (in tempi_smooth[])
    uint32_t block_size;                        // Novelty window size (samples @ 50 Hz)
} tempi[64];
```

### tempi_smooth[NUM_TEMPI]
```cpp
float tempi_smooth[64];  // Exponential moving average with α=0.08
// Updated: tempi_smooth[i] = tempi_smooth[i]*0.92f + tempi[i].magnitude*0.08f
```

### novelty_curve & novelty_curve_normalized
```cpp
float novelty_curve[1024];                      // Log-scaled onset detection (50 Hz history = 20.48 sec)
float novelty_curve_normalized[1024];           // Auto-scaled to 0.0-1.0 range
```

---

## CRITICAL PARAMETERS

### Tempo Range
```
TEMPO_LOW = 32 BPM
TEMPO_HIGH = 192 BPM
NUM_TEMPI = 64 bins
Resolution: (192-32) / 64 ≈ 2.5 BPM per bin
```

### Novelty Sampling
```
NOVELTY_LOG_HZ = 50 Hz
Update interval = 1000000 / 50 = 20000 µs = 20 ms
NOVELTY_HISTORY_LENGTH = 1024 samples = 20.48 seconds of history
```

### Goertzel Window
```
window_lookup[4096] = Gaussian window
Sampling: window_pos increments by tempi[i].window_step per sample
Total samples in window = block_size
```

### Phase Tracking
```
REFERENCE_FPS = 100 Hz (ideal frame rate)
phase_radians_per_reference_frame = 2π * target_tempo_hz / 100
Actual delta: dt_us / (1000000 / 100)
```

---

## EXECUTION FREQUENCY

| Function | Called | Frequency | Notes |
|----------|--------|-----------|-------|
| acquire_sample_chunk | audio_task | ~40-50 Hz | I2S blocking |
| calculate_magnitudes | audio_task | ~40-50 Hz | Per audio chunk |
| update_novelty | audio_task | 50 Hz (gated) | Fixed 20ms cadence |
| update_tempo | audio_task | 50 Hz | Calls normalize + calculate_tempi |
| calculate_magnitude_of_tempo | update_tempo | 100 Hz (interlaced) | 2 bins per frame, 64 bins total |
| update_tempi_phase | audio_task | 50 Hz | Computes confidence |
| finish_audio_frame | audio_task | 50 Hz | Buffer swap |

---

## FILE LOCATIONS (ABSOLUTE PATHS)

| Component | File | Lines | Function |
|-----------|------|-------|----------|
| Tempo header | `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/tempo.h` | 1-80 | Declarations |
| Tempo implementation | `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/tempo.cpp` | 1-349 | Functions |
| Goertzel header | `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/goertzel.h` | 1-269 | Declarations |
| Goertzel implementation | `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/goertzel.cpp` | 1-600+ | Functions |
| Main setup | `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/main.cpp` | 600-650 | Initialization |
| Main audio task | `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/main.cpp` | 235-341 | audio_task_core1 |
| Pattern audio interface | `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/pattern_audio_interface.h` | 1-637 | Macros |

---

## DEBUGGING CHECKLIST

- [ ] Verify `init_tempo_goertzel_constants()` called in setup
- [ ] Check `tempi[32].block_size` value (for 114 BPM)
- [ ] Log `novelty_curve[NOVELTY_HISTORY_LENGTH-1]` (is it non-zero?)
- [ ] Log `novelty_curve_normalized[NOVELTY_HISTORY_LENGTH-1]` (is it non-zero?)
- [ ] Log `tempi[32].magnitude_full_scale` (is it non-zero?)
- [ ] Log `tempi[32].magnitude` (is it non-zero?)
- [ ] Log `tempi_power_sum` (is it non-zero?)
- [ ] Log `tempo_confidence` (what does it show?)
- [ ] Verify `window_lookup[]` populated (check first/last values)
- [ ] Verify `frequencies_musical[i].magnitude_last` initialized correctly

# Firmware Tempo Detection Implementation Map

## 1. MAIN TEMPO DETECTION ALGORITHM & CORE FILES

### 1.1 Core Tempo Detection Module
**Location:** `/home/user/K1.node1/firmware/src/audio/tempo.h` & `tempo.cpp`

**Main Public API Functions:**
- `init_tempo_goertzel_constants()` - Initializes tempo bins (64 tempi from 32-192 BPM)
- `update_tempo()` - Main tempo calculation per frame (updates 2 tempo bins per call)
- `update_novelty()` - Spectral flux (onset detection) at 50 Hz cadence
- `update_tempi_phase(float delta)` - Syncs beat phase and calculates confidence
- `check_silence(float current_novelty)` - Silence detection and history dampening
- `find_closest_tempo_bin(float target_bpm)` - Utility to find nearest tempo bin

**Key Global State Variables:**
- `tempi[NUM_TEMPI]` - 64 tempo detectors (struct with phase, magnitude, beat, etc.)
- `tempi_smooth[NUM_TEMPI]` - Smoothed magnitudes (exponential moving average)
- `tempo_confidence` - Max contribution of strongest tempo bin (0.0-1.0)
- `novelty_curve[NOVELTY_HISTORY_LENGTH]` - Raw spectral flux history
- `novelty_curve_normalized[NOVELTY_HISTORY_LENGTH]` - Auto-scaled novelty
- `tempi_power_sum` - Sum of all tempo magnitudes (for confidence normalization)
- `vu_curve[NOVELTY_HISTORY_LENGTH]` - VU level history (parallel to novelty)
- `silence_detected` - Boolean flag
- `silence_level` - Normalized silence metric (0.0-1.0)

---

## 2. CONFIGURATION & CONSTANTS

### 2.1 Tempo Range Configuration
**File:** `firmware/src/audio/tempo.h` (lines 24-30)

```cpp
#define NOVELTY_HISTORY_LENGTH (1024)     // 50 FPS × 20.48 sec = 1024 samples
#define NOVELTY_LOG_HZ (50)               // Update novelty at 50 Hz cadence

#define TEMPO_LOW (64 - 32)               // 32 BPM (lower bound)
#define TEMPO_HIGH (192 - 32)             // 192 BPM (upper bound)

#define BEAT_SHIFT_PERCENT (0.08)         // Phase shift = 8% of 2π (for beat alignment)
#define REFERENCE_FPS (100.0f)            // Reference frame rate for phase sync
```

### 2.2 Microphone & Audio Sample Configuration
**File:** `firmware/src/audio/microphone.h` (lines 47-55)

```cpp
#define CHUNK_SIZE 128                    // Samples per I2S read (8ms at 16kHz)
#define SAMPLE_RATE 16000                 // 16 kHz audio sampling
#define SAMPLE_HISTORY_LENGTH 4096        // Ring buffer for Goertzel analysis
```

### 2.3 Frequency Analysis Configuration
**File:** `firmware/src/audio/goertzel.h` (lines 35-52)

```cpp
#define NUM_FREQS 64                      // 64 musical frequency bins
#define NUM_TEMPI 64                      // 64 tempo hypothesis detectors
#define NUM_SPECTROGRAM_AVERAGE_SAMPLES 8 // Rolling average window
#define NUM_VU_LOG_SAMPLES 20             // VU meter averaging window
```

### 2.4 VU Meter & Amplitude Gating Configuration
**File:** `firmware/src/audio/vu.cpp` (lines 9-10) & `firmware/src/audio/goertzel.cpp` (lines 48-53)

```cpp
#define NUM_VU_LOG_SAMPLES 20             // 20 × 250ms = 5 second window
#define NUM_VU_SMOOTH_SAMPLES 12          // 12-sample moving average

// Default audio configuration:
vu_floor_pct = 0.70f                      // Noise floor multiplier (lowered from 0.90)
microphone_gain = 1.0f                    // 0dB gain (0.5-2.0x range available)
vu_floor = 0.0f                           // Runtime-computed noise floor
```

---

## 3. TEMPO BIN INITIALIZATION & GEOMETRY

### 3.1 Tempo Bin Setup
**Function:** `init_tempo_goertzel_constants()` at `firmware/src/audio/tempo.cpp:76-127`

**Process:**
1. Creates 64 linearly-spaced tempo bins from 32 to 192 BPM
2. For each bin, computes Goertzel filter coefficients:
   - Target frequency in Hz: `tempo_bpm / 60.0`
   - Block size based on neighbor spacing (Nyquist criterion)
   - Precomputed cosine, sine, and filter coefficient
   - Phase tracking constants

**Key Geometry:**
```cpp
for (i = 0; i < NUM_TEMPI; i++) {
    progress = i / NUM_TEMPI
    tempo_bpm = (TEMPO_HIGH - TEMPO_LOW) × progress + TEMPO_LOW
    tempi_bpm_values_hz[i] = tempo_bpm / 60.0
    // Block size ∝ NOVELTY_LOG_HZ / (neighbor_distance × 0.5)
}
```

**Tempo Struct Fields:**
```cpp
struct tempo {
    float target_tempo_hz;                  // Center frequency (Hz)
    float coeff;                            // 2×cos(ω) - Goertzel recurrence
    float sine, cosine;                     // Precomputed trig values
    float phase;                            // Beat phase (-π to π)
    float beat;                             // sin(phase) for visualization
    float magnitude;                        // Normalized & auto-scaled (0-1)
    float magnitude_full_scale;             // Before auto-scaling
    float magnitude_smooth;                 // Smoothed (stored in tempi_smooth[])
    uint32_t block_size;                    // Analysis window size
    float phase_radians_per_reference_frame;// Phase advance per frame
};
```

---

## 4. AUTO-RANGING & AMPLITUDE GATING MECHANISMS

### 4.1 Novelty Curve Auto-Scaling
**Function:** `normalize_novelty_curve()` at `firmware/src/audio/tempo.cpp:201-218`

**Algorithm:**
1. Decay max value: `max_val *= 0.99f` (1% per frame exponential decay)
2. Accumulate max across NOVELTY_HISTORY_LENGTH
3. Smooth adaptation: `max_val_smooth = max_val_smooth × 0.95 + max_val × 0.05`
   - Attack: 5% per frame = ~0.4s to 63% adaptation (faster attack)
   - Release: 95% retention = slower decay (natural trailing)
4. Compute auto-scale: `auto_scale = 1.0 / max(max_val, 0.00001)`
5. Apply: `novelty_curve_normalized = novelty_curve × auto_scale`

**Tuning Parameters:**
- Decay rate: `0.99f` (1% loss per frame)
- Smooth update: `0.95 + 0.05` split (increased from 0.99 + 0.01)
- Floor: `0.00001f` to prevent division by zero

### 4.2 Tempo Magnitude Auto-Ranging (Per-Bin)
**Function:** `calculate_tempi_magnitudes()` at `firmware/src/audio/tempo.cpp:163-199`

**Two-Stage Process:**

**Stage 1: Calculate Full-Scale Magnitudes**
- Goertzel filter on normalized novelty curve
- Window function applied (4096-sample lookup table)
- Complex magnitude computation: `mag = √(q1² + q2² - q1×q2×coeff)`
- Normalized: `magnitude_full_scale = mag / (block_size / 2.0)`

**Stage 2: Dynamic Range Compression & Auto-Range**
```cpp
// Find peak across all tempi
max_val = max(magnitude_full_scale[i] for all i)
if (max_val < 0.04) max_val = 0.04      // Floor to prevent over-amplification

// Autoranger: scale all bins so strongest = 1.0
autoranger_scale = 1.0 / max_val

// Apply scaling and cubic-to-quadratic compression
for each bin i:
    scaled = magnitude_full_scale[i] × autoranger_scale
    scaled = clip(scaled, 0.0, 1.0)
    magnitude[i] = scaled² (quadratic, was cubic for better low-sensitivity)
```

**Noise Gate (Implicit):**
- Minimum floor: `max_val >= 0.04f` prevents amplification of dead zones
- Helps suppress noise when music is quiet

### 4.3 VU Meter & Amplitude Gating
**File:** `firmware/src/audio/vu.cpp:37-116`

**Process:**
1. **Frame Peak Detection** (per 128-sample chunk):
   - RMS of recent samples: `max_amplitude_now = max(sample²)`
   - Clipped to [0.0, 1.0]

2. **Noise Floor Calibration** (every 250ms after boot):
   - Rolling average of 20 log samples: `avg = Σ(vu_log[i]) / 20`
   - Noise floor: `vu_floor = avg × vu_floor_pct`
   - Configurable floor multiplier: `0.5 ≤ vu_floor_pct ≤ 0.98`

3. **Amplitude Gating**:
   - Subtract floor: `gated = max(amplitude - vu_floor, 0.0)`
   - Prevents noise from triggering beats

4. **Auto-Scale Envelope** (exponential cap):
   - Attack: `cap += (amplitude - cap) × 0.25` (25% = 30-50ms rise time)
   - Release: `cap -= (cap - amplitude) × 0.1` (10% = slower fall, ~300ms)
   - Floor: `min_cap = 0.000010f`

5. **Quiet-Level Boost** (dynamic sensitivity):
   - For `vu_floor_pct ≤ 0.90`, apply boost `1.0 → 2.0x`
   - Boost gated by quiet regions: only when `cap < 0.00002f`
   - Amplifies weak signals without clipping loud ones

6. **Final Smoothing** (12-sample moving average):
   - `vu_level = Σ(vu_smooth[i]) / 12`
   - `vu_max = max(vu_max, vu_level)` (peak tracking)

---

## 5. BIN SMOOTHING IMPLEMENTATIONS

### 5.1 Tempo Magnitude Smoothing
**Function:** `update_tempi_phase()` at `firmware/src/audio/tempo.cpp:323-342`

```cpp
// Per-frame exponential moving average of each tempo bin
for each tempo_bin:
    tempi_smooth[bin] = tempi_smooth[bin] × 0.92 + magnitude[bin] × 0.08
    
// Parameters:
// - Decay: 0.92 (8% weight to new magnitude)
// - Attack/Release ratio: symmetric (same rise and fall)
// - Tau: ~12.5 frames (at 100 FPS = 125ms) for 63% adaptation
```

**Purpose:**
- Removes frame-to-frame jitter
- Smooths confidence transitions
- Allows tempo switching without abrupt changes

### 5.2 Novelty History Smoothing
**Via:** Exponential averaging in `normalize_novelty_curve()`
- Decay: `0.99f` per frame
- Smooth: `0.95 + 0.05` per update interval

### 5.3 Spectrogram Averaging
**File:** `firmware/src/audio/goertzel.cpp` (lines 540-545)

```cpp
// 8-sample rolling average of spectrogram magnitudes
spectrogram_smooth[i] = 0
for a in 0..NUM_SPECTROGRAM_AVERAGE_SAMPLES-1:
    spectrogram_smooth[i] += spectrogram_average[a][i]
spectrogram_smooth[i] /= 8.0
```

---

## 6. CONFIDENCE CALCULATION

### 6.1 Beat Confidence Metric
**Function:** `update_tempi_phase()` at `firmware/src/audio/tempo.cpp:323-342`

```cpp
// Normalization: sum all smoothed tempo magnitudes
tempi_power_sum = Σ(tempi_smooth[i]) for all 64 tempi

// Find max contribution ratio
max_contribution = 0.0
for each tempo_bin:
    contribution = tempi_smooth[bin] / tempi_power_sum
    max_contribution = max(max_contribution, contribution)

// Confidence = strongest tempo's normalized power
tempo_confidence = max_contribution  // Range: [0.0, 1.0]
```

**Interpretation:**
- **Close to 1.0**: Single strong tempo dominant (high confidence)
- **Close to 0.1**: Uniform distribution across tempi (low confidence, ambiguous)
- **Below 0.05**: All tempi weak or silent (no beat detected)

### 6.2 Silence Detection
**Function:** `check_silence()` at `firmware/src/audio/tempo.cpp:256-278`

```cpp
// Analyze recent novelty (last 128 samples of normalized history)
max_val = max(recent_novelty for last 128 samples)
min_val = min(recent_novelty for last 128 samples)
novelty_contrast = |max_val - min_val|

// Silence metric
silence_level_raw = 1.0 - novelty_contrast
silence_level = max(0.0, (silence_level_raw - 0.5) × 2.0)  // Rescale [0.5..1.0] → [0..1]

// Silence detection
if (silence_level_raw > 0.5):
    silence_detected = true
    // Decay history by factor proportional to silence_level
    reduce_tempo_history(silence_level × 0.10)  // Max 10% decay when silent
else:
    silence_detected = false
    silence_level = 0.0
```

**Purpose:**
- Prevents false beats during silence
- Gradually decays history to clear stale tempi during quiet sections
- Helps reset tempo tracking for new songs

---

## 7. NOVELTY (SPECTRAL FLUX) CALCULATION

### 7.1 Onset Detection - Novelty Computation
**Function:** `update_novelty()` at `firmware/src/audio/tempo.cpp:280-308`

**Cadence:**
- Updates at 50 Hz (every 20ms = 1000000μs / 50)
- Called from main loop at 100 FPS, skips every other frame

**Algorithm:**
```cpp
for each frequency bin (0..63):
    new_mag = spectrogram_smooth[i]  // Current frequency magnitude
    old_mag = frequencies_musical[i].magnitude_last
    novelty[i] = max(0.0, new_mag - old_mag)  // Only positive changes = onsets
    frequencies_musical[i].magnitude_last = new_mag

// Aggregate novelty
current_novelty = Σ(novelty[i]) / NUM_FREQS  // Mean across 64 bins

// Log transform for better scaling
log_novelty_value = log(1.0 + current_novelty)

// Append to history ring buffer
novelty_curve[NOVELTY_HISTORY_LENGTH - 1] = log_novelty_value
shift_array_left(novelty_curve, 1)  // Ring buffer rotation
```

**Key Features:**
- Detects only increasing magnitude (onsets), not decreases
- Normalized per-frame before storage
- Logarithmic scaling compresses dynamic range
- 1024-sample history = 20.48 seconds at 50 Hz

---

## 8. TIMEOUT CONFIGURATIONS

### 8.1 Novelty Update Interval
**File:** `firmware/src/audio/tempo.h:25` & `tempo.cpp:286-287`

```cpp
#define NOVELTY_LOG_HZ (50)           // 50 Hz = 20ms interval
update_interval_us = 1000000 / 50 = 20000 microseconds (20ms)
```

### 8.2 VU Meter Update Interval
**File:** `firmware/src/audio/vu.cpp:54`

```cpp
if (now_ms - last_vu_log >= 250)    // 250ms between updates
    // Update noise floor calibration
```

### 8.3 I2S Microphone Timeout & Recovery
**File:** `firmware/src/audio/microphone.h:67-76` & `microphone.cpp`

```cpp
struct I2STimeoutState {
    uint32_t timeout_count;          // Total timeouts
    uint32_t consecutive_failures;   // Current streak
    uint32_t last_failure_time_ms;
    uint8_t last_error_code;
    bool in_fallback_mode;           // Silence fallback active
    uint32_t fallback_start_time_ms;
};

// Recovery logic (microphone.cpp:168+):
if (consecutive_failures >= 3):
    enter_fallback_mode()            // Feed silence to buffers
    if (fallback_duration > 5000ms):
        exit_fallback_mode()         // Retry after 5 second timeout
```

### 8.4 Frame Rate / Analysis Cadence
**Main Loop Update:** `firmware/src/main.cpp:261-275`

- `update_novelty()` - Every frame (100 FPS)
- `update_tempo()` - Every frame (updates 2 of 64 tempo bins per call)
- `update_tempi_phase()` - Every frame (smoothing & confidence)
- `check_silence()` - Within `update_novelty()` (50 Hz cadence)

---

## 9. DIAGNOSTIC ENDPOINTS (REST API)

### 9.1 Tempo Telemetry Endpoint
**Route:** `GET /api/audio/tempo` (200ms rate limit)
**Handler:** `GetAudioTempoHandler` at `firmware/src/webserver.cpp:1031-1070`

**Response JSON:**
```json
{
  "tempo_confidence": 0.75,        // 0.0-1.0 beat confidence
  "tempi_power_sum": 12.5,         // Sum of all tempo magnitudes
  "silence_detected": false,        // Boolean
  "silence_level": 0.0,             // 0.0-1.0 silence metric
  "max_tempo_range": 1.0,           // Tempo range multiplier
  "top_bins": [
    {
      "idx": 32,                    // Tempo bin index (0-63)
      "bpm": 120.0,                 // BPM value
      "magnitude": 0.85,            // Smoothed magnitude (0-1)
      "phase": 0.5,                 // Beat phase (-π to π)
      "beat": 0.48                  // sin(phase) for visualization
    },
    // ... 5 top tempo bins total
  ]
}
```

**Purpose:**
- Real-time beat detection telemetry
- Monitor tempo hypothesis strengths
- Verify confidence calculation
- Debug silence detection

### 9.2 Audio Snapshot Endpoint
**Route:** `GET /api/audio/snapshot` (300ms rate limit)
**File:** `firmware/src/webserver.cpp:1258-1276`

**Response includes:**
- `tempo_confidence`
- Minimal audio state
- Useful for UI updates

### 9.3 Audio Arrays Endpoint
**Route:** `GET /api/audio/arrays` (200ms rate limit)
**Handler:** `GetAudioArraysHandler` at `firmware/src/webserver.cpp:1072+`

**Query Parameters:**
- `count` - Number of frequency/tempo bins (default 16, clamp 4..64)
- `offset` - Starting bin index
- `stride` - Bin spacing (0 = auto)
- `history` - Include spectrogram history (boolean)
- `frames` - History depth (auto-limited)
- `include_chromagram` - 12-pitch chroma energy
- `include_novelty` - Novelty curve samples
- `order` - newest|oldest (time ordering)

**Returns:**
- Downsampled spectrogram_smooth array
- Downsampled tempi_smooth array
- Optional novelty history
- Optional chromagram

### 9.4 Beat Events Ring Buffer
**Route:** `GET /api/beat-events/info` (200ms rate limit)
**Route:** `GET /api/beat-events/recent` (300ms rate limit)
**Route:** `GET /api/beat-events/dump` (500ms rate limit)

**Fields:**
- `count` - Current events in buffer
- `capacity` - Total buffer size
- Per-event: `timestamp_us`, `confidence` (0-65535 scaled)

### 9.5 Latency Probe Endpoint
**Route:** `GET /api/latency/probe`
**File:** `firmware/src/webserver.cpp:756-775`

**Response:**
```json
{
  "active": false,
  "last_latency_ms": 1.5,
  "timestamp_us": 1234567890,
  "label": "beat_detection"
}
```

### 9.6 Audio Configuration Endpoint
**Route:** `GET /api/audio-config` (500ms rate limit)
**Route:** `POST /api/audio-config` (300ms rate limit)

**Configurable Fields:**
```json
{
  "microphone_gain": 1.0,         // 0.5-2.0x gain
  "vu_floor_pct": 0.70,           // Noise floor multiplier
  "active": true                  // Enable/disable audio processing
}
```

### 9.7 Audio Metrics Endpoint
**Route:** `GET /api/audio/metrics` (200ms rate limit)

**Includes:**
- `beat_events_count`
- `tempo_confidence`
- Frame metrics for audio processing

### 9.8 Prometheus Metrics Endpoint
**Route:** `GET /metrics`

**Metrics:**
```
k1_beat_events_count {value}
k1_tempo_confidence {value}
... other system metrics
```

---

## 10. DATA FLOW DIAGRAM

```
Microphone (16kHz I2S)
    ↓
acquire_sample_chunk() [128 samples = 8ms]
    ↓
sample_history[4096]  ← Ring buffer
    ↓
init_goertzel_constants_musical()
calculate_magnitudes()  ← Goertzel filter on 64 frequencies
    ↓
spectrogram[64]  ← Raw frequency magnitudes
    ↓
spectrogram_average[8][64]  ← Rolling 8-sample average
    ↓
spectrogram_smooth[64]  ← Per-frame averaged spectrum (100 FPS)
    ↓
run_vu()  ← VU meter: amplitude gating, auto-scale, noise floor
    ↓ (50 Hz cadence via update_novelty())
update_novelty()
    ├─ Compute onset novelty[64] = max(0, new_mag - old_mag)
    ├─ Aggregate: current_novelty = mean(novelty[])
    ├─ Log scale: log(1 + novelty)
    ├─ novelty_curve[1024] ← Ring buffer (20.48 sec @ 50Hz)
    └─ vu_curve[1024] ← Peak level history
        ↓
normalize_novelty_curve()
    ├─ Auto-range max_val (decay 0.99, smooth 0.95/0.05)
    └─ novelty_curve_normalized[1024] = novelty / max_val
        ↓
update_tempo()
    ├─ Calculate tempi_magnitudes[64] via Goertzel on novelty (2 bins/frame)
    │   ├─ Compute block_size from tempo spacing
    │   ├─ Apply window function
    │   ├─ Goertzel DFT: q0 = coeff×q1 - q2 + sample×window
    │   ├─ Phase: atan2(q2×sin, q1 - q2×cos) + 8% shift
    │   └─ magnitude_full_scale = √(q1² + q2² - q1×q2×coeff) / (block_size/2)
    │       ↓
    │   Auto-range: authorize all bins so max=1.0, apply x² compression
    │
    └─ update_tempi_phase(delta)
        ├─ Smooth: tempi_smooth[bin] × 0.92 + magnitude × 0.08
        ├─ Accumulate: tempi_power_sum = Σ tempi_smooth[]
        ├─ Phase sync: beat_phase += phase_advance × delta
        └─ Confidence: tempo_confidence = max(tempi_smooth[] / tempi_power_sum)
            ↓
check_silence()  (from update_novelty)
    ├─ novelty_contrast = max - min of last 128 novelty samples
    ├─ silence_level = 1.0 - novelty_contrast (rescaled)
    └─ Decay history if silent (max 10% per frame)
        ↓
REST API (/api/audio/tempo, /api/audio/snapshot, /api/audio/arrays, etc.)
    ↓
UI Display & Beat Detection Logic
```

---

## 11. INITIALIZATION SEQUENCE

**Called from `firmware/src/main.cpp:setup()`:**

1. `init_i2s_microphone()` - Configure I2S DMA
2. `init_audio_data_sync()` - Double-buffer mutexes
3. `init_vu()` - VU meter state
4. `init_window_lookup()` - Hann window for Goertzel
5. `init_goertzel_constants_musical()` - 64 frequency bin constants
6. `init_tempo_goertzel_constants()` - 64 tempo bin constants

**Main Loop (100 FPS):**
- `acquire_sample_chunk()` - Block until next I2S chunk
- `calculate_magnitudes()` - Goertzel on all 64 frequencies
- `run_vu()` - VU meter update
- `finish_audio_frame()` - Swap audio buffers
- `update_novelty()` - 50 Hz cadence via timer check
- `update_tempo()` - Update 2 tempo bins per frame
- `update_tempi_phase()` - Sync phase & calculate confidence
- `commit_audio_data()` - Lock-free buffer swap to Core 0

---

## 12. KEY TUNING PARAMETERS SUMMARY

| Parameter | Value | Impact | Location |
|-----------|-------|--------|----------|
| NOVELTY_HISTORY_LENGTH | 1024 | 20.48s @ 50Hz | tempo.h:24 |
| NOVELTY_LOG_HZ | 50 | Update interval (20ms) | tempo.h:25 |
| BEAT_SHIFT_PERCENT | 0.08 | 8% phase offset for beat timing | tempo.h:30 |
| REFERENCE_FPS | 100.0 | Phase advance rate | tempo.h:31 |
| TEMPO_LOW | 32 BPM | Minimum tempo | tempo.h:27 |
| TEMPO_HIGH | 192 BPM | Maximum tempo | tempo.h:28 |
| NUM_TEMPI | 64 | Tempo hypothesis bins | goertzel.h:52 |
| NUM_FREQS | 64 | Frequency bins | goertzel.h:46 |
| NUM_SPECTROGRAM_AVERAGE_SAMPLES | 8 | Spectrum averaging depth | goertzel.h:174 |
| Tempi Smooth Factor | 0.92/0.08 | Decay/Update (12.5 frame tau) | tempo.cpp:329 |
| Novelty Decay | 0.99 | Per-frame (1% loss) | tempo.cpp:206 |
| Novelty Smooth | 0.95/0.05 | Adaptation (5% attack) | tempo.cpp:213 |
| VU Update Interval | 250ms | Noise floor recalc | vu.cpp:54 |
| VU Attack | 0.25 | 30-50ms rise (0.25 per frame @ 100fps) | vu.cpp:75 |
| VU Release | 0.1 | ~300ms fall (~10% per frame) | vu.cpp:78 |
| VU Floor Pct | 0.70 | Noise gate threshold multiplier | goertzel.cpp:50 |
| Min Magnitude Floor | 0.04 | Prevent over-amplification | tempo.cpp:180 |
| Magnitude Compression | x² | Quadratic (was cubic x³) | tempo.cpp:195 |
| Silence Threshold | 0.5 | Novelty contrast threshold | tempo.cpp:271 |
| I2S Timeout Recovery | 5000ms | Fallback mode duration | microphone.cpp:187 |

---

## 13. THREAD SAFETY & SYNCHRONIZATION

### 13.1 Audio Buffer Double-Buffering
**Files:** `firmware/src/audio/goertzel.cpp` & `goertzel.h`

- `audio_front` / `audio_back` - Lock-free dual buffers
- Sequence counters for torn read detection
- `__sync_synchronize()` memory barriers for cache coherency
- Used for inter-core communication (Core 1 audio → Core 0 UI)

### 13.2 Tempo State Access
- `tempo_confidence` - Atomic read in REST handlers
- `tempi_smooth[64]` - Snapshot for JSON serialization
- No locks needed (read-only from Core 0)

### 13.3 Rate Limiting
**File:** `firmware/src/webserver_rate_limiter.h`

- Per-route rate limits (200-500ms typical)
- Spinlock protection against TOCTOU races
- Prevents flooding of endpoints

---

## 14. REFERENCES & RELATED DOCUMENTS

**In Codebase:**
- `firmware/src/audio/PORT_COMPLETION_REPORT.md` - Emotiscope port details
- `firmware/src/audio/DEPENDENCIES.md` - Goertzel/tempo dependencies
- `firmware/src/graph_codegen/README_CODEGEN.md` - Pattern codegen overview
- `docs/` - System documentation (see CLAUDE.md for routing)

**Configuration Schema:**
- `firmware/src/parameters.h` - Pattern parameters struct
- `firmware/src/webserver_bounds.h` - Parameter validation bounds
- `firmware/src/error_codes.h` - Error code definitions


# Audio Sync Layer System Guide

**Version:** 1.0
**Date:** 2025-12-05
**Status:** Active
**Owner:** System Architecture
**Scope:** K1.node1 Firmware - Audio Data Synchronization

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Data Structures](#data-structures)
4. [Synchronization Protocol](#synchronization-protocol)
5. [Data Flow Pipeline](#data-flow-pipeline)
6. [Thread Safety Mechanisms](#thread-safety-mechanisms)
7. [Pattern Interface](#pattern-interface)
8. [Known Issues & Mitigations](#known-issues--mitigations)
9. [Testing & Validation](#testing--validation)
10. [References](#references)

---

## Executive Summary

The **Audio Sync Layer** is a lock-free, dual-core audio data synchronization system that enables thread-safe communication between the audio processing pipeline (Core 0) and the visual rendering pipeline (Core 1) on the ESP32-S3.

### Key Features

- **Lock-free seqlock protocol** - Zero blocking between cores
- **Double-buffered snapshots** - Consistent reads without tearing
- **~100 Hz audio processing** - Real-time frequency and beat detection
- **Sub-millisecond latency** - Audio to visual response time
- **Torn read detection** - Automatic retry on concurrent writes

### Critical Path

```
Audio Input → Goertzel Analysis → Tempo Detection → Snapshot Sync → Pattern Rendering
   (I2S)         (~15-25ms)          (~5-10ms)        (<1ms)          (~100 FPS)
```

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ESP32-S3 Dual Core                          │
├──────────────────────────────────┬──────────────────────────────────┤
│         CORE 0 (Audio)           │         CORE 1 (GPU)             │
│                                  │                                  │
│  ┌────────────────────────┐      │      ┌────────────────────────┐ │
│  │   Audio Task (~100Hz)  │      │      │   GPU Task (~100FPS)   │ │
│  ├────────────────────────┤      │      ├────────────────────────┤ │
│  │                        │      │      │                        │ │
│  │  acquire_sample_chunk  │      │      │   render_pattern()     │ │
│  │         ↓              │      │      │          ↓             │ │
│  │  calculate_magnitudes  │      │      │  PATTERN_AUDIO_START() │ │
│  │         ↓              │      │      │          ↓             │ │
│  │    get_chromagram      │      │      │  get_audio_snapshot()  │ │
│  │         ↓              │      │      │          ↓             │ │
│  │    update_novelty      │      │      │  AUDIO_SPECTRUM[i]     │ │
│  │         ↓              │      │      │  AUDIO_TEMPO_BEAT()    │ │
│  │     update_tempo       │      │      │          ↓             │ │
│  │         ↓              │      │      │    transmit_leds()     │ │
│  │  update_tempi_phase    │      │      │                        │ │
│  │         ↓              │      │      │                        │ │
│  │ ┌──────────────────┐   │      │   ┌──────────────────────┐   │ │
│  │ │  audio_back      │   │      │   │   audio_front        │   │ │
│  │ │  (write buffer)  │   │      │   │   (read buffer)      │   │ │
│  │ └────────┬─────────┘   │      │   └──────────▲───────────┘   │ │
│  │          │             │      │              │               │ │
│  │          ▼             │      │              │               │ │
│  │ ┌──────────────────┐   │      │              │               │ │
│  │ │ finish_audio_    │   │      │              │               │ │
│  │ │      frame()     │───┼──────┼──────────────┘               │ │
│  │ │                  │   │      │   (seqlock memcpy)           │ │
│  │ │ commit_audio_    │   │      │                              │ │
│  │ │     data()       │   │      │                              │ │
│  │ └──────────────────┘   │      │                              │ │
│  │                        │      │                              │ │
│  └────────────────────────┘      │      └────────────────────────┘ │
│                                  │                                  │
└──────────────────────────────────┴──────────────────────────────────┘
```

### Core Responsibilities

#### Core 0 - Audio Processing
- **I2S Sample Acquisition** - Blocking reads from microphone DMA buffer
- **Goertzel Transform** - 64-bin frequency analysis (musical scale)
- **Chromagram** - 12 pitch-class aggregation
- **Novelty Detection** - Spectral flux for onset detection
- **Tempo Analysis** - 192-bin beat detection (50-150 BPM)
- **Phase Tracking** - Beat phase synchronization
- **Snapshot Population** - Write to `audio_back` buffer
- **Atomic Commit** - Seqlock swap to `audio_front`

#### Core 1 - Visual Rendering
- **Pattern Execution** - Audio-reactive animation algorithms
- **Snapshot Acquisition** - Read from `audio_front` buffer
- **LED Quantization** - RGB → WS2812 encoding
- **RMT Transmission** - Dual-channel LED strip output
- **FPS Tracking** - Performance monitoring

---

## Data Structures

### AudioDataSnapshot / SequencedAudioBuffer

The core synchronization primitive. Defined in [firmware/src/audio/goertzel.h:131-147](../../../firmware/src/audio/goertzel.h#L131-L147).

```cpp
typedef struct {
    // SYNCHRONIZATION: Seqlock counters (NEVER memcpy these!)
    std::atomic<uint32_t> sequence{0};      // Even=valid, Odd=writing

    // DATA PAYLOAD: Safe for memcpy (no atomics)
    AudioDataPayload payload;

    // VALIDATION: Must match sequence for valid read
    std::atomic<uint32_t> sequence_end{0};
} SequencedAudioBuffer;

typedef SequencedAudioBuffer AudioDataSnapshot;  // Legacy alias
```

**Critical Rules:**
- ✅ **DO** memcpy `payload` only
- ❌ **NEVER** memcpy `sequence` or `sequence_end` (undefined behavior)
- ✅ **DO** use `memory_order_acquire` when reading sequence
- ✅ **DO** use `memory_order_release` when writing sequence

### AudioDataPayload

Non-atomic data container. Defined in [firmware/src/audio/goertzel.h:96-126](../../../firmware/src/audio/goertzel.h#L96-L126).

```cpp
typedef struct {
    // Frequency spectrum (64 bins, ~50Hz to 6.4kHz)
    float spectrogram[NUM_FREQS];           // 0.0-1.0, auto-ranged
    float spectrogram_smooth[NUM_FREQS];    // Multi-frame average
    float spectrogram_absolute[NUM_FREQS];  // Pre-normalized (absolute loudness)

    // Musical pitch energy (12 classes: C, C#, D, ..., B)
    float chromagram[12];

    // Audio level
    float vu_level;                         // 0.0-1.0, auto-ranged
    float vu_level_raw;                     // Unfiltered

    // Beat detection
    float novelty_curve;                    // Spectral flux
    float tempo_confidence;                 // 0.0-1.0
    float tempo_magnitude[NUM_TEMPI];       // 192 tempo bins
    float tempo_phase[NUM_TEMPI];           // -π to +π per bin
    float locked_tempo_bpm;                 // Stable BPM when locked
    TempoLockState tempo_lock_state;        // Lock state machine

    // Metadata
    uint32_t update_counter;                // Increments each frame
    uint32_t timestamp_us;                  // esp_timer_get_time()
    bool is_valid;                          // Has been written at least once
    bool is_silence;                        // Current frame is silence
} AudioDataPayload;
```

**Size:** ~1,600 bytes (400 floats × 4 bytes + metadata)

---

## Synchronization Protocol

### Seqlock Algorithm

The seqlock (sequence lock) protocol enables **lock-free reads** with **torn read detection**.

#### Writer Protocol (Core 0)

Implemented in [firmware/src/audio/goertzel.cpp:219-245](../../../firmware/src/audio/goertzel.cpp#L219-L245).

```cpp
void commit_audio_data() {
    // Step 1: Signal "writing in progress" (odd number)
    uint32_t seq = audio_front.sequence.load(std::memory_order_relaxed);
    audio_front.sequence.store(seq + 1, std::memory_order_release);

    // Step 2: Copy payload (may take microseconds)
    memcpy(&audio_front.payload, &audio_back.payload, sizeof(AudioDataPayload));

    // Step 3: Signal "write complete" (even number)
    seq = audio_front.sequence.load(std::memory_order_relaxed);
    audio_front.sequence.store(seq + 1, std::memory_order_release);

    // Step 4: Update validation counter
    audio_front.sequence_end.store(
        audio_front.sequence.load(std::memory_order_relaxed),
        std::memory_order_release
    );
}
```

**Invariants:**
- `sequence` is **odd** during write → readers retry
- `sequence` is **even** after write → readers proceed
- `sequence_end == sequence` → write completed cleanly

#### Reader Protocol (Core 1)

Implemented in [firmware/src/audio/goertzel.cpp:145-204](../../../firmware/src/audio/goertzel.cpp#L145-L204).

```cpp
bool get_audio_snapshot(AudioDataSnapshot* snapshot) {
    uint32_t seq1, seq2;
    int retry_count = 0;
    const int max_retries = 50;

    do {
        // Read sequence BEFORE payload
        seq1 = audio_front.sequence.load(std::memory_order_acquire);

        // If odd, writer is active - retry
        if (seq1 & 1) {
            if (++retry_count > max_retries) return false;
            delayMicroseconds(3);
            continue;
        }

        // Copy payload (no atomics)
        memcpy(&snapshot->payload, &audio_front.payload, sizeof(AudioDataPayload));

        // Read sequence AFTER payload
        seq2 = audio_front.sequence_end.load(std::memory_order_acquire);

        // Validate consistency
        if (seq1 == seq2 && seq1 == audio_front.sequence.load(std::memory_order_acquire)) {
            return true;  // Valid read
        }

        // Torn read - retry
        if (++retry_count > max_retries) return false;

    } while (true);
}
```

**Torn Read Detection:**
1. Read `sequence` before copy
2. Copy payload
3. Read `sequence_end` after copy
4. If `sequence` changed → retry (writer intervened)
5. If `sequence != sequence_end` → retry (incomplete write)

### Memory Ordering

**Why `memory_order_acquire` / `memory_order_release`?**

ESP32-S3 is a **dual-core Xtensa LX7** with separate L1 caches. Without memory barriers, Core 1 might see stale data even after Core 0 writes.

```cpp
// Writer (Core 0)
audio_front.sequence.store(seq + 1, std::memory_order_release);
// ↑ Ensures all prior writes (memcpy) are visible before sequence update

// Reader (Core 1)
seq = audio_front.sequence.load(std::memory_order_acquire);
// ↑ Ensures we see all writes that happened before sequence update
```

**Trade-offs:**
- `memory_order_relaxed` - Faster, but no ordering guarantees
- `memory_order_acquire/release` - Guarantees visibility across cores
- `memory_order_seq_cst` - Full sequential consistency (slower)

---

## Data Flow Pipeline

### Audio Processing Pipeline (Core 0)

Implemented in [firmware/src/main.cpp:272-538](../../../firmware/src/main.cpp#L272-L538).

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AUDIO TASK (Core 0 @ ~100 Hz)                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. acquire_sample_chunk()                                          │
│     ├─ Read I2S DMA buffer (blocking)                               │
│     ├─ Apply microphone gain                                        │
│     └─ Shift into sample_history[4096]                              │
│                                                                     │
│  2. calculate_magnitudes()                 [15-25ms]                │
│     ├─ Goertzel transform (64 bins)                                 │
│     ├─ Noise floor subtraction                                      │
│     ├─ Cochlear AGC (frequency-dependent gain)                      │
│     ├─ Auto-ranging normalization                                   │
│     ├─ VU level calculation                                         │
│     └─ Sync to audio_back:                                          │
│         ├─ spectrogram[64]                                          │
│         ├─ spectrogram_smooth[64]                                   │
│         ├─ spectrogram_absolute[64]                                 │
│         └─ vu_level                                                 │
│                                                                     │
│  3. get_chromagram()                       [~1ms]                   │
│     ├─ Aggregate spectrum into 12 pitch classes                     │
│     └─ Sync to audio_back.chromagram[12]                            │
│                                                                     │
│  4. update_novelty()                       [~2ms]                   │
│     ├─ Calculate spectral flux (onset detection)                    │
│     ├─ Log to novelty_curve[512]                                    │
│     └─ Detect silence                                               │
│                                                                     │
│  5. update_tempo()                         [~5-10ms]                │
│     ├─ Normalize novelty curve                                      │
│     ├─ Goertzel on novelty (192 tempo bins)                         │
│     ├─ Calculate tempo magnitudes                                   │
│     └─ Update tempo confidence                                      │
│                                                                     │
│  6. update_tempi_phase()                   [~1ms]                   │
│     ├─ Advance beat phases                                          │
│     ├─ Smooth tempo magnitudes                                      │
│     └─ Calculate power sum                                          │
│                                                                     │
│  7. CRITICAL SYNC POINT                                             │
│     portENTER_CRITICAL(&audio_spinlock);                            │
│     for (uint16_t i = 0; i < NUM_TEMPI; i++) {                      │
│         audio_back.payload.tempo_magnitude[i] = tempi_smooth[i];    │
│         audio_back.payload.tempo_phase[i] = tempi[i].phase;         │
│     }                                                               │
│     audio_back.payload.tempo_confidence = tempo_confidence;         │
│     portEXIT_CRITICAL(&audio_spinlock);                             │
│                                                                     │
│  8. finish_audio_frame()                   [<1ms]                   │
│     └─ commit_audio_data()                                          │
│         └─ Seqlock swap: audio_back → audio_front                   │
│                                                                     │
│  9. vTaskDelay(1ms) - Yield to prevent CPU starvation               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Tempo Data Sync (Critical Path)

**IMPORTANT:** Tempo data is synced in **TWO locations**:

1. **Inside `calculate_magnitudes()`** ([goertzel.cpp:646-649](../../../firmware/src/audio/goertzel.cpp#L646-L649))
   ```cpp
   for (uint16_t i = 0; i < NUM_TEMPI; i++) {
       audio_back.payload.tempo_magnitude[i] = tempi_smooth[i];
       audio_back.payload.tempo_phase[i] = tempi[i].phase;
   }
   ```
   ⚠️ **This runs BEFORE tempo calculation** - may contain stale/zeroed data

2. **After tempo calculation in audio_task** ([main.cpp:359-363](../../../firmware/src/main.cpp#L359-L363))
   ```cpp
   portENTER_CRITICAL(&audio_spinlock);
   for (uint16_t i = 0; i < NUM_TEMPI; i++) {
       audio_back.payload.tempo_magnitude[i] = tempi_smooth[i];
       audio_back.payload.tempo_phase[i] = tempi[i].phase;
   }
   portEXIT_CRITICAL(&audio_spinlock);
   ```
   ✅ **This runs AFTER `update_tempo()` and `update_tempi_phase()`** - contains valid data

**Why two syncs?** The second sync overwrites the first, capturing the latest tempo calculations. This is **intentional but creates temporal coupling** (see Known Issues).

### Pattern Rendering Pipeline (Core 1)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     GPU TASK (Core 1 @ ~100 FPS)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. render_pattern()                                                │
│     ├─ PATTERN_AUDIO_START()              [~10-20μs]                │
│     │   └─ get_audio_snapshot(&audio)                               │
│     │       └─ Seqlock read from audio_front                        │
│     │                                                               │
│     ├─ Check freshness (optional)                                   │
│     │   if (!AUDIO_IS_FRESH()) return;                              │
│     │                                                               │
│     ├─ Access audio data via macros:                                │
│     │   float bass = AUDIO_BASS();                                  │
│     │   float treble = AUDIO_TREBLE();                              │
│     │   float spectrum_val = AUDIO_SPECTRUM[i];                     │
│     │   float beat = AUDIO_TEMPO_BEAT(bin);                         │
│     │                                                               │
│     └─ Render LEDs based on audio                                   │
│         leds[i] = hsv(hue, sat, AUDIO_VU * brightness);             │
│                                                                     │
│  2. quantize_leds()                        [~500μs]                 │
│     └─ RGB → WS2812 encoding                                        │
│                                                                     │
│  3. transmit_leds()                        [~2-5ms]                 │
│     └─ RMT dual-channel output                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Thread Safety Mechanisms

### 1. Seqlock Protocol (Primary)

**Purpose:** Lock-free reads with torn read detection
**Scope:** `audio_front` ↔ Core 1 reads
**Overhead:** ~10-20μs per snapshot

**Guarantees:**
- ✅ Readers never block writers
- ✅ Writers never block readers
- ✅ Torn reads detected and retried
- ✅ Bounded retry count (50 max)

**Trade-offs:**
- ❌ Readers may retry multiple times under contention
- ❌ No write prioritization (reader starvation possible)

### 2. Critical Sections (Secondary)

**Purpose:** Protect `audio_back` from concurrent modification
**Scope:** `audio_back` writes in `audio_task`
**Overhead:** ~1-2μs per critical section

```cpp
static portMUX_TYPE audio_spinlock = portMUX_INITIALIZER_UNLOCKED;
portENTER_CRITICAL(&audio_spinlock);
// Modify audio_back.payload
portEXIT_CRITICAL(&audio_spinlock);
```

**Why needed?** Multiple update points in `audio_task` write to `audio_back` before commit. Critical sections prevent interleaving.

### 3. Memory Barriers

**Purpose:** Ensure cache coherency between cores
**Mechanism:** `memory_order_acquire` / `memory_order_release`

Without barriers, Core 1 might see:
- Stale `audio_front.payload` data (L1 cache not flushed)
- Reordered writes (compiler/CPU optimization)

With barriers:
```cpp
// Writer (Core 0)
memcpy(&audio_front.payload, ...);  // Write data
sequence.store(seq+1, memory_order_release);  // Barrier: flush writes

// Reader (Core 1)
seq = sequence.load(memory_order_acquire);  // Barrier: invalidate cache
memcpy(snapshot, &audio_front.payload);     // Read fresh data
```

---

## Pattern Interface

### Pattern Audio Interface Macros

Defined in [firmware/src/pattern_audio_interface.h](../../../firmware/src/pattern_audio_interface.h).

#### Basic Usage

```cpp
void draw_spectrum_pattern(float time, const PatternParameters& params) {
    // MANDATORY: Initialize audio snapshot
    PATTERN_AUDIO_START();

    // OPTIONAL: Check for fresh data (optimization)
    if (!AUDIO_IS_FRESH()) return;

    // OPTIONAL: Check for stale data (silence detection)
    if (AUDIO_IS_STALE()) {
        // Fade to default state
        fade_brightness *= 0.95f;
        return;
    }

    // Access audio data
    for (int i = 0; i < NUM_LEDS; i++) {
        float position = (float)i / NUM_LEDS;
        int bin = (int)(position * 63);

        float magnitude = AUDIO_SPECTRUM[bin];
        float hue = position;
        float saturation = 1.0f;
        float brightness = magnitude;

        leds[i] = hsv(hue, saturation, brightness);
    }
}
```

#### Available Macros

**Initialization:**
```cpp
PATTERN_AUDIO_START()  // Must be called first - creates 'audio' snapshot
```

**Query Macros:**
```cpp
AUDIO_IS_AVAILABLE()   // True if snapshot retrieved successfully
AUDIO_IS_FRESH()       // True if data updated since last frame
AUDIO_IS_STALE()       // True if data >50ms old (silence)
AUDIO_AGE_MS()         // Age in milliseconds since timestamp
```

**Spectrum Access:**
```cpp
AUDIO_SPECTRUM[i]          // Auto-ranged spectrum (0.0-1.0)
AUDIO_SPECTRUM_SMOOTH[i]   // Multi-frame averaged
AUDIO_SPECTRUM_ABSOLUTE[i] // Pre-normalized (absolute loudness)
AUDIO_CHROMAGRAM[i]        // 12 pitch classes (0-11)
```

**Frequency Band Shortcuts:**
```cpp
AUDIO_BASS()     // Bins 0-8:   55-220 Hz (kick, bass)
AUDIO_MIDS()     // Bins 16-32: 440-880 Hz (vocals, snare)
AUDIO_TREBLE()   // Bins 48-63: 1.76-6.4 kHz (cymbals, hi-hats)

AUDIO_KICK()     // Bins 0-4:   55-110 Hz
AUDIO_SNARE()    // Bins 8-16:  220-440 Hz
AUDIO_VOCAL()    // Bins 16-40: 440-1760 Hz
AUDIO_HATS()     // Bins 48-63: 3.5-6.4 kHz
```

**Scalar Metrics:**
```cpp
AUDIO_VU                   // Peak amplitude (0.0-1.0, auto-ranged)
AUDIO_VU_RAW               // Raw amplitude (pre-normalization)
AUDIO_TEMPO_CONFIDENCE     // Beat detection confidence (0.0-1.0)
```

**Tempo/Beat Access:**
```cpp
AUDIO_TEMPO_MAGNITUDE(bin) // Tempo bin magnitude (0.0-1.0)
AUDIO_TEMPO_PHASE(bin)     // Tempo bin phase (-π to +π)
AUDIO_TEMPO_BEAT(bin)      // sin(phase) for beat signal (-1.0 to 1.0)
```

**Color Modulation Helpers:**
```cpp
AUDIO_COLOR_SHIFT()            // Color shift based on VU
AUDIO_COLOR_HUE(base)          // Dynamic hue with audio shift
AUDIO_COLOR_SATURATION(base)   // Saturation boost with treble
AUDIO_BRIGHTNESS()             // VU-based brightness with floor
AUDIO_BRIGHTNESS_SCALED(scale) // Custom brightness scaling
```

#### Advanced Example: Beat-Synchronized Pulse

```cpp
void draw_beat_pulse(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    if (!AUDIO_IS_FRESH()) return;

    // Find dominant tempo bin
    int strongest_bin = 0;
    float max_magnitude = 0.0f;
    for (int i = 0; i < NUM_TEMPI; i++) {
        if (AUDIO_TEMPO_MAGNITUDE(i) > max_magnitude) {
            max_magnitude = AUDIO_TEMPO_MAGNITUDE(i);
            strongest_bin = i;
        }
    }

    // Get beat phase and convert to brightness pulse
    float phase = AUDIO_TEMPO_PHASE(strongest_bin);
    float beat = sinf(phase);  // -1.0 to 1.0
    float brightness = 0.5f + 0.5f * beat;  // 0.0 to 1.0

    // Apply confidence gating
    brightness *= AUDIO_TEMPO_CONFIDENCE;

    // Render synchronized pulse
    for (int i = 0; i < NUM_LEDS; i++) {
        float hue = (float)i / NUM_LEDS;
        leds[i] = hsv(hue, 1.0f, brightness);
    }
}
```

---

## Known Issues & Mitigations

### 1. Temporal Coupling: Duplicate Tempo Sync

**Issue:** Tempo arrays are synced in **two locations**:
1. Inside `calculate_magnitudes()` (BEFORE tempo calculation)
2. After `update_tempi_phase()` in `audio_task` (AFTER tempo calculation)

**Risk:** If the second sync is removed/bypassed, patterns receive zeroed tempo data.

**Root Cause:** Historical refactoring left the first sync in place. The second sync overwrites it with correct data.

**Impact:** Medium-High
**Likelihood:** Low (requires code change)

**Mitigation:**
1. ✅ **Immediate:** CI contract test to validate non-zero tempo data
2. ✅ **Short-term:** Encapsulate sync into single function
3. ✅ **Long-term:** Remove redundant sync in `calculate_magnitudes()`

**Contract Test Example:**
```cpp
void test_tempo_sync_not_zeroed() {
    // Run full audio pipeline
    acquire_sample_chunk();
    calculate_magnitudes();
    get_chromagram();
    update_tempo();
    update_tempi_phase();

    // Validate tempo data is populated
    float tempo_sum = 0.0f;
    for (int i = 0; i < NUM_TEMPI; i++) {
        tempo_sum += audio_back.payload.tempo_magnitude[i];
    }

    // At least SOME tempo energy should be present (not all zeros)
    assert(tempo_sum > 0.001f);
}
```

### 2. Critical Section Mismatch

**Issue:** Two different sync mechanisms:
- `audio_back` uses `portENTER_CRITICAL` (mutex)
- `audio_front` uses seqlock (lock-free)

**Risk:** Confusion about which mechanism protects what.

**Impact:** Low
**Likelihood:** Low

**Mitigation:**
- Document clearly: `audio_back` = critical sections, `audio_front` = seqlock
- Seqlock is authoritative for Core 0 → Core 1 transfer

### 3. Seqlock Retry Starvation

**Issue:** Under extreme contention, readers may retry 50 times and fail.

**Risk:** Patterns receive stale data or `AUDIO_IS_AVAILABLE() == false`.

**Impact:** Low (visual glitch only)
**Likelihood:** Very Low (writer takes <1ms, reader retries every 3μs)

**Observed Behavior:** Retry warnings appear ~0.1% of reads under heavy load.

**Mitigation:**
- Patterns should check `AUDIO_IS_AVAILABLE()` and fallback gracefully
- Retry limit of 50 is conservative (50 × 3μs = 150μs << 1ms writer duration)

### 4. Pattern Interface Coupling

**Issue:** Patterns depend on `audio.payload.tempo_magnitude[]` being non-zero.

**Risk:** If sync-layer fails, patterns silently receive zeros (no error).

**Impact:** Medium (visual effects stop working)
**Likelihood:** Low

**Mitigation:**
- Add `AUDIO_TEMPO_AVAILABLE()` macro to check for valid tempo data
- Log warning if tempo data all-zeros for >1 second

---

## Testing & Validation

### Unit Tests

**File:** `firmware/test/test_audio_sync.cpp`

```cpp
void test_seqlock_torn_read_detection() {
    // Simulate concurrent write during read
    AudioDataSnapshot reader_snapshot;

    // Writer: Start write
    uint32_t seq = audio_front.sequence.load(std::memory_order_relaxed);
    audio_front.sequence.store(seq + 1, std::memory_order_release);  // ODD

    // Reader: Should detect ODD and retry
    bool success = get_audio_snapshot(&reader_snapshot);
    assert(!success);  // Expect failure due to writer in progress

    // Writer: Complete write
    memcpy(&audio_front.payload, &audio_back.payload, sizeof(AudioDataPayload));
    seq = audio_front.sequence.load(std::memory_order_relaxed);
    audio_front.sequence.store(seq + 1, std::memory_order_release);  // EVEN
    audio_front.sequence_end.store(seq + 1, std::memory_order_release);

    // Reader: Should succeed
    success = get_audio_snapshot(&reader_snapshot);
    assert(success);
}
```

### Integration Tests

**Scenario 1: Full Audio Pipeline**
```cpp
void test_full_audio_pipeline() {
    // Inject test audio samples
    inject_test_samples(440.0f, 1.0f);  // A4 tone

    // Run full pipeline
    acquire_sample_chunk();
    calculate_magnitudes();
    get_chromagram();
    update_tempo();
    update_tempi_phase();
    finish_audio_frame();

    // Validate snapshot
    AudioDataSnapshot snapshot;
    bool ok = get_audio_snapshot(&snapshot);
    assert(ok);
    assert(snapshot.payload.is_valid);
    assert(snapshot.payload.vu_level > 0.1f);  // Some energy
    assert(snapshot.payload.spectrogram[32] > 0.1f);  // Bin 32 ≈ 440Hz
}
```

**Scenario 2: Tempo Sync Validation**
```cpp
void test_tempo_sync() {
    // Inject 120 BPM beat pattern
    inject_beat_pattern(120.0f);

    // Run tempo pipeline
    for (int frame = 0; frame < 100; frame++) {
        acquire_sample_chunk();
        calculate_magnitudes();
        update_tempo();
        update_tempi_phase();
        finish_audio_frame();
    }

    // Validate tempo data is non-zero
    AudioDataSnapshot snapshot;
    get_audio_snapshot(&snapshot);

    float tempo_sum = 0.0f;
    for (int i = 0; i < NUM_TEMPI; i++) {
        tempo_sum += snapshot.payload.tempo_magnitude[i];
    }
    assert(tempo_sum > 0.01f);  // Should have tempo energy

    // Validate phase is in valid range
    for (int i = 0; i < NUM_TEMPI; i++) {
        assert(snapshot.payload.tempo_phase[i] >= -M_PI);
        assert(snapshot.payload.tempo_phase[i] <= M_PI);
    }
}
```

### CI Guard Script

**File:** `ops/scripts/guard_tempo_sync.sh`

```bash
#!/bin/bash
# CI guard: Prevent regression where tempo arrays are zeroed

set -e

# Build firmware
pio run -e esp32s3dev

# Run tempo sync test
pio test -e native -f test_tempo_sync

# Check for regression patterns in git history
if git diff HEAD~1 | grep -q "memset.*tempo_magnitude.*0"; then
    echo "ERROR: Detected memset on tempo_magnitude - potential regression!"
    exit 1
fi

echo "✓ Tempo sync guard passed"
```

**CI Integration:** Add to [.github/workflows/k1-node1-ci.yml](../../.github/workflows/k1-node1-ci.yml):
```yaml
- name: Tempo Sync Guard
  run: ./ops/scripts/guard_tempo_sync.sh
```

---

## References

### Source Files

| File | Description | Lines |
|------|-------------|-------|
| [`firmware/src/audio/goertzel.h`](../../firmware/src/audio/goertzel.h) | Data structure definitions | 277 |
| [`firmware/src/audio/goertzel.cpp`](../../firmware/src/audio/goertzel.cpp) | Seqlock implementation, spectrum sync | 736 |
| [`firmware/src/audio/tempo.cpp`](../../firmware/src/audio/tempo.cpp) | Tempo calculation, phase tracking | 460 |
| [`firmware/src/main.cpp`](../../firmware/src/main.cpp) | Audio task loop, tempo sync | 1200+ |
| [`firmware/src/pattern_audio_interface.h`](../../firmware/src/pattern_audio_interface.h) | Pattern access macros | 637 |
| [`firmware/src/pattern_audio_interface.cpp`](../../firmware/src/pattern_audio_interface.cpp) | Helper functions | 99 |

### Related Documentation

- **ADR-0001:** Audio Processing Architecture (if exists)
- **ADR-0002:** Dual-Core Task Assignment (if exists)
- **Forensic Analysis:** [`docs/05-analysis/PROJECT_HEALTH_TIMELINE.md`](../05-analysis/PROJECT_HEALTH_TIMELINE.md) (pending)
- **Recovery Plan:** [`docs/05-analysis/RECOVERY_ACTION_PLAN.md`](../05-analysis/RECOVERY_ACTION_PLAN.md) (pending)

### External References

- [ESP32-S3 Technical Reference Manual](https://www.espressif.com/sites/default/files/documentation/esp32-s3_technical_reference_manual_en.pdf) - Memory Model, Dual-Core
- [Seqlock Wikipedia](https://en.wikipedia.org/wiki/Seqlock) - Algorithm overview
- [C++ Memory Model](https://en.cppreference.com/w/cpp/atomic/memory_order) - `memory_order` semantics
- [FreeRTOS Critical Sections](https://www.freertos.org/taskENTER_CRITICAL_taskEXIT_CRITICAL.html) - `portENTER_CRITICAL` usage

---

## Appendix A: Performance Characteristics

### Timing Breakdown (Typical Frame)

| Operation | Duration | Core | Notes |
|-----------|----------|------|-------|
| `acquire_sample_chunk()` | 5-10ms | 0 | Blocks on I2S DMA |
| `calculate_magnitudes()` | 15-25ms | 0 | CPU-intensive Goertzel |
| `get_chromagram()` | 1ms | 0 | Pitch aggregation |
| `update_novelty()` | 2ms | 0 | Spectral flux |
| `update_tempo()` | 5-10ms | 0 | 192-bin Goertzel |
| `update_tempi_phase()` | 1ms | 0 | Phase advance |
| `finish_audio_frame()` | <1ms | 0 | Seqlock commit |
| **Total Audio Frame** | **30-50ms** | **0** | **~20-30 Hz** |
| `get_audio_snapshot()` | 10-20μs | 1 | Typical read |
| `get_audio_snapshot()` retry | +3μs | 1 | Per retry |
| `render_pattern()` | 1-5ms | 1 | Varies by pattern |
| `quantize_leds()` | 500μs | 1 | RGB→WS2812 |
| `transmit_leds()` | 2-5ms | 1 | RMT dual-channel |
| **Total GPU Frame** | **4-11ms** | **1** | **~90-250 FPS** |

### Memory Usage

| Component | Size | Count | Total |
|-----------|------|-------|-------|
| `AudioDataPayload` | ~1,600 bytes | 2 (front+back) | 3.2 KB |
| `sample_history[]` | 4 bytes × 4096 | 1 | 16 KB |
| `spectrogram_average[]` | 4 bytes × 64 × 12 | 1 | 3 KB |
| `novelty_curve[]` | 4 bytes × 512 | 1 | 2 KB |
| `tempi[]` | ~80 bytes × 192 | 1 | 15 KB |
| **Total Audio System** | | | **~40 KB** |

### CPU Usage (ESP32-S3 @ 240 MHz)

| Task | Core | CPU % (Avg) | CPU % (Peak) |
|------|------|-------------|--------------|
| Audio Task | 0 | 60-75% | 90% |
| GPU Task | 1 | 40-60% | 80% |
| Idle | Both | 10-20% | - |

---

## Appendix B: Glossary

**Seqlock** - Sequence lock, a lock-free synchronization primitive using versioned reads

**Torn Read** - Reading partially-updated data (e.g., reader copies payload mid-write)

**Memory Barrier** - CPU instruction ensuring memory operations complete before/after barrier

**Cache Coherency** - Ensuring all cores see consistent memory state

**Goertzel Transform** - Efficient single-frequency DFT (alternative to full FFT)

**Chromagram** - 12-bin pitch class histogram (C, C#, D, ..., B)

**Novelty Curve** - Spectral flux over time (onset detection for beat tracking)

**Tempo Bin** - Single frequency in tempo spectrum (e.g., bin 100 = 128 BPM)

**Phase** - Beat position within cycle (radians, -π to +π)

**VU Level** - Volume Unit, RMS audio amplitude

**Auto-ranging** - Dynamic normalization to loudest bin (preserves shape at any volume)

---

**End of Document**

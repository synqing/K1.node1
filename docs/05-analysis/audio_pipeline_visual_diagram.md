# Audio Pipeline Visual Diagrams

## Complete Data Flow: Hardware to LEDs

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         CORE 1: AUDIO PROCESSING                              │
└──────────────────────────────────────────────────────────────────────────────┘

   SPH0645          ESP32-S3          DMA             RAM
   MEMS Mic         I2S0 RX           Engine          Buffer
   ┌─────┐         ┌─────┐         ┌─────┐         ┌─────┐
   │     │ I2S     │     │ DMA     │     │ Write   │ Raw │
   │ PDM │────────>│ RX  │────────>│ Ctrl│────────>│ Buf │
   │     │ 18-bit  │     │ 32-bit  │     │ 512B    │     │
   └─────┘         └─────┘         └─────┘         └─────┘
      │                                                 │
      │ Right Channel Only                             │
      │ 16kHz Sample Rate                              │
      │ Standard I2S (NOT PDM)                         │
      └──> GPIO 14 (BCLK), 12 (LRCLK), 13 (DIN) <─────┘

                         ↓ i2s_channel_read()
                         ↓ portMAX_DELAY (blocks 8ms)
                         ↓

   ┌───────────────────────────────────────────────────────────────┐
   │ new_samples_raw[128] (uint32_t buffer)                        │
   │   ┌────────────────────────────────────────────────┐          │
   │   │ Sample Conversion (microphone.cpp:94-98)       │          │
   │   │   1. Extract bits [31:14] via >> 14            │          │
   │   │   2. Add 7000 DC offset correction             │          │
   │   │   3. Clamp to [-131072, 131072]                │          │
   │   │   4. Subtract 360 secondary bias               │          │
   │   │   5. Normalize: × (1/131072) → [-1.0, +1.0]    │          │
   │   └────────────────────────────────────────────────┘          │
   └───────────────────────────────────────────────────────────────┘
                         ↓ dsps_mulc_f32()
                         ↓

   ┌───────────────────────────────────────────────────────────────┐
   │ new_samples[128] (float, normalized)                          │
   └───────────────────────────────────────────────────────────────┘
                         ↓ shift_and_copy_arrays()
                         ↓

   ┌───────────────────────────────────────────────────────────────┐
   │ sample_history[4096] (256ms ring buffer)                      │
   │   ┌─────────────────────────────────────────────────┐         │
   │   │ Newest 128 samples appended to end              │         │
   │   │ Oldest 128 samples shifted out                  │         │
   │   │ Windowing applied via window_lookup[4096]       │         │
   │   │ (Gaussian, σ=0.8)                               │         │
   │   └─────────────────────────────────────────────────┘         │
   └───────────────────────────────────────────────────────────────┘
                         ↓ calculate_magnitudes()
                         ↓ (15-25ms Goertzel DFT)
                         ↓

   ┌───────────────────────────────────────────────────────────────┐
   │ For each bin i (0..63):                                       │
   │   ┌─────────────────────────────────────────────────┐         │
   │   │ calculate_magnitude_of_bin(i)                   │         │
   │   │   - Block size varies by frequency (64-4095)    │         │
   │   │   - Goertzel IIR filter: q0 = coeff*q1 - q2    │         │
   │   │   - magnitude = sqrt(q1² + q2² - q1*q2*coeff)  │         │
   │   │   - Windowed samples: sample * window_lookup    │         │
   │   └─────────────────────────────────────────────────┘         │
   │                                                                │
   │ magnitudes_raw[64] → 6-sample moving avg → magnitudes_smooth  │
   │                                                                │
   │ max_val = max(magnitudes_smooth[0..63])                       │
   │ max_val_smooth (exponential: α=0.005 attack/decay)            │
   │ autoranger_scale = 1.0 / max_val_smooth                       │
   │                                                                │
   │ spectrogram[i] = clip(magnitudes_smooth[i] * autoranger_scale)│
   │ spectrogram_absolute[i] = spectrogram[i] (pre-gain)           │
   │ spectrogram[i] *= configuration.microphone_gain (0.5-2.0x)    │
   │                                                                │
   │ vu_level = average(spectrogram[0..63])                        │
   └───────────────────────────────────────────────────────────────┘
                         ↓ Copy to audio_back
                         ↓

   ┌───────────────────────────────────────────────────────────────┐
   │ audio_back buffer (AudioDataSnapshot)                         │
   │   - spectrogram[64] ← spectrogram[]                           │
   │   - spectrogram_smooth[64] ← spectrogram_smooth[]             │
   │   - spectrogram_absolute[64] ← spectrogram_absolute[]         │
   │   - chromagram[12] ← chromagram[]                             │
   │   - vu_level ← vu_level_calculated                            │
   │   - vu_level_raw ← vu_level * max_val_smooth                  │
   │   - tempo_magnitude[64] ← tempi[].magnitude                   │
   │   - tempo_phase[64] ← tempi[].phase                           │
   │   - tempo_confidence ← tempo_confidence                        │
   │   - update_counter++                                           │
   │   - timestamp_us ← esp_timer_get_time()                       │
   │   - is_valid = true                                            │
   └───────────────────────────────────────────────────────────────┘
                         ↓ finish_audio_frame()
                         ↓ → commit_audio_data()
                         ↓

   ╔═══════════════════════════════════════════════════════════════╗
   ║ ❌ CRITICAL BUG: commit_audio_data() (goertzel.cpp:200)       ║
   ║                                                                ║
   ║ memcpy(&audio_front, &audio_back, sizeof(AudioDataSnapshot)); ║
   ║        ↑↑↑ Overwrites atomic sequence counters!               ║
   ║                                                                ║
   ║ Expected: Copy data fields only, preserve sequence protocol   ║
   ║ Actual: Copies entire struct including atomics → corruption   ║
   ╚═══════════════════════════════════════════════════════════════╝
                         ↓ (Broken synchronization)
                         ↓

   ┌───────────────────────────────────────────────────────────────┐
   │ audio_front buffer (should contain fresh data)                │
   │                                                                │
   │ ACTUAL STATE: Frozen at initialization values                 │
   │   - spectrogram[] = 0.0 or stale values                       │
   │   - vu_level = 0.0                                             │
   │   - tempo_confidence = 0.0                                     │
   │   - update_counter never changes                               │
   │   - sequence counters desynchronized                           │
   └───────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────┐
│                         CORE 0: GPU/PATTERN RENDERING                         │
└──────────────────────────────────────────────────────────────────────────────┘

   Pattern Function
   ┌────────────────────────────────────────────────────────┐
   │ void draw_pattern(float time, const PatternParams& p) │
   │                                                         │
   │   PATTERN_AUDIO_START();  // Macro expansion:         │
   │   ↓                                                     │
   │   AudioDataSnapshot audio{};                           │
   │   bool audio_available = get_audio_snapshot(&audio);  │
   │   ↓                                                     │
   │   ┌─────────────────────────────────────────┐         │
   │   │ get_audio_snapshot() attempts to read   │         │
   │   │ audio_front with retry logic:           │         │
   │   │                                          │         │
   │   │ do {                                     │         │
   │   │   seq1 = audio_front.sequence.load();   │         │
   │   │   memcpy(snapshot, &audio_front, ...);  │         │
   │   │   seq2 = audio_front.sequence_end;      │         │
   │   │ } while (seq1 != seq2 || ...);         │         │
   │   │                                          │         │
   │   │ RESULT: Either infinite retry OR        │         │
   │   │         gets stale initialization data   │         │
   │   └─────────────────────────────────────────┘         │
   │                                                         │
   │   ❌ audio_available = false OR audio frozen          │
   │   ❌ audio_is_fresh = false (never updates)           │
   │                                                         │
   │   float bass = AUDIO_BASS();  // Returns 0.0          │
   │   float vu = AUDIO_VU;        // Returns 0.0          │
   │                                                         │
   │   // Pattern renders with NO audio data               │
   │   for (int i = 0; i < NUM_LEDS; i++) {                │
   │     leds[i] = CRGBF(0, 0, 0);  // Dark (no response) │
   │   }                                                     │
   └────────────────────────────────────────────────────────┘
                         ↓
   ┌────────────────────────────────────────────────────────┐
   │ LEDs: No audio reactivity                              │
   │   - Spectrum display: flat/dark                        │
   │   - VU meter: no response                              │
   │   - Beat pulse: no trigger (uses separate path, works) │
   └────────────────────────────────────────────────────────┘
```

---

## Synchronization Protocol: Expected vs Actual

### Expected Lock-Free Protocol (Correct)

```
WRITER (Core 1):                         READER (Core 0):
┌──────────────────────┐                ┌──────────────────────┐
│ commit_audio_data()  │                │ get_audio_snapshot() │
│                      │                │                      │
│ 1. seq = front.seq   │                │ 1. seq1 = front.seq  │
│    (currently EVEN)  │                │    (must be EVEN)    │
│                      │                │                      │
│ 2. front.seq = seq+1 │                │ 2. barrier()         │
│    (now ODD = write) │                │                      │
│                      │                │ 3. memcpy(snapshot)  │
│ 3. barrier()         │                │                      │
│                      │                │ 4. barrier()         │
│ 4. Copy data fields  │                │                      │
│    (NOT atomics!)    │                │ 5. seq2 = front.end  │
│                      │                │                      │
│ 5. barrier()         │                │ 6. Validate:         │
│                      │                │    - seq1 == seq2?   │
│ 6. front.seq = seq+2 │                │    - seq1 even?      │
│    (now EVEN = valid)│                │    - seq unchanged?  │
│                      │                │                      │
│ 7. front.end = seq+2 │                │ 7. If valid: return  │
│                      │                │    Else: RETRY       │
│ 8. is_valid = true   │                │                      │
└──────────────────────┘                └──────────────────────┘

KEY INVARIANT: front.sequence MUST NOT be overwritten during copy!
Writer controls sequence transitions: EVEN → ODD → EVEN
Reader detects ODD (mid-write) and retries.
```

### Actual Implementation (BROKEN)

```
WRITER (Core 1):
┌──────────────────────────────────────────────────────────────┐
│ commit_audio_data()                                          │
│                                                              │
│ 1. seq = audio_front.sequence.load()                        │
│    → seq = 0 (initial state)                                │
│                                                              │
│ 2. audio_front.sequence.store(seq + 1)                      │
│    → front.sequence = 1 (ODD, writing)                      │
│                                                              │
│ 3. barrier()                                                 │
│                                                              │
│ 4. ❌ memcpy(&audio_front, &audio_back, 1308 bytes)         │
│    ↑↑↑ Copies ENTIRE struct including:                      │
│        - audio_back.sequence (still 0 from init)            │
│        - audio_back.sequence_end (undefined)                │
│                                                              │
│    AFTER MEMCPY:                                             │
│    → front.sequence = 0 (EVEN! Looks valid but mid-write!) │
│    → Reader sees EVEN sequence, reads PARTIAL data!         │
│                                                              │
│ 5. Attempt to restore: back_seq = audio_back.sequence       │
│    → back_seq = 0 (stale)                                   │
│    → front.sequence = 1 (ODD again)                         │
│                                                              │
│ 6. seq = front.sequence.load() → seq = 1                   │
│    → front.sequence = 2 (EVEN)                              │
│    → front.sequence_end = 2                                 │
│                                                              │
│ On SECOND call:                                              │
│ - front.sequence = 2 (from previous)                        │
│ - Store 3 (ODD)                                              │
│ - Memcpy OVERWRITES with back.sequence = 0 (still stale!)  │
│ - Restores to 1 (out of order!)                             │
│ - Final sequence = 2 (but should be 4!)                     │
│                                                              │
│ Result: Sequence numbers become desynchronized              │
│         Readers never see consistent seq1 == seq2           │
└──────────────────────────────────────────────────────────────┘
```

---

## Bit-Level Sample Format

### SPH0645 I2S 32-bit Word Layout

```
Bit Position:  31 30 29 28 27 26 25 24 23 22 21 20 19 18 17 16 15 14 13 12 11 10  9  8  7  6  5  4  3  2  1  0
              ├──────────────────────────────────────────────────────────┼──────────────────────────────────────┤
              │              18-bit PCM Audio Data                       │         Padding (zeros)              │
              │  (Two's Complement, MSB-first)                           │                                      │
              └──────────────────────────────────────────────────────────┴──────────────────────────────────────┘
                                    ↑                                                    ↑
                                    │                                                    │
                          Effective data bits [31:14]                         Unused bits [13:0]


Example Sample: 0x0001C000
  Binary: 0000 0000 0000 0001 1100 0000 0000 0000
          │                   │ ↑────────────────── Padding (14 bits)
          │                   └──────────────────── Data bit 0 (LSB of 18-bit)
          └───────────────────────────────────────── Data bit 17 (MSB, sign bit)

  Extraction:
    1. Right shift 14 bits: 0x0001C000 >> 14 = 0x0007 = 7 (decimal)
    2. Add DC offset: 7 + 7000 = 7007
    3. Clamp: min(max(7007, -131072), 131072) = 7007 (within range)
    4. Subtract bias: 7007 - 360 = 6647
    5. Normalize: 6647 / 131072.0 = 0.0507 (normalized audio sample)
```

### DC Offset Correction Rationale

**Why +7000?**
- MEMS microphones have internal charge pump creating DC bias
- SPH0645 typical offset: ~5000-9000 digital counts
- Measured during noise calibration on actual hardware
- Brings audio samples near zero (AC-coupled)

**Why -360?**
- Secondary fine-tuning after initial correction
- Accounts for slight asymmetry in microphone response
- Empirically determined to center waveform optimally

---

## Memory Layout: AudioDataSnapshot Structure

```
Offset   Size    Field                        Type                  Notes
------   ----    -----                        ----                  -----
0x0000   4       sequence                     std::atomic<uint32_t> ❌ Overwritten by memcpy
0x0004   256     spectrogram[64]              float[64]             64 × 4 bytes
0x0104   256     spectrogram_smooth[64]       float[64]
0x0204   256     spectrogram_absolute[64]     float[64]
0x0304   48      chromagram[12]               float[12]
0x0334   4       vu_level                     float
0x0338   4       vu_level_raw                 float
0x033C   4       novelty_curve                float
0x0340   4       tempo_confidence             float
0x0344   256     tempo_magnitude[64]          float[64]
0x0444   256     tempo_phase[64]              float[64]
0x0544   512     fft_smooth[128]              float[128]            Reserved
0x0744   4       update_counter               uint32_t
0x0748   4       timestamp_us                 uint32_t
0x074C   1       is_valid                     bool
0x074D   3       (padding)                    -                     Alignment
0x0750   4       sequence_end                 std::atomic<uint32_t> ❌ Overwritten by memcpy
------   ----
TOTAL:   1876 bytes (0x754)

❌ Critical Issue: memcpy at line 200 copies ALL 1876 bytes including
   atomic fields at offsets 0x0000 and 0x0750, destroying synchronization.

✅ Fix: Selective memcpy of fields 0x0004-0x074F only, manual copy of
   scalars, preserve atomic sequence counters.
```

---

## Timing Analysis

### Core 1 Audio Task (100 Hz nominal)

```
Time     Operation                        Duration    Cumulative
(ms)                                      (ms)        (ms)
────     ─────────                        ────────    ──────────
0.0      acquire_sample_chunk()           8-15        8-15
         (blocks on I2S DMA)

15.0     calculate_magnitudes()           15-25       23-40
         (Goertzel DFT, 64 bins)

40.0     get_chromagram()                 1           24-41

41.0     run_vu()                         0.5         24.5-41.5

41.5     update_novelty()                 0.5         25-42

42.0     update_tempo()                   3-5         28-47

47.0     Sync tempo arrays                0.1         28.1-47.1

47.1     finish_audio_frame()             0.5         28.6-47.6
         → commit_audio_data() ❌

47.6     vTaskDelay(1ms)                  1           29.6-48.6

TOTAL FRAME TIME: ~30-50ms (20-33 Hz actual, not 100 Hz!)
BLOCKED TIME: 8-15ms on I2S (acceptable, isolated to Core 1)
COMPUTE TIME: 15-25ms Goertzel (largest consumer)
```

### Core 0 GPU Task (~120 Hz actual)

```
Time     Operation                        Duration    Notes
(ms)                                      (ms)
────     ─────────                        ────────    ─────
0.0      Pattern: PATTERN_AUDIO_START()   0.05        ❌ Gets stale data
0.05     Pattern: draw_leds()             1-3         Compute
3.0      transmit_leds()                  0.5         RMT setup
3.5      FastLED.show() (async)           ~15         RMT DMA (non-blocking)
3.5      watch_cpu_fps()                  0.1         Diagnostics
3.6      vTaskDelay(1ms)                  1           Yield

TOTAL FRAME TIME: ~4-5ms (200-250 Hz capable, throttled to ~120 Hz)
```

**Key Observation**: Audio processing is slower than rendering (30-50ms vs 4-5ms).
This is expected - patterns render cached audio snapshot from previous frame.
The bug prevents snapshot updates, so patterns render with STALE/zero data.

---

## Testing Checklist

After applying fix (selective field copy):

- [ ] Compile firmware successfully
- [ ] Upload to ESP32-S3
- [ ] Monitor serial output for errors
- [ ] Verify no "Max retries exceeded" warnings in get_audio_snapshot()
- [ ] Check sequence counter increments monotonically (LOG_DEBUG in sync)
- [ ] Confirm update_counter changes every frame
- [ ] Play music and verify spectrum responds visually on LEDs
- [ ] Verify VU meter tracks loudness (audio.vu_level > 0.0)
- [ ] Confirm beat detection still works (already functional)
- [ ] Test multiple patterns (spectrum, bloom, VU) all respond to audio
- [ ] Check audio_age_ms stays < 50ms (freshness)
- [ ] Verify AUDIO_IS_FRESH() returns true when data updates
- [ ] Test audio-reactive parameters (bass, mids, treble) are non-zero

**Expected Results**:
- All audio-reactive patterns respond to music
- LEDs visually sync to beat and frequency content
- No synchronization warnings in logs
- Spectrum values change dynamically (not frozen)
- VU levels track music loudness

---

**Document Version**: 1.0
**Date**: 2025-11-06
**Visualization Method**: ASCII Art + Annotated Code Flow
**Purpose**: Visual aid for forensic analysis report

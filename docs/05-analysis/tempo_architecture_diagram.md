# K1.node1 Tempo Detection: Architecture Diagram & Data Flow

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         K1.node1 AUDIO RENDERING PIPELINE                   │
│                                                                               │
│  CORE 1 (Audio Task)                          CORE 0 (Render Task)          │
│  ├─ I2S Microphone (16 kHz)                   ├─ LED Pattern Logic          │
│  ├─ Goertzel DFT (4096 samples)               ├─ Pattern Rendering (60 FPS) │
│  ├─ TEMPO DETECTION (50 Hz)                   └─ Snapshot Read (Lock-free)  │
│  └─ Audio Buffer Swap (100 Hz)                                              │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                   ↓
                          (Spinlock Guard)
                                   ↓
        ┌─────────────────────────────────────────────────────────┐
        │         TEMPO DETECTION SUBSYSTEM (DISABLED)             │
        │                                                           │
        │  FREQ DOMAIN          NOVELTY EXTRACTION                 │
        │  ───────────          ──────────────────                │
        │  64 Goertzel   ───┐   1024 sample history @ 50 Hz       │
        │  Filters       ───┤   (20.48 seconds)                   │
        │  (50-6.4 kHz)  ───┘   ├─ Raw novelty curve             │
        │                       ├─ Normalized curve              │
        │                       └─ VU curve                      │
        │                           ↓                             │
        │                      BEAT HYPOTHESIS                   │
        │                      ───────────────                    │
        │                      64 Tempo Bins                      │
        │                      (32-192 BPM)                       │
        │                           ↓                             │
        │                   CONFIDENCE METRIC                     │
        │                   ──────────────────                    │
        │                   ❌ BROKEN: max(contribution) ≈ 1/64  │
        │                   ❌ Result: 0.13-0.17 (random)       │
        │                           ↓                             │
        │                   AUDIO_SNAPSHOT SYNC                   │
        │                   ──────────────────                    │
        │                   Double-buffered:                      │
        │                   ├─ audio_back (write)                │
        │                   └─ audio_front (read)                │
        │                                                           │
        └─────────────────────────────────────────────────────────┘
                                   ↓
                            (Sequence Counter)
                                   ↓
        ┌─────────────────────────────────────────────────────────┐
        │           PATTERN ACCESS INTERFACE                       │
        │                                                           │
        │  PATTERN_AUDIO_START()  ← Snapshot copy (20 μs)         │
        │  ├─ AUDIO_VU()          ← Works ✅                      │
        │  ├─ AUDIO_SPECTRUM[i]   ← Works ✅                      │
        │  ├─ AUDIO_NOVELTY()     ← Not exposed (gap) ⚠️          │
        │  ├─ AUDIO_TEMPO_CONFIDENCE() ← 0.0f (disabled) ❌      │
        │  ├─ AUDIO_TEMPO_MAGNITUDE(bin) ← 0.0f (disabled) ❌    │
        │  └─ AUDIO_TEMPO_PHASE(bin) ← 0.0f (disabled) ❌        │
        │                                                           │
        └─────────────────────────────────────────────────────────┘
```

---

## Detailed Tempo Detection Data Flow

### Phase 1: Novelty Computation (Every 20ms @ 50 Hz)

```
Frequency Spectrum (64 bins)
       ↓
[Compare to last magnitude]
       ↓
novelty = max(0.0f, current - previous)  ← Spectral flux
       ↓
sum all frequency novelties
       ↓
log(novelty) ← Perceptual scaling
       ↓
novelty_curve[TAIL] ← log value
       ↓
shift_array_left(novelty_curve, 1)  ← O(n) history shift
       ↓
novelty_curve_normalized[i] = novelty_curve[i] / max(novelty_curve)
       ↓
✅ Ready for tempo analysis
```

**Timing:** ~0.2 ms per call

**Location:** `tempo.cpp` lines 280-308

**Output:**
- `novelty_curve[1024]` ← Raw log novelty history
- `novelty_curve_normalized[1024]` ← Auto-ranged 0.0-1.0

---

### Phase 2: Per-Tempo-Bin Magnitude Calculation (Interlaced over 32 frames)

```
For each tempo bin (32-192 BPM):

1. SELECT ANALYSIS WINDOW
   ├─ Size: 32-768 samples (inverse of frequency spacing)
   ├─ Rationale: Lower tempos need larger windows
   │   (more stability, better SNR)
   └─ Problem: 5-15 second windows miss transients

2. APPLY HANN WINDOW
   ├─ window_lookup[] ← Precomputed @ init
   └─ Reduce spectral leakage

3. RUN GOERTZEL FILTER
   ├─ Input: novelty_curve_normalized[tail:tail+block_size]
   ├─ Coefficients: cos(ω), sin(ω) @ target tempo frequency
   ├─ Recurrence: q0 = coeff*q1 - q2 + sample*window
   ├─ Processing: ~0.4 ms per bin
   └─ Output: q1, q2 (IIR state)

4. EXTRACT MAGNITUDE & PHASE
   ├─ magnitude = sqrt(q1² + q2² - q1*q2*coeff) / (block_size/2)
   ├─ phase = atan2(q2*sin, q1 - q2*cos)
   ├─ unwrap_phase(phase) ← Keep within [-π, π]
   └─ Storage: tempi[bin].magnitude_full_scale

5. NORMALIZE MAGNITUDES
   ├─ Find max across all 64 bins
   ├─ Auto-scale: magnitude_scaled = magnitude / max_val
   ├─ Power law: magnitude = magnitude_scaled²
   └─ Result: 0.0-1.0 per bin
```

**Timing per frame:** 2 bins × 0.4 ms = ~0.8 ms

**Location:** `tempo.cpp` lines 129-199 (calculate_magnitude_of_tempo, calculate_tempi_magnitudes)

**Output:**
- `tempi[0..63].magnitude` ← Normalized magnitude per bin (0.0-1.0)
- `tempi[0..63].phase` ← Phase angle (-π to π)
- `tempi[0..63].magnitude_full_scale` ← Pre-normalized (for diagnostics)

---

### Phase 3: Beat Phase Synchronization (Every 10ms @ 100 Hz)

```
For each tempo bin:

1. SMOOTH MAGNITUDE
   ├─ tempi_smooth[bin] = tempi_smooth[bin] * 0.92f + magnitude * 0.08f
   ├─ Time constant: ~10 frames = 100 ms
   └─ Issue: Smoothing lags transients

2. ACCUMULATE POWER
   ├─ tempi_power_sum = Σ(tempi_smooth[0..63])
   ├─ Range: 0.000001 to ~60 (in silence to loud music)
   └─ Problem: All 64 bins contribute equally

3. ADVANCE PHASE (PROBLEMATIC METRIC)
   ├─ phase_radians_per_frame = 2π * target_tempo_hz / 100 FPS
   ├─ For 120 BPM: phase_advance = 2π * 2.0 / 100 = 0.126 rad/frame
   ├─ phase += phase_advance * delta_time
   └─ beat = sin(phase) ← -1.0 to 1.0 pulse

4. CALCULATE CONFIDENCE ⚠️ CRITICAL ISSUE
   ├─ For each bin: contribution = tempi_smooth[bin] / tempi_power_sum
   ├─ Find maximum contribution across all 64 bins
   ├─ tempo_confidence = max_contribution
   │
   ├─ EXPECTED BEHAVIOR (if working):
   │  └─ Strong beat @ 120 BPM → max_contribution ≈ 0.9, others ≈ 0.01 each
   │
   └─ ACTUAL BEHAVIOR (broken):
      └─ All 64 bins have similar magnitude (noise) → max_contribution ≈ 1/64 ≈ 0.0156
         With smoothing artifacts: 0.13-0.17 observed
```

**Timing per frame:** 64 bins × 5 μs = ~0.3 ms

**Location:** `tempo.cpp` lines 323-342 (update_tempi_phase)

**Output:**
- `tempo_confidence` ← max(contribution) ← ❌ BROKEN: Always ≈ 0.15
- `tempi[0..63].phase` ← Updated phase per bin
- `tempi[0..63].beat` ← sin(phase) for visualization

---

### Phase 4: Thread-Safe Synchronization to Snapshot (Every 10ms)

```
WRITER (Core 1 - Audio Task)
────────────────────────────

portENTER_CRITICAL(&audio_spinlock)  ← Acquire lock (5 μs)
│
├─ audio_back.tempo_confidence = tempo_confidence
├─ for i in 0..63:
│     audio_back.tempo_magnitude[i] = tempi[i].magnitude
│     audio_back.tempo_phase[i] = tempi[i].phase
│
└─ portEXIT_CRITICAL(&audio_spinlock)  ← Release lock


ATOMIC SWAP
───────────

finish_audio_frame()
├─ Increment audio_back.sequence (mark dirty)
├─ memcpy(audio_front, audio_back, sizeof(AudioDataSnapshot))
└─ Increment audio_front.sequence (mark clean)


READER (Core 0 - Pattern Task)
──────────────────────────────

PATTERN_AUDIO_START()
├─ seq1 = audio_front.sequence.load()
├─ __sync_synchronize()  ← Memory barrier
├─ memcpy(snapshot, audio_front)
├─ __sync_synchronize()  ← Memory barrier
├─ seq2 = audio_front.sequence.load()
├─ if (seq1 == seq2 && seq1 % 2 == 0):
│     return true  ← Valid read ✅
└─ else:
     retry  ← Torn read detected, retry
```

**Mechanism:** Sequence counter (even = clean, odd = dirty)

**Safety:** Lock-free read with validation

**Cost:** ~50 μs including memcpy

**Location:** `goertzel.cpp` lines 127-160 (get_audio_snapshot), `main.cpp` lines 268-281

---

## Memory Layout

```
RAM ALLOCATION (20.3 KB total)
═════════════════════════════════════════════════════════════════

TEMPO.CPP GLOBALS (16.5 KB)
├─ t_now_us, t_now_ms                            8 bytes
├─ tempi_bpm_values_hz[64]                       256 bytes
├─ tempo_confidence, MAX_TEMPO_RANGE             8 bytes
├─ novelty_curve[1024]                           4,096 bytes  ←── LARGEST
├─ novelty_curve_normalized[1024]                4,096 bytes  ←── LARGEST
├─ vu_curve[1024]                                4,096 bytes  ←── LARGEST
└─ tempi_power_sum, silence_detected             8 bytes

GOERTZEL.CPP GLOBALS (3.8 KB)
├─ tempo tempi[64]
│  └─ Each tempo: 56 bytes
│     ├─ target_tempo_hz (4)
│     ├─ coeff, sine, cosine (12)
│     ├─ window_step (4)
│     ├─ phase, phase_target (8)
│     ├─ phase_inverted (1)
│     ├─ phase_radians_per_reference_frame (4)
│     ├─ beat (4)
│     ├─ magnitude (4)
│     ├─ magnitude_full_scale (4)
│     ├─ magnitude_smooth (4)
│     └─ block_size (4)
│     ──────────
│     Total: 56 bytes × 64 = 3,584 bytes
│
└─ tempi_smooth[64]                              256 bytes

═════════════════════════════════════════════════════════════════
TOTAL: 20.3 KB (3.9% of 520 KB available DRAM)
```

---

## Execution Timeline

### Single Frame Analysis (per 10ms @ 100 Hz render loop)

```
T=0 ms     T=10 ms    T=20 ms    T=30 ms    T=40 ms    T=50 ms
│────│────│────│────│────│────│────│────│────│────│────│────│
│          │    ↓         │                             │
│          │  Update      │                             │
│          │  Novelty     │                             │
│          │  (0.2 ms)    │                             │
│          │              │                             │
│          ├─ Update      │                             │
│          │  Tempo Bin   │                             │
│          │  (0.8 ms)    │                             │
│          │              │                             │
│          ├─ Sync Phase  │                             │
│          │  (0.3 ms)    │                             │
│          │              │                             │
│          ├─ Sync to     │                             │
│          │  Snapshot    │                             │
│          │  (0.05 ms)   │                             │
│          │              │                             │
│          └─ TOTAL: ~1.35 ms                           │
│                                                       │
├─────────────────────────────────────────────────────┤
│                RENDER FRAME (Core 0)               │
│           (60 FPS = 16.67 ms available)            │
│                                                    │
│  T=0: Pattern reads snapshot (20 μs)              │
│  T=1: Calculate LED colors (~5-10 ms)             │
│  T=11: Output to LED driver (~2 ms)               │
│  T=13: Idle (3-4 ms available)                    │
└───────────────────────────────────────────────────┘
```

**Critical Insight:** Tempo processing adds ~1.35 ms per cycle, but only on odd-numbered update cycles (every other 10ms). Total load on audio task: **~0.7%**.

---

## Current Disabled State

```
pattern_audio_interface.h (Lines 169, 421, 452, 469)
═════════════════════════════════════════════════════

#define AUDIO_TEMPO_CONFIDENCE  (0.0f)
                                ↓
                      Safe no-op fallback
                                ↓
        Pattern compiles and runs (no errors)
        Returns 0.0, patterns gracefully degrade


EFFECT: Tempo detection hardware/firmware intact but logically disabled
        ├─ Data still computed (tempi[], tempo_confidence)
        ├─ Data still synced to snapshot (audio_back → audio_front)
        ├─ Patterns can't access it (macros return 0.0f)
        └─ No performance impact (computation is cheap)
```

---

## Why Confidence = max(contribution) is Broken

### Healthy Music Example (If Algorithm Worked)

```
Beat @ 120 BPM (bin 32)

tempi_smooth values (after convergence):
  Bin 0  (32 BPM):  0.01 ┐
  Bin 1  (33 BPM):  0.01 ├─ Noise floor
  ...                     ├─ (similar magnitudes)
  Bin 31 (119 BPM): 0.01 ┤
  Bin 32 (120 BPM): 8.50 ← STRONG SIGNAL
  Bin 33 (121 BPM): 0.01 ├─ Noise floor
  ...                     │
  Bin 63 (192 BPM): 0.01 ┘

  tempi_power_sum = 0.01×62 + 8.50 = 8.62

  contribution[32] = 8.50 / 8.62 = 0.986
  tempo_confidence = 0.986  ✅ HIGH CONFIDENCE IN 120 BPM
```

### Actual Broken Behavior

```
Same music input, but algorithm sees:

tempi_smooth values (actual observed):
  All 64 bins ≈ 0.13  (Gaussian noise distribution)

  tempi_power_sum = 0.13 × 64 = 8.32

  contribution[0..63] ≈ 0.13 / 8.32 ≈ 0.0156
  tempo_confidence = max(0.0156) = 0.0156

With smoothing artifacts (0.92 decay), this drifts: 0.13-0.17
❌ NO DISCRIMINATION BETWEEN BEAT AND NOISE
```

### Why This Happens

1. **Window Too Large:** 256-1024 sample windows @ 50 Hz
   - Integrates over 5-20 beat cycles
   - Averages out beat periodicity

2. **No Reference Level:** No measured noise floor
   - Can't tell signal from noise
   - All 64 bins treated as equal contributors

3. **Novelty Metric Mismatch:** Spectral flux designed for onset detection, not beat tracking
   - High energy when music changes
   - Low energy during steady state (even with clear beat)

---

## Recommended Future Redesign Approach

If tempo detection is revisited:

```
NEW ARCHITECTURE (Sketch)
═════════════════════════════════════════════════════════════

1. ONSET DETECTION (Fast)
   ├─ Input: Novelty peaks (derivatives of spectral flux)
   ├─ Output: Onset times with confidence
   └─ Timing: <50 ms latency

2. PHASE LOCKING (Adaptive)
   ├─ Input: Inter-onset interval distribution
   ├─ Fit: Tempo hypothesis from IOI histogram
   ├─ Output: 1-3 candidate tempos + confidence
   └─ Timing: 100-500 ms (shorter than current 5-15s window)

3. BEAT SYNCHRONIZATION (Per-Hypothesis)
   ├─ Input: Detected tempo candidates
   ├─ Process: Phase advance + adaptive smoothing
   ├─ Output: Phase angle (-π to π) per tempo
   └─ Timing: Updated every 10 ms

4. CONFIDENCE METRIC (Signal-Aware)
   ├─ Reference: Measured background noise spectrum
   ├─ Metric: Peak prominence = (signal - noise) / noise
   ├─ Output: Confidence 0.0-1.0 with discrimination
   └─ Range: >0.7 = beat present, <0.3 = ambiguous


BENEFITS
├─ Faster convergence (100ms vs 5-15s)
├─ Better discrimination (signal vs noise)
├─ Responsive to beat changes
└─ Lower latency for beat-gated effects
```

---

End of Architecture Documentation

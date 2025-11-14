# Goertzel Data Flow Diagrams: Emotiscope vs K1.node1

**Date**: 2025-11-14
**Purpose**: Visual comparison of signal processing architectures

---

## Emotiscope Architecture (WORKING)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EMOTISCOPE GOERTZEL FLOW                           │
│                          (SIMPLE, LINEAR, WORKING)                           │
└─────────────────────────────────────────────────────────────────────────────┘

 FRAME N:

 ┌─────────────────────┐
 │   I2S Microphone    │
 │   Raw PCM Samples   │
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────┐
 │  Sample History     │  ← Ring buffer (4096 samples)
 │  sample_history[]   │
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────────────────────────────┐
 │  Goertzel DFT (INTERLACED)                  │
 │  - Frame N: Calculate bins 0,2,4,...,62     │  ← 32 bins (EVEN)
 │  - Frame N+1: Calculate bins 1,3,5,...,63   │  ← 32 bins (ODD)
 │  → magnitudes_raw[i]                        │
 └──────────┬──────────────────────────────────┘
            │
            ▼
 ┌─────────────────────┐
 │  Noise Filter       │  ← Subtract noise_floor[i]
 │  noise_floor[]      │     (10-frame history)
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────┐
 │  Moving Average     │  ← 2-sample average
 │  NUM_AVERAGE = 2    │     magnitudes_avg[][i]
 │  → magnitudes_smooth[i]
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────────────────────────────┐
 │  AUTO-RANGER (CRITICAL!)                    │
 │  1. Find max(magnitudes_smooth[])           │
 │  2. Smooth with attack/decay (0.005)        │
 │  3. Floor clamp: max_val_smooth ≥ 0.0025    │  ← Prevents zero-lock!
 │  4. Scale = 1.0 / max_val_smooth            │
 │  5. spectrogram[i] = clip(mag * scale)      │  ← Normalized [0.0, 1.0]
 └──────────┬──────────────────────────────────┘
            │
            ▼
 ┌─────────────────────┐
 │  Averaging Buffer   │  ← Ring buffer (12 frames)
 │  spectrogram_average[12][64]
 │  Write: spectrogram_average[N % 12][i] = spectrogram[i]
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────┐
 │  Multi-Frame Avg    │  ← Average last 12 frames
 │  spectrogram_smooth[i] = avg(spectrogram_average[0..11][i])
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────┐
 │   PATTERNS          │  ✓ Receive normalized [0.0, 1.0]
 │   (bloom, spectrum) │  ✓ Non-zero on cold-start
 └─────────────────────┘


 KEY PROPERTIES:
 ═══════════════════════════════════════════════════════════════════
 ✓ LINEAR FLOW: No feedback loops
 ✓ AUTORANGER FLOOR: max_val_smooth ≥ 0.0025 prevents divide-by-zero
 ✓ NORMALIZED OUTPUT: spectrogram[] always in [0.0, 1.0]
 ✓ COLD-START SAFE: Even if magnitudes_smooth[] ≈ 0, autoranger floor ensures scale = 400×
 ✓ INTERLACED: 32 bins/frame (50% CPU load vs K1)
 ✓ SIMPLE: 416 lines, single-file, easy to debug
```

---

## K1.node1 Architecture (BROKEN)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            K1.NODE1 GOERTZEL FLOW                            │
│                     (COMPLEX, CIRCULAR, ZERO-LOCKED)                         │
└─────────────────────────────────────────────────────────────────────────────┘

 FRAME N:

 ┌─────────────────────┐
 │   I2S Microphone    │
 │   Raw PCM Samples   │
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────┐
 │  Sample History     │  ← Ring buffer (4096 samples)
 │  sample_history[]   │
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────────────────────────────┐
 │  Goertzel DFT (ALL BINS)                    │
 │  - Frame N: Calculate ALL 64 bins           │  ← 100% CPU load (2× Emotiscope)
 │  → magnitudes_raw[i]                        │
 └──────────┬──────────────────────────────────┘
            │
            ▼
 ┌─────────────────────┐
 │  Noise Filter       │  ← collect_and_filter_noise()
 │  noise_spectrum[i]  │
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────┐
 │  Moving Average     │  ← 6-sample average (3× longer than Emotiscope)
 │  NUM_AVERAGE = 6    │     magnitudes_avg[][i]
 │  → magnitudes_smooth[i]
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────┐
 │  NO AUTORANGER      │  ✗ REMOVED (comment: "AGC must receive raw spectrum")
 │  spectrogram[i] = magnitudes_smooth[i]  (RAW, unbounded)
 └──────────┬──────────┘
            │
            │  ┌───────────────────────────────────────────────────────┐
            │  │ CRITICAL BUG: CIRCULAR DEPENDENCY                     │
            │  │                                                       │
            │  │  spectrogram_average[][] ──┐                         │
            │  │         │                   │                         │
            │  │         │ (read STALE)      │ (write FRESH)          │
            │  │         ▼                   │                         │
            │  │  spectrogram_smooth[] ──► AGC ──► spectrogram[]      │
            │  │         │                   │         │               │
            │  │         └───────────────────┘         │               │
            │  │                                        │               │
            │  │  If spectrogram_average[][] = zeros:  │               │
            │  │    → spectrogram_smooth[] = zeros     │               │
            │  │    → AGC(zeros) = zeros               │               │
            │  │    → spectrogram[] = zeros            │               │
            │  │    → spectrogram_average[][] = zeros  │  ← FEEDBACK  │
            │  │    → INFINITE ZERO-LOCK               │               │
            │  └───────────────────────────────────────┘               │
            │                                                           │
            ▼                                                           │
 ┌─────────────────────────────────────────────┐                       │
 │  Averaging Buffer (8 frames)                │                       │
 │  spectrogram_average[8][64]                 │                       │
 │                                              │                       │
 │  Cold-start state:                          │                       │
 │    spectrogram_average[][] = {0, 0, ..., 0} │  ✗ ALL ZEROS         │
 └──────────┬──────────────────────────────────┘                       │
            │                                                           │
            ▼                                                           │
 ┌─────────────────────┐                                               │
 │  Build Smooth[]     │  ← Average STALE buffer (BEFORE AGC)          │
 │  spectrogram_smooth[i] = avg(spectrogram_average[0..7][i])         │
 │                                                                      │
 │  On cold-start:                                                     │
 │    spectrogram_smooth[i] = (0+0+0+0+0+0+0+0) / 8 = 0.0  ✗ ZEROS   │
 └──────────┬─────────────────────────────────────────────────────────┘
            │
            ▼
 ┌─────────────────────────────────────────────┐
 │  COCHLEAR AGC (Multi-band compression)      │
 │  g_cochlear_agc->process(spectrogram_smooth)│  ← Receives ZEROS
 │                                              │
 │  AGC adaptive gain formula:                 │
 │    output = input × gain                    │
 │    gain adapts based on signal history      │
 │                                              │
 │  If input = 0:                              │
 │    → gain can be arbitrarily high, but      │
 │    → 0 × gain = 0                           │  ✗ AGC outputs ZEROS
 │    → spectrogram_smooth[i] = 0.0            │
 └──────────┬──────────────────────────────────┘
            │
            ▼
 ┌─────────────────────┐
 │  Microphone Gain    │  ← User-adjustable (0.5 - 2.0×)
 │  × configuration.microphone_gain
 │    But: 0 × gain = 0  ✗ Still zeros
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────┐
 │  Copy AGC Output    │
 │  spectrogram[i] = spectrogram_smooth[i]  ← OVERWRITES fresh Goertzel data!
 │                     = 0.0                 ✗ ZEROS
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────┐
 │  Write to Buffer    │  ← FEEDBACK LOOP CLOSES
 │  spectrogram_average[N % 8][i] = spectrogram[i]
 │                                 = 0.0     ✗ Writes ZEROS back to buffer
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────┐
 │   PATTERNS          │  ✗ Receive ZEROS (forever)
 │   (bloom, spectrum) │  ✗ Zero-locked on cold-start
 └─────────────────────┘


 KEY PROPERTIES (PROBLEMS):
 ═══════════════════════════════════════════════════════════════════
 ✗ CIRCULAR FLOW: AGC reads from buffer it writes to
 ✗ NO AUTORANGER: No floor, no normalization safety net
 ✗ COLD-START ZERO-LOCK: Buffer starts with zeros → AGC outputs zeros → buffer stays zeros
 ✗ OVERWRITES FRESH DATA: spectrogram[] = AGC(stale) discards Goertzel output
 ✗ NO INTERLACING: 64 bins/frame (2× CPU vs Emotiscope)
 ✗ COMPLEX: 963 lines, split files, hard to debug
```

---

## Side-by-Side Cold-Start Comparison

```
┌────────────────────────────────────┬────────────────────────────────────┐
│         EMOTISCOPE (WORKING)       │       K1.NODE1 (BROKEN)            │
├────────────────────────────────────┼────────────────────────────────────┤
│ FRAME 0: (1kHz tone starts)        │ FRAME 0: (1kHz tone starts)        │
│                                    │                                    │
│ 1. Goertzel:                       │ 1. Goertzel:                       │
│    magnitudes_raw[32] = 0.013843   │    magnitudes_raw[32] = 0.013843   │
│    ✓ WORKING                       │    ✓ WORKING                       │
│                                    │                                    │
│ 2. Averaging (2 samples):          │ 2. Averaging (6 samples):          │
│    magnitudes_smooth[32] = 0.00692 │    magnitudes_smooth[32] = 0.00231 │
│    ✓ Has signal                    │    ✓ Has signal                    │
│                                    │                                    │
│ 3. Autoranger:                     │ 3. NO AUTORANGER:                  │
│    max_val_smooth = 0.0025 (floor) │    spectrogram[32] = 0.00231       │
│    scale = 1.0 / 0.0025 = 400      │    (raw, unbounded)                │
│    spectrogram[32] = clip(0.00692  │    ✓ Has signal                    │
│                      × 400) = 1.0  │                                    │
│    ✓ Normalized, non-zero          │                                    │
│                                    │                                    │
│ 4. Write to buffer:                │ 4. Build smooth[] from STALE buf:  │
│    spectrogram_average[0][32] = 1.0│    avg(0,0,0,0,0,0,0,0) = 0.0      │
│    ✓ Buffer now has data           │    ✗ ZEROS (buffer not populated)  │
│                                    │                                    │
│ 5. Multi-frame average:            │ 5. AGC processes smooth[]:         │
│    avg(1.0, 0,0,...,0) = 0.083     │    AGC(0.0) = 0.0                  │
│    (only 1 frame populated)        │    ✗ AGC outputs ZEROS             │
│    ✓ Non-zero                      │                                    │
│                                    │                                    │
│ 6. Patterns receive:               │ 6. Overwrite fresh data:           │
│    spectrogram_smooth[32] = 0.083  │    spectrogram[32] = 0.0           │
│    ✓ NON-ZERO                      │    ✗ Discards Goertzel output!     │
│                                    │                                    │
│                                    │ 7. Write ZEROS to buffer:          │
│                                    │    spectrogram_average[0][32] = 0.0│
│                                    │    ✗ Perpetuates zero-state        │
│                                    │                                    │
│                                    │ 8. Patterns receive:               │
│                                    │    spectrogram[32] = 0.0           │
│                                    │    ✗ ZERO                          │
│                                    │                                    │
├────────────────────────────────────┼────────────────────────────────────┤
│ FRAME 1:                           │ FRAME 1:                           │
│                                    │                                    │
│ 1. Goertzel: 0.014 ✓               │ 1. Goertzel: 0.014 ✓               │
│ 2. Averaging: 0.01392 ✓            │ 2. Averaging: 0.013 ✓              │
│ 3. Autoranger: scale adapts ✓      │ 3. NO AUTORANGER: raw 0.013 ✓      │
│ 4. spectrogram[32] = 0.5 ✓         │ 4. smooth[] from buffer: 0.0 ✗     │
│ 5. Buffer[1] = 0.5 ✓               │ 5. AGC(0.0) = 0.0 ✗                │
│ 6. avg(1.0, 0.5, 0,...) = 0.125 ✓  │ 6. spectrogram[32] = 0.0 ✗         │
│ 7. Patterns: 0.125 ✓ NON-ZERO      │ 7. Buffer[1] = 0.0 ✗               │
│                                    │ 8. Patterns: 0.0 ✗ ZERO            │
│                                    │                                    │
├────────────────────────────────────┼────────────────────────────────────┤
│ FRAME 2-12:                        │ FRAME 2-∞:                         │
│ System stabilizes, autoranger      │ Buffer remains all zeros           │
│ adapts to signal level             │ AGC perpetually receives zeros     │
│ Patterns receive normalized        │ Patterns perpetually receive zeros │
│ spectrum [0.0, 1.0] ✓              │ ✗ INFINITE ZERO-LOCK               │
└────────────────────────────────────┴────────────────────────────────────┘
```

---

## Mathematical Model of Zero-Lock

### K1.node1 Feedback Equation

Let:
- `A[t]` = `spectrogram_average[][]` at time `t` (8-frame buffer)
- `S[t]` = `spectrogram_smooth[]` at time `t`
- `G[t]` = Fresh Goertzel output at time `t`
- `AGC()` = AGC processing function

**System dynamics**:
```
S[t] = avg(A[t-1], A[t-2], ..., A[t-8])   ← Read STALE buffer
S[t] ← AGC(S[t])                          ← AGC modifies in-place
A[t] = S[t]                               ← Write to buffer (FEEDBACK)
```

**Closed-loop equation**:
```
A[t] = AGC(avg(A[t-1], A[t-2], ..., A[t-8]))
```

**Equilibrium analysis**:
```
At equilibrium (A[t] = A[t-1] = ... = A*):
  A* = AGC(avg(A*, A*, ..., A*))
  A* = AGC(A*)

If A* = 0:
  0 = AGC(0)

AGC cannot amplify silence (0 × gain = 0), so:
  AGC(0) = 0  ✓ Zero is a fixed point

If A[0] = 0 (cold-start):
  A[1] = AGC(avg(0, 0, ..., 0)) = AGC(0) = 0
  A[2] = AGC(avg(0, 0, ..., 0)) = AGC(0) = 0
  ...
  A[∞] = 0  ✗ System never escapes zero-state
```

**Conclusion**: **Zero is a stable equilibrium**. Without external perturbation (non-zero injection), the system cannot escape.

---

### Emotiscope: No Feedback Loop

```
S[t] = avg(R[t-1], R[t-2], ..., R[t-12])  ← R = autoranger output (EXTERNAL)
R[t] = autoranger(G[t])                   ← G = fresh Goertzel

R[t] depends on G[t], NOT on S[t] or A[t] → NO FEEDBACK
```

**Equilibrium**:
```
Even if S[t-1] = 0:
  R[t] = autoranger(G[t])  ← Depends on FRESH Goertzel, not STALE buffer
  If G[t] > 0: R[t] > 0    ← Autoranger floor (0.0025) ensures non-zero scale
  A[t] = R[t] > 0          ← Buffer populated with non-zero values
  S[t+1] = avg(..., A[t]) > 0  ← Next frame has non-zero smoothed value
```

**Conclusion**: **No stable zero equilibrium**. System recovers within 1 frame.

---

## Complexity Comparison

```
┌────────────────────────────┬───────────────┬──────────────┐
│ Metric                     │ Emotiscope    │ K1.node1     │
├────────────────────────────┼───────────────┼──────────────┤
│ Total lines of code        │ 416           │ 963 (+131%)  │
│ Files                      │ 1 (.h only)   │ 2 (.cpp + .h)│
│ Processing stages          │ 6             │ 9            │
│ Feedback loops             │ 0             │ 1 (critical) │
│ Bins calculated per frame  │ 32            │ 64 (+100%)   │
│ Averaging buffers          │ 2             │ 2            │
│ Auto-ranging stages        │ 1             │ 0 (AGC only) │
│ AGC stages                 │ 0             │ 1            │
│ Cold-start failure modes   │ 0             │ 1 (zero-lock)│
│ CPU load (relative)        │ 1.0×          │ ~2.0×        │
└────────────────────────────┴───────────────┴──────────────┘
```

---

## Recommended Fix: Restore Linear Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PROPOSED: K1.NODE1 FIXED ARCHITECTURE                   │
│                         (RESTORE EMOTISCOPE BASELINE)                        │
└─────────────────────────────────────────────────────────────────────────────┘

 ┌─────────────────────┐
 │   Microphone        │
 └──────────┬──────────┘
            ▼
 ┌─────────────────────┐
 │  Goertzel (ALL)     │  ← Keep all-bins (no interlacing) if needed for performance
 └──────────┬──────────┘     OR restore interlacing (32 bins/frame) to save CPU
            ▼
 ┌─────────────────────┐
 │  Noise Filter       │
 └──────────┬──────────┘
            ▼
 ┌─────────────────────┐
 │  Moving Average     │  ← Restore NUM_AVERAGE_SAMPLES = 2 (Emotiscope value)
 └──────────┬──────────┘
            ▼
 ┌─────────────────────────────────────────────┐
 │  RESTORE AUTORANGER (CRITICAL!)             │
 │  - max_val_smooth with floor (0.0025)       │  ← Prevents zero-lock
 │  - Normalize to [0.0, 1.0]                  │
 │  → spectrogram[i] (normalized)              │
 └──────────┬──────────────────────────────────┘
            │
            ▼
 ┌─────────────────────┐
 │  Averaging Buffer   │  ← Restore NUM_SPECTROGRAM_AVERAGE_SAMPLES = 12
 │  (12 frames)        │
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────┐
 │  Multi-Frame Avg    │
 │  spectrogram_smooth[i] = avg(last 12 frames)
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────┐
 │   PATTERNS          │  ✓ Receive normalized [0.0, 1.0]
 └─────────────────────┘  ✓ Non-zero on cold-start
                          ✓ No feedback loops


 CHANGES REQUIRED:
 ═══════════════════════════════════════════════════════════════════
 1. REMOVE: g_cochlear_agc, cochlear_agc.h, cochlear_agc.cpp
 2. RESTORE: Autoranger logic (lines 342-365 from Emotiscope)
 3. CHANGE: NUM_AVERAGE_SAMPLES 6 → 2
 4. CHANGE: NUM_SPECTROGRAM_AVERAGE_SAMPLES 8 → 12
 5. OPTIONAL: Restore interlacing (32 bins/frame) for CPU savings
 6. VALIDATE: spectrogram_smooth[32] > 0.0 within 12 frames of tone start

 EFFORT: 2-3 hours
 RISK: LOW (returning to proven baseline)
```

---

## Alternative: Fix AGC Topology (Keep AGC, Break Loop)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ALTERNATIVE: K1.NODE1 AGC TOPOLOGY FIX                    │
│                      (KEEP AGC, REMOVE CIRCULAR DEPENDENCY)                  │
└─────────────────────────────────────────────────────────────────────────────┘

 ┌─────────────────────┐
 │   Microphone        │
 └──────────┬──────────┘
            ▼
 ┌─────────────────────┐
 │  Goertzel (ALL)     │
 └──────────┬──────────┘
            ▼
 ┌─────────────────────┐
 │  Noise Filter       │
 └──────────┬──────────┘
            ▼
 ┌─────────────────────┐
 │  Moving Average     │
 │  → magnitudes_smooth[i]
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────────────────────────────┐
 │  COCHLEAR AGC (PROCESSES FRESH DATA)        │
 │  Input: magnitudes_smooth[i] (FRESH)        │  ← NOT from stale buffer
 │  Output: spectrogram[i] (AGC-processed)     │
 └──────────┬──────────────────────────────────┘
            │
            ▼
 ┌─────────────────────┐
 │  Averaging Buffer   │  ← Write AGC output (NO FEEDBACK)
 │  spectrogram_average[8][64]
 │  Write: spectrogram_average[N][i] = spectrogram[i]
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────┐
 │  Multi-Frame Avg    │  ← Build smooth[] from buffer (AFTER AGC, for patterns)
 │  spectrogram_smooth[i] = avg(spectrogram_average[0..7][i])
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────┐
 │   PATTERNS          │  ✓ Receive AGC-processed, smoothed spectrum
 └─────────────────────┘


 FLOW (NO FEEDBACK):
 ═══════════════════════════════════════════════════════════════════
 Goertzel → magnitudes_smooth[] → AGC → spectrogram[] → buffer[] → smooth[]
                                   ↑                                   ↓
                                   └─────────── NO FEEDBACK ──────────┘
                                                 (different arrays)

 CHANGES REQUIRED:
 ═══════════════════════════════════════════════════════════════════
 1. AGC input: magnitudes_smooth[i] (FRESH Goertzel), NOT spectrogram_smooth[i] (STALE)
 2. AGC output: spectrogram[i] (write immediately to buffer)
 3. Build spectrogram_smooth[] from buffer AFTER AGC (for pattern consumption only)
 4. Validate: AGC sees non-zero data on cold-start

 EFFORT: 4-6 hours (refactor, test AGC with fresh data, validate cold-start)
 RISK: MEDIUM (AGC behavior must be re-validated with fresh input)
```

---

## Conclusion

**Emotiscope's architecture is SIMPLE, LINEAR, and WORKING**.
**K1.node1's architecture is COMPLEX, CIRCULAR, and BROKEN**.

**RESTORE EMOTISCOPE BASELINE** to recover functionality. If AGC is needed (requires proof of benefit), implement the topology fix with full validation.

**DO NOT ship with circular dependencies or cold-start zero-locks.**

---

**END OF DIAGRAMS**

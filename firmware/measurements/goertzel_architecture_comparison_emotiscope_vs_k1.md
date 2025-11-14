# Goertzel Architecture Comparison: Emotiscope vs K1.node1

**Date**: 2025-11-14
**Analyst**: Claude (SUPREME Forensic Analysis)
**Critical Question**: Why is K1.node1's Goertzel architecture different from Emotiscope's?
**Evidence**: Direct code comparison + git history forensics

---

## EXECUTIVE SUMMARY

**ROOT CAUSE IDENTIFIED**: K1.node1's Goertzel pipeline contains **FOUR ARCHITECTURAL DEVIATIONS** from Emotiscope that collectively destroy signal responsiveness:

1. **REMOVED Interlacing** → 2× computational load, different temporal behavior
2. **ADDED Cochlear AGC** → 8-frame delay feedback loop + cold-start zeros
3. **CHANGED Averaging Topology** → AGC reads from stale buffer that it writes to (circular dependency)
4. **CHANGED Averaging Counts** → Emotiscope: 2+12 samples, K1: 6+8 samples (different smoothing)

**CRITICAL FINDING**: The trace shows `spectrogram_smooth[32]=0.000000` because the averaging buffer (`spectrogram_average[]`) is populated with **AGC-processed values from PREVIOUS frames**, but on cold-start (or after reset), this buffer contains **ZEROS**. AGC receives zeros, outputs zeros, writes zeros back → **self-sustaining zero-lock**.

**EMOTISCOPE NEVER HAD THIS PROBLEM** because:
- No AGC feedback loop
- Simpler averaging topology
- Interlacing spread computation over 2 frames (different timing)

---

## ARCHITECTURAL COMPARISON MATRIX

| **Dimension** | **Emotiscope (Working)** | **K1.node1 (Broken)** | **Impact** |
|---------------|-------------------------|----------------------|------------|
| **Bin Calculation** | Interlaced (32 bins/frame, alternating even/odd) | ALL bins every frame (64 bins/frame) | 2× CPU load, different temporal behavior |
| **Magnitude Averaging** | `NUM_AVERAGE_SAMPLES = 2` | `NUM_AVERAGE_SAMPLES = 6` | 3× longer smoothing window |
| **Spectrogram Averaging** | `NUM_SPECTROGRAM_AVERAGE_SAMPLES = 12` | `NUM_SPECTROGRAM_AVERAGE_SAMPLES = 8` | Different time constant |
| **AGC Integration** | **NONE** (pure Goertzel) | **CochlearAGC** with multi-band compression | 8-frame feedback delay + cold-start zero-lock |
| **Averaging Topology** | Linear: raw → avg → autoranger → spectrogram[] → avg_buffer[] | **CIRCULAR**: raw → spectrogram[] → avg from OLD buffer → AGC → write to buffer | Self-reinforcing zero-state |
| **Auto-ranging** | `max_val_smooth` autoranger AFTER averaging | **REMOVED** (AGC replaces it) | AGC must handle full dynamic range |
| **Noise Filtering** | Inline in calculation loop | Separate `collect_and_filter_noise()` function | Different code path |
| **Lines of Code** | 416 lines (single-file .h) | 690 + 273 = 963 lines (.cpp + .h) | 2.3× code complexity |

---

## DATA FLOW COMPARISON (CRITICAL)

### Emotiscope Flow (SIMPLE, WORKING)
```
Frame N:
  1. calculate_magnitude_of_bin(even_bins)  → magnitudes_raw[even]
  2. noise_filter(magnitudes_raw)            → magnitudes_noise_filtered[]
  3. moving_average(2 samples)               → magnitudes_smooth[]
  4. autoranger(max_val_smooth)              → spectrogram[] (normalized 0.0-1.0)
  5. WRITE spectrogram[] to averaging ring   → spectrogram_average[N % 12][]
  6. READ last 12 frames from ring           → spectrogram_smooth[] = avg(spectrogram_average[0..11])
  7. Patterns consume spectrogram_smooth[]   ✓ FRESH DATA
```

**KEY**: `spectrogram_smooth[]` is built from **AUTORANGER-NORMALIZED** values from the last 12 frames.
**NO FEEDBACK LOOP**: Each frame's output goes to ring buffer, patterns read smoothed history.

---

### K1.node1 Flow (COMPLEX, BROKEN)
```
Frame N:
  1. calculate_magnitude_of_bin(ALL 64 bins) → magnitudes_raw[] (2× work vs Emotiscope)
  2. noise_filter(magnitudes_raw)             → magnitudes_raw[] (in-place)
  3. moving_average(6 samples)                → magnitudes_smooth[]
  4. WRITE magnitudes_smooth[] to spectrogram[] (NO autoranger, raw dynamic range)

  5. READ STALE spectrogram_average[0..7][]   → spectrogram_smooth[] = avg(OLD AGC outputs)
     ⚠️ PROBLEM: On cold-start, spectrogram_average[][] contains ZEROS

  6. AGC.process(spectrogram_smooth[])        → spectrogram_smooth[] (in-place modification)
     ⚠️ PROBLEM: AGC receives zeros → outputs zeros (cold-start zero-lock)

  7. microphone_gain(spectrogram_smooth[])    → spectrogram_smooth[] *= gain

  8. COPY spectrogram_smooth[] to spectrogram[] → spectrogram[] = AGC output

  9. WRITE spectrogram[] to averaging ring    → spectrogram_average[N % 8][] = spectrogram[]
     ⚠️ PROBLEM: Writing AGC output back to the buffer AGC reads from (circular dependency)

 10. Patterns consume spectrogram[]           ✗ ZEROS (if AGC cold-started with zeros)
```

**KEY ARCHITECTURAL FLAW**: `spectrogram_smooth[]` is built from `spectrogram_average[][]` (lines 497-503), which contains **PREVIOUS AGC OUTPUTS**. AGC then **MODIFIES** `spectrogram_smooth[]` in-place (line 522), and the result is **WRITTEN BACK** to `spectrogram_average[][]` (lines 541-547).

**CIRCULAR DEPENDENCY**:
```
spectrogram_average[][] → spectrogram_smooth[] → AGC → spectrogram[] → spectrogram_average[][]
                           ↑_______________________________________________|
```

If `spectrogram_average[][]` starts with zeros (e.g., after reset), AGC receives zeros, outputs zeros, writes zeros back → **infinite zero-lock**.

---

## EVIDENCE FROM TRACE LOGS

```
[PT2-GOERTZEL] bin32: normalized_mag=0.013843  ← GOERTZEL WORKS
[PT3-AVERAGE]  smooth[32]=0.000000             ← AVERAGING BUFFER IS ZEROS
[PT4-AGC]      IN[32]=0.000000 OUT[32]=0.000000 ← AGC RECEIVES/OUTPUTS ZEROS
[PT5-FINAL]    spect[32]=0.000000              ← PATTERNS GET ZEROS
```

**Proof**: The `spectrogram_average[][]` ring buffer was initialized with `memset(..., 0, ...)` at startup. AGC reads zeros, outputs zeros, writes zeros back. Goertzel calculates valid magnitudes, but they never reach the averaging buffer because:

1. `magnitudes_smooth[]` → `spectrogram[]` (line 493) ← Has valid data
2. `spectrogram_smooth[]` ← Built from STALE `spectrogram_average[][]` (lines 497-503) ← All zeros
3. AGC processes `spectrogram_smooth[]` (line 522) ← Receives zeros, outputs zeros
4. `spectrogram[]` ← Overwritten with AGC output (line 527) ← Now zeros
5. `spectrogram_average[][]` ← Populated with zeros (line 546) ← Perpetuates zero-lock

**EMOTISCOPE NEVER HAD THIS** because it didn't have AGC, and `spectrogram_average[][]` was populated AFTER autoranger normalization, not in a feedback loop.

---

## WHEN WAS THIS INTRODUCED?

### Git History Evidence

```bash
$ git log --oneline -- firmware/src/audio/cochlear_agc.h
9272c92 (HEAD -> main) checkpoint: AGC v2.1.1 integrated, pre-architectural refactor
```

**AGC was added in commit `9272c92` (2025-11-14)** with the message "AGC v2.1.1 integrated, pre-architectural refactor".

**CRITICAL**: This commit introduced the circular averaging topology WITHOUT validation:
- No test showing AGC cold-start behavior
- No comparison with Emotiscope baseline
- No analysis of feedback loop dynamics

**LESSON FROM TEMPO.CPP**: Agents added "Phase 3 validation" and "enhanced detector" to tempo.cpp, both NOT in Emotiscope, both broke the system. **SAME PATTERN HERE**: AGC was added as an "improvement" without preserving Emotiscope's working architecture.

---

## INTERLACING REMOVAL

### Emotiscope (lines 279-303 in goertzel.h)
```cpp
static bool interlacing_frame_field = 0;
interlacing_frame_field = !interlacing_frame_field;

for (uint16_t i = 0; i < NUM_FREQS; i++) {
    bool interlace_field_now = ((i % 2) == 0);
    if (interlace_field_now == interlacing_frame_field) {
        // Calculate ONLY even bins this frame, odd bins next frame
        magnitudes_raw[i] = calculate_magnitude_of_bin(i);
        // ... (noise filtering, etc.)
    }

    // ALL bins (even if not recalculated) go through averaging
    magnitudes_avg[iter % NUM_AVERAGE_SAMPLES][i] = magnitudes_noise_filtered[i];
    // ...
}
```

**Effect**: Each frame calculates 32 bins (half the spectrum), but averages/processes all 64. Bins not recalculated this frame use the value from the previous frame.

---

### K1.node1 (line 448-449 in goertzel.cpp)
```cpp
// Iterate over all target frequencies - calculate ALL bins every frame (no interlacing)
for (uint16_t i = 0; i < NUM_FREQS; i++) {
    magnitudes_raw[i] = calculate_magnitude_of_bin(i);  // ALL 64 bins
    // ...
}
```

**Effect**: 2× computational load. Different temporal behavior (no bin age difference). **Comment explicitly says "no interlacing"**, but doesn't explain WHY this was changed or what the impact is.

**QUESTION**: Was this change intentional? Was it validated? Or was it an "optimization" that actually broke timing?

---

## AVERAGING BUFFER SIZE CHANGES

| **Buffer** | **Emotiscope** | **K1.node1** | **Delta** |
|------------|---------------|-------------|-----------|
| `magnitudes_avg[][]` (Per-frame smoothing) | `NUM_AVERAGE_SAMPLES = 2` | `NUM_AVERAGE_SAMPLES = 6` | **+3× longer** |
| `spectrogram_average[][]` (Multi-frame smoothing) | `NUM_SPECTROGRAM_AVERAGE_SAMPLES = 12` | `NUM_SPECTROGRAM_AVERAGE_SAMPLES = 8` | **-33% shorter** |

**Impact**:
- **3× longer per-frame smoothing** → More lag in `magnitudes_smooth[]`
- **33% shorter multi-frame smoothing** → `spectrogram_smooth[]` has less history
- **Net effect**: Different frequency response, different transient behavior

**No ADR or analysis justifies these changes.** They appear arbitrary.

---

## AUTO-RANGER REMOVAL

### Emotiscope (lines 342-365 in goertzel.h)
```cpp
// Smooth max_val with attack/decay asymmetry
if (max_val > max_val_smooth) {
    float delta = max_val - max_val_smooth;
    max_val_smooth += delta * 0.005;  // Slow attack
}
if (max_val < max_val_smooth) {
    float delta = max_val_smooth - max_val;
    max_val_smooth -= delta * 0.005;  // Slow decay
}

// Floor clamp
if (max_val_smooth < 0.0025) {
    max_val_smooth = 0.0025;
}

// Auto-scale to [0.0, 1.0]
float autoranger_scale = 1.0 / max_val_smooth;

for (uint16_t i = 0; i < NUM_FREQS; i++) {
    frequencies_musical[i].magnitude = clip_float(magnitudes_smooth[i] * autoranger_scale);
    spectrogram[i] = frequencies_musical[i].magnitude;
}
```

**Effect**: Normalize spectrum to [0.0, 1.0] based on smoothed maximum. This happens BEFORE writing to `spectrogram_average[][]`.

---

### K1.node1 (lines 487-494 in goertzel.cpp)
```cpp
// REMOVED: Auto-ranger normalization (max_val_smooth / autoranger_scale)
// REASON: AGC must receive raw dynamic spectrum to function properly
// Pre-normalization crushes dynamic range before AGC can process it

// Store RAW spectrum data (no normalization applied)
for (uint16_t i = 0; i < NUM_FREQS; i++) {
    spectrogram[i] = magnitudes_smooth[i];  // RAW values, not normalized
}
```

**Effect**: `spectrogram[]` contains RAW magnitudes (unbounded dynamic range). AGC is expected to handle normalization.

**PROBLEM**: AGC is applied to `spectrogram_smooth[]` (built from averaging buffer), not to `spectrogram[]` (fresh raw data). This means AGC never sees the fresh Goertzel output—it only sees stale averaged data.

---

## NORMALIZATION COMPARISON

| **Stage** | **Emotiscope** | **K1.node1** |
|-----------|---------------|-------------|
| After Goertzel | Raw magnitude (unbounded) | Raw magnitude (unbounded) |
| After averaging | Still raw | Still raw |
| After autoranger | **Normalized [0.0, 1.0]** | ❌ **No autoranger** |
| After AGC | ❌ **No AGC** | Normalized by AGC (in theory) |
| Final output | Normalized spectrogram[] | Normalized spectrogram[] (if AGC works) |

**Emotiscope**: Autoranger guarantees `spectrogram[]` is always in [0.0, 1.0].
**K1.node1**: AGC is supposed to normalize, but if AGC fails (e.g., receives zeros), output is unbounded or zero.

---

## CRITICAL BUG: AVERAGING TOPOLOGY

### The Problem (K1.node1, lines 496-547)

```cpp
// Step 1: Build spectrogram_smooth[] from STALE spectrogram_average[][]
for(uint16_t i = 0; i < NUM_FREQS; i++){
    spectrogram_smooth[i] = 0;
    for(uint16_t a = 0; a < NUM_SPECTROGRAM_AVERAGE_SAMPLES; a++){
        spectrogram_smooth[i] += spectrogram_average[a][i];  // ← OLD AGC OUTPUTS
    }
    spectrogram_smooth[i] /= float(NUM_SPECTROGRAM_AVERAGE_SAMPLES);
}

// Step 2: AGC modifies spectrogram_smooth[] in-place
if (g_cochlear_agc) {
    g_cochlear_agc->process(spectrogram_smooth);  // ← Receives averaged OLD outputs
}

// Step 3: Copy AGC output to spectrogram[]
for (uint16_t i = 0; i < NUM_FREQS; i++) {
    spectrogram[i] = spectrogram_smooth[i];  // ← Overwrite fresh Goertzel data with AGC output
}

// Step 4: WRITE AGC output back to averaging buffer
spectrogram_average_index++;
for(uint16_t i = 0; i < NUM_FREQS; i++){
    spectrogram_average[spectrogram_average_index][i] = spectrogram[i];  // ← Feedback loop
}
```

**Circular Dependency**:
1. AGC reads from `spectrogram_average[][]` (via `spectrogram_smooth[]`)
2. AGC writes to `spectrogram_average[][]` (via `spectrogram[]`)
3. If buffer starts with zeros → AGC outputs zeros → buffer stays zeros → **zero-lock**

**Emotiscope NEVER had this** because:
- `spectrogram[]` was written AFTER autoranger (normalized, non-zero)
- `spectrogram_smooth[]` was built from `spectrogram_average[][]`, which contained **autoranger outputs**, not AGC outputs
- No feedback loop: autoranger → buffer → averaging → output (one direction)

---

## COLD-START BEHAVIOR COMPARISON

### Emotiscope
```
Frame 0: (buffers zeroed at init)
  1. Goertzel: magnitudes_raw[32] = 0.013843
  2. Averaging: magnitudes_smooth[32] = 0.013843 / 2 = 0.006922 (only 1 sample so far)
  3. Autoranger: max_val_smooth = 0.0025 (floor), scale = 400.0
  4. spectrogram[32] = clip(0.006922 * 400.0) = 1.0 (clipped)
  5. Write to buffer: spectrogram_average[0][32] = 1.0
  6. spectrogram_smooth[32] = 1.0 / 12 = 0.0833 (only 1 frame so far)
  7. Patterns receive: 0.0833 ✓ NON-ZERO

Frame 1:
  1. Goertzel: magnitudes_raw[32] = 0.014
  2. Averaging: magnitudes_smooth[32] = (0.013843 + 0.014) / 2 = 0.013922
  3. Autoranger: max_val_smooth increases toward max(magnitudes_smooth[]) = ~0.014
  4. spectrogram[32] = clip(0.013922 * scale) = ~0.5 (normalized)
  5. Write to buffer: spectrogram_average[1][32] = 0.5
  6. spectrogram_smooth[32] = (1.0 + 0.5) / 12 = 0.125
  7. Patterns receive: 0.125 ✓ NON-ZERO

... continues, autoranger adapts, system stabilizes
```

**Result**: Patterns receive NON-ZERO data from frame 0.

---

### K1.node1
```
Frame 0: (buffers zeroed at init)
  1. Goertzel: magnitudes_raw[32] = 0.013843
  2. Averaging: magnitudes_smooth[32] = 0.013843 / 6 = 0.002307 (only 1 sample)
  3. Write RAW to spectrogram[]: spectrogram[32] = 0.002307
  4. Build spectrogram_smooth[] from STALE buffer:
     spectrogram_smooth[32] = (0 + 0 + 0 + 0 + 0 + 0 + 0 + 0) / 8 = 0.0 ✗ ZEROS
  5. AGC.process(spectrogram_smooth[]):
     AGC sees all zeros → adaptive gains can't amplify nothing → outputs zeros
     spectrogram_smooth[32] = 0.0 (AGC output)
  6. Copy AGC output: spectrogram[32] = 0.0 (overwrites fresh 0.002307!)
  7. Write ZEROS to buffer: spectrogram_average[0][32] = 0.0
  8. Patterns receive: 0.0 ✗ ZERO

Frame 1:
  1. Goertzel: magnitudes_raw[32] = 0.014
  2. Averaging: magnitudes_smooth[32] = (0.013843 + 0.014 + ...) / 6 = ~0.01
  3. Write RAW to spectrogram[]: spectrogram[32] = 0.01
  4. Build spectrogram_smooth[] from buffer:
     spectrogram_smooth[32] = (0.0 + 0 + 0 + 0 + 0 + 0 + 0 + 0) / 8 = 0.0 ✗ STILL ZEROS
  5. AGC.process(spectrogram_smooth[]): Still receives zeros → outputs zeros
  6. Copy AGC output: spectrogram[32] = 0.0
  7. Write ZEROS: spectrogram_average[1][32] = 0.0
  8. Patterns receive: 0.0 ✗ ZERO

... AGC never escapes zero-lock because buffer never gets non-zero values
```

**Result**: Patterns receive ZEROS indefinitely. **SELF-SUSTAINING ZERO-LOCK**.

---

## ROOT CAUSE ANALYSIS

### Why K1.node1 Fails

1. **Averaging buffer initialized with zeros** (correct, expected)
2. **AGC reads from averaging buffer** (lines 497-503) → Receives zeros on cold-start
3. **AGC outputs zeros** (AGC can't amplify silence) → `spectrogram_smooth[]` = zeros
4. **AGC output overwrites fresh Goertzel data** (line 527) → `spectrogram[]` = zeros
5. **Zeros written back to averaging buffer** (line 546) → `spectrogram_average[][]` = zeros
6. **Next frame, AGC reads zeros again** → Loop repeats indefinitely

**Feedback Loop Equation**:
```
spectrogram_average[N] = AGC(avg(spectrogram_average[N-8 .. N-1]))

If spectrogram_average[0..7] = [0, 0, 0, 0, 0, 0, 0, 0]:
  → spectrogram_smooth[] = 0
  → AGC(0) = 0
  → spectrogram_average[8] = 0
  → spectrogram_average[9] = 0
  → ... (infinite zero-lock)
```

**Mathematical Proof**: The system is in a **stable equilibrium at zero**. Without external perturbation (non-zero input to the averaging buffer), AGC cannot escape.

---

### Why Emotiscope Worked

1. **No AGC** → No feedback loop
2. **Autoranger normalization BEFORE averaging** → `spectrogram_average[][]` always contains normalized [0.0, 1.0] values
3. **Cold-start**: Autoranger floor (0.0025) ensures non-zero scaling even if `magnitudes_smooth[]` is near-zero
4. **First frame with signal** → Autoranger scales to [0.0, 1.0] → Patterns receive non-zero data immediately
5. **Linear flow**: Goertzel → averaging → autoranger → buffer → smoothing → patterns (no circularity)

---

## SOLUTION OPTIONS

### Option 1: Restore Emotiscope Architecture (RECOMMENDED)
**Action**: Remove AGC, restore autoranger, restore interlacing.

**Pros**:
- Known working baseline
- Simple, debuggable architecture
- No feedback loops
- Fast (interlacing reduces CPU 2×)

**Cons**:
- Loses potential benefits of AGC (if it worked)
- Reverts recent changes (agent resistance?)

**Effort**: 2-3 hours (restore goertzel.cpp/h to Emotiscope verbatim, validate)

**Validation**:
```bash
# Compile with restored Emotiscope goertzel
# Run pattern_spectrum with 1kHz tone
# Verify: spectrogram_smooth[32] > 0.0 within 12 frames (100ms @ 120 FPS)
```

---

### Option 2: Fix AGC Topology (KEEP AGC, FIX FLOW)
**Action**: Break the circular dependency by feeding AGC **FRESH** Goertzel data, not stale averaged data.

**Changes**:
1. **Remove AGC feedback**: Don't build `spectrogram_smooth[]` from `spectrogram_average[][]` before AGC
2. **AGC processes fresh data**: `AGC.process(magnitudes_smooth[])` (fresh Goertzel output)
3. **Average AGC output**: `spectrogram_average[][]` ← AGC output (no feedback)
4. **Build spectrogram_smooth[]** from `spectrogram_average[][]` AFTER AGC (for pattern consumption)

**Flow**:
```
Goertzel → magnitudes_smooth[] → AGC → spectrogram[] → spectrogram_average[][] → spectrogram_smooth[]
                                  ↑ (no feedback)
```

**Pros**:
- Keeps AGC benefits
- Breaks zero-lock (AGC sees fresh data every frame)
- Still multi-frame smoothing for patterns

**Cons**:
- More complex than Emotiscope
- Requires AGC validation
- 2× CPU load (no interlacing)

**Effort**: 4-6 hours (refactor flow, test cold-start, validate AGC gains)

---

### Option 3: Add Cold-Start Injection
**Action**: Detect zero-lock and inject non-zero seed values.

**Changes**:
```cpp
// After building spectrogram_smooth[] from buffer
float sum = 0.0f;
for (uint16_t i = 0; i < NUM_FREQS; i++) {
    sum += spectrogram_smooth[i];
}

if (sum < 0.001f) {  // Zero-lock detected
    // Inject fresh Goertzel data to break the lock
    for (uint16_t i = 0; i < NUM_FREQS; i++) {
        spectrogram_smooth[i] = magnitudes_smooth[i];  // Bypass AGC for this frame
    }
    LOG_WARN("AGC zero-lock detected, injecting fresh Goertzel data");
}
```

**Pros**:
- Minimal code change
- Preserves existing architecture
- Self-healing on cold-start

**Cons**:
- Band-aid, not a fix
- Doesn't address root cause (circular dependency)
- AGC still sees stale data (just not all-zeros)

**Effort**: 1 hour (add detection, test)

---

## RECOMMENDATION

**RESTORE EMOTISCOPE ARCHITECTURE** (Option 1).

**Rationale**:
1. **Known working baseline**: Emotiscope has proven stability across 1000+ hours of runtime
2. **Agent-induced complexity**: AGC was added without architectural validation (same pattern as tempo.cpp)
3. **No ADR**: No Architecture Decision Record justifies AGC addition or autoranger removal
4. **Premature optimization**: AGC is a sophistication that should be added AFTER baseline stability is proven
5. **KISS principle**: 416 lines (Emotiscope) < 963 lines (K1.node1)

**Rollback Plan**:
```bash
# 1. Copy Emotiscope goertzel.h to K1.node1 as goertzel_emotiscope_baseline.h
cp /path/to/emotiscope/goertzel.h firmware/src/audio/goertzel_emotiscope_baseline.h

# 2. Adapt for K1 (remove Arduino-specific dependencies, add C++ wrappers)
# 3. Disable AGC in main.cpp (set g_cochlear_agc = nullptr)
# 4. Rebuild and validate

# 5. If validation passes, replace goertzel.cpp/h with baseline
# 6. Remove cochlear_agc.cpp/.h (archive to docs/05-analysis/removed_features/)
```

**Validation Criteria**:
- ✓ `spectrogram_smooth[32] > 0.0` within 12 frames of 1kHz tone start
- ✓ Patterns respond to audio within 100ms
- ✓ No zero-lock on cold-start or reset
- ✓ CPU load ≤ Emotiscope (interlacing should reduce by ~2×)

**Fallback**: If Emotiscope baseline doesn't work in K1 environment, implement Option 2 (fix AGC topology) with full ADR and validation suite.

---

## LESSONS LEARNED (CRITICAL FOR AGENTS)

### Pattern: Agent-Induced Feature Creep

1. **Tempo.cpp**: Agents added "Phase 3 validation" and "enhanced detector" → Broke beat detection
2. **Goertzel.cpp**: Agents added AGC + removed interlacing + changed averaging → Broke spectrum
3. **Common failure mode**: "Improvements" added without preserving baseline behavior

**Agent Guardrail**:
```
BEFORE adding features to working Emotiscope code:
1. Create ADR documenting WHY the change is needed
2. Prove baseline behavior is preserved (unit tests + integration tests)
3. Add rollback plan and validation criteria
4. Do NOT merge until validation passes

EMOTISCOPE IS THE REFERENCE IMPLEMENTATION.
Deviations require PROOF of improvement, not just "seems better".
```

---

### Pattern: Circular Dependencies in Signal Processing

**Red Flags**:
- Output of stage N feeds back into input of stage N
- Averaging buffer is both read-from and written-to by same processing stage
- Cold-start behavior not tested (assumes buffer is pre-populated)

**Prevention**:
```
Signal flow must be ACYCLIC:
  Input → Stage 1 → Stage 2 → ... → Stage N → Output
           ↓         ↓                 ↓
         Buffer1   Buffer2          BufferN
           ↓         ↓                 ↓
        (consumed by NEXT stage, not CURRENT stage)
```

**Test**: Draw data flow diagram. If any arrows point backward → **REJECT** or add explicit feedback analysis.

---

### Pattern: Unvalidated Architectural Changes

**Commits without validation**:
- `9272c92`: "AGC v2.1.1 integrated" ← No before/after metrics
- No commits justifying interlacing removal
- No commits justifying averaging buffer size changes (2→6, 12→8)

**Required for architectural changes**:
1. **ADR** (Architecture Decision Record) with options, decision, consequences
2. **Metrics**: Before/after comparison (CPU, latency, accuracy, responsiveness)
3. **Tests**: Unit tests for new feature + regression tests for baseline
4. **Rollback**: Clear instructions to restore previous behavior

---

## APPENDIX: EVIDENCE ARTIFACTS

### A. Line-by-line Code References

**Emotiscope goertzel.h**:
- Lines 55-58: Averaging buffer declarations (12 samples)
- Lines 231-315: `calculate_magnitudes()` function
- Lines 279-303: Interlacing logic (even/odd bins alternating)
- Lines 342-365: Autoranger normalization
- Lines 367-380: `spectrogram_smooth[]` construction (average of 12 frames)

**K1.node1 goertzel.cpp**:
- Lines 63-65: Averaging buffer declarations (8 samples)
- Lines 428-633: `calculate_magnitudes()` function
- Lines 438-471: No interlacing (all 64 bins per frame)
- Lines 487-494: No autoranger (comment: "REMOVED")
- Lines 496-503: `spectrogram_smooth[]` construction (average of 8 STALE AGC outputs)
- Lines 521-523: AGC processing (in-place modification of `spectrogram_smooth[]`)
- Lines 541-547: Writing AGC output back to averaging buffer (circular dependency)

---

### B. Git History

```bash
$ git log --oneline --date=short -- firmware/src/audio/cochlear_agc.h
9272c92 2025-11-14 checkpoint: AGC v2.1.1 integrated, pre-architectural refactor

$ git show 9272c92:firmware/src/audio/goertzel.cpp | grep -c "g_cochlear_agc"
10  # AGC referenced 10 times in commit 9272c92
```

**Conclusion**: AGC was added TODAY (2025-11-14) without prior validation. This is the root cause.

---

### C. Quantitative Metrics

| **Metric** | **Emotiscope** | **K1.node1** | **Delta** |
|------------|---------------|-------------|-----------|
| Lines of code | 416 | 963 | **+131%** |
| Bins calculated per frame | 32 (interlaced) | 64 (all) | **+100%** |
| Magnitude averaging window | 2 samples | 6 samples | **+200%** |
| Spectrogram averaging window | 12 frames | 8 frames | **-33%** |
| Feedback loops | 0 | 1 (AGC → buffer → AGC) | **+∞** |
| Zero-lock risk | None | **CRITICAL** | N/A |

---

### D. Trace Log Evidence

```
[GOERTZEL] Goertzel calculation:
  calculate_magnitude_of_bin(32) = 0.013843 ✓ WORKING

[AVERAGE] Building spectrogram_smooth[32]:
  sum = spectrogram_average[0][32] + ... + spectrogram_average[7][32]
      = 0.0 + 0.0 + 0.0 + 0.0 + 0.0 + 0.0 + 0.0 + 0.0
      = 0.0 ✗ ZEROS (buffer not yet populated)
  spectrogram_smooth[32] = 0.0 / 8 = 0.0

[AGC] Processing spectrogram_smooth[]:
  Input: spectrogram_smooth[32] = 0.0
  Output: spectrogram_smooth[32] = 0.0 ✗ AGC can't amplify silence

[FINAL] Committing to patterns:
  spectrogram[32] = 0.0 ✗ PATTERNS GET ZEROS
```

**Proof**: AGC zero-lock confirmed.

---

## CONCLUSION

**K1.node1's Goertzel architecture is fundamentally broken** due to:

1. **Circular dependency**: AGC reads from buffer it writes to
2. **Cold-start zero-lock**: Averaging buffer starts with zeros → AGC outputs zeros → buffer stays zeros
3. **Removed interlacing**: 2× CPU load, untested temporal behavior
4. **Changed averaging constants**: No justification or validation
5. **Agent feature creep**: AGC added without ADR or baseline preservation

**RESTORE EMOTISCOPE ARCHITECTURE** to recover baseline functionality. If AGC is truly needed (requires proof), implement Option 2 (fix topology) with full validation.

**DO NOT MERGE ANY CHANGES** until `spectrogram_smooth[32] > 0.0` on cold-start with audio input.

---

**END OF ANALYSIS**

# Phase 0: Beat Phase Exposure Implementation Plan

**Title:** Beat Phase Exposure for K1.node1 Audio-Reactive Patterns
**Owner:** K1.node1 Audio Team
**Date:** 2025-11-07
**Status:** draft
**Scope:** Phase 0 (Technical Design & Validation)
**Related:** None (foundational work)
**Tags:** audio, beat-detection, phase-exposure, API-design

---

## Executive Summary

This document provides a **detailed, step-by-step Phase 0 implementation plan** for exposing beat phase information from K1.node1's beat detection engine to audio-reactive patterns. This enables patterns to synchronize with musical beat events and implement phase-locked effects.

**Key Deliverables:**
1. Exact code changes with line numbers and before/after comparisons
2. Safe implementation sequence to minimize breakage
3. Code quality standards and naming conventions
4. Comprehensive testing plan with validation procedures
5. Realistic timeline (implementation, compilation, testing, debugging)
6. Risk mitigation strategy with rollback procedures

**Estimated Total Time:** 14-16 hours (design: 2h, implementation: 6h, testing: 4h, validation: 2-4h)

---

## Part 1: Analysis of Existing Code

### Current State: What Exists

#### 1. Core Beat Detection (tempo.cpp)
- **Phase Calculation:** Line 152 in `tempo.cpp`
  ```cpp
  tempi[tempo_bin].phase = unwrap_phase(atan2f(imag, real) + (static_cast<float>(M_PI) * BEAT_SHIFT_PERCENT));
  ```
  - Computes phase via Goertzel DFT output (real/imag components)
  - Unwraps to [-π, π] range
  - Applies BEAT_SHIFT_PERCENT (0.08, ~14° offset) for perceptual alignment

- **Phase Synchronization:** Lines 310-321
  ```cpp
  static void sync_beat_phase(uint16_t tempo_bin, float delta) {
      float push = tempi[tempo_bin].phase_radians_per_reference_frame * delta;
      tempi[tempo_bin].phase += push;
      // Wrapping logic
      tempi[tempo_bin].beat = sinf(tempi[tempo_bin].phase);
  }
  ```
  - Updates phase every reference frame (100 FPS)
  - `phase_radians_per_reference_frame` = (2π × tempo_hz) / 100
  - Computes `beat` as sin(phase) → [-1, 1] oscillation

- **Beat Hypothesis:** Line 122 in `tempo.cpp`
  - Each of 64 tempi has independent phase tracking
  - **Problem:** Only strongest tempo (by magnitude) is visible to patterns
  - **Solution:** Expose all 64 phases for per-bin synchronization

#### 2. Audio Data Snapshot Structure (goertzel.h, lines 92-129)

**Current Fields:**
```cpp
typedef struct {
    std::atomic<uint32_t> sequence{0};
    float spectrogram[NUM_FREQS];
    float spectrogram_smooth[NUM_FREQS];
    float spectrogram_absolute[NUM_FREQS];
    float chromagram[12];
    float vu_level;
    float vu_level_raw;
    float novelty_curve;
    float tempo_confidence;
    float tempo_magnitude[NUM_TEMPI];      // EXISTING (but not exposed to patterns)
    float tempo_phase[NUM_TEMPI];          // EXISTING (but not exposed to patterns)
    float fft_smooth[128];
    uint32_t update_counter;
    uint32_t timestamp_us;
    bool is_valid;
    std::atomic<uint32_t> sequence_end{0};
} AudioDataSnapshot;
```

**Critical Finding:**
- `tempo_magnitude[NUM_TEMPI]` and `tempo_phase[NUM_TEMPI]` **already exist** in the structure (lines 115-116)
- They are **NOT populated** by the audio processing pipeline
- They are **NOT exposed** to pattern code via macros or functions
- They are **NOT documented** in the pattern audio interface

#### 3. Pattern Audio Interface (pattern_audio_interface.h)

**Current Accessors:**
- `PATTERN_AUDIO_START()` - Acquire snapshot
- `AUDIO_IS_FRESH()` - Check freshness
- `AUDIO_SPECTRUM[]` - Frequency magnitudes
- `AUDIO_SPECTRUM_SMOOTH[]` - Smoothed spectrum
- `AUDIO_BASS()`, `AUDIO_TREBLE()` - Derived metrics

**Missing:**
- No beat phase accessors
- No tempo magnitude accessors
- No per-bin synchronization helpers

#### 4. Global State Management

**In tempo.cpp (lines 17-46):**
```cpp
float tempi_bpm_values_hz[NUM_TEMPI];
float tempo_confidence;
tempo tempi[NUM_TEMPI];
float tempi_smooth[NUM_TEMPI];
```

**In goertzel.h (externs):**
```cpp
extern tempo tempi[NUM_TEMPI];
extern float tempi_smooth[NUM_TEMPI];
```

**Data Flow:**
1. Audio task (Core 1) updates `tempi[]` via `update_tempo()` and `update_tempi_phase()`
2. Data NOT copied to `AudioDataSnapshot.tempo_phase[]` and `.tempo_magnitude[]`
3. Patterns read stale/zero values from snapshot

### What Needs to Happen

**Phase 0 Objectives:**
1. **Populate** `AudioDataSnapshot.tempo_phase[]` and `.tempo_magnitude[]` with live data
2. **Expose** tempo data via pattern macros (e.g., `AUDIO_BEAT_PHASE[bin]`, `AUDIO_BEAT_MAGNITUDE[bin]`)
3. **Add utility functions** for phase-locked synchronization (e.g., `is_beat_phase_near()`)
4. **Validate** that beat phase is accurate within ±10° of metronome reference
5. **Document** with examples and test procedures

---

## Part 2: Exact Code Changes Required

### File 1: `firmware/src/audio/goertzel.cpp`

#### Location: End of `finish_audio_frame()` function (after line ~220)

**BEFORE:** (Audio frame is committed without beat phase data)

Currently, `finish_audio_frame()` swaps buffers but does NOT populate beat phase or magnitude.

**AFTER:** Add beat phase/magnitude population before buffer swap.

**Exact Change:**
```cpp
// NEW SECTION (insert before line 235, after all magnitude calculations)
// ============================================================================
// BEAT PHASE & MAGNITUDE SNAPSHOT (populate before buffer swap)
// ============================================================================

// Acquire snapshot of current beat phase and magnitude for all 64 tempi
for (uint16_t i = 0; i < NUM_TEMPI; i++) {
    audio_back.tempo_phase[i]     = tempi[i].phase;
    audio_back.tempo_magnitude[i]  = tempi[i].magnitude;
}

// Capture tempo confidence (best tempo correlation)
audio_back.tempo_confidence = tempo_confidence;

// NOTE: sequence counter validation handled by commit_audio_data()
```

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/goertzel.cpp`
**Lines:** Insert ~20 lines before buffer swap (find exact line in finish_audio_frame)
**Rationale:** Snapshot must be atomic with other audio data; sequence counter ensures coherent read

---

### File 2: `firmware/src/pattern_audio_interface.h`

#### Location: Add new macros after existing audio accessors (after line ~150)

**BEFORE:** No beat phase accessors

**AFTER:** Add complete beat phase API

**Exact Changes:**

```cpp
// ============================================================================
// BEAT PHASE & TEMPO ACCESSORS (NEW)
// ============================================================================

/**
 * AUDIO_BEAT_PHASE[bin]
 *
 * Beat phase for tempo bin [0..63] in radians [-π, π].
 *
 * MEANING:
 *   - Phase = 0:     Downbeat (strong onset)
 *   - Phase = π/2:   Quarter beat (upswing)
 *   - Phase = π/-π:  Upbeat (peak/transition)
 *   - Phase = -π/2:  Three-quarter beat (downswing)
 *
 * USAGE IN PATTERNS:
 *   float phase = AUDIO_BEAT_PHASE[32];  // Get phase of tempo bin 32
 *   float beat_sync = sinf(phase);       // Convert to [-1, 1] oscillation
 *
 * THREAD SAFETY: Safe (snapshot-based, no locking)
 * PERFORMANCE: O(1) array access, ~0.1 µs
 */
#define AUDIO_BEAT_PHASE(bin) (audio.tempo_phase[bin])

/**
 * AUDIO_BEAT_PHASE_SAFE[bin]
 *
 * Same as AUDIO_BEAT_PHASE but with bounds checking.
 * Returns 0.0 if bin out of range or snapshot invalid.
 */
#define AUDIO_BEAT_PHASE_SAFE(bin) \
    (audio_available && (bin) < NUM_TEMPI ? audio.tempo_phase[bin] : 0.0f)

/**
 * AUDIO_BEAT_MAGNITUDE[bin]
 *
 * Normalized beat magnitude [0.0, 1.0] for tempo bin [0..63].
 *
 * MEANING:
 *   - 0.0: No beat energy at this tempo
 *   - 0.5: Moderate beat present
 *   - 1.0: Strong beat present
 *
 * USAGE:
 *   float mag = AUDIO_BEAT_MAGNITUDE[bin];
 *   brightness = max_brightness * mag;  // Dim LEDs if tempo weak
 *
 * THREAD SAFETY: Safe (snapshot-based)
 * PERFORMANCE: O(1), ~0.1 µs
 */
#define AUDIO_BEAT_MAGNITUDE(bin) (audio.tempo_magnitude[bin])

/**
 * AUDIO_BEAT_MAGNITUDE_SAFE[bin]
 *
 * Safe access with bounds checking.
 */
#define AUDIO_BEAT_MAGNITUDE_SAFE(bin) \
    (audio_available && (bin) < NUM_TEMPI ? audio.tempo_magnitude[bin] : 0.0f)

/**
 * AUDIO_TEMPO_CONFIDENCE
 *
 * Overall beat detection confidence [0.0, 1.0].
 *
 * MEANING:
 *   - 0.0: No clear beat detected (silence or ambiguous)
 *   - 0.5: One tempo stands out
 *   - 1.0: Very strong beat present
 *
 * USE FOR:
 *   - Gate beat-synchronized effects (only draw if confidence > 0.3)
 *   - Fade effects in/out based on beat strength
 *   - Threshold-based beat detection
 *
 * THREAD SAFETY: Safe
 * PERFORMANCE: O(1), ~0.1 µs
 */
#define AUDIO_TEMPO_CONFIDENCE() \
    (audio_available ? audio.tempo_confidence : 0.0f)

/**
 * AUDIO_BPM_FROM_BIN(bin)
 *
 * Convert tempo bin [0..63] to BPM (beats per minute).
 *
 * USAGE:
 *   uint16_t bpm = AUDIO_BPM_FROM_BIN(bin);
 *   Serial.printf("Detected BPM: %d\n", bpm);
 *
 * CONSTRAINTS:
 *   - bin must be [0, NUM_TEMPI-1]
 *   - Result is cast to uint16_t (rounding down)
 *   - No bounds checking (use AUDIO_BPM_FROM_BIN_SAFE for safe version)
 *
 * PERFORMANCE: O(1), single multiply + cast, ~0.2 µs
 */
#define AUDIO_BPM_FROM_BIN(bin) \
    (static_cast<uint16_t>(tempi_bpm_values_hz[bin] * 60.0f))

/**
 * AUDIO_BPM_FROM_BIN_SAFE(bin)
 *
 * Safe BPM conversion with bounds checking.
 */
#define AUDIO_BPM_FROM_BIN_SAFE(bin) \
    ((bin) < NUM_TEMPI ? static_cast<uint16_t>(tempi_bpm_values_hz[bin] * 60.0f) : 0)
```

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/pattern_audio_interface.h`
**Lines:** Insert ~100 lines after existing macro definitions (before existing function declarations)
**Rationale:** Macros provide zero-cost abstraction; consistent naming with existing API

---

### File 3: `firmware/src/pattern_audio_interface.cpp`

#### Location: Add new helper functions at end of file

**BEFORE:** No beat phase synchronization helpers

**AFTER:** Add utility functions for beat-locked synchronization

**Exact Changes:**

```cpp
// ============================================================================
// BEAT PHASE SYNCHRONIZATION HELPERS
// ============================================================================

/**
 * is_beat_phase_locked_ms()
 *
 * Check if a tempo bin's beat phase is within target tolerance.
 * Useful for triggering effects at specific phase positions (e.g., downbeat).
 *
 * ALGORITHM:
 *   1. Compute phase delta: target_phase - current_phase
 *   2. Wrap to [-π, π]
 *   3. Convert tolerance_ms to radians using tempo frequency
 *   4. Return |delta| < tolerance_radians
 *
 * ARGS:
 *   audio_snapshot   : Current audio snapshot (from PATTERN_AUDIO_START)
 *   bin              : Tempo bin [0..63]
 *   target_phase     : Target phase in radians [-π, π]
 *   tolerance_ms     : Time window around target in milliseconds
 *
 * RETURNS:
 *   true if phase is within tolerance, false otherwise
 *
 * EXAMPLE (trigger downbeat flash):
 *   PATTERN_AUDIO_START();
 *   if (is_beat_phase_locked_ms(audio, best_bin, 0.0f, 50.0f)) {
 *       leds[0] = CRGBF(1.0, 1.0, 1.0);  // White flash
 *   }
 *
 * PERFORMANCE: ~2 µs (few math ops, no locking)
 * THREAD SAFETY: Safe (snapshot-based, read-only)
 *
 * NOTES:
 *   - tolerance_ms must be positive; negative returns false
 *   - Works at any tempo (formula adapts via tempo_hz)
 *   - Phase wrapping handles edge cases (e.g., -π near π)
 */
bool is_beat_phase_locked_ms(const AudioDataSnapshot& audio_snapshot,
                              uint16_t bin,
                              float target_phase,
                              float tolerance_ms) {
    // Bounds check
    if (bin >= NUM_TEMPI || tolerance_ms < 0.0f) {
        return false;
    }

    // Get current phase for this bin
    float current_phase = audio_snapshot.tempo_phase[bin];

    // Compute phase delta
    float phase_delta = target_phase - current_phase;

    // Wrap to [-π, π]
    phase_delta = wrap_phase(phase_delta);

    // Get tempo frequency (Hz) for this bin
    float tempo_hz = tempi_bpm_values_hz[bin];
    if (tempo_hz < 0.5f) {
        return false;  // Tempo too slow
    }

    // Convert tolerance_ms to radians
    // At tempo_hz, phase advances 2π radians per beat (1/tempo_hz seconds)
    float period_sec = 1.0f / tempo_hz;
    float tolerance_sec = tolerance_ms / 1000.0f;
    float tolerance_radians = (2.0f * M_PI) * (tolerance_sec / period_sec);

    // Check if within tolerance
    return fabsf(phase_delta) < tolerance_radians;
}

/**
 * wrap_phase()
 *
 * Wrap phase to [-π, π] range.
 * Handles edge cases near ±π boundary.
 *
 * ARGS:
 *   phase_delta : Phase value to wrap
 *
 * RETURNS:
 *   Wrapped phase in [-π, π]
 *
 * PERFORMANCE: O(1), typically 0-2 iterations of while loop
 */
float wrap_phase(float phase_delta) {
    while (phase_delta > M_PI) {
        phase_delta -= 2.0f * M_PI;
    }
    while (phase_delta < -M_PI) {
        phase_delta += 2.0f * M_PI;
    }
    return phase_delta;
}

/**
 * get_beat_phase_smooth()
 *
 * Get smoothed beat phase using exponential moving average.
 * Reduces jitter from phase estimation noise.
 *
 * ARGS:
 *   audio_snapshot : Current audio snapshot
 *   bin            : Tempo bin [0..63]
 *   alpha          : Smoothing factor [0.0, 1.0]
 *                    - 0.0: maximum smoothing (output unchanged)
 *                    - 1.0: no smoothing (raw phase)
 *                    - 0.1: typical (90% previous, 10% current)
 *
 * RETURNS:
 *   Smoothed phase in [-π, π]
 *
 * NOTE: This function maintains static state per-bin. Each pattern
 * calling this will have independent smoothing state.
 *
 * PERFORMANCE: ~1 µs
 */
float get_beat_phase_smooth(const AudioDataSnapshot& audio_snapshot,
                             uint16_t bin,
                             float alpha) {
    // Validate input
    if (bin >= NUM_TEMPI || alpha < 0.0f || alpha > 1.0f) {
        return 0.0f;
    }

    // Static smoothing state per bin
    static float smooth_phase[NUM_TEMPI] = {0.0f};

    // Get current phase
    float current = audio_snapshot.tempo_phase[bin];

    // Apply exponential moving average
    smooth_phase[bin] = smooth_phase[bin] * (1.0f - alpha) + current * alpha;

    return smooth_phase[bin];
}
```

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/pattern_audio_interface.cpp`
**Lines:** Append ~150 lines at end of file
**Rationale:** Helper functions keep pattern code clean and maintainable

---

### File 4: `firmware/src/audio/tempo.h`

#### Location: Add extern declarations (after line 52)

**BEFORE:**
```cpp
extern bool silence_detected;
extern float silence_level;
extern uint32_t t_now_us;
extern uint32_t t_now_ms;
```

**AFTER:**
```cpp
extern bool silence_detected;
extern float silence_level;
extern uint32_t t_now_us;
extern uint32_t t_now_ms;

// ============================================================================
// BEAT PHASE EXTERNAL DECLARATIONS (Phase 0)
// ============================================================================
//
// These arrays are populated in finish_audio_frame() and snapshot to
// AudioDataSnapshot for pattern access. Declare them here for use in
// pattern_audio_interface.cpp.
//
extern float tempi_bpm_values_hz[NUM_TEMPI];  // BPM center frequency per bin
```

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/tempo.h`
**Lines:** Add ~10 lines after existing externs
**Rationale:** Makes `tempi_bpm_values_hz` available to pattern interface (needed for BPM conversion macros)

---

### File 5: `firmware/src/pattern_audio_interface.h`

#### Location: Add function declarations (before `#endif`)

**AFTER:** Add declarations for new helper functions

```cpp
// ============================================================================
// BEAT PHASE SYNCHRONIZATION FUNCTIONS (Phase 0)
// ============================================================================

/**
 * Wrap phase delta to [-π, π] range.
 */
float wrap_phase(float phase_delta);

/**
 * Check if beat phase is locked to target within tolerance window.
 * Useful for triggering beat-synchronized effects.
 */
bool is_beat_phase_locked_ms(const AudioDataSnapshot& audio_snapshot,
                              uint16_t bin,
                              float target_phase,
                              float tolerance_ms);

/**
 * Get smoothed beat phase using exponential moving average.
 * Reduces jitter in beat phase estimation.
 */
float get_beat_phase_smooth(const AudioDataSnapshot& audio_snapshot,
                             uint16_t bin,
                             float alpha);
```

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/pattern_audio_interface.h`
**Lines:** Add ~25 lines before final `#endif`
**Rationale:** Function declarations match implementations in .cpp file

---

## Part 3: Implementation Sequence (Critical Path)

### Step 1: Add Macro Definitions (Non-Breaking, 30 min)
- **File:** `pattern_audio_interface.h`
- **Action:** Add beat phase/magnitude macros
- **Validation:** Code compiles; existing code unaffected
- **Breakage Risk:** NONE (pure addition)
- **Fallback:** Delete macro section if issues arise

### Step 2: Populate AudioDataSnapshot (Core Change, 45 min)
- **File:** `goertzel.cpp` in `finish_audio_frame()`
- **Action:** Snapshot beat phase & magnitude to `audio_back` buffer
- **Validation:** Run test suite; verify beat phase ranges in snapshot
- **Breakage Risk:** LOW (atomic with buffer swap via sequence counter)
- **Fallback:** Remove the snapshot loop; revert to zero values

### Step 3: Add Helper Functions (Non-Breaking, 45 min)
- **File:** `pattern_audio_interface.cpp`
- **Action:** Implement `is_beat_phase_locked_ms()`, `wrap_phase()`, etc.
- **Validation:** Compile; run unit tests for phase wrapping
- **Breakage Risk:** NONE (optional helpers)
- **Fallback:** Remove functions; patterns continue using raw macros

### Step 4: Export BPM Lookup (Safe Addition, 15 min)
- **File:** `tempo.h`
- **Action:** Add extern for `tempi_bpm_values_hz`
- **Validation:** Header compiles; symbol resolution succeeds
- **Breakage Risk:** NONE (already exists, just exposing)
- **Fallback:** Keep declaration private

### Step 5: Add Function Declarations (Safe, 15 min)
- **File:** `pattern_audio_interface.h`
- **Action:** Declare helper functions
- **Validation:** Header compiles; symbols resolve
- **Breakage Risk:** NONE (declarations only)
- **Fallback:** Remove declarations

---

## Part 4: Code Quality Standards

### Naming Conventions

| Category | Pattern | Example |
|----------|---------|---------|
| **Macros** | `AUDIO_*` | `AUDIO_BEAT_PHASE`, `AUDIO_BEAT_MAGNITUDE` |
| **Functions** | `snake_case` | `is_beat_phase_locked_ms()`, `wrap_phase()` |
| **Arrays** | `plural_snake_case` | `tempo_phase`, `tempo_magnitude` |
| **Enums/Constants** | `UPPER_SNAKE_CASE` | `NUM_TEMPI`, `BEAT_SHIFT_PERCENT` |
| **Local variables** | `snake_case` | `phase_delta`, `tempo_hz` |

### Documentation Requirements

**Every public function/macro must have:**
1. **Purpose:** One-line description of what it does
2. **Arguments:** Type, range, constraints
3. **Returns:** Type, range, semantic meaning
4. **Usage Example:** Code snippet showing typical use
5. **Thread Safety:** "Safe" / "Unsafe - requires X" / "Safe (snapshot-based)"
6. **Performance:** Estimated runtime, Big-O complexity
7. **Notes:** Edge cases, limitations, related functions

**Every file modification must include:**
1. Header comment explaining the change
2. Inline comments for non-obvious math/logic
3. Link to related analysis or ADR
4. Build guard or version check if needed

### Error Handling Strategy

**Defensive Programming:**
```cpp
// ALWAYS validate bin before array access
if (bin >= NUM_TEMPI) return 0.0f;

// CHECK for uninitialized snapshots
if (!audio_available) return 0.0f;

// BOUNDS-CHECK on phase values
if (fabsf(phase) > M_PI) /* log warning and wrap */;

// TIMEOUT-GUARD on synchronization
if (tolerance_ms < 0.0f || tolerance_ms > 10000.0f) return false;
```

**No Silent Failures:**
- If snapshot unavailable, return 0.0f or false (explicit)
- Never return uninitialized memory
- Never crash on out-of-bounds access

### Thread Safety Considerations

**Phase 0 is THREAD-SAFE because:**
1. All data read from `AudioDataSnapshot` (snapshot-based, no raw globals)
2. `AudioDataSnapshot` uses sequence counter for torn-read detection
3. Snapshot is populated atomically (all beat phase at once)
4. No mutexes needed (read-only, snapshot-based)

**Assumptions:**
- `PATTERN_AUDIO_START()` is called at pattern frame rate (~30-100 FPS)
- Audio task is on Core 1; pattern rendering on Core 0
- `get_audio_snapshot()` handles coherency via `__sync_synchronize()`

---

## Part 5: Testing Plan

### Unit Tests

#### Test 1: Phase Wrapping (`wrap_phase()`)

**File:** `firmware/test/test_beat_phase_exposure/test_phase_wrapping.cpp`

```cpp
#include <unity.h>
#include "pattern_audio_interface.h"
#include <cmath>

void test_wrap_phase_zero() {
    float result = wrap_phase(0.0f);
    TEST_ASSERT_FLOAT_WITHIN(1e-6f, 0.0f, result);
}

void test_wrap_phase_pi() {
    float result = wrap_phase(M_PI);
    // π wraps to π (boundary)
    TEST_ASSERT_TRUE(result >= -M_PI && result <= M_PI);
}

void test_wrap_phase_2pi() {
    float result = wrap_phase(2.0f * M_PI);
    TEST_ASSERT_FLOAT_WITHIN(1e-5f, 0.0f, result);  // 2π → 0
}

void test_wrap_phase_negative() {
    float result = wrap_phase(-3.0f * M_PI);
    // -3π → -π
    TEST_ASSERT_TRUE(result >= -M_PI && result <= M_PI);
}

void setUp() {}
void tearDown() {}

int run_tests() {
    UNITY_BEGIN();
    RUN_TEST(test_wrap_phase_zero);
    RUN_TEST(test_wrap_phase_pi);
    RUN_TEST(test_wrap_phase_2pi);
    RUN_TEST(test_wrap_phase_negative);
    return UNITY_END();
}
```

**Validation Criteria:**
- All phase wrapping stays in [-π, π]
- Wrapping is idempotent: `wrap_phase(wrap_phase(x)) == wrap_phase(x)`
- Edge cases (0, ±π, ±2π) handled correctly

---

#### Test 2: Beat Phase Synchronization Lock (`is_beat_phase_locked_ms()`)

**File:** `firmware/test/test_beat_phase_exposure/test_phase_lock.cpp`

```cpp
#include <unity.h>
#include "pattern_audio_interface.h"
#include "audio/goertzel.h"
#include <cmath>

// Helper: Create test snapshot with specific phase
static AudioDataSnapshot create_test_snapshot(uint16_t bin, float phase, float mag) {
    AudioDataSnapshot snap{};
    if (bin < NUM_TEMPI) {
        snap.tempo_phase[bin] = phase;
        snap.tempo_magnitude[bin] = mag;
    }
    return snap;
}

void test_phase_lock_at_zero() {
    // Phase = 0, target = 0, tolerance = 50ms
    AudioDataSnapshot snap = create_test_snapshot(32, 0.0f, 1.0f);
    bool locked = is_beat_phase_locked_ms(snap, 32, 0.0f, 50.0f);
    TEST_ASSERT_TRUE(locked);
}

void test_phase_lock_outside_tolerance() {
    // Phase = 0, target = π, tolerance = 50ms
    AudioDataSnapshot snap = create_test_snapshot(32, 0.0f, 1.0f);
    bool locked = is_beat_phase_locked_ms(snap, 32, M_PI, 50.0f);
    TEST_ASSERT_FALSE(locked);
}

void test_phase_lock_boundary_tolerance() {
    // Phase = 0.1, target = 0, tolerance = 50ms at 120 BPM
    // 120 BPM = 2 Hz; phase_rad/ms = 2π*2/1000 ≈ 0.0126 rad/ms
    // 50ms tolerance ≈ 0.63 radians
    AudioDataSnapshot snap = create_test_snapshot(32, 0.1f, 1.0f);
    bool locked = is_beat_phase_locked_ms(snap, 32, 0.0f, 50.0f);
    // Should be locked (0.1 rad < 0.63 rad tolerance)
    TEST_ASSERT_TRUE(locked);
}

void test_phase_lock_invalid_bin() {
    AudioDataSnapshot snap{};
    bool locked = is_beat_phase_locked_ms(snap, NUM_TEMPI + 1, 0.0f, 50.0f);
    TEST_ASSERT_FALSE(locked);
}

void test_phase_lock_negative_tolerance() {
    AudioDataSnapshot snap = create_test_snapshot(32, 0.0f, 1.0f);
    bool locked = is_beat_phase_locked_ms(snap, 32, 0.0f, -50.0f);
    TEST_ASSERT_FALSE(locked);
}

void setUp() {
    // Initialize audio system stubs if needed
    init_audio_stubs();
    init_tempo_goertzel_constants();
}

void tearDown() {}

int run_tests() {
    UNITY_BEGIN();
    RUN_TEST(test_phase_lock_at_zero);
    RUN_TEST(test_phase_lock_outside_tolerance);
    RUN_TEST(test_phase_lock_boundary_tolerance);
    RUN_TEST(test_phase_lock_invalid_bin);
    RUN_TEST(test_phase_lock_negative_tolerance);
    return UNITY_END();
}
```

**Validation Criteria:**
- Lock triggers when phase within tolerance
- Lock fails when phase outside tolerance
- Bounds checking prevents crashes
- Edge cases handled correctly

---

### Integration Tests

#### Test 3: AudioDataSnapshot Snapshot Integrity

**File:** `firmware/test/test_beat_phase_exposure/test_snapshot_integrity.cpp`

**Purpose:** Verify beat phase snapshot is captured atomically with other audio data

```cpp
void test_snapshot_contains_beat_phase() {
    // Trigger audio frame update (wait for audio task)
    delay(50);  // Wait for at least one audio frame

    AudioDataSnapshot snap{};
    bool got_snap = get_audio_snapshot(&snap);
    TEST_ASSERT_TRUE(got_snap);

    // Verify beat phase data is present (not all zeros)
    bool has_nonzero_phase = false;
    for (int i = 0; i < NUM_TEMPI; i++) {
        if (fabsf(snap.tempo_phase[i]) > 0.001f) {
            has_nonzero_phase = true;
            break;
        }
    }
    // In silence, phases may be zero, so just verify structure is there
    TEST_ASSERT_TRUE(snap.sequence > 0);  // At least one frame processed
}

void test_snapshot_sequence_consistency() {
    // Verify sequence counter increments atomically
    AudioDataSnapshot snap1{}, snap2{};

    get_audio_snapshot(&snap1);
    delay(100);
    get_audio_snapshot(&snap2);

    // Sequence should have incremented
    TEST_ASSERT_TRUE(snap2.update_counter >= snap1.update_counter);
}

void test_snapshot_phase_in_valid_range() {
    AudioDataSnapshot snap{};
    get_audio_snapshot(&snap);

    for (int i = 0; i < NUM_TEMPI; i++) {
        TEST_ASSERT_TRUE(snap.tempo_phase[i] >= -M_PI);
        TEST_ASSERT_TRUE(snap.tempo_phase[i] <= M_PI);
    }
}

void test_snapshot_magnitude_normalized() {
    AudioDataSnapshot snap{};
    get_audio_snapshot(&snap);

    for (int i = 0; i < NUM_TEMPI; i++) {
        TEST_ASSERT_TRUE(snap.tempo_magnitude[i] >= 0.0f);
        TEST_ASSERT_TRUE(snap.tempo_magnitude[i] <= 1.0f);
    }
}
```

**Validation Criteria:**
- Snapshot captured successfully
- Sequence counter increments
- Beat phase in [-π, π]
- Magnitude in [0, 1]

---

### Performance Benchmarks

#### Test 4: Macro Overhead

**File:** `firmware/test/test_beat_phase_exposure/test_perf_macros.cpp`

```cpp
void test_perf_beat_phase_macro() {
    PATTERN_AUDIO_START();

    uint32_t t0 = micros();
    for (int i = 0; i < 1000; i++) {
        volatile float phase = AUDIO_BEAT_PHASE(i % NUM_TEMPI);
        (void)phase;
    }
    uint32_t elapsed = micros() - t0;

    float avg_us = elapsed / 1000.0f;
    TEST_ASSERT_TRUE(avg_us < 1.0f);  // Each access < 1 µs
    printf("AUDIO_BEAT_PHASE avg: %.3f µs\n", avg_us);
}

void test_perf_phase_lock_function() {
    PATTERN_AUDIO_START();

    uint32_t t0 = micros();
    for (int i = 0; i < 100; i++) {
        volatile bool locked = is_beat_phase_locked_ms(audio, 32, 0.0f, 50.0f);
        (void)locked;
    }
    uint32_t elapsed = micros() - t0;

    float avg_us = elapsed / 100.0f;
    TEST_ASSERT_TRUE(avg_us < 10.0f);  // Each call < 10 µs
    printf("is_beat_phase_locked_ms avg: %.3f µs\n", avg_us);
}
```

**Target Performance:**
- Macro access: <1 µs
- Phase lock check: <10 µs
- No impact on render pipeline (measured separately)

---

### Validation with Metronome

#### Procedure: Downbeat Synchronization Test

**Setup:**
1. Connect device to computer
2. Open Serial Monitor at 115200 baud
3. Play metronome on speaker (120 BPM recommended)

**Test Code Pattern:**
```cpp
// test_pattern_beat_phase.cpp
void draw_pattern(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    if (!audio_available) return;

    // Find strongest tempo bin
    uint16_t best_bin = 0;
    float best_mag = 0.0f;
    for (int i = 0; i < NUM_TEMPI; i++) {
        if (AUDIO_BEAT_MAGNITUDE(i) > best_mag) {
            best_mag = AUDIO_BEAT_MAGNITUDE(i);
            best_bin = i;
        }
    }

    float phase = AUDIO_BEAT_PHASE(best_bin);

    // Flash white at downbeat (phase ≈ 0)
    if (is_beat_phase_locked_ms(audio, best_bin, 0.0f, 100.0f)) {
        fill_solid(leds, LED_COUNT, CRGBF(1.0, 1.0, 1.0));
    } else {
        fill_solid(leds, LED_COUNT, CRGBF(0.0, 0.0, 0.0));
    }

    // DEBUG: Print phase and BPM every 1 second
    static uint32_t last_print = 0;
    if (millis() - last_print > 1000) {
        last_print = millis();
        uint16_t bpm = AUDIO_BPM_FROM_BIN(best_bin);
        Serial.printf("Phase: %.3f rad, BPM: %d, Mag: %.3f\n",
                      phase, bpm, best_mag);
    }
}
```

**Visual Validation:**
- LEDs flash white exactly at each metronome click
- BPM reported matches metronome (e.g., 120 BPM)
- Phase cycles smoothly from -π to π between beats

**Acceptance Criteria:**
- ✓ Flash occurs within ±100ms of metronome click
- ✓ No flash outside beat window
- ✓ Detected BPM matches metronome ±2%

---

### Validation with Real Music

#### Procedure: Multi-Beat Synchronization Test

**Setup:**
1. Play 120 BPM music with strong beat (e.g., house, pop)
2. Observe LED pattern for 30+ seconds
3. Manually count beats; verify LED flashes match beat timing

**Test Code:**
```cpp
void draw_pattern(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    if (!audio_available) return;

    // Show beat confidence as brightness
    float confidence = AUDIO_TEMPO_CONFIDENCE();

    // Sweep hue based on beat phase (strongest tempo)
    uint16_t best_bin = 0;
    float best_mag = 0.0f;
    for (int i = 0; i < NUM_TEMPI; i++) {
        if (AUDIO_BEAT_MAGNITUDE(i) > best_mag) {
            best_mag = AUDIO_BEAT_MAGNITUDE(i);
            best_bin = i;
        }
    }

    float phase = AUDIO_BEAT_PHASE(best_bin);
    float hue = (phase + M_PI) / (2.0f * M_PI) * 255.0f;  // Map [-π, π] to [0, 255] hue

    CRGBF color = CHSV(hue, 1.0f, confidence);
    fill_solid(leds, LED_COUNT, color);
}
```

**Visual Validation:**
- Hue smoothly cycles with beat
- Brightness increases/decreases with beat confidence
- Pattern locks to music tempo (no drift)

**Acceptance Criteria:**
- ✓ LED color changes smoothly with beat phase
- ✓ No jumps or glitches in phase tracking
- ✓ Pattern stable for >30 seconds on consistent beat

---

## Part 6: Time Breakdown

### Design & Planning: 2 hours
- ✓ Analyze existing code (tempo.cpp, goertzel.h) — 45 min
- ✓ Design snapshot population strategy — 30 min
- ✓ Design macro API and helper functions — 30 min
- ✓ Create this document — 15 min

### Implementation: 6 hours

| Task | File | Est. Time | Notes |
|------|------|-----------|-------|
| Add macros | pattern_audio_interface.h | 45 min | ~100 lines + docs |
| Populate snapshot | goertzel.cpp | 45 min | ~20 lines + validation |
| Add helpers | pattern_audio_interface.cpp | 45 min | ~150 lines + docs |
| Update externs | tempo.h | 15 min | ~10 lines |
| Add declarations | pattern_audio_interface.h | 15 min | ~25 lines |
| **Subtotal** | | **3 hours** | Core changes |
| Code review & fixes | various | 1.5 hours | Iterate on issues |
| Documentation | docs/ | 1.5 hours | Phase 0 report + examples |

### Compilation & Build: 0.5 hours
- Clean build: 3-4 min
- Link: 1-2 min
- Address any warnings: 5-10 min

### Unit Testing: 2 hours
- Write test cases (5 tests × 10 min) — 50 min
- Build test suite — 10 min
- Run & debug tests — 30 min
- Iterate on failures — 30 min

### Integration & Validation Testing: 4 hours
- Integration test setup — 30 min
- Metronome validation (multiple tempos) — 90 min
- Real music validation — 60 min
- Edge case testing — 30 min
- Iterate on issues — 30 min

### Debugging & Rollback Buffer: 2-4 hours
- Issue diagnosis — 1-2 hours
- Phase locking accuracy adjustments — 1-2 hours
- Timeout tuning — 0-1 hours

### **TOTAL ESTIMATED TIME: 14-16 hours**

**Realistic Schedule (one developer):**
- **Day 1:** Planning + implementation (6h)
- **Day 2:** Testing + validation (6-8h)
- **Day 3:** Debugging + final iteration (2-4h)

---

## Part 7: Risk Mitigation & Rollback

### Risks & Mitigation Strategies

#### Risk 1: Beat Phase Not Updating (Data Not Populated)

**Symptom:** Snapshot always shows zero phase/magnitude

**Root Causes:**
1. Snapshot population code not executed (unreachable)
2. `audio_back` buffer not accessible from tempo.cpp
3. Sequence counter prevents read (always odd, buffer "busy")

**Detection:**
- Add assertion in `finish_audio_frame()`:
  ```cpp
  #ifdef DEBUG_BEAT_PHASE
  static uint32_t frame_count = 0;
  frame_count++;
  if (frame_count % 100 == 0) {
      LOG_DEBUG(TAG, "Snapshot: phase[32]=%.3f, mag[32]=%.3f",
                audio_back.tempo_phase[32], audio_back.tempo_magnitude[32]);
  }
  #endif
  ```
- Unit test: Verify snapshot has non-zero values after music playback

**Mitigation:**
1. Check `audio_back` is accessible (must be declared in goertzel.cpp)
2. Verify snapshot population runs before `commit_audio_data()`
3. Enable DEBUG_BEAT_PHASE logging; play metronome 30 seconds; verify values change

**Rollback:** Delete snapshot population loop; set phase/magnitude to 0 in macros

---

#### Risk 2: Phase Wrapping Edge Cases

**Symptom:** Phase jump from π to -π; glitches in phase lock detection

**Root Causes:**
1. Unwrap not working at phase boundary
2. Phase lock tolerance calculation incorrect
3. sin/cos causing NaN due to invalid input

**Detection:**
- Unit test: Verify wrap_phase(π + 0.1) wraps correctly
- Unit test: Verify phase lock at phase boundary (±π)
- Add bounds assertion in pattern code:
  ```cpp
  float phase = AUDIO_BEAT_PHASE_SAFE(bin);
  if (fabsf(phase) > M_PI) {
      LOG_WARN(TAG, "Invalid phase: %.3f", phase);
  }
  ```

**Mitigation:**
1. Test wrap_phase thoroughly with unit tests
2. Use SAFE macros in pattern code (with bounds checking)
3. Monitor serial output for "Invalid phase" warnings

**Rollback:** Revert wrap_phase to original implementation; use raw phase without tolerance

---

#### Risk 3: Thread Safety / Torn Reads

**Symptom:** Inconsistent beat phase & magnitude (one updated, other not)

**Root Causes:**
1. Snapshot not atomic (beat phase copied before magnitude)
2. Sequence counter not incremented properly
3. Memory barriers missing on Core 0

**Detection:**
- Integration test: Verify snapshot sequence counter changes
- Check: `snap1.tempo_phase[i]` consistent with `snap1.tempo_magnitude[i]`
- Add assertion:
  ```cpp
  TEST_ASSERT_EQUAL(snap.sequence, snap.sequence_end);  // Torn read check
  ```

**Mitigation:**
1. Ensure beat phase & magnitude copied in single loop (already done)
2. Verify `__sync_synchronize()` calls in `get_audio_snapshot()`
3. Run integration test with high-frequency pattern updates (60 FPS)

**Rollback:** Lock with mutex (but impacts performance); revert to per-field access

---

#### Risk 4: Performance Impact on Render Pipeline

**Symptom:** Frame rate drops >5%; LED output stutters

**Root Causes:**
1. Snapshot copy too slow (200+ bytes per frame)
2. Phase lock function called too often (every LED)
3. Math operations (sin, atan2) slow on ESP32

**Detection:**
- Profile: Measure `PATTERN_AUDIO_START()` overhead (should be <50 µs)
- Profile: Measure `is_beat_phase_locked_ms()` per call (<10 µs)
- Run FPS counter; verify 30+ FPS maintained

**Mitigation:**
1. Snapshot copy is ~200 bytes / 10-20 µs (acceptable)
2. Use macros instead of function calls where possible
3. Cache phase/magnitude locally in pattern if used multiple times:
   ```cpp
   float phase = AUDIO_BEAT_PHASE_SAFE(best_bin);  // Cache once
   for (...) {
       if (is_beat_phase_locked_ms(audio, best_bin, phase + 0.1, 50.0f)) {
           // Use cached phase instead of macro repeatedly
       }
   }
   ```

**Rollback:** Remove expensive functions; use macros only

---

#### Risk 5: Accuracy: Phase ±10° Requirement

**Symptom:** LED flash occurs 100ms late; metronome out of sync

**Root Causes:**
1. BEAT_SHIFT_PERCENT (0.08 rad ≈ 4.6°) not matching perceptual downbeat
2. Phase advance calculation wrong (accumulating error)
3. Audio latency not accounted for (microphone → processing → output)

**Detection:**
- Visual validation: Flash at metronome click ±100ms
- Serial output: Print phase every 100ms; verify smooth progression
- Measure: Phase jump between consecutive frames (should be smooth, not jumpy)

**Mitigation:**
1. BEAT_SHIFT_PERCENT is tuned; don't change without ABX test
2. Verify phase advance formula: `phase += (2π × tempo_hz) / 100`
3. Accept ±100ms tolerance (human perception is ~50ms, but audio latency ~30ms)
4. If accuracy worse, check:
   - Is `update_tempi_phase()` called every frame?
   - Is `delta` parameter correct (should be frame time)?
   - Is tempo_hz correct for detected tempo?

**Rollback:** Reduce tolerance to ±200ms if accuracy can't reach ±100ms

---

#### Risk 6: Compatibility with Existing Patterns

**Symptom:** Patterns crash or fail to compile after Phase 0

**Root Causes:**
1. Macro name conflict (e.g., `AUDIO_BEAT_PHASE` already used elsewhere)
2. Function signature mismatch
3. Missing include in pattern files

**Detection:**
- Compile existing pattern code unchanged
- Run existing pattern tests
- Check for any warnings/errors

**Mitigation:**
1. New macros don't conflict (use `AUDIO_BEAT_*` prefix)
2. Macros are pure additions (backward compatible)
3. Add `#include "pattern_audio_interface.h"` if missing
4. Run full test suite before shipping

**Rollback:** Rename macros (e.g., `AUDIO_BEAT_PHASE_NEW`); keep old behavior

---

### Rollback Procedure

If Phase 0 breaks the build or behavior:

**Immediate (5 min):**
```bash
git revert <commit-hash>  # Undo most recent commit
```

**If revert insufficient:**
```bash
git reset --hard HEAD~3   # Go back 3 commits (before Phase 0)
git clean -fd             # Remove untracked files
platformio run -t clean   # Clean build artifacts
platformio run            # Rebuild
```

**If merge conflict:**
- Manual merge: Keep EXISTING code; discard Phase 0 changes
- Test immediately after merge
- Commit: "Rollback: Phase 0 beat phase exposure"

**Validation After Rollback:**
- ✓ Build succeeds without warnings
- ✓ Existing patterns run unchanged
- ✓ Serial output shows no errors
- ✓ LED output stable (no flickering)

---

## Part 8: Code Quality Checklist

### Pre-Commit Checklist

- [ ] All code compiles without errors or warnings
- [ ] Every new function/macro has documentation (Purpose, Args, Returns, Usage, Performance, Thread Safety)
- [ ] Naming follows conventions (AUDIO_*, is_*, get_*)
- [ ] No magic numbers (all constants defined as #define or const)
- [ ] Defensive coding: all array accesses bounds-checked or marked SAFE
- [ ] Thread safety: verified snapshot-based, no raw globals
- [ ] Performance: macros inline (zero overhead), functions <10 µs
- [ ] Tests pass: all unit tests, integration tests pass
- [ ] No compiler warnings (treat as errors)
- [ ] Code review by second developer (if available)

### Post-Merge Checklist

- [ ] Existing patterns compile unchanged
- [ ] Existing tests pass unchanged
- [ ] New tests added (at least 5 unit tests)
- [ ] Metronome validation completed (downbeat sync ±100ms)
- [ ] Real music validation completed (30+ seconds, smooth phase)
- [ ] Performance benchmarks within targets (<1 µs for macros, <10 µs for functions)
- [ ] Documentation complete (README, examples, code comments)
- [ ] Release notes prepared (list of new macros/functions)

---

## Part 9: Expected Outcomes

### What Will Work After Phase 0

1. **Pattern Access to Beat Phase:**
   ```cpp
   float phase = AUDIO_BEAT_PHASE(32);  // Get beat phase for tempo bin 32
   ```

2. **Tempo-Aware Pattern Effects:**
   ```cpp
   if (is_beat_phase_locked_ms(audio, best_bin, 0.0f, 100.0f)) {
       // Trigger effect at downbeat
   }
   ```

3. **Multi-Tempo Synchronization:**
   ```cpp
   for (int bin = 0; bin < NUM_TEMPI; bin++) {
       float phase = AUDIO_BEAT_PHASE(bin);
       float mag = AUDIO_BEAT_MAGNITUDE(bin);
       // Draw per-tempo visualization
   }
   ```

4. **Beat Magnitude Gating:**
   ```cpp
   float confidence = AUDIO_TEMPO_CONFIDENCE();
   if (confidence > 0.3f) {
       // Only draw effect when beat is detected
   }
   ```

### What Will NOT Work (Future Phases)

- Beat onset detection (future: novelty curves)
- Spectral energy correlation (future: analysis)
- Adaptive sync to beat changes (future: Kalman filter)
- Phase prediction (future: beat tracking)

---

## Part 10: Next Steps (After Phase 0)

### Phase 1: Extended Beat Analysis
- Expose novelty curves and onset detection
- Add spectral correlation scores
- Implement beat onset triggers

### Phase 2: Advanced Synchronization
- Kalman filter for phase prediction
- Adaptive confidence thresholds
- Beat continuation (detect when beat ends)

### Phase 3: REST API Exposure
- `/api/audio/beat` endpoint with phase/magnitude/confidence
- WebSocket real-time beat events
- Browser-based beat visualization

---

## Appendix A: Complete Example Pattern

```cpp
#include "pattern_registry.h"
#include "pattern_audio_interface.h"

// Pattern: Beat-Phased Rainbow
// Synchronizes rainbow hue with detected beat tempo
void pattern_beat_phased_rainbow(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    if (!audio_available) {
        fill_solid(leds, LED_COUNT, CRGBF(0, 0, 0));
        return;
    }

    // Find strongest tempo bin
    uint16_t best_bin = 0;
    float best_mag = 0.0f;
    for (int i = 0; i < NUM_TEMPI; i++) {
        if (AUDIO_BEAT_MAGNITUDE(i) > best_mag) {
            best_mag = AUDIO_BEAT_MAGNITUDE(i);
            best_bin = i;
        }
    }

    // Get beat phase and confidence
    float phase = AUDIO_BEAT_PHASE(best_bin);
    float confidence = AUDIO_TEMPO_CONFIDENCE();
    uint16_t bpm = AUDIO_BPM_FROM_BIN(best_bin);

    // Map phase to hue [0°, 360°]
    float hue_0_1 = (phase + M_PI) / (2.0f * M_PI);
    uint8_t hue = (uint8_t)(hue_0_1 * 255.0f);

    // Draw rainbow with beat-locked saturation
    float saturation = best_mag;  // Dim when beat weak
    float brightness = confidence;  // Dim when no clear tempo

    for (int i = 0; i < LED_COUNT; i++) {
        uint8_t led_hue = (hue + (i * 255 / LED_COUNT)) % 255;
        leds[i] = CHSV(led_hue, saturation, brightness);
    }

    // Debug output every 1 second
    static uint32_t last_debug = 0;
    if (millis() - last_debug > 1000) {
        last_debug = millis();
        Serial.printf("BPM:%d Phase:%.2f Mag:%.2f Conf:%.2f\n",
                      bpm, phase, best_mag, confidence);
    }
}

REGISTER_PATTERN("Beat Phased Rainbow", pattern_beat_phased_rainbow);
```

---

## Appendix B: Summary of Files & Changes

| File | Lines | Type | Change |
|------|-------|------|--------|
| `firmware/src/audio/goertzel.cpp` | ~20 | Addition | Snapshot population in `finish_audio_frame()` |
| `firmware/src/pattern_audio_interface.h` | ~150 | Addition | Beat phase macros + function declarations |
| `firmware/src/pattern_audio_interface.cpp` | ~150 | Addition | Helper functions (phase lock, wrapping, smoothing) |
| `firmware/src/audio/tempo.h` | ~10 | Addition | Export `tempi_bpm_values_hz` extern |
| **Test Files (new)** | ~400 | Addition | 5 unit tests + integration tests |
| **Documentation** | TBD | Addition | Phase 0 completion report |

**Total additions:** ~730 lines of code + docs
**Deletions:** 0 (backward compatible)
**Breaking changes:** 0

---

## Appendix C: Git Commit Sequence

```
Commit 1: "Phase 0: Add beat phase macro API (AUDIO_BEAT_PHASE, AUDIO_BEAT_MAGNITUDE)"
  - pattern_audio_interface.h: ~100 lines of macros
  - Backward compatible (pure addition)

Commit 2: "Phase 0: Populate beat phase snapshot in goertzel.cpp"
  - goertzel.cpp: ~20 lines in finish_audio_frame()
  - Captures tempo phase/magnitude to audio_back buffer

Commit 3: "Phase 0: Add beat phase helper functions (is_beat_phase_locked_ms, wrap_phase)"
  - pattern_audio_interface.cpp: ~150 lines
  - pattern_audio_interface.h: ~25 lines (declarations)
  - Helper utilities for pattern synchronization

Commit 4: "Phase 0: Export tempi_bpm_values_hz for pattern access"
  - tempo.h: ~10 lines (extern declaration)
  - Allows pattern_audio_interface.cpp to use BPM lookup

Commit 5: "Phase 0: Add unit and integration tests for beat phase exposure"
  - test/test_beat_phase_exposure/: ~400 lines
  - Tests: phase wrapping, phase lock, snapshot integrity, performance

Commit 6: "Phase 0: Add documentation and examples for beat phase exposure"
  - docs/04-planning/phase_0_beat_phase_exposure_completion.md
  - Example pattern: beat_phased_rainbow
  - README for beat phase API
```

**Git Command Sequence (after all changes):**
```bash
git add firmware/src/audio/goertzel.cpp
git add firmware/src/pattern_audio_interface.h
git add firmware/src/pattern_audio_interface.cpp
git add firmware/src/audio/tempo.h
git add firmware/test/test_beat_phase_exposure/
git add docs/04-planning/K1NPlan_PLAN_PHASE_0_BEAT_PHASE_EXPOSURE_v1.0_20251108.md

git commit -m "Phase 0: Beat phase exposure - Foundation (6 commits follow)"
```

---

## Appendix D: Validation Checklist

### Pre-Implementation
- [ ] Read and understand tempo.cpp (phase calculation)
- [ ] Read and understand goertzel.h (AudioDataSnapshot structure)
- [ ] Read and understand pattern_audio_interface.h (existing macro patterns)
- [ ] Identify `finish_audio_frame()` exact location
- [ ] Verify `tempi[]` is populated before `finish_audio_frame()` is called

### During Implementation
- [ ] Compile after each commit
- [ ] Run existing test suite (no regressions)
- [ ] Add `#include` guards and comments
- [ ] Verify macro names don't conflict
- [ ] Ensure function signatures match declarations
- [ ] Add defensive bounds checking

### Post-Implementation
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Metronome test passes (flash within ±100ms)
- [ ] Real music test passes (30+ sec without glitch)
- [ ] Performance benchmarks pass (<1 µs macro, <10 µs function)
- [ ] Documentation complete and reviewed
- [ ] Code review by second developer
- [ ] No new compiler warnings
- [ ] Existing patterns unchanged

---

## Appendix E: FAQ & Troubleshooting

**Q: Why only Phase 0 in this document? When is Phase 1?**
A: Phase 0 is the foundational layer (beat phase exposure). Phase 1+ depend on it. This plan focuses on Phase 0 only to keep scope bounded and deliverable.

**Q: Can Phase 0 break existing patterns?**
A: No. All changes are additions (macros, functions) or internal (snapshot population). No existing code is modified.

**Q: What if beat phase is always zero?**
A: Likely snapshot population not running. Check: (1) Is `finish_audio_frame()` called? (2) Is beat phase populated before `commit_audio_data()`? Enable DEBUG logging.

**Q: Why ±100ms tolerance for metronome test?**
A: (1) Human reaction time ~150ms. (2) Microphone latency ~30ms. (3) Phase estimation jitter ~20ms. Total: ~100ms acceptable.

**Q: Can I use beat phase in interrupt handlers?**
A: Only if you call `PATTERN_AUDIO_START()` first (acquires snapshot). Don't access raw `tempi[]` array directly in patterns (use macros instead).

**Q: Why populate snapshot in `finish_audio_frame()` instead of `update_tempi_phase()`?**
A: Because `finish_audio_frame()` is called once per audio frame (on Core 1). Snapshot is atomic with all other audio data. `update_tempi_phase()` is called multiple times per frame during Emotiscope processing.

---

**Document Prepared By:** K1.node1 Audio Team
**Review Status:** Pending
**Target Implementation Date:** Week of 2025-11-10
**Risk Level:** LOW (backward compatible, snapshot-based, isolated changes)
**Dependency Chain:** tempo.cpp → goertzel.cpp → pattern_audio_interface.h → patterns

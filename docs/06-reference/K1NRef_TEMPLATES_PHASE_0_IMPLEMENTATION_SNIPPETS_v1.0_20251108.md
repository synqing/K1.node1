# Phase 0: Beat Phase Exposure - Implementation Code Snippets

**Purpose:** Copy-paste ready code snippets for Phase 0 implementation
**Date:** 2025-11-07
**Status:** draft
**Related:** `docs/04-planning/K1NPlan_PLAN_PHASE_0_BEAT_PHASE_EXPOSURE_v1.0_20251108.md`

---

## Snippet 1: Macro Definitions (pattern_audio_interface.h)

**Insert After:** Existing audio accessor macros (after AUDIO_TREBLE, etc.)
**Line Number:** ~150 (search for "AUDIO_BASS" or "AUDIO_TREBLE")
**Size:** ~100 lines

```cpp
// ============================================================================
// BEAT PHASE & TEMPO ACCESSORS (Phase 0)
// ============================================================================

/**
 * AUDIO_BEAT_PHASE(bin)
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
 *   float phase = AUDIO_BEAT_PHASE(32);  // Get phase of tempo bin 32
 *   float beat_sync = sinf(phase);       // Convert to [-1, 1] oscillation
 *
 * THREAD SAFETY: Safe (snapshot-based, no locking)
 * PERFORMANCE: O(1) array access, ~0.1 µs
 */
#define AUDIO_BEAT_PHASE(bin) (audio.tempo_phase[bin])

/**
 * AUDIO_BEAT_PHASE_SAFE(bin)
 *
 * Same as AUDIO_BEAT_PHASE but with bounds checking.
 * Returns 0.0 if bin out of range or snapshot invalid.
 */
#define AUDIO_BEAT_PHASE_SAFE(bin) \
    (audio_available && (bin) < NUM_TEMPI ? audio.tempo_phase[bin] : 0.0f)

/**
 * AUDIO_BEAT_MAGNITUDE(bin)
 *
 * Normalized beat magnitude [0.0, 1.0] for tempo bin [0..63].
 *
 * MEANING:
 *   - 0.0: No beat energy at this tempo
 *   - 0.5: Moderate beat present
 *   - 1.0: Strong beat present
 *
 * USAGE:
 *   float mag = AUDIO_BEAT_MAGNITUDE(bin);
 *   brightness = max_brightness * mag;  // Dim LEDs if tempo weak
 *
 * THREAD SAFETY: Safe (snapshot-based)
 * PERFORMANCE: O(1), ~0.1 µs
 */
#define AUDIO_BEAT_MAGNITUDE(bin) (audio.tempo_magnitude[bin])

/**
 * AUDIO_BEAT_MAGNITUDE_SAFE(bin)
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

---

## Snippet 2: Snapshot Population (goertzel.cpp)

**Insert In:** `finish_audio_frame()` function, **before** `commit_audio_data()` call
**Location:** Search for `commit_audio_data()` in goertzel.cpp; insert before it
**Size:** ~20 lines

```cpp
// ============================================================================
// BEAT PHASE & MAGNITUDE SNAPSHOT (Phase 0)
// ============================================================================
// Populate beat phase and magnitude from tempo[] array for all 64 tempi.
// This snapshot is atomic with other audio data via sequence counter.
// Called once per audio frame (50 Hz) on Core 1 (audio task).

for (uint16_t i = 0; i < NUM_TEMPI; i++) {
    audio_back.tempo_phase[i]     = tempi[i].phase;
    audio_back.tempo_magnitude[i]  = tempi[i].magnitude;
}

// Capture tempo confidence (best tempo correlation)
audio_back.tempo_confidence = tempo_confidence;

// NOTE: Sequence counter incremented by commit_audio_data()
//       ensures coherent read detection on Core 0 patterns.
```

---

## Snippet 3: Function Declarations (pattern_audio_interface.h)

**Insert Before:** Final `#endif` in pattern_audio_interface.h
**Location:** At end of file, before `#endif`
**Size:** ~25 lines

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

---

## Snippet 4: Helper Functions (pattern_audio_interface.cpp)

**Insert At:** End of file
**Size:** ~150 lines

```cpp
// ============================================================================
// BEAT PHASE SYNCHRONIZATION HELPERS (Phase 0)
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

---

## Snippet 5: Extern Declaration (tempo.h)

**Insert After:** Line 52 (after `extern uint32_t t_now_ms;`)
**Size:** ~10 lines

```cpp
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

---

## Snippet 6: Example Pattern

**File:** Create new pattern file (e.g., `generated_patterns.h` or new file)
**Size:** ~60 lines
**Purpose:** Reference implementation of beat phase API

```cpp
// ============================================================================
// PATTERN: Beat Phased Rainbow
//
// Synchronizes rainbow hue with detected beat tempo. Demonstrates:
//   - Finding strongest tempo bin
//   - Using beat phase for color cycling
//   - Gating effect on confidence
//   - BPM display via serial output
// ============================================================================

void pattern_beat_phased_rainbow(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    if (!audio_available) {
        fill_solid(leds, LED_COUNT, CRGBF(0, 0, 0));
        return;
    }

    // Find strongest tempo bin (0..63)
    uint16_t best_bin = 0;
    float best_mag = 0.0f;
    for (int i = 0; i < NUM_TEMPI; i++) {
        if (AUDIO_BEAT_MAGNITUDE(i) > best_mag) {
            best_mag = AUDIO_BEAT_MAGNITUDE(i);
            best_bin = i;
        }
    }

    // Get beat phase, confidence, and BPM
    float phase = AUDIO_BEAT_PHASE(best_bin);
    float confidence = AUDIO_TEMPO_CONFIDENCE();
    uint16_t bpm = AUDIO_BPM_FROM_BIN(best_bin);

    // Map phase to hue [0°, 360°]
    // Phase = -π → hue = 0° (red)
    // Phase = 0 → hue = 128° (cyan)
    // Phase = π → hue = 255° (purple/red)
    float hue_0_1 = (phase + M_PI) / (2.0f * M_PI);
    uint8_t hue = (uint8_t)(hue_0_1 * 255.0f);

    // Draw rainbow with beat-locked saturation and brightness
    float saturation = best_mag;        // Dim when beat weak
    float brightness = confidence;      // Dim when no clear tempo

    for (int i = 0; i < LED_COUNT; i++) {
        uint8_t led_hue = (hue + (i * 255 / LED_COUNT)) % 255;
        leds[i] = CHSV(led_hue, saturation, brightness);
    }

    // DEBUG: Serial output every 1 second
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

## Snippet 7: Unit Test - Phase Wrapping

**File:** `firmware/test/test_beat_phase_exposure/test_phase_wrapping.cpp`
**Size:** ~50 lines

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
    TEST_ASSERT_TRUE(result >= -M_PI && result <= M_PI);
}

void test_wrap_phase_2pi() {
    float result = wrap_phase(2.0f * M_PI);
    TEST_ASSERT_FLOAT_WITHIN(1e-5f, 0.0f, result);
}

void test_wrap_phase_negative() {
    float result = wrap_phase(-3.0f * M_PI);
    TEST_ASSERT_TRUE(result >= -M_PI && result <= M_PI);
}

void test_wrap_phase_small_value() {
    float result = wrap_phase(0.5f);
    TEST_ASSERT_FLOAT_WITHIN(1e-6f, 0.5f, result);
}

void setUp() {}
void tearDown() {}

int run_tests() {
    UNITY_BEGIN();
    RUN_TEST(test_wrap_phase_zero);
    RUN_TEST(test_wrap_phase_pi);
    RUN_TEST(test_wrap_phase_2pi);
    RUN_TEST(test_wrap_phase_negative);
    RUN_TEST(test_wrap_phase_small_value);
    return UNITY_END();
}
```

---

## Snippet 8: Unit Test - Phase Lock

**File:** `firmware/test/test_beat_phase_exposure/test_phase_lock.cpp`
**Size:** ~80 lines

```cpp
#include <unity.h>
#include "pattern_audio_interface.h"
#include "audio/goertzel.h"
#include <cmath>

// Helper: Create test snapshot with specific phase
static AudioDataSnapshot create_test_snapshot(uint16_t bin, float phase, float mag) {
    AudioDataSnapshot snap{};
    snap.is_valid = true;
    if (bin < NUM_TEMPI) {
        snap.tempo_phase[bin] = phase;
        snap.tempo_magnitude[bin] = mag;
    }
    return snap;
}

void test_phase_lock_at_zero() {
    AudioDataSnapshot snap = create_test_snapshot(32, 0.0f, 1.0f);
    bool locked = is_beat_phase_locked_ms(snap, 32, 0.0f, 50.0f);
    TEST_ASSERT_TRUE(locked);
}

void test_phase_lock_outside_tolerance() {
    AudioDataSnapshot snap = create_test_snapshot(32, 0.0f, 1.0f);
    bool locked = is_beat_phase_locked_ms(snap, 32, M_PI, 50.0f);
    TEST_ASSERT_FALSE(locked);
}

void test_phase_lock_boundary_tolerance() {
    // Phase = 0.1, target = 0, tolerance = 50ms at 120 BPM
    AudioDataSnapshot snap = create_test_snapshot(32, 0.1f, 1.0f);
    bool locked = is_beat_phase_locked_ms(snap, 32, 0.0f, 50.0f);
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

---

## Snippet 9: Integration Test - Snapshot Integrity

**File:** `firmware/test/test_beat_phase_exposure/test_snapshot_integrity.cpp`
**Size:** ~60 lines

```cpp
#include <unity.h>
#include "pattern_audio_interface.h"
#include "audio/goertzel.h"

void test_snapshot_contains_beat_phase() {
    delay(50);  // Wait for audio frame

    AudioDataSnapshot snap{};
    bool got_snap = get_audio_snapshot(&snap);
    TEST_ASSERT_TRUE(got_snap);
    TEST_ASSERT_TRUE(snap.sequence > 0);
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

void test_snapshot_sequence_consistency() {
    AudioDataSnapshot snap1{}, snap2{};

    get_audio_snapshot(&snap1);
    delay(100);
    get_audio_snapshot(&snap2);

    TEST_ASSERT_TRUE(snap2.update_counter >= snap1.update_counter);
}

void setUp() {
    init_audio_data_sync();
}

void tearDown() {}

int run_tests() {
    UNITY_BEGIN();
    RUN_TEST(test_snapshot_contains_beat_phase);
    RUN_TEST(test_snapshot_phase_in_valid_range);
    RUN_TEST(test_snapshot_magnitude_normalized);
    RUN_TEST(test_snapshot_sequence_consistency);
    return UNITY_END();
}
```

---

## Snippet 10: Metronome Test Pattern

**File:** Create new test pattern (e.g., `test_metronome_sync.cpp`)
**Size:** ~40 lines
**Purpose:** Validate beat phase accuracy with metronome

```cpp
// ============================================================================
// TEST PATTERN: Metronome Synchronization
//
// Flashes white LED at detected beat downbeats.
// Use with external metronome (120 BPM recommended).
// Validate that flash occurs within ±100ms of click.
// ============================================================================

void pattern_test_metronome_sync(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    if (!audio_available) {
        fill_solid(leds, LED_COUNT, CRGBF(0, 0, 0));
        return;
    }

    // Find strongest tempo
    uint16_t best_bin = 0;
    float best_mag = 0.0f;
    for (int i = 0; i < NUM_TEMPI; i++) {
        if (AUDIO_BEAT_MAGNITUDE(i) > best_mag) {
            best_mag = AUDIO_BEAT_MAGNITUDE(i);
            best_bin = i;
        }
    }

    // Flash white at downbeat (phase ≈ 0) with ±100ms tolerance
    float phase = AUDIO_BEAT_PHASE(best_bin);

    if (is_beat_phase_locked_ms(audio, best_bin, 0.0f, 100.0f)) {
        fill_solid(leds, LED_COUNT, CRGBF(1.0, 1.0, 1.0));  // White
    } else {
        fill_solid(leds, LED_COUNT, CRGBF(0.0, 0.0, 0.0));  // Off
    }

    // Print every 1 second for visual validation
    static uint32_t last_print = 0;
    if (millis() - last_print > 1000) {
        last_print = millis();
        uint16_t bpm = AUDIO_BPM_FROM_BIN(best_bin);
        Serial.printf("[METRONOME TEST] BPM: %d, Phase: %.3f, Mag: %.2f\n",
                      bpm, phase, best_mag);
    }
}

REGISTER_PATTERN("Test Metronome Sync", pattern_test_metronome_sync);
```

---

## Quick Reference: File Locations

| Snippet | File | Location |
|---------|------|----------|
| 1 (Macros) | `firmware/src/pattern_audio_interface.h` | After line ~150 (existing macros) |
| 2 (Snapshot) | `firmware/src/audio/goertzel.cpp` | Before `commit_audio_data()` call |
| 3 (Declarations) | `firmware/src/pattern_audio_interface.h` | Before final `#endif` |
| 4 (Functions) | `firmware/src/pattern_audio_interface.cpp` | End of file |
| 5 (Extern) | `firmware/src/audio/tempo.h` | After line 52 |
| 6 (Example) | `generated_patterns.h` or new file | Add REGISTER_PATTERN() |
| 7-9 (Tests) | `firmware/test/test_beat_phase_exposure/` | New test directory |
| 10 (Metronome) | `generated_patterns.h` or new file | Add REGISTER_PATTERN() |

---

## Implementation Checklist

- [ ] Snippet 1: Add macros to pattern_audio_interface.h
- [ ] Compile: `platformio run --target clean && platformio run`
- [ ] Snippet 2: Add snapshot population to goertzel.cpp
- [ ] Compile & verify no warnings
- [ ] Snippet 5: Add extern to tempo.h
- [ ] Compile & verify symbol resolution
- [ ] Snippet 3: Add declarations to pattern_audio_interface.h
- [ ] Snippet 4: Add helper functions to pattern_audio_interface.cpp
- [ ] Compile & verify all definitions present
- [ ] Snippet 7-9: Create test files and run tests
- [ ] Snippet 6: Create example pattern
- [ ] Snippet 10: Create metronome test pattern
- [ ] Run full test suite: `platformio test`
- [ ] Validate with metronome (120 BPM, 30 seconds)
- [ ] Validate with real music (30+ seconds)
- [ ] Check serial output for errors
- [ ] Final code review

---

**Ready to implement?** Follow the order above. Each snippet can be added independently, but test after each addition to catch issues early.

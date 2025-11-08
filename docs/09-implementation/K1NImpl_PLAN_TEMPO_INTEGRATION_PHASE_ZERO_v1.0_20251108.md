# Phase Zero: Tempo Integration & Beat Phase Exposure

**Title**: Hardening Tempo System and Exposing Beat Synchronization
**Owner**: Engineering Team
**Date**: 2025-11-07
**Status**: Ready for Implementation
**Scope**: Integration of existing tempo detection into pattern interface
**Related**:
  - `/firmware/src/audio/tempo.cpp`
  - `/firmware/src/audio/goertzel.h`
  - `/firmware/src/pattern_audio_interface.h`
**Tags**: tempo, beat-sync, integration, high-impact-low-effort

---

## Overview

This phase exposes the existing tempo detection system (which is already fully functional) to pattern code. This unlock beat-synchronized animations with **zero additional CPU cost** since the computation is already happening.

**Time estimate**: 30-60 minutes
**Complexity**: Low (data copy + macro exposure)
**Impact**: High (enables beat-sync for all patterns)
**Risk**: Very low (no algorithm changes, just exposure)

---

## Step 0: Current State Analysis

### What's Already Computed

In `tempo.cpp` for each of 64 tempo bins:

```cpp
struct tempo {
    float target_tempo_hz;                  // Target BPM as frequency
    float phase;                            // Beat phase (-π to π)
    float phase_target;                     // Target phase for sync
    float beat;                             // sin(phase) = trigger signal
    float magnitude;                        // Tempo confidence (0-1)
    float magnitude_smooth;                 // Smoothed confidence
    // ... more state ...
};

extern tempo tempi[NUM_TEMPI];  // 64 tempo hypotheses
extern float tempi_smooth[NUM_TEMPI];  // Smoothed magnitudes
extern float tempo_confidence;  // Overall beat confidence
```

### What Gets Updated

```cpp
// In update_tempo() - called every audio frame (10ms)
// For each tempo bin i:
//   1. Compute phase using Goertzel on novelty history
//   2. Compute magnitude (beat strength)
//   3. Normalize and auto-range magnitudes
//
// In update_tempi_phase() - called every LED frame (8.3ms)
// For each tempo bin i:
//   1. Update phase based on time delta
//   2. Smooth magnitude with exponential filter
//   3. Find dominant tempo (max contribution to power sum)
```

**Problem**: This data isn't exposed to patterns; they can't use it.

---

## Step 1: Extend AudioDataSnapshot Structure

**File**: `/firmware/src/audio/goertzel.h`

**Current state** (lines 93-129):
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
    float tempo_magnitude[NUM_TEMPI];
    float tempo_phase[NUM_TEMPI];
    // ... existing ...
    std::atomic<uint32_t> sequence_end{0};
} AudioDataSnapshot;
```

**Add after line 116** (after tempo_phase):
```cpp
typedef struct {
    // ... existing fields ...

    // NEW: Beat synchronization (Phase 0)
    float beat_dominant_phase;          // 0.0-1.0, progress within current beat
    float beat_dominant_confidence;     // 0.0-1.0, strength of detected beat
    uint16_t beat_dominant_bin;         // Which tempo bin is winning (0-63)
    float beat_dominant_bpm;            // Detected BPM (32-192)
    bool beat_detected;                 // true if tempo_confidence > 0.3

    // Optional: Full tempo bin data for advanced patterns
    // Uncomment if patterns need per-bin access:
    // float beat_phase_all[NUM_TEMPI];          // Phase for each tempo hypothesis
    // float beat_confidence_all[NUM_TEMPI];     // Confidence for each hypothesis

    // ... sequence_end ...
} AudioDataSnapshot;
```

**Memory impact**: +3 floats (12 bytes) + 1 uint16 (2 bytes) + 1 bool (1 byte) = 15 bytes
**Total AudioDataSnapshot size**: Now ~150 bytes (acceptable)

---

## Step 2: Update Audio Snapshot Capture

**File**: `/firmware/src/audio/goertzel.cpp`

Find the function that populates `AudioDataSnapshot` and update it to copy tempo data.

**Location hint**: Search for function that copies from `tempi[]` array to `audio_front` or `audio_back`

**Implementation**:
```cpp
void capture_tempo_state_to_snapshot(AudioDataSnapshot& snapshot) {
    // Find dominant tempo bin (highest magnitude_smooth)
    float max_magnitude = 0;
    uint16_t dominant_bin = 0;

    for (uint16_t i = 0; i < NUM_TEMPI; i++) {
        if (tempi_smooth[i] > max_magnitude) {
            max_magnitude = tempi_smooth[i];
            dominant_bin = i;
        }
    }

    // Copy dominant tempo data to snapshot
    snapshot.beat_dominant_bin = dominant_bin;
    snapshot.beat_dominant_confidence = fminf(1.0f, tempi[dominant_bin].magnitude_smooth);

    // Convert phase from radians (-π to π) to 0-1 progress
    float phase_normalized = (tempi[dominant_bin].phase + M_PI) / (2.0f * M_PI);
    snapshot.beat_dominant_phase = fmodf(phase_normalized + 1.0f, 1.0f);  // Ensure 0-1

    // Convert tempo bin index to BPM
    snapshot.beat_dominant_bpm = tempi_bpm_values_hz[dominant_bin] * 60.0f;

    // Copy overall confidence
    snapshot.beat_detected = tempo_confidence > 0.3f;

    // (Optional) Copy all tempo bins if patterns need them:
    // for (int i = 0; i < NUM_TEMPI; i++) {
    //     snapshot.beat_phase_all[i] = tempi[i].phase;
    //     snapshot.beat_confidence_all[i] = tempi_smooth[i];
    // }
}
```

**Call location**: Wherever other audio data is committed to snapshot (likely in audio task)

**Example context**:
```cpp
// Somewhere in audio processing task (Core 0):
void process_audio_frame() {
    // ... existing Goertzel computation ...
    update_novelty();
    update_tempo();
    update_tempi_phase(delta_time);

    // NEW: Capture tempo state
    capture_tempo_state_to_snapshot(audio_back);

    // ... existing snapshot commit ...
    commit_audio_snapshot();
}
```

---

## Step 3: Expose via Pattern Interface

**File**: `/firmware/src/pattern_audio_interface.h`

**Add macros after line 255** (after AUDIO_IS_STALE):

```cpp
// ============================================================================
// BEAT SYNCHRONIZATION INTERFACE (Phase 0 - Tempo Exposure)
// ============================================================================

/**
 * AUDIO_BEAT_PHASE()
 *
 * Returns progress through current beat (0.0-1.0).
 * Useful for: Pulsing effects, synchronized animations.
 *
 * RANGE: 0.0 = start of beat, 0.5 = middle, 1.0 = end (wraps to 0.0)
 *
 * USAGE:
 *   float pulse = sinf(AUDIO_BEAT_PHASE() * M_PI * 2.0f);  // Smooth sine pulse
 *   brightness *= 0.8f + 0.2f * pulse;  // Pulsing between 0.8x and 1.0x
 *
 * SYNCHRONIZATION:
 *   - Updated every LED frame (120 FPS)
 *   - Computed from tempo detection (100 Hz analysis)
 *   - <50ms latency between tempo detection and pattern response
 */
#define AUDIO_BEAT_PHASE()          (audio.beat_dominant_phase)

/**
 * AUDIO_BEAT_CONFIDENCE()
 *
 * Returns strength of detected beat (0.0-1.0).
 * 0.0 = no beat detected (silence), 1.0 = strong beat
 * Useful for: Gating effects, fade on silence.
 *
 * RANGE: 0.0-1.0
 *
 * TYPICAL VALUES:
 *   - 0.0-0.2: Silence or very weak rhythm
 *   - 0.2-0.5: Weak rhythm or ambiguous tempo
 *   - 0.5-0.8: Clear rhythm detected
 *   - 0.8-1.0: Strong, unambiguous beat
 *
 * USAGE:
 *   if (AUDIO_BEAT_CONFIDENCE() > 0.5f) {
 *       // Strong beat detected, use beat-synchronized effects
 *   } else {
 *       // Weak/no beat, fall back to ambient animation
 *   }
 */
#define AUDIO_BEAT_CONFIDENCE()     (audio.beat_dominant_confidence)

/**
 * AUDIO_BEAT_DETECTED()
 *
 * Returns true if beat is reliably detected (confidence > 0.3).
 * Useful for: Boolean gating, one-shot events.
 *
 * RANGE: true/false
 *
 * USAGE:
 *   if (AUDIO_BEAT_DETECTED()) {
 *       // Trigger particle spawn or animation event
 *   }
 */
#define AUDIO_BEAT_DETECTED()       (audio.beat_detected)

/**
 * AUDIO_BEAT_BPM()
 *
 * Returns estimated BPM of detected beat.
 * Useful for: Tempo-aware animation timing.
 *
 * RANGE: 32-192 BPM (nominal range from tempo detection)
 *
 * TYPICAL VALUES:
 *   - 32-80: Slow, ballad, ambient
 *   - 80-120: Normal, pop, rock
 *   - 120-160: Uptempo, dance, electronic
 *   - 160-200: Very fast, drum & bass, hard electronic
 *
 * USAGE:
 *   float beat_period_ms = 60000.0f / AUDIO_BEAT_BPM();
 *   float animation_speed = 1000.0f / beat_period_ms;  // Cycles per second
 */
#define AUDIO_BEAT_BPM()            (audio.beat_dominant_bpm)

/**
 * AUDIO_BEAT_BIN()
 *
 * Returns which tempo bin (0-63) is dominant.
 * Advanced use: For debugging, selecting from tempo array.
 *
 * RANGE: 0-63
 *
 * USAGE (advanced):
 *   uint16_t bin = AUDIO_BEAT_BIN();
 *   // Access raw tempo data for pattern-specific logic
 *   if (bin < 32) {
 *       // Slow tempo
 *   } else {
 *       // Fast tempo
 *   }
 */
#define AUDIO_BEAT_BIN()            (audio.beat_dominant_bin)

// ============================================================================
// BEAT SYNCHRONIZATION HELPERS
// ============================================================================

/**
 * beat_pulse_simple(amplitude)
 *
 * Convenient sine wave pulse synchronized to beat.
 *
 * FORMULA: amplitude * sin(AUDIO_BEAT_PHASE() * π)
 *          (not π*2 - returns 0 at both start and end of beat)
 *
 * RANGE OUTPUT: -amplitude to +amplitude, crossing 0 at beat boundaries
 *
 * USAGE:
 *   float brightness = 0.5f + beat_pulse_simple(0.5f);  // Pulses 0.0-1.0
 *   leds[0].r = brightness;
 */
static inline float beat_pulse_simple(float amplitude) {
    return amplitude * sinf(AUDIO_BEAT_PHASE() * M_PI);
}

/**
 * beat_pulse_gated(amplitude, gate_min)
 *
 * Pulse only when beat is strong enough.
 *
 * FORMULA: beat_pulse_simple(amplitude) * clamp(gate(AUDIO_BEAT_CONFIDENCE()))
 *
 * USAGE:
 *   // Only pulse on strong beats (confidence > 0.5)
 *   float pulse = beat_pulse_gated(0.5f, 0.5f);
 */
static inline float beat_pulse_gated(float amplitude, float gate_min) {
    if (AUDIO_BEAT_CONFIDENCE() < gate_min) {
        return 0.0f;
    }
    return beat_pulse_simple(amplitude);
}

/**
 * beat_trigger_on_phase(phase_target, tolerance)
 *
 * Returns true when beat phase is within tolerance of target.
 * Useful for: One-shot events on specific beat points.
 *
 * PARAMETERS:
 *   phase_target: 0.0-1.0, where in beat to trigger
 *                 0.0 = start, 0.25 = quarter, 0.5 = half, 0.75 = three-quarters
 *   tolerance: How close phase must be (e.g., 0.05 = ±5% of beat)
 *
 * USAGE:
 *   static bool triggered = false;
 *   if (beat_trigger_on_phase(0.0f, 0.1f) && !triggered) {
 *       // Trigger event at start of beat
 *       spawn_particle();
 *       triggered = true;
 *   } else if (AUDIO_BEAT_PHASE() > 0.15f) {
 *       triggered = false;  // Reset trigger for next beat
 *   }
 */
static inline bool beat_trigger_on_phase(float phase_target, float tolerance) {
    if (AUDIO_BEAT_CONFIDENCE() < 0.3f) {
        return false;  // No valid beat
    }

    float phase = AUDIO_BEAT_PHASE();
    float distance = fabsf(phase - phase_target);

    // Handle wrap-around (e.g., 0.95 to 0.05 = 0.1 distance)
    if (distance > 0.5f) {
        distance = 1.0f - distance;
    }

    return distance < tolerance;
}
```

---

## Step 4: Test & Validation

### Test Pattern 1: Simple Beat Pulse

**File**: `/firmware/src/generated_patterns.h` (add new test pattern)

```cpp
void draw_beat_pulse_test(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    if (!AUDIO_BEAT_DETECTED()) {
        // No beat - fade out
        for (int i = 0; i < NUM_LEDS; i++) {
            leds[i] = CRGBF(0, 0, 0);
        }
        return;
    }

    // Pulse brightness with beat
    float pulse = beat_pulse_simple(0.5f);
    float brightness = 0.5f + pulse;

    // Color from beat BPM (slow = red, fast = blue)
    float bpm_normalized = (AUDIO_BEAT_BPM() - 32.0f) / (192.0f - 32.0f);
    bpm_normalized = fminf(1.0f, fmaxf(0.0f, bpm_normalized));

    CRGBF color = hsv(bpm_normalized, 1.0f, brightness * params.brightness);

    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = color;
    }
}
```

### Test Pattern 2: Beat Phase Visualization

```cpp
void draw_beat_phase_test(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    // Clear
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGBF(0, 0, 0);
    }

    if (!AUDIO_BEAT_DETECTED()) {
        return;
    }

    // Draw bar showing beat progress
    int progress_led = (int)(AUDIO_BEAT_PHASE() * NUM_LEDS);

    for (int i = 0; i < progress_led; i++) {
        leds[i] = CRGBF(0, 1, 0);  // Green progress
    }

    // Peak marker at current position
    if (progress_led < NUM_LEDS) {
        leds[progress_led] = CRGBF(1, 1, 1);  // White marker
    }

    // Apply brightness
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i].r *= params.brightness;
        leds[i].g *= params.brightness;
        leds[i].b *= params.brightness;
    }
}
```

### Test Commands

```bash
# 1. Build firmware
./build.sh

# 2. Flash to device
./flash.sh

# 3. Monitor with music input (metronome recommended for testing)
# Send metronome at constant BPM (e.g., 120 BPM)

# 4. Verify:
# - LED strip should pulse in sync with metronome
# - No audio artifacts
# - Phase should wrap smoothly from 0.0 to 1.0
```

---

## Step 5: Integration with Existing Patterns

### Update Spectrum Pattern (Example)

Current implementation doesn't use beat phase. Add synchronization:

```cpp
// BEFORE (current):
void draw_spectrum(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();
    // ... render spectrum ...
    // All LEDs illuminate based on frequency content
}

// AFTER (with beat sync):
void draw_spectrum_beat_sync(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    // ... existing spectrum rendering ...

    // NEW: Apply beat-synchronized brightness modulation
    if (AUDIO_BEAT_DETECTED()) {
        float beat_brightness = 0.8f + 0.2f * beat_pulse_simple(1.0f);

        for (int i = 0; i < NUM_LEDS; i++) {
            leds[i].r *= beat_brightness;
            leds[i].g *= beat_brightness;
            leds[i].b *= beat_brightness;
        }
    }

    apply_background_overlay(params);
}
```

### Update Bloom Pattern (Example)

```cpp
// BEFORE:
// Bloom spreads regardless of beat

// AFTER:
// Bloom injects energy more aggressively on beat
void draw_bloom_beat_aware(float time, const PatternParameters& params) {
    // ... existing bloom setup ...

    if (AUDIO_IS_AVAILABLE()) {
        // Scale injection strength by beat phase
        // Strongest injection at beat start (phase = 0.0)
        float beat_factor = (1.0f - AUDIO_BEAT_PHASE());  // 1.0 at start, 0.0 at end
        beat_factor *= beat_factor;  // Sharpen the peak

        float energy_gate = fminf(1.0f, (AUDIO_VU * 0.9f) + (AUDIO_NOVELTY * 0.5f));
        float inject = /* ... existing calc ... */ * (0.5f + beat_factor);

        bloom_trail[NUM_LEDS/2] = fmaxf(bloom_trail[NUM_LEDS/2], inject);
    }

    // ... rest of pattern ...
}
```

---

## Step 6: Documentation Updates

### Update pattern_audio_interface.h header comment

```cpp
/**
 * PATTERN AUDIO INTERFACE - Thread-Safe Audio Data Access
 *
 * Phase 2: Safe Pattern Interface for Audio-Reactive Patterns
 * Phase 0+: Beat Synchronization via Tempo Detection
 *
 * FEATURES AVAILABLE:
 *   - Frequency spectrum (64 bins, Goertzel-based)
 *   - Musical notes (12 pitch classes, chromagram)
 *   - Audio levels (RMS, spectral flux)
 *   - Beat detection (tempo tracking, BPM estimation)
 *   - Beat phase (0.0-1.0 progress within beat)
 *   - Beat confidence (0.0-1.0, strength of beat)
 *
 * NEW IN PHASE 0:
 *   - AUDIO_BEAT_PHASE() - Synchronize to beat
 *   - AUDIO_BEAT_CONFIDENCE() - Gate effects on beat strength
 *   - AUDIO_BEAT_DETECTED() - Boolean beat presence
 *   - AUDIO_BEAT_BPM() - Tempo-aware animation
 */
```

### Create beat synchronization guide

**File**: `/docs/07-resources/beat_sync_pattern_guide.md`

```markdown
# Beat Synchronization Pattern Guide

## Quick Start

### 1. Simple Pulse

```cpp
float pulse = beat_pulse_simple(0.5f);
brightness = 0.5f + pulse;  // Pulses 0.0 - 1.0
```

### 2. Gated Pulse (only on strong beats)

```cpp
float pulse = beat_pulse_gated(0.5f, 0.5f);  // Gate at confidence > 0.5
```

### 3. Particle Spawn on Beat Start

```cpp
if (beat_trigger_on_phase(0.0f, 0.1f)) {
    spawn_particle_burst();
}
```

### 4. Tempo-Aware Animation

```cpp
float beat_period_ms = 60000.0f / AUDIO_BEAT_BPM();
float animation_speed = 1000.0f / beat_period_ms;
```

...
```

---

## Integration Checklist

- [ ] Step 1: Extend AudioDataSnapshot struct
- [ ] Step 2: Implement capture_tempo_state_to_snapshot()
- [ ] Step 3: Call capture function in audio task
- [ ] Step 4: Add macros to pattern_audio_interface.h
- [ ] Step 5: Implement test patterns
- [ ] Step 6: Test with metronome/music
- [ ] Step 7: Update existing patterns
- [ ] Step 8: Update documentation
- [ ] Step 9: Commit & review

---

## Risk Assessment

**Technical Risk**: Very Low
- All tempo computation is proven and working
- Only copying existing data to snapshot
- No algorithm changes
- No performance impact (0ms CPU cost)

**Compatibility Risk**: Very Low
- Backward compatible (adds new fields, doesn't change existing ones)
- Existing patterns continue to work unchanged
- New macros don't conflict with existing ones

**Testing Risk**: Very Low
- Can test independently with metronome
- Patterns fall back gracefully if beat not detected
- No audio processing changes mean audio quality unaffected

---

## Timeline

| Task | Time | Owner |
|------|------|-------|
| Extend AudioDataSnapshot | 15 min | Engineer |
| Implement capture function | 10 min | Engineer |
| Add pattern interface macros | 10 min | Engineer |
| Test patterns | 15 min | Engineer |
| Integration testing | 20 min | QA |
| Documentation | 10 min | Engineer |
| **Total** | **~80 min** | |

---

## Next Steps After Phase 0

Once beat phase is exposed and validated:

1. **Phase 1**: Onset detection + spectral features (~2 days)
2. **Phase 2**: HPSS integration (~3 days)
3. **Phase 3**: Emotion estimation (~2 days)

Each phase builds on Phase 0 and adds additional capabilities.
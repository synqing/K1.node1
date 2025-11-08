# Beat Phase Exposure - Quick Reference Guide

**Purpose:** Fast lookup for beat phase API during pattern development
**For:** Pattern developers using Phase 0 beat synchronization
**Last Updated:** 2025-11-07

---

## Macro API (Zero-Cost, Use First)

```cpp
// In your pattern, always start with:
void draw_pattern(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();  // ← Required first line

    if (!audio_available) return;  // ← Safety check

    // Now use these macros:
    float phase = AUDIO_BEAT_PHASE(bin);            // [-π, π] radians
    float mag = AUDIO_BEAT_MAGNITUDE(bin);          // [0.0, 1.0]
    float conf = AUDIO_TEMPO_CONFIDENCE();          // [0.0, 1.0]
    uint16_t bpm = AUDIO_BPM_FROM_BIN(bin);        // e.g., 120 BPM
}
```

| Macro | Returns | Range | Use Case |
|-------|---------|-------|----------|
| `AUDIO_BEAT_PHASE(bin)` | float | [-π, π] | Color/position cycling |
| `AUDIO_BEAT_MAGNITUDE(bin)` | float | [0, 1] | Brightness/size |
| `AUDIO_TEMPO_CONFIDENCE()` | float | [0, 1] | Effect gating |
| `AUDIO_BPM_FROM_BIN(bin)` | uint16_t | 32-192 | Display tempo |

**Safe Variants** (with bounds checking, return 0 if invalid):
```cpp
AUDIO_BEAT_PHASE_SAFE(bin)
AUDIO_BEAT_MAGNITUDE_SAFE(bin)
AUDIO_BPM_FROM_BIN_SAFE(bin)
```

---

## Helper Functions (Optional, For Complex Logic)

```cpp
// Check if phase is near target (within tolerance window)
bool is_beat_phase_locked_ms(audio, bin, target_phase, tolerance_ms);

// Example: Trigger effect at downbeat (phase ≈ 0) within 100ms
if (is_beat_phase_locked_ms(audio, best_bin, 0.0f, 100.0f)) {
    leds[0] = CRGBF(1.0, 1.0, 1.0);  // Flash white
}

// Wrap phase delta to [-π, π]
float wrapped = wrap_phase(phase_delta);

// Smooth phase (reduce jitter)
float smooth = get_beat_phase_smooth(audio, bin, 0.1f);  // 0.1 = 10% current
```

---

## Common Patterns

### Pattern 1: Beat-Phased Hue Rotation
```cpp
float phase = AUDIO_BEAT_PHASE(best_bin);
float hue_0_1 = (phase + M_PI) / (2.0f * M_PI);  // Map [-π, π] to [0, 1]
uint8_t hue = hue_0_1 * 255.0f;

for (int i = 0; i < LED_COUNT; i++) {
    leds[i] = CHSV(hue, 1.0, 1.0);
}
```

### Pattern 2: Magnitude-Gated Brightness
```cpp
float mag = AUDIO_BEAT_MAGNITUDE(best_bin);
fill_solid(leds, LED_COUNT, CRGBF(1.0, 0.0, 0.0));  // Red base
for (int i = 0; i < LED_COUNT; i++) {
    leds[i].v *= mag;  // Dim if beat weak
}
```

### Pattern 3: Confidence-Gated Effect
```cpp
float conf = AUDIO_TEMPO_CONFIDENCE();
if (conf > 0.3f) {  // Only draw if beat detected
    // Draw beat-synchronized effect
    fill_solid(leds, LED_COUNT, CRGBF(conf, conf, conf));
} else {
    fill_solid(leds, LED_COUNT, CRGBF(0, 0, 0));  // Off
}
```

### Pattern 4: Downbeat Flash
```cpp
uint16_t best_bin = 0;
float best_mag = 0.0f;
for (int i = 0; i < NUM_TEMPI; i++) {
    if (AUDIO_BEAT_MAGNITUDE(i) > best_mag) {
        best_bin = i;
        best_mag = AUDIO_BEAT_MAGNITUDE(i);
    }
}

if (is_beat_phase_locked_ms(audio, best_bin, 0.0f, 50.0f)) {
    fill_solid(leds, LED_COUNT, CRGBF(1.0, 1.0, 1.0));  // White
} else {
    fill_solid(leds, LED_COUNT, CRGBF(0.0, 0.0, 0.0));  // Off
}
```

### Pattern 5: Multi-Tempo Visualization
```cpp
// Show energy in all 64 tempi (heatmap)
for (int i = 0; i < LED_COUNT; i++) {
    int bin = (i * NUM_TEMPI) / LED_COUNT;
    float mag = AUDIO_BEAT_MAGNITUDE(bin);
    float phase = AUDIO_BEAT_PHASE(bin);

    float hue = (phase + M_PI) / (2.0f * M_PI) * 255.0f;
    leds[i] = CHSV(hue, 1.0, mag);
}
```

---

## Phase Meaning

```
        π (= -π)
         ↑
         │
    -π/2 ← 0 → π/2
         │
         ↓
        -π
```

| Phase | Meaning | Example |
|-------|---------|---------|
| **0** | Downbeat (strong onset) | Flash here |
| **π/2** | Quarter beat (upswing) | Start fade-in |
| **π / -π** | Upbeat (peak) | Maximum brightness |
| **-π/2** | Three-quarter beat (downswing) | Fade out |

---

## Finding the Strongest Tempo (Pattern Template)

```cpp
// Standard way to find best tempo bin
uint16_t best_bin = 0;
float best_mag = 0.0f;

for (int i = 0; i < NUM_TEMPI; i++) {
    float mag = AUDIO_BEAT_MAGNITUDE(i);
    if (mag > best_mag) {
        best_mag = mag;
        best_bin = i;
    }
}

// Now use best_bin for phase/magnitude/BPM
float phase = AUDIO_BEAT_PHASE(best_bin);
uint16_t bpm = AUDIO_BPM_FROM_BIN(best_bin);
```

---

## Tempo Bin Mapping (64 Bins Covering 32-192 BPM)

```
Bin#  BPM    | Bin#  BPM    | Bin#  BPM    | Bin#  BPM
0     32     | 16    96     | 32    160    | 48    224 (clipped)
2     38     | 18    102    | 34    166    | 50    230
4     45     | 20    108    | 36    172    | 52    236
6     51     | 22    115    | 38    178    | 54    243
8     57     | 24    121    | 40    184    | 56    249
10    64     | 26    127    | 42    190    | 58    255
12    70     | 28    133    | 44    196    | 60    261
14    83     | 30    139    | 46    210    | 62    267
```

**Common BPMs:**
- 120 BPM → bin ~32
- 90 BPM → bin ~20
- 140 BPM → bin ~40

Use `AUDIO_BPM_FROM_BIN(bin)` to convert.

---

## Tolerance Reference (for `is_beat_phase_locked_ms`)

```cpp
// Tolerance at different tempos:

is_beat_phase_locked_ms(audio, bin, 0.0f, 50.0f)   // ±50ms window
// At 120 BPM: phase ≈ ±0.63 radians
// At 90 BPM:  phase ≈ ±0.47 radians
// At 140 BPM: phase ≈ ±0.73 radians

is_beat_phase_locked_ms(audio, bin, 0.0f, 100.0f)  // ±100ms window (typical)
// At 120 BPM: phase ≈ ±1.26 radians (safe, even with jitter)

is_beat_phase_locked_ms(audio, bin, 0.0f, 200.0f)  // ±200ms window (loose)
// At 120 BPM: phase ≈ ±2.51 radians (very permissive)
```

**Recommendation:** Start with 100ms tolerance, adjust based on testing.

---

## Debugging Checklist

### Audio snapshot not available?
```cpp
PATTERN_AUDIO_START();
if (!audio_available) {
    Serial.println("ERROR: No audio snapshot!");
    return;
}
Serial.printf("Audio age: %d ms\n", audio_age_ms);
```

### Beat phase always zero?
```cpp
for (int i = 0; i < NUM_TEMPI; i++) {
    Serial.printf("Bin %d: phase=%.3f mag=%.3f\n",
                  i, AUDIO_BEAT_PHASE(i), AUDIO_BEAT_MAGNITUDE(i));
}
```

### Beat magnitude not changing?
```cpp
float conf = AUDIO_TEMPO_CONFIDENCE();
Serial.printf("Confidence: %.3f (should be > 0.1 when music playing)\n", conf);
```

### Flash out of sync with metronome?
```cpp
float phase = AUDIO_BEAT_PHASE(best_bin);
Serial.printf("Phase: %.3f rad (0 = downbeat, ±π = upbeat)\n", phase);
// Compare visual beat with serial output
```

---

## Performance Tips

**✓ DO:**
- Cache best_bin search result (don't loop every frame)
- Use macros instead of function calls where possible
- Call `PATTERN_AUDIO_START()` once per pattern
- Use SAFE variants if bounds uncertain

**✗ DON'T:**
- Call `is_beat_phase_locked_ms()` inside LED loop (extract result once)
- Use floating-point math in hot path if integer suffices
- Call `get_beat_phase_smooth()` for every bin (use only needed bins)
- Ignore audio_available check (can crash if false)

```cpp
// GOOD: Cache result
PATTERN_AUDIO_START();
uint16_t best_bin = find_best_bin();  // Helper function
bool locked = is_beat_phase_locked_ms(audio, best_bin, 0.0f, 100.0f);

for (int i = 0; i < LED_COUNT; i++) {
    leds[i] = locked ? CRGBF(1,1,1) : CRGBF(0,0,0);
}

// BAD: Repeated calls
for (int i = 0; i < LED_COUNT; i++) {
    bool locked = is_beat_phase_locked_ms(audio, best_bin, 0.0f, 100.0f);  // ← repeated!
    leds[i] = locked ? CRGBF(1,1,1) : CRGBF(0,0,0);
}
```

---

## Testing Your Pattern

### Step 1: Compile & Load
```bash
platformio run --target upload
```

### Step 2: Monitor Serial Output
```bash
platformio run --target monitor --baud 115200
```

### Step 3: Play Metronome (120 BPM)
- Use phone app or online tool (search "120 BPM metronome")
- Set to audible click
- Hold device near speaker

### Step 4: Observe & Validate
```
✓ LED flashes exactly at click (±100ms)
✓ Serial output shows phase cycling smoothly
✓ No glitches or jumps for >30 seconds
✓ Reported BPM matches metronome (±2%)
```

### Step 5: Test with Real Music
- Play 120 BPM pop/house song
- Observe LED pattern for 60+ seconds
- Validate:
  - Pattern locks to beat (no drift)
  - Smooth color/brightness cycling
  - Stable for full song

---

## API Reference Card

**Just the Facts:**

```cpp
// Snapshot acquisition
PATTERN_AUDIO_START()           // Call once per pattern
audio_available                 // bool: snapshot valid?
audio                          // AudioDataSnapshot struct

// Beat phase data (new in Phase 0)
AUDIO_BEAT_PHASE(bin)          // [-π, π] radians
AUDIO_BEAT_MAGNITUDE(bin)      // [0, 1] normalized
AUDIO_TEMPO_CONFIDENCE()       // [0, 1] beat strength
AUDIO_BPM_FROM_BIN(bin)       // BPM (uint16_t)

// Helper functions (optional)
is_beat_phase_locked_ms(snap, bin, phase, ms)  // bool
wrap_phase(delta)              // float in [-π, π]
get_beat_phase_smooth(snap, bin, alpha)        // float

// Constants
NUM_TEMPI                      // 64 (tempo bins)
M_PI                          // 3.14159... (radians)
```

---

## Common Mistakes & Fixes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Forgot `PATTERN_AUDIO_START()` | Compile error | Add macro as first line |
| Using `audio` without snapshot | Undefined variable | Check `audio_available` |
| Phase always π/0 | No cycling | Verify audio input (metronome playing?) |
| Flash too early/late | Out of sync | Adjust tolerance_ms in lock check |
| Magnitude always 0 | No effect | Check tempo detection (confidence > 0?) |
| Crash on invalid bin | Segfault | Use SAFE macros or bounds-check |

---

## Next Steps

1. **Read** full plan: `docs/04-planning/K1NPlan_PLAN_PHASE_0_BEAT_PHASE_EXPOSURE_v1.0_20251108.md`
2. **Review** code snippets: `docs/06-reference/K1NRef_TEMPLATES_PHASE_0_IMPLEMENTATION_SNIPPETS_v1.0_20251108.md`
3. **Start coding** using patterns above
4. **Validate** with metronome test (30 sec)
5. **Debug** using checklist above
6. **Ship** your beat-locked pattern!

---

**Last Updated:** 2025-11-07
**Questions?** See FAQ in full plan document
**Ready to use:** Yes, Phase 0 is live!

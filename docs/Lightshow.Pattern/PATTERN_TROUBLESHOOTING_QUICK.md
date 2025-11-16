# Pattern Troubleshooting Quick Reference

**Purpose:** Rapid diagnostic tool for pattern-related issues  
**Related Docs:** [Pattern History](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md#14-known-failure-conditions), [Development Workflow](../03-guides/PATTERN_DEVELOPMENT_WORKFLOW.md)  
**Last Updated:** 2025-01-XX  
**Status:** Active

---

## Quick Diagnostic Table

| Symptom | Likely Cause | Section | Solution |
|---------|--------------|---------|----------|
| Pattern goes black on silence | Early return without fallback | §1 | Add idle animation |
| Colors appear washed out | Double brightness multiplication | §2 | Remove `params.brightness` multiply |
| Pattern off-center/asymmetric | Center-origin violation | §3 | Use mirror idioms |
| Beat alignment feels wrong | Tempo/VU confusion | §4 | Restore tempo-based gating |
| Pattern keeps moving when audio stops | Stale snapshot data | §5 | Add age-based decay |
| Background slider does nothing | Background overlay disabled | §6 | Implement explicit ambient rendering |
| Visual regression after pattern change | Code style violation | §7 | Review failure modes |
| Pattern clips to white too quickly | Double brightness or missing perceptual curves | §2, §8 | Check brightness multiplication and apply `response_sqrt()` |
| Mirroring appears broken | Incorrect center-origin math | §3 | Verify `half = NUM_LEDS / 2` and mirror indices |
| Bloom/Bloom Mirror barely respond | Snapshot invalid / AGC bypass | §9 | Fix snapshot validity, run AGC |

---

## Decision Tree

```
Pattern Issue Detected
│
├─ Pattern is completely black
│   ├─ Audio active? → YES → Check §2 (Brightness) or §4 (Audio Access)
│   └─ Audio silent? → YES → Check §1 (Silence Path)
│
├─ Pattern appears incorrect visually
│   ├─ Off-center or asymmetric? → YES → Check §3 (Center-Origin)
│   ├─ Colors washed out or too bright? → YES → Check §2 (Brightness)
│   ├─ Beat alignment wrong? → YES → Check §4 (Tempo/VU)
│   └─ Keeps moving when audio stops? → YES → Check §5 (Snapshot Age)
│
├─ Pattern parameter doesn't work
│   ├─ Background slider? → YES → Check §6 (Background Overlay)
│   └─ Brightness slider? → YES → Check §2 (Brightness)
│
└─ Regression after modification
    └─ Check §7 (Code Review) and review [Development Workflow](../03-guides/PATTERN_DEVELOPMENT_WORKFLOW.md)
```

---

## Failure Mode Quick Reference

### §1: Pattern Goes Black on Silence

**Symptom:** Pattern completely disappears when audio stops or microphone disconnects.

**Quick Check:**
```cpp
if (!AUDIO_IS_AVAILABLE()) {
    // BAD: Just returns without rendering
    return;
    
    // GOOD: Renders idle animation
    for (int i = 0; i < NUM_LEDS; i++) {
        float progress = (float)i / NUM_LEDS;
        float breath = 0.5f + 0.3f * sinf(time * params.speed);
        leds[i] = color_from_palette(params.palette_id, progress, breath);
    }
    return;
}
```

**Solution:**
1. Replace early `return` with explicit idle rendering
2. Implement gentle gradient or breathing animation
3. Use `params.background` or low-intensity palette colors

**Anti-Pattern:**
```cpp
// BAD: Clears and returns
for (int i = 0; i < NUM_LEDS; i++) {
    leds[i] = CRGBF(0.0f, 0.0f, 0.0f);
}
if (!AUDIO_IS_AVAILABLE()) {
    return;  // ❌ Black screen
}
```

**Correct Pattern:**
```cpp
// GOOD: Explicit idle animation
if (!AUDIO_IS_AVAILABLE()) {
    for (int i = 0; i < num_leds; i++) {
        float progress = (float)i / num_leds;
        float breath = 0.5f + 0.3f * sinf(time * params.speed);
        leds[i] = color_from_palette(params.palette_id, progress, breath);
    }
    return;
}
```

**Affected Patterns:** Pulse, Dot Family (Analog, Metronome, Hype), Tempiscope  
**Detailed Info:** [History §14.2](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md#142-silence-paths-that-clear-leds-and-return-early)

---

### §2: Colors Appear Washed Out or Too Bright

**Symptom:** Colors clip to white quickly, patterns appear "overexposed," brightness controls feel too sensitive.

**Quick Check:**
```cpp
// BAD: Double brightness multiplication
color.r *= params.brightness;  // Pattern-level
// ... later in color_pipeline.cpp ...
leds[i] *= master_brightness;  // Pipeline-level (duplicate!)

// GOOD: Let color pipeline handle brightness
color.r = magnitude;  // Pattern sets magnitude
// ... color pipeline applies brightness globally ...
```

**Solution:**
1. Remove `params.brightness` multiplication from pattern code
2. Let `color_pipeline.cpp` handle global brightness
3. Only apply per-pattern scaling for *relative* effects (trail weights)

**Anti-Pattern:**
```cpp
// BAD: Pattern multiplies by brightness
CRGBF color = color_from_palette(params.palette_id, progress, magnitude);
color.r *= params.brightness;  // ❌ Duplicate multiplication
color.g *= params.brightness;
color.b *= params.brightness;
leds[i] = color;
```

**Correct Pattern:**
```cpp
// GOOD: Pattern sets magnitude, pipeline handles brightness
float magnitude = response_sqrt(raw_spectrum_value);
CRGBF color = color_from_palette(params.palette_id, progress, magnitude);
leds[i] = color;  // ✅ Pipeline will apply brightness globally
```

**Affected Patterns:** All patterns (when modified incorrectly)  
**Detailed Info:** [History §14.4](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md#144-double-brightness-scaling-transport-vs-pattern)

---

### §3: Pattern Off-Center or Asymmetric

**Symptom:** Pattern appears shifted from center, mirroring is incorrect, halves don't align.

**Quick Check:**
```cpp
// BAD: Renders over full array without center awareness
for (int i = 0; i < NUM_LEDS; i++) {
    leds[i] = color;
}

// GOOD: Renders half, then mirrors
int half = NUM_LEDS / 2;
for (int i = 0; i < half; i++) {
    CRGBF color = /* compute for position i */;
    leds[half - 1 - i] = color;  // Left half (mirrored)
    leds[half + i] = color;       // Right half
}
```

**Solution:**
1. Compute `half = NUM_LEDS / 2`
2. Render only first half of LEDs
3. Mirror to second half explicitly
4. Or use `apply_mirror_mode(leds, true)` helper

**Anti-Pattern:**
```cpp
// BAD: Full array rendering without mirroring
for (int i = 0; i < num_leds; i++) {
    float progress = (float)i / num_leds;
    leds[i] = compute_color(progress);  // ❌ No center-origin awareness
}
```

**Correct Pattern:**
```cpp
// GOOD: Center-origin rendering with mirroring
int half = num_leds / 2;
for (int i = 0; i < half; i++) {
    float progress = (float)i / (float)half;
    CRGBF color = compute_color(progress);
    leds[half - 1 - i] = color;  // ✅ Left half (mirrored)
    leds[half + i] = color;       // ✅ Right half
}
```

**Affected Patterns:** Any new or modified pattern  
**Detailed Info:** [History §14.7](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md#147-rendering-outside-center-origin-constraints)

---

### §4: Beat Alignment Feels Wrong

**Symptom:** Pattern reacts like simple VU meter (jerky, wrong frequency emphasis) instead of tempo-driven beat sync.

**Quick Check:**
```cpp
// BAD: Uses VU instead of tempo
if (AUDIO_VU > threshold) {
    trigger_effect();
}

// GOOD: Uses tempo arrays
if (tempo_confidence > threshold && tempo_phase[i] > gate) {
    trigger_effect();
}
```

**Solution:**
1. Use `tempo_phase[]`, `tempo_magnitude[]`, `tempo_confidence` instead of VU
2. Reserve VU gating for explicitly VU-based patterns (Bloom)
3. Reference Emotiscope code in Phase 1 repo for correct signal usage

**Anti-Pattern:**
```cpp
// BAD: VU gating for tempo-driven pattern
if (audio.vu_level > 0.7f) {
    spawn_wave();  // ❌ Wrong for tempo-driven patterns
}
```

**Correct Pattern:**
```cpp
// GOOD: Tempo gating for tempo-driven pattern
if (audio.tempo_confidence > 0.7f) {
    for (int i = 0; i < NUM_TEMPI; i++) {
        if (audio.tempo_phase[i] > 0.8f) {
            spawn_wave();  // ✅ Beat-synchronized
            break;
        }
    }
}
```

**Affected Patterns:** Pulse, Hype, Beat Tunnel, Tempiscope  
**Detailed Info:** [History §14.3](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md#143-tempo-vs-vu-confusion-in-tempo-driven-patterns)

---

### §5: Pattern Keeps Moving When Audio Stops

**Symptom:** Visual features continue animating based on old audio data after microphone stops or audio input ends.

**Quick Check:**
```cpp
// BAD: Only checks validity, not age
if (!audio.is_valid) {
    return;
}
// ... uses stale data ...

// GOOD: Checks age and applies decay
uint32_t age_ms = AUDIO_AGE_MS();
if (age_ms > 250) {
    float age_factor = 1.0f - fminf(age_ms, 500.0f) / 500.0f;
    magnitude *= age_factor;  // Fade out gracefully
}
```

**Solution:**
1. Always check `AUDIO_AGE_MS()` when using audio data
2. Apply age-based decay factor to visuals
3. Switch to idle animation after threshold (250-500ms)

**Anti-Pattern:**
```cpp
// BAD: Ignores snapshot age
if (AUDIO_IS_AVAILABLE()) {
    float magnitude = audio.spectrogram[i];  // ❌ May be stale
    // ... uses old data indefinitely ...
}
```

**Correct Pattern:**
```cpp
// GOOD: Applies age-based decay
if (AUDIO_IS_AVAILABLE()) {
    uint32_t age_ms = AUDIO_AGE_MS();
    float age_factor = 1.0f - fminf(age_ms, 250.0f) / 250.0f;
    age_factor = fmaxf(0.0f, age_factor);
    
    float magnitude = audio.spectrogram[i] * age_factor;  // ✅ Fades gracefully
    // ... use decayed magnitude ...
}
```

**Affected Patterns:** All audio-reactive patterns  
**Detailed Info:** [History §14.6](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md#146-audio-snapshot-staleness-ignored)

---

### §6: Background Slider Does Nothing

**Symptom:** Adjusting `params.background` slider in UI has no visible effect on pattern.

**Root Cause:** `apply_background_overlay()` is intentionally disabled in K1.node1.

**Solution:**
1. **DO NOT** re-enable `apply_background_overlay()` without owner approval
2. If pattern needs ambient background, implement it explicitly:
   ```cpp
   if (!AUDIO_IS_AVAILABLE()) {
       // Explicit ambient rendering
       for (int i = 0; i < num_leds; i++) {
           float progress = (float)i / num_leds;
           CRGBF ambient = color_from_palette(params.palette_id, progress, params.background);
           leds[i] = ambient;
       }
   }
   ```

**Why This Exists:**
- Design decision: Global background overlay disabled to put all visual responsibility on individual patterns
- Re-enabling would globally change every pattern's look and conflict with carefully tuned trails/gradients

**Affected Patterns:** All patterns (globally)  
**Detailed Info:** [History §14.1](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md#141-global-background-overlay-misunderstanding)

---

### §7: Visual Regression After Pattern Change

**Symptom:** Pattern behavior changes unexpectedly after modification, or other patterns break.

**Common Causes:**
- Modified shared helper function
- Changed audio data access pattern
- Introduced center-origin violation
- Added double brightness multiplication
- Removed required guard checks
- Used `memset()` on sprite buffers (destroys persistence)

**Solution:**
1. Review [Development Workflow](../03-guides/PATTERN_DEVELOPMENT_WORKFLOW.md) checklist
2. Check failure modes in [History §14](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md#14-known-failure-conditions)
3. Revert change and re-implement following guidelines
4. Complete full regression test suite

**Prevention Checklist:**
- [ ] Audio validity checked before accessing audio data
- [ ] Center-origin symmetry maintained
- [ ] No double brightness multiplication
- [ ] Silence path renders idle animation
- [ ] Age-based decay applied to audio data
- [ ] No `memset()` on sprite buffers
- [ ] No `get_audio_snapshot()` calls inside pattern

---

### §8: Pattern Clips to White Too Quickly

**Symptom:** Bright parts saturate instantly, flattening gradients and destroying contrast.

**Common Causes:**
1. Double brightness multiplication (see §2)
2. Missing perceptual curves (`response_sqrt()`)
3. Raw magnitude values too high

**Solution:**
1. Remove `params.brightness` multiplication from pattern
2. Apply perceptual curves to magnitude:
   ```cpp
   float magnitude = response_sqrt(raw_spectrum_value);
   ```
3. Use `clip_float()` to clamp values:
   ```cpp
   magnitude = clip_float(magnitude);
   ```

**Anti-Pattern:**
```cpp
// BAD: Raw magnitude without curves
float magnitude = audio.spectrogram[i];  // ❌ Too bright
CRGBF color = CRGBF(magnitude, 0.0f, 0.0f);  // ❌ Clips
```

**Correct Pattern:**
```cpp
// GOOD: Perceptual curves applied
float magnitude = clip_float(audio.spectrogram[i]);
magnitude = response_sqrt(magnitude);  // ✅ Perceptual mapping
CRGBF color = color_from_palette(params.palette_id, progress, magnitude);
```

**Affected Patterns:** All patterns using raw magnitude values  
**Detailed Info:** [History §14.4](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md#144-double-brightness-scaling-transport-vs-pattern)

---

### §9: Snapshot Validity / AGC / Freshness Boundary

**Symptom:** Bloom/Bloom Mirror stay dark unless the mic clips, Spectrum/Octave feel “stuck,” or heartbeat insists `audio=0` even though VU/tempo logs show activity.

**Quick Checks:**
- Confirm `audio_back.payload.is_valid` isn’t being tied to silence detection (see `main.cpp`). Snapshots should remain valid whenever data was copied; silence belongs in a separate flag.
- Ensure `g_cochlear_agc->process()` runs inside `calculate_magnitudes()` before copying into `audio_back`. AGC logs showing `gain=1.00x` forever mean the gain stage never executes.
- Patterns using `PatternRenderContext` must track freshness manually. Inside each pattern:
  ```cpp
  static uint32_t last_update = 0;
  bool fresh = (context.audio_snapshot.payload.update_counter != last_update);
  if (!fresh) return;  // or skip heavy work
  last_update = context.audio_snapshot.payload.update_counter;
  ```
- Never call `get_audio_snapshot()` inside the pattern—use the injected snapshot only.

**Solution:**
1. Decouple `is_valid` from silence heuristics (`audio_input_is_active()`); snapshots must stay valid even during quiet passages.
2. Wire AGC back into the Goertzel pipeline so magnitudes land in the expected range.
3. Restore per-pattern freshness tracking; skip work only when the update counter hasn’t changed.
4. Move heartbeat logging (`heartbeat_logger_note_audio`) into `audio_task` so diagnostics reflect the real pipeline.

**Affected Patterns:** Bloom, Bloom Mirror, Spectrum, Octave, Prism, any pattern using `PatternRenderContext` without manual freshness.
**Detailed Info:** [History §14.9](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md#149-snapshot-validity--agc-bypass-nov-2025-regression)

---

## Diagnostic Commands

### Check Pattern File Location

```bash
# Find which file contains a pattern
grep -r "draw_<pattern_name>" firmware/src/patterns/
```

### View Recent Changes

```bash
# Last 5 commits affecting patterns
git log --oneline -- firmware/src/patterns/ | head -5

# Show specific commit
git show <commit_hash> -- firmware/src/patterns/<family>.hpp
```

### Compare with Emotiscope Reference

```bash
# If Phase 1 repo available
diff -u \
  /Users/spectrasynq/Workspace_Management/Software/K1.reinvented/firmware/src/generated_patterns.h \
  firmware/src/patterns/<family>.hpp
```

### Check Audio Guard Usage

```bash
# Verify pattern checks audio availability
grep -A 10 "draw_<pattern_name>" firmware/src/patterns/<family>.hpp | grep -i "AUDIO_IS_AVAILABLE"
```

### Check Brightness Multiplication

```bash
# Search for potential double brightness
grep -n "params.brightness\|params->brightness" firmware/src/patterns/<family>.hpp
```

### Check Center-Origin Compliance

```bash
# Verify mirroring or half-strip rendering
grep -A 5 "half.*NUM_LEDS\|apply_mirror_mode" firmware/src/patterns/<family>.hpp
```

---

## When to Escalate

**Escalate to maintainer when:**
- Issue affects multiple patterns simultaneously
- Root cause unclear after reviewing failure modes
- Proposed fix would require architectural changes
- Pattern behavior fundamentally differs from Emotiscope reference
- Performance degradation (>10% FPS drop)
- Memory corruption or crashes

**Before escalating:**
1. Document symptom with specific reproduction steps
2. Identify affected pattern(s) and commit hash
3. Review relevant failure mode sections in History §14
4. Attempt diagnostic commands above
5. Document findings in status matrix or history
6. Test fix on isolated pattern before proposing global changes

---

## Quick Reference Links

- **[Full Failure Mode Details](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md#14-known-failure-conditions)** - Complete failure mode documentation
- **[Development Workflow](../03-guides/PATTERN_DEVELOPMENT_WORKFLOW.md)** - Modification process
- **[Pattern Status Matrix](PATTERN_STATUS_MATRIX.md)** - Current implementation status
- **[Pattern Glossary](PATTERN_GLOSSARY.md)** - Technical term definitions
- **[Architecture Overview](../01-architecture/PATTERN_ARCHITECTURE_OVERVIEW.md)** - System architecture

---

**Related Documentation:**
- [Pattern History](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md) - Detailed change tracking
- [Development Workflow](../03-guides/PATTERN_DEVELOPMENT_WORKFLOW.md) - Implementation process
- [Pattern Glossary](PATTERN_GLOSSARY.md) - Terminology definitions

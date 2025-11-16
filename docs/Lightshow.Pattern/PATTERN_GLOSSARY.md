# Pattern Glossary

**Purpose:** Definitions of technical terms used in pattern development  
**Related Docs:** [Pattern Architecture Overview](../01-architecture/PATTERN_ARCHITECTURE_OVERVIEW.md), [Pattern History](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md)  
**Last Updated:** 2025-01-XX  
**Status:** Active

---

## A

### Age-Based Decay
Gradual fade-out of visual features based on audio snapshot age. Used to gracefully handle stale audio data when microphone stops or audio input ends.

**Usage:** `AUDIO_AGE_MS()` returns milliseconds since last audio update; patterns multiply visuals by decay factor (1.0 at 0ms → 0.0 at 250-500ms).

**Example:**
```cpp
uint32_t age_ms = AUDIO_AGE_MS();
float age_factor = 1.0f - fminf(age_ms, 250.0f) / 250.0f;
magnitude *= fmaxf(0.0f, age_factor);  // Fade gracefully
```

**See also:** Audio Snapshot Staleness, Silence Fallback

---

### Audio Snapshot
Single-frame capture of all audio analysis data, protected by seqlock to ensure consistency.

**Structure:** Contains `vu_level`, `spectrogram[]`, `chromagram[]`, `tempo_phase[]`, `tempo_magnitude[]`, `tempo_confidence`, `is_valid` flag, and `timestamp_us`.

**Critical Rule:** Patterns must use snapshot from `PatternRenderContext`, never call `get_audio_snapshot()` directly (violates single-snapshot-per-frame invariant).

**Access:** `context.audio.payload` in pattern functions

**See also:** Audio Snapshot Staleness, Pattern Render Context

---

### Audio Snapshot Staleness
Condition where audio snapshot timestamp indicates data is old (no recent audio input). Patterns should apply age-based decay or switch to idle animation.

**Detection:** Compare `AUDIO_AGE_MS()` against threshold (typically 250-500ms).

**Symptoms:** Visual features continue moving based on old data after microphone stops.

**Solution:** Apply age-based decay factor or switch to idle animation when age exceeds threshold.

**See also:** Age-Based Decay, Silence Fallback

---

## B

### Background Overlay
**Historical:** Global ambient color layer that was blended into all patterns based on `params.background`.

**Current Status:** **DISABLED BY DESIGN** in K1.node1. Function `apply_background_overlay()` is intentionally a no-op.

**Rationale:** Disabled to put all visual responsibility on individual patterns and avoid muddying choreography.

**Agent Guidance:** Do not re-enable without owner approval. Patterns needing ambient behavior must implement it explicitly.

**Location:** `firmware/src/pattern_helpers.h` defines the no-op function

**See also:** Silence Fallback, Pattern Design Philosophy

---

### Beat Gating
Threshold-based triggering of visual effects when beat detection confidence exceeds a threshold. Used for synchronized animations that align with musical beats.

**Implementation:** Compare `tempo_confidence` against threshold; trigger effects when `tempo_phase[]` crosses gate values.

**Example:**
```cpp
if (tempo_confidence > 0.7f && tempo_phase[i] > 0.8f) {
    trigger_effect();  // Spawn beat-synchronized visual
}
```

**See also:** Tempo Bins, Tempo Confidence

---

## C

### Center-Origin Rendering
Design constraint requiring all patterns to render symmetrically from the center of the LED strip.

**Hardware Context:** K1 LED strip is split into two halves that mirror each other. Center index is `NUM_LEDS / 2 - 1`.

**Implementation:**
- Compute `half = NUM_LEDS / 2`
- Render only first `half` LEDs
- Mirror to second half: `leds[half - 1 - i]` and `leds[half + i]`

**Example:**
```cpp
int half = NUM_LEDS / 2;
for (int i = 0; i < half; i++) {
    CRGBF color = /* compute for position i */;
    leds[half - 1 - i] = color;  // Left half (mirrored)
    leds[half + i] = color;       // Right half
}
```

**See also:** Pattern Design Constraints, Mirror Mode

---

### Chromagram
12-element array representing musical note energy across chromatic scale (C, C#, D, D#, E, F, F#, G, G#, A, A#, B).

**Usage:** Patterns use chromagram to color-code visuals based on dominant musical notes or chord progressions.

**Access:** `context.audio.payload.chromagram[12]`

**Index Mapping:**
- `chromagram[0]` = C
- `chromagram[1]` = C#
- ... (continues through all 12 chromatic notes)

**See also:** Audio Snapshot, Musical Note Mapping

---

### Color Pipeline
Post-processing stage that applies perceptual curves, tone mapping, warmth, white balance, gamma correction, and master brightness to pattern output.

**Important:** Patterns should **not** multiply by `params.brightness` internally (pipeline handles this globally).

**Stages:**
1. LPF (smoothing)
2. Tone mapping (highlight compression)
3. Warmth adjustment
4. White balance
5. Gamma correction
6. Master brightness scaling

**Location:** `firmware/src/color_pipeline.cpp`

**See also:** Brightness Multiplication, Perceptual Curves

---

## D

### Double Brightness Multiplication
Bug condition where brightness is applied twice: once in pattern code and once in color pipeline.

**Symptom:** Colors clip to white quickly, patterns appear overexposed, brightness controls feel too sensitive.

**Fix:** Remove `params.brightness` multiplication from pattern code; let color pipeline handle it.

**Anti-Pattern:**
```cpp
// BAD: Pattern multiplies by brightness
color.r *= params.brightness;
// ... color pipeline also multiplies by brightness (duplicate!)
```

**Correct Pattern:**
```cpp
// GOOD: Pattern sets magnitude, pipeline handles brightness
color.r = magnitude;
// ... color pipeline applies brightness globally
```

**See also:** Color Pipeline, Brightness Multiplication

---

## E

### Emotiscope Parity
Design goal of matching visual behavior and audio reactivity of Emotiscope reference implementation.

**Verification:** Side-by-side visual comparison, timing alignment, beat synchronization.

**Status:** Tracked in `PATTERN_STATUS_MATRIX.md` (✅ Complete, ⚠️ Partial, ❌ Known Issues).

**Reference:** Phase 1 repository (`K1.reinvented`) contains original Emotiscope-based implementations

**See also:** Pattern Status Matrix, Parity Audit

---

### Emotiscope Helpers
Helper functions in `emotiscope_helpers.h` that provide Emotiscope-compatible behavior (palette mapping, perceptual curves, dot rendering).

**Key Functions:**
- `color_from_palette()` - Palette-based color mapping
- `response_sqrt()` - Perceptual magnitude curves
- `draw_dot()` - Point rendering with persistence
- `interpolate()` - Linear interpolation
- `clip_float()` - Value clamping

**Location:** `firmware/src/emotiscope_helpers.h`

**See also:** Pattern Helpers, Helper Functions

---

## F

### Family File
Header file (`patterns/*_family.hpp`) containing multiple related pattern implementations.

**Organization:** Patterns grouped by audio dependencies, visual characteristics, and shared helper usage.

**Examples:**
- `spectrum_family.hpp` - Spectrum, Octave, Waveform Spectrum
- `bloom_family.hpp` - Bloom, Bloom Mirror, Snapwave
- `dot_family.hpp` - Analog, Metronome, Hype
- `static_family.hpp` - Departure, Lava, Twilight
- `tunnel_family.hpp` - Beat Tunnel, Tunnel Glow, Startup Intro

**Location:** `firmware/src/patterns/`

**See also:** Pattern Families, File Organization

---

## G

### Goertzel
Audio analysis algorithm used for frequency-domain analysis and tempo detection.

**Output:** Produces `spectrogram[]` (frequency magnitude) and tempo arrays (`tempo_phase[]`, `tempo_magnitude[]`).

**Location:** `firmware/src/audio/goertzel.cpp`, `firmware/src/audio/goertzel.h`

**See also:** Audio Snapshot, Tempo Bins, Spectrogram

---

## H

### Helper Functions
Shared utility functions used by multiple patterns.

**Categories:**
- **Pattern Helpers** (`pattern_helpers.h`): Mirroring, sprite blending, noise generation
- **Emotiscope Helpers** (`emotiscope_helpers.h`): Palette mapping, perceptual curves, dot rendering

**Key Pattern Helper Functions:**
- `apply_mirror_mode()` - Center-origin mirroring
- `blend_sprite()` - Alpha blending for trails
- `perlin_noise_simple()` - Procedural noise
- `apply_background_overlay()` - **DISABLED** (no-op)

**See also:** Emotiscope Helpers, Pattern Helpers

---

## I

### Idle Animation
Visual fallback rendered when audio is unavailable. Should be gentle, non-distracting, and clearly indicate "waiting for audio" state.

**Examples:** Breathing gradients, slow color rotations, low-intensity palette displays.

**Requirement:** All audio-reactive patterns must implement idle animation (not just return black).

**Implementation:**
```cpp
if (!AUDIO_IS_AVAILABLE()) {
    // Render gentle gradient or breathing animation
    for (int i = 0; i < NUM_LEDS; i++) {
        float progress = (float)i / NUM_LEDS;
        float breath = 0.5f + 0.3f * sinf(time * params.speed);
        leds[i] = color_from_palette(params.palette_id, progress, breath);
    }
    return;
}
```

**See also:** Silence Fallback, Audio Validity Guards

---

## M

### Mirror Mode
Helper function (`apply_mirror_mode()`) that copies first half of LED array to second half in reverse order, creating center-origin symmetry.

**Usage:** After rendering first `NUM_LEDS / 2` LEDs, call `apply_mirror_mode(leds, true)` to mirror to second half.

**Alternative:** Manual mirroring using `leds[half - 1 - i]` and `leds[half + i]`.

**Location:** `firmware/src/pattern_helpers.h`

**See also:** Center-Origin Rendering

---

## P

### Palette System
Color mapping system that maps normalized position/magnitude values to colors from predefined palettes.

**Function:** `color_from_palette(palette_id, position, magnitude)`

**Rationale:** Provides consistent color aesthetics and eliminates desaturation issues compared to raw HSV mapping.

**Location:** `firmware/src/palettes.h`

**Usage:**
```cpp
CRGBF color = color_from_palette(params.palette_id, progress, magnitude);
```

**See also:** Color Pipeline, Emotiscope Helpers

---

### Parity Audit
Systematic verification that K1.node1 patterns match Emotiscope reference implementation.

**Last Audit:** 2025-11-16 (`7c733c18`) - Verified spectrum, bloom, dot, and misc pattern families.

**Status Tracking:** Documented in `PATTERN_STATUS_MATRIX.md`.

**See also:** Emotiscope Parity, Pattern Status Matrix

---

### Pattern Family
Logical grouping of related patterns sharing similar audio dependencies, visual characteristics, or helper usage.

**Families:**
- **Spectrum** (frequency visualization): Spectrum, Octave, Waveform Spectrum
- **Bloom** (sprite persistence, beat-gated): Bloom, Bloom Mirror, Snapwave
- **Dot** (point-based rendering): Analog, Metronome, Hype
- **Static** (non-audio, palette gradients): Departure, Lava, Twilight
- **Tunnel** (rotation effects, shared buffers): Beat Tunnel, Tunnel Glow, Startup Intro
- **Misc** (unique implementations): Pulse, Perlin, Prism, Tempiscope

**See also:** Family File, Pattern Organization

---

### Pattern Helpers
Shared utility functions in `pattern_helpers.h` for common pattern operations.

**Key Functions:**
- `apply_mirror_mode()` - Center-origin mirroring
- `blend_sprite()` - Alpha blending for trails
- `perlin_noise_simple()` - Procedural noise
- `apply_background_overlay()` - **DISABLED** (no-op)

**Location:** `firmware/src/pattern_helpers.h`

**See also:** Helper Functions, Emotiscope Helpers

---

### Pattern Render Context
Structure passed to pattern functions containing all necessary data for rendering.

**Contents:**
- `time` - Current animation time
- `params` - User-adjustable parameters (brightness, speed, palette, etc.)
- `audio` - Audio snapshot (seqlock-protected)
- `leds` - LED array to modify
- `num_leds` - LED count

**Critical Rule:** Patterns must use `context.audio.payload` snapshot, never call `get_audio_snapshot()` directly.

**Location:** `firmware/src/pattern_render_context.h`

**Example:**
```cpp
inline void draw_pattern(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    const AudioDataSnapshot& audio = context.audio.payload;
    CRGBF* leds = context.leds;
    // ... pattern implementation
}
```

**See also:** Audio Snapshot, Pattern Execution Flow

---

### Perceptual Curves
Mathematical functions that map raw audio magnitude to perceptually linear brightness.

**Function:** `response_sqrt(value)` applies square root curve, making low magnitudes more visible and high magnitudes compress smoothly.

**Rationale:** Human perception of brightness is non-linear; perceptual curves make visuals feel more responsive and natural.

**Location:** `firmware/src/emotiscope_helpers.h`

**Usage:**
```cpp
float perceptual_magnitude = response_sqrt(raw_magnitude);
```

**See also:** Color Pipeline, Emotiscope Helpers

---

### Phase 1 / Phase 2
Architectural evolution phases of K1 light show system.

**Phase 1 (K1.reinvented):**
- Monolithic structure: single `generated_patterns.h` file
- Background overlay enabled
- Direct FastLED integration
- Emotiscope parity as primary goal

**Phase 2 (K1.node1):**
- Modular structure: `patterns/*_family.hpp` files
- Background overlay disabled by design
- Color pipeline separates rendering from output
- Hardware v2 optimizations

**Migration:** See `LIGHTSHOW_PATTERN_HISTORY.md` for detailed migration path.

**See also:** Architectural Phases, Pattern History

---

## S

### Silence Fallback
Visual animation rendered when audio input is unavailable (microphone disconnected, no audio stream, or stale snapshot).

**Requirement:** All audio-reactive patterns must implement explicit silence fallback (not just return black).

**Examples:** Gentle gradients, breathing animations, low-intensity palette displays, slow color rotations.

**Implementation:** Check `AUDIO_IS_AVAILABLE()` before accessing audio data; render idle animation when false.

**See also:** Idle Animation, Audio Validity Guards, Background Overlay

---

### Spectrogram
Array of frequency magnitude values representing audio energy across frequency bins.

**Structure:** `spectrogram[NUM_FREQS]` and `spectrogram_smooth[NUM_FREQS]` (smoothed version).

**Usage:** Patterns visualize frequency content by mapping bins to LED positions and magnitudes to brightness/color.

**Access:** `context.audio.payload.spectrogram[]` or `context.audio.payload.spectrogram_smooth[]`

**See also:** Audio Snapshot, Frequency Visualization, Spectrum Family

---

### Sprite Persistence
Frame-to-frame accumulation of visual features using shared buffer arrays, creating ghosting or trail effects.

**Implementation:** Patterns use `blend_sprite()` to alpha-blend new frame into persistent buffer, then render buffer to LEDs.

**Critical Rule:** **Never** use `memset()` on sprite buffers (destroys persistence). Use scalar multiplication for decay.

**Example:**
```cpp
// GOOD: Decay with scalar multiplication
for (int i = 0; i < buffer_size; i++) {
    sprite_buffer[i] *= decay_factor;  // Preserves persistence
}

// BAD: Clearing with memset destroys persistence
memset(sprite_buffer, 0, buffer_size * sizeof(CRGBF));  // ❌ NEVER DO THIS
```

**Used By:** Bloom family, Tunnel family patterns

**See also:** Bloom Family, Tunnel Family, Shared Pattern Buffers

---

## T

### Tempo Bins
Frequency-domain analysis bins used for beat detection and tempo-driven visual effects.

**Arrays:**
- `tempo_phase[NUM_TEMPI]` - Phase values (0.0-1.0) indicating beat position
- `tempo_magnitude[NUM_TEMPI]` - Energy magnitude for each tempo bin
- `tempo_confidence` - Overall confidence in beat detection

**Usage:** Tempo-driven patterns (Pulse, Tempiscope, Beat Tunnel) use these arrays for beat-synchronized animations.

**Access:** `context.audio.payload.tempo_phase[]`, `context.audio.payload.tempo_magnitude[]`, `context.audio.payload.tempo_confidence`

**See also:** Beat Gating, Tempo Confidence, Goertzel

---

### Tempo Confidence
Scalar value (0.0-1.0) indicating reliability of beat detection. High confidence means clear, consistent beat alignment.

**Usage:** Patterns gate tempo-driven effects using `if (tempo_confidence > threshold)` to prevent erratic behavior on weak or ambiguous audio.

**Typical Threshold:** 0.6-0.8 for beat gating

**See also:** Beat Gating, Tempo Bins

---

### Tempo vs VU Confusion
**Failure Mode:** Pattern uses VU (volume) gating instead of tempo-based signals, causing jerky, non-synchronized behavior.

**Symptom:** Beat alignment feels wrong; pattern reacts like simple VU meter instead of tempo-synchronized effect.

**Fix:** Use `tempo_phase[]`, `tempo_magnitude[]`, `tempo_confidence` instead of `AUDIO_VU` for tempo-driven patterns.

**Anti-Pattern:**
```cpp
// BAD: Uses VU instead of tempo
if (AUDIO_VU > threshold) {
    trigger_effect();  // ❌ Wrong for tempo-driven patterns
}
```

**Correct Pattern:**
```cpp
// GOOD: Uses tempo arrays
if (tempo_confidence > threshold && tempo_phase[i] > gate) {
    trigger_effect();  // ✅ Correct for tempo-driven patterns
}
```

**See also:** Beat Gating, Tempo Bins, Failure Modes

---

## V

### VU (Volume Unit)
Overall audio level metric (0.0-1.0) representing total energy in audio signal.

**Usage:** VU-based patterns (Bloom, simple meters) use `AUDIO_VU` for energy-driven visual effects.

**Not Suitable For:** Beat-synchronized or tempo-driven patterns (use tempo bins instead).

**Access:** `context.audio.payload.vu_level` or macro `AUDIO_VU`

**See also:** Tempo vs VU Confusion, Audio Snapshot

---

## Glossary Maintenance

**Update Frequency:** When new terms are introduced  
**Cross-Reference:** Ensure terminology consistency with Pattern History and Architecture Overview documents  
**Validation:** Review quarterly to ensure all terms reflect current implementation

---

**Related Documentation:**
- [Pattern History](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md) - Detailed change tracking
- [Pattern Architecture Overview](../01-architecture/PATTERN_ARCHITECTURE_OVERVIEW.md) - System architecture
- [Pattern Status Matrix](PATTERN_STATUS_MATRIX.md) - Current implementation status


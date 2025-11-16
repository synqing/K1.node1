# Pattern Architecture Overview

**Purpose:** Introduction to K1 light show pattern system architecture  
**Audience:** New agents, first-time developers  
**Related Docs:** [Pattern History](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md), [Development Workflow](../03-guides/PATTERN_DEVELOPMENT_WORKFLOW.md)  
**Last Updated:** 2025-01-XX  
**Status:** Active

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architectural Phases](#architectural-phases)
3. [Pattern Execution Flow](#pattern-execution-flow)
4. [File Organization](#file-organization)
5. [Audio Data Pipeline](#audio-data-pipeline)
6. [Color Pipeline](#color-pipeline)
7. [Pattern Families](#pattern-families)
8. [Helper Functions](#helper-functions)
9. [Key Design Constraints](#key-design-constraints)
10. [Next Steps for New Agents](#next-steps-for-new-agents)

---

## System Overview

The K1 light show system renders audio-reactive LED patterns that respond to real-time audio analysis. Patterns are organized into families, executed through a modular dispatch system, and post-processed through a color pipeline.

**Core Components:**
- **Pattern Registry:** Maps pattern IDs to implementation functions
- **Pattern Execution:** Dispatches to appropriate pattern based on selection
- **Audio Pipeline:** Analyzes microphone input, produces frequency/tempo data
- **Color Pipeline:** Applies perceptual curves, warmth, gamma correction
- **LED Driver:** Outputs final color values to physical LED strip

**Performance Target:** 120+ FPS on ESP32-S3 hardware

---

## Architectural Phases

### Phase 1: K1.reinvented (Monolithic)

**Structure:**
- Single file: `firmware/src/generated_patterns.h`
- Contains: Helper functions + all pattern implementations
- Pattern dispatch: Inline function calls

**Characteristics:**
- Background overlay enabled
- Direct FastLED integration
- Emotiscope parity as primary goal
- Monolithic header (1,842+ lines)

**Location:** `/Users/spectrasynq/Workspace_Management/Software/K1.reinvented`

### Phase 2: K1.node1 (Modular)

**Structure:**
- Family files: `firmware/src/patterns/*_family.hpp`
- Pattern execution: `firmware/src/pattern_execution.cpp`
- Helpers: `firmware/src/pattern_helpers.h`, `emotiscope_helpers.h`

**Characteristics:**
- Background overlay disabled by design
- Color pipeline separates rendering from output
- Modular pattern organization
- Hardware v2 optimizations
- Pattern render context-based API

**Location:** Current repository (`K1.node1`)

**Migration:** See [Pattern History](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md) for detailed migration path.

---

## Pattern Execution Flow

```
┌─────────────────────┐
│  Audio Input        │
│  (Microphone)       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Audio Analysis     │
│  - Goertzel (Freq)  │
│  - Tempo Detection  │
│  - Chromagram       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Audio Snapshot     │
│  (Seqlock Protected)│
│  - Thread-safe      │
│  - Single frame     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Pattern Registry   │
│  (Select Pattern)   │
│  - User selection   │
│  - Pattern ID       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Pattern Execution  │
│  (Dispatch to func) │
│  - Build Context    │
│  - Call pattern fn  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Pattern Render     │
│  (Family .hpp file) │
│  - Inline function  │
│  - Write to LEDs    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Color Pipeline     │
│  - LPF (smoothing)  │
│  - Tone mapping     │
│  - Warmth/balance   │
│  - Gamma correction │
│  - Brightness scale │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  LED Driver         │
│  (Hardware output)  │
│  - RMT encoding     │
│  - Dual-channel     │
└─────────────────────┘
```

**Key Points:**
1. Audio analysis happens continuously in background thread
2. Single audio snapshot per frame (seqlock ensures consistency)
3. Pattern selection via registry lookup
4. Pattern function receives `PatternRenderContext` with all necessary data
5. Color pipeline post-processes all patterns uniformly
6. LED driver handles hardware-specific output formatting

---

## File Organization

```
firmware/src/
├── patterns/                    # Pattern implementations
│   ├── spectrum_family.hpp     # Spectrum, Octave, Waveform Spectrum
│   ├── bloom_family.hpp        # Bloom, Bloom Mirror, Snapwave
│   ├── dot_family.hpp          # Analog, Metronome, Hype
│   ├── static_family.hpp       # Departure, Lava, Twilight
│   ├── tunnel_family.hpp       # Beat Tunnel, Tunnel Glow, Startup Intro
│   ├── tempiscope.hpp          # Tempiscope (single pattern)
│   ├── prism.hpp               # Prism (single pattern)
│   └── misc_patterns.hpp       # Pulse, Perlin
│
├── pattern_registry.cpp        # Pattern registration & selection
├── pattern_registry.h          # Pattern registry interface
├── pattern_execution.cpp       # Pattern dispatch system
├── pattern_execution.h         # Execution interface
├── pattern_render_context.h    # Context passed to patterns
├── pattern_helpers.h           # Shared pattern utilities
├── emotiscope_helpers.h        # Emotiscope-compatible helpers
├── pattern_audio_interface.h   # Audio snapshot access macros
├── color_pipeline.cpp          # Post-processing pipeline
├── color_pipeline.h            # Color pipeline interface
└── led_driver.h                # LED output interface
```

**Pattern File Structure:**
Each family file contains:
1. **Header comment block** - Audio dependencies, warnings, helpers used
2. **Include statements** - Context, helpers, audio interface
3. **Pattern function implementations** - Inline functions following pattern signature

**Example Pattern Function Signature:**
```cpp
inline void draw_spectrum(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    const AudioDataSnapshot& audio = context.audio_snapshot;
    CRGBF* leds = context.leds;
    int num_leds = context.num_leds;
    
    // Pattern implementation...
}
```

---

## Audio Data Pipeline

**Audio Snapshot Structure:**
```cpp
struct AudioDataSnapshot {
    bool is_valid;                    // Validity flag
    uint64_t timestamp_us;            // Timestamp for age calculation
    float vu_level;                   // Overall volume level (0.0-1.0)
    float novelty_curve;              // Novelty/change detection
    float chromagram[12];             // Musical note energy (C-B)
    float spectrogram[NUM_FREQS];     // Frequency magnitude array
    float spectrogram_smooth[NUM_FREQS]; // Smoothed frequency array
    float tempo_phase[NUM_TEMPI];     // Beat position (0.0-1.0)
    float tempo_magnitude[NUM_TEMPI]; // Beat strength
    float tempo_confidence;           // Beat detection reliability
};
```

**Access Pattern:**
- Single snapshot per frame (seqlock protection ensures consistency)
- Patterns receive snapshot via `PatternRenderContext`
- **Never** call `get_audio_snapshot()` inside pattern (breaks single-snapshot invariant)

**Audio Guards:**
```cpp
#define AUDIO_IS_AVAILABLE() (context.audio_snapshot.is_valid)
#define AUDIO_AGE_MS() ((uint32_t)((esp_timer_get_time() - context.audio_snapshot.timestamp_us) / 1000))
```

**Usage Example:**
```cpp
if (!AUDIO_IS_AVAILABLE()) {
    // Render idle animation
    return;
}

uint32_t age_ms = AUDIO_AGE_MS();
float age_factor = 1.0f - fminf(age_ms, 250.0f) / 250.0f;

// Use audio data with age-based decay
float magnitude = context.audio_snapshot.spectrogram_smooth[bin_index] * age_factor;
```

**Audio Analysis Pipeline:**
1. Microphone input captured via I2S
2. Goertzel algorithm analyzes frequency content
3. Tempo detection identifies beat patterns
4. Chromagram extracts musical note energy
5. Seqlock-protected snapshot created
6. Pattern reads snapshot (single-read-per-frame)

---

## Color Pipeline

**Processing Stages:**
1. **LPF (Low-Pass Filter):** Smooths rapid color changes
2. **Tone Mapping:** Compresses highlights, boosts shadows
3. **Warmth Adjustment:** Shifts white balance toward warmer tones
4. **White Balance:** Color temperature correction
5. **Gamma Correction:** Perceptual brightness mapping
6. **Master Brightness:** Global intensity scaling

**Location:** `firmware/src/color_pipeline.cpp`

**Important:** Patterns should **not** multiply by `params.brightness` internally. The color pipeline handles this globally.

**Pattern Responsibility:**
- Set relative brightness/contrast within pattern
- Use perceptual curves (`response_sqrt()`) for magnitude mapping
- Let pipeline handle global brightness scaling

**Pipeline Responsibility:**
- Apply all post-processing uniformly
- Handle brightness scaling globally
- Apply perceptual corrections (gamma, warmth, tone mapping)

**Example:**
```cpp
// In pattern (CORRECT):
float magnitude = response_sqrt(raw_spectrum_value);
CRGBF color = color_from_palette(params.palette_id, progress, magnitude);
// ... pipeline will apply brightness globally ...

// In pattern (WRONG):
color.r *= params.brightness;  // ❌ Double brightness multiplication!
// ... pipeline will multiply again ...
```

---

## Pattern Families

**Family-Based Organization:**

| Family | Patterns | Audio Dependencies | Characteristics |
|--------|----------|-------------------|-----------------|
| **Spectrum** | Spectrum, Octave, Waveform Spectrum | `spectrogram[]`, `spectrogram_smooth[]` | Frequency-domain visualization |
| **Bloom** | Bloom, Bloom Mirror, Snapwave | `vu_level`, `novelty_curve`, `chromagram[]`, `tempo_phase[]` | Sprite persistence, beat-gated |
| **Dot** | Analog, Metronome, Hype | `vu_level`, `spectrogram[]`, `chromagram[]` | Point-based rendering, layer persistence |
| **Static** | Departure, Lava, Twilight | None | Non-audio, palette-based gradients |
| **Tunnel** | Beat Tunnel, Tunnel Glow, Startup Intro | `tempo_phase[]`, `vu_level` | Shared sprite buffers, rotation effects |
| **Misc** | Pulse, Perlin | `vu_level`, `tempo_phase[]`, `novelty_curve` | Various unique implementations |
| **Single** | Prism, Tempiscope | `spectrogram[]`, `tempo_phase[]`, `tempo_confidence` | Individual pattern files |

**Family Selection Criteria:**
- Shared audio dependencies
- Similar visual characteristics
- Common helper function usage
- Related rendering techniques

---

## Helper Functions

### Pattern Helpers (`pattern_helpers.h`)

**Mirroring:**
```cpp
void apply_mirror_mode(CRGBF* leds, bool enabled);
```
Copies first half of LED array to second half in reverse order, creating center-origin symmetry.

**Sprite Blending:**
```cpp
void blend_sprite(CRGBF* dest, const CRGBF* sprite, uint32_t length, float alpha);
```
Alpha-blends sprite buffer into destination (used for trail effects).

**Noise Generation:**
```cpp
float perlin_noise_simple(float x, float y);
```
Generates procedural noise for organic effects.

**Background Overlay:**
```cpp
void apply_background_overlay(const PatternRenderContext& context);
```
**DISABLED BY DESIGN** - Intentionally a no-op in Phase 2.

### Emotiscope Helpers (`emotiscope_helpers.h`)

**Palette Mapping:**
```cpp
CRGBF color_from_palette(uint8_t palette_id, float position, float magnitude);
```
Maps normalized position/magnitude to colors from predefined palettes.

**Perceptual Curves:**
```cpp
float response_sqrt(float value);
```
Applies square root curve for perceptually linear brightness.

**Value Utilities:**
```cpp
float clip_float(float value);
float interpolate(float a, float b, float t);
```
Clamping and interpolation utilities.

**Dot Rendering:**
```cpp
void draw_dot(CRGBF* leds, int num_leds, float position, CRGBF color, float radius);
```
Point rendering with persistence (used by Dot family).

---

## Key Design Constraints

### Center-Origin Rendering

**Requirement:** All patterns must render symmetrically from the center of the LED strip.

**Implementation:**
- Compute `half = NUM_LEDS / 2`
- Render first half only
- Mirror to second half explicitly

**Example:**
```cpp
int half = NUM_LEDS / 2;
for (int i = 0; i < half; i++) {
    CRGBF color = /* compute for position i */;
    leds[half - 1 - i] = color;  // Left half (mirrored)
    leds[half + i] = color;       // Right half
}
```

**Rationale:** K1 hardware and art direction assume center-origin symmetry. Patterns that violate this appear off-center or asymmetric.

### Audio Validity Guards

**Requirement:** All patterns must check audio availability before accessing audio data.

**Implementation:**
```cpp
if (!AUDIO_IS_AVAILABLE()) {
    // Render idle animation
    return;
}
```

**Rationale:** Prevents crashes and garbage frames when microphone disconnected or audio unavailable.

### Silence Fallbacks

**Requirement:** Patterns must render something visible when audio is unavailable (not just black).

**Implementation:** Gentle gradients, breathing animations, or low-intensity palette displays.

**Example:**
```cpp
if (!AUDIO_IS_AVAILABLE()) {
    // Gentle breathing animation
    for (int i = 0; i < num_leds; i++) {
        float progress = (float)i / num_leds;
        float breath = 0.5f + 0.3f * sinf(time * params.speed);
        leds[i] = color_from_palette(params.palette_id, progress, breath);
    }
    return;
}
```

**Rationale:** Provides visual feedback that system is working, even without audio input.

### Background Overlay Disabled

**Design Decision:** Global background overlay is intentionally disabled. Patterns must implement ambient behavior explicitly if needed.

**Rationale:** Puts all visual responsibility on individual patterns and avoids muddying choreography.

**Agent Guidance:** Do not re-enable `apply_background_overlay()` without owner approval. If pattern needs ambient background, implement it explicitly in the pattern function.

### Single Snapshot Per Frame

**Requirement:** Patterns must use snapshot from `PatternRenderContext`, never call `get_audio_snapshot()` directly.

**Rationale:** Seqlock protection ensures single consistent snapshot per frame. Calling `get_audio_snapshot()` multiple times can cause race conditions and inconsistent data.

**Anti-Pattern:**
```cpp
// WRONG: Calling get_audio_snapshot() inside pattern
const AudioDataSnapshot& audio1 = get_audio_snapshot();  // ❌ Breaks invariant
const AudioDataSnapshot& audio2 = get_audio_snapshot();  // ❌ May differ from audio1
```

**Correct Pattern:**
```cpp
// CORRECT: Using snapshot from context
inline void draw_pattern(const PatternRenderContext& context) {
    const AudioDataSnapshot& audio = context.audio_snapshot;  // ✅ Single snapshot
    // ... use audio throughout pattern ...
}
```

---

## Next Steps for New Agents

1. **Read this document** (you are here) ✅
2. **Review [Pattern Status Matrix](../06-reference/PATTERN_STATUS_MATRIX.md)** - Understand current implementation state
3. **Read [Pattern History](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md)** - Learn from past changes and issues
4. **Study [Pattern Implementation Guide](../06-reference/pattern_implementation_guide.md)** - Review code templates
5. **Follow [Development Workflow](../03-guides/PATTERN_DEVELOPMENT_WORKFLOW.md)** - When ready to make changes

---

## Quick Reference Links

- **[Pattern History](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md)** - Detailed change tracking
- **[Development Workflow](../03-guides/PATTERN_DEVELOPMENT_WORKFLOW.md)** - Modification process
- **[Status Matrix](../06-reference/PATTERN_STATUS_MATRIX.md)** - Current state
- **[Implementation Guide](../06-reference/pattern_implementation_guide.md)** - Code templates
- **[Troubleshooting Quick Reference](../06-reference/PATTERN_TROUBLESHOOTING_QUICK.md)** - Diagnostic tools
- **[Pattern Glossary](../06-reference/PATTERN_GLOSSARY.md)** - Technical term definitions

---

**Related Documentation:**
- [Pattern History](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md) - Historical evolution
- [Development Workflow](../03-guides/PATTERN_DEVELOPMENT_WORKFLOW.md) - Implementation process
- [Pattern Glossary](../06-reference/PATTERN_GLOSSARY.md) - Terminology definitions


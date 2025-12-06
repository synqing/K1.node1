# K1.node1 Audio-Visual Contract - Canonical Specification

**Status:** Draft
**Owner:** Analysis Agent
**Date:** 2025-12-05
**Purpose:** Define the authoritative audio-visual interface contract to prevent agent shortcuts and pattern regression

---

## Executive Summary

This document defines the **canonical audio-visual contract** for K1.node1 pattern development. It addresses the root cause of continuous pattern regression: **agents assuming audio parameters that don't exist**.

### The Core Problem

**Pattern developers (agents) have been assuming:**
```cpp
// WRONG - These fields DO NOT EXIST in K1.node1
struct AudioDataSnapshot {
    float bass;      // ❌ NOT A FIELD
    float mid;       // ❌ NOT A FIELD
    float high;      // ❌ NOT A FIELD
};
```

**What ACTUALLY exists:**
```cpp
typedef struct {
    float spectrogram[64];              // ✅ Raw 64-bin frequency array
    float spectrogram_smooth[64];       // ✅ Multi-frame averaged bins
    float chromagram[12];               // ✅ Pitch-class energy (C, C#, D, ..., B)
    float vu_level;                     // ✅ Overall volume (0.0-1.0)
    float tempo_magnitude[192];         // ✅ 192 tempo hypothesis bins
    // ... NO simple bass/mid/high fields
} AudioDataPayload;
```

### Critical Rule: Patterns Must NOT Assume Simple Scalar Audio Fields

**Agents MUST:**
1. Read actual K1.node1 audio interface files BEFORE proposing changes
2. Use provided macros (AUDIO_BASS(), AUDIO_MIDS(), AUDIO_TREBLE()) which aggregate bins correctly
3. Never invent audio fields or assume legacy interfaces from Emotiscope/SensoryBridge apply

**This Contract Prevents:**
- Agents porting "simple" bass/mid/high patterns that don't match our architecture
- Continuous regression from agents taking shortcuts
- Type mismatches causing silent failures or crashes
- "Worked initially but regressed to complete failure" scenarios

---

## Part 1: The Actual Audio Data Structure

### AudioDataPayload - What EXISTS in K1.node1

```cpp
typedef struct {
    // Frequency spectrum analysis (64 bins, Goertzel transform)
    float spectrogram[NUM_FREQS];           // Raw spectrum (0.0-1.0, auto-ranged)
    float spectrogram_smooth[NUM_FREQS];    // Multi-frame average
    float spectrogram_absolute[NUM_FREQS];  // Pre-normalized loudness

    // Musical pitch energy (12 classes)
    float chromagram[12];                   // C, C#, D, D#, E, F, F#, G, G#, A, A#, B

    // Audio levels
    float vu_level;                         // Overall volume (0.0-1.0, auto-ranged)
    float vu_level_raw;                     // Unfiltered volume

    // Beat detection
    float novelty_curve;                    // Spectral flux (change detection)
    float tempo_confidence;                 // 0.0-1.0, beat lock confidence
    float tempo_magnitude[NUM_TEMPI];       // 192 tempo bins (50-150 BPM range)
    float tempo_phase[NUM_TEMPI];           // -π to +π per tempo bin
    float locked_tempo_bpm;                 // Current locked tempo
    TempoLockState tempo_lock_state;        // Lock state enum

    // Metadata
    uint32_t update_counter;                // Increments each audio frame
    uint32_t timestamp_us;                  // Microsecond timestamp
    bool is_valid;                          // Data validity flag
    bool is_silence;                        // Silence detection flag
} AudioDataPayload;
```

**Key Constants:**
- `NUM_FREQS = 64` - Frequency bins (musical scale, ~55 Hz to 6.4 kHz)
- `NUM_TEMPI = 192` - Tempo bins (50-150 BPM, 0.5 BPM resolution)

### What Does NOT Exist

```cpp
// ❌ THESE FIELDS DO NOT EXIST - DO NOT ASSUME THEM
float bass;              // Not a direct field
float mid;               // Not a direct field
float high;              // Not a direct field
float treble;            // Not a direct field
float beat;              // Not a direct field (use tempo_magnitude/phase)
float energy;            // Not a direct field (compute from vu_level + novelty)
```

### Frequency Bin Mapping (Important for Understanding Aggregation)

The 64-bin Goertzel spectrum covers musical frequencies:

```cpp
// Example frequency bins (musical scale):
// Bin  0: ~55.0 Hz  (A1)  - Sub-bass
// Bin  8: ~69.3 Hz  (C#2) - Bass
// Bin 16: ~87.3 Hz  (F2)  - Bass/Low-mids
// Bin 32: ~155.6 Hz (D#3) - Mids
// Bin 48: ~277.2 Hz (C#4) - High-mids
// Bin 63: ~622.3 Hz (D#5) - Treble

// Predefined band ranges:
#define KICK_START    0
#define KICK_END      4    // 55-110 Hz (kick drum fundamental)
#define SNARE_START   8
#define SNARE_END     16   // 220-440 Hz (snare body)
#define VOCAL_START   16
#define VOCAL_END     40   // 440-1760 Hz (vocal range)
#define HATS_START    48
#define HATS_END      63   // 3.5-6.4 kHz (hi-hats/cymbals)
```

---

## Part 2: The Pattern Audio Interface Contract

### Mandatory Pattern Initialization

**Every pattern MUST start with:**

```cpp
void draw_my_pattern(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    // MANDATORY: Get audio snapshot
    const AudioDataSnapshot& audio = context.audio_snapshot;

    // MANDATORY: Define local macros (because PATTERN_AUDIO_START not available in context-based patterns)
    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
    #define AUDIO_AGE_MS() ((uint32_t)((esp_timer_get_time() - audio.payload.timestamp_us) / 1000))
    #define AUDIO_VU (audio.payload.vu_level)
    #define AUDIO_SPECTRUM (audio.payload.spectrogram)

    // MANDATORY: Check audio availability
    if (!AUDIO_IS_AVAILABLE()) {
        // Fallback to time-based animation
        // ... non-audio fallback code ...
        return;
    }

    // ... pattern rendering code ...

    // MANDATORY: Cleanup macros at end
    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_AGE_MS
    #undef AUDIO_VU
    #undef AUDIO_SPECTRUM
}
```

### Direct Array Access (When You Need Per-Bin Control)

```cpp
// Access specific frequency bins
float low_bass = audio.payload.spectrogram[0];      // 55 Hz
float kick = audio.payload.spectrogram[4];           // 110 Hz
float snare = audio.payload.spectrogram[12];         // 329 Hz
float high_freq = audio.payload.spectrogram[63];     // 622 Hz

// Iterate through spectrum
for (int i = 0; i < NUM_FREQS; i++) {
    float magnitude = audio.payload.spectrogram[i];
    // Use magnitude for LED i
}

// Use smooth version for less jitter
for (int i = 0; i < NUM_FREQS; i++) {
    float magnitude = audio.payload.spectrogram_smooth[i];
    // Smoother visualization
}

// Access chromagram (12 musical notes)
for (int i = 0; i < 12; i++) {
    float pitch_energy = audio.payload.chromagram[i];
    // Use for pitch-based coloring
}
```

### Aggregated Band Energy (Convenience Macros)

**These macros exist in `pattern_audio_interface.h` and aggregate bins correctly:**

```cpp
// Helper function declarations (implemented in .cpp)
float get_audio_band_energy(const AudioDataSnapshot& audio, int start_bin, int end_bin);
float get_audio_band_energy_absolute(const AudioDataSnapshot& audio, int start_bin, int end_bin);

// Predefined band macros
#define AUDIO_BASS()     get_audio_band_energy(audio, 0, 8)    // 55-220 Hz
#define AUDIO_MIDS()     get_audio_band_energy(audio, 16, 32)  // 440-880 Hz
#define AUDIO_TREBLE()   get_audio_band_energy(audio, 48, 63)  // 1.76-6.4 kHz

// Absolute loudness versions (pre-normalized)
#define AUDIO_BASS_ABS()   get_audio_band_energy_absolute(audio, 0, 8)
#define AUDIO_MIDS_ABS()   get_audio_band_energy_absolute(audio, 16, 32)
#define AUDIO_TREBLE_ABS() get_audio_band_energy_absolute(audio, 48, 63)

// Instrument-specific bands
#define AUDIO_KICK()     get_audio_band_energy(audio, KICK_START, KICK_END)    // 55-110 Hz
#define AUDIO_SNARE()    get_audio_band_energy(audio, SNARE_START, SNARE_END)  // 220-440 Hz
#define AUDIO_VOCAL()    get_audio_band_energy(audio, VOCAL_START, VOCAL_END)  // 440-1760 Hz
#define AUDIO_HATS()     get_audio_band_energy(audio, HATS_START, HATS_END)    // 3.5-6.4 kHz
```

**Usage Example:**
```cpp
// CORRECT: Use the aggregation macros
float bass = AUDIO_BASS();      // Aggregates bins 0-8
float mids = AUDIO_MIDS();      // Aggregates bins 16-32
float treble = AUDIO_TREBLE();  // Aggregates bins 48-63

// CORRECT: Use them for color mapping
leds[i] = CRGBF(treble, mids, bass);

// WRONG: Assume these are direct fields
// float bass = audio.bass;  // ❌ DOES NOT COMPILE - NO SUCH FIELD
```

### Tempo/Beat Access

```cpp
// Overall beat confidence
float beat_confidence = audio.payload.tempo_confidence;  // 0.0-1.0

// Locked BPM
float current_bpm = audio.payload.locked_tempo_bpm;

// Per-tempo-bin access (advanced)
#define AUDIO_TEMPO_MAGNITUDE(bin) \
    (((int)(bin) >= 0 && (int)(bin) < NUM_TEMPI) ? audio.payload.tempo_magnitude[(int)(bin)] : 0.0f)

#define AUDIO_TEMPO_PHASE(bin) \
    (((int)(bin) >= 0 && (int)(bin) < NUM_TEMPI) ? audio.payload.tempo_phase[(int)(bin)] : 0.0f)

// Beat signal from phase (-1.0 to 1.0)
#define AUDIO_TEMPO_BEAT(bin) (sinf(AUDIO_TEMPO_PHASE(bin)))

// Example: sync to strongest tempo
int strongest_bin = find_strongest_tempo_bin();  // Your helper
float beat_signal = AUDIO_TEMPO_BEAT(strongest_bin);
float brightness = 0.5f + 0.5f * beat_signal;  // Pulsing 0.0-1.0
```

### Audio Freshness and Age Detection

```cpp
// Check if audio snapshot is fresh (different from last frame)
static uint32_t last_update_counter = UINT32_MAX;
bool audio_fresh = (audio.payload.update_counter != last_update_counter);
last_update_counter = audio.payload.update_counter;

if (!audio_fresh) {
    return;  // Skip rendering, no new data
}

// Check audio age (for silence detection)
uint32_t age_ms = AUDIO_AGE_MS();
bool is_stale = (age_ms > 50);  // >50ms = stale/silence

if (is_stale) {
    // Fade to default state
    brightness *= 0.95f;
}

// Graded decay based on age
float age_factor = 1.0f - fminf((float)age_ms, 250.0f) / 250.0f;
age_factor = fmaxf(0.0f, age_factor);
magnitude *= age_factor;  // Apply decay
```

---

## Part 3: Common Pattern Usage Examples

### Example 1: Bass-Reactive Pulse

```cpp
inline void draw_bass_pulse(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    const AudioDataSnapshot& audio = context.audio_snapshot;

    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
    #define AUDIO_VU (audio.payload.vu_level)

    // Fallback if no audio
    if (!AUDIO_IS_AVAILABLE()) {
        float breathe = 0.5f + 0.5f * sinf(time * 2.0f);
        fill_solid(leds, NUM_LEDS, CRGBF(breathe * 0.3f, 0, 0));
        return;
    }

    // Use aggregated bass energy
    float bass = get_audio_band_energy(audio, 0, 8);  // or AUDIO_BASS() if macro defined

    // Apply to all LEDs
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGBF(bass, bass * 0.5f, 0);
    }

    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_VU
}
```

### Example 2: Spectrum Visualizer

```cpp
inline void draw_spectrum_viz(const PatternRenderContext& context) {
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    const AudioDataSnapshot& audio = context.audio_snapshot;

    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
    #define AUDIO_SPECTRUM (audio.payload.spectrogram)

    if (!AUDIO_IS_AVAILABLE()) {
        // Ambient fallback
        fill_solid(leds, NUM_LEDS, CRGBF(0.1f, 0.1f, 0.1f));
        return;
    }

    // Map LEDs to frequency bins
    int half_leds = NUM_LEDS / 2;
    for (int i = 0; i < half_leds; i++) {
        float progress = (float)i / half_leds;
        int bin = (int)(progress * 63);  // Map to 0-63

        float magnitude = AUDIO_SPECTRUM[bin];

        // Mirror from center
        leds[(NUM_LEDS / 2) - 1 - i] = CRGBF(magnitude, magnitude, magnitude);
        leds[(NUM_LEDS / 2) + i] = CRGBF(magnitude, magnitude, magnitude);
    }

    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_SPECTRUM
}
```

### Example 3: Multi-Band Color Mapping

```cpp
inline void draw_multi_band(const PatternRenderContext& context) {
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    const AudioDataSnapshot& audio = context.audio_snapshot;

    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)

    if (!AUDIO_IS_AVAILABLE()) {
        fill_solid(leds, NUM_LEDS, CRGBF(0, 0, 0));
        return;
    }

    // Get aggregated band energies
    float bass = get_audio_band_energy(audio, 0, 8);
    float mids = get_audio_band_energy(audio, 16, 32);
    float treble = get_audio_band_energy(audio, 48, 63);

    // Apply to LED strips (thirds)
    int third = NUM_LEDS / 3;
    for (int i = 0; i < third; i++) {
        leds[i] = CRGBF(0, 0, bass);                  // Bass = blue
    }
    for (int i = third; i < 2*third; i++) {
        leds[i] = CRGBF(0, mids, 0);                  // Mids = green
    }
    for (int i = 2*third; i < NUM_LEDS; i++) {
        leds[i] = CRGBF(treble, 0, 0);                // Treble = red
    }

    #undef AUDIO_IS_AVAILABLE
}
```

### Example 4: Chromagram-Based Color Shift

```cpp
inline void draw_chroma_colors(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    const AudioDataSnapshot& audio = context.audio_snapshot;

    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
    #define AUDIO_VU (audio.payload.vu_level)

    if (!AUDIO_IS_AVAILABLE()) {
        fill_solid(leds, NUM_LEDS, CRGBF(0, 0, 0));
        return;
    }

    // Find dominant chromatic note
    float max_chroma = 0.0f;
    int max_index = 0;
    for (int i = 0; i < 12; i++) {
        if (audio.payload.chromagram[i] > max_chroma) {
            max_chroma = audio.payload.chromagram[i];
            max_index = i;
        }
    }

    // Map to hue (0.0-1.0)
    float dominant_hue = (float)max_index / 12.0f;

    // Apply with VU brightness
    float brightness = AUDIO_VU;
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = hsv(dominant_hue, 1.0f, brightness);
    }

    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_VU
}
```

---

## Part 4: What NOT to Do (Agent Anti-Patterns)

### ❌ Anti-Pattern 1: Assuming Direct Bass/Mid/High Fields

```cpp
// WRONG - These fields don't exist
void draw_pattern_WRONG(const PatternRenderContext& context) {
    const AudioDataSnapshot& audio = context.audio_snapshot;

    float bass = audio.bass;      // ❌ COMPILATION ERROR
    float mid = audio.mid;        // ❌ COMPILATION ERROR
    float high = audio.high;      // ❌ COMPILATION ERROR

    leds[0] = CRGBF(high, mid, bass);
}
```

**Correct Version:**
```cpp
// CORRECT - Use aggregation helpers
void draw_pattern_CORRECT(const PatternRenderContext& context) {
    const AudioDataSnapshot& audio = context.audio_snapshot;

    float bass = get_audio_band_energy(audio, 0, 8);
    float mids = get_audio_band_energy(audio, 16, 32);
    float treble = get_audio_band_energy(audio, 48, 63);

    leds[0] = CRGBF(treble, mids, bass);
}
```

### ❌ Anti-Pattern 2: Porting Legacy Emotiscope/SensoryBridge Code Directly

```cpp
// WRONG - Legacy Emotiscope-style code
void draw_legacy_WRONG(const PatternRenderContext& context) {
    // Emotiscope had global arrays you could read directly
    float mag = spectrogram[i];  // ❌ NOT IN SCOPE
    float level = vu_level;      // ❌ NOT IN SCOPE
}
```

**Correct Version:**
```cpp
// CORRECT - Use snapshot from context
void draw_legacy_CORRECT(const PatternRenderContext& context) {
    const AudioDataSnapshot& audio = context.audio_snapshot;

    float mag = audio.payload.spectrogram[i];  // ✅ From snapshot
    float level = audio.payload.vu_level;       // ✅ From snapshot
}
```

### ❌ Anti-Pattern 3: Not Checking Audio Availability

```cpp
// WRONG - No availability check
void draw_pattern_WRONG(const PatternRenderContext& context) {
    const AudioDataSnapshot& audio = context.audio_snapshot;

    // Directly use audio without checking if valid
    float bass = get_audio_band_energy(audio, 0, 8);
    leds[0] = CRGBF(bass, bass, bass);
    // Result: garbage rendering when microphone disconnected
}
```

**Correct Version:**
```cpp
// CORRECT - Check availability and provide fallback
void draw_pattern_CORRECT(const PatternRenderContext& context) {
    const AudioDataSnapshot& audio = context.audio_snapshot;

    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)

    if (!AUDIO_IS_AVAILABLE()) {
        // Fallback to time-based animation
        fill_solid(leds, NUM_LEDS, CRGBF(0.2f, 0.2f, 0.2f));
        return;
    }

    float bass = get_audio_band_energy(audio, 0, 8);
    leds[0] = CRGBF(bass, bass, bass);

    #undef AUDIO_IS_AVAILABLE
}
```

### ❌ Anti-Pattern 4: Ignoring Audio Age/Freshness

```cpp
// WRONG - No freshness or age handling
void draw_pattern_WRONG(const PatternRenderContext& context) {
    const AudioDataSnapshot& audio = context.audio_snapshot;

    // Render every frame even if audio hasn't changed
    for (int i = 0; i < NUM_LEDS; i++) {
        float mag = audio.payload.spectrogram[i % NUM_FREQS];
        leds[i] = CRGBF(mag, mag, mag);
    }
    // Result: wasted computation + no silence fade
}
```

**Correct Version:**
```cpp
// CORRECT - Check freshness and age
void draw_pattern_CORRECT(const PatternRenderContext& context) {
    const AudioDataSnapshot& audio = context.audio_snapshot;

    // Skip if no new data
    static uint32_t last_update = UINT32_MAX;
    if (audio.payload.update_counter == last_update) {
        return;
    }
    last_update = audio.payload.update_counter;

    // Apply age-based decay
    uint32_t age_ms = (uint32_t)((esp_timer_get_time() - audio.payload.timestamp_us) / 1000);
    float age_factor = 1.0f - fminf((float)age_ms, 250.0f) / 250.0f;
    age_factor = fmaxf(0.0f, age_factor);

    for (int i = 0; i < NUM_LEDS; i++) {
        float mag = audio.payload.spectrogram[i % NUM_FREQS] * age_factor;
        leds[i] = CRGBF(mag, mag, mag);
    }
}
```

---

## Part 5: Integration Checklist for K1.Ambience Effects

When porting effects from K1.Ambience to K1.node1, agents **MUST** follow this checklist:

### Step 1: Read K1.node1 Audio Interface FIRST
- [ ] Read `/docs/01-architecture/audio_sync_layer_system_guide.md` (904 lines)
- [ ] Read `/firmware/src/pattern_audio_interface.h` (637 lines)
- [ ] Read at least 2 working pattern implementations in `/firmware/src/patterns/`

### Step 2: Map K1.Ambience Audio Fields to K1.node1

**K1.Ambience fields → K1.node1 equivalents:**

| K1.Ambience (WRONG) | K1.node1 (CORRECT) |
|---------------------|-------------------|
| `AudioSystem::getBassLevel()` | `get_audio_band_energy(audio, 0, 8)` or `AUDIO_BASS()` |
| `AudioSystem::getMidLevel()` | `get_audio_band_energy(audio, 16, 32)` or `AUDIO_MIDS()` |
| `AudioSystem::getHighLevel()` | `get_audio_band_energy(audio, 48, 63)` or `AUDIO_TREBLE()` |
| `AudioSystem::getTotalLevel()` | `audio.payload.vu_level` |
| `AudioSystem::isBeatDetected()` | `audio.payload.tempo_confidence > threshold` |
| `AudioSystem::getBPM()` | `audio.payload.locked_tempo_bpm` |
| `AudioSystem::getFrequencyBin(i)` | `audio.payload.spectrogram[i]` |

### Step 3: Rewrite Effect Audio Access

**For each K1.Ambience effect:**
1. Identify all audio field accesses
2. Map each to K1.node1 equivalent using table above
3. Add audio availability check
4. Add audio age/freshness handling
5. Test with silence (no microphone input)
6. Test with stale data (pause audio processing)

### Step 4: Validate Against Working Patterns

Compare your ported pattern against working K1.node1 patterns:
- [ ] Uses `const AudioDataSnapshot& audio = context.audio_snapshot`
- [ ] Checks `audio.payload.is_valid` before using audio
- [ ] Provides fallback for no-audio case
- [ ] Handles audio age/staleness
- [ ] Uses correct field names (spectrogram, chromagram, vu_level, etc.)
- [ ] Uses aggregation helpers for band energy (AUDIO_BASS(), etc.)
- [ ] Undefines macros at end of function

---

## Part 6: Reference Implementation (Complete Working Example)

```cpp
// Complete working example from misc_patterns.hpp
inline void draw_pulse(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    const AudioDataSnapshot& audio = context.audio_snapshot;

    #define AUDIO_IS_AVAILABLE() (audio.payload.is_valid)
    #define AUDIO_AGE_MS() ((uint32_t)((esp_timer_get_time() - audio.payload.timestamp_us) / 1000))
    #define AUDIO_VU (audio.payload.vu_level)
    #define AUDIO_NOVELTY (audio.payload.novelty_curve)
    #define AUDIO_KICK() get_audio_band_energy(audio, KICK_START, KICK_END)

    // Frame-rate independent delta time
    static float last_time_pulse = 0.0f;
    float dt_pulse = time - last_time_pulse;
    if (dt_pulse < 0.0f) dt_pulse = 0.0f;
    if (dt_pulse > 0.05f) dt_pulse = 0.05f;
    last_time_pulse = time;

    // Fallback to ambient if no audio
    if (!AUDIO_IS_AVAILABLE()) {
        const int half_leds = NUM_LEDS >> 1;
        float idle_phase = time * (0.2f + params.speed * 0.5f);
        float breathe = 0.4f + 0.4f * sinf(idle_phase * 6.28318530718f);
        float width = 0.12f + 0.1f * clip_float(params.softness);

        for (int i = 0; i < half_leds; ++i) {
            float radial = (half_leds > 1) ? ((float)i / (float)(half_leds - 1)) : 0.0f;
            float distance = radial;
            float gaussian = expf(-(distance * distance) / (2.0f * width * width));
            float brightness = clip_float((0.1f + breathe * 0.5f) * gaussian);
            float hue = clip_float(params.color + radial * params.color_range);
            CRGBF color = color_from_palette(params.palette_id, hue, brightness * params.saturation);

            int left_index = (half_leds - 1) - i;
            int right_index = half_leds + i;
            leds[left_index] = color;
            leds[right_index] = color;
        }
        apply_background_overlay(context);
        return;
    }

    // Energy-driven wave spawning using raw audio features
    const float energy_gate = fminf(
        1.0f,
        (AUDIO_VU * 0.8f) +
        (AUDIO_KICK() * 0.6f) +
        (AUDIO_NOVELTY * 0.4f)
    );

    // ... wave spawning and rendering logic ...

    #undef AUDIO_IS_AVAILABLE
    #undef AUDIO_AGE_MS
    #undef AUDIO_VU
    #undef AUDIO_NOVELTY
    #undef AUDIO_KICK
}
```

**Key Observations:**
1. ✅ Uses `context.audio_snapshot` (not global)
2. ✅ Defines local macros for cleaner access
3. ✅ Checks `AUDIO_IS_AVAILABLE()` first
4. ✅ Provides complete fallback animation
5. ✅ Combines multiple audio features (VU + KICK + NOVELTY)
6. ✅ Uses aggregation helper `get_audio_band_energy()`
7. ✅ Undefines macros at end
8. ✅ Frame-rate independent timing

---

## Part 7: Summary - The Golden Rules

### Rule 1: Read the Actual Code First
**Before proposing ANY pattern changes:**
- Read `docs/01-architecture/audio_sync_layer_system_guide.md`
- Read `firmware/src/pattern_audio_interface.h`
- Read 2+ working patterns in `firmware/src/patterns/`

### Rule 2: Never Assume Audio Fields
**K1.node1 does NOT have:**
- Direct `bass`, `mid`, `high`, `treble` fields
- Simple `beat` or `energy` scalars
- Global audio arrays you can read directly

**K1.node1 DOES have:**
- 64-bin `spectrogram[]` array
- 12-bin `chromagram[]` array
- Aggregation helpers: `AUDIO_BASS()`, `AUDIO_MIDS()`, `AUDIO_TREBLE()`
- Tempo arrays: `tempo_magnitude[]`, `tempo_phase[]`

### Rule 3: Always Check Availability
```cpp
if (!AUDIO_IS_AVAILABLE()) {
    // Provide fallback
    return;
}
```

### Rule 4: Handle Freshness and Age
```cpp
// Skip redundant rendering
if (audio.payload.update_counter == last_update) {
    return;
}

// Fade on stale data
if (age_ms > 50) {
    brightness *= 0.95f;
}
```

### Rule 5: Use the Snapshot from Context
```cpp
// CORRECT
const AudioDataSnapshot& audio = context.audio_snapshot;
float mag = audio.payload.spectrogram[i];

// WRONG
float mag = spectrogram[i];  // Not in scope
```

---

## Appendix A: Complete Type Definitions

```cpp
// From audio_sync_layer.h
typedef struct {
    std::atomic<uint32_t> sequence{0};      // Even=valid, Odd=writing
    AudioDataPayload payload;
    std::atomic<uint32_t> sequence_end{0};
} SequencedAudioBuffer;

typedef struct AudioDataSnapshot {
    uint32_t sequence_start;
    AudioDataPayload payload;
    uint32_t sequence_end;
} AudioDataSnapshot;

// From audio_types.h
typedef struct {
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
    float locked_tempo_bpm;
    TempoLockState tempo_lock_state;
    uint32_t update_counter;
    uint32_t timestamp_us;
    bool is_valid;
    bool is_silence;
} AudioDataPayload;

// Constants
#define NUM_FREQS 64
#define NUM_TEMPI 192
```

---

## Appendix B: Files to Read for Complete Understanding

**Must-read (in order):**
1. `/docs/01-architecture/audio_sync_layer_system_guide.md` - Architecture overview
2. `/firmware/src/pattern_audio_interface.h` - Pattern interface macros
3. `/firmware/src/patterns/misc_patterns.hpp` - Working pulse/perlin examples
4. `/firmware/src/patterns/spectrum_family.hpp` - Spectrum/octave examples

**Supporting files:**
- `/firmware/src/audio/audio_types.h` - Type definitions
- `/firmware/src/audio/audio_sync_layer.h` - Seqlock implementation
- `/firmware/src/audio/goertzel.h` - Frequency analysis
- `/firmware/src/pattern_render_context.h` - Context structure

---

**End of Canonical Audio-Visual Contract**

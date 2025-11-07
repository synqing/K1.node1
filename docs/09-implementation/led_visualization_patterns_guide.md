# LED Visualization Patterns: Implementation Guide
## Practical C++ Code Sketches for K1 Firmware

**Date:** 2025-11-07
**Status:** Reference
**Owner:** Embedded Firmware Engineer
**Scope:** Real-time pattern rendering on ESP32-S3 with dual RMT channels
**Related:** Advanced Audio Visualization Techniques (analysis), FastLED, RMT telemetry
**Tags:** firmware, LED-rendering, real-time, audio-reactive, patterns

---

## Overview

This guide provides concrete C++ implementations of visualization patterns described in the analysis. All code assumes:
- **ESP32-S3** with IDF5 (RMT v2 API available)
- **FastLED library** or direct RMT control
- **Audio features** pre-computed and passed via struct (STFT, chroma, onsets, etc.)
- **Update frequency**: 100 Hz (10ms per frame)
- **LED count**: 160 per channel (dual RMT)

---

## 1. Core Data Structures

### Audio Features Input

```cpp
// Every 10ms: fresh audio features arrive via this struct
struct AudioFeatures {
    // FFT-based
    float spectral_magnitude[32];    // 32 frequency bands (0–4kHz @ 125Hz/band)
    float spectral_centroid;         // [0, 8000] Hz
    float spectral_flux;             // Change in magnitude frame-to-frame
    float spectral_flatness;         // [0, 1], 0=pure tone, 1=noise

    // Chroma (12 pitch classes)
    float chroma[12];                // [0, 1], energy per semitone
    uint8_t dominant_pitch_class;    // 0–11, C to B
    float harmonic_consonance;       // [-1, 1], -1=minor, +1=major

    // Rhythm
    bool onset_detected;
    float onset_strength;            // [0, 1]
    float beat_phase;                // [0, 1], 0 = beat start, 1 = beat end
    int estimated_bpm;               // Tempo estimate

    // Perceptual (derived)
    float rms_energy;                // RMS loudness [0, 1]
    float arousal;                   // [0, 1], estimated mood dimension
    float valence;                   // [0, 1], estimated mood dimension

    // Harmonic-Percussive
    float harmonic_energy;           // Smooth sustained energy
    float percussive_energy;         // Transient attack energy
};

// Global updated every 10ms by audio thread
static volatile AudioFeatures g_audio_features = {};
```

### Particle System

```cpp
struct Particle {
    float x;                         // Position on strip [0, 160)
    float velocity;                  // LEDs/frame, can be negative
    uint8_t age;                     // Frames since birth
    uint8_t lifetime;                // Max age before removal
    uint8_t r, g, b;                 // RGB color
    float mass;                      // Inertia; affects force scaling
};

constexpr int MAX_PARTICLES = 100;
static std::vector<Particle> g_particles;
static uint32_t g_particle_spawn_time = 0;  // Last spawn event time
```

### Pattern State Machine

```cpp
enum class PatternType {
    SPECTRAL_CASCADE,
    HARMONIC_BLOOM,
    PERCUSSIVE_SPARK,
    FRACTAL_ZEN,
    CELLULAR_DREAMSCAPE,
    DUAL_HARMONIC,
};

enum class MoodQuadrant {
    ENERGETIC_HAPPY,    // High arousal, high valence
    CALM_HAPPY,         // Low arousal, high valence
    CALM_SAD,           // Low arousal, low valence
    ENERGETIC_SAD,      // High arousal, low valence
};

struct PatternState {
    PatternType current_pattern;
    PatternType next_pattern;
    MoodQuadrant current_mood;
    uint32_t transition_start_ms;
    uint8_t transition_progress;    // [0, 255]

    // Pattern-specific state
    float fractal_offset;           // For fBm scrolling
    uint8_t cellular_grid[160];     // For Game of Life variant
    uint8_t harmonic_hue_target[12];// Target hue per pitch class
    uint8_t spectral_brightness[32];// Envelope decay
};

static PatternState g_pattern_state = {
    .current_pattern = PatternType::SPECTRAL_CASCADE,
    .next_pattern = PatternType::SPECTRAL_CASCADE,
    .current_mood = MoodQuadrant::CALM_HAPPY,
    .transition_start_ms = 0,
    .transition_progress = 0,
};
```

### Color Palette System

```cpp
struct ColorPalette {
    uint8_t base_hue;               // 0–255 (0°–360°)
    uint8_t base_saturation;        // 0–255 (0%–100%)
    uint8_t base_brightness;        // 0–255

    uint8_t accent_hue;
    uint8_t accent_saturation;
    uint8_t accent_brightness;
};

// Four mood-based palettes
static const ColorPalette PALETTES[4] = {
    {
        // ENERGETIC_HAPPY
        .base_hue = 30,              // Orange-yellow
        .base_saturation = 200,
        .base_brightness = 180,
        .accent_hue = 200,           // Cyan
        .accent_saturation = 255,
        .accent_brightness = 255,
    },
    {
        // CALM_HAPPY
        .base_hue = 100,             // Green
        .base_saturation = 100,
        .base_brightness = 150,
        .accent_hue = 50,            // Yellow
        .accent_saturation = 150,
        .accent_brightness = 200,
    },
    {
        // CALM_SAD
        .base_hue = 200,             // Blue
        .base_saturation = 80,
        .base_brightness = 100,
        .accent_hue = 240,           // Deep blue
        .accent_saturation = 100,
        .accent_brightness = 80,
    },
    {
        // ENERGETIC_SAD
        .base_hue = 280,             // Purple
        .base_saturation = 180,
        .base_brightness = 150,
        .accent_hue = 0,             // Red
        .accent_saturation = 255,
        .accent_brightness = 200,
    },
};
```

---

## 2. Utility Functions

### Audio Utilities

```cpp
// Exponential smoothing for continuous parameters
void smooth_parameter(float& current, float target, float alpha) {
    current = alpha * target + (1.0f - alpha) * current;
}

void smooth_parameter_u8(uint8_t& current, uint8_t target, float alpha) {
    float temp = (float)current;
    temp = alpha * target + (1.0f - alpha) * temp;
    current = (uint8_t)temp;
}

// Linear interpolation
float lerp(float a, float b, float t) {
    return a + (b - a) * t;
}

uint8_t lerp_u8(uint8_t a, uint8_t b, uint8_t t) {
    return a + ((b - a) * t) / 255;
}

// Clamp to range
uint8_t clamp_u8(int val) {
    if (val < 0) return 0;
    if (val > 255) return 255;
    return (uint8_t)val;
}

float clamp_f(float val, float min_val, float max_val) {
    if (val < min_val) return min_val;
    if (val > max_val) return max_val;
    return val;
}

// Convert HSV to RGB (FastLED convention)
void hsv_to_rgb(uint8_t h, uint8_t s, uint8_t v, uint8_t& r, uint8_t& g, uint8_t& b) {
    // FastLED provides this; for completeness:
    // (Implementation in FastLED or reference implementation)
}

// Mood classification from arousal + valence
MoodQuadrant classify_mood(float arousal, float valence) {
    bool high_arousal = arousal > 0.5f;
    bool high_valence = valence > 0.5f;

    if (high_arousal && high_valence) return MoodQuadrant::ENERGETIC_HAPPY;
    if (!high_arousal && high_valence) return MoodQuadrant::CALM_HAPPY;
    if (!high_arousal && !high_valence) return MoodQuadrant::CALM_SAD;
    return MoodQuadrant::ENERGETIC_SAD;
}

// Exponential decay envelope for transient dimming
uint8_t decay_envelope(uint8_t start_brightness, float age_ratio) {
    // age_ratio: [0, 1], where 1 = particle dead
    // Exponential: brightness *= exp(-2 * age_ratio)
    float envelope = expf(-2.0f * age_ratio);
    return (uint8_t)(start_brightness * envelope);
}
```

### Particle System Utilities

```cpp
void spawn_particles(const AudioFeatures& features, int num_particles) {
    if (g_particles.size() >= MAX_PARTICLES) return;  // Pool full

    for (int i = 0; i < num_particles; i++) {
        Particle p;

        // Position: near beat location (or dominant chroma position)
        float beat_pos = features.beat_phase * 160.0f;
        p.x = clamp_f(beat_pos + (rand() % 20 - 10), 0, 160);

        // Velocity: spread based on spectral centroid (high = fast)
        float speed_factor = features.spectral_centroid / 8000.0f;
        p.velocity = (2.0f + speed_factor * 5.0f) * (rand() % 3 - 1);  // [-7, 7]

        // Age
        p.age = 0;

        // Lifetime: longer for high-frequency content
        p.lifetime = 20 + (uint8_t)(features.spectral_centroid / 400.0f);  // 20–40 frames

        // Color: from chroma of nearest pitch class
        uint8_t pitch = features.dominant_pitch_class;
        uint8_t hue = (pitch * 255) / 12;  // 0–255

        // Use FastLED or equivalent
        CRGB color = CHSV(hue, 200, 255);
        p.r = color.r;
        p.g = color.g;
        p.b = color.b;

        // Mass: affects inertia
        p.mass = clamp_f(features.spectral_flux, 0.5f, 2.0f);

        g_particles.push_back(p);
    }
}

void update_particles(const AudioFeatures& features, float dt) {
    // Attraction toward harmonic center
    float harmonic_center = features.chroma[0] * 0 +
                            features.chroma[1] * (1.0f / 12.0f) +
                            // ... sum all chroma contributions
                            features.chroma[11] * (11.0f / 12.0f);
    harmonic_center *= 160.0f;

    for (auto& p : g_particles) {
        // Attraction force
        float attraction = 0.1f * (harmonic_center - p.x) * p.mass;

        // Drag
        const float drag = 0.92f;
        p.velocity = (p.velocity + attraction) * drag;

        // Position update
        p.x += p.velocity;

        // Age
        p.age++;

        // Boundary wrapping (or clamping)
        if (p.x < 0) p.x += 160;
        if (p.x >= 160) p.x -= 160;
    }

    // Remove dead particles
    g_particles.erase(
        std::remove_if(g_particles.begin(), g_particles.end(),
                       [](const Particle& p) { return p.age >= p.lifetime; }),
        g_particles.end()
    );
}

void render_particles(CRGB* leds) {
    for (const auto& p : g_particles) {
        int led_idx = (int)p.x;
        if (led_idx < 0 || led_idx >= 160) continue;

        // Fade with age
        float age_ratio = p.age / (float)p.lifetime;
        uint8_t opacity = (uint8_t)(255 * (1.0f - age_ratio * age_ratio));

        // Additive blending
        leds[led_idx].r = clamp_u8(leds[led_idx].r + (p.r * opacity) / 255);
        leds[led_idx].g = clamp_u8(leds[led_idx].g + (p.g * opacity) / 255);
        leds[led_idx].b = clamp_u8(leds[led_idx].b + (p.b * opacity) / 255);
    }
}
```

---

## 3. Pattern Implementations

### Pattern 1: Spectral Cascade

```cpp
void render_spectral_cascade(const AudioFeatures& features, CRGB* leds) {
    // Divide 32 spectral bands into 16 groups, each controlling ~10 LEDs

    static float envelope[32] = {};  // Brightness tracking

    for (int band = 0; band < 32; band++) {
        // Exponential decay envelope
        envelope[band] *= 0.95f;  // Smooth fade

        // Input: new spectral magnitude
        envelope[band] = fmaxf(envelope[band], features.spectral_magnitude[band]);

        // Compute LED range for this band
        int led_start = (band * 160) / 32;
        int led_end = ((band + 1) * 160) / 32;

        // Hue: based on frequency (low = red, high = blue)
        uint8_t hue = (band * 255) / 32;

        // Saturation: based on harmonic consonance (more consonant = more saturated)
        uint8_t saturation = 200 + (uint8_t)(features.harmonic_consonance * 50);

        // Brightness: spectral magnitude
        uint8_t brightness = (uint8_t)(envelope[band] * 200);

        // Render all LEDs in this band
        CRGB color = CHSV(hue, saturation, brightness);
        for (int i = led_start; i < led_end; i++) {
            leds[i] = color;
        }
    }

    // Optional: add chroma overlay (pitch information)
    for (int pitch = 0; pitch < 12; pitch++) {
        if (features.chroma[pitch] > 0.1f) {
            int led_pos = (pitch * 160) / 12;
            uint8_t hue = (pitch * 255) / 12;
            uint8_t brightness = (uint8_t)(features.chroma[pitch] * 255);

            // Bright accent at pitch position
            if (led_pos >= 0 && led_pos < 160) {
                CRGB accent = CHSV(hue, 255, brightness);
                // Blend (can additive blend or replace)
                leds[led_pos] = accent;
            }
        }
    }
}
```

### Pattern 2: Harmonic Bloom

```cpp
void render_harmonic_bloom(const AudioFeatures& features, CRGB* leds) {
    // 12 pitch classes, each gets a segment and a hue

    static uint8_t chroma_brightness[12] = {};

    for (int pitch = 0; pitch < 12; pitch++) {
        // Smooth brightness tracking
        uint8_t target_brightness = (uint8_t)(features.chroma[pitch] * 255);
        smooth_parameter_u8(chroma_brightness[pitch], target_brightness, 0.15f);

        // LED range for this pitch class
        int led_start = (pitch * 160) / 12;
        int led_end = ((pitch + 1) * 160) / 12;

        // Hue: fixed per pitch class
        uint8_t hue = (pitch * 255) / 12;

        // Saturation: based on mood (energetic = high saturation)
        uint8_t saturation = 150 + (uint8_t)(features.arousal * 100);

        // Brightness: from chroma energy
        uint8_t brightness = chroma_brightness[pitch];

        // Create glowing effect by widening bright region
        int bloom_radius = 2 + (brightness / 64);  // 2–6 LED radius
        for (int i = led_start - bloom_radius; i < led_end + bloom_radius; i++) {
            if (i >= 0 && i < 160) {
                int dist = abs(i - (led_start + led_end) / 2);
                float bloom_falloff = fmaxf(0, 1.0f - (dist / (float)(bloom_radius + 2)));
                uint8_t bloom_brightness = (uint8_t)(brightness * bloom_falloff);

                CRGB color = CHSV(hue, saturation, bloom_brightness);

                // Additive blend
                leds[i].r = clamp_u8(leds[i].r + color.r);
                leds[i].g = clamp_u8(leds[i].g + color.g);
                leds[i].b = clamp_u8(leds[i].b + color.b);
            }
        }
    }
}
```

### Pattern 3: Percussive Spark Storm

```cpp
void render_percussive_spark_storm(const AudioFeatures& features, CRGB* leds) {
    // Update particle system based on percussive energy & onsets

    // Spawn particles on onset
    if (features.onset_detected) {
        int spawn_count = 3 + (int)(features.onset_strength * 8);  // 3–11 particles
        spawn_particles(features, spawn_count);
    }

    // Update physics
    update_particles(features, 0.01f);  // 10ms timestep

    // Clear LED buffer
    memset(leds, 0, 160 * sizeof(CRGB));

    // Render background: low percussive energy → dim, high → bright
    uint8_t base_brightness = (uint8_t)(features.percussive_energy * 80);
    for (int i = 0; i < 160; i++) {
        uint8_t hue = (i * 255) / 160;  // Spectrum gradient
        leds[i] = CHSV(hue, 100, base_brightness);
    }

    // Render particles (additive)
    render_particles(leds);
}
```

### Pattern 4: Fractal Zen

```cpp
// Perlin/Simplex noise implementation (use existing library or include)
float perlin_noise_1d(float x, uint32_t seed = 0);  // Returns [-1, 1]

void render_fractal_zen(const AudioFeatures& features, CRGB* leds) {
    static float fbm_offset = 0;

    // Update offset based on spectral flux (tempo of evolution)
    fbm_offset += features.spectral_flux * 0.5f;

    for (int i = 0; i < 160; i++) {
        // Fractal Brownian motion (multi-octave Perlin noise)
        float amplitude = 1.0f;
        float frequency = 1.0f;
        float fbm_value = 0.0f;
        float max_value = 0.0f;

        for (int octave = 0; octave < 4; octave++) {
            float val = perlin_noise_1d(i / 160.0f * frequency + fbm_offset * frequency);
            fbm_value += amplitude * val;
            max_value += amplitude;
            amplitude *= 0.5f;
            frequency *= 2.0f;
        }
        fbm_value /= max_value;  // Normalize to [-1, 1]
        fbm_value = (fbm_value + 1.0f) / 2.0f;  // Map to [0, 1]

        // Hue: driven by fBm, modulated by spectral centroid
        uint8_t hue = (uint8_t)(fbm_value * 255);
        uint8_t hue_offset = (uint8_t)(features.spectral_centroid / 40);
        hue += hue_offset;

        // Saturation: inversely tied to spectral entropy (clean = high sat)
        uint8_t saturation = (uint8_t)((1.0f - features.spectral_flatness) * 200);

        // Brightness: base + modulation by fbm
        uint8_t brightness = 100 + (uint8_t)(fbm_value * 100);

        leds[i] = CHSV(hue, saturation, brightness);
    }
}
```

### Pattern 5: Cellular Dreamscape

```cpp
void render_cellular_dreamscape(const AudioFeatures& features, CRGB* leds) {
    static uint8_t grid[160] = {};
    static uint32_t last_update_ms = 0;

    // Update cells every 50ms (synchronized with beat if available)
    uint32_t now = millis();
    bool should_update = (now - last_update_ms) > 50;

    if (should_update) {
        // Compute new state based on Game of Life variant
        uint8_t new_grid[160];
        memset(new_grid, 0, 160);

        for (int i = 0; i < 160; i++) {
            int left = (i - 1 + 160) % 160;
            int right = (i + 1) % 160;
            int neighbors = (grid[left] > 0 ? 1 : 0) + (grid[right] > 0 ? 1 : 0);

            // Birth rule: neighbors == 1 AND onset energy high
            bool birth = (neighbors == 1) && (features.onset_strength > 0.3f);

            // Survival rule: neighbors == 1 AND local energy sustained
            bool survival = grid[i] > 0 && (neighbors == 1) && (features.harmonic_energy > 0.2f);

            if (birth || survival) {
                new_grid[i] = 255;
            } else {
                new_grid[i] = 0;
            }
        }

        memcpy(grid, new_grid, 160);
        last_update_ms = now;
    }

    // Decay brightness over time
    for (int i = 0; i < 160; i++) {
        if (grid[i] > 0) {
            grid[i] = (uint8_t)(grid[i] * 0.85f);  // Exponential decay
        }
    }

    // Render
    for (int i = 0; i < 160; i++) {
        if (grid[i] > 0) {
            uint8_t hue = features.dominant_pitch_class * 21;  // 0–252 (12 classes)
            uint8_t saturation = 200;
            uint8_t brightness = grid[i];

            leds[i] = CHSV(hue, saturation, brightness);
        } else {
            leds[i] = CRGB::Black;
        }
    }
}
```

### Pattern 6: Dual-Harmonic Interplay (Dual RMT)

```cpp
// Render harmonic channel (RMT Ch1)
void render_harmonic_channel(const AudioFeatures& features, CRGB* leds_ch1) {
    // Use harmonic component
    // Smooth chroma-based coloring; slow evolution

    static uint8_t harmonic_hue[160] = {};

    for (int pitch = 0; pitch < 12; pitch++) {
        int led_start = (pitch * 160) / 12;
        int led_end = ((pitch + 1) * 160) / 12;

        uint8_t target_hue = (pitch * 255) / 12;
        for (int i = led_start; i < led_end; i++) {
            smooth_parameter_u8(harmonic_hue[i], target_hue, 0.05f);

            uint8_t brightness = (uint8_t)(features.chroma[pitch] * 200);
            leds_ch1[i] = CHSV(harmonic_hue[i], 200, brightness);
        }
    }
}

// Render percussive channel (RMT Ch2)
void render_percussive_channel(const AudioFeatures& features, CRGB* leds_ch2) {
    // Use percussive component
    // Brief bright flashes on onsets

    memset(leds_ch2, 0, 160 * sizeof(CRGB));

    if (features.onset_detected) {
        // Spread flash across strip
        int onset_pos = (int)(features.beat_phase * 160);
        int flash_radius = 5 + (int)(features.onset_strength * 15);

        for (int i = 0; i < 160; i++) {
            int dist = abs(i - onset_pos);
            if (dist < flash_radius) {
                float falloff = 1.0f - (dist / (float)flash_radius);
                uint8_t flash_brightness = (uint8_t)(255 * falloff * features.onset_strength);

                leds_ch2[i] = CHSV(features.dominant_pitch_class * 21, 255, flash_brightness);
            }
        }
    } else {
        // Low glow during non-onset
        uint8_t ambient = (uint8_t)(features.percussive_energy * 40);
        for (int i = 0; i < 160; i++) {
            uint8_t hue = (i * 255) / 160;
            leds_ch2[i] = CHSV(hue, 100, ambient);
        }
    }
}
```

---

## 4. Main Rendering Loop

```cpp
void render_frame(const AudioFeatures& features, CRGB* leds_ch1, CRGB* leds_ch2) {
    // Update pattern state based on mood changes
    MoodQuadrant new_mood = classify_mood(features.arousal, features.valence);
    if (new_mood != g_pattern_state.current_mood) {
        g_pattern_state.current_mood = new_mood;
        g_pattern_state.transition_start_ms = millis();
        g_pattern_state.transition_progress = 0;
    }

    // Handle pattern transitions (if pattern changed)
    if (g_pattern_state.current_pattern != g_pattern_state.next_pattern) {
        g_pattern_state.transition_progress++;
        if (g_pattern_state.transition_progress >= 255) {
            g_pattern_state.current_pattern = g_pattern_state.next_pattern;
            g_pattern_state.transition_progress = 0;
        }
    }

    // Clear LED buffers
    memset(leds_ch1, 0, 160 * sizeof(CRGB));
    memset(leds_ch2, 0, 160 * sizeof(CRGB));

    // Render primary pattern (Channel 1)
    switch (g_pattern_state.current_pattern) {
        case PatternType::SPECTRAL_CASCADE:
            render_spectral_cascade(features, leds_ch1);
            break;
        case PatternType::HARMONIC_BLOOM:
            render_harmonic_bloom(features, leds_ch1);
            break;
        case PatternType::PERCUSSIVE_SPARK:
            render_percussive_spark_storm(features, leds_ch1);
            break;
        case PatternType::FRACTAL_ZEN:
            render_fractal_zen(features, leds_ch1);
            break;
        case PatternType::CELLULAR_DREAMSCAPE:
            render_cellular_dreamscape(features, leds_ch1);
            break;
        case PatternType::DUAL_HARMONIC:
            render_harmonic_channel(features, leds_ch1);
            break;
    }

    // Render secondary pattern (Channel 2) if dual-harmonic, otherwise render accent layer
    if (g_pattern_state.current_pattern == PatternType::DUAL_HARMONIC) {
        render_percussive_channel(features, leds_ch2);
    } else {
        // For other patterns, Ch2 provides accent flashes
        if (features.onset_detected) {
            int onset_pos = (int)(features.beat_phase * 160);
            for (int i = 0; i < 160; i++) {
                int dist = abs(i - onset_pos);
                if (dist < 8) {
                    float intensity = 1.0f - (dist / 8.0f);
                    uint8_t brightness = (uint8_t)(255 * intensity * features.onset_strength);
                    leds_ch2[i] = CHSV(0, 255, brightness);  // Red accent
                }
            }
        }
    }

    // Transmit to RMT (handled by FastLED or custom RMT driver)
    // FastLED.show();  // If using FastLED
    // Or: rmt_transmit_dual_channels(leds_ch1, leds_ch2);
}
```

---

## 5. Integration Checklist

- [ ] Define `struct AudioFeatures` and ensure audio thread populates it every 10ms
- [ ] Implement `STFT` → `spectral_magnitude[32]`, `spectral_centroid`, `spectral_flux`
- [ ] Implement `chroma extraction` → `chroma[12]`, `dominant_pitch_class`, `harmonic_consonance`
- [ ] Implement `HPSS decomposition` → `harmonic_energy`, `percussive_energy`
- [ ] Implement `onset detection` → `onset_detected`, `onset_strength`
- [ ] Implement `beat tracking` → `beat_phase`, `estimated_bpm`
- [ ] Implement `mood estimation` → `arousal`, `valence`
- [ ] Compile all pattern functions; test individually on device
- [ ] Measure CPU load for each pattern; identify bottlenecks
- [ ] Benchmark end-to-end latency from audio input to LED output
- [ ] Gather user feedback; iterate on pattern weighting & palette selection

---

**Document prepared by Embedded Firmware Engineer**
**Last updated: 2025-11-07**
**Related:** Advanced Audio Visualization Techniques (analysis), K1 firmware architecture

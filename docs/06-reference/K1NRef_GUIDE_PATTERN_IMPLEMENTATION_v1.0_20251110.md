# Pattern Implementation Quick Reference

**Purpose:** Copy-paste templates for creating professional audio-reactive LED patterns
**Based on:** SensoryBridge 4.1.1 as the canonical behavioral reference, with Emotiscope 2.0 used only as a secondary technical reference where SensoryBridge does not define specific behavior.
**Status:** Ready to use

---

## Template 1: Spectrum-Based Pattern (Frequency Visualization)

**Use Case:** Display frequency magnitude across LEDs

```cpp
void draw_spectrum_template(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    if (!AUDIO_IS_AVAILABLE()) {
        // Idle: Gentle breathing animation
        for (int i = 0; i < NUM_LEDS; i++) {
            float progress = (float)i / NUM_LEDS;
            float breath = 0.5f + 0.3f * sinf(time * params.speed + progress * 3.14159f);
            leds[i] = color_from_palette(params.palette_id, progress, breath * params.brightness);
        }
        return;
    }

    // Render spectrum from center outward
    int half_leds = NUM_LEDS / 2;
    float age_ms = (float)AUDIO_AGE_MS();
    float age_factor = 1.0f - fminf(age_ms, 250.0f) / 250.0f;  // Fade when silent
    age_factor = fmaxf(0.0f, age_factor);

    for (int i = 0; i < half_leds; i++) {
        float progress = (float)i / (float)half_leds;
        float magnitude = clip_float(AUDIO_SPECTRUM_INTERP(progress));

        // PERCEPTUAL MAPPING
        magnitude = response_sqrt(magnitude) * age_factor;

        // COLOR FROM PALETTE (not raw HSV)
        CRGBF color = color_from_palette(params.palette_id, progress, magnitude);

        // APPLY BRIGHTNESS
        color.r *= params.brightness;
        color.g *= params.brightness;
        color.b *= params.brightness;

        // MIRROR FROM CENTER
        leds[half_leds - 1 - i] = color;
        leds[half_leds + i] = color;
    }

    apply_background_overlay(params);
}
```

**Key Features:**
- Palette-based coloring (NOT raw HSV)
- Perceptual sqrt mapping
- Center-origin mirroring
- Age-based fade for silence
- Idle animation included

---

## Template 2: Chromagram-Based Pattern (Musical Notes)

**Use Case:** Display 12 musical note intensities

```cpp
void draw_chromagram_template(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    if (!AUDIO_IS_AVAILABLE()) {
        // Idle: Rotating rainbow
        for (int i = 0; i < NUM_LEDS; i++) {
            float progress = fmodf(time * params.speed * 0.5f + (float)i / NUM_LEDS, 1.0f);
            leds[i] = color_from_palette(params.palette_id, progress, params.background * params.brightness);
        }
        return;
    }

    // Energy gate: boost on strong chromatic activity
    float chroma_energy = 0.0f;
    for (int i = 0; i < 12; i++) {
        chroma_energy += AUDIO_CHROMAGRAM[i];
    }
    chroma_energy = fminf(1.0f, chroma_energy / 12.0f);
    float energy_boost = 1.0f + beat_gate(chroma_energy) * 0.5f;

    // Age-based decay
    float age_ms = (float)AUDIO_AGE_MS();
    float age_factor = 1.0f - fminf(age_ms, 250.0f) / 250.0f;
    age_factor = fmaxf(0.0f, age_factor);

    // Render chromagram
    int half_leds = NUM_LEDS / 2;
    for (int i = 0; i < half_leds; i++) {
        float progress = (float)i / (float)half_leds;

        // Map LED position to 12 musical notes
        float magnitude = interpolate(progress, AUDIO_CHROMAGRAM, 12);

        // PERCEPTUAL MAPPING
        magnitude = response_sqrt(magnitude) * energy_boost * age_factor;
        magnitude = fmaxf(0.0f, fminf(1.0f, magnitude));

        // COLOR FROM PALETTE
        CRGBF color = color_from_palette(params.palette_id, progress, magnitude);

        // APPLY BRIGHTNESS
        color.r *= params.brightness;
        color.g *= params.brightness;
        color.b *= params.brightness;

        // MIRROR
        leds[half_leds - 1 - i] = color;
        leds[half_leds + i] = color;
    }

    apply_background_overlay(params);
}
```

**Key Features:**
- Chromagram (12 notes) mapping
- Energy-gated boost on harmonic activity
- Smooth interpolation across notes
- Age-based silence handling

---

## Template 3: Persistence/Trail Pattern

**Use Case:** Create ghosting/motion trail effect

```cpp
static float pattern_trail[NUM_LEDS] = {0.0f};

void draw_trail_pattern(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    // STEP 1: DECAY TRAIL BUFFER
    float trail_decay = 0.92f + 0.05f * clip_float(params.softness);  // 0.92-0.97 range
    for (int i = 0; i < NUM_LEDS; i++) {
        pattern_trail[i] *= trail_decay;
    }

    if (!AUDIO_IS_AVAILABLE()) {
        // Idle: Gentle pulsing trail
        for (int i = 0; i < NUM_LEDS; i++) {
            float pulse = 0.3f + 0.2f * sinf(time * params.speed + (float)i / NUM_LEDS);
            pattern_trail[i] = fmaxf(pattern_trail[i], pulse);

            CRGBF color = color_from_palette(params.palette_id, (float)i / NUM_LEDS, pattern_trail[i]);
            color.r *= params.brightness;
            color.g *= params.brightness;
            color.b *= params.brightness;
            leds[i] = color;
        }
        apply_background_overlay(params);
        return;
    }

    // STEP 2: RENDER SPECTRUM
    int half_leds = NUM_LEDS / 2;
    for (int i = 0; i < half_leds; i++) {
        float progress = (float)i / (float)half_leds;
        float magnitude = clip_float(AUDIO_SPECTRUM_INTERP(progress));
        magnitude = response_sqrt(magnitude);

        // Get color
        CRGBF color = color_from_palette(params.palette_id, progress, magnitude);

        // Apply brightness
        color.r *= params.brightness;
        color.g *= params.brightness;
        color.b *= params.brightness;

        // Mirror
        int left_idx = half_leds - 1 - i;
        int right_idx = half_leds + i;

        leds[left_idx] = color;
        leds[right_idx] = color;

        // Update trail with current spectrum (take max to preserve peaks)
        pattern_trail[left_idx] = fmaxf(pattern_trail[left_idx], magnitude);
        pattern_trail[right_idx] = fmaxf(pattern_trail[right_idx], magnitude);
    }

    // STEP 3: APPLY TRAIL GLOW (COLORED, not white)
    float trail_strength = 0.15f * clip_float(params.custom_param_1);  // User tunable
    for (int i = 0; i < NUM_LEDS; i++) {
        if (pattern_trail[i] > 0.05f) {
            // Get HSV to tint trail
            HSVF hsv_current = rgb_to_hsv(leds[i]);

            // Create colored trail (preserve hue, reduce saturation & brightness)
            CRGBF trail_color = hsv(hsv_current.h, 0.5f, pattern_trail[i] * 0.4f);

            // Blend trail onto current color (additive)
            leds[i].r = fminf(1.0f, leds[i].r + trail_color.r * trail_strength);
            leds[i].g = fminf(1.0f, leds[i].g + trail_color.g * trail_strength);
            leds[i].b = fminf(1.0f, leds[i].b + trail_color.b * trail_strength);
        }
    }

    apply_background_overlay(params);
}
```

**Key Features:**
- Exponential trail decay (0.92-0.97 range)
- Trail integrated into rendering (not bolted-on)
- Colored glow (not white)
- Soft idle animation
- Customizable trail strength

---

## Template 4: Beat/Pulse Pattern

**Use Case:** Synchronized dot animations to beat

```cpp
void draw_beat_pattern(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    if (!AUDIO_IS_AVAILABLE()) {
        // Idle: Gentle pulsing dots
        for (int i = 0; i < NUM_LEDS; i++) {
            float pulse = 0.5f + 0.3f * sinf(time * params.speed * 2.0f + (float)i / NUM_LEDS);
            CRGBF color = color_from_palette(params.palette_id, (float)i / NUM_LEDS, pulse);
            color.r *= params.brightness;
            color.g *= params.brightness;
            color.b *= params.brightness;
            leds[i] = color;
        }
        apply_background_overlay(params);
        return;
    }

    // Get beat energy
    float energy = fminf(1.0f, (AUDIO_VU * 0.7f) + (AUDIO_NOVELTY * 0.3f));
    float beat_threshold = 0.3f + 0.5f * clip_float(params.custom_param_1);
    float beat_strength = beat_gate(energy > beat_threshold ? energy : 0.0f);

    // Create beat-synchronized boost
    float boost = 1.0f + beat_strength * 0.6f;  // 1.0-1.6x brightness

    // Render base spectrum
    int half_leds = NUM_LEDS / 2;
    for (int i = 0; i < half_leds; i++) {
        float progress = (float)i / (float)half_leds;
        float magnitude = clip_float(AUDIO_SPECTRUM_INTERP(progress));
        magnitude = response_sqrt(magnitude);

        // Color with beat boost
        CRGBF color = color_from_palette(params.palette_id, progress, magnitude);
        color.r *= params.brightness * boost;
        color.g *= params.brightness * boost;
        color.b *= params.brightness * boost;
        color.r = fminf(1.0f, color.r);
        color.g = fminf(1.0f, color.g);
        color.b = fminf(1.0f, color.b);

        leds[half_leds - 1 - i] = color;
        leds[half_leds + i] = color;
    }

    apply_background_overlay(params);
}
```

**Key Features:**
- Energy gate for beat detection
- Multiplicative brightness boost (not additive white)
- Beat-synchronized color intensity
- Customizable beat sensitivity
- Idle animation

---

## Template 5: Perlin Noise/Procedural Pattern

**Use Case:** Organic, evolving visual patterns

```cpp
void draw_procedural_template(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    // Get audio for modulation
    float energy = AUDIO_IS_AVAILABLE() ? fminf(1.0f, AUDIO_VU + AUDIO_NOVELTY) : 0.5f;

    // Time-varying Perlin seed
    float noise_x = time * params.speed * 0.1f;
    float noise_y = params.color * 10.0f;  // Color parameter as seed

    for (int i = 0; i < NUM_LEDS; i++) {
        float progress = (float)i / NUM_LEDS;

        // Generate Perlin-like noise for this position
        float noise_val = perlin_noise_simple(
            noise_x + progress * 5.0f,
            noise_y
        );

        // Modulate with audio energy
        float magnitude = noise_val * energy;
        magnitude = fmaxf(0.0f, fminf(1.0f, magnitude));

        // Color based on progress + noise
        float hue_offset = noise_val * 0.2f;  // Perturb hue
        CRGBF color = color_from_palette(
            params.palette_id,
            fmodf(progress + hue_offset, 1.0f),
            magnitude
        );

        color.r *= params.brightness;
        color.g *= params.brightness;
        color.b *= params.brightness;

        leds[i] = color;
    }

    apply_background_overlay(params);
}
```

**Key Features:**
- Time-based Perlin evolution
- Audio-modulated noise intensity
- Color palette integration
- Organic, procedural appearance

---

## Common Helpers & Utilities

### Perceptual Response Curve
```cpp
inline float response_sqrt(float x) {
    return sqrtf(clip_float(x));
}

inline float response_double_sqrt(float x) {
    x = clip_float(x);
    x = sqrtf(x);
    return sqrtf(x);
}
```

### Audio Age Factor (Fade on Silence)
```cpp
inline float get_age_factor(float fade_duration_ms) {
    float age_ms = (float)AUDIO_AGE_MS();
    float age_factor = 1.0f - fminf(age_ms, fade_duration_ms) / fade_duration_ms;
    return fmaxf(0.0f, age_factor);
}
```

### Saturation Modulation
```cpp
inline CRGBF apply_saturation_modulation(
    const CRGBF& color,
    float magnitude,
    float sat_min = 0.6f,
    float sat_max = 1.0f
) {
    HSVF hsv = rgb_to_hsv(color);
    hsv.s = sat_min + (magnitude * (sat_max - sat_min));
    return hsv(hsv.h, hsv.s, hsv.v);
}
```

### Center-Origin Rendering
```cpp
inline void render_center_origin(
    const CRGBF& color,
    int led_index,
    int num_leds
) {
    int half = num_leds / 2;
    int left_idx = half - 1 - led_index;
    int right_idx = half + led_index;

    leds[left_idx] = color;
    leds[right_idx] = color;
}
```

### Beat Detection
```cpp
inline float get_beat_strength(
    float beat_threshold = 0.35f,
    float vu_weight = 0.7f,
    float novelty_weight = 0.3f
) {
    float energy = fminf(1.0f, (AUDIO_VU * vu_weight) + (AUDIO_NOVELTY * novelty_weight));
    return beat_gate(energy > beat_threshold ? energy : 0.0f);
}
```

---

## Common Pitfalls & Fixes

### Pitfall #1: Raw HSV Hue Mapping
```cpp
// BAD
float hue = frequency_progress;  // 0.0-1.0 linear
CRGBF color = hsv(hue, 0.85f, magnitude);

// GOOD
CRGBF color = color_from_palette(params.palette_id, frequency_progress, magnitude);
```

### Pitfall #2: Fixed High Saturation
```cpp
// BAD
float saturation = 0.85f + 0.15f * energy;  // Always 0.85+

// GOOD
float saturation = 0.6f + (magnitude * 0.4f);  // 0.6-1.0 range
```

### Pitfall #3: No Idle Animation
```cpp
// BAD
if (!AUDIO_IS_AVAILABLE()) return;  // Go blank

// GOOD
if (!AUDIO_IS_AVAILABLE()) {
    // Render time-based breathing animation
    for (int i = 0; i < NUM_LEDS; i++) {
        float breath = 0.5f + 0.3f * sinf(time * params.speed);
        leds[i] = color_from_palette(params.palette_id, (float)i / NUM_LEDS, breath);
    }
    return;
}
```

### Pitfall #4: Linear Trail Decay
```cpp
// BAD
trail[i] *= 0.95f;  // Linear decay (mechanical feel)

// GOOD
trail[i] *= 0.99f;  // Exponential decay (natural feel)
```

### Pitfall #5: White Trail Glow
```cpp
// BAD
float trail_brightness = trail[i] * trail_strength;
leds[i].r += trail_brightness;
leds[i].g += trail_brightness;
leds[i].b += trail_brightness;  // Creates white glow

// GOOD
HSVF hsv = rgb_to_hsv(leds[i]);
CRGBF trail_color = hsv(hsv.h, 0.5f, trail[i] * 0.4f);  // Colored glow
leds[i].r = fminf(1.0f, leds[i].r + trail_color.r * trail_strength);
leds[i].g = fminf(1.0f, leds[i].g + trail_color.g * trail_strength);
leds[i].b = fminf(1.0f, leds[i].b + trail_color.b * trail_strength);
```

---

## Testing Checklist

When implementing a new pattern:

- [ ] **Audio Available:** Pattern renders with audio
- [ ] **Audio Unavailable:** Idle animation plays (no blank screen)
- [ ] **Quiet Sections:** Bass and low-amplitude frequencies visible
- [ ] **Loud Sections:** Colors punch through, no oversaturation
- [ ] **Silence Transition:** Smooth fade when audio stops
- [ ] **Brightness Control:** Brightness parameter affects overall luminosity
- [ ] **Speed Control:** Speed parameter affects animation/decay rate
- [ ] **Custom Parameters:** custom_param_1/2/3 control desired effects
- [ ] **Palette System:** Pattern works with all 33 palettes
- [ ] **Mirror Mode:** If applicable, pattern looks good mirrored (center-origin)
- [ ] **Background Overlay:** Background parameter works correctly
- [ ] **Performance:** Renders at 60+ FPS consistently

---

## Performance Tips

1. **Move buffer operations out of hot loop**
   ```cpp
   // BAD: 160 interpolations per frame
   for (int i = 0; i < NUM_LEDS; i++) {
       float mag = AUDIO_SPECTRUM_INTERP(progress);  // Called 160 times
   }

   // GOOD: Interpolate half, use for both sides
   int half = NUM_LEDS / 2;
   for (int i = 0; i < half; i++) {
       float mag = AUDIO_SPECTRUM_INTERP((float)i / half);  // Called 80 times
       leds[half - 1 - i] = color;
       leds[half + i] = color;
   }
   ```

2. **Cache expensive calculations**
   ```cpp
   // Cache sqrt operation
   float magnitude = clip_float(AUDIO_SPECTRUM_INTERP(progress));
   magnitude = response_sqrt(magnitude);  // Once
   // Use magnitude multiple times
   ```

3. **Avoid HSV conversion in hot path**
   ```cpp
   // BAD: Convert RGB→HSV→RGB every frame
   for (int i = 0; i < NUM_LEDS; i++) {
       HSVF hsv = rgb_to_hsv(leds[i]);
       // ... modify ...
       leds[i] = hsv(...);
   }

   // GOOD: Use palette system instead
   CRGBF color = color_from_palette(...);  // Already HSV internally
   ```

---

## Related Documentation

- Full Analysis: `docs/05-analysis/emotiscope_sensorybridge_forensic_analysis.md`
- Color Science: `docs/05-analysis/pattern_design_visual_principles.md`
- Audio Interface: Check `pattern_audio_interface.h` for available APIs
- Palette System: Check `palettes.h` for palette definitions
- Helper Functions: Check `emotiscope_helpers.h` for utility functions

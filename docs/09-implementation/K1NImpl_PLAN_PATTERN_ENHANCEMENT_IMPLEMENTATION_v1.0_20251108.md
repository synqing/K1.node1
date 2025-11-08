# Pattern Enhancement Implementation Plan

**Title**: Step-by-Step Implementation Guide for Multi-Dimensional Pattern Enhancements
**Owner**: Engineering Team
**Date**: 2025-11-07
**Status**: Proposed
**Scope**: Firmware implementation, testing, deployment
**Related**:
  - `/docs/04-planning/K1NPlan_PROPOSAL_AUDIO_VISUALIZATION_ENHANCEMENT_v1.0_20251108.md`
  - `/firmware/src/generated_patterns.h`
  - `/firmware/src/audio/goertzel.h`
**Tags**: implementation, patterns, audio-processing, enhancement

---

## Overview

This document provides concrete implementation steps to transform K1.node1's existing patterns from 1-dimensional reactive displays into rich, multi-dimensional visualizations. Each modification includes specific code changes, testing procedures, and validation metrics.

---

## Phase 1: Audio Feature Infrastructure (Days 1-3)

### Step 1.1: Extend AudioDataSnapshot Structure

**File**: `/firmware/src/audio/goertzel.h`

```cpp
// Add to AudioDataSnapshot struct
struct AudioDataSnapshot {
    // Existing fields...
    float spectrum[NUM_FREQS];
    float chromagram[12];
    float tempi[NUM_TEMPI];
    float vu_level;

    // NEW: Advanced features
    float spectrum_harmonic[NUM_FREQS];    // Harmonic component (HPSS)
    float spectrum_percussive[NUM_FREQS];  // Percussive component (HPSS)
    float spectral_centroid;               // Brightness (0-1)
    float spectral_flux;                   // Change rate (0-1)
    float spectral_rolloff;                // High freq content (0-1)

    // NEW: Onset detection
    bool onset_detected;
    float onset_strength;                  // 0-1
    uint8_t onset_bin;                     // Frequency bin of onset

    // NEW: Beat tracking
    float beat_phase;                      // 0-1 position in beat
    float beat_confidence;                 // 0-1
    float current_bpm;                     // 60-200
    uint32_t beat_count;                   // Total beats detected

    // NEW: Emotion estimation
    float arousal;                         // 0-1 (energy level)
    float valence;                         // 0-1 (positivity)
    uint8_t mood_quadrant;                 // 0-3 (enum)

    // NEW: Harmonic analysis
    float harmonic_ratio;                  // Harmonic vs percussive energy
    uint8_t key_signature;                 // 0-11 (detected key)
    float consonance;                      // 0-1 (harmonic consonance)
};
```

### Step 1.2: Implement HPSS (Harmonic-Percussive Source Separation)

**File**: `/firmware/src/audio/audio_processing.cpp` (new)

```cpp
#include <cstring>
#include <algorithm>
#include "esp_dsp.h"

class HarmonicPercussiveSeparator {
private:
    static constexpr int MEDIAN_SIZE = 17;  // Median filter size
    float harmonic_buffer[NUM_FREQS][MEDIAN_SIZE];
    float percussive_buffer[NUM_FREQS][MEDIAN_SIZE];
    int buffer_index = 0;

public:
    void process(const float* spectrum,
                 float* harmonic_out,
                 float* percussive_out) {

        // Store current frame
        for (int f = 0; f < NUM_FREQS; f++) {
            harmonic_buffer[f][buffer_index] = spectrum[f];
        }

        // Median filter across time (harmonic)
        for (int f = 0; f < NUM_FREQS; f++) {
            float sorted[MEDIAN_SIZE];
            memcpy(sorted, harmonic_buffer[f], sizeof(sorted));
            std::sort(sorted, sorted + MEDIAN_SIZE);
            harmonic_out[f] = sorted[MEDIAN_SIZE/2];
        }

        // Median filter across frequency (percussive)
        for (int f = 0; f < NUM_FREQS; f++) {
            float window[MEDIAN_SIZE];
            for (int i = 0; i < MEDIAN_SIZE; i++) {
                int idx = f + i - MEDIAN_SIZE/2;
                idx = std::max(0, std::min(NUM_FREQS-1, idx));
                window[i] = spectrum[idx];
            }
            std::sort(window, window + MEDIAN_SIZE);
            percussive_out[f] = window[MEDIAN_SIZE/2];
        }

        // Normalize outputs
        float h_sum = 0, p_sum = 0;
        for (int f = 0; f < NUM_FREQS; f++) {
            h_sum += harmonic_out[f];
            p_sum += percussive_out[f];
        }

        if (h_sum > 0) {
            float scale = 1.0f / h_sum;
            dsps_mulc_f32_ansi(harmonic_out, harmonic_out,
                              NUM_FREQS, scale, 1, 1);
        }

        if (p_sum > 0) {
            float scale = 1.0f / p_sum;
            dsps_mulc_f32_ansi(percussive_out, percussive_out,
                              NUM_FREQS, scale, 1, 1);
        }

        buffer_index = (buffer_index + 1) % MEDIAN_SIZE;
    }
};
```

### Step 1.3: Implement Spectral Features

**File**: `/firmware/src/audio/spectral_features.cpp` (new)

```cpp
class SpectralFeatures {
public:
    float compute_centroid(const float* spectrum) {
        float weighted_sum = 0;
        float magnitude_sum = 0;

        for (int i = 0; i < NUM_FREQS; i++) {
            float freq = 55.0f * powf(2.0f, i / 12.0f);  // Hz
            weighted_sum += freq * spectrum[i];
            magnitude_sum += spectrum[i];
        }

        if (magnitude_sum > 0) {
            float centroid_hz = weighted_sum / magnitude_sum;
            // Normalize to 0-1 (55Hz-5kHz range)
            return logf(centroid_hz / 55.0f) / logf(5000.0f / 55.0f);
        }
        return 0.5f;
    }

    float compute_flux(const float* spectrum, const float* prev_spectrum) {
        float flux = 0;
        for (int i = 0; i < NUM_FREQS; i++) {
            float diff = spectrum[i] - prev_spectrum[i];
            if (diff > 0) flux += diff * diff;  // Half-wave rectification
        }
        return tanhf(flux * 2.0f);  // Normalize with tanh
    }

    float compute_rolloff(const float* spectrum, float threshold = 0.85f) {
        float total_energy = 0;
        for (int i = 0; i < NUM_FREQS; i++) {
            total_energy += spectrum[i];
        }

        float cumsum = 0;
        for (int i = 0; i < NUM_FREQS; i++) {
            cumsum += spectrum[i];
            if (cumsum >= total_energy * threshold) {
                return (float)i / NUM_FREQS;
            }
        }
        return 1.0f;
    }
};
```

### Step 1.4: Implement Onset Detection

**File**: `/firmware/src/audio/onset_detector.cpp` (new)

```cpp
class OnsetDetector {
private:
    static constexpr int HISTORY_SIZE = 20;
    float flux_history[HISTORY_SIZE] = {0};
    int history_index = 0;
    uint32_t last_onset_time = 0;
    static constexpr uint32_t MIN_ONSET_GAP_MS = 50;  // Debounce

public:
    struct OnsetResult {
        bool detected;
        float strength;
        uint8_t frequency_bin;
    };

    OnsetResult detect(const float* spectrum, const float* prev_spectrum) {
        OnsetResult result = {false, 0, 0};

        // Compute spectral flux
        float flux = 0;
        int max_bin = 0;
        float max_diff = 0;

        for (int i = 0; i < NUM_FREQS; i++) {
            float diff = spectrum[i] - prev_spectrum[i];
            if (diff > 0) {
                flux += diff;
                if (diff > max_diff) {
                    max_diff = diff;
                    max_bin = i;
                }
            }
        }

        // Update history
        flux_history[history_index] = flux;
        history_index = (history_index + 1) % HISTORY_SIZE;

        // Compute adaptive threshold
        float mean = 0, variance = 0;
        for (int i = 0; i < HISTORY_SIZE; i++) {
            mean += flux_history[i];
        }
        mean /= HISTORY_SIZE;

        for (int i = 0; i < HISTORY_SIZE; i++) {
            float diff = flux_history[i] - mean;
            variance += diff * diff;
        }
        variance /= HISTORY_SIZE;
        float std_dev = sqrtf(variance);

        float threshold = mean + 1.5f * std_dev;

        // Detect onset with debouncing
        uint32_t now = esp_timer_get_time() / 1000;  // ms
        if (flux > threshold && (now - last_onset_time) > MIN_ONSET_GAP_MS) {
            result.detected = true;
            result.strength = fminf(1.0f, (flux - mean) / (3.0f * std_dev));
            result.frequency_bin = max_bin;
            last_onset_time = now;
        }

        return result;
    }
};
```

### Step 1.5: Implement Emotion Estimation

**File**: `/firmware/src/audio/emotion_estimator.cpp` (new)

```cpp
class EmotionEstimator {
private:
    // Smoothing buffers
    static constexpr int WINDOW_SIZE = 100;  // ~1 second at 100Hz
    float arousal_history[WINDOW_SIZE] = {0};
    float valence_history[WINDOW_SIZE] = {0};
    int history_index = 0;

public:
    struct EmotionState {
        float arousal;      // 0-1
        float valence;      // 0-1
        uint8_t quadrant;   // 0: happy-energetic, 1: happy-calm,
                           // 2: sad-energetic, 3: sad-calm
    };

    EmotionState estimate(const AudioDataSnapshot& audio) {
        // Arousal: energy + tempo + brightness + flux
        float instant_arousal = 0;
        instant_arousal += audio.vu_level * 0.3f;
        instant_arousal += fminf(audio.current_bpm / 160.0f, 1.0f) * 0.3f;
        instant_arousal += audio.spectral_centroid * 0.2f;
        instant_arousal += audio.spectral_flux * 0.2f;

        // Valence: consonance + major/minor + brightness
        float instant_valence = 0.5f;  // Neutral baseline

        // Harmonic consonance (simplified)
        float consonance = compute_consonance(audio.chromagram);
        instant_valence += (consonance - 0.5f) * 0.4f;

        // Mode detection (major = happy, minor = sad)
        bool is_major = detect_major_mode(audio.chromagram);
        instant_valence += is_major ? 0.2f : -0.2f;

        // Brightness contribution
        instant_valence += (audio.spectral_centroid - 0.5f) * 0.2f;

        // Clamp
        instant_arousal = fmaxf(0.0f, fminf(1.0f, instant_arousal));
        instant_valence = fmaxf(0.0f, fminf(1.0f, instant_valence));

        // Update history
        arousal_history[history_index] = instant_arousal;
        valence_history[history_index] = instant_valence;
        history_index = (history_index + 1) % WINDOW_SIZE;

        // Compute smoothed values
        EmotionState state;
        state.arousal = 0;
        state.valence = 0;

        for (int i = 0; i < WINDOW_SIZE; i++) {
            state.arousal += arousal_history[i];
            state.valence += valence_history[i];
        }
        state.arousal /= WINDOW_SIZE;
        state.valence /= WINDOW_SIZE;

        // Determine quadrant
        if (state.arousal > 0.5f && state.valence > 0.5f) {
            state.quadrant = 0;  // Happy-energetic
        } else if (state.arousal <= 0.5f && state.valence > 0.5f) {
            state.quadrant = 1;  // Happy-calm
        } else if (state.arousal > 0.5f && state.valence <= 0.5f) {
            state.quadrant = 2;  // Sad-energetic
        } else {
            state.quadrant = 3;  // Sad-calm
        }

        return state;
    }

private:
    float compute_consonance(const float* chromagram) {
        // Check for consonant intervals (3rd, 5th, octave)
        float consonance = 0;

        // Major third (4 semitones)
        for (int i = 0; i < 12; i++) {
            int third = (i + 4) % 12;
            consonance += chromagram[i] * chromagram[third] * 0.3f;
        }

        // Perfect fifth (7 semitones)
        for (int i = 0; i < 12; i++) {
            int fifth = (i + 7) % 12;
            consonance += chromagram[i] * chromagram[fifth] * 0.5f;
        }

        // Octave (12 semitones = same note)
        for (int i = 0; i < 12; i++) {
            consonance += chromagram[i] * chromagram[i] * 0.2f;
        }

        return fminf(consonance, 1.0f);
    }

    bool detect_major_mode(const float* chromagram) {
        // Simplified: Check if major third is stronger than minor third
        float major_score = 0, minor_score = 0;

        for (int root = 0; root < 12; root++) {
            // Major: root + major third (4) + fifth (7)
            major_score += chromagram[root] *
                          chromagram[(root + 4) % 12] *
                          chromagram[(root + 7) % 12];

            // Minor: root + minor third (3) + fifth (7)
            minor_score += chromagram[root] *
                          chromagram[(root + 3) % 12] *
                          chromagram[(root + 7) % 12];
        }

        return major_score > minor_score;
    }
};
```

---

## Phase 2: Pattern Enhancements (Days 4-6)

### Step 2.1: Enhanced Spectrum Pattern

**File**: `/firmware/src/generated_patterns.h` (modify existing)

```cpp
void draw_spectrum_enhanced(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();

    if (!AUDIO_IS_AVAILABLE()) {
        // Existing fallback code...
        return;
    }

    // Multi-dimensional parameters
    float harmonic_weight = params.custom_param_1;     // 0=percussive, 1=harmonic
    float centroid_influence = params.custom_param_2;  // Color shift amount
    float flux_sparkle = params.custom_param_3;        // Sparkle on changes

    int half_leds = NUM_LEDS / 2;

    for (int i = 0; i < half_leds; i++) {
        float progress = (float)i / half_leds;

        // Blend harmonic and percussive components
        float harmonic_mag = interpolate(progress,
                                        AUDIO_SPECTRUM_HARMONIC, NUM_FREQS);
        float percussive_mag = interpolate(progress,
                                          AUDIO_SPECTRUM_PERCUSSIVE, NUM_FREQS);

        float magnitude = harmonic_mag * harmonic_weight +
                         percussive_mag * (1.0f - harmonic_weight);

        // Apply response curve
        magnitude = response_sqrt(magnitude);

        // Color modulation based on spectral centroid
        float color_shift = (AUDIO_SPECTRAL_CENTROID - 0.5f) *
                           centroid_influence;
        float color_position = fmodf(progress + color_shift + 1.0f, 1.0f);

        // Brightness modulation based on flux
        float brightness = magnitude;
        if (AUDIO_SPECTRAL_FLUX > 0.5f && flux_sparkle > 0) {
            // Add sparkle on rapid changes
            float sparkle_amount = (AUDIO_SPECTRAL_FLUX - 0.5f) * 2.0f;
            brightness = magnitude + sparkle_amount * flux_sparkle *
                        (1.0f - magnitude);
        }

        // Emotion-aware color selection
        uint8_t mood_palette = params.palette_id;
        if (AUDIO_MOOD_QUADRANT != 255) {  // If mood detection available
            // Override with mood-appropriate palette
            switch(AUDIO_MOOD_QUADRANT) {
                case 0: mood_palette = PALETTE_FESTIVAL; break;     // Energetic-happy
                case 1: mood_palette = PALETTE_SUNRISE; break;      // Calm-happy
                case 2: mood_palette = PALETTE_STORM; break;        // Energetic-sad
                case 3: mood_palette = PALETTE_TWILIGHT; break;     // Calm-sad
            }
        }

        CRGBF color = color_from_palette(mood_palette,
                                         color_position, brightness);

        // Apply global brightness
        color.r *= params.brightness;
        color.g *= params.brightness;
        color.b *= params.brightness;

        // Mirror from center
        int left_index = (NUM_LEDS / 2) - 1 - i;
        int right_index = (NUM_LEDS / 2) + i;

        leds[left_index] = color;
        leds[right_index] = color;
    }

    apply_background_overlay(params);
}
```

### Step 2.2: Enhanced Bloom Pattern

**File**: `/firmware/src/generated_patterns.h` (modify existing)

```cpp
void draw_bloom_enhanced(float time, const PatternParameters& params) {
    static float bloom_trail[NUM_LEDS] = {0.0f};
    static float bloom_trail_prev[NUM_LEDS] = {0.0f};
    static float particle_positions[MAX_PARTICLES];
    static float particle_velocities[MAX_PARTICLES];
    static float particle_lifetimes[MAX_PARTICLES];
    static int next_particle = 0;

    PATTERN_AUDIO_START();

    // Decay and spread existing bloom
    float spread_speed = 0.125f + 0.875f * clip_float(params.speed);
    float trail_decay = 0.92f + 0.06f * clip_float(params.softness);

    dsps_mulc_f32_inplace(bloom_trail_prev, NUM_LEDS, trail_decay);
    draw_sprite_float(bloom_trail, bloom_trail_prev,
                     NUM_LEDS, NUM_LEDS, spread_speed, 1.0f);

    if (AUDIO_IS_AVAILABLE()) {
        // Multi-point injection based on frequency content

        // Bass → Center (traditional bloom)
        float bass_energy = AUDIO_BASS() * AUDIO_KICK();
        bloom_trail[NUM_LEDS/2] = fmaxf(bloom_trail[NUM_LEDS/2],
                                        bass_energy);

        // Mids → Quarter points (harmonic spread)
        float mid_energy = AUDIO_MIDS() * AUDIO_HARMONIC_RATIO;
        bloom_trail[NUM_LEDS/4] = fmaxf(bloom_trail[NUM_LEDS/4],
                                        mid_energy * 0.7f);
        bloom_trail[3*NUM_LEDS/4] = fmaxf(bloom_trail[3*NUM_LEDS/4],
                                          mid_energy * 0.7f);

        // Highs → Create particles at edges
        if (AUDIO_ONSET_DETECTED && AUDIO_ONSET_STRENGTH > 0.3f) {
            // Spawn particle at onset location
            float position = AUDIO_ONSET_BIN / (float)NUM_FREQS;
            int spawn_index = position * NUM_LEDS;

            particle_positions[next_particle] = spawn_index;
            particle_velocities[next_particle] =
                (spawn_index < NUM_LEDS/2 ? 1.0f : -1.0f) *
                AUDIO_ONSET_STRENGTH * 3.0f;
            particle_lifetimes[next_particle] = 0.5f +
                                               AUDIO_ONSET_STRENGTH;

            next_particle = (next_particle + 1) % MAX_PARTICLES;
        }
    }

    // Update and render particles
    float dt = 1.0f / 120.0f;  // Assuming 120 FPS
    for (int p = 0; p < MAX_PARTICLES; p++) {
        if (particle_lifetimes[p] > 0) {
            // Update physics
            particle_positions[p] += particle_velocities[p];
            particle_velocities[p] *= 0.95f;  // Drag
            particle_lifetimes[p] -= dt;

            // Render if still in bounds
            int pos = (int)particle_positions[p];
            if (pos >= 0 && pos < NUM_LEDS) {
                float intensity = particle_lifetimes[p] * 2.0f;
                bloom_trail[pos] = fmaxf(bloom_trail[pos], intensity);
            }
        }
    }

    // Render bloom with mood-aware colors
    int half_leds = NUM_LEDS / 2;
    for (int i = 0; i < half_leds; i++) {
        float brightness = clip_float(bloom_trail[i]);

        // Select palette based on mood
        uint8_t palette = params.palette_id;
        if (AUDIO_VALENCE < 0.3f) {
            // Sad music → cooler colors
            palette = PALETTE_OCEAN;
        } else if (AUDIO_VALENCE > 0.7f && AUDIO_AROUSAL > 0.6f) {
            // Happy energetic → warm vibrant
            palette = PALETTE_FESTIVAL;
        }

        CRGBF color = color_from_palette(palette,
                                         (float)i / half_leds,
                                         brightness);

        color.r *= params.brightness;
        color.g *= params.brightness;
        color.b *= params.brightness;

        int left_index = (half_leds - 1) - i;
        int right_index = half_leds + i;
        leds[left_index] = color;
        leds[right_index] = color;
    }

    // Copy for next frame
    dsps_memcpy_accel(bloom_trail_prev, bloom_trail,
                     sizeof(float) * NUM_LEDS);

    apply_background_overlay(params);
}
```

### Step 2.3: Beat-Synchronized Pulse Pattern

**File**: `/firmware/src/generated_patterns.h` (modify existing)

```cpp
void draw_pulse_enhanced(float time, const PatternParameters& params) {
    static PulseWave waves[MAX_CONCURRENT_WAVES];
    static float last_beat_phase = 0;

    PATTERN_AUDIO_START();

    // Clear LED buffer
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGBF(0, 0, 0);
    }

    if (AUDIO_IS_AVAILABLE() && AUDIO_BEAT_CONFIDENCE > 0.3f) {
        // Detect beat transition
        if (AUDIO_BEAT_PHASE < last_beat_phase) {
            // New beat detected, spawn synchronized wave
            for (int w = 0; w < MAX_CONCURRENT_WAVES; w++) {
                if (!waves[w].alive) {
                    waves[w].alive = true;
                    waves[w].position = 0;
                    waves[w].velocity = 1.0f + AUDIO_AROUSAL;  // Faster when energetic
                    waves[w].amplitude = AUDIO_BEAT_CONFIDENCE;
                    waves[w].frequency = 2.0f + AUDIO_SPECTRAL_CENTROID * 3.0f;
                    waves[w].color_offset = AUDIO_BEAT_COUNT * 0.1f;  // Evolving color
                    break;
                }
            }
        }
        last_beat_phase = AUDIO_BEAT_PHASE;

        // Update and render waves
        for (int w = 0; w < MAX_CONCURRENT_WAVES; w++) {
            if (waves[w].alive) {
                // Update position
                waves[w].position += waves[w].velocity;
                waves[w].amplitude *= 0.98f;  // Decay

                if (waves[w].position > NUM_LEDS/2 ||
                    waves[w].amplitude < 0.01f) {
                    waves[w].alive = false;
                    continue;
                }

                // Render wave with beat phase modulation
                float phase_mod = sinf(AUDIO_BEAT_PHASE * M_PI * 2.0f);

                for (int i = 0; i < NUM_LEDS/2; i++) {
                    float distance = abs(i - waves[w].position);
                    float intensity = waves[w].amplitude *
                                    expf(-distance * distance /
                                         (20.0f * waves[w].frequency));

                    // Modulate with beat phase for pulsing effect
                    intensity *= 0.7f + 0.3f * phase_mod;

                    if (intensity > 0.01f) {
                        // Color based on mood and wave properties
                        float hue = fmodf(waves[w].color_offset +
                                         AUDIO_VALENCE * 0.5f, 1.0f);

                        CRGBF color = hsv(hue,
                                         0.7f + AUDIO_AROUSAL * 0.3f,  // More saturated when energetic
                                         intensity);

                        // Add to existing (additive blending)
                        int left_idx = NUM_LEDS/2 - 1 - i;
                        int right_idx = NUM_LEDS/2 + i;

                        leds[left_idx].r = fminf(1.0f, leds[left_idx].r + color.r);
                        leds[left_idx].g = fminf(1.0f, leds[left_idx].g + color.g);
                        leds[left_idx].b = fminf(1.0f, leds[left_idx].b + color.b);

                        leds[right_idx] = leds[left_idx];
                    }
                }
            }
        }

        // Apply global brightness with beat sync
        float beat_brightness = 0.8f + 0.2f * sinf(AUDIO_BEAT_PHASE * M_PI);
        for (int i = 0; i < NUM_LEDS; i++) {
            leds[i].r *= params.brightness * beat_brightness;
            leds[i].g *= params.brightness * beat_brightness;
            leds[i].b *= params.brightness * beat_brightness;
        }
    }

    apply_background_overlay(params);
}
```

---

## Phase 3: New Multi-Dimensional Patterns (Days 7-9)

### Step 3.1: Particle Storm Pattern (New)

**File**: `/firmware/src/generated_patterns.h` (add new)

```cpp
void draw_particle_storm(float time, const PatternParameters& params) {
    static struct Particle {
        float position;
        float velocity;
        float lifetime;
        float hue;
        float size;
        bool alive;
    } particles[MAX_PARTICLES];

    static float background_energy[NUM_LEDS] = {0};

    PATTERN_AUDIO_START();

    // Decay background energy
    for (int i = 0; i < NUM_LEDS; i++) {
        background_energy[i] *= 0.95f;
    }

    if (AUDIO_IS_AVAILABLE()) {
        // Spawn particles on onsets
        if (AUDIO_ONSET_DETECTED) {
            for (int p = 0; p < MAX_PARTICLES; p++) {
                if (!particles[p].alive) {
                    particles[p].alive = true;
                    particles[p].position = AUDIO_ONSET_BIN /
                                          (float)NUM_FREQS * NUM_LEDS;
                    particles[p].velocity = (randf() - 0.5f) * 5.0f *
                                          AUDIO_ONSET_STRENGTH;
                    particles[p].lifetime = 0.5f + AUDIO_ONSET_STRENGTH;

                    // Color from chromagram
                    int dominant_note = 0;
                    float max_chroma = 0;
                    for (int c = 0; c < 12; c++) {
                        if (AUDIO_CHROMAGRAM[c] > max_chroma) {
                            max_chroma = AUDIO_CHROMAGRAM[c];
                            dominant_note = c;
                        }
                    }
                    particles[p].hue = dominant_note / 12.0f;
                    particles[p].size = 1.0f + AUDIO_ONSET_STRENGTH * 3.0f;
                    break;
                }
            }
        }

        // Background energy injection from spectrum
        for (int i = 0; i < NUM_LEDS; i++) {
            float freq_position = (float)i / NUM_LEDS;
            float energy = interpolate(freq_position,
                                      AUDIO_SPECTRUM_HARMONIC, NUM_FREQS);
            background_energy[i] = fmaxf(background_energy[i],
                                        energy * 0.3f);
        }
    }

    // Update particles
    float dt = 1.0f / 120.0f;
    for (int p = 0; p < MAX_PARTICLES; p++) {
        if (particles[p].alive) {
            // Physics update
            particles[p].position += particles[p].velocity * dt * 60.0f;
            particles[p].velocity *= 0.92f;  // Drag
            particles[p].lifetime -= dt;

            // Add slight gravity towards center
            float center_force = (NUM_LEDS/2 - particles[p].position) * 0.02f;
            particles[p].velocity += center_force;

            // Kill if dead or out of bounds
            if (particles[p].lifetime <= 0 ||
                particles[p].position < 0 ||
                particles[p].position >= NUM_LEDS) {
                particles[p].alive = false;
            }
        }
    }

    // Clear LEDs
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGBF(0, 0, 0);
    }

    // Render background energy
    for (int i = 0; i < NUM_LEDS; i++) {
        if (background_energy[i] > 0.01f) {
            CRGBF bg_color = color_from_palette(params.palette_id,
                                               (float)i / NUM_LEDS,
                                               background_energy[i] * 0.5f);
            leds[i] = bg_color;
        }
    }

    // Render particles
    for (int p = 0; p < MAX_PARTICLES; p++) {
        if (particles[p].alive) {
            float intensity = particles[p].lifetime * 2.0f;

            // Render with size
            int center = (int)particles[p].position;
            int radius = (int)particles[p].size;

            for (int offset = -radius; offset <= radius; offset++) {
                int pos = center + offset;
                if (pos >= 0 && pos < NUM_LEDS) {
                    float distance = abs(offset) / (float)radius;
                    float falloff = 1.0f - distance;

                    CRGBF particle_color = hsv(particles[p].hue,
                                              0.8f + AUDIO_AROUSAL * 0.2f,
                                              intensity * falloff);

                    // Additive blending
                    leds[pos].r = fminf(1.0f, leds[pos].r + particle_color.r);
                    leds[pos].g = fminf(1.0f, leds[pos].g + particle_color.g);
                    leds[pos].b = fminf(1.0f, leds[pos].b + particle_color.b);
                }
            }
        }
    }

    // Apply brightness
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i].r *= params.brightness;
        leds[i].g *= params.brightness;
        leds[i].b *= params.brightness;
    }

    // Center mirror for symmetry
    apply_mirror_mode(leds, true);
    apply_background_overlay(params);
}
```

### Step 3.2: Harmonic Flow Pattern (New)

**File**: `/firmware/src/generated_patterns.h` (add new)

```cpp
void draw_harmonic_flow(float time, const PatternParameters& params) {
    static float flow_buffer[NUM_LEDS] = {0};
    static float phase_accumulator[12] = {0};  // For each chromagram bin

    PATTERN_AUDIO_START();

    if (!AUDIO_IS_AVAILABLE()) {
        // Procedural flow when no audio
        for (int i = 0; i < NUM_LEDS; i++) {
            float position = (float)i / NUM_LEDS;
            float wave = sinf((position * 4.0f + time * params.speed) * M_PI * 2.0f);
            wave = wave * 0.5f + 0.5f;

            leds[i] = color_from_palette(params.palette_id, position,
                                        wave * params.brightness * 0.3f);
        }
        return;
    }

    // Update phase accumulators based on chromagram
    for (int c = 0; c < 12; c++) {
        float energy = AUDIO_CHROMAGRAM[c];
        if (energy > 0.1f) {
            // Each active note advances its phase
            phase_accumulator[c] += energy * 0.1f * params.speed;
            phase_accumulator[c] = fmodf(phase_accumulator[c], 1.0f);
        }
    }

    // Clear flow buffer
    for (int i = 0; i < NUM_LEDS; i++) {
        flow_buffer[i] = 0;
    }

    // Render harmonic waves
    for (int c = 0; c < 12; c++) {
        float energy = AUDIO_CHROMAGRAM[c];
        if (energy > 0.05f) {
            // Each note creates a wave
            float wavelength = NUM_LEDS / (2.0f + c * 0.5f);  // Higher notes = shorter waves
            float phase = phase_accumulator[c] * M_PI * 2.0f;

            for (int i = 0; i < NUM_LEDS; i++) {
                float position = (float)i / wavelength;
                float wave = sinf(position * M_PI * 2.0f + phase);
                wave = wave * 0.5f + 0.5f;  // Normalize to 0-1

                // Accumulate harmonics
                flow_buffer[i] += wave * energy * AUDIO_HARMONIC_RATIO;
            }
        }
    }

    // Add percussive accents
    if (AUDIO_ONSET_DETECTED && AUDIO_HARMONIC_RATIO < 0.5f) {
        // Percussive onset creates ripple
        int onset_pos = AUDIO_ONSET_BIN * NUM_LEDS / NUM_FREQS;
        for (int i = 0; i < NUM_LEDS; i++) {
            float distance = abs(i - onset_pos) / (float)NUM_LEDS;
            float ripple = expf(-distance * 10.0f) * AUDIO_ONSET_STRENGTH;
            flow_buffer[i] += ripple;
        }
    }

    // Normalize and render
    float max_val = 0;
    for (int i = 0; i < NUM_LEDS; i++) {
        if (flow_buffer[i] > max_val) max_val = flow_buffer[i];
    }

    if (max_val > 0) {
        for (int i = 0; i < NUM_LEDS; i++) {
            flow_buffer[i] /= max_val;

            // Color based on consonance
            float color_shift = AUDIO_CONSONANCE * 0.3f;

            CRGBF color = color_from_palette(params.palette_id,
                                            fmodf((float)i / NUM_LEDS + color_shift, 1.0f),
                                            flow_buffer[i]);

            // Mood-based saturation
            float saturation = 0.5f + AUDIO_VALENCE * 0.5f;
            color = force_saturation(color, saturation);

            leds[i] = color;
            leds[i].r *= params.brightness;
            leds[i].g *= params.brightness;
            leds[i].b *= params.brightness;
        }
    }

    apply_mirror_mode(leds, true);
    apply_background_overlay(params);
}
```

---

## Phase 4: Testing & Validation (Days 10-12)

### Step 4.1: Performance Profiling

```cpp
// Add to main loop
struct PatternMetrics {
    uint32_t render_time_us;
    uint32_t max_render_time_us;
    uint32_t frame_count;
    float cpu_usage_percent;
};

PatternMetrics metrics[NUM_PATTERNS];

void profile_pattern(int pattern_id) {
    uint32_t start = esp_timer_get_time();

    // Run pattern
    pattern_functions[pattern_id](current_time, params);

    uint32_t duration = esp_timer_get_time() - start;

    metrics[pattern_id].render_time_us = duration;
    if (duration > metrics[pattern_id].max_render_time_us) {
        metrics[pattern_id].max_render_time_us = duration;
    }
    metrics[pattern_id].frame_count++;

    // Target: 8333 us per frame at 120 FPS
    metrics[pattern_id].cpu_usage_percent = (duration / 8333.0f) * 100.0f;
}
```

### Step 4.2: Test Cases

```cpp
void test_audio_features() {
    // Test 1: Silence handling
    AudioDataSnapshot silent_audio = {0};
    assert(compute_spectral_centroid(silent_audio.spectrum) == 0.5f);
    assert(compute_arousal(silent_audio) == 0.0f);

    // Test 2: Pure tone
    AudioDataSnapshot pure_tone = {0};
    pure_tone.spectrum[32] = 1.0f;  // Single frequency
    assert(compute_harmonic_ratio(pure_tone) > 0.9f);

    // Test 3: White noise
    AudioDataSnapshot white_noise;
    for (int i = 0; i < NUM_FREQS; i++) {
        white_noise.spectrum[i] = 0.5f;
    }
    assert(compute_harmonic_ratio(white_noise) < 0.3f);

    // Test 4: Beat detection
    test_beat_tracking_with_metronome();

    ESP_LOGI(TAG, "All audio feature tests passed");
}
```

### Step 4.3: Validation Metrics

**Performance Requirements**:
- Frame rate: ≥ 120 FPS
- Pattern render time: < 500 µs average, < 1000 µs peak
- Audio feature extraction: < 2000 µs per frame
- Total CPU usage: < 30%
- Memory usage: < 32KB additional

**Quality Metrics**:
- Visual smoothness: No visible stuttering
- Audio responsiveness: < 50ms latency
- Color accuracy: Mood detection accuracy > 70%
- Beat sync accuracy: > 90% correct beat detection

---

## Phase 5: Integration & Deployment (Days 13-15)

### Step 5.1: Web UI Integration

```typescript
// webapp/src/lib/patterns.ts
export const ENHANCED_PATTERNS = [
    {
        id: 'spectrum_enhanced',
        name: 'Spectrum HD',
        category: 'audio-reactive',
        params: {
            harmonic_weight: { min: 0, max: 1, default: 0.5 },
            centroid_influence: { min: 0, max: 1, default: 0.3 },
            flux_sparkle: { min: 0, max: 1, default: 0.5 }
        }
    },
    {
        id: 'particle_storm',
        name: 'Particle Storm',
        category: 'multi-dimensional',
        params: {
            particle_density: { min: 0, max: 1, default: 0.5 },
            physics_strength: { min: 0, max: 1, default: 0.5 }
        }
    },
    // ... more patterns
];
```

### Step 5.2: Rollout Plan

1. **Alpha Release** (Internal testing)
   - Deploy to test devices
   - Run 24-hour stability test
   - Collect performance metrics

2. **Beta Release** (Limited users)
   - A/B test with original patterns
   - Collect user feedback
   - Fine-tune parameters

3. **Production Release**
   - Feature flag for gradual rollout
   - Monitor telemetry
   - Gather user reviews

---

## Conclusion

This implementation plan provides concrete steps to transform K1.node1's patterns from simple 1D reactive displays into rich multi-dimensional visualizations. The enhancements leverage advanced audio analysis, temporal dynamics, and emotional awareness to create engaging light shows that truly respond to the full complexity of music.

Total estimated implementation time: 15 working days
Expected improvement: 3-5x perceptual richness
Risk level: Low (gradual rollout with fallbacks)
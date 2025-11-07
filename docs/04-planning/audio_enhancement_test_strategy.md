# Audio Enhancement Test Strategy & Benchmarking Framework

**Title**: Comprehensive Testing and Benchmarking for Audio Visualization Enhancement
**Owner**: Test Engineering Team
**Date**: 2025-11-07
**Status**: Proposed
**Scope**: Firmware testing, audio validation, performance benchmarking
**Related**:
  - `/docs/04-planning/audio_visualization_enhancement_proposal.md`
  - `/docs/09-reports/audio_feature_enhancement_roadmap.md`
  - `/firmware/test/README.md`
  - `/firmware/test/test_utils/test_helpers.h`
**Tags**: testing, audio, benchmarking, validation, quality-assurance

---

## Executive Summary

This document defines a comprehensive test strategy and benchmarking framework for the audio visualization enhancement project. It establishes unit testing patterns, performance baselines, real-world validation methodologies, and automated CI/CD integration for all five enhancement phases.

**Key Objectives**:
1. **Zero Regressions**: Detect and prevent performance/quality degradation
2. **Quantifiable Progress**: Measure improvement metrics at each phase
3. **Real-World Validation**: Ensure enhancement quality across diverse music
4. **Automated Quality Gates**: CI/CD integration for continuous validation

---

## 1. Unit Testing Framework

### 1.1 Test Organization Structure

```
firmware/test/
├── test_audio_features/           # Audio feature extraction tests
│   ├── test_spectral_centroid.cpp
│   ├── test_spectral_flux.cpp
│   ├── test_onset_detection.cpp
│   ├── test_harmonic_percussive.cpp
│   └── test_arousal_valence.cpp
├── test_audio_tempo/              # Tempo/beat detection tests
│   ├── test_beat_phase_accuracy.cpp
│   ├── test_bpm_detection.cpp
│   ├── test_phase_wrapping.cpp
│   └── test_beat_confidence.cpp
├── test_audio_integration/        # End-to-end audio pipeline tests
│   ├── test_audio_pipeline.cpp
│   ├── test_pattern_audio_sync.cpp
│   └── test_audio_latency.cpp
├── test_audio_performance/        # Performance benchmarks
│   ├── test_audio_cpu_usage.cpp
│   ├── test_audio_memory.cpp
│   └── test_audio_throughput.cpp
└── test_data/                     # Synthetic test data generators
    ├── metronome_data.h
    ├── frequency_sweep_data.h
    ├── genre_test_signals.h
    └── noise_patterns.h
```

### 1.2 Synthetic Test Data Generation

#### 1.2.1 Signal Generators (test_data/synthetic_signals.h)

```cpp
#pragma once
#include <cmath>
#include <cstring>

class SyntheticSignals {
public:
    // Pure sine wave at specified frequency
    static void generate_sine(float* buffer, int length,
                             float freq_hz, float sample_rate,
                             float amplitude = 1.0f) {
        for (int i = 0; i < length; i++) {
            float t = (float)i / sample_rate;
            buffer[i] = amplitude * sinf(2.0f * M_PI * freq_hz * t);
        }
    }

    // White noise (uniform random)
    static void generate_white_noise(float* buffer, int length,
                                     float amplitude = 1.0f) {
        for (int i = 0; i < length; i++) {
            buffer[i] = amplitude * ((random(10000) / 5000.0f) - 1.0f);
        }
    }

    // Metronome clicks at specified BPM
    static void generate_metronome(float* buffer, int length,
                                   float bpm, float sample_rate) {
        memset(buffer, 0, length * sizeof(float));
        float samples_per_beat = (60.0f / bpm) * sample_rate;

        for (int beat = 0; beat * samples_per_beat < length; beat++) {
            int click_start = (int)(beat * samples_per_beat);
            int click_length = (int)(sample_rate * 0.01f); // 10ms click

            for (int i = 0; i < click_length && (click_start + i) < length; i++) {
                float envelope = expf(-10.0f * i / click_length);
                buffer[click_start + i] = envelope * sinf(2.0f * M_PI * 1000.0f * i / sample_rate);
            }
        }
    }

    // Frequency sweep (chirp)
    static void generate_chirp(float* buffer, int length,
                              float start_freq, float end_freq,
                              float sample_rate) {
        for (int i = 0; i < length; i++) {
            float t = (float)i / sample_rate;
            float progress = (float)i / length;
            float freq = start_freq + (end_freq - start_freq) * progress;
            buffer[i] = sinf(2.0f * M_PI * freq * t);
        }
    }

    // Harmonic tone (fundamental + overtones)
    static void generate_harmonic(float* buffer, int length,
                                  float fundamental_hz, int num_harmonics,
                                  float sample_rate) {
        memset(buffer, 0, length * sizeof(float));

        for (int h = 1; h <= num_harmonics; h++) {
            float harmonic_freq = fundamental_hz * h;
            float amplitude = 1.0f / h;  // 1/h amplitude decay

            for (int i = 0; i < length; i++) {
                float t = (float)i / sample_rate;
                buffer[i] += amplitude * sinf(2.0f * M_PI * harmonic_freq * t);
            }
        }

        // Normalize
        float max_val = 0.0f;
        for (int i = 0; i < length; i++) {
            max_val = fmaxf(max_val, fabsf(buffer[i]));
        }
        for (int i = 0; i < length; i++) {
            buffer[i] /= max_val;
        }
    }

    // Percussive burst (sharp attack, exponential decay)
    static void generate_percussive(float* buffer, int length,
                                    float freq_hz, float decay_rate,
                                    float sample_rate) {
        for (int i = 0; i < length; i++) {
            float t = (float)i / sample_rate;
            float envelope = expf(-decay_rate * t);
            buffer[i] = envelope * sinf(2.0f * M_PI * freq_hz * t);
        }
    }

    // Silence (for baseline tests)
    static void generate_silence(float* buffer, int length) {
        memset(buffer, 0, length * sizeof(float));
    }

    // Clipping test signal (distortion validation)
    static void generate_clipped_sine(float* buffer, int length,
                                      float freq_hz, float sample_rate,
                                      float clip_threshold = 0.7f) {
        generate_sine(buffer, length, freq_hz, sample_rate, 1.0f);
        for (int i = 0; i < length; i++) {
            if (buffer[i] > clip_threshold) buffer[i] = clip_threshold;
            if (buffer[i] < -clip_threshold) buffer[i] = -clip_threshold;
        }
    }

    // Rapid transients (onset detection validation)
    static void generate_rapid_transients(float* buffer, int length,
                                          float rate_hz, float sample_rate) {
        memset(buffer, 0, length * sizeof(float));
        float samples_per_transient = sample_rate / rate_hz;

        for (int t = 0; t * samples_per_transient < length; t++) {
            int start = (int)(t * samples_per_transient);
            int burst_length = (int)(sample_rate * 0.005f); // 5ms burst

            for (int i = 0; i < burst_length && (start + i) < length; i++) {
                buffer[start + i] = expf(-20.0f * i / burst_length);
            }
        }
    }
};
```

#### 1.2.2 Music Genre Test Signals (test_data/genre_patterns.h)

```cpp
#pragma once

class GenrePatterns {
public:
    // Electronic music: steady 4/4 kick pattern
    static void generate_electronic_beat(float* buffer, int length,
                                         float bpm, float sample_rate) {
        float samples_per_beat = (60.0f / bpm) * sample_rate;
        memset(buffer, 0, length * sizeof(float));

        for (int beat = 0; beat * samples_per_beat < length; beat++) {
            // Kick on every beat
            int kick_start = (int)(beat * samples_per_beat);
            for (int i = 0; i < 100 && (kick_start + i) < length; i++) {
                buffer[kick_start + i] += expf(-0.05f * i) * sinf(2.0f * M_PI * 55.0f * i / sample_rate);
            }

            // Hi-hat on off-beats
            if (beat % 2 == 1) {
                int hat_start = kick_start + (int)(samples_per_beat * 0.5f);
                for (int i = 0; i < 50 && (hat_start + i) < length; i++) {
                    buffer[hat_start + i] += 0.3f * expf(-0.1f * i) *
                        (SyntheticSignals::generate_white_noise() * 0.5f + 0.5f);
                }
            }
        }
    }

    // Rock music: emphasis on 2 and 4 (backbeat)
    static void generate_rock_pattern(float* buffer, int length,
                                      float bpm, float sample_rate) {
        float samples_per_beat = (60.0f / bpm) * sample_rate;
        memset(buffer, 0, length * sizeof(float));

        for (int beat = 0; beat * samples_per_beat < length; beat++) {
            int start = (int)(beat * samples_per_beat);

            // Snare on beats 2 and 4
            if (beat % 4 == 1 || beat % 4 == 3) {
                for (int i = 0; i < 200 && (start + i) < length; i++) {
                    float noise = ((random(1000) / 500.0f) - 1.0f);
                    buffer[start + i] += 0.8f * expf(-0.03f * i) * noise;
                }
            }
            // Kick on beats 1 and 3
            else {
                for (int i = 0; i < 150 && (start + i) < length; i++) {
                    buffer[start + i] += expf(-0.04f * i) * sinf(2.0f * M_PI * 60.0f * i / sample_rate);
                }
            }
        }
    }

    // Classical music: sustained harmonic tones
    static void generate_classical_pattern(float* buffer, int length,
                                           float sample_rate) {
        SyntheticSignals::generate_harmonic(buffer, length, 220.0f, 8, sample_rate);

        // Add slow amplitude modulation (vibrato)
        for (int i = 0; i < length; i++) {
            float t = (float)i / sample_rate;
            float vibrato = 1.0f + 0.05f * sinf(2.0f * M_PI * 5.0f * t);
            buffer[i] *= vibrato;
        }
    }

    // Ambient music: slowly evolving textures
    static void generate_ambient_pattern(float* buffer, int length,
                                        float sample_rate) {
        memset(buffer, 0, length * sizeof(float));

        // Multiple slow-moving sine waves
        float freqs[] = {110.0f, 165.0f, 220.0f, 330.0f};
        float phases[] = {0.0f, 0.25f, 0.5f, 0.75f};

        for (int f = 0; f < 4; f++) {
            for (int i = 0; i < length; i++) {
                float t = (float)i / sample_rate;
                float mod = 0.5f + 0.5f * sinf(2.0f * M_PI * 0.1f * (t + phases[f]));
                buffer[i] += 0.25f * mod * sinf(2.0f * M_PI * freqs[f] * t);
            }
        }
    }
};
```

### 1.3 Test Case Templates

#### 1.3.1 Spectral Centroid Test (test_audio_features/test_spectral_centroid.cpp)

```cpp
#include <unity.h>
#include "test_utils/test_helpers.h"
#include "test_data/synthetic_signals.h"
#include "audio/spectral_features.h"  // New module to be implemented

// Test: Low frequency signal should have low centroid
void test_spectral_centroid_low_frequency() {
    const int length = 1024;
    float signal[length];

    // Generate 100 Hz sine wave
    SyntheticSignals::generate_sine(signal, length, 100.0f, 16000.0f);

    // Calculate spectral centroid
    float centroid = calculate_spectral_centroid(signal, length, 16000.0f);

    // Expect centroid near 100 Hz (within 10% tolerance)
    TEST_ASSERT_IN_RANGE(centroid, 90.0f, 110.0f);
}

// Test: High frequency signal should have high centroid
void test_spectral_centroid_high_frequency() {
    const int length = 1024;
    float signal[length];

    // Generate 4000 Hz sine wave
    SyntheticSignals::generate_sine(signal, length, 4000.0f, 16000.0f);

    float centroid = calculate_spectral_centroid(signal, length, 16000.0f);

    // Expect centroid near 4000 Hz
    TEST_ASSERT_IN_RANGE(centroid, 3800.0f, 4200.0f);
}

// Test: Harmonic tone centroid should reflect harmonic distribution
void test_spectral_centroid_harmonic() {
    const int length = 1024;
    float signal[length];

    // Generate harmonic tone at 220 Hz with 5 harmonics
    SyntheticSignals::generate_harmonic(signal, length, 220.0f, 5, 16000.0f);

    float centroid = calculate_spectral_centroid(signal, length, 16000.0f);

    // With 1/h amplitude decay, centroid should be around 2nd-3rd harmonic (440-660 Hz)
    TEST_ASSERT_IN_RANGE(centroid, 300.0f, 800.0f);
}

// Test: Silence should yield zero or very low centroid
void test_spectral_centroid_silence() {
    const int length = 1024;
    float signal[length];

    SyntheticSignals::generate_silence(signal, length);

    float centroid = calculate_spectral_centroid(signal, length, 16000.0f);

    // Should be near zero or handle gracefully
    TEST_ASSERT_LESS_THAN(50.0f, centroid);
}

// Entry point for PlatformIO test runner
void setUp(void) {}
void tearDown(void) {}

void setup() {
    delay(2000);  // Wait for serial
    UNITY_BEGIN();

    RUN_TEST(test_spectral_centroid_low_frequency);
    RUN_TEST(test_spectral_centroid_high_frequency);
    RUN_TEST(test_spectral_centroid_harmonic);
    RUN_TEST(test_spectral_centroid_silence);

    UNITY_END();
}

void loop() {}
```

#### 1.3.2 Onset Detection Test (test_audio_features/test_onset_detection.cpp)

```cpp
#include <unity.h>
#include "test_utils/test_helpers.h"
#include "test_data/synthetic_signals.h"
#include "audio/onset_detection.h"  // New module to be implemented

// Test: Detect onset in percussive burst
void test_onset_detection_percussive() {
    const int length = 2048;
    float signal[length];

    // First half silence, second half percussive burst
    SyntheticSignals::generate_silence(signal, length / 2);
    SyntheticSignals::generate_percussive(signal + length/2, length/2,
                                          200.0f, 10.0f, 16000.0f);

    // Detect onsets
    OnsetDetector detector(16000.0f);
    bool onset_detected = false;
    int onset_position = -1;

    for (int i = 0; i < length; i += 256) {
        if (detector.process_frame(signal + i, 256)) {
            onset_detected = true;
            onset_position = i;
            break;
        }
    }

    TEST_ASSERT_TRUE(onset_detected);
    TEST_ASSERT_IN_RANGE(onset_position, length/2 - 256, length/2 + 256);
}

// Test: No onset in sustained tone
void test_onset_detection_sustained_tone() {
    const int length = 2048;
    float signal[length];

    SyntheticSignals::generate_sine(signal, length, 440.0f, 16000.0f);

    OnsetDetector detector(16000.0f);
    int onset_count = 0;

    for (int i = 0; i < length; i += 256) {
        if (detector.process_frame(signal + i, 256)) {
            onset_count++;
        }
    }

    // May detect one onset at start, but no more
    TEST_ASSERT_LESS_OR_EQUAL(1, onset_count);
}

// Test: Rapid transients detection
void test_onset_detection_rapid_transients() {
    const int length = 8000;  // 0.5 seconds at 16kHz
    float signal[length];

    // Generate 10 transients per second
    SyntheticSignals::generate_rapid_transients(signal, length, 10.0f, 16000.0f);

    OnsetDetector detector(16000.0f);
    int onset_count = 0;

    for (int i = 0; i < length; i += 256) {
        if (detector.process_frame(signal + i, 256)) {
            onset_count++;
        }
    }

    // Should detect approximately 5 onsets (10 Hz * 0.5s)
    TEST_ASSERT_IN_RANGE(onset_count, 3, 7);
}

void setUp(void) {}
void tearDown(void) {}

void setup() {
    delay(2000);
    UNITY_BEGIN();

    RUN_TEST(test_onset_detection_percussive);
    RUN_TEST(test_onset_detection_sustained_tone);
    RUN_TEST(test_onset_detection_rapid_transients);

    UNITY_END();
}

void loop() {}
```

#### 1.3.3 Beat Phase Accuracy Test (test_audio_tempo/test_beat_phase_accuracy.cpp)

```cpp
#include <unity.h>
#include "test_utils/test_helpers.h"
#include "test_data/synthetic_signals.h"
#include "audio/tempo.h"

// Test: Beat phase tracking with 60 BPM metronome
void test_beat_phase_60bpm() {
    const int length = 16000 * 4;  // 4 seconds
    float signal[length];

    SyntheticSignals::generate_metronome(signal, length, 60.0f, 16000.0f);

    // Initialize tempo detection
    init_tempo_goertzel_constants();

    // Process signal
    for (int i = 0; i < length; i += 256) {
        // Simulate audio processing (simplified)
        memcpy(sample_history, signal + i, 256 * sizeof(float));
        update_tempo();
    }

    // Find 60 BPM bin
    uint16_t bpm_60_bin = find_closest_tempo_bin(60.0f);

    // Check beat phase is within expected range (-π to π)
    float phase = tempi[bpm_60_bin].phase;
    TEST_ASSERT_IN_RANGE(phase, -M_PI, M_PI);

    // Check beat confidence is reasonable
    TEST_ASSERT_GREATER_THAN(0.3f, tempo_confidence);
}

// Test: BPM detection accuracy across range
void test_bpm_detection_range() {
    float test_bpms[] = {60.0f, 90.0f, 120.0f, 140.0f, 180.0f};

    for (int t = 0; t < 5; t++) {
        const int length = 16000 * 4;
        float signal[length];

        SyntheticSignals::generate_metronome(signal, length, test_bpms[t], 16000.0f);

        init_tempo_goertzel_constants();

        for (int i = 0; i < length; i += 256) {
            memcpy(sample_history, signal + i, 256 * sizeof(float));
            update_tempo();
        }

        // Find detected BPM (bin with highest magnitude)
        int max_bin = 0;
        float max_mag = 0.0f;
        for (int i = 0; i < NUM_TEMPI; i++) {
            if (tempi[i].magnitude > max_mag) {
                max_mag = tempi[i].magnitude;
                max_bin = i;
            }
        }

        float detected_bpm = tempi_bpm_values_hz[max_bin] * 60.0f;

        // Allow 5% tolerance
        float tolerance = test_bpms[t] * 0.05f;
        TEST_ASSERT_IN_RANGE(detected_bpm,
                            test_bpms[t] - tolerance,
                            test_bpms[t] + tolerance);
    }
}

// Test: Phase wrapping continuity (0.0-1.0 range)
void test_phase_wrapping() {
    // Test phase values near wrapping boundary
    float test_phases[] = {-3.0f, -M_PI - 0.1f, -M_PI, 0.0f, M_PI, M_PI + 0.1f, 3.5f};

    for (int i = 0; i < 7; i++) {
        float wrapped = wrap_phase(test_phases[i]);

        // After wrapping, phase should be in range [-π, π]
        TEST_ASSERT_IN_RANGE(wrapped, -M_PI, M_PI);
    }
}

// Test: Beat confidence on silence vs strong beat
void test_beat_confidence_levels() {
    const int length = 16000 * 2;
    float silence[length];
    float metronome[length];

    SyntheticSignals::generate_silence(silence, length);
    SyntheticSignals::generate_metronome(metronome, length, 120.0f, 16000.0f);

    // Test silence
    init_tempo_goertzel_constants();
    for (int i = 0; i < length; i += 256) {
        memcpy(sample_history, silence + i, 256 * sizeof(float));
        update_tempo();
    }
    float silence_confidence = tempo_confidence;

    // Test metronome
    init_tempo_goertzel_constants();
    for (int i = 0; i < length; i += 256) {
        memcpy(sample_history, metronome + i, 256 * sizeof(float));
        update_tempo();
    }
    float metronome_confidence = tempo_confidence;

    // Metronome should have much higher confidence than silence
    TEST_ASSERT_LESS_THAN(0.2f, silence_confidence);
    TEST_ASSERT_GREATER_THAN(0.5f, metronome_confidence);
    TEST_ASSERT_GREATER_THAN(silence_confidence + 0.3f, metronome_confidence);
}

void setUp(void) {}
void tearDown(void) {}

void setup() {
    delay(2000);
    UNITY_BEGIN();

    RUN_TEST(test_beat_phase_60bpm);
    RUN_TEST(test_bpm_detection_range);
    RUN_TEST(test_phase_wrapping);
    RUN_TEST(test_beat_confidence_levels);

    UNITY_END();
}

void loop() {}
```

---

## 2. Performance Benchmarking Framework

### 2.1 Metrics to Measure

| Metric Category | Specific Metrics | Measurement Method | Target |
|----------------|------------------|-------------------|--------|
| **CPU Usage** | Audio processing µs/frame | `esp_timer_get_time()` | < 2000 µs |
| | Feature extraction µs/frame | Per-feature timing | < 500 µs total |
| | Pattern rendering µs/frame | Pattern-level timing | < 5000 µs |
| | Total CPU % (Core 0 + Core 1) | FreeRTOS task stats | < 60% |
| **Memory** | Heap usage (bytes) | `esp_get_free_heap_size()` | < 32KB increase |
| | Stack usage (bytes) | FreeRTOS watermark | < 8KB per task |
| | Static memory (bytes) | Compile-time reports | < 16KB increase |
| **Latency** | Audio-to-visual latency (ms) | Timestamp delta | < 50 ms |
| | Beat-to-flash latency (ms) | Onset to LED change | < 30 ms |
| | API response time (ms) | REST endpoint timing | < 100 ms |
| **Throughput** | FPS (frames per second) | Frame counter | ≥ 120 FPS |
| | Audio frames/sec | Audio task counter | ≥ 100 FPS |
| | Dropped frames/min | Frame skip counter | < 10 |

### 2.2 Baseline Measurement (Pre-Phase 0)

Create baseline snapshot before any enhancements:

```cpp
// firmware/test/test_audio_performance/test_baseline_snapshot.cpp

#include <unity.h>
#include "test_utils/test_helpers.h"
#include "audio/goertzel.h"
#include "audio/tempo.h"
#include "audio/vu.h"

struct PerformanceBaseline {
    // CPU timings (microseconds)
    float acquire_sample_chunk_us;
    float calculate_magnitudes_us;
    float get_chromagram_us;
    float update_tempo_us;
    float run_vu_us;
    float total_audio_frame_us;

    // Memory (bytes)
    size_t free_heap_start;
    size_t free_heap_end;
    size_t min_free_heap;

    // Throughput
    float audio_fps;
    float render_fps;

    void print() {
        Serial.println("\n=== Performance Baseline ===");
        Serial.printf("Audio Processing:\n");
        Serial.printf("  acquire_sample_chunk: %.2f µs\n", acquire_sample_chunk_us);
        Serial.printf("  calculate_magnitudes: %.2f µs\n", calculate_magnitudes_us);
        Serial.printf("  get_chromagram: %.2f µs\n", get_chromagram_us);
        Serial.printf("  update_tempo: %.2f µs\n", update_tempo_us);
        Serial.printf("  run_vu: %.2f µs\n", run_vu_us);
        Serial.printf("  TOTAL: %.2f µs\n", total_audio_frame_us);

        Serial.printf("\nMemory:\n");
        Serial.printf("  Free heap (start): %u bytes\n", free_heap_start);
        Serial.printf("  Free heap (end): %u bytes\n", free_heap_end);
        Serial.printf("  Min free heap: %u bytes\n", min_free_heap);
        Serial.printf("  Heap delta: %d bytes\n",
                     (int)free_heap_start - (int)free_heap_end);

        Serial.printf("\nThroughput:\n");
        Serial.printf("  Audio FPS: %.2f\n", audio_fps);
        Serial.printf("  Render FPS: %.2f\n", render_fps);
    }
};

void test_capture_baseline() {
    PerformanceBaseline baseline;
    TestTimer timer;
    FPSCounter audio_fps;

    // Memory snapshot
    baseline.free_heap_start = esp_get_free_heap_size();

    // Initialize audio
    init_audio_stubs();
    init_goertzel_constants_musical();
    init_tempo_goertzel_constants();
    init_vu();

    // Warm-up
    for (int i = 0; i < 100; i++) {
        acquire_sample_chunk();
        calculate_magnitudes();
        get_chromagram();
        update_tempo();
        run_vu();
    }

    // Measure individual functions (1000 iterations)
    const int iterations = 1000;

    timer.start();
    for (int i = 0; i < iterations; i++) {
        acquire_sample_chunk();
    }
    timer.stop();
    baseline.acquire_sample_chunk_us = timer.elapsed_us() / iterations;

    timer.start();
    for (int i = 0; i < iterations; i++) {
        calculate_magnitudes();
    }
    timer.stop();
    baseline.calculate_magnitudes_us = timer.elapsed_us() / iterations;

    timer.start();
    for (int i = 0; i < iterations; i++) {
        get_chromagram();
    }
    timer.stop();
    baseline.get_chromagram_us = timer.elapsed_us() / iterations;

    timer.start();
    for (int i = 0; i < iterations; i++) {
        update_tempo();
    }
    timer.stop();
    baseline.update_tempo_us = timer.elapsed_us() / iterations;

    timer.start();
    for (int i = 0; i < iterations; i++) {
        run_vu();
    }
    timer.stop();
    baseline.run_vu_us = timer.elapsed_us() / iterations;

    // Total audio frame processing
    timer.start();
    for (int i = 0; i < iterations; i++) {
        acquire_sample_chunk();
        calculate_magnitudes();
        get_chromagram();
        update_tempo();
        run_vu();
    }
    timer.stop();
    baseline.total_audio_frame_us = timer.elapsed_us() / iterations;

    // Audio FPS measurement (5 seconds)
    audio_fps.reset();
    uint32_t start = millis();
    while (millis() - start < 5000) {
        acquire_sample_chunk();
        calculate_magnitudes();
        get_chromagram();
        update_tempo();
        run_vu();
        audio_fps.tick();
    }
    baseline.audio_fps = audio_fps.get_fps();

    // Memory snapshot
    baseline.free_heap_end = esp_get_free_heap_size();
    baseline.min_free_heap = esp_get_minimum_free_heap_size();

    // Print and validate
    baseline.print();

    // Basic sanity checks
    TEST_ASSERT_LESS_THAN(5000.0f, baseline.total_audio_frame_us);
    TEST_ASSERT_GREATER_THAN(50.0f, baseline.audio_fps);
    TEST_ASSERT_LESS_THAN(10000, (int)baseline.free_heap_start - (int)baseline.free_heap_end);
}

void setUp(void) {}
void tearDown(void) {}

void setup() {
    delay(2000);
    UNITY_BEGIN();

    RUN_TEST(test_capture_baseline);

    UNITY_END();
}

void loop() {}
```

### 2.3 Phase-Specific Performance Targets

| Phase | Feature | CPU Target (µs) | Memory Target (KB) | Notes |
|-------|---------|----------------|-------------------|-------|
| **Phase 0** | Beat phase tracking | +200 µs | +2 KB | Baseline improvement |
| **Phase 1** | Spectral centroid | +100 µs | +1 KB | Single feature add |
| | Spectral flux | +150 µs | +2 KB | History buffer |
| | Onset detection | +200 µs | +4 KB | Threshold tracking |
| | **Phase 1 Total** | +450 µs | +7 KB | Cumulative |
| **Phase 2** | Harmonic-percussive separation | +800 µs | +8 KB | Median filtering |
| | Arousal estimation | +50 µs | +1 KB | Derived metric |
| | Valence estimation | +50 µs | +1 KB | Derived metric |
| | **Phase 2 Total** | +1350 µs | +17 KB | Cumulative |
| **Phase 3** | Pattern enhancements | +500 µs | +4 KB | Per-pattern overhead |
| **Phase 4** | New patterns | +800 µs | +6 KB | 3 new patterns |
| **Phase 5** | Dual RMT channel | +200 µs | +8 KB | Second channel |

**Overall Budget**: +3300 µs total (within 5ms frame budget at 120 FPS)

### 2.4 Regression Detection System

```cpp
// firmware/test/test_audio_performance/test_regression_detection.cpp

#include <unity.h>
#include "test_utils/test_helpers.h"

// Expected performance after each phase (stored in PROGMEM)
const PerformanceBaseline EXPECTED_BASELINES[] PROGMEM = {
    // Phase 0 (baseline)
    { .total_audio_frame_us = 2000.0f, .free_heap_end = 200000 },
    // Phase 1 (+ spectral features)
    { .total_audio_frame_us = 2450.0f, .free_heap_end = 193000 },
    // Phase 2 (+ HPSS)
    { .total_audio_frame_us = 3350.0f, .free_heap_end = 183000 },
    // Phase 3 (+ enhanced patterns)
    { .total_audio_frame_us = 3850.0f, .free_heap_end = 179000 },
    // Phase 4 (+ new patterns)
    { .total_audio_frame_us = 4650.0f, .free_heap_end = 173000 },
    // Phase 5 (+ dual channel)
    { .total_audio_frame_us = 4850.0f, .free_heap_end = 165000 }
};

void test_performance_regression() {
    const int current_phase = 0;  // Update this per phase
    PerformanceBaseline expected = EXPECTED_BASELINES[current_phase];

    // Capture current performance
    PerformanceBaseline actual;
    capture_performance_snapshot(&actual);

    // Check CPU regression (10% tolerance)
    float cpu_tolerance = expected.total_audio_frame_us * 0.10f;
    TEST_ASSERT_IN_RANGE(actual.total_audio_frame_us,
                        expected.total_audio_frame_us - cpu_tolerance,
                        expected.total_audio_frame_us + cpu_tolerance);

    // Check memory regression (5KB tolerance)
    TEST_ASSERT_IN_RANGE(actual.free_heap_end,
                        expected.free_heap_end - 5000,
                        expected.free_heap_end + 5000);

    // FPS must remain above 100
    TEST_ASSERT_GREATER_THAN(100.0f, actual.audio_fps);
}
```

---

## 3. Real-World Validation

### 3.1 Music Test Library

#### 3.1.1 Curated Test Tracks

| Genre | Track Characteristics | Test Focus | Source |
|-------|----------------------|------------|--------|
| **Electronic** | 128 BPM, 4/4 time, steady kick | Beat phase accuracy, tempo detection | Free sample packs |
| **Classical** | Orchestral, complex harmonics | Spectral centroid, harmonic detection | Creative Commons |
| **Pop** | Vocals, dynamic range | Onset detection, valence estimation | Royalty-free music |
| **Ambient** | Slow evolution, no beat | Silence handling, arousal estimation | Free ambient albums |
| **Rock** | Backbeat (snare on 2/4), guitar | Percussive separation, genre adaptation | CC-licensed tracks |
| **Jazz** | Swing rhythm, improvisation | Tempo variation, complex harmonics | Free jazz archives |

#### 3.1.2 Test Signal Repository Structure

```
firmware/test_data/
├── audio_samples/
│   ├── electronic_128bpm.wav     # 30 seconds, electronic beat
│   ├── classical_strings.wav     # 30 seconds, string quartet
│   ├── pop_vocals.wav            # 30 seconds, vocal-centric
│   ├── ambient_drone.wav         # 30 seconds, minimal beat
│   ├── rock_backbeat.wav         # 30 seconds, rock drums
│   └── jazz_swing.wav            # 30 seconds, swing rhythm
├── metronomes/
│   ├── metronome_60bpm.wav
│   ├── metronome_120bpm.wav
│   └── metronome_180bpm.wav
└── edge_cases/
    ├── silence_10s.wav
    ├── clipped_signal.wav
    ├── rapid_transients.wav
    └── frequency_sweep.wav
```

**Note**: Due to repository size constraints, these should be:
1. Downloaded separately via script
2. Generated synthetically when possible
3. Referenced via URLs to Creative Commons sources

### 3.2 Visual Validation Methodology

#### 3.2.1 Objective Metrics

```cpp
// Visual synchronization measurement

struct VisualValidationMetrics {
    // Beat sync
    float beat_flash_latency_ms;     // Time from beat to LED change
    float beat_sync_accuracy;        // % of beats correctly synced

    // Color mapping
    float color_mood_correlation;    // Correlation with expected mood
    float color_smoothness;          // Rate of color change (smooth vs jerky)

    // Brightness
    float brightness_dynamic_range;  // Max/min brightness ratio
    float brightness_floor_compliance; // % time above floor

    // Smoothness
    float motion_jerkiness_index;    // Derivative of position changes
    float transition_smoothness;     // Smoothness of state transitions
};
```

#### 3.2.2 Subjective Testing Framework

**Test Protocol**:
1. **Blind A/B Testing**: Show before/after patterns without labels
2. **Likert Scale Surveys**: 1-5 rating on:
   - Synchronization quality
   - Visual appeal
   - Emotional resonance
   - Variety/interest
3. **Genre-Specific Tests**: Rate each genre separately
4. **Long-Form Observation**: 5-minute sessions for fatigue/interest tracking

**Test Participant Pool**:
- Minimum 10 participants
- Mix of technical and non-technical users
- Varied music preferences
- Repeat tests across phases

### 3.3 A/B Comparison Methodology

#### 3.3.1 Comparison Matrix

| Comparison Aspect | Before (Baseline) | After (Enhanced) | Measurement |
|------------------|-------------------|------------------|-------------|
| Beat sync precision | Visual observation | Visual + latency | Latency monitor |
| Color richness | Single palette | Multi-palette | Palette diversity |
| Motion smoothness | Jerky | Smooth | Motion analysis |
| Emotional match | Static | Dynamic | User survey |
| Genre adaptation | Generic | Specific | User preference |

#### 3.3.2 Automated A/B Test Harness

```cpp
// Run pattern with baseline vs enhanced audio features

void run_ab_test(const char* test_track, int duration_seconds) {
    // Mode A: Baseline audio features
    enable_audio_features(BASELINE_ONLY);
    record_visual_output("output_baseline.csv", duration_seconds);

    // Mode B: Enhanced audio features
    enable_audio_features(ALL_ENHANCEMENTS);
    record_visual_output("output_enhanced.csv", duration_seconds);

    // Generate comparison report
    generate_ab_comparison_report("output_baseline.csv",
                                  "output_enhanced.csv",
                                  test_track);
}
```

---

## 4. Automated Testing & CI/CD Integration

### 4.1 PlatformIO Test Configuration

Update `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/platformio.ini`:

```ini
[env:esp32-s3-devkitc-1]
# ... existing config ...

# Unit Testing Configuration
test_framework = unity
test_speed = 2000000
test_port = /dev/tty.usbmodem212401
test_build_src = yes

# Test filters (run groups selectively)
test_filter =
    test_audio_features/*
    test_audio_tempo/*
    test_audio_integration/*

# Ignore long-running tests by default
test_ignore =
    test_hardware_stress
    test_audio_performance/test_long_duration

# Audio test environment with telemetry enabled
[env:esp32-s3-audio-test]
extends = env:esp32-s3-devkitc-1
build_flags =
    ${env:esp32-s3-devkitc-1.build_flags}
    -DAUDIO_TEST_MODE=1
    -DDEBUG_TELEMETRY=1
    -DREST_AUDIO_ARRAYS=1
test_filter = test_audio_*
```

### 4.2 GitHub Actions CI Workflow

Create `.github/workflows/audio_tests.yml`:

```yaml
name: Audio Feature Tests

on:
  push:
    branches: [ main, develop, 'feature/audio-*' ]
  pull_request:
    branches: [ main, develop ]

jobs:
  firmware-tests:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.10'

    - name: Install PlatformIO
      run: |
        pip install platformio
        pio upgrade

    - name: Run Audio Unit Tests
      run: |
        cd firmware
        pio test -e esp32-s3-devkitc-1 -f test_audio_features
        pio test -e esp32-s3-devkitc-1 -f test_audio_tempo

    - name: Run Performance Benchmarks
      run: |
        cd firmware
        pio test -e esp32-s3-audio-test -f test_audio_performance

    - name: Parse Test Results
      run: |
        python tools/parse_test_results.py firmware/.pio/test/

    - name: Upload Test Reports
      uses: actions/upload-artifact@v3
      with:
        name: test-results
        path: firmware/.pio/test/*/output.xml

    - name: Performance Regression Check
      run: |
        python tools/check_performance_regression.py \
          --baseline docs/benchmarks/baseline_phase_0.json \
          --current firmware/.pio/test/results.json \
          --tolerance 10
```

### 4.3 Regression Alert System

Create `tools/check_performance_regression.py`:

```python
#!/usr/bin/env python3
import json
import sys
import argparse

def check_regression(baseline_file, current_file, tolerance_pct):
    """Compare current performance against baseline with tolerance."""

    with open(baseline_file, 'r') as f:
        baseline = json.load(f)

    with open(current_file, 'r') as f:
        current = json.load(f)

    regressions = []

    # Check CPU timing
    if 'total_audio_frame_us' in baseline and 'total_audio_frame_us' in current:
        baseline_cpu = baseline['total_audio_frame_us']
        current_cpu = current['total_audio_frame_us']
        delta_pct = ((current_cpu - baseline_cpu) / baseline_cpu) * 100

        if delta_pct > tolerance_pct:
            regressions.append(f"CPU regression: {delta_pct:.1f}% slower ({baseline_cpu:.0f} -> {current_cpu:.0f} µs)")

    # Check memory
    if 'free_heap_end' in baseline and 'free_heap_end' in current:
        baseline_mem = baseline['free_heap_end']
        current_mem = current['free_heap_end']
        delta_bytes = baseline_mem - current_mem

        if delta_bytes > 5000:  # 5KB tolerance
            regressions.append(f"Memory regression: {delta_bytes} bytes increase")

    # Check FPS
    if 'audio_fps' in current:
        if current['audio_fps'] < 100.0:
            regressions.append(f"FPS below minimum: {current['audio_fps']:.1f} FPS")

    if regressions:
        print("❌ PERFORMANCE REGRESSION DETECTED:")
        for r in regressions:
            print(f"  - {r}")
        return 1
    else:
        print("✅ No performance regressions detected")
        return 0

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--baseline', required=True)
    parser.add_argument('--current', required=True)
    parser.add_argument('--tolerance', type=float, default=10.0)
    args = parser.parse_args()

    sys.exit(check_regression(args.baseline, args.current, args.tolerance))
```

### 4.4 Continuous Performance Tracking

Create `tools/track_performance.py`:

```python
#!/usr/bin/env python3
"""
Track performance metrics over time and generate trend graphs.
"""
import json
import datetime
import matplotlib.pyplot as plt
import pandas as pd

def append_metrics(metrics_file, new_metrics):
    """Append new performance metrics to historical log."""

    timestamp = datetime.datetime.now().isoformat()
    new_entry = {
        'timestamp': timestamp,
        'metrics': new_metrics
    }

    try:
        with open(metrics_file, 'r') as f:
            history = json.load(f)
    except FileNotFoundError:
        history = []

    history.append(new_entry)

    with open(metrics_file, 'w') as f:
        json.dump(history, f, indent=2)

def generate_trend_graph(metrics_file, output_png):
    """Generate performance trend graph from historical metrics."""

    with open(metrics_file, 'r') as f:
        history = json.load(f)

    df = pd.DataFrame([
        {
            'timestamp': entry['timestamp'],
            'cpu_us': entry['metrics'].get('total_audio_frame_us', 0),
            'memory_kb': entry['metrics'].get('free_heap_end', 0) / 1024,
            'fps': entry['metrics'].get('audio_fps', 0)
        }
        for entry in history
    ])

    df['timestamp'] = pd.to_datetime(df['timestamp'])

    fig, axes = plt.subplots(3, 1, figsize=(12, 10))

    # CPU usage
    axes[0].plot(df['timestamp'], df['cpu_us'], marker='o')
    axes[0].set_ylabel('CPU (µs/frame)')
    axes[0].set_title('Audio Processing CPU Usage')
    axes[0].grid(True)

    # Memory usage
    axes[1].plot(df['timestamp'], df['memory_kb'], marker='o', color='orange')
    axes[1].set_ylabel('Free Memory (KB)')
    axes[1].set_title('Available Heap Memory')
    axes[1].grid(True)

    # FPS
    axes[2].plot(df['timestamp'], df['fps'], marker='o', color='green')
    axes[2].set_ylabel('FPS')
    axes[2].set_title('Audio Processing Throughput')
    axes[2].axhline(y=100, color='r', linestyle='--', label='Minimum (100 FPS)')
    axes[2].legend()
    axes[2].grid(True)

    plt.tight_layout()
    plt.savefig(output_png, dpi=150)
    print(f"✅ Performance trend graph saved to {output_png}")

if __name__ == '__main__':
    # Example usage
    metrics = {
        'total_audio_frame_us': 2100.5,
        'free_heap_end': 198432,
        'audio_fps': 105.2
    }

    append_metrics('docs/benchmarks/performance_history.json', metrics)
    generate_trend_graph('docs/benchmarks/performance_history.json',
                        'docs/benchmarks/performance_trends.png')
```

---

## 5. Test Execution Procedures

### 5.1 Pre-Commit Test Checklist

Before committing any audio feature changes:

- [ ] Run unit tests for affected modules: `pio test -f test_audio_features`
- [ ] Run integration tests: `pio test -f test_audio_integration`
- [ ] Run performance benchmarks: `pio test -f test_audio_performance`
- [ ] Check for memory leaks: Review heap deltas in test output
- [ ] Verify FPS remains ≥ 100: Check throughput metrics
- [ ] Visual smoke test: Upload to device, verify patterns render correctly
- [ ] Update performance baseline if adding new features

### 5.2 Phase Completion Test Gate

At the end of each enhancement phase:

1. **Full Test Suite**: Run all tests including stress tests
   ```bash
   pio test -e esp32-s3-audio-test
   ```

2. **Performance Validation**: Compare against phase target
   ```bash
   python tools/check_performance_regression.py \
     --baseline docs/benchmarks/baseline_phase_X.json \
     --current .pio/test/results.json
   ```

3. **Real-World Validation**: Test with all genre samples
   - Upload firmware with telemetry enabled
   - Play each test track for 30 seconds
   - Record visual output and subjective impressions
   - Verify beat sync and color mapping

4. **User Acceptance Testing**:
   - Minimum 5 users test new patterns
   - Likert scale ratings ≥ 3.5/5.0 average
   - No critical bugs or visual glitches

5. **Documentation Update**:
   - Update performance baselines
   - Document new features and usage
   - Add examples to pattern library

### 5.3 Release Test Protocol

Before production release:

1. **24-Hour Stress Test**: Continuous operation with genre rotation
2. **WiFi Stability Test**: OTA updates during audio processing
3. **Thermal Test**: Verify temperature < 70°C under load
4. **Power Cycle Test**: 50 reboots, verify clean startup
5. **Pattern Switching Test**: Rapid pattern changes (100 switches)
6. **Edge Case Tests**: Silence, clipping, rapid transients
7. **Regression Suite**: Full test suite on final build
8. **Beta Testing**: External users test for 1 week minimum

---

## 6. Test Data Management

### 6.1 Test Data Sources

**Synthetic Signals** (Priority: High)
- Generated on-device during tests
- Zero external dependencies
- Deterministic and reproducible
- Suitable for CI/CD automation

**Creative Commons Music** (Priority: Medium)
- Free Music Archive (FMA): https://freemusicarchive.org/
- Internet Archive: https://archive.org/details/audio
- ccMixter: http://ccmixter.org/
- Jamendo: https://www.jamendo.com/

**Test Signal Repositories** (Priority: Low)
- EBU Sound Quality Assessment Material
- BBC Sound Effects Library (some CC-licensed)
- Freesound.org for individual sound effects

### 6.2 Test Data Storage Strategy

Due to git repository size constraints:

1. **In-Repository** (< 1MB total):
   - Synthetic signal generators (code)
   - Small reference samples (< 100KB each)
   - Metronome click tracks (< 50KB)

2. **External Storage**:
   - Full music tracks hosted on cloud storage
   - Download script: `tools/download_test_data.sh`
   - Checksum validation for integrity

3. **On-Demand Generation**:
   - Generate test signals during test execution
   - Cache locally for repeated tests
   - Clear cache script for CI/CD environments

### 6.3 Test Data Download Script

Create `tools/download_test_data.sh`:

```bash
#!/bin/bash
# Download audio test data from external sources

set -e

TEST_DATA_DIR="firmware/test_data/audio_samples"
mkdir -p "$TEST_DATA_DIR"

echo "Downloading audio test samples..."

# Metronome clicks (small, included in repo)
if [ ! -f "$TEST_DATA_DIR/metronome_120bpm.wav" ]; then
    echo "Generating metronome samples..."
    python tools/generate_metronome.py \
        --output "$TEST_DATA_DIR/metronome_120bpm.wav" \
        --bpm 120 --duration 30
fi

# Creative Commons music samples (external download)
SAMPLES_URL="https://example.com/k1-test-samples.zip"
SAMPLES_SHA256="abc123def456..."  # Update with actual checksum

if [ ! -f "$TEST_DATA_DIR/electronic_128bpm.wav" ]; then
    echo "Downloading music samples from $SAMPLES_URL..."
    curl -L "$SAMPLES_URL" -o /tmp/k1-test-samples.zip

    # Verify checksum
    echo "$SAMPLES_SHA256  /tmp/k1-test-samples.zip" | sha256sum -c -

    # Extract
    unzip -o /tmp/k1-test-samples.zip -d "$TEST_DATA_DIR"
    rm /tmp/k1-test-samples.zip
fi

echo "✅ Test data download complete"
```

---

## 7. Reporting & Metrics Dashboard

### 7.1 Test Report Template

After each test run, generate structured report:

```markdown
# Audio Feature Test Report

**Date**: 2025-11-07
**Phase**: Phase 1 - Spectral Features
**Build**: v0.2.0-alpha
**Tester**: CI/CD Pipeline

## Test Summary

- **Total Tests**: 45
- **Passed**: 43
- **Failed**: 2
- **Skipped**: 0
- **Duration**: 12m 34s

## Performance Metrics

| Metric | Baseline | Current | Delta | Status |
|--------|----------|---------|-------|--------|
| CPU (µs/frame) | 2000 | 2380 | +380 (+19%) | ⚠️ Near Limit |
| Memory (KB free) | 195 | 187 | -8 | ✅ Pass |
| Audio FPS | 105.2 | 103.8 | -1.4 | ✅ Pass |
| Render FPS | 128.5 | 126.1 | -2.4 | ✅ Pass |

## Failed Tests

### test_spectral_flux_rapid_changes
**Error**: Expected flux > 0.5, got 0.42
**Root Cause**: Threshold too aggressive for rapid genre
**Action**: Adjust threshold in Phase 1 completion

### test_onset_detection_ambient
**Error**: False positive onset at 2.3s
**Root Cause**: Ambient drone triggered onset detector
**Action**: Tune onset sensitivity for low-energy signals

## Real-World Validation

| Genre | Beat Sync | Color Match | Smoothness | Overall |
|-------|-----------|-------------|------------|---------|
| Electronic | 4.8/5 | 4.5/5 | 4.9/5 | ✅ Excellent |
| Classical | 4.2/5 | 4.7/5 | 4.8/5 | ✅ Good |
| Pop | 4.6/5 | 4.3/5 | 4.4/5 | ✅ Good |
| Ambient | 3.8/5 | 4.1/5 | 4.6/5 | ⚠️ Acceptable |
| Rock | 4.5/5 | 4.4/5 | 4.5/5 | ✅ Good |

## Regression Analysis

✅ No performance regressions detected
✅ Memory within budget (+8KB vs +7KB target)
⚠️ CPU slightly above target (+380µs vs +350µs target)

## Recommendations

1. Optimize spectral flux calculation (save ~50µs)
2. Tune onset detector sensitivity for ambient music
3. Proceed to Phase 2 after addressing failed tests
```

### 7.2 Real-Time Metrics Dashboard

For device-side monitoring during development:

```cpp
// Add to REST API: GET /api/audio/metrics

void handle_audio_metrics() {
    StaticJsonDocument<1024> doc;

    doc["cpu_us"] = g_last_audio_frame_us;
    doc["free_heap"] = esp_get_free_heap_size();
    doc["audio_fps"] = audio_frame_rate;
    doc["render_fps"] = render_frame_rate;

    doc["features"]["spectral_centroid"] = last_spectral_centroid;
    doc["features"]["spectral_flux"] = last_spectral_flux;
    doc["features"]["onset_strength"] = last_onset_strength;

    doc["tempo"]["bpm"] = detected_bpm;
    doc["tempo"]["confidence"] = tempo_confidence;
    doc["tempo"]["phase"] = beat_phase;

    String response;
    serializeJson(doc, response);
    request->send(200, "application/json", response);
}
```

Access metrics via: `http://k1-device.local/api/audio/metrics`

---

## 8. Success Criteria

### 8.1 Quality Gates (Must Pass)

| Gate | Criteria | Measurement |
|------|----------|-------------|
| **Unit Tests** | ≥ 95% pass rate | PlatformIO test runner |
| **Performance** | CPU < 5ms/frame | Benchmark suite |
| **Memory** | Heap delta < 32KB | Memory profiling |
| **FPS** | ≥ 100 audio FPS, ≥ 120 render FPS | FPS counters |
| **Latency** | Audio-to-visual < 50ms | Timestamp delta |
| **Stability** | 24h continuous operation | Stress test |

### 8.2 Phase-Specific Goals

**Phase 0: Beat Phase Accuracy**
- BPM detection accuracy: ≥ 90% within 5% tolerance (60-180 BPM)
- Beat phase continuity: No jumps > π/4 radians
- Confidence on silence: < 0.2
- Confidence on metronome: > 0.6

**Phase 1: Spectral Features**
- Spectral centroid accuracy: ≥ 85% within 10% of expected
- Onset detection recall: ≥ 80% (catch 8/10 onsets)
- Onset detection precision: ≥ 70% (7/10 detections valid)
- Spectral flux response time: < 20ms

**Phase 2: HPSS & Emotion**
- Harmonic/percussive separation quality: SNR > 10dB
- Arousal estimation correlation: r > 0.7 with ground truth
- Valence estimation correlation: r > 0.6 with ground truth

**Phase 3-5: Pattern Enhancements**
- User satisfaction: ≥ 4.0/5.0 average rating
- Genre coverage: All 5 genres rated ≥ 3.5/5.0
- No visual glitches or artifacts

### 8.3 Acceptance Criteria

Before merging to main:
1. ✅ All unit tests pass
2. ✅ No performance regressions beyond tolerance
3. ✅ Code review approved (2 reviewers minimum)
4. ✅ Documentation updated
5. ✅ Real-world validation completed
6. ✅ User acceptance testing passed (if applicable)

---

## 9. Risk Mitigation

### 9.1 Known Risks & Mitigation Strategies

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **CPU Budget Exceeded** | Medium | High | Profile early, optimize hot paths, provide disable flags |
| **Memory Overflow** | Low | High | Static allocation, compile-time size checks, heap monitoring |
| **Beat Detection False Positives** | High | Medium | Adaptive thresholding, confidence gating, genre-specific tuning |
| **Visual Chaos (Too Busy)** | Medium | Medium | Intensity parameter, user presets, gradual rollout |
| **Genre Bias (EDM-centric)** | High | Medium | Diverse test library, genre-specific presets, user feedback |
| **Latency Increase** | Medium | High | Lock-free synchronization, optimize critical paths, buffer tuning |

### 9.2 Fallback Mechanisms

1. **Feature Disable Flags**: Compile-time flags to disable features
2. **Graceful Degradation**: Fall back to simpler algorithms on overload
3. **Dynamic Quality Scaling**: Reduce feature resolution under load
4. **Safe Defaults**: Conservative parameters that work across genres

---

## 10. Next Steps

### 10.1 Immediate Actions (Week 1)

1. ✅ Review and approve this test strategy document
2. Create test infrastructure:
   - `firmware/test/test_audio_features/` directory
   - `firmware/test/test_data/` synthetic signal generators
   - `tools/` performance tracking scripts
3. Implement baseline performance snapshot test
4. Set up CI/CD workflow for automated testing
5. Download/generate initial test data library

### 10.2 Phase 0 Test Implementation (Week 2)

1. Implement beat phase accuracy tests
2. Implement BPM detection validation
3. Create metronome test signals (60-180 BPM)
4. Run baseline measurements and document results
5. Set performance targets for Phase 1

### 10.3 Ongoing (Throughout Project)

1. Update performance baselines after each phase
2. Expand test coverage for new features
3. Collect user feedback and adjust validation criteria
4. Generate performance trend reports monthly
5. Maintain test data library and add edge cases

---

## Appendix A: Test File Organization

```
firmware/test/
├── test_audio_features/
│   ├── test_spectral_centroid.cpp
│   ├── test_spectral_flux.cpp
│   ├── test_onset_detection.cpp
│   ├── test_harmonic_percussive.cpp
│   └── test_arousal_valence.cpp
├── test_audio_tempo/
│   ├── test_beat_phase_accuracy.cpp
│   ├── test_bpm_detection.cpp
│   ├── test_phase_wrapping.cpp
│   └── test_beat_confidence.cpp
├── test_audio_integration/
│   ├── test_audio_pipeline.cpp
│   ├── test_pattern_audio_sync.cpp
│   └── test_audio_latency.cpp
├── test_audio_performance/
│   ├── test_baseline_snapshot.cpp
│   ├── test_cpu_usage.cpp
│   ├── test_memory_usage.cpp
│   └── test_regression_detection.cpp
├── test_data/
│   ├── synthetic_signals.h
│   ├── genre_patterns.h
│   └── audio_samples/ (downloaded separately)
├── test_utils/
│   └── test_helpers.h (existing)
└── README.md (existing)
```

---

## Appendix B: References

- **Audio Analysis Theory**:
  - Spectral Centroid: https://en.wikipedia.org/wiki/Spectral_centroid
  - Onset Detection: Bello et al., "A Tutorial on Onset Detection in Music Signals"
  - HPSS: Fitzgerald, "Harmonic/Percussive Separation using Median Filtering"

- **Beat Detection**:
  - Goertzel Algorithm: https://en.wikipedia.org/wiki/Goertzel_algorithm
  - Tempo Estimation: Scheirer, "Tempo and Beat Analysis of Acoustic Musical Signals"

- **Emotion Recognition**:
  - Arousal/Valence Model: Russell's Circumplex Model
  - MER Database: https://cvml.unige.ch/databases/emoMusic/

- **Testing Best Practices**:
  - Embedded Testing: James Grenning, "Test Driven Development for Embedded C"
  - Performance Testing: Brendan Gregg, "Systems Performance"

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-07 | Test Engineering | Initial comprehensive test strategy |

---

**End of Document**

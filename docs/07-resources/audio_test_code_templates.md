# Audio Test Code Templates & Automation Scripts

**Title**: Ready-to-Use Test Templates and Automation Tools
**Owner**: Test Engineering Team
**Date**: 2025-11-07
**Status**: Reference
**Scope**: Test implementation, automation scripts
**Related**:
  - `/docs/04-planning/audio_enhancement_test_strategy.md`
  - `/firmware/test/test_utils/test_helpers.h`
**Tags**: testing, templates, automation, reference

---

## Purpose

This document provides copy-paste ready code templates and automation scripts referenced in the Audio Enhancement Test Strategy. Use these as starting points for implementing tests during each enhancement phase.

---

## 1. Desktop Analysis Tools

### 1.1 Python Test Data Generator (tools/generate_test_signals.py)

```python
#!/usr/bin/env python3
"""
Generate synthetic audio test signals for K1 audio feature validation.
Outputs WAV files compatible with ESP32 I2S input (16-bit, 16kHz, mono).
"""

import numpy as np
import wave
import struct
import argparse

SAMPLE_RATE = 16000

def write_wav(filename, samples):
    """Write 16-bit mono WAV file at 16kHz."""
    # Normalize to int16 range
    samples = np.clip(samples, -1.0, 1.0)
    samples_int = (samples * 32767).astype(np.int16)

    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(SAMPLE_RATE)
        wav_file.writeframes(samples_int.tobytes())

    print(f"✅ Written {len(samples)} samples to {filename}")

def generate_sine(freq_hz, duration_s, amplitude=1.0):
    """Generate pure sine wave."""
    t = np.arange(0, duration_s, 1/SAMPLE_RATE)
    return amplitude * np.sin(2 * np.pi * freq_hz * t)

def generate_metronome(bpm, duration_s, click_freq=1000, click_duration=0.01):
    """Generate metronome click track."""
    samples_per_beat = int((60.0 / bpm) * SAMPLE_RATE)
    total_samples = int(duration_s * SAMPLE_RATE)
    signal = np.zeros(total_samples)

    click_samples = int(click_duration * SAMPLE_RATE)
    beat_count = int(duration_s * bpm / 60)

    for beat in range(beat_count):
        click_start = beat * samples_per_beat
        if click_start + click_samples > total_samples:
            break

        t_click = np.arange(click_samples) / SAMPLE_RATE
        envelope = np.exp(-10.0 * t_click / click_duration)
        click = envelope * np.sin(2 * np.pi * click_freq * t_click)

        signal[click_start:click_start + click_samples] = click

    return signal

def generate_chirp(start_freq, end_freq, duration_s):
    """Generate frequency sweep (chirp)."""
    t = np.arange(0, duration_s, 1/SAMPLE_RATE)
    instantaneous_freq = start_freq + (end_freq - start_freq) * (t / duration_s)
    phase = 2 * np.pi * np.cumsum(instantaneous_freq) / SAMPLE_RATE
    return np.sin(phase)

def generate_harmonic(fundamental_hz, num_harmonics, duration_s):
    """Generate harmonic tone with overtones."""
    t = np.arange(0, duration_s, 1/SAMPLE_RATE)
    signal = np.zeros_like(t)

    for h in range(1, num_harmonics + 1):
        harmonic_freq = fundamental_hz * h
        amplitude = 1.0 / h  # 1/h amplitude decay
        signal += amplitude * np.sin(2 * np.pi * harmonic_freq * t)

    # Normalize
    signal /= np.max(np.abs(signal))
    return signal

def generate_percussive(freq_hz, decay_rate, duration_s):
    """Generate percussive burst (sharp attack, exponential decay)."""
    t = np.arange(0, duration_s, 1/SAMPLE_RATE)
    envelope = np.exp(-decay_rate * t)
    return envelope * np.sin(2 * np.pi * freq_hz * t)

def generate_white_noise(duration_s, amplitude=1.0):
    """Generate white noise."""
    samples = int(duration_s * SAMPLE_RATE)
    return amplitude * np.random.uniform(-1, 1, samples)

def generate_electronic_beat(bpm, duration_s):
    """Generate electronic music pattern (kick + hi-hat)."""
    samples_per_beat = int((60.0 / bpm) * SAMPLE_RATE)
    total_samples = int(duration_s * SAMPLE_RATE)
    signal = np.zeros(total_samples)

    beat_count = int(duration_s * bpm / 60)

    for beat in range(beat_count):
        beat_start = beat * samples_per_beat

        # Kick drum (55 Hz, 100 samples)
        kick_samples = 100
        if beat_start + kick_samples > total_samples:
            break
        t_kick = np.arange(kick_samples) / SAMPLE_RATE
        kick = np.exp(-0.05 * np.arange(kick_samples)) * np.sin(2 * np.pi * 55 * t_kick)
        signal[beat_start:beat_start + kick_samples] += kick

        # Hi-hat on off-beats (8kHz noise burst)
        if beat % 2 == 1:
            hat_start = beat_start + samples_per_beat // 2
            hat_samples = 50
            if hat_start + hat_samples > total_samples:
                continue
            hat = 0.3 * np.exp(-0.1 * np.arange(hat_samples)) * np.random.uniform(-1, 1, hat_samples)
            signal[hat_start:hat_start + hat_samples] += hat

    return signal

def main():
    parser = argparse.ArgumentParser(description='Generate audio test signals')
    parser.add_argument('--output-dir', default='firmware/test_data/audio_samples',
                       help='Output directory for WAV files')
    parser.add_argument('--duration', type=float, default=30.0,
                       help='Duration in seconds (default: 30)')
    args = parser.parse_args()

    import os
    os.makedirs(args.output_dir, exist_ok=True)

    # Metronome clicks at various BPMs
    for bpm in [60, 90, 120, 140, 180]:
        signal = generate_metronome(bpm, args.duration)
        write_wav(f"{args.output_dir}/metronome_{bpm}bpm.wav", signal)

    # Sine waves at test frequencies
    for freq in [100, 440, 1000, 4000]:
        signal = generate_sine(freq, args.duration)
        write_wav(f"{args.output_dir}/sine_{freq}hz.wav", signal)

    # Frequency sweep
    signal = generate_chirp(50, 8000, args.duration)
    write_wav(f"{args.output_dir}/frequency_sweep.wav", signal)

    # Harmonic tone
    signal = generate_harmonic(220, 8, args.duration)
    write_wav(f"{args.output_dir}/harmonic_220hz.wav", signal)

    # Percussive burst
    signal = generate_percussive(200, 10.0, 2.0)
    write_wav(f"{args.output_dir}/percussive_burst.wav", signal)

    # White noise
    signal = generate_white_noise(args.duration, amplitude=0.5)
    write_wav(f"{args.output_dir}/white_noise.wav", signal)

    # Electronic beat
    signal = generate_electronic_beat(128, args.duration)
    write_wav(f"{args.output_dir}/electronic_128bpm.wav", signal)

    # Silence
    signal = np.zeros(int(args.duration * SAMPLE_RATE))
    write_wav(f"{args.output_dir}/silence.wav", signal)

    print(f"\n✅ All test signals generated in {args.output_dir}/")

if __name__ == '__main__':
    main()
```

**Usage**:
```bash
python tools/generate_test_signals.py --output-dir firmware/test_data/audio_samples --duration 30
```

### 1.2 Performance Visualization Tool (tools/visualize_performance.py)

```python
#!/usr/bin/env python3
"""
Visualize audio feature performance metrics from test reports.
Generates comparison charts for CPU, memory, and FPS across phases.
"""

import json
import matplotlib.pyplot as plt
import numpy as np
import argparse

def load_metrics(json_file):
    """Load metrics from JSON file."""
    with open(json_file, 'r') as f:
        return json.load(f)

def plot_phase_comparison(metrics_files, output_png):
    """Generate multi-phase performance comparison chart."""

    phases = []
    cpu_values = []
    memory_values = []
    fps_values = []

    for i, metrics_file in enumerate(metrics_files):
        metrics = load_metrics(metrics_file)
        phases.append(f"Phase {i}")
        cpu_values.append(metrics.get('total_audio_frame_us', 0))
        memory_values.append(200000 - metrics.get('free_heap_end', 200000))  # Used memory
        fps_values.append(metrics.get('audio_fps', 0))

    fig, axes = plt.subplots(1, 3, figsize=(15, 5))

    # CPU usage bar chart
    axes[0].bar(phases, cpu_values, color='steelblue')
    axes[0].axhline(y=5000, color='r', linestyle='--', label='5ms limit')
    axes[0].set_ylabel('CPU (µs/frame)')
    axes[0].set_title('Audio Processing CPU Usage')
    axes[0].legend()
    axes[0].grid(axis='y', alpha=0.3)

    # Memory usage bar chart
    memory_kb = [m / 1024 for m in memory_values]
    axes[1].bar(phases, memory_kb, color='orange')
    axes[1].axhline(y=32, color='r', linestyle='--', label='32KB target')
    axes[1].set_ylabel('Memory Used (KB)')
    axes[1].set_title('Memory Footprint')
    axes[1].legend()
    axes[1].grid(axis='y', alpha=0.3)

    # FPS bar chart
    axes[2].bar(phases, fps_values, color='green')
    axes[2].axhline(y=100, color='r', linestyle='--', label='100 FPS minimum')
    axes[2].set_ylabel('FPS')
    axes[2].set_title('Audio Processing Throughput')
    axes[2].legend()
    axes[2].grid(axis='y', alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_png, dpi=150)
    print(f"✅ Performance comparison chart saved to {output_png}")

def plot_feature_breakdown(metrics_file, output_png):
    """Generate feature-level CPU breakdown pie chart."""

    metrics = load_metrics(metrics_file)

    if 'feature_breakdown' not in metrics:
        print("⚠️  No feature breakdown data in metrics file")
        return

    breakdown = metrics['feature_breakdown']
    labels = []
    sizes = []

    for feature, cpu_us in breakdown.items():
        labels.append(feature)
        sizes.append(cpu_us)

    fig, ax = plt.subplots(figsize=(10, 7))
    ax.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=90)
    ax.set_title('CPU Usage Breakdown by Feature')

    plt.tight_layout()
    plt.savefig(output_png, dpi=150)
    print(f"✅ Feature breakdown chart saved to {output_png}")

def main():
    parser = argparse.ArgumentParser(description='Visualize performance metrics')
    parser.add_argument('--phase-comparison', nargs='+',
                       help='JSON files for phase comparison (in order)')
    parser.add_argument('--feature-breakdown',
                       help='JSON file with feature breakdown')
    parser.add_argument('--output', required=True,
                       help='Output PNG file')
    args = parser.parse_args()

    if args.phase_comparison:
        plot_phase_comparison(args.phase_comparison, args.output)
    elif args.feature_breakdown:
        plot_feature_breakdown(args.feature_breakdown, args.output)
    else:
        print("❌ Provide --phase-comparison or --feature-breakdown")

if __name__ == '__main__':
    main()
```

**Usage**:
```bash
# Phase comparison
python tools/visualize_performance.py \
  --phase-comparison docs/benchmarks/phase_0.json docs/benchmarks/phase_1.json \
  --output docs/benchmarks/phase_comparison.png

# Feature breakdown
python tools/visualize_performance.py \
  --feature-breakdown docs/benchmarks/phase_1_breakdown.json \
  --output docs/benchmarks/feature_breakdown.png
```

### 1.3 Beat Detection Validator (tools/validate_beat_detection.py)

```python
#!/usr/bin/env python3
"""
Validate beat detection accuracy by analyzing device telemetry output.
Compares detected beats against known metronome ground truth.
"""

import json
import numpy as np
import argparse

def load_telemetry(json_file):
    """Load telemetry data exported from device."""
    with open(json_file, 'r') as f:
        return json.load(f)

def find_peaks(signal, threshold=0.5, min_distance=10):
    """Find peaks in beat signal (simple peak detector)."""
    peaks = []
    for i in range(min_distance, len(signal) - min_distance):
        if signal[i] > threshold:
            if all(signal[i] >= signal[i-j] for j in range(1, min_distance)):
                if all(signal[i] >= signal[i+j] for j in range(1, min_distance)):
                    peaks.append(i)
    return peaks

def calculate_beat_accuracy(detected_beats, expected_bpm, duration_s, tolerance_ms=50):
    """Calculate beat detection accuracy metrics."""

    # Expected beat times
    beat_period_s = 60.0 / expected_bpm
    expected_beat_count = int(duration_s / beat_period_s)
    expected_beats = [i * beat_period_s for i in range(expected_beat_count)]

    # Match detected to expected
    tolerance_s = tolerance_ms / 1000.0
    true_positives = 0
    false_positives = 0

    for detected in detected_beats:
        matched = False
        for expected in expected_beats:
            if abs(detected - expected) < tolerance_s:
                true_positives += 1
                matched = True
                break
        if not matched:
            false_positives += 1

    false_negatives = expected_beat_count - true_positives

    precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0
    recall = true_positives / expected_beat_count if expected_beat_count > 0 else 0
    f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0

    return {
        'true_positives': true_positives,
        'false_positives': false_positives,
        'false_negatives': false_negatives,
        'expected_beats': expected_beat_count,
        'precision': precision,
        'recall': recall,
        'f1_score': f1_score
    }

def validate_beat_detection(telemetry_file, expected_bpm, duration_s):
    """Validate beat detection from device telemetry."""

    telemetry = load_telemetry(telemetry_file)

    # Extract beat signal (assumes tempo_magnitude or beat_signal field)
    if 'beat_signal' in telemetry:
        beat_signal = np.array(telemetry['beat_signal'])
    else:
        print("❌ No beat_signal field in telemetry data")
        return

    # Find detected beats
    detected_peaks = find_peaks(beat_signal, threshold=0.5)
    sample_rate = len(beat_signal) / duration_s
    detected_beat_times = [peak / sample_rate for peak in detected_peaks]

    # Calculate accuracy
    metrics = calculate_beat_accuracy(detected_beat_times, expected_bpm, duration_s)

    # Print results
    print("\n=== Beat Detection Validation ===")
    print(f"Expected BPM: {expected_bpm}")
    print(f"Duration: {duration_s}s")
    print(f"Expected beats: {metrics['expected_beats']}")
    print(f"Detected beats: {len(detected_beat_times)}")
    print(f"\nMetrics:")
    print(f"  True Positives: {metrics['true_positives']}")
    print(f"  False Positives: {metrics['false_positives']}")
    print(f"  False Negatives: {metrics['false_negatives']}")
    print(f"  Precision: {metrics['precision']:.2%}")
    print(f"  Recall: {metrics['recall']:.2%}")
    print(f"  F1 Score: {metrics['f1_score']:.2%}")

    # Pass/fail
    if metrics['f1_score'] >= 0.80:
        print("\n✅ PASS: Beat detection meets quality threshold (F1 ≥ 80%)")
    else:
        print("\n❌ FAIL: Beat detection below quality threshold")

def main():
    parser = argparse.ArgumentParser(description='Validate beat detection accuracy')
    parser.add_argument('--telemetry', required=True,
                       help='Telemetry JSON file from device')
    parser.add_argument('--expected-bpm', type=float, required=True,
                       help='Expected BPM of test track')
    parser.add_argument('--duration', type=float, required=True,
                       help='Duration of test in seconds')
    args = parser.parse_args()

    validate_beat_detection(args.telemetry, args.expected_bpm, args.duration)

if __name__ == '__main__':
    main()
```

**Usage**:
```bash
# Export telemetry from device, then validate
python tools/validate_beat_detection.py \
  --telemetry /tmp/device_telemetry.json \
  --expected-bpm 120 \
  --duration 30
```

---

## 2. Device-Side Test Harnesses

### 2.1 Audio Feature Profiler (firmware/src/diagnostics/audio_profiler.h)

```cpp
#pragma once

#include <esp_timer.h>
#include <Arduino.h>

/**
 * Lightweight profiler for audio feature extraction.
 * Accumulates timing statistics with minimal overhead.
 */
class AudioFeatureProfiler {
public:
    struct FeatureStats {
        uint32_t call_count;
        uint64_t total_us;
        uint32_t min_us;
        uint32_t max_us;
        float avg_us;

        void reset() {
            call_count = 0;
            total_us = 0;
            min_us = UINT32_MAX;
            max_us = 0;
            avg_us = 0.0f;
        }

        void record(uint32_t elapsed_us) {
            call_count++;
            total_us += elapsed_us;
            if (elapsed_us < min_us) min_us = elapsed_us;
            if (elapsed_us > max_us) max_us = elapsed_us;
            avg_us = (float)total_us / call_count;
        }

        void print(const char* name) const {
            Serial.printf("  %s: avg=%.1fµs min=%uµs max=%uµs calls=%u\n",
                         name, avg_us, min_us, max_us, call_count);
        }
    };

private:
    FeatureStats spectral_centroid;
    FeatureStats spectral_flux;
    FeatureStats onset_detection;
    FeatureStats hpss;
    FeatureStats arousal_valence;
    FeatureStats total_audio_frame;

    uint64_t frame_start_us;

public:
    AudioFeatureProfiler() {
        reset();
    }

    void reset() {
        spectral_centroid.reset();
        spectral_flux.reset();
        onset_detection.reset();
        hpss.reset();
        arousal_valence.reset();
        total_audio_frame.reset();
    }

    void start_frame() {
        frame_start_us = esp_timer_get_time();
    }

    void end_frame() {
        uint32_t elapsed = (uint32_t)(esp_timer_get_time() - frame_start_us);
        total_audio_frame.record(elapsed);
    }

    template<typename Func>
    void profile_spectral_centroid(Func&& func) {
        uint64_t t0 = esp_timer_get_time();
        func();
        spectral_centroid.record((uint32_t)(esp_timer_get_time() - t0));
    }

    template<typename Func>
    void profile_spectral_flux(Func&& func) {
        uint64_t t0 = esp_timer_get_time();
        func();
        spectral_flux.record((uint32_t)(esp_timer_get_time() - t0));
    }

    template<typename Func>
    void profile_onset_detection(Func&& func) {
        uint64_t t0 = esp_timer_get_time();
        func();
        onset_detection.record((uint32_t)(esp_timer_get_time() - t0));
    }

    template<typename Func>
    void profile_hpss(Func&& func) {
        uint64_t t0 = esp_timer_get_time();
        func();
        hpss.record((uint32_t)(esp_timer_get_time() - t0));
    }

    template<typename Func>
    void profile_arousal_valence(Func&& func) {
        uint64_t t0 = esp_timer_get_time();
        func();
        arousal_valence.record((uint32_t)(esp_timer_get_time() - t0));
    }

    void print_report() const {
        Serial.println("\n=== Audio Feature Profiling Report ===");
        spectral_centroid.print("Spectral Centroid");
        spectral_flux.print("Spectral Flux");
        onset_detection.print("Onset Detection");
        hpss.print("HPSS");
        arousal_valence.print("Arousal/Valence");
        total_audio_frame.print("Total Audio Frame");
        Serial.println("======================================\n");
    }

    // Export as JSON for analysis
    String to_json() const {
        StaticJsonDocument<512> doc;

        auto add_stats = [&](const char* key, const FeatureStats& stats) {
            JsonObject obj = doc.createNestedObject(key);
            obj["avg_us"] = stats.avg_us;
            obj["min_us"] = stats.min_us;
            obj["max_us"] = stats.max_us;
            obj["calls"] = stats.call_count;
        };

        add_stats("spectral_centroid", spectral_centroid);
        add_stats("spectral_flux", spectral_flux);
        add_stats("onset_detection", onset_detection);
        add_stats("hpss", hpss);
        add_stats("arousal_valence", arousal_valence);
        add_stats("total_audio_frame", total_audio_frame);

        String output;
        serializeJson(doc, output);
        return output;
    }
};

// Global profiler instance (only active in test builds)
#ifdef AUDIO_TEST_MODE
extern AudioFeatureProfiler g_audio_profiler;
#define PROFILE_AUDIO_FRAME_START() g_audio_profiler.start_frame()
#define PROFILE_AUDIO_FRAME_END() g_audio_profiler.end_frame()
#define PROFILE_SPECTRAL_CENTROID(func) g_audio_profiler.profile_spectral_centroid(func)
#define PROFILE_SPECTRAL_FLUX(func) g_audio_profiler.profile_spectral_flux(func)
#define PROFILE_ONSET_DETECTION(func) g_audio_profiler.profile_onset_detection(func)
#define PROFILE_HPSS(func) g_audio_profiler.profile_hpss(func)
#define PROFILE_AROUSAL_VALENCE(func) g_audio_profiler.profile_arousal_valence(func)
#else
#define PROFILE_AUDIO_FRAME_START() ((void)0)
#define PROFILE_AUDIO_FRAME_END() ((void)0)
#define PROFILE_SPECTRAL_CENTROID(func) func()
#define PROFILE_SPECTRAL_FLUX(func) func()
#define PROFILE_ONSET_DETECTION(func) func()
#define PROFILE_HPSS(func) func()
#define PROFILE_AROUSAL_VALENCE(func) func()
#endif
```

**Usage in audio processing code**:
```cpp
void audio_processing_loop() {
    PROFILE_AUDIO_FRAME_START();

    acquire_sample_chunk();

    PROFILE_SPECTRAL_CENTROID([]() {
        calculate_spectral_centroid();
    });

    PROFILE_SPECTRAL_FLUX([]() {
        calculate_spectral_flux();
    });

    PROFILE_ONSET_DETECTION([]() {
        detect_onsets();
    });

    PROFILE_AUDIO_FRAME_END();
}
```

### 2.2 Memory Leak Detector (firmware/src/diagnostics/memory_monitor.h)

```cpp
#pragma once

#include <esp_heap_caps.h>
#include <Arduino.h>

/**
 * Continuous memory monitoring for leak detection.
 */
class MemoryMonitor {
private:
    size_t baseline_free_heap;
    size_t min_free_heap;
    uint32_t sample_count;
    uint32_t leak_warnings;

    static constexpr size_t LEAK_THRESHOLD = 1024;  // 1KB per minute

public:
    MemoryMonitor() :
        baseline_free_heap(0),
        min_free_heap(SIZE_MAX),
        sample_count(0),
        leak_warnings(0) {}

    void start() {
        baseline_free_heap = esp_get_free_heap_size();
        min_free_heap = baseline_free_heap;
        sample_count = 0;
        leak_warnings = 0;

        Serial.printf("[MemoryMonitor] Started monitoring. Baseline: %u bytes\n",
                     baseline_free_heap);
    }

    void sample() {
        sample_count++;
        size_t current_free = esp_get_free_heap_size();

        if (current_free < min_free_heap) {
            min_free_heap = current_free;
        }

        // Check for leak every minute (assuming 100 FPS)
        if (sample_count % 6000 == 0) {
            int32_t delta = (int32_t)baseline_free_heap - (int32_t)current_free;

            if (delta > (int32_t)LEAK_THRESHOLD) {
                leak_warnings++;
                Serial.printf("[MemoryMonitor] ⚠️ Potential leak: %d bytes lost in %d minutes\n",
                             delta, sample_count / 6000);
            }
        }
    }

    void print_report() const {
        size_t current_free = esp_get_free_heap_size();
        int32_t delta = (int32_t)baseline_free_heap - (int32_t)current_free;

        Serial.println("\n=== Memory Monitoring Report ===");
        Serial.printf("Baseline: %u bytes\n", baseline_free_heap);
        Serial.printf("Current:  %u bytes\n", current_free);
        Serial.printf("Minimum:  %u bytes\n", min_free_heap);
        Serial.printf("Delta:    %d bytes\n", delta);
        Serial.printf("Samples:  %u\n", sample_count);
        Serial.printf("Duration: %.1f minutes\n", sample_count / 6000.0f);
        Serial.printf("Leak warnings: %u\n", leak_warnings);

        if (leak_warnings > 0) {
            Serial.println("⚠️ Memory leak detected!");
        } else if (delta > 1000) {
            Serial.println("⚠️ Significant memory usage increase");
        } else {
            Serial.println("✅ No memory leaks detected");
        }
        Serial.println("================================\n");
    }

    bool has_leak() const {
        return leak_warnings > 0;
    }
};
```

---

## 3. CI/CD Integration Scripts

### 3.1 Test Result Parser (tools/parse_test_results.py)

```python
#!/usr/bin/env python3
"""
Parse PlatformIO Unity test results and generate summary report.
"""

import re
import sys
import json
import argparse
from pathlib import Path

def parse_unity_output(output_text):
    """Parse Unity test framework output."""

    tests_run = 0
    tests_passed = 0
    tests_failed = 0
    failures = []

    # Unity summary pattern: "X Tests Y Failures Z Ignored"
    summary_match = re.search(r'(\d+)\s+Tests\s+(\d+)\s+Failures\s+(\d+)\s+Ignored', output_text)
    if summary_match:
        tests_run = int(summary_match.group(1))
        tests_failed = int(summary_match.group(2))
        tests_passed = tests_run - tests_failed

    # Extract failure details
    failure_pattern = r'([^:]+):(\d+):(\w+):FAIL:\s*(.+)'
    for match in re.finditer(failure_pattern, output_text):
        failures.append({
            'file': match.group(1),
            'line': int(match.group(2)),
            'test': match.group(3),
            'reason': match.group(4)
        })

    return {
        'tests_run': tests_run,
        'tests_passed': tests_passed,
        'tests_failed': tests_failed,
        'failures': failures
    }

def main():
    parser = argparse.ArgumentParser(description='Parse PlatformIO test results')
    parser.add_argument('test_output_dir', help='Directory containing test output')
    parser.add_argument('--json', help='Output JSON file')
    args = parser.parse_args()

    test_dir = Path(args.test_output_dir)
    if not test_dir.exists():
        print(f"❌ Test output directory not found: {test_dir}")
        sys.exit(1)

    # Find all test output files
    output_files = list(test_dir.glob('**/output.txt'))
    if not output_files:
        print(f"❌ No test output files found in {test_dir}")
        sys.exit(1)

    all_results = {}

    for output_file in output_files:
        test_name = output_file.parent.name
        with open(output_file, 'r') as f:
            output_text = f.read()

        results = parse_unity_output(output_text)
        all_results[test_name] = results

    # Print summary
    total_run = sum(r['tests_run'] for r in all_results.values())
    total_passed = sum(r['tests_passed'] for r in all_results.values())
    total_failed = sum(r['tests_failed'] for r in all_results.values())

    print("\n=== Test Summary ===")
    print(f"Total: {total_run}")
    print(f"Passed: {total_passed}")
    print(f"Failed: {total_failed}")
    print(f"Success Rate: {100.0 * total_passed / total_run:.1f}%")

    if total_failed > 0:
        print("\n=== Failures ===")
        for test_name, results in all_results.items():
            if results['tests_failed'] > 0:
                print(f"\n{test_name}:")
                for failure in results['failures']:
                    print(f"  {failure['test']}: {failure['reason']}")

    # Write JSON output
    if args.json:
        with open(args.json, 'w') as f:
            json.dump(all_results, f, indent=2)
        print(f"\n✅ Results written to {args.json}")

    # Exit with failure if any tests failed
    sys.exit(1 if total_failed > 0 else 0)

if __name__ == '__main__':
    main()
```

### 3.2 Benchmark Comparison Tool (tools/compare_benchmarks.sh)

```bash
#!/bin/bash
# Compare performance benchmarks between two commits

set -e

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <baseline_commit> <current_commit>"
    exit 1
fi

BASELINE_COMMIT=$1
CURRENT_COMMIT=$2

echo "📊 Comparing performance: $BASELINE_COMMIT vs $CURRENT_COMMIT"

# Create temp directory for results
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Build and test baseline
echo "▶️  Testing baseline ($BASELINE_COMMIT)..."
git checkout $BASELINE_COMMIT
cd firmware
pio test -e esp32-s3-audio-test -f test_audio_performance > $TEMP_DIR/baseline.log 2>&1
cd ..

# Build and test current
echo "▶️  Testing current ($CURRENT_COMMIT)..."
git checkout $CURRENT_COMMIT
cd firmware
pio test -e esp32-s3-audio-test -f test_audio_performance > $TEMP_DIR/current.log 2>&1
cd ..

# Parse results (assumes test outputs JSON metrics)
python tools/parse_performance_results.py \
    --baseline $TEMP_DIR/baseline.log \
    --current $TEMP_DIR/current.log \
    --output docs/benchmarks/comparison_$(date +%Y%m%d).json

echo "✅ Benchmark comparison complete"
```

---

## 4. Quick Reference: Common Test Patterns

### 4.1 Metronome Beat Phase Test

```cpp
void test_metronome_beat_phase() {
    const float bpm = 120.0f;
    const int duration_s = 10;
    const int length = SAMPLE_RATE * duration_s;
    float signal[length];

    SyntheticSignals::generate_metronome(signal, length, bpm, SAMPLE_RATE);

    init_tempo_goertzel_constants();

    for (int i = 0; i < length; i += 256) {
        memcpy(sample_history, signal + i, 256 * sizeof(float));
        update_tempo();
    }

    uint16_t bpm_bin = find_closest_tempo_bin(bpm);
    float phase = tempi[bpm_bin].phase;

    TEST_ASSERT_IN_RANGE(phase, -M_PI, M_PI);
    TEST_ASSERT_GREATER_THAN(0.5f, tempo_confidence);
}
```

### 4.2 CPU Performance Regression Test

```cpp
void test_cpu_performance_no_regression() {
    const float BASELINE_US = 2000.0f;
    const float TOLERANCE_PCT = 10.0f;

    TestTimer timer;
    const int iterations = 1000;

    timer.start();
    for (int i = 0; i < iterations; i++) {
        acquire_sample_chunk();
        calculate_magnitudes();
        get_chromagram();
        update_tempo();
        run_vu();
    }
    timer.stop();

    float avg_us = timer.elapsed_us() / iterations;

    TEST_ASSERT_LESS_THAN(BASELINE_US * (1.0f + TOLERANCE_PCT / 100.0f), avg_us);
}
```

### 4.3 Memory Leak Detection Test

```cpp
void test_no_memory_leak_10_minutes() {
    MemorySnapshot start = MemorySnapshot::capture();

    // Run for 10 minutes at 100 FPS
    const int frames = 10 * 60 * 100;
    for (int i = 0; i < frames; i++) {
        acquire_sample_chunk();
        calculate_magnitudes();
        get_chromagram();
        update_tempo();
        run_vu();
        vTaskDelay(pdMS_TO_TICKS(10));  // 100 FPS
    }

    MemorySnapshot end = MemorySnapshot::capture();

    // Allow 1KB tolerance
    TEST_ASSERT_NO_MEMORY_LEAK(start.free_heap, end.free_heap, 1024);
}
```

---

## 5. Testing Checklist

Use this checklist for each phase:

```markdown
## Phase X Test Completion Checklist

### Unit Tests
- [ ] All new feature tests written
- [ ] All tests pass locally
- [ ] Edge cases covered (silence, clipping, rapid changes)
- [ ] Test coverage ≥ 90% for new code

### Performance Tests
- [ ] CPU usage measured and within budget
- [ ] Memory usage measured and within budget
- [ ] FPS remains ≥ 100
- [ ] No memory leaks in 10-minute test
- [ ] Performance baseline updated

### Integration Tests
- [ ] Audio pipeline end-to-end test passes
- [ ] Pattern rendering with new features works
- [ ] No race conditions detected
- [ ] Latency < 50ms verified

### Real-World Validation
- [ ] Tested with all 5 genre samples
- [ ] Visual synchronization verified
- [ ] User acceptance testing completed (if applicable)
- [ ] No visual glitches or artifacts

### CI/CD
- [ ] All tests pass in GitHub Actions
- [ ] Performance regression check passes
- [ ] Documentation updated
- [ ] Code review approved
```

---

## End of Document

**Usage**: Copy templates from this document into your test files, customize for specific features, and follow the testing strategy defined in `/docs/04-planning/audio_enhancement_test_strategy.md`.

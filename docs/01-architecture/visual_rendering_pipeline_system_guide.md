# Visual Rendering Pipeline System Guide

**Version:** 1.0
**Date:** 2025-12-05
**Status:** Active
**Owner:** System Architecture
**Scope:** K1.node1 Firmware - Visual Rendering & LED Transmission

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Pipeline Stages](#pipeline-stages)
4. [Pattern Rendering](#pattern-rendering)
5. [Color Processing](#color-processing)
6. [Quantization & Dithering](#quantization--dithering)
7. [LED Transmission](#led-transmission)
8. [Performance Characteristics](#performance-characteristics)
9. [Testing & Validation](#testing--validation)
10. [References](#references)

---

## Executive Summary

The **Visual Rendering Pipeline** transforms audio-reactive pattern algorithms into physical LED output on dual WS2812B strips. It runs at **90-250 FPS** on Core 1 (GPU Task), completely decoupled from the audio processing pipeline on Core 0.

### Key Features

- **High-performance rendering** - 90-250 FPS sustained framerate
- **Lock-free audio access** - Zero blocking on audio data reads
- **Dual-channel LED output** - 160 LEDs × 2 channels via FastLED
- **Color processing pipeline** - Warmth, white balance, gamma, tone mapping
- **Temporal dithering** - Error diffusion across frames for smooth gradients
- **Center-origin architecture** - All effects radiate from physical center point
- **Frame pacing** - Configurable minimum frame period for EMI reduction

### Critical Path

```
Pattern Render → Color Pipeline → Quantize/Dither → LED Transmission
   (~1-5ms)        (~500μs)         (~500μs)          (~2-5ms)
```

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ESP32-S3 CORE 1 (GPU Task)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   loop_gpu() @ ~100-250 FPS                  │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │                                                              │  │
│  │  1. Get Audio Snapshot                                       │  │
│  │     └─ get_audio_snapshot(&audio) [lock-free, Core 0→1]     │  │
│  │                                                              │  │
│  │  2. Create Render Context                                    │  │
│  │     └─ PatternRenderContext(leds, time, params, audio)      │  │
│  │                                                              │  │
│  │  3. Pattern Execution                    [1-5ms]            │  │
│  │     └─ draw_current_pattern(context)                        │  │
│  │         └─ Writes to leds[160] (CRGBF float buffer)         │  │
│  │                                                              │  │
│  │  4. Color Pipeline                       [~500μs]           │  │
│  │     ├─ Image LPF (softness blur)                            │  │
│  │     ├─ Tone mapping (HDR soft clip)                         │  │
│  │     ├─ Warmth (incandescent blend)                          │  │
│  │     ├─ White balance                                        │  │
│  │     ├─ Master brightness                                    │  │
│  │     └─ Gamma correction (γ=2.0)                             │  │
│  │                                                              │  │
│  │  5. Quantization & Dithering             [~500μs]           │  │
│  │     ├─ Apply global brightness scale                        │  │
│  │     ├─ Apply led_offset (circular buffer shift)             │  │
│  │     ├─ Float32→Uint8 conversion                             │  │
│  │     └─ Temporal dithering (error accumulation)              │  │
│  │         └─ Writes to fastled_leds[160] (CRGB byte buffer)   │  │
│  │                                                              │  │
│  │  6. LED Transmission                     [2-5ms]            │  │
│  │     └─ FastLED.show() → Dual RMT channels                   │  │
│  │         ├─ GPIO 5: Channel A (160 LEDs)                     │  │
│  │         └─ GPIO 4: Channel B (160 LEDs duplicate)           │  │
│  │                                                              │  │
│  │  7. Frame Pacing                                             │  │
│  │     └─ vTaskDelay if elapsed < min_period                   │  │
│  │                                                              │  │
│  │  8. FPS Tracking                                             │  │
│  │     └─ watch_cpu_fps() + print_fps()                        │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

         ▼                                    ▼
    ┌─────────┐                        ┌─────────┐
    │ GPIO 5  │ ──── WS2812B ────▶     │ 160 LEDs│ (Primary)
    └─────────┘                        └─────────┘

    ┌─────────┐                        ┌─────────┐
    │ GPIO 4  │ ──── WS2812B ────▶     │ 160 LEDs│ (Secondary/Mirror)
    └─────────┘                        └─────────┘
```

### Data Flow: Float Buffer → Byte Buffer → Physical LEDs

```
PATTERN DOMAIN          COLOR PIPELINE         QUANTIZATION        TRANSMISSION
(Float32 CRGBF)        (Float32 CRGBF)       (Uint8 CRGB)        (Physical)
─────────────────      ─────────────────     ─────────────       ────────────

leds[0..159]     ─┬─►  Softness LPF    ─┐
                  │    Tone Mapping      │
Pattern writes    │    Warmth Blend      ├─►  global_brightness
RGB floats        │    White Balance     │    led_offset remap
(0.0 - 1.0+)      │    Master Brightness │    Float→Uint8
                  │    Gamma (γ=2.0)     │    Temporal Dither  ──► FastLED
                  │                      │                         RMT DMA
                  └────────────────────────►  fastled_leds[0..159]  GPIO 5+4
                       (in-place ops)         (clamped 0-255)       (WS2812B)
```

---

## Pipeline Stages

### Stage 1: Audio Snapshot Acquisition

**File:** [firmware/src/main.cpp:683-685](../../firmware/src/main.cpp#L683-L685)

```cpp
AudioDataSnapshot audio_snapshot;
get_audio_snapshot(&audio_snapshot);
PatternRenderContext context(leds, NUM_LEDS, time, params, audio_snapshot);
```

**Purpose:** Retrieve thread-safe audio data from Core 0.

**Mechanism:**
- Lock-free seqlock read from `audio_front` buffer
- Typical latency: 10-20μs
- Automatic retry on torn reads (max 50 retries)
- See [Audio Sync Layer Guide](audio_sync_layer_system_guide.md) for details

**Output:** `PatternRenderContext` with audio data, time, and parameters

### Stage 2: Pattern Execution

**Files:**
- [firmware/src/pattern_execution.cpp:16-18](../../firmware/src/pattern_execution.cpp#L16-L18)
- [firmware/src/pattern_registry.cpp](../../firmware/src/pattern_registry.cpp)

```cpp
void draw_current_pattern(const PatternRenderContext& context) {
    g_pattern_registry[g_current_pattern_index].draw_fn(context);
}
```

**Purpose:** Execute selected pattern algorithm.

**Input:** `PatternRenderContext`
```cpp
struct PatternRenderContext {
    CRGBF* const leds;              // Output buffer (160 floats)
    const int num_leds;             // 160
    const float time;               // Animation time (seconds)
    const PatternParameters& params; // User settings
    const AudioDataSnapshot& audio_snapshot; // Audio data
};
```

**Output:** `leds[0..159]` populated with RGB float values (0.0 to 1.0+)

**Pattern Types:**
- **Audio-reactive** - Use `PATTERN_AUDIO_START()` macro for snapshot access
- **Time-based** - Use `time` parameter for animations
- **Hybrid** - Combine both approaches

**Example Pattern:**
```cpp
void draw_spectrum_bars(const PatternRenderContext& context) {
    PATTERN_AUDIO_START();  // Creates 'audio' snapshot

    for (int i = 0; i < context.num_leds; i++) {
        float position = (float)i / context.num_leds;
        int bin = (int)(position * 63);
        float magnitude = AUDIO_SPECTRUM[bin];

        context.leds[i] = hsv(position, 1.0f, magnitude);
    }
}
```

**Performance:**
- Simple patterns: 100-500μs
- Complex patterns: 1-5ms
- Audio-reactive overhead: 10-20μs (snapshot copy)

### Stage 3: Color Processing Pipeline

**Files:**
- [firmware/src/color_pipeline.cpp](../../firmware/src/color_pipeline.cpp)
- [firmware/src/color_pipeline.h](../../firmware/src/color_pipeline.h)

```cpp
void apply_color_pipeline(const PatternParameters& params);
```

**Purpose:** Apply perceptual color corrections for display quality.

**Processing Order (MANDATORY):**
```
1. Image LPF (softness)
   └─ IIR low-pass filter across frames for motion blur

2. Tone Mapping (HDR → SDR)
   └─ Soft clip values >0.75 using tanh() for HDR rolloff

3. Warmth (incandescent blend)
   └─ Linear blend toward warm orange (1.0, 0.4452, 0.1562)

4. White Balance
   └─ Per-channel multiply (1.0, 0.9375, 0.84) - reduce blue

5. Master Brightness
   └─ Scale by (0.3 + 0.7 * brightness) - ensures minimum visibility

6. Gamma Correction (γ = 2.0)
   └─ Perceptual brightness mapping: out = in^2.0
```

**Details:**

#### Image LPF (Softness Blur)
```cpp
// Single-pole IIR filter with legacy cutoff mapping
float cutoff = 0.5f + (1.0f - sqrt(softness)) * 14.5f;  // 0.5..15.0 Hz
float alpha = 1.0f - exp(-2π * cutoff / REFERENCE_FPS);
for each LED:
    output = current * alpha + previous * (1 - alpha)
```
- **Purpose:** Motion blur, temporal anti-aliasing
- **Range:** softness 0.0 = sharp, 1.0 = heavily blurred
- **Overhead:** ~100μs (single-pass IIR)

#### Tone Mapping (HDR Soft Clip)
```cpp
float soft_clip_hdr(float v) {
    if (v < 0.75f) return v;
    float t = (v - 0.75f) * 4.0f;
    return 0.75f + 0.25f * tanh(t);  // Asymptotic approach to 1.0
}
```
- **Purpose:** Prevent hard clipping on bright audio peaks
- **Behavior:** Values <0.75 pass through, >0.75 compress smoothly
- **Overhead:** ~50μs

#### Warmth (Incandescent Blend)
```cpp
// Blend toward warm orange/amber
const CRGBF incandescent = CRGBF(1.0f, 0.4452f, 0.1562f);
for each LED:
    leds[i].r *= (incandescent.r * warmth + (1 - warmth))
    leds[i].g *= (incandescent.g * warmth + (1 - warmth))
    leds[i].b *= (incandescent.b * warmth + (1 - warmth))
```
- **Purpose:** Shift toward warm/cozy color temperature
- **Range:** warmth 0.0 = neutral, 1.0 = full incandescent
- **Overhead:** ~100μs

#### White Balance
```cpp
// Reduce blue, slightly reduce green
const CRGBF white_balance = CRGBF(1.0f, 0.9375f, 0.84f);
for each LED:
    leds[i] *= white_balance  // Component-wise multiply
```
- **Purpose:** Correct WS2812B's natural blue bias
- **Effect:** Warmer whites, less harsh blue
- **Overhead:** ~50μs

#### Master Brightness
```cpp
float master = 0.3f + 0.7f * brightness;  // Range: 0.3..1.0
for each LED:
    leds[i] *= master
```
- **Purpose:** Global brightness control with minimum floor
- **Floor:** 0.3 ensures patterns remain visible even at low settings
- **Overhead:** ~50μs

#### Gamma Correction (γ = 2.0)
```cpp
for each LED:
    leds[i].r = pow(leds[i].r, 2.0f)
    leds[i].g = pow(leds[i].g, 2.0f)
    leds[i].b = pow(leds[i].b, 2.0f)
```
- **Purpose:** Perceptual brightness mapping (linear→perceived)
- **Effect:** Darker values stay visible, highlights compress
- **Overhead:** ~150μs (3 pow() calls per LED × 160)

**Total Color Pipeline Overhead:** ~500μs

---

## Pattern Rendering

### Pattern Architecture

#### Center-Origin Design (MANDATORY)

**Definition:** All visual effects MUST radiate from the physical center point.

**Physical Layout:**
```
LED Index:  0 ────────────────► 79 (CENTER) ◄──────────────── 159
Position:   Left Edge          Center Point         Right Edge
            ←─ 80 LEDs ─→      Physical            ←─ 80 LEDs ─→
                              Midpoint
```

**Constants (Compile-Time Enforced):**
```cpp
#define NUM_LEDS          160
#define STRIP_CENTER_POINT 79   // Physical center LED (NUM_LEDS/2 - 1)
#define STRIP_HALF_LENGTH  80   // Distance from center to edge
#define STRIP_LENGTH      160   // Total span (must equal NUM_LEDS)

static_assert(STRIP_LENGTH == NUM_LEDS, "STRIP_LENGTH must equal NUM_LEDS");
static_assert(STRIP_CENTER_POINT == (NUM_LEDS/2 - 1), "Center must be NUM_LEDS/2 - 1");
```

**Design Rules:**
- ✅ **DO** use radial/symmetric effects from center
- ✅ **DO** use `STRIP_CENTER_POINT` for center-origin math
- ✅ **DO** mirror effects across center
- ❌ **DON'T** use edge-to-edge linear effects (rainbows, gradients)
- ❌ **DON'T** hardcode center index (use constant)

**Example: Center-Origin Pattern**
```cpp
void draw_radial_pulse(const PatternRenderContext& context) {
    PATTERN_AUDIO_START();
    float beat = AUDIO_VU;

    for (int i = 0; i < NUM_LEDS; i++) {
        // Calculate distance from center (0.0 at center, 1.0 at edges)
        float dist_from_center = abs(i - STRIP_CENTER_POINT) / (float)STRIP_HALF_LENGTH;

        // Radial pulse expands from center
        float phase = context.time * 2.0f - dist_from_center * 6.28f;
        float brightness = (sin(phase) * 0.5f + 0.5f) * beat;

        context.leds[i] = hsv(0.6f, 1.0f, brightness);
    }
}
```

### Pattern Context API

**PatternRenderContext** provides clean access to all render state:

```cpp
struct PatternRenderContext {
    CRGBF* const leds;              // Output: Write RGB floats here
    const int num_leds;             // Always 160
    const float time;               // Animation time (seconds since boot)
    const PatternParameters& params; // User-configurable settings
    const AudioDataSnapshot& audio_snapshot; // Audio data from Core 0
};
```

**Usage:**
```cpp
void my_pattern(const PatternRenderContext& context) {
    // Access members directly
    float speed = context.params.speed;
    float hue = context.params.hue;

    // Use audio data via macros
    PATTERN_AUDIO_START();
    float bass = AUDIO_BASS();

    // Write to LED buffer
    for (int i = 0; i < context.num_leds; i++) {
        context.leds[i] = CRGBF(1.0f, 0.0f, 0.0f);
    }
}
```

### Pattern Parameters

**Available Settings:**
```cpp
struct PatternParameters {
    // Visual
    float brightness;          // Master brightness (0.0-1.0)
    float speed;               // Animation speed multiplier
    float hue;                 // Base hue shift (0.0-1.0)
    float saturation;          // Base saturation (0.0-1.0)

    // Color Processing
    float warmth;              // Incandescent blend (0.0-1.0)
    float softness;            // Motion blur amount (0.0-1.0)
    float dithering;           // Temporal dither (0.0-1.0, ≥0.5 enables)

    // Audio Reactivity
    float audio_sensitivity;   // VU scale multiplier
    float color_reactivity;    // Audio→color modulation
    float brightness_floor;    // Minimum brightness (0.0-1.0)
    float bass_treble_balance; // -1.0=bass, 0=flat, +1.0=treble
    float beat_threshold;      // Beat detection threshold (0.0-1.0)
    float beat_squash_power;   // Beat density compression (0.2-1.0)

    // Layout
    float led_offset;          // Circular buffer shift (pixels)
    float frame_min_period_ms; // Minimum frame period for FPS cap
};
```

---

## Quantization & Dithering

### Float → Byte Conversion

**File:** [firmware/src/led_driver.cpp:56-160](../../firmware/src/led_driver.cpp#L56-L160)

**Purpose:** Convert float RGB (0.0-1.0+) to byte RGB (0-255) for WS2812B output.

**Process:**
```
1. Apply global_brightness scale (0.0-1.0)
2. Apply led_offset circular buffer shift
3. Convert Float32 → Uint8 with dithering (if enabled)
4. Write to fastled_leds[] buffer
```

### Temporal Dithering

**Algorithm:** Error-diffusion dithering across frames

**Purpose:** Smooth gradients in low-brightness regions where 8-bit quantization causes banding.

**Mechanism:**
```cpp
// Per-LED error accumulator (persistent across frames)
CRGBF dither_error[NUM_LEDS];

for each LED:
    float dec = leds[i].r * brightness_scale;  // e.g., 12.7
    uint8_t out = (uint8_t)dec;                 // Floor: 12
    float error = dec - (float)out;             // Error: 0.7

    if (error >= 0.055f) {  // Threshold to reduce noise
        dither_error[i].r += error;
    }

    if (dither_error[i].r >= 1.0f) {
        out += 1;                    // Bump up by 1 on this frame
        dither_error[i].r -= 1.0f;   // Consume accumulated error
    }

    fastled_leds[i].r = out;
```

**Example:**
```
Frame  | Float | Floor | Error | Accum | Output
-------|-------|-------|-------|-------|-------
  1    | 12.7  |  12   | 0.7   | 0.7   |  12
  2    | 12.7  |  12   | 0.7   | 1.4   |  13  ← Bump
  3    | 12.7  |  12   | 0.7   | 1.1   |  13  ← Bump
  4    | 12.7  |  12   | 0.7   | 0.8   |  12
  ...  (cycles between 12 and 13 at ~40% duty)
```

**Benefits:**
- Smooth gradients in dark regions (0-10% brightness)
- Reduces color banding artifacts
- Temporal averaging appears as intermediate brightness to human eye

**Overhead:**
- With dithering: ~300-400μs
- Without dithering: ~150-200μs

**Control:**
```cpp
// Enable if params.dithering >= 0.5
bool temporal_dithering = (params.dithering >= 0.5f);
```

### LED Offset (Circular Buffer Shift)

**Purpose:** Rotate entire LED pattern around strip (for alignment/effects).

**Implementation:**
```cpp
static inline uint16_t remap_led_index(uint16_t logical_index, int16_t offset_px) {
    int32_t idx = logical_index + offset_px;
    idx %= NUM_LEDS;
    if (idx < 0) idx += NUM_LEDS;
    return (uint16_t)idx;
}

// During quantization:
for (uint16_t i = 0; i < NUM_LEDS; i++) {
    uint16_t src_idx = remap_led_index(i, led_offset);
    fastled_leds[i] = quantize(leds[src_idx]);
}
```

**Use Cases:**
- Physical strip alignment (if center doesn't match LED 79)
- Pattern rotation effects
- Visual fine-tuning

---

## LED Transmission

### FastLED Integration

**File:** [firmware/src/led_driver.cpp:25-44](../../firmware/src/led_driver.cpp#L25-L44)

**Initialization:**
```cpp
void init_rmt_driver() {
    // Dual-channel parallel output (FastLED 3.9+ on ESP32-S3)
    FastLED.addLeds<WS2812B, LED_DATA_PIN, GRB>(fastled_leds, NUM_LEDS);    // GPIO 5
    FastLED.addLeds<WS2812B, LED_DATA_PIN_2, GRB>(fastled_leds, NUM_LEDS);  // GPIO 4

    // Manual brightness control (handled in quantization)
    FastLED.setBrightness(255);

    // Disable FastLED corrections (we handle color pipeline ourselves)
    FastLED.setCorrection(UncorrectedColor);
    FastLED.setDither(false);

    // Clear buffers
    memset(leds, 0, sizeof(leds));
    memset(fastled_leds, 0, sizeof(fastled_leds));
}
```

**Transmission:**
```cpp
void transmit_leds() {
    // 1. Quiet skip (EMI reduction during silence)
    if (audio_level < QUIET_VU_THRESH && quiet_frames >= QUIET_SKIP_FRAMES) {
        vTaskDelay(pdMS_TO_TICKS(1));
        return;
    }

    // 2. Quantize + Dither (see previous section)
    // ...

    // 3. Transmit via RMT DMA
    FastLED.show();  // Blocks until transmission complete (~2-5ms)

    // 4. Frame pacing
    if (elapsed < min_period) {
        vTaskDelay((min_period - elapsed) / 1000);
    }
}
```

### WS2812B Protocol

**Timing (800 kHz):**
- Bit 0: 0.4μs high, 0.85μs low (total 1.25μs)
- Bit 1: 0.8μs high, 0.45μs low (total 1.25μs)
- Reset: >50μs low

**Transmission Time:**
- Per LED: 24 bits × 1.25μs = 30μs
- 160 LEDs: 30μs × 160 = 4.8ms
- Reset: +50μs
- **Total: ~4.85ms per channel**

**Dual-Channel Parallel:**
- Both channels transmit simultaneously via separate RMT peripherals
- Total wall time: ~4.85ms (not 9.7ms)
- Effective throughput: 320 LEDs in 4.85ms

### Quiet Skip (EMI Reduction)

**Purpose:** Reduce electromagnetic interference when LEDs are static.

**Logic:**
```cpp
#define QUIET_VU_THRESH 0.01f     // VU level threshold
#define QUIET_SKIP_FRAMES 10      // Consecutive quiet frames before skip

static uint8_t quiet_frames = 0;

if (audio_level < QUIET_VU_THRESH) {
    quiet_frames++;
} else {
    quiet_frames = 0;
}

if (quiet_frames >= QUIET_SKIP_FRAMES) {
    vTaskDelay(pdMS_TO_TICKS(1));  // Yield instead of transmit
    return;
}
```

**Behavior:**
- If audio is silent (<1% VU) for 10+ frames (100ms @ 100 FPS)
- Stop transmitting to LEDs (they hold previous state)
- Reduces RMT activity and EMI noise

**Exit Condition:**
- Any audio above threshold resets counter and resumes transmission

### Frame Pacing

**Purpose:** Cap maximum FPS to reduce power/EMI/thermal load.

**Implementation:**
```cpp
uint32_t min_period_us = (uint32_t)(params.frame_min_period_ms * 1000.0f);
static uint32_t last_frame_start_us = 0;

uint32_t elapsed_us = micros() - last_frame_start_us;
if (elapsed_us < min_period_us) {
    uint32_t delay_ms = (min_period_us - elapsed_us + 999) / 1000;
    vTaskDelay(pdMS_TO_TICKS(delay_ms));
}
last_frame_start_us = micros();
```

**Use Cases:**
- Set `frame_min_period_ms = 16.67` → ~60 FPS cap
- Set `frame_min_period_ms = 10.0` → ~100 FPS cap
- Set `frame_min_period_ms = 0.0` → Uncapped (250+ FPS)

**Default:** 0.0ms (no cap, run at maximum performance)

---

## Performance Characteristics

### Timing Breakdown (Typical Frame @ 100 FPS)

| Stage | Duration | Percentage | Notes |
|-------|----------|------------|-------|
| **Audio Snapshot** | 10-20μs | <1% | Lock-free seqlock read |
| **Pattern Render** | 1-5ms | 10-50% | Varies by pattern complexity |
| **Color Pipeline** | ~500μs | 5% | LPF, tone map, warmth, gamma |
| **Quantization** | 150-400μs | 1.5-4% | With/without dithering |
| **LED Transmission** | 2-5ms | 20-50% | RMT DMA + blocking |
| **Frame Pacing** | 0-10ms | 0-100% | If min_period set |
| **FPS Tracking** | <10μs | <1% | Minimal overhead |
| **TOTAL** | **4-11ms** | **100%** | **90-250 FPS** |

### Performance Modes

#### Maximum Performance (Default)
```
- frame_min_period_ms: 0.0
- Actual FPS: 150-250 FPS
- Frame time: 4-7ms
- Pattern budget: 1-2ms
- LED transmission: 4.85ms
```

#### Balanced Mode
```
- frame_min_period_ms: 10.0
- Target FPS: 100 FPS
- Frame time: 10ms
- Pattern budget: 5ms
- LED transmission: 4.85ms
```

#### Power Saver Mode
```
- frame_min_period_ms: 33.33
- Target FPS: 30 FPS
- Frame time: 33ms
- Pattern budget: 28ms
- LED transmission: 4.85ms
```

### CPU Usage (ESP32-S3 @ 240 MHz)

| Task | Core | CPU % (Avg) | CPU % (Peak) |
|------|------|-------------|--------------|
| GPU Task (Rendering) | 1 | 40-60% | 80% |
| Audio Task | 0 | 60-75% | 90% |
| WiFi/HTTP/OTA | Both | 5-15% | 30% |
| Idle | Both | 10-20% | - |

### Memory Usage

| Component | Type | Size | Notes |
|-----------|------|------|-------|
| `leds[]` | CRGBF | 1,920 bytes | 160 × 12 bytes |
| `fastled_leds[]` | CRGB | 480 bytes | 160 × 3 bytes |
| `dither_error[]` | CRGBF | 1,920 bytes | 160 × 12 bytes |
| FastLED RMT buffers | Internal | ~8 KB | Allocated by FastLED |
| **Total Rendering** | | **~12 KB** | |

### FPS Metrics Collection

**Enabled with `FRAME_METRICS_ENABLED=1`:**
```cpp
struct FrameMetrics {
    uint32_t render_us;    // Pattern + color pipeline
    uint32_t quantize_us;  // Quantization + dithering
    uint32_t wait_us;      // RMT wait time
    uint32_t transmit_us;  // LED transmission
    uint16_t fps_x100;     // FPS × 100 (e.g., 12045 = 120.45 FPS)
};
```

**Access:**
```cpp
FrameMetricsBuffer::instance().record_frame(render_us, quant_us, wait_us, tx_us, fps);
```

**Export:** Available via REST API `/api/metrics/frames` for analysis

---

## Testing & Validation

### Unit Tests

**Pattern Rendering:**
```cpp
void test_pattern_center_origin() {
    PatternRenderContext ctx(leds, NUM_LEDS, 0.0f, default_params, audio_snapshot);

    // Draw radial pattern
    draw_radial_pulse(ctx);

    // Validate symmetry around center
    for (int i = 0; i < STRIP_HALF_LENGTH; i++) {
        int left_idx = STRIP_CENTER_POINT - i;
        int right_idx = STRIP_CENTER_POINT + i;

        // Colors should be symmetric (within tolerance)
        assert_approx_equal(leds[left_idx].r, leds[right_idx].r, 0.01f);
        assert_approx_equal(leds[left_idx].g, leds[right_idx].g, 0.01f);
        assert_approx_equal(leds[left_idx].b, leds[right_idx].b, 0.01f);
    }
}
```

**Color Pipeline:**
```cpp
void test_color_pipeline_order() {
    // Setup test input
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGBF(0.5f, 0.5f, 0.5f);
    }

    PatternParameters params;
    params.softness = 0.0f;
    params.warmth = 0.5f;
    params.brightness = 1.0f;

    apply_color_pipeline(params);

    // Validate warmth applied (should reduce green/blue)
    assert(leds[0].r > leds[0].g);
    assert(leds[0].g > leds[0].b);

    // Validate gamma applied (should darken from 0.5)
    assert(leds[0].r < 0.5f);
}
```

**Quantization:**
```cpp
void test_temporal_dithering() {
    // Clear dither error
    memset(dither_error, 0, sizeof(dither_error));

    // Set fractional brightness (12.7 / 255)
    leds[0] = CRGBF(12.7f / 255.0f, 0.0f, 0.0f);

    // Run quantization multiple frames
    uint8_t outputs[10];
    for (int frame = 0; frame < 10; frame++) {
        transmit_leds();  // Includes quantization
        outputs[frame] = fastled_leds[0].r;
    }

    // Should oscillate between 12 and 13
    int count_12 = 0, count_13 = 0;
    for (int i = 0; i < 10; i++) {
        if (outputs[i] == 12) count_12++;
        if (outputs[i] == 13) count_13++;
    }

    // Expect ~60% 12, ~40% 13 (duty cycle matches 0.7 fractional)
    assert(count_12 >= 4 && count_12 <= 8);
    assert(count_13 >= 2 && count_13 <= 6);
}
```

### Integration Tests

**Full Pipeline Validation:**
```cpp
void test_full_render_pipeline() {
    // Setup
    init_rmt_driver();
    init_pattern_registry();

    // Run 100 frames
    for (int frame = 0; frame < 100; frame++) {
        float time = frame * 0.01f;  // 100 FPS

        // Get audio snapshot
        AudioDataSnapshot audio;
        get_audio_snapshot(&audio);

        // Create context
        PatternParameters params = get_params();
        PatternRenderContext ctx(leds, NUM_LEDS, time, params, audio);

        // Render
        draw_current_pattern(ctx);

        // Color pipeline
        apply_color_pipeline(params);

        // Transmit
        transmit_leds();

        // Validate no NaN/Inf
        for (int i = 0; i < NUM_LEDS; i++) {
            assert(!isnan(leds[i].r));
            assert(!isnan(leds[i].g));
            assert(!isnan(leds[i].b));
            assert(!isinf(leds[i].r));
            assert(!isinf(leds[i].g));
            assert(!isinf(leds[i].b));
        }
    }
}
```

**Performance Validation:**
```cpp
void test_fps_target() {
    uint32_t start = millis();
    int frames = 0;

    while (millis() - start < 1000) {  // 1 second
        loop_gpu(nullptr);  // Run one GPU frame
        frames++;
    }

    // Should achieve at least 90 FPS
    assert(frames >= 90);

    // Log actual FPS
    LOG_INFO(TAG_TEST, "Achieved %d FPS", frames);
}
```

### Visual Regression Tests

**Pattern Snapshot Comparison:**
```cpp
void test_pattern_regression() {
    // Render reference frame
    PatternRenderContext ctx = create_test_context();
    draw_spectrum_bars(ctx);
    CRGBF reference[NUM_LEDS];
    memcpy(reference, leds, sizeof(leds));

    // Render test frame (after code changes)
    draw_spectrum_bars(ctx);

    // Compare
    float max_diff = 0.0f;
    for (int i = 0; i < NUM_LEDS; i++) {
        float diff_r = fabs(leds[i].r - reference[i].r);
        float diff_g = fabs(leds[i].g - reference[i].g);
        float diff_b = fabs(leds[i].b - reference[i].b);
        max_diff = fmax(max_diff, fmax(diff_r, fmax(diff_g, diff_b)));
    }

    // Allow small floating-point drift
    assert(max_diff < 0.001f);
}
```

---

## References

### Source Files

| File | Description | Lines |
|------|-------------|-------|
| [`firmware/src/led_driver.h`](../../firmware/src/led_driver.h) | LED buffer declarations, constants | 43 |
| [`firmware/src/led_driver.cpp`](../../firmware/src/led_driver.cpp) | Quantization, dithering, transmission | 161 |
| [`firmware/src/pattern_execution.h`](../../firmware/src/pattern_execution.h) | Pattern execution API | 13 |
| [`firmware/src/pattern_execution.cpp`](../../firmware/src/pattern_execution.cpp) | Pattern dispatcher | 47 |
| [`firmware/src/pattern_render_context.h`](../../firmware/src/pattern_render_context.h) | Render context definition | 64 |
| [`firmware/src/pattern_types.h`](../../firmware/src/pattern_types.h) | Pattern function signature | 14 |
| [`firmware/src/color_pipeline.h`](../../firmware/src/color_pipeline.h) | Color processing API | 14 |
| [`firmware/src/color_pipeline.cpp`](../../firmware/src/color_pipeline.cpp) | LPF, tone map, warmth, gamma | 111 |
| [`firmware/src/main.cpp`](../../firmware/src/main.cpp) | GPU task loop | 1200+ |

### Related Documentation

- **Audio Sync Layer:** [`docs/01-architecture/audio_sync_layer_system_guide.md`](audio_sync_layer_system_guide.md)
- **Pattern Audio Interface:** [`firmware/src/pattern_audio_interface.h`](../../firmware/src/pattern_audio_interface.h)
- **Parameters:** [`firmware/src/parameters.h`](../../firmware/src/parameters.h)

### External References

- [FastLED Documentation](https://fastled.io/)
- [WS2812B Datasheet](https://cdn-shop.adafruit.com/datasheets/WS2812B.pdf)
- [ESP32-S3 RMT Peripheral](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/peripherals/rmt.html)
- [Temporal Dithering (Wikipedia)](https://en.wikipedia.org/wiki/Dither)

---

## Appendix A: Color Processing Flowchart

```
INPUT: leds[] (Pattern output, Float32 RGB, 0.0-1.0+)
   │
   ▼
┌──────────────────────────────────────────────────────┐
│  STAGE 1: Image LPF (Motion Blur)                   │
│  ─────────────────────────────────────────           │
│  IIR filter: out = current*α + prev*(1-α)           │
│  Cutoff: 0.5-15.0 Hz (based on softness param)      │
│  Effect: Temporal smoothing, anti-aliasing          │
└──────────────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────────────┐
│  STAGE 2: Tone Mapping (HDR→SDR)                    │
│  ───────────────────────────────                     │
│  if (v < 0.75): pass through                         │
│  else: soft clip using tanh() → max 1.0             │
│  Effect: Prevent hard clipping on bright peaks      │
└──────────────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────────────┐
│  STAGE 3: Warmth (Incandescent Blend)               │
│  ────────────────────────────────────                │
│  Blend toward warm orange: (1.0, 0.45, 0.16)        │
│  Mix amount: warmth parameter (0.0-1.0)             │
│  Effect: Cozy/warm color temperature                │
└──────────────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────────────┐
│  STAGE 4: White Balance                              │
│  ──────────────────────                              │
│  Multiply by (1.0, 0.9375, 0.84)                    │
│  Effect: Reduce blue bias of WS2812B                │
└──────────────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────────────┐
│  STAGE 5: Master Brightness                          │
│  ──────────────────────────                          │
│  Scale by (0.3 + 0.7*brightness)                    │
│  Floor: 30% ensures minimum visibility              │
│  Effect: Global brightness control                  │
└──────────────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────────────┐
│  STAGE 6: Gamma Correction (γ=2.0)                  │
│  ─────────────────────────────────                   │
│  out = in^2.0 for each channel                      │
│  Effect: Perceptual brightness mapping              │
└──────────────────────────────────────────────────────┘
   │
   ▼
OUTPUT: leds[] (Float32 RGB, 0.0-1.0, ready for quantization)
```

---

## Appendix B: Pattern Best Practices

### Performance Optimization

**DO:**
- ✅ Check `AUDIO_IS_FRESH()` and skip redundant rendering
- ✅ Use `AUDIO_IS_STALE()` for silence detection
- ✅ Precompute expensive calculations outside inner loops
- ✅ Use integer math where possible (avoid `sin()`, `cos()` per LED)
- ✅ Cache audio band energies (`AUDIO_BASS()`) instead of recalculating

**DON'T:**
- ❌ Call `AUDIO_BASS()` in inner loop (cache it)
- ❌ Use `pow()`, `exp()`, `log()` per LED unnecessarily
- ❌ Allocate memory dynamically in pattern code
- ❌ Use floating-point division when multiply is sufficient
- ❌ Access audio snapshot without `PATTERN_AUDIO_START()`

### Visual Quality

**DO:**
- ✅ Use smooth transitions (ease-in/out)
- ✅ Apply anti-aliasing for sharp edges
- ✅ Test patterns at low brightness (0.1-0.3)
- ✅ Use HDR values (>1.0) for highlights (tone mapping handles it)
- ✅ Leverage color pipeline (warmth, gamma) instead of manual correction

**DON'T:**
- ❌ Hard-code brightness values (use `params.brightness`)
- ❌ Create sharp discontinuities (causes visible stepping)
- ❌ Ignore center-origin architecture
- ❌ Use full saturation everywhere (reduces dynamic range)
- ❌ Forget to clamp negative values before writing to LEDs

### Code Structure

```cpp
void my_pattern(const PatternRenderContext& context) {
    // 1. Get audio snapshot
    PATTERN_AUDIO_START();

    // 2. Early exit optimization
    if (!AUDIO_IS_FRESH()) return;
    if (AUDIO_IS_STALE()) {
        fade_to_black();
        return;
    }

    // 3. Cache expensive audio calculations
    float bass = AUDIO_BASS();
    float treble = AUDIO_TREBLE();
    float beat = AUDIO_TEMPO_CONFIDENCE;

    // 4. Precompute per-frame values
    float speed_scale = context.params.speed;
    float hue_shift = context.params.hue;

    // 5. Inner loop (minimize work here)
    for (int i = 0; i < context.num_leds; i++) {
        float position = (float)i / context.num_leds;

        // Simple, fast calculations only
        float brightness = bass * position;
        float hue = hue_shift + position;

        context.leds[i] = hsv(hue, 1.0f, brightness);
    }
}
```

---

**End of Document**

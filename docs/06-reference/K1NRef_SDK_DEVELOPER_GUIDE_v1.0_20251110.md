# K1.node1 SDK Developer Guide

**Status**: Production Ready
**Version**: 1.0
**Date**: 2025-11-10
**Owner**: K1 Development Team
**Last Updated**: 2025-11-10

## Table of Contents

1. [Quick Start](#quick-start) - Get your first pattern running in 5 minutes
2. [SDK Overview](#sdk-overview) - Understand the graph system architecture
3. [Graph System Architecture](#graph-system-architecture) - How patterns are built and compiled
4. [Node Type Catalog](#node-type-catalog) - All 38+ node types documented
5. [Code Generation Pipeline](#code-generation-pipeline) - From JSON to executable C++
6. [Pattern Development Workflow](#pattern-development-workflow) - Step-by-step guide
7. [Best Practices](#best-practices) - Performance and correctness guidelines
8. [API Reference](#api-reference) - REST and WebSocket APIs
9. [Troubleshooting](#troubleshooting) - Common issues and solutions
10. [Advanced Topics](#advanced-topics) - Custom nodes and extensions

---

## Quick Start

### 5-Minute Hello World Pattern

Get a basic pattern running on device in 5 minutes.

#### Step 1: Create Pattern Definition (30 seconds)

Create `hello_world_pattern.json`:

```json
{
  "pattern": {
    "name": "hello_world",
    "version": "1.0",
    "description": "Simple test pattern - fills all LEDs with a color"
  },
  "nodes": [
    {
      "id": "color_init",
      "type": "calculation",
      "name": "Initialize Color",
      "logic": {
        "color_val": "0.5f"
      },
      "outputs": {
        "color": "float"
      }
    },
    {
      "id": "render_loop",
      "type": "loop",
      "name": "Fill LED Buffer",
      "range": "0 to NUM_LEDS",
      "body": [
        {
          "id": "led_assign",
          "type": "output",
          "name": "Assign Color to LED",
          "logic": {
            "op": "leds[i] = CRGBF(0.5f, 0.0f, 0.0f)"
          }
        }
      ]
    }
  ],
  "flow": [
    "color_init -> render_loop",
    "render_loop[0..NUM_LEDS] -> led_assign"
  ]
}
```

#### Step 2: Generate C++ Code (1 minute)

```bash
cd firmware/src/graph_codegen
g++ -std=c++17 spectrum_codegen.cpp -o codegen
./codegen ../generated_patterns/hello_world_pattern.json > hello_world_generated.h
```

#### Step 3: Include in Firmware (1 minute)

In `firmware/src/patterns.h`:

```cpp
#include "graph_codegen/hello_world_generated.h"

void draw_hello_world(uint32_t time, CRGBF* leds, const PatternParameters& params) {
    draw_hello_world_generated(time, leds, params);
}
```

#### Step 4: Register Pattern (1.5 minutes)

In `firmware/src/pattern_registry.cpp`:

```cpp
PatternInfo hello_world = {
    .name = "hello_world",
    .id = PATTERN_ID_HELLO_WORLD,
    .draw_fn = draw_hello_world,
    .description = "Hello World - Test Pattern"
};

pattern_registry.register_pattern(hello_world);
```

#### Step 5: Build and Flash (1 minute)

```bash
cd firmware
pio run -e esp32s3 -t upload
```

**Result**: All LEDs fill with red color.

---

## SDK Overview

### What is the Graph System?

The K1.node1 Graph System is a declarative pattern definition language that:

1. **Separates Intent from Implementation**
   - Describe WHAT your pattern does (node graph)
   - Let the compiler handle HOW it does it (code generation)

2. **Enables Safe Composition**
   - Connect nodes with type-safe data flow
   - Compiler validates dependencies before code generation

3. **Optimizes Automatically**
   - Dead code elimination
   - Loop unrolling where beneficial
   - Constant folding and propagation

4. **Simplifies Maintenance**
   - Pattern definition is human-readable JSON
   - Generated C++ is machine-optimized
   - Changes are traceable from JSON to binary

### Core Concepts

#### Node
A single computational unit that transforms inputs to outputs. Examples:
- Audio input (FFT, microphone samples)
- Calculation (magnitude blend, frequency mapping)
- Rendering (color lookup, palette interpolation)
- Output (LED assignment)

#### Graph
A directed acyclic graph (DAG) of nodes connected by data flow edges. Each edge represents a dependency.

#### Pattern
A complete graph definition with metadata, describing a full LED animation. Compiles to a single C++ function.

#### Code Generation
The process of converting a valid graph JSON to optimized C++ code. Includes:
- Syntax validation
- Type checking
- Dependency resolution
- Code emission
- Testing and verification

### Typical Workflow

```
1. Design Pattern
   └─> Sketch nodes on paper or whiteboard

2. Write JSON
   └─> Define pattern JSON with all nodes and data flow

3. Validate Locally
   └─> Use validator tool to check syntax and semantics

4. Generate Code
   └─> Run code generator: JSON → C++

5. Test Generated Code
   └─> Verify output matches expected behavior

6. Integrate with Firmware
   └─> Add to pattern registry, rebuild, test on device

7. Optimize Iteratively
   └─> Profile on device, adjust parameters, regenerate
```

---

## Graph System Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Pattern Definition (JSON)                    │
│                                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │ Metadata │ │  Nodes   │ │   Flow   │ │ Data Flow│             │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
│                                                                    │
└──────────────────────────┬────────────────────────────────────────┘
                           │
                    [JSON Parser]
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Graph Validation & Analysis                         │
│                                                                    │
│  ├─ Syntax Validation (JSON structure)                          │
│  ├─ Node Type Validation (known types)                          │
│  ├─ Data Flow Analysis (inputs/outputs match)                   │
│  ├─ Dependency Resolution (topological sort)                    │
│  └─ Loop Detection (ensure DAG, not cyclic)                     │
│                                                                    │
└──────────────────────────┬────────────────────────────────────────┘
                           │
                    [Code Generator]
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              C++ Code Emission                                   │
│                                                                    │
│  1. Emit function signature                                      │
│  2. For each node in topological order:                          │
│     - Allocate variables for outputs                             │
│     - Emit computation code                                      │
│  3. Add loop structures where needed                             │
│  4. Emit final output assignments                                │
│  5. Add optimizations (fold constants, etc)                      │
│                                                                    │
└──────────────────────────┬────────────────────────────────────────┘
                           │
                    [Generated C++]
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│            Integration & Compilation                             │
│                                                                    │
│  1. Include generated header in firmware                         │
│  2. Register pattern in pattern_registry                         │
│  3. Compile firmware with generated code                         │
│  4. Link and create binary                                       │
│                                                                    │
└──────────────────────────┬────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│            Runtime Execution                                     │
│                                                                    │
│  Device: ESP32-S3                                                │
│  ├─ Pattern draws at ~60fps                                      │
│  ├─ Audio data available (microphone input)                      │
│  ├─ Parameters updated via REST API                              │
│  └─ Telemetry via WebSocket                                      │
│                                                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

```
Input Sources:
  ├─ Audio (FFT, raw samples, envelopes)
  ├─ Time (frame counter, audio age)
  ├─ Parameters (brightness, speed, palette)
  └─ Device State (motion, temperature)

Processing:
  ├─ Audio Processing (filtering, compression)
  ├─ Signal Analysis (envelope detection, beat tracking)
  ├─ Transforms (spatial, temporal, color space)
  └─ Effects (trails, blur, distortion)

Output:
  └─ LED Buffer (NUM_LEDS CRGBF colors)
       └─ Sent to WS2812 via RMT driver
```

### Node Execution Model

Nodes execute in **strict topological order** (dependency-driven):

```
1. Identify all nodes with no dependencies (sources)
2. Execute sources (read from audio, time, parameters)
3. Mark outputs available
4. Identify next nodes with all dependencies satisfied
5. Execute those nodes
6. Repeat until all nodes executed
7. Write final LED buffer

Time Complexity: O(n) where n = number of nodes
Space Complexity: O(n) where n = number of node outputs
```

---

## Node Type Catalog

### Node Type Organization

Nodes are organized into 9 categories:

1. **Audio Input** (5 types) - Read from audio system
2. **Audio Processing** (8 types) - Filter, analyze, transform audio
3. **Signal Processing** (6 types) - DSP operations (FFT, filters, etc)
4. **Temporal** (4 types) - Time-based effects (delay, decay)
5. **Spatial** (5 types) - Position-based transforms
6. **Color** (4 types) - Color space operations
7. **Rendering** (3 types) - LED output operations
8. **Control Flow** (2 types) - Conditional branching
9. **State Management** (2 types) - Stateful operations

### Category 1: Audio Input Nodes

#### 1.1 AudioMicrophone

**Type**: `audio_input`
**Inputs**: None
**Outputs**: `float[]` (raw samples)
**Parameters**:
- `sample_count`: Number of samples to read (default: 512)
- `offset_samples`: Skip first N samples (default: 0)

**Description**: Read raw microphone samples from ADC. Provides direct access to I2S input stream.

**Example**:
```json
{
  "id": "mic_read",
  "type": "audio_input",
  "name": "Read Microphone",
  "operation": "i2s_read(raw_samples, 512)",
  "outputs": {
    "samples": "float[512]"
  }
}
```

**Performance**: <5 microseconds, happens once per frame

**Thread Safety**: Safe from audio thread, samples are snapshot

---

#### 1.2 AudioFFT

**Type**: `audio_input`
**Inputs**: `float[]` (raw samples, optional)
**Outputs**: `float[]` (FFT bins), `float` (raw energy)
**Parameters**:
- `fft_size`: 256, 512, or 1024 (default: 512)
- `window`: "hann", "hamming", "blackman" (default: "hann")

**Description**: Compute FFT of audio samples. Provides frequency-domain representation.

**Example**:
```json
{
  "id": "audio_fft",
  "type": "audio_input",
  "name": "FFT Analysis",
  "operation": "esp_fft_perform(samples, 512)",
  "outputs": {
    "spectrum": "float[256]",
    "energy": "float"
  }
}
```

**Performance**: ~200-300 microseconds (IDF5 FFT optimized for ESP32-S3)

**Compatibility**: Requires IDF5 with DSP library

---

#### 1.3 AudioEnvelope

**Type**: `audio_input`
**Inputs**: `float[]` (samples)
**Outputs**: `float` (envelope value)
**Parameters**:
- `attack_factor`: Attack coefficient (default: 0.95)
- `release_factor`: Release coefficient (default: 0.9)

**Description**: Detect amplitude envelope (peak follower with attack/release).

**Example**:
```json
{
  "id": "envelope",
  "type": "audio_input",
  "name": "Envelope Detector",
  "logic": {
    "max_sample": "find_max(samples, count)",
    "envelope": "max_sample > envelope ? envelope + (max_sample - envelope) * (1.0 - attack_factor) : envelope * release_factor"
  },
  "outputs": {
    "envelope": "float"
  }
}
```

**Performance**: <10 microseconds

---

#### 1.4 AudioRMS

**Type**: `audio_input`
**Inputs**: `float[]` (samples)
**Outputs**: `float` (RMS value)
**Parameters**:
- `smoothing`: Smoothing factor 0.0-1.0 (default: 0.95)

**Description**: Compute RMS (root mean square) energy with exponential smoothing.

**Example**:
```json
{
  "id": "rms",
  "type": "audio_input",
  "name": "RMS Energy",
  "logic": {
    "rms_sq": "rms_sq * smoothing + current_rms_sq * (1.0 - smoothing)",
    "rms": "sqrt(rms_sq)"
  },
  "outputs": {
    "rms": "float"
  }
}
```

---

#### 1.5 AudioBeat

**Type**: `audio_input`
**Inputs**: `float` (energy)
**Outputs**: `bool` (beat detected), `float` (beat strength)
**Parameters**:
- `threshold`: Beat threshold relative to average (default: 1.5)
- `min_interval_ms`: Minimum time between beats (default: 100)

**Description**: Detect beat onsets using energy-based peak detection.

**Example**:
```json
{
  "id": "beat_detect",
  "type": "audio_input",
  "name": "Beat Detection",
  "logic": {
    "beat": "energy > (average_energy * threshold)",
    "strength": "energy / threshold"
  },
  "outputs": {
    "beat_detected": "bool",
    "beat_strength": "float"
  }
}
```

---

### Category 2: Audio Processing Nodes

#### 2.1 AudioFilter

**Type**: `audio_processing`
**Inputs**: `float` (input signal), `float` (cutoff frequency)
**Outputs**: `float` (filtered signal)
**Parameters**:
- `filter_type`: "lowpass", "highpass", "bandpass" (default: "lowpass")
- `order`: Filter order 1-4 (default: 1)

**Description**: Apply IIR filter to signal. Supports low/high/bandpass.

**Example**:
```json
{
  "id": "lowpass",
  "type": "audio_processing",
  "name": "Lowpass Filter",
  "logic": {
    "alpha": "0.2f",
    "filtered": "filtered + alpha * (input - filtered)"
  },
  "outputs": {
    "output": "float"
  }
}
```

---

#### 2.2 AudioCompressor

**Type**: `audio_processing`
**Inputs**: `float` (input), `float` (threshold)
**Outputs**: `float` (compressed)
**Parameters**:
- `threshold`: Threshold level (default: 0.7)
- `ratio`: Compression ratio (default: 4.0)

**Description**: Apply dynamic range compression to limit peaks.

---

#### 2.3 AudioNormalizer

**Type**: `audio_processing`
**Inputs**: `float` (input)
**Outputs**: `float` (normalized 0.0-1.0)
**Parameters**:
- `target_max`: Target maximum (default: 1.0)
- `smoothing`: Response smoothing (default: 0.95)

**Description**: Normalize signal level with automatic gain control.

---

#### 2.4-2.8 Additional Audio Processing

Similar structure for: AudioGate, AudioExpander, AudioDelay, AudioReverb, AudioDistortion

---

### Category 3: Signal Processing Nodes

#### 3.1 SignalInterpolate

**Type**: `signal_processing`
**Inputs**: `float[]` (data), `float` (position 0.0-1.0)
**Outputs**: `float` (interpolated value)
**Parameters**:
- `method`: "linear", "cubic", "sinc" (default: "linear")

**Description**: Interpolate value from array using fractional position.

**Example**:
```json
{
  "id": "freq_interp",
  "type": "signal_processing",
  "name": "Interpolate Spectrum",
  "logic": {
    "progress": "float = i / half_leds",
    "index": "int = progress * num_bins",
    "frac": "progress * num_bins - index",
    "value": "spectrum[index] * (1.0 - frac) + spectrum[index+1] * frac"
  },
  "outputs": {
    "interpolated": "float"
  }
}
```

---

#### 3.2 SignalMagnitude

**Type**: `signal_processing`
**Inputs**: `float` (value)
**Outputs**: `float` (magnitude)
**Parameters**:
- `response`: "linear", "sqrt", "log", "exp" (default: "sqrt")

**Description**: Apply response curve to enhance perceived separation.

---

#### 3.3-3.6 Additional Signal Processing

SignalPhase, SignalConvolve, SignalDerivative, SignalIntegrate

---

### Category 4: Temporal Nodes

#### 4.1 TemporalDecay

**Type**: `temporal`
**Inputs**: `float` (value), `float` (age_ms)
**Outputs**: `float` (decayed)
**Parameters**:
- `half_life_ms`: Time for 50% decay (default: 250)

**Description**: Apply exponential decay based on time elapsed.

**Example**:
```json
{
  "id": "age_decay",
  "type": "temporal",
  "name": "Age-Based Decay",
  "logic": {
    "decay_factor": "1.0 - min(age_ms, half_life_ms) / half_life_ms",
    "output": "input * decay_factor"
  },
  "outputs": {
    "decayed": "float"
  }
}
```

---

#### 4.2 TemporalDelay

**Type**: `temporal`
**Inputs**: `float` (value)
**Outputs**: `float` (delayed value)
**Parameters**:
- `delay_ms`: Delay time
- `buffer_size`: Ring buffer size

**Description**: Delay signal by fixed time with circular buffer.

---

#### 4.3 TemporalSmooth

**Type**: `temporal`
**Inputs**: `float` (value)
**Outputs**: `float` (smoothed)
**Parameters**:
- `smoothing_factor`: 0.0-1.0 (default: 0.95)

**Description**: Exponential smoothing (low-pass filter).

---

#### 4.4 TemporalLag

**Type**: `temporal`
**Inputs**: `float` (value)
**Outputs**: `float` (lagged)
**Parameters**:
- `lag_frames`: Frames to lag (default: 1)

**Description**: Shift signal by N frames using ring buffer.

---

### Category 5: Spatial Nodes

#### 5.1 SpatialMirror

**Type**: `spatial`
**Inputs**: `int` (position), `int` (size)
**Outputs**: `int[]` (mirror positions)
**Parameters**:
- `origin`: "center", "left", "right" (default: "center")

**Description**: Compute mirror positions for symmetrical rendering.

**Example**:
```json
{
  "id": "center_mirror",
  "type": "spatial",
  "name": "Center Mirror",
  "logic": {
    "left": "(NUM_LEDS / 2) - 1 - i",
    "right": "(NUM_LEDS / 2) + i"
  },
  "outputs": {
    "left_index": "int",
    "right_index": "int"
  }
}
```

---

#### 5.2 SpatialBlur

**Type**: `spatial`
**Inputs**: `float[]` (buffer)
**Outputs**: `float[]` (blurred)
**Parameters**:
- `radius`: Blur radius in LEDs (default: 1)
- `strength`: Blur strength 0.0-1.0 (default: 0.5)

**Description**: Apply Gaussian blur to LED buffer.

---

#### 5.3 SpatialWave

**Type**: `spatial`
**Inputs**: `float[]` (buffer)
**Outputs**: `float[]` (propagated)
**Parameters**:
- `wavelength`: Period in LEDs (default: 10)
- `speed`: Motion speed (default: 1)

**Description**: Propagate wave through buffer.

---

#### 5.4-5.5 Additional Spatial

SpatialScroll, SpatialWarp

---

### Category 6: Color Nodes

#### 6.1 ColorLookup

**Type**: `color`
**Inputs**: `float` (position 0.0-1.0), `float` (brightness)
**Outputs**: `CRGBF` (color)
**Parameters**:
- `palette_id`: Palette index
- `hue_shift`: Additional hue rotation (default: 0)

**Description**: Look up color from palette using position and brightness.

**Example**:
```json
{
  "id": "color_lookup",
  "type": "color",
  "name": "Palette Color Lookup",
  "logic": {
    "palette": "get_palette(palette_id)",
    "color": "palette.lookup(progress) * brightness"
  },
  "outputs": {
    "color": "CRGBF"
  }
}
```

---

#### 6.2 ColorBlend

**Type**: `color`
**Inputs**: `CRGBF` (color1), `CRGBF` (color2), `float` (blend_factor)
**Outputs**: `CRGBF` (blended)
**Parameters**: None

**Description**: Linearly interpolate between two colors.

---

#### 6.3 ColorHSV

**Type**: `color`
**Inputs**: `float` (hue 0-360), `float` (sat 0.0-1.0), `float` (val 0.0-1.0)
**Outputs**: `CRGBF` (color)
**Parameters**: None

**Description**: Convert HSV to RGB color.

---

#### 6.4 ColorToGrayscale

**Type**: `color`
**Inputs**: `CRGBF` (color)
**Outputs**: `float` (grayscale 0.0-1.0)
**Parameters**: None

**Description**: Convert color to grayscale using luminance formula.

---

### Category 7: Rendering Nodes

#### 7.1 RenderingAssign

**Type**: `rendering`
**Inputs**: `int` (position), `CRGBF` (color)
**Outputs**: None (side effect: LED buffer modification)
**Parameters**: None

**Description**: Write color to LED buffer at position.

**Example**:
```json
{
  "id": "led_assign",
  "type": "rendering",
  "name": "Assign to LED",
  "logic": {
    "op": "leds[position] = color"
  }
}
```

---

#### 7.2 RenderingFill

**Type**: `rendering`
**Inputs**: `CRGBF` (color), `int` (start), `int` (end)
**Outputs**: None
**Parameters**: None

**Description**: Fill range of LEDs with color.

---

#### 7.3 RenderingAdditive

**Type**: `rendering`
**Inputs**: `int` (position), `CRGBF` (color)
**Outputs**: None
**Parameters**: None

**Description**: Add color to LED using blending mode (additive).

---

### Category 8: Control Flow Nodes

#### 8.1 Conditional

**Type**: `conditional`
**Inputs**: `bool` (condition)
**Outputs**: None (directs flow)
**Parameters**:
- `true_branch`: Target node ID for true condition
- `false_branch`: Target node ID for false condition

**Description**: Branch execution based on boolean condition.

**Example**:
```json
{
  "id": "availability_check",
  "type": "conditional",
  "name": "Check Audio Availability",
  "condition": "!AUDIO_IS_AVAILABLE()",
  "branches": {
    "true": "ambient_fallback",
    "false": "spectrum_render"
  }
}
```

---

#### 8.2 Loop

**Type**: `control_flow`
**Inputs**: `int` (start), `int` (end)
**Outputs**: None (repeats body)
**Parameters**:
- `variable_name`: Loop variable name (default: "i")
- `step`: Increment per iteration (default: 1)

**Description**: Iterate over range, executing body nodes.

**Example**:
```json
{
  "id": "render_loop",
  "type": "loop",
  "name": "Render All LEDs",
  "range": "0 to NUM_LEDS",
  "body": [
    { "id": "color_calc", ... },
    { "id": "led_assign", ... }
  ]
}
```

---

### Category 9: State Management Nodes

#### 9.1 StatefulBuffer

**Type**: `state_management`
**Inputs**: `float[]` (data)
**Outputs**: `float[]` (persisted data)
**Parameters**:
- `size`: Buffer size (default: NUM_LEDS)
- `decay_factor`: Per-frame decay (default: 0.95)

**Description**: Persist float buffer across frames with optional decay.

**Example**:
```json
{
  "id": "trail_buffer",
  "type": "state_management",
  "name": "Trail Buffer",
  "logic": {
    "persist": "buffer[i] = input[i] + buffer[i] * decay_factor"
  },
  "outputs": {
    "persisted": "float[NUM_LEDS]"
  }
}
```

---

#### 9.2 StatefulCounter

**Type**: `state_management`
**Inputs**: `float` (increment)
**Outputs**: `float` (counter value)
**Parameters**:
- `initial_value`: Starting value (default: 0.0)
- `max_value`: Wrap-around point (default: INFINITY)

**Description**: Maintain counter value across frames with wraparound.

---

### Complete Node Type Reference Table

| Category | Node Type | Inputs | Outputs | Performance |
|----------|-----------|--------|---------|-------------|
| **Audio Input** | AudioMicrophone | - | float[512] | <5 µs |
| | AudioFFT | float[512] | float[256], float | 200-300 µs |
| | AudioEnvelope | float[512] | float | <10 µs |
| | AudioRMS | float[512] | float | <10 µs |
| | AudioBeat | float | bool, float | <20 µs |
| **Audio Processing** | AudioFilter | float, float | float | <5 µs |
| | AudioCompressor | float, float | float | <10 µs |
| | AudioNormalizer | float | float | <5 µs |
| | AudioGate | float, float | float | <5 µs |
| | AudioExpander | float, float | float | <5 µs |
| | AudioDelay | float | float | <10 µs |
| | AudioReverb | float | float | 20-30 µs |
| | AudioDistortion | float | float | <5 µs |
| **Signal Processing** | SignalInterpolate | float[] | float | <5 µs |
| | SignalMagnitude | float | float | <5 µs |
| | SignalPhase | float[] | float | <10 µs |
| | SignalConvolve | float[], float[] | float | 50-100 µs |
| | SignalDerivative | float | float | <5 µs |
| | SignalIntegrate | float | float | <5 µs |
| **Temporal** | TemporalDecay | float, float | float | <5 µs |
| | TemporalDelay | float | float | <5 µs |
| | TemporalSmooth | float | float | <5 µs |
| | TemporalLag | float | float | <5 µs |
| **Spatial** | SpatialMirror | int, int | int[] | <5 µs |
| | SpatialBlur | float[] | float[] | 50-100 µs |
| | SpatialWave | float[] | float[] | 100-150 µs |
| | SpatialScroll | float[] | float[] | 50-100 µs |
| | SpatialWarp | float[] | float[] | 100-150 µs |
| **Color** | ColorLookup | float, float | CRGBF | <10 µs |
| | ColorBlend | CRGBF, CRGBF, float | CRGBF | <5 µs |
| | ColorHSV | float, float, float | CRGBF | <10 µs |
| | ColorToGrayscale | CRGBF | float | <5 µs |
| **Rendering** | RenderingAssign | int, CRGBF | - | <5 µs |
| | RenderingFill | CRGBF, int, int | - | <1 µs/LED |
| | RenderingAdditive | int, CRGBF | - | <5 µs |
| **Control Flow** | Conditional | bool | - | <5 µs |
| | Loop | int, int | - | N/A |
| **State Management** | StatefulBuffer | float[] | float[] | <1 µs/element |
| | StatefulCounter | float | float | <5 µs |

---

## Code Generation Pipeline

### Overview

The code generation pipeline converts a JSON graph definition into optimized C++ code in 5 stages:

1. **Parsing**: JSON → Internal graph representation
2. **Validation**: Check syntax, types, and data flow
3. **Optimization**: Dead code elimination, constant folding
4. **Emission**: Generate C++ code in dependency order
5. **Verification**: Validate generated code compiles

### Stage 1: Parsing

**Input**: JSON file
**Output**: Graph object with nodes and edges
**Time**: <1ms for typical patterns

Process:
```cpp
// Parse JSON into graph structure
json graph_json = parse_json(input_file);
Graph graph = Graph::from_json(graph_json);

// Extract metadata
std::string pattern_name = graph.pattern.name;
std::string version = graph.pattern.version;

// Build node list
std::vector<Node> nodes = graph.nodes;

// Build dependency graph
std::vector<Edge> edges = graph.build_edges();
```

### Stage 2: Validation

**Input**: Graph object
**Output**: Validation report (errors, warnings)
**Time**: <5ms for typical patterns

Validates:
1. **JSON Structure**: Required fields present
2. **Node Types**: All node IDs match known types
3. **Data Types**: Input/output types match across edges
4. **Naming**: No duplicate node IDs
5. **Dependencies**: No circular references
6. **Array Sizes**: Consistent buffer sizes

**Example validation**:
```
✓ Pattern name: "spectrum"
✓ Node count: 9
✓ All node types recognized
✓ Data flow validation passed
✓ No circular dependencies
✓ All nodes reachable from entry
✓ All outputs used or final
```

### Stage 3: Optimization

**Input**: Valid graph
**Output**: Optimized graph
**Time**: <1ms

Optimizations:
1. **Dead Code Elimination**: Remove unused nodes
2. **Constant Folding**: Compute constants at compile-time
3. **Loop Invariant Hoisting**: Move constants out of loops
4. **Inlining**: Inline simple nodes
5. **Unreachable Code**: Remove branches never taken

Example:
```json
// Before optimization
{
  "id": "const_calc",
  "type": "calculation",
  "logic": {
    "val": "2.0f * 3.0f"
  }
}

// After optimization (constant folded)
// const_calc node removed, replaced with literal 6.0f
```

### Stage 4: Code Emission

**Input**: Optimized graph
**Output**: C++ source code
**Time**: <10ms

Emits in order:
1. Function signature
2. Variable declarations
3. For each node in topological order:
   - Emit variable assignments
   - Emit computation code
   - Emit branch logic
4. Final output assignments

**Example emission**:

Input graph node:
```json
{
  "id": "brightness_apply",
  "type": "rendering",
  "name": "Apply Global Brightness",
  "inputs": ["color", "params.brightness"],
  "logic": {
    "r": "color.r * params.brightness",
    "g": "color.g * params.brightness",
    "b": "color.b * params.brightness"
  },
  "outputs": {
    "bright_color": "CRGBF"
  }
}
```

Generated C++:
```cpp
// Node: brightness_apply
CRGBF bright_color_from_brightness_apply;
bright_color_from_brightness_apply.r = color.r * params.brightness;
bright_color_from_brightness_apply.g = color.g * params.brightness;
bright_color_from_brightness_apply.b = color.b * params.brightness;
```

### Stage 5: Verification

**Input**: Generated C++
**Output**: Compilation success/failure
**Time**: Depends on compiler (typically <100ms)

Verifies:
1. Compiles without errors
2. No warnings (with strict flags)
3. Includes all required headers
4. Function signature matches expected

---

## Pattern Development Workflow

### Complete Workflow Example: Spectrum Pattern

#### Phase 1: Design (Paper Sketch)

```
┌─────────┐
│ AUDIO   │
└────┬────┘
     │
     ├──→ ┌──────────────┐
     │    │ AVAILABILITY │─→ (no)─→ AMBIENT
     │    └───────┬──────┘
     │            │ (yes)
     │            ▼
     │    ┌──────────────┐
     │    │  FRESHNESS   │─→ (no)─→ RETURN
     │    └───────┬──────┘
     │            │ (yes)
     │            ▼
     │    ┌──────────────┐
     │    │ AGE_DECAY    │
     │    └───────┬──────┘
     │            │
     └──→ ┌──────▼──────────┐
          │ SPECTRUM_LOOP   │
          │                  │
          ├─→ FREQ_MAP      │
          ├─→ MAGNITUDE     │
          ├─→ RESPONSE      │
          ├─→ COLOR_LOOKUP  │
          ├─→ BRIGHTNESS    │
          ├─→ MIRROR        │
          └─→ LED_ASSIGN    │

          ▼
     ┌─────────────────┐
     │ BACKGROUND      │
     └────────┬────────┘
              ▼
         ┌────────────┐
         │ RETURN     │
         └────────────┘
```

#### Phase 2: JSON Definition

Create `spectrum_graph.json` with:
- Pattern metadata
- All 9 nodes defined
- Data flow connections
- Dependencies and validation

#### Phase 3: Validate Locally

```bash
cd firmware/src/graph_codegen
./validate_graph ../generated_patterns/spectrum_graph.json --strict
```

Expected output:
```
Validating: spectrum_graph.json
✓ Syntax valid
✓ Metadata present
✓ 9 nodes defined
✓ Node types recognized
✓ Data flow validation passed
✓ Dependency graph is DAG (no cycles)
✓ All nodes reachable
✓ All outputs used or final
Status: PASS
```

#### Phase 4: Generate Code

```bash
./spectrum_codegen ../generated_patterns/spectrum_graph.json > spectrum_generated.h
```

Output:
```
Generated spectrum_generated.h (2.3 KB)
├─ Function: draw_spectrum_generated()
├─ Variables: 15 local
├─ Loops: 1 (0..half_leds)
├─ Branches: 3 (conditional)
├─ Complexity: 0.85 (normalized)
├─ Estimated cycles: 185-250 per frame @ 60fps
└─ Status: PASS
```

#### Phase 5: Integration Testing

Add to `firmware/src/patterns.h`:
```cpp
#include "graph_codegen/spectrum_generated.h"

void draw_spectrum(uint32_t time, CRGBF* leds, const PatternParameters& params) {
    draw_spectrum_generated(time, leds, params);
}
```

Register in `firmware/src/pattern_registry.cpp`:
```cpp
PatternInfo spectrum = {
    .name = "spectrum",
    .id = PATTERN_ID_SPECTRUM,
    .draw_fn = draw_spectrum,
    .description = "Audio reactive spectrum"
};

pattern_registry.register_pattern(spectrum);
```

#### Phase 6: Hardware Test

```bash
cd firmware
pio run -e esp32s3 -t upload
```

Test on device:
- [ ] Pattern loads without error
- [ ] Responds to audio input
- [ ] LED refresh rate stable (60fps)
- [ ] Colors match expected
- [ ] No visual artifacts
- [ ] Performance metrics nominal

#### Phase 7: Optimization (Iterative)

If needed:
1. Profile on device: `curl http://device/api/performance`
2. Identify bottleneck nodes
3. Adjust graph (merge nodes, remove effects)
4. Regenerate code
5. Retest and compare metrics

---

## Best Practices

### Design Principles

1. **Decompose Logically**
   - Each node should do ONE thing
   - Keep nodes focused and reusable
   - Avoid mega-nodes with complex logic

2. **Validate Early**
   - Validate graph JSON before generation
   - Check for data type mismatches
   - Ensure no missing dependencies

3. **Optimize Data Flow**
   - Minimize data copies
   - Reuse outputs across nodes
   - Use interpolation instead of buffers where possible

4. **Test Continuously**
   - Test graph locally before hardware
   - Validate generated code compiles
   - Run on device with metrics collection

### Performance Guidelines

1. **Audio Path Optimization**
   - FFT (~200-300 µs) should be once per frame
   - Envelope detection (<10 µs) is cheap, use freely
   - Filter chains accumulate: limit to 2-3 filters

2. **Loop Optimization**
   - Minimize work in tight loops
   - Use interpolation instead of array lookups where possible
   - Avoid branches in inner loops

3. **Memory Management**
   - Declare buffers at pattern level, not per-frame
   - Reuse buffers across pattern frames
   - Keep state buffers <5KB

4. **Typical Performance Budget**
   - 60 fps target = 16.67 ms per frame
   - Audio processing: 1-2 ms
   - LED rendering: 2-4 ms (depends on NUM_LEDS)
   - Available for effects: 10-12 ms

### Code Quality

1. **Documentation**
   - Add description to all custom nodes
   - Document parameter ranges
   - Link to references (audio equations, color spaces)

2. **Validation**
   - Validate parameter ranges in runtime
   - Check preconditions (array sizes, types)
   - Assert postconditions (output ranges)

3. **Testing**
   - Create test cases for edge conditions
   - Test with various parameter values
   - Validate on both simulation and hardware

### Common Pitfalls

1. **Data Type Mismatches**
   - Problem: Connecting float output to int[] input
   - Solution: Add explicit type conversion node
   - Prevention: Use validator with strict type checking

2. **Circular Dependencies**
   - Problem: Node A depends on B, B depends on A
   - Solution: Break cycle with delay node
   - Prevention: Validator catches these automatically

3. **Undefined Data Flow**
   - Problem: Using output that doesn't exist
   - Solution: Check all node outputs before referencing
   - Prevention: Validator checks all references

4. **Performance Regressions**
   - Problem: Pattern runs <60fps after changes
   - Solution: Profile with telemetry, identify hot spot
   - Prevention: Capture baseline metrics before optimization

5. **Memory Exhaustion**
   - Problem: Too many stateful buffers
   - Solution: Reduce buffer count or size
   - Prevention: Track total stateful memory usage

---

## API Reference

### REST API Endpoints

#### Pattern Management

##### GET /api/patterns

List all available patterns.

**Response**:
```json
{
  "patterns": [
    {
      "id": "spectrum",
      "name": "Spectrum",
      "description": "Audio reactive spectrum",
      "parameters": [
        {
          "name": "brightness",
          "type": "float",
          "min": 0.0,
          "max": 1.0,
          "default": 0.8
        }
      ]
    }
  ]
}
```

---

##### POST /api/patterns/{id}/select

Select pattern to display.

**Request**:
```json
{
  "id": "spectrum"
}
```

**Response**:
```json
{
  "status": "ok",
  "pattern": "spectrum"
}
```

---

##### PUT /api/patterns/{id}/params

Update pattern parameters.

**Request**:
```json
{
  "brightness": 0.5,
  "speed": 0.7
}
```

**Response**:
```json
{
  "status": "ok",
  "params": {
    "brightness": 0.5,
    "speed": 0.7
  }
}
```

---

#### Device Management

##### GET /api/device/info

Get device information.

**Response**:
```json
{
  "device": "ESP32-S3",
  "firmware": "2025-11-10",
  "build_signature": "IDF5.1, Arduino 3.2, RMT v2",
  "led_count": 180,
  "audio_enabled": true
}
```

---

##### GET /api/device/performance

Get performance metrics.

**Response**:
```json
{
  "fps": 59.8,
  "frame_time_ms": 16.7,
  "render_time_us": 2500,
  "audio_time_us": 1200,
  "memory_free": 65536
}
```

---

### WebSocket API

#### Real-Time Updates

Connect to `ws://device:8080/api/ws`

**Message: Pattern Changed**
```json
{
  "type": "pattern_changed",
  "pattern": "spectrum"
}
```

**Message: Parameter Updated**
```json
{
  "type": "param_updated",
  "param": "brightness",
  "value": 0.5
}
```

**Message: Performance Telemetry**
```json
{
  "type": "telemetry",
  "fps": 59.8,
  "render_ms": 2.5,
  "audio_ms": 1.2
}
```

---

### Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| 0 | 200 | Success |
| 1 | 400 | Invalid request |
| 2 | 404 | Pattern not found |
| 3 | 422 | Invalid parameter value |
| 4 | 500 | Internal error |
| 5 | 503 | Device busy |

---

## Troubleshooting

### Common Issues

#### "Generated code doesn't compile"

**Symptoms**: Compiler errors after code generation

**Solutions**:
1. Check graph JSON syntax: `jq . spectrum_graph.json`
2. Verify all required headers are available
3. Check node types are valid
4. Ensure function names match expected signatures

**Prevention**: Always validate graph before generation

---

#### "Pattern runs slow (< 60 fps)"

**Symptoms**: Visible flicker or stuttering

**Solutions**:
1. Profile with: `curl http://device/api/device/performance`
2. Identify slow nodes (>3ms)
3. Options:
   - Remove non-critical effects
   - Use simpler interpolation method
   - Reduce FFT size
   - Use precomputed lookup tables

**Prevention**: Capture baseline metrics before optimization

---

#### "Audio data not available"

**Symptoms**: Pattern shows ambient color instead of audio-reactive

**Solutions**:
1. Check microphone connected to ADC input
2. Verify I2S driver initialized: `./esptool.py read_mac`
3. Check audio permissions in firmware
4. Restart device

---

#### "Parameters not updating"

**Symptoms**: REST API calls return success but pattern doesn't change

**Solutions**:
1. Check network: `ping device`
2. Verify pattern accepts parameters
3. Check parameter ranges
4. Restart device

---

### FAQ

**Q: Can I mix patterns?**
A: Not directly in graph. Create composite pattern that blends multiple sub-patterns.

**Q: What's the maximum pattern size?**
A: ~50KB generated C++ code (fits in flash). Most patterns <10KB.

**Q: Can I modify patterns at runtime?**
A: Parameters yes, structure no. Regenerate and flash for structure changes.

**Q: How do I profile patterns?**
A: Use `/api/device/performance` endpoint for frame time metrics.

**Q: Can I extend with custom nodes?**
A: Yes! See "Custom Node Extensions" in Advanced Topics.

---

## Advanced Topics

### Custom Node Extensions

Create new node types by:

1. Define node structure in JSON schema
2. Implement code generation in `spectrum_codegen.cpp`
3. Add tests in `test_all_node_types.cpp`
4. Document in this guide

Example: Custom "MyEffect" Node

**Step 1: Schema** (in codegen):
```cpp
struct MyEffectNode {
    std::string effect_type;
    float intensity;
};
```

**Step 2: Code Generation**:
```cpp
void emit_my_effect_node(const MyEffectNode& node, std::ostream& out) {
    out << "// Node: " << node.id << "\n";
    out << "float result = apply_my_effect(input, "
        << node.intensity << ");\n";
}
```

**Step 3: Testing**:
```cpp
TestResult test_my_effect_node() {
    TestResult result("MyEffectNode");
    float input = 0.5f;
    float output = apply_my_effect(input, 0.8f);
    assert(output >= 0.0f && output <= 1.0f);
    return result;
}
```

---

### Graph Composition

Create reusable sub-graphs:

```json
{
  "pattern": {
    "name": "composite_pattern"
  },
  "subgraphs": [
    {
      "id": "audio_analyze",
      "include": "audio_analysis_subgraph.json"
    },
    {
      "id": "render_spectrum",
      "include": "spectrum_render_subgraph.json"
    }
  ],
  "nodes": [
    {
      "id": "connect_flow",
      "type": "subgraph_connector",
      "from_subgraph": "audio_analyze",
      "to_subgraph": "render_spectrum"
    }
  ]
}
```

---

### Performance Optimization Techniques

1. **Loop Unrolling**
   - For small, fixed-size loops: manually unroll
   - Generated code will match hand-written performance

2. **SIMD Hints**
   - Use intrinsics for vector operations
   - FFT operations already vectorized (IDF5)

3. **Cache Optimization**
   - Access arrays sequentially (left-to-right)
   - Reuse computed values (don't recompute spectrum)

4. **Instruction-Level Parallelism**
   - Interleave independent operations
   - Modern CPUs execute out of order

---

## References

### Documentation
- ADR-0006: Graph System Architecture Decision
- Implementation Guide: `docs/09-implementation/K1NImp_SPECTRUM_GRAPH_CONVERSION_v1.0_20251110.md`
- Node Catalog: `K1NRef_NODE_CATALOG_v1.0_20251110.md`

### Examples
- Basic: `examples/hello_world_pattern.json`
- Audio-Reactive: `examples/spectrum_pattern.json`
- Stateful: `examples/trail_pattern.json`
- Spatial: `examples/wave_pattern.json`

### Tools
- Code Generator: `firmware/src/graph_codegen/spectrum_codegen.cpp`
- Validator: `firmware/src/graph_codegen/validator.cpp`
- Test Suite: `firmware/test/test_full_codegen/test_all_node_types.cpp`

### Related Systems
- Pattern Registry: `firmware/src/pattern_registry.h`
- Audio Interface: `firmware/src/pattern_audio_interface.h`
- Parameters: `firmware/src/parameters.h`

---

## Contact & Support

For questions:
1. Check the FAQ section above
2. Search existing documentation
3. Review example patterns
4. Consult the node catalog for specific node details

For bugs:
1. Validate graph JSON with validator tool
2. Check error message and troubleshooting guide
3. Generate minimal reproduction case
4. File issue with full error details

---

**End of K1.node1 SDK Developer Guide v1.0**

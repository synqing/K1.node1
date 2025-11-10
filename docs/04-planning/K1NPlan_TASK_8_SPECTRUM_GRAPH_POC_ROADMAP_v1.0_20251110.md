# K1.node1 Task 8: Spectrum Pattern Graph Conversion PoC Roadmap

**Status:** Draft
**Owner:** Claude Code Agent
**Date:** 2025-11-10
**Version:** 1.0
**Scope:** Detailed implementation breakdown for converting pattern_spectrum.cpp to graph representation and back to C++

---

## Executive Summary

Task 8 requires converting the **spectrum pattern** (audio-reactive pattern using Goertzel frequency analysis) into a graph-based representation, then generating C++ code from that graph. This is significantly more complex than Task 7 (bloom pattern) because:

1. **Stateful Audio Stream Processing**: Spectrum requires continuous, time-synchronous audio data snapshots
2. **DSP Operations**: FFT/Goertzel analysis, frequency bin normalization, spectral smoothing
3. **Buffer Management**: Audio buffer lifecycle, frame rates, stale detection
4. **Audio Data Flow**: Sample rate (16 kHz), chunk size (128 samples = 8 ms), 64-frequency bins

This PoC validates that the graph model can handle **streaming, stateful, DSP-intensive patterns** and proves code generation works for the full spectrum pattern class.

---

## Task Scope & Success Criteria

### What We're Converting
- **Current:** `/firmware/src/graph_codegen/pattern_spectrum.cpp` (47 lines, PoC stub)
- **Complexity:** Placeholder → Full spectrum visualization with audio reactivity
- **Key Algorithm**: Audio snapshot → Goertzel FFT (64 bins) → Spectrum display → Palette mapping → LED output

### Success Criteria (Must Pass All)
1. **Output Code Behavior**: Generated C++ produces visually identical output to hand-written spectrum patterns
2. **Audio Synchronization**: Spectrum updates at ≥100 Hz (audio frame rate), latency ≤20 ms
3. **Graph Expressiveness**: All spectrum pattern nodes representable in graph schema (audio input, FFT, band extraction, gradient mapping)
4. **Code Generation Quality**: Generated code is readable, efficient (≤2% perf overhead vs. hand-written)
5. **Memory Footprint**: Stateful audio nodes use <5 KB per pattern (validated in stateful_nodes.h)
6. **Test Coverage**: Unit tests for node types; integration test with live audio input

---

## Architecture Overview

### Current Pattern_Spectrum.cpp Flow
```
┌─────────────────────────────────────────────────┐
│ pattern_spectrum_render()                       │
│ (Generated function called every frame)         │
└──────────────┬──────────────────────────────────┘
               │
    ┌──────────▼───────────┐
    │ AudioDataSnapshot    │  (thread-safe audio data)
    │ - 64 frequency bins  │
    │ - Smoothed spectrum  │
    │ - VU level           │
    │ - Stale age tracking │
    └──────────┬───────────┘
               │
    ┌──────────▼──────────────────┐
    │ Spectrum Visualization (PoC) │
    │ - Simple ramp to placeholder │
    │ - No FFT, no audio usage     │
    └──────────┬──────────────────┘
               │
    ┌──────────▼─────────────────┐
    │ Gradient Mapping            │
    │ - Scalar → 5-color palette  │
    └──────────┬─────────────────┘
               │
    ┌──────────▼─────────────────┐
    │ Fill & Mirror               │
    │ - Apply color              │
    │ - Flip buffer              │
    └──────────┬─────────────────┘
               │
    ┌──────────▼──────────────────────────┐
    │ LedOutput (Terminal Node)           │
    │ - Clamp, convert to uint8_t RGB    │
    │ - Write 256×3 byte buffer          │
    └──────────────────────────────────────┘
```

### Target Graph Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    Spectrum Pattern Graph                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐                                          │
│  │ AudioSnapshot    │  (Terminal Input)                        │
│  │ ID: audio_in     │                                          │
│  │ Type: audio_snap │                                          │
│  │ Output: 64 bins  │                                          │
│  └────────┬─────────┘                                          │
│           │                                                    │
│  ┌────────▼───────────────┐                                   │
│  │ FrequencyNormalize      │  (DSP)                           │
│  │ ID: freq_norm           │                                   │
│  │ Type: freq_normalize    │                                   │
│  │ Params: use_absolute=0  │  (0=normalized, 1=absolute)     │
│  │ Input: audio spectrum   │                                   │
│  │ Output: normalized bins │                                   │
│  └────────┬────────────────┘                                   │
│           │                                                    │
│  ┌────────▼─────────────────┐                                 │
│  │ BandExtract              │  (Audio Slicing)               │
│  │ ID: band_extract         │                                 │
│  │ Type: band_extract       │                                 │
│  │ Params: start=0, end=63  │                                 │
│  │ Input: frequency bins    │                                 │
│  │ Output: 64-float buffer  │                                 │
│  └────────┬──────────────────┘                                │
│           │                                                    │
│  ┌────────▼──────────────────────┐                            │
│  │ GradientMap                    │  (Lookup Table)           │
│  │ ID: gradient_map               │                           │
│  │ Type: gradient_map             │                           │
│  │ Params: palette="spectrum_hot" │                           │
│  │ Input: normalized scalars      │                           │
│  │ Output: RGB buffer (256×3)     │                           │
│  └────────┬───────────────────────┘                           │
│           │                                                    │
│  ┌────────▼──────────────────────┐                            │
│  │ Mirror                         │  (Buffer Spatial)         │
│  │ ID: mirror_op                  │                           │
│  │ Type: mirror                   │                           │
│  │ Input: RGB buffer              │                           │
│  │ Output: flipped RGB buffer     │                           │
│  └────────┬───────────────────────┘                           │
│           │                                                    │
│  ┌────────▼──────────────────────────┐                        │
│  │ LedOutput                          │  (Terminal Output)    │
│  │ ID: led_out                        │                       │
│  │ Type: led_output                   │                       │
│  │ Input: RGB buffer (float)          │                       │
│  │ Output: uint8_t[256][3] (device)   │                       │
│  └────────────────────────────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Implementation Roadmap (6 Milestones)

### Milestone 1: Analysis & Graph Schema Definition (6-8 hours)

**Goal:** Fully understand spectrum algorithm, define node types, finalize JSON graph schema.

#### Tasks

**1.1 – Analyze Spectrum Algorithm** (2 hours)
- [ ] Read `firmware/src/audio/goertzel.h` in detail (Goertzel constant-Q filtering, freq bin organization)
- [ ] Read `firmware/src/pattern_audio_interface.h` (audio snapshot macros, freshness tracking, band extraction)
- [ ] Understand frequency mapping: 16 kHz sample rate, 64 bins → frequency range 55 Hz to ~6 kHz
- [ ] Document: Spectral smoothing algorithm, normalization (auto-ranged vs. absolute), stale detection
- [ ] Output: 1-page algorithm summary with diagrams

**1.2 – Identify Audio Node Requirements** (2 hours)
- [ ] Map current `AudioDataSnapshot` struct to graph node inputs:
  - `AudioSnapshot` node: Inputs frame_count, Returns 64-float spectrum + metadata
  - `FrequencyNormalize` node: Normalizes spectrum (auto-range vs. absolute loudness)
  - `BandExtract` node: Slices spectrum into LED-sized buffer
- [ ] Design audio node state (buffering, staleness tracking):
  - Timestamp tracking for freshness detection
  - Update counter to skip stale frames
  - Optional: Smoothing history (exponential moving average)
- [ ] Output: Node type specifications

**1.3 – Design Graph Schema** (2-3 hours)
- [ ] Extend schema from Task 7 (bloom) to include:
  - Audio input node type + parameters
  - DSP node types (normalize, band_extract, spectrum operations)
  - Streaming state (sample rate, buffer lifecycle)
- [ ] Define node interface: input slots, output slots, parameters
- [ ] Document: Parameter binding (runtime vs. compile-time), state persistence
- [ ] Output: JSON schema document with examples

**1.4 – Design Code Generation Strategy** (2 hours)
- [ ] Map graph nodes to C++ codegen patterns
- [ ] For each node type, write template:
  - AudioSnapshot → `PATTERN_AUDIO_START()` macro + snapshot validation
  - FrequencyNormalize → `AUDIO_SPECTRUM` or `AUDIO_SPECTRUM_ABSOLUTE` + normalization
  - BandExtract → loop over spectrum array with clamping
  - GradientMap → existing palette lookup (from Task 7)
  - Mirror → existing mirror function
  - LedOutput → existing output terminal
- [ ] Plan buffer declaration order (temp_f0 for scalars, temp_rgb for colors)
- [ ] Output: Codegen template document

#### Deliverables
- [ ] `/firmware/docs/SPECTRUM_ALGORITHM_ANALYSIS.md` (algorithm summary, frequency mapping)
- [ ] `/firmware/docs/AUDIO_NODE_SPECIFICATIONS.md` (node interface, state, requirements)
- [ ] `/firmware/docs/GRAPH_SCHEMA_AUDIO.json` (JSON schema with examples)
- [ ] `/firmware/docs/CODEGEN_SPECTRUM_TEMPLATES.md` (C++ code templates per node type)

#### Success Metrics
- All spectrum algorithm details documented with citations to goertzel.h
- Audio node interfaces match actual `AudioDataSnapshot` struct
- JSON schema validates against example graphs
- Code templates are syntactically correct C++

---

### Milestone 2: Node Type Library Definition (4-5 hours)

**Goal:** Create node type definitions for audio DSP operations; extend `graph_runtime.h`.

#### Tasks

**2.1 – Define Audio Input Node Type** (1.5 hours)
```cpp
// In graph_runtime.h

struct AudioInputNode {
    const char* node_id;

    // Output: 64-float spectrum array
    float output_spectrum[NUM_FREQS];  // 64 bins

    // Metadata
    uint32_t update_counter;
    uint32_t timestamp_us;
    bool is_fresh;
    uint32_t age_ms;

    // Initialize from AudioDataSnapshot
    void init_from_snapshot(const AudioDataSnapshot& snapshot) {
        memcpy(output_spectrum, snapshot.spectrogram, sizeof(float) * NUM_FREQS);
        update_counter = snapshot.update_counter;
        timestamp_us = snapshot.timestamp_us;
        age_ms = (esp_timer_get_time() - timestamp_us) / 1000;
        is_fresh = (age_ms < 50);  // < 50ms = fresh
    }
};
```

**2.2 – Define Frequency Normalization Node Type** (1 hour)
```cpp
struct FrequencyNormalizeNode {
    const char* node_id;

    // Parameters
    bool use_absolute;  // 0 = auto-ranged, 1 = absolute loudness

    // Input: spectrum from AudioInputNode
    // Output: normalized spectrum
    void process(const float* input_spectrum, float* output_spectrum, int num_bins) {
        if (use_absolute) {
            // Use spectrum as-is (no normalization)
            memcpy(output_spectrum, input_spectrum, sizeof(float) * num_bins);
        } else {
            // Auto-range: find max, normalize all to [0, 1]
            float max_val = 0.0f;
            for (int i = 0; i < num_bins; i++) {
                max_val = fmax(max_val, input_spectrum[i]);
            }

            if (max_val > 1e-6f) {
                for (int i = 0; i < num_bins; i++) {
                    output_spectrum[i] = input_spectrum[i] / max_val;
                }
            } else {
                memset(output_spectrum, 0, sizeof(float) * num_bins);
            }
        }
    }
};
```

**2.3 – Define Band Extract Node Type** (1 hour)
```cpp
struct BandExtractNode {
    const char* node_id;

    // Parameters
    int start_bin;
    int end_bin;

    // Input: normalized spectrum
    // Output: float buffer (one sample per LED)
    void process(const float* spectrum, float* output, int output_size) {
        int range = end_bin - start_bin + 1;
        int step = range / output_size;  // Downsample to LED count

        for (int i = 0; i < output_size; i++) {
            int bin = start_bin + (i * step);
            bin = clamp_val(bin, start_bin, end_bin);
            output[i] = spectrum[bin];
        }
    }
};
```

**2.4 – Extend Existing Nodes** (1.5 hours)
- [ ] Review `GradientMap` from graph_runtime.h → ensure it works with audio spectrum
- [ ] Add `FrequencySmoothing` node (optional, for exponential moving average):
  ```cpp
  struct FrequencySmoothingNode {
      const char* node_id;
      float alpha;  // IIR filter smoothing factor (0.1-0.9)
      float state[NUM_FREQS];  // Persistent smoothing state

      void process(const float* input, float* output, int num_bins) {
          for (int i = 0; i < num_bins; i++) {
              state[i] = alpha * input[i] + (1.0f - alpha) * state[i];
              output[i] = state[i];
          }
      }
  };
  ```
- [ ] Verify `Mirror`, `LedOutput` work with audio-sized buffers

**2.5 – Update PatternState for Audio** (1 hour)
```cpp
// In graph_runtime.h, extend PatternState struct

struct PatternState {
    // Existing fields...
    float lowpass_states[8];
    float ma_ring_buf[32];
    float persist_buf[256];

    // NEW: Audio-specific state
    float spectrum_smooth[NUM_FREQS];      // Smoothed spectrum history
    uint32_t last_audio_update_counter;    // Track freshness

    PatternState() : /* ... */ {
        memset(spectrum_smooth, 0, sizeof(spectrum_smooth));
        last_audio_update_counter = 0;
    }
};
```

#### Deliverables
- [ ] Updated `/firmware/src/graph_codegen/graph_runtime.h` with new node types
- [ ] Audio node definitions (AudioInputNode, FrequencyNormalizeNode, BandExtractNode)
- [ ] Extended PatternState for audio smoothing
- [ ] Unit tests for each node type (see Milestone 6)

#### Success Metrics
- All node types compile without warnings
- Node process() methods pass unit tests
- Memory footprint < 5 KB per audio node
- Consistent with existing graph_runtime.h patterns

---

### Milestone 3: JSON Graph Schema & Examples (3-4 hours)

**Goal:** Define complete JSON schema for spectrum graph; provide working examples.

#### Tasks

**3.1 – Design Graph Schema Document** (1.5 hours)

Create `/docs/06-reference/GRAPH_SCHEMA_SPECTRUM.md`:

```json
{
  "metadata": {
    "pattern": "spectrum",
    "version": "1.0",
    "description": "Spectrum visualization from audio Goertzel FFT",
    "sample_rate_hz": 16000,
    "fft_bins": 64,
    "led_count": 256,
    "frame_rate_hz": 100
  },

  "nodes": [
    {
      "id": "audio_snapshot",
      "type": "audio_input",
      "description": "Thread-safe audio data snapshot",
      "outputs": {
        "spectrum": {
          "type": "float_array",
          "size": 64,
          "description": "Goertzel frequency bins"
        }
      }
    },
    {
      "id": "frequency_normalize",
      "type": "frequency_normalize",
      "description": "Auto-range or absolute frequency normalization",
      "inputs": {
        "spectrum": "audio_snapshot.spectrum"
      },
      "parameters": {
        "use_absolute": {
          "type": "bool",
          "default": false,
          "description": "false=auto-range, true=absolute loudness"
        }
      },
      "outputs": {
        "normalized_spectrum": {
          "type": "float_array",
          "size": 64
        }
      }
    },
    {
      "id": "band_extract",
      "type": "band_extract",
      "description": "Extract and downsample spectrum to LED count",
      "inputs": {
        "spectrum": "frequency_normalize.normalized_spectrum"
      },
      "parameters": {
        "start_bin": { "type": "int", "default": 0 },
        "end_bin": { "type": "int", "default": 63 }
      },
      "outputs": {
        "scalar_buffer": {
          "type": "float_array",
          "size": 256,
          "description": "One scalar per LED"
        }
      }
    },
    {
      "id": "gradient_map",
      "type": "gradient_map",
      "description": "Map scalars to colors via palette",
      "inputs": {
        "scalars": "band_extract.scalar_buffer"
      },
      "parameters": {
        "palette": {
          "type": "string",
          "default": "spectrum_hot",
          "description": "Palette name or inline color array"
        }
      },
      "outputs": {
        "rgb_buffer": {
          "type": "rgb_array",
          "size": 256
        }
      }
    },
    {
      "id": "mirror_op",
      "type": "mirror",
      "description": "Flip buffer vertically",
      "inputs": {
        "buffer": "gradient_map.rgb_buffer"
      },
      "outputs": {
        "flipped": {
          "type": "rgb_array",
          "size": 256
        }
      }
    },
    {
      "id": "led_output",
      "type": "led_output",
      "description": "Terminal: convert and write to LED device",
      "inputs": {
        "rgb_buffer": "mirror_op.flipped"
      },
      "parameters": {
        "num_leds": { "type": "int", "default": 256 }
      }
    }
  ],

  "edges": [
    { "from": "audio_snapshot.spectrum", "to": "frequency_normalize.spectrum" },
    { "from": "frequency_normalize.normalized_spectrum", "to": "band_extract.spectrum" },
    { "from": "band_extract.scalar_buffer", "to": "gradient_map.scalars" },
    { "from": "gradient_map.rgb_buffer", "to": "mirror_op.buffer" },
    { "from": "mirror_op.flipped", "to": "led_output.rgb_buffer" }
  ]
}
```

**3.2 – Create Concrete Example Instances** (1 hour)

Create `/docs/06-reference/SPECTRUM_GRAPH_EXAMPLES.json`:

Example 1: Basic spectrum (auto-ranged, full spectrum)
```json
{
  "name": "spectrum_basic",
  "nodes": [
    { "id": "audio_snapshot", "type": "audio_input" },
    { "id": "normalize", "type": "frequency_normalize", "params": { "use_absolute": false } },
    { "id": "extract", "type": "band_extract", "params": { "start_bin": 0, "end_bin": 63 } },
    { "id": "colors", "type": "gradient_map", "params": { "palette": "hot" } },
    { "id": "flip", "type": "mirror" },
    { "id": "output", "type": "led_output" }
  ]
}
```

Example 2: Bass-focused (bins 0-16 = 55-440 Hz, stretched to 256 LEDs)
```json
{
  "name": "spectrum_bass",
  "nodes": [
    { "id": "audio_snapshot", "type": "audio_input" },
    { "id": "normalize", "type": "frequency_normalize", "params": { "use_absolute": false } },
    { "id": "extract", "type": "band_extract", "params": { "start_bin": 0, "end_bin": 16 } },
    { "id": "colors", "type": "gradient_map", "params": { "palette": "cool" } },
    { "id": "flip", "type": "mirror" },
    { "id": "output", "type": "led_output" }
  ]
}
```

Example 3: Absolute loudness with smoothing
```json
{
  "name": "spectrum_absolute_smooth",
  "nodes": [
    { "id": "audio_snapshot", "type": "audio_input" },
    { "id": "normalize", "type": "frequency_normalize", "params": { "use_absolute": true } },
    { "id": "smooth", "type": "frequency_smoothing", "params": { "alpha": 0.7 } },
    { "id": "extract", "type": "band_extract", "params": { "start_bin": 0, "end_bin": 63 } },
    { "id": "colors", "type": "gradient_map", "params": { "palette": "fire" } },
    { "id": "flip", "type": "mirror" },
    { "id": "output", "type": "led_output" }
  ]
}
```

**3.3 – Document Audio Data Flow** (1.5 hours)

Create `/docs/06-reference/AUDIO_DATA_FLOW_SPECIFICATION.md`:

```markdown
# Audio Data Flow Specification

## Sample Rate & Timing
- **Microphone Sample Rate**: 16 kHz (configured in microphone.h)
- **Chunk Size**: 128 samples = 8 ms per frame
- **Goertzel Block Size**: 512 samples = 32 ms (5 chunks)
- **FFT Output Rate**: ~100 Hz (new spectrum every 10 ms on average)
- **Frame Rate**: 60+ Hz (pattern rendering), decoupled from audio

## Frequency Bins (Goertzel)
- **Bins**: 64 (NUM_FREQS)
- **Frequency Range**: 55 Hz (Bin 0) to ~6 kHz (Bin 63)
- **Spacing**: ~100 Hz per bin (musical intervals)

## Buffer Lifecycle

### Stage 1: Audio Capture (Microphone Task)
1. I2S microphone reads 128 samples at 16 kHz
2. Samples accumulated in ring buffer (4096 samples = 256 ms history)
3. Goertzel algorithm processes 512-sample blocks (overlapping)
4. Output: 64-float spectrum array

### Stage 2: Data Snapshot (Pattern Audio Interface)
1. Audio task copies spectrum → `AudioDataSnapshot` struct (thread-safe)
2. Freshness tracking: update_counter, timestamp_us
3. Pattern reads snapshot via `PATTERN_AUDIO_START()` macro
4. Stale detection: age_ms tracked, fade-on-silence at >50ms

### Stage 3: Pattern Rendering (Graph Execution)
1. Normalize spectrum (auto-range or absolute)
2. Extract bands (downsample to 256 LED positions)
3. Map to color palette
4. Apply transforms (mirror, etc.)
5. Write to LED output buffer

## Audio Freshness & Synchronization
- **Fresh**: age_ms < 50 ms (typically 10-20 ms)
- **Acceptable**: 50-100 ms (pattern may be slightly delayed)
- **Stale**: age_ms > 100 ms (silence or system lag; fade out)

## Memory Footprint
- Spectrum array: 64 × float = 256 bytes
- AudioDataSnapshot: ~1 KB (includes metadata, smoothed bins, chromagram)
- Pattern audio state (smoothing history): <1 KB
- **Total per pattern**: <5 KB

## DSP Operations Costs
- **Goertzel Update**: O(1) per sample, ~100 ns per bin
- **Normalization**: O(64) = O(1), <100 µs
- **Band Extract**: O(256) = O(1), <200 µs
- **Gradient Map**: O(256) = O(1), <300 µs
- **Mirror**: O(256) = O(1), <200 µs
- **Total Pattern Overhead**: <1 ms / frame (target: 16 ms @ 60 Hz)
```

#### Deliverables
- [ ] `/docs/06-reference/GRAPH_SCHEMA_SPECTRUM.md` (complete JSON schema)
- [ ] `/docs/06-reference/SPECTRUM_GRAPH_EXAMPLES.json` (3+ working examples)
- [ ] `/docs/06-reference/AUDIO_DATA_FLOW_SPECIFICATION.md` (timing, memory, DSP)
- [ ] JSON validator or parser (optional: Python script to validate examples)

#### Success Metrics
- Schema is valid JSON
- All examples validate against schema
- Timing analysis shows <1 ms overhead
- Memory calculations match stateful_nodes.h constraints

---

### Milestone 4: Code Generation Engine (6-8 hours)

**Goal:** Implement codegen that converts graph JSON → C++ render function.

#### Tasks

**4.1 – Design Code Emitter** (2 hours)

Create `/firmware/tools/codegen_spectrum.py`:

```python
"""
Spectrum Graph Code Generator

Converts JSON graph representation to C++ pattern_spectrum.cpp code.

Usage:
    python codegen_spectrum.py \
        --graph spectrum_graph.json \
        --output pattern_spectrum_generated.cpp \
        --num_leds 256 \
        --pattern_name spectrum
"""

import json
import argparse
from typing import Dict, List, Any

class SpectrumCodegen:
    def __init__(self, graph: Dict[str, Any], num_leds: int = 256, pattern_name: str = "spectrum"):
        self.graph = graph
        self.num_leds = num_leds
        self.pattern_name = pattern_name
        self.buffer_index = 0
        self.temp_bufs = {}

    def generate(self) -> str:
        """Generate complete C++ function"""
        code = []

        # Header
        code.append(self._emit_header())

        # Function signature
        code.append(self._emit_function_signature())

        # Buffer declarations
        code.append(self._emit_buffer_declarations())

        # Audio initialization
        code.append(self._emit_audio_init())

        # Node execution
        code.append(self._emit_nodes())

        # LED output
        code.append(self._emit_output())

        # Footer
        code.append("}")

        return "\n".join(code)

    def _emit_header(self) -> str:
        return """#include "graph_runtime.h"
#include "../stateful_nodes.h"
#include "../parameters.h"
#include "../pattern_audio_interface.h"

extern "C" void pattern_spectrum_render(
    uint32_t frame_count,
    const AudioDataSnapshot& audio,
    const PatternParameters& params,
    PatternState& state,
    PatternOutput& out
) {"""

    def _emit_function_signature(self) -> str:
        return f"extern \"C\" void pattern_{self.pattern_name}_render(\n" \
               "    uint32_t frame_count,\n" \
               "    const AudioDataSnapshot& audio,\n" \
               "    const PatternParameters& params,\n" \
               "    PatternState& state,\n" \
               "    PatternOutput& out\n" \
               ") {"

    def _emit_buffer_declarations(self) -> str:
        bufs = []
        bufs.append(f"    static constexpr int PATTERN_NUM_LEDS = {self.num_leds};")
        bufs.append(f"    float tmp_f{self.buffer_index}[{self.num_leds}] = {{0.0f}};")
        self.temp_bufs['scalar'] = f"tmp_f{self.buffer_index}"
        self.buffer_index += 1

        bufs.append(f"    CRGBF tmp_rgb{self.buffer_index}[{self.num_leds}];")
        self.temp_bufs['rgb_0'] = f"tmp_rgb{self.buffer_index}"
        self.buffer_index += 1

        bufs.append(f"    CRGBF tmp_rgb{self.buffer_index}[{self.num_leds}];")
        self.temp_bufs['rgb_1'] = f"tmp_rgb{self.buffer_index}"
        self.buffer_index += 1

        bufs.append(f"")
        bufs.append(f"    // Initialize RGB buffers to black")
        bufs.append(f"    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {{")
        bufs.append(f"        {self.temp_bufs['rgb_0']}[i] = {{0.0f, 0.0f, 0.0f}};")
        bufs.append(f"        {self.temp_bufs['rgb_1']}[i] = {{0.0f, 0.0f, 0.0f}};")
        bufs.append(f"    }}")

        return "\n".join(bufs)

    def _emit_audio_init(self) -> str:
        return """
    // === Audio Initialization ===
    PATTERN_AUDIO_START();

    // Skip rendering if audio data is stale
    if (AUDIO_IS_STALE()) {
        // Fallback: gray fill with fade
        fill_buffer(tmp_rgb0, {0.2f, 0.2f, 0.2f}, PATTERN_NUM_LEDS);
        const CRGBF* final_buf = tmp_rgb0;
    } else {
        // Audio is fresh; process spectrum
"""

    def _emit_nodes(self) -> str:
        """Generate code for each node in execution order"""
        code = []
        code.append("\n    // === Generated Nodes ===\n")

        nodes = self.graph.get("nodes", [])

        for node in nodes:
            node_type = node.get("type")
            node_id = node.get("id")
            params = node.get("parameters", {})

            if node_type == "audio_input":
                code.append(self._emit_audio_input_node(node_id))
            elif node_type == "frequency_normalize":
                code.append(self._emit_normalize_node(node_id, params))
            elif node_type == "band_extract":
                code.append(self._emit_extract_node(node_id, params))
            elif node_type == "gradient_map":
                code.append(self._emit_gradient_node(node_id, params))
            elif node_type == "mirror":
                code.append(self._emit_mirror_node(node_id))
            elif node_type == "led_output":
                pass  # Handled separately

        return "\n".join(code)

    def _emit_audio_input_node(self, node_id: str) -> str:
        return f"""    // Node: {node_id} (AudioInput)
    // Direct access to spectrum array from snapshot
    float spectrum_buf[NUM_FREQS];
    memcpy(spectrum_buf, AUDIO_SPECTRUM, sizeof(float) * NUM_FREQS);"""

    def _emit_normalize_node(self, node_id: str, params: Dict) -> str:
        use_absolute = params.get("use_absolute", False)
        code = [f"\n    // Node: {node_id} (FrequencyNormalize)"]

        if use_absolute:
            code.append(f"    // Use absolute loudness (no normalization)")
            code.append(f"    memcpy(spectrum_buf, AUDIO_SPECTRUM_ABSOLUTE, sizeof(float) * NUM_FREQS);")
        else:
            code.append(f"    // Auto-range normalization")
            code.append(f"    float max_val = 0.0f;")
            code.append(f"    for (int i = 0; i < NUM_FREQS; i++) {{")
            code.append(f"        max_val = fmax(max_val, spectrum_buf[i]);")
            code.append(f"    }}")
            code.append(f"    if (max_val > 1e-6f) {{")
            code.append(f"        for (int i = 0; i < NUM_FREQS; i++) {{")
            code.append(f"            spectrum_buf[i] /= max_val;")
            code.append(f"        }}")
            code.append(f"    }} else {{")
            code.append(f"        memset(spectrum_buf, 0, sizeof(float) * NUM_FREQS);")
            code.append(f"    }}")

        return "\n".join(code)

    def _emit_extract_node(self, node_id: str, params: Dict) -> str:
        start = params.get("start_bin", 0)
        end = params.get("end_bin", 63)
        code = [f"\n    // Node: {node_id} (BandExtract) [bins {start}-{end}]"]
        code.append(f"    int range = {end} - {start} + 1;")
        code.append(f"    for (int i = 0; i < PATTERN_NUM_LEDS; i++) {{")
        code.append(f"        int bin = {start} + ((i * range) / PATTERN_NUM_LEDS);")
        code.append(f"        bin = clamp_val(bin, {start}, {end});")
        code.append(f"        {self.temp_bufs['scalar']}[i] = spectrum_buf[bin];")
        code.append(f"    }}")
        return "\n".join(code)

    def _emit_gradient_node(self, node_id: str, params: Dict) -> str:
        palette = params.get("palette", "hot")
        code = [f"\n    // Node: {node_id} (GradientMap) palette={palette}"]
        code.append(f"    static const CRGBF palette[5] = {{{{0.0f,0.0f,1.0f}},{{0.0f,1.0f,1.0f}},{{0.0f,1.0f,0.0f}},{{1.0f,1.0f,0.0f}},{{1.0f,0.0f,0.0f}}}};")
        code.append(f"    for (int i = 0; i < PATTERN_NUM_LEDS; i++) {{")
        code.append(f"        float idx = clamp_val({self.temp_bufs['scalar']}[i], 0.0f, 1.0f);")
        code.append(f"        {self.temp_bufs['rgb_0']}[i] = gradient_map(idx, palette, 5);")
        code.append(f"    }}")
        return "\n".join(code)

    def _emit_mirror_node(self, node_id: str) -> str:
        code = [f"\n    // Node: {node_id} (Mirror)"]
        code.append(f"    mirror_buffer({self.temp_bufs['rgb_0']}, {self.temp_bufs['rgb_1']}, PATTERN_NUM_LEDS);")
        return "\n".join(code)

    def _emit_output(self) -> str:
        return f"""
    }  // End audio freshness check

    // Terminal: LedOutput
    const CRGBF* final_buf = {self.temp_bufs['rgb_1']};
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {{
        CRGBF c = clamped_rgb(final_buf[i]);
        out.leds[i][0] = (uint8_t)std::floor(c.r * 255.0f + 0.5f);
        out.leds[i][1] = (uint8_t)std::floor(c.g * 255.0f + 0.5f);
        out.leds[i][2] = (uint8_t)std::floor(c.b * 255.0f + 0.5f);
    }}
"""

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate spectrum pattern C++ code from graph")
    parser.add_argument("--graph", required=True, help="Input JSON graph file")
    parser.add_argument("--output", default="pattern_spectrum_generated.cpp")
    parser.add_argument("--num_leds", type=int, default=256)
    parser.add_argument("--pattern_name", default="spectrum")

    args = parser.parse_args()

    with open(args.graph) as f:
        graph = json.load(f)

    codegen = SpectrumCodegen(graph, args.num_leds, args.pattern_name)
    cpp_code = codegen.generate()

    with open(args.output, "w") as f:
        f.write(cpp_code)

    print(f"Generated: {args.output}")
```

**4.2 – Implement Code Emitter** (2.5 hours)
- [ ] Complete `codegen_spectrum.py` implementation with all node types
- [ ] Add validation: ensure graph nodes appear in correct order
- [ ] Add error handling: missing parameters, invalid node types
- [ ] Test codegen with example graphs from Milestone 3

**4.3 – Test Code Generation** (1.5 hours)
- [ ] Run codegen on basic spectrum example → verify C++ compiles
- [ ] Run codegen on bass-focused example → verify parameter substitution
- [ ] Generate with different palette, num_leds → verify outputs differ
- [ ] Diff generated code vs. hand-written pattern_spectrum.cpp (existing PoC)

**4.4 – Optimize Code Output** (1 hour)
- [ ] Minimize buffer copies (use references where safe)
- [ ] Inline small node functions (eliminate function call overhead)
- [ ] Add comments at graph boundaries (node input/output tracking)
- [ ] Format for readability (proper indentation, line length)

#### Deliverables
- [ ] `/firmware/tools/codegen_spectrum.py` (complete, tested code generator)
- [ ] Generated test files: `/tmp/pattern_spectrum_basic.cpp`, `/tmp/pattern_spectrum_bass.cpp`
- [ ] Codegen integration test: pytest suite
- [ ] Documentation: `/docs/09-implementation/CODEGEN_SPECTRUM_USAGE.md`

#### Success Metrics
- Generated C++ code compiles without warnings
- All node types supported (audio_input, normalize, extract, gradient_map, mirror, led_output)
- Generated code matches hand-written pattern semantics
- <2% overhead vs. hand-written (validated in Milestone 5)
- Code generator runs in <1s for typical graph

---

### Milestone 5: Integration & Audio Data Flow Testing (5-6 hours)

**Goal:** Integrate generated code with firmware; test audio synchronization and output quality.

#### Tasks

**5.1 – Integrate Generated Code into Firmware Build** (1.5 hours)
- [ ] Add build rule: CMake or platformio.ini to run codegen_spectrum.py
  ```cmake
  # CMakeLists.txt or platformio.ini
  add_custom_command(
      OUTPUT pattern_spectrum_generated.cpp
      COMMAND python codegen_spectrum.py
          --graph ${CMAKE_CURRENT_SOURCE_DIR}/spectrum_graph.json
          --output ${CMAKE_CURRENT_BINARY_DIR}/pattern_spectrum_generated.cpp
      DEPENDS spectrum_graph.json codegen_spectrum.py
  )
  ```
- [ ] Verify generated code compiles in firmware context
- [ ] Link generated function into binary

**5.2 – Create Audio Test Harness** (2 hours)

Create `/firmware/test/test_spectrum_audio_flow.cpp`:

```cpp
#include <gtest/gtest.h>
#include "../src/pattern_audio_interface.h"
#include "../src/graph_codegen/pattern_spectrum.cpp"
#include <cmath>

class SpectrumAudioFlowTest : public ::testing::Test {
protected:
    AudioDataSnapshot mock_audio;
    PatternState state;
    PatternOutput output;
    PatternParameters params;

    void SetUp() override {
        // Initialize mock audio snapshot
        memset(&mock_audio, 0, sizeof(mock_audio));
        memset(&output, 0, sizeof(output));
        memset(&params, 0, sizeof(params));

        // Create synthetic audio spectrum (simple ramp)
        for (int i = 0; i < NUM_FREQS; i++) {
            mock_audio.spectrogram[i] = (float)i / (float)NUM_FREQS;
            mock_audio.spectrogram_smooth[i] = mock_audio.spectrogram[i];
            mock_audio.spectrogram_absolute[i] = 0.5f * mock_audio.spectrogram[i];
        }

        mock_audio.update_counter = 1;
        mock_audio.timestamp_us = esp_timer_get_time();
        mock_audio.vu_level = 0.7f;
    }
};

TEST_F(SpectrumAudioFlowTest, AudioFreshDetection) {
    // Fresh audio: should render normally
    mock_audio.timestamp_us = esp_timer_get_time();
    pattern_spectrum_render(0, mock_audio, params, state, output);

    // Check: output should be non-zero
    int non_black_count = 0;
    for (int i = 0; i < 256; i++) {
        if (output.leds[i][0] > 0 || output.leds[i][1] > 0 || output.leds[i][2] > 0) {
            non_black_count++;
        }
    }
    EXPECT_GT(non_black_count, 100);  // Most LEDs should have color
}

TEST_F(SpectrumAudioFlowTest, AudioStaleDetection) {
    // Stale audio: should fade to gray
    mock_audio.timestamp_us = esp_timer_get_time() - 100 * 1000;  // 100 ms old
    pattern_spectrum_render(0, mock_audio, params, state, output);

    // Check: output should be mostly black or gray (fade)
    // This validates AUDIO_IS_STALE() conditional in generated code
    int bright_count = 0;
    for (int i = 0; i < 256; i++) {
        uint8_t max_ch = std::max({output.leds[i][0], output.leds[i][1], output.leds[i][2]});
        if (max_ch > 200) bright_count++;
    }
    EXPECT_LT(bright_count, 50);  // Most LEDs should be dim
}

TEST_F(SpectrumAudioFlowTest, SpectrumNormalization) {
    // Test auto-range normalization
    // Spectrum with peak at bin 32
    for (int i = 0; i < NUM_FREQS; i++) {
        mock_audio.spectrogram[i] = 0.1f;
    }
    mock_audio.spectrogram[32] = 1.0f;  // Peak

    pattern_spectrum_render(0, mock_audio, params, state, output);

    // Check: LED 128 (middle) should be brightest
    uint8_t mid_brightness = std::max({output.leds[128][0], output.leds[128][1], output.leds[128][2]});
    EXPECT_GT(mid_brightness, 200);
}

TEST_F(SpectrumAudioFlowTest, BufferIntegrity) {
    // Verify no buffer overflows
    pattern_spectrum_render(0, mock_audio, params, state, output);

    // All LEDs should have valid RGB values
    for (int i = 0; i < 256; i++) {
        EXPECT_LE(output.leds[i][0], 255);
        EXPECT_LE(output.leds[i][1], 255);
        EXPECT_LE(output.leds[i][2], 255);
    }
}

TEST_F(SpectrumAudioFlowTest, PerformanceBudget) {
    // Measure rendering time
    auto t0 = esp_timer_get_time();

    for (int frame = 0; frame < 100; frame++) {
        pattern_spectrum_render(frame, mock_audio, params, state, output);
    }

    auto elapsed_us = esp_timer_get_time() - t0;
    float avg_us = (float)elapsed_us / 100.0f;

    // Should be <2% of 16ms frame budget (16000 µs)
    // That's <320 µs per frame
    EXPECT_LT(avg_us, 320.0f);

    std::cout << "Avg render time: " << avg_us << " µs/frame\n";
}
```

**5.3 – Test with Real Audio Input (if available)** (1.5 hours)
- [ ] Create integration test that reads microphone audio
- [ ] Verify spectrum updates at ~100 Hz (fresh data every 10 ms)
- [ ] Verify no glitches or buffer underruns
- [ ] Capture output: frequency response, latency, color accuracy

**5.4 – Validate Against Hand-Written Reference** (1 hour)
- [ ] Run both generated and hand-written spectrum patterns
- [ ] Compare outputs frame-by-frame (should be identical or very close)
- [ ] Measure latency difference (<10 µs acceptable)
- [ ] Profile memory usage (should match stateful_nodes constraints)

#### Deliverables
- [ ] Integrated build system (CMake or platformio integration)
- [ ] `/firmware/test/test_spectrum_audio_flow.cpp` (comprehensive test suite)
- [ ] Audio test harness with mock audio snapshots
- [ ] Performance benchmarks: render time, latency, memory
- [ ] Comparison report: generated vs. hand-written

#### Success Metrics
- All tests pass (audio fresh/stale detection, spectrum normalization, buffer integrity)
- Render time < 320 µs/frame (< 2% of 16 ms budget)
- Generated code produces visually identical output to hand-written pattern
- Memory usage < 5 KB per pattern (validated)

---

### Milestone 6: Unit Tests & Documentation (4-5 hours)

**Goal:** Comprehensive unit tests for all node types; complete documentation.

#### Tasks

**6.1 – Unit Test Each Node Type** (2 hours)

Create `/firmware/test/test_spectrum_nodes.cpp`:

```cpp
#include <gtest/gtest.h>
#include "../src/graph_codegen/graph_runtime.h"

// Audio Input Node Tests
TEST(AudioInputNodeTest, InitializeFromSnapshot) {
    AudioDataSnapshot snapshot;
    for (int i = 0; i < NUM_FREQS; i++) {
        snapshot.spectrogram[i] = (float)i / NUM_FREQS;
    }
    snapshot.update_counter = 42;
    snapshot.timestamp_us = esp_timer_get_time();

    AudioInputNode node;
    node.init_from_snapshot(snapshot);

    EXPECT_EQ(node.update_counter, 42);
    for (int i = 0; i < NUM_FREQS; i++) {
        EXPECT_FLOAT_EQ(node.output_spectrum[i], (float)i / NUM_FREQS);
    }
}

// Frequency Normalize Tests
TEST(FrequencyNormalizeNodeTest, AutoRangeNormalization) {
    FrequencyNormalizeNode node;
    node.use_absolute = false;

    float input[NUM_FREQS];
    float output[NUM_FREQS];

    // Input: max value 2.0
    for (int i = 0; i < NUM_FREQS; i++) {
        input[i] = 2.0f * (float)i / NUM_FREQS;
    }

    node.process(input, output, NUM_FREQS);

    // Output max should be 1.0
    float max_out = 0.0f;
    for (int i = 0; i < NUM_FREQS; i++) {
        max_out = fmax(max_out, output[i]);
    }
    EXPECT_FLOAT_EQ(max_out, 1.0f);
}

TEST(FrequencyNormalizeNodeTest, AbsoluteMode) {
    FrequencyNormalizeNode node;
    node.use_absolute = true;

    float input[NUM_FREQS];
    float output[NUM_FREQS];

    for (int i = 0; i < NUM_FREQS; i++) {
        input[i] = (float)i / NUM_FREQS;
    }

    node.process(input, output, NUM_FREQS);

    // Output should match input exactly
    for (int i = 0; i < NUM_FREQS; i++) {
        EXPECT_FLOAT_EQ(output[i], input[i]);
    }
}

// Band Extract Tests
TEST(BandExtractNodeTest, FullSpectrum) {
    BandExtractNode node;
    node.start_bin = 0;
    node.end_bin = 63;

    float spectrum[NUM_FREQS];
    float output[256];

    for (int i = 0; i < NUM_FREQS; i++) {
        spectrum[i] = (float)i / NUM_FREQS;
    }

    node.process(spectrum, output, 256);

    // Output should be monotonically increasing (maps spectrum to LEDs)
    for (int i = 1; i < 256; i++) {
        EXPECT_GE(output[i], output[i-1] - 0.01f);  // Allow small error
    }
}

TEST(BandExtractNodeTest, BassBand) {
    BandExtractNode node;
    node.start_bin = 0;
    node.end_bin = 16;  // Bass only

    float spectrum[NUM_FREQS];
    float output[256];

    // Only bass has energy
    for (int i = 0; i < NUM_FREQS; i++) {
        spectrum[i] = (i <= 16) ? 1.0f : 0.0f;
    }

    node.process(spectrum, output, 256);

    // All LEDs should have same value (constant ramp over bass band)
    float first = output[0];
    for (int i = 1; i < 256; i++) {
        EXPECT_FLOAT_EQ(output[i], first);
    }
}

// Gradient Map Tests
TEST(GradientMapNodeTest, ScalarToColor) {
    CRGBF palette[5] = {
        {0.0f, 0.0f, 1.0f},  // Blue
        {0.0f, 1.0f, 1.0f},  // Cyan
        {0.0f, 1.0f, 0.0f},  // Green
        {1.0f, 1.0f, 0.0f},  // Yellow
        {1.0f, 0.0f, 0.0f}   // Red
    };

    float scalars[256];
    for (int i = 0; i < 256; i++) {
        scalars[i] = (float)i / 255.0f;
    }

    // gradient_map function from graph_runtime.h
    CRGBF mapped = gradient_map(0.5f, palette, 5);

    // Mid-value should map to green or yellow
    EXPECT_GT(mapped.g, 0.8f);
}
```

**6.2 – Test Code Generation Quality** (1 hour)
- [ ] Verify generated code can be compiled standalone (with mocks)
- [ ] Check that generated code is readable (proper indentation, comments)
- [ ] Validate parameter substitution (different palettes, bins, led counts produce different code)
- [ ] Test edge cases: zero-length buffers, extreme parameter values

**6.3 – Write Comprehensive Documentation** (1.5-2 hours)

Create `/docs/09-implementation/SPECTRUM_CODEGEN_IMPLEMENTATION_GUIDE.md`:

```markdown
# Spectrum Pattern Code Generation Implementation Guide

## Overview

This guide explains how to convert a spectrum graph JSON representation into optimized C++ code.

## Graph Structure

### Node Types

1. **audio_input**
   - Source node; no inputs
   - Output: 64-float spectrum array
   - Represents thread-safe audio data snapshot

2. **frequency_normalize**
   - Input: spectrum array (64 floats)
   - Output: normalized spectrum (64 floats)
   - Params: use_absolute (bool, default: false)
   - Auto-range: max-normalizes to [0,1]
   - Absolute: preserves loudness information

3. **band_extract**
   - Input: spectrum array
   - Output: scalar buffer (one per LED)
   - Params: start_bin, end_bin
   - Downsamples frequency bins to LED resolution

4. **gradient_map**
   - Input: scalar buffer (0-1 range)
   - Output: RGB buffer
   - Params: palette name or inline colors
   - Maps scalars to colors via lookup table

5. **mirror**
   - Input: RGB buffer
   - Output: flipped RGB buffer
   - No parameters
   - Useful for symmetric visualizations

6. **led_output** (Terminal)
   - Input: RGB buffer (floats)
   - Output: device write (uint8_t RGB)
   - Clamps values, converts to 8-bit, writes to hardware

## Code Generation Pipeline

### Step 1: Parse Graph JSON
```python
import json
with open('spectrum_graph.json') as f:
    graph = json.load(f)
```

### Step 2: Validate Graph
- Check all nodes have required fields (id, type)
- Check edges reference valid nodes
- Verify data types match (spectrum → float array, etc.)

### Step 3: Emit C++ Code
For each node in execution order:
1. Emit node comment (id, type)
2. Emit node operation code
3. Track output buffer names
4. Verify inputs are available

### Step 4: Emit Output Terminal
- Convert final buffer from float RGB to uint8_t
- Write to PatternOutput struct

## Example Generated Code

```cpp
extern "C" void pattern_spectrum_render(
    uint32_t frame_count,
    const AudioDataSnapshot& audio,
    const PatternParameters& params,
    PatternState& state,
    PatternOutput& out
) {
    static constexpr int PATTERN_NUM_LEDS = 256;
    float tmp_f0[PATTERN_NUM_LEDS] = {0.0f};
    CRGBF tmp_rgb0[PATTERN_NUM_LEDS];
    CRGBF tmp_rgb1[PATTERN_NUM_LEDS];

    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {
        tmp_rgb0[i] = {0.0f, 0.0f, 0.0f};
        tmp_rgb1[i] = {0.0f, 0.0f, 0.0f};
    }

    // === Audio Initialization ===
    PATTERN_AUDIO_START();

    if (AUDIO_IS_STALE()) {
        fill_buffer(tmp_rgb0, {0.2f, 0.2f, 0.2f}, PATTERN_NUM_LEDS);
    } else {
        // Node: audio_snapshot (AudioInput)
        float spectrum_buf[NUM_FREQS];
        memcpy(spectrum_buf, AUDIO_SPECTRUM, sizeof(float) * NUM_FREQS);

        // Node: frequency_normalize (FrequencyNormalize)
        float max_val = 0.0f;
        for (int i = 0; i < NUM_FREQS; i++) {
            max_val = fmax(max_val, spectrum_buf[i]);
        }
        if (max_val > 1e-6f) {
            for (int i = 0; i < NUM_FREQS; i++) {
                spectrum_buf[i] /= max_val;
            }
        } else {
            memset(spectrum_buf, 0, sizeof(float) * NUM_FREQS);
        }

        // Node: band_extract (BandExtract)
        for (int i = 0; i < PATTERN_NUM_LEDS; i++) {
            int bin = (i * 64) / PATTERN_NUM_LEDS;
            bin = clamp_val(bin, 0, 63);
            tmp_f0[i] = spectrum_buf[bin];
        }

        // Node: gradient_map (GradientMap)
        static const CRGBF palette[5] = {
            {0.0f, 0.0f, 1.0f},
            {0.0f, 1.0f, 1.0f},
            {0.0f, 1.0f, 0.0f},
            {1.0f, 1.0f, 0.0f},
            {1.0f, 0.0f, 0.0f}
        };
        for (int i = 0; i < PATTERN_NUM_LEDS; i++) {
            float idx = clamp_val(tmp_f0[i], 0.0f, 1.0f);
            tmp_rgb0[i] = gradient_map(idx, palette, 5);
        }

        // Node: mirror_op (Mirror)
        mirror_buffer(tmp_rgb0, tmp_rgb1, PATTERN_NUM_LEDS);
    }

    // Terminal: LedOutput
    const CRGBF* final_buf = tmp_rgb1;
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {
        CRGBF c = clamped_rgb(final_buf[i]);
        out.leds[i][0] = (uint8_t)std::floor(c.r * 255.0f + 0.5f);
        out.leds[i][1] = (uint8_t)std::floor(c.g * 255.0f + 0.5f);
        out.leds[i][2] = (uint8_t)std::floor(c.b * 255.0f + 0.5f);
    }
}
```

## Performance Considerations

- **Spectrum lookup**: O(1), ~10 µs
- **Normalization**: O(64), ~100 µs
- **Band extraction**: O(256), ~200 µs
- **Gradient mapping**: O(256), ~300 µs
- **Total**: < 1 ms / frame (target: 16 ms @ 60 Hz)

## Testing

See: `/firmware/test/test_spectrum_audio_flow.cpp`

Key test cases:
- Audio freshness detection (AUDIO_IS_STALE)
- Spectrum normalization (auto-range, absolute)
- Buffer integrity (no overflows)
- Performance budget (< 320 µs/frame)
```

**6.4 – Create ADR** (1 hour)

Create `/docs/02-adr/ADR-0020-spectrum-graph-codegen.md`:

```markdown
# ADR-0020: Spectrum Pattern Graph Codegen Architecture

**Status:** Proposed
**Date:** 2025-11-10
**Owner:** Claude Code Agent

## Context

Task 8 requires converting the spectrum pattern (audio-reactive, DSP-intensive) into a graph-based representation and generating C++ code from that graph.

## Decision

We will implement a **JSON-based graph schema** with the following node types:

1. **Audio Input**: Thread-safe snapshot from Goertzel FFT
2. **Frequency Normalize**: Auto-range or absolute loudness
3. **Band Extract**: Downsample spectrum to LED resolution
4. **Gradient Map**: Scalar → color palette lookup
5. **Mirror**: Buffer transform
6. **LED Output**: Terminal (write device buffer)

Code generation will be via Python script (`codegen_spectrum.py`) that emits optimized C++.

## Rationale

- **Expressiveness**: All spectrum patterns representable in this schema
- **Simplicity**: 6 node types cover 90% of audio-reactive use cases
- **Efficiency**: Generated code has <2% overhead vs. hand-written
- **Testability**: Each node type is independently testable
- **Extensibility**: New node types can be added without schema changes

## Consequences

- **Positive**:
  - Graph-based patterns are composable and reusable
  - Code generation is deterministic and reproducible
  - Versioning and rollback via graph changes (not code)
  - Easier UI/graphical authoring in future

- **Negative**:
  - Code generation adds compilation step
  - Generated code is less hand-optimizable
  - New toolchain dependency (Python)
  - Schema lock-in (breaking changes require migration)

## Acceptance Criteria

1. Generated C++ code compiles without warnings
2. Output behavior matches hand-written reference
3. Render time < 320 µs/frame (< 2% of budget)
4. Memory < 5 KB per pattern
5. All node types testable with unit tests
6. Documentation complete (guide + API + examples)

## Related

- ADR-0019: Conductor Deployment Resilience (audio integration)
- Task 7: Bloom Pattern PoC (simpler graph example)
- Task 8: Spectrum Pattern PoC (this task)
```

#### Deliverables
- [ ] `/firmware/test/test_spectrum_nodes.cpp` (unit tests for each node type)
- [ ] `/docs/09-implementation/SPECTRUM_CODEGEN_IMPLEMENTATION_GUIDE.md` (comprehensive guide)
- [ ] `/docs/02-adr/ADR-0020-spectrum-graph-codegen.md` (architecture decision record)
- [ ] Test coverage report (>90% code coverage)

#### Success Metrics
- All unit tests pass
- Code coverage > 90%
- Documentation is complete and accurate
- ADR accepted or ready for review

---

## Summary: Implementation Timeline & Effort

| Milestone | Duration | Key Deliverables | Blockers |
|-----------|----------|------------------|----------|
| **M1: Analysis** | 6-8 hrs | Algorithm summary, node specs, schema, codegen templates | None |
| **M2: Node Library** | 4-5 hrs | graph_runtime.h extensions, node type defs | M1 complete |
| **M3: Graph Schema** | 3-4 hrs | JSON schema doc, 3+ examples, audio data flow spec | M1-M2 complete |
| **M4: Code Generation** | 6-8 hrs | codegen_spectrum.py, generated test files, integration test | M3 complete |
| **M5: Integration** | 5-6 hrs | Build integration, audio test harness, benchmarks | M4 complete |
| **M6: Tests & Docs** | 4-5 hrs | Unit tests, guide, ADR | M5 complete |
| **TOTAL** | **28-36 hours** | Complete PoC, all tests pass, ready for review | — |

---

## Graph Node Definitions (Complete Reference)

### AudioSnapshot Node
```json
{
  "id": "audio_in",
  "type": "audio_input",
  "description": "Thread-safe audio data snapshot from Goertzel FFT",
  "outputs": {
    "spectrum": {
      "type": "float_array",
      "size": 64,
      "description": "Normalized frequency bins (55 Hz to ~6 kHz)"
    }
  },
  "parameters": {},
  "cpp_template": "PATTERN_AUDIO_START();\nfloat spectrum_buf[NUM_FREQS];\nmemcpy(spectrum_buf, AUDIO_SPECTRUM, sizeof(float) * NUM_FREQS);"
}
```

### FrequencyNormalize Node
```json
{
  "id": "freq_norm",
  "type": "frequency_normalize",
  "description": "Auto-range or absolute loudness normalization",
  "inputs": {
    "spectrum": {
      "type": "float_array",
      "size": 64
    }
  },
  "outputs": {
    "normalized_spectrum": {
      "type": "float_array",
      "size": 64
    }
  },
  "parameters": {
    "use_absolute": {
      "type": "bool",
      "default": false,
      "description": "false: auto-range [0,1], true: preserve loudness"
    }
  },
  "cpp_template": "if (use_absolute) { /* ... */ } else { /* max normalize */ }"
}
```

### BandExtract Node
```json
{
  "id": "extract",
  "type": "band_extract",
  "description": "Extract frequency band and downsample to LED resolution",
  "inputs": {
    "spectrum": {
      "type": "float_array",
      "size": 64
    }
  },
  "outputs": {
    "scalar_buffer": {
      "type": "float_array",
      "size": 256
    }
  },
  "parameters": {
    "start_bin": {
      "type": "int",
      "default": 0,
      "min": 0,
      "max": 63
    },
    "end_bin": {
      "type": "int",
      "default": 63,
      "min": 0,
      "max": 63
    }
  },
  "cpp_template": "for (int i = 0; i < PATTERN_NUM_LEDS; i++) { int bin = ...; output[i] = spectrum[bin]; }"
}
```

### GradientMap Node
```json
{
  "id": "colors",
  "type": "gradient_map",
  "description": "Map scalar values to colors via palette",
  "inputs": {
    "scalars": {
      "type": "float_array",
      "size": 256
    }
  },
  "outputs": {
    "rgb_buffer": {
      "type": "rgb_array",
      "size": 256
    }
  },
  "parameters": {
    "palette": {
      "type": "string",
      "default": "hot",
      "options": ["hot", "cool", "fire", "viridis", "custom"],
      "description": "Color palette name or JSON array of colors"
    }
  },
  "cpp_template": "for (int i = 0; i < PATTERN_NUM_LEDS; i++) { float idx = clamp_val(scalars[i], 0.0f, 1.0f); rgb[i] = gradient_map(idx, palette, palette_size); }"
}
```

### Mirror Node
```json
{
  "id": "flip",
  "type": "mirror",
  "description": "Flip buffer vertically (useful for symmetric displays)",
  "inputs": {
    "buffer": {
      "type": "rgb_array",
      "size": 256
    }
  },
  "outputs": {
    "flipped": {
      "type": "rgb_array",
      "size": 256
    }
  },
  "parameters": {},
  "cpp_template": "mirror_buffer(input, output, PATTERN_NUM_LEDS);"
}
```

### LedOutput Node (Terminal)
```json
{
  "id": "output",
  "type": "led_output",
  "description": "Terminal node: convert and write to LED device",
  "inputs": {
    "rgb_buffer": {
      "type": "rgb_array",
      "size": 256
    }
  },
  "parameters": {
    "num_leds": {
      "type": "int",
      "default": 256
    }
  },
  "cpp_template": "for (int i = 0; i < num_leds; i++) { CRGBF c = clamped_rgb(rgb[i]); out.leds[i][0] = (uint8_t)(c.r * 255 + 0.5); /* ... */ }"
}
```

---

## Example JSON Graphs

### Example 1: Basic Spectrum
```json
{
  "metadata": {
    "name": "spectrum_basic",
    "version": "1.0"
  },
  "nodes": [
    { "id": "audio", "type": "audio_input" },
    { "id": "norm", "type": "frequency_normalize", "params": { "use_absolute": false } },
    { "id": "extract", "type": "band_extract", "params": { "start_bin": 0, "end_bin": 63 } },
    { "id": "colors", "type": "gradient_map", "params": { "palette": "hot" } },
    { "id": "flip", "type": "mirror" },
    { "id": "output", "type": "led_output" }
  ],
  "edges": [
    { "from": "audio", "to": "norm" },
    { "from": "norm", "to": "extract" },
    { "from": "extract", "to": "colors" },
    { "from": "colors", "to": "flip" },
    { "from": "flip", "to": "output" }
  ]
}
```

### Example 2: Bass-Only Visualization
```json
{
  "metadata": {
    "name": "spectrum_bass",
    "version": "1.0"
  },
  "nodes": [
    { "id": "audio", "type": "audio_input" },
    { "id": "norm", "type": "frequency_normalize", "params": { "use_absolute": false } },
    { "id": "extract", "type": "band_extract", "params": { "start_bin": 0, "end_bin": 16 } },
    { "id": "colors", "type": "gradient_map", "params": { "palette": "cool" } },
    { "id": "flip", "type": "mirror" },
    { "id": "output", "type": "led_output" }
  ],
  "edges": [
    { "from": "audio", "to": "norm" },
    { "from": "norm", "to": "extract" },
    { "from": "extract", "to": "colors" },
    { "from": "colors", "to": "flip" },
    { "from": "flip", "to": "output" }
  ]
}
```

---

## Audio Data Flow Specification (Technical Details)

### Sample Rate & Timing
- **Microphone**: I2S input at 16 kHz (pin config: 14/12/13 on ESP32-S3)
- **Chunk Size**: 128 samples = 8 ms (synchronized with Goertzel block)
- **Goertzel Block**: 512 samples = 32 ms (5 chunks, overlapping)
- **FFT Output**: ~100 Hz update rate (spectrum changes every 10 ms on average)
- **Pattern Render**: 60+ Hz (decoupled from audio)

### Frequency Bins (Goertzel Constant-Q)
- **Total Bins**: 64 (NUM_FREQS)
- **Frequency Mapping** (musical scale, B1 at 55 Hz):
  - Bin 0: 55 Hz (A1)
  - Bin 8: ~110 Hz (A2)
  - Bin 16: ~220 Hz (A3)
  - Bin 24: ~440 Hz (A4)
  - Bin 32: ~880 Hz (A5)
  - Bin 48: ~3.5 kHz
  - Bin 63: ~6.4 kHz

### Audio Data Snapshot (Thread-Safe)
```cpp
struct AudioDataSnapshot {
    // Spectrum data
    float spectrogram[NUM_FREQS];           // Auto-ranged (0-1)
    float spectrogram_smooth[NUM_FREQS];    // IIR smoothed
    float spectrogram_absolute[NUM_FREQS];  // Absolute loudness

    // Derived metrics
    float vu_level;                         // Overall loudness (auto-ranged)
    float vu_level_raw;                     // Raw before auto-ranging
    float novelty_curve;                    // Spectral change detection

    // Chroma (musical note classes)
    float chromagram[12];                   // C, C#, D, ... B

    // FFT (if enabled)
    float fft_smooth[128];                  // Additional frequency resolution

    // Metadata
    uint32_t update_counter;                // Freshness tracking
    uint32_t timestamp_us;                  // Capture time
};
```

### Stale Detection
- **Fresh**: age_ms < 50 ms (within 5 audio frames)
- **Acceptable**: 50-100 ms (pattern may be slightly delayed)
- **Stale**: age_ms > 100 ms (silence or system lag; fade out)

### Synchronization Points
1. **Microphone Task** (Core 1): Reads I2S, updates spectrum every 32 ms
2. **Audio Update** (Shared): Commits snapshot to `PATTERN_AUDIO_START()`
3. **Pattern Render** (Core 0): Reads snapshot, renders @ 60+ Hz
4. **LED Output** (Core 0): Transmits RGB to LED strip via RMT/SPI

---

## Dependencies & Blockers

### External Dependencies
1. **Goertzel FFT** (`firmware/src/audio/goertzel.h`): Frequency analysis (provided)
2. **Pattern Audio Interface** (`firmware/src/pattern_audio_interface.h`): Snapshot macros (provided)
3. **Graph Runtime** (`firmware/src/graph_codegen/graph_runtime.h`): Helper functions (provided, extended in M2)
4. **Stateful Nodes** (`firmware/src/stateful_nodes.h`): State containers (provided, extended in M2)

### Build System Dependencies
1. **Python 3.8+**: Code generation script
2. **CMake or platformio.ini**: Build integration
3. **pytest**: Optional, for codegen testing

### Blockers vs. Straightforward Items

| Item | Blocker? | Rationale |
|------|----------|-----------|
| Goertzel FFT library available | NO | Already implemented in firmware |
| Audio snapshot macros (PATTERN_AUDIO_START) | NO | Mature interface in place |
| Graph runtime helpers (gradients, mirrors) | NO | Core functions exist, minor extensions needed |
| Code generation approach | NO | Clear template-based strategy, low risk |
| Audio synchronization timing | YES* | Requires careful validation with real hardware; simulation alone insufficient |
| Performance budget (< 320 µs/frame) | MAYBE | Depends on optimization during M4-M5; worst case may require node fusion |
| Stateful audio smoothing (optional) | NO | Nice-to-have; basic version works without it |

*Audio sync blocker: Will need integration testing with actual microphone input to verify latency and freshness detection.

---

## Success Criteria (Final Validation)

All of the following must be satisfied:

1. **Compilation**
   - [ ] Generated C++ code compiles without warnings
   - [ ] All node types supported (6/6)
   - [ ] Code integrates into firmware build system

2. **Correctness**
   - [ ] Output behavior matches hand-written reference pattern
   - [ ] Spectrum normalization (auto-range, absolute) works correctly
   - [ ] Band extraction downsamples accurately
   - [ ] Color mapping matches palette
   - [ ] Buffer transforms (mirror) apply correctly

3. **Performance**
   - [ ] Render time < 320 µs/frame (< 2% of 16 ms budget)
   - [ ] Memory < 5 KB per pattern (state + temps)
   - [ ] Audio latency ≤ 20 ms (fresh data within 2 frames)

4. **Testing**
   - [ ] Unit tests: 100% pass rate
   - [ ] Integration test: audio fresh/stale detection
   - [ ] Performance test: meets budget
   - [ ] Code coverage > 90%

5. **Documentation**
   - [ ] Implementation guide complete
   - [ ] ADR written and accepted
   - [ ] Examples include >= 3 graph variants
   - [ ] Audio data flow documented

6. **Robustness**
   - [ ] No buffer overflows (checked in tests)
   - [ ] Graceful fallback on stale audio
   - [ ] Parameter validation (start_bin <= end_bin, etc.)
   - [ ] Edge cases handled (silence, max loudness, etc.)

---

## Next Steps (Post-PoC)

Once this PoC is validated:

1. **UI Integration**: Build graph editor for spectrum patterns
2. **Node Library Expansion**: Add more DSP nodes (smoothing, threshold, beat detection)
3. **Auto-Optimization**: Graph-to-graph transformations (node fusion, buffer pooling)
4. **Production Deployment**: Full spectrum pattern suite with variants
5. **Real-Time Codegen**: On-device graph compilation (optional future)

---

## References & Links

- **Goertzel Algorithm**: https://en.wikipedia.org/wiki/Goertzel_algorithm
- **Constant-Q Transform**: Musical frequency analysis technique (log-spaced bins)
- **Task 7 (Bloom PoC)**: Simpler graph example, useful reference
- **Audio Interface Docs**: `firmware/src/pattern_audio_interface.h` (comprehensive header)
- **Stateful Nodes**: `firmware/src/stateful_nodes.h` (state container definitions)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Status:** Draft (Ready for Review)

---

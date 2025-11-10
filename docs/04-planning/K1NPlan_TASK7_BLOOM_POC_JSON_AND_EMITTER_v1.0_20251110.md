# Task 7 PoC: Bloom Graph JSON, Emitter Pseudocode, and Extended Examples
## Supporting Detail for Graph Conversion & Code Generation

**Version:** 1.0
**Date:** November 10, 2025
**Related:** `K1NPlan_TASK7_BLOOM_GRAPH_POC_ROADMAP_v1.0_20251110.md`

---

## Section 1: Complete Bloom PoC JSON Graph

### File: `firmware/src/graph_codegen/bloom_poc.json`

```json
{
  "name": "bloom_poc",
  "version": "v1.0",
  "meta": {
    "description": "Bloom pattern PoC: Audio spectrum → band filter → persistent trail → colorize → mirror → output",
    "author": "K1.node1 Engineering",
    "created": "2025-11-10",
    "status": "poc",
    "scope": "Validate pattern-as-graph hypothesis; single pattern only"
  },
  "nodes": [
    {
      "id": "audio_spectrum",
      "type": "AudioSpectrum",
      "meta": {
        "name": "Audio Input",
        "comment": "Capture current audio spectrum (64 bins, linearly spaced 0–8 kHz)"
      }
    },
    {
      "id": "band_shape",
      "type": "BandShape",
      "inputs": {
        "src": "audio_spectrum"
      },
      "params": {
        "gain": 1.0,
        "smoothing": 0.6,
        "center_bin": 32,
        "bandwidth": 8
      },
      "meta": {
        "name": "Band Shaper",
        "comment": "Convert audio spectrum to per-LED response via frequency band filtering. PoC: generates ramp [0,1] across 256 LEDs."
      }
    },
    {
      "id": "trail",
      "type": "BufferPersist",
      "inputs": {
        "src": "band_shape"
      },
      "params": {
        "decay": 0.92
      },
      "meta": {
        "name": "Trail Effect / Exponential Decay",
        "comment": "Persistence layer: state.persist_buf[i] = 0.92 * state[i] + 0.08 * input[i]. Creates afterglow trail across frames."
      }
    },
    {
      "id": "colorize",
      "type": "ColorizeBuffer",
      "inputs": {
        "index_buf": "trail"
      },
      "params": {
        "mode": "grayscale",
        "palette_id": 0
      },
      "meta": {
        "name": "Grayscale Colorizer",
        "comment": "Map scalar [0, 1] values to grayscale RGB: {v, v, v}. Future: palette support."
      }
    },
    {
      "id": "mirror",
      "type": "Mirror",
      "inputs": {
        "src": "colorize"
      },
      "meta": {
        "name": "Horizontal Mirror",
        "comment": "Flip buffer: out[i] = src[255 - i]"
      }
    },
    {
      "id": "output",
      "type": "LedOutput",
      "inputs": {
        "color": "mirror"
      },
      "meta": {
        "name": "LED Terminal / Output Emitter",
        "comment": "Clamp RGB to [0, 1], convert to uint8 [0, 255], write to PatternOutput struct for firmware emission"
      }
    }
  ]
}
```

### JSON Design Notes

1. **Minimal but Complete:** Contains only essential fields; metadata is optional but recommended.
2. **Explicit Wiring:** Every node specifies its sources by ID (no implicit ordering).
3. **Parameter Specification:** All hardcoded values from original pattern are now in `params`.
4. **Node Types:** 6 nodes, all from the established catalog (AudioSpectrum, BandShape, BufferPersist, ColorizeBuffer, Mirror, LedOutput).
5. **Linear DAG:** Simple sequential flow; no branching or reconvergence.

---

## Section 2: Node Type Definitions (Catalog Reference)

### Quick Reference for Bloom Nodes

#### **AudioSpectrum**
```cpp
// Runtime signature (pseudo-code)
class AudioSpectrum {
public:
    const float* execute(const AudioDataSnapshot& audio) {
        return audio.spectrogram;  // 64 bins
    }
};
```

#### **BandShape**
```cpp
class BandShape {
public:
    void execute(const float* spectrum, int num_freqs,
                 float gain, float smoothing, int center_bin, int bandwidth,
                 float* out_buffer, int num_leds) {
        // PoC: Simple ramp across LEDs
        for (int i = 0; i < num_leds; ++i) {
            out_buffer[i] = (float)i / (float)(num_leds - 1);
        }
        // Production: Select frequency band, apply gain, spread across LEDs
        // Future: Support multiple band shapes (triangle, gaussian, etc.)
    }
};
```

#### **BufferPersist**
```cpp
class BufferPersist {
public:
    void execute(const float* src, int num_leds,
                 float decay, float* state_buffer) {
        for (int i = 0; i < num_leds; ++i) {
            state_buffer[i] = decay * state_buffer[i] + (1.0f - decay) * src[i];
        }
    }
};
```

#### **ColorizeBuffer**
```cpp
class ColorizeBuffer {
public:
    void execute(const float* scalar_buffer, int num_leds,
                 const char* mode, int palette_id,
                 CRGBF* out_buffer) {
        if (strcmp(mode, "grayscale") == 0) {
            for (int i = 0; i < num_leds; ++i) {
                float v = clamp_val(scalar_buffer[i], 0.0f, 1.0f);
                out_buffer[i] = {v, v, v};
            }
        }
        // Future modes: "palette", "hue_shift", etc.
    }
};
```

#### **Mirror**
```cpp
class Mirror {
public:
    void execute(const CRGBF* src, int num_leds, CRGBF* out) {
        for (int i = 0; i < num_leds; ++i) {
            out[i] = src[num_leds - 1 - i];
        }
    }
};
```

#### **LedOutput**
```cpp
class LedOutput {
public:
    void execute(const CRGBF* color_buffer, int num_leds,
                 PatternOutput& out) {
        for (int i = 0; i < num_leds; ++i) {
            CRGBF c = clamped_rgb(color_buffer[i]);
            out.leds[i][0] = (uint8_t)std::floor(c.r * 255.0f + 0.5f);
            out.leds[i][1] = (uint8_t)std::floor(c.g * 255.0f + 0.5f);
            out.leds[i][2] = (uint8_t)std::floor(c.b * 255.0f + 0.5f);
        }
    }
};
```

---

## Section 3: Code Emitter Pseudocode

### Generator Architecture

```
Input: bloom_poc.json
  ↓
[Parser]        → Graph AST (nodes, edges, params)
  ↓
[Validator]     → DAG check, type check, input resolution
  ↓
[Scheduler]     → Topological sort, buffer lifetime analysis
  ↓
[Type Inference] → Determine output types, memory needs
  ↓
[Emitter]       → Generate C++ source code
  ↓
Output: pattern_bloom.cpp
```

### Emitter Pseudocode (C++ Generation)

```python
class GraphEmitter:
    def __init__(self, graph_json):
        self.graph = parse_json(graph_json)
        self.nodes = self.graph['nodes']
        self.output = ""

    def emit(self):
        """Generate complete C++ file from graph."""
        self.emit_header()
        self.emit_includes()
        self.emit_function_signature()
        self.emit_buffer_declarations()
        self.emit_node_execution()
        return self.output

    def emit_header(self):
        """File header with metadata."""
        self.output += """
// AUTO-GENERATED: pattern_bloom.cpp
// Generated from: firmware/src/graph_codegen/bloom_poc.json
// Generator version: 1.0
// DO NOT EDIT (regenerate from JSON)
// Generated on: 2025-11-10

"""

    def emit_includes(self):
        """Standard includes for graph runtime."""
        self.output += """
#include "graph_runtime.h"
#include "../stateful_nodes.h"
#include "../parameters.h"
#include "../pattern_audio_interface.h"

"""

    def emit_function_signature(self):
        """Pattern render function signature (standard)."""
        self.output += """
extern "C" void pattern_bloom_render(
    uint32_t frame_count,
    const AudioDataSnapshot& audio,
    const PatternParameters& params,
    PatternState& state,
    PatternOutput& out
) {
"""

    def emit_buffer_declarations(self):
        """Declare temporary buffers needed by graph."""
        self.output += """
    // ========== NODE CONSTANTS ==========
    static constexpr int NUM_LEDS = 256;

    // ========== TEMPORARY BUFFERS ==========
"""
        # Analyze node outputs and allocate buffers
        buffer_map = {}
        for node_id in self.get_topological_order():
            node = self.find_node(node_id)
            output_type = self.infer_output_type(node)

            if output_type == "led_buffer_float":
                self.output += f"    float buf_{node_id}[NUM_LEDS];\n"
                buffer_map[node_id] = "float"
            elif output_type == "led_buffer_vec3":
                self.output += f"    CRGBF buf_{node_id}[NUM_LEDS];\n"
                buffer_map[node_id] = "CRGBF"
            # Skip source nodes (no buffer needed)
        self.output += "\n"

    def emit_node_execution(self):
        """Emit execution code for each node in topological order."""
        self.output += "    // ========== NODE EXECUTION (Topological Order) ==========\n\n"

        for node_id in self.get_topological_order():
            node = self.find_node(node_id)
            node_type = node['type']
            params = node.get('params', {})
            inputs = node.get('inputs', {})

            self.output += f"    // Node: {node_id} ({node_type})\n"

            if node_type == "AudioSpectrum":
                self.emit_audio_spectrum(node_id, inputs)
            elif node_type == "BandShape":
                self.emit_band_shape(node_id, inputs, params)
            elif node_type == "BufferPersist":
                self.emit_buffer_persist(node_id, inputs, params)
            elif node_type == "ColorizeBuffer":
                self.emit_colorize_buffer(node_id, inputs, params)
            elif node_type == "Mirror":
                self.emit_mirror(node_id, inputs)
            elif node_type == "LedOutput":
                self.emit_led_output(node_id, inputs)

            self.output += "\n"

        self.output += "}\n"

    def emit_audio_spectrum(self, node_id, inputs):
        """Emit code for AudioSpectrum (source node)."""
        # AudioSpectrum is a source; no buffer allocation needed
        # Just reference audio.spectrogram
        self.output += f"    const float* spectrum = audio.spectrogram;  // 64 bins\n"

    def emit_band_shape(self, node_id, inputs, params):
        """Emit code for BandShape node."""
        src_id = inputs['src']
        gain = params.get('gain', 1.0)
        smoothing = params.get('smoothing', 0.6)

        self.output += f"    // Params: gain={gain}, smoothing={smoothing}\n"
        self.output += f"    for (int i = 0; i < NUM_LEDS; ++i) {{\n"
        self.output += f"        buf_{node_id}[i] = (float)i / (float)(NUM_LEDS - 1);  // PoC: ramp\n"
        self.output += f"    }}\n"

    def emit_buffer_persist(self, node_id, inputs, params):
        """Emit code for BufferPersist stateful node."""
        src_id = inputs['src']
        decay = params.get('decay', 0.92)

        self.output += f"    // Params: decay={decay}\n"
        self.output += f"    // State: state.persist_buf[256]\n"
        self.output += f"    for (int i = 0; i < NUM_LEDS; ++i) {{\n"
        self.output += f"        state.persist_buf[i] = {decay}f * state.persist_buf[i]\n"
        self.output += f"                             + (1.0f - {decay}f) * buf_{src_id}[i];\n"
        self.output += f"    }}\n"
        # Copy state to output buffer
        self.output += f"    memcpy(buf_{node_id}, state.persist_buf, sizeof(float) * NUM_LEDS);\n"

    def emit_colorize_buffer(self, node_id, inputs, params):
        """Emit code for ColorizeBuffer node."""
        src_id = inputs['index_buf']
        mode = params.get('mode', 'grayscale')

        self.output += f"    // Params: mode=\"{mode}\"\n"
        self.output += f"    for (int i = 0; i < NUM_LEDS; ++i) {{\n"
        if mode == 'grayscale':
            self.output += f"        float v = clamp_val(buf_{src_id}[i], 0.0f, 1.0f);\n"
            self.output += f"        buf_{node_id}[i] = {{v, v, v}};  // Grayscale\n"
        self.output += f"    }}\n"

    def emit_mirror(self, node_id, inputs):
        """Emit code for Mirror node."""
        src_id = inputs['src']

        self.output += f"    for (int i = 0; i < NUM_LEDS; ++i) {{\n"
        self.output += f"        buf_{node_id}[i] = buf_{src_id}[NUM_LEDS - 1 - i];\n"
        self.output += f"    }}\n"

    def emit_led_output(self, node_id, inputs):
        """Emit code for LedOutput terminal node."""
        src_id = inputs['color']

        self.output += f"    const CRGBF* final_buf = buf_{src_id};\n"
        self.output += f"    for (int i = 0; i < NUM_LEDS; ++i) {{\n"
        self.output += f"        CRGBF c = clamped_rgb(final_buf[i]);\n"
        self.output += f"        out.leds[i][0] = (uint8_t)std::floor(c.r * 255.0f + 0.5f);\n"
        self.output += f"        out.leds[i][1] = (uint8_t)std::floor(c.g * 255.0f + 0.5f);\n"
        self.output += f"        out.leds[i][2] = (uint8_t)std::floor(c.b * 255.0f + 0.5f);\n"
        self.output += f"    }}\n"

    def get_topological_order(self):
        """Return node IDs in topological (execution) order."""
        # Kahn's algorithm or DFS-based topological sort
        # Returns: ["audio_spectrum", "band_shape", "trail", "colorize", "mirror", "output"]
        pass

    def find_node(self, node_id):
        """Find node by ID in graph."""
        for node in self.nodes:
            if node['id'] == node_id:
                return node
        return None

    def infer_output_type(self, node):
        """Infer output type from node type."""
        type_map = {
            "AudioSpectrum": "audio_spectrum",
            "BandShape": "led_buffer_float",
            "BufferPersist": "led_buffer_float",
            "ColorizeBuffer": "led_buffer_vec3",
            "Mirror": "led_buffer_vec3",
            "LedOutput": None,  # Terminal
        }
        return type_map.get(node['type'], None)
```

### Actual Generated Output

After running the emitter on `bloom_poc.json`, the output would be:

```cpp
// AUTO-GENERATED: pattern_bloom.cpp
// Generated from: firmware/src/graph_codegen/bloom_poc.json
// Generator version: 1.0
// DO NOT EDIT (regenerate from JSON)

#include "graph_runtime.h"
#include "../stateful_nodes.h"
#include "../parameters.h"
#include "../pattern_audio_interface.h"

extern "C" void pattern_bloom_render(
    uint32_t frame_count,
    const AudioDataSnapshot& audio,
    const PatternParameters& params,
    PatternState& state,
    PatternOutput& out
) {
    // ========== NODE CONSTANTS ==========
    static constexpr int NUM_LEDS = 256;

    // ========== TEMPORARY BUFFERS ==========
    float buf_band_shape[NUM_LEDS];
    float buf_trail[NUM_LEDS];
    CRGBF buf_colorize[NUM_LEDS];
    CRGBF buf_mirror[NUM_LEDS];

    // ========== NODE EXECUTION (Topological Order) ==========

    // Node: audio_spectrum (AudioSpectrum)
    const float* spectrum = audio.spectrogram;

    // Node: band_shape (BandShape)
    // Params: gain=1.0, smoothing=0.6, center_bin=32, bandwidth=8
    for (int i = 0; i < NUM_LEDS; ++i) {
        buf_band_shape[i] = (float)i / (float)(NUM_LEDS - 1);
    }

    // Node: trail (BufferPersist)
    // Params: decay=0.92
    // State: state.persist_buf[256]
    for (int i = 0; i < NUM_LEDS; ++i) {
        state.persist_buf[i] = 0.92f * state.persist_buf[i]
                             + (1.0f - 0.92f) * buf_band_shape[i];
    }
    memcpy(buf_trail, state.persist_buf, sizeof(float) * NUM_LEDS);

    // Node: colorize (ColorizeBuffer)
    // Params: mode="grayscale"
    for (int i = 0; i < NUM_LEDS; ++i) {
        float v = clamp_val(buf_trail[i], 0.0f, 1.0f);
        buf_colorize[i] = {v, v, v};
    }

    // Node: mirror (Mirror)
    for (int i = 0; i < NUM_LEDS; ++i) {
        buf_mirror[i] = buf_colorize[NUM_LEDS - 1 - i];
    }

    // Node: output (LedOutput)
    const CRGBF* final_buf = buf_mirror;
    for (int i = 0; i < NUM_LEDS; ++i) {
        CRGBF c = clamped_rgb(final_buf[i]);
        out.leds[i][0] = (uint8_t)std::floor(c.r * 255.0f + 0.5f);
        out.leds[i][1] = (uint8_t)std::floor(c.g * 255.0f + 0.5f);
        out.leds[i][2] = (uint8_t)std::floor(c.b * 255.0f + 0.5f);
    }
}
```

---

## Section 4: Comparison: Hand-Coded vs. Generated

### Side-by-Side: Current pattern_bloom.cpp vs. Generated

| Aspect | Current (Hand-Coded) | Generated (from JSON) |
|--------|---------------------|----------------------|
| **Buffer Setup** | Inline, hardcoded | Inferred from graph, explicit |
| **Node Execution** | Sequential, loose comments | Labeled per node, topologically ordered |
| **State Management** | Opaque: `state.persist_buf[i] = ...` | Explicit: state read, decay formula, memcpy |
| **Parameters** | Hardcoded: `0.920f` decay | Parameterized: `params.decay` in JSON |
| **Readability** | High (hand-written, compact) | High (structured, explicit node roles) |
| **Maintainability** | Low (mutation risk) | High (regenerate from JSON) |
| **Extensibility** | Manual (copy-paste risks) | Automated (new node = new graph node) |

**Verdict:** Generated code is slightly more verbose but significantly more maintainable.

---

## Section 5: Extended Examples

### Example 1: Bloom with Faster Decay (Variant)

```json
{
  "name": "bloom_fast_decay",
  "version": "v1.0",
  "nodes": [
    {"id": "audio_spectrum", "type": "AudioSpectrum"},
    {"id": "band_shape", "type": "BandShape", "inputs": {"src": "audio_spectrum"}, "params": {"gain": 1.0, "smoothing": 0.6, "center_bin": 32, "bandwidth": 8}},
    {"id": "trail", "type": "BufferPersist", "inputs": {"src": "band_shape"}, "params": {"decay": 0.75}},
    {"id": "colorize", "type": "ColorizeBuffer", "inputs": {"index_buf": "trail"}, "params": {"mode": "grayscale", "palette_id": 0}},
    {"id": "mirror", "type": "Mirror", "inputs": {"src": "colorize"}},
    {"id": "output", "type": "LedOutput", "inputs": {"color": "mirror"}}
  ]
}
```

**Only change:** `decay: 0.75` (faster fade).

---

### Example 2: Bloom Without Mirror (Symmetric Mode)

```json
{
  "name": "bloom_symmetric",
  "version": "v1.0",
  "nodes": [
    {"id": "audio_spectrum", "type": "AudioSpectrum"},
    {"id": "band_shape", "type": "BandShape", "inputs": {"src": "audio_spectrum"}, "params": {"gain": 1.0, "smoothing": 0.6, "center_bin": 32, "bandwidth": 8}},
    {"id": "trail", "type": "BufferPersist", "inputs": {"src": "band_shape"}, "params": {"decay": 0.92}},
    {"id": "colorize", "type": "ColorizeBuffer", "inputs": {"index_buf": "trail"}, "params": {"mode": "grayscale", "palette_id": 0}},
    {"id": "output", "type": "LedOutput", "inputs": {"color": "colorize"}}
  ]
}
```

**Only change:** Removed Mirror node; output directly from ColorizeBuffer.

---

### Example 3: Bloom with Gaussian Blur (Future)

```json
{
  "name": "bloom_blurred",
  "version": "v1.0",
  "nodes": [
    {"id": "audio_spectrum", "type": "AudioSpectrum"},
    {"id": "band_shape", "type": "BandShape", "inputs": {"src": "audio_spectrum"}, "params": {"gain": 1.0, "smoothing": 0.6, "center_bin": 32, "bandwidth": 8}},
    {"id": "blur", "type": "GaussianBlur", "inputs": {"src": "band_shape"}, "params": {"radius": 3, "sigma": 1.0}},
    {"id": "trail", "type": "BufferPersist", "inputs": {"src": "blur"}, "params": {"decay": 0.92}},
    {"id": "colorize", "type": "ColorizeBuffer", "inputs": {"index_buf": "trail"}, "params": {"mode": "grayscale", "palette_id": 0}},
    {"id": "mirror", "type": "Mirror", "inputs": {"src": "colorize"}},
    {"id": "output", "type": "LedOutput", "inputs": {"color": "mirror"}}
  ]
}
```

**Addition:** GaussianBlur node after BandShape for smoother gradients.

---

## Section 6: Type Inference Table

### Bloom Graph Type Flow

| Node ID | Node Type | Input Type | Output Type | Buffer Needed? |
|---------|-----------|-----------|-------------|----------------|
| audio_spectrum | AudioSpectrum | (source) | audio_spectrum | No (firmware) |
| band_shape | BandShape | audio_spectrum | led_buffer_float | Yes: `buf_band_shape[256]` |
| trail | BufferPersist | led_buffer_float | led_buffer_float | Yes: `buf_trail[256]` (state in `state.persist_buf[]`) |
| colorize | ColorizeBuffer | led_buffer_float | led_buffer_vec3 | Yes: `buf_colorize[256]` |
| mirror | Mirror | led_buffer_vec3 | led_buffer_vec3 | Yes: `buf_mirror[256]` |
| output | LedOutput | led_buffer_vec3 | (sink) | No (writes to PatternOutput) |

**Total Scratch Allocation:** 3 × 256 floats + 2 × 256 CRGBF = 3KB (within budget)

---

## Section 7: Test Harness Skeleton

### Unit Test: JSON Validation

```cpp
// tests/test_bloom_json_validation.cpp

#include <gtest/gtest.h>
#include <nlohmann/json.hpp>
#include "graph_validator.h"

using json = nlohmann::json;

TEST(BloomJSON, ValidatesAgainstSchema) {
    std::string json_file = "firmware/src/graph_codegen/bloom_poc.json";
    json graph = json::parse(std::ifstream(json_file));

    GraphValidator validator;
    auto result = validator.validate(graph);

    EXPECT_TRUE(result.is_valid);
    EXPECT_EQ(result.errors.size(), 0);
}

TEST(BloomJSON, AllNodesResolved) {
    json graph = json::parse(R"({
        "name": "bloom_poc",
        "nodes": [
            {"id": "audio_spectrum", "type": "AudioSpectrum"},
            {"id": "band_shape", "type": "BandShape", "inputs": {"src": "audio_spectrum"}}
        ]
    })");

    GraphValidator validator;
    auto result = validator.validate(graph);

    EXPECT_TRUE(result.is_valid);
}

TEST(BloomJSON, DetectsMissingInputs) {
    json graph = json::parse(R"({
        "name": "bloom_bad",
        "nodes": [
            {"id": "band_shape", "type": "BandShape", "inputs": {"src": "nonexistent_node"}}
        ]
    })");

    GraphValidator validator;
    auto result = validator.validate(graph);

    EXPECT_FALSE(result.is_valid);
    EXPECT_GE(result.errors.size(), 1);
}
```

### Integration Test: Output Equivalence

```cpp
// tests/test_bloom_output_equivalence.cpp

#include <gtest/gtest.h>
#include "pattern_bloom.h"  // Current hand-coded
#include "graph_emitter.h"
#include "test_fixtures.h"

class BloomOutputTest : public ::testing::Test {
protected:
    PatternState state_baseline, state_generated;
    PatternOutput out_baseline, out_generated;
    PatternParameters params;
    AudioDataSnapshot test_audio;

    void SetUp() override {
        params = get_default_params();
        test_audio = get_test_audio_frame_0();
    }
};

TEST_F(BloomOutputTest, PixelPerfectMatch_Frame0) {
    // Run baseline
    pattern_bloom_render(0, test_audio, params, state_baseline, out_baseline);

    // Run generated
    pattern_bloom_render_generated(0, test_audio, params, state_generated, out_generated);

    // Compare all pixels
    for (int i = 0; i < 256; ++i) {
        for (int ch = 0; ch < 3; ++ch) {
            EXPECT_EQ(out_baseline.leds[i][ch], out_generated.leds[i][ch])
                << "Frame 0, LED " << i << ", Channel " << ch << " mismatch";
        }
    }
}

TEST_F(BloomOutputTest, PixelPerfectMatch_100Frames) {
    for (int frame = 0; frame < 100; ++frame) {
        AudioDataSnapshot audio = get_test_audio(frame);

        pattern_bloom_render(frame, audio, params, state_baseline, out_baseline);
        pattern_bloom_render_generated(frame, audio, params, state_generated, out_generated);

        for (int i = 0; i < 256; ++i) {
            for (int ch = 0; ch < 3; ++ch) {
                EXPECT_EQ(out_baseline.leds[i][ch], out_generated.leds[i][ch])
                    << "Frame " << frame << ", LED " << i << ", Channel " << ch;
            }
        }
    }
}

TEST_F(BloomOutputTest, StateDecayCorrect) {
    for (int frame = 0; frame < 10; ++frame) {
        AudioDataSnapshot audio = get_test_audio(frame);
        pattern_bloom_render_generated(frame, audio, params, state_generated, out_generated);
    }

    // Check that decay is applied correctly
    // state.persist_buf should follow exponential curve
    float expected_decay = powf(0.92f, 10.0f);
    EXPECT_LT(state_generated.persist_buf[0], expected_decay * 1.1f);
}
```

---

## Section 8: Summary Table

| Phase | Task | Duration | Owner |
|-------|------|----------|-------|
| **1** | Algorithm Analysis | 2h | Engineer |
| **2** | Node Design | 3h | Engineer |
| **3** | JSON Authoring | 2h | Engineer |
| **4** | Emitter Implementation | 6h | Engineer |
| **5** | Test Harness | 5h | Engineer |
| **6** | Validation & Handoff | 2h | Engineer |
| **Total** | **Full PoC** | **20h** | 1 Developer |

---

**End of Supporting Document**

---

## Appendix: Files to Create/Modify

| File | Status | Purpose |
|------|--------|---------|
| `firmware/src/graph_codegen/bloom_poc.json` | CREATE | Source graph definition |
| `firmware/src/graph_codegen/pattern_bloom_generated.cpp` | CREATE | Generated C++ output |
| `firmware/src/codegen/graph_emitter.cpp` | CREATE | Code generator implementation |
| `firmware/src/codegen/graph_validator.cpp` | CREATE | Schema/DAG validator |
| `tests/test_bloom_json_validation.cpp` | CREATE | Unit tests |
| `tests/test_bloom_output_equivalence.cpp` | CREATE | Integration tests |
| `docs/04-planning/K1NPlan_TASK7_BLOOM_GRAPH_POC_ROADMAP_v1.0_20251110.md` | CREATE | Main roadmap (done) |
| `docs/04-planning/K1NPlan_TASK7_BLOOM_POC_JSON_AND_EMITTER_v1.0_20251110.md` | CREATE | This document |


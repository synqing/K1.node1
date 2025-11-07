---
author: Claude Agent (from Phase 2D1 Master Strategy)
date: 2025-11-05
status: published
intent: Technical context for Agent B (Graph System Architect) executing node graph PoC and conditional Path A/B
references:
  - ../../PHASE_2_MASTER_PRD.txt (Workstream B + Workstream D Path A)
  - ../../../docs/01-architecture/node_system_architecture.md
  - ../../../firmware/src/patterns/ (hardcoded pattern reference)
---

# Agent B: Graph System Architect Context Appendix

## Role & Responsibilities

**Engineer:** Graph System Architect & Code Generation Specialist
**Primary Focus:** Node graph system design, code generation pipeline, Pattern PoC validation
**Workstreams:** Graph PoC (Workstream B, Weeks 1-2), Conditional Path A (Weeks 3-8 if PoC passes)
**Timeline:**
- Weeks 1-2: PoC (28 hours)
- Weeks 3-8: Full implementation (200+ hours, IF Go decision)
**Deliverable Deadline:** Nov 12 (PoC validation), Nov 13 (decision gate input)

---

## Task Ownership (Master PRD Tasks)

**Week 1-2 Graph PoC (Workstream B):**
- **Task 6:** Design Graph System Architecture → node type taxonomy, codegen pipeline
- **Task 7:** Implement Bloom Pattern as Graph → first pattern conversion proof
- **Task 8:** Implement Spectrum Pattern as Graph → audio-reactive validation
- **Task 9:** Implement Stateful Node System → beat detector, FFT buffers
- **Task 10:** Memory & Performance Profiling → validate <2% overhead, <5KB/node

**Week 3-8 Path A (IF PoC Passes):**
- **Task 15:** Extend Codegen for Full 35-40 Node Types
- **Task 16:** Migrate 8-10 High-Value Patterns to Graphs
- (Phase C.1, C.2 in PHASE_2_MASTER_PRD.txt)

---

## Graph Architecture Deep Dive

### 35-40 Node Type Taxonomy

**Node System is the USP.** This is worth $50-150M. Design it right.

#### INPUT NODES (7 types)
- **TimeNode:** Elapsed time in seconds, cyclic time (0-1), cycle counter
- **ParameterNode:** User-controlled sliders (100+ parameters)
- **AudioNode:** Raw audio input (frequency bins, energy, beat detection)
- **RandomNode:** Seeded random number generator (0-1)
- **SensorNode:** Device sensors (temperature, WiFi RSSI)
- **PatternIndexNode:** Current pattern ID (useful for multi-pattern chains)
- **TickNode:** Frame tick counter (0, 1, 2, ...)

#### TRANSFORM NODES (12 types)
- **MathNode:** Basic arithmetic (+, -, *, /, %, ^)
- **CurveNode:** Cubic bezier, ease-in/out/in-out
- **InterpolateNode:** Lerp, cosine interpolation
- **RemapNode:** Map [0-1] → [min-max] with curves
- **MultiplyNode:** Scalar multiplication (brightness, speed)
- **AddNode:** Add multiple inputs
- **SelectNode:** If-then-else (choose output A or B based on condition)
- **LookupNode:** 1D LUT (for palettes, waveforms)
- **ScaleNode:** Min/max normalization
- **ClampNode:** Clamp to [0-1]
- **AbsNode:** Absolute value
- **NoiseNode:** Perlin/Simplex noise (procedural)

#### GENERATOR NODES (6 types)
- **GradientNode:** Horizontal/vertical/radial color gradient
- **WaveNode:** Sine, square, triangle, sawtooth waveforms
- **SolidNode:** Constant color
- **PatternNode:** Reference to existing hardcoded pattern (for hybrid graphs)
- **ParticleNode:** Particle system generator (stars, sparkles)
- **NoiseGradientNode:** Noise-based color generation

#### STATEFUL NODES (8 types) ← CRITICAL FOR AUDIO REACTIVITY
- **BeatDetectorNode:** Tracks beat history (last 4 beats) → outputs beat phase (0-1)
- **FFTNode:** Frequency analysis (energy per band: bass, mid, treble)
- **EnvelopeNode:** Attack/decay envelope (smooth transitions)
- **HistoryNode:** Remember previous N values (for smoothing)
- **IntegratorNode:** Running sum (cumulative energy)
- **MovingAverageNode:** Smooth n-tap FIR filter
- **StateBufferNode:** Generic state (beat counter, animation progress)
- **AccumulatorNode:** Accumulates value over time (useful for animation)

#### OUTPUT NODES (2 types)
- **LEDOutputNode:** Raw LED color (R, G, B)
- **MirrorNode:** Mirror/flip pattern across axes

**Total:** 7 + 12 + 6 + 8 + 2 = **35 core node types** (expandable to 40)

---

### Node Graph Architecture: Data Flow Model

```
INPUT NODES
  ├─ TimeNode → [0-1]
  ├─ ParameterNode → [0-100]
  └─ AudioNode → {bass: 0-1, mid: 0-1, treble: 0-1, beat: 0/1}
        ↓
TRANSFORM NODES
  ├─ CurveNode (ease audio energy)
  ├─ RemapNode (scale to brightness)
  └─ MultiplyNode (apply effect intensity)
        ↓
GENERATOR NODES
  ├─ GradientNode (base color from time)
  └─ WaveNode (overlay pattern)
        ↓
STATEFUL NODES
  ├─ BeatDetectorNode (smooth beat transitions)
  └─ EnvelopeNode (amplitude scaling)
        ↓
OUTPUT NODES
  └─ LEDOutputNode → {R, G, B} per pixel
```

**Graph Representation (JSON):**
```json
{
  "nodes": [
    {
      "id": "time",
      "type": "TimeNode",
      "config": { "scale": 1.0 }
    },
    {
      "id": "curve",
      "type": "CurveNode",
      "config": { "curve": "ease-in-out" },
      "inputs": { "value": "time.output" }
    },
    {
      "id": "gradient",
      "type": "GradientNode",
      "config": { "direction": "horizontal", "colors": ["#FF0000", "#00FF00"] },
      "inputs": { "progress": "curve.output" }
    }
  ],
  "outputs": [
    { "nodeId": "gradient", "nodeOutput": "color" }
  ]
}
```

---

### Code Generation Pipeline: JSON → C++

**Phase 1: Graph Validation**
```cpp
// Validate graph structure before codegen
bool validate_graph(const json& graph) {
    // 1. Check all node types are registered
    // 2. Check all input connections exist
    // 3. Check no cycles (acyclic constraint)
    // 4. Check type compatibility (output of A matches input of B)
    // 5. Check memory budget (total state < 5KB per pattern)
    return true;
}
```

**Phase 2: C++ Code Generation**
```cpp
// Graph IR → C++ code
std::string codegen_graph(const json& graph) {
    std::string cpp_code;

    // 1. Generate includes
    cpp_code += "#include <cmath>\n";
    cpp_code += "#include <stdint.h>\n\n";

    // 2. Generate state struct
    cpp_code += "struct PatternState {\n";
    for (auto& node : graph["nodes"]) {
        if (is_stateful(node)) {
            cpp_code += "  " + state_type(node) + " " + node["id"].get<std::string>() + ";\n";
        }
    }
    cpp_code += "};\n\n";

    // 3. Generate update function
    cpp_code += "void update_frame(PatternState& state, const AudioInput& audio, uint32_t tick) {\n";
    for (auto& node : graph["nodes"]) {
        cpp_code += codegen_node(node, graph) + "\n";
    }
    cpp_code += "}\n\n";

    // 4. Generate render function
    cpp_code += "void render_frame(const PatternState& state, uint8_t* framebuffer) {\n";
    cpp_code += "  for (int i = 0; i < LED_COUNT; i++) {\n";
    cpp_code += "    framebuffer[i * 3] = (uint8_t)(state.output.r * 255);\n";
    cpp_code += "    framebuffer[i * 3 + 1] = (uint8_t)(state.output.g * 255);\n";
    cpp_code += "    framebuffer[i * 3 + 2] = (uint8_t)(state.output.b * 255);\n";
    cpp_code += "  }\n";
    cpp_code += "}\n";

    return cpp_code;
}
```

**Phase 3: Compilation**
```bash
# Generated C++ → Object file → Linked into firmware
gcc -c -O3 generated_pattern_001.cpp -o generated_pattern_001.o
ld -r generated_pattern_*.o firmware.elf
```

**Performance Target:**
- Code generation: < 2 seconds for any graph
- Compile time: < 5 seconds for full firmware with new pattern
- Runtime overhead: < 2% FPS impact vs hardcoded

---

### Stateful Node Implementation Strategy

**Challenge:** Audio-reactive patterns need state (beat history, FFT bins)

**Example: BeatDetectorNode**

```cpp
struct BeatDetectorState {
    float beat_history[4];  // Last 4 beat times
    uint32_t last_beat_tick;
    float beat_strength;    // 0-1 (smoothed)
};

void beat_detector_update(BeatDetectorState& state, const AudioInput& audio) {
    // 1. Detect beat in audio energy
    float energy = audio.bass + audio.mid + audio.treble;
    bool is_beat = energy > 0.7f && (xTaskGetTickCount() - state.last_beat_tick) > 200;  // Min 200ms between beats

    if (is_beat) {
        // 2. Shift history
        state.beat_history[3] = state.beat_history[2];
        state.beat_history[2] = state.beat_history[1];
        state.beat_history[1] = state.beat_history[0];
        state.beat_history[0] = xTaskGetTickCount() / 1000.0f;  // Beat time in seconds
        state.last_beat_tick = xTaskGetTickCount();
    }

    // 3. Calculate beat phase (0-1, where 1 = next beat)
    float time_since_beat = (xTaskGetTickCount() - state.last_beat_tick) / 1000.0f;
    float time_to_next_beat = 0.5f;  // Assume 120 BPM = 0.5s per beat
    state.beat_strength = 1.0f - clamp(time_since_beat / time_to_next_beat, 0.0f, 1.0f);
}

float beat_detector_output(const BeatDetectorState& state) {
    return state.beat_strength;
}
```

**Memory Budget:**
- BeatDetectorNode: 20 bytes (4 floats + uint32_t + padding)
- FFTNode: 128 bytes (32 frequency bins)
- EnvelopeNode: 8 bytes (2 floats)
- **Total per stateful node:** 50-150 bytes

**Constraint:** < 1KB for all stateful nodes per pattern (10+ nodes possible)

---

## Bloom & Spectrum Pattern Migration: Reference Implementation

### Pattern 1: Bloom (Color Explosion)

**Current Hardcoded Implementation:**
```cpp
// firmware/src/patterns/bloom.cpp
void pattern_bloom_update(uint8_t* framebuffer, uint32_t tick) {
    float time = tick / 1000.0f;
    float brightness = sin(time * 2.0f);

    for (int i = 0; i < LED_COUNT; i++) {
        float dist = fabs(i - LED_COUNT / 2) / (float)(LED_COUNT / 2);
        float color = brightness * (1.0f - dist);
        framebuffer[i * 3] = (uint8_t)(color * 255);
        framebuffer[i * 3 + 1] = 0;
        framebuffer[i * 3 + 2] = 0;
    }
}
```

**Graph Representation:**
```json
{
  "name": "Bloom",
  "nodes": [
    { "id": "time", "type": "TimeNode", "config": { "scale": 2.0 } },
    { "id": "wave", "type": "WaveNode", "config": { "waveform": "sine" }, "inputs": { "phase": "time.output" } },
    { "id": "gradient", "type": "GradientNode", "config": { "direction": "radial", "colors": ["#FF0000", "#000000"] }, "inputs": { "progress": "wave.output" } }
  ]
}
```

**Generated C++ (pseudocode):**
```cpp
// Generated from graph
struct BloomState {
    // No stateful nodes
};

void bloom_update(BloomState& state, const AudioInput& audio, uint32_t tick) {
    float time_val = (tick % 1000) / 1000.0f * 2.0f;
    float wave_val = sinf(time_val * M_PI * 2.0f);

    for (int i = 0; i < LED_COUNT; i++) {
        float dist = fabsf(i - LED_COUNT / 2.0f) / (LED_COUNT / 2.0f);
        float grad_color = wave_val * (1.0f - dist);

        framebuffer[i * 3] = (uint8_t)(grad_color * 255);
        framebuffer[i * 3 + 1] = 0;
        framebuffer[i * 3 + 2] = 0;
    }
}
```

**Validation:**
- [ ] Visual comparison: original vs generated (pixel-by-pixel diff < 5% tolerance)
- [ ] FPS measurement: baseline vs generated
- [ ] Memory: state size < 100 bytes

---

### Pattern 2: Spectrum (Audio-Reactive Bars)

**Current Hardcoded Implementation:**
```cpp
// firmware/src/patterns/spectrum.cpp
void pattern_spectrum_update(uint8_t* framebuffer, const AudioInput& audio) {
    // 3 frequency bands mapped to LED sections
    float bass = audio.bass;       // Low frequencies
    float mid = audio.mid;         // Mid frequencies
    float treble = audio.treble;   // High frequencies

    for (int i = 0; i < LED_COUNT / 3; i++) {
        framebuffer[i * 3] = (uint8_t)(bass * 255);        // Red = bass
        framebuffer[(i + LED_COUNT/3) * 3] = (uint8_t)(mid * 255);      // Green = mid
        framebuffer[(i + 2*LED_COUNT/3) * 3 + 1] = (uint8_t)(treble * 255); // Blue = treble
    }
}
```

**Graph Representation:**
```json
{
  "name": "Spectrum",
  "nodes": [
    { "id": "audio_bass", "type": "AudioNode", "config": { "band": "bass" } },
    { "id": "audio_mid", "type": "AudioNode", "config": { "band": "mid" } },
    { "id": "audio_treble", "type": "AudioNode", "config": { "band": "treble" } },
    { "id": "envelope_bass", "type": "EnvelopeNode", "inputs": { "value": "audio_bass.output" } },
    { "id": "envelope_mid", "type": "EnvelopeNode", "inputs": { "value": "audio_mid.output" } },
    { "id": "envelope_treble", "type": "EnvelopeNode", "inputs": { "value": "audio_treble.output" } }
  ]
}
```

**Validation:**
- [ ] Audio reactivity: beat detection works
- [ ] Frequency bins: correct ranges (20-200 Hz bass, 200-2k Hz mid, 2k-20k Hz treble)
- [ ] Visual match: original vs generated

---

## Performance Budget & Measurement

### Memory Per Pattern
```
Target: < 5 KB per pattern

Breakdown:
├─ Node state (stateful nodes): 500-1500 bytes
├─ Generated C++ code: 500-1000 bytes
├─ Type registry: 100 bytes
└─ Safety margin: 500 bytes
────────────────────────────
Total: < 3 KB typical, < 5 KB max
```

### Compilation Time Target
```
Single pattern graph (20-30 nodes): < 2 seconds
Full firmware + new pattern: < 5 seconds
```

### FPS Impact Target
```
Baseline (hardcoded patterns): 60 FPS = 16.7ms per frame
Graph system overhead: < 2% = < 0.33ms additional
Measured: 16.7ms → 17.0ms acceptable
```

---

## Code Quality Benchmarks

**For generated C++:**
- Complexity score: < 10 per function (McCabe)
- Test coverage: >= 95%
- Static analysis: 0 warnings (clang-tidy)
- Performance: no unnecessary allocations

---

## Decision Gate Criteria (Nov 13, 9 AM)

**PoC Pass Criteria (ALL must ✅):**
1. ✅ 2 patterns (Bloom, Spectrum) converted to graphs
2. ✅ FPS impact < 2% (measured on device)
3. ✅ Memory < 5KB per node (profiled)
4. ✅ Code quality > 80% (complexity scoring)
5. ✅ 24h stability: 0 crashes
6. ✅ Compilation < 2 seconds per graph

**If ALL pass → Path A (8-week Graph System execution)**
**If ANY fail → Path B (10-week C++ SDK alternative)**

---

**Appendix Status:** READY FOR EXECUTION
**First Task:** Task 6 (Architecture design) - Nov 6-7
**PoC Deadline:** Nov 12, 6 PM (results inform Nov 13 decision)
**Last Sync:** 2025-11-05

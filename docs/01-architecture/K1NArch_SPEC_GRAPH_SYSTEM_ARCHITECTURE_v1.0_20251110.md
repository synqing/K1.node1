# K1.node1 Graph System Architecture Specification

**Version:** 1.0
**Date:** November 10, 2025
**Status:** Design Specification (Task 6)
**Owner:** Architecture Team
**Scope:** Comprehensive graph compilation and runtime architecture for audio-reactive LED pattern generation

**Related Documents:**
- `docs/06-reference/K1NRef_GRAPH_NODE_CATALOG_EXPANDED_v2.0_20251110.md` - 39 Node Types Catalog
- `docs/06-reference/GRAPH_SCHEMA_SPEC.md` - JSON Schema v1.0
- `firmware/src/graph_codegen/graph_runtime.h` - Runtime Helpers
- `firmware/src/stateful_nodes.h` - Stateful Node System (8 core types)
- `ADR-0012-phase-c-node-editor-architecture.md` - Visual Editor Architecture

---

## 1. Executive Summary

The K1.node1 Graph System is a **dataflow-based pattern compiler** that transforms declarative JSON graph specifications into optimized C++ firmware code for real-time audio-reactive LED patterns. The architecture consists of:

1. **Graph Model** - Directed Acyclic Graph (DAG) of typed nodes with ports and parameters
2. **Compiler Pipeline** - 5-stage transformation: Parse → Validate → Optimize → Schedule → Codegen
3. **Runtime Engine** - Zero-allocation execution model with stateful node lifecycle management
4. **Node Type System** - 39 built-in node types (8 stateful, 31 pure) with extensibility
5. **Performance Model** - <200KB heap budget, <16KB state, 30+ FPS sustained on ESP32-S3

### Key Design Principles

- **Declarative First** - JSON graphs are source of truth; compiler infers execution order
- **Zero-Copy Hot Paths** - Pre-allocated buffers, IRAM-safe callbacks, no frame-time allocation
- **Stateful by Design** - First-class support for temporal effects (trails, filters, beat tracking)
- **Type Safety** - Strong port typing with explicit coercion rules; compile-time validation
- **Fail-Fast Validation** - Comprehensive error messages with node/port context and cycle detection

---

## 2. Graph Model Definition

### 2.1 Core Abstractions

```
Graph := {
  version: string,          // Format version (e.g., "v1.0")
  name: string,             // Unique pattern identifier
  nodes: Node[],            // Ordered list of node definitions
  meta?: Metadata           // Optional authoring metadata
}

Node := {
  id: string,               // Unique node ID within graph (snake_case)
  type: NodeType,           // Node type from catalog (e.g., "AudioSpectrum", "Blur")
  inputs?: { port: NodeID }, // Port connections (port name → source node ID)
  params?: { key: value },  // Static configuration parameters
  meta?: NodeMetadata       // Optional authoring aids
}
```

### 2.2 Type System

**Primitive Types:**
- `int` (4 bytes) - Indices, counts, window sizes
- `bool` (1 byte) - Toggles, mode flags, beat events
- `float` (4 bytes) - Scalars (typically 0.0-1.0 normalized)

**Vector Types:**
- `vec2` (8 bytes) - 2D coordinates (future Phase 2)
- `vec3` / `color` (12 bytes) - RGB colors (0.0-1.0 per channel)

**Temporal Types:**
- `time` (4 bytes) - Absolute elapsed time (seconds since pattern start)
- `duration` (4 bytes) - Delta time between frames
- `rng_seed` (4 bytes) - Random seed for deterministic noise

**Audio Types:**
- `audio_envelope` (4 bytes) - VU/energy scalar (0.0-1.0)
- `audio_spectrum` (256 bytes) - FFT bins (float[64], typically 0-8kHz)
- `beat_event` (1 byte) - Boolean pulse on beat threshold cross
- `chroma_vector` (48 bytes) - 12-point pitch class energy (C, C#, D, ..., B)

**Parameter Types:**
- `param<float>` (4 bytes) - User-configurable float (min/max bounded)
- `param<color>` (12 bytes) - User-configurable RGB color
- `param<bool>` (1 byte) - User-configurable toggle

**Buffer Types:**
- `led_buffer<float>` (~1 KB) - Per-LED scalar array (float[NUM_LEDS])
- `led_buffer<vec3>` (~1.2 KB) - Per-LED RGB array (CRGBF[NUM_LEDS])

### 2.3 Type Coercion Rules

**Allowed Implicit Coercions:**
- `int → float` (widening, always safe)
- `vec3 ↔ color` (alias, bidirectional)

**Explicit Coercions (Node-Specific):**
- `float → vec3` - Broadcast via `Fill` node (replicate to all channels)
- `color → led_buffer<vec3>` - Broadcast via `Fill` node (replicate to all LEDs)
- `audio_spectrum → float` - Aggregation via BandShape/Filter nodes (sum/mean/max)

**Forbidden Coercions (Compile Error):**
- `led_buffer<float> ↔ led_buffer<vec3>` - No implicit buffer conversion
- `chroma_vector → any` (Phase 1) - Requires explicit unpack node (Phase 2)
- `beat_event → float` (Phase 1) - Explicit Cast node (Phase 2)

### 2.4 Node Port Model

**Port Types:**
- **Input Ports** - Accept data from upstream nodes (required or optional with defaults)
- **Output Ports** - Produce data for downstream nodes (single type per node, multi-output via struct)
- **Parameter Ports** - Static configuration (compile-time constants)

**Port Connectivity Rules:**
1. Required input ports MUST be connected OR have declared default values
2. Unknown/extra input connections are errors (strict validation)
3. Dangling source references (unknown node IDs) are errors
4. Output port types must match or be coercible to input port types
5. Terminal nodes (e.g., `LedOutput`) have no output ports

**Multi-Output Nodes:**
- `AutoCorrelation` - Outputs: `pitch_hz: float`, `confidence: float`
- Future: Struct-based output ports for grouped data (Phase 2)

### 2.5 Graph Constraints (DAG Invariants)

1. **Acyclic** - No cycles allowed; topological sort via Kahn's algorithm required
2. **Rooted** - At least one terminal node (`LedOutput`, `LedOutputMirror`) must exist
3. **Connected** - All nodes reachable from roots; unreachable nodes are warnings
4. **Type-Safe** - All port connections type-compatible after coercion
5. **Memory-Bounded** - Total stateful node memory ≤16KB (configurable via `--state-budget`)
6. **Deterministic** - Pure nodes are idempotent; stateful nodes have defined init/reset semantics

---

## 3. Compiler Pipeline Architecture

### 3.1 Five-Stage Pipeline

```
[Stage 1: Parse]
  Input: graph.json (UTF-8 text)
  Output: AST (in-memory tree)
  Validation: JSON syntax, schema conformance (graph.schema.json)
  Errors: Syntax errors, missing required fields, invalid identifiers

[Stage 2: Validate]
  Input: AST
  Output: Typed AST (with inferred types per port)
  Validation: DAG structure, port connectivity, type compatibility, node catalog lookup
  Errors: Cycles (with path), dangling references, type mismatches, unknown node types

[Stage 3: Optimize]
  Input: Typed AST
  Output: Optimized AST
  Transformations:
    - Constant folding (pure nodes with constant inputs → inline values)
    - Common Subexpression Elimination (CSE) - deduplicate identical pure nodes
    - Dead Code Elimination (DCE) - remove unreachable nodes
    - Identity elimination (e.g., Mul(x, 1.0) → x, Add(x, 0.0) → x)
  Constraints: Preserve stateful node order; do not reorder side-effectful operations

[Stage 4: Schedule]
  Input: Optimized AST
  Output: Execution Plan (topological order + buffer allocation)
  Allocation Strategy:
    - Topological sort (Kahn's algorithm with depth-first post-order)
    - Lifetime analysis (last-use tracking per buffer)
    - Buffer pooling (reuse scratch buffers when lifetimes non-overlapping)
    - Memory budget enforcement (fail if scratch cap exceeded)
  Output Artifacts (with --dump):
    - dump-plan.json: Execution order, buffer IDs, lifetimes, peak memory

[Stage 5: Codegen]
  Input: Execution Plan
  Output: pattern_<name>.cpp (C++ source)
  Generation Strategy:
    - Function signature: void pattern_<name>_render(frame_count, audio, params, state, out)
    - Pre-allocated buffers (tmp_f0, tmp_rgb0, etc.) declared at function scope
    - Linear statement sequence (no loops except Fill/Blur/Mirror nodes)
    - Direct function calls to graph_runtime.h helpers
    - Stateful node state accessed via state.<field> references
    - Terminal node (LedOutput) writes to out.leds[NUM_LEDS][3] (uint8_t RGB)
  Optimization: Inline small helpers; avoid function call overhead in hot paths
```

### 3.2 Compiler CLI Interface

```bash
k1c validate graph.json [--dump]
  # Validate graph syntax, types, DAG structure
  # --dump: Write dump-ast.json, dump-typed.json

k1c build graph.json --out firmware/src/graph_codegen/pattern_<name>.cpp \
      [--dump] [--no-inplace] [--state-budget <bytes>] [--scratch-cap <bytes>]
  # Full compilation pipeline: parse → validate → optimize → schedule → codegen
  # --dump: Write all stage artifacts (dump-*.json)
  # --no-inplace: Disable in-place buffer reuse (debugging aid)
  # --state-budget <bytes>: Max stateful node memory (default 16KB)
  # --scratch-cap <bytes>: Max concurrent scratch buffers (default 16KB)

k1c info graph.json
  # Print graph statistics: node count, memory estimate, execution depth

k1c graph --list-nodes
  # List all available node types from catalog (39 types)

k1c graph --node-info <NodeType>
  # Show detailed node documentation (inputs, outputs, parameters, constraints)
```

### 3.3 Error Reporting Format

```
Error: Type mismatch at node 'blur_node'
  Port 'src' expects type: led_buffer<vec3>
  Connected source 'audio_node' produces type: audio_spectrum
  Suggestion: Insert BandShape or Fill node to convert spectrum to buffer

Error: Cycle detected in graph 'bloom_mirror'
  Cycle path: lowpass_node → persist_node → feedback_node → lowpass_node
  Solution: Break cycle by removing edge or using BufferPersist with decay

Error: Memory budget exceeded
  State budget: 16384 bytes (configured limit)
  Actual usage: 18432 bytes (115% of budget)
  Top consumers:
    - persist_node (BufferPersist): 4320 bytes (double-buffered CRGB)
    - wave_node (WavePool): 2880 bytes (height + velocity fields)
  Suggestion: Use --state-budget 20000 or reduce buffer sizes
```

### 3.4 Compiler Optimization Passes

**Constant Folding:**
- `Add(2.0, 3.0)` → `5.0`
- `Mul(0.5, ParamF("speed"))` → Inline if ParamF is constant at compile time

**Common Subexpression Elimination (CSE):**
- Detect identical pure node subgraphs; deduplicate to single instance
- Example: Two `Hsv(time, 1.0, 1.0)` nodes → share single instance

**Dead Code Elimination (DCE):**
- Remove nodes unreachable from terminal nodes
- Preserve side-effectful nodes (stateful nodes always retained)

**Identity Elimination:**
- `Mul(x, 1.0)` → `x`
- `Add(x, 0.0)` → `x`
- `Clamp(x, 0.0, 1.0)` where x already [0,1] → `x`

**Buffer Lifetime Analysis:**
- Track first-use and last-use per buffer
- Pool scratch buffers when lifetimes non-overlapping
- Example: `tmp_rgb0` reused after `blur_node` completes if no downstream dependency

---

## 4. Runtime Execution Engine

### 4.1 Execution Model (Zero-Allocation)

**Frame Loop (30 Hz):**
```cpp
void loop_gpu() {
  // 1. Acquire audio snapshot (I2S, <1ms timeout)
  AudioDataSnapshot audio;
  get_audio_snapshot(&audio);

  // 2. Read pattern parameters (brightness, speed, color, etc.)
  const PatternParameters& params = get_params();

  // 3. Execute current pattern's render function
  static PatternState state;  // Persistent across frames
  PatternOutput out;          // Scratch for this frame

  pattern_bloom_render(frame_count, audio, params, state, out);

  // 4. Quantize to 8-bit with dithering (temporal or spatial)
  quantize_frame(out.leds, raw_led_data, params);

  // 5. Transmit to RMT peripheral (dual-channel, synchronized start)
  transmit_leds_dual_channel(raw_led_data, raw_led_data_ch2);

  // 6. Update frame counter and telemetry
  frame_count++;
  watch_cpu_fps();
}
```

**Pattern Render Function Signature:**
```cpp
extern "C" void pattern_<name>_render(
    uint32_t frame_count,                 // Frame counter (monotonic)
    const AudioDataSnapshot& audio,       // Audio data (envelope, spectrum, beats)
    const PatternParameters& params,      // User parameters (brightness, speed, color)
    PatternState& state,                  // Persistent state (stateful nodes)
    PatternOutput& out                    // Output buffer (leds[NUM_LEDS][3])
);
```

### 4.2 Memory Management Strategy

**Static Allocation (Compile-Time):**
- `PatternState` - Allocated once per pattern; persists across frames (~10KB max)
- `PatternOutput` - Stack-allocated per frame (~768 bytes for 256 LEDs RGB)
- Temporary buffers (`tmp_f0`, `tmp_rgb0`, etc.) - Function-scoped stack allocation

**No Heap Allocation in Hot Paths:**
- All buffers pre-sized at compile time
- No `malloc`/`new` during frame execution
- Stateful nodes initialized once at pattern start (lazy init on first access)

**Memory Budget Enforcement:**
```cpp
// Compiler checks at build time:
static_assert(sizeof(PatternState) <= 16384, "State budget exceeded");
static_assert(sizeof(tmp_f0) + sizeof(tmp_rgb0) <= 16384, "Scratch cap exceeded");

// Runtime validation (debug builds):
size_t state_size = stateful_nodes_get_memory_used();
if (state_size > STATE_BUDGET_BYTES) {
  LOG_ERROR(TAG, "State budget violation: %zu / %zu bytes", state_size, STATE_BUDGET_BYTES);
}
```

### 4.3 Stateful Node Lifecycle

**Initialization (Lazy):**
```cpp
class BufferPersistNode {
  void ensure_init() {
    if (state == StatefulNodeState::UNINITIALIZED) {
      memset(buffer, 0, sizeof(buffer));
      state = StatefulNodeState::INITIALIZED;
    }
  }
};
```

**Per-Frame Update:**
```cpp
// Generated code:
state.persist_buf[i] = decay * state.persist_buf[i] + (1 - decay) * tmp_f0[i];
```

**Pattern Change Reset:**
```cpp
void stateful_nodes_on_pattern_change(uint8_t new_pattern_id) {
  // Reset all stateful nodes (except BeatHistory, which persists)
  g_stateful_node_registry.reset_on_pattern_change(new_pattern_id);
}
```

**Integrity Validation:**
```cpp
// Each stateful node includes magic number for corruption detection:
uint32_t magic = STATEFUL_NODE_MAGIC;  // 0xDEADBEEF

bool validate() {
  return magic == STATEFUL_NODE_MAGIC;
}
```

### 4.4 Event Dispatch (Audio Integration)

**Audio Snapshot Acquisition:**
```cpp
typedef struct {
  float envelope;               // VU/energy (0.0-1.0)
  float spectrum[NUM_FREQS];    // FFT bins (64 typical, 0-8kHz)
  float beat_confidence;        // Beat detector output
  uint32_t frame_age_ms;        // Age of data (for stale detection)
  bool available;               // True if I2S data valid
} AudioDataSnapshot;

// Thread-safe snapshot (lock-free if possible):
bool get_audio_snapshot(AudioDataSnapshot* out, uint32_t timeout_ms = 1);
```

**Beat Event Detection:**
```cpp
// BeatEvent node (stateful):
class BeatEventNode {
  bool prev_high = false;

  bool update(float envelope, float threshold, float hysteresis) {
    bool is_high = (envelope >= threshold);
    bool is_rising = is_high && !prev_high;
    prev_high = is_high;

    // Hysteresis: prevent jitter on threshold boundary
    if (is_rising && envelope >= (threshold + hysteresis)) {
      return true;  // Emit pulse
    }
    return false;
  }
};
```

---

## 5. Node Type System

### 5.1 Node Categories (39 Total)

**Input Nodes (10):**
- `Time`, `AudioSnapshot`, `AudioSpectrum`, `BeatEvent`, `AutoCorrelation`, `Chromagram`
- `ParamF`, `ParamColor`, `ConfigToggle`, `PerlinNoise`

**Math/Filter Nodes (10):**
- `Add`, `Mul`, `Mix`, `Lerp`, `Clamp`, `Pow`, `Sqrt`
- `LowPass`, `MovingAverage`, `Contrast`

**Color Nodes (6):**
- `Hsv`, `Color`, `GradientMap`, `Desaturate`, `ForceSaturation`, `PaletteSelector`

**Geometry/Buffer Nodes (8):**
- `Fill`, `Blur`, `Mirror`, `Shift`, `Downsample`, `DotRender`, `ComposeLayers`, `BufferPersist`

**Noise/Procedural Nodes (3):**
- `PerlinNoise`, `RngSeed`, `PositionAccumulator`

**Output Nodes (2):**
- `LedOutput`, `LedOutputMirror`

### 5.2 Stateful Node Types (8 Core)

**From `stateful_nodes.h`:**

1. **BufferPersistNode** - Frame-to-frame float buffer with exponential decay
   - Use Case: Trail effects, comet tails, long decay
   - Size: ~720 bytes (180 floats)
   - Formula: `out[i] = decay × prior[i] + (1 − decay) × in[i]`

2. **ColorPersistNode** - Frame-to-frame RGB color buffer
   - Use Case: Color trails, bloom effects
   - Size: ~2160 bytes (180 CRGB)
   - Formula: Same as BufferPersist but per-channel

3. **PhaseAccumulatorNode** - Continuous phase tracking for oscillations
   - Use Case: LFO modulation, smooth animations
   - Size: ~4 bytes (single float)
   - Update: `phase += delta_rad; wrap to [0, 2π)`

4. **BeatHistoryNode** - Temporal beat tracking with ring buffer
   - Use Case: Beat-aware animations, tempo analysis
   - Size: ~512 bytes (128 samples)
   - Persistence: Never reset (audio subsystem manages)

5. **EnergyGateNode** - Threshold-based energy gating with hysteresis
   - Use Case: Beat detection, silence detection, gated effects
   - Size: ~4 bytes (threshold + gate state)

6. **SpriteScrollNode** - Scrolling sprite with decay (inward/outward)
   - Use Case: Directional animations, scrolling effects
   - Size: ~4320 bytes (double-buffered CRGB)

7. **WavePoolNode** - Wave propagation with Gaussian smoothing
   - Use Case: Ripple effects, physics-based animations
   - Size: ~1440 bytes (height + velocity fields)

8. **GaussianBlurNode** - Spatial blur operation on buffers
   - Use Case: Smoothing, bloom, diffusion
   - Size: ~720 bytes (temporary buffer)

**Memory Budget:**
- Per-node limit: <2.5 KB (warning), >2.5 KB (error in strict mode)
- Total state budget: <16 KB (default), configurable via `--state-budget`
- Stateful nodes: 8 types, 31 pure nodes (no state)

### 5.3 Pure Node Characteristics

**Properties:**
- Deterministic (same inputs → same outputs)
- Idempotent (multiple calls have no side effects)
- Side-effect-free (no global state mutation)
- Reorderable (can execute in any order respecting data dependencies)

**Optimization Eligibility:**
- Constant folding (if all inputs constant)
- Common Subexpression Elimination (deduplicate identical nodes)
- Dead Code Elimination (remove if output unused)

**Examples:**
- `Add(2.0, 3.0)` - Always produces 5.0
- `Hsv(time, 1.0, 1.0)` - Deterministic for given time value
- `Fill(color)` - Pure buffer construction

### 5.4 Node Composition Patterns

**Pattern: Audio → Filter → Colorize → Buffer → Output**
```json
{
  "nodes": [
    {"id": "audio", "type": "AudioSpectrum"},
    {"id": "lowpass", "type": "LowPass", "inputs": {"signal": "audio"}, "params": {"alpha": 0.1}},
    {"id": "colorize", "type": "GradientMap", "inputs": {"index": "lowpass"}},
    {"id": "fill", "type": "Fill", "inputs": {"color": "colorize"}},
    {"id": "persist", "type": "BufferPersist", "inputs": {"src": "fill"}, "params": {"decay": 0.92}},
    {"id": "out", "type": "LedOutput", "inputs": {"color": "persist"}}
  ]
}
```

**Pattern: Beat-Reactive Pulse**
```json
{
  "nodes": [
    {"id": "audio", "type": "AudioSnapshot"},
    {"id": "beat", "type": "BeatEvent", "inputs": {"envelope": "audio"}, "params": {"threshold": 0.5}},
    {"id": "color", "type": "ParamColor", "params": {"name": "pulse_color"}},
    {"id": "fill", "type": "Fill", "inputs": {"color": "color"}},
    {"id": "gate", "type": "EnergyGate", "inputs": {"energy": "beat"}},
    {"id": "out", "type": "LedOutput", "inputs": {"color": "fill"}}
  ]
}
```

---

## 6. Performance Model & Constraints

### 6.1 Timing Budgets (ESP32-S3 @ 240MHz)

**Frame Budget (30 Hz):**
- Total frame time: 33.3 ms
- Render phase: <12 ms (target), <20 ms (max)
- Quantize phase: <2 ms (target), <5 ms (max)
- Transmit phase: <6 ms (WS2812 protocol fixed), <8 ms (with wait)
- Audio acquisition: <1 ms (I2S DMA read)
- Slack time: ~8-10 ms (for system tasks, WiFi, telemetry)

**Node Performance Characteristics:**

| Node Type | Typical Latency | Memory | IRAM-Safe | Notes |
|-----------|----------------|--------|-----------|-------|
| AudioSpectrum | 50-500 µs | 0 bytes | Yes | DMA read, lock-free |
| LowPass | 1-5 µs | 4 bytes | Yes | Single multiply-add |
| BufferPersist | 50-200 µs | 1.2 KB | Yes | 256 LEDs × decay loop |
| Blur | 100-500 µs | 1.2 KB | Yes | 3-tap convolution |
| GradientMap | 10-50 µs | 0 bytes | Yes | Palette lookup |
| Fill | 50-100 µs | 1.2 KB | Yes | Memset or loop |
| DotRender | 20-100 µs | 1.2 KB | Yes | Sparse write |
| Mirror | 50-150 µs | 0-1.2 KB | Yes | Copy or view |

### 6.2 Memory Constraints

**Heap Budget (ESP32-S3):**
- Total available heap: ~300 KB (after system allocations)
- Pattern state budget: <16 KB (default), <32 KB (max recommended)
- Scratch buffer budget: <16 KB (concurrent peak)
- Audio ring buffer: ~8 KB (FFT + spectrum history)
- Reserved for WiFi/BLE: ~50 KB
- Safety margin: ~50 KB (for fragmentation, system tasks)

**Stack Budget:**
- Main loop stack: 8 KB
- Pattern render function: <4 KB (function-scoped temps)
- Nested function calls: <2 KB depth

**Flash Budget:**
- Pattern code: <10 KB per pattern
- Graph runtime helpers: ~5 KB
- Stateful node library: ~8 KB
- Total firmware: <1.5 MB (ESP32-S3 has 4 MB flash typical)

### 6.3 CPU Budget (Core 0 - GPU Loop)

**Core Allocation:**
- Core 0 (GPU): Pattern render loop (30 Hz), LED quantize/transmit
- Core 1 (CPU): Audio analysis (FFT), WiFi/BLE, REST API, telemetry

**CPU Utilization Targets:**
- Core 0: <60% average (render + quantize + transmit)
- Core 1: <50% average (audio + network + system)
- Overhead per frame: <2% (profiling, telemetry, FPS tracking)

**Worst-Case Scenario (Complex Pattern):**
- 10 stateful nodes (BufferPersist, LowPass, etc.)
- 5 buffer operations (Blur, Mirror, ComposeLayers)
- 3 color transformations (GradientMap, Hsv, Desaturate)
- Total: ~18 nodes × ~100 µs = 1.8 ms (well within 12 ms budget)

### 6.4 Scalability Analysis

**Node Count Scaling:**
- Linear time complexity: O(N) where N = node count
- Typical pattern: 10-20 nodes
- Max recommended: 50 nodes (still <10 ms render time)
- Compiler optimization reduces effective node count (CSE, DCE)

**LED Count Scaling:**
- Buffer operations scale linearly with LED count
- Current: 160 LEDs per channel (320 total dual-channel)
- Max practical: 256 LEDs per channel (512 total)
- Memory: ~1.2 KB per buffer × 256 LEDs = ~3 KB per buffer

**Audio Spectrum Scaling:**
- FFT bins: 64 (default), 128 (high-res), 256 (max)
- Memory: 4 bytes per bin × 64 bins = 256 bytes
- Compute: FFT done on Core 1 (CPU loop), no impact on render

---

## 7. Extensibility & Plugin Points

### 7.1 Custom Node Types (Phase 2)

**Node Plugin Interface:**
```cpp
struct CustomNodeDescriptor {
  const char* type_name;              // Node type identifier
  NodeCategory category;               // INPUT, MATH, GEOMETRY, etc.
  PortDescriptor inputs[MAX_PORTS];    // Input port definitions
  PortDescriptor outputs[MAX_PORTS];   // Output port definitions
  ParamDescriptor params[MAX_PARAMS];  // Parameter definitions

  // Lifecycle hooks:
  void (*init)(void* state);           // Initialize node state
  void (*reset)(void* state);          // Reset on pattern change
  void (*render)(void* state, const void* inputs, void* outputs); // Execute node

  size_t state_size;                   // Size of state struct (0 if pure)
  bool is_pure;                        // True if no side effects
  bool is_terminal;                    // True if output node
};

// Registration:
register_custom_node(&my_custom_node_descriptor);
```

**Example: Custom FFT Filter Node**
```cpp
CustomNodeDescriptor fft_bandpass = {
  .type_name = "FFTBandpass",
  .category = NODE_CATEGORY_FILTER,
  .inputs = {
    {"spectrum", TYPE_AUDIO_SPECTRUM},
    {"low_freq", TYPE_FLOAT},
    {"high_freq", TYPE_FLOAT}
  },
  .outputs = {
    {"filtered_spectrum", TYPE_AUDIO_SPECTRUM}
  },
  .render = [](void* state, const void* inputs, void* outputs) {
    // Custom bandpass filter logic
  },
  .is_pure = true
};
```

### 7.2 Graph Composition (Subgraphs)

**Phase 2 Feature: Graph Import/Composition**
```json
{
  "nodes": [
    {"id": "subgraph1", "type": "Graph", "params": {"graph_path": "effects/bloom.json"}},
    {"id": "audio", "type": "AudioSpectrum"},
    {"id": "composed", "type": "ComposeLayers", "inputs": {"base": "audio", "overlay": "subgraph1"}}
  ]
}
```

**Benefits:**
- Reusable effect libraries
- Modular pattern design
- Easier testing (isolate subgraphs)

### 7.3 Runtime Node Hot-Swapping (Future)

**Phase 3 Feature: Live Node Editing**
- Edit graph in UI → compile in background → swap on next frame boundary
- State preservation across graph changes (best-effort)
- Incremental compilation (only recompile changed subgraph)

**Challenges:**
- State migration (if stateful node types change)
- Memory fragmentation (if state size increases)
- Timing glitches (if new graph slower than old)

---

## 8. Integration with LED Driver & Audio Subsystems

### 8.1 LED Driver Integration

**Quantization Phase:**
```cpp
// Input: CRGBF leds[NUM_LEDS] (float RGB 0.0-1.0)
// Output: uint8_t raw_led_data[NUM_LEDS * 3] (GRB order for WS2812)

void quantize_frame(const CRGBF* leds, uint8_t* out, const PatternParameters& params) {
  const float brightness = params.brightness;
  const bool dithering = (params.dithering >= 0.5f);

  if (dithering) {
    // Temporal dithering (4-frame cycle)
    static uint8_t dither_step = 0;
    const float thresholds[4] = {0.25f, 0.50f, 0.75f, 1.00f};
    const float thr = thresholds[dither_step % 4];

    for (uint16_t i = 0; i < NUM_LEDS; ++i) {
      float r = leds[i].r * brightness * 254.0f;
      float g = leds[i].g * brightness * 254.0f;
      float b = leds[i].b * brightness * 254.0f;

      out[i*3 + 0] = (uint8_t)g + ((g - (uint8_t)g) >= thr); // G
      out[i*3 + 1] = (uint8_t)r + ((r - (uint8_t)r) >= thr); // R
      out[i*3 + 2] = (uint8_t)b + ((b - (uint8_t)b) >= thr); // B
    }
    dither_step++;
  } else {
    // Direct quantization
    for (uint16_t i = 0; i < NUM_LEDS; ++i) {
      out[i*3 + 0] = (uint8_t)(leds[i].g * brightness * 255.0f); // G
      out[i*3 + 1] = (uint8_t)(leds[i].r * brightness * 255.0f); // R
      out[i*3 + 2] = (uint8_t)(leds[i].b * brightness * 255.0f); // B
    }
  }
}
```

**Dual-Channel Synchronization:**
```cpp
// Transmit to both RMT channels simultaneously
void transmit_leds_dual_channel(const uint8_t* ch1_data, const uint8_t* ch2_data) {
  // Wait for previous transmissions (bounded timeout)
  rmt_tx_wait_all_done(tx_chan, pdMS_TO_TICKS(8));
  rmt_tx_wait_all_done(tx_chan_2, pdMS_TO_TICKS(8));

  // Record timestamp for telemetry
  uint32_t tx_start = micros();
  g_last_led_tx_us.store(tx_start, std::memory_order_relaxed);

  // Transmit both channels back-to-back (critical section)
  rmt_transmit(tx_chan, led_encoder, ch1_data, NUM_LEDS * 3, &tx_config);
  rmt_transmit(tx_chan_2, led_encoder_2, ch2_data, NUM_LEDS * 3, &tx_config);
}
```

### 8.2 Audio Subsystem Integration

**I2S Microphone Data Flow:**
```
[Microphone (I2S)] → [DMA Buffer (512 samples)] → [Ring Buffer (Core 1)]
                                                          ↓
                                                    [FFT (64 bins)]
                                                          ↓
                                            [AudioDataSnapshot (lock-free)]
                                                          ↓
                                            [Pattern Render (Core 0)]
```

**Thread-Safe Audio Snapshot:**
```cpp
// Core 1 (producer): Update audio data
void audio_loop() {
  while (true) {
    // Read I2S samples
    int16_t samples[512];
    i2s_read(I2S_NUM_0, samples, sizeof(samples), &bytes_read, pdMS_TO_TICKS(1));

    // Compute FFT
    float spectrum[NUM_FREQS];
    fft_compute(samples, spectrum);

    // Update snapshot (atomic or mutex-protected)
    audio_snapshot_update(spectrum);

    vTaskDelay(pdMS_TO_TICKS(10)); // 100 Hz update rate
  }
}

// Core 0 (consumer): Read audio data
bool get_audio_snapshot(AudioDataSnapshot* out, uint32_t timeout_ms) {
  // Lock-free read (if possible) or mutex with timeout
  if (audio_snapshot_try_read(out, timeout_ms)) {
    return true;
  }

  // Fallback: Return stale data or silence
  memset(out, 0, sizeof(AudioDataSnapshot));
  out->available = false;
  return false;
}
```

**Beat Detection Integration:**
```cpp
// BeatEvent node reads envelope from AudioDataSnapshot
bool beat_detected = beat_node.update(audio.envelope, 0.5f, 0.1f);

// Use beat pulse to trigger effects:
if (beat_detected) {
  persist_node.inject_energy(1.0f);  // Inject brightness spike
  phase_node.reset();                // Reset phase for sync
}
```

---

## 9. Validation & Testing Strategy

### 9.1 Graph Validation Tests

**Stage 2 Validation (Type Checker):**
- DAG cycle detection (Kahn's algorithm)
- Port connectivity (all required inputs connected)
- Type compatibility (exact match or coercion)
- Node catalog lookup (unknown node types rejected)
- Memory budget enforcement (state + scratch caps)

**Test Fixtures:**
```json
// test/graphs/invalid/cycle.json
{"nodes": [
  {"id": "a", "type": "Add", "inputs": {"a": "b", "b": "1.0"}},
  {"id": "b", "type": "Mul", "inputs": {"a": "a", "b": "2.0"}}
]}
// Expected: Error "Cycle detected: a → b → a"

// test/graphs/invalid/type_mismatch.json
{"nodes": [
  {"id": "audio", "type": "AudioSpectrum"},
  {"id": "blur", "type": "Blur", "inputs": {"src": "audio"}}
]}
// Expected: Error "Type mismatch: Blur.src expects led_buffer<vec3>, got audio_spectrum"
```

### 9.2 Codegen Verification

**CRC Validation (Deterministic Output):**
```cpp
// Test: Compile graph twice, compare output byte-for-byte
k1c build test/graphs/bloom.json --out /tmp/bloom_v1.cpp
k1c build test/graphs/bloom.json --out /tmp/bloom_v2.cpp
diff /tmp/bloom_v1.cpp /tmp/bloom_v2.cpp
// Expected: No differences (deterministic codegen)

// Test: CRC validation
uint32_t crc1 = crc32_file("/tmp/bloom_v1.cpp");
uint32_t crc2 = crc32_file("/tmp/bloom_v2.cpp");
assert(crc1 == crc2, "Codegen non-deterministic!");
```

**Hardware Simulation:**
```cpp
// Test: Compile and run pattern in simulator
k1c build test/graphs/spectrum.json --out /tmp/spectrum.cpp
gcc -DSIMULATOR /tmp/spectrum.cpp test/sim/main.cpp -o /tmp/spectrum_sim
/tmp/spectrum_sim --frames 100 --audio test/data/tone_440hz.wav --out /tmp/output.raw

// Verify output (check LED values):
validate_output("/tmp/output.raw", expected_crc32 = 0x12345678);
```

### 9.3 Performance Regression Tests

**Timing Benchmarks:**
```cpp
// Benchmark: Measure render time for reference patterns
void benchmark_bloom() {
  PatternState state;
  PatternOutput out;
  AudioDataSnapshot audio = load_test_audio();
  PatternParameters params = default_params();

  uint32_t start = micros();
  for (int i = 0; i < 1000; i++) {
    pattern_bloom_render(i, audio, params, state, out);
  }
  uint32_t elapsed = micros() - start;

  float avg_us = elapsed / 1000.0f;
  assert(avg_us < 8000, "Bloom render too slow: %.1f µs > 8000 µs", avg_us);
}
```

**Memory Budget Tests:**
```cpp
// Test: Validate state size at compile time
static_assert(sizeof(PatternState) <= 16384, "State budget exceeded");

// Test: Runtime validation
size_t actual_state = stateful_nodes_get_memory_used();
assert(actual_state <= 16384, "State budget violation at runtime");
```

### 9.4 End-to-End Integration Tests

**Test Harness:**
1. Load graph JSON
2. Compile to C++
3. Build firmware
4. Flash to device (or simulator)
5. Run for 60 seconds
6. Capture telemetry (FPS, render time, memory usage)
7. Validate against baselines

**Example Test:**
```bash
# E2E test for Bloom pattern
./test/e2e/run_pattern_test.sh \
  --graph test/graphs/bloom.json \
  --device /dev/ttyUSB0 \
  --duration 60 \
  --baseline test/baselines/bloom.json \
  --tolerance 10%
```

---

## 10. Future Roadmap (Phase 2+)

### Phase 2 (Q1 2026)

**Node System Enhancements:**
- Chromagram unpacking node (explicit 12-bin → scalar conversion)
- Conditional branching (if/else based on param toggles)
- Aggregation nodes (sum/mean/max over spectrum bins)
- Cast nodes (beat_event → float, int → float)

**Compiler Optimizations:**
- Inline small functions (Hsv, Clamp, etc.)
- SIMD vectorization (ESP32-S3 has limited SIMD, but explore)
- Loop unrolling (for small fixed-size loops)

**Tooling:**
- Visual graph editor (web-based, drag-and-drop)
- Real-time preview (compile + simulate in browser)
- Pattern library marketplace (share graphs)

### Phase 3 (Q2 2026)

**Advanced Features:**
- User-defined node types (custom C++ plugins)
- Subgraph composition (import/nest graphs)
- Runtime hot-swapping (edit graph without restart)
- GPU acceleration (offload heavy operations to RMT DMA)

**Observability:**
- Per-node profiling (timing heatmap in UI)
- Memory usage visualization (state + scratch breakdown)
- Audio waveform overlay (show FFT bins in editor)

### Phase 4 (Future)

**AI/ML Integration:**
- Beat prediction (LSTM-based tempo tracking)
- Genre classification (auto-select palette/preset)
- Procedural pattern generation (GAN-based exploration)

**Multi-Device Sync:**
- Distributed rendering (multiple ESP32 devices)
- Synchronized beat detection (via WiFi/BLE)
- Peer-to-peer pattern sharing

---

## 11. Architectural Decision Rationale

### Why Dataflow/DAG Model?

**Pros:**
- Declarative (describe what, not how)
- Parallelizable (independent nodes can execute concurrently in Phase 3)
- Analyzable (compiler can optimize, validate, estimate resources)
- Composable (build complex patterns from simple nodes)

**Cons:**
- Learning curve (visual programming paradigm)
- Debugging complexity (no line-by-line step-through)
- Limited expressiveness (no loops, conditionals in Phase 1)

**Alternatives Rejected:**
- **Imperative scripting (Lua, Python)** - Too slow on ESP32, high memory overhead
- **Domain-specific language (DSL)** - Higher implementation complexity, less tooling
- **Pure C++ patterns** - No visual authoring, harder for non-programmers

### Why 5-Stage Compiler Pipeline?

**Design Rationale:**
- **Stage 1 (Parse)** - Fail fast on syntax errors
- **Stage 2 (Validate)** - Fail fast on semantic errors (cycles, types)
- **Stage 3 (Optimize)** - Reduce code size and runtime overhead
- **Stage 4 (Schedule)** - Minimize memory usage via buffer pooling
- **Stage 5 (Codegen)** - Produce human-readable C++ (debugging aid)

**Alternative: Single-Pass Compiler**
- Pros: Simpler implementation
- Cons: Harder to debug, less optimization opportunities, poor error messages

### Why Zero-Allocation Runtime?

**Design Rationale:**
- Predictable memory usage (no fragmentation)
- Deterministic timing (no GC pauses)
- RTOS-friendly (no heap locks in ISR context)
- Faster execution (no malloc/free overhead)

**Alternative: Dynamic Allocation**
- Pros: More flexible (variable buffer sizes)
- Cons: Heap fragmentation risk, non-deterministic timing, harder to validate

### Why Stateful Nodes?

**Design Rationale:**
- Essential for temporal effects (trails, filters, beat tracking)
- Explicit lifecycle (init/reset) makes behavior predictable
- Compiler can optimize (CSE, DCE) around stateful boundaries

**Alternative: Functional Purity**
- Pros: Simpler reasoning, more optimizable
- Cons: Temporal effects require manual frame buffer management (verbose)

---

## 12. Appendix: Reference Implementation

### Example: Bloom Pattern (Full Graph)

```json
{
  "version": "v1.0",
  "name": "bloom_mirror",
  "nodes": [
    {"id": "time_node", "type": "Time"},
    {"id": "audio", "type": "AudioSpectrum"},
    {"id": "lowpass", "type": "LowPass", "inputs": {"signal": "audio"}, "params": {"alpha": 0.1}},
    {"id": "param_hue", "type": "ParamF", "params": {"name": "hue", "min": 0.0, "max": 1.0, "default": 0.5}},
    {"id": "param_sat", "type": "ParamF", "params": {"name": "saturation", "min": 0.0, "max": 1.0, "default": 1.0}},
    {"id": "color", "type": "Hsv", "inputs": {"h": "param_hue", "s": "param_sat", "v": "lowpass"}},
    {"id": "fill1", "type": "Fill", "inputs": {"color": "color"}},
    {"id": "persist", "type": "BufferPersist", "inputs": {"src": "fill1", "decay": 0.92}},
    {"id": "blur", "type": "Blur", "inputs": {"src": "persist"}, "params": {"radius": 2}},
    {"id": "mirror", "type": "Mirror", "inputs": {"src": "blur"}},
    {"id": "out", "type": "LedOutputMirror", "inputs": {"color": "mirror"}}
  ]
}
```

### Generated C++ (Simplified)

```cpp
#include "graph_runtime.h"
#include "../stateful_nodes.h"
#include "../parameters.h"

extern "C" void pattern_bloom_mirror_render(
    uint32_t frame_count,
    const AudioDataSnapshot& audio,
    const PatternParameters& params,
    PatternState& state,
    PatternOutput& out
) {
    // Constants
    constexpr int PATTERN_NUM_LEDS = 256;

    // Temporary buffers (stack-allocated)
    float tmp_f0[PATTERN_NUM_LEDS] = {0.0f};
    CRGBF tmp_rgb0[PATTERN_NUM_LEDS];
    CRGBF tmp_rgb1[PATTERN_NUM_LEDS];

    // Node: Time
    float time_val = frame_count / 30.0f;

    // Node: AudioSpectrum (reference, no copy)
    const float* spectrum = audio.spectrum;

    // Node: LowPass (stateful)
    float lowpass_out = lowpass_update(state.lowpass_states[0], audio.envelope, 0.1f);

    // Node: ParamF (hue)
    float hue = params.hue;

    // Node: ParamF (saturation)
    float saturation = params.saturation;

    // Node: Hsv (color conversion)
    CRGBF color = hsv_to_rgb(hue, saturation, lowpass_out);

    // Node: Fill (broadcast color to buffer)
    fill_buffer(tmp_rgb0, color, PATTERN_NUM_LEDS);

    // Node: BufferPersist (temporal decay)
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {
        state.persist_buf[i] = 0.92f * state.persist_buf[i] + 0.08f * tmp_rgb0[i].r;
        tmp_rgb0[i] = {state.persist_buf[i], state.persist_buf[i], state.persist_buf[i]};
    }

    // Node: Blur (spatial smoothing)
    blur_buffer(tmp_rgb0, tmp_rgb1, PATTERN_NUM_LEDS, 2);

    // Node: Mirror (flip buffer)
    mirror_buffer(tmp_rgb1, tmp_rgb0, PATTERN_NUM_LEDS);

    // Node: LedOutputMirror (write to output with vertical symmetry)
    for (int i = 0; i < PATTERN_NUM_LEDS / 2; ++i) {
        CRGBF c = clamped_rgb(tmp_rgb0[i]);
        out.leds[i][0] = (uint8_t)(c.r * 255.0f);
        out.leds[i][1] = (uint8_t)(c.g * 255.0f);
        out.leds[i][2] = (uint8_t)(c.b * 255.0f);

        // Mirror to second half
        int mirror_idx = PATTERN_NUM_LEDS - 1 - i;
        out.leds[mirror_idx][0] = out.leds[i][0];
        out.leds[mirror_idx][1] = out.leds[i][1];
        out.leds[mirror_idx][2] = out.leds[i][2];
    }
}
```

---

## 13. Glossary

**DAG (Directed Acyclic Graph)** - Graph structure with directed edges and no cycles; required for topological sort.

**CSE (Common Subexpression Elimination)** - Optimization that deduplicates identical pure node instances.

**DCE (Dead Code Elimination)** - Optimization that removes nodes unreachable from terminal outputs.

**Topological Sort** - Algorithm to order DAG nodes such that all dependencies execute before dependents.

**Stateful Node** - Node that maintains persistent state across frames (e.g., BufferPersist, LowPass).

**Pure Node** - Node with no side effects; same inputs always produce same outputs (e.g., Add, Hsv).

**Terminal Node** - Node with no output ports; writes to hardware (e.g., LedOutput).

**Port** - Named input/output on a node; typed connection point for data flow.

**Coercion** - Implicit or explicit type conversion (e.g., int → float, float → vec3 via Fill).

**Buffer Pooling** - Memory optimization that reuses scratch buffers when lifetimes non-overlapping.

**Quantization** - Conversion from float RGB (0.0-1.0) to 8-bit RGB (0-255) with optional dithering.

**RMT Peripheral** - ESP32 hardware module for precise timing control (used for WS2812 LED protocol).

**I2S Peripheral** - ESP32 hardware module for audio input/output (used for microphone sampling).

**IRAM** - Internal RAM on ESP32; fast, limited memory for interrupt handlers and hot paths.

---

**Document Status:** Draft v1.0
**Next Review:** Task 7 (Compiler Implementation Planning)
**Approval Required:** Lead Architect, Firmware Team Lead

**Version History:**
- v1.0 (2025-11-10): Initial architecture specification based on codebase analysis

---

**End of Document**

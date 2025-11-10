# K1.node1 Graph System Architecture Diagrams

**Version:** 1.0
**Date:** November 10, 2025
**Status:** Supporting Documentation
**Related:** `K1NArch_SPEC_GRAPH_SYSTEM_ARCHITECTURE_v1.0_20251110.md`

---

## 1. System Overview (High-Level Architecture)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        K1.node1 Graph System                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐   JSON    ┌──────────────┐   C++   ┌──────────┐ │
│  │   Pattern    │  Graphs   │   Compiler   │  Code   │ Firmware │ │
│  │   Author     │  ───────> │  (5-Stage)   │  ─────> │ Runtime  │ │
│  │   (Human)    │           │   Pipeline   │         │ (ESP32)  │ │
│  └──────────────┘           └──────────────┘         └──────────┘ │
│                                     │                       │       │
│                                     │                       │       │
│  ┌──────────────┐                  │                       │       │
│  │ Node Catalog │ ◄────────────────┘                       │       │
│  │  (39 Types)  │                                          │       │
│  └──────────────┘                                          │       │
│                                                             │       │
│  ┌──────────────┐                                          │       │
│  │   Runtime    │ ◄────────────────────────────────────────┘       │
│  │   Helpers    │  (graph_runtime.h, stateful_nodes.h)           │
│  └──────────────┘                                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

                  Inputs: JSON Graphs (Declarative)
                  Outputs: LED Patterns (Real-Time, 30 Hz)
```

---

## 2. Compiler Pipeline (5-Stage Architecture)

```
┌───────────────────────────────────────────────────────────────────────┐
│                         Compiler Pipeline                            │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  graph.json                                                          │
│      │                                                                │
│      ▼                                                                │
│  ┌─────────────────────┐                                            │
│  │  Stage 1: Parse     │  ◄─── graph.schema.json                    │
│  │  ─────────────────  │                                            │
│  │  - JSON validation  │                                            │
│  │  - AST construction │                                            │
│  │  - Identifier check │                                            │
│  └─────────────────────┘                                            │
│      │ AST                                                           │
│      ▼                                                                │
│  ┌─────────────────────┐                                            │
│  │  Stage 2: Validate  │  ◄─── Node Catalog (39 types)             │
│  │  ─────────────────  │                                            │
│  │  - DAG cycle check  │                                            │
│  │  - Port typing      │                                            │
│  │  - Type inference   │                                            │
│  │  - Connectivity     │                                            │
│  └─────────────────────┘                                            │
│      │ Typed AST                                                     │
│      ▼                                                                │
│  ┌─────────────────────┐                                            │
│  │  Stage 3: Optimize  │                                            │
│  │  ─────────────────  │                                            │
│  │  - Constant folding │                                            │
│  │  - CSE (pure nodes) │                                            │
│  │  - DCE (unreachable)│                                            │
│  │  - Identity elim    │                                            │
│  └─────────────────────┘                                            │
│      │ Optimized AST                                                 │
│      ▼                                                                │
│  ┌─────────────────────┐                                            │
│  │  Stage 4: Schedule  │                                            │
│  │  ─────────────────  │                                            │
│  │  - Topological sort │                                            │
│  │  - Lifetime analysis│                                            │
│  │  - Buffer pooling   │                                            │
│  │  - Memory budget    │                                            │
│  └─────────────────────┘                                            │
│      │ Execution Plan                                                │
│      ▼                                                                │
│  ┌─────────────────────┐                                            │
│  │  Stage 5: Codegen   │  ◄─── graph_runtime.h templates           │
│  │  ─────────────────  │                                            │
│  │  - C++ emission     │                                            │
│  │  - Helper inlining  │                                            │
│  │  - State mapping    │                                            │
│  └─────────────────────┘                                            │
│      │                                                               │
│      ▼                                                                │
│  pattern_<name>.cpp                                                 │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

        Error Handling: Fail-fast at each stage with context
        Artifacts: Optional --dump outputs per-stage JSON
```

---

## 3. Graph Data Model (Node-Port-Connection)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Graph Structure                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Graph := {                                                        │
│     version: "v1.0",                                                │
│     name: "bloom_mirror",                                           │
│     nodes: [                                                        │
│       ┌──────────────────────────────────────┐                     │
│       │ Node := {                             │                     │
│       │   id: "audio",                        │                     │
│       │   type: "AudioSpectrum",              │                     │
│       │   inputs: {},  ◄─── Port Connections │                     │
│       │   params: {}   ◄─── Parameters       │                     │
│       │ }                                     │                     │
│       └──────────────────────────────────────┘                     │
│                 │                                                   │
│                 ▼ Connection                                        │
│       ┌──────────────────────────────────────┐                     │
│       │ Node := {                             │                     │
│       │   id: "lowpass",                      │                     │
│       │   type: "LowPass",                    │                     │
│       │   inputs: {                           │                     │
│       │     signal: "audio" ◄─── References  │                     │
│       │   },                                  │                     │
│       │   params: { alpha: 0.1 }              │                     │
│       │ }                                     │                     │
│       └──────────────────────────────────────┘                     │
│                 │                                                   │
│                 ▼ Connection                                        │
│       ┌──────────────────────────────────────┐                     │
│       │ Node := {                             │                     │
│       │   id: "out",                          │                     │
│       │   type: "LedOutput",                  │                     │
│       │   inputs: {                           │                     │
│       │     color: "lowpass"                  │                     │
│       │   }                                   │                     │
│       │ }                                     │                     │
│       └──────────────────────────────────────┘                     │
│     ]                                                               │
│   }                                                                 │
│                                                                     │
│   Constraints:                                                      │
│   - DAG (no cycles)                                                 │
│   - Type-safe ports                                                 │
│   - At least one terminal node                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Node Type Taxonomy (39 Types)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Node Type Catalog (39)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────┐                                         │
│  │   INPUT NODES (10)    │                                         │
│  ├───────────────────────┤                                         │
│  │ Time                  │ ──> float (seconds)                     │
│  │ AudioSnapshot         │ ──> audio_envelope (0.0-1.0)            │
│  │ AudioSpectrum         │ ──> audio_spectrum (float[64])          │
│  │ BeatEvent             │ ──> beat_event (bool)                   │
│  │ AutoCorrelation       │ ──> pitch_hz, confidence                │
│  │ Chromagram            │ ──> chroma_vector (float[12])           │
│  │ ParamF                │ ──> param<float>                        │
│  │ ParamColor            │ ──> param<color>                        │
│  │ ConfigToggle          │ ──> param<bool>                         │
│  │ PerlinNoise           │ ──> float (procedural)                  │
│  └───────────────────────┘                                         │
│                                                                     │
│  ┌───────────────────────┐                                         │
│  │   MATH/FILTER (10)    │                                         │
│  ├───────────────────────┤                                         │
│  │ Add, Mul, Mix, Lerp   │ ──> float (arithmetic)                 │
│  │ Clamp, Pow, Sqrt      │ ──> float (nonlinear)                  │
│  │ LowPass (stateful)    │ ──> float (IIR filter)                 │
│  │ MovingAverage         │ ──> float (FIR filter)                 │
│  │ Contrast              │ ──> float (S-curve)                    │
│  └───────────────────────┘                                         │
│                                                                     │
│  ┌───────────────────────┐                                         │
│  │   COLOR NODES (6)     │                                         │
│  ├───────────────────────┤                                         │
│  │ Hsv                   │ ──> color (RGB from HSV)               │
│  │ Color                 │ ──> color (explicit RGB)               │
│  │ GradientMap           │ ──> color (palette lookup)             │
│  │ Desaturate            │ ──> color (grayscale)                  │
│  │ ForceSaturation       │ ──> color (saturate/desaturate)        │
│  │ PaletteSelector       │ ──> palette_id (Phase 2)               │
│  └───────────────────────┘                                         │
│                                                                     │
│  ┌───────────────────────┐                                         │
│  │ GEOMETRY/BUFFER (8)   │                                         │
│  ├───────────────────────┤                                         │
│  │ Fill                  │ ──> led_buffer<vec3>                   │
│  │ Blur                  │ ──> led_buffer<vec3>                   │
│  │ Mirror                │ ──> led_buffer<vec3>                   │
│  │ Shift                 │ ──> led_buffer<vec3>                   │
│  │ Downsample            │ ──> led_buffer<vec3>                   │
│  │ DotRender             │ ──> led_buffer<vec3>                   │
│  │ ComposeLayers         │ ──> led_buffer<vec3>                   │
│  │ BufferPersist         │ ──> led_buffer<vec3> (stateful)        │
│  └───────────────────────┘                                         │
│                                                                     │
│  ┌───────────────────────┐                                         │
│  │ NOISE/PROCEDURAL (3)  │                                         │
│  ├───────────────────────┤                                         │
│  │ PerlinNoise           │ ──> float (1D/2D)                      │
│  │ RngSeed               │ ──> rng_seed (deterministic)           │
│  │ PositionAccumulator   │ ──> float (spatial)                    │
│  └───────────────────────┘                                         │
│                                                                     │
│  ┌───────────────────────┐                                         │
│  │   OUTPUT NODES (2)    │                                         │
│  ├───────────────────────┤                                         │
│  │ LedOutput             │ ──> void (write to LEDs)               │
│  │ LedOutputMirror       │ ──> void (write with symmetry)         │
│  └───────────────────────┘                                         │
│                                                                     │
│  Stateful Nodes (8): LowPass, MovingAverage, BufferPersist,       │
│                      BeatEvent, BeatHistory, PhaseAccumulator,     │
│                      EnergyGate, WavePool                          │
│                                                                     │
│  Pure Nodes (31): All others (no state, deterministic)            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Runtime Execution Flow (Frame Loop)

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Runtime Execution (30 Hz Frame Loop)               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Core 1 (CPU)                       Core 0 (GPU)                  │
│   ─────────────                      ─────────────                 │
│                                                                     │
│   ┌────────────────┐                 ┌────────────────┐           │
│   │  Audio Loop    │                 │ Pattern Render │           │
│   │  ────────────  │                 │  ────────────  │           │
│   │ 1. I2S Read    │                 │ 1. Get Audio   │           │
│   │ 2. FFT Compute │                 │ 2. Get Params  │           │
│   │ 3. Beat Detect │                 │ 3. Execute DAG │           │
│   │ 4. Update      │───── Snapshot ──>│ 4. Quantize    │           │
│   │    Snapshot    │      (lock-free) │ 5. Transmit    │           │
│   └────────────────┘                 └────────────────┘           │
│          │                                    │                    │
│          │ 100 Hz                             │ 30 Hz              │
│          ▼                                    ▼                    │
│   ┌────────────────┐                 ┌────────────────┐           │
│   │ Network Tasks  │                 │ LED Hardware   │           │
│   │ (WiFi/BLE)     │                 │ (RMT Periph.)  │           │
│   └────────────────┘                 └────────────────┘           │
│                                                                     │
│   ┌──────────────────────────────────────────────────────────┐    │
│   │          Frame Timeline (33.3 ms budget)                 │    │
│   ├──────────────────────────────────────────────────────────┤    │
│   │                                                           │    │
│   │  0ms      5ms     12ms    15ms    20ms    28ms    33ms   │    │
│   │  ├─────────┼───────┼──────┼──────┼──────┼──────┼─────┤  │    │
│   │  │ Audio   │Render │Quant.│Trans-│Wait  │Slack │Next │  │    │
│   │  │ Acquire │ DAG   │      │mit   │      │      │Frame│  │    │
│   │  └─────────┴───────┴──────┴──────┴──────┴──────┴─────┘  │    │
│   │                                                           │    │
│   │  Target: <12ms render, <2ms quantize, <6ms transmit     │    │
│   │  Slack: ~10ms for WiFi, telemetry, system tasks         │    │
│   │                                                           │    │
│   └──────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Memory Architecture (Zero-Allocation)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Memory Layout (ESP32-S3)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   HEAP (~300 KB available)                                         │
│   ┌──────────────────────────────────────────────────────────┐    │
│   │                                                           │    │
│   │  ┌───────────────────────────────────────────────┐       │    │
│   │  │ PatternState (persistent, <16 KB)            │       │    │
│   │  │ ─────────────────────────────────────────────│       │    │
│   │  │ - BufferPersist: 720 bytes × N                │       │    │
│   │  │ - ColorPersist: 2160 bytes × N                │       │    │
│   │  │ - PhaseAccumulator: 4 bytes × N               │       │    │
│   │  │ - BeatHistory: 512 bytes × N                  │       │    │
│   │  │ - LowPass: 4 bytes × N                        │       │    │
│   │  │ - MovingAverage: 128 bytes × N                │       │    │
│   │  └───────────────────────────────────────────────┘       │    │
│   │                                                           │    │
│   │  ┌───────────────────────────────────────────────┐       │    │
│   │  │ Audio Ring Buffer (~8 KB)                    │       │    │
│   │  │ ─────────────────────────────────────────────│       │    │
│   │  │ - FFT samples: 512 × 2 bytes = 1 KB          │       │    │
│   │  │ - Spectrum history: 64 bins × 128 frames     │       │    │
│   │  │   = 32 KB (or downsampled)                   │       │    │
│   │  └───────────────────────────────────────────────┘       │    │
│   │                                                           │    │
│   │  ┌───────────────────────────────────────────────┐       │    │
│   │  │ Reserved (WiFi/BLE, ~50 KB)                  │       │    │
│   │  └───────────────────────────────────────────────┘       │    │
│   │                                                           │    │
│   │  ┌───────────────────────────────────────────────┐       │    │
│   │  │ Safety Margin (~50 KB)                        │       │    │
│   │  └───────────────────────────────────────────────┘       │    │
│   │                                                           │    │
│   └──────────────────────────────────────────────────────────┘    │
│                                                                     │
│   STACK (Core 0, 8 KB)                                             │
│   ┌──────────────────────────────────────────────────────────┐    │
│   │                                                           │    │
│   │  ┌───────────────────────────────────────────────┐       │    │
│   │  │ PatternOutput (scratch, <1 KB per frame)     │       │    │
│   │  │ ─────────────────────────────────────────────│       │    │
│   │  │ - leds[NUM_LEDS][3]: 256 × 3 = 768 bytes    │       │    │
│   │  └───────────────────────────────────────────────┘       │    │
│   │                                                           │    │
│   │  ┌───────────────────────────────────────────────┐       │    │
│   │  │ Temp Buffers (function-scoped, <4 KB)        │       │    │
│   │  │ ─────────────────────────────────────────────│       │    │
│   │  │ - tmp_f0[NUM_LEDS]: 256 × 4 = 1 KB          │       │    │
│   │  │ - tmp_rgb0[NUM_LEDS]: 256 × 12 = 3 KB       │       │    │
│   │  │ - tmp_rgb1[NUM_LEDS]: 256 × 12 = 3 KB       │       │    │
│   │  └───────────────────────────────────────────────┘       │    │
│   │                                                           │    │
│   └──────────────────────────────────────────────────────────┘    │
│                                                                     │
│   FLASH (4 MB)                                                     │
│   ┌──────────────────────────────────────────────────────────┐    │
│   │ Firmware: ~1.5 MB                                         │    │
│   │ - Pattern code: <10 KB per pattern × 20 = 200 KB         │    │
│   │ - Graph runtime: ~10 KB                                   │    │
│   │ - Stateful nodes: ~8 KB                                   │    │
│   │ - FastLED library: ~50 KB                                 │    │
│   │ - WiFi/BLE stack: ~300 KB                                 │    │
│   │ - REST API: ~50 KB                                        │    │
│   └──────────────────────────────────────────────────────────┘    │
│                                                                     │
│   Memory Budget Enforcement:                                       │
│   - Compile-time: static_assert(sizeof(PatternState) <= 16384)   │
│   - Runtime: validate stateful_nodes_get_memory_used() <= budget  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Data Flow Example (Bloom Pattern)

```
┌─────────────────────────────────────────────────────────────────────┐
│              Bloom Pattern Data Flow (10 Nodes)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌────────┐                                                       │
│   │  Time  │────┐                                                  │
│   └────────┘    │                                                  │
│                 │                                                  │
│   ┌──────────────┐    ┌──────────┐                                │
│   │AudioSpectrum │───>│ LowPass  │────┐                           │
│   └──────────────┘    └──────────┘    │                           │
│                                        │                           │
│   ┌──────────┐                        │                           │
│   │ ParamF   │────┐                   │                           │
│   │  (hue)   │    │                   │                           │
│   └──────────┘    │   ┌─────┐         │                           │
│                   ├──>│ Hsv │◄────────┘                           │
│   ┌──────────┐    │   └─────┘                                     │
│   │ ParamF   │────┘      │                                         │
│   │  (sat)   │           │                                         │
│   └──────────┘           │                                         │
│                          ▼                                         │
│                     ┌────────┐                                     │
│                     │  Fill  │                                     │
│                     └────────┘                                     │
│                          │                                         │
│                          ▼                                         │
│                  ┌──────────────┐                                  │
│                  │BufferPersist │◄─── state.persist_buf (1.2 KB)  │
│                  │ (decay=0.92) │                                  │
│                  └──────────────┘                                  │
│                          │                                         │
│                          ▼                                         │
│                     ┌────────┐                                     │
│                     │  Blur  │                                     │
│                     └────────┘                                     │
│                          │                                         │
│                          ▼                                         │
│                     ┌────────┐                                     │
│                     │ Mirror │                                     │
│                     └────────┘                                     │
│                          │                                         │
│                          ▼                                         │
│                  ┌───────────────┐                                 │
│                  │ LedOutputMirr │──> Hardware (RMT Peripheral)   │
│                  └───────────────┘                                 │
│                                                                     │
│   Data Types:                                                      │
│   ────────────                                                     │
│   float ───>  audio_envelope (0.0-1.0)                            │
│   float ───>  param<float> (hue, saturation)                      │
│   color ───>  CRGBF (RGB 0.0-1.0 per channel)                     │
│   led_buffer<vec3> ───> CRGBF[NUM_LEDS]                           │
│                                                                     │
│   Execution Order (Topological):                                   │
│   ────────────────────────────────                                 │
│   1. Time, AudioSpectrum, ParamF (hue), ParamF (sat) [parallel]   │
│   2. LowPass [depends on AudioSpectrum]                           │
│   3. Hsv [depends on ParamF, LowPass]                             │
│   4. Fill [depends on Hsv]                                         │
│   5. BufferPersist [depends on Fill, stateful]                    │
│   6. Blur [depends on BufferPersist]                              │
│   7. Mirror [depends on Blur]                                     │
│   8. LedOutputMirror [depends on Mirror, terminal]                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 8. Type System & Coercion Rules

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Type System & Coercions                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Primitive Types:                                                 │
│   ───────────────                                                  │
│   int (4B) ──────────────> float (4B)  [implicit widening]        │
│   bool (1B)                                                        │
│   float (4B)                                                       │
│                                                                     │
│   Vector Types:                                                    │
│   ─────────────                                                    │
│   vec2 (8B)                                                        │
│   vec3 (12B) ◄──────────> color (12B)  [alias, bidirectional]     │
│                                                                     │
│   Temporal Types:                                                  │
│   ───────────────                                                  │
│   time (4B)                                                        │
│   duration (4B)                                                    │
│   rng_seed (4B)                                                    │
│                                                                     │
│   Audio Types:                                                     │
│   ────────────                                                     │
│   audio_envelope (4B)                                              │
│   audio_spectrum (256B)                                            │
│   beat_event (1B)                                                  │
│   chroma_vector (48B)                                              │
│                                                                     │
│   Parameter Types:                                                 │
│   ─────────────────                                                │
│   param<float> (4B)                                                │
│   param<color> (12B)                                               │
│   param<bool> (1B)                                                 │
│                                                                     │
│   Buffer Types:                                                    │
│   ─────────────                                                    │
│   led_buffer<float> (~1 KB)                                        │
│   led_buffer<vec3> (~1.2 KB)                                       │
│                                                                     │
│   Explicit Coercions (Node-Specific):                             │
│   ───────────────────────────────────                              │
│   float ────────[Fill]────────> led_buffer<vec3>  [broadcast]     │
│   color ────────[Fill]────────> led_buffer<vec3>  [broadcast]     │
│   audio_spectrum ─[BandShape]─> led_buffer<float> [map bins]      │
│                                                                     │
│   Forbidden (Compile Error):                                       │
│   ──────────────────────────                                       │
│   led_buffer<float> ✗───> led_buffer<vec3>  [no implicit convert] │
│   chroma_vector ✗────────> any  [Phase 1: requires unpack node]   │
│   beat_event ✗───────────> float  [Phase 1: explicit Cast node]   │
│                                                                     │
│   Port Compatibility Rules:                                        │
│   ──────────────────────────                                       │
│   1. Exact match OR implicit coercion allowed                      │
│   2. Required inputs must be connected OR have defaults            │
│   3. Type mismatches are compile errors with suggestions           │
│   4. Multi-output nodes use struct types (Phase 2)                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 9. Stateful Node Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Stateful Node State Machine                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   State Enum:                                                      │
│   ──────────                                                       │
│   - UNINITIALIZED (0)                                              │
│   - INITIALIZED (1)                                                │
│   - ACTIVE (2)                                                     │
│   - RESET_PENDING (3)                                              │
│                                                                     │
│   Lifecycle Transitions:                                           │
│   ──────────────────────                                           │
│                                                                     │
│        [Pattern Start]                                             │
│               │                                                     │
│               ▼                                                     │
│        ┌─────────────┐                                             │
│        │UNINITIALIZED│                                             │
│        └─────────────┘                                             │
│               │                                                     │
│               │ first_access() / lazy_init()                       │
│               ▼                                                     │
│        ┌─────────────┐                                             │
│        │INITIALIZED  │                                             │
│        └─────────────┘                                             │
│               │                                                     │
│               │ render_frame() / update()                          │
│               ▼                                                     │
│        ┌─────────────┐                                             │
│        │   ACTIVE    │◄──────────┐                                 │
│        └─────────────┘           │                                 │
│               │                  │                                 │
│               │ pattern_change() │ continue_rendering()            │
│               ▼                  │                                 │
│        ┌─────────────┐           │                                 │
│        │RESET_PENDING│───────────┘                                 │
│        └─────────────┘                                             │
│               │                                                     │
│               │ reset_complete()                                   │
│               ▼                                                     │
│        ┌─────────────┐                                             │
│        │INITIALIZED  │                                             │
│        └─────────────┘                                             │
│                                                                     │
│   Example: BufferPersistNode                                       │
│   ────────────────────────────                                     │
│   class BufferPersistNode {                                        │
│     float buffer[NUM_LEDS];     // Persistent state                │
│     StatefulNodeState state;    // Lifecycle state                 │
│     uint32_t magic;              // Integrity check (0xDEADBEEF)   │
│                                                                     │
│     void ensure_init() {                                           │
│       if (state == UNINITIALIZED) {                                │
│         memset(buffer, 0, sizeof(buffer));                         │
│         state = INITIALIZED;                                       │
│       }                                                             │
│     }                                                               │
│                                                                     │
│     void update(float* input, float decay) {                       │
│       ensure_init();                                               │
│       for (int i = 0; i < NUM_LEDS; i++) {                         │
│         buffer[i] = decay * buffer[i] + (1 - decay) * input[i];   │
│       }                                                             │
│       state = ACTIVE;                                              │
│     }                                                               │
│                                                                     │
│     void reset() {                                                 │
│       memset(buffer, 0, sizeof(buffer));                           │
│       state = INITIALIZED;                                         │
│     }                                                               │
│   };                                                                │
│                                                                     │
│   Integrity Validation:                                            │
│   ──────────────────────                                           │
│   - Each stateful node has magic number (0xDEADBEEF)              │
│   - Validated at frame start (debug builds)                        │
│   - Detects memory corruption or uninitialized access              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 10. Integration with Firmware Subsystems

```
┌─────────────────────────────────────────────────────────────────────┐
│              Firmware Integration Architecture                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────────────────────────────────────────────────────┐    │
│   │                   Core 0 (GPU Loop)                      │    │
│   ├──────────────────────────────────────────────────────────┤    │
│   │                                                           │    │
│   │  void loop_gpu() {                                       │    │
│   │    // 1. Audio acquisition                               │    │
│   │    AudioDataSnapshot audio;                              │    │
│   │    get_audio_snapshot(&audio); ◄─────────────────┐      │    │
│   │                                                   │      │    │
│   │    // 2. Parameter read                          │      │    │
│   │    const PatternParameters& params = get_params();│      │    │
│   │                                                   │      │    │
│   │    // 3. Pattern render                          │      │    │
│   │    static PatternState state;                    │      │    │
│   │    PatternOutput out;                            │      │    │
│   │    pattern_bloom_render(frame_count, audio, ─────┼──┐   │    │
│   │                         params, state, out);     │  │   │    │
│   │                                                   │  │   │    │
│   │    // 4. Quantize (float → uint8)                │  │   │    │
│   │    quantize_frame(out.leds, raw_led_data, params);  │   │    │
│   │                                                   │  │   │    │
│   │    // 5. Transmit to RMT peripheral              │  │   │    │
│   │    transmit_leds_dual_channel(raw_led_data, ─────┼──┼─> │    │
│   │                               raw_led_data_ch2); │  │   │    │
│   │                                                   │  │   │    │
│   │    // 6. Telemetry                               │  │   │    │
│   │    watch_cpu_fps();                              │  │   │    │
│   │    frame_count++;                                │  │   │    │
│   │  }                                                │  │   │    │
│   │                                                   │  │   │    │
│   └───────────────────────────────────────────────────┼──┼───┘    │
│                                                       │  │        │
│   ┌──────────────────────────────────────────────────┼──┼───┐    │
│   │                   Core 1 (CPU Loop)              │  │   │    │
│   ├──────────────────────────────────────────────────┼──┼───┤    │
│   │                                                   │  │   │    │
│   │  void loop_cpu() {                               │  │   │    │
│   │    // 1. I2S microphone read                     │  │   │    │
│   │    int16_t samples[512];                         │  │   │    │
│   │    i2s_read(I2S_NUM_0, samples, ...);            │  │   │    │
│   │                                                   │  │   │    │
│   │    // 2. FFT computation                         │  │   │    │
│   │    float spectrum[NUM_FREQS];                    │  │   │    │
│   │    fft_compute(samples, spectrum);               │  │   │    │
│   │                                                   │  │   │    │
│   │    // 3. Beat detection                          │  │   │    │
│   │    float beat_confidence = detect_beat(samples); │  │   │    │
│   │                                                   │  │   │    │
│   │    // 4. Update audio snapshot (lock-free)       │  │   │    │
│   │    audio_snapshot_update(spectrum, beat_confidence)──┘   │    │
│   │                                                           │    │
│   │    // 5. Network tasks (WiFi/BLE)                        │    │
│   │    handle_network_events();                              │    │
│   │                                                           │    │
│   │    // 6. REST API                                        │    │
│   │    rest_server_handle();                                 │    │
│   │                                                           │    │
│   │    vTaskDelay(pdMS_TO_TICKS(10));                        │    │
│   │  }                                                        │    │
│   │                                                           │    │
│   └───────────────────────────────────────────────────────────┘    │
│                                                                     │
│   ┌──────────────────────────────────────────────────────────┐    │
│   │               RMT Peripheral (Hardware)                  │    │
│   ├──────────────────────────────────────────────────────────┤    │
│   │                                                           │    │
│   │  Channel 0 (GPIO 5): 160 LEDs × 3 bytes (GRB order)     │◄───┤
│   │  Channel 1 (GPIO 4): 160 LEDs × 3 bytes (GRB order)     │    │
│   │                                                           │    │
│   │  WS2812 Protocol: 800 kHz, ~6 ms transmit time          │    │
│   │                                                           │    │
│   └───────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

**Document Version:** 1.0 (2025-11-10)
**Status:** Supporting Diagrams for Architecture Spec
**Related:** `K1NArch_SPEC_GRAPH_SYSTEM_ARCHITECTURE_v1.0_20251110.md`

**End of Document**

# K1.node1 Graph Node Catalog

**Version:** 1.0
**Date:** November 10, 2025
**Status:** Reference (Phase 1 Implementation)
**Related:** `docs/plans/2025-11-10-phase1-compiler-design.md`, `codegen/schemas/graph.schema.json`

---

## Overview

This document defines the **initial 14 node types** available in the K1.node1 graph system (Phase 1). These nodes form the foundation for pattern definition; additional nodes will be added in subsequent phases (Phase 2+) based on usage feedback and performance validation.

Each node entry specifies:
- **Node Type** — identifier used in JSON (e.g., `"type": "Time"`)
- **Inputs** — required/optional port connections
- **Parameters** — compile-time configuration values
- **Output** — result type (scalar, vector, buffer, event)
- **Memory Cost** — RAM/state requirements
- **Constraints** — special rules (stateful, side-effects, etc.)

---

## Input Nodes

### Time
Provides absolute elapsed time since pattern start.

| Property | Value |
|----------|-------|
| **Node Type** | `Time` |
| **Inputs** | *(none)* |
| **Parameters** | *(none)* |
| **Output** | `time` (seconds, float) |
| **Memory** | 0 bytes (pure, no state) |
| **Constraints** | Pure function; deterministic across frames |

**Usage:**
```json
{"id": "time", "type": "Time", "inputs": {}, "params": {}}
```

---

### AudioSnapshot
Captures current audio analysis (spectrum + envelope) as a single snapshot per frame.

| Property | Value |
|----------|-------|
| **Node Type** | `AudioSnapshot` |
| **Inputs** | *(none)* |
| **Parameters** | *(none)* |
| **Output** | `audio_spectrum` (float[NUM_FREQS]) + `audio_envelope` (float) |
| **Memory** | 0 bytes (reads from firmware ringbuffer) |
| **Constraints** | Called once per frame; may block briefly on I2S timeout (fallback: silence) |

**Usage:**
```json
{"id": "audio", "type": "AudioSnapshot", "inputs": {}, "params": {}}
```

**Port Names (Outputs):**
- `spectrum` → `audio_spectrum` (NUM_FREQS frequencies)
- `envelope` → `audio_envelope` (scalar VU/energy)

---

### Beat
Detects beat events from audio envelope.

| Property | Value |
|----------|-------|
| **Node Type** | `Beat` |
| **Inputs** | `envelope: audio_envelope` (required) |
| **Parameters** | `threshold: float` (0.0–1.0, default 0.5) |
| **Output** | `beat_event` (bool pulse) |
| **Memory** | ~16 bytes (last_beat_time) |
| **Constraints** | Stateful; emits discrete pulse on threshold cross |

**Usage:**
```json
{"id": "beat_detector", "type": "Beat", "inputs": {"envelope": "audio"}, "params": {"threshold": 0.6}}
```

---

## Parameter Nodes

### ParamF
Exposes a floating-point parameter for UI control.

| Property | Value |
|----------|-------|
| **Node Type** | `ParamF` |
| **Inputs** | *(none)* |
| **Parameters** | `name: string` (UI label, e.g., "Speed"), `min: float` (0.0), `max: float` (1.0), `default: float` (0.5) |
| **Output** | `param<float>` |
| **Memory** | 0 bytes (reads from PatternParameters struct) |
| **Constraints** | Read-only; value set by firmware at frame time |

**Usage:**
```json
{"id": "speed_param", "type": "ParamF", "inputs": {}, "params": {"name": "Speed", "min": 0.0, "max": 2.0, "default": 1.0}}
```

---

### ParamColor
Exposes a color parameter for UI control.

| Property | Value |
|----------|-------|
| **Node Type** | `ParamColor` |
| **Inputs** | *(none)* |
| **Parameters** | `name: string` (UI label, e.g., "Base Color"), `default: [r, g, b]` (0.0–1.0 each) |
| **Output** | `param<color>` (alias: `param<vec3>`) |
| **Memory** | 0 bytes (reads from PatternParameters struct) |
| **Constraints** | Read-only; clamped to [0, 1] at emit time |

**Usage:**
```json
{"id": "base_color", "type": "ParamColor", "inputs": {}, "params": {"name": "Base Color", "default": [1.0, 0.0, 0.0]}}
```

---

## Math Nodes

### Add
Scalar addition.

| Property | Value |
|----------|-------|
| **Node Type** | `Add` |
| **Inputs** | `a: float`, `b: float` |
| **Parameters** | *(none)* |
| **Output** | `float` (a + b) |
| **Memory** | 0 bytes (pure) |
| **Constraints** | No saturation; result clamped by downstream consumers |

**Usage:**
```json
{"id": "sum", "type": "Add", "inputs": {"a": "time", "b": "param1"}, "params": {}}
```

---

### Mul
Scalar multiplication.

| Property | Value |
|----------|-------|
| **Node Type** | `Mul` |
| **Inputs** | `a: float`, `b: float` |
| **Parameters** | *(none)* |
| **Output** | `float` (a × b) |
| **Memory** | 0 bytes (pure) |
| **Constraints** | No saturation; result clamped by downstream consumers |

**Usage:**
```json
{"id": "product", "type": "Mul", "inputs": {"a": "time", "b": "amplitude"}, "params": {}}
```

---

### Lerp
Linear interpolation between two scalars.

| Property | Value |
|----------|-------|
| **Node Type** | `Lerp` |
| **Inputs** | `a: float`, `b: float`, `t: float` (blend factor, 0–1) |
| **Parameters** | *(none)* |
| **Output** | `float` (a + t × (b − a)) |
| **Memory** | 0 bytes (pure) |
| **Constraints** | No clamping of `t`; extrapolates if t < 0 or t > 1 |

**Usage:**
```json
{"id": "blend", "type": "Lerp", "inputs": {"a": "color1", "b": "color2", "t": "phase"}, "params": {}}
```

---

## Color Nodes

### Hsv
Convert HSV (hue, saturation, value) to RGB.

| Property | Value |
|----------|-------|
| **Node Type** | `Hsv` |
| **Inputs** | `h: float` (hue, 0–1), `s: float` (saturation, 0–1), `v: float` (value/brightness, 0–1) |
| **Parameters** | *(none)* |
| **Output** | `color` (vec3, RGB 0–1 each channel) |
| **Memory** | 0 bytes (pure) |
| **Constraints** | Input hue wraps modulo 1.0 |

**Usage:**
```json
{"id": "hsv_color", "type": "Hsv", "inputs": {"h": "hue_node", "s": "sat_param", "v": "val_param"}, "params": {}}
```

---

### Color
Construct RGB color from explicit R, G, B values.

| Property | Value |
|----------|-------|
| **Node Type** | `Color` |
| **Inputs** | `r: float` (0–1), `g: float` (0–1), `b: float` (0–1) |
| **Parameters** | *(none)* |
| **Output** | `color` (vec3) |
| **Memory** | 0 bytes (pure) |
| **Constraints** | No clamping; clamping deferred to output stage |

**Usage:**
```json
{"id": "rgb_color", "type": "Color", "inputs": {"r": "r_val", "g": "g_val", "b": "b_val"}, "params": {}}
```

---

## Buffer Nodes

### Fill
Create a uniform LED buffer with a single color.

| Property | Value |
|----------|-------|
| **Node Type** | `Fill` |
| **Inputs** | `color: color` (broadcast to all LEDs) |
| **Parameters** | *(none)* |
| **Output** | `led_buffer<vec3>` (NUM_LEDS × RGB) |
| **Memory** | ~1.2 KB (NUM_LEDS × 4 bytes, assume 256 LEDs) |
| **Constraints** | Temporary buffer; lifetime ends at next consumer or output |

**Usage:**
```json
{"id": "filled", "type": "Fill", "inputs": {"color": "my_color"}, "params": {}}
```

---

### Blur
Apply spatial blur (box filter) to LED buffer.

| Property | Value |
|----------|-------|
| **Node Type** | `Blur` |
| **Inputs** | `src: led_buffer<vec3>` |
| **Parameters** | `radius: int` (1–5, default 1) |
| **Output** | `led_buffer<vec3>` |
| **Memory** | ~1.2 KB (output buffer) |
| **Constraints** | Pure convolution; reads boundary as wrap-around or clamp (TBD in implementation) |

**Usage:**
```json
{"id": "blurred", "type": "Blur", "inputs": {"src": "filled"}, "params": {"radius": 2}}
```

---

## Stateful Nodes

### BufferPersist
Maintains persistent state across frames (exponential decay blend).

| Property | Value |
|----------|-------|
| **Node Type** | `BufferPersist` |
| **Inputs** | `src: led_buffer<vec3>` (new frame), `decay: float` (0.0–1.0, blend factor) |
| **Parameters** | *(none)* |
| **Output** | `led_buffer<vec3>` (persistent buffer) |
| **Memory** | ~1.2 KB (persistent state buffer) |
| **Constraints** | **Stateful:** allocates once at pattern start; reused every frame. Formula: `out[i] = decay × prev[i] + (1 − decay) × src[i]` |

**Usage:**
```json
{"id": "persisted", "type": "BufferPersist", "inputs": {"src": "new_buffer"}, "params": {"decay": 0.9}}
```

---

## Output Nodes

### LedOutput
Write buffer to hardware LED strip.

| Property | Value |
|----------|-------|
| **Node Type** | `LedOutput` |
| **Inputs** | `color: led_buffer<vec3>` (required) |
| **Parameters** | *(none)* |
| **Output** | void (writes to global `leds[NUM_LEDS]`) |
| **Memory** | 0 bytes (no local state) |
| **Constraints** | **Terminal node:** no further processing. Color values **clamped to [0, 1]** before write. |

**Usage:**
```json
{"id": "out", "type": "LedOutput", "inputs": {"color": "my_buffer"}, "params": {}}
```

---

### LedOutputMirror
Write buffer to hardware LED strip with vertical mirror.

| Property | Value |
|----------|-------|
| **Node Type** | `LedOutputMirror` |
| **Inputs** | `color: led_buffer<vec3>` (required) |
| **Parameters** | *(none)* |
| **Output** | void (writes to global `leds[NUM_LEDS]` with mirror symmetry) |
| **Memory** | 0 bytes (no local state) |
| **Constraints** | **Terminal node.** Assumes NUM_LEDS is even; mirrors first half to second half. Color values **clamped to [0, 1]** before write. |

**Usage:**
```json
{"id": "mirror_out", "type": "LedOutputMirror", "inputs": {"color": "my_buffer"}, "params": {}}
```

---

## Port Type Reference

| Type | C++ Equivalent | Size | Notes |
|------|---|---|---|
| `int` | `int32_t` | 4 bytes | Indices, counts |
| `bool` | `bool` | 1 byte | Toggles, events |
| `float` | `float` | 4 bytes | Scalars (0–1 typical) |
| `vec2` | `CRGBF[2]` or custom | 8 bytes | 2D coordinates |
| `vec3` | `CRGBF` or similar | 12 bytes | RGB colors, 3D vectors |
| `color` | alias for `vec3` | 12 bytes | Same as vec3 |
| `time` | `float` | 4 bytes | Seconds (from Time node) |
| `duration` | `float` | 4 bytes | Delta time |
| `rng_seed` | `uint32_t` | 4 bytes | Random seed (future) |
| `audio_spectrum` | `float[NUM_FREQS]` | ~256 bytes | Frequency bins |
| `audio_envelope` | `float` | 4 bytes | VU/energy scalar |
| `beat_event` | `bool` | 1 byte | Pulse on beat |
| `param<float>` | `float` | 4 bytes | Parameter from UI |
| `param<color>` | `CRGBF` | 12 bytes | Color parameter from UI |
| `led_buffer<float>` | `float[NUM_LEDS]` | ~1 KB | Per-LED scalar |
| `led_buffer<vec3>` | `CRGBF[NUM_LEDS]` | ~1.2 KB | Per-LED RGB |

---

## Type Coercion Rules (Explicit Only)

The compiler supports **explicit coercions** via dedicated nodes. **No implicit conversions** are allowed between buffer types.

| From | To | Method | Notes |
|------|----|----|---|
| `int` | `float` | Implicit widening | Safe; all ints representable |
| `float` | `vec3` (broadcast) | Dedicated node (future: `Splat` or `Broadcast`) | Same value on all channels |
| `vec3` ↔ `color` | Bidirectional alias | Implicit | Type system aliases |
| `float`/`vec3` → `led_buffer<T>` (fill) | `Fill` node | Broadcast to all LEDs |
| `led_buffer<float>` ↔ `led_buffer<vec3>` | **NOT ALLOWED** | — | Requires explicit unpack/pack node (Phase 2) |

---

## Node Constraints Summary

### Pure Nodes (No State)
- `Time`, `Add`, `Mul`, `Lerp`, `Hsv`, `Color`, `Fill`, `Blur`
- Properties: deterministic, idempotent, side-effect-free
- Optimization: eligible for constant folding and CSE

### Stateful Nodes (Maintain State)
- `Beat` (last beat time), `BufferPersist` (persistent LED buffer)
- Properties: memory <1 KB per ADR-0007; ordered execution
- Optimization: NOT eligible for CSE or reordering

### Terminal Nodes (No Output)
- `LedOutput`, `LedOutputMirror`
- Properties: write to hardware; one or more must be graph root

### Constraints
- **Cycle-free:** DAG only; topological sort required
- **Port connectivity:** required inputs must be connected OR have declared defaults
- **Type compatibility:** port types must match or be coercible
- **Memory budget:** all stateful buffers <1 KB; temp buffers pooled in 16 KB scratch
- **Color range:** output automatically clamped to [0, 1] before write

---

## Example: Bloom + Mirror Pattern

```json
{
  "version": 1,
  "name": "bloom_mirror",
  "nodes": [
    {"id": "time", "type": "Time", "inputs": {}, "params": {}},
    {"id": "audio", "type": "AudioSnapshot", "inputs": {}, "params": {}},
    {"id": "bloom", "type": "BloomTrail", "inputs": {"audio": "audio"}, "params": {"decay": 0.92}},
    {"id": "mirror", "type": "Mirror", "inputs": {"src": "bloom"}, "params": {}},
    {"id": "out", "type": "LedOutput", "inputs": {"color": "mirror"}, "params": {}}
  ]
}
```

**Note:** `BloomTrail` and `Mirror` nodes are **NOT** in Phase 1 catalog; this is a forward-looking example. Phase 1 uses `BufferPersist` for decay and explicit `Color` + math nodes for transformations.

---

## Phase 1 → Phase 2 Roadmap

**Phase 1 (current):** 14 base nodes covering time, audio, params, math, colors, buffers, output.

**Phase 2 (planned):** Extended effects
- `Mirror` — automatic symmetry
- `BloomTrail` — dedicated bloom filter
- `Quantize` — rasterize analog values
- `Hue Rotate` — color space rotations
- `Modulo` — cyclic patterns
- `Noise` — procedural randomness (RNG nodes)

**Phase 3 (future):** Advanced DSP
- Frequency-domain analysis
- Beat-synced timing
- Audio-reactive envelopes
- Multi-buffer operations

---

## Integration Checklist (for Compiler Implementation)

- [ ] Parse `graph.schema.json` to validate node type enum
- [ ] For each node type, implement:
  - [ ] **Parser:** recognize node in AST
  - [ ] **Validator:** check input/output port types
  - [ ] **Optimizer:** identify pure nodes for CSE
  - [ ] **Scheduler:** allocate buffers, order execution
  - [ ] **Emitter:** generate C++ code calling firmware APIs
- [ ] Create fixtures with Bloom + Spectrum examples
- [ ] E2E test: graph → C++ → compile → simulate → CRC match

---

**Related Artifacts:**
- `docs/plans/2025-11-10-phase1-compiler-design.md` — Compiler architecture & stage contracts
- `codegen/schemas/graph.schema.json` — JSON Schema validation
- `firmware/src/stateful_nodes.h/.cpp` — Stateful node implementations (Task 9)
- `firmware/src/parameters.h` — Parameter structs for UI integration


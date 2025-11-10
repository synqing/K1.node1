# K1.node1 Graph JSON Schema (v1)

Status: Stable (v1.0)
Audience: Graph authors, tool maintainers, codegen developers

Overview
- A graph is a directed acyclic graph (DAG) of nodes that produce per‑frame LED output.
- JSON schema is intentionally minimal; deep typing/compatibility is validated by the compiler (Stage 2).
- Versioned format (`version: "v1.0"`) to allow additive evolution without breaking existing graphs.

Top‑Level Structure
```
{
  "name": "pattern_name",          // snake_case, unique within repo
  "version": "v1.0",               // string pattern ^v\d+\.\d+$
  "meta": {                         // optional
    "description": "…"
  },
  "nodes": [ Node, … ]
}
```

Node Object
```
{
  "id": "unique_id",               // snake_case per-graph
  "type": "NodeType",              // resolved by runtime node catalog
  "inputs": {                       // optional; port → source node id
    "portName": "sourceNodeId"
  },
  "params": {                       // optional; node-specific parameters
    "k": v
  },
  "meta": {                         // optional; authoring aids
    "name": "Human name",
    "comment": "Author notes",
    "filePos": { "file": "…", "line": 10, "col": 1 }
  }
}
```

Type System (compiler‑level)
- Core scalars/vectors: `int`, `bool`, `float`, `vec2`, `vec3`, `color` (alias of `vec3`)
- Temporal: `time`, `duration`, `rng_seed`
- Audio: `audio_spectrum`, `audio_envelope`, `beat_event`
- Params: `param_float`, `param_color`
- Buffers: `led_buffer_float`, `led_buffer_vec3`

Coercions
- Allowed:
  - `int → float`
  - `float → vec3` (broadcast)
  - `vec3 ↔ color` (alias)
- Broadcast into buffers is node‑specific (only when the node supports it). There is no implicit `buffer<float> ↔ buffer<vec3>` coercion.

Validation Rules (Stage 2)
- Graph
  - DAG only (Kahn’s algorithm). Cycles are errors with cycle path.
  - Roots must be known outputs (`LedOutput`, `LedOutputMirror`).
- Ports
  - Required inputs must be connected or have defaults.
  - Unknown/extra inputs are errors.
  - Dangling sources (unknown node id) are errors.
- Types
  - Exact match or permitted coercion; otherwise, type mismatch error.
  - Color channels clamped at emission before writing to LEDs.
- Memory/Policy
  - Stateful node memory: tiered policy (≤1KB target, 1–2.5KB warning, >2.5KB error). Strict mode available.
  - Per‑graph state budget default 16KB; configurable via CLI.
  - Scratch cap enforced by scheduler (peak concurrent temporary bytes), configurable via CLI.

Stage Artifacts (with `--dump`)
- `dump-ast.json`: normalized AST (maps expanded to objects).
- `dump-typed.json`: inferred output types per node and input compatibility.
- `dump-plan.json`: schedule order and buffer allocations (with lifetimes).

Authoring Conventions
- IDs: `snake_case` short, descriptive (`band_shape`, `mirror`).
- Keep graphs small and declarative; prefer compositions of simple nodes.
- Use `ParamF`/`ParamColor` to wire UI controls (see Authoring Guide).
- Prefer palettes via `ColorizeBuffer`/`GradientMap` for stylistic parity.

Minimal Examples
- Bloom (excerpt)
```
{
  "name": "bloom",
  "version": "v1.0",
  "nodes": [
    { "id": "audio", "type": "AudioSpectrum" },
    { "id": "shape", "type": "BandShape", "inputs": { "src": "audio" }, "params": { "gain": 1.2, "smoothing": 0.6 } },
    { "id": "trail", "type": "BufferPersist", "inputs": { "src": "shape" }, "params": { "decay": 0.92 } },
    { "id": "colorize", "type": "ColorizeBuffer", "inputs": { "index_buf": "trail" } },
    { "id": "dots", "type": "DotRender", "inputs": { "base_buf": "colorize" }, "params": { "indices": [10,30,50,80] } },
    { "id": "mirror", "type": "Mirror", "inputs": { "src": "dots" } },
    { "id": "out", "type": "LedOutput", "inputs": { "color": "mirror" } }
  ]
}
```

- Spectrum (excerpt)
```
{
  "name": "spectrum",
  "version": "v1.0",
  "nodes": [
    { "id": "audio", "type": "AudioSpectrum" },
    { "id": "band", "type": "BandShape", "inputs": { "src": "audio" } },
    { "id": "color", "type": "GradientMap", "inputs": { "index": "band" } },
    { "id": "fill", "type": "Fill", "inputs": { "color": "color" } },
    { "id": "dots", "type": "DotRender", "inputs": { "base_buf": "fill" }, "params": { "indices": [8,24,40,56] } },
    { "id": "mirror", "type": "Mirror", "inputs": { "src": "dots" } },
    { "id": "out", "type": "LedOutputMirror", "inputs": { "color": "mirror" } }
  ]
}
```

Versioning
- Use `version: "v1.0"` for current graphs.
- Backwards‑compatible additions will bump the minor (v1.1), breaking changes bump major.

CLI Quick Reference
- Validate: `k1c validate graph.json [--dump]`
- Build: `k1c build graph.json --out firmware/src/graph_codegen/pattern_<name>.cpp [--dump] [--no-inplace] [--scratch-cap <bytes>]`


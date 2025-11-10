# Graph Editor Integration Guide

This guide explains how the web UI integrates with the compiler (Task 5) and node catalog (Task 6) to author, validate, and compile graphs into firmware C++.

## Components

- Editor View: renders nodes, connections, and inline errors
- Parameter Inspector: edits scalar/vector/color/bool/enum parameters with bounds
- Validator Bridge: displays errors `{nodeId, type, port, location, code}`
- Compiler Bridge: invokes `k1c build graph.json --out firmware/src/graph_codegen/`

## Contracts

- Graph JSON must comply with `codegen/schemas/graph.schema.json`
- Validator errors include node metadata used by UI for highlighting
- Emitter guarantees: single `get_audio_snapshot`, no heap, RGB clamp

## Flow

1. Author nodes and connections in the editor
2. Inline validation triggers on change (no compile)
3. On compile: POST to backend / run CLI `k1c build …`
4. UI shows compiler output (success or structured error list)
5. Download generated C++ or auto-checkout into `firmware/src/graph_codegen/`

## Error Handling

- Display error list with context: node label, port name, type mismatch description
- Cycle errors show path `A → B → C → A`
- Memory budget errors show computed bytes vs 1 KB

## Parameter Editor

- Types: int, float, bool, vec2, vec3, color, enum
- Enforce bounds and defaults from node catalog (Task 6)
- Tooltips link to SDK docs per node type

## Examples

- Bloom: nodes for FFT → smoothing → buffer persist → mirror → HSV/gradient → output
- Spectrum: FFT bands → shaping/mix → mirror/shift → overlay dots → output

## References

- Schema: `codegen/schemas/graph.schema.json`
- Node Catalog: Task 6 deliverable
- CLI: `k1c build graph.json --out firmware/src/graph_codegen/`


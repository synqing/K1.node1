
# Graph Authoring Guide (v1)

This guide shows how to design graphs that compile reliably and perform well on K1.node1.

Quick Start
- Create a new file in `graphs/your_pattern.json` with `version: "v1.0"`.
- Start from a minimal chain: `AudioSpectrum → BandShape → ColorizeBuffer → Mirror → LedOutput`.
- Validate and build:
  - `node codegen/dist/cli.js validate graphs/your_pattern.json --dump`
  - `node codegen/dist/cli.js build graphs/your_pattern.json --out firmware/src/graph_codegen/pattern_your_pattern.cpp`

Naming & Structure
- Use short `snake_case` ids (`audio`, `band`, `color`, `mirror`, `out`).
- Keep a single obvious output root (`LedOutput` or `LedOutputMirror`).
- Prefer small, composable nodes over multi‑function mega‑nodes.

Inputs, Params, Types
- Inputs connect node outputs by id. Port names must match node specs (`index_buf`, `src`, `base`, `overlay`, etc.).
- Params are free‑form per node; keep them simple numbers, enums, or small arrays (e.g., DotRender `indices`).
- Types are inferred. Allowed implicit conversions:
  - `int → float`
  - `float → vec3`
  - `vec3 ↔ color`
- No implicit buffer type conversion or scalar→buffer unless the node handles it.

Common Recipes
- Palette‑driven color:
  - `BandShape → ColorizeBuffer → Mirror → LedOutput`
- Gradient mapping of scalar indices:
  - `BandShape → GradientMap → Fill → LedOutput`
- Trails/persistence:
  - `BandShape → BufferPersist(decay) → ColorizeBuffer → LedOutput`
- Dot overlays:
  - `… → ColorizeBuffer → DotRender(indices:[…]) → Mirror → LedOutput`

Parameters & UI Wiring
- Use `ParamF` nodes to read runtime controls from firmware parameters:
  - Names: `brightness`, `softness`, `color`, `saturation`, `background`, `speed`, `custom_param_1/2/3`.
  - Example: `ParamF(name:"saturation") → Hsv.s → …`
- Use `ParamColor` for palette‑derived colors: compiles to `color_from_palette(get_params().palette_id, get_params().color, 1.0)`.

### Port Names Quick Ref (Handy)
- BandShape: `src`
- BufferPersist: `src`
- ColorizeBuffer: `index_buf`
- GradientMap: `index`
- Fill: `color`
- Mirror: `src`
- Blur: `src`
- Shift: `src`
- Downsample: `src`
- DotRender: `base_buf`
- ComposeLayers: `base`, `overlay`
- LedOutput: `color`
- LedOutputMirror: `color`

Debugging
- Use `--dump` to write:
  - `dump-ast.json` (parsed graph),
  - `dump-typed.json` (inferred types and compatibility),
  - `dump-plan.json` (schedule + allocations).
- Validator messages include node id/port; fix unknown ports and type mismatches first.
- Disable in‑place transforms with `--no-inplace` if you suspect buffer aliasing issues.

Performance Tips
- Start with `--no-inplace` during design. Enable in‑place once the pattern’s stable.
- Avoid deep chains of expensive geometry nodes in one frame (e.g., large `Blur` radii).
- Keep DotRender index lists small; prefer event‑driven overlays.
- Use `BufferPersist` conservatively (decay ~0.9–0.95 typical) to stay under state budgets.

Do’s & Don’ts
- Do keep graphs acyclic and small.
- Do use palettes or Hsv for color; clamp happens at output.
- Don’t broadcast scalars to buffers unless the node supports it.
- Don’t create multiple disjoint outputs; remove orphan subgraphs.

Examples
- See `graphs/bloom.json` and `graphs/spectrum.json` for working PoCs.
- The `docs/06-reference/SENSORY_BRIDGE_COMPAT.md` maps legacy functions to nodes.

Appendix
- Full schema reference: `docs/06-reference/GRAPH_SCHEMA_SPEC.md`
- Bring‑up checklist: `docs/09-implementation/CODEGEN_BRINGUP_CHECKLIST.md`

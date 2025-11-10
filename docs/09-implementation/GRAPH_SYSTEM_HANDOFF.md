
# Graph System Handoff (v1)

Purpose
- Enable the team to author, lint, validate, and build graph‑based patterns without hardware.
- Provide a minimal, reliable flow for PoC bring‑up; defer optimizations until device tests.

Objectives (v1)
- Author graphs that compile to firmware C++ with predictable visuals.
- Keep patterns deterministic: single PATTERN_AUDIO_START per frame; no heap in frame loop.
- Rely on firmware `NUM_LEDS`; clamping before write enforced in emitter.

Read Me First
- Schema Spec: `docs/06-reference/GRAPH_SCHEMA_SPEC.md`
- Authoring Guide: `docs/09-implementation/GRAPH_AUTHORING_GUIDE.md`
- Node Catalog (table + ports): `docs/06-reference/NODE_CATALOG_REFERENCE.md`
- Troubleshooting: `docs/09-implementation/GRAPH_TROUBLESHOOTING.md`
- SB/Emotiscope Compatibility: `docs/06-reference/SENSORY_BRIDGE_COMPAT.md`

Quick Commands
- Lint graphs (style + basic structure):
  - `npm run graphs:lint`
- Validate graphs (parser + validator):
  - `npm run graphs:validate`
  - Add `--dump` in CLI to write stage artifacts: `dump-ast.json`, `dump-typed.json`, `dump-plan.json`
- Build all graphs to firmware C++ (default paths):
  - `npm run graphs:build`
- Per‑graph build (with flags):
  - `node codegen/cli.js build graphs/<name>.json [--no-inplace] [--scratch-cap <bytes>] [--dump]`

Examples (ready to tweak)
- `graphs/examples/glow_trail.json` — BandShape → BufferPersist → ColorizeBuffer → LedOutput
- `graphs/examples/blend_waves.json` — Hsv/Fill vs ColorizeBuffer → ComposeLayers (add)
- `graphs/examples/overlay_peaks.json` — GradientMap → Fill → DotRender → Mirror → LedOutputMirror
- `graphs/examples/param_demo.json` — ParamF wiring to Hsv.s and ComposeLayers path
- `graphs/examples/force_saturation_demo.json` — Clamp/Pow/Hsv + ForceSaturation tweak
- `graphs/examples/opacity_blend_demo.json` — Base ForceSaturation blended with audio overlay (opacity 0.4)

Emitter Behavior (v1)
- Audio: Single `PATTERN_AUDIO_START()` per frame. Use `AUDIO_SPECTRUM_SMOOTH`, `NUM_FREQS`.
- Memory: No heap in frame loop. Uses firmware `NUM_LEDS`; static_asserts guard size.
- In‑place: Limited to vec3 `Add/Mul/Lerp` and (safe subset) `ComposeLayers` (add|multiply, opacity=1, single consumer).
  - Disable with `--no-inplace` if debugging aliasing.
- Color: Clamp applied before writing to `PatternOutput`.

Authoring Tips
- Keep node IDs snake_case and descriptive (e.g., `band`, `rgb`, `mirror`).
- Use canonical port names (see Node Catalog quick ref): `index_buf`, `src`, `base`/`overlay`, etc.
- Prefer palettes (ColorizeBuffer/GradientMap) for broad compatibility; use Hsv for algorithmic control.
- Use `ParamF`/`ParamColor` to wire runtime controls from firmware.

Validation & Debug
- Lint catches: snake_case ids, known node types, port names, orphan nodes.
- Validator catches: type mismatches, unknown ports, dangling sources; cycle detection.
- Dumps:
  - `dump-ast.json` → parsed nodes with inputs/params
  - `dump-typed.json` → inferred output types and input compatibility
  - `dump-plan.json` → schedule order and buffer lifetimes

Acceptance Criteria (Device Bring‑Up)
- Bloom/Spectrum render properly; FPS within ~2% of manual.
- Single `PATTERN_AUDIO_START` per frame; no heap allocations.
- Clamping present at output; no visible artifacts with `--no-inplace`.

Known Limitations (v1)
- `ColorizeBuffer/GradientMap` are out‑of‑place.
- `Blur/Shift/Downsample` are out‑of‑place (helpers copy into outputs).
- `ComposeLayers` in‑place only for add/multiply with opacity=1 and single consumer.

When Hardware Is Available
- Build firmware with generated patterns, verify visuals/FPS.
- If stable, we can consider extending in‑place rules (only as needed).

Contacts & Support
- Start with `GRAPH_TROUBLESHOOTING.md` for common validator issues.
- For node wiring questions, see `NODE_CATALOG_REFERENCE.md` (table + port quick ref).
- For porting from Sensory Bridge, see `SENSORY_BRIDGE_COMPAT.md` examples.

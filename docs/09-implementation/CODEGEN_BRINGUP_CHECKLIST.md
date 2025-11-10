Codegen Bring‑Up Checklist (v1)

Quick Steps
- Validate graphs (dump artifacts):
  - node codegen/dist/cli.js validate graphs/bloom.json --dump
  - node codegen/dist/cli.js validate graphs/spectrum.json --dump
- Build generated patterns (default in-place enabled):
  - node codegen/dist/cli.js build graphs/bloom.json --out firmware/src/graph_codegen/pattern_bloom.cpp --dump
  - node codegen/dist/cli.js build graphs/spectrum.json --out firmware/src/graph_codegen/pattern_spectrum.cpp --dump
- Optional: disable in-place for debugging
  - node codegen/dist/cli.js build graphs/bloom.json --no-inplace --out firmware/src/graph_codegen/pattern_bloom.cpp

On-Device Checks
- Patterns render without artifacts (Bloom, Spectrum)
- Single PATTERN_AUDIO_START per frame (grep generated file)
- RGB clamping present before writing PatternOutput
- FPS within ~2% of manual patterns
- No heap allocations in frame loop

Artifacts (when using --dump)
- dump-ast.json: parsed AST (inputs/params expanded)
- dump-typed.json: inferred output types and input compatibility
- dump-plan.json: schedule and buffer allocations

Notes
- NUM_LEDS is taken from firmware; static_asserts guard mismatches.
- In-place reuse currently limited to vec3 Add/Mul/Lerp; can be disabled via --no-inplace.


# Graph → Code → Firmware Integration Test Harness Plan

Defines the integration tests for Task 18 covering authoring → compile → firmware runtime.

## Goals

- Validate end-to-end pipeline using graphs for Bloom, Spectrum, and migrated patterns
- Ensure validator/compiler errors surface in UI/CLI with actionable metadata
- Verify runtime constraints: no heap, single audio snapshot, RGB clamp, scratch cap

## CI Job (Outline)

1. Validate graphs against `codegen/schemas/graph.schema.json` (ajv / jsonschema)
2. Run `k1c build` for each graph under `graphs/` → emit C++ into `firmware/src/graph_codegen/`
3. Build firmware
4. Run CPU simulation of generated draw functions for N frames with test audio vectors → compare pixel CRC against baseline
5. Collect metrics (scratch buffer use, codegen time)
6. Fail on any mismatch or cap violation

## Test Matrix

- Patterns: Bloom, Spectrum, +N migrated
- Params: mirror on/off, chromatic on/off, presets
- Errors: invalid port, cycle, type mismatch, memory budget exceeded

## Artifacts

- dump-ast.json, dump-typed.json, dump-opt.json, dump-plan.json (per pattern)
- compiler logs, firmware build logs, CRC baselines

## Hardware Smoke Tests

- Flash pre-built firmware for 3 patterns; capture FPS logs and visual comparison videos
- Target perf deltas: <2% FPS; memory overhead <5 KB per pattern

## Ownership

- QA owns harness; compiler team maintains test graphs and baselines


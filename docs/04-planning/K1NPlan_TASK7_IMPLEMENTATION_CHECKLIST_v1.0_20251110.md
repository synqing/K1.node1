# Task 7 Implementation Checklist: Bloom Graph PoC
## Step-by-Step Execution Checklist & Progress Tracking

**Version:** 1.0
**Date:** November 10, 2025
**Status:** Ready for Execution
**Total Milestones:** 6
**Estimated Effort:** 20 hours (3 working days)

---

## Milestone 1: Algorithm Analysis (2 hours)

**Goal:** Finalize understanding of current bloom pattern and document baseline.

### Tasks
- [ ] **1.1** Read `firmware/src/graph_codegen/pattern_bloom.cpp` line-by-line
  - [ ] Document function signature (inputs: frame_count, audio, params, state)
  - [ ] Document buffer initialization (tmp_f0, tmp_rgb0, tmp_rgb1)
  - [ ] Identify each processing stage with line numbers
  - [ ] Note: Understand AudioDataSnapshot structure reference
- [ ] **1.2** Create algorithm flowchart/outline
  - [ ] Input → BandShape → BufferPersist → ColorizeBuffer → Mirror → Output
  - [ ] Identify state interactions (persist_buf read/write)
  - [ ] Document constant values (decay = 0.920, NUM_LEDS = 256)
- [ ] **1.3** Categorize each constant: hardcoded vs. parameterizable
  - [ ] Hardcoded (keep): Mirror operation, output format, buffer size
  - [ ] Parameterizable (future): decay factor, gain, colorization mode
- [ ] **1.4** Document state structure requirements
  - [ ] Confirm `state.persist_buf[256]` exists and is float array
  - [ ] Check initialization/reset behavior
  - [ ] Verify memory budget (1KB within system limits)
- [ ] **1.5** Verify audio input requirements
  - [ ] AudioDataSnapshot structure fields needed
  - [ ] Which spectrum/envelope fields are used
  - [ ] Check pattern_audio_interface.h macros availability

**Deliverable:** Section 1 of main roadmap (complete)
**Acceptance:** Algorithm diagram + state diagram in documentation

---

## Milestone 2: Node Design (3 hours)

**Goal:** Define 7 nodes and their I/O contracts for the graph.

### Tasks
- [ ] **2.1** Identify all node types from catalog
  - [ ] AudioSpectrum (source): outputs `audio_spectrum` (float[64])
  - [ ] BandShape (filter): inputs audio_spectrum, outputs `led_buffer_float`
  - [ ] BufferPersist (stateful): inputs float buffer, outputs float buffer, state = `persist_buf[256]`
  - [ ] ColorizeBuffer (color map): inputs float buffer, outputs `led_buffer_vec3` (CRGBF)
  - [ ] Mirror (spatial): inputs CRGBF buffer, outputs CRGBF buffer (flipped)
  - [ ] LedOutput (terminal): inputs CRGBF buffer, writes to PatternOutput
  - [ ] (Optional: GradientMap future reference)

- [ ] **2.2** Define parameters for each node
  - [ ] BandShape: `gain` (float), `smoothing` (float), `center_bin` (int), `bandwidth` (int)
  - [ ] BufferPersist: `decay` (float, 0.0–1.0)
  - [ ] ColorizeBuffer: `mode` (string: "grayscale", etc.), `palette_id` (int)
  - [ ] Mirror: (no parameters)
  - [ ] AudioSpectrum: (no parameters)
  - [ ] LedOutput: (no parameters)

- [ ] **2.3** Create type compatibility matrix
  - [ ] Define all types used: int, float, vec3, color, audio_spectrum, led_buffer_float, led_buffer_vec3
  - [ ] List permitted coercions (int→float, float→vec3)
  - [ ] Verify all node connections are type-compatible

- [ ] **2.4** Design state allocation strategy
  - [ ] BufferPersist uses: `state.persist_buf[256]` (already available)
  - [ ] No additional state needed for this PoC
  - [ ] Confirm memory budget: <256 floats per node, <1KB total

- [ ] **2.5** Sketch node connectivity (graph topology)
  - [ ] Draw/document DAG: audio → band_shape → trail → colorize → mirror → output
  - [ ] Verify no cycles (use Kahn's algorithm mentally)
  - [ ] Verify all inputs are resolvable (no dangling sources)

**Deliverable:** Part 2 of main roadmap + type matrix table
**Acceptance:** Node definitions + connectivity diagram reviewed

---

## Milestone 3: JSON Graph Example (2 hours)

**Goal:** Author complete, valid JSON graph definition for bloom pattern.

### Tasks
- [ ] **3.1** Create `firmware/src/graph_codegen/bloom_poc.json` file
  - [ ] Copy template from Part 3 of main roadmap
  - [ ] Verify all 6 nodes are present
  - [ ] Verify node IDs match references in inputs
  - [ ] Include metadata (description, author, created date)

- [ ] **3.2** Validate JSON structure manually
  - [ ] Valid JSON syntax (use online validator or jq)
  - [ ] No trailing commas or missing brackets
  - [ ] All required fields present (id, type, inputs where needed)

- [ ] **3.3** Verify graph semantics
  - [ ] All `inputs[port] = sourceNodeId` references exist
  - [ ] No cycles (trace paths: audio→band→trail→colorize→mirror→output)
  - [ ] All node types are in catalog

- [ ] **3.4** Add comprehensive metadata
  - [ ] "name": "bloom_poc"
  - [ ] "version": "v1.0"
  - [ ] "meta": description, author, created, status
  - [ ] Per-node meta: human name, comment, authoring notes

- [ ] **3.5** Create simplified variant (optional)
  - [ ] bloom_symmetric.json (no mirror)
  - [ ] bloom_fast_decay.json (decay = 0.75)
  - [ ] Store in same directory as reference

**Deliverable:** `firmware/src/graph_codegen/bloom_poc.json` + variant files
**Acceptance:** Valid JSON, validates against schema, no broken references

---

## Milestone 4: Code Emitter Implementation (6 hours)

**Goal:** Implement code generator that converts JSON graph → C++ function.

### Tasks
- [ ] **4.1** Design emitter class/module architecture
  - [ ] Input: Parsed JSON graph (nlohmann/json or similar)
  - [ ] Output: C++ source code string or file
  - [ ] Key operations:
    - Parse JSON
    - Validate DAG (cycle check, input resolution)
    - Type inference (output type per node)
    - Topological sort (execution order)
    - Buffer allocation (size inference)
    - Code generation (per-node emit rules)

- [ ] **4.2** Implement JSON parser
  - [ ] Use standard JSON library (nlohmann/json recommended)
  - [ ] Load `bloom_poc.json`
  - [ ] Parse into structured data (nodes list, edges map)
  - [ ] Error handling (missing fields, invalid syntax)

- [ ] **4.3** Implement DAG validator
  - [ ] Cycle detection (Kahn's algorithm or DFS-based)
  - [ ] Input resolution (all inputs exist and have sources)
  - [ ] Type checking (input/output types match or coerce)
  - [ ] Report clear error messages on validation failure

- [ ] **4.4** Implement type inference engine
  - [ ] Map node type → output type (e.g., BandShape → led_buffer_float)
  - [ ] Propagate types through graph
  - [ ] Detect type mismatches (error cases)
  - [ ] Output type inference table (debug dump)

- [ ] **4.5** Implement topological sort
  - [ ] Order nodes for execution (respecting dependencies)
  - [ ] Output: list of node IDs in execution order
  - [ ] Verify order matches logical flow

- [ ] **4.6** Implement buffer allocation strategy
  - [ ] Analyze node outputs and required types
  - [ ] Allocate temporary buffers (e.g., `float buf_band_shape[256]`)
  - [ ] Skip buffers for source/terminal nodes
  - [ ] Calculate peak memory usage

- [ ] **4.7** Implement per-node code emitters
  - [ ] **AudioSpectrum:** `const float* spectrum = audio.spectrogram;`
  - [ ] **BandShape:** for-loop with ramp generation (PoC)
  - [ ] **BufferPersist:** decay formula + state read/write + memcpy
  - [ ] **ColorizeBuffer:** scalar-to-RGB conversion (grayscale mode)
  - [ ] **Mirror:** buffer flip loop
  - [ ] **LedOutput:** clamp + uint8 conversion + write to `out.leds[i][ch]`

- [ ] **4.8** Implement top-level emitter
  - [ ] Emit file header (comment, generator version, do-not-edit warning)
  - [ ] Emit includes (graph_runtime.h, stateful_nodes.h, etc.)
  - [ ] Emit function signature (standard pattern_*_render)
  - [ ] Emit buffer declarations (inferred from graph)
  - [ ] Emit node execution loop (topological order)
  - [ ] Emit closing brace

- [ ] **4.9** Test emitter on `bloom_poc.json`
  - [ ] Generate `pattern_bloom_generated.cpp`
  - [ ] Visually inspect output (readability, correctness)
  - [ ] Verify includes are present
  - [ ] Verify all 6 nodes are represented

**Deliverable:** Working emitter code + generated `pattern_bloom_generated.cpp`
**Acceptance:** Code compiles with 0 errors/warnings; output is readable

---

## Milestone 5: Test Harness (5 hours)

**Goal:** Implement unit and integration tests for validation.

### Tasks
- [ ] **5.1** Implement JSON validation tests
  - [ ] **Test:** bloom_poc.json validates against schema
    - [ ] Pass: valid JSON, all required fields
    - [ ] Fail: missing fields, invalid types, dangling references
  - [ ] **Tool:** JSON schema validator (use standard library)
  - [ ] File: `tests/test_bloom_json_validation.cpp`

- [ ] **5.2** Implement DAG topology tests
  - [ ] **Test:** Graph is acyclic
    - [ ] Pass: topological sort succeeds
    - [ ] Fail: cycle detection reports cycle path
  - [ ] **Test:** All node inputs are resolvable
    - [ ] Pass: every input source exists
    - [ ] Fail: dangling references detected
  - [ ] File: `tests/test_bloom_dag_validation.cpp`

- [ ] **5.3** Implement type inference tests
  - [ ] **Test:** All nodes type-check
    - [ ] Pass: input types match output types (or permitted coercions)
    - [ ] Fail: type mismatch detected
  - [ ] **Test:** Type table is generated correctly
    - [ ] Pass: output types inferred per node
  - [ ] File: `tests/test_bloom_type_inference.cpp`

- [ ] **5.4** Implement compilation test
  - [ ] **Test:** Generated code compiles cleanly
    - [ ] Pass: 0 errors, 0 warnings (PlatformIO)
    - [ ] Fail: compilation error reported
  - [ ] Include flags: `-Wall -Wextra -pedantic`
  - [ ] File: `tests/test_bloom_compilation.cpp` or Makefile rule

- [ ] **5.5** Implement pixel-perfect output test
  - [ ] **Setup:** Run baseline and generated code on identical audio input
  - [ ] **Test:** LED output matches exactly
    - [ ] Pass: all pixels identical over 100 frames
    - [ ] Fail: delta reported per frame/LED/channel
  - [ ] **Data:** Predefined test audio snapshots (deterministic)
  - [ ] **Frame Count:** 100 frames minimum
  - [ ] File: `tests/test_bloom_output_equivalence.cpp`

- [ ] **5.6** Implement performance regression test
  - [ ] **Measure:** Render time (baseline vs. generated)
    - [ ] Method: `esp_timer_get_time()` around render loop
    - [ ] Frames: 1000 iterations per test
    - [ ] Average and peak times recorded
  - [ ] **Pass Criterion:** Generated ≤ 1.05 × baseline
  - [ ] **Fail:** Report percentage delta
  - [ ] File: `tests/test_bloom_performance.cpp`

- [ ] **5.7** Implement state persistence test
  - [ ] **Test:** BufferPersist decay formula works correctly
    - [ ] Setup: Run 50 frames with known decay (0.92)
    - [ ] Check: `state.persist_buf[]` follows exponential curve
    - [ ] Formula: `expected = initial * decay^frames`
  - [ ] **Pass:** Actual values within 0.1% of expected
  - [ ] File: `tests/test_bloom_state_persistence.cpp`

- [ ] **5.8** Create test data and fixtures
  - [ ] Audio mock data: 100 predefined `AudioDataSnapshot` frames
  - [ ] Each frame: spectrum (64 bins), envelope, timestamp
  - [ ] Store in `tests/fixtures/bloom_audio_data.cpp`
  - [ ] Ensure determinism (same data = same output every run)

- [ ] **5.9** Create test runner framework
  - [ ] CMake or Makefile rules to build and run all tests
  - [ ] Summary report (pass/fail per test)
  - [ ] Coverage metrics (nodes covered, frames tested)
  - [ ] File: `tests/CMakeLists.txt` or `tests/Makefile`

**Deliverable:** Complete test harness + test data
**Acceptance:** All tests compile and can be run; baseline passing

---

## Milestone 6: Validation & Handoff (2 hours)

**Goal:** Run full test suite, verify success, document results, and prepare handoff.

### Tasks
- [ ] **6.1** Run all tests
  - [ ] Unit tests: JSON validation, DAG check, type inference
  - [ ] Integration tests: Compilation, output equivalence, performance
  - [ ] Capture results: pass/fail, deltas, error messages

- [ ] **6.2** Verify success criteria
  - [ ] Compilation: 0 errors, 0 warnings ✓
  - [ ] Pixel-perfect match: 100 frames tested ✓
  - [ ] DAG integrity: Acyclic, all inputs resolved ✓
  - [ ] Type system: All nodes type-check ✓
  - [ ] State persistence: Decay formula verified ✓
  - [ ] Performance: Within 5% of baseline ✓

- [ ] **6.3** Document blockers or issues
  - [ ] If any test fails, document root cause
  - [ ] Record workarounds or mitigations
  - [ ] Note technical debt for Phase 2

- [ ] **6.4** Create validation report
  - [ ] Status: PASS / CONDITIONAL / FAIL
  - [ ] Test results (pass count, fail count)
  - [ ] Performance delta (ms, %)
  - [ ] Memory usage (bytes, budget check)
  - [ ] Node coverage (X out of 6 nodes tested)

- [ ] **6.5** Package deliverables
  - [ ] Main roadmap: `K1NPlan_TASK7_BLOOM_GRAPH_POC_ROADMAP_v1.0_20251110.md`
  - [ ] JSON graph: `firmware/src/graph_codegen/bloom_poc.json`
  - [ ] Generated code: `firmware/src/graph_codegen/pattern_bloom_generated.cpp`
  - [ ] Emitter code: `firmware/src/codegen/graph_emitter.cpp` (or equivalent)
  - [ ] Test code: `tests/test_bloom_*.cpp`
  - [ ] Test data: `tests/fixtures/bloom_audio_data.cpp`

- [ ] **6.6** Write lessons learned document
  - [ ] **What Worked:**
    - [ ] JSON graph representation is clear and declarative
    - [ ] Type system covers bloom use cases
    - [ ] Emitter architecture is extensible
  - [ ] **What Was Hard:**
    - [ ] (Document any surprises or difficulties)
  - [ ] **For Phase 2:**
    - [ ] Generalize emitter to all 35+ node types
    - [ ] Add palette-based colorization support
    - [ ] Integrate with web-based graph editor

- [ ] **6.7** Prepare Phase 2 recommendations
  - [ ] Candidate 1: Spectrum pattern conversion (similar to bloom)
  - [ ] Candidate 2: Waveform pattern with wave propagation
  - [ ] Blockers or dependencies to address before Phase 2

- [ ] **6.8** Update index and documentation links
  - [ ] Add references to main roadmap from:
    - [ ] `docs/K1N_INDEX_v1.0_20251108.md` (if exists)
    - [ ] `docs/K1N_NAVIGATION_v1.0_20251108.md` (if exists)
    - [ ] `docs/04-planning/` index (if exists)
  - [ ] Cross-link to graph schema and node catalog

- [ ] **6.9** Final sign-off
  - [ ] Review all deliverables one last time
  - [ ] Verify documentation is complete and clear
  - [ ] Confirm effort estimate accuracy (20 hours ± 20%)
  - [ ] Mark task COMPLETE in tracking system

**Deliverable:** Validation report + packaged deliverables + lessons learned
**Acceptance:** ✓ All success criteria met, ✓ Documentation complete, ✓ Handoff-ready

---

## Quick Status Board

### Milestones Progress

```
Milestone 1: Algorithm Analysis
Status: [ ] NOT STARTED  [ ] IN PROGRESS  [ ] COMPLETE
Hours: 0h / 2h
Checklist: 0 / 5 tasks

Milestone 2: Node Design
Status: [ ] NOT STARTED  [ ] IN PROGRESS  [ ] COMPLETE
Hours: 0h / 3h
Checklist: 0 / 5 tasks

Milestone 3: JSON Graph
Status: [ ] NOT STARTED  [ ] IN PROGRESS  [ ] COMPLETE
Hours: 0h / 2h
Checklist: 0 / 5 tasks

Milestone 4: Code Emitter
Status: [ ] NOT STARTED  [ ] IN PROGRESS  [ ] COMPLETE
Hours: 0h / 6h
Checklist: 0 / 9 tasks

Milestone 5: Test Harness
Status: [ ] NOT STARTED  [ ] IN PROGRESS  [ ] COMPLETE
Hours: 0h / 5h
Checklist: 0 / 9 tasks

Milestone 6: Validation & Handoff
Status: [ ] NOT STARTED  [ ] IN PROGRESS  [ ] COMPLETE
Hours: 0h / 2h
Checklist: 0 / 9 tasks

========================================
TOTAL: 0h / 20h
```

---

## Daily Standup Template

**For use during PoC execution:**

```
Date: [YYYY-MM-DD]
Developer: [Name]
Milestone: [Current]

Completed Today:
- [ ] Task X.Y: [Description]
- [ ] Task X.Z: [Description]

Blockers:
- [None] / [Issue 1], [Issue 2]

Next Steps (Tomorrow):
- [ ] Task A.B: [Description]
- [ ] Task A.C: [Description]

Hours Logged: [N] / [Budget]
```

---

## Test Execution Summary (Post-Completion)

| Test | Status | Details | Notes |
|------|--------|---------|-------|
| **JSON Validation** | [ ] PASS | Schema compliance | none |
| **DAG Topology** | [ ] PASS | No cycles, inputs resolved | none |
| **Type Inference** | [ ] PASS | All nodes type-check | none |
| **Compilation** | [ ] PASS | 0 errors, 0 warnings | none |
| **Output Equivalence** | [ ] PASS | Pixel-perfect match (100 frames) | none |
| **Performance** | [ ] PASS | ≤5% overhead vs. baseline | none |
| **State Persistence** | [ ] PASS | Decay formula verified | none |

**Overall Result:** [ ] ALL PASS  [ ] CONDITIONAL  [ ] FAILED

---

## Dependencies & Prerequisites

### Software Requirements
- [ ] C++17 compiler (Arduino / PlatformIO)
- [ ] JSON library (nlohmann/json or similar)
- [ ] Git (for version control)
- [ ] Text editor or IDE (VS Code, CLion, etc.)

### Knowledge Requirements
- [ ] Familiarity with bloom pattern algorithm
- [ ] Understanding of DAG and topological sort
- [ ] Basic C++ template/functional programming
- [ ] JSON schema concepts

### File Access
- [ ] Read: `firmware/src/graph_codegen/pattern_bloom.cpp`
- [ ] Read: `firmware/src/graph_codegen/graph_runtime.h`
- [ ] Read: `firmware/src/stateful_nodes.h`
- [ ] Read: `docs/06-reference/GRAPH_SCHEMA_SPEC.md`
- [ ] Read: `docs/06-reference/K1NRef_GRAPH_NODE_CATALOG_EXPANDED_v2.0_20251110.md`
- [ ] Write: `firmware/src/graph_codegen/bloom_poc.json` (new)
- [ ] Write: `firmware/src/graph_codegen/pattern_bloom_generated.cpp` (new)
- [ ] Write: `firmware/src/codegen/graph_emitter.cpp` (new)
- [ ] Write: `tests/test_bloom_*.cpp` (new)

---

## Effort Tracking

| Phase | Estimated | Actual | Notes |
|-------|-----------|--------|-------|
| Milestone 1 | 2h | __h | Algorithm analysis |
| Milestone 2 | 3h | __h | Node design |
| Milestone 3 | 2h | __h | JSON authoring |
| Milestone 4 | 6h | __h | Code emitter (most complex) |
| Milestone 5 | 5h | __h | Test harness |
| Milestone 6 | 2h | __h | Validation & handoff |
| **TOTAL** | **20h** | **__h** | PoC scope |

---

## Sign-Off Template (Final)

**When complete, fill out:**

```
Task 7 PoC Status
=================

Overall Status: [ ] PASS  [ ] CONDITIONAL  [ ] FAIL

Effort Accuracy:
- Estimated: 20h
- Actual: __h
- Variance: __h (__ %)

Blockers Encountered:
[ ] None
[ ] Yes: ______________________________________________

Performance Metrics:
- Baseline time: __ ms / 1000 frames
- Generated time: __ ms / 1000 frames
- Delta: __% (PASS if ≤5%)

Test Coverage:
- Nodes covered: 6 / 6 (100%)
- Frames tested: 100 / 100 (100%)
- Unit tests: __ / __ passed
- Integration tests: __ / __ passed

Key Achievements:
1. Generated code matches hand-coded pattern pixel-for-pixel
2. JSON graph is valid and versionable
3. Emitter successfully generates compilable C++
4. Test harness validates correctness

Next Steps (Phase 2):
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

Lessons Learned:
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

Signed: _________________  Date: _________
```

---

**End of Checklist**

For full details: see `K1NPlan_TASK7_BLOOM_GRAPH_POC_ROADMAP_v1.0_20251110.md`

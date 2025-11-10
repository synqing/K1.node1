---
title: "K1.node1 Corrected Task Roadmap: Evidence-Based Execution Plan"
type: "Plan"
project: "K1.node1"
project_code: "K1N"
version: "v1.0"
date: "2025-11-10"
status: "authoritative"
intent: "Replace outdated task claims with a verified, sequenced execution plan"
doc_id: "K1NPlan_TASK_ROADMAP_CORRECTED_v1.0_20251110"
tags: ["planning","roadmap","tasks","phase0","phase1"]
---
# K1.node1 Corrected Task Roadmap: Evidence-Based Execution Plan

**Document Status:** AUTHORITATIVE - Replace outdated task claims with this evidence-based plan
**Updated:** November 10, 2025
**Valid Until:** First major delivery milestone (Task 5 completion)

---

## PHASE 0: CRITICAL FIX WEEK (November 10-16, 2025)

### Must Complete Before Proceeding to Phase 1

#### Task 1: Complete WiFi Credential Removal
**Current State:** PARTIAL (60%)
- Hardcoded #defines removed ✓
- Comments with credentials still visible ✗

**Deliverables:**
- [ ] Remove all credential references from main.cpp
- [ ] Add .env.example with placeholder values
- [ ] Document environment variable setup
- [ ] Verify build with no credentials in binary
- [ ] Add pre-commit hook to prevent credential re-introduction

**Effort:** 1-2 hours
**Blockers:** None
**Testing:** Static analysis + grep verification
**Owner:** Firmware Team
**Start:** November 10 (TODAY)
**Complete by:** November 10 (EOD)

---

#### Task 4: Create Comprehensive Error Code Registry
**Current State:** NOT STARTED (15%)
- No central enum file
- No documentation
- No mapping to recovery actions

**Deliverables:**
- [ ] Create `/firmware/src/error_codes.h` with enum of all error codes
- [ ] Define minimum 50 codes (start with most critical)
- [ ] Document each code: cause, recovery action, severity
- [ ] Create mapping table for telemetry system
- [ ] Update webserver response builders to use enum
- [ ] Add error code to all error responses

**Effort:** 4-6 hours
**Blockers:** None (can work in parallel with Task 2)
**Testing:** Grep verification + build check
**Owner:** System Architect
**Start:** November 10
**Complete by:** November 11

---

#### Task 2: Fix I2S Audio Timeout Protection
**Current State:** PARTIAL (35%)
- I2S initialization present
- No timeout guards
- No recovery mechanism

**Deliverables:**
- [ ] Implement bounded waits (100ms max) in `acquire_sample_chunk()`
- [ ] Add watchdog feed on successful capture
- [ ] Implement silence output fallback when timeout occurs
- [ ] Track consecutive failures, reset after 3+ failures
- [ ] Add structured error logging with error codes
- [ ] Create timeout simulation test
- [ ] Document timeout behavior in API reference

**Effort:** 6-8 hours
**Blockers:** Task 4 error codes (but can work in parallel)
**Testing:** Stress test with hung I2S, verify timeout + fallback
**Owner:** Audio Engineer
**Start:** November 10
**Complete by:** November 12

---

#### Task 3: Implement WebServer Buffer Bounds Checking
**Current State:** PARTIAL (20%)
- Framework exists but no actual bounds checks
- JSON library provides partial protection
- No input validation

**Deliverables:**
- [ ] Define maximum buffer sizes for all request types
- [ ] Create safe string wrapper functions
- [ ] Add bounds checking to all HTTP handlers
- [ ] Validate request body length, header count, query parameter count
- [ ] Add overflow protection to JSON parsing
- [ ] Test with 100+ malformed inputs
- [ ] Document buffer limits in API reference

**Effort:** 12-16 hours (split across 3 days)
**Blockers:** None
**Testing:** Fuzzing + edge case testing
**Owner:** WebServer Engineer
**Start:** November 10
**Complete by:** November 13

---

## Summary: Phase 0 Effort
- **Total Hours:** 23-32 hours
- **Team Size:** 3 engineers
- **Parallelization:** All can run in parallel
- **Critical Gate:** ALL MUST PASS before Phase 1
- **Completion Target:** November 13, 2025 (EOD)

---

## PHASE 1: FOUNDATION & COMPILER (November 13-27, 2025)

### Cannot Start Until Phase 0 Complete

#### Task 5: Implement Code Generator Architecture (Full Schema + Compiler)
**Current State:** PARTIAL (40%)
- ADRs exist (0002/0006, 0014, 0011 node infra)
- Stateful node helpers implemented
- Management/runtime glue present
- Actual compiler + graph schema **missing**

**Strategic Importance:** CRITICAL
- Blocks Tasks 6, 7, 8, 15, 16, 18 (graph design, migration, test harness)
- Enables non-programmer pattern workflow pledged in ADR‑0002
- Required for Phase 2 PoC (Bloom/Spectrum) and Sensory Bridge parity

**Scope Clarification (based on Emotiscope/SensoryBridge analysis):**
The compiler **must** handle the real feature set from reference packs:
- **Inputs:** FFT spectrum (64/NUM_FREQS), autocorrelation/pitch, chromagram, VU/envelope, beat pulses, per-LED progress, mirror flags, presets/config knobs.
- **Node catalog:** scalar/vector math, filters/smoothing, band aggregators, gradients/HSV, noise/perlin, mirror/shift/downsample, dot renderers, trail/persistence, stateful buffers (<1 KB).
- **Outputs/layers:** ability to compose multiple buffers (base gradient + dots), mirror modes, conditional branches.
- **Parameters:** saturations, mood, brightness, presets; bool/int/float types with bounds.

**Deliverables (Expanded):**
1. **Graph Schema & Type System**
   - `codegen/schemas/graph.schema.json` (JSON Schema v1) covering name/version/nodes/meta.
   - Document type system: {int,bool,float,vec2,vec3,color,time,duration,rng_seed,audio_spectrum,audio_envelope,beat_event,param<T>,led_buffer<float>,led_buffer<vec3>}.
   - Explicit coercion table; forbid implicit buffer conversions.
2. **Compiler Architecture (5 stages)**
   - Stage contracts (Parse→Validate→Optimize→Schedule→Emit) with inputs/outputs defined.
   - Stage artifacts for debugging (`dump-ast.json`, `dump-typed.json`, etc.).
3. **Implementation**
   - Parser: JSON → AST + constant pool + symbol table.
   - Validator: type checking, port arity, coercions, cycle detection (report path), param bounds (clamp+warn), stateful memory budget (<1 KB), dangling node detection, root validation, error codes (E1001‑E1010).
   - Optimizer: constant folding, DCE, literal inlining, (optional) pure CSE; must skip RNG/stateful nodes.
   - Scheduler: topo order, buffer lifetime analysis, linear-scan allocator with scratch cap (default 16 KB, flag `--scratch-cap`), mark stateful buffers persistent, annotate in-place eligibility.
   - Emitter: generate `draw_<pattern>()` functions + registration; guarantee single `get_audio_snapshot`, no heap, clamp RGB to [0,1], include necessary headers, wrap symbols in anonymous namespace, ensure NUM_LEDS guard.
4. **CLI + Tooling**
   - `k1c` CLI (`node ./codegen/cli.ts build graph.json --out firmware/src/graph_codegen/<pattern>.cpp`).
   - Integrate into CI to regenerate patterns and fail on dirty tree.
5. **Testing & Validation**
   - Unit tests per stage (Parser/Validator/Optimizer/Scheduler/Emitter) with fixtures (invalid graphs, cycle detection, memory overrun, etc.).
   - E2E golden tests: CPU sim of generated C++ vs. baseline CRC.
   - Hardware PoC: Bloom + Spectrum graphs compile/run; FPS delta <2% vs. hand-written; memory overhead <5 KB/pattern.
   - Error reporting verified (nodeId/type/port/location) for representative failures.

**Implementation Timeline (7–10 days):**
- **Day 1‑2:** Schema + Parser + Validator (fixtures for Emotiscope/SensoryBridge style graphs).
- **Day 3:** IR + Optimizer (const fold, DCE, literal inline tests).
- **Day 4:** Scheduler + allocator (topo order, lifetime golden maps, scratch cap enforcement).
- **Day 5:** C++ emitter skeleton + registration + initial golden tests.
- **Day 6:** Bloom PoC on hardware (perf baseline, correctness validation).
- **Day 7:** Spectrum PoC (second pattern, perf delta check).
- **Day 8‑10:** Buffer/polish—error messaging, expanded node catalog, documentation.

**Testing:**
- Parser/Validator test suites (invalid JSON, port mismatches, cycle detection, param bounds, memory budget errors).
- Optimizer tests (DCE removal, const fold, skip RNG).
- Scheduler tests (deterministic order, buffer allocation reuse, scratch cap failure case).
- E2E golden tests (CPU sim). Hardware validation for Bloom/Spectrum.

**Acceptance Criteria:**
- Bloom + Spectrum graphs compile & run on hardware with <2% FPS delta.
- Graph validation errors cite nodeId/type/port/location; cycle errors show path.
- Generated code has no heap allocs, single audio snapshot call, clamps colors.
- Scratch buffer usage reported; fail if > cap.
- CLI `k1c build …` integrated and used in CI.
- Error codes assigned for compiler failures (E1001–E1010 range).

**Effort:** 24–32 hours (5–6 engineer-days, can span a week with buffer).
**Blockers:** None (independent but coordinate with firmware for integration tests).
**Owner:** Senior Engineer (HIGHEST PRIORITY).
**Start:** November 13 | **Complete by:** November 20.

**Risk Assessment:** HIGH
- Most complex task; incorrect compiler blocks entire graph roadmap.
- Requires close coordination with firmware for runtime integration + perf validation.
- Mitigation: daily check-ins/code reviews, staged deliverables (schema → parser → validator, etc.), early hardware PoC (Day 6).

---

#### Task 6: Complete Graph System Architecture Design (Node Catalog & Docs)
**Current State:** PARTIAL (25%)
- 8 core node types drafted (stateful buffers, basic math)
- Preliminary runtime glue exists
- Needs full catalog (35–40 nodes) aligned with Emotiscope/SensoryBridge features
- Depends on Task 5 schema/contracts (now defined)

**Deliverables (Expanded):**
1. **Node Catalog (target ≥35 types)**
   - Cover categories identified from reference packs:
     - Inputs: Time, AudioSpectrum, AudioEnvelope, BeatEvent, AutoCorrelation, Chromagram, Params, Config toggles.
     - Math/Filters: Add, Mul, Mix, Clamp, Contrast, Pow, Sqrt, LowPass, MovingAverage.
     - Gradient/Color: HSV, GradientMap, Desaturate, ForceSaturation, Palette selectors.
     - Geometry/Buffer ops: Mirror, Shift, Downsample/Upsample, Trail/BufferPersist, DotRender, ComposeLayers.
     - Noise/Procedural: PerlinNoise, RNG seeds, position accumulators.
     - Stateful nodes (<1 KB) for brightness accumulators, smoothing buffers, noise phase.
   - Each node spec includes: input ports (type + default), outputs, params (type, bounds), stateful memory footprint, side-effect flag, description/examples (tie back to Emotiscope/SensoryBridge behaviors).
2. **Connection/Wiring Rules**
   - Document allowable type conversions, port arity rules, conditional branches (mirror toggles), layering semantics (base + overlay buffers), and dot/draw semantics.
3. **Reference Docs & Examples**
   - Graph diagrams for Bloom & Spectrum (matching Task 5 PoCs) showing node wiring.
   - Example JSON snippets for common subgraphs (FFT gradient, dot trails, mirror block).
4. **Pattern Migration Plan**
   - Mapping guidance from legacy patterns to node graphs: which nodes to use for FFT, pitch, noise, dots, etc.
5. **Update ADRs/Docs**
   - Extend ADR-0007 (stateful nodes) with final catalog.
   - Produce reference doc under `docs/06-reference/` summarizing node types.

**Effort:** 16-20 hours (parallel with Task 5, but depends on Task 5 schema).
**Blockers:** Task 5 (schema/contracts) – now in progress; coordinate daily.
**Testing:** Doc review + cross-check against reference implementations; ensure Bloom/Spectrum mapping exists on paper.
**Owner:** Architect + Mid Engineer.
**Start:** November 13 | **Complete by:** November 18.

**Risk:** Medium—scope creep if catalog grows beyond initial 40 nodes; mitigate by prioritizing nodes required for Emotiscope/SensoryBridge parity first.

---

## Summary: Phase 1 Effort
- **Total Hours:** 40-52 hours (parallel execution)
- **Critical Blockers:** Task 5 must be high-quality to unblock downstream work
- **Completion Target:** November 20, 2025
- **Next Gate:** Code review of Task 5 compiler (security + correctness check)

---

## PHASE 2: GRAPH SYSTEM PoC & VALIDATION (November 20-December 4, 2025)

### Cannot Start Until Phase 1 Complete

#### Task 7: Bloom Pattern Graph Conversion PoC
**Current State:** PARTIAL (30%)
- Earlier PoC incomplete; no reproducible results
- Now must leverage Task 5 schema + node catalog

**Deliverables (Aligned with reference analysis):**
- Convert the existing Bloom lightshow (per Emotiscope/SensoryBridge behavior) into JSON graph(s) using the full node catalog.
- Produce Bloom graph JSON with:
  - FFT spectrum inputs, smoothing/trail nodes, stateful buffer persist, mirror toggles, parameter nodes (saturation/mirror).
  - Layering support (base gradient + bloom injections) as required by patterns.
- Run through `k1c` compiler; integrate generated C++ under `firmware/src/graph_codegen/` and register.
- Validate via:
  - CPU simulation CRC vs. hand-written Bloom implementation for 1,600 LED samples.
  - Hardware comparison (same audio feed) with <2% FPS delta and visually identical output.
- Document conversion (graph diagram, JSON snippet, mapping from legacy code to nodes) and add to test suite.

**Effort:** 8-12 hours.
**Blockers:** Task 5 must be functional (compiler, node catalog, schema).
**Testing:** E2E validation suite + hardware side-by-side video/gif; include sample audio vectors.
**Owner:** Mid Engineer (Graph team) + Firmware reviewer.
**Start:** Nov 20 (after Task 5 handoff) | **Complete by:** Nov 23.

---

#### Task 8: Spectrum Pattern Graph Conversion PoC
**Current State:** PARTIAL (20%)
- Early efforts incomplete; tests not reproducible
- Must now leverage Task 5 compiler + Task 6 node catalog

**Deliverables:**
- Convert Spectrum lightshow (FFT band visualization) into JSON graph(s) capturing:
  - FFT spectrum inputs, multi-band shaping, param-driven saturation/mood, mirror/shift operations, dot overlays.
  - Safety nodes for brightness clamps, smoothing filters, trail buffers.
- Run through `k1c`, generate C++, integrate/register with firmware.
- Validation plan:
  - At least 7 audio test vectors (low/mid/high energy, chromatic mode on/off, mirror on/off) producing identical pixels vs. legacy implementation.
  - Hardware comparison video documenting FPS/memory metrics (<2% FPS delta, <5 KB extra memory).
- Document node mapping and graph structure; add to documentation + tests.

**Effort:** 8-12 hours.
**Blockers:** Task 5 (compiler) + Task 6 (node catalog) completion.
**Testing:** CPU sim CRC + hardware fixtures; include regression suite with audio vectors.
**Owner:** Mid Engineer (Graph team).
**Start:** Nov 20 (parallel with Task 7) | **Complete by:** Nov 24.

---

#### Task 9: Complete Stateful Node System Integration
**Current State:** MOSTLY COMPLETE (95%)
- All 8 node types implemented
- Management infrastructure present
- Integration with patterns NOT yet done

**Deliverables:**
- [ ] Integrate nodes with pattern_registry system
- [ ] Create usage examples for each node type
- [ ] Add integration tests (node lifecycle + state)
- [ ] Wire telemetry/diagnostics for node state
- [ ] Document best practices
- [ ] Update pattern documentation

**Effort:** 4-6 hours
**Blockers:** None (Task 9 core is already done)
**Testing:** Integration tests
**Owner:** Any engineer
**Start:** November 20
**Complete by:** November 21

---

#### Task 10: Graph System Performance Profiling
**Current State:** NOT STARTED (0%)
- No profiling infrastructure
- No measurement results
- Claims unsubstantiated

**Deliverables:**
- [ ] Implement performance instrumentation
- [ ] Measure memory usage of all 8 node types
- [ ] Measure FPS impact under various loads
- [ ] Measure code generator performance
- [ ] Profile pattern compilation speed
- [ ] Compare against targets (<2% FPS impact, <5KB memory)
- [ ] Publish detailed benchmark report

**Effort:** 6-8 hours
**Blockers:** Task 5, 9 (code must be complete)
**Testing:** Benchmark suite
**Owner:** Any engineer
**Start:** November 23
**Complete by:** November 25

---

## Summary: Phase 2 Effort
- **Total Hours:** 26-38 hours (parallel execution of 7-10)
- **Critical Dependency:** Task 5 code generator
- **Completion Target:** November 25, 2025
- **Validation Gate:** All PoCs must produce valid C++ code

---

## PHASE 3: TESTING & VALIDATION (November 25 - December 9, 2025)

### Cannot Start Until Phases 1-2 Complete

#### Task 11: Hardware Validation Testing
**Current State:** NOT STARTED (0%)
- No test harness
- No test cases
- Claim of "25/25 pass" unverifiable

**Deliverables:**
- [ ] Design hardware validation test plan (25+ test cases)
- [ ] Create test harness for automated testing
- [ ] Test GPIO, I2S, RMT, LED output
- [ ] Test WiFi connectivity and provisioning
- [ ] Test USB serial communication
- [ ] Execute against real hardware
- [ ] Document all results (pass/fail, timing, output)
- [ ] Fix any failures
- [ ] Publish validation report

**Effort:** 12-16 hours
**Blockers:** Hardware must be available
**Testing:** Real-world hardware testing
**Owner:** Hardware Engineer
**Start:** November 25
**Complete by:** November 29

**Gate Requirement:** 25/25 tests MUST pass (no exceptions)

---

#### Task 12: Stress Testing & Stability Validation
**Current State:** NOT STARTED (0%)
- No stress test harness
- No memory profiling
- Claim of "zero memory leaks" unverifiable

**Deliverables:**
- [ ] Design 8+ stress scenarios
  - [ ] Rapid pattern changes (every 100ms)
  - [ ] High audio input with processing
  - [ ] Continuous LED updates (60 FPS)
  - [ ] WiFi reconnection cycles
  - [ ] Parameter changes under load
  - [ ] Memory exhaustion scenarios
  - [ ] Long-duration stability (24h run)
  - [ ] Concurrent operations
- [ ] Implement stress test harness
- [ ] Run with memory leak detection (ASAN, Valgrind)
- [ ] Execute for extended duration (hours/days)
- [ ] Document all results and failures
- [ ] Fix stability issues

**Effort:** 16-20 hours
**Blockers:** None (can run in parallel with Task 11)
**Testing:** Memory leak detection tools + stability monitoring
**Owner:** QA Engineer + Senior Engineer
**Start:** November 25
**Complete by:** December 2

**Gate Requirement:** 8/8 scenarios pass, zero memory leaks

---

#### Task 13: Code Quality & Security Review
**Current State:** NOT STARTED (0%)
- No SAST tools run
- No coverage measurement
- Claims of "94/100" unsubstantiated

**Deliverables:**
- [ ] Run SAST tool (clang-analyzer, cppcheck)
- [ ] Generate code coverage report (GCOV/LCOV)
- [ ] Run security analysis (Clang SafeStack, etc.)
- [ ] Review and fix all critical/high issues
- [ ] Achieve >90% code coverage
- [ ] Document metrics and findings
- [ ] Establish quality baseline
- [ ] Create continuous integration gates

**Effort:** 8-12 hours
**Blockers:** All code must be complete (Tasks 1-10)
**Testing:** Automated QA tools
**Owner:** QA Lead
**Start:** December 2
**Complete by:** December 4

**Gate Requirement:** >90% on all metrics (security, quality, coverage)

---

#### Task 14: Decision Gate Validation - GO/NO-GO for Production
**Current State:** INVALID (0%)
- Prerequisites incomplete
- No formal approval process
- Cannot approve without Tasks 11-13 results

**Deliverables:**
- [ ] Define 6 decision gate criteria
- [ ] Gather results from Tasks 11, 12, 13
- [ ] Evaluate against criteria
- [ ] Prepare decision document with rationale
- [ ] Obtain formal approval from stakeholders
- [ ] Create decision record and sign-off
- [ ] Plan next phase based on decision

**Effort:** 4-6 hours
**Blockers:** Tasks 11, 12, 13 MUST COMPLETE first
**Testing:** Stakeholder review + approval process
**Owner:** Project Lead
**Start:** December 4
**Complete by:** December 5

**Gate Requirement:** All stakeholders vote GO/NO-GO
- **GO Criteria:** All 3 validation tasks pass with >95% success rate
- **NO-GO Criteria:** Any validation task fails or scores <90%

---

## Summary: Phase 3 Effort
- **Total Hours:** 40-54 hours (parallel 11-12, then 13, then 14)
- **Critical Gate:** Decision gate determines if project continues
- **Completion Target:** December 5, 2025
- **Decision Outcome:** GO or NO-GO for Phase 4

---

## PHASE 4: PRODUCTION BUILD (December 5-31, 2025)

### ONLY Proceeds if Phase 3 Decision is "GO"

#### Task 15: Code Generation for All Node Types / Patterns
**Current State:** BLOCKED (0%)
- Depends on Task 5 (compiler) + Task 6 node catalog completion

**Deliverables (Aligned with updated schema):**
- Extend emitter/runtime glue to cover the full node catalog (≥35 types) derived from Emotiscope/SensoryBridge analysis, including:
  - Audio inputs (FFT, chromagram, envelope), smoothing filters, procedural noise, mirror/shift nodes, dot rendering, buffering/layering nodes.
  - Stateful node codegen hooks (<1 KB) for trails/auto-scale/brightness accumulators.
- Add emit-time unit tests for each node type (target ≥27 tests) ensuring generated C++ matches expected patterns and uses firmware helpers correctly.
- Generate code for all priority patterns (Bloom, Spectrum, plus additional 9 “high-value” modes) and integrate with firmware registry.
- Benchmark code generation time and runtime performance for each node type; ensure no heap usage, single audio snapshot, clamp enforcement.
- Document codegen patterns (node→C++ mapping) and update developer guide.

**Effort:** 16-20 hours.
**Blockers:** Task 5 & Task 6 completion; GO decision from Phase 3.
**Testing:** Comprehensive compiler test suite + hardware smoke tests for each new pattern.
**Owner:** Compiler Engineer.
**Start:** Dec 5 (post GO) | **Complete by:** Dec 12.

---

#### Task 16: Migrate High-Value Patterns to Graph System
**Current State:** BLOCKED (0%)
- Depends on Task 5 (compiler), Task 6 (node catalog), Task 7/8 (Bloom/Spectrum PoCs), Task 15 (codegen support)

**Deliverables (Aligned with revised scope):**
- Select 11 high-value lightshow modes (from SensoryBridge/Emotiscope parity list) for migration.
- For each pattern:
  - Design JSON graph using full node catalog (inputs, noise, dot overlays, mirror/shift, config params).
  - Compile via `k1c`, integrate generated C++, register in firmware.
  - Validate via CPU sim + hardware testing (FPS delta <2%, pixel CRC match or acceptable tolerance) with representative audio vectors.
  - Update docs: include graph diagrams, mapping notes, performance metrics.
- Track migration coverage (target ≥58% of pattern library) and flag remaining patterns for Phase 5.

**Effort:** 20-24 hours (may split across two engineers).
**Blockers:** Tasks 5, 6, 7, 8, 15.
**Testing:** Pattern comparison harness + hardware verification per pattern.
**Owner:** Pattern Migration Engineer (coord with Firmware).
**Start:** Dec 8 (post GO, once Task 15 done) | **Complete by:** Dec 16.

---

#### Task 17: Complete Graph Editor UI
**Current State:** ~80% (UI components exist; lacks Task 5 integration)

**Deliverables (Updated):**
- Finalize node palette + parameter editing UI per Task 6 catalog, including support for: audio inputs, stateful nodes, mirror nodes, dot renderers.
- Integrate frontend with `k1c` backend (REST/CLI) so users can author graphs → compile → download C++.
- Implement inline validation/error reporting using the validator outputs (nodeId/type/port/location) from Task 5.
- Add graph overlays for layering/mirror toggles and show stateful node metadata (memory footprint, side-effect icons).
- Provide end-to-end flow tests: create Bloom/Spectrum graphs via UI, compile, run in firmware.
- Documentation: keyboard shortcuts, how-to guides, troubleshooting.
  - See `docs/06-reference/GRAPH_EDITOR_INTEGRATION_GUIDE.md` for integration details.

**Effort:** 10-14 hours.
**Blockers:** Task 5 (compiler API), Task 6 (node catalog definitions).
**Testing:** UI unit tests + E2E author→compile→device workflow.
**Owner:** Frontend Engineer.
**Start:** Dec 8 | **Complete by:** Dec 12.

---

#### Task 18: Graph System Integration Testing
**Current State:** NOT STARTED (0%)
- Requires Task 5 (compiler), Task 15 (full codegen), Task 16 (pattern migrations)

**Deliverables (Expanded):**
- Integration test plan covering full workflow: Graph authoring (UI/JSON) → `k1c` compile → firmware integration → runtime validation (CPU sim + hardware).
- Test matrix including:
  - Bloom, Spectrum, and additional migrated patterns (from Task 16).
  - Parameter permutations (mirror on/off, chromatic vs. non, presets) based on reference patterns.
  - Error paths (invalid graph, schema errors, compiler errors) verifying UI + CLI messaging.
  - Performance metrics (FPS, memory usage, scratch buffer) logged per pattern.
- Automated test harness (CI job) that builds graphs, runs `k1c`, builds firmware, and executes CPU sim to verify CRCs.
  - See `docs/09-implementation/GRAPH_INTEGRATION_TEST_HARNESS_PLAN.md` for the CI/test plan.
- Hardware smoke tests for at least 3 patterns (capture logs/FPS comparisons).
- Bug triage/fix handoff to relevant task owners.

**Effort:** 16-20 hours.
**Blockers:** Tasks 5, 15, 16 completion.
**Testing:** Integration suite (CLI + firmware), hardware spot checks.
**Owner:** QA Engineer.
**Start:** Dec 12 | **Complete by:** Dec 18.

---

#### Task 19: SDK Documentation & Templates
**Current State:** PARTIAL (40%)
- Core docs exist, but graph SDK/API references incomplete

**Deliverables (Aligned with new scope):**
- Full SDK guide covering:
  - Graph schema/type system (from Task 5) with JSON examples.
  - Node catalog documentation (≥35 nodes) with descriptions, params, usage examples, memory footprints.
  - How-to guides for Bloom/Spectrum migration (tie back to Task 7/8).
  - CLI usage (`k1c` build/deploy), error codes (E1001+), best practices for layering/mirror.
  - Troubleshooting (validator errors, scratch cap hits, stateful node limits).
- Templates:
  - Graph JSON template starter.
  - Pattern migration checklist.
  - Sample README for third-party pattern packages.
- Publish docs in repo (`docs/06-reference/`) and wiki; ensure cross-links to ADRs and tasks.

**Effort:** 10-14 hours.
**Blockers:** Tasks 5, 6, 7, 8 (finalized schema/catalog/examples).
**Testing:** Documentation review + dev walkthrough.
**Owner:** Technical Writer (pairs with compiler/pattern engineers for accuracy).
**Start:** Dec 8 | **Complete by:** Dec 20.

---

#### Task 20: Implement Parameter Editor
**Current State:** NOT STARTED (0%)
- Depends on Task 17 (graph editor UI) and Task 6 (node param definitions)

**Deliverables:**
- Parameter inspector component supporting:
  - Scalar, vector, color, bool, enum, and parameter metadata defined in Task 6.
  - Bounds enforcement, default values, tooltips referencing SDK docs.
  - Serialization/deserialization to graph JSON (keeps schema compliance).
- Inline validation (invalid values highlight and block compile, show validator error codes).
- Unit tests (≥15 cases) covering each param type and edge cases.
- Integration with graph editor (real-time updates, undo/redo support).
- End-to-end test: author graph, tweak params, compile, verify effect in firmware.

**Effort:** 12-16 hours.
**Blockers:** Task 17 (UI baseline), Task 6 (param metadata).
**Testing:** Comprehensive UI tests + E2E pipeline test.
**Owner:** Frontend Engineer.
**Start:** Dec 12 | **Complete by:** Dec 20.

---

## Summary: Phase 4 Effort
- **Total Hours:** 72-96 hours (parallel execution)
- **Conditional:** ONLY if Phase 3 "GO" vote passes
- **Completion Target:** December 30, 2025

---

## PHASE 5: FINAL DELIVERY (December 30-31, 2025)

#### Task 21: Optional Enhancement Review
**Current State:** DEFERRED (Correct decision)

**Deliverables:**
- [ ] Evaluate 5 enhancement options
- [ ] Prioritize based on user feedback
- [ ] Plan for v1.1 release
- [ ] Document decision rationale

**Effort:** 4-6 hours (if done)
**Blockers:** None (only if time permits)
**Owner:** Product Owner
**Start:** December 30 (IF TIME PERMITS)
**Complete by:** December 31

---

## OVERALL TIMELINE SUMMARY

```
PHASE 0: RED ZONE FIXES          [Nov 10-13]   3 days   23-32 hrs   (must complete)
    ↓
PHASE 1: FOUNDATION & COMPILER   [Nov 13-20]   7 days   40-52 hrs   (parallel)
    ↓ (CODE REVIEW GATE)
PHASE 2: GRAPH SYSTEM PoC        [Nov 20-25]   5 days   26-38 hrs   (parallel)
    ↓ (TECHNICAL VALIDATION)
PHASE 3: TESTING & VALIDATION    [Nov 25-05]  10 days   40-54 hrs   (11-12 parallel)
    ↓ (DECISION GATE: GO/NO-GO)
PHASE 4: PRODUCTION BUILD        [Dec 05-30]  25 days   72-96 hrs   (parallel)
    ↓
PHASE 5: FINAL DELIVERY          [Dec 30-31]   2 days    4-6 hrs    (optional)

TOTAL DURATION: 7 weeks (49-50 days)
TOTAL EFFORT: 205-280 hours (with parallelization)
SEQUENTIAL EQUIVALENT: 41-52 weeks (if done one-by-one)
```

---

## CRITICAL SUCCESS FACTORS

### Non-Negotiable Requirements
1. **Phase 0 MUST complete** before proceeding (security fixes)
2. **Phase 3 validation MUST pass** before production build
3. **Decision gate MUST be formal** (stakeholder vote, documented)
4. **All testing MUST be real** (no simulated results)
5. **All claims MUST be verifiable** (with evidence trail)

### Quality Gates
- Code review required for all Phase 1-2 work
- Security review required for all Phase 0 work
- Testing review required for all Phase 3 work
- Stakeholder approval required for Phase 3-4 transition

### Team Accountability
- Each task has assigned owner (non-negotiable)
- Each task has specific completion date
- Each task has measurable deliverables
- Daily standups with blocker identification

---

## CONTINGENCY PLANS

### If Phase 0 Discovers Additional Issues
- Add 1-2 days buffer
- Do not skip any fixes
- Never proceed to Phase 1 with pending issues

### If Phase 1 Compiler Work Overruns
- This is highest-risk task
- Consider bringing in additional senior engineer
- Allocate 40+ hours (vs. estimated 24-32)
- Do not cut corners on testing

### If Phase 3 Validation Fails
- Return to Phase 2 for root cause analysis
- Fix issues and re-test
- Extend timeline by 1-2 weeks
- Do not proceed to Phase 4 without passing

### If Phase 4 Blockers Emerge
- May defer Task 20-21 to v1.1
- Keep core functionality (Task 15-18) in Phase 4
- Extend timeline if needed
- Launch with core features, add enhancements later

---

## EXECUTION CHECKLIST

Before starting each phase, verify:
- [ ] Previous phase 100% complete
- [ ] All blockers resolved
- [ ] Team allocated and ready
- [ ] Completion criteria defined
- [ ] Testing strategy approved

---

## SUCCESS METRICS

### Launch Quality
- Zero critical bugs at launch
- >90% code quality score
- >95% test pass rate
- >50% code coverage

### Timeline
- Realistic launch date: December 28-31, 2025
- All phase gates completed on schedule
- No postponements after Phase 0

### Team
- 100% task ownership clarity
- Daily blocker identification
- Zero team context losses
- Weekly stakeholder updates

---

**This Roadmap is AUTHORITATIVE**
**Previous claims superseded by this evidence-based plan**
**Valid through Phase 5 completion**

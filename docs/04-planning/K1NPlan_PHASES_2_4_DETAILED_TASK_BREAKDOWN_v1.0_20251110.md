---
title: "K1.node1 Phases 2-4 Detailed Task Breakdown"
type: "Plan"
project: "K1.node1"
project_code: "K1N"
version: "v1.0"
date: "2025-11-10"
status: "authoritative"
intent: "Execution-ready subtask decomposition with parallel opportunities"
doc_id: "K1NPlan_PHASES_2_4_DETAILED_BREAKDOWN_v1.0_20251110"
tags: ["planning","execution","subtasks","parallelization"]
---

# K1.node1 Phases 2-4 Detailed Task Breakdown

**Document Status:** AUTHORITATIVE - Ready for team execution
**Updated:** November 10, 2025
**Dependencies:** Phase 1 (Tasks 5-6) must complete before Phase 2 begins

---

## PHASE 2: GRAPH SYSTEM POC & VALIDATION (Nov 20-25, 2025)

### Overview
- **Duration:** 5 days
- **Total Effort:** 26-38 hours
- **Parallel Streams:** 3 concurrent workstreams possible
- **Critical Dependency:** Task 5 compiler + Task 6 node catalog

---

### Task 7: Bloom Pattern Graph Conversion PoC

| Subtask ID | Title | Effort | Owner | Dependencies | Acceptance Criteria |
|------------|-------|--------|-------|--------------|---------------------|
| **2.7.1** | Design Bloom Graph Architecture | 2h | Pattern Eng | Task 6 complete | Graph JSON structure defined, node mapping documented |
| **2.7.2** | Author Bloom Graph JSON | 2h | Pattern Eng | 2.7.1 | Valid JSON passes schema validation |
| **2.7.3** | Compile Bloom Graph via k1c | 1h | Compiler Eng | 2.7.2, Task 5 | C++ generated without errors |
| **2.7.4** | Integrate Generated C++ | 1h | Firmware Eng | 2.7.3 | Code compiles in firmware, links successfully |
| **2.7.5** | CPU Simulation Validation | 2h | Test Eng | 2.7.4 | CRC matches hand-written Bloom for 1,600 samples |
| **2.7.6** | Hardware Side-by-Side Test | 3h | HW Eng | 2.7.5 | FPS delta <2%, visual output identical, video captured |
| **2.7.7** | Document Bloom Conversion | 1h | Tech Writer | 2.7.6 | Graph diagram, JSON snippet, mapping notes published |

**Subtotal:** 12h | **Critical Path:** 2.7.1 → 2.7.2 → 2.7.3 → 2.7.4 → 2.7.5 → 2.7.6 → 2.7.7

---

### Task 8: Spectrum Pattern Graph Conversion PoC

| Subtask ID | Title | Effort | Owner | Dependencies | Acceptance Criteria |
|------------|-------|--------|-------|--------------|---------------------|
| **2.8.1** | Design Spectrum Graph Architecture | 2h | Pattern Eng | Task 6 complete | Multi-band structure defined, param mapping clear |
| **2.8.2** | Author Spectrum Graph JSON | 2h | Pattern Eng | 2.8.1 | Valid JSON with FFT inputs, mirror/shift nodes |
| **2.8.3** | Compile Spectrum Graph via k1c | 1h | Compiler Eng | 2.8.2, Task 5 | C++ generated, safety nodes present |
| **2.8.4** | Integrate Generated C++ | 1h | Firmware Eng | 2.8.3 | Code compiles, registers with pattern system |
| **2.8.5** | Prepare 7 Audio Test Vectors | 2h | Test Eng | - | Low/mid/high energy, chromatic on/off, mirror on/off |
| **2.8.6** | CPU Simulation with Vectors | 2h | Test Eng | 2.8.4, 2.8.5 | All 7 vectors produce matching pixels vs. legacy |
| **2.8.7** | Hardware Performance Test | 3h | HW Eng | 2.8.6 | FPS delta <2%, memory <5KB extra, video captured |
| **2.8.8** | Document Spectrum Conversion | 1h | Tech Writer | 2.8.7 | Node mapping, graph structure, metrics published |

**Subtotal:** 14h | **Critical Path:** 2.8.1 → 2.8.2 → 2.8.3 → 2.8.4 → 2.8.6 → 2.8.7 → 2.8.8

**Parallel Opportunity:** 2.8.5 (test vectors) can start immediately alongside 2.8.1-2.8.4

---

### Task 9: Complete Stateful Node System Integration

| Subtask ID | Title | Effort | Owner | Dependencies | Acceptance Criteria |
|------------|-------|--------|-------|--------------|---------------------|
| **2.9.1** | Integrate Nodes with Pattern Registry | 1h | Firmware Eng | Task 6 | All 8 node types registered, accessible via API |
| **2.9.2** | Create Usage Examples (8 nodes) | 2h | Pattern Eng | 2.9.1 | Code examples for each node type, documented |
| **2.9.3** | Add Node Lifecycle Integration Tests | 2h | Test Eng | 2.9.1 | Init/update/teardown tests pass for all 8 nodes |
| **2.9.4** | Wire Telemetry for Node State | 1h | Telemetry Eng | 2.9.1 | REST endpoint shows node state, memory usage |
| **2.9.5** | Document Best Practices | 1h | Tech Writer | 2.9.2 | Usage guide, anti-patterns, perf tips published |

**Subtotal:** 7h | **Critical Path:** 2.9.1 → 2.9.2/2.9.3/2.9.4 (parallel) → 2.9.5

**Parallel Opportunity:** 2.9.2, 2.9.3, 2.9.4 can run concurrently after 2.9.1

---

### Task 10: Graph System Performance Profiling

| Subtask ID | Title | Effort | Owner | Dependencies | Acceptance Criteria |
|------------|-------|--------|-------|--------------|---------------------|
| **2.10.1** | Implement Performance Instrumentation | 2h | Perf Eng | Task 5 | Probes for memory, FPS, compile time added |
| **2.10.2** | Measure Memory Usage (8 Node Types) | 1h | Perf Eng | 2.10.1, 2.9.1 | Per-node memory footprint documented |
| **2.10.3** | Measure FPS Impact (Various Loads) | 2h | Perf Eng | 2.10.1, 2.7.6, 2.8.7 | Bloom/Spectrum FPS vs. targets (<2% delta) |
| **2.10.4** | Profile Code Generator Performance | 1h | Perf Eng | 2.10.1, Task 5 | Compile time for Bloom/Spectrum <5s each |
| **2.10.5** | Benchmark Pattern Compilation Speed | 1h | Perf Eng | 2.10.4 | k1c throughput documented (graphs/sec) |
| **2.10.6** | Compare Against Targets | 1h | Perf Eng | 2.10.2, 2.10.3 | Memory <5KB, FPS delta <2% verified |
| **2.10.7** | Publish Benchmark Report | 1h | Perf Eng | 2.10.6 | Report with charts, baselines, recommendations |

**Subtotal:** 9h | **Critical Path:** 2.10.1 → 2.10.2/2.10.3/2.10.4 (parallel) → 2.10.5 → 2.10.6 → 2.10.7

**Parallel Opportunity:** Cannot start until 2.7.6 and 2.8.7 complete (needs hardware PoCs)

---

### Phase 2 Summary

**Total Subtasks:** 33
**Total Effort:** 42 hours
**Duration:** 5 days (Nov 20-25)

**Parallel Execution Waves:**
- **Wave 2.1 (Day 1-2, Nov 20-21):** 2.7.1-2.7.4 + 2.8.1-2.8.4 + 2.9.1 (3 parallel streams)
- **Wave 2.2 (Day 3, Nov 22):** 2.7.5-2.7.6 + 2.8.5-2.8.7 + 2.9.2-2.9.4 (3 parallel streams)
- **Wave 2.3 (Day 4-5, Nov 23-25):** 2.7.7 + 2.8.8 + 2.9.5 + 2.10.1-2.10.7 (sequential profiling)

**Critical Path:** Task 7 (Bloom PoC) - 12h sequential work

---

## PHASE 3: TESTING & VALIDATION (Nov 25 - Dec 5, 2025)

### Overview
- **Duration:** 10 days
- **Total Effort:** 40-54 hours
- **Parallel Streams:** 2 major concurrent workstreams (HW validation + Stress testing)
- **Critical Gate:** Decision gate determines Phase 4 GO/NO-GO

---

### Task 11: Hardware Validation Testing

| Subtask ID | Title | Effort | Owner | Dependencies | Acceptance Criteria |
|------------|-------|--------|-------|--------------|---------------------|
| **3.11.1** | Design HW Validation Test Plan | 2h | Test Lead | Phase 2 complete | 25+ test cases defined, categorized |
| **3.11.2** | Create Automated Test Harness | 4h | Test Eng | 3.11.1 | Harness can execute tests, log results |
| **3.11.3** | Implement GPIO Tests (5 cases) | 2h | HW Eng | 3.11.2 | Pin states, interrupts, edge cases tested |
| **3.11.4** | Implement I2S Tests (4 cases) | 2h | Audio Eng | 3.11.2 | Microphone init, data capture, timeouts tested |
| **3.11.5** | Implement RMT Tests (6 cases) | 3h | LED Eng | 3.11.2 | Dual-channel sync, refill gaps, timing tested |
| **3.11.6** | Implement WiFi Tests (5 cases) | 2h | Network Eng | 3.11.2 | Provisioning, reconnect, AP mode tested |
| **3.11.7** | Implement USB Serial Tests (3 cases) | 1h | Firmware Eng | 3.11.2 | Serial init, data flow, error handling tested |
| **3.11.8** | Implement LED Output Tests (2 cases) | 1h | LED Eng | 3.11.2 | Color accuracy, CRC validation tested |
| **3.11.9** | Execute Full Test Suite on Hardware | 3h | Test Eng | 3.11.3-3.11.8 | All 25 tests run, results logged |
| **3.11.10** | Triage and Fix Failures | 4h | Senior Eng | 3.11.9 | All failures diagnosed, fixes implemented |
| **3.11.11** | Re-test After Fixes | 2h | Test Eng | 3.11.10 | 25/25 tests pass, documented |
| **3.11.12** | Publish HW Validation Report | 1h | Test Lead | 3.11.11 | Report with test results, timing, videos |

**Subtotal:** 27h | **Critical Path:** 3.11.1 → 3.11.2 → 3.11.3-3.11.8 (parallel) → 3.11.9 → 3.11.10 → 3.11.11 → 3.11.12

**Parallel Opportunity:** 3.11.3 through 3.11.8 can run concurrently (5 engineers)

---

### Task 12: Stress Testing & Stability Validation

| Subtask ID | Title | Effort | Owner | Dependencies | Acceptance Criteria |
|------------|-------|--------|-------|--------------|---------------------|
| **3.12.1** | Design 8 Stress Scenarios | 2h | QA Lead | Phase 2 complete | Scenarios defined with success criteria |
| **3.12.2** | Implement Stress Test Harness | 3h | QA Eng | 3.12.1 | Harness can run scenarios, detect leaks |
| **3.12.3** | Scenario 1: Rapid Pattern Changes | 2h | QA Eng | 3.12.2 | 100ms pattern switch, 1h stable, no crashes |
| **3.12.4** | Scenario 2: High Audio Processing | 2h | Audio Eng | 3.12.2 | Max audio input, 60 FPS, 2h stable |
| **3.12.5** | Scenario 3: Continuous LED Updates | 2h | LED Eng | 3.12.2 | 60 FPS sustained, 4h stable, no artifacts |
| **3.12.6** | Scenario 4: WiFi Reconnection Cycles | 2h | Network Eng | 3.12.2 | 100 disconnect/reconnect cycles, no leaks |
| **3.12.7** | Scenario 5: Parameter Changes Under Load | 2h | QA Eng | 3.12.2 | 10 params/sec while rendering, 1h stable |
| **3.12.8** | Scenario 6: Memory Exhaustion | 2h | Senior Eng | 3.12.2 | Graceful degradation, no crashes |
| **3.12.9** | Scenario 7: 24h Stability Run | 24h | QA Eng | 3.12.2 | Device runs 24h, zero crashes, memory stable |
| **3.12.10** | Scenario 8: Concurrent Operations | 2h | QA Eng | 3.12.2 | WiFi + audio + LED + HTTP simultaneous, stable |
| **3.12.11** | Memory Leak Analysis (ASAN) | 2h | Senior Eng | 3.12.3-3.12.10 | Zero leaks detected across all scenarios |
| **3.12.12** | Triage and Fix Stability Issues | 4h | Senior Eng | 3.12.11 | All issues diagnosed, fixes implemented |
| **3.12.13** | Re-test Failed Scenarios | 3h | QA Eng | 3.12.12 | 8/8 scenarios pass, documented |
| **3.12.14** | Publish Stress Test Report | 1h | QA Lead | 3.12.13 | Report with metrics, graphs, recommendations |

**Subtotal:** 29h (excluding 24h wait) | **Critical Path:** 3.12.1 → 3.12.2 → 3.12.3-3.12.10 (parallel) → 3.12.11 → 3.12.12 → 3.12.13 → 3.12.14

**Parallel Opportunity:** 3.12.3 through 3.12.10 can run concurrently (6 engineers)
**Note:** 3.12.9 (24h run) starts Day 1, completes Day 2+

---

### Task 13: Code Quality & Security Review

| Subtask ID | Title | Effort | Owner | Dependencies | Acceptance Criteria |
|------------|-------|--------|-------|--------------|---------------------|
| **3.13.1** | Setup SAST Tools (clang-analyzer, cppcheck) | 1h | DevOps Eng | - | Tools installed, configured, scripted |
| **3.13.2** | Run SAST Analysis on Codebase | 2h | QA Lead | 3.13.1, Tasks 1-10 | Full scan completed, results exported |
| **3.13.3** | Generate Code Coverage Report (GCOV) | 2h | QA Eng | Tasks 1-10 | Coverage report with line/function metrics |
| **3.13.4** | Run Security Analysis (SafeStack, etc.) | 2h | Security Eng | 3.13.1 | Security scan completed, findings logged |
| **3.13.5** | Triage Critical/High Issues | 2h | Senior Eng | 3.13.2, 3.13.4 | All critical/high issues prioritized |
| **3.13.6** | Fix Critical/High Issues | 6h | Firmware Team | 3.13.5 | All critical/high issues resolved |
| **3.13.7** | Re-run SAST After Fixes | 1h | QA Eng | 3.13.6 | Zero critical/high issues remaining |
| **3.13.8** | Verify Coverage Targets (>90%) | 1h | QA Lead | 3.13.3, 3.13.6 | Coverage >90%, gaps documented |
| **3.13.9** | Document Quality Metrics | 1h | QA Lead | 3.13.7, 3.13.8 | Baseline metrics, CI gates defined |
| **3.13.10** | Setup CI Quality Gates | 2h | DevOps Eng | 3.13.9 | CI fails on new critical/high issues |
| **3.13.11** | Publish QA Report | 1h | QA Lead | 3.13.10 | Report with scores, trends, recommendations |

**Subtotal:** 21h | **Critical Path:** 3.13.1 → 3.13.2/3.13.3/3.13.4 (parallel) → 3.13.5 → 3.13.6 → 3.13.7 → 3.13.8 → 3.13.9 → 3.13.10 → 3.13.11

**Parallel Opportunity:** 3.13.2, 3.13.3, 3.13.4 can run concurrently
**Dependency:** Cannot start until Tasks 11-12 are in progress (need stable code)

---

### Task 14: Decision Gate Validation - GO/NO-GO

| Subtask ID | Title | Effort | Owner | Dependencies | Acceptance Criteria |
|------------|-------|--------|-------|--------------|---------------------|
| **3.14.1** | Define 6 Decision Gate Criteria | 1h | Product Lead | Phase 3 plan | Criteria clear, measurable, agreed by stakeholders |
| **3.14.2** | Gather Results from Task 11 | 0.5h | Product Lead | 3.11.12 | HW validation report reviewed |
| **3.14.3** | Gather Results from Task 12 | 0.5h | Product Lead | 3.12.14 | Stress test report reviewed |
| **3.14.4** | Gather Results from Task 13 | 0.5h | Product Lead | 3.13.11 | QA report reviewed |
| **3.14.5** | Evaluate Against Criteria | 2h | Product Lead | 3.14.2-3.14.4 | Scorecard completed for all 6 criteria |
| **3.14.6** | Prepare Decision Document | 2h | Product Lead | 3.14.5 | Document with rationale, risks, recommendation |
| **3.14.7** | Stakeholder Review Meeting | 1h | All Stakeholders | 3.14.6 | All stakeholders present, vote recorded |
| **3.14.8** | Create Decision Record | 0.5h | Product Lead | 3.14.7 | ADR published with GO/NO-GO outcome |
| **3.14.9** | Plan Phase 4 (if GO) or Recovery (if NO-GO) | 1h | Product Lead | 3.14.8 | Next steps documented, team aligned |

**Subtotal:** 9h | **Critical Path:** 3.14.1 → 3.14.2/3.14.3/3.14.4 (parallel) → 3.14.5 → 3.14.6 → 3.14.7 → 3.14.8 → 3.14.9

**Dependency:** Absolutely must wait for Tasks 11, 12, 13 to complete

---

### Phase 3 Summary

**Total Subtasks:** 46
**Total Effort:** 86 hours (excluding 24h stability wait)
**Duration:** 10 days (Nov 25 - Dec 5)

**Parallel Execution Waves:**
- **Wave 3.1 (Day 1-2, Nov 25-26):** 3.11.1-3.11.2 + 3.12.1-3.12.2 + 3.13.1 (setup tasks parallel)
- **Wave 3.2 (Day 3-5, Nov 27-29):** 3.11.3-3.11.8 (5 parallel) + 3.12.3-3.12.10 (6 parallel, includes 24h start)
- **Wave 3.3 (Day 6-7, Nov 30-Dec 1):** 3.11.9-3.11.11 + 3.12.11-3.12.13 (parallel) + 3.13.2-3.13.4 (parallel)
- **Wave 3.4 (Day 8-9, Dec 2-4):** 3.11.12 + 3.12.14 + 3.13.5-3.13.11 (sequential QA fixes)
- **Wave 3.5 (Day 10, Dec 5):** 3.14.1-3.14.9 (decision gate - sequential)

**Critical Path:** Task 12 (Stress testing with 24h run) - 29h + 24h wait

---

## PHASE 4: PRODUCTION BUILD (Dec 5-30, 2025)

### Overview
- **Duration:** 25 days
- **Total Effort:** 72-96 hours
- **Parallel Streams:** 4 major concurrent workstreams
- **Conditional:** ONLY proceeds if Phase 3 Decision Gate is "GO"

---

### Task 15: Code Generation for All Node Types / Patterns

| Subtask ID | Title | Effort | Owner | Dependencies | Acceptance Criteria |
|------------|-------|--------|-------|--------------|---------------------|
| **4.15.1** | Extend Emitter for Audio Input Nodes (5 types) | 3h | Compiler Eng | Phase 3 GO | FFT, chromagram, envelope, beat, autocorr codegen |
| **4.15.2** | Extend Emitter for Math/Filter Nodes (8 types) | 3h | Compiler Eng | 4.15.1 | Add, mul, mix, clamp, contrast, pow, sqrt, lowpass |
| **4.15.3** | Extend Emitter for Gradient/Color Nodes (6 types) | 3h | Compiler Eng | 4.15.2 | HSV, gradientMap, desat, forceSat, palette |
| **4.15.4** | Extend Emitter for Geometry Nodes (7 types) | 3h | Compiler Eng | 4.15.3 | Mirror, shift, downsample, upsample, trail, persist, composite |
| **4.15.5** | Extend Emitter for Noise/Procedural Nodes (4 types) | 2h | Compiler Eng | 4.15.4 | Perlin, RNG, position accumulators |
| **4.15.6** | Extend Emitter for Stateful Nodes (6 types) | 3h | Compiler Eng | 4.15.5 | Brightness accum, smoothing buffers, noise phase |
| **4.15.7** | Add Emit-Time Unit Tests (27 tests, one per node) | 4h | Test Eng | 4.15.1-4.15.6 | All node codegen tests pass |
| **4.15.8** | Generate Code for 11 Priority Patterns | 3h | Pattern Eng | 4.15.7 | Bloom, Spectrum + 9 others compiled |
| **4.15.9** | Integrate Generated Code with Firmware | 2h | Firmware Eng | 4.15.8 | All 11 patterns registered, compile |
| **4.15.10** | Benchmark Codegen Performance | 2h | Perf Eng | 4.15.9 | Time/memory per node type documented |
| **4.15.11** | Verify No Heap Usage | 1h | Firmware Eng | 4.15.9 | Static analysis confirms zero heap allocs |
| **4.15.12** | Hardware Smoke Tests (11 patterns) | 3h | HW Eng | 4.15.9 | All patterns run, FPS/memory logged |
| **4.15.13** | Document Codegen Patterns | 2h | Tech Writer | 4.15.10, 4.15.12 | Node→C++ mapping guide published |

**Subtotal:** 34h | **Critical Path:** 4.15.1 → 4.15.2 → 4.15.3 → 4.15.4 → 4.15.5 → 4.15.6 → 4.15.7 → 4.15.8 → 4.15.9 → 4.15.10/4.15.11 (parallel) → 4.15.12 → 4.15.13

**Parallel Opportunity:** Limited until 4.15.7 completes; then 4.15.8-4.15.13 can overlap with other tasks

---

### Task 16: Migrate High-Value Patterns to Graph System

| Subtask ID | Title | Effort | Owner | Dependencies | Acceptance Criteria |
|------------|-------|--------|-------|--------------|---------------------|
| **4.16.1** | Select 11 High-Value Patterns for Migration | 1h | Product Lead | Phase 3 GO | List prioritized by user value, complexity |
| **4.16.2** | Pattern 1: Design + Compile + Validate | 2h | Pattern Eng A | 4.15.8 | Graph JSON, C++, CPU sim CRC, HW test pass |
| **4.16.3** | Pattern 2: Design + Compile + Validate | 2h | Pattern Eng A | 4.15.8 | Graph JSON, C++, CPU sim CRC, HW test pass |
| **4.16.4** | Pattern 3: Design + Compile + Validate | 2h | Pattern Eng B | 4.15.8 | Graph JSON, C++, CPU sim CRC, HW test pass |
| **4.16.5** | Pattern 4: Design + Compile + Validate | 2h | Pattern Eng B | 4.15.8 | Graph JSON, C++, CPU sim CRC, HW test pass |
| **4.16.6** | Pattern 5: Design + Compile + Validate | 2h | Pattern Eng A | 4.16.2, 4.16.3 | Graph JSON, C++, CPU sim CRC, HW test pass |
| **4.16.7** | Pattern 6: Design + Compile + Validate | 2h | Pattern Eng B | 4.16.4, 4.16.5 | Graph JSON, C++, CPU sim CRC, HW test pass |
| **4.16.8** | Pattern 7: Design + Compile + Validate | 2h | Pattern Eng A | 4.16.6 | Graph JSON, C++, CPU sim CRC, HW test pass |
| **4.16.9** | Pattern 8: Design + Compile + Validate | 2h | Pattern Eng B | 4.16.7 | Graph JSON, C++, CPU sim CRC, HW test pass |
| **4.16.10** | Pattern 9: Design + Compile + Validate | 2h | Pattern Eng A | 4.16.8 | Graph JSON, C++, CPU sim CRC, HW test pass |
| **4.16.11** | Pattern 10: Design + Compile + Validate | 2h | Pattern Eng B | 4.16.9 | Graph JSON, C++, CPU sim CRC, HW test pass |
| **4.16.12** | Pattern 11: Design + Compile + Validate | 2h | Pattern Eng A | 4.16.10 | Graph JSON, C++, CPU sim CRC, HW test pass |
| **4.16.13** | Document All 11 Pattern Migrations | 3h | Tech Writer | 4.16.2-4.16.12 | Graph diagrams, mapping notes, metrics |
| **4.16.14** | Calculate Migration Coverage | 1h | Product Lead | 4.16.13 | Percentage of library migrated (target >58%) |

**Subtotal:** 27h | **Critical Path:** 4.15.8 → 4.16.1 → 4.16.2/4.16.4 (parallel) → 4.16.3/4.16.5 (parallel) → 4.16.6/4.16.7 (parallel) → etc.

**Parallel Opportunity:** Two Pattern Engineers can work on different patterns simultaneously (halves time)

---

### Task 17: Complete Graph Editor UI

| Subtask ID | Title | Effort | Owner | Dependencies | Acceptance Criteria |
|------------|-------|--------|-------|--------------|---------------------|
| **4.17.1** | Finalize Node Palette UI (35 nodes) | 3h | Frontend Eng | Task 6 | All node types visible, searchable, categorized |
| **4.17.2** | Implement Parameter Editing UI | 3h | Frontend Eng | Task 6 | All param types editable (scalar, vec, color, bool, enum) |
| **4.17.3** | Integrate k1c Backend (REST/CLI) | 2h | Frontend Eng | Task 5 | UI can trigger compile, display results |
| **4.17.4** | Implement Inline Validation UI | 2h | Frontend Eng | Task 5 | Validator errors show nodeId/type/port/location |
| **4.17.5** | Add Graph Overlays (Layers/Mirror) | 2h | Frontend Eng | 4.17.1 | Visual indicators for layering, mirror toggles |
| **4.17.6** | Show Stateful Node Metadata | 1h | Frontend Eng | 4.17.1 | Memory footprint, side-effect icons visible |
| **4.17.7** | E2E Flow Test: Bloom via UI | 2h | QA Eng | 4.17.2-4.17.6 | Author Bloom, compile, run in firmware |
| **4.17.8** | E2E Flow Test: Spectrum via UI | 2h | QA Eng | 4.17.7 | Author Spectrum, compile, run in firmware |
| **4.17.9** | Document UI Shortcuts & Guides | 2h | Tech Writer | 4.17.8 | Keyboard shortcuts, how-to, troubleshooting |
| **4.17.10** | UI Unit Tests (15+ cases) | 3h | QA Eng | 4.17.1-4.17.6 | Component tests pass for palette, params, validation |

**Subtotal:** 22h | **Critical Path:** 4.17.1 → 4.17.2/4.17.3/4.17.4 (parallel) → 4.17.5/4.17.6 (parallel) → 4.17.7 → 4.17.8 → 4.17.9/4.17.10 (parallel)

**Parallel Opportunity:** Can start Day 1 of Phase 4 (independent of Task 15/16)

---

### Task 18: Graph System Integration Testing

| Subtask ID | Title | Effort | Owner | Dependencies | Acceptance Criteria |
|------------|-------|--------|-------|--------------|---------------------|
| **4.18.1** | Define Integration Test Plan | 2h | Test Lead | Phase 3 GO | Test matrix with workflows, error paths defined |
| **4.18.2** | Design Test Matrix (Patterns × Params) | 2h | Test Eng | 4.16.1 | Bloom/Spectrum/11 patterns × mirror/chromatic/presets |
| **4.18.3** | Implement Automated Test Harness | 4h | Test Eng | 4.18.1 | Harness builds graphs, runs k1c, builds firmware, runs CPU sim |
| **4.18.4** | Add Error Path Tests (10 cases) | 3h | Test Eng | 4.18.3 | Invalid graph, schema errors, compiler errors tested |
| **4.18.5** | Add Performance Metric Collection | 2h | Perf Eng | 4.18.3 | FPS, memory, scratch buffer logged per pattern |
| **4.18.6** | Execute Full Test Matrix (CPU Sim) | 3h | Test Eng | 4.18.3-4.18.5, 4.16.13 | All patterns × params produce CRC matches |
| **4.18.7** | Hardware Smoke Tests (3 patterns) | 3h | HW Eng | 4.18.6 | Logs/FPS comparisons captured for 3 patterns |
| **4.18.8** | Triage and Log Bugs | 2h | Test Lead | 4.18.6, 4.18.7 | All failures logged, owners assigned |
| **4.18.9** | Fix Integration Bugs | 6h | Multi-Team | 4.18.8 | All critical/high bugs resolved |
| **4.18.10** | Re-test After Fixes | 2h | Test Eng | 4.18.9 | All tests pass, documented |
| **4.18.11** | Setup CI Job for Graph Tests | 2h | DevOps Eng | 4.18.10 | CI builds graphs, fails on dirty tree |
| **4.18.12** | Publish Integration Test Report | 1h | Test Lead | 4.18.11 | Report with coverage, metrics, recommendations |

**Subtotal:** 32h | **Critical Path:** 4.18.1 → 4.18.2/4.18.3 (parallel) → 4.18.4/4.18.5 (parallel) → 4.18.6 → 4.18.7 → 4.18.8 → 4.18.9 → 4.18.10 → 4.18.11 → 4.18.12

**Dependency:** Cannot start until 4.16.13 complete (needs migrated patterns)

---

### Task 19: SDK Documentation & Templates

| Subtask ID | Title | Effort | Owner | Dependencies | Acceptance Criteria |
|------------|-------|--------|-------|--------------|---------------------|
| **4.19.1** | Document Graph Schema & Type System | 2h | Tech Writer | Task 5 | Schema reference with JSON examples |
| **4.19.2** | Document Node Catalog (35 nodes) | 4h | Tech Writer | Task 6 | Per-node docs: description, params, usage, memory |
| **4.19.3** | Document Bloom/Spectrum Migration | 2h | Tech Writer | Task 7, Task 8 | How-to guides tying back to PoCs |
| **4.19.4** | Document k1c CLI Usage | 2h | Tech Writer | Task 5 | Build/deploy commands, error codes, flags |
| **4.19.5** | Document Best Practices | 2h | Tech Writer | Task 6 | Layering, mirror, stateful node limits, perf tips |
| **4.19.6** | Create Troubleshooting Guide | 2h | Tech Writer | Task 5 | Validator errors, scratch cap hits, common issues |
| **4.19.7** | Create Graph JSON Template | 1h | Tech Writer | Task 5 | Starter template with comments |
| **4.19.8** | Create Pattern Migration Checklist | 1h | Tech Writer | Task 16 | Step-by-step checklist for migrations |
| **4.19.9** | Create Sample README for Third-Party | 1h | Tech Writer | - | Template for community pattern packages |
| **4.19.10** | Publish Docs in Repo & Wiki | 1h | Tech Writer | 4.19.1-4.19.9 | All docs cross-linked, indexed, published |
| **4.19.11** | Developer Walkthrough Review | 1h | Senior Eng | 4.19.10 | Docs reviewed for accuracy, usability |

**Subtotal:** 19h | **Critical Path:** 4.19.1/4.19.2 (parallel) → 4.19.3/4.19.4/4.19.5/4.19.6 (parallel) → 4.19.7/4.19.8/4.19.9 (parallel) → 4.19.10 → 4.19.11

**Parallel Opportunity:** Can start early (Day 1) and run parallel with other tasks

---

### Task 20: Implement Parameter Editor

| Subtask ID | Title | Effort | Owner | Dependencies | Acceptance Criteria |
|------------|-------|--------|-------|--------------|---------------------|
| **4.20.1** | Design Parameter Inspector Component | 2h | Frontend Eng | Task 6 | Component architecture defined |
| **4.20.2** | Implement Scalar Parameter Editor | 2h | Frontend Eng | 4.20.1 | Int, float, bool editors with bounds |
| **4.20.3** | Implement Vector Parameter Editor | 2h | Frontend Eng | 4.20.1 | Vec2, vec3 editors with bounds |
| **4.20.4** | Implement Color Parameter Editor | 2h | Frontend Eng | 4.20.1 | Color picker, HSV/RGB modes |
| **4.20.5** | Implement Enum Parameter Editor | 1h | Frontend Eng | 4.20.1 | Dropdown with options, tooltips |
| **4.20.6** | Add Bounds Enforcement & Defaults | 2h | Frontend Eng | 4.20.2-4.20.5 | Out-of-bounds values prevented, defaults loaded |
| **4.20.7** | Implement JSON Serialization | 1h | Frontend Eng | 4.20.6 | Params serialize to/from graph JSON |
| **4.20.8** | Add Inline Validation | 2h | Frontend Eng | Task 5, 4.20.7 | Invalid params highlight, show error codes |
| **4.20.9** | Unit Tests (15 cases) | 3h | QA Eng | 4.20.2-4.20.8 | Each param type + edge cases tested |
| **4.20.10** | Integrate with Graph Editor | 2h | Frontend Eng | Task 17, 4.20.8 | Real-time updates, undo/redo support |
| **4.20.11** | E2E Test: Author Graph + Tweak Params | 2h | QA Eng | 4.20.10 | Author, edit params, compile, verify in firmware |
| **4.20.12** | Document Parameter Editing | 1h | Tech Writer | 4.20.11 | Usage guide, screenshots, tips |

**Subtotal:** 22h | **Critical Path:** 4.20.1 → 4.20.2/4.20.3/4.20.4/4.20.5 (parallel) → 4.20.6 → 4.20.7 → 4.20.8 → 4.20.9/4.20.10 (parallel) → 4.20.11 → 4.20.12

**Dependency:** Depends on Task 17 baseline (graph editor UI)

---

### Phase 4 Summary

**Total Subtasks:** 79
**Total Effort:** 156 hours
**Duration:** 25 days (Dec 5-30)

**Parallel Execution Waves:**
- **Wave 4.1 (Day 1-5, Dec 5-9):** 4.15.1-4.15.7 (compiler stream) + 4.17.1-4.17.6 (UI stream) + 4.19.1-4.19.6 (docs stream) - 3 parallel workstreams
- **Wave 4.2 (Day 6-10, Dec 10-14):** 4.15.8-4.15.13 (codegen finalize) + 4.16.1-4.16.7 (pattern migration wave 1) + 4.17.7-4.17.10 (UI tests) + 4.20.1-4.20.5 (param editor start)
- **Wave 4.3 (Day 11-15, Dec 15-19):** 4.16.8-4.16.14 (pattern migration wave 2) + 4.18.1-4.18.7 (integration tests) + 4.20.6-4.20.11 (param editor finalize)
- **Wave 4.4 (Day 16-20, Dec 20-24):** 4.18.8-4.18.12 (integration test fixes) + 4.19.7-4.19.11 (docs finalize) + 4.20.12 (param docs)
- **Wave 4.5 (Day 21-25, Dec 25-30):** Final integration, buffer, polish, release prep

**Critical Path:** Task 15 (Code generation) - 34h sequential work blocks Task 16 and Task 18

---

## PARALLEL EXECUTION OPPORTUNITIES

### Phase 2 Parallelization

**3 Concurrent Workstreams:**
1. **Bloom PoC Stream** (Pattern Eng + Compiler Eng + HW Eng): 2.7.1-2.7.7 (12h sequential)
2. **Spectrum PoC Stream** (Pattern Eng + Compiler Eng + HW Eng): 2.8.1-2.8.8 (14h sequential)
3. **Node Integration Stream** (Firmware Eng + Test Eng): 2.9.1-2.9.5 (7h with internal parallelization)

**Critical Path:** Spectrum PoC (14h) blocks profiling task

**Timeline Compression:**
- Sequential: 42h
- Parallel (3 teams): 14h + profiling (9h) = 23h total elapsed
- **Savings:** 19h (45% reduction)

---

### Phase 3 Parallelization

**2 Major Concurrent Workstreams:**
1. **Hardware Validation Stream** (5 HW engineers): 3.11.1-3.11.12 (27h with internal parallelization)
2. **Stress Testing Stream** (6 QA engineers): 3.12.1-3.12.14 (29h + 24h wait)

**Sequential QA Stream:**
3. **Code Quality Stream** (QA team): 3.13.1-3.13.11 (21h, starts after 11-12 in progress)

**Sequential Decision Stream:**
4. **Decision Gate Stream** (Product Lead): 3.14.1-3.14.9 (9h, starts after 11-12-13 complete)

**Critical Path:** Stress testing with 24h stability run

**Timeline Compression:**
- Sequential: 86h + 24h = 110h
- Parallel (2 major streams + sequential QA + decision): 29h + 24h wait + 21h + 9h = 83h elapsed
- **Savings:** 27h (24% reduction, limited by 24h stability run)

---

### Phase 4 Parallelization

**4 Major Concurrent Workstreams:**
1. **Compiler Stream** (Compiler Eng + Test Eng): 4.15.1-4.15.13 (34h sequential)
2. **UI Stream** (Frontend Eng + QA Eng): 4.17.1-4.17.10 + 4.20.1-4.20.12 (44h with dependencies)
3. **Pattern Migration Stream** (2 Pattern Engs): 4.16.1-4.16.14 (27h with parallelization)
4. **Documentation Stream** (Tech Writer): 4.19.1-4.19.11 (19h with parallelization)

**Sequential Integration Stream:**
5. **Integration Test Stream** (Test team): 4.18.1-4.18.12 (32h, starts after patterns ready)

**Critical Path:** Compiler Stream (34h) → Pattern Migration (14h with 2 engineers) → Integration Tests (32h) = 80h

**Timeline Compression:**
- Sequential: 156h
- Parallel (4 concurrent streams, then integration): ~80h elapsed
- **Savings:** 76h (49% reduction)

---

## CRITICAL PATH ANALYSIS

### Overall Critical Path (Phase 2-4)

**Phase 2 Critical Path:**
- Spectrum PoC (14h) → Performance Profiling (9h) = **23h**

**Phase 3 Critical Path:**
- Stress Testing Setup (5h) → Concurrent Stress Scenarios (8h) → 24h Stability Wait → Analysis (6h) → Decision Gate (9h) = **52h + 24h wait**

**Phase 4 Critical Path:**
- Compiler Extension (17h) → Pattern Codegen (5h) → Hardware Tests (3h) → Pattern Migration (14h with 2 engineers) → Integration Tests (17h) → Bug Fixes (8h) → Re-test (4h) = **68h**

**Total Critical Path:** 23h + 52h + 24h wait + 68h = **143h + 24h wait**

**With Optimal Parallelization:**
- Phase 2: 5 days (limited by 24h waits, daily coordination)
- Phase 3: 10 days (limited by 24h stability run)
- Phase 4: 20 days (limited by dependencies, coordination overhead)
- **Total:** 35 calendar days

---

## DAILY EXECUTION SCHEDULE

### Phase 2 Schedule (Nov 20-25)

**Day 1 (Nov 20, Wed):**
- **Wave 2.1 Start:** All three workstreams begin
  - Bloom: 2.7.1-2.7.2 (design + author)
  - Spectrum: 2.8.1-2.8.2 + 2.8.5 (design + author + test vectors)
  - Node Integration: 2.9.1 (registry integration)

**Day 2 (Nov 21, Thu):**
- Bloom: 2.7.3-2.7.4 (compile + integrate)
- Spectrum: 2.8.3-2.8.4 (compile + integrate)
- Node Integration: 2.9.2-2.9.4 (parallel: examples + tests + telemetry)

**Day 3 (Nov 22, Fri):**
- **Wave 2.2 Start:** Hardware validation begins
  - Bloom: 2.7.5-2.7.6 (CPU sim + hardware test)
  - Spectrum: 2.8.6-2.8.7 (CPU sim + hardware test)
  - Node Integration: 2.9.5 (documentation)

**Day 4 (Nov 23, Sat):**
- **Wave 2.3 Start:** Documentation + Profiling
  - Bloom: 2.7.7 (document)
  - Spectrum: 2.8.8 (document)
  - Profiling: 2.10.1-2.10.4 (parallel: instrumentation + measurements)

**Day 5 (Nov 24-25, Sun-Mon):**
- Profiling: 2.10.5-2.10.7 (benchmark + compare + report)
- **Phase 2 Complete:** Handoff to Phase 3

---

### Phase 3 Schedule (Nov 25 - Dec 5)

**Day 1 (Nov 25, Mon):**
- **Wave 3.1 Start:** Setup tasks
  - HW Validation: 3.11.1-3.11.2 (test plan + harness)
  - Stress Testing: 3.12.1-3.12.2 (scenarios + harness)
  - QA Setup: 3.13.1 (SAST tools)

**Day 2 (Nov 26, Tue):**
- **Wave 3.2 Start:** Concurrent test implementation
  - HW Validation: 3.11.3-3.11.8 (5 parallel: GPIO, I2S, RMT, WiFi, USB, LED)
  - Stress Testing: 3.12.3-3.12.10 (8 parallel scenarios, **24h run starts**)

**Day 3-4 (Nov 27-28, Wed-Thu):**
- **24h Stability Run In Progress**
- HW Validation: 3.11.9 (execute full suite)
- QA: 3.13.2-3.13.4 (parallel: SAST, coverage, security scans)

**Day 5 (Nov 29, Fri):**
- **24h Stability Run Completes**
- HW Validation: 3.11.10-3.11.11 (triage + fix + re-test)
- Stress Testing: 3.12.11 (memory leak analysis)

**Day 6-7 (Nov 30 - Dec 1, Sat-Sun):**
- **Wave 3.3:** Fixing phase
  - HW Validation: 3.11.12 (publish report)
  - Stress Testing: 3.12.12-3.12.13 (triage + fix + re-test)
  - QA: 3.13.5-3.13.6 (triage + fix critical/high issues)

**Day 8-9 (Dec 2-4, Mon-Wed):**
- **Wave 3.4:** QA finalization
  - Stress Testing: 3.12.14 (publish report)
  - QA: 3.13.7-3.13.11 (re-run SAST, verify coverage, setup CI gates, publish)

**Day 10 (Dec 5, Thu):**
- **Wave 3.5:** Decision Gate
  - Decision: 3.14.1-3.14.9 (criteria → gather → evaluate → decide → plan)
  - **Phase 3 Complete:** GO/NO-GO decision made

---

### Phase 4 Schedule (Dec 5-30)

**Week 1 (Dec 5-9, Thu-Mon):**
- **Wave 4.1 Start:** Three parallel workstreams
  - Compiler: 4.15.1-4.15.7 (extend emitter for all node types + tests)
  - UI: 4.17.1-4.17.6 (finalize palette, params, validation, overlays)
  - Docs: 4.19.1-4.19.6 (schema, catalog, migration, CLI, best practices, troubleshooting)

**Week 2 (Dec 10-14, Tue-Sat):**
- **Wave 4.2 Start:** Codegen + Migration + UI Tests
  - Compiler: 4.15.8-4.15.13 (generate 11 patterns, integrate, benchmark, smoke tests, document)
  - Pattern Migration: 4.16.1-4.16.7 (select + migrate first 6 patterns, 2 engineers parallel)
  - UI: 4.17.7-4.17.10 (E2E tests, documentation, unit tests)
  - Param Editor: 4.20.1-4.20.5 (design + implement scalar/vector/color/enum editors)

**Week 3 (Dec 15-19, Sun-Thu):**
- **Wave 4.3 Start:** Migration + Integration + Param Finalize
  - Pattern Migration: 4.16.8-4.16.14 (migrate remaining 5 patterns, document, calculate coverage)
  - Integration Tests: 4.18.1-4.18.7 (plan, matrix, harness, error tests, metrics, execute, HW tests)
  - Param Editor: 4.20.6-4.20.11 (bounds, serialization, validation, tests, integration, E2E test)

**Week 4 (Dec 20-24, Fri-Tue):**
- **Wave 4.4 Start:** Integration Fixes + Docs Finalize
  - Integration Tests: 4.18.8-4.18.12 (triage, fix, re-test, CI setup, publish)
  - Docs: 4.19.7-4.19.11 (templates, checklist, README, publish, review)
  - Param Editor: 4.20.12 (documentation)

**Week 5 (Dec 25-30, Wed-Mon):**
- **Wave 4.5:** Final integration, buffer, polish
  - Final cross-team integration testing
  - Release candidate build
  - Release notes preparation
  - **Phase 4 Complete:** Production build ready

---

## EXECUTION RECOMMENDATIONS

### Team Allocation

**Phase 2 (5 days):**
- 2 Pattern Engineers (Bloom + Spectrum)
- 1 Compiler Engineer (k1c support)
- 1 Firmware Engineer (integration)
- 1 Test Engineer (CPU sim)
- 1 Hardware Engineer (device testing)
- 1 Telemetry Engineer (node diagnostics)
- 1 Performance Engineer (profiling)
- 1 Technical Writer (documentation)
- **Total:** 9 engineers

**Phase 3 (10 days):**
- 5 Hardware Engineers (GPIO, I2S, RMT, WiFi, USB specialists)
- 6 QA Engineers (stress scenarios)
- 1 Test Lead (harness design)
- 1 QA Lead (code quality)
- 1 Security Engineer (SAST/security scans)
- 1 DevOps Engineer (CI setup)
- 1 Senior Engineer (triage/fixes)
- 1 Product Lead (decision gate)
- **Total:** 17 engineers (peak concurrency)

**Phase 4 (25 days):**
- 1 Compiler Engineer (codegen extension)
- 2 Pattern Engineers (migration, parallel work)
- 2 Frontend Engineers (UI + param editor)
- 1 Firmware Engineer (integration)
- 2 Test Engineers (integration harness, E2E tests)
- 1 Performance Engineer (benchmarking)
- 1 Hardware Engineer (smoke tests)
- 1 QA Engineer (UI tests)
- 1 DevOps Engineer (CI)
- 1 Technical Writer (SDK docs)
- 1 Test Lead (integration plan)
- 1 Product Lead (coordination)
- **Total:** 15 engineers

### Risk Mitigation

**Phase 2 Risks:**
- **Risk:** Compiler bugs block PoCs
- **Mitigation:** Daily compiler check-ins, staged deliverables, fallback to manual C++ if needed

**Phase 3 Risks:**
- **Risk:** 24h stability run fails
- **Mitigation:** Start early (Day 2), have 3-day buffer, prepare for re-run

**Phase 4 Risks:**
- **Risk:** Pattern migration takes longer than estimated
- **Mitigation:** Two engineers parallel, can defer low-priority patterns to Phase 5

### Communication Cadence

**Daily Standups:**
- 15 minutes, all team leads
- Blockers surfaced immediately
- Cross-team dependencies highlighted

**Weekly Reviews:**
- Friday EOD: Phase progress review
- Monday morning: Week planning
- Stakeholder updates: Weekly summary email

**Phase Gates:**
- End of Phase 2: Technical validation meeting (2h)
- End of Phase 3: Formal decision gate meeting (2h)
- End of Phase 4: Release readiness review (2h)

---

## SUCCESS METRICS

### Phase 2 Success Criteria
- Bloom PoC: FPS delta <2%, CRC match, documented
- Spectrum PoC: 7/7 test vectors pass, FPS delta <2%, documented
- Node Integration: 8/8 nodes integrated, telemetry working
- Performance: Memory <5KB, FPS delta <2%, compile time <5s/pattern

### Phase 3 Success Criteria
- Hardware Validation: 25/25 tests pass
- Stress Testing: 8/8 scenarios pass, zero memory leaks
- Code Quality: Security >90%, Quality >90%, Coverage >90%
- Decision Gate: Formal GO vote from all stakeholders

### Phase 4 Success Criteria
- Code Generation: 27/27 node tests pass, 11 patterns generated
- Pattern Migration: 11 patterns migrated, >58% library coverage
- Graph Editor UI: E2E flow tests pass for Bloom + Spectrum
- Integration Tests: Full test matrix passes, CI job green
- SDK Docs: All docs published, walkthrough reviewed
- Parameter Editor: 15/15 unit tests pass, E2E test passes

---

**EXECUTION READY**
**Total Subtasks:** 158 (Phase 2: 33, Phase 3: 46, Phase 4: 79)
**Total Effort:** 284 hours (Phase 2: 42h, Phase 3: 86h, Phase 4: 156h)
**Duration:** 40 calendar days (Phase 2: 5d, Phase 3: 10d, Phase 4: 25d)
**Team Peak:** 17 engineers (Phase 3)

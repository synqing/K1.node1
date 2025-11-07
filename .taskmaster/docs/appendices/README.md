---
author: Claude Agent (Phase 2D1 Master Strategy)
date: 2025-11-05
status: published
intent: Navigation guide for agent-specific context appendices
---

# Agent Context Appendices

This directory contains specialized technical context for each team member executing Phase 2 (Weeks 1-14).

**Each agent MUST read their assigned appendix before starting work.**

---

## Appendix Directory

### Agent A: Firmware Security Engineer
**File:** `agent_a_firmware_context.md`
**Size:** ~350 lines
**Read Time:** 30-40 minutes
**Contents:**
- ESP32-S3 architecture constraints (512KB SRAM, dual-core, memory management)
- 4 Critical fix patterns (WiFi credentials, I2S timeout, WebServer bounds, error registry)
- Performance optimization strategies (FPS budget, memory management)
- Common pitfalls and anti-patterns
- Hardware validation protocols (100 boot cycles, 1000+ pattern stress, 24h temperature monitoring)

**When to Read:** Before Nov 6, 9 AM (Week 1 starts)

---

### Agent B: Graph System Architect
**File:** `agent_b_graph_context.md`
**Size:** ~400 lines
**Read Time:** 40-50 minutes
**Contents:**
- 35-40 node type taxonomy (Input, Transform, Generator, Stateful, Output)
- Code generation pipeline (JSON → C++ → compiled patterns)
- Stateful node implementation (BeatDetectorNode, FFTNode, EnvelopeNode examples)
- Bloom & Spectrum pattern migration (reference implementations)
- Performance budget (<2% FPS, <5KB memory, <2s compilation)
- Decision gate criteria validation

**When to Read:** Before Nov 6, 9 AM (Week 1 starts)

---

### Agent C: QA/Validation Engineer
**File:** `agent_c_testing_context.md`
**Size:** ~350 lines
**Read Time:** 30-40 minutes
**Contents:**
- Phase 2D1 fix validation test cases (WiFi, I2S, WebServer, error codes)
- Hardware testing protocols:
  - Boot cycle test (100x)
  - Stress testing (1000+ pattern changes)
  - Hardware latency measurement (<10ms p99)
  - Temperature monitoring (24h, <65°C)
- Test pyramid structure (unit, integration, hardware)
- Regression testing checklist
- Performance profiling methodology (FPS, memory, latency)
- Decision gate evidence package assembly

**When to Read:** Before Nov 6, 9 AM (Week 1 starts)

---

### Agent D: Integration Engineer
**File:** `agent_d_integration_context.md`
**Size:** ~400 lines
**Read Time:** 40-50 minutes
**Contents:**
- Webapp architecture (React 18 + Vite, Tailwind, Zustand, WebSocket)
- Path A implementation (ReactFlow graph editor, custom nodes, serialization, validation)
- Path B implementation (Parameter editor with 200+ sliders, preset save/load)
- Common integration patterns (device connection, real-time telemetry)
- Frontend testing strategy (Vitest unit, MSW integration, Playwright E2E)
- Real-time communication (<100ms latency requirement)
- API endpoints required (Path A and Path B variants)
- Success criteria (rendering, serialization, compilation, deployment, latency)

**When to Read:** Before Nov 8 (Week 1, standby prep phase)

---

### Orchestrator: Multi-Agent Coordination
**File:** `agent_assignment_coordination.md`
**Size:** ~400 lines
**Read Time:** 45-60 minutes
**Contents:**
- Task assignment matrix (20 TaskMaster IDs → 4 agents)
- Workload balancing matrix (hours/week per agent, peak days)
- Parallel execution map (Week 1 critical path diagram with dependencies)
- Resource conflict detection (hardware, code, async communication)
- Multi-terminal workflow setup (5 Claude Code sessions with commands)
- Communication protocol (daily standup, blockers, escalation)
- Decision gate evidence handoff (Nov 13, 6-8 AM)
- Progress tracking strategy (TaskMaster integration, velocity, risk monitoring)
- Conditional Phase 2 activation (Path A vs Path B post-decision)

**When to Read:** Before Nov 6, 9 AM (immediately, to set up coordination)

---

## How to Use These Appendices

### For Agents A, B, C, D

1. **Before Nov 6, 9 AM:** Read your assigned appendix completely
2. **Have it open** when executing TaskMaster tasks in Claude Code
3. **Reference specific sections** when implementing features
4. **Share blockers** with Orchestrator if appendix context is insufficient
5. **Update appendix** if you discover new constraints or patterns

### For Orchestrator

1. **Before Nov 6, 9 AM:** Read the coordination appendix completely
2. **Reference the task assignment matrix** when assigning work
3. **Consult the parallel execution map** daily to track critical path
4. **Use resource conflict resolution** strategies when conflicts arise
5. **Follow the communication protocol** for daily standups and escalations

---

## Key Metrics Across All Appendices

### Performance Budgets
- **FPS Impact:** <2% (16.7ms baseline → <17.0ms acceptable)
- **Memory per Node:** <5KB
- **Compilation Time:** <2 seconds per graph
- **Device Latency:** <10ms p99
- **Real-time Communication:** <100ms

### Testing Standards
- **Unit Test Coverage:** ≥95%
- **Integration Test Coverage:** 15 patterns × 50 scenarios
- **Hardware Test Coverage:** 100 boots + 1000 patterns + 24h thermal
- **Boot Cycle Success Rate:** 100/100 (0 failures)
- **Pattern Stress Success Rate:** 1000+ changes with 0 crashes

### Validation Criteria (Decision Gate)
- ✅ All firmware fixes implemented and tested
- ✅ Graph PoC compiling with <2% FPS overhead
- ✅ Graph PoC memory <5KB per node
- ✅ All QA validation protocols passing
- ✅ Evidence package assembled by Nov 13, 8 AM

---

## Cross-References

All appendices reference:
- **PHASE_2_MASTER_PRD.txt** — Source of all task definitions and timelines
- **PATH_A_GRAPH_SYSTEM.txt** — Full 8-week Path A specification (if PoC passes)
- **PATH_B_SDK_FORMALIZATION.txt** — Full 10-week Path B specification (if PoC fails)
- **TaskMaster tasks.json** — Individual task details, subtasks, dependencies

---

## Last Updated

- **Date:** 2025-11-05
- **Status:** READY FOR EXECUTION
- **Validation:** All 5 appendices in place, cross-references verified, links to source PRDs confirmed
- **Next Step:** Agent activation Monday, Nov 6, 9 AM PT

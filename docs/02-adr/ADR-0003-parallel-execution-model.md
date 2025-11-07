---
status: published
author: Task-Planner + Architect-Review
date: 2025-11-05
intent: Execute Phase 2D1 fixes and graph system development in parallel (not sequentially)
---

# ADR-0003: Parallel Execution Model (Phase 2D1 + Graphs)

## Decision

**Execute Phase 2D1 critical fixes and graph system development simultaneously across two independent workstreams.**

- **Timeline:** 12-14 weeks parallel (vs 24 weeks sequential) = 6-8 weeks saved
- **Teams:** Workstream A (2 firmware engineers) + Workstream B (2 architects) + Workstream C (1 QA)
- **Go/No-Go Gate:** Week 2 (Nov 13) based on graph PoC results

## Context

Previous analysis treated Phase 2D1 and graph system as sequential (Phase 2D1 first, then graphs). Dependency mapping showed 95% independence:

- Phase 2D1 fixes actually ENABLE graph system (error handling, timeouts, bounds checking)
- Graph work doesn't block Phase 2D1
- Both can run in complete parallel without resource contention

## Decision

### Workstream A: Phase 2D1 Critical Fixes (Weeks 1-6)
- Remove WiFi credentials
- Fix I2S timeout handling
- Add WebServer bounds checking
- Implement error code infrastructure
- Hardware latency validation
- Stress testing

### Workstream B: Graph System PoC (Weeks 1-3) + Implementation (Weeks 4-12)
- Week 1-2: Architecture design + PoC planning
- Week 2-3: Bloom + Spectrum pattern conversion
- Decision gate (Nov 13): Go/No-Go based on PoC
- If GO: Weeks 4-12 full implementation
- If NO-GO: Weeks 4-6 fallback (C++ SDK + parameter editor)

### Workstream C: Validation & Testing (Weeks 1-14)
- Continuous hardware validation
- Test infrastructure setup
- Graph PoC testing
- Phase C planning

## Validation

**Week 2 Go/No-Go Criteria (ALL must pass):**
- [ ] Bloom pattern converts to graph
- [ ] Spectrum pattern: <2% FPS impact
- [ ] Stateful nodes work on hardware
- [ ] Code generation functional
- [ ] 24-hour stability test passes
- [ ] Memory overhead <5KB per pattern
- [ ] Developer template clear

---
**Decision Date:** November 5, 2025
**References:** PHASE_2D1_GRAPH_PARALLEL_MASTER_STRATEGY.md

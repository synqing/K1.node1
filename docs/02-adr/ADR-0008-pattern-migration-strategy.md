---
status: published
author: Architect-Review
date: 2025-11-05
intent: Strategy for converting hardcoded C++ patterns to node graphs
---

# ADR-0008: Pattern Migration Strategy

## Decision

**Convert existing 15 hardcoded C++ patterns to node graphs using 2-week PoC as validation gate.**

## Pattern Reversibility Findings

- **Total Patterns:** 17 existing (Departure, Lava, Twilight, Spectrum, etc.)
- **Convertible:** 15/17 (88% feasible)
- **Total Nodes:** 159 instances across all patterns
- **Unique Types:** 35-40 node types needed
- **Conversion Effort (Sequential):** 20 weeks
- **Parallel Effort:** 12-14 weeks (with Phase 2D1)

## PoC Strategy (Weeks 2-3)

Convert 2 high-complexity patterns as proof-of-concept:
- **Bloom:** 16 nodes, complex with stateful animation
- **Spectrum:** 22 nodes, audio-reactive with frequency analysis

**PoC Validation Criteria:**
- [ ] Both patterns convert successfully to JSON graphs
- [ ] Code generation JSON→C++ works
- [ ] FPS impact <2% vs original C++
- [ ] Stateful nodes (beat detection) work correctly
- [ ] 24-hour stability test passes
- [ ] Memory overhead <5KB per pattern

## Go/No-Go Decision (Nov 13)

- **If ALL PoC criteria pass:** Proceed to full graph system (35-40 nodes)
- **If ANY PoC criteria fail:** Keep C++ patterns, add parameter-only editor (Option C fallback)

## Migration Phase (Weeks 4-12, if GO)

- Implement remaining 33-38 node types
- Convert all 15 patterns to node graphs
- Integrate with firmware
- Test on hardware

---
**Decision Date:** November 5, 2025
**References:** pattern_codebase_architecture.md, pattern_reversibility_feasibility.md

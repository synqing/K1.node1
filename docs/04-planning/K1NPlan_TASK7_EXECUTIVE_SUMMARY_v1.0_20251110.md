# Task 7 Executive Summary: Bloom Pattern Graph Conversion PoC
## Quick Reference & One-Page Overview

**Version:** 1.0
**Date:** November 10, 2025
**Scope:** Single-pattern PoC (bloom only); validate hypothesis that patterns can be expressed as graphs
**Effort:** 20 hours (1 developer, ~3 working days)

---

## What Is This Task?

**Objective:** Prove that the bloom pattern (currently hand-coded in C++) can be:
1. Expressed as a graph DAG (Directed Acyclic Graph)
2. Validated through a JSON schema
3. Code-generated back to equivalent C++
4. Tested to ensure pixel-perfect LED output matching

**Success = Generated code produces identical LED output as current hand-coded pattern, with no performance regression.**

---

## What Will Be Delivered?

### 1. Bloom Algorithm Analysis
- Breakdown of current `pattern_bloom.cpp` (6 processing stages)
- Identification of 7 nodes: AudioSpectrum → BandShape → BufferPersist → ColorizeBuffer → Mirror → LedOutput
- Clear distinction: hardcoded vs. parameterizable elements

### 2. Complete JSON Graph Definition
```json
{
  "name": "bloom_poc",
  "version": "v1.0",
  "nodes": [
    {"id": "audio_spectrum", "type": "AudioSpectrum"},
    {"id": "band_shape", "type": "BandShape", "inputs": {"src": "audio_spectrum"}, "params": {"gain": 1.0, "decay": 0.92}},
    {"id": "trail", "type": "BufferPersist", "inputs": {"src": "band_shape"}, "params": {"decay": 0.92}},
    {"id": "colorize", "type": "ColorizeBuffer", "inputs": {"index_buf": "trail"}, "params": {"mode": "grayscale"}},
    {"id": "mirror", "type": "Mirror", "inputs": {"src": "colorize"}},
    {"id": "output", "type": "LedOutput", "inputs": {"color": "mirror"}}
  ]
}
```
**Key:** All patterns become graphs. Graphs are declarative, versionable, and regenerable.

### 3. Code Generator Implementation
- Emitter that converts JSON → C++ function
- Topological sort + type inference
- Buffer allocation strategy
- Output: `pattern_bloom_generated.cpp` (identical to hand-coded, but auto-generated)

### 4. Test Harness
- Unit tests: JSON validation, DAG checking, type inference
- Integration tests: Pixel-perfect output comparison (100 frames)
- Performance regression test (must be ≤5% slower than baseline)
- State persistence test (decay verification)

### 5. Documentation Package
- **Main roadmap:** `K1NPlan_TASK7_BLOOM_GRAPH_POC_ROADMAP_v1.0_20251110.md` (10 sections, 30 pages)
- **Detailed examples:** `K1NPlan_TASK7_BLOOM_POC_JSON_AND_EMITTER_v1.0_20251110.md` (JSON, pseudocode, test code)
- **This summary:** Quick reference + checklist

---

## Key Design Decisions

| Decision | Why | Impact |
|----------|-----|--------|
| **7 nodes total** | Matches algorithm stages; simple for PoC | Easy to validate; no branching |
| **JSON over YAML/TOML** | Industry standard; tools abundant | Validator/emitter use standard libraries |
| **Bloom-only (no generalization)** | Tight scope; prove hypothesis first | 20h vs. 40h for multi-pattern framework |
| **Pixel-perfect matching requirement** | Zero tolerance for output drift | Strict validation; high confidence |
| **Explicit state management** | Clarity over automation | Generated code is readable + maintainable |

---

## Success Criteria Checklist

### Must-Have (Blocking)
- [ ] Generated C++ compiles (0 errors, 0 warnings)
- [ ] LED output matches pixel-by-pixel (100 test frames)
- [ ] JSON validates against schema
- [ ] DAG is acyclic (topological sort succeeds)
- [ ] All node inputs resolvable
- [ ] BufferPersist decay works correctly

### Should-Have (Strong)
- [ ] Performance within 5% of baseline
- [ ] All 7 nodes covered by tests
- [ ] Generated code is readable
- [ ] Docs clear enough to extend to 1 other pattern (spectrum)

### Nice-to-Have (Phase 2)
- [ ] Palette-based colorization
- [ ] Parameter UI bindings
- [ ] SIMD optimizations

---

## Implementation Plan (6 Milestones)

| Milestone | What | Hours | Owner |
|-----------|------|-------|-------|
| **1** | Analyze bloom algorithm | 2h | Engineer |
| **2** | Design 7 nodes + IO contracts | 3h | Engineer |
| **3** | Author JSON graph | 2h | Engineer |
| **4** | Implement code emitter | 6h | Engineer |
| **5** | Build test harness | 5h | Engineer |
| **6** | Run tests + handoff | 2h | Engineer |
| **TOTAL** | **Full PoC** | **20h** | 1 Developer |

**Timeline:** 3 working days (1 week with reviews/iterations)

---

## Why This Matters

**Current State:**
- Patterns are hand-coded C++ functions
- Hard to version, test, or extend
- No declarative interface for pattern authors
- Audio-reactive logic tightly coupled to rendering

**After PoC:**
- Patterns become data (JSON graphs)
- Compile-time validation before code gen
- Easy to author via UI (future)
- Decoupled logic + rendering
- Version control-friendly (diffs are readable)

**Vision (Phase 2+):**
- Web-based graph editor
- Pattern library + sharing
- Automatic performance budgeting
- Multi-pattern composition (blend, mask, layer)

---

## Effort Breakdown (20 Hours)

```
Algorithm Analysis          2h ████
Node Design                 3h ██████
JSON Authoring              2h ████
Code Emitter Implementation 6h ████████████
Test Harness                5h ██████████
Validation & Handoff        2h ████
                           ─────
TOTAL                      20h
```

**Per milestone:** ~3.3 hours average
**Longest phase:** Code emitter (6h) — most complex, test-driven

---

## Risks & Mitigations

| Risk | Severity | Mitigation | Fallback |
|------|----------|-----------|----------|
| Type system incomplete | MEDIUM | Start with simple types; extend | Manual casting in emitter |
| State struct too rigid | LOW | Use existing `persist_buf[]` field | Heap allocation (complex) |
| Code gen edge cases | MEDIUM | Hard-code 7 nodes; generalize later | Hand-code node emitters |
| Performance regression | LOW | Use graph_runtime.h helpers; no copies | Accept if <5%; optimize later |

---

## Related Documents

### Core References
- **Graph Schema Spec:** `docs/06-reference/GRAPH_SCHEMA_SPEC.md`
- **Node Catalog:** `docs/06-reference/K1NRef_GRAPH_NODE_CATALOG_EXPANDED_v2.0_20251110.md`
- **Current Pattern:** `firmware/src/graph_codegen/pattern_bloom.cpp`
- **Runtime Helpers:** `firmware/src/graph_codegen/graph_runtime.h`

### Task 7 Deliverables (This Package)
1. **Main Roadmap:** `K1NPlan_TASK7_BLOOM_GRAPH_POC_ROADMAP_v1.0_20251110.md` (10 sections)
2. **JSON + Emitter Details:** `K1NPlan_TASK7_BLOOM_POC_JSON_AND_EMITTER_v1.0_20251110.md` (Section 2–8)
3. **This Summary:** `K1NPlan_TASK7_EXECUTIVE_SUMMARY_v1.0_20251110.md`

---

## Quick Q&A

**Q: Why only bloom?**
A: Tight PoC scope validates the hypothesis without overcommitting. After success, the framework can be generalized to other patterns (spectrum, waveform, etc.).

**Q: Will generated code be as fast as hand-coded?**
A: Yes, within 5%. Both use the same `graph_runtime.h` helpers. No algorithmic overhead, only buffer allocation (negligible).

**Q: What happens to hand-coded pattern_bloom.cpp?**
A: Remains as baseline for testing. After PoC passes, can be replaced with generated code or kept for reference.

**Q: Can I parameterize the decay or color?**
A: Yes. Current PoC uses hardcoded JSON values (decay: 0.92, grayscale). To expose as user controls, use `ParamF` nodes (Phase 2).

**Q: What if I want to add more nodes (blur, shift, etc.)?**
A: Create new JSON graph, add nodes from catalog, re-run emitter. No C++ coding needed (that's the point).

**Q: How is this different from current patterns?**
A: Current = imperative C++ code. Graph = declarative DAG + JSON schema + code gen. Benefits: versionable, testable, data-driven.

---

## Getting Started

1. **Read the main roadmap** (Part 1–2): Understand bloom algorithm and node design
2. **Review the JSON example** (Part 3): See what a graph looks like
3. **Examine the emitter pseudocode** (Section 2 of supporting doc): Understand code generation flow
4. **Start Milestone 1:** Analyze current `pattern_bloom.cpp` line-by-line

---

## Key Contacts & Escalation

| Role | Responsibility |
|------|-----------------|
| **Task Owner** | Claude Code / Engineering (this document) |
| **Architecture Review** | ADR-0006 (Graph Compilation Architecture) |
| **Runtime Integration** | firmware team (graph_runtime.h, stateful_nodes.h) |
| **Validation** | QA / test automation |

---

## Sign-Off Template

**When complete, fill this out:**

```
PoC Status: [ ] PASS  [ ] CONDITIONAL  [ ] FAIL

Blockers: (none / list here)

Performance Delta: (baseline_ms vs. generated_ms)

Test Coverage: (X out of 7 nodes, Y out of 100 frames)

Lessons Learned:
- (1)
- (2)
- (3)

Next Phase Recommendations:
- (Phase 2 candidate 1)
- (Phase 2 candidate 2)
```

---

**Version History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-10 | Claude Code | Initial summary (all sections) |

---

**End of Executive Summary**

For full details, see main roadmap: `K1NPlan_TASK7_BLOOM_GRAPH_POC_ROADMAP_v1.0_20251110.md`

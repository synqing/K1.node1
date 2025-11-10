# Task 8: Spectrum Pattern Graph Conversion PoC - Executive Summary

**Status:** Planning Complete
**Date:** 2025-11-10
**Duration:** 28-36 hours (4-5 days, full-time)
**Complexity:** High (Audio DSP + Code Generation)
**Risk Level:** Medium (hardware audio integration dependency)

---

## Overview

Task 8 requires converting **pattern_spectrum.cpp** (audio-reactive Goertzel FFT visualization) into a graph-based representation and generating optimized C++ code from that graph.

This validates that the graph model can handle **streaming, stateful, DSP-intensive patterns** — significantly more complex than Task 7 (bloom).

### Key Differences from Task 7 (Bloom)

| Aspect | Task 7 (Bloom) | Task 8 (Spectrum) |
|--------|---|---|
| **Pattern Type** | Static time-based | Audio-reactive streaming |
| **Data Source** | Time parameter | Goertzel FFT (async audio) |
| **State Persistence** | One decay buffer | Audio metadata + smoothing history |
| **Node Types** | 3-4 simple | 6+ including DSP nodes |
| **Buffer Complexity** | Single persistent | Multiple (spectrum, smoothed, normalized) |
| **Synchronization** | None needed | Audio freshness tracking, stale detection |
| **Code Generation** | Straightforward | Conditional audio handling required |

---

## Deliverables Checklist

### M1: Analysis & Schema Definition
- [ ] Algorithm summary (1 page) with frequency mapping
- [ ] Audio node requirements document
- [ ] JSON graph schema with full examples
- [ ] Code generation template document

### M2: Node Type Library
- [ ] Updated `graph_runtime.h` with 6 node types
- [ ] Audio input, normalize, extract, smoothing nodes
- [ ] Extended `PatternState` struct
- [ ] All code compiles without warnings

### M3: JSON Graph Schema
- [ ] Complete schema document (GRAPH_SCHEMA_SPECTRUM.md)
- [ ] 4+ working example graphs (basic, bass, absolute+smooth, treble)
- [ ] Audio data flow specification
- [ ] Frequency bin reference and band mapping

### M4: Code Generation Engine
- [ ] Python codegen script (`codegen_spectrum.py`)
- [ ] Supports all 6 node types + parameters
- [ ] Generated code compiles and links
- [ ] Test cases: different palettes, bands, LED counts

### M5: Integration & Testing
- [ ] Build system integration (CMake or platformio)
- [ ] Audio test harness with mock snapshots
- [ ] Performance benchmarks (<320 µs/frame)
- [ ] Comparison vs. hand-written reference

### M6: Unit Tests & Documentation
- [ ] Comprehensive test suite (>90% coverage)
- [ ] Implementation guide
- [ ] Architecture Decision Record (ADR)
- [ ] All tests pass, documentation complete

---

## Effort Breakdown

```
Milestone 1 (Analysis & Schema)      6-8 hours
├─ Algorithm analysis                2 hours
├─ Audio node requirements           2 hours
├─ Schema design                     2-3 hours
└─ Code generation strategy          2 hours

Milestone 2 (Node Library)           4-5 hours
├─ Audio input node                  1.5 hours
├─ Frequency normalize               1 hour
├─ Band extract                      1 hour
├─ Extend existing nodes             1.5 hours
└─ Update PatternState               1 hour

Milestone 3 (Graph Schema)           3-4 hours
├─ JSON schema document              1.5 hours
├─ Example graphs (4 variants)       1 hour
├─ Audio data flow spec              1.5 hours
└─ Validation/testing                1 hour (optional)

Milestone 4 (Code Generation)        6-8 hours
├─ Code emitter design               2 hours
├─ Full implementation               2.5 hours
├─ Testing with examples             1.5 hours
└─ Optimization & readability        1.5 hours

Milestone 5 (Integration & Testing)  5-6 hours
├─ Build integration                 1.5 hours
├─ Audio test harness                2 hours
├─ Real audio testing                1.5 hours
└─ Performance validation            1 hour

Milestone 6 (Tests & Docs)           4-5 hours
├─ Unit tests (node types)           2 hours
├─ Code gen quality tests            1 hour
├─ Implementation guide              1.5 hours
└─ ADR + final review                1.5 hours

TOTAL: 28-36 hours (4-5 days, full-time)
```

---

## Success Criteria (Final Gate)

All items must pass before declaring PoC complete:

### Code Quality
- [ ] Generated C++ compiles without warnings
- [ ] All 6 node types implemented and testable
- [ ] Code coverage > 90%
- [ ] No buffer overflows or undefined behavior

### Correctness
- [ ] Output matches hand-written reference pattern
- [ ] Spectrum normalization (auto-range, absolute) correct
- [ ] Band extraction downsamples accurately
- [ ] Color mapping follows palette
- [ ] Audio freshness detection works

### Performance
- [ ] Render time < 320 µs/frame (< 2% of 16 ms budget)
- [ ] Memory < 5 KB per pattern
- [ ] Audio latency ≤ 20 ms (fresh data within 2 frames)
- [ ] No performance regressions vs. hand-written

### Testing
- [ ] Unit tests: 100% pass
- [ ] Integration test: audio sync validation
- [ ] Edge cases: silence, max loudness, stale data
- [ ] Real hardware test (if available)

### Documentation
- [ ] Implementation guide complete
- [ ] ADR written and reviewed
- [ ] 4+ graph examples in schema
- [ ] Audio data flow documented
- [ ] Frequency bin reference included

---

## Dependencies & Blockers

### External Dependencies (All Provided)
1. **Goertzel FFT** (`firmware/src/audio/goertzel.h`) ✓ Available
2. **Pattern Audio Interface** (`pattern_audio_interface.h`) ✓ Available
3. **Graph Runtime** (`graph_runtime.h`) ✓ Available (extend in M2)
4. **Stateful Nodes** (`stateful_nodes.h`) ✓ Available (extend in M2)

### Build Dependencies
- Python 3.8+ (code generation)
- CMake or platformio.ini (build integration)
- pytest (optional, codegen testing)

### Critical Blockers

| Blocker | Impact | Mitigation |
|---------|--------|-----------|
| Real audio hardware not available | Can't validate sync timing | Use mock audio data (frequency ramp, synthetic beats) |
| Goertzel FFT buffer format unclear | Can't integrate correctly | Document struct layout in M1 analysis |
| Performance regression | Misses budget | Profile early (M4), optimize node templates if needed |
| Code gen correctness | Generated code fails | Heavy unit testing in M6, diff vs. reference in M5 |

### Straightforward Items (Low Risk)
- JSON schema design (well-defined problem)
- Python code generation (standard template approach)
- Node type definitions (clear from existing graph_runtime.h)
- Documentation (can be written incrementally)

---

## Risk Assessment

### High-Risk Items
1. **Audio Synchronization** (M5)
   - Risk: Real audio latency/freshness doesn't match simulation
   - Mitigation: Mock audio harness in M5 (can test without hardware)
   - Fallback: Use existing pattern_audio_interface macros (proven interface)

2. **Code Generation Correctness** (M4)
   - Risk: Generated code has subtle bugs or inefficiencies
   - Mitigation: Heavy testing (M4, M6), diff vs. hand-written (M5)
   - Fallback: Manual codegen validation before deployment

3. **Performance Budget** (M5)
   - Risk: Generated code exceeds 320 µs/frame target
   - Mitigation: Profile during M4, optimize node templates
   - Fallback: Node fusion optimization (combine small nodes)

### Medium-Risk Items
- Node type completeness (need all 6 for full spectrum pattern)
- Build system integration (cmake/platformio changes)
- Documentation coverage (ensures maintainability)

### Low-Risk Items
- Schema design (JSON is simple, well-understood)
- Python scripting (standard approach)
- Unit testing framework (gtest available in firmware)

---

## Timeline Estimate (Optimistic vs. Realistic)

### Best Case (28 hours, 3.5 days)
- Minimal blockers encountered
- Code generation template works first time
- Performance budget easily met
- Documentation written concisely

### Realistic Case (32 hours, 4 days)
- Audio sync testing requires 1-2 iterations
- Code generation needs refinement for edge cases
- Performance profiling adds 1-2 hours
- Documentation detailed but manageable

### Worst Case (36 hours, 4.5 days)
- Audio hardware unavailable; need full mock harness
- Code generation requires major refactoring
- Performance regression; need node fusion optimization
- Extensive documentation + ADR review cycles

---

## Success Scenario

On completion of Task 8 PoC:

1. **Graph Representation Works**
   - Spectrum pattern fully expressible in JSON graph
   - All DSP operations (normalize, extract, smooth) representable
   - Audio data flow clearly modeled

2. **Code Generation Works**
   - Python script converts graph → C++ in <1 second
   - Generated code compiles without warnings
   - Output behavior identical to hand-written reference

3. **Performance Validated**
   - Render time < 320 µs/frame
   - Memory < 5 KB per pattern
   - No audio latency degradation

4. **Testing Comprehensive**
   - Unit tests for all node types (>90% coverage)
   - Integration test validates audio sync
   - Performance benchmarks documented

5. **Documentation Complete**
   - Implementation guide with examples
   - ADR explaining architecture decisions
   - Schema with 4+ working examples
   - Frequency bin reference for users

### Outcome for Project
- **Graph model validated** for audio-reactive, DSP-intensive patterns
- **Code generation pipeline proven** as viable pattern authoring tool
- **Foundation for Task 9+**: Can build more complex patterns (beat detection, multi-band, etc.)
- **Feasibility of visual graph editor** confirmed (schema + codegen = programmatic pattern creation)

---

## Failure Modes & Recovery

### Scenario: Audio Synchronization Fails
**If**: Real audio latency > 50 ms or freshness detection doesn't work
**Then**: Fall back to mock audio harness (synthetic frequency ramps)
**Recovery**: Use existing pattern_audio_interface (proven interface); document assumptions
**Time Impact**: +2-4 hours (develop better mock harness)

### Scenario: Code Generation Incorrect
**If**: Generated code produces wrong colors or misses nodes
**Then**: Debug with simple 2-node graph (audio → output)
**Recovery**: Validate codegen template logic, test each node type independently
**Time Impact**: +3-5 hours (comprehensive testing)

### Scenario: Performance Budget Exceeded
**If**: Generated code > 500 µs/frame (> 3% of budget)
**Then**: Profile to find bottleneck (likely normalization or gradient mapping)
**Recovery**: Optimize node templates (inline functions, loop unrolling, buffer pooling)
**Time Impact**: +2-3 hours (optimization)

### Scenario: Build Integration Complex
**If**: CMake/platformio integration more difficult than expected
**Then**: Start with manual build (generate code, link manually)
**Recovery**: Defer automated build integration to post-PoC phase
**Time Impact**: -2 hours (skip integration, declare PoC "conceptual")

---

## Post-PoC Roadmap

Once Task 8 is validated:

### Immediate (Next 1-2 weeks)
- Review PoC with team (design review, ADR approval)
- Gather feedback on graph schema (missing node types, parameters)
- Plan Task 9 (more complex patterns: beat detection, multi-band)

### Short Term (1-2 months)
- Extend node library (smoothing, thresholding, beat detection)
- Build UI graph editor (Tauri/Electron frontend)
- Auto-optimization passes (node fusion, buffer pooling)

### Medium Term (3-6 months)
- Production pattern library (verified, optimized)
- Real-time graph reloading (on-device compilation)
- Performance profiler integration (telemetry)

### Long Term (6-12 months)
- Community pattern sharing (pattern marketplace)
- Visual pattern composition tools (drag-drop graph builder)
- Machine learning-based pattern generation

---

## Team Assignments (Hypothetical)

**If** this were a team task:

- **Architect** (M1): Algorithm analysis, schema design, code gen strategy
- **Backend** (M2-M3): Node definitions, JSON schema, examples
- **Code Generator** (M4): Python codegen script, templates
- **Test Engineer** (M5-M6): Audio test harness, unit tests, performance benchmarks
- **Documentation** (M3, M6): Implementation guide, ADR, examples

**This PoC assumes single-developer execution** (4-5 days, uninterrupted).

---

## References

### Key Files to Study
1. `/firmware/src/graph_codegen/pattern_spectrum.cpp` - Current stub
2. `/firmware/src/graph_codegen/pattern_bloom.cpp` - Simpler reference
3. `/firmware/src/audio/goertzel.h` - FFT algorithm details
4. `/firmware/src/pattern_audio_interface.h` - Audio snapshot interface
5. `/firmware/src/graph_codegen/graph_runtime.h` - Helper functions

### Documentation Generated (This Roadmap)
1. `K1NPlan_TASK_8_SPECTRUM_GRAPH_POC_ROADMAP_v1.0_20251110.md` - Full roadmap (main document)
2. `SPECTRUM_GRAPH_SCHEMA_AND_EXAMPLES.json` - JSON schema + 4 examples
3. `K1NPlan_TASK_8_EXECUTIVE_SUMMARY_v1.0_20251110.md` - This summary

### Tests to Implement
- `/firmware/test/test_spectrum_nodes.cpp` - Unit tests per node type
- `/firmware/test/test_spectrum_audio_flow.cpp` - Integration tests

### Tools to Build
- `/firmware/tools/codegen_spectrum.py` - Code generation script

---

## Approval Gate

This roadmap is ready for implementation when:

- [ ] Team has reviewed and approved scope
- [ ] Hardware audio setup confirmed (or mocks agreed upon)
- [ ] Build system integration approach finalized
- [ ] Developer time allocated (4-5 days, uninterrupted)
- [ ] M1 analysis documents assigned/approved

**Estimated Start**: After Task 7 (Bloom) completion
**Estimated Finish**: 4-5 days after start
**Milestone Cutoff**: Weekly reviews at M3 (schema finalized) and M5 (integration complete)

---

## Quick Reference: Node Types

```
1. AudioSnapshot      → 64-float spectrum array (fresh/stale tracking)
2. FrequencyNormalize → Auto-range OR absolute loudness
3. BandExtract        → Downsample spectrum to LED count
4. FrequencySmoothing → IIR exponential moving average (optional)
5. GradientMap        → Scalar → color palette lookup
6. Mirror             → Flip buffer vertically
7. LedOutput          → Terminal: float RGB → uint8_t device write
```

---

## Quick Reference: Example Graphs

```json
// Basic spectrum (full, hot colormap)
audio → normalize → extract(0-63) → gradient_map(hot) → mirror → output

// Bass only (cool colormap)
audio → normalize → extract(0-16) → gradient_map(cool) → mirror → output

// Absolute + smooth (fire colormap)
audio → normalize(absolute) → smooth(0.7) → extract(0-63) → gradient_map(fire) → mirror → output

// Treble (viridis colormap)
audio → normalize → extract(48-63) → gradient_map(viridis) → mirror → output
```

---

## Contact & Questions

For clarifications on this roadmap:
1. Review the full task document: `K1NPlan_TASK_8_SPECTRUM_GRAPH_POC_ROADMAP_v1.0_20251110.md`
2. Check schema examples: `SPECTRUM_GRAPH_SCHEMA_AND_EXAMPLES.json`
3. Ask specific questions about node types, performance, or testing strategy

---

**Document Version:** 1.0
**Status:** Ready for Review & Approval
**Last Updated:** 2025-11-10

---

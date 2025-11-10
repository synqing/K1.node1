# ADR-0017: Look-Up Table (LUT) Optimization System

**Status:** proposed
**Date:** 2025-11-07
**Decision makers:** Firmware Team
**Technical lead:** Claude Code

---

## Context

The K1.node1 firmware operates under strict real-time constraints on resource-limited hardware (ESP32-S3 dual-core @ 240 MHz). Performance profiling identified that mathematical operations in the rendering pipeline consume 40-50% of CPU time on Core 0, preventing the system from achieving its 120+ FPS target. Three categories of computation were identified as primary bottlenecks:

1. **Easing functions**: Polynomial evaluations (t², t³, t⁴) called 180× per frame
2. **HSV color conversion**: Complex branching logic with 50-70 operations per pixel
3. **Palette interpolation**: Linear interpolation calculations for gradient mapping

Current implementation achieves only 78 FPS average, with frame drops during complex patterns. Audio processing on Core 1 remains unaffected but pattern rendering on Core 0 is CPU-bound.

### Problem Statement

**How can we eliminate mathematical computation bottlenecks in the LED rendering pipeline without sacrificing visual quality or requiring hardware upgrades?**

Constraints:
- Must maintain API compatibility with existing pattern code
- Cannot exceed 20 KB additional memory footprint
- Must achieve 120+ FPS stable performance
- Maximum acceptable accuracy loss: ±0.5% (imperceptible on LEDs)

---

## Decision

**We will implement a comprehensive Look-Up Table (LUT) system that pre-computes expensive mathematical operations during initialization and replaces runtime calculations with simple array lookups.**

### Implementation Approach

1. **Pre-computation Strategy**
   - Calculate all values once during `setup()` (4ms overhead acceptable)
   - Store results in global arrays with 256-entry resolution
   - Provide inline accessor functions maintaining original API

2. **Memory Allocation**
   - Easing LUTs: 10 curves × 256 × 4 bytes = 10 KB
   - HSV Hue Wheel: 256 × 12 bytes = 3 KB
   - Palette Caches: 2 KB (dynamic, per-pattern)
   - Total: ~15 KB (within 20 KB budget)

3. **Integration Method**
   - Create parallel API (`*_fast()` functions)
   - Drop-in replacement via header macros
   - No changes required to pattern implementations

---

## Alternatives Considered

### Alternative 1: Inline Assembly Optimization
**Approach**: Hand-optimized assembly for critical math functions
**Pros**: No memory overhead, maximum theoretical performance
**Cons**: Platform-specific, difficult to maintain, limited improvement (~10-15%)
**Verdict**: Rejected - insufficient performance gain for maintenance cost

### Alternative 2: Fixed-Point Arithmetic
**Approach**: Replace floating-point with Q16.16 fixed-point math
**Pros**: Faster on FPU-less systems, deterministic timing
**Cons**: ESP32-S3 has hardware FPU, requires extensive code changes
**Verdict**: Rejected - no benefit on target hardware

### Alternative 3: GPU Offloading
**Approach**: Use ESP32-S3's LCD controller as primitive GPU
**Pros**: Parallel computation potential
**Cons**: LCD controller lacks general compute capability
**Verdict**: Rejected - hardware doesn't support this use case

### Alternative 4: Pattern Complexity Reduction
**Approach**: Simplify patterns to reduce computation
**Pros**: Zero overhead, guaranteed to work
**Cons**: Degrades visual quality, limits creativity
**Verdict**: Rejected - violates product requirements

### Alternative 5: JIT Compilation
**Approach**: Compile pattern code at runtime for optimization
**Pros**: Could optimize across pattern boundaries
**Cons**: Massive complexity, memory overhead, no ESP32 JIT support
**Verdict**: Rejected - not feasible on embedded platform

---

## Consequences

### Positive Consequences

1. **Performance Gains**
   - Frame rate: 78 → 139 FPS (+78%)
   - CPU usage: 78% → 51% (-35%)
   - Frame time: 12.8ms → 7.2ms (-44%)
   - Power consumption: -19% during rendering

2. **System Benefits**
   - Consistent frame timing (no jitter)
   - Headroom for more complex patterns
   - Reduced thermal load
   - Better battery life in portable configurations

3. **Developer Experience**
   - No changes needed to existing patterns
   - Simple integration (one function call in setup)
   - Easy to validate (accuracy tests included)
   - Performance gains without complexity

### Negative Consequences

1. **Memory Usage**
   - +15 KB RAM permanently allocated
   - Reduces available memory for other features
   - May limit maximum pattern count

2. **Initialization Overhead**
   - +4ms boot time
   - Must run before pattern system
   - Cannot be deferred or lazy-loaded

3. **Accuracy Trade-offs**
   - ±0.4% error in computed values
   - Discrete steps (256 levels) vs. continuous
   - Potential for aliasing in extreme cases

### Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|-----------|
| Cache thrashing with audio | Low | High | Place LUTs in different memory region |
| Accuracy issues visible | Very Low | Medium | 256-level resolution exceeds LED bit depth |
| Memory exhaustion | Low | High | Reserve 5KB buffer, can reduce LUT size if needed |
| Integration breaks patterns | Very Low | High | Extensive testing, compatibility macros |

---

## Validation Criteria

The LUT system will be considered successful if:

1. **Performance Metrics**
   - [ ] Achieve 120+ FPS on standard patterns
   - [ ] Reduce Core 0 CPU usage below 60%
   - [ ] Eliminate frame drops during pattern transitions

2. **Accuracy Metrics**
   - [ ] Maximum error < 0.5% vs. computed values
   - [ ] No visible artifacts in gradients
   - [ ] Color accuracy within 1 JND (Just Noticeable Difference)

3. **Integration Metrics**
   - [ ] Zero changes required to existing patterns
   - [ ] Build succeeds with no warnings
   - [ ] Memory usage within 20KB budget

4. **Stability Metrics**
   - [ ] 24-hour burn-in test with no crashes
   - [ ] Pattern switching 1000× without memory leaks
   - [ ] Survives power cycling and WiFi disconnects

---

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
- Create LUT header files and initialization functions
- Implement easing function tables
- Unit tests for accuracy validation

### Phase 2: Color System (Week 1)
- Implement HSV hue wheel LUT
- Create fast color conversion functions
- Benchmark against original implementation

### Phase 3: Integration (Week 2)
- Update main.cpp initialization sequence
- Add compatibility macros to pattern headers
- Profile system-wide performance

### Phase 4: Validation (Week 2)
- Accuracy testing suite
- Performance benchmarks
- 24-hour stability test
- Power consumption measurement

---

## References

- [LUT System Architecture](../01-architecture/K1NArch_SPEC_LUT_SYSTEM_ARCHITECTURE_v1.0_20251108.md)
- [LUT Optimization Analysis](../05-analysis/K1NAnalysis_ANALYSIS_LUT_OPTIMIZATION_v1.0_20251108.md)
- [ESP32-S3 Technical Reference Manual](https://www.espressif.com/sites/default/files/documentation/esp32-s3_technical_reference_manual_en.pdf)
- Research: "Energy-Efficient Approximation Techniques for Embedded Systems" (IEEE 2019)
- Prior Art: FastLED library RainbowColors_p implementation

---

## Decision Record

**Decision:** Approved for implementation
**Date:** 2025-11-07
**Review cycle:** 3 months post-deployment

### Sign-offs
- Technical Lead: ✓ (Performance gains justify memory cost)
- Firmware Team: ✓ (Implementation feasible within timeline)
- QA Team: (Pending - awaiting test plan review)

### Amendment History
- 2025-11-07: Initial proposal and decision

---
title: ADR-0020: Code Generation Architecture for Pattern Implementation
status: proposed
version: v1.0
owner: Spectrasynq (Architect)
reviewers: [Firmware Engineering Lead, Audio Systems Expert]
last_updated: 2025-11-10
next_review_due: 2026-02-10
tags: [architecture, code-generation, pattern-system, firmware, compilation]
related_docs:
  - docs/02-adr/ADR-0006-codegen-abandonment.md
  - docs/02-adr/ADR-0008-pattern-migration-strategy.md
  - docs/09-implementation/K1NImpl_NODE_IMPLEMENTATION_CHECKLIST_v1.0_20251110.md
  - docs/01-architecture/K1NArch_ASSESSMENT_STATEFUL_NODE_FEASIBILITY_v1.0_20251108.md
---

<!-- markdownlint-disable MD013 -->

# ADR-0020: Code Generation Architecture for Pattern Implementation

**Status:** Proposed
**Date:** 2025-11-10
**Author:** @spectrasynq (K1 Architect)
**Decision Required By:** 2025-11-17

**References:**
- ADR-0006: Codegen Architecture Decision (Strategic reversal to restore graph compilation)
- ADR-0008: Pattern Migration Strategy (PoC approach for converting patterns)
- Graph Runtime Implementation: `firmware/src/graph_codegen/`
- Pattern Template: `firmware/src/graph_codegen/pattern_template.cpp`
- Stateful Node Feasibility Study: `docs/01-architecture/K1NArch_ASSESSMENT_STATEFUL_NODE_FEASIBILITY_v1.0_20251108.md`

---

## Context

### The Pattern Code Generation Challenge

K1.node1 patterns require efficient, zero-overhead execution on embedded hardware while maintaining flexibility for developers to create new visual effects. This creates a fundamental tension:

**The Flexibility vs. Performance Trade-off:**
- **Manual C++ Patterns:** Hand-written code is fast and expressive but high barrier to entry (requires C++ expertise)
- **Graph-Based Patterns:** Node graphs are accessible to non-programmers but face challenges with stateful operations (beat history, frequency analysis, temporal persistence)
- **Code Generation:** Compile-time code generation from graph definitions bridges both approaches—graphs for accessibility, C++ for performance

### Current State

The K1.node1 codebase contains a **partially implemented code generation system** that remains largely unused:

**What Exists:**
- Graph runtime infrastructure: `firmware/src/graph_codegen/graph_runtime.h` (buffer operations, helper functions)
- Pattern template structure: `firmware/src/graph_codegen/pattern_template.cpp` (documented standard form)
- Two generated pattern examples: `pattern_bloom.cpp` and `pattern_spectrum.cpp` (PoC implementations)
- Stateful node support framework: `firmware/src/stateful_nodes.h` (beat detection, frequency buffers, filters)
- Pattern parameters interface: `firmware/src/parameters.h` (UI parameter binding)

**What's Missing:**
- TypeScript/JavaScript code generator (referenced in codegen/ but incomplete)
- Formal JSON graph schema and validation
- Comprehensive node library documentation
- Integration tests for generated code
- Developer tooling for pattern authoring

### Why This Matters

**Strategic Context (from ADR-0006):**
The decision to restore graph compilation as the core product USP requires establishing clear architectural patterns for:
1. How patterns are generated from graph definitions
2. When to use code generation vs. hand-written patterns
3. How to maintain consistency across generated code
4. How to ensure performance guarantees without manual optimization

---

## Decision

### DECISION: Hybrid Code Generation Architecture

**We will implement a multi-tier code generation system that supports both machine-generated and hand-written patterns, with clear guidelines for when each approach is optimal.**

### Three-Tier Pattern Architecture

#### Tier 1: Machine-Generated Patterns (Primary Path)

**Definition:** Patterns generated from JSON node graphs via TypeScript compiler

**When to use:**
- Stateless or simply-stateful patterns (solid colors, gradients, scrolling effects)
- Audio-reactive patterns with beat detection and frequency analysis
- Patterns requiring tight performance budgets (<0.5ms per frame)
- Patterns targeting community marketplace (accessibility for non-programmers)

**Advantages:**
- Compile-time optimization (no runtime interpretation)
- Zero runtime overhead vs. hand-written C++
- Consistent code structure and error handling
- Easy validation and testing (schema-driven)
- Platform for pattern marketplace (JSON→C++ pipeline)

**Implementation Constraints:**
- Graph must be acyclic (prevent infinite loops)
- Node execution order determined by topological sort
- Stateful nodes pre-allocated with bounded buffers
- No dynamic memory allocation in hot path
- Single `get_audio_snapshot()` call per frame

#### Tier 2: Hand-Written Pattern SDK (Secondary Path)

**Definition:** C++ patterns written directly with standard SDK templates and conventions

**When to use:**
- Complex patterns requiring custom logic (particle systems, physics simulations)
- Patterns with algorithm-specific optimizations
- Educational examples and quick prototypes
- Fallback when graph approach proves insufficient

**Advantages:**
- Maximum expressiveness and control
- No code generation pipeline required
- Familiar to experienced C++ developers
- Can be incrementally migrated to graphs

**Disadvantages:**
- Requires C++ expertise
- Manual performance optimization
- Excluded from pattern marketplace (non-programmers)
- Higher maintenance burden

#### Tier 3: Hybrid Patterns (Escape Hatch)

**Definition:** Patterns that combine generated core logic with hand-written optimizations

**When to use:**
- Performance-critical patterns requiring final optimizations
- Patterns with complex state initialization
- Temporary workarounds during graph system development

**Guidelines:**
- Generated code forms 80%+ of final pattern
- Hand-written code limited to clearly-delineated sections
- Use macros and templates to maintain consistency

---

## Code Generation Pipeline Architecture

### Phase 1: Graph Definition (Developer)

Developer creates or edits JSON graph file describing pattern structure:

```json
{
  "name": "bloom_pattern",
  "version": "1.0",
  "nodes": [
    {
      "id": "time",
      "type": "Time",
      "config": { "scale": 1.0 }
    },
    {
      "id": "persist",
      "type": "BufferPersist",
      "config": { "decay": 0.92 }
    },
    {
      "id": "output",
      "type": "LedOutput"
    }
  ],
  "edges": [
    { "source": "time", "target": "persist" },
    { "source": "persist", "target": "output" }
  ]
}
```

### Phase 2: Code Generation (k1c Compiler)

TypeScript compiler performs:

1. **Validation:**
   - Schema conformance (JSON structure)
   - Acyclicity check (prevent cycles)
   - Type checking (node inputs/outputs compatible)
   - Resource bounds (memory, buffer sizes)

2. **Analysis:**
   - Topological sort (execution order)
   - Data dependency graph
   - Buffer allocation planning
   - Stateful node identification

3. **Code Emission:**
   - Generate C++ pattern function (`pattern_{name}_render`)
   - Declare temporary/persistent buffers
   - Emit node computation calls in order
   - Apply color clamping and output formatting
   - Generate init/cleanup functions

### Phase 3: Compilation (Firmware Build)

Standard PlatformIO/Arduino build process:

1. Include generated pattern file: `#include "generated_patterns/{name}.cpp"`
2. Link with pattern registry: `firmware/src/pattern_registry.cpp`
3. Compile with optimization flags: `-O2 -flto`
4. Validate binary size and performance

### Phase 4: Registration (Runtime)

Pattern register system discovers and registers at boot:

```cpp
// Pattern registry lookup by name or ID
PatternRenderFunc get_pattern(const char* name);
void register_pattern(const char* name, PatternRenderFunc fn);
```

---

## Node Library & Code Generation Guidelines

### Node Type Categories

#### Pure Nodes (Stateless)

No persistent state between frames. Safe to reorder if dependencies allow.

**Examples:**
- `Time` — Frame counter / elapsed time
- `AudioSpectrum` — Current frequency spectrum snapshot
- `Add`, `Multiply`, `Clamp` — Mathematical operations
- `HsvToRgb` — Color space conversion
- `Fill` — Fill buffer with constant color
- `Blur` — Spatial blur operation
- `Gradient` — Interpolate between colors

**Code Generation:**
```cpp
float result = tmp_time[0] + tmp_audio[0];  // Add node
```

#### Stateful Nodes (Persistent)

Maintain state across frames. State pre-allocated and reused.

**Examples:**
- `LowPass` — Simple low-pass filter
- `BeatDetector` — Peak detection for beat sync
- `BufferPersist` — Exponential decay buffer
- `FrequencyBins` — Frequency analysis state
- `History` — Ring buffer for temporal analysis

**Code Generation:**
```cpp
// Update state at end of frame
state.lowpass_states[0] = 0.9 * state.lowpass_states[0] + 0.1 * input_value;
```

#### Terminal Nodes (Output)

Must appear exactly once per graph. Final output transformation.

**Examples:**
- `LedOutput` — Write to hardware (with clamping)
- `DebugDump` — Write to console (dev only)

**Code Generation:**
```cpp
for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {
    CRGBF c = clamped_rgb(final_buf[i]);
    out.leds[i][0] = (uint8_t)std::floor(c.r * 255.0f + 0.5f);
    // ... repeat for G, B
}
```

### Code Generation Invariants

**Memory Layout:**
- Temporary buffers allocated on stack (bounded <16 KB per pattern)
- Persistent state pre-allocated in `PatternState` struct
- No dynamic allocation (`malloc`, `new`) in hot path

**Execution:**
- Nodes executed in topological order (dependencies resolved)
- Single `get_audio_snapshot()` call per frame (expensive operation)
- State updated at end of render (atomic w.r.t. frame timing)

**Performance:**
- <0.5ms per frame @ 256 LEDs, 30 FPS target
- Zero runtime interpretation (pure compiled C++)
- Inline-eligible functions for critical paths

**Safety:**
- Color values clamped to [0.0, 1.0] before output
- Array bounds validated at code generation time
- Enum-based node selection (no string matching at runtime)

---

## Consequences

### Positive Consequences

- **Accessibility:** Non-programmers can create patterns via graph UI
- **Performance:** Compiled C++ guarantees zero runtime overhead vs. hand-written code
- **Consistency:** Generated code follows standard patterns (easy to audit, review)
- **Marketplace:** JSON graphs can be shared, versioned, and composed
- **Validation:** Schema-driven approach catches errors early (compile time)
- **Maintainability:** Generated code is mechanical—easy to update generator to fix bugs across all patterns
- **Learning Curve:** Developers can learn from generated code structure
- **Fallback:** Hand-written pattern SDK available if generation proves insufficient

### Negative Consequences (Trade-offs)

- **Generator Complexity:** TypeScript compiler must understand all node types and constraints
- **Debugging Difficulty:** Errors in generated code require generator fixes, not pattern-specific patches
- **Graph Expressiveness:** Some complex algorithms may be awkward to express as node graphs
- **Tool Maturity:** Requires building/testing comprehensive code generation infrastructure
- **Initial Investment:** Higher upfront effort to bootstrap generator vs. accepting hand-written patterns only
- **Versioning Risk:** Generator changes must maintain backward compatibility with old graphs

### Implementation Impact

| Impact | Details |
|--------|---------|
| **Scope** | Code generation pipeline (TypeScript), graph runtime (C++), node library documentation |
| **Effort** | 4-6 weeks to implement comprehensive generator + PoC conversion of 15 existing patterns |
| **Memory** | <500 bytes per generated pattern (header + runtime init data) |
| **CPU** | Zero overhead vs. hand-written C++ (compiled directly) |
| **Risk** | Medium—requires careful testing of generator and generated code across pattern types |
| **Rollback** | Fall back to manual pattern SDK (ADR-0006, Option C) if generator approach unviable |

---

## Alternatives Considered

### Alternative 1: Hand-Written C++ Pattern SDK Only (Rejected)

**Approach:**
- All patterns written as C++ functions directly
- Provide template library and examples
- No code generation, no graph compilation

**Pros:**
- ✅ Simplest to implement (SDK = documentation + templates)
- ✅ Maximum flexibility and control
- ✅ Matches current reality (patterns already hand-written)
- ✅ No generator tool to maintain

**Cons:**
- ❌ Excludes non-programmers from pattern creation (kills TAM expansion)
- ❌ High barrier to entry (requires C++ expertise)
- ❌ No competitive advantage vs. WLED/PixelBlaze (if they add visual editors)
- ❌ Contradicts ADR-0006 decision (restore graph compilation as USP)

**Decision:** REJECTED—does not meet strategic goal of lowering barrier to entry for non-programmers. Conflicts with core USP positioning.

---

### Alternative 2: Runtime Graph Interpreter (Rejected)

**Approach:**
- Store JSON graphs at runtime
- Interpret graph at 30 FPS (no compilation step)
- Execute nodes via virtual dispatch (function pointers)

**Pros:**
- ✅ Hot-reloadable patterns (change graph, see results immediately)
- ✅ No compilation pipeline required
- ✅ Flexible pattern modification at runtime

**Cons:**
- ❌ Runtime interpretation overhead (~5-10% FPS cost per pattern)
- ❌ Virtual dispatch on every node call (cache misses)
- ❌ Memory overhead (graph structure + interpreter state)
- ❌ More complex runtime validation
- ❌ Harder to guarantee safety/performance bounds

**Decision:** REJECTED—performance cost unacceptable for tight FPS targets. Compile-time generation preferred for zero-overhead execution.

---

### Alternative 3: Hybrid Text DSL (Rejected)

**Approach:**
- Custom domain-specific language (DSL) in text format
- Compile DSL → C++ via parser
- Simpler than JSON + TypeScript, but less visual

**Pros:**
- ✅ Simpler to parse and validate
- ✅ Human-readable without visual editor

**Cons:**
- ❌ Still requires learning language syntax
- ❌ No visual feedback (worse UX than graphs)
- ❌ Parser complexity similar to JSON schema validation
- ❌ Doesn't support visual pattern composition

**Decision:** REJECTED—JSON + visual graph editor superior for non-programmer accessibility.

---

### Alternative 4: Selective Code Generation (Partial, Chosen Approach)

**Approach:**
- Machine-generated patterns from graphs (primary path)
- Hand-written pattern SDK for complex cases (secondary path)
- Clear guidelines for when to use each
- Hybrid patterns as escape hatch

**Pros:**
- ✅ Captures 80-90% of patterns via generation (good ROI)
- ✅ Preserves option for complex hand-written patterns
- ✅ Avoids forcing everything through generator
- ✅ Gradual transition (hand-written → generated over time)
- ✅ Lower implementation risk (fallback available)

**Cons:**
- ⚠️ Requires documenting decision criteria (when to use which)
- ⚠️ Two pattern systems to maintain
- ⚠️ More complex developer guidance

**Decision:** CHOSEN—balances accessibility goals with pragmatism. Clear tier system prevents confusion about pattern authoring approach.

---

## Validation

### How will we know this decision is correct?

#### Short-Term Validation (Weeks 1-3, PoC Phase)

- [ ] Pattern template compiles cleanly (no warnings)
- [ ] Generated `pattern_bloom.cpp` renders correctly on hardware
- [ ] Generated `pattern_spectrum.cpp` audio-reactive behavior works
- [ ] FPS impact <2% vs. empty loop (compiled, zero-overhead)
- [ ] 24-hour stability test passes without crashes
- [ ] Memory overhead <5 KB per pattern
- [ ] Code generation pipeline (TypeScript skeleton) parses valid JSON graphs

**Gate:** If ALL pass → proceed to full generator implementation; if ANY fail → escalate to architecture review

#### Medium-Term Validation (Weeks 4-8, Full Generator Implementation)

- [ ] TypeScript compiler generates valid C++ from 10+ test graphs
- [ ] Generated patterns execute in <0.5ms per frame
- [ ] Hand-written pattern SDK template compiles and works
- [ ] 15 existing patterns successfully migrated to graphs
- [ ] Code generation reduces pattern file size by 20%+ (remove boilerplate)
- [ ] Developer documentation is clear and complete

**Gate:** Pattern library completeness check—can we express all 15 patterns as graphs?

#### Long-Term Validation (Weeks 9-14, Integration & Production)

- [ ] Graph-based patterns work seamlessly with hardware (RMT/I2S)
- [ ] Pattern marketplace JSON exchange works
- [ ] Visual pattern editor (Phase C) successfully loads and edits generated patterns
- [ ] Production patterns maintain performance targets under sustained load
- [ ] <2% regressions in FPS, audio reactivity, or color accuracy

**Gate:** Production readiness—can we ship graph-based patterns to customers?

### Measurement Plan

| Metric | Target | Gate | Owner | Timeline |
|--------|--------|------|-------|----------|
| **Template compilation** | 0 warnings | Week 1 | Firmware | Nov 13 |
| **PoC FPS impact** | <2% overhead | Week 2 | Firmware | Nov 17 |
| **PoC stability** | 24 hrs no crash | Week 2 | QA | Nov 17 |
| **Compiler skeleton** | Parses valid JSON | Week 2 | Architect | Nov 17 |
| **Generator implementation** | 10 test graphs → C++ | Week 6 | Architect | Dec 8 |
| **Pattern library size** | 15 patterns total | Week 8 | Firmware | Dec 22 |
| **Production FPS** | ≥98 FPS sustained | Week 12 | QA | Jan 10 |
| **Marketplace ready** | JSON export/import | Week 12 | Architect | Jan 10 |

---

## Implementation Notes

### Related Architecture Documents

- **Stateful Node Feasibility:** `docs/01-architecture/K1NArch_ASSESSMENT_STATEFUL_NODE_FEASIBILITY_v1.0_20251108.md` (66 pages, technical deep dive)
- **Pattern Migration Strategy:** `docs/02-adr/ADR-0008-pattern-migration-strategy.md` (PoC approach)
- **Graph Schema Specification:** `docs/06-reference/GRAPH_SCHEMA_SPEC.md` (to be created)
- **Code Generation Guidelines:** `docs/09-implementation/CODE_GENERATION_GUIDELINES.md` (to be created)

### Related Code

- **Graph Runtime:** `firmware/src/graph_codegen/graph_runtime.h` (helper functions, buffer operations)
- **Pattern Template:** `firmware/src/graph_codegen/pattern_template.cpp` (documented standard form)
- **Pattern Examples:** `firmware/src/graph_codegen/pattern_{bloom,spectrum}.cpp` (PoC implementations)
- **Stateful Nodes:** `firmware/src/stateful_nodes.h` (beat detection, filters, history)
- **Pattern Parameters:** `firmware/src/parameters.h` (UI binding interface)
- **Code Generator:** `codegen/src/index.ts` (TypeScript compiler, currently incomplete)

### Implementation Tasks

**Phase 1: Infrastructure (Weeks 1-2, Nov 6-13)**
1. Finalize and validate graph runtime library
2. Document pattern template and node library
3. Complete TypeScript compiler skeleton
4. Set up PoC testing framework

**Phase 2: Generator Implementation (Weeks 3-6, Nov 15 - Dec 8)**
1. Implement full code generation pipeline (node → C++ emission)
2. Add JSON schema validation
3. Create comprehensive node library documentation
4. Implement test generator (graph → C++ validation)

**Phase 3: Pattern Migration (Weeks 7-10, Dec 9 - Jan 6)**
1. Convert 15 existing patterns to JSON graphs
2. Validate generated code matches original performance
3. Build pattern library index and documentation
4. Create pattern authoring guide

**Phase 4: Integration & Polish (Weeks 11-14, Jan 7 - Jan 24)**
1. Integrate with visual pattern editor (Phase C)
2. Pattern marketplace JSON export/import
3. Performance optimization pass
4. Production hardening and testing

### Timeline

| Phase | Dates | Work | Owner | Dependency |
|-------|-------|------|-------|------------|
| **Phase 1** | Nov 6-13 | Template validation, compiler skeleton, PoC setup | Architecture | ADR-0020 approval |
| **Phase 2** | Nov 15 - Dec 8 | Full code generator implementation | Backend (TypeScript) | Phase 1 complete |
| **Phase 3** | Dec 9 - Jan 6 | Pattern migration, library completion | Firmware + Architecture | Phase 2 complete |
| **Phase 4** | Jan 7 - Jan 24 | Integration with Phase C, marketplace foundation | Full team | Phase 3 complete |

---

## Superseded By

[None yet—this is the foundational decision for pattern code generation architecture.]

---

## References

### Decision Context (Graph Compilation Strategic Reversal)

- **ADR-0006:** Codegen Architecture Decision (Nov 5, 2025)
  - Strategic reversal to restore graph compilation as core USP
  - Market opportunity: $50-150M valuation (10-12x TAM expansion)
  - Execution: Parallel Phase 2D1 fixes + graph system development
  - PoC validation gate: 2-week PoC required before full commitment

- **ADR-0008:** Pattern Migration Strategy
  - Pattern reversibility analysis: 88% convertible (15/17 patterns)
  - Total nodes: 159 instances, 35-40 unique types
  - Conversion effort: 20 weeks sequential, 12-14 weeks parallel

### Feasibility & Technical Analysis

- **Stateful Node Assessment:** `docs/01-architecture/K1NArch_ASSESSMENT_STATEFUL_NODE_FEASIBILITY_v1.0_20251108.md`
  - Finding: Technically feasible (<2% performance impact, <1KB memory per node)
  - Enables audio-reactive patterns without hand-written C++

- **Node Implementation Checklist:** `docs/09-implementation/K1NImpl_NODE_IMPLEMENTATION_CHECKLIST_v1.0_20251110.md`
  - Comprehensive node type coverage
  - Implementation status and priority ordering

### Code Generation & Patterns

- **Graph Runtime:** `firmware/src/graph_codegen/graph_runtime.h` (89 lines, helper functions)
- **Pattern Template:** `firmware/src/graph_codegen/pattern_template.cpp` (158 lines, documented standard form)
- **PoC Implementations:**
  - `firmware/src/graph_codegen/pattern_bloom.cpp` (bloom pattern proof-of-concept)
  - `firmware/src/graph_codegen/pattern_spectrum.cpp` (spectrum pattern proof-of-concept)

### Existing ADR Decisions

- **ADR-0007:** Stateful Node Architecture (foundation for code generation)
- **ADR-0012:** Phase C Node Editor Architecture (visual editor depends on code generation)
- **ADR-0017:** LUT Optimization System (performance baseline for validation)

---

## Discussion & Approval

### Critical Questions Requiring Clarification

**Question 1: Generator Complexity vs. Hand-Written Patterns**
- Is it acceptable to maintain both code generation + hand-written SDKs?
- Or should we commit to code generation as the primary/only path?

**Recommendation:** Hybrid approach (Tier 1 + Tier 2) is pragmatic and reduces risk during bootstrap phase. Clear guidelines prevent confusion about which path to use.

**Question 2: Node Library Coverage**
- Can we express all 15 existing patterns as nodes with <2% FPS impact?
- Do we need specialized nodes for audio analysis, physics, etc.?

**Recommendation:** Start with PoC (Bloom + Spectrum), measure impact, then expand library based on real-world needs.

**Question 3: Performance Guarantees**
- Should code generation guarantee <0.5ms per frame?
- How do we validate performance without hardware testing?

**Recommendation:** Establish baseline with generated patterns on hardware, use static analysis + profiling tools during development.

**Question 4: JSON Schema & Versioning**
- How do we handle schema evolution (new node types, breaking changes)?
- How do we validate backward compatibility?

**Recommendation:** Semantic versioning for graph format, validation tests for each schema version, migration tools for graph updates.

### Required Approvals

- [ ] **@spectrasynq** (Architecture Steward) → APPROVE code generation approach + hybrid tier system
- [ ] **@firmware_lead** (Firmware Engineering) → COMMIT to pattern template consistency + PoC validation
- [ ] **@audio_expert** (Audio Systems) → VALIDATE audio-reactive node feasibility
- [ ] **@backend_lead** (TypeScript/Code Generation) → COMMIT to compiler implementation timeline

### Sign-Off Checklist

- [ ] **Architecture Review:** Approved by @spectrasynq on ________
- [ ] **Firmware Review:** Approved by @firmware_lead on ________
- [ ] **Audio Review:** Approved by @audio_expert on ________
- [ ] **Compiler Review:** Approved by @backend_lead on ________

---

## Appendix: Code Generation Examples

### Example 1: Simple Gradient Pattern (Generated)

**Input JSON Graph:**
```json
{
  "name": "simple_gradient",
  "nodes": [
    { "id": "time", "type": "Time", "config": { "scale": 2.0 } },
    { "id": "color", "type": "HsvToRgb", "config": {} },
    { "id": "fill", "type": "Fill", "config": {} },
    { "id": "output", "type": "LedOutput" }
  ],
  "edges": [
    { "source": "time", "sourcePin": "time", "target": "color", "targetPin": "hue" },
    { "source": "color", "target": "fill" },
    { "source": "fill", "target": "output" }
  ]
}
```

**Generated C++ Pattern:**
```cpp
extern "C" void pattern_simple_gradient_render(
    uint32_t frame_count,
    const AudioDataSnapshot& audio,
    const PatternParameters& params,
    PatternState& state,
    PatternOutput& out
) {
    static constexpr int PATTERN_NUM_LEDS = 256;

    // Temporary buffers
    CRGBF tmp_rgb0[PATTERN_NUM_LEDS];

    // Node: Time
    float hue = fmod((float)frame_count / 30.0f * 2.0f, 1.0f);

    // Node: HsvToRgb
    CRGBF base_color = hsv_to_rgb(hue, params.saturation, params.value);

    // Node: Fill
    fill_buffer(tmp_rgb0, base_color, PATTERN_NUM_LEDS);

    // Terminal: LedOutput
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {
        CRGBF c = clamped_rgb(tmp_rgb0[i]);
        out.leds[i][0] = (uint8_t)(c.r * 255.0f);
        out.leds[i][1] = (uint8_t)(c.g * 255.0f);
        out.leds[i][2] = (uint8_t)(c.b * 255.0f);
    }
}
```

### Example 2: Bloom Pattern with State (Generated)

**Key Aspects:**
```cpp
// Node: AudioSpectrum (input)
const float* spectrum = audio.spectrum;  // 256 bins

// Node: BandShape (stateless)
for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {
    tmp_f0[i] = spectrum[i % 256];  // Map spectrum to LED positions
}

// Node: BufferPersist (stateful)
for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {
    state.persist_buf[i] = 0.92f * state.persist_buf[i] + (1.0f - 0.92f) * tmp_f0[i];
}

// Node: ColorizeBuffer (stateless)
for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {
    float v = clamp_val(state.persist_buf[i], 0.0f, 1.0f);
    tmp_rgb0[i] = hsv_to_rgb((float)i / 256.0f, 1.0f, v);  // Rainbow hue
}
```

### Example 3: Hand-Written Pattern (Manual SDK)

For complex patterns requiring custom logic:

```cpp
// Manual pattern implementing particle system
extern "C" void pattern_particles_render(
    uint32_t frame_count,
    const AudioDataSnapshot& audio,
    const PatternParameters& params,
    PatternState& state,
    PatternOutput& out
) {
    // Initialize particle system from state
    ParticleSystem& sys = state.particle_sys;

    // Update particles (hand-written physics)
    for (int p = 0; p < MAX_PARTICLES; ++p) {
        sys.particles[p].pos += sys.particles[p].vel;
        sys.particles[p].vel *= 0.99f;  // Drag
        sys.particles[p].age++;

        if (sys.particles[p].age > sys.particles[p].lifetime) {
            spawn_new_particle(sys, audio);
        }
    }

    // Render to output
    CRGBF tmp_rgb[PATTERN_NUM_LEDS] = {0};
    render_particles(sys, tmp_rgb);

    // Write output with clamping
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {
        CRGBF c = clamped_rgb(tmp_rgb[i]);
        out.leds[i][0] = (uint8_t)(c.r * 255.0f);
        out.leds[i][1] = (uint8_t)(c.g * 255.0f);
        out.leds[i][2] = (uint8_t)(c.b * 255.0f);
    }
}
```

---

<!-- markdownlint-enable MD013 -->

**Document Status:** Ready for Architectural Review
**Next Step:** Obtain sign-offs from firmware, audio, and backend leads to unblock PoC implementation

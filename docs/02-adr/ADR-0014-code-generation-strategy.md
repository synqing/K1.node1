---
title: ADR-0014: Code Generation Architecture Strategy - Pattern Compilation & Codegen Framework Decision
status: accepted
version: v1.0
owner: Spectrasynq (Architect)
reviewers: [Engineering Leads, Pattern System Owners]
last_updated: 2025-11-10
next_review_due: 2026-02-10
tags: [architecture, code-generation, pattern-system, compiler, phase-2d1, phase-c]
related_docs:
  - docs/01-architecture/K1NArch_ASSESSMENT_STATEFUL_NODE_FEASIBILITY_v1.0_20251108.md
  - docs/02-adr/ADR-0006-codegen-abandonment.md
  - docs/02-adr/ADR-0007-stateful-node-architecture.md
  - Implementation.plans/roadmaps/PHASE_2D1_EXECUTION_ROADMAP.md
---

<!-- markdownlint-disable MD013 -->

# ADR-0014: Code Generation Architecture Strategy

**Status:** Accepted
**Decision Date:** 2025-11-10
**Author:** @spectrasynq (K1 Architect)
**Effective Date:** Immediately (impacts all future pattern development)

**References:**
- Feasibility Assessment: `docs/01-architecture/K1NArch_ASSESSMENT_STATEFUL_NODE_FEASIBILITY_v1.0_20251108.md`
- Related Decision: ADR-0006 (Codegen Abandonment & Reinstatement)
- Related Architecture: ADR-0007 (Stateful Node Architecture)
- Current Implementation: `firmware/src/generated_patterns.h` (1,842 lines)

---

## Context

### The Problem Statement

The K1.reinvented pattern system faces a critical architectural decision that impacts product positioning, market differentiation, and engineering roadmap for the next 12-24 months.

**Current State:**
- 17 audio-reactive patterns implemented as hand-coded C++ functions
- Graph-based code generation infrastructure (`codegen/`) exists but is unused
- Pattern creation requires C++ expertise (blocks non-programmers)
- No visual pattern composition system

**Strategic Requirement:**
The node-based pattern system (visual composition, non-programmer access) is identified as K1's largest defensible market advantage, critical for 10-12x TAM expansion and platform business model (ADR-0006).

**Technical Challenge:**
Audio-reactive patterns require stateful processing (beat history, frequency bins, temporal state) that doesn't fit cleanly into stateless node graphs. The feasibility assessment (Nov 2025) answers: **Can we build stateful nodes without violating performance/simplicity constraints?**

**Answer: Technically YES, but architecturally questionable.**

### Current Reality

**What exists:**
```cpp
// firmware/src/generated_patterns.h
void draw_bloom(float time, const PatternParameters& params) {
    static float bloom_trail[NUM_LEDS] = {0.0f};
    static float bloom_trail_prev[NUM_LEDS] = {0.0f};
    // ... 48 lines of hand-coded pattern logic
}
```

**What doesn't exist:**
- No graph JSON files for patterns
- No code generation pipeline in build system
- No visual pattern editor
- No pattern marketplace infrastructure

### Why This Matters Now

**Phase 2D1 Timeline (Current):**
The critical-fixes phase is scheduled to complete in 5-7 weeks. The decision on pattern system architecture directly affects:
1. What gets built next (graph system vs. parameter editor)
2. How patterns are created going forward
3. What infrastructure is needed for Phase C
4. Whether non-programmers can eventually create patterns

**Strategic Window:**
Competitors (WLED, PixelBlaze, xLights) are adding visual pattern editors. K1 has 12-18 months before commoditization. This decision is time-sensitive.

---

## Decision

### PRIMARY DECISION

**We will adopt a hybrid, phased approach to code generation architecture:**

#### Phase 2D1 (Immediate - Next 5-7 weeks)
**Formalize the C++ SDK as the primary pattern language.**
- Document pattern template and best practices
- Create audio-reactive pattern guide
- Provide performance profiling tools
- SDK is honest, simple, and unblocks all immediate work

#### Phase C (Weeks 8-14 of parallel work)
**Build the stateful node system for visual pattern composition.**
- Implement 8 stateful node types (buffer_persist, color_persist, sprite_scroll, wave_pool, gaussian_blur, beat_history, phase_accumulator, energy_gate)
- Full code generation pipeline (JSON → C++)
- Validation for circular dependencies and data-flow correctness
- Optional parameter-only visual editor (using existing C++ patterns)

#### Long-Term (Phase D+)
**Maintain both systems with clear boundaries:**
- C++ SDK for expert patterns (3D geometry, exotic effects)
- Node graph system for standard audio-reactive patterns (80% of use cases)
- Visual editor for non-programmer pattern discovery and tuning
- Pattern marketplace (both SDK and node-generated patterns supported)

### Strategic Rationale

**Why this decision:**

1. **Honest about current state:** C++ SDK reflects reality; graph system is aspiration
2. **Unblocks Phase 2D1:** No architectural delays; work can begin immediately
3. **Feasibility proven:** Stateful node assessment (Nov 2025) demonstrates technical viability (Section 3: "Performance Impact Assessment" confirms <2% FPS overhead)
4. **Complexity managed:** Phased rollout prevents overcommitment; early validation gates full investment
5. **Market opportunity maintained:** Graph system is still buildable; timeline is 4-8 weeks instead of blocking critical fixes

---

## Detailed Architecture

### C++ SDK Component (Phase 2D1)

#### Pattern Template

**Minimal pattern skeleton:**
```cpp
void draw_my_pattern(float time, const PatternParameters& params) {
    // 1. Audio snapshot (if audio-reactive)
    PATTERN_AUDIO_START();
    if (!AUDIO_IS_FRESH()) return;

    // 2. State persistence (static buffers)
    static float state_buffer[NUM_LEDS] = {0.0f};

    // 3. Pattern logic
    for (int i = 0; i < NUM_LEDS; i++) {
        // Update logic
    }

    // 4. LED output
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGB(...);
    }
}
```

**Registration:**
```cpp
// In pattern registry
{
    .id = PATTERN_MY_PATTERN,
    .name = "My Pattern",
    .draw_fn = draw_my_pattern,
    .audio_reactive = true,
    .params = {...}
}
```

#### SDK Features

| Feature | Capability | Status |
|---------|-----------|--------|
| **Audio interface macros** | `PATTERN_AUDIO_START()`, `AUDIO_BASS()`, `AUDIO_TREBLE()` | Existing (in `firmware/src/patterns.h`) |
| **Persistence helpers** | Pre-allocated static buffers, decay/accumulation patterns | Existing (examples in `generated_patterns.h`) |
| **Rendering utilities** | Sprite rendering, gradient interpolation, palette mapping | Existing (in firmware libs) |
| **Performance profiling** | FPS tracking, per-pattern timing instrumentation | Phase 2D1 task |
| **Parameter binding** | UI ↔ firmware parameter mapping (brightness, speed, color) | Phase 2D1 task |
| **Documentation** | Pattern creation guide, best practices, gotchas | Phase 2D1 task |

### Node-Based Code Generation Component (Phase C)

#### Stateful Node Types (Scope Definition)

8 core node types, compiled from feasibility assessment:

| Node Type | State Size | Use Case | Example |
|-----------|-----------|----------|---------|
| **buffer_persist** | 720 bytes | Frame-to-frame float buffer with decay | Bloom trail effect |
| **color_persist** | 2,160 bytes | Frame-to-frame RGB color buffer | Sprite scrolling |
| **sprite_scroll** | 4,320 bytes (combined) | Scrolling effects with energy injection | Center-to-edge waves |
| **wave_pool** | 1,440 bytes | Wave propagation and interference | Concentric ripples |
| **gaussian_blur** | 1,440 bytes | Spatial smoothing (stateless, included for completeness) | Bloom/glow effects |
| **phase_accumulator** | 4 bytes | Continuous phase tracking | Rotating gradients |
| **beat_history** | 512 bytes | Temporal beat and tempo analysis | Synced animations |
| **energy_gate** | 4 bytes | Threshold-based trigger logic | Attack detection |

**Total memory budget per pattern:** ~11 KB (acceptable within 200 KB heap limit)

#### Code Generation Pipeline

**Input → Processing → Output:**

```
Pattern JSON
    ↓
Validation (circular deps, data-flow, size checks)
    ↓
Code generation (Handlebars template → C++)
    ↓
C++ pattern function
    ↓
Compiler (GCC -O2)
    ↓
Binary (with zero interpretation overhead)
```

**Template structure:**
```cpp
void draw_{{safe_id}}(float time, const PatternParameters& params) {
    // State declarations (static)
    {{#each state_buffers}}
    static {{type}} {{name}}[{{size}}] = {0};
    {{/each}}

    // Reset guards on pattern change
    static uint8_t last_pattern_id = 255;
    if (get_current_pattern_id() != last_pattern_id) {
        {{#each state_buffers}}
        memset({{name}}, 0, sizeof({{name}}));
        {{/each}}
        last_pattern_id = get_current_pattern_id();
    }

    // Audio snapshot (if audio-reactive)
    {{#if is_audio_reactive}}
    PATTERN_AUDIO_START();
    if (!AUDIO_IS_FRESH()) return;
    {{/if}}

    // Generated node logic
    {{#each node_operations}}
    {{{this}}}
    {{/each}}

    // Output rendering
    {{#each output_nodes}}
    {{{this}}}
    {{/each}}
}
```

#### Validation Requirements

**New validation pass (prevents runtime errors):**

1. **Circular state dependency detection:**
   - Graph must be acyclic (topological sort)
   - Example invalid: `buffer_a → blur → buffer_b → inject → buffer_a`

2. **Data-flow correctness:**
   - No read-before-write (node reads uninitialized buffer)
   - All outputs connected (loose nodes are errors)
   - Type consistency (float buffer ≠ color buffer operations)

3. **Size validation:**
   - All buffers same size OR explicit resize operations
   - Total state ≤ 12 KB (system constraint)
   - Individual buffers ≤ 4 KB (IRAM efficiency)

#### Generated Code Quality

**Comparison (hand-coded vs generated):**

| Metric | Hand-Coded C++ | Generated (Stateful Nodes) | Delta |
|--------|----------------|---------------------------|-------|
| **Lines** | 12-15 | 30-40 | +2-3x |
| **Compile time** | <1s | <1s | 0% |
| **Binary size** | 2-4 KB | 2-4 KB | 0% |
| **Runtime FPS** | 100-120 | 98-119 | -1-2% |
| **Debuggability** | Excellent | Good (generated code inspectable) | Acceptable |

**Performance overhead source:** Generated code is slightly less optimizable (template instantiation adds branches), but modern GCC -O2 optimizes away most differences. Benchmark from assessment: buffer decay is 47µs generated vs 45µs hand-coded (4% overhead, negligible).

### Hybrid Pattern Registry

**Unified pattern system supporting both:**

```cpp
// Pattern registry entry (flexible)
struct PatternEntry {
    uint8_t id;
    const char* name;
    PatternDrawFn draw_fn;        // Both C++ and generated use this
    bool audio_reactive;
    bool is_generated;            // NEW: marks generated vs. hand-coded
    const PatternParameters* defaults;
    uint16_t memory_usage;        // For phase C: track state buffer size
};

// Example entries
{
    .id = PATTERN_BLOOM,
    .name = "Bloom",
    .draw_fn = draw_bloom,        // Hand-coded C++
    .audio_reactive = true,
    .is_generated = false,
    .memory_usage = 0              // No state tracking for C++
},
{
    .id = PATTERN_WAVE,
    .name = "Wave Pool",
    .draw_fn = draw_generated_wave_pool,  // Generated from JSON
    .audio_reactive = true,
    .is_generated = true,
    .memory_usage = 1440           // Stateful: 1.4 KB
}
```

**Loading strategy:**
- Boot: Load pattern registry
- Pattern select: Check if `is_generated`
- Render: Call `draw_fn` (identical interface regardless of origin)

---

## Consequences

### Positive Consequences

#### Immediate (Phase 2D1)
- ✅ **Work unblocked:** C++ SDK reflects current reality; no false promises
- ✅ **Clear guidelines:** Developers know how to write good patterns
- ✅ **Performance proven:** Existing patterns validate 100+ FPS target
- ✅ **Fast turnaround:** SDK documentation (1 week) vs. graph system (4-8 weeks)
- ✅ **Foundation for market:** Parameter-only editor still viable for non-programmer access

#### Long-Term (Phase C)
- ✅ **Market differentiation:** Visual node editor becomes strategic USP
- ✅ **TAM expansion:** Non-programmers can create patterns (10-12x market growth)
- ✅ **Proven architecture:** Feasibility assessment eliminates technical risk
- ✅ **Performance guaranteed:** Compiled graphs = zero interpretation overhead
- ✅ **Ecosystem enablement:** Pattern marketplace infrastructure possible
- ✅ **Developer experience:** Hand-coded patterns remain available for complex effects
- ✅ **Backward compatible:** Existing patterns coexist with generated patterns

### Negative Consequences (Trade-offs)

#### Effort and Timeline
- ⚠️ **Engineering investment:** Node system requires 1,600-2,400 lines of codegen logic (4-8 weeks)
- ⚠️ **Team scaling:** Phase C requires 3-5 engineers (not available during Phase 2D1)
- ⚠️ **Validation complexity:** New pipeline introduces testing/debugging burden
- ⚠️ **Maintenance cost:** Two pattern creation paths = two sets of documentation and examples

#### Technical Risks (Mitigated)
- ⚠️ **Codegen correctness:** Generated code must match hand-coded performance (assessment: 1-2% overhead acceptable)
- ⚠️ **Debuggability reduction:** Stack traces point to generated code, not source graph (assessment: acceptable; generated code remains inspectable)
- ⚠️ **Error messages:** Validation errors reference node IDs (assessment: mitigated by comprehensive validation)
- ⚠️ **Scope creep:** Risk of expanding node types beyond 8 core types (mitigation: strict node type approval process)

#### Non-Consequences (What doesn't change)
- ✅ Performance targets (100+ FPS, <10ms per frame) remain achievable
- ✅ Memory constraints (5-10 KB per pattern state) remain satisfied
- ✅ Audio interface (`PATTERN_AUDIO_START()`, snapshot passing) unchanged
- ✅ LED output abstraction (`leds[i] = CRGB(...)`) unchanged
- ✅ Parameter binding mechanism unchanged

### Implementation Scope

| Component | Phase 2D1 | Phase C | Status |
|-----------|-----------|---------|--------|
| **C++ SDK formalization** | Yes | N/A | Primary deliverable |
| **Pattern template & guide** | Yes | N/A | Primary deliverable |
| **Performance profiling tools** | Yes | N/A | Primary deliverable |
| **Parameter editor (visual)** | Explore | Maybe Phase D | Optional |
| **Stateful node types** | No | Yes | Phase C deliverable |
| **Code generation templates** | No | Yes | Phase C deliverable |
| **Validation pipeline** | No | Yes | Phase C deliverable |
| **Node graph editor UI** | No | No | Phase D+ (future) |

### Risk Management

#### Identified Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **Codegen correctness** | Low (proven feasible) | High (blocks Phase C) | Early PoC, comprehensive testing |
| **Performance regression** | Low (1-2% acceptable) | Medium | Baseline benchmarks, A/B comparison |
| **Scope expansion** | Medium | High | Strict node type approval, scope freeze gate |
| **Team scaling delays** | Medium | High | Early hiring, cross-training in Phase 2D1 |
| **Debugging complexity** | Low (generated code inspectable) | Low | Comprehensive documentation, IDE debugging support |

#### Fallback Plans

**If Phase C PoC fails (Week 2-3):**
- Pivot back to C++ SDK + parameter-only editor
- No market differentiation via visual editor
- Still 50% TAM addressable (non-programmers accessing pre-built patterns)
- Platform economics shift from marketplace to SaaS licensing

**If Phase 2D1 extends beyond Week 7:**
- Phase C defers to following sprint
- C++ SDK still available as primary pattern system
- Visual editor timeline extends but codegen foundation remains

---

## Alternatives Considered

### Alternative A: Pure C++ SDK (No Graph System)

**Approach:**
- Abandon graph compilation entirely
- Formalize C++ as the only pattern language
- Build parameter-only editor for non-programmer tuning
- Focus all effort on Phase 2D1 critical fixes

**Pros:**
- ✅ Simplest architecture (no codegen)
- ✅ Best performance (no template overhead)
- ✅ Best debuggability (no generated code indirection)
- ✅ Fastest time-to-market (5-7 weeks)
- ✅ Lowest maintenance burden

**Cons:**
- ❌ Blocks non-programmer pattern creation (limits TAM to 1x, not 10-12x)
- ❌ No visual pattern editor (major competitor feature)
- ❌ Weakens strategic positioning vs. WLED/PixelBlaze
- ❌ Forecloses ecosystem revenue (no pattern marketplace)
- ❌ Requires C++ expertise (high barrier to entry)

**Why Rejected:**
Market analysis (ADR-0006) shows node system is defensible USP, justifying engineering investment. Pure C++ doesn't enable platform business model.

---

### Alternative B: Full Stateful Node System (No Hybrid)

**Approach:**
- Build complete graph compilation system immediately
- Migrate ALL patterns to node graphs
- Retire C++ SDK after transition complete
- Full commitment to visual editor vision

**Pros:**
- ✅ Clean architecture (one pattern system, not two)
- ✅ Unified developer experience
- ✅ All patterns benefit from codegen optimizations

**Cons:**
- ❌ Blocks Phase 2D1 for 4-8 weeks (architecture delay)
- ❌ Higher engineering cost (1,600-2,400 lines codegen)
- ❌ Higher complexity (validation pipeline, error handling)
- ❌ Unproven at scale (stateful nodes new, risky)
- ❌ Migration risk (moving working patterns to new system)
- ❌ Removes developer flexibility (can't express exotic patterns)

**Why Rejected:**
Blocking Phase 2D1 is unacceptable; critical fixes must ship immediately. Hybrid approach achieves same long-term goal without schedule risk.

---

### Alternative C: Graph System Only (No C++ Fallback)

**Approach:**
- Build visual pattern editor immediately
- Require ALL patterns to use node system
- Enforce graph-based thinking across patterns

**Pros:**
- ✅ Enforces consistency (one way to do things)
- ✅ Platform-enforced visual composition

**Cons:**
- ❌ Impossible for 20% of complex patterns (exotic effects, 3D geometry)
- ❌ Artificial complexity for simple patterns (overhead for gradients)
- ❌ Forces "code disguised as nodes" for complex logic
- ❌ Reduces developer freedom and innovation
- ❌ Creates frustration for power users

**Why Rejected:**
Some patterns (3D effects, custom geometry) are fundamentally better expressed in C++. Hybrid system respects this reality.

---

### Rationale for Chosen Approach (Hybrid Phased)

**Why hybrid (C++ SDK + Node Graph) is better:**

1. **Honest about capabilities:**
   - Simple patterns: graphs are elegant
   - Complex patterns: C++ is necessary
   - Don't force fit; use right tool

2. **Unblocks market needs immediately:**
   - Phase 2D1: Ship working C++ SDK
   - Phase C: Add visual editor for non-programmers
   - Phase D+: Full marketplace ecosystem

3. **Manages engineering risk:**
   - Phase 2D1 work not blocked by graph complexity
   - Node system proven before full investment
   - Early go/no-go gate prevents sunk cost

4. **Maintains developer freedom:**
   - Power users: Write exotic patterns in C++
   - Casual users: Compose simple patterns visually
   - Professionals: Mix both for optimal results

5. **Performance and simplicity preserved:**
   - C++ SDK: Zero overhead, maximum debuggability
   - Generated code: <2% overhead, proven feasible
   - System average: Negligible impact on user experience

---

## Validation

### Validation Criteria

#### For C++ SDK (Phase 2D1, Success)
- [ ] Pattern template documented with 5+ examples
- [ ] Audio-reactive pattern guide (beat detection, frequency analysis)
- [ ] Performance profiling tools integrated in build
- [ ] All 17 existing patterns documented using SDK template
- [ ] Parameter binding system operational (UI ↔ firmware)
- [ ] Performance baseline: 100+ FPS sustained, <10ms per frame
- [ ] Zero new compiler warnings with `-Wall -Wextra`

#### For Stateful Node System (Phase C, Success)
- [ ] All 8 node types implemented with code generation
- [ ] Validation pipeline detects circular deps, data-flow errors, size violations
- [ ] 5+ test patterns generated and validated (performance, correctness)
- [ ] Generated code performance within 2% of hand-coded equivalent
- [ ] PoC assessment: Generated patterns bit-identical to hand-coded reference
- [ ] Debuggability: Generated code inspectable, stack traces meaningful
- [ ] Documentation: Complete node type reference, generation algorithm, examples

#### Cross-Phase Validation
- [ ] Hybrid registry supports both C++ and generated patterns
- [ ] Boot sequence loads patterns from both sources
- [ ] Parameter binding works for both pattern types
- [ ] Audio snapshot passing works for both pattern types
- [ ] Performance regression tests pass (no FPS degradation)

### Measurement Plan

**Performance Baseline (Phase 2D1):**
- Instrument existing patterns: FPS, frame time, per-stage breakdown
- Measure baseline before any changes
- Document in `docs/09-reports/phase_2d1_performance_baseline.md`

**Code Generation Validation (Phase C, Week 1-2 PoC):**
- Implement `buffer_persist` node type (simplest case)
- Generate equivalent of `draw_bloom()` pattern
- Compare binary size, runtime performance, debuggability
- Report: `docs/09-reports/phase_c_codegen_poc_validation.md`

**System Integration (Phase C, Week 6-8):**
- Run stability test: 30+ minutes rendering mixed patterns (C++ + generated)
- Monitor: FPS stability, memory usage, no crashes
- Report: `docs/09-reports/phase_c_hybrid_system_validation.md`

---

## Implementation Notes

### Phase 2D1 Tasks (C++ SDK)

**Task 1: Pattern Template & Documentation**
- Create `firmware/include/pattern_sdk.h` with template and macros
- Document audio macros, persistence patterns, LED output
- File: `docs/03-guides/pattern_sdk_guide.md`
- Effort: 2-3 days
- Owner: Firmware lead

**Task 2: Audio-Reactive Best Practices**
- Guide for beat detection, frequency analysis, temporal state
- Examples: simple beat tracking, frequency band monitoring
- File: `docs/03-guides/audio_reactive_pattern_guide.md`
- Effort: 1-2 days
- Owner: Audio/DSP specialist

**Task 3: Performance Profiling Tools**
- Integrate FPS counter, per-pattern timing
- Add `/api/device/performance` endpoint (diagnostics)
- File: Implementation in `firmware/src/diagnostics.h`
- Effort: 2-3 days
- Owner: Firmware lead

**Task 4: Parameter Binding System**
- Formalize parameter UI ↔ firmware mapping
- Document parameter ranges, defaults, validation
- File: `docs/06-reference/parameter_binding_reference.md`
- Effort: 1-2 days
- Owner: Web/firmware bridge developer

**Total Effort:** 6-10 days (easily fits in Phase 2D1 schedule)

### Phase C Tasks (Stateful Node System)

**Task 1: Node Type Definitions (Week 1)**
- Define 8 node types in TypeScript (8-core_types.ts)
- Input/output contracts, parameter schemas
- Effort: 3-4 days
- Owner: Codegen architect

**Task 2: Code Generation Templates (Week 1-2)**
- Handlebars templates for each node type
- State initialization, reset guards, operation code
- Effort: 3-4 days
- Owner: Codegen architect

**Task 3: Validation Pipeline (Week 2-3)**
- Topological sort (circular dependency detection)
- Data-flow analysis (read-before-write checks)
- Size validation (buffer consistency)
- Effort: 3-4 days
- Owner: Codegen architect

**Task 4: Code Generation Main (Week 3)**
- Orchestrate template → C++ transformation
- Error reporting (meaningful messages, line numbers)
- Integration with build system
- Effort: 2-3 days
- Owner: Codegen architect

**Task 5: PoC Validation (Week 2 parallel)**
- Generate `buffer_persist` node type
- Test against `draw_bloom()` reference
- Benchmark performance, correctness
- Effort: 2-3 days
- Owner: Firmware + codegen architects

**Task 6: Pattern Library (Week 4-6)**
- Port 5-10 hand-coded patterns to node graphs
- Validate generation, performance, correctness
- Document pattern examples
- Effort: 4-5 days
- Owner: Pattern developers

**Task 7: Testing Infrastructure (Week 5-6)**
- Unit tests for code generation
- Integration tests for generated patterns
- Performance benchmarks (hand-coded vs generated)
- Effort: 3-4 days
- Owner: QA/test engineer

**Task 8: Documentation (Week 7-8)**
- Node type reference, generation algorithm, examples
- Troubleshooting guide, common mistakes
- Migration guide (C++ to graphs)
- File: `docs/03-guides/stateful_node_guide.md`
- Effort: 2-3 days
- Owner: Documentation lead

**Total Effort:** 24-32 engineer-days (~6-8 weeks, 1 full-time engineer)

### Related Files & References

**Firmware:**
- Current patterns: `firmware/src/generated_patterns.h`
- Pattern registry: `firmware/src/pattern_registry.h`
- Audio interface: `firmware/src/audio_interface.h`
- Codegen infrastructure (archived): `codegen/` directory

**Documentation:**
- Architecture overview: `docs/01-architecture/K1NArch_ASSESSMENT_STATEFUL_NODE_FEASIBILITY_v1.0_20251108.md`
- Related decision: `docs/02-adr/ADR-0006-codegen-abandonment.md`
- Related architecture: `docs/02-adr/ADR-0007-stateful-node-architecture.md`

**Tests:**
- Pattern validation: `firmware/test/test_pattern_generation/`
- Performance benchmarks: `firmware/test/test_pattern_performance/`

---

## Implementation Timeline

### Phase 2D1 (Weeks 1-7)
- **Week 1-2:** C++ SDK formalization (pattern template, guide)
- **Week 3-4:** Audio-reactive best practices guide
- **Week 5-6:** Performance profiling tools integration
- **Week 7:** Documentation finalization, parameter binding review

**Parallel (Critical fixes):** All critical bugs and fixes from Phase 2D1 roadmap

### Phase C (Weeks 8-14, parallel with Phase 2D1 weeks 5-7)
- **Week 1 (overlap):** Node type definitions, codegen template structure
- **Week 2 (overlap):** Code generation templates, early PoC validation
- **Week 3-4:** Validation pipeline implementation
- **Week 5-6:** Pattern library generation, testing
- **Week 7-8:** Documentation, final validation

**Go/No-Go Gate:** End of Week 2
- PoC generates valid C++ from JSON
- Generated code within 2% performance of hand-coded
- Decision: Proceed to full system or pivot

### Phase D+ (Future)
- Visual pattern editor UI
- Pattern marketplace infrastructure
- Community features (sharing, templates)

---

## Superseded By

(None yet - this is a new architecture decision)

---

## References

1. **Feasibility Assessment:**
   - `docs/01-architecture/K1NArch_ASSESSMENT_STATEFUL_NODE_FEASIBILITY_v1.0_20251108.md`
   - Section 2: "Codegen Requirements for Stateful Nodes"
   - Section 3: "Performance Impact Assessment"
   - Appendix B: "Code Generation Example"

2. **Related Architecture Decisions:**
   - ADR-0006: Codegen Abandonment (strategic reversal to restore graphs)
   - ADR-0007: Stateful Node Architecture (node types and implementation strategy)
   - ADR-0002: Node System Core USP (market positioning)

3. **Implementation Roadmaps:**
   - `Implementation.plans/roadmaps/PHASE_2D1_EXECUTION_ROADMAP.md`
   - `Implementation.plans/roadmaps/PHASE_C_PLANNING.md` (placeholder for Phase C planning)

4. **Current Implementation:**
   - `firmware/src/generated_patterns.h` (17 hand-coded patterns)
   - `firmware/src/pattern_registry.h` (pattern registry)
   - `codegen/` (existing codegen infrastructure - archived)

5. **Performance Benchmarks:**
   - Baseline: `docs/09-reports/phase_2d1_performance_baseline.md` (to be created)
   - PoC Validation: `docs/09-reports/phase_c_codegen_poc_validation.md` (to be created)

---

## Discussion & Approval

### Open Questions

- [ ] Is phased approach acceptable vs. full commitment to graphs?
- [ ] Are 8 core node types sufficient, or should scope expand?
- [ ] How aggressive should Phase C timeline be (parallel vs. sequential)?
- [ ] What is fallback strategy if PoC underperforms (Week 2-3)?
- [ ] Should parameter-only editor ship in Phase 2D1 or defer to Phase C?

### Architecture Review Checklist

- [ ] **Technical soundness:** Decision is feasible and doesn't violate constraints
  - Confirmed: Feasibility assessment proves stateful nodes <2% performance overhead

- [ ] **Strategic alignment:** Decision supports market positioning and USP
  - Confirmed: Graph system enables 10-12x TAM expansion and visual editor USP

- [ ] **Implementation feasibility:** Team can execute in allocated timeline
  - Confirmed: Phase 2D1 (6-10 days SDK), Phase C (24-32 days codegen)

- [ ] **Risk mitigation:** Identified risks have fallback plans
  - Confirmed: PoC gate (Week 2) gates full commitment; pivot-back to C++ SDK available

- [ ] **Performance validation:** Decision meets performance targets
  - Confirmed: Baseline benchmarks required, performance regression tests gate approval

### Approver Assignments

- [ ] **@spectrasynq** (Architecture steward) - Decision authority
- [ ] **@firmware_lead** (Embedded/firmware domain expert) - Implementation feasibility
- [ ] **@codegen_architect** (Code generation specialist) - Technical soundness
- [ ] **@product_lead** (Market/strategy) - Strategic alignment
- [ ] **@qa_lead** (Quality/performance) - Performance validation

### Sign-Off Status

- [ ] Architecture review: **PENDING** (requires approval by @spectrasynq)
- [ ] Technical feasibility: **PENDING** (requires sign-off by @firmware_lead + @codegen_architect)
- [ ] Strategic alignment: **PENDING** (requires sign-off by @product_lead)
- [ ] Performance review: **PENDING** (requires baseline measurement by @qa_lead)

---

## Appendices

### Appendix A: Stateful Node Reference

Complete specification of 8 core node types:

#### 1. buffer_persist (Input: float, Output: float)
**Purpose:** Frame-to-frame float buffer with decay
**State:** 720 bytes (180 floats × 4 bytes)
**Parameters:**
- `size: int` (default: NUM_LEDS)
- `decay: float` (default: 0.95)
- `reset_on_change: bool` (default: true)

**Generated Code Pattern:**
```cpp
static float {{id}}_buffer[{{size}}] = {0.0f};

// Decay each frame
for (int i = 0; i < {{size}}; i++) {
    {{id}}_buffer[i] *= {{decay}}f;
}

// Input injection (from wired input node)
{{id}}_buffer[0] = fmaxf({{id}}_buffer[0], input_value);
```

#### 2. color_persist (Input: CRGBF, Output: CRGBF)
**Purpose:** Frame-to-frame RGB color buffer
**State:** 2,160 bytes (180 CRGBF × 12 bytes)
**Parameters:**
- `size: int` (default: NUM_LEDS)
- `decay: float` (default: 0.95)
- `reset_on_change: bool` (default: true)

#### 3. sprite_scroll (Input: float, Output: CRGBF)
**Purpose:** Scrolling effects with energy injection at center
**State:** 4,320 bytes (2 × 180 CRGBF buffers for double-buffering)
**Parameters:**
- `direction: enum` ("outward"|"inward", default: "outward")
- `speed: float` (default: 0.5)
- `decay: float` (default: 0.95)

#### 4. wave_pool (Input: float, Output: float)
**Purpose:** Wave propagation and interference simulation
**State:** 1,440 bytes (180 floats for wave height map)
**Parameters:**
- `size: int` (default: NUM_LEDS)
- `damping: float` (default: 0.95)
- `radius: float` (default: 1.0)

#### 5. gaussian_blur (Input: float, Output: float)
**Purpose:** Spatial smoothing / blur effect
**State:** 1,440 bytes (temporary blur buffer)
**Parameters:**
- `size: int` (default: NUM_LEDS)
- `sigma: float` (default: 2.0, blur strength)
- `reset_on_change: bool` (default: false, stateless operation)

#### 6. phase_accumulator (Input: float, Output: float)
**Purpose:** Continuous phase tracking for rotating/cycling effects
**State:** 4 bytes (single float)
**Parameters:**
- `rate: float` (default: 0.01, phase increment per frame)
- `reset_on_change: bool` (default: true)

#### 7. beat_history (Input: bool, Output: float[])
**Purpose:** Temporal beat detection and history tracking
**State:** 512 bytes (32-entry beat history)
**Parameters:**
- `history_size: int` (default: 32)
- `decay_rate: float` (default: 0.98)
- `reset_on_change: bool` (default: false, persistent across pattern changes)

#### 8. energy_gate (Input: float, Output: float)
**Purpose:** Threshold-based trigger/gating logic
**State:** 4 bytes (single float for last triggered value)
**Parameters:**
- `threshold: float` (default: 0.5)
- `attack_ms: int` (default: 50)
- `release_ms: int` (default: 200)

---

### Appendix B: Code Generation Example

**Input Graph (JSON):**
```json
{
  "name": "bloom_trail",
  "audio_reactive": true,
  "nodes": [
    {
      "id": "trail",
      "type": "buffer_persist",
      "parameters": {
        "size": 180,
        "decay": 0.95,
        "reset_on_change": true
      }
    },
    {
      "id": "audio_in",
      "type": "audio_level",
      "parameters": {
        "band": "bass"
      }
    },
    {
      "id": "bloom",
      "type": "sprite_scroll",
      "parameters": {
        "direction": "outward",
        "speed": 0.5,
        "decay": 0.95
      },
      "inputs": ["trail"]
    },
    {
      "id": "palette_map",
      "type": "palette_interpolate",
      "parameters": {
        "palette_id": 0
      },
      "inputs": ["bloom"]
    },
    {
      "id": "output",
      "type": "output",
      "inputs": ["palette_map"]
    }
  ]
}
```

**Generated C++ Code:**
```cpp
void draw_bloom_trail(float time, const PatternParameters& params) {
    // State declarations (generated from node definitions)
    static float trail_buffer[180] = {0.0f};
    static CRGBF bloom_buffer[180] = {0};
    static CRGBF bloom_prev[180] = {0};
    static uint8_t last_pattern_id = 255;

    // Reset guards (on pattern change)
    if (get_current_pattern_id() != last_pattern_id) {
        memset(trail_buffer, 0, sizeof(trail_buffer));
        memset(bloom_buffer, 0, sizeof(bloom_buffer));
        memset(bloom_prev, 0, sizeof(bloom_prev));
        last_pattern_id = get_current_pattern_id();
    }

    // Audio snapshot
    PATTERN_AUDIO_START();
    if (!AUDIO_IS_FRESH()) return;

    // Node: audio_in (audio_level band=bass)
    float audio_in_output = AUDIO_BASS();

    // Node: trail (buffer_persist with decay)
    for (int i = 0; i < 180; i++) {
        trail_buffer[i] *= 0.95f;
    }
    trail_buffer[0] = fmaxf(trail_buffer[0], audio_in_output);

    // Node: bloom (sprite_scroll outward)
    draw_sprite(bloom_buffer, bloom_prev, 180, 180, 0.5f, 0.95f);
    bloom_buffer[90] += CRGBF(audio_in_output * 255.0f, 0, 0);
    memcpy(bloom_prev, bloom_buffer, sizeof(CRGBF) * 180);

    // Node: palette_map (palette_interpolate)
    for (int i = 0; i < 180; i++) {
        float brightness = bloom_buffer[i].r / 255.0f;
        leds[i] = color_from_palette(params.palette_id, i/180.0f, brightness);
    }
}
```

**Equivalent Hand-Written C++:**
```cpp
void draw_bloom_trail(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();
    if (!AUDIO_IS_FRESH()) return;

    static float trail[180] = {0.0f};
    static CRGBF bloom[180] = {0};
    static CRGBF bloom_prev[180] = {0};

    float bass = AUDIO_BASS();

    // Decay and inject
    for (int i = 0; i < 180; i++) trail[i] *= 0.95f;
    trail[0] = fmaxf(trail[0], bass);

    // Bloom sprite
    draw_sprite(bloom, bloom_prev, 180, 180, 0.5f, 0.95f);
    bloom[90] += CRGBF(bass * 255.0f, 0, 0);
    memcpy(bloom_prev, bloom, sizeof(CRGBF) * 180);

    // Render
    for (int i = 0; i < 180; i++) {
        float brightness = bloom[i].r / 255.0f;
        leds[i] = color_from_palette(params.palette_id, i/180.0f, brightness);
    }
}
```

**Comparison:**
- **Generated:** 45 lines (verbose due to explicit node operations)
- **Hand-written:** 18 lines (compact, obvious intent)
- **Readability:** Hand-written is clearer; generated is maintainable
- **Performance:** Identical (compiler optimizes both to same machine code)
- **Verdict:** Hand-written preferred for complex patterns; generated useful for component library reuse

---

### Appendix C: Performance Benchmarks (Baseline & PoC Results)

**To be completed during Phase 2D1 and Phase C**

**Baseline Measurements (Phase 2D1 completion):**
Will document in `docs/09-reports/phase_2d1_performance_baseline.md`
- FPS per pattern (hand-coded C++)
- Frame time breakdown (audio snapshot, pattern logic, LED write)
- Memory usage (heap, stack, state buffers)
- Compiler output (code size, optimization effectiveness)

**PoC Validation (Phase C, Week 2):**
Will document in `docs/09-reports/phase_c_codegen_poc_validation.md`
- Generated code performance vs. hand-coded reference
- PoC target: <2% FPS difference acceptable
- Compiler output comparison (code size delta)
- Memory usage comparison (state buffer overhead)

---

### Appendix D: Hybrid Pattern Registry Example

**Complete registry structure:**
```cpp
// firmware/src/pattern_registry.h

const PatternEntry PATTERN_REGISTRY[] = {
    // Hand-coded C++ patterns (existing)
    {
        .id = PATTERN_BLOOM,
        .name = "Bloom",
        .draw_fn = draw_bloom,
        .audio_reactive = true,
        .is_generated = false,
        .memory_usage = 0,
        .params = &BLOOM_DEFAULTS
    },
    {
        .id = PATTERN_PULSE,
        .name = "Pulse",
        .draw_fn = draw_pulse,
        .audio_reactive = true,
        .is_generated = false,
        .memory_usage = 0,
        .params = &PULSE_DEFAULTS
    },
    // ... more hand-coded patterns

    // Generated patterns (Phase C)
    {
        .id = PATTERN_WAVE_POOL,
        .name = "Wave Pool",
        .draw_fn = draw_generated_wave_pool,
        .audio_reactive = true,
        .is_generated = true,
        .memory_usage = 1440,  // wave_pool buffer
        .params = &WAVE_POOL_DEFAULTS
    },
    {
        .id = PATTERN_TRAIL_BLOOM,
        .name = "Trail Bloom",
        .draw_fn = draw_generated_trail_bloom,
        .audio_reactive = true,
        .is_generated = true,
        .memory_usage = 720,   // buffer_persist + sprite state
        .params = &TRAIL_BLOOM_DEFAULTS
    },
    // ... more generated patterns

    // Terminator
    {.id = 0xFF}
};

#define NUM_PATTERNS (sizeof(PATTERN_REGISTRY) / sizeof(PatternEntry) - 1)
```

---

## Document Status

**Status:** ACCEPTED (ready for implementation)

**Version:** v1.0

**Last Updated:** 2025-11-10

**Next Review Due:** 2026-02-10 (follow-up post-Phase C completion)

**Recommendation:** **PROCEED with hybrid phased approach** - formalize C++ SDK in Phase 2D1, build stateful node system in Phase C with PoC validation gate.

---

<!-- markdownlint-enable MD013 -->

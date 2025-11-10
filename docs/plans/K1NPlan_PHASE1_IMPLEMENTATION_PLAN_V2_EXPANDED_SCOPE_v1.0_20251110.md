# Phase 1 Implementation Plan v2: K1.node1 Compiler & Graph System (35-40 Nodes, Expanded Scope)

**Version:** 2.0 (UPDATED)
**Date:** November 10, 2025
**Timeline:** Days 1–11 (9–11 day execution window, up from 7-10)
**Status:** Ready for team execution (SCOPE-ADJUSTED)
**Scope:** 35-40 node types (Emotiscope/SensoryBridge parity), not 14
**Related:**
- `docs/04-planning/K1NPlan_TASK_ROADMAP_CORRECTED_v1.0_20251110.md` (AUTHORITATIVE)
- `docs/plans/2025-11-10-phase1-compiler-design.md` (original design doc)
- `docs/06-reference/K1NRef_GRAPH_NODE_CATALOG_v1.0_20251110.md` (14-node baseline; will be REPLACED with 35-40 node version)

---

## Executive Summary: What Changed

**Original Plan (v1):** 14 node types, 7-10 day timeline, basic compiler
**Updated Plan (v2):** 35-40 node types, 9-11 day timeline, **production-grade compiler**

| Dimension | v1 (14 nodes) | v2 (35-40 nodes) | Impact |
|-----------|---|---|---|
| Parser Complexity | ~4-6h | ~8-10h | Type system 2.5× larger, multi-output nodes |
| Validator Rules | ~1 day | ~1.5-2 days | Filter chains, RNG cycles, multi-buffer coercions |
| Optimizer Passes | ~0.75 days | ~1.5 days | CSE across stateful boundaries, filter analysis |
| Scheduler/Allocator | ~1.5 days | ~2.5-3 days | Multi-buffer composition, view vs. copy semantics |
| Emitter (C++ Gen) | ~2 days | ~3-4 days | 35+ node generators, Perlin/gradient/dot algorithms |
| Testing Suite | ~1.5 days | ~2.5-3 days | 80-100+ tests vs. 50+, more edge cases |
| **Total Timeline** | **7-10 days** | **9-11 days** | +2 days buffer for high-risk compiler work |

**Risk Assessment:** Task 5 (Compiler) is marked **HIGH RISK** in authoritative roadmap (line 200-203). This plan mitigates via:
- Daily check-ins (compiler lead + firmware lead)
- Staged deliverables (schema → parser → validator before emitter)
- Early code review gates (after parser, after validator, after scheduler)
- Hardware PoC on Days 6-7 (catch integration issues early)

---

## Scope: 35-40 Node Types (Emotiscope/SensoryBridge Parity)

From authoritative roadmap (Task 5, lines 142-146):

### Input Nodes (8-10 types)
- `Time` — elapsed seconds
- `AudioSnapshot` — VU/envelope (1 scalar)
- `AudioSpectrum` — FFT bins (NUM_FREQS, typically 64)
- `AudioEnvelope` — energy/RMS (scalar, variant of AudioSnapshot)
- `BeatEvent` — beat pulse detection
- **`AutoCorrelation`** — pitch_hz, confidence (NEW)
- **`Chromagram`** — 12-point chroma vector (NEW)
- `ParamF` — float parameter from UI
- `ParamColor` — color parameter from UI
- **`ConfigToggle`** — bool parameter (NEW)

### Math/Filters (8-10 types)
- `Add`, `Mul` — basic arithmetic
- `Mix` — weighted blend of two scalars
- `Clamp` — bound value to range
- `Contrast` — S-curve contrast adjustment
- `Pow`, `Sqrt` — nonlinear math
- **`LowPass`** — 1-pole IIR filter (NEW)
- **`MovingAverage`** — rolling window smoother (NEW)
- `Lerp` — linear interpolation

### Gradient/Color (5-6 types)
- `Hsv` — HSV to RGB conversion
- `Color` — explicit RGB constructor
- **`GradientMap`** — palette lookup table (NEW)
- **`Desaturate`** — grayscale conversion (NEW)
- **`ForceSaturation`** — color mode toggle (saturation override) (NEW)
- **`PaletteSelector`** — indexed palette selection (NEW)

### Geometry/Buffer Operations (7-8 types)
- `Fill` — uniform color fill
- `Blur` — box filter convolution
- **`Mirror`** — vertical/horizontal flip with boundary strategy (NEW)
- **`Shift`** — rotate buffer by offset (NEW)
- **`Downsample`** — reduce resolution (NEW)
- **`DotRender`** — rasterize points/peak indicators (NEW)
- **`ComposeLayers`** — blend multiple buffers (base + overlay) (NEW)
- `BufferPersist` — trail/persistence with decay

### Noise/Procedural (3+ types)
- **`PerlinNoise`** — Perlin noise generator (stateful phase) (NEW)
- **`RngSeed`** — random seed node (NEW)
- **`PositionAccumulator`** — scanline/spiral position generator (NEW)

### Output Nodes (2 types)
- `LedOutput` — write buffer to device
- `LedOutputMirror` — write with mirror symmetry

**Total: ~40-45 node types** (prioritize top 35-40 for Phase 1)

---

## Team Structure & Assignments

**Three developer tracks (can run in parallel after day 1 setup):**

1. **Track A: Compiler Core (TypeScript)** — Days 1–8
   - Lead: Senior Compiler/TypeScript Engineer (this is HIGH RISK work)
   - Tasks: T1–T9 (Parser, Validator, Optimizer, Scheduler, Emitter, CLI, Extended Nodes)
   - **Daily standup with Firmware Lead (T2)**

2. **Track B: Firmware Integration** — Days 1–11
   - Lead: Embedded/Firmware Engineer
   - Tasks: T2, T10–T12 (Generated C++ skeleton, pattern registry, CI integration, hardware validation)
   - **Daily standup with Compiler Lead (T1)**

3. **Track C: Testing & Validation** — Days 3–11
   - Lead: QA/Test Engineer
   - Tasks: T13–T16 (Unit tests, E2E fixtures, hardware validation, docs)

**Coordination points:**
- Day 1 (kickoff): All teams + stakeholder review
- Day 2 EOD (parser schema): Code review gate #1
- Day 4 EOD (validator complete): Code review gate #2
- Day 6 EOD (scheduler/allocator): Code review gate #3
- Day 7 (emitter skeleton): Early hardware PoC begins
- Day 8 (extended nodes): Integration check-in
- Day 11 (final): All tests pass, ready for Phase 2 handoff

---

## Day 1: Kickoff & Foundation (Parallel Setup)

### T1: Compiler Scaffold & TypeScript Setup (35-40 Nodes Edition)

**Assigned to:** Compiler Lead
**Effort:** 4–6 hours
**Dependencies:** None (critical path)
**Risk:** LOW (scaffolding is standard)

**Scope Change from v1:**
- v1: Set up for 14 nodes
- v2: Set up infrastructure to handle 35-40 nodes (larger type registry, more complex port defs)

**Inputs:**
- Existing `codegen/` directory structure
- Authoritative roadmap (Task 5 scope expansion)
- Design document (`docs/plans/2025-11-10-phase1-compiler-design.md`)

**Tasks:**
1. Create TypeScript project structure:
   ```
   codegen/
     src/
       types.ts          # Type definitions (35-40 types, multi-output nodes)
       parser.ts         # Parser stage
       validator.ts      # Validator stage
       optimizer.ts      # Optimizer stage
       scheduler.ts      # Scheduler stage
       emitter.ts        # Emitter stage (large; node-specific generators)
       cli.ts            # CLI tool (k1c build, validate)
     schemas/
       graph.schema.json  # ✅ Already created (14 nodes; will expand to 40)
     fixtures/           # Test graphs
       bloom.json         # Emotiscope-style Bloom
       spectrum.json      # SensoryBridge Spectrum
       (add 5+ more for extended nodes)
     tests/
       types.test.ts
       parser.test.ts
       validator.test.ts
       optimizer.test.ts
       scheduler.test.ts
       emitter.test.ts
       integration.test.ts
   ```
2. Install dependencies (same as v1)
3. Create `package.json` with build/test/dev scripts
4. Add linting/code quality tools (`eslint`, `prettier`)
5. Initialize git tracking

**Outputs:**
- Clean TypeScript scaffold ready for 35-40 nodes
- `package.json` with build/test/dev scripts
- Compiles without errors

**Acceptance Criteria:**
- ✅ `npm run build` produces no errors
- ✅ `npm run test` runs (all tests skipped or stub)
- ✅ `k1c --help` displays help text
- ✅ Project structure matches expanded scope

---

### T2: Firmware Generated Code Skeleton (35-40 Nodes Edition)

**Assigned to:** Firmware Lead
**Effort:** 3–4 hours
**Dependencies:** None (parallel with T1)
**Risk:** LOW (template design is understood)

**Scope Change from v1:**
- v1: Template for 14-node patterns
- v2: Template must support complex node generators (Perlin, gradients, dot rendering, multi-buffer composition)

**Inputs:**
- Existing firmware structure
- Authoritative roadmap (extended node catalog)
- Existing helpers: `stateful_nodes.h`, `parameters.h`

**Tasks:**
1. Create firmware codegen directory:
   ```
   firmware/src/graph_codegen/
     pattern_*.cpp       # Generated per-pattern code
     graph_runtime.h     # Shared helpers (EXPANDED)
   ```
2. Expand `graph_runtime.h` with helpers for:
   - Basic: `clamped_rgb()`, `fill_buffer()`, `blur_buffer()`
   - NEW: `hsv_to_rgb()`, `gradient_map()`, `desaturate()`, `mirror_buffer()`, `shift_buffer()`, `downsample()`, `dot_render()`, `compose_layers()`
   - NEW: `perlin_noise_1d()`, `perlin_noise_2d()`, `lowpass_update()`, `moving_average_update()`
3. Create template `pattern_template.cpp`:
   ```cpp
   // Includes for stateful nodes, parameters, audio, helpers
   extern "C" void pattern_<name>_render(
       uint32_t frame_count,
       const AudioSnapshot& audio,
       const PatternParameters& params,
       PatternState& state,
       PatternOutput& out
   ) {
       // Persistent buffers
       // Temporary buffers
       // Compute (per node in schedule order)
       // Output (clamp + write)
   }
   ```
4. Add inline documentation referencing which helper each node uses

**Outputs:**
- `firmware/src/graph_codegen/graph_runtime.h` with 15+ helper functions
- `firmware/src/graph_codegen/pattern_template.cpp` for reference

**Acceptance Criteria:**
- ✅ Header compiles without errors
- ✅ All helper functions declared (implementations can be stubs for now)
- ✅ Template matches emitter's expected output shape
- ✅ Firmware can include this header alongside existing code

---

### T3: CI Integration Skeleton

**Assigned to:** DevOps/Build Lead
**Effort:** 2–3 hours
**Dependencies:** None (parallel with T1, T2)
**Risk:** LOW

**Inputs:**
- Existing CI config (GitHub Actions)
- Schema file (created in v1)

**Tasks:**
1. Create `.github/workflows/codegen-validate.yml`:
   - Schema validation on all fixtures
   - TypeScript compiler build
   - Jest tests with coverage
   - Size check (generated C++ <15 KB per pattern)
2. Add schema validation to CLI
3. Create pre-commit hook (optional but recommended)

**Outputs:**
- `.github/workflows/codegen-validate.yml` ready to trigger on PR
- CLI schema validation function

**Acceptance Criteria:**
- ✅ Workflow file is valid YAML
- ✅ Triggers on push/PR
- ✅ CLI schema validation callable

---

## Days 2–5: Core Compiler Implementation (Track A, Parallel)

### T4: Type System & Parser Stage (Expanded to 35-40 Nodes)

**Assigned to:** Compiler Lead
**Effort:** 8–10 hours (up from 4-6h in v1)
**Dependencies:** T1 (scaffold complete)
**Parallel with:** T5, T6, T7, T2, T12
**Risk:** MEDIUM (larger registry, more complex ports)

**Code Review Gate:** After parser complete (Day 2 EOD)

**Scope Change from v1:**
- v1: Define 14 nodes; simple port definitions
- v2: Define 35-40 nodes; multi-output nodes (AutoCorrelation outputs pitch_hz + confidence); handle Emotiscope/SensoryBridge features

**Detailed Tasks:**

#### T4a: Type System Definition (6-8 hours)

1. Implement `types.ts` enum + interfaces:
   - Extend `PortType` enum to include all 16 port types
   - Add node type registry with **35-40 entries** (not 14)
   - Multi-output node support (e.g., AutoCorrelation: pitch_hz, confidence)

2. Create comprehensive `NodeTypeRegistry`:
   ```typescript
   // Input nodes (10 types)
   ["Time", { inputs: [], params: [], output: PortType.TIME, ... }],
   ["AudioSpectrum", { inputs: [], params: [], output: PortType.AUDIO_SPECTRUM, ... }],
   ["AutoCorrelation", {
       inputs: [{ name: "audio", type: PortType.AUDIO_SPECTRUM }],
       params: [],
       output: [PortType.FLOAT, PortType.FLOAT], // [pitch_hz, confidence]
       ...
   }],
   ["Chromagram", {
       inputs: [{ name: "audio", type: PortType.AUDIO_SPECTRUM }],
       params: [],
       output: PortType.VEC12, // 12-point chroma (or use array type)
       ...
   }],
   // ... 6 more input nodes

   // Math/Filter nodes (10 types)
   ["Add", { ... }],
   ["LowPass", {
       inputs: [{ name: "src", type: PortType.FLOAT }, { name: "alpha", type: PortType.FLOAT, default: 0.1 }],
       params: [],
       output: PortType.FLOAT,
       is_stateful: true,  // Maintains last value
       memory_bytes: 4,
       ...
   }],
   ["MovingAverage", {
       inputs: [{ name: "src", type: PortType.FLOAT }],
       params: [{ name: "window_size", type: "int", min: 1, max: 32, default: 4 }],
       output: PortType.FLOAT,
       is_stateful: true,
       memory_bytes: 128, // 32 × float
       ...
   }],
   // ... 8 more math nodes

   // Gradient/Color nodes (6 types)
   ["GradientMap", {
       inputs: [{ name: "index", type: PortType.FLOAT }],
       params: [{ name: "palette", type: "palette_id", enum: ["viridis", "plasma", "hot", ...], default: "viridis" }],
       output: PortType.COLOR,
       ...
   }],
   // ... 5 more color nodes

   // Geometry/Buffer nodes (8 types)
   ["Mirror", {
       inputs: [{ name: "src", type: PortType.LED_BUFFER_VEC3 }],
       params: [{ name: "axis", type: "enum", enum: ["vertical", "horizontal"], default: "vertical" }],
       output: PortType.LED_BUFFER_VEC3,
       ...
   }],
   ["ComposeLayers", {
       inputs: [
           { name: "base", type: PortType.LED_BUFFER_VEC3 },
           { name: "overlay", type: PortType.LED_BUFFER_VEC3 },
           { name: "blend_mode", type: "enum", enum: ["add", "multiply", "screen"], default: "add" }
       ],
       params: [],
       output: PortType.LED_BUFFER_VEC3,
       ...
   }],
   // ... 6 more geometry nodes

   // Noise/Procedural nodes (3 types)
   ["PerlinNoise", {
       inputs: [{ name: "x", type: PortType.FLOAT }, { name: "seed", type: PortType.RNG_SEED, default: 0 }],
       params: [{ name: "scale", type: "float", min: 0.01, max: 10.0, default: 1.0 }],
       output: PortType.FLOAT,
       is_stateful: false, // Deterministic; no internal state (but seed-based)
       ...
   }],
   // ... 2 more noise nodes
   ```

3. Add coercion rules (expand from v1):
   - int → float (implicit)
   - float → led_buffer via Fill (explicit)
   - vec3 ↔ color (alias)
   - NEW: band_index (int) → float (implicit, for palette lookups)
   - NEW: forbid implicit chromagram → any (must unpack explicitly in Phase 2)

4. Write comprehensive type tests:
   - All 35-40 nodes in registry
   - Multi-output node handling
   - Coercion rules
   - Filter node detection (stateful math)

**Outputs:**
- `codegen/src/types.ts` with full 35-40 node registry
- `codegen/tests/types.test.ts` with 25-30 tests

**Acceptance Criteria:**
- ✅ All 35-40 node types defined in registry
- ✅ Multi-output nodes handled (e.g., AutoCorrelation)
- ✅ Coercion rules follow design doc + roadmap
- ✅ Type tests pass
- ✅ **CODE REVIEW GATE #1 (Day 2 EOD)** — Reviewer checks: all nodes present, port definitions match roadmap, coercions correct

---

#### T4b: Parser Implementation (SAME as v1, 8-10 hours)

Parse graph JSON → validate against schema → build AST with type checking

(Details same as original plan; no significant change for 35-40 vs. 14 nodes — parser complexity is linear in node count, not exponential)

**Outputs:**
- `codegen/src/parser.ts` with full parsing logic
- `codegen/tests/parser.test.ts` with 15+ tests
- Example graphs in `codegen/fixtures/` (bloom.json, spectrum.json, etc.)

**Acceptance Criteria:**
- ✅ Parser accepts valid graphs (schema + registry)
- ✅ Parser rejects invalid JSON with helpful errors
- ✅ AST structure matches design doc
- ✅ All parser tests pass

---

### T5: Validator Stage (Expanded Scope: 1.5-2 Days)

**Assigned to:** Compiler Lead OR second engineer (parallel)
**Effort:** 1.5-2 days (up from 1 day in v1)
**Dependencies:** T1 (scaffold), T4 (types + AST)
**Parallel with:** T6, T7, T2, T12
**Risk:** MEDIUM-HIGH (filter chains, RNG cycles, multi-buffer coercions)

**Code Review Gate:** After validator complete (Day 4 EOD)

**Scope Change from v1:**
- v1: Basic validation (cycles, types, memory, params)
- v2: + Filter chain analysis (LowPass → MovingAverage → output must preserve signal flow)
- v2: + RNG cycle detection (RngSeed → PerlinNoise → buffer must not feed back to RNG)
- v2: + Multi-buffer coercion rules (ComposeLayers blend mode validation)
- v2: + Chromagram unpacking (phase 1: forbid; phase 2: explicit unpack node)

**Detailed Tasks:**

1. Implement validation checks (in order):
   - **Cycle detection** (Kahn's algorithm, same as v1)
   - **Port connectivity** (required inputs must be connected; optional have defaults)
   - **Type compatibility** (basic, same as v1 but more coercions to check)
   - **Filter chain validation** (NEW):
     - If LowPass or MovingAverage, validate input is float/spectrum (not buffer)
     - Track filter state lifetimes (must end before pattern end)
   - **RNG cycle detection** (NEW):
     - If RngSeed present, build RNG → consumer graph
     - Forbid RNG output feeding back to RNG input (must be tree, not DAG)
   - **Multi-buffer coercion** (NEW):
     - ComposeLayers must have compatible input buffer types
     - Blend modes must be valid (add, multiply, screen, etc.)
   - **Memory budget** (same as v1)
   - **Parameter bounds** (same as v1)
   - **Chromagram handling** (NEW):
     - If Chromagram → *output*, reject with helpful error: "Use explicit unpack node in Phase 2"

2. Error messages (expand coverage):
   - "Filter chain error: LowPass requires float or spectrum input, got led_buffer"
   - "RNG cycle: RngSeed → PerlinNoise → [path] → RngSeed (not allowed)"
   - "ComposeLayers: blend_mode='invalid' not in [add, multiply, screen]"
   - "Chromagram output to pattern not supported; use unpack node (Phase 2)"

3. Write validator tests:
   - Valid graphs (including filter chains, RNG usage)
   - Cycle detection (loops, self-refs)
   - Type mismatches (expanded set)
   - Filter chain errors
   - RNG cycle rejection
   - Multi-buffer errors

**Outputs:**
- `codegen/src/validator.ts` with all validation checks
- `codegen/tests/validator.test.ts` with 40-50 tests

**Acceptance Criteria:**
- ✅ Detects all error types from roadmap + v1
- ✅ Rejects RNG cycles with clear error
- ✅ Validates filter chain signal flow
- ✅ Rejects chromagram passthrough (Phase 1)
- ✅ Accepts all valid 35-40 node combinations
- ✅ Error messages are actionable
- ✅ **CODE REVIEW GATE #2 (Day 4 EOD)** — Reviewer checks: all validation rules present, error messages clear, test coverage >85%

---

### T6: Optimizer Stage (Expanded Scope: 1.5 Days)

**Assigned to:** Compiler Lead OR second engineer (parallel)
**Effort:** 1.5 days (up from 0.75 days in v1)
**Dependencies:** T1 (scaffold), T4 (types), T5 (validated AST)
**Parallel with:** T5, T7, T2, T12
**Risk:** MEDIUM (stateful node handling, filter chain CSE)

**Scope Change from v1:**
- v1: Basic constant folding, CSE, DCE
- v2: + Filter chain analysis (don't CSE across stateful filter boundaries unless identical state)
- v2: + Palette/lookup table optimization (fold GradientMap precompute)
- v2: + RNG determinism (don't fold RNG nodes; mark deterministic)

**Detailed Tasks:**

1. Optimization passes (in order):

   **a) Constant Folding** (same as v1)
   - If all inputs to pure node are constants/literals, pre-compute

   **b) Palette Precomputation** (NEW)
   - If GradientMap has constant palette + variable index → can precompute lookup table
   - Emit as static array in generated C++

   **c) Common Subexpression Elimination (CSE)** (expanded)
   - Original: deduplicate identical subexpressions
   - NEW: Skip RNG/PerlinNoise nodes (non-deterministic)
   - NEW: Don't CSE across LowPass/MovingAverage if internal state differs
   - Heuristic: if two filter nodes have same input + params but different state lineage, DON'T merge

   **d) Dead-Code Elimination** (same as v1)
   - Backward traversal from output nodes; remove unreachable

2. Write optimizer tests:
   - Constant folding (pure nodes with const inputs)
   - CSE (identical subexpressions, skipping RNG)
   - Filter chain CSE (correct: identical + same state lineage; incorrect: different lineage)
   - DCE (unused nodes removed)
   - Palette precomputation (GradientMap optimization)

**Outputs:**
- `codegen/src/optimizer.ts` with 4+ optimization passes
- `codegen/tests/optimizer.test.ts` with 15-20 tests

**Acceptance Criteria:**
- ✅ Constant folding works
- ✅ CSE deduplicates but respects stateful node boundaries
- ✅ RNG nodes NOT folded or CSEd
- ✅ Palette precomputation works (GradientMap)
- ✅ DCE removes unreachable nodes
- ✅ Optimizer preserves AST correctness

---

### T7: Scheduler & Allocator (Expanded Scope: 2.5-3 Days)

**Assigned to:** Compiler Lead OR second engineer (parallel after T5)
**Effort:** 2.5-3 days (up from 1.5 days in v1)
**Dependencies:** T1 (scaffold), T5 (validated AST)
**Parallel with:** T6, T2, T12
**Risk:** MEDIUM-HIGH (multi-buffer allocation, view vs. copy semantics)

**Code Review Gate:** After scheduler complete (Day 6 EOD)

**Scope Change from v1:**
- v1: Linear-scan allocator, buffer lifetime analysis
- v2: + Multi-buffer operations (ComposeLayers, Downsample create new views/copies)
- v2: + Filter state allocation (LowPass, MovingAverage stateful buffers)
- v2: + Palette table allocation (GradientMap lookup)
- v2: + Perlin noise state allocation (seed → deterministic output; no state, but seed-dependent)

**Detailed Tasks:**

#### T7a: Topological Schedule + Filter State Tracking (8-10 hours)

1. Topological sort (Kahn's algorithm)
2. Filter state tracking:
   - For each LowPass/MovingAverage, allocate persistent state buffer
   - Track state lifetime (from node creation to pattern end)
3. Write tests for deterministic ordering with filters

**Outputs:**
- Execution order list
- Filter state allocations

---

#### T7b: Buffer Allocation & Lifetime Analysis (12-16 hours)

1. Implement allocator logic:
   ```typescript
   export interface BufferAllocation {
     name: string;  // e.g., "temp_buf_0", "filter_state_0"
     node_id: string;
     type: PortType;
     size_bytes: number;
     lifetime: { start_order: number, end_order: number };
     is_persistent: boolean;
     semantics: "copy" | "view";  // NEW: distinguish copies vs. views
   }
   ```

2. Allocation strategy:
   - Identify buffer-producing nodes (Fill, Blur, Mirror, Shift, Downsample, DotRender, ComposeLayers, BufferPersist, LedOutput)
   - For each, compute lifetime
   - **NEW:** Distinguish "view" nodes (Mirror, Shift, Downsample - can alias) vs. "copy" nodes (Blur, DotRender - need their own buffer)
   - Persistent buffers: BufferPersist, filter states, palette tables
   - Temporary buffers: pooled in 16 KB scratch (or flag `--scratch-cap`)
   - Total persistent per pattern <1 KB (per ADR-0007)

3. Validation:
   - Total temp ≤ 16 KB (default cap)
   - Total persistent ≤ 1 KB per stateful node
   - No temporal overlaps in temp pool

4. Write scheduler tests:
   - Simple pipeline (linear)
   - Filter chains (state allocation)
   - Multi-buffer operations (ComposeLayers, Mirror)
   - Complex graph (branching, merging, multiple outputs)
   - Memory budget enforcement

**Outputs:**
- `codegen/src/scheduler.ts` with schedule + allocation
- `codegen/tests/scheduler.test.ts` with 20-25 tests

**Acceptance Criteria:**
- ✅ Topological order is valid
- ✅ Buffer lifetimes computed correctly
- ✅ View nodes correctly aliased (no extra allocations)
- ✅ Persistent buffers <1 KB per stateful node
- ✅ Temp buffers <16 KB total (with overflow detection)
- ✅ Allocation names unique + descriptive
- ✅ **CODE REVIEW GATE #3 (Day 6 EOD)** — Reviewer checks: allocation strategy sound, memory bounds verified, test coverage >85%

---

### T8: Emitter (C++ Code Generator) — LARGEST TASK (3-4 Days)

**Assigned to:** Compiler Lead OR third engineer (parallel after T7)
**Effort:** 3-4 days (up from 2 days in v1)
**Dependencies:** T1 (scaffold), T7 (allocations)
**Parallel with:** None (on critical path)
**Risk:** HIGH (complex node generators; firmware integration)

**Scope Change from v1:**
- v1: 14 node generators, simple
- v2: 35+ node generators including:
  - Filter algorithms (LowPass state update, MovingAverage ring buffer)
  - Lookup tables (GradientMap palette)
  - Algorithms (PerlinNoise, DotRender rasterization, mirror/shift logic)
  - Multi-buffer operations (ComposeLayers blending)

**Detailed Tasks:**

#### T8a: Code Generation Skeleton (6-8 hours)

1. Implement `emitter.ts` framework:
   ```typescript
   export interface NodeCodeGen {
     node_type: string;
     generate(node: NodeAST, inputs: Map<string, string>, allocations, registry): string;
   }

   export function emit(ast, schedule, allocations, registry): string {
     // Generate function signature
     // Generate buffer declarations
     // Generate compute statements (per node, in schedule order)
     // Generate output write + clamp
   }
   ```

2. Generate function signature + buffer declarations (same as v1)

3. Generate output write + color clamping (same as v1)

**Outputs:**
- Emitter skeleton ready for node generators

---

#### T8b: Node Code Generators (20-24 hours)

For each of 35-40 node types, implement code generator:

**Input Nodes (10 generators):**
- `Time`: `float time_val = frame_count / 30.0f;`
- `AudioSpectrum`: `auto spectrum = audio.spectrum;` (reference)
- `AudioEnvelope`: `float envelope = audio.envelope;`
- `BeatEvent`: `bool beat = (envelope > threshold) && (prev_envelope <= threshold);`
- `AutoCorrelation`: `float pitch = compute_pitch(spectrum); float conf = pitch_confidence(spectrum);`
- `Chromagram`: `auto chroma = compute_chroma(spectrum);`
- `ParamF`: `float param_val = params.<name>;`
- `ParamColor`: `CRGBF param_color = params.<name>;`
- `ConfigToggle`: `bool config_val = params.<name>;`
- (stubs for remaining)

**Math/Filter Nodes (10 generators):**
- `Add`: `float result = a + b;`
- `Mul`: `float result = a * b;`
- `Mix`: `float result = a * (1 - t) + b * t;`
- `Clamp`: `float result = std::clamp(val, min_val, max_val);`
- `LowPass`: `float filtered = state.last_val + alpha * (input - state.last_val); state.last_val = filtered;`
- `MovingAverage`: `state.ring_buf[state.idx] = input; float avg = (sum of ring_buf) / window_size; state.idx = (state.idx + 1) % window_size;`
- `Pow`, `Sqrt`, `Lerp`: straightforward
- (stubs for remaining)

**Color Nodes (6 generators):**
- `Hsv`: `CRGBF hsv_color = hsv2rgb(h, s, v);`
- `Color`: `CRGBF rgb = {r, g, b};`
- `GradientMap`: `CRGBF color = palette[std::clamp((int)(idx * palette_size), 0, palette_size - 1)];` (with palette table embedded)
- `Desaturate`: `float gray = 0.299*r + 0.587*g + 0.114*b; rgb = {gray, gray, gray};`
- `ForceSaturation`: `if (force_mode) { ... desaturate ...; } else { /* keep as is */ }`
- `PaletteSelector`: Similar to GradientMap

**Geometry Nodes (8 generators):**
- `Fill`: `for (int i = 0; i < NUM_LEDS; i++) buf[i] = color;`
- `Blur`: `blur_3x(src_buf, out_buf, NUM_LEDS, radius);`
- `Mirror`: `for (int i = 0; i < NUM_LEDS/2; i++) { buf[i] = src[i]; buf[NUM_LEDS-1-i] = src[i]; }`
- `Shift`: `for (int i = 0; i < NUM_LEDS; i++) out[i] = src[(i + offset) % NUM_LEDS];`
- `Downsample`: `for (int i = 0; i < NUM_LEDS; i += factor) out[i/factor] = src[i];`
- `DotRender`: `memset(buf, 0, ...); for (auto dot : dots) { if (dot.index < NUM_LEDS) buf[dot.index] = dot.color; }`
- `ComposeLayers`: `for (int i = 0; i < NUM_LEDS; i++) buf[i] = blend(base[i], overlay[i], mode);`
- `BufferPersist`: `for (int i = 0; i < NUM_LEDS; i++) persistent[i] = decay * persistent[i] + (1-decay) * src[i];`

**Noise Nodes (3 generators):**
- `PerlinNoise`: `float noise = perlin_noise_1d(x, seed, scale);` (call firmware helper or embed)
- `RngSeed`: `uint32_t rng_val = seed;` (read-only)
- `PositionAccumulator`: `float pos = (frame_count % cycle_length) / (float)cycle_length;`

**Output Nodes (2 generators):**
- `LedOutput`: `memcpy(out.leds, buf, NUM_LEDS * 3);`
- `LedOutputMirror`: `for (int i = 0; i < NUM_LEDS; i++) out.leds[i] = (i < NUM_LEDS/2) ? buf[i] : buf[NUM_LEDS-1-i];`

3. Emit all helper includes + namespace wrapping:
   ```cpp
   #include "graph_runtime.h"
   #include "../stateful_nodes.h"
   #include "../parameters.h"
   #include <algorithm>

   namespace pattern_<name> {
   // ... generated code ...
   }  // namespace

   extern "C" void pattern_<name>_render(...) {
     using namespace pattern_<name>;
     // ... call generated functions ...
   }
   ```

4. Write emitter tests:
   - Each node type generates syntactically valid C++
   - Variables match allocations
   - No undefined references
   - Filter state updates are correct
   - Multi-buffer operations are correct
   - Namespace wrapping is correct

**Outputs:**
- `codegen/src/emitter.ts` with 35+ node code generators
- `codegen/tests/emitter.test.ts` with 40-50 tests

**Acceptance Criteria:**
- ✅ All 35-40 node types have generators
- ✅ Generated C++ compiles without errors
- ✅ No undefined variables
- ✅ Filter state management is correct
- ✅ Multi-buffer operations verified
- ✅ Color clamping applied to output
- ✅ Namespace + include structure correct
- ✅ All emitter tests pass (40-50)

---

### T9: CLI Tool & Integration (4-6 Hours)

**Assigned to:** Compiler Lead
**Effort:** 4-6 hours (same as v1)
**Dependencies:** T8 (emitter complete)
**Serial after:** All stages complete

**Inputs:**
- All compiler stages (T4–T8)

**Tasks:**
1. Implement `cli.ts` with full pipeline:
   ```
   k1c build <graph.json> [--out <path>] [--scratch-cap <bytes>] [--debug]
   k1c validate <graph.json>
   k1c --version
   k1c --help
   ```

2. Add debug flags:
   - `--dump-ast` — output validated AST to JSON
   - `--dump-optimized` — output optimized AST
   - `--dump-scheduled` — output scheduled + allocated AST
   - `--dump-cpp` — output generated C++ before writing file

3. Error handling + reporting:
   - File not found → clear message
   - Parse errors → line/column info
   - Validation errors → node_id/type/port/location
   - Compiler errors → stage + error code (E1001–E1010)

**Outputs:**
- `codegen/src/cli.ts` fully functional
- Commands work as designed

**Acceptance Criteria:**
- ✅ `k1c build <graph.json>` generates C++ file
- ✅ File is written to correct firmware path
- ✅ Error handling is informative
- ✅ Debug flags work correctly
- ✅ CLI matches design doc

---

## Days 6–8: Extended Node Catalog (Track A, Sequential after Core)

### T10: Extended Node Implementations & Firmware Helpers (2-3 Days)

**Assigned to:** Compiler Lead + Firmware Lead (coordinated)
**Effort:** 2-3 days
**Dependencies:** T8 (emitter complete with core 14 nodes), T2 (firmware template)
**Parallel with:** T13 (testing), T12 (hardware prep)
**Risk:** MEDIUM (integration with firmware helpers)

**Scope:**
- Ensure all 35-40 node generators produce correct C++ that calls firmware helpers
- Implement missing firmware helpers (Perlin, gradients, etc.)
- Validate integration via E2E tests

**Detailed Tasks:**

1. Firmware helper implementation:
   - `perlin_noise_1d()`, `perlin_noise_2d()` (or link to existing FastLED Perlin)
   - `compute_pitch()`, `compute_chroma()` (FFT analysis)
   - `gradient_map()` lookup table
   - `mirror_buffer()`, `shift_buffer()`, `downsample_buffer()`
   - `dot_render()` rasterization
   - `compose_layers()` blending (add, multiply, screen)
   - Filter helpers (LowPass, MovingAverage state updates)

2. Compiler integration:
   - Verify all emitted C++ calls correct helper signatures
   - Add emitter tests for each helper call
   - Ensure no parameter mismatches

3. E2E test:
   - Generate Bloom graph with persistent buffer + LowPass filter
   - Compile to C++
   - Link against firmware helpers
   - Run CPU simulation → compare CRC with reference

**Outputs:**
- All 35-40 node generators verified to work with firmware
- Helper function implementations complete
- E2E tests passing for core + extended nodes

**Acceptance Criteria:**
- ✅ All 35-40 node generators call correct firmware helpers
- ✅ Firmware helpers compile + link correctly
- ✅ E2E test: generated C++ produces correct output
- ✅ No undefined references
- ✅ No linker errors

---

## Days 6–8: Testing Foundation (Track C, Parallel)

### T11: Unit Tests for Compiler Stages (2-3 Days)

**Assigned to:** Test Engineer
**Effort:** 2-3 days
**Dependencies:** T4–T9 (all stages complete)
**Parallel with:** T10, T12
**Risk:** LOW (straightforward testing)

**Detailed Tasks:**

1. Comprehensive test suites (50-80 tests total):
   - Parser tests (15-20): valid/invalid JSON, schema violations, error reporting
   - Validator tests (15-20): cycles, type mismatches, filter chains, RNG cycles, memory budget, param bounds
   - Optimizer tests (10-15): constant folding, CSE, DCE, filter chain handling, palette precomputation
   - Scheduler tests (10-15): topological order, buffer allocation, filter state tracking, memory bounds
   - Emitter tests (20-30): each node type, helper calls, namespace wrapping, includes
   - Integration tests (5-10): end-to-end pipeline (Bloom, Spectrum)

2. Test fixtures:
   - Valid graphs (Bloom, Spectrum, filter chain, multi-buffer)
   - Invalid graphs (cycles, type errors, RNG cycles, memory overrun, schema violations)
   - Edge cases (empty graph, single node, deeply nested)

3. Run coverage analysis: target ≥85% per module

**Outputs:**
- Comprehensive test suite (60-80 tests)
- Coverage report
- All tests passing

**Acceptance Criteria:**
- ✅ All tests pass
- ✅ ≥85% coverage per module
- ✅ Edge cases covered
- ✅ Error paths tested

---

### T12: E2E Golden Tests & Hardware PoC Setup (2-3 Days)

**Assigned to:** Test Engineer + Firmware Lead
**Effort:** 2-3 days
**Dependencies:** T9 (CLI works), T2 (firmware template), Days 6–8 (hardware available)
**Parallel with:** T10, T11
**Risk:** MEDIUM (hardware timing-dependent)

**Detailed Tasks:**

1. Create fixture graphs (6-8 fixtures):
   - `bloom.json` — AudioSpectrum + LowPass + BufferPersist + Mirror → Emotiscope Bloom
   - `spectrum.json` — AudioSpectrum + GradientMap + DotRender → SensoryBridge Spectrum
   - `beat_pulse.json` — Beat + Fill + BufferPersist
   - `filter_chain.json` — LowPass → MovingAverage → output
   - `noise_demo.json` — PerlinNoise + Fill
   - `multi_layer.json` — ComposeLayers with blend modes
   - `chromatic.json` — Chromagram → (Phase 2 placeholder)

2. Golden test procedure (per fixture):
   - Generate C++ via `k1c build <fixture.json>`
   - Copy to firmware
   - Build firmware: `pio run -e esp32-s3-devkitc-1`
   - Verify compiles (no errors/warnings)
   - Flash to device (Days 6-8)
   - Run pattern, record pixel CRC (checksum of all RGB values)
   - Store golden CRC: `codegen/fixtures/<name>.golden.crc`

3. CI validation:
   - Generate all fixtures
   - Verify firmware builds
   - (Optional: run CPU sim if implemented)

**Outputs:**
- 6-8 working fixture patterns
- Golden CRC files (reference baselines)
- E2E test harness (CI-ready)

**Acceptance Criteria:**
- ✅ All fixtures compile to valid C++
- ✅ Firmware builds without errors
- ✅ Device runs patterns without crash (Days 6-8)
- ✅ Golden CRCs captured

---

## Days 9–11: Final Integration, Testing, Handoff (Tracks B & C)

### T13: Hardware Validation & PoC Completion (2-3 Days, In-Situ)

**Assigned to:** Firmware Lead + Test Engineer
**Effort:** 2-3 days
**Dependencies:** T12 (golden tests ready), T10 (firmware helpers complete)
**Parallel with:** T14, T15, T16
**Risk:** MEDIUM (hardware-dependent timing)

**Detailed Tasks:**

1. **Bloom PoC** (Day 9):
   - Deploy `pattern_bloom.cpp` to device
   - Run with test audio (440 Hz tone, varying amplitude)
   - Verify:
     - ✅ No LED flicker/glitches
     - ✅ Persistence decays smoothly (LowPass filter working)
     - ✅ Mirror symmetry correct
     - ✅ No crashes (30+ min runtime)
   - Measure: FPS, LED render time, RMS error vs. golden CRC
   - Record: video, telemetry logs

2. **Spectrum PoC** (Day 10):
   - Deploy `pattern_spectrum.cpp` to device
   - Run with varied audio (music, speech, silence)
   - Verify:
     - ✅ Spectrum bins map correctly (no aliasing/glitches)
     - ✅ GradientMap color transitions smooth
     - ✅ DotRender rasterization correct
     - ✅ No crashes
   - Measure: FPS, audio FFT latency, CRC match
   - Record: video, telemetry logs

3. **Integration check** (Day 11):
   - Verify parameters writable via REST API (if UI ready)
   - Confirm telemetry heartbeat shows perf metrics
   - Check no memory leaks (30+ min stability test)

4. **Debrief**:
   - Document bugs/fixes found
   - Update design doc if issues discovered
   - Prepare Phase 2 summary

**Outputs:**
- Validated Bloom + Spectrum PoCs
- Telemetry data (FPS, latencies, CRCs)
- Hardware validation report

**Acceptance Criteria:**
- ✅ Both patterns run without crash (30+ min)
- ✅ FPS ≥ 30 (or per spec)
- ✅ No LED glitches or color corruption
- ✅ Telemetry matches expected metrics
- ✅ Golden CRC matches (or within tolerance)
- ✅ Debrief documented

---

### T14: Documentation & ADRs (1-2 Days)

**Assigned to:** Compiler Lead
**Effort:** 1-2 days
**Dependencies:** T13 (hardware validated)
**Parallel with:** T15, T16
**Risk:** LOW

**Detailed Tasks:**

1. Create `docs/09-implementation/K1NImpl_COMPILER_USAGE_GUIDE_v1.0.md`:
   - CLI syntax (build, validate, debug flags)
   - Example workflows (Bloom, Spectrum)
   - Troubleshooting (common errors, validation messages)
   - Performance tuning (scratch cap, DCE implications)

2. Create `docs/02-adr/K1NADR_0010_GRAPH_COMPILER_ARCHITECTURE_v1.0_20251110.md`:
   - Status: `accepted`
   - Decision: 5-stage pipeline (parse, validate, optimize, schedule, emit)
   - Trade-offs: clarity vs. single-pass simplicity
   - Consequences: easier to optimize/debug, <200ms compile time, no perf bloat
   - Validation: Bloom + Spectrum PoCs verified on hardware

3. Update indices:
   - `docs/K1N_NAVIGATION_v1.0.md` — add compiler + graph system links
   - Update roadmap status (Phase 1 days 1-11 complete)

**Outputs:**
- Usage guide + ADR + navigation update

**Acceptance Criteria:**
- ✅ Guide is clear + includes examples
- ✅ ADR follows template
- ✅ Navigation reflects current state

---

### T15: Performance Analysis & Tuning (1-2 Days)

**Assigned to:** Compiler Lead
**Effort:** 1-2 days
**Dependencies:** T13 (hardware metrics)
**Parallel with:** T14, T16
**Risk:** LOW

**Detailed Tasks:**

1. Profile TypeScript compiler:
   - Time each stage (parser, validator, optimizer, scheduler, emitter) for Bloom + Spectrum
   - Target: <200ms total
   - If >300ms: optimize critical paths

2. Measure generated C++ code size:
   - Target: <20 KB per pattern
   - Bloom: ? KB, Spectrum: ? KB
   - If >25 KB: identify verbose generation

3. Optimize if needed:
   - Avoid redundant variable decls
   - Inline small functions
   - Cache helper function results

**Outputs:**
- Performance report: parse time, compile time, code size
- Optimization notes (if applied)

**Acceptance Criteria:**
- ✅ TypeScript compiler <300ms
- ✅ Generated C++ <25 KB per pattern
- ✅ Measurements documented

---

### T16: CI Polish & Final Integration (1-2 Days)

**Assigned to:** DevOps Lead OR Compiler Lead
**Effort:** 1-2 days
**Dependencies:** T14 (docs done), all prior tasks
**Parallel with:** T14, T15
**Risk:** LOW

**Detailed Tasks:**

1. Finalize CI pipeline:
   - Schema validation ✓
   - TypeScript build ✓
   - Jest tests with coverage ✓
   - **Add:** Firmware compile test (generate patterns → build firmware)
   - **Add:** Size check (generated C++ <25 KB per pattern)
   - **Add:** Lint check (eslint, prettier on codegen/)
   - **Add:** Hardware smoke test trigger (optional; manual on Day 9-11)

2. Create pre-commit hook (optional):
   - Prevent commits if TypeScript doesn't compile
   - Prevent commits if tests fail

3. Create release checklist:
   ```
   Phase 1 Release Checklist
   - [ ] All tests pass (parser, validator, optimizer, scheduler, emitter, integration)
   - [ ] Coverage ≥85% per module
   - [ ] No high/critical lints
   - [ ] Generated code size <25 KB per pattern
   - [ ] Hardware PoCs validated (Bloom, Spectrum)
   - [ ] Docs complete (usage guide, ADR)
   - [ ] ADR approved by team lead
   - [ ] Ready for Phase 2 handoff
   ```

**Outputs:**
- Complete CI pipeline
- Pre-commit hooks (optional)
- Release checklist

**Acceptance Criteria:**
- ✅ CI passes on all commits
- ✅ Generated patterns compile in firmware
- ✅ Lints clean (warnings OK)
- ✅ Checklist is actionable

---

### T17: Knowledge Transfer & Handoff (4-6 Hours, Day 11)

**Assigned to:** Compiler Lead
**Effort:** 4-6 hours
**Dependencies:** All prior tasks
**Serial at:** End of Day 11

**Inputs:**
- Complete compiler codebase
- Test suites + fixtures
- Documentation + ADRs
- Hardware validation data

**Detailed Tasks:**

1. Create `docs/04-planning/K1NPlan_PHASE1_HANDOFF_SUMMARY_v2.0.md`:
   - **Achievements:** Delivered 35-40 node compiler, Bloom + Spectrum PoCs, full test suite
   - **Test Coverage:** 80-100 tests, ≥85% code coverage
   - **Hardware Validation:** Both PoCs run 30+ min without crash, FPS metrics captured, golden CRCs baseline
   - **Known Issues:** (should be none at this stage)
   - **Phase 2 Prep:** Next steps (Task 6 node catalog finalization, Task 7-8 pattern migrations)

2. Organize codegen/ directory:
   - Add README with build/test/CLI commands
   - Add DEVELOPMENT guide (editing types, adding nodes)
   - Add TESTING guide (writing fixtures, adding E2E tests)

3. Prepare team onboarding:
   - 1-hour walkthrough of 5-stage compiler architecture
   - Demo: Build Bloom graph, show generated C++, deploy to device
   - Q&A + blockers

**Outputs:**
- Handoff summary + onboarding materials
- Code is clean, well-commented
- README + dev guides

**Acceptance Criteria:**
- ✅ Handoff summary captures Phase 1 deliverables (35-40 nodes, PoCs)
- ✅ Code is organized and documented
- ✅ New team member can build a graph in <30 min
- ✅ Known issues tracked (if any)

---

## Updated Schedule & Dependency Map

### Critical Path (Determines Project Duration)

```
Day 1 (Setup):
  ├─ T1: Compiler Scaffold (4–6h) ✓
  ├─ T2: Firmware Template (3–4h) ✓
  └─ T3: CI Skeleton (2–3h) ✓

Days 2–3 (Type System + Parser):
  └─ T4: Types (8–10h, up from 4–6h) + Parser (8–10h)
     └─ CODE REVIEW GATE #1 (Day 2 EOD)

Day 3–4 (Validator):
  └─ T5: Validator (1.5–2 days, up from 1 day)
     └─ CODE REVIEW GATE #2 (Day 4 EOD)

Day 4–5 (Optimizer + Scheduler):
  ├─ T6: Optimizer (1.5 days, up from 0.75 days)
  └─ T7: Scheduler (2.5–3 days, up from 1.5 days)
     └─ CODE REVIEW GATE #3 (Day 6 EOD)

Days 5–8 (Emitter):
  └─ T8: Emitter (3–4 days, up from 2 days)
     └─ (No gate; proceed to T9 + T10)

Day 8 (CLI):
  └─ T9: CLI (4–6h)

Days 6–8 (Extended Nodes + Testing):
  ├─ T10: Extended Node Implementations (2–3 days, parallel with emitter finish)
  ├─ T11: Unit Tests (2–3 days, parallel)
  └─ T12: E2E Golden Tests (2–3 days, parallel)

Days 9–11 (Validation + Docs + Handoff):
  ├─ T13: Hardware PoCs (2–3 days, in-situ)
  ├─ T14: Documentation (1–2 days, parallel)
  ├─ T15: Performance Tuning (1–2 days, parallel)
  ├─ T16: CI Polish (1–2 days, parallel)
  └─ T17: Handoff (4–6h, Day 11)
```

### Critical Dependencies

1. **T1 → T4:** Scaffold needed for types/parser
2. **T4 → T5:** AST needed for validator
3. **T5 → T7:** Validated AST needed for scheduler
4. **T7 → T8:** Allocations needed for emitter
5. **T8 → T9:** Emitter needed for CLI
6. **T9 → T12:** CLI needed for E2E tests
7. **T12 → T13:** Golden tests needed for hardware validation

### Parallel Tracks (No Dependencies)

- T1, T2, T3 can run on Day 1 (3 engineers)
- T4 parser → T5 validator → T7 scheduler (sequential)
- T6 optimizer and T7 scheduler can overlap slightly (both need validated AST)
- T10 extended nodes, T11 tests, T12 golden tests can run in parallel on Days 6–8
- T14, T15, T16 can run in parallel on Days 9–11
- T13 hardware validation in-situ (Days 9–11)

---

## Resource Requirements

### Team Size & Roles

- **Compiler Lead** (1 senior engineer) — T1, T4–T9, T10, T14–T15, T17
- **Firmware Lead** (1 engineer) — T2, T10, T13
- **Test Engineer** (1 engineer) — T11, T12, T13
- **DevOps Lead** (optional) — T3, T16

### Hardware & Tools

- **1× ESP32-S3-DevKit-C-1** (for Days 9–11 hardware validation)
- **1× WS2812B LED strip** (160 LEDs)
- **1× Audio test source** (signal generator or speaker)
- **TypeScript + Node.js 18+**
- **PlatformIO CLI**
- **Git**

### Time Budget

- **Days 1–5:** 40–50 engineer-hours (setup + compiler core)
- **Days 6–8:** 20–25 engineer-hours (extended nodes + testing + hardware prep)
- **Days 9–11:** 15–20 engineer-hours (validation, docs, handoff)
- **Total:** ~75–95 engineer-hours (Phase 1 expanded scope)

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Scope creep beyond 40 nodes | Schedule slip | Freeze node catalog at 40; Phase 2 adds more |
| Compiler complexity (3.5× larger) | Schedule slip | Daily check-ins, staged deliverables, 3 code review gates |
| Filter/RNG validation logic | Validation errors miss bugs | Comprehensive test suite (40-50 validator tests), peer code review |
| Firmware helper integration | Generated C++ fails to compile | Emitter tests on helper calls; firmware implementation parallel with T8 |
| Hardware flakes (audio timeout) | Days 9–11 delay | Fallback to silence; rerun tests; use CPU sim if available |
| Firmware rebuild slow | Days 9–11 delay | Use ccache; parallelize pio runs |
| Timeline slip (scope overrun) | Days overrun | Fixed node catalog; no Phase 2 features in Phase 1 |

---

## Success Criteria (Go/No-Go Gate, End of Day 11)

**Must have:**
- ✅ Compiler passes all 5 stages (parse → emit) on Bloom + Spectrum
- ✅ Generated C++ compiles + links without errors
- ✅ Hardware PoCs run for 30+ min without crash
- ✅ Telemetry shows expected metrics (FPS, latencies, CRCs)
- ✅ All unit tests pass (80-100 tests)
- ✅ All E2E golden tests pass
- ✅ CI pipeline passes
- ✅ Documentation complete + ADR approved
- ✅ Team can build a new graph in <30 min (onboarding check)

**Nice to have:**
- Code coverage ≥85%
- Generated C++ <25 KB per pattern
- TypeScript compiler <200 ms per graph
- Zero compiler warnings

---

## Next Steps (Phase 2 Handoff)

1. **Assign Phase 2 team** (Task 6–8: pattern migrations, UI, integration testing)
2. **Review Phase 1 deliverables** (code review, architecture review, test coverage review)
3. **Validate hardware PoCs** (confirm Bloom + Spectrum on hardware match golden CRCs)
4. **Begin Phase 2 planning** (Task 6 node catalog finalization, Task 7–8 migrations)

---

## Document Control

| Version | Date | Author | Status | Changes |
|---------|------|--------|--------|---------|
| v1.0 | Nov 10, 2025 | Claude | Superseded | 14-node plan (7-10 days) |
| v2.0 | Nov 10, 2025 | Claude | CURRENT | 35-40 node plan (9-11 days, authoritative roadmap alignment) |

**This plan is ALIGNED WITH:** `docs/04-planning/K1NPlan_TASK_ROADMAP_CORRECTED_v1.0_20251110.md` (AUTHORITATIVE)

**Valid through:** Phase 1 completion (Day 11, November 21, 2025)

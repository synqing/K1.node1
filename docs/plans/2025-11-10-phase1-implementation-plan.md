# Phase 1 Implementation Plan: K1.node1 Compiler & Graph System

**Version:** 1.0
**Date:** November 10, 2025
**Timeline:** Days 1–10 (7–10 day execution window)
**Status:** Ready for team execution
**Related:** `docs/plans/2025-11-10-phase1-compiler-design.md`, `docs/06-reference/K1NRef_GRAPH_NODE_CATALOG_v1.0_20251110.md`

---

## Purpose

This plan breaks down the Phase 1 compiler and graph system work into **specific, assignable developer tasks** that can be executed in parallel. Each task:
- Has clear inputs, outputs, and acceptance criteria
- Lists dependencies and parallel opportunities
- Fits within 1–2 day effort windows
- Produces artifacts linked to design and testing strategy

---

## Team Structure & Assignments

**Three developer tracks (can run in parallel after day 1 setup):**

1. **Track A: Compiler Core (TypeScript)** — Days 1–5
   - Lead: Compiler/TypeScript Engineer
   - Tasks: T1–T7 (Parser, Validator, Optimizer, Scheduler, Emitter)

2. **Track B: Firmware Integration** — Days 1–10
   - Lead: Embedded/Firmware Engineer
   - Tasks: T8–T12 (Generated C++ skeleton, pattern registry, CI integration)

3. **Track C: Testing & Validation** — Days 3–10
   - Lead: QA/Test Engineer
   - Tasks: T13–T16 (Unit tests, E2E fixtures, hardware validation)

**Coordination points:** Day 1 (kickoff), Day 5 (emitter → firmware), Days 6–7 (hardware), Day 10 (final validation).

---

## Day 1: Kickoff & Foundation (Parallel Setup)

### T1: Compiler Scaffold & TypeScript Setup

**Assigned to:** Compiler Lead
**Effort:** 4–6 hours
**Dependencies:** None (critical path)

**Inputs:**
- Existing `codegen/` directory structure
- TypeScript configuration (assumed: tsconfig.json exists or needs creation)
- Design document (`docs/plans/2025-11-10-phase1-compiler-design.md`)

**Tasks:**
1. Create TypeScript project structure:
   ```
   codegen/
     src/
       types.ts          # Type definitions (int, float, vec3, audio_spectrum, etc.)
       parser.ts         # Parser stage (stub)
       validator.ts      # Validator stage (stub)
       optimizer.ts      # Optimizer stage (stub)
       scheduler.ts      # Scheduler stage (stub)
       emitter.ts        # Emitter stage (stub)
       cli.ts            # CLI tool (k1c build, validate)
     schemas/
       graph.schema.json  # ✅ Already created
     fixtures/           # Test graphs (stub)
       bloom.json
       spectrum.json
     tests/
       parser.test.ts
       validator.test.ts
       optimizer.test.ts
       scheduler.test.ts
       emitter.test.ts
   ```
2. Install dependencies:
   - `npm install typescript ts-node @types/node`
   - `npm install ajv` (JSON Schema validation)
   - `npm install jest @types/jest ts-jest` (testing)
3. Create `package.json` with build scripts:
   ```json
   {
     "scripts": {
       "build": "tsc",
       "dev": "ts-node src/cli.ts",
       "test": "jest",
       "k1c": "ts-node src/cli.ts"
     }
   }
   ```
4. Initialize git tracking for codegen/ folder (if not already tracked)

**Outputs:**
- Clean TypeScript scaffold with all modules stubbed
- `package.json` with build/test/dev scripts
- Compiles without errors

**Acceptance Criteria:**
- ✅ `npm run build` produces no errors
- ✅ `npm run test` runs (all tests skipped or stub)
- ✅ `k1c --help` displays help text
- ✅ Project structure matches design document

---

### T2: Firmware Generated Code Skeleton

**Assigned to:** Firmware Lead
**Effort:** 3–4 hours
**Dependencies:** None (parallel with T1)

**Inputs:**
- Existing firmware structure (`firmware/src/`, `firmware/include/`)
- Design document (stateful nodes, parameter structs)
- Existing headers: `stateful_nodes.h`, `parameters.h`

**Tasks:**
1. Create firmware codegen directory:
   ```
   firmware/src/graph_codegen/
     pattern_*.cpp       # Generated per-pattern code
     graph_runtime.h     # Shared helpers
   ```
2. Create `graph_runtime.h` stub with:
   - `struct PatternState { /* for stateful nodes */ }`
   - `struct PatternOutput { uint8_t leds[NUM_LEDS][3]; }`
   - Helper functions: `clamped_rgb()`, `hsv_to_rgb()`, `fill_buffer()`, `blur_buffer()`
3. Create template `pattern_template.cpp`:
   ```cpp
   #include "graph_runtime.h"
   #include "../stateful_nodes.h"
   #include "../parameters.h"

   // Generated code will follow this shape
   extern "C" void pattern_<name>_render(
       uint32_t frame_count,
       const AudioSnapshot& audio,
       const PatternParameters& params,
       PatternState& state,
       PatternOutput& out
   ) {
       // Time
       float t = frame_count / 30.0f;

       // Audio
       // ...

       // Compute
       // ...

       // Output
       // memcpy(out.leds, computed_buffer, sizeof(out.leds));
   }
   ```
4. Add include guards and documentation

**Outputs:**
- `firmware/src/graph_codegen/graph_runtime.h` with helper functions
- `firmware/src/graph_codegen/pattern_template.cpp` for reference

**Acceptance Criteria:**
- ✅ Header compiles without errors
- ✅ Helper functions declared (implementations can be stubs)
- ✅ Template matches emitter's expected output shape

---

### T3: CI Integration Skeleton

**Assigned to:** DevOps/Build Lead (or Firmware Lead)
**Effort:** 2–3 hours
**Dependencies:** None (parallel with T1, T2)

**Inputs:**
- Existing CI config (GitHub Actions assumed; check `.github/workflows/`)
- Design document (CI requirements: schema validation, compile check)

**Tasks:**
1. Create `.github/workflows/codegen-validate.yml`:
   ```yaml
   name: Codegen Validation
   on: [push, pull_request]
   jobs:
     schema:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - name: Validate graph schemas
           run: |
             npm install ajv-cli
             ajv validate -s codegen/schemas/graph.schema.json -d 'codegen/fixtures/**/*.json'
     compile:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - name: Build codegen
           run: cd codegen && npm install && npm run build
   ```
2. Add schema validation to CLI (stub in T1's `cli.ts`):
   ```typescript
   export function validateSchema(graphPath: string): boolean {
       // Validate against codegen/schemas/graph.schema.json
       return true; // stub
   }
   ```
3. Test locally: `npm run build` + validate a sample graph

**Outputs:**
- `.github/workflows/codegen-validate.yml` ready to trigger on PR
- CLI schema validation function (stub)

**Acceptance Criteria:**
- ✅ Workflow file is valid YAML
- ✅ Triggers on push/PR
- ✅ CLI schema validation callable (even if stub)

---

## Days 2–5: Compiler Implementation (Track A, Parallel)

### T4: Type System & Parser Stage

**Assigned to:** Compiler Lead
**Effort:** 1.5 days
**Dependencies:** T1 (scaffold complete)
**Parallel with:** T5, T6, T7, T8, T12

**Inputs:**
- `codegen/schemas/graph.schema.json`
- Design doc (type system, parse contracts)
- Example graphs: `codegen/fixtures/bloom.json`, `spectrum.json`

**Detailed Tasks:**

#### T4a: Type System Definition (4–6 hours)

**Subtasks:**
1. Implement `types.ts` enum + interfaces:
   ```typescript
   export enum PortType {
     INT, BOOL, FLOAT, VEC2, VEC3, COLOR,
     TIME, DURATION, RNG_SEED,
     AUDIO_SPECTRUM, AUDIO_ENVELOPE, BEAT_EVENT,
     PARAM_FLOAT, PARAM_COLOR,
     LED_BUFFER_FLOAT, LED_BUFFER_VEC3
   }

   export interface PortDef {
     name: string;
     type: PortType;
     required: boolean;
     default?: any;
   }

   export interface NodeType {
     name: string;
     inputs: PortDef[];
     params: PortDef[];
     output: PortType | PortType[];
     memory_bytes: number;
     is_stateful: boolean;
   }
   ```
2. Create `NodeTypeRegistry` with all 14 Phase 1 nodes:
   ```typescript
   const REGISTRY: Map<string, NodeType> = new Map([
     ["Time", { inputs: [], params: [], output: PortType.TIME, ... }],
     ["AudioSnapshot", { inputs: [], params: [], output: [PortType.AUDIO_SPECTRUM, PortType.AUDIO_ENVELOPE], ... }],
     ["Add", { inputs: [{ name: "a", type: PortType.FLOAT }, ...], ... }],
     // ... 11 more nodes
   ]);
   ```
3. Add type coercion rules:
   ```typescript
   export function can_coerce(from: PortType, to: PortType): boolean {
     // int → float: yes
     // float → led_buffer: no (must use Fill node)
     // ...
   }
   ```
4. Write unit tests:
   - `types.test.ts`: Type enum, registry lookup, coercion rules

**Outputs:**
- `codegen/src/types.ts` with full type system + registry
- `codegen/tests/types.test.ts` with 10+ tests

**Acceptance Criteria:**
- ✅ All 14 node types defined in registry
- ✅ Coercion rules follow design doc
- ✅ Type tests pass (jest)
- ✅ No TS compilation errors

---

#### T4b: Parser Implementation (8–10 hours)

**Subtasks:**
1. Implement `parser.ts`:
   ```typescript
   export interface GraphAST {
     name: string;
     nodes: NodeAST[];
   }

   export interface NodeAST {
     id: string;
     type: string;
     inputs: Map<string, string>;  // port → source node id
     params: Map<string, any>;
   }

   export function parse(jsonText: string): GraphAST {
     // Parse JSON → validate against schema → build AST
   }
   ```
2. Parse graph JSON file:
   - Load JSON
   - Validate against `codegen/schemas/graph.schema.json` using ajv
   - Build AST with node references
   - Detect basic errors (missing required fields, unknown node types)
3. Error reporting:
   - Line/column info for schema errors
   - Helpful messages: "Node 'foo' type 'Unknown' not in registry"
4. Write parser tests:
   - `parser.test.ts`: Valid/invalid graphs, error messages

**Outputs:**
- `codegen/src/parser.ts` with full parsing logic
- `codegen/tests/parser.test.ts` with 15+ tests
- Example graphs in `codegen/fixtures/` (bloom.json, spectrum.json)

**Acceptance Criteria:**
- ✅ Parser accepts valid graphs (schema + registry)
- ✅ Parser rejects invalid JSON with helpful errors
- ✅ AST structure matches design doc
- ✅ All parser tests pass

---

### T5: Validator Stage

**Assigned to:** Compiler Lead OR second engineer (parallel)
**Effort:** 1 day
**Dependencies:** T1 (scaffold), T4 (types + AST)
**Parallel with:** T6, T7, T8, T12

**Inputs:**
- Type system (T4)
- Parser AST (T4)
- Design doc (validation rules: cycles, types, memory, params)

**Detailed Tasks:**

1. Implement `validator.ts`:
   ```typescript
   export interface ValidationError {
     node_id: string;
     port?: string;
     message: string;
   }

   export function validate(ast: GraphAST, registry: NodeTypeRegistry): ValidationError[] {
     // Run all checks
     // Return errors (empty = all OK)
   }
   ```

2. Validation checks (in order):
   - **Cycle detection:** Topological sort (Kahn's algorithm). Reject if cycle found.
   - **Port connectivity:** For each node, verify required inputs are connected. Optional inputs may have defaults.
   - **Type compatibility:** Check source port type matches sink port type OR coercible.
   - **Memory budget:** Sum all stateful node buffers; must be <1 KB per node.
   - **Parameter bounds:** For `ParamF`, check `min < max`. For `ParamColor`, check RGB in [0,1].

3. Error messages:
   - "Cycle detected: A → B → C → A"
   - "Node 'blur' input 'src' not connected (required)"
   - "Node 'add' input 'a': expected float, got audio_spectrum"
   - "BufferPersist: stateful buffer (1.2 KB) exceeds per-node budget (1 KB)"
   - "ParamF 'speed': min (2.0) >= max (1.0)"

4. Write validator tests:
   - Valid graphs pass
   - Cycle detection rejects loops
   - Type mismatch errors
   - Missing required inputs
   - Parameter bounds violations

**Outputs:**
- `codegen/src/validator.ts` with all validation checks
- `codegen/tests/validator.test.ts` with 20+ tests

**Acceptance Criteria:**
- ✅ Detects all error types from design doc
- ✅ Rejects cycles (tested with loop graph)
- ✅ Accepts all valid 14-node combinations
- ✅ Error messages are actionable (name the problem + how to fix)
- ✅ All validator tests pass

---

### T6: Optimizer Stage

**Assigned to:** Compiler Lead OR second engineer (parallel)
**Effort:** 0.75 days
**Dependencies:** T1 (scaffold), T4 (types), T5 (validated AST)
**Parallel with:** T5, T7, T8, T12

**Inputs:**
- Type system
- Validated AST
- Design doc (optimization: constant folding, CSE, dead-code elimination)

**Detailed Tasks:**

1. Implement `optimizer.ts`:
   ```typescript
   export function optimize(ast: GraphAST, registry: NodeTypeRegistry): GraphAST {
     // Apply all optimization passes
     // Return optimized AST (or mutate in place)
   }
   ```

2. Optimization passes (in order):
   - **Constant folding:** If all node inputs are literals/constants, pre-compute and replace with `Color` node.
     - Example: `Add(1.0, 2.0)` → `Color(3.0, 0, 0)` (hack: use Color for scalar for now; Phase 2: dedicated Literal node)
   - **Common subexpression elimination (CSE):** If two pure nodes have identical inputs, keep one and rewire.
     - Track node signatures: `(type, inputs, params)` → use first occurrence.
   - **Dead-code elimination:** Remove nodes with no consumers (not in any sink path).
     - Backward traversal from output nodes; mark reachable; delete unmarked.

3. Tests:
   - Constant folding: `Add(1, 2)` → single constant node
   - CSE: Duplicate `Mul` nodes → one kept, other removed
   - DCE: Unused node removed

**Outputs:**
- `codegen/src/optimizer.ts` with 3+ optimization passes
- `codegen/tests/optimizer.test.ts` with 10+ tests

**Acceptance Criteria:**
- ✅ Constant folding works (pure nodes with const inputs)
- ✅ CSE deduplicates identical subexpressions
- ✅ DCE removes unreachable nodes
- ✅ Optimizer preserves AST structure (node id, connectivity)
- ✅ All optimizer tests pass

---

### T7: Scheduler & Allocator

**Assigned to:** Compiler Lead OR second engineer (parallel)
**Effort:** 1.5 days
**Dependencies:** T1 (scaffold), T5 (validated AST)
**Parallel with:** T6, T8, T12

**Inputs:**
- Validated + optimized AST
- Design doc (scheduler: topological order, buffer allocation, lifetime analysis)

**Detailed Tasks:**

#### T7a: Topological Schedule (4–6 hours)

1. Implement `scheduler.ts`:
   ```typescript
   export interface ScheduleNode {
     node_id: string;
     order_index: number;  // execution order (0 = first)
   }

   export function build_schedule(ast: GraphAST): ScheduleNode[] {
     // Topological sort; return execution order
   }
   ```

2. Topological sort (Kahn's algorithm):
   - Compute in-degree for all nodes
   - Process zero-in-degree nodes (sources like Time, ParamF)
   - Follow edges; decrement in-degrees
   - Return order

3. Tests:
   - Linear graph A → B → C produces [A, B, C]
   - Diamond graph A → [B, C] → D produces valid order (both B and C before D)

**Outputs:**
- Execution order list

---

#### T7b: Buffer Allocation & Lifetime Analysis (8–10 hours)

1. Implement buffer allocator:
   ```typescript
   export interface BufferAllocation {
     name: string;  // e.g., "temp_buf_0"
     node_id: string;  // producer
     type: PortType;
     size_bytes: number;
     lifetime: { start_order: number, end_order: number };
     is_persistent: boolean;
   }

   export function allocate_buffers(
       ast: GraphAST,
       schedule: ScheduleNode[],
       registry: NodeTypeRegistry
   ): BufferAllocation[] {
     // Assign buffers with minimal overlap
   }
   ```

2. Allocation strategy:
   - Identify buffer-producing nodes (Fill, Blur, BufferPersist, LedOutput)
   - For each, compute lifetime: start = producer order, end = last consumer order
   - **Persistent buffers** (BufferPersist, LedOutput): allocate once, reuse every frame
   - **Temporary buffers** (Fill, Blur outputs): pool in 16 KB scratch; reuse after consumer finishes
   - Assign names: `temp_buf_0`, `temp_buf_1`, `persistent_buf_0`, etc.

3. Validation:
   - Total temp buffers ≤ 16 KB
   - Total persistent buffers ≤ 1 KB per stateful node
   - Allocations don't overlap (in time) unless pooled

4. Tests:
   - Simple linear pipeline: 1 persistent + 2 temps
   - Complex graph with multiple stateful nodes
   - Verify no buffer over-allocation

**Outputs:**
- `codegen/src/scheduler.ts` with schedule + allocation
- `codegen/tests/scheduler.test.ts` with 10+ tests

**Acceptance Criteria:**
- ✅ Topological order is valid (dependencies respected)
- ✅ Buffer lifetimes computed correctly
- ✅ Temp + persistent buffers within budget
- ✅ Allocation names are unique and descriptive
- ✅ All scheduler tests pass

---

### T8: Emitter (C++ Code Generator)

**Assigned to:** Compiler Lead OR third engineer (parallel after T7)
**Effort:** 2 days
**Dependencies:** T1 (scaffold), T7 (allocations)
**Parallel with:** T12

**Inputs:**
- Optimized + scheduled + allocated AST
- Firmware template (T2: `pattern_template.cpp`)
- Design doc (emit contracts: no heap, single audio snapshot, color clamp)

**Detailed Tasks:**

#### T8a: Code Generation Skeleton (6–8 hours)

1. Implement `emitter.ts`:
   ```typescript
   export function emit(
       ast: GraphAST,
       schedule: ScheduleNode[],
       allocations: BufferAllocation[],
       registry: NodeTypeRegistry
   ): string {
     // Generate C++ code
   }
   ```

2. Generate function signature:
   ```cpp
   extern "C" void pattern_<name>_render(
       uint32_t frame_count,
       const AudioSnapshot& audio,
       const PatternParameters& params,
       PatternState& state,
       PatternOutput& out
   ) {
     // ... generated code ...
   }
   ```

3. Generate buffer declarations:
   ```cpp
   // Persistent buffers
   static CRGBF persistent_buf_0[NUM_LEDS];

   // Temporary buffers (stack-allocated or pooled)
   CRGBF temp_buf_0[NUM_LEDS];
   CRGBF temp_buf_1[NUM_LEDS];

   // Scalars
   float time_val;
   float add_result;
   // ...
   ```

4. Generate compute statements (per node, in schedule order):
   ```cpp
   // Node: time
   float time_val = frame_count / 30.0f;

   // Node: param_speed
   float speed = params.speed;

   // Node: mul
   float mul_result = time_val * speed;

   // ... etc
   ```

5. Generate output write:
   ```cpp
   // Color clamp + write
   for (int i = 0; i < NUM_LEDS; i++) {
       out.leds[i][0] = std::min(1.0f, std::max(0.0f, final_buf[i].r));
       out.leds[i][1] = std::min(1.0f, std::max(0.0f, final_buf[i].g));
       out.leds[i][2] = std::min(1.0f, std::max(0.0f, final_buf[i].b));
   }
   ```

**Outputs:**
- Skeleton of emitter with buffer + scalar decl + output write

---

#### T8b: Node Code Generation (8–10 hours)

1. For each node type, implement code gen:
   ```typescript
   export interface NodeCodeGen {
     node_type: string;
     generate(node: NodeAST, inputs: Map<string, string>, registry): string;
   }
   ```

2. Example generators:

   **Time:**
   ```cpp
   float time_val = frame_count / 30.0f;
   ```

   **Add:**
   ```cpp
   float add_result = a_input + b_input;
   ```

   **Hsv:**
   ```cpp
   CRGBF hsv_color = hsv2rgb(h_input, s_input, v_input);
   ```

   **Fill:**
   ```cpp
   for (int i = 0; i < NUM_LEDS; i++) {
       temp_buf_0[i] = color_input;
   }
   ```

   **Blur:**
   ```cpp
   blur_3x(src_buf, temp_buf_1, NUM_LEDS);
   ```

   **BufferPersist:**
   ```cpp
   for (int i = 0; i < NUM_LEDS; i++) {
       persistent_buf_0[i] = decay_param * persistent_buf_0[i] +
                             (1.0f - decay_param) * src_buf[i];
   }
   ```

   **LedOutput:**
   ```cpp
   memcpy(out.leds, color_buf, NUM_LEDS * 3 * sizeof(uint8_t));
   ```

3. Tests:
   - Each node type generates valid C++
   - Variables match allocations
   - No undefined references

**Outputs:**
- `codegen/src/emitter.ts` with full code generation
- `codegen/tests/emitter.test.ts` with 15+ tests

**Acceptance Criteria:**
- ✅ Generated C++ compiles without errors
- ✅ Function signature matches firmware template
- ✅ All 14 node types have generators
- ✅ No undefined variables
- ✅ Color clamping applied to output
- ✅ All emitter tests pass

---

### T9: CLI Tool & Integration

**Assigned to:** Compiler Lead
**Effort:** 0.5 days
**Dependencies:** T8 (emitter complete)
**Serial after:** All stages complete (T4–T8)

**Inputs:**
- All compiler stages (T4–T8)
- Design doc (CLI interface: k1c build, validate)

**Detailed Tasks:**

1. Implement `cli.ts`:
   ```typescript
   import * as fs from 'fs';
   import { parse } from './parser';
   import { validate } from './validator';
   import { optimize } from './optimizer';
   import { build_schedule, allocate_buffers } from './scheduler';
   import { emit } from './emitter';

   export async function main() {
     const args = process.argv.slice(2);
     const cmd = args[0];
     const graphPath = args[1];

     if (cmd === 'build') {
       const json = fs.readFileSync(graphPath, 'utf-8');
       const ast = parse(json);
       const errors = validate(ast, REGISTRY);
       if (errors.length > 0) { console.error(errors); process.exit(1); }
       const opt = optimize(ast, REGISTRY);
       const sched = build_schedule(opt, REGISTRY);
       const alloc = allocate_buffers(opt, sched, REGISTRY);
       const cpp = emit(opt, sched, alloc, REGISTRY);
       // Write to firmware/src/graph_codegen/pattern_<name>.cpp
       const outPath = `firmware/src/graph_codegen/pattern_${ast.name}.cpp`;
       fs.writeFileSync(outPath, cpp);
       console.log(`✓ Generated ${outPath}`);
     } else if (cmd === 'validate') {
       // Validate without emitting
     } else {
       console.log('Usage: k1c build <graph.json>');
     }
   }
   ```

2. Add commands:
   - `k1c build <graph.json> [--out <path>]` — Parse, validate, optimize, schedule, emit
   - `k1c validate <graph.json>` — Parse + validate only
   - `k1c --help` — Show usage
   - `k1c --version` — Show version

3. Error handling:
   - File not found → "Error: graph.json not found"
   - Parse errors → Print with line/column
   - Validation errors → Print all errors, exit(1)
   - Emit errors → Print stack trace, exit(2)

**Outputs:**
- `codegen/src/cli.ts` fully functional
- Commands work as designed
- Clear error messages

**Acceptance Criteria:**
- ✅ `k1c build <graph.json>` generates C++ file
- ✅ File is written to correct firmware path
- ✅ Error handling is informative
- ✅ CLI matches design doc

---

## Days 4–5: Testing Foundation (Track C, Parallel)

### T10: Unit Tests for Compiler Stages

**Assigned to:** Test Engineer
**Effort:** 1 day
**Dependencies:** T4–T8 (all stages stubbed/implemented)
**Parallel with:** T8, T9

**Inputs:**
- All compiler stages (T4–T9)
- Design doc (testing strategy)

**Detailed Tasks:**

1. Create `codegen/tests/` test suite:
   ```
   tests/
     types.test.ts      # ✅ Already in T4
     parser.test.ts     # ✅ Already in T4
     validator.test.ts  # ✅ Already in T5
     optimizer.test.ts  # ✅ Already in T6
     scheduler.test.ts  # ✅ Already in T7
     emitter.test.ts    # ✅ Already in T8
     integration.test.ts # ← NEW: end-to-end
   ```

2. Add integration tests:
   - Load `codegen/fixtures/bloom.json`
   - Run through all 5 stages
   - Verify output C++ compiles
   - Check buffer allocations are correct

3. Test coverage goals:
   - ≥80% line coverage per stage
   - All error paths tested
   - Edge cases (empty graphs, deep nesting)

4. Run locally: `npm test`

**Outputs:**
- Comprehensive test suite with 50+ tests
- Coverage report (optional)

**Acceptance Criteria:**
- ✅ All tests pass (`npm test`)
- ✅ ≥80% coverage per module
- ✅ Integration tests verify full pipeline
- ✅ CI runs tests automatically

---

### T11: E2E Golden Tests (Hardware Fixtures)

**Assigned to:** Test Engineer + Firmware Lead
**Effort:** 1.5 days
**Dependencies:** T9 (CLI works), T2 (firmware template), Days 6–7 (hardware)
**Serial after:** Day 5

**Inputs:**
- CLI tool (T9)
- Firmware codegen template (T2)
- Hardware (ESP32-S3) on hand

**Detailed Tasks:**

1. Create fixture graphs in `codegen/fixtures/`:
   - `bloom.json` — BufferPersist + blur + color
   - `spectrum.json` — AudioSnapshot + HSV color mapping + fill
   - `beat_pulse.json` — Beat detector + lerp + fill
   - `simple_time.json` — Time-based color cycle

2. For each fixture:
   - Generate C++ code via `k1c build <fixture.json>`
   - Copy to `firmware/src/graph_codegen/pattern_<name>.cpp`
   - Build firmware: `pio run -e esp32-s3-devkitc-1`
   - Verify compiles without errors
   - Flash to device
   - Run pattern, record pixel CRC (checksum of all RGB values)
   - Store as golden reference: `codegen/fixtures/<name>.golden.crc`

3. Add CI job to validate:
   ```yaml
   - name: E2E Golden Test
     run: |
       npm run k1c build codegen/fixtures/bloom.json
       pio run -e esp32-s3-devkitc-1 -t clean
       pio run -e esp32-s3-devkitc-1
       # Simulation or device test: compute CRC, compare
   ```

**Outputs:**
- 4+ working fixture patterns
- Golden CRC files (reference behavior)
- E2E test harness

**Acceptance Criteria:**
- ✅ All fixtures compile to valid C++
- ✅ Firmware builds without errors
- ✅ Device runs patterns without crash
- ✅ Golden CRC matches baseline (within tolerance)

---

## Days 6–7: Hardware Validation & Bloom/Spectrum PoCs

### T12: Hardware Testing Coordination

**Assigned to:** Firmware Lead + Test Engineer
**Effort:** 2 days (Days 6–7, in-situ testing)
**Dependencies:** T11 (golden tests ready), firmware builds (Days 1–5)
**Parallel with:** T13 (docs), T14 (polish)

**Inputs:**
- Working fixtures (T11)
- Hardware: ESP32-S3 + WS2812B strip (160 LEDs)
- Audio source (microphone test signal)

**Detailed Tasks:**

1. **Bloom PoC** (Day 6):
   - Deploy `pattern_bloom.cpp` to device
   - Run with steady audio input (e.g., 440 Hz tone)
   - Verify:
     - ✅ No LED flicker/glitches
     - ✅ Persistence decays smoothly (no jumps)
     - ✅ Audio envelope triggers bloom correctly
   - Measure: FPS, max LED render time, I2S latency
   - Record: video, telemetry logs

2. **Spectrum PoC** (Day 7):
   - Deploy `pattern_spectrum.cpp` to device
   - Run with varied audio (music, speech, silence)
   - Verify:
     - ✅ Spectrum bins map to LEDs without aliasing
     - ✅ Color transitions smooth (Hue rotation works)
     - ✅ Silence → black; loud → bright
   - Measure: FPS, audio FFT latency, color accuracy
   - Record: video, telemetry logs

3. **Integration check:**
   - Verify graph parameters are writable via REST API
   - Confirm telemetry heartbeat includes perf metrics
   - Check no memory leaks (30+ min runtime test)

4. **Debrief:**
   - Document any bugs/fixes found
   - Update design doc if needed
   - Prepare summary for team

**Outputs:**
- Validated Bloom + Spectrum PoCs
- Telemetry data (FPS, latencies)
- Hardware bug report (if any)

**Acceptance Criteria:**
- ✅ Both patterns run without crash
- ✅ FPS ≥ 30 (or per spec)
- ✅ No LED glitches or color corruption
- ✅ Telemetry shows expected metrics
- ✅ Debrief documented

---

## Days 8–10: Polish, Documentation, Integration

### T13: Documentation & ADRs

**Assigned to:** Compiler Lead
**Effort:** 0.75 days
**Dependencies:** T9 (CLI finalized), T12 (hardware validated)
**Parallel with:** T12, T14, T15

**Inputs:**
- Final compiler code (all stages)
- Hardware validation results (T12)
- Design doc (already exists)

**Detailed Tasks:**

1. Create `docs/09-implementation/K1NImpl_COMPILER_USAGE_GUIDE_v1.0.md`:
   - CLI syntax
   - Example workflows
   - Troubleshooting common errors
   - Performance tuning flags

2. Create `docs/02-adr/K1NADR_0009_GRAPH_COMPILER_ARCHITECTURE_v1.0_20251110.md`:
   - Status: `accepted`
   - Decision: 5-stage pipeline chosen over single-pass + AST/IR
   - Trade-offs: pipeline clarity vs. single-pass simplicity
   - Consequences: easier to optimize/debug, slightly slower compile, but <100ms for typical graphs
   - Context: Phase 1 PoC verified correctness; hardware tests show no perf bloat

3. Update `docs/K1N_NAVIGATION_v1.0_20251108.md`:
   - Add links to compiler docs
   - Update roadmap status to "Days 1–7 complete, Days 8–10 in progress"

**Outputs:**
- Usage guide + ADR + navigation update

**Acceptance Criteria:**
- ✅ Guide is clear + includes examples
- ✅ ADR follows template (status, decision, consequences)
- ✅ Navigation reflects current state

---

### T14: Performance Tuning & Optimization

**Assigned to:** Compiler Lead
**Effort:** 0.5 days
**Dependencies:** T12 (hardware metrics), T9 (CLI complete)
**Parallel with:** T13, T15

**Inputs:**
- Telemetry from hardware tests (T12)
- Design doc (targets: <100ms compile, <10KB generated code)

**Detailed Tasks:**

1. Profile TypeScript compiler:
   - Time each stage for a complex graph (20+ nodes)
   - Target: <100ms total (currently likely ~50–200ms)
   - If >200ms: optimize critical paths (e.g., validator cycle detection)

2. Measure generated C++ code size:
   - Target: <10 KB per pattern
   - If >15 KB: identify and refactor verbose generation

3. Optimize if needed:
   - Avoid redundant variable declarations
   - Inline small functions
   - Use efficient buffer pooling

**Outputs:**
- Performance report: parse time, compile time, code size
- Optimization notes (if applied)

**Acceptance Criteria:**
- ✅ TypeScript compiler runs in <200ms
- ✅ Generated C++ is <15 KB per pattern
- ✅ Measurements documented

---

### T15: Final Integration & CI Polish

**Assigned to:** DevOps Lead OR Compiler Lead
**Effort:** 0.5 days
**Dependencies:** T14 (tuning done), all prior tasks
**Parallel with:** T13, T14

**Inputs:**
- Finished compiler (T4–T9)
- CI skeleton (T3)
- Hardware results (T12)

**Detailed Tasks:**

1. Finalize CI pipeline:
   - Schema validation on all fixtures ✓
   - TypeScript compiler build ✓
   - Jest tests with coverage ✓
   - **Add:** Firmware compile test (build `firmware/` with generated patterns)
   - **Add:** Size check (generated C++ <15 KB)
   - **Add:** Lint check (`eslint` or `tslint` on codegen/)

2. Create pre-commit hook (optional):
   - Prevent commits if TypeScript doesn't compile
   - Prevent commits if tests fail

3. Create release checklist:
   ```markdown
   - [ ] All tests pass
   - [ ] No high/critical lints
   - [ ] Generated code size acceptable
   - [ ] Hardware PoCs validated
   - [ ] Docs updated
   - [ ] ADR created
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

### T16: Knowledge Transfer & Handoff

**Assigned to:** Compiler Lead
**Effort:** 0.5 days
**Dependencies:** All prior tasks
**Serial at:** End of Day 10

**Inputs:**
- Complete compiler codebase
- Test suites + fixtures
- Documentation + ADRs
- Hardware validation data

**Detailed Tasks:**

1. Create `docs/04-planning/K1NAPlan_PHASE1_HANDOFF_SUMMARY_v1.0.md`:
   - **Achievements:** What was delivered (compiler, 14 node types, fixture graphs)
   - **Test Coverage:** Unit tests (50+), integration tests, E2E golden tests
   - **Hardware Validation:** Bloom + Spectrum PoCs, telemetry, CRC baselines
   - **Known Issues/Blockers:** If any (should be none at this stage)
   - **Phase 2 Prep:** What to work on next (extended node catalog, advanced effects)

2. Organize codegen/ directory:
   - README with build/test/CLI commands
   - DEVELOPMENT guide (editing types, adding nodes)
   - TESTING guide (writing fixtures, adding E2E tests)

3. Prepare team onboarding:
   - 1-hour walkthrough of compiler architecture (5 stages)
   - Demo: Build a simple graph, show generated C++
   - Q&A + blockers

**Outputs:**
- Handoff summary + onboarding materials
- Code is clean, well-commented
- README + dev guides

**Acceptance Criteria:**
- ✅ Handoff summary captures Phase 1 deliverables
- ✅ Code is organized and documented
- ✅ New team member can build a graph in <30 min
- ✅ Known issues are tracked (if any)

---

## Schedule & Dependency Map

### Critical Path (Determines Project Duration)

```
Day 1 (Setup):
  ├─ T1: Compiler Scaffold (4–6h) → T4: Parser (Day 2)
  ├─ T2: Firmware Template (3–4h) → T8: Emitter (Day 4)
  └─ T3: CI Skeleton (2–3h) → (integrate after T9)

Days 2–3 (Compiler Core):
  ├─ T4: Parser (Day 2) → T7: Scheduler (Day 3)
  ├─ T5: Validator (Day 3) → T7: Scheduler (Day 3)
  └─ [T4 blocks: T7 must wait for validated AST]

Day 4 (Scheduler + Emitter):
  ├─ T7: Scheduler (Day 4, 4–6h) → T8: Emitter (Day 4–5)
  └─ T8: Emitter (Day 4–5, 2 days)

Day 5 (Emitter + Testing):
  ├─ T8: Emitter (Day 5, finish 2-day task)
  ├─ T9: CLI (Day 5, 4h after T8)
  └─ T10: Unit Tests (Day 5, 1 day in parallel with T8–T9)

Days 6–7 (Hardware + Golden Tests):
  ├─ T11: E2E Golden Tests (Day 5–6 prep, Day 6–7 hardware)
  ├─ T12: Hardware Validation (Days 6–7, 2 days in-situ)
  └─ [Bloom PoC (Day 6), Spectrum PoC (Day 7)]

Days 8–10 (Polish + Handoff):
  ├─ T13: Documentation (Day 8, 4–6h)
  ├─ T14: Performance Tuning (Day 8, 3–4h)
  ├─ T15: CI Polish (Day 9, 3–4h)
  └─ T16: Handoff (Day 10, 4h)
```

### Critical Dependencies

1. **T1 → T4:** Parser needs scaffold
2. **T4 → T5:** Validator needs AST
3. **T5 → T7:** Scheduler needs validated AST
4. **T7 → T8:** Emitter needs allocations
5. **T8 → T9:** CLI needs emitter
6. **T9 → T11:** E2E tests need CLI tool
7. **T11 → T12:** Golden refs need fixtures
8. **T12 → T13:** Documentation needs hardware validation

### Parallel Tracks (No Dependencies)

- T1, T2, T3 can all run on Day 1 (3 engineers)
- T4, T6, T7 can partially overlap (T4 produces AST; T6 consumes it; T7 consumes validated + optimized AST)
- T5 is mostly independent (consumes T4 AST)
- T10 can run during Days 4–5 while T8–T9 finish
- T13, T14, T15 can run in parallel on Days 8–10

---

## Resource Requirements

### Team Size & Roles

- **Compiler Lead** — TypeScript, types.ts, parser, validator, optimizer, scheduler, emitter, CLI, docs
- **Firmware Lead** — C++ template, generated code validation, hardware testing, integration
- **Test Engineer** — Unit tests, fixtures, E2E golden tests, CI pipeline
- **DevOps Lead** (optional) — CI/CD setup, release checklist

### Hardware & Tools

- **1× ESP32-S3-DevKit-C-1** (for hardware validation Days 6–7)
- **1× WS2812B LED strip** (160 LEDs)
- **1× Audio source** (test signal generator or speaker output)
- **TypeScript + Node.js 18+**
- **PlatformIO CLI** (for firmware builds)
- **Git** (for version control)

### Time Budget

- **Days 1–5:** 40–50 engineer-hours (5–6h/day × 3 engineers, overlapping phases)
- **Days 6–7:** 16 engineer-hours (in-situ hardware validation, ~8h/day)
- **Days 8–10:** 12–16 engineer-hours (polish, docs, handoff)
- **Total:** ~70–80 engineer-hours (Phase 1 capacity)

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Parser complexity (JSON schema) | Day 2 delay | Use ajv (off-the-shelf JSON Schema validator) |
| Type coercion rules unclear | Day 3 delay | Design doc clarifies; tests validate |
| Buffer allocation algorithm bug | Day 5 delay | Comprehensive scheduler tests + manual review |
| Generated C++ doesn't compile | Day 6 delay | Emitter tests on all 14 node types early (Day 4) |
| Hardware flakes (audio timeout) | Days 6–7 delay | Fallback to silence; rerun tests |
| Firmware rebuild slow | Days 6–7 delay | Use ccache; parallelize pio runs |
| Timeline slip (scope creep) | Days 8–10 slip | Fixed task list; no Phase 2 features added |

---

## Success Criteria (Go/No-Go Gate)

**Must have (Day 10 final check):**
- ✅ Compiler passes all 5 stages (parse → emit) on Bloom + Spectrum
- ✅ Generated C++ compiles + links without errors
- ✅ Hardware PoCs run for 30+ min without crash
- ✅ Telemetry shows expected metrics (FPS, latencies)
- ✅ All unit tests pass (50+)
- ✅ CI pipeline passes
- ✅ Documentation complete + ADR approved
- ✅ Team can build a new graph in <30 min (onboarding check)

**Nice to have:**
- Code coverage ≥85%
- Generated C++ <15 KB per pattern
- Compiler runs <100 ms per graph
- Zero compiler warnings

---

## Next Steps

1. **Assign engineers to tracks** (A, B, C) based on skills + availability
2. **Day 1 kickoff:** All engineers review this plan + design doc
3. **Day 1 deliverables:** T1, T2, T3 complete (scaffold + template + CI ready)
4. **Days 2–5:** Implement compiler stages in parallel (T4–T9, leveraging Tracks A & C)
5. **Days 6–7:** Hardware validation (T11–T12, Track B + C coordinate)
6. **Days 8–10:** Polish + handoff (T13–T16, all tracks)
7. **Day 10 EOD:** Final go/no-go gate; Phase 1 sign-off ready

---

**Document Version:** 1.0 (Nov 10, 2025)
**Status:** Ready for Team Execution
**Last Updated:** 2025-11-10

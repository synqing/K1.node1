# Phase 1: Graph Code Generator - Compiler Design

**Status:** Design Approved (Ready for Implementation)
**Date:** November 10, 2025
**Author:** Claude Code (Brainstorming + Hybrid Design)
**Scope:** Task 5 (Code Generator) + Task 6 (Graph System Design)
**Timeline:** 7–10 days

---

## 1. Executive Summary

This document specifies a **5-stage compiler pipeline** for the K1.node1 graph system that transforms JSON graph definitions into optimized C++ pattern code for LED rendering.

**Key Goals:**
- ✓ Bloom + Spectrum patterns compile and run on hardware
- ✓ Deterministic, testable pipeline (each stage independent)
- ✓ Respects firmware constraints (no heap alloc, single audio snapshot/frame)
- ✓ Performance within 2% of manual patterns; memory <5KB/pattern
- ✓ Clear error messages with node ID + location for debugging

**Architecture:**
```
JSON Graph Input
    ↓ [Stage 1: Parse]
Validated AST
    ↓ [Stage 2: Validate]
Typed AST + Coercion Plan
    ↓ [Stage 3: Optimize]
Optimized AST
    ↓ [Stage 4: Schedule]
Execution Plan + Buffer Lifetime
    ↓ [Stage 5: Emit]
C++ Pattern Code
```

---

## 2. Module Layout

### TypeScript Compiler (New)
```
codegen/
  ├── parser/
  │   ├── graph_parser.ts       # JSON → AST
  │   └── ast_types.ts          # AST node definitions
  ├── validate/
  │   ├── type_checker.ts       # Type system enforcement
  │   └── graph_rules.ts        # Cycle detection, port validation
  ├── opt/
  │   ├── optimizer.ts          # Const fold, DCE, inline
  │   └── opt_rules.ts          # Optimization rules
  ├── schedule/
  │   ├── scheduler.ts          # Topo order, buffer lifetime
  │   └── allocator.ts          # Linear-scan buffer allocator
  ├── emit/
  │   ├── emitter.ts            # C++ code generation
  │   ├── templates/
  │   │   ├── pattern.hbs       # Handlebars template
  │   │   └── registration.hbs  # Registry insert template
  │   └── cpp_gen.ts            # C++ AST + string builder
  ├── schemas/
  │   └── graph.schema.json     # JSON schema for validation
  ├── fixtures/
  │   ├── bloom.graph.json
  │   ├── spectrum.graph.json
  │   └── golden/               # Expected C++ outputs
  ├── cli.ts                     # k1c CLI binary
  ├── test/
  │   ├── parser.test.ts
  │   ├── validator.test.ts
  │   ├── optimizer.test.ts
  │   ├── scheduler.test.ts
  │   └── e2e.test.ts           # Golden comparison tests
  └── package.json
```

### Firmware Integration (Existing)
```
firmware/src/
  ├── graph_codegen/            # Generated outputs (empty now)
  │   ├── pattern_bloom.h/.cpp
  │   ├── pattern_spectrum.h/.cpp
  │   └── runtime_glue.h        # Thin API to stateful_nodes, audio
  ├── stateful_nodes.h/.cpp     # Existing (Task 9)
  ├── parameters.h              # Existing
  └── pattern_registry.h        # Updated for graph patterns
```

---

## 3. Type System (Refined)

### Core Types
- `int`, `bool` — indices, toggles
- `float`, `vec2`, `vec3` — scalars, vectors
- `color` — RGB alias for vec3
- `time` — absolute time (seconds)
- `duration` — time delta (for easing)
- `rng_seed` — deterministic noise seed

### Audio/Specialty Types
- `audio_spectrum` — NUM_FREQS float[] snapshot
- `audio_envelope` — scalar VU/energy
- `beat_event` — discrete beat pulse (bool)
- `param<T>` — parameterized type (param<float>, param<color>)

### Buffer Types
- `led_buffer<float>` — fixed NUM_LEDS buffer
- `led_buffer<vec3>` — fixed NUM_LEDS RGB buffer
- ⚠ Future: `buffer<N>` for segments (v1 uses fixed size only)

### Type Coercions (Explicit)
```
int → float (widen)
float → vec3 (broadcast all channels)
vec3 ↔ color (bidirectional)
float/vec3 → led_buffer<T> (broadcast fill, if node supports)
❌ NO implicit led_buffer<vec3> ↔ led_buffer<float>
```

---

## 4. Stage Contracts

### Stage 1: Parse (JSON → AST)

**Input:** `graph.json`
**Output:** Abstract Syntax Tree + constant pool + symbol table

**AST Node Shape:**
```typescript
{
  id: string,                    // Unique node identifier
  type: string,                  // "Time", "AudioSnapshot", "Bloom", etc.
  inputs: {[portName]: nodeId},  // Port wiring
  params: {[name]: value},       // Parameter values
  meta: {
    name: string,                // Human name for diagnostics
    filePos: {line, col, file}   // Source location
  }
}
```

**Graph Roots:** One or more output nodes (LedOutput, LedOutputMirror).
**Error Handling:** Parse errors include file position for IDE integration.

---

### Stage 2: Validate (AST → Typed AST)

**Input:** AST
**Output:** Validated AST + port type map + coercion plan + structured errors

**Validation Rules:**

1. **No Cycles:** Kahn topological sort; on failure, report cycle path: `A → B → C → A`
2. **Port Connectivity:**
   - Required ports connected OR have declared defaults
   - One writer per port; multi-fanout allowed (DAG)
3. **Type Compatibility:**
   - Port type matches input type OR is coercible
   - Coercion plan specifies transformations
4. **Node Constraints:**
   - Stateful node memory < 1KB per ADR-0007
   - RNG nodes marked side-effect (no CSE/dedup in Stage 3)
   - Node version (optional): `node.type + node.version`
5. **Graph Constraints:**
   - All roots are known output types
   - No dangling inputs (unknown sourceNodeId)
   - No unknown node types
6. **Parameter Bounds:**
   - Global policy: **clamp + warn** (default), or `strict=true` for error
   - Broadcast bounds applied at emit-time

**Error Format:**
```json
{
  "nodeId": "bloom",
  "port": "audio",
  "expectedType": "audio_spectrum",
  "actualType": "float",
  "location": {line, col, file}
}
```

---

### Stage 3: Optimize (AST → Optimized AST)

**Input:** Validated AST
**Output:** Optimized AST (same structure, fewer nodes)

**Optimizations:**
- ✓ **Constant folding:** Math ops with literal inputs → pre-computed constants
- ✓ **Dead code elimination:** Unreachable nodes removed
- ✓ **Literal inlining:** Constant values inlined directly
- ✓ **CSE (optional, safe):** Identical pure subgraphs deduplicated (hash on type, inputs, params)
- ✗ **Do NOT reorder stateful nodes or side-effect nodes**

---

### Stage 4: Schedule (AST → Execution Plan)

**Input:** Optimized AST
**Output:** SchedulePlan + buffer allocation map

**SchedulePlan Entry:**
```typescript
{
  opId: string,
  nodeId: string,
  fn: string,                    // C++ function name
  inputs: [bufferId | scalars],  // Port references
  outputs: [bufferId],           // Output buffer ID
  is_stateful: bool,
  can_inplace: bool,             // Reuse input buffer as output
  live_start: number,            // Iteration number
  live_end: number               // Iteration number
}
```

**Scheduling Rules:**
1. Topological order (ensure inputs ready before use)
2. Stateful nodes placed before consumers
3. Buffer lifetime analysis: compute live range for each buffer
4. Linear-scan allocator:
   - Persistent buffers (stateful): pre-allocated
   - Temporary buffers: assigned from pool, reclaimed when `live_end < next_use`
5. In-place transforms allowed if exclusive consumer + type match
6. Scratch buffer cap: default 16KB (CLI flag: `--scratch-cap`)

---

### Stage 5: Emit (Plan → C++ Code)

**Input:** SchedulePlan + optimized AST
**Output:** `pattern_<name>.h/.cpp` + registration code

**Pattern Function Signature:**
```cpp
#include "runtime_glue.h"
#include "stateful_nodes.h"
#include "parameters.h"

void draw_<name>(float time, const PatternParameters& params) {
  // Single audio snapshot per frame (critical for firmware sync)
  AudioDataSnapshot snap;
  get_audio_snapshot(&snap);

  // ... generated code for each scheduled operation ...

  // Color range enforcement: clamp RGB to [0, 1] before write
  for (int i = 0; i < NUM_LEDS; ++i) {
    leds[i] = CRGBF(
      fminf(fmaxf(r[i], 0.0f), 1.0f),
      fminf(fmaxf(g[i], 0.0f), 1.0f),
      fminf(fmaxf(b[i], 0.0f), 1.0f)
    );
  }
}
```

**Emission Constraints:**
- ✓ Include guards: `NUM_LEDS`, `stateful_nodes.h`, `parameters.h`
- ✓ No heap allocation in frame loop (malloc/new forbidden)
- ✓ Single `get_audio_snapshot()` call per frame
- ✓ Symbol hygiene: prefix with pattern ID, wrap in anonymous namespace
- ✓ Deterministic: same graph → identical code (bit-for-bit)

---

## 5. Graph JSON Format

**Example: Bloom Mirror Pattern**
```json
{
  "version": 1,
  "name": "bloom_mirror",
  "nodes": [
    {
      "id": "time",
      "type": "Time",
      "inputs": {},
      "params": {}
    },
    {
      "id": "audio",
      "type": "AudioSnapshot",
      "inputs": {},
      "params": {}
    },
    {
      "id": "bloom",
      "type": "BloomTrail",
      "inputs": {"audio": "audio"},
      "params": {"decay": 0.92}
    },
    {
      "id": "mirror",
      "type": "Mirror",
      "inputs": {"src": "bloom"},
      "params": {}
    },
    {
      "id": "out",
      "type": "LedOutput",
      "inputs": {"color": "mirror"},
      "params": {}
    }
  ]
}
```

**Schema Validation:** Use `graph.schema.json` (JSON Schema draft 7) for validation.

---

## 6. Initial Node Catalog

**Inputs:**
- `Time()` → `time`
- `AudioSnapshot()` → `audio_spectrum`, `audio_envelope`
- `Beat()` → `beat_event`

**Parameters:**
- `ParamF(name: string)` → `param<float>`
- `ParamColor(name: string)` → `param<color>`

**Math:**
- `Add(a: float, b: float)` → `float`
- `Mul(a: float, b: float)` → `float`
- `Lerp(a: float, b: float, t: float)` → `float`

**Color:**
- `Hsv(h: float, s: float, v: float)` → `color`
- `Color(rgb: vec3)` → `color`

**Buffers:**
- `Fill(color: color)` → `led_buffer<vec3>`
- `Blur(src: led_buffer<vec3>)` → `led_buffer<vec3>`

**Stateful:**
- `BufferPersist(decay: float, src: led_buffer<vec3>)` → `led_buffer<vec3>` [<1KB state]

**Output:**
- `LedOutput(color: led_buffer<vec3>)` → void (writes to `leds[]`)
- `LedOutputMirror(color: led_buffer<vec3>)` → void (mirrors + writes)

---

## 7. Testing Strategy

### Unit Tests (per stage)
- **Parser:** Invalid JSON, unknown node types, port mismatches
- **Validator:** Cycle detection, type errors, memory budget, param bounds
- **Optimizer:** DCE removes unreachable chains, const folding preserves semantics
- **Scheduler:** Deterministic topo order, buffer lifetime correctness
- **Emitter:** Generated code compiles, matches expected template

### E2E Tests
- **Golden comparison:** `graph.json` → C++ → compile → CPU simulation → pixel CRC vs. baseline
- **Hardware PoC:** Bloom + Spectrum on device; FPS <2% delta from manual versions

### Test Artifacts (--debug flag)
- `dump-ast.json` (post-parse)
- `dump-typed.json` (post-validate)
- `dump-opt.json` (post-optimize)
- `dump-plan.json` (post-schedule)

---

## 8. CLI Interface

```bash
# Build a single graph
k1c build graph.json --out firmware/src/graph_codegen/pattern_graph.cpp

# With debugging
k1c build graph.json --debug --dump-dir debug_artifacts/

# Custom scratch buffer cap
k1c build graph.json --scratch-cap 32KB

# Validate without emitting
k1c validate graph.json

# Schema validation
k1c validate-schema graph.json
```

---

## 9. Integration Points

### Firmware Integration (Phase 1 Days 6–7)

1. **Pattern Registration:**
   - Generated `register_<name>.cpp` appends to `pattern_registry.h` OR generates switch case
   - Firmware recompiles; new pattern available immediately

2. **Stateful Nodes:**
   - Reuse existing `stateful_nodes_*` helpers from Task 9
   - No new runtime code; generated code calls existing APIs

3. **Audio Access:**
   - Single `get_audio_snapshot(&snap)` per frame (matches firmware sync model)
   - Pass `snap` by const ref to nodes needing audio

4. **CI/Build:**
   - Add `k1c build patterns/*.json --out firmware/src/graph_codegen/` to build script
   - Detect schema drift: reject unknown node types, versions

---

## 10. Error Codes

Map compiler errors to K1 error codes for telemetry:
- E1001: Type mismatch
- E1002: Missing required input
- E1003: Cycle detected
- E1004: Memory budget exceeded
- E1005: Unknown node type
- E1006: Invalid parameter value
- E1007: Invalid graph structure
- E1008: Codegen failed

---

## 11. Acceptance Criteria

- ✓ Bloom + Spectrum patterns compile and run on hardware
- ✓ No cycles allowed; clear validation messages with nodeId + port
- ✓ No heap alloc in frame loop; stateful buffers pre-allocated
- ✓ Emitted C++ compiles warning-free; integrates with pattern registry
- ✓ Performance within 2% of manual patterns; memory <5KB/pattern
- ✓ Error codes mapped and reported
- ✓ CLI fully functional: `k1c build graph.json --out firmware/src/graph_codegen/`
- ✓ All unit + E2E tests passing
- ✓ Design doc + API reference + graph schema published

---

## 12. Timeline

| Days | Milestone |
|------|-----------|
| 1–2 | Schema + Parser + Validator (with fixtures) |
| 3 | Initial IR + Optimizer |
| 4 | Scheduler + allocator + tests |
| 5 | C++ emitter skeleton + registration |
| 6 | Bloom PoC (first light on hardware) |
| 7 | Spectrum PoC + perf validation |
| 8–10 | Polish, error messages, documentation |

---

## 13. Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| **IR creep:** Too much abstraction | Keep IR minimal: node id, op type, typed ports, constant pool only |
| **Runtime mismatch:** Generated code doesn't work with firmware | Generate code using existing APIs (stateful_nodes_*, get_audio_snapshot()) |
| **Memory blowup:** Buffers exceed hardware limits | Enforce buffer lifetime analysis; cap temp buffers at 16KB; expose allocator stats |
| **Debuggability:** Generated code hard to understand | Emit stage annotations in comments with source node IDs + params |
| **Integration risk (Days 6–7):** Hardware tests fail | Schedule coordination with firmware owner; validate registration + stateful node reuse in CI |

---

## 14. Next Steps

**Phase 5: Worktree Setup** (when ready)
- Set up isolated `codegen/` branch for compiler development
- Coordinate with firmware team on pattern registration API

**Phase 6: Planning Handoff** (when design approved)
- Create detailed task breakdown for each stage implementation
- Assign developers to parser, validator, optimizer, scheduler, emitter

---

**Design Status:** ✅ APPROVED
**Ready for Implementation:** YES
**Implementation Start:** November 13, 2025


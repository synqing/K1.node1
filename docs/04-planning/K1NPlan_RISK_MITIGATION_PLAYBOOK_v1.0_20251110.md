---
title: "K1.node1 Risk Mitigation Playbook: Phase 1-4 Action Plans"
type: "Plan"
project: "K1.node1"
project_code: "K1N"
version: "v1.0"
date: "2025-11-10"
status: "active"
intent: "Concrete, immediately-actionable mitigation strategies to reduce Phase 1-4 execution risk"
doc_id: "K1NPlan_RISK_MITIGATION_PLAYBOOK_v1.0_20251110"
owner: "Project Manager"
tags: ["risk","mitigation","playbook","action","phase1","phase2","phase3","phase4"]
related:
  - "K1NAnalysis_RISK_ASSESSMENT_PHASE1_4_v1.0_20251110.md"
  - "K1NPlan_TASK_ROADMAP_CORRECTED_v1.0_20251110.md"
---

# K1.node1 Risk Mitigation Playbook: Phase 1-4 Action Plans

**Effective Date:** November 10, 2025
**Target:** Reduce Phase 1-4 risk by 30-50% via pre-execution preparation and daily discipline
**Baseline Risk:** 65% Phase 1, 45% Phase 2, 25% Phase 3, 55% Phase 4
**Target Risk (with mitigations):** 30% Phase 1, 20% Phase 2, 15% Phase 3, 25% Phase 4

---

## IMMEDIATE ACTIONS (THIS WEEK: NOV 10-15)

### Action 1: Pre-Task 5 Design Review (2 hours)

**Who:** Senior Engineer (architect role) + Task 5 lead + QA lead
**When:** Nov 12, 2:00-4:00 PM (before Task 5 kickoff Nov 13)
**What to Review:**

1. **Compiler Architecture Document** (1 hour)
   - 5-stage pipeline: Parse, Validate, Optimize, Schedule, Emit
   - Entry/exit contracts for each stage
   - Concrete example: trace a Bloom graph through all 5 stages
   - Expected outputs: AST, typed AST, IR, scheduled graph, C++ code

2. **Type System Specification** (30 minutes)
   - Scalar types: int, bool, float, time, duration, rng_seed
   - Vector types: vec2, vec3, color, audio_spectrum, audio_envelope, beat_event
   - Buffer types: led_buffer<float>, led_buffer<vec3>
   - Coercion rules: when can int → float? can color → vec3?
   - 3-5 test examples with expected coercions

3. **Node Catalog Preview** (20 minutes)
   - Target: 35-40 node types
   - Categories: inputs, math, filters, gradients, geometry, noise, stateful
   - Estimated memory footprint per type
   - Safety constraints: no heap, single audio snapshot, RGB clamp

4. **Hardware PoC Plan** (10 minutes)
   - Day 6 test: compile Bloom, run on device, measure FPS
   - Acceptance: <2% FPS delta vs. hand-written, visual correctness
   - If fail: showstopper; must understand why before proceeding

**Approval Checklist:**
- [ ] All stages clearly understood? (no fuzzy scope)
- [ ] Examples traced end-to-end? (confidence in design)
- [ ] Hardware PoC success criteria clear? (measurable)
- [ ] Questions documented? (for real-time discussion during Task 5)

**Outcome:** Task 5 lead starts with clear spec, reduced design uncertainty (est. -25% design risk)

---

### Action 2: Pre-Agreed Decision Gate Criteria (1 hour)

**Who:** Project Lead + Product Owner + Ops Lead + Senior Engineer
**When:** Nov 13, 10:00-11:00 AM (immediately after Phase 0 complete)
**What to Agree:**

**Phase 3 GO/NO-GO Decision Criteria (Non-Negotiable):**

```
PASS CRITERIA (ALL required for GO):
1. Hardware Validation (Task 11): 25/25 tests pass (no exceptions)
2. Stress Testing (Task 12): 8/8 scenarios pass, zero memory leaks
3. Code Quality (Task 13): Coverage >90%, Lints 0 high/critical, Security ≥90/100

FAIL CRITERIA (ANY triggers NO-GO):
- Task 11: <25/25 tests pass
- Task 12: <8/8 scenarios pass OR memory leaks detected
- Task 13: Coverage <90%, >0 high/critical lints, Security <90/100

DECISION PROCESS:
- Task 14 (Nov 4-5): Gather evidence (test reports, coverage reports, scan results)
- Review against criteria: PASS? FAIL?
- Stakeholder vote: GO or NO-GO (simple majority)
- Document decision + sign-off in ADR-0018

NO POST-HOC CHANGES ALLOWED:
- No late criteria additions (e.g., "we also want performance <5ms/frame")
- No lowering bar (e.g., "coverage 85% is good enough")
- Criteria locked in this meeting; cannot change post-Nov 13
```

**Document:** Save in `docs/02-adr/K1NADR_0018_PHASE3_DECISION_GATE_v1.0_20251110.md`

**Approval Checklist:**
- [ ] All stakeholders agree to criteria? (document signatures)
- [ ] Criteria measurable and objective? (no subjective judgments)
- [ ] Consequences of GO vs. NO-GO understood? (schedule impact)

**Outcome:** No surprise goal-post moving at Phase 3 end; decision gate credible (est. -20% stakeholder misalignment risk)

---

### Action 3: Scope Lock & Change Control Process (2 hours)

**Who:** Project Lead + Engineering Lead + Product Owner
**When:** Nov 15, 10:00 AM-12:00 PM (end of Phase 1 planning)
**What to Define:**

**Phase 4 MVP (Fixed Scope):**

```
MUST HAVE (Phase 4 delivery):
- Task 15: Codegen for essential nodes (35+ types, Bloom/Spectrum priority)
- Task 16: Pattern migration (11 high-value patterns)
- Task 17: Graph Editor UI (node palette, parameter editing, compile integration)
- Task 18: Integration testing (3+ pattern combinations, CI harness)
- Task 19: SDK documentation (schema, node catalog, how-tos, error codes)

NICE-TO-HAVE (defer to v1.1):
- Task 20: Parameter editor fancy features (undo/redo, real-time preview)
- Advanced UI features (graph visualization, node inspector, batch compile)
- Bulk operations (compile 100 patterns in one command)
- Admin dashboard (system metrics, user analytics)
- Video tutorials, API playground, web IDE

PROCESS:
- Any new request routed to change control board
- Weekly review: scope, effort, risk, priority
- Decision: accept, defer to v1.1, or reject
- All decisions logged in `docs/04-planning/K1NPlan_CHANGE_LOG_PHASE4_v1.0_20251110.md`
```

**Communication:**
- Email to all stakeholders: "Phase 4 scope locked as of Nov 15. All new requests go to v1.1 or change control board."
- Document scope in shared wiki/confluence
- Reference in daily standup

**Approval Checklist:**
- [ ] MVP clearly defines Phase 4 deliverables? (clear ownership)
- [ ] Nice-to-haves list documented? (justification for deferral)
- [ ] Change control process defined? (weekly cadence, decision criteria)
- [ ] All stakeholders agree? (signatures)

**Outcome:** Scope creep prevented; Phase 4 timeline realistic (est. -30% scope creep risk)

---

### Action 4: Task 5 Escalation Playbook Drafted (1 hour)

**Who:** Task 5 lead + Project Manager + Senior Engineer (backup)
**When:** Nov 12, 4:00-5:00 PM (before Task 5 start)
**What to Document:**

```
TRIGGER: Task 5 completion forecast <75% by Nov 17 EOD (Day 4)

IMMEDIATE RESPONSE (Nov 17 EOD):
1. Task 5 lead + Project Manager assess: which stages behind?
   - Parser 50%? Validator 40%? Scheduler 30%?
2. Root cause: design flaw? coding complexity? testing burden?
3. Estimate: if continue 1 engineer, when complete? (Nov 22? Nov 25?)

ESCALATION DECISION (Nov 18 AM):
- IF: <1 day slip → continue with existing engineer, monitor closely
- IF: 1-2 day slip → bring in 2nd senior engineer to parallelize
- IF: 3+ day slip → declare DELAY and cascade to Phase 2 (Nov 25 → Nov 27)

IF ESCALATION TRIGGERED (Nov 18-19):
- 2nd engineer assigned to Stages 2-3 (Validator/Optimizer)
- Task 5 lead focuses on Stages 1/4/5 (Parser, Scheduler, Emitter)
- Daily sync: merge work, resolve conflicts
- Nov 20: golden test suite + hardware PoC verification
- If still not ready: declare DELAY (escalate to manager)

COST-BENEFIT:
- Cost: +1 engineer × 2-3 days = 16-24 hours
- Benefit: -40% probability of 7+ day overrun
- ROI: High (small cost, large risk reduction)

SUCCESS METRIC:
- By Nov 20: Bloom PoC compiles + runs on hardware + <2% FPS delta
```

**Document:** Save in `docs/04-planning/K1NPlan_TASK5_ESCALATION_PLAYBOOK_v1.0_20251110.md`

**Approval Checklist:**
- [ ] Escalation conditions clear? (measurable trigger)
- [ ] Response timeline defined? (who decides, by when)
- [ ] Resource availability confirmed? (backup engineer available Nov 18)
- [ ] Manager approval obtained? (authority to escalate)

**Outcome:** Clear escalation path reduces uncertainty, enables fast response (est. -30% Task 5 risk)

---

## PHASE 1 ACTIONS (NOV 13-20)

### Daily Task 5 Checkpoint (5 min/day, 10:00 AM standup)

**Checkpoint Questions:**

1. **Day 1-2 (Nov 13-14): Schema & Parser**
   - Schema design finalized? (type system, node catalog, error codes)
   - Parser tests: can parse valid Bloom graph? Can detect invalid JSON?
   - Any design surprises?

2. **Day 3 (Nov 15): Validator**
   - Type checking works for Bloom graph inputs/outputs?
   - Cycle detection finds circular dependencies?
   - Parameter bounds checking clamps correctly?

3. **Day 4 (Nov 16): Optimizer**
   - Constant folding works? (detects constant expressions)
   - DCE works? (removes dead code, skips RNG/stateful nodes)
   - Any unexpected side effects?

4. **Day 5 (Nov 17): Scheduler**
   - Topological sort produces valid execution order?
   - Buffer lifetime analysis works? (marks persistent vs. scratch)
   - Scratch buffer allocator respects cap?

5. **Day 6+ (Nov 18-20): Emitter + Hardware PoC**
   - Emitter generates valid C++? (compiles without warnings)
   - Firmware helper calls correct? (signature, argument types)
   - **Day 6 Hardware PoC:** Bloom runs on device; <2% FPS delta?

**Escalation Trigger:** If any day is <75% complete, escalate (see Action 4 playbook)

---

### Task 5 Code Review Checklist (1 hour on Days 2, 4, 6)

**Reviewer:** Senior Engineer (not Task 5 lead)

**Day 2 Review (Parser + Schema):**
- [ ] Schema is clear (type system, node catalog, error codes defined)
- [ ] Parser handles all input types (scalar, vector, buffer, parameter)
- [ ] Error messages cite nodeId/type/port (helpful for debugging)
- [ ] Golden tests cover: valid graphs, invalid JSON, malformed ports

**Day 4 Review (Validator + Optimizer):**
- [ ] Validator checks type compatibility (no implicit buffer conversions)
- [ ] Cycle detection reports path (not just "cycle found")
- [ ] Parameter bounds enforcement working (clamp + warn)
- [ ] Optimizer doesn't break stateful nodes or side effects
- [ ] Golden tests cover: type mismatches, cycles, memory overrun, const folding

**Day 6 Review (Emitter):**
- [ ] Generated C++ compiles without warnings
- [ ] Firmware helper calls use correct signatures
- [ ] No heap allocation in generated code
- [ ] Single audio snapshot call guaranteed
- [ ] RGB colors clamped to [0,1]
- [ ] Golden test: Bloom C++ matches expected structure

**Hardware PoC Validation (Day 6):**
- [ ] Bloom graph compiles via `k1c build`
- [ ] Firmware builds without errors
- [ ] Bloom runs on device (visual inspection)
- [ ] FPS baseline: ≥120 FPS? <2% vs. hand-written?
- [ ] NO CRASHES during 2-minute test

**Approval Criteria:**
- Each review must pass all checklist items
- If any fail: Task 5 lead explains plan to fix by next review
- If >2 items fail per review: escalate (trigger Action 4 playbook)

---

### Mock Firmware Helpers (4 hours, Day 2)

**Goal:** Decouple emitter development from firmware integration

**Deliverables:**

```cpp
// firmware/src/graph_generated_shims.h
// Mock helpers for testing emitter output

// Quantize: convert float [0,1] to uint8 [0,255]
inline void quantize_led_buffer_safe(
    const float* input, uint8_t* output, int len) {
  for (int i = 0; i < len; i++) {
    int val = (int)(fmin(1.0f, fmax(0.0f, input[i])) * 255.0f);
    output[i] = val;
  }
}

// Pack: convert RGB uint8 to RMT format
inline void pack_to_rmt_symbols(
    const uint8_t* rgb, uint32_t* symbols, int len) {
  // Mock: just copy LSBs
  for (int i = 0; i < len * 3; i++) {
    symbols[i] = rgb[i] ? 0x80000000 : 0x00000000;
  }
}

// Transmit: send to RMT driver
inline int transmit_leds_mock(const uint32_t* symbols, int len) {
  // Mock: pretend success
  return 0;
}

// ... 36 more helper stubs ...
```

**Benefit:**
- Emitter tests don't require firmware compilation
- Faster iteration on compiler code
- Decouples teams (firmware can work in parallel)

---

## PHASE 2 ACTIONS (NOV 20-25)

### Pattern Documentation (3 hours, Nov 20)

**Who:** Engineer familiar with legacy code
**Deliverable:** `docs/06-reference/K1NRef_PATTERN_LEGACY_ANALYSIS_BLOOM_SPECTRUM_v1.0_20251110.md`

**For Each Pattern (Bloom, Spectrum):**

1. **Input Dependencies**
   - Audio stream: which? (FFT spectrum? Chromagram? Autocorrelation?)
   - Input rate: every frame? every 50ms?
   - Data range: FFT [0, 1]? Audio RMS [0, 1]?

2. **State Machines**
   - Frame counter logic (used for timing animations?)
   - LED buffer persistence (pixels persist across frames?)
   - Stateful nodes: brightness accumulator, smoothing filter, phase state?

3. **Parameter Ranges**
   - Saturation: [0, 1]? What happens at edges?
   - Brightness: [0, 1]? Any auto-scaling?
   - Mirror mode: toggle on/off? Range [0, 360°]?

4. **Performance Constraints**
   - Expected FPS: 120?
   - Max CPU budget: <5 ms/frame?
   - Memory constraints: <1 KB stateful?

**Example Snippet (Bloom):**

```
BLOOM PATTERN ANALYSIS
======================

Input Dependencies:
- FFT spectrum (64 bins) sampled every frame
- Auto-correlation (pitch detection) sampled every frame
- Audio envelope (RMS) sampled every frame

State Machines:
- Frame counter (0..inf) used for time-based easing
- LED buffer (180 floats) persists across frames (trail effect)
- Brightness accumulator (float) smooths rapid changes

Parameters:
- saturation: [0, 1] (0=gray, 1=full color)
- mirror: bool (true=mirror left-right)
- mood: float [0, 1] (controls hue palette)

Performance:
- FPS target: 120
- CPU budget: <5 ms/frame
- Memory: easing buffers (10 KB) + LED buffer (180 × 4 bytes)
```

**Benefit:** Pattern engineers know exactly what to replicate in graphs; -20% migration risk

---

### Graph Design Review (1 hour, Nov 20)

**Who:** Task 7-8 leads + Task 5 lead (compiler) + Architecture lead
**When:** Nov 20, 3:00-4:00 PM (before coding starts)
**What to Review:**

For Bloom and Spectrum graphs:

1. **Graph Structure** (sketch on paper first)
   - Which nodes used? (FFT input, smoothing, gradient mapper, mirror, trail)
   - Node count estimate? (target 15-25 nodes)
   - All inputs connected? (no dangling ports)

2. **Node Memory Budget**
   - Stateful nodes (trail buffer, smoothing state)
   - Estimated memory: <1 KB total?
   - Allocation plan: which goes in DRAM, which in scratch?

3. **Performance Assumptions**
   - Expected per-node latency? (generated code should show)
   - Total graph latency <5 ms/frame?
   - Any profiling points to instrument?

4. **Edge Cases**
   - What if audio is silent (FFT all zeros)?
   - What if pattern first run (no prior frame state)?
   - Parameter boundary conditions (saturation=0, mirror toggle)?

**Approval:** All questions answered on paper before code; no surprises during integration

**Benefit:** Design flaws caught early, -2 day refactor avoided; -20% migration risk

---

### Inline Profiling Integration (2 hours per task, Nov 22-23)

**Goal:** Detect FPS regression real-time, not after Phase 2 complete

**Approach:**

1. **Insert Timing Probes**
   ```cpp
   // In generated C++ (emitter responsibility)
   uint32_t t0 = micros();
   // ... node execution ...
   uint32_t dt = micros() - t0;
   ```

2. **Log to Circular Buffer** (not UART, don't kill FPS)
   ```cpp
   struct PerfSample { uint32_t dt; };
   PerfSample perf_log[120]; // 1 second at 120 FPS
   int perf_idx = 0;
   ```

3. **REST Endpoint: /api/perf**
   ```
   GET /api/perf
   Returns:
   {
     "avg_us": 4200,
     "max_us": 5100,
     "min_us": 3800,
     "fps": 119.5
   }
   ```

4. **Threshold Check**
   - If avg >5000 µs: WARN (approaching 120 FPS budget)
   - If max >6000 µs: ERROR (exceeded budget with headroom)
   - Log to debug console

**Benefit:** Performance regression caught same day; root-cause immediately; -15% perf risk

---

## PHASE 3 ACTIONS (NOV 25-DEC 5)

### Coverage Instrumentation in Task 5 (3-4 hours, Day 4 Task 5)

**Goal:** Enable automatic coverage measurement in Phase 3, not manual instrumentation

**What Task 5 Emitter Must Do:**

1. **Add Coverage Markers to Generated C++**
   ```cpp
   // Generated code includes coverage hooks
   void draw_bloom_graph(...) {
     __builtin_expect(gcov_counter[0]++, 1); // entry point
     // node execution
     __builtin_expect(gcov_counter[1]++, 1); // if branch
   }
   ```

2. **Enable Coverage Flags in platformio.ini**
   ```ini
   [env:esp32-s3-devkitc-1]
   build_flags = --coverage -fprofile-arcs
   ```

3. **REST Endpoint: /api/coverage**
   ```
   POST /api/coverage/dump
   Writes coverage data to SPIFFS for download
   ```

**Benefit:** Coverage measurement automatic; Phase 3 SAST automation ready; -15% Phase 3 risk

---

### Early SAST Scan (Week 1, Nov 10-15)

**Who:** QA Engineer
**When:** Nov 12 (before Task 5 starts)
**Tool:** clang-analyzer or cppcheck

**Command:**
```bash
cd firmware/
cppcheck --enable=all --suppress=missingIncludeSystem \
  --report-progress src/ > sast_baseline_nov12.txt
```

**Process:**
1. Generate baseline report (identify existing issues)
2. Fix all CRITICAL and HIGH issues (if fixable in <1 day)
3. Document remaining issues with "known limitation" status
4. Run same scan again in Phase 3 Task 13 (compare delta)

**Benefit:** Phase 3 SAST not a surprise; major issues already fixed; -20% Phase 3 quality risk

---

### Test Plan Definition (2 hours, Nov 24)

**Who:** QA Lead + Hardware Engineer
**Deliverable:** `docs/09-implementation/K1NImpl_HARDWARE_TEST_PLAN_v1.0_20251110.md`

**Hardware Validation Tests (Task 11): 25 tests**

| # | Test Case | Expected Result | Pass Criteria |
|---|-----------|-----------------|---------------|
| 1 | GPIO init | All pins configured | 0 errors in log |
| 2 | GPIO output | LED toggle works | visually confirmed |
| 3 | I2S init | Microphone working | audio samples captured |
| 4 | I2S read | Audio data in range | no crashes, 0-1 range |
| 5 | RMT init (ch0) | RMT channel active | no errors |
| 6 | RMT transmit (ch0) | LEDs update | <2 ms latency |
| 7 | RMT init (ch1) | Dual channel active | no conflicts |
| 8 | RMT dual tx | Both channels sync | <500 µs skew |
| ... | (17 more) | | |
| 25 | WiFi OTA update | Firmware updated | version confirmed |

**Stress Test Scenarios (Task 12): 8 scenarios**

| # | Scenario | Duration | Pass Criteria |
|---|----------|----------|---------------|
| 1 | Rapid pattern changes | 10 min (every 100 ms) | no crashes |
| 2 | High audio input | 10 min | FPS >100 |
| 3 | Continuous LED updates | 30 min (60 FPS) | no corruption |
| 4 | WiFi reconnection cycles | 10 min (every 60s) | no audio loss |
| 5 | Parameter sweep | 5 min | all params respond |
| 6 | Memory exhaustion | 5 min (allocate near limit) | graceful failure |
| 7 | Long-duration stability | 60 min | no memory leaks, FPS stable |
| 8 | Concurrent WiFi + LED + Audio | 15 min | all systems responsive |

**Test Harness:**
- Script to run tests sequentially or in parallel
- Log all output (timestamps, errors, metrics)
- Generate PASS/FAIL report
- Video recording (for visual confirmation)

**Benefit:** Phase 3 tests disciplined, not improvised; clear success criteria; -25% Phase 3 risk

---

## PHASE 4 ACTIONS (DEC 5+)

### Dependency Board (Weekly, 30 min Monday standup)

**What:** Visualize task dependencies and identify blockers

**Layout:**
```
Task 15 (Codegen)  → Task 16 (Patterns)  → Task 18 (Integration Test)
                   ↓
Task 17 (UI)       → Task 18 (Integration Test)

Task 19 (Docs)     (independent, can start anytime)
Task 20 (Params)   ← Task 17 (UI) (blocker)
```

**Weekly Review (Monday, 10:00 AM):**
1. Task 15: Codegen progress? Any blockers? When available for Task 16?
2. Task 16: Waiting for Task 15? How many patterns complete?
3. Task 17: UI component progress? When ready for Task 20 integration?
4. Task 18: Waiting for Task 15/16? Test plan ready?
5. Task 19: Progress? Any missing info from other tasks?
6. Task 20: Waiting on Task 17? Ready to start integration?

**Blocker Resolution (Same Day):**
- If Task 16 blocked by Task 15: reassign Task 16 engineer to help Task 15 (2-person sprint)
- If Task 18 blocked by Task 15: start test plan design, mock data for testing
- Clear blockers same day; don't wait until next week

**Benefit:** Blockers visible, unblocked within 24 hours; -20% coordination overhead

---

### Change Control Board (Weekly, 30 min Wednesday)

**Who:** Project Lead + Product Owner + Engineering Lead
**When:** Wednesdays 10:00 AM (mid-sprint checkpoint)
**Process:**

1. **Review Backlog** (5 min)
   - List all new feature requests received this week
   - Priority: must-have, nice-to-have, v1.1?

2. **Evaluate Each** (20 min)
   - Effort estimate
   - Risk to schedule (slip Days?)
   - Impact on MVP quality
   - Decision: ACCEPT, DEFER, REJECT

3. **Document** (5 min)
   - Log in change log: `K1NPlan_CHANGE_LOG_PHASE4_v1.0_20251110.md`
   - Communicate decision to requester

**Example Decisions:**
- Request: "Can we add autocomplete to parameter editor?"
  - Effort: 4 hours
  - Risk: slips Task 20 (scheduled 12-20) to Dec 22
  - Decision: **DEFER to v1.1** (not critical path)

- Request: "We need 20 more pattern migrations (vs. 11)"
  - Effort: 20 additional engineer-hours
  - Risk: slips Task 16 by 5 days
  - Decision: **REJECT** (exceeds scope; Phase 4 focused on core 11)

**Benefit:** Scope control, stakeholder expectations managed, morale protected

---

### Team Allocation (Confirmed Nov 15)

**Phase 4 Team (5 engineers, 4 weeks):**

| Task | Lead | Support | Role | Dates |
|------|------|---------|------|-------|
| Task 15 | Senior Engineer A | - | Codegen for all node types | Dec 5-12 |
| Task 16 | Mid Engineer B | Mid Engineer C | Pattern migration (split 11 patterns) | Dec 8-16 |
| Task 17 | Frontend Eng D | - | Graph editor UI + integration | Dec 8-12 |
| Task 18 | QA Engineer E | Support from A,B | Integration testing harness | Dec 12-18 |
| Task 19 | Tech Writer F | (pairings with A,B,D) | SDK docs | Dec 8-20 |
| Task 20 | Frontend Eng D | - | Parameter editor | Dec 12-20 |

**Handoff Points:**
- Nov 20: Task 5 hands off to Task 6 (if on schedule)
- Dec 5: All prerequisites complete; Phase 4 kickoff
- Dec 12: Task 15 (codegen) stable; hand off to Task 16
- Dec 18: All core tasks (15-18) complete; Task 19-20 finalize
- Dec 28-31: Launch window

---

## DAILY DISCIPLINE (ALL PHASES)

### 10-Minute Daily Standup (Every Day, 10:00 AM)

**Cadence:** Monday-Friday
**Attendees:** All hands on critical path (Tasks 5, 6, 7, 8, 15, 16, 18)
**Format:**

1. **Green Lights** (1 min: what went well)
   - "Parser tests all passing"
   - "Bloom graph design approved"
   - "No new blockers"

2. **Yellow Lights** (2 min: at-risk items)
   - "Validator complexity higher than expected; might slip to Day 4"
   - "Hardware PoC revealed FPS regression; investigating"
   - "Pattern memory budget tight; needs redesign"

3. **Red Lights** (2 min: blockers)
   - "Firmware helper API not finalized; blocking emitter work"
   - "Compiler crashes on nested types; requires debug"
   - "Hardware unavailable for PoC; schedule impact?"

4. **Forecast** (2 min: on-track or delayed?)
   - "Task 5 on schedule; Day 6 hardware PoC proceeding"
   - "Task 7 delayed 1 day due to graph complexity; will catch up with focused sprint"
   - "Phase 2 at risk of Nov 25 delay; investigating Task 5 quality"

5. **Escalations** (3 min)
   - Any items need manager attention?
   - Any requests for resources/help?
   - Any urgent decisions needed today?

**Action Items:**
- Owner, description, deadline, owner confirms ("I'll fix by EOD")
- Log all open items in shared document
- Review unresolved items next day

**Red Light Threshold:**
- If same red light >2 consecutive days: escalate to manager
- If 3+ red lights in same area (e.g., compiler quality): trigger escalation playbook

---

### Weekly Status Report (Fridays, EOD)

**Recipient:** Project Lead + Manager + Stakeholders
**Format:** Email, 1 paragraph per phase/task

**Template:**
```
PHASE X STATUS (PHASE X DATES)

Task X: [DESCRIPTION]
- Status: [ON TRACK | AT RISK | DELAYED]
- Completion: X% (target Y%)
- This week: [accomplishment 1], [accomplishment 2]
- Blockers: [if any]
- Next week: [plan]

...
```

**Example:**
```
PHASE 1 STATUS (NOV 13-20)

Task 5 (Compiler Architecture):
- Status: ON TRACK
- Completion: 45% (target 50%)
- This week: Parser + Validator complete; golden tests passing
- Blockers: None
- Next week: Scheduler + Emitter; hardware PoC Day 6

Task 6 (Node Catalog):
- Status: ON TRACK
- Completion: 30% (target 40%, but Task 5 dependency)
- This week: Waiting for Task 5 schema; preliminary docs drafted
- Blockers: Task 5 schema finalization
- Next week: Full node catalog + reference docs
```

**Metrics to Include:**
- % complete per task
- On-time forecast (yes/no)
- Number of open blockers
- Scope creep requests (this week: 0)
- Quality metrics (coverage %, lints found, errors fixed)

---

## SUCCESS METRICS & DASHBOARDS

### Phase 1 Health (Nov 13-20)

```
METRIC                           GREEN              YELLOW             RED
───────────────────────────────────────────────────────────────────────────
Task 5 Completion               50% by Day 3       <50% by Day 3      <25% by Day 3
Task 5 Quality                  0 bugs in review   1-2 bugs found     >2 bugs/review
Hardware PoC (Day 6)            <2% FPS delta      2-3% FPS delta     >3% or crash
Design Clarity                  All questions      1-2 questions      >2 open
                                answered           open               questions
```

### Phase 2 Health (Nov 20-25)

```
METRIC                           GREEN              YELLOW             RED
───────────────────────────────────────────────────────────────────────────
Task 7 Graph Design             Design review      1 rework round     >1 rework
                                pass
Task 7 Code Compile             Compiles, 0 warn   Compiles, 1-2 warn Won't compile
Task 8 Same as Task 7           (parallel)         (parallel)         (parallel)
Performance (FPS)               120 FPS measured   <120 FPS (but      <100 FPS or
                                <2% vs. baseline   fixable)           timeout
Memory Budget                   <1 KB stateful     0.8-1 KB           >1 KB
```

### Phase 3 Health (Nov 25-Dec 5)

```
METRIC                           GREEN              YELLOW             RED
───────────────────────────────────────────────────────────────────────────
Hardware Tests (25 total)       20/25 pass by      15/25 pass by      <15/25 pass
                                Nov 28             Dec 1
Stress Scenarios (8 total)      6/8 pass by        4/8 pass by        <4/8 pass
                                Dec 1              Dec 3
Coverage %                      >90%               80-90%             <80%
Lints (high/critical)           0                  1-2                >2
Security Score                  ≥90/100            80-89/100          <80/100
```

### Phase 4 Health (Dec 5-31)

```
METRIC                           GREEN              YELLOW             RED
───────────────────────────────────────────────────────────────────────────
Task 15 Completion              100% by Dec 12     100% by Dec 13     100% by Dec 15+
Task 16 Patterns (11)           9/11 by Dec 14     7/11 by Dec 16     <7/11 by Dec 18
Task 18 Harness Tests           90% pass by        80% pass by        <80% pass
                                Dec 18             Dec 20
Open Blockers (daily)           0-1                2-3                >3
Scope Creep Requests            0-1/week           2/week             >2/week (escalate)
```

---

## FINAL CHECKLISTS

### Before Phase 1 Kickoff (Nov 13)

- [ ] Design review completed (Action 1)
- [ ] Escalation playbook drafted (Action 4)
- [ ] Pre-agreed decision gate criteria signed off (Action 2)
- [ ] Scope lock + change control process defined (Action 3)
- [ ] Task 5 lead briefed on expectations
- [ ] Daily standup schedule confirmed
- [ ] Hardware reserved for PoC (Day 6)

### Before Phase 2 Kickoff (Nov 20)

- [ ] Task 5 Phase 1 handoff: all golden tests passing
- [ ] Hardware PoC successful (Bloom: <2% FPS delta)
- [ ] Task 6 node catalog preliminary version
- [ ] Pattern documentation complete (Bloom, Spectrum)
- [ ] Graph design review passed (Bloom, Spectrum)
- [ ] Inline profiling instrumentation planned

### Before Phase 3 Kickoff (Nov 25)

- [ ] All Phase 2 tasks complete
- [ ] Test plan definition done (25 hardware tests, 8 stress scenarios)
- [ ] Coverage instrumentation added to generated code
- [ ] Early SAST scan baseline completed
- [ ] Hardware environment prepared (testing rig ready)

### Before Phase 4 Kickoff (Dec 5)

- [ ] Phase 3 GO decision: all 3 criteria passed
- [ ] Scope lock confirmed (11 patterns, not more)
- [ ] Team allocated (5 engineers, clear roles)
- [ ] Dependency board created
- [ ] Change control board process active

---

**Document Owner:** Project Manager
**Last Updated:** November 10, 2025
**Review Cycle:** Weekly (update metrics) | Daily (standup)
**Escalation:** Any red light >2 consecutive days → escalate to manager

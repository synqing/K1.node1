---
status: active
author: Claude Agent (architect-review)
date: 2025-11-05
intent: Executive kickoff document for Week 1 (Nov 6-13) parallel execution of Phase 2D1 fixes and Graph PoC
references: ADR-0003, ADR-0009, ADR-0008, K1NPlan_STRATEGY_PHASE_2D1_GRAPH_PARALLEL_MASTER_v1.0_20251108.md
---

# WEEK 1 EXECUTION KICKOFF (Nov 6-13, 2025)

## Executive Summary

Today marks the transition from planning to execution. We begin **parallel execution** of two critical workstreams:
- **Workstream A (Phase 2D1 Fixes):** 4 critical security/stability fixes (24 engineer-hours)
- **Workstream B (Graph PoC):** Convert Bloom + Spectrum patterns to node graphs (validation gate)

Both workstreams run simultaneously. **Go/No-Go decision on Nov 13** determines 12-week execution path.

---

## Workstream A: Phase 2D1 Critical Security Fixes

**Target:** All 4 fixes DONE, TESTED, VALIDATED by end of Week 1 (Nov 13)

### Fix Priority & Effort

| Fix | Risk | Effort | Owner | Status |
|-----|------|--------|-------|--------|
| 1. Remove WiFi credentials from git history | **CRITICAL** | 2h | FW Eng | Ready |
| 2. I2S timeout handling & recovery | **HIGH** | 4h | FW Eng | Ready |
| 3. WebServer bounds checking (buffer overflow) | **HIGH** | 2h | FW Eng | Ready |
| 4. Error code infrastructure (silent failures) | **MEDIUM** | 4h | FW Eng | Ready |

**Total:** 12 engineer-hours over Nov 6-10 (with validation/testing Nov 11-13)

### Fix #1: Remove WiFi Credentials from Git History (2 hours)

**Why This First:** Security exposure in git log; must be cleaned before any commits.

**What's Happening:**
- WiFi SSID/password hardcoded in `firmware/src/wifi_config.h`
- Credentials are in git commit history (exposed)
- Must be removed from history + moved to device secrets management

**Acceptance Criteria:**
- ✅ Credentials removed from all git commits (use `git-filter-branch` or BFG)
- ✅ Credentials moved to secure storage (see ADR-0009 for mechanism)
- ✅ CI/CD secrets configured (GitHub Actions)
- ✅ Zero credential strings in source files
- ✅ Code compiles with 0 warnings

**Implementation Runbook:**
```bash
# 1. Identify current credential usage
grep -r "ssid\|password" firmware/src/

# 2. Create Device.secrets file (device-specific, not in git)
cat > firmware/src/Device.secrets.h << 'EOF'
#pragma once
// Local device secrets - NOT CHECKED IN
const char* DEVICE_WIFI_SSID = "your-ssid";
const char* DEVICE_WIFI_PASS = "your-password";
EOF

# 3. Update wifi_config.h to use Device.secrets.h instead
# (Include Device.secrets.h instead of hardcoded values)

# 4. Clean git history (if needed)
git filter-branch --tree-filter 'grep -r "password\|ssid" && sed -i ...' -- --all

# 5. Update .gitignore to ignore Device.secrets.h
echo "Device.secrets.h" >> .gitignore

# 6. Verify
git log --all -S "password" # Should return 0 results
grep -r "password" firmware/src/ # Should only find Device.secrets.h
```

**Expected Outcome:** Zero credential exposure, clean git history, device-specific secrets management in place.

---

### Fix #2: I2S Timeout Handling & Recovery (4 hours)

**Why Important:** Audio bus hangs on connection loss; causes 30+ second freeze; user frustration.

**What's Happening:**
- I2S bus has no timeout on SPH0645 microphone connection loss
- Firmware locks waiting indefinitely for audio data
- No error recovery mechanism
- Results in: device appears frozen, no audio input until restart

**Acceptance Criteria:**
- ✅ I2S timeout implemented (5-second max wait)
- ✅ Automatic recovery & reconnection attempt
- ✅ Error logged (for diagnostics)
- ✅ User-facing indicator (LED blink, API response)
- ✅ 3x stress test: pull/reconnect mic rapidly, <1% frame drop
- ✅ Hardware latency: 40-50ms (unchanged)

**Implementation Runbook:**

1. **Add timeout mechanism** (firmware/src/audio_manager.cpp):
   ```cpp
   // Existing code waits forever:
   // esp_i2s_read(I2S_PORT, buffer, BUFFER_SIZE, portMAX_DELAY);

   // New code with timeout:
   esp_i2s_read(I2S_PORT, buffer, BUFFER_SIZE, 5000 / portTICK_PERIOD_MS);
   // Timeout after 5 seconds
   ```

2. **Implement recovery** (firmware/src/audio_manager.cpp):
   ```cpp
   if (bytes_read == 0) {
     // Timeout occurred
     audio_error_count++;
     if (audio_error_count >= 3) {
       // Too many errors, try to reinitialize I2S
       esp_i2s_stop(I2S_PORT);
       // Re-init logic here
       esp_i2s_start(I2S_PORT);
     }
   }
   ```

3. **Add diagnostics**:
   - Track timeout events (counter)
   - Log recoveries
   - Expose via REST API: `/api/audio/status` returns `{ audio_ok: true/false, timeouts: N, recoveries: M }`

4. **Hardware validation** (firmware/test/):
   - Simulate mic disconnect (pull SPH0645 from I2S bus)
   - Measure recovery time (<100ms)
   - Verify FPS stability (no drops during recovery)
   - Reconnect mic, verify normal operation

**Expected Outcome:** Zero 30-second freezes; automatic recovery from audio connection loss; diagnostics available.

---

### Fix #3: WebServer Bounds Checking (Buffer Overflow) (2 hours)

**Why Important:** Stack buffer overflow vulnerability; potential DoS/crash.

**What's Happening:**
- WebServer request handler doesn't validate Content-Length header
- Large requests can overflow stack buffers
- No input validation on API parameters
- Risk: crash, undefined behavior, potential RCE (low-probability but severe)

**Acceptance Criteria:**
- ✅ All HTTP request parameters bounds-checked
- ✅ Content-Length validated (max 10KB)
- ✅ Request body truncated/rejected if too large
- ✅ Buffer overflow test suite passes
- ✅ Stress test: 100 large requests, 0 crashes

**Implementation Runbook:**

1. **Identify vulnerable buffers** (firmware/src/webserver.cpp):
   ```cpp
   // UNSAFE: No bounds checking
   char request_body[512];
   memcpy(request_body, incoming_data, content_length); // BUG!
   ```

2. **Add validation**:
   ```cpp
   // SAFE: Bounds checked
   const size_t MAX_BODY_SIZE = 10 * 1024; // 10KB max

   if (content_length > MAX_BODY_SIZE) {
     send_http_error(431); // "Request Header Fields Too Large"
     return;
   }

   char request_body[MAX_BODY_SIZE];
   if (incoming_data_size > sizeof(request_body)) {
     // Truncate or reject
     incoming_data_size = sizeof(request_body);
   }
   memcpy(request_body, incoming_data, incoming_data_size);
   ```

3. **Add parameter validation**:
   - Pattern ID: 0-14 (valid range)
   - Parameter values: within expected ranges
   - String length: max 256 chars

4. **Test** (firmware/test/):
   - Fuzz test with oversized payloads
   - Verify no crashes, clean error responses

**Expected Outcome:** Zero buffer overflow vulnerabilities, clean error handling, API resilience.

---

### Fix #4: Error Code Infrastructure (4 hours)

**Why Important:** Silent failures make debugging impossible; users don't know what went wrong.

**What's Happening:**
- API returns HTTP 200 even when operations fail
- No standardized error codes
- Stack traces don't propagate to client
- User sees "success" but LED patterns don't change

**Acceptance Criteria:**
- ✅ All errors mapped to error codes (1000-1999 range)
- ✅ API returns appropriate HTTP status codes (4xx/5xx)
- ✅ Error response includes error code + human message
- ✅ All error paths tested (100% coverage)
- ✅ Device exposes error log via API

**Implementation Runbook:**

1. **Define error codes** (firmware/src/error_codes.h):
   ```cpp
   enum ErrorCode {
     ERR_SUCCESS = 0,
     ERR_PATTERN_NOT_FOUND = 1001,
     ERR_INVALID_PARAMETER = 1002,
     ERR_AUDIO_TIMEOUT = 1003,
     ERR_I2S_INIT_FAILED = 1004,
     ERR_WIFI_DISCONNECT = 2001,
     ERR_API_BUFFER_OVERFLOW = 3001,
   };
   ```

2. **Standardize responses** (firmware/src/webserver.cpp):
   ```cpp
   // Bad: No error info
   // send_response("{success: false}");

   // Good: Error info included
   send_json_response({
     "success": false,
     "error_code": 1001,
     "error_message": "Pattern 99 not found (valid range: 0-14)",
     "timestamp_ms": millis()
   });
   ```

3. **Implement error logging**:
   - Circular buffer: last 100 errors
   - Include timestamp, code, context
   - Expose via API: `/api/errors?limit=10`

4. **Test**:
   - Every error path triggers correct error code
   - Error logs persist and are retrievable
   - API responses properly formatted

**Expected Outcome:** Complete error visibility, easier debugging, better user experience.

---

## Workstream B: Graph System PoC (Pattern Conversion)

**Target:** Validate that Bloom + Spectrum patterns CAN be converted to node graphs by end of Week 1 (Nov 13)

### PoC Scope: 2 Patterns, 38 Nodes Total

| Pattern | Node Count | Complexity | Status |
|---------|-----------|-----------|--------|
| Bloom | 16 nodes | Medium | Ready for conversion |
| Spectrum | 22 nodes | High | Ready for conversion |

**Total PoC effort:** ~16 engineer-hours (Nov 6-10, validation Nov 11-13)

### PoC Acceptance Criteria (MUST ALL PASS on Nov 13)

1. **Functional Equivalence:**
   - ✅ Both patterns compile from node graphs to C++ code
   - ✅ Visual output identical to original hardcoded patterns
   - ✅ Animation timing matches original (within 50ms)
   - ✅ Audio reactivity matches original

2. **Performance:**
   - ✅ FPS impact: <2% (current 60 FPS → minimum 58.8 FPS)
   - ✅ Memory overhead: <5KB per node
   - ✅ Compile time: <5 seconds (graph → C++)
   - ✅ Runtime latency: <10ms (input change → visual update)

3. **Stability:**
   - ✅ 24-hour continuous run: 0 crashes
   - ✅ Parameter changes: no glitches, smooth transitions
   - ✅ Audio loss: automatic recovery (uses audio history buffer)
   - ✅ Memory: no leaks (measured over 24h)

4. **Code Quality:**
   - ✅ Generated C++ code compiles with 0 warnings
   - ✅ Static analysis (clang-tidy): 0 high-severity issues
   - ✅ Test coverage: 95%+ for node library
   - ✅ Documentation: Each node type has usage example

### PoC Implementation Roadmap

**Day 1-2 (Nov 6-7): Analyze Patterns**
- [ ] Extract Bloom pattern (firmware/src/generated_patterns.h, lines TBD)
- [ ] Break down into 16 nodes with inputs/outputs
- [ ] Create node composition diagram
- [ ] Repeat for Spectrum pattern (22 nodes)
- [ ] Document node types used

**Day 3-4 (Nov 8-9): Implement Nodes**
- [ ] Implement 6 node types needed for PoC (input, math, transform, generator, stateful, output)
- [ ] Write unit tests for each node
- [ ] Integrate into graph execution engine
- [ ] Compile test graphs to C++

**Day 5 (Nov 10): Validate**
- [ ] Run Bloom pattern on hardware
- [ ] Run Spectrum pattern on hardware
- [ ] Measure FPS, memory, latency
- [ ] Capture metrics and validate against criteria
- [ ] Document any deviations

**Day 6-7 (Nov 11-13): Hardening & Decision**
- [ ] 24-hour stability test
- [ ] Stress test (rapid parameter changes)
- [ ] Complete test coverage gap analysis
- [ ] Nov 13 9:00 AM: Decision gate review
  - If PASS: Proceed to Phase 2D1 parallel execution (8-week development)
  - If FAIL: Fallback to C++ SDK (10-week sequential development)

---

## Parallel Execution Timeline

```
Nov 6-10 (Week 1: Core Work)
├─ Workstream A: 4 Fixes (Firmware Engineering)
│  ├─ Nov 6: WiFi credentials cleanup (2h)
│  ├─ Nov 7: I2S timeout implementation (2h)
│  ├─ Nov 8: WebServer bounds checking (2h)
│  ├─ Nov 9-10: Error infrastructure (4h)
│  └─ Nov 11-13: Testing & validation
│
├─ Workstream B: Graph PoC (Architecture Team)
│  ├─ Nov 6-7: Pattern analysis & breakdown
│  ├─ Nov 8-9: Node implementation (6 types)
│  ├─ Nov 10: Hardware validation
│  └─ Nov 11-13: Stress testing & hardening
│
└─ Workstream C: QA & Integration (1 Engineer)
   ├─ Nov 6-10: Continuous integration setup
   ├─ Nov 11-13: Full system regression testing
   └─ Nov 13: Decision package preparation

Nov 13 (Decision Gate)
├─ 9:00 AM: PoC Results Review
│  ├─ FPS impact <2%? ✅/❌
│  ├─ Memory <5KB? ✅/❌
│  ├─ 24h stability? ✅/❌
│  └─ Code quality? ✅/❌
│
└─ 10:00 AM: Go/No-Go Decision
   ├─ If PASS (all ✅): Proceed with graph-based architecture
   ├─ If FAIL (any ❌): Fallback to C++ SDK (slower, less extensible)
   └─ Brief engineering team on decision & next phase
```

---

## Daily Standup Template

Use this structure for daily 15-min standup (Nov 6-13):

```
## Daily Standup - Nov X, 2025

### Workstream A: Phase 2D1 Fixes
- Yesterday: [What completed?]
- Today: [What's in progress?]
- Blockers: [Any issues?]

### Workstream B: Graph PoC
- Yesterday: [What completed?]
- Today: [What's in progress?]
- Blockers: [Any issues?]

### Workstream C: QA Integration
- Yesterday: [What completed?]
- Today: [What's in progress?]
- Blockers: [Any issues?]

### Critical Path Items
- [Any tasks blocking the Nov 13 decision?]
```

---

## Nov 13 Decision Framework

### Decision Criteria (ALL must PASS to Go)

| Criterion | Target | Method | Owner |
|-----------|--------|--------|-------|
| FPS impact | <2% | Measure on hardware | QA |
| Memory overhead | <5KB per node | Profiling tool | FW Eng |
| 24h stability | 0 crashes | Automated stress test | QA |
| Code quality | 0 warnings | clang-tidy | Code Review |
| Test coverage | 95%+ | Coverage report | QA |
| Pattern matching | Visual equivalence | Side-by-side video capture | Architecture |

### Go Decision (PASS all criteria)
→ Proceed with graph-based node system architecture
→ 8-week parallel execution (Nov 13 - Jan 15)
→ Full 35-40 node types implementation
→ Convert all 17 patterns to graphs
→ Ship in Q1 2026

### No-Go Decision (FAIL any criterion)
→ Fallback to C++ SDK option
→ 10-week sequential implementation (Nov 13 - Jan 29)
→ Limited extensibility, faster to ship
→ Re-evaluate graph architecture in 6 months

---

## Deliverables Due Nov 13

### Workstream A Deliverables
- [ ] 4 fixes merged to main branch
- [ ] Unit tests pass (100%)
- [ ] Hardware validation report (latency, FPS, stability)
- [ ] Security audit (0 credential exposure, 0 buffer overflows)
- [ ] ADR-0009 validation document

### Workstream B Deliverables
- [ ] Bloom pattern converted to 16-node graph
- [ ] Spectrum pattern converted to 22-node graph
- [ ] 6 core node types implemented + tested
- [ ] Graph-to-C++ compiler functional
- [ ] PoC validation report (FPS, memory, stability metrics)
- [ ] ADR-0008 pattern migration validation

### Workstream C Deliverables
- [ ] CI/CD pipeline configured and passing
- [ ] Full regression test suite (all 17 patterns + hardware APIs)
- [ ] Metrics dashboard (FPS, memory, error rates)
- [ ] Nov 13 decision package (one-page summary + detailed results)

### Leadership Deliverables
- [ ] Nov 13 Decision Memo (Go/No-Go + rationale)
- [ ] Updated project timeline (8-week vs 10-week based on decision)
- [ ] Team brief on next phase execution

---

## Risk Mitigation

**Risk: Graph PoC finds architectural blocker**
→ Mitigation: Architecture pre-review (Nov 5) to surface blockers early
→ Fallback: C++ SDK route has been fully analyzed and is viable

**Risk: Phase 2D1 fixes take longer than estimated**
→ Mitigation: Parallel execution means PoC team is unblocked
→ Fallback: Extend Phase 2D1 to Nov 15 if needed (doesn't block decision)

**Risk: Performance regression discovered during stress test**
→ Mitigation: Daily performance metrics dashboard
→ Fallback: Optimize node execution or implement selective graph compilation

---

## Resources & Documentation

All necessary reference materials are in `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/`:

- **ADR-0003:** Parallel Execution Model (strategic rationale)
- **ADR-0008:** Pattern Migration Strategy (technical approach)
- **ADR-0009:** Phase 2D1 Critical Fixes (detailed specifications)
- **K1NPlan_STRATEGY_PHASE_2D1_GRAPH_PARALLEL_MASTER_v1.0_20251108.md:** Complete strategic guide (380+ lines)
- **K1NArch_ASSESSMENT_STATEFUL_NODE_FEASIBILITY_v1.0_20251108.md:** Deep technical analysis of node architecture

---

## Next Immediate Actions (NOW - Nov 6)

1. **Team Kickoff Meeting** (30 min)
   - Brief on Week 1 objectives
   - Clarify roles (Workstream A: 2 engineers; B: 2 architects; C: 1 QA)
   - Establish daily standup time
   - Address questions

2. **Setup & Environment** (2 hours)
   - Verify firmware builds locally (0 errors/warnings)
   - Verify webapp runs locally
   - Setup CI/CD pipeline for automated testing
   - Create feature branches for each fix

3. **Detailed Task Breakdown** (1 hour per workstream)
   - Workstream A: Assign fixes to engineers
   - Workstream B: Assign node types to architects
   - Workstream C: Setup test infrastructure

4. **Daily Standup Schedule**
   - Time: [TBD - team preference]
   - Duration: 15 minutes
   - Format: See template above
   - Location: [TBD]

---

**Status:** READY TO LAUNCH
**Start Date:** Nov 6, 2025 (TODAY)
**Decision Gate:** Nov 13, 2025 at 9:00 AM
**Owner:** Engineering Team
**Escalation:** @spectrasynq

This kickoff document is ACTIVE. Update daily standup notes in `docs/04-planning/K1NPlan_LOG_WEEK_1_STANDUP_v1.0_20251108.md` (created separately).


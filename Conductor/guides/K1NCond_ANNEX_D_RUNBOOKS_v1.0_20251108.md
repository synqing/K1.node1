# Annex D — K1.node1 Domain Runbooks

**Status**: Proposed
**Owner**: Claude
**Date**: 2025-11-08
**Scope**: Role-specific workflows and acceptance criteria

---

## Role Taxonomy for K1.node1

- **Feature Agent** — Implements new patterns, webapp features
- **Bugfix Agent** — Diagnoses and fixes reported issues
- **Performance/Optimization Agent** — Profiling, latency reduction
- **Test Agent** — Device validation, integration testing
- **Release Agent** — Tag, build, publish artifacts
- **Research Agent** — Investigate technical questions, document findings

---

## 1. Feature Agent (New Pattern or Webapp Feature)

### Workflow
```
1. Receive task (Taskmaster: ".taskmaster/tasks/tasks.json", e.g., "Add Aurora pattern")
2. Create workspace: feature/k1-45-aurora
3. Implement:
   - firmware/src/generated_patterns.h (draw_aurora function)
   - webapp/src/lib/patterns.ts (registry entry)
   - webapp/src/lib/param_registry.ts (sliders)
4. Compile locally: K1_TARGET=fw:build → validate 0 warnings
5. Test on device: K1_TARGET=test:pattern → capture metrics
6. Open PR (title: "feat: add Aurora pattern (K1-45)")
7. Wait for CI + review → merge
8. Archive workspace
```

### Metrics
- **Success criteria**: CI passes, device test ≥ 60 FPS, <3.5ms render
- **Escalation**: After 2 failed CI cycles → human review
- **Turnaround**: Target 30 min (compile 2m + test 4m + review 5m)

### Checklist
- [ ] PlatformIO compile: 0 warnings
- [ ] Flash usage < 70%
- [ ] Device test: metrics captured
- [ ] Baseline comparison: no regression
- [ ] PR linked to Taskmaster task entry
- [ ] Commit message: `feat: ...`

---

## 2. Bugfix Agent

### Workflow
```
1. Receive bug report (e.g., K1-51: "Beat Tunnel crashes on low audio input")
2. Create workspace: bugfix/k1-51-beat-tunnel-crash
3. Diagnose: search device logs, reproduce locally
4. Root cause found: buffer overflow in AUDIO_VU calculation
5. Implement fix: firmware/src/pattern_audio_interface.h
6. Add regression test: firmware/test/audio_interface_test.cpp
7. Test on device: K1_TARGET=test:pattern (Beat Tunnel specifically)
8. Open PR (title: "fix: prevent Beat Tunnel crash on low audio (K1-51)")
9. Merge → release
```

### Metrics
- **Success criteria**: Bug no longer reproduces; new test passes
- **Escalation**: After 3 attempts, insufficient device data → escalate to human
- **Turnaround**: Target 45 min

### Checklist
- [ ] Root cause documented
- [ ] Fix doesn't break existing tests
- [ ] New regression test added
- [ ] Device validation passed
- [ ] PR references Taskmaster task

---

## 3. Performance/Optimization Agent

### Workflow
```
1. Receive optimization task (e.g., K1-42: "Reduce render latency to <3ms")
2. Create workspace: optimize/k1-42-latency
3. Profile current: K1_TARGET=fw:build → deploy → capture trace logs
4. Identify bottleneck: e.g., Gaussian envelope calculation in hot path
5. Optimize algorithm: vectorize, precompute, cache
6. Re-profile: verify delta (5ms → 2.8ms ✓)
7. Compare metrics vs baseline: FPS stable, memory unchanged
8. Open PR (title: "perf: optimize Beat Tunnel render latency (K1-42)")
9. Performance validation: p95 latency < 3ms → merge
```

### Metrics
- **Success criteria**: Metric improves by target %; no regression elsewhere
- **Measurement**: p50, p95, p99 latencies; FPS stability
- **Escalation**: If optimization introduces memory overhead, ask for trade-off review

### Checklist
- [ ] Baseline metrics captured
- [ ] Optimization documented (algorithm change, tradeoffs)
- [ ] Post-optimization metrics meet target
- [ ] No new compiler warnings
- [ ] Device stability verified (24h idle test optional)

---

## 4. Test Agent (Device Validation & Integration)

### Workflow
```
1. Trigger: "Run integration test" or post-merge validation
2. Create workspace: test/integration-xyz
3. Setup: compile both firmware + webapp, seed test fixtures
4. Run test suite:
   - K1_TARGET=test:integration
   - Firmware boots → device ready ✓
   - Webapp loads at port $CONDUCTOR_PORT ✓
   - Device API reachable @ 192.168.1.104:3000 ✓
   - Select 5 patterns → each runs 10s, metrics captured
   - Audio input via test file → audio-reactive pattern responds ✓
5. Generate report: test_results.json + HTML report
6. Archive results to ops/artifacts/
7. Pass/Fail determination: all checks ≥ green
```

### Metrics
- **Success criteria**: All test cases pass
- **Duration**: ~5 min per run
- **Failure mode**: Log detailed device state; escalate if persistent

### Checklist
- [ ] Firmware boots successfully
- [ ] Webapp loads without errors
- [ ] Device API is reachable
- [ ] All pattern selections respond
- [ ] Audio reactivity confirmed
- [ ] Metrics baseline met

---

## 5. Release Agent

### Workflow
```
1. Trigger: "Release v0.2.0" (manual approval)
2. Create workspace: release/v0.2.0
3. Validate: All PRs merged, CI green, docs updated
4. Create release artifact:
   - firmware: pio run → collect .bin file
   - webapp: npm run build → collect dist/
5. Tag: git tag v0.2.0
6. Create release notes (aggregate from PRs):
   - New features
   - Bug fixes
   - Performance improvements
   - Breaking changes
7. Publish:
   - GitHub Release (upload .bin + dist archive)
   - Update docs/RELEASES.md
8. Notify: update Taskmaster task to "Released"
```

### Metrics
- **Success criteria**: Release artifacts published; CI green
- **Turnaround**: ~10 min (automated)

### Checklist
- [ ] All PRs merged to main
- [ ] CI passing on main
- [ ] Release notes drafted and reviewed
- [ ] Firmware .bin verified (correct size, architecture)
- [ ] Webapp dist/ verified
- [ ] Git tag created and pushed
- [ ] GitHub release published

---

## 6. Research Agent

### Workflow
```
1. Receive research task (e.g., "Analyze audio latency sources in firmware")
2. Create workspace: research/audio-latency-analysis
3. Investigate:
   - Search internal docs + GitHub issues
   - Review firmware audio path (SPH0645 → AUDIO_VU macro → pattern)
   - Identify: I2S buffer, I2S audio processing, pattern execution
4. Synthesize findings:
   - Document in research/findings.md
   - Create Notion page with links
5. Propose solution (e.g., "Reduce I2S buffer from 512 to 256 samples")
6. Open PR: docs/05-analysis/audio_latency_analysis.md
7. Attach findings to related Taskmaster tasks
```

### Metrics
- **Success criteria**: Analysis complete, findings documented, links verified
- **Deliverable**: Markdown doc + optionally Notion page

### Checklist
- [ ] Problem clearly stated
- [ ] Research methodology explained
- [ ] Sources cited (code refs, links, dates)
- [ ] Findings organized (key insights, tradeoffs)
- [ ] Recommendations actionable

---

## Quick Reference Matrix

| Agent Role | Primary Domain | Tools Used | Typical Duration | Escalation |
|-----------|---------------|-----------|------------------|-----------|
| Feature | firmware + webapp | C++, TypeScript, device API | 30 min | After CI fail×2 |
| Bugfix | firmware diagnosis | logs, profiler, test | 45 min | After 3 attempts |
| Optimization | firmware performance | profiler, metrics baseline | 60 min | If overhead > budget |
| Test | validation + reporting | device API, test framework | 5 min | If >1 failure |
| Release | artifact publishing | git, GitHub API, docs | 10 min | If CI fails |
| Research | knowledge synthesis | web search, internal docs | 120 min | N/A (informational) |

---

## References

- **K1.node1 Master Brief**: [conductor_mcp_master_brief.md](conductor_mcp_master_brief.md)
- **K1.node1 Deployment Strategy**: [conductor_annex_c_deployment_strategy.md](conductor_annex_c_deployment_strategy.md)

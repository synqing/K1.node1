# Phase A Security & Phase 0 Readiness Playbook

## Purpose & Scope
- Field-ready runbook to execute and govern Phase A: two-day security remediation + three-day Phase 0 beat-phase exposure, across security, firmware, QA, and release ops.
- Aligns with CLAUDE guardrails, Firmware Ops Runbook, and Engineering Playbook. Adds swimlanes, quality gates, CI/CD, comms, and concrete commands/artifacts.
- Outcome: Go/No-Go backed by metrics, logs, and signed artifacts; canary→stable rollout with rollback ready.

## RACI
- Security Lead: Responsible for fixes, tests, and review sign-off. Accountable for security gate.
- Firmware Ops Captain: Responsible for env control, telemetry, rollout, rollback. Accountable for canary gate.
- Implementation Engineer: Responsible for Phase 0 code + tests. Accountable for pattern non-regression.
- QA/Validation: Responsible for metronome test, hardware-in-loop, coverage. Consulted on gates.
- Release Manager: Responsible for tagging, signing, release notes. Informed on gates.

## Workstreams & Swimlanes
- Security Remediation: buffer overflow, race condition, globals, initialization, bounds checks. See fixes: `docs/06-reference/K1NRef_REFERENCE_PHASE_A_SECURITY_FIXES_v1.0_20251108.md`.
- Phase 0 Implementation: snapshot + macros, demo patterns, developer docs.
- Telemetry & Observability: heartbeat signals, REST endpoints, rate limits, histograms.
- QA & Validation: unit/integration tests, metronome harness, logic analyzer, performance baselines.
- Release Ops: canary pipeline, signing, rollback procedure, release logs.

## Timeline & Milestones
- Day 1: Fix buffer overflow + globals; update tests; capture pre-fix baseline.
- Day 2: Fix race + bounds; complete unit/integration; CI green; Security Gate.
- Day 3: Implement snapshot fields + macros; add demo patterns; tests.
- Day 4: Telemetry update (heartbeat + REST); metronome validation; Canary Gate.
- Day 5: Device validation, performance histograms; docs finalized; Stable Release Gate.

## Definition Of Ready (DoR)
1. Environment Control
   - PlatformIO pins: `platform = espressif32@6.12.0`; `platform_packages = platformio/framework-arduinoespressif32@3.20017.241212`.
   - Doctor script produces: header checks, strict-mode flags, tool versions → saved under `docs/09-reports/`.
   - Build signature printed at boot and via `/api/health` (Arduino, IDF_VER, git SHA, build time).
2. Security Remediation Plan
   - Each issue mapped to owner, file, approach, test cases, and acceptance.
   - PRs planned in small, reviewable chunks (≤300 lines) with targeted tests.
3. Telemetry Baseline
   - Capture CPU/frame, `rmt_empty`, `rmt_maxgap_us`, FPS, memory. Save JSON snapshots.
4. Documentation Routing
   - Link this playbook in roadmap; create placeholders for validation and release logs.

## Commands & Tools (Quick Reference)
- Build (debug/release): `pio run -e esp32-s3-devkitc-1 -t clean && pio run`
- Upload/Monitor: `pio run -t upload && pio device monitor -b 115200`
- Health checks: `curl -s http://DEVICE/api/health | jq`  `curl -s http://DEVICE/api/rmt | jq`  `curl -s http://DEVICE/api/device/performance | jq`
- Signature check: verify `arduino`, `idf_ver`, `git_sha`, `build_time` present.

## Execution Checklists
### Security Hardening (Day 1–2)
- Buffer overflow fixed with bounds-safe operations; unit tests cover overrun cases.
- Race in `goertzel.cpp` mitigated (mutex/atomic/lock-free pattern consistent with seqlock usage).
- Globals guarded in `tempo.h`; thread safety verified with contention tests.
- `AudioDataSnapshot` fully initialized; zero uninitialized reads under sanitizers.
- Spectral bounds enforced; edge-bin tests included.
- Evidence: CI green, test results attached, device smoke passes `/api/*`.
- Reference: follow code snippets and tests in `docs/06-reference/K1NRef_REFERENCE_PHASE_A_SECURITY_FIXES_v1.0_20251108.md`.

Hard Rule (Hot Paths)
- No mutex in IRAM or hot paths for shared audio/spectral data. Use seqlock + atomic sequence counters for writer/reader discipline. PRs must show Before/After and justify any deviation with metrics.

### Gate: Security Complete (Exit Criteria)
- All 5 issues merged with reviews from Security Lead and Reviewer.
- CI smoke (debug/release) + hardware-in-loop sample run ✅.
- Canary image built with DEBUG telemetry; rollback pointer recorded.

### Phase 0 Implementation (Day 3–5)
- Extend `AudioDataSnapshot` with beat fields; add 8 macros; 2 demo patterns compiled.
- Update heartbeat and REST payloads to include relevant metrics; apply rate limits.
- Metronome validation ≥95 % within ±5 % tolerance; logs attached.
- Before/after CPU/RMT metrics captured; FPS unchanged for existing patterns.

### Gate: Phase 0 Ready
- All tests pass; demo patterns verified on hardware; no regressions.
- Updated docs published; links in this playbook; canary plan approved.

## CI/CD Pipeline & Quality Gates
- Triggers: PR and main branch.
- Jobs: lint/static checks → build debug/release → unit tests → device smoke (mock acceptable if no lab) → artifact sign.
- Required checks to merge:
  - Security: 0 critical/high issues outstanding.
  - Coverage: ≥85% for touched files; tests added for each fix.
  - Performance baseline captured and attached pre-Phase 0.
  - Endpoint contract tests for `/api/health`, `/api/rmt`, `/api/device/performance`.
  - Concurrency stress artifact attached from `tools/seqlock_stress` (≥10M attempts, success ratio reported).
  - Hawk-Eye: CI emits warnings for `std::mutex` in hot paths; optional local guard: `tools/hawk_eye_guard.sh` (see `.githooks/pre-commit`).

## Branching & Review Policy
- Branch naming: `phase-a/<workstream>-<short-desc>`.
- PR size ≤300 LOC; include test diffs and links to related artifacts.
- Review checklist: env pins unchanged or ADR provided; strict/relaxed guards present; hot paths log-free; telemetry proven; rollback path clear.
  - Concurrency style: seqlock + atomic counters for shared buffers; buffer wrapping via modulo/bitmask; default-initialized snapshots; safe spectral accessors.

Style Shortlist (Phase A Hot Paths)
| Area | Rule |
| --- | --- |
| Concurrency | Seqlock + atomic sequence counters; 1 writer, lock-free readers |
| Synchronization | No mutex/spinlocks in IRAM/hot paths |
| Bounds | Use modulo or bitmask (Po2) for ring indices; inline range checks for bins |
| Initialization | Default member initializers for POD-like structs; zero-initialized factories where useful |
| Telemetry | No logging in hot paths; expose via heartbeat/REST only |
| Guards | `__has_include` strict/relaxed; compile-time `static_assert` invariants |

## Telemetry Schema & Endpoint Contracts (Examples)
- `/api/health`
  - Example: `{ "arduino": 10812, "idf_ver": "v5.1.2", "git_sha": "abc1234", "build_time": 1731000000, "degraded": false, "reset_cause": 12 }`
- `/api/rmt`
  - Example: `{ "ch1": {"empty": 1523, "maxgap_us": 97}, "ch2": {"empty": 1519, "maxgap_us": 94} }`
- `/api/device/performance`
  - Example: `{ "fps": 60, "frame_p95_us": 9500, "cpu_pct": 42, "mem_free_kb": 132, "hist": {"bins":[...]}}`

## Canary → Stable Rollout (Step-by-Step)
1. Prep
   - Enable DEBUG telemetry; ensure heartbeat includes FPS, idle, `rmt_empty`, `rmt_maxgap_us`, CPU %, memory, beat accuracy.
   - Compute SHA256 and timestamp; expose in `/api/health`.
2. Deploy Canary
   - Flash a single device; record device ID, image hash, start time.
   - Monitor `/api/*` every 5s for 10–15 min; store logs.
   - Pass if: zero timeouts; `maxgap_us` ≪ 320 µs; beat accuracy ≥95 %; FPS unchanged.
3. Promote
   - Flip to stable; disable DEBUG telemetry if needed; update release notes; lock rollback pointer.
4. Rollback (if needed)
   - Use `/api/rollback` or flash previous image; confirm `/api/health` reflects rollback hash; open incident note.

## Metronome Test Setup (Fixture)
1) Generate click track at 120 BPM
   - `python tools/metronome.py --bpm 120 --seconds 60 --outfile metronome_120bpm.wav`
2) Flash device with DEBUG telemetry enabled
   - Build/upload: `pio run -e esp32-s3-devkitc-1-debug && pio run -e esp32-s3-devkitc-1-debug -t upload`
3) Inject beat_phase observations to log
   - Ensure heartbeat or a debug log prints `timestamp_s,beat_phase` each interval (or expose via REST and poll).
   - Preferred: `python tools/poll_beat_phase.py --device http://DEVICE --endpoint /api/device/performance --field beat_phase --interval 0.25 --count 240 --out beat_phase_log.csv`
   - Tip: set `export K1_DEVICE_URL=http://DEVICE` to skip `--device` flag.
4) Compare observed vs expected
   - `python tools/beat_phase_analyzer.py --bpm 120 --log beat_phase_log.csv --out beat_phase_report.csv`
5) Compute accuracy
   - Primary metric: `(expected_phase - actual_phase) / expected_phase` (skip when expected≈0).
   - Secondary: wrapped absolute phase error in `beat_phase_report.csv`.

## Test Plan
- Unit: bounds, initialization, bin access, macro outputs.
- Integration: concurrency under load, seqlock consistency, endpoint payload validity.
- Hardware-in-Loop: logic analyzer for LED timings, skew <10 µs, RMT refills cadence.
- Metronome Harness: external beat source; accuracy computed over N beats; attach CSV + plot.

## Quality Gates & Exit Criteria (Numeric)
- Security: 0 critical/high; no new medium without mitigation.
- Performance: <10 ms/frame sustained; no FPS regression on legacy patterns.
- Telemetry: endpoints live; heartbeat includes required fields; rate limits configured.
- Coverage: ≥85% touched; ≥20 unit + ≥3 integration tests executed.

## Risk Register (Top)
- Regression from security fixes – Mitigation: targeted tests, canary duration, rollback ready – Owner: Security Lead.
- Telemetry omissions – Mitigation: contract tests, CI check – Owner: Firmware Ops.
- CPU budget overrun – Mitigation: baseline capture + halt condition – Owner: Implementation Engineer.

## Communication & Rituals
- Daily 10-min standup (Blockers, Plan, Risks).
- Mid-phase gate reviews (Security Gate end of Day 2; Phase 0 Gate end of Day 4).
- Status lines posted with links to artifacts; decisions logged in release notes.

## Escalation & SLAs
- Critical break (build failures, new critical vulns, missing telemetry): respond ≤2h; decision (rollback or fix) ≤4h.
- Open incident under `docs/09-reports/` with timeline, cause, fix, prevention.

## Artifacts & Links
- Master: `docs/09-reports/K1NReport_REPORT_MASTER_SYNTHESIS_v1.0_20251108.md`
- Validation: `docs/09-reports/K1NReport_VALIDATION_SECURITY_FIX_v1.0_20251108.md` (populate with proofs)
- Spec: `docs/04-planning/K1NPlan_PLAN_PHASE_0_BEAT_PHASE_EXPOSURE_v1.0_20251108.md`
- Snippets: `docs/06-reference/K1NRef_TEMPLATES_PHASE_0_IMPLEMENTATION_SNIPPETS_v1.0_20251108.md`
 - Reference: `docs/07-resources/K1NRes_REFERENCE_BEAT_PHASE_QUICK_v1.0_20251108.md`
 - Security Fixes Reference: `docs/06-reference/K1NRef_REFERENCE_PHASE_A_SECURITY_FIXES_v1.0_20251108.md`
 - Concurrency Stress Tool: `tools/seqlock_stress.cpp` (build locally) → `stress.csv`
 - Metronome Fixture: `tools/metronome.py`, `tools/beat_phase_analyzer.py`
  - Validation Runner: `tools/run_phase_a_validation.sh` (builds stress tool, generates metronome, runs analyzer)

## Sign-off Template
```
Phase A Readiness Review – YYYY-MM-DD

Environment Control: PASS/FAIL (link)
Security Fixes: PASS/FAIL (PR links)
Telemetry Baseline Captured: PASS/FAIL (artifact links)
Canary Run: PASS/FAIL (log link)
Phase 0 Demo: PASS/FAIL (evidence)

Decision: GO / CONDITIONAL / NO-GO
Conditions (if any):
Signatories: Security Lead, Firmware Ops Captain, Reviewer
```

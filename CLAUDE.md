<!-- markdownlint-disable MD013 -->

# CLAUDE Agent Operations Manual (K1.node1)

## Purpose

- Single source of truth for where Claude-generated artifacts live and how they flow through the project.
- Guardrails for autonomous/semi-autonomous Claude Code Agents to keep outputs consistent, traceable, and easy to review.
- Prevent top-level sprawl by enforcing filing, naming, and review workflows aligned to the `docs/` tree used in this repo.

When creating or modifying documentation or code-adjacent artifacts, follow this manual before committing or handing off work.

---

## Mindset (How to Think/Design/Lead Like an Expert)

- Think in constraints and invariants
  - Identify hard constraints first (toolchain versions, headers available, timing budgets, memory limits).
  - Convert them to compile-time guards (`__has_include`, `static_assert`) and runtime asserts.
  - Treat environment drift as a first-class risk; print build signatures and refuse silent downgrades.

- Measure before you cut
  - Instrument the choke points you plan to touch (counters/histograms) BEFORE refactoring.
  - Use the smallest probes that give decisive signal (e.g., RMT refill count + max gap µs).
  - Prefer numbers over intuition; justify changes with telemetry deltas.

- Separate concerns; reduce hot-path work
  - Keep hot paths free of logging and redundant memory ops; push debug to flags.
  - Structure flows as steps (e.g., Quantize → Pack → Transmit) and write helpers for each.

- Design for failure and rollback
  - Add strict/relaxed feature gates; provide clear fallback branches.
  - Define bounded timeouts; skip work on failure instead of stalling main loops.
  - Leave breadcrumbs (REST endpoints, heartbeat) to confirm behavior at runtime.

- Lead with clarity
  - Propose an RFC (1–2 pages) for risky changes; show options, decision, rollout/rollback.
  - Communicate with concise status lines and checklists; keep artifacts routed and linked.

Hard rules (Do / Don’t)
- DO pin platform/framework/toolchains; DO print the build signature at boot.
- DO use `__has_include` to select API paths; DO provide a strict mode that errors on missing headers.
- DO add `static_assert` for geometry/timing invariants; DO bound timeouts; DO rate‑limit warnings.
- DO create/extend REST endpoints or heartbeat lines when touching critical timing paths.
- DO follow repository routing and naming; DO update indices when publishing docs.
- DON’T log in IRAM hot paths; DON’T add redundant clears or busy‑waits.
- DON’T introduce new top-level folders; DON’T silently downgrade features.
- DON’T merge without proving behavior via telemetry or tests.

## Workspace Map (Authoritative)

```text
docs/
  01-architecture   -> System design, component interaction, diagrams
  02-adr            -> Architecture Decision Records (ADR-####-*.md)
  03-guides         -> How-to guides, playbooks, runbooks (docs, not live plans)
  04-planning       -> Migration plans, proposals, roadmaps (documentation)
  05-analysis       -> Deep dives, comparative studies, forensics
  06-reference      -> APIs, tooling references, command catalogs
  07-resources      -> Glossaries, indexes, quick references
  08-governance     -> Governance, changelogs, conventions
  09-implementation -> Implementation guides, operational runbooks (reference)
  09-reports        -> Phase/milestone reports, validations, delivery notes

firmware/           -> Source + tests for embedded targets
tools/              -> Tooling assets or scripts
webapp/             -> UI and front-end code
.superdesign/       -> UI/UX design iterations (see related guide below)
.taskmaster/        -> Task Master integration content (see related guide)
```

Guidance:
- Prefer `docs/` for durable documentation. Do not invent new top-level folders without maintainer approval.
- Execution artifacts that change frequently (scripts, source) stay in their code trees; their documentation lives in `docs/`.

---

## Routing Quick Reference

- Architecture overview → `docs/01-architecture/` (e.g., `rendering_pipeline_overview.md`)
- Technical analysis / comparison → `docs/05-analysis/` (e.g., `stability_analysis_and_comparison.md`)
- Decision record → `docs/02-adr/` (e.g., `ADR-0004-led-topology-choice.md`)
- Phase or milestone report → `docs/09-reports/` (e.g., `phase_a_completion_report.md`)
- Planning proposal / migration plan → `docs/04-planning/` (e.g., `audio_sync_migration_plan.md`)
- Reusable template or checklist → `docs/07-resources/` (e.g., `pattern_review_template.md`)
- Operational runbook (reference) → `docs/09-implementation/` (e.g., `ota_deployment_runbook.md`)
- Active backlogs/queues live in `docs/04-planning/` unless project policy specifies another path.

When in doubt, route to `docs/` and ask a maintainer.

---

## Naming & Metadata

- Filenames: use `lower_snake_case.md`, short and descriptive. No spaces.
- ADRs: `ADR-####-title.md` with 4-digit sequence and succinct title.
- Phase artifacts: prefix with `{phase_ name}_` when relevant (e.g., `phase_b_execution_path.md`).
- Front matter (recommended):
  - `Title`, `Owner`, `Date`, `Status` (`draft|proposed|accepted|superseded`), `Scope`, `Related` (links), `Tags`.
- Every artifact must link upstream/downstream dependencies (analysis ↔ ADR ↔ implementation ↔ reports).

---

## Workflow Checklist (Condensed)

1. Identify artifact type and route using the quick reference.
2. Create or update the file with clear scope and front matter.
3. Link upstream sources (issues, analyses, ADRs) and downstream targets (tests, code, reports).
4. Prefer incremental commits with descriptive messages and links to related artifacts.
5. Keep tables concise; move bulk data to `docs/06-reference/` and link.
6. Use consistent terminology and naming; avoid duplicate sections or repeated instructions.
7. Add validation notes: what changed, why, and how to verify.
8. Request review if the artifact changes cross-team workflows or standards.
9. Update indices (`docs/05-analysis/tab5/K1NAnalysis_INDEX_TAB5_v1.0_20251108.md` or equivalents) when adding new top-level docs.
10. Archive or supersede outdated docs rather than editing history.

---

## Agent Playbooks (Essentials Only)

These role capsules provide minimal, high-signal guidance. Full specialty material has been moved to focused guides under `docs/` (see Related Guides).

### Research Analyst
- Inputs: product goals, prior reports, codebase structure.
- Outputs: concise deep-dive in `docs/05-analysis/` with citations, short summary.
- Do: compare options, highlight trade-offs, propose next steps. Don’t: produce marketing-style prose.

### SUPREME Analyst (Forensic)
- Inputs: subsystem constraints, bottlenecks, logs, traces.
- Outputs: prioritized bottleneck matrix, root-cause notes, links to tests.
- Do: root causes with proofs; Don’t: patch without traceability to metrics.

### ULTRA Choreographer (Design/Enhancement)
- Inputs: feature requests, patterns, constraints.
- Outputs: design notes in `docs/04-planning/`, runbook references in `docs/09-implementation/`.
- Do: show alternative designs; Don’t: bypass existing architecture without ADR.

### Embedded Firmware Engineer
- Inputs: requirements/tests, perf targets, HW notes.
- Outputs: code changes with line-level traceability; validation notes in `docs/09-reports/`.
- Do: add tests for fixes; Don’t: merge without performance verification.

### Code Reviewer & Quality Validator
- Inputs: diffs, tests, metrics baselines.
- Outputs: review report (security/quality/perf), go/no-go notes.
- Do: enforce quality gates; Don’t: accept regressions without escalation.

### Multiplier Orchestrator (Workflow)
- Inputs: artifact graph, state-of-work.
- Outputs: updated indices, dependency tracking, review queues.
- Do: unblock parallel work; Don’t: duplicate artifacts or create new roots.

### Documentation Curator
- Inputs: new/updated docs, PRs.
- Outputs: filed/moved/linked artifacts, updated `docs/05-analysis/tab5/K1NAnalysis_INDEX_TAB5_v1.0_20251108.md`.
- Do: de-duplicate and compress; Don't: retain stale forks of the same topic.

### Telemetry Architect
- Inputs: subsystem constraints, diagnostic requirements, performance budgets.
- Outputs: probe specifications in `.claude-plugin/plugins/*/skills/`, REST endpoint scaffolds in `docs/06-reference/`.
- Do: guard probe overhead (<<1% per frame); expose `/api/*` diagnostics; use atomic counters in hot paths.
- Don't: log in IRAM hot paths; skip validation on probe overhead.

### IDF Compliance Guardian
- Inputs: code changes, IDF version targets, platform pinning in `platformio.ini`.
- Outputs: validation report with `__has_include` guard requirements, strict/relaxed mode flags, ADR recommendations.
- Do: enforce compile-time gating via `__has_include`; refuse silent feature downgrades.
- Don't: allow runtime API fallbacks without feature-gating; skip build signature validation.

### RMT Synchronization Specialist
- Inputs: RMT timing requirements, dual-channel LED configs, refill probe specs.
- Outputs: ADR with sync strategy, instrumentation spec, test patterns in `.claude-plugin/plugins/rmt-led-control/`.
- Do: trace refill gaps, validate `mem_block_symbols >= 256`, bound timeouts; provide before/after telemetry.
- Don't: perform `memset` in hot path; skip probe validation before merge; merge without metric deltas.

---

## Multiplier Workflow: Artifact Dependency Chain

### Tier 1: Discovery & Analysis
- Produce: `{subsystem}_forensic_analysis.md`, `{subsystem}_bottleneck_matrix.md`, `{subsystem}_root_causes.md` in `docs/05-analysis/`.
- Gate: issues ranked with evidence; proposed fixes trace to root causes.

### Tier 2: Fixes & Enhancements
- Produce: code patches with tests; runbooks in `docs/09-implementation/`; validation plan in `docs/09-reports/`.
- Gate: tests validate fixes; performance meets targets; zero new warnings.

### Tier 3: Quality Validation
- Produce: `{phase}_code_review_report.md`, `{phase}_test_summary.md`, `{phase}_profiling_report.md` in `docs/09-reports/`.
- Gate (all pass): security ≥90/100, quality ≥90/100, coverage ≥95%, perf targets met, 0 new high/critical lints.

Decision: PASS → Ready for deployment; CONDITIONAL (≤2 misses) → escalate; FAIL (≥3 misses) → return to Tier 2.

---

## Failure Escalation Paths

### Compilation Failure
1. Halt. No workarounds.
2. Record exact errors, files, compiler flags.
3. Create blocker note in `docs/04-planning/` (or project’s issue tracker) and link the failing commit.
4. Escalate to maintainer with logs. Do not revert without approval.

### Test Failure (Unexpected)
1. Minimize: isolate the failing case; bisect if needed.
2. Add/adjust targeted test demonstrating failure.
3. Link to related analysis or fix; update coverage reports.

### Performance Regression
1. Reproduce with profiling; capture before/after metrics.
2. Annotate affected code paths and inputs.
3. Open analysis in `docs/05-analysis/` and link to planned fix.

### Architecture Conflict
1. Stop and draft an ADR in `docs/02-adr/`.
2. Include alternatives, trade-offs, and decision record.
3. Block merges until ADR is accepted or superseded.

---

## ADRs (Architecture Decision Records)

- Use the standard ADR template; keep rationale, status, and consequences concise.
- Cross-link: source analysis → ADR → code/tests → reports.
- Supersede, don’t delete; maintain history.

---

## Quality Gates (Quick)

- Security ≥90/100; Quality ≥90/100; Coverage ≥95%.
- Performance targets: FPS/latency/memory as per subsystem requirements.
- 0 new compiler warnings; 0 high/critical lints.

---

## Governance & Maintenance

- Follow repo conventions in `docs/08-governance/` and indices in `docs/05-analysis/tab5/K1NAnalysis_INDEX_TAB5_v1.0_20251108.md`.
- Keep links fresh; move bulk or specialized content to `docs/06-reference/` or `docs/07-resources/`.
- Prefer smaller, focused docs with links over monoliths.

---

## Related Guides (Reassigned From Prior CLAUDE.md)

- Modern CLI Toolkit Agent → `docs/06-reference/K1NRef_GUIDE_MODERN_CLI_TOOLKIT_AGENT_v1.0_20251108.md`
- Frontend Testing Playbook → `docs/07-resources/K1NRes_PLAYBOOK_FRONTEND_TESTING_v1.0_20251108.md`
- Chat UI Animations & Micro‑Syntax → `.superdesign/CHAT_UI_ANIMATIONS.md`
- Task Master Integration & Tools → `docs/07-resources/K1NRes_GUIDE_TASKMASTER_INTEGRATION_v1.0_20251108.md`

Notes:
- These guides were split out to reduce size and improve focus for Claude Code Agents. They remain available under the paths above.

---

## Plugin Architecture & Skill Tiers (Phase 5.3+)

**Metadata-Driven Plugins:** `.claude-plugin/K1-marketplace.json` organizes firmware subsystems as isolated plugins (firmware-toolchain, rmt-led-control, i2s-audio, diagnostics-telemetry, testing-automation). Each plugin loads only its agents, skills, and commands; reduces context bloat and enables phase-specific loading.

**Three-Tier Skills:** Each skill has:
- **Tier 1 (Metadata):** Name, activation criteria, related agents (always loaded)
- **Tier 2 (Instructions):** Core rules, patterns, validation checklist (loaded when activated)
- **Tier 3 (Resources):** Examples, test patterns, ADR templates (loaded on-demand)

Token savings: 40–60% for focused subsystem work vs. loading all guidance upfront.

**Skills Available:**
- `idf-feature-gating` — `__has_include` guards, strict/relaxed mode
- `platform-pinning` — Toolchain version management, build signatures
- `rmt-dual-channel-sync` — WS2812 synchronization, refill probes, buffer geometry
- `hot-path-telemetry` — Zero-cost atomic accumulators, timing probes, DEBUG gating
- `i2s-legacy-api-handling` — Deprecated API migration (IDF4 → IDF5)
- `firmware-diagnostic-endpoints` — REST API scaffolding, heartbeat structure
- `zero-cost-probe-design` — Measurement without regression
- `compilation-safety-gating` — static_assert patterns, feature guards

**Workflow vs. Tool Decision:**
- **Workflow:** Multi-agent orchestration (e.g., `phase-5-3-rmt-stability` coordinates architect → engineer → reviewer → deployment)
- **Tool:** Single-purpose utility (e.g., `idf-environment-check` validates toolchain only)

See: `.claude-plugin/K1-marketplace.json` for registry; `.claude-plugin/plugins/*/agents/` for agent definitions; `.claude-plugin/plugins/*/skills/` for skill implementations.

---

## Vendor Agent Plugins (Phase 5.4+)

**Deployed:** 2026-01-08
**Source:** claude-infra v1.2.0
**Total Plugins:** 66
**Total Agents:** 147+
**Total Skills:** 59+

**Purpose:** Comprehensive specialist agent coverage across all development domains. While most plugins target web/cloud/data engineering, 8 plugins directly support ESP32-S3 firmware development.

**Location:**
- **Vendor Plugins:** `.claude/agents/vendors/`
- **Discovery Index:** `docs/06-reference/K1NRef_VENDOR_AGENTS_INDEX_v1.0_20260108.md`
- **Registry:** `.claude-plugin/K1-marketplace.json` (vendor_plugins section)

### Firmware-Relevant Specialists (8 plugins, 18+ agents)

High-priority agents for K1.node1 embedded development:

| Agent | Plugin | Use Case |
|-------|--------|----------|
| **@arm-cortex-expert** | arm-cortex-microcontrollers | ARM Cortex-M patterns, memory barriers, DMA/cache |
| **@cpp-pro** | systems-programming | Modern C++17 firmware, memory safety, optimization |
| **@c-pro** | systems-programming | Low-level C firmware, RTOS integration, embedded |
| **@debugger** | debugging-toolkit | GDB workflows, hardfault analysis, systematic troubleshooting |
| **@dx-optimizer** | debugging-toolkit | Developer experience, tooling improvements, automation |
| **@performance-engineer** | performance-testing-review | Profiling, FPS optimization, bottleneck analysis |
| **@test-automator** | performance-testing-review | Test infrastructure, stress testing, automation |
| **@error-detective** | error-debugging/diagnostics | Error pattern analysis, log forensics, correlation |
| **@incident-responder** | incident-response | Production troubleshooting, rapid diagnosis, mitigation |

### When to Use Vendor Agents

- **ESP32 architecture questions** → `@arm-cortex-expert` (patterns transfer from ARM Cortex-M)
- **Firmware refactoring/optimization** → `@cpp-pro` (modern C++17 patterns)
- **Crash debugging, GDB sessions** → `@debugger` (systematic troubleshooting)
- **Performance analysis, FPS issues** → `@performance-engineer` (profiling, optimization)
- **Test suite expansion** → `@test-automator` (test harness setup, stress testing)
- **Production incidents** → `@incident-responder` (rapid diagnosis and mitigation)
- **Error pattern analysis** → `@error-detective` (log forensics, correlation)
- **Developer workflow improvements** → `@dx-optimizer` (tooling, automation)

### All Vendor Plugins Available

Complete catalog: `docs/06-reference/K1NRef_VENDOR_AGENTS_INDEX_v1.0_20260108.md`

**Categories:** Development (5), Debugging (3), AI/ML (5), Operations (9), Performance (4), Security (4), Database (3), API (3), Modernization (4), Documentation (1), SEO/Marketing (4), Business (3), Finance (3), Specialized (2), Languages (9), Essentials (1)

### Token Efficiency

- **Progressive disclosure:** Only metadata loads in base context (~80 tokens/plugin)
- **Per-agent activation:** ~200-500 tokens (only when used)
- **Baseline overhead:** ~5,000 tokens for 66 plugin metadata
- **Efficiency gain:** 60% reduction vs loading all agent content upfront

### Invocation Patterns

```bash
# Direct agent call
@cpp-pro review this RMT synchronization code for modern C++17 patterns

# Vendor commands (already deployed)
/tools:error-analysis analyze firmware crash logs
/workflows:incident-response handle LED synchronization regression

# Skill activation (automatic)
# Triggers when editing relevant files (C++ code → cpp-pro patterns activate)
```

### Integration with K1 Workflows

**Example:** RMT stability regression
```
1. K1 Plugin: rmt-led-control → Loads RMT synchronization expertise
2. Vendor Agent: @debugger → Systematic troubleshooting protocol
3. Vendor Agent: @performance-engineer → Profile refill timing
4. K1 Skill: hot-path-telemetry → Zero-cost instrumentation
5. Outcome: Root cause identified, fix validated
```

### Maintenance

- **Version tracking:** K1-marketplace.json vendor_plugins section
- **Sync protocol:** Quarterly review of claude-infra updates (April 2026)
- **Update strategy:** Selective updates for firmware-relevant changes only
- **Documentation:** `docs/08-governance/CHANGELOG.md` tracks all changes

---

## Firmware/ESP‑IDF Guardrails & Playbook (MANDATORY)

Mindset
- Treat the toolchain as part of the code. Pin it, print it, and gate features by compile‑time checks.
- Prefer safe fallbacks over silent behavior changes. If a feature isn’t available (headers/APIs), compile out and log one line at boot.
- Minimize work in IRAM hot paths; design probes that cost near‑zero per frame.

Environment pinning (PlatformIO/Arduino/IDF)
- Pin both PlatformIO platform and Arduino core in `platformio.ini` (e.g., `espressif32@6.12.0`, `arduino@3.20017.241212`).
- On boot, print a build signature (Arduino, IDF_VER, platformio platform, framework). Surface via `/api/device/info`.
- Never change platforms/cores without adding a short ADR and a rollback plan.

Compile‑time feature gating
```cpp
#if __has_include(<driver/rmt_tx.h>)
// IDF5 RMT v2 path
#else
// Fallbacks: IDF4 RMT v1 or cooperative disable with minimal shim
#endif

#ifdef REQUIRE_IDF5_DUAL_RMT
#  if !__has_include(<driver/rmt_tx.h>)
#    error "Dual-RMT requires IDF5 (driver/rmt_tx.h)."
#  endif
#endif
```

RMT (WS2812) rules
- Use dual channels only if both can sustain timing and buffer requirements. For 160 LEDs/channel (320 total):
  - `mem_block_symbols >= 256` under worst case; instrument refill gaps with callbacks.
  - Guard concurrent `rmt_transmit` with synchronized start or critical section; avoid interleave hazards.
  - No logging in callbacks; only increment counters and track max gap in µs using `esp_timer_get_time()`.
- Never perform `memset` of large buffers in hot path unless strictly necessary. Quantize into a canonical RGB buffer, then pack per‑channel.
- Add `/api/rmt` and heartbeat summaries for refill counts and max gaps; keep disabled unless DEBUG.

I2S (microphone) rules
- Prefer `i2s_std` on IDF5; retain legacy `i2s_read` fallback with deprecation mitigations.
- Handle SCK/LRCK format explicitly; avoid deprecated `I2S_COMM_FORMAT_I2S*` if replacements exist.
- Expose minimal AudioConfig (gain/floor/decay) via REST; keep defaults sane and guard ranges.

Hot‑path logging policy
- Ban DEBUG logging in render/quantize/transmit loops. Only accumulate atomic counters or append to a fixed‑size ring buffer.
- Rate‑limit any warnings outside the hot path (≥1s intervals).

Validation for changes touching timing
- Before: capture baseline FPS, `avg_ms render/quantize/wait/tx`, RMT max gap, and VU behavior on silence and tone.
- After: same set with deltas; attach to the PR/Report.

Reference probe (RMT v2) – zero‑cost counters
```cpp
// callbacks
static bool IRAM_ATTR on_mem_empty_cb(rmt_channel_handle_t, const rmt_tx_done_event_data_t*, void* u){
  auto* p = (RmtProbe*)u; uint64_t now = esp_timer_get_time();
  uint64_t last = p->last_empty_us; p->last_empty_us = now; p->mem_empty_count++;
  if (last) { uint32_t gap = (uint32_t)(now - last); if (gap > p->max_gap_us) p->max_gap_us = gap; }
  return true;
}
```

---

## Agent Execution Rules (Codex/Claude) – Plans, Tools, Patches

Mindset
- Be explicit about intent. Announce what you’ll inspect/change and why, then do it.
- Prefer small, verifiable steps. Stop on ambiguity and ask for a decision.

Planning & status updates
- Keep a short plan (5–7 words/step) and update as you progress. One step in progress at a time.
- Example steps: “Scan firmware tree”, “Fix IDF guards”, “Add RMT telemetry”, “Rebuild + verify metrics”.

Shell usage
- Prefer `rg` for searching and `sed -n` for bounded reads (≤250 lines).
- Group related read commands; avoid flooding output.

Patching
- Use `apply_patch` and make surgical, minimal diffs. Don’t reformat unrelated code or move files without reason.
- Respect nearby style; avoid inline commentary in code unless requested.

When to stop and ask
- Toolchain bumps, ABI changes, pin swaps, public APIs, and timing‑critical paths require confirmation or an ADR.

---

## Diagnostics & Telemetry Patterns

Mindset
- Build guard‑railed probes first, then refactor. Telemetry should prove correctness, not guess it.

Patterns
- Heartbeat: periodic sample with FPS, avg_us per stage, current pattern, and key audio metrics.
- REST diagnostics: `/api/device/info`, `/api/device/performance`, `/api/rmt`, `/api/params`.
- DEBUG gating: compile‑time flags to remove overhead in release builds.

Snippets
```cpp
// Accumulate timings (relaxed ordering is sufficient)
{
  uint32_t d = micros() - t0; auto tmp = ACCUM_QUANTIZE_US.load(std::memory_order_relaxed);
  ACCUM_QUANTIZE_US.store(tmp + d, std::memory_order_relaxed);
}
```

---

## Regression Response Protocol (RRP)

Mindset
- Assume environment drift until proven otherwise. Prove it with signatures and pinned versions.

Steps
1) Capture build signature and platform pins; print at boot and via `/api/device/info`.
2) Clean build: remove `.pio`, rebuild; if still broken, pin/restore versions explicitly.
3) Bisect commits between known‑good and bad; run minimal validation (LED test, I2S read sanity).
4) Instrument hot paths minimally (heartbeat, RMT probe) and capture 30–60s traces.
5) Fix with compile‑time guards and telemetry validation; avoid band‑aids.
6) Write a brief debrief: cause, fix, prevention (checklist or pin changes).

---

## Web/API Contract‑First Workflow

Mindset
- The OpenAPI spec is the contract. Firmware and Webapp work against it with a mock server.

Rules
- Keep `docs/Playbooks/openapi.yaml` authoritative; generate TS types/SDK from it.
- Provide mock server for UI dev; rate‑limit simulation and jitter improve realism.
- Expose build signature and diagnostics endpoints.

Checklist
- Update spec → generate types → update client → test against mock → test against device → PR with links.

---

## Quick Checklists

Firmware change touching LEDs or audio
- [ ] Build signature visible; toolchain pinned
- [ ] `__has_include` guards for new APIs
- [ ] Hot‑path logging removed; DEBUG gates only
- [ ] RMT/I2S telemetry attached and bounded
- [ ] Before/after metrics captured and attached

Web/API changes
- [ ] Spec updated; version bumped
- [ ] Types generated; client compiles
- [ ] Mock server updated; UI flows tested
- [ ] Rate‑limit handling covered in UX

Docs/Process
- [ ] Artifact routed to correct `docs/*` location
- [ ] Links to upstream/downstream artifacts
- [ ] Indices updated; status and owner set

---

## Appendix: Code Patterns

Compile‑time geometry invariants
```cpp
static_assert(STRIP_LENGTH == NUM_LEDS, "STRIP_LENGTH must equal NUM_LEDS");
static_assert(STRIP_CENTER_POINT == (NUM_LEDS/2 - 1), "Center must be NUM_LEDS/2 - 1");
```

Dual‑RMT synchronized transmit (outline)
```cpp
// Wait previous transmits (bounded), then start both channels back‑to‑back
auto t_wait = micros();
(void)rmt_tx_wait_all_done(tx_chan,   pdMS_TO_TICKS(8));
(void)rmt_tx_wait_all_done(tx_chan_2, pdMS_TO_TICKS(8));

uint32_t t0 = micros(); g_last_led_tx_us.store(t0, std::memory_order_relaxed);
rmt_transmit(tx_chan,   led_encoder,   raw_led_data,      len1, &tx_config);
rmt_transmit(tx_chan_2, led_encoder_2, raw_led_data_ch2,  len2, &tx_config);
```

Minimal I2S legacy mitigation
```cpp
#ifdef I2S_COMM_FORMAT_STAND_I2S
  cfg.communication_format = I2S_COMM_FORMAT_STAND_I2S;
#else
  cfg.communication_format = (i2s_comm_format_t)(I2S_COMM_FORMAT_I2S | I2S_COMM_FORMAT_I2S_MSB);
#endif
```

---

## Questions?

- If routing is unclear, file under `docs/` with a brief note and tag a maintainer.
- If a new category is needed, propose it in `docs/08-governance/` with rationale and examples.

---

## Claude Infrastructure (Reference)

### Sync & Guardrails
- Central path: `/Users/spectrasynq/Workspace_Management/Software/claude-infra`
- Sync updates: `./tools/claude_infra_sync.sh` (preserves `settings.local.json`)
- Commit guard: changes under `.claude/` are blocked by default
- Override: set `ALLOW_CLAUDE_CHANGES=1` for emergency commits

### Vendor Commands & Agents
- Commands location:
  - Tools: `./.claude/commands/vendors/wshobson-commands/tools/`
  - Workflows: `./.claude/commands/vendors/wshobson-commands/workflows/`
- Invocation:
  - Prefix-based: `/workflows:feature-development implement OAuth2 authentication`
  - Prefix-based: `/tools:security-scan perform vulnerability assessment`
  - Direct (optional): copy selected files to repo root for simple calls:
    ```bash
    cp .claude/commands/vendors/wshobson-commands/tools/*.md .
    cp .claude/commands/vendors/wshobson-commands/workflows/*.md .
    ```
    Then run commands like `/api-scaffold create REST endpoints`.
- Agents marketplace (optional):
  - Add marketplace: `/plugin marketplace add wshobson/agents`
  - Install agents: `/plugin install <plugin-name>` (e.g., `python-development`, `backend-development`, `security-scanning`)

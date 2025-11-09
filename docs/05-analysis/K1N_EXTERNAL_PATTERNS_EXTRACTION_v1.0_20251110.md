# K1.node1: Complete Pattern Extraction from wshobson/agents & wshobson/commands

**Raw extraction of ALL applicable patterns from external orchestration repos.**

---

## PART 1: PLUGIN ARCHITECTURE PATTERNS

### Pattern 1A: Granular Plugin Structure (64 plugins, 87 agents, 47 skills)

**wshobson structure:**
```
63 plugins across 23 categories, avg 3.4 components/plugin
Metadata-driven (marketplace.json) enables dynamic loading
Example: python-development = 3 agents + 1 command + 5 skills = ~300 tokens
```

**Applicable to K1.node1:**
- firmware-validation plugin (IDF guards, build signatures)
- rmt-led-control plugin (WS2812 dual-channel sync, probes)
- i2s-audio plugin (microphone config, deprecated API handling)
- diagnostics-telemetry plugin (REST endpoints, heartbeat)
- testing-automation plugin (unit + integration, CI/CD gating)
- firmware-toolchain plugin (platform pinning, version gating)

**Benefits:**
- Load only subsystem-specific agents (firmware-validation for Phase 5.3, testing for Phase 5.4)
- Token savings: 40–60% for focused work
- Clear subsystem boundaries
- Reusable across phases

---

### Pattern 1B: Plugin Registry via marketplace.json

**Structure:**
```json
{
  "plugins": [
    {
      "name": "firmware-validation",
      "source": "./plugins/firmware-validation",
      "description": "Compilation safety, IDF guards, runtime telemetry",
      "version": "1.0.0",
      "agents": ["./agents/firmware-validator.md", "..."],
      "skills": ["./skills/idf-feature-gating.md", "..."],
      "commands": ["./commands/compilation-gate.md"],
      "tests": ["./tests/compilation_safety.md"]
    }
  ]
}
```

**K1.node1 implementation:**
- Create `.claude-plugin/K1-marketplace.json` with all firmware subsystems
- Enable phase-based plugin loading (Phase 5.3 loads firmware plugins, Phase 5.4 loads testing)
- Track versions, dependencies, test coverage per plugin

---

### Pattern 1C: Three-Tier Skill Architecture

**Tier 1 (Metadata - always loaded):**
```markdown
skill: rmt-dual-channel-synchronization
activation: "when touching RMT v2 dual-channel transmit, >160 LEDs/channel"
agents: ["rmt-specialist", "firmware-validator"]
related: ["idf-feature-gating", "hot-path-telemetry"]
tokens: ~50
```

**Tier 2 (Instructions - loaded when activated):**
```
Guard concurrent rmt_transmit with synchronized start or critical section.
Instrument refill gaps: esp_timer_get_time() in callbacks (IRAM only).
Validate mem_block_symbols >= 256 under worst case.
Never memset large buffers in hot path; quantize to canonical RGB buffer.
Bound timeouts: pdMS_TO_TICKS(8) max wait before skip.
Expose /api/rmt diagnostics (refill count, max gap µs) — DEBUG only.

Prevention: Add unit tests for sync behavior; trace refill gaps before merge.
Risks: Interleave hazards, clock drift if quantization skips frames.
```

**Tier 3 (Resources - on-demand):**
- Reference probe code (RmtProbe struct, callbacks, accumulator patterns)
- Before/after telemetry traces (30s baseline, FPS + gap µs deltas)
- Failing test patterns for sync bugs
- Rollback procedure ADR template

**K1.node1 skills to create (Tier 1+2):**
- `rmt-dual-channel-synchronization`
- `idf-feature-gating` (\_\_has_include patterns, strict/relaxed mode)
- `hot-path-telemetry` (zero-cost probes, atomic accumulators, DEBUG gating)
- `i2s-legacy-api-handling` (deprecated I2S_COMM_FORMAT mitigation)
- `compilation-safety-gating` (static_assert, __has_include guards)
- `firmware-diagnostic-endpoints` (REST probe patterns, heartbeat structure)

---

## PART 2: WORKFLOW & COMMAND ORCHESTRATION PATTERNS

### Pattern 2A: Workflow vs. Tool Decision Matrix

**Workflows (multi-agent, cross-domain):**
- feature-development (backend + frontend + testing + deployment)
- full-review (architecture + security + performance + quality)
- smart-fix (dynamic agent selection based on issue type)
- tdd-cycle (test writer → implementer → refactoring specialist)
- full-stack-feature (multi-tier implementation)
- security-hardening (threat modeling + vulnerability assessment + remediation)
- incident-response (diagnostics → root cause → hotfix → deployment)
- performance-optimization (profiling + caching + query opt + load testing)
- legacy-modernize (architecture migration + dependency updates + pattern refactoring)

**Tools (single-purpose, focused):**
- api-scaffold (REST/GraphQL endpoint generation only)
- docker-optimize (multi-stage builds, layer caching)
- k8s-manifest (Kubernetes config generation)
- deploy-checklist (pre-flight checks, rollback, monitoring setup)
- security-scan (SAST, dependency scanning, OWASP Top 10)
- code-migrate (framework upgrades, language porting)
- error-analysis (root cause analysis, frequency patterns)
- data-pipeline (ETL/ELT architecture)
- compliance-check (GDPR, HIPAA, SOC2, PCI-DSS)

**Decision criteria:**
| Attribute | Workflow | Tool |
|-----------|----------|------|
| Complexity | Multi-domain, cross-cutting | Single domain, focused |
| Clarity | Exploratory, undefined approach | Clear implementation path |
| Agents | Multiple specialists (3–7) | Single expertise (1–2) |
| Control | Automated orchestration | Manual, step-by-step |
| Duration | Long-running (hours) | Quick (minutes) |

**K1.node1 workflows:**
- `phase-5-3-rmt-stability` (firmware-architect design → engineer impl → reviewer validate → deployment)
- `phase-5-4-integration-testing` (test-generator → integration-runner → perf-analyzer → reporting)
- `incident-response-firmware` (diagnostics-collector → root-cause → hotfix-engineer → validation)
- `full-firmware-validation` (compilation check → unit tests → integration → security scan → perf baseline → report)

**K1.node1 tools:**
- `idf-environment-check` (validate toolchain pins, print build signature)
- `rmt-probe-inject` (add zero-cost telemetry to RMT callbacks)
- `compilation-gate` (enforce strict/relaxed mode compilation)
- `metric-baseline-capture` (record before/after FPS, µs per stage, RMT gaps)
- `api-endpoint-scaffold` (create /api/rmt, /api/device/info endpoints)

---

### Pattern 2B: Multi-Agent Orchestration Commands

**From wshobson/commands:**
- `feature-development` — Backend, frontend, testing, deployment agents
- `full-review` — Architecture, security, performance, quality agents
- `smart-fix` — Dynamic agent routing based on issue fingerprint
- `tdd-cycle` — Test writer → Implementer → Refactoring specialist
- `legacy-modernize` — Architect → Engineer → QA → Performance tuner
- `security-hardening` — Threat modeler → Vulnerability scanner → Remediation engineer
- `performance-optimization` — Profiler → Optimizer → Load tester → Validator
- `incident-response` — Diagnostics collector → Root-cause analyzer → Hotfix engineer → Deployment validator

**K1.node1 adaptations:**

*Phase 5.3 (RMT Stability):*
```
/phase-5-3-rmt-stability

1. [Sonnet] Firmware Architect: Analyze baseline metrics, propose dual-channel sync ADR
2. [Haiku] Embedded Engineer: Implement minimal change, add probes, gen tests
3. [Sonnet] Code Reviewer: Validate impl against ADR, check metric deltas
4. [Haiku] Test Automator: Run CI/CD, push artifacts
5. [Sonnet] SUPREME Analyst: Compare before/after telemetry, sign off
```

*Phase 5.4 (Integration Testing):*
```
/phase-5-4-integration-testing

1. [Haiku] Test Generator: Create 1,650 E2E + 1,950 load tests
2. [Haiku] Integration Runner: Execute test suites in parallel
3. [Sonnet] Performance Analyzer: Identify bottlenecks from traces
4. [Haiku] Report Generator: Produce phase summary
5. [Sonnet] Quality Guardian: Gate against quality metrics (>95% coverage, latency <X ms)
```

---

## PART 3: AGENT SPECIALIZATION & ROLE PATTERNS

### Pattern 3A: Specialized Agent Roles (87 agents across categories)

**wshobson categories:**
- **Development:** backend-architect, frontend-developer, full-stack-engineer
- **Quality:** code-reviewer, test-automator, performance-engineer
- **Infrastructure:** deployment-engineer, kubernetes-architect, cloud-architect
- **Operations:** incident-responder, diagnostics-engineer, observability-engineer
- **AI/ML:** ai-engineer, prompt-engineer, mlops-engineer
- **Security:** security-auditor, compliance-validator, penetration-tester
- **Data:** data-engineer, analytics-engineer, database-architect

**K1.node1 existing roles (from CLAUDE.md):**
- Research Analyst ✓
- SUPREME Analyst (Forensic) ✓
- ULTRA Choreographer (Design) ✓
- Embedded Firmware Engineer ✓
- Code Reviewer & Quality Validator ✓
- Multiplier Orchestrator (Workflow) ✓
- Documentation Curator ✓

**K1.node1 roles to ADD:**
- **Telemetry Architect** — Designs probe patterns, guards overhead budgets, creates diagnostic endpoints
- **IDF Compliance Guardian** — Enforces feature-gating, version pinning, compile-time safety
- **RMT Synchronization Specialist** — Expert on dual-channel timing, refill gaps, memory management
- **Audio/I2S Specialist** — Microphone config, deprecated API handling, legacy migration paths
- **Hardware Validator** — Device telemetry verification, before/after metric collection
- **Security Scanner** — SAST analysis, CVE scanning, supply chain validation

---

### Pattern 3B: Minimal Role Capsules + External Guides

**wshobson pattern:**
```markdown
Agent playbook (brief, high-signal):
- Research Analyst: inputs/outputs/do/don't (50 words max)
- Specialized guidance moved to docs/reference/

External guides:
- Modern CLI Toolkit Agent → docs/reference/...
- Frontend Testing Playbook → docs/resources/...
- Task Master Integration → docs/resources/...
```

**K1.node1 expansion (add to CLAUDE.md):**

```markdown
### Telemetry Architect
- Inputs: subsystem constraints, diagnostic requirements
- Outputs: probe specifications in docs/07-resources/, REST endpoint scaffolds
- Do: guard probe overhead (<<1% per frame), expose /api/* diagnostics
- Don't: log in IRAM hot paths; use DEBUG gates for verbosity

### IDF Compliance Guardian
- Inputs: code changes, IDF version targets
- Outputs: validation report with __has_include guards, strict/relaxed mode flags
- Do: enforce compile-time gating; refuse silent downgrades
- Don't: allow runtime API fallbacks without feature-gating

### RMT Synchronization Specialist
- Inputs: RMT timing requirements, dual-channel configs
- Outputs: ADR with sync strategy, instrumentation spec, test patterns
- Do: trace refill gaps, validate mem_block_symbols >= 256, bound timeouts
- Don't: perform memset in hot path; skip probe validation before merge
```

**External guides to create:**
- `docs/07-resources/K1NRes_SKILL_RMT_DUAL_CHANNEL_v1.0_[date].md`
- `docs/07-resources/K1NRes_SKILL_IDF_FEATURE_GATING_v1.0_[date].md`
- `docs/07-resources/K1NRes_SKILL_HOT_PATH_TELEMETRY_v1.0_[date].md`
- `docs/06-reference/K1NRef_GUIDE_FIRMWARE_DIAGNOSTICS_v1.0_[date].md`

---

## PART 4: HYBRID MODEL ORCHESTRATION (HAIKU/SONNET PAIRING)

### Pattern 4A: Strategic Model Assignment

**wshobson:**
```
47 Haiku agents — fast, deterministic tasks (code gen, scaffolding, execution)
38 Sonnet agents — complex reasoning (architecture, security, analysis)

Cost profile: ~10% higher than all-Haiku; quality near-Sonnet
Orchestration: Sonnet (plan) → Haiku (execute) → Sonnet (review)
```

**K1.node1 Phase 5.3+ model assignment:**

**Sonnet agents (high-value reasoning):**
- Firmware Architect (ADR decisions, IDF gating strategy, timing analysis)
- SUPREME Analyst (forensic bottleneck analysis, profiling)
- Code Reviewer (security/quality gates, metric validation)
- Security Auditor (CVE/SAST analysis, compliance)

**Haiku agents (execution, scaffolding):**
- Embedded Firmware Engineer (code changes, test writing, probe injection)
- Test Automator (test suite generation, CI/CD execution)
- Telemetry Probe Generator (diagnostics endpoint scaffolding)
- Validation Harness Builder (unit test generation, assertion patterns)

**Example Phase 5.3 execution flow:**
```
1. Sonnet (Firmware Architect) — 5 min
   Inputs: RMT baseline metrics, LED counts, timing budget
   Outputs: ADR with dual-channel sync strategy, probing plan

2. Haiku (Embedded Engineer) — 30 min
   Inputs: ADR, probe spec
   Outputs: Minimal code change, RmtProbe struct, test stubs

3. Haiku (Test Automator) — 15 min
   Inputs: Probe spec, test patterns
   Outputs: Unit tests, integration test scaffolds

4. Sonnet (Code Reviewer) — 10 min
   Inputs: Code diff, test results, before/after metrics
   Outputs: Go/no-go decision, ADR sign-off

5. Haiku (Deployment) — 5 min
   Inputs: Validated code, tests
   Outputs: Merged PR, deployment readiness
```

**Estimated cost/quality:**
- All-Sonnet: $2.50 + 2 hours
- Hybrid (Sonnet planning/review, Haiku execution): $1.75 + 1 hour (30% savings, near-Sonnet quality)

---

### Pattern 4B: Model Routing Rules

**When to use Sonnet:**
- Architecture decisions (ADR writing, design rationale)
- Security/compliance analysis (threat modeling, CVE triage)
- Performance analysis (profiling interpretation, bottleneck diagnosis)
- Quality validation (metric delta interpretation, regression detection)
- Forensic debugging (root cause analysis for production issues)

**When to use Haiku:**
- Code scaffolding (boilerplate, API endpoints, test templates)
- Deterministic transformations (refactoring, migration, formatting)
- Execution (running tests, compiling, building)
- Probe injection (adding telemetry, guards, assertions)
- Report generation (test summaries, metric tables, artifact publishing)

---

## PART 5: COMMAND STRUCTURE PATTERNS FROM wshobson/commands

### Pattern 5A: All Workflow Commands (15 total)

**Core Development:**
1. `feature-development` — End-to-end feature (backend + frontend + testing + deployment)
2. `full-review` — Multi-perspective analysis (arch + sec + perf + quality)
3. `smart-fix` — Dynamic problem resolution (issue fingerprinting → agent routing)
4. `tdd-cycle` — Test-driven development (RED → GREEN → REFACTOR)

**Process Automation:**
5. `git-workflow` — Version control automation (branching, commit standards, PR templates)
6. `improve-agent` — Agent optimization (prompt engineering, performance tuning)
7. `legacy-modernize` — Codebase modernization (arch migration, deps, patterns)
8. `multi-platform` — Cross-platform development (web + mobile + desktop)
9. `workflow-automate` — CI/CD automation (build → test → deploy → monitor)

**Advanced Orchestration:**
10. `full-stack-feature` — Multi-tier feature (backend API + frontend UI + mobile + database)
11. `security-hardening` — Security-first development (threat modeling + vuln assessment + remediation)
12. `data-driven-feature` — ML-powered features (data science + feature eng + model deployment)
13. `performance-optimization` — System-wide optimization (profiling + caching + query opt + load test)
14. `incident-response` — Production issues (diagnostics + root cause + hotfix + deployment)
15. `compliance-audit` — Regulatory validation (GDPR + HIPAA + SOC2 + PCI-DSS)

**K1.node1 adaptations:**
- Replace "feature-development" with "phase-5-3-rmt-stability" (firmware-centric)
- Replace "full-stack-feature" with "full-firmware-validation" (hardware validation)
- Replace "incident-response" with "incident-response-firmware" (device-specific diagnostics)
- Add "phase-orchestration" (meta-workflow for multi-phase execution)

---

### Pattern 5B: All Tool Commands (42 total)

**AI/ML (4):**
- `ai-assistant` — LLM integration, conversation management
- `ai-review` — ML code review, model validation
- `langchain-agent` — LangChain creation, RAG patterns
- `prompt-optimize` — Prompt engineering, cost optimization

**Agent Collaboration (3):**
- `multi-agent-review` — Multi-perspective code reviews
- `multi-agent-optimize` — Coordinated performance tuning
- `smart-debug` — Assisted debugging with performance analysis

**Architecture & Quality (4):**
- `code-explain` — Code documentation, AST analysis
- `code-migrate` — Migration automation, framework upgrades
- `refactor-clean` — Code cleanup, pattern detection
- `tech-debt` — Debt assessment, complexity analysis

**Data & Database (3):**
- `data-pipeline` — ETL/ELT architecture
- `data-validation` — Data quality, schema validation
- `db-migrate` — Database migrations, zero-downtime

**DevOps & Infrastructure (5):**
- `deploy-checklist` — Pre-flight checks, rollback
- `docker-optimize` — Container optimization
- `k8s-manifest` — Kubernetes configuration
- `monitor-setup` — Observability setup
- `slo-implement` — SLO/SLI definition

**Testing (6):**
- `api-mock` — Mock server generation
- `api-scaffold` — API endpoint creation
- `test-harness` — Test suite generation
- `tdd-red` — Failing test creation
- `tdd-green` — Implementation to pass tests
- `tdd-refactor` — Optimization with tests passing

**Security (3):**
- `accessibility-audit` — WCAG compliance
- `compliance-check` — Regulatory compliance
- `security-scan` — Vulnerability assessment

**Debugging (4):**
- `debug-trace` — Runtime analysis
- `error-analysis` — Error patterns
- `error-trace` — Production debugging
- `issue` — Issue tracking

**Dependency & Config (3):**
- `config-validate` — Configuration management
- `deps-audit` — Dependency analysis
- `deps-upgrade` — Version management

**Documentation & Collaboration (3):**
- `doc-generate` — API documentation
- `pr-enhance` — PR optimization
- `standup-notes` — Status reporting

**Operations & Context (4):**
- `cost-optimize` — Resource optimization
- `onboard` — Environment setup
- `context-save` — State persistence
- `context-restore` — State recovery

**K1.node1 tool set (subset):**
```
Firmware-specific tools:
- idf-environment-check
- rmt-probe-inject
- compilation-gate
- metric-baseline-capture
- api-endpoint-scaffold
- firmware-test-harness
- security-scan (SAST on firmware)
- compliance-check (hardware safety)
- error-trace-firmware
- context-save-phase (save phase state)
```

---

## PART 6: COMMAND COMPOSITION STRATEGIES

### Strategy 1: Sequential Execution Pipeline

```
Feature implementation pipeline:
1. /feature-development "real-time notifications with WebSockets"
2. /security-scan "WebSocket implementation vulnerabilities"
3. /performance-optimization "WebSocket connection handling"
4. /deploy-checklist "notification service deployment"
5. /k8s-manifest "WebSocket service with session affinity"
```

**K1.node1 adaptation:**
```
Full firmware validation pipeline:
1. /idf-environment-check
2. /tdd-red "RMT dual-channel sync test"
3. /tdd-green "RMT sync implementation"
4. /tdd-refactor "optimize sync probe overhead"
5. /compilation-gate "enforce strict mode"
6. /metric-baseline-capture "capture FPS, RMT gaps"
7. /security-scan "firmware CVE/SAST"
8. /full-firmware-validation "end-to-end sign-off"
```

---

### Strategy 2: Modernization Pipeline

```
Legacy system upgrade:
1. /legacy-modernize "migrate monolith to microservices"
2. /deps-audit "check dependency vulnerabilities"
3. /deps-upgrade "update to latest stable"
4. /refactor-clean "remove deprecated patterns"
5. /test-harness "generate comprehensive coverage"
6. /docker-optimize "create optimized images"
7. /k8s-manifest "deploy with rolling updates"
```

**K1.node1 adaptation (firmware version migration):**
```
IDF version upgrade:
1. /legacy-modernize "migrate from IDF4 RMT v1 to IDF5 RMT v2"
2. /compilation-gate "enforce IDF5 strict mode"
3. /refactor-clean "remove I2S_COMM_FORMAT deprecated patterns"
4. /test-harness "generate migration tests"
5. /security-scan "validate new APIs, CVE compliance"
6. /metric-baseline-capture "capture before/after perf"
7. /full-firmware-validation "validate migration success"
```

---

## PART 7: METADATA-DRIVEN PLUGIN REGISTRY STRUCTURE

### K1.node1 marketplace.json Template

```json
{
  "name": "K1.node1-firmware-plugins",
  "owner": {
    "name": "K1.node1 Project",
    "email": "contact@k1.dev",
    "url": "https://github.com/yourorg/K1.node1"
  },
  "metadata": {
    "description": "Firmware validation, RMT/I2S control, testing automation, diagnostics",
    "version": "1.0.0"
  },
  "plugins": [
    {
      "name": "firmware-toolchain",
      "source": "./plugins/firmware-toolchain",
      "description": "IDF environment validation, platform pinning, build signatures, strict/relaxed mode",
      "version": "1.0.0",
      "phase": "5.3",
      "agents": [
        "./plugins/firmware-toolchain/agents/firmware-validator.md",
        "./plugins/firmware-toolchain/agents/idf-expert.md"
      ],
      "skills": [
        "./plugins/firmware-toolchain/skills/idf-feature-gating.md",
        "./plugins/firmware-toolchain/skills/platform-pinning.md",
        "./plugins/firmware-toolchain/skills/build-signature-validation.md"
      ],
      "commands": [
        "./plugins/firmware-toolchain/commands/idf-environment-check.md"
      ]
    },
    {
      "name": "rmt-led-control",
      "source": "./plugins/rmt-led-control",
      "description": "WS2812 dual-channel orchestration, synchronization, refill probes, performance validation",
      "version": "1.0.0",
      "phase": "5.3",
      "agents": [
        "./plugins/rmt-led-control/agents/rmt-specialist.md",
        "./plugins/rmt-led-control/agents/led-engineer.md"
      ],
      "skills": [
        "./plugins/rmt-led-control/skills/rmt-dual-channel-sync.md",
        "./plugins/rmt-led-control/skills/hot-path-telemetry.md",
        "./plugins/rmt-led-control/skills/refill-probe-patterns.md"
      ],
      "commands": [
        "./plugins/rmt-led-control/commands/rmt-probe-inject.md"
      ],
      "tests": [
        "./plugins/rmt-led-control/tests/sync_behavior_unit.md",
        "./plugins/rmt-led-control/tests/refill_probe_overhead.md",
        "./plugins/rmt-led-control/tests/dual_channel_timing.md"
      ]
    },
    {
      "name": "i2s-audio",
      "source": "./plugins/i2s-audio",
      "description": "Microphone input, audio processing, deprecated API handling, legacy migration",
      "version": "1.0.0",
      "phase": "5.3",
      "agents": [
        "./plugins/i2s-audio/agents/audio-engineer.md",
        "./plugins/i2s-audio/agents/i2s-specialist.md"
      ],
      "skills": [
        "./plugins/i2s-audio/skills/i2s-legacy-api-handling.md",
        "./plugins/i2s-audio/skills/audio-buffer-management.md"
      ]
    },
    {
      "name": "diagnostics-telemetry",
      "source": "./plugins/diagnostics-telemetry",
      "description": "REST diagnostic endpoints, heartbeat, trace collection, performance monitoring",
      "version": "1.0.0",
      "phase": "5.3+",
      "agents": [
        "./plugins/diagnostics-telemetry/agents/telemetry-architect.md",
        "./plugins/diagnostics-telemetry/agents/diagnostics-engineer.md"
      ],
      "skills": [
        "./plugins/diagnostics-telemetry/skills/firmware-diagnostic-endpoints.md",
        "./plugins/diagnostics-telemetry/skills/zero-cost-probe-design.md",
        "./plugins/diagnostics-telemetry/skills/heartbeat-structure.md"
      ],
      "commands": [
        "./plugins/diagnostics-telemetry/commands/api-endpoint-scaffold.md",
        "./plugins/diagnostics-telemetry/commands/metric-baseline-capture.md"
      ]
    },
    {
      "name": "testing-automation",
      "source": "./plugins/testing-automation",
      "description": "Unit testing, integration testing, E2E testing, CI/CD pipeline validation, performance testing",
      "version": "1.0.0",
      "phase": "5.4",
      "agents": [
        "./plugins/testing-automation/agents/test-automator.md",
        "./plugins/testing-automation/agents/quality-guardian.md"
      ],
      "skills": [
        "./plugins/testing-automation/skills/firmware-test-harness.md",
        "./plugins/testing-automation/skills/integration-test-patterns.md",
        "./plugins/testing-automation/skills/test-driven-development.md"
      ],
      "commands": [
        "./plugins/testing-automation/commands/test-harness.md",
        "./plugins/testing-automation/commands/tdd-red.md",
        "./plugins/testing-automation/commands/tdd-green.md"
      ]
    }
  ]
}
```

---

## PART 8: IMPLEMENTATION ROADMAP

### Phase 5.3 (Next 2 weeks)

**Week 1:**
- [ ] Create `docs/07-resources/K1NRes_SKILL_RMT_DUAL_CHANNEL_v1.0_[date].md` (three-tier)
- [ ] Create `docs/07-resources/K1NRes_SKILL_IDF_FEATURE_GATING_v1.0_[date].md` (three-tier)
- [ ] Create `docs/07-resources/K1NRes_SKILL_HOT_PATH_TELEMETRY_v1.0_[date].md` (three-tier)
- [ ] Draft `.claude-plugin/K1-marketplace.json` with 5 plugins

**Week 2:**
- [ ] Implement firmware-toolchain plugin (agents + commands)
- [ ] Implement rmt-led-control plugin (agents + skills + tests)
- [ ] Test plugin loading in phase orchestration workflow
- [ ] Link skills to plugins; validate token reduction

### Phase 5.4 (Weeks 3–4)

- [ ] Update CLAUDE.md with new role capsules (Telemetry Architect, IDF Compliance Guardian, RMT Specialist)
- [ ] Create `docs/06-reference/K1NRef_GUIDE_FIRMWARE_DIAGNOSTICS_v1.0_[date].md` (extended skill Tier 3)
- [ ] Implement testing-automation plugin (agents + commands)
- [ ] Implement hybrid Haiku/Sonnet orchestration in Phase 5.4 workflows
- [ ] Create workflow vs. tool decision matrix for K1 commands

### Post-Phase 5.4

- [ ] Roll out plugin architecture to production K1 workflows
- [ ] Measure token usage reduction (target: 40–60%)
- [ ] Measure cost savings (target: 30–40% for execution-heavy phases)
- [ ] Document lessons learned in `docs/09-reports/phase_5_plugin_orchestration_report.md`

---

## PART 9: TOKEN & COST IMPACT ESTIMATES

### Current Baseline (No Plugins/Skills)
- All agents, CLAUDE.md guidance loaded always
- Estimated context: 150–200KB per invocation
- Cost per phase: $3.00–4.00 (Sonnet)

### With Progressive Disclosure Skills (Tier 1 + 2 only)
- Metadata + instructions; resources on-demand
- Estimated context: 100–120KB per invocation
- Savings: 30–40% tokens
- Cost per phase: $2.00–2.50 (Sonnet)

### With Plugin Granularity (Phase-specific loading)
- Load firmware-toolchain + rmt-led-control only for Phase 5.3
- Load testing-automation only for Phase 5.4
- Estimated context: 60–80KB per invocation
- Savings: 50–60% tokens
- Cost per phase: $1.50–2.00 (Sonnet + Haiku hybrid)

### With Hybrid Model (Sonnet planning/review, Haiku execution)
- Sonnet: 20 min (planning, review, validation)
- Haiku: 40 min (execution, testing, scaffolding)
- Estimated cost: $1.00–1.50 per phase
- Savings: 60–70% cost vs. all-Sonnet
- Quality: Near-Sonnet (planning & review gates maintain standards)

---

## PART 10: QUICK REFERENCE — ALL APPLICABLE PATTERNS

| Pattern | Type | Applicability | Priority | Effort | Token Savings | Cost Savings |
|---------|------|---------------|----------|--------|---------------|--------------|
| 1A: Plugin Granularity | Architecture | ⭐⭐⭐⭐⭐ | HIGH | 4–6h/plugin | 40–60% | — |
| 1B: Plugin Registry (marketplace.json) | Metadata | ⭐⭐⭐⭐ | HIGH | 2–3h setup | clarity | — |
| 1C: Three-Tier Skills | Knowledge | ⭐⭐⭐⭐⭐ | HIGH | 4–6h/skill | 30–40% | — |
| 2A: Workflow vs. Tool Matrix | Organization | ⭐⭐⭐⭐ | MEDIUM | 1–2h | — | clarity |
| 2B: Multi-Agent Orchestration | Execution | ⭐⭐⭐⭐⭐ | HIGH | 3–5h/workflow | — | — |
| 3A: Specialized Agent Roles | Design | ⭐⭐⭐⭐ | MEDIUM | 1–2h per role | — | — |
| 3B: Minimal Capsules + Guides | Documentation | ⭐⭐⭐⭐ | MEDIUM | 2–3h | — | clarity |
| 4A: Haiku/Sonnet Hybrid | Economics | ⭐⭐⭐⭐ | MEDIUM | 2–3h setup | — | 30–40% |
| 4B: Model Routing Rules | Execution | ⭐⭐⭐⭐ | MEDIUM | 1–2h | — | 30–40% |
| 5A: Workflow Commands (15) | Execution | ⭐⭐⭐⭐⭐ | HIGH | 2–4h per workflow | — | — |
| 5B: Tool Commands (42 subset) | Execution | ⭐⭐⭐⭐ | HIGH | 1–2h per tool | — | — |
| 6A: Sequential Pipeline | Composition | ⭐⭐⭐⭐ | MEDIUM | 1–2h per pipeline | — | — |
| 7: Plugin Registry (K1 manifest) | Metadata | ⭐⭐⭐⭐⭐ | HIGH | 3–4h init | versioning | — |

---

**END OF EXTRACTION**

*All patterns extracted from https://github.com/wshobson/agents and https://github.com/wshobson/commands*

*Ready for immediate implementation in K1.node1 Phase 5.3–5.4*

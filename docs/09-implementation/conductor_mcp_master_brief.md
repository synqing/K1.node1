# K1.node1 — Conductor.build MCP Integration Brief

**Status**: Proposed
**Owner**: Claude
**Date**: 2025-11-08
**Scope**: Multi-agent workspace orchestration for firmware + webapp development
**Related**: [Conductor Integration Technical Analysis](../05-analysis/conductor_integration_technical_analysis.md)

---

## Purpose

Establish a Conductor.build-based multi-agent workspace system for K1.node1 that:

1. **Isolates each agent's work** in a Git worktree + branch with reserved port ranges
2. **Orchestrates firmware + webapp workflows uniformly** (compile, validate, deploy, test)
3. **Coordinates real-time OTA updates** to device at `192.168.1.104`
4. **Integrates external tools** (GitHub, Linear/Jira, Sentry) via MCP with least-privilege scopes
5. **Enables parallel agent execution** with diff-first code review and PR creation

---

## K1.node1 Project Scope

| Component | Path | Tools | Key Constraint |
|-----------|------|-------|-----------------|
| **Firmware** | `firmware/` | PlatformIO, C++ (ESP32-S3) | USB/OTA serial port (device at 192.168.1.104) |
| **Webapp** | `webapp/` | React/TypeScript, Vite, Node ≥20 | Port allocation (Conductor assigns range per workspace) |
| **Automation** | `ops/` | Bash scripts, `.github/workflows` | Path-aware, separated per domain |
| **Documentation** | `docs/` | Markdown, following CLAUDE.md structure | Linked, indexed, versioned |

---

## Conductor Execution Model

Conductor creates an **isolated workspace** (Git worktree) for each agent task:

```
┌─────────────────────────────────────────────────────────┐
│ Conductor UI (Agent Coordinator)                        │
├─────────────────────────────────────────────────────────┤
│  • Workspace 1 (Agent-Firmware-Build)    [Port 3000-3009] │
│    ├─ setup → install PIO, npm deps                       │
│    ├─ run → PlatformIO compile + validation               │
│    └─ archive → clean build artifacts                     │
│                                                            │
│  • Workspace 2 (Agent-Pattern-Test)       [Port 3010-3019] │
│    ├─ setup → install deps, seed test data                │
│    ├─ run → pattern validation on device                  │
│    └─ archive → archive test reports                      │
│                                                            │
│  • Workspace 3 (Agent-Webapp-Dev)         [Port 3020-3029] │
│    ├─ setup → npm ci, .env copy                           │
│    ├─ run → Vite dev server @ $CONDUCTOR_PORT             │
│    └─ archive → remove secrets                            │
└─────────────────────────────────────────────────────────┘
```

Each workspace receives:
- **`CONDUCTOR_ROOT_PATH`** → repo root `/Users/spectrasynq/Workspace_Management/Software/K1.node1`
- **`CONDUCTOR_WORKSPACE_PATH`** → isolated workspace copy
- **`CONDUCTOR_PORT`** → first of 10 reserved ports (e.g., 3000, 3010, 3020)
- **`CONDUCTOR_BRANCH`** → auto-created feature branch (e.g., `conductor/feature-xyz`)

---

## Automation Hooks (Contract with Conductor)

### 1. **setup** Hook
Executes immediately after workspace creation. Responsibility: environment gating and dependency installation.

**For K1.node1:**
- Copy `.env` from root (if present) to workspace
- Verify Node ≥20 via `.nvmrc`
- Preflight checks (PlatformIO installed, device reachable)
- `npm ci` in `webapp/`
- `pio pkg install` in `firmware/`
- Seed test data/caches

**Expected time**: ~60 seconds (cached deps)

### 2. **run** Hook
Invoked by the "Run" button. Responsibility: start long-running services or execute one-shot tasks using the reserved port range.

**For K1.node1** (controlled by `K1_TARGET` env var):
- **`K1_TARGET=web`** → `npm run dev` (Vite) on port `$CONDUCTOR_PORT`
- **`K1_TARGET=fw:build`** → `pio run` (compile only, no upload)
- **`K1_TARGET=fw:upload`** → `pio run -t upload` (OTA to 192.168.1.104)
- **`K1_TARGET=test:pattern`** → deploy pattern to device + capture metrics
- **`K1_TARGET=test:integration`** → firmware + webapp + device validation

**Key constraint**: Set `runScriptMode: "nonconcurrent"` in `conductor.json` to serialize `run` hooks per workspace, preventing simultaneous OTA uploads to the same device.

**Expected time**: 2–10 min depending on target

### 3. **archive** Hook
Executes on workspace archival (user deletes workspace). Responsibility: cleanup secrets and temporary files.

**For K1.node1:**
- Remove `.env` file
- Clean PlatformIO build cache (`firmware/.pio/`)
- Archive test artifacts to `ops/artifacts/` if needed

**Expected time**: <5 seconds

---

## MCP Integrations (Policy)

Conductor agents integrate with external systems via **Model Context Protocol (MCP)**—Anthropic's standard for safe tool/data access.

### Allowlist for K1.node1

| Domain | MCP Server | Scope | Agent Use Case |
|--------|-----------|-------|-----------------|
| **VCS** | GitHub API | Read/Write (push, PR create) | Feature Agent, CI Triage Agent |
| **Project Mgmt** | Linear / Jira | Read/Write (update status, link PR) | Feature Agent, Release Agent |
| **Monitoring** | Sentry (read-only) | Fetch error rates, device crashes | Optimization Agent, Bugfix Agent |
| **Firmware Testing** | K1 Device API (read/write) | Query pattern state, upload patterns | Pattern Test Agent |
| **Docs** | Notion / Confluence | Read/Write (sync research, specs) | Research Agent, Content Agent |

**Security principle**: Each agent workspace gets the **minimal scope** required for its role. Example:
- Feature Agent: GitHub read/write, Linear read/write, K1 device read-only
- Bugfix Agent: GitHub read/write, Sentry read-only, K1 device read/write (for testing)

---

## Acceptance Criteria

- ✅ `conductor.json` present at repo root; all hooks execute successfully
- ✅ Web dev server binds to `$CONDUCTOR_PORT`; no port collisions
- ✅ Firmware compilation succeeds with 0 warnings; artifact stored
- ✅ OTA deployment to device (`192.168.1.104`) works via `fw:upload` target
- ✅ CI/CD pre-merge gates pass after agent PRs
- ✅ MCP servers configured with least-privilege scopes documented in Annex E
- ✅ Device offline gracefully handled (agent retries or escalates)
- ✅ Parallel workspaces can run without contention

---

## Deliverables (Sequence)

1. **Phase 1**: Refine `conductor.json` with K1.node1-specific hooks
2. **Phase 2**: Implement setup hook (env validation, PlatformIO, Node deps)
3. **Phase 3**: Implement run hooks (web dev, firmware build, OTA)
4. **Phase 4**: Set up MCP allowlists (GitHub, Linear, K1 device API)
5. **Phase 5**: Test with Feature Agent on a real issue (e.g., "add new pattern")
6. **Phase 6**: Refine monitoring, logs, and error recovery

**Timeline**: 2–3 weeks for Phase 1–3; phased MCP rollout thereafter.

---

## References

- **Conductor docs**: [docs.conductor.build](https://docs.conductor.build) (workspace, hooks, env vars, diff viewer)
- **K1.node1 Conductor Research**: [conductor_integration_technical_analysis.md](../05-analysis/conductor_integration_technical_analysis.md)
- **K1.node1 Project Brief**: [CLAUDE.md](../../CLAUDE.md)
- **Device API**: REST endpoints at `http://192.168.1.104:3000` (webapp port, controls pattern selection/parameters)

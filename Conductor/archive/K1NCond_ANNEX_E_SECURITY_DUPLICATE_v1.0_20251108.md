# Annex A — K1.node1 Integration Patterns

**Status**: Proposed
**Owner**: Claude
**Date**: 2025-11-08
**Scope**: Conductor agent workflows for firmware, webapp, and device integration

---

## 1. Version Control & PR Flow

### Pattern
Each agent workspace is isolated as a **Git worktree + feature branch**; Conductor manages branching automatically.

### K1.node1 Workflow
```
Feature Agent opens task "Add new LED pattern: Aurora" in Taskmaster (.taskmaster/tasks/tasks.json)
    ↓
Conductor creates workspace: feature/aurora-pattern
    CONDUCTOR_WORKSPACE_PATH=/tmp/conductor/ws-123/
    CONDUCTOR_BRANCH=feature/aurora-pattern
    ↓
Agent modifies:
  • firmware/src/generated_patterns.h (new draw_aurora() function)
  • webapp/src/lib/patterns.ts (pattern registry entry)
  • webapp/src/lib/param_registry.ts (sliders for Aurora)
    ↓
Agent runs local tests (K1_TARGET=test:pattern)
    Device@192.168.1.104 runs new pattern for 30s
    Metrics captured (FPS, render time, error rate)
    ↓
Agent opens PR via Conductor diff viewer (⌘D):
  • Title: "feat: add Aurora LED pattern with tunable parameters"
  • Body: Link to Taskmaster task entry, test results, metrics baseline
    ↓
GitHub CI/CD runs pre-merge gates:
  • firmware: PlatformIO compile (0 warnings, <70% flash)
  • webapp: npm test + ESLint (0 errors)
  • integration: pattern validation on device
    ↓
If CI passes → Merge in Conductor UI (or GitHub)
Workspace archived; files deleted per archive hook
```

### Rules
- **One workspace = one feature branch**; no long-lived workspaces
- Commit early/often (Conductor's diff tracking helps recover state)
- Archive workspace after merge to reclaim disk space
- Device offline? Escalate to human; agent retries after delay

---

## 2. IDE & Local Development

### Pattern
Conductor is **not a replacement for IDEs**; it's an **orchestration + review gate**. Agents (Claude) work in Conductor; humans use IDEs for exploration.

### K1.node1 Workflow
```
Developer wants to debug a firmware issue:
  • Opens workspace in Cursor/VS Code
  • Edits firmware, runs tests locally
  • Commits via git cli or IDE
  • Switches back to Conductor for final review/PR

Developer (human) reviews PR in Conductor:
  • Diff viewer shows diffs per file
  • Approves or suggests changes
  • Agent incorporates feedback in same workspace
```

### Integration Points
- **`.vscode/` or `.cursor/` config**: checked in, shared across workspaces
- **`platformio.ini`**: device selection, build flags (shared)
- **`.nvmrc`**: Node version pinning (validated in setup hook)
- **`ops/scripts/preflight.sh`**: gating script (called by setup hook)

---

## 3. Issue Trackers & Project Mgmt (via MCP)

### Pattern
Conductor agents fetch task context from **Taskmaster via MCP** (file-backed) and update status automatically.

### K1.node1 Workflow
```
Team creates Taskmaster task: "Improve Beat Tunnel performance"
  • Issue ID: K1-42
  • Assignee: unassigned
  • Status: Backlog
    ↓
Conductor scheduler triggers Feature Agent for K1-42
  Agent fetches task details via MCP (Taskmaster):
    {
      "id": "K1-42",
      "title": "Improve Beat Tunnel performance",
      "description": "Reduce render time from 5ms to <3ms...",
      "acceptance_criteria": ["0 dropped frames @ 60 FPS", "memory < 200KB"]
    }
    ↓
Agent creates workspace: feature/k1-42-perf
  Reads criteria from Taskmaster
    ↓
Agent implements fix:
  • Optimizes pattern algorithm (firmware/src/generated_patterns.h)
  • Benchmarks locally (K1_TARGET=fw:build + profiling)
  • Opens PR with metrics + Taskmaster link
    ↓
PR title: "perf(beat-tunnel): reduce render time to <3ms (K1-42)"
  MCP hook: Update Taskmaster → status = "In Review", link PR
    ↓
CI validates (performance gate: p95 render < 3ms)
  If OK, merge; MCP updates Taskmaster → "Done"
  If fail, agent retries with new approach
```

### MCP Servers Required
- **Taskmaster MCP**: read/write tasks.json; update status, add comments
- **GitHub API**: already covered by Conductor's PR support

### Security
- Taskmaster MCP is file-scoped; no external API keys. Access restricted to `.taskmaster/` subtree.
- Scope: read/write to K1 project only

---

## 4. CI/CD Feedback Loop

### Pattern
Conductor agents submit PRs; GitHub Actions run pre-merge gates; failures are surfaced back to agent for fix-forward.

### K1.node1 Workflow
```
Agent opens PR for new firmware pattern
    ↓
GitHub Actions (.github/workflows/pre-merge.yml) runs:
  • Firmware path: PlatformIO compile
  • Webapp path: npm test, ESLint
  • Integration: device pattern validation
    ↓
If all pass:
  Agent waits for approval (human or auto-merge policy)
  ↓
If any fail (e.g., PlatformIO returns warnings):
  GitHub webhook → Conductor MCP → Agent receives error log
  Agent reads failure (e.g., "warning: implicit cast int→float line 156")
  Agent creates new commit fixing the issue
  Pushes to same PR branch
  CI re-runs → green
```

### Key Components
- **Pre-merge gates** in `.github/workflows/pre-merge.yml`
  - Firmware: `firmware/` → `pio run` + artifact validation
  - Webapp: `webapp/` → `npm test`, ESLint, TypeScript check
  - Integration: deploy pattern to device + metric validation

- **Agent access to CI logs**: Conductor passes `GITHUB_ACTION_RUN_URL` to agent; agent can fetch logs via GitHub MCP

- **Escalation**: After 2–3 failed CI cycles, escalate to human for review

---

## 5. Device Integration & Real-Time Validation

### Pattern
Conductor agents deploy patterns/firmware to device at `192.168.1.104` and capture live metrics.

### K1.node1 Workflow
```
Pattern Test Agent wants to validate new "Tunnel Glow" pattern
    ↓
Conductor runs (K1_TARGET=test:pattern):
  1. Compile firmware locally (pio run)
  2. Upload via OTA to 192.168.1.104 (pio run -t upload)
  3. Send HTTP request to device:
       GET /api/patterns → list active patterns
       POST /api/select { "id": "tunnel_glow" }
  4. Stream device metrics for 30 seconds:
       - FPS (frames/sec)
       - Render time (ms)
       - Audio latency (ms)
       - Memory usage (bytes)
  5. Compare metrics vs baseline (stored in `ops/baselines/tunnel_glow.json`)
  6. Output test report: `PASS` or `FAIL` (with delta)
    ↓
If metrics regress > 10% → Test fails, PR blocked
  Agent investigates (profiler logs, firmware changes)
  Re-implements optimized version
    ↓
If metrics pass → Test succeeds
  Report uploaded to PR (comment with table)
```

### Key APIs
- **Device REST API** (http://192.168.1.104:3000):
  ```
  GET  /api/patterns           # list all registered patterns
  GET  /api/pattern/{id}       # fetch pattern definition
  POST /api/select { id }      # switch to pattern
  POST /api/params { ... }     # update pattern parameters
  GET  /api/metrics            # fetch device metrics (FPS, memory, etc.)
  ```

- **Device metrics baseline** (stored per pattern):
  ```json
  {
    "pattern": "tunnel_glow",
    "baseline": {
      "fps": 60,
      "render_time_ms": 2.5,
      "memory_kb": 185
    },
    "thresholds": {
      "fps_min": 50,
      "render_time_ms_max": 3.5,
      "memory_kb_max": 200
    },
    "recorded_at": "2025-11-08T10:30:00Z"
  }
  ```

### Failure Modes
- **Device offline**: Retry 3x with 10s backoff; escalate to human if still down
- **OTA timeout**: Retry once; if fail, roll back to prior firmware version
- **Metric regression**: Block PR; log detailed diagnostics for agent to review

### Security
- Device API calls authenticated via X-API-Key header (stored in workspace `.env`)
- Device endpoint in `$CONDUCTOR_PORT+8` for webhook callbacks (e.g., metrics push)

---

## 6. Knowledge & Documentation (via MCP)

### Pattern
Research/Documentation agents capture findings in Notion/Confluence via MCP; searchable and linked from PRs.

### K1.node1 Workflow (Future)
```
Research Agent investigates: "How to optimize audio-reactive patterns for low latency?"
    ↓
MCP queries internal Notion wiki:
  @query("audio reactive patterns latency optimization")
  @fetch("/pages/audio-processing-guide")
    ↓
Agent synthesizes research, drafts spec document
  Creates Notion page: "Audio Latency Optimization - Phase B"
    ↓
Feature Agent links spec from PR:
  "Implements optimization per spec: [Phase B Latency Optimization](notion_url)"
    ↓
Post-merge, agent archives research to `docs/05-analysis/`
  (MCP exports Notion page as Markdown)
```

### Tools Required
- **Notion MCP** (read/write to K1 workspace)
- **Confluence MCP** (optional; for enterprise wiki)

---

## 7. Ports & Local Service Binding

### Pattern
When agents run services (dev server, test server), bind to `$CONDUCTOR_PORT` to avoid collisions.

### K1.node1 Workflow
```
Workspace 1 (Feature Agent for firmware):
  CONDUCTOR_PORT=3000
    setup → npm install (webapp), pio pkg install (firmware)
    run   → pio run (no server)

Workspace 2 (Developer Agent for webapp):
  CONDUCTOR_PORT=3010
    setup → npm ci, .env seed
    run   → npm run dev -- --port $CONDUCTOR_PORT=3010
            Vite dev server listens on 3010
            Accessible at http://localhost:3010

Workspace 3 (Integration Test Agent):
  CONDUCTOR_PORT=3020
    setup → install both, prepare test fixtures
    run   → K1_TARGET=test:integration
            • Starts webapp on 3020
            • Starts mock device API on 3021 ($CONDUCTOR_PORT + 1)
            • Runs e2e tests via Playwright
```

### Rules
- Each workspace gets 10 ports: `$CONDUCTOR_PORT` through `$CONDUCTOR_PORT+9`
- Set `runScriptMode: "nonconcurrent"` in `conductor.json` to serialize `run` hooks (prevents port collisions if agents try to run simultaneously)
- Verify port availability before launch:
  ```bash
  lsof -i :$CONDUCTOR_PORT || echo "port free"
  ```

---

## Summary Table

| Scenario | Tool | MCP Server | K1 Artifact |
|----------|------|-----------|-------------|
| Feature branching | Git + Conductor | — | worktree, branch |
| Task tracking | Taskmaster | Taskmaster MCP | Task link in PR |
| CI/CD gating | GitHub Actions | GitHub MCP | pre-merge gates |
| Device validation | HTTP REST API | — | device metrics, baseline JSON |
| Knowledge capture | Notion/Confluence | Notion MCP | spec docs, research archives |
| Port management | Conductor | — | $CONDUCTOR_PORT assignment |

---

## References

- **Conductor docs**: [Workspace isolation, env vars](https://docs.conductor.build)
- **K1.node1 Device API**: REST endpoints at `http://192.168.1.104:3000`
- **MCP Standard**: [Anthropic Model Context Protocol](https://modelcontextprotocol.io)
- **K1.node1 Master Brief**: [conductor_mcp_master_brief.md](conductor_mcp_master_brief.md)

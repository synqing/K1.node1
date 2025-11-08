# Annex C — K1.node1 Deployment Strategy

**Status**: Proposed
**Owner**: Claude
**Date**: 2025-11-08
**Scope**: Multi-agent orchestration architecture and delegation patterns

---

## Hub-and-Spoke Architecture

```
                    ┌──────────────────────┐
                    │  Conductor UI        │
                    │  (Multi-Agent Mgr)   │
                    └──────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
   │Workspace │         │Workspace │         │Workspace │
   │ Agent-FW │         │Agent-Web │         │Agent-Opt │
   │ Build    │         │ Dev      │         │ization  │
   │(Port3000)│         │(Port3010)│         │(Port3020)│
   └────┬────┘         └────┬────┘         └────┬────┘
        │ (git worktree)    │ (git worktree)    │
        └────────────────────┼────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  K1.node1 Repo  │
                    │  (main branch)  │
                    └─────────────────┘
                             │
                    ┌────────▼────────┐
                    │Device@192.168.. │
                    │(ESP32-S3 LED)   │
                    └─────────────────┘
```

Each **spoke (workspace)** is isolated; agents merge to `main` via PRs.

---

## Communication & Delegation (Stigmergy)

### Shared Artifacts
Agents communicate via **Git commits to shared markdown files** in `ops/`:
- `ops/status.md` — current agent tasks, blockers
- `ops/backlog.md` — prioritized work queue
- `ops/findings.md` — research summaries (audio latency analysis, perf baselines)

### Example: Parent → Child Delegation
```markdown
# ops/backlog.md

## Assigned Tasks

### 1. [AGENT-FW-001] Add Tunnel Glow pattern
**Assigned to**: Feature Agent
**Status**: In Progress (workspace: feature/tunnel-glow)
**Criteria**:
  - [ ] Compile with 0 warnings
  - [ ] Device test: 60 FPS, <3ms render time
  - [ ] PR opened and CI passing
**Delegated to**: Pattern Test Agent (for device validation)
  #delegate: K1-42 (Optimize beat tunnel performance)

### 2. [AGENT-PERF-002] Reduce render latency (K1-42)
**Assigned to**: (waiting for delegation from Feature Agent)
**Parent task**: AGENT-FW-001
**Dependencies**: firmware/src/generated_patterns.h (Tunnel Glow ready)
```

### MCP Messaging
- **Linear MCP**: Agent posts status updates to issue comments
  ```
  Agent-FW: "✓ Tunnel Glow compiled successfully
  Device metrics: FPS=60, render=2.5ms
  Ready for review: PR #42"
  ```
- **Slack MCP**: (Optional) send brief daily digest of blockers

---

## Failure Recovery & Checkpointing

### Strategy
Conductor maintains **checkpointed Git diffs** per workspace; agent can revert to prior state.

### Scenarios

**Scenario 1: Compilation Failed**
```bash
# Agent detects PlatformIO error → error log saved
# Agent uses Conductor "revert" to last known good state
git reset --hard HEAD~1
# Re-analyzes error, tries different fix
```

**Scenario 2: Device Unreachable**
```bash
# Pattern test queued; device offline
# Agent waits 10s, retries, then creates `SKIP` result
# Escalates via MCP: "Device offline; manual check required"
# Supervisor (human) restarts device, agent re-runs test
```

**Scenario 3: Merge Conflict**
```bash
# Agent-A and Agent-B modify same file → conflict on merge
# Conductor UI shows conflict diff
# Agent-B uses Conductor "rebase" on top of Agent-A's merged PR
# Re-runs tests, opens new PR
```

### Redundancy
For **critical workflows** (release, security patch):
- Run **2 agents in parallel** with varied prompts/approaches
- Compare diffs; accept best version (fewer changes, better metrics)
- Use version control as arbiter (earliest merge wins)

---

## Escalation Ladder

```
Attempt 1 (Agent auto-retry)
  │
  ├─ Success → continue
  ├─ Timeout (10s) → Attempt 2
  │
Attempt 2 (Agent re-prompt)
  │
  ├─ Success → continue
  ├─ Timeout (30s) → Attempt 3
  │
Attempt 3 (Agent with debug logs)
  │
  ├─ Success → continue
  ├─ Failure (60s) → Human review
  │
Human Review
  │
  ├─ Fix identified → escalate to specialist agent
  ├─ Infrastructure issue → ops team
  └─ Design issue → product/arch review
```

### Rules
- After **2 failed CI cycles**: escalate to human
- After **1 failed device upload**: escalate to human
- After **15 min of agent retrying**: timeout, escalate

---

## 24/7 High Availability (Future)

### Two-Node Active-Active Setup
```
┌─────────────────┐          ┌─────────────────┐
│ MacBook Pro #1  │          │ MacBook Pro #2  │
│ (Primary)       │  ←────→  │ (Secondary)     │
│ • Conductor     │   Git    │ • Conductor     │
│ • Agents: 3-5   │  sync    │ • Agents: 3-5   │
│ • Device: #1    │          │ • Device: #2    │
│ • Port: 3000+   │          │ • Port: 4000+   │
└─────────────────┘          └─────────────────┘
         │                            │
    ┌────▼────┐              ┌────────▼────┐
    │Device#1 │              │Device#2     │
    │@192.168.│              │@192.168. ..2│
    └─────────┘              └─────────────┘
```

### Failover
- If Node 1 crashes, Node 2's agents take over via Linear/Linear issue reassignment
- Workspaces rebuilt from latest Git commit (no state loss)
- Manual orchestration via human supervisor (future: auto-failover)

### Maintenance
- **Rolling restarts** (one node at a time): drain workspaces, restart Conductor, resume agents
- **Nightly archival**: old workspaces cleaned up, freed disk space

---

## Integration with CI/CD Pipeline

### Current Flow
```
Agent opens PR
    ↓
GitHub pre-merge gates (.github/workflows/pre-merge.yml):
  1. Firmware path: pio run (compile)
  2. Webapp path: npm test, ESLint
  3. Integration: device pattern validation
    ↓
  All pass → merge (auto or manual)
  Any fail → comment with logs; agent retries in workspace
```

### Data Flows
- **PR commit → GitHub webhook** → Conductor captures CI logs
- **CI logs → MCP → Agent** (agent reads failure details)
- **Agent fix → new commit** → CI re-runs automatically

---

## Monitoring & Observability

### Conductor Metrics (Prometheus)
```
conductor_workspace_count{status="active"}
conductor_run_duration_seconds{target="fw:build|fw:upload|web"}
conductor_device_upload_queue_length
conductor_agent_success_rate
```

### Device Metrics (K1 REST API)
```
GET /api/metrics → {
  "fps": 60,
  "render_time_ms": 2.5,
  "memory_kb": 185,
  "timestamp": "2025-11-08T10:30:00Z"
}
```

### Logs
- Conductor logs: `~/.conductor/logs/` (workspace setup, run, archive)
- Device logs: streamed to agent via HTTP; stored in `ops/artifacts/device-logs/`
- CI logs: pulled from GitHub Actions via GitHub MCP

---

## References

- **K1.node1 Master Brief**: [K1NImpl_BRIEF_CONDUCTOR_MCP_v1.0_20251108.md](K1NImpl_BRIEF_CONDUCTOR_MCP_v1.0_20251108.md)
- **Annex A (Integration Patterns)**: [K1NImpl_ANNEX_CONDUCTOR_INTEGRATION_PATTERNS_v1.0_20251108.md](K1NImpl_ANNEX_CONDUCTOR_INTEGRATION_PATTERNS_v1.0_20251108.md)
- **Conductor docs**: Checkpoints, revert, merge conflict handling

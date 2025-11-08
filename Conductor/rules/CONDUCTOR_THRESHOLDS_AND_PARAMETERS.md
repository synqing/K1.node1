# Conductor Thresholds & Parameters (Operational Reference)

**Status**: Active Configuration
**Owner**: Captain (You)
**Date**: 2025-11-08
**Last Updated**: 2025-11-08

This document codifies all numerical thresholds, timeout values, budget limits, and escalation triggers for Conductor's autonomous operation. Treat these as the "control panel" for the system.

---

## 1. POLLING & HEARTBEAT PARAMETERS

### Core Loop Cadence

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Poll Interval** | 10 seconds | TaskMaster checks every 10s for state changes |
| **Poll Timeout** | 5 seconds | API call to TaskMaster must complete within 5s |
| **Health Check Interval** | 30 seconds | Ping agents for liveness status |
| **Dashboard Update Interval** | 5 seconds | UI refresh rate (real-time feedback) |
| **State History Retention** | 7 days | Keep transition logs for audit + debugging |

### Alert Escalation Cadence

| Alert Severity | Check Frequency | Action Timeout |
|---|---|---|
| **CRITICAL** (out of memory, device offline) | Immediate (real-time) | 1 minute (page Captain) |
| **ERROR** (agent hang, quality gate fail) | Every 10 seconds | 5 minutes (auto-escalate) |
| **WARNING** (token budget at 80%, slow build) | Every 30 seconds | 30 minutes (log + dashboard) |
| **INFO** (task started, agent completed) | Every 1 minute | N/A (informational) |

---

## 2. RESOURCE ALLOCATION & CONCURRENCY

### Agent Limits

| Resource | Limit | Reason |
|----------|-------|--------|
| **Max Concurrent Agents** | 5 | Prevent resource starvation; balance with device load |
| **Max Firmware Agents** | 2 | Each needs compile time + USB/OTA port |
| **Max Webapp Agents** | 2 | Each needs npm, webpack, port range |
| **Max Test Agents** | 1 | Non-blocking; low priority |
| **Queue Backlog (before pause)** | 10 pending tasks | If backlog > 10, pause spawning new agents |

### Port Allocation

| Component | Port Range | Count | Notes |
|-----------|-----------|-------|-------|
| **Firmware Agent 1** | 3000-3099 | 100 | Compile, OTA, debug ports |
| **Firmware Agent 2** | 3100-3199 | 100 | Compile, OTA, debug ports |
| **Webapp Agent 1** | 4000-4099 | 100 | Dev server, webpack, npm |
| **Webapp Agent 2** | 4100-4199 | 100 | Dev server, webpack, npm |
| **Test Agent** | 5000-5099 | 100 | E2E test server, mocks |
| **Conductor Core** | 2000-2999 | 1000 | Reserved; not allocated to agents |

**Allocation Logic**:
```
On agent spawn:
  1. Check occupied ranges
  2. Assign next available range
  3. Pass CONDUCTOR_PORT_START and CONDUCTOR_PORT_END env vars
  4. On agent exit, release range (idempotent cleanup)
```

---

## 3. TOKEN BUDGETS & SPENDING

### Daily Token Budget

| Category | Daily Limit | Per-Agent Avg | Notes |
|----------|-------------|---------------|-------|
| **Firmware Tasks** | 1.5M tokens | 500K (3 attempts) | Highest cost; deep C++ reasoning |
| **Webapp Tasks** | 1.0M tokens | 400K (2-3 attempts) | Lower than firmware |
| **Test Tasks** | 400K tokens | 200K (1-2 attempts) | Fast iteration; Haiku model |
| **Research Tasks** | 600K tokens | 300K (exploratory) | Variable; depends on analysis depth |
| **Fallback Reserve** | 500K tokens | N/A | Local DeepSeek; routine fixes only |
| **TOTAL DAILY** | 3.0M tokens | — | Reset at UTC 00:00 |

### Token Spend Tracking

| Event | Tokens | Notes |
|-------|--------|-------|
| Agent spawn (context load) | 5-10K | Task description, codebase context |
| Per request-response cycle | 2-50K | Depends on complexity |
| Code generation | 10-30K | Per file created/modified |
| Quality gate check | 5-15K | Linting, testing, analysis |
| PR review + comments | 5-20K | Feedback loop |

### Budget Alerts

| Threshold | Action |
|-----------|--------|
| **100% consumed** | No new tasks spawn; use fallback (DeepSeek) only for routine fixes |
| **80% consumed** | Alert Captain: "80% of daily token budget spent; manual approval required for new tasks" |
| **60% consumed** | Info log; no action |
| **Per-agent hit 80% of allocation** | Escalate task to Captain: "Agent running out of tokens; recommend manual step-in" |

### Token Refunds & Optimization

| Scenario | Refund | Notes |
|----------|--------|-------|
| Agent killed mid-task (timeout, manual stop) | 50% of used tokens | Prevent token leakage |
| Task deferred before spawn | 0 (no spend yet) | — |
| Quality gate pass on first attempt | +10% bonus | Reward efficiency |

---

## 4. TIMEOUT PARAMETERS

### Hard Timeouts (Agent Process Level)

| Task Type | Timeout | Soft Warning | Escalate If |
|-----------|---------|--------------|-------------|
| **Firmware Compile** | 15 minutes (900s) | 10 minutes | Still compiling after 15m |
| **Firmware OTA Upload** | 10 minutes (600s) | 7 minutes | Still uploading after 10m |
| **Webapp Build** | 10 minutes (600s) | 7 minutes | Still building after 10m |
| **Test Run** | 20 minutes (1200s) | 15 minutes | Still testing after 20m |
| **Research/Analysis** | 30 minutes (1800s) | 20 minutes | Still analyzing after 30m |
| **Quality Gate Check** | 5 minutes (300s) | 3 minutes | Still checking after 5m |

**Implementation**:
```bash
# Conductor wraps agent execution:
timeout 900 claude-code firmware-compile-task \
  --timeout-sec 900 \
  --signal SIGTERM

# If timeout: SIGTERM → wait 10s → SIGKILL
```

### Soft Warnings (Conductor Monitoring Level)

| Condition | Warning Interval | Log Level |
|-----------|-----------------|-----------|
| No agent output for 5 minutes | Every 5 min | WARNING |
| Build time > 2× historical average | After 1st occurence | WARNING |
| Memory usage > 80% | Every 30 sec | WARNING |
| CPU usage > 90% | Every 30 sec | CRITICAL |

### Stalled Agent Detection

| Scenario | Detection Time | Action |
|----------|---|---|
| Agent process alive but zero output | 5 minutes | Send SIGTERM (graceful shutdown) |
| Agent still alive after SIGTERM | 2 minutes | Send SIGKILL (force kill) |
| No heartbeat from device | 3 minutes | Increment retry counter, escalate if > 3 |

---

## 5. FAILURE & ESCALATION THRESHOLDS

### Retry Strategy

| Attempt | Fresh Start? | Cache | Timeout Adjustment |
|---------|---|---|---|
| Attempt 1 | Yes | Use cached | Standard timeout |
| Attempt 2 | Yes | Clear all (.pio/, node_modules/) | +20% timeout (720s for firmware) |
| Attempt 3 | Yes | Full clean rebuild | +40% timeout (1260s for firmware) |
| Attempt 4+ | **ESCALATE** | N/A | N/A |

**Escalation Trigger**: After **3 consecutive failures**, task is marked ESCALATED and Captain is notified immediately.

### Error Classification

| Error Type | Retry? | Escalate Immediately? | Notes |
|-----------|--------|---|---|
| **Compilation error** (syntax, missing headers) | Yes (attempt 2) | No | Clear cache, try again |
| **Timeout** (build too slow) | Yes (attempt 2 with +20%) | No | Adjust timeout, try again |
| **Memory exhausted** | Yes (attempt 2, small task) | Yes (if persists) | May indicate bad task definition |
| **Device offline** | Yes (attempt 2) | Yes (after 3 retries) | Might be hardware issue |
| **Quality gate fail** (lint, test) | Yes (fix code, retry) | Yes (if >2 failures) | Code quality issue |
| **Unknown error** (unhandled exception) | Yes (attempt 2) | Yes (after 2) | Log full traceback |

### Escalation Paths

**Path 1: Auto-Escalation (Conductor → Captain)**
```
Trigger: 3 consecutive failures OR timeout after 3 retries
Action:
  1. Send SMS/Slack: "[ESCALATION] Task {id} failed 3×. Review: {link}"
  2. Create escalation ticket (with logs, last output)
  3. Mark task status = ESCALATED
  4. Move to Captain's manual review queue
  5. Pause further auto-retries
```

**Path 2: Manual Escalation (Captain → Conductor)**
```
Captain clicks "Force Retry" on dashboard:
  1. Reset attempt counter to 0
  2. Increment "manual_retry_count"
  3. Spawn new agent with fresh context
  4. Monitor as normal
```

**Path 3: Deferred (Captain → TaskMaster)**
```
Captain clicks "Defer Task" on dashboard:
  1. Task status = BLOCKED
  2. Add reason: "Waiting for {other_task} to complete"
  3. Conductor skips this task in loop
  4. When prerequisite completes, Captain manually unblocks
```

---

## 6. RESOURCE CONSTRAINTS & CIRCUIT BREAKER

### System Resource Limits

| Resource | Alert Threshold | Shutdown Threshold | Notes |
|----------|---|---|---|
| **CPU Usage** | > 80% | > 95% | Per-agent + system total |
| **RAM Usage** | > 80% | > 90% | Agent kills self; Conductor pauses new spawns |
| **Disk Usage** | > 85% | > 95% | Archive old logs; pause builds |
| **Network Bandwidth** | > 80% | > 95% | Throttle concurrent uploads; queue requests |
| **Device Temperature** | > 70°C | > 85°C | Pause OTA uploads; allow cooldown |

### Circuit Breaker Rules

**Trigger Condition**:
```
If (CPU > 95% OR RAM > 90% OR DISK > 95%) for > 1 minute
  → Activate Circuit Breaker
```

**During Circuit Breaker**:
- ✅ Allow agents to **finish** current task
- ❌ **Don't spawn** new agents
- ⏳ Queue pending tasks (up to 10)
- 📢 Alert Captain: "[CIRCUIT BREAKER] System overloaded; paused new spawns"
- ⏰ Auto-recovery: Check every 30 seconds; deactivate when resources drop below 70%

---

## 7. QUALITY GATES & VALIDATION

### Pre-Merge Quality Thresholds

| Gate | Pass Threshold | Notes |
|------|---|---|
| **Code Coverage** | ≥ 95% | New code must maintain threshold |
| **Linting Score** | ≥ 90/100 | Eslint, clang-tidy, cppcheck combined |
| **Security Score** | ≥ 90/100 | SAST analysis, secrets scanning |
| **Test Pass Rate** | 100% | All tests must pass |
| **Type Checking** | 0 errors | TypeScript, C++ type safety |
| **Compilation** | 0 warnings (–Werror) | Strict compilation mode |

### Soft Failures (Warn but Allow)

| Condition | Allow? | Notes |
|-----------|--------|-------|
| Coverage dropped 2-5% | Warn, allow | Trend is watched |
| One linting issue (auto-fixable) | Warn, allow auto-fix | Auto-fix applied, re-check |
| Performance regressed 5% | Warn, allow | Log for review; may trigger task |
| Documentation incomplete | Warn, allow | File comment TODOs; note for later |

---

## 8. APPROVAL WORKFLOWS

### Captain Approval Checkpoints

| Checkpoint | Auto-Pass? | Captain Action | Timeout |
|-----------|---|---|---|
| **COMMIT Phase** (PR created) | No | Captain reviews diff, approves | 30 minutes |
| **Escalation** (3 failures) | No | Captain reviews logs, force-retry or defer | 1 hour |
| **Quality Gate Soft Fail** | Yes (warn) | Optional review; auto-merge if ignored | N/A |
| **Circuit Breaker** | No | Captain decides: continue or pause | Manual |

### PR Auto-Merge Eligibility

Auto-merge allowed **only if**:
- All quality gates pass (≥90 scores)
- Test pass rate = 100%
- No security issues
- Coverage maintained or improved
- Linting auto-fixed (no manual fixes)

**Pre-Approval**: Captain can set auto-merge flag per task type (e.g., "auto-merge routine lint fixes").

---

## 9. MONITORING & DASHBOARDS

### Real-Time Metrics

| Metric | Update Rate | Alert Level |
|--------|---|---|
| Active agents (count) | 5 sec | Warning if > 5 |
| Pending tasks (count) | 10 sec | Warning if > 10 queue depth |
| Daily token spend (%) | 30 sec | Critical if > 95% |
| Last poll timestamp | 10 sec | Error if stale > 30 sec |
| Device connectivity | 30 sec | Critical if offline > 3 min |

### Logging Format

**Log Entry Structure**:
```json
{
  "timestamp": "2025-11-08T14:23:45.123Z",
  "level": "INFO|WARNING|ERROR|CRITICAL",
  "component": "conductor|agent|taskmaster|device",
  "event": "agent_spawn|state_transition|timeout|escalation",
  "task_id": "1.2.1",
  "agent_id": "agent-7f8a9",
  "message": "Agent spawned for task 1.2.1",
  "metadata": {
    "model": "claude-3-5-sonnet",
    "tokens_allocated": 500000,
    "timeout_sec": 900,
    "attempt": 1
  }
}
```

---

## 10. DAILY/WEEKLY HOUSEKEEPING

### Auto-Cleanup Tasks

| Task | Frequency | Action |
|------|-----------|--------|
| **Reset token budget** | Daily @ 00:00 UTC | Reset daily spend counter; log summary |
| **Archive old logs** | Daily @ 02:00 UTC | Compress logs > 7 days old |
| **Housekeeping agent cleanup** | Every 1 hour | Kill orphaned processes |
| **Port range reset** | On startup + every 4 hours | Release unused port ranges |
| **State file compaction** | Weekly @ Sunday 00:00 UTC | Prune old state history > 7 days |

### Manual Maintenance (Captain)

| Task | Frequency | Notes |
|------|-----------|-------|
| **Review escalations** | Daily | Check dashboard for any ESCALATED tasks |
| **Approve PRs** | As needed | COMMIT phase requires approval |
| **Adjust thresholds** | Weekly | Tune based on actual performance |
| **Token budget review** | Weekly | Adjust allocations if spending patterns shift |

---

## 11. QUICK REFERENCE: CAPTAIN CONTROL COMMANDS

### Dashboard Controls

```bash
# View current state
conductor status              # Show active agents, pending tasks, token spend

# Manual task control
conductor pause               # Pause auto-spawning new agents
conductor resume              # Resume auto-spawning
conductor force-retry <id>    # Force retry of task <id> (bypass failures)
conductor defer <id>          # Mark task as BLOCKED
conductor unblock <id>        # Resume deferred task
conductor kill <agent-id>     # Kill specific agent (emergency)

# Token management
conductor tokens-remaining    # Show % of daily budget remaining
conductor tokens-reset        # Manual reset (debugging only)

# Escalation management
conductor escalations         # List all ESCALATED tasks
conductor approve <id>        # Auto-merge PR for task <id>
conductor reject <id>         # Reject PR, mark for re-work

# System
conductor circuit-status      # Check if circuit breaker active
conductor logs <agent-id>     # Show logs for specific agent
conductor config show         # Display current thresholds
conductor config set <key> <value>  # Update threshold (runtime)
```

---

## 12. THRESHOLD TUNING STRATEGY

### Week 1 (Baseline)
- Run with defaults from this document
- Collect actual data: agent duration, token spend, failure rates
- Log everything (no changes)

### Week 2 (Calibration)
- Analyze data: Are timeouts too aggressive? Too lenient?
- Adjust timeouts ±20% based on observed patterns
- Adjust token budgets ±10% based on spend rate
- Adjust retry logic based on failure root causes

### Ongoing (Tuning)
- Monthly: Review escalation rate (target: < 5% of tasks)
- Monthly: Review token efficiency (target: 2.5M-3M spend)
- Quarterly: Review concurrency limits (may increase to 8 agents if stable)

---

## 13. EXAMPLE SCENARIOS

### Scenario 1: Firmware Task Times Out

```
13:45:00 - Task 1.1 spawned (firmware compile)
13:50:00 - Soft warning: "Compile taking 5min, typical is 3min"
14:00:00 - Hard timeout triggered (15min elapsed)
          - Agent killed, logs captured
          - Attempt counter = 2
          - Task retried with fresh workspace
14:15:00 - Retry timeout triggered again
          - Attempt counter = 3
          - ESCALATED to Captain
          - SMS: "[ESCALATION] Task 1.1 failed 3×. Review: {link}"

Captain action:
  - Reviews logs: "Compilation issue in new header file"
  - Fixes code, force-retries task
  - Task succeeds on 4th attempt (manual)
```

### Scenario 2: Token Budget Hits 80%

```
Current spend: 2.4M / 3M (80%)

Conductor alerts:
  - Dashboard shows "80% token budget consumed"
  - New task 7.2 in pending queue
  - Agent attempts to spawn → BLOCKED (insufficient budget)
  - Captain receives SMS: "Token budget at 80%; approve to continue?"

Captain approves:
  - Clicks "Continue with remaining budget"
  - Conducts remaining tasks at 2.4M - 3.0M spend range
  - If budget exhausted before task complete: Use DeepSeek fallback

End of day (UTC 00:00):
  - Reset budget to 3M
  - Spend report: "Used 2.95M; efficiency +1%"
```

### Scenario 3: Device Goes Offline During OTA

```
14:22:00 - Agent uploading firmware via OTA
14:23:00 - Device offline (connection lost)
          - Agent detects no response
          - Retry attempt 1: Device still offline
14:25:00 - Retry attempt 2: Device still offline
14:27:00 - After 3 retries + 5 min elapsed → ESCALATED
          - SMS: "[ESCALATION] Device offline 5+ min; manual recovery needed"

Captain takes action:
  - Checks device (power cycle, network, etc.)
  - Device comes back online
  - Force-retries task
  - OTA succeeds on 4th attempt (manual)
```

---

## Summary: Your Control Panel

This document is your operational control panel. Print it. Bookmark it. Reference it daily for the first week. After you have a feel for the system, you can begin tuning thresholds based on actual performance data.

**Key numbers to remember**:
- 📊 **10 second** poll interval (responsiveness)
- 👥 **5 agent** max (concurrency)
- 🔴 **3 retries** before escalation (recovery)
- 🔋 **3M token** daily budget (token spend)
- ⏱️ **15 min** firmware compile timeout (hard stop)
- 🔴 **3 failures** = escalation to you (the Captain)

Everything else flows from these 6 numbers. Questions? Let me know.

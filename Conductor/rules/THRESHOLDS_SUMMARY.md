# Conductor Thresholds & Parameters - Quick Summary

**Status**: ✅ Configuration Complete
**Date**: 2025-11-08
**Files**:
- `CONDUCTOR_THRESHOLDS_AND_PARAMETERS.md` (detailed reference, 474 lines)
- `conductor-thresholds.json` (machine-readable config, 419 lines)
- `THRESHOLDS_SUMMARY.md` (this file - quick lookup)

---

## The 6 Critical Numbers You Need to Know

These are the core parameters that drive all Conductor decisions:

```
📊 Poll Interval:           10 seconds (how often Conductor checks TaskMaster)
👥 Max Agents:              5 concurrent (prevent overload)
🔴 Failure Threshold:       3 retries max (then escalate to Captain)
🔋 Daily Token Budget:      3,000,000 tokens (reset at 00:00 UTC)
⏱️  Firmware Timeout:        15 minutes hard stop (compilation dies if still running)
🚨 Escalation to Captain:   After 3 consecutive failures (auto-escalate immediately)
```

---

## Quick Reference Tables

### Token Budget Allocation (Daily)

| Category | Budget | Notes |
|----------|--------|-------|
| Firmware | 1.5M | Highest cost; deep C++ reasoning |
| Webapp | 1M | Web frameworks + JS optimization |
| Test | 400K | Fast iteration; Haiku model |
| Research | 600K | Exploratory analysis |
| Reserve | 500K | DeepSeek fallback for routine fixes |
| **TOTAL** | **3M** | Reset every 24 hours |

**Alert at 80% (2.4M spent)** → Manual approval for new tasks
**Block at 100% (3M spent)** → Use local fallback only

### Timeout Values

| Task | Hard Stop | Soft Warning | Escalate If |
|------|-----------|--------------|-------------|
| Firmware Compile | 15 min (900s) | 10 min | Still running at 15m |
| Firmware OTA | 10 min (600s) | 7 min | Still running at 10m |
| Webapp Build | 10 min (600s) | 7 min | Still running at 10m |
| Test Run | 20 min (1200s) | 15 min | Still running at 20m |
| Research | 30 min (1800s) | 20 min | Still running at 30m |
| Quality Gate | 5 min (300s) | 3 min | Still running at 5m |

### Resource Limits (Circuit Breaker Triggers)

| Resource | Alert | Shutdown | Action |
|----------|-------|----------|--------|
| CPU | > 80% | > 95% | Pause new agent spawns |
| RAM | > 80% | > 90% | Kill agents if needed |
| Disk | > 85% | > 95% | Archive logs, pause builds |
| Network | > 80% | > 95% | Throttle uploads |
| Device Temp | > 70°C | > 85°C | Pause OTA uploads |

**Circuit Breaker Auto-Recovery**: Check every 30s; clear when resources drop below 70%

### Quality Gates (Pre-Merge)

| Gate | Pass Threshold |
|------|---|
| Code Coverage | ≥ 95% |
| Linting Score | ≥ 90/100 |
| Security Score | ≥ 90/100 |
| Test Pass Rate | 100% |
| Type Checking | 0 errors |
| Compilation | 0 warnings |

---

## Agent Concurrency Model

```
Max Concurrent: 5 agents total

Firmware Agents:  Max 2
  - Each needs compile time + OTA port
  - Ports: 3000-3099, 3100-3199

Webapp Agents:    Max 2
  - Each needs npm + webpack + dev server
  - Ports: 4000-4099, 4100-4199

Test Agent:       Max 1
  - Non-blocking, lowest priority
  - Ports: 5000-5099

If 6th agent requested:
  ↳ Queue it (max backlog: 10 tasks)
  ↳ When one completes, spawn next in queue
```

---

## Retry Strategy

```
Attempt 1
  ├─ Fresh start
  ├─ Use cached build files
  └─ Standard timeout

Attempt 2 (after fail 1)
  ├─ Fresh start
  ├─ Clear all caches (.pio/, node_modules/)
  └─ Timeout +20% (e.g., firmware 900s → 1080s)

Attempt 3 (after fail 2)
  ├─ Fresh start
  ├─ Full clean rebuild
  └─ Timeout +40% (e.g., firmware 900s → 1260s)

Attempt 4+ (after fail 3)
  ↳ 🚨 ESCALATE TO CAPTAIN IMMEDIATELY 🚨
```

---

## Escalation Paths

### Path 1: Auto-Escalation (Automatic)
```
Trigger: 3 consecutive failures OR timeout after 3 retries
Action:
  1. Send SMS/Slack alert: "[ESCALATION] Task {id} failed 3×"
  2. Create ticket with logs + last output
  3. Mark task status = ESCALATED
  4. Move to Captain's review queue
  5. Pause auto-retries (wait for Captain action)
```

### Path 2: Manual Escalation (Captain Action)
```
Captain clicks "Force Retry":
  → Reset attempt counter to 0
  → Spawn new agent (fresh context)
  → Monitor as normal
```

### Path 3: Deferred (Captain Action)
```
Captain clicks "Defer Task":
  → Task status = BLOCKED
  → Skip in poll loop
  → Wait for prerequisite to complete
  → Captain manually unblocks
```

---

## Failure Classification

| Error | Retry? | Escalate Immediately? | Reason |
|-------|--------|---|---|
| Compilation error (syntax) | ✅ Try 2 | ❌ No | Clear cache, try again |
| Timeout (slow build) | ✅ Try 2 | ❌ No | Adjust timeout, try again |
| Memory exhausted | ✅ Try 2 | ✅ Yes (persist) | May indicate bad task |
| Device offline | ✅ Try 2 | ✅ Yes (3+ fails) | Might be hardware |
| Quality gate fail | ✅ Try 2 | ✅ Yes (2+ fails) | Code quality issue |
| Unknown error | ✅ Try 2 | ✅ Yes (2+ fails) | Log full traceback |

---

## Captain Control Dashboard Commands

```bash
# View state
conductor status              # Active agents, pending tasks, token spend

# Task control
conductor force-retry <id>    # Force retry (bypass failures)
conductor defer <id>          # Mark as BLOCKED
conductor unblock <id>        # Resume blocked task
conductor pause               # Pause auto-spawning
conductor resume              # Resume auto-spawning

# Tokens
conductor tokens-remaining    # Show % of budget left
conductor tokens-reset        # Manual reset (debug only)

# Escalations
conductor escalations         # List ESCALATED tasks
conductor approve <id>        # Auto-merge PR
conductor reject <id>         # Reject PR, mark for re-work

# System
conductor circuit-status      # Check circuit breaker
conductor logs <agent-id>     # Show agent logs
conductor config show         # Display thresholds
conductor config set <k> <v>  # Update threshold
```

---

## Daily Housekeeping

### Automatic (Conductor Manages)

| Task | Frequency | Action |
|------|-----------|--------|
| Token budget reset | Daily @ 00:00 UTC | Reset spend counter; log summary |
| Archive old logs | Daily @ 02:00 UTC | Compress logs > 7 days |
| Agent cleanup | Every 1 hour | Kill orphaned processes |
| Port range reset | Every 4 hours | Release unused ranges |
| State compaction | Weekly @ 00:00 Sun UTC | Prune history > 7 days |

### Manual (Captain Maintains)

| Task | Frequency | Action |
|------|-----------|--------|
| Review escalations | Daily | Check for ESCALATED tasks |
| Approve PRs | As needed | COMMIT phase requires approval |
| Adjust thresholds | Weekly | Tune based on data |
| Token review | Weekly | Adjust allocations if needed |

---

## Threshold Tuning Timeline

### Week 1: Baseline
- Run with defaults from this doc
- Collect data: agent duration, token spend, failures
- **Action**: Log only, no changes

### Week 2: Calibration
- Analyze data: Are timeouts too aggressive? Too lenient?
- **Actions**:
  - Adjust timeouts ±20%
  - Adjust token budgets ±10%
  - Adjust retry logic based on failure patterns

### Ongoing: Fine-Tuning
- **Monthly**: Review escalation rate (target: < 5%)
- **Monthly**: Review token efficiency (target: 2.5M-3M spend)
- **Quarterly**: Review concurrency (may increase to 8 agents if stable)

---

## Monitoring Metrics (Real-Time)

| Metric | Update Rate | Alert Level |
|--------|---|---|
| Active agents | 5 sec | ⚠️ if > 5 |
| Pending tasks | 10 sec | ⚠️ if > 10 queue |
| Token spend (%) | 30 sec | 🔴 if > 95% |
| Last poll | 10 sec | ❌ if stale > 30s |
| Device online | 30 sec | 🔴 if offline > 3 min |

---

## Example: What Happens When Task Fails

```
14:22:15 - Task 1.2 "Compile firmware" spawned
          Agent starts compiling firmware/src/main.cpp

14:27:15 - Soft warning: "Compile taking 5 min (typical: 3 min)"
          Conductor logs at WARNING level

14:37:15 - Hard timeout: 15 minutes elapsed
          Agent killed (SIGTERM → wait 10s → SIGKILL)
          Attempt counter = 2
          Logs captured, cached cleared
          Task retried immediately

14:52:15 - Second timeout: 15 minutes elapsed again
          Agent killed again
          Attempt counter = 3
          Logs captured
          🚨 **ESCALATED TO CAPTAIN**
          SMS sent: "[ESCALATION] Task 1.2 failed 3×. Review: {link}"

Captain reviews logs → sees issue in new header → fixes code → force-retries
Task succeeds on 4th attempt (manual)
```

---

## Reference Files

| File | Purpose | Use When |
|------|---------|----------|
| `CONDUCTOR_THRESHOLDS_AND_PARAMETERS.md` | Detailed reference doc | Need to understand reasoning behind a threshold |
| `conductor-thresholds.json` | Machine-readable config | Integrating with automation/dashboards |
| `CONDUCTOR_CORE_CONFIGURATION.md` | Operational specification | Understanding the overall workflow |
| `THRESHOLDS_SUMMARY.md` | This file | Quick lookup during operations |

---

## Key Takeaways

1. **Conductor runs autonomously** - polls TaskMaster every 10s, spawns agents automatically
2. **You intervene at escalation** - after 3 failures, task waits for your decision
3. **Token budget is your rate limiter** - 3M/day; 80% alert, 100% hard stop
4. **Timeouts are hard stops** - 15min firmware timeout = non-negotiable
5. **Circuit breaker protects system** - pauses spawning if CPU/RAM/Disk overloaded
6. **Quality gates auto-enforce** - must pass 95% coverage, 90 linting, 100% tests

Everything flows from these principles. When in doubt, refer to the 6 critical numbers at the top of this document.

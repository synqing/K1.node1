# Conductor Thresholds & Configuration - Complete Setup

**Status**: ✅ Complete & Ready
**Date**: 2025-11-08
**Owner**: Captain (You)

---

## What You Have

Complete operational configuration for Conductor's autonomous orchestration system. Everything below is ready to deploy.

---

## Files in This Package

### 1. **CONDUCTOR_CORE_CONFIGURATION.md** (21 KB)
**What it is**: Operational specification document
**What's in it**:
- Core loop (10s polling, state detection, decision tree)
- Agent lifecycle (spawn conditions, concurrency, timeouts)
- State machine (RED → WORKING → GREEN → COMMIT → DONE)
- Failure & recovery logic (3 retries, escalation)
- Visibility & alerts (CRITICAL/ERROR/WARNING/INFO)
- Integration architecture
- 10 explicit questions answered with specific numbers

**Use this when**: You need to understand the "why" behind a decision

---

### 2. **CONDUCTOR_THRESHOLDS_AND_PARAMETERS.md** (17 KB, 474 lines)
**What it is**: Detailed reference manual
**What's in it**:
- 13 sections covering all operational parameters
- Polling & heartbeat parameters (with tables)
- Resource allocation & concurrency limits
- Token budgets & spending (with allocation breakdown)
- Timeout parameters (hard vs soft)
- Failure & escalation thresholds
- Resource constraints & circuit breaker rules
- Quality gates & validation
- Approval workflows
- Monitoring & dashboards
- Housekeeping & maintenance
- Tuning strategy (Week 1-2-ongoing)
- 3 detailed scenario walkthroughs

**Use this when**: You need detailed explanation of a threshold or scenario

---

### 3. **conductor-thresholds.json** (10 KB, 419 lines)
**What it is**: Machine-readable configuration file
**What's in it**:
- Polling parameters (intervals, timeouts)
- Alert escalation cadence
- Agent limits (concurrency, ports)
- Token budgets (daily, per-category, alerts)
- Timeouts (hard, soft, stalled detection)
- Failure classification (retry strategy, error types)
- Resource constraints & circuit breaker
- Quality gates & validation thresholds
- Approval workflow rules
- Monitoring metrics & logging format
- Housekeeping tasks (auto & manual)
- Tuning strategy timeline

**Use this when**:
- Integrating with automation/dashboards
- Programmatically reading thresholds
- Deploying to production

**Format**: Valid JSON (validated with `python3 -m json.tool`)

---

### 4. **THRESHOLDS_SUMMARY.md** (9.3 KB)
**What it is**: Quick reference card
**What's in it**:
- The 6 critical numbers (10s, 5 agents, 3 retries, 3M tokens, 15m timeout, escalation)
- Quick reference tables (tokens, timeouts, resources, quality gates)
- Agent concurrency model (visual)
- Retry strategy (visual)
- Escalation paths (3 types)
- Failure classification matrix
- Captain control dashboard commands
- Daily housekeeping checklist
- Monitoring metrics
- 3 example scenarios

**Use this when**: You need a quick lookup during operations

**Size**: Fits on ~2 printed pages

---

### 5. **THRESHOLDS_VALIDATION_CHECKLIST.md** (15 KB)
**What it is**: Pre-deployment validation checklist
**What's in it**:
- 13 phases with 95+ checkbox items
- Phase 1: Core parameters verification (6 items)
- Phase 2: Token budget configuration (7 items)
- Phase 3: Timeout configuration (6 items)
- Phase 4: Resource constraints (6 items)
- Phase 5: Quality gates (6 items)
- Phase 6: Approval workflows (5 items)
- Phase 7: Concurrency & ports (20 items)
- Phase 8: Retry strategy (4 items)
- Phase 9: Error classification (6 items)
- Phase 10: Housekeeping & maintenance (8 items)
- Phase 11: Monitoring & dashboards (4 items)
- Phase 12: Documentation review (5 items)
- Phase 13: Pre-production testing (11 items)
- Post-deployment monitoring metrics
- Final approval section (Captain signature)

**Use this when**:
- Setting up Conductor for the first time
- Verifying all parameters before going live
- Testing failure scenarios

---

### 6. **README_THRESHOLDS.md** (this file)
**What it is**: Navigation guide
**Use this when**: You're looking for which file to read

---

## Quick Start (5 minutes)

### Read These in Order:

1. **THRESHOLDS_SUMMARY.md** (10 min) - Get the 6 critical numbers
2. **CONDUCTOR_CORE_CONFIGURATION.md** (20 min) - Understand the workflow
3. **THRESHOLDS_VALIDATION_CHECKLIST.md** (60 min) - Validate before deployment

---

## The 6 Critical Numbers (Memorize These)

```
📊 Poll Interval:        10 seconds
👥 Max Agents:           5 concurrent
🔴 Failure Threshold:    3 retries max
🔋 Daily Token Budget:   3,000,000 tokens
⏱️  Firmware Timeout:     15 minutes (900 seconds)
🚨 Escalation Trigger:   3 consecutive failures
```

Everything else flows from these 6 numbers.

---

## Token Budget Breakdown (3M Daily)

| Category | Budget | Notes |
|----------|--------|-------|
| Firmware | 1.5M | Highest cost; deep C++ reasoning |
| Webapp | 1.0M | Web frameworks + JS optimization |
| Test | 400K | Fast iteration; Haiku model |
| Research | 600K | Exploratory analysis |
| Reserve | 500K | DeepSeek fallback (routine fixes only) |

**Alerts**:
- **80% (2.4M)**: Manual approval required for new tasks
- **100% (3.0M)**: Hard stop; use fallback only

---

## Timeout Configuration

| Task | Hard Stop | Soft Warning |
|------|-----------|--------------|
| Firmware Compile | 15 min | 10 min |
| Firmware OTA | 10 min | 7 min |
| Webapp Build | 10 min | 7 min |
| Test Run | 20 min | 15 min |
| Research | 30 min | 20 min |
| Quality Gate | 5 min | 3 min |

---

## Agent Concurrency

```
Max Concurrent: 5 agents total

Firmware:  2 max (ports 3000-3199)
Webapp:    2 max (ports 4000-4199)
Test:      1 max (ports 5000-5099)

Queue backlog: 10 max (pause spawning if > 10)
```

---

## Retry Strategy

```
Attempt 1: Fresh start, standard timeout
    ↓
Attempt 2: Fresh start, clear caches, +20% timeout
    ↓
Attempt 3: Fresh start, full rebuild, +40% timeout
    ↓
Attempt 4+: 🚨 ESCALATE TO CAPTAIN 🚨
```

---

## Captain Control Commands

```bash
# View state
conductor status              # Show active agents, pending tasks, token spend

# Task control
conductor force-retry <id>    # Force retry
conductor defer <id>          # Mark as BLOCKED
conductor unblock <id>        # Resume blocked task

# Tokens
conductor tokens-remaining    # Show budget remaining

# Escalations
conductor escalations         # List ESCALATED tasks
conductor approve <id>        # Auto-merge PR
```

---

## Deployment Checklist

Before going to production:

- [ ] Read all 3 main documents (CORE, THRESHOLDS, SUMMARY)
- [ ] Review conductor-thresholds.json (all values correct?)
- [ ] Run THRESHOLDS_VALIDATION_CHECKLIST.md (all boxes checked?)
- [ ] Run smoke tests (5 scenarios passing?)
- [ ] Run failure tests (escalation working?)
- [ ] Captain signature on checklist
- [ ] Ready to deploy! ✅

---

## Day 1 Operations

### Morning (Start of Day)

```bash
conductor status              # Check overnight state
conductor escalations         # Review any ESCALATED tasks
conductor tokens-remaining    # Check token budget
```

### During Day

```bash
# Periodically check (every hour)
conductor status              # Monitor agents
conductor tokens-remaining    # Track spend rate

# As needed
conductor approve <id>        # Approve PRs from COMMIT phase
conductor force-retry <id>    # Force retry if needed
conductor defer <id>          # Defer if blocking on something
```

### End of Day

```bash
conductor escalations         # Review any new escalations
conductor tokens-remaining    # Log token spend for the day
```

---

## Week 1 (Baseline)

- ✅ Deploy with defaults from this document
- 📊 Collect data: agent duration, token spend, failure rates
- 📝 Log everything (no changes)

### Metrics to Track

| Metric | Target |
|--------|--------|
| Firmware compile time | ~3 min |
| Webapp build time | ~2 min |
| Test run time | ~5 min |
| Token spend/day | 2.5M - 3M |
| Escalation rate | < 5% |
| Quality gate pass rate | > 95% |

---

## Week 2 (Calibration)

- 📊 Analyze Week 1 data
- 🔧 Adjust thresholds based on patterns
- ✅ Update conductor-thresholds.json with tuned values

### Potential Adjustments

```
If firmware timeouts at 14 min:    Increase from 15m to 18m
If token spend is 2.2M/day:        Adjust categories ±10%
If > 10% escalations:              Check error classification
If CPU consistently 90%:            Reduce max agents from 5 to 4
```

---

## Ongoing (Monthly/Quarterly)

### Monthly

- Review escalation rate (target: < 5%)
- Review token efficiency (target: 2.5M-3M)
- Adjust thresholds if needed

### Quarterly

- Review concurrency limits (may increase to 8 agents if stable)
- Review timeout patterns (any consistent hangs?)
- Update documentation with new learnings

---

## Integration Points

### TaskMaster Integration
```bash
# Conductor uses these TaskMaster commands:
task-master next                    # Get next pending task
task-master show <id>               # View task details
task-master set-status --id=<id> --status=in-progress
task-master set-status --id=<id> --status=done
task-master update-subtask --id=<id> --prompt="..."
```

### GitHub Integration
```bash
# Conductor uses these GitHub commands:
gh pr create --title "..." --body "..."
gh pr merge <pr-id> --auto
gh status check                      # Quality gate checks
```

### Device Integration
```bash
# Conductor uses these device commands:
/api/health                         # Health check
/api/info                           # Device info
/api/firmware/upload               # OTA upload
```

---

## Troubleshooting

### Scenario: Agent Hangs (No Output for 5 min)

**Expected**: SIGTERM sent
**If still hanging**: SIGKILL after 10s
**Log**: Check `conductor logs <agent-id>`
**Action**: Increment attempt counter, retry

### Scenario: Task Escalates (3 Failures)

**Expected**: Task marked ESCALATED, Captain notified
**Captain action**: Review logs, force-retry or defer
**Log**: Check TaskMaster for failure reasons

### Scenario: Token Budget at 80% (2.4M)

**Expected**: Alert fires, dashboard shows warning
**Captain action**: Review pending tasks, decide: approve or defer
**If 100%**: Use DeepSeek fallback (routine fixes only)

### Scenario: Circuit Breaker Activates (CPU > 95%)

**Expected**: No new agents spawn, pending tasks queue
**Auto-recovery**: Check every 30s, clear when CPU < 70%
**Captain action**: Investigate source of high CPU load

---

## Support & Reference

| Need | See File |
|------|----------|
| Understanding the workflow | CONDUCTOR_CORE_CONFIGURATION.md |
| Detailed threshold rationale | CONDUCTOR_THRESHOLDS_AND_PARAMETERS.md |
| Quick lookup during ops | THRESHOLDS_SUMMARY.md |
| Pre-deployment validation | THRESHOLDS_VALIDATION_CHECKLIST.md |
| Machine-readable config | conductor-thresholds.json |

---

## Final Notes

This configuration is **production-ready** but should be **tuned to your environment** during Week 1-2. The thresholds are conservative defaults designed to work across most hardware:

- **Timeouts**: Set high to avoid false timeouts; tighten in Week 2
- **Token budgets**: Set balanced; may adjust based on actual task complexity
- **Concurrency**: Set to 5; increase if system is stable, decrease if overloaded
- **Quality gates**: Set to realistic standards (95% coverage is ambitious but achievable)

**Good luck, Captain!** 🚀

---

## File Manifest

```
.conductor/casablanca/

├── CONDUCTOR_CORE_CONFIGURATION.md          (21 KB)  ← Operational spec
├── CONDUCTOR_THRESHOLDS_AND_PARAMETERS.md   (17 KB)  ← Detailed reference
├── conductor-thresholds.json                (10 KB)  ← Machine config
├── THRESHOLDS_SUMMARY.md                    (9.3 KB) ← Quick reference
├── THRESHOLDS_VALIDATION_CHECKLIST.md       (15 KB)  ← Pre-deployment
└── README_THRESHOLDS.md                     (this)   ← Navigation guide
```

**Total**: 82 KB of production-ready configuration
**Status**: ✅ Complete and validated
**Last Updated**: 2025-11-08

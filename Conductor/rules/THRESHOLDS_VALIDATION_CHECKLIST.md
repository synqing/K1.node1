# Conductor Thresholds Validation Checklist

**Status**: Pre-Deployment Validation
**Date**: 2025-11-08
**Owner**: Captain (You)

Before deploying Conductor to production, verify all thresholds are configured correctly. Use this checklist to confirm everything is in place.

---

## Phase 1: Core Parameters Verification

- [ ] **Poll Interval**: 10 seconds configured in conductor-thresholds.json
  - Verify: `polling.pollIntervalSeconds = 10`
  - Test: Manual poll, confirm TaskMaster responds within 5s

- [ ] **Max Concurrent Agents**: 5 configured
  - Verify: `agents.maxConcurrent = 5`
  - Test: Spawn 5 agents, confirm 6th queues

- [ ] **Failure Threshold**: 3 retries max
  - Verify: `failure.retryStrategy.maxAttempts = 3`
  - Test: Force 3 failures on test task, confirm escalates

- [ ] **Daily Token Budget**: 3M tokens
  - Verify: `tokenBudget.dailyLimitTokens = 3000000`
  - Test: Spend tracker functional, alert at 80% (2.4M)

- [ ] **Firmware Timeout**: 15 minutes (900s)
  - Verify: `timeouts.hardTimeouts.firmwareCompile.timeoutSeconds = 900`
  - Test: Timeout task after 14 min, confirm kill at 15 min

- [ ] **Escalation Trigger**: Auto-escalate after 3 failures
  - Verify: Task marked ESCALATED in TaskMaster
  - Test: Receive Captain notification on 3rd failure

---

## Phase 2: Token Budget Configuration

- [ ] **Firmware Budget**: 1.5M / 3M
  - Verify: `tokenBudget.categories.firmware.dailyLimitTokens = 1500000`
  - Test: Track firmware task token spend

- [ ] **Webapp Budget**: 1M / 3M
  - Verify: `tokenBudget.categories.webapp.dailyLimitTokens = 1000000`
  - Test: Track webapp task token spend

- [ ] **Test Budget**: 400K / 3M
  - Verify: `tokenBudget.categories.test.dailyLimitTokens = 400000`
  - Test: Track test task token spend

- [ ] **Research Budget**: 600K / 3M
  - Verify: `tokenBudget.categories.research.dailyLimitTokens = 600000`
  - Test: Track research task token spend

- [ ] **Fallback Reserve**: 500K / 3M
  - Verify: `tokenBudget.categories.fallbackReserve.dailyLimitTokens = 500000`
  - Model: DeepSeek (local)
  - Restriction: Routine fixes only

- [ ] **Alert at 80%**: Dashboard warning triggered
  - Verify: Alert logic in conductor-thresholds.json
  - Test: Spend 2.4M tokens, confirm alert fires

- [ ] **Block at 100%**: Hard stop for new tasks
  - Verify: Block logic in conductor-thresholds.json
  - Test: Spend 3M tokens, confirm no new agents spawn

- [ ] **Daily Reset**: Budget resets at 00:00 UTC
  - Verify: `tokenBudget.resetTimeUTC = "00:00:00"`
  - Test: Monitor reset at midnight

---

## Phase 3: Timeout Configuration

### Hard Timeouts

- [ ] **Firmware Compile**: 900s (15 min)
  - Command: `timeout 900 firmware-compile-task`
  - Soft warning: 600s (10 min)

- [ ] **Firmware OTA**: 600s (10 min)
  - Command: `timeout 600 firmware-ota-task`
  - Soft warning: 420s (7 min)

- [ ] **Webapp Build**: 600s (10 min)
  - Command: `timeout 600 webapp-build-task`
  - Soft warning: 420s (7 min)

- [ ] **Test Run**: 1200s (20 min)
  - Command: `timeout 1200 test-run-task`
  - Soft warning: 900s (15 min)

- [ ] **Research**: 1800s (30 min)
  - Command: `timeout 1800 research-task`
  - Soft warning: 1200s (20 min)

- [ ] **Quality Gate Check**: 300s (5 min)
  - Command: `timeout 300 quality-gate-task`
  - Soft warning: 180s (3 min)

### Soft Warnings

- [ ] **No Output Detection**: 5 minutes (300s)
  - Verify: `timeouts.softWarnings.noOutputSeconds = 300`
  - Test: Monitor agent with no output, confirm warning

- [ ] **Stalled Agent Recovery**: SIGTERM → SIGKILL
  - SIGTERM wait: 10s
  - SIGKILL: Immediate after SIGTERM timeout

---

## Phase 4: Resource Constraints

### Circuit Breaker Configuration

- [ ] **CPU Shutdown**: > 95%
  - Verify: `resources.circuitBreaker.cpuUsagePercent = 95`
  - Test: Generate CPU load, confirm circuit breaker activates

- [ ] **RAM Shutdown**: > 90%
  - Verify: `resources.circuitBreaker.ramUsagePercent = 90`
  - Test: Fill memory, confirm pausing spawns

- [ ] **Disk Shutdown**: > 95%
  - Verify: `resources.circuitBreaker.diskUsagePercent = 95`
  - Test: Fill disk, confirm pausing builds

- [ ] **Trigger Duration**: > 1 minute
  - Verify: `resources.circuitBreaker.triggerDurationSeconds = 60`
  - Must persist for 60s before activating

- [ ] **Auto-Recovery Check**: Every 30s
  - Verify: `resources.circuitBreaker.autoRecoveryCheckSeconds = 30`
  - Recovery threshold: < 70% resource usage

- [ ] **Device Temperature Alert**: > 70°C
  - Verify: `resources.limits.deviceTemperatureAlertC = 70`
  - Action: Log warning

- [ ] **Device Temperature Shutdown**: > 85°C
  - Verify: `resources.limits.deviceTemperatureShutdownC = 85`
  - Action: Pause OTA, pause new agents

---

## Phase 5: Quality Gates

- [ ] **Code Coverage**: ≥ 95%
  - Verify: `qualityGates.codeCoveragePercent = 95`
  - Test: Check coverage reporting tool configured

- [ ] **Linting Score**: ≥ 90/100
  - Verify: `qualityGates.lintingScoreMin = 90`
  - Test: Run linter on sample code, confirm scoring

- [ ] **Security Score**: ≥ 90/100
  - Verify: `qualityGates.securityScoreMin = 90`
  - Test: Run SAST on sample code, confirm scoring

- [ ] **Test Pass Rate**: 100%
  - Verify: `qualityGates.testPassRatePercent = 100`
  - Test: Confirm all tests pass in CI

- [ ] **Type Checking Errors**: 0
  - Verify: `qualityGates.typeCheckingErrors = 0`
  - Test: TypeScript/C++ type check passes

- [ ] **Compilation Warnings**: 0
  - Verify: `qualityGates.compilationWarnings = 0`
  - Test: Compile with -Werror, confirm no warnings

- [ ] **Soft Failure: Coverage Drop**: Allow if ≤ 5%
  - Verify: `qualityGates.softFailures.coverageDropPercent = 5`

- [ ] **Soft Failure: Auto-Fix**: Enabled
  - Verify: `qualityGates.softFailures.allowAutoFix = true`
  - Test: Trigger lint auto-fix, confirm applied

---

## Phase 6: Approval Workflows

- [ ] **COMMIT Phase**: Requires Captain approval
  - Verify: `approvalWorkflow.checkpoints.commitPhase.captainRequired = true`
  - Timeout: 30 minutes
  - Test: Create PR, confirm requires approval

- [ ] **Escalation**: Requires Captain action
  - Verify: `approvalWorkflow.checkpoints.escalation.captainRequired = true`
  - Timeout: 1 hour
  - Test: Escalate task, confirm requires action

- [ ] **Quality Gate Soft Fail**: Auto-pass
  - Verify: `approvalWorkflow.checkpoints.qualityGateSoftFail.autoPass = true`
  - Test: Soft failure occurs, confirm auto-merge allowed

- [ ] **Circuit Breaker**: Requires Captain action
  - Verify: `approvalWorkflow.checkpoints.circuitBreaker.captainRequired = true`
  - No timeout (manual decision)

- [ ] **Auto-Merge Eligibility**: All criteria met
  - Quality gates pass: ✅
  - Tests 100%: ✅
  - No security issues: ✅
  - Coverage maintained/improved: ✅
  - Auto-fixed only: ✅

---

## Phase 7: Concurrency & Ports

### Agent Limits

- [ ] **Max Concurrent**: 5 agents
  - Verify: `agents.maxConcurrent = 5`
  - Test: Spawn 5, queue 6th

- [ ] **Firmware Agents**: Max 2
  - Verify: `agents.maxByType.firmware = 2`
  - Test: Spawn 2 firmware, confirm 3rd queues

- [ ] **Webapp Agents**: Max 2
  - Verify: `agents.maxByType.webapp = 2`
  - Test: Spawn 2 webapp, confirm 3rd queues

- [ ] **Test Agents**: Max 1
  - Verify: `agents.maxByType.test = 1`
  - Test: Spawn 1 test, confirm 2nd queues

### Port Allocation

- [ ] **Firmware Agent 1**: Ports 3000-3099
  - Verify: `agents.ports.firmwareAgent1.start = 3000`
  - Verify: `agents.ports.firmwareAgent1.end = 3099`

- [ ] **Firmware Agent 2**: Ports 3100-3199
  - Verify: `agents.ports.firmwareAgent2.start = 3100`
  - Verify: `agents.ports.firmwareAgent2.end = 3199`

- [ ] **Webapp Agent 1**: Ports 4000-4099
  - Verify: `agents.ports.webappAgent1.start = 4000`
  - Verify: `agents.ports.webappAgent1.end = 4099`

- [ ] **Webapp Agent 2**: Ports 4100-4199
  - Verify: `agents.ports.webappAgent2.start = 4100`
  - Verify: `agents.ports.webappAgent2.end = 4199`

- [ ] **Test Agent**: Ports 5000-5099
  - Verify: `agents.ports.testAgent.start = 5000`
  - Verify: `agents.ports.testAgent.end = 5099`

- [ ] **Conductor Core**: Ports 2000-2999
  - Verify: `agents.ports.conductor.start = 2000`
  - Verify: `agents.ports.conductor.end = 2999`

- [ ] **Port Release on Exit**: Idempotent cleanup
  - Test: Start agent, release port, start new agent, confirm port reused

---

## Phase 8: Retry Strategy

- [ ] **Attempt 1**:
  - Fresh start: ✅
  - Clear cache: ❌
  - Standard timeout: ✅

- [ ] **Attempt 2**:
  - Fresh start: ✅
  - Clear cache: ✅ (all)
  - Timeout +20%: ✅

- [ ] **Attempt 3**:
  - Fresh start: ✅
  - Full clean rebuild: ✅
  - Timeout +40%: ✅

- [ ] **Attempt 4+**:
  - Escalate: ✅
  - Mark ESCALATED: ✅
  - Notify Captain: ✅

---

## Phase 9: Error Classification

- [ ] **Compilation Error**: Retry attempt 2
  - Verify: `failure.errorClassification.compilationError.retry = true`
  - Clear cache, try again

- [ ] **Timeout**: Retry with +20% timeout
  - Verify: `failure.errorClassification.timeout.retry = true`
  - Adjust timeout, try again

- [ ] **Memory Exhausted**: Escalate if persist
  - Verify: `failure.errorClassification.memoryExhausted.escalateImmediately = true`

- [ ] **Device Offline**: Escalate after 3 retries
  - Verify: `failure.errorClassification.deviceOffline.escalateImmediately = true`

- [ ] **Quality Gate Fail**: Escalate if > 2 failures
  - Verify: `failure.errorClassification.qualityGateFail.escalateImmediately = true`

- [ ] **Unknown Error**: Escalate after 2 failures
  - Verify: `failure.errorClassification.unknownError.escalateImmediately = true`

---

## Phase 10: Housekeeping & Maintenance

### Auto-Cleanup

- [ ] **Token Budget Reset**: Daily @ 00:00 UTC
  - Verify: `housekeeping.autoCleanup.tokenBudgetReset.timeUTC = "00:00:00"`
  - Test: Monitor reset at midnight

- [ ] **Archive Old Logs**: Daily @ 02:00 UTC
  - Verify: `housekeeping.autoCleanup.archiveOldLogs.archiveIfOlderDays = 7`
  - Test: Logs > 7 days compressed

- [ ] **Agent Cleanup**: Every 1 hour
  - Verify: `housekeeping.autoCleanup.agentCleanup.frequency = "hourly"`
  - Test: Orphaned processes killed

- [ ] **Port Range Reset**: Every 4 hours
  - Verify: Runs on startup + every 4 hours
  - Test: Unused ports released

- [ ] **State File Compaction**: Weekly @ Sunday 00:00 UTC
  - Verify: `housekeeping.autoCleanup.stateFileCompaction.pruneDays = 7`
  - Test: Old state pruned

### Manual Tasks

- [ ] **Daily: Review Escalations**
  - Task: Check dashboard for ESCALATED tasks
  - Action: Approve or defer as needed

- [ ] **As Needed: Approve PRs**
  - Task: Review diffs before merge
  - Action: Click approve or reject

- [ ] **Weekly: Adjust Thresholds**
  - Task: Tune based on actual performance
  - Action: Update conductor-thresholds.json

- [ ] **Weekly: Token Budget Review**
  - Task: Analyze spending patterns
  - Action: Adjust allocations if needed

---

## Phase 11: Monitoring & Dashboards

- [ ] **Real-Time Metrics Visible**:
  - Active agents count (update every 5s)
  - Pending tasks count (update every 10s)
  - Daily token spend % (update every 30s)
  - Last poll timestamp (update every 10s)
  - Device connectivity (update every 30s)

- [ ] **Log Format**: JSON structured
  - Verify: `monitoring.logFormat = "json"`
  - Includes: timestamp, level, component, event, task_id, agent_id, metadata

- [ ] **Log Level**: INFO (default)
  - Verify: `monitoring.logLevel = "INFO"`
  - Can be adjusted to DEBUG for troubleshooting

- [ ] **Log Retention**: 7 days
  - Verify: `monitoring.logRotationDays = 7`
  - Older logs compressed/archived

---

## Phase 12: Documentation Review

- [ ] **Read CONDUCTOR_CORE_CONFIGURATION.md**
  - Understand: Core loop, state machine, decision tree
  - Time: ~30 minutes

- [ ] **Read CONDUCTOR_THRESHOLDS_AND_PARAMETERS.md**
  - Understand: All numerical thresholds and their rationale
  - Time: ~45 minutes

- [ ] **Read THRESHOLDS_SUMMARY.md**
  - Quick reference for daily operations
  - Time: ~10 minutes

- [ ] **Review conductor-thresholds.json**
  - Machine-readable configuration
  - Verify all values match documentation
  - Time: ~15 minutes

- [ ] **Understand Captain Control Commands**
  - Know: `conductor status`, `conductor force-retry`, `conductor defer`, etc.
  - Time: ~10 minutes

---

## Phase 13: Pre-Production Testing

### Smoke Tests

- [ ] **Poll TaskMaster**: Conductor successfully queries TaskMaster
  - Verify: `polling.pollTimeoutSeconds = 5`
  - Test: Manual poll, confirm response

- [ ] **Spawn Agent**: Agent spawns with correct environment
  - Verify: Port range allocated correctly
  - Verify: Token budget allocated correctly
  - Verify: Timeout configured correctly

- [ ] **Agent Completes**: Agent marks task complete in TaskMaster
  - Verify: Status transitions to GREEN
  - Verify: Tokens deducted from budget
  - Verify: Token spend logged correctly

- [ ] **Quality Gate**: Quality gate check runs automatically
  - Verify: Linting score calculated
  - Verify: Coverage score calculated
  - Verify: Security score calculated

- [ ] **Task Passes**: Task marked DONE after approval
  - Verify: PR created
  - Verify: PR auto-merged or awaits Captain
  - Verify: Task marked DONE in TaskMaster

### Failure Tests

- [ ] **Agent Hangs**: Agent sends no output for 5 min
  - Expected: SIGTERM after 5 min
  - Expected: SIGKILL if still alive after 10s

- [ ] **Agent Timeout**: Compilation exceeds 15 min
  - Expected: Hard timeout triggers
  - Expected: Agent killed
  - Expected: Attempt counter incremented

- [ ] **3 Failures**: Task fails 3× in a row
  - Expected: Task marked ESCALATED
  - Expected: Captain notified
  - Expected: Task waits for Captain action

- [ ] **Token Budget 80%**: Spend reaches 2.4M
  - Expected: Alert fires
  - Expected: Dashboard shows warning
  - Expected: Captain approval required for new tasks

- [ ] **Circuit Breaker**: CPU > 95% for 1 minute
  - Expected: Circuit breaker activates
  - Expected: No new agents spawn
  - Expected: Pending tasks queue (max 10)
  - Expected: Alert sent to Captain

- [ ] **Device Offline**: Device unreachable during OTA
  - Expected: Retry logic kicks in
  - Expected: After 3 retries, escalates
  - Expected: Captain notified

---

## Final Approval

- [ ] **All Phases Complete**: All checklist items checked
- [ ] **Test Results Positive**: All smoke tests and failure tests pass
- [ ] **Documentation Reviewed**: Captain has read all docs
- [ ] **Thresholds Understood**: Captain can explain the 6 critical numbers
- [ ] **Ready to Deploy**: All systems green

**Captain Signature**: _____________________  **Date**: __________

---

## Post-Deployment (Week 1)

After deployment, monitor these metrics during the first week:

- Average agent duration (target: within 20% of estimate)
- Token spend rate (target: 400K-450K/day)
- Escalation rate (target: < 5%)
- Circuit breaker activations (target: 0-1/day)
- Approval workflow time (target: < 5 min average)

Use this data to inform Week 2 calibration adjustments.

---

## Reference

- **Main Config**: conductor-thresholds.json (419 lines, machine-readable)
- **Detailed Docs**: CONDUCTOR_THRESHOLDS_AND_PARAMETERS.md (474 lines, human-readable)
- **Quick Lookup**: THRESHOLDS_SUMMARY.md
- **Operational Spec**: CONDUCTOR_CORE_CONFIGURATION.md (detailed workflow)

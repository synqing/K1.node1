# Conductor Core Configuration: Captain's Operational Specification

**Status**: Proposed (Ready for Captain Review & Approval)
**Owner**: Captain (You)
**Date**: 2025-11-08
**Scope**: Complete workflow orchestration, agent lifecycle, state machines, escalation thresholds

---

## 1. THE CORE LOOP (Execution Model)

### Poll Frequency & State Detection

**Poll Interval**: Every **10 seconds**
- Reason: Balance between responsiveness and API rate limits
- If TaskMaster detects urgent change (red alert), Captain can manually trigger immediate poll
- Optional: Webhook mode (TaskMaster pushes state changes to Conductor) for future optimization

**State Check Sequence**:
```
1. Query TaskMaster: "Get all active tasks + state changes since last_check_time"
2. Parse response: Identify RED → GREEN → COMMIT transitions
3. Compare: current_state vs. stored_state
4. If changed: Execute corresponding decision tree
5. Log: timestamp, old_state, new_state, action_taken
6. Sleep: 10 seconds, repeat
```

### Decision Tree (What Conductor Does on State Change)

```
┌─ Task detected in RED phase
│  ├─ Agent attempt count: 0
│  ├─ Spawn Agent-A (firmware or webapp based on task type)
│  ├─ Allocate port range + token budget
│  ├─ Start 20-minute timeout counter
│  └─ Monitor every 5 seconds for output
│
├─ Task transitions RED → GREEN (subtask complete)
│  ├─ Agent marked success in TaskMaster
│  ├─ Reduce token budget remaining
│  ├─ Continue to next subtask or next phase
│  └─ If no more subtasks: prepare for COMMIT
│
├─ Task transitions to COMMIT phase
│  ├─ Quality gate check (lint, test, security scan)
│  ├─ If pass: Agent creates PR, awaits Captain approval
│  ├─ If fail: Log failure, increment retry counter
│  └─ If retries exhausted: Escalate to Captain
│
├─ Task stuck (no output for 15 minutes)
│  ├─ Kill agent process
│  ├─ Increment attempt counter
│  ├─ If attempts < 3: Retry with new agent + fresh workspace
│  ├─ If attempts >= 3: Escalate to Captain immediately
│  └─ Log: error code, last_output, reason for failure
│
└─ Any other state change
   └─ Log, but don't auto-spawn—wait for explicit Captain approval
```

---

## 2. AGENT LIFECYCLE MANAGEMENT

### Agent Spawn Conditions

**Spawn When**:
- TaskMaster task enters RED phase (auto-spawn, no approval needed)
- Captain explicitly approves a task via dashboard
- Quality gate fails and retry is triggered (auto-spawn with same params)

**Don't Spawn When**:
- Task is already being worked (check for active_agent_id)
- Token budget exhausted for the day
- Resource constraints triggered (see thresholds below)
- Agent backlog > 10 (wait for one to complete)

### Concurrency Limits

**Max Concurrent Agents**: **5 agents**
- Reason: Balance resource usage, prevent overwhelming the device
- Firmware agents: Max 2 (each needs USB/OTA port + compilation time)
- Webapp agents: Max 2 (each needs port range + npm install time)
- Test/Research agents: Max 1 (non-blocking, lower priority)

If 6th agent requested, queue it. When one completes, spawn next in queue.

### Agent Model Routing

| Task Type | Model | Reason |
|-----------|-------|--------|
| Firmware (compile, optimize, validate) | Claude 3.5 Sonnet | Need strong C/C++ reasoning |
| Webapp (UI, logic, integration) | Claude 3.5 Sonnet | Good at web frameworks |
| Test (unit, E2E, validation) | Claude 3.5 Haiku | Fast iteration, lower cost |
| Research (analysis, docs, design) | Claude 3.5 Sonnet | Deep reasoning for complex topics |
| Routine fixes (lint, formatting, minor bugs) | Claude 3.5 Haiku | Sufficient for simple changes |

### Token Budgeting

**Daily Budget**: 3 million tokens (adjust after first week)

**Per-Agent Allocation**:
- Firmware task: 500K tokens (avg: 3 attempts × 150K per attempt)
- Webapp task: 400K tokens (avg: 2-3 attempts)
- Test task: 200K tokens (usually 1 attempt)
- Research task: 300K tokens (can be exploratory)

**Tracking**:
- Deduct tokens as agent uses them
- If agent hits 80% budget before completing: escalate to Captain ("Agent running out of tokens, suggest manual step-in")
- Reset budget daily at UTC 00:00

**Fallback**:
- If daily budget exhausted: Use DeepSeek (local model) for routine fixes only
- Never use local model for critical firmware or security-sensitive changes
- Log every fallback to local model

### Hard Timeouts

**Per-Agent Timeouts**:
- Firmware compile: 15 minutes (hard stop, kill if still running)
- Webapp build: 10 minutes
- Test run: 20 minutes
- Research/analysis: 30 minutes
- Device upload (OTA): 10 minutes

**Implementation**:
- Conductor spawns agent with explicit timeout flag: `AGENT_TIMEOUT_SEC=900`
- Agent wrapped in `timeout` command: `timeout 900 claude-agent ...`
- If timeout exceeded: Kill process, mark as failure, escalate

---

## 3. STATE MACHINE CLARITY

### TaskMaster Task Phases

```
┌─────────────────────────────────────────┐
│  RED phase: Task pending, no agent yet  │
└─────────────┬───────────────────────────┘
              │ Conductor spawns agent
              ↓
┌─────────────────────────────────────────┐
│ WORKING: Agent active, making progress  │
│ (Conductor monitors for output/status)  │
└─────────────┬───────────────────────────┘
              │ Agent completes subtask(s)
              ↓
┌─────────────────────────────────────────┐
│ GREEN phase: Ready for quality checks   │
│ (linting, testing, security scans)      │
└─────────────┬───────────────────────────┘
              │ Quality checks pass
              ↓
┌─────────────────────────────────────────┐
│ COMMIT: PR created, awaits Captain      │
│ (or auto-merge if pre-approved)         │
└─────────────┬───────────────────────────┘
              │ Captain approves + merges
              ↓
┌─────────────────────────────────────────┐
│ DONE: Task complete, archived           │
└─────────────────────────────────────────┘
```

### State Transition Ownership

| Transition | Owned By | Trigger |
|-----------|----------|---------|
| RED → WORKING | Conductor (auto) | Task created in TaskMaster |
| WORKING → GREEN | Conductor (auto) | Agent completes, no errors |
| GREEN → COMMIT | Conductor (auto) | Quality gates pass |
| COMMIT → DONE | Captain (manual) | Captain approves + merges PR |
| Any → FAILED | Conductor (auto) | Max retries exceeded |
| Any → ESCALATED | Conductor (auto) | Timeout, hang, resource limit hit |

**Key Rule**: Conductor drives most transitions automatically. Captain only approves final COMMIT → DONE.

---

## 4. FAILURE & RECOVERY LOGIC

### Retry Strategy

**Attempt Logic**:
```
Attempt 1 fails
  ↓ Kill agent, inspect logs
  ↓ Retry with fresh workspace (no cache)
Attempt 2 fails
  ↓ Kill agent, inspect logs
  ↓ Log detailed error, add to escalation queue
Attempt 3 fails
  ↓ **ESCALATE TO CAPTAIN IMMEDIATELY**
```

**Retry Changes**:
- Attempt 1→2: Clear `node_modules/`, `.pio/`, rebuild from scratch
- Attempt 2→3: Different model (Sonnet → Haiku, or vice versa) to get fresh perspective
- If same error repeats 3x: Don't retry again, escalate

### Escalation Triggers & Captain Notification

**Immediate SMS/Push Alert**:
1. Task failed 3 attempts → "Task FAILED after 3 retries, needs manual review"
2. Agent hung for 20 minutes → "Agent timeout on task XYZ, killed"
3. Critical bug detected (via Sentry) → "CRITICAL: K1 device offline / firmware crash"
4. Device unreachable → "Device 192.168.1.104 unreachable for 10 min"

**Dashboard Alert (non-blocking)**:
1. Token budget 80% exhausted → "Agent running low on tokens"
2. Retry #2 started → "Task retry #2 in progress"
3. Slow progress (> 5 min with no output) → "Agent slow, monitoring..."

**Escalation Handler**:
- Captain receives SMS: "Task K1-50 failed. Reply 'retry', 'abort', or 'investigate' to continue"
- Captain choice: "retry" → spawn new agent; "abort" → mark task FAILED; "investigate" → pause, wait for manual fix

### Dead Letter Queue

**Dead Letter Policy**:
- Failed task does NOT pause other tasks
- Mark task as FAILED in TaskMaster
- Continue to next task in queue
- At end of poll cycle, report all failures to Captain (batch report)

**Dead Letter Cleanup**:
- Logs stored in `ops/logs/dead-letters/TASK_ID.log`
- Keep for 7 days, then archive
- Batch export weekly: "Dead Letter Report: 5 tasks failed this week"

---

## 5. REAL-TIME VISIBILITY & ALERTS

### Alert Types & Channels

| Alert Type | Condition | Channel | Delay |
|-----------|-----------|---------|-------|
| **CRITICAL** | Device offline, firmware crash, security breach | SMS + Push + Dashboard | Immediate |
| **ERROR** | Task failed 3x, agent timeout, quality gate failed | Push + Dashboard | Immediate |
| **WARNING** | Retry #2 started, slow progress, token budget low | Dashboard only | No delay |
| **INFO** | Task started, subtask complete, agent spawned | Log file only | None |

### Captain Dashboard (Mobile/Web)

**Live View**:
- Current agents: 3 active (firmware, webapp, test)
- Task queue: 5 pending tasks
- Status: All green, no alerts

**Expandable Sections**:
1. **Active Agents**
   - Agent-A (firmware): 8 min elapsed, 60% progress, "Compiling RMT driver..."
   - Agent-B (webapp): 5 min, 40% progress
   - Agent-C (test): 2 min, 10% progress

2. **Recent Failures**
   - Task K1-49: Failed (lint error), Attempt 2 running
   - Task K1-47: Failed after 3 attempts, awaiting approval

3. **Queue**
   - K1-51: Pending
   - K1-52: Pending
   - K1-53: Pending

4. **Quick Actions**
   - [ ] Approve PR for K1-50
   - [ ] Retry K1-47 with manual fix
   - [ ] Pause all agents (emergency)

### Reporting

**Real-time Logs** (`ops/logs/conductor.log`):
- Every poll cycle: timestamp, state changes, actions taken
- Per-agent: stdout/stderr captured, searchable

**Daily Summary** (7 AM UTC):
- Tasks started: 5
- Tasks completed: 4
- Tasks failed: 1
- Token spent: 1.2M / 3M
- Agent efficiency: 82%

**Weekly Report** (Monday 9 AM UTC):
- Total tasks: 20
- Success rate: 85%
- Avg retry count: 1.3
- Failed tasks (root causes)
- Cost breakdown (tokens, API calls)
- Captain action items

---

## 6. INTEGRATION ARCHITECTURE

### Component Diagram

```
┌──────────────────────────────────────────────────────────┐
│  CAPTAIN (You)                                           │
│  ├─ Mobile/Web Dashboard                                │
│  └─ Manual approvals, emergency controls                │
└────────────────────┬─────────────────────────────────────┘
                     │ SMS, push, approvals
                     ↓
┌──────────────────────────────────────────────────────────┐
│  CONDUCTOR (Orchestrator) — Core Loop                   │
│  ├─ Poll TaskMaster every 10s                          │
│  ├─ Spawn agents on state changes                       │
│  ├─ Monitor agent progress & timeouts                   │
│  ├─ Handle failures & retries                           │
│  ├─ Track token budget & resources                      │
│  └─ Push alerts & updates to Captain                    │
└────────┬──────────────────────────────────┬─────────────┘
         │                                  │
         │ TaskMaster MCP                   │ Agent API
         ↓                                  ↓
┌──────────────────────┐    ┌──────────────────────────────┐
│  TASKMASTER          │    │  CLAUDE AGENTS               │
│  ├─ Task queue       │    │  ├─ Firmware agents (Sonnet) │
│  ├─ State machine    │    │  ├─ Webapp agents (Sonnet)   │
│  ├─ Progress tracker │    │  ├─ Test agents (Haiku)      │
│  └─ MCP interface    │    │  └─ Workspace + git mgmt     │
└──────────┬───────────┘    └──────────────┬───────────────┘
           │                               │
           │ Task definitions              │ Spawn, monitor,
           ↓                               │ kill processes
┌──────────────────────┐                   │
│  TaskMaster DB       │                   │
│  ├─ Tasks            │                   │
│  ├─ State history    │                   ↓
│  └─ Assignments      │        ┌──────────────────────────┐
└──────────────────────┘        │  GIT REPOS               │
                                │  ├─ firmware/            │
                                │  ├─ webapp/              │
                                │  └─ Agent worktrees      │
                                └──────────────────────────┘
           │
           ├─→ External APIs (GitHub, Sentry, Notion)
           └─→ Device API (K1 at 192.168.1.104)
```

### Data Flow

1. **Task Created** → TaskMaster stores it (RED phase)
2. **Conductor polls** → Detects RED → Spawns agent
3. **Agent works** → Makes git commits, logs progress
4. **Agent completes** → Calls TaskMaster MCP to mark GREEN
5. **Conductor polls** → Sees GREEN → Runs quality gates
6. **Quality gates pass** → Conductor calls TaskMaster to mark COMMIT
7. **Conductor alerts Captain** → "Ready for approval: Task K1-50"
8. **Captain approves** → TaskMaster marks DONE
9. **Conductor continues** → Next task in queue

### Monitoring Layer

**What Watches Agents**:
- Conductor process itself (polls, checks for output, enforces timeouts)
- System monitor (check CPU, memory, disk space)
- Device monitor (ping K1 device every 30s)

**Metrics Collected**:
- Agent uptime, output frequency, token usage
- Device connectivity, API response times
- Task success rate, failure reasons
- Queue depth, wait times

---

## 7. ESCALATION THRESHOLDS & DECISION RULES

### Failure Thresholds

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Task failed attempts | 3 attempts | Escalate to Captain |
| Agent hangs (no output) | 15 minutes | Kill + retry (up to 3) |
| Quality gate failures | 2 consecutive fails | Escalate to Captain |
| Token budget exceeded | 80% of budget | Alert Captain |
| Token budget fully spent | 100% | Use DeepSeek fallback or escalate |

### Resource Constraints

| Resource | Limit | Action |
|----------|-------|--------|
| Concurrent agents | 5 agents max | Queue additional agents |
| Concurrent firmware agents | 2 max | Block 3rd firmware agent |
| CPU usage | > 80% for 5 min | Pause new agents, continue existing |
| Memory usage | > 90% | Pause new agents, monitor |
| Disk space | < 1 GB free | Alert Captain, stop new builds |

### Circuit Breaker (Hard Pause)

**If ANY of these trigger, pause all agents:**
1. Device offline for > 10 minutes
2. GitHub API down (503) for > 5 minutes
3. TaskMaster unavailable for > 5 minutes
4. 3 critical task failures in 1 hour
5. Captain manually triggers emergency stop

**Resume When**:
- Service restored + Captain approves
- OR Captain manually overrides

---

## 8. APPROVAL WORKFLOW FOR NEW TASKS

### Task Detection & Notification

**Conductor Detects**:
- New task created in TaskMaster: "Phase 2 ready to start"
- Quality gate: Task passed all checks, ready for merge
- Captain approval needed for code review / final approval

**Notification to Captain**:
```
📱 PUSH: "Task K1-51 Ready for Approval"
Dashboard shows:
  - Task: Add Aurora pattern
  - Agent: Completed code
  - Status: All quality gates passed
  - Action: [ Approve ] [ Request Changes ] [ Reject ]
```

### Approval & Bootstrap Sequence

**Step 1: Captain Reviews** (via Dashboard)
- See diff: what changed
- See tests: did they pass
- See logs: agent's thought process
- Decision: Approve or request changes

**Step 2: Captain Approves** (1 tap)
- Dashboard sends approval to TaskMaster
- TaskMaster updates task state: COMMIT → DONE

**Step 3: Conductor Sees DONE State** (next poll, 10s max)
- Agent PR merged to main
- Agent workspace cleaned up
- Task archived
- Next task spawned if in queue

**Bootstrap Sequence** (for new tasks, before spawning agent):
```
1. Clone/update git repo
2. Checkout new branch (agent-k1-51-aurora)
3. Create .env file
4. Run preflight checks (Node, PlatformIO, etc.)
5. Install dependencies (npm ci, pio pkg install)
6. Verify device is reachable
7. Spawn agent (now ready to start work)
```

### Approval Loop Speed

**Target**: 30 seconds from Captain approval to next agent spawning
- Approval → TaskMaster update: < 1s
- Conductor next poll: < 10s
- Bootstrap sequence: 10-20s
- Agent spawned: < 30s total

---

## 9. COST & RESOURCE CONSTRAINTS

### Token Budget

**Daily Allocation**: 3 million tokens
- Monitor spend in real-time
- Alert at 80% ($X.XX cost)
- Block new non-critical agents at 95%

**Cost Tracking**:
- Log every agent spawn + token usage
- Daily report: "Spent 1.2M tokens today ($Y.YY)"
- Weekly summary: "Avg $Z per task"

**Budget Reset**: Midnight UTC daily

### Fallback to Local Models

**When to Use DeepSeek (local)**:
- Daily token budget exhausted
- Routine lint/format fixes only
- Never for: firmware, security, production changes
- Always escalate critical work to Captain

**When to Use Claude (API)**:
- All firmware work
- All security-related changes
- All production deployments
- Complex problem-solving
- First attempts at new task types

### Spend Reporting

**Daily**: "Tokens: 1.2M / 3M, Cost: $X.XX"
**Weekly**: "Total: 8.4M tokens, Cost: $Y.YY, Avg per task: $Z"
**Monthly**: Summary + trend analysis

---

## 10. TRIGGER EVENTS & EVENT HANDLERS

### State Change Events

| Event | Source | Handler |
|-------|--------|---------|
| Task created (RED) | TaskMaster | Conductor spawns agent |
| Agent output received | Agent | Reset timeout counter, log progress |
| Agent completes subtask | Agent | Call TaskMaster to mark GREEN |
| Quality gate passes | Conductor | Call TaskMaster to mark COMMIT, alert Captain |
| Quality gate fails | Conductor | Increment failure counter, retry or escalate |
| Agent timeout (> 15 min no output) | Conductor | Kill process, increment attempt, retry or escalate |
| Task marked DONE | TaskMaster | Conductor archives workspace, marks complete |
| Captain approves | Dashboard → TaskMaster | Mark DONE, cleanup, next task |
| Captain rejects | Dashboard → TaskMaster | Mark NEEDS_REVISION, pause agent |

### Error Event Handlers

| Error | Handler |
|-------|---------|
| Device offline | Alert Captain, pause firmware tasks, queue others |
| Git conflict | Escalate to Captain with conflict details |
| Quality gate failure (lint) | Auto-fix if simple, or escalate |
| Quality gate failure (test) | Escalate to Captain |
| Sentry alert (critical) | Immediate SMS to Captain |
| Agent runs out of tokens | Escalate to Captain |
| Retry limit exceeded | Escalate to Captain with logs |

---

## QUICK REFERENCE: CAPTAIN CONTROLS

### Emergency Commands

```bash
# Pause all agents
conductor pause-all

# Resume agents
conductor resume-all

# Kill specific agent
conductor kill <AGENT_ID>

# View live logs
conductor logs --follow

# Force poll TaskMaster now
conductor poll-now

# Approve task
conductor approve <TASK_ID>

# Reject task + request changes
conductor reject <TASK_ID> "Message to agent"

# Check token budget
conductor tokens --status
```

### Dashboard Quick View

```
[Live Status]
Active: 3 agents | Queued: 5 tasks | Alerts: 0

[Current Agents]
🟢 firmware-K1-50: 8 min, 60% progress
🟢 webapp-K1-51: 5 min, 40% progress
🟢 test-K1-49: 2 min, 10% progress

[Pending Approval]
📋 K1-50 (Aurora pattern) - Ready to merge
[ Approve ] [ Request Changes ]

[Recent Failures]
❌ K1-49: Lint error (Attempt 2 running)
```

---

## NEXT STEPS

1. **Captain Review**: Read & approve this configuration
2. **Thresholds Tuning**: Adjust poll frequency, timeouts, concurrency after first week
3. **Implementation**: Build Conductor core loop (Phase 1)
4. **Testing**: Run with one task, iterate on feedback
5. **Scaling**: Scale to 5+ concurrent agents once stable

---

**Configuration Version**: 1.0
**Status**: Ready for Captain Approval
**Last Updated**: 2025-11-08

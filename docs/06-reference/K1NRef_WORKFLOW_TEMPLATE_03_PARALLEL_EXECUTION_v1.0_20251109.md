# Workflow Template 3: Parallel Execution

**Status:** Production Ready
**Created:** 2025-11-09
**Version:** 1.0
**Template ID:** template-03-parallel-execution
**Use Case:** Execute multiple independent tasks concurrently

---

## Overview

This template demonstrates **concurrent execution of independent tasks**: Tasks 4, 5, 6, 7 all running in parallel without blocking dependencies. Perfect for:
- Validating parallel execution capability
- Testing resource utilization under concurrent load
- Demonstrating efficiency vs. sequential execution
- Running independent agents simultaneously

**Execution Time:** ~13-20 minutes (all 4 tasks in parallel, max ~13 min)
**Complexity:** Intermediate
**Success Criteria:** All 4 tasks complete concurrently, no bottlenecks, quality gates pass

**Efficiency Gain:** 4 tasks in ~13 minutes (parallel) vs. ~40 minutes (sequential) = **3x speedup**

---

## Human Interaction (Claude Desktop)

### Step 1: Invoke the Workflow
User opens Claude Desktop and issues:

```
Execute Tasks 4, 5, 6, and 7 in parallel (no dependencies).
These are independent security, testing, architecture, and pattern tasks.
Show me real-time progress for all 4 tasks.
```

### Step 2: Expected Claude Response
Claude should:
1. Recognize all 4 tasks are independent
2. Call `execute_conductor_workflow` MCP tool with `task_ids=[4, 5, 6, 7]` and `parallel=true`
3. Receive a `workflow_execution_id` (e.g., "workflow-parallel-4567")
4. Poll `get_conductor_workflow_status` every 5 seconds
5. Report real-time progress showing all 4 tasks running concurrently

**Sample Claude Response:**
```
I'll execute Tasks 4, 5, 6, 7 in parallel. All tasks are independent,
so they can run concurrently for maximum efficiency.

Starting Parallel Workflow
Workflow ID: workflow-parallel-4567-001

🚀 Task 4 (TestingAgent): START → Running
🚀 Task 5 (SecurityAgent): START → Running
🚀 Task 6 (ArchitectureAgent): START → Running
🚀 Task 7 (CodeGenAgent): START → Running

All 4 tasks launched simultaneously (t=0s)

[Progress every 30 seconds...]

t=30s   Task 4: 35% | Task 5: 28% | Task 6: 42% | Task 7: 15%
t=60s   Task 4: 62% | Task 5: 51% | Task 6: 75% | Task 7: 38%
t=90s   Task 4: 85% | Task 5: 72% | Task 6: 92% | Task 7: 64%

✅ Task 6 Complete! (Architecture, 8m 34s)
✅ Task 4 Complete! (Testing, 10m 22s)
✅ Task 7 Complete! (Pattern, 11m 58s)
✅ Task 5 Complete! (Security, 13m 14s)

All tasks complete!

Parallel Workflow Summary:
- Total tasks executed: 4
- Execution mode: Parallel (all concurrent)
- Slowest task: Task 5 (Security) - 13m 14s
- Parallel efficiency: (4 × 10.5 avg) / 13.2 actual = 3.18x speedup
- Total quality gates passed: 56/60 (93.3%)
- Combined output: 180+ KB

Performance Breakdown:
├─ Task 4 (Testing): 10m 22s
├─ Task 5 (Security): 13m 14s ← Slowest (critical path)
├─ Task 6 (Architecture): 8m 34s
└─ Task 7 (Pattern): 11m 58s

Workflow Time (if sequential): ~44 minutes
Workflow Time (actual parallel): 13m 14s
Time Saved: 30m 46s (70% reduction)
```

### Step 3: Human Reviews Results
User examines:
- All 4 tasks completed concurrently
- No task blocked another
- Parallel efficiency metrics
- Individual task results
- Quality gate status for all 4 tasks

---

## Workflow Definition (YAML)

```yaml
name: template-03-parallel-execution
description: Execute 4 independent tasks concurrently
version: 1.0
metadata:
  type: parallel
  complexity: intermediate
  estimated_duration_minutes: 15
  agents: [TestingAgent, SecurityAgent, ArchitectureAgent, CodeGenAgent]
  task_sequence: [4, 5, 6, 7]
  parallelization: true

tasks:
  - task_id: 4
    name: Testing Framework
    description: Test framework and quality assurance
    type: system_task
    agent_type: TestingAgent
    timeout_seconds: 900
    depends_on: []
    parameters:
      task_name: "Testing Framework"
      agent_type: "TestingAgent"
    quality_gates:
      - test_coverage: ">= 95%"
      - test_pass_rate: "100%"
      - performance_acceptable: true

  - task_id: 5
    name: Security Hardening
    description: Security vulnerability scanning and fixes
    type: system_task
    agent_type: SecurityAgent
    timeout_seconds: 900
    depends_on: []
    parameters:
      task_name: "Security Hardening"
      agent_type: "SecurityAgent"
    quality_gates:
      - security_score: ">= 90/100"
      - vulnerabilities: "== 0"
      - compliance: required

  - task_id: 6
    name: Architecture Review
    description: System architecture analysis and validation
    type: system_task
    agent_type: ArchitectureAgent
    timeout_seconds: 900
    depends_on: []
    parameters:
      task_name: "Architecture Review"
      agent_type: "ArchitectureAgent"
    quality_gates:
      - coverage_threshold: ">= 90%"
      - security_score: ">= 85/100"
      - documentation: required

  - task_id: 7
    name: Pattern Library
    description: Generate pattern library for reusable components
    type: system_task
    agent_type: CodeGenAgent
    timeout_seconds: 900
    depends_on: []
    parameters:
      task_name: "Pattern Library"
      agent_type: "CodeGenAgent"
    quality_gates:
      - patterns_generated: ">= 10"
      - documentation: required
      - test_coverage: ">= 80%"

# Execution mode: parallel (all tasks start immediately)
execution:
  mode: parallel
  parallel_allowed: true
  parallelization_factor: 4
  wait_for_all: true
  timeout_seconds: 1200

# No dependencies between tasks
dependencies: []

# Polling configuration
polling:
  strategy: active
  interval_seconds: 5
  max_attempts: 240
  timeout_seconds: 1200

# Workflow success criteria
success_criteria:
  - all_tasks_completed
  - no_task_blocked_by_another
  - total_time < 1200
  - parallel_efficiency >= 2.5

# Error handling for parallel execution
error_handling:
  one_task_failure:
    action: continue
    message: "One task failed, but others continue"
    retry_allowed: true
  all_tasks_failed:
    action: fail
    message: "All tasks failed"
```

---

## Standalone Executable Workflow

If invoking directly via Conductor API:

```bash
# Execute all 4 tasks in parallel
curl -X POST http://localhost:8080/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "template-03-parallel-execution",
    "version": 1,
    "tasks": [
      {
        "name": "task-4-testing",
        "taskReferenceName": "task_4",
        "type": "SIMPLE",
        "inputParameters": {
          "task_id": 4
        }
      },
      {
        "name": "task-5-security",
        "taskReferenceName": "task_5",
        "type": "SIMPLE",
        "inputParameters": {
          "task_id": 5
        }
      },
      {
        "name": "task-6-architecture",
        "taskReferenceName": "task_6",
        "type": "SIMPLE",
        "inputParameters": {
          "task_id": 6
        }
      },
      {
        "name": "task-7-pattern",
        "taskReferenceName": "task_7",
        "type": "SIMPLE",
        "inputParameters": {
          "task_id": 7
        }
      }
    ],
    "schemaVersion": 2
  }'

# All 4 tasks execute simultaneously
# Each task runs independently on separate agent processes
# Total time = max(task_4, task_5, task_6, task_7) durations
```

---

## Quality Gates Validation

All 4 tasks validate their respective quality gates:

| Task | Agent | Gate | Threshold | Status |
|------|-------|------|-----------|--------|
| 4 | Testing | Test Coverage | ≥95% | Pass |
| 4 | Testing | Test Pass Rate | 100% | Pass |
| 4 | Testing | Performance | Acceptable | Pass |
| 5 | Security | Security Score | ≥90/100 | Pass |
| 5 | Security | Vulnerabilities | 0 critical | Pass |
| 5 | Security | Compliance | Required | Pass |
| 6 | Architecture | Code Coverage | ≥90% | Pass |
| 6 | Architecture | Security Score | ≥85/100 | Pass |
| 6 | Architecture | Documentation | Required | Pass |
| 7 | CodeGen | Patterns Generated | ≥10 | Pass |
| 7 | CodeGen | Documentation | Required | Pass |
| 7 | CodeGen | Test Coverage | ≥80% | Pass |

**Expected Outcome:** 54-58/60 gates pass (90-97% pass rate)

---

## Parallel Execution Timeline

```
Timeline (Parallel Mode):

t=0s    Start Task 4 ─────────────────────────── Complete (622s)
        Start Task 5 ─────────────────────────────── Complete (794s)
        Start Task 6 ──────────────────────── Complete (514s)
        Start Task 7 ───────────────────────────── Complete (718s)

t=514s  Task 6 complete ✓
t=622s  Task 4 complete ✓
t=718s  Task 7 complete ✓
t=794s  Task 5 complete ✓ (critical path)

Workflow Complete!
Total: 794s = 13 minutes 14 seconds

If Sequential:
Task 4 (622s) + Task 5 (794s) + Task 6 (514s) + Task 7 (718s) = 2648s = 44 minutes 8 seconds

Efficiency Gain: 44m 8s / 13m 14s = 3.32x faster with parallelization
```

---

## Error Scenarios & Recovery

### Scenario 1: One Task Fails (e.g., Task 5 Security)
**Behavior:**
- Tasks 4, 6, 7 continue executing
- Task 5 fails but doesn't block others
- Workflow completes with partial results

**Recovery:**
1. Claude reports: "Task 5 (Security) failed, but Tasks 4, 6, 7 completed"
2. User can review Task 4, 6, 7 results (97% of workflow useful)
3. User can retry Task 5 separately
4. No cascading failures since no dependencies

### Scenario 2: Resource Contention
**Behavior:**
- 4 tasks consume: 4 × 100MB = 400MB memory, high CPU load
- If system runs out of memory, one or more tasks may timeout

**Recovery:**
1. Run fewer tasks in parallel (e.g., 2 instead of 4)
2. Increase system resources (more RAM, CPU)
3. Monitor resource usage: `top`, `free -h`

### Scenario 3: Network Timeout During Polling
**Behavior:**
- Loss of connection to Conductor doesn't affect running tasks
- Tasks continue; polling restarts when connection restored

**Recovery:**
1. Connection automatically retried
2. Polling resumes and detects task completions
3. If connection lost >5 min, report as degraded

### Scenario 4: Slow Task Becomes Bottleneck
**Scenario:** Task 5 takes 13+ minutes while others complete in 8-10 minutes
**Impact:** Overall workflow time = max task time (13m)
**Solution:** Optimize Task 5 or move independent work to other tasks

---

## Usage Instructions

### Via Claude Desktop (Recommended)

**Step 1:** Open Claude Desktop

**Step 2:** Issue this prompt:
```
Execute Tasks 4, 5, 6, and 7 in parallel (no dependencies).
These are independent security, testing, architecture, and pattern tasks.
Show me real-time progress for all 4 tasks.
```

**Step 3:** Claude uses MCP tools:
- `execute_conductor_workflow` → Start all 4 concurrently
- `get_conductor_workflow_status` → Poll every 5s
- Returns results for all 4 when complete

**Expected Duration:** ~13-20 minutes (vs. ~44 minutes sequential)

---

### Via CLI (Testing/Validation)

For automated testing:

```bash
./tests/validate_template_03_parallel_execution.sh
```

This script:
1. Launches all 4 tasks simultaneously
2. Monitors all 4 tasks with separate polling threads
3. Validates no task blocked another
4. Collects parallel efficiency metrics
5. Generates test report with timing analysis

**Output:** `test-results/template-03-parallel-execution-results.json`

---

## Performance Characteristics

**Baseline (Tasks 4, 5, 6, 7 Parallel)**

| Metric | Value | Notes |
|--------|-------|-------|
| Task 4 Duration | 10-11 min | Testing |
| Task 5 Duration | 13-15 min | Security (slowest) |
| Task 6 Duration | 8-9 min | Architecture |
| Task 7 Duration | 11-12 min | Pattern |
| Workflow Total | ~13-15 min | Parallel (bottleneck = Task 5) |
| Sequential Total | ~42-48 min | If run one after another |
| Speedup Factor | 3.0-3.5x | Parallel / Sequential |
| Memory Usage | 400-500 MB | All 4 agents running |
| CPU Load | High | All 4 cores active |
| Polling Overhead | <2% CPU | Background monitoring |

**Parallel Efficiency Formula:**
```
Speedup = (Sum of individual times) / (Actual parallel time)
        = (622 + 794 + 514 + 718) / 794
        = 2648 / 794
        = 3.33x faster
```

---

## Resource Requirements

For optimal parallel execution:

| Resource | Minimum | Recommended | Notes |
|----------|---------|-------------|-------|
| RAM | 2 GB | 4+ GB | 4 agents × 100MB each |
| CPU Cores | 4 | 8+ | One core per task + overhead |
| Disk Space | 500 MB | 1+ GB | Result files + temp space |
| Network | 10 Mbps | 100 Mbps | Polling traffic negligible |

---

## Troubleshooting Checklist

- [ ] All 4 tasks started simultaneously? (Check timestamps)
- [ ] No task waiting for another? (Confirm no dependencies)
- [ ] All 4 result files created? `.conductor/task-results/task-{4,5,6,7}.json`
- [ ] Actual time ~13-15 minutes? (Not 40+ minutes, which would indicate sequential)
- [ ] Resource constraints? (Check `top` or `free` if slowdown observed)
- [ ] Quality gates validated for all 4 tasks?
- [ ] Slowest task (bottleneck) identified? (Should be Task 5 typically)

---

## Comparison: Sequential vs. Parallel

| Aspect | Sequential | Parallel |
|--------|-----------|----------|
| **Order** | Task 4 → 5 → 6 → 7 | All start together |
| **Total Time** | 44 minutes | 13 minutes |
| **Speedup** | 1.0x | 3.3x |
| **Memory** | ~100 MB | ~500 MB |
| **CPU Load** | Low | High |
| **Blocked Time** | 41 minutes | 0 minutes |
| **One Failure** | Stops workflow | Others continue |
| **Efficiency** | Simple, slow | Complex, fast |
| **Use Case** | Dependencies required | Independent tasks |

---

## Related Templates

- **Template 1:** Single Task Execution (Task 1: Security)
- **Template 2:** Dependency Chain (Task 6→7→8)
- **Template 4:** Full 22-Task Orchestration

---

## Document Control

- **Type:** K1N Workflow Template (KNRef)
- **Status:** Ready for Production
- **Version:** 1.0
- **Location:** `docs/06-reference/`
- **Test Script:** `tests/validate_template_03_parallel_execution.sh`
- **YAML Spec:** `.conductor/workflows/template_03_parallel_execution.yaml`
- **Last Updated:** 2025-11-09

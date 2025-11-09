# Workflow Template 2: Dependency Chain

**Status:** Production Ready
**Created:** 2025-11-09
**Version:** 1.0
**Template ID:** template-02-dependency-chain
**Use Case:** Execute multiple tasks sequentially with blocking dependencies

---

## Overview

This template demonstrates **sequential task execution with dependencies**: Task 6 (Architecture) → Task 7 (Pattern Recognition) → Task 8 (Code Generation), with each task blocked until its predecessor completes.

Perfect for:
- Validating dependency enforcement
- Testing sequential workflows
- Integration testing across agents
- Ensuring quality gates pass before proceeding
- Real-world development pipelines

**Execution Time:** ~25-40 minutes (3 tasks × ~8-13 min each)
**Complexity:** Intermediate
**Success Criteria:** All 3 tasks complete in order, all dependencies satisfied, quality gates pass

---

## Human Interaction (Claude Desktop)

### Step 1: Invoke the Workflow
User opens Claude Desktop and issues:

```
Execute the architecture→pattern→codegen pipeline (Tasks 6, 7, 8).
Execute them sequentially - Task 6 must complete before Task 7 starts,
and Task 7 must complete before Task 8 starts.
Show me progress as each task completes.
```

### Step 2: Expected Claude Response
Claude should:
1. Recognize the dependency chain
2. Call `execute_conductor_workflow` MCP tool with `task_ids=[6, 7, 8]` and `sequential=true`
3. Receive a `workflow_execution_id` (e.g., "workflow-arch-pattern-codegen")
4. Poll `get_conductor_workflow_status` every 5 seconds
5. Report progress for each task in real-time

**Sample Claude Response:**
```
I'll execute the architecture→pattern→codegen pipeline with proper sequencing.

Starting Dependency Chain Workflow
Workflow ID: workflow-arch-pattern-codegen-001

📍 Task 6: Architecture Analysis (ArchitectureAgent)
Status: IN_PROGRESS
Started: 2025-11-09 14:23:45
Estimated time: 10 minutes

[5 minutes elapsed]
Status update: Task 6 running (52% complete)

[10 minutes elapsed]
✅ Task 6 Complete!
Results: Architecture analysis completed
Quality Gates: 15/15 passed
Duration: 9m 34s

────────────────────────────────────────

📍 Task 7: Pattern Recognition (CodeGenAgent)
Status: IN_PROGRESS
Started: 2025-11-09 14:33:19
Estimated time: 8 minutes

[5 minutes elapsed]
Status update: Task 7 running (38% complete)

[8 minutes elapsed]
✅ Task 7 Complete!
Results: Pattern library generated
Quality Gates: 14/15 passed (coverage 88% < 90%)
Duration: 8m 12s

────────────────────────────────────────

📍 Task 8: Code Generation (CodeGenAgent)
Status: IN_PROGRESS
Started: 2025-11-09 14:41:31
Estimated time: 12 minutes

[6 minutes elapsed]
Status update: Task 8 running (44% complete)

[12 minutes elapsed]
✅ Task 8 Complete!
Results: Generated 47 code files, 2300 LOC
Quality Gates: 14/15 passed (lint warnings: 2)
Duration: 12m 08s

────────────────────────────────────────

✅ Workflow Complete!

Summary:
- Total tasks executed: 3
- All tasks completed successfully
- Total execution time: 29m 54s
- Total quality gates passed: 43/45 (95.6%)
- Bottleneck: Task 8 code generation (12m)
- Recommendation: Task 8 could run in parallel with Task 7 if dependencies allow
```

### Step 3: Human Reviews Results
User examines:
- Dependency enforcement (Tasks executed in order)
- Individual task results (output, timing, gates)
- Overall workflow completion time
- Quality gate pass rate

---

## Workflow Definition (YAML)

```yaml
name: template-02-dependency-chain
description: Execute 3 tasks sequentially with blocking dependencies
version: 1.0
metadata:
  type: dependency_chain
  complexity: intermediate
  estimated_duration_minutes: 40
  agents: [ArchitectureAgent, CodeGenAgent]
  task_sequence: [6, 7, 8]

tasks:
  - task_id: 6
    name: Architecture Analysis
    description: Analyze system architecture and design patterns
    type: system_task
    agent_type: ArchitectureAgent
    timeout_seconds: 900
    depends_on: []
    parameters:
      task_name: "Architecture Analysis"
      agent_type: "ArchitectureAgent"
    quality_gates:
      - coverage_threshold: 90
      - security_score: 85
      - lint_warnings: 0
      - documentation: required

  - task_id: 7
    name: Pattern Recognition
    description: Generate pattern library based on architecture
    type: system_task
    agent_type: CodeGenAgent
    timeout_seconds: 900
    depends_on: [6]
    parameters:
      task_name: "Pattern Recognition"
      agent_type: "CodeGenAgent"
      input_from_task: 6
    quality_gates:
      - coverage_threshold: 90
      - complexity_score: acceptable
      - patterns_generated: ">= 10"

  - task_id: 8
    name: Code Generation
    description: Generate source code from patterns
    type: system_task
    agent_type: CodeGenAgent
    timeout_seconds: 1200
    depends_on: [7]
    parameters:
      task_name: "Code Generation"
      agent_type: "CodeGenAgent"
      input_from_task: 7
      output_format: "module"
    quality_gates:
      - coverage_threshold: 85
      - lint_warnings: "<= 5"
      - test_pass_rate: ">= 95%"

# Execution mode: sequential (one after another)
execution:
  mode: sequential
  parallel_allowed: false
  wait_for_completion: true
  timeout_seconds: 3600

# Dependency enforcement
dependencies:
  - task: 7
    requires: [6]
    blocking: true
    timeout_if_blocked: 1200
  - task: 8
    requires: [7]
    blocking: true
    timeout_if_blocked: 1200

# Polling configuration
polling:
  strategy: active
  interval_seconds: 5
  max_attempts: 720
  timeout_seconds: 3600

# Workflow completion criteria
success_criteria:
  - all_tasks_completed
  - execution_order == [6, 7, 8]
  - task_6_status == "COMPLETED"
  - task_7_status == "COMPLETED"
  - task_8_status == "COMPLETED"
  - total_time < 3600

# Error handling with dependency awareness
error_handling:
  task_failure:
    action: stop_workflow
    message: "Task failed, blocking dependent tasks"
    retry_allowed: true
    max_retries: 1
  task_timeout:
    action: fail
    message: "Task exceeded timeout, blocking dependents"
    retry_allowed: false
  dependency_timeout:
    action: fail
    message: "Dependent task blocked for too long"
    max_wait: 1200
```

---

## Standalone Executable Workflow (For Direct Conductor Use)

If invoking directly via Conductor API (not through Claude Desktop):

```bash
# 1. Execute workflow with dependency specification
curl -X POST http://localhost:8080/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "template-02-dependency-chain",
    "version": 1,
    "tasks": [
      {
        "name": "task-6-architecture",
        "taskReferenceName": "task_6",
        "type": "SIMPLE",
        "inputParameters": {
          "task_id": 6,
          "task_name": "Architecture Analysis"
        }
      },
      {
        "name": "task-7-pattern",
        "taskReferenceName": "task_7",
        "type": "SIMPLE",
        "inputParameters": {
          "task_id": 7,
          "task_name": "Pattern Recognition",
          "input_from_task": 6
        },
        "inputPath": "task_6.output"
      },
      {
        "name": "task-8-codegen",
        "taskReferenceName": "task_8",
        "type": "SIMPLE",
        "inputParameters": {
          "task_id": 8,
          "task_name": "Code Generation",
          "input_from_task": 7
        },
        "inputPath": "task_7.output"
      }
    ],
    "schemaVersion": 2
  }'

# 2. Poll workflow status with dependency tracking
curl http://localhost:8080/api/workflows/{executionId}

# Expected output shows sequential execution:
# task_6: COMPLETED (t=0-540s)
# task_7: PENDING → IN_PROGRESS (t=540-1032s, waits for task_6)
# task_8: PENDING → IN_PROGRESS (t=1032-1760s, waits for task_7)
```

---

## Quality Gates Validation

All 3 tasks validate these gates:

| Task | Gate | Threshold | Impact |
|------|------|-----------|--------|
| 6 (Architecture) | Code Coverage | ≥90% | FAIL if not met |
| 6 (Architecture) | Security Score | ≥85/100 | FAIL if not met |
| 6 (Architecture) | Lint Warnings | 0 critical | FAIL if critical |
| 6 (Architecture) | Documentation | Required | FAIL if missing |
| 7 (Pattern) | Code Coverage | ≥90% | FAIL if not met |
| 7 (Pattern) | Complexity Score | Acceptable | WARN if exceeded |
| 7 (Pattern) | Patterns Generated | ≥10 | FAIL if not met |
| 8 (CodeGen) | Code Coverage | ≥85% | FAIL if not met |
| 8 (CodeGen) | Lint Warnings | ≤5 | WARN if exceeded |
| 8 (CodeGen) | Test Pass Rate | ≥95% | WARN if not met |

**Expected Outcome:** ~42-43/45 gates pass (93-96% pass rate)

---

## Error Scenarios & Recovery

### Scenario 1: Task 6 Timeout
**Recovery:**
1. Claude reports: "Task 6 (Architecture) timed out after 15 minutes"
2. Tasks 7 and 8 are automatically blocked
3. User can retry Task 6 or move on
4. If Task 6 retried and completes, Task 7 can then start

### Scenario 2: Task 7 Fails (Dependency Chain Breaks)
**Recovery:**
1. Claude reports: "Task 7 failed; Task 8 cannot proceed (blocked by failed dependency)"
2. Task 8 remains PENDING, waiting for Task 7 to complete
3. User can retry Task 7 or skip to another workflow
4. If Task 7 retried and succeeds, Task 8 automatically starts

### Scenario 3: Quality Gate Failure in Task 6
**Recovery:**
1. Task 6 completes but quality gate fails (e.g., coverage 82% < 90%)
2. Task 7 is NOT blocked—it proceeds (gate failure ≠ task failure)
3. Claude reports: "Task 6 completed with gate failures: coverage too low"
4. User can accept results or send Task 6 back for improvement

### Scenario 4: Network Timeout During Task 7
**Recovery:**
1. Claude retries polling up to 3 times with backoff
2. If network restores, Task 7 continues
3. If persistent, Claude reports: "Lost connection to Conductor server"
4. User should verify: `curl http://localhost:8080/api/health`

---

## Usage Instructions

### Via Claude Desktop (Recommended)

**Step 1:** Open Claude Desktop

**Step 2:** Issue this prompt:
```
Execute the architecture→pattern→codegen pipeline (Tasks 6, 7, 8).
Execute them sequentially - Task 6 must complete before Task 7 starts,
and Task 7 must complete before Task 8 starts.
Show me progress as each task completes.
```

**Step 3:** Claude uses MCP tools:
- `execute_conductor_workflow` → Start with dependencies
- `get_conductor_workflow_status` → Poll every 5s
- Returns results for all 3 tasks when complete

**Expected Duration:** ~25-40 minutes

---

### Via CLI (Testing/Validation)

For automated testing:

```bash
./tests/validate_template_02_dependency_chain.sh
```

This script:
1. Executes Task 6, polls for completion
2. Executes Task 7 only after Task 6 completes
3. Executes Task 8 only after Task 7 completes
4. Validates dependency enforcement
5. Collects timing and quality gate data
6. Generates test report

**Output:** `test-results/template-02-dependency-chain-results.json`

---

## Performance Characteristics

**Baseline (Tasks 6→7→8)**

| Metric | Value | Notes |
|--------|-------|-------|
| Task 6 Duration | 9-11 min | Architecture analysis |
| Task 7 Duration | 8-10 min | Pattern generation (input: Task 6) |
| Task 8 Duration | 11-14 min | Code generation (input: Task 7) |
| Workflow Total | 28-35 min | Sequential (no parallelization) |
| Polling Overhead | <1% CPU | Every 5s, lightweight |
| Idle Wait Time | 0 | Task 7/8 blocked until deps ready |
| Memory Usage | <150 MB | All 3 agent processes) |

**Dependency Enforcement:** Tasks 7 and 8 will NOT start until predecessors complete, even if user tries to invoke them directly.

---

## Dependency Blocking Illustration

```
Timeline:
t=0s       Start Task 6 ─────────────────────────────── Complete (540s)
           Task 7: PENDING (waiting for Task 6)
           Task 8: PENDING (waiting for Task 7)

t=540s     Task 6 complete ✓
           Start Task 7 ──────────────────── Complete (492s)
           Task 8: PENDING (waiting for Task 7)

t=1032s    Task 7 complete ✓
           Start Task 8 ────────────────────────Complete (728s)

t=1760s    Workflow complete ✓
           Total: 1760s = 29 minutes 20 seconds
```

---

## Troubleshooting Checklist

- [ ] All 3 tasks executed in order (6, then 7, then 8)?
- [ ] Task 7 waited for Task 6 to complete before starting?
- [ ] Task 8 waited for Task 7 to complete before starting?
- [ ] All 3 result files created? `.conductor/task-results/task-{6,7,8}.json`
- [ ] Dependency blocking enforced? (Tasks didn't start prematurely)
- [ ] Quality gates validated for all 3 tasks?
- [ ] Execution time ~25-40 minutes? (Not faster, which would indicate missing polling)

---

## Related Templates

- **Template 1:** Single Task Execution (Task 1: Security)
- **Template 3:** Parallel Execution (Tasks 4, 5, 6, 7)
- **Template 4:** Full 22-Task Orchestration

---

## Document Control

- **Type:** K1N Workflow Template (KNRef)
- **Status:** Ready for Production
- **Version:** 1.0
- **Location:** `docs/06-reference/`
- **Test Script:** `tests/validate_template_02_dependency_chain.sh`
- **YAML Spec:** `.conductor/workflows/template_02_dependency_chain.yaml`
- **Last Updated:** 2025-11-09

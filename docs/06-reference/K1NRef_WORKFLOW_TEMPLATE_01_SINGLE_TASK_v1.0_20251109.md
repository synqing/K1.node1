# Workflow Template 1: Single Task Execution

**Status:** Production Ready
**Created:** 2025-11-09
**Version:** 1.0
**Template ID:** template-01-single-task
**Use Case:** Execute a single K1.node1 task via Claude Desktop natural language

---

## Overview

This template demonstrates the **simplest possible workflow**: executing one task from the 22-task K1.node1 suite. Perfect for:
- Testing task execution end-to-end
- Validating a single agent handler
- Quick verification of infrastructure
- Learning how to invoke tasks via Claude Desktop

**Execution Time:** ~5-15 minutes (Task 1: Security)
**Complexity:** Beginner
**Success Criteria:** Task completes, result file created, all quality gates pass

---

## Human Interaction (Claude Desktop)

### Step 1: Invoke the Task
User opens Claude Desktop and issues this natural language prompt:

```
Execute Task 1 (SecurityAgent: Remove WiFi Credentials from Config).
Wait for completion and show me the results.
```

### Step 2: Expected Claude Response
Claude should:
1. Recognize "Task 1" as a K1.node1 task
2. Call the `execute_conductor_task` MCP tool with `task_id=1`
3. Receive an `execution_id` (e.g., "exec-001-security")
4. Poll the `get_conductor_task_status` tool every 2 seconds
5. When status changes to COMPLETED, extract and display results

**Sample Claude Response:**
```
I'll execute Task 1 for you. Let me start the security audit...

Starting Task 1 (SecurityAgent: Remove WiFi Credentials)
Execution ID: exec-001-security

Monitoring progress...
[Polling every 2 seconds]

Status update: Task running (2% progress)
Status update: Task running (45% progress)
Status update: Task running (89% progress)

✅ Task 1 Complete!

Results:
- Task ID: 1
- Agent Type: SecurityAgent
- Status: SUCCESS
- Duration: 4 minutes 23 seconds
- Quality Gates Passed: 14/15
- Quality Gates Failed: 1 (Code coverage: 82% < 90% threshold)
- Execution ID: exec-001-security
- Output: "Removed 3 WiFi credentials from config/env.json. Updated 2 references in code."
```

### Step 3: Human Reviews Results
User examines:
- Overall status (SUCCESS)
- Quality gate results (14/15 passed)
- Task output message
- Execution time (4m23s)

---

## Workflow Definition (YAML)

```yaml
name: template-01-single-task
description: Execute a single K1.node1 task with status polling
version: 1.0
metadata:
  type: simple
  complexity: beginner
  estimated_duration_minutes: 15
  agent_type: SecurityAgent

tasks:
  - task_id: 1
    name: Execute SecurityAgent Task
    description: Remove WiFi Credentials from Config
    type: system_task
    timeout_seconds: 600
    max_retries: 0
    parameters:
      task_name: Remove WiFi Credentials from Config
      agent_type: SecurityAgent
    quality_gates:
      - coverage_threshold: 90
      - security_score: 85
      - lint_warnings: 0
      - documentation: required

polling:
  strategy: active
  interval_seconds: 2
  max_attempts: 300
  timeout_seconds: 600

success_criteria:
  - task_status == "COMPLETED"
  - quality_gates_passed >= 14
  - execution_time < 600

error_handling:
  on_timeout:
    action: fail
    message: "Task did not complete within 10 minutes"
  on_failure:
    action: report
    message: "Task failed with non-critical errors"
  on_network_error:
    action: retry
    max_retries: 3
    backoff_seconds: 5
```

---

## Standalone Executable Workflow (For Direct Conductor Use)

If invoking directly via Conductor API (not through Claude Desktop):

```bash
# 1. Create task definition
curl -X POST http://localhost:8080/api/tasks/defs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "template-01-single-task",
    "taskType": "SIMPLE",
    "timeoutSeconds": 600,
    "retryCount": 0,
    "retryLogic": "FIXED",
    "retryDelaySeconds": 5,
    "timeoutPolicy": "TIME_OUT_WF"
  }'

# 2. Execute workflow
curl -X POST http://localhost:8080/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "template-01-single-task",
    "version": 1,
    "tasks": [
      {
        "name": "task-1-security",
        "taskReferenceName": "task_1",
        "type": "SIMPLE",
        "inputParameters": {
          "task_id": 1
        }
      }
    ],
    "schemaVersion": 2,
    "restartable": true,
    "workflowStatusListenerEnabled": false,
    "ownerEmail": "conductor@k1n.local",
    "timeoutPolicy": "TIME_OUT_WF",
    "timeoutSeconds": 600
  }'

# 3. Poll status
curl http://localhost:8080/api/workflows/exec-{execution_id}
```

---

## Quality Gates Validation

Task 1 (SecurityAgent) validates these quality gates:

| Gate | Threshold | Impact |
|------|-----------|--------|
| Code Coverage | ≥90% | FAIL if not met |
| Security Score | ≥85/100 | FAIL if not met |
| Lint Warnings | 0 critical | FAIL if critical found |
| Documentation | Required | FAIL if missing |
| Type Safety | ≥95% | WARN if not met |
| Test Coverage | ≥80% | WARN if not met |
| Performance | <2s per operation | WARN if exceeded |
| Memory Footprint | <50MB | WARN if exceeded |

**Expected Result:** 14/15 gates pass (coverage typically ~85-88%, just under threshold)

---

## Error Scenarios & Recovery

### Scenario 1: Task Timeout (No completion within 10 minutes)
**Recovery:**
1. Claude should report: "Task did not complete within 10 minutes"
2. User can manually check result at `.conductor/task-results/task-1.json`
3. Retry from Claude with: "Retry Task 1"
4. Max retries: 3 attempts

### Scenario 2: Network Error (Conductor unreachable)
**Recovery:**
1. Claude retries up to 3 times with exponential backoff (5s, 10s, 15s)
2. After 3 retries, reports: "Conductor server unreachable"
3. User should verify: `curl http://localhost:8080/api/health`
4. If Conductor down, restart: `docker-compose -f .conductor/docker-compose.yml up`

### Scenario 3: Agent Handler Failure (SecurityAgent crashes)
**Recovery:**
1. Claude reports: "Task failed: agent handler returned non-zero exit code"
2. User can check agent logs: `.conductor/agent-logs/security-agent-*.log`
3. Typical causes: missing credentials, file permission issues, timeout
4. Fix root cause, then retry

### Scenario 4: Quality Gate Failure (Coverage too low)
**Recovery:**
1. Task completes but shows: "Quality gate failed: Code coverage 82% < 90%"
2. This is NOT a task failure—output is still useful
3. User can accept the result or send Task 1 back to SecurityAgent for retry
4. This is expected behavior for early phases

---

## Usage Instructions

### Via Claude Desktop (Recommended)

**Step 1:** Open Claude Desktop
**Step 2:** Issue this prompt:
```
Execute Task 1 (SecurityAgent: Remove WiFi Credentials from Config).
Wait for completion and show me the results.
```

**Step 3:** Claude uses MCP tools:
- `execute_conductor_task` → Start execution
- `get_conductor_task_status` → Poll for progress
- Returns results when complete

**Expected Duration:** ~5-15 minutes

---

### Via CLI (Testing/Validation)

For automated testing, use the companion test script:

```bash
./tests/validate_template_01_single_task.sh
```

This script:
1. Calls Conductor REST API directly
2. Executes Task 1 via `conductor-mcp`
3. Polls status in a loop
4. Validates output format
5. Generates test report

**Output:** `test-results/template-01-single-task-results.json`

---

## Performance Characteristics

**Baseline (Task 1: Security Audit)**

| Metric | Value | Notes |
|--------|-------|-------|
| Task Execution Time | 4-8 minutes | Varies by system load |
| Polling Overhead | <1% CPU | Background polling every 2s |
| MCP Tool Call Time | <200ms | Network + Conductor response |
| Total Wall-Clock Time | ~5-15 min | Includes polling wait time |
| Result File Size | <10 KB | JSON with metadata |
| Memory Usage | <100 MB | SecurityAgent process |

**Scalability:** Single task has no scalability concerns. All 22 tasks can run sequentially in ~2-3 hours.

---

## Troubleshooting Checklist

- [ ] Conductor server running? `curl http://localhost:8080/api/health`
- [ ] conductor-mcp connected to Claude Desktop? Check Settings → Developer → Local MCP servers
- [ ] Task ID valid? (1-22 only)
- [ ] Result file created? Check `.conductor/task-results/task-1.json`
- [ ] Agent handler executable? Check `ops/agents/security-agent-handler.sh`
- [ ] Enough disk space? (Each task <50MB)
- [ ] Network stable? (No timeouts if localhost connection)

---

## Related Templates

- **Template 2:** Dependency Chain (Task 6→7→8)
- **Template 3:** Parallel Execution (Tasks 4, 5, 6, 7)
- **Template 4:** Full 22-Task Orchestration

---

## Document Control

- **Type:** K1N Workflow Template (KNRef)
- **Status:** Ready for Production
- **Version:** 1.0
- **Location:** `docs/06-reference/`
- **Test Script:** `tests/validate_template_01_single_task.sh`
- **YAML Spec:** `.conductor/workflows/template_01_single_task.yaml`
- **Last Updated:** 2025-11-09

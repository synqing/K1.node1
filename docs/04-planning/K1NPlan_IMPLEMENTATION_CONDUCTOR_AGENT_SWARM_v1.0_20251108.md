# Implementation Plan: Conductor-Based Multi-Agent Orchestration
**K1.node1 Agent Swarm - Phase-by-Phase Execution**

**Date:** November 8, 2025
**Status:** Ready to Execute
**Target Completion:** Week 4 (28 days from start)
**Effort:** ~100 hours developer time

---

## Overview

This document provides step-by-step implementation instructions to transform the Conductor + agent swarm design into working code.

**Phases:**
1. **Foundation** (Week 1, 20 hours) - conductor.json + agent scaffolding
2. **Agent Handlers** (Week 2, 30 hours) - Implement 5 agent types
3. **Validation** (Week 2-3, 25 hours) - E2E testing + quality gates
4. **Integration** (Week 3, 15 hours) - Conductor-MCP setup
5. **Execution** (Week 4+, 10 hours) - Full swarm run + refinement

---

## Phase 1: Foundation (Week 1)

### 1.1 Extend conductor.json

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/conductor.json`

**Task:** Add 22 agent task definitions

**Steps:**

1. Open `conductor.json` (backup first)
2. Load task definitions from `.taskmaster/tasks/tasks.json`
3. For each of 22 tasks, add task definition following this template:

```json
{
  "name": "task:CATEGORY:ID",
  "type": "agent",
  "agentType": "AgentTypeAgent",
  "taskId": ID,
  "priority": "high|medium|low",
  "title": "Task title from tasks.json",
  "description": "Task description",
  "dependencies": [
    { "taskId": X, "type": "BLOCKS", "blockingOn": "task:category:X" }
  ],
  "subtasks": [ /* from tasks.json */ ],
  "context": {
    /* task-specific context */
  },
  "qualityGates": [
    { "name": "gate_name", "metric": "type", "required": true }
  ],
  "timeout": 3600
}
```

**Validation:**
```bash
# Validate JSON syntax
jq . conductor.json > /dev/null && echo "Valid JSON"

# Count tasks
jq '.tasks | length' conductor.json  # Should be existing + 22

# Verify all task:* have type "agent"
jq '.tasks[] | select(.name | startswith("task:")) | select(.type != "agent")' conductor.json  # Should return nothing
```

**Estimated Time:** 4 hours (data transformation + validation)

---

### 1.2 Create ops/scripts/agent-handler.sh

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/ops/scripts/agent-handler.sh`

**Content:** Full implementation provided in design doc Section 3.2

**Steps:**

1. Create file
2. Copy agent-handler.sh implementation
3. Make executable: `chmod +x ops/scripts/agent-handler.sh`
4. Test with mock task:

```bash
# Create test task in conductor.json
{
  "name": "task:test:999",
  "type": "agent",
  "agentType": "SecurityAgent",
  "taskId": 999,
  "dependencies": [],
  "context": {},
  "qualityGates": [],
  "timeout": 60
}

# Run agent handler
bash ops/scripts/agent-handler.sh security 999

# Verify result file created
ls -la .conductor/task-results/task-999.json
```

**Estimated Time:** 2 hours (implementation + initial testing)

---

### 1.3 Create ops/agents/ directory structure

**Files to create:**

```
ops/agents/
├── security-agent-handler.sh
├── codegen-agent-handler.sh
├── testing-agent-handler.sh
├── architecture-agent-handler.sh
└── documentation-agent-handler.sh
```

**Scaffold each handler with:**

```bash
#!/bin/bash
# TYPE-agent-handler.sh

TASK_ID="$1"
TASK_DEF="$2"

echo "[${TYPE}Agent-$TASK_ID] Starting execution..."

# TODO: Implement task-specific logic

echo "[${TYPE}Agent-$TASK_ID] Completed ✓"
exit 0
```

**Make executable:**
```bash
chmod +x ops/agents/*.sh
```

**Estimated Time:** 1 hour (scaffolding)

---

### 1.4 Enhance conductor-run.sh for agent routing

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/ops/scripts/conductor-run.sh`

**Add agent routing cases** (see design doc Section 3.1)

**Test routing:**

```bash
# Test security task routing
bash ops/scripts/conductor-run.sh task:security:1

# Test codegen routing
bash ops/scripts/conductor-run.sh task:codegen:7

# Verify result files created
ls .conductor/task-results/
```

**Estimated Time:** 1 hour (add routing + test)

---

### 1.5 Create .conductor directory structure

**Create:**

```bash
mkdir -p .conductor/task-results
mkdir -p .conductor/agent-workspaces
```

**Verify:**

```bash
ls -la .conductor/
# Should show: task-results/, agent-workspaces/
```

**Estimated Time:** 15 minutes

---

### Phase 1 Validation Checklist

- [ ] conductor.json has 22 agent task definitions (count with `jq`)
- [ ] All agent tasks have type="agent", dependencies, qualityGates
- [ ] agent-handler.sh exists and is executable
- [ ] ops/agents/ directory has 5 handler stubs
- [ ] conductor-run.sh routes task:* to agent-handler.sh
- [ ] .conductor/task-results/ directory exists
- [ ] Test task spawning works (creates worktree + result file)

**Phase 1 Total Time:** ~20 hours

---

## Phase 2: Agent Handlers (Week 2)

### 2.1 Implement SecurityAgent Handler

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/ops/agents/security-agent-handler.sh`

**Implementation for Task-1 (WiFi Credentials):**

```bash
#!/bin/bash
# security-agent-handler.sh

TASK_ID="$1"
TASK_DEF="$2"

SCAN_PATH=$(echo "$TASK_DEF" | jq -r '.context.scanPath')
PATTERNS=$(echo "$TASK_DEF" | jq -r '.context.patterns[]')

echo "[SecurityAgent-$TASK_ID] Step 1/3: Auditing credentials..."

# Audit phase
ISSUES_FILE="audit-results.txt"
touch "$ISSUES_FILE"

for PATTERN in $PATTERNS; do
  rg "$PATTERN" "$SCAN_PATH" --color=never >> "$ISSUES_FILE" 2>/dev/null || true
done

ISSUE_COUNT=$(wc -l < "$ISSUES_FILE")

if [ "$ISSUE_COUNT" -eq 0 ]; then
  echo "[SecurityAgent-$TASK_ID] ✓ No credentials found (Step 1 passed)"
else
  echo "[SecurityAgent-$TASK_ID] Found $ISSUE_COUNT credential issues"
  echo "[SecurityAgent-$TASK_ID] Step 2/3: Applying security fix..."

  # Apply fix: Remove hardcoded credentials
  for FILE in $(grep -l "$PATTERN" "$SCAN_PATH"/*.cpp "$SCAN_PATH"/*.h 2>/dev/null); do
    sed -i '' "/$PATTERN/d" "$FILE"
  done

  echo "[SecurityAgent-$TASK_ID] Step 3/3: Verifying fix..."
fi

# Verify compilation
cd firmware
pio run -e esp32-s3-devkitc-1 > build.log 2>&1

if [ $? -eq 0 ]; then
  echo "[SecurityAgent-$TASK_ID] ✓ Compilation succeeded"
  exit 0
else
  echo "[SecurityAgent-$TASK_ID] ✗ Compilation failed"
  cat build.log
  exit 1
fi
```

**Testing:**

```bash
# Create task-1 in conductor.json (if not present)
# Run handler
bash ops/scripts/agent-handler.sh security 1

# Check result
cat .conductor/task-results/task-1.json
```

**Estimated Time:** 6 hours (implementation + testing)

---

### 2.2 Implement CodeGenAgent Handler

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/ops/agents/codegen-agent-handler.sh`

**Implementation for Task-7 (Bloom Pattern):**

```bash
#!/bin/bash
# codegen-agent-handler.sh

TASK_ID="$1"
TASK_DEF="$2"

PATTERN_TYPE=$(echo "$TASK_DEF" | jq -r '.context.patternType')
OUTPUT_FORMAT=$(echo "$TASK_DEF" | jq -r '.context.outputFormat')

echo "[CodeGenAgent-$TASK_ID] Step 1/4: Parsing pattern definition..."

# Step 1: Parse pattern (stub)
echo "Pattern: $PATTERN_TYPE" > pattern-def.json

echo "[CodeGenAgent-$TASK_ID] Step 2/4: Converting to graph structure..."

# Step 2: Convert to graph (stub)
cat > graph.json <<EOF
{
  "patternType": "$PATTERN_TYPE",
  "nodes": [],
  "edges": []
}
EOF

echo "[CodeGenAgent-$TASK_ID] Step 3/4: Generating C++ code..."

# Step 3: Generate C++ (stub)
cat > generated_pattern.cpp <<EOF
#include <FastLED.h>

namespace K1Patterns {
  class ${PATTERN_TYPE}Pattern {
    void init() {}
    void update() {}
    void render(CRGB* leds, int numLeds) {}
  };
}
EOF

echo "[CodeGenAgent-$TASK_ID] Step 4/4: Compiling and testing..."

# Step 4: Compile
cd firmware
pio run -e esp32-s3-devkitc-1 > build.log 2>&1

if [ $? -eq 0 ]; then
  echo "[CodeGenAgent-$TASK_ID] ✓ Compilation succeeded"
  exit 0
else
  echo "[CodeGenAgent-$TASK_ID] ✗ Compilation failed"
  exit 1
fi
```

**Estimated Time:** 8 hours

---

### 2.3 Implement TestingAgent Handler

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/ops/agents/testing-agent-handler.sh`

**Stub for Task-18 (Stress Testing):**

```bash
#!/bin/bash
# testing-agent-handler.sh

TASK_ID="$1"
TASK_DEF="$2"

echo "[TestingAgent-$TASK_ID] Running stress test (1000 iterations)..."

# Run test suite
cd firmware
pio test -e esp32-s3-devkitc-1 > test-results.log 2>&1

if [ $? -eq 0 ]; then
  echo "[TestingAgent-$TASK_ID] ✓ All tests passed"
  exit 0
else
  echo "[TestingAgent-$TASK_ID] ✗ Tests failed"
  exit 1
fi
```

**Estimated Time:** 6 hours

---

### 2.4 Implement ArchitectureAgent Handler

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/ops/agents/architecture-agent-handler.sh`

**Stub for Task-6 (Graph System Architecture):**

```bash
#!/bin/bash
# architecture-agent-handler.sh

TASK_ID="$1"
TASK_DEF="$2"

echo "[ArchitectureAgent-$TASK_ID] Validating ADR template..."

# Create ADR
mkdir -p docs/02-adr
cat > "docs/02-adr/K1NADR_0012_GRAPH_SYSTEM_ARCHITECTURE_v1.0_20251110.md" <<EOF
# ADR-0012: Graph System Architecture and Compiler

## Status
Proposed

## Context
Need to design pattern graph system...

## Decision
Implement modular graph compiler...

## Consequences
- Better pattern composition
- Easier testing
EOF

echo "[ArchitectureAgent-$TASK_ID] ✓ ADR created"
exit 0
```

**Estimated Time:** 5 hours

---

### 2.5 Implement DocumentationAgent Handler

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/ops/agents/documentation-agent-handler.sh`

**Stub for Task-19 (SDK Documentation):**

```bash
#!/bin/bash
# documentation-agent-handler.sh

TASK_ID="$1"
TASK_DEF="$2"

echo "[DocumentationAgent-$TASK_ID] Generating SDK documentation..."

mkdir -p docs/06-reference
cat > "docs/06-reference/sdk-documentation.md" <<EOF
# K1 Pattern SDK Documentation

## Quick Start
[SDK documentation content]
EOF

echo "[DocumentationAgent-$TASK_ID] ✓ Documentation generated"
exit 0
```

**Estimated Time:** 5 hours

---

### Phase 2 Validation Checklist

- [ ] All 5 agent handlers created and executable
- [ ] Each handler tested individually
- [ ] Each handler produces task result files
- [ ] Handlers respect quality gates (where applicable)
- [ ] Error handling works (exit codes)

**Phase 2 Total Time:** ~30 hours

---

## Phase 3: Validation & Testing (Week 2-3)

### 3.1 Single Task E2E Test

**Test Task-1 (Security: WiFi Credentials)**

```bash
# 1. Ensure conductor.json has task-1
grep "task:security:1" conductor.json

# 2. Run agent handler
bash ops/scripts/agent-handler.sh security 1

# 3. Verify result file
cat .conductor/task-results/task-1.json
# Should show: { "taskId": 1, "status": "COMPLETED" or "FAILED" }

# 4. Verify worktree was cleaned up
git worktree list
# Should NOT show agent-security-1 workspace
```

**Expected Result:** Task completes, result file created, worktree cleaned

**Estimated Time:** 2 hours

---

### 3.2 Multi-Task Dependency Test

**Test Task-6 → Task-7 → Task-8 chain**

```bash
# 1. Ensure conductor.json has tasks 6, 7, 8 with proper dependencies
jq '.tasks[] | select(.taskId == 6 or .taskId == 7 or .taskId == 8)' conductor.json

# 2. Create minimal dependency resolver script
cat > test-dependency-resolution.sh <<EOF
#!/bin/bash

# Start Task-6 (no deps)
bash ops/scripts/agent-handler.sh architecture 6
echo "[Test] Task-6 result:"
cat .conductor/task-results/task-6.json

# Task-7 depends on Task-6 (should not block)
bash ops/scripts/agent-handler.sh codegen 7
echo "[Test] Task-7 result:"
cat .conductor/task-results/task-7.json

# Task-8 depends on Task-7
bash ops/scripts/agent-handler.sh codegen 8
echo "[Test] Task-8 result:"
cat .conductor/task-results/task-8.json
EOF

bash test-dependency-resolution.sh
```

**Expected Result:** All 3 tasks complete in sequence, dependencies respected

**Estimated Time:** 3 hours

---

### 3.3 Parallel Execution Test

**Test 3 agents running simultaneously**

```bash
# Start 3 independent tasks in background
(bash ops/scripts/agent-handler.sh security 1 &)
(bash ops/scripts/agent-handler.sh architecture 6 &)
(bash ops/scripts/agent-handler.sh testing 18 &)

# Wait for all to complete
wait

# Verify all completed
ls .conductor/task-results/task-*.json | wc -l
# Should show >= 3
```

**Expected Result:** 3 agents run in parallel, no conflicts, all complete

**Estimated Time:** 4 hours

---

### 3.4 Quality Gate Validation

**Test quality gates enforcement**

```bash
# Modify agent handler to intentionally fail a quality gate
# (temporarily remove compilation check)

# Run task
bash ops/scripts/agent-handler.sh security 1

# Verify task marked FAILED in result
cat .conductor/task-results/task-1.json
# Should show: { "status": "FAILED" }

# Re-enable quality gate check
# Run task again
bash ops/scripts/agent-handler.sh security 1

# Verify task marked COMPLETED
cat .conductor/task-results/task-1.json
# Should show: { "status": "COMPLETED" }
```

**Expected Result:** Quality gates properly enforce success criteria

**Estimated Time:** 4 hours

---

### 3.5 Failure Handling Test

**Test task failure behavior**

```bash
# Create agent handler that fails
cat > ops/agents/test-fail-handler.sh <<EOF
#!/bin/bash
echo "This task intentionally fails"
exit 1
EOF

chmod +x ops/agents/test-fail-handler.sh

# Add to conductor.json:
# { "name": "task:test:999", ... "agentType": "TestFailAgent" }

# Run failing task
bash ops/scripts/agent-handler.sh testfail 999

# Verify:
# 1. Result file shows FAILED
# 2. Worktree was cleaned up
# 3. Dependent tasks remain BLOCKED (don't auto-execute)
```

**Expected Result:** Failure properly recorded, cleanup happens, dependents stay blocked

**Estimated Time:** 2 hours

---

### Phase 3 Validation Checklist

- [ ] Single task E2E test passes
- [ ] Dependency chain test passes (6→7→8)
- [ ] 3 parallel agents complete without conflicts
- [ ] Quality gates properly enforce criteria
- [ ] Failed tasks are recorded, worktrees cleaned
- [ ] No zombie processes or dangling worktrees

**Phase 3 Total Time:** ~15 hours (testing) + ~10 hours (refinement)

---

## Phase 4: Conductor-MCP Integration (Week 3)

### 4.1 Install Conductor-MCP

```bash
# Install Python package
pip install conductor-mcp

# Verify installation
python -m conductor_mcp.server --help
```

**Estimated Time:** 1 hour

---

### 4.2 Configure Claude Desktop

**Edit:** `~/.claude/config.json` (or `~/.config/Claude/config.json`)

```json
{
  "mcpServers": {
    "conductor": {
      "command": "python",
      "args": ["-m", "conductor_mcp.server"],
      "env": {
        "CONDUCTOR_SERVER_URL": "http://localhost:8080",
        "CONDUCTOR_CONFIG_FILE": "/path/to/K1.node1/conductor.json"
      }
    }
  }
}
```

**Test in Claude Desktop:**

```
User: "Start task:security:1"

Claude (should respond with): "I'll start the security task for you..."
```

**Estimated Time:** 2 hours

---

### 4.3 Create example MCP workflows

**Test Claude can:**

```
1. Start a task
2. Check status
3. List all tasks
4. Analyze failures
```

**Estimated Time:** 5 hours

---

### Phase 4 Validation Checklist

- [ ] Conductor-MCP installed and running
- [ ] Claude Desktop config updated
- [ ] MCP tools accessible from Claude
- [ ] Example workflows tested

**Phase 4 Total Time:** ~8 hours

---

## Phase 5: Full Swarm Execution (Week 4+)

### 5.1 Execute Full 22-Task Swarm

```bash
# Option 1: Sequential (safe, slow)
for TASK_ID in {1..22}; do
  bash ops/scripts/agent-handler.sh CATEGORY $TASK_ID
done

# Option 2: Parallel with GNU Parallel (fast)
parallel bash ops/scripts/agent-handler.sh {1} {2} ::: \
  security codegen testing architecture documentation \
  ::: {1..22}

# Option 3: Via Conductor (optimal)
# Start Conductor server
conductor start

# Monitor dashboard
open http://localhost:8080/ui
```

**Expected Result:** All 22 tasks execute, respect dependencies, produce results

**Estimated Time:** 10-20 hours (depending on actual task complexity)

---

### 5.2 Collect Metrics

```bash
# Execution time per task
for FILE in .conductor/task-results/task-*.json; do
  jq '{id: .taskId, time_ms: (.timestamp | now - fromdate)}' "$FILE"
done

# Success rate
SUCCESS=$(jq -s '[.[] | select(.status == "COMPLETED")] | length' .conductor/task-results/*.json)
echo "Completed: $SUCCESS / 22"

# Failure analysis
jq -s '[.[] | select(.status == "FAILED")] | map({id: .taskId, error: .error})' .conductor/task-results/*.json
```

**Estimated Time:** 2 hours

---

### 5.3 Refinement & Iteration

Based on results:
- Fix failing tasks
- Optimize slow tasks
- Refine quality gates
- Update agent handlers

**Estimated Time:** 5-10 hours

---

### Phase 5 Validation Checklist

- [ ] All 22 tasks complete
- [ ] Dependencies respected
- [ ] Quality gates enforced
- [ ] Metrics collected
- [ ] No errors or warnings

---

## Success Metrics & Rollback

### Success Criteria (All Required)

✅ **Functional**
- All 22 tasks execute end-to-end
- Dependencies respected (no out-of-order execution)
- Parallel agents work safely in isolated worktrees
- Quality gates validate before completion

✅ **Performance**
- Full execution completes in < 20 hours (with agent pool)
- No memory leaks or resource exhaustion
- Agents scale to 20+ concurrent

✅ **Observability**
- Each task produces result file in .conductor/task-results/
- Real-time progress visible
- Claude can query status via MCP

### Rollback Procedure

**If major issue discovered:**

```bash
# 1. Stop all running agents
pkill -f "agent-handler.sh"

# 2. Clean up worktrees
git worktree list | grep agent | awk '{print $1}' | xargs -I {} git worktree remove {}

# 3. Clean result files
rm -rf .conductor/task-results/*

# 4. Revert conductor.json to previous version
git checkout conductor.json

# 5. Restart from Phase 1 with fixes
```

---

## Timeline Summary

| Phase | Week | Hours | Deliverable |
|-------|------|-------|-------------|
| 1: Foundation | Week 1 | 20 | conductor.json + agent scaffolding |
| 2: Handlers | Week 2 | 30 | 5 agent type implementations |
| 3: Validation | Week 2-3 | 25 | E2E tests + quality gates |
| 4: Integration | Week 3 | 15 | Conductor-MCP setup |
| 5: Execution | Week 4+ | 10 | Full swarm run + metrics |
| **Total** | **4 weeks** | **~100 hours** | **Production-ready swarm** |

---

## File Checklist

**Files to Create/Modify:**

- [ ] `/conductor.json` - Extended with 22 task definitions
- [ ] `/ops/scripts/agent-handler.sh` - NEW
- [ ] `/ops/scripts/conductor-run.sh` - MODIFIED (add routing)
- [ ] `/ops/agents/security-agent-handler.sh` - NEW
- [ ] `/ops/agents/codegen-agent-handler.sh` - NEW
- [ ] `/ops/agents/testing-agent-handler.sh` - NEW
- [ ] `/ops/agents/architecture-agent-handler.sh` - NEW
- [ ] `/ops/agents/documentation-agent-handler.sh` - NEW
- [ ] `~/.claude/config.json` - MODIFIED (add Conductor-MCP)
- [ ] `.conductor/` directory - NEW (with task-results/, agent-workspaces/)

---

## Next Steps

1. **Approve this plan** - Confirm Phase 1-5 approach
2. **Begin Phase 1** - Start with conductor.json extension
3. **Run validation at each phase** - Don't skip testing
4. **Collect metrics** - Measure execution time, success rate
5. **Iterate** - Refine handlers based on results

---

**Ready to execute Phase 1?**

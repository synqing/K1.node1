# K1.node1 Phase 5.3 Task Dispatcher

**Version:** 1.0
**Date:** 2025-11-10
**Status:** Ready for Execution

---

## Overview

The Task Dispatcher is an automated system for spawning agents to execute Phase 5.3 (Error Recovery & Advanced Features) in parallel. It manages:

- **22 atomic tasks** broken into 5 execution groups
- **Dependency resolution** ensuring tasks run in correct order
- **Agent workspace isolation** using git worktrees
- **Execution tracking** with detailed logs
- **Parallel execution** (up to 8 concurrent agents)

**Expected Timeline:** 5 days (38 hours actual execution time)

---

## Quick Start

### 1. Validate Dispatcher Setup
```bash
./ops/scripts/agent-spawn.sh --validate-only
```

Expected output: ✓ All validation checks passed

### 2. List Available Tasks
```bash
./ops/scripts/agent-spawn.sh --list
```

Shows all 22 tasks organized by group.

### 3. Spawn Single Agent (Recommended First)
```bash
./ops/scripts/agent-spawn.sh --task T1
```

This will:
- Create isolated workspace: `.conductor/workspaces/agent-T1-database-engineer`
- Generate task instruction: `TASK_INSTRUCTION.md`
- Update execution log
- Agent can now begin work on T1: PostgreSQL Schema Design

### 4. Spawn Entire Group (After Foundation Completes)
```bash
./ops/scripts/agent-spawn.sh --batch-group GROUP_B
```

Will spawn 5 agents simultaneously (T4-T8) once GROUP_A dependencies are met.

---

## Execution Model

### Sequential Phases (Automatic Dependency Management)

```
GROUP_A (Day 1, 4 parallel agents)
    ↓ (Day 1 end)
GROUP_B (Day 2, 5 parallel agents)
    ↓ (Day 2 end)
GROUP_C (Day 3, 4 parallel agents)
    ↓ (Day 3 end)
GROUP_D (Day 4, 6 parallel agents)
    ↓ (Day 4 end)
GROUP_E (Day 5, 3 parallel agents)
```

Each group waits for the previous group's completion before spawning.

### Task Execution Flow

For each agent spawned:

1. **Workspace Isolation**
   - Create git worktree: `agent-{TASK_ID}-{AGENT_TYPE}`
   - Branch: `agent/{TASK_ID}/{AGENT_TYPE}`
   - Isolated from other agents

2. **Task Instruction**
   - Generate `TASK_INSTRUCTION.md` in workspace
   - References exact task spec from breakdown doc
   - Lists all required inputs and outputs

3. **Implementation**
   - Agent reads task instruction
   - Agent reads source docs (database schema, service interfaces, etc.)
   - Agent implements code per specification
   - Agent writes output files to specified paths

4. **Validation**
   - Agent runs validation checks from task spec
   - Tests must pass (unit tests, schema syntax, etc.)
   - Type checking (TypeScript compilation)
   - Linting and style conformance

5. **Commit**
   - Agent commits work: `feat({TASK_ID}): {Task Title}`
   - Detailed commit message with validation results
   - Push to origin (will be reviewed/merged after)

6. **Execution Log Update**
   - Status: ✓ completed or ✗ failed
   - Duration: actual hours spent
   - Output location: files created
   - Any blockers or issues

---

## File Structure

```
.conductor/
├── task-dispatcher.yaml          # Master config with all 22 task definitions
├── README_TASK_DISPATCHER.md      # This file
├── workspaces/                   # Agent workspaces (created per spawn)
│   ├── agent-T1-database-engineer/
│   │   ├── TASK_INSTRUCTION.md
│   │   ├── database/
│   │   │   └── migrations/
│   │   │       └── 001_*.sql
│   │   └── [other output files]
│   ├── agent-T2-backend-engineer/
│   │   └── ...
│   └── ...

ops/scripts/
├── agent-spawn.sh                # Agent spawning script
├── conductor-start.sh            # Conductor infrastructure startup
└── ...

docs/09-reports/
├── PHASE5_3_EXECUTION_LOG_20251110.md   # Master execution log
└── [task execution reports per agent]
```

---

## Task Groups & Effort

### GROUP_A: Foundation (Day 1 - 4 parallel tasks)
14 hours total effort, 0 dependencies

| Task | Title | Effort | Agent Type |
|------|-------|--------|-----------|
| T1 | PostgreSQL Schema Design | 4h | Database Engineer |
| T2 | Error Recovery Service Interface | 3h | Backend Engineer |
| T3 | API v2 Router Scaffolding | 3h | Backend Engineer |
| T16 | React Dashboard Scaffolding | 4h | Frontend Engineer |

**Outputs:** Schema migration, TypeScript types, API router, React components

**Dependencies:** None

**Triggers:** Can start immediately

---

### GROUP_B: Core Services (Day 2 - 5 parallel tasks)
17 hours total effort, depends on GROUP_A

| Task | Title | Effort | Agent Type |
|------|-------|--------|-----------|
| T4 | Retry Engine Implementation | 4h | Backend Engineer |
| T5 | Circuit Breaker Service | 4h | Backend Engineer |
| T6 | Dead Letter Queue Service | 3h | Backend Engineer |
| T7 | Scheduler Core Engine | 4h | Backend Engineer |
| T8 | API Versioning Middleware | 2h | Backend Engineer |

**Outputs:** Service implementations, worker scripts, unit tests

**Dependencies:** T1 (schema), T2 (types)

**Triggers:** After GROUP_A completes

---

### GROUP_C: API Endpoints (Day 3 - 4 parallel tasks)
14 hours total effort, depends on GROUP_B

| Task | Title | Effort | Agent Type |
|------|-------|--------|-----------|
| T9 | Error Recovery Endpoints | 4h | Backend Engineer |
| T10 | Scheduler Endpoints | 4h | Backend Engineer |
| T11 | Webhook Service | 3h | Backend Engineer |
| T12 | Batch Operations API | 3h | Backend Engineer |

**Outputs:** API endpoint implementations, request/response handlers

**Dependencies:** T4, T5, T6, T7, T8 (all GROUP_B services)

**Triggers:** After GROUP_B completes

---

### GROUP_D: Integration & Real-time (Day 4 - 6 parallel tasks)
24 hours total effort, depends on GROUP_C

| Task | Title | Effort | Agent Type |
|------|-------|--------|-----------|
| T13 | WebSocket Event Streaming | 4h | Backend Engineer |
| T14 | Metrics Collection Service | 4h | Backend Engineer |
| T15 | Dashboard Backend API | 4h | Backend Engineer |
| T17 | Gantt Chart Component | 4h | Frontend Engineer |
| T18 | Analytics Dashboard | 4h | Frontend Engineer |
| T19 | Real-time Update Integration | 4h | Frontend Engineer |

**Outputs:** WebSocket handlers, metrics service, dashboard APIs, React components

**Dependencies:** T9, T10, T13, T14, T15 (various GROUP_C outputs)

**Triggers:** After GROUP_C completes

---

### GROUP_E: Finalization & Testing (Day 5 - 3 parallel tasks)
12 hours total effort, depends on GROUP_D

| Task | Title | Effort | Agent Type |
|------|-------|--------|-----------|
| T20 | Rate Limiting Middleware | 2h | Backend Engineer |
| T21 | Integration Testing Suite | 6h | QA Engineer |
| T22 | Performance Validation | 4h | Performance Engineer |

**Outputs:** Rate limiting middleware, integration test suite, performance report

**Dependencies:** All GROUP_D outputs

**Triggers:** After GROUP_D completes

---

## Task Dispatcher Configuration

All task definitions live in `.conductor/task-dispatcher.yaml`:

- **taskId:** Unique identifier (T1-T22)
- **title:** Human-readable task name
- **effortHours:** Estimated effort (4-6 hours typical)
- **agent.type:** Agent specialization (database-engineer, backend-engineer, etc.)
- **inputs:** Files to read (task spec, design docs, etc.)
- **outputs:** Files to create/modify
- **validation:** Checks to pass before marking complete
- **dependencies:** Tasks that must complete first

Example:
```yaml
- taskId: "T1"
  title: "PostgreSQL Schema Design"
  priority: "CRITICAL"
  effortHours: 4
  agent:
    type: "database-engineer"
  inputs:
    - path: "docs/04-planning/K1NPlan_PHASE5_3_ATOMIC_TASK_BREAKDOWN_v1.0_20251110.md"
      section: "T1: PostgreSQL Schema Design"
  outputs:
    - path: "database/migrations/001_error_recovery_and_scheduling.sql"
  validation:
    - type: "file_exists"
    - type: "sql_syntax"
    - type: "schema_validation"
  dependencies: []
```

---

## Execution Log

Master log: `docs/09-reports/PHASE5_3_EXECUTION_LOG_20251110.md`

Tracks:
- Group execution timeline
- Task status (pending → spawned → in_progress → completed)
- Agent workspace locations
- Output locations
- Validation results
- Any blockers or issues

Updated after each spawn and agent completion.

---

## Common Commands

### List all tasks
```bash
./ops/scripts/agent-spawn.sh --list
```

### Spawn single task (manual dispatch)
```bash
./ops/scripts/agent-spawn.sh --task T1
```

### Spawn entire group
```bash
./ops/scripts/agent-spawn.sh --batch-group GROUP_A
```

### Validate setup only
```bash
./ops/scripts/agent-spawn.sh --validate-only
```

### Debug mode
```bash
DEBUG=1 ./ops/scripts/agent-spawn.sh --task T1
```

---

## Monitoring Execution

### Check agent workspace
```bash
ls -la .conductor/workspaces/agent-T1-database-engineer/
```

### Review execution log
```bash
cat docs/09-reports/PHASE5_3_EXECUTION_LOG_20251110.md
```

### Check agent git status
```bash
cd .conductor/workspaces/agent-T1-database-engineer/
git log --oneline
git status
```

### Check for output files
```bash
ls -la database/migrations/
ls -la conductor-api/src/types/
```

---

## Success Criteria

### Per-Task Criteria
- ✓ All output files exist
- ✓ Code compiles without errors
- ✓ All validation checks pass
- ✓ Unit tests pass (≥80% coverage for services)
- ✓ No new linting warnings
- ✓ Commit message references task ID

### Per-Group Criteria
- ✓ All tasks in group complete
- ✓ No merge conflicts between agents
- ✓ Dependency constraints satisfied
- ✓ Cross-agent integration points work

### Phase 5.3 Complete Criteria
- ✓ All 22 tasks completed
- ✓ Full integration test suite passes (≥30 tests)
- ✓ Performance benchmarks met
- ✓ Database schema applied cleanly
- ✓ API v2 fully functional
- ✓ Dashboard and analytics working
- ✓ Real-time features operational

---

## Troubleshooting

### Agent workspace creation fails
```bash
# Check git status
git status

# Check if worktree branch exists
git branch -a | grep agent/

# Clean up stale worktrees
git worktree list
git worktree remove .conductor/workspaces/agent-T1-database-engineer/
```

### Task instruction not found
```bash
# Verify workspace was created
ls -la .conductor/workspaces/agent-T1-*/TASK_INSTRUCTION.md

# Regenerate instruction
./ops/scripts/agent-spawn.sh --task T1
```

### Validation fails
- Check task spec in `docs/04-planning/K1NPlan_PHASE5_3_ATOMIC_TASK_BREAKDOWN_v1.0_20251110.md`
- Review validation requirements in `task-dispatcher.yaml`
- Check agent output files exist in workspace

### Agent commits not pushing
```bash
# Check remote
cd .conductor/workspaces/agent-T1-database-engineer/
git remote -v

# Push manually if needed
git push -u origin agent/T1/database-engineer
```

---

## Next Steps

### Day 1 (Now)
1. ✅ Review DEPLOYMENT_ASSESSMENT_AND_STRATEGY.md
2. ✅ Review task-dispatcher.yaml configuration
3. ✅ Run `./ops/scripts/agent-spawn.sh --validate-only`
4. **→ Spawn GROUP_A: `./ops/scripts/agent-spawn.sh --batch-group GROUP_A`**

### Day 1 Evening
- Monitor agent progress in `.conductor/workspaces/`
- Check execution log updates
- Verify output files appearing in expected locations

### Day 2 Morning
- Review GROUP_A outputs
- Check for merge conflicts or issues
- Spawn GROUP_B: `./ops/scripts/agent-spawn.sh --batch-group GROUP_B`

### Day 2-5
- Repeat cycle for GROUP_C, GROUP_D, GROUP_E
- Monitor integration tests
- Validate performance benchmarks

### Day 5 Evening
- All 22 tasks complete
- Full Phase 5.3 implementation done
- Ready for production deployment

---

## Key Links

| Document | Purpose |
|----------|---------|
| `DEPLOYMENT_ASSESSMENT_AND_STRATEGY.md` | High-level deployment overview |
| `.conductor/task-dispatcher.yaml` | Master task configuration |
| `docs/04-planning/K1NPlan_PHASE5_3_ATOMIC_TASK_BREAKDOWN_v1.0_20251110.md` | Source of truth for task specs |
| `docs/09-reports/PHASE5_3_EXECUTION_LOG_20251110.md` | Real-time execution tracking |
| `docs/04-planning/phase5.3_database_schema.sql` | Database design reference |
| `docs/04-planning/phase5.3_service_interfaces.ts` | TypeScript types reference |
| `docs/04-planning/phase5.3_implementation_architecture.md` | Architecture details |

---

## Support

For issues or questions:
1. Check this README and troubleshooting section
2. Review the referenced task spec document
3. Check dispatcher config for task details
4. Check execution log for error messages
5. Review agent workspace for compilation errors

---

*Ready to deploy. Run `./ops/scripts/agent-spawn.sh --batch-group GROUP_A` to begin.*

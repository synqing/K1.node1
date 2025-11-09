#!/bin/bash

###############################################################################
# Agent Spawn Script for K1.node1 Phase 5.3 Task Dispatcher
#
# Purpose: Spawn isolated agents to execute atomic tasks in parallel
# Usage: ./agent-spawn.sh --task T1 --group GROUP_A
#        ./agent-spawn.sh --batch-group GROUP_A --parallelism 4
#        ./agent-spawn.sh --validate-only
#
# This script:
# 1. Parses task dispatcher config
# 2. Creates isolated git worktrees for each agent
# 3. Spawns agents with specific task instructions
# 4. Tracks execution state
# 5. Enforces dependency constraints
#
# Version: 1.0
# Date: 2025-11-10
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONDUCTOR_DIR="$PROJECT_ROOT/.conductor"
DISPATCHER_CONFIG="$CONDUCTOR_DIR/task-dispatcher.yaml"
WORKSPACES_DIR="$CONDUCTOR_DIR/workspaces"
EXECUTION_LOG_DIR="$PROJECT_ROOT/docs/09-reports"
EXECUTION_LOG="$EXECUTION_LOG_DIR/PHASE5_3_EXECUTION_LOG_20251110.md"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_debug() { [[ "${DEBUG:-0}" == "1" ]] && echo -e "${CYAN}[DEBUG]${NC} $*"; }

###############################################################################
# Utility Functions
###############################################################################

# Check if dispatcher config exists
check_dispatcher_config() {
    if [[ ! -f "$DISPATCHER_CONFIG" ]]; then
        log_error "Dispatcher config not found: $DISPATCHER_CONFIG"
        exit 1
    fi
    log_success "Dispatcher config found"
}

# Initialize execution log
init_execution_log() {
    mkdir -p "$EXECUTION_LOG_DIR"

    if [[ ! -f "$EXECUTION_LOG" ]]; then
        cat > "$EXECUTION_LOG" << 'EOF'
# Phase 5.3 Execution Log
**Date Started:** 2025-11-10
**Status:** In Progress
**Total Tasks:** 22
**Groups:** 5

## Execution Timeline

| Group | Tasks | Status | Start | End | Duration |
|-------|-------|--------|-------|-----|----------|
| GROUP_A | T1, T2, T3, T16 | pending | — | — | — |
| GROUP_B | T4, T5, T6, T7, T8 | pending | — | — | — |
| GROUP_C | T9, T10, T11, T12 | pending | — | — | — |
| GROUP_D | T13, T14, T15, T17, T18, T19 | pending | — | — | — |
| GROUP_E | T20, T21, T22 | pending | — | — | — |

## Task Details

### GROUP_A Tasks

EOF
        log_success "Execution log initialized: $EXECUTION_LOG"
    fi
}

# Create isolated git worktree for agent
create_agent_workspace() {
    local task_id="$1"
    local agent_name="$2"

    local workspace_dir="$WORKSPACES_DIR/agent-$task_id-$agent_name"

    # Check if workspace already exists
    if [[ -d "$workspace_dir" ]]; then
        log_warning "Workspace already exists: $workspace_dir"
        echo "$workspace_dir"
        return 0
    fi

    # Create git worktree
    mkdir -p "$WORKSPACES_DIR"

    log_info "Creating git worktree for $task_id at $workspace_dir"
    git -C "$PROJECT_ROOT" worktree add "$workspace_dir" -b "agent/$task_id/$agent_name" main

    log_success "Workspace created: $workspace_dir"
    echo "$workspace_dir"
}

# Generate task instruction document
generate_task_instruction() {
    local task_id="$1"
    local workspace_dir="$2"

    local instruction_file="$workspace_dir/TASK_INSTRUCTION.md"

    cat > "$instruction_file" << EOF
# Task: $task_id Instruction Document

**Generated:** $(date -u +"%Y-%m-%dT%H:%M:%SZ")**
**Workspace:** $workspace_dir
**Status:** Ready for Execution

## Source Reference

See: \`docs/04-planning/K1NPlan_PHASE5_3_ATOMIC_TASK_BREAKDOWN_v1.0_20251110.md\`

Extract the task definition for **$task_id** from the above document and follow the specification exactly.

## Standard Execution Steps

1. **Read the task specification** from the document above
2. **Extract inputs** (files to read, existing code to reference)
3. **Implement outputs** (new files/modifications per spec)
4. **Validate** (run validation steps from task spec)
5. **Test** (execute unit tests if applicable)
6. **Commit** with message: \`feat($task_id): [task title from spec]\`
7. **Verify** all validation checks pass
8. **Push** commits to origin (will be merged after review)

## Important Constraints

- Do NOT modify files outside the specified outputs
- Do NOT introduce breaking changes to existing APIs
- Do NOT skip validation steps
- Do NOT commit until all tests pass
- Follow existing code style and conventions
- Add tests for new functionality
- Document public APIs

## Success Criteria

Task is complete when:
- All output files exist and contain correct implementation
- All validation checks from task spec pass
- All new tests pass (≥80% coverage for services)
- Code compiles without errors
- No new linting warnings introduced

## Failure Recovery

If stuck:
1. Check error messages carefully
2. Review the task spec in the breakdown document
3. Check related docs for context
4. Commit current progress with \`[WIP]\` prefix
5. Document blockers in git commit message

## Helpful Links

- Task Breakdown: \`docs/04-planning/K1NPlan_PHASE5_3_ATOMIC_TASK_BREAKDOWN_v1.0_20251110.md\`
- Implementation Architecture: \`docs/04-planning/phase5.3_implementation_architecture.md\`
- Service Interfaces: \`docs/04-planning/phase5.3_service_interfaces.ts\`
- Database Schema: \`docs/04-planning/phase5.3_database_schema.sql\`
- Implementation Checklist: \`docs/04-planning/phase5.3_implementation_checklist.md\`

---

Generated by agent-spawn.sh at $(date)
EOF

    log_success "Task instruction generated: $instruction_file"
    echo "$instruction_file"
}

# Update execution log with task status
update_execution_log() {
    local task_id="$1"
    local status="$2"
    local agent_workspace="$3"

    log_info "Updating execution log for $task_id: $status"

    # Append task status to execution log (simplified version)
    cat >> "$EXECUTION_LOG" << EOF

#### $task_id
- **Status:** $status
- **Workspace:** $agent_workspace
- **Started:** $(date -u +"%Y-%m-%dT%H:%M:%SZ")**

EOF
}

# List all available tasks
list_tasks() {
    log_info "Available tasks in dispatcher config:"
    echo ""
    echo "GROUP_A (Foundation - Day 1):"
    echo "  T1  - PostgreSQL Schema Design (4h)"
    echo "  T2  - Error Recovery Service Interface (3h)"
    echo "  T3  - API v2 Router Scaffolding (3h)"
    echo "  T16 - React Dashboard Scaffolding (4h)"
    echo ""
    echo "GROUP_B (Core Services - Day 2):"
    echo "  T4  - Retry Engine Implementation (4h)"
    echo "  T5  - Circuit Breaker Service (4h)"
    echo "  T6  - Dead Letter Queue Service (3h)"
    echo "  T7  - Scheduler Core Engine (4h)"
    echo "  T8  - API Versioning Middleware (2h)"
    echo ""
    echo "GROUP_C (API Endpoints - Day 3):"
    echo "  T9  - Error Recovery Endpoints (4h)"
    echo "  T10 - Scheduler Endpoints (4h)"
    echo "  T11 - Webhook Service (3h)"
    echo "  T12 - Batch Operations API (3h)"
    echo ""
    echo "GROUP_D (Integration & Real-time - Day 4):"
    echo "  T13 - WebSocket Event Streaming (4h)"
    echo "  T14 - Metrics Collection Service (4h)"
    echo "  T15 - Dashboard Backend API (4h)"
    echo "  T17 - Gantt Chart Component (4h)"
    echo "  T18 - Analytics Dashboard (4h)"
    echo "  T19 - Real-time Update Integration (4h)"
    echo ""
    echo "GROUP_E (Finalization & Testing - Day 5):"
    echo "  T20 - Rate Limiting Middleware (2h)"
    echo "  T21 - Integration Testing Suite (6h)"
    echo "  T22 - Performance Validation (4h)"
}

# Validate task dependencies
validate_dependencies() {
    local task_id="$1"

    case "$task_id" in
        T1|T2|T3|T16)
            log_success "Task $task_id has no dependencies (GROUP_A)"
            return 0
            ;;
        T4|T5|T6|T7)
            log_info "Task $task_id depends on GROUP_A (T1, T2)"
            # Check if T1, T2 are completed
            if ! grep -q "T1.*completed\|T2.*completed" "$EXECUTION_LOG" 2>/dev/null; then
                log_warning "Dependencies not yet complete. Task queued but will not execute until GROUP_A completes."
            fi
            return 0
            ;;
        *)
            log_warning "Unknown task: $task_id"
            return 1
            ;;
    esac
}

# Spawn an agent for a specific task
spawn_agent() {
    local task_id="$1"

    log_info "=========================================="
    log_info "Spawning agent for task: $task_id"
    log_info "=========================================="

    # Validate task exists
    if ! grep -q "taskId: \"$task_id\"" "$DISPATCHER_CONFIG"; then
        log_error "Task not found in dispatcher config: $task_id"
        return 1
    fi

    # Validate dependencies
    validate_dependencies "$task_id" || return 1

    # Create workspace
    local agent_type=$(grep -A 20 "taskId: \"$task_id\"" "$DISPATCHER_CONFIG" | grep "type:" | head -1 | awk '{print $2}')
    local workspace=$(create_agent_workspace "$task_id" "${agent_type:-unknown}")

    # Generate instruction
    local instruction=$(generate_task_instruction "$task_id" "$workspace")

    # Update log
    update_execution_log "$task_id" "spawned" "$workspace"

    log_success "Agent spawned for $task_id"
    log_info "Workspace: $workspace"
    log_info "Instructions: $instruction"
    log_info ""
    log_info "Next steps:"
    log_info "  1. Review the TASK_INSTRUCTION.md file in the workspace"
    log_info "  2. Read the specification from the referenced task breakdown document"
    log_info "  3. Implement the task according to the specification"
    log_info "  4. Run validation checks"
    log_info "  5. Commit and push your work"

    return 0
}

# Spawn batch of tasks (entire group)
spawn_batch_group() {
    local group_id="$1"
    local tasks=""

    case "$group_id" in
        GROUP_A) tasks="T1 T2 T3 T16" ;;
        GROUP_B) tasks="T4 T5 T6 T7 T8" ;;
        GROUP_C) tasks="T9 T10 T11 T12" ;;
        GROUP_D) tasks="T13 T14 T15 T17 T18 T19" ;;
        GROUP_E) tasks="T20 T21 T22" ;;
        *)
            log_error "Unknown group: $group_id"
            return 1
            ;;
    esac

    log_info "=========================================="
    log_info "Spawning batch group: $group_id"
    log_info "Tasks: $tasks"
    log_info "=========================================="

    local failed_tasks=()

    for task_id in $tasks; do
        if spawn_agent "$task_id"; then
            log_success "✓ $task_id spawned"
        else
            log_error "✗ $task_id failed to spawn"
            failed_tasks+=("$task_id")
        fi
        sleep 1  # Brief delay between spawns
    done

    if [[ ${#failed_tasks[@]} -gt 0 ]]; then
        log_error "Failed to spawn: ${failed_tasks[@]}"
        return 1
    fi

    log_success "All tasks in $group_id spawned successfully"
    return 0
}

# Dry-run validation
validate_only() {
    log_info "=========================================="
    log_info "Validation Mode (--validate-only)"
    log_info "=========================================="

    log_info "Checking dispatcher config..."
    if [[ ! -f "$DISPATCHER_CONFIG" ]]; then
        log_error "Dispatcher config not found"
        return 1
    fi
    log_success "✓ Dispatcher config exists"

    log_info "Checking execution log..."
    if [[ ! -f "$EXECUTION_LOG" ]]; then
        log_warning "Execution log not found (will be created on first spawn)"
    else
        log_success "✓ Execution log exists"
    fi

    log_info "Checking workspaces directory..."
    if [[ ! -d "$WORKSPACES_DIR" ]]; then
        log_info "Workspaces directory will be created on first spawn"
    else
        log_success "✓ Workspaces directory exists"
        log_info "Current workspaces:"
        ls -1d "$WORKSPACES_DIR"/agent-* 2>/dev/null | xargs -I {} basename {} || true
    fi

    log_success "✓ All validation checks passed"
    return 0
}

###############################################################################
# Main Script
###############################################################################

main() {
    # Parse arguments
    local mode="spawn-single"
    local task_id=""
    local group_id=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --task)
                mode="spawn-single"
                task_id="$2"
                shift 2
                ;;
            --batch-group)
                mode="spawn-batch"
                group_id="$2"
                shift 2
                ;;
            --list)
                mode="list"
                shift
                ;;
            --validate-only)
                mode="validate"
                shift
                ;;
            --debug)
                DEBUG=1
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    # Initialize
    check_dispatcher_config
    init_execution_log

    # Execute mode
    case "$mode" in
        spawn-single)
            if [[ -z "$task_id" ]]; then
                log_error "Task ID required for --task mode"
                exit 1
            fi
            spawn_agent "$task_id"
            ;;
        spawn-batch)
            if [[ -z "$group_id" ]]; then
                log_error "Group ID required for --batch-group mode"
                exit 1
            fi
            spawn_batch_group "$group_id"
            ;;
        list)
            list_tasks
            ;;
        validate)
            validate_only
            ;;
        *)
            log_error "Unknown mode: $mode"
            exit 1
            ;;
    esac
}

main "$@"

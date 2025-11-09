# Conductor-MCP Tool Definitions for K1.node1

**Status:** Ready for Implementation
**Version:** 1.0
**Date:** 2025-11-08
**Purpose:** Define 7 core MCP tools for Conductor-based multi-agent orchestration

---

## Overview

This document defines 7 core MCP tools that expose Conductor workflow and task management capabilities to Claude Desktop via the Model Context Protocol. These tools enable natural language orchestration of K1.node1's 22-task multi-agent swarm.

**Design Philosophy:**
- **High-level abstractions** - 7 tools instead of 30+ API endpoints
- **K1.node1 specific** - Tailored to firmware + webapp + multi-agent architecture
- **Error resilient** - Built-in retry, timeout, and failure handling
- **Performance aware** - Reasonable timeouts (30s interactive, 5min batch)

---

## Tool 1: Create Task

**Purpose:** Define a new task in Conductor (rarely needed; mostly for testing)

**MCP Tool Name:** `create_conductor_task`

```json
{
  "name": "create_conductor_task",
  "description": "Create a new task definition in Conductor. Returns task definition ID if successful.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "task_name": {
        "type": "string",
        "minLength": 1,
        "maxLength": 128,
        "description": "Unique task name (e.g., 'security_audit', 'pattern_compile')"
      },
      "task_type": {
        "type": "string",
        "enum": ["SIMPLE", "FORK", "DECISION", "HTTP"],
        "description": "Task execution type"
      },
      "description": {
        "type": "string",
        "maxLength": 500,
        "description": "Task description and purpose"
      },
      "input_parameters": {
        "type": "object",
        "description": "Input parameter schema as JSON object"
      },
      "timeout_seconds": {
        "type": "integer",
        "minimum": 30,
        "maximum": 28800,
        "default": 3600,
        "description": "Task execution timeout in seconds (30s to 8h)"
      }
    },
    "required": ["task_name", "task_type"]
  }
}
```

**Return Value (Success):**
```json
{
  "task_id": "task:category:id",
  "status": "created",
  "created_at": "2025-11-08T23:59:00Z",
  "message": "Task definition created successfully"
}
```

**Error Cases:**
- Task name already exists → HTTP 409
- Invalid task type → HTTP 400
- Invalid schema → HTTP 422

---

## Tool 2: Execute Task

**Purpose:** Start execution of a specific K1.node1 task (1-22)

**MCP Tool Name:** `execute_conductor_task`

```json
{
  "name": "execute_conductor_task",
  "description": "Execute a K1.node1 task by ID (1-22). Returns execution ID for status polling.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "task_id": {
        "type": "integer",
        "minimum": 1,
        "maximum": 22,
        "description": "Task ID from K1.node1 task list (1-22)"
      },
      "input_parameters": {
        "type": "object",
        "description": "Task-specific input parameters (varies by task)"
      },
      "priority": {
        "type": "string",
        "enum": ["LOW", "NORMAL", "HIGH"],
        "default": "NORMAL",
        "description": "Execution priority"
      },
      "wait_for_completion": {
        "type": "boolean",
        "default": false,
        "description": "If true, wait up to 5 minutes for task completion"
      }
    },
    "required": ["task_id"]
  }
}
```

**Return Value (Success - Immediate):**
```json
{
  "execution_id": "exec-task-1-20251108-235900",
  "task_id": 1,
  "status": "QUEUED",
  "queued_at": "2025-11-08T23:59:00Z",
  "message": "Task 1 queued for execution"
}
```

**Return Value (Success - Waited):**
```json
{
  "execution_id": "exec-task-1-20251108-235900",
  "task_id": 1,
  "status": "COMPLETED",
  "started_at": "2025-11-08T23:59:05Z",
  "completed_at": "2025-11-08T23:59:45Z",
  "duration_seconds": 40,
  "result": { /* task-specific results */ }
}
```

**Error Cases:**
- Invalid task_id → HTTP 400
- Task already running → HTTP 409
- Task not found → HTTP 404

---

## Tool 3: Get Task Status

**Purpose:** Poll status of a running or completed task execution

**MCP Tool Name:** `get_conductor_task_status`

```json
{
  "name": "get_conductor_task_status",
  "description": "Get current status of a task execution. Use execution_id from execute_conductor_task.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "execution_id": {
        "type": "string",
        "description": "Execution ID returned from execute_conductor_task"
      },
      "include_details": {
        "type": "boolean",
        "default": false,
        "description": "If true, include full task execution logs and metrics"
      }
    },
    "required": ["execution_id"]
  }
}
```

**Return Value (In Progress):**
```json
{
  "execution_id": "exec-task-1-20251108-235900",
  "task_id": 1,
  "status": "RUNNING",
  "started_at": "2025-11-08T23:59:05Z",
  "elapsed_seconds": 35,
  "progress_percent": 75,
  "current_stage": "Verifying compilation",
  "message": "Task 1 is 75% complete"
}
```

**Return Value (Completed):**
```json
{
  "execution_id": "exec-task-1-20251108-235900",
  "task_id": 1,
  "status": "COMPLETED",
  "started_at": "2025-11-08T23:59:05Z",
  "completed_at": "2025-11-08T23:59:45Z",
  "duration_seconds": 40,
  "result": { /* task-specific results */ },
  "quality_gates": [
    { "name": "no_hardcoded_credentials", "status": "PASSED" },
    { "name": "certificate_auth_functional", "status": "PASSED" }
  ]
}
```

---

## Tool 4: List Tasks

**Purpose:** List all 22 K1.node1 tasks with filtering and search

**MCP Tool Name:** `list_conductor_tasks`

```json
{
  "name": "list_conductor_tasks",
  "description": "List all K1.node1 tasks (1-22) with optional filtering by agent type or status.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "agent_type": {
        "type": "string",
        "enum": ["SecurityAgent", "CodeGenAgent", "TestingAgent", "ArchitectureAgent", "DocumentationAgent", "all"],
        "default": "all",
        "description": "Filter by agent type"
      },
      "status_filter": {
        "type": "string",
        "enum": ["pending", "running", "completed", "failed", "all"],
        "default": "all",
        "description": "Filter by execution status"
      },
      "search_term": {
        "type": "string",
        "maxLength": 100,
        "description": "Search task names/descriptions"
      }
    }
  }
}
```

**Return Value:**
```json
{
  "total_tasks": 22,
  "returned": 5,
  "tasks": [
    {
      "task_id": 1,
      "name": "Remove WiFi Credentials from Firmware",
      "agent_type": "SecurityAgent",
      "priority": "high",
      "estimated_hours": 8,
      "status": "pending",
      "dependencies": []
    },
    {
      "task_id": 6,
      "name": "Design Graph System Architecture",
      "agent_type": "ArchitectureAgent",
      "priority": "high",
      "estimated_hours": 6,
      "status": "pending",
      "dependencies": []
    }
  ]
}
```

---

## Tool 5: Create Workflow

**Purpose:** Define a multi-task workflow with dependency management

**MCP Tool Name:** `create_conductor_workflow`

```json
{
  "name": "create_conductor_workflow",
  "description": "Define a multi-task Conductor workflow with task dependencies and parameters.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "workflow_name": {
        "type": "string",
        "minLength": 1,
        "maxLength": 128,
        "description": "Workflow name (e.g., 'k1n-full-orchestration')"
      },
      "description": {
        "type": "string",
        "maxLength": 500,
        "description": "Workflow description and purpose"
      },
      "task_ids": {
        "type": "array",
        "items": { "type": "integer", "minimum": 1, "maximum": 22 },
        "minItems": 1,
        "description": "List of K1.node1 task IDs to include in workflow"
      },
      "task_dependencies": {
        "type": "object",
        "description": "Optional: Define task-to-task dependencies (e.g., {7: [6], 8: [6]})",
        "additionalProperties": { "type": "array", "items": { "type": "integer" } }
      },
      "parameters": {
        "type": "object",
        "description": "Workflow-level parameters passed to all tasks"
      }
    },
    "required": ["workflow_name", "task_ids"]
  }
}
```

**Return Value (Success):**
```json
{
  "workflow_id": "workflow-k1n-full-20251108",
  "workflow_name": "k1n-full-orchestration",
  "status": "created",
  "task_count": 22,
  "created_at": "2025-11-08T23:59:00Z",
  "message": "Workflow created successfully with 22 tasks"
}
```

---

## Tool 6: Execute Workflow

**Purpose:** Start execution of a complete multi-task workflow

**MCP Tool Name:** `execute_conductor_workflow`

```json
{
  "name": "execute_conductor_workflow",
  "description": "Start execution of a Conductor workflow. Automatically manages task dependencies and sequencing.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "workflow_id": {
        "type": "string",
        "description": "Workflow ID returned from create_conductor_workflow"
      },
      "parameters": {
        "type": "object",
        "description": "Runtime parameters for workflow execution"
      },
      "parallel_limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 10,
        "default": 4,
        "description": "Max concurrent task executions (respects dependencies)"
      }
    },
    "required": ["workflow_id"]
  }
}
```

**Return Value (Success):**
```json
{
  "workflow_execution_id": "exec-workflow-k1n-full-20251108-235900",
  "workflow_id": "workflow-k1n-full-20251108",
  "status": "RUNNING",
  "total_tasks": 22,
  "started_at": "2025-11-08T23:59:00Z",
  "message": "Workflow execution started. Monitor with get_conductor_workflow_status."
}
```

---

## Tool 7: Get Workflow Status

**Purpose:** Poll status of a running or completed workflow

**MCP Tool Name:** `get_conductor_workflow_status`

```json
{
  "name": "get_conductor_workflow_status",
  "description": "Get current status of a workflow execution including task-by-task progress.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "workflow_execution_id": {
        "type": "string",
        "description": "Execution ID returned from execute_conductor_workflow"
      },
      "include_task_details": {
        "type": "boolean",
        "default": false,
        "description": "If true, include detailed status of each task"
      }
    },
    "required": ["workflow_execution_id"]
  }
}
```

**Return Value (In Progress - Summary):**
```json
{
  "workflow_execution_id": "exec-workflow-k1n-full-20251108-235900",
  "workflow_id": "workflow-k1n-full-20251108",
  "status": "RUNNING",
  "progress": {
    "total_tasks": 22,
    "completed": 8,
    "running": 3,
    "pending": 11,
    "failed": 0,
    "completion_percent": 36
  },
  "started_at": "2025-11-08T23:59:00Z",
  "elapsed_seconds": 600,
  "estimated_remaining_seconds": 1000,
  "current_phase": "CodeGen Phase",
  "message": "Workflow 36% complete (8/22 tasks done)"
}
```

**Return Value (Completed):**
```json
{
  "workflow_execution_id": "exec-workflow-k1n-full-20251108-235900",
  "workflow_id": "workflow-k1n-full-20251108",
  "status": "COMPLETED",
  "progress": {
    "total_tasks": 22,
    "completed": 22,
    "running": 0,
    "pending": 0,
    "failed": 0,
    "completion_percent": 100
  },
  "started_at": "2025-11-08T23:59:00Z",
  "completed_at": "2025-11-08T23:59:00Z",
  "total_duration_seconds": 1600,
  "quality_gates": {
    "passed": 47,
    "failed": 0,
    "total": 47
  },
  "summary": "All 22 tasks completed successfully. All quality gates passed."
}
```

---

## Implementation Notes

### Error Handling

All tools follow consistent error handling:
- **Validation Errors (400)**: Invalid input parameters
- **Not Found (404)**: Resource doesn't exist
- **Conflict (409)**: Resource already exists or in invalid state
- **Timeout (504)**: Task exceeded timeout threshold
- **Internal Error (500)**: Unexpected server error

### Performance Characteristics

- **create_conductor_task**: <100ms
- **execute_conductor_task**: <500ms (queuing only)
- **get_conductor_task_status**: <200ms
- **list_conductor_tasks**: <300ms
- **create_conductor_workflow**: <500ms
- **execute_conductor_workflow**: <500ms (queuing only)
- **get_conductor_workflow_status**: <300ms

### K1.node1 Specific Constraints

- Task IDs: 1-22 (hardcoded, fixed set)
- Agent Types: 5 (SecurityAgent, CodeGenAgent, TestingAgent, ArchitectureAgent, DocumentationAgent)
- Max Execution Time: 8 hours per task
- Max Parallel Tasks: 10 (respects dependencies)
- Quality Gates: 15+ per workflow

---

## JSON Schema Summary Table

| Tool | Purpose | Inputs | Outputs |
|------|---------|--------|---------|
| **create_conductor_task** | Define new task | task_name, type | task_id |
| **execute_conductor_task** | Start task execution | task_id | execution_id |
| **get_conductor_task_status** | Poll task progress | execution_id | status, progress |
| **list_conductor_tasks** | Query tasks | filters, search | task_list |
| **create_conductor_workflow** | Define multi-task workflow | task_ids, deps | workflow_id |
| **execute_conductor_workflow** | Start workflow | workflow_id | workflow_execution_id |
| **get_conductor_workflow_status** | Poll workflow progress | workflow_execution_id | status, progress |

---

## Next Steps

These 7 tools will be:
1. ✅ **Defined** (this document) - COMPLETE
2. ⏳ **Integrated** into conductor-mcp server
3. ⏳ **Tested** with example workflows
4. ⏳ **Documented** with natural language examples

---

**Version:** 1.0
**Status:** Tool definitions complete and ready for integration into Phase 4.3 templates

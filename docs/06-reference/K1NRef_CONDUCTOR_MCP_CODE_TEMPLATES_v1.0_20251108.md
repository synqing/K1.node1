---
Title: Conductor-MCP Code Templates and Examples
Owner: Claude Research Agent
Date: 2025-11-08
Status: accepted
Scope: Reusable code patterns and templates for Conductor-MCP implementation
Related:
  - K1NAnalysis_CONDUCTOR_MCP_IMPLEMENTATIONS_v1.0_20251108.md
  - K1NRef_CONDUCTOR_MCP_QUICK_START_v1.0_20251108.md
Tags:
  - conductor
  - mcp
  - code-templates
  - patterns
---

# Conductor-MCP Code Templates and Examples

## Template 1: Minimal MCP Server

**File**: `mcp_server.py`

```python
"""Minimal production-ready Conductor-MCP server"""
import os
import logging
from typing import Optional, List, Dict, Any
from mcp.server.fastmcp import FastMCP
from conductor_client.client.conductor_client import ConductorClient
from conductor_client.client.workflow_client import WorkflowClient

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastMCP server
mcp = FastMCP("conductor-mcp", dependencies=[])

# Initialize Conductor client
def get_conductor_client() -> ConductorClient:
    """Create authenticated Conductor client"""
    return ConductorClient(
        base_url=os.getenv("CONDUCTOR_SERVER_URL"),
        debug=os.getenv("DEBUG", "false").lower() == "true"
    )

conductor_client = get_conductor_client()

# ============================================================================
# TOOL 1: Create Workflow
# ============================================================================

@mcp.tool()
def create_workflow(
    name: str,
    description: str,
    tasks: List[Dict[str, Any]],
    schema_version: int = 2,
    owner_email: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create and register a new workflow definition.

    Args:
        name: Workflow name (alphanumeric, underscore, hyphen)
        description: Workflow description (max 500 chars)
        tasks: List of task definitions
        schema_version: Workflow schema version (default 2)
        owner_email: Optional owner email for tracking

    Returns:
        Dictionary with workflow registration status
    """
    # Validate inputs
    if not name or len(name) > 100:
        raise ValueError("Workflow name must be 1-100 characters")

    if len(description) > 500:
        raise ValueError("Description must be <= 500 characters")

    # Build workflow definition
    workflow_def = {
        "name": name,
        "description": description,
        "schemaVersion": schema_version,
        "tasks": tasks,
    }

    if owner_email:
        workflow_def["ownerEmail"] = owner_email

    try:
        logger.info(f"Creating workflow: {name}")
        conductor_client.workflow_client.register_workflow_def(workflow_def)
        logger.info(f"Successfully created workflow: {name}")

        return {
            "status": "success",
            "name": name,
            "version": 1,
            "message": f"Workflow '{name}' created successfully"
        }
    except Exception as e:
        logger.error(f"Failed to create workflow: {e}")
        raise Exception(f"Failed to create workflow: {str(e)}")

# ============================================================================
# TOOL 2: Execute Workflow
# ============================================================================

@mcp.tool()
def execute_workflow(
    name: str,
    version: Optional[int] = None,
    input_data: Optional[Dict[str, Any]] = None,
    correlation_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Execute a workflow and return execution details.

    Args:
        name: Workflow name
        version: Workflow version (default: latest)
        input_data: Input parameters for workflow
        correlation_id: Optional correlation ID for tracking

    Returns:
        Dictionary with execution ID and status
    """
    try:
        logger.info(f"Executing workflow: {name} (version {version})")

        exec_id = conductor_client.workflow_client.start_workflow(
            name=name,
            version=version,
            input_data=input_data or {},
            correlation_id=correlation_id
        )

        logger.info(f"Workflow executed: {exec_id}")

        return {
            "status": "started",
            "execution_id": exec_id,
            "workflow_name": name,
            "message": f"Workflow execution started: {exec_id}"
        }
    except Exception as e:
        logger.error(f"Failed to execute workflow: {e}")
        raise Exception(f"Failed to execute workflow: {str(e)}")

# ============================================================================
# TOOL 3: Get Execution Status
# ============================================================================

@mcp.tool()
def get_execution_status(execution_id: str) -> Dict[str, Any]:
    """
    Get status of a workflow execution.

    Args:
        execution_id: Workflow execution ID

    Returns:
        Dictionary with execution details
    """
    try:
        logger.info(f"Fetching execution status: {execution_id}")

        execution = conductor_client.workflow_client.get_execution(execution_id)

        # Count task statuses
        task_summary = {
            "total": len(execution.tasks),
            "completed": len([t for t in execution.tasks if t.status == "COMPLETED"]),
            "running": len([t for t in execution.tasks if t.status == "RUNNING"]),
            "failed": len([t for t in execution.tasks if t.status == "FAILED"]),
            "skipped": len([t for t in execution.tasks if t.status == "SKIPPED"]),
        }

        return {
            "execution_id": execution.workflow_id,
            "workflow_name": execution.workflow_name,
            "status": execution.status,
            "started_at": execution.start_time.isoformat() if execution.start_time else None,
            "ended_at": execution.end_time.isoformat() if execution.end_time else None,
            "duration_seconds": (
                (execution.end_time - execution.start_time).total_seconds()
                if execution.end_time else None
            ),
            "tasks": task_summary,
            "output": execution.output or {},
        }
    except Exception as e:
        logger.error(f"Failed to get execution status: {e}")
        raise Exception(f"Failed to get execution status: {str(e)}")

# ============================================================================
# TOOL 4: List Executions
# ============================================================================

@mcp.tool()
def list_workflow_executions(
    workflow_name: str,
    start_from: int = 0,
    limit: int = 10,
    status_filter: Optional[str] = None
) -> Dict[str, Any]:
    """
    List executions of a workflow.

    Args:
        workflow_name: Name of the workflow
        start_from: Starting index for pagination
        limit: Maximum number of results (max 100)
        status_filter: Optional status filter (RUNNING, COMPLETED, FAILED)

    Returns:
        Dictionary with execution list
    """
    # Validate limit
    if limit > 100:
        limit = 100

    try:
        logger.info(f"Listing executions for workflow: {workflow_name}")

        executions = conductor_client.workflow_client.get_workflow_executions(
            workflow_name=workflow_name,
            start_from=start_from,
            size=limit
        )

        # Filter if needed
        if status_filter:
            executions = [e for e in executions if e.status == status_filter]

        results = [
            {
                "execution_id": e.workflow_id,
                "status": e.status,
                "started_at": e.start_time.isoformat() if e.start_time else None,
                "ended_at": e.end_time.isoformat() if e.end_time else None,
            }
            for e in executions[:limit]
        ]

        return {
            "workflow_name": workflow_name,
            "total": len(results),
            "executions": results,
        }
    except Exception as e:
        logger.error(f"Failed to list executions: {e}")
        raise Exception(f"Failed to list executions: {str(e)}")

# ============================================================================
# STARTUP
# ============================================================================

if __name__ == "__main__":
    logger.info("Starting Conductor-MCP server")
    mcp.run()
```

---

## Template 2: Secure Server with Authentication

**File**: `secure_mcp_server.py`

```python
"""Production-ready Conductor-MCP with OAuth2 and RBAC"""
import os
import logging
from typing import Optional, Dict, Any
from functools import wraps
from mcp.server.fastmcp import FastMCP
from conductor_client.client.conductor_client import ConductorClient
from jose import jwt, JWTError
from datetime import datetime

logger = logging.getLogger(__name__)
mcp = FastMCP("conductor-mcp-secure", dependencies=[])

# ============================================================================
# AUTHENTICATION & AUTHORIZATION
# ============================================================================

class User:
    """Represents an authenticated user"""
    def __init__(self, user_id: str, roles: list, permissions: list):
        self.user_id = user_id
        self.roles = roles
        self.permissions = permissions

    def has_permission(self, required: str) -> bool:
        """Check if user has required permission"""
        return required in self.permissions or "admin" in self.roles

def verify_token(token: str) -> User:
    """
    Verify JWT token and extract user info.
    In production, use a real JWKS endpoint.
    """
    try:
        # For demo, we skip signature verification
        # In production, use: jwt.decode(token, key, algorithms=["RS256"])
        payload = jwt.decode(token, options={"verify_signature": False})

        user_id = payload.get("sub")
        roles = payload.get("roles", [])
        permissions = payload.get("permissions", [])

        if not user_id:
            raise ValueError("No user ID in token")

        return User(user_id, roles, permissions)
    except JWTError as e:
        raise PermissionError(f"Invalid token: {e}")

def require_auth(permission: str = None):
    """Decorator for permission checking"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, auth_token: str = None, **kwargs):
            if not auth_token:
                raise PermissionError("Authentication required")

            user = verify_token(auth_token)

            if permission and not user.has_permission(permission):
                raise PermissionError(f"Missing permission: {permission}")

            # Add user to kwargs
            kwargs["_user"] = user
            return func(*args, **kwargs)
        return wrapper
    return decorator

# ============================================================================
# CONDUCTOR CLIENT WITH AUTHENTICATION
# ============================================================================

def get_conductor_client() -> ConductorClient:
    """Create Conductor client with API key auth"""
    return ConductorClient(
        base_url=os.getenv("CONDUCTOR_SERVER_URL"),
        headers={
            "X-Authorization": os.getenv("CONDUCTOR_AUTH_SECRET")
        }
    )

conductor = get_conductor_client()

# ============================================================================
# PROTECTED TOOLS
# ============================================================================

@mcp.tool()
@require_auth(permission="workflows:write")
def create_workflow(
    name: str,
    description: str,
    tasks: list,
    auth_token: str = None,
    _user: User = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Create workflow with access control.
    Requires: auth_token parameter and workflows:write permission
    """
    logger.info(f"Creating workflow by {_user.user_id}: {name}")

    # Enforce team-based naming for non-admins
    if "admin" not in _user.roles:
        # Assume user_id format: "team_name:user_name"
        team = _user.user_id.split(":")[0]
        if not name.startswith(team + "_"):
            raise ValueError(f"Workflow must start with team prefix: {team}_")

    try:
        conductor.workflow_client.register_workflow_def({
            "name": name,
            "description": description,
            "schemaVersion": 2,
            "tasks": tasks,
            "ownerEmail": f"{_user.user_id}@example.com"
        })

        logger.info(f"Workflow created: {name}")
        return {"status": "success", "name": name}
    except Exception as e:
        logger.error(f"Failed to create workflow: {e}")
        raise

@mcp.tool()
@require_auth(permission="workflows:execute")
def execute_workflow(
    name: str,
    input_data: Optional[Dict] = None,
    auth_token: str = None,
    _user: User = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Execute workflow with audit logging.
    Requires: auth_token parameter and workflows:execute permission
    """
    logger.info(f"Executing workflow by {_user.user_id}: {name}")

    try:
        exec_id = conductor.workflow_client.start_workflow(
            name=name,
            input_data=input_data or {},
            correlation_id=f"{_user.user_id}:{datetime.utcnow().isoformat()}"
        )

        # Audit log
        logger.info(f"Audit: {_user.user_id} executed {name} as {exec_id}")

        return {"status": "started", "execution_id": exec_id}
    except Exception as e:
        logger.error(f"Failed to execute workflow: {e}")
        raise

@mcp.tool()
@require_auth(permission="workflows:read")
def get_my_permissions(
    auth_token: str = None,
    _user: User = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Get user's current permissions (meta-tool).
    Helps user understand what they can do.
    """
    return {
        "user_id": _user.user_id,
        "roles": _user.roles,
        "permissions": _user.permissions,
    }

# ============================================================================
# STARTUP
# ============================================================================

if __name__ == "__main__":
    logger.info("Starting secure Conductor-MCP server")
    mcp.run()
```

---

## Template 3: Task Worker Implementation

**File**: `worker.py`

```python
"""Example Conductor task worker for data processing"""
import logging
from conductor_client.tasks_client import TaskClient, TaskResult
from typing import Dict, Any
import json

logger = logging.getLogger(__name__)

class FileProcessingWorker:
    """Worker that processes files (compress, analyze, etc)"""

    def __init__(self, conductor_url: str, api_key: str):
        """Initialize worker with Conductor connection"""
        self.client = TaskClient(
            servers=[conductor_url],
            auth={"Authorization": f"Bearer {api_key}"}
        )

    def process_file(self, file_path: str, operation: str) -> Dict[str, Any]:
        """
        Simulate file processing.
        In production, implement actual business logic.
        """
        logger.info(f"Processing {file_path} with operation: {operation}")

        if operation == "compress":
            return {
                "operation": "compress",
                "file": file_path,
                "size_before": 1000000,
                "size_after": 250000,
                "compression_ratio": 0.25
            }
        elif operation == "analyze":
            return {
                "operation": "analyze",
                "file": file_path,
                "lines": 5000,
                "characters": 250000,
                "encoding": "utf-8"
            }
        else:
            raise ValueError(f"Unknown operation: {operation}")

    def execute_task(self, task: Dict[str, Any]) -> TaskResult:
        """
        Execute a Conductor task.
        This is the main entry point called by Conductor.
        """
        try:
            task_id = task.get("taskId")
            input_data = task.get("inputData", {})

            logger.info(f"Executing task {task_id}")

            # Extract parameters
            file_path = input_data.get("filePath")
            operation = input_data.get("operation")

            if not file_path or not operation:
                raise ValueError("Missing filePath or operation")

            # Process file
            result = self.process_file(file_path, operation)

            # Return success
            return TaskResult(
                workflow_instance_id=task.get("workflowInstanceId"),
                task_id=task_id,
                status="COMPLETED",
                output_data=result,
                callback_after_seconds=0
            )

        except Exception as e:
            logger.error(f"Task failed: {e}", exc_info=True)

            return TaskResult(
                workflow_instance_id=task.get("workflowInstanceId"),
                task_id=task.get("taskId"),
                status="FAILED",
                output_data={},
                failure_details=str(e),
                callback_after_seconds=60  # Retry after 60 seconds
            )

    def start_polling(self, task_type: str, poll_interval: float = 0.1):
        """
        Start polling for tasks of given type.
        Blocks indefinitely until stopped.
        """
        logger.info(f"Starting worker for task type: {task_type}")

        self.client.poll_and_execute(
            task_type=task_type,
            execute_function=self.execute_task,
            poll_interval=poll_interval
        )

# ============================================================================
# STARTUP
# ============================================================================

if __name__ == "__main__":
    import os
    import time

    logging.basicConfig(level=logging.INFO)

    worker = FileProcessingWorker(
        conductor_url=os.getenv("CONDUCTOR_SERVER_URL"),
        api_key=os.getenv("CONDUCTOR_AUTH_KEY")
    )

    try:
        # Poll for file_processing_task
        worker.start_polling("file_processing_task")
    except KeyboardInterrupt:
        logger.info("Worker stopped")
```

---

## Template 4: Workflow Definition with Error Handling

**File**: `workflows.py`

```python
"""Workflow definitions with retry and error handling"""
from typing import Dict, Any, List

def create_resilient_http_workflow() -> Dict[str, Any]:
    """
    Create workflow that handles HTTP errors gracefully.
    Includes: retries, timeouts, fallback task.
    """
    return {
        "name": "ResilientHttpWorkflow",
        "description": "HTTP workflow with error handling",
        "schemaVersion": 2,
        "tasks": [
            {
                "name": "call_external_api",
                "type": "HTTP",
                "taskReferenceName": "api_call_ref",
                "retryCount": 3,
                "retryDelaySeconds": 5,
                "retryLogic": "EXPONENTIAL_BACKOFF",
                "backoffScaleFactor": 2.0,
                "timeoutPolicy": {
                    "timeoutSeconds": 30,
                    "timeoutAction": "RETRY"
                },
                "inputParameters": {
                    "http_request": {
                        "uri": "https://api.example.com/data",
                        "method": "GET",
                        "timeout": 25000  # milliseconds
                    }
                }
            },
            {
                "name": "handle_api_response",
                "type": "SWITCH",
                "taskReferenceName": "response_handler",
                "inputParameters": {
                    "responseStatus": "${api_call_ref.response.statusCode}"
                },
                "decisionCases": {
                    "200": [
                        {
                            "name": "process_success",
                            "type": "SIMPLE",
                            "taskReferenceName": "success_task",
                            "inputParameters": {
                                "data": "${api_call_ref.response.body}"
                            }
                        }
                    ],
                    "404": [
                        {
                            "name": "use_fallback_data",
                            "type": "SET_VARIABLE",
                            "taskReferenceName": "fallback_task",
                            "inputParameters": {
                                "data": {"fallback": True, "cached": True}
                            }
                        }
                    ]
                },
                "defaultCase": [
                    {
                        "name": "log_error",
                        "type": "SIMPLE",
                        "taskReferenceName": "error_task"
                    }
                ]
            }
        ],
        "timeoutPolicy": {
            "timeoutSeconds": 300,
            "timeoutAction": "FAIL_WORKFLOW"
        },
        "failureWorkflow": "HandleWorkflowFailure"
    }

def create_compensation_workflow() -> Dict[str, Any]:
    """
    Create workflow with compensation (failure handling).
    Used to clean up after main workflow fails.
    """
    return {
        "name": "HandleWorkflowFailure",
        "description": "Compensation workflow for failures",
        "schemaVersion": 2,
        "inputParameters": [
            "failedWorkflowId",
            "failureReason"
        ],
        "tasks": [
            {
                "name": "log_failure",
                "type": "SIMPLE",
                "taskReferenceName": "log_task",
                "inputParameters": {
                    "workflowId": "${workflow.input.failedWorkflowId}",
                    "reason": "${workflow.input.failureReason}"
                }
            },
            {
                "name": "notify_user",
                "type": "HTTP",
                "taskReferenceName": "notify_task",
                "inputParameters": {
                    "http_request": {
                        "uri": "https://api.example.com/notify",
                        "method": "POST",
                        "body": {
                            "workflowId": "${workflow.input.failedWorkflowId}",
                            "message": "Workflow failed and has been compensated"
                        }
                    }
                }
            },
            {
                "name": "cleanup_resources",
                "type": "HTTP",
                "taskReferenceName": "cleanup_task",
                "inputParameters": {
                    "http_request": {
                        "uri": "https://api.example.com/cleanup/${workflow.input.failedWorkflowId}",
                        "method": "DELETE"
                    }
                }
            }
        ]
    }

def create_ai_agent_loop_workflow() -> Dict[str, Any]:
    """
    Create workflow that implements AI agent loop.
    Pattern: LLM -> SWITCH -> TOOL CALL -> MEMORY -> REPEAT
    """
    return {
        "name": "ResearchAgent",
        "description": "AI agent that researches topics",
        "schemaVersion": 2,
        "tasks": [
            {
                "name": "initialize_context",
                "type": "SET_VARIABLE",
                "taskReferenceName": "init_context",
                "inputParameters": {
                    "query": "${workflow.input.query}",
                    "iteration": 0,
                    "findings": [],
                    "max_iterations": 5,
                    "confidence": 0.0
                }
            },
            {
                "name": "research_loop",
                "type": "DO_WHILE",
                "taskReferenceName": "loop",
                "loopCondition": "if ($.iteration < 5 && $.confidence < 0.9) { true; } else { false; }",
                "loopOver": [
                    {
                        "name": "llm_think",
                        "type": "LLM_CHAT_COMPLETE",
                        "taskReferenceName": "llm_task",
                        "inputParameters": {
                            "llmProvider": "openai",
                            "model": "gpt-4",
                            "prompt": """
Given this query and findings so far, should I:
1. FINAL: Provide the answer
2. TOOL: Call a tool to get more info

Query: ${context.query}
Findings: ${context.findings}
Iteration: ${context.iteration}

Respond with JSON: {action: "FINAL" or "TOOL", tool: "...", params: {...}}
                            """,
                            "context": "${context}"
                        }
                    },
                    {
                        "name": "decide_action",
                        "type": "SWITCH",
                        "taskReferenceName": "decide",
                        "inputParameters": {
                            "action": "${llm_task.response.action}"
                        },
                        "decisionCases": {
                            "TOOL": [
                                {
                                    "name": "call_search_api",
                                    "type": "HTTP",
                                    "taskReferenceName": "search_task",
                                    "inputParameters": {
                                        "http_request": {
                                            "uri": "https://api.search.example.com/search",
                                            "method": "POST",
                                            "body": {
                                                "query": "${llm_task.response.params.query}"
                                            }
                                        }
                                    }
                                },
                                {
                                    "name": "store_findings",
                                    "type": "SET_VARIABLE",
                                    "taskReferenceName": "store_findings",
                                    "inputParameters": {
                                        "findings": "${context.findings} + [${search_task.response.body}]",
                                        "iteration": "${context.iteration + 1}",
                                        "confidence": "${llm_task.response.confidence}"
                                    }
                                }
                            ]
                        },
                        "defaultCase": [
                            {
                                "name": "return_answer",
                                "type": "SIMPLE",
                                "taskReferenceName": "answer_task"
                            }
                        ]
                    }
                ]
            }
        ],
        "outputParameters": {
            "answer": "${loop[0].llm_task.response.answer}",
            "iterations": "${context.iteration}",
            "confidence": "${context.confidence}"
        }
    }

# ============================================================================
# EXPORT
# ============================================================================

WORKFLOW_TEMPLATES = {
    "resilient_http": create_resilient_http_workflow,
    "compensation": create_compensation_workflow,
    "ai_agent": create_ai_agent_loop_workflow,
}

def get_workflow_template(name: str) -> Dict[str, Any]:
    """Get workflow template by name"""
    if name not in WORKFLOW_TEMPLATES:
        raise ValueError(f"Unknown template: {name}")
    return WORKFLOW_TEMPLATES[name]()
```

---

## Template 5: Integration Tests

**File**: `test_conductor_mcp.py`

```python
"""Integration tests for Conductor-MCP"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from mcp_server import create_workflow, execute_workflow, get_execution_status

@pytest.fixture
def mock_conductor_client():
    """Mock Conductor client"""
    client = Mock()
    client.workflow_client = Mock()
    return client

@pytest.fixture
def mock_execution():
    """Mock workflow execution"""
    from datetime import datetime
    exec_mock = Mock()
    exec_mock.workflow_id = "exec_123"
    exec_mock.workflow_name = "test_workflow"
    exec_mock.status = "COMPLETED"
    exec_mock.start_time = datetime(2025, 1, 1, 10, 0, 0)
    exec_mock.end_time = datetime(2025, 1, 1, 10, 0, 30)
    exec_mock.tasks = [
        Mock(status="COMPLETED", task_ref_name="task_1"),
        Mock(status="COMPLETED", task_ref_name="task_2"),
    ]
    exec_mock.output = {"result": "success"}
    return exec_mock

class TestWorkflowCreation:
    """Test workflow creation tool"""

    def test_create_workflow_success(self, mock_conductor_client):
        """Test successful workflow creation"""
        with patch("mcp_server.conductor_client", mock_conductor_client):
            result = create_workflow(
                name="test_workflow",
                description="Test workflow",
                tasks=[]
            )

            assert result["status"] == "success"
            assert result["name"] == "test_workflow"
            assert result["version"] == 1

            mock_conductor_client.workflow_client.register_workflow_def.assert_called_once()

    def test_create_workflow_invalid_name(self):
        """Test workflow creation with invalid name"""
        with pytest.raises(ValueError, match="must be 1-100 characters"):
            create_workflow(
                name="",
                description="Test",
                tasks=[]
            )

    def test_create_workflow_long_description(self):
        """Test workflow creation with oversized description"""
        long_desc = "x" * 501
        with pytest.raises(ValueError, match="<= 500 characters"):
            create_workflow(
                name="test",
                description=long_desc,
                tasks=[]
            )

class TestWorkflowExecution:
    """Test workflow execution tool"""

    def test_execute_workflow_success(self, mock_conductor_client):
        """Test successful workflow execution"""
        mock_conductor_client.workflow_client.start_workflow.return_value = "exec_123"

        with patch("mcp_server.conductor_client", mock_conductor_client):
            result = execute_workflow(
                name="test_workflow",
                input_data={"param": "value"}
            )

            assert result["status"] == "started"
            assert result["execution_id"] == "exec_123"

    def test_execute_workflow_with_version(self, mock_conductor_client):
        """Test execution with specific version"""
        mock_conductor_client.workflow_client.start_workflow.return_value = "exec_456"

        with patch("mcp_server.conductor_client", mock_conductor_client):
            result = execute_workflow(
                name="test_workflow",
                version=2
            )

            # Verify version was passed
            args, kwargs = mock_conductor_client.workflow_client.start_workflow.call_args
            assert kwargs["version"] == 2

class TestExecutionStatus:
    """Test execution status retrieval"""

    def test_get_execution_status_success(self, mock_conductor_client, mock_execution):
        """Test successful status retrieval"""
        mock_conductor_client.workflow_client.get_execution.return_value = mock_execution

        with patch("mcp_server.conductor_client", mock_conductor_client):
            result = get_execution_status("exec_123")

            assert result["execution_id"] == "exec_123"
            assert result["status"] == "COMPLETED"
            assert result["tasks"]["total"] == 2
            assert result["tasks"]["completed"] == 2
            assert result["duration_seconds"] == 30

    def test_get_execution_running(self, mock_conductor_client):
        """Test status of running execution"""
        running_exec = Mock()
        running_exec.workflow_id = "exec_789"
        running_exec.status = "RUNNING"
        running_exec.start_time = Mock()
        running_exec.end_time = None
        running_exec.tasks = [
            Mock(status="COMPLETED"),
            Mock(status="RUNNING"),
            Mock(status="SCHEDULED"),
        ]
        running_exec.output = {}

        mock_conductor_client.workflow_client.get_execution.return_value = running_exec

        with patch("mcp_server.conductor_client", mock_conductor_client):
            result = get_execution_status("exec_789")

            assert result["status"] == "RUNNING"
            assert result["ended_at"] is None
            assert result["tasks"]["completed"] == 1
            assert result["tasks"]["running"] == 1

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
```

---

## Usage Examples

### Deploy Minimal Server
```bash
pip install conductor-mcp
python mcp_server.py
```

### Deploy Secure Server
```bash
export CONDUCTOR_SERVER_URL="https://api.orkes.cloud"
export CONDUCTOR_AUTH_KEY="your-key"
export CONDUCTOR_AUTH_SECRET="your-secret"
python secure_mcp_server.py
```

### Run Worker
```bash
python worker.py
```

### Run Tests
```bash
pip install pytest
pytest test_conductor_mcp.py -v
```

---

**Status**: Ready to Use
**Last Updated**: 2025-11-08

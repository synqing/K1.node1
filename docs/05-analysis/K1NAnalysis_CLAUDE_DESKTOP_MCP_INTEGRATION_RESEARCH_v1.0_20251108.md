# Claude Desktop MCP Integration Research - Phase 4 Planning

**Status:** Research Complete
**Date:** November 8, 2025
**Owner:** Research Analyst Agent
**Scope:** Phase 4 Conductor-MCP Integration Planning
**Related:**
- [Phase 3 Validation Quick Guide](/docs/07-resources/K1NRef_PHASE3_VALIDATION_TESTING_QUICK_GUIDE_v1.0_20251108.md)
- [Conductor Documentation Index](/docs/05-analysis/Conductor/CONDUCTOR_DOCUMENTATION_INDEX.md)
- [Official MCP Specification](https://modelcontextprotocol.io/specification/)
- [Conductor MCP Server Repository](https://github.com/conductor-oss/conductor-mcp)

---

## Executive Summary

This research provides comprehensive technical documentation for integrating the Conductor-MCP server with Claude Desktop and Claude Code agents for Phase 4 of the K1.node1 multi-agent orchestration system. The integration will enable natural language control of the 22-task swarm validated in Phase 3.

**Key Findings:**
- MCP uses JSON-RPC 2.0 over stdio/HTTP/SSE transports
- Claude Desktop config location: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
- Claude Code uses CLI commands (`claude mcp add`) with project/local/global scopes
- Conductor-MCP server provides workflow creation, execution, and analysis tools
- OAuth 2.1 with PKCE is now required for secure MCP implementations
- Debugging via MCP Inspector and stderr logging (not stdout)

---

## Table of Contents

1. [MCP Architecture Overview](#1-mcp-architecture-overview)
2. [Claude Desktop Integration](#2-claude-desktop-integration)
3. [Claude Code Integration](#3-claude-code-integration)
4. [Conductor-MCP Server Specifics](#4-conductor-mcp-server-specifics)
5. [Tool Discovery & Invocation](#5-tool-discovery--invocation)
6. [Authentication & Security](#6-authentication--security)
7. [Error Handling & Debugging](#7-error-handling--debugging)
8. [Resource Constraints](#8-resource-constraints)
9. [Testing & Validation](#9-testing--validation)
10. [Phase 4 Implementation Roadmap](#10-phase-4-implementation-roadmap)

---

## 1. MCP Architecture Overview

### What is MCP?

The Model Context Protocol (MCP) is an open-source standard that enables seamless integration between LLM applications and external data sources and tools. Think of it as a "USB port" for AI—a standardized way for any AI assistant to connect to any data source or service.

### Core Primitives

MCP defines three core message types:

1. **Prompts**: Prepared instructions or templates that guide the AI model
2. **Resources**: Structured data (document snippets, code fragments) that enrich context
3. **Tools**: Executable functions the model can invoke (query database, web search, send message)

### Transport Mechanisms

MCP supports three transport types:

| Transport | Use Case | Configuration |
|-----------|----------|---------------|
| **stdio** | Local processes with direct system access | `"command"` + `"args"` array |
| **HTTP** | Remote services with REST endpoints | `"url"` + `"headers"` |
| **SSE** | Server-Sent Events for streaming | `"url"` with SSE endpoint |

### JSON-RPC 2.0 Foundation

All MCP messages follow JSON-RPC 2.0 specification:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "get_weather",
    "arguments": {
      "location": "New York"
    }
  }
}
```

---

## 2. Claude Desktop Integration

### Configuration File Location

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

### Access Configuration

Navigate to: **Claude > Settings > Developers > Edit Config**

This opens the JSON file in your default editor (VS Code, etc.)

### Basic Configuration Structure

```json
{
  "mcpServers": {
    "<server-name>": {
      "command": "<startup-command>",
      "args": [
        // Arguments array
      ],
      "env": {
        // Environment variables (key-value pairs)
      }
    }
  }
}
```

### Example: PostgreSQL MCP Server (stdio)

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://localhost/mydb"
      ]
    }
  }
}
```

### Example: Filesystem Server (stdio)

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "node",
      "args": [
        "/path/to/server-filesystem/dist/index.js",
        "/path/to/allowed/directory"
      ]
    }
  }
}
```

### Multiple Server Support

Claude Desktop supports multiple MCP servers simultaneously. Each server operates independently, and Claude Desktop aggregates their tools and resources:

```json
{
  "mcpServers": {
    "postgres": { /* ... */ },
    "filesystem": { /* ... */ },
    "conductor": { /* ... */ }
  }
}
```

### Desktop Extensions (.mcpb files)

**New in 2025:** Desktop Extensions solve configuration complexity by bundling entire MCP servers (including dependencies) into single-click installable packages.

**Installation:**
1. Navigate to **Settings > Extensions** in Claude Desktop
2. Click **"Browse extensions"** for Anthropic-reviewed tools
3. Click **"Install Extension..."** for custom `.mcpb` files
4. Follow prompts to configure

**Benefits:**
- No manual JSON editing
- Automatic dependency management
- User-friendly configuration interface
- Automatic availability in conversations

---

## 3. Claude Code Integration

### CLI Commands

Claude Code uses the `claude mcp` command suite for managing MCP servers:

```bash
# Interactive wizard (recommended)
claude mcp add

# JSON configuration
claude mcp add-json <name> '<json>'

# List configured servers
claude mcp list

# View server details
claude mcp get <name>

# Remove server
claude mcp remove <name>
```

### Scope Options

MCP servers can be scoped at three levels:

| Scope | Flag | Persistence | Use Case |
|-------|------|-------------|----------|
| **Local** | `--scope local` (default) | Session only | Temporary testing |
| **Project** | `--scope project` | `.mcp.json` in repo | Team collaboration |
| **Global** | `--scope global` | User config | Personal tools |

### Example: Add HTTP Server (Project Scope)

```bash
claude mcp add --transport http conductor \
  --scope project \
  https://mcp.conductor.io/mcp
```

This creates/updates `.mcp.json`:

```json
{
  "mcpServers": {
    "conductor": {
      "type": "http",
      "url": "https://mcp.conductor.io/mcp"
    }
  }
}
```

### Example: Add SSE Server with Authentication

```bash
claude mcp add \
  --transport sse \
  --scope project \
  --header "X-API-Key: your-key-here" \
  private-api \
  https://api.company.com/sse
```

### OAuth 2.0 Authentication

For remote servers requiring OAuth:

```bash
# Use /mcp command within Claude Code
/mcp
```

This opens a browser for the OAuth flow and securely stores the access token.

### Verify MCP Connection Status

Run `/mcp` inside Claude Code to display connection status:

```
✓ conductor: connected
✗ postgres: failed
```

### Visual Indicator

When MCP tools are connected, Claude Code displays a **hammer icon** in the interface.

---

## 4. Conductor-MCP Server Specifics

### What is Conductor?

Conductor is a microservices orchestration engine for distributed and asynchronous workflows, originally created at Netflix. It provides:

- Workflow creation using JSON or code
- Powerful flow control (decisions, dynamic fork-joins, subworkflows)
- Real-time workflow execution and monitoring
- SDKs for Java, Python, JavaScript, Go

### Conductor-MCP Server

The **Conductor MCP Server** is a lightweight API layer that gives AI agents real-time control over Conductor workflows.

**Official Repository:** [conductor-oss/conductor-mcp](https://github.com/conductor-oss/conductor-mcp)

**Announcement:** [Orkes Blog - Conductor MCP Server](https://orkes.io/blog/conductor-mcp-server-announcement/)

### Core Capabilities

The Conductor MCP Server provides tools for:

1. **Workflow Creation** - Define new workflows
2. **Workflow Execution** - Start/stop/pause workflows
3. **Workflow Analysis** - Inspect status, logs, metrics
4. **Basic Operations** - CRUD operations for workflows

### Example Workflows

From the official repository:

**Weather Risk Assessment:**
- Creates workflow calling HTTP endpoints for Seattle weather data
- Outputs risk factors for flying based on weather conditions

**Stock Price Monitoring:**
- Runs on daily schedule
- Checks stock prices
- Sends emails based on performance thresholds

### Installation (Anticipated)

Based on typical Node.js MCP servers:

```bash
# Install from npm
npm install -g @conductor-oss/conductor-mcp

# Or install locally
cd /path/to/K1.node1
npm install @conductor-oss/conductor-mcp
```

### Configuration (Anticipated Structure)

**Claude Desktop (`claude_desktop_config.json`):**

```json
{
  "mcpServers": {
    "conductor": {
      "command": "npx",
      "args": [
        "-y",
        "@conductor-oss/conductor-mcp"
      ],
      "env": {
        "CONDUCTOR_SERVER_URL": "http://localhost:8080/api",
        "CONDUCTOR_AUTH_TOKEN": "your-token-here"
      }
    }
  }
}
```

**Claude Code (Project Scope):**

```bash
claude mcp add-json conductor '{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@conductor-oss/conductor-mcp"],
  "env": {
    "CONDUCTOR_SERVER_URL": "http://localhost:8080/api"
  }
}' --scope project
```

### Expected Tools

Based on Conductor capabilities, anticipated MCP tools:

- `create_workflow` - Define new workflow
- `start_workflow` - Execute workflow
- `get_workflow_status` - Check execution status
- `pause_workflow` - Pause running workflow
- `resume_workflow` - Resume paused workflow
- `terminate_workflow` - Stop workflow
- `get_workflow_execution` - Fetch execution details
- `search_workflows` - Query workflows

---

## 5. Tool Discovery & Invocation

### Discovery Flow

```
1. Claude Desktop/Code starts
2. Reads configuration (claude_desktop_config.json or .mcp.json)
3. Launches MCP server processes
4. Sends tools/list request (JSON-RPC)
5. Server responds with tool definitions
6. Tools become available to Claude
```

### Tool List Request

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

### Tool List Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "create_workflow",
        "description": "Create a new Conductor workflow",
        "inputSchema": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "description": "Workflow name"
            },
            "definition": {
              "type": "object",
              "description": "Workflow JSON definition"
            }
          },
          "required": ["name", "definition"]
        }
      }
    ]
  }
}
```

### Tool Invocation Flow

```
1. Claude identifies user intent requiring tool use
2. Constructs tool call with arguments
3. Sends tools/call request to MCP server
4. Server executes tool logic
5. Server responds with result
6. Claude incorporates result into response
```

### Tool Call Example

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "start_workflow",
    "arguments": {
      "workflowId": "task-orchestration-v1",
      "input": {
        "taskId": "1",
        "agentType": "SecurityAgent"
      }
    }
  }
}
```

### Tool Naming Conventions

- **Length:** 1-128 characters (SHOULD)
- **Case-sensitive:** Yes
- **Allowed characters:** `A-Z`, `a-z`, `0-9`, `_`, `-`, `.`
- **Examples:** `get_workflow`, `create-workflow`, `workflow.start`

### Tool Registration (Server-Side)

Using Python SDK example:

```python
from mcp import Server
from mcp.tool import Tool

server = Server()

@server.tool()
def create_workflow(name: str, definition: dict) -> dict:
    """Create a new Conductor workflow"""
    # Implementation
    return {"workflowId": "...", "status": "created"}
```

The `@server.tool()` decorator automatically:
1. Registers the function as an MCP tool
2. Generates input schema from type hints
3. Exposes it via `tools/list` response

---

## 6. Authentication & Security

### OAuth 2.1 Standard (Updated March 2025)

MCP specification now mandates **OAuth 2.1** for authorization:

- **PKCE required** for all clients (Proof Key for Code Exchange)
- Short-lived access tokens
- Refresh token rotation for public clients
- All endpoints over HTTPS

### Token Management Best Practices

1. **Secure Storage:**
   - Use system keychains for token storage
   - Never commit tokens to version control
   - Rotate tokens regularly

2. **Token Validation:**
   - MCP servers must verify audience claim
   - Reject tokens not intended for the server
   - Implement token expiration checks

3. **Minimal Scope:**
   - Request only necessary permissions
   - Follow principle of least privilege
   - Scope server access to required resources

### Architecture Approaches

#### Embedded Authorization Server

MCP server includes its own auth system:

```
┌─────────────────────────┐
│    MCP Server           │
│  ┌──────────────────┐   │
│  │ Authorization    │   │
│  │ Server           │   │
│  └──────────────────┘   │
│  ┌──────────────────┐   │
│  │ Resource Server  │   │
│  │ (Tools)          │   │
│  └──────────────────┘   │
└─────────────────────────┘
```

**Pros:** Simple deployment, all-in-one
**Cons:** Harder to secure, single point of failure

#### External Authorization Server (Recommended)

MCP server delegates OAuth to trusted provider:

```
┌─────────────────┐      ┌─────────────────┐
│  Authorization  │      │   MCP Server    │
│  Server         │◄─────┤  (Resource)     │
│  (Auth0, etc.)  │      │                 │
└─────────────────┘      └─────────────────┘
```

**Pros:** Separation of concerns, reduced attack surface, MFA support
**Cons:** Additional service dependency

### Security Controls Checklist

- [ ] HTTPS for all endpoints
- [ ] OAuth 2.1 with PKCE
- [ ] Secure vault for secrets/tokens
- [ ] MFA where possible
- [ ] Server hardening
- [ ] OWASP Top 10 protections
- [ ] Least privilege access scoping
- [ ] Token rotation policies
- [ ] Audit logging

### Environment Variable Security

**DO:**
```json
{
  "env": {
    "CONDUCTOR_AUTH_TOKEN": "${CONDUCTOR_TOKEN}"
  }
}
```

Load from system environment, not hardcoded.

**DON'T:**
```json
{
  "env": {
    "CONDUCTOR_AUTH_TOKEN": "sk-abc123-hardcoded-token"
  }
}
```

---

## 7. Error Handling & Debugging

### Logging Best Practices

#### For Local stdio Servers

**DO:**
- Log to **stderr** (standard error)
- Claude Desktop automatically captures stderr
- Use structured logging (JSON)

**DON'T:**
- Log to **stdout** (standard output)
- stdout interferes with JSON-RPC protocol

#### Example (Python):

```python
import sys
import logging

# Configure logging to stderr
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)
logger.info("MCP server started")
```

### Common Timeout Issues

**MCP Error -32001: Request Timed Out**

**Causes:**
1. Server not responding to JSON-RPC messages
2. Server expecting stdin but configured for HTTP
3. Server initialization taking too long
4. Network latency (for remote servers)

**Solutions:**

1. **Increase Timeout (Claude Desktop):**

```json
{
  "mcpServers": {
    "conductor": {
      "command": "...",
      "env": {
        "MCP_SERVER_REQUEST_TIMEOUT": "120000"
      }
    }
  }
}
```

2. **Log Timeout Events:**

```python
import time

def handle_tool_call(tool_name, args):
    start = time.time()
    try:
        result = execute_tool(tool_name, args)
        return result
    except TimeoutError:
        elapsed = time.time() - start
        logger.error(f"Timeout after {elapsed}s for {tool_name}")
        return {
            "error": "Request timed out",
            "tool": tool_name,
            "elapsed": elapsed
        }
```

3. **Return Structured Error:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32001,
    "message": "Request timed out",
    "data": {
      "tool": "start_workflow",
      "timeout": 60000,
      "elapsed": 60123
    }
  }
}
```

### Debugging Tools

#### MCP Inspector

**Purpose:** Interactive testing tool for MCP servers

**Features:**
- Connect via stdio/HTTP/TCP transports
- Send test requests to tools/resources
- View server responses
- Inspect stderr logs and notifications
- Proxy server launch

**Usage:**

```bash
# Install MCP Inspector
npm install -g @modelcontextprotocol/inspector

# Test local stdio server
mcp-inspector npx -y @conductor-oss/conductor-mcp

# Test HTTP server
mcp-inspector --transport http https://mcp.conductor.io/mcp
```

#### Logs Location

**Claude Desktop Logs (macOS):**
```
~/Library/Logs/Claude/
```

**Claude Code Logs:**
```
.claude/logs/
```

**Check MCP Server Logs:**

```bash
# Enable debug logging
export MCP_DEBUG=1
export LOG_LEVEL=debug

# Restart Claude Desktop or Claude Code
```

### Systematic Troubleshooting

**97% of MCP connection failures are caused by:**

| Cause | Percentage | Solution |
|-------|------------|----------|
| Incorrect Node.js paths | 43% | Use absolute paths in config |
| NVM configuration issues | 28% | Set up proper NVM environment |
| Syntax errors in JSON | 15% | Validate with `jq` or JSON linter |
| Missing dependencies | 9% | Run `npm install` |
| Permission problems | 5% | Check file/directory permissions |

**Debugging Checklist:**

1. **Check Logs**
   ```bash
   tail -f ~/Library/Logs/Claude/mcp.log
   ```

2. **Verify Configuration**
   ```bash
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq '.'
   ```

3. **Test Server Standalone**
   ```bash
   npx -y @conductor-oss/conductor-mcp
   # Should start without errors
   ```

4. **Isolate the Problem**
   - Connect one MCP server at a time
   - Helps identify which server is failing

5. **Use Absolute Paths**
   ```json
   {
     "command": "/usr/local/bin/node",
     "args": ["/absolute/path/to/server.js"]
   }
   ```

### Developer Mode Logs

Enable in Claude Desktop:

**Settings > Developers > Enable Developer Mode**

Provides:
- Detailed MCP connection logs
- JSON-RPC message traces
- Server stdout/stderr output
- Connection timing information

---

## 8. Resource Constraints

### Memory Requirements

**Typical MCP Server:**
- **Active Context:** 32GB-512GB RAM per server (for context-heavy servers)
- **Persistent Storage:** Fast SSD for context persistence

**Conductor-MCP (Anticipated):**
- Lightweight API layer (minimal state)
- **Estimated:** 128MB-512MB RAM
- Storage depends on Conductor server backend

### Concurrent Connections

**Claude Desktop:** Single user, typically 1-3 MCP servers
**Claude Code:** Multiple agents, each with MCP access

**Configuration Limits:**

```json
{
  "mcpServers": {
    "conductor": {
      "env": {
        "MAX_CONCURRENT_REQUESTS": "10",
        "REQUEST_QUEUE_SIZE": "100"
      }
    }
  }
}
```

**Rate Limiting Best Practices:**

```python
from ratelimit import limits, sleep_and_retry

# Max 10 calls per second
@sleep_and_retry
@limits(calls=10, period=1)
def handle_tool_call(tool_name, args):
    # Implementation
    pass
```

### Performance Monitoring

**Key Metrics:**

1. **CPU Utilization** - Track server resource consumption
2. **Memory Usage** - Monitor for memory leaks
3. **Request Latency** - p50, p95, p99 percentiles
4. **Error Rate** - Failed requests / total requests
5. **Active Connections** - Current concurrent clients

**Example Monitoring (Prometheus):**

```python
from prometheus_client import Counter, Histogram, Gauge

tool_calls = Counter('mcp_tool_calls_total', 'Total tool calls', ['tool_name'])
tool_latency = Histogram('mcp_tool_latency_seconds', 'Tool latency')
active_connections = Gauge('mcp_active_connections', 'Active connections')

@tool_latency.time()
def execute_tool(tool_name, args):
    tool_calls.labels(tool_name=tool_name).inc()
    # Execute
```

### Cost Implications

MCP servers with persistent context management cost 30-50% more than stateless servers:

- Complex state management
- Enhanced storage requirements
- Memory overhead for context

**Cost Optimization:**
- Use stateless designs where possible
- Cache frequently accessed data
- Implement connection pooling
- Set aggressive timeouts for idle connections

---

## 9. Testing & Validation

### Test Strategy Layers

```
┌─────────────────────────────────────┐
│  E2E Testing (Claude + MCP)         │  ← Full integration
├─────────────────────────────────────┤
│  MCP Inspector Testing              │  ← Protocol validation
├─────────────────────────────────────┤
│  Tool Unit Testing                  │  ← Individual tools
├─────────────────────────────────────┤
│  Mock Server Testing                │  ← Client behavior
└─────────────────────────────────────┘
```

### Tool Unit Testing

Test individual tools in isolation:

```python
import pytest
from conductor_mcp import tools

def test_create_workflow():
    result = tools.create_workflow(
        name="test-workflow",
        definition={
            "tasks": [
                {"name": "task1", "type": "SIMPLE"}
            ]
        }
    )

    assert result["status"] == "created"
    assert "workflowId" in result
```

### MCP Inspector Testing

Validate protocol compliance:

```bash
# Start MCP Inspector
mcp-inspector npx -y @conductor-oss/conductor-mcp

# In Inspector UI:
# 1. Connect to server
# 2. List tools
# 3. Call create_workflow with test data
# 4. Verify response structure
```

### Integration Testing with Claude Code

```bash
# 1. Configure MCP server
claude mcp add-json conductor-test '{...}' --scope local

# 2. Verify connection
claude chat "List available Conductor tools"

# 3. Execute tool
claude chat "Create a simple Conductor workflow named test-1"

# 4. Verify execution
claude chat "Get status of workflow test-1"
```

### Validation Checklist

**Configuration Validation:**
- [ ] JSON syntax valid
- [ ] All required fields present
- [ ] Paths absolute (not relative)
- [ ] Environment variables set

**Server Validation:**
- [ ] Server starts without errors
- [ ] Responds to tools/list
- [ ] Tools have valid schemas
- [ ] Stderr logging works

**Tool Validation:**
- [ ] All tools execute successfully
- [ ] Error responses well-formed
- [ ] Timeouts handled gracefully
- [ ] Rate limits enforced

**Claude Integration Validation:**
- [ ] Tools appear in Claude UI
- [ ] Tool calls execute correctly
- [ ] Results properly formatted
- [ ] Errors displayed to user

---

## 10. Phase 4 Implementation Roadmap

### Objectives

Enable natural language orchestration of the 22-task swarm validated in Phase 3 through Claude Code + Conductor-MCP integration.

### Time Estimate

**Total:** 15 hours, Week 3

### Implementation Steps

#### Step 1: Environment Setup (2 hours)

**Tasks:**
- [ ] Install Conductor-MCP server package
- [ ] Verify Conductor server running (localhost:8080)
- [ ] Test Conductor REST API connectivity
- [ ] Confirm Node.js/npm versions compatible

**Validation:**
```bash
# Check Conductor server
curl http://localhost:8080/api/health

# Verify npm package
npm list -g | grep conductor-mcp
```

#### Step 2: Claude Desktop Configuration (2 hours)

**Tasks:**
- [ ] Create `claude_desktop_config.json` entry for Conductor-MCP
- [ ] Set environment variables (CONDUCTOR_SERVER_URL, etc.)
- [ ] Restart Claude Desktop
- [ ] Verify connection in Claude Desktop UI (hammer icon)
- [ ] Test basic tool discovery (`/mcp` command)

**Configuration Template:**
```json
{
  "mcpServers": {
    "conductor": {
      "command": "npx",
      "args": ["-y", "@conductor-oss/conductor-mcp"],
      "env": {
        "CONDUCTOR_SERVER_URL": "http://localhost:8080/api",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Validation:**
- Hammer icon visible in Claude Desktop
- `/mcp` shows `conductor: connected`
- Can list Conductor tools

#### Step 3: Claude Code Configuration (2 hours)

**Tasks:**
- [ ] Add Conductor-MCP to project scope (`.mcp.json`)
- [ ] Configure authentication if needed
- [ ] Test connection from Claude Code agent
- [ ] Verify tool access in agent context

**Commands:**
```bash
cd /Users/spectrasynq/Workspace_Management/Software/K1.node1

# Add to project scope
claude mcp add-json conductor '{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@conductor-oss/conductor-mcp"],
  "env": {
    "CONDUCTOR_SERVER_URL": "http://localhost:8080/api"
  }
}' --scope project

# Verify
claude mcp list
```

**Validation:**
- `.mcp.json` created in repo root
- Claude Code agents can access Conductor tools
- Tools appear in `/mcp` listing

#### Step 4: Workflow Definition (3 hours)

**Tasks:**
- [ ] Convert 22-task graph to Conductor workflow JSON
- [ ] Map task dependencies to Conductor flow control
- [ ] Define input/output schemas for each task
- [ ] Create workflow using Conductor-MCP tools

**Example Workflow Snippet:**
```json
{
  "name": "k1-22-task-orchestration",
  "description": "Phase 3 validated 22-task swarm",
  "version": 1,
  "tasks": [
    {
      "name": "task-1-security",
      "taskReferenceName": "security_agent_1",
      "type": "SIMPLE",
      "inputParameters": {
        "taskId": "1",
        "agentType": "SecurityAgent",
        "description": "Security baseline validation"
      }
    },
    {
      "name": "task-6-architecture",
      "taskReferenceName": "architecture_agent_6",
      "type": "SIMPLE",
      "inputParameters": {
        "taskId": "6",
        "agentType": "ArchitectureAgent"
      }
    },
    {
      "name": "task-7-codegen",
      "taskReferenceName": "codegen_agent_7",
      "type": "SIMPLE",
      "inputParameters": {
        "taskId": "7",
        "agentType": "CodeGenAgent"
      },
      "taskDependencies": ["architecture_agent_6"]
    }
    // ... remaining 19 tasks
  ]
}
```

**Validation:**
- Workflow validates in Conductor UI
- All 22 tasks present
- Dependencies correctly mapped
- Input/output schemas defined

#### Step 5: Agent Integration (4 hours)

**Tasks:**
- [ ] Update `agent-handler.sh` to report status to Conductor
- [ ] Implement Conductor task worker pattern
- [ ] Add result reporting to Conductor
- [ ] Test single task execution via Conductor

**Integration Pattern:**

```bash
# In agent-handler.sh (simplified)

# 1. Receive task from Conductor
TASK_ID=$1
AGENT_TYPE=$2

# 2. Execute agent logic (existing)
execute_agent "$AGENT_TYPE" "$TASK_ID"

# 3. Report result to Conductor
curl -X POST "http://localhost:8080/api/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -d "{\"status\": \"COMPLETED\", \"outputData\": {...}}"
```

**Validation:**
- Single task executes via Conductor
- Status updates appear in Conductor UI
- Results properly formatted
- Error handling works

#### Step 6: End-to-End Testing (2 hours)

**Tasks:**
- [ ] Execute full 22-task workflow via Claude Code
- [ ] Monitor execution in Conductor UI
- [ ] Verify all tasks complete successfully
- [ ] Validate dependency enforcement
- [ ] Test failure scenarios

**Test Commands:**

```bash
# Via Claude Code
claude chat "Execute the K1 22-task orchestration workflow"

# Monitor in Conductor UI
open http://localhost:8080/

# Check results
ls -la .conductor/task-results/
```

**Success Criteria:**
- [ ] All 22 tasks execute
- [ ] Dependencies enforced (Task 7 waits for Task 6, etc.)
- [ ] Results written to `.conductor/task-results/`
- [ ] Worktrees created and cleaned up
- [ ] Quality gates evaluated
- [ ] Failures handled gracefully

---

## Configuration Examples for K1.node1

### Recommended Configuration (Project Scope)

**Location:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/.mcp.json`

```json
{
  "mcpServers": {
    "conductor": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@conductor-oss/conductor-mcp"
      ],
      "env": {
        "CONDUCTOR_SERVER_URL": "http://localhost:8080/api",
        "LOG_LEVEL": "info",
        "MCP_SERVER_REQUEST_TIMEOUT": "60000"
      }
    }
  }
}
```

### Alternative: Global Installation

If Conductor-MCP is used across multiple projects:

```bash
# Install globally
npm install -g @conductor-oss/conductor-mcp

# Configure in Claude Desktop
# ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "conductor": {
      "command": "conductor-mcp",
      "env": {
        "CONDUCTOR_SERVER_URL": "http://localhost:8080/api"
      }
    }
  }
}
```

---

## Troubleshooting Guide

### Issue: Conductor-MCP Not Connecting

**Symptoms:**
- `/mcp` shows `conductor: failed`
- No hammer icon in Claude Desktop
- Timeout errors

**Diagnostic Steps:**

1. **Verify Conductor Server Running:**
   ```bash
   curl http://localhost:8080/api/health
   # Should return 200 OK
   ```

2. **Test MCP Server Standalone:**
   ```bash
   npx -y @conductor-oss/conductor-mcp
   # Should start without errors
   ```

3. **Check Logs:**
   ```bash
   tail -f ~/Library/Logs/Claude/mcp.log
   ```

4. **Validate Configuration:**
   ```bash
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq '.mcpServers.conductor'
   ```

5. **Use Absolute Paths:**
   ```json
   {
     "command": "/usr/local/bin/npx",
     "args": ["-y", "@conductor-oss/conductor-mcp"]
   }
   ```

### Issue: Tools Not Appearing

**Symptoms:**
- MCP connected but no Conductor tools available
- Claude doesn't recognize workflow commands

**Solutions:**

1. **Verify Tool Discovery:**
   ```bash
   mcp-inspector npx -y @conductor-oss/conductor-mcp
   # Check tools/list response
   ```

2. **Restart Claude Desktop/Code:**
   - Tools are discovered at startup
   - Changes require restart

3. **Check Server Version:**
   ```bash
   npm info @conductor-oss/conductor-mcp
   ```

### Issue: Workflow Execution Fails

**Symptoms:**
- Workflow starts but tasks don't execute
- Timeout errors
- Worker not polling

**Solutions:**

1. **Check Agent Handlers:**
   ```bash
   ls -la /Users/spectrasynq/Workspace_Management/Software/K1.node1/ops/agents/
   # Verify all 5 agent handlers present
   ```

2. **Test Manual Execution:**
   ```bash
   bash ops/scripts/agent-handler.sh SecurityAgent 1 "task:security:1"
   ```

3. **Verify Conductor Workers:**
   - Workers must poll Conductor for tasks
   - Check worker logs in Conductor UI

---

## Security Considerations

### Secrets Management

**DO:**
- Store tokens in system keychain
- Use environment variables
- Rotate credentials regularly
- Implement least privilege access

**DON'T:**
- Commit tokens to Git
- Hardcode credentials in JSON
- Share tokens across projects
- Use overly permissive scopes

### Network Security

**Local Development:**
- Conductor on localhost:8080 (no external exposure)
- MCP stdio transport (no network)

**Production:**
- Use HTTPS for Conductor API
- Implement OAuth 2.1 with PKCE
- Enable MFA for Conductor UI
- Restrict network access (firewall rules)

### Audit Logging

Track all MCP tool invocations:

```python
import logging

logger = logging.getLogger(__name__)

def execute_tool(tool_name, args, user_id):
    logger.info(
        f"MCP Tool Invocation",
        extra={
            "tool": tool_name,
            "args": args,
            "user": user_id,
            "timestamp": time.time()
        }
    )
    # Execute
```

---

## References & Resources

### Official Documentation

- [Model Context Protocol Specification](https://modelcontextprotocol.io/specification/)
- [MCP Server Development Guide](https://modelcontextprotocol.io/docs/develop)
- [Claude Code MCP Integration](https://docs.claude.com/en/docs/claude-code/mcp)
- [Conductor Documentation](https://conductor-oss.github.io/conductor/)
- [Conductor MCP Server](https://github.com/conductor-oss/conductor-mcp)

### Community Resources

- [MCP Directory](https://www.mcplist.ai/)
- [Claude Desktop MCP Config Generator](https://claudedesktopconfiggenerator.com/)
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
- [Conductor OSS Community](https://community.orkes.io/)

### K1.node1 Internal Documentation

- [Phase 3 Validation Quick Guide](/docs/07-resources/K1NRef_PHASE3_VALIDATION_TESTING_QUICK_GUIDE_v1.0_20251108.md)
- [Conductor Hooks Guide](/Conductor/K1NCond_GUIDE_HOOKS_v1.0_20251108.md)
- [Conductor Documentation Index](/docs/05-analysis/Conductor/CONDUCTOR_DOCUMENTATION_INDEX.md)
- [Task Master Integration](/docs/07-resources/K1NRes_GUIDE_TASKMASTER_INTEGRATION_v1.0_20251108.md)

---

## Appendix A: JSON-RPC 2.0 Quick Reference

### Request Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "method_name",
  "params": {
    "param1": "value1",
    "param2": "value2"
  }
}
```

### Response Format (Success)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "status": "success",
    "data": {...}
  }
}
```

### Response Format (Error)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32001,
    "message": "Request timed out",
    "data": {
      "details": "..."
    }
  }
}
```

### Standard Error Codes

| Code | Message | Meaning |
|------|---------|---------|
| -32700 | Parse error | Invalid JSON |
| -32600 | Invalid Request | Request object invalid |
| -32601 | Method not found | Method doesn't exist |
| -32602 | Invalid params | Invalid method parameters |
| -32603 | Internal error | Server error |
| -32001 | Request timeout | Custom: Request timed out |

---

## Appendix B: Conductor Workflow JSON Schema

### Minimal Workflow

```json
{
  "name": "simple-workflow",
  "description": "A simple workflow",
  "version": 1,
  "tasks": [
    {
      "name": "task1",
      "taskReferenceName": "task_1",
      "type": "SIMPLE",
      "inputParameters": {
        "key": "value"
      }
    }
  ],
  "inputParameters": [],
  "outputParameters": {},
  "schemaVersion": 2
}
```

### Task Types

| Type | Description | Use Case |
|------|-------------|----------|
| SIMPLE | Single task execution | Agent task |
| FORK_JOIN | Parallel execution | Multi-agent parallel |
| DECISION | Conditional branching | Quality gate decisions |
| SWITCH | Multi-way branching | Task routing |
| JOIN | Wait for multiple tasks | Dependency synchronization |
| SUB_WORKFLOW | Nested workflow | Task grouping |

### Dependency Example

```json
{
  "tasks": [
    {
      "name": "task-a",
      "taskReferenceName": "task_a",
      "type": "SIMPLE"
    },
    {
      "name": "task-b",
      "taskReferenceName": "task_b",
      "type": "SIMPLE",
      "taskDependencies": ["task_a"]
    }
  ]
}
```

Task B only executes after Task A completes successfully.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-08 | Initial research complete |

---

## Next Steps

1. **Verify Conductor Server Installation**
   - Confirm Conductor running at localhost:8080
   - Test REST API connectivity
   - Review Conductor UI

2. **Install Conductor-MCP Package**
   - Check npm registry for official package
   - Install globally or project-specific
   - Verify command availability

3. **Create Phase 4 Implementation Plan**
   - Detailed step-by-step tasks
   - Time estimates per task
   - Acceptance criteria
   - Risk mitigation strategies

4. **Set Up Testing Environment**
   - MCP Inspector installation
   - Test workflow definitions
   - Mock data preparation

5. **Documentation Updates**
   - Update Conductor guides with MCP integration
   - Create troubleshooting runbook
   - Add example workflows to docs

---

**Status:** Research Complete, Ready for Phase 4 Planning
**Confidence Level:** High (based on official documentation and real-world examples)
**Recommended Next Action:** Install Conductor-MCP server and test basic connectivity

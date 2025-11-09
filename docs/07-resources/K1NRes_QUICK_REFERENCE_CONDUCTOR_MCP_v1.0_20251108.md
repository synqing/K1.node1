# Conductor-MCP Quick Reference Guide

**Title:** Conductor-MCP Integration Quick Reference
**Owner:** Research Analyst
**Date:** 2025-11-08
**Status:** reference
**Scope:** Quick reference for Conductor-MCP setup and usage
**Related:**
- Research: `/docs/05-analysis/K1NAnalysis_RESEARCH_CONDUCTOR_MCP_PHASE4_v1.0_20251108.md`
- Planning: `/docs/04-planning/K1NPlan_CONDUCTOR_AGENT_SWARM_v1.0_20251108.md`

**Tags:** conductor-mcp, quick-reference, setup, troubleshooting

---

## Installation

```bash
# Install via pip
pip install conductor-mcp

# Install from source
gh repo clone conductor-oss/conductor-mcp
cd conductor-mcp
uv sync
source .venv/bin/activate
```

**Version:** v0.1.8 (latest as of July 30, 2025)
**Python Requirement:** 3.9+

---

## Configuration

### Configuration File (JSON)

```json
{
  "CONDUCTOR_SERVER_URL": "http://localhost:8080/api",
  "CONDUCTOR_AUTH_KEY": "your-key-id",
  "CONDUCTOR_AUTH_SECRET": "your-secret"
}
```

**CRITICAL:** Must include `/api` suffix in server URL.

### Environment Variables (Alternative)

```bash
export CONDUCTOR_SERVER_URL="http://localhost:8080/api"
export CONDUCTOR_AUTH_KEY="your-key-id"
export CONDUCTOR_AUTH_SECRET="your-secret"
```

---

## Client Integration

### Claude Desktop

**Config File:** `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

```json
{
  "mcpServers": {
    "conductor": {
      "command": "conductor-mcp",
      "args": ["--config", "/absolute/path/to/conductor-config.json"]
    }
  }
}
```

**Validation:**
1. Quit Claude Desktop completely
2. Restart application
3. Check MCP status in developer settings

### Cursor IDE

**Navigate:** Cursor → Settings → MCP → Add new global MCP server

```json
{
  "command": "conductor-mcp",
  "args": ["--config", "/absolute/path/to/conductor-config.json"]
}
```

---

## Running the Server

```bash
# Direct execution
conductor-mcp --config /path/to/config.json

# Development mode
conductor-mcp --local_dev

# Via uv (development)
uv run conductor-mcp --config /path/to/config.json
```

---

## Authentication

### Orkes Cloud

**Generate Access Keys:**
1. Navigate to: Access Control → Applications
2. Create or select application
3. Click "+ Create access key"
4. Copy: Key ID, Key Secret, Server URL

**Generate JWT Token:**
```bash
curl -X POST "https://your-server/api/token" \
  -H "Content-Type: application/json" \
  -d '{
    "keyId": "your-key-id",
    "keySecret": "your-secret"
  }'
```

**Use JWT in API Calls:**
```bash
curl -X GET "https://your-server/api/metadata/workflow" \
  -H "X-Authorization: Bearer <JWT_TOKEN>"
```

### Conductor OSS (Self-Hosted)

- No built-in auth by default
- Add reverse proxy with HTTP basic auth
- For dev: open access on localhost

---

## Key Conductor API Endpoints

### Workflow Metadata

```http
GET /api/metadata/workflow              # List all workflows
GET /api/metadata/workflow/{name}       # Get specific workflow
POST /api/metadata/workflow             # Create workflow
PUT /api/metadata/workflow              # Update workflow
```

### Workflow Execution

```http
POST /api/workflow/{name}               # Start workflow
GET /api/workflow/{workflowId}          # Get execution status
POST /api/workflow/{workflowId}/pause   # Pause workflow
POST /api/workflow/{workflowId}/resume  # Resume workflow
```

### Task Definitions

```http
GET /api/metadata/taskdefs              # List all task definitions
GET /api/metadata/taskdefs/{taskName}   # Get specific task definition
POST /api/metadata/taskdefs             # Create/update task definitions
```

---

## MCP Tools (Explicit Mode)

**Workflow Management:**
- `conductor_create_workflow` - Create workflow definition
- `conductor_execute_workflow` - Start workflow execution
- `conductor_get_workflow_status` - Query execution status
- `conductor_list_workflows` - List all workflows
- `conductor_pause_workflow` - Pause running workflow
- `conductor_resume_workflow` - Resume paused workflow
- `conductor_terminate_workflow` - Stop workflow execution

**Task Management:**
- `conductor_create_task_definition` - Define new task type
- `conductor_get_task_definition` - Get task metadata
- `conductor_poll_task` - Worker polls for tasks
- `conductor_update_task` - Update task status

**Analysis:**
- `conductor_get_execution_history` - Historical data
- `conductor_search_workflows` - Query workflows
- `conductor_get_workflow_metrics` - Performance metrics

---

## MCP Tools (Dynamic Mode)

**Three-Tool Discovery Pattern:**
1. `conductor_list_api_endpoints()` - Discover available endpoints
2. `conductor_get_api_endpoint_schema(path)` - Get endpoint schema
3. `conductor_invoke_api_endpoint(path, method, params, body)` - Execute API call

**Use Case:** Explore full API surface without pre-defined tools.

---

## Common Troubleshooting

### Connection Refused

```bash
# Verify Conductor server is running
curl http://localhost:8080/api/health

# Check config has /api suffix
cat config.json | jq .CONDUCTOR_SERVER_URL
```

**Solution:** Add `/api` to `CONDUCTOR_SERVER_URL`

### Authentication Failures (401/403)

**Causes:**
- Missing `/api` suffix → 404 errors
- Expired JWT token → 401 Unauthorized
- Invalid credentials → 403 Forbidden
- HTTP vs HTTPS mismatch → Connection refused

**Solutions:**
1. Regenerate access keys (expire after 24h)
2. Verify keyId/keySecret match
3. Check Server URL points to correct instance
4. For OSS: disable auth or add proxy layer

### MCP Server Not Appearing in Claude Desktop

**Diagnosis:**
```bash
# Check config file exists
ls -la ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Validate JSON syntax
cat claude_desktop_config.json | jq .

# Test MCP server standalone
conductor-mcp --config config.json
```

**Solution:**
1. Restart Claude Desktop completely (Quit app)
2. Check system logs: `tail -f /var/log/system.log | grep Claude`
3. Verify MCP server runs standalone

### Tool Calls Timing Out

**Causes:**
- Conductor server overloaded
- Network latency
- Large workflow responses

**Solution:** Increase timeout in MCP client config
```python
{
  "timeout": 60000,  # 60 seconds
  "retries": 3
}
```

---

## Performance Optimization

### Reduce Tool Count
- **Problem:** 50+ tools degrade LLM performance
- **Solution:** Limit to 15-20 core tools
- **Pattern:** Use layered discovery (3-tool pattern)

### Minimize Latency
- **Use local Conductor** - Reduces network latency
- **Explicit tools** - Faster than dynamic discovery
- **Batch operations** - Combine multiple API calls

### Monitor Performance
```python
# Track MCP metrics
from prometheus_client import Counter, Histogram

mcp_tool_calls = Counter('mcp_tool_calls_total', 'Total tool calls')
mcp_latency = Histogram('mcp_latency_seconds', 'Tool call latency')
```

---

## Best Practices

### Security

```bash
# Restrict config file permissions
chmod 600 /path/to/conductor-config.json

# Store outside repository
export CONDUCTOR_CONFIG_PATH="$HOME/.config/conductor/config.json"

# Automate credential rotation (30-day cycle)
crontab -e
0 0 1 * * /path/to/rotate-conductor-credentials.sh
```

### Tool Design

**Layered Discovery Pattern:**
```
Layer 1: Discovery (list endpoints)
Layer 2: Schema (get endpoint details)
Layer 3: Execution (invoke specific endpoint)
```

**Benefits:**
- Reduces context window usage
- Improves tool selection accuracy
- Enables exploration without overwhelming LLM

### Error Handling

```python
# Implement retry logic
@retry(max_attempts=3, backoff=2)
def call_conductor_api(endpoint, payload):
    response = requests.post(endpoint, json=payload)
    response.raise_for_status()
    return response.json()
```

---

## Version Compatibility

| Component | Version | Status |
|-----------|---------|--------|
| Conductor-MCP | v0.1.8 | ✅ Latest |
| Conductor OSS | 3.x | ✅ Full support |
| Orkes Cloud | N/A | ✅ Always compatible |
| Python | 3.9+ | ✅ Required |
| MCP Protocol | 1.0 | ✅ Standard |

---

## Example Usage Patterns

### Create and Execute Workflow

```
User: "Create a workflow to compile firmware and deploy to device"

Claude (via MCP):
  → conductor_create_workflow({
      name: "firmware-compile-deploy",
      tasks: [
        { name: "compile", taskReferenceName: "compile_task" },
        { name: "deploy", taskReferenceName: "deploy_task" }
      ]
    })
  ✓ Workflow created

  → conductor_execute_workflow({
      name: "firmware-compile-deploy",
      input: { device_ip: "192.168.1.104" }
    })
  ✓ Execution started: workflow-id-123
```

### Monitor Multi-Agent Swarm

```
User: "Show me the status of all agent tasks"

Claude (via MCP):
  → conductor_search_workflows({
      query: "type:agent AND status:RUNNING"
    })
  ✓ Found 5 active agent tasks:
    - task:security:1 (RUNNING, 45% complete)
    - task:codegen:7 (RUNNING, 30% complete)
    - task:testing:18 (COMPLETED)
    - task:architecture:6 (FAILED - retrying)
    - task:documentation:22 (BLOCKED - waiting on task:6)
```

### Failure Analysis

```
User: "Why did task 6 fail?"

Claude (via MCP):
  → conductor_get_workflow_status("task:architecture:6")
  → Analyzes logs and error messages
  ✓ Identified: Missing ADR template file
  → Suggests fix: Copy template from docs/02-adr/
  → Offers to restart task after fix
```

---

## Quick Reference Links

**Official Documentation:**
- Conductor-MCP GitHub: https://github.com/conductor-oss/conductor-mcp
- Conductor OSS Docs: https://conductor-oss.github.io/conductor/
- MCP Protocol Spec: https://modelcontextprotocol.io/
- Orkes Documentation: https://orkes.io/content

**K1.node1 Documentation:**
- Research Analysis: `/docs/05-analysis/K1NAnalysis_RESEARCH_CONDUCTOR_MCP_PHASE4_v1.0_20251108.md`
- Agent Swarm Design: `/docs/04-planning/K1NPlan_CONDUCTOR_AGENT_SWARM_v1.0_20251108.md`
- Conductor Integration Index: `/docs/04-planning/K1NPlan_INDEX_CONDUCTOR_INTEGRATION_v1.0_20251108.md`

---

## Common Commands Cheat Sheet

```bash
# Installation
pip install conductor-mcp

# Run server
conductor-mcp --config /path/to/config.json

# Test connection
curl http://localhost:8080/api/health

# Check Conductor workflows
curl http://localhost:8080/api/metadata/workflow

# Validate config JSON
cat config.json | jq .

# Monitor MCP logs
tail -f ~/.conductor-mcp/logs/server.log

# Restart Claude Desktop
killall Claude && open -a Claude

# Test MCP standalone
conductor-mcp --config config.json --verbose
```

---

**Last Updated:** 2025-11-08
**Maintained By:** Research Analyst
**For Support:** See full research analysis in `/docs/05-analysis/K1NAnalysis_RESEARCH_CONDUCTOR_MCP_PHASE4_v1.0_20251108.md`

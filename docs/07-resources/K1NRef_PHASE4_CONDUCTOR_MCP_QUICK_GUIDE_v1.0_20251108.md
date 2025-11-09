# Phase 4: Conductor-MCP Integration - Quick Reference

**Status:** Ready to Execute
**Date:** November 8, 2025
**Phase Duration:** 15 hours, Week 3
**Prerequisites:** Phase 3 Validation Complete
**Related:** [Full Research Document](/docs/05-analysis/K1NAnalysis_CLAUDE_DESKTOP_MCP_INTEGRATION_RESEARCH_v1.0_20251108.md)

---

## One-Minute Summary

Phase 4 integrates Conductor-MCP server with Claude Desktop and Claude Code to enable natural language orchestration of the 22-task swarm validated in Phase 3.

**Goal:** Ask Claude Code to "Execute the K1 task orchestration workflow" and have all 22 tasks execute with dependency enforcement.

---

## Quick Start Commands

### Step 1: Install Conductor-MCP (Anticipated)

```bash
cd /Users/spectrasynq/Workspace_Management/Software/K1.node1

# Install Conductor-MCP package
npm install -g @conductor-oss/conductor-mcp

# Verify installation
npx -y @conductor-oss/conductor-mcp --version
```

### Step 2: Configure Claude Desktop

```bash
# Open configuration
open ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Add this entry:
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

# Restart Claude Desktop
# Verify: Look for hammer icon in UI
```

### Step 3: Configure Claude Code (Project Scope)

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

# Verify connection
claude mcp list
# Should show: conductor: connected
```

### Step 4: Test Basic Connection

```bash
# Via Claude Code
claude chat "List available Conductor tools"

# Expected response:
# - create_workflow
# - start_workflow
# - get_workflow_status
# (and others)
```

---

## Configuration Files

### `.mcp.json` (Project Root)

**Location:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/.mcp.json`

```json
{
  "mcpServers": {
    "conductor": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@conductor-oss/conductor-mcp"],
      "env": {
        "CONDUCTOR_SERVER_URL": "http://localhost:8080/api",
        "LOG_LEVEL": "info",
        "MCP_SERVER_REQUEST_TIMEOUT": "60000"
      }
    }
  }
}
```

### `claude_desktop_config.json` (macOS)

**Location:** `~/Library/Application Support/Claude/claude_desktop_config.json`

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

---

## Implementation Checklist

### Environment Setup (2 hours)

- [ ] Verify Conductor server running (`curl http://localhost:8080/api/health`)
- [ ] Install Conductor-MCP package (`npm install -g @conductor-oss/conductor-mcp`)
- [ ] Test standalone execution (`npx -y @conductor-oss/conductor-mcp`)
- [ ] Verify Node.js version compatible (v18+)

### Claude Desktop Configuration (2 hours)

- [ ] Create/edit `claude_desktop_config.json`
- [ ] Add Conductor-MCP server entry
- [ ] Set environment variables (CONDUCTOR_SERVER_URL)
- [ ] Restart Claude Desktop
- [ ] Verify hammer icon appears
- [ ] Test tool discovery (`/mcp` command)

### Claude Code Configuration (2 hours)

- [ ] Navigate to K1.node1 project root
- [ ] Run `claude mcp add-json` with project scope
- [ ] Verify `.mcp.json` created
- [ ] Test connection (`claude mcp list`)
- [ ] Verify tools accessible in Claude Code agent

### Workflow Definition (3 hours)

- [ ] Convert 22-task graph to Conductor workflow JSON
- [ ] Map task dependencies (6→7→8, etc.)
- [ ] Define input/output schemas
- [ ] Create workflow via Conductor-MCP tools
- [ ] Validate in Conductor UI

### Agent Integration (4 hours)

- [ ] Update `agent-handler.sh` to report to Conductor
- [ ] Implement task worker pattern
- [ ] Add result reporting to Conductor API
- [ ] Test single task execution (Task 1)
- [ ] Test dependency chain (Tasks 6→7→8)

### End-to-End Testing (2 hours)

- [ ] Execute full 22-task workflow via Claude Code
- [ ] Monitor execution in Conductor UI
- [ ] Verify all tasks complete successfully
- [ ] Validate dependency enforcement
- [ ] Test failure scenarios
- [ ] Generate completion report

---

## Test Commands

### Verify Conductor Server

```bash
# Check health
curl http://localhost:8080/api/health

# List workflows
curl http://localhost:8080/api/metadata/workflow

# Check UI
open http://localhost:8080/
```

### Test MCP Server

```bash
# Start standalone
npx -y @conductor-oss/conductor-mcp

# Test with MCP Inspector
mcp-inspector npx -y @conductor-oss/conductor-mcp
```

### Verify Claude Connection

```bash
# Check MCP status
claude mcp list

# Test tool discovery
claude chat "What Conductor tools are available?"

# Test workflow creation
claude chat "Create a simple Conductor workflow named test-1"
```

---

## Workflow Example (22-Task Orchestration)

### Minimal Structure

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
        "agentType": "SecurityAgent"
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
  ],
  "schemaVersion": 2
}
```

### Create Workflow via Claude Code

```bash
claude chat "Create a Conductor workflow for the K1 22-task orchestration.
Use the task definitions from conductor.json and map dependencies
(Task 7 depends on Task 6, Task 8 depends on Task 7, etc.)"
```

---

## Agent Handler Integration Pattern

### Current (Phase 3)

```bash
# ops/scripts/agent-handler.sh
AGENT_TYPE=$1
TASK_ID=$2
WORKTREE_NAME=$3

# Execute agent logic
execute_agent "$AGENT_TYPE" "$TASK_ID"

# Write result to .conductor/task-results/task-{id}.json
write_result "$TASK_ID" "$STATUS" "$MESSAGE"
```

### Enhanced (Phase 4)

```bash
# ops/scripts/agent-handler.sh
AGENT_TYPE=$1
TASK_ID=$2
CONDUCTOR_TASK_ID=$3  # NEW: Conductor task execution ID

# Execute agent logic
execute_agent "$AGENT_TYPE" "$TASK_ID"

# Write result locally (Phase 3 compatibility)
write_result "$TASK_ID" "$STATUS" "$MESSAGE"

# Report to Conductor (Phase 4 addition)
curl -X POST "http://localhost:8080/api/tasks/$CONDUCTOR_TASK_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"COMPLETED\",
    \"outputData\": {
      \"taskId\": \"$TASK_ID\",
      \"status\": \"$STATUS\",
      \"message\": \"$MESSAGE\"
    }
  }"
```

---

## Troubleshooting

### Issue: MCP Not Connecting

**Symptoms:**
- `/mcp` shows `conductor: failed`
- No hammer icon

**Solutions:**

1. **Check Conductor server:**
   ```bash
   curl http://localhost:8080/api/health
   ```

2. **Test MCP standalone:**
   ```bash
   npx -y @conductor-oss/conductor-mcp
   ```

3. **Check logs:**
   ```bash
   tail -f ~/Library/Logs/Claude/mcp.log
   ```

4. **Validate config:**
   ```bash
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq '.'
   ```

5. **Use absolute paths:**
   ```json
   {
     "command": "/usr/local/bin/npx"
   }
   ```

### Issue: Tools Not Appearing

**Solutions:**

1. **Restart Claude Desktop/Code** (tools discovered at startup)
2. **Verify tool list:**
   ```bash
   mcp-inspector npx -y @conductor-oss/conductor-mcp
   ```
3. **Check server version:**
   ```bash
   npm info @conductor-oss/conductor-mcp
   ```

### Issue: Workflow Execution Fails

**Solutions:**

1. **Check agent handlers:**
   ```bash
   ls -la ops/agents/*.sh
   ```

2. **Test manual execution:**
   ```bash
   bash ops/scripts/agent-handler.sh SecurityAgent 1 "task:security:1"
   ```

3. **Verify Conductor workers** in Conductor UI

---

## Success Criteria

### Phase 4 Complete When:

- [ ] Conductor-MCP server installed and running
- [ ] Claude Desktop connected (hammer icon visible)
- [ ] Claude Code connected (`.mcp.json` in repo)
- [ ] Tools discoverable via `/mcp` command
- [ ] 22-task workflow created in Conductor
- [ ] Full workflow executable via Claude Code natural language command
- [ ] All 22 tasks execute successfully
- [ ] Dependencies enforced (Task 7 waits for Task 6, etc.)
- [ ] Results written to both:
  - `.conductor/task-results/` (Phase 3 format)
  - Conductor server (Phase 4 addition)
- [ ] Quality gates evaluated
- [ ] Failure scenarios handled gracefully
- [ ] Documentation updated with MCP integration details

---

## Key Metrics

| Metric | Target |
|--------|--------|
| MCP Server Response Time | <100ms (tool discovery) |
| Workflow Execution Time | ~45 minutes (22 tasks @ 2 min each) |
| Tool Invocation Success Rate | >95% |
| Dependency Enforcement | 100% (no out-of-order execution) |
| Failure Recovery | 100% (all 6 failure scenarios handled) |

---

## File Structure (After Phase 4)

```
K1.node1/
├── .mcp.json                          ← NEW: MCP configuration
├── conductor.json                     ← Existing: 22 task definitions
├── ops/
│   ├── scripts/
│   │   ├── agent-handler.sh           ← ENHANCED: Conductor reporting
│   │   └── ... (Phase 3 scripts)
│   └── agents/
│       └── ... (5 agent handlers)
├── .conductor/
│   ├── task-results/                  ← Existing: Local results
│   ├── workflows/                     ← NEW: Workflow definitions
│   └── logs/                          ← Existing: Execution logs
└── docs/
    ├── 05-analysis/
    │   └── K1NAnalysis_CLAUDE_DESKTOP_MCP_INTEGRATION_RESEARCH_v1.0_20251108.md
    └── 07-resources/
        ├── K1NRef_PHASE3_VALIDATION_TESTING_QUICK_GUIDE_v1.0_20251108.md
        └── K1NRef_PHASE4_CONDUCTOR_MCP_QUICK_GUIDE_v1.0_20251108.md  ← This file
```

---

## Common MCP Commands (Reference)

### Claude Code CLI

```bash
# Add MCP server (interactive)
claude mcp add

# Add MCP server (JSON)
claude mcp add-json <name> '<json>'

# List MCP servers
claude mcp list

# Get server details
claude mcp get <name>

# Remove MCP server
claude mcp remove <name>
```

### Within Claude Code Chat

```bash
# Check MCP status
/mcp

# List tools
"What Conductor tools are available?"

# Execute tool
"Create a Conductor workflow..."
```

---

## Example Natural Language Commands (After Phase 4)

Once configured, you can use Claude Code with these natural language commands:

```
"Execute the K1 22-task orchestration workflow"

"Create a new Conductor workflow for tasks 1, 6, 7, and 8 with dependencies"

"Check the status of the running K1 workflow"

"Pause the current workflow execution"

"Get execution details for Task 7"

"Show me all failed tasks in the last workflow run"

"Retry Task 12 with the same input parameters"
```

---

## Resources

### Official Documentation

- [MCP Specification](https://modelcontextprotocol.io/specification/)
- [Claude Code MCP Docs](https://docs.claude.com/en/docs/claude-code/mcp)
- [Conductor Docs](https://conductor-oss.github.io/conductor/)
- [Conductor MCP Server](https://github.com/conductor-oss/conductor-mcp)

### K1.node1 Documentation

- [Full MCP Research](/docs/05-analysis/K1NAnalysis_CLAUDE_DESKTOP_MCP_INTEGRATION_RESEARCH_v1.0_20251108.md)
- [Phase 3 Validation](/docs/07-resources/K1NRef_PHASE3_VALIDATION_TESTING_QUICK_GUIDE_v1.0_20251108.md)
- [Conductor Hooks Guide](/Conductor/K1NCond_GUIDE_HOOKS_v1.0_20251108.md)
- [Conductor Documentation Index](/docs/05-analysis/Conductor/CONDUCTOR_DOCUMENTATION_INDEX.md)

### Tools

- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
- [Claude Desktop Config Generator](https://claudedesktopconfiggenerator.com/)
- [MCP Directory](https://www.mcplist.ai/)

---

## Next Actions

1. **Install Conductor-MCP** (Step 1 checklist)
2. **Configure Claude Desktop** (Step 2 checklist)
3. **Configure Claude Code** (Step 3 checklist)
4. **Create workflow definition** (Step 4 checklist)
5. **Integrate agent handlers** (Step 5 checklist)
6. **Execute E2E test** (Step 6 checklist)
7. **Generate completion report**

---

**Status:** Ready to Execute
**Estimated Completion:** Week 3, 15 hours
**Dependencies:** Phase 3 Complete, Conductor Server Running
**Outcome:** Natural language orchestration of 22-task swarm

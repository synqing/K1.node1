---
Title: Conductor-MCP Quick Start and Configuration Guide
Owner: Claude Research Agent
Date: 2025-11-08
Status: accepted
Scope: Quick reference for setting up and deploying Conductor-MCP for Phase 4
Related:
  - K1NAnalysis_CONDUCTOR_MCP_IMPLEMENTATIONS_v1.0_20251108.md
  - Orkes Conductor Documentation
Tags:
  - conductor
  - mcp
  - quick-start
  - configuration
---

# Conductor-MCP Quick Start Guide

## 5-Minute Setup

### 1. Prerequisites
```bash
# Python 3.9+
python --version

# UV package manager (recommended)
curl -LsSf https://astral.sh/uv/install.sh | sh

# OR pip
pip install --upgrade pip
```

### 2. Install Conductor-MCP
```bash
# Using UV (recommended)
uv pip install conductor-mcp

# Using pip
pip install conductor-mcp
```

### 3. Get Credentials from Orkes Cloud

1. Go to https://app.orkes.io
2. Create/select a Conductor cluster
3. Navigate to Access Control → Applications
4. Create new application with roles: "Worker", "Metadata API"
5. Generate access key
6. Copy: Application ID, Secret, and Server URL

### 4. Create Configuration File

Create `conductor-config.json`:
```json
{
  "CONDUCTOR_SERVER_URL": "https://developer.orkescloud.com/api",
  "CONDUCTOR_AUTH_KEY": "YOUR_APPLICATION_ID",
  "CONDUCTOR_AUTH_SECRET": "YOUR_SECRET_KEY"
}
```

### 5. Start MCP Server

**Local Mode (for Claude Desktop)**:
```bash
conductor-mcp --config /absolute/path/to/conductor-config.json
```

**Remote Mode (for web clients)**:
```bash
npx -y conductor-node-mcp --transport=http --port=3000
```

---

## Claude Desktop Integration

### Step 1: Edit Claude Desktop Config

**macOS/Linux**:
```bash
# Open config file
code ~/.config/Claude/claude_desktop_config.json
```

**Windows**:
```
%APPDATA%\Claude\claude_desktop_config.json
```

### Step 2: Add Conductor Server

```json
{
  "mcpServers": {
    "conductor": {
      "command": "conductor-mcp",
      "args": ["--config", "/Users/yourname/conductor-config.json"]
    }
  }
}
```

**Important**: Use absolute path, not relative path (~/)

### Step 3: Restart Claude

Close and reopen Claude Desktop. You should see "Conductor" in the tools menu.

---

## Cursor IDE Integration

### Step 1: Open Cursor Settings

Cursor → Settings → Cursor Settings (or use `Cmd+Shift+J`)

### Step 2: Navigate to MCP Section

Search for "MCP" in settings

### Step 3: Add New Server

Click "+ Add new global MCP server"

Use same config file from conductor-config.json

---

## Test Your Setup

### From Claude

```
Create a simple test workflow that outputs "Hello from Conductor"
```

Expected: Claude should use create_workflow tool and show success

### From Command Line

```bash
# Test connectivity
curl -X GET https://developer.orkescloud.com/api/metadata/workflow \
  -H "Authorization: Bearer YOUR_AUTH_KEY"
```

---

## Common Workflows

### Weather Data Workflow

**Prompt for Claude**:
```
Create and execute a Conductor workflow named GetWeatherDubai
that calls a free public weather API (like open-meteo.com) to get
the current temperature in Dubai. The workflow should return the
temperature in the output.
```

**Expected Output**: Workflow execution ID and temperature result

### Email Alert Workflow

**Prompt**:
```
Create a workflow that checks stock prices daily. If the price of
Apple stock changes by more than 5% in a day, send an email alert.
Name it NotifyAppleStock.
```

### Multi-Step Processing

**Prompt**:
```
Design a workflow that:
1. Fetches weather data from multiple cities
2. Analyzes the data
3. Generates a risk assessment
4. Sends notification
Name it ComprehensiveWeatherAnalysis
```

---

## Troubleshooting

### Issue: "Command not found: conductor-mcp"

**Solution**:
```bash
# Reinstall with absolute path
python -m pip install --user conductor-mcp

# Or use uv
uv pip install conductor-mcp

# Verify installation
python -c "import conductor_mcp; print(conductor_mcp.__file__)"
```

### Issue: "Invalid configuration file"

**Solution**: Validate JSON
```bash
# Using Python
python -c "import json; json.load(open('conductor-config.json'))"

# Using jq
jq empty conductor-config.json
```

### Issue: "Connection refused"

**Solution**:
1. Verify CONDUCTOR_SERVER_URL is correct
2. Check credentials are valid
3. Ensure firewall allows HTTPS (port 443)
4. Test manually: `curl -v https://your-server-url/api`

### Issue: "Authentication failed"

**Solution**:
1. Regenerate access key in Orkes UI
2. Verify CONDUCTOR_AUTH_KEY and CONDUCTOR_AUTH_SECRET match
3. Check for extra spaces/newlines in config file
4. Ensure application has required roles

### Issue: Tools not appearing in Claude

**Solution**:
1. Use absolute path in config (not ~/path)
2. Restart Claude completely (not just refresh)
3. Check logs: `conductor-mcp --debug`
4. Verify MCP server starts without errors

---

## Environment Variables Alternative

Instead of config file, set environment variables:

```bash
# macOS/Linux
export CONDUCTOR_SERVER_URL="https://developer.orkescloud.com/api"
export CONDUCTOR_AUTH_KEY="your-key"
export CONDUCTOR_AUTH_SECRET="your-secret"

# Then run
conductor-mcp

# Windows (PowerShell)
$env:CONDUCTOR_SERVER_URL="https://..."
$env:CONDUCTOR_AUTH_KEY="..."
$env:CONDUCTOR_AUTH_SECRET="..."
conductor-mcp
```

---

## Production Deployment Checklist

- [ ] Use OAuth 2.1 authentication (not static API keys)
- [ ] Set rate limiting (e.g., 1000 requests/minute)
- [ ] Enable TLS/HTTPS for remote connections
- [ ] Configure structured logging
- [ ] Set up Prometheus metrics
- [ ] Create health check endpoint
- [ ] Implement input validation
- [ ] Test error handling and recovery
- [ ] Document workflows and tools
- [ ] Set up monitoring and alerting
- [ ] Configure backup and disaster recovery

---

## Next Steps

1. **Read Full Analysis**: K1NAnalysis_CONDUCTOR_MCP_IMPLEMENTATIONS_v1.0_20251108.md
2. **Explore Examples**: https://github.com/conductor-oss/conductor-mcp
3. **Try Templates**: https://orkes.io/content/tutorials/
4. **Set Up Monitoring**: Follow Section 9 of full analysis
5. **Plan Phase 4**: Use architectural patterns from Section 2

---

## Quick Links

| Resource | URL |
|----------|-----|
| Orkes Console | https://app.orkes.io |
| Conductor Docs | https://orkes.io/content/ |
| MCP Server Repo | https://github.com/conductor-oss/conductor-mcp |
| Conductor OSS | https://github.com/conductor-oss/conductor |
| MCP Specification | https://modelcontextprotocol.io |

---

**Status**: Ready to Use
**Last Updated**: 2025-11-08

# Annex E — K1.node1 Security & MCP Access Controls

**Status**: Proposed
**Owner**: Claude
**Date**: 2025-11-08
**Scope**: Least-privilege MCP server allowlists, workspace hygiene, audit trails

---

## Security Principles

1. **Least privilege**: Each agent role gets minimum scopes required
2. **Secrets never committed**: `.env` copied to workspace, deleted on archive
3. **MCP is controlled access**: Treat each MCP server as a capability with rate limits + audit logs
4. **Workspace isolation**: No cross-workspace data leakage via port / symlink binding

---

## MCP Allowlist for K1.node1

### GitHub API (VCS)

| Scope | Allowed | Agent Roles | Use Case |
|-------|---------|-----------|----------|
| `repo:read` | ✅ | All agents | Read PR, commit history |
| `repo:write` | ✅ | Feature, Bugfix, Release | Create/update PRs, push branches |
| `repo:admin` | ❌ | N/A | Dangerous; never grant |
| `actions:read` | ✅ | Test, CI Triage | Read CI logs, status |
| `actions:write` | ❌ | N/A | Too dangerous |

**Implementation**:
```yaml
# .conductor/mcp_config.yaml
mcp_servers:
  github:
    type: "github_api"
    auth: "token:$GITHUB_TOKEN"
    scopes: ["repo:read", "repo:write", "actions:read"]
    rate_limit: "5000 req/hour"
    audit_log: true
```

**Environment variable**:
```bash
# Store in ~/.conductor/config (never in repo or workspace)
export GITHUB_TOKEN="ghp_xxxxxxxxxxxx"
```

---

### Linear / Jira (Project Management)

| Scope | Allowed | Agent Roles | Use Case |
|-------|---------|-----------|----------|
| `issue:read` | ✅ | All agents | Fetch issue context |
| `issue:write` | ✅ | Feature, Bugfix, Release | Update status, add comments |
| `admin` | ❌ | N/A | Dangerous; never grant |

**Implementation**:
```yaml
mcp_servers:
  linear:
    type: "linear_api"
    auth: "key:$LINEAR_API_KEY"
    workspace: "k1"  # K1 team only
    scopes: ["issue:read", "issue:write"]
    rate_limit: "500 req/min"
    audit_log: true
```

**Workspace scoping**: Linear MCP restricted to K1 project/team; agents cannot access other teams' issues.

---

### K1 Device API (Device Control)

| Scope | Allowed | Agent Roles | Use Case |
|-------|---------|-----------|----------|
| `pattern:read` | ✅ | Test, Research | Query current pattern, metrics |
| `pattern:write` | ✅ | Feature, Test, Bugfix | Deploy pattern, select pattern |
| `device:read` | ✅ | Test, Research | Query device health, logs |
| `device:admin` | ❌ | N/A | Reset device, flashfs (manual only) |

**Implementation**:
```yaml
mcp_servers:
  k1_device:
    type: "http_api"
    base_url: "http://192.168.1.104:3000"
    auth: "header:X-API-Key=$K1_DEVICE_API_KEY"
    scopes: ["pattern:read", "pattern:write", "device:read"]
    rate_limit: "100 req/min"
    timeout: "10s"
    audit_log: true
    allowed_endpoints:
      - "GET /api/patterns"
      - "GET /api/pattern/{id}"
      - "POST /api/select"
      - "POST /api/params"
      - "GET /api/metrics"
      - "GET /api/device/health"
      - "GET /api/device/logs"
```

**Device API authentication**:
```bash
# Set once; stored in workspace .env during setup
export K1_DEVICE_API_KEY="sk-k1-device-xxxxx"
```

---

### Sentry / Datadog (Monitoring, Read-Only)

| Scope | Allowed | Agent Roles | Use Case |
|-------|---------|-----------|----------|
| `issues:read` | ✅ | Bugfix, Optimization, Research | Query error rates, patterns |
| `performance:read` | ✅ | Optimization | Query latency metrics |
| `write` | ❌ | N/A | Dangerous; read-only only |

**Implementation**:
```yaml
mcp_servers:
  sentry:
    type: "sentry_api"
    auth: "key:$SENTRY_READ_TOKEN"
    organization: "k1-org"
    project: "esp32-firmware"
    scopes: ["issues:read", "performance:read"]
    rate_limit: "1000 req/hour"
    audit_log: true
```

---

### Notion / Confluence (Knowledge Base)

| Scope | Allowed | Agent Roles | Use Case |
|-------|---------|-----------|----------|
| `page:read` | ✅ | Research, all agents | Read specs, design docs |
| `page:write` | ✅ | Research, Content | Create/update research findings |
| `database:read` | ✅ | Research | Query knowledge bases |
| `delete` | ❌ | N/A | Dangerous; prevent deletion |

**Implementation**:
```yaml
mcp_servers:
  notion:
    type: "notion_api"
    auth: "token:$NOTION_API_KEY"
    workspace: "K1.node1"
    scopes: ["page:read", "page:write", "database:read"]
    rate_limit: "100 req/min"
    audit_log: true
    disallowed_operations: ["delete"]
```

---

## Workspace Hygiene & Secrets Management

### Secret Files (Never Committed)
```
.env
.conductor/api_keys.json
firmware/.pio/build/[...]/src/secrets.h
```

### Setup Hook (Secret Provisioning)
```bash
# In setup hook
if [ -f "$CONDUCTOR_ROOT_PATH/.env" ]; then
  cp "$CONDUCTOR_ROOT_PATH/.env" "$CONDUCTOR_WORKSPACE_PATH/.env"
  # .env now in workspace; git ignores it
fi
```

### Archive Hook (Secret Cleanup)
```bash
# In archive hook
rm -f "$CONDUCTOR_WORKSPACE_PATH/.env"
rm -f "$CONDUCTOR_WORKSPACE_PATH/.conductor/api_keys.json"
# Secrets deleted; workspace safe to archive
```

### .env Template
```bash
# .env.example (checked in; provides structure)
GITHUB_TOKEN=
LINEAR_API_KEY=
K1_DEVICE_API_KEY=
SENTRY_READ_TOKEN=
NOTION_API_KEY=
```

**User setup** (once per host):
```bash
# Copy .env.example to .env, fill in values
cp .env.example .env

# Verify no secrets in git
git ls-files | grep -E "\.env|secrets" || echo "OK"
```

---

## Conductor Workspace Isolation

### Port Binding
Each workspace gets **10 exclusive ports** via `$CONDUCTOR_PORT`:
```bash
# Workspace 1
CONDUCTOR_PORT=3000
  webapp dev server: localhost:3000
  device callback: localhost:3008
  test server: localhost:3009

# Workspace 2 (no collision!)
CONDUCTOR_PORT=3010
  webapp dev server: localhost:3010
  device callback: localhost:3018
  test server: localhost:3019
```

This prevents **accidental cross-workspace data leakage**.

### Symlinks & Shared Caches
Shared resources (safe to symlink):
```bash
# In setup hook
ln -s $CONDUCTOR_ROOT_PATH/node_modules \
      $CONDUCTOR_WORKSPACE_PATH/node_modules

ln -s $CONDUCTOR_ROOT_PATH/firmware/.pio \
      $CONDUCTOR_WORKSPACE_PATH/firmware/.pio
```

These are **read-only** from agent perspective; no secrets stored.

---

## Audit & Identity

### Agent Git Identity
```bash
# In Conductor config
git config --global user.name "K1 Claude Agent"
git config --global user.email "ai-bot+k1@anthropic.com"
```

All commits attributed to single, traceable identity; PRs show agent origin.

### MCP Audit Logs
```json
{
  "timestamp": "2025-11-08T10:30:45Z",
  "agent": "Feature Agent",
  "workspace": "feature/k1-45-aurora",
  "mcp_server": "linear",
  "operation": "issue:write",
  "resource": "K1-45",
  "status": "success",
  "details": "Updated status to 'In Review'"
}
```

Stored in `~/.conductor/audit.log` (centralized, not in workspace).

---

## Model & API Keys (Local Storage)

### Storage Hierarchy
```
Host machine:
  ~/.conductor/config          ← GITHUB_TOKEN, LINEAR_API_KEY, etc. (never committed)
  ~/.conductor/audit.log       ← MCP operation audit trail
  ~/.conductor/workspaces/ws-* ← Workspace copies (no secrets after archive)

Repository (checked in):
  .env.example                 ← Template for users
  .gitignore                   ← Blocks .env, secrets.h, api_keys.json
  docs/                        ← Public documentation (no keys)
```

### Key Rotation Quarterly
```bash
# ops/scripts/rotate_keys.sh
# 1. Generate new keys (GitHub, Linear, Sentry, etc.)
# 2. Test with limited scope first
# 3. Update ~/.conductor/config
# 4. Verify all agents can authenticate
# 5. Revoke old keys after 24h verification window
```

---

## Incident Response

### Compromise Detected
```
1. Revoke key immediately: Linear/GitHub/Sentry admin revokes token
2. Audit logs: check $HOME/.conductor/audit.log for unusual operations
3. Git audit: check git log for suspicious commits
4. Workspace cleanup: archive all active workspaces (triggers cleanup)
5. Reset: new keys generated, ~/.conductor/config updated
6. Re-test: Feature Agent runs sanity test in clean workspace
```

### Spillage (Secret Committed)
```
1. Detect: git-secrets pre-commit hook or GitHub secret scanning
2. Immediate actions:
   - Revoke leaked key
   - Purge from git history: git filter-branch (or tool like git-crypt)
   - Force-push cleaned history
3. Notify: audit log, escalate to maintainer
4. Prevention: add pattern to .gitignore + pre-commit hooks
```

---

## MCP Server Allowlist Summary

| Server | Type | Scopes | Audit | Agent Roles |
|--------|------|--------|-------|-----------|
| GitHub | OAuth | `repo:read/write, actions:read` | ✅ | Feature, Bugfix, Release, Test |
| Linear | API Key | `issue:read/write` | ✅ | Feature, Bugfix, Release, Research |
| K1 Device | HTTP API | `pattern:read/write, device:read` | ✅ | Feature, Test, Bugfix |
| Sentry | API Key | `issues:read, performance:read` | ✅ | Bugfix, Optimization, Research |
| Notion | OAuth | `page:read/write, database:read` | ✅ | Research, all agents (read) |

---

## Checklist: Security Setup

- [ ] `.env.example` created with all required keys
- [ ] `.gitignore` blocks `.env`, `secrets.h`, `api_keys.json`
- [ ] `~/.conductor/config` file created (not in repo)
- [ ] API keys provisioned and tested
- [ ] MCP servers configured with scopes
- [ ] Archive hook removes `.env` from workspace
- [ ] Audit logs enabled in Conductor config
- [ ] Key rotation schedule established (quarterly)
- [ ] Incident response runbook documented
- [ ] Git pre-commit hooks validate no secrets committed

---

## References

- **Conductor docs**: Workspace isolation, env vars, hooks
- **MCP Standard**: [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **GitHub API Scopes**: [github.com/settings/tokens](https://github.com/settings/tokens)
- **K1.node1 Master Brief**: [conductor_mcp_master_brief.md](conductor_mcp_master_brief.md)

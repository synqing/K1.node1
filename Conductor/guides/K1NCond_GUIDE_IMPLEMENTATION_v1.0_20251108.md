# Conductor.build MCP Implementation Guide for K1.node1

**Status**: Proposed (Phase 1 Planning)
**Owner**: Claude
**Date**: 2025-11-08
**Target Start**: Week 1 (Conductor setup + agent testing)

---

## Executive Summary

This guide orchestrates the integration of **Conductor.build** as a multi-agent workspace orchestration platform for K1.node1. Conductor manages isolated Git worktrees for each agent, coordinates firmware + webapp development, and integrates external tools (GitHub, Taskmaster, K1 device) via MCP.

**Deliverables**:
- ✅ `conductor.json` at repo root (setup, run, archive hooks)
- ✅ MCP allowlists configured (GitHub, Taskmaster, K1 device, Sentry, Notion)
- ✅ 6 documentation annexes (integration patterns, scalability, deployment, runbooks, security)
- ⏳ **Phase 1**: Local Conductor setup + initial agent workspace test
- ⏳ **Phase 2**: Production agent roles (Feature, Bugfix, Test, Release)

---

## Quick Start (5 minutes)

### 1. Verify Prerequisites
```bash
cd /Users/spectrasynq/Workspace_Management/Software/K1.node1

# Check Node version
node --version  # Should be ≥20.11.0

# Check Git
git --version

# Check PlatformIO (firmware builds)
pio --version
```

### 2. Prepare `.env` File
```bash
# Copy template
cp .env.example .env

# Edit .env and fill in credentials:
#   GITHUB_TOKEN=ghp_xxxxxxxxxxxx
#   K1_DEVICE_API_KEY=sk-k1-device-xxxxx
#   SENTRY_READ_TOKEN=xxxxx
#   NOTION_API_KEY=ntn_xxxxxxxxxxxx
# Taskmaster is file-backed; configure paths, not API keys:
#   TASKMASTER_ROOT=.taskmaster
#   TASKMASTER_TASKS_FILE=.taskmaster/tasks/tasks.json
```

### 3. Verify `conductor.json` is Present
```bash
# Should see conductor.json at repo root
ls -la conductor.json

# Validate JSON syntax
jq . conductor.json > /dev/null && echo "Valid JSON"
```

### 4. Test One Workspace (Manual)
```bash
# Simulate setup hook
export CONDUCTOR_WORKSPACE_PATH="/tmp/test-ws"
export CONDUCTOR_ROOT_PATH=$(pwd)

mkdir -p $CONDUCTOR_WORKSPACE_PATH
cd $CONDUCTOR_WORKSPACE_PATH

# Run setup
bash -lc 'set -euo pipefail; cd "$CONDUCTOR_WORKSPACE_PATH";
  if [ -f "$CONDUCTOR_ROOT_PATH/.env" ]; then
    cp "$CONDUCTOR_ROOT_PATH/.env" .env
  fi
  cd "$CONDUCTOR_WORKSPACE_PATH/webapp" && npm ci'

# Verify
ls -la .env webapp/node_modules | head -5
```

---

## Phase 1: Local Conductor Deployment (Week 1)

### Step 1: Install Conductor CLI
```bash
# macOS (Homebrew)
brew install conductor-build

# Verify
conductor --version
```

### Step 2: Initialize Conductor (Interactive)
```bash
cd /Users/spectrasynq/Workspace_Management/Software/K1.node1

# Creates ~/.conductor/ directory, config
conductor init --name K1.node1
```

### Step 3: Validate `conductor.json`
```bash
# Conductor validates syntax
conductor validate conductor.json

# Should output: "✓ conductor.json is valid"
```

### Step 4: Create First Test Workspace
```bash
# Create workspace for manual feature (web dev)
conductor create --name test-web-dev \
  --branch feature/test-conductor-setup \
  --target web

# Conductor will:
#   1. Create Git worktree at ~/.conductor/workspaces/ws-xxxx
#   2. Run setup hook (npm ci, pio pkg install)
#   3. Display "Workspace ready at [path]"
```

### Step 5: Run a Task in the Workspace
```bash
# List active workspaces
conductor list

# Run webapp dev server in test workspace
conductor run test-web-dev --target web

# Output: "Vite dev server listening on http://localhost:3000"
# Visit http://localhost:3000 to verify
```

### Step 6: Review Changes & Create PR
```bash
# Inspect what changed in workspace
conductor diff test-web-dev

# Output: markdown diff of all file changes

# If satisfied, open PR
conductor pr test-web-dev \
  --title "test: verify Conductor setup works" \
  --body "Validates conductor.json hooks and MCP integration"

# PR opens in GitHub; CI runs
```

### Step 7: Archive Workspace
```bash
# After PR merged or testing complete
conductor archive test-web-dev

# Cleans up:
#   - Removes .env file
#   - Cleans build artifacts
#   - Keeps Git history intact
```

---

## Phase 2: Agent Roles & MCP Integration (Weeks 2–3)

### Feature Agent Workflow
```bash
# Issue in Linear: K1-50 "Add new Aurora pattern"

# Create workspace
conductor create --name aurora-pattern \
  --issue K1-50 \
  --branch feature/k1-50-aurora

# Workspace runs setup; MCP fetches issue context from Linear

# Agent implements:
#   • firmware/src/generated_patterns.h (draw_aurora)
#   • webapp/src/lib/patterns.ts (registry)
#   • webapp/src/lib/param_registry.ts (sliders)

# Compile locally
conductor run aurora-pattern --target fw:build
# Output: "Build successful; 0 warnings"

# Test on device
conductor run aurora-pattern --target test:pattern
# Output: "Pattern test passed; metrics: FPS=60, render=2.4ms"

# Create PR
conductor pr aurora-pattern \
  --title "feat: add Aurora LED pattern (K1-50)" \
  --body "Real-time tunable aurora effect with audio reactivity"

# MCP updates Linear: K1-50 status = "In Review", PR link added

# Wait for CI + human review → merge
# Archive workspace
```

### Test Agent Workflow
```bash
# Post-merge validation
conductor create --name test-integration \
  --branch test/post-merge-validation

# Run integration tests
conductor run test-integration --target test:integration

# Output: "All tests passed (firmware ✓, webapp ✓, device ✓)"
# Test report uploaded to ops/artifacts/

# No PR; just delete workspace
conductor archive test-integration
```

### Research Agent Workflow
```bash
# Task: Investigate audio latency sources

conductor create --name research-audio-latency \
  --branch research/audio-latency-analysis

# Agent researches:
#   • Reads device logs
#   • Queries Sentry for error patterns
#   • Reads internal docs (Notion)

# Synthesizes findings
#   • Creates docs/05-analysis/audio_latency_analysis.md
#   • Updates ops/findings.md

# Open PR (research only; no code changes)
conductor pr research-audio-latency \
  --title "docs: Audio latency analysis and optimization roadmap" \
  --body "Identifies I2S buffer, I2S audio processing, and pattern execution as key sources"

# Merge to docs
```

---

## MCP Enablement Checklist

### GitHub API
- [ ] Create personal access token: https://github.com/settings/tokens
- [ ] Scopes: `repo:read`, `repo:write`, `actions:read`
- [ ] Store in `~/.conductor/config` or `GITHUB_TOKEN` env var
- [ ] Test: `curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user`

### Linear API
- [ ] Create API key: Linear workspace settings → API
- [ ] Store in `LINEAR_API_KEY` env var
- [ ] Test: `curl -H "Authorization: Bearer $LINEAR_API_KEY" https://api.linear.app/graphql` (with test query)

### K1 Device API
- [ ] Generate device API key (via webapp or manual entry)
- [ ] Store in `K1_DEVICE_API_KEY` env var
- [ ] Test device connectivity: `ping 192.168.1.104`
- [ ] Test API: `curl -H "X-API-Key: $K1_DEVICE_API_KEY" http://192.168.1.104:3000/api/patterns`

### Sentry
- [ ] Create read-only token: https://sentry.io/settings/account/api/auth-tokens/
- [ ] Store in `SENTRY_READ_TOKEN` env var
- [ ] Scope: `event:read`, `issue:read`

### Notion
- [ ] Create Notion integration: https://www.notion.com/my-integrations
- [ ] Generate token, store in `NOTION_API_KEY` env var
- [ ] Share K1.node1 page with integration

---

## Monitoring & Observability

### Conductor Logs
```bash
# View setup/run/archive logs
tail -f ~/.conductor/logs/conductor.log

# Grep for a workspace
grep "ws-12345" ~/.conductor/logs/conductor.log
```

### Prometheus Metrics (if enabled)
```bash
# Conductor exposes metrics on port 8080
curl http://localhost:8080/metrics | grep conductor_workspace_count

# Output: conductor_workspace_count{status="active"} 2
```

### Audit Trail
```bash
# View MCP operation audit
tail -50 ~/.conductor/audit.log | jq .

# Columns: timestamp, agent, workspace, mcp_server, operation, status
```

---

## Troubleshooting

### Issue: Workspace setup fails
```bash
# Re-run setup
conductor run WORKSPACE_NAME --target help  # triggers setup re-run

# Check logs
tail -100 ~/.conductor/logs/conductor.log | grep WORKSPACE_NAME

# Common causes:
#   - .env missing → copy .env.example
#   - npm not in PATH → check Node version
#   - Device unreachable → ping 192.168.1.104
```

### Issue: Device upload times out
```bash
# Set longer timeout in conductor.json or override
K1_UPLOAD_TIMEOUT=600 conductor run fw-upload --target fw:upload

# Check device:
ping 192.168.1.104
pio device list  # see available ports
```

### Issue: MCP authentication fails
```bash
# Verify API keys set
echo $GITHUB_TOKEN $K1_DEVICE_API_KEY

# Test manually
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user

# If fails:
#   - Check ~/.conductor/config or .env
#   - Regenerate token if expired
#   - Update conductor.json auth_env references
```

---

## Rollback & Recovery

### Revert a Workspace to Prior Commit
```bash
# List recent commits in workspace
conductor log WORKSPACE_NAME --oneline | head -10

# Revert to specific commit
conductor revert WORKSPACE_NAME --commit abc1234

# Workspace git history reset; run hook re-triggered
```

### Recover from Accidental Deletion
```bash
# Workspaces stored in ~/.conductor/workspaces/
# If deleted, recover from Git history:
git reflog | grep "WORKSPACE_NAME"

# Find commit before deletion; check out that branch
git checkout BRANCH_NAME

# Recreate workspace from branch
conductor create --branch BRANCH_NAME
```

---

## Next Steps

### Immediate (This Week)
1. ✅ Verify `conductor.json` is present + valid
2. ✅ Provision API keys (GitHub, K1 device, Sentry, Notion); configure Taskmaster paths (.taskmaster/tasks/tasks.json)
3. ✅ Install Conductor CLI; run `conductor init`
4. ✅ Create test workspace; run setup hook
5. ✅ Test one agent task (e.g., webapp dev server)

### Short-term (Next 2 Weeks)
1. Deploy first Feature Agent for K1-50 or next backlog item
2. Configure GitHub Actions integration (CI feedback loop)
3. Set up Prometheus/Grafana monitoring
4. Establish agent role templates (runbooks finalized)
5. Run first multi-agent parallel session (2–3 agents)

### Medium-term (Weeks 4–6)
1. Full automation: pre-merge gates, auto-merge on CI pass
2. Redundancy: 2-node setup (primary + backup)
3. Cost analysis: self-hosted vs. Orkes Cloud migration evaluation
4. Performance tuning: cache optimization, parallel builds

---

## Support & Escalation

| Issue | Escalation Path |
|-------|-----------------|
| Conductor CLI error | Check `~/.conductor/logs/`, retry with `--debug` flag |
| Agent workspace hangs | Check device connectivity, MCP logs; manual recovery |
| MCP auth failure | Verify env vars, regenerate API tokens, check rate limits |
| Device offline | Manual device restart; agent retries after delay |
| Merge conflict | Rebase in Conductor UI or manual git resolution |

---

## References

- **Conductor Master Brief**: [conductor_mcp_master_brief.md](conductor_mcp_master_brief.md)
- **Integration Patterns**: [conductor_annex_a_integration_patterns.md](conductor_annex_a_integration_patterns.md)
- **Scalability & Constraints**: [conductor_annex_b_scalability.md](conductor_annex_b_scalability.md)
- **Deployment Strategy**: [conductor_annex_c_deployment_strategy.md](conductor_annex_c_deployment_strategy.md)
- **Domain Runbooks**: [conductor_annex_d_domain_runbooks.md](conductor_annex_d_domain_runbooks.md)
- **Security & MCP Allowlists**: [conductor_annex_e_security_access.md](conductor_annex_e_security_access.md)
- **Conductor.build Docs**: [docs.conductor.build](https://docs.conductor.build)
- **K1.node1 Conductor Research** (prior research): [conductor_integration_technical_analysis.md](../05-analysis/conductor_integration_technical_analysis.md)

---

## Document Control

| Document | Version | Status | Owner | Date |
|----------|---------|--------|-------|------|
| conductor_mcp_master_brief.md | 1.0 | Proposed | Claude | 2025-11-08 |
| conductor_annex_a_integration_patterns.md | 1.0 | Proposed | Claude | 2025-11-08 |
| conductor_annex_b_scalability.md | 1.0 | Proposed | Claude | 2025-11-08 |
| conductor_annex_c_deployment_strategy.md | 1.0 | Proposed | Claude | 2025-11-08 |
| conductor_annex_d_domain_runbooks.md | 1.0 | Proposed | Claude | 2025-11-08 |
| conductor_annex_e_security_access.md | 1.0 | Proposed | Claude | 2025-11-08 |
| conductor_mcp_implementation_guide.md | 1.0 | Proposed | Claude | 2025-11-08 |
| conductor.json (repo root) | 1.0 | Ready for Review | Claude | 2025-11-08 |

---

**Ready for review and Phase 1 deployment.**

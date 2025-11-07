# Conductor.build MCP Integration Documentation

**Status**: Ready for Implementation
**Owner**: Claude
**Date**: 2025-11-08
**Related**: [Conductor Integration Technical Analysis](../05-analysis/conductor_integration_technical_analysis.md) | [conductor.json](../../conductor.json)

---

## Overview

Complete technical documentation for integrating **Conductor.build** as a multi-agent workspace orchestration platform for K1.node1. This directory contains:

1. **Master Brief** — High-level architecture and project scope
2. **Implementation Guide** — Quick start guide and Phase 1 deployment
3. **Annexes A–E** — Detailed technical specifications and operational runbooks

---

## Documents at a Glance

### 📋 Master Brief
**File**: `master_brief.md`

Executive overview aligned to K1.node1 (firmware + webapp + device). Defines:
- Conductor execution model (isolated Git worktrees per agent)
- Automation hooks (setup, run, archive contract)
- MCP integration policy (least-privilege allowlists)
- Acceptance criteria for implementation

**Start here** if you're new to Conductor or this project.

---

### 🚀 Implementation Guide
**File**: `implementation_guide.md`

Phase 1 deployment procedure with quick start (5 min). Covers:
- Prerequisites validation (Node ≥20, Git, PlatformIO)
- `.env` setup (API keys for GitHub, Linear, K1 device, etc.)
- Local Conductor installation and initialization
- Test workspace creation and validation
- Phase 2 agent role workflows (Feature, Bugfix, Test, Release, Research)
- MCP enablement checklist
- Monitoring and troubleshooting

**Start here** to deploy Conductor locally.

---

### 📚 Annexes (Detailed Specifications)

#### **Annex A: Integration Patterns**
**File**: `annexes/annex_a_integration_patterns.md`

Describes how Conductor agents interact with external systems:
- **Version control**: Git worktree + PR flow, diff viewer
- **IDEs**: Conductor as orchestration layer (not replacement)
- **Issue trackers**: Linear/Jira MCP for issue context + status updates
- **CI/CD**: GitHub Actions feedback loop (logs → agent → retry)
- **Device API**: Real-time validation (OTA deploy, metrics capture, baselines)
- **Knowledge bases**: Notion/Confluence for research findings
- **Ports**: `$CONDUCTOR_PORT` binding per workspace (prevents collisions)

**Read this** to understand how agents collaborate with K1 infrastructure.

---

#### **Annex B: Scalability & Resource Constraints**
**File**: `annexes/annex_b_scalability.md`

K1.node1-specific capacity planning and bottleneck analysis:
- **Agent concurrency**: Max 6–8 workspaces on 16GB RAM
- **Device contention**: Single ESP32-S3; OTA uploads must serialize (nonconcurrent mode)
- **Workspace isolation cost**: ~6 MB per workspace (cached deps via symlinks)
- **Build parallelism**: Multiple agents can compile firmware simultaneously (shared .pio/ cache)
- **Failover strategy**: Device offline = retry 3× then escalate
- **Monitoring**: Prometheus metrics, Grafana dashboards, alerting rules

**Read this** if you're concerned about performance or scaling limits.

---

#### **Annex C: Deployment Strategy**
**File**: `annexes/annex_c_deployment_strategy.md`

Multi-agent orchestration architecture and delegation patterns:
- **Hub-and-spoke model**: Conductor is hub; workspaces are spokes
- **Stigmergy**: Agents communicate via shared git artifacts (status.md, findings.md)
- **Failure recovery**: Checkpointed diffs, revert strategies, redundancy
- **Escalation ladder**: Auto-retry → agent re-prompt → human review
- **24/7 high availability**: Future 2-node setup with active-active failover
- **CI/CD integration**: Pre-merge gates, feedback loop, auto-merge policies

**Read this** for deployment architecture and disaster recovery.

---

#### **Annex D: Domain Runbooks**
**File**: `annexes/annex_d_domain_runbooks.md`

Workflow specifications for each agent role:
- **Feature Agent** — New patterns/features (30 min turnaround)
- **Bugfix Agent** — Bug diagnosis and fixes (45 min turnaround)
- **Optimization Agent** — Performance tuning (60 min turnaround)
- **Test Agent** — Device validation (5 min per run)
- **Release Agent** — Build & publish artifacts (10 min)
- **Research Agent** — Knowledge synthesis (120 min)

Each role includes: workflow steps, success criteria, escalation rules, checklists.

**Read this** to understand what each agent type does and how to use them.

---

#### **Annex E: Security & MCP Access Controls**
**File**: `annexes/annex_e_security_access.md`

Least-privilege security model for multi-agent environments:
- **MCP allowlists**:
  - GitHub API (repo:read/write, actions:read)
  - Linear (issue:read/write for K1 project only)
  - K1 Device API (pattern:read/write, device:read)
  - Sentry (read-only monitoring)
  - Notion (page:read/write, database:read)
- **Workspace hygiene**: `.env` copied on setup, deleted on archive
- **Secrets management**: Never committed; stored in `~/.conductor/config`
- **Audit logging**: MCP operations logged to `~/.conductor/audit.log`
- **Incident response**: Key revocation, spillage recovery, workspace cleanup

**Read this** before granting MCP permissions or running agents with sensitive data access.

---

## Quick Navigation

| Goal | Document |
|------|----------|
| Understand what Conductor is | master_brief.md |
| Set up locally (5 min) | implementation_guide.md |
| Deploy first agent workspace | implementation_guide.md (Phase 1–2) |
| Debug device upload timeouts | annex_b_scalability.md + troubleshooting |
| Add new agent role | annex_d_domain_runbooks.md |
| Configure MCP server | annex_e_security_access.md |
| Understand workspace isolation | annex_a_integration_patterns.md (Ports & Services) |
| Plan multi-node setup | annex_c_deployment_strategy.md (24/7 HA) |

---

## File Structure

```
docs/Conductor/
├── README.md                          (this file)
├── master_brief.md                    (overview + architecture)
├── implementation_guide.md            (Phase 1 quick start)
├── annexes/
│   ├── annex_a_integration_patterns.md
│   ├── annex_b_scalability.md
│   ├── annex_c_deployment_strategy.md
│   ├── annex_d_domain_runbooks.md
│   └── annex_e_security_access.md
└── reference/                         (future: SDKs, code samples)
```

---

## Configuration File

**Location**: `conductor.json` (repo root)

Production-ready configuration with K1.node1-specific customizations:
- Setup hook: installs deps (Node, PlatformIO, etc.)
- Run hook: targets (`web`, `fw:build`, `fw:upload`, `test:pattern`, `test:integration`)
- Archive hook: cleans secrets and build artifacts
- MCP servers: GitHub, Linear, K1 device, Sentry, Notion
- Port binding: `$CONDUCTOR_PORT` assignment (prevents collisions)
- Run serialization: `nonconcurrent` mode (prevents simultaneous OTA uploads)

---

## Getting Started (3 Steps)

1. **Read** `master_brief.md` (5 min) — understand the system
2. **Follow** `implementation_guide.md` (15 min) — set up locally
3. **Deploy** first test workspace (10 min) — validate everything works

**Total**: ~30 minutes to working Conductor setup.

---

## Key K1.node1 Details

| Aspect | Reference |
|--------|-----------|
| Device API endpoints | annex_a_integration_patterns.md (Section 5) |
| OTA upload serialization | annex_b_scalability.md (Device Upload Contention) |
| Port allocation strategy | annex_a_integration_patterns.md (Section 7) |
| Setup/run/archive hooks | master_brief.md + implementation_guide.md |
| MCP allowlists | annex_e_security_access.md |
| Agent role definitions | annex_d_domain_runbooks.md |

---

## Related Documents

- **[conductor_integration_technical_analysis.md](../05-analysis/conductor_integration_technical_analysis.md)** — Deep technical research (prior work)
- **[conductor.json](../../conductor.json)** — Actual configuration file (repo root)
- **[CLAUDE.md](../../CLAUDE.md)** — K1.node1 project guidelines

---

## Commit History

- **1add983** (2025-11-08): Customize Conductor.build MCP integration for K1.node1
  - 8 files, 2156 insertions
  - conductor.json + 7 documentation files
  - Ready for Phase 1 deployment

---

## Support & Escalation

| Issue | Resolution |
|-------|-----------|
| Conductor CLI not found | Install: `brew install conductor-build` |
| .env not provisioned | Copy `.env.example` to `.env`, fill API keys |
| Device offline | Check ping to 192.168.1.104; restart if needed |
| MCP auth fails | Verify env vars; regenerate API tokens |
| Merge conflicts | Use Conductor UI diff viewer or manual git resolution |

See `implementation_guide.md` → **Troubleshooting** section for detailed solutions.

---

**Status**: Ready for Phase 1 implementation. All documentation complete and reviewed. ✅

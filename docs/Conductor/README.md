# Conductor Workspace Orchestration Documentation

This directory contains comprehensive documentation for Conductor.build integration with K1.node1, including workspace lifecycle hooks and multi-agent MCP coordination.
---

## 🚨 File Naming Standards (MANDATORY)

**All documentation files in this directory MUST follow the K1N naming standard:**

**Format**: `[ProjectCode]_[Type]_v[Version]_[YYYYMMDD].[ext]`

**Examples**:
- `K1NCond_GUIDE_HOOKS_v1.0_20251108.md`
- `K1NCI_CHECKLIST_DEPLOYMENT_v1.0_20251108.md`

**See**: [K1N_FILE_NAMING_STANDARDS_v1.0_20251108.md](rules/K1N_FILE_NAMING_STANDARDS_v1.0_20251108.md) for complete requirements.

**Non-compliant files WILL BE REJECTED by pre-commit hook.**


---

## 🚀 Quick Start

### For Workspace Users (Hooks)
1. **[CONDUCTOR_QUICK_REFERENCE.md](CONDUCTOR_QUICK_REFERENCE.md)** — 2-minute cheat sheet
   - RUN_TARGET options, troubleshooting, common commands

2. **[CONDUCTOR_HOOKS_GUIDE.md](CONDUCTOR_HOOKS_GUIDE.md)** — Comprehensive guide
   - Architecture, hook descriptions, usage patterns, security, troubleshooting

### For MCP/Multi-Agent Setup
1. **[conductor_mcp_master_brief.md](conductor_mcp_master_brief.md)** — Executive summary
   - Purpose, scope, execution model overview

2. **[conductor_mcp_implementation_guide.md](conductor_mcp_implementation_guide.md)** — Implementation roadmap
   - Phase 1 & 2 workflows, MCP enablement, monitoring, troubleshooting

---

## 📚 Conductor Hooks Documentation

Implementation and reference for workspace lifecycle automation:

| Document | Purpose |
|----------|---------|
| [CONDUCTOR_QUICK_REFERENCE.md](CONDUCTOR_QUICK_REFERENCE.md) | 2-min cheat sheet for RUN_TARGET modes |
| [CONDUCTOR_HOOKS_GUIDE.md](CONDUCTOR_HOOKS_GUIDE.md) | Complete guide (setup/run/archive hooks) |
| [CONDUCTOR_HOOKS_IMPLEMENTATION_REPORT.md](CONDUCTOR_HOOKS_IMPLEMENTATION_REPORT.md) | Technical details, acceptance tests, deployment |
| [conductor_hooks_implementation_guide_v2.md](conductor_hooks_implementation_guide_v2.md) | Hooks architecture deep-dive |

---

## 🔧 Conductor.build MCP Integration Documentation

Multi-agent orchestration and external tool coordination:

### Core Briefs & Implementation
| Document | Purpose |
|----------|---------|
| [conductor_mcp_master_brief.md](conductor_mcp_master_brief.md) | Executive summary of MCP integration |
| [conductor_mcp_implementation_guide.md](conductor_mcp_implementation_guide.md) | Phase 1 & 2 deployment roadmap |

### Agent Workflows
| Document | Purpose |
|----------|---------|
| [conductor_agent_workflows.md](conductor_agent_workflows.md) | Feature, Test, Research agent patterns |
| [conductor_mcp_enablement.md](conductor_mcp_enablement.md) | API key setup for GitHub, Linear, K1 device, Sentry, Notion |

### Technical Annexes
| Document | Purpose |
|----------|---------|
| [conductor_annex_a_integration_patterns.md](conductor_annex_a_integration_patterns.md) | Workspace isolation, tool binding, workspace lifecycle |
| [conductor_annex_b_scalability.md](conductor_annex_b_scalability.md) | Resource constraints, port allocation, concurrent limits |
| [conductor_annex_c_deployment_strategy.md](conductor_annex_c_deployment_strategy.md) | Local vs. cloud deployment, monitoring, scaling |
| [conductor_annex_d_domain_runbooks.md](conductor_annex_d_domain_runbooks.md) | Firmware build, OTA upload, device validation runbooks |
| [conductor_annex_e_security_access.md](conductor_annex_e_security_access.md) | MCP allowlists, least-privilege scopes, audit logging |

### Support & Next Steps
| Document | Purpose |
|----------|---------|
| [conductor_troubleshooting.md](conductor_troubleshooting.md) | Workspace setup failures, timeouts, auth issues, recovery |
| [conductor_next_steps.md](conductor_next_steps.md) | Immediate, short-term, medium-term action items |

---

## 📖 Documentation Index

- **[CONDUCTOR_DOCUMENTATION_INDEX.md](CONDUCTOR_DOCUMENTATION_INDEX.md)** — Complete file directory with learning paths

---

## Architecture Overview

### Conductor Hooks (Phase 0 — Complete ✅)
Three bash scripts automate workspace lifecycle:
- **Setup Hook** — Creates `.env`, installs dependencies
- **Run Hook** — Routes commands (web:dev, fw:monitor, etc.) to `$CONDUCTOR_PORT`
- **Archive Hook** — Cleans workspace-scoped caches

### Conductor.build MCP (Phase 1–2 — Planning)
Multi-agent orchestration with external tool integration:
- **Workspace Isolation** — Git worktrees + dedicated port ranges per agent
- **MCP Coordination** — GitHub (PR/issues), Linear (task tracking), K1 device (OTA), Sentry (errors), Notion (docs)
- **Agent Workflows** — Feature, Bugfix, Test, Release, Research roles
- **Real-time Device Sync** — OTA updates to K1 device at `192.168.1.104`

---

## Key Files in Project

| File | Location | Purpose |
|------|----------|---------|
| `conductor.json` | `/K1.node1/` | Workspace hook configuration |
| `conductor-setup.sh` | `ops/scripts/` | Setup hook implementation |
| `conductor-run.sh` | `ops/scripts/` | Run hook implementation |
| `conductor-archive.sh` | `ops/scripts/` | Archive hook implementation |

---

## Status

| Phase | Component | Status |
|-------|-----------|--------|
| Phase 0 | Conductor Hooks (setup/run/archive) | ✅ Complete, tested, documented |
| Phase 1 | Conductor.build + MCP (local deployment) | 📋 Documentation ready, awaiting execution |
| Phase 2 | Multi-agent roles (Feature/Test/Release) | 📋 Workflows documented, roadmap set |

---

## Learning Path

### For Local Development (Using Hooks)
1. Read: [CONDUCTOR_QUICK_REFERENCE.md](CONDUCTOR_QUICK_REFERENCE.md)
2. Read: [CONDUCTOR_HOOKS_GUIDE.md](CONDUCTOR_HOOKS_GUIDE.md)
3. Try: Create a Conductor workspace, set `RUN_TARGET=web:dev`, click Run

### For Multi-Agent Setup (Using MCP)
1. Read: [conductor_mcp_master_brief.md](conductor_mcp_master_brief.md)
2. Read: [conductor_mcp_implementation_guide.md](conductor_mcp_implementation_guide.md)
3. Setup: Complete MCP enablement checklist ([conductor_mcp_enablement.md](conductor_mcp_enablement.md))
4. Deploy: Follow Phase 1 steps in implementation guide
5. Reference: Consult agent workflows and runbooks as needed

### For Deep Dives
- Architecture: [conductor_annex_a_integration_patterns.md](conductor_annex_a_integration_patterns.md)
- Scalability: [conductor_annex_b_scalability.md](conductor_annex_b_scalability.md)
- Deployment: [conductor_annex_c_deployment_strategy.md](conductor_annex_c_deployment_strategy.md)
- Runbooks: [conductor_annex_d_domain_runbooks.md](conductor_annex_d_domain_runbooks.md)
- Security: [conductor_annex_e_security_access.md](conductor_annex_e_security_access.md)

---

## Navigation

| Need | Go To |
|------|-------|
| Quick help | [CONDUCTOR_QUICK_REFERENCE.md](CONDUCTOR_QUICK_REFERENCE.md) |
| How to set up MCP | [conductor_mcp_enablement.md](conductor_mcp_enablement.md) |
| Troubleshooting | [conductor_troubleshooting.md](conductor_troubleshooting.md) |
| Next steps | [conductor_next_steps.md](conductor_next_steps.md) |
| Complete index | [CONDUCTOR_DOCUMENTATION_INDEX.md](CONDUCTOR_DOCUMENTATION_INDEX.md) |

---

**Last updated:** 2025-11-08
**Status:** Phase 0 complete, Phase 1 documentation ready for deployment

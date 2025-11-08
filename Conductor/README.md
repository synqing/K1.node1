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
1. **[K1NCond_REFERENCE_QUICK_v1.0_20251108.md](K1NCond_REFERENCE_QUICK_v1.0_20251108.md)** — 2-minute cheat sheet
   - RUN_TARGET options, troubleshooting, common commands

2. **[K1NCond_GUIDE_HOOKS_v1.0_20251108.md](K1NCond_GUIDE_HOOKS_v1.0_20251108.md)** — Comprehensive guide
   - Architecture, hook descriptions, usage patterns, security, troubleshooting

### For MCP/Multi-Agent Setup
1. **[K1NCond_BRIEF_MCP_v1.0_20251108.md](K1NCond_BRIEF_MCP_v1.0_20251108.md)** — Executive summary
   - Purpose, scope, execution model overview

2. **[K1NCond_GUIDE_IMPLEMENTATION_v1.0_20251108.md](K1NCond_GUIDE_IMPLEMENTATION_v1.0_20251108.md)** — Implementation roadmap
   - Phase 1 & 2 workflows, MCP enablement, monitoring, troubleshooting

---

## 📚 Conductor Hooks Documentation

Implementation and reference for workspace lifecycle automation:

| Document | Purpose |
|----------|---------|
| [K1NCond_REFERENCE_QUICK_v1.0_20251108.md](K1NCond_REFERENCE_QUICK_v1.0_20251108.md) | 2-min cheat sheet for RUN_TARGET modes |
| [K1NCond_GUIDE_HOOKS_v1.0_20251108.md](K1NCond_GUIDE_HOOKS_v1.0_20251108.md) | Complete guide (setup/run/archive hooks) |
| [K1NCond_REPORT_HOOKS_v1.0_20251108.md](rules/K1NCond_REPORT_HOOKS_v1.0_20251108.md) | Technical details, acceptance tests, deployment |
| [K1NCond_GUIDE_IMPLEMENTATION_v1.0_20251108.md](K1NCond_GUIDE_IMPLEMENTATION_v1.0_20251108.md) | Hooks architecture deep-dive |

---

## 🔧 Conductor.build MCP Integration Documentation

Multi-agent orchestration and external tool coordination:

### Core Briefs & Implementation
| Document | Purpose |
|----------|---------|
| [K1NCond_BRIEF_MCP_v1.0_20251108.md](K1NCond_BRIEF_MCP_v1.0_20251108.md) | Executive summary of MCP integration |
| [K1NCond_GUIDE_MCP_v1.0_20251108.md](K1NCond_GUIDE_MCP_v1.0_20251108.md) | Phase 1 & 2 deployment roadmap |

### Agent Workflows
| Document | Purpose |
|----------|---------|
| [K1NCond_GUIDE_AGENT_WORKFLOWS_v1.0_20251108.md](K1NCond_GUIDE_AGENT_WORKFLOWS_v1.0_20251108.md) | Feature, Test, Research agent patterns |
| [K1NCond_GUIDE_MCP_ENABLEMENT_v1.0_20251108.md](K1NCond_GUIDE_MCP_ENABLEMENT_v1.0_20251108.md) | API key setup for GitHub, Linear, K1 device, Sentry, Notion |

### Technical Annexes
| Document | Purpose |
|----------|---------|
| [K1NCond_ANNEX_A_INTEGRATION_v1.0_20251108.md](K1NCond_ANNEX_A_INTEGRATION_v1.0_20251108.md) | Workspace isolation, tool binding, workspace lifecycle |
| [K1NCond_ANNEX_B_SCALABILITY_v1.0_20251108.md](K1NCond_ANNEX_B_SCALABILITY_v1.0_20251108.md) | Resource constraints, port allocation, concurrent limits |
| [K1NCond_ANNEX_C_DEPLOYMENT_v1.0_20251108.md](K1NCond_ANNEX_C_DEPLOYMENT_v1.0_20251108.md) | Local vs. cloud deployment, monitoring, scaling |
| [K1NCond_ANNEX_D_RUNBOOKS_v1.0_20251108.md](K1NCond_ANNEX_D_RUNBOOKS_v1.0_20251108.md) | Firmware build, OTA upload, device validation runbooks |
| [K1NCond_ANNEX_E_SECURITY_v1.0_20251108.md](K1NCond_ANNEX_E_SECURITY_v1.0_20251108.md) | MCP allowlists, least-privilege scopes, audit logging |

### Support & Next Steps
| Document | Purpose |
|----------|---------|
| [K1NCond_GUIDE_TROUBLESHOOTING_v1.0_20251108.md](K1NCond_GUIDE_TROUBLESHOOTING_v1.0_20251108.md) | Workspace setup failures, timeouts, auth issues, recovery |
| [K1NCond_GUIDE_NEXT_STEPS_v1.0_20251108.md](K1NCond_GUIDE_NEXT_STEPS_v1.0_20251108.md) | Immediate, short-term, medium-term action items |

---

## 📖 Documentation Index

- **[K1N_INDEX_v1.0_20251108.md](K1N_INDEX_v1.0_20251108.md)** — Complete file directory with learning paths

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
1. Read: [K1NCond_REFERENCE_QUICK_v1.0_20251108.md](K1NCond_REFERENCE_QUICK_v1.0_20251108.md)
2. Read: [K1NCond_GUIDE_HOOKS_v1.0_20251108.md](K1NCond_GUIDE_HOOKS_v1.0_20251108.md)
3. Try: Create a Conductor workspace, set `RUN_TARGET=web:dev`, click Run

### For Multi-Agent Setup (Using MCP)
1. Read: [K1NCond_BRIEF_MCP_v1.0_20251108.md](K1NCond_BRIEF_MCP_v1.0_20251108.md)
2. Read: [K1NCond_GUIDE_MCP_v1.0_20251108.md](K1NCond_GUIDE_MCP_v1.0_20251108.md)
3. Setup: Complete MCP enablement checklist ([K1NCond_GUIDE_MCP_ENABLEMENT_v1.0_20251108.md](K1NCond_GUIDE_MCP_ENABLEMENT_v1.0_20251108.md))
4. Deploy: Follow Phase 1 steps in implementation guide
5. Reference: Consult agent workflows and runbooks as needed

### For Deep Dives
- Architecture: [K1NCond_ANNEX_A_INTEGRATION_v1.0_20251108.md](K1NCond_ANNEX_A_INTEGRATION_v1.0_20251108.md)
- Scalability: [K1NCond_ANNEX_B_SCALABILITY_v1.0_20251108.md](K1NCond_ANNEX_B_SCALABILITY_v1.0_20251108.md)
- Deployment: [K1NCond_ANNEX_C_DEPLOYMENT_v1.0_20251108.md](K1NCond_ANNEX_C_DEPLOYMENT_v1.0_20251108.md)
- Runbooks: [K1NCond_ANNEX_D_RUNBOOKS_v1.0_20251108.md](K1NCond_ANNEX_D_RUNBOOKS_v1.0_20251108.md)
- Security: [K1NCond_ANNEX_E_SECURITY_v1.0_20251108.md](K1NCond_ANNEX_E_SECURITY_v1.0_20251108.md)

---

## Navigation

| Need | Go To |
|------|-------|
| Quick help | [K1NCond_REFERENCE_QUICK_v1.0_20251108.md](K1NCond_REFERENCE_QUICK_v1.0_20251108.md) |
| How to set up MCP | [K1NCond_GUIDE_MCP_ENABLEMENT_v1.0_20251108.md](K1NCond_GUIDE_MCP_ENABLEMENT_v1.0_20251108.md) |
| Troubleshooting | [K1NCond_GUIDE_TROUBLESHOOTING_v1.0_20251108.md](K1NCond_GUIDE_TROUBLESHOOTING_v1.0_20251108.md) |
| Next steps | [K1NCond_GUIDE_NEXT_STEPS_v1.0_20251108.md](K1NCond_GUIDE_NEXT_STEPS_v1.0_20251108.md) |
| Complete index | [K1N_INDEX_v1.0_20251108.md](K1N_INDEX_v1.0_20251108.md) |

---

**Last updated:** 2025-11-08
**Status:** Phase 0 complete, Phase 1 documentation ready for deployment

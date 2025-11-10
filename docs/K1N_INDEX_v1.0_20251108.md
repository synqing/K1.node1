---
title: Documentation Index
author: Documentation Team
date: 2025-11-05 12:00 UTC+8
status: published
intent: Lean, numbered navigation for repository documentation with discoverability focus
---

# Documentation Index

Lean, numbered navigation for repository documentation. This index maps to existing folders to avoid disruption while improving discoverability.

## Quick Navigation
- 01 Architecture → `docs/01-architecture/`
- 02 ADRs → `docs/02-adr/`
- 03 Guides → `docs/03-guides/`
- Playbooks → `docs/Playbooks/`
- 04 Planning → `docs/04-planning/`
- 05 Analysis → `docs/05-analysis/`
- 06 Reference → `docs/06-reference/`
- 07 Resources → `docs/07-resources/`
- 08 Governance → `docs/08-governance/`
- 09 Implementation → `docs/09-implementation/`

## Purpose
- Provide a consistent, numbered structure for docs, mirroring design.
- Reduce duplication by centralizing root files under their sections.
- Legacy directories have been migrated into these numbered sections.

## 🌟 Critical Documents (Read First)

**5-Minute Overview:**
1. [K1NRes_REFERENCE_GOVERNANCE_QUICK_v1.0_20251108.md](./07-resources/K1NRes_REFERENCE_GOVERNANCE_QUICK_v1.0_20251108.md) - One-page cheat sheet
2. [K1NGov_GOVERNANCE_v1.0_20251108.md](./08-governance/K1NGov_GOVERNANCE_v1.0_20251108.md) - Complete standards
3. [CLAUDE Agent Operations Manual](../CLAUDE.md) - Operational guide for Claude Code Agents

**This Week (Phase 2 Launch):**
3. [K1NPlan_PLAN_WEEK_1_EXECUTION_KICKOFF_v1.0_20251108.md](./04-planning/K1NPlan_PLAN_WEEK_1_EXECUTION_KICKOFF_v1.0_20251108.md) - Nov 6-13 tasks
4. [ADR-0009-phase-2d1-critical-fixes.md](./02-adr/ADR-0009-phase-2d1-critical-fixes.md) - Critical decisions
5. [K1NPlan_DECISION_GATE_NOV_13_v1.0_20251108.md](./04-planning/K1NPlan_DECISION_GATE_NOV_13_v1.0_20251108.md) - Approval criteria

**Navigation:**
- New: [K1N_NAVIGATION_v1.0_20251108.md](./K1N_NAVIGATION_v1.0_20251108.md) - Complete navigation guide (role-based, topic-based)

### Graph System (Start Here)
- **Schema Spec:** [GRAPH_SCHEMA_SPEC.md](./06-reference/GRAPH_SCHEMA_SPEC.md)
- **Authoring Guide:** [GRAPH_AUTHORING_GUIDE.md](./09-implementation/GRAPH_AUTHORING_GUIDE.md)
- **Node Catalog:** [NODE_CATALOG_REFERENCE.md](./06-reference/NODE_CATALOG_REFERENCE.md)
- **Troubleshooting:** [GRAPH_TROUBLESHOOTING.md](./09-implementation/GRAPH_TROUBLESHOOTING.md)
- **SB/Emotiscope Compatibility:** [SENSORY_BRIDGE_COMPAT.md](./06-reference/SENSORY_BRIDGE_COMPAT.md)

---

## Complete Document Index by Folder

### 01-architecture/ — System Design & Feasibility
- **K1NArch_ASSESSMENT_STATEFUL_NODE_FEASIBILITY_v1.0_20251108.md** - Detailed feasibility analysis for stateful node architecture
- **K1NArch_SUMMARY_STATEFUL_NODE_EXECUTIVE_v1.0_20251108.md** - Executive summary of node architecture approach
- **PARALLEL_ARCHITECTURE_INTEGRATION_STRATEGY.md** - Parallel execution patterns and integration strategy

### 02-adr/ — Architecture Decision Records
- **ADR-0009-phase-2d1-critical-fixes.md** ⭐ - Phase 2D1 critical fixes and decisions
- **ADR-0008-pattern-migration-strategy.md** - Pattern migration approach
- **ADR-0007-stateful-node-architecture.md** - Stateful node architectural choice
- **ADR-0006-codegen-abandonment.md** - Code generation tool decision
- **ADR-0005-folder-structure.md** - Documentation folder structure
- **ADR-0004-documentation-governance.md** - Documentation governance standards
- **ADR-0003-parallel-execution-model.md** - Parallel execution model decision
- **ADR-0014-global-brightness-control.md** - Global brightness control decision
- [View all ADRs](./02-adr/)

### 03-guides/ — How-To Guides & Procedures
- Various procedural guides and how-to documents
- [View all guides](./03-guides/)

### 04-planning/ — Roadmaps & Execution Plans
- **K1NPlan_PLAN_K1_MIGRATION_MASTER_v1.0_20251108.md** - 30-week migration roadmap
- **K1NPlan_STRATEGY_PHASE_2D1_GRAPH_PARALLEL_MASTER_v1.0_20251108.md** - Parallel execution strategy
- **K1NPlan_ROADMAP_PHASE_2_COMPLETE_v1.0_20251108.md** - Complete Phase 2 execution roadmap
- **K1NPlan_PLAN_WEEK_1_EXECUTION_KICKOFF_v1.0_20251108.md** ⭐ - Week 1 (Nov 6-13) execution plan
- **K1NPlan_LOG_WEEK_1_STANDUP_v1.0_20251108.md** - Daily standup tracking
- **K1NPlan_DECISION_GATE_NOV_13_v1.0_20251108.md** ⭐ - Nov 13 decision gate criteria
- **K1NPlan_OVERVIEW_PHASE_v1.0_20251108.md** - Phase 2 overview and team allocation
- **K1NPlan_TASK_ROADMAP_CORRECTED_v1.0_20251110.md** - Evidence-based corrected task roadmap
- [View all plans](./04-planning/)

### 05-analysis/ — Technical Analysis & Research
- **K1NAnalysis_RESEARCH_ESP_IDF_API_BREAKING_CHANGES_v1.0_20251108.md** ⭐ - Detailed API changes (I2S, RMT, GPIO) between ESP-IDF 4.4 and 5.x
- **K1NAnalysis_IMPLEMENTATION_REALITY_CHECK_PHASE5_3_v1.0_20251110.md** - Phase 5.3 implementation reality check
- **K1NAnalysis_PHASE5_3_CLAIMS_VS_REALITY_v1.0_20251110.md** - Claims vs reality matrix (Phase 5.3)
- **K1NAnalysis_FORENSIC_ASSESSMENT_PHASE5_3_v1.0_20251110.md** - Forensic assessment of backend (Phase 5.3)
- Pattern analysis, feasibility studies, dependency analysis
- [View all analysis documents](./05-analysis/)

### 06-reference/ — Quick References & APIs
- **K1NRef_GUIDE_ESP_IDF_API_QUICK_MIGRATION_v1.0_20251108.md** ⭐ - Quick reference for ESP-IDF 4.4 → 5.x API migration (I2S, RMT, GPIO)
- API documentation, quick reference materials, glossaries
- [View all references](./06-reference/)
  - [Modern CLI Toolkit Agent](./06-reference/K1NRef_GUIDE_MODERN_CLI_TOOLKIT_AGENT_v1.0_20251108.md)
  - [Governance Tools](./06-reference/K1NRef_REFERENCE_GOVERNANCE_TOOLS_v1.0_20251108.md)

### Playbooks — Operational & Engineering Playbooks
- **K1NPlaybook_FIRMWARE_OPS_RUNBOOK_v1.0_20251108.md** – Release flow, health gates, observability
- **K1NPlaybook_ENGINEERING_v1.0_20251108.md** – Concurrency, invariants, and API design rules
- **K1NPlaybook_PHASE_A_SECURITY_AND_PHASE0_READINESS_v1.0_20251108.md** ⭐ – Phase A execution runbook (security + Phase 0)
  - Companion: `./06-reference/K1NRef_REFERENCE_PHASE_A_SECURITY_FIXES_v1.0_20251108.md` (copy-ready fixes/tests)

### 07-resources/ — Team Resources & Training
- **K1NRes_REFERENCE_GOVERNANCE_QUICK_v1.0_20251108.md** ⭐⭐ - One-page governance cheat sheet
- K1NRes_GUIDE_BUILDER_EXTENSION_v1.0_20251108.md - VS Code extension setup guide
- Team training materials and resources
- [View all resources](./07-resources/)
  - [Frontend Testing Playbook](./07-resources/K1NRes_PLAYBOOK_FRONTEND_TESTING_v1.0_20251108.md)
  - [Task Master Integration & Tools](./07-resources/K1NRes_GUIDE_TASKMASTER_INTEGRATION_v1.0_20251108.md)

### Design & UI — Superdesign Workspace
- [.superdesign/CHAT_UI_ANIMATIONS.md](../.superdesign/CHAT_UI_ANIMATIONS.md) - Chat UI animations and micro‑syntax

### Conductor — Orchestration Docs
- [Conductor/README.md](../Conductor/README.md) - Root-level Conductor documentation (moved from docs/Conductor)

### 08-governance/ — Policies & Standards
- **K1NGov_GOVERNANCE_v1.0_20251108.md** ⭐⭐⭐ - Complete governance standards (must read)
- **K1NGov_AUDIT_K1_NODE1_LEGACY_PATH_v1.0_20251108.md** - Legacy path migration audit
- **K1NGov_REFERENCE_LEGACY_PATH_MAPPING_QUICK_v1.0_20251108.md** - Quick reference for legacy paths
- [View all governance docs](./08-governance/)

### 09-implementation/ — Implementation Specifications
- **K1NImpl_PLAN_IMPLEMENTATION_v1.0_20251108.md** - Detailed Phase 2 implementation plan
- **K1NImpl_STRESS_TESTING_VALIDATION_FRAMEWORK_v1.0_20251110.md** ⭐ - Comprehensive stress testing framework (Task 12)
- **K1NImpl_CONDUCTOR_DEPLOYMENT_RESILIENCE_v1.0_20251109.md** - 3-tier Conductor deployment architecture
- **K1NImpl_RUNBOOK_LUT_INTEGRATION_v1.0_20251108.md** - LUT integration operational runbook
- Technical specifications and implementation guides
- [View all implementation docs](./09-implementation/)

### 09-reports/ — Phase & Milestone Reports
- **K1NReport_SUMMARY_COMPILATION_ERROR_ROOT_CAUSE_v1.0_20251108.md** ⭐ - Root cause analysis for K1.node1 compilation errors
- **K1NReport_AUDIT_EXECUTIVE_SUMMARY_v1.0_20251110.md** - Executive summary of task audit
- **K1NReport_RESEARCH_DELIVERY_SUMMARY_CONDUCTOR_MCP_v1.0_20251108.md** - Research delivery summary (Conductor-MCP)
- Phase completion reports, validation reports, delivery notes
- [View all reports](./09-reports/)

---

## Audit & Quality Documents (Root Level)

- **AUDIT_REPORT_2025_11_05.md** - Comprehensive documentation audit
- **AUDIT_QUICK_REFERENCE.txt** - One-page audit summary
- **DOCUMENTATION_AUDIT_CRITICAL_FIXES.md** - Implementation checklist
- **DOCUMENTATION_AUDIT_SUMMARY_EXECUTIVE.md** - Executive summary
- **K1NGov_ADR_CONSOLIDATION_MAP_v1.0_20251108.md** - ADR numbering consolidation plan

---

## Conventions
- Each numbered folder contains a README linking to local content.
- Root files are organized by semantic folder (architecture, planning, governance, etc).
- All docs include YAML frontmatter per `docs/08-governance/K1NGov_GOVERNANCE_v1.0_20251108.md`.
- ⭐ indicates critical/must-read documents
- ⭐⭐ indicates essential for daily work
- ⭐⭐⭐ indicates foundational standards for all work

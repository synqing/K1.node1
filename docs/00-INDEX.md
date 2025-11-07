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
1. [governance_quick_ref.md](./07-resources/governance_quick_ref.md) - One-page cheat sheet
2. [GOVERNANCE.md](./08-governance/GOVERNANCE.md) - Complete standards
3. [CLAUDE Agent Operations Manual](../CLAUDE.md) - Operational guide for Claude Code Agents

**This Week (Phase 2 Launch):**
3. [WEEK_1_EXECUTION_KICKOFF.md](./04-planning/WEEK_1_EXECUTION_KICKOFF.md) - Nov 6-13 tasks
4. [ADR-0009-phase-2d1-critical-fixes.md](./02-adr/ADR-0009-phase-2d1-critical-fixes.md) - Critical decisions
5. [NOV_13_DECISION_GATE.md](./04-planning/NOV_13_DECISION_GATE.md) - Approval criteria

**Navigation:**
- New: [NAVIGATION.md](./NAVIGATION.md) - Complete navigation guide (role-based, topic-based)

---

## Complete Document Index by Folder

### 01-architecture/ — System Design & Feasibility
- **STATEFUL_NODE_FEASIBILITY_ASSESSMENT.md** - Detailed feasibility analysis for stateful node architecture
- **STATEFUL_NODE_EXECUTIVE_SUMMARY.md** - Executive summary of node architecture approach
- **PARALLEL_ARCHITECTURE_INTEGRATION_STRATEGY.md** - Parallel execution patterns and integration strategy

### 02-adr/ — Architecture Decision Records
- **ADR-0009-phase-2d1-critical-fixes.md** ⭐ - Phase 2D1 critical fixes and decisions
- **ADR-0008-pattern-migration-strategy.md** - Pattern migration approach
- **ADR-0007-stateful-node-architecture.md** - Stateful node architectural choice
- **ADR-0006-codegen-abandonment.md** - Code generation tool decision
- **ADR-0005-folder-structure.md** - Documentation folder structure
- **ADR-0004-documentation-governance.md** - Documentation governance standards
- **ADR-0003-parallel-execution-model.md** - Parallel execution model decision
- **ADR-0002-global-brightness.md** - Global brightness control decision
- **ADR-0001-fps-targets.md** - FPS performance targets
- [View all ADRs](./02-adr/)

### 03-guides/ — How-To Guides & Procedures
- Various procedural guides and how-to documents
- [View all guides](./03-guides/)

### 04-planning/ — Roadmaps & Execution Plans
- **K1_MIGRATION_MASTER_PLAN.md** - 30-week migration roadmap
- **PHASE_2D1_GRAPH_PARALLEL_MASTER_STRATEGY.md** - Parallel execution strategy
- **PHASE_2_COMPLETE_ROADMAP.md** - Complete Phase 2 execution roadmap
- **WEEK_1_EXECUTION_KICKOFF.md** ⭐ - Week 1 (Nov 6-13) execution plan
- **WEEK_1_STANDUP_LOG.md** - Daily standup tracking
- **NOV_13_DECISION_GATE.md** ⭐ - Nov 13 decision gate criteria
- **PHASE_OVERVIEW.md** - Phase 2 overview and team allocation
- [View all plans](./04-planning/)

### 05-analysis/ — Technical Analysis & Research
- **esp_idf_api_breaking_changes_research.md** ⭐ - Detailed API changes (I2S, RMT, GPIO) between ESP-IDF 4.4 and 5.x
- Pattern analysis, feasibility studies, dependency analysis
- [View all analysis documents](./05-analysis/)

### 06-reference/ — Quick References & APIs
- **esp_idf_api_quick_migration_guide.md** ⭐ - Quick reference for ESP-IDF 4.4 → 5.x API migration (I2S, RMT, GPIO)
- API documentation, quick reference materials, glossaries
- [View all references](./06-reference/)
  - [Modern CLI Toolkit Agent](./06-reference/modern-cli-toolkit-agent.md)
  - [Governance Tools](./06-reference/governance-tools.md)

### 07-resources/ — Team Resources & Training
- **governance_quick_ref.md** ⭐⭐ - One-page governance cheat sheet
- BUILDER_EXTENSION.md - VS Code extension setup guide
- Team training materials and resources
- [View all resources](./07-resources/)
  - [Frontend Testing Playbook](./07-resources/frontend-testing-playbook.md)
  - [Task Master Integration & Tools](./07-resources/taskmaster_integration.md)

### Design & UI — Superdesign Workspace
- [.superdesign/CHAT_UI_ANIMATIONS.md](../.superdesign/CHAT_UI_ANIMATIONS.md) - Chat UI animations and micro‑syntax

### 08-governance/ — Policies & Standards
- **GOVERNANCE.md** ⭐⭐⭐ - Complete governance standards (must read)
- **K1_NODE1_LEGACY_PATH_AUDIT.md** - Legacy path migration audit
- **LEGACY_PATH_MAPPING_QUICK_REFERENCE.md** - Quick reference for legacy paths
- [View all governance docs](./08-governance/)

### 09-implementation/ — Implementation Specifications
- **IMPLEMENTATION_PLAN.md** - Detailed Phase 2 implementation plan
- Technical specifications and implementation guides
- [View all implementation docs](./09-implementation/)

### 09-reports/ — Phase & Milestone Reports
- **compilation_error_root_cause_summary.md** ⭐ - Root cause analysis for K1.node1 compilation errors
- Phase completion reports, validation reports, delivery notes
- [View all reports](./09-reports/)

---

## Audit & Quality Documents (Root Level)

- **AUDIT_REPORT_2025_11_05.md** - Comprehensive documentation audit
- **AUDIT_QUICK_REFERENCE.txt** - One-page audit summary
- **DOCUMENTATION_AUDIT_CRITICAL_FIXES.md** - Implementation checklist
- **DOCUMENTATION_AUDIT_SUMMARY_EXECUTIVE.md** - Executive summary
- **ADR_CONSOLIDATION_MAP.md** - ADR numbering consolidation plan

---

## Conventions
- Each numbered folder contains a README linking to local content.
- Root files are organized by semantic folder (architecture, planning, governance, etc).
- All docs include YAML frontmatter per `docs/08-governance/GOVERNANCE.md`.
- ⭐ indicates critical/must-read documents
- ⭐⭐ indicates essential for daily work
- ⭐⭐⭐ indicates foundational standards for all work

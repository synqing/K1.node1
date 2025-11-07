---
title: Documentation Navigation Guide
author: Documentation Team
date: 2025-11-05 14:00 UTC+8
status: published
intent: Unified searchable index and navigation guide for Phase 2 documentation with quick-access routes for different reader roles
---

# Documentation Navigation Guide

Centralized navigation hub for Phase 2 documentation. Use this guide to find information by role, topic, or decision.

---

## Quick Navigation by Role

### 🚀 **Phase 2 Launch Team** (Nov 6-13)
Start here if you're executing Phase 2 tasks this week:

1. **Today's Status:** [WEEK_1_EXECUTION_KICKOFF.md](./04-planning/WEEK_1_EXECUTION_KICKOFF.md) - Your daily checklist
2. **Architecture Review:** [STATEFUL_NODE_FEASIBILITY_ASSESSMENT.md](./01-architecture/STATEFUL_NODE_FEASIBILITY_ASSESSMENT.md)
3. **Critical Fixes:** [ADR-0009-phase-2d1-critical-fixes.md](./02-adr/ADR-0009-phase-2d1-critical-fixes.md)
4. **Team Assignments:** [PHASE_OVERVIEW.md](./04-planning/PHASE_OVERVIEW.md)
5. **Governance Rules:** [GOVERNANCE.md](./08-governance/GOVERNANCE.md)
6. **Quick Ref:** [governance_quick_ref.md](./07-resources/governance_quick_ref.md) (one-page cheat sheet)

### 📊 **Decision Makers** (Nov 13 Gate)
Preparing for decision gate approval:

1. **Phase Overview:** [PHASE_OVERVIEW.md](./04-planning/PHASE_OVERVIEW.md)
2. **Migration Plan:** [K1_MIGRATION_MASTER_PLAN.md](./04-planning/K1_MIGRATION_MASTER_PLAN.md)
3. **Critical Decisions:** [02-adr/](./02-adr/) (Architecture Decision Records)
4. **Nov 13 Gate Criteria:** [NOV_13_DECISION_GATE.md](./04-planning/NOV_13_DECISION_GATE.md)
5. **Analysis & Feasibility:** [01-architecture/](./01-architecture/)

### 🔧 **Firmware Engineers**
Implementation details for firmware work:

1. **Architecture Specs:** [STATEFUL_NODE_FEASIBILITY_ASSESSMENT.md](./01-architecture/STATEFUL_NODE_FEASIBILITY_ASSESSMENT.md)
2. **Critical Fixes:** [ADR-0009-phase-2d1-critical-fixes.md](./02-adr/ADR-0009-phase-2d1-critical-fixes.md)
3. **Implementation Plan:** [IMPLEMENTATION_PLAN.md](./09-implementation/IMPLEMENTATION_PLAN.md)
4. **Validation Criteria:** [PHASE_2_COMPLETE_ROADMAP.md](./04-planning/PHASE_2_COMPLETE_ROADMAP.md)
5. **Reference Docs:** [06-reference/](./06-reference/)

### 🎨 **UI/Webapp Engineers**
Frontend and control app documentation:

1. **Webapp Architecture:** Check 03-guides/ for frontend patterns
2. **API Integration:** [09-implementation/](./09-implementation/)
3. **Component Library:** [06-reference/](./06-reference/)
4. **Testing Standards:** [07-resources/](./07-resources/)

### 📚 **Documentation Curators**
Managing and maintaining documentation:

1. **Filing Rules:** [GOVERNANCE.md](./08-governance/GOVERNANCE.md) - Complete standards
2. **Quick Ref:** [governance_quick_ref.md](./07-resources/governance_quick_ref.md)
3. **Audit Reports:** [AUDIT_REPORT_2025_11_05.md](../AUDIT_REPORT_2025_11_05.md)
4. **Organization Map:** [00-INDEX.md](./00-INDEX.md)
5. **Metadata Standards:** [GOVERNANCE.md](./08-governance/GOVERNANCE.md) (see YAML section)

---

## Topic-Based Navigation

### Architecture & Design
| Topic | Document | Purpose |
|-------|----------|---------|
| System Design | [01-architecture/](./01-architecture/) | Component interaction, system overview |
| State Management | [STATEFUL_NODE_FEASIBILITY_ASSESSMENT.md](./01-architecture/STATEFUL_NODE_FEASIBILITY_ASSESSMENT.md) | Stateful node architecture |
| Node System | [STATEFUL_NODE_EXECUTIVE_SUMMARY.md](./01-architecture/STATEFUL_NODE_EXECUTIVE_SUMMARY.md) | Node system overview |
| Graph Architecture | [PARALLEL_ARCHITECTURE_INTEGRATION_STRATEGY.md](./01-architecture/PARALLEL_ARCHITECTURE_INTEGRATION_STRATEGY.md) | Parallel execution patterns |

### Decision Records
| Decision | ADR File | Status |
|----------|----------|--------|
| Phase 2D1 Critical Fixes | [ADR-0009-phase-2d1-critical-fixes.md](./02-adr/ADR-0009-phase-2d1-critical-fixes.md) | Published |
| Pattern Generation Safety | [ADR-0003-pattern-generation-safety.md](./02-adr/ADR-0003-pattern-generation-safety.md) | Published |
| Parallel Execution | [ADR-0003-parallel-execution-model.md](./02-adr/ADR-0003-parallel-execution-model.md) | Published |
| Documentation Governance | [ADR-0004-documentation-governance.md](./02-adr/ADR-0004-documentation-governance.md) | Published |

**Browse all:** [02-adr/](./02-adr/)

### Planning & Roadmaps
| Plan | Document | Timeframe |
|------|----------|-----------|
| Migration Plan | [K1_MIGRATION_MASTER_PLAN.md](./04-planning/K1_MIGRATION_MASTER_PLAN.md) | 30 weeks |
| Phase 2 Complete | [PHASE_2_COMPLETE_ROADMAP.md](./04-planning/PHASE_2_COMPLETE_ROADMAP.md) | Nov 6 - Apr 2026 |
| Week 1 Execution | [WEEK_1_EXECUTION_KICKOFF.md](./04-planning/WEEK_1_EXECUTION_KICKOFF.md) | Nov 6-13 |
| Decision Gate | [NOV_13_DECISION_GATE.md](./04-planning/NOV_13_DECISION_GATE.md) | Nov 13 milestone |
| Parallel Strategy | [PHASE_2D1_GRAPH_PARALLEL_MASTER_STRATEGY.md](./04-planning/PHASE_2D1_GRAPH_PARALLEL_MASTER_STRATEGY.md) | Phase 2D1 execution |

### Analysis & Research
| Topic | Document | Focus |
|-------|----------|-------|
| Pattern Analysis | [05-analysis/](./05-analysis/) | Design pattern evaluation |
| Feasibility Studies | [01-architecture/](./01-architecture/) | Technical feasibility |
| Dependency Analysis | [05-analysis/](./05-analysis/) | Task dependencies |

### Governance & Standards
| Standard | Document | Applies To |
|----------|----------|-----------|
| Documentation Rules | [GOVERNANCE.md](./08-governance/GOVERNANCE.md) | All documents |
| Legacy Path Audit | [K1_NODE1_LEGACY_PATH_AUDIT.md](./08-governance/K1_NODE1_LEGACY_PATH_AUDIT.md) | Path migration |
| Quick Reference | [governance_quick_ref.md](./07-resources/governance_quick_ref.md) | Day-to-day work |

### Implementation Details
| Aspect | Location | Use When |
|--------|----------|----------|
| Specs & Requirements | [09-implementation/IMPLEMENTATION_PLAN.md](./09-implementation/IMPLEMENTATION_PLAN.md) | Building features |
| Code Patterns | [03-guides/](./03-guides/) | Writing code |
| API Endpoints | [06-reference/](./06-reference/) | Integrating services |

---

## By Question Type

### "Where do I find...?"

**Architecture decisions** → [02-adr/](./02-adr/) or [ADR-0009](./02-adr/ADR-0009-phase-2d1-critical-fixes.md)

**Phase timeline** → [K1_MIGRATION_MASTER_PLAN.md](./04-planning/K1_MIGRATION_MASTER_PLAN.md)

**Team assignments** → [PHASE_OVERVIEW.md](./04-planning/PHASE_OVERVIEW.md)

**This week's tasks** → [WEEK_1_EXECUTION_KICKOFF.md](./04-planning/WEEK_1_EXECUTION_KICKOFF.md)

**Code standards** → [03-guides/](./03-guides/)

**API specs** → [09-implementation/](./09-implementation/)

**Filing rules** → [GOVERNANCE.md](./08-governance/GOVERNANCE.md)

**Decision criteria** → [NOV_13_DECISION_GATE.md](./04-planning/NOV_13_DECISION_GATE.md)

---

## Folder Map

```
docs/
├── 00-INDEX.md                          ← Numbered navigation (this folder structure)
├── 01-architecture/                     ← System design & feasibility studies
│   ├── README.md                        ← Folder overview
│   └── [architecture decision docs]
├── 02-adr/                              ← Architecture Decision Records (ADR-####)
│   ├── README.md                        ← All ADRs listed
│   └── ADR-XXXX-*.md                    ← Individual decisions
├── 03-guides/                           ← How-to guides & procedures
│   ├── README.md
│   └── [guide documents]
├── 04-planning/                         ← Roadmaps & execution plans
│   ├── README.md                        ← All plans listed
│   ├── K1_MIGRATION_MASTER_PLAN.md      ← 30-week overview
│   ├── PHASE_2D1_GRAPH_PARALLEL_MASTER_STRATEGY.md
│   ├── PHASE_2_COMPLETE_ROADMAP.md
│   ├── WEEK_1_EXECUTION_KICKOFF.md      ← This week's work
│   ├── WEEK_1_STANDUP_LOG.md            ← Daily progress
│   ├── NOV_13_DECISION_GATE.md          ← Approval criteria
│   └── PHASE_OVERVIEW.md                ← Team allocation
├── 05-analysis/                         ← Technical analysis & research
│   ├── README.md
│   └── [analysis documents]
├── 06-reference/                        ← Quick references & APIs
│   ├── README.md
│   └── [reference documents]
├── 07-resources/                        ← Team resources & training
│   ├── README.md
│   ├── governance_quick_ref.md          ← One-page cheat sheet ⭐
│   └── [resource documents]
├── 08-governance/                       ← Policies & standards
│   ├── README.md
│   ├── GOVERNANCE.md                    ← Complete standards ⭐⭐⭐
│   ├── K1_NODE1_LEGACY_PATH_AUDIT.md
│   └── LEGACY_PATH_MAPPING_QUICK_REFERENCE.md
└── 09-implementation/                   ← Implementation specs
    ├── README.md
    ├── IMPLEMENTATION_PLAN.md           ← Detailed specs
    └── [implementation guides]
```

---

## Critical Documents (Priority Order)

**Start reading here if you have 15 minutes:**

1. ⭐⭐⭐ [governance_quick_ref.md](./07-resources/governance_quick_ref.md) - One page, core knowledge
2. ⭐⭐⭐ [GOVERNANCE.md](./08-governance/GOVERNANCE.md) - Complete standards
3. ⭐⭐ [WEEK_1_EXECUTION_KICKOFF.md](./04-planning/WEEK_1_EXECUTION_KICKOFF.md) - This week's plan
4. ⭐⭐ [ADR-0009-phase-2d1-critical-fixes.md](./02-adr/ADR-0009-phase-2d1-critical-fixes.md) - Critical decisions
5. ⭐ [NOV_13_DECISION_GATE.md](./04-planning/NOV_13_DECISION_GATE.md) - Approval criteria

---

## Search Index

Use your editor's search (Ctrl+F / Cmd+F) with these keywords:

- **Phase 2** → Find all Phase 2 planning docs
- **UTC+8** → Find timestamped documents
- **ADR-0009** → Find critical fixes
- **decision gate** → Find approval criteria
- **task breakdown** → Find execution details
- **YAML** → Find metadata standards
- **governance** → Find rules & standards

---

## Getting Help

**Documentation questions?** → [GOVERNANCE.md](./08-governance/GOVERNANCE.md) section "Questions"

**Need to file a document?** → [GOVERNANCE.md](./08-governance/GOVERNANCE.md) section "Filing Rules"

**Looking for a specific topic?** → Use the tables above or search [00-INDEX.md](./00-INDEX.md)

**Feedback on docs?** → See team lead contact in [GOVERNANCE.md](./08-governance/GOVERNANCE.md)

---

**Last Updated:** 2025-11-05 14:00 UTC+8
**For Phase 2:** Nov 6-13 execution and beyond

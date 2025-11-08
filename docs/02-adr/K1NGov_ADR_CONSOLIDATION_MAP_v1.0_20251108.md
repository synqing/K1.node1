---
title: ADR Consolidation & Renumbering Map
author: Documentation Audit
date: 2025-11-05 14:40 UTC+8
status: published
intent: Map existing ADRs to consolidated unique numbers to eliminate conflicts before Phase 2 launch
---

# ADR Consolidation & Renumbering Map

**Document Purpose:** Guide for resolving 8 ADR numbering conflicts identified in audit. This ensures unique sequential numbering per ADR standard.

**Current Status:** 23 decision documents with conflicts in ADR-0001 through ADR-0010
**Target Status:** 15 unique ADRs with clean sequential numbering
**Implementation Deadline:** Before 2025-11-06 09:00 UTC+8

---

## Executive Summary

### Current Conflict Distribution
- **ADR-0001:** 3 files (3 different decisions)
- **ADR-0002:** 2 files (2 different decisions)
- **ADR-0003:** 2 files (2 different decisions)
- **ADR-0004:** 3 files (3 different decisions)
- **ADR-0005:** 3 files (3 different decisions)
- **ADR-0009:** 2 files (1 decision, duplicate naming)
- **Clean ADRs:** ADR-0006, ADR-0007, ADR-0008, ADR-0010 (no conflicts)

### Consolidation Plan
**Keep ADR-0001 through ADR-0010** (existing structure is partially valid)
**Add ADR-0011 through ADR-0015** (for renumbered conflicts)
**Delete duplicate ADR-0009-phase-2d1-critical-fixes.md** (keep only hyphenated version)

---

## Detailed Renumbering Map

### Group 1: Existing Clean ADRs (No Changes)

| Number | File | Title | Status | Keep |
|--------|------|-------|--------|------|
| ADR-0006 | ADR-0006-codegen-abandonment.md | Codegen Abandonment - C++ SDK Choice | ✅ | YES |
| ADR-0007 | ADR-0007-stateful-node-architecture.md | Stateful Node Architecture | ✅ | YES |
| ADR-0008 | ADR-0008-pattern-migration-strategy.md | Pattern Migration Strategy | ✅ | YES |
| ADR-0010 | ADR-0010-market-strategy-usp.md | Market Strategy - Node System as USP | ✅ | YES |

---

### Group 2: Primary ADRs to Retain in Current Numbering

These represent the most significant/recent decisions. Keep original numbers.

#### ADR-0001: Project Scope - Beat Tracking Abandonment

**Keep This File:** `ADR-0001-project-scope-abandonment.md`
**Delete:** `ADR-0001-fps-targets.md`, `ADR-0001-led_driver_header_split.md`
**Reason:** Scope/project-level decision (FPS targets and LED refactoring are sub-decisions)

---

#### ADR-0002: Node System as Core USP

**Keep This File:** `ADR-0002-node-system-core-usp.md`
**Delete:** `ADR-0002-global-brightness.md`
**Reason:** High-level strategic decision; global brightness is implementation detail

---

#### ADR-0003: Parallel Execution Model

**Keep This File:** `ADR-0003-parallel-execution-model.md`
**Delete:** `ADR-0003-phase-a-acceptance.md`
**Reason:** Model decision is foundational; phase acceptance is progress tracking

---

#### ADR-0004: Documentation Governance

**Keep This File:** `ADR-0004-documentation-governance.md`
**Rename:** `ADR-0004-institutional-memory-adoption.md` → `ADR-0011-institutional-memory-adoption.md`
**Delete:** `ADR-0004-PHASE_C_NODE_EDITOR_ARCHITECTURE.md` → Move to `ADR-0012-phase-c-editor-architecture.md`
**Reason:** Documentation governance is the primary ADR-0004; others are separate decisions

---

#### ADR-0005: Repository & Folder Structure

**Decision:** Keep `ADR-0005-folder-structure.md` as primary
**Rename:** `ADR-0005-backend-framework-fastapi.md` → `ADR-0013-backend-framework-fastapi.md`
**Delete:** `ADR-0005-repository-structure.md` (superseded by folder-structure)
**Reason:** Folder structure encompasses repository structure decision

---

#### ADR-0009: Phase 2D1 Critical Fixes

**Keep:** `ADR-0009-phase-2d1-critical-fixes.md` (comprehensive, 8.4KB)
**Delete:** `ADR-0009-phase-2d1-critical-fixes.md` (duplicate, 1.8KB, naming inconsistency)
**Action:** Verify references in:
- `K1NRes_REFERENCE_GOVERNANCE_QUICK_v1.0_20251108.md` (line mentions ADR-0009)
- `K1NImpl_PLAN_IMPLEMENTATION_v1.0_20251108.md` (references ADR-0009)

---

### Group 3: Secondary ADRs to Renumber

These represent valid decisions but currently use conflicting numbers. Reassign to ADR-0011+.

#### New ADR-0011: Institutional Memory & Mem0 Adoption

**File to Rename:** `02-adr/ADR-0004-institutional-memory-adoption.md` → `02-adr/ADR-0011-institutional-memory-adoption.md`

**Update Required:**
- Rename file
- Update YAML frontmatter: change `ADR-0004` → `ADR-0011`
- Update title to include new number

---

#### New ADR-0012: Phase C Node Editor Architecture

**File to Rename:** `02-adr/ADR-0004-PHASE_C_NODE_EDITOR_ARCHITECTURE.md` → `02-adr/ADR-0012-phase-c-node-editor-architecture.md`

**Update Required:**
- Rename file (fix naming: remove uppercase, use hyphens)
- Update YAML frontmatter: change `ADR-0004` → `ADR-0012`
- Update all references in related docs

**Note:** This is a UI/architecture decision for Phase C, distinct from documentation governance (ADR-0004).

---

#### New ADR-0013: Backend Framework - FastAPI Selection

**File to Rename:** `02-adr/ADR-0005-backend-framework-fastapi.md` → `02-adr/ADR-0013-backend-framework-fastapi.md`

**Update Required:**
- Rename file
- Update YAML frontmatter
- Update all references (likely in planning and implementation docs)

**Note:** This is a technology selection distinct from folder structure (ADR-0005).

---

#### New ADR-0014: Global Brightness Control

**File to Rename:** `02-adr/ADR-0002-global-brightness.md` → `02-adr/ADR-0014-global-brightness-control.md`

**Update Required:**
- Rename file
- Update YAML frontmatter
- Update title to be more descriptive

**Note:** This is a feature/implementation decision, separate from core USP strategy (ADR-0002).

---

#### New ADR-0015: LED Driver Header Split

**File to Rename:** `02-adr/ADR-0001-led_driver_header_split.md` → `02-adr/ADR-0015-led-driver-header-split.md`

**Update Required:**
- Rename file (fix naming: use hyphens consistently)
- Update YAML frontmatter
- Update all references in firmware docs

**Note:** This is a code organization decision, distinct from project scope (ADR-0001).

---

#### New ADR-0016: Phase A Acceptance Criteria

**File:** Currently `02-adr/ADR-0003-phase-a-acceptance.md`
**Action:** Evaluate whether this is truly a decision or progress tracking

**Options:**
1. **Option A:** Rename to `ADR-0016-phase-a-acceptance-criteria.md` (treat as official decision)
2. **Option B:** Move to `04-planning/` as progress tracking (not an architectural decision)

**Recommendation:** Option A - treat as decision criteria documentation

---

## Cross-Reference Update List

These files contain ADR references that must be updated during renumbering:

| File | Current References | Update Action |
|------|-------------------|------------------|
| K1NRes_REFERENCE_GOVERNANCE_QUICK_v1.0_20251108.md | ADR-0009 | Verify correct file name used |
| K1NImpl_PLAN_IMPLEMENTATION_v1.0_20251108.md | ADR-0001, ADR-0004, ADR-0007, ADR-0009 | Review and update as needed |
| K1NArch_ASSESSMENT_STATEFUL_NODE_FEASIBILITY_v1.0_20251108.md | ADR-0006 | No changes (already correct) |
| K1NArch_SUMMARY_STATEFUL_NODE_EXECUTIVE_v1.0_20251108.md | ADR-0006 | No changes (already correct) |
| K1NAnalysis_SUMMARY_PATTERN_ANALYSIS_EXECUTIVE_v1.0_20251108.md | ADR-0006 | No changes (already correct) |
| 00-tab5/K1NAnalysis_INDEX_TAB5_v1.0_20251108.md | References to ADRs | Update with consolidated list |

---

## Implementation Steps (5-6 Hours Total)

### Step 1: Backup Current ADR Folder (15 minutes)
```bash
cd docs/02-adr
cp -r . ../../archive/adr_backup_2025_11_05
```

### Step 2: Rename Files (1 hour)

**Execute in this order:**
1. `ADR-0004-institutional-memory-adoption.md` → `ADR-0011-institutional-memory-adoption.md`
2. `ADR-0004-PHASE_C_NODE_EDITOR_ARCHITECTURE.md` → `ADR-0012-phase-c-node-editor-architecture.md`
3. `ADR-0005-backend-framework-fastapi.md` → `ADR-0013-backend-framework-fastapi.md`
4. `ADR-0002-global-brightness.md` → `ADR-0014-global-brightness-control.md`
5. `ADR-0001-led_driver_header_split.md` → `ADR-0015-led-driver-header-split.md`
6. `ADR-0003-phase-a-acceptance.md` → `ADR-0016-phase-a-acceptance-criteria.md`
7. Delete `ADR-0009-phase-2d1-critical-fixes.md` (keep only hyphenated version)

### Step 3: Update YAML Frontmatter (1.5 hours)

For each renamed file:
- Open file
- Update `title:` field to include new ADR number
- Verify `status:` and `author:` fields
- Add/update `date:` field if missing (use 2025-11-05 HH:MM UTC+8 format)

### Step 4: Update Cross-References (1.5 hours)

In each file in update list:
- Search for old ADR number (e.g., "ADR-0004")
- Replace with new number where applicable (e.g., "ADR-0011")
- Verify context still makes sense

### Step 5: Update 00-tab5/K1NAnalysis_INDEX_TAB5_v1.0_20251108.md (30 minutes)

- Add entry for each new ADR (0011-0016)
- Remove duplicate entries
- Verify all 16 ADRs listed sequentially

### Step 6: Update 02-adr/README.md (30 minutes)

- Add new ADRs to index table
- Update description for consolidated ADRs
- Add note about consolidation date

### Step 7: Create Redirection Document (30 minutes)

Create `02-adr/CONSOLIDATION_REDIRECTION.md`:
```markdown
# ADR Consolidation History

This document maps old ADR references to consolidated structure.

| Old Reference | New Reference | Reason |
|---------------|--------------|--------|
| ADR-0001 (fps-targets) | Removed | Sub-decision of ADR-0001 |
| ADR-0001 (led-driver) | ADR-0015 | Renumbered |
...
```

### Step 8: Final Validation (1 hour)

- Run `grep -r "ADR-000" docs/` to find all references
- Verify each reference points to correct file
- Test all cross-document links
- Spot-check 5 random files for consistency

---

## Success Criteria

✅ **After consolidation, the following must be true:**

1. No duplicate ADR numbers (each 0001-0016 used exactly once)
2. Each ADR file exists with correct naming convention
3. All cross-references are updated and valid
4. YAML frontmatter consistent across all 16 ADRs
5. 00-tab5/K1NAnalysis_INDEX_TAB5_v1.0_20251108.md shows complete consolidated list
6. No broken links in documentation
7. Archive folder contains backup of original structure

---

## Rollback Plan

If issues arise during implementation:

1. **Stop all changes immediately**
2. **Restore from backup:**
   ```bash
   rm -r docs/02-adr/*
   cp -r archive/adr_backup_2025_11_05/* docs/02-adr/
   ```
3. **Verify restoration:**
   ```bash
   ls docs/02-adr | wc -l  # Should be 23
   ```
4. **Report issues** with detailed error log

---

## Timeline

| Task | Duration | Owner | Start | Finish |
|------|----------|-------|-------|--------|
| Backup ADRs | 15 min | CI/Automation | 22:00 Nov 5 | 22:15 Nov 5 |
| Rename files | 1 hour | Script/Agent | 22:15 Nov 5 | 23:15 Nov 5 |
| Update frontmatter | 1.5 hours | Text editor/Agent | 23:15 Nov 5 | 00:45 Nov 6 |
| Update cross-refs | 1.5 hours | Agent | 00:45 Nov 6 | 02:15 Nov 6 |
| Update indexes | 1 hour | Agent | 02:15 Nov 6 | 03:15 Nov 6 |
| Create redirection | 30 min | Agent | 03:15 Nov 6 | 03:45 Nov 6 |
| Validation | 1 hour | Manual review | 03:45 Nov 6 | 04:45 Nov 6 |

**Total Duration:** ~6.5 hours (can be parallelized for 3-4 hours with multiple agents)

---

## Related Documents

- **Primary Document:** `/docs/AUDIT_REPORT_2025_11_05.md`
- **Implementation Plan:** `/docs/04-planning/K1NPlan_AUDIT_PHASE_2D1_START_HERE_v1.0_20251108.md`
- **Governance Standards:** `/docs/08-governance/K1NGov_GOVERNANCE_v1.0_20251108.md`
- **ADR Template:** `/docs/02-adr/ADR-template.md`

---

**Document Status:** PUBLISHED
**Last Updated:** 2025-11-05 14:40 UTC+8
**Approval Status:** Awaiting review before 2025-11-06 09:00 UTC+8

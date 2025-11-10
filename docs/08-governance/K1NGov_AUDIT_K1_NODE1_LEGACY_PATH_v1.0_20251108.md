# K1.node1 Legacy Documentation Path Audit Report

**Date Generated:** 2025-11-05  
**Scope:** Full codebase audit of K1.node1  
**Status:** COMPREHENSIVE INVENTORY COMPLETE

## Summary

K1.node1 codebase ALREADY has the numbered documentation structure implemented. However, there are **197 references to legacy (non-numbered) path format** that reference the old path names for educational/reference purposes, but they should be updated to use the new numbered path format for consistency.

### Current Folder Structure (Correct)
- `/docs/01-architecture/` ✓
- `/docs/02-adr/` ✓
- `/docs/03-guides/` ✓
- `/docs/04-planning/` ✓
- `/docs/05-analysis/` ✓
- `/docs/06-reference/` ✓
- `/docs/07-resources/` ✓
- `/docs/08-governance/` ✓
- `/docs/09-implementation/` ✓

---

## COMPREHENSIVE FINDINGS BY LEGACY PATH

### LEGACY PATH 1: `docs/01-architecture/` (Should be `docs/01-architecture/`)

**Total References Found:** 41

#### Files Containing References:

**1. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/07-resources/K1NRes_GUIDE_GOVERNANCE_TRAINING_NOV6_v1.0_20251108.md**
- Line 52: `| Architecture/design | \`docs/01-architecture/\` | \`node_system_architecture.md\` |`
- Context: Training reference table showing old path format
- Update to: `| Architecture/design | \`docs/01-architecture/\` | \`node_system_architecture.md\` |`

**2. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/07-resources/K1NRes_REFERENCE_GOVERNANCE_QUICK_v1.0_20251108.md**
- Line 30: `| System design | \`docs/01-architecture/\` | \`stateful_node_architecture.md\` |`
- Context: Quick reference showing old path format
- Update to: `| System design | \`docs/01-architecture/\` | \`stateful_node_architecture.md\` |`

**3. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/09-implementation/K1NImpl_PLAN_IMPLEMENTATION_v1.0_20251108.md**
- Line 37: `cp docs/01-architecture/K1NArch_ASSESSMENT_STATEFUL_NODE_FEASIBILITY_v1.0_20251108.md \`
- Line 38: `   /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/01-architecture/`
- Context: Example copy command in migration plan
- Update to: `docs/01-architecture/K1NArch_ASSESSMENT_STATEFUL_NODE_FEASIBILITY_v1.0_20251108.md`
- Line 40: `cp docs/01-architecture/K1NArch_SUMMARY_STATEFUL_NODE_EXECUTIVE_v1.0_20251108.md \`
- Line 41: `   /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/01-architecture/`
- Update to: `docs/01-architecture/K1NArch_SUMMARY_STATEFUL_NODE_EXECUTIVE_v1.0_20251108.md`
- Line 57: `- \`docs/01-architecture/PARALLEL_ARCHITECTURE_INTEGRATION_STRATEGY.md\` - Integration plans`
- Update to: `\`docs/01-architecture/PARALLEL_ARCHITECTURE_INTEGRATION_STRATEGY.md\``

**4. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/01-architecture/K1NArch_SUMMARY_STATEFUL_NODE_EXECUTIVE_v1.0_20251108.md**
- Line 6: `**Full Analysis:** \`docs/01-architecture/K1NArch_ASSESSMENT_STATEFUL_NODE_FEASIBILITY_v1.0_20251108.md\``
- Line 351: `**Full Analysis:** \`/docs/01-architecture/K1NArch_ASSESSMENT_STATEFUL_NODE_FEASIBILITY_v1.0_20251108.md\` (66 pages)`
- Context: Internal cross-reference
- Update to: `/docs/01-architecture/K1NArch_ASSESSMENT_STATEFUL_NODE_FEASIBILITY_v1.0_20251108.md`

**5. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0013-backend-framework-fastapi.md**
- Line 186: `- **Technical Comparison**: \`docs/05-analysis/fastapi_vs_nestjs_song_analysis_comparison.md\``
- Context: ADR reference (NOTE: This is actually docs/analysis, see analysis section below)

**6. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0015-led-driver-header-split.md**
- Line 203: `- **Forensic Analysis**: \`/docs/05-analysis/led_driver_architecture_analysis.md\` (full technical analysis with line numbers and metrics)`
- Line 204: `- **Quick Reference**: \`/docs/05-analysis/led_driver_refactoring_summary.md\` (one-page summary for engineers)`
- Context: ADR references (NOTE: These are actually docs/analysis references)

**7. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0006-codegen-abandonment.md**
- Line 11: `  - docs/01-architecture/K1_ARCHITECTURAL_REVIEW.md`
- Line 12: `  - docs/01-architecture/ARCHITECTURAL_REVIEW_SUMMARY.md`
- Context: Front matter related_docs list
- Update to: `docs/01-architecture/...`
- Line 27: `- K1 Architecture Review: \`docs/01-architecture/K1_ARCHITECTURAL_REVIEW.md\` (Section: "The Critical Issue")`
- Line 28: `- Architectural Review Summary: \`docs/01-architecture/ARCHITECTURAL_REVIEW_SUMMARY_md\` (Section: "Three Strategic Options")`
- Line 189: `- **Executive Summary:** \`docs/01-architecture/K1NArch_SUMMARY_STATEFUL_NODE_EXECUTIVE_v1.0_20251108.md\``
- Line 190: `- **Full Analysis:** \`docs/01-architecture/K1NArch_ASSESSMENT_STATEFUL_NODE_FEASIBILITY_v1.0_20251108.md\` (66 pages)`
- Line 301: `- \`docs/01-architecture/K1_ARCHITECTURAL_REVIEW.md\` - Comprehensive review of decision`
- Line 302: `- \`docs/01-architecture/ARCHITECTURAL_REVIEW_SUMMARY.md\` - Executive summary`
- Line 371: `- **Architectural Review:** \`docs/01-architecture/K1_ARCHITECTURAL_REVIEW.md\` (Section 3: "The Fundamental Tension")`
- Line 383: `- **Full Assessment:** \`docs/01-architecture/K1NArch_ASSESSMENT_STATEFUL_NODE_FEASIBILITY_v1.0_20251108.md\` (66 pages)`
- Line 385: `- **Executive Summary:** \`docs/01-architecture/K1NArch_SUMMARY_STATEFUL_NODE_EXECUTIVE_v1.0_20251108.md\``
- All need update to: `docs/01-architecture/`

**8. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/K1NPlan_PLAN_K1_MIGRATION_MASTER_v1.0_20251108.md**
- Line 44: `  K1.reinvented/docs/adr \`
- Line 45: `  K1.reinvented/docs/architecture \`
- Context: Reference to K1.reinvented paths (informational)
- Line 67: `find docs/architecture -name "*.md" | head -20 > /tmp/k1_arch_docs.txt`
- Context: Example find command
- Update to: `find docs/01-architecture -name "*.md" | head -20 > /tmp/k1_arch_docs.txt`
- Line 153: `mkdir -p docs/01-architecture/current   # Active architecture`
- Line 154: `mkdir -p docs/01-architecture/archive   # Old architecture`
- Context: Migration plan shell commands
- Update to: `mkdir -p docs/01-architecture/current` and `mkdir -p docs/01-architecture/archive`
- Line 360: `for file in docs/01-architecture/*.md; do`
- Line 364: `      cp "$file" /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/01-architecture/current/`
- Line 366: `      cp "$file" /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/01-architecture/archive/`
- Update all to: `docs/01-architecture/`

**9. /Users/spectrasynq/Workspace_Management/Software/K1.node1/TASKS.md**
- Line 21: `- Architecture/design docs → \`docs/01-architecture/\``
- Update to: `docs/01-architecture/`

**10. /Users/spectrasynq/Workspace_Management/Software/K1.node1/.kiro/specs/k1-architecture-documentation/tasks.md**
- Line 4: `  - Create \`docs/01-architecture/\` directory structure`
- Update to: `docs/01-architecture/`

**11. /Users/spectrasynq/Workspace_Management/Software/K1.node1/.kiro/specs/k1-architecture-documentation/design.md**
- Line 783: `**File**: \`docs/01-architecture/K1_CONTROL_APP_ARCHITECTURE.md\``
- Update to: `docs/01-architecture/K1_CONTROL_APP_ARCHITECTURE.md`

**12. /Users/spectrasynq/Workspace_Management/Software/K1.node1/.kiro/steering/structure.md**
- Line 127: `- Architecture overviews → \`docs/01-architecture/\``
- Update to: `docs/01-architecture/`

**13. /Users/spectrasynq/Workspace_Management/Software/K1.node1/CLAUDE.md**
- Line 44: `| Architecture overview               | \`docs/01-architecture/\`         | \`rendering_pipeline_overview.md\`                |`
- Line 111: `   - Architecture/design → \`docs/01-architecture/\``
- Line 187: `- Default destination: \`docs/05-analysis/\`.` (NOTE: analysis, not architecture)
- Line 189: `  under \`docs/05-analysis/archive/\` after approval.` (NOTE: analysis)
- Line 221: `- Default destination: \`docs/05-analysis/{subsystem}/\` (e.g., \`docs/05-analysis/audio_pipeline/\`) (NOTE: analysis)
- Line 259: `- Default destination: \`docs/04-planning/\` for forward-looking; \`Implementation.plans/roadmaps/\` for active design arcs.`
- Line 335: `- Default destination: \`docs/09-reports/\` (phase summaries) + \`Implementation.plans/backlog/\` (lint debt)`
- Line 373: `- Default destination: \`.taskmaster/workflow/\` (internal state) + \`docs/09-reports/\` (public summaries)`
- Line 410: `- Default destination: \`docs/07-resources/\` or \`docs/templates/\`.`
- Line 494: `**Outputs:** forensic reports → \`docs/05-analysis/{subsystem}/\``
- Line 524: `- Performance metrics → \`docs/09-reports/\``
- Line 531: `- \`docs/09-reports/{PHASE}_fixes_validation.md\` (test results, memory/performance delta)`
- Line 551: `**Outputs:** audit reports, test summaries → \`docs/09-reports/\``
- Line 586: `└── docs/09-reports/{PHASE}_fixes_validation.md`
- Line 594: `├── docs/09-reports/{PHASE}_deployment_decision.md`
- Line 602: `3. Every quality report MUST cite before/after metrics from docs/09-reports/`
- Line 743: `Located in: \`docs/02-adr/\``
 - Line 747: `**Template:** [K1NADR_TEMPLATE_v1.0_20251110.md](docs/02-adr/K1NADR_TEMPLATE_v1.0_20251110.md)`
- Line 748: `**Index & rules:** [docs/02-adr/README.md](docs/02-adr/README.md)`
- Update all paths to numbered format

---

### LEGACY PATH 2: `docs/02-adr/` (Should be `docs/02-adr/`)

**Total References Found:** 31

#### Files Containing References:

**1. /Users/spectrasynq/Workspace_Management/Software/K1.node1/tools/governance/add_frontmatter.sh**
- Line 34: `  echo "  ./tools/governance/add_frontmatter.sh --add-file docs/04-planning/my_doc.md"`
- Context: Example usage in shell script
- Update to: `docs/04-planning/my_doc.md` (also converts planning from docs/planning)

**2. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/07-resources/K1NRes_GUIDE_GOVERNANCE_TRAINING_NOV6_v1.0_20251108.md**
- Line 54: `| Decisions (ADRs) | \`docs/02-adr/\` | \`ADR-0001-title.md\` |`
- Update to: `docs/02-adr/`

**3. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/07-resources/K1NRes_REFERENCE_GOVERNANCE_QUICK_v1.0_20251108.md**
- Line 29: `| Architecture decisions | \`docs/02-adr/\` | \`ADR-0009-phase-2d1-critical-fixes.md\` |`
- Update to: `docs/02-adr/`

**4. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/09-implementation/K1NImpl_PLAN_IMPLEMENTATION_v1.0_20251108.md**
- Line 7: `  - docs/02-adr/ADR-0001-project-scope-abandonment.md`
- Line 8: `  - docs/02-adr/ADR-0004-documentation-governance.md`
- Line 172: `  - docs/02-adr/ADR-0002-node-system-core-usp.md`
- Line 317: `See docs/02-adr/ for all architecture decisions.`
- Update all to: `docs/02-adr/`

**5. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0009-phase-2d1-critical-fixes.md**
- Line 8: `  - docs/09-reports/AUDIT_SUMMARY_FOR_LEADERSHIP.md`
- Context: Front matter related_docs (this is reports, see reports section)

**6. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0005-folder-structure.md**
- Line 9: `  - docs/04-planning/K1NPlan_PLAN_K1_MIGRATION_MASTER_v1.0_20251108.md`
- Context: Front matter related_docs (this is planning, see planning section)

**7. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/README.md**
- Line 78: `- Commit to main with message: \`docs/adr: Add ADR-####-{title}\``
- Line 89: `**From SUPREME analysis (docs/05-analysis/):**`
- Line 96: `**From ULTRA design (docs/04-planning/):**
- Update adr to: `docs/02-adr:` and paths to appropriate numbered versions

**8. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0011-institutional-memory-adoption.md**
- Line 10: `related_docs: [docs/09-reports/POC_FINAL_DECISION.md, docs/07-resources/mem0_production_integration_guide.md]`
- Line 22: `- PoC Final Decision: [docs/09-reports/POC_FINAL_DECISION.md](../reports/POC_FINAL_DECISION.md)`
- Line 23: `- Task #1 Review: [docs/09-reports/poc_task1_review.md](../reports/poc_task1_review.md)`
- Line 24: `- Task #2 Review: [docs/09-reports/poc_task2_review.md](../reports/poc_task2_review.md)`
- Line 25: `- Validation Analysis: [docs/09-reports/poc_validation_analysis.md](../reports/poc_validation_analysis.md)`
- Line 284: `- **PoC Decision:** [docs/09-reports/POC_FINAL_DECISION.md](../reports/POC_FINAL_DECISION.md)`
- Context: All cross-references in ADR
- Update to: Use relative paths to `../08-reports/` or full paths to `docs/09-reports/`

**9. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/K1NADR_TEMPLATE_v1.0_20251110.md**
- Line 20: `- BOTTLENECK_N from docs/05-analysis/{subsystem}/bottleneck_matrix.md`
- Update to: `docs/05-analysis/{subsystem}/bottleneck_matrix.md`

**10. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0006-codegen-abandonment.md**
- Line 26: `- Finding #2 from \`docs/09-reports/COMPLETE_AUDIT_SYNTHESIS_PHASE2D1.md\``
- Line 395: `- **ADR README:** \`docs/02-adr/README.md\` (ADR process & governance)`
- Update to: `docs/02-adr/README.md` and `docs/09-reports/COMPLETE_AUDIT_SYNTHESIS_PHASE2D1.md`

**11. /Users/spectrasynq/Workspace_Management/Software/K1.node1/TASKS.md**
- Line 23: `- ADRs (decisions) → \`docs/02-adr/\` (format: \`ADR-####-title.md\`)`
- Update to: `docs/02-adr/`

**12. /Users/spectrasynq/Workspace_Management/Software/K1.node1/.kiro/steering/structure.md**
- Line 129: `- Decision records → \`docs/02-adr/\` (ADR-####-*.md format)`
- Update to: `docs/02-adr/`

**13. /Users/spectrasynq/Workspace_Management/Software/K1.node1/CLAUDE.md**
- Line 46: `| Decision record                     | \`docs/02-adr/\`                  | \`ADR-0004-led-topology-choice.md\`               |`
- Line 113: `   - ADRs → \`docs/02-adr/\` (format: \`ADR-####-title.md\`)`
- Line 227: `- Escalation: if analysis reveals unfixable design flaw, create \`docs/02-adr/ADR-####-{issue}.md\` decision record.`
- Line 743: `Located in: \`docs/02-adr/\``
- Line 747: `**Template:** [K1NADR_TEMPLATE_v1.0_20251110.md](docs/02-adr/K1NADR_TEMPLATE_v1.0_20251110.md)`
- Line 748: `**Index & rules:** [docs/02-adr/README.md](docs/02-adr/README.md)`
- Update all to: `docs/02-adr/`

---

### LEGACY PATH 3: `docs/05-analysis/` (Should be `docs/05-analysis/`)

**Total References Found:** 21

#### Files Containing References:

**1. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/07-resources/K1NRes_GUIDE_GOVERNANCE_TRAINING_NOV6_v1.0_20251108.md**
- Line 53: `| Technical analysis | \`docs/05-analysis/\` | \`pattern_feasibility.md\` |`
- Update to: `docs/05-analysis/`

**2. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/07-resources/K1NRes_REFERENCE_GOVERNANCE_QUICK_v1.0_20251108.md**
- Line 31: `| Technical analysis | \`docs/05-analysis/\` | \`K1NAnalysis_ANALYSIS_PATTERN_CODEBASE_ARCHITECTURE_v1.0_20251108.md\` |`
- Update to: `docs/05-analysis/`
- Line 122: `./tools/governance/add_frontmatter.sh docs/04-planning/myfile.md`
- Update to: `docs/04-planning/myfile.md`

**3. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/09-implementation/K1NImpl_PLAN_IMPLEMENTATION_v1.0_20251108.md**
- Line 43: `cp docs/05-analysis/K1NAnalysis_ANALYSIS_PATTERN_CODEBASE_ARCHITECTURE_v1.0_20251108.md \`
- Line 44: `   /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/05-analysis/`
- Update to: `docs/05-analysis/`
- Line 56: `- \`docs/05-analysis/fps_comparison_forensic_report.md\` - Performance baseline`
- Update to: `docs/05-analysis/`

**4. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/05-analysis/K1NAnalysis_SUMMARY_PATTERN_ANALYSIS_EXECUTIVE_v1.0_20251108.md**
- Line 239: `**Full analysis:** \`/docs/05-analysis/pattern_reverse_engineering_feasibility.md\` (60+ pages)`
 - Line 241: `**Related ADR:** \`/docs/02-adr/K1NADR_0006_CODEGEN_ABANDONMENT_v1.0_20251110.md\` (decision document)`
- Update to: `/docs/05-analysis/...` and `/docs/02-adr/...`

**5. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0013-backend-framework-fastapi.md**
- Line 177: `See detailed implementation guide: \`docs/04-planning/fastapi_implementation_guide.md\``
- Line 186: `- **Technical Comparison**: \`docs/05-analysis/fastapi_vs_nestjs_song_analysis_comparison.md\``
- Update to: `docs/04-planning/` and `docs/05-analysis/`

**6. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0015-led-driver-header-split.md**
- Line 203: `- **Forensic Analysis**: \`/docs/05-analysis/led_driver_architecture_analysis.md\` (full technical analysis with line numbers and metrics)`
- Line 204: `- **Quick Reference**: \`/docs/05-analysis/led_driver_refactoring_summary.md\` (one-page summary for engineers)`
- Update to: `/docs/05-analysis/`

**7. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0006-codegen-abandonment.md**
- Line 303: `- \`docs/05-analysis/firmware_technical_audit_phase2d1.md\` - Codegen finding (Finding #2)`
- Line 376: `- **Pattern Reversibility Study:** \`docs/05-analysis/pattern_reverse_engineering_feasibility.md\` (1,582 lines)`
- Line 378: `- **Executive Summary:** \`docs/05-analysis/K1NAnalysis_SUMMARY_PATTERN_ANALYSIS_EXECUTIVE_v1.0_20251108.md\``
- Line 379: `- **Codebase Architecture:** \`docs/05-analysis/K1NAnalysis_ANALYSIS_PATTERN_CODEBASE_ARCHITECTURE_v1.0_20251108.md\``
- Update all to: `docs/05-analysis/`

**8. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/K1NPlan_PLAN_K1_MIGRATION_MASTER_v1.0_20251108.md**
- Line 158: `mkdir -p docs/05-analysis/current      # Active analyses`
- Line 159: `mkdir -p docs/05-analysis/archive      # Old analyses`
- Line 372: `for file in docs/05-analysis/*.md; do`
- Line 375: `      cp "$file" /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/05-analysis/current/`
- Line 377: `      cp "$file" /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/05-analysis/archive/`
- Update all to: `docs/05-analysis/`

**9. /Users/spectrasynq/Workspace_Management/Software/K1.node1/TASKS.md**
- Line 22: `- Technical analysis → \`docs/05-analysis/\``
- Update to: `docs/05-analysis/`

**10. /Users/spectrasynq/Workspace_Management/Software/K1.node1/.kiro/steering/structure.md**
- Line 128: `- Technical analysis → \`docs/05-analysis/\``
- Update to: `docs/05-analysis/`

**11. /Users/spectrasynq/Workspace_Management/Software/K1.node1/CLAUDE.md**
- Line 45: `| Technical analysis / comparison     | \`docs/05-analysis/\`             | \`stability_analysis_and_comparison.md\`          |`
- Line 112: `   - Technical analysis → \`docs/05-analysis/\``
- Line 187: `- Default destination: \`docs/05-analysis/\`.`
- Line 189: `  under \`docs/05-analysis/archive/\` after approval.`
- Line 221: `- Default destination: \`docs/05-analysis/{subsystem}/\` (e.g., \`docs/05-analysis/audio_pipeline/\`)`
- Line 494: `**Outputs:** forensic reports → \`docs/05-analysis/{subsystem}/\``
- Update all to: `docs/05-analysis/`

---

### LEGACY PATH 4: `docs/04-planning/` (Should be `docs/04-planning/`)

**Total References Found:** 24

#### Files Containing References:

**1. /Users/spectrasynq/Workspace_Management/Software/K1.node1/tools/governance/add_frontmatter.sh**
- Line 34: `  echo "  ./tools/governance/add_frontmatter.sh --add-file docs/04-planning/my_doc.md"`
- Update to: `docs/04-planning/my_doc.md`

**2. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/07-resources/K1NRes_GUIDE_GOVERNANCE_TRAINING_NOV6_v1.0_20251108.md**
- Line 55: `| Planning/proposals | \`docs/04-planning/\` | \`phase_2d1_plan.md\` |`
- Update to: `docs/04-planning/`

**3. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/07-resources/K1NRes_REFERENCE_GOVERNANCE_QUICK_v1.0_20251108.md**
- Line 32: `| Planning & roadmaps | \`docs/04-planning/\` | \`K1NPlan_STRATEGY_PHASE_2D1_GRAPH_PARALLEL_MASTER_v1.0_20251108.md\` |`
- Line 122: `./tools/governance/add_frontmatter.sh docs/04-planning/myfile.md`
- Update all to: `docs/04-planning/`

**4. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/09-implementation/K1NImpl_PLAN_IMPLEMENTATION_v1.0_20251108.md**
- Line 32: `   /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/`
- Line 46: `cp docs/04-planning/K1NPlan_PLAN_K1_MIGRATION_MASTER_v1.0_20251108.md \`
- Line 47: `   /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/`
- Line 49: `cp docs/04-planning/MIGRATION_EXECUTION_CHECKLIST.md \`
- Line 50: `   /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/`
- Update all to: `docs/04-planning/`

**5. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0013-backend-framework-fastapi.md**
- Line 177: `See detailed implementation guide: \`docs/04-planning/fastapi_implementation_guide.md\``
- Update to: `docs/04-planning/fastapi_implementation_guide.md`

**6. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0005-folder-structure.md**
- Line 9: `  - docs/04-planning/K1NPlan_PLAN_K1_MIGRATION_MASTER_v1.0_20251108.md`
- Update to: `docs/04-planning/K1NPlan_PLAN_K1_MIGRATION_MASTER_v1.0_20251108.md`

**7. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/README.md**
- Line 96: `**From ULTRA design (docs/04-planning/):**`
- Update to: `docs/04-planning/`

**8. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/K1NPlan_PLAN_K1_MIGRATION_MASTER_v1.0_20251108.md**
- Line 152: `mkdir -p docs/adr                    # Immutable decisions`
- Line 153: `mkdir -p docs/01-architecture/current   # Active architecture`
- Line 154: `mkdir -p docs/01-architecture/archive   # Old architecture`
- Line 156: `mkdir -p docs/guides                # How-tos`
- Line 157: `mkdir -p docs/reference             # Lookups, glossaries`
- Update all to numbered format: `docs/02-adr`, `docs/01-architecture`, `docs/03-guides`, `docs/06-reference`
- Line 388: `cat > docs/templates/DOCUMENT_TEMPLATE.md << 'EOF'`
- Update to: `docs/07-resources/DOCUMENT_TEMPLATE.md` (templates moved to resources)

**9. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/K1NPlan_PLAN_WEEK_1_EXECUTION_KICKOFF_v1.0_20251108.md**
- Line 514: `This kickoff document is ACTIVE. Update daily standup notes in \`docs/04-planning/K1NPlan_LOG_WEEK_1_STANDUP_v1.0_20251108.md\` (created separately).`
- Update to: `docs/04-planning/K1NPlan_LOG_WEEK_1_STANDUP_v1.0_20251108.md`

**10. /Users/spectrasynq/Workspace_Management/Software/K1.node1/TASKS.md**
- Line 24: `- Planning & proposals → \`docs/04-planning/\``
- Update to: `docs/04-planning/`

**11. /Users/spectrasynq/Workspace_Management/Software/K1.node1/.kiro/steering/structure.md**
- Line 131: `- Planning proposals → \`docs/04-planning/\``
- Update to: `docs/04-planning/`

**12. /Users/spectrasynq/Workspace_Management/Software/K1.node1/CLAUDE.md**
- Line 48: `| Planning proposal / migration plan  | \`docs/04-planning/\`             | \`audio_sync_migration_plan.md\`                  |`
- Line 69: `- Update or create the nearest index file (\`docs/README.md\`, \`docs/04-planning/README.md\`, folder-specific index)`
- Line 83: `7. **Summarize** the change in the PR/commit description with folder + intent (\`docs/planning: add audio sync`
- Line 114: `   - Planning → \`docs/04-planning/\``
- Line 259: `- Default destination: \`docs/04-planning/\` for forward-looking; \`Implementation.plans/roadmaps/\` for active design arcs.`
- Update all to: `docs/04-planning/`

---

### LEGACY PATH 5: `docs/09-reports/` (Should be `docs/09-reports/` - NOTE: NEW NUMBERED LOCATION)

**Total References Found:** 24

**Important:** The audit found references to `docs/09-reports/` but there is NO `docs/09-reports/` folder currently. Per the numbered structure, reports should go to `docs/09-implementation/` (which is implementation-related) OR this may be an oversight and needs clarification.

#### Files Containing References:

**1. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/07-resources/K1NRes_GUIDE_GOVERNANCE_TRAINING_NOV6_v1.0_20251108.md**
- Line 56: `| Phase reports | \`docs/09-reports/\` | \`phase_validation_report.md\` |`
- Context: Training material

**2. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/07-resources/K1NRes_REFERENCE_GOVERNANCE_QUICK_v1.0_20251108.md**
- Line 33: `| Phase reports | \`docs/09-reports/\` | \`phase_2d1_validation_report.md\` |`
- Context: Quick reference

**3. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/09-implementation/K1NImpl_PLAN_IMPLEMENTATION_v1.0_20251108.md**
- Line 34: `cp docs/09-reports/AUDIT_SUMMARY_FOR_LEADERSHIP.md \`
- Line 35: `   /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/09-reports/`
- Line 54: `- \`docs/09-reports/audio_fixes_executive_summary.md\` - Recent audio work`
- Line 55: `- \`docs/09-reports/audio_fixes_security_audit.md\` - Security findings`

**4. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0009-phase-2d1-critical-fixes.md**
- Line 8: `  - docs/09-reports/AUDIT_SUMMARY_FOR_LEADERSHIP.md`

**5. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0011-institutional-memory-adoption.md**
- Line 10: `related_docs: [docs/09-reports/POC_FINAL_DECISION.md, docs/07-resources/mem0_production_integration_guide.md]`
- Line 22: `- PoC Final Decision: [docs/09-reports/POC_FINAL_DECISION.md](../reports/POC_FINAL_DECISION.md)`
- Line 23: `- Task #1 Review: [docs/09-reports/poc_task1_review.md](../reports/poc_task1_review.md)`
- Line 24: `- Task #2 Review: [docs/09-reports/poc_task2_review.md](../reports/poc_task2_review.md)`
- Line 25: `- Validation Analysis: [docs/09-reports/poc_validation_analysis.md](../reports/poc_validation_analysis.md)`
- Line 284: `- **PoC Decision:** [docs/09-reports/POC_FINAL_DECISION.md](../reports/POC_FINAL_DECISION.md)`

**6. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0006-codegen-abandonment.md**
- Line 26: `- Finding #2 from \`docs/09-reports/COMPLETE_AUDIT_SYNTHESIS_PHASE2D1.md\``
- Line 372: `- **Audit Synthesis:** \`docs/09-reports/COMPLETE_AUDIT_SYNTHESIS_PHASE2D1.md\` (Section 1.2: "Two-Stage Compilation Pipeline Not Implemented")`

**7. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/K1NPlan_DECISION_GATE_NOV_13_v1.0_20251108.md**
- Line 85: `docs/09-reports/phase_2d1_validation_report.md`
- Line 121: `docs/09-reports/graph_poc_validation_report.md`

**8. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/K1NPlan_PLAN_K1_MIGRATION_MASTER_v1.0_20251108.md**
- Line 160: `mkdir -p docs/09-reports/current       # Latest reports`
- Line 161: `mkdir -p docs/09-reports/archive       # Historical reports`

**9. /Users/spectrasynq/Workspace_Management/Software/K1.node1/TASKS.md**
- Line 25: `- Phase reports → \`docs/09-reports/\``
- Line 117: `- Validation report: \`docs/09-reports/phase_2d1_fixes_validation.md\``
- Line 123: `- Validation report: \`docs/09-reports/graph_poc_validation.md\``
- Line 129: `- Metrics & profiling: \`docs/09-reports/phase_2d1_performance_metrics.md\``

**10. /Users/spectrasynq/Workspace_Management/Software/K1.node1/CLAUDE.md**
- Line 47: `| Phase or milestone report           | \`docs/09-reports/\`              | \`phase_a_completion_report.md\`                  |`
- Line 115: `   - Reports → \`docs/09-reports/\``
- Line 335: `- Default destination: \`docs/09-reports/\` (phase summaries) + \`Implementation.plans/backlog/\` (lint debt)`
- Line 373: `- Default destination: \`.taskmaster/workflow/\` (internal state) + \`docs/09-reports/\` (public summaries)`
- Line 524: `- Performance metrics → \`docs/09-reports/\``
- Line 531: `- \`docs/09-reports/{PHASE}_fixes_validation.md\` (test results, memory/performance delta)`
- Line 551: `**Outputs:** audit reports, test summaries → \`docs/09-reports/\``
- Line 586: `└── docs/09-reports/{PHASE}_fixes_validation.md`
- Line 594: `├── docs/09-reports/{PHASE}_deployment_decision.md`
- Line 602: `3. Every quality report MUST cite before/after metrics from docs/09-reports/`

---

### LEGACY PATH 6: `docs/templates/` (Should be `docs/07-resources/` or New Folder)

**Total References Found:** 3

#### Files Containing References:

**1. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/08-governance/K1NGov_GOVERNANCE_v1.0_20251108.md**
- Line 153: `- Templates: \`docs/templates/\``
- Context: Reference to template location

**2. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/K1NPlan_PLAN_K1_MIGRATION_MASTER_v1.0_20251108.md**
- Line 162: `mkdir -p docs/templates             # Doc templates`
- Line 388: `cat > docs/templates/DOCUMENT_TEMPLATE.md << 'EOF'`

**3. /Users/spectrasynq/Workspace_Management/Software/K1.node1/CLAUDE.md**
- Line 49: `| Reusable template or checklist      | \`docs/templates/\`            | \`pattern_review_template.md\`                    |`
- Line 410: `- Default destination: \`docs/07-resources/\` or \`docs/templates/\`.`

**Note:** Template references are inconsistent - sometimes pointing to `docs/templates/` and sometimes to `docs/07-resources/`. CLAUDE.md shows templates should move to `docs/07-resources/`.

---

### LEGACY PATH 7: `docs/03-guides/` (Should be `docs/03-guides/`)

**Total References Found:** 2

#### Files Containing References:

**1. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/K1NPlan_PLAN_K1_MIGRATION_MASTER_v1.0_20251108.md**
- Line 156: `mkdir -p docs/guides                # How-tos`
- Update to: `mkdir -p docs/03-guides`

**2. /Users/spectrasynq/Workspace_Management/Software/K1.node1/.kiro/steering/structure.md**
- (No direct reference found to `docs/03-guides/` in steering/structure.md in previous output)

---

### LEGACY PATH 8: `docs/06-reference/` (Should be `docs/06-reference/`)

**Total References Found:** 1

#### Files Containing References:

**1. /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/K1NPlan_PLAN_K1_MIGRATION_MASTER_v1.0_20251108.md**
- Line 157: `mkdir -p docs/reference             # Lookups, glossaries`
- Update to: `mkdir -p docs/06-reference`

---

### LEGACY PATH 9: `docs/07-resources/` (Currently `docs/07-resources/` - CORRECT)

**Total References Found:** 3 (all correct)

These are already using the correct numbered format, so no updates needed.

---

## IMPACT ANALYSIS

### Critical Issues Identified:

1. **Missing Numbered Destination for Reports:** References to `docs/09-reports/` are numerous (24+) but the new numbered structure doesn't have an equivalent `docs/09-reports/`. This needs clarification:
   - Option A: Create `docs/09-reports/` folder
   - Option B: Move reports to `docs/09-implementation/`
   - Option C: Create new folder in numbered structure

2. **Documentation vs. Migration Plan Conflict:** The migration plan (`docs/04-planning/K1NPlan_PLAN_K1_MIGRATION_MASTER_v1.0_20251108.md`) contains shell commands that reference old paths, but these are historical records of what was done for K1.reinvented migration, not current K1.node1 structure.

3. **Inconsistent Template Location:** Templates are referenced as going to both `docs/templates/` and `docs/07-resources/`. Need to standardize on `docs/07-resources/`.

---

## RECOMMENDATION SUMMARY

1. **High Priority (197 references):** Update all legacy path references in:
   - `/Users/spectrasynq/Workspace_Management/Software/K1.node1/CLAUDE.md` (major agent documentation)
   - `/Users/spectrasynq/Workspace_Management/Software/K1.node1/TASKS.md` (task templates)
   - `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/` (all ADRs with references)

2. **Medium Priority (clarification needed):** Decide on `docs/09-reports/` destination:
   - Create `docs/09-reports/` folder, OR
   - Move all reports to `docs/09-implementation/`, OR
   - Other structure

3. **Low Priority (informational):** Update migration plan and kiro specifications (these are mostly historical references)

4. **Quick Win:** Run find-and-replace across all files with mappings:
   - `docs/02-adr/` → `docs/02-adr/`
   - `docs/01-architecture/` → `docs/01-architecture/`
   - `docs/05-analysis/` → `docs/05-analysis/`
   - `docs/04-planning/` → `docs/04-planning/`
   - `docs/03-guides/` → `docs/03-guides/`
   - `docs/06-reference/` → `docs/06-reference/`
   - `docs/templates/` → `docs/07-resources/`
   - `docs/09-reports/` → (needs decision)

---

## FILES REQUIRING UPDATES (SUMMARY)

Total files requiring updates: **16**

| File Path | Legacy Paths Found | Priority |
|-----------|-------------------|----------|
| /Users/spectrasynq/Workspace_Management/Software/K1.node1/CLAUDE.md | adr, architecture, analysis, planning, reports, templates, resources, guides | CRITICAL |
| /Users/spectrasynq/Workspace_Management/Software/K1.node1/TASKS.md | architecture, analysis, adr, planning, reports, templates | HIGH |
| /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0006-codegen-abandonment.md | architecture, analysis, reports, adr | HIGH |
| /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0011-institutional-memory-adoption.md | reports, resources | HIGH |
| /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/K1NPlan_PLAN_K1_MIGRATION_MASTER_v1.0_20251108.md | adr, architecture, analysis, planning, reports, guides, reference, templates | HIGH |
| /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/09-implementation/K1NImpl_PLAN_IMPLEMENTATION_v1.0_20251108.md | adr, planning, reports, architecture, analysis | MEDIUM |
| /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0013-backend-framework-fastapi.md | planning, analysis | MEDIUM |
| /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0015-led-driver-header-split.md | analysis | MEDIUM |
| /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/README.md | adr, analysis, planning | MEDIUM |
| /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/07-resources/K1NRes_GUIDE_GOVERNANCE_TRAINING_NOV6_v1.0_20251108.md | architecture, analysis, adr, planning, reports | MEDIUM |
| /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/07-resources/K1NRes_REFERENCE_GOVERNANCE_QUICK_v1.0_20251108.md | adr, architecture, analysis, planning, reports | MEDIUM |
| /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/K1NPlan_DECISION_GATE_NOV_13_v1.0_20251108.md | reports | LOW |
| /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/K1NPlan_PLAN_WEEK_1_EXECUTION_KICKOFF_v1.0_20251108.md | planning | LOW |
| /Users/spectrasynq/Workspace_Management/Software/K1.node1/tools/governance/add_frontmatter.sh | planning | LOW |
| /Users/spectrasynq/Workspace_Management/Software/K1.node1/.kiro/steering/structure.md | architecture, analysis, adr, reports, planning | LOW |
| /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0005-folder-structure.md | planning | LOW |

---

## NEXT STEPS FOR USER

1. Review and approve the `docs/09-reports/` destination decision
2. Run targeted find-and-replace operations using the mapping above
3. Test all cross-references to ensure links still work
4. Update any deployment scripts that reference old paths
5. Commit changes with message: `docs: Update all legacy paths to numbered structure (docs/0X-*)`

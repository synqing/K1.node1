# K1.node1 Legacy Path Mapping - Quick Reference

**Use this table for find-and-replace operations**

| Legacy Path | New Numbered Path | Count | Files Affected |
|-------------|------------------|-------|-----------------|
| `docs/02-adr/` | `docs/02-adr/` | 31 | CLAUDE.md, TASKS.md, ADR files, shell scripts |
| `docs/01-architecture/` | `docs/01-architecture/` | 41 | CLAUDE.md, TASKS.md, planning docs, ADRs |
| `docs/05-analysis/` | `docs/05-analysis/` | 21 | CLAUDE.md, TASKS.md, ADRs, analysis docs |
| `docs/04-planning/` | `docs/04-planning/` | 24 | CLAUDE.md, TASKS.md, shell scripts, governance docs |
| `docs/09-reports/` | `docs/09-implementation/` OR NEW | 24 | CLAUDE.md, TASKS.md, ADRs (DECISION NEEDED) |
| `docs/templates/` | `docs/07-resources/` | 3 | CLAUDE.md, GOVERNANCE.md, migration plans |
| `docs/03-guides/` | `docs/03-guides/` | 2 | Migration plans |
| `docs/06-reference/` | `docs/06-reference/` | 1 | Migration plans |
| `docs/07-resources/` | `docs/07-resources/` | 3 | Already correct, no changes needed |

---

## CRITICAL DECISION POINT

**STATUS OF `docs/09-reports/` (24+ references):**

The K1.node1 codebase has no `docs/09-reports/` folder currently. You must decide:

### Option A: Create `docs/09-reports/`
```bash
mkdir -p /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/09-reports
```
Then update all references: `docs/09-reports/` → `docs/09-reports/`

### Option B: Merge into `docs/09-implementation/`
Keep implementation and reports together:
- Update all references: `docs/09-reports/` → `docs/09-implementation/reports/`
- Create: `/docs/09-implementation/reports/` subfolder

### Option C: Create Separate `docs/10-reports/`
Extend numbered structure:
- Create: `docs/10-reports/`
- Update all references: `docs/09-reports/` → `docs/10-reports/`

**RECOMMENDATION:** Option A (create `docs/09-reports/`) maintains consistency with K1.reinvented structure

---

## BATCH FIND-REPLACE COMMANDS

Run these in K1.node1 root directory to update all files:

```bash
# Replace docs/02-adr/ with docs/02-adr/
find . -type f \( -name "*.md" -o -name "*.sh" -o -name "*.json" \) -exec sed -i '' 's|docs/02-adr/|docs/02-adr/|g' {} +

# Replace docs/01-architecture/ with docs/01-architecture/
find . -type f \( -name "*.md" -o -name "*.sh" -o -name "*.json" \) -exec sed -i '' 's|docs/01-architecture/|docs/01-architecture/|g' {} +

# Replace docs/05-analysis/ with docs/05-analysis/
find . -type f \( -name "*.md" -o -name "*.sh" -o -name "*.json" \) -exec sed -i '' 's|docs/05-analysis/|docs/05-analysis/|g' {} +

# Replace docs/04-planning/ with docs/04-planning/
find . -type f \( -name "*.md" -o -name "*.sh" -o -name "*.json" \) -exec sed -i '' 's|docs/04-planning/|docs/04-planning/|g' {} +

# Replace docs/03-guides/ with docs/03-guides/
find . -type f \( -name "*.md" -o -name "*.sh" -o -name "*.json" \) -exec sed -i '' 's|docs/03-guides/|docs/03-guides/|g' {} +

# Replace docs/06-reference/ with docs/06-reference/
find . -type f \( -name "*.md" -o -name "*.sh" -o -name "*.json" \) -exec sed -i '' 's|docs/06-reference/|docs/06-reference/|g' {} +

# Replace docs/templates/ with docs/07-resources/
find . -type f \( -name "*.md" -o -name "*.sh" -o -name "*.json" \) -exec sed -i '' 's|docs/templates/|docs/07-resources/|g' {} +

# Replace docs/09-reports/ (AFTER DECISION - shown with Option A: docs/09-reports/)
# WARNING: Do NOT run until you decide on reports destination
# find . -type f \( -name "*.md" -o -name "*.sh" -o -name "*.json" \) -exec sed -i '' 's|docs/09-reports/|docs/09-reports/|g' {} +
```

---

## FILES TO UPDATE (PRIORITY ORDER)

### CRITICAL (affects core documentation)
1. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/CLAUDE.md` - 30+ references
2. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/TASKS.md` - 10+ references
3. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0006-codegen-abandonment.md` - 15+ references

### HIGH (affects agent instructions and planning)
4. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0004-institutional-memory-adoption.md` - 10+ references
5. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/K1_MIGRATION_MASTER_PLAN.md` - 25+ references
6. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/09-implementation/IMPLEMENTATION_PLAN.md` - 12+ references
7. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0005-backend-framework-fastapi.md` - 2 references
8. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/README.md` - 3 references

### MEDIUM (affects training and governance)
9. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/07-resources/GOVERNANCE_TRAINING_NOV6.md` - 5 references
10. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/07-resources/governance_quick_ref.md` - 7 references
11. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/08-governance/GOVERNANCE.md` - 1 reference

### LOW (affects tools and specs)
12. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/tools/governance/add_frontmatter.sh` - 1 reference
13. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/.kiro/steering/structure.md` - 5 references
14. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/02-adr/ADR-0001-led_driver_header_split.md` - 2 references
15. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/NOV_13_DECISION_GATE.md` - 2 references
16. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/WEEK_1_EXECUTION_KICKOFF.md` - 1 reference

---

## VALIDATION CHECKLIST

After running replacements:

- [ ] Create `docs/09-reports/` folder (or choose alternative)
- [ ] Run `grep -r "docs/02-adr/" .` to verify no remaining legacy paths
- [ ] Run `grep -r "docs/01-architecture/" .` to verify no remaining legacy paths
- [ ] Run `grep -r "docs/05-analysis/" .` to verify no remaining legacy paths
- [ ] Run `grep -r "docs/04-planning/" .` to verify no remaining legacy paths
- [ ] Run `grep -r "docs/09-reports/" .` to verify no remaining legacy paths (should find 0 if Option A used)
- [ ] Run `grep -r "docs/templates/" .` to verify no remaining legacy paths
- [ ] Run `grep -r "docs/03-guides/" .` to verify no remaining legacy paths
- [ ] Run `grep -r "docs/06-reference/" .` to verify no remaining legacy paths
- [ ] Test all markdown links: `grep -r "\[.*\](.*docs/" . | head -20` to spot-check cross-references
- [ ] Commit changes: `git add . && git commit -m "docs: Update all legacy paths to numbered structure (docs/0X-*)"`

---

## ROLLBACK PROCEDURE

If something goes wrong:

```bash
git diff HEAD~1 --stat  # See what changed
git diff HEAD~1         # See exact changes
git reset --hard HEAD~1 # Rollback if needed
```

---

## REFERENCE DOCUMENT

Full audit details: `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/08-governance/K1_NODE1_LEGACY_PATH_AUDIT.md`


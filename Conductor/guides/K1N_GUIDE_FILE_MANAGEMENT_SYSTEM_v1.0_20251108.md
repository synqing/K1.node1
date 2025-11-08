# K1.node1 Standardized File Management System Implementation Guide

**Status**: Active
**Version**: 1.0
**Date**: 2025-11-08
**Owner**: Documentation Lead
**Target Audience**: All Agents, Developers, Documentation Contributors

⚠️ **MANDATORY READING FOR ALL AGENTS**: This system is non-negotiable. All files must comply with these standards.

---

## Overview

K1.node1 has implemented a comprehensive, standardized documentation and file management system to ensure:

✅ Consistency across all documentation
✅ Easy file discovery and navigation
✅ Version control and historical tracking
✅ Automated compliance enforcement
✅ Clear file ownership and maintenance

---

## What Changed?

### Before (Chaotic)
```
❌ Random filenames (conductor-guide.md, THRESHOLDS.md, config.json)
❌ Files scattered in project root
❌ No version tracking
❌ No archiving system
❌ Manual organization
```

### After (Standardized)
```
✅ Consistent naming: K1N_GUIDE_v1.0_20251108.md
✅ Organized directories: guides/, rules/, scripts/, templates/, archive/, temp/
✅ Automatic version tracking
✅ Built-in archiving system
✅ Pre-commit enforcement
✅ Weekly audits
```

---

## The Standard (You Must Know This)

### File Naming Format

```
[ProjectCode]_[DocumentType]_v[Version]_[YYYYMMDD].[ext]
```

### Real Examples

```
K1N_GUIDE_v1.0_20251108.md                    ✅ How-to guide
K1NCond_SPEC_v1.0_20251108.md                 ✅ Conductor specification
K1NCI_CONFIG_v1.0_20251108.yaml               ✅ CI/CD configuration
K1N_RULE_v1.0_20251108.md                     ✅ Standard/rule
K1NTask_CHECKLIST_v1.0_20251108.md            ✅ Task checklist
K1N_SCRIPT_v1.0_20251108.sh                   ✅ Executable script
K1N_TEMPLATE_v1.0_20251108.md                 ✅ Reusable template
K1N_INDEX_v1.0_20251108.md                    ✅ Master index
K1N_CHANGELOG_v1.0_20251108.md                ✅ Change history
```

### Invalid Examples

```
conductor-guide.md                            ❌ No project code, version, or date
THRESHOLDS_v1.md                              ❌ No project code or date
K1N_guide_final_2025-11-08.md                 ❌ Wrong date format (use YYYYMMDD)
K1N_GUIDE_v1_20251108.md                      ❌ Non-semantic version (use v1.0)
```

---

## Directory Structure

```
Conductor/
│
├── guides/                    # How-to guides, specifications, reports
│   ├── K1NCond_SPEC_v1.0_20251108.md
│   ├── K1NCond_GUIDE_*.md
│   ├── K1NCI_GUIDE_*.md
│   ├── K1NTask_GUIDE_*.md
│   └── K1N_REPORT_*.md
│
├── rules/                     # Standards, policies, conventions
│   ├── K1N_RULE_v1.0_20251108.md        ← File Naming Standards
│   ├── K1N_AUDIT_CHECKLIST_v1.0_20251108.md
│   └── K1N_RULE_*.md
│
├── scripts/                   # Executable scripts and tools
│   ├── K1N_SCRIPT_validate_file_naming_v1.0_20251108.sh
│   ├── K1NCond_SCRIPT_*.sh
│   └── K1N_SCRIPT_*.py
│
├── templates/                 # Reusable templates
│   ├── K1N_TEMPLATE_*.md
│   ├── K1NTask_TEMPLATE_*.json
│   └── K1N_TEMPLATE_*.yaml
│
├── archive/                   # Deprecated/superseded files
│   ├── K1NCond_SPEC_v0.9_20251101.md    (old version)
│   └── K1N_GUIDE_OLD_v1.0_20251105.md   (deprecated)
│
├── temp/                      # Work-in-progress (auto-cleaned weekly)
│   ├── K1N_DOC_v1.0_DRAFT_20251108.md
│   └── K1N_ANALYSIS_DRAFT_20251108.md
│
├── K1N_INDEX_v1.0_20251108.md                ← MASTER INDEX
├── K1N_CHANGELOG_v1.0_20251108.md            ← CHANGE HISTORY
├── K1N_FILE_NAMING_STANDARDS_v1.0_20251108.md  ← THIS STANDARD
├── .gitignore                 # Ignore temp/ and other artifacts
└── README.md                  # Overview (if needed)
```

---

## For Agents: What You MUST Do

### ✅ When Creating a New File

**Step 1**: Choose your document type
```
GUIDE  = How-to, playbook, tutorial
SPEC   = Architecture, design, specification
RULE   = Standard, policy, convention
SCRIPT = Executable code (bash, python, etc.)
REPORT = Analysis, findings, results
CHECKLIST = Validation, audit, testing
CONFIG = Configuration file
TEMPLATE = Reusable template
PLAN   = Planning document
```

**Step 2**: Choose your project code
```
K1N     = Main K1.node1 project
K1NCond = Conductor-specific
K1NCI   = CI/CD related
K1NTask = TaskMaster related
```

**Step 3**: Create with correct name and location
```bash
# EXAMPLE: Creating a Conductor guide

# ✅ CORRECT
File: K1NCond_GUIDE_CORELOOP_v1.0_20251108.md
Location: Conductor/guides/K1NCond_GUIDE_CORELOOP_v1.0_20251108.md

# ❌ WRONG
File: conductor-core-loop-guide.md
Location: Conductor/conductor-core-loop-guide.md
```

**Step 4**: Update the INDEX
```markdown
In K1N_INDEX_v1.0_20251108.md, add your file:

| File | Version | Date | Description |
|------|---------|------|-------------|
| K1NCond_GUIDE_CORELOOP_v1.0_20251108.md | v1.0 | 2025-11-08 | Core loop implementation guide |
```

**Step 5**: Update the CHANGELOG
```markdown
In K1N_CHANGELOG_v1.0_20251108.md, add:

### Added
- **K1NCond_GUIDE_CORELOOP_v1.0_20251108.md**
  - Guide for implementing Conductor's core 10-second polling loop
```

### ✅ When Updating an Existing File

**Never** edit a file in place. Create a new version instead:

```bash
# ❌ WRONG - Editing in place
Edit: K1NCond_SPEC_v1.0_20251108.md

# ✅ CORRECT - Create new version
Create: K1NCond_SPEC_v1.1_20251110.md (increment version)
Archive: Move K1NCond_SPEC_v1.0_20251108.md to archive/
Update: K1N_INDEX_v1.0_20251108.md (point to v1.1)
Update: K1N_CHANGELOG_v1.0_20251108.md (log the update)
```

### ✅ When File Becomes Obsolete

```bash
# Step 1: Move to archive
mv Conductor/guides/K1NCond_GUIDE_OLD_v1.0_20251105.md \
   Conductor/archive/K1NCond_GUIDE_OLD_v1.0_20251105.md

# Step 2: Update INDEX
# Remove from active section, add to archived section

# Step 3: Update CHANGELOG
# Add entry: "Archived K1NCond_GUIDE_OLD_v1.0_20251105.md (replaced by v2.0)"
```

### ✅ When Working on Something Incomplete

```bash
# Use _DRAFT suffix and temp/ directory:

File: K1N_DOC_v1.0_DRAFT_20251108.md
Location: Conductor/temp/K1N_DOC_v1.0_DRAFT_20251108.md

# When complete, move to appropriate directory:
mv Conductor/temp/K1N_DOC_v1.0_DRAFT_20251108.md \
   Conductor/guides/K1N_GUIDE_v1.0_20251108.md
```

---

## Pre-Commit Hook Protection

All commits are automatically validated. If your file doesn't meet standards:

```bash
❌ COMMIT BLOCKED - File naming violations detected

Please fix the following:
  1. Rename files to match: [ProjectCode]_[Type]_v[Version]_[YYYYMMDD].[ext]
  2. Move to correct directory (guides/, rules/, scripts/, templates/)
  3. Use semantic versions (v1.0, v1.1, not v1, v2)
  4. Use YYYYMMDD date format
```

**Resolution**:
1. Rename your file
2. Move to correct directory
3. Update INDEX and CHANGELOG
4. Commit again

---

## Quick Reference Table

| I Want to Create | Format | Directory | Example |
|---|---|---|---|
| A how-to guide | GUIDE | guides/ | K1N_GUIDE_v1.0_20251108.md |
| An architecture spec | SPEC | guides/ | K1NCond_SPEC_v1.0_20251108.md |
| A standard/rule | RULE | rules/ | K1N_RULE_v1.0_20251108.md |
| A script | SCRIPT | scripts/ | K1N_SCRIPT_v1.0_20251108.sh |
| An analysis/report | REPORT | guides/ | K1N_REPORT_v1.0_20251108.md |
| A checklist | CHECKLIST | guides/ | K1N_CHECKLIST_v1.0_20251108.md |
| A configuration file | CONFIG | scripts/ | K1N_CONFIG_v1.0_20251108.yaml |
| A reusable template | TEMPLATE | templates/ | K1N_TEMPLATE_v1.0_20251108.md |
| A draft/WIP | (any) _DRAFT | temp/ | K1N_DOC_v1.0_DRAFT_20251108.md |
| An old/deprecated file | (any) | archive/ | K1N_GUIDE_v0.9_20251101.md |

---

## Weekly Maintenance

### Monday Morning: Run Audit

```bash
# Use the audit checklist:
Conductor/K1N_AUDIT_CHECKLIST_v1.0_20251108.md

# Create audit report:
Conductor/K1N_AUDIT_REPORT_v1.0_YYYYMMDD.md
```

### Friday Afternoon: Review Next Week

- Check for any outdated files
- Plan documentation updates
- Prepare for Monday audit

---

## FAQ for Agents

**Q: Can I use different naming?**
A: No. Pre-commit hook will reject it. Must follow: `[Code]_[Type]_v[Version]_[YYYYMMDD].[ext]`

**Q: Where should I put my file?**
A: Depends on type:
- GUIDE/SPEC/REPORT → `guides/`
- RULE → `rules/`
- SCRIPT/CONFIG → `scripts/`
- TEMPLATE → `templates/`
- Work-in-progress → `temp/` (with _DRAFT)
- Deprecated → `archive/`

**Q: What if I need to update a file?**
A: Create new version (v1.0 → v1.1), archive old version, update INDEX and CHANGELOG.

**Q: Can I delete a file?**
A: Never delete. Archive it instead (move to archive/ folder).

**Q: What's the date format?**
A: YYYYMMDD (2025-11-08 → 20251108). No hyphens.

**Q: What's semantic versioning?**
A: v1.0, v1.1, v1.2, v2.0, etc. (Major.Minor)
- v1.0 = First version
- v1.1 = Bug fix, minor update
- v2.0 = Major redesign

---

## Files You Need to Know

1. **K1N_FILE_NAMING_STANDARDS_v1.0_20251108.md** ← Read before creating ANY file
2. **K1N_INDEX_v1.0_20251108.md** ← Master list of all files
3. **K1N_CHANGELOG_v1.0_20251108.md** ← Change history
4. **K1N_AUDIT_CHECKLIST_v1.0_20251108.md** ← Weekly audit
5. **K1N_SCRIPT_validate_file_naming_v1.0_20251108.sh** ← Pre-commit hook

---

## Enforcement & Penalties

### Non-Compliant Files Will Be:
- ❌ Rejected at pre-commit (can't commit)
- ❌ Flagged in pull request review
- ❌ Requires correction before merge

### How to Fix:
1. Rename file to meet standard
2. Move to correct directory
3. Update INDEX and CHANGELOG
4. Commit again

---

## Next Steps

### For Documentation Lead
1. [ ] Copy `.githooks/validate-file-naming.sh` from scripts/ (make executable)
2. [ ] Configure git hook: `git config core.hooksPath .githooks`
3. [ ] Copy Conductor/.gitignore
4. [ ] Schedule first audit (Monday)
5. [ ] Train team on standards

### For All Agents
1. [ ] Read K1N_FILE_NAMING_STANDARDS_v1.0_20251108.md
2. [ ] Bookmark K1N_INDEX_v1.0_20251108.md
3. [ ] Save K1N_AUDIT_CHECKLIST_v1.0_20251108.md
4. [ ] Use the format for ALL new files from now on
5. [ ] Update INDEX + CHANGELOG when you create files

---

## Support

**Questions about naming?** → See K1N_FILE_NAMING_STANDARDS_v1.0_20251108.md

**Need to find a file?** → Check K1N_INDEX_v1.0_20251108.md

**Want to know what changed?** → Check K1N_CHANGELOG_v1.0_20251108.md

**Audit failing?** → Run K1N_AUDIT_CHECKLIST_v1.0_20251108.md

---

**Status**: Ready for Production
**Last Updated**: 2025-11-08
**Review Cycle**: Weekly (Monday audits)
**Enforced By**: Pre-commit hook, GitHub Actions, manual review

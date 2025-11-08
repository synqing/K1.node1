# K1.node1 Documentation Master Index

**Status**: Active
**Version**: 1.0
**Last Updated**: 2025-11-08
**Owner**: Documentation Lead

This is the single source of truth for all K1.node1 documentation files. All files MUST be listed here and follow the naming convention `[ProjectCode]_[Type]_v[Version]_[YYYYMMDD].[ext]`.

---

## 📋 Navigation Quick Links

- [Active Documents](#active-documents)
- [By Category](#by-category)
- [Archived Documents](#archived-documents)
- [Maintenance Notes](#maintenance-notes)

---

## Active Documents

### Standards & Rules (in `rules/`)

| File | Version | Date | Description |
|------|---------|------|-------------|
| K1N_FILE_NAMING_STANDARDS_v1.0_20251108.md | v1.0 | 2025-11-08 | File naming convention, directory structure, compliance rules |
| K1N_AUDIT_CHECKLIST_v1.0_20251108.md | v1.0 | 2025-11-08 | Weekly documentation audit procedures |

### Conductor Documentation (in `guides/`)

| File | Version | Date | Description |
|------|---------|------|-------------|
| K1NCond_SPEC_v1.0_20251108.md | v1.0 | 2025-11-08 | Conductor core configuration & operational specification |
| K1NCond_GUIDE_THRESHOLDS_v1.0_20251108.md | v1.0 | 2025-11-08 | Detailed thresholds and parameters reference |
| K1NCond_GUIDE_SUMMARY_v1.0_20251108.md | v1.0 | 2025-11-08 | Quick reference card for Captain operations |
| K1NCond_GUIDE_VALIDATION_v1.0_20251108.md | v1.0 | 2025-11-08 | Pre-deployment validation checklist |
| K1NCond_GUIDE_SETUP_v1.0_20251108.md | v1.0 | 2025-11-08 | Navigation guide and quick start |

### CI/CD Documentation (in `guides/`)
### CI/CD & Release Management (in `guides/` and `rules/`)

| File | Version | Date | Description |
|------|---------|------|-------------|
| K1NCI_GUIDE_MERGE_RELEASE_v1.0_20251108.md | v1.0 | 2025-11-08 | Merge and release process guide |
| K1NCI_INDEX_RELEASES_v1.0_20251108.md | v1.0 | 2025-11-08 | Index of merge gates and release info |
| K1NCI_GUIDE_STAGING_E2E_v1.0_20251108.md | v1.0 | 2025-11-08 | Staging environment E2E test guide |


| File | Version | Date | Description |
|------|---------|------|-------------|
| K1NCI_GUIDE_WORKFLOWS_v1.0_20251108.md | v1.0 | 2025-11-08 | GitHub Actions workflows (k1-node1-ci, pre-merge, release, staging-e2e) |
| K1NCI_GUIDE_HOOKS_v1.0_20251108.md | v1.0 | 2025-11-08 | Conductor hooks implementation (setup, run, archive) |
| K1NCI_GUIDE_STAGING_v1.0_20251108.md | v1.0 | 2025-11-08 | Staging E2E smoke testing procedures |

### Configuration Files (in `scripts/` or root)

| File | Version | Date | Description |
|------|---------|------|-------------|
| K1NCond_CONFIG_v1.0_20251108.json | v1.0 | 2025-11-08 | Machine-readable thresholds configuration |
| conductor.json | v1.0 | 2025-11-08 | Conductor lifecycle hooks configuration |

### Task Management (in `guides/`)

| File | Version | Date | Description |
|------|---------|------|-------------|
| K1NTask_GUIDE_SYSTEM_v1.0_20251108.md | v1.0 | 2025-11-08 | TaskMaster system overview, structure, workflow |
| K1NTask_REFERENCE_CLI_v1.0_20251108.md | v1.0 | 2025-11-08 | TaskMaster CLI command reference |

### Miscellaneous (in `guides/`)

| File | Version | Date | Description |
|------|---------|------|-------------|
| K1N_CHANGELOG_v1.0_20251108.md | v1.0 | 2025-11-08 | Version history and change log |

---

## By Category

### 🚀 Conductor (K1NCond_*)
- K1NCond_SPEC_v1.0_20251108.md - Architecture & core config
- K1NCond_GUIDE_THRESHOLDS_v1.0_20251108.md - Detailed thresholds
- K1NCond_GUIDE_SUMMARY_v1.0_20251108.md - Quick reference
- K1NCond_GUIDE_VALIDATION_v1.0_20251108.md - Validation checklist
- K1NCond_GUIDE_SETUP_v1.0_20251108.md - Setup guide
- K1NCond_CONFIG_v1.0_20251108.json - JSON config
- K1NCond_GUIDE_HOOKS_v1.0_20251108.md - Hooks guide

### ⚙️ CI/CD (K1NCI_*)
- K1NCI_GUIDE_WORKFLOWS_v1.0_20251108.md - GitHub Actions
- K1NCI_GUIDE_HOOKS_v1.0_20251108.md - Conductor hooks
- K1NCI_GUIDE_STAGING_v1.0_20251108.md - Staging E2E

### 📋 Task Management (K1NTask_*)
- K1NTask_GUIDE_SYSTEM_v1.0_20251108.md - System overview
- K1NTask_REFERENCE_CLI_v1.0_20251108.md - CLI reference

### 📏 Standards & Rules (K1N_RULE_*)
- K1N_FILE_NAMING_STANDARDS_v1.0_20251108.md - Naming convention

### 🧹 Maintenance (K1N_*)
- K1N_CHANGELOG_v1.0_20251108.md - Change history
- K1N_AUDIT_CHECKLIST_v1.0_20251108.md - Audit procedures

---

## Archived Documents

### Superseded by Newer Versions

| File | Reason | Archived | Replacement |
|------|--------|----------|-------------|
| K1NCond_GUIDE_HOOKS_v2.0_20251108.md | Superseded by v1.0 | 2025-11-08 | K1NCond_GUIDE_HOOKS_v1.0_20251108.md |
| K1NCond_BRIEF_MCP_DUPLICATE_v1.0_20251108.md | Duplicate of K1NCond_BRIEF_MCP_v1.0 | 2025-11-08 | K1NCond_BRIEF_MCP_v1.0_20251108.md |
| K1NCond_INDEX_SUPERSEDED_v1.0_20251108.md | Replaced by K1N_INDEX_v1.0 | 2025-11-08 | K1N_INDEX_v1.0_20251108.md |
| K1NCond_ANNEX_A_INTEGRATION_DUPLICATE_v1.0_20251108.md | Duplicate in root | 2025-11-08 | K1NCond_ANNEX_A_INTEGRATION_v1.0_20251108.md |
| K1NCond_ANNEX_B_SCALABILITY_DUPLICATE_v1.0_20251108.md | Duplicate in root | 2025-11-08 | K1NCond_ANNEX_B_SCALABILITY_v1.0_20251108.md |
| K1NCond_ANNEX_C_DEPLOYMENT_DUPLICATE_v1.0_20251108.md | Duplicate in root | 2025-11-08 | K1NCond_ANNEX_C_DEPLOYMENT_v1.0_20251108.md |
| K1NCond_ANNEX_D_RUNBOOKS_DUPLICATE_v1.0_20251108.md | Duplicate in root | 2025-11-08 | K1NCond_ANNEX_D_RUNBOOKS_v1.0_20251108.md |
| K1NCond_ANNEX_E_SECURITY_DUPLICATE_v1.0_20251108.md | Duplicate in root | 2025-11-08 | K1NCond_ANNEX_E_SECURITY_v1.0_20251108.md |

| File | Reason | Archived | Replacement |
|------|--------|----------|-------------|
| (None yet) | — | — | — |

### Deprecated Standards

| File | Reason | Archived | Notes |
|------|--------|----------|-------|
| (None yet) | — | — | — |

---

## Directory Structure Reference

```
Conductor/
├── guides/                           # How-to guides
│   ├── K1NCond_SPEC_v1.0_20251108.md
│   ├── K1NCond_GUIDE_*.md
│   ├── K1NCI_GUIDE_*.md
│   ├── K1NTask_GUIDE_*.md
│   └── K1NTask_REFERENCE_*.md
│
├── rules/                            # Standards and rules
│   ├── K1N_FILE_NAMING_STANDARDS_v1.0_20251108.md
│   ├── K1N_AUDIT_CHECKLIST_v1.0_20251108.md
│   └── ...
│
├── scripts/                          # Executable scripts
│   ├── K1NCond_SCRIPT_*.sh
│   ├── K1N_SCRIPT_*.py
│   └── ...
│
├── templates/                        # Reusable templates
│   ├── K1N_TEMPLATE_*.md
│   └── ...
│
├── archive/                          # Deprecated versions
│   └── (files moved here when superseded)
│
├── temp/                             # Work-in-progress
│   └── (files with _DRAFT suffix, cleaned weekly)
│
├── K1N_INDEX_v1.0_20251108.md        # THIS FILE
├── K1N_CHANGELOG_v1.0_20251108.md    # Change history
├── K1N_FILE_NAMING_STANDARDS_v1.0_20251108.md
└── .gitignore
```

---

## Maintenance Notes

### Update Frequency
- **INDEX**: Updated whenever new file is created or archived
- **CHANGELOG**: Updated with each significant change
- **Standards**: Reviewed quarterly

### How to Add a New File
1. Create file with naming convention: `[ProjectCode]_[Type]_v1.0_[YYYYMMDD].[ext]`
2. Place in correct directory (guides/, rules/, scripts/, templates/)
3. Add entry to this INDEX in appropriate section
4. Update CHANGELOG with "Added" entry
5. Commit all three files together

### How to Update Existing File
1. Don't overwrite! Create new version: `v1.1_[YYYYMMDD]`
2. Move old version to archive/ or delete if only draft
3. Update INDEX to point to new version
4. Update CHANGELOG with "Updated" entry

### How to Deprecate File
1. Move to archive/ directory
2. Update INDEX to move to "Archived Documents" section
3. Update CHANGELOG with "Archived" entry
4. Note replacement file if applicable

---

## Key Files for Agents

**BEFORE CREATING ANY FILE, READ THESE**:
1. K1N_FILE_NAMING_STANDARDS_v1.0_20251108.md ← **MANDATORY**
2. K1N_AUDIT_CHECKLIST_v1.0_20251108.md
3. This INDEX (K1N_INDEX_v1.0_20251108.md)

**Non-compliant files WILL BE REJECTED at pre-commit.**

---

## Recent Changes

**2025-11-08 - Initial Setup**
- Created file naming standards (v1.0)
- Created master index (v1.0)
- Created changelog (v1.0)
- Created audit checklist (v1.0)
- Migrated Conductor thresholds documentation to standardized naming
- Migrated CI/CD documentation to standardized naming
- Set up directory structure (guides/, rules/, scripts/, templates/, archive/, temp/)

---

## Contact

**Documentation Lead**: [To be assigned]
**Last Review**: 2025-11-08
**Next Review**: 2025-11-15

For questions about file naming, directory placement, or this index, refer to K1N_FILE_NAMING_STANDARDS_v1.0_20251108.md.

# K1.node1 File Naming & Documentation Standards

**Status**: Active Standard
**Version**: 1.0
**Date**: 2025-11-08
**Owner**: Documentation Lead
**Last Reviewed**: 2025-11-08

⚠️ **CRITICAL**: All agents MUST follow these standards without exception. Non-compliant files will be rejected at pre-commit.

---

## 1. MANDATORY FILE NAMING CONVENTION

### Format (Strict Compliance Required)

```
[ProjectCode]_[DocumentType]_[Version]_[YYYYMMDD].[ext]
```

### Components

#### **ProjectCode** (Required - 3-4 characters)
```
K1N     = K1.node1 main project
K1NCI   = K1.node1 CI/CD (GitHub Actions)
K1NCond = K1.node1 Conductor (orchestration)
K1NTask = K1.node1 TaskMaster (tasks)
```

#### **DocumentType** (Required - Categorical)
```
DOC     = Documentation (general)
GUIDE   = How-to guide, playbook, runbook
RULE    = Rules, policies, standards
SCRIPT  = Executable script, tool, code
PLAN    = Planning document, proposal, roadmap
SPEC    = Specification, architecture, design
REPORT  = Report, analysis, findings
CONFIG  = Configuration file, settings
CHECKLIST = Validation, test, or audit checklist
TEMPLATE = Template for reuse
INDEX   = Master index or catalog
CHANGELOG = Version history, changes
```

#### **Version** (Required - Semantic)
```
v1.0    = Major release version
v1.1    = Minor revision
v1.2.1  = Patch fix
```

#### **YYYYMMDD** (Required - Creation/Last Update Date)
```
20251108 = November 8, 2025
20251201 = December 1, 2025
```

#### **Extension** (Required)
```
.md     = Markdown documentation
.json   = JSON configuration/data
.yaml   = YAML configuration
.sh     = Bash script
.py     = Python script
.ts     = TypeScript source
.js     = JavaScript source
.csv    = Comma-separated values
.txt    = Plain text
```

### Valid Examples ✅

```
K1N_GUIDE_v1.0_20251108.md              # K1.node1 guide
K1NCond_SPEC_v1.0_20251108.md           # Conductor specification
K1NCI_CONFIG_v1.0_20251108.yaml         # CI/CD configuration
K1NTask_CHECKLIST_v1.0_20251108.md      # TaskMaster checklist
K1N_RULE_v1.0_20251108.md               # Project rule (naming standard)
K1NCond_SCRIPT_v1.0_20251108.sh         # Conductor script
K1N_INDEX_v1.0_20251108.md              # Master index
```

### Invalid Examples ❌

```
conductor-config.md                     # ❌ Missing project code, no version
CONDUCTOR_THRESHOLDS.md                 # ❌ No version or date
config_file_v1.yaml                     # ❌ No date
K1N_guide.md                            # ❌ No version or date
K1NConductor_DOC_1.0_2025-11-08.md      # ❌ Date format wrong (use YYYYMMDD)
```

---

## 2. DIRECTORY STRUCTURE

### Approved Locations

```
Conductor/
├── guides/                       # How-to guides, playbooks, runbooks
│   ├── K1NCond_GUIDE_*.md
│   ├── K1NCI_GUIDE_*.md
│   └── ...
│
├── rules/                        # Standards, policies, conventions
│   ├── K1N_RULE_v1.0_20251108.md
│   ├── K1NCond_RULE_*.md
│   └── ...
│
├── scripts/                      # Executable scripts, tools
│   ├── K1NCond_SCRIPT_v1.0_20251108.sh
│   ├── K1N_SCRIPT_v1.0_20251108.py
│   └── ...
│
├── templates/                    # Reusable templates
│   ├── K1N_TEMPLATE_v1.0_20251108.md
│   ├── K1NTask_TEMPLATE_v1.0_20251108.json
│   └── ...
│
├── archive/                      # Deprecated/superseded versions
│   ├── K1NCond_SPEC_v0.9_20251101.md   (deprecated)
│   ├── K1N_INDEX_v0.1_20251105.md      (superseded)
│   └── ...
│
├── temp/                         # Work-in-progress (cleaned weekly)
│   ├── K1N_DOC_v1.0_DRAFT_20251108.md  (use _DRAFT suffix)
│   └── ...
│
├── K1N_INDEX_v1.0_20251108.md          # MASTER INDEX (root level)
├── K1N_CHANGELOG_v1.0_20251108.md      # CHANGELOG (root level)
├── K1N_FILE_NAMING_STANDARDS_v1.0_20251108.md  # THIS FILE (root level)
└── .gitignore

[Also present - legacy locations being phased out]
├── annexes/                      # Deprecated - use guides/ instead
├── reference/                    # Deprecated - use guides/ or rules/
└── [*.md files directly]         # Deprecated - must move to subdirs
```

---

## 3. VERSION CONTROL & ARCHIVING

### Version Numbering Scheme

```
v1.0    = First stable release
v1.1    = Bug fixes, minor updates
v1.2    = Feature additions
v2.0    = Major redesign/overhaul
```

### Archiving Process

**When to Archive**:
- ❌ Document is superseded by newer version
- ❌ Standard or policy is replaced
- ❌ Script is deprecated
- ❌ Guide is outdated

**How to Archive**:
```bash
# Move deprecated file to archive/
mv Conductor/guides/K1NCond_GUIDE_v1.0_20251105.md \
   Conductor/archive/K1NCond_GUIDE_v1.0_20251105.md

# Update CHANGELOG and INDEX
```

---

## 4. AGENT COMPLIANCE RULES

### ⚠️ ALL AGENTS MUST FOLLOW THESE RULES

**Rule 1: File Creation**
```
✅ CORRECT: K1N_DOC_v1.0_20251108.md
❌ WRONG:   new-documentation.md
```

**Rule 2: File Placement**
```
✅ CORRECT: Conductor/guides/K1NCond_GUIDE_v1.0_20251108.md
❌ WRONG:   Conductor/K1NCond_GUIDE_v1.0_20251108.md
```

**Rule 3: Version Updates**
```
✅ CORRECT: Create K1N_DOC_v1.1_20251110.md (new version)
❌ WRONG:   Edit K1N_DOC_v1.0_20251108.md in place
```

**Rule 4: Archiving**
```
✅ CORRECT: mv guides/K1N_DOC_v1.0.md archive/K1N_DOC_v1.0.md
❌ WRONG:   rm guides/K1N_DOC_v1.0.md
```

**Rule 5: Temporary Files**
```
✅ CORRECT: Conductor/temp/K1N_DOC_v1.0_DRAFT_20251108.md
❌ WRONG:   Conductor/guides/K1N_DOC_DRAFT.md
```

---

## 5. PRE-COMMIT HOOK VALIDATION

**The following will be rejected**:
- ❌ Filename doesn't match `[ProjectCode]_[Type]_v*_[YYYYMMDD].*`
- ❌ File placed in wrong directory
- ❌ Version is not semantic (v1.0, v1.1, etc.)
- ❌ Date format is not YYYYMMDD
- ❌ Non-draft files in `temp/`
- ❌ Multiple versions of same doc with same version number

---

## 6. QUICK REFERENCE TABLE

| Need | Format | Location |
|------|--------|----------|
| Step-by-step guide | `K1N_GUIDE_v1.0_YYYYMMDD.md` | `guides/` |
| Architecture/design | `K1N_SPEC_v1.0_YYYYMMDD.md` | `guides/` |
| Standards/rules | `K1N_RULE_v1.0_YYYYMMDD.md` | `rules/` |
| Executable script | `K1N_SCRIPT_v1.0_YYYYMMDD.sh` | `scripts/` |
| Configuration | `K1N_CONFIG_v1.0_YYYYMMDD.yaml` | `guides/` or `scripts/` |
| Reusable template | `K1N_TEMPLATE_v1.0_YYYYMMDD.md` | `templates/` |
| Analysis/findings | `K1N_REPORT_v1.0_YYYYMMDD.md` | `guides/` |
| Checklist/audit | `K1N_CHECKLIST_v1.0_YYYYMMDD.md` | `guides/` |
| Work-in-progress | `K1N_DOC_v1.0_DRAFT_YYYYMMDD.md` | `temp/` |
| Deprecated file | `K1N_DOC_v0.9_YYYYMMDD.md` | `archive/` |

---

## 7. Summary: What Agents MUST Do

```
✅ REQUIRED
1. Use format: [ProjectCode]_[Type]_v[Version]_[YYYYMMDD].[ext]
2. Place files in correct subdirectory
3. Create new version instead of overwriting
4. Archive deprecated files
5. Use _DRAFT suffix for work-in-progress
6. Update INDEX when adding files
7. Update CHANGELOG when making changes

❌ FORBIDDEN
1. Create non-compliant filenames
2. Place files in wrong directory
3. Overwrite existing files
4. Delete files without archiving
5. Commit draft files from temp/
6. Use non-semantic versions
7. Use wrong date format
```

---

**Last Updated**: 2025-11-08
**Next Review**: 2025-11-15
**Enforced By**: Pre-commit hooks, GitHub Actions, manual review

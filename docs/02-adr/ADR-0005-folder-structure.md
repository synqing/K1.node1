---
title: ADR-0005 - K1.node1 Repository Structure
status: active
date: 2025-11-05
author: Architecture Team
intent: Define clean, flat repository structure to prevent bloat
references:
  - ADR-0001-project-scope-abandonment.md
  - docs/04-planning/K1_MIGRATION_MASTER_PLAN.md
---

# ADR-0005: K1.node1 Repository Structure

## Status
**Active** - Structure enforced via CI/CD

## Context

K1.reinvented's 32GB size resulted from:
- Nested folder hierarchies 10+ levels deep
- Build artifacts committed to repository
- Datasets stored in git
- No clear separation of concerns
- Tool configurations scattered everywhere

K1.node1 must maintain a clean, flat structure that prevents bloat.

## Decision

**Enforce a strict, flat folder structure with clear boundaries.**

### Root Structure (ONLY these folders allowed)
```
K1.node1/
├── firmware/          # ESP32-S3 firmware code only
│   ├── src/          # C++ source files
│   ├── include/      # Headers
│   ├── lib/          # Local libraries
│   └── test/         # Unit tests
├── webapp/           # React control dashboard
│   ├── src/          # React components
│   ├── public/       # Static assets
│   └── test/         # Frontend tests
├── webapp-backend/   # FastAPI backend (if needed)
│   ├── src/          # Python source
│   └── test/         # API tests
├── codegen/          # Node compilation pipeline
│   ├── nodes/        # Node definitions
│   ├── compiler/     # TypeScript→C++ compiler
│   └── templates/    # Code generation templates
├── docs/             # Minimal documentation
│   ├── adr/          # Architecture Decision Records
│   ├── architecture/ # System design docs
│   └── api/          # API documentation
├── tools/            # Build and deploy scripts
├── .claude/          # Claude agent configuration
├── .cursor/          # Cursor IDE rules
├── .kiro/           # Kiro deployment specs
├── .mem0_local/     # Local knowledge base
├── .vscode/         # VS Code debugging config
└── .github/         # CI/CD workflows
```

### Explicitly Forbidden
```
FORBIDDEN (auto-reject in CI/CD):
├── datasets/         # ❌ No datasets in git
├── predictions/      # ❌ No ML outputs
├── .venv*/          # ❌ No Python environments
├── node_modules/    # ❌ No npm packages (use .gitignore)
├── build/           # ❌ No build outputs
├── dist/            # ❌ No distribution files
├── *.ipynb          # ❌ No Jupyter notebooks
├── Implementation.plans/ # ❌ No nested planning folders
└── archive/         # ❌ No archive folders (use branches)
```

### File Rules

1. **No file >1MB** (except firmware.bin in releases)
2. **No binary files** in main branch (use Git LFS or external storage)
3. **No generated code** committed (generate at build time)
4. **No credentials** ever (use environment variables)
5. **No test data** >100KB (use fixtures or generate)

### Folder Depth Limits
- **Maximum depth:** 4 levels from root
- **Maximum files per folder:** 50
- **Maximum total files:** 1000 (excluding node_modules)

## Implementation

### .gitignore (Enforced)
```gitignore
# Build artifacts
build/
dist/
*.bin
*.elf
*.map

# Dependencies
node_modules/
.venv*/
*.egg-info/

# Datasets
*.csv
*.h5
*.pkl
*.npy
datasets/

# IDE
.idea/
*.swp
.DS_Store

# Credentials
.env*
*.key
*.pem

# Generated
codegen/output/
*.generated.*
```

### Pre-commit Check
```python
#!/usr/bin/env python3
# .git/hooks/pre-commit

import os
import sys

FORBIDDEN_PATHS = [
    'datasets/', 'predictions/', '.venv',
    'node_modules/', 'build/', 'dist/',
    '.ipynb', 'Implementation.plans/'
]

MAX_FILE_SIZE = 1024 * 1024  # 1MB
MAX_DEPTH = 4

for root, dirs, files in os.walk('.'):
    depth = root.count(os.sep)

    # Check depth
    if depth > MAX_DEPTH:
        print(f"ERROR: Folder too deep: {root}")
        sys.exit(1)

    # Check forbidden paths
    for forbidden in FORBIDDEN_PATHS:
        if forbidden in root or any(forbidden in f for f in files):
            print(f"ERROR: Forbidden path: {forbidden}")
            sys.exit(1)

    # Check file sizes
    for file in files:
        path = os.path.join(root, file)
        if os.path.getsize(path) > MAX_FILE_SIZE:
            print(f"ERROR: File too large: {path}")
            sys.exit(1)
```

### GitHub Action Enforcement
```yaml
name: Structure Enforcement

on: [push, pull_request]

jobs:
  structure-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Check forbidden paths
        run: |
          for pattern in "datasets/" ".venv" "node_modules/" "*.ipynb"; do
            if find . -path "*/$pattern" -prune -o -name "$pattern" -print | grep -q .; then
              echo "ERROR: Forbidden path found: $pattern"
              exit 1
            fi
          done

      - name: Check file sizes
        run: |
          find . -type f -size +1M | grep -v ".git" | while read file; do
            echo "ERROR: File too large: $file (>1MB)"
            exit 1
          done

      - name: Check folder depth
        run: |
          find . -mindepth 5 -type d | while read dir; do
            echo "ERROR: Folder too deep: $dir"
            exit 1
          done

      - name: Check total size
        run: |
          size=$(du -sb . | cut -f1)
          if [ $size -gt 3221225472 ]; then  # 3GB
            echo "ERROR: Repository too large: $(($size / 1048576))MB > 3072MB"
            exit 1
          fi
```

## Migration Checklist

From K1.reinvented to K1.node1:

1. **Copy ONLY these folders:**
   - ✅ firmware/src, firmware/include
   - ✅ webapp/src, webapp/public
   - ✅ Essential docs (ADRs, architecture)
   - ✅ Tool configs (.claude, .cursor, etc.)

2. **Explicitly SKIP:**
   - ❌ All datasets/
   - ❌ All predictions/
   - ❌ All .venv*/
   - ❌ All node_modules/
   - ❌ All Jupyter notebooks
   - ❌ All build outputs

3. **Clean git history:**
   - Use `--squash` when migrating
   - Start fresh history in K1.node1
   - Archive K1.reinvented branch

## Consequences

### Positive
- **<3GB repository** maintained permanently
- **Fast clones** - Under 30 seconds
- **Clear structure** - Anyone can navigate
- **No bloat** - Automated rejection
- **Clean diffs** - No binary/generated files

### Negative
- **Stricter workflow** - Must follow rules
- **External storage** - Datasets need S3/CDN
- **Build step** - Must generate code
- **Lost convenience** - Can't commit everything

## Validation Criteria

- ✅ Repository <3GB total
- ✅ Clone time <30 seconds
- ✅ No folders >4 levels deep
- ✅ No files >1MB (except releases)
- ✅ CI/CD enforces all rules
- ✅ Zero forbidden paths

## Review Schedule

- **Every commit:** Pre-commit hooks
- **Every PR:** GitHub Actions
- **Weekly:** Size audit
- **Monthly:** Structure review

## Approval

- **Architecture:** ✅ Approved
- **Engineering:** ✅ Approved
- **DevOps:** ⏳ Pending
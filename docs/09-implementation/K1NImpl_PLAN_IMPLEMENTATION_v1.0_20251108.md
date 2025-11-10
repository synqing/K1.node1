---
author: Architecture Review Team
date: 2025-11-05
status: active
intent: Step-by-step plan to complete K1.node1 architecture setup and governance
references:
  - docs/02-adr/K1NADR_0001_PROJECT_SCOPE_ABANDONMENT_v1.0_20251110.md
  - docs/02-adr/K1NADR_0004_DOCUMENTATION_GOVERNANCE_v1.0_20251110.md
  - docs/08-governance/K1NGov_GOVERNANCE_v1.0_20251108.md
---

# K1.node1 Architecture Implementation Plan

## Executive Summary

Transform K1.node1 into a clean, governed repository with proper architecture decisions and minimal documentation. This plan executes the migration from bloated K1.reinvented (32GB) to lean K1.node1 (<3GB).

**Timeline:** 3 days (24 hours of work)
**Team:** 1-2 engineers
**Outcome:** Production-ready repository with governance

---

## Phase 1: Import Critical Documents (2 hours)

### Documents to Import from K1.reinvented

#### High Priority (Import Immediately)
```bash
# From K1.reinvented root
cp Implementation.plans/roadmaps/K1NPlan_STRATEGY_PHASE_2D1_GRAPH_PARALLEL_MASTER_v1.0_20251108.md \
   /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/

cp docs/09-reports/AUDIT_SUMMARY_FOR_LEADERSHIP.md \
   /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/09-reports/

cp docs/01-architecture/K1NArch_ASSESSMENT_STATEFUL_NODE_FEASIBILITY_v1.0_20251108.md \
   /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/01-architecture/

cp docs/01-architecture/K1NArch_SUMMARY_STATEFUL_NODE_EXECUTIVE_v1.0_20251108.md \
   /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/01-architecture/

cp docs/05-analysis/K1NAnalysis_ANALYSIS_PATTERN_CODEBASE_ARCHITECTURE_v1.0_20251108.md \
   /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/05-analysis/

cp docs/04-planning/K1NPlan_PLAN_K1_MIGRATION_MASTER_v1.0_20251108.md \
   /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/

cp docs/04-planning/MIGRATION_EXECUTION_CHECKLIST.md \
   /Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/04-planning/
```

#### Medium Priority (Import if Needed)
- `docs/09-reports/audio_fixes_executive_summary.md` - Recent audio work
- `docs/09-reports/audio_fixes_security_audit.md` - Security findings
- `docs/05-analysis/fps_comparison_forensic_report.md` - Performance baseline
- `docs/01-architecture/PARALLEL_ARCHITECTURE_INTEGRATION_STRATEGY.md` - Integration plans

#### Do NOT Import (Obsolete)
- ❌ All beat tracking documents
- ❌ All MIR/audio analysis docs
- ❌ All Jupyter notebook outputs
- ❌ Implementation.plans older than 30 days
- ❌ Reports older than 30 days

### Add Metadata to Imported Docs
```bash
# For each imported file, add frontmatter:
for file in docs/**/*.md; do
  if ! grep -q "^---" "$file"; then
    # Prepend metadata
    echo "---
author: imported-from-k1-reinvented
date: $(date +%Y-%m-%d)
status: active
intent: [UPDATE THIS]
references: []
---
" | cat - "$file" > temp && mv temp "$file"
  fi
done
```

---

## Phase 2: Update Tool Configurations (3 hours)

### Update .claude/
```bash
# Update settings
cat > .claude/settings.local.json << 'EOF'
{
  "project": "K1.node1",
  "phase": "2D1-graph-parallel",
  "priorities": [
    "phase-2d1-critical-fixes",
    "node-system-development",
    "pattern-migration"
  ],
  "context": {
    "abandoned": ["beat-tracking", "audio-analysis"],
    "active": ["firmware", "webapp", "node-system"],
    "strategy": "parallel-execution"
  }
}
EOF

# Create new agent configs
cat > .claude/agents/phase-2d1-engineer.md << 'EOF'
Role: Phase 2D1 Critical Fixes Engineer
Focus: WiFi security, I2S timeout, memory bounds, error infrastructure
Timeline: Week 1-2
References: ADR-0009-phase-2d1-critical-fixes.md
EOF

cat > .claude/agents/node-system-architect.md << 'EOF'
Role: Node System Architect
Focus: 35-40 stateful nodes, compilation pipeline, pattern migration
Timeline: Week 1-14
References: ADR-0007-stateful-node-architecture.md
EOF
```

### Update .cursor/rules/
```bash
cat > .cursor/rules/k1-node1.mdc << 'EOF'
# K1.node1 Development Rules

## Project Context
- K1.node1 is the CLEAN repository (<3GB)
- Beat tracking is PERMANENTLY ABANDONED
- Focus: Firmware + Webapp + Node System ONLY
- Phase 2D1 fixes run PARALLEL to node development

## Coding Standards
- No hardcoded credentials EVER
- All errors must use ErrorManager
- Memory allocations must be bounded
- Timeouts required for all I/O operations

## Node System Rules
- 35-40 node types maximum
- Pre-allocated memory pools only
- Thread-safe audio snapshot passing
- <2% performance overhead target

## Documentation Rules
- EVERY .md file needs metadata
- Maximum 200 active documents
- Auto-archive after 6 months
- No files >100KB

## Forbidden
- ❌ Beat tracking code
- ❌ Python MIR analysis
- ❌ Jupyter notebooks
- ❌ Datasets in git
- ❌ Build artifacts in git
EOF
```

### Update .kiro/
```bash
# Update deployment spec
cat > .kiro/K1_NODE1_DEPLOYMENT_SPEC.md << 'EOF'
---
author: kiro-deployment
date: 2025-11-05
status: active
intent: K1.node1 deployment specification with node system
references:
  - docs/02-adr/K1NADR_0002_NODE_SYSTEM_CORE_USP_v1.0_20251110.md
---

# K1.node1 Deployment Specification

## Core Components
1. **Firmware** - ESP32-S3 LED controller
2. **Webapp** - React control dashboard
3. **Node System** - Visual pattern creator (NEW USP)

## Deployment Targets
- **Week 2:** Phase 2D1 fixes to production
- **Week 14:** Node system beta launch
- **Month 4:** Public release with marketplace

## Infrastructure
- **Device:** ESP32-S3 with 8MB flash
- **Backend:** FastAPI on AWS Lambda
- **Frontend:** React on CloudFront
- **Storage:** S3 for patterns
- **Database:** DynamoDB for user data
EOF
```

---

## Phase 3: Setup Governance Automation (2 hours)

### Install Pre-commit Hooks
```bash
cd /Users/spectrasynq/Workspace_Management/Software/K1.node1

# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Documentation governance pre-commit hook

echo "🔍 Running documentation governance checks..."

# Check for metadata
for file in $(git diff --staged --name-only | grep "\.md$"); do
  if ! head -10 "$file" | grep -q "^status:"; then
    echo "❌ ERROR: $file missing required metadata"
    exit 1
  fi
done

# Check file sizes
for file in $(git diff --staged --name-only); do
  if [ -f "$file" ]; then
    size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file")
    if [ $size -gt 1048576 ]; then  # 1MB
      echo "❌ ERROR: $file too large ($((size/1024))KB)"
      exit 1
    fi
  fi
done

echo "✅ Governance checks passed"
EOF

chmod +x .git/hooks/pre-commit
```

### Create Doc Audit Script
```bash
# Copy from K1NGov_GOVERNANCE_v1.0_20251108.md
cp /dev/stdin tools/doc-audit.py << 'EOF'
[... doc-audit.py content from K1NGov_GOVERNANCE_v1.0_20251108.md ...]
EOF

chmod +x tools/doc-audit.py
```

### Setup GitHub Actions
```bash
mkdir -p .github/workflows
cp /dev/stdin .github/workflows/doc-governance.yml << 'EOF'
[... GitHub Action from K1NGov_GOVERNANCE_v1.0_20251108.md ...]
EOF
```

---

## Phase 4: Clean and Validate (2 hours)

### Remove Stale Configs
```bash
# Remove old Phase A references
find . -name "*PHASE_A*" -type f | grep -v adr | xargs rm -f

# Remove beat tracking references
grep -r "beat.track\|giantsteps\|mir_eval" --include="*.md" . | cut -d: -f1 | sort -u

# Clean up old implementation plans
find Implementation.plans -name "*.md" -mtime +30 -type f -delete
```

### Run First Audit
```bash
# Initial documentation audit
python tools/doc-audit.py --dry-run

# Check repository size
du -sh .
du -sh docs/
du -sh firmware/
du -sh webapp/

# Verify no forbidden paths
for pattern in "datasets" ".venv" "*.ipynb" "node_modules"; do
  find . -name "$pattern" -type d 2>/dev/null | head -5
done
```

### Validation Checklist
- [ ] Repository <3GB total
- [ ] All ADRs have metadata
- [ ] No beat tracking code remains
- [ ] Phase 2D1 fixes documented
- [ ] Node system architecture defined
- [ ] Governance automation working
- [ ] Pre-commit hooks installed
- [ ] <200 active documents

---

## Phase 5: Communication (1 hour)

### Update README
```markdown
# K1.node1 - Clean Architecture Implementation

**Status:** Active Development
**Size:** <3GB (was 32GB)
**Focus:** Firmware + Webapp + Node System

## What Changed
- ✅ Beat tracking PERMANENTLY ABANDONED
- ✅ Clean repository structure enforced
- ✅ Documentation governance active
- ✅ Node system as core USP
- ✅ Phase 2D1 fixes in progress

## Quick Start
See docs/02-adr/ for all architecture decisions.
```

### Team Announcement
```markdown
Subject: K1.node1 Architecture Complete

Team,

K1.node1 is now our primary repository with:
- 10 new Architecture Decision Records
- Documentation governance (200 file limit)
- Clean structure (<3GB vs 32GB)
- Focus on node system as USP

Key decisions:
1. Beat tracking permanently abandoned (ADR-0001)
2. Node system is our core differentiator (ADR-0002)
3. Phase 2D1 and nodes run in parallel (ADR-0003)
4. Strict documentation governance (ADR-0004)

Action items:
- Use K1.node1 for all new work
- K1.reinvented is reference-only
- Run doc-audit weekly
- Keep docs under 200 files

Questions: @architecture-team
```

---

## Success Metrics

### Immediate (Day 1)
- ✅ 10 ADRs created and active
- ✅ Critical docs imported with metadata
- ✅ Governance automation installed
- ✅ Repository <3GB

### Week 1
- ✅ Phase 2D1 fixes started
- ✅ Node system PoC begun
- ✅ First audit run
- ✅ Team using K1.node1

### Month 1
- ✅ <150 active documents
- ✅ Zero governance violations
- ✅ Node system working
- ✅ Phase 2D1 complete

### Quarter 1
- ✅ All patterns migrated to nodes
- ✅ Documentation stable at <200 files
- ✅ Automated cleanup working
- ✅ K1.reinvented archived

---

## Timeline Summary

| Phase | Duration | Outcome |
|-------|----------|---------|
| **Import Docs** | 2 hours | Critical docs in K1.node1 |
| **Update Configs** | 3 hours | Tools aligned to new strategy |
| **Setup Governance** | 2 hours | Automation preventing bloat |
| **Clean & Validate** | 2 hours | Repository validated clean |
| **Communication** | 1 hour | Team informed and aligned |
| **Total** | **10 hours** | **K1.node1 production ready** |

---

## Next Steps

1. **Immediate:** Execute Phase 1-2 today
2. **Tomorrow:** Complete Phase 3-4
3. **This Week:** Start Phase 2D1 fixes
4. **Week 2:** Node system PoC gate
5. **Month 1:** Full parallel execution

## Approval

- [ ] Architecture Team
- [ ] Engineering Lead
- [ ] Product Owner
- [ ] CEO

---

*Last Updated: 2025-11-05*

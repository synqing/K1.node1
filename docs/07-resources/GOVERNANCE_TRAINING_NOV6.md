---
author: DevOps Team
date: 2025-11-05
status: published
intent: One-page training guide for K1.node1 governance framework rollout Nov 6, 2025
---

# K1.node1 Governance Training - Nov 6 Standup (15 minutes)

## What Is Governance?

Governance is a **lightweight system** that keeps our project organized during Week 1 critical path work (Nov 6-13).

**The Problem:** K1.reinvented has 827 markdown files with no structure. We're preventing that.

**The Solution:** Daily health checks + peer review + team discipline. NO git-level blocking (fast execution).

---

## Governance Model: Peer Review + Manual Discipline

### Three Core Components

**1. Daily Health Check (5 minutes)**
```bash
./tools/governance/governance_health.sh
```
Run during standup. Shows:
- Root-level file count (target: ≤5)
- Orphaned documentation
- Task tracking status
- Metadata compliance
- Pre-commit/post-commit hook status

**2. Manual Updates (Daily)**
- Update `CHANGELOG.md` with work completed
- Update `TASKS.md` standup section
- Move misplaced files (if health check finds issues)
- Add metadata to new docs (optional utility available)

**3. Team Discipline (Peer Review)**
- Keep root-level clean (max 5 files)
- Place docs in correct folders (see guidance below)
- Add metadata to new docs (YAML front matter template provided)

---

## File Organization (Reference - Not Blocking)

| Document Type | Folder | Example |
|---|---|---|
| Architecture/design | `docs/01-architecture/` | `node_system_architecture.md` |
| Technical analysis | `docs/05-analysis/` | `pattern_feasibility.md` |
| Decisions (ADRs) | `docs/02-adr/` | `ADR-0001-title.md` |
| Planning/proposals | `docs/04-planning/` | `phase_2d1_plan.md` |
| Phase reports | `docs/09-reports/` | `phase_validation_report.md` |
| Quick references | `docs/07-resources/` | `quick_ref.md` |
| Runbooks (step-by-step) | `Implementation.plans/runbooks/` | `fix_1_wifi_setup.md` |
| Active roadmaps | `Implementation.plans/roadmaps/` | `execution_plan.md` |
| Backlogs | `Implementation.plans/backlog/` | `tech_debt.md` |

**Why this folder structure?** Makes docs discoverable. Health check flags misplaced files.

---

## File Placement Guidelines

**Root-Level Files (Keep Clean - Max 5):**
- `README.md` ✅
- `CLAUDE.md` ✅
- `TASKS.md` ✅ (Single source of truth)
- `CHANGELOG.md` ✅
- `.gitignore` ✅

If you create a new root-level file, it will show up in daily health check → team discusses during standup.

**What to do if you need a new file:**
1. Is it configuration? → Check if it belongs elsewhere
2. Is it documentation? → Put in appropriate `docs/` folder
3. Is it code? → Put in `firmware/` or `k1-control-app/`
4. Uncertain? → Ask in standup before committing

---

## Metadata (YAML Front Matter) - Optional

New documentation files benefit from metadata:

```markdown
---
author: [Your Name]
date: 2025-11-06
status: draft | in_review | published | superseded
intent: One-line purpose of this document
---

# Document Title

[Content...]
```

**Tool to help add metadata:**
```bash
./tools/governance/add_frontmatter.sh --check-missing  # Find files missing metadata
./tools/governance/add_frontmatter.sh --add-all        # Batch-add to missing files
./tools/governance/add_frontmatter.sh --add-file <file> # Add to specific file
```

---

## Daily 5-Minute Checklist

**Each standup (Nov 6-13), do this:**

```bash
# Step 1: Run health check (30 seconds)
./tools/governance/governance_health.sh

# Step 2: Review findings (1 minute)
# - How many root files? (target: ≤5)
# - Any orphaned docs? (move them)
# - Metadata compliance? (run add_frontmatter.sh if <75%)

# Step 3: Update daily tracking (2 minutes)
# Edit CHANGELOG.md: add work completed today
# Edit TASKS.md: update standup section, mark tasks done/in-progress

# Step 4: Team discussion (1-2 minutes)
# - Any blockers?
# - Any file placement issues?
# - Help needed?
```

---

## What Changed From Initial Plan?

**We removed pre-commit hook blocking** because:
- ❌ Git hooks slow down commits during fast execution
- ✅ Post-commit advisory feedback is enough
- ✅ Daily health check + team discipline maintains organization
- ✅ <5 min/day overhead vs 2-3 min/commit overhead

**New approach:**
- Post-commit hook gives advisory feedback (doesn't block)
- Health check runs daily during standup
- Team acts on findings based on peer review
- Fast execution + organized project

---

## Key Points (TL;DR)

1. **No git blocking** - commits are fast
2. **Daily health check** - awareness + visibility
3. **Team discipline** - keep root clean, place docs correctly
4. **Manual tracking** - update CHANGELOG.md + TASKS.md daily
5. **5 minutes/day** - total governance overhead

---

## If Problems Arise

| Issue | What to Do |
|---|---|
| "Where should this file go?" | Check table above or ask in standup |
| "Health check shows issues?" | Review findings, move files/add metadata as needed |
| "Root-level file limit exceeded?" | Discuss in standup, move file to appropriate folder |
| "Metadata compliance low?" | Run `./tools/governance/add_frontmatter.sh --add-all` during standup |
| "Governance is too strict?" | Document feedback, we'll adjust after Nov 13 decision gate |

**Escalation:** @spectrasynq for questions.

---

## Success Metrics (Week 1)

- ✅ Root-level files stay ≤5 (daily peer review)
- ✅ 80%+ docs placed in correct folders
- ✅ Health checks passing daily
- ✅ Team reports <5 min/day overhead
- ✅ CHANGELOG.md + TASKS.md updated daily

---

## After Nov 13

We'll ask:
- Was governance helpful or annoying?
- Which rules worked? Which didn't?
- Should we tighten or loosen enforcement for Phase 2?

Your feedback shapes governance for the next 8-10 weeks.

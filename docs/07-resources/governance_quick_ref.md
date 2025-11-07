# K1.node1 Governance Quick Reference

**Print this. Keep it at your desk. Reference daily.**

---

## File Placement Cheat Sheet

### ✅ ALLOWED in Root (5 files max)
- `README.md` - Project overview
- `CLAUDE.md` - Agent operations manual
- `TASKS.md` - Active work tracking
- `CHANGELOG.md` - Version history
- `.gitignore` - Git configuration

### ❌ NOT ALLOWED in Root
- Any other `.md` files (move to `docs/`)
- Any other `.json` files (move to `tools/` or config)
- Any other `.ini` files (move to `firmware/` or root-level allowed list)

**Rule:** If you create a root-level file, the pre-commit hook WILL block it.

---

## Where Documentation Goes

| Content Type | Folder | Example |
|--------------|--------|---------|
| Architecture decisions | `docs/02-adr/` | `ADR-0009-phase-2d1-critical-fixes.md` |
| System design | `docs/01-architecture/` | `stateful_node_architecture.md` |
| Technical analysis | `docs/05-analysis/` | `pattern_codebase_architecture.md` |
| Planning & roadmaps | `docs/04-planning/` | `PHASE_2D1_GRAPH_PARALLEL_MASTER_STRATEGY.md` |
| Phase reports | `docs/09-reports/` | `phase_2d1_validation_report.md` |
| Quick refs & templates | `docs/07-resources/` | `governance_quick_ref.md` |
| Step-by-step guides | `Implementation.plans/runbooks/` | `phase2d1_fixes_runbook.md` |
| Active execution plans | `Implementation.plans/roadmaps/` | `week_1_execution_roadmap.md` |

**Default:** When in doubt, ask yourself: "Is this documenting a decision (→ docs/) or a process (→ Implementation.plans/)?"

---

## Daily Task Workflow

```bash
# Morning (9:00 AM)
1. Open TASKS.md
2. Check your assigned tasks (status: PENDING)
3. Move to IN-PROGRESS
4. Run health check:
   ./tools/governance/governance_health.sh

# During Work
5. Update task progress in TASKS.md
6. Commit changes (git hook validates file placement)

# Evening (5:00 PM)
7. Update task status (PENDING → IN-PROGRESS or DONE)
8. Add standup note to TASKS.md "## DAILY STANDUP NOTES"
9. Run EOD summary:
   ./tools/taskmaster/eod_summary.sh

# Weekly (Friday)
10. Review governance health score
11. Identify any blockers for next week
12. Update CHANGELOG.md with progress
```

---

## Git Hook Enforcement

### BLOCKING (Commit will fail)
- Creating root-level `.md`, `.json`, or `.ini` files NOT on allowed list
- **Fix:** Move file to appropriate folder (`docs/` or `Implementation.plans/`)

### WARNING (Commit succeeds, but you'll see warning)
- Missing YAML front matter on documentation
- Placing docs in unusual folder categories
- **Fix:** Add metadata (optional during Week 1, required after Nov 13)

### EMERGENCY OVERRIDE
```bash
git commit --no-verify
```
Use sparingly. Explain in commit message if you use this.

---

## Documentation Metadata (YAML Front Matter)

Add this to the top of every documentation file:

```yaml
---
status: draft|in_review|published|superseded|archived
author: YourName or "claude"
created: YYYY-MM-DD
updated: YYYY-MM-DD
intent: One-line description of this document (max 100 chars)
audience: agents|engineers|both|public
phase: phase_2d1 (if applicable)
---
```

**Required fields:** status, author, created, updated, intent, audience

---

## Key Commands

```bash
# Check file placement before committing
./tools/governance/governance_health.sh

# View task status
cat TASKS.md

# Update task status (manual)
# Edit TASKS.md, change "- **Status:** PENDING" to "IN-PROGRESS" or "DONE"

# Add YAML front matter to docs
./tools/governance/add_frontmatter.sh docs/04-planning/myfile.md

# View governance status
./tools/governance/governance_health.sh
```

---

## What's Tracked

- **Root-level files:** Max 5 (CLAUDE.md, README.md, TASKS.md, CHANGELOG.md, .gitignore)
- **Task status:** PENDING → IN-PROGRESS → DONE
- **Documentation metadata:** YAML front matter on all new docs
- **Orphaned docs:** Docs not linked from TASKS.md or README.md
- **Compliance:** Daily health check scores (target: >80%)

---

## Success Criteria (Week 1)

- ✅ All tasks in TASKS.md tracked daily
- ✅ Root folder stays ≤ 5 files
- ✅ All new docs in proper folders
- ✅ CHANGELOG.md updated with daily progress
- ✅ Zero blockers surprise leadership on Nov 13

---

## Emergency Contacts

- **Governance Questions:** Check this sheet or docs/07-resources/
- **Git Hook Problems:** `git commit --no-verify` + escalate
- **Task Questions:** Review ADR-0003 (Parallel Execution Model)
- **Decision Questions:** Review ADR-0009 (Phase 2D1 Critical Fixes)

---

## Nov 13 Decision Gate

On Nov 13, your work becomes input to the decision:
- **All 14 tasks DONE?** → YES = Ready for decision gate
- **CHANGELOG.md updated daily?** → YES = Clean release notes
- **Nov 13 decision package prepared?** → YES = Confidence in GO/NO-GO choice

---

**Status:** Active (Nov 6-13 Week 1 execution)
**Last Updated:** Nov 5, 2025
**Maintainer:** @spectrasynq


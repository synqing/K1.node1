---
status: published
author: Architect-Review Team
date: 2025-11-05
intent: Comprehensive documentation governance system to prevent bloat
---

# K1.node1 Documentation Governance System

**Status:** Published & Enforced
**Effective Date:** November 5, 2025
**Purpose:** Prevent documentation bloat (goal: <200 active docs vs 827 in K1.reinvented)

---

## 1. Required Metadata (MANDATORY on EVERY MD file)

Every markdown file MUST begin with this YAML front matter:

```yaml
---
status: [draft|active|superseded|archived|deleted]
author: Name or team who created it
date: YYYY-MM-DD (creation date)
intent: One-line description of purpose
references: [ADR-####, other docs] (optional)
---
```

### Valid Status Values

| Status | Meaning | Auto-Deadline | Action |
|--------|---------|---------------|--------|
| **draft** | Under development | None | Work in progress, no review |
| **active** | Published, maintained | 6 months | Update status or archive |
| **superseded** | Replaced by newer doc | 1 month | Archive then delete |
| **archived** | Historical reference | 3 months | Delete |
| **deleted** | Permanently removed | N/A | Gone forever |

### Example Front Matter

```yaml
---
status: active
author: Spectrasynq + Firmware Team
date: 2025-11-05
intent: Phase 2D1 critical fixes roadmap and execution plan
references: [ADR-0003, ADR-0009]
---
```

---

## 2. Document Lifecycle State Machine

```
CREATION
    ↓
draft (no deadline)
    ↓
[developer decides: publish or abandon]
    ├→ ABANDON: delete immediately
    │
    └→ PUBLISH: status = active
        ↓
    active (6-month auto-review)
        ↓
    [decision: still needed?]
        ├→ YES: Update `date:` field, keep active
        │
        └→ NO: Find replacement, status = superseded
            ↓
        superseded (must link to replacement)
            ↓
        [1 month passes]
            ↓
        Move to archive/ subfolder
        status = archived
            ↓
        [3 months in archive]
            ↓
        DELETE PERMANENTLY
```

---

## 3. Enforcement Rules

### Pre-Commit Hook Validation

Every commit to `docs/` must pass:

```bash
✓ All .md files have required front matter
✓ status field is valid (draft|active|superseded|archived|deleted)
✓ author field is non-empty
✓ date field is valid YYYY-MM-DD format
✓ intent field is non-empty
✓ Superseded docs link to replacement
✓ Cross-references to other docs exist
✗ REJECT if any validation fails
```

### GitHub Actions Weekly Audit

Every Friday:
1. **Find stale docs:** status=active AND date >6 months old
2. **Warn via PR comment:** "@author, please review this doc"
3. **Force action:** If ignored 2 weeks, auto-deprecate
4. **Count documents:** Warn if >200 active docs

### Tooling

- Governance Tools (quick reference): `docs/06-reference/governance-tools.md`
- Add front matter to docs: `./tools/governance/add_frontmatter.sh --check-missing` then `--add-all`
- Governance health report: `./tools/governance/governance_health.sh`

### Limits & Quotas

| Metric | Limit | Action |
|--------|-------|--------|
| **Active docs** | 200 max | Warn at 150, block at 200 |
| **File size** | 100KB max | Warn at 80KB, reject at 100KB |
| **Archive age** | 3 months | Auto-delete |
| **Superseded age** | 1 month | Auto-move to archive |

---

## 4. Document Categories & Tiers

### Tier 1: Master Documents (IMMUTABLE)
**Essential knowledge that never changes.**

 - Architecture Decision Records (ADRs): `docs/02-adr/`
 - Core system design: `docs/01-architecture/`
- Project scope: This governance document

**Lifecycle:**
- Created once, updated rarely
- Status: active indefinitely
- Review: Annual minimum

### Tier 2: Active Work Documents
**Current execution plans and immediate context.**

 - Phase roadmaps: `docs/04-planning/`
 - Current investigation: `docs/05-analysis/`
 - Implementation guides: `docs/03-guides/`

**Lifecycle:**
- Status: active (active project phase)
- Auto-review: 6 months
- Archive when phase completes

### Tier 3: Reference Documents
**Quick lookups, glossaries, templates.**

 - Quick references: `docs/06-reference/`
- Templates: `docs/templates/`
- Glossaries: `docs/07-resources/glossary.md`

**Lifecycle:**
- Status: active indefinitely
- No auto-review (reference material)
- Update when terminology changes

### Tier 4: Archive Documents
**Historical context, old phases, superseded decisions.**

- Old phase reports: `docs/archive/phase-a/`
- Superseded analyses: `docs/archive/analyses/`
- Legacy docs: `docs/archive/legacy/`

**Lifecycle:**
- Status: archived
- No access to main navigation
- Auto-delete after 3 months

---

## 5. Directory Structure with Governance

```
docs/
├── README.md                     (Docs landing)
├── 00-INDEX.md                   (Canonical index)
│
├── 01-architecture/              (Tier 1: MASTER)
│   ├── STATEFUL_NODE_EXECUTIVE_SUMMARY.md
│   ├── STATEFUL_NODE_FEASIBILITY_ASSESSMENT.md
│   └── README.md
│
├── 02-adr/                       (Tier 1: MASTER)
│   ├── ADR-0001-*.md
│   ├── ADR-0002-*.md
│   └── README.md
│
├── 03-guides/                    (Tier 2: ACTIVE)
│   ├── builderio.guide/
│   ├── builderio.starterkit/
│   └── README.md
│
├── 04-planning/                  (Tier 2: ACTIVE)
│   ├── K1_MIGRATION_MASTER_PLAN.md
│   ├── PHASE_2D1_GRAPH_PARALLEL_MASTER_STRATEGY.md
│   └── README.md
│
├── 05-analysis/                  (Tier 2: ACTIVE)
│   ├── PATTERN_ANALYSIS_EXECUTIVE_SUMMARY.md
│   ├── pattern_codebase_architecture.md
│   └── README.md
│
├── 06-reference/                 (Tier 3: PERMANENT)
│   └── README.md
│
├── 07-resources/                 (Tier 3: PERMANENT)
│   ├── GOVERNANCE_TRAINING_NOV6.md
│   ├── BUILDER_EXTENSION.md
│   └── README.md
│
├── 08-governance/                (Governance docs)
│   ├── GOVERNANCE.md
│   └── README.md
│
└── 09-implementation/            (Implementation plans)
    ├── IMPLEMENTATION_PLAN.md
    └── README.md
```

---

## 6. Creating & Updating Documents

### When to Create a Doc

- ✅ Decision needs documentation (create ADR)
- ✅ Feature requires onboarding guide (create guide)
- ✅ Complex system needs explanation (create architecture doc)
- ✅ Investigation reveals findings (create analysis doc)

### When NOT to Create a Doc

- ❌ Temporary investigation notes (use separate wiki/notepad)
- ❌ Implementation details in comments (use code comments, not docs)
- ❌ Meeting notes (use your notes, link from issue if needed)
- ❌ Duplicate of existing doc (update existing instead)

### Creating a Document

1. **Decide: Which Tier?**
   - Tier 1 (Master): ADRs, architecture → immutable
   - Tier 2 (Active): Plans, guides → 6-month review
   - Tier 3 (Reference): Glossary, templates → permanent
   - Tier 4 (Archive): Old stuff → will be deleted

2. **Add Front Matter** (required)
   ```yaml
   ---
   status: draft
   author: Your Name
   date: 2025-11-05
   intent: Why this doc exists
   references: [ADR-0001, related docs]
   ---
   ```

3. **Write Content** (clear, minimal)

4. **Submit as PR** (pre-commit hook validates)

5. **Upon approval:** Change status to `active`

### Updating a Document

```yaml
# Just update the date field
date: 2025-11-15  # Moved to current date

# Keep status = active (resets 6-month clock)
status: active
```

---

## 7. Deprecation Workflow

### When to Deprecate a Doc

- It's been replaced by a newer version
- It documents a decision that's now overridden
- It's more than 6 months old and nobody's maintaining it
- The information is no longer accurate

### How to Deprecate

1. **Keep the OLD doc:** Don't delete immediately

2. **Add DEPRECATION HEADER** (at top of file, before YAML):
   ```
   ⚠️ DEPRECATED - See ADR-0002 instead (Nov 15, 2025)
   ```

3. **Update front matter:**
   ```yaml
   status: superseded
   date: 2025-11-15  (deprecation date)
   references: [ADR-0002]  (link to replacement)
   ```

4. **Update cross-references:** Find any docs linking to this one, update links

5. **After 1 month:** Move to `docs/archive/` subfolder

6. **After 3 months in archive:** DELETE PERMANENTLY

---

## 8. Automated Enforcement (GitHub Actions)

### Weekly Audit Workflow

```yaml
name: Documentation Audit
on: [schedule: "0 9 * * FRI"]  # Friday 9 AM UTC

jobs:
  audit:
    - Check all .md files have front matter
    - List docs status=active AND date >6 months old
    - Warn authors: "Please review [document]"
    - Count active docs (warn >150, block >200)
    - Check for broken cross-references
    - Archive docs marked superseded >1 month
    - Delete docs in archive >3 months
```

### Pre-Commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

for file in $(git diff --cached --name-only | grep ".md$"); do
  # Check front matter
  if ! grep -q "^---$" "$file"; then
    echo "ERROR: $file missing YAML front matter"
    exit 1
  fi
  
  # Check required fields
  for field in "status:" "author:" "date:" "intent:"; do
    if ! grep -q "$field" "$file"; then
      echo "ERROR: $file missing $field"
      exit 1
    fi
  done
done

exit 0
```

---

## 9. Document Lifecycle Examples

### Example 1: Investigation → Published

```
Day 1: Create analysis/current/audio-performance-study.md
  status: draft
  author: @spectrasynq
  intent: Measure audio latency under high CPU load
  date: 2025-11-05

Week 1: Findings published, team reviews
  status: active (Week 2)
  date: 2025-11-05

Month 3: Not updated, auto-review reminder sent
  [DECISION: Still relevant, keep it]
  date: 2025-11-20 (updated)
  status: active

Month 9: No updates, 6-month deadline approached
  [DECISION: Superceded by newer study]
  status: superseded
  references: [analysis/current/audio-performance-study-2025-q4.md]

Month 10: Moved to archive/
  archive/analyses/audio-performance-study-2025-q3.md

Month 13: Auto-deleted by GitHub Actions
  (file no longer exists)
```

### Example 2: ADR (Immutable Master)

```
Day 1: Create ADR-0001
  status: draft
  date: 2025-11-05

Week 1: Review complete, publish
  status: active (will never auto-review)
  date: 2025-11-05

[ADRs stay active forever - they document decisions]
[Only update ADR if decision is overridden by new ADR]
```

---

## 10. Success Metrics

### Measure Governance Health

| Metric | Target | Current | Action |
|--------|--------|---------|--------|
| **Active docs** | <200 | TBD | Weekly audit |
| **Stale docs** | 0 | TBD | Auto-warn + archive |
| **Broken refs** | 0 | TBD | Auto-detect + report |
| **Metadata compliance** | 100% | TBD | Pre-commit enforcement |
| **Documentation latency** | <1 week discovery | TBD | INDEX.md navigation |

---

## 11. Questions & Decisions

### How do I find a doc on topic X?

1. Check `docs/INDEX.md` (full list, searchable)
2. Browse by category (`adr/`, `planning/`, etc.)
3. Search GitHub code search: `"intent: X" filename:.md`

### My doc is 200 pages - too big?

Split into smaller pieces linked together. Max 100KB per file.

### Can I keep old docs for reference?

Yes, move to `archive/` and it lives for 3 months. After that, permanently deleted.

### Who approves deprecation?

The original author OR the project lead. If uncertain, ask in PR.

### What if I miss the 6-month review?

GitHub Actions will auto-warn. You have 2 weeks before auto-deprecation. Update the date field to reset the clock.

---

## 12. Enforcement Checklist (for maintainers)

Every Friday:
- [ ] Run GitHub Actions audit
- [ ] Review stale docs (>6 months)
- [ ] Move superseded docs to archive
- [ ] Delete archive docs >3 months old
- [ ] Count active docs (should be <200)
- [ ] Report to team: "X docs reviewed, Y archived, Z deleted"

---

## Effective Immediately

This governance system is LIVE as of November 5, 2025.

- All new docs must comply
- Existing docs: Status = active (6-month review deadline: May 5, 2026)
- Violations: Caught by pre-commit hook, release blocked

---

**Status:** PUBLISHED & ENFORCED
**Last Updated:** November 5, 2025
**Next Review:** November 12, 2025 (week 1 check-in)

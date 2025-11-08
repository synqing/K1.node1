---
title: Architecture Decision Records (ADRs)
status: approved
version: v1.0
owner: [Docs Maintainers]
reviewers: [Engineering Leads]
last_updated: 2025-10-31
next_review_due: 2026-01-31
tags: [docs, adr]
related_docs: [../K1N_INDEX_v1.0_20251108.md, ../../CLAUDE.md, ADR-template.md]
---
# Architecture Decision Records (ADRs)

**⭐ Part of the K1 docs:** See the [Documentation Index](../K1N_INDEX_v1.0_20251108.md) for the canonical navigation hub.

**Purpose:** Document significant architectural decisions, design choices, and trade-offs per [CLAUDE.md](../../CLAUDE.md) requirements.

**Steward:** @spectrasynq
**Review cadence:** Weekly (via doc triage)
**Template:** See [ADR-template.md](ADR-template.md)

---

## How to Use This Directory

**When to create an ADR:**
- Architectural conflict detected during analysis or implementation
- Major design decision with trade-offs
- Security or performance vulnerability requiring design change
- Significant resource constraint (memory, CPU, latency)
- Dependency conflicts between tiers
- Framework or library upgrade decisions

**When NOT to create an ADR:**
- Simple bug fixes (document in runbooks instead)
- Tactical code changes (use PR descriptions)
- Routine maintenance (update CLAUDE.md instead)

---

## Index of Decisions

### Current Decisions

| ID | Title | Status | Date | Area | Relates to |
|----|-------|--------|------|------|-----------|
| 0001 | [Placeholder for first architectural decision] | Draft | TBD | Architecture | - |

**No active ADRs yet.** This section will populate as architectural decisions are made during Tier 2 implementation or when conflicts arise.

### Superseded Decisions

(None yet)

---

## Workflow: ADR Creation

**1. Detection Phase**
- Tier 1 agent (SUPREME) identifies unfixable architectural flaw during analysis → Create ADR
- Tier 2 agent (Embedded) hits impossible constraint → Create ADR
- Tier 3 agent (Code Reviewer) finds architecture conflict → Create ADR

**2. Creation Phase**
- Copy [ADR-template.md](ADR-template.md) to `ADR-####-{slug}.md`
- Fill in all sections except Approvers/Sign-off
- Link to source analysis (SUPREME bottleneck matrix or ULTRA design)
- Ensure backlinks from source analysis back to ADR

**3. Review Phase**
- Request review from @spectrasynq + domain experts
- Incorporate feedback
- Mark status: In Review

**4. Decision Phase**
- Collect sign-offs from all reviewers
- Update status: Accepted
- Commit to main with message: `docs/adr: Add ADR-####-{title}`

**5. Implementation Phase**
- Tier 2/3 agents implement changes referenced in ADR
- Link all commits/PRs to ADR in commit messages
- Update ADR implementation notes with actual completion dates

---

## Linking to ADRs

**From SUPREME analysis (docs/05-analysis/):**
```markdown
## Architectural Issue Found
This analysis identified a design constraint that requires an ADR:
- See ADR-0001: {title} (docs/02-adr/ADR-0001-{slug}.md)
```

**From ULTRA design (docs/04-planning/):**
```markdown
## Design Conflict
This feature conflicts with the current architecture:
- See ADR-0002: {title} (../../docs/02-adr/ADR-0002-{slug}.md)
```

**From implementation (firmware/src/ comments):**
```cpp
// This implementation was constrained by ADR-0001 (docs/02-adr/ADR-0001-{slug}.md)
// Key constraint: [brief explanation]
```

**From test documentation:**
```markdown
### Validation per ADR
This test validates the decision in ADR-0001 (../../docs/02-adr/ADR-0001-{slug}.md):
- Requirement 1: [test name]
- Requirement 2: [test name]
```

---

## File Naming Convention

```
ADR-####-{slug}.md

Where:
  #### = 4-digit zero-padded sequence number (0001, 0002, 0003, ...)
  slug = kebab-case URL-safe title (led-topology-choice, audio-sync-strategy)

Examples:
  ADR-0001-dual-core-architecture.md
  ADR-0002-i2s-configuration-standard.md
  ADR-0003-pattern-generation-safety.md
```

---

## Status Definitions

| Status | Meaning | Action |
|--------|---------|--------|
| Draft | Initial creation, not ready for review | Finish content, request feedback |
| In Review | Under review by stakeholders | Collect sign-offs, iterate |
| Accepted | Approved and ready for implementation | Implement changes, link commits |
| Superseded | Newer ADR makes this one obsolete | Archive, link to successor |

---

## Integration with Multiplier Workflow

**Tier 1 (SUPREME):**
- If unfixable design flaw found → Create ADR in Draft
- Link ADR from bottleneck_matrix.md

**Tier 2 (Embedded/ULTRA):**
- If constraint impossible to meet → Escalate with ADR draft
- Design specs reference ADR numbers
- Implementation commits cite ADR decisions

**Tier 3 (Code Reviewer):**
- Verify all architectural decisions documented in ADRs
- Ensure test coverage validates ADR constraints
- Report sign-off in quality gate report

---

## Example ADR Lifecycle

```
[Tier 1] Discovery finds: "I2S timeout causes device freeze"
         ↓
         Create: ADR-0002-i2s-timeout-recovery.md (status: Draft)
         ↓
[Tier 2] Implement: i2s_channel_read with bounded timeout
         ↓
         Commit message: "firmware: add I2S timeout recovery (implements ADR-0002)"
         ↓
         Update ADR-0002: Set implementation status, actual timings
         ↓
[Tier 3] Validate: Test verifies graceful fallback per ADR-0002 requirements
         ↓
         Approval: Mark ADR-0002 as "Accepted"
         ↓
         Final status: Accepted, implemented, validated
```

---

## Quick Reference

**Creating an ADR:**
1. `cp ADR-template.md ADR-0001-your-decision.md`
2. Fill all sections
3. Link from source analysis
4. Request review via PR

**Reviewing an ADR:**
- [ ] Context section explains the problem clearly
- [ ] All alternatives considered with pros/cons
- [ ] Decision is justified with concrete reasoning
- [ ] Consequences are quantified (not vague)
- [ ] Validation plan is testable
- [ ] No unresolved questions

**Superseding an ADR:**
- Create new ADR referencing the old one
- Old ADR: Set status to "Superseded"
- Add link to new ADR in old ADR's header

---

## Reference

- **CLAUDE.md § Failure Escalation Paths → Architecture Conflict**
- **CLAUDE.md § Agent Playbooks → SUPREME Analyst**
- Full workflow: **docs/07-resources/agent_quick_refs/supreme_analyst_cheatsheet.md**

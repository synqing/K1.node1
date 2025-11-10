---
title: Architecture Decision Records (ADRs)
status: approved
version: v1.0
owner: [Docs Maintainers]
reviewers: [Engineering Leads]
last_updated: 2025-10-31
next_review_due: 2026-01-31
tags: [docs, adr]
related_docs: [../K1N_INDEX_v1.0_20251108.md, ../../CLAUDE.md, K1NADR_TEMPLATE_v1.0_20251110.md]
---
# Architecture Decision Records (ADRs)

**⭐ Part of the K1 docs:** See the [Documentation Index](../K1N_INDEX_v1.0_20251108.md) for the canonical navigation hub.

**Purpose:** Document significant architectural decisions, design choices, and trade-offs per [CLAUDE.md](../../CLAUDE.md) requirements.

**Steward:** @spectrasynq
**Review cadence:** Weekly (via doc triage)
**Template:** See [K1NADR_TEMPLATE_v1.0_20251110.md](K1NADR_TEMPLATE_v1.0_20251110.md)

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
| 0001 | [PROJECT_SCOPE_ABANDONMENT](K1NADR_0001_PROJECT_SCOPE_ABANDONMENT_v1.0_20251110.md) | Draft | TBD | - | - |
| 0002 | [NODE_SYSTEM_CORE_USP](K1NADR_0002_NODE_SYSTEM_CORE_USP_v1.0_20251110.md) | Draft | TBD | - | - |
| 0003 | [PARALLEL_EXECUTION_MODEL](K1NADR_0003_PARALLEL_EXECUTION_MODEL_v1.0_20251110.md) | Draft | TBD | - | - |
| 0004 | [DOCUMENTATION_GOVERNANCE](K1NADR_0004_DOCUMENTATION_GOVERNANCE_v1.0_20251110.md) | Draft | TBD | - | - |
| 0005 | [FOLDER_STRUCTURE](K1NADR_0005_FOLDER_STRUCTURE_v1.0_20251110.md) | Draft | TBD | - | - |
| 0006 | [CODEGEN_ABANDONMENT](K1NADR_0006_CODEGEN_ABANDONMENT_v1.0_20251110.md) | Draft | TBD | - | - |
| 0007 | [STATEFUL_NODE_ARCHITECTURE](K1NADR_0007_STATEFUL_NODE_ARCHITECTURE_v1.0_20251110.md) | Draft | TBD | - | - |
| 0008 | [PATTERN_MIGRATION_STRATEGY](K1NADR_0008_PATTERN_MIGRATION_STRATEGY_v1.0_20251110.md) | Draft | TBD | - | - |
| 0009 | [PHASE_2D1_CRITICAL_FIXES](K1NADR_0009_PHASE_2D1_CRITICAL_FIXES_v1.0_20251110.md) | Draft | TBD | - | - |
| 0010 | [MARKET_STRATEGY_USP](K1NADR_0010_MARKET_STRATEGY_USP_v1.0_20251110.md) | Draft | TBD | - | - |
| 0011 | [DUAL_CHANNEL_LEDS](K1NADR_0011_DUAL_CHANNEL_LEDS_v1.0_20251110.md) | Draft | TBD | - | - |
| 0011 | [INSTITUTIONAL_MEMORY_ADOPTION](K1NADR_0011_INSTITUTIONAL_MEMORY_ADOPTION_v1.0_20251110.md) | Draft | TBD | - | - |
| 0012 | [PHASE_C_NODE_EDITOR_ARCHITECTURE](K1NADR_0012_PHASE_C_NODE_EDITOR_ARCHITECTURE_v1.0_20251110.md) | Draft | TBD | - | - |
| 0013 | [BACKEND_FRAMEWORK_FASTAPI](K1NADR_0013_BACKEND_FRAMEWORK_FASTAPI_v1.0_20251110.md) | Draft | TBD | - | - |
| 0013 | [CONDUCTOR_DEPLOYMENT_RESILIENCE](K1NADR_0013_CONDUCTOR_DEPLOYMENT_RESILIENCE_v1.0_20251110.md) | Draft | TBD | - | - |
| 0014 | [GLOBAL_BRIGHTNESS_CONTROL](K1NADR_0014_GLOBAL_BRIGHTNESS_CONTROL_v1.0_20251110.md) | Draft | TBD | - | - |
| 0015 | [LED_DRIVER_HEADER_SPLIT](K1NADR_0015_LED_DRIVER_HEADER_SPLIT_v1.0_20251110.md) | Draft | TBD | - | - |
| 0016 | [PHASE_A_ACCEPTANCE_CRITERIA](K1NADR_0016_PHASE_A_ACCEPTANCE_CRITERIA_v1.0_20251110.md) | Draft | TBD | - | - |
| 0017 | [LUT_OPTIMIZATION_SYSTEM](K1NADR_0017_LUT_OPTIMIZATION_SYSTEM_v1.0_20251110.md) | Draft | TBD | - | - |
| 0018 | [DUAL_CHANNEL_LEDS](K1NADR_0018_DUAL_CHANNEL_LEDS_v1.0_20251110.md) | Draft | TBD | - | - |
| 0019 | [CONDUCTOR_DEPLOYMENT_RESILIENCE](K1NADR_0019_CONDUCTOR_DEPLOYMENT_RESILIENCE_v1.0_20251110.md) | Draft | TBD | - | - |
| 0020 | [CODE_GENERATION_ARCHITECTURE](K1NADR_0020_CODE_GENERATION_ARCHITECTURE_v1.0_20251110.md) | Draft | TBD | - | - |
| N/A | [RMT_ENCODER_ERROR_HANDLING](K1NADR_RMT_ENCODER_ERROR_HANDLING_v1.0_20251110.md) | Draft | TBD | - | - |

### Superseded Decisions

(None yet)

---

## Workflow: ADR Creation

**1. Detection Phase**
- Tier 1 agent (SUPREME) identifies unfixable architectural flaw during analysis → Create ADR
- Tier 2 agent (Embedded) hits impossible constraint → Create ADR
- Tier 3 agent (Code Reviewer) finds architecture conflict → Create ADR

**2. Creation Phase**
- Copy [K1NADR_TEMPLATE_v1.0_20251110.md](K1NADR_TEMPLATE_v1.0_20251110.md) to `K1NADR_####_{TITLE}_v<version>_<YYYYMMDD>.md`
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
- Commit to main with message: `docs/adr: Add K1NADR_####_{TITLE}`

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
- See K1NADR_0001: {TITLE} (docs/02-adr/K1NADR_0001_{TITLE}_v1.0_<YYYYMMDD>.md)
```

**From ULTRA design (docs/04-planning/):**
```markdown
## Design Conflict
This feature conflicts with the current architecture:
- See K1NADR_0002: {TITLE} (../../docs/02-adr/K1NADR_0002_{TITLE}_v1.0_<YYYYMMDD>.md)
```

**From implementation (firmware/src/ comments):**
```cpp
// This implementation was constrained by K1NADR_0001 (docs/02-adr/K1NADR_0001_{TITLE}_v1.0_<YYYYMMDD>.md)
// Key constraint: [brief explanation]
```

**From test documentation:**
```markdown
### Validation per ADR
This test validates the decision in K1NADR_0001 (../../docs/02-adr/K1NADR_0001_{TITLE}_v1.0_<YYYYMMDD>.md):
- Requirement 1: [test name]
- Requirement 2: [test name]
```

---

## File Naming Convention

```
K1NADR_<ID>_<TITLE>_v<version>_<YYYYMMDD>.md

Where:
  ID     = 4-digit zero-padded sequence number (0001, 0002, 0003, ...)
  TITLE  = SCREAMING_SNAKE_CASE descriptive title (DUAL_CHANNEL_LEDS)
  version/date = semantic version and snapshot date when recorded

Examples:
  K1NADR_0001_DUAL_CORE_ARCHITECTURE_v1.0_20251110.md
  K1NADR_0002_I2S_CONFIGURATION_STANDARD_v1.0_20251110.md
  K1NADR_0003_PATTERN_GENERATION_SAFETY_v1.0_20251110.md
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

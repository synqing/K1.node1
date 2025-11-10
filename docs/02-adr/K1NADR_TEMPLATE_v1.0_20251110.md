---
title: ADR-####: [Decision Title]
status: draft
version: v1.0
owner: [Docs Maintainers]
reviewers: [Engineering Leads]
last_updated: 2025-10-28
next_review_due: 2026-01-26
tags: [docs]
related_docs: []
---
<!-- markdownlint-disable MD013 -->

# ADR-####: [Decision Title]

**Status:** Draft | In Review | Accepted | Superseded
**Date:** YYYY-MM-DD
**Author:** @contributor_name
**References:**
- BOTTLENECK_N from docs/05-analysis/{subsystem}/bottleneck_matrix.md
- Related ADR: ADR-####
- Issue/PR: #{number}

---

## Context

**What problem or decision triggers this ADR?**

[2-3 sentences describing the situation that requires an architectural decision. Include relevant metrics or constraints from SUPREME analysis if this addresses a bottleneck.]

**Why can't we keep doing what we're doing?**

[Explain the limitation of current approach. Quantify impact if possible (latency ms, CPU %, memory bytes, race condition probability, etc.)]

**Background:**
- System has [X] components that interact in [Y way]
- Current constraint: [Z]
- Upstream issue: Link to SUPREME analysis if applicable

---

## Decision

**We will [take this approach].**

**Short explanation of why this decision makes sense:**

[1-2 sentences on the fundamental reasoning.]

---

## Consequences

### Positive
- [Benefit 1: quantified improvement]
- [Benefit 2]
- [Benefit 3]

### Negative
- [Trade-off 1: what we're sacrificing]
- [Trade-off 2]
- [Neutral cost: what doesn't change but needs maintenance]

### Implementation
- **Scope:** Which files/components change?
- **Effort:** Time estimate
- **Memory impact:** RAM and Flash deltas
- **CPU impact:** Percentage point change
- **Risk:** What could go wrong?

---

## Alternatives Considered

### Alternative 1: [Name]
**Approach:** [How would this work?]
**Pros:** [Why it could work]
**Cons:** [Why we rejected it]
**Decision:** Rejected because [reason]

### Alternative 2: [Name]
**Approach:** [How would this work?]
**Pros:** [Why it could work]
**Cons:** [Why we rejected it]
**Decision:** Rejected because [reason]

### Rationale for Chosen Approach
[Explain why the decided approach is better than alternatives. Reference metrics or constraints where possible.]

---

## Validation

**How will we know this decision is correct?**

- [ ] Test criteria: [e.g., "All tests pass", "FPS ≥ 150", "No race conditions"]
- [ ] Code review: [e.g., "Security score ≥ 90"]
- [ ] Performance measurement: [e.g., "Latency < 20ms"]
- [ ] Stress test: [e.g., "30-minute stability test passes"]

**Measurement plan:**
[Where will metrics come from? Who measures? When?]

---

## Implementation Notes

**Related files:**
- firmware/src/{file}.h:{line_range}
- firmware/test/test_{component}/
- Implementation.plans/runbooks/{fix}_implementation.md

**Related PRs:**
- #PR_NUMBER: {description}

**Implementation tasks:**
1. [Task 1 from ULTRA/Embedded design]
2. [Task 2]
3. [Task 3]

**Timeline:**
- Start: [YYYY-MM-DD]
- Target completion: [YYYY-MM-DD]
- Validation: [YYYY-MM-DD]

---

## Superseded By

[If later ADRs override this decision, note them here.]

---

## References

- [Link to SUPREME analysis if bottleneck-driven]
- [Link to design document if feature-driven]
- [Link to related ADRs]
- [Link to pull request/commit]

---

## Discussion & Approval

**Open questions:**
- [ ] Question 1?
- [ ] Question 2?

**Approvers:**
- [ ] @spectrasynq (architecture steward)
- [ ] @{reviewer1} (domain expert)
- [ ] @{reviewer2} (performance/security)

**Sign-off:**
- [ ] Architecture review: approved on {date}
- [ ] Security review: approved on {date}
- [ ] Performance review: approved on {date}

---

<!-- markdownlint-enable MD013 -->

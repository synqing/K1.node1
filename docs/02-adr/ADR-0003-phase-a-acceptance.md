---
title: ADR-0003: Phase A Acceptance Criteria
status: draft
version: v1.0
owner: [Docs Maintainers]
reviewers: [Engineering Leads]
last_updated: 2025-10-28
next_review_due: 2026-01-26
tags: [docs]
related_docs: []
---
# ADR-0003: Phase A Acceptance Criteria

Status: Accepted
Date: 2025-10-24

## Decision
Phase A is complete only when all of the following are true:

1. Compilation Pipeline
   - All three graphs compile to valid C++ and build without warnings.
   - OTA upload succeeds; device runs new firmware.

2. Performance Envelope
   - Sustained ~120 FPS with no dips below 100 FPS over 5+ minutes per pattern (measure mean, p95, p99, max frame time).
   - Document supported LED count/protocol for these guarantees.

3. Artistic Fidelity and Stability
   - Visuals match intended palette narratives; no flicker, crashes, or degradation.
   - Beauty and intentionality validated by visual review notes.

4. Production Readiness
   - No tech debt or workarounds; docs updated and accurate; rationale captured in ADRs.

## Rationale
Aligns engineering signals to the project’s mission: uncompromising intentionality and execution fidelity, measured against realistic targets.

## References
- Test procedures: `.claude/PHASE_A_VALIDATION.md`
- FPS targets: `docs/ADR/ADR-0001-fps-targets.md`


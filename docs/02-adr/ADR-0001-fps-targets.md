---
title: ADR-0001: Frame Rate Targets
status: draft
version: v1.0
owner: [Docs Maintainers]
reviewers: [Engineering Leads]
last_updated: 2025-10-28
next_review_due: 2026-01-26
tags: [docs]
related_docs: []
---
# ADR-0001: Frame Rate Targets

Status: Accepted
Date: 2025-10-24

## Context
Earlier drafts referenced a + FPS target. That was never an explicit requirement and misaligned expectations and research priorities.

## Decision
- Target frame rate: 120 FPS
- Absolute minimum acceptable frame rate: 100 FPS (no sustained dips below)
- Acceptance focuses on stability (low jitter) and fidelity over raw maximum FPS.

## Rationale
- 120 FPS delivers perceptual smoothness while balancing power, thermal, and protocol limits across typical LED counts.
- Prior “450+ FPS” language distorted priorities (e.g., protocol choices, DMA work). Stability and artistic fidelity matter more than extreme throughput.

## Implications
- Documentation and validation updated to 120/100 FPS.
- Benchmarking, buffer strategies, and bus selection should demonstrate sustained ~120 FPS with no dips < 100 FPS for supported LED counts.
- Research tracks jitter (p95/p99) and determinism rather than chasing peak FPS.

## Notes
- Define supported LED counts per protocol in a separate capability matrix.


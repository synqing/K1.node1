---
status: published
author: Spectrasynq + Multi-specialist Review Team
date: 2025-11-05
intent: Formalize K1.node1 project scope - abandon beat tracking, focus on firmware + webapp + node system
---

# ADR-0001: Project Scope & Beat Tracking Abandonment

## Status
**PUBLISHED** - Strategic foundation for K1.node1

## Context

K1.reinvented existed as a 32GB monolithic project combining:
- Firmware (ESP32-S3 audio-reactive LED controller)
- Webapp (React control dashboard)
- **Beat tracking datasets & analysis** (6.2GB K1.node2)
- **Audio feature extraction research** (harmonics, beat detection)
- **Documentation bloat** (827 MD files)

K1.node1 is a fresh start focused entirely on core value delivery.

## Decision

**We are ABANDONING all beat tracking, audio analysis, and dataset-related work.**

K1.node1 includes ONLY:
- ✅ Firmware (ESP32-S3 core)
- ✅ Webapp (React control dashboard)
- ✅ Documentation (minimal, essential only)
- ✅ Node-based pattern system (visual composition)

## Rationale

1. **Not the Core USP** - K1's differentiation is visual pattern composition (node system), not audio analysis
2. **Marshmallow Problem** - Beat tracking consumed 20% of project resources for 0% customer value
3. **Market Reality** - Competitors don't focus on beat tracking; they focus on accessibility
4. **Scope Clarity** - Kill scope creep by eliminating orthogonal features

## Consequences

### Positive
- ✅ Laser focus on core value
- ✅ Smaller footprint (32GB → 59MB)
- ✅ Faster builds and CI/CD
- ✅ Clear product messaging

### Negative
- ❌ Beat tracking opportunity cost
- ⚠️ Some creative applications no longer possible

## Implementation

1. ✅ Delete 6.2GB K1.node2
2. ✅ Archive K1.reinvented
3. ✅ Create K1.node1 clean

## Validation

- [ ] Phase 2D1 completes on schedule
- [ ] Node system PoC succeeds
- [ ] Team velocity increases
- [ ] No beat tracking feature requests

---
**Decision Date:** November 5, 2025
**Status:** PUBLISHED

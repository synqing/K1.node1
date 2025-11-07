---
title: ADR-0002: Global Brightness Scaling at Pack Time
status: draft
version: v1.0
owner: [Docs Maintainers]
reviewers: [Engineering Leads]
last_updated: 2025-10-28
next_review_due: 2026-01-26
tags: [docs]
related_docs: []
---
# ADR-0002: Global Brightness Scaling at Pack Time

Status: Accepted
Date: 2025-10-24

## Context
We need deterministic, low-cost control of overall luminance for safety, power, and calibration without altering authored color intent in the HDR working space.

## Decision
- Introduce a `global_brightness` scalar (0.0–1.0) applied only during 32-bit → 8-bit packing to the LED byte buffer.
- Default value: 0.3f (safe demo/power-on level). Tunable later via runtime parameters.

## Rationale
- Preserves effect math in HDR `CRGBF` working space; applies dimming at the final quantization stage.
- Minimal overhead (one multiply per channel), no allocations, negligible jitter impact.

## Implications
- Uniform dimming across effects; easy hook for future power budgeting and calibration.
- Authors continue to design at full intent; brightness is a display concern.

## References
- Implementation: `firmware/src/led_driver.h` in quantization paths (dithered and non-dithered).


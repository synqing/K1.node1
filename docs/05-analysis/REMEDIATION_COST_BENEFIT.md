# Remediation Cost/Benefit

## Option A: Targeted Refactor
- Scope: Firmware sync layer encapsulation, contract tests, minimal conductor-api tests.
- Effort: 2–3 weeks.
- Risk: Low–medium; isolated changes.
- Benefit: Stabilizes hotspots; preserves current architecture.

## Option B: Subsystem Rewrite
- Scope: Firmware data-plane refactor + pattern interfaces; webapp test harness alignment.
- Effort: 4–6 weeks.
- Risk: Medium; migration complexity.
- Benefit: Reduces temporal coupling; improves maintainability.

## Option C: Full Rewrite
- Scope: End-to-end redesign.
- Effort: 12+ weeks.
- Risk: High; delivery uncertainty.
- Benefit: Clean slate; highest long-term maintainability.

## Recommendation
- Proceed with Option A immediately; reassess after contract tests and CI guards are green.

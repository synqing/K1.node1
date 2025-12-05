# Architectural Drift vs ADRs

## Observed Drift
- Firmware sync layer violated data exposure contract; tempo arrays zeroed.
- Pattern interfaces depended on implicit state across files.
- CI enforcement relaxed during heavy merge windows.

## ADR Alignment
- `docs/01-architecture/README.md`: layer boundaries not enforced in code.
- `docs/02-adr`: decisions on data contracts require guardrails; guards recently added.

## Remediation
- Encapsulate sync boundary; add contract tests and CI guards.
- Normalize pattern access through explicit interface wrappers.

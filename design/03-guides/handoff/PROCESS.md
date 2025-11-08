# Handoff Process

Goal: Maintain continuous design-to-development flow with zero surprises.

Steps:
- Draft: Designer creates component spec in `design/02-components/` using `design/03-guides/handoff/HANDOFF_TEMPLATE.md`.
- Review: Design System Engineer and Front-end Engineer review tokens, variants, and accessibility.
- Pairing: Short pairing session to clarify edge cases and states.
- Implement: Engineer builds component referencing tokens and Radix/Shadcn primitives.
- Validate: Designer verifies implementation against spec; accessibility audit performed.
- Merge: Component merges with linked metadata and changelog updates.

Artifacts:
- Component spec
- Token diff (if new or changed)
- Accessibility checklist
- Performance budget notes


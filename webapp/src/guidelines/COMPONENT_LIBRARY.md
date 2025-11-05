# Component Library (Webapp)

Principles:
- Build on Radix primitives; apply Shadcn patterns and Tailwind utilities.
- Enforce variant APIs with predictable props and class variance authority.

Implementation:
- Keep components small, composable, and testable.
- Co-locate component docs linking to `design/02-components/` specs.

Performance:
- Memoize expensive paths; virtualize long lists.
- Measure with React Profiler; enforce budgets from `design/04-quality/README.md`.

Accessibility:
- Ensure roles and labels; guard against focus traps.

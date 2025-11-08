# Development Framework

Design System:
- Foundations: color, spacing, typography, elevation, radii.
- Tokens: CSS variables under `:root` mapped to Tailwind theme (see `design/01-foundations/tokens.md`).
- Accessibility: WCAG AA contrast, keyboard navigability, focus states with visible rings.

Component Library:
- Platform: Radix UI primitives + Shadcn/ui patterns for accessibility and consistency.
- Composition: Build feature components from primitives; avoid bespoke styles.
- Theming: Dark/light tokens; prefer semantic tokens (e.g., `--color-accent`).
- Motion: Use `framer-motion` for micro-interactions; respect reduced-motion preferences.

Docs:
- Add per-component spec in `design/02-components/` including: states, variants, props, behaviors.
- Link to production usage in `webapp/src/components/...` and story references if present.

Handoff:
- Use `design/03-guides/handoff/HANDOFF_TEMPLATE.md` to document component specs, tokens, variants.
- Pairing sessions between designers and engineers for critical components.

Interaction Patterns:
- Status and feedback are prominent and dismissible.
- Center-origin visuals and mid-line status are first-class.
- Avoid modal overload; prefer drawers and inline panels.


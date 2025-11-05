# Style Guide (Webapp)

Stack alignment:
- Tailwind for utility classes; keep spacing and typography consistent.
- Radix UI primitives for accessible building blocks.
- Shadcn/ui patterns for composable, themed components.

Tokens:
- Use CSS variables for semantic tokens; map to Tailwind theme.
- Prefer semantic usage (e.g., `accent`, `success`, `warning`) over raw color names.

Patterns:
- Avoid bespoke CSS; compose utilities and variants.
- Respect dark/light themes and reduced-motion preferences.

Accessibility:
- Visible focus rings; keyboard navigability for interactive elements.
- Check AA contrast; annotate ARIA roles where needed.


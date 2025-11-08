# Prompt Patterns for Builder Agents (K1)

Purpose: Aim the agent at precise, high‑value work using our tokens, components, and constraints. Copy/paste and fill blanks.

## 1) Register Components + Wrappers
"Register the following components using alias '@' and named exports. Do not alter component logic. Provide full TypeScript registration code with imports and Builder.registerComponent calls.
- Button from '@/components/ui/button' (variant, size, asChild, text)
- CardWrapper from '@/builder/CardWrapper' (header, subheader, children)
- TabsWrapper from '@/builder/TabsWrapper' (value, tabs[] with label/value/content)
- MetricTileWrapper from '@/builder/MetricTileWrapper' (label, value, unit, trend, tone, decimals)
- TerminalPanelWrapper from '@/builder/TerminalPanelWrapper' (initialCommand, autoScroll, historyLimit)
- ProfilingChartsWrapper from '@/builder/ProfilingChartsWrapper' (selectedEffect, timeRange)"

## 2) Generate Models + Example Content
"Create JSON schemas and three example pages based on these docs:
- design/03-guides/handoff/builder/models-and-content.md
- design/03-guides/handoff/builder/ia-sitemap.md
Output two schemas (page, section) and examples for Control Panel, Profiling, Terminal."

## 3) Verify Token Mapping for Preview
"Compare tokens in design/01-foundations/tokens/TOKEN_SPEC.md against builder/custom_code_tokens_with_toggle.html. Output a diff if any token is unmapped. Otherwise respond: VALID — No fixes needed."

## 4) Static Audit → Remediation Plan
"Using the attached code files (MANIFEST), perform a static audit. Output Must/Should/Could with rationale, exact code paths, effort (S/M/L), and success metrics. Prioritize: touch targets ≥44px, live status visibility, terminal overflow safety."

## 5) Compose Wireframes with Tailwind Recipes
"Using design/03-guides/handoff/wireframes.md, list Tailwind layouts for Control Panel, Profiling, Terminal. For each section, specify which registered components to place and the props to use. Include responsive notes for 360/768/1024/1440."

## 6) Runtime Validation Playbook
"Produce a checklist from design/04-quality/UX_AUDIT_VERIFICATION_PLAN.md for performance, responsiveness, and accessibility. Include a findings table template."

## Constraints (Always Include)
- Use Tailwind utilities + our tokens; shadcn patterns only.
- Respect .dark tokens via the provided custom code.
- Use alias '@' imports and named exports; no '.tsx' extensions.
- If any referenced file is missing, list exact filenames under 'Missing Inputs' and stop.


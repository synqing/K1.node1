# Builder Models & Content Composition (K1)

Purpose: Enable Builder to compose pages/sections while reusing existing React components and tokens.

## Models

### page
- fields
  - title (string)
  - slug (url)
  - sections (list of reference: section)
  - meta (json, optional)

### section
- fields
  - type (enum): controlPanel | profiling | terminal | analysis | graph | diagnostics | stressTest
  - layout (enum): single | twoCol | threeCol | grid
  - props (json): forwarded props to our React wrappers
  - visibility (json): feature flags/conditions (optional)

## Example Content

- page: "Control Panel"
  - sections:
    - section: type=controlPanel, layout=threeCol, props={}

- page: "Profiling"
  - sections:
    - section: type=profiling, layout=grid, props={ timeRange: 500, showPhaseComparison: false }

- page: "Terminal"
  - sections:
    - section: type=terminal, layout=single, props={ autoScroll: true }

## Rendering Strategy

- App wrapper consumes Builder content and maps each `section.type` → React view component:
  - controlPanel → `<ControlPanelView />`
  - profiling → `<ProfilingView />`
  - terminal → `<TerminalView />`
  - analysis → `<AnalysisView />`
  - graph → `<GraphEditorView />`

- Provide light composition wrappers for layout options (single/twoCol/threeCol/grid) that only apply Tailwind classes; all visuals remain token-driven.

## Guidelines

- No raw CSS in Builder content; use Tailwind utilities and our registered components.
- Respect `.dark` toggle for tokens; the Builder custom code injects variables and a toggle.
- Keep props serializable (plain JSON) to simplify previews and publishing.


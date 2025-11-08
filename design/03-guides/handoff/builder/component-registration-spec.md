# Builder Component Registration Spec (K1)

Purpose: Allow Builder to compose views using existing React components without altering logic or tokens.

## Button (webapp/src/components/ui/button.tsx)
- name: Button
- inputs:
  - variant: enum ["default","destructive","outline","secondary","ghost","link"]
  - size: enum ["sm","default","lg","icon"]
  - asChild: boolean (default false)
  - text: string (used as children when not `asChild`)
- mapping:
  - If `asChild = true`, expect Builder to wrap via Slot; otherwise pass `children = text`.

## Card (webapp/src/components/ui/card.tsx)
- name: Card
- inputs:
  - header: string
  - subheader: string
  - children: richText (slot)
- mapping:
  - Render header/subheader as optional `<CardHeader>`; forward children to `<CardContent>`.

## Tabs (webapp/src/components/ui/tabs.tsx)
- name: Tabs
- inputs:
  - value: string (active tab)
  - tabs: list of { label: string, value: string }
  - content: list of slots keyed by `value`
- mapping:
  - Generate `<TabsList>` from `tabs`; render `<TabsContent value=...>` for each content slot.

## MetricTile (spec-only wrapper)
- name: MetricTile
- inputs:
  - label: string
  - value: string
  - unit: string
  - trend: enum ["up","down","flat"]
  - tone: enum ["default","success","warning","error","info"]
- mapping:
  - Use tokens for tone color; lay out label (xs), value+unit (xl), trend arrow (icon).

## TerminalPanel (webapp/src/components/views/TerminalView.tsx)
- name: TerminalPanel
- inputs:
  - initialCommand: string
  - autoScroll: boolean
  - historyLimit: number
- mapping:
  - Provide defaults: `initialCommand='help'`, `autoScroll=true`, `historyLimit=1000`.

## ProfilingCharts (webapp/src/components/profiling/ProfilingCharts.tsx)
- name: ProfilingCharts
- inputs:
  - selectedEffect: enum (values from EffectType | 'all')
  - timeRange: number (e.g., 100 | 500 | 1000)
- mapping:
  - Forward props; ensure charts are wrapped in a responsive container.

Notes
- Keep Tailwind + tokens only. No raw CSS colors.
- Add `aria-label` defaults for icon-only buttons in Builder.
- Use dark mode by toggling `.dark` on root in Builder (see custom code snippet).


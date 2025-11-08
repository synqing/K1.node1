# Wireframe Recipes (Tailwind + Tokens)

All layouts are token-based; no raw colors, use utilities.

## Control Panel
- Desktop grid: `grid grid-cols-[400px_1fr_320px] gap-6`
- Mobile: `grid grid-cols-1 gap-4`
- Left: Effect selector (virtualized list if needed)
- Center: Parameter sliders (≥44px target, value labels)
- Right: Color presets + global settings

## Profiling
- Header row: filters + `Live` badge + pause/resume
- Charts grid: `grid grid-cols-2 gap-6` (desktop), `grid-cols-1` (mobile)
- Live stats: `grid grid-cols-3 gap-4` (desktop), `grid-cols-1` (mobile)
- Cards: `bg-[var(--prism-bg-surface)] border border-[var(--prism-bg-elevated)] rounded-lg`

## Terminal
- Shell: flex column, main scroll area `overflow-y-auto`
- Sidebar: history + commands `w-80` (collapse to drawer on mobile)
- Monospace: `.font-jetbrains text-xs sm:text-sm`
- Actions: Clear, Auto-scroll, Execute

## Sidebar & TopNav
- Sidebar: `w-64` (expanded) / `w-12` (collapsed)
- Controls: icon-only actions must include `aria-label` and visible focus
- Tokens: use `--sidebar-*` and PRISM tokens for borders/backgrounds

## Modals (Dialogs)
- Mobile safety: `max-h-[90vh] overflow-y-auto`
- Structure: Title → Description → Content → Actions

## Spacing & Radius
- Spacing: Tailwind default scale (`gap-2/4/6`, `p-4/6`)
- Radius: use tokens (e.g., `rounded-[var(--radius)]` subclasses) where applicable


# UX Audit Verification Plan (Runtime)

Targets: K1.node1 SPA (Control Panel, Profiling, Terminal) with tokens locked.

## Performance
- Lighthouse (desktop + mobile @ 4G): FCP, LCP, CLS, INP, TBT
- DevTools Performance: 10s interaction on Profiling + Terminal (long tasks, layout shifts)
- Bundle impact: lazy-load charts; confirm no vendor duplication

## Responsiveness
- Widths: 360, 768, 1024, 1440
- Sidebar behavior: collapse/drawer on mobile; no hidden focus traps
- Overflow: Terminal monospace, tables, charts (no horizontal scroll at 360)

## Accessibility (WCAG 2.2 AA)
- Axe: target 0 critical/serious issues
- Keyboard: Tab/Shift+Tab through TopNav, Sidebar, all controls
- Focus-visible: 2–3px ring using `--ring` token
- Landmarks: one <main> region present per view
- Labels/ARIA: icon-only controls include `aria-label`

## Success Metrics
- CLS < 0.1
- INP p75 < 200ms (desktop)
- TBT < 200ms on key views
- No horizontal scroll at 360px
- All interactive controls ≥44px height on touch

## Runbook
1) `cd webapp && npm i && npm run dev` (or build/preview)
2) Lighthouse desktop+mobile, save reports
3) DevTools Performance: interact with sliders, charts, terminal for 10s; record
4) Axe (browser extension) across each view
5) Record findings in a matrix: component, issue, severity, fix, effort


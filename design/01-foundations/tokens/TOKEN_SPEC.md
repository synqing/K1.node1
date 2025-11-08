# K1 Canonical Token Spec (Light + Dark)

Purpose: Single source of truth for colors, theme variables, charts, and usage across K1 projects (K1.node1, Builder space, future agents). Export this file to PDF for hand‑off.

## Palette Overview

- Structural neutrals (dark-first)
  - Canvas: `#1c2130`
  - Surface: `#252d3f`
  - Elevated: `#2f3849`
  - Border (light): `rgba(0,0,0,0.1)`
  - Ring (light): `oklch(0.708 0 0)`
  - Ring (dark): `oklch(0.439 0 0)`

- Text
  - Primary: `#e6e9ef` (dark) / `oklch(0.145 0 0)` (light)
  - Secondary: `#b5bdca` (dark) / `#717182` (light)

- Brand / interactive
  - Primary: `#030213` (light) / `oklch(0.985 0 0)` (dark)
  - Primary-foreground: `oklch(1 0 0)` (light) / `oklch(0.205 0 0)` (dark)
  - Secondary: `oklch(0.95 0.0058 264.53)` (light) / `oklch(0.269 0 0)` (dark)
  - Secondary-foreground: `#030213` (light) / `oklch(0.985 0 0)` (dark)
  - Accent: `#e9ebef` (light) / `oklch(0.269 0 0)` (dark)
  - Accent-foreground: `#030213` (light) / `oklch(0.985 0 0)` (dark)
  - Destructive: `#d4183d` (light) / `oklch(0.396 0.141 25.723)` (dark)
  - Destructive-foreground: `#ffffff` (light) / `oklch(0.637 0.237 25.331)` (dark)

- Status
  - Success: `#22dd88`, Warning: `#f59e0b`, Error: `#ef4444`, Info: `#6ee7f3`

- Domain types
  - Scalar: `#f59e0b`, Field: `#22d3ee`, Color: `#f472b6`, Output: `#34d399`

- Controls
  - Input (light): `transparent` / Input (dark): `oklch(0.269 0 0)`
  - Input-background (light): `#f3f3f5`
  - Switch-background (light): `#cbced4`
  - Radius: `0.625rem`

- Sidebar (semantic shell)
  - Light: `sidebar = oklch(0.985 0 0)`, `sidebar-foreground = oklch(0.145 0 0)`, `sidebar-primary = #030213`
  - Dark: `sidebar = oklch(0.205 0 0)`, `sidebar-foreground = oklch(0.985 0 0)`, `sidebar-primary = oklch(0.488 0.243 264.376)`

## Theme Tokens

Light (:root)

```
--background: #ffffff;
--foreground: oklch(0.145 0 0);
--card: #ffffff; --card-foreground: oklch(0.145 0 0);
--popover: oklch(1 0 0); --popover-foreground: oklch(0.145 0 0);
--primary: #030213; --primary-foreground: oklch(1 0 0);
--secondary: oklch(0.95 0.0058 264.53); --secondary-foreground: #030213;
--muted: #ececf0; --muted-foreground: #717182;
--accent: #e9ebef; --accent-foreground: #030213;
--destructive: #d4183d; --destructive-foreground: #ffffff;
--border: rgba(0,0,0,0.1); --input: transparent; --input-background: #f3f3f5; --switch-background: #cbced4;
--ring: oklch(0.708 0 0);
--prism-bg-canvas: #1c2130; --prism-bg-surface: #252d3f; --prism-bg-elevated: #2f3849;
--prism-text-primary: #e6e9ef; --prism-text-secondary: #b5bdca;
--prism-gold: #ffb84d; --prism-success: #22dd88; --prism-warning: #f59e0b; --prism-error: #ef4444; --prism-info: #6ee7f3;
--prism-scalar: #f59e0b; --prism-field: #22d3ee; --prism-color: #f472b6; --prism-output: #34d399;
--chart-1: oklch(0.646 0.222 41.116); --chart-2: oklch(0.6 0.118 184.704); --chart-3: oklch(0.398 0.07 227.392);
--chart-4: oklch(0.828 0.189 84.429); --chart-5: oklch(0.769 0.188 70.08);
--chart-6: oklch(0.72 0.15 300); --chart-7: oklch(0.68 0.12 210); --chart-8: oklch(0.70 0.18 20);
--radius: 0.625rem;
--sidebar: oklch(0.985 0 0); --sidebar-foreground: oklch(0.145 0 0); --sidebar-primary: #030213;
--sidebar-primary-foreground: oklch(0.985 0 0); --sidebar-accent: oklch(0.97 0 0); --sidebar-accent-foreground: oklch(0.205 0 0);
--sidebar-border: oklch(0.922 0 0); --sidebar-ring: oklch(0.708 0 0);
```

Dark (.dark)

```
--background: oklch(0.145 0 0); --foreground: oklch(0.985 0 0);
--card: oklch(0.145 0 0); --card-foreground: oklch(0.985 0 0);
--popover: oklch(0.145 0 0); --popover-foreground: oklch(0.985 0 0);
--primary: oklch(0.985 0 0); --primary-foreground: oklch(0.205 0 0);
--secondary: oklch(0.269 0 0); --secondary-foreground: oklch(0.985 0 0);
--muted: oklch(0.269 0 0); --muted-foreground: oklch(0.708 0 0);
--accent: oklch(0.269 0 0); --accent-foreground: oklch(0.985 0 0);
--destructive: oklch(0.396 0.141 25.723); --destructive-foreground: oklch(0.637 0.237 25.331);
--border: oklch(0.269 0 0); --input: oklch(0.269 0 0); --ring: oklch(0.439 0 0);
--chart-1: oklch(0.488 0.243 264.376); --chart-2: oklch(0.696 0.17 162.48);
--chart-3: oklch(0.769 0.188 70.08); --chart-4: oklch(0.627 0.265 303.9);
--chart-5: oklch(0.645 0.246 16.439); --chart-6: oklch(0.62 0.25 330);
--chart-7: oklch(0.58 0.18 210); --chart-8: oklch(0.60 0.22 25);
--sidebar: oklch(0.205 0 0); --sidebar-foreground: oklch(0.985 0 0); --sidebar-primary: oklch(0.488 0.243 264.376);
--sidebar-primary-foreground: oklch(0.985 0 0); --sidebar-accent: oklch(0.269 0 0); --sidebar-accent-foreground: oklch(0.985 0 0);
--sidebar-border: oklch(0.269 0 0); --sidebar-ring: oklch(0.439 0 0);
```

## Usage Guidance

- Primary vs. Accent: primary for key actions/nav; accent for subtle highlights/hover.
- Status usage: prefer icons/badges; for long error text on dark, use `--destructive` or place on elevated surface.
- Focus visibility: 2–3px `--ring` outline; maintain AA contrast.
- Touch targets: ≥44px height for sliders, buttons, switches.

## Charts (8-series, color‑blind considerate)

Use `--chart-1..8` sequentially. For stacked series on dark, favor higher L/C entries (4,6) adjacent to low‑L neutrals.

## Contrast Notes

- text-primary on canvas (dark): AAA
- text-secondary on canvas (dark): AA (large ≈ AAA)
- primary-foreground on primary (light): AAA
- accent-foreground on accent (light): AAA
- destructive-foreground on destructive (light): AA (AAA for large)
- error on canvas (dark): borderline (~4:1) — keep for accents/badges; avoid long body text directly on canvas


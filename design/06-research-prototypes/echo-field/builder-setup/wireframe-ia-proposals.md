# K1.node1 Wireframe & Information Architecture Proposals

## Overview
Three core views with responsive Tailwind grid layouts, semantic structure, and accessibility-first design.

---

## 1. CONTROL PANEL VIEW

**Purpose:** Real-time LED pattern control with parameter adjustment, color management, and effect selection.

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ TopNav: Title + Theme Toggle + Global Settings                   │
├────────────────────┬───────��────────────────┬───────────────────┤
│  Effect Selector   │   Parameter Controls   │  Color Presets    │
│  (Left Sidebar)    │    (Center Grid)       │  (Right Panel)    │
│                    │                        │                   │
│  • ModeSelectors   │  • ParamSlider (44px)  │  • Gradient Presets
│  • EffectSelector  │  • EnhancedSlider      │  • Custom Picker
│  • PatternSelector │  • Real-time Feedback  │  • Applied Colors
│  • Tabs: Effect    │  • Validation Errors   │  • Quick Save
│                    │                        │                   │
└────────────────────┴────────────────────────┴───────────────────┘
```

### Tailwind Grid Recipe

**Desktop (1024px+):**
```css
.control-panel {
  @apply grid gap-6;
  grid-template-columns: 400px 1fr 320px;
  grid-template-rows: auto 1fr;
}

.control-panel-header {
  @apply col-span-3 flex items-center justify-between py-4 px-6 border-b;
}

.control-left {
  @apply col-span-1 row-span-2 space-y-4 overflow-y-auto p-6 bg-card;
}

.control-center {
  @apply col-span-1 row-span-2 space-y-6 overflow-y-auto p-6;
}

.control-right {
  @apply col-span-1 row-span-2 space-y-4 overflow-y-auto p-6 bg-muted;
}
```

**Tablet (768px–1023px):**
```css
.control-panel {
  grid-template-columns: 1fr;
  grid-template-rows: auto auto auto auto;
}

.control-left {
  @apply col-span-1 row-span-1 border-b pb-6;
}

.control-center {
  @apply col-span-1 row-span-1 border-b pb-6;
}

.control-right {
  @apply col-span-1 row-span-1;
}
```

**Mobile (360px–767px):**
```css
.control-panel {
  @apply flex flex-col gap-4 p-4;
}

.control-left,
.control-center,
.control-right {
  @apply w-full border-b pb-4;
}

/* Collapsible sections on mobile */
.control-section-toggle {
  @apply flex items-center justify-between cursor-pointer;
}
```

### Components & States

| Section | Components | Props | Accessibility |
|---------|-----------|-------|---------------|
| **Left** | ModeSelectors | active: enum | role="tablist" + aria-label |
| | PatternSelector | options: list | aria-expanded for dropdown |
| | EffectSelector | selected: string | aria-selected states |
| **Center** | ParamSlider ×N | value, min, max, label | aria-label, aria-valuemin/max/now |
| | EnhancedGlowControls | intensity, color | Live preview feedback |
| | EffectParameters | dynamic params | Real-time validation |
| **Right** | ColorManagement | presets, custom | aria-label on color buttons |
| | GlobalSettings | speed, brightness | aria-describedby for hints |

### Data Flow

```
User Input (Slider/Button)
  ↓
ParamSlider onChange event
  ↓
Real-time API call: PATCH /api/device/parameter
  ↓
StatusBar shows: "✓ Updated (100ms)"
  ↓
LedVisualization re-renders live
```

### Touch-Safe Sizing

- **Slider targets:** 44px height (py-2 wrapper + h-2 track)
- **Buttons:** min h-9 (36px), w-9 (icon-only)
- **Tappable areas:** ≥44px tall, ≥12px horizontal padding

---

## 2. PROFILING VIEW

**Purpose:** Real-time monitoring dashboard with live metrics, charts, and performance insights.

### Layout Structure

```
┌──────────────────────────────────────────────────────────────────┐
│ Header: "Live Profiling" | Filters | ▓ Live Badge | [Pause] Btn  │
├──────────────────────────────────────────────────────────────────┤
│  Metrics Row: [CPU] [Mem] [Temp] [FPS] [TBT]                      │
├─────────────────────────────────┬────────────────────────────────┤
│         FrequencyChart          │      BeatGridChart             │
│  (Responsive, 50% width)        │  (50% width desktop)           │
├─────────────────────────────────┼────────────────────────────────┤
│         DynamicsChart           │      Custom Metrics            │
│  (50% width)                    │  (50% width)                   │
├──────────────────────────────────────────────────────────────────┤
│  Activity Log / Timeline (collapsed or scrollable)                 │
└──────────────────────────────────────────────────────────────────┘
```

### Tailwind Grid Recipe

**Desktop (1024px+):**
```css
.profiling-view {
  @apply flex flex-col gap-6 p-6;
}

.profiling-header {
  @apply flex items-center justify-between border-b pb-4;
}

.profiling-metrics {
  @apply grid gap-4 mb-6;
  grid-template-columns: repeat(5, 1fr);
}

.profiling-charts {
  @apply grid gap-6;
  grid-template-columns: repeat(2, 1fr);
}

.profiling-activity {
  @apply mt-6 max-h-96 overflow-y-auto rounded-lg border p-4;
}
```

**Tablet (768px–1023px):**
```css
.profiling-metrics {
  grid-template-columns: repeat(3, 1fr);
}

.profiling-charts {
  grid-template-columns: 1fr;
}
```

**Mobile (360px–767px):**
```css
.profiling-view {
  @apply flex flex-col gap-4 p-4;
}

.profiling-metrics {
  grid-template-columns: repeat(2, 1fr);
}

.profiling-charts {
  grid-template-columns: 1fr;
}
```

### Components & States

| Section | Components | Props | Accessibility |
|---------|-----------|-------|---------------|
| **Header** | ProfilingFilters | activeFilter: string | aria-label on filter buttons |
| | Live Badge | isLive: boolean | aria-label="Live monitoring" |
| | Pause Button | onClick, aria-pressed | Toggle play/pause |
| **Metrics** | MetricTile ×5 | label, value, trend, tone | aria-live="polite" for updates |
| **Charts** | FrequencyChart | data, responsive | figure role="img" + figcaption |
| | BeatGridChart | gridData, colors | Legend + data table fallback |
| | DynamicsChart | timeSeriesData | Zoom/pan on desktop; static mobile |
| **Activity** | ActivityLog | entries, autoScroll | aria-live="polite" + scrollable region |

### Live Update Pattern

```
ProfilingView (isLive=true)
  ↓
React Query: useQuery({ queryKey: ['profiling'], refetchInterval: 1000 })
  ↓
[ProfilingCharts, LiveStatistics] re-render
  ↓
Framer Motion fade-in: <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
  ↓
"Live" badge pulses: @apply animate-pulse
```

### Touch & Mobile Considerations

- **Chart height:** max-h-64 on mobile (prevent tall stacks)
- **Metrics grid:** 2-col on mobile, 3-col tablet, 5-col desktop
- **Tap targets:** Metric tiles ≥44px tall
- **Scrolling:** Charts not scrollable; fixed aspect ratio ResponsiveContainer

---

## 3. TERMINAL VIEW

**Purpose:** Interactive terminal emulator for command execution, output viewing, and history navigation.

### Layout Structure

```
┌──────────────────────────────────────────────────────────────────┐
│ TopNav: Terminal | Theme + Settings                              │
├────────────────────��─────────────────────────────────────────────┤
│                                                   │ History Drawer│
│  Terminal Output Area (monospace, scrollable)    │ (desktop: w-80)│
│  ▓ > command executed...                          │               │
│  ▓ $ ls /patterns                                 │ • pattern-1   │
│  ▓ pattern-1.json                                 │ • pattern-2   │
│  ▓ pattern-2.json                                 │ • upload new  │
│  ▓ $ _                                            │               │
│                                                   │               │
├──────────────────────────────────────────────────────────────────┤
│  Command Input: $ [________________________________________]      │
│  Hint: Tab for autocomplete, ↑/↓ for history, Ctrl+L to clear   │
└──────────────────────────────────────────────────────────────────┘
```

### Tailwind Grid Recipe

**Desktop (1024px+):**
```css
.terminal-view {
  @apply grid gap-0;
  grid-template-columns: 1fr w-80;
  grid-template-rows: 1fr auto;
}

.terminal-output {
  @apply col-span-1 row-span-1 overflow-y-auto font-mono text-sm;
  @apply bg-prism-bg-canvas text-prism-text-primary p-4;
  @apply font-jetbrains;
  max-height: calc(100vh - 200px);
}

.terminal-history {
  @apply col-span-1 row-span-2 overflow-y-auto border-l p-4 bg-prism-bg-surface;
  @apply w-80 max-h-screen;
}

.terminal-input {
  @apply col-span-1 row-span-1 flex items-center gap-2 p-4 bg-prism-bg-surface;
  border-top: 1px solid var(--prism-bg-elevated);
}
```

**Tablet (768px–1023px):**
```css
.terminal-view {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr 200px auto;
}

.terminal-history {
  @apply col-span-1 max-h-48 border-t;
  /* Convert to bottom drawer on scroll */
}
```

**Mobile (360px–767px):**
```css
.terminal-view {
  @apply flex flex-col h-screen;
}

.terminal-output {
  @apply flex-1 overflow-y-auto;
}

.terminal-history {
  /* Hidden by default; toggle via button or swipe */
  @apply hidden;
}

/* Show history in modal/drawer on button click */
.terminal-history-sheet {
  @apply fixed inset-0 z-50 bg-black/50;
}
```

### Components & States

| Section | Components | Props | Accessibility |
|---------|-----------|-------|---------------|
| **Output** | TerminalPanel | initialCommand, autoScroll | role="log", aria-live="polite" |
| | Code Block Syntax | ANSI colors mapped to tokens | <pre> + <code> semantics |
| **History** | HistoryList | entries, selected | aria-label on each entry |
| | Command Buttons | rerun, copy, delete | aria-label for icon buttons |
| **Input** | TerminalInput | value, onSubmit, hints | aria-describedby="hint-text" |
| | Autocomplete | suggestions, onSelect | role="listbox" + aria-expanded |

### Interaction Flow

```
User types: "ls /patterns" + Tab
  ↓
Autocomplete suggests: [ls, list, load]
  ↓
User presses Enter
  ↓
TerminalPanel appends line: "$ ls /patterns"
  ↓
Fetches /api/terminal/execute
  ↓
Output renders with syntax highlighting (ANSI colors)
  ↓
HistoryList prepends new command
  ↓
Input clears, focus returns
```

### Keyboard Shortcuts

- **↑/↓:** Navigate command history
- **Tab:** Autocomplete suggestions
- **Ctrl+L:** Clear terminal output
- **Ctrl+K:** Clear input field
- **Enter:** Execute command
- **Esc:** Cancel autocomplete / blur input

### Touch & Mobile Considerations

- **Input height:** min-h-10 (44px)
- **History drawer:** Sheet/Drawer component on mobile; toggle via button
- **Scrolling:** max-h-[calc(100vh-200px)] to prevent overflow
- **Font size:** text-sm minimum; monospace should be readable at 360px
- **Tap targets:** Command history items ≥44px tall

---

## Responsive Breakpoints Summary

| Breakpoint | Control Panel | Profiling | Terminal |
|------------|--|--|--|
| **360px (Mobile)** | Stacked (1-col) | 2-col metrics, 1-col charts | Single col, history drawer |
| **768px (Tablet)** | Partially 2-col | 3-col metrics, 1-col charts | 1-col + bottom history |
| **1024px+ (Desktop)** | 3-col grid | 5-col metrics, 2-col charts | 2-col (output + history) |

---

## Accessibility Compliance Checklist (Per View)

### Control Panel
- [ ] All sliders have aria-label + aria-valuemin/max/now
- [ ] Icon buttons have aria-label (e.g., "Settings")
- [ ] Focus ring visible on all inputs (2-3px ring)
- [ ] Keyboard nav: Tab through all controls; Enter/Space to activate
- [ ] Contrast: All text ≥7:1 AA (verify on dark background)

### Profiling
- [ ] Metrics tiles have aria-live="polite" for live updates
- [ ] Charts have figure role="img" + figcaption
- [ ] Live badge announces state change (aria-label)
- [ ] Pause button: aria-pressed attribute
- [ ] Filter buttons: aria-selected states
- [ ] Keyboard nav: Tab through filters + pause button

### Terminal
- [ ] Output area: role="log" + aria-live="polite"
- [ ] Input field: aria-describedby for hint text
- [ ] Autocomplete listbox: role="listbox" + aria-expanded
- [ ] Command history: Each entry has aria-label (e.g., "rerun 'ls'")
- [ ] Focus trap: Shift+Tab from input wraps to history; Tab from history wraps to input
- [ ] Keyboard shortcuts documented in UI (? shortcut)

---

## Design Token Usage (Per View)

### Control Panel
- **Background:** var(--background) [light] / var(--card) [dark]
- **Text:** var(--foreground) primary, var(--muted-foreground) secondary
- **Primary action:** var(--primary) buttons (e.g., Apply, Save)
- **Live feedback:** var(--prism-success) for "updated", var(--prism-error) for validation
- **Color picker:** All chart colors (--chart-1 through --chart-8)

### Profiling
- **Header:** var(--card) background
- **Metrics tiles:** var(--muted) bg with success/warning/error tones
- **Charts:** Recharts uses --chart-1..8 via custom theme
- **Live badge:** var(--prism-success) with pulse animation
- **Activity log:** var(--card) background, --muted borders

### Terminal
- **Output bg:** var(--prism-bg-canvas) [dark terminal aesthetic]
- **Output text:** var(--prism-text-primary) for primary output, var(--prism-text-secondary) for metadata
- **Input bg:** var(--prism-bg-surface)
- **ANSI colors:** Map to semantic tokens (error → var(--destructive), success → var(--prism-success), etc.)
- **History sidebar:** var(--prism-bg-surface) background

---

## Notes for Implementation

1. **Responsive Images/Icons:** Use Lucide React icons; size to 16px (text-base) or 20px (text-lg) at 360px
2. **Touch Padding:** Wrap clickable areas in 44px min tall containers; use py-2 or py-1 spacing
3. **Monospace Fonts:** Terminal uses JetBrains Mono; verify readability at 360px (may need text-xs on mobile)
4. **Animation:** Framer Motion for charts/metrics; use `duration={0.3}` and `easing: "easeInOut"` for polish
5. **Real-time Updates:** React Query with `refetchInterval` for Profiling; Sonner for error toasts across views
6. **Accessibility First:** All interactive elements keyboard-navigable; focus-visible ring applied globally

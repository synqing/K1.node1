# K1.node1 Runtime Validation Playbook

Complete step-by-step guide to validate performance, accessibility, and UX of the deployed K1.node1 webapp.

---

## PHASE 1: SETUP & BASELINE

### 1.1 Environment Preparation

**Prerequisites:**
- [ ] Node.js 18+ installed
- [ ] Chrome DevTools (desktop + mobile emulation)
- [ ] Android phone or iOS device for cross-device testing
- [ ] Lighthouse installed locally: `npm install -g lighthouse`
- [ ] WebAIM Contrast Checker bookmark: https://webaim.org/resources/contrastchecker/
- [ ] Axe DevTools extension installed

**Steps:**
1. Start dev server: `npm run dev`
2. Verify app loads at http://localhost:8080
3. Check both light mode (default) and dark mode (toggle)
4. Open Chrome DevTools: F12 or Cmd+Option+I

### 1.2 Document Baseline Metrics

**Create a spreadsheet with columns:**
- Test Name
- Desktop Score (Baseline)
- Mobile Score (Baseline)
- Tolerance (±%)
- Status (Pass/Fail)
- Notes

---

## PHASE 2: PERFORMANCE AUDIT

### 2.1 Lighthouse Desktop

**Steps:**
1. Open http://localhost:8080 in Chrome (incognito for clean cache)
2. DevTools > Lighthouse tab
3. Click "Analyze page load"
4. **Settings:**
   - Device: Desktop
   - Throttling: Simulated fast 3G (not standard)
   - Clear storage: ✓
5. Wait for report to generate
6. **Record metrics:**

| Metric | Score | Target | Notes |
|--------|-------|--------|-------|
| **FCP** (First Contentful Paint) | ___ ms | <1.8s | — |
| **LCP** (Largest Contentful Paint) | ___ ms | <2.5s | — |
| **CLS** (Cumulative Layout Shift) | ___ | <0.1 | — |
| **INP** (Interaction to Next Paint) | ___ ms | <200ms | — |
| **TBT** (Total Blocking Time) | ___ ms | <200ms | — |
| **Performance Score** | ___ / 100 | ≥85 | — |

### 2.2 Lighthouse Mobile

**Steps:**
1. Repeat above with Device: Mobile
2. Throttling: Simulated Slow 4G
3. **Record metrics** (same table, separate row)

**Expected Results:**
- Mobile LCP: <2.5s (may be slower than desktop)
- Mobile CLS: <0.1 (same threshold)
- Mobile TBT: <200ms (may spike on interaction)

### 2.3 Real Interaction Profiling (Terminal + Profiling Views)

**For Terminal View:**
1. Open DevTools > Performance tab
2. Click "Record"
3. In Terminal:
   - Type 5 commands and press Enter
   - Wait for output to render
4. Stop recording after 10 seconds
5. **Analyze:**
   - Look for "Long tasks" (yellow/red bars >50ms)
   - Check "Main" thread utilization (should peak then quiet)
   - **Flag any:**
     - Task >200ms (TBT violation)
     - Layout shift (CLS > 0.1)

**For Profiling View:**
1. Repeat with Profiling Dashboard
2. Watch charts update for 10 seconds
3. **Check:**
   - Recharts rendering time (should be <50ms)
   - No jank during hover/interaction
   - React Query polling doesn't block UI

### 2.4 Memory Leak Detection

**Steps:**
1. DevTools > Memory tab
2. Take heap snapshot (baseline)
3. Interact for 2 minutes: click buttons, toggle views, scroll
4. Take another snapshot
5. **Analyze:**
   - Compare detached DOM nodes (should not grow)
   - Check for large objects retained

**Expected:**
- Detached DOM: <5 nodes
- Heap growth: <10% over 2 min

---

## PHASE 3: RESPONSIVENESS TESTING

### 3.1 Desktop Breakpoint Testing (1440px)

**Steps:**
1. DevTools > Viewport: set to **1440px wide**
2. Visit each view: Control Panel, Profiling, Terminal
3. **For each view, verify:**

| Element | Passes | Notes |
|---------|--------|-------|
| Sidebar visible | ☐ | Should not collapse at 1440px |
| Main content not clipped | ☐ | No horizontal scroll |
| Charts render fully | ☐ | Recharts ResponsiveContainer works |
| Input fields accessible | ☐ | All form elements visible |
| Buttons clickable | ☐ | No overlapping or hidden buttons |

### 3.2 Tablet Breakpoint Testing (1024px)

**Steps:**
1. Set viewport to **1024px wide**
2. Repeat element verification above
3. **Tablet-specific:**

| Element | Expected | Result |
|---------|----------|--------|
| Sidebar | Visible (not collapsed) | ☐ |
| Charts layout | Grid 2-col (or stacked) | ☐ |
| Modals | Full-width with padding | ☐ |
| Terminal history | Bottom drawer (not sidebar) | ☐ |

### 3.3 Tablet Vertical Breakpoint Testing (768px)

**Steps:**
1. Set viewport to **768px wide**
2. **Verify:**
   - Sidebar collapses or becomes drawer
   - Toggle button visible (hamburger icon)
   - Charts in 1-col layout
   - No horizontal scroll

### 3.4 Mobile Breakpoint Testing (360px)

**Critical test: smallest phones**

**Steps:**
1. Set viewport to **360px wide, 800px tall** (Pixel 5)
2. **For each view:**

| Element | Check | Pass/Fail |
|---------|-------|-----------|
| **Control Panel** | Sliders fit without overflow | ☐ |
| | Buttons ≥44px height | ☐ |
| | Text readable (not squished) | ☐ |
| **Profiling** | Metrics grid: 2 columns | ☐ |
| | Charts: single column, readable | ☐ |
| | Live badge visible | ☐ |
| **Terminal** | Input field ≥44px tall | ☐ |
| | Output scrolls vertically | ☐ |
| | History toggle button visible | ☐ |
| | No horizontal scroll | ☐ |

**Font size check:**
- Title text: ≥16px (readable)
- Body text: ≥14px (readable)
- Labels: ≥12px (readable)

---

## PHASE 4: CROSS-DEVICE TESTING

### 4.1 Real Device Testing (Physical)

**If possible, test on:**
- iPhone 12 or 13 (iOS Safari)
- Android phone (Chrome)

**Steps on each device:**
1. Navigate to app URL (staging/dev)
2. Visit Control Panel
3. Verify:
   - [ ] Text renders clearly (no blurry fonts)
   - [ ] Buttons are tappable (≥44pt targets)
   - [ ] Sidebar toggle works (swipe or button)
   - [ ] Modals don't overflow screen
4. Visit Terminal
5. Verify:
   - [ ] Input keyboard appears (doesn't cover input)
   - [ ] Output is scrollable
   - [ ] Commands execute
6. Visit Profiling
7. Verify:
   - [ ] Charts render
   - [ ] Live badge visible
   - [ ] Metrics update

### 4.2 Browser Compatibility (Desktop)

**Test on:**
- [ ] Chrome (latest)
- [ ] Safari (latest)
- [ ] Firefox (latest)
- [ ] Edge (latest)

**For each browser:**
1. Load Control Panel
2. Verify:
   - [ ] Sliders work (drag + keyboard)
   - [ ] Colors display correctly (no oversaturation)
   - [ ] Focus ring visible (Tab key)
3. Load Terminal
4. Verify:
   - [ ] Monospace font rendering (JetBrains Mono)
   - [ ] ANSI colors (if implemented) display
5. Load Profiling
6. Verify:
   - [ ] Charts render (Recharts compatibility)
   - [ ] Animations smooth

**Known issues to check:**
- Safari: focus-ring may need `-webkit-` prefix
- Firefox: Radix popover may render differently
- Edge: should be identical to Chrome

---

## PHASE 5: ACCESSIBILITY AUDIT

### 5.1 Axe Automated Scan

**Steps:**
1. Open each view (Control Panel, Profiling, Terminal)
2. DevTools > Axe DevTools extension > Scan
3. **Expected results:**
   - [ ] 0 Critical violations
   - [ ] 0 Serious violations
   - [ ] ≤ 5 Moderate issues (acceptable)
4. **Record any failures:**
   - Issue name
   - Element path
   - Recommended fix

### 5.2 Color Contrast Check (Manual)

**Using WebAIM Contrast Checker:**

**Test pairs:**
1. **Text primary on canvas (dark):**
   - Foreground: `var(--foreground)` = oklch(0.985 0 0) (near-white)
   - Background: `var(--background)` = oklch(0.145 0 0) (near-black)
   - Expected contrast: ≥18:1 ✅ AAA

2. **Muted text on canvas (dark):**
   - Foreground: `var(--muted-foreground)` = oklch(0.708 0 0)
   - Background: `var(--background)` = oklch(0.145 0 0)
   - Expected contrast: ≥4.5:1 ✅ AA

3. **Error color on background:**
   - Foreground: `var(--destructive)` = oklch(0.396 0.141 25.723) (dark mode)
   - Background: `var(--background)` = oklch(0.145 0 0)
   - **Flag if < 4.5:1** ⚠️ (use `--prism-error` with icon instead)

**Steps to measure:**
1. Extract hex or oklch value from element (DevTools > Computed Styles)
2. Paste foreground + background into WebAIM Contrast Checker
3. Record ratio
4. **Result:** Pass (≥7:1 AA) or Fail

### 5.3 Keyboard Navigation (Manual)

**Control Panel View:**
1. Focus first element: Tab key
2. Expected: Effect selector button has focus ring
3. Continue Tab through:
   - [ ] Effect selector (Tab)
   - [ ] Mode buttons (Tab)
   - [ ] Parameter sliders (Tab → Arrow keys to adjust)
   - [ ] Color presets (Tab)
   - [ ] Settings (Tab)
4. **Verify:**
   - [ ] Focus ring visible (2–3px, var(--ring) color)
   - [ ] Tab order is logical (left to right, top to bottom)
   - [ ] No focus trap (can Tab out and back)
   - [ ] Enter/Space works on buttons

**Terminal View:**
1. Focus terminal output: Tab (should skip to input)
2. Type command: "ls"
3. Press Tab: **Expected:** autocomplete suggestions appear
4. Press Esc: **Expected:** autocomplete closes
5. Press ↑: **Expected:** previous command in history appears
6. Press Enter: **Expected:** command executes

**Profiling View:**
1. Tab to Pause button
2. Press Space: **Expected:** pause state toggles, Live badge disappears
3. Tab to metric tile (if interactive)
4. Press Enter: **Expected:** any action occurs (expand, drill-down, etc.)

### 5.4 Screen Reader Testing (if possible)

**Using macOS VoiceOver or Windows Narrator:**

**Control Panel:**
1. Enable screen reader
2. Activate Control Panel
3. **Expected announcements:**
   - "Control Panel, region"
   - "Effect Selector, tab list, 3 tabs"
   - "Pattern mode, tab, 1 of 3, selected"
   - "Parameter slider, volume, 75 percent, 0 to 100"

**Terminal:**
1. Enable screen reader
2. Activate Terminal
3. **Expected announcements:**
   - "Terminal, log region, live, polite"
   - "Command input, edit text"
   - "Command history list, 5 items"

**Profiling:**
1. Enable screen reader
2. **Expected announcements:**
   - "Metrics grid, 5 items"
   - "CPU Usage metric tile, 42 point 5 percent, up trend, warning tone"
   - "Live badge, live monitoring, status"

### 5.5 Focus Visibility Check

**Steps:**
1. Press Tab repeatedly throughout app
2. **For each focused element:**
   - [ ] Focus ring is visible (2–3px outline)
   - [ ] Focus ring color is high-contrast (var(--ring))
   - [ ] Ring does not obscure the element

**Known issues:**
- If ring is hard to see, check CSS: `focus-visible:ring-2 focus-visible:ring-ring`
- If missing, add globally: `*:focus-visible { outline: 2px solid var(--ring); }`

---

## PHASE 6: INTERACTION TESTING

### 6.1 Button Interactions

**For each button (Control Panel, Settings, Profiling Pause, Terminal Clear, etc.):**

| Interaction | Expected | Result |
|-------------|----------|--------|
| Mouse click | Action triggers | ☐ |
| Keyboard (Enter/Space) | Action triggers | ☐ |
| Focus ring visible | Ring appears on Tab | ☐ |
| Hover state | Color changes (if applicable) | ☐ |
| Disabled state | No click, dimmed | ☐ |

### 6.2 Slider Interactions (Control Panel)

**For each parameter slider:**

| Interaction | Expected | Result |
|-------------|----------|--------|
| Mouse drag | Value changes smoothly | ☐ |
| Click on track | Thumb jumps to click position | ☐ |
| Left/Right arrow | Value +/- 1 step | ☐ |
| Shift+Arrow | Value +/- 10 steps | ☐ |
| Home key | Jump to min | ☐ |
| End key | Jump to max | ☐ |
| Input validation feedback | Shows "✓" or "✗" | ☐ |
| Real-time preview | LED visualization updates | ☐ |

### 6.3 Tab Panel Interactions

**For Tabs component (if used in Control Panel or Analysis):**

| Interaction | Expected | Result |
|-------------|----------|--------|
| Click tab | Content switches instantly | ☐ |
| Left/Right arrow | Switch to prev/next tab | ☐ |
| Home key | Jump to first tab | ☐ |
| End key | Jump to last tab | ☐ |
| Active tab highlighted | Color/underline visible | ☐ |
| aria-selected attribute | Present on active tab | ☐ |

### 6.4 Dropdown / Select Interactions

**For any dropdowns (Mode Selector, Effect Selector, etc.):**

| Interaction | Expected | Result |
|-------------|----------|--------|
| Click to open | Dropdown expands | ☐ |
| Hover items | Item highlights | ☐ |
| Click item | Selection updates, dropdown closes | ☐ |
| Arrow keys | Navigate items up/down | ☐ |
| Escape | Dropdown closes | ☐ |
| Tab away | Dropdown closes | ☐ |

### 6.5 Chart Interactions (Profiling)

**For Recharts components (FrequencyChart, BeatGridChart, DynamicsChart):**

| Interaction | Expected | Result |
|-------------|----------|--------|
| Hover (desktop) | Tooltip appears | ☐ |
| Hover (mobile) | N/A (use legend instead) | ☐ |
| Legend click | Series toggles on/off | ☐ |
| Zoom button (if present) | Chart zooms to range | ☐ |
| Pan (if enabled) | Chart shifts | ☐ |
| Accessible? | figure role="img" + caption | ☐ |

### 6.6 Terminal Interactions

**Steps:**
1. Type command: "ls /patterns"
2. Press Tab: **Expected:** autocomplete suggestions appear
3. Press ↓: **Expected:** next suggestion highlights
4. Press Enter: **Expected:** command executes (API call)
5. Wait for output: **Expected:** result appears below command
6. Press ↑: **Expected:** previous command in history
7. Press Ctrl+L (or command): **Expected:** output clears
8. Verify history drawer (desktop): **Expected:** all commands listed

---

## PHASE 7: THEMING & DARK MODE

### 7.1 Light Mode Validation

**Steps:**
1. Ensure `.dark` class is NOT on `<html>` element
2. DevTools > Computed Styles check token values:
   - [ ] `--background` = `#ffffff`
   - [ ] `--foreground` = oklch(0.145 0 0) (near-black)
   - [ ] `--primary` = `#030213` (dark)
3. Verify colors:
   - [ ] Canvas backgrounds are white/light
   - [ ] Text is dark/readable
   - [ ] Accent colors (blue, green, etc.) are visible
4. Check all views render in light mode

### 7.2 Dark Mode Validation

**Steps:**
1. Toggle theme (find theme toggle button)
2. Verify `class="dark"` appears on `<html>` element
3. DevTools > Computed Styles check token values:
   - [ ] `--background` = oklch(0.145 0 0) (dark)
   - [ ] `--foreground` = oklch(0.985 0 0) (near-white)
   - [ ] `--primary` = oklch(0.985 0 0) (white)
4. Verify colors:
   - [ ] Canvas backgrounds are dark
   - [ ] Text is light/readable
   - [ ] Sidebar is dark
   - [ ] Charts use dark theme colors (chart-1..8)
5. Check all views render in dark mode
6. **No flashing:** verify dark mode persists on page reload (uses localStorage or session)

### 7.3 Contrast in Both Themes

**Light mode:**
- [ ] Primary text on background: ≥18:1 (AAA)
- [ ] Muted text on background: ≥4.5:1 (AA)

**Dark mode:**
- [ ] Primary text on background: ≥18:1 (AAA)
- [ ] Muted text on background: ≥4.5:1 (AA)
- [ ] Prism colors (success, error, info) on dark canvas: ≥4.5:1 (AA)

---

## PHASE 8: DATA VALIDATION & EDGE CASES

### 8.1 Form Validation (Control Panel)

**For each parameter input:**

| Case | Input | Expected Result |
|------|-------|-----------------|
| Valid value | "75" (within range) | ✓ Applied, no error |
| Out of range (low) | "-10" | ✗ Error: "Min is 0" |
| Out of range (high) | "150" (max is 100) | ✗ Error: "Max is 100" |
| Non-numeric | "abc" | ✗ Error: "Must be a number" |
| Empty | "" | ✗ Error: "Required" |
| Zero | "0" | ✓ Applied (if valid range) |
| Decimal | "42.5" | ✓ or ✗ (depends on spec) |

### 8.2 Terminal Edge Cases

**Test:**
1. **Empty command:** Press Enter with no input
   - Expected: No error, prompt reappears
2. **Very long command:** Paste 500+ character line
   - Expected: Input scrolls horizontally (or wraps)
3. **Special characters:** `$ echo "hello\nworld"`
   - Expected: Newline renders in output
4. **ANSI colors:** `$ echo -e "\033[32mGreen\033[0m"`
   - Expected: Output is green (if ANSI supported)
5. **Rapid commands:** Type 10 commands in quick succession
   - Expected: No dropped commands, all execute

### 8.3 Charts with Large Datasets

**For Profiling Charts:**

1. **Many data points:** 10K+ samples
   - Expected: Chart still renders within 2s
   - No browser freeze
2. **Zoom on large dataset:** Click zoom button
   - Expected: Zoomed range renders
3. **Export data:** (if available) Click "Export CSV"
   - Expected: File downloads with all data

---

## PHASE 9: ERROR HANDLING & RECOVERY

### 9.1 API Errors

**Simulate network issues:**

**Steps:**
1. DevTools > Network tab
2. Throttle to "Offline"
3. In Control Panel:
   - [ ] Try to apply a parameter change
   - [ ] Expected: Error toast appears
   - [ ] Error message is clear (not technical jargon)
   - [ ] User can retry

4. In Terminal:
   - [ ] Try to execute command
   - [ ] Expected: Error message in output
   - [ ] User can continue typing

5. In Profiling:
   - [ ] Live data stops updating
   - [ ] Expected: "Offline" badge or message
   - [ ] Data doesn't stale (show "last update: 30s ago")

### 9.2 Timeout Handling

**Simulate slow response (throttle to Slow 4G):**
1. In Control Panel, drag slider and release
2. Expected: Loading spinner appears
3. After 10s timeout: Error toast with "Try again" button
4. Click retry: Request repeats

---

## PHASE 10: PERFORMANCE UNDER LOAD

### 10.1 Sustained Interaction (Terminal)

**Steps:**
1. Open Terminal
2. Execute 100 commands rapidly (Ctrl+Enter spamming)
3. Monitor DevTools > Performance
4. **Check:**
   - [ ] No memory leak (heap should stabilize)
   - [ ] No frame drops (FPS should stay ≥30)
   - [ ] Output remains responsive

### 10.2 Live Data Updates (Profiling)

**Steps:**
1. Open Profiling Dashboard
2. Let it run for 5 minutes with live data
3. Monitor DevTools > Performance
4. **Check:**
   - [ ] Smooth updates (no jank)
   - [ ] Memory stable (no leaks)
   - [ ] CPU usage reasonable (<50% on single core)

---

## CHECKLIST TEMPLATE

Print or copy this checklist for each test session:

```
TEST SESSION: _________________ (Date/Time)
TESTER: ________________________
ENVIRONMENT: Dev ☐ | Staging ☐ | Production ☐

## PERFORMANCE
[ ] Lighthouse Desktop FCP: ___ ms (Target <1.8s)
[ ] Lighthouse Desktop LCP: ___ ms (Target <2.5s)
[ ] Lighthouse Desktop CLS: ___ (Target <0.1)
[ ] Lighthouse Desktop Performance Score: __/100 (Target ≥85)
[ ] Lighthouse Mobile FCP: ___ ms (Target <1.8s)
[ ] Lighthouse Mobile LCP: ___ ms (Target <2.5s)
[ ] Terminal Profile: No TBT violations
[ ] Profiling Profile: Charts render <50ms

## RESPONSIVENESS
[ ] 1440px: Sidebar visible, no overflow
[ ] 1024px: Sidebar visible, charts 2-col
[ ] 768px: Sidebar collapses, charts 1-col
[ ] 360px: No horizontal scroll, ≥44px touch targets

## ACCESSIBILITY
[ ] Axe scan: 0 Critical, 0 Serious
[ ] Color contrast: All pairs ≥4.5:1 AA
[ ] Keyboard nav: Tab through all views
[ ] Focus ring: Visible on all interactive elements
[ ] Screen reader (if tested): Landmarks + labels announced

## INTERACTIONS
[ ] Buttons: Click + keyboard (Enter/Space)
[ ] Sliders: Drag + keyboard (Arrow keys)
[ ] Tabs: Click + arrow keys
[ ] Charts: Hover tooltips + legend toggles
[ ] Terminal: Input, autocomplete, history, execution

## THEMING
[ ] Light mode: Renders, colors correct
[ ] Dark mode: Renders, colors correct, persists on reload
[ ] Contrast both themes: ≥4.5:1 AA

## CROSS-DEVICE (if tested)
[ ] iPhone: Text readable, buttons tappable, modals fit
[ ] Android: Text readable, buttons tappable, performance OK
[ ] Chrome: Works
[ ] Safari: Works
[ ] Firefox: Works
[ ] Edge: Works

## ERROR HANDLING
[ ] Network error: Toast + retry button
[ ] Timeout: Error message, user can retry
[ ] Invalid input: Clear error message

## NOTES
_____________________________________________________________________________
_____________________________________________________________________________

## SIGN-OFF
Tester: _______________ Date: _____ Pass ☐ | Fail ☐ (Re-test needed)
```

---

## REPORTING TEMPLATE

**For each failure, create a bug report:**

```
TITLE: [COMPONENT] [ACTION] [EXPECTED vs ACTUAL]
Example: [Control Panel] [Slider drag on 360px] [Text should not wrap but does]

SEVERITY: Critical ☐ | High ☐ | Medium ☐ | Low ☐

ENVIRONMENT:
- OS: ___________
- Browser: ___________
- Viewport: ___________

STEPS TO REPRODUCE:
1. ___________
2. ___________
3. ___________

EXPECTED RESULT:
___________

ACTUAL RESULT:
___________

SCREENSHOT/VIDEO:
[Attach]

RELATED AUDIT ITEM:
[Reference from improvement proposals, e.g., "#4 Touch-Optimize Sliders"]
```

---

## SUCCESS CRITERIA (Go/No-Go)

**MUST PASS to ship:**
- [ ] Lighthouse desktop Performance ≥85
- [ ] Lighthouse mobile Performance ≥75
- [ ] Axe: 0 critical violations
- [ ] No horizontal scroll at 360px
- [ ] Touch targets ≥44px on mobile
- [ ] Keyboard nav works on all views
- [ ] Dark mode works + persists

**SHOULD PASS (nice-to-have):**
- [ ] Lighthouse mobile Performance ≥85
- [ ] CLS <0.05 (very good)
- [ ] INP <100ms (excellent responsiveness)
- [ ] Real device testing on iOS + Android
- [ ] Screen reader testing passes

---

## Next Steps After Validation

1. **Fix failures:** Use improvement proposals as guide
2. **Re-test:** Run this playbook again
3. **Document:** Update KNOWN_ISSUES.md with any acceptable edge cases
4. **Deploy:** Merge to staging/production once all must-pass criteria met
5. **Monitor:** Set up Sentry/LogRocket to catch runtime errors post-launch

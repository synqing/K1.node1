# Tab5 UI Control Adaptation - Quick Reference

**Date:** 2025-11-05  
**Based On:** `webapp_parameter_display_analysis.md`  
**Purpose:** Fast lookup guide for Tab5 controller design decisions

---

## LAYOUT CHANGES

| Aspect | Webapp (Desktop) | Tab5 (Tablet) | Rationale |
|--------|-----------------|---------------|-----------|
| Grid Layout | 3-column (400px/1fr/320px) | 2-column (450px/1fr) | Arm's-length visibility |
| Gap Size | 6 (24px) | 4 (16px) | Compress to fit smaller screen |
| Panel Padding | p-6 (24px) | p-4 (16px) | Reduce whitespace overhead |
| Pattern Grid | 4-5 columns | 3 columns | Larger card touch targets |
| Palette Grid | 4 columns | 4 columns (fixed) | Keep consistent, increase height |
| Status Bar | 12px height | 16px height | Improve readability |

---

## COMPONENT SIZING FOR TOUCH

| Component | Webapp | Tab5 | Change |
|-----------|--------|------|--------|
| Slider Thumb | 4px (w/h) | 8px (w/h) | +100% for easier touch |
| Pattern Card | ~120×140px | ~140×160px | Larger icons (text-xl) |
| Palette Swatch | 70×80px | 80×90px | Taller color strips (h-6) |
| Button Height | 32px (py-2) | 48px (py-3) | WCAG 48px minimum |
| Text Size (labels) | text-xs (12px) | text-xs (12px) | Keep consistent |
| Text Size (values) | text-xs (12px) | text-sm (14px) | Improve readability |
| Text Size (headings) | text-sm (14px) | text-base (16px) | Arm's-length clarity |

---

## REUSABLE WEBAPP COMPONENTS

### 1. ParamSlider (DIRECT REUSE - No Changes)
```
Location: /webapp/src/components/control/ParamSlider.tsx
Current Features:
- Slider + numeric input + reset button
- Touch-optimized (onPointerDown/Up)
- Keyboard navigation (arrow keys)
- 0-100% range with step=1
- Displays "Adjusting..." feedback

Just increase thumb size to 8px via CSS override
```

### 2. ColorManagement (REUSE + ADAPT)
```
Location: /webapp/src/components/control/ColorManagement.tsx
Keep:
- 4-column palette grid
- HSV slider structure
- Color preview swatch

Adapt:
- Increase palette card height (h-6 color strip vs. h-4)
- Abbreviate palette names (max 12 chars)
- Increase touch target to 48px minimum
```

### 3. GlobalSettings (REUSE + MINOR ADJUST)
```
Location: /webapp/src/components/control/GlobalSettings.tsx
Keep:
- 5 controls (brightness, background, softness, warmth, dithering)
- Icon + label + slider pattern
- Lucide icons

Adjust:
- Increase space-y-5 → space-y-4 (tighter packing)
- Increase button/toggle heights (py-3 vs py-2)
- Switch widget: height 24px (vs default 20px)
```

### 4. ModeSelectors (ADAPT LAYOUT)
```
Location: /webapp/src/components/control/ModeSelectors.tsx
Current: 3 buttons in horizontal flex row
Problem: Tight spacing on small screen

Tab5 Adaptation:
- Keep horizontal layout but use flex-wrap if needed
- Increase button height to py-3 (48px total with padding)
- Increase font size in countdown (text-lg vs text-xs)
- Keep calibration logic as-is
```

### 5. StatusBar (MOVE + ENLARGE)
```
Location: /webapp/src/components/control/StatusBar.tsx
Adapt:
- Increase height from 12px → 16px or move to sidebar
- Increase icon size (w-5 h-5 vs w-4 h-4)
- Increase text size (text-sm values vs text-xs)
- Consider landscape: move to right sidebar + vertical layout
```

---

## DESIGN TOKENS TO INHERIT

All from `/webapp/src/styles/globals.css`:

### Backgrounds
```
--prism-bg-canvas:    #1c2130  (main background)
--prism-bg-surface:   #252d3f  (panels)
--prism-bg-elevated:  #2f3849  (borders, elevated)
```

### Text
```
--prism-text-primary:   #e6e9ef  (main)
--prism-text-secondary: #b5bdca  (labels)
```

### Semantic
```
--prism-success:  #22dd88  (good, audio on)
--prism-warning:  #f59e0b  (caution)
--prism-error:    #ef4444  (problem)
--prism-info:     #6ee7f3  (selection, interactive)
--prism-gold:     #ffb84d  (important, settings)
```

### Fonts
```
Primary:   system-ui, sans-serif
Monospace: JetBrains Mono (imported via Google Fonts)
Weights:   400 (normal), 500 (medium), 600 (semibold)
```

---

## VISUAL PATTERNS TO REPLICATE

### Selection Indicator
```
Current: Cyan glow + border + text color
  border-[var(--prism-info)]
  shadow-[0_0_12px_var(--prism-info)]/20
  from-[var(--prism-info)]/10 to-[var(--prism-info)]/5

Copy exactly as-is for consistency
```

### Loading/Pending State
```
Current: Pulsing opacity + Loader2 icon overlay
  animate-pulse
  <Loader2 className="animate-spin" />

Keep this pattern for Tab5
```

### Status Colors
```
FPS:    >= 58 green | >= 50 orange | < 50 red
CPU:    < 50% green | < 75% orange | >= 75% red
Memory: < 70% green | < 85% orange | >= 85% red

Use same thresholds on Tab5
```

### Feedback Text
```
Current: "Adjusting..." (blue) during drag
         "Unsaved" badge
         "Defaults" badge

Keep on Tab5 for consistency
```

---

## PARAMETERS TO DISPLAY

### 13 Visual Parameters (from webapp)

1. **Brightness** (0-100%) - Slider
2. **Speed** (0-100%) - Slider
3. **Saturation** (0-100%) - Slider
4. **Warmth** (0-100%, Cool → Warm) - Slider with labels
5. **Softness** (0-100%) - Slider
6. **Background** (0-100%) - Slider
7. **Dithering** (on/off) - Toggle switch
8. **Hue** (0-360°) - Slider
9. **Saturation (HSV)** (0-100%) - Slider
10. **Value (brightness)** (0-100%) - Slider
11. **Audio Reactivity** (On/Off/Clipping) - Button group
12. **VU Floor Sensitivity** (50-98%) - Slider + calibrate button
13. **Pattern Selection** (grid) - Pattern card grid

### Display Order Priority
1. Pattern Selection (most important, left column)
2. Global Settings (brightness, softness, warmth) (center)
3. Color Controls (palette + HSV) (right)
4. Audio Settings (bottom of controls or separate panel)
5. Status Bar (footer, always visible)

---

## TOUCH TARGET SIZES

WCAG 2.5 Compliance minimum: 44×44px (physical)

### Tab5 Metrics
- Screen: 2560×1600px, 12" diagonal
- DPI: ~210 (approximate)
- 44px physical = ~92 physical pixels at screen DPI

### Application
```
Slider thumb:  8px (pointer-based, allow smaller)
Button:        48px height (flex-1 width)
Palette card:  ~80×90px (meets 44×44 minimum)
Pattern card:  ~140×160px (comfortable)
Toggle:        24px height × full width
```

---

## LAYOUT SKETCH FOR TAB5 PORTRAIT

```
┌─────────────────────────────────────────┐
│           Tab5 Controller UI            │
├────────────────────┬────────────────────┤
│   LEFT COLUMN      │   RIGHT COLUMN     │
│   (450px)          │   (fluid, ≥450px)  │
├────────────────────┼────────────────────┤
│ Pattern Selection  │ Global Settings    │
│ - 3-column grid    │ - 5 controls       │
│ - Icons text-xl    │ - Brightness       │
│ - 140×160px cards  │ - Background       │
│                    │ - Softness         │
│                    │ - Warmth           │
│                    │ - Dithering        │
│                    │                    │
│                    │ Color Management   │
│                    │ - Palette grid 4x  │
│                    │ - 80×90px swatches │
│                    │ - HSV controls     │
│                    │                    │
│                    │ Audio Settings     │
│                    │ - Reactivity (3btn)│
│                    │ - Sensitivity      │
│                    │ - Calibrate button │
├────────────────────┴────────────────────┤
│     Status Bar (16px height)            │
│  FPS | CPU | Memory | Frame Time        │
└─────────────────────────────────────────┘
```

---

## LANDSCAPE ORIENTATION (Optional)

```
┌───────────────────────────────────────────────────────────────┐
│ Pattern Selection │ Global Settings      │ Status + Color      │
│ 3-col grid       │ Stacked controls     │ Sidebar (vertical)  │
│ 140×160px cards  │ Brightness...        │ FPS: 60.0          │
│                  │ Calibrate button     │ CPU: 45.2%         │
│                  │                      │ Memory: 78.3%      │
│                  │                      │                     │
│                  │                      │ Palette Grid (4x)  │
│                  │                      │ 80×90px swatches   │
└───────────────────────────────────────────────────────────────┘
```

---

## COLOR USAGE REFERENCE

### When to Use Each Color

| Color | Used For | Example |
|-------|----------|---------|
| `--prism-info` (cyan) | Selection, focus, active state | Selected pattern/palette border |
| `--prism-success` (green) | Good metrics, audio on | FPS ≥ 58, CPU < 50% |
| `--prism-warning` (amber) | Caution, medium load | FPS 50-57, CPU 50-75% |
| `--prism-error` (red) | Problem, high load | FPS < 50, CPU ≥ 75% |
| `--prism-gold` (orange) | Important, settings | Settings icon, reset button |
| `--prism-text-primary` | Main labels, headings | "Brightness", "Audio Reactivity" |
| `--prism-text-secondary` | Helper text, descriptions | "0-100%", "Cool" ↔ "Warm" |

---

## QUICK CHECKLIST FOR TAB5 UI IMPLEMENTATION

- [ ] Create Tab5 layout wrapper (2-column grid)
- [ ] Import ParamSlider component (no changes needed)
- [ ] Import PRISM design tokens from globals.css
- [ ] Copy ColorManagement component (adapt height: h-4 → h-6)
- [ ] Copy GlobalSettings component (adapt spacing)
- [ ] Copy ModeSelectors component (adapt button height)
- [ ] Adapt PatternSelector to 3-column grid
- [ ] Increase slider thumb size to 8px
- [ ] Increase button heights to 48px (py-3)
- [ ] Increase text sizes (headings text-base, values text-sm)
- [ ] Test touch targets (min 44×44px physical)
- [ ] Verify readability at 12" arm's-length viewing
- [ ] Test on both portrait and landscape orientations
- [ ] Verify WCAG contrast ratios (4.5:1 AA minimum)

---

## FILE CROSS-REFERENCES

### Files to Copy (No Changes)
- `/webapp/src/components/control/ParamSlider.tsx`
- `/webapp/src/components/ui/slider.tsx`
- `/webapp/src/components/ui/label.tsx`
- `/webapp/src/components/ui/button.tsx`
- `/webapp/src/components/ui/switch.tsx`

### Files to Adapt
- `/webapp/src/components/control/ColorManagement.tsx`
- `/webapp/src/components/control/GlobalSettings.tsx`
- `/webapp/src/components/control/ModeSelectors.tsx`
- `/webapp/src/components/control/PatternSelector.tsx`

### Files to Import (No Changes)
- `/webapp/src/styles/globals.css` (CSS variables)
- `/webapp/src/lib/parameters.ts` (types, constants)
- `/webapp/src/lib/types.ts` (enums, interfaces)

---

## PERFORMANCE NOTES

### Webapp Baseline
- Main layout: 3-column grid with flex-1 content area
- Scrolling: overflow-y-auto on center panel
- Re-renders: Coalesced parameter updates (80ms window)
- Status polling: 2Hz (500ms interval)

### Tab5 Target
- Maintain <5% CPU overhead for UI rendering
- Keep 60fps slider interactions (use RAF)
- Batch updates via coalescing (same as webapp)
- Status polling: 1Hz (1000ms interval, arm's-length visibility)

---

## NEXT STEPS

1. **Deep Dive:** Read full analysis in `webapp_parameter_display_analysis.md`
2. **Component Audit:** Review `/webapp/src/components/control/*.tsx` files
3. **Design Decisions:** Create Tab5-specific layout component
4. **Testing:** Validate touch targets and readability on Tab5 hardware
5. **Iteration:** Gather user feedback on arm's-length control ease

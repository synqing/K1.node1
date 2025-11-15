# Webapp UI Parameter Display & Control Analysis

**Date:** 2025-11-05  
**Scope:** K1 webapp UI layout, component structure, visual hierarchy, and design patterns for Tab5 adaptation  
**Files Analyzed:**
- `/webapp/src/components/views/ControlPanelView.tsx` (main layout)
- `/webapp/src/components/control/*` (parameter controls)
- `/webapp/src/lib/parameters.ts` (parameter definitions)
- `/webapp/src/styles/globals.css` (design tokens)

---

## 1. CURRENT PARAMETER DISPLAY LAYOUT

### Layout Architecture (Desktop)

The ControlPanelView uses a **3-column grid layout** optimized for large screens:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Control Panel View (Desktop)                 │
├──────────────────┬──────────────────────┬──────────────────────┤
│  LEFT (400px)    │  CENTER (fluid)      │  RIGHT (320px)       │
│ - Pattern Sel.   │ - Effect Parameters  │ - Color Management   │
│ - Grouped grid   │ - Speed slider       │ - Palette grid 4x1   │
│                  │ - Effect-specific    │ - HSV sliders        │
│                  │   parameters         │ - Global Settings    │
│                  │   (6 sliders)        │ - Audio Reactivity   │
├──────────────────┼──────────────────────┼──────────────────────┤
│  FULL WIDTH STATUS BAR (h=12, persistent footer)                 │
│  FPS | CPU | Memory | Frame Time | Effect Time                  │
└─────────────────────────────────────────────────────────────────┘
```

**Grid CSS:** `grid-cols-[400px_1fr_320px] gap-6 p-6`

### Layout Priority & Information Hierarchy

1. **Most Important (Center):** Effect Parameters - primary control focus
2. **Secondary (Left):** Pattern/Effect Selection - context setting
3. **Tertiary (Right):** Color & Global Settings - less frequently adjusted
4. **Status (Bottom):** Performance metrics - always visible, never scrolls

---

## 2. PARAMETER DISPLAY COMPONENTS

### 2.1 Effect Parameters (Center Panel)

**File:** `/webapp/src/components/control/EffectParameters.tsx`

**Current Display:**
- Dynamic parameter count per effect (0 to N parameters)
- Each parameter shown as: Label + Slider + Value + Unit
- Layout: vertical stack (space-y-5)

**Component Structure:**
```tsx
<div className="space-y-4">
  <div>
    <h3 className="text-sm font-medium">Effect Parameters</h3>
    <p className="text-xs text-secondary">{effect.description}</p>
  </div>

  {effect.parameters.map(param => (
    <div key={param.name} className="space-y-2">
      {/* Label row: param name + current value */}
      <div className="flex items-center justify-between">
        <Label className="text-xs" style={{color: getTypeColor(param.type)}}>
          {param.name}
        </Label>
        <span className="text-xs font-jetbrains">
          {value}{unit}
        </span>
      </div>
      
      {/* Slider */}
      <Slider min={param.min} max={param.max} value={[value]} />
      
      {/* Range labels */}
      <div className="flex justify-between text-xs secondary">
        <span>{param.min}{unit}</span>
        <span>{param.max}{unit}</span>
      </div>
    </div>
  ))}
</div>
```

**Visual Spacing:**
- Parameter container: `space-y-5` (20px between params)
- Label+value row: flex with `justify-between`
- Slider: custom height `h-2` with `w-4 h-4` thumb
- Min/max labels: `text-xs` secondary text

**Text Sizes:**
- Parameter name: `text-xs` (12px) - medium weight
- Current value: `text-xs` font-jetbrains (12px, monospace)
- Min/max bounds: `text-xs` secondary (12px)

---

### 2.2 Global Settings (Right Panel)

**File:** `/webapp/src/components/control/GlobalSettings.tsx`

**Display Order (5 controls):**
1. **Dithering** (toggle switch) - binary control
2. **Brightness** (slider) - 0-100%
3. **Background** (slider) - 0-100%
4. **Softness** (slider) - 0-100%
5. **Color Warmth** (slider) - 0-100% (Cool ← → Warm)

**Component Structure (Slider):**
```tsx
<div className="space-y-2">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      {icon}
      <Label className="text-xs">{label}</Label>
    </div>
    <span className="text-xs font-jetbrains">{value}%</span>
  </div>
  
  <Slider min={0} max={100} step={1} value={[value]} />
  
  {/* Optional range labels for warmth only */}
  <div className="flex justify-between text-xs secondary">
    <span>Cool</span>
    <span>Warm</span>
  </div>
</div>
```

**Icons Used (Lucide):**
- Brightness: `<Zap />` (yellow-500)
- Background: `<Sparkles />` (blue-500)
- Softness: `<Gauge />` (green-500)
- Warmth: `<Palette />` (purple-500)

---

### 2.3 Color Management (Right Panel)

**File:** `/webapp/src/components/control/ColorManagement.tsx`

**Display Structure:**

```
┌─ Color Management ─────────────────┐
│ Header: Palette icon + title       │
├─ Preset Palettes ─────────────────┤
│ Grid: 4 columns                    │
│ ┌───┬───┬───┬───┐                  │
│ │ P1│ P2│ P3│ P4│  (each palette)  │
│ └───┴───┴───┴───┘                  │
│                                    │
│ Palette Card Layout:               │
│ - Color strip (5 colors stacked)   │
│ - Palette name (label)             │
│ - Selection indicator (glow)       │
│ - Edit mapping dropdown (optional) │
│                                    │
│ Edit mapping button (bottom right) │
├─ Manual HSV Control ──────────────┤
│ Hue slider:       0-360°           │
│ Saturation slider: 0-100%          │
│ Value slider:     0-100%           │
│ Color preview (visual swatch)      │
└────────────────────────────────────┘
```

**Palette Card:**
- Button with `p-2 rounded-lg border`
- Color preview: `flex gap-0.5 h-4` (5-color horizontal strip)
- Label: `text-xs`
- Selection: `border-color + shadow glow + colored text`
- Dimensions: ~70px wide × 80px tall (4-column grid with gap-2)

**HSV Sliders:**
- Hue: 0-360 (degrees)
- Saturation: 0-100 (percent)
- Value: 0-100 (percent)
- Each: Label + Numeric display + Slider + (optional range labels)

---

### 2.4 Pattern Selector (Left Panel)

**File:** `/webapp/src/components/control/PatternSelector.tsx`

**Display (when shown separately):**
- Grid of pattern cards
- Responsive: `grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`
- Each card: icon + name + description + badges (audio, CPU cost)
- Selection indicator: pulsing dot (top-right) + glow border

**Card Layout:**
```
┌──────────────────────┐
│ ┌─ Audio  CPU ┐      │ (top: badges)
│ │ (badges)    │      │
│ ┌──────────────────┐  │
│ │      🎵          │  │ (icon, text-2xl)
│ │ Pattern Name     │  │ (text-sm, line-clamp-1)
│ │ Description text │  │ (text-xs, line-clamp-2)
│ │  [Badges]        │  │
│ └──────────────────┘  │
│ ● (selected dot)     │ (top-right corner)
└──────────────────────┘
```

---

## 3. AUDIO SETTINGS DISPLAY

**File:** `/webapp/src/components/control/ModeSelectors.tsx`

### Audio Reactivity Controls

**Display Layout:**
```
┌─ Audio Reactivity ────────────────┐
│ Volume icon + label               │
│                                   │
│ ┌─────────┬─────────┬──────────┐ │
│ │   On    │  Off    │ Clipping │ │ (button row)
│ └─────────┴─────────┴──────────┘ │
│ (colored border on selected)      │
└───────────────────────────────────┘
```

**Buttons:**
- 3 buttons in flex row with `gap-2` each `flex-1`
- States: On (green), Off (gray), Clipping (red)
- Size: `px-3 py-2 rounded-lg text-xs font-medium`
- Selected: colored background + border + text
- Tooltips on hover (Radix)

### Sensitivity (VU Floor) Slider

**Display:**
```
┌─ Quiet-level sensitivity ────────┐
│ Label + "what's this?" tooltip    │
│ Calibrate button + countdown      │
│                                   │
│ [Slider: 50-98]  0.XX (numeric)  │
│ Countdown message (if active)     │
└───────────────────────────────────┘
```

**Calibration:**
- 3-second countdown before activation
- Button text: "Calibrate Noise" → "Starting in 3..." → "Calibrating..."
- Cancel button appears during countdown
- Slider disabled during calibration

---

## 4. STATUS/PERFORMANCE DISPLAY

**File:** `/webapp/src/components/control/StatusBar.tsx`

**Layout (12px height bar at bottom):**
```
┌─────────────────────────────────────────────────────────────┐
│ FPS: 60.0  │  CPU: 45.2%  │  Memory: 78.3%  │  FT: 16.67ms │
│            │              │                 │  Effect: 500μs│
└─────────────────────────────────────────────────────────────┘
```

**Metrics Displayed:**
- **FPS:** Color-coded (green ≥58, orange ≥50, red <50)
- **CPU:** Color-coded (green <50%, orange <75%, red ≥75%)
- **Memory:** Color-coded (green <70%, orange <85%, red ≥85%)
- **Frame Time:** ms (milliseconds)
- **Effect Time:** μs (microseconds)

**Update Rate:** 500ms (2Hz polling for real device data)

**Component Structure:**
- Icons: `Activity`, `Cpu`, `HardDrive` (Lucide, 4×4px)
- Text: `text-xs` secondary + `text-sm` colored value
- Separators: `h-4 w-px` dividers
- Font: `font-jetbrains` for metrics

---

## 5. COLOR MAPPING & SEMANTIC MEANING

### PRISM.node Design Tokens (globals.css)

**Structural Colors (Backgrounds):**
- `--prism-bg-canvas`: `#1c2130` (darkest, main background)
- `--prism-bg-surface`: `#252d3f` (panel/card background)
- `--prism-bg-elevated`: `#2f3849` (elevated panels, borders)

**Text Colors:**
- `--prism-text-primary`: `#e6e9ef` (main text, 89% brightness)
- `--prism-text-secondary`: `#b5bdca` (labels, 72% brightness)

**Semantic Colors:**
- `--prism-gold`: `#ffb84d` → Important, settings, highlights
- `--prism-success`: `#22dd88` → Good performance, active audio (green)
- `--prism-warning`: `#f59e0b` → Caution, moderate load
- `--prism-error`: `#ef4444` → Problems, high load, clipping
- `--prism-info`: `#6ee7f3` → Interactive, current selection (cyan)

**Data Type Colors (for parameters):**
- `--prism-scalar`: `#f59e0b` (amber, numeric values)
- `--prism-field`: `#22d3ee` (cyan, field data)
- `--prism-color`: `#f472b6` (pink, color parameters)
- `--prism-output`: `#34d399` (green, outputs)

### Color Usage Patterns

| Element | Color | Meaning |
|---------|-------|---------|
| Selected item border | `--prism-info` (cyan) | Active selection |
| Selected item glow | `--prism-info` /20 opacity | Visual feedback |
| High-importance icon | `--prism-gold` | Settings, global controls |
| Good status metric | `--prism-success` (green) | Healthy performance |
| Warning status | `--prism-warning` (amber) | Monitor but acceptable |
| Error status | `--prism-error` (red) | Problematic |
| Parameter labels | `--prism-[type]` | Type classification |
| Disabled state | Reduced opacity (40-60%) | Not interactive |

---

## 6. TYPOGRAPHY SPECIFICATIONS

### Font Families

**Primary Text:** System sans-serif (Tailwind default)
- Font stack: `ui-sans-serif, system-ui, sans-serif`
- Used for: Labels, descriptions, buttons, headings

**Monospace (Values):** JetBrains Mono
- Font stack: `JetBrains Mono` (Google Fonts)
- Weights: 400, 500, 600
- Used for: Numeric values, percentages, time metrics
- Class: `font-jetbrains`

### Text Sizing Scale

| Size | Class | Usage | Computed |
|------|-------|-------|----------|
| xs | `text-xs` | Labels, secondary text | 12px (0.75rem) |
| sm | `text-sm` | Headings, primary labels | 14px (0.875rem) |
| lg | `text-lg` | Section headings | 18px (1.125rem) |
| xl | `text-xl` | Page headings | 20px (1.25rem) |

### Font Weights

- Normal: 400 (body text, secondary info)
- Medium: 500 (labels, primary text)
- Semibold: 600 (headings, emphasis)

### Line Heights

- Text-xs: 1.0 (auto, tight)
- Text-sm: 1.43 (1.25 / 0.875)
- Text-lg: 1.56 (1.75 / 1.125)

### Label-to-Value Ratio

Webapp uses **compact labeling:**
- Label width: 60-120px (varying by parameter name)
- Value width: 30-50px (numeric with unit)
- Total control row: ~200-250px (flexible)
- Ratio: ~2:1 (label space : value space) in tight layout

---

## 7. VISUAL FEEDBACK PATTERNS

### Parameter Change Feedback

**During Drag:**
```tsx
{isDragging && (
  <span className="text-[var(--prism-info)] font-medium">
    Adjusting...
  </span>
)}
```

**State Indicators:**
- Blue text "Adjusting..." during active drag
- Monospace value display updates live
- Slider thumb visual feedback (hover scale, active color)

**Confirmation:**
- Toast notifications for firmware-applied bounds
- "Unsaved" badge until persisted
- "Defaults" badge when at default value

### Loading & Sync States

**Pattern Selection:**
- Pulsing opacity fade on pending card
- Loader2 spinner overlay (center of card)
- "Activating pattern..." banner with cancel button
- Toast on completion or error

**Audio Calibration:**
- Countdown timer (3...2...1)
- State text changes: "Calibrate Noise" → "Starting in X..."
- Disabled slider during calibration

### Transition Effects

- **Borders:** `transition-all` (200ms ease-out)
- **Scale:** `hover:scale-[1.02]` on cards
- **Opacity:** Fade on loading overlays
- **Shadows:** Dynamic shadow on selection

---

## 8. LAYOUT PATTERNS

### Responsive Design

**Desktop (ControlPanelView):**
- 3-column grid: `400px | 1fr | 320px`
- Full overflow-y-auto with p-6 padding
- Status bar sticky at bottom

**Mobile/Responsive:**
- Single-column stacking (via media queries in components)
- PatternSelector uses: `grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`
- Palette grid responsive: 4 columns → adaptive on smaller screens

### Spacing System

- **Container padding:** `p-6` (24px) on main panels, `p-4` on sub-panels
- **Between sections:** `gap-6` (24px) in column layouts
- **Between items:** `space-y-4` (16px) or `space-y-5` (20px)
- **Between inline items:** `gap-2` (8px) for icons/labels

### Scrolling & Overflow

- Main content: `flex-1 overflow-y-auto`
- Status bar: `sticky` at bottom with `border-t`
- No horizontal scroll (full container width)
- Panels use scrolling for excess content

### Card/Panel Structure

```css
/* Standard panel styling */
.bg-[var(--prism-bg-surface)]
.rounded-lg
.border border-[var(--prism-bg-elevated)]
.p-6 (or p-4 for compact)

/* Selected/Active state */
.border-[var(--prism-info)]
.bg-gradient-to-br from-[var(--prism-info)]/10 to-[var(--prism-info)]/5
.shadow-[0_0_12px_var(--prism-info)]/20
```

---

## 9. COMPONENT TYPES FOR EACH PARAMETER TYPE

### Slider-Based Parameters (Most Parameters)

**Component:** `ParamSlider` or `SimpleSlider`

**Structure:**
```tsx
<div className="space-y-3">
  {/* Header: icon + label + value + reset */}
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <span className="text-lg">{icon}</span>
      <Label className="text-sm font-medium">{label}</Label>
    </div>
    <div className="flex items-center gap-2">
      <Input type="number" className="w-16 h-7 text-xs" />
      {showReset && <Button size="sm" variant="ghost"><RotateCcw /></Button>}
    </div>
  </div>
  
  {/* Slider track */}
  <Slider min={0} max={100} step={1} value={[value]} />
  
  {/* Footer: description + status */}
  <div className="flex justify-between text-xs">
    <span className="text-secondary">{description}</span>
    <div className="flex items-center gap-2">
      {isDragging && <span className="text-info">Adjusting...</span>}
      <span className="font-mono">{formattedValue}</span>
      {isDefault && <span className="text-secondary">●</span>}
    </div>
  </div>
</div>
```

**Interactions:**
- Slider: smooth drag with live value update
- Number input: direct type-in with validation
- Reset button: return to default
- Keyboard: arrow keys (±1), shift+arrow (±10), Home/End

### Toggle Parameters

**Component:** `Switch` (Radix)

**Structure:**
```tsx
<div className="flex items-center justify-between">
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    <span className="text-xs secondary">{description}</span>
  </div>
  <div className="flex items-center gap-2">
    <span className="text-xs font-jetbrains">{value ? 'On' : 'Off'}</span>
    <Switch checked={value} onCheckedChange={onChange} />
  </div>
</div>
```

### Button Groups (Mode Selection)

**Component:** Custom button grid

**Structure:**
```tsx
<div className="flex gap-2">
  {modes.map(mode => (
    <button
      className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium
        ${isSelected 
          ? `bg-[color]/10 border-[color] text-[color]`
          : 'bg-elevated border-elevated'
        }`}
      onClick={() => onChange(mode)}
    >
      {mode.label}
    </button>
  ))}
</div>
```

### Color Picker

**Component:** Palette grid + HSV sliders

**Palette Grid:**
- 4 columns, 2-8 items
- Each: Color strip + label
- Selection: border glow + colored text

**HSV Controls:**
- 3 independent sliders
- Real-time color preview swatch
- Hex output

---

## 10. WHAT TO REUSE VS. WHAT TO ADAPT FOR TAB5

### REUSE AS-IS (High Transfer Value)

1. **ParamSlider Component**
   - Already optimized for touch (onPointerDown/Up events)
   - Number input + slider + reset button paradigm is effective
   - Keyboard navigation (arrow keys) works on small screens
   - Current 0-100% range and step=1 scales perfectly
   - File: `/webapp/src/components/control/ParamSlider.tsx`

2. **Color Palette Grid**
   - 4-column layout works on Tab5 (2560px ÷ 4 = ~640px per palette)
   - Grid structure is responsive-friendly
   - Palette cards are already accessible
   - File: `/webapp/src/components/control/ColorManagement.tsx`

3. **PRISM.node Design Tokens**
   - All CSS variables are theme-aware
   - Semantic color meanings (success/warning/error) already defined
   - Can be imported directly into Tab5 styles
   - File: `/webapp/src/styles/globals.css`

4. **Icons & Visual Hierarchy**
   - Lucide React icons scale well and remain readable at smaller sizes
   - Color coding (success/warning/error) is intuitive
   - Icon + label pattern is proven on mobile

5. **Status Bar Metrics**
   - FPS/CPU/Memory display format is clear
   - Color coding is consistent
   - Could be compacted for small screen display
   - File: `/webapp/src/components/control/StatusBar.tsx`

### ADAPT FOR TAB5 SMALL SCREEN

1. **Layout Changes**
   - **REMOVE 3-column grid:** Tab5 (2560×1600) can handle wide layout, but arm's-length viewing suggests **2-column** preferred
   - **Compress spacing:** Reduce gaps from 6 (24px) to 4 (16px)
   - **Reduce panel widths:** Left panel 300px → 280px for patterns, center 450px → fluid, right stays ~320px

2. **Parameter Display Optimization**
   - **Reduce label width:** Truncate labels to 100px max (use title attribute for full names)
   - **Reduce icon + label space:** Use icon-only indicators for less frequent parameters
   - **Increase slider drag target:** Slider thumb should be 6-8px (vs. current 4px) for touch accuracy at arm's length
   - **Tighter spacing:** space-y-3 → space-y-2 between parameters (maintain scannability)

3. **Pattern Selector Adaptation**
   - **Grid columns:** 3-column layout on Tab5 (vs. 4-5 on desktop)
   - **Card size:** Reduce to ~140px width × 160px height
   - **Icons:** Slightly larger (emoji text-xl vs. text-2xl) for visibility at arm's length
   - **Description:** Truncate to single line (line-clamp-1) to save vertical space

4. **Color Palette Grid**
   - **Columns:** Stay 4-column but increase each palette swatch size (2 rows instead of 1)
   - **Names:** Use abbreviated names where possible (e.g., "Sunset" instead of "Warm Sunset Glow")
   - **Interaction:** Increase touch target size (min 44px height per WCAG)

5. **Global Settings**
   - **Icon visibility:** Keep icons (they're only 4px), but ensure labels are clear
   - **Toggle styling:** Make Switch larger (height 24px vs. default 20px) for easier toggling
   - **Slider knob:** Increase to 6px diameter for touch comfort

6. **Audio Reactivity Controls**
   - **Button sizing:** Increase from py-2 → py-3 for better touch targets
   - **Button height:** Aim for 48px minimum (WCAG touch target)
   - **Calibration counter:** Display countdown more prominently (larger font)

7. **Status Bar**
   - **Height:** Increase from 12px to 16px for better readability
   - **Text:** Use text-xs (currently text-xs) but increase line height
   - **Icons:** Keep size but add more breathing room

8. **Typography for Arm's Length**
   - **Headings:** Increase from text-sm (14px) to text-base (16px)
   - **Labels:** Keep text-xs (12px) but use slightly increased weight (medium instead of normal)
   - **Values:** Increase text-xs to text-sm (14px) for numeric displays
   - **Contrast:** Ensure all secondary text meets WCAG AA (4.5:1) ratio

### New Components to Create (Tab5-Specific)

1. **TouchFriendlySlider**
   - Larger hit targets (40px minimum vertical)
   - Haptic feedback integration (if available)
   - Long-press for rapid changes
   - Snap-to-nearby-values for presets (25%, 50%, 75%)

2. **CompactModeSelector**
   - Vertical button stack instead of horizontal (fits narrower layout)
   - Icons without text for space conservation
   - Larger touch target (40×40px minimum)

3. **CollapsibleParameterGroups**
   - Group parameters by category (visual, audio, motion)
   - Collapse/expand to manage vertical scroll on small screen
   - Persistent collapse state in localStorage

4. **LandscapePerformanceWidget**
   - Move status metrics to right sidebar for landscape orientation
   - Color-coded vertical bars instead of text
   - Real-time updating with 1Hz refresh

---

## SUMMARY TABLE: Webapp vs. Tab5 Control Mapping

| Parameter | Webapp Component | Tab5 Adaptation | Priority |
|-----------|-----------------|-----------------|----------|
| Brightness | ParamSlider (0-100%) | Reuse + increase thumb (6px) | HIGH |
| Speed | ParamSlider (0-100%) | Reuse + increase thumb | HIGH |
| Saturation | ParamSlider (0-100%) | Reuse + increase thumb | HIGH |
| Warmth | ParamSlider (0-100%) | Reuse + range labels | MEDIUM |
| Softness | ParamSlider (0-100%) | Reuse + icon only | MEDIUM |
| Background | ParamSlider (0-100%) | Reuse + icon only | MEDIUM |
| Pattern Sel. | Grid 4-5 cols | Adapt to 3 cols + larger icons | HIGH |
| Palette Sel. | Grid 4 cols | Reuse 4 cols + larger swatches | MEDIUM |
| Color HSV | 3 sliders | Reuse ParamSlider × 3 | MEDIUM |
| Global Settings | 5 controls stacked | Reuse + increase spacing | HIGH |
| Audio Reactivity | 3 button group | Adapt to 40px buttons + vertical | HIGH |
| Calibration | Countdown button | Reuse + larger text | MEDIUM |
| Status Metrics | 6 metrics (footer bar) | Move to sidebar or bottom, increase size | HIGH |

---

## IMPLEMENTATION GUIDANCE FOR TAB5

### Phase 1: Direct Port (Week 1)
- Copy existing ParamSlider, ColorManagement, GlobalSettings components
- Import PRISM design tokens
- Create 2-column layout wrapper for Tab5

### Phase 2: Adaptation (Week 2)
- Increase touch targets (36→44px minimum)
- Adjust spacing (24px→16px gaps)
- Test arm's-length readability at 2560×1600 / 12" screen

### Phase 3: Optimization (Week 3)
- Add landscape orientation support
- Implement collapsible parameter groups
- Optimize pattern grid to 3 columns
- Increase slider knob size to 6-8px

### Phase 4: Polish (Week 4)
- Haptic feedback on touch interactions
- Animation transitions for parameter changes
- Performance monitoring on Tab5 CPU (ensure <5% overhead)
- Accessibility audit (touch target sizes, contrast ratios)

---

## FILES TO REFERENCE

### Components to Adapt
- `/webapp/src/components/control/ParamSlider.tsx` (primary reuse)
- `/webapp/src/components/control/EffectParameters.tsx` (reference)
- `/webapp/src/components/control/GlobalSettings.tsx` (adapt spacing)
- `/webapp/src/components/control/ColorManagement.tsx` (reuse grid)
- `/webapp/src/components/control/ModeSelectors.tsx` (adapt buttons)
- `/webapp/src/components/control/PatternSelector.tsx` (adapt grid cols)

### Styles to Import
- `/webapp/src/styles/globals.css` (PRISM tokens)
- `/webapp/src/components/ui/slider.tsx` (base slider)
- `/webapp/src/components/ui/button.tsx` (button styles)
- `/webapp/src/components/ui/label.tsx` (label styles)

### Types/Constants to Reuse
- `/webapp/src/lib/parameters.ts` (UIParams, PARAM_METADATA, PARAM_ORDER)
- `/webapp/src/lib/types.ts` (ConnectionState, AudioReactivityMode, etc.)
- `/webapp/src/lib/mockData.ts` (EFFECTS, COLOR_PALETTES for fallback)


# K1 Webapp Component Hierarchy & File Reference

**Purpose:** Visual map of control component structure for Tab5 adaptation  
**Last Updated:** 2025-11-05

---

## CONTROL PANEL HIERARCHY (webapp/src/components/views/ControlPanelView.tsx)

```
ControlPanelView (Desktop 3-column layout)
├── [LEFT COLUMN] EffectSelector
│   └── Grid of effect buttons (3 columns)
│       └── Each: Button with name + description
│
├── [CENTER COLUMN] EffectParameters
│   └── Dynamic parameter stack (varies by effect)
│       ├── Animation Speed (ParamSlider wrapper)
│       └── Effect-specific sliders (0-6 params)
│
├── [RIGHT COLUMN - TOP] ColorManagement
│   ├── Preset Palettes (4-column grid)
│   │   └── Palette Cards (5-color strip + label + edit option)
│   │
│   └── Manual HSV Control (3 sliders)
│       ├── Hue slider (0-360)
│       ├── Saturation slider (0-100)
│       ├── Value slider (0-100)
│       └── Color preview swatch
│
├── [RIGHT COLUMN - MIDDLE] GlobalSettings
│   ├── Dithering (Switch toggle)
│   ├── Brightness (ParamSlider)
│   ├── Background (ParamSlider)
│   ├── Softness (ParamSlider)
│   └── Warmth (ParamSlider with range labels)
│
├── [RIGHT COLUMN - BOTTOM] ModeSelectors
│   ├── Audio Reactivity (3-button group)
│   │   ├── On (green)
│   │   ├── Off (gray)
│   │   └── Clipping (red with icon)
│   │
│   └── VU Floor Sensitivity
│       ├── Slider (50-98%)
│       ├── Calibrate Noise button
│       │   └── 3-second countdown
│       └── Cancel button (during countdown)
│
└── [FOOTER - STICKY] StatusBar
    ├── FPS (Activity icon + value, color-coded)
    ├── CPU (Cpu icon + percentage, color-coded)
    ├── Memory (HardDrive icon + percentage, color-coded)
    ├── Frame Time (ms)
    └── Effect Time (μs)
```

---

## COMPONENT DEFINITIONS

### 1. ControlPanelView
**File:** `/webapp/src/components/views/ControlPanelView.tsx`  
**Purpose:** Main orchestrator, layout, device communication  
**Key Features:**
- 3-column grid layout (400px | 1fr | 320px)
- Syncs with firmware (patterns, palettes, parameters)
- Manages state for all child components
- Debounced parameter updates (350-375ms)
- Toast notifications for user feedback

**For Tab5:** Adapt grid to 2 columns, reduce gaps

---

### 2. EffectSelector
**File:** `/webapp/src/components/control/EffectSelector.tsx`  
**Purpose:** Choose which pattern/effect to control  
**Key Features:**
- 3-column button grid
- Shows effect name + description
- Selection indicator (cyan border + check icon)
- Sync status indicator

**Structure:**
```tsx
<div className="space-y-3">
  <h3 className="text-sm font-medium">Effect Selection</h3>
  <div className="grid grid-cols-3 gap-2">
    {effects.map(effect => (
      <button
        className={`p-3 rounded-lg border text-xs/sm
          ${selectedEffect === effect.id 
            ? 'bg-info/10 border-info shadow-glow' 
            : 'bg-elevated border-elevated'
          }`}
      >
        {effect.name}
      </button>
    ))}
  </div>
</div>
```

**For Tab5:** Reduce to 3 columns, increase button height to 48px

---

### 3. EffectParameters
**File:** `/webapp/src/components/control/EffectParameters.tsx`  
**Purpose:** Display parameters specific to selected effect  
**Key Features:**
- Dynamic count (0-6+ parameters per effect)
- Labeled sliders with current values
- Min/max bounds displayed
- Type-based color coding (scalar/field/color/output)

**Structure Per Parameter:**
```tsx
<div key={param.name} className="space-y-2">
  <div className="flex items-center justify-between">
    <Label className="text-xs" style={{color: paramTypeColor}}>
      {param.name}
    </Label>
    <span className="text-xs font-jetbrains">
      {value}{unit}
    </span>
  </div>
  
  <Slider min={param.min} max={param.max} />
  
  <div className="flex justify-between text-xs secondary">
    <span>{param.min}{unit}</span>
    <span>{param.max}{unit}</span>
  </div>
</div>
```

**For Tab5:** Use ParamSlider component instead of manual slider

---

### 4. ColorManagement
**File:** `/webapp/src/components/control/ColorManagement.tsx`  
**Purpose:** Palette selection + manual HSV control  
**Key Features:**
- 4-column palette grid with color previews
- Selection glow effect (cyan border)
- Manual HSV controls (3 sliders)
- Real-time color preview swatch
- Hex color output
- Edit mapping mode (dropdown selects)

**Palette Card Structure:**
```tsx
<button className="p-2 rounded-lg border">
  <div className="flex gap-0.5 h-4 rounded overflow-hidden mb-1.5">
    {palette.colors.map(color => (
      <div style={{backgroundColor: rgbToCss(color)}} />
    ))}
  </div>
  <div className="text-xs">{palette.name}</div>
</button>
```

**HSV Control Structure:**
```tsx
{['hue', 'saturation', 'value'].map(control => (
  <div key={control} className="space-y-2">
    <div className="flex items-center justify-between">
      <Label className="text-xs">{label}</Label>
      <span className="text-xs font-jetbrains">{displayValue}</span>
    </div>
    <Slider min={min} max={max} step={1} />
  </div>
))}
```

**For Tab5:** Increase palette card height (h-6 color strip), keep 4-column layout

---

### 5. ParamSlider (Core Reusable Component)
**File:** `/webapp/src/components/control/ParamSlider.tsx`  
**Purpose:** High-performance slider with numeric input  
**Key Features:**
- 0-100% range with step=1
- Live slider drag with "Adjusting..." feedback
- Numeric input field for direct entry
- Reset button (returns to default)
- Keyboard navigation (arrows, Home/End)
- Touch-optimized (onPointerDown/Up events)
- State indicators (isDragging, isDefault)

**Structure:**
```tsx
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <span className="text-lg">{icon}</span>
      <Label className="text-sm font-medium">{label}</Label>
    </div>
    <div className="flex items-center gap-2">
      <Input type="number" className="w-16 h-7 text-xs" />
      <Button variant="ghost" size="sm">
        <RotateCcw className="w-3 h-3" />
      </Button>
    </div>
  </div>
  
  <Slider min={0} max={100} step={1} value={[value]} />
  
  <div className="flex justify-between text-xs">
    <span>{description}</span>
    <div>
      {isDragging && <span className="text-info">Adjusting...</span>}
      <span className="font-mono">{formattedValue}</span>
      {isDefault && <span>●</span>}
    </div>
  </div>
</div>
```

**For Tab5:** REUSE AS-IS, just increase thumb from 4px to 8px

---

### 6. GlobalSettings
**File:** `/webapp/src/components/control/GlobalSettings.tsx`  
**Purpose:** Global visual controls (not effect-specific)  
**Key Features:**
- 5 controls: Dithering (toggle) + 4 sliders
- Icons for each control (Zap, Sparkles, Gauge, Palette)
- Tooltips on hover
- Info descriptions
- Optional advanced features display

**Structure:**
```tsx
<div className="space-y-4">
  <div className="flex items-center gap-2">
    <Settings className="w-4 h-4" />
    <h3 className="text-sm font-medium">Global Settings</h3>
  </div>
  
  {/* Dithering Toggle */}
  <div className="flex items-center justify-between">
    <div>
      <Label className="text-xs">Dithering</Label>
      <span className="text-xs secondary">Reduce banding...</span>
    </div>
    <Switch checked={dithering} onCheckedChange={...} />
  </div>
  
  {/* Brightness/Background/Softness/Warmth Sliders */}
  {sliders.map(slider => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <Label className="text-xs">{label}</Label>
        </div>
        <span className="text-xs font-jetbrains">{value}%</span>
      </div>
      <Slider min={0} max={100} />
    </div>
  ))}
</div>
```

**For Tab5:** Keep structure, increase spacing (space-y-4), increase button/toggle heights

---

### 7. ModeSelectors
**File:** `/webapp/src/components/control/ModeSelectors.tsx`  
**Purpose:** Audio reactivity mode + sensitivity calibration  
**Key Features:**
- 3-button group (On/Off/Clipping) with color coding
- VU floor sensitivity slider (50-98%)
- Calibrate Noise button with 3-second countdown
- Cancel button during countdown
- Tooltips on each button
- Disabled state during calibration

**Structure:**
```tsx
<div className="space-y-4">
  {/* Audio Reactivity Buttons */}
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <Volume2 className="w-4 h-4" />
      <Label className="text-xs">Audio Reactivity</Label>
    </div>
    
    <div className="flex gap-2">
      {['on', 'off', 'clipping'].map(mode => (
        <Tooltip>
          <button
            className={`flex-1 px-3 py-2 rounded-lg border text-xs
              ${audioReactivity === mode 
                ? `bg-${color}/10 border-${color}` 
                : 'bg-elevated border-elevated'
              }`}
          >
            {mode}
          </button>
        </Tooltip>
      ))}
    </div>
  </div>
  
  {/* VU Floor Sensitivity */}
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <Label className="text-xs">Quiet-level sensitivity</Label>
      <Tooltip>?</Tooltip>
      <button onClick={calibrate}>{calibrationText}</button>
    </div>
    
    <div className="flex items-center gap-3">
      <input type="range" min={50} max={98} value={vuFloor} />
      <span className="text-xs font-jetbrains">{vuFloor/100}</span>
    </div>
  </div>
</div>
```

**For Tab5:** Increase button height to 48px (py-3), keep button group horizontal

---

### 8. StatusBar
**File:** `/webapp/src/components/control/StatusBar.tsx`  
**Purpose:** Real-time performance metrics  
**Key Features:**
- 6 metrics: FPS, CPU, Memory, Frame Time, Effect Time
- Color coding (green/orange/red for threshold-based metrics)
- 500ms polling interval for device data
- Icons from Lucide (Activity, Cpu, HardDrive)
- Screen reader announcements (aria-live)

**Structure:**
```tsx
<div className="h-12 bg-surface border-t flex items-center justify-between px-6">
  <div aria-live="polite" srOnly>
    FPS {fps}, CPU {cpu}%, Memory {memory}%
  </div>
  
  <div className="flex items-center gap-6">
    {/* FPS */}
    <div className="flex items-center gap-2">
      <Activity className="w-4 h-4" style={{color: getFpsColor(fps)}} />
      <span className="text-xs secondary">FPS:</span>
      <span className="text-sm font-jetbrains" style={{color: getFpsColor(fps)}}>
        {fps.toFixed(1)}
      </span>
    </div>
    
    {/* Separator */}
    <div className="h-4 w-px bg-elevated" />
    
    {/* CPU and Memory similar structure */}
    ...
  </div>
  
  {/* Frame Time and Effect Time on right */}
  ...
</div>
```

**For Tab5:** Increase height to 16px, consider sidebar layout for landscape

---

## DEPENDENCY CHAIN

```
ControlPanelView (parent)
├── imports: ConnectionState, Effect, ColorPalette, FirmwareParams
│
├── uses EffectSelector
│   └── depends on: Effect[], selectedEffect
│
├── uses EffectParameters
│   ├── depends on: Effect object
│   └── uses Slider UI component
│
├── uses ColorManagement
│   ├── depends on: ColorPalette[], initialPaletteId, initialHsv
│   ├── uses Slider UI component (×3 for HSV)
│   └── uses Suspense for lazy Select component
│
├── uses GlobalSettings
│   ├── depends on: FirmwareParams (brightness, background, softness, warmth, dithering)
│   └── uses Slider, Switch UI components
│
├── uses ModeSelectors
│   ├── depends on: AudioReactivityMode, VU Floor percentage
│   ├── uses Tooltip, Button UI components
│   └── manages calibration countdown state
│
└── uses StatusBar
    ├── depends on: ConnectionState, PerformanceMetrics
    └── uses icons from Lucide
```

---

## UI COMPONENT LIBRARY (Shadcn/Radix)

### Base Components Used

```
/webapp/src/components/ui/

├── slider.tsx
│   └── Used in: ParamSlider, EffectParameters, ColorManagement,
│               GlobalSettings, ModeSelectors
│
├── button.tsx
│   └── Used in: EffectSelector, GlobalSettings, ModeSelectors,
│               PatternSelector
│
├── label.tsx
│   └── Used in: ParamSlider, EffectParameters, GlobalSettings,
│               ModeSelectors, ColorManagement
│
├── switch.tsx
│   └── Used in: GlobalSettings (Dithering toggle)
│
├── input.tsx
│   └── Used in: ParamSlider (numeric input), ModeSelectors (range)
│
└── Other:
    ├── tooltip.tsx (ModeSelectors, GlobalSettings)
    ├── badge.tsx (PatternSelector)
    ├── card.tsx (info panels)
    └── select.tsx (ColorManagement edit mapping, lazy-loaded)
```

---

## TYPE DEFINITIONS REQUIRED

### From `/webapp/src/lib/types.ts`

```typescript
interface Effect {
  id: string;
  name: string;
  description: string;
  parameters: EffectParameter[];
  firmwareIndex?: number;
}

interface EffectParameter {
  name: string;
  type: 'scalar' | 'field' | 'color' | 'output';
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
}

interface ColorPalette {
  id: number;
  name: string;
  colors: RgbColor[];
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface ConnectionState {
  connected: boolean;
  deviceIp: string;
  serialPort?: string;
}

type AudioReactivityMode = 'on' | 'off' | 'clipping';

interface FirmwareParams {
  speed?: number;
  brightness?: number;
  background?: number;
  softness?: number;
  warmth?: number;
  saturation?: number;
  color?: number;
  dithering?: number;
  palette_id?: number;
  custom_param_1?: number;
  // ... other firmware-specific params
}
```

### From `/webapp/src/lib/parameters.ts`

```typescript
interface UIParams {
  brightness: number;    // 0-100%
  speed: number;         // 0-100%
  saturation: number;    // 0-100%
  warmth: number;        // 0-100%
  softness: number;      // 0-100%
  background: number;    // 0-100%
}

interface ParamMetadata {
  key: keyof UIParams;
  label: string;
  description: string;
  icon: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  defaultValue: number;
}

const PARAM_ORDER: (keyof UIParams)[] = [
  'brightness',
  'speed',
  'saturation',
  'warmth',
  'softness',
  'background'
];

const DEFAULT_PARAMS: UIParams = {
  brightness: 75,
  speed: 50,
  saturation: 80,
  warmth: 50,
  softness: 30,
  background: 0
};
```

---

## STYLING IMPORT CHAIN

```
App (root)
└── imports: /webapp/src/index.css
    └── imports: /webapp/src/styles/globals.css
        ├── @import fonts (JetBrains Mono from Google Fonts)
        ├── :root CSS variables (PRISM tokens)
        │   ├── --prism-bg-*
        │   ├── --prism-text-*
        │   ├── --prism-success/warning/error/info/gold
        │   └── --prism-scalar/field/color/output
        └── Tailwind CSS utilities (from index.css layer)
```

---

## TAB5 ADAPTATION PATH

### Files to Copy (No Changes)
```
Webapp Source → Tab5 Destination
/webapp/src/components/control/ParamSlider.tsx → /tab5/components/control/
/webapp/src/components/ui/slider.tsx → /tab5/components/ui/
/webapp/src/components/ui/button.tsx → /tab5/components/ui/
/webapp/src/components/ui/label.tsx → /tab5/components/ui/
/webapp/src/components/ui/switch.tsx → /tab5/components/ui/
/webapp/src/components/ui/input.tsx → /tab5/components/ui/
/webapp/src/components/ui/tooltip.tsx → /tab5/components/ui/
/webapp/src/components/ui/badge.tsx → /tab5/components/ui/
/webapp/src/lib/parameters.ts → /tab5/lib/
/webapp/src/lib/types.ts → /tab5/lib/
/webapp/src/styles/globals.css → /tab5/styles/ (as import)
```

### Files to Adapt
```
/webapp/src/components/control/EffectSelector.tsx → Tab5Version
  - Change grid-cols-3 to grid-cols-3
  - Increase button height (py-3)
  - Increase icon size (text-xl)

/webapp/src/components/control/EffectParameters.tsx → Tab5Version
  - Use ParamSlider component instead of inline sliders
  - Remove type-based color coding
  - Compress space-y-5 to space-y-3

/webapp/src/components/control/ColorManagement.tsx → Tab5Version
  - Increase palette card height (h-6 vs h-4)
  - Abbreviate palette names
  - Increase touch target to 44×48px minimum

/webapp/src/components/control/GlobalSettings.tsx → Tab5Version
  - Reduce space-y-5 to space-y-4
  - Increase Switch height (h-6 vs h-5)
  - Increase slider spacing

/webapp/src/components/control/ModeSelectors.tsx → Tab5Version
  - Increase button height (py-3)
  - Increase font size for countdown (text-lg)
  - Keep horizontal button layout

/webapp/src/components/control/StatusBar.tsx → Tab5Version
  - Increase height (16px vs 12px)
  - Consider sidebar layout for landscape
  - Increase icon size (w-5 h-5)

/webapp/src/components/views/ControlPanelView.tsx → Tab5Version
  - Change grid-cols-[400px_1fr_320px] to 2-column
  - Reduce gap-6 to gap-4
  - Adapt responsive breakpoints
```

---

## REFERENCE SUMMARY

**Total Components:** 5 main control components  
**Total UI Building Blocks:** 9 Radix-based components  
**Design Tokens:** 15+ CSS variables (from PRISM)  
**Parameter Types:** 6 visible parameters (from UIParams interface)  
**Reusable Rate:** 70% (ParamSlider, Design Tokens, Type Definitions)  
**Adaptation Effort:** Medium (spacing, sizing, layout only)  
**Risk Level:** Low (well-isolated components, proven patterns)

---

## FILES FOR QUICK ACCESS

**Main Analysis:**
- `/docs/05-analysis/webapp_parameter_display_analysis.md` (26KB, comprehensive)
- `/docs/05-analysis/TAB5_UI_ADAPTATION_QUICK_REFERENCE.md` (12KB, checklists)

**Source Code:**
- `/webapp/src/components/views/ControlPanelView.tsx` (main view)
- `/webapp/src/components/control/` (5 control components)
- `/webapp/src/styles/globals.css` (design tokens)
- `/webapp/src/lib/parameters.ts` (types & constants)


Figma Make Agent Prompt: Tab5 Wireless Controller Wireframe/Prototype
I'm creating a comprehensive prompt for a Figma Make agent to generate the Tab5 controller interface wireframe/prototype. This prompt incorporates all specifications from the UI research documents and applies the PRISM.node design system.
FIGMA MAKE AGENT PROMPT
# M5Stack Tab5 Wireless Controller - Figma Wireframe/Prototype Generation

## PROJECT CONTEXT
Create a high-fidelity wireframe and interactive prototype for the M5Stack Tab5 (1280×720px, 294 PPI) 
wireless controller interface for the K1 Lightwave firmware system. This controller communicates with 
K1 (ESP32-S3 server) via HTTP REST API + WebSocket, enabling remote parameter control for light shows.

---

## DESIGN SYSTEM: PRISM.node (Dark Theme)

**Canvas & Structure Colors:**
- Background Canvas: #1c2130 (main composition background)
- Surface: #252d3f (control containers, header, footer sections)
- Elevated: #2f3849 (hover states, pressed states, focus indicators)

**Text Colors:**
- Primary Text: #e6e9ef (labels, main content, high contrast)
- Secondary Text: #b5bdca (subtitles, helper text, descriptions)

**Semantic Colors:**
- Gold: #ffb84d (important actions, calibration button, highlights)
- Success: #22dd88 (connected status, enabled, active indicators)
- Warning: #f59e0b (caution states, requires attention)
- Error: #ef4444 (disconnected, failed, critical states)
- Info: #6ee7f3 (informational messages, hints)

**Data Type Colors:**
- Scalar values: #f59e0b
- Field labels: #22d3ee
- Color parameters: #f472b6
- Output/feedback: #34d399

**Typography:**
- Font Family: JetBrains Mono (monospace)
- Hero: 24px, Font Weight 600
- Header: 18px, Font Weight 600
- Body Label: 16px, Font Weight 600
- Body Value: 16px, Font Weight 400
- Small: 14px, Font Weight 400
- Caption: 12px, Font Weight 400
- Tiny: 10px, Font Weight 400

**Grid System:**
- Base Unit: 16px
- Canvas Grid: 80 columns × 45 rows (1280×720px)
- Border Radius: 10px (standard), 5px (compact)
- Spacing Unit: 16px (multiples of 16px for margins/padding)

---

## VIEWPORT SPECIFICATIONS

**Screen Properties:**
- Device: M5Stack Tab5
- Resolution: 1280×720px
- DPI: 294 PPI (High-density)
- Orientation: Landscape
- Aspect Ratio: 16:9

**Physical Constraints:**
- Viewing Distance: 60-70cm (arm's length, standing/performing)
- Touch Target Minimum: 150×150px (11-12mm fingers at 294 PPI)
- Text Readability: 14pt minimum = 57px (readable at arm's length)
- Safe Zone: 32px margin from edges (prevents accidental touches)

---

## LAYOUT ARCHITECTURE: 3-Zone Design

### Zone 1: Header (0-80px, Full Width)
**Background:** Surface (#252d3f)
**Border:** 1px bottom border, Elevated (#2f3849)
**Height:** 80px

**Components:**
- Pattern Name Display (left-aligned)
  - Label: "PATTERN" (12px, Caption, Secondary Text #b5bdca)
  - Value: "Aurora Waves" (24px, Hero, Primary Text #e6e9ef, monospace)
  - Position: 16px from left, vertically centered
  - Width: 400px max

- Connection Status Indicator (right-aligned)
  - Icon: 24×24px circle
  - Status Dot: 8×8px
    - Connected: Success (#22dd88), animated pulse
    - Syncing: Info (#6ee7f3), pulsing
    - Error: Error (#ef4444), steady
  - Text: "Connected" | "Syncing..." | "Disconnected" (12px, Caption)
  - Position: 16px from right, vertically centered

---

### Zone 2: Main Control Area (80-640px, Full Width)
**Background:** Canvas (#1c2130)
**Padding:** 24px horizontal, 20px top/bottom

**Layout:** 2-Column Grid (Split at column 40)

#### LEFT COLUMN: Parameter Sliders (16px to 640px)
**Grid Columns:** 1-39
**Content:** 5 Vertical Parameter Sliders

Each Slider Component:
- **Dimensions:** 40px width × 220px height
- **Spacing Between Sliders:** 20px vertical
- **Total Height for 5 sliders:** ~1140px (SCROLLABLE REGION)

**Per Slider Structure:**
┌─ Label Row (24px height) │ ├─ Label Text (14px, Small, Primary #e6e9ef) │ └─ Value Display (12px, Caption, Secondary #b5bdca) ├─ Track (200px height, centered vertically) │ ├─ Background Track: Elevated (#2f3849), 4px height, rounded │ ├─ Active Fill: Semantic color (varies by parameter) │ └─ Thumb: 28×28px circle, color matches semantic, centered on track ├─ Min/Max Labels (10px, Tiny, Secondary #b5bdca, at bottom) └─ Unit Indicator (12px, Caption, Secondary #b5bdca)

**5 Sliders (Top to Bottom):**

1. **Brightness Slider**
   - Label: "BRIGHTNESS"
   - Min: 0%, Max: 100%
   - Color: Gold (#ffb84d)
   - Icon (optional): Sun symbol (16×16px, left margin)

2. **Speed Slider**
   - Label: "SPEED"
   - Min: 0.1x, Max: 2.0x
   - Color: Info (#6ee7f3)
   - Icon (optional): Gauge symbol

3. **Color Slider** (Hue)
   - Label: "COLOR"
   - Min: 0°, Max: 360°
   - Color: Color Param (#f472b6)
   - Icon (optional): Color wheel

4. **Saturation Slider**
   - Label: "SATURATION"
   - Min: 0%, Max: 100%
   - Color: Field (#22d3ee)
   - Icon (optional): Palette symbol

5. **Warmth/Kelvin Slider**
   - Label: "WARMTH"
   - Min: 2700K, Max: 6500K
   - Color: Scalar (#f59e0b)
   - Icon (optional): Thermometer

---

#### RIGHT COLUMN: Controls & Status (640px to 1264px)
**Grid Columns:** 41-78
**Content:** 3 Sections (Top, Middle, Bottom)

**Section 1: Palette Selector (Top, ~140px height)**
- **Background:** Elevated (#2f3849)
- **Border:** 1px, Surface (#252d3f), rounded 10px
- **Padding:** 16px
- **Title:** "PALETTE" (14px, Small, Primary #e6e9ef)

**Grid Layout:** 2 rows × 3 columns of palette swatches
- **Swatch Dimensions:** 60×60px
- **Swatch Spacing:** 12px
- **Total Swatches:** 6 (user-selectable presets)
- **States:**
  - Default: Solid color fill + 1px border (Surface #252d3f)
  - Hover: 2px border (Gold #ffb84d), slight glow effect
  - Active: 3px border (Success #22dd88), glow effect
  - Each swatch shows color preview at full saturation

---

**Section 2: Audio & Controls (Middle, ~280px height)**

**Audio Control Module:**
- **Background:** Elevated (#2f3849)
- **Border:** 1px, Surface (#252d3f), rounded 10px
- **Padding:** 16px
- **Title:** "AUDIO" (14px, Small, Primary #e6e9ef)

**Audio Toggle Switch:**
- **Dimensions:** 100px width × 48px height
- **Style:** Rounded toggle (24px radius)
- **OFF State:**
  - Background: Surface (#252d3f)
  - Icon/Label: "OFF" (12px, Caption, Secondary #b5bdca)
  - Thumb: Left-aligned, Circle 40px
- **ON State:**
  - Background: Success (#22dd88)
  - Icon/Label: "ON" (12px, Caption, Primary #e6e9ef)
  - Thumb: Right-aligned, Circle 40px
- **Margin Bottom:** 12px

**Audio Gain Slider (Horizontal):**
- **Label:** "GAIN" (12px, Caption, Primary #e6e9ef)
- **Width:** Full container width (minus padding)
- **Height:** 40px total (including label)
- **Track Height:** 4px
- **Thumb:** 24px circle, color Info (#6ee7f3)
- **Min/Max:** -20dB / +6dB (displayed as ±value)
- **Margin Bottom:** 16px

**Audio Level Meter:**
- **Label:** "LEVEL" (12px, Caption, Primary #e6e9ef)
- **Dimensions:** Full width × 24px height
- **Display:** Horizontal bar meter
- **Segments:** 10 LED-style segments
  - Inactive: Dark Elevated (#2f3849)
  - Active: 
    - Levels 1-6: Success (#22dd88)
    - Levels 7-8: Warning (#f59e0b)
    - Levels 9-10: Error (#ef4444)
- **Border:** 1px Surface (#252d3f), rounded 4px
- **Margin Bottom:** 16px

---

**Section 3: Calibration & Status (Bottom, ~100px height)**

**Noise Calibration Button:**
- **Dimensions:** 140×48px
- **Background:** Gold (#ffb84d)
- **Text:** "CALIBRATE" (14px, Small, Bold, #1c2130)
- **Border Radius:** 10px
- **States:**
  - Default: Gold (#ffb84d)
  - Hover: Elevated tone of Gold (#ffc96b)
  - Pressed: Darker Gold (#e6a73a)
  - Active/Calibrating: Gold + loading spinner animation (12px, centered)
- **Position:** Right-aligned, 16px from right edge, 16px from bottom
- **Margin Bottom:** 8px

**Status Indicators Bar:**
- **Background:** Elevated (#2f3849)
- **Border:** 1px Surface (#252d3f), rounded 8px
- **Padding:** 12px 16px
- **Height:** 40px
- **Content:** 4 Inline Status Items (space-around distribution)

Status Items (left to right):
1. **FPS Display**
   - Label: "FPS" (10px, Tiny, Secondary #b5bdca)
   - Value: "60" (12px, Caption, Primary #e6e9ef)
   - Color: Info (#6ee7f3)

2. **CPU Usage**
   - Label: "CPU" (10px, Tiny, Secondary #b5bdca)
   - Value: "45%" (12px, Caption, Primary #e6e9ef)
   - Color: Scalar (#f59e0b)
   - Optional: Usage bar (20px width, mini horizontal bar)

3. **Memory Usage**
   - Label: "MEM" (10px, Tiny, Secondary #b5bdca)
   - Value: "2.1M" (12px, Caption, Primary #e6e9ef)
   - Color: Field (#22d3ee)

4. **WiFi Signal**
   - Label: "WiFi" (10px, Tiny, Secondary #b5bdca)
   - Icon: Wireless symbol (12×12px)
   - Signal Strength: 4 bars, color Success (#22dd88)

---

### Zone 3: Footer (640-720px, Full Width)
**Background:** Surface (#252d3f)
**Border:** 1px top border, Elevated (#2f3849)
**Height:** 80px

**Components:**

**Left Section: Battery & Info**
- Battery Icon (16×24px) + Percentage (12px, Caption)
  - Battery ≥50%: Success (#22dd88)
  - Battery 20-50%: Warning (#f59e0b)
  - Battery <20%: Error (#ef4444)
- Position: 16px from left, vertically centered
- Separator: Vertical line (1px, Surface #252d3f) at 80px

**Center Section: Telemetry Status**
- Display: "250ms" broadcast interval (12px, Caption, Secondary #b5bdca)
- Display: Last sync timestamp "≈ now" or "≈ 1.2s ago" (12px, Caption)
- Color: Success (#22dd88) if synced <500ms ago, else Warning (#f59e0b)

**Right Section: Action Buttons**
- **Reset Button:**
  - Label: "RESET" (12px, Small)
  - Dimensions: 100×48px
  - Background: Elevated (#2f3849)
  - Text Color: Primary #e6e9ef
  - Border: 1px, Surface (#252d3f)
  - Border Radius: 8px
  - Hover: Background lightens to #3a4558
  - Position: 16px from right edge

**Settings Button (Optional):**
- Icon: Gear (16×16px)
- Dimensions: 48×48px
- Background: Transparent
- Hover: Background Elevated (#2f3849)
- Position: 124px from right edge

---

## COMPONENT SPECIFICATIONS

### Slider Component (Reusable)
Structure: ├─ Container │ ├─ Label Row │ │ ├─ Label Text (14px, Primary) │ │ └─ Value Text (12px, Secondary, right-aligned) │ ├─ Track Container │ │ ├─ Background Track (Elevated color, 4px height) │ │ ├─ Active Track Fill (Semantic color) │ │ └─ Thumb (28×28px circle, centered on value) │ └─ Min/Max Labels (10px, Secondary) Interactions: ├─ Default: Static display ├─ Hover: Thumb enlarges to 32×32px, slight glow ├─ Dragging: Thumb increases to 36×36px, active fill updates in real-time └─ Release: Smooth snap to nearest valid value (if discrete), 200ms animation Touch Feedback: └─ Visual: Color intensifies, slight shadow/glow └─ Animation: Value label updates live during drag (no debounce)

### Toggle Switch Component
Structure: ├─ Background Track (48×24px, border-radius: 24px) ├─ Thumb Circle (20×20px, centered within track) └─ Label/Icon (centered or adjacent) States: ├─ OFF: Background #252d3f (Surface), Thumb left-aligned ├─ ON: Background #22dd88 (Success), Thumb right-aligned └─ Animation: 200ms smooth slide of thumb Interactions: ├─ Tap: Toggle state + 200ms animation └─ Hold (1000ms): Trigger haptic feedback (if available)

### Status Widget (Reusable for FPS, CPU, etc.)
Structure: ├─ Label (10px, Tiny, Secondary) ├─ Value (12px, Caption, Primary) └─ Optional: Mini bar chart or icon indicator Layout: Inline, vertical stack center-aligned Update Frequency: 250ms (WebSocket broadcast interval)

---

## INTERACTION PATTERNS & ANIMATIONS

### Slider Interaction
- **Drag Start:** 300ms ease-out scale animation (thumb: 28×28px → 36×36px)
- **Dragging:** Real-time value update, no debounce
- **Drag End:** 200ms ease-out snap to nearest value, scale back to 28×28px
- **Feedback:** Visual color feedback, subtle glow effect during interaction

### Toggle Switch
- **Tap:** 200ms linear slide of thumb + background color transition
- **Held Tap (1000ms):** Haptic buzz (if device supports), brief visual feedback

### Button Press
- **Press Down:** 100ms scale(0.95) animation, background darkens
- **Release:** 200ms scale back to 1.0, background returns to normal
- **Active State:** Continuous glow effect (0.5s opacity pulse)

### State Transitions
- **Connecting:** Gold (#ffb84d) pulsing animation on connection indicator
- **Synced:** Success (#22dd88) steady state, brief 200ms pulse every sync
- **Error:** Error (#ef4444) steady, optional 500ms pulse for alert

### Animations (Global)
- **Ease Functions:** ease-out for opening/closing, ease-in-out for transitions
- **Duration Standards:**
  - Snappy feedback: 100ms
  - Smooth transitions: 200-300ms
  - Alerts/notifications: 500ms
- **Respect Accessibility:** Provide reduced-motion support (all animations → 50ms)

---

## STATE VARIATIONS (CREATE MULTIPLE FRAMES)

### Frame 1: Default State (Fully Connected, No Audio)
- All sliders: neutral positions
- Palette: 1st swatch active (Success border)
- Audio Toggle: OFF
- Connection Status: "Connected" (Success green)
- Battery: 85% (Success)
- All meters/status: display nominal values

### Frame 2: Audio Active State
- Audio Toggle: ON (Success green background)
- Gain Slider: -6dB position
- Level Meter: 6 segments lit (Success colors)
- Audio section: subtle glow effect around entire module

### Frame 3: Syncing State
- Connection Status: "Syncing..." (Info blue)
- Status indicator dot: animated pulse
- All controls: subtle opacity reduction (0.7)
- Refresh spinner: visible on connection status

### Frame 4: Error/Disconnected State
- Connection Status: "Disconnected" (Error red)
- Status indicator dot: steady Error red
- All controls: opacity reduced to 0.5
- Reset button: highlighted with gold border

### Frame 5: Hover States (Desktop/Preview)
- Sliders: Thumb scaled up, glow effect
- Buttons: Background lightened, subtle shadow
- Palette swatches: Gold border on hover
- All text: slight brightening on hover

### Frame 6: Active/Pressed States
- Slider: Thumb at maximum scale (36×36px)
- Buttons: Pressed-down appearance (darkened, scaled 0.95)
- Palette: Selected swatch has Success green border + glow
- Audio Toggle: Pressed animation active

---

## ERGONOMIC & USABILITY REQUIREMENTS

### Touch Target Sizing (CRITICAL)
- **Minimum Touch Target:** 150×150px (tested at 294 PPI = safe for 10-15mm fingers)
- **Apply to:** All interactive elements (sliders, toggles, buttons, palette swatches)
- **Safe Zone:** 32px margin from viewport edges (prevents accidental activation)
- **Spacing Between Targets:** Minimum 12px gap

### Visual Hierarchy
- **Hero Element:** Pattern name (24px, bold)
- **Primary Controls:** Sliders (200px height, prominent)
- **Secondary Controls:** Audio controls, palette (smaller, grouped)
- **Tertiary Elements:** Status indicators (small, subtle)

### Readability at Arm's Length (60-70cm)
- **Minimum Font Size:** 14px (57px at 294 PPI, comfortably readable)
- **Contrast Ratio:** ≥4.5:1 for all text (Primary #e6e9ef on backgrounds passes AA)
- **Line Height:** 1.5 for readability

### Blind Operation Support
- **Muscle Memory Zones:**
  - Left column: Sliders only (predictable vertical layout)
  - Right column: Buttons/toggles only (predictable positions)
  - Header: Pattern name (read-only)
  - Footer: Status/info (read-only)
- **Visual Feedback:** Immediate color/scale changes on every interaction
- **Consistency:** Same control in same position every launch

### Accessibility Compliance
- **WCAG AA Minimum:** 4.5:1 contrast ratio (all text colors meet this)
- **Reduced Motion:** All animations respect `prefers-reduced-motion` media query (50ms max)
- **Focus Indicators:** 2px outline on all interactive elements (not yet specified, recommend Info #6ee7f3)
- **Keyboard Navigation:** Tab order: left column (top→bottom), right column (top→bottom), footer controls

---

## COMPONENT SPECIFICATIONS (DETAILED)

### Palette Swatch
- **Dimensions:** 60×60px
- **Border Radius:** 8px
- **Default Border:** 1px solid Surface (#252d3f)
- **Hover Border:** 2px solid Gold (#ffb84d) + subtle glow
- **Active Border:** 3px solid Success (#22dd88) + glow effect
- **Content:** Solid color fill (user palette color)
- **Spacing:** 12px between swatches
- **Layout:** 2×3 grid in palette section

### Status Meter Segment (in Level Meter)
- **Dimensions:** 1fr width (flex), 20px height
- **Spacing:** 1px gap between segments
- **States:**
  - Inactive: Background Elevated (#2f3849)
  - Active (levels 1-6): Success (#22dd88)
  - Active (levels 7-8): Warning (#f59e0b)
  - Active (levels 9-10): Error (#ef4444)
- **Border Radius:** 2px
- **Update Frequency:** 100ms (derived from WebSocket 250ms broadcasts)

---

## SCROLLING & RESPONSIVENESS

### Left Column (Sliders)
- **Scrollable Region:** Yes (if 5 sliders exceed 560px)
- **Scroll Mechanism:** Vertical swipe/scroll wheel
- **Sticky Header:** Yes (keep "BRIGHTNESS" label visible)
- **Scroll Indicator:** Thin vertical track (4px width, Surface color) at right edge of slider column
- **Momentum Scrolling:** Enabled (smooth, natural feel)

### Right Column (Non-Scrollable)
- **Content Fit:** Palette + Audio + Status must fit in 560px vertical space
- **Overflow Handling:** If audio section is large, reduce spacing (min 8px between sections)

---

## PRODUCTION NOTES FOR FIGMA

1. **Export Grid:** Create component master for each reusable element (Slider, Toggle, StatusWidget, Swatch)
2. **Color Styles:** Define Figma color styles for all PRISM.node colors (Canvas, Surface, Elevated, all semantic colors)
3. **Typography Styles:** Create Figma text styles for each size/weight combo (Hero, Header, Body Label, Body Value, Small, Caption, Tiny)
4. **Spacing Scale:** Apply Figma grid/constraints (16px base unit) to ensure alignment and responsiveness
5. **Interactive Prototype:** Link frames with click interactions:
   - Slider thumb → draggable along track (or simulate with multiple value states)
   - Toggle → switch between ON/OFF frames
   - Buttons → highlight active state
   - Palette swatches → swap active state between 6 swatches
6. **Animations:** Define micro-interactions in Figma (easings, durations, scales)
7. **Assets:** Use consistent stroke (1px) and shadow rules across all components
8. **Responsive Export:** Generate responsive CSS variables and component code snippets alongside Figma prototype

---

## DELIVERABLES

### Figma Deliverables:
1. **Main Frame:** 1280×720px canvas with all 3 zones complete
2. **Component Library:** 6 master components (Slider, Toggle, StatusWidget, Swatch, Button, CardContainer)
3. **6 State Frames:** Default, Audio Active, Syncing, Error, Hover, Pressed states
4. **Interactive Prototype:** Click/drag interactions linked between state frames
5. **Design System Documentation:** Color palette, typography, spacing rules, interaction patterns

### Code Export Options:
- Figma → React components (via Storybook integration)
- Figma → CSS/Tailwind classes (using PRISM.node color variables)
- Figma → HTML wireframe (for quick preview)

---

## SUCCESS CRITERIA

✅ Wireframe matches all pixel specifications from UI research documents
✅ All PRISM.node colors applied exactly as defined in global.css
✅ Typography specifications implemented (JetBrains Mono, 7 size levels)
✅ All 5 sliders visible/scrollable in left column
✅ Right column controls: palette (6 swatches), audio (toggle + gain + meter), calibration button
✅ Header: pattern name + connection status
✅ Footer: battery, telemetry status, reset button
✅ Touch targets ≥150×150px for all interactive elements
✅ Color contrast ≥4.5:1 for all text (WCAG AA)
✅ Interactive prototype demonstrates slider drag, toggle switch, button press
✅ Respects 60-70cm viewing distance (text readable, controls accessible)
✅ Supports blind operation (predictable muscle memory layout)
✅ State variations show all 6 key states (default, audio active, syncing, error, hover, pressed)

---

## REFERENCE DOCUMENTS

**All specifications derived from:**
- `/docs/05-analysis/tab5/UI.research/tab5_controller_ui_design_spec.md` (main design spec)
- `/docs/05-analysis/tab5/UI.research/tab5_ergonomic_analysis.md` (touch targets, viewing distance)
- `/docs/05-analysis/tab5/UI.research/tab5_ui_interactions_detailed.md` (interaction patterns)
- `/docs/05-analysis/tab5/UI.research/tab5_ergonomic_quick_reference.md` (pixel cheat sheet)
- `/docs/05-analysis/tab5/UI.research/COMPONENT_HIERARCHY_REFERENCE.md` (component structure)
- `/webapp/src/styles/globals.css` (PRISM.node design system)

---

## NOTES FOR FIGMA AGENT

- **Use exact hex color codes** from global.css (no approximations or color picker)
- **Maintain 16px grid** alignment throughout (80 col × 45 row structure)
- **Export as component library** for reusability in future Tab5 projects
- **Test at 294 PPI equivalent** if possible (measure physical touch targets with rule/calipers)
- **Create both light and dark mode options** (though dark is primary; light mode CSS is in global.css root)
- **Include interaction specifications** in component documentation (easing, duration, feedback)
- **Provide detailed layer naming** for developer handoff (use naming convention: `[ZoneName] > [SectionName] > [ComponentType]`)

---
SUMMARY
This prompt is production-ready for a Figma Make agent and includes: ✅ Complete Design System: All PRISM.node colors with exact hex codes from global.css ✅ Pixel-Perfect Specifications: 1280×720px, 294 PPI, 16px grid system, exact dimensions for every element ✅ All Components Detailed: Sliders (5), Toggle, Buttons, Palette selector, Meters, Status widgets ✅ Ergonomic Constraints: 150×150px touch targets, 60-70cm arm's-length viewing, blind operation support ✅ Interaction Patterns: All animations, state transitions, drag behavior, touch feedback ✅ 6 State Variations: Default, Audio Active, Syncing, Error, Hover, Pressed ✅ Accessibility Requirements: WCAG AA contrast ratios, reduced motion support, focus indicators ✅ Production-Ready Output: Component library, interactive prototype, code export options This prompt can be directly provided to a Figma automation tool or Make agent to generate high-fidelity wireframes and an interactive prototype ready for developer handoff.
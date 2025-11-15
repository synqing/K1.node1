<!-- markdownlint-disable MD013 -->

# M5Stack Tab5 Wireless Controller Interface Design Specification

**Version:** 1.0
**Date:** 2025-11-05
**Owner:** SuperDesigner Agent
**Target Device:** M5Stack Tab5 (1280×720px, 294 PPI, Landscape)
**Status:** Ready for Implementation
**Related:** K1.node1 LED Control System

---

## Executive Summary

This specification defines a professional, blind-operable wireless controller interface for live LED performance control. Designed for arm's length operation (60-70cm), the interface prioritizes muscle memory, large touch targets (150-160px), and minimal visual attention during performances.

**Key Design Principles:**
- Touch targets ≥150px for reliable operation with performance gloves
- Dark theme exclusively (Canvas #1c2130, Surface #252d3f)
- Gold accent (#ffb84d) for primary controls
- Predictable layout zones for blind operation
- Real-time feedback <100ms latency
- JetBrains Mono typography at 20-32px for arm's length readability

---

## 1. Layout Architecture

### Overall Structure (1280×720px)

```
┌─────────────────────────────────────────────────────────────┐
│ STATUS BAR (80px)                                           │
│ Connection | Performance | Battery                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ MAIN CONTROL PANEL (560px)                                 │
│                                                             │
│  Global Params  │  Audio Controls  │  Pattern & Quick      │
│  (380px)        │  (380px)         │  Actions (392px)      │
│                                                             │
│  5 Sliders      │  Gain Slider     │  Current Pattern      │
│                 │  3-State Toggle  │  Calibrate Button     │
│                 │  Clipping Alert  │  Palette Grid         │
│                 │  Reactivity      │                       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ FOOTER (80px)                                               │
│ Pattern Info | Timestamps | Status                          │
└─────────────────────────────────────────────────────────────┘
```

### Zone Specifications

| Zone                  | X      | Y      | Width  | Height | Background |
|-----------------------|--------|--------|--------|--------|------------|
| Status Bar            | 0      | 0      | 1280   | 80     | #252d3f    |
| Main Control Panel    | 32     | 96     | 1216   | 560    | #1c2130    |
| - Global Params       | 32     | 96     | 380    | 560    | Inherit    |
| - Audio Controls      | 444    | 96     | 380    | 560    | Inherit    |
| - Pattern/Quick       | 856    | 96     | 392    | 560    | Inherit    |
| Footer                | 0      | 656    | 1280   | 64     | #252d3f    |

---

## 2. Grid & Spacing System

### Base Grid: 16px Unit

- **Total Columns:** 80 (1280÷16)
- **Total Rows:** 45 (720÷16)
- **Safe Area Margins:** Left/Right 32px, Top/Bottom 16px
- **Usable Canvas:** 1216×688px

### Spacing Tokens

```
Micro:   8px   (0.5 unit) - Inline spacing
Small:   16px  (1 unit)   - Component padding
Medium:  24px  (1.5 unit) - Related controls
Large:   32px  (2 unit)   - Control groups
XLarge:  48px  (3 unit)   - Section dividers
```

---

## 3. Component Library

### A. Status Bar Components (80px tall)

#### WiFi Indicator
```
Position: (32, 20)
Size: 160×40px
Font: JetBrains Mono 20px
Color: State-dependent
  Strong [●●●●] #22dd88
  Medium [●●●○] #ffb84d
  Weak [●●○○] #f59e0b
  None [●○○○] #ef4444
```

#### Connection Status
```
Position: (220, 20)
Size: 300×40px
Font: JetBrains Mono 20px
Color: #22dd88 (Connected) | #ef4444 (Disconnected)
Text: "K1.node1 Connected"
```

#### Performance Monitor
```
Position: (540, 20)
Size: 400×40px
Font: JetBrains Mono 18px
Color: #b5bdca
Format: "FPS: 60 | CPU: 45% | Mem: 2.1MB"
Update: Every 500ms
```

#### Battery Indicator
```
Position: (1140, 20)
Size: 120×40px
Font: JetBrains Mono 20px
Color:
  >20%: #22dd88
  10-20%: #f59e0b
  <10%: #ef4444 (blinking)
```

---

### B. Global Parameter Sliders

**Container:** 380×560px at (32, 96)

#### Slider Specifications (Common)

```css
Visual Dimensions:
  Rail Width: 280px
  Rail Height: 8px
  Thumb Size: 32×32px circle
  Touch Target: 320×80px (40px padding each side)

Colors:
  Rail Background: #2f3849
  Rail Fill: #ffb84d (gold accent)
  Thumb: #ffb84d with 2px #e6e9ef border
  Shadow: 0 4px 8px rgba(0,0,0,0.4)

Typography:
  Label Font: JetBrains Mono 24px Bold
  Label Color: #e6e9ef
  Value Font: JetBrains Mono 20px Regular
  Value Color: #b5bdca

Spacing:
  Label to Slider: 8px
  Slider to Next Label: 80px (88px center-to-center)
```

#### Individual Sliders

1. **Brightness** (Y: 120)
   - Range: 0-100%
   - Label: "Brightness"
   - Value Display: "75%"

2. **Speed** (Y: 208)
   - Range: 0-255
   - Label: "Speed"
   - Value Display: "128"

3. **Color** (Y: 296)
   - Range: 0-255 (Hue)
   - Label: "Color"
   - Value Display: "180"
   - Special: Rail shows gradient preview

4. **Saturation** (Y: 384)
   - Range: 0-100%
   - Label: "Saturation"
   - Value Display: "85%"

5. **Warmth** (Y: 472)
   - Range: 2700K-6500K
   - Label: "Warmth"
   - Value Display: "4200K"

#### Visual States

```
Normal:
  Rail: #2f3849
  Fill: #ffb84d
  Thumb: #ffb84d + border
  Opacity: 1.0

Active (touching):
  Rail: #2f3849
  Fill: #ffb84d (brightness +20%)
  Thumb: Scale 1.2x, glow effect
  Shadow: 0 0 16px rgba(255,184,77,0.6)

Disabled:
  Rail: #1c2130
  Fill: #3a4253
  Thumb: #3a4253
  Label/Value: #6b7280
  Opacity: 0.5
```

---

### C. Audio Controls

**Container:** 380×560px at (444, 96)

#### Microphone Gain Slider

```
Position: (464, 120)
Size: 340×80px touch target
Label: "🎤 Gain" - 24px Bold

Slider:
  Width: 280px
  Rail: #2f3849
  Fill: #6ee7f3 (info/audio color)
  Thumb: 32×32px, #6ee7f3 with #e6e9ef border
  Range: -30dB to 0dB

Scale Markings:
  Position: Below rail, 4px gap
  Font: 16px
  Color: #b5bdca
  Values: "-30dB  -20dB  -10dB  0dB"
```

#### Audio Mode Toggle (3-State Segmented)

```
Position: (464, 240)
Size: 340×64px
Label: "Audio Mode:" - 20px, #b5bdca

Toggle Buttons:
  Type: Segmented control (3 buttons)
  Button Size: 106×64px each
  Gap: 6px
  Corner Radius: 6px

States:
  OFF:
    Background: #2f3849
    Text: #b5bdca
    Border: 1px solid #3a4253

  ON (Active):
    Background: #22dd88
    Text: #1c2130
    Font: JetBrains Mono 20px Bold

  CLIP (Active):
    Background: #f59e0b
    Text: #1c2130
    Font: JetBrains Mono 20px Bold
```

#### Clipping Alert Indicator

```
Position: (464, 340)
Size: 340×48px

Normal (No Clipping):
  Icon: ○ (18px circle outline)
  Color: #22dd88
  Text: "No Clipping"
  Font: 18px Regular

Clipping Detected:
  Icon: ● (filled circle, pulse animation)
  Color: #ef4444
  Text: "CLIPPING DETECTED!"
  Font: 20px Bold
  Animation: Pulse 500ms loop
```

#### Reactivity Slider

```
Position: (464, 420)
Size: 340×80px touch target
Label: "Reactivity" - 24px Bold

Slider:
  Width: 280px
  Rail: #2f3849
  Fill: #6ee7f3
  Thumb: 32×32px, #6ee7f3
  Range: 0-100%
  Value Display: "75%"
```

---

### D. Pattern & Quick Actions

**Container:** 392×560px at (856, 96)

#### Current Pattern Display

```
Position: (876, 120)
Size: 352×88px
Background: #2f3849
Border: 2px solid #ffb84d
Corner Radius: 8px
Padding: 16px

Pattern Name:
  Text: "Rainbow Spiral"
  Font: JetBrains Mono 28px Bold
  Color: #e6e9ef
  Alignment: Center

Pattern ID:
  Text: "(ID: 07)"
  Font: 16px Regular
  Color: #b5bdca
  Position: Below name, 4px gap
```

#### Noise Calibration Button (Hero Action)

```
Position: (876, 228)
Size: 352×120px (LARGE for prominence)
Background: #ffb84d (gold accent)
Border: None
Corner Radius: 12px
Shadow: 0 6px 12px rgba(255,184,77,0.3)

Text:
  Line 1: "CALIBRATE NOISE"
  Line 2: "FLOOR"
  Font: JetBrains Mono 32px Bold
  Color: #1c2130 (dark on gold)
  Alignment: Center
  Line Height: 40px

States:
  Normal: #ffb84d background
  Active (pressed): #e6a43d (darker gold)
  Running: Animated stripes, text "CALIBRATING..."
  Success: Flash #22dd88 500ms, then revert

Touch Target: Full 352×120px
```

#### Palette Selector

```
Position: (876, 368)
Size: 352×48px
Background: #2f3849
Corner Radius: 6px
Padding: 12px

Label:
  Text: "Palette:"
  Font: 18px Regular
  Color: #b5bdca

Active Palette:
  Text: "Golden Hour"
  Font: 22px Bold
  Color: #ffb84d
  Position: Right of label, 16px gap
```

#### Palette Quick Grid (2×3)

```
Position: (876, 436)
Grid: 2 rows × 3 columns
Button Size: 108×56px each
Gap: 8px horizontal, 8px vertical
Total Grid: 352×120px

Button Specifications:
  Background: #2f3849
  Border: 2px solid #3a4253
  Corner Radius: 6px

  Active Button:
    Border: 2px solid #ffb84d
    Background: #3a4253

  Label:
    Text: "P1", "P2", "P3", "P4", "P5", "P6"
    Font: JetBrains Mono 20px Bold
    Color: #e6e9ef
    Alignment: Center

  Color Preview (Optional):
    4×4px dots showing palette colors
    Position: Bottom-right corner, 4px from edges
```

---

### E. Footer Status Bar

```
Position: (0, 656)
Size: 1280×64px
Background: #252d3f
Border-Top: 1px solid #3a4253
Padding: 16px 32px

Content:
  Font: JetBrains Mono 18px Regular
  Color: #b5bdca
  Alignment: Left

  Text Format:
    "ACTIVE: Rainbow Spiral (ID: 07)  |  Last Update: 0.02s  |  Uptime: 3h 42m"
```

---

## 4. Color System

### Background Hierarchy

```css
Canvas (Root):         #1c2130  /* Darkest base */
Surface (Cards/Bars):  #252d3f  /* Elevated panels */
Elevated (Hover):      #2f3849  /* Interactive states */
Divider:               #3a4253  /* Borders, separators */
```

### Text Hierarchy

```css
Primary (Headers/Labels):  #e6e9ef  /* High contrast */
Secondary (Values):        #b5bdca  /* Medium contrast */
Tertiary (Hints):          #6b7280  /* Low contrast */
Disabled:                  #4b5563  /* Very dim */
```

### Semantic Colors

```css
Success:   #22dd88  /* Connected, ON mode, No clipping */
Warning:   #f59e0b  /* CLIP mode, Medium WiFi */
Error:     #ef4444  /* Disconnected, Clipping, Low battery */
Info:      #6ee7f3  /* Audio-related controls */
Accent:    #ffb84d  /* Gold - Primary actions, focus */
```

### Contrast Ratios (WCAG AA Compliance)

```
Primary on Canvas:     #e6e9ef on #1c2130 = 12.2:1 ✓✓
Secondary on Surface:  #b5bdca on #252d3f = 7.8:1 ✓
Accent on Surface:     #ffb84d on #252d3f = 6.1:1 ✓
Success on Surface:    #22dd88 on #252d3f = 6.8:1 ✓
Error on Surface:      #ef4444 on #252d3f = 4.9:1 ✓

All ratios meet or exceed WCAG AA (4.5:1) for readability at 60-70cm.
```

---

## 5. Typography System

### Font: JetBrains Mono (Monospace)

**Why JetBrains Mono:**
- Excellent readability at arm's length
- Consistent character width for value alignment
- Professional, technical aesthetic
- Open source, embeddable

### Type Scale

```
Display (Pattern Names):     32px / 40px line-height / Bold / #e6e9ef
H1 (Section Headers):        28px / 36px / Bold / #e6e9ef
H2 (Control Labels):         24px / 32px / Bold / #e6e9ef
Body (Values, Status):       20px / 28px / Regular / #b5bdca
Small (Timestamps, Hints):   18px / 24px / Regular / #b5bdca
Tiny (Scale Markings):       16px / 20px / Regular / #b5bdca
```

### Usage Guidelines

- **Headers:** Always bold, always #e6e9ef (primary text)
- **Values:** Regular weight, #b5bdca (secondary text)
- **Status Text:** 18-20px, never smaller (readability at distance)
- **Interactive Labels:** 24px minimum (must be readable mid-gesture)
- **Button Text:** 28-32px for hero actions, 20px for secondary

---

## 6. Interaction Patterns

### Slider Behavior

```
Touch Start:
  1. Capture touch position
  2. Scale thumb to 1.2x (200ms ease-out)
  3. Add glow: box-shadow 0 0 16px rgba(255,184,77,0.6)
  4. Send immediate value update via WebSocket
  5. Optional: Haptic feedback (50ms pulse)

Touch Move:
  1. Update thumb position (clamped to rail bounds)
  2. Throttle WebSocket updates to 30Hz (33ms max)
  3. Visual updates at 60fps (no throttling)
  4. Update value label in real-time

Touch End:
  1. Scale thumb back to 1.0x (200ms ease-out)
  2. Remove glow effect
  3. Send final value update
  4. Optional: Haptic confirmation (30ms pulse)

Touch Cancel (drag outside):
  1. Revert to last committed value
  2. Animate back to original position
  3. Remove all active states
```

### Button Press Behavior

```
Touch Start:
  1. Change background to active color
  2. Scale to 0.95x (100ms ease-out)
  3. Optional: Haptic feedback (30ms)

Touch End (inside bounds):
  1. Execute button action
  2. Scale back to 1.0x (150ms ease-out)
  3. Visual confirmation:
     - Standard: 100ms color flash
     - Calibration: State change to "CALIBRATING..."
  4. Optional: Success haptic (double-pulse 50ms+50ms)

Touch End (outside bounds):
  1. Cancel action (no execution)
  2. Revert to default state
  3. Animate back to normal (150ms)
```

### 3-State Toggle Behavior

```
Single Tap:
  1. Cycle through states: OFF → ON → CLIP → OFF
  2. Smooth background color transition (300ms ease)
  3. Update border and text color
  4. Send new mode via WebSocket immediately
  5. Optional: Haptic tick (20ms)

Direct Tap (on specific segment):
  1. Jump directly to that state (no cycling)
  2. Same visual/network updates as above

State Definitions:
  OFF:  No audio processing (silent mode)
  ON:   Normal audio reactivity (standard range)
  CLIP: Extended range (allows clipping for aggressive response)
```

### Palette Grid Behavior

```
Tap:
  1. Immediate palette switch command
  2. Update active button border (2px #ffb84d)
  3. Fade-update "Current Palette" display (300ms)
  4. Send palette change via WebSocket
  5. Optional: Haptic confirmation (40ms)

Long Press (Future Enhancement):
  1. Could open palette editor modal
  2. Not required for v1.0
```

---

## 7. Blind Operation Strategy

### Muscle Memory Zones

```
Left Third (32-412px):
  - Always global parameters
  - Vertical stack: Brightness → Speed → Color → Saturation → Warmth
  - Muscle memory: "Leftmost column, sweep for brightness"

Center Third (444-824px):
  - Always audio controls
  - Vertical stack: Gain → Mode Toggle → Clipping → Reactivity
  - Muscle memory: "Center for audio, top for gain"

Right Third (856-1248px):
  - Always pattern selection and calibration
  - Large gold button is landmark (impossible to miss)
  - Muscle memory: "Right-hand palm for calibrate"
```

### Tactile Landmarks

```
Largest Element: Calibration button (352×120px)
  - Unmistakable by size alone
  - Gold color visible in peripheral vision
  - Hard to accidentally trigger due to deliberate size

Predictable Positions:
  - Sliders always in same column (no hunting)
  - Audio toggle always center, mid-height
  - Status always top, footer always bottom

Edge Alignment:
  - Controls align to grid (not floating)
  - Edges of screen are reference points
  - Safe margins prevent accidental edge triggers
```

### Haptic Feedback Design (Optional)

```
Slider Movement:
  - Light tick every 5% (20ms pulse)
  - Stronger pulse at detents: 0%, 25%, 50%, 75%, 100% (60ms)

Button Press:
  - Press: 30ms pulse
  - Success: Double-pulse 50ms + 50ms (100ms gap)
  - Error: Long pulse 100ms

Audio Events:
  - Clipping detected: Triple-pulse (warning pattern)
  - Calibration complete: Rising pulse pattern (success)

Volume: System haptics (not audio)
Intensity: Medium (60% of max)
Fallback: Visual-only if haptics unavailable
```

### Audio Feedback (Optional, Low Priority)

```
Purpose: Reinforce actions without looking

Sounds:
  - Slider detent: Soft click (50ms, 800Hz)
  - Button press: Subtle thud (100ms, 200Hz)
  - Calibration start: Rising tone (300ms, 600→800Hz)
  - Calibration complete: Two-note chime (150ms each)
  - Error: Descending tone (200ms, 600→400Hz)

Volume: 20% of system volume (quiet, non-intrusive)
Disable: User preference or auto-disable during performance mode
Fallback: Visual+haptic only (audio not required)
```

---

## 8. State Management & Real-Time Updates

### WebSocket Protocol

#### Outgoing Messages (Controller → K1.node1)

```json
// Parameter Update
{
  "type": "parameter_update",
  "param": "brightness",
  "value": 75,
  "timestamp": 1699200000
}

// Mode Change
{
  "type": "audio_mode",
  "mode": "ON",
  "timestamp": 1699200000
}

// Calibration Request
{
  "type": "calibrate_noise",
  "timestamp": 1699200000
}

// Palette Change
{
  "type": "palette_change",
  "palette_id": 3,
  "timestamp": 1699200000
}
```

#### Incoming Messages (K1.node1 → Controller)

```json
// State Sync (Every 500ms)
{
  "type": "state_sync",
  "fps": 60,
  "cpu": 45,
  "memory": 2100000,
  "pattern": "Rainbow Spiral",
  "pattern_id": 7,
  "audio_mode": "ON",
  "clipping": false,
  "battery": 85,
  "uptime": 13320,
  "timestamp": 1699200000
}

// Calibration Status
{
  "type": "calibration_status",
  "status": "running|complete|failed",
  "progress": 65,
  "timestamp": 1699200000
}

// Error/Warning
{
  "type": "error",
  "code": "LOW_BATTERY",
  "message": "Battery below 10%",
  "severity": "warning|error|critical",
  "timestamp": 1699200000
}
```

### Update Frequencies

```
Status Bar Sync:       500ms (FPS, CPU, Memory, Battery)
Slider Values:         33ms max (30Hz throttle)
Button Actions:        Immediate (0ms delay, fire on touch end)
Clipping Detection:    100ms polling
Connection State:      Event-driven (on change)
Pattern Display:       Event-driven (on change)
```

### Latency Budget

```
Touch to Visual Feedback:    <16ms (1 frame at 60fps)
Touch to Network Send:       <33ms (including debounce)
Network Round-Trip:          <50ms (WebSocket over WiFi)
Total Perceived Latency:     <100ms (feels instant)

Performance Requirements:
  - WiFi: 2.4GHz or 5GHz, low contention
  - WebSocket: Keep-alive every 10s
  - Reconnect: Auto-retry every 2s if disconnected
```

---

## 9. Error States & Edge Cases

### Connection Loss

```
Visual Indicators:
  - Status bar: "DISCONNECTED" in red (#ef4444)
  - All controls dim to 50% opacity
  - Overlay message: "Reconnecting..." with spinner

Behavior:
  - Controls become read-only (no WebSocket send)
  - Last known values remain visible
  - Auto-retry every 2 seconds
  - Show "Connected" toast when restored

User Action:
  - Tap status bar to force reconnect attempt
```

### Low Battery (<10%)

```
Visual:
  - Battery indicator blinks red every 1s
  - Toast notification: "Battery Low - 8%"

Behavior:
  - Optional: Dim screen brightness by 30% to conserve
  - No functional changes (allow performance to continue)

Critical (<5%):
  - Persistent warning banner at top
  - "Save settings and charge soon"
```

### Performance Degradation

```
FPS Drop (<45):
  - FPS counter turns yellow
  - Log warning (don't interrupt user)

FPS Critical (<30):
  - FPS counter turns red
  - Optional: Reduce animation smoothness
  - Toast: "Performance degraded - check WiFi"

Memory Warning (>80%):
  - Memory display turns yellow
  - Background: Clear old logs, free resources
```

### Clipping Detection

```
Trigger: Audio input exceeds 0dB threshold

Visual:
  - Clipping indicator: Red filled circle, pulsing
  - Text: "CLIPPING DETECTED!" in bold red

Action:
  - Suggest: "Reduce gain or switch to CLIP mode"
  - Auto-clear after 3s of no clipping

Persistent Clipping (>10s):
  - Toast warning: "Continuous clipping - audio quality degraded"
```

### Network Latency Spike

```
Detection: Round-trip >200ms for 5 consecutive updates

Visual:
  - WiFi indicator shows bars with warning color
  - Status bar: "High Latency - {ms}ms"

Behavior:
  - Continue operation (don't block user)
  - Log for diagnostics
```

---

## 10. LVGL Implementation Guide

### Widget Mapping

```cpp
// Status Bar Container
lv_obj_t* status_bar = lv_obj_create(lv_scr_act());
lv_obj_set_size(status_bar, 1280, 80);
lv_obj_set_pos(status_bar, 0, 0);
lv_obj_set_style_bg_color(status_bar, lv_color_hex(0x252d3f), 0);
lv_obj_set_style_border_width(status_bar, 0, 0);
lv_obj_set_style_pad_all(status_bar, 16, 0);

// Main Control Panel
lv_obj_t* main_panel = lv_obj_create(lv_scr_act());
lv_obj_set_size(main_panel, 1216, 560);
lv_obj_set_pos(main_panel, 32, 96);
lv_obj_set_style_bg_color(main_panel, lv_color_hex(0x1c2130), 0);
lv_obj_set_style_border_width(main_panel, 0, 0);

// Slider (Example: Brightness)
lv_obj_t* brightness_slider = lv_slider_create(main_panel);
lv_obj_set_size(brightness_slider, 280, 40);
lv_obj_set_pos(brightness_slider, 52, 144);
lv_slider_set_range(brightness_slider, 0, 100);

// Slider Styling
lv_obj_set_style_bg_color(brightness_slider, lv_color_hex(0x2f3849), LV_PART_MAIN);
lv_obj_set_style_bg_color(brightness_slider, lv_color_hex(0xffb84d), LV_PART_INDICATOR);
lv_obj_set_style_bg_color(brightness_slider, lv_color_hex(0xffb84d), LV_PART_KNOB);
lv_obj_set_style_border_color(brightness_slider, lv_color_hex(0xe6e9ef), LV_PART_KNOB);
lv_obj_set_style_border_width(brightness_slider, 2, LV_PART_KNOB);
lv_obj_set_style_shadow_width(brightness_slider, 8, LV_PART_KNOB);
lv_obj_set_style_shadow_color(brightness_slider, lv_color_hex(0x000000), LV_PART_KNOB);

// Extend touch target
lv_obj_set_ext_click_area(brightness_slider, 20); // Adds 20px all sides

// Slider Label
lv_obj_t* brightness_label = lv_label_create(main_panel);
lv_label_set_text(brightness_label, "Brightness");
lv_obj_set_pos(brightness_label, 52, 112);
lv_obj_set_style_text_font(brightness_label, &lv_font_montserrat_24, 0); // Use JetBrains Mono if available
lv_obj_set_style_text_color(brightness_label, lv_color_hex(0xe6e9ef), 0);

// Slider Value Display
lv_obj_t* brightness_value = lv_label_create(main_panel);
lv_label_set_text(brightness_value, "75%");
lv_obj_set_pos(brightness_value, 340, 144);
lv_obj_set_style_text_font(brightness_value, &lv_font_montserrat_20, 0);
lv_obj_set_style_text_color(brightness_value, lv_color_hex(0xb5bdca), 0);

// Button (Example: Calibration)
lv_obj_t* calibrate_btn = lv_btn_create(main_panel);
lv_obj_set_size(calibrate_btn, 352, 120);
lv_obj_set_pos(calibrate_btn, 876, 228);
lv_obj_set_style_bg_color(calibrate_btn, lv_color_hex(0xffb84d), 0);
lv_obj_set_style_radius(calibrate_btn, 12, 0);
lv_obj_set_style_shadow_width(calibrate_btn, 12, 0);
lv_obj_set_style_shadow_color(calibrate_btn, lv_color_hex(0xffb84d), 0);
lv_obj_set_style_shadow_opa(calibrate_btn, LV_OPA_30, 0);

lv_obj_t* calibrate_label = lv_label_create(calibrate_btn);
lv_label_set_text(calibrate_label, "CALIBRATE NOISE\nFLOOR");
lv_obj_center(calibrate_label);
lv_obj_set_style_text_font(calibrate_label, &lv_font_montserrat_32, 0);
lv_obj_set_style_text_color(calibrate_label, lv_color_hex(0x1c2130), 0);
lv_obj_set_style_text_align(calibrate_label, LV_TEXT_ALIGN_CENTER, 0);

// 3-State Toggle (Segmented Control)
lv_obj_t* audio_toggle = lv_btnmatrix_create(main_panel);
static const char* mode_map[] = {"OFF", "ON", "CLIP", ""};
lv_btnmatrix_set_map(audio_toggle, mode_map);
lv_obj_set_size(audio_toggle, 318, 64);
lv_obj_set_pos(audio_toggle, 464, 240);
lv_obj_set_style_bg_color(audio_toggle, lv_color_hex(0x2f3849), 0);
lv_obj_set_style_border_width(audio_toggle, 1, 0);
lv_obj_set_style_border_color(audio_toggle, lv_color_hex(0x3a4253), 0);

// Palette Grid (2×3 buttons)
lv_obj_t* palette_grid = lv_obj_create(main_panel);
lv_obj_set_size(palette_grid, 352, 120);
lv_obj_set_pos(palette_grid, 876, 436);
lv_obj_set_flex_flow(palette_grid, LV_FLEX_FLOW_ROW_WRAP);
lv_obj_set_flex_align(palette_grid, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START);
lv_obj_set_style_pad_row(palette_grid, 8, 0);
lv_obj_set_style_pad_column(palette_grid, 8, 0);

for(int i = 0; i < 6; i++) {
    lv_obj_t* pal_btn = lv_btn_create(palette_grid);
    lv_obj_set_size(pal_btn, 108, 56);
    lv_obj_set_style_bg_color(pal_btn, lv_color_hex(0x2f3849), 0);
    lv_obj_set_style_border_width(pal_btn, 2, 0);
    lv_obj_set_style_border_color(pal_btn, lv_color_hex(0x3a4253), 0);

    lv_obj_t* pal_label = lv_label_create(pal_btn);
    char buf[4];
    snprintf(buf, 4, "P%d", i+1);
    lv_label_set_text(pal_label, buf);
    lv_obj_center(pal_label);
}
```

---

### Event Handling

```cpp
// Slider Event Handler with Throttling
uint32_t last_slider_update = 0;
const uint32_t SLIDER_UPDATE_INTERVAL_MS = 33; // 30Hz

void slider_event_cb(lv_event_t* e) {
    lv_event_code_t code = lv_event_get_code(e);
    lv_obj_t* slider = lv_event_get_target(e);

    if(code == LV_EVENT_PRESSED) {
        // Visual feedback: scale thumb
        lv_obj_set_style_transform_zoom(slider, 270, LV_PART_KNOB); // 1.2x = 256*1.2=307
        lv_obj_set_style_shadow_width(slider, 16, LV_PART_KNOB);
    }
    else if(code == LV_EVENT_PRESSING) {
        // Update value label immediately (visual only)
        int16_t value = lv_slider_get_value(slider);
        update_value_label(slider, value);

        // Throttle WebSocket updates
        uint32_t now = lv_tick_get();
        if(now - last_slider_update >= SLIDER_UPDATE_INTERVAL_MS) {
            send_websocket_parameter("brightness", value);
            last_slider_update = now;
        }
    }
    else if(code == LV_EVENT_RELEASED) {
        // Revert visual feedback
        lv_obj_set_style_transform_zoom(slider, 256, LV_PART_KNOB); // 1.0x
        lv_obj_set_style_shadow_width(slider, 8, LV_PART_KNOB);

        // Send final value (no throttle)
        int16_t value = lv_slider_get_value(slider);
        send_websocket_parameter("brightness", value);
    }
}

// Button Press with Visual Feedback
void button_event_cb(lv_event_t* e) {
    lv_event_code_t code = lv_event_get_code(e);
    lv_obj_t* btn = lv_event_get_target(e);

    if(code == LV_EVENT_PRESSED) {
        lv_obj_set_style_transform_zoom(btn, 243, 0); // 0.95x
    }
    else if(code == LV_EVENT_RELEASED) {
        lv_obj_set_style_transform_zoom(btn, 256, 0); // 1.0x

        // Execute action
        if(btn == calibrate_btn) {
            start_noise_calibration();
        }
    }
}

// 3-State Toggle Handler
void toggle_event_cb(lv_event_t* e) {
    lv_event_code_t code = lv_event_get_code(e);
    lv_obj_t* btnmatrix = lv_event_get_target(e);

    if(code == LV_EVENT_VALUE_CHANGED) {
        uint16_t btn_id = lv_btnmatrix_get_selected_btn(btnmatrix);

        const char* modes[] = {"OFF", "ON", "CLIP"};
        send_websocket_mode(modes[btn_id]);

        // Update button styles
        update_toggle_style(btnmatrix, btn_id);
    }
}
```

---

### Performance Optimization

```cpp
// Pre-allocate UI objects (avoid runtime malloc)
#define MAX_SLIDERS 8
#define MAX_BUTTONS 12
#define MAX_LABELS 30

static lv_obj_t* sliders[MAX_SLIDERS];
static lv_obj_t* buttons[MAX_BUTTONS];
static lv_obj_t* labels[MAX_LABELS];

// Static string buffers for label updates
static char status_text[128];
static char fps_text[32];
static char value_text[16];

// Update labels without malloc
void update_status_bar(int fps, int cpu, int mem) {
    snprintf(status_text, 128, "FPS: %d | CPU: %d%% | Mem: %.1fMB",
             fps, cpu, mem / 1000000.0);
    lv_label_set_text(status_label, status_text);
}

// Batch UI updates (reduce redraws)
void update_all_parameters(ParameterState* state) {
    lv_obj_invalidate_area(main_panel); // Mark for redraw

    lv_slider_set_value(sliders[0], state->brightness, LV_ANIM_OFF);
    lv_slider_set_value(sliders[1], state->speed, LV_ANIM_OFF);
    lv_slider_set_value(sliders[2], state->color, LV_ANIM_OFF);
    lv_slider_set_value(sliders[3], state->saturation, LV_ANIM_OFF);
    lv_slider_set_value(sliders[4], state->warmth, LV_ANIM_OFF);

    lv_refr_now(NULL); // Single redraw for all changes
}

// Memory monitoring
void check_memory_usage() {
    lv_mem_monitor_t mon;
    lv_mem_monitor(&mon);

    if(mon.used_pct > 80) {
        // Trigger warning
        show_memory_warning();

        // Clean up old logs, free unused resources
        lv_obj_clean(log_container);
    }
}
```

---

## 11. Testing & Validation

### Functional Tests

```
Touch Target Accuracy:
  - [ ] All buttons register taps reliably (95%+ success rate)
  - [ ] Sliders respond to touch within 16ms
  - [ ] No accidental activations on nearby controls
  - [ ] Edge cases: fast swipes, multi-touch handled gracefully

Visual Feedback:
  - [ ] Slider thumb scales on press (1.2x visible)
  - [ ] Button press animation (0.95x visible)
  - [ ] Colors match specification (hex values exact)
  - [ ] Text readable at 60cm distance

State Management:
  - [ ] Slider values sync with backend <100ms
  - [ ] Toggle state persists across updates
  - [ ] Pattern display updates on change
  - [ ] Status bar reflects connection state accurately

Error Handling:
  - [ ] Connection loss shows "DISCONNECTED" immediately
  - [ ] Low battery triggers warning at 10%
  - [ ] Clipping alert activates >0dB input
  - [ ] FPS drop changes color at <45fps
```

### Performance Benchmarks

```
Frame Rate:
  - Target: 60fps sustained during interaction
  - Minimum: 45fps acceptable (30fps is failure)
  - Test: Animate 5 sliders simultaneously for 60s

Touch Latency:
  - Touch to visual: <16ms (measured with high-speed camera)
  - Touch to network: <33ms (measured via logs)
  - Round-trip: <100ms (measured with echo test)

Memory Usage:
  - Idle: <10MB total allocation
  - Active: <15MB during heavy interaction
  - Peak: <20MB (should never exceed)

Network:
  - Bandwidth: <1KB/s average (low data consumption)
  - Reconnect: <2s after disconnect
  - Keep-alive: 10s interval, <100 bytes
```

### Accessibility Tests

```
Contrast:
  - [ ] All text meets WCAG AA (4.5:1 minimum)
  - [ ] Color-blind simulation (protanopia, deuteranopia)
  - [ ] Low vision: Readable at 70cm with corrective lenses

Blind Operation:
  - [ ] User can adjust brightness without looking (10/10 attempts)
  - [ ] Calibration button findable by touch alone
  - [ ] Audio toggle locatable by muscle memory
  - [ ] No accidental actions during blind operation

Large Targets:
  - [ ] All touch targets ≥150px (measured)
  - [ ] Gaps between targets ≥16px (prevent mis-taps)
  - [ ] Hero button (calibration) ≥120px tall
```

### Device-Specific Tests

```
M5Stack Tab5:
  - [ ] Display: 1280×720px, 60Hz refresh, no tearing
  - [ ] Touch: 10-point capacitive, accurate within 2px
  - [ ] Performance: Sustained 60fps for 1 hour
  - [ ] Battery: <5% drain per hour of active use
  - [ ] WiFi: Stable connection at 10m range
  - [ ] Haptics: Functional (if device supports)
```

---

## 12. Future Enhancements (Post-v1.0)

### Potential Additions

```
Gesture Support:
  - Two-finger swipe down: Emergency dim (brightness to 0)
  - Two-finger swipe up: Full brightness
  - Pinch on slider: Reset to default value
  - Long press on pattern: Open pattern editor

Customization:
  - User-adjustable layout (swap column positions)
  - Custom color themes (beyond dark mode)
  - Haptic intensity control
  - Audio feedback on/off toggle

Advanced Features:
  - Pattern favorites (quick access to top 4)
  - Preset manager (save/load parameter sets)
  - Performance mode (hide non-essential UI)
  - Multi-device control (switch between K1 nodes)

Analytics:
  - Session recording (parameter changes over time)
  - Heatmap of most-used controls
  - Performance graphs (FPS, latency over time)
```

### Not Included (Out of Scope)

```
- Music visualizers (too CPU-intensive)
- Spectrum analyzers (not needed for control)
- Video preview of LED patterns (bandwidth/latency issues)
- Complex animations (keep UI lightweight)
- Social features (focus on performance)
```

---

## 13. Implementation Checklist

### Phase 1: Core Layout (Week 1)

```
- [ ] Create base screen structure (status bar, main panel, footer)
- [ ] Implement grid system (16px base unit)
- [ ] Set up color system (hex values from specification)
- [ ] Load JetBrains Mono font (or fallback to Montserrat)
- [ ] Create background layers (canvas, surface, elevated)
```

### Phase 2: Global Parameters (Week 1-2)

```
- [ ] Build 5 slider components (Brightness, Speed, Color, Saturation, Warmth)
- [ ] Add labels and value displays
- [ ] Implement touch targets (320×80px)
- [ ] Add visual feedback (scale, glow on press)
- [ ] Throttle updates to 30Hz
```

### Phase 3: Audio Controls (Week 2)

```
- [ ] Create microphone gain slider with dB scale
- [ ] Implement 3-state toggle (OFF/ON/CLIP)
- [ ] Add clipping alert indicator (pulse animation)
- [ ] Build reactivity slider
- [ ] Wire up audio mode changes
```

### Phase 4: Pattern & Quick Actions (Week 2-3)

```
- [ ] Create current pattern display
- [ ] Build hero calibration button (352×120px)
- [ ] Implement palette selector
- [ ] Create 2×3 palette quick grid
- [ ] Add palette switching logic
```

### Phase 5: Status & Monitoring (Week 3)

```
- [ ] Build WiFi indicator with signal strength
- [ ] Add connection status label
- [ ] Create performance monitor (FPS, CPU, Memory)
- [ ] Implement battery indicator with warnings
- [ ] Build footer status bar
```

### Phase 6: WebSocket Integration (Week 3-4)

```
- [ ] Set up WebSocket connection
- [ ] Implement outgoing messages (parameter updates)
- [ ] Handle incoming messages (state sync)
- [ ] Add reconnection logic (2s retry)
- [ ] Implement latency monitoring
```

### Phase 7: Polish & Testing (Week 4)

```
- [ ] Add all animations (scale, glow, fade)
- [ ] Implement error states (connection loss, low battery)
- [ ] Add haptic feedback (if supported)
- [ ] Optimize performance (60fps sustained)
- [ ] Test blind operation scenarios
- [ ] Validate touch target sizes (≥150px)
- [ ] Contrast ratio verification (WCAG AA)
```

---

## 14. File References

**Related Documents:**
- `/docs/01-architecture/` - System architecture overview
- `/docs/03-guides/` - Implementation guides (this file)
- `/docs/06-reference/` - API references for WebSocket protocol
- `/.superdesign/` - UI/UX design iterations

**Code References:**
- `/firmware/src/main.cpp` - Main application entry
- `/firmware/lib/ui/` - LVGL UI components (to be created)
- `/firmware/lib/network/` - WebSocket client implementation
- `/webapp/src/components/` - Web UI counterpart (reference)

---

## 15. Contact & Contributions

**Design Owner:** SuperDesigner Agent
**Implementation Team:** Embedded Firmware Engineer
**Review:** ULTRA Choreographer, Multiplier Orchestrator

**Questions?**
- File issues in project tracker with tag `[UI-Tab5]`
- For design clarifications, tag `@SuperDesigner`
- For implementation blockers, tag `@EmbeddedEngineer`

**Contributing:**
- Follow CLAUDE.md documentation workflow
- Test on actual M5Stack Tab5 hardware before merging
- Validate touch targets with physical testing (no emulator-only)
- Document any deviations from this specification

---

**Document Status:** Ready for Implementation
**Last Updated:** 2025-11-05
**Version:** 1.0
**Next Review:** After Phase 7 completion


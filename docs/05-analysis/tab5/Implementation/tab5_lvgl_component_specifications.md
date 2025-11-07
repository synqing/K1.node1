---
Title: Tab5 Wireless Controller - LVGL Component Specifications
Owner: K1 Development Team
Date: 2025-11-05
Status: published
Scope: Implementation-ready C++ LVGL specifications for Tab5 UI components
Related:
  - docs/04-planning/tab5_controller_specification.md
  - docs/04-planning/tab5_ui_interactions_detailed.md
  - docs/07-resources/M5Stack_Tab5_Specifications.md
Tags: Tab5, LVGL, C++, UI Components, Embedded UI
---

# Tab5 Wireless Controller - LVGL Component Specifications

**Audience:** C++ embedded developers implementing Tab5 controller UI
**Device:** M5Stack Tab5 (ESP32-P4, 1280×720 IPS display)
**Framework:** LVGL (Light and Versatile Graphics Library)
**Display:** 5-inch, 1280×720 pixels, capacitive touchscreen
**Target Refresh:** 60 Hz (16.67 ms per frame)

---

## Executive Summary

This document provides pixel-perfect, implementation-ready specifications for all Tab5 wireless controller UI components in C++ using LVGL. Each component includes:

- LVGL object type and initialization code
- Exact dimensions (width, height, padding, margins)
- Style definitions (colors, fonts, borders, shadows)
- Event handlers (touch, drag, press, release, focus)
- Update frequency and refresh strategies
- Animation timings and visual feedback
- Error state handling
- Accessibility considerations

All specifications are based on the Tab5 MVP UI design and K1.reinvented design system (PRISM color tokens).

---

## 1. DESIGN SYSTEM & COLOR REFERENCE

### 1.1 PRISM Color Palette (For Tab5 LVGL)

Tab5 uses the PRISM terminal color system, optimized for 1280×720 displays at arm's-length viewing distance (48-60 inches).

| Token Name | Hex Value | RGB | Usage |
|---|---|---|---|
| `prism-bg-canvas` | `#252d3f` | 37, 45, 63 | Primary background |
| `prism-bg-elevated` | `#2f3849` | 47, 56, 73 | Secondary background (buttons, cards) |
| `prism-bg-highlighted` | `#3a4457` | 58, 68, 87 | Selected/active items |
| `prism-text-primary` | `#e6e9ef` | 230, 233, 239 | Main text (white-ish) |
| `prism-text-secondary` | `#9ca3af` | 156, 163, 175 | Secondary/hint text |
| `prism-border-color` | `#2f3849` | 47, 56, 73 | Borders, dividers |
| `prism-accent-color` | `#14b8a6` | 20, 184, 166 | Interactive elements (teal) |
| `prism-success-color` | `#10b981` | 16, 185, 129 | Success states (green) |
| `prism-warning-color` | `#f59e0b` | 245, 158, 11 | Warning states (amber) |
| `prism-error-color` | `#ef4444` | 239, 68, 68 | Error states (red) |
| `prism-gold-accent` | `#ffb84d` | 255, 184, 77 | Prominent actions (calibration button) |

### 1.2 Typography

| Level | Font | Size | Weight | Use Case |
|---|---|---|---|---|
| H1 (Header) | JetBrains Mono | 36px | Bold (700) | Pattern name display |
| H2 (Subheader) | JetBrains Mono | 20px | SemiBold (600) | Section titles |
| Body (Labels) | Inter/System Font | 14px | Regular (400) | Control labels, button text |
| Small (Values) | JetBrains Mono | 12px | Regular (400) | Parameter values, hints |
| Micro (Footer) | Inter/System Font | 11px | Regular (400) | Timestamps, secondary info |

**Font Recommendations for ESP32:**
- Use system fonts (monospace, sans-serif) built into LVGL
- Pre-render glyphs for non-ASCII characters at compile time
- Store fonts in PSRAM if custom font sizes needed

---

## 2. COMPONENT TYPE SPECIFICATIONS

### 2.1 Horizontal Slider (Continuous Parameters)

**Used for:** Brightness, Speed, Color, Saturation, Warmth, Background, Dithering, Microphone Gain, etc.

#### Dimensions & Layout

```cpp
// Slider dimensions (relative to 1280x720 canvas)
// All coordinates in pixels

#define SLIDER_WIDTH        380        // 380px wide (fits in left column)
#define SLIDER_HEIGHT       60         // 60px total height (label + track)
#define SLIDER_TRACK_HEIGHT 8          // Track thickness
#define SLIDER_THUMB_WIDTH  48         // Thumb diameter (48x48 for touch)
#define SLIDER_THUMB_HEIGHT 48
#define SLIDER_PADDING_X    20         // Left/right padding
#define SLIDER_PADDING_Y    8          // Top/bottom padding
#define SLIDER_LABEL_HEIGHT 18         // Height for label text
#define SLIDER_VALUE_WIDTH  50         // Width for value display (right-aligned)

// Slider row positions (y-coordinates in main control panel)
#define SLIDER_BRIGHTNESS_Y 100
#define SLIDER_SPEED_Y      180
#define SLIDER_COLOR_Y      260
#define SLIDER_SAT_Y        340
#define SLIDER_WARMTH_Y     420
#define SLIDER_GAIN_Y       220        // (Audio section)
#define SLIDER_THRESHOLD_Y  310        // (Audio section)
```

#### LVGL Initialization Code

```cpp
// Create slider container (for layout management)
lv_obj_t *slider_container = lv_obj_create(parent);
lv_obj_set_size(slider_container, SLIDER_WIDTH, SLIDER_HEIGHT);
lv_obj_set_pos(slider_container, SLIDER_PADDING_X, SLIDER_BRIGHTNESS_Y);
lv_obj_set_layout(slider_container, LV_LAYOUT_COLUMN);
lv_obj_set_style_bg_opa(slider_container, 0, 0);  // Transparent
lv_obj_set_style_border_width(slider_container, 0, 0);
lv_obj_set_style_pad_all(slider_container, 0, 0);

// Create label (inside container)
lv_obj_t *label = lv_label_create(slider_container);
lv_label_set_text(label, "Brightness");
lv_obj_set_width(label, SLIDER_WIDTH - SLIDER_VALUE_WIDTH);
lv_obj_set_style_text_font(label, &lv_font_montserrat_14, 0);
lv_obj_set_style_text_color(label, lv_color_hex(0xe6e9ef), 0);  // prism-text-primary

// Create value display (right-aligned, inside container)
lv_obj_t *value_label = lv_label_create(slider_container);
lv_label_set_text(value_label, "50%");
lv_obj_set_style_text_font(value_label, &lv_font_montserrat_12, 0);
lv_obj_set_style_text_color(value_label, lv_color_hex(0x14b8a6), 0);  // prism-accent-color
lv_obj_set_width(value_label, SLIDER_VALUE_WIDTH);
lv_obj_set_style_text_align(value_label, LV_TEXT_ALIGN_RIGHT, 0);

// Create slider (inside container)
lv_obj_t *slider = lv_slider_create(slider_container);
lv_obj_set_width(slider, SLIDER_WIDTH);
lv_obj_set_height(slider, SLIDER_THUMB_HEIGHT);
lv_slider_set_range(slider, 0, 100);  // 0-100 for display, convert to 0.0-1.0 in callback
lv_slider_set_value(slider, 50, LV_ANIM_OFF);

// Style: main slider area
lv_obj_set_style_bg_color(slider, lv_color_hex(0x2f3849), LV_PART_MAIN);  // prism-bg-elevated
lv_obj_set_style_bg_opa(slider, 255, LV_PART_MAIN);
lv_obj_set_style_border_width(slider, 0, LV_PART_MAIN);
lv_obj_set_style_radius(slider, 10, LV_PART_MAIN);
lv_obj_set_style_pad_all(slider, 0, LV_PART_MAIN);

// Style: track (the line being dragged)
lv_obj_set_style_bg_color(slider, lv_color_hex(0x14b8a6), LV_PART_INDICATOR);  // prism-accent
lv_obj_set_style_bg_opa(slider, 255, LV_PART_INDICATOR);
lv_obj_set_style_radius(slider, 10, LV_PART_INDICATOR);

// Style: thumb (draggable handle)
lv_obj_set_style_bg_color(slider, lv_color_hex(0x14b8a6), LV_PART_KNOB);
lv_obj_set_style_bg_opa(slider, 255, LV_PART_KNOB);
lv_obj_set_style_border_width(slider, 2, LV_PART_KNOB);
lv_obj_set_style_border_color(slider, lv_color_hex(0xffffff), LV_PART_KNOB);  // White border
lv_obj_set_style_radius(slider, LV_RADIUS_CIRCLE, LV_PART_KNOB);
lv_obj_set_style_pad_all(slider, 6, LV_PART_KNOB);  // Padding around thumb

// Style: focused state (when slider is being dragged)
lv_obj_set_style_bg_color(slider, lv_color_hex(0x3a4457), LV_PART_MAIN | LV_STATE_FOCUSED);  // prism-bg-highlighted
lv_obj_set_style_shadow_width(slider, 12, LV_PART_KNOB | LV_STATE_FOCUSED);
lv_obj_set_style_shadow_color(slider, lv_color_hex(0x14b8a6), LV_PART_KNOB | LV_STATE_FOCUSED);
lv_obj_set_style_shadow_opa(slider, 60, LV_PART_KNOB | LV_STATE_FOCUSED);
lv_obj_set_style_shadow_spread(slider, 4, LV_PART_KNOB | LV_STATE_FOCUSED);

// Style: disabled state
lv_obj_set_style_bg_color(slider, lv_color_hex(0x1f262f), LV_PART_MAIN | LV_STATE_DISABLED);
lv_obj_set_style_bg_opa(slider, 128, LV_PART_KNOB | LV_STATE_DISABLED);
lv_obj_set_style_text_color(slider, lv_color_hex(0x4b5563), LV_PART_MAIN | LV_STATE_DISABLED);

// Event handler (see Section 5 for debounce pattern)
lv_obj_add_event_cb(slider, slider_brightness_event_cb, LV_EVENT_VALUE_CHANGED, NULL);
lv_obj_add_event_cb(slider, slider_brightness_focus_cb, LV_EVENT_FOCUSED, NULL);
lv_obj_add_event_cb(slider, slider_brightness_unfocus_cb, LV_EVENT_DEFOCUSED, NULL);

// Store reference for later updates
slider_brightness = slider;
```

#### Style Definition Template

```cpp
// Apply base slider style (reusable across all sliders)
static lv_style_t style_slider_main;
static lv_style_t style_slider_knob;
static lv_style_t style_slider_knob_focused;

void slider_styles_init(void) {
    // Main slider background
    lv_style_init(&style_slider_main);
    lv_style_set_bg_color(&style_slider_main, lv_color_hex(0x2f3849));
    lv_style_set_bg_opa(&style_slider_main, 255);
    lv_style_set_border_width(&style_slider_main, 0);
    lv_style_set_radius(&style_slider_main, 10);

    // Knob (thumb) base
    lv_style_init(&style_slider_knob);
    lv_style_set_bg_color(&style_slider_knob, lv_color_hex(0x14b8a6));
    lv_style_set_bg_opa(&style_slider_knob, 255);
    lv_style_set_border_width(&style_slider_knob, 2);
    lv_style_set_border_color(&style_slider_knob, lv_color_hex(0xffffff));
    lv_style_set_radius(&style_slider_knob, LV_RADIUS_CIRCLE);

    // Knob focused (when being dragged)
    lv_style_init(&style_slider_knob_focused);
    lv_style_set_shadow_width(&style_slider_knob_focused, 12);
    lv_style_set_shadow_color(&style_slider_knob_focused, lv_color_hex(0x14b8a6));
    lv_style_set_shadow_opa(&style_slider_knob_focused, 60);
    lv_style_set_shadow_spread(&style_slider_knob_focused, 4);
}

// Apply styles to any slider
void apply_slider_style(lv_obj_t *slider) {
    lv_obj_add_style(slider, &style_slider_main, LV_PART_MAIN);
    lv_obj_add_style(slider, &style_slider_knob, LV_PART_KNOB);
    lv_obj_add_style(slider, &style_slider_knob_focused, LV_PART_KNOB | LV_STATE_FOCUSED);
}
```

#### Properties & Behavior

| Property | Value | Notes |
|---|---|---|
| Range | 0.0–1.0 (float) | Converted from LVGL 0–100 integer |
| Debounce | 100ms | On slider drag, delay HTTP request by 100ms |
| Update Frequency | 60 Hz (during drag) | Live value display during user interaction |
| Network Update | ~100ms after drag release | Debounced POST /api/params |
| Value Display | Right-aligned, percentage or decimal | Updated in real-time during drag |
| Touch Sensitivity | 150px minimum width | Exceeded (380px width) for easy control |
| Thumb Size | 48×48 px | Exceeds WCAG 44×44 minimum |
| Accessible | Yes | Large touch target, clear labels |

---

### 2.2 Toggle Switch (Audio On/Off/Clipping)

**Used for:** Audio reactivity enable/disable, clipping indicator

#### Dimensions & Layout

```cpp
#define TOGGLE_WIDTH        150        // 150px minimum (for touch)
#define TOGGLE_HEIGHT       100        // 100px minimum
#define TOGGLE_SWITCH_SIZE  80         // Size of toggle itself
#define TOGGLE_TRACK_HEIGHT 40
#define TOGGLE_TRACK_WIDTH  80
#define TOGGLE_LABEL_Y      TOGGLE_HEIGHT + 16  // Below toggle

// Audio control section positions
#define AUDIO_SECTION_Y     100
#define AUDIO_TOGGLE_X      680        // Right column
#define AUDIO_TOGGLE_Y      100
#define AUDIO_GAIN_X        680
#define AUDIO_GAIN_Y        220
#define AUDIO_VU_X          680
#define AUDIO_VU_Y          320
```

#### LVGL Initialization Code

```cpp
// Create toggle container
lv_obj_t *toggle_container = lv_obj_create(parent);
lv_obj_set_size(toggle_container, TOGGLE_WIDTH, TOGGLE_HEIGHT + 40);  // Include label space
lv_obj_set_pos(toggle_container, AUDIO_TOGGLE_X, AUDIO_TOGGLE_Y);
lv_obj_set_layout(toggle_container, LV_LAYOUT_COLUMN);
lv_obj_set_style_bg_opa(toggle_container, 0, 0);  // Transparent
lv_obj_set_style_border_width(toggle_container, 0, 0);

// Create toggle switch
lv_obj_t *toggle = lv_switch_create(toggle_container);
lv_obj_set_size(toggle, TOGGLE_TRACK_WIDTH, TOGGLE_TRACK_HEIGHT);
lv_switch_set_state(toggle, 0);  // Start in OFF position

// Style: main switch area
lv_obj_set_style_bg_color(toggle, lv_color_hex(0x2f3849), LV_PART_MAIN);  // prism-bg-elevated
lv_obj_set_style_bg_opa(toggle, 255, LV_PART_MAIN);
lv_obj_set_style_border_width(toggle, 2, LV_PART_MAIN);
lv_obj_set_style_border_color(toggle, lv_color_hex(0x4b5563), LV_PART_MAIN);
lv_obj_set_style_radius(toggle, 20, LV_PART_MAIN);  // Pill-shaped

// Style: knob (the sliding part)
lv_obj_set_style_bg_color(toggle, lv_color_hex(0x14b8a6), LV_PART_KNOB);  // prism-accent (teal)
lv_obj_set_style_bg_opa(toggle, 255, LV_PART_KNOB);
lv_obj_set_style_border_width(toggle, 0, LV_PART_KNOB);
lv_obj_set_style_radius(toggle, 20, LV_PART_KNOB);

// Style: checked state (ON)
lv_obj_set_style_bg_color(toggle, lv_color_hex(0x0f766e), LV_PART_MAIN | LV_STATE_CHECKED);  // Darker teal
lv_obj_set_style_bg_color(toggle, lv_color_hex(0x10b981), LV_PART_KNOB | LV_STATE_CHECKED);  // prism-success (green)

// Style: disabled state
lv_obj_set_style_bg_color(toggle, lv_color_hex(0x1f262f), LV_PART_MAIN | LV_STATE_DISABLED);
lv_obj_set_style_bg_opa(toggle, 128, LV_PART_KNOB | LV_STATE_DISABLED);

// Create label below toggle
lv_obj_t *toggle_label = lv_label_create(toggle_container);
lv_label_set_text(toggle_label, "Audio Reactivity");
lv_obj_set_style_text_font(toggle_label, &lv_font_montserrat_12, 0);
lv_obj_set_style_text_color(toggle_label, lv_color_hex(0xe6e9ef), 0);  // prism-text-primary
lv_obj_set_width(toggle_label, TOGGLE_WIDTH);
lv_obj_set_style_text_align(toggle_label, LV_TEXT_ALIGN_CENTER, 0);

// Event handler
lv_obj_add_event_cb(toggle, toggle_audio_event_cb, LV_EVENT_VALUE_CHANGED, NULL);

// Store reference
toggle_audio_reactivity = toggle;
```

#### 3-State Toggle Alternative (OFF, ON, CLIPPING)

```cpp
// If 3-state toggle needed, use button group instead:
// Button 1: OFF (gray)
// Button 2: ON (green)
// Button 3: CLIPPING (red)

lv_obj_t *state_group = lv_btnmatrix_create(parent);
lv_obj_set_size(state_group, 180, 60);
lv_btnmatrix_set_map(state_group, (const char *[]) {"OFF", "ON", "CLIPPING", ""});
lv_btnmatrix_set_btn_width(state_group, 0, 2);  // First button: 2 units
lv_btnmatrix_set_btn_width(state_group, 1, 2);  // Second button: 2 units
lv_btnmatrix_set_btn_width(state_group, 2, 2);  // Third button: 2 units

// Color code states
lv_obj_set_style_bg_color(state_group, lv_color_hex(0x4b5563), 0);                      // OFF: gray
lv_obj_set_style_bg_color(state_group, lv_color_hex(0x10b981), LV_PART_ITEMS);          // ON: green
lv_obj_set_style_bg_color(state_group, lv_color_hex(0xef4444), LV_PART_ITEMS | 0x02);   // CLIPPING: red

// Event handler to track selected state
lv_obj_add_event_cb(state_group, audio_state_event_cb, LV_EVENT_VALUE_CHANGED, NULL);
```

#### Properties & Behavior

| Property | Value | Notes |
|---|---|---|
| States | 2 (OFF/ON) or 3 (OFF/ON/CLIPPING) | Simple toggle vs. multi-state |
| Size | 80×40 px (track) | Exceeds 44×44 touch target |
| Animations | 200ms slide transition | Smooth visual feedback |
| Color OFF | Gray (#4b5563) | Semantic: inactive |
| Color ON | Green (#10b981) | Semantic: active |
| Color CLIPPING | Red (#ef4444) | Semantic: warning |
| Debounce | 50ms | Prevent rapid toggles |
| Update Frequency | On change only | Network update triggered immediately |
| Network Delay | <500ms | User expects immediate response |

---

### 2.3 Button (Noise Calibration, Pattern Selection, Actions)

**Used for:** Calibration, confirm, reset actions. Prominent "gold accent" for primary actions.

#### Dimensions & Layout

```cpp
#define BUTTON_PRIMARY_WIDTH   150       // Primary (gold calibration) button
#define BUTTON_PRIMARY_HEIGHT  150
#define BUTTON_SECONDARY_WIDTH 120       // Secondary buttons
#define BUTTON_SECONDARY_HEIGHT 60

// Calibration button position (right column, prominent)
#define CALIBRATION_BUTTON_X   680
#define CALIBRATION_BUTTON_Y   310

// Preset buttons (below sliders, optional)
#define PRESET_BUTTON_WIDTH    70
#define PRESET_BUTTON_HEIGHT   40
#define PRESET_BUTTON_Y        70        // Below brightness slider
```

#### LVGL Initialization Code - Primary Button (Gold Accent)

```cpp
// Create calibration button (prominent, gold)
lv_obj_t *btn_calibrate = lv_btn_create(parent);
lv_obj_set_size(btn_calibrate, BUTTON_PRIMARY_WIDTH, BUTTON_PRIMARY_HEIGHT);
lv_obj_set_pos(btn_calibrate, CALIBRATION_BUTTON_X, CALIBRATION_BUTTON_Y);
lv_obj_set_style_radius(btn_calibrate, 12, 0);

// Style: primary button (gold background)
lv_obj_set_style_bg_color(btn_calibrate, lv_color_hex(0xffb84d), 0);  // prism-gold-accent
lv_obj_set_style_bg_opa(btn_calibrate, 255, 0);
lv_obj_set_style_border_width(btn_calibrate, 0, 0);
lv_obj_set_style_shadow_width(btn_calibrate, 8, 0);
lv_obj_set_style_shadow_color(btn_calibrate, lv_color_hex(0x00000080), 0);
lv_obj_set_style_shadow_opa(btn_calibrate, 100, 0);
lv_obj_set_style_shadow_spread(btn_calibrate, 2, 0);
lv_obj_set_style_pad_all(btn_calibrate, 12, 0);

// Style: pressed state (darker gold)
lv_obj_set_style_bg_color(btn_calibrate, lv_color_hex(0xf59e0b), LV_STATE_PRESSED);  // Darker
lv_obj_set_style_transform_scale(btn_calibrate, 950, LV_STATE_PRESSED);  // Slight scale down on press

// Style: focused/hover state
lv_obj_set_style_bg_color(btn_calibrate, lv_color_hex(0xffc966), LV_STATE_FOCUS_KEY | LV_STATE_FOCUSED);
lv_obj_set_style_shadow_width(btn_calibrate, 12, LV_STATE_FOCUSED);

// Style: disabled state
lv_obj_set_style_bg_color(btn_calibrate, lv_color_hex(0x4b5563), LV_STATE_DISABLED);
lv_obj_set_style_bg_opa(btn_calibrate, 128, LV_STATE_DISABLED);
lv_obj_set_style_shadow_width(btn_calibrate, 0, LV_STATE_DISABLED);

// Create button label (dark text on gold background)
lv_obj_t *label = lv_label_create(btn_calibrate);
lv_label_set_text(label, "Calibrate\nNoise");
lv_obj_set_style_text_font(label, &lv_font_montserrat_14, 0);
lv_obj_set_style_text_color(label, lv_color_hex(0x1c2130), 0);  // Dark text on gold
lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_CENTER, 0);
lv_obj_center(label);  // Center text in button

// Event handler
lv_obj_add_event_cb(btn_calibrate, button_calibrate_event_cb, LV_EVENT_CLICKED, NULL);

// Store reference
button_calibrate = btn_calibrate;
```

#### LVGL Initialization Code - Secondary Button

```cpp
// Create secondary button (e.g., "Reset" or action button)
lv_obj_t *btn_reset = lv_btn_create(parent);
lv_obj_set_size(btn_reset, BUTTON_SECONDARY_WIDTH, BUTTON_SECONDARY_HEIGHT);
lv_obj_set_pos(btn_reset, CALIBRATION_BUTTON_X, CALIBRATION_BUTTON_Y + 160);

// Style: secondary button (teal/accent background)
lv_obj_set_style_bg_color(btn_reset, lv_color_hex(0x14b8a6), 0);  // prism-accent
lv_obj_set_style_bg_opa(btn_reset, 255, 0);
lv_obj_set_style_border_width(btn_reset, 2, 0);
lv_obj_set_style_border_color(btn_reset, lv_color_hex(0x0f766e), 0);
lv_obj_set_style_radius(btn_reset, 8, 0);
lv_obj_set_style_pad_all(btn_reset, 8, 0);

// Style: pressed state
lv_obj_set_style_bg_color(btn_reset, lv_color_hex(0x0d9488), LV_STATE_PRESSED);
lv_obj_set_style_transform_scale(btn_reset, 950, LV_STATE_PRESSED);

// Create label (white text on teal)
lv_obj_t *label = lv_label_create(btn_reset);
lv_label_set_text(label, "Reset");
lv_obj_set_style_text_font(label, &lv_font_montserrat_12, 0);
lv_obj_set_style_text_color(label, lv_color_hex(0xffffff), 0);  // White text
lv_obj_center(label);

// Event handler
lv_obj_add_event_cb(btn_reset, button_reset_event_cb, LV_EVENT_CLICKED, NULL);
```

#### Preset Button Row (Brightness, Speed presets)

```cpp
// Create button matrix for presets (25%, 50%, 75%, 100%)
lv_obj_t *preset_matrix = lv_btnmatrix_create(parent);
lv_obj_set_size(preset_matrix, 280, PRESET_BUTTON_HEIGHT);
lv_obj_set_pos(preset_matrix, SLIDER_PADDING_X, PRESET_BUTTON_Y);

// Map buttons
lv_btnmatrix_set_map(preset_matrix, (const char *[]) {
    "25%", "50%", "75%", "100%", ""
});

// Style preset buttons
lv_obj_set_style_bg_color(preset_matrix, lv_color_hex(0x2f3849), LV_PART_ITEMS);
lv_obj_set_style_bg_color(preset_matrix, lv_color_hex(0x14b8a6), LV_PART_ITEMS | LV_STATE_CHECKED);
lv_obj_set_style_border_color(preset_matrix, lv_color_hex(0x4b5563), LV_PART_ITEMS);
lv_obj_set_style_border_width(preset_matrix, 1, LV_PART_ITEMS);
lv_obj_set_style_radius(preset_matrix, 6, LV_PART_ITEMS);
lv_obj_set_style_text_color(preset_matrix, lv_color_hex(0xe6e9ef), LV_PART_ITEMS);
lv_obj_set_style_text_color(preset_matrix, lv_color_hex(0x1c2130), LV_PART_ITEMS | LV_STATE_CHECKED);

// Event handler
lv_obj_add_event_cb(preset_matrix, preset_button_event_cb, LV_EVENT_VALUE_CHANGED, NULL);
```

#### Properties & Behavior

| Property | Value | Notes |
|---|---|---|
| Primary Button Size | 150×150 px | Exceeds touch minimum, prominent |
| Secondary Button Size | 120×60 px | Exceeds touch minimum |
| Primary Color | Gold (#ffb84d) | High visibility, semantic: action |
| Secondary Color | Teal (#14b8a6) | Accent color |
| Pressed Effect | 95% scale + darker color | Visual feedback |
| Animation | 100ms press/release | Snappy, not sluggish |
| Touch Target | 150px minimum | Exceeds WCAG guideline |
| Press Behavior | CLICK event fires on release (not press) | Allows touch outside detection |
| Ripple Effect | Optional (high-end devices) | Can add for extra polish |
| Debounce | 200ms (prevent double-taps) | Critical for calibration |

---

### 2.4 Status Display Widget

**Used for:** Real-time system metrics (FPS, CPU%, memory, WiFi, battery)

#### Dimensions & Layout

```cpp
// Status bar (header area)
#define STATUS_BAR_HEIGHT      60
#define STATUS_BAR_Y           0
#define STATUS_ITEM_WIDTH      80
#define STATUS_ITEM_HEIGHT     50

// Status bar positions (left to right)
#define STATUS_WIFI_X          20
#define STATUS_BATTERY_X       110
#define STATUS_FPS_X           200
#define STATUS_CPU_X           290
#define STATUS_MEMORY_X        380

// Status values (right-aligned in status bar)
#define STATUS_VALUE_X_OFFSET  (STATUS_ITEM_WIDTH - 10)
```

#### LVGL Initialization Code - Status Bar Container

```cpp
// Create status bar (horizontal flex container)
lv_obj_t *status_bar = lv_obj_create(parent);
lv_obj_set_size(status_bar, 1280, STATUS_BAR_HEIGHT);
lv_obj_set_pos(status_bar, 0, STATUS_BAR_Y);
lv_obj_set_layout(status_bar, LV_LAYOUT_FLEX);
lv_obj_set_flex_flow(status_bar, LV_FLEX_FLOW_ROW);
lv_obj_set_flex_align(status_bar, LV_FLEX_ALIGN_SPACE_AROUND, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);

// Style status bar
lv_obj_set_style_bg_color(status_bar, lv_color_hex(0x2f3849), 0);  // prism-bg-elevated
lv_obj_set_style_bg_opa(status_bar, 255, 0);
lv_obj_set_style_border_width(status_bar, 1, 0);
lv_obj_set_style_border_color(status_bar, lv_color_hex(0x4b5563), 0);
lv_obj_set_style_border_side(status_bar, LV_BORDER_SIDE_BOTTOM, 0);
lv_obj_set_style_pad_all(status_bar, 8, 0);

// Create individual status items
create_status_item_wifi(status_bar);       // WiFi signal
create_status_item_battery(status_bar);    // Battery %
create_status_item_fps(status_bar);        // FPS counter
create_status_item_cpu(status_bar);        // CPU %
create_status_item_memory(status_bar);     // Memory %

// Store references for updates
status_bar_ref = status_bar;
```

#### LVGL Initialization Code - Individual Status Item

```cpp
// Helper function to create a status item (icon + label + value)
void create_status_item_wifi(lv_obj_t *parent) {
    // Create container for this status item
    lv_obj_t *item = lv_obj_create(parent);
    lv_obj_set_size(item, STATUS_ITEM_WIDTH, STATUS_ITEM_HEIGHT);
    lv_obj_set_layout(item, LV_LAYOUT_COLUMN);
    lv_obj_set_style_bg_opa(item, 0, 0);  // Transparent
    lv_obj_set_style_border_width(item, 0, 0);
    lv_obj_set_style_pad_all(item, 0, 0);

    // Label (WiFi icon or text)
    lv_obj_t *icon = lv_label_create(item);
    lv_label_set_text(icon, "📶");  // Or use custom icon font
    lv_obj_set_style_text_font(icon, &lv_font_montserrat_16, 0);
    lv_obj_set_style_text_color(icon, lv_color_hex(0x14b8a6), 0);

    // Value label (RSSI in dBm)
    lv_obj_t *value = lv_label_create(item);
    lv_label_set_text(value, "-55 dBm");
    lv_obj_set_style_text_font(value, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_color(value, lv_color_hex(0xe6e9ef), 0);  // prism-text-primary

    // Store for updates
    status_wifi_value = value;
}

// Similar pattern for battery, FPS, CPU, memory...
void create_status_item_battery(lv_obj_t *parent) {
    lv_obj_t *item = lv_obj_create(parent);
    lv_obj_set_size(item, STATUS_ITEM_WIDTH, STATUS_ITEM_HEIGHT);
    lv_obj_set_layout(item, LV_LAYOUT_COLUMN);
    lv_obj_set_style_bg_opa(item, 0, 0);
    lv_obj_set_style_border_width(item, 0, 0);

    lv_obj_t *icon = lv_label_create(item);
    lv_label_set_text(icon, "🔋");  // Battery icon
    lv_obj_set_style_text_font(icon, &lv_font_montserrat_16, 0);
    lv_obj_set_style_text_color(icon, lv_color_hex(0x14b8a6), 0);

    lv_obj_t *value = lv_label_create(item);
    lv_label_set_text(value, "87%");
    lv_obj_set_style_text_font(value, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_color(value, lv_color_hex(0xe6e9ef), 0);

    status_battery_value = value;
}

void create_status_item_fps(lv_obj_t *parent) {
    lv_obj_t *item = lv_obj_create(parent);
    lv_obj_set_size(item, STATUS_ITEM_WIDTH, STATUS_ITEM_HEIGHT);
    lv_obj_set_layout(item, LV_LAYOUT_COLUMN);
    lv_obj_set_style_bg_opa(item, 0, 0);
    lv_obj_set_style_border_width(item, 0, 0);

    lv_obj_t *icon = lv_label_create(item);
    lv_label_set_text(icon, "⚡");  // Performance icon
    lv_obj_set_style_text_font(icon, &lv_font_montserrat_16, 0);
    lv_obj_set_style_text_color(icon, lv_color_hex(0x10b981), 0);  // Green by default

    lv_obj_t *value = lv_label_create(item);
    lv_label_set_text(value, "60 FPS");
    lv_obj_set_style_text_font(value, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_color(value, lv_color_hex(0xe6e9ef), 0);

    status_fps_value = value;
}

// CPU and Memory use similar pattern with gauge widgets
void create_status_item_cpu(lv_obj_t *parent) {
    // ... same pattern as above
    // Creates gauge widget for visual representation
    lv_obj_t *gauge = lv_linemeter_create(parent);  // or lv_meter_create
    lv_obj_set_size(gauge, 40, 40);
    lv_meter_set_scale(gauge, 360, 60);  // 0-100% range
    // ... style gauge
}
```

#### Status Item Update Pattern

```cpp
// Poll /api/health every 2-5 seconds
static void update_status_display(void) {
    // Example: FPS is 45 → color should be yellow (warning)
    // CPU is 85% → color should be yellow (warning)
    // Memory is 95% → color should be red (critical)

    // Update FPS
    int fps = get_current_fps();  // From K1 health endpoint
    lv_label_set_text_fmt(status_fps_value, "%d FPS", fps);

    // Color code: < 30 FPS = red, < 50 FPS = yellow, >= 50 FPS = green
    if (fps < 30) {
        lv_obj_set_style_text_color(status_fps_value, lv_color_hex(0xef4444), 0);  // Red
    } else if (fps < 50) {
        lv_obj_set_style_text_color(status_fps_value, lv_color_hex(0xf59e0b), 0);  // Yellow
    } else {
        lv_obj_set_style_text_color(status_fps_value, lv_color_hex(0x10b981), 0);  // Green
    }

    // Update CPU
    float cpu = get_current_cpu();  // Percentage
    lv_label_set_text_fmt(status_cpu_value, "%.0f%%", cpu);

    if (cpu > 80) {
        lv_obj_set_style_text_color(status_cpu_value, lv_color_hex(0xef4444), 0);
    } else if (cpu > 60) {
        lv_obj_set_style_text_color(status_cpu_value, lv_color_hex(0xf59e0b), 0);
    } else {
        lv_obj_set_style_text_color(status_cpu_value, lv_color_hex(0x10b981), 0);
    }

    // Similar for memory, WiFi RSSI, battery...
}
```

#### Properties & Behavior

| Item | Display | Update Frequency | Color Coding |
|---|---|---|---|
| WiFi Signal | RSSI dBm + bars (0-4) | 5 seconds | <-80=Yellow, <-60=Green |
| Battery % | Battery icon + percentage | 5 seconds | <10%=Red, <20%=Yellow, >=20%=Green |
| FPS Counter | Numeric (0-60) | Every frame | <30=Red, <50=Yellow, >=50=Green |
| CPU Load | Gauge + percentage | 5 seconds | >80%=Red, >60%=Yellow, <=60%=Green |
| Memory % | Gauge + percentage | 5 seconds | >90%=Red, >75%=Yellow, <=75%=Green |

---

### 2.5 Palette Selector (Color Swatches)

**Used for:** Quick palette/color theme selection via visual swatches

#### Dimensions & Layout

```cpp
// Palette carousel dimensions
#define PALETTE_CAROUSEL_WIDTH    400      // Fits in middle column
#define PALETTE_CAROUSEL_HEIGHT   90       // Swatch + label
#define PALETTE_SWATCH_SIZE       60       // 60×60 px squares
#define PALETTE_SWATCH_GAP        12       // 12px between swatches
#define PALETTE_LABEL_HEIGHT      16       // Name label below swatch
#define PALETTE_MAX_VISIBLE       5        // Max swatches visible (need scroll for more)

// Palette carousel position
#define PALETTE_CAROUSEL_X        420
#define PALETTE_CAROUSEL_Y        100
```

#### LVGL Initialization Code

```cpp
// Create palette carousel (scrollable horizontal container)
lv_obj_t *palette_carousel = lv_obj_create(parent);
lv_obj_set_size(palette_carousel, PALETTE_CAROUSEL_WIDTH, PALETTE_CAROUSEL_HEIGHT);
lv_obj_set_pos(palette_carousel, PALETTE_CAROUSEL_X, PALETTE_CAROUSEL_Y);
lv_obj_set_layout(palette_carousel, LV_LAYOUT_FLEX);
lv_obj_set_flex_flow(palette_carousel, LV_FLEX_FLOW_ROW);
lv_obj_set_style_bg_opa(palette_carousel, 0, 0);  // Transparent
lv_obj_set_style_border_width(palette_carousel, 0, 0);
lv_obj_set_scroll_snap_x(palette_carousel, LV_SCROLL_SNAP_CENTER);  // Snap to center
lv_obj_set_scroll_dir(palette_carousel, LV_DIR_HOR);  // Horizontal scroll only

// Create palette swatches
for (int i = 0; i < PALETTE_COUNT; i++) {
    create_palette_swatch(palette_carousel, i);
}

// Add navigation arrows (if needed for very long lists)
lv_obj_t *arrow_left = lv_btn_create(parent);
lv_obj_set_size(arrow_left, 30, 60);
lv_obj_set_pos(arrow_left, PALETTE_CAROUSEL_X - 35, PALETTE_CAROUSEL_Y + 15);
lv_label_set_text(lv_label_create(arrow_left), "◀");
lv_obj_add_event_cb(arrow_left, palette_scroll_left_cb, LV_EVENT_CLICKED, palette_carousel);

lv_obj_t *arrow_right = lv_btn_create(parent);
lv_obj_set_size(arrow_right, 30, 60);
lv_obj_set_pos(arrow_right, PALETTE_CAROUSEL_X + PALETTE_CAROUSEL_WIDTH + 5, PALETTE_CAROUSEL_Y + 15);
lv_label_set_text(lv_label_create(arrow_right), "▶");
lv_obj_add_event_cb(arrow_right, palette_scroll_right_cb, LV_EVENT_CLICKED, palette_carousel);

// Store reference
palette_carousel_ref = palette_carousel;
```

#### Individual Palette Swatch

```cpp
typedef struct {
    lv_obj_t *button;
    int palette_id;
    const char *palette_name;
    uint32_t *color_samples;  // Array of 5 RGB colors
} palette_swatch_t;

void create_palette_swatch(lv_obj_t *parent, int palette_id) {
    // Create button for swatch
    lv_obj_t *btn = lv_btn_create(parent);
    lv_obj_set_size(btn, PALETTE_SWATCH_SIZE, PALETTE_SWATCH_SIZE + PALETTE_LABEL_HEIGHT);
    lv_obj_set_layout(btn, LV_LAYOUT_COLUMN);
    lv_obj_set_style_bg_opa(btn, 0, 0);  // Transparent button background
    lv_obj_set_style_border_width(btn, 0, 0);
    lv_obj_set_style_pad_all(btn, 0, 0);

    // Create color square (the actual swatch)
    lv_obj_t *swatch = lv_obj_create(btn);
    lv_obj_set_size(swatch, PALETTE_SWATCH_SIZE, PALETTE_SWATCH_SIZE);

    // Get dominant color from palette
    uint32_t dominant_color = palette_list[palette_id].colors[0];  // First color in palette
    lv_color_t color = lv_color_hex(dominant_color);

    // Style swatch
    lv_obj_set_style_bg_color(swatch, color, 0);
    lv_obj_set_style_bg_opa(swatch, 255, 0);
    lv_obj_set_style_border_width(swatch, 3, 0);
    lv_obj_set_style_border_color(swatch, lv_color_hex(0x4b5563), 0);  // Gray border
    lv_obj_set_style_radius(swatch, 8, 0);

    // Style: active/selected swatch
    lv_obj_set_style_border_color(swatch, lv_color_hex(0xffffff), LV_STATE_CHECKED);  // White border
    lv_obj_set_style_border_width(swatch, 4, LV_STATE_CHECKED);  // Thicker border
    lv_obj_set_style_shadow_width(swatch, 12, LV_STATE_CHECKED);
    lv_obj_set_style_shadow_color(swatch, lv_color_hex(0x14b8a6), LV_STATE_CHECKED);
    lv_obj_set_style_shadow_opa(swatch, 80, LV_STATE_CHECKED);

    // Create label (palette name)
    lv_obj_t *label = lv_label_create(btn);
    lv_label_set_text(label, palette_list[palette_id].name);
    lv_obj_set_style_text_font(label, &lv_font_montserrat_10, 0);
    lv_obj_set_style_text_color(label, lv_color_hex(0xe6e9ef), 0);
    lv_obj_set_width(label, PALETTE_SWATCH_SIZE);
    lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_CENTER, 0);

    // Event handler
    lv_obj_add_event_cb(btn, palette_swatch_event_cb, LV_EVENT_CLICKED, (void *)(intptr_t)palette_id);

    // Store reference for highlighting active palette
    palette_swatches[palette_id] = btn;
}

// Event handler for palette selection
void palette_swatch_event_cb(lv_event_t *e) {
    int palette_id = (int)(intptr_t)lv_event_get_user_data(e);

    // Update UI: clear previous selection highlight
    for (int i = 0; i < PALETTE_COUNT; i++) {
        lv_obj_clear_state(palette_swatches[i], LV_STATE_CHECKED);
    }

    // Set new selection
    lv_obj_add_state(palette_swatches[palette_id], LV_STATE_CHECKED);

    // Debounce and queue network update
    queue_palette_update(palette_id);
}
```

#### Properties & Behavior

| Property | Value | Notes |
|---|---|---|
| Swatch Size | 60×60 px | Large enough for arm's-length viewing |
| Gap Between Swatches | 12px | Touch-friendly spacing |
| Max Visible | 5 swatches | Can scroll horizontally for more |
| Highlight (Active) | White border + teal glow | Clear visual indication |
| Color Source | First color in palette | Dominant/representative color |
| Text Label | Palette name (10px) | Below swatch |
| Debounce | 300ms | Same as slider debounce |
| Update Frequency | On change only | Network POST /api/params triggered |
| Animation | Snap to nearest swatch on scroll release | Smooth carousel behavior |

---

### 2.6 Text Labels & Value Displays

**Used for:** Parameter labels, current values, hints, secondary information

#### Label Styles

```cpp
// Label styling patterns

// 1. Parameter Label (e.g., "Brightness")
lv_obj_t *label_brightness = lv_label_create(parent);
lv_label_set_text(label_brightness, "Brightness");
lv_obj_set_style_text_font(label_brightness, &lv_font_montserrat_14, 0);
lv_obj_set_style_text_color(label_brightness, lv_color_hex(0xe6e9ef), 0);  // prism-text-primary
lv_obj_set_style_text_decor(label_brightness, LV_TEXT_DECOR_NONE, 0);

// 2. Value Display (e.g., "87%")
lv_obj_t *value_brightness = lv_label_create(parent);
lv_label_set_text(value_brightness, "87%");
lv_obj_set_style_text_font(value_brightness, &lv_font_montserrat_mono_12, 0);  // Monospace for numbers
lv_obj_set_style_text_color(value_brightness, lv_color_hex(0x14b8a6), 0);  // prism-accent (teal)
lv_obj_set_width(value_brightness, 50);
lv_obj_set_style_text_align(value_brightness, LV_TEXT_ALIGN_RIGHT, 0);

// 3. Secondary Label (e.g., hints)
lv_obj_t *hint_label = lv_label_create(parent);
lv_label_set_text(hint_label, "Drag to adjust");
lv_obj_set_style_text_font(hint_label, &lv_font_montserrat_11, 0);
lv_obj_set_style_text_color(hint_label, lv_color_hex(0x9ca3af), 0);  // prism-text-secondary (gray)

// 4. Pattern Name (Large, centered)
lv_obj_t *pattern_name = lv_label_create(parent);
lv_label_set_text(pattern_name, "Wavelength");
lv_obj_set_style_text_font(pattern_name, &lv_font_montserrat_bold_36, 0);
lv_obj_set_style_text_color(pattern_name, lv_color_hex(0xe6e9ef), 0);
lv_obj_set_style_text_align(pattern_name, LV_TEXT_ALIGN_CENTER, 0);
lv_obj_set_width(pattern_name, 600);

// 5. Section Header (e.g., "Audio Reactivity")
lv_obj_t *section_header = lv_label_create(parent);
lv_label_set_text(section_header, "Audio Controls");
lv_obj_set_style_text_font(section_header, &lv_font_montserrat_bold_16, 0);
lv_obj_set_style_text_color(section_header, lv_color_hex(0xe6e9ef), 0);
```

#### Dynamic Value Updates

```cpp
// Update value label during slider drag
static void update_brightness_value(int value) {
    // value: 0-100 from LVGL slider
    float normalized = value / 100.0f;  // Convert to 0.0-1.0

    // Update display
    if (is_percentage) {
        lv_label_set_text_fmt(value_brightness, "%d%%", value);
    } else {
        lv_label_set_text_fmt(value_brightness, "%.2f", normalized);
    }

    // Change color based on value (example: dim = red, normal = green, bright = yellow)
    if (value < 20) {
        lv_obj_set_style_text_color(value_brightness, lv_color_hex(0xef4444), 0);  // Red (dim)
    } else if (value < 80) {
        lv_obj_set_style_text_color(value_brightness, lv_color_hex(0x10b981), 0);  // Green (normal)
    } else {
        lv_obj_set_style_text_color(value_brightness, lv_color_hex(0xf59e0b), 0);  // Yellow (bright)
    }
}
```

#### Font Recommendations for ESP32

```cpp
// Built-in LVGL fonts (size-optimized for embedded)
// Use these for best memory efficiency:

// Small sizes (11-12px)
extern const lv_font_t lv_font_montserrat_11;
extern const lv_font_t lv_font_montserrat_12;

// Body text (14px)
extern const lv_font_t lv_font_montserrat_14;

// Headers (16-36px)
extern const lv_font_t lv_font_montserrat_16;
extern const lv_font_t lv_font_montserrat_20;
extern const lv_font_t lv_font_montserrat_bold_24;
extern const lv_font_t lv_font_montserrat_bold_28;
extern const lv_font_t lv_font_montserrat_bold_36;

// Monospace (for numbers)
extern const lv_font_t lv_font_montserrat_mono_12;
extern const lv_font_t lv_font_montserrat_mono_14;

// For custom fonts, enable in lv_conf.h:
// #define LV_FONT_CUSTOM_DECLARE LV_FONT_DECLARE(lv_font_custom_font_name)
```

#### Properties & Behavior

| Type | Font | Size | Color | Usage |
|---|---|---|---|---|
| Parameter Label | Montserrat | 14px | Primary (#e6e9ef) | "Brightness", "Speed" |
| Value Display | Montserrat Mono | 12px | Accent (#14b8a6) | "87%", "0.55" |
| Section Header | Montserrat Bold | 16px | Primary (#e6e9ef) | "Audio Controls" |
| Pattern Name | Montserrat Bold | 36px | Primary (#e6e9ef) | "Wavelength" |
| Status Text | Montserrat | 11px | Secondary (#9ca3af) | "Connected", "Synced 2s ago" |
| Hints | Montserrat | 11px | Secondary (#9ca3af) | "Drag to adjust" |

---

## 3. COORDINATE SYSTEM & LAYOUT MAP

### 3.1 Screen Coordinates (1280×720 display)

```cpp
// Define all layout constants in a header file (layout.h)

#define SCREEN_WIDTH            1280
#define SCREEN_HEIGHT           720

// ============ HEADER (60px) ============
#define HEADER_Y                0
#define HEADER_HEIGHT           60
#define HEADER_PADDING          8

// Status indicators
#define STATUS_WIFI_X           20
#define STATUS_BATTERY_X        110
#define STATUS_FPS_X            200
#define STATUS_CPU_X            290
#define STATUS_MEMORY_X         380
#define STATUS_ITEM_WIDTH       80
#define STATUS_ITEM_HEIGHT      50

// Right section (settings, menu)
#define HEADER_SETTINGS_X       (SCREEN_WIDTH - 80)
#define HEADER_MENU_X           (SCREEN_WIDTH - 40)

// ============ PATTERN DISPLAY (80px) ============
#define PATTERN_Y               (HEADER_HEIGHT + 0)
#define PATTERN_HEIGHT          80
#define PATTERN_TEXT_SIZE       36

// ============ MAIN CONTROL AREA (600px) ============
#define CONTROLS_Y              (PATTERN_Y + PATTERN_HEIGHT)
#define CONTROLS_HEIGHT         600

// --- LEFT COLUMN (Sliders) ---
#define LEFT_COLUMN_X           20
#define LEFT_COLUMN_WIDTH       400
#define LEFT_COLUMN_CONTROLS_X  (LEFT_COLUMN_X + 20)  // Inner padding

#define SLIDER_WIDTH            380
#define SLIDER_HEIGHT           60

// Slider Y positions
#define SLIDER_BRIGHTNESS_Y     (CONTROLS_Y + 20)
#define SLIDER_SPEED_Y          (SLIDER_BRIGHTNESS_Y + 80)
#define SLIDER_COLOR_Y          (SLIDER_SPEED_Y + 80)
#define SLIDER_SAT_Y            (SLIDER_COLOR_Y + 80)
#define SLIDER_WARMTH_Y         (SLIDER_SAT_Y + 80)

// --- MIDDLE COLUMN (Palette) ---
#define MIDDLE_COLUMN_X         420
#define MIDDLE_COLUMN_WIDTH     250
#define MIDDLE_COLUMN_Y         (CONTROLS_Y + 20)

#define PALETTE_CAROUSEL_X      MIDDLE_COLUMN_X
#define PALETTE_CAROUSEL_Y      MIDDLE_COLUMN_Y
#define PALETTE_CAROUSEL_WIDTH  230
#define PALETTE_CAROUSEL_HEIGHT 90

// --- RIGHT COLUMN (Audio & Actions) ---
#define RIGHT_COLUMN_X          680
#define RIGHT_COLUMN_WIDTH      600
#define RIGHT_COLUMN_Y          (CONTROLS_Y + 20)

#define AUDIO_TOGGLE_X          RIGHT_COLUMN_X
#define AUDIO_TOGGLE_Y          RIGHT_COLUMN_Y
#define AUDIO_TOGGLE_SIZE       150

#define AUDIO_GAIN_X            RIGHT_COLUMN_X
#define AUDIO_GAIN_Y            (AUDIO_TOGGLE_Y + 120)
#define AUDIO_GAIN_WIDTH        300
#define AUDIO_GAIN_HEIGHT       60

#define BUTTON_CALIBRATE_X      RIGHT_COLUMN_X
#define BUTTON_CALIBRATE_Y      (AUDIO_GAIN_Y + 100)
#define BUTTON_CALIBRATE_SIZE   150

#define AUDIO_VU_X              RIGHT_COLUMN_X
#define AUDIO_VU_Y              (BUTTON_CALIBRATE_Y + 120)
#define AUDIO_VU_WIDTH          280
#define AUDIO_VU_HEIGHT         80

// ============ FOOTER (40px) ============
#define FOOTER_Y                (CONTROLS_Y + CONTROLS_HEIGHT)
#define FOOTER_HEIGHT           40
```

### 3.2 Visual Layout Diagram

```
┌─────────────────────────────────────────────────────┐ y: 0
│ Header (60px)                                       │
│ [WiFi] [Battery] [FPS] [CPU] [Memory] [⚙] [⋮]      │
├─────────────────────────────────────────────────────┤ y: 60
│           Pattern Name Display (80px)               │
│                  WAVELENGTH                         │
├─────────────────────────────────────────────────────┤ y: 140
│ ┌──────────┬──────────┬─────────────────────────┐   │
│ │ Left     │ Middle   │ Right Column            │   │
│ │ (20-400) │ (420-670)│ (680-1260)              │   │
│ │          │          │                         │   │
│ │ Sliders  │ Palettes │ Audio & Actions         │   │
│ │          │          │                         │   │
│ │ Y:140+   │ Y:160+   │ Y:160+                  │   │
│ │          │          │                         │   │
│ │ Bright   │ Palette  │ Audio Toggle            │   │
│ │ ─●─ 87%  │ [###][##]│ ◉ ON / ◯ OFF           │   │
│ │          │ [##][###]│                         │   │
│ │ Speed    │          │ Microphone Gain         │   │
│ │ ──●── 55%│          │ ──●── 1.5x              │   │
│ │          │          │                         │   │
│ │ Color    │          │ [Calibrate Noise] (gold)│   │
│ │ ───●──── │          │                         │   │
│ │          │          │ VU Meter                │   │
│ │ Sat      │          │ ████░░░░  0.65          │   │
│ │ ──●───── │          │                         │   │
│ │          │          │                         │   │
│ │ Warmth   │          │                         │   │
│ │ ───●──── │          │                         │   │
│ │          │          │                         │   │
│ └──────────┴──────────┴─────────────────────────┘   │
│                                                     │
│ [Pattern List - scrollable, fills remaining space]  │
│ ▓ Wavelength                                        │
│   Ether                                             │
│   Pulse                                             │
│   [... more ...]                                    │
├─────────────────────────────────────────────────────┤ y: 680
│ Footer (40px)                                       │
│ 🔋 100% | Synced 2s ago | [↻ Retry]                │
└─────────────────────────────────────────────────────┘ y: 720
```

---

## 4. LVGL STYLING PATTERNS & TEMPLATES

### 4.1 Global Style Definitions

```cpp
// Create this in a separate file: ui_styles.h / ui_styles.c

static lv_style_t style_canvas_bg;         // Primary background
static lv_style_t style_elevated_bg;       // Elevated backgrounds
static lv_style_t style_slider_track;      // Slider track
static lv_style_t style_slider_knob;       // Slider thumb
static lv_style_t style_button_primary;    // Gold primary button
static lv_style_t style_button_secondary;  // Teal secondary button
static lv_style_t style_label_primary;     // Main text
static lv_style_t style_label_secondary;   // Secondary text
static lv_style_t style_border_subtle;     // Subtle borders

void ui_styles_init(void) {
    // Canvas background (main display)
    lv_style_init(&style_canvas_bg);
    lv_style_set_bg_color(&style_canvas_bg, lv_color_hex(0x252d3f));
    lv_style_set_bg_opa(&style_canvas_bg, 255);
    lv_style_set_border_width(&style_canvas_bg, 0);

    // Elevated background (cards, buttons)
    lv_style_init(&style_elevated_bg);
    lv_style_set_bg_color(&style_elevated_bg, lv_color_hex(0x2f3849));
    lv_style_set_bg_opa(&style_elevated_bg, 255);
    lv_style_set_border_width(&style_elevated_bg, 0);
    lv_style_set_radius(&style_elevated_bg, 10);

    // Slider track (the background of the slider)
    lv_style_init(&style_slider_track);
    lv_style_set_bg_color(&style_slider_track, lv_color_hex(0x2f3849));
    lv_style_set_bg_opa(&style_slider_track, 255);
    lv_style_set_radius(&style_slider_track, 10);
    lv_style_set_pad_all(&style_slider_track, 0);

    // Slider knob (thumb)
    lv_style_init(&style_slider_knob);
    lv_style_set_bg_color(&style_slider_knob, lv_color_hex(0x14b8a6));
    lv_style_set_bg_opa(&style_slider_knob, 255);
    lv_style_set_border_width(&style_slider_knob, 2);
    lv_style_set_border_color(&style_slider_knob, lv_color_hex(0xffffff));
    lv_style_set_radius(&style_slider_knob, LV_RADIUS_CIRCLE);

    // Primary button (gold)
    lv_style_init(&style_button_primary);
    lv_style_set_bg_color(&style_button_primary, lv_color_hex(0xffb84d));
    lv_style_set_bg_opa(&style_button_primary, 255);
    lv_style_set_border_width(&style_button_primary, 0);
    lv_style_set_radius(&style_button_primary, 12);
    lv_style_set_shadow_width(&style_button_primary, 8);
    lv_style_set_shadow_color(&style_button_primary, lv_color_hex(0x000000));
    lv_style_set_shadow_opa(&style_button_primary, 100);

    // Secondary button (teal)
    lv_style_init(&style_button_secondary);
    lv_style_set_bg_color(&style_button_secondary, lv_color_hex(0x14b8a6));
    lv_style_set_bg_opa(&style_button_secondary, 255);
    lv_style_set_border_width(&style_button_secondary, 2);
    lv_style_set_border_color(&style_button_secondary, lv_color_hex(0x0f766e));
    lv_style_set_radius(&style_button_secondary, 8);

    // Primary text label
    lv_style_init(&style_label_primary);
    lv_style_set_text_color(&style_label_primary, lv_color_hex(0xe6e9ef));
    lv_style_set_text_opa(&style_label_primary, 255);

    // Secondary text label
    lv_style_init(&style_label_secondary);
    lv_style_set_text_color(&style_label_secondary, lv_color_hex(0x9ca3af));
    lv_style_set_text_opa(&style_label_secondary, 255);

    // Subtle border
    lv_style_init(&style_border_subtle);
    lv_style_set_border_width(&style_border_subtle, 1);
    lv_style_set_border_color(&style_border_subtle, lv_color_hex(0x4b5563));
    lv_style_set_border_side(&style_border_subtle, LV_BORDER_SIDE_BOTTOM);
}

// Helper function to apply multiple styles
void apply_style_set(lv_obj_t *obj, const lv_style_t *style, lv_style_selector_t selector) {
    lv_obj_add_style(obj, (lv_style_t *)style, selector);
}
```

### 4.2 State-Based Style Overrides

```cpp
// Focused/hover state (when slider is being dragged)
static lv_style_t style_focused;

void style_focused_init(void) {
    lv_style_init(&style_focused);
    lv_style_set_bg_color(&style_focused, lv_color_hex(0x3a4457));  // Slightly brighter
    lv_style_set_shadow_width(&style_focused, 12);
    lv_style_set_shadow_color(&style_focused, lv_color_hex(0x14b8a6));
    lv_style_set_shadow_opa(&style_focused, 60);
    lv_style_set_shadow_spread(&style_focused, 4);
}

// Disabled state
static lv_style_t style_disabled;

void style_disabled_init(void) {
    lv_style_init(&style_disabled);
    lv_style_set_bg_color(&style_disabled, lv_color_hex(0x1f262f));
    lv_style_set_bg_opa(&style_disabled, 128);
    lv_style_set_text_color(&style_disabled, lv_color_hex(0x4b5563));
    lv_style_set_text_opa(&style_disabled, 128);
}

// Apply state styles
void apply_focused_style(lv_obj_t *obj) {
    lv_obj_add_style(obj, &style_focused, LV_STATE_FOCUSED | LV_PART_MAIN);
}

void apply_disabled_style(lv_obj_t *obj) {
    lv_obj_add_style(obj, &style_disabled, LV_STATE_DISABLED);
}
```

---

## 5. EVENT HANDLERS & INPUT PROCESSING

### 5.1 Slider Event Handler with Debounce

```cpp
// Debounce configuration
#define DEBOUNCE_DELAY_MS       100
#define SLIDER_NETWORK_DELAY_MS 100

typedef struct {
    lv_obj_t *slider;
    int current_value;
    int pending_value;
    uint32_t last_update_time;
    bool debounce_pending;
    const char *param_name;       // "brightness", "speed", etc.
    float min_val, max_val;        // 0.0-1.0 range
} slider_context_t;

static slider_context_t slider_brightness_ctx = {
    .param_name = "brightness",
    .min_val = 0.0f,
    .max_val = 1.0f,
};

// Main event handler
static void slider_brightness_event_cb(lv_event_t *e) {
    lv_event_code_t code = lv_event_get_code(e);
    lv_obj_t *slider = (lv_obj_t *)lv_event_get_target(e);
    slider_context_t *ctx = &slider_brightness_ctx;

    if (code == LV_EVENT_VALUE_CHANGED) {
        int slider_value = lv_slider_get_value(slider);  // 0-100

        // Update UI immediately (live feedback)
        float normalized = slider_value / 100.0f;
        lv_label_set_text_fmt(value_brightness, "%d%%", slider_value);

        // Mark as syncing
        show_syncing_badge(value_brightness);

        // Queue debounced network update
        ctx->pending_value = slider_value;
        ctx->debounce_pending = true;

        // If debounce timer not running, start it
        if (!lv_timer_is_valid(slider_brightness_debounce_timer)) {
            slider_brightness_debounce_timer = lv_timer_create(
                slider_brightness_debounce_cb,
                DEBOUNCE_DELAY_MS,
                ctx
            );
            lv_timer_set_repeat_count(slider_brightness_debounce_timer, 1);  // One-shot
        } else {
            // Timer already running; it will use the latest pending_value
        }
    }
}

// Debounce callback (fires after DEBOUNCE_DELAY_MS with no new events)
static void slider_brightness_debounce_cb(lv_timer_t *timer) {
    slider_context_t *ctx = (slider_context_t *)lv_timer_get_user_data(timer);

    if (ctx->debounce_pending) {
        ctx->debounce_pending = false;
        ctx->current_value = ctx->pending_value;

        // Send network update
        float normalized = ctx->pending_value / 100.0f;
        send_param_update("brightness", normalized);

        // Update timestamp
        update_sync_timestamp();
    }

    slider_brightness_debounce_timer = NULL;
}

// Focused state handler (visual feedback when slider is touched)
static void slider_brightness_focus_cb(lv_event_t *e) {
    lv_obj_t *slider = (lv_obj_t *)lv_event_get_target(e);

    // Add glow shadow effect
    lv_obj_add_style(slider, &style_focused, LV_PART_KNOB | LV_STATE_FOCUSED);
}

// Un-focused handler (remove visual feedback)
static void slider_brightness_unfocus_cb(lv_event_t *e) {
    lv_obj_t *slider = (lv_obj_t *)lv_event_get_target(e);

    // Remove focus styles
    lv_obj_remove_style(slider, &style_focused, LV_PART_KNOB);
}
```

### 5.2 Button Click Handler

```cpp
// Button calibration context
typedef struct {
    lv_obj_t *button;
    bool calibration_in_progress;
    uint32_t calibration_start_time;
    int calibration_expected_duration_ms;  // ~8 seconds (500 frames)
} button_context_t;

static button_context_t button_calibrate_ctx = {
    .calibration_expected_duration_ms = 8000,
};

// Event handler
static void button_calibrate_event_cb(lv_event_t *e) {
    lv_event_code_t code = lv_event_get_code(e);
    lv_obj_t *button = (lv_obj_t *)lv_event_get_target(e);
    button_context_t *ctx = &button_calibrate_ctx;

    if (code == LV_EVENT_CLICKED) {
        if (ctx->calibration_in_progress) {
            // Already calibrating; ignore duplicate click
            return;
        }

        // Start calibration
        ctx->calibration_in_progress = true;
        ctx->calibration_start_time = lv_tick_get();

        // Disable button during calibration
        lv_obj_add_state(button, LV_STATE_DISABLED);

        // Show spinner label
        lv_obj_t *btn_label = lv_obj_get_child(button, 0);  // First child (label)
        lv_label_set_text(btn_label, "⟳");  // Spinner

        // Send calibration request
        http_post("/api/audio/noise-calibrate", NULL, calibration_response_cb);

        // Start progress timer
        lv_timer_create(calibration_progress_cb, 100, button);  // Poll every 100ms
    }
}

// Calibration response callback
static void calibration_response_cb(int status, const char *response) {
    button_context_t *ctx = &button_calibrate_ctx;

    if (status == 200) {
        // Success
        ctx->calibration_in_progress = false;

        // Show success checkmark
        lv_obj_t *btn_label = lv_obj_get_child(button_calibrate, 0);
        lv_label_set_text(btn_label, "✓");  // Green checkmark
        lv_obj_set_style_text_color(btn_label, lv_color_hex(0x10b981), 0);  // Green

        // Re-enable button after 2s
        lv_timer_create(calibration_complete_cb, 2000, NULL);

        show_toast("Noise calibration complete", TOAST_SUCCESS);
    } else {
        // Error
        ctx->calibration_in_progress = false;

        // Show error indicator
        lv_obj_t *btn_label = lv_obj_get_child(button_calibrate, 0);
        lv_label_set_text(btn_label, "✕");  // Red X
        lv_obj_set_style_text_color(btn_label, lv_color_hex(0xef4444), 0);  // Red

        // Re-enable button
        lv_obj_remove_state(button_calibrate, LV_STATE_DISABLED);

        show_toast("Calibration failed. Try again.", TOAST_ERROR);
    }
}

// Progress indicator callback
static void calibration_progress_cb(lv_timer_t *timer) {
    button_context_t *ctx = &button_calibrate_ctx;

    if (!ctx->calibration_in_progress) {
        lv_timer_del(timer);
        return;  // Done
    }

    uint32_t elapsed = lv_tick_get() - ctx->calibration_start_time;
    int percent = (elapsed * 100) / ctx->calibration_expected_duration_ms;

    if (percent > 100) percent = 100;

    // Optional: Update progress bar or spinner text
    lv_obj_t *progress = (lv_obj_t *)lv_timer_get_user_data(timer);
    // ... update progress display
}

// Completion callback
static void calibration_complete_cb(lv_timer_t *timer) {
    lv_obj_remove_state(button_calibrate, LV_STATE_DISABLED);

    // Reset label to original
    lv_obj_t *btn_label = lv_obj_get_child(button_calibrate, 0);
    lv_label_set_text(btn_label, "Calibrate\nNoise");
    lv_obj_set_style_text_color(btn_label, lv_color_hex(0x1c2130), 0);

    lv_timer_del(timer);
}
```

### 5.3 Toggle Switch Handler

```cpp
static void toggle_audio_event_cb(lv_event_t *e) {
    lv_event_code_t code = lv_event_get_code(e);
    lv_obj_t *toggle = (lv_obj_t *)lv_event_get_target(e);

    if (code == LV_EVENT_VALUE_CHANGED) {
        bool state = lv_obj_has_state(toggle, LV_STATE_CHECKED);

        // Send update to K1
        float active_value = state ? 1.0f : 0.0f;
        send_param_update("audio_active", active_value);

        // Show feedback
        show_syncing_badge(toggle);

        // Update audio controls visibility
        if (state) {
            lv_obj_clear_flag(audio_gain_slider, LV_OBJ_FLAG_HIDDEN);
            lv_obj_clear_flag(vu_meter, LV_OBJ_FLAG_HIDDEN);
        } else {
            lv_obj_add_flag(audio_gain_slider, LV_OBJ_FLAG_HIDDEN);
            lv_obj_add_flag(vu_meter, LV_OBJ_FLAG_HIDDEN);
        }

        update_sync_timestamp();
    }
}
```

---

## 6. UPDATE FREQUENCY & REFRESH STRATEGY

### 6.1 Update Frequency Matrix

| Component | Trigger | Frequency | Notes |
|---|---|---|---|
| **Slider Drag** | User drag | Every 16ms (~60 Hz) | Live visual feedback |
| **Slider Debounce** | Drag release | 100ms delay | Before network update |
| **Status Display** | HTTP poll | Every 5 seconds | FPS, CPU, memory, WiFi |
| **Parameter Values** | Network sync | On change | Via WebSocket or HTTP response |
| **Pattern Name** | HTTP response | On change | After pattern switch completes |
| **Audio VU Meter** | HTTP poll | Every 200ms | Real-time audio visualization |
| **Connection Status** | HTTP response | On change | When network succeeds/fails |
| **Sync Timestamp** | Timer | Every 1 second | "Synced 2s ago" → "Synced 3s ago" |

### 6.2 Polling Strategy

```cpp
// Create periodic polling tasks

// Poll K1 health every 5 seconds
static lv_timer_t *health_poll_timer = NULL;

void start_health_polling(void) {
    health_poll_timer = lv_timer_create(health_poll_cb, 5000, NULL);  // 5000ms
}

static void health_poll_cb(lv_timer_t *timer) {
    // Send GET /api/health
    http_get("/api/health", health_response_cb);
}

static void health_response_cb(int status, const char *response) {
    if (status == 200) {
        // Parse JSON and update UI
        update_status_display(response);
    } else {
        // Network error; show disconnected state
        show_disconnected();
    }
}

// Poll audio snapshot every 200ms (if audio enabled)
static lv_timer_t *audio_poll_timer = NULL;

void start_audio_polling(void) {
    if (audio_poll_timer) lv_timer_del(audio_poll_timer);
    audio_poll_timer = lv_timer_create(audio_poll_cb, 200, NULL);  // 200ms
}

static void audio_poll_cb(lv_timer_t *timer) {
    http_get("/api/audio/snapshot", audio_snapshot_cb);
}

static void audio_snapshot_cb(int status, const char *response) {
    if (status == 200) {
        // Parse VU level and update meter
        update_vu_meter(response);
    }
}

// Update timestamp every 1 second
static lv_timer_t *timestamp_timer = NULL;

void start_timestamp_updates(void) {
    timestamp_timer = lv_timer_create(timestamp_update_cb, 1000, NULL);  // 1000ms
}

static void timestamp_update_cb(lv_timer_t *timer) {
    uint32_t now = lv_tick_get() / 1000;  // Current time in seconds
    uint32_t elapsed = now - last_sync_time;

    if (elapsed < 60) {
        lv_label_set_text_fmt(label_sync_time, "Synced %ds ago", elapsed);
    } else if (elapsed < 3600) {
        lv_label_set_text_fmt(label_sync_time, "Synced %dm ago", elapsed / 60);
    } else {
        lv_label_set_text(label_sync_time, "Synced long ago");
    }
}
```

---

## 7. ERROR HANDLING & USER FEEDBACK

### 7.1 Network Error Handling

```cpp
// Error toast notification pattern
typedef enum {
    TOAST_INFO,
    TOAST_SUCCESS,
    TOAST_WARNING,
    TOAST_ERROR
} toast_type_t;

void show_toast(const char *message, toast_type_t type) {
    lv_obj_t *toast = lv_obj_create(lv_scr_act());
    lv_obj_set_size(toast, 400, 60);
    lv_obj_set_pos(toast, (1280 - 400) / 2, 100);  // Center horizontally, near top
    lv_obj_set_style_radius(toast, 12, 0);
    lv_obj_set_style_border_width(toast, 1, 0);

    // Color based on type
    switch (type) {
        case TOAST_SUCCESS:
            lv_obj_set_style_bg_color(toast, lv_color_hex(0x10b981), 0);  // Green
            break;
        case TOAST_ERROR:
            lv_obj_set_style_bg_color(toast, lv_color_hex(0xef4444), 0);  // Red
            break;
        case TOAST_WARNING:
            lv_obj_set_style_bg_color(toast, lv_color_hex(0xf59e0b), 0);  // Yellow
            break;
        default:
            lv_obj_set_style_bg_color(toast, lv_color_hex(0x2f3849), 0);  // Gray
    }

    lv_obj_t *label = lv_label_create(toast);
    lv_label_set_text(label, message);
    lv_obj_set_style_text_color(label, lv_color_hex(0xffffff), 0);
    lv_obj_center(label);

    // Auto-dismiss after 3 seconds
    lv_timer_create(toast_dismiss_cb, 3000, toast);
}

static void toast_dismiss_cb(lv_timer_t *timer) {
    lv_obj_t *toast = (lv_obj_t *)lv_timer_get_user_data(timer);
    lv_obj_del(toast);
    lv_timer_del(timer);
}

// Retry button (shown when update fails)
void show_retry_button(const char *param_name, float value) {
    lv_obj_t *retry_btn = lv_btn_create(lv_scr_act());
    lv_obj_set_size(retry_btn, 100, 50);
    lv_obj_set_pos(retry_btn, 1280 - 120, 100);

    lv_obj_t *label = lv_label_create(retry_btn);
    lv_label_set_text(label, "Retry");
    lv_obj_center(label);

    // Store context for retry
    retry_context_t *ctx = malloc(sizeof(retry_context_t));
    ctx->param_name = param_name;
    ctx->value = value;
    ctx->button = retry_btn;

    lv_obj_add_event_cb(retry_btn, retry_button_cb, LV_EVENT_CLICKED, ctx);
}

static void retry_button_cb(lv_event_t *e) {
    retry_context_t *ctx = (retry_context_t *)lv_event_get_user_data(e);

    // Resend the failed update
    send_param_update(ctx->param_name, ctx->value);

    // Hide retry button
    lv_obj_del(ctx->button);
    free(ctx);
}
```

### 7.2 Disabled State (Offline Mode)

```cpp
// When device is unreachable, disable all controls
void disable_all_controls(void) {
    lv_obj_add_state(slider_brightness, LV_STATE_DISABLED);
    lv_obj_add_state(slider_speed, LV_STATE_DISABLED);
    lv_obj_add_state(slider_color, LV_STATE_DISABLED);
    lv_obj_add_state(palette_carousel, LV_STATE_DISABLED);
    lv_obj_add_state(toggle_audio, LV_STATE_DISABLED);
    lv_obj_add_state(slider_gain, LV_STATE_DISABLED);
    lv_obj_add_state(button_calibrate, LV_STATE_DISABLED);

    // Show "Offline" indicator
    lv_label_set_text(status_connection, "◉ Disconnected");
    lv_obj_set_style_text_color(status_connection, lv_color_hex(0xef4444), 0);  // Red

    // Show retry/reconnect button
    show_reconnect_button();
}

void enable_all_controls(void) {
    lv_obj_remove_state(slider_brightness, LV_STATE_DISABLED);
    lv_obj_remove_state(slider_speed, LV_STATE_DISABLED);
    // ... etc

    // Update status
    lv_label_set_text(status_connection, "◉ Connected");
    lv_obj_set_style_text_color(status_connection, lv_color_hex(0x10b981), 0);  // Green
}
```

---

## 8. ANIMATION & VISUAL FEEDBACK

### 8.1 Animation Timings

```cpp
// Define animation durations
#define ANIM_FAST_MS        100   // Quick feedback
#define ANIM_NORMAL_MS      200   // Standard transition
#define ANIM_SLOW_MS        400   // Leisurely fade

// Apply animations to objects

// Slider thumb on press (scale effect)
void animate_slider_press(lv_obj_t *slider) {
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, slider);
    lv_anim_set_path(&a, lv_anim_path_ease_out);
    lv_anim_set_duration(&a, ANIM_FAST_MS);
    lv_anim_set_values(&a, 1000, 950);  // 100% to 95% scale
    lv_anim_set_exec_cb(&a, set_slider_scale);
    lv_anim_start(&a);
}

// Button press effect (scale + shadow)
void animate_button_press(lv_obj_t *button) {
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, button);
    lv_anim_set_path(&a, lv_anim_path_ease_out);
    lv_anim_set_duration(&a, ANIM_FAST_MS);
    lv_anim_set_values(&a, 1000, 950);
    lv_anim_set_exec_cb(&a, set_button_scale);
    lv_anim_start(&a);
}

// Pattern name fade-in (when pattern changes)
void animate_pattern_name_change(lv_obj_t *label, const char *new_text) {
    // Fade out
    lv_anim_t fade_out;
    lv_anim_init(&fade_out);
    lv_anim_set_var(&fade_out, label);
    lv_anim_set_duration(&fade_out, ANIM_NORMAL_MS);
    lv_anim_set_values(&fade_out, 255, 0);
    lv_anim_set_exec_cb(&fade_out, set_label_opacity);
    lv_anim_start(&fade_out);

    // Update text after fade-out
    lv_timer_create((lv_timer_cb_t)change_text_and_fade_in, ANIM_NORMAL_MS, label);
}

static void change_text_and_fade_in(lv_timer_t *timer) {
    lv_obj_t *label = (lv_obj_t *)lv_timer_get_user_data(timer);

    // Fade in
    lv_anim_t fade_in;
    lv_anim_init(&fade_in);
    lv_anim_set_var(&fade_in, label);
    lv_anim_set_duration(&fade_in, ANIM_NORMAL_MS);
    lv_anim_set_values(&fade_in, 0, 255);
    lv_anim_set_exec_cb(&fade_in, set_label_opacity);
    lv_anim_start(&fade_in);

    lv_timer_del(timer);
}

// Syncing badge pulse (gentle breathing effect)
void animate_syncing_pulse(lv_obj_t *badge) {
    lv_anim_t pulse;
    lv_anim_init(&pulse);
    lv_anim_set_var(&pulse, badge);
    lv_anim_set_path(&pulse, lv_anim_path_ease_in_out);
    lv_anim_set_duration(&pulse, 1000);  // 1s pulse cycle
    lv_anim_set_values(&pulse, 180, 255);  // Opacity 70% to 100%
    lv_anim_set_repeat_count(&pulse, LV_ANIM_REPEAT_INFINITE);
    lv_anim_set_exec_cb(&pulse, set_badge_opacity);
    lv_anim_start(&pulse);
}
```

### 8.2 Visual Feedback Patterns

```cpp
// Show "Syncing..." badge (text or spinner)
void show_syncing_badge(lv_obj_t *target) {
    // Find or create badge near target
    lv_obj_t *badge = get_or_create_badge(target);
    lv_label_set_text(badge, "⟳");  // Spinner
    lv_obj_set_style_text_color(badge, lv_color_hex(0xf59e0b), 0);  // Yellow
    lv_obj_clear_flag(badge, LV_OBJ_FLAG_HIDDEN);

    // Start pulse animation
    animate_syncing_pulse(badge);
}

// Hide "Syncing..." and show "✓" checkmark
void show_sync_complete(lv_obj_t *badge) {
    lv_label_set_text(badge, "✓");
    lv_obj_set_style_text_color(badge, lv_color_hex(0x10b981), 0);  // Green

    // Fade out after 600ms
    lv_timer_create(hide_sync_badge_cb, 600, badge);
}

static void hide_sync_badge_cb(lv_timer_t *timer) {
    lv_obj_t *badge = (lv_obj_t *)lv_timer_get_user_data(timer);
    lv_obj_add_flag(badge, LV_OBJ_FLAG_HIDDEN);
    lv_timer_del(timer);
}
```

---

## 9. IMPLEMENTATION ROADMAP

### Phase 1: Core Components (Week 1-2)

1. **Header/Status Bar**
   - [ ] Create status bar container
   - [ ] Add WiFi, battery, FPS indicators
   - [ ] Implement health polling (5s interval)
   - [ ] Test color coding (green/yellow/red thresholds)

2. **Slider Components**
   - [ ] Create brightness slider
   - [ ] Implement slider styling (track + knob)
   - [ ] Add debounce logic (100ms)
   - [ ] Implement value label updates
   - [ ] Create duplicate sliders for speed, color, saturation, warmth

3. **Basic Network Integration**
   - [ ] Implement HTTP client (`send_param_update()`)
   - [ ] Add rate-limit handling (200ms cooldown)
   - [ ] Implement timeout handling (5s)
   - [ ] Add error toast messages

### Phase 2: Advanced Controls (Week 3)

4. **Palette Selector**
   - [ ] Create carousel container
   - [ ] Add palette swatches (60×60 px)
   - [ ] Implement horizontal scroll
   - [ ] Add selection highlight
   - [ ] Test snap behavior

5. **Audio Controls**
   - [ ] Create toggle switch (ON/OFF)
   - [ ] Create microphone gain slider
   - [ ] Implement VU meter (visual gauge)
   - [ ] Add audio snapshot polling

6. **Calibration Button**
   - [ ] Create gold primary button
   - [ ] Implement calibration flow
   - [ ] Add spinner during calibration
   - [ ] Show success/error indicators

### Phase 3: Polish & Refinement (Week 4)

7. **Animations & Feedback**
   - [ ] Implement button press effects
   - [ ] Add slider drag feedback
   - [ ] Implement pattern name fade transition
   - [ ] Add syncing badge pulse

8. **Error Handling**
   - [ ] Implement offline mode (disable all controls)
   - [ ] Add reconnection retry logic
   - [ ] Test network error scenarios
   - [ ] Verify timeout behavior

9. **Testing & Optimization**
   - [ ] Memory profiling (ensure <50MB)
   - [ ] Frame rate monitoring (target 60 FPS)
   - [ ] Touch responsiveness testing
   - [ ] 2+ hour stress test

---

## 10. TESTING CHECKLIST

### Visual Testing

- [ ] All text is readable at 48" distance (arm's length)
- [ ] Colors match PRISM design system
- [ ] Sliders are smooth and responsive (no jank)
- [ ] Buttons have clear visual feedback on press
- [ ] Status indicators update in real-time
- [ ] Toast notifications appear and disappear correctly

### Interaction Testing

- [ ] Slider drag updates value every 16ms (60 FPS)
- [ ] Debounce works: only one network request per drag
- [ ] Button press fires on release (not press)
- [ ] Toggle switch animates smoothly
- [ ] Palette carousel snaps correctly
- [ ] Keyboard navigation works (if applicable)

### Network Testing

- [ ] Parameter updates succeed within 500ms
- [ ] Rate limit (429) is handled gracefully
- [ ] Timeout after 5s shows error message
- [ ] Retry button resends failed request
- [ ] Offline mode disables all controls
- [ ] Reconnection updates all UI values

### Performance Testing

- [ ] App uses <50MB RAM
- [ ] Idle CPU usage <10%
- [ ] Slider drag doesn't drop below 60 FPS
- [ ] List scrolling is smooth (60 FPS momentum)
- [ ] No memory leaks after 2-hour session

---

## Conclusion

These specifications provide a complete, pixel-perfect blueprint for implementing Tab5 wireless controller UI components in C++ using LVGL. Each component includes:

- **Exact dimensions** (pixel coordinates)
- **LVGL code templates** (copy-paste ready)
- **Style definitions** (colors, fonts, shadows)
- **Event handlers** (input, network, error)
- **Animation timings** (visual feedback)
- **Update frequencies** (polling strategy)

Developers can immediately begin implementation following the Phase 1 roadmap, starting with the header/status bar and working through to advanced features in Phase 3.

---

**Document Version:** 1.0
**Last Updated:** 2025-11-05
**Status:** Published for Implementation

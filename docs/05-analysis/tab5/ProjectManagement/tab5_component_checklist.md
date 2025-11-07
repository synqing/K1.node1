---
Title: Tab5 LVGL Components - Implementation Checklist
Owner: K1 Development Team
Date: 2025-11-05
Status: published
Scope: Component-by-component implementation checklist for Tab5 UI
Related:
  - docs/06-reference/tab5_lvgl_component_specifications.md
  - docs/07-resources/tab5_lvgl_implementation_guide.md
Tags: Tab5, LVGL, Checklist, Implementation
---

# Tab5 LVGL Components - Implementation Checklist

**Purpose:** Step-by-step checklist for implementing each Tab5 UI component
**Use:** Print or paste into your IDE as you build each component

---

## PHASE 1: CORE COMPONENTS (Week 1-2)

### 1. Header / Status Bar

**Location:** Y: 0, Height: 60px

- [ ] Create status bar container (1280×60)
  - [ ] Set background color: `0x2f3849` (elevated)
  - [ ] Add bottom border: `1px, color: 0x4b5563`
  - [ ] Set layout: FLEX row
- [ ] Create WiFi status item
  - [ ] Position: X: 20, W: 80px
  - [ ] Icon: 📶 or custom icon
  - [ ] Value: RSSI in dBm (e.g., "-55 dBm")
  - [ ] Color: Green (>-60), Yellow (<-80), Red (<-100)
- [ ] Create battery status item
  - [ ] Position: X: 110, W: 80px
  - [ ] Icon: 🔋 or custom icon
  - [ ] Value: Percentage (e.g., "87%")
  - [ ] Color: Green (>20%), Yellow (10-20%), Red (<10%)
- [ ] Create FPS counter
  - [ ] Position: X: 200, W: 80px
  - [ ] Icon: ⚡ or custom icon
  - [ ] Value: Numeric FPS (0-60)
  - [ ] Color: Green (≥50), Yellow (30-50), Red (<30)
- [ ] Create CPU usage indicator
  - [ ] Position: X: 290, W: 80px
  - [ ] Value: Percentage
  - [ ] Color: Green (<60%), Yellow (60-80%), Red (>80%)
- [ ] Create memory usage indicator
  - [ ] Position: X: 380, W: 80px
  - [ ] Value: Percentage
  - [ ] Color: Green (<75%), Yellow (75-90%), Red (>90%)
- [ ] Start health polling timer (5-second interval)
  - [ ] GET `/api/health` endpoint
  - [ ] Parse JSON response
  - [ ] Update all status values
  - [ ] Handle HTTP errors gracefully

**Testing:**
- [ ] All text is readable at 48" distance
- [ ] Colors match specification
- [ ] Updates occur every 5 seconds
- [ ] No network errors after 24-hour runtime

---

### 2. Pattern Display (Large Title)

**Location:** Y: 60, Height: 80px

- [ ] Create centered text label
  - [ ] Font: Montserrat Bold, 36px
  - [ ] Color: `0xe6e9ef` (primary text)
  - [ ] Alignment: center
  - [ ] Content: Pattern name (e.g., "Wavelength")
- [ ] Add fade transition animation (200ms)
  - [ ] When pattern changes: fade out → update text → fade in
  - [ ] Use `lv_anim_*` functions for smooth transition
- [ ] Make it tappable (optional for Phase 1)
  - [ ] Tap to open pattern list
  - [ ] Scroll list to current pattern

**Testing:**
- [ ] Text is centered and large
- [ ] Fade animation is smooth
- [ ] Pattern name updates correctly after selection

---

### 3. Brightness Slider

**Location:** Y: 140, Height: 60px

- [ ] Create slider container (380×60)
  - [ ] Label: "Brightness" (14px, primary text)
  - [ ] Value display: "50%" (12px, accent color, right-aligned)
- [ ] Create slider widget
  - [ ] Size: 380×50px (within container)
  - [ ] Range: 0-100 (convert to 0.0-1.0 in code)
  - [ ] Default value: 50
- [ ] Style slider
  - [ ] Track: `0x2f3849` (elevated background)
  - [ ] Indicator (active part): `0x14b8a6` (teal accent)
  - [ ] Thumb (knob): `0x14b8a6` with 2px white border
  - [ ] Radius: 10px (track and indicator)
  - [ ] Thumb radius: circle (LV_RADIUS_CIRCLE)
- [ ] Implement event handler
  - [ ] LV_EVENT_VALUE_CHANGED: Update value display in real-time
  - [ ] LV_EVENT_FOCUSED: Add glow shadow effect
  - [ ] LV_EVENT_DEFOCUSED: Remove glow
- [ ] Implement debounce (100ms delay)
  - [ ] Queue updates when slider changes
  - [ ] Cancel previous timer if new drag starts
  - [ ] Send HTTP POST `/api/params` with `{"brightness": value}` after delay
- [ ] Show syncing feedback
  - [ ] During HTTP request: Show spinner badge next to value
  - [ ] On success: Show green checkmark (fade out after 600ms)
  - [ ] On error: Show red X + toast message

**Testing:**
- [ ] Slider responds to touch within 16ms
- [ ] Value updates live during drag (every frame)
- [ ] Only ONE network request sent per drag session
- [ ] Debounce delay is ~100ms (measure with logs)
- [ ] Syncing indicator appears/disappears correctly
- [ ] Error handling works (test with network unplugged)

---

### 4. Speed Slider (Duplicate Pattern)

**Location:** Y: 220 (100px below brightness)

- [ ] Duplicate brightness slider code
  - [ ] Label: "Speed"
  - [ ] Value display: Decimal (e.g., "0.55") instead of percentage
  - [ ] Range: same (0-100, convert to 0.0-1.0)
  - [ ] Default: 50
- [ ] Add preset buttons (optional)
  - [ ] "Slow" (0.3), "Normal" (0.5), "Fast" (0.8)
  - [ ] Position below slider
  - [ ] Tap to jump slider to preset value
- [ ] Implement event handler (same debounce pattern)
  - [ ] Send to `/api/params` with `{"speed": value}`

**Testing:**
- [ ] Same as brightness slider
- [ ] Preset buttons work (if implemented)

---

### 5. Color Slider

**Location:** Y: 300 (repeat as above)

- [ ] Create as duplicate of brightness slider
  - [ ] Label: "Color"
  - [ ] Value: percentage or decimal
  - [ ] Debounce: 100ms
  - [ ] HTTP: `{"color": value}`

**Testing:**
- [ ] Functions as expected

---

### 6. Additional Sliders (Saturation, Warmth)

**Location:** Y: 380, Y: 460

- [ ] Create saturation slider
  - [ ] Label: "Saturation"
  - [ ] HTTP key: `saturation`
- [ ] Create warmth slider
  - [ ] Label: "Warmth"
  - [ ] HTTP key: `warmth`
- [ ] Optional: Hide advanced sliders by default
  - [ ] Add "Advanced" toggle to show/hide

**Testing:**
- [ ] All sliders work independently
- [ ] No interference between sliders (no missed updates)

---

### 7. Pattern List (Scrollable)

**Location:** Y: 550, fills remaining space

- [ ] Create scrollable list container
  - [ ] Size: 1280×170 (fills space above footer)
  - [ ] Background: transparent
  - [ ] Scrolling: vertical momentum scroll with bounce
- [ ] Populate with pattern items
  - [ ] Fetch from `/api/patterns` on startup
  - [ ] Display: Pattern name + family icon (optional)
  - [ ] Each item: 44px height (touch-friendly)
- [ ] Highlight current pattern
  - [ ] Background: `0x3a4457` (highlighted)
  - [ ] Text: `0xe6e9ef` (primary)
- [ ] Implement selection handler
  - [ ] Tap pattern → Send POST `/api/select` with `{"index": N}`
  - [ ] Disable button for 200ms (rate limit)
  - [ ] Show "Syncing..." indicator
  - [ ] On success: Update pattern name display, highlight new item

**Testing:**
- [ ] List scrolls smoothly (60 FPS momentum)
- [ ] Patterns are readable and tappable
- [ ] Current pattern is visibly highlighted
- [ ] Pattern switch works with network integration

---

### 8. Footer Status Bar

**Location:** Y: 680, Height: 40px

- [ ] Create footer container (1280×40)
  - [ ] Background: `0x2f3849`
  - [ ] Top border: `1px, 0x4b5563`
- [ ] Left section: Battery indicator
  - [ ] Icon: 🔋
  - [ ] Text: "87%" (example)
  - [ ] Position: X: 20
- [ ] Center section: Sync timestamp
  - [ ] Text: "Synced 2s ago" → updates every 1 second
  - [ ] Font: 11px, secondary color
  - [ ] Update logic: Track `last_sync_time`, calc elapsed seconds
- [ ] Right section: Retry button (hidden by default)
  - [ ] Shows only when HTTP request fails
  - [ ] Button: "↻ Retry"
  - [ ] Tap to resend last failed request
  - [ ] Position: X: 1260, aligned right

**Testing:**
- [ ] Timestamp updates every 1 second
- [ ] Retry button appears on error
- [ ] Retry button works correctly

---

### PHASE 1 INTEGRATION TEST

Once all Phase 1 components are built:

- [ ] **Visual**: All components visible and properly positioned
- [ ] **Touch**: All sliders, buttons respond to touch
- [ ] **Network**: HTTP requests succeed for all controls
- [ ] **Debounce**: Rate limiting prevents too many requests
- [ ] **Error Handling**: Graceful behavior when K1 offline
- [ ] **Performance**: FPS stays at 60 during interaction
- [ ] **Memory**: Heap usage <50MB (check with profiler)

---

## PHASE 2: AUDIO & PALETTE CONTROLS (Week 3)

### 9. Audio Reactivity Toggle

**Location:** X: 680, Y: 160 (right column)

- [ ] Check if current pattern supports audio
  - [ ] GET `/api/pattern/current` → check `is_audio_reactive` flag
  - [ ] Only show audio controls if true
- [ ] Create toggle switch
  - [ ] Size: 80×40 (track)
  - [ ] Default: OFF
  - [ ] Colors: OFF=gray, ON=green
- [ ] Style switch
  - [ ] Track: `0x2f3849` (elevated)
  - [ ] Knob: `0x14b8a6` (teal) when OFF, `0x10b981` (green) when ON
  - [ ] Pill-shaped (radius: 20)
- [ ] Add label below: "Audio Reactivity"
  - [ ] Font: 12px, primary text
  - [ ] Centered
- [ ] Implement event handler
  - [ ] LV_EVENT_VALUE_CHANGED: Send update to K1
  - [ ] POST `/api/audio-config` with `{"active": 0 or 1}`
  - [ ] On enable: Show audio gain slider + VU meter (unhide)
  - [ ] On disable: Hide audio gain slider + VU meter (hide)

**Testing:**
- [ ] Toggle responds smoothly
- [ ] Network update works
- [ ] Audio sections show/hide correctly

---

### 10. Microphone Gain Slider

**Location:** X: 680, Y: 220 (below audio toggle)

- [ ] Create slider (same pattern as brightness)
  - [ ] Size: 300×50px
  - [ ] Label: "Microphone Gain"
  - [ ] Range: 0.5 to 2.0 (0.5 = -6dB, 2.0 = +6dB)
  - [ ] Default: 1.0 (0dB)
  - [ ] Value display: "1.5x" (multiplication factor)
- [ ] Implement event handler (debounce: 100ms)
  - [ ] POST `/api/audio-config` with `{"microphone_gain": value}`

**Testing:**
- [ ] Slider range is 0.5-2.0 (verify min/max)
- [ ] Value display shows multiplication factor

---

### 11. VU Meter (Audio Activity)

**Location:** X: 680, Y: 300 (below gain slider)

- [ ] Create meter container (280×80px)
  - [ ] Background: `0x2f3849`
  - [ ] Rounded corners (8px)
  - [ ] Padding: 12px
- [ ] Create visual bar
  - [ ] Full width minus padding
  - [ ] Height: 24px
  - [ ] Background: `0x2f3849`
  - [ ] Fill color: `0x14b8a6` (teal)
  - [ ] Fill width: percentage of `vu_level` (0.0-1.0 → 0-100%)
- [ ] Add label above bar
  - [ ] Text: "Level: 0.65" (example)
  - [ ] Font: 11px, secondary color
- [ ] Implement polling timer
  - [ ] GET `/api/audio/snapshot` every 200ms
  - [ ] Parse `vu_level` from response
  - [ ] Update bar fill width
  - [ ] Animate bar smoothly (use lv_anim)
- [ ] Handle audio disabled state
  - [ ] Hide meter when toggle is OFF

**Testing:**
- [ ] Meter responds to audio (test by singing/clapping near Tab5 mic)
- [ ] Updates every ~200ms (smooth but responsive)
- [ ] Shows/hides with toggle state

---

### 12. Palette Carousel Selector

**Location:** X: 420, Y: 160 (middle column)

- [ ] Fetch palette list on startup
  - [ ] GET `/api/palettes` once
  - [ ] Cache locally
- [ ] Create carousel container
  - [ ] Size: 230×90px
  - [ ] Horizontal scroll
  - [ ] Snap to center
- [ ] Create palette swatches
  - [ ] For each palette: Create 60×60px button
  - [ ] Background color: First color from palette
  - [ ] Border: 3px, `0x4b5563` (gray)
  - [ ] Label below: Palette name (10px)
  - [ ] Spacing: 12px between swatches
- [ ] Style active palette
  - [ ] Border: 4px white
  - [ ] Shadow: 12px teal glow
- [ ] Implement selection handler
  - [ ] Tap swatch → Get palette ID
  - [ ] POST `/api/params` with `{"palette_id": N}`
  - [ ] Show syncing indicator
  - [ ] Debounce: 300ms (same as sliders)
- [ ] Implement scroll snap
  - [ ] Carousel snaps to center when released
  - [ ] Smooth momentum scrolling

**Testing:**
- [ ] Palettes load from API
- [ ] Carousel scrolls smoothly
- [ ] Selection works and updates K1
- [ ] Active palette is visibly highlighted

---

### 13. Calibration Button (Gold Accent, Prominent)

**Location:** X: 680, Y: 350 (right column, prominent)

- [ ] Create button
  - [ ] Size: 150×150px
  - [ ] Background: `0xffb84d` (gold)
  - [ ] Text: "Calibrate\nNoise" (2 lines)
  - [ ] Text color: `0x1c2130` (dark on gold)
  - [ ] Font: 14px, bold
- [ ] Style button
  - [ ] Radius: 12px
  - [ ] Shadow: 8px, opacity 100
  - [ ] Pressed state: Darker gold (`0xf59e0b`), scale 95%
- [ ] Create label (center text)
  - [ ] Center vertically and horizontally
  - [ ] Text color: dark for readability on gold
- [ ] Implement click handler
  - [ ] Disable button on click (prevent double-tap)
  - [ ] Show spinner: Change label to "⟳"
  - [ ] POST `/api/audio/noise-calibrate` (no body)
  - [ ] Wait for response (timeout: 10 seconds)
- [ ] Handle response
  - [ ] Success (200): Show checkmark "✓" (green, 2 seconds), then reset
  - [ ] Error: Show "✕" (red), show toast "Calibration failed"
  - [ ] Re-enable button after result shown
- [ ] Add progress indicator (optional)
  - [ ] Expected duration: ~8 seconds (500 frames)
  - [ ] Show progress bar below button (fill 0-100%)

**Testing:**
- [ ] Button is prominent and highly visible
- [ ] Tap response is immediate (visual feedback)
- [ ] Spinner shows during calibration
- [ ] Success/error indicators display correctly
- [ ] Calibration completes in ~8 seconds
- [ ] Double-tap prevention works

---

### PHASE 2 INTEGRATION TEST

Once audio and palette controls are added:

- [ ] Audio controls appear only for audio-reactive patterns
- [ ] Palette swatches display correctly
- [ ] Calibration button is gold and prominent
- [ ] All debouncing works correctly
- [ ] Network integration is smooth
- [ ] No UI freezing during operations

---

## PHASE 3: POLISH & REFINEMENT (Week 4)

### 14. Animations

- [ ] Button press effects
  - [ ] Scale down to 95% on press
  - [ ] Return to 100% on release
  - [ ] Duration: 100ms
- [ ] Pattern name transition
  - [ ] Fade out (200ms) when pattern changes
  - [ ] Update text
  - [ ] Fade in (200ms)
- [ ] Syncing badge pulse
  - [ ] Opacity: 70% → 100% → 70%
  - [ ] Duration: 1 second cycle
  - [ ] Repeat while syncing
- [ ] Slider thumb glow (on focus)
  - [ ] Shadow: 12px, color: teal, opacity: 60%
  - [ ] Show while dragging
  - [ ] Remove on release

**Testing:**
- [ ] All animations are smooth (60 FPS)
- [ ] Animations match design timings

---

### 15. Connection Management

- [ ] Auto-reconnect logic
  - [ ] Detect connection loss (timeout on any request)
  - [ ] Show "Disconnected" status (red indicator)
  - [ ] Retry with exponential backoff (1s, 2s, 4s, 8s...)
  - [ ] Max retries: 10 (total ~5 minutes)
- [ ] Disable controls when offline
  - [ ] All sliders, buttons, toggles: LV_STATE_DISABLED
  - [ ] Grayed out appearance
  - [ ] No network requests accepted
- [ ] Reconnection recovery
  - [ ] On success: Enable controls, refresh all values
  - [ ] Fetch fresh `/api/params` to sync all sliders
  - [ ] Show "Connected" status (green indicator)
  - [ ] Show toast "Reconnected to K1"
- [ ] Offline queue (optional)
  - [ ] Queue user changes while offline
  - [ ] On reconnect: Send only most recent value per parameter

**Testing:**
- [ ] Unplug network → App detects within 5 seconds
- [ ] Auto-retry works (watch logs for exponential delays)
- [ ] Reconnection updates UI correctly
- [ ] No crashes when network restores

---

### 16. Error Handling & User Feedback

- [ ] Rate limit (429) handling
  - [ ] Show toast: "Too many requests. Waiting..."
  - [ ] Auto-retry after delay
  - [ ] Read `X-RateLimit-NextAllowedMs` header if available
- [ ] Timeout (5+ seconds) handling
  - [ ] Show error toast: "Device not responding"
  - [ ] Disable related controls
  - [ ] Show retry button
- [ ] Malformed response handling
  - [ ] Try-catch around JSON parsing
  - [ ] Log error details
  - [ ] Show generic "Device error" message
- [ ] Toast notifications
  - [ ] Success (green): "Updated successfully"
  - [ ] Warning (yellow): "Too many requests"
  - [ ] Error (red): "Failed to update"
  - [ ] Auto-dismiss after 3 seconds (or on tap)

**Testing:**
- [ ] Test each error scenario:
  - [ ] Unplug network (timeout)
  - [ ] Send rapid updates (429 rate limit)
  - [ ] Device reboot (connection loss + recovery)
- [ ] Verify error messages are clear and actionable

---

### 17. Performance Optimization

- [ ] Memory profiling
  - [ ] Target: <50 MB total app memory
  - [ ] Run `print_memory_stats()` (see guide)
  - [ ] Free unused objects and timers
- [ ] FPS monitoring
  - [ ] Target: 60 FPS sustained
  - [ ] Watch for frame drops during slider drag
  - [ ] Optimize redraws (minimize lv_obj_set_style calls in loops)
- [ ] Network bandwidth
  - [ ] Monitor HTTP request size
  - [ ] Debounce prevents request spam
  - [ ] Target: <200 KB/s bandwidth

**Testing:**
- [ ] 2-hour continuous operation
  - [ ] Monitor memory for leaks
  - [ ] Monitor FPS for consistency
  - [ ] No UI freezing or crashes

---

## FINAL VALIDATION CHECKLIST

### Visual & Usability

- [ ] All text readable at 48" distance
- [ ] Colors match PRISM design system
- [ ] Touch targets ≥44×44px minimum
- [ ] No overlapping UI elements
- [ ] Logical flow (left column → middle → right)
- [ ] Status indicators clear and informative

### Functional

- [ ] All controls respond to touch
- [ ] Sliders update values smoothly
- [ ] Buttons execute actions correctly
- [ ] Network requests succeed 99%+ of time
- [ ] Debouncing prevents request spam
- [ ] Offline mode works gracefully

### Performance

- [ ] FPS: 60 sustained (measure with profiler)
- [ ] Memory: <50 MB (profile with heap_caps tools)
- [ ] CPU: <10% idle, <30% active use
- [ ] Startup: <3 seconds from boot

### Reliability

- [ ] 24-hour continuous operation (no crashes)
- [ ] Network disconnect/reconnect works
- [ ] No memory leaks (check heap after 2 hours)
- [ ] Error states recoverable

### Code Quality

- [ ] All memory allocated is freed (no leaks)
- [ ] All timers created are deleted
- [ ] All HTTP callbacks cleaned up
- [ ] No compiler warnings
- [ ] Comments for non-obvious logic

---

## Sign-Off

**Date Started:** ___________
**Estimated Completion:** ___________
**Developer Name:** ___________
**Review Status:** ☐ Pending ☐ In Review ☐ Approved

**Notes:**
```
[Space for implementation notes, blockers, issues]
```

---

**Last Updated:** 2025-11-05
**Checklist Version:** 1.0

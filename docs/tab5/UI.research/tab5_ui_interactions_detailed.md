# Tab5 Controller - Detailed UI/UX & Interaction Flows

**Title:** Tab5 MVP UI Layout, Wireframes, and Interaction Sequences
**Owner:** K1.reinvented UI/UX Team
**Date:** 2025-11-05
**Status:** proposed
**Scope:** High-fidelity interaction flows, screen layouts, state machines, and design rationale for Tab5 MVP
**Related:**
- MVP Feature Spec: `/docs/04-planning/tab5_controller_mvp_spec.md`
- K1 Control Panel Reference: `/webapp/README.md` (web control panel patterns)

---

## Part 1: High-Level Information Architecture

### Screen Hierarchy
```
┌─ Main Screen (ControllerFragment)
│  ├─ Status Bar (always visible)
│  ├─ Pattern Display (always visible)
│  ├─ Favorites Carousel (always visible)
│  ├─ Parameter Controls (always visible)
│  └─ Pattern List (scrollable)
│
└─ Modals (on-demand)
   ├─ Settings Modal (device IP, reconnect, debug)
   ├─ Pattern Search Modal (filter by name/family)
   └─ About Modal (app version, K1 firmware info)
```

---

## Part 2: Detailed Screen Layout

### Screen 1: Main Control Panel (Default)

#### Visual Hierarchy (Top to Bottom)

```
┌─────────────────────────────────────────────────────────────┐
│ Header Bar (60px, solid dark background)                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ◉ Connected               K1 @ 192.168.1.42     ⚙ ⋮    │ │
│ │ (green dot)               (center, gray text)   (icons) │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Pattern Display (80px padding)                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                                                         │ │
│ │                  WAVELENGTH                            │ │
│ │              (36px, bold, centered)                    │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Favorites Row (100px)                                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                     │ │
│ │ │    │ │    │ │    │ │    │ │    │ ← (each 70px sq)  │ │
│ │ │Void│ │Ether  │Pulse │Drift│Glow│                    │ │
│ │ └────┘ └────┘ └────┘ └────┘ └────┘ ← (12px gap)      │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Parameter Controls (360px)                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                                                         │ │
│ │ Brightness                                              │ │
│ │ ────────────●───────────── 87%                         │ │
│ │ │◀ 0%     50%               │  ▶ 100%                  │ │
│ │                                                         │ │
│ │ Speed                                                   │ │
│ │ ───────●──────────────────── 0.55                      │ │
│ │ │◀ Slow  Normal           │  ▶ Fast                    │ │
│ │                                                         │ │
│ │ Color / Palette                                         │ │
│ │ ◀  ┌────┐ ┌────┐ ┌────┐ ┌────┐  ▶                     │ │
│ │    │    │ │    │ │    │ │    │                        │ │
│ │    │Twil│ │Lava│ │Vibe│ │Neon│                        │ │
│ │    └────┘ └────┘ └────┘ └────┘                        │ │
│ │ (highlight active palette)                             │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Pattern List (scrollable, fill remaining space)            │ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ All Patterns                                            │ │
│ │ ▓ Wavelength ←─────── (currently active, highlight)   │ │
│ │   Ether                                                 │ │
│ │   Pulse                                                 │ │
│ │   Drift                                                 │ │
│ │   Glow                                                  │ │
│ │   Void Trail                                            │ │
│ │   [... scrollable ...]                                  │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Footer (40px)                                               │
│ 🔋 100% | Synced 1s ago | ⟳ (retry button if error)      │
└─────────────────────────────────────────────────────────────┘
```

---

#### Component Specifications

##### Status Bar (Top)
- **Height:** 60px
- **Background:** `--prism-bg-elevated` (dark, slightly elevated from body)
- **Border:** 1px bottom, `--prism-border-color`
- **Left Section (40% width):**
  - Dot indicator (8px circle):
    - Green: Connected
    - Red: Disconnected
    - Yellow: Connecting...
  - Text: "Connected" / "Disconnected" / "Connecting..."
  - Font: 14px, regular weight
- **Center Section (40% width):**
  - Device name or IP
  - Font: 12px, gray (secondary color)
  - Tap to open settings
- **Right Section (20% width):**
  - Settings icon (24x24 px, tap opens modal)
  - Overflow menu icon (⋮, tap for more options)

##### Pattern Display
- **Height:** 80px (with padding)
- **Font:** 36px, bold, `--prism-text-primary`
- **Alignment:** Centered
- **Update behavior:** Fade transition (200ms) when pattern changes
- **Interaction:** Tap to open pattern list (scroll to current)

##### Favorites Carousel
- **Height:** 100px (12px padding top/bottom)
- **Layout:** Horizontal, 5 items max visible
- **Item size:** 70x70 px (square)
- **Item gap:** 12px (flex spacing)
- **Scrollable:** If more than 5 favorites (horizontal scroll)
- **Highlight:** Active pattern has border (3px, accent color)
- **Text:** Pattern name below button (12px, centered)
- **Interaction:**
  - Tap to switch pattern
  - Long-press to edit (Phase 2)

##### Brightness Slider
- **Height:** 50px
- **Label:** "Brightness" (14px, bold)
- **Slider track:** Full width minus padding
- **Thumb size:** 48px diameter (touch-friendly)
- **Value display:** Right-aligned percentage (14px, mono font)
- **Preset buttons:** Optional row below (25%, 50%, 75%, 100%)
- **Interaction:**
  - Drag thumb to adjust
  - Long-press thumb to fine-tune mode (slower drag)
  - Tap preset button to jump to value
  - Show live value during drag

##### Speed Slider
- **Height:** 50px
- **Same layout as brightness**
- **Value display:** Decimal (0.0–1.0) centered
- **Preset buttons:** "Slow" (0.3), "Normal" (0.5), "Fast" (0.8)
- **Optional visual:** Tempo icon or animation

##### Palette Carousel
- **Height:** 80px (with labels)
- **Layout:** Horizontal scroll, snapping carousel
- **Item size:** 60x60 px (square swatch)
- **Item gap:** 8px
- **Navigation:** Left/Right arrows visible if scrollable
- **Highlight:** Active palette has border (3px, white or accent)
- **Text:** Palette name below swatch (12px, centered)
- **Interaction:**
  - Tap swatch to select
  - Swipe to scroll
  - Snap to nearest palette on release

##### Pattern List
- **Height:** Fill remaining space (min 200px visible)
- **Header:** "All Patterns" (14px, bold)
- **Item layout:** Row with pattern name + family icon
- **Item height:** 44px (touch-friendly min)
- **Current pattern:** Highlighted background (`--prism-bg-highlighted`)
- **Dividers:** Subtle 1px separator between items
- **Scrolling:** Momentum scroll with overscroll bounce
- **Interaction:** Tap to switch pattern

##### Footer Status
- **Height:** 40px
- **Content:**
  - Battery icon + percentage (left)
  - Sync status + timestamp (center)
  - Retry button if error (right)
- **Font:** 11px, secondary color
- **Update:** Synced timestamp updates every 1s

---

## Part 3: State Diagram (Connection & Sync)

```
┌─────────────────┐
│   App Launch    │
└────────┬────────┘
         │
         ▼
  ┌──────────────────┐
  │ Try Auto-Connect │
  │ (mDNS or last IP)│
  └────┬─────────┬───┘
       │         │
   Success   Fail
       │         │
       ▼         ▼
   ┌─────────┐ ┌──────────────┐
   │Connected│ │ Disconnected │
   │ (green) │ │   (red)      │
   └────┬────┘ └──┬───────┬───┘
        │         │       │
   UI Ready   Show Help   Manual IP
        │         │       │
        ▼         ▼       ▼
   ┌──────────────────────────┐
   │ Waiting for User Action  │
   └──────────────────────────┘
        │
        ├─────────────────┬────────────┬─────────────┐
        │                 │            │             │
        ▼                 ▼            ▼             ▼
   Switch Pattern    Adjust Param  Network Lost   Manual Settings
        │                 │            │             │
        ├─────────────────┴────────────┼─────────────┤
        │                              │
        ▼                              ▼
   Queue Update            ┌──────────────────┐
   Send (debounced)        │ Retry Loop       │
   Show "Syncing..."       │ (exp. backoff)   │
   200ms timeout           │ Max 30s total    │
   │                       │                  │
   ├─────────────────────┬─┼──────────────────┤
   │ Success         Failure│                │
   ▼                  ▼     │                ▼
Show "Synced ✓"  "Failed"   │          Manual Reconnect
Update UI        Toast      │          Button Appears
Update timestamp Show Retry  │
                 Button      │
                 │           │
                 └───────────┘
```

---

## Part 4: Interaction Flows (Detailed Sequences)

### Flow 1: Pattern Switch via Tap

```
User Taps Pattern in List
  │
  ├─→ UI shows selection highlight (visual feedback)
  │
  ├─→ Get pattern ID from model
  │
  ├─→ Create network request:
  │   POST /api/params with { pattern_id: X }
  │
  ├─→ Show "Syncing..." micro-state (badge or spinner)
  │
  ├─→ Send request (async, no blocking)
  │
  ├─→ Set 5-second timeout:
  │   If no response:
  │     ├─ Show "Failed" toast
  │     └─ Show Retry button
  │
  ├─→ On successful response (2xx):
  │   ├─ Update local state: current_pattern = X
  │   ├─ Fetch latest params: GET /api/params
  │   ├─ Update all UI fields from response
  │   ├─ Show "Synced ✓" confirmation (200ms fade-in)
  │   ├─ Update timestamp: "Synced 0s ago"
  │   └─ Fade highlight out (200ms)
  │
  └─→ Flow complete
```

**User Perception:**
1. Instant visual feedback (highlight + "Syncing...")
2. Pattern name updates within 500ms
3. Confirmation appears (green checkmark or fade-out of "Syncing...")

---

### Flow 2: Brightness Slider Adjustment

```
User Presses Thumb on Brightness Slider
  │
  ├─→ Show thumb visual feedback (scale up, shadow)
  │
  └─→ User Drags Thumb to New Value
     │
     ├─→ Update slider UI in real-time (drag position)
     │
     ├─→ Show live value: "87%" (updates every 16ms)
     │
     ├─→ Queue update for debounce (300ms window):
     │   ├─ If this is first drag: start 300ms timer
     │   ├─ If timer running: cancel old timer, start new
     │   └─ Store latest value in debounce buffer
     │
     └─→ User Releases Thumb
        │
        ├─→ Debounce timer fires (300ms after last drag):
        │
        ├─→ Create network request:
        │   POST /api/params with { brightness: 0.87 }
        │
        ├─→ Show "Syncing..." next to value
        │
        ├─→ Send request (async)
        │
        ├─→ On response:
        │   ├─ Update brightness in local state
        │   ├─ Remove "Syncing..." badge
        │   ├─ Show brief "✓" checkmark (200ms fade)
        │   └─ Update timestamp
        │
        └─→ Flow complete
```

**Debounce Behavior:**
- User holds slider for 800ms, dragging 10 times per 100ms
  - Only the **last** value is sent (single network request)
  - Total sends: 1 request
  - Efficiency: 90% reduction in network traffic

**Edge Case: Rapid Slider Releases**
```
User releases slider, then taps again within 200ms:
  ├─ First debounce timer fires, send old value
  ├─ Second drag starts, new timer begins
  ├─ Second debounce fires after release, send new value
  └─ Result: 2 requests (expected behavior)
```

---

### Flow 3: Color Palette Selection via Carousel Swipe

```
User Swipes Palette Carousel Left/Right
  │
  ├─→ Carousel scrolls smoothly (momentum-based fling)
  │
  ├─→ Snap to nearest palette swatch on release
  │
  └─→ User Taps Palette Swatch
     │
     ├─→ Get palette ID from model
     │
     ├─→ Show swatch highlight (3px border, accent color)
     │
     ├─→ Queue update for debounce (300ms):
     │   └─ Similar to slider, but 300ms window
     │
     ├─→ Create network request:
     │   POST /api/params with { palette_id: Y }
     │
     ├─→ Show "Syncing..." badge
     │
     ├─→ On response:
     │   ├─ Update palette_id in local state
     │   ├─ Highlight new palette in carousel
     │   └─ Show "Synced ✓"
     │
     └─→ Flow complete
```

---

### Flow 4: Connection Loss & Recovery

```
Network Disconnects (WiFi drops or K1 webserver unreachable)
  │
  ├─→ Pending request times out (5s):
  │   ├─ Show error toast: "Device not responding"
  │   └─ Set connection state to "Disconnected"
  │
  ├─→ Update UI:
  │   ├─ Status badge changes red
  │   ├─ Text shows "Disconnected"
  │   ├─ Disable parameter sliders (visual fade-out)
  │   └─ Show "Reconnect" button in footer
  │
  ├─→ Auto-Retry Loop (exponential backoff):
  │   ├─ Attempt 1: 1s delay → GET /api/test-connection
  │   ├─ Attempt 2: 2s delay (if failed)
  │   ├─ Attempt 3: 4s delay (if failed)
  │   ├─ Attempt 4: 8s delay (if failed)
  │   ├─ Attempt 5: 16s delay (if failed)
  │   ├─ Attempt 6+: 30s delay (cap at 30s)
  │   └─ Max total attempts: 10 (5 minutes total)
  │
  └─→ On Successful Reconnect:
     │
     ├─→ Show toast: "Reconnected to K1"
     │
     ├─→ Fetch fresh params: GET /api/params
     │
     ├─→ Update all UI fields (brightness, speed, palette, etc.)
     │
     ├─→ Resume queued updates:
     │   ├─ If user queued changes while disconnected:
     │   │  └─ Send queued update (most recent value only)
     │   └─ Example: User changed brightness from 0.5 → 0.7 → 0.8 while offline
     │       └─ Only send brightness: 0.8 (discard 0.5 and 0.7)
     │
     ├─→ Update status badge: green "Connected"
     │
     ├─→ Re-enable parameter sliders
     │
     └─→ Flow complete
```

---

### Flow 5: Favorite Management (Phase 2, but included for context)

```
User Long-Presses Pattern in List
  │
  ├─→ Show context menu:
  │   ├─ "Add to Favorites" (if not already favorited)
  │   ├─ "Remove from Favorites" (if already favorited)
  │   └─ "Rename" (Phase 3)
  │
  └─→ User Selects "Add to Favorites"
     │
     ├─→ Save pattern ID to local SharedPreferences:
     │   └─ Key: "favorites" → Value: [3, 5, 7] (pattern IDs)
     │
     ├─→ Show "Added to Favorites" toast
     │
     ├─→ Update Favorites Carousel:
     │   ├─ Fetch favorite patterns from local storage
     │   ├─ Rebuild carousel UI (add new item)
     │   └─ Animate in (slide + fade)
     │
     └─→ Flow complete
```

---

## Part 5: Error States & Recovery UX

### State 1: Connection Pending (Yellow)
```
┌──────────────────────────────┐
│ ◐ Connecting...              │ ← Spinning dot
│ (attempting to reach K1)     │
│                              │
│ [Manual IP Input] [Cancel]   │
└──────────────────────────────┘
```

### State 2: Connection Failed (Red)
```
┌──────────────────────────────┐
│ ◉ Disconnected               │ ← Red dot
│ Last seen: 5m ago            │
│                              │
│ [Retry Now] [Settings]       │
│ (retrying automatically...)  │
└──────────────────────────────┘
```

### State 3: Sync Error (Toast)
```
┌──────────────────────────────┐
│ ⚠ Failed to update pattern   │
│ The device is not responding │
│                              │
│ [Retry] [Dismiss]            │
└──────────────────────────────┘
```

### State 4: Rate Limited (429)
```
┌──────────────────────────────┐
│ ⚠ Too many requests          │
│ Please wait a moment...      │
│                              │
│ (auto-retry in 3s)           │
└──────────────────────────────┘
```

---

## Part 6: Typography & Spacing Scale

### Font Sizes
- **Header/Titles:** 36px (Pattern name)
- **Large labels:** 16px (Slider labels)
- **Body text:** 14px (Pattern names in list)
- **Secondary text:** 12px (Values, hints)
- **Micro text:** 11px (Footer timestamp)

### Spacing (Vertical/Horizontal)
- **Largest gap (sections):** 24px
- **Medium gap (row items):** 16px
- **Small gap (inline items):** 12px
- **Micro gap (padding):** 8px

### Touch Targets
- **Minimum:** 44px x 44px (WCAG guideline)
- **Preferred:** 48px x 48px
- **Buttons:** 48px height, 100% width (or min 80px)
- **Slider thumb:** 48px diameter

---

## Part 7: Color Palette (Token Mapping)

All colors use CSS tokens from K1 webapp (`--prism-*`):

```
Primary Background:    --prism-bg-canvas        (deep dark)
Secondary BG:         --prism-bg-elevated      (slightly lighter)
Tertiary BG:          --prism-bg-highlighted   (for active/selected items)
Text Primary:         --prism-text-primary     (white)
Text Secondary:       --prism-text-secondary   (gray)
Border:               --prism-border-color     (subtle gray)
Accent:               --prism-accent-color     (bright, usually cyan or lime)
Success:              --prism-success-color    (green)
Warning:              --prism-warning-color    (yellow)
Error:                --prism-error-color      (red)
```

**State Colors:**
- **Connected:** `--prism-success-color` (green dot)
- **Disconnected:** `--prism-error-color` (red dot)
- **Connecting:** `--prism-warning-color` (yellow dot, spinning)
- **Synced:** `--prism-success-color` ✓ (brief flash)
- **Syncing:** `--prism-warning-color` (spinner)

---

## Part 8: Animation Timings

| Animation | Duration | Easing |
|-----------|----------|--------|
| Slider thumb drag | Real-time | Linear |
| Debounce timer | 300ms | (queue, not visual) |
| Fade in "Synced ✓" | 200ms | ease-out |
| Fade out "Synced ✓" | 200ms (hold 400ms) | ease-in |
| Pattern name transition | 200ms | ease-in-out |
| Status badge pulse (connecting) | 1000ms | ease-in-out |
| Toast notification | 300ms in, hold 2s, 300ms out | ease-out / ease-in |
| Carousel snap | 400ms | ease-out |

---

## Part 9: Accessibility (A11y) Considerations

### Touch Targets
- All buttons: minimum 44x44px (preferably 48x48px)
- Slider thumb: 48px diameter
- Carousel items: 70px square (favorites), 60px square (palettes)

### Color Contrast
- Text on dark backgrounds: minimum 4.5:1 ratio (WCAG AA)
- Use accent color + icon/text combo for color-blind accessibility
- Status indicators: Use both color AND icon (green dot + "Connected" text)

### Keyboard Navigation
- Not required for MVP (touch-first), but consider for Phase 2:
  - Tab to cycle through sliders
  - Arrow keys to adjust slider values
  - Enter to confirm pattern switch

### Screen Reader Support (Phase 2)
- Label all buttons with descriptive text (not just icons)
- Announce slider values when adjusted
- Announce connection status changes
- Use `contentDescription` on all ImageViews

---

## Part 10: Responsive Layout Notes

### Tablet Orientation (Primary: Portrait)
- **Layout:** Full-screen single column
- **Width:** Fill 100% (minus system margins)
- **Max content width:** 600dp (if portrait on very large tablet)

### Landscape (Phase 2)
- **Layout:** Two-column (parameters left, pattern list right)
- **Split width:** 40/60 left/right
- **No header reflow** (stays fixed top)

### Very Large Tablets (Phase 2+)
- **Parameter controls:** Display side-by-side (brightness + speed columns)
- **Pattern list:** Two-column grid

---

## Part 11: Bottom Sheet Modal Layouts

### Settings Modal
```
┌──────────────────────────────┐
│ Settings                ✕    │ ← Header with close
├──────────────────────────────┤
│ Device Connection            │
│ IP Address: [192.168.1.42] ✎ │ ← Editable
│ [Discover mDNS]              │ ← Auto-find button
│                              │
│ Debug & Status               │
│ K1 Firmware: v1.2.3          │
│ App Version: 1.0.0           │
│ Battery: 87% (charging)      │
│ Free Heap: 145 KB            │
│                              │
│ Advanced                      │
│ [Verbose Logging] (toggle)   │
│ [Factory Reset] (button)     │
│                              │
│ [Close]                      │
└──────────────────────────────┘
```

### Pattern Search Modal
```
┌──────────────────────────────┐
│ Search Patterns         ✕    │
├──────────────────────────────┤
│ [Search...] 🔍               │ ← Filter input
│                              │
│ Filter by Family:            │
│ ○ All    ● Reactive          │
│ ○ Ambient  ○ Kinetic         │
│                              │
│ Results (7 matched)          │
│ ▓ Wavelength (reactive)      │
│   Pulse (reactive)           │
│   Drift (kinetic)            │
│   Ether (ambient)            │
│   [... more ...]             │
│                              │
│ [Close]                      │
└──────────────────────────────┘
```

---

## Part 12: Gesture Support (MVP + Phase 2)

### MVP Gestures
- **Tap:** Select pattern, toggle settings
- **Drag (slider):** Adjust brightness/speed
- **Swipe (carousel):** Scroll palette/favorites (horizontal)
- **Swipe (list):** Scroll pattern list (vertical)

### Phase 2 Gestures
- **Long-press:** Edit favorites, open context menu
- **Swipe left/right (pattern name):** Cycle previous/next pattern
- **Pinch zoom (list):** Expand/collapse (optional)
- **Double-tap (parameter):** Reset to default

---

## Part 13: Visual Feedback Summary Table

| User Action | Visual Feedback | Duration | Disappears When |
|-------------|-----------------|----------|-----------------|
| Tap pattern | Highlight + flash | 200ms | User selects another pattern |
| Drag slider | Live value %, thumb scale | Real-time | User releases |
| Release slider | "Syncing..." badge | Until response | Response received |
| Sync success | "✓" green checkmark | 200ms fade-in, hold 400ms, fade-out | Auto-disappear (600ms total) |
| Sync fail | "⚠" red badge + toast | Persistent | User taps "Retry" or new action |
| Network loss | Red "Disconnected" badge | Persistent | Network restored |
| Reconnect success | Green badge + toast | Toast: 3s | Auto-dismiss |
| Pattern name change | Fade transition (200ms) | 200ms | Complete |

---

## Part 14: Known Limitations & Future Improvements

### MVP Limitations
- No HSV color picker (palette-only MVP)
- No audio visualization
- No custom pattern parameters (custom_param_1, etc.)
- No gesture shortcuts (Phase 2)
- No cloud preset sync
- No voice feedback
- Single device only (one Tab5 per K1)

### Phase 2 Priorities (Based on User Testing)
1. Gesture shortcuts (swipe patterns, double-tap reset)
2. Local preset saving
3. Search/filter in pattern list
4. Battery optimization
5. Landscape layout

### Phase 3+ Roadmap
- Cloud sync
- Multi-device control
- Voice feedback
- Custom parameter UI (dynamic based on pattern metadata)
- Show preset manager
- Pattern sharing / community presets

---

## Part 15: Design Decisions Rationale

### Decision: Single Screen (No Tabs)
**Rationale:**
- Performer context: On stage, muscle memory is critical
- Always knowing where controls are (same location) > discovering features
- Minimize cognitive load during live performance

**Alternative Considered:** Tab navigation (Control, Library, Settings)
- Rejected because: Too much switching; increases errors under pressure

---

### Decision: Favorites First
**Rationale:**
- 80/20 rule: Performers use same 3-5 patterns per set
- Quick access (one tap) vs. scrolling list (2-3 taps)
- Muscle memory builds faster with fixed positions

**Alternative Considered:** Alphabetical list only
- Rejected because: Slower for live use case

---

### Decision: Debounce on Client (300ms)
**Rationale:**
- Respects K1 firmware rate limit (prevents 429 errors)
- User doesn't experience "rejected" requests
- Single coalesced request per slider drag (efficiency)

**Alternative Considered:** No debounce, let K1 handle 429
- Rejected because: UX becomes unpredictable (some requests fail, UI flickers)

---

### Decision: Palette Carousel (Not Slider)
**Rationale:**
- Discrete palette selection (no in-between values)
- Visual swatch preview (see color before applying)
- Swipe navigation is intuitive

**Alternative Considered:** Dropdown/Picker
- Rejected because: Less visual, takes 2 taps vs. 1

---

## Part 16: Testing Checklist (QA)

### Layout & Responsiveness
- [ ] All text readable at 48px distance (stage use case)
- [ ] Touch targets all >= 44x44px
- [ ] No scrolling needed for top 4 control sections (status, pattern, favorites, params)
- [ ] Pattern list is fully scrollable with momentum
- [ ] Carousel snaps cleanly when released

### Interaction Responsiveness
- [ ] Slider thumb responds to drag within 16ms
- [ ] Pattern tap shows selection within 100ms
- [ ] Value displays update while dragging (no lag)
- [ ] "Syncing..." disappears after response (no >5s stuck state)
- [ ] Toast notifications dismiss after 3s (or on tap)

### Connection Handling
- [ ] Auto-reconnect works after WiFi dropout
- [ ] "Disconnected" state shows within 5s of network loss
- [ ] Queued updates resume after reconnect
- [ ] Exponential backoff is visible in retry attempts (not spamming)

### Error States
- [ ] 429 (rate limit) shows appropriate message
- [ ] 5xx (server error) shows "Device error, retrying..."
- [ ] 404 (pattern not found) shows "Pattern no longer available"
- [ ] No crash on malformed API response

### Performance
- [ ] App launches in < 3s (cold start)
- [ ] List scroll is smooth (60 FPS)
- [ ] Slider drags smoothly (no jank)
- [ ] No memory leaks over 2-hour session
- [ ] Battery drain < 50% per hour during active use

---

## Sign-off

**Design Lead:** (TBD)
**Developer Lead:** (TBD)
**Review Status:** Awaiting sign-off
**Next Steps:**
1. Create Android XML layout files (activity_main.xml, fragment_controller.xml)
2. Build sample UI in Android Studio
3. Implement connection manager & network client
4. Conduct usability testing on actual Tab5 device

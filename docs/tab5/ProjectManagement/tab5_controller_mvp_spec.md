# Tab5 Wireless Controller - MVP Feature Specification

**Title:** Minimum Viable Feature Set for Tab5 Research Prototype
**Owner:** K1.reinvented Hardware/Control Systems Team
**Date:** 2025-11-05
**Status:** proposed
**Scope:** Define MVP feature scope, UI design, and implementation roadmap for Tab5 (Android tablet) remote control
**Related:**
- K1 API: `/firmware/src/webserver.cpp` (REST endpoints)
- K1 Parameters: `/firmware/src/parameters.h` (control surface)
- Webapp Architecture: `/webapp/src/App.tsx` + React Query hooks

---

## Executive Summary

The Tab5 controller is a research prototype designed to remotely control K1.reinvented's active pattern from a distance (e.g., on stage, in a performance context). The MVP prioritizes the top 3-5 mode/parameter changes performers need during live performance, minimizing latency and network overhead.

**MVP Success Criteria:**
- Switch patterns wirelessly within 200ms
- Adjust 3-5 key parameters (brightness, speed, color) with < 100ms round-trip
- Display current mode and parameter values
- Show connection status clearly
- Survive network hiccup (auto-reconnect, queue updates)
- Battery lasts 2+ hours under typical use
- Zero dependencies on the K1 webapp codebase (standalone Android app)

---

## 1. Critical Control Functions (Must-Have)

### 1.1 Priority-Ranked Control Needs

#### **Tier 1: Pattern Selection (Highest Frequency)**
- **Use case:** Performer switches between 3-5 "active" patterns mid-performance
- **Current K1 API:** `POST /api/params` → `pattern_id` field
- **Tab5 Implementation:**
  - Quick-access favorites list (pins 3-5 patterns at top)
  - Swipe gesture to cycle through recent patterns
  - Alphabetical list (swipe/scroll) for discovery
  - Single-tap to change pattern

**Why critical:** Pattern changes are the *most frequent* control action during performance (estimated 1-4 changes per minute during active set).

#### **Tier 2: Brightness (Second Frequency)**
- **Use case:** Adjust overall LED intensity on stage
- **Current K1 API:** `POST /api/params` → `brightness` field (0.0–1.0)
- **Tab5 Implementation:**
  - Large slider (vertical or horizontal), thumb size 48px min
  - Preset buttons: 25%, 50%, 75%, 100%
  - Live preview feedback (visual bar)
  - Long-press to fine-tune (slower slide speed)

**Why critical:** Brightness adjustments happen frequently in response to stage lighting or visual goals (3-10 times per set).

#### **Tier 3: Speed (Third Frequency)**
- **Use case:** Slow down or speed up animation playback
- **Current K1 API:** `POST /api/params` → `speed` field (0.0–1.0)
- **Tab5 Implementation:**
  - Slider with visual tempo indicator
  - Preset buttons: Slow (0.3), Normal (0.5), Fast (0.8)
  - Optional: BPM sync input (for audio-reactive patterns)

**Why critical:** Speed changes adapt patterns to music tempo or desired intensity (2-5 times per set).

#### **Tier 4: Color/Palette (Fourth Frequency)**
- **Use case:** Cycle through color palettes for mood/theme
- **Current K1 API:** `POST /api/params` → `palette_id` field (discrete ID)
- **Tab5 Implementation:**
  - Horizontal carousel of palette swatches (3-4 visible at once)
  - Tap to select
  - Show currently active palette highlighted
  - No fading; instant switch

**Why important:** Color changes complement pattern changes (1-3 times per set).

#### **Tier 5: Audio Reactivity Toggle (Fifth, Optional)**
- **Use case:** Turn audio-reactive feedback on/off
- **Current K1 API:** `POST /api/params` → `audio.active` field (boolean-like)
- **Tab5 Implementation:**
  - Single toggle button (large, clearly labeled On/Off)
  - Shows current state visually (color change, icon state)

**Why optional for MVP:** Less frequent control; can defer to Phase 2 if needed.

### 1.2 Parameters NOT in MVP
- Saturation, softness, warmth, background, dithering (Phase 2+)
- Custom pattern-specific parameters (Phase 2+)
- Beat threshold/squash (Phase 2+)
- Microphone gain tuning (Phase 2+)

**Rationale:** Keep UI clutter minimal; focus on the 80/20 controls that drive 80% of performer needs.

---

## 2. Display/Feedback Requirements

### 2.1 Status Display (Always Visible)
- **Connection Status**: Large badge at top
  - Green "Connected" with device IP/name
  - Red "Disconnected" with reconnect button
  - Yellow "Connecting..." with spinner
  - Show last successful sync time (e.g., "Synced 2s ago")

- **Current Pattern Name**: Large text (36-48px font)
  - Shown in a panel below status
  - Updates in real-time from device

- **Parameter Values**: Small numeric/percentage readout
  - Brightness: "87%"
  - Speed: "0.65"
  - Color: Swatch or palette name

### 2.2 Real-Time Feedback
- **Slider feedback:**
  - Show live value as user drags (e.g., "78% brightness")
  - Debounce sends to device (300ms window, as per K1 firmware)
  - Micro-UI state: "Syncing…" → "Synced ✓" after round-trip

- **Pattern switch feedback:**
  - Confirm visually (name update + highlight) within 500ms
  - If no ack within 5s, show warning "Device not responding"

- **Error/Info Toasts:**
  - "Device disconnected, will retry…"
  - "Pattern change failed, retrying…"
  - "Connection restored!"

### 2.3 Visual Elements NOT in MVP
- Audio waveform visualization (Phase 2+)
- LED strip preview/simulation (Phase 2+)
- Profiling charts/graphs (Phase 2+)
- Custom animation editor (Phase 2+)

---

## 3. Minimal UI Layout (MVP Interface)

### 3.1 Single-Screen Design
Tab5 controller is **one fullscreen view** with:
1. **Top Bar** (60px)
   - Connection status badge (left-aligned)
   - Device name/IP (center)
   - Settings icon (right, opens modal)

2. **Main Content** (fill remaining space)
   - **Current Pattern Display** (80px)
     - Large pattern name (36px font, bold)
     - Pattern family icon (optional)

   - **Favorites/Quick Access** (100px)
     - Row of 3–5 pattern buttons (square, 70px side)
     - Tap to switch; highlight active pattern
     - Long-press to edit favorites (Phase 2)

   - **Parameter Controls** (300px, vertically stacked)
     - **Brightness**: Horizontal slider (width 100%, 50px tall)
     - **Speed**: Horizontal slider (width 100%, 50px tall)
     - **Color/Palette**: Horizontal carousel (swipe to scroll, 80px tall)

   - **Pattern List** (fill remaining)
     - Vertical scroll list of all patterns
     - Current pattern highlighted
     - Tap to switch

3. **Bottom Sheet** (modal, on-demand)
   - Settings: Device IP, Reconnect, Battery status
   - Pattern search/filter
   - Favorites editor (Phase 2)

### 3.2 ASCII Mockup

```
┌─────────────────────────────────────────────────┐
│ ◉ Connected (192.168.1.42)        ⚙️  │  ⋮      │  <- Top bar (status + menu)
├─────────────────────────────────────────────────┤
│                                                 │
│              WAVELENGTH                        │  <- Current pattern (36px)
│                                                 │
├─────────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │  <- Quick access (5 favorites)
│  │Void  │ │Ether │ │Pulse │ │Drift │ │Glow  │ │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ │
├─────────────────────────────────────────────────┤
│                                                 │
│ Brightness:   ██████████░░░░░░  87%            │  <- Large slider
│                                                 │
│ Speed:        ███████░░░░░░░░░░  0.55           │  <- Large slider
│                                                 │
│ Color:                                          │  <- Palette carousel
│   ◉ Twilight  ○ Lava  ○ Vibe  ○ Neon           │
│   [◄]                                     [►]   │
│                                                 │
├─────────────────────────────────────────────────┤
│  All Patterns (swipe to see more)               │
│  ▓ Wavelength       (currently active)          │
│    Ether                                         │
│    Pulse                                         │
│    Drift                                         │
│    Glow                                          │
│    Void                                          │
│    [scroll...]                                  │
│                                                 │
│  🔋 100%  |  Synced 1s ago                      │  <- Footer status
└─────────────────────────────────────────────────┘
```

### 3.3 Interaction Flow

```
User Action                 -> K1 API Call                -> Feedback
─────────────────────────────────────────────────────────────────────
Tap pattern in list         -> POST /api/params           -> Pattern name updates
                               (pattern_id=5)                (Synced ✓)

Drag brightness slider      -> (debounced 300ms)           -> "Syncing…" → % updates
                               POST /api/params             -> Visual bar feedback
                               (brightness=0.87)

Swipe color carousel        -> POST /api/params           -> Palette highlight updates
                               (palette_id=2)             -> "Synced ✓"

Long-press pattern          -> (Phase 2) Edit favorites   -> Modal shows
                               (save to local storage)

Device disconnects          -> Retry loop (exponential)    -> "Disconnected" badge
(network loss)              -> Queue pending updates        -> Yellow warning state

Reconnects                  -> GET /api/params (sync)      -> Values refresh, "Connected"
                               Resume queued updates        -> Green success toast
```

---

## 4. Nice-to-Have Features (Phase 2+)

### 4.1 Gesture Controls
- Swipe left/right to cycle patterns (quick navigation)
- Long-press on pattern to add to favorites
- Double-tap on parameter to reset to default

### 4.2 Preset Management
- Save/load parameter sets (brightness + speed + color combo) to local device
- Named presets ("Chill", "Energetic", "Ambient")
- Cloud sync (Phase 3+)

### 4.3 Color Visualization
- Animated color picker using device's current LED output (fake RGB preview)
- HSV sliders if pattern is palette-free

### 4.4 Multi-Touch Gestures
- Pinch zoom on pattern list (Phase 2+)
- Two-finger swipe for undo/redo (Phase 2+)

### 4.5 Voice Feedback
- "Pattern changed to Wavelength"
- Battery alerts ("Battery low: 10%")

### 4.6 Scheduling/Automation
- Timed pattern sequences (Phase 3+)
- Cue management for live shows (Phase 3+)

---

## 5. Development Scope Estimate

### 5.1 MVP Code Breakdown

| Component | Est. LOC | Notes |
|-----------|----------|-------|
| **Android Activity/Fragment Setup** | 150 | Single activity, minimal navigation |
| **Network Client** | 200 | HTTP POST/GET, debounce, retry logic |
| **UI Layout (XML)** | 300 | RecyclerView for pattern list, sliders |
| **Fragment/ViewModel** | 400 | State management, parameter binding |
| **Connection Manager** | 250 | Auto-reconnect, heartbeat, queueing |
| **Settings Modal** | 150 | IP input, debug info, battery status |
| **Tests (unit + integration)** | 300 | Network mocking, parameter updates, edge cases |
| **Miscellaneous (drawables, styles, resources)** | 200 | Icons, colors, themes |
| **TOTAL MVP** | **~2000 LOC** | Manageable scope for 1-2 engineers |

### 5.2 Estimated Timeline (to First Working Prototype)

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **Week 1: Setup + Core Network** | 5 days | Android project scaffold, HTTP client, device discovery |
| **Week 2: UI Layout + Binding** | 5 days | Sliders, pattern list, favorites, layout |
| **Week 3: State Management + Sync** | 5 days | Connection manager, auto-reconnect, debounce, queuing |
| **Week 4: Polish + Testing** | 5 days | Toasts, error handling, unit tests, E2E on real device |
| **TOTAL to MVP** | **4 weeks** | (or 2 weeks with 2 engineers working in parallel) |

### 5.3 Testing Scenarios

#### Happy Path
1. Launch app → Auto-discover K1 on network (mDNS or IP input)
2. Tap favorite pattern → Syncs within 500ms
3. Drag brightness slider → Updates in real-time, debounces, syncs
4. Swipe color carousel → Palette changes instantly
5. Close app, reopen → Remembers last device, auto-reconnects

#### Network Failures
1. Disconnect WiFi → "Disconnected" badge within 2s
2. Queue 5 slider updates while disconnected → On reconnect, send only latest (not all 5)
3. Device reboots (K1 webserver restarts) → Tab5 detects timeout, retries with exponential backoff
4. Poor signal (high latency, low bandwidth) → Slider drags smoothly; debounce prevents overwhelming server

#### Edge Cases
1. User swaps patterns while adjusting brightness → Both commands queue and execute in order
2. Favorites list modified while pattern is switching → Favorites update doesn't interfere
3. Rapid tap-tap-tap on different patterns → Only last pattern applies (no queue buildup)
4. Device IP changes (DHCP lease renewal) → App re-discovers via mDNS or user enters new IP

---

## 6. Dependency on K1 API Stability

### 6.1 Required K1 Firmware APIs

**Stable/Required Endpoints:**
- `GET /api/params` → Returns current parameter state (brightness, speed, palette_id, pattern_id, etc.)
- `POST /api/params` → Accepts JSON with parameter updates
- `GET /api/patterns` → Returns list of available patterns (ID, name, family)
- `GET /api/palettes` → Returns list of available palettes (ID, name, RGB swatches)
- `GET /api/device/info` → Returns device name, firmware version, IP, MAC
- `GET /api/test-connection` → Quick ping to verify connectivity

**Rate Limiting Behavior (from firmware):**
- `POST /api/params` is rate-limited to ~1 request per 300ms (debounce window)
- Exceeding limit returns `HTTP 429 Too Many Requests`
- Tab5 must respect this and implement client-side debounce

**Assumptions:**
- Endpoints return JSON; response time < 100ms on local WiFi
- Parameters are atomic (no partial updates mid-sync)
- Pattern list is static (doesn't change mid-performance)

### 6.2 Risk Mitigation

If K1 API changes mid-development:
1. Tab5 client version-pins the API (e.g., `/api/v1/params`)
2. Firmware maintains backward compatibility (required)
3. If breaking change needed, coordinate with Tab5 development
4. Add versioning header to all requests (safety measure)

---

## 7. Research Prototype Success Criteria

### 7.1 Acceptance Gates (All Must Pass)

#### Gate 1: Wireless Pattern Switching
- [ ] Change pattern from Tab5 → K1 executes within 200ms
- [ ] Pattern name updates on Tab5 display
- [ ] Favorite patterns accessible with single tap
- [ ] Pattern list scrolls smoothly (no lag)

#### Gate 2: Parameter Adjustment
- [ ] Brightness slider adjusts and syncs within 100ms round-trip
- [ ] Speed slider adjusts and syncs within 100ms round-trip
- [ ] Color/palette carousel updates instantaneously
- [ ] Slider feedback shows live value during drag

#### Gate 3: Connection & Status
- [ ] Connection badge shows correct status (green/red/yellow)
- [ ] Auto-reconnect works after WiFi dropout
- [ ] "Synced Xs ago" timestamp updates correctly
- [ ] Error toasts appear for failures

#### Gate 4: Battery & Performance
- [ ] Tab5 battery lasts 2+ hours under typical use (30 min active, 90 min idle)
- [ ] Network traffic is minimal (< 50 KB per hour idle, < 500 KB per hour active)
- [ ] No memory leaks over 2-hour session (heap stable)
- [ ] CPU usage stays low while idle (< 5% average)

#### Gate 5: Edge Case Resilience
- [ ] Survives network disconnection without crashing
- [ ] Handles K1 webserver reboot gracefully
- [ ] Rapid parameter changes don't cause UI freeze
- [ ] No data corruption if device powers off mid-sync

### 7.2 Performance Targets

| Metric | Target | Reasoning |
|--------|--------|-----------|
| Pattern change latency | < 200ms | User perception: "instant" on stage |
| Parameter sync latency | < 100ms | Slider feedback must feel responsive |
| Connection re-establish | < 5s | User sees reconnection within reasonable time |
| UI frame rate | 60 FPS | Smooth slider drags, scrolling |
| Battery endurance | 2+ hours | Enough for a typical 90-min set + soundcheck |
| Network overhead | < 500 KB/hr active | WiFi radio stays efficient |

---

## 8. Implementation Roadmap

### Phase 1: MVP (4 weeks)
**Goal:** Functional research prototype
- Android app with pattern switching + 3 parameter sliders
- Auto-discovery and manual IP input
- Connection manager with auto-reconnect
- Local favorites (3-5 patterns pinned)
- Basic error handling and toasts

**Deliverable:** `.apk` file, runnable on Tab5 (Android 10+), connects to K1 on local WiFi

---

### Phase 2: Polish & Usability (2 weeks, optional)
**Goal:** Production-ready prototype
- Gesture shortcuts (swipe left/right for patterns)
- Preset saving (local storage)
- Improved UI animations and feedback
- Battery indicator integration
- Unit tests (90%+ coverage)

**Deliverable:** Polished app with gesture controls and presets

---

### Phase 3: Advanced Features (2-4 weeks, future)
**Goal:** Live show features
- Cue management and scheduling
- Cloud preset sync
- Voice feedback
- Multi-device control (multiple Tab5s on same K1)
- OTA app updates

**Deliverable:** App store release candidate

---

## 9. Key Decisions & Trade-offs

### Decision 1: Standalone Android App (Not Web App)
**Rationale:**
- Native Android touch/gesture handling is superior to web
- Longer battery life (native code, no browser overhead)
- Works offline (can pre-cache pattern list)
- No need to run webapp on Tab5; K1 only serves API

**Trade-off:** Android development required (can't reuse React code from webapp directly)

### Decision 2: Single Screen (No Tab Navigation)
**Rationale:**
- Minimize cognitive load during live performance
- Fast muscle memory (always know where controls are)
- Easy to use one-handed on stage

**Trade-off:** Less content visible; search/filter must be in bottom sheet modal

### Decision 3: Local Favorites (Not Cloud Sync in MVP)
**Rationale:**
- Reduces external dependency (no cloud backend needed)
- Works offline
- User controls exactly what's pinned
- Faster to implement

**Trade-off:** Presets don't sync across multiple devices (Phase 3 feature)

### Decision 4: Debounce on Client (300ms Window)
**Rationale:**
- Prevents overwhelming K1's rate limiter
- User expects parameter changes to batch (holding slider down)
- Aligns with firmware's existing rate limit

**Trade-off:** Slight latency between user action and visual feedback (acceptable for research)

---

## 10. API Reference (For Developers)

### GET /api/params
**Response:**
```json
{
  "pattern_id": 3,
  "palette_id": 1,
  "brightness": 0.87,
  "softness": 0.25,
  "speed": 0.55,
  "color": 0.33,
  "saturation": 0.75,
  "warmth": 0.0,
  "background": 0.0,
  "dithering": 1.0,
  "audio": { "active": true, "gain": 1.0 },
  "custom_param_1": 0.5,
  "custom_param_2": 0.5,
  "custom_param_3": 0.5
}
```

### POST /api/params
**Request:**
```json
{
  "pattern_id": 5,
  "brightness": 0.75,
  "speed": 0.6,
  "palette_id": 2
}
```
**Response:** `{ "status": "ok" }` or `HTTP 429` (rate limited)

### GET /api/patterns
**Response:**
```json
[
  { "id": 0, "name": "Void Trail", "family": "ambient" },
  { "id": 1, "name": "Ether", "family": "ambient" },
  { "id": 2, "name": "Wavelength", "family": "reactive" },
  ...
]
```

### GET /api/palettes
**Response:**
```json
[
  { "id": 0, "name": "Twilight", "colors": ["#1a1a3e", "#3d5a7f", "#8b8b9b"] },
  { "id": 1, "name": "Lava", "colors": ["#ff0000", "#ff6600", "#ffaa00"] },
  ...
]
```

---

## 11. File Structure (Proposed Android Project)

```
tab5-controller/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── java/com/k1/controller/
│   │   │   │   ├── MainActivity.kt
│   │   │   │   ├── ControllerFragment.kt
│   │   │   │   ├── SettingsBottomSheet.kt
│   │   │   │   ├── network/
│   │   │   │   │   ├── K1ApiClient.kt
│   │   │   │   │   ├── NetworkManager.kt
│   │   │   │   │   └── RetryPolicy.kt
│   │   │   │   ├── viewmodel/
│   │   │   │   │   ├── ControllerViewModel.kt
│   │   │   │   │   └── DeviceState.kt
│   │   │   │   ├── ui/
│   │   │   │   │   ├── ParameterSlider.kt
│   │   │   │   │   ├── PatternList.kt
│   │   │   │   │   ├── PaletteCarousel.kt
│   │   │   │   │   └── ConnectionStatus.kt
│   │   │   │   └── util/
│   │   │   │       ├── Debouncer.kt
│   │   │   │       └── Preferences.kt
│   │   │   ├── res/
│   │   │   │   ├── layout/
│   │   │   │   │   ├── activity_main.xml
│   │   │   │   │   ├── fragment_controller.xml
│   │   │   │   │   └── widget_parameter_slider.xml
│   │   │   │   ├── values/
│   │   │   │   │   ├── strings.xml
│   │   │   │   │   ├── colors.xml
│   │   │   │   │   └── dimens.xml
│   │   │   │   └── drawable/
│   │   │   │       └── [icons, shapes]
│   │   ├── test/
│   │   │   └── kotlin/com/k1/controller/
│   │   │       ├── NetworkClientTest.kt
│   │   │       ├── ViewModelTest.kt
│   │   │       └── RetryPolicyTest.kt
│   │   └── androidTest/
│   │       └── kotlin/com/k1/controller/
│   │           ├── ControllerFragmentTest.kt
│   │           └── EndToEndTest.kt
│   ├── build.gradle.kts
│   └── proguard-rules.pro
├── build.gradle.kts
├── settings.gradle.kts
├── README.md
└── docs/
    ├── DEVELOPMENT.md
    ├── TESTING.md
    └── DEPLOYMENT.md
```

---

## 12. Risk Register

| Risk | Severity | Mitigation |
|------|----------|-----------|
| WiFi latency > 500ms | High | Test on multiple networks; document min WiFi requirement (802.11ac, -70dBm SNR) |
| K1 API changes mid-dev | Medium | Coordinate releases; version API endpoints |
| Battery drains faster than 2h | Medium | Profile early (week 1); optimize network polling |
| Pattern list is very large (100+) | Low | Implement search/filter in Phase 2; virtualize RecyclerView |
| Touch screen responsiveness issues | Medium | Test on actual Tab5 early; use native gesture handling |
| Crash on network dropout | Medium | Robust exception handling; CI/CD integration tests |

---

## 13. Success Metrics (Post-MVP)

After prototype deployed to research team:
1. **Adoption**: Performer uses Tab5 for 50%+ of parameter changes (vs. manual K1 control)
2. **Latency**: Average pattern-change latency < 150ms (measured via logging)
3. **Reliability**: 99.5% uptime over 2-hour session (zero crashes/disconnects)
4. **Battery**: Lasts 2+ hours under active use
5. **Feedback**: Qualitative feedback from performers (interviews) informs Phase 2 priorities

---

## 14. Related Documentation

- K1 Firmware API: `/firmware/src/webserver.cpp`
- K1 Parameters: `/firmware/src/parameters.h`
- K1 Webapp Architecture: `/webapp/src/App.tsx`
- Network Protocols: `/docs/06-reference/networking.md` (TBD)

---

## 15. Questions & Open Items

- [ ] Target Android version: API 28+ (Android 9) or API 30+ (Android 11)?
  - **Decision pending:** Device capability check with lab team
- [ ] Tablet orientation: Portrait only or support landscape?
  - **Proposal:** Portrait first, landscape in Phase 2
- [ ] Cloud sync for presets: Required in MVP or Phase 2?
  - **Decision:** Phase 2 (local storage only for MVP)
- [ ] Multiple Tab5 devices on same K1: In scope?
  - **Decision:** Phase 3 (coordinate with K1 firmware)

---

## Sign-off

**Prepared by:** Claude (Research Assistant)
**Review status:** Awaiting stakeholder sign-off
**Next steps:**
1. Validate scope with performer/UX team
2. Confirm Android target version and device model
3. Kick off Week 1 (setup + network client)

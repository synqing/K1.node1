# M5Stack Tab5 K1 Controller: Architecture Guide

**Status:** proposed
**Owner:** Claude Code Agent
**Date:** 2025-11-05
**Scope:** Architecture patterns, design decisions, and implementation roadmap for Tab5 wireless controller
**Related:** m5stack-tab5-controller-research.md, m5tab5-controller-code-templates.md
**Tags:** architecture, planning, design-patterns, embedded-systems

---

## 1. System Architecture Overview

### 1.1 High-Level Block Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                    M5Stack Tab5 Controller                      │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              5" IPS LCD Display (1280×720)              │  │
│  │  Driven by: M5GFX (status bar) + LVGL (main UI)        │  │
│  │  Touch: GT911 capacitive controller                     │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────┬──────────────────┬──────────────────┐   │
│  │   Core 0: App     │  Core 1: LVGL    │  Core 2: WiFi    │   │
│  │  Main loop        │  UI task (5ms)   │  (hardware)      │   │
│  │  Business logic   │  Display driver  │  Async HTTP      │   │
│  │  Touch handler    │  Input device    │  mDNS discovery  │   │
│  │  Request queueing │                  │                  │   │
│  └───────────────────┴──────────────────┴──────────────────┘   │
│         │                    │                    │             │
│         └────────────────────┼────────────────────┘             │
│                              │                                  │
│               Shared Memory & Queues (Thread-Safe)              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    K1 Device (Network)                   │  │
│  │         HTTP API on http://k1.local:8080                │  │
│  │      (mDNS hostname resolution via ESP32-C6 WiFi)       │  │
│  └─────────────────────────────────────────────────────────┘  │
│         AsyncHTTPRequest ← → K1 REST API                       │
│         (50-100ms latency, non-blocking)                       │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

Key Characteristics:
- Dual-core ESP32-P4 (main): 8 MB Flash, 32 MB PSRAM
- WiFi 6 capable (ESP32-C6-MINI-1U module)
- Non-blocking network I/O via AsyncHTTPRequest callbacks
- LVGL UI on dedicated core 1 for smooth animations
- mDNS hostname resolution (no hardcoded IPs)
```

### 1.2 Data Flow Architecture

```
Touch Input (GT911)
    ↓
    M5.update() → lv_indev callback
    ↓
LVGL Event Handler (on core 1)
    ↓
    Command Queued to Core 0
    ↓
    handleTouchEvent()
    ↓
AsyncHTTPRequest → K1 API (non-blocking)
    ↓
    Main loop continues (UI responsive)
    ↓
HTTP Response Callback
    ↓
    Parse JSON (ArduinoJson)
    ↓
    Queue UI update via LVGL callback
    ↓
    LVGL task updates display (core 1)
    ↓
    Display renders next frame
```

---

## 2. Recommended Architectural Patterns

### 2.1 Event-Driven Pattern (Critical for Responsiveness)

**Why:** Tab5 controller must remain responsive to touch while communicating with K1.

```cpp
// Architecture: Event-driven with async I/O

class EventDispatcher {
    enum EventType {
        TOUCH_PRESSED,
        PATTERN_CHANGED,
        BRIGHTNESS_ADJUSTED,
        K1_STATUS_UPDATED,
        NETWORK_CONNECTED,
        NETWORK_DISCONNECTED
    };

    // Minimal callback - queue work, return immediately
    void dispatchEvent(EventType type, const void *data) {
        // All callbacks must be non-blocking (<1ms)
        // Actual work done in main loop

        switch (type) {
            case TOUCH_PRESSED:
                handleTouchAsync();
                break;
            case K1_STATUS_UPDATED:
                updateUIFromK1(static_cast<const JsonDocument *>(data));
                break;
            // ...
        }
    }
};

// Main loop processes events
void loop() {
    while (hasQueuedEvent()) {
        Event e = getQueuedEvent();
        dispatcher.dispatchEvent(e.type, e.data);
    }
}
```

**Benefits:**
- Touch remains responsive (processed immediately)
- HTTP I/O non-blocking (callback-driven)
- Scales to multiple concurrent requests
- Easy to debug (event trace)

### 2.2 State Machine for WiFi Connectivity

**Why:** WiFi drops are common; state machine prevents flaky reconnect behavior.

```
┌─────────────┐
│ DISCONNECTED│ ← Power up / Lost connection
└──────┬──────┘
       │
       ├─→ [WiFi.begin()]
       ↓
┌─────────────┐
│ CONNECTING  │ → Max 10s timeout
└──────┬──────┘
       │
       ├─→ [Got IP] → MDNS.begin()
       ↓
┌─────────────┐
│ CONNECTED   │ ← Ready for HTTP requests
└──────┬──────┘
       │
       ├─→ [Disconnect event]
       ↓
┌──────────────────┐
│ RECONNECT_WAIT   │ → Exponential backoff (5-60s)
└──────┬───────────┘
       │
       ├─→ [Timeout] → WiFi.reconnect()
       ↓
    (back to CONNECTING)
```

### 2.3 Async HTTP Request Pattern

**Why:** Prevents UI freeze during network requests.

```cpp
// Non-blocking request queue
class RequestQueue {
    struct Request {
        String url;
        String method;
        String body;
        std::function<void(const String &)> callback;
    };

    Queue<Request> queue;

    void sendNextRequest() {
        if (queue.empty() || WiFi.status() != WL_CONNECTED) return;

        Request req = queue.dequeue();
        AsyncHTTPRequest httpReq;

        httpReq.onReadyStatechange([this](void *opt, AsyncHTTPRequest *http,
                                         int state) {
            if (state == 4) {
                if (http->responseHTTPcode() == 200) {
                    // Invoke callback with response
                    sendNextRequest();  // Process next queued request
                }
            }
        });

        httpReq.open(req.method.c_str(), req.url.c_str());
        if (!req.body.isEmpty()) {
            httpReq.addHeader("Content-Type", "application/json");
            httpReq.send(req.body);
        } else {
            httpReq.send();
        }
    }
};

// Usage: Queue requests, they process in background
void handleUserInput(TouchEvent touch) {
    // Send request without blocking
    requestQueue.enqueue({
        "http://k1.local:8080/api/pattern/next",
        "POST",
        "",
        [this](const String &response) {
            // Update UI when response arrives
        }
    });
}
```

### 2.4 LVGL + M5GFX Hybrid UI

**Why:** M5GFX for performance-critical simple UI (status bar), LVGL for complex interactive UI.

```cpp
// Separation of concerns
class StatusBar {
    // M5GFX: Fast, simple, no dependencies
    void render() {
        m5gfx.setTextColor(WHITE);
        m5gfx.drawString("WiFi: Connected", 10, 10);
        m5gfx.drawString("K1: Pattern[0]", 200, 10);
    }
};

class MainControlPanel {
    // LVGL: Feature-rich widgets
    void init() {
        lv_obj_t *btn = lv_btn_create(lv_scr_act());
        lv_obj_add_event_cb(btn, [](lv_event_t *e) {
            // Handle button press
        }, LV_EVENT_CLICKED, NULL);
    }
};
```

---

## 3. Decision Tree: Which Pattern to Use

### 3.1 For HTTP Communication

```
Is request latency critical (<100ms)?
├─ YES → Use AsyncHTTPRequest (non-blocking callbacks)
│   └─ Single request or multiple concurrent?
│       ├─ Single → Direct AsyncHTTPRequest
│       └─ Multiple → RequestQueue pattern (queue + process serially)
└─ NO → Use HTTPClient (simpler, blocks OK if infrequent)
        └─ Only if UI doesn't freeze during request
```

### 3.2 For UI Framework

```
Is UI simple (status display + 2-3 buttons)?
├─ YES → Use M5GFX only
│   └─ Faster, lower memory, sufficient
└─ NO → Use LVGL + SquareLine Studio
    └─ Rich widgets, animations, professional look
        └─ Configure dual-core (LVGL on core 1)
```

### 3.3 For JSON Parsing

```
Is document size > 256 bytes?
├─ YES → Use ArduinoJson with streaming parse
│   └─ Streaming: Only allocate needed fields
└─ NO → Use StaticJsonDocument (fixed size)
    └─ ArduinoJson v7 is standard
```

### 3.4 For Network Discovery

```
Do you know K1's IP address?
├─ YES → Use hardcoded IP
│   └─ Faster, no mDNS overhead
└─ NO → Use mDNS hostname resolution
    └─ "k1.local" requires:
        ├─ MDNS.begin() on controller
        ├─ K1 device advertising mDNS
        └─ Both on same WiFi network
```

---

## 4. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goals:** Basic WiFi, HTTP, display working

```
├─ [x] Setup PlatformIO project structure
├─ [x] Configure Tab5 board + library dependencies
├─ [x] Implement WiFiController with auto-reconnect
├─ [x] Implement K1Client with AsyncHTTPRequest
├─ [ ] Display WiFi status on M5GFX (status bar)
├─ [ ] Create simple button UI to send test commands to K1
├─ [ ] Test HTTP latency to K1 device
└─ [ ] Document API contract with K1
```

**Deliverables:**
- Basic project template in `/firmware/`
- WiFi auto-connect with event handling
- Proof-of-concept HTTP GET/POST to K1
- Latency measurements

### Phase 2: UI Development (Week 3-4)

**Goals:** Professional UI using LVGL + SquareLine

```
├─ [ ] Design UI mockup in SquareLine Studio
│   ├─ Status bar (pattern, brightness, WiFi)
│   ├─ Pattern selector (grid of options)
│   ├─ Brightness slider
│   └─ Advanced settings panel
├─ [ ] Export UI code from SquareLine
├─ [ ] Integrate LVGL with M5Stack display driver
├─ [ ] Implement touch event handlers
├─ [ ] Test UI responsiveness with dual-core setup
├─ [ ] Add animations (fade, slide) for feedback
└─ [ ] Profile FPS and memory usage
```

**Deliverables:**
- SquareLine Studio project file
- Generated UI C code
- Dual-core LVGL task implementation
- UI performance metrics (FPS, heap)

### Phase 3: Integration & Polish (Week 5)

**Goals:** Complete controller with all K1 APIs

```
├─ [ ] Implement all K1 API endpoints
│   ├─ GET /api/status (pattern, brightness, etc.)
│   ├─ POST /api/pattern (change pattern)
│   ├─ POST /api/brightness (adjust brightness)
│   ├─ POST /api/config (WiFi, update settings)
│   └─ GET /api/patterns (list available patterns)
├─ [ ] Add WiFi provisioning (AP mode for first-time setup)
├─ [ ] Implement OTA updates (critical: all builds)
├─ [ ] Add performance monitoring overlay (debug)
├─ [ ] Test with real K1 device
├─ [ ] Write integration tests
└─ [ ] Document user manual
```

**Deliverables:**
- Complete controller application
- WiFi provisioning UI
- OTA update capability
- Test report with latency/FPS/memory

### Phase 4: Hardening & Deployment (Week 6)

**Goals:** Production-ready firmware

```
├─ [ ] Security audit (no hardcoded passwords)
├─ [ ] Error handling & recovery
├─ [ ] Stress testing (sustained ~1 hour)
├─ [ ] Battery performance profile (if battery-powered)
├─ [ ] Documentation (API, deployment, troubleshooting)
├─ [ ] Code review & cleanup
├─ [ ] Release firmware binary
└─ [ ] Deploy to test devices
```

**Deliverables:**
- v1.0 firmware release
- Deployment guide
- Troubleshooting documentation
- GitHub releases with binaries

---

## 5. Risk Assessment & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| WiFi drops frequently | Medium | High | Event-based reconnect + mDNS |
| LVGL FPS too low | Medium | Medium | Profile; optimize buffer; reduce refresh |
| HTTP latency > 200ms | Low | Medium | Connection reuse; local K1 device |
| Memory exhaustion | Medium | High | Use StaticJsonDocument; PSRAM buffer |
| Touch unresponsive | Medium | High | LVGL on core 1; fast input processing |
| OTA breaks firmware | Low | Critical | Always include ArduinoOTA; factory partition |
| mDNS not working | Low | Medium | Fallback to hardcoded IP |

**Contingency Plans:**
1. **If WiFi unstable:** Implement exponential backoff, monitor signal strength
2. **If FPS too low:** Reduce animation complexity, use DMA-based rendering
3. **If memory tight:** Profile with PerformanceMonitor; use external PSRAM
4. **If latency high:** Check network congestion; use WiFi 6 (C6 module)
5. **If OTA fails:** Factory partition + serial recovery procedure

---

## 6. Testing Strategy

### 6.1 Unit Tests

```cpp
// Test ArduinoJson parsing
TEST(JSONParsing, parseK1Status) {
    const char *json = R"({"pattern":"fire","brightness":0.8})";
    StaticJsonDocument<128> doc;
    ASSERT_EQ(deserializeJson(doc, json), DeserializationError::Ok);
    ASSERT_STREQ(doc["pattern"], "fire");
    ASSERT_FLOAT_EQ(doc["brightness"], 0.8);
}

// Test WiFi state machine
TEST(WiFiState, reconnectAfterDisconnect) {
    WiFiController ctrl("SSID", "PASS");
    ASSERT_FALSE(ctrl.isConnected());
    // Simulate disconnect → should trigger reconnect
    // (requires real hardware or mock WiFi layer)
}
```

### 6.2 Integration Tests (Real Hardware)

```
1. WiFi Auto-Connect
   ├─ Power on → Should connect to saved SSID within 30s
   ├─ Disconnect WiFi → Should detect within 5s
   └─ Reconnect WiFi → Should re-establish within 30s

2. HTTP Request Latency
   ├─ Measure GET /api/status → Should be 50-100ms
   ├─ Measure POST /api/pattern → Should be 60-120ms
   └─ Concurrent requests → Should not exceed 200ms

3. Display & Touch
   ├─ Tap button → Should respond within 50ms
   ├─ Scroll list → Should maintain 20+ FPS
   ├─ Animations → Should be smooth (no jank)
   └─ UI updates from HTTP → Should not freeze display

4. Memory & Performance
   ├─ Steady-state heap usage → Should not exceed 150 KB
   ├─ Peak heap (LVGL rendering) → Should not exceed 200 KB
   ├─ Long-run stability → 1-hour test without crashes
   └─ OTA update → Should work from any state

5. Provisioning
   ├─ First boot → Should start AP mode
   ├─ Connect via web form → Should save & reconnect
   └─ Forget credentials → Should return to AP mode
```

### 6.3 Performance Benchmarks

**Baseline to achieve:**
- WiFi latency: 50-100 ms
- Display FPS: 20-30 (LVGL + animations)
- Memory: 120-160 KB RAM used
- Startup time: <10 seconds
- WiFi reconnect: <5 seconds (after disconnect)

---

## 7. Development Environment Setup

### 7.1 Recommended Tools

```
IDE: VSCode + PlatformIO extension
├─ Fast builds, integrated debugging
├─ Serial monitor with exception decoder
└─ OTA upload capability

UI Designer: SquareLine Studio
├─ Drag-and-drop LVGL UI design
├─ Generate C code
└─ Export for PlatformIO

Version Control: Git + GitHub
├─ Track firmware changes
├─ Release binaries (GitHub releases)
└─ Collaboration (if team)

Documentation: Markdown in /docs
├─ Architecture decisions (ADRs)
├─ API specifications
├─ Deployment runbooks
└─ Troubleshooting guides
```

### 7.2 Git Workflow

```
main branch (stable releases)
    ↓
develop branch (integration)
    ↓
feature branches (feature/wifi-provisioning, feature/lvgl-ui)
    ↓
hotfix branches (hotfix/oio-crash)

Commit message format:
  [WiFi] Add auto-reconnect with exponential backoff
  [UI] Fix LVGL touch event on button press
  [HTTP] Implement connection pooling for K1 API
  [Docs] Add architecture guide
```

---

## 8. Deployment Checklist

- [ ] All code compiles without warnings
- [ ] All tests pass (unit + integration)
- [ ] Performance targets met (FPS, latency, memory)
- [ ] WiFi auto-reconnect tested
- [ ] OTA update tested
- [ ] mDNS hostname resolution tested
- [ ] UI responsive under load
- [ ] Credentials provisioning works
- [ ] Documentation complete
- [ ] GitHub release created with binary
- [ ] v1.0 tag in git

---

## 9. Architecture Decision Records (ADRs)

### ADR-0001: Use AsyncHTTPRequest for K1 Communication

**Status:** Accepted

**Context:** Need non-blocking HTTP communication to avoid freezing UI while querying K1 device.

**Decision:** Use AsyncHTTPRequest_Generic library with callback pattern.

**Alternatives Considered:**
- HTTPClient: Simple but blocks main loop (UI unresponsive during requests)
- ESP-IDF esp_http_client: More control but steeper learning curve
- WebSocket: Lower latency but more complex setup

**Consequences:**
- Async callback pattern requires careful state management
- Multiple concurrent requests possible (benefit)
- Memory overhead ~3-8 KB per active request (acceptable)

---

### ADR-0002: Dual-Core Architecture (LVGL on Core 1)

**Status:** Accepted

**Context:** LVGL requires regular `lv_timer_handler()` calls (~5ms interval) for smooth rendering. Main loop handles WiFi, which can block.

**Decision:** Dedicated FreeRTOS task runs `lv_timer_handler()` on core 1, main loop on core 0.

**Alternatives Considered:**
- Single-core: All tasks on core 0 (simpler but UI can stutter)
- LVGL on core 0: WiFi on core 1 (less common pattern)

**Consequences:**
- Smooth 20-30 FPS LVGL animations (benefit)
- Thread-safety required for shared data (drawback)
- Core 0 free for WiFi, HTTP, business logic (benefit)

---

### ADR-0003: mDNS Hostname Resolution for K1 Discovery

**Status:** Accepted

**Context:** K1 device IP address unknown at boot time (DHCP). Hardcoding IP requires manual configuration.

**Decision:** Use mDNS for zero-configuration discovery. Access K1 via `k1.local` hostname.

**Prerequisites:**
- K1 firmware must advertise mDNS service (http._tcp)
- Controller and K1 on same WiFi network

**Consequences:**
- Zero manual configuration (benefit)
- mDNS lookup adds ~100-200ms first time (acceptable, cached)
- Requires both devices to support mDNS (standard)

---

## 10. Future Enhancements (Post-v1.0)

```
Potential roadmap items (not blocking v1.0):

├─ [ ] Video stream from K1 camera (MJPEG)
├─ [ ] Remote logging (upload K1 logs to Tab5 display)
├─ [ ] BLE fallback connectivity (if WiFi unavailable)
├─ [ ] Local pattern storage (offline mode)
├─ [ ] Web dashboard (access controller from phone)
├─ [ ] Voice control integration (Alexa/Google Home)
├─ [ ] Machine learning pattern suggestions
└─ [ ] Multi-device control (control multiple K1s from one Tab5)
```

---

## References

### Architecture & Patterns
- ESP32 FreeRTOS Dual Core: https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/freertos.html
- Event-Driven Embedded Systems: https://en.wikipedia.org/wiki/Event-driven_architecture

### Implementation Details
- M5Stack Tab5 Hardware: https://docs.m5stack.com/en/core/Tab5
- LVGL Documentation: https://docs.lvgl.io/
- AsyncHTTPRequest: https://github.com/khoih-prog/AsyncHTTPRequest_Generic

### Best Practices
- ESP32 Performance Optimization: https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/performance/speed.html
- Embedded Systems Testing: https://www.embeddedrelated.com/showarticle/1456.php


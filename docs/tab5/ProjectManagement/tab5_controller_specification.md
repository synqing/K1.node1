# Tab5 Wireless Controller - Technical Specification
## K1.node1 REST API Integration Requirements

**Status:** Specification (Ready for Development)
**Date:** 2025-11-05
**Audience:** Tab5 Development Team
**Reference:** docs/05-analysis/wireless_controller_api_reference.md

---

## 1. EXECUTIVE OVERVIEW

### 1.1 Purpose
Tab5 is a wireless controller for K1.node1 LED firmware, enabling:
- Real-time pattern and parameter control over WiFi
- Audio reactivity configuration and monitoring
- System performance telemetry and diagnostics
- Configuration backup/restore and WiFi management

### 1.2 Integration Point
Tab5 communicates exclusively via K1.node1's REST API (port 80) and WebSocket endpoint (`/ws`). No custom protocol required.

### 1.3 Scope & Scale
- **Minimum Endpoints:** 10 critical endpoints (pattern, params, health, audio)
- **Full Implementation:** 60+ endpoints available (includes diagnostics, profiling)
- **Users:** Single user per session; multi-user not required initially
- **Devices:** Support 1-N K1 devices on network (list, switch between)

---

## 2. MANDATORY FEATURES (Phase 1)

### 2.1 Pattern Selection & Discovery

**Requirement:** Tab5 must display list of available patterns and enable switching.

**Implementation Requirements:**
- On startup: `GET /api/patterns` once, cache locally
- Display pattern list in UI (index, name, description, audio-reactive status)
- Allow pattern selection by UI index → `POST /api/select` with `{"index": N}`
- Handle 200ms rate limit: Disable select button for 200ms after click
- Show current pattern indicator in UI

**API Contract:**
```json
// GET /api/patterns
{
  "patterns": [
    {
      "index": 0,
      "id": "solid_color",
      "name": "Solid Color",
      "description": "...",
      "is_audio_reactive": false
    }
  ],
  "current_pattern": 5
}

// POST /api/select request
{"index": 5}

// POST /api/select response
{
  "current_pattern": 5,
  "id": "aurora_v2",
  "name": "Aurora V2"
}
```

**Error Handling:**
- Rate limit (429): Display "Pattern locked for X ms" message
- Invalid index (404): Show toast error, keep previous selection
- Network error: Retry with exponential backoff

---

### 2.2 Parameter Control (Brightness, Speed, Color)

**Requirement:** Tab5 must expose core visual parameters as sliders/inputs.

**Implementation Requirements:**
- 3 mandatory sliders: brightness [0.0-1.0], speed [0.0-1.0], color [0.0-1.0]
- Optional sliders: saturation, softness, warmth, background, dithering
- Debounce slider input: 100ms between API calls
- On slider release: `POST /api/params` with {parameter: value}
- Display current values from `GET /api/params` on startup
- Reflect remote changes via WebSocket broadcast (if connected)

**API Contract:**
```json
// GET /api/params
{
  "brightness": 0.85,
  "softness": 0.25,
  "color": 0.5,
  "color_range": 0.0,
  "saturation": 0.75,
  "warmth": 0.0,
  "background": 0.25,
  "dithering": 1.0,
  "speed": 0.75,
  "palette_id": 0,
  "custom_param_1": 0.5,
  "custom_param_2": 0.5,
  "custom_param_3": 0.5,
  "beat_threshold": 0.2,
  "beat_squash_power": 0.5
}

// POST /api/params request (partial)
{"brightness": 0.85, "speed": 0.75}

// POST /api/params response
{
  "brightness": 0.85,
  "speed": 0.75,
  ... (all other parameters)
}
```

**Validation:**
- Client-side: Clamp inputs to [0.0, 1.0]
- Server-side: Automatic clamping (NaN/Inf rejection)
- Rate limit (300ms): Disable sliders briefly or show throttle message
- Response echoes actual applied values (indicates clamping)

---

### 2.3 Status Display & Health Monitoring

**Requirement:** Tab5 must show system health (FPS, CPU, memory, connection).

**Implementation Requirements:**
- Poll `GET /api/health` every 2-5 seconds
- Display: FPS, CPU%, Memory%, WiFi signal (RSSI), IP address
- Show device "Connected" / "Disconnected" status
- Update color coding: Green (healthy), Yellow (warning), Red (critical)
  - FPS <30: Yellow
  - CPU >80%: Yellow
  - Memory >90%: Red
  - RSSI <-80dBm: Yellow

**API Contract:**
```json
// GET /api/health
{
  "status": "ok",
  "uptime_ms": 3600000,
  "fps": 60,
  "cpu_percent": 45.2,
  "memory_free_kb": 256,
  "memory_total_kb": 320,
  "connected": true,
  "wifi": {
    "ssid": "K1-Network",
    "rssi": -55,
    "ip": "192.168.1.100"
  }
}
```

**Failure Modes:**
- Timeout (>5 seconds): Show "Device Unreachable" message
- Network error: Retry polling, show offline indicator
- Device rebooting: Show "Waiting for device..." message

---

### 2.4 Audio Reactivity Control

**Requirement:** If pattern is audio-reactive, Tab5 must enable audio configuration.

**Implementation Requirements:**
- Query `GET /api/pattern/current` to determine `is_audio_reactive`
- If true: Show audio section with controls
- If false: Hide audio section or show "Not available for this pattern"
- Audio controls:
  - Toggle: Enable/Disable audio reactivity (`active` flag)
  - Microphone Gain: Slider [0.5, 2.0] with 0.1 step
  - Beat Threshold: Slider [0.0, 1.0] (pattern parameter)
- Display real-time feedback: `GET /api/audio/snapshot` (VU level, beat confidence)

**API Contract:**
```json
// GET /api/pattern/current
{
  "index": 5,
  "id": "aurora_v2",
  "name": "Aurora V2",
  "is_audio_reactive": true
}

// GET /api/audio-config
{
  "microphone_gain": 1.5,
  "vu_floor_pct": 0.75,
  "active": true
}

// POST /api/audio-config request
{"microphone_gain": 1.5, "active": true}

// GET /api/audio/snapshot (for real-time VU display)
{
  "vu_level": 0.65,
  "vu_level_raw": 0.72,
  "tempo_confidence": 0.82,
  "is_valid": true
}
```

**Behavior:**
- Disabling audio: Immediately zeroes audio telemetry
- Changing gain: Takes effect on next audio frame (~20ms)
- Beat threshold: Pattern-specific, controlled via `/api/params`

---

## 3. HIGHLY RECOMMENDED FEATURES (Phase 2)

### 3.1 Real-Time Telemetry (WebSocket)

**Why WebSocket:**
- Push-based: ~250ms broadcast interval (faster than polling)
- Lower latency: Real-time parameter sync across tabs
- Bandwidth efficient: Single connection for all updates
- Better UX: Immediate feedback on parameter changes

**Implementation Requirements:**
- Connect to `ws://[device_ip]/ws` on startup
- Handle reconnection: Exponential backoff with 5 max attempts
- Parse incoming messages: Filter for `type: "realtime"`
- Update UI with:
  - `performance.fps`, `performance.cpu_percent`, `performance.memory_percent`
  - `parameters.*` (all current control parameters)
  - `current_pattern` (pattern index)
- Graceful degradation: If WebSocket fails, fall back to HTTP polling

**Message Format:**
```json
{
  "type": "realtime",
  "timestamp": 3600000250,
  "performance": {
    "fps": 60,
    "frame_time_us": 16667,
    "cpu_percent": 45.2,
    "memory_percent": 20.1,
    "memory_free_kb": 256
  },
  "parameters": {
    "brightness": 0.85,
    "speed": 0.75,
    ...
  },
  "current_pattern": 5
}
```

**JavaScript Template:**
```javascript
class RealtimeClient {
  constructor(deviceIP) {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.connect(deviceIP);
  }

  connect(deviceIP) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${deviceIP}/ws`);
    this.ws.onmessage = (e) => this.handleMessage(JSON.parse(e.data));
    this.ws.onclose = () => this.reconnect(deviceIP);
  }

  handleMessage(data) {
    if (data.type === 'realtime') {
      // Update UI
      document.getElementById('fps').textContent = data.performance.fps;
      // Sync parameter sliders without firing change events
      // Sync current_pattern indicator
    }
  }

  reconnect(deviceIP) {
    if (++this.reconnectAttempts <= 5) {
      setTimeout(() => this.connect(deviceIP), 1000 * this.reconnectAttempts);
    }
  }
}
```

---

### 3.2 Palette Selection

**Requirement:** Allow users to select from available color palettes.

**Implementation Requirements:**
- On startup: `GET /api/palettes` once, cache locally
- Display palette thumbnails (5 color samples from each)
- Allow palette selection: Set `palette_id` via `/api/params`
- Update palette list if cached data is >1 hour old

**API Contract:**
```json
// GET /api/palettes
{
  "palettes": [
    {
      "id": 0,
      "name": "Warm White",
      "colors": [
        {"r": 255, "g": 200, "b": 100},
        {"r": 255, "g": 180, "b": 80},
        ...
      ],
      "num_keyframes": 5
    }
  ],
  "count": 12
}

// POST /api/params to select palette
{"palette_id": 3}
```

---

### 3.3 WiFi Management

**Requirement:** Allow WiFi network switching without leaving Tab5.

**Implementation Requirements:**
- Show current WiFi: `GET /api/wifi/status` (SSID, RSSI, IP)
- List available networks: `POST /api/wifi/scan` (async), then check results
- Allow credential change: `POST /api/wifi/credentials`
- Wait for reconnection: Poll `/api/test-connection` until response
- Update device IP in UI (or re-resolve mDNS hostname)

**API Contract:**
```json
// GET /api/wifi/status
{
  "ssid": "K1-Network",
  "rssi": -55,
  "ip": "192.168.1.100",
  "mac": "AA:BB:CC:DD:EE:FF",
  "firmware": "ESP-IDF v4.4",
  "force_bg_only": false,
  "force_ht20": false
}

// POST /api/wifi/scan (async)
{"status": "scan_initiated"}

// Follow-up: GET /api/wifi/scan/results
{"status": "complete", "message": "Check serial logs"}

// POST /api/wifi/credentials
{
  "ssid": "New-Network",
  "password": "SecurePassword123"
}

// Response
{
  "success": true,
  "ssid": "New-Network",
  "password_len": 18
}
```

---

### 3.4 Configuration Backup/Restore

**Requirement:** Allow users to save and restore complete device state.

**Implementation Requirements:**
- Backup button: `GET /api/config/backup`, offer download
- Restore button: Accept file upload, `POST /api/config/restore`
- Show restore status: Parameters restored, pattern restored
- Warn if some parameters were clamped during restore

**API Contract:**
```json
// GET /api/config/backup
{
  "version": "1.0",
  "device": "K1.reinvented",
  "timestamp": 3600000,
  "parameters": {...},
  "current_pattern": 5,
  "device_info": {
    "ip": "192.168.1.100",
    "mac": "AA:BB:CC:DD:EE:FF",
    "firmware": "ESP-IDF v4.4"
  }
}

// POST /api/config/restore (send backup file as body)
{
  "success": true,
  "parameters_restored": true,
  "pattern_restored": true,
  "warning": null
}
```

---

## 4. OPTIONAL ADVANCED FEATURES (Phase 3)

### 4.1 Performance Overlay
- `GET /api/device/performance` for detailed metrics
- Display render time breakdown: render_avg_us, quantize_avg_us, rmt_wait_avg_us, rmt_tx_avg_us
- Overlay on live preview: FPS graph, CPU usage trend

### 4.2 Frequency Analyzer
- `GET /api/audio/arrays` with options (count, offset, history, chromagram, novelty)
- Display interactive spectrogram and tempo analysis
- Allow downsampling and time-window selection

### 4.3 Latency Profiling
- `GET /api/latency/probe` for last measured latency
- `GET /api/latency/align` to correlate host timestamps with LED TX events
- Useful for controller developers, not end-users

### 4.4 Multi-Device Support
- Discover multiple K1 devices on network (mDNS or manual entry)
- Switch between devices in UI
- Synchronized backup/restore across fleet

---

## 5. API INTEGRATION CHECKLIST

### 5.1 Request Handling

- [ ] Set `Content-Type: application/json` for POST requests
- [ ] Validate JSON before sending: `JSON.stringify(obj)`
- [ ] Set HTTP timeout to 5000ms (WiFi variability)
- [ ] Handle 429 Rate Limited:
  - [ ] Read `X-RateLimit-NextAllowedMs` header
  - [ ] Wait milliseconds before retrying
  - [ ] Show user-friendly "Updating..." message during wait
- [ ] Handle 400 Bad Request:
  - [ ] Log error details: error code, message
  - [ ] Show user message: "Invalid request"
- [ ] Handle network timeout:
  - [ ] Retry with exponential backoff (100, 200, 400, 800ms)
  - [ ] After 3 retries, show "Device Unreachable"

### 5.2 Response Handling

- [ ] Parse JSON responses: `response.json()`
- [ ] Check HTTP status: 2xx = success, 4xx/5xx = error
- [ ] Log all errors: Include endpoint, status, request body, response body
- [ ] Handle partial updates: Server echoes complete state after partial update
- [ ] Validate expected fields: Check response has required keys

### 5.3 Error Recovery

- [ ] Detect when device is unreachable (timeout or 5xx)
- [ ] Show offline UI state:
  - [ ] Disable all control sliders
  - [ ] Show "Offline" indicator
  - [ ] Display last known state
  - [ ] Offer "Retry Connection" button
- [ ] Implement device discovery fallback:
  - [ ] Try mDNS hostname: `k1.local` (device broadcasts this)
  - [ ] If mDNS fails, show "Enter Device IP" dialog
  - [ ] Store IP in local storage for next session

### 5.4 Data Validation

- [ ] Pre-validate all parameters before sending:
  - Floats: `isFinite(value) && value >= 0 && value <= 1.0`
  - Integers: `Number.isInteger(value) && value >= min && value <= max`
- [ ] Client-side clamping: `Math.max(min, Math.min(max, value))`
- [ ] Palette ID validation: Check against palette list length
- [ ] SSID validation: 1-63 characters
- [ ] Password validation: 0-63 characters

---

## 6. USER INTERFACE REQUIREMENTS

### 6.1 Main Control Panel

**Layout:** 3-column or tabbed interface
- **Column 1: Pattern Selector**
  - Dropdown/list of all patterns
  - Current pattern highlighted
  - Shows `is_audio_reactive` flag
  - Click to select

- **Column 2: Visual Parameters**
  - Brightness slider [0.0, 1.0]
  - Speed slider [0.0, 1.0]
  - Color slider [0.0, 1.0] (or color wheel)
  - Advanced toggle: Show saturation, softness, warmth, background, dithering

- **Column 3: Status & Monitoring**
  - FPS display (with color: Green/Yellow/Red)
  - CPU% display (with color)
  - Memory% display (with color)
  - WiFi signal strength (RSSI with bars)
  - Device IP and mDNS hostname
  - Connection status (Connected/Disconnected)

### 6.2 Audio Section (Hidden by Default)

- Toggle: "Enable Audio Reactivity" (if `is_audio_reactive == true`)
- Microphone Gain slider [0.5, 2.0] with 0.1 step
- VU Meter: Visual bar showing `vu_level` from `/api/audio/snapshot`
- Beat Confidence: Visual display of `tempo_confidence`
- Beat Threshold slider [0.0, 1.0] (pattern parameter)

### 6.3 Settings Tab

- **WiFi:**
  - Current network (SSID, IP)
  - Change network button → modal with credential form
  - Scan networks button
  - Link options (force_bg_only, force_ht20)

- **Configuration:**
  - Backup button (download JSON)
  - Restore button (upload JSON)
  - Reset to defaults button

- **Advanced:**
  - WebSocket status (connected/disconnected)
  - Real-time telemetry interval slider [100-5000ms]
  - Enable diagnostics toggle

### 6.4 Performance Overlay (Optional)

- Floating window: FPS history, CPU trend, frame time breakdown
- Toggle: Show/Hide
- Opacity slider: For visibility over content

---

## 7. TESTING REQUIREMENTS

### 7.1 Functional Tests

- [ ] Pattern selection works for all patterns
- [ ] Parameters update immediately via slider
- [ ] Rate limit enforcement: Button disabled for correct duration
- [ ] Status display updates every 2-5 seconds
- [ ] Audio section appears only for audio-reactive patterns
- [ ] WiFi status shows correct SSID, IP, RSSI
- [ ] Configuration backup/restore preserves all settings
- [ ] WebSocket broadcasts received every ~250ms
- [ ] WebSocket reconnects after disconnect
- [ ] Real-time parameter sync via WebSocket works

### 7.2 Error Handling Tests

- [ ] Malformed JSON input: Show error message
- [ ] Network timeout: Retry and show "Device Unreachable"
- [ ] Rate limited (429): Wait and retry automatically
- [ ] Invalid pattern index (404): Keep previous pattern
- [ ] Device reboot: Show "Waiting for device..." message
- [ ] WiFi credential change: Wait for reconnection gracefully

### 7.3 Performance Tests

- [ ] Rapid slider input (>10 updates/second): Debounce correctly
- [ ] WebSocket bandwidth: <100KB/s at 250ms interval
- [ ] Memory usage: <50MB for Tab5 application
- [ ] CPU usage: <10% on idle (waiting for updates)
- [ ] Connection time: <3 seconds to first real-time data

### 7.4 Stress Tests

- [ ] 100 consecutive pattern switches: All succeed
- [ ] 1000 parameter updates: No parameter corruption
- [ ] 10-minute continuous operation: No memory leaks
- [ ] WiFi disconnect/reconnect: Tab5 recovers correctly
- [ ] Concurrent edits from multiple tabs: Sync correctly via WebSocket

---

## 8. DEPLOYMENT CHECKLIST

### 8.1 Pre-Release

- [ ] All mandatory features implemented and tested
- [ ] Error handling covers all identified failure modes
- [ ] UI responsive on mobile (if target platform includes mobile)
- [ ] Offline mode graceful (no crashes, clear user messaging)
- [ ] Documentation complete (user guide, API reference)
- [ ] Performance benchmarks met (<50MB memory, <10% idle CPU)

### 8.2 Release

- [ ] Version bump: Semver (e.g., 1.0.0)
- [ ] Release notes: Features, fixes, known issues
- [ ] Deployment instructions: How to access Tab5
- [ ] Compatibility matrix: K1 firmware versions supported
- [ ] Emergency rollback plan: If critical bug found

### 8.3 Post-Release

- [ ] Monitor for user-reported issues
- [ ] Collect usage metrics (if telemetry enabled)
- [ ] Plan Phase 2 features based on feedback
- [ ] Maintain API compatibility with K1 firmware

---

## 9. COMPLIANCE & STANDARDS

### 9.1 API Standards

- REST: Follows RESTful conventions (GET for read, POST for write)
- JSON: All payloads in application/json
- HTTP Status Codes: Appropriate 2xx/4xx/5xx responses
- CORS: Enabled for cross-origin requests
- Rate Limiting: Per-route enforcement with headers

### 9.2 Code Quality

- JavaScript: ES6+, async/await for async operations
- Error Handling: Try/catch blocks around fetch calls
- Logging: Console.error for issues, console.log for info
- Comments: Document non-obvious logic
- Type Safety: JSDoc annotations recommended

### 9.3 Security (Within Scope)

- HTTPS/WSS: Recommended for production (requires device cert)
- Input Validation: Client-side clipping before server transmission
- No Secrets: Never log credentials, API keys, or sensitive data
- CORS: Allows same-origin and cross-origin requests (open design)

---

## 10. SUCCESS METRICS

### 10.1 Functional Success
- ✓ All mandatory features working
- ✓ 99% HTTP request success rate (excluding rate limits)
- ✓ WebSocket uptime >95% (auto-reconnect if drops)
- ✓ <500ms latency for all operations

### 10.2 User Experience
- ✓ Smooth slider interaction (no lag)
- ✓ Real-time feedback via WebSocket
- ✓ Clear error messages for failures
- ✓ Intuitive UI (no documentation needed for basic use)

### 10.3 Performance
- ✓ Memory usage <50MB
- ✓ Idle CPU <10%
- ✓ Bandwidth <200KB/s
- ✓ Load time <3 seconds

### 10.4 Reliability
- ✓ 24-hour continuous operation without crash
- ✓ Graceful recovery from WiFi disconnect
- ✓ No data loss during session
- ✓ Offline mode prevents accidental transmissions

---

## 11. IMPLEMENTATION TIMELINE

| Phase | Features | Duration | Milestone |
|-------|----------|----------|-----------|
| Phase 1 | Pattern, Params, Health, Audio | 2 weeks | MVP |
| Phase 2 | WebSocket, Palettes, WiFi, Backup | 3 weeks | 1.0 Release |
| Phase 3 | Performance Overlay, Frequency Analyzer | 2 weeks | 1.1 |
| Phase 4 | Multi-Device, Fleet Management | 3 weeks | 2.0 |

---

## 12. REFERENCES & APPENDIX

### 12.1 Related Documents
- `docs/05-analysis/wireless_controller_api_reference.md` - Complete API mapping
- `docs/06-reference/tab5_controller_quick_reference.md` - Quick reference card
- `/firmware/src/webserver.cpp` - API implementation (source of truth)

### 12.2 Recommended Stack
- **Frontend:** React.js or Vue.js (responsive, real-time updates)
- **State Management:** Redux or Vuex (WebSocket sync)
- **HTTP Client:** Fetch API or Axios
- **WebSocket:** Native WebSocket or Socket.io
- **Styling:** Tailwind CSS or Bootstrap (mobile-first)
- **UI Components:** Material Design or custom
- **Testing:** Jest + React Testing Library
- **Build:** Webpack or Vite

### 12.3 External Resources
- MDN WebSocket Docs: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- REST API Best Practices: https://restfulapi.net/
- JSON Schema Validation: https://json-schema.org/
- CORS Explained: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS

---

**Document Version:** 1.0
**Last Updated:** 2025-11-05
**Status:** Ready for Development


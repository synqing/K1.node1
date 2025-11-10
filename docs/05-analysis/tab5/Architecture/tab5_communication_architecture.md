---
title: Tab5 Wireless Controller Communication Architecture
owner: Architecture Team
date: 2025-11-05
status: proposed
scope: Tab5 ↔ K1.node1 network protocol and control flow
related:
- docs/02-adr/K1NADR_0001_TAB5_PROTOCOL_CHOICE_v1.0_20251110.md (to be created)
  - docs/09-implementation/tab5_implementation_guide.md (to be created)
tags: [architecture, tab5, networking, websocket, rest, real-time]
---

# Tab5 Wireless Controller Communication Architecture

## Executive Summary

This document defines the communication architecture for Tab5 (ESP32-based wireless controller) communicating with K1.node1 (LED controller with web server). The design uses a **hybrid approach**: REST for commands, WebSocket for real-time telemetry, with comprehensive error handling and graceful degradation.

**Key Design Decisions:**
- **Hybrid Protocol**: HTTP POST for commands, WebSocket for state/telemetry push
- **Latency Target**: <200ms end-to-end for control actions
- **Update Rate**: 10 Hz telemetry (100ms intervals) to balance responsiveness and battery
- **Resilience**: Exponential backoff, local state caching, optimistic UI updates
- **Concurrency**: Last-writer-wins with sequence numbers for conflict detection
- **Security**: mDNS discovery on local network, optional API key authentication

---

## 1. Communication Model

### 1.1 Hybrid Architecture Rationale

| Protocol | Use Case | Rationale |
|----------|----------|-----------|
| **HTTP REST** | Control commands (mode, brightness, color) | Request-response pattern, simple retry logic, works with intermittent connectivity |
| **WebSocket** | Telemetry push (FPS, audio level, diagnostics) | Low overhead, real-time updates, server-initiated push eliminates polling latency |
| **mDNS** | Device discovery | Auto-discovery of K1.node1 without hardcoded IP addresses |

### 1.2 Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│                          Tab5 (ESP32)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐         ┌──────────────┐                     │
│  │  Touch Input │────────▶│  UI State    │                     │
│  │  Handler     │         │  Manager     │                     │
│  └──────────────┘         └──────┬───────┘                     │
│                                   │                             │
│                                   ▼                             │
│  ┌────────────────────────────────────────────┐                │
│  │       Connection Manager (FSM)             │                │
│  │  States: Disconnected → Connecting →       │                │
│  │          Connected → Synced → Error        │                │
│  └────────┬────────────────────────┬──────────┘                │
│           │                        │                            │
│           ▼                        ▼                            │
│  ┌─────────────────┐     ┌─────────────────┐                  │
│  │  REST Client    │     │  WS Client      │                  │
│  │  (Commands)     │     │  (Telemetry)    │                  │
│  └────────┬────────┘     └────────┬────────┘                  │
│           │                        │                            │
└───────────┼────────────────────────┼────────────────────────────┘
            │                        │
            │   WiFi (802.11n/ac)    │
            │                        │
┌───────────▼────────────────────────▼────────────────────────────┐
│                      K1.node1 (ESP32-S3)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐     ┌─────────────────┐                  │
│  │  HTTP Server    │     │  WS Server      │                  │
│  │  (async/await)  │     │  (broadcast)    │                  │
│  └────────┬────────┘     └────────▲────────┘                  │
│           │                        │                            │
│           ▼                        │                            │
│  ┌────────────────────────────────┴──────────┐                │
│  │      Command Processor (Queue)            │                │
│  │   - Validation                             │                │
│  │   - Sequence number tracking               │                │
│  │   - Concurrent access arbitration          │                │
│  └────────┬───────────────────────────────────┘                │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐     ┌─────────────────┐                  │
│  │  Pattern Engine │     │  State Manager  │                  │
│  │  (FastLED)      │     │  (atomic)       │                  │
│  └─────────────────┘     └─────────────────┘                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Command Flow Architecture

### 2.1 Request-Response Flow (HTTP POST)

```text
Tab5                                    K1.node1
 │                                         │
 │ 1. User touches "Mode: Ocean"          │
 │ ──────────────────────▶                │
 │    (Optimistic UI update)              │
 │                                         │
 │ 2. POST /api/v1/command                │
 │    {cmd: "set_mode", mode: "ocean",    │
 │     seq: 42, client_id: "tab5_001"}    │
 ├────────────────────────────────────────▶│
 │                                         │ 3. Validate command
 │                                         │    Enqueue (if valid)
 │                                         │    Update state
 │                                         │
 │ 4. HTTP 200 OK                          │
 │    {status: "ok", seq: 42,              │
 │     state: {...}, latency_ms: 45}       │
 │◀────────────────────────────────────────┤
 │                                         │
 │ 5. Confirm UI state                     │
 │    (or revert if mismatch)              │
 │                                         │
 │                                         │ 6. Broadcast state update
 │                                         │    via WebSocket to all
 │                                         │    connected clients
 │ 7. WS state update received             │
 │◀────────────────────────────────────────┤
 │    (redundant confirmation)             │
 │                                         │
```

### 2.2 Concurrent Request Handling

**Strategy: Last-Writer-Wins with Sequence Numbers**

```json
// Tab5 maintains monotonic sequence counter
{
  "cmd": "set_brightness",
  "value": 180,
  "seq": 43,
  "client_id": "tab5_001",
  "timestamp": 1730822400123
}

// K1 response includes accepted sequence
{
  "status": "ok",
  "seq": 43,
  "accepted_at": 1730822400156,
  "state": {
    "brightness": 180,
    "last_seq": 43,
    "last_client": "tab5_001"
  }
}
```

**Conflict Resolution:**
- K1 maintains `last_seq` and `last_client` per controllable parameter
- If `incoming_seq < last_seq` from different client → reject with HTTP 409 Conflict
- Tab5 receives 409 → pulls latest state via GET /api/v1/state → resyncs UI
- Commands from same client always accepted (allows retry without conflict)

### 2.3 Command Queue Architecture

K1 maintains a **bounded FIFO queue** (max 16 commands):

```cpp
struct Command {
    String cmd_type;
    JsonDocument params;
    uint32_t seq;
    String client_id;
    uint32_t received_at_ms;
};

class CommandQueue {
    std::queue<Command> queue_;
    SemaphoreHandle_t mutex_;

    bool enqueue(Command cmd) {
        if (queue_.size() >= MAX_QUEUE_DEPTH) {
            return false; // HTTP 503 Service Unavailable
        }
        queue_.push(cmd);
        return true;
    }

    void process() {
        while (!queue_.empty()) {
            auto cmd = queue_.front();
            execute(cmd); // Apply to state machine
            queue_.pop();
        }
    }
};
```

**Queue Overflow Handling:**
- Return HTTP 503 if queue full
- Tab5 waits 200ms, retries (exponential backoff)
- After 3 failures, show "Device Busy" warning

---

## 3. Telemetry Update Strategy

### 3.1 WebSocket Push Architecture

**K1 broadcasts state updates at 10 Hz (100ms intervals):**

```json
{
  "type": "telemetry",
  "timestamp": 1730822400200,
  "seq": 1001,
  "data": {
    "mode": "ocean",
    "brightness": 180,
    "fps": 58.3,
    "audio_level_db": -24.5,
    "audio_peak_db": -12.1,
    "uptime_ms": 345678,
    "wifi_rssi": -45,
    "heap_free_kb": 128,
    "clients_connected": 2,
    "error_flags": 0
  }
}
```

**Essential Telemetry (every update):**
- Current mode, brightness, color
- FPS (for performance monitoring)
- Audio level/peak (for sync feedback)
- WiFi RSSI (connection quality)
- Error flags (bit field)

**Optional Diagnostics (every 1s = every 10th update):**
- Heap free, uptime, CPU temperature
- Full pattern configuration
- Extended error logs

### 3.2 Tab5 Update Handling

```cpp
void onWebSocketMessage(const String& payload) {
    JsonDocument doc;
    deserializeJson(doc, payload);

    if (doc["type"] == "telemetry") {
        uint32_t server_seq = doc["seq"];

        // Detect dropped packets
        if (server_seq != last_seq + 1) {
            dropped_packets_++;
        }
        last_seq = server_seq;

        // Update UI elements (non-blocking)
        updateFPSDisplay(doc["data"]["fps"]);
        updateAudioMeter(doc["data"]["audio_level_db"]);
        updateStatusBar(doc["data"]["wifi_rssi"]);

        // Reconcile state (if command pending)
        if (pending_command_ && doc["seq"] >= pending_command_->seq) {
            confirmCommandSuccess();
            pending_command_ = nullptr;
        }
    }
}
```

### 3.3 Battery Impact Analysis

**Power Consumption Estimate (ESP32 @ 240 MHz):**
- WiFi active receive: ~120 mA
- WebSocket processing: ~30 mA
- Display updates: ~40 mA
- **Total during active use: ~190 mA**

**Battery Life (1000 mAh LiPo):**
- Continuous use: ~5.2 hours
- Deep sleep between updates: ~20+ hours (not applicable for controller)

**Optimization Strategy:**
- 10 Hz is optimal balance (responsive, not wasteful)
- Reduce to 5 Hz (200ms) if battery <20%
- Consider WiFi power save mode (DTIM beacon alignment) for future

---

## 4. Error Handling & Resilience

### 4.1 Network Timeout Strategy

```cpp
class K1Connection {
    static constexpr uint32_t HTTP_TIMEOUT_MS = 3000;
    static constexpr uint32_t WS_PING_INTERVAL_MS = 5000;
    static constexpr uint32_t WS_PONG_TIMEOUT_MS = 2000;

    enum class State {
        DISCONNECTED,
        DISCOVERING,    // mDNS lookup
        CONNECTING,     // TCP handshake
        CONNECTED,      // HTTP available
        SYNCED,         // WebSocket active
        ERROR_TIMEOUT,
        ERROR_REFUSED,
        ERROR_NETWORK
    };
};
```

### 4.2 Retry Logic with Exponential Backoff

```cpp
struct RetryPolicy {
    uint8_t max_attempts = 5;
    uint32_t base_delay_ms = 100;
    float backoff_multiplier = 2.0;
    uint32_t max_delay_ms = 5000;

    uint32_t getDelay(uint8_t attempt) {
        uint32_t delay = base_delay_ms * pow(backoff_multiplier, attempt);
        return min(delay, max_delay_ms);
    }
};

// Usage:
RetryPolicy retry;
for (uint8_t attempt = 0; attempt < retry.max_attempts; attempt++) {
    if (sendCommand(cmd)) {
        return SUCCESS;
    }
    delay(retry.getDelay(attempt));
}
return FAILURE;
```

### 4.3 Graceful Degradation

**State Machine Transitions:**

```text
DISCONNECTED
    │
    ├─ mDNS discovery succeeds ──▶ DISCOVERING
    │
    └─ Manual IP entry ──────────▶ CONNECTING
                                      │
                    HTTP GET /api/v1/status succeeds
                                      │
                                      ▼
                                  CONNECTED
                                      │
                    WebSocket handshake succeeds
                                      │
                                      ▼
                                   SYNCED ◀──┐
                                      │      │
                    Telemetry updates │      │ Reconnect
                    Commands work     │      │ (auto)
                                      │      │
                    Timeout/Error ────┴──▶ ERROR_*
```

**UI Feedback:**
- DISCONNECTED: "Searching for K1..." (spinning icon)
- CONNECTING: "Connecting..." (progress bar)
- CONNECTED: "Syncing..." (partial opacity controls)
- SYNCED: Full color UI, controls enabled
- ERROR_TIMEOUT: "Connection lost. Retrying..." (retry button)
- ERROR_REFUSED: "K1 unavailable. Check device." (manual retry)

### 4.4 Local State Caching

Tab5 maintains a **local state cache** for offline resilience:

```cpp
struct CachedState {
    String mode;
    uint8_t brightness;
    RGBColor color;
    uint32_t last_update_ms;
    bool stale;  // true if >5s since last WS update
};

// On disconnect:
void onDisconnect() {
    cached_state_.stale = true;
    ui_.showOfflineIndicator();
    ui_.dimControls();  // Visual cue: not in sync
}

// On reconnect:
void onReconnect() {
    // Pull fresh state
    HTTPClient http;
    http.GET("http://k1.local/api/v1/state");
    updateCacheFromResponse(http.getString());
    cached_state_.stale = false;
    ui_.restoreControls();
}
```

### 4.5 Command Confirmation Strategy

**Optimistic Update with Rollback:**

```cpp
void handleBrightnessSlider(uint8_t new_value) {
    // 1. Optimistic UI update (instant feedback)
    ui_.setBrightness(new_value);

    // 2. Send command with timeout
    auto cmd = Command{"set_brightness", new_value, next_seq_++};
    pending_commands_.push(cmd);

    auto response = http_client_.POST("/api/v1/command", cmd.toJSON());

    if (response.status == 200) {
        // 3a. Success: wait for WS confirmation (redundant check)
        confirmations_pending_.push({cmd.seq, millis() + 1000});
    } else {
        // 3b. Failure: revert UI to last known good state
        ui_.setBrightness(cached_state_.brightness);
        ui_.showError("Command failed. Retrying...");
        retry(cmd);
    }
}
```

---

## 5. Latency Budget

### 5.1 End-to-End Latency Breakdown

| Phase | Target | Typical | Max Acceptable |
|-------|--------|---------|----------------|
| **Tab5 UI render** | 16 ms | 20 ms | 50 ms |
| **WiFi transmission** | 10 ms | 15 ms | 50 ms |
| **HTTP processing (K1)** | 5 ms | 10 ms | 30 ms |
| **Command execution** | 10 ms | 15 ms | 50 ms |
| **WebSocket broadcast** | 5 ms | 10 ms | 20 ms |
| **Tab5 WS receive + render** | 10 ms | 15 ms | 30 ms |
| **TOTAL** | **56 ms** | **85 ms** | **230 ms** |

**Target: <200ms for 95th percentile**

### 5.2 Latency Monitoring

K1 includes server-side latency in responses:

```json
{
  "status": "ok",
  "seq": 42,
  "latency_ms": 12,  // Time from receive to response
  "queue_depth": 2,  // Commands ahead in queue
  "state": {...}
}
```

Tab5 calculates round-trip time:

```cpp
uint32_t rtt_ms = millis() - cmd.sent_at_ms;
latency_histogram_[bucket(rtt_ms)]++;

if (rtt_ms > 200) {
    log_warn("High latency: %d ms", rtt_ms);
}
```

### 5.3 Performance Degradation Handling

If latency exceeds thresholds:
- **200-500ms**: Show "Slow connection" indicator
- **500-1000ms**: Reduce telemetry rate to 5 Hz
- **>1000ms**: Suggest network troubleshooting

---

## 6. Concurrency Considerations

### 6.1 Multi-Client Scenario

**Tab5 + Webapp controlling K1 simultaneously:**

```text
Tab5                   K1.node1              Webapp
 │                        │                    │
 │ POST set_mode=ocean    │                    │
 ├───────────────────────▶│                    │
 │ seq=100, client=tab5   │                    │
 │                        │ Apply: mode=ocean  │
 │                        │ last_seq=100       │
 │                        │                    │
 │                        │ Broadcast WS:      │
 │◀───────────────────────┤───────────────────▶│
 │ mode=ocean, seq=100    │ mode=ocean, seq=100│
 │                        │                    │
 │                        │  POST set_mode=fire│
 │                        │◀───────────────────┤
 │                        │  seq=50, client=web│
 │                        │                    │
 │                        │ Reject: seq < last │
 │                        │ HTTP 409 Conflict  │
 │                        ├───────────────────▶│
 │                        │ {"error": "stale"} │
 │                        │                    │
 │                        │  GET /api/v1/state │
 │                        │◀───────────────────┤
 │                        │  seq=100, mode=... │
 │                        ├───────────────────▶│
 │                        │                    │ Resync UI
 │                        │                    │
```

### 6.2 Priority Handling

**Current Design: No explicit priority** (last-writer-wins sufficient for user controls)

**Future Extension (if needed):**
```json
{
  "cmd": "emergency_stop",
  "priority": 255,  // 0-255, higher = more urgent
  "seq": 101,
  "client_id": "tab5_001"
}
```

K1 could maintain a **priority queue** instead of FIFO, but adds complexity.

**Decision: Defer until use case emerges** (e.g., safety-critical commands).

### 6.3 Race Condition Detection

**Scenario: Tab5 and Webapp both change brightness within 100ms**

```cpp
// K1 server-side validation
bool CommandProcessor::validate(const Command& cmd) {
    auto& last = state_.last_commands[cmd.param_name];

    // Same client: always allow (idempotency)
    if (cmd.client_id == last.client_id) {
        return true;
    }

    // Different client: check sequence freshness
    if (cmd.seq < last.seq) {
        return false;  // Reject stale command
    }

    // Warn if commands too close in time (race likely)
    if (millis() - last.timestamp_ms < 100) {
        log_warn("Potential race: %s from %s and %s",
                 cmd.param_name, cmd.client_id, last.client_id);
    }

    return true;
}
```

### 6.4 Command Queue vs. Last-One-Wins

**Design Choice: Hybrid**

- **Queue**: For sequences of commands from single client (e.g., macro playback)
- **Last-Wins**: For conflicting parameters from different clients (e.g., brightness)

Implementation:
```cpp
struct CommandQueue {
    std::deque<Command> queue_;  // FIFO for same client
    std::unordered_map<String, Command> latest_;  // Latest per parameter

    void enqueue(Command cmd) {
        // Overwrite latest state for this parameter
        latest_[cmd.param_name] = cmd;

        // Append to execution queue
        queue_.push_back(cmd);
    }

    void process() {
        while (!queue_.empty()) {
            auto cmd = queue_.front();

            // Skip if superseded by later command for same param
            if (latest_[cmd.param_name].seq > cmd.seq) {
                queue_.pop_front();
                continue;
            }

            execute(cmd);
            queue_.pop_front();
        }
    }
};
```

---

## 7. Security Model

### 7.1 Current K1 API Authentication

**Status: Open network (no auth required)**

Rationale:
- Local network deployment (home/studio)
- Complexity vs. threat model trade-off
- Ease of development and debugging

**Risks:**
- Any device on network can control K1
- No protection against malicious clients
- No audit trail of who changed what

### 7.2 Proposed Authentication (Optional)

**API Key Approach:**

```http
POST /api/v1/command HTTP/1.1
Host: k1.local
Content-Type: application/json
X-API-Key: k1_4f8e3a9b2c1d7e6f

{"cmd": "set_mode", "mode": "ocean"}
```

**Configuration:**
- K1 generates API key on first boot (stored in SPIFFS)
- Displayed on OLED or web UI for manual entry
- Tab5 stores key in NVS (non-volatile storage)

**Implementation Complexity:**
- Low: Single shared key, stateless validation
- Middleware validates `X-API-Key` header on each request

**Alternative: mTLS (Future):**
- Mutual TLS with client certificates
- Higher security, higher complexity
- Overkill for current use case

### 7.3 Network Isolation

**Deployment Models:**

1. **Local Network Only (Recommended)**
   - K1 binds to local subnet (192.168.x.x or 10.x.x.x)
   - No port forwarding or external access
   - mDNS for discovery within LAN

2. **VPN Access (Advanced)**
   - K1 accessible via Tailscale/ZeroTier
   - Encrypted tunnel, no public exposure
   - Requires VPN client on Tab5

3. **Public Exposure (NOT RECOMMENDED)**
   - Requires strong authentication + HTTPS
   - Attack surface: DDoS, command injection, eavesdropping
   - Use only with VPN or reverse proxy (Cloudflare Tunnel)

### 7.4 Command Validation & Injection Prevention

**Input Sanitization:**

```cpp
bool CommandProcessor::validate(const JsonDocument& cmd) {
    // 1. Schema validation
    if (!cmd.containsKey("cmd") || !cmd["cmd"].is<String>()) {
        return false;
    }

    String cmd_type = cmd["cmd"];

    // 2. Whitelist of allowed commands
    static const std::set<String> ALLOWED_CMDS = {
        "set_mode", "set_brightness", "set_color", "next_mode", "prev_mode"
    };
    if (ALLOWED_CMDS.find(cmd_type) == ALLOWED_CMDS.end()) {
        return false;
    }

    // 3. Parameter range checks
    if (cmd_type == "set_brightness") {
        uint8_t val = cmd["value"];
        if (val > 255) return false;
    }

    // 4. String length limits (prevent buffer overflow)
    if (cmd.containsKey("mode")) {
        String mode = cmd["mode"];
        if (mode.length() > 32) return false;
    }

    // 5. No SQL/script injection (N/A for embedded, but good practice)
    // If logging to SQL or executing shell: sanitize strings

    return true;
}
```

**Rate Limiting:**

```cpp
class RateLimiter {
    std::unordered_map<String, uint32_t> client_request_count_;
    static constexpr uint32_t MAX_REQUESTS_PER_SECOND = 20;

    bool allow(const String& client_id) {
        uint32_t count = client_request_count_[client_id];
        if (count > MAX_REQUESTS_PER_SECOND) {
            return false;  // HTTP 429 Too Many Requests
        }
        client_request_count_[client_id]++;
        return true;
    }

    void resetCounters() {  // Called every 1s
        client_request_count_.clear();
    }
};
```

---

## 8. Protocol Definition

### 8.1 REST API Endpoints

#### **GET /api/v1/status**

**Description**: Health check and server info

**Request**: None

**Response (HTTP 200):**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime_ms": 123456,
  "clients_connected": 2,
  "heap_free_kb": 128,
  "wifi_rssi": -45
}
```

---

#### **GET /api/v1/state**

**Description**: Full device state snapshot

**Request**: None

**Response (HTTP 200):**
```json
{
  "mode": "ocean",
  "brightness": 180,
  "color": {"r": 0, "g": 128, "b": 255},
  "fps": 58.3,
  "audio_level_db": -24.5,
  "audio_peak_db": -12.1,
  "last_seq": 100,
  "last_client": "tab5_001",
  "timestamp": 1730822400500
}
```

---

#### **POST /api/v1/command**

**Description**: Execute control command

**Request:**
```json
{
  "cmd": "set_mode",
  "mode": "ocean",
  "seq": 42,
  "client_id": "tab5_001",
  "timestamp": 1730822400123
}
```

**Response (HTTP 200 - Success):**
```json
{
  "status": "ok",
  "seq": 42,
  "latency_ms": 12,
  "queue_depth": 0,
  "state": {
    "mode": "ocean",
    "brightness": 180,
    "last_seq": 42
  }
}
```

**Response (HTTP 400 - Invalid Command):**
```json
{
  "status": "error",
  "error": "invalid_command",
  "message": "Unknown command type",
  "seq": 42
}
```

**Response (HTTP 409 - Conflict):**
```json
{
  "status": "error",
  "error": "stale_sequence",
  "message": "Sequence number behind current state",
  "current_seq": 100,
  "received_seq": 42,
  "last_client": "webapp_001"
}
```

**Response (HTTP 503 - Queue Full):**
```json
{
  "status": "error",
  "error": "queue_full",
  "message": "Command queue full, retry later",
  "queue_depth": 16
}
```

---

#### **POST /api/v1/batch**

**Description**: Execute multiple commands atomically

**Request:**
```json
{
  "commands": [
    {"cmd": "set_mode", "mode": "fire"},
    {"cmd": "set_brightness", "value": 200}
  ],
  "seq": 43,
  "client_id": "tab5_001"
}
```

**Response (HTTP 200):**
```json
{
  "status": "ok",
  "seq": 43,
  "executed": 2,
  "failed": 0,
  "state": {...}
}
```

---

### 8.2 WebSocket Protocol

#### **Connection**

```text
WS ws://k1.local/ws
```

#### **Server → Client: Telemetry Update**

**Sent every 100ms:**
```json
{
  "type": "telemetry",
  "timestamp": 1730822400200,
  "seq": 1001,
  "data": {
    "mode": "ocean",
    "brightness": 180,
    "fps": 58.3,
    "audio_level_db": -24.5,
    "wifi_rssi": -45,
    "error_flags": 0
  }
}
```

#### **Server → Client: State Change Event**

**Sent immediately after command execution:**
```json
{
  "type": "state_change",
  "timestamp": 1730822400250,
  "seq": 42,
  "client_id": "webapp_001",
  "changes": {
    "mode": {"old": "fire", "new": "ocean"},
    "brightness": {"old": 150, "new": 180}
  }
}
```

#### **Server → Client: Error Event**

```json
{
  "type": "error",
  "timestamp": 1730822400300,
  "error": "pattern_load_failed",
  "message": "Failed to load pattern 'ocean'",
  "severity": "critical"
}
```

#### **Client → Server: Ping**

**Sent every 5s to keep connection alive:**
```json
{
  "type": "ping",
  "timestamp": 1730822405000,
  "client_id": "tab5_001"
}
```

**Server Response:**
```json
{
  "type": "pong",
  "timestamp": 1730822405001
}
```

---

### 8.3 Error Codes

| HTTP Code | Error String | Meaning | Client Action |
|-----------|--------------|---------|---------------|
| 200 | `ok` | Success | Continue |
| 400 | `invalid_command` | Malformed request | Fix request, don't retry |
| 400 | `invalid_parameter` | Parameter out of range | Fix value, don't retry |
| 401 | `unauthorized` | Missing/invalid API key | Prompt user for key |
| 409 | `stale_sequence` | Sequence conflict | GET /state, resync |
| 429 | `rate_limited` | Too many requests | Backoff, retry after 1s |
| 503 | `queue_full` | Command queue full | Backoff, retry with delay |
| 500 | `internal_error` | Server exception | Log, retry with backoff |

---

### 8.4 Tab5 State Machine

```text
┌─────────────────┐
│  DISCONNECTED   │ ◀── Initial state, network down
└────────┬────────┘
         │ Start mDNS discovery
         ▼
┌─────────────────┐
│  DISCOVERING    │ ── mDNS lookup for k1.local
└────────┬────────┘
         │ Found IP or timeout (10s)
         ▼
┌─────────────────┐
│  CONNECTING     │ ── TCP handshake + HTTP GET /status
└────────┬────────┘
         │ HTTP 200 received
         ▼
┌─────────────────┐
│   CONNECTED     │ ── HTTP available, no WS yet
└────────┬────────┘
         │ WebSocket handshake
         ▼
┌─────────────────┐
│     SYNCED      │ ◀┐ Active telemetry, commands work
└────────┬────────┘  │
         │            │ Pong received
         │ Timeout    │
         ▼            │
┌─────────────────┐  │
│  ERROR_TIMEOUT  │ ─┘ Retry connection after backoff
└────────┬────────┘
         │ Max retries exceeded
         ▼
┌─────────────────┐
│  ERROR_REFUSED  │ ── Manual retry required
└─────────────────┘
```

**State Transitions:**

| From | Event | To | Action |
|------|-------|-----|--------|
| DISCONNECTED | WiFi connected | DISCOVERING | Start mDNS |
| DISCOVERING | mDNS success | CONNECTING | TCP connect |
| DISCOVERING | Timeout (10s) | DISCONNECTED | Show error |
| CONNECTING | HTTP 200 | CONNECTED | GET /state |
| CONNECTING | Timeout (3s) | ERROR_TIMEOUT | Retry |
| CONNECTED | WS handshake OK | SYNCED | Start telemetry |
| SYNCED | WS close | CONNECTING | Reconnect |
| SYNCED | Timeout (5s) | ERROR_TIMEOUT | Retry |
| ERROR_TIMEOUT | Retry success | CONNECTING | Resume |
| ERROR_TIMEOUT | Max retries | ERROR_REFUSED | Wait for user |

---

### 8.5 Recovery Sequences

#### **Scenario: WiFi Dropout**

```text
Tab5: SYNCED
    ↓ WiFi disconnect event
Tab5: DISCONNECTED
    ↓ Wait for WiFi reconnect (auto or manual)
Tab5: WiFi connected
    ↓ Resume from DISCOVERING
Tab5: SYNCED (after 2-5s)
```

#### **Scenario: K1 Reboots**

```text
Tab5: SYNCED
    ↓ WebSocket closed unexpectedly
Tab5: CONNECTING
    ↓ HTTP GET /status fails (K1 booting)
Tab5: ERROR_TIMEOUT
    ↓ Retry after 1s (K1 now ready)
Tab5: CONNECTED
    ↓ WebSocket reconnect
Tab5: SYNCED
    ↓ GET /state to resync UI
Tab5: Fully recovered
```

#### **Scenario: Command Failure During Send**

```text
Tab5: User presses button
    ↓ Optimistic UI update
Tab5: POST /command
    ↓ Network timeout (3s)
Tab5: HTTP client returns error
    ↓ Revert UI to cached state
Tab5: Show "Command failed" toast
    ↓ Retry with exponential backoff
Tab5: Success on 2nd attempt
    ↓ WS confirms state change
Tab5: UI re-synced
```

---

## 9. Implementation Checklist

### 9.1 K1.node1 Server-Side

- [ ] HTTP server with async handlers (ESPAsyncWebServer)
- [ ] WebSocket server with broadcast capability
- [ ] Command queue with validation and sequence tracking
- [ ] State manager with atomic updates
- [ ] Rate limiter per client
- [ ] Error response helpers (409, 429, 503)
- [ ] Latency tracking and logging
- [ ] mDNS responder (`k1.local`)
- [ ] API key validation middleware (optional)

### 9.2 Tab5 Client-Side

- [ ] WiFi manager with auto-reconnect
- [ ] mDNS resolver for K1 discovery
- [ ] HTTP client with timeout and retry logic
- [ ] WebSocket client with ping/pong keepalive
- [ ] Connection state machine (FSM)
- [ ] Local state cache with staleness detection
- [ ] Optimistic UI updates with rollback
- [ ] Sequence number generator (monotonic)
- [ ] Latency histogram and alerts
- [ ] Battery-aware telemetry rate adjustment

### 9.3 Testing & Validation

- [ ] Unit tests for command validation
- [ ] Integration tests for HTTP endpoints
- [ ] WebSocket stress test (multiple clients)
- [ ] Latency profiling under load
- [ ] Network failure injection (disconnect WiFi mid-command)
- [ ] Concurrent client scenario (Tab5 + Webapp)
- [ ] Sequence conflict resolution test
- [ ] Queue overflow handling test
- [ ] Battery life measurement at 10 Hz telemetry

---

## 10. Open Questions & Future Enhancements

### 10.1 Open Questions

1. **Authentication**: Implement API key now or defer until security need arises?
   - **Recommendation**: Implement simple API key (low complexity, good practice)

2. **Priority Commands**: Do we need emergency stop or safety-critical commands?
   - **Recommendation**: Defer until use case confirmed

3. **Multi-Tab5 Support**: Can multiple Tab5 controllers manage same K1?
   - **Recommendation**: Yes, architecture already supports it

4. **Command Macros**: Should Tab5 support sequences (e.g., "Party Mode" = mode + color + brightness)?
   - **Recommendation**: Use `/api/v1/batch` endpoint for multi-step commands

### 10.2 Future Enhancements

- **Compressed WebSocket**: Use binary protocol (MessagePack) instead of JSON for lower bandwidth
- **Delta Updates**: Send only changed fields in telemetry (not full state every time)
- **Predictive UI**: Tab5 predicts next state based on patterns (smoother animations)
- **Voice Control Integration**: Tab5 acts as WiFi bridge for Alexa/Google Home
- **Multi-K1 Support**: Tab5 can switch between multiple K1 devices (scene controller)
- **Offline Mode**: Tab5 caches playlists, can operate standalone and sync later
- **Mesh Networking**: Tab5 ↔ Tab5 relay for extended range

---

## 11. Related Documentation

- [ADR-0001: Tab5 Communication Protocol Choice](../02-adr/ADR-0001-tab5-protocol-choice.md) *(to be created)*
- [Tab5 Implementation Guide](../09-implementation/tab5_implementation_guide.md) *(to be created)*
- [K1 WebSocket API Reference](../06-reference/k1_websocket_api.md) *(to be created)*
- [Network Performance Testing Plan](../04-planning/network_performance_test_plan.md) *(to be created)*

---

## Appendix A: Example Code Snippets

### A.1 K1 Command Handler (C++)

```cpp
void handleCommand(AsyncWebServerRequest *request, JsonVariant &json) {
    JsonObject cmd = json.as<JsonObject>();

    // Validate schema
    if (!validator.validate(cmd)) {
        request->send(400, "application/json",
                     "{\"status\":\"error\",\"error\":\"invalid_command\"}");
        return;
    }

    // Check rate limit
    String client_id = cmd["client_id"];
    if (!rate_limiter.allow(client_id)) {
        request->send(429, "application/json",
                     "{\"status\":\"error\",\"error\":\"rate_limited\"}");
        return;
    }

    // Enqueue command
    Command command = Command::fromJSON(cmd);
    if (!command_queue.enqueue(command)) {
        request->send(503, "application/json",
                     "{\"status\":\"error\",\"error\":\"queue_full\"}");
        return;
    }

    // Process and respond
    uint32_t start_ms = millis();
    state_manager.applyCommand(command);
    uint32_t latency_ms = millis() - start_ms;

    JsonDocument response;
    response["status"] = "ok";
    response["seq"] = command.seq;
    response["latency_ms"] = latency_ms;
    response["state"] = state_manager.toJSON();

    String response_str;
    serializeJson(response, response_str);
    request->send(200, "application/json", response_str);

    // Broadcast state change via WebSocket
    ws.textAll(response_str);
}
```

### A.2 Tab5 Connection Manager (C++)

```cpp
void ConnectionManager::loop() {
    switch (state_) {
        case State::DISCONNECTED:
            if (WiFi.status() == WL_CONNECTED) {
                state_ = State::DISCOVERING;
                startMDNS();
            }
            break;

        case State::DISCOVERING:
            if (mdns_resolved_) {
                state_ = State::CONNECTING;
                connectHTTP();
            } else if (millis() - discovery_start_ > 10000) {
                state_ = State::ERROR_TIMEOUT;
                retry_count_ = 0;
            }
            break;

        case State::CONNECTING:
            if (http_connected_) {
                state_ = State::CONNECTED;
                syncState();
                connectWebSocket();
            } else if (millis() - connect_start_ > 3000) {
                state_ = State::ERROR_TIMEOUT;
                scheduleRetry();
            }
            break;

        case State::CONNECTED:
            if (ws_connected_) {
                state_ = State::SYNCED;
                ui_.showSyncedIndicator();
            }
            break;

        case State::SYNCED:
            if (!ws_connected_ || millis() - last_pong_ > 5000) {
                state_ = State::ERROR_TIMEOUT;
                scheduleRetry();
            }
            break;

        case State::ERROR_TIMEOUT:
            if (millis() >= next_retry_at_) {
                if (retry_count_++ < MAX_RETRIES) {
                    state_ = State::CONNECTING;
                    connectHTTP();
                } else {
                    state_ = State::ERROR_REFUSED;
                    ui_.showManualRetryButton();
                }
            }
            break;
    }
}
```

---

**End of Document**

*This architecture provides a robust, low-latency, resilient foundation for Tab5 ↔ K1.node1 communication. All design decisions prioritize user experience, simplicity, and future extensibility.*

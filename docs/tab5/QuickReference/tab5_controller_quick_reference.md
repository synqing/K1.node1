# Tab5 Controller Quick Reference Card
## Essential API Endpoints & Patterns

**Print this page or bookmark for Tab5 development**

---

## CRITICAL ENDPOINTS (Must Implement)

### 1. Pattern Selection
```http
POST /api/select
Content-Type: application/json

{"index": 5}
OR {"id": "aurora_v2"}
```
**Rate Limit:** 200ms | **Response:** `{current_pattern, id, name}`

### 2. Parameter Control
```http
POST /api/params
Content-Type: application/json

{"brightness": 0.85, "speed": 0.75, "color": 0.5}
```
**Rate Limit:** 300ms | **Response:** Current state (full parameters)

### 3. Read Current State
```http
GET /api/params
GET /api/pattern/current
GET /api/patterns
```
**Rate Limit:** 150-1000ms | **Response:** JSON

### 4. Status Check
```http
GET /api/health
```
**Rate Limit:** 200ms | **Response:** `{status, fps, cpu_percent, memory, wifi}`

---

## PARAMETER QUICK REFERENCE

| Name | Range | Default | Type | Notes |
|------|-------|---------|------|-------|
| brightness | 0.0-1.0 | 1.0 | float | Global intensity |
| speed | 0.0-1.0 | 0.5 | float | Animation speed |
| color | 0.0-1.0 | 0.33 | float | Palette hue |
| softness | 0.0-1.0 | 0.25 | float | Decay/blur |
| saturation | 0.0-1.0 | 0.75 | float | Color vividness |
| palette_id | 0-(N-1) | 0 | uint8 | Discrete palette |

---

## AUDIO CONTROL (If Audio-Reactive Pattern)

```http
GET /api/audio-config
POST /api/audio-config
{"active": true, "microphone_gain": 1.5}

GET /api/audio/snapshot
```

**Key Parameters:**
- `microphone_gain`: [0.5, 2.0]
- `vu_floor_pct`: [0.5, 0.98]
- `beat_threshold`: [0.0, 1.0] (pattern parameter)

---

## REAL-TIME TELEMETRY (WebSocket)

```javascript
// Connect
const ws = new WebSocket('ws://[device_ip]/ws');

// Listen for broadcasts (every ~250ms)
ws.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.type === 'realtime') {
    console.log(data.performance.fps);
    console.log(data.parameters.brightness);
  }
};
```

**Broadcast Includes:**
- `performance`: {fps, cpu_percent, memory_percent, frame_time_us}
- `parameters`: All current control parameters
- `current_pattern`: Active pattern index

---

## RATE LIMITS (Remember These!)

| Endpoint | Limit | Retry After |
|----------|-------|-------------|
| POST /api/select | 200ms | X-RateLimit-NextAllowedMs |
| POST /api/params | 300ms | X-RateLimit-NextAllowedMs |
| POST /api/audio-config | 300ms | X-RateLimit-NextAllowedMs |
| GET /api/params | 150ms | X-RateLimit-NextAllowedMs |
| POST /api/wifi/credentials | 1500ms | X-RateLimit-NextAllowedMs |
| POST /api/wifi/scan | 5000ms | X-RateLimit-NextAllowedMs |

**Other GET endpoints:** Unlimited (0ms rate limit)

---

## ERROR RECOVERY

```javascript
async function safeApiCall(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    timeout: 5000
  });

  if (response.status === 429) {
    const nextAllowedMs = response.headers.get('X-RateLimit-NextAllowedMs');
    await new Promise(r => setTimeout(r, parseInt(nextAllowedMs)));
    return safeApiCall(url, options); // Retry
  }

  return response.json();
}
```

---

## CONTROL FLOW PATTERNS

### Pattern + Audio Setup
```javascript
// 1. Get pattern info
const patterns = await fetch('/api/patterns').then(r => r.json());

// 2. Switch pattern
await fetch('/api/select', {
  method: 'POST',
  body: JSON.stringify({index: selectedIndex})
});

// 3. Check if audio-reactive
const current = await fetch('/api/pattern/current').then(r => r.json());

// 4. If audio-reactive, enable audio
if (current.is_audio_reactive) {
  await fetch('/api/audio-config', {
    method: 'POST',
    body: JSON.stringify({active: true})
  });
}

// 5. Update pattern-specific parameters
await fetch('/api/params', {
  method: 'POST',
  body: JSON.stringify({
    brightness: 0.85,
    speed: 0.75,
    ...
  })
});
```

---

## PARAMETER VALIDATION CHECKLIST

Before sending `POST /api/params`:
- [ ] All floats are finite (not NaN, not Infinity)
- [ ] All floats are in [0.0, 1.0]
- [ ] palette_id is 0 to (NUM_PALETTES-1)
- [ ] No typos in parameter names

**Example Pre-Flight Check:**
```javascript
function validateParams(obj) {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'number') {
      if (!isFinite(value) || value < 0 || value > 1) {
        throw new Error(`Invalid ${key}: ${value}`);
      }
    }
  }
  return true;
}
```

---

## WIFI MANAGEMENT

```http
GET /api/wifi/status
GET /api/wifi/credentials (returns ssid + password_len only)
POST /api/wifi/credentials
{"ssid": "Network", "password": "Password"}
```

**After changing credentials:**
- Device will disconnect and reconnect (~2-5 seconds)
- IP may change (re-resolve mDNS or ask user)
- Use `GET /api/test-connection` to verify reconnection

---

## CONFIGURATION BACKUP/RESTORE

```javascript
// Backup
const backup = await fetch('/api/config/backup').then(r => r.json());
localStorage.setItem('k1-backup', JSON.stringify(backup));

// Restore
const backup = JSON.parse(localStorage.getItem('k1-backup'));
await fetch('/api/config/restore', {
  method: 'POST',
  body: JSON.stringify(backup)
});
```

---

## PERFORMANCE MONITORING

```javascript
// Lightweight check (use frequently)
const health = await fetch('/api/health').then(r => r.json());
console.log(`FPS: ${health.fps}, CPU: ${health.cpu_percent}%`);

// Detailed metrics (less frequent)
const perf = await fetch('/api/device/performance').then(r => r.json());
console.log(`Frame Time: ${perf.frame_time_us}µs`);
console.log(`Render: ${perf.render_avg_us}µs, RMT TX: ${perf.rmt_tx_avg_us}µs`);
```

---

## DEBUGGING TIPS

1. **Pattern not switching?** → Check POST rate limit (200ms window)
2. **Parameters not updating?** → Check POST rate limit (300ms window)
3. **Audio not reacting?** → `GET /api/pattern/current` to check `is_audio_reactive`
4. **WiFi unstable?** → Try `POST /api/wifi/link-options?force_bg_only=true`
5. **High latency?** → Check `GET /api/health` for CPU% (>80% = overloaded)

---

## RESPONSE TEMPLATES

### Successful Parameter Update
```json
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
```

### Rate Limited Error
```json
{
  "error": "rate_limited",
  "message": "Too many requests",
  "timestamp": 3600000,
  "status": 429
}
```

**Response Headers:**
```
X-RateLimit-Window: 300
X-RateLimit-NextAllowedMs: 250
```

---

## INITIALIZATION CHECKLIST

On Tab5 startup:
- [ ] Ping `/api/test-connection` to verify device reachable
- [ ] Fetch `/api/patterns` and cache locally
- [ ] Fetch `/api/palettes` and cache locally
- [ ] Fetch `/api/params` to sync current state
- [ ] Connect to WebSocket `/ws` for real-time updates
- [ ] Display device status from `/api/health`

---

## TYPICAL LATENCIES

| Operation | Time |
|-----------|------|
| GET /api/params | 100ms (RTT + server) |
| POST /api/params | 300ms+ (rate limit 300ms + RTT) |
| POST /api/select | 200ms+ (rate limit 200ms + RTT) |
| WebSocket broadcast | 50-100ms (server-push, no polling) |

**User Perception:** All should feel responsive (< 500ms is imperceptible)

---

## CURL CHEAT SHEET

```bash
# List patterns
curl http://192.168.1.100/api/patterns | jq '.patterns[].name'

# Change brightness
curl -X POST http://192.168.1.100/api/params \
  -H 'Content-Type: application/json' \
  -d '{"brightness": 0.85}'

# Get current FPS
curl http://192.168.1.100/api/health | jq '.fps'

# WebSocket streaming (requires wscat)
wscat -c ws://192.168.1.100/ws
```

---

**Last Updated:** 2025-11-05
**Format:** Markdown (GitHub/GitLab compatible)
**For:** Tab5 Wireless Controller Implementation


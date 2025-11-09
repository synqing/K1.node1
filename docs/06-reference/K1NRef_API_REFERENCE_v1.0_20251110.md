# K1.node1 API Reference

**Status**: Production Ready
**Version**: 1.0
**Date**: 2025-11-10
**Owner**: K1 Development Team

## Overview

The K1.node1 API provides three communication channels:

1. **REST API**: Synchronous request/response for configuration and queries
2. **WebSocket API**: Real-time bidirectional communication for telemetry and events
3. **Device API**: Low-level control and diagnostics

All APIs use JSON payloads with UTF-8 encoding.

---

## REST API

Base URL: `http://device:8080/api`

### Pattern Management

#### GET /api/patterns

List all available patterns.

**Response**: 200 OK
```json
{
  "status": "ok",
  "patterns": [
    {
      "id": "spectrum",
      "name": "Spectrum",
      "category": "audio_reactive",
      "description": "Audio reactive spectrum visualization",
      "version": "1.0",
      "enabled": true,
      "parameters": [
        {
          "name": "brightness",
          "type": "float",
          "min": 0.0,
          "max": 1.0,
          "default": 0.8,
          "description": "Overall LED brightness"
        },
        {
          "name": "speed",
          "type": "float",
          "min": 0.1,
          "max": 2.0,
          "default": 1.0,
          "description": "Animation speed multiplier"
        }
      ]
    }
  ],
  "total": 15,
  "categories": ["audio_reactive", "static", "animated"]
}
```

**Error Responses**:
- 500: Internal error

---

#### GET /api/patterns/{pattern_id}

Get details of a specific pattern.

**URL Parameters**:
- `pattern_id` (string): Pattern identifier

**Response**: 200 OK
```json
{
  "status": "ok",
  "id": "spectrum",
  "name": "Spectrum",
  "description": "Audio reactive spectrum visualization...",
  "category": "audio_reactive",
  "version": "1.0",
  "author": "K1 Team",
  "tags": ["audio", "frequency", "reactive"],
  "parameters": [
    {
      "name": "brightness",
      "type": "float",
      "min": 0.0,
      "max": 1.0,
      "default": 0.8,
      "unit": "normalized"
    }
  ],
  "graph": {
    "node_count": 9,
    "edge_count": 12,
    "complexity": 0.85
  }
}
```

**Error Responses**:
- 404: Pattern not found
- 500: Internal error

---

#### POST /api/patterns/{pattern_id}/select

Select pattern to display.

**URL Parameters**:
- `pattern_id` (string): Pattern identifier

**Request**:
```json
{
  "fade_time_ms": 500
}
```

**Parameters**:
- `fade_time_ms` (int, optional): Transition time in milliseconds (default: 0)

**Response**: 200 OK
```json
{
  "status": "ok",
  "pattern": "spectrum",
  "fade_time_ms": 500,
  "previous_pattern": "twilight"
}
```

**Error Responses**:
- 404: Pattern not found
- 422: Invalid parameters
- 503: Device busy (pattern already transitioning)

---

#### GET /api/patterns/current

Get currently selected pattern.

**Response**: 200 OK
```json
{
  "status": "ok",
  "pattern_id": "spectrum",
  "pattern_name": "Spectrum",
  "active": true,
  "fps": 59.8,
  "uptime_ms": 12345
}
```

---

#### PUT /api/patterns/{pattern_id}/parameters

Update pattern parameters.

**URL Parameters**:
- `pattern_id` (string): Pattern identifier

**Request**:
```json
{
  "brightness": 0.5,
  "speed": 1.2,
  "custom_param_3": 0.7
}
```

**Response**: 200 OK
```json
{
  "status": "ok",
  "pattern": "spectrum",
  "parameters": {
    "brightness": 0.5,
    "speed": 1.2,
    "custom_param_3": 0.7
  }
}
```

**Error Responses**:
- 404: Pattern not found
- 422: Invalid parameter value (out of range)
- 500: Internal error

**Parameter Validation**:
- All parameters clipped to valid range
- Invalid types converted if possible
- Out-of-range values return detailed error

---

#### GET /api/patterns/{pattern_id}/parameters

Get current parameter values for pattern.

**Response**: 200 OK
```json
{
  "status": "ok",
  "pattern": "spectrum",
  "parameters": {
    "brightness": 0.8,
    "speed": 1.0,
    "custom_param_3": 0.5
  }
}
```

---

### Device Management

#### GET /api/device/info

Get device information and build details.

**Response**: 200 OK
```json
{
  "status": "ok",
  "device": {
    "model": "ESP32-S3",
    "chip_revision": "v0.2",
    "cores": 2,
    "cpu_freq_mhz": 240
  },
  "firmware": {
    "version": "2025-11-10",
    "build_date": "2025-11-10T15:30:00Z",
    "build_signature": "IDF5.1, Arduino 3.2, RMT v2",
    "git_commit": "abc1234def567890",
    "api_version": "1.0"
  },
  "leds": {
    "total_count": 180,
    "max_brightness": 255,
    "color_order": "GRB"
  },
  "audio": {
    "enabled": true,
    "sample_rate": 44100,
    "bit_depth": 16,
    "channels": 1,
    "buffer_size": 512,
    "fft_size": 512
  },
  "network": {
    "ssid": "MyNetwork",
    "ip_address": "192.168.1.100",
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "rssi_dbm": -65
  },
  "memory": {
    "total_heap_bytes": 262144,
    "free_heap_bytes": 65536,
    "largest_free_block_bytes": 32768
  }
}
```

---

#### GET /api/device/performance

Get real-time performance metrics.

**Query Parameters**:
- `window_ms` (int): Metrics window in milliseconds (default: 1000)

**Response**: 200 OK
```json
{
  "status": "ok",
  "timestamp": 1699608600000,
  "window_ms": 1000,
  "timing": {
    "fps": 59.8,
    "frame_time_us": 16745,
    "frame_time_min_us": 16200,
    "frame_time_max_us": 17500,
    "frame_time_std_us": 450
  },
  "stages": {
    "audio_input_us": 120,
    "audio_processing_us": 800,
    "rendering_us": 2500,
    "led_output_us": 1200,
    "other_us": 12125
  },
  "audio": {
    "rms_energy": 0.45,
    "peak_energy": 0.87,
    "bass_level": 0.52,
    "mid_level": 0.38,
    "treble_level": 0.25,
    "beat_detected": false,
    "beat_strength": 0.0
  },
  "leds": {
    "brightness_avg": 180,
    "brightness_min": 0,
    "brightness_max": 255,
    "color_temp_k": 5500
  },
  "system": {
    "cpu_temp_c": 45.2,
    "free_heap_bytes": 65536,
    "uptime_ms": 123456789
  }
}
```

**Per-Stage Breakdown**:
- `audio_input_us`: FFT, microphone reading
- `audio_processing_us`: Filters, compression, envelope detection
- `rendering_us`: Color lookup, effects, spatial transforms
- `led_output_us`: RMT transmission to WS2812 strip
- `other_us`: Miscellaneous (margin)

---

#### GET /api/device/status

Get current device status.

**Response**: 200 OK
```json
{
  "status": "ok",
  "device_state": "running",
  "uptime_ms": 3600000,
  "pattern": "spectrum",
  "fps": 59.8,
  "last_error": null,
  "temperature_c": 45.2,
  "warnings": [
    "High memory usage: 85% (may cause frame drops)"
  ]
}
```

---

#### POST /api/device/reset

Soft reset device (restart firmware, preserve settings).

**Request**: (empty body)

**Response**: 200 OK
```json
{
  "status": "ok",
  "message": "Device resetting in 1 second..."
}
```

---

#### POST /api/device/factory-reset

Factory reset device (clear all settings).

**Request**: (empty body)

**Response**: 200 OK
```json
{
  "status": "ok",
  "message": "Factory reset initiated. Device will restart."
}
```

---

### Code Generation API

#### POST /api/codegen/validate

Validate a graph JSON definition.

**Request**:
```json
{
  "graph": {
    "pattern": {
      "name": "test_pattern"
    },
    "nodes": [
      {
        "id": "node1",
        "type": "audio_input",
        "name": "Audio Input"
      }
    ]
  }
}
```

**Response**: 200 OK
```json
{
  "status": "ok",
  "valid": true,
  "errors": [],
  "warnings": [
    "Node 'node1' output not used"
  ],
  "metrics": {
    "node_count": 1,
    "edge_count": 0,
    "complexity": 0.1,
    "estimated_code_size_bytes": 500,
    "estimated_time_us": 100
  }
}
```

**Validation Checks**:
- JSON syntax
- Required fields present
- Node types recognized
- Data flow validity
- No circular dependencies
- Array bounds consistency

---

#### POST /api/codegen/generate

Generate C++ code from graph JSON.

**Request**:
```json
{
  "graph": {
    "pattern": { "name": "test_pattern" },
    "nodes": [ ... ]
  },
  "options": {
    "optimize": true,
    "inline_simple_nodes": true,
    "add_comments": true
  }
}
```

**Response**: 200 OK
```json
{
  "status": "ok",
  "code": "void draw_test_pattern(...) { ... }",
  "code_size_bytes": 2340,
  "metrics": {
    "node_count": 9,
    "loop_count": 1,
    "branch_count": 3,
    "complexity": 0.85,
    "estimated_time_us": 2500
  },
  "warnings": []
}
```

---

### Error Responses

All endpoints may return error responses with standard format:

**400 Bad Request**:
```json
{
  "status": "error",
  "error_code": 1,
  "error_message": "Invalid JSON in request body",
  "details": {
    "field": "brightness",
    "reason": "Expected number, got string"
  }
}
```

**404 Not Found**:
```json
{
  "status": "error",
  "error_code": 2,
  "error_message": "Pattern 'unknown' not found",
  "available": ["spectrum", "twilight", "bloom"]
}
```

**422 Unprocessable Entity**:
```json
{
  "status": "error",
  "error_code": 3,
  "error_message": "Parameter 'brightness' out of valid range",
  "parameter": "brightness",
  "valid_range": [0.0, 1.0],
  "provided": 1.5
}
```

**500 Internal Server Error**:
```json
{
  "status": "error",
  "error_code": 4,
  "error_message": "Internal server error",
  "request_id": "req_12345678"
}
```

**503 Service Unavailable**:
```json
{
  "status": "error",
  "error_code": 5,
  "error_message": "Device busy, try again later",
  "retry_after_ms": 2000
}
```

---

## WebSocket API

Connect to: `ws://device:8080/api/ws`

### Connection Lifecycle

1. **Connect**: Establish WebSocket connection
2. **Subscribe**: Request message types to receive
3. **Receive**: Listen for events and updates
4. **Disconnect**: Close connection gracefully

### Message Format

All WebSocket messages are JSON:

```json
{
  "type": "message_type",
  "timestamp": 1699608600000,
  "payload": { ... }
}
```

**Fields**:
- `type` (string): Message type identifier
- `timestamp` (int): Server timestamp (ms since epoch)
- `payload` (object): Message-specific data

---

### Client Messages

#### Subscribe

Subscribe to message types.

**Message**:
```json
{
  "action": "subscribe",
  "types": ["pattern_changed", "telemetry", "errors"]
}
```

**Response**:
```json
{
  "type": "subscribed",
  "types": ["pattern_changed", "telemetry", "errors"]
}
```

---

#### Unsubscribe

Unsubscribe from message types.

**Message**:
```json
{
  "action": "unsubscribe",
  "types": ["telemetry"]
}
```

---

#### Ping

Keep-alive heartbeat.

**Message**:
```json
{
  "action": "ping"
}
```

**Response**:
```json
{
  "type": "pong"
}
```

---

### Server Messages

#### pattern_changed

Sent when active pattern changes.

**Message**:
```json
{
  "type": "pattern_changed",
  "timestamp": 1699608600000,
  "payload": {
    "pattern_id": "spectrum",
    "pattern_name": "Spectrum",
    "previous_pattern": "twilight",
    "fade_time_ms": 500
  }
}
```

---

#### param_updated

Sent when a parameter is updated.

**Message**:
```json
{
  "type": "param_updated",
  "timestamp": 1699608600000,
  "payload": {
    "pattern": "spectrum",
    "parameter": "brightness",
    "value": 0.5,
    "previous_value": 0.8
  }
}
```

---

#### telemetry

Sent periodically with performance metrics.

**Message** (every 100ms):
```json
{
  "type": "telemetry",
  "timestamp": 1699608600000,
  "payload": {
    "fps": 59.8,
    "frame_time_us": 16745,
    "audio": {
      "rms_energy": 0.45,
      "beat_detected": false
    },
    "leds": {
      "brightness_avg": 180
    },
    "memory": {
      "free_bytes": 65536,
      "heap_usage_percent": 75
    }
  }
}
```

---

#### audio_data

Sent with audio snapshot (high frequency).

**Message** (every frame):
```json
{
  "type": "audio_data",
  "timestamp": 1699608600000,
  "payload": {
    "rms": 0.45,
    "peak": 0.87,
    "spectrum": [0.1, 0.2, 0.15, ...],
    "bass": 0.52,
    "mids": 0.38,
    "treble": 0.25,
    "beat_detected": false,
    "beat_strength": 0.0
  }
}
```

---

#### error

Sent when an error occurs.

**Message**:
```json
{
  "type": "error",
  "timestamp": 1699608600000,
  "payload": {
    "error_code": 5,
    "error_message": "Pattern rendering timeout",
    "severity": "warning",
    "context": {
      "pattern": "spectrum",
      "frame_number": 12345
    }
  }
}
```

**Severity Levels**:
- `debug`: Informational only
- `info`: Normal operation info
- `warning`: Recoverable issue
- `error`: Pattern-affecting problem
- `critical`: Device-affecting problem

---

#### heartbeat

Keep-alive from server.

**Message**:
```json
{
  "type": "heartbeat",
  "timestamp": 1699608600000,
  "payload": {
    "uptime_ms": 123456789,
    "status": "ok"
  }
}
```

Sent every 30 seconds if no other messages sent.

---

## HTTP Status Codes

| Code | Meaning | Use Case |
|------|---------|----------|
| 200 | OK | Successful request |
| 201 | Created | Resource created |
| 204 | No Content | Success, no response body |
| 400 | Bad Request | Invalid request syntax |
| 401 | Unauthorized | Missing/invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 422 | Unprocessable Entity | Semantically invalid data |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Device busy or recovering |

---

## Error Codes

| Code | Name | HTTP | Meaning |
|------|------|------|---------|
| 0 | SUCCESS | 200 | Operation successful |
| 1 | INVALID_REQUEST | 400 | Invalid request format |
| 2 | NOT_FOUND | 404 | Resource not found |
| 3 | INVALID_PARAMETER | 422 | Parameter out of range |
| 4 | INTERNAL_ERROR | 500 | Server error |
| 5 | DEVICE_BUSY | 503 | Device busy (retry later) |
| 6 | AUTH_FAILED | 401 | Authentication failed |
| 7 | PERMISSION_DENIED | 403 | Insufficient permissions |
| 8 | TIMEOUT | 500 | Operation timeout |
| 9 | UNSUPPORTED | 400 | Operation not supported |

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

**Limits**:
- GET /api/patterns: 10 req/s per IP
- PUT /api/patterns/*/parameters: 10 req/s per IP
- POST /api/codegen/*: 2 req/s per IP
- WebSocket: 100 messages/s per connection

**Rate Limit Headers**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1699608665
```

When limit exceeded: 429 Too Many Requests

---

## Authentication

Currently **not required** (local network only). Future versions may add:
- API tokens
- OAuth2
- Certificate-based auth

---

## CORS

CORS headers are set to allow browser-based clients:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## Versioning

API versioning through URL path:

- Current: `/api` (v1.0)
- Future: `/api/v2`, `/api/v3`, etc.

Breaking changes increment major version. Backward-compatible changes increment minor.

---

## SDK Support

Official SDKs available for:

- **JavaScript/TypeScript**: `@k1/sdk`
- **Python**: `k1-sdk`
- **Go**: `github.com/k1/sdk-go`
- **Rust**: `k1-sdk` crate

---

## Example: Complete Workflow

### 1. Connect and Validate Graph

```bash
curl -X POST http://device:8080/api/codegen/validate \
  -H "Content-Type: application/json" \
  -d @spectrum_graph.json
```

### 2. Select Pattern

```bash
curl -X POST http://device:8080/api/patterns/spectrum/select \
  -H "Content-Type: application/json" \
  -d '{"fade_time_ms": 500}'
```

### 3. Adjust Parameters

```bash
curl -X PUT http://device:8080/api/patterns/spectrum/parameters \
  -H "Content-Type: application/json" \
  -d '{"brightness": 0.5, "speed": 1.2}'
```

### 4. Monitor Performance

```bash
curl http://device:8080/api/device/performance
```

### 5. WebSocket Telemetry

```javascript
const ws = new WebSocket('ws://device:8080/api/ws');
ws.send(JSON.stringify({
  action: 'subscribe',
  types: ['telemetry', 'pattern_changed']
}));
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log(`[${msg.type}]`, msg.payload);
};
```

---

## Debugging

### Enable Request Logging

Set environment variable: `DEBUG_API=1`

Output to device serial: `curl -v http://device:8080/api/patterns`

### Get Request ID

All error responses include `request_id`:

```json
{
  "error_code": 4,
  "error_message": "Internal error",
  "request_id": "req_abc123def456"
}
```

Use `request_id` when reporting issues.

---

## Best Practices

1. **Cache Pattern List**: Don't fetch `/api/patterns` on every action
2. **Use WebSocket for Telemetry**: Reduces polling overhead
3. **Batch Parameter Updates**: Change multiple parameters in one call
4. **Handle Rate Limits**: Respect `X-RateLimit-*` headers
5. **Validate Locally**: Use `/api/codegen/validate` before generation
6. **Monitor Performance**: Regular `/api/device/performance` checks
7. **Implement Exponential Backoff**: For retries on 503 errors
8. **Use HTTPS in Production**: HTTP shown here for simplicity

---

## Changelog

### v1.0 (2025-11-10)

- Initial release
- REST API for patterns, device, code generation
- WebSocket API for real-time updates
- Error handling and rate limiting
- Full API documentation

---

**End of K1.node1 API Reference v1.0**

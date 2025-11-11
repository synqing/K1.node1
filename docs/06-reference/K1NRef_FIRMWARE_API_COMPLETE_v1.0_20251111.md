---
title: K1.node1 Firmware HTTP API — Complete Reference
author: team
date: 2025-11-11
version: 1.0
status: active
intent: Exhaustive, technically precise reference of the firmware HTTP API
tags: [api, firmware, http, reference, rest, rate-limit, telemetry]
---

# K1.node1 Firmware HTTP API — Complete Reference

This document is the canonical, exhaustive reference for the K1.node1 firmware HTTP API. It covers endpoint specifications, request/response formats, error handling, rate limiting, versioning, performance characteristics, and security considerations. It is intended for engineers integrating device control, diagnostics, and telemetry into applications.

## Quick Navigation
- Base URL: `http://k1-reinvented.local/` (mDNS) or device IP (e.g., `http://192.168.1.105/`).
- Content types: JSON (`application/json`) except `/metrics` (Prometheus text).
- Headers: `Content-Type: application/json` for POST; `Accept: application/json` for GET (recommended).
- CORS: Allowed (`Access-Control-Allow-Origin: *`, `GET,POST,OPTIONS`).
- Rate limits: Per route; see Rate Limit Policy section.
- Versioning: Selected v1 aliases (see Versioning section).

## Table of Contents
- [Architectural Overview](#architectural-overview)
- [API Conventions](#api-conventions)
- [Authentication & Security](#authentication--security)
- [Error Handling](#error-handling)
- [Rate Limit Policy](#rate-limit-policy)
- [Versioning & Deprecation](#versioning--deprecation)
- [Performance & SLAs](#performance--slas)
- [Endpoint Reference](#endpoint-reference)
  - [Core & Info](#core--info)
  - [Patterns & Palettes](#patterns--palettes)
  - [Parameters](#parameters)
  - [Visual](#visual)
  - [Audio](#audio)
  - [LED & RMT](#led--rmt)
  - [Beat & Latency](#beat--latency)
  - [Diagnostics](#diagnostics)
  - [Configuration & Reset](#configuration--reset)
  - [Wi‑Fi](#wi-fi)
- [Comprehensive Examples](#comprehensive-examples)
- [Data Flow](#data-flow)
- [Security Considerations](#security-considerations)
- [Compliance](#compliance)
- [Keyword Index / Search](#keyword-index--search)
- [Cross‑References](#cross-references)

## Architectural Overview
```
Client (Webapp/Tools) ──HTTP/WS──▶ Firmware Webserver (ESP32)
                                 ├─ Rate Limiter (per-route, method-aware)
                                 ├─ RequestContext (JSON parse, headers, errors)
                                 ├─ Handlers (K1RequestHandler subclasses)
                                 ├─ Response Builders (JSON, errors, CORS)
                                 ├─ NVS Persistence (diagnostics, realtime WS)
                                 └─ Subsystems: Patterns, Audio, LED RMT, Wi‑Fi
```

- Router registers `GET`/`POST` handlers in `firmware/src/webserver.cpp`.
- Rate limiting implemented per route in `firmware/src/webserver_rate_limiter.h`.
- JSON parsing and standardized error responses via `RequestContext` and builders.
- Some endpoints set attachment headers for downloads (e.g., dumps, backup).

## API Conventions
- Methods: `GET` for reads; `POST` for updates/actions.
- Headers: `Content-Type: application/json` for POST; `Accept: application/json` optional for GET.
- CORS: `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET,POST,OPTIONS`, `Access-Control-Allow-Headers: Content-Type`, `Access-Control-Allow-Credentials: false`.
- Numbers: Floats use dot-decimal, typically 0.0–1.0 for normalized controls.
- Integers: Indices and timestamps are unsigned; see endpoint specs.

## Authentication & Security
- Authentication: None. The device API is open on the local network.
- Network scope: Intended for LAN. Do not expose publicly.
- Oversized payload protection: POST bodies > 64KB rejected with `413 payload_too_large`.
- Rate limiting: Per-route windows; exceeding yields `429 rate_limited` with headers.
- CORS: Enabled for local tools and UI development.
- Recommendation: Protect access via network policy (VLAN, firewall). Consider future mTLS or token gating if external exposure is required.

## Error Handling
- Standard error JSON via `create_error_response`:
  - Fields: `error` (code), `message` (optional), `timestamp`, `status`.
  - Example: `{ "error": "invalid_json", "message": "Request body contains invalid JSON", "timestamp": 1234567, "status": 400 }`
- 429 errors attach headers:
  - `X-RateLimit-Window: <ms>`, `X-RateLimit-NextAllowedMs: <ms>`.
- Some handlers emit structured errors inline (e.g., `invalid_format` on `/api/leds/frame`). All include `error` and `message`.

## Rate Limit Policy
Method-aware windows in milliseconds; enforced per route. Windows may be zero (unlimited) for some GET routes.

| Endpoint | Method | Window (ms) |
|---|---|---|
| `/metrics` | GET | 200 |
| `/api/params` | GET | 150 |
| `/api/audio-config` | GET | 500 |
| `/api/diag` | GET | 200 |
| `/api/wifi/link-options` | GET | 500 |
| `/api/wifi/credentials` | GET | 500 |
| `/api/patterns` | GET | 1000 |
| `/api/palettes` | GET | 2000 |
| `/api/device/info` | GET | 1000 |
| `/api/test-connection` | GET | 200 |
| `/api/health` | GET | 200 |
| `/api/device/performance` | GET | 500 |
| `/api/frame-metrics` | GET | 500 |
| `/api/config/backup` | GET | 2000 |
| `/api/beat-events/info` | GET | 200 |
| `/api/latency/probe` | GET | 200 |
| `/api/beat-events/recent` | GET | 300 |
| `/api/beat-events/dump` | GET | 500 |
| `/api/led-tx/info` | GET | 200 |
| `/api/led-tx/recent` | GET | 300 |
| `/api/led-tx/dump` | GET | 500 |
| `/api/latency/align` | GET | 200 |
| `/api/audio/tempo` | GET | 200 |
| `/api/audio/snapshot` | GET | 300 |
| `/api/audio/arrays` | GET | 200 |
| `/api/audio/metrics` | GET | 200 |
| `/api/wifi/status` | GET | 500 |
| `/api/pattern/current` | GET | 200 |
| `/api/realtime/config` | GET | 200 |
| `/api/leds/frame` | GET | 200 |
| `/api/visual/config` | GET | 300 |
| `/api/params/bounds` | GET | 1000 |
| `/api/rmt` | GET | 200 |
| `/api/params` | POST | 300 |
| `/api/wifi/link-options` | POST | 300 |
| `/api/select` | POST | 200 |
| `/api/audio-config` | POST | 300 |
| `/api/reset` | POST | 1000 |
| `/api/config/restore` | POST | 2000 |
| `/api/rmt/reset` | POST | 500 |
| `/api/wifi/credentials` | POST | 1500 |
| `/api/wifi/scan` | POST | 5000 |
| `/api/audio/noise-calibrate` | POST | 1000 |

Response to limited requests: `429 rate_limited` with JSON body and rate-limit headers.

## Versioning & Deprecation
- v1 aliases provided for key routes:
  - `/api/v1/frame-metrics` → `/api/frame-metrics`
  - `/api/v1/leds/frame` → `/api/leds/frame`
  - `/api/v1/audio/config` → `/api/audio-config`
  - `/api/v1/params` → `/api/params`
- Legacy routes remain stable. New capabilities are added without breaking existing contracts.
- Deprecations: None active. Future deprecations will be announced via release notes and maintained for at least one minor version.

## Performance & SLAs
- Frame timing: Typical total ~6.4 ms under normal load; values available via `/api/frame-metrics` and `/api/device/performance`.
- Throughput: Real-time WS interval clamped 100–5000 ms; default from NVS.
- SLA Targets (non-binding):
  - 99% of `GET` responses under 200 ms for lightweight endpoints.
  - Metrics endpoints may vary with buffer sizes; designed to serialize under constrained heap.
  - JSON bodies kept small; dumps use attachment headers and bounded arrays.

## Endpoint Reference

### Core & Info
- `GET /api/test-connection`
  - Purpose: Quick liveness; returns `{ status, timestamp }`.
  - Headers: `Accept: application/json`.
  - Response: `200` with JSON.
  - Example: `curl -s http://DEVICE/api/test-connection`.

- `GET /api/health`
  - Purpose: Lightweight health snapshot (CPU, memory, Wi‑Fi).
  - Response: `{ status, uptime_ms, fps, cpu_percent, memory_free_kb, memory_total_kb, connected, wifi:{ssid,rssi,ip} }`.
  - Example: `curl -s http://DEVICE/api/health`.

- `GET /api/device/info`
  - Purpose: Device identifiers, IP, MAC, build signature.
  - Response: `{ device, uptime_ms, ip, mac, build:{arduino,arduino_release,idf_ver,platformio_platform,framework} }`.
  - Example: `curl -s http://DEVICE/api/device/info`.

- `GET /api/device/performance`
  - Purpose: FPS, frame timings, memory & CPU.%
  - Response: `{ fps, frame_time_us, render_avg_us, quantize_avg_us, rmt_wait_avg_us, rmt_tx_avg_us, cpu_percent, memory_percent, memory_free_kb, memory_total_kb, fps_history:[...] }`.
  - Example: `curl -s http://DEVICE/api/device/performance`.

- `GET /metrics` (text)
  - Purpose: Prometheus metrics (plain text).
  - Example: `curl -s http://DEVICE/metrics`.

### Patterns & Palettes
- `GET /api/patterns`
  - Response: `{ patterns:[{index,id,name,description?,is_audio_reactive?}], current_pattern }`.
  - Example: `curl -s http://DEVICE/api/patterns`.

- `GET /api/palettes`
  - Response: `{ palettes:[{id,name,colors:[{r,g,b}],num_keyframes}], count }`.
  - Example: `curl -s http://DEVICE/api/palettes`.

- `GET /api/pattern/current`
  - Response: `{ index, id, name, is_audio_reactive }`.
  - Example: `curl -s http://DEVICE/api/pattern/current`.

- `POST /api/select`
  - Body options: `{ index:int }` or `{ id:string }`.
  - Success: `200` with `{ current_pattern, id, name }`.
  - Errors: `400 missing_field`, `404 pattern_not_found`.
  - Example: `curl -s -X POST http://DEVICE/api/select -H 'Content-Type: application/json' -d '{"index":2}'`.

### Parameters
- `GET /api/params`
  - Response: Current `PatternParameters` (see JSON builder; 0–1 floats + specific fields like `palette_id`, `gamma_*`, `mirror_mode`, `led_offset`, audio tuning).
  - Example: `curl -s http://DEVICE/api/params`.

- `GET /api/params/bounds`
  - Purpose: Canonical min/max bounds and optional type hints.
  - Response: Map of parameter name → `{ min, max, type? }`.
  - Example: `curl -s http://DEVICE/api/params/bounds | jq`.

- `POST /api/params`
  - Body: Partial update across parameters (see `apply_params_json_to_struct`).
  - Success: `200` with updated `PatternParameters`.
  - Errors: `400 invalid_json`; `400 invalid_params` with `{ clamped:true }` when out-of-range values are clamped.
  - Example: `curl -s -X POST http://DEVICE/api/params -H 'Content-Type: application/json' -d '{"brightness":0.8,"palette_id":3}'`.

### Visual
- `GET /api/visual/config`
  - Purpose: Visual pipeline snapshot & capabilities.
  - Response: `{ brightness, dithering, dither_strength, frame_min_period_ms, supported_color_spaces:"hex,rgb,hsv", adaptive_resolution_supported:true, hardware_accel_available:true }`.
  - Example: `curl -s http://DEVICE/api/visual/config`.

### Audio
- `GET /api/audio-config`
  - Query: `monitor=1` to include live snapshot.
  - Response: `{ microphone_gain, vu_floor_pct, active, tuning:{audio_sensitivity,audio_responsiveness,bass_treble_balance}, monitor?:{vu_level,vu_level_raw,tempo_confidence,update_counter,timestamp_us,is_valid} }`.
  - Example: `curl -s 'http://DEVICE/api/audio-config?monitor=1'`.

- `POST /api/audio-config`
  - Body: `{ microphone_gain:0.5..2.0, vu_floor_pct:0.5..0.98, active:boolean }`.
  - Success: `200` with `{ microphone_gain, active }`.
  - Errors: `400 invalid_value` per field.
  - Example: `curl -s -X POST http://DEVICE/api/audio-config -H 'Content-Type: application/json' -d '{"microphone_gain":1.25,"vu_floor_pct":0.7}'`.

- `GET /api/audio/tempo`
  - Response: `{ tempo_confidence, tempi_power_sum, silence_detected, silence_level, max_tempo_range, top_bins:[{idx,bpm,magnitude,phase,beat}] }`.
  - Example: `curl -s http://DEVICE/api/audio/tempo`.

- `GET /api/audio/arrays`
  - Query: `count`, `offset`, `stride`, `history`, `frames`, `include_chromagram`, `include_novelty`, `novelty_count`, `order` (`newest|oldest`).
  - Response: `{ spectrogram|spectrogram_history:[[...]], tempi:[...], chromagram?:[12], novelty_curve?:[...], count, offset, stride, source_bins, source_tempi, history, include_* }`.
  - Example: `curl -s 'http://DEVICE/api/audio/arrays?count=16&include_chromagram=1&include_novelty=1&novelty_count=64'`.

- `GET /api/audio/metrics`
  - Response: `{ fps, frame_time_us, cpu_percent, memory_free_kb, beat_events_count, tempo_confidence, audio_update_counter, audio_timestamp_us }`.
  - Example: `curl -s http://DEVICE/api/audio/metrics`.

- `GET /api/audio/snapshot`
  - Response: `{ vu_level, vu_level_raw, tempo_confidence, update_counter, timestamp_us, is_valid }`.
  - Example: `curl -s http://DEVICE/api/audio/snapshot`.

- `POST /api/audio/noise-calibrate`
  - Response: `{ status:"started", frames: NOISE_CALIBRATION_FRAMES }`.
  - Example: `curl -s -X POST http://DEVICE/api/audio/noise-calibrate -H 'Content-Type: application/json' -d '{}'`.

### LED & RMT
- `GET /api/leds/frame`
  - Query: `n` (limit), `step` (downsampling stride), `fmt` (`hex|rgb|hsv`).
  - Errors: `400 invalid_format` when unsupported `fmt` provided.
  - Response: `{ count, limit, format, step, data:[...] }` per format.
  - Example: `curl -s 'http://DEVICE/api/leds/frame?n=64&step=4&fmt=rgb'`.

- `GET /api/rmt`
  - Response: `{ wait_timeouts, ch1:{empty,maxgap_us,trans_done,last_empty_us}, ch2:{...} }`.
  - Example: `curl -s http://DEVICE/api/rmt`.

- `POST /api/rmt/reset`
  - Response: `{ wait_timeouts, ch1:{empty,maxgap_us,trans_done}, ch2:{...} }`.
  - Example: `curl -s -X POST http://DEVICE/api/rmt/reset -H 'Content-Type: application/json' -d '{}'`.

### Beat & Latency
- `GET /api/beat-events/info`
  - Response: `{ count, capacity }`.
  - Example: `curl -s http://DEVICE/api/beat-events/info`.

- `GET /api/beat-events/recent`
  - Query: `limit` (clamp 1..32).
  - Response: `{ count, capacity, events:[{timestamp_us,confidence}] }`.
  - Example: `curl -s 'http://DEVICE/api/beat-events/recent?limit=16'`.

- `GET /api/beat-events/dump`
  - Response: same as recent, with attachment header for download.
  - Example: `curl -s -OJ http://DEVICE/api/beat-events/dump`.

- `GET /api/latency/probe`
  - Response: `{ active, last_latency_ms, timestamp_us, last_led_tx_us, label? }`.
  - Example: `curl -s http://DEVICE/api/latency/probe`.

- `GET /api/latency/align`
  - Query: `t_us` (required), `max_delta_us` (optional), `strategy` (`nearest|older|newer`).
  - Response: `{ count, capacity, t_us, max_delta_us?, strategy?, nearest_timestamp_us, delta_us, found }`.
  - Example: `curl -s 'http://DEVICE/api/latency/align?t_us=123456789&max_delta_us=500&strategy=nearest'`.

- `GET /api/led-tx/info`
  - Response: `{ count, capacity }`.
  - Example: `curl -s http://DEVICE/api/led-tx/info`.

- `GET /api/led-tx/recent`
  - Query: `limit`, `since_us`, `until_us`, `around_us`, `max_delta_us`, `order` (`newest|oldest`).
  - Response: `{ count, capacity, since_us?, until_us?, around_us?, max_delta_us?, order, events:[{timestamp_us}] }`.
  - Example: `curl -s 'http://DEVICE/api/led-tx/recent?limit=16&order=oldest'`.

- `GET /api/led-tx/dump`
  - Query: same filter options; emits attachment headers.
  - Example: `curl -s -OJ 'http://DEVICE/api/led-tx/dump?order=newest&since_us=1700000000'`.

### Diagnostics
- `GET /api/diag`
  - Response: `{ enabled, interval_ms, probe_logging }`.
  - Example: `curl -s http://DEVICE/api/diag`.

- `POST /api/diag`
  - Body: `{ enabled:boolean, interval_ms:uint32 }` (partial updates supported).
  - Response: `{ enabled, interval_ms, probe_logging }`. Persisted to NVS.
  - Example: `curl -s -X POST http://DEVICE/api/diag -H 'Content-Type: application/json' -d '{"enabled":true,"interval_ms":1000}'`.

- `GET /api/realtime/config`
  - Response: `{ enabled, interval_ms }` (NVS-backed).
  - Example: `curl -s http://DEVICE/api/realtime/config`.

- `POST /api/realtime/config`
  - Body: `{ enabled?:boolean, interval_ms?:100..5000 }`.
  - Errors: `400 invalid_param` per field; `400 no_fields` if neither provided.
  - Example: `curl -s -X POST http://DEVICE/api/realtime/config -H 'Content-Type: application/json' -d '{"enabled":true,"interval_ms":250}'`.

### Configuration & Reset
- `GET /api/config/backup`
  - Response: JSON attachment with `{ version, device, timestamp, uptime_seconds, parameters:{...}, current_pattern, device_info:{ip,mac,firmware} }`.
  - Example: `curl -s -OJ http://DEVICE/api/config/backup`.

- `POST /api/config/restore`
  - Body: Backup JSON with required fields `version` and `parameters`.
  - Response: `{ success:true, parameters_restored:boolean, pattern_restored:boolean, timestamp, warning? }`.
  - Errors: `400 invalid_json`, `400 invalid_backup_format`.
  - Example: `curl -s -X POST http://DEVICE/api/config/restore -H 'Content-Type: application/json' -d @k1-config-backup.json`.

- `POST /api/reset`
  - Response: Updated `PatternParameters` after defaults applied.
  - Example: `curl -s -X POST http://DEVICE/api/reset -H 'Content-Type: application/json' -d '{}'`.

### Wi‑Fi
- `GET /api/wifi/link-options`
  - Response: `{ force_bg_only:boolean, force_ht20:boolean }`.
  - Example: `curl -s http://DEVICE/api/wifi/link-options`.

- `POST /api/wifi/link-options`
  - Body: `{ force_bg_only?:boolean, force_ht20?:boolean }`.
  - Response: `{ success:true, force_bg_only, force_ht20 }`. Persists to NVS and may trigger reassociation.
  - Example: `curl -s -X POST http://DEVICE/api/wifi/link-options -H 'Content-Type: application/json' -d '{"force_bg_only":true}'`.

- `GET /api/wifi/credentials`
  - Response: `{ ssid:string, password_len:uint }` (masked).
  - Example: `curl -s http://DEVICE/api/wifi/credentials`.

- `POST /api/wifi/credentials`
  - Body: `{ ssid:string, password?:string|pass?:string }` (password optional for open networks).
  - Validation: `ssid` length 1..63; `password` length 0..63.
  - Response: `{ success:true, ssid, password_len }`.
  - Errors: `400 invalid_param` per field.
  - Example: `curl -s -X POST http://DEVICE/api/wifi/credentials -H 'Content-Type: application/json' -d '{"ssid":"MyNet","password":"secret"}'`.

- `POST /api/wifi/scan`
  - Response: `{ status:"scan_initiated", message }`.
  - Example: `curl -s -X POST http://DEVICE/api/wifi/scan -H 'Content-Type: application/json' -d '{}'`.

- `GET /api/wifi/scan/results`
  - Response: `{ status:"complete", message }` (results logged to serial output).
  - Example: `curl -s http://DEVICE/api/wifi/scan/results`.

- `GET /api/wifi/status`
  - Response: `{ ssid, rssi, ip, mac, firmware?, force_bg_only, force_ht20 }`.
  - Example: `curl -s http://DEVICE/api/wifi/status`.

## Comprehensive Examples
- Python (requests):
```python
import requests
BASE = 'http://device.local'

# Get params
r = requests.get(f'{BASE}/api/params', headers={'Accept':'application/json'})
print(r.json())

# Update params (partial)
patch = {'brightness': 0.75, 'palette_id': 2}
r = requests.post(f'{BASE}/api/params', json=patch)
print(r.status_code, r.json())

# LED frame (rgb)
r = requests.get(f'{BASE}/api/leds/frame', params={'n':64,'step':2,'fmt':'rgb'})
print(r.json()['data'][:4])
```

- JavaScript (fetch):
```js
const BASE = 'http://device.local';

async function getHealth() {
  const r = await fetch(`${BASE}/api/health`, { headers: { 'Accept':'application/json' } });
  if (!r.ok) throw new Error(`GET /api/health ${r.status}`);
  return r.json();
}

async function updateRealtimeConfig(enabled, interval) {
  const r = await fetch(`${BASE}/api/realtime/config`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Accept':'application/json' },
    body: JSON.stringify({ enabled, interval_ms: interval })
  });
  return r.json();
}
```

- Go (net/http):
```go
package main
import (
  "net/http"
  "io/ioutil"
  "fmt"
)
func main() {
  resp, _ := http.Get("http://device.local/api/device/performance")
  defer resp.Body.Close()
  b, _ := ioutil.ReadAll(resp.Body)
  fmt.Println(string(b))
}
```

### Edge Case Demonstrations
- Invalid JSON (POST):
  - Request: `POST /api/params` with malformed JSON.
  - Response: `400 invalid_json` with standard error fields.

- Out-of-range parameters:
  - Request: `POST /api/params` with `gamma_power: 9.0`.
  - Response: `400 invalid_params` and `{ clamped:true }` hint; values clamped by firmware.

- Rate limited:
  - Request: rapid consecutive `POST /api/params`.
  - Response: `429 rate_limited`, headers `X-RateLimit-Window`, `X-RateLimit-NextAllowedMs`.

- Payload too large:
  - Request: `POST /api/config/restore` with body > 64KB.
  - Response: `413 payload_too_large` with `{ max_size: 65536 }`.

- Invalid format:
  - Request: `GET /api/leds/frame?fmt=xyz`.
  - Response: `400 invalid_format` with message.

## Data Flow
- Parameter updates: Client POST → RequestContext parses JSON → `apply_params_json_to_struct` → `update_params_safe` (validate/clamp) → response with current parameters.
- Pattern selection: POST `/api/select` → update current pattern → response with selection metadata.
- Visual pipeline: Snapshot via `/api/visual/config`; controls sourced from `PatternParameters`.
- Audio telemetry: `/api/audio-config`, `/api/audio/tempo`, `/api/audio/arrays`, `/api/audio/snapshot` reflect rolling analysis buffers.
- RMT/LED telemetry: `/api/rmt`, `/api/leds/frame`, `/api/led-tx/*` expose driver and ring-buffer state.
- Diagnostics and realtime WS config: persisted via NVS namespaces `diagnostics` and `realtime_ws`.

## Security Considerations
- No authentication; rely on network segmentation and physical security.
- CORS enabled; tools can access from browsers in development.
- Memory safety: POST body capped at 64KB; per-route rate limiting prevents flooding.
- Future hardening: Optional auth tokens or mTLS for environments requiring isolation.

## Compliance
- Data: No PII; device metadata and telemetry only.
- Logs: Wi‑Fi scan results logged to serial; ensure physical/log access control.
- Export: Configuration backup is JSON; treat as non-sensitive but avoid public exposure.

## Keyword Index / Search
- Use your editor’s search with these tokens:
  - `frame-metrics`, `leds/frame`, `audio-config`, `params/bounds`, `realtime/config`, `rmt`, `latency/align`, `beat-events`.
  - Headers: `Access-Control-Allow-Methods`, `X-RateLimit-Window`.
  - Errors: `invalid_json`, `invalid_param`, `invalid_format`, `rate_limited`, `payload_too_large`.

## Cross‑References
- API Index: `../09-implementation/K1NImpl_API_INDEX_v1.0_20251110.md`.
- Endpoint Expansions: `K1NRef_ENDPOINT_EXPANSIONS_PHASE2_v1.0_20251111.md`.
- Rate‑Limit Policy Source: `../../firmware/src/webserver_rate_limiter.h`.
- Request/Response Builders: `../../firmware/src/webserver_response_builders.*`.
- Router & Handlers: `../../firmware/src/webserver.cpp`.

---
Document version: 1.0 (2025‑11‑11)

---
title: Rate‑Limit Policy
author: team
date: 2025-11-10
status: active
intent: Authoritative reference of per‑route rate‑limit windows
---

# Rate‑Limit Policy

Limits are enforced per route/method. Exceeding returns HTTP `429` with `window_ms` and `next_ms` hints.

Windows (ms), sourced from `firmware/src/webserver_rate_limiter.h`:

- POST
  - `/api/params`: 300
  - `/api/wifi/link-options`: 300
  - `/api/select`: 200
  - `/api/audio-config`: 300
  - `/api/reset`: 1000
  - `/api/diag`: 300
  - `/api/config/restore`: 2000
  - `/api/realtime/config`: 300
  - `/api/rmt/reset`: 500
  - `/api/wifi/credentials`: 1500
  - `/api/wifi/scan`: 5000
  - `/api/audio/noise-calibrate`: 1000

- GET
  - `/metrics`: 200
  - `/api/params`: 150
  - `/api/audio-config`: 500
  - `/api/diag`: 200
  - `/api/wifi/link-options`: 500
  - `/api/wifi/credentials`: 500
  - `/api/patterns`: 1000
  - `/api/palettes`: 2000
  - `/api/device/info`: 1000
  - `/api/test-connection`: 200
  - `/api/health`: 200
  - `/api/device/performance`: 500
  - `/api/config/backup`: 2000
  - `/api/beat-events/info`: 200
  - `/api/latency/probe`: 200
  - `/api/beat-events/recent`: 300
  - `/api/beat-events/dump`: 500
  - `/api/led-tx/info`: 200
  - `/api/led-tx/recent`: 300
  - `/api/led-tx/dump`: 500
  - `/api/latency/align`: 200
  - `/api/audio/tempo`: 200
  - `/api/audio/snapshot`: 300
  - `/api/audio/arrays`: 200
  - `/api/audio/metrics`: 200
  - `/api/wifi/status`: 500
  - `/api/pattern/current`: 200
  - `/api/realtime/config`: 200
  - `/api/leds/frame`: 200
  - `/api/rmt`: 200

Notes:
- `/api/frame-metrics` and `/api/wifi/scan/results` are available but not explicitly windowed; poll conservatively (≥500ms).
- Clients should pace requests to avoid contention with telemetry and control operations.


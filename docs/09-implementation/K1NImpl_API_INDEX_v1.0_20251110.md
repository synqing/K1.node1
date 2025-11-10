---
title: K1.node1 Firmware API Index
author: team
date: 2025-11-10
status: active
intent: Comprehensive index of firmware REST/HTTP endpoints
---

# K1.node1 Firmware API Index

Base URL: `http://k1-reinvented.local/` (mDNS) or device IP (e.g., `http://192.168.1.105/`).

All endpoints return JSON unless specified. Rate-limit windows are shown in milliseconds (ms).

## Core & Info
- `/api/health` — GET, 200ms. Build signature (framework, `IDF_VER`), degraded flags, reset cause.
- `/api/test-connection` — GET, 200ms. Quick liveness check; returns a simple status payload.
- `/api/device/info` — GET, 1000ms. Device identifiers, IP, firmware version/build metadata.
- `/api/device/performance` — GET, 500ms. FPS, histograms, CPU %, memory; optional beat phase.
- `/metrics` — GET, 200ms. Prometheus-style metrics endpoint.
- `/api/metrics` — GET, 200ms. JSON metrics snapshot.
- `/api/frame-metrics` — GET, 200ms. Per-frame timing metrics for UI/debug.

## Patterns & Palettes
- `/api/patterns` — GET, 1000ms. Available patterns catalog.
- `/api/palettes` — GET, 2000ms. Color palettes catalog.
- `/api/params` — GET, 150ms. Current parameter values.
- `/api/params` — POST, 300ms. Update parameter values.
- `/api/select` — POST, 200ms. Select pattern by id/index.
- `/api/pattern/current` — GET, 200ms. Current pattern info.

## Audio
- `/api/audio-config` — GET, 500ms. Current audio configuration.
- `/api/audio-config` — POST, 300ms. Update audio configuration.
- `/api/audio/noise-calibrate` — POST, 1000ms. Run noise calibration routine.
- `/api/audio/tempo` — GET, 200ms. Tempo estimation/beat BPM.
- `/api/audio/arrays` — GET, 200ms. Raw/processed audio arrays for debugging.
- `/api/audio/metrics` — GET, 200ms. Audio processing metrics.
- `/api/audio/snapshot` — GET, 300ms. Snapshot of audio state at call time.

## LED & RMT
- `/api/leds/frame` — GET, 200ms. Current LED frame (debug extract for UI).
- `/api/led-tx/info` — GET, 200ms. LED transmit channel configuration and status summary.
- `/api/led-tx/recent` — GET, 300ms. Recent LED transmit events.
- `/api/led-tx/dump` — GET, 500ms. Detailed LED transmit trace dump.
- `/api/rmt/diag` — GET, 200ms. RMT telemetry: per-channel `{empty, maxgap_us, trans_done, last_empty_us}` plus global `wait_timeouts`.
- `/api/rmt/reset` — POST, 500ms. Reset RMT counters and LED wait timeouts; returns updated telemetry.

## Beat & Latency
- `/api/beat-events/info` — GET, 200ms. Beat event configuration and counters.
- `/api/beat-events/recent` — GET, 300ms. Recent beat events.
- `/api/beat-events/dump` — GET, 500ms. Beat event trace dump.
- `/api/latency/probe` — GET, 200ms. Latency probe configuration and status.
- `/api/latency/align` — GET, 200ms. Latency alignment/phase details.

## Diagnostics & Realtime
- `/api/diag` — GET, 200ms. Diagnostics configuration: `enabled`, `interval_ms`, `probe_logging`.
- `/api/diag` — POST, 300ms. Update diagnostics; persisted to NVS `diagnostics` namespace.
- `/api/realtime/config` — GET, 200ms. Real-time WebSocket config: `enabled`, `interval_ms`.
- `/api/realtime/config` — POST, 300ms. Update and persist realtime config to NVS `realtime_ws`.

## Configuration & Reset
- `/api/config/backup` — GET, 2000ms. Download backup of configuration.
- `/api/config/restore` — POST, 2000ms. Restore configuration from payload.
- `/api/reset` — POST, 1000ms. Device reset command.

## Wi‑Fi
- `/api/wifi/link-options` — GET, 500ms. Link options (channel, PHY, etc.).
- `/api/wifi/link-options` — POST, 300ms. Update link options.
- `/api/wifi/credentials` — GET, 500ms. Stored Wi‑Fi credentials (masked).
- `/api/wifi/credentials` — POST, 1500ms. Save Wi‑Fi credentials.
- `/api/wifi/status` — GET, 500ms. Connection state, IP, RSSI, SSID, etc.
- `/api/wifi/scan` — POST, 5000ms. Initiate Wi‑Fi scan.
- `/api/wifi/scan/results` — GET, 500ms. Retrieve latest scan results.

---

## Conventions
- Rate limits: enforced per route; exceeding returns `429` with `window_ms` and `next_ms` hints.
- Persistence: diagnostics and realtime configs saved to NVS and loaded at boot.
- Content-Type: use `application/json` for `POST` bodies.
- mDNS: device advertised as `k1-reinvented.local` with HTTP and WebSocket services.

## Examples
Replace `DEVICE` with `k1-reinvented.local` or your device IP.

```sh
# Health and device info
curl -s http://DEVICE/api/health
curl -s http://DEVICE/api/device/info

# Diagnostics
curl -s http://DEVICE/api/diag
curl -s -X POST http://DEVICE/api/diag \
  -H 'Content-Type: application/json' \
  -d '{"enabled":true,"interval_ms":1000}'

# Real-time config
curl -s http://DEVICE/api/realtime/config
curl -s -X POST http://DEVICE/api/realtime/config \
  -H 'Content-Type: application/json' \
  -d '{"enabled":true,"interval_ms":250}'

# RMT telemetry and reset
curl -s http://DEVICE/api/rmt/diag
curl -s -X POST http://DEVICE/api/rmt/reset -H 'Content-Type: application/json' -d '{}'

# Wi‑Fi scan and results
curl -s -X POST http://DEVICE/api/wifi/scan -H 'Content-Type: application/json' -d '{}'
curl -s http://DEVICE/api/wifi/scan/results
```

## Notes
- All endpoints are registered in `firmware/src/webserver.cpp`; route constants and rate limits are defined in `firmware/src/webserver_rate_limiter.h`.
- Additional debug arrays/metrics endpoints are guarded by build flags (see `platformio.ini`).
- WebSocket telemetry uses the realtime config interval; message shapes are documented in the UI codebase.


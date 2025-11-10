---
title: Endpoint Specs (Top Routes)
author: team
date: 2025-11-10
status: active
intent: Request/response schemas, codes, side effects for key endpoints
---

# Endpoint Specs (Top Routes)

## GET /api/health
- Response: `{ build: { framework, idf_ver, git_sha, time }, degraded: bool, reset_cause: string }`
- Codes: `200`
- Rate‑limit: `200ms`

## GET /api/device/performance
- Response: `{ fps, histograms, cpu, memory, beat_phase? }`
- Codes: `200`
- Rate‑limit: `500ms`

## GET/POST /api/diag
- Request (POST JSON): `{ enabled: bool, interval_ms: number, probe_logging?: bool }`
- Response: same shape as config; persisted to NVS `diagnostics`.
- Codes: `200`, `400` for invalid `interval_ms`, `429` when rate‑limited.
- Rate‑limit: `GET 200ms`, `POST 300ms`
- Side effects: heartbeat logger mirrors `enabled` and `interval_ms`.

## GET/POST /api/realtime/config
- Request (POST JSON): `{ enabled: bool, interval_ms: number }`
- Response: current config; persisted to NVS `realtime_ws`.
- Codes: `200`, `400` on invalid `interval_ms`, `429` when rate‑limited.
- Rate‑limit: `GET 200ms`, `POST 300ms`
- Side effects: governs WebSocket broadcast cadence at `/ws`.

## GET /api/rmt/diag
- Response: `{ wait_timeouts: number, ch1: { empty, maxgap_us, trans_done, last_empty_us }, ch2: { ...same } }`
- Codes: `200`
- Rate‑limit: `200ms`

## POST /api/rmt/reset
- Request: `{}` (empty JSON)
- Response: same as `/api/rmt/diag` after reset (counters zeroed).
- Codes: `200`, `429` if too frequent.
- Rate‑limit: `500ms`
- Side effects: resets LED wait timeouts and RMT counters.

## GET /api/test-connection
- Response: `{ connected: bool, hostname, ip, mac, port? }`
- Codes: `200`
- Rate‑limit: `200ms`

## GET /api/metrics
- Content-Type: `text/plain` (Prometheus exposition format)
- Response: metrics lines with counters/gauges; not JSON.
- Codes: `200`
- Rate‑limit: `200ms`

## GET /api/device/info
- Response: `{ model, hostname, ip, mac, uptime_ms, build: { git_sha, time } }`
- Codes: `200`
- Rate‑limit: `1000ms`

## GET /api/frame-metrics
- Response: `{ render_avg_us, quantize_avg_us, rmt_wait_avg_us, rmt_tx_avg_us, frame_time_us, samples: number[] }`
- Codes: `200`
- Suggested pacing: `≥500ms` (no explicit window)

## GET /api/leds/frame
- Response: `{ width, height, leds: [{ r,g,b }, ...], timestamp_us }`
- Codes: `200`
- Rate‑limit: `200ms`

## GET /api/led-tx/info
- Response: `{ buffer_size, dropped, avg_us, max_us, last_tx_us }`
- Codes: `200`
- Rate‑limit: `200ms`

## GET /api/led-tx/recent
- Response: `{ recent_us: number[] }` (timestamps of recent LED TX events)
- Codes: `200`
- Rate‑limit: `300ms`

## GET /api/led-tx/dump
- Response: `{ events: { ts_us, duration_us }[] }`
- Codes: `200`
- Rate‑limit: `500ms`

## GET /api/beat-events/info
- Response: `{ probe_enabled, recent_count, thresholds }`
- Codes: `200`
- Rate‑limit: `200ms`

## GET /api/beat-events/recent
- Response: `{ events: { ts_us, phase, latency_us }[] }`
- Codes: `200`
- Rate‑limit: `300ms`

## GET /api/beat-events/dump
- Response: `{ events: { ts_us, phase, latency_us, meta? }[] }`
- Codes: `200`
- Rate‑limit: `500ms`

## GET /api/latency/probe
- Response: `{ last_probe_ms, average_ms, jitter_ms }`
- Codes: `200`
- Rate‑limit: `200ms`

## GET /api/latency/align
- Response: `{ phase_offset, alignment_quality }`
- Codes: `200`
- Rate‑limit: `200ms`

## GET /api/audio/tempo
- Response: `{ bpm, confidence, beat_phase }`
- Codes: `200`
- Rate‑limit: `200ms`

## GET /api/audio/snapshot
- Response: `{ amplitude, peaks: number[], spectrum: number[] }`
- Codes: `200`
- Rate‑limit: `300ms`

## GET /api/audio/arrays
- Response: `{ spectrum: number[], waveform: number[] }`
- Codes: `200`
- Rate‑limit: `200ms`

## GET /api/audio/metrics
- Response: `{ noise_floor_db, snr_db, gain, clipping_events }`
- Codes: `200`
- Rate‑limit: `200ms`

## POST /api/audio-config
- Request: `{ gain: number, noise_gate?: number }`
- Response: `{ ok: true, applied: { gain, noise_gate? } }`
- Codes: `200`, `400` on invalid values, `429` when rate‑limited.
- Rate‑limit: `300ms`

## POST /api/audio/noise-calibrate
- Request: `{}`
- Response: `{ ok: true, noise_floor_db }`
- Codes: `200`, `429`
- Rate‑limit: `1000ms`

## GET /api/patterns
- Response: `{ patterns: [{ index, id, name, is_audio_reactive? }...] }`
- Codes: `200`
- Rate‑limit: `1000ms`

## GET /api/palettes
- Response: `{ palettes: [{ id, name, colors: [{ r,g,b }...] }] }`
- Codes: `200`
- Rate‑limit: `2000ms`

## POST /api/select
- Request: `{ index?: number, id?: string }`
- Response: `{ ok: true, selected: { index, id } }`
- Codes: `200`, `400` invalid target, `429` when rate‑limited.
- Rate‑limit: `200ms`
- Side effects: switches pattern immediately; persists selection.

## GET /api/pattern/current
- Response: `{ index, id, name }`
- Codes: `200`
- Rate‑limit: `200ms`

## GET /api/params
- Response: full parameters object `{ brightness, softness, color, saturation, warmth, background, speed, palette_id, ... }`
- Codes: `200`
- Rate‑limit: `150ms`

## POST /api/params
- Request: partial params accepted; unknown fields ignored.
- Response: `{ ok: true, applied: { ... } }`
- Codes: `200`, `400` invalid field/type, `429` when rate‑limited.
- Rate‑limit: `300ms`
- Side effects: updates renderer immediately; persisted.

## GET /api/config/backup
- Response: full configuration snapshot (patterns, params, wifi, diagnostics, realtime).
- Codes: `200`
- Rate‑limit: `2000ms`

## POST /api/config/restore
- Request: configuration snapshot; fields may be partial.
- Response: `{ ok: true, restored: { ... } }`
- Codes: `200`, `400` invalid, `429` when rate‑limited.
- Rate‑limit: `2000ms`

## GET /api/wifi/status
- Response: `{ connected, ssid, rssi_dbm, ip, channel, auth_mode, uptime_ms }`
- Codes: `200`
- Rate‑limit: `500ms`

## GET /api/wifi/link-options
- Response: `{ power_save, ht20, country, tx_power, channel? }`
- Codes: `200`
- Rate‑limit: `500ms`

## POST /api/wifi/link-options
- Request: `{ power_save?: bool, ht20?: bool, country?: string, tx_power?: number }`
- Response: `{ ok: true, applied: { ... } }`
- Codes: `200`, `400`, `429`
- Rate‑limit: `300ms`

## GET /api/wifi/credentials
- Response: `{ ssid?: string, username?: string, has_password: bool }`
- Codes: `200`
- Rate‑limit: `500ms`

## POST /api/wifi/credentials
- Request: `{ ssid, password }` (or enterprise fields)
- Response: `{ ok: true }`
- Codes: `200`, `400`, `429`
- Rate‑limit: `1500ms` (cooldown applies)

## POST /api/wifi/scan
- Request: `{}`
- Response: `{ started: true }`
- Codes: `200`, `429`
- Rate‑limit: `5000ms`

## GET /api/wifi/scan/results
- Response: `{ results: [{ ssid, rssi_dbm, channel, auth_mode }] }`
- Codes: `200`
- Suggested pacing: `≥500ms` (no explicit window)

---
title: API Quick Tests
author: team
date: 2025-11-10
status: active
intent: Copy‑pasteable curl suites for fast bench validation
---

# API Quick Tests

Base device: use `http://k1-reinvented.local/` (mDNS) or IP (e.g., `http://192.168.1.105/`).

Tip: export `DEVICE` for convenience.

```sh
export DEVICE=http://k1-reinvented.local
```

## Health & Info
```sh
curl -s $DEVICE/api/health | jq .
curl -s $DEVICE/api/device/info | jq .
curl -s $DEVICE/metrics | head -n 20
```

## Diagnostics (GET/POST)
```sh
# Read current diagnostics config
curl -s $DEVICE/api/diag | jq .

# Enable diagnostics at 1000ms (persisted)
curl -s -X POST $DEVICE/api/diag \
  -H 'Content-Type: application/json' \
  -d '{"enabled":true,"interval_ms":1000}' | jq .

# Confirm persisted config
curl -s $DEVICE/api/diag | jq .
```

## Realtime WebSocket Config (GET/POST)
```sh
curl -s $DEVICE/api/realtime/config | jq .
curl -s -X POST $DEVICE/api/realtime/config \
  -H 'Content-Type: application/json' \
  -d '{"enabled":true,"interval_ms":250}' | jq .
```

## RMT Telemetry & Reset
```sh
curl -s $DEVICE/api/rmt/diag | jq .
curl -s -X POST $DEVICE/api/rmt/reset -H 'Content-Type: application/json' -d '{}' | jq .
curl -s $DEVICE/api/rmt/diag | jq .
```

## LED & Performance
```sh
curl -s $DEVICE/api/device/performance | jq .
curl -s $DEVICE/api/led-tx/info | jq .
curl -s $DEVICE/api/led-tx/recent | jq .
```

## Wi‑Fi Scan & Status
```sh
curl -s $DEVICE/api/wifi/status | jq .
curl -s -X POST $DEVICE/api/wifi/scan -H 'Content-Type: application/json' -d '{}' | jq .
sleep 2
curl -s $DEVICE/api/wifi/scan/results | jq .
```

## Patterns & Params
```sh
curl -s $DEVICE/api/patterns | jq length
curl -s $DEVICE/api/palettes | jq length
curl -s $DEVICE/api/params | jq .
```

## Pacing & Errors
- Respect route rate‑limits to avoid `429` (see Rate‑Limit Policy).
- Use `Content-Type: application/json` for POSTs.
- For `429`, read `window_ms` and `next_ms` in payload to time the next request.


## CLI Harness
Automate the quick tests with built‑in `429` backoff:

- Basic suite: `python tools/api_quick_tests.py --host <device-ip> --suite basic`
- Audio suite: `python tools/api_quick_tests.py --host <device-ip> --suite audio`
- Wi‑Fi suite: `python tools/api_quick_tests.py --host <device-ip> --suite wifi`

Tip: set `K1_HOST` env var and omit `--host`.

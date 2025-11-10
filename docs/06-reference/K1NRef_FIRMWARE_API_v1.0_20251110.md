# Firmware HTTP API Reference

Access the device via mDNS at `http://k1-reinvented.local/` or by IP (e.g., `http://192.168.1.105/`). All endpoints respond with JSON.

## Diagnostics

- `GET /api/diag`
  - Response: `{ "enabled": boolean, "interval_ms": number, "probe_logging": boolean }`
  - Notes: Values are loaded from NVS at webserver init.

- `POST /api/diag`
  - Body: `{ "enabled": boolean, "interval_ms": number }`
  - Response mirrors current state: `{ "enabled": boolean, "interval_ms": number, "probe_logging": boolean }`
  - Side effects:
    - Persists to NVS namespace `diagnostics` keys `enabled`, `interval_ms`.
    - Applies to heartbeat logger: logging enabled mirrors `enabled`; interval is set to `interval_ms`.

Examples:

```sh
curl -s http://k1-reinvented.local/api/diag
curl -s -X POST http://k1-reinvented.local/api/diag -H 'Content-Type: application/json' -d '{"enabled":true,"interval_ms":1000}'
```

## Realtime WebSocket Config

- `GET /api/realtime/config`
  - Response: `{ "enabled": boolean, "interval_ms": number }`
  - Notes: Values are loaded from NVS at webserver init.

- `POST /api/realtime/config`
  - Body: `{ "enabled": boolean, "interval_ms": number }`
  - Response mirrors current state: `{ "enabled": boolean, "interval_ms": number }`
  - Side effects:
    - Persists to NVS namespace `realtime_ws` keys `enabled`, `interval_ms`.
    - `interval_ms` is validated against allowed bounds; invalid values fall back to the default.

Examples:

```sh
curl -s http://k1-reinvented.local/api/realtime/config
curl -s -X POST http://k1-reinvented.local/api/realtime/config -H 'Content-Type: application/json' -d '{"enabled":true,"interval_ms":500}'
```

## RMT Telemetry

- `GET /api/rmt/diag`
  - Response:
    ```json
    {
      "wait_timeouts": number,
      "ch1": { "empty": number, "maxgap_us": number, "trans_done": number, "last_empty_us": number },
      "ch2": { "empty": number, "maxgap_us": number, "trans_done": number, "last_empty_us": number }
    }
    ```

- `POST /api/rmt/reset`
  - Body: `{}` (no fields required)
  - Response: Counters immediately after reset, e.g. `{ "wait_timeouts": 0, "ch1": { ... }, "ch2": { ... } }`
  - Side effects:
    - Resets all RMT probe counters (both channels).
    - Resets LED RMT wait timeouts (`g_led_rmt_wait_timeouts`).

Examples:

```sh
curl -s http://k1-reinvented.local/api/rmt/diag
curl -s -X POST http://k1-reinvented.local/api/rmt/reset -H 'Content-Type: application/json' -d '{}'
```

## Rate Limiting Windows

These representative windows help avoid resource abuse:

- `GET /api/diag`: 200 ms
- `POST /api/diag`: 300 ms
- `GET /api/realtime/config`: 200 ms
- `POST /api/realtime/config`: 300 ms
- `GET /api/rmt/diag`: 200 ms
- `POST /api/rmt/reset`: 500 ms

## PlatformIO Commands

- Build: `pio run`
- Upload: `pio run -t upload`
- Monitor: `pio device monitor -b 2000000 --port <serial_port>`

Tip: Use mDNS via `http://k1-reinvented.local/` for convenience in local networks.


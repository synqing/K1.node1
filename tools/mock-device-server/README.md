# Mock Device Server

Lightweight, dependency-free HTTP server that simulates core firmware endpoints for local development. Useful when a physical device is unavailable.

## Endpoints
- `GET /api/test-connection` → `{ "status": "ok" }`
- `GET /api/health` → basic health payload
- `GET /api/device/info` → sample device info
- `GET /api/rmt/diag` → sample telemetry
- `POST /api/rmt/reset` → `{ "status": "ok" }`

All responses include permissive CORS headers to support browser calls from `http://localhost:3004` (or other dev ports).

## Run

```bash
node tools/mock-device-server/server.js
# Optional: override port
MOCK_DEVICE_PORT=8081 node tools/mock-device-server/server.js
```

Then set the device IP in the webapp’s Manual Connection input to `localhost:8080` (or your chosen port).


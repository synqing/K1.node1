---
title: Security and Access Control Guidelines
status: draft
---

Key Considerations

- Gate sensitive endpoints behind authentication/authorization
  - Mutation endpoints: `POST /api/wifi/channel`, `POST /api/wifi/tx-power`, `POST /api/wifi/power-save`, `POST /api/wifi/reassociate`
  - Require a token (e.g., HMAC or JWT) and role-based checks; reject unauthenticated requests with `401/403`

- Rate limits and audit logs
  - Enforce per-route windows server-side (429 on violation); record `X-RateLimit-Window` and `X-RateLimit-NextAllowedMs`
  - Emit audit events for mutations with timestamp, client IP, route, payload hash
  - Provide a “hardware-safe mode” to disable or constrain mutations in production builds

Headers

- `X-RateLimit-Window`: integer milliseconds for the current route window
- `X-RateLimit-NextAllowedMs`: integer milliseconds until next allowed request
- Error body shape: `ErrorResponse { error, message?, timestamp?, status? }`

- CORS policy
  - Expose only read endpoints cross-origin; restrict mutations via CORS when UI is off-device
  - OPTIONS preflight returns `204` with `Access-Control-Allow-*`; ensure all error paths include CORS

Operational Notes

- Reassociation interrupts connectivity; debounce UI triggers and ensure auto-reconnect for WebSocket and REST
- Asynchronous WiFi scanning avoids CPU/network stalls; poll completion before returning results
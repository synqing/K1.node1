---
title: HTTP Server Architecture
author: team
date: 2025-11-10
status: active
intent: Explain handler pipeline, rate‑limiter, CORS, JSON sizing, and mDNS
---

# HTTP Server Architecture

## Pipeline
- `K1RequestHandler` base orchestrates request parsing and response building.
- `registerGetHandler` / `registerPostHandler` bind routes in `webserver.cpp`.
- Rate‑limiter checks against `control_windows` before handler logic.
- CORS headers added for browser/dev‑tool access.

## JSON & Buffers
- `StaticJsonDocument` sizing tuned per handler; telemetry docs increased where needed (e.g., RMT payload).
- Avoid large allocations in hot paths; use stack buffers and bounded serialization.

## WebSocket
- `AsyncWebSocket` at `/ws` broadcasts telemetry; gated by realtime config.
- mDNS advertises `ws.tcp` with txt records: `path=/ws`, `protocol=K1RealtimeData`.

## mDNS & Discovery
- Hostname: `k1-reinvented.local`; services for HTTP and WebSocket registered.

## Error Handling
- Standardized `429` payload includes `window_ms` and `next_ms`.
- `400` used for malformed JSON or invalid fields (e.g., negative intervals).

